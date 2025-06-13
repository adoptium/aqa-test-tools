#!/usr/bin/env bash
#
# commit_hunter.sh
#
# Usage:
#   ./commit_hunter.sh "<GOOD_BUILD_TEXT>" "<BAD_BUILD_TEXT>"
#
# It will extract OpenJ9/OMR/JCL SHAs from the two build‐output blobs
# and echo the three “compare” URLs. 

set -euo pipefail

GOOD_BUILD="$1"
BAD_BUILD="$2"

extract_hash() {
  local prefix="$1"   # e.g. "OpenJ9" or "OMR" or "JCL"
  local text="$2"
  printf '%s\n' "$text" \
    | grep -Po "${prefix}\s*-\s*\K[0-9a-f]+" \
    | head -n 1
}

# 1) Extract “good” SHAs
good_openj9=$(extract_hash "OpenJ9" "$GOOD_BUILD")
good_omr=$(extract_hash "OMR" "$GOOD_BUILD")
good_jcl=$(extract_hash "JCL" "$GOOD_BUILD")

if [[ -z "$good_openj9" || -z "$good_omr" || -z "$good_jcl" ]]; then
  echo "ERROR: Failed to parse one or more hashes from GOOD_BUILD"
  exit 1
fi

# 2) Extract “bad” SHAs
bad_openj9=$(extract_hash "OpenJ9" "$BAD_BUILD")
bad_omr=$(extract_hash "OMR" "$BAD_BUILD")
bad_jcl=$(extract_hash "JCL" "$BAD_BUILD")

if [[ -z "$bad_openj9" || -z "$bad_omr" || -z "$bad_jcl" ]]; then
  echo "ERROR: Failed to parse one or more hashes from BAD_BUILD"
  exit 1
fi

# 3) Build the compare URLs
url_openj9="https://github.com/eclipse-openj9/openj9/compare/${good_openj9}...${bad_openj9}"
url_omr="https://github.com/eclipse-omr/omr/compare/${good_omr}...${bad_omr}"
url_jcl="https://github.com/ibmruntimes/openj9-openjdk-jdk21/compare/${good_jcl}...${bad_jcl}"

# 4) Print them
echo "=== FINAL COMPARE URLS ==="
echo "$url_openj9"
echo "$url_omr"
echo "$url_jcl"
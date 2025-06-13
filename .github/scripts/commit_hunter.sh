#!/usr/bin/env bash
#
# .github/scripts/commit_hunter.sh
#
# Arg1: the full GitHub comment body
#
set -euo pipefail

COMMENT="$1"

# 1) Remove leading /gitcompare line
BODY="${COMMENT#*\/gitcompare}"

# 2) Normalize Windows line endings
BODY="${BODY//$'\r'/}"

# 3) Split on the first line containing only dashes (allowing spaces)
#    We use awk for robustness
GOOD=$(printf '%s\n' "$BODY" \
  | awk 'BEGIN{sep="---"} 
         $0 ~ "^[[:space:]]*" sep "[[:space:]]*$" { exit } 
         {print}')

BAD=$(printf '%s\n' "$BODY" \
  | awk 'BEGIN{sep="---"} 
         $0 ~ "^[[:space:]]*" sep "[[:space:]]*$" {found=1; next} 
         found {print}')

# 4) Trim blank lines
trim() { printf '%s\n' "$1" | sed '/^[[:space:]]*$/d'; }
GOOD=$(trim "$GOOD")
BAD=$(trim "$BAD")

# >>> Now you have two variables, GOOD and BAD, containing exactly what you need.
# For example:
echo "Comparing these SHAs from GOOD:"
echo "$GOOD" | grep -oE '[0-9a-f]{7,}' 
echo
echo "…against BAD:"
echo "$BAD"  | grep -oE '[0-9a-f]{7,}'
echo

# 5) Call your existing compare routine.
#    Pass GOOD and BAD as multi-line arguments:
./commit_hunter_core.sh "$GOOD" "$BAD"

#!/bin/bash
set -e

COMMENT="$1"

# Remove the command prefix
COMMENT=${COMMENT#.ch_gitcompare}

# Extract arguments
if [[ $COMMENT =~ --good_build[[:space:]]+(.*)[[:space:]]+--bad_build[[:space:]]+(.*) ]]; then
  GOOD_BUILD="${BASH_REMATCH[1]}"
  BAD_BUILD="${BASH_REMATCH[2]}"
else
  echo "Error: Invalid format. Please use: .ch_gitcompare --good_build <good_build> --bad_build <bad_build>"
  exit 1
fi

# Clean whitespace and quotes
GOOD_BUILD=$(echo "$GOOD_BUILD" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's/^"//;s/"$//')
BAD_BUILD=$(echo "$BAD_BUILD" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's/^"//;s/"$//')

# Validate
if [ -z "$GOOD_BUILD" ] || [ -z "$BAD_BUILD" ]; then
  echo "Error: One of the builds is empty"
  exit 1
fi

echo "good_build<<EOF" >> $GITHUB_OUTPUT
echo "$GOOD_BUILD" >> $GITHUB_OUTPUT
echo "EOF" >> $GITHUB_OUTPUT

echo "bad_build<<EOF" >> $GITHUB_OUTPUT
echo "$BAD_BUILD" >> $GITHUB_OUTPUT
echo "EOF" >> $GITHUB_OUTPUT

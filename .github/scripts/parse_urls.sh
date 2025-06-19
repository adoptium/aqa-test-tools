#!/bin/bash
set -e

OUTPUT_FILE="./CommitHunter/output.txt"

if [ -f "$OUTPUT_FILE" ]; then
  echo "Found output file"
  cat "$OUTPUT_FILE"

  url_openj9=$(grep "OpenJ9:" "$OUTPUT_FILE" | awk '{print $2}')
  url_omr=$(grep "OMR:" "$OUTPUT_FILE" | awk '{print $2}')
  url_jcl=$(grep "JCL:" "$OUTPUT_FILE" | awk '{print $2}')

  echo "url_openj9=$url_openj9" >> $GITHUB_OUTPUT
  echo "url_omr=$url_omr" >> $GITHUB_OUTPUT
  echo "url_jcl=$url_jcl" >> $GITHUB_OUTPUT
else
  echo "Error: output.txt not found"
  exit 1
fi

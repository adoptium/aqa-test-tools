#!/bin/bash

parse_java_version() {
    local version_output="$1"
    local result=""

    # Debug output
    echo "Parsing version output: $version_output" >&2

    if [[ $version_output =~ openjdk_version=([0-9]+\.[0-9]+\.[0-9]+-beta) ]]; then
        result+="openjdk_version=${BASH_REMATCH[1]}\n"
    fi

    if [[ $version_output =~ OpenJ9[[:space:]]*-[[:space:]]*([0-9a-f]+) ]]; then
        result+="openj9_commit=${BASH_REMATCH[1]}\n"
    fi

    if [[ $version_output =~ OMR[[:space:]]*-[[:space:]]*([0-9a-f]+) ]]; then
        result+="omr_commit=${BASH_REMATCH[1]}\n"
    fi

    if [[ $version_output =~ JCL[[:space:]]*-[[:space:]]*([0-9a-f]+) ]]; then
        result+="jcl_commit=${BASH_REMATCH[1]}\n"
    fi

    echo -e "$result"
}

generate_compare_urls() {
    local good_info="$1"
    local bad_info="$2"

    declare -A good
    declare -A bad

    while IFS='=' read -r key value; do
        if [[ -n $key ]]; then
            good[$key]="$value"
        fi
    done <<< "$good_info"

    while IFS='=' read -r key value; do
        if [[ -n $key ]]; then
            bad[$key]="$value"
        fi
    done <<< "$bad_info"

    jdk_major_version=$(echo "${good[openjdk_version]}" | cut -d '.' -f1)

    echo "OpenJ9: https://github.com/eclipse-openj9/openj9/compare/${good[openj9_commit]}...${bad[openj9_commit]}"
    echo "OMR: https://github.com/eclipse-omr/omr/compare/${good[omr_commit]}...${bad[omr_commit]}"
    echo "JCL: https://github.com/ibmruntimes/openj9-openjdk-jdk${jdk_major_version}/compare/${good[jcl_commit]}...${bad[jcl_commit]}"
}

# Entry Point

if [ $# -ne 2 ]; then
    echo "Usage: $0 <good_build_file> <bad_build_file>"
    exit 1
fi

GOOD_BUILD="$1"
BAD_BUILD="$2"

if [[ ! -f "$GOOD_BUILD" || ! -f "$BAD_BUILD" ]]; then
    echo "❌ One of the input files doesn't exist: $GOOD_BUILD or $BAD_BUILD"
    exit 1
fi

# Debug output
echo "Good build: $GOOD_BUILD" >&2
echo "Bad build: $BAD_BUILD" >&2

# Read and parse file contents
GOOD_CONTENT=$(cat "$GOOD_BUILD")
BAD_CONTENT=$(cat "$BAD_BUILD")

GOOD_INFO=$(parse_java_version "$GOOD_CONTENT")
BAD_INFO=$(parse_java_version "$BAD_CONTENT")

# Debug output
echo "Good info: $GOOD_INFO" >&2
echo "Bad info: $BAD_INFO" >&2

required_fields=("openjdk_version" "openj9_commit" "omr_commit" "jcl_commit")
for field in "${required_fields[@]}"; do
    if ! echo "$GOOD_INFO" | grep -q "^$field=" || ! echo "$BAD_INFO" | grep -q "^$field="; then
        echo "Error: Missing required field: $field" >&2
        exit 1
    fi
done

generate_compare_urls "$GOOD_INFO" "$BAD_INFO"

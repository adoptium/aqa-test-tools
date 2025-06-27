import re
import sys

def parse_java_version(version_output):
    result = []

    print(f"Parsing version output: {version_output}", file=sys.stderr)

    openjdk_match = re.search(r'openjdk\s+version\s+\"?(\d+)\.\d+\.\d+-beta', version_output)
    if openjdk_match:
        result.append(f"openjdk_version={openjdk_match.group(1)}")

    openj9_match = re.search(r'OpenJ9\s*-\s*([0-9a-f]+)', version_output)
    if openj9_match:
        result.append(f"openj9_commit={openj9_match.group(1)}")

    omr_match = re.search(r'OMR\s*-\s*([0-9a-f]+)', version_output)
    if omr_match:
        result.append(f"omr_commit={omr_match.group(1)}")

    jcl_match = re.search(r'JCL\s*-\s*([0-9a-f]+)', version_output)
    if jcl_match:
        result.append(f"jcl_commit={jcl_match.group(1)}")

    return "\n".join(result)

def generate_compare_urls(good_info, bad_info):
    good = {}
    bad = {}

    for line in good_info.strip().splitlines():
        if '=' in line:
            key, value = line.strip().split('=', 1)
            good[key] = value

    for line in bad_info.strip().splitlines():
        if '=' in line:
            key, value = line.strip().split('=', 1)
            bad[key] = value

    print(f"OpenJ9: https://github.com/eclipse-openj9/openj9/compare/{good['openj9_commit']}...{bad['openj9_commit']}")
    print(f"OMR: https://github.com/eclipse-omr/omr/compare/{good['omr_commit']}...{bad['omr_commit']}")
    print(f"JCL: https://github.com/ibmruntimes/openj9-openjdk-jdk{good['openjdk_version']}/compare/{good['jcl_commit']}...{bad['jcl_commit']}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python commit_hunter.py <good_build> <bad_build>")
        sys.exit(1)

    good_build = sys.argv[1]
    bad_build = sys.argv[2]

    print(f"Good build: {good_build}", file=sys.stderr)
    print(f"Bad build: {bad_build}", file=sys.stderr)

    good_info = parse_java_version(good_build)
    bad_info = parse_java_version(bad_build)

    print(f"Good info: {good_info}", file=sys.stderr)
    print(f"Bad info: {bad_info}", file=sys.stderr)

    required_fields = ["openjdk_version", "openj9_commit", "omr_commit", "jcl_commit"]
    for field in required_fields:
        if not any(line.startswith(f"{field}=") for line in good_info.splitlines()):
            print(f"Error: Missing required field: {field}", file=sys.stderr)
            sys.exit(1)
        if not any(line.startswith(f"{field}=") for line in bad_info.splitlines()):
            print(f"Error: Missing required field: {field}", file=sys.stderr)
            sys.exit(1)

    generate_compare_urls(good_info, bad_info)
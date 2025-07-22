#!/bin/bash

# C/C++ Code Metrics Calculator
# Calculates McCabe and Halstead metrics for C/C++ files from GitHub repository

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables
REPO_URL=""
WORK_DIR=""
OUTPUT_DIR=""
TEMP_DIR=""
VERBOSE=false

# Configurable parameters
HALSTEAD_D_MAX="${HALSTEAD_D_MAX:-200}"  # Max difficulty cap to prevent overflow
HALSTEAD_B_MAX="${HALSTEAD_B_MAX:-3}"    # Max bug estimate cap to limit unrealistic values
INCLUDE_KEYWORD_OPERATORS="${INCLUDE_KEYWORD_OPERATORS:-true}"  # Include control keywords as operators

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Function to validate and sanitize numeric values
sanitize_number() {
    local value="$1"
    local default="${2:-0}"
    
    value=$(echo "$value" | tr -d '\n\r' | xargs)
    
    if [[ "$value" =~ ^-?[0-9]*\.?[0-9]+$ ]] || [[ "$value" =~ ^-?[0-9]+$ ]]; then
        echo "$value"
    else
        print_warning "Invalid number '$value' for sanitization, using default $default"
        echo "$default"
    fi
}

# Function to check if command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "Command '$1' not found. Please install it first."
        return 1
    fi
    return 0
}

# Function to install dependencies
install_dependencies() {
    print_info "Checking and installing dependencies..."
    
    if ! check_command git; then
        print_error "Git is required but not installed."
        exit 1
    fi
    
    if ! check_command python3; then
        print_error "Python3 is required but not installed."
        exit 1
    fi
    
    if ! check_command pip3; then
        print_error "pip3 is required but not installed."
        exit 1
    fi
    
    print_info "Installing Python dependencies..."
    pip3 install --user lizard pygount 2>/dev/null || {
        print_warning "Some Python packages may already be installed or failed to install"
    }
    
    if ! check_command cloc; then
        print_warning "cloc not found. Attempting to install..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y cloc
        elif command -v yum &> /dev/null; then
            sudo yum install -y cloc
        elif command -v brew &> /dev/null; then
            brew install cloc
        else
            print_warning "Could not install cloc automatically. Please install it manually."
        fi
    fi
}

# Function to setup working directory
setup_work_dir() {
    WORK_DIR=$(mktemp -d)
    OUTPUT_DIR="$PWD/metrics_output_$(date +%Y%m%d_%H%M%S)"
    TEMP_DIR="$WORK_DIR/temp"
    
    mkdir -p "$OUTPUT_DIR"
    mkdir -p "$TEMP_DIR"
    
    print_info "Working directory: $WORK_DIR"
    print_info "Output directory: $OUTPUT_DIR"
}

# Function to clone repository
clone_repository() {
    local repo_url="$1"
    local repo_dir="$WORK_DIR/repo"
    
    print_info "Cloning repository: $repo_url"
    
    if git clone "$repo_url" "$repo_dir" >/dev/null 2>&1; then
        print_success "Repository cloned successfully"
        # Remove test folders (case-insensitive)
        find "$repo_dir" -type d -iname "test" -exec rm -rf {} +
        print_info "Removed test folders from cloned repository"
        echo "$repo_dir"
    else
        print_error "Failed to clone repository"
        exit 1
    fi
}

# Function to find C/C++ files
find_cpp_files() {
    local repo_dir="$1"
    local cpp_files_list="$TEMP_DIR/cpp_files.txt"
    
    print_info "Finding C/C++ files..."
    
    find "$repo_dir" -type f \( \
        -name "*.c" -o \
        -name "*.cpp" -o \
        -name "*.cxx" -o \
        -name "*.cc" -o \
        -name "*.h" -o \
        -name "*.hpp" -o \
        -name "*.hxx" \
    \) > "$cpp_files_list"
    
    local file_count=$(wc -l < "$cpp_files_list" | tr -d '\n\r' | xargs)
    print_success "Found $file_count C/C++ files"
    
    echo "$cpp_files_list"
}

# Function to calculate McCabe Cyclomatic Complexity using flowgraph formula
calculate_mccabe_complexity() {
    local file="$1"
    local output_file="$2"

    if [ ! -s "$file" ]; then
        print_warning "Skipping empty file: $file"
        echo "1"
        return 0
    fi

    # Create a temporary Python script to estimate nodes and edges
    cat > "$TEMP_DIR/cfg_mccabe.py" << 'EOF'
import sys
import re

def estimate_cfg(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()
    except Exception as e:
        print("1")
        return

    # Remove comments and strings
    code = re.sub(r'//.*?\n', '', code)
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
    code = re.sub(r'"[^"]*"', '', code)
    code = re.sub(r"'[^']*'", '', code)

    # Estimate nodes: count statements (lines ending with ;)
    nodes = len(re.findall(r';', code))
    # Estimate edges: count control flow statements (if, for, while, case, goto, break, continue, return)
    edges = len(re.findall(r'\b(if|for|while|case|goto|break|continue|return)\b', code))
    # Add edges for function calls (roughly)
    edges += len(re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(', code))

    # Add 1 to nodes for entry point
    nodes += 1

    # Cyclomatic complexity formula
    vG = edges - nodes + 2
    vG = max(vG, 1)
    print(str(vG))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("1")
        sys.exit(1)
    estimate_cfg(sys.argv[1])
EOF

    local complexity=$(python3 "$TEMP_DIR/cfg_mccabe.py" "$file" 2>/dev/null)
    complexity=$(sanitize_number "${complexity:-1}" "1")
    echo "$complexity"
}

# Function to calculate Halstead metrics using custom implementation
calculate_halstead_metrics() {
    local file="$1"
    
    if [ ! -s "$file" ]; then
        print_warning "Skipping empty file: $file"
        echo "n:0
v:0
l:0
d:0
i:0
e:0
b:0
t:0
uniq_Op:0
uniq_Opnd:0
total_Op:0
total_Opnd:0"
        return 0
    fi

    # Create a temporary Python script to calculate Halstead metrics
    cat > "$TEMP_DIR/halstead_calculator.py" << 'EOF'
import sys
import re
import math

def calculate_halstead_metrics(file_path, include_keywords, d_max, b_max):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file {file_path}: {e}", file=sys.stderr)
        return {
            'n': 0, 'v': "0.00", 'l': "0.00", 'd': "0.00",
            'i': "0.00", 'e': "0.00", 'b': "0.00", 't': "0.00",
            'uniq_Op': 0, 'uniq_Opnd': 0, 'total_Op': 0, 'total_Opnd': 0
        }
    
    # Remove comments and strings
    content = re.sub(r'//.*?\n', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r'"[^"]*"', '', content)
    content = re.sub(r"'[^']*'", '', content)
    
    # Skip if content is empty or only whitespace after preprocessing
    if not content.strip():
        print(f"File {file_path} contains no code after preprocessing", file=sys.stderr)
        return {
            'n': 0, 'v': "0.00", 'l': "0.00", 'd': "0.00",
            'i': "0.00", 'e': "0.00", 'b': "0.00", 't': "0.00",
            'uniq_Op': 0, 'uniq_Opnd': 0, 'total_Op': 0, 'total_Opnd': 0
        }
    
    # C/C++ operators (control keywords included based on config)
    operators = [
        # Arithmetic
        r'\+', r'-', r'\*', r'/', r'%', r'\+\+', r'--',
        # Assignment
        r'=', r'\+=', r'-=', r'\*=', r'/=', r'%=', r'&=', r'\|=', r'\^=', r'<<=', r'>>=',
        # Comparison
        r'==', r'!=', r'<', r'>', r'<=', r'>=',
        # Logical
        r'&&', r'\|\|', r'!',
        # Bitwise
        r'&', r'\|', r'\^', r'~', r'<<', r'>>',
        # Other
        r'\?', r':', r'->', r'\.', r',', r';',
        # Brackets
        r'\(', r'\)', r'\[', r'\]', r'\{', r'\}'
    ]
    
    # Note: Including control keywords as operators (configurable)
    if include_keywords.lower() == 'true':
        operators.extend([
            r'\bif\b', r'\belse\b', r'\bwhile\b', r'\bfor\b', r'\bdo\b',
            r'\bswitch\b', r'\bcase\b', r'\bdefault\b', r'\breturn\b',
            r'\bbreak\b', r'\bcontinue\b', r'\bgoto\b'
        ])
    
    operator_counts = {}
    total_operators = 0
    
    # Sort operators by length to match longer ones first
    operators.sort(key=len, reverse=True)
    
    for op in operators:
        pattern = op
        matches = len(re.findall(pattern, content))
        if matches > 0:
            operator_counts[op] = matches
            total_operators += matches
            content = re.sub(pattern, ' ', content)
    
    # Count operands (identifiers and literals)
    operand_pattern = r'\b[a-zA-Z_][a-zA-Z0-9_]*\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b'
    operands = re.findall(operand_pattern, content)
    
    # Filter out keywords
    keywords = {
        'int', 'char', 'float', 'double', 'void', 'bool', 'long', 'short',
        'signed', 'unsigned', 'const', 'static', 'extern', 'register',
        'auto', 'volatile', 'inline', 'restrict', 'true', 'false',
        'NULL', 'nullptr', 'std', 'string', 'vector', 'map', 'set',
        'list', 'queue', 'stack', 'pair', 'include', 'define',
        'ifdef', 'ifndef', 'endif', 'pragma', 'main'
    }
    
    operand_counts = {}
    total_operands = 0
    
    for operand in operands:
        if operand not in keywords and operand not in [op.strip(r'\b') for op in operators]:
            operand_counts[operand] = operand_counts.get(operand, 0) + 1
            total_operands += 1
    
    # Calculate Halstead metrics
    mu1 = len(operator_counts)  # Unique operators
    mu2 = len(operand_counts)   # Unique operands
    N1 = total_operators       # Total operators
    N2 = total_operands        # Total operands

    # --- Heuristic to calculate mu2' (potential operand count) ---
    # This logic should be placed before comment stripping to analyze the original code.
    # It finds the average number of arguments per function in the file.

    function_pattern = re.compile(r'\b\w+[\s\*&]+\w+\s*\(([^)]*)\)\s*(?:;|\{)')
    total_args = 0
    function_count = 0
    # 'content' is the raw text of the file before comments are stripped
    for match in function_pattern.finditer(content):
        function_count += 1
        arg_string = match.group(1).strip()
        if not arg_string or arg_string == 'void':
            arg_count = 0
        else:
            # Count commas and add 1 for the number of arguments
            arg_count = arg_string.count(',') + 1
        total_args += arg_count
    mu2_prime = total_args / function_count if function_count > 0 else 0
    # --- End of mu2' calculation ---

    mu = mu1 + mu2  # vocabulary
    N = N1 + N2    # length

    # Default values
    V, V_star, L, D, I, E, T = 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0

    if mu > 1 and N > 0: # log2(mu) is valid for mu > 0, but let's use mu > 1 to avoid log2(1)=0
        # P = volume = V = N * log2(mu)
        V = N * math.log2(mu)

        # V* = volume on minimal implementation = (2 + mu2')*log2(2 + mu2')
        mu1_prime = 2
        potential_vocab = mu1_prime + mu2_prime
        if potential_vocab > 1:
            V_star = potential_vocab * math.log2(potential_vocab)

        # L  = program length = V*/N
        # Implementing literally as per the documentation.
        if N > 0:
            L = V_star / N
        
        # D  = difficulty = 1/L
        if L > 0:
            D = 1 / L
        
        # I  = intelligence = L'*V' => L*V
        # As per the documentation, L' = 1/D, which simplifies to L' = L.
        # The standard interpretation of I = L'*V' is I = L*V.
        I = (1 / D if D > 0 else 0) * V
        
        # E  = effort to write program = V/L 
        if L > 0:
            E = V / L
        
        # T  = time to write program = E/18 seconds
        T = E / 18

        B = min((E ** (2/3)) / 3000, float(b_max)) if E > 0 else 0

    return {
        'n': N,
        'v': f"{V:.2f}",
        'l': f"{L:.2f}",
        'd': f"{D:.2f}",
        'i': f"{I:.2f}",
        'e': f"{E:.2f}",
        'b': f"{B:.2f}",
        't': f"{T:.2f}",
        'uniq_Op': mu1,
        'uniq_Opnd': mu2,
        'total_Op': N1,
        'total_Opnd': N2
    }

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python3 halstead_calculator.py <file_path> <include_keywords> <d_max> <b_max>", file=sys.stderr)
        sys.exit(1)
    
    metrics = calculate_halstead_metrics(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
    for key, value in metrics.items():
        print(f"{key}:{value}")
EOF
    
    local halstead_output=$(python3 "$TEMP_DIR/halstead_calculator.py" "$file" "$INCLUDE_KEYWORD_OPERATORS" "$HALSTEAD_D_MAX" "$HALSTEAD_B_MAX" 2> "$TEMP_DIR/halstead_errors.log")
    if [ -z "$halstead_output" ]; then
        print_warning "Failed to calculate Halstead metrics for $file. See $TEMP_DIR/halstead_errors.log for details."
        echo "n:0
v:0
l:0
d:0
i:0
e:0
b:0
t:0
uniq_Op:0
uniq_Opnd:0
total_Op:0
total_Opnd:0"
    else
        echo "$halstead_output"
    fi
}

# Function to calculate line counts using cloc or pygount
calculate_line_counts() {
    local file="$1"
    
    if [ ! -s "$file" ]; then
        print_warning "Skipping empty file: $file"
        echo "0,0,0"
        return 0
    fi
    
    if command -v cloc &> /dev/null; then
        local cloc_output=$(cloc --csv "$file" 2>/dev/null | tail -n +2 | head -1)
        if [ -n "$cloc_output" ]; then
            echo "$cloc_output" | cut -d',' -f3,4,5 | tr -d '\n\r'
        else
            print_warning "cloc returned empty output for $file"
            echo "0,0,0"
        fi
    else
        if ! check_command pygount; then
            print_error "pygount is required for line counting but not installed."
            echo "0,0,0"
            return 0
        fi
        local pygount_output=$(pygount --format=summary "$file" 2>/dev/null)
        if [ -z "$pygount_output" ]; then
            print_warning "pygount returned empty output for $file"
            echo "0,0,0"
            return 0
        fi
        local blank_lines=$(echo "$pygount_output" | grep -oP 'Blank lines: \K\d+' || echo "0")
        local comment_lines=$(echo "$pygount_output" | grep -oP 'Comment lines: \K\d+' || echo "0")
        local code_lines=$(echo "$pygount_output" | grep -oP 'Code lines: \K\d+' || echo "0")
        
        blank_lines=$(sanitize_number "$blank_lines" "0")
        comment_lines=$(sanitize_number "$comment_lines" "0")
        code_lines=$(sanitize_number "$code_lines" "0")
        
        echo "$blank_lines,$comment_lines,$code_lines"
    fi
}

# Function to calculate McCabe essential and design complexity
calculate_extended_mccabe() {
    local file="$1"
    local cyclomatic_complexity="$2"

    # Essential complexity calculation (unchanged)
    cat > "$TEMP_DIR/essential_complexity.py" << 'EOF'
import sys
import re

def count_d_structured_primes(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()
    except Exception as e:
        print("0")
        return

    code = re.sub(r'//.*?\n', '', code)
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
    code = re.sub(r'"[^"]*"', '', code)
    code = re.sub(r"'[^']*'", '', code)

    m = 0
    m += len(re.findall(r'\bif\b', code))
    m += len(re.findall(r'\bfor\b', code))
    m += len(re.findall(r'\bwhile\b', code))
    m += len(re.findall(r'\bswitch\b', code))
    m += len(re.findall(r'\bdo\b', code))

    print(str(m))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("0")
        sys.exit(1)
    count_d_structured_primes(sys.argv[1])
EOF

    local m=$(python3 "$TEMP_DIR/essential_complexity.py" "$file" 2>/dev/null)
    m=$(sanitize_number "${m:-0}" "0")
    local essential_complexity=$((cyclomatic_complexity - m))
    if [ "$essential_complexity" -lt 1 ]; then
        essential_complexity=1
    fi
    essential_complexity=$(sanitize_number "$essential_complexity" "1")

    # Design complexity: cyclomatic complexity of reduced flowgraph (function call graph)
    cat > "$TEMP_DIR/design_complexity.py" << 'EOF'
import sys
import re

def get_function_names(code):
    # Find function definitions
    pattern = re.compile(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{')
    return set(match.group(1) for match in pattern.finditer(code))

def count_call_decisions(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()
    except Exception as e:
        print("1")
        return

    # Remove comments and strings
    code = re.sub(r'//.*?\n', '', code)
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
    code = re.sub(r'"[^"]*"', '', code)
    code = re.sub(r"'[^']*'", '', code)

    # Get all function names defined in this file
    function_names = get_function_names(code)

    # Find all function calls (excluding calls to itself and standard library)
    call_pattern = re.compile(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(')
    calls = [match.group(1) for match in call_pattern.finditer(code)]

    # Exclude calls to keywords and self-calls
    exclude = set([
        'if', 'for', 'while', 'switch', 'return', 'sizeof', 'case', 'break', 'continue', 'do', 'else'
    ])
    calls = [c for c in calls if c not in exclude and c not in function_names]

    # Decision points in call graph = number of unique called functions
    decision_points = len(set(calls))
    # Cyclomatic complexity of reduced flowgraph = decision_points + 1
    ivg = decision_points + 1
    print(str(ivg))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("1")
        sys.exit(1)
    count_call_decisions(sys.argv[1])
EOF

    local design_complexity=$(python3 "$TEMP_DIR/design_complexity.py" "$file" 2>/dev/null)
    design_complexity=$(sanitize_number "${design_complexity:-1}" "1")

    echo "$essential_complexity,$design_complexity"
}

# Function to count branches
count_branches() {
    local file="$1"
    
    # Count decision points that create branches
    local if_count=$(grep -c -E "\bif\b" "$file" 2>/dev/null | tr -d '\n\r' | xargs || echo "0")
    local for_count=$(grep -c -E "\bfor\b" "$file" 2>/dev/null | tr -d '\n\r' | xargs || echo "0")
    local while_count=$(grep -c -E "\bwhile\b" "$file" 2>/dev/null | tr -d '\n\r' | xargs || echo "0")
    local switch_count=$(grep -c -E "\bswitch\b" "$file" 2>/dev/null | tr -d '\n\r' | xargs || echo "0")
    local case_count=$(grep -c -E "\bcase\b" "$file" 2>/dev/null | tr -d '\n\r' | xargs || echo "0")
    local conditional_count=$(grep -c -E "\?" "$file" 2>/dev/null | tr -d '\n\r' | xargs || echo "0")
    local function_count=$(grep -c -E "\b[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*{" "$file" 2>/dev/null | tr -d '\n\r' | xargs || echo "0")
    
    local total_branches=$((if_count + for_count + while_count + switch_count + case_count + conditional_count + function_count))
    total_branches=$(sanitize_number "$total_branches" "0")
    
    echo "$total_branches"
}

# Function to detect defects based on git commit history
detect_defects() {
    local file="$1"
    local repo_dir="$WORK_DIR/repo"
    
    local relative_file="${file#$repo_dir/}"
    
    if [ ! -d "$repo_dir/.git" ]; then
        print_info "No git repository found for $file, marking defects as false"
        echo "false"
        return 0
    fi
    
    # Note: Using commit messages to detect defects may lead to false positives/negatives
    local bug_keywords="\b(bug|defect|crash|vulnerability|fix|issue|error)\b"
    
    cd "$repo_dir" || {
        print_error "Failed to change to repo directory for $file"
        echo "false"
        return 0
    }
    
    local has_bug_commits=$(git log --oneline --follow -- "$relative_file" 2>/dev/null | grep -Ei "$bug_keywords" | wc -l | tr -d '\n\r' | xargs || echo "0")
    has_bug_commits=$(sanitize_number "$has_bug_commits" "0")
    
    cd - >/dev/null 2>&1
    
    if [ "$has_bug_commits" -gt 0 ]; then
        echo "true"
    else
        echo "false"
    fi
}

# Function to process a single file
process_file() {
    local file="$1"
    local output_file="$2"
    
    local filename=$(basename "$file")
    local relative_path="${file#$WORK_DIR/repo/}"
    
    if [ "$VERBOSE" = true ]; then
        print_info "Processing: $relative_path"
    fi
    
    # Calculate cyclomatic complexity
    local cyclomatic_complexity=$(calculate_mccabe_complexity "$file" "$output_file")
    cyclomatic_complexity=$(sanitize_number "$cyclomatic_complexity" "1")
    
    # Calculate Halstead metrics
    local halstead_output=$(calculate_halstead_metrics "$file")
    
    local n=$(echo "$halstead_output" | grep "^n:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    local v=$(echo "$halstead_output" | grep "^v:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    local l=$(echo "$halstead_output" | grep "^l:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    local d=$(echo "$halstead_output" | grep "^d:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    local i=$(echo "$halstead_output" | grep "^i:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    local e=$(echo "$halstead_output" | grep "^e:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    local b=$(echo "$halstead_output" | grep "^b:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    local t=$(echo "$halstead_output" | grep "^t:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    local uniq_Op=$(echo "$halstead_output" | grep "^uniq_Op:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    local uniq_Opnd=$(echo "$halstead_output" | grep "^uniq_Opnd:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    local total_Op=$(echo "$halstead_output" | grep "^total_Op:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    local total_Opnd=$(echo "$halstead_output" | grep "^total_Opnd:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "0")
    
    n=$(sanitize_number "$n" "0")
    v=$(sanitize_number "$v" "0")
    l=$(sanitize_number "$l" "0")
    d=$(sanitize_number "$d" "0")
    i=$(sanitize_number "$i" "0")
    e=$(sanitize_number "$e" "0")
    b=$(sanitize_number "$b" "0")
    t=$(sanitize_number "$t" "0")
    uniq_Op=$(sanitize_number "$uniq_Op" "0")
    uniq_Opnd=$(sanitize_number "$uniq_Opnd" "0")
    total_Op=$(sanitize_number "$total_Op" "0")
    total_Opnd=$(sanitize_number "$total_Opnd" "0")
    
    # Calculate line counts
    local line_counts=$(calculate_line_counts "$file")
    local lOBlank=$(echo "$line_counts" | cut -d',' -f1 | tr -d '\n\r' | xargs || echo "0")
    local lOComment=$(echo "$line_counts" | cut -d',' -f2 | tr -d '\n\r' | xargs || echo "0")
    local lOCode=$(echo "$line_counts" | cut -d',' -f3 | tr -d '\n\r' | xargs || echo "0")
    
    lOBlank=$(sanitize_number "$lOBlank" "0")
    lOComment=$(sanitize_number "$lOComment" "0")
    lOCode=$(sanitize_number "$lOCode" "0")
    
    # Ensure valid inputs for arithmetic
    if [[ ! "$lOCode" =~ ^[0-9]+$ ]] || [[ ! "$lOComment" =~ ^[0-9]+$ ]]; then
        print_warning "Invalid line counts for $file: lOCode=$lOCode, lOComment=$lOComment"
        lOCode=0
        lOComment=0
    fi
    local lOCodeAndComment=$((lOCode + lOComment))
    lOCodeAndComment=$(sanitize_number "$lOCodeAndComment" "0")
    
    # Calculate extended McCabe metrics
    local extended_mccabe=$(calculate_extended_mccabe "$file" "$cyclomatic_complexity")
    local essential_complexity=$(echo "$extended_mccabe" | cut -d',' -f1)
    local design_complexity=$(echo "$extended_mccabe" | cut -d',' -f2)
    
    essential_complexity=$(sanitize_number "$essential_complexity" "1")
    design_complexity=$(sanitize_number "$design_complexity" "1")
    
    # Count branches
    local branchCount=$(count_branches "$file")
    branchCount=$(sanitize_number "$branchCount" "0")
    
    # Detect defects
    local defects=$(detect_defects "$file")
    
    # Note: lOCode is equivalent to loc as per Halstead metrics definition
    local loc="$lOCode"
    
    # Output results
    echo "File: $relative_path" >> "$output_file"
    echo "loc: $loc" >> "$output_file"
    echo "v(g): $cyclomatic_complexity" >> "$output_file"
    echo "ev(g): $essential_complexity" >> "$output_file"
    echo "iv(g): $design_complexity" >> "$output_file"
    echo "n: $n" >> "$output_file"
    echo "v: $v" >> "$output_file"
    echo "l: $l" >> "$output_file"
    echo "d: $d" >> "$output_file"
    echo "i: $i" >> "$output_file"
    echo "e: $e" >> "$output_file"
    echo "b: $b" >> "$output_file"
    echo "t: $t" >> "$output_file"
    echo "lOComment: $lOComment" >> "$output_file"
    echo "lOBlank: $lOBlank" >> "$output_file"
    echo "lOCodeAndComment: $lOCodeAndComment" >> "$output_file"
    echo "uniq_Op: $uniq_Op" >> "$output_file"
    echo "uniq_Opnd: $uniq_Opnd" >> "$output_file"
    echo "total_Op: $total_Op" >> "$output_file"
    echo "total_Opnd: $total_Opnd" >> "$output_file"
    echo "branchCount: $branchCount" >> "$output_file"
    echo "defects: $defects" >> "$output_file"
    echo "----------------------------------------" >> "$output_file"
}

# Function to generate summary report
generate_summary() {
    local detailed_output="$1"
    local summary_output="$2"
    
    print_info "Generating summary report..."
    
    echo "File,loc,v(g),ev(g),iv(g),n,v,l,d,i,e,b,t,lOComment,lOBlank,LOCodeAndCOmment,uniq_Op,Uniq_Opnd,total_Op,total_Opnd,branchCount,defects" > "$summary_output"
    
    awk '
    /^File:/ { file = substr($0, 7) }
    /^loc:/ { loc = $2 }
    /^v\(g\):/ { vg = $2 }
    /^ev\(g\):/ { evg = $2 }
    /^iv\(g\):/ { ivg = $2 }
    /^n:/ { n = $2 }
    /^v:/ { v = $2 }
    /^l:/ { l = $2 }
    /^d:/ { d = $2 }
    /^i:/ { i = $2 }
    /^e:/ { e = $2 }
    /^b:/ { b = $2 }
    /^t:/ { t = $2 }
    /^lOComment:/ { lOComment = $2 }
    /^lOBlank:/ { lOBlank = $2 }
    /^lOCodeAndComment:/ { lOCodeAndComment = $2 }
    /^uniq_Op:/ { uniq_Op = $2 }
    /^uniq_Opnd:/ { uniq_Opnd = $2 }
    /^total_Op:/ { total_Op = $2 }
    /^total_Opnd:/ { total_Opnd = $2 }
    /^branchCount:/ { branchCount = $2 }
    /^defects:/ { defects = $2 }
    /^----------------------------------------/ {
        if (file) {
            printf "%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
                file, loc, vg, evg, ivg, n, v, l, d, i, e, b, t, lOComment, lOBlank, lOCodeAndComment, uniq_Op, uniq_Opnd, total_Op, total_Opnd, branchCount, defects
        }
        file = loc = vg = evg = ivg = n = v = l = d = i = e = b = t = lOComment = lOBlank = lOCodeAndCOmment = uniq_Op = uniq_Opnd = total_Op = total_Opnd = branchCount = defects = ""
    }
    ' "$detailed_output" >> "$summary_output"
}

# Function to cleanup
cleanup() {
    if [ -n "$WORK_DIR" ] && [ -d "$WORK_DIR" ]; then
        rm -rf "$WORK_DIR"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] <github_repo_url>"
    echo ""
    echo "Options:"
    echo "  -v, --verbose     Enable verbose output"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 https://github.com/user/repo.git"
    echo "  $0 -v https://github.com/user/repo.git"
}

# Main function
main() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                if [ -z "$REPO_URL" ]; then
                    REPO_URL="$1"
                else
                    print_error "Multiple repository URLs provided"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    if [ -z "$REPO_URL" ]; then
        print_error "GitHub repository URL is required"
        show_usage
        exit 1
    fi
    
    trap cleanup EXIT
    
    print_info "Starting C/C++ Code Metrics Calculator"
    print_info "Repository: $REPO_URL"
    
    install_dependencies
    setup_work_dir
    local repo_dir=$(clone_repository "$REPO_URL")
    local cpp_files_list=$(find_cpp_files "$repo_dir")
    
    if [ ! -s "$cpp_files_list" ]; then
        print_warning "No C/C++ files found in the repository"
        exit 0
    fi
    
    local detailed_output="$OUTPUT_DIR/detailed_metrics.txt"
    local summary_output="$OUTPUT_DIR/summary_metrics.csv"
    
    print_info "Processing files and calculating metrics..."
    
    local total_files=$(wc -l < "$cpp_files_list" | tr -d '\n\r' | xargs)
    
    local current_file=0
    while IFS= read -r file; do
        current_file=$((current_file + 1))
        if [ "$VERBOSE" = false ]; then
            echo -ne "\rProgress: $current_file/$total_files files processed"
        fi
        process_file "$file" "$detailed_output"
    done < "$cpp_files_list"
    
    if [ "$VERBOSE" = false ]; then
        echo ""
    fi
    
    generate_summary "$detailed_output" "$summary_output"
    
    print_success "Metrics calculation completed!"
    print_info "Detailed results: $detailed_output"
    print_info "Summary CSV: $summary_output"
}

main "$@"
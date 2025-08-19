#!/bin/bash

# C/C++ Code Metrics Calculator
# Calculates McCabe and Halstead metrics for C/C++ files.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables
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
        return 1
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
    except Exception:
        print("__ERROR__")
        sys.exit(1)
    
    # Remove comments and strings
    content = re.sub(r'//.*?\n', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r'"[^"]*"', '', content)
    content = re.sub(r"'[^']*'", '', content)
    
    # Fail if content has no code after preprocessing
    if not content.strip():
        print("__ERROR__")
        sys.exit(1)
    
    operators = [
        r'\+', r'-', r'\*', r'/', r'%', r'\+\+', r'--',
        r'=', r'\+=', r'-=', r'\*=', r'/=', r'%=', r'&=' , r'\|=', r'\^=', r'<<=', r'>>=',
        r'==', r'!=', r'<', r'>', r'<=', r'>=',
        r'&&', r'\|\|', r'!',
        r'&', r'\|', r'\^', r'~', r'<<', r'>>',
        r'\?', r':', r'->', r'\.', r',', r';',
        r'\(', r'\)', r'\[', r'\]', r'\{', r'\}'
    ]
    if include_keywords.lower() == 'true':
        operators.extend([
            r'\bif\b', r'\belse\b', r'\bwhile\b', r'\bfor\b', r'\bdo\b',
            r'\bswitch\b', r'\bcase\b', r'\bdefault\b', r'\breturn\b',
            r'\bbreak\b', r'\bcontinue\b', r'\bgoto\b'
        ])
    operator_counts = {}
    total_operators = 0
    operators.sort(key=len, reverse=True)
    for op in operators:
        matches = len(re.findall(op, content))
        if matches > 0:
            operator_counts[op] = matches
            total_operators += matches
            content = re.sub(op, ' ', content)
    operand_pattern = r'\b[a-zA-Z_][a-zA-Z0-9_]*\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b'
    operands = re.findall(operand_pattern, content)
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

    mu1 = len(operator_counts)
    mu2 = len(operand_counts)
    N1 = total_operators
    N2 = total_operands
    mu = mu1 + mu2
    N = N1 + N2

    V = V_star = L = D = I = E = T = 0.0
    B = 0.0
    if mu > 1 and N > 0:
        V = N * math.log2(mu)
        function_pattern = re.compile(r'\b\w+[\s\*&]+\w+\s*\(([^)]*)\)\s*(?:;|\{)')
        total_args = 0
        function_count = 0
        for match in function_pattern.finditer(content):
            function_count += 1
            args = match.group(1).strip()
            total_args += 0 if (not args or args == 'void') else (args.count(',') + 1)
        mu2_prime = total_args / function_count if function_count > 0 else 0
        potential_vocab = 2 + mu2_prime
        if potential_vocab > 1:
            V_star = potential_vocab * math.log2(potential_vocab)
        if N > 0:
            L = V_star / N
        if L > 0:
            D = 1 / L
        I = (1 / D if D > 0 else 0) * V
        if L > 0:
            E = V / L
        T = E / 18
        try:
            b_max = float(sys.argv[4])
        except:
            b_max = 3.0
        B = min((E ** (2/3)) / 3000, b_max) if E > 0 else 0.0

    print(f"n:{N}")
    print(f"v:{V:.2f}")
    print(f"l:{L:.2f}")
    print(f"d:{D:.2f}")
    print(f"i:{I:.2f}")
    print(f"e:{E:.2f}")
    print(f"b:{B:.2f}")
    print(f"t:{T:.2f}")
    print(f"uniq_Op:{mu1}")
    print(f"uniq_Opnd:{mu2}")
    print(f"total_Op:{N1}")
    print(f"total_Opnd:{N2}")

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("__ERROR__")
        sys.exit(1)
    calculate_halstead_metrics(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
EOF

    local halstead_output
    if ! halstead_output=$(python3 "$TEMP_DIR/halstead_calculator.py" "$file" "$INCLUDE_KEYWORD_OPERATORS" "$HALSTEAD_D_MAX" "$HALSTEAD_B_MAX" 2> "$TEMP_DIR/halstead_errors.log"); then
        print_warning "Failed to calculate Halstead metrics for $file. See $TEMP_DIR/halstead_errors.log for details."
        return 1
    fi

    if echo "$halstead_output" | grep -q "__ERROR__"; then
        print_info "Skipping $file due to Halstead metrics failure."
        return 1
    fi

    echo "$halstead_output"
}

# Function to calculate line counts using cloc or pygount
calculate_line_counts() {
    local file="$1"
    
    if [ ! -s "$file" ]; then
        print_warning "Skipping empty file: $file"
        return 1
    fi
    
    if command -v cloc &> /dev/null; then
        local cloc_output
        cloc_output=$(cloc --csv "$file" 2>/dev/null | tail -n +2 | head -1)
        if [ -n "$cloc_output" ]; then
            local triple
            triple=$(echo "$cloc_output" | cut -d',' -f3,4,5 | tr -d '\n\r')
            if [ -n "$triple" ]; then
                echo "$triple"
                return 0
            fi
        fi
        print_warning "cloc returned empty/invalid output for $file"
        return 1
    else
        if ! check_command pygount; then
            print_error "pygount is required for line counting but not installed."
            return 1
        fi
        local pygount_output
        pygount_output=$(pygount --format=summary "$file" 2>/dev/null)
        if [ -z "$pygount_output" ]; then
            print_warning "pygount returned empty output for $file"
            return 1
        fi
        local blank_lines comment_lines code_lines
        blank_lines=$(echo "$pygount_output" | grep -oP 'Blank lines: \K\d+' || true)
        comment_lines=$(echo "$pygount_output" | grep -oP 'Comment lines: \K\d+' || true)
        code_lines=$(echo "$pygount_output" | grep -oP 'Code lines: \K\d+' || true)
        if [[ -z "$blank_lines" || -z "$comment_lines" || -z "$code_lines" ]]; then
            print_warning "Failed to parse pygount output for $file"
            return 1
        fi
        blank_lines=$(sanitize_number "$blank_lines" "0")
        comment_lines=$(sanitize_number "$comment_lines" "0")
        code_lines=$(sanitize_number "$code_lines" "0")
        echo "$blank_lines,$comment_lines,$code_lines"
        return 0
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
    pattern = re.compile(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?:;|\{)')
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

# Function to write CSV header once
write_csv_header() {
    local csv_output="$1"
    echo "File,loc,v(g),ev(g),iv(g),n,v,l,d,i,e,b,t,lOComment,lOBlank,LOCodeAndComment,uniq_Op,Uniq_Opnd,total_Op,total_Opnd,branchCount" > "$csv_output"
}

# Function to process a single file
process_file() {
    local file="$1"
    local csv_output="$2"

    if [ "$VERBOSE" = true ]; then
        print_info "Processing: $file"
    fi

    # Line counts (skip on failure)
    local line_counts
    if ! line_counts=$(calculate_line_counts "$file"); then
        print_info "Skipping $file due to line count failure."
        return 0
    fi
    local lOBlank lOComment lOCode
    lOBlank=$(echo "$line_counts"   | cut -d',' -f1 | tr -d '\n\r' | xargs || echo "0")
    lOComment=$(echo "$line_counts" | cut -d',' -f2 | tr -d '\n\r' | xargs || echo "0")
    lOCode=$(echo "$line_counts"    | cut -d',' -f3 | tr -d '\n\r' | xargs || echo "0")

    lOBlank=$(sanitize_number "$lOBlank" "0")
    lOComment=$(sanitize_number "$lOComment" "0")
    lOCode=$(sanitize_number "$lOCode" "0")

    if [[ ! "$lOCode" =~ ^[0-9]+$ ]] || [[ ! "$lOComment" =~ ^[0-9]+$ ]]; then
        print_info "Skipping $file due to invalid line counts."
        return 0
    fi
    local lOCodeAndComment=$((lOCode + lOComment))
    lOCodeAndComment=$(sanitize_number "$lOCodeAndComment" "0")

    # Cyclomatic complexity
    local cyclomatic_complexity
    cyclomatic_complexity=$(calculate_mccabe_complexity "$file")
    cyclomatic_complexity=$(sanitize_number "$cyclomatic_complexity" "1")

    # Halstead metrics (skip on failure)
    local halstead_output
    if ! halstead_output=$(calculate_halstead_metrics "$file"); then
        print_info "Skipping $file due to Halstead metrics failure."
        return 0
    fi

    local n v l d i e b t uniq_Op uniq_Opnd total_Op total_Opnd
    n=$(echo "$halstead_output" | grep "^n:"         | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")
    v=$(echo "$halstead_output" | grep "^v:"         | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")
    l=$(echo "$halstead_output" | grep "^l:"         | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")
    d=$(echo "$halstead_output" | grep "^d:"         | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")
    i=$(echo "$halstead_output" | grep "^i:"         | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")
    e=$(echo "$halstead_output" | grep "^e:"         | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")
    b=$(echo "$halstead_output" | grep "^b:"         | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")
    t=$(echo "$halstead_output" | grep "^t:"         | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")
    uniq_Op=$(echo "$halstead_output" | grep "^uniq_Op:"   | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")
    uniq_Opnd=$(echo "$halstead_output" | grep "^uniq_Opnd:" | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")
    total_Op=$(echo "$halstead_output" | grep "^total_Op:"  | cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")
    total_Opnd=$(echo "$halstead_output" | grep "^total_Opnd:"| cut -d':' -f2 | tr -d '\n\r' | xargs || echo "")

    # Skip if any Halstead field missing
    if [ -z "$n" ] || [ -z "$v" ] || [ -z "$l" ] || [ -z "$d" ] || [ -z "$i" ] || [ -z "$e" ] || [ -z "$b" ] || [ -z "$t" ] || [ -z "$uniq_Op" ] || [ -z "$uniq_Opnd" ] || [ -z "$total_Op" ] || [ -z "$total_Opnd" ]; then
        print_info "Skipping $file due to incomplete Halstead metrics."
        return 0
    fi

    # Extended McCabe
    local extended_mccabe
    extended_mccabe=$(calculate_extended_mccabe "$file" "$cyclomatic_complexity")
    local essential_complexity=$(echo "$extended_mccabe" | cut -d',' -f1)
    local design_complexity=$(echo "$extended_mccabe" | cut -d',' -f2)
    essential_complexity=$(sanitize_number "$essential_complexity" "1")
    design_complexity=$(sanitize_number "$design_complexity" "1")

    # Branch count
    local branchCount
    branchCount=$(count_branches "$file")
    branchCount=$(sanitize_number "$branchCount" "0")

    # Note: lOCode equals loc
    local loc="$lOCode"

    # CSV row (quote file to be safe)
    printf '"%s",%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n' \
        "$file" \
        "$loc" "$cyclomatic_complexity" "$essential_complexity" "$design_complexity" \
        "$n" "$v" "$l" "$d" "$i" "$e" "$b" "$t" \
        "$lOComment" "$lOBlank" "$lOCodeAndComment" \
        "$uniq_Op" "$uniq_Opnd" "$total_Op" "$total_Opnd" "$branchCount" \
        >> "$csv_output"
}

# Function to generate summary report
generate_summary() {
    local detailed_output="$1"
    local summary_output="$2"
    
    print_info "Generating summary report..."
    
    echo "File,loc,v(g),ev(g),iv(g),n,v,l,d,i,e,b,t,lOComment,lOBlank,LOCodeAndComment,uniq_Op,Uniq_Opnd,total_Op,total_Opnd,branchCount" > "$summary_output"
    
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
    /^----------------------------------------/ {
        if (file) {
            printf "%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
                file, loc, vg, evg, ivg, n, v, l, d, i, e, b, t, lOComment, lOBlank, lOCodeAndComment, uniq_Op, uniq_Opnd, total_Op, total_Opnd, branchCount
        }
        file = loc = vg = evg = ivg = n = v = l = d = i = e = b = t = lOComment = lOBlank = lOCodeAndComment = uniq_Op = uniq_Opnd = total_Op = total_Opnd = branchCount = ""
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
    echo "Usage: $0 [OPTIONS] <file1> [file2] ..."
    echo ""
    echo "Options:"
    echo "  -v, --verbose     Enable verbose output"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 src/main.cpp src/utils.h"
}

# Main function
main() {
    local files=()
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose) VERBOSE=true; shift ;;
            -h|--help) show_usage; exit 0 ;;
            -*) print_error "Unknown option: $1"; show_usage; exit 1 ;;
            *) files+=("$1"); shift ;;
        esac
    done
    
    if [ ${#files[@]} -eq 0 ]; then
        print_error "At least one file path is required."
        show_usage
        exit 1
    fi
    
    trap cleanup EXIT
    
    print_info "Starting C/C++ Code Metrics Calculator"
    
    install_dependencies
    setup_work_dir
    
    local cpp_files_list="$TEMP_DIR/cpp_files.txt"
    printf "%s\n" "${files[@]}" > "$cpp_files_list"

    if [ ! -s "$cpp_files_list" ]; then
        print_warning "No C/C++ files found to process."
        exit 0
    fi

    local csv_output="$OUTPUT_DIR/summary_metrics.csv"
    write_csv_header "$csv_output"

    print_info "Processing files and calculating metrics..."
    local total_files=$(wc -l < "$cpp_files_list" | tr -d '\n\r' | xargs)
    local current_file=0

    while IFS= read -r file; do
        current_file=$((current_file + 1))
        if [ "$VERBOSE" = false ]; then
            echo -ne "\rProgress: $current_file/$total_files files processed"
        fi
        process_file "$file" "$csv_output"
    done < "$cpp_files_list"

    if [ "$VERBOSE" = false ]; then
        echo ""
    fi

    print_success "Metrics calculation completed!"
    print_info "CSV output: $csv_output"
}

main "$@"
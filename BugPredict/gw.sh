#!/bin/bash

set -e

# Parse command line arguments
REPO_URL="$1"
LIMIT="${2:-10}"
BRANCH="$3"

if [ -z "$REPO_URL" ]; then
  echo "Usage: $0 <repository_url> [limit] [branch]"
  echo "Example: $0 https://github.com/user/repo.git 15 main"
  exit 1
fi

WORKDIR="bugspots-work-$(date +%s)"
OUTPUT_DIR="bugspots-results"

# Log current date and time for debugging
echo "🚀 Bugspots Comment Analyzer starting at $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "Repository: $REPO_URL"
echo "File limit: $LIMIT"
[ -n "$BRANCH" ] && echo "Branch: $BRANCH"

# Check if bugspots gem is installed
if ! gem list bugspots -i > /dev/null 2>&1; then
  echo "Installing bugspots gem..."
  gem install bugspots
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "🔄 Cloning $REPO_URL ..."
repo_name=$(basename "$REPO_URL" .git)

# Initialize selected_branch
selected_branch=""

# If branch is specified, try cloning it first
if [ -n "$BRANCH" ]; then
  echo "Trying to clone specified branch: $BRANCH"
  if git clone --branch "$BRANCH" --depth 1000 "$REPO_URL" "$WORKDIR/$repo_name" 2>/dev/null; then
    selected_branch="$BRANCH"
    echo "✅ Successfully cloned branch: $BRANCH"
  else
    echo "Error: Failed to clone specified branch: $BRANCH" >&2
    echo "Clone failed for $repo_name branch $BRANCH at $(date '+%Y-%m-%d %H:%M:%S %Z')" > "$OUTPUT_DIR/bugspots-${repo_name}.err"
    exit 1
  fi
else
  # Try default branches in order of preference (master first to match bugspots default)
  branches=("master" "main")
  clone_success=false

  for branch in "${branches[@]}"; do
    echo "Trying to clone branch: $branch"
    if git clone --branch "$branch" --depth 1000 "$REPO_URL" "$WORKDIR/$repo_name" 2>/dev/null; then
      clone_success=true
      selected_branch="$branch"
      echo "✅ Successfully cloned branch: $branch"
      break
    fi
  done

  # If named branches fail, try default clone
  if [ "$clone_success" = false ]; then
    echo "Named branches failed, trying default clone..."
    if git clone --depth 1000 "$REPO_URL" "$WORKDIR/$repo_name"; then
      clone_success=true
      selected_branch=$(git -C "$WORKDIR/$repo_name" rev-parse --abbrev-ref HEAD)
      echo "✅ Successfully cloned with default branch: $selected_branch"
    fi
  fi

  if [ "$clone_success" = false ]; then
    echo "Error: Failed to clone $REPO_URL" >&2
    echo "Clone failed for $repo_name at $(date '+%Y-%m-%d %H:%M:%S %Z')" > "$OUTPUT_DIR/bugspots-${repo_name}.err"
    exit 1
  fi
fi

# Verify repository
if [ ! -d "$WORKDIR/$repo_name/.git" ]; then
  echo "❌ Error: $repo_name is not a valid Git repository" >&2
  echo "Invalid Git repository: $repo_name at $(date '+%Y-%m-%d %H:%M:%S %Z')" > "$OUTPUT_DIR/bugspots-${repo_name}.err"
  exit 1
fi

echo "📊 Running Bugspots analysis for $repo_name ..."
cd "$WORKDIR/$repo_name"

# Check if repository has any commits
if ! git log --oneline -1 > /dev/null 2>&1; then
  echo "❌ Error: Repository has no commits" >&2
  echo "No commits found in repository at $(date '+%Y-%m-%d %H:%M:%S %Z')" > "../../$OUTPUT_DIR/bugspots-${repo_name}.err"
  cd - > /dev/null
  rm -rf "$WORKDIR"
  exit 1
fi

# Count total commits for context
total_commits=$(git rev-list --count HEAD 2>/dev/null || echo "unknown")
echo "📈 Repository has $total_commits commits in current branch"

# Run bugspots with simplified word pattern
echo "📊 Running Bugspots for $repo_name on branch $selected_branch..."

# Build the bugspots command
bugspots_cmd="bugspots ."

# Add branch parameter if specified or detected
if [ -n "$selected_branch" ]; then
  bugspots_cmd="$bugspots_cmd --branch $selected_branch"
fi

# Add regex pattern for bug-fix commits
bugspots_cmd="$bugspots_cmd --regex 'fix(es|ed)?|close(s|d)?'"

echo "Executing: $bugspots_cmd" >&2

# Execute bugspots command
if ! eval "$bugspots_cmd" > "../../$OUTPUT_DIR/bugspots-${repo_name}.log" 2> "../../$OUTPUT_DIR/bugspots-${repo_name}.err"; then
  echo "❌ Error: Bugspots failed for $repo_name. Check $OUTPUT_DIR/bugspots-${repo_name}.err" >&2
  if [ -s "../../$OUTPUT_DIR/bugspots-${repo_name}.err" ]; then
    echo "Error details:"
    cat "../../$OUTPUT_DIR/bugspots-${repo_name}.err" >&2
  fi
  cd - > /dev/null
  rm -rf "$WORKDIR"
  exit 1
else
  echo "✅ Bugspots analysis successful for $repo_name"
  echo "Results saved to $OUTPUT_DIR/bugspots-${repo_name}.log"
  
  # Check if we have results and if hotspots section exists
  if [ -s "../../$OUTPUT_DIR/bugspots-${repo_name}.log" ]; then
    if grep -q "Hotspots:" "../../$OUTPUT_DIR/bugspots-${repo_name}.log"; then
      # Extract and count hotspots
      hotspot_lines=$(sed -n '/Hotspots:/,$p' "../../$OUTPUT_DIR/bugspots-${repo_name}.log" | tail -n +2 | grep -E '^\s*[0-9]+\.[0-9]+.*' 2>/dev/null | wc -l)
      echo "📋 Found $hotspot_lines hotspot files"
      
      # Show summary if available - look for bug fix commits count
      if grep -qE "Found \d+ bugfix commits|Found \d+ fix commits" "../../$OUTPUT_DIR/bugspots-${repo_name}.log"; then
        bugfix_info=$(grep -oE "Found \d+ (bugfix|fix) commits" "../../$OUTPUT_DIR/bugspots-${repo_name}.log" | head -1)
        echo "🐛 $bugfix_info"
      fi
      
      # Extract top N hotspots after "Hotspots:" line
      echo ""
      echo "🎯 Top $LIMIT hotspots found:"
      echo "================================"
      sed -n '/Hotspots:/,$p' "../../$OUTPUT_DIR/bugspots-${repo_name}.log" | \
      tail -n +2 | \
      grep -E '^\s*[0-9]+\.[0-9]+.*' 2>/dev/null | \
      head -n "$LIMIT" | \
      sed 's/^\s*//' | \
      while IFS= read -r line; do
        echo "  $line"
      done
      echo "================================"
      
      # Create a clean output file with only the top N hotspots for the GitHub Actions
      sed -n '/Hotspots:/,$p' "../../$OUTPUT_DIR/bugspots-${repo_name}.log" | \
      tail -n +2 | \
      grep -E '^\s*[0-9]+\.[0-9]+.*' 2>/dev/null | \
      head -n "$LIMIT" | \
      sed 's/^\s*//' > "../../$OUTPUT_DIR/bugspots-${repo_name}-top.log"
      
    else
      echo "⚠️  Analysis completed but no hotspots section found" >&2
      echo "No hotspots section found in output at $(date '+%Y-%m-%d %H:%M:%S %Z')" > "../../$OUTPUT_DIR/bugspots-${repo_name}.err"
    fi
  else
    echo "⚠️  No files found matching bug fix patterns" >&2
    echo "No bug patterns found in commit messages at $(date '+%Y-%m-%d %H:%M:%S %Z')" > "../../$OUTPUT_DIR/bugspots-${repo_name}.err"
  fi
fi

cd - > /dev/null

# Clean up temporary directories
rm -rf "$WORKDIR"

echo "🏁 Bugspots Comment Analyzer completed at $(date '+%Y-%m-%d %H:%M:%S %Z')"

#!/bin/bash

set -e

# Parse command line arguments
REPO_URL="$1"
LIMIT="${2:-10}"

if [ -z "$REPO_URL" ]; then
  echo "Usage: $0 <repository_url> [limit]"
  echo "Example: $0 https://github.com/user/repo.git 15"
  exit 1
fi

WORKDIR="bugspots-work-$(date +%s)"
OUTPUT_DIR="bugspots-results"

# Log current date and time for debugging
echo "🚀 Bugspots Comment Analyzer starting at $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "Repository: $REPO_URL"
echo "File limit: $LIMIT"

# Check if bugspots is installed
if ! gem list bugspots -i > /dev/null; then
  echo "Installing bugspots gem..."
  gem install bugspots
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "🔄 Cloning $REPO_URL ..."
repo_name=$(basename "$REPO_URL" .git)

# Try different branch names in order of preference
branches=("main" "master" "develop" "dev")
clone_success=false

for branch in "${branches[@]}"; do
  echo "Trying to clone branch: $branch"
  if git clone --branch "$branch" --depth 1000 "$REPO_URL" "$WORKDIR/$repo_name" 2>/dev/null; then
    clone_success=true
    echo "✅ Successfully cloned branch: $branch"
    break
  fi
done

# If named branches fail, try default clone
if [ "$clone_success" = false ]; then
  echo "Named branches failed, trying default clone..."
  if git clone --depth 1000 "$REPO_URL" "$WORKDIR/$repo_name"; then
    clone_success=true
    echo "✅ Successfully cloned with default branch"
  fi
fi

if [ "$clone_success" = false ]; then
  echo "❌ Error: Failed to clone $REPO_URL" >&2
  echo "Clone failed for $repo_name at $(date '+%Y-%m-%d %H:%M:%S %Z')" > "$OUTPUT_DIR/bugspots-${repo_name}.err"
  exit 1
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
echo "📊 Running Bugspots for $repo_name ..."
echo "Executing: git bugspots -w fix" >&2
if ! git bugspots -w fix > "../../$OUTPUT_DIR/bugspots-${repo_name}.log" 2> "../../$OUTPUT_DIR/bugspots-${repo_name}.err"; then
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
      hotspot_lines=$(sed -n '/Hotspots:/,$p' "../../$OUTPUT_DIR/bugspots-${repo_name}.log" | tail -n +2 | grep -E '^\s*[0-9]+\.[0-9]+.*' | wc -l)
      echo "📋 Found $hotspot_lines hotspot files"
      
      # Extract top N hotspots after "Hotspots:" line
      echo ""
      echo "🎯 Top $LIMIT hotspots found:"
      echo "================================"
      sed -n '/Hotspots:/,$p' "../../$OUTPUT_DIR/bugspots-${repo_name}.log" | \
      tail -n +2 | \
      grep -E '^\s*[0-9]+\.[0-9]+.*' | \
      head -n "$LIMIT" | \
      sed 's/^\s*//'
      echo "================================"
      
      # Create a clean output file with only the top N hotspots for the GitHub Actions
      sed -n '/Hotspots:/,$p' "../../$OUTPUT_DIR/bugspots-${repo_name}.log" | \
      tail -n +2 | \
      grep -E '^\s*[0-9]+\.[0-9]+.*' | \
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
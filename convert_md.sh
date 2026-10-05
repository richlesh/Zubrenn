#!/bin/bash
# Convert the Nexus Markdown pages into GitHub-legal Markdown (via
# cvt_2_github_md.py) and write the results to the repository root.
#
# Run from the repository root: ./convert_md.sh
set -euo pipefail

# Resolve paths relative to this script so it works from any directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONVERTER="$SCRIPT_DIR/cvt_2_github_md.py"
SRC_DIR="$SCRIPT_DIR/src/resources/nexus"

pages=(how_to_play resources terrain terrain_bonus buildings transportation federation aliens)

for x in "${pages[@]}"; do
	in="$SRC_DIR/$x.md"
	out="$SCRIPT_DIR/$x.md"
	if [[ ! -f "$in" ]]; then
		echo "skip: $in not found" >&2
		continue
	fi
	echo "converting $x.md"
	python3 "$CONVERTER" "$in" "$out"
done

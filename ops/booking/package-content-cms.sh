#!/usr/bin/env bash
# Assemble the static editor with a locally served, pinned Decap release.
set -euo pipefail
destination=${1:?Usage: package-content-cms.sh OUTPUT_DIRECTORY}
mkdir -p -- "$destination"
destination=$(realpath "$destination")
cd -- "$(dirname -- "$0")"

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
archive=$(npm pack --silent --pack-destination "$work" decap-cms@3.17.3)
tar -xOf "$work/$archive" package/dist/decap-cms.js > "$work/decap-cms.js"
test -s "$work/decap-cms.js"
install -m 0644 content-cms/{index.html,config.yml} "$work/decap-cms.js" "$destination/"

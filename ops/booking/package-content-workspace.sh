#!/usr/bin/env bash
# Prepare a reviewable upgrade bundle; never change the running service here.
set -euo pipefail
output=${1:?Usage: package-content-workspace.sh OUTPUT_TAR_GZ}
output=$(realpath -m -- "$output")
cd -- "$(dirname -- "$0")/../.."
node --check ops/booking/content-cms/articles.mjs
node --check ops/booking/content-cms/workspace/workspace.js
npm run test:content-workspace
npm run test:mentor-network
node --experimental-vm-modules --test ops/booking/package-service.test.mjs
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/static/admin/content/nostr/workspace" "$work/service/ops/booking/content-cms" "$work/service/astro/src/lib" "$work/service/ops/mentors"
install -m 0644 ops/booking/content-cms/workspace/{index.html,workspace.js,workspace.css,view-model.mjs} "$work/static/admin/content/nostr/workspace/"
node --experimental-vm-modules ops/booking/package-service.mjs "$work/service"
install -m 0644 ops/booking/package-service.mjs "$work/service/ops/booking/"
install -m 0644 package.json package-lock.json "$work/service/"
git rev-parse HEAD > "$work/revision.txt"
(cd "$work" && find static service -type f -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
tar -C "$work" -czf "$output" -- static service revision.txt SHA256SUMS
printf 'Prepared content workspace bundle: %s\nNo running service or credential was changed.\n' "$output"

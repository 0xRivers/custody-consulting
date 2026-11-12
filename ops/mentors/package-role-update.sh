#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/../.."
output=$(realpath -m -- "${1:?Usage: package-role-update.sh OUTPUT}")
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
bash ops/booking/package-content-workspace.sh "$work/backend.tar.gz"
bash ops/mentors/package-network-ui.sh "$work/frontend.tar.gz"
mkdir "$work/backend" "$work/frontend"
tar -xzf "$work/backend.tar.gz" -C "$work/backend"
tar -xzf "$work/frontend.tar.gz" -C "$work/frontend"
cp ops/mentors/install-role-update.sh "$work/install.sh"
(cd "$work" && find backend frontend install.sh -type f -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
tar -C "$work" -czf "$output" backend frontend install.sh SHA256SUMS
sha256sum "$output"

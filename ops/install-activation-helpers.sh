#!/usr/bin/env bash
# Update the root-owned activation commands without activating a release.
set -euo pipefail
cd -- "$(dirname -- "$0")"

for helper in activate-release activate-staging-release; do
  bash -n "$helper"
done
tar -czf - activate-release activate-staging-release |
  ssh -o StrictHostKeyChecking=yes root@85.122.114.151 '
    set -eu
    test "$(id -u)" -eq 0
    directory=/usr/local/bin
    work=$(mktemp -d "$directory/.custody-activation.XXXXXX")
    trap '"'"'rm -rf -- "$work"'"'"' EXIT
    tar -xzf - -C "$work"
    stamp=$(date -u +%Y%m%dT%H%M%SZ).$$
    prepare() {
      source=$1
      name=$2
      destination=$directory/$name
      if [ ! -f "$destination" ] || [ -L "$destination" ]; then
        echo "Expected an installed regular file at $destination." >&2
        exit 1
      fi
      bash -n "$work/$source"
      install -m 0755 -o root -g root "$work/$source" "$work/$name"
      cp -a -- "$destination" "$destination.backup.$stamp"
    }
    prepare activate-release custody-activate-release
    prepare activate-staging-release custody-staging-activate-release
    for name in custody-activate-release custody-staging-activate-release; do
      mv -f -- "$work/$name" "$directory/$name"
      printf "Installed %s (backup: %s)\n" "$directory/$name" "$directory/$name.backup.$stamp"
    done
    for base in /srv/custody-consulting /srv/custody-consulting-staging; do
      printf "Current release: %s\n" "$(readlink -f "$base/current")"
    done
  '

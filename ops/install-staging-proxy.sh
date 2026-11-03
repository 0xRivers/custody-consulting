#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root' >&2; exit 1; }
config=/etc/caddy/Caddyfile.minimal
here=$(cd -- "$(dirname -- "$0")" && pwd)
if grep -Fq 'staging.custody.consulting' "$config"; then
  echo 'Staging domain already appears in the public configuration; inspect it before retrying.' >&2
  exit 1
fi
candidate=$(mktemp /etc/caddy/custody-staging.XXXXXX)
trap 'rm -f "$candidate"' EXIT
cat "$config" > "$candidate"
printf '\n' >> "$candidate"
cat "$here/staging-public.Caddyfile" >> "$candidate"
/usr/local/bin/caddy validate --config "$candidate" --adapter caddyfile
backup="$config.before-staging.$(date +%Y%m%d%H%M%S)"
cp -a "$config" "$backup"
# Preserve the original file permissions and ownership.
cat "$candidate" > "$config"
if ! systemctl reload caddy; then
  cp -a "$backup" "$config"
  systemctl reload caddy || true
  echo "Reload failed; restored $backup" >&2
  exit 1
fi
printf 'Staging route added. Backup: %s\n' "$backup"

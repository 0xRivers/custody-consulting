#!/usr/bin/env bash
# Install only the static staging backend configuration.
set -euo pipefail
cd -- "$(dirname -- "$0")"
ssh -o StrictHostKeyChecking=yes "${STAGING_ADMIN_SSH_TARGET:-root@85.122.114.151}" '
  set -eu
  config=/etc/custody-consulting-staging/Caddyfile
  service=custody-staging-web.service
  caddy=/usr/local/bin/caddy
  root=/srv/custody-consulting-staging/current
  test "$(id -u)" -eq 0
  test -f "$config"
  test ! -L "$config"
  test -s "$root/en/index.html"
  test -s "$root/pl/index.html"
  systemctl show "$service" -p ExecStart --value | grep -Fq -- "--config $config "
  candidate=$(mktemp "${config}.candidate.XXXXXX")
  backup=$(mktemp "${config}.backup.XXXXXX")
  trap '\''rm -f -- "$candidate"'\'' EXIT
  cat > "$candidate"
  chmod 0644 "$candidate"
  "$caddy" validate --config "$candidate" --adapter caddyfile
  cp -p -- "$config" "$backup"
  mv -f -- "$candidate" "$config"
  verify() {
    for locale in en pl; do
      result=$(curl -sS --max-time 10 -o /dev/null -w "%{http_code} %{redirect_url}" \
        "https://staging.custody.consulting/?lang=$locale") || return 1
      test "$result" = "301 https://staging.custody.consulting/$locale/" || return 1
    done
  }
  if ! systemctl restart "$service" || ! verify; then
    cp -p -- "$backup" "$config"
    systemctl restart "$service"
    echo "Staging redirect verification failed. Restored $backup." >&2
    exit 1
  fi
  printf "Staging language redirects verified. Backup: %s\n" "$backup"
' < staging.Caddyfile

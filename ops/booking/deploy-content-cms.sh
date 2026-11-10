#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/../.."

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
bash ops/booking/package-content-cms.sh "$work/content"
cp ops/booking/content-cms/{oauth.mjs,custody-content-oauth.service} "$work/"

tar -C "$work" -czf - content oauth.mjs custody-content-oauth.service |
  ssh -o StrictHostKeyChecking=yes root@85.122.114.151 '
    set -euo pipefail
    test "$(id -u)" -eq 0
    credentials=/etc/custody-content-oauth.env
    config=/etc/caddy/Caddyfile.minimal
    service=custody-content-oauth.service
    target=/srv/custody-booking-production-staff/admin/content
    test -s "$credentials" && test "$(stat -c "%u:%a" "$credentials")" = 0:600 ||
      { echo "Install the root-owned OAuth credentials file with mode 600 first." >&2; exit 1; }
    systemctl show caddy -p ExecStart --value | grep -Fq -- "--config $config "
    test -f "$config" && test ! -L "$config"
    test ! -e "$target" && test ! -e /opt/custody-content-oauth &&
      test ! -e "/etc/systemd/system/$service" ||
      { echo "Content editor files already exist. Review the installed version before replacing it." >&2; exit 1; }

    work=$(mktemp -d)
    candidate=$(mktemp /etc/caddy/.custody-content.XXXXXX)
    trap '\''rm -rf -- "$work"; rm -f -- "$candidate"'\'' EXIT
    tar -xzf - -C "$work"
    /opt/custody-node24/bin/node --check "$work/oauth.mjs"
    cp -p -- "$config" "$candidate"
    python3 - "$candidate" <<'\''PY'\''
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()
sites = list(re.finditer(r"^custody\.consulting[ \t]*\{[ \t]*$", text, re.M))
if len(sites) != 1 or "@custody_content_oauth" in text:
    raise SystemExit("Expected one production site and no existing content OAuth handler.")
route = """    @custody_content_oauth path /admin/content/auth /admin/content/callback
    handle @custody_content_oauth {
        header X-Robots-Tag "noindex, nofollow, noarchive"
        reverse_proxy 127.0.0.1:8015
    }
"""
start = sites[0].end()
path.write_text(text[:start] + "\n" + route + text[start:])
PY
    /usr/local/bin/caddy validate --config "$candidate" --adapter caddyfile
    backup="$config.backup.content.$(date -u +%Y%m%dT%H%M%SZ).$$"
    cp -a -- "$config" "$backup"
    rollback() {
      trap - ERR
      set +e
      cp -a -- "$backup" "$config"
      systemctl reload caddy
      systemctl disable --now "$service"
      rm -f -- "/etc/systemd/system/$service" /opt/custody-content-oauth/oauth.mjs
      rmdir /opt/custody-content-oauth
      rm -f -- "$target/index.html" "$target/config.yml" "$target/decap-cms.js"
      rmdir "$target"
      systemctl daemon-reload
      echo "Content editor deployment failed. Previous Caddy configuration restored." >&2
      exit 1
    }
    trap rollback ERR
    install -d -m 0755 /opt/custody-content-oauth "$target"
    install -m 0644 "$work/oauth.mjs" /opt/custody-content-oauth/
    install -m 0644 "$work/$service" /etc/systemd/system/
    install -m 0644 "$work/content/"{index.html,config.yml,decap-cms.js} "$target/"
    systemctl daemon-reload
    systemctl enable --now "$service"
    mv -f -- "$candidate" "$config"
    systemctl reload caddy
    origin=https://custody.consulting
    curl -fsS --retry 2 --retry-connrefused --max-time 10 "$origin/admin/content/" > "$work/served.html"
    cmp -s "$work/served.html" "$work/content/index.html"
    curl -fsS --max-time 10 -o /dev/null "$origin/admin/content/decap-cms.js"
    curl -fsS --max-time 10 -o /dev/null "$origin/admin/content/config.yml"
    redirect=$(curl -sS --max-time 10 -o /dev/null -w "%{http_code} %{redirect_url}" "$origin/admin/content/auth")
    [[ $redirect == "302 https://github.com/login/oauth/authorize?"* ]]
    trap - ERR
    printf "Content editor and GitHub redirect verified. Caddy backup: %s\n" "$backup"
  '

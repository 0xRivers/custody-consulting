#!/usr/bin/env bash
set -euo pipefail

if [[ ${1:-} != --on-vps && ${1:-} != --on-vps-admin ]]; then
  mode=--on-vps
  pages=(admin payment)
  case "${1:-}" in
    '') ;;
    --admin-only) mode=--on-vps-admin; pages=(admin) ;;
    *) echo 'Usage: deploy-production-staff-pages.sh [--admin-only]' >&2; exit 1 ;;
  esac
  cd -- "$(dirname -- "$0")/../.."
  work=$(mktemp -d)
  trap 'rm -rf -- "$work"' EXIT
  ASTRO_TELEMETRY_DISABLED=1 BOOKING_PAGES_ENABLED=true npm run build:astro:production
  for page in "${pages[@]}"; do cp -a "build/astro-production/$page" "$work/"; done
  cp -a build/astro-production/_astro "$work/_booking-staff-assets"
  find "$work" -name '*.html' -exec sed -i 's|/_astro/|/_booking-staff-assets/|g' {} +
  cp ops/booking/deploy-production-staff-pages.sh "$work/install.sh"
  tar -C "$work" -czf - "${pages[@]}" _booking-staff-assets install.sh |
    ssh -F /dev/null -o StrictHostKeyChecking=yes -o ConnectTimeout=10 root@85.122.114.151 "mode=$mode;"'
      set -eu
      work=$(mktemp -d)
      trap '\''rm -rf -- "$work"'\'' EXIT
      tar -xzf - -C "$work"
      bash "$work/install.sh" "$mode" "$work"
    '
  exit
fi

work=$2
config=/etc/caddy/Caddyfile.minimal
caddy=/usr/local/bin/caddy
target=/srv/custody-booking-production-staff
[[ $EUID == 0 ]]
systemctl is-active --quiet custody-booking-production
systemctl show caddy -p ExecStart --value | grep -Fq -- "--config $config "
if [[ $1 == --on-vps-admin ]]; then
  page=$target/admin/index.html
  code=/opt/custody-booking-production/ops/booking
  test -s "$page"
  test -s "$work/admin/index.html"
  if ! grep -Fq 'admin-sales' "$code/production-service.mjs" &&
     ! { grep -Fq './staging-service.mjs' "$code/production-service.mjs" &&
         grep -Fq 'admin-sales' "$code/staging-service.mjs"; }; then
    echo 'Production booking service does not support Admin Sales. Admin page was not changed.' >&2
    exit 1
  fi
  origin=https://custody.consulting
  # Check that the action is recognized and protected before publishing its UI.
  status=$(curl -sS --max-time 10 -o "$work/admin-api.json" -w '%{http_code}' \
    -H "Origin: $origin" -H 'Content-Type: application/json' \
    --data '{"action":"admin-sales","locale":"en"}' "$origin/booking-api/checkout")
  if [[ $status != 403 ]] || ! grep -Fq '"error":"ADMIN_NOT_ALLOWED"' "$work/admin-api.json"; then
    echo 'Production Sales authorization preflight failed. Admin page was not changed.' >&2
    exit 1
  fi
  backup=$(mktemp /srv/.custody-admin-backup.XXXXXX)
  cp -- "$page" "$backup"
  next=$(mktemp "$page.next.XXXXXX")
  trap 'rm -f -- "$next"' EXIT
  cp -a "$work/_booking-staff-assets/." "$target/_booking-staff-assets/"
  install -m 0644 "$work/admin/index.html" "$next"
  mv -f -- "$next" "$page"
  if ! curl -fsS --max-time 10 "$origin/admin/" > "$work/served.html" ||
     ! cmp -s "$work/admin/index.html" "$work/served.html"; then
    install -m 0644 "$backup" "$next"
    mv -f -- "$next" "$page"
    echo 'Live admin verification failed. The previous page was restored.' >&2
    exit 1
  fi
  printf 'Production admin verified. Backup: %s\n' "$backup"
  exit
fi
for page in admin/index.html payment/index.html payment/result/index.html; do
  test -s "$work/$page"
done

candidate=$(mktemp /etc/caddy/.production-staff.XXXXXX)
trap 'rm -f -- "$candidate"' EXIT
backup="${config}.backup.$(date -u +%Y%m%dT%H%M%SZ).$$"
cp -a -- "$config" "$backup"
cp -a -- "$backup" "$candidate"
python3 - "$candidate" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()
headers = list(re.finditer(r'^custody\.consulting[ \t]*\{[ \t]*$', text, re.M))
if len(headers) != 1:
    raise SystemExit('Expected exactly one production site block.')
routes = """    @production_booking_staff path /admin /admin/* /payment /payment/* /_booking-staff-assets/* /booking-api/checkout
    handle @production_booking_staff {
        header Cache-Control "private, no-store"
        header X-Robots-Tag "noindex, nofollow, noarchive"
        @production_staff_checkout path /booking-api/checkout
        reverse_proxy @production_staff_checkout 127.0.0.1:8013
        root * /srv/custody-booking-production-staff
        file_server
    }
"""
offset = headers[0].end()
if '@production_booking_staff' in text:
    if text.count('@production_booking_staff') != 2:
        raise SystemExit('Expected exactly one production booking matcher and handler.')
    remaining = text[offset:]
    if remaining.startswith('\n' + routes):
        sys.exit(0)
    # Match only the exact previous installer block, with its generated bcrypt hash.
    legacy = routes.replace(
        '    handle @production_booking_staff {\n',
        '    handle @production_booking_staff {\n        basic_auth {\n            staff BCRYPT_HASH\n        }\n',
    ).replace(
        '        reverse_proxy @production_staff_checkout 127.0.0.1:8013\n',
        '        reverse_proxy @production_staff_checkout 127.0.0.1:8013 {\n            header_up -Authorization\n        }\n',
    )
    pattern = re.escape('\n' + legacy).replace('BCRYPT_HASH', r'\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}')
    match = re.match(pattern, remaining)
    if not match:
        raise SystemExit('Existing production booking routes differ from the expected configuration.')
    path.write_text(text[:offset] + '\n' + routes + remaining[match.end():])
else:
    path.write_text(text[:offset] + '\n' + routes + text[offset:])
PY

"$caddy" validate --config "$candidate" --adapter caddyfile
cmp -s -- "$config" "$backup"
install -d -m 0755 "$target"
cp -a "$work"/{admin,payment,_booking-staff-assets} "$target/"
mv -f -- "$candidate" "$config"
rollback() {
  cp -a -- "$backup" "$config"
  systemctl reload caddy
  echo "Production booking route check failed. Restored $backup." >&2
  exit 1
}
systemctl reload caddy || rollback
origin=https://custody.consulting
for page in admin payment payment/result; do
  curl -fsS --max-time 10 "$origin/$page/" > "$work/served.html" || rollback
  cmp -s "$work/$page/index.html" "$work/served.html" || rollback
done
for action in admin-invite admin-reviews admin-resolve-preview admin-resolve-confirm availability; do
  status=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' \
    -H "Origin: $origin" -H 'Content-Type: application/json' \
    --data "{\"action\":\"$action\",\"locale\":\"en\"}" "$origin/booking-api/checkout") || rollback
  if [[ $status != 403 ]]; then
    echo "Expected HTTP 403 for unsigned $action, received $status." >&2
    rollback
  fi
done
printf 'Verified password-free booking pages and protected admin and invite actions. Backup: %s\n' "$backup"

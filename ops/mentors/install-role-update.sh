#!/usr/bin/env bash
# Staging-only code + private UI update. Never restores an old payment database.
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"
sha256sum --check SHA256SUMS
current=/opt/custody-booking-staging
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/root/custody-two-roles-backup-$stamp"
install -d -m 700 "$backup"
cp -a /etc/caddy/Caddyfile.minimal "$backup/Caddyfile.minimal"
oldPages=$(readlink -f /srv/custody-mentor-staging/current)
python3 - "$backup" <<'PY'
from pathlib import Path
import sqlite3,sys
with sqlite3.connect('file:/var/lib/custody-booking-staging/bookings.sqlite?mode=ro',uri=True) as source:
 with sqlite3.connect(Path(sys.argv[1])/'bookings.sqlite') as target:
  source.backup(target)
  assert target.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
PY
candidate=$(mktemp -d /opt/custody-booking-staging-two-roles.XXXXXX)
cp -a "$current/." "$candidate/"
cp -a backend/service/. "$candidate/"
chmod --reference="$current" "$candidate"
(
 cd "$candidate"
 umask 022
 export PATH=/opt/custody-node24/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
 npm ci --omit=dev --ignore-scripts --no-audit --no-fund
 check=$(mktemp -d /tmp/custody-two-roles-check.XXXXXX)
 chown custody-booking:custody-booking "$check"
 runuser -u custody-booking -- /opt/custody-node24/bin/node --experimental-vm-modules ops/booking/package-service.mjs "$check"
 rm -rf -- "$check"
)
previous="/opt/custody-booking-staging-before-two-roles-$stamp"
moved=false
rollback(){
 trap - ERR
 set +e
 systemctl stop custody-booking-staging.service
 if "$moved";then
  test ! -d "$current" || mv "$current" "${candidate}-failed"
  mv "$previous" "$current"
 fi
 ln -s "$oldPages" "/srv/custody-mentor-staging/.roles-rollback-$stamp"
 mv -Tf "/srv/custody-mentor-staging/.roles-rollback-$stamp" /srv/custody-mentor-staging/current
 cp -a "$backup/Caddyfile.minimal" /etc/caddy/Caddyfile.minimal
 /usr/local/bin/caddy reload --config /etc/caddy/Caddyfile.minimal --adapter caddyfile
 systemctl reset-failed custody-booking-staging.service
 systemctl start custody-booking-staging.service
 echo 'Update failed. Previous staging code/pages restored. Database not rewound.'
 systemctl status custody-booking-staging.service --no-pager --full
 exit 1
}
trap rollback ERR
systemctl stop custody-booking-staging.service
mv "$current" "$previous";moved=true
mv "$candidate" "$current"
systemctl reset-failed custody-booking-staging.service
systemctl start custody-booking-staging.service
sleep 5
systemctl is-active --quiet custody-booking-staging.service
code=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' --data '{}' http://127.0.0.1:8012/booking-api/stripe-webhook)
test "$code" = 400
python3 <<'PYCHECK'
import json,subprocess
from pathlib import Path
from urllib.request import Request,urlopen
pid=subprocess.check_output(['systemctl','show','custody-booking-staging.service','--property=MainPID','--value'],text=True).strip()
env=dict(v.split(b'=',1) for v in Path(f'/proc/{pid}/environ').read_bytes().split(b'\0') if b'=' in v)
npub=env[b'CUSTODY_SUPER_ADMIN_NPUB'].decode()
request=Request('http://127.0.0.1:8012/booking-api/checkout',data=json.dumps({'action':'mentor-network-challenge','npub':npub,'purpose':'session-start'}).encode(),headers={'Content-Type':'application/json','Origin':'https://staging.custody.consulting'})
with urlopen(request,timeout=10) as response:assert response.status==200 and 'event' in json.load(response)
print('Mentor API enabled and signing challenge verified.')
PYCHECK
bash frontend/install.sh
python3 <<'PY'
from urllib.request import Request,urlopen
with urlopen(Request('https://staging.custody.consulting/admin/',headers={'Cache-Control':'no-cache'}),timeout=15) as response:
 html=response.read().decode()
 assert response.status==200 and 'noindex' in response.headers.get('X-Robots-Tag','')
 assert 'name="mentor"' in html and 'name="editor"' in html
 assert 'Local branches' not in html and 'Branch manager' not in html
assert 'id="sales-table"' in html and html.count('<table')==1
assert 'data-section="review"' not in html and 'id="review-panel"' not in html
assert html.count('data-section="invitations"')==1 and 'data-section="mentor-invitations"' not in html
print('Staging verified: one Sales table with integrated payment review; no review navigation item.')
PY
trap - ERR
printf 'Previous backend: %s\nDatabase backup: %s\nProduction unchanged.\n' "$previous" "$backup/bookings.sqlite"

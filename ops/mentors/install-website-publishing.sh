#!/usr/bin/env bash
# Staging-only activation of the website article path after GitHub setup.
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"
sha256sum --check SHA256SUMS
python3 <<'PY'
import sqlite3
with sqlite3.connect('file:/var/lib/custody-booking-staging/bookings.sqlite?mode=ro',uri=True) as db:
 if db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='article_publications'").fetchone():
  active=db.execute("SELECT COUNT(*) FROM article_publications WHERE state IN ('queued','staging_checks','staging_deploy','production_checks','deploy')").fetchone()[0]
  if active:raise SystemExit('Finish the current article operation before switching publishing modes.')
PY
dropin=/etc/systemd/system/custody-booking-staging.service.d/98-website-publishing.conf
backup=$(mktemp -d /root/custody-website-mode.XXXXXX)
previous=false
if [[ -e "$dropin" ]]; then cp -a "$dropin" "$backup/mode.conf";previous=true;fi
rollback_mode(){
 trap - ERR
 set +e
 if "$previous";then cp -a "$backup/mode.conf" "$dropin";else rm -f "$dropin";fi
 systemctl daemon-reload
 systemctl reset-failed custody-booking-staging.service
 systemctl restart custody-booking-staging.service
 echo 'Website publishing activation failed; the previous mode was restored.'
 exit 1
}
trap rollback_mode ERR
install -d -m 755 "$(dirname -- "$dropin")"
cat > "$dropin" <<'CONF'
[Service]
Environment=CONTENT_ARTICLE_AUTOMATION_ENABLED=true
CONF
chmod 644 "$dropin"
systemctl daemon-reload
bash ./install-current.sh
trap - ERR
echo 'Website article publishing enabled on staging. Engineering production approval is retained.'

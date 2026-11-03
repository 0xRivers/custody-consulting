#!/usr/bin/env bash
# Run once as root on a Debian/Ubuntu-style systemd host, after inspection.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root' >&2; exit 1; }
pubfile=${1:?Usage: bootstrap-vps.sh /path/to/deploy-key.pub}
[[ -f $pubfile ]]
ssh-keygen -l -f "$pubfile" >/dev/null
for cmd in caddy systemctl curl flock ss useradd; do command -v "$cmd" >/dev/null || { echo "Missing: $cmd" >&2; exit 1; }; done
[[ -x /usr/local/bin/caddy ]] || { echo 'Adjust the service for the installed Caddy binary first.' >&2; exit 1; }
if ss -H -ltn 'sport = :8004' | read -r _; then
  echo 'Port 8004 is occupied. Select another port in all ops files before proceeding.' >&2
  exit 1
fi
here=$(cd -- "$(dirname -- "$0")" && pwd)
if ! id custody-deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash custody-deploy
fi
home=$(getent passwd custody-deploy | cut -d: -f6)
install -d -o custody-deploy -g custody-deploy -m 700 "$home/.ssh"
touch "$home/.ssh/authorized_keys"
key=$(cat "$pubfile")
if ! grep -Fq -- "$key" "$home/.ssh/authorized_keys"; then
  printf 'restrict %s\n' "$key" >> "$home/.ssh/authorized_keys"
fi
chown custody-deploy:custody-deploy "$home/.ssh/authorized_keys"
chmod 600 "$home/.ssh/authorized_keys"
install -d -o custody-deploy -g custody-deploy -m 755 /srv/custody-consulting /srv/custody-consulting/releases
install -d -m 755 /etc/custody-consulting
install -m 644 "$here/site.Caddyfile" /etc/custody-consulting/Caddyfile
install -m 755 "$here/activate-release" /usr/local/bin/custody-activate-release
install -m 644 "$here/custody-web.service" /etc/systemd/system/custody-web.service
/usr/local/bin/caddy validate --config /etc/custody-consulting/Caddyfile --adapter caddyfile
systemctl daemon-reload
systemctl enable --now custody-web.service
echo 'Backend installed. Deploy the first release, then merge the public Caddy block.'

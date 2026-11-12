#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "$0")"
sha256sum --check SHA256SUMS
base=/srv/custody-mentor-staging
previous=$(readlink -f "$base/current")
test -d "$previous/admin/content/nostr/workspace"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
release="$base/releases/ui-$stamp"
test ! -e "$release"
install -d -m 755 "$release"
cp -a "$previous/." "$release/"
cp -a ui/. "$release/"
chmod -R a+rX "$release"
config=/etc/caddy/Caddyfile.minimal
backup="/root/Caddyfile.before-admin-sidebar-$stamp"
cp -a "$config" "$backup"
python3 <<'PYCODE'
from pathlib import Path
p=Path('/etc/caddy/Caddyfile.minimal')
text=p.read_text();lines=text.splitlines();matches=[i for i,line in enumerate(lines) if line.strip().startswith('@mentor_pages path ')]
assert len(matches)==1,'Expected exactly one private staging matcher'
i=matches[0]
assert text.rfind('staging.custody.consulting {',0,text.find(lines[i]))>=0
parts=lines[i].split()
if '/admin' not in parts:parts[2:2]=['/admin','/admin/']
lines[i]='    '+' '.join(parts)
Path('/etc/caddy/Caddyfile.sidebar-candidate').write_text('\n'.join(lines)+'\n')
PYCODE
/usr/local/bin/caddy validate --config /etc/caddy/Caddyfile.sidebar-candidate --adapter caddyfile
rollback() {
 trap - ERR
 ln -s "$previous" "$base/.rollback-$stamp"
 mv -Tf "$base/.rollback-$stamp" "$base/current"
 cp -a "$backup" "$config"
 /usr/local/bin/caddy reload --config "$config" --adapter caddyfile || true
 echo 'UI verification failed; previous private pages and routes restored.'
 exit 1
}
trap rollback ERR
ln -s "$release" "$base/.current-$stamp"
mv -Tf "$base/.current-$stamp" "$base/current"
install -m 644 /etc/caddy/Caddyfile.sidebar-candidate "$config"
/usr/local/bin/caddy reload --config "$config" --adapter caddyfile
python3 <<'PY'
from urllib.request import urlopen, Request
request=Request('https://staging.custody.consulting/admin/',headers={'Cache-Control':'no-cache'})
with urlopen(request,timeout=15) as response:
 assert response.status==200
 assert 'noindex' in response.headers.get('X-Robots-Tag','')
 html=response.read().decode()
 assert 'data-network-nav' in html and 'network-panel' in html
print('Integrated staging admin sidebar verified: HTTP 200, noindex, mentor sections.')
PY
trap - ERR
printf 'Previous private pages retained: %s\nNo backend restart required.\n' "$previous"

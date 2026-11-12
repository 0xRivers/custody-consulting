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
rollback() {
 trap - ERR
 ln -s "$previous" "$base/.rollback-$stamp"
 mv -Tf "$base/.rollback-$stamp" "$base/current"
 echo 'UI verification failed; previous private pages restored.'
 exit 1
}
trap rollback ERR
ln -s "$release" "$base/.current-$stamp"
mv -Tf "$base/.current-$stamp" "$base/current"
python3 <<'PY'
from urllib.request import urlopen, Request
request=Request('https://staging.custody.consulting/admin/network/',headers={'Cache-Control':'no-cache'})
with urlopen(request,timeout=15) as response:
 assert response.status==200
 assert 'noindex' in response.headers.get('X-Robots-Tag','')
 html=response.read().decode()
 assert 'network-page' in html and 'network-masthead' in html
print('Updated private staging dashboard verified: HTTP 200, noindex, new theme.')
PY
trap - ERR
printf 'Previous private pages retained: %s\nNo backend restart required.\n' "$previous"

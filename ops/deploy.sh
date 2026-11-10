#!/usr/bin/env bash
# Used by CI or locally with a dedicated identity and verified known_hosts.
set -euo pipefail
: "${DEPLOY_KEY:?Set DEPLOY_KEY to the private key file path}"
: "${DEPLOY_KNOWN_HOSTS:?Set DEPLOY_KNOWN_HOSTS to the verified known_hosts file path}"
host=${DEPLOY_HOST:-85.122.114.151}
port=${DEPLOY_PORT:-22}
deploy_user=${DEPLOY_USER:-custody-deploy}
[[ $deploy_user =~ ^[a-z_][a-z0-9_-]*$ ]]
[[ $host =~ ^[a-zA-Z0-9.-]+$ && $port =~ ^[0-9]+$ ]]
sha=$(git rev-parse HEAD)
[[ $sha =~ ^[a-f0-9]{40}$ ]]
# Never deploy a dirty working tree under a clean commit identifier.
[[ -z $(git status --porcelain --untracked-files=normal) ]] || { echo 'Commit all source changes first.' >&2; exit 1; }
build_dir=build/astro-production
for route in index.html en/index.html pl/index.html en/blog/index.html pl/blog/index.html; do
  [[ -s "$build_dir/$route" ]]
done
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp -a "$build_dir"/. "$stage/"
printf '%s\n' "production" > "$stage/astro-release.txt"
[[ -s "$stage/sitemap.xml" && -s "$stage/robots.txt" ]]
printf '%s\n' "$sha" > "$stage/version.txt"
ssh_args=(-F /dev/null -i "$DEPLOY_KEY" -p "$port" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=\"$DEPLOY_KNOWN_HOSTS\"" -o ConnectTimeout=15)
# Keep incomplete uploads out of releases and allow retries of an identical artifact.
remote="release=$sha;"'
  set -euo pipefail
  base=/srv/custody-consulting
  target=$base/releases/$release
  upload=$(mktemp -d "$base/.upload.XXXXXX")
  trap '"'"'rm -rf -- "$upload"'"'"' EXIT
  tar -xzf - -C "$upload"
  exec 9>"$base/.upload.lock"
  flock -w 60 9
  if [[ -e $target ]]; then
    diff -qr "$upload" "$target"
  else
    chmod 0755 "$upload"
    mv -T -- "$upload" "$target"
  fi
  /usr/local/bin/custody-activate-release "$release"
'
tar -C "$stage" -czf - . | ssh "${ssh_args[@]}" "$deploy_user@$host" "$remote"

#!/usr/bin/env bash
# Used by CI or locally with a dedicated identity and verified known_hosts.
set -euo pipefail
: "${DEPLOY_KEY:?Set DEPLOY_KEY to the private key file path}"
: "${DEPLOY_KNOWN_HOSTS:?Set DEPLOY_KNOWN_HOSTS to the verified known_hosts file path}"
host=${DEPLOY_HOST:-85.122.114.151}
port=${DEPLOY_PORT:-22}
[[ $host =~ ^[a-zA-Z0-9.-]+$ && $port =~ ^[0-9]+$ ]]
sha=$(git rev-parse HEAD)
[[ $sha =~ ^[a-f0-9]{40}$ ]]
# Never deploy a dirty working tree under a clean commit identifier.
[[ -z $(git status --porcelain --untracked-files=normal) ]] || { echo 'Commit all source changes first.' >&2; exit 1; }
node --check build/staging/app.js
[[ -s build/staging/index.html ]]
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp -a build/staging/. "$stage/"
printf 'User-agent: *\nDisallow: /\n' > "$stage/robots.txt"
printf '%s\n' "$sha" > "$stage/version.txt"
ssh_args=(-F /dev/null -i "$DEPLOY_KEY" -p "$port" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$DEPLOY_KNOWN_HOSTS" -o ConnectTimeout=15)
# mkdir refuses to replace an existing release; a rollback uses activation only.
tar -C "$stage" -czf - . | ssh "${ssh_args[@]}" "custody-staging@$host" "set -eu; mkdir /srv/custody-consulting-staging/releases/$sha; tar -xzf - -C /srv/custody-consulting-staging/releases/$sha; /usr/local/bin/custody-staging-activate-release $sha"

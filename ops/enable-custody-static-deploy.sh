#!/usr/bin/env bash
# Run once as root on the VPS to authorize the existing custody SSH account.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run this setup as root on the VPS.' >&2; exit 1; }
id custody >/dev/null
for account in custody-deploy custody-staging; do
  id "$account" >/dev/null
done
for base in /srv/custody-consulting /srv/custody-consulting-staging; do
  [[ -d $base && ! -L $base && -d $base/releases && ! -L $base/releases ]]
  for lock in .upload.lock .deploy.lock; do
    [[ ! -L $base/$lock ]]
  done
done
for environment in production staging; do
  account=custody-deploy
  base=/srv/custody-consulting
  if [[ $environment == staging ]]; then
    account=custody-staging
    base=/srv/custody-consulting-staging
  fi
  group=$(id -gn "$account")
  usermod -aG "$group" custody
  # Setgid keeps new upload directories and lock files in the shared deploy group.
  chgrp "$group" "$base" "$base/releases"
  chmod g+rws "$base" "$base/releases"
  for lock in .upload.lock .deploy.lock; do
    touch "$base/$lock"
    chgrp "$group" "$base/$lock"
    chmod g+rw "$base/$lock"
  done
done
echo 'custody can publish staging and production static releases. Reconnect SSH to apply group membership.'

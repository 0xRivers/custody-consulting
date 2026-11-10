#!/usr/bin/env bash
# Enter GitHub OAuth credentials directly in the VPS terminal.
set -euo pipefail
ssh -t -o StrictHostKeyChecking=yes root@85.122.114.151 '
  set -eu
  test "$(id -u)" -eq 0
  file=/etc/custody-content-oauth.env
  if [ -e "$file" ] || [ -L "$file" ]; then
    echo "The OAuth credentials file already exists." >&2
    exit 1
  fi
  read -r -p "GitHub OAuth client ID: " client_id
  read -rs -p "GitHub OAuth client secret: " client_secret
  printf "\n"
  if ! [[ $client_id =~ ^[A-Za-z0-9_.-]+$ && $client_secret =~ ^[A-Za-z0-9_.-]+$ ]]; then
    echo "Invalid or missing credentials." >&2
    exit 1
  fi
  umask 077
  set -C
  printf "CMS_GITHUB_CLIENT_ID=%s\nCMS_GITHUB_CLIENT_SECRET=%s\n" "$client_id" "$client_secret" > "$file"
  echo "OAuth credentials saved on the VPS."
'

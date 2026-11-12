#!/usr/bin/env bash
# One-time configuration. The PEM is sent to gh over stdin, never as an argument.
set -euo pipefail
app_id=${1:?Usage: configure-release-app.sh APP_ID PRIVATE_KEY_FILE}
key_file=${2:?Provide a local private-key PEM path.}
[[ $app_id =~ ^[0-9]+$ ]] || { echo 'App ID must be numeric.' >&2; exit 1; }
[[ -f $key_file && -r $key_file ]] || { echo 'Private-key file is not readable.' >&2; exit 1; }
command -v gh >/dev/null
openssl pkey -in "$key_file" -noout >/dev/null 2>&1 || { echo 'Private-key file is not a valid PEM key.' >&2; exit 1; }
gh auth status >/dev/null
# Set the secret before publishing the ID so partial setup cannot run the App.
gh secret set CONTENT_RELEASE_APP_PRIVATE_KEY --repo 0xRivers/custody-consulting < "$key_file"
gh variable set CONTENT_RELEASE_APP_ID --repo 0xRivers/custody-consulting --body "$app_id"
printf 'Release App configured. No deployment or merge was triggered.\n'

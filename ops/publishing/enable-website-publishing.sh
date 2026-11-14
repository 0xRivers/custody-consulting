#!/usr/bin/env bash
# Run once locally after the reviewed workflow reaches main. Never prints keys.
set -euo pipefail
repo=0xRivers/custody-consulting
here=$(cd -- "$(dirname -- "$0")" && pwd)
if [[ -f "$here/../package.json" ]]; then project=$(cd -- "$here/.." && pwd);else project=$(cd -- "$here/../.." && pwd);fi
key=${ARTICLE_DEPLOY_KEY:-"$project/.local/custody-pilot"}
hosts=${ARTICLE_KNOWN_HOSTS:-"$project/.local/known_hosts"}
owner=${CUSTODY_SUPER_ADMIN_NPUB:-npub1efvt8cchugdmxahxawp64z7awkxrq5mm9mjwzwpf68urrc4rsf7s9lhewa}
mode=${1:---check}
[[ "$mode" == --check || "$mode" == --apply ]]
main=$(gh api "repos/$repo/git/ref/heads/main" --jq .object.sha)
[[ "$main" =~ ^[a-f0-9]{40}$ ]]
gh api "repos/$repo/contents/ops/publishing/article-release-guard.mjs?ref=$main" --jq .sha >/dev/null
gh api "repos/$repo/contents/.github/workflows/article-release.yml?ref=$main" --jq .sha >/dev/null
test -r "$key" && test -r "$hosts"
ssh-keygen -y -P '' -f "$key" >/dev/null
ssh-keygen -F 85.122.114.151 -f "$hosts" >/dev/null
test "$(gh api "repos/$repo/environments/production" --jq '[.protection_rules[].type] | index("required_reviewers") != null')" = true
if [[ "$mode" == --check ]]; then
  printf 'Ready to configure main-only article publishing at %s. Run again with --apply after reviewing the setup.\n' "$main"
  exit 0
fi
ssh -F /dev/null -i "$key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$hosts" -o ConnectTimeout=10 custody@85.122.114.151 'test -w /srv/custody-consulting/releases && test -w /srv/custody-consulting && test -x /usr/local/bin/custody-activate-release'
config=$(mktemp)
trap 'rm -f -- "$config"' EXIT
cat > "$config" <<'JSON'
{"wait_timer":0,"reviewers":[],"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
gh api --method PUT "repos/$repo/environments/article-production" --input "$config" >/dev/null
policies=$(gh api "repos/$repo/environments/article-production/deployment-branch-policies" --jq '.branch_policies|length')
if [[ "$policies" == 0 ]]; then
 gh api --method POST "repos/$repo/environments/article-production/deployment-branch-policies" -f name=main -f type=branch >/dev/null
else
 test "$policies" = 1
 test "$(gh api "repos/$repo/environments/article-production/deployment-branch-policies" --jq '.branch_policies[0]|.name+":"+ .type')" = main:branch
fi
gh secret set VPS_DEPLOY_KEY --repo "$repo" --env article-production < "$key"
gh secret set VPS_KNOWN_HOSTS --repo "$repo" --env article-production < "$hosts"
gh variable set ARTICLE_RELEASE_GUARD_SHA --repo "$repo" --body "$main"
gh variable set CUSTODY_SUPER_ADMIN_NPUB --repo "$repo" --body "$owner"
test "$(gh api "repos/$repo/environments/article-production" --jq '[.protection_rules[].type] | index("required_reviewers") == null')" = true
printf 'Article environment configured for main only. Trusted verifier: %s\nEngineering production approval retained.\n' "$main"

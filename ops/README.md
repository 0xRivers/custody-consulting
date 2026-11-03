# VPS deployment

Deployed on `85.122.114.151` through GitHub Actions. Run Git commands from
`custody-site/`. The numbered sections below describe initial installation and
recovery; do not repeat bootstrap for routine deployments.

## Routine deployment (no root required)

| Branch | SSH account | Artifact | Backend |
| --- | --- | --- | --- |
| staging | custody-staging | build/astro-staging/ | 127.0.0.1:8008 |
| main | custody-deploy | dist/ | 127.0.0.1:8004 |

Commits pushed to each branch trigger its existing deployment workflow, using
that environment's dedicated SSH key and verified known-hosts secret. The
deployment accounts do not need sudo, root login or Caddy restarts to activate
static releases. Production promotion retains the rollout's review gate.

An agent with GitHub network access can commit, push, monitor the workflow and
check the public release SHA without operator terminal commands. Direct SSH
additionally requires outbound port 22 access. VPS permissions cannot remove
restrictions imposed by the agent's execution environment. Never disable host
verification to work around a connectivity failure.

## 1. Connect and inspect

This machine's global SSH configuration currently fails its ownership check.
`-F /dev/null` bypasses that configuration; it does not bypass host verification.
Use your existing root password, SSH agent or explicit `-i /path/to/admin-key`.
Never paste passwords or private keys into chat.

From the VPS provider console, obtain the host fingerprint:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

From this machine, connect and compare the displayed fingerprint before accepting:

```bash
ssh -F /dev/null root@85.122.114.151
```

On the VPS, inspect rather than replace the existing installation:

```bash
cat /etc/os-release
systemctl cat caddy
ss -ltnp
cat /etc/caddy/Caddyfile.minimal
command -v caddy
```

The supplied backend expects a systemd host, `/usr/local/bin/caddy`, and port 8004
available. If Caddy runs in Docker, its `127.0.0.1` refers to the container:
this configuration must be adapted to its network before using it. Do not add
this proxy block unchanged to a containerized Caddy. Existing custom config
paths must be used instead of the `/etc/caddy/Caddyfile.minimal` example below.

## 2. Install the isolated backend

A dedicated CI key has been generated in `.local/custody-deploy` (git-ignored).
Only its public half goes to the VPS. Root is used only for this installation;
the pipeline has no root key, sudo or Docker permissions.

From this project directory, after verifying the SSH host:

```bash
tar -czf - ops .local/custody-deploy.pub | ssh -F /dev/null root@85.122.114.151 'umask 077; mkdir -p /root/custody-setup; tar -xzf - -C /root/custody-setup'
ssh -F /dev/null root@85.122.114.151 'bash /root/custody-setup/ops/bootstrap-vps.sh /root/custody-setup/.local/custody-deploy.pub'
```

The script adds a separate `custody-web` service and deployment account. It
neither rewrites nor reloads the existing public Caddy configuration. The
service starts before the first release and will return 404 until deployment.
Public ports 80/443 remain with the existing Caddy; do not expose 8004.

After authenticating the server interactively, collect its host key into the
project-local file, comparing it again with the provider-console fingerprint:

```bash
ssh-keyscan -t ed25519 85.122.114.151 > .local/known_hosts.candidate
ssh-keygen -lf .local/known_hosts.candidate
# Only after fingerprints match:
mv .local/known_hosts.candidate .local/known_hosts
ssh -F /dev/null -i .local/custody-deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=.local/known_hosts custody-deploy@85.122.114.151 'id; systemctl is-active custody-web'
```

`ssh-keyscan` alone does not authenticate a server.

## 3. Connect the GitHub repository

The configured repository is `0xRivers/custody-consulting`. The commands below
are initial setup examples; the existing repository and remote are already set.

```bash
gh auth login
# Substitute the real owner/repository before executing:
repo=OWNER/REPOSITORY
git branch -M main
git add .gitignore dist ops .github
git commit -m 'Add bilingual website and VPS deployment pipeline'
git remote add origin "https://github.com/$repo.git"
# If origin already exists, inspect it before changing anything.
```

In the repository's Settings → Environments, create `production` and restrict
its deployment branches to `main`. Configure these environment secrets:

```bash
gh secret set VPS_DEPLOY_KEY --env production --repo "$repo" < .local/custody-deploy
gh secret set VPS_KNOWN_HOSTS --env production --repo "$repo" < .local/known_hosts
git push -u origin main
```

Private repositories need a GitHub plan supporting environments. If unavailable,
remove `environment: production` from the workflow and configure repository
secrets instead. Protect `main` with reviewed pull requests as appropriate.

Checks run on pull requests. Successful main pushes deploy automatically.
The runner sends the committed `dist/` with a version marker, atomically changes
`current`, and checks the local backend. A failed activation restores the prior
symlink. Deployments are serialized. Old releases are retained for rollback;
monitor disk usage and remove old, inactive releases manually when appropriate.
The pipeline does not run browser or translation quality tests.

Local deployment after committing is also supported:

```bash
DEPLOY_KEY="$PWD/.local/custody-deploy" DEPLOY_KNOWN_HOSTS="$PWD/.local/known_hosts" bash ops/deploy.sh
```

A previously uploaded SHA is not overwritten. To retry its activation (including
a CI rerun) or roll back, use step 5. A new content release needs a new commit.

## 4. Route the domain through the existing public Caddy

Set the domain's DNS A record to `85.122.114.151`. Remove/correct an existing
AAAA record if this VPS does not serve that IPv6 address. Ensure the existing
firewall allows 80/443. Before editing, check for an existing domain block to
avoid duplicating it.

After the first deployment passes, inspect the active Caddyfile.minimal for an
existing custody.consulting block. If it already proxies to localhost:8004,
no public proxy edit is needed. Otherwise merge ops/public-site.Caddyfile into
that active configuration, preserving every other site and avoiding duplicate
domain blocks. For a standard
systemd installation, on the VPS:

```bash
cp -a /etc/caddy/Caddyfile.minimal "/etc/caddy/Caddyfile.minimal.backup.$(date +%Y%m%d%H%M%S)"
# Edit the file and add the supplied custody.consulting block.
caddy validate --config /etc/caddy/Caddyfile.minimal --adapter caddyfile
systemctl reload caddy
curl --fail http://127.0.0.1:8004/version.txt
curl --fail https://custody.consulting/version.txt
```

Run the reload only when validation succeeds. If it fails, fix or restore the
backup before proceeding. Check an existing hosted domain after reload as well.
The CI health check covers the backend; these public HTTPS checks also verify
DNS, TLS and proxy routing.

## 5. Roll back

List release IDs and activate a known good full commit SHA:

```bash
ssh -F /dev/null -i .local/custody-deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=.local/known_hosts custody-deploy@85.122.114.151 'ls /srv/custody-consulting/releases'
# Replace FULL_COMMIT_SHA with the chosen 40-character release ID:
ssh -F /dev/null -i .local/custody-deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=.local/known_hosts custody-deploy@85.122.114.151 '/usr/local/bin/custody-activate-release FULL_COMMIT_SHA'
```

Review the workflow and setup scripts before running them on the server. The
only site-specific filesystem and service names are `custody-consulting`,
`custody-deploy` and `custody-web`; existing sites remain under their own setup.

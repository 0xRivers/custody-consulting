# Staging

Production: main -> custody.consulting -> 127.0.0.1:8004.
Staging: staging -> staging.custody.consulting -> 127.0.0.1:8008.
Staging has its own Unix account, SSH key, service, configuration, release tree
and rollback history. Its key cannot write production releases. Staging is
publicly accessible; HTML noindex metadata and X-Robots-Tag exclude it from compliant search
indexing but are not access controls. Crawling is allowed so crawlers can see
noindex. Do not put private data on it.

Run local commands from the custody-site repository.

1. In Njalla, add A / staging / 85.122.114.151 / TTL 900.
2. Upload and install the backend (port 8008 must be unused):

```bash
tar -czf - ops .local/custody-staging.pub | ssh -F /dev/null root@85.122.114.151 'umask 077; mkdir -p /root/custody-staging-setup; tar -xzf - -C /root/custody-staging-setup'
ssh -F /dev/null root@85.122.114.151 'bash /root/custody-staging-setup/ops/bootstrap-staging.sh /root/custody-staging-setup/.local/custody-staging.pub'
```

3. Configure the GitHub environment and secrets using the existing verified host key:

```bash
gh api --method PUT repos/0xRivers/custody-consulting/environments/staging
gh secret set VPS_DEPLOY_KEY --repo 0xRivers/custody-consulting --env staging < .local/custody-staging
gh secret set VPS_KNOWN_HOSTS --repo 0xRivers/custody-consulting --env staging < .local/known_hosts
```

4. Commit the prepared files, keeping them in main, then create the staging branch:

```bash
git add .github/workflows/staging.yml ops
git commit -m 'Add isolated staging environment and deployment workflow'
git push origin main
git switch -c staging
git push -u origin staging
```

The main push deploys production's unchanged website. The staging push triggers
staging.yml, builds the Astro site with `SITE_ENV=staging` and deploys only
`build/astro-staging/` to the separate backend. Future work on staging deploys
there; main continues to deploy the tracked production artifact.

The release bundle currently includes an empty `app.js` compatibility marker
because the root-installed activation helper still checks for the legacy Vite
entrypoint. Astro pages do not reference it. Remove the marker only after a
planned root maintenance change updates that helper.

5. Verify staging's workflow succeeds, then add its public proxy route:

```bash
gh run list --repo 0xRivers/custody-consulting --workflow staging.yml --limit 3
ssh -F /dev/null root@85.122.114.151 'curl -fsS -H "Host: staging.custody.consulting" http://127.0.0.1:8008/version.txt'
ssh -F /dev/null root@85.122.114.151 'bash /root/custody-staging-setup/ops/install-staging-proxy.sh'
```

The proxy installer backs up Caddyfile.minimal, appends only the staging block,
validates before applying, then gracefully reloads the public Caddy. It refuses
to add a duplicate domain. Add DNS before installing the route so Caddy can
obtain its certificate normally.

6. Verify public HTTPS and production:

```bash
curl -fsS https://staging.custody.consulting/version.txt
curl -fsSI https://staging.custody.consulting/
curl -fsS https://custody.consulting/version.txt
```

If local DNS is still cached, test staging using:

```bash
curl -fsS --resolve staging.custody.consulting:443:85.122.114.151 https://staging.custody.consulting/version.txt
```

Promotion: open a PR from staging into main, review it, and merge. The main push
then deploys production. Keep staging synchronized with main before subsequent
work. Neither deployment workflow changes server-side configuration: ops changes
must be installed separately as documented, using root only for setup.

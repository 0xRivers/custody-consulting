# Custody Consulting content editor

The editor lives at `/admin/content/` and uses Decap's GitHub editorial
workflow against `staging`. The public Astro site remains static. Decap
approval merges content to staging. The Astro `draft` flag controls whether
each translated pair is eligible for the production build, and the production
deploy still requires manual dispatch.

Both translations use the same Markdown filename under their language
folders. Set the **Language** field to match the translation being edited.
The public URL comes from the localized **Public URL slug** field, independently
of the filename. Keep **Keep off the live site** enabled while reviewing the
pair. When both translations are ready, clear it and send the pair through
review together.

## Deployment prerequisites

Register a GitHub OAuth App for the editor. Use
`https://custody.consulting/admin/content/` as its homepage and
`https://custody.consulting/admin/content/callback` as its authorization
callback. Keep the client secret in the VPS OAuth service configuration.

From the repository root, run these commands using the VPS administrator login.
The credentials prompt runs on the VPS. The deployment installs the editor
and a loopback OAuth proxy, and verifies the public editor and GitHub redirect.

```bash
bash ops/booking/configure-content-oauth.sh
bash ops/booking/deploy-content-cms.sh
```

The proxy allows the repository owner's GitHub account, `0xRivers`. For
the private repository, Decap requests GitHub's OAuth `repo` scope. The
server forwards only the access token to the same-origin editor popup.

Verify GitHub sign-in and a bilingual draft save to staging at
`https://custody.consulting/admin/content/`. After that, enable the sidebar
link with:

```bash
CONTENT_CMS_ENABLED=true bash ops/booking/deploy-production-staff-pages.sh --admin-only
```

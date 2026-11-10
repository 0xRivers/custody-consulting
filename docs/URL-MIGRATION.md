# CC-24 URL migration

The baseline is the tracked legacy site on `origin/main` at `9b6b41f`. Its static entry points are `dist/index.html` and `dist/app.js`. The landing page defaults to English, accepts `?lang=pl`, and links to sections using fragments.

| Legacy URL or fragment | Astro destination |
| --- | --- |
| `/` | Language chooser at `/` |
| `/?lang=en`, `/index.html?lang=en` | `/en/` |
| `/?lang=pl`, `/index.html?lang=pl` | `/pl/` |
| `#services`, `#faq`, `#contact` | Same anchors on the selected language page |
| `#approach`, `#audiences`, `#steps`, `#questions` | Preserved aliases for the approach, audience, process and FAQ sections |
| `/app.js` | Obsolete implementation asset with no replacement URL |

Caddy redirects legacy language URLs on GET and HEAD when the target homepage exists. The redirect drops the old query. Browsers carry the original fragment across the redirect. The Astro chooser also handles known legacy fragments without a language query, using the legacy English default. A fragment reaches the browser only, so that fallback needs JavaScript. The chooser links remain usable without it.

The new locale and blog directories use trailing slashes. Missing URLs and assets should return HTTP 404. Keep the existing checkout, admin, webhook and Lightning pilot routes on their current handlers. Their query strings and invitation fragments carry booking state.

## Rollout and rollback

1. Start on staging after CC-21 supplies the full Astro artifact. Record the current release SHA and resolved `current` path. Save a copy of the active static backend Caddyfile on the VPS. Keep the existing release and record the previous public Caddy configuration if a change there is needed.
2. Validate the candidate static backend config with `caddy validate --config <candidate> --adapter caddyfile`. Install it only for the matching static backend and restart that backend. The existing backend has Caddy's admin API disabled. Leave the shared TLS proxy and the other sites alone. Run the checks after deploying the Astro artifact.

   ```bash
   node ops/checks/url-migration.mjs https://staging.custody.consulting
   ```

3. In a browser, open `/?lang=pl#approach` and `/#services`. Check that the destination and scroll target are correct. Check the existing payment result route with a known private test link and keep its identifier out of the verification notes.
4. Apply the same procedure to production during CC-25, then run the checker against `https://custody.consulting`. If routes fail, restore the saved backend Caddyfile and restart that backend. Activate the recorded previous release with the existing activation helper if the artifact also needs rollback. Verify the previous release and the affected hostname after restoring.

# Lovable page on staging

Imported from 0xRivers/custodyconsulting-79ccbab2 at commit
2385fb0c24ff8fe9b99659fad0f236ddaf783214.

The original home-page JSX, English/Polish content, vault image, favicon and
Tailwind theme are retained. This is a static React/Vite adaptation of the
single page, without the unused TanStack server, router or component library.
Fonts remain Archivo and Ubuntu from Google Fonts, as in the original.

The original logo is not in the source repository. Its asset descriptor points
to a Lovable-hosted PNG. Run `node ops/fetch-lovable-logo.mjs` once to download
and validate the PNG, then commit the local image so staging is self-contained.

Run `npm install` to generate package-lock.json and install dependencies, then
`npm run build`. Commit package-lock.json. CI uses npm ci and performs the
TypeScript/build checks before deployment.

The Vite import builds to `build/staging/` for historical comparison. Active
staging deployment now builds the Astro port to `build/astro-staging/`. The
existing tracked `dist/` directory is deliberately retained: production's main
workflow continues to deploy that version. Promotion requires an explicit
production workflow change; a merge alone does not switch the production
artifact.

The original contact form never sent messages. The visual form remains, but its
post-submit message explicitly says it is a preview and no message was sent.
Field accessible labels and document language synchronization were added.
The default language remains Polish, matching Lovable; EN/PL buttons switch it.
Staging remains noindex via both its document metadata and backend headers.

Local commands:

    node ops/fetch-lovable-logo.mjs
    npm install
    npm run build

After build succeeds, commit the imported sources, configuration, lockfile,
logo, and staging pipeline on the staging branch and push origin staging.
Do not add .local or .openai, and do not push main for this staging-only import.

# CC-5: isolated Astro foundation

This is the initial scaffold, not the migrated website. Existing build/deploy
commands still use React on staging and dist/ on production. This scaffold is
not deployed by either workflow.

The explicit SITE_ENV contract rejects missing/unknown values, uses separate
hostnames and output directories, and applies noindex metadata to staging.
Staging Caddy must continue supplying X-Robots-Tag for all responses.

The registry is inaccessible from the editor. Astro has NOT been installed or
pinned and no successful Astro build is claimed. Complete CC-4 by selecting a
supported exact Astro version with Node 24 and committing its root lockfile.
Use the root package and lockfile, not a separate package here. Then build with:

    SITE_ENV=staging ./node_modules/.bin/astro build --root astro --config astro.config.mjs
    SITE_ENV=production ./node_modules/.bin/astro build --root astro --config astro.config.mjs

Outputs: build/astro-staging and build/astro-production. Review generated HTML,
robots directives and assets in both outputs before changing deployment paths.
Do not deploy the placeholder homepage. CC-6 ports the actual design/content.
Production-only canonical/hreflang/sitemap support follows in CC-15/CC-16.

Contract tests (no new dependencies):

    node --test ops/checks/astro-environment.test.mjs

Reference: https://docs.astro.build/en/reference/configuration-reference/

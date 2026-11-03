# CC-5: isolated Astro foundation

This is the verified Astro foundation and bilingual landing-page port. Existing
deployment commands still use React on staging and dist/ on production. Astro
artifacts are not deployed until the staging pipeline is changed in CC-21.

The explicit SITE_ENV contract rejects missing/unknown values, uses separate
hostnames and output directories, and applies noindex metadata to staging.
Staging Caddy must continue supplying X-Robots-Tag for all responses.

Astro 7.4.5 is pinned in the root package and lockfile and verified on Node 24.
Use the root package and lockfile, not a separate package here. Build with:

    SITE_ENV=staging ./node_modules/.bin/astro build --root astro --config astro.config.mjs
    SITE_ENV=production ./node_modules/.bin/astro build --root astro --config astro.config.mjs

Outputs: build/astro-staging and build/astro-production. Each contains the root
language chooser plus `/en/` and `/pl/` landing pages. Review generated HTML,
robots directives and assets in both outputs before changing deployment paths.
Production-only canonical/hreflang/sitemap support follows in CC-15/CC-16.

Update Astro with an exact version, regenerate the root lockfile, and run both
environment builds plus `npm audit`. Do not use `--force` to resolve dependency
changes. The verification workflow records this procedure in CI.

Contract tests (no new dependencies):

    node --test ops/checks/astro-environment.test.mjs

Reference: https://docs.astro.build/en/reference/configuration-reference/

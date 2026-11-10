# Performance contract

CC-19 keeps the Astro site static and establishes repeatable image, loading and mobile-performance checks before production rollout.

## Delivery strategy

- The landing-page hero is emitted as responsive WebP candidates at 480, 768, 1200 and 1600 pixels. It is discoverable in the initial HTML, loaded eagerly and marked with high fetch priority because it is the likely Largest Contentful Paint element.
- Header, footer and language-gateway logos use bounded Astro image transforms rather than shipping the 1348-pixel source at every placement.
- Every rendered image reserves intrinsic width and height. The footer logo is lazy-loaded; above-the-fold images are not.
- The site uses the operating-system font stack. It downloads no font files and makes no third-party font requests.
- Language landing pages use no client JavaScript or hydrated framework components. The root language chooser retains only its small inline compatibility redirect for explicit legacy `?lang=en` and `?lang=pl` links.
- Fingerprinted `/_astro/` assets are eligible for a one-year immutable cache. HTML and other mutable files retain `no-cache` revalidation. These Caddy templates take effect only when that environment is deliberately installed or restarted; CC-19 does not alter the live production configuration.

## Enforced budgets

`npm run check:performance-output` checks each Astro artifact present in `build/`:

- responsive hero `srcset` with at least four WebP candidates;
- explicit image dimensions and expected loading priorities;
- images no larger than 90 KB and CSS files no larger than 25 KB;
- no downloaded fonts; and
- no emitted client JavaScript assets.

Source-level tests also reject Astro hydration directives, downloaded font references and regressions to the Caddy cache split.

## Mobile lab profile

The staging workflow serves the tested static artifact locally and measures `/en/` in headless Chrome using:

- a 412 by 915 CSS-pixel viewport at 2x device scale;
- 4x CPU slowdown;
- 150 ms network latency; and
- 200,000 bytes per second download throughput.

The run records LCP, CLS, total blocking time, document timings, transfer size, resource count and a synthetic native FAQ interaction. The JSON report is retained for 30 days as `mobile-performance-<commit SHA>` and is also printed in the workflow log.

The review targets are LCP at or below 2.5 seconds, CLS at or below 0.1 and interaction latency at or below 200 ms. The FAQ result is a lab proxy rather than field INP; a missing event observation means it completed below the observer's 16 ms threshold or the browser did not expose the entry. Production Core Web Vitals must be reviewed separately with field data after launch and sufficient traffic.

## Investigation order

If the mobile check regresses:

1. Inspect the LCP element and hero candidate selected by the browser, then check transfer size and discovery priority.
2. Inspect layout-shift entries for missing reserved space or late style changes.
3. Inspect long tasks and emitted scripts before adding client-side behavior.
4. Compare the JSON artifact with the last accepted staging run under the same profile.

Local build and Chrome execution may be unavailable in restricted workspaces. In that case, the clean GitHub Actions build is the authoritative measurement.

# CC-6 and CC-7 verification — 2026-11-03

Commit `d4b799401db9a3d7cdfbe8d85577a1d457fbaa60` ports the revised
landing page to Astro and implements the bilingual route mapping.

GitHub Actions run
[41670998494](https://github.com/0xRivers/custody-consulting/actions/runs/41670998494)
completed successfully with this evidence:

- exact dependency installation and `npm audit`: 0 vulnerabilities;
- environment contract: 2 passing tests, 0 failures;
- staging output: 3 static pages (`/`, `/en/`, `/pl/`);
- production output: 3 static pages (`/`, `/en/`, `/pl/`);
- both localized documents have the expected `lang` value and headline copy;
- each localized document links to its equivalent translation;
- staging HTML contains `noindex`; production root does not;
- every expected `index.html` is non-empty.

The port uses static HTML and CSS. Native `details` elements provide the mobile
navigation and FAQ interactions. The only inline script handles an explicit
legacy `?lang=en` or `?lang=pl` request from the neutral root chooser. Visual,
keyboard and device acceptance remains part of CC-23.

The Astro outputs remain isolated from deployment. The existing React staging
site deployed and passed its public SHA/noindex checks in run 41670998327.
Production remained unchanged.

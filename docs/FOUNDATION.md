# Foundation progress — 2026-11-03

## Working decisions (CC-1)

Proceed with Astro static output, Git-managed Markdown, English and Polish,
/en/ and /pl/ routes, and paired translations. Keep the existing Caddy services
and isolated deployment accounts. Production promotion follows staging review.
The initial articles cover self-custody basics, backup/recovery planning and
single-signature versus multisig. These are working defaults from the rollout.

Business inputs still required before publishing: public author name/biography,
verified business/contact details, booking destination, and approved package
prices/tax wording. Existing draft copy is not evidence of approved prices.
These do not prevent technical prototyping but prevent completing CC-1.

## Baseline (CC-2)

Production source remains dist/index.html and dist/app.js. Its known routes are
/ and /?lang=en, /?lang=pl; anchors services, approach, faq, contact.
Staging is the React/Vite build with top, why, services, process, faq, contact
anchors. The current source commit before foundation work is 2f55e1b.
This is not a claim about the live release SHA.

Both activation scripts require index.html, app.js and a full SHA in version.txt.
Astro migration must update these checks and install the new scripts on the VPS.
Current production rollback uses an existing retained release with
/usr/local/bin/custody-activate-release (verify installed path before executing).
No rollback has been executed or server artifact retention verified in this task.
Screenshots and server-side release inventory remain outstanding.

## Search exclusion (CC-3)

Repository checks confirm noindex in staging HTML and X-Robots-Tag in the staging
Caddy config. robots.txt allows crawling to expose noindex. Live checks are pending;
Search Console removal/indexing history requires the owner's property access.
Reference: https://developers.google.com/search/docs/crawling-indexing/block-indexing

## Dependencies (CC-4)

Existing CI uses Node 24. No package versions or lockfile have been changed.
The earlier high/low npm advisories have not yet been identified. DNS failures
prevented npm audit and live HTTP verification in the editor environment.
Do not force-install or suppress audit findings. Pick exact compatible Astro and
integration versions after registry access and advisory review, then clean-build.

## Evidence collection

The Foundation evidence workflow runs on the first push containing its files.
It records public release SHAs, homepage HTML/headers and robots.txt, checks staging
exclusion, runs npm audit, and clean-builds the existing site. A failed audit remains
a failing check; evidence is uploaded even on failure. No deployment or VPS writes
are performed by this workflow. Existing staging deployment still runs on pushes.

Download its foundation-evidence artifact and review report.json/npm-audit.json.
Snapshots are public HTML only; React-rendered copy needs separate visual capture.
The check does not prove search-engine removal, preserve a whole VPS release, or
constitute a completed rollback drill. No foundation card is marked Done yet.

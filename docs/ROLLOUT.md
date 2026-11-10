# Custody Consulting rollout plan

Recommendation: Astro static pages and a bilingual blog, built through GitHub Actions
and served by the existing Caddy services. Production is custody.consulting; staging
is staging.custody.consulting and remains noindex throughout. GitHub Pages hosts only
the planning board, never the customer website.

## Phases and release gates

1. Foundation: confirm editorial workflow and business inputs, capture rollback baseline,
   verify staging exclusions and resolve dependencies (CC-1–CC-4).
2. Migration: Astro build, design, bilingual routes and content models (CC-5–CC-12).
3. Content and discovery: reviewed bilingual launch articles, metadata, sitemap,
   structured data and answer-focused editorial patterns (CC-13–CC-18).
4. Quality and deployment: performance, working enquiries, environment-safe artifacts,
   staging acceptance and URL migration (CC-19–CC-24).
5. Production: owner approval, controlled launch, search submission and monitoring
   (CC-25–CC-28).

Work may run in parallel once dependencies are satisfied. Effort labels are relative:
S = bounded task; M = several related implementation/review steps; L = substantial
content or implementation work. They are not calendar commitments. Owners are roles
to assign, not claims that particular people have accepted work. Target 1–2 active
engineering tasks at a time. Ready → In progress → Review → Done; Blocked records an
external impediment. Only move to Done when all acceptance criteria have evidence.

Production launch gate: CC-23 and CC-24 pass, business inputs and contact delivery are
verified, no drafts leak, all production indexing checks pass, and the owner approves
CC-25. Retain the prior artifact and rollback command. Staging is never submitted to
search engines. No AEO ranking or citation outcome is guaranteed.

## Board operation

Canonical shared state is docs/board/backlog.json on the staging branch. Edit status,
owner or acceptance criteria there and push to staging; GitHub Pages republishes the
board. The board has search, filters and expandable acceptance criteria. It does not
pretend to save shared changes in browser storage. CC IDs are backlog IDs, not GitHub
issue numbers; issues can be added later without renumbering the backlog.

Only docs/board is uploaded to Pages. The board has noindex metadata and no sitemap;
it contains planning material, not credentials. Standard Pages hosting may be publicly
accessible even though the repository is private. Private-repository Pages requires a
supported GitHub plan. Do not change repository visibility to solve a plan limitation.

## Backlog

### CC-1 — Confirm publishing workflow and launch scope

Foundation · P0 · Owner · S · Ready

Dependencies: None.

- [ ] Choose Markdown/MDX or CMS authoring; default proposal is Git-managed Markdown.
- [ ] Confirm launch languages, article topics, pricing, author identity and contact destination.
- [ ] Record explicit production launch criteria.

### CC-2 — Inventory URLs and capture rollback baseline

Foundation · P0 · Engineering · S · Ready

Dependencies: None.

- [ ] Record current production and staging release SHAs and routes.
- [ ] Capture key page screenshots and content for comparison.
- [ ] Verify previous-release activation and retain the last production artifact.

### CC-3 — Verify staging search exclusion

Foundation · P0 · Engineering · S · Ready

Dependencies: None.

- [ ] Deploy prepared noindex correction and verify live HTTP header plus HTML meta.
- [ ] Allow crawling so noindex can be observed; omit staging from public sitemaps and feeds.
- [ ] Check Search Console for existing staging URLs; request removal if present.

### CC-4 — Resolve dependency advisories and pin supported toolchain

Foundation · P0 · Engineering · M · Ready

Dependencies: None.

- [ ] Inspect npm audit, including the previously reported high advisory.
- [ ] Choose supported Astro, Node and integration versions; commit one lockfile.
- [ ] Clean install and build pass without forced dependency resolution.

### CC-5 — Create Astro static build and environment contract

Migration · P0 · Engineering · M · Backlog

Dependencies: CC-1, CC-4.

- [ ] Generate complete HTML with static Astro output.
- [ ] Explicit production/staging build mode; unknown mode fails or remains noindex.
- [ ] Document output directory and dependency update procedure.

### CC-6 — Port shared design and navigation

Migration · P0 · Engineering · M · Backlog

Dependencies: CC-5.

- [ ] Preserve revised copy, logo, vault image, colours and typography.
- [ ] Build shared header/footer and accessible mobile navigation.
- [ ] Keep JavaScript only for interactions that need it.

### CC-7 — Implement bilingual routes and translation mapping

Migration · P0 · Engineering · M · Backlog

Dependencies: CC-5.

- [ ] Provide /en/ and /pl/ routes with one complete language per HTML document.
- [ ] Language switch links to the equivalent translated page when available.
- [ ] Define root URL behaviour and redirects from existing language URLs; no forced locale redirects.

### CC-8 — Create service and consultant pages

Content · P1 · Owner + Engineering · M · Backlog

Dependencies: CC-1, CC-6, CC-7.

- [ ] Publish clear services and a verifiable consultant biography in both languages.
- [ ] Confirm package scope, prices, currency and tax presentation.
- [ ] Include actual contact details and business information without invented credentials.

### CC-9 — Define blog content collection and editorial schema

Blog · P0 · Engineering · M · Backlog

Dependencies: CC-5, CC-7.

- [ ] Validate title, summary, locale, slug, author, publication date, update date, draft flag and translation key.
- [ ] Reject duplicate URLs and invalid dates at build time.
- [ ] Keep drafts out of production pages, indexes, feeds and sitemap.

### CC-10 — Build blog index, topics and pagination

Blog · P0 · Engineering · M · Backlog

Dependencies: CC-6, CC-9.

- [ ] Create /en/blog/ and /pl/blog/ with real crawlable article links.
- [ ] Topic pages and pagination work without JavaScript; avoid empty thin topic pages.
- [ ] Show accessible empty states while articles are drafts.

### CC-11 — Build article template and reading experience

Blog · P0 · Engineering · M · Backlog

Dependencies: CC-9.

- [ ] Render article body and key answer in initial HTML.
- [ ] Show author, dates, table of contents, sources and related articles.
- [ ] Provide readable mobile typography, image alt text and navigation back to topic/index.

### CC-12 — Configure editorial workflow and author guide

Blog · P1 · Owner + Engineering · S · Backlog

Dependencies: CC-1, CC-9.

- [ ] Document how to draft, preview, translate, review and publish an article.
- [ ] Use pull requests with preview on staging and approval before production.
- [ ] If CMS chosen, define authenticated previews and webhook/rebuild behaviour.

### CC-13 — Draft initial bilingual article set

Content · P0 · Editorial · L · Backlog

Dependencies: CC-1, CC-9, CC-11.

- [ ] Draft three paired EN/PL articles: self-custody basics, backup/recovery planning, single-signature versus multisig.
- [ ] Use direct opening answers, concrete examples, limitations and primary sources.
- [ ] No seed phrases, real wallet details or unverified legal/tax instructions.

### CC-14 — Review initial articles for accuracy and translation quality

Content · P0 · Owner + reviewer · M · Backlog

Dependencies: CC-13.

- [ ] Check technical claims and primary source links.
- [ ] Review Polish and English for meaning, terminology and completeness.
- [ ] Approve author attribution and record genuine review dates before removing draft status.

### CC-15 — Implement production metadata and canonical URLs

SEO · P0 · Engineering · M · Backlog

Dependencies: CC-7, CC-11.

- [ ] Unique title/description and correct lang for every indexable page.
- [ ] Production self-canonicals use https://custody.consulting only.
- [ ] Reciprocal hreflang links only between published translations; configure x-default deliberately.

### CC-16 — Generate production sitemap and bilingual RSS feeds

SEO · P0 · Engineering · S · Backlog

Dependencies: CC-9, CC-15.

- [ ] Include only published canonical production URLs.
- [ ] Exclude drafts, staging URLs, errors and duplicate utility pages.
- [ ] Use truthful lastmod dates; feed URLs and links target production.

### CC-17 — Add accurate structured data

SEO · P1 · Engineering + Editorial · S · Backlog

Dependencies: CC-8, CC-11, CC-15.

- [ ] Add Article/BlogPosting, BreadcrumbList and verified Organization/Person data where appropriate.
- [ ] Match markup to visible content and actual author details.
- [ ] Validate with structured-data tools; no fabricated ratings or promised FAQ rich results.

### CC-18 — Apply answer-focused editorial patterns

SEO · P1 · Editorial · S · Backlog

Dependencies: CC-11, CC-14.

- [ ] Begin articles with concise answers followed by reasoning and caveats.
- [ ] Use descriptive question headings, definitions and comparison tables when useful.
- [ ] Link sources and related services; avoid keyword stuffing and AI citation guarantees.

### CC-19 — Optimise images, fonts and loading performance

Quality · P1 · Engineering · M · Backlog

Dependencies: CC-6, CC-11.

- [ ] Responsive image sizes/formats with explicit dimensions.
- [ ] Optimise hero loading and font delivery; remove unnecessary scripts.
- [ ] Measure mobile performance and investigate LCP, CLS and INP issues.

### CC-20 — Connect working enquiry or booking flow

Content · P0 · Owner + Engineering · M · Backlog

Dependencies: CC-1, CC-8.

- [ ] Choose verified booking URL or form recipient/provider.
- [ ] Validate inputs, show truthful success/error states and provide required privacy information.
- [ ] Test delivery and failure behaviour; never request wallet secrets.

### CC-21 — Adapt both CI pipelines for Astro artifacts

Deployment · P0 · Engineering · M · Backlog

Dependencies: CC-5, CC-9.

- [ ] Build once per deployment from a locked clean install; deploy the tested artifact.
- [ ] Replace app.js-specific activation assumptions with HTML/artifact checks.
- [ ] Preserve separate keys, users, directories and ports; make reruns recoverable.

### CC-22 — Add environment-specific release checks

Deployment · P0 · Engineering · M · Backlog

Dependencies: CC-15, CC-16, CC-21.

- [ ] Staging requires noindex headers/meta and no production sitemap exposure.
- [ ] Production must have no noindex and must use production canonical/hreflang/sitemap URLs.
- [ ] Fail deployment checks on draft leaks, missing assets, malformed markup or wrong hostnames.

### CC-23 — Run staging acceptance review

Quality · P0 · Owner + Engineering · M · Backlog

Dependencies: CC-10, CC-14, CC-17, CC-18, CC-19, CC-20, CC-22.

- [ ] Review desktop/mobile layouts, keyboard navigation, language links, forms, articles and 404s.
- [ ] Verify content is present with JavaScript disabled and links return expected statuses.
- [ ] Record evidence and resolve launch-blocking issues; confirm noindex remains active.

### CC-24 — Prepare URL migration and Caddy routing

Deployment · P0 · Engineering · S · Backlog

Dependencies: CC-2, CC-7, CC-21.

- [ ] Map legacy URLs and anchors to their new destinations where needed.
- [ ] Validate redirects, trailing-slash policy, static routes, 404 status and MIME types.
- [ ] Back up Caddy configs and document rollback without affecting other VPS sites.

### CC-25 — Approve and release production

Launch · P0 · Owner + Engineering · M · Backlog

Dependencies: CC-23, CC-24.

- [ ] Owner reviews staging and authorises production promotion.
- [ ] Merge approved release and deploy production-specific artifact.
- [ ] Verify HTTPS, release SHA, EN/PL pages, blog, robots, sitemap, canonicals and enquiries; roll back on critical failure.

### CC-26 — Configure search measurement and submit sitemap

Launch · P1 · Owner + Engineering · S · Backlog

Dependencies: CC-25.

- [ ] Verify production in Google Search Console and Bing Webmaster Tools.
- [ ] Submit production sitemap and inspect representative EN/PL pages.
- [ ] Exclude staging from submissions; agree privacy-conscious analytics/conversion measurement.

### CC-27 — Monitor launch and indexing

Launch · P1 · Owner + Engineering · M · Backlog

Dependencies: CC-25, CC-26.

- [ ] Check availability, 404s, forms and performance within 24–48 hours.
- [ ] Review indexing/canonical/language reports at one and four weeks; track staging exclusions.
- [ ] Prioritise evidence-based fixes; document any AI referrals without assuming complete attribution.

### CC-28 — Establish ongoing publishing and maintenance cadence

Launch · P2 · Owner + Editorial · S · Backlog

Dependencies: CC-12, CC-27.

- [ ] Maintain a question-led editorial backlog and review outdated custody guidance.
- [ ] Schedule dependency updates, link checks and recovery drills.
- [ ] Review search performance and consultation conversions monthly; update dates only for substantive changes.


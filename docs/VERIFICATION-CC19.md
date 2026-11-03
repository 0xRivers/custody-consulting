# CC-19 verification — image, font and loading performance

Verified on November 3, 2026 against staging commit `d30d8e45e5e847a9a34121fc673180cd75e86f27`.

## Implementation

- The likely LCP hero is emitted as four responsive WebP candidates at 480, 768, 1200 and 1600 pixels, with intrinsic dimensions, eager loading and high fetch priority.
- Header, footer and language-gateway logos use bounded WebP transforms. Below-the-fold footer imagery is lazy-loaded.
- The site uses system fonts, emits no downloaded font assets and has no hydrated framework components.
- Static output checks enforce a 90 KB image budget, a 25 KB CSS budget, intrinsic image dimensions and zero client JavaScript assets.
- Caddy source templates distinguish immutable fingerprinted `/_astro/` assets from revalidated mutable documents. No live production configuration was changed.

## Automated evidence

GitHub Actions run [41733249032](https://github.com/0xRivers/custody-consulting/actions/runs/41733249032) completed successfully:

- clean `npm ci` and all 20 Astro contract tests passed;
- the staging static build and performance-output contract passed;
- responsive assets generated at 8–49 KB for hero candidates and 9–15 KB for logo transforms;
- the mobile Chrome lab completed;
- non-root staging deployment completed; and
- the public release SHA and search-exclusion header passed.

The retained artifact is `mobile-performance-d30d8e45e5e847a9a34121fc673180cd75e86f27` (artifact `13277363064`, SHA-256 `baec7956202ac62da6ada687cc7e84309e85a24755ba03d11980d0f5a1c07e5f`) and expires December 3, 2026.

## Mobile lab result

The repeatable profile uses a 412 by 915 viewport at 2x scale, 4x CPU slowdown, 150 ms latency and 200,000 bytes per second download throughput.

| Measure | Result | Review target | Outcome |
| --- | ---: | ---: | --- |
| LCP | 752 ms | 2,500 ms | Pass |
| CLS | 0 | 0.1 | Pass |
| Synthetic FAQ interaction | 24 ms | 200 ms | Pass |
| Total blocking time | 0 ms | — | No blocking work observed |
| DOM content loaded | 287 ms | — | Recorded |
| Load | 721 ms | — | Recorded |
| Transfer | 64,839 bytes | — | Four resources |
| Script resources | 0 | 0 | Pass |

The synthetic FAQ click is a lab interaction proxy, not field INP. Production field Core Web Vitals still require real traffic after the approved production rollout.

## Release controls

- Public staging release verified by CI: `d30d8e45e5e847a9a34121fc673180cd75e86f27`.
- Public staging response verified by CI: `X-Robots-Tag: noindex, nofollow, noarchive`.
- `main` remained protected at `9b6b41f5f33dac420f4a4b389f13f7ab586b636d`.
- Production deployment and production Caddy configuration remained unchanged.

Two earlier staging runs failed before deployment while hardening Chrome cleanup and startup timing. Neither failure activated a release. Run `41733249032` is the authoritative accepted evidence.

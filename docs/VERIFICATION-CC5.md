# CC-4 and CC-5 verification — 2026-11-03

GitHub Actions run
[41669486142](https://github.com/0xRivers/custody-consulting/actions/runs/41669486142)
installed and pinned Astro 7.4.5 using Node 24, generated the root lockfile,
and created commit `7ab15f4daf185670246e6a8d2143826dcd201e13`.

Evidence from the successful run:

- environment contract: 2 passing tests, 0 failures;
- staging output: `build/astro-staging`, 1 static page;
- production output: `build/astro-production`, 1 static page;
- staging HTML contains `noindex`;
- production HTML does not contain `noindex`;
- both output `index.html` files are non-empty;
- `npm audit`: 0 vulnerabilities.

Astro remains isolated from the live deployment workflows. The public staging
site was separately verified at `7e94686ac67248b1e3a4434b712f8e9cd7d160d7`
before the bot dependency commit. GitHub does not start new workflows for pushes
made with the workflow `GITHUB_TOKEN`, so `7ab15f4` was not deployed. Production
was not changed. CC-6 will port the real design before any Astro artifact is
connected to staging deployment.

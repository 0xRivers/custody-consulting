#!/usr/bin/env bash
# One definition of the bilingual static-release validation suite.
set -euo pipefail
npm run test:astro:contract
npm run test:publishing
npm run build:astro:staging
npm run build:astro:production
for check in editorial-boundaries metadata-output syndication-output structured-data-output answer-focused-output performance-output; do
  npm run "check:$check"
done

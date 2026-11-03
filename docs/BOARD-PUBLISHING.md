# Publish the rollout board

The `Publish rollout board` workflow publishes only `docs/board` from `staging`.
It does not change production hosting or the domain's DNS.

1. Open repository Settings → Pages and select **GitHub Actions** as the source.
   If Pages is unavailable for this private repository, check the account's plan;
   do not make the repository public to work around it.
2. Under Settings → Environments → github-pages, ensure deployment branch rules
   permit `staging`.
3. Push the prepared commit:

   ```sh
   git push origin staging
   gh run list --repo 0xRivers/custody-consulting --workflow board-pages.yml --limit 3
   ```

4. Open the successful run's deployment URL. The expected default address is
   https://0xrivers.github.io/custody-consulting/; use the URL reported by GitHub
   if existing Pages settings specify another address.

If a run failed before Pages was enabled, enable it and rerun that run:

```sh
gh run rerun RUN_ID --repo 0xRivers/custody-consulting
```

Verify all 28 cards appear, filters work and card details expand. The board is
read-only in the browser: use its GitHub edit link to change shared statuses in
`docs/board/backlog.json`. Commit changes to staging to republish. Keep planning
details safe for public viewing: noindex is not access control.

`docs/ROLLOUT.md` records the initial plan. The JSON is authoritative for current
task status. Update both when changing scope or acceptance criteria.

# RedDragon FLOP — Final Completion Progress

Updated: 2026-11-24 (Europe/Istanbul)

## Verified release checkpoint

- Main repository HEAD: `aba62f91fc6ae0fbdb6cb141fd1d8f8345238710`.
- Production deployment `dpl_66o9tmKCAkCCMG3By3bdCbeytyVV`: READY; production alias assigned; deployed commit matches main HEAD.
- Main validation run `45482782281`: success.
- Sandbox local-only Chromium run `45481646535`, candidate `ad6ea38e4ac2d460976a069a994da6c90f2b0643`: 12/12 passed with synthetic DID and mock relay.
- Previously reported main local checks: `npm test` 85/85; `npm run test:local-preview` 7/7.

## Recovery checkpoint

- The available local main checkout is stale at `c56ba4ee45aafcf934acd369f7832656bf6da2ef` and contains 27 modified tracked files plus 4 untracked source/test files. It has not been reset or overwritten. Its local changes must not be considered tested against current production source until reconciled.
- Remote sandbox QA source checkpoint for this remediation: `5a8a017afe490b14939d7d0c9af5a206918e332a`; shared production source paths were compared by Git blob SHA against main `aba62f...` and matched. Sandbox-only README, package manifest, test file and workflow are intentionally different.
- Sandbox repository Vercel lookup returned zero connected projects. The only existing sandbox workflow listens for changes to `.github/workflows/flop-site-browser-audit.yml`; the production audit uses a separate workflow path.

## Phase log

| Phase | Scope | Status | Command / evidence | Next action |
|---|---|---|---|---|
| 0 | Verify current source and keep prior local work | PASS | GitHub `main` branch API confirms `aba62f...`; existing local checkout left untouched. | Continue against verified production and sandbox references. |
| 1 | Production read-only Chromium acceptance: home and `/flop`, 320/390/768/1440, TR/EN, console/network and links | FAIL — CSP violation confirmed; home audit sync needs correction | Runs `45488127913`, `45489343811`, `45489952975`, `45490542505`. Run 4: all 8 `/flop` locale/viewport entries passed. Home audit sampled dynamic content before add-ons/stylesheets settled. Independent local Chromium E2E at `45492723838` rendered final `#autoOut` correctly in English, so the Turkish `#autoOut` finding is a timing false positive, not a confirmed persistent UI defect. The inline `<style>` CSP violation at `public/final-fixes.js:52` remains confirmed. | Finish sandbox E2E, then correct production audit waits for final text, all add-ons and CSS before post-release checks. |
| 2 | Isolated synthetic DID, encrypted backup/restore and negative cases | NOT STARTED | Existing sandbox E2E covered creation, JSON backup and same-DID restore; security regressions were previously 42/42. Need confirm wrong password, malformed backup, key mismatch and DID tampering coverage/results. | Review security test evidence; run only missing negative cases in isolated preview. |
| 3 | Relay shared rate-limit assessment | NOT STARTED | Known concern: memory counter may be per serverless instance. No change proposed or activated. | Inspect deployed `api/relay.js`, prove practical scope, research official Vercel shared-storage options and cost. |
| 4 | Current official FLOP Testnet readiness | NOT STARTED | Prior sources have conflicting status wording. No faucet claim, signature, inference, voucher or chain write performed. | Recheck official pages and use read-only RPC/genesis verification if a supported method is available. |
| 5 | Final regressions and release decision | NOT STARTED | Current production SHA is already READY. Avoid another deployment unless code changes and all gates pass. | Apply only verified necessary fixes; rerun affected tests before any further release. |

## Production audit safety contract

- Target is fixed to `https://reddragon-technocore.vercel.app`.
- Only GET/HEAD/OPTIONS requests pass through the audit's API guard; `/api/relay` POST requests are allowed only for `health`, `rooms`, `config`, `read`, and `kvGet`. All other API writes are intercepted and fail the test.
- The production matrix does not create a DID, expose a key, publish a proof, post to X, or send a Technocore write.
- The audit workflow is limited to the sandbox QA branch, uses `ubuntu-24.04` and `contents: read`, and is separate from the local-only E2E workflow. It has no secrets and cannot create a Vercel deployment.


## Latest sandbox candidate run

- Candidate commit: e53c959f5b848cc1221d91e8ad04f7246e351f03; Actions run 45492723838 on sandbox QA, with isolated local preview and mocked relay.
- SHA-256 source manifest passed. Focused security/localization regressions: 43/43 passed. Local preview HTTP checks: 7/7 passed. Chromium: 11/12 passed, 0 skipped. The sole failure was a stale expected value for #autoOut: the app correctly rendered its final localized “Fork-safe agent…” text, while the test expected an earlier “Project files…” string. This is a test expectation defect; no app behavior failure was established by that assertion.
- The Chromium run did not reach the new computed-style assertion because it stopped at the stale copy assertion. A follow-up now expects the rendered final TR/EN text and waits for the visible usage guide before asserting external CSS computes as 1px solid. The test is not green yet; one new isolated Actions run is required.
- Before the next push, the isolated candidate copy passed node --test scripts/ui-i18n.test.mjs (14/14), npm run test:security-regressions (43/43), npm run test:local-preview (7/7), Node syntax checks, and git diff --no-index --check for all seven changed files. The browser suite has not yet been rerun on the follow-up candidate.

## Current blockers

- Production browser acceptance remains incomplete. The prior audit confirmed a CSP violation because public/final-fixes.js injected runtime style under strict style-src 'self'. The candidate moves these rules to public/styles.css and adds a computed-style check while keeping CSP strict; production itself has not changed.
- The earlier English #autoOut alarm was an audit timing false positive: sandbox Chromium confirms the final value is localized after late UI initialization. Production audit still needs to wait for final UI/add-ons/stylesheets before counting the complete matrix.
- One early run showed a 404 at /api/relay; later runs did not reproduce it, and direct GET returned 405. Latest browser run showed no HTTP 4xx/5xx. Intentional navigation cancellations are reported separately.
- FLOP official Testnet/faucet/runtime status needs a fresh, source-by-source check due conflicting official pages.
- Do not claim shared rate limiting until multi-instance behavior is tested; the current risk remains at least medium until then.
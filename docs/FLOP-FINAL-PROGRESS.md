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
| 1 | Production read-only Chromium acceptance: home and `/flop`, 320/390/768/1440, TR/EN, console/network and links | FAIL — two production defects; test-candidate fixes prepared | Runs `45488127913`, `45489343811`, `45489952975`, `45490542505`. Latest run: 8/8 `/flop` locale/viewport checks passed with no horizontal overflow. Home: English `#autoOut` remains Turkish (`Projede ... hazır.`) at all widths; CSP violation at `public/final-fixes.js:52` because runtime code injects `<style>` under `style-src 'self'`. Other home failures were audit readiness: proof-import add-on and stylesheet were queried before settled. Direct relay GET returned 405 `POST only`; latest browser log had no HTTP 4xx/5xx. | Test sandbox candidate that translates `#autoOut` and moves usage-guide CSS to the existing external stylesheet without relaxing CSP; then finish production audit after the eventual validated release. |
| 2 | Isolated synthetic DID, encrypted backup/restore and negative cases | NOT STARTED | Existing sandbox E2E covered creation, JSON backup and same-DID restore; security regressions were previously 42/42. Need confirm wrong password, malformed backup, key mismatch and DID tampering coverage/results. | Review security test evidence; run only missing negative cases in isolated preview. |
| 3 | Relay shared rate-limit assessment | NOT STARTED | Known concern: memory counter may be per serverless instance. No change proposed or activated. | Inspect deployed `api/relay.js`, prove practical scope, research official Vercel shared-storage options and cost. |
| 4 | Current official FLOP Testnet readiness | NOT STARTED | Prior sources have conflicting status wording. No faucet claim, signature, inference, voucher or chain write performed. | Recheck official pages and use read-only RPC/genesis verification if a supported method is available. |
| 5 | Final regressions and release decision | NOT STARTED | Current production SHA is already READY. Avoid another deployment unless code changes and all gates pass. | Apply only verified necessary fixes; rerun affected tests before any further release. |

## Production audit safety contract

- Target is fixed to `https://reddragon-technocore.vercel.app`.
- Only GET/HEAD/OPTIONS requests pass through the audit's API guard; `/api/relay` POST requests are allowed only for `health`, `rooms`, `config`, `read`, and `kvGet`. All other API writes are intercepted and fail the test.
- The production matrix does not create a DID, expose a key, publish a proof, post to X, or send a Technocore write.
- The audit workflow is limited to the sandbox QA branch, uses `ubuntu-24.04` and `contents: read`, and is separate from the local-only E2E workflow. It has no secrets and cannot create a Vercel deployment.

## Current blockers

- Production browser matrix is not accepted yet. Run `45490542505` completed 8/16 checks: all 8 `/flop` locale/viewport entries passed; homepage entries exposed an untranslated message and CSP violation, while other failures came from querying dynamic add-ons/stylesheets before they had settled.
- Confirmed production issues: English home leaves `#autoOut` Turkish, and `public/final-fixes.js` line 52 injects a style element blocked by strict `style-src 'self'` CSP. Candidate patch is prepared in the sandbox source baseline: move guide CSS to existing `public/styles.css`, translate `#autoOut`, and add UI/source regressions. No main/prod files changed.
- One early run showed 404 at `/api/relay`; it did not recur, and direct GET returned expected 405. Latest browser network log had no 4xx/5xx. Canceled requests during deliberate page language reloads are separately recorded; one uncategorized asset cancellation remains for follow-up.
- FLOP official Testnet/faucet/runtime status needs a fresh, source-by-source check due conflicting official pages.
- Do not claim shared rate limiting until multi-instance behavior is tested; the current risk remains at least medium until then.

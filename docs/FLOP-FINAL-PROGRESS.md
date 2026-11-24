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
- Remote sandbox QA HEAD before this audit: `ad6ea38e4ac2d460976a069a994da6c90f2b0643`.
- Sandbox repository Vercel lookup returned zero connected projects. The only existing sandbox workflow listens for changes to `.github/workflows/flop-site-browser-audit.yml`; the production audit uses a separate workflow path.

## Phase log

| Phase | Scope | Status | Command / evidence | Next action |
|---|---|---|---|---|
| 0 | Verify current source and keep prior local work | PASS | GitHub `main` branch API confirms `aba62f...`; existing local checkout left untouched. | Continue against verified production and sandbox references. |
| 1 | Production read-only Chromium acceptance: home and `/flop`, 320/390/768/1440, TR/EN, console/network and links | FAIL — app localization and CSP defects | Runs `45488127913` and `45489343811`. Run 1 stopped at an audit false positive: safe `target=_blank rel=noreferrer` links were treated as unsafe. Run 2 passed that guard but found a Turkish dotless `ı` on English home (`checks: 0`); it also located a blocked inline-style CSP operation at `public/final-fixes.js:52`, where usage-guide styles are inserted as a `<style>` element despite `style-src 'self'`. The remote source confirms `ensureUsageGuideStyles()` performs this insertion. Direct read-only GET of `/api/relay` returned HTTP 405 `POST only`; run 2 did not record HTTP 4xx/5xx (`badResponses: []`), so the earlier 404 was not reproduced. | Continue the matrix while recording text context; prepare source fixes on an isolated candidate and test them before any production deployment. |
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

- Production browser matrix is still not complete; the latest run stopped at the English-language assertion before recording any viewport checks. The harness now reports offending text context and continues across matrix entries.
- Confirmed production issue: `public/final-fixes.js` line 52 injects a style element blocked by the site's strict `style-src 'self'` CSP. Fix via external stylesheet/class rules; do not weaken CSP.
- Run 1 showed a 404 at `/api/relay`, but the next run had no HTTP 4xx/5xx and an independent read-only GET returned 405. Treat as unreproduced; run 2 showed request aborts during page activity, not failed HTTP responses.
- FLOP official Testnet/faucet/runtime status needs a fresh, source-by-source check due conflicting official pages.
- Do not claim shared rate limiting until multi-instance behavior is tested; the current risk remains at least medium until then.

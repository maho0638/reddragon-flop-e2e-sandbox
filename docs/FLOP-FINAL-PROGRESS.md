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
| 1 | Production read-only Chromium acceptance: home and `/flop`, 320/390/768/1440, TR/EN, console/network and links | BLOCKED — harness correction and CSP diagnosis | Run `45488127913` on `ubuntu-24.04`, commit `5266f1e41e207d9686213110c692f1ab56f45c25`, stopped at the first English homepage assertion (`checks: 0`). Root cause: the link guard treated safe `target=_blank rel=noreferrer` links as unsafe because it only recognized `noopener`. Before that assertion, the browser logged a CSP inline-style error and a 404 for `/api/relay`; direct read-only Vercel GET of `/api/relay` returned the expected 405, so the 404 is not independently reproduced. | Correct the guard, record CSP source location, then rerun the read-only matrix. Do not deploy until confirmed app defects are fixed and all gates pass. |
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

- Production browser 320/390/768/1440 matrix and full machine-collected failed-request inventory await a harness-corrected isolated GitHub run. The first run did not test page assertions beyond the initial link guard.
- First-run Chromium recorded an inline-style CSP violation (`style-src 'self'`) and a 404 at `/api/relay`. The route independently returned 405 to a read-only GET a few minutes later. The 404 needs source/request-level confirmation; the CSP violation is a real browser signal and must be traced before acceptance.
- FLOP official Testnet/faucet/runtime status needs a fresh, source-by-source check due conflicting official pages.
- Do not claim shared rate limiting until multi-instance behavior is tested; the current risk remains at least medium until then.

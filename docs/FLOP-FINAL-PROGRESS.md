# RedDragon FLOP — Final Completion Progress

Updated: 2026-11-25 (Europe/Istanbul)

## Verified release checkpoint

- Main repository HEAD: `aba62f91fc6ae0fbdb6cb141fd1d8f8345238710`.
- Production deployment `dpl_66o9tmKCAkCCMG3By3bdCbeytyVV`: READY; production alias assigned; deployed commit matches main HEAD.
- Main validation run `45482782281`: success.
- Sandbox local-only Chromium run `45481646535`, candidate `ad6ea38e4ac2d460976a069a994da6c90f2b0643`: 12/12 passed with synthetic DID and mock relay.
- Previously reported main local checks: `npm test` 85/85; `npm run test:local-preview` 7/7.

## Recovery checkpoint

- The original local checkout is clean on `security/relay-write-scope-review` at `9bbc626d846cc03b85d0ee39aeb5500b66e682de`; it was not reset or overwritten. A separate candidate worktree is based on verified main `aba62f...` and holds uncommitted CSP/test changes only.
- Current sandbox QA candidate: `5b8bc9fb363ccbe99ebd0effae78b266eefb823b`; it is isolated from the main repository. Shared site files in the sandbox candidate were verified against main `aba62f...`; sandbox workflow and test harness changes remain separate.
- Sandbox repository Vercel lookup returned zero connected projects. The only existing sandbox workflow listens for changes to `.github/workflows/flop-site-browser-audit.yml`; the production audit uses a separate workflow path.
- This update records a source inspection only. No relay code or provider configuration changed; it does not start an Actions run.

## Phase log

| Phase | Scope | Status | Command / evidence | Next action |
|---|---|---|---|---|
| 0 | Verify current source and keep prior local work | PASS | GitHub commit search confirms current main `aba62f...`; existing stale local checkout was left untouched. | Continue against the verified production and sandbox references. |
| 1 | Production read-only Chromium acceptance: home and `/flop`, 320/390/768/1440, TR/EN, console/network and links | NOT ACCEPTED — deployed production still has the confirmed CSP violation; candidate fix now passed isolated strict-CSP Chromium | Historical production runs `45488127913`, `45489343811`, `45489952975`, `45490542505` did not complete the full homepage matrix. New isolated run `45505440409` passed all candidate locale/viewport checks under a local-preview server emitting the exact `style-src 'self'` policy; computed usage-guide CSS was present and no style-src violation event occurred. This is candidate evidence, not production evidence. | Fix and run the production audit harness after a validated release; capture console, failed requests, CSP events and final SHA. |
| 2 | Isolated synthetic DID, encrypted backup/restore and negative cases | PASS — sandbox candidate | Actions `45505440409`: security regressions 43/43; Chromium 12/12, 0 failed, 0 skipped. Logs show WebCrypto DID creation, `.json` encrypted backup download, correct restore, wrong-password rejection, tampered/corrupt backup rejection, DID equality, cryptographic key match, and mock relay flows. Only synthetic test data was used; no secret or real write. | Keep this passing coverage and rerun it only if relay/DID code changes. |
| 3 | Relay rate-limit architecture and source inspection | LIMITATION CONFIRMED; no implementation or provider config changed | Current `main/api/relay.js` at `aba62f...` uses an in-process `Map`: 60 reads / 10 writes per minute, keyed by client IP and category. It is per warm function instance, not a shared quota. It is not DID-based. Because rate limiting runs before action validation, an unknown action is counted as a read. Existing signedPost Ed25519 verification, namespace allowlist, DID fingerprint validation, size/type checks, and read-only legacy DID fallback remain present in the inspected source. Vercel confirms scaling across isolated instances; official options remain Upstash Redis or WAF. No Redis/WAF/provider was provisioned and no price-bearing service was enabled. | Work from a clean checkout matching `aba62f...`; design shared-store failure semantics and add mocked atomic/concurrency tests before considering any production change. Credentials/provider setup is a separate gate. |
| 4 | Current official FLOP Testnet readiness | NOT STARTED | No fresh source-by-source check completed in this phase. No faucet claim, signature, inference, voucher, or chain write performed. | Recheck official pages and use read-only RPC/genesis verification if an officially supported method is available. |
| 5 | Final regressions and release decision | NOT STARTED | Current production SHA is already READY. Avoid another deployment unless code changes and all gates pass. | Apply only verified necessary fixes; rerun affected tests before any further release. |

## Production audit safety contract

- Target is fixed to `https://reddragon-technocore.vercel.app`.
- Only GET/HEAD/OPTIONS requests pass through the audit's API guard; `/api/relay` POST requests are allowed only for `health`, `rooms`, `config`, `read`, and `kvGet`. All other API writes are intercepted and fail the test.
- The production matrix does not create a DID, expose a key, publish a proof, post to X, or send a Technocore write.
- The audit workflow is limited to the sandbox QA branch, uses `ubuntu-24.04` and `contents: read`, and is separate from the local-only E2E workflow. It has no secrets and cannot create a Vercel deployment.

## Latest sandbox candidate run

- Prior candidate `e53c959f5b848cc1221d91e8ad04f7246e351f03` / run `45492723838` had 11/12 Chromium tests because the test expected an intermediate `#autoOut` value.
- Commit `87acd7d27ccdd829925a331c5dd9c7ef0c091252` / run `45495345948` passed the baseline candidate: local preview 7/7, security regressions 43/43, Chromium 12/12.
- CSP strict-preview follow-up commit `5b8bc9fb363ccbe99ebd0effae78b266eefb823b` / run `45505440409` passed on `ubuntu-24.04`: SHA-256 manifest, local preview 7/7, security regressions 43/43, Chromium 12/12, 0 failed, 0 skipped. The local preview uses a `style-src 'self'` CSP matching `vercel.json`; Playwright observed the external guide CSS and zero style-src violations on home and `/flop` in the exercised locales/viewports. Relay was mocked; DID data was synthetic. This run does not establish production behavior.

## Current blockers

- Production browser acceptance remains incomplete. The production audit harness still needs reliable readiness waits and explicit console/network/CSP capture; the sandbox E2E is not production proof.
- Production still has the deployed `final-fixes.js` runtime style injection under `style-src 'self'`. The sandbox candidate removes it and verified external CSS under the strict policy; main has not been changed or deployed.
- The relay quota is per warm function instance and can multiply across instances; the key is IP/category rather than DID. Severity remains medium until a shared store or equivalent centrally enforced control is connected and verified.
- The first `/api/relay` 404 was not reproduced; direct GET returns expected 405. Latest sandbox run has no failed HTTP statuses.
- FLOP Testnet/faucet/runtime status still needs a fresh, source-by-source check before any readiness claim.

## Official rate-limit references

- Vercel Functions lifecycle and instance reuse/scaling: https://vercel.com/docs/functions
- Vercel Redis options (Vercel KV is no longer available for new projects): https://vercel.com/docs/redis
- Vercel WAF regional rate-limit counters and usage pricing: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- Upstash Redis Free plan and quotas: https://upstash.com/pricing/redis
- Upstash rate-limit command costs: https://upstash.com/docs/redis/sdks/ratelimit-ts/costs

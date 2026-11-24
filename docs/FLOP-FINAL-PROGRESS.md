# RedDragon FLOP — Final Completion Progress

Updated: 2026-11-25 (Europe/Istanbul)

## Verified release checkpoint

- Main repository HEAD: `aba62f91fc6ae0fbdb6cb141fd1d8f8345238710`.
- Production deployment `dpl_66o9tmKCAkCCMG3By3bdCbeytyVV`: READY; production alias assigned; deployed commit matches main HEAD.
- Main validation run `45482782281`: success.
- Sandbox local-only Chromium run `45481646535`, candidate `ad6ea38e4ac2d460976a069a994da6c90f2b0643`: 12/12 passed with synthetic DID and mock relay.
- Previously reported main local checks: `npm test` 85/85; `npm run test:local-preview` 7/7.

## Recovery checkpoint

- The available local main checkout is stale at `c56ba4ee45aafcf934acd369f7832656bf6da2ef` and contains 27 modified tracked files plus 4 untracked source/test files. It has not been reset or overwritten. Its local changes must not be considered tested against current production source until reconciled.
- Current sandbox QA checkpoint before this docs-only update: `87acd7d27ccdd829925a331c5dd9c7ef0c091252`; it is isolated from the main repository. Shared site files in the sandbox candidate were checked against main `aba62f...`; sandbox-only workflow/package/test files remain separate.
- Sandbox repository Vercel lookup returned zero connected projects. The only existing sandbox workflow listens for changes to `.github/workflows/flop-site-browser-audit.yml`; the production audit uses a separate workflow path.
- This update records a source inspection only. No relay code or provider configuration changed; it does not start an Actions run.

## Phase log

| Phase | Scope | Status | Command / evidence | Next action |
|---|---|---|---|---|
| 0 | Verify current source and keep prior local work | PASS | GitHub commit search confirms current main `aba62f...`; existing stale local checkout was left untouched. | Continue against the verified production and sandbox references. |
| 1 | Production read-only Chromium acceptance: home and `/flop`, 320/390/768/1440, TR/EN, console/network and links | NOT ACCEPTED — production still has a confirmed CSP violation; browser audit harness needs final synchronization | Production audit runs `45488127913`, `45489343811`, `45489952975`, `45490542505` failed or stopped early. All `/flop` locale/viewport checks passed in run 4; homepage checks did not finish because the harness read dynamic content before add-ons/stylesheets settled. Sandbox run `45495345948` verifies fixed CSS in the local candidate only; no production change yet. Earlier Turkish `#autoOut` finding was a timing false positive; final English text is localized. | Finish the audit harness, then run production acceptance after any validated release; do not treat sandbox E2E as production proof. |
| 2 | Isolated synthetic DID, encrypted backup/restore and negative cases | PASS — sandbox candidate | Actions `45495345948`: security regressions 43/43; Chromium 12/12, 0 failed, 0 skipped. Logs show Ed25519 DID/signature verification, `.json` backup download, correct restore, wrong-password rejection, corrupted JSON/ciphertext rejection, public-key/DID/fingerprint tampering rejection, and same DID after restore. E2E used synthetic identity and mocked relay; no secrets or real writes. | Keep this passing coverage and rerun it only if relay/DID code changes. |
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
- Follow-up commit `87acd7d27ccdd829925a331c5dd9c7ef0c091252` / run `45495345948` passed: SHA-256 manifest, local preview 7/7, security regressions 43/43, Chromium 12/12, 0 failed, 0 skipped. It tested local preview on 127.0.0.1 with mock relay and synthetic DID, not production.
- The corrected test waits for the final localized status and visible usage guide before checking computed external CSS (`1px solid`); X share clipboard checks, no-popup guard, TR/EN and all four widths passed.

## Current blockers

- Production browser acceptance remains incomplete. The production audit harness must wait for the final UI, proof-import add-on, and stylesheets; sandbox E2E is not production proof.
- Production still has a CSP violation: deployed `final-fixes.js` injects a runtime style under `style-src 'self'`. The sandbox candidate has removed that injection and verifies computed external CSS while leaving CSP strict; it is not deployed.
- The relay quota is per warm function instance and can multiply across instances; the key is IP/category rather than DID. Severity remains medium until a shared store or equivalent centrally enforced control is connected and verified.
- The first `/api/relay` 404 was not reproduced; direct GET returns expected 405. Latest sandbox run has no failed HTTP statuses.
- FLOP Testnet/faucet/runtime status still needs a fresh, source-by-source check before any readiness claim.

## Official rate-limit references

- Vercel Functions lifecycle and instance reuse/scaling: https://vercel.com/docs/functions
- Vercel Redis options (Vercel KV is no longer available for new projects): https://vercel.com/docs/redis
- Vercel WAF regional rate-limit counters and usage pricing: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- Upstash Redis Free plan and quotas: https://upstash.com/pricing/redis
- Upstash rate-limit command costs: https://upstash.com/docs/redis/sdks/ratelimit-ts/costs

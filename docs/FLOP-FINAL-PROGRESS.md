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
| 4 | Current official FLOP Testnet readiness | PARTIALLY VERIFIED | Official Testnet page and read-only RPC verified on 2026-11-25: FLOP Testnet, flop-testnet runtime spec 1014035, expected genesis. Faucet/scoring remain unannounced; Devnet faucet was not used. | Keep inference/settlement/faucet as external blockers; recheck before future live participation. |
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
- FLOP Testnet current status was rechecked from official sources and read-only RPC on 2026-11-25; scoring activation, Testnet faucet, inference, and settlement remain unverified.

## Official rate-limit references

- Vercel Functions lifecycle and instance reuse/scaling: https://vercel.com/docs/functions
- Vercel Redis options (Vercel KV is no longer available for new projects): https://vercel.com/docs/redis
- Vercel WAF regional rate-limit counters and usage pricing: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- Upstash Redis Free plan and quotas: https://upstash.com/pricing/redis
- Upstash rate-limit command costs: https://upstash.com/docs/redis/sdks/ratelimit-ts/costs


## Phase 3 follow-up — verified, no provider attached

- Targeted existing relay regression tests on the clean main-based candidate: `node --test scripts/relay.test.mjs scripts/relay-security-audit.test.mjs` — 18/18 passed, 0 failed/skipped. Tests mock upstream; no live Technocore writes occurred.
- Source inspection confirms `signedPost` verifies Ed25519 against the decoded DID key before forwarding. `kvGet` is read-only and fixed-host. The writable namespace allowlist blocks reserved namespaces, but `topic` and `profile` values can be overwritten by any caller who can reach the public relay; their writes have no signature/ownership proof. DID note fingerprint matching binds the key/value path but is not proof of private-key possession.
- Vercel's official request-header documentation says Vercel overwrites `X-Forwarded-For` and identifies `x-real-ip` as equivalent; the current code prefers `x-real-ip`, then the final forwarded value. This is appropriate only when requests reach Vercel directly; a customer-controlled proxy in front needs a trusted-proxy design.
- Official pricing checked 2026-11-25: Vercel WAF rate limiting has 1M included allowed requests on Hobby, then $0.50 per million (region dependent), one rule per Hobby project, IP/JA4 counting, fixed windows 10s–10min. It can provide shared edge IP limiting but cannot meet zero-budget assurance for unbounded overage or DID-keyed limits. Upstash Free currently lists 250 MB and 500K commands/month, then a card-backed upgrade switches resources to pay-as-you-go; no Upstash account/database/credentials were created.
- Result: distributed quota remains **unresolved / medium risk**. No code claims cross-instance protection. A real shared store is not connected, and mock multi-instance tests alone would not prove a live distributed limit. The public `topic/profile` overwrite surface needs an ownership-compatible protocol decision before tightening it without breaking existing clients.
- No rate-limit implementation or relay client change was made in this phase.


## Phase 3 implementation checkpoint — local candidate only

- Clean candidate base: main/production source `aba62f91fc6ae0fbdb6cb141fd1d8f8345238710`; no commit, push, PR, merge, or deployment was made.
- Local candidate adds Ed25519 authorization for RedDragon `profile/<fingerprint>` writes: signature covers UTF-8 `profile|<fingerprint>|<nonce>|<normalized-value>`; relay verifies key-derived DID fingerprint and signature before upstream. Client signs with its existing in-memory Ed25519 identity. DID note writes remain deterministic/public; `topic` stays world-writable per Technocore's explicit protocol.
- Added isolated negatives for unsigned profile overwrite, a different DID's profile key, and a modified signed value; valid signed profile and public topic compatibility remain covered. Browser acceptance captures the mock profile request and verifies its Ed25519 signature against the generated DID.
- Added two-module-instance test: the same IP receives 10 write attempts in each isolated counter before both return 429 (20 aggregate attempts), evidencing that module-local counters do not share quota. This is a simulation of separate instances, not a deployed Vercel measurement.
- Candidate verification after those changes: `npm test` 90/90; `npm run test:local-preview` 7/7; targeted relay + i18n + preview checks 37/37; `node --check` on modified JavaScript and `git diff --check` pass. All relay upstream tests use mocks.
- Real Chromium remained unavailable locally due the previously observed socket permission denial. The new exact-candidate sandbox Actions run 45509985101 now verifies the profile-authorization change.
- Remaining gates: decide the budget-safe approach for the still-unresolved shared rate limit; complete main-branch CI/review; deploy only after approval gates; then run production read-only Chromium. No claim of production readiness is made.


## Candidate completion update — 2026-11-25 (Europe/Istanbul)

- Exact candidate source commit on isolated sandbox QA: 3f3694ce3eae790f4a61db10ccc136033e5de3c0.
- GitHub Actions run [45509985101](https://github.com/maho0638/reddragon-flop-e2e-sandbox/actions/runs/45509985101): SUCCESS on ubuntu-24.04, contents: read; SHA-256 source manifest 63/63; local preview 7/7; security/regression tests 76/76; Chromium 12/12, 0 failed, 0 skipped.
- Browser logs confirm step-11 TR/EN and responsive layout, /flop languages and 320/390/768/1440 dimensions, synthetic DID creation and encrypted backup/restore, wrong/tampered backup rejection, X clipboard behavior without a popup, and mocked relay profile signature behavior. No real Technocore writes or secrets were used.
- This run validates the candidate in the sandbox, not production. Main remains aba62f91fc6ae0fbdb6cb141fd1d8f8345238710; no production deployment or main push occurred.
- Relay distributed rate limiting remains unresolved at medium risk because counters are per function instance and zero-budget constraints rule out a shared provider with billing risk. The isolated two-instance test is a simulation, not production proof.
- Testnet is live but unscored; direct read-only RPC confirms genesis/runtime 1014035. Testnet faucet, scoring activation, inference and settlement remain unverified; Devnet faucet was not used.
- No Vercel project matched the sandbox repository in the read-only project search. No Vercel deployment was created.

## Production acceptance triage — 2026-11-25 (Europe/Istanbul)

- Actions run [45513718128](https://github.com/maho0638/reddragon-flop-e2e-sandbox/actions/runs/45513718128), job `138867658897`, used Node v24.22.3 and `ubuntu-24.04`. The source SHA-256 checks and runtime installation passed. The UI audit failed; the separate CSP gate was skipped because the prior step failed.
- Actual log summary: production `/flop` passed 8/8 locale/viewport checks. Home had 8 check failures: four EN snapshots saw the static initial `#autoOut` phrase “Projede ve hazır.” before `final-fixes.js` applied its `load`-time translation; four TR snapshots ran before the dynamically added Public Proof button was present. This is consistent with the audit waiting only for `domcontentloaded` and a DID button, while the app applies these elements at `window.load` and later retries. No production app change was made.
- The two terminal asset failures (`language-stable.css` and `contribution-edit-fix.js`, both `net::ERR_ABORTED`) occurred because the next language navigation began before the previous document finished loading. The run recorded zero console errors, page errors, HTTP error responses, blocked writes and CSP events in the signals it sampled; however, CSP was sampled only on the final document and the independent CSP gate did not execute, so this run does not prove CSP cleanliness across transitions.
- Sandbox-only test harness updates: audit commit `348cb113b75d5d14a2b752791a38e62fb5442f2e`; CSP gate commit `2e71544fdd20c8ba7e6631621a79481c5e83dfd5`. The audit now waits for full load, stylesheets, exact TR/EN labels, Public Proof, and the translated `#autoOut`; it records CSP events from every document through a Playwright binding and retains all request failures in the summary. Expected transition cancellations are explicitly listed rather than discarded. The CSP gate also waits for completed document/style loading and logs all CSP/browser/network/write events.
- `node --check` passed for both updated sandbox scripts. No browser rerun has occurred yet. Next action: update only the production-audit workflow’s SHA-256 entries; its branch/path filters then start the one read-only production Chromium run.
- Relay shared quota remains unresolved / medium risk. Free Vercel WAF includes a finite request allowance but can incur overage charges and only keys by IP/JA4 on Hobby; Upstash Free has finite quotas and its upgrade path is billable. No provider, account, or credential was configured.
- Testnet preflight exit code 3 is the intentional policy result when the official page reports `live-unscored`: the script prints a read-only report with `scoringActivated:false`, then sets exit code 3 because the state is not `fully-integrated`. Network/source exceptions instead return code 1; CLI usage errors return 2. FLOP’s official Testnet page remains `live, unscored`, with no scoring activation block/date announced.


## Follow-up production audit — 2026-11-25

- Audit workflow run [45526389396](https://github.com/maho0638/reddragon-flop-e2e-sandbox/actions/runs/45526389396), candidate `7971c4bd88e3ed1f9e0f1d0cb854303502808d73`: the four viewport widths and two locales passed all 16 home/`/flop` UI checks. English `#autoOut`, Public Proof, translated labels and styles were ready before snapshots; the original timing failures did not recur.
- Overall job remained **FAIL** because production returned HTTP 404 for `/api/relay`, creating one browser console error. The log did not record method, action or namespace; the exact cause remains unverified. The workflow skipped its independent CSP gate after the UI audit failed. The audit’s transition-wide CSP collector reported an empty list; the separate CSP gate still needs to run.
- Run recorded 0 uncaught JavaScript exceptions, 0 blocked writes, and only navigation-cancelled `ERR_ABORTED` requests in its raw request-failure list. These cancellations remain present in the report and are not classified as endpoint success.
- Diagnostic harness commit `07ab7db9b22b200080dce1c29e23f8e0c32f5e9c` adds HTTP response method and, for POSTs to `/api/relay`, action and namespace to error records; it does not log request bodies, keys, or response bodies. Local `node --check` passed.
- Next: change the sandbox production-audit workflow so the independent CSP gate runs after an audit failure when Chromium installation succeeded; update only its script hash and workflow conditions. The next sandbox run is read-only against production. Do not change the app until the 404 action is known.
- Relay quota remains unresolved / medium risk. No shared quota service is configured and no billing-bearing change is authorized by the zero-budget constraint.
- Preflight exit code 3 is intentional for official `live-unscored`: the report has `scoringActivated:false`; exit 1 is source/network failure and exit 2 is CLI usage error. Official docs show no activation block/date.

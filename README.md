# RedDragon FLOP isolated browser QA

This public repository contains only the static RedDragon/FLOP site sources and isolated local test harness needed for Chromium acceptance testing. Relay writes are intercepted by Playwright mocks; the local preview hard-denies `/api/relay`. It contains no live automation workflows, credentials, secrets, or production deployment configuration.

The only Actions workflow is `FLOP isolated Chromium E2E`. It is limited to `qa/flop-e2e-9bbc626` and the workflow file path. It uses `ubuntu-24.04`, read-only repository permissions, synthetic DID fixtures, mocked relay responses, and source SHA-256 verification.

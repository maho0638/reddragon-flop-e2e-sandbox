import { spawnSync } from "node:child_process";

// Run these separately so clipboard permissions and browser state cannot collide.
// Continue to the second suite after a failure, then return a failing exit code.
const specs = [
  "scripts/browser/site-acceptance.spec.mjs",
  "scripts/browser/flop-ui.spec.mjs"
];
let failures = 0;
for (const spec of specs) {
  console.log(`\n=== ${spec} ===`);
  const result = spawnSync(process.execPath, ["--test", spec], {
    stdio: "inherit",
    env: process.env
  });
  if (result.error) {
    console.error(`FAIL ${spec}: ${result.error.message}`);
    failures++;
  } else if (result.status !== 0) {
    console.error(`FAIL ${spec}: exited with status ${result.status ?? "unknown"}`);
    failures++;
  }
}
if (failures > 0) process.exitCode = 1;

import { spawnSync } from "node:child_process";

// Run these separately so clipboard permissions and browser state cannot collide.
const specs = [
  "scripts/browser/site-acceptance.spec.mjs",
  "scripts/browser/flop-ui.spec.mjs"
];
for (const spec of specs) {
  console.log(`\n=== ${spec} ===`);
  const result = spawnSync(process.execPath, ["--test", spec], {
    stdio: "inherit",
    env: process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

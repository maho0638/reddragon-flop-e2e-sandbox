import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildFaucetMessage, isCanonicalNonce, makeSignedClaim, TESTNET_GENESIS, TESTNET_CLAIM_PATH, utf8Hex, validateClaimStatus } from "../public/flop-wallet-core.mjs";

const status = (now = Date.now()) => ({
  checkedAt: new Date(now).toISOString(),
  testnet: { state: "live-unscored" },
  services: {
    testnetRpc: { state: "identity-matched", genesis: TESTNET_GENESIS },
    faucet: { ready: true, state: "open", chain: { network: "testnet", genesisHash: TESTNET_GENESIS }, limits: { network: "testnet", state: "open", claimPath: TESTNET_CLAIM_PATH, asOf: new Date(now).toISOString(), stale: false, grantFlop: "10", cooldownSeconds: 86400 } }
  }
});

test("canonical nonce and exact UTF-8 claim message are enforced", () => {
  assert.equal(isCanonicalNonce("0"), true);
  assert.equal(isCanonicalNonce("1700000000000"), true);
  assert.equal(isCanonicalNonce("01"), false);
  assert.equal(isCanonicalNonce("1e3"), false);
  assert.equal(isCanonicalNonce("1".repeat(20)), false);
  assert.equal(buildFaucetMessage({ address: "5".repeat(48), nonce: "1700000000000" }), `flop-faucet-agent/v1|${TESTNET_GENESIS}|${"5".repeat(48)}|1700000000000`);
  assert.throws(() => buildFaucetMessage({ address: "not-an-ss58-address", nonce: "1" }), /SS58/);
  assert.throws(() => buildFaucetMessage({ address: "5".repeat(48), nonce: "01" }), /canonical/);
  assert.throws(() => buildFaucetMessage({ address: "5".repeat(48), nonce: "1", genesisHash: "0x" + "0".repeat(64) }), /genesis/);
  assert.equal(utf8Hex("ö"), "0xc3b6");
});

test("claim preparation requires fresh matching Testnet RPC, chain identity, open limits and signer", async () => {
  const now = Date.now();
  assert.deepEqual(validateClaimStatus(status(now), now).limits.grantFlop, "10");
  for (const mutate of [
    (s) => { s.services.testnetRpc.genesis = "0x" + "0".repeat(64); },
    (s) => { s.services.faucet.ready = false; },
    (s) => { s.services.faucet.limits.claimPath = "/fund"; },
    (s) => { s.services.faucet.limits.state = "closed"; },
    (s) => { s.stale = true; }
  ]) {
    const bad = status(now); mutate(bad);
    await assert.rejects(makeSignedClaim({ status: bad, account: { address: "5".repeat(48) }, signer: { signRaw: async () => ({ signature: "0x" + "a".repeat(128) }) }, nonce: "1700000000000", now }), /unverified|not verified|genesis|limits|stale/i);
  }
  await assert.rejects(makeSignedClaim({ status: status(now - 6 * 60_000), account: { address: "5".repeat(48) }, signer: { signRaw: async () => ({ signature: "0x" + "a".repeat(128) }) }, nonce: "1700000000000", now }), /stale/);
});

test("signed request uses extension raw-message signing and never submits a network request", async () => {
  const now = Date.now(); let signedArgs;
  const result = await makeSignedClaim({
    status: status(now), account: { address: "5".repeat(48) }, nonce: "1700000000000", now,
    signer: { signRaw: async (args) => { signedArgs = args; return { signature: `0x${"ab".repeat(64)}` }; } }
  });
  assert.equal(signedArgs.type, "bytes");
  assert.equal(signedArgs.data, utf8Hex(result.message));
  assert.equal(result.request.address, "5".repeat(48));
  assert.equal(result.request.nonce, "1700000000000");
  assert.equal(result.request.signature, `0x${"ab".repeat(64)}`);
  assert.equal(result.endpoint, `https://faucet.flop.network${TESTNET_CLAIM_PATH}`);
  assert.equal(result.method, "POST");
  assert.equal(Object.hasOwn(result, "response"), false);
  await assert.rejects(makeSignedClaim({ status: status(now), account: { address: "5".repeat(48) }, nonce: "1700000000000", now, signer: { signRaw: async () => ({ signature: "0x12" }) } }), /invalid 64-byte signature/);
});

test("wallet UI is bilingual, keeps secrets out of the page and does not submit the signed claim", async () => {
  const html = await readFile(new URL("../public/flop.html", import.meta.url), "utf8");
  const ui = await readFile(new URL("../public/flop-wallet.js", import.meta.url), "utf8");
  assert.match(html, /id="rdWalletProvider"/);
  assert.match(html, /id="rdWalletAccount" disabled/);
  assert.match(html, /id="rdPrepareClaim" type="button" disabled/);
  assert.match(html, /id="rdCopyClaim"/);
  assert.match(ui, /Connect selected wallet/);
  assert.match(ui, /Seçili cüzdanı bağla/);
  assert.match(ui, /This page never receives a seed or private key/);
  assert.match(ui, /Bu sayfa seed veya özel anahtar almaz/);
  assert.match(ui, /method: "GET"/);
  assert.doesNotMatch(ui, /fetch\s*\(\s*[`"']https:\/\/faucet\.flop\.network/);
  assert.doesNotMatch(ui, /signAndSend|secretKey|mnemonic|seed phrase/i);
});

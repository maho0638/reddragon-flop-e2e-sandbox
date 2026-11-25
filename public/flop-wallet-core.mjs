export const TESTNET_GENESIS = "0x918abd58fb16306b30ef3886514cfaebffecb4de43e82b6f8ec4795c43cfd800";
export const TESTNET_CLAIM_PATH = "/v1/testnet/agent-claims";
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{45,50}$/;

export function isCanonicalNonce(value) {
  return typeof value === "string" && /^(0|[1-9]\d{0,18})$/.test(value);
}

export function buildFaucetMessage({ address, nonce, genesisHash = TESTNET_GENESIS }) {
  if (typeof address !== "string" || !BASE58.test(address)) throw new Error("Select a valid SS58 wallet account first");
  if (!isCanonicalNonce(nonce)) throw new Error("Nonce must be a canonical decimal string of at most 19 digits");
  if (genesisHash !== TESTNET_GENESIS) throw new Error("Refusing to sign for a different Testnet genesis");
  return `flop-faucet-agent/v1|${genesisHash}|${address}|${nonce}`;
}

export function utf8Hex(value) {
  return `0x${Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function validateClaimStatus(data, now = Date.now()) {
  const checkedAt = Date.parse(data?.checkedAt || "");
  const faucet = data?.services?.faucet;
  const rpc = data?.services?.testnetRpc;
  if (!Number.isFinite(checkedAt) || checkedAt > now + 60_000 || now - checkedAt > 5 * 60_000 || data?.stale) throw new Error("Official status is stale or unverified; refresh and try again later");
  if (data?.testnet?.state !== "live-unscored") throw new Error("Official Testnet launch status is not verified");
  if (rpc?.state !== "identity-matched" || rpc?.genesis?.toLowerCase() !== TESTNET_GENESIS) throw new Error("Testnet RPC genesis does not match the official opening genesis");
  if (!faucet?.ready || faucet.state !== "open" || faucet.chain?.network !== "testnet" || faucet.chain?.genesisHash !== TESTNET_GENESIS) throw new Error("Testnet faucet identity or availability is not verified");
  const limits = faucet.limits;
  const limitsTime = Date.parse(limits?.asOf || "");
  if (!limits || limits.network !== "testnet" || limits.claimPath !== TESTNET_CLAIM_PATH || limits.state !== "open" || limits.stale || !Number.isFinite(limitsTime) || now - limitsTime > 5 * 60_000) throw new Error("Signed-claim limits are closed, stale, or unverified");
  return { checkedAt: new Date(checkedAt).toISOString(), limits };
}

export async function makeSignedClaim({ status, account, signer, nonce, now = Date.now() }) {
  const verified = validateClaimStatus(status, now);
  const message = buildFaucetMessage({ address: account?.address, nonce });
  if (!signer || typeof signer.signRaw !== "function") throw new Error("Wallet extension does not support raw-message signing");
  const result = await signer.signRaw({ address: account.address, data: utf8Hex(message), type: "bytes" });
  const signature = result?.signature;
  if (typeof signature !== "string" || !/^0x[0-9a-f]{128}$/i.test(signature)) throw new Error("Wallet returned an invalid 64-byte signature");
  return {
    endpoint: `https://faucet.flop.network${TESTNET_CLAIM_PATH}`,
    method: "POST",
    message,
    checkedAt: verified.checkedAt,
    request: { address: account.address, nonce, signature }
  };
}

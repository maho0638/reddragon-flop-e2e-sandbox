import { isCanonicalNonce, makeSignedClaim, TESTNET_GENESIS } from "/flop-wallet-core.mjs";

const $ = (id) => document.getElementById(id);
const accountsByKey = new Map();
const providersByName = new Map();
const nonceByAddress = new Map();
const COPY = {
  en: { intro: "This page never receives a seed or private key. Wallet signing happens in your extension. Testnet is unscored; test FLOP has no monetary value.", connect: "Connect selected wallet", provider: "Wallet extension", chooseProvider: "Choose extension", choosePrompt: "Choose an extension, then connect it.", account: "Account", connectFirst: "Connect a wallet first", prepare: "Prepare signed claim", checking: "Checking official Testnet identity and faucet limits…", notReady: "Faucet or RPC status is not verified. Signing is disabled.", ready: "Testnet identity and signed claim route verified. Current grant limit", noExtension: "No compatible Polkadot wallet extension was found.", denied: "Wallet access was not granted or no accounts were shared.", noSigner: "The selected account has no raw-message signer.", signFailed: "Wallet signing was not completed.", prepared: "Signed JSON prepared only. Nothing was sent to FLOP. Submit manually with the official client; an included transaction is not final until finalized on-chain.", copy: "Copy request JSON", copied: "Request JSON copied.", copyFailed: "Clipboard unavailable; select and copy the text manually.", safety: "The site does not submit a faucet request. The official faucet did not advertise browser CORS support in a read-only preflight, so this page prepares the exact signed JSON request for you to submit through your own client. No automatic retry occurs.", payload: "Signed request JSON", instructions: "Official claim instructions ↗" },
  tr: { intro: "Bu sayfa seed veya özel anahtar almaz. İmzalama cüzdan uzantınızda yapılır. Testnet puanlamasızdır; test FLOP'un parasal değeri yoktur.", connect: "Seçili cüzdanı bağla", provider: "Cüzdan uzantısı", chooseProvider: "Uzantı seç", choosePrompt: "Bir uzantı seç, sonra bağla.", account: "Hesap", connectFirst: "Önce cüzdan bağla", prepare: "İmzalı talep hazırla", checking: "Resmî Testnet kimliği ve faucet limitleri kontrol ediliyor…", notReady: "Faucet veya RPC durumu doğrulanamadı. İmzalama kapalı.", ready: "Testnet kimliği ve imzalı claim yolu doğrulandı. Güncel talep sınırı", noExtension: "Uyumlu Polkadot cüzdan uzantısı bulunamadı.", denied: "Cüzdan erişimi verilmedi veya hesap paylaşılmadı.", noSigner: "Seçilen hesapta ham mesaj imzalayıcısı yok.", signFailed: "Cüzdan imzalama işlemi tamamlanmadı.", prepared: "Yalnızca imzalı JSON hazırlandı. FLOP'a hiçbir şey gönderilmedi. Resmî istemciyle elle gönderin; dahil edilmiş işlem, zincirde kesinleşmeden sonlanmış sayılmaz.", copy: "Talep JSON'unu kopyala", copied: "Talep JSON'u panoya kopyalandı.", copyFailed: "Pano kullanılamıyor; metni elle seçip kopyalayın.", safety: "Bu sayfa faucet talebini göndermez. Salt okunur CORS ön kontrolünde resmî faucet tarayıcı CORS desteği bildirmedi; bu nedenle sayfa imzalı JSON'u hazırlar, siz kendi istemcinizle gönderirsiniz. Otomatik tekrar yapılmaz.", payload: "İmzalı talep JSON'u", instructions: "Resmî talep yönergesi ↗" }
};
const lang = () => { try { return (localStorage.getItem("reddragon-lang") || navigator.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en"; } catch { return String(navigator.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en"; } };
const say = (key) => COPY[lang()][key];
function message(text, state = "") { const el = $("rdWalletStatus"); if (el) { el.textContent = text; el.dataset.state = state; } }
function nonceFor(address) {
  if (nonceByAddress.has(address)) return nonceByAddress.get(address);
  const key = `rd-flop-claim-nonce:${address}`;
  try { const saved = sessionStorage.getItem(key); if (isCanonicalNonce(saved)) { nonceByAddress.set(address, saved); return saved; } } catch { /* Keep the nonce in memory when browser storage is disabled. */ }
  const value = String(Date.now());
  nonceByAddress.set(address, value);
  try { sessionStorage.setItem(key, value); } catch { /* The in-memory value remains stable for this tab. */ }
  return value;
}

async function readStatus() {
  const response = await fetch("/api/flop-status", { method: "GET", headers: { accept: "application/json" }, cache: "no-store", credentials: "same-origin", redirect: "error" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function renderLanguage() {
  const c = COPY[lang()];
  $("rdWalletIntro").textContent = c.intro;
  $("rdWalletConnect").textContent = c.connect;
  $("rdWalletProvider").setAttribute("aria-label", c.provider);
  $("rdPrepareClaim").textContent = c.prepare;
  $("rdWalletSafety").textContent = c.safety;
  $("rdClaimMessage").previousElementSibling.firstChild.textContent = `${lang() === "tr" ? "İmzalanan mesaj" : "Signed message"}: `;
  $("rdClaimPayload").previousElementSibling.textContent = c.payload;
  $("rdCopyClaim").textContent = c.copy;
  $("rdClaimOutput").querySelector("a").textContent = c.instructions;
  $("rdWalletAccount").setAttribute("aria-label", c.account);
  if (!accountsByKey.size) { const option = $("rdWalletAccount").options[0]; if (option) option.textContent = c.connectFirst; }
  if (!providersByName.size) { const option = $("rdWalletProvider").options[0]; if (option) option.textContent = c.chooseProvider; }
  if (!$("rdClaimOutput").hidden) $("rdClaimState").textContent = c.prepared;
}

async function refreshStatus() {
  message(say("checking"));
  try {
    const data = await readStatus();
    const timestamp = Date.parse(data?.checkedAt || "");
    const ok = data?.services?.faucet?.ready === true && data?.services?.testnetRpc?.state === "identity-matched" && data?.testnet?.state === "live-unscored" && Number.isFinite(timestamp) && Date.now() - timestamp <= 5 * 60_000 && data?.services?.testnetRpc?.genesis === TESTNET_GENESIS;
    $("rdPrepareClaim").disabled = !ok || accountsByKey.size === 0;
    const limit = data?.services?.faucet?.limits;
    message(ok && limit ? `${say("ready")}: ${limit.grantFlop} FLOP / ${limit.cooldownSeconds}s` : say("notReady"), ok ? "ready" : "blocked");
    return ok ? data : null;
  } catch {
    $("rdPrepareClaim").disabled = true;
    message(say("notReady"), "blocked");
    return null;
  }
}

async function connectWallet() {
  const injected = globalThis.injectedWeb3;
  if (!injected || typeof injected !== "object") { message(say("noExtension"), "blocked"); return; }
  const providerSelect = $("rdWalletProvider");
  if (!providerSelect.value) {
    providersByName.clear(); providerSelect.replaceChildren();
    for (const [name, provider] of Object.entries(injected)) if (typeof provider?.enable === "function") providersByName.set(name, provider);
    if (!providersByName.size) { const option = document.createElement("option"); option.value = ""; option.textContent = say("chooseProvider"); providerSelect.append(option); providerSelect.disabled = true; message(say("noExtension"), "blocked"); return; }
    const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = say("chooseProvider"); providerSelect.append(placeholder);
    for (const name of providersByName.keys()) { const option = document.createElement("option"); option.value = name; option.textContent = name; providerSelect.append(option); }
    providerSelect.disabled = false; message(say("choosePrompt")); return;
  }
  const select = $("rdWalletAccount");
  accountsByKey.clear();
  const found = [];
  try {
    const source = providerSelect.value;
    const extension = await providersByName.get(source)?.enable("RedDragon FLOP");
    const accounts = await extension?.accounts?.get?.();
    for (const account of accounts || []) {
      if (typeof account?.address !== "string" || !account.address || typeof account?.meta?.source !== "string") continue;
      const key = `${account.meta.source}:${account.address}`;
      accountsByKey.set(key, { account, signer: extension.signer, source });
      found.push({ key, account });
    }
  } catch { /* The selected extension can decline or be temporarily unavailable. */ }
  select.replaceChildren();
  for (const { key, account } of found) {
    const option = document.createElement("option"); option.value = key;
    option.textContent = `${account.meta.name || account.address} · ${account.meta.source} · ${account.address}`;
    select.append(option);
  }
  select.disabled = found.length === 0;
  if (!found.length) { const option = document.createElement("option"); option.value = ""; option.textContent = say("connectFirst"); select.append(option); message(say("denied"), "blocked"); return; }
  await refreshStatus();
}

async function prepareClaim() {
  const selected = accountsByKey.get($("rdWalletAccount").value);
  if (!selected) { message(say("denied"), "blocked"); return; }
  const signer = selected.signer;
  if (typeof signer?.signRaw !== "function") { message(say("noSigner"), "blocked"); return; }
  const status = await refreshStatus();
  if (!status) return;
  const account = selected.account;
  const nonce = nonceFor(account.address);
  const button = $("rdPrepareClaim"); button.disabled = true;
  try {
    const signed = await makeSignedClaim({ status, account, signer, nonce });
    $("rdClaimPayload").value = JSON.stringify(signed.request, null, 2);
    $("rdClaimMessage").textContent = signed.message;
    $("rdClaimOutput").hidden = false;
    $("rdClaimState").textContent = say("prepared");
  } catch (error) {
    message(error?.message === "Wallet extension does not support raw-message signing" ? say("noSigner") : say("signFailed"), "blocked");
  } finally {
    button.disabled = false;
  }
}

$("rdWalletConnect")?.addEventListener("click", connectWallet);
$("rdWalletProvider")?.addEventListener("change", () => { accountsByKey.clear(); $("rdWalletAccount").replaceChildren(); $("rdWalletAccount").disabled = true; $("rdPrepareClaim").disabled = true; });
$("rdWalletAccount")?.addEventListener("change", async () => { await refreshStatus(); $("rdClaimOutput").hidden = true; });
$("rdPrepareClaim")?.addEventListener("click", prepareClaim);
$("rdCopyClaim")?.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("rdClaimPayload").value); $("rdClaimState").textContent = say("copied"); }
  catch { $("rdClaimPayload").focus(); $("rdClaimPayload").select(); $("rdClaimState").textContent = say("copyFailed"); }
});
$("rdFlopLanguage")?.addEventListener("change", renderLanguage);
renderLanguage();
refreshStatus();

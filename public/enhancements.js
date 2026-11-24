const cfg = window.APP_CONFIG || {};
const SITE_URL = cfg.siteUrl || location.origin;
const X_HANDLE = cfg.xHandle || "@lionmousse";
const X_USER = X_HANDLE.replace(/^@/, "");
const REPO_URL = cfg.githubRepoUrl || "https://github.com/maho0638/reddragon-technocore";
const MEDIUM_URL = cfg.mediumUrl || "https://medium.com/@ayazunal450";
const MEDIUM_WRITE_URL = cfg.mediumWriteUrl || "https://medium.com/new-story";

const $ = (s) => document.querySelector(s);
const enhancementText = (key, vars = {}) => window.RD_I18N.t(`patch.${key}`, vars);

function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 2800);
}

async function copy(value, msg = "Kopyalandı") {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(msg);
}

function openExternal(url) {
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (w) w.opener = null;
}

function xIntent(text) {
  openExternal(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`);
}

function currentProof() {
  try { return JSON.parse($("#proofText")?.value || "{}"); } catch { return {}; }
}

function currentDid() {
  const proofDid = currentProof()?.did;
  const domDid = $("#vaultDid")?.textContent?.trim();
  return proofDid || (domDid && domDid !== "—" ? domDid : "");
}

function currentContribution() {
  const p = currentProof();
  return p?.contribution || {};
}

function recordText() {
  const r = currentProof()?.contribution?.record;
  if (r?.seq) return `${r.room || "technocore"} #${r.seq}`;

  const vaultSeq = $("#vaultContrib")?.textContent?.trim();
  if (vaultSeq && vaultSeq !== "—" && /^\d+$/.test(vaultSeq)) return `technocore #${vaultSeq}`;

  const out = $("#contribOut")?.textContent || "";
  const m = out.match(/seq\s+(\d+)/i);
  return m ? `technocore #${m[1]}` : "";
}

function siteShareText() {
  return enhancementText("siteShareDraft", { site: SITE_URL, handle: X_HANDLE });
}

function proofShareText() {
  const did = currentDid();
  if (!did) return siteShareText();
  const proof = currentProof();
  const record = proof?.contribution?.record || {};
  return window.RD_I18N.t("app.xShareDraft", {
    handle: X_HANDLE,
    did,
    url: proof?.contribution?.url || "",
    room: record.room || "",
    seq: record.seq || ""
  });
}

function threadText() {
  const did = currentDid() || "YOUR_DID";
  const c = currentContribution();
  const record = recordText() || "pending";
  const t1 = `1/3 Built my Technocore identity with RedDragon Agent Lab 🐉\n\nBrowser-local DID + signed activity + secure GitHub Actions setup.\n\n${SITE_URL}\n\n${X_HANDLE} @flop_labs #Technocore`;
  const t2 = `2/3 My public Technocore DID:\n\n${did}\n\nThe private key stays local and is never included in public proof.`;
  const t3 = `3/3 Signed contribution: ${record}${c?.title ? `\nContribution: ${c.title}` : ""}${c?.url ? `\n${c.url}` : ""}\n\nBuilt with RedDragon Agent Lab · ${X_HANDLE}`;
  return [t1, t2, t3].join("\n\n---\n\n");
}

function mediumDraft() {
  const did = currentDid() || "YOUR_DID";
  const c = currentContribution();
  const record = recordText() || "pending";
  return `RedDragon Technocore Agent Lab — my signed agent identity\n\nI used RedDragon Technocore Agent Lab to create a separate Ed25519 did:key identity in the browser, keep an encrypted local backup, and publish signed Technocore activity.\n\nPublic DID\n${did}\n\nSigned contribution\n${record}\n\n${c?.title ? `Contribution\n${c.title}\n` : ""}${c?.url ? `${c.url}\n\n` : ""}Tool\n${SITE_URL}\n\nSource code\n${REPO_URL}\n\nProject account\n${X_HANDLE}\n\nSecurity note: the wallet seed phrase is never required. The Technocore private key is not included in this article or in public proof.`;
}

function addTopLinks() {
  const top = $(".top-actions");
  if (!top) return;
  if (!$("#githubLink")) {
    const a = document.createElement("a");
    a.id = "githubLink";
    a.href = REPO_URL;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = "GitHub";
    top.insertBefore(a, top.querySelector(".live"));
  }
  if (!$("#mediumLink")) {
    const a = document.createElement("a");
    a.id = "mediumLink";
    a.href = MEDIUM_URL;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = "Medium";
    top.insertBefore(a, top.querySelector(".live"));
  }
}

function addHeroSocial() {
  const host = $(".hero-actions");
  if (!host || $("#rdSocialStrip")) return;
  const en = window.RD_I18N.language() === "en";
  const strip = document.createElement("div");
  strip.id = "rdSocialStrip";
  strip.className = "rd-social-strip";
  strip.innerHTML = `
    <button type="button" id="rdShareSiteX"></button>
    <a href="${REPO_URL}" target="_blank" rel="noreferrer">★ GitHub</a>
    <a href="${REPO_URL}/fork" target="_blank" rel="noreferrer">⑂ Fork</a>
    <a href="${MEDIUM_URL}" target="_blank" rel="noreferrer">M Medium</a>
    <a href="https://x.com/${X_USER}" target="_blank" rel="noreferrer"></a>`;
  host.after(strip);
  $("#rdShareSiteX").textContent = en ? "𝕏 Share this site" : "𝕏 Siteyi paylaş";
  strip.querySelector('a[href*="x.com/"]').textContent = en ? `Follow ${X_HANDLE}` : `${X_HANDLE} hesabını takip et`;
  $("#rdShareSiteX").onclick = () => xIntent(siteShareText());
}

function upgradeProofShare() {
  const card = document.querySelector('[data-step="10"]');
  if (!card || $("#rdSharePanel")) return;
  const en = window.RD_I18N.language() === "en";
  const panel = document.createElement("div");
  panel.id = "rdSharePanel";
  panel.className = "rd-share-panel";
  panel.innerHTML = `
    <h3></h3>
    <p></p>
    <div class="rd-share-grid">
      <button type="button" id="rdProofX"></button>
      <button type="button" id="rdThreadCopy"></button>
      <button type="button" id="rdMediumCopy"></button>
      <a href="${MEDIUM_WRITE_URL}" target="_blank" rel="noreferrer"></a>
    </div>`;
  card.appendChild(panel);
  panel.querySelector("h3").textContent = en ? "Share · everyone uses their own account" : "Paylaş · herkes kendi hesabından";
  panel.querySelector("p").textContent = en
    ? `The X button opens the composer for the X account currently signed in to this browser. The project account is mentioned as ${X_HANDLE}. For Medium, copy the draft and publish it from your own account.`
    : `X butonu bu tarayıcıda açık olan X hesabının paylaşım ekranını açar. Metinde ${X_HANDLE} geçtiği için proje hesabı mention alır. Medium için taslağı kopyalayıp kendi hesabında yayınlayabilirsin.`;
  $("#rdProofX").textContent = en ? "𝕏 Share DID + proof" : "𝕏 DID + kanıt paylaş";
  $("#rdThreadCopy").textContent = en ? "Copy 3-post thread" : "3 gönderilik diziyi kopyala";
  $("#rdMediumCopy").textContent = en ? "Copy Medium draft" : "Medium taslağını kopyala";
  panel.querySelector(".rd-share-grid a").textContent = en ? "Open a new Medium story" : "Medium'da yeni yazı aç";
  $("#rdProofX").onclick = () => xIntent(proofShareText());
  $("#rdThreadCopy").onclick = () => copy(threadText(), "3 tweetlik dizi kopyalandı");
  $("#rdMediumCopy").onclick = () => copy(mediumDraft(), "Medium taslağı kopyalandı");

  const old = $("#xShare");
  if (old) {
    const replacement = old.cloneNode(true);
    replacement.textContent = en ? "Share on X" : "X'te paylaş";
    old.replaceWith(replacement);
    replacement.onclick = () => copy(proofShareText(), window.RD_I18N.t("app.xTextCopied"));
  }
}

function securePrivateKeyCopy() {
  const btn = $("#copyKeySecret");
  if (!btn || btn.dataset.secured === "1") return;
  btn.dataset.secured = "1";
  btn.addEventListener("click", (event) => {
    const ok = confirm("Private key GitHub Secret'e yapıştırmak için panoya kopyalanacak. Mesaj, X, Medium, issue veya public dosyaya yapıştırma. Devam edilsin mi?");
    if (!ok) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

function agentRepoUrl() {
  const user = $("#rdGithubUser")?.value.trim().replace(/^@/, "");
  const repo = $("#rdGithubRepo")?.value.trim();
  if (!user || !repo || !/^[A-Za-z0-9-]+$/.test(user) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return "";
  return `https://github.com/${user}/${repo}`;
}

function setupChecklist() {
  const base = agentRepoUrl();
  return `RedDragon 7/24 Technocore Agent — güvenli hızlı kurulum\n\n1) Fork: ${REPO_URL}/fork\n2) Fork reponda Settings → Secrets and variables → Actions\n3) Yalnızca şu secret'i ekle:\n   TECHNOCORE_PRIVATE_KEY_PKCS8_B64 = RedDragon sitesindeki “Private key'i kopyala” değeri\n4) Actions → RedDragon Technocore Agent → Enable/Run workflow\n5) İlk run yeşil olmalı.\n\n${base ? `Senin repo: ${base}\nSecrets: ${base}/settings/secrets/actions\nActions: ${base}/actions/workflows/technocore-agent.yml\n\n` : ""}DID private key'den otomatik türetilir; ikinci bir DID secret'i gerekmez.\nSigned post yalnızca iki günlük cron penceresinde çalışır; heartbeat yaklaşık 30 dakikada bir kontrol edilir.\n\nGüvenlik: Site GitHub şifresi, tokeni veya wallet seed phrase istemez. Private key URL'ye, public GitHub dosyasına veya RedDragon sunucusuna gönderilmez.`;
}

function upgradeAgentSetup() {
  const card = document.querySelector('[data-step="11"]');
  if (!card || $("#rdQuickSetup")) return;

  const warning = card.querySelector(".warning-box span");
  if (warning) warning.textContent = window.RD_I18N.t("app.agentCadence");

  const didSecretBtn = $("#copyDidSecret");
  if (didSecretBtn?.parentElement) didSecretBtn.parentElement.classList.add("rd-hidden");
  const secretsTitle = [...card.querySelectorAll("h3")].find((h) => h.textContent.includes("Repository Secrets"));
  if (secretsTitle) secretsTitle.textContent = "Repository Secret · sadece 1 tane";

  const oldGuide = $("#copyAutoGuide");
  if (oldGuide) {
    const replacement = oldGuide.cloneNode(true);
    replacement.textContent = "Hızlı kurulum listesini kopyala";
    oldGuide.replaceWith(replacement);
    replacement.onclick = () => copy(setupChecklist(), "Kurulum listesi kopyalandı");
  }

  const repoBtn = $("#repoBtn");
  if (repoBtn) {
    repoBtn.href = REPO_URL;
    repoBtn.target = "_blank";
    repoBtn.rel = "noreferrer";
    repoBtn.textContent = "GitHub repo'yu aç";
    repoBtn.classList.remove("disabled-link");
  }

  const autoOut = $("#autoOut");
  if (autoOut) autoOut.textContent = "Ajan fork-safe: DID private key'den otomatik türetilir. Kullanıcı yalnızca private-key GitHub Secret'ini ekler.";

  const panel = document.createElement("div");
  panel.id = "rdQuickSetup";
  panel.className = "rd-quick-setup";
  panel.innerHTML = `
    <h3>Hızlı güvenli ajan kurulumu</h3>
    <p>Hiç kod bilmeden: repoyu forkla → tek secret'i ekle → Actions'ı çalıştır. Site GitHub tokeni istemez ve private key'i hiçbir URL'ye koymaz.</p>
    <div class="rd-quick-form">
      <input id="rdGithubUser" autocomplete="off" placeholder="GitHub kullanıcı adın" />
      <input id="rdGithubRepo" autocomplete="off" value="reddragon-technocore" placeholder="Fork repo adı" />
    </div>
    <div class="rd-quick-actions">
      <a href="${REPO_URL}/fork" target="_blank" rel="noreferrer">1 · Repoyu Forkla</a>
      <button type="button" id="rdOpenSecrets">2 · Secret sayfasını aç</button>
      <button type="button" id="rdCopyPrivate">3 · Private key'i kopyala</button>
      <button type="button" id="rdOpenActions">4 · Actions'ı aç / test et</button>
    </div>
    <div class="rd-security-note"><b>Güvenlik kuralı</b>RedDragon GitHub şifreni, tokenini veya wallet seed phrase'ini istemez. Private key'i yalnızca kendi GitHub repondaki <b>Actions Secret</b> alanına sen yapıştırırsın. Private key RedDragon sunucusuna gönderilmez ve public GitHub dosyalarına yazılmaz.</div>`;
  card.appendChild(panel);

  $("#rdGithubUser").value = localStorage.getItem("rd-github-user") || "";
  $("#rdGithubUser").addEventListener("input", (e) => localStorage.setItem("rd-github-user", e.target.value.trim()));
  $("#rdGithubRepo").addEventListener("input", (e) => localStorage.setItem("rd-github-repo", e.target.value.trim()));
  const savedRepo = localStorage.getItem("rd-github-repo");
  if (savedRepo) $("#rdGithubRepo").value = savedRepo;

  $("#rdOpenSecrets").onclick = () => {
    const base = agentRepoUrl();
    if (!base) return toast("Önce GitHub kullanıcı adını yaz");
    openExternal(`${base}/settings/secrets/actions`);
  };
  $("#rdCopyPrivate").onclick = () => {
    const btn = $("#copyKeySecret");
    if (!btn || btn.disabled) return toast("Önce DID oluştur veya yedeği geri yükle");
    btn.click();
  };
  $("#rdOpenActions").onclick = () => {
    const base = agentRepoUrl();
    if (!base) return toast("Önce GitHub kullanıcı adını yaz");
    openExternal(`${base}/actions/workflows/technocore-agent.yml`);
  };
}

function addMediumProfileCard() {
  const profile = $(".profile-card");
  if (!profile || $("#rdMediumCard")) return;
  const a = document.createElement("a");
  a.id = "rdMediumCard";
  a.className = "profile-card rd-medium-card";
  a.href = MEDIUM_URL;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.innerHTML = `<span>M</span><div><b>Medium</b><small>@ayazunal450 · RedDragon articles</small></div>`;
  profile.after(a);
}

function upgradeFooter() {
  const links = $("footer div");
  if (!links) return;
  if (![...links.querySelectorAll("a")].some((a) => a.href === REPO_URL)) {
    const g = document.createElement("a");
    g.href = REPO_URL; g.target = "_blank"; g.rel = "noreferrer"; g.textContent = "GitHub"; links.appendChild(g);
  }
  if (![...links.querySelectorAll("a")].some((a) => a.href === MEDIUM_URL)) {
    const m = document.createElement("a");
    m.href = MEDIUM_URL; m.target = "_blank"; m.rel = "noreferrer"; m.textContent = "Medium"; links.appendChild(m);
  }
}

async function checkRelay() {
  const live = $(".live");
  if (!live) return;
  try {
    const r = await fetch("/api/relay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "health" }),
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new Error(String(r.status));
    live.lastChild.textContent = enhancementText("relayOnline");
    live.classList.add("rd-status-ok");
  } catch {
    live.lastChild.textContent = enhancementText("relayOffline");
    live.classList.add("rd-status-bad");
  }
}

function friendlyCapacityErrors() {
  const ids = ["didNoteOut", "publicRoomOut", "privateRoomOut", "styleOut"];
  for (const id of ids) {
    const node = document.getElementById(id);
    if (!node) continue;
    const obs = new MutationObserver(() => {
      const text = node.textContent || "";
      if (node.querySelector(".rd-capacity-help")) return;
      let msg = "";
      if (/note limit reached/i.test(text)) msg = enhancementText("capacityNote");
      if (/room limit reached/i.test(text)) msg = enhancementText("capacityRoom");
      if (/404/.test(text)) msg = enhancementText("capacity404");
      if (msg) {
        const s = document.createElement("span");
        s.className = "rd-capacity-help";
        s.textContent = msg;
        node.appendChild(s);
      }
    });
    obs.observe(node, { childList: true, characterData: true, subtree: true });
  }
}

window.addEventListener("load", () => {
  addTopLinks();
  addHeroSocial();
  upgradeProofShare();
  securePrivateKeyCopy();
  upgradeAgentSetup();
  addMediumProfileCard();
  upgradeFooter();
  friendlyCapacityErrors();
  checkRelay();
  window.dispatchEvent(new Event("rd:dynamicuiready"));
});

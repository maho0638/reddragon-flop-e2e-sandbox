import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ORIGIN = process.env.SITE_ACCEPTANCE_ORIGIN || "https://reddragon-technocore.vercel.app";
const origin = new URL(ORIGIN);
assert.equal(origin.protocol, "https:", "production audit requires HTTPS");
assert.equal(origin.hostname, "reddragon-technocore.vercel.app", "audit is restricted to the verified production host");

const sizes = [
  { name: "320", width: 320, height: 740, mobile: true },
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "768", width: 768, height: 900, mobile: true },
  { name: "1440", width: 1440, height: 900, mobile: false }
];
const readOnlyRelayActions = new Set(["health", "rooms", "config", "read", "kvGet"]);
const checks = [];
const checkFailures = [];
const signals = { consoleErrors: [], cspViolations: [], pageErrors: [], failedRequests: [], badResponses: [], blockedWrites: [] };

function recordCheck(name, detail) {
  checks.push({ name, ...detail });
  console.log(`[PRODUCTION-AUDIT] PASS ${name} ${JSON.stringify(detail)}`);
}

function assertLocalized(result, route, locale) {
  assert.equal(result.lang, locale, `${route}/${locale}: document language`);
  assert.ok(result.clientWidth > 0, `${route}/${locale}: page must have a layout viewport`);
  assert.ok(result.scrollWidth <= result.clientWidth + 1, `${route}/${locale}: horizontal overflow ${JSON.stringify(result.overflow)}`);
  assert.deepEqual(result.invalidLinks, [], `${route}/${locale}: unsafe link targets`);
  if (locale === "en") {
    assert.deepEqual(result.turkishCharacters, [], `${route}/${locale}: Turkish characters remain in English UI: ${JSON.stringify(result.turkishCharacterContexts)}`);
  } else {
    assert.equal(result.untranslatedEnglish, null, `${route}/${locale}: English phrase remains: ${result.untranslatedEnglish}`);
  }
}

async function inspect(page, route, locale, size, checkInternalLinks) {
  const snapshot = await page.evaluate(({ route, locale }) => {
    const root = document.documentElement;
    const bodyCopy = document.body.cloneNode(true);
    bodyCopy.querySelectorAll("script,style,noscript,code,pre,input,textarea,select,[hidden],[aria-hidden='true']").forEach(el => el.remove());
    const copy = (bodyCopy.innerText || bodyCopy.textContent || "").replace(/\s+/g, " ").trim();
    const rect = element => {
      const r = element?.getBoundingClientRect();
      return r && { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) };
    };
    const warning = document.querySelector("[data-step='11'] .warning-box");
    const title = warning?.querySelector("b");
    const warningCopy = warning?.querySelector("span");
    const links = [...document.querySelectorAll("a[href]")].filter(a => a.getClientRects().length).map(a => ({
      href: a.getAttribute("href"), target: a.getAttribute("target"), rel: a.getAttribute("rel") || "", text: (a.innerText || "").trim().slice(0, 80)
    }));
    const invalidLinks = links.filter(link => !link.href || /^(javascript|data):/i.test(link.href) ||
      (link.target === "_blank" && !/(^|\s)(noopener|noreferrer)(\s|$)/i.test(link.rel)));
    const internalPaths = [...new Set(links.map(link => link.href).filter(href => href?.startsWith("/") && !href.startsWith("//")).map(href => href.split(/[?#]/)[0] || "/"))];
    const trMatches = locale === "en" ? [...copy.matchAll(/[çğıöşüİ]/gi)] : [];
    const trChars = [...new Set(trMatches.map(match => match[0].toLocaleLowerCase("tr")))];
    const trContexts = trMatches.map(match => copy.slice(Math.max(0, match.index - 50), Math.min(copy.length, match.index + match[0].length + 50)));
    const untranslatedEnglish = locale === "tr" ? /\b(?:the password|no records|no signed|refresh status|refresh proof|refresh inbox|enter a valid|enter your|open room|public self-service unavailable|waiting for demo|live-verify|official timeline and reward faq|yellow paper file history|windowed messages across the returned room page|last successful\/attempted refresh|the current source status is published|read-only rpc check|public testnet)\b/i.exec(copy)?.[0] || null : null;
    const warningTitle = title?.innerText.trim() || "";
    const warningText = warningCopy?.innerText.trim() || "";
    const statusLink = document.querySelector(".status-grid .status-card:nth-child(3) a");
    const liveTitle = document.querySelector("#live-title")?.innerText.trim() || "";
    const sourceTitle = statusLink?.innerText.trim() || "";
    const loadedCss = [...document.querySelectorAll("head link[rel='stylesheet']")].every(link => !!link.sheet);
    const loadedImages = [...document.querySelectorAll("img")]
      .filter(img => img.getClientRects().length && img.getBoundingClientRect().top < innerHeight)
      .every(img => img.complete && img.naturalWidth > 0);
    const controls = [...document.querySelectorAll("button, a[href], select, input:not([type=hidden]), textarea")].filter(el => el.getClientRects().length).length;
    return {
      route, locale, lang: root.lang, innerWidth, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth,
      turkishCharacters: trChars, turkishCharacterContexts: trContexts, untranslatedEnglish, invalidLinks, internalPaths, controls, loadedCss, loadedImages,
      warning: { box: rect(warning), title: rect(title), copy: rect(warningCopy), titleText: warningTitle, copyText: warningText },
      liveTitle, sourceTitle,
      liveTestnet: {
        status: document.querySelector("#rdLiveTestnet [data-status]")?.innerText.trim() || "",
        source: document.querySelector("#rdLiveTestnet a[href*='docs.flop.network/networks/testnet']")?.getAttribute("href") || ""
      },
      rpc: {
        status: document.querySelector("#rdLiveRpc [data-status]")?.innerText.trim() || "",
        source: document.querySelector("#rdLiveRpc a[href*='testnet.flopscan.io']")?.getAttribute("href") || ""
      },
      labels: route === "home" ? {
        publicProof: document.querySelector("#rdProofImport button")?.innerText.trim() || "",
        share: document.querySelector("#rdShareSiteX")?.innerText.trim() || "",
        shareHeading: document.querySelector("#rdSharePanel h3")?.innerText.trim() || "",
        github: document.querySelector("#repoBtn")?.innerText.trim() || "",
        copyKey: document.querySelector("#copyDidSecret")?.innerText.trim() || ""
      } : {}
    };
  }, { route, locale });

  assertLocalized(snapshot, route, locale);
  assert.ok(snapshot.loadedCss, `${route}/${locale}/${size.name}: stylesheet load failure`);
  assert.ok(snapshot.loadedImages, `${route}/${locale}/${size.name}: image load failure`);
  assert.ok(snapshot.controls > 0, `${route}/${locale}/${size.name}: no controls found`);
  if (route === "home") {
    assert.match(snapshot.warning.titleText, locale === "en" ? /Sustainable activity, not spam/ : /İstenmeyen ileti değil, sürdürülebilir etkinlik/);
    assert.ok(snapshot.warning.title.bottom <= snapshot.warning.copy.top + 1, `${size.name}/${locale}: step 11 warning overlap`);
    for (const part of [snapshot.warning.title, snapshot.warning.copy]) {
      assert.ok(part.left >= snapshot.warning.box.left - 1 && part.right <= snapshot.warning.box.right + 1 &&
        part.top >= snapshot.warning.box.top - 1 && part.bottom <= snapshot.warning.box.bottom + 1,
      `${size.name}/${locale}: step 11 warning text escapes its box`);
    }
    const labels = locale === "en"
      ? { publicProof: "Import Public Proof JSON", share: "𝕏 Share this site", shareHeading: "Share · everyone uses their own account", github: "Open GitHub repository", copyKey: "Copy" }
      : { publicProof: "Herkese Açık Kanıt JSON'unu içe aktar", share: "𝕏 Siteyi paylaş", shareHeading: "Paylaş · herkes kendi hesabından", github: "GitHub repo'yu aç", copyKey: "Kopyala" };
    for (const [key, expected] of Object.entries(labels)) assert.equal(snapshot.labels[key], expected, `${size.name}/${locale}: ${key} label`);
  } else {
    assert.equal(snapshot.liveTitle, locale === "en" ? "Live FLOP status" : "Canlı FLOP durumu");
    assert.equal(snapshot.sourceTitle, locale === "en" ? "Yellow Paper file history →" : "Yellow Paper dosya geçmişi →");
    assert.ok(snapshot.liveTestnet.status.length > 0, `${size.name}/${locale}: Testnet status is empty`);
    assert.equal(snapshot.liveTestnet.source, "https://docs.flop.network/networks/testnet");
    assert.ok(snapshot.rpc.status.length > 0, `${size.name}/${locale}: RPC status is empty`);
    assert.match(snapshot.rpc.source, /^https:\/\/testnet\.flopscan\.io\/?$/);
  }

  recordCheck(`${route}/${locale}/${size.name}px`, snapshot);
  if (checkInternalLinks) {
    for (const path of snapshot.internalPaths) {
      const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000), redirect: "manual" });
      assert.equal(response.status, 200, `internal link ${path} returned HTTP ${response.status}`);
      assert.equal(new URL(response.url).origin, origin.origin, `internal link ${path} redirected off-site`);
    }
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  await context.route("**/api/**", async route => {
    if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname === "/api/relay" && route.request().method() === "POST") {
      let action = "unparseable";
      try { action = JSON.parse(route.request().postData() || "{}").action || "missing"; } catch {}
      if (readOnlyRelayActions.has(action)) return route.continue();
      signals.blockedWrites.push({ action, url: route.request().url() });
    } else {
      signals.blockedWrites.push({ action: `${route.request().method()} ${requestUrl.pathname}`, url: route.request().url() });
    }
    return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "production audit blocks API writes" }) });
  });
  const page = await context.newPage();
  await page.addInitScript(() => addEventListener("securitypolicyviolation", event => {
    (window.__rdCspViolations ||= []).push({ directive: event.effectiveDirective, blockedURI: event.blockedURI, sourceFile: event.sourceFile, lineNumber: event.lineNumber });
  }));
  page.on("console", message => { if (message.type() === "error") signals.consoleErrors.push({ url: page.url(), text: message.text(), location: message.location() }); });
  page.on("pageerror", error => signals.pageErrors.push({ url: page.url(), text: error.message }));
  page.on("requestfailed", request => signals.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "unknown" }));
  page.on("response", response => { if (response.status() >= 400) signals.badResponses.push({ status: response.status(), url: response.url() }); });
  page.setDefaultTimeout(20000);

  let response = await page.goto(`${origin.origin}/`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, `home page returned HTTP ${response?.status()}`);
  await page.locator("#steps .step-chip").first().waitFor({ state: "visible" });
  await page.locator("#rdTestnetToolkit").waitFor({ state: "attached" });
  await page.locator("#rdTclkWorkbench").waitFor({ state: "attached" });
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const locale of ["en", "tr"]) {
      await page.locator(`#rdLangSwitcher button[data-lang='${locale}']`).click();
      await page.waitForFunction(expected => document.documentElement.lang === expected, locale);
      try { await inspect(page, "home", locale, size, size.width === 1440 && locale === "en"); }
      catch (error) { const item = { route: "home", locale, width: size.width, message: error.message }; checkFailures.push(item); console.error(`[PRODUCTION-AUDIT] CHECK-FAIL ${JSON.stringify(item)}`); }
    }
  }

  await page.setViewportSize({ width: 320, height: 740 });
  const navLink = page.locator("#flopCommunityLink");
  if (await navLink.isVisible()) await navLink.click();
  else await page.locator(".hero-actions a[href='/flop']").click();
  await page.waitForURL(`${origin.origin}/flop`);
  await page.locator("#flop-live-status").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const testnet = document.querySelector("#rdLiveTestnet [data-status]")?.textContent || "";
    const rpc = document.querySelector("#rdLiveRpc [data-status]")?.textContent || "";
    return testnet.trim() && rpc.trim() && !/checking/i.test(testnet) && !/checking/i.test(rpc);
  }, null, { timeout: 30000 });
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const locale of ["tr", "en"]) {
      await page.locator("#rdFlopLanguage").selectOption(locale);
      await page.waitForFunction(expected => document.documentElement.lang === expected, locale);
      try { await inspect(page, "flop", locale, size, size.width === 1440 && locale === "tr"); }
      catch (error) { const item = { route: "flop", locale, width: size.width, message: error.message }; checkFailures.push(item); console.error(`[PRODUCTION-AUDIT] CHECK-FAIL ${JSON.stringify(item)}`); }
    }
  }
  await page.locator("#rdFlopLanguage").selectOption("en");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#flop-live-status").waitFor({ state: "visible" });
  assert.equal(await page.locator("#rdFlopLanguage").inputValue(), "en", "English language must persist after reload");
  await page.locator("#rdFlopLanguage").selectOption("tr");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#flop-live-status").waitFor({ state: "visible" });
  assert.equal(await page.locator("#rdFlopLanguage").inputValue(), "tr", "Turkish language must persist after reload");
  signals.cspViolations = await page.evaluate(() => window.__rdCspViolations || []);
  await context.close();

  const firstPartyErrors = signals.consoleErrors.filter(item => item.url.startsWith(origin.origin));
  const firstPartyFailures = signals.failedRequests.filter(item => item.url.startsWith(origin.origin));
  const firstPartyBadResponses = signals.badResponses.filter(item => item.url.startsWith(origin.origin) && !(item.status === 405 && item.url.includes("/api/relay")));
  assert.deepEqual(signals.pageErrors, [], "production JavaScript exceptions");
  assert.deepEqual(firstPartyErrors, [], "first-party console errors");
  assert.deepEqual(firstPartyFailures, [], "first-party failed network requests");
  assert.deepEqual(firstPartyBadResponses, [], "first-party HTTP errors");
  assert.deepEqual(signals.blockedWrites, [], "the production UI attempted a relay write during the read-only audit");
  console.log(`[PRODUCTION-AUDIT] SUMMARY ${JSON.stringify({ checks: checks.length, checkFailures, viewportWidths: sizes.map(item => item.width), signals })}`);
  assert.equal(checks.length, 16, "all four viewport widths, two routes and two languages must be inspected");
  assert.deepEqual(checkFailures, [], "production layout, language and source checks");
} catch (error) {
  console.error(`[PRODUCTION-AUDIT] FAILURE ${JSON.stringify({ message: error.message, checks: checks.length, signals })}`);
  throw error;
} finally {
  await browser.close();
}

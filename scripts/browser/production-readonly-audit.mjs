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
// This optional public ownership claim is absent upstream. The UI renders it as missing,
// never verified; every other HTTP error remains unexpected.
const EXPECTED_MISSING_OWNER = Object.freeze({ status: 404, method: "POST", path: "/api/relay", action: "kvGet", namespace: "room-owners", key: "d-reddragon-835ae177" });
const checks = [];
const checkFailures = [];
const signals = { consoleErrors: [], expectedMissingOwnerConsoleErrors: [], unexpectedConsoleErrors: [], cspViolations: [], pageErrors: [], pageTransitions: [], failedRequests: [], intentionalNavigationCancellations: [], badResponses: [], expectedMissingOwnerRecords: [], blockedWrites: [] };

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
  let languageNavigation = false;
  await context.exposeBinding("__rdReportCspViolation", (source, violation) => {
    signals.cspViolations.push({ pageUrl: source.url, ...violation });
  });
  await page.addInitScript(() => {
    window.__rdCspViolations = [];
    addEventListener("securitypolicyviolation", event => {
      const violation = {
        documentURI: event.documentURI,
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective,
        originalPolicy: event.originalPolicy,
        disposition: event.disposition,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
        sample: event.sample,
        statusCode: event.statusCode
      };
      window.__rdCspViolations.push(violation);
      window.__rdReportCspViolation(violation);
    });
  });
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) signals.pageTransitions.push({ url: frame.url(), at: new Date().toISOString() });
  });
  page.on("console", message => { if (message.type() === "error") signals.consoleErrors.push({ url: page.url(), text: message.text(), location: message.location() }); });
  page.on("pageerror", error => signals.pageErrors.push({ url: page.url(), text: error.message }));
  let navigationGeneration = 0;
  const requestGenerations = new WeakMap();
  page.on("request", request => {
    let isMainNavigation = false;
    try { isMainNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame(); } catch {}
    if (isMainNavigation) navigationGeneration += 1;
    requestGenerations.set(request, navigationGeneration);
  });
  page.on("requestfailed", request => {
    const error = request.failure()?.errorText || "unknown";
    const startedAtGeneration = requestGenerations.get(request) ?? navigationGeneration;
    const navigationCancelled = error === "net::ERR_ABORTED" && startedAtGeneration < navigationGeneration;
    const item = {
      url: request.url(), method: request.method(), error, startedAtGeneration,
      failedAtGeneration: navigationGeneration,
      localeTransitionActive: languageNavigation,
      classification: navigationCancelled ? "navigation-cancelled" : "unexpected"
    };
    signals.failedRequests.push(item);
    if (navigationCancelled) signals.intentionalNavigationCancellations.push(item);
  });
  page.on("response", response => {
    if (response.status() < 400) return;
    const request = response.request();
    let action;
    let namespace;
    let key;
    if (new URL(response.url()).pathname === "/api/relay" && request.method() === "POST") {
      try {
        const body = JSON.parse(request.postData() || "{}");
        action = typeof body.action === "string" ? body.action : "missing";
        namespace = typeof body.ns === "string" ? body.ns : undefined;
        key = typeof body.key === "string" ? body.key : undefined;
      } catch { action = "unparseable"; }
    }
    const item = { status: response.status(), url: response.url(), method: request.method(), ...(action ? { action } : {}), ...(namespace ? { namespace } : {}), ...(key ? { key } : {}) };
    const exactMissingOwner =
      item.status === EXPECTED_MISSING_OWNER.status && item.method === EXPECTED_MISSING_OWNER.method &&
      new URL(item.url).origin === origin.origin && new URL(item.url).pathname === EXPECTED_MISSING_OWNER.path &&
      item.action === EXPECTED_MISSING_OWNER.action && item.namespace === EXPECTED_MISSING_OWNER.namespace &&
      item.key === EXPECTED_MISSING_OWNER.key;
    item.classification = exactMissingOwner ? "expected-missing-owner-record" : "unexpected-http-error";
    signals.badResponses.push(item);
    if (exactMissingOwner) signals.expectedMissingOwnerRecords.push(item);
    console.log(`[PRODUCTION-AUDIT] HTTP-ERROR ${JSON.stringify(item)}`);
  });
  page.setDefaultTimeout(20000);

  let response = await page.goto(`${origin.origin}/`, { waitUntil: "load" });
  assert.equal(response?.status(), 200, `home page returned HTTP ${response?.status()}`);
  await page.locator("#steps .step-chip").first().waitFor({ state: "visible" });
  await page.locator("#rdTestnetToolkit").waitFor({ state: "attached" });
  await page.locator("#rdTclkWorkbench").waitFor({ state: "attached" });
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const locale of ["en", "tr"]) {
      languageNavigation = true;
      try {
        await page.locator(`#rdLangSwitcher button[data-lang='${locale}']`).click();
        await page.waitForLoadState("load");
        await page.locator("#createBtn").waitFor({ state: "attached" });
        await page.waitForFunction(({ locale, expected, publicProof, share, shareHeading, github, copyKey, autoOut }) => {
          const text = selector => document.querySelector(selector)?.innerText.trim() || "";
          const cssReady = [...document.querySelectorAll("head link[rel='stylesheet']")].every(link => !!link.sheet);
          return document.readyState === "complete" &&
            document.documentElement.lang === locale &&
            text("#createBtn") === expected &&
            text("#rdProofImport button") === publicProof &&
            text("#rdShareSiteX") === share &&
            text("#rdSharePanel h3") === shareHeading &&
            text("#repoBtn") === github &&
            text("#copyDidSecret") === copyKey &&
            document.querySelector("#rdUsageGuide") &&
            document.querySelector("#autoOut")?.textContent.trim() === autoOut &&
            cssReady;
        }, locale === "en" ? {
          locale, expected: "Create new DID", publicProof: "Import Public Proof JSON", share: "𝕏 Share this site",
          shareHeading: "Share · everyone uses their own account", github: "Open GitHub repository", copyKey: "Copy",
          autoOut: "Fork-safe agent: the DID is derived from the private key. Primary + backup schedules provide redundancy; only one GitHub Secret is required."
        } : {
          locale, expected: "Yeni DID oluştur", publicProof: "Herkese Açık Kanıt JSON'unu içe aktar", share: "𝕏 Siteyi paylaş",
          shareHeading: "Paylaş · herkes kendi hesabından", github: "GitHub repo'yu aç", copyKey: "Kopyala",
          autoOut: "Fork-safe ajan: DID private key'den otomatik türetilir. Ana + yedek schedule ile yedekli çalışır; yalnızca tek GitHub Secret gerekir."
        }, { timeout: 45000 });
      } finally { languageNavigation = false; }
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
      languageNavigation = true;
      try {
        await page.locator("#rdFlopLanguage").selectOption(locale);
        await page.waitForLoadState("load");
        await page.waitForFunction(expected => document.readyState === "complete" && document.documentElement.lang === expected, locale);
      } finally { languageNavigation = false; }
      try { await inspect(page, "flop", locale, size, size.width === 1440 && locale === "tr"); }
      catch (error) { const item = { route: "flop", locale, width: size.width, message: error.message }; checkFailures.push(item); console.error(`[PRODUCTION-AUDIT] CHECK-FAIL ${JSON.stringify(item)}`); }
    }
  }
  languageNavigation = true;
  await page.locator("#rdFlopLanguage").selectOption("en");
  await page.waitForLoadState("load");
  await page.reload({ waitUntil: "load" });
  await page.locator("#flop-live-status").waitFor({ state: "visible" });
  assert.equal(await page.locator("#rdFlopLanguage").inputValue(), "en", "English language must persist after reload");
  await page.locator("#rdFlopLanguage").selectOption("tr");
  await page.waitForLoadState("load");
  await page.reload({ waitUntil: "load" });
  await page.locator("#flop-live-status").waitFor({ state: "visible" });
  assert.equal(await page.locator("#rdFlopLanguage").inputValue(), "tr", "Turkish language must persist after reload");
  languageNavigation = false;
  await context.close();

  const unexpectedFailedRequests = signals.failedRequests.filter(item => item.classification !== "navigation-cancelled");
  let expected404ConsoleSlots = signals.expectedMissingOwnerRecords.length;
  const unexpectedConsoleErrors = [];
  for (const error of signals.consoleErrors) {
    const exactMissingOwnerConsole =
      expected404ConsoleSlots > 0 && error.location?.url === new URL(EXPECTED_MISSING_OWNER.path, origin.origin).href &&
      /server responded with a status of 404/i.test(error.text);
    if (exactMissingOwnerConsole) {
      signals.expectedMissingOwnerConsoleErrors.push(error);
      expected404ConsoleSlots--;
    } else unexpectedConsoleErrors.push(error);
  }
  signals.unexpectedConsoleErrors = unexpectedConsoleErrors;
  const unexpectedBadResponses = signals.badResponses.filter(item => {
    const methodGuard = item.status === 405 && item.method === "GET" &&
      new URL(item.url).origin === origin.origin && new URL(item.url).pathname === "/api/relay";
    return item.classification !== "expected-missing-owner-record" && !methodGuard;
  });
  assert.deepEqual(signals.pageErrors, [], "production JavaScript exceptions");
  assert.deepEqual(unexpectedConsoleErrors, [], "all console errors except the one-for-one exact missing-owner 404");
  assert.deepEqual(unexpectedFailedRequests, [], "unexpected production network failures; every failure remains in signals.failedRequests");
  assert.deepEqual(unexpectedBadResponses, [], "unexpected HTTP errors; exact missing record remains in signals.badResponses");
  assert.deepEqual(signals.cspViolations, [], "all CSP violations captured across every page transition");
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

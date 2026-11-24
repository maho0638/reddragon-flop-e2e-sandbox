import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const origin = new URL(process.env.SITE_ACCEPTANCE_ORIGIN || "https://reddragon-technocore.vercel.app");
assert.equal(origin.protocol, "https:", "production CSP audit requires HTTPS");
assert.equal(origin.hostname, "reddragon-technocore.vercel.app", "audit is pinned to the production host");

const readOnlyActions = new Set(["health", "rooms", "config", "read", "kvGet"]);
const events = { csp: [], pageErrors: [], consoleErrors: [], failedRequests: [], blockedWrites: [] };
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ locale: "en-US" });
  await context.addInitScript(() => {
    window.__rdCspEvents = [];
    addEventListener("securitypolicyviolation", event => window.__rdCspEvents.push({
      directive: event.effectiveDirective,
      blockedURI: event.blockedURI,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber
    }));
  });
  await context.route("**/api/**", async route => {
    if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
    const url = new URL(route.request().url());
    let action = "unparseable";
    if (url.pathname === "/api/relay" && route.request().method() === "POST") {
      try { action = JSON.parse(route.request().postData() || "{}").action || "missing"; } catch {}
      if (readOnlyActions.has(action)) return route.continue();
    }
    events.blockedWrites.push({ method: route.request().method(), path: url.pathname, action });
    return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "read-only audit blocked this request" }) });
  });
  const page = await context.newPage();
  page.on("console", message => { if (message.type() === "error") events.consoleErrors.push({ url: page.url(), message: message.text() }); });
  page.on("pageerror", error => events.pageErrors.push({ url: page.url(), message: error.message }));
  page.on("requestfailed", request => events.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "unknown" }));

  for (const path of ["/", "/flop"]) {
    const response = await page.goto(new URL(path, origin).href, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, `${path} HTTP status`);
    if (path === "/") await page.locator("#rdUsageGuide").waitFor({ state: "attached", timeout: 30000 });
    else await page.locator("#flop-live-status").waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(1000);
    events.csp.push(...await page.evaluate(() => window.__rdCspEvents || []));
  }
  await context.close();
  console.log(`[CSP-AUDIT] ${JSON.stringify(events)}`);
  assert.deepEqual(events.csp, [], "production must emit no CSP violation events");
  assert.deepEqual(events.pageErrors, [], "production must emit no uncaught JavaScript errors");
  assert.deepEqual(events.consoleErrors, [], "production must emit no browser console errors");
  assert.deepEqual(events.failedRequests, [], "production must have no failed network requests");
  assert.deepEqual(events.blockedWrites, [], "read-only production audit must not attempt writes");
} finally {
  await browser.close();
}

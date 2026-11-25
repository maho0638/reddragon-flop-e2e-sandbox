import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const origin = new URL(process.env.SITE_ACCEPTANCE_ORIGIN || "https://reddragon-technocore.vercel.app");
assert.equal(origin.protocol, "https:", "production CSP audit requires HTTPS");
assert.equal(origin.hostname, "reddragon-technocore.vercel.app", "audit is pinned to the production host");

const readOnlyActions = new Set(["health", "rooms", "config", "read", "kvGet"]);
const events = { csp: [], pageErrors: [], consoleErrors: [], failedRequests: [], intentionalNavigationCancellations: [], pageTransitions: [], blockedWrites: [] };
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ locale: "en-US" });
  await context.exposeBinding("__rdReportCspViolation", (source, violation) => {
    events.csp.push({ pageUrl: source.url, ...violation });
  });
  await context.addInitScript(() => {
    window.__rdCspEvents = [];
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
      window.__rdCspEvents.push(violation);
      window.__rdReportCspViolation(violation);
    });
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
  let pageNavigation = false;
  page.on("console", message => { if (message.type() === "error") events.consoleErrors.push({ url: page.url(), message: message.text() }); });
  page.on("pageerror", error => events.pageErrors.push({ url: page.url(), message: error.message }));
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) events.pageTransitions.push({ url: frame.url(), at: new Date().toISOString() });
  });
  page.on("requestfailed", request => {
    const item = { url: request.url(), error: request.failure()?.errorText || "unknown" };
    events.failedRequests.push(item);
    if (pageNavigation && item.error === "net::ERR_ABORTED") events.intentionalNavigationCancellations.push(item);
  });

  for (const path of ["/", "/flop"]) {
    const cspStart = events.csp.length;
    pageNavigation = true;
    try {
      const response = await page.goto(new URL(path, origin).href, { waitUntil: "load" });
      assert.equal(response?.status(), 200, `${path} HTTP status`);
      if (path === "/") {
        await page.locator("#rdUsageGuide").waitFor({ state: "attached", timeout: 30000 });
        await page.getByRole("button", { name: "Import Public Proof JSON", exact: true }).waitFor({ state: "visible", timeout: 30000 });
      } else {
        await page.locator("#flop-live-status").waitFor({ state: "visible", timeout: 30000 });
      }
      await page.waitForFunction(() => document.readyState === "complete" &&
        [...document.querySelectorAll("head link[rel='stylesheet']")].every(link => !!link.sheet), null, { timeout: 30000 });
      await page.waitForTimeout(1700);
      console.log(`[CSP-AUDIT] TRANSITION ${JSON.stringify({ path, url: page.url(), cspEvents: events.csp.slice(cspStart) })}`);
    } finally { pageNavigation = false; }
  }
  pageNavigation = true;
  await context.close();
  pageNavigation = false;
  const unexpectedFailures = events.failedRequests.filter(item => !events.intentionalNavigationCancellations.includes(item));
  console.log(`[CSP-AUDIT] ${JSON.stringify(events)}`);
  assert.deepEqual(events.csp, [], "production must emit no CSP violation events on any audited page transition");
  assert.deepEqual(events.pageErrors, [], "production must emit no uncaught JavaScript errors");
  assert.deepEqual(events.consoleErrors, [], "production must emit no browser console errors");
  assert.deepEqual(unexpectedFailures, [], "unexpected failed requests; every failure remains in the log");
  assert.deepEqual(events.blockedWrites, [], "read-only production audit must not attempt writes");
} finally {
  await browser.close();
}

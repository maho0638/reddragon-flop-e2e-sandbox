import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const origin = new URL(process.env.SITE_ACCEPTANCE_ORIGIN || "https://reddragon-technocore.vercel.app");
assert.equal(origin.protocol, "https:", "production CSP audit requires HTTPS");
assert.equal(origin.hostname, "reddragon-technocore.vercel.app", "audit is pinned to the production host");

const readOnlyActions = new Set(["health", "rooms", "config", "read", "kvGet"]);
// This optional public ownership claim is absent upstream. The UI renders it as missing,
// never verified; every other HTTP error remains unexpected.
const EXPECTED_MISSING_OWNER = Object.freeze({ status: 404, method: "POST", path: "/api/relay", action: "kvGet", namespace: "room-owners", key: "d-reddragon-835ae177" });
const events = { csp: [], pageErrors: [], consoleErrors: [], expectedMissingOwnerConsoleErrors: [], unexpectedConsoleErrors: [], failedRequests: [], intentionalNavigationCancellations: [], badResponses: [], expectedMissingOwnerRecords: [], pageTransitions: [], blockedWrites: [] };
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
  let pageClosing = false;
  let navigationGeneration = 0;
  const requestGenerations = new WeakMap();
  page.on("request", request => {
    let isMainNavigation = false;
    try { isMainNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame(); } catch {}
    if (isMainNavigation) navigationGeneration += 1;
    requestGenerations.set(request, navigationGeneration);
  });
  page.on("console", message => { if (message.type() === "error") events.consoleErrors.push({ url: page.url(), message: message.text(), location: message.location() }); });
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
    events.badResponses.push(item);
    if (exactMissingOwner) events.expectedMissingOwnerRecords.push(item);
  });
  page.on("pageerror", error => events.pageErrors.push({ url: page.url(), message: error.message }));
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) events.pageTransitions.push({ url: frame.url(), at: new Date().toISOString() });
  });
  page.on("requestfailed", request => {
    const error = request.failure()?.errorText || "unknown";
    const startedAtGeneration = requestGenerations.get(request) ?? navigationGeneration;
    const navigationCancelled = error === "net::ERR_ABORTED" && startedAtGeneration < navigationGeneration;
    const teardownCancelled = error === "net::ERR_ABORTED" && pageClosing;
    const item = {
      url: request.url(), method: request.method(), error, startedAtGeneration,
      failedAtGeneration: navigationGeneration,
      pageNavigationActive: pageNavigation,
      classification: navigationCancelled ? "navigation-cancelled" : teardownCancelled ? "test-teardown-cancelled" : "unexpected"
    };
    events.failedRequests.push(item);
    if (item.classification !== "unexpected") events.intentionalNavigationCancellations.push(item);
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
  pageClosing = true;
  await context.close();
  pageClosing = false;
  const unexpectedFailures = events.failedRequests.filter(item => item.classification === "unexpected");
  let expected404ConsoleSlots = events.expectedMissingOwnerRecords.length;
  const unexpectedConsoleErrors = [];
  for (const error of events.consoleErrors) {
    const exactMissingOwnerConsole =
      expected404ConsoleSlots > 0 && error.location?.url === new URL(EXPECTED_MISSING_OWNER.path, origin.origin).href &&
      /server responded with a status of 404/i.test(error.message);
    if (exactMissingOwnerConsole) {
      events.expectedMissingOwnerConsoleErrors.push(error);
      expected404ConsoleSlots--;
    } else unexpectedConsoleErrors.push(error);
  }
  events.unexpectedConsoleErrors = unexpectedConsoleErrors;
  const unexpectedResponses = events.badResponses.filter(item => item.classification !== "expected-missing-owner-record");
  console.log(`[CSP-AUDIT] ${JSON.stringify(events)}`);
  assert.deepEqual(events.csp, [], "production must emit no CSP violation events on any audited page transition");
  assert.deepEqual(events.pageErrors, [], "production must emit no uncaught JavaScript errors");
  assert.deepEqual(unexpectedConsoleErrors, [], "all console errors except the one-for-one exact missing-owner 404");
  assert.deepEqual(unexpectedFailures, [], "unexpected failed requests; every failure remains in the log");
  assert.deepEqual(unexpectedResponses, [], "unexpected HTTP responses; exact missing record remains visible in badResponses");
  assert.deepEqual(events.blockedWrites, [], "read-only production audit must not attempt writes");
} finally {
  await browser.close();
}

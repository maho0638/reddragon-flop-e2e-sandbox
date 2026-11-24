import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../public/ui-i18n.js", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const flopStatus = await readFile(new URL("../public/flop-live-status.js", import.meta.url), "utf8");
const patches = await readFile(new URL("../public/patches.js", import.meta.url), "utf8");
const enhancements = await readFile(new URL("../public/enhancements.js", import.meta.url), "utf8");
const languageStable = await readFile(new URL("../public/language-stable.js", import.meta.url), "utf8");
const config = await readFile(new URL("../public/config.js", import.meta.url), "utf8");
const proofImport = await readFile(new URL("../public/proof-import.js", import.meta.url), "utf8");
const liveObservatory = await readFile(new URL("../public/live-observatory.js", import.meta.url), "utf8");
const capacity = await readFile(new URL("../public/technocore-capacity.js", import.meta.url), "utf8");
const languageBootstrap = await readFile(new URL("../public/language-bootstrap.js", import.meta.url), "utf8");
const indexHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const flopHtml = await readFile(new URL("../public/flop.html", import.meta.url), "utf8");
const browserWorkflow = await readFile(new URL("../.github/workflows/flop-site-browser-audit.yml", import.meta.url), "utf8");
const packageManifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const acceptanceAudit = await readFile(new URL("./browser/site-acceptance.spec.mjs", import.meta.url), "utf8");
const flopBrowserAudit = await readFile(new URL("./browser/flop-ui.spec.mjs", import.meta.url), "utf8");
const productionSmokePath = new URL("./browser/production-smoke.spec.mjs", import.meta.url);
let productionSmokeExists = true;
try {
  await readFile(productionSmokePath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  productionSmokeExists = false;
}
const context = { window: {}, localStorage: { getItem: () => "en" }, navigator: { language: "en-US" } };
vm.runInNewContext(source, context);
const i18n = context.window.RD_I18N;

test("shared interface catalog provides every key in both locales and fails closed", () => {
  const result = i18n.audit();
  assert.deepEqual(Array.from(result.locales), ["tr", "en"]);
  assert.ok(result.keys >= 40);
  const sample = i18n.register("sample", { en: { item: "Item" }, tr: { item: "Öğe" } });
  assert.equal(sample.en.item, "Item");
  assert.throws(() => i18n.register("bad", { en: { item: "Item" }, tr: {} }), /Incomplete translation catalog/);
  assert.equal(i18n.audit().catalogs, 1);
  const used = [...app.matchAll(/ui\("([\w.]+)"/g)].map(match => match[1]);
  for (const key of used) for (const lang of ["tr", "en"]) assert.equal(typeof i18n.t(key, {}, lang), "string", `${lang}.${key}`);
  assert.throws(() => i18n.t("missing.key", {}, "en"), /Missing UI translation/);
  assert.equal(i18n.t("app.publishedRecord", { fingerprint: "abc" }, "en"), "Published · /kv/did/abc");
});

test("application dynamic status and confirmation copy no longer embeds mixed-language literals", () => {
  for (const key of ["passwordShort", "restoreFailed", "failure", "resetConfirm", "privateRoomPrivacy", "setupCopied", "didSecretCopied"]) {
    assert.ok(app.includes(`ui("app.${key}")`), `missing shared UI translation for ${key}`);
  }
  assert.ok(app.includes("uiLang()==="));
  assert.match(app, /#brandSub"\)\.textContent\s*=\s*ui\("app\.communityBrand"\)/);
  assert.match(app, /tool:`\$\{cfg\.brandName\|\|"RedDragon"\} \$\{ui\("app\.communityBrand"\)\}`/);
  assert.match(app, /function automationGuide\(\)[\s\S]*?uiLang\(\)==="en"/);
});

test("restore, security, relay and capacity UI messages use complete shared translations", () => {
  const patchKeys = ["publishedPath", "proofCopied", "backupProofFile", "backupJsonOnly", "backupTooLarge", "readyDidNote", "readyHello", "readyIntro", "readyRoom", "readyStyle", "readyContribution", "backupRestoredNote", "backupRestoredToast", "securityHeading", "securityBody", "relayOnline", "relayOffline", "capacityNote", "capacityRoom", "capacity404"];
  for (const key of patchKeys) for (const lang of ["en", "tr"]) assert.ok(i18n.t(`patch.${key}`, {}, lang).length > 0);
  assert.match(patches, /patchText\("backupRestoredToast"\)/);
  assert.match(patches, /patchText\("securityBody"\)/);
  assert.match(patches, /patchText\("relayOffline"\)/);
  assert.match(enhancements, /enhancementText\("capacity404"\)/);
  assert.match(enhancements, /enhancementText\("relayOnline"\)/);
});

test("onboarding and proof-import UI copy uses shared translations in both languages", () => {
  for (const key of ["proofImportNote", "agentSustainable", "agentCadence", "privateKeyHint"]) {
    assert.ok(i18n.t(`app.${key}`, {}, "en").length > 0);
    assert.ok(i18n.t(`app.${key}`, {}, "tr").length > 0);
  }
  for (const key of ["agentSustainable", "agentCadence", "privateKeyHint"]) assert.ok(languageStable.includes(`app.${key}`));
  assert.ok(proofImport.includes('window.RD_I18N.t("app.proofImportNote")'));
});

test("TR/EN visible labels and dynamic live copy use the selected locale", () => {
  const exactEntries = languageStable.match(/const exactEN = new Map\((\[[\s\S]*?\])\);/)?.[1];
  assert.ok(exactEntries, "dynamic English translation table must exist");
  const exactEN = vm.runInNewContext(`new Map(${exactEntries})`);
  assert.equal(exactEN.get("İsteğe bağlı"), "Optional");
  assert.equal(exactEN.get("Henüz özel oda yok."), "No private room yet.");
  const liveTr = liveObservatory.slice(liveObservatory.indexOf("  tr: {"), liveObservatory.indexOf("  en: {"));
  const liveEn = liveObservatory.slice(liveObservatory.indexOf("  en: {"), liveObservatory.indexOf("const rdLiveT"));
  const keys = copy => [...copy.matchAll(/^\s+([A-Za-z][\w]*):/gm)].map(match => match[1]).filter(key => key !== "tr" && key !== "en").sort();
  assert.deepEqual(keys(liveTr), keys(liveEn), "every live-observatory label must have TR and EN entries");
  for (const phrase of ["nav: \"Canlı\"", "title: \"Canlı Ajan Gözlemevi\"", "signed: \"İmzalı ajan\"", "heartbeat: \"nabız\"", "active: \"etkin\"", "idle: \"beklemede\"", "stale: \"güncelliğini yitirmiş\"", "activity: \"Son herkese açık etkinlik\""]) assert.ok(liveTr.includes(phrase), `missing Turkish live label ${phrase}`);
  for (const key of ["buffer", "publicLabel", "polling", "publicNick", "messageCount", "redAgent"]) assert.ok(new RegExp(`\\b${key}:`).test(liveTr) && new RegExp(`\\b${key}:`).test(liveEn), `missing TR/EN live translation ${key}`);
  assert.match(liveObservatory, /small>\$\{rdEscape\(rdLiveT\.buffer\)\}/);
  assert.match(liveObservatory, /small>\$\{rdEscape\(rdLiveT\.polling\)\}/);
  assert.match(languageStable, /\.ownerline b[\s\S]*RedDragon FLOP Topluluk Aracı/);
  assert.match(languageStable, /Repository Variables[\s\S]*Depo değişkenleri/);
  assert.match(capacity, /rdCapacityLang\(\)/);
  assert.match(capacity, /Canlı okuma tamam · yalnızca herkese açık Technocore üst verileri/);
  assert.match(flopHtml, /id="rdFlopLanguage"/);
  assert.match(flopStatus, /setAttribute\("aria-label", lang === "tr" \? "Arayüz dili" : "Language"\)/);
  assert.match(flopStatus, /Topluluk çalışması · kaynak odaklı · resmî bağlantı iddiası yok/);
  assert.match(languageStable, /localStorage\.setItem\(LANG_KEY, next\)[\s\S]*location\.reload\(\)/);
});

test("X proof button copies locally while explicit share intents stay localized", () => {
  for (const lang of ["en", "tr"]) {
    assert.ok(i18n.t("patch.siteShareDraft", { site: "https://example.test", handle: "@example" }, lang).includes("https://example.test"));
    assert.ok(i18n.t("app.xShareDraft", { handle: "@example", did: "did:key:z6Mk-test", url: "https://example.test", room: "lobby", seq: "1" }, lang).includes("did:key:z6Mk-test"));
  }
  assert.match(enhancements, /window\.RD_I18N\.t\("app\.xShareDraft"/);
  assert.match(enhancements, /replacement\.onclick = \(\) => copy\(proofShareText\(\), window\.RD_I18N\.t\("app\.xTextCopied"\)\)/);
  assert.match(enhancements, /\$\("#rdProofX"\)\.onclick = \(\) => xIntent\(proofShareText\(\)\)/);
  assert.match(enhancements, /xIntent\(proofShareText\(\)\)/);
  assert.match(acceptanceAudit, /navigator\.clipboard\.readText\(\)/);
  assert.match(acceptanceAudit, /unexpectedPopups, \[\]/);
  assert.match(acceptanceAudit, /context\.pages\(\)\.length, pageCountBeforeShare/);
  assert.match(acceptanceAudit, /#rdDidProvenance[\s\S]*#rdProvFixRefresh/);
  assert.match(acceptanceAudit, /Kanıtı yenile/);
});

test("live-status API failure localizes both status panels without an undefined-language exception", () => {
  assert.match(flopStatus, /catch\s*\{\s*const lang = getLang\(\);\s*const failureCopy = FLOP_STATUS_COPY\[lang\];\s*renderFailure\(lang\);/);
  assert.match(flopStatus, /const t = failureCopy;/);
});

test("language preference is committed before one shared event updates status and capacity panels", () => {
  assert.match(source, /const setLanguage = \(locale\) =>[\s\S]*localStorage\.setItem\("reddragon-lang", value\)[\s\S]*dispatchEvent\(new CustomEvent\("rd:languagechange"/);
  assert.match(capacity, /window\.addEventListener\("rd:languagechange", \(event\) => rdRenderCapacity\(event\.detail\?\.lang\)\)/);
  assert.doesNotMatch(capacity, /addEventListener\(['"]change['"], \(\) => rdRenderCapacity/);
  assert.match(capacity, /Live read OK · public Technocore metadata only/);
  assert.match(capacity, /Canlı okuma tamam · yalnızca herkese açık Technocore üst verileri/);
  assert.match(capacity, /rdCapacityError\(rdCapacity\.error, lang\)/);
  assert.match(flopStatus, /window\.RD_I18N\.setLanguage\(value\)/);
});

test("shared language setter stores preference and html lang before dispatch", () => {
  const values = new Map();
  const order = [];
  const root = { lang: "en" };
  const window = { dispatchEvent(event) { order.push([values.get("reddragon-lang"), root.lang, event.detail.lang]); } };
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } }
  const localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  vm.runInNewContext(source, { window, document: { documentElement: root }, localStorage, navigator: { language: "en-US" }, CustomEvent });
  assert.equal(window.RD_I18N.setLanguage("tr"), "tr");
  assert.deepEqual(order, [["tr", "tr", "tr"]]);
});

test("both pages select and render the saved language before add-on loading", () => {
  for (const html of [indexHtml, flopHtml]) {
    assert.match(html, /<script src="\/language-bootstrap\.js"><\/script>/);
    assert.ok(html.indexOf("/language-bootstrap.js") < html.indexOf("<\/head>"));
  }
  assert.match(languageBootstrap, /document\.documentElement\.lang = lang/);
  assert.match(indexHtml, /<script src="\/language-stable\.js"><\/script>/);
  assert.doesNotMatch(config, /"\/language-stable\.js"/);
  assert.doesNotMatch(languageStable, /\[350, 1900, 3200\]/);
  assert.match(languageStable, /window\.addEventListener\("rd:languagechange"/);
  assert.match(config, /window\.dispatchEvent\(new Event\("rd:addonsready"\)\)/);
  assert.match(languageStable, /window\.addEventListener\("rd:addonsready"/);
});

test("late-injected enhancement and proof controls trigger a selected-language refresh", () => {
  assert.match(languageStable, /window\.addEventListener\("rd:dynamicuiready", refreshLanguageForDynamicUi\)/);
  assert.match(enhancements, /window\.dispatchEvent\(new Event\("rd:dynamicuiready"\)\)/);
  assert.match(proofImport, /installUi\(\);\s*window\.dispatchEvent\(new Event\("rd:dynamicuiready"\)\)/);
});

test("browser locale assertions are page-scoped and restore the actual encrypted JSON download", () => {
  assert.match(flopBrowserAudit, /async function assertVisibleCopyLocale\(page, locale, label, \{ home = false \} = \{\}\)/);
  assert.match(flopBrowserAudit, /if \(!home\) return;/);
  assert.match(flopBrowserAudit, /assertVisibleCopyLocale\(page, "en", `\$\{viewport\.name\}\/home`, \{ home: true \}\)/);
  assert.match(flopBrowserAudit, /assertVisibleCopyLocale\(page, "tr", `\$\{viewport\.name\}\/home`, \{ home: true \}\)/);
  assert.match(acceptanceAudit, /assert\.match\(backupName, \/\\\.json\$\/i/);
  assert.match(acceptanceAudit, /chooser\.setFiles\(\{ name: backupName, mimeType: "application\/json", buffer: backupContents \}\)/);
  assert.match(acceptanceAudit, /dialog\.type\(\)/);
  assert.match(acceptanceAudit, /backup\.suggestedFilename\(\), "ephemeral-ui-audit-only-password"/);
});

test("browser workflow can run only on the QA branch with read-only repository permissions", () => {
  assert.match(packageManifest.scripts["test:browser"], /--test-concurrency=1/);
  assert.match(packageManifest.scripts["test:browser"], /site-acceptance\.spec\.mjs scripts\/browser\/flop-ui\.spec\.mjs/);
  assert.doesNotMatch(packageManifest.scripts["test:browser"], /production-smoke\.spec\.mjs/);
  assert.equal(packageManifest.scripts["test:browser:production"], undefined, "sandbox must not expose a production smoke npm command");
  assert.equal(productionSmokeExists, false, "production-smoke.spec.mjs must not be copied into the sandbox");
  assert.match(browserWorkflow, /push:\s*\n\s+branches:\s*\n\s+- qa\/flop-e2e-9bbc626/);
  assert.match(browserWorkflow, /paths:\s*\n\s+- \.github\/workflows\/flop-site-browser-audit\.yml/);
  assert.match(browserWorkflow, /github\.event_name == 'push'[\s\S]*github\.event_name == 'workflow_dispatch'/);
  assert.match(browserWorkflow, /run_production_acceptance:[\s\S]*default: false/);
  assert.match(browserWorkflow, /runs-on: ubuntu-24\.04/);
  assert.match(browserWorkflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(browserWorkflow, /vercel deploy|git push|gh pr merge/i);
  assert.match(acceptanceAudit, /Only test data; no persistent test identities or real relay writes/);
  assert.match(acceptanceAudit, /route\("\*\*\/api\/relay"/);
});

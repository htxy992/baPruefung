// Headless-Integrationstest der Quiz-App (Multiple-Response) mit jsdom
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..", "public");
let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "questions.json"), "utf8"));
html = html.replace('<script src="./js/app.js"></script>', "");

const errors = [];
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
const win = dom.window;
win.addEventListener("error", (e) => errors.push("window.error: " + e.message));

win.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
win.scrollTo = () => {};
win.alert = () => {};
win.confirm = () => true;
// jsdom kennt scrollIntoView nicht (im Browser vorhanden) -> No-op-Polyfill
win.Element.prototype.scrollIntoView = win.Element.prototype.scrollIntoView || function () {};

function tick(ms = 0) { return new Promise((r) => win.setTimeout(r, ms)); }
const $ = (id) => win.document.getElementById(id);
const visible = (id) => $(id) && !$(id).classList.contains("hidden");
function assert(cond, msg) { if (!cond) { errors.push("ASSERT: " + msg); console.log("  ✗ " + msg); } else { console.log("  ✓ " + msg); } }

function curQ() { const t = $("qText").textContent; return data.questions.find((q) => q.question === t); }
function clickByOrig(origs) {
  const btns = Array.prototype.slice.call($("qOptions").querySelectorAll(".option"));
  origs.forEach((o) => { const b = btns.find((x) => +x.dataset.orig === o); if (b) b.click(); });
}

(async () => {
  try {
    const s = win.document.createElement("script");
    s.textContent = appJs;
    win.document.body.appendChild(s);
    win.document.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));
    await tick(30);

    console.log("\n[1] Init / Startseite");
    assert(visible("screen-home"), "Startseite sichtbar nach Laden");
    assert($("fieldGrid").querySelectorAll(".field-chip").length === 3, "3 Gebiets-Kärtchen gerendert");
    assert($("termList").querySelectorAll(".term-item").length === data.terms.length, data.terms.length + " Begriffe in Liste");
    assert(data.questions.every((q) => q.options.length === 6), "Alle Fragen haben 6 Optionen (Daten)");
    assert(data.questions.every((q) => Array.isArray(q.correctIndices) && q.correctIndices.length >= 1), "Alle Fragen haben correctIndices (Daten)");

    console.log("\n[2] Übungsmodus (Multiple-Response)");
    $("startPractice").click();
    await tick(10);
    assert(visible("screen-quiz"), "Quiz-Screen sichtbar");
    assert($("qOptions").querySelectorAll(".option").length === 6, "6 Antwortoptionen gerendert");
    assert(visible("qCheck"), "'Antwort prüfen'-Button sichtbar");

    let q = curQ();
    assert(!!q && q.correctIndices.length >= 1, "Aktuelle Frage gefunden (" + (q ? q.correctIndices.length : "?") + " richtige)");
    clickByOrig(q.correctIndices);
    assert($("qOptions").querySelectorAll(".option.selected").length === q.correctIndices.length, "Auswahl markiert genau " + q.correctIndices.length + " Optionen");
    $("qCheck").click(); await tick(10);
    assert(visible("qFeedback"), "Feedback nach 'Prüfen' sichtbar");
    assert($("qFeedbackHead").textContent.indexOf("Richtig") >= 0, "Vollständig korrekte Auswahl als richtig gewertet");
    assert($("qOptions").querySelectorAll(".option.correct").length === q.correctIndices.length, "Alle richtigen Optionen grün markiert");
    assert(visible("qNext") || visible("qFinish"), "Weiter/Auswerten erscheint nach Prüfen");

    if (visible("qNext")) {
      $("qNext").click(); await tick(8);
      q = curQ();
      const wrong = [0, 1, 2, 3, 4, 5].find((o) => q.correctIndices.indexOf(o) < 0);
      clickByOrig([wrong]);
      $("qCheck").click(); await tick(8);
      assert($("qFeedbackHead").textContent.indexOf("Nicht ganz") >= 0, "Unvollständige/falsche Auswahl als 'Nicht ganz' gewertet");
      assert($("qOptions").querySelector(".option.missed") !== null, "Übersehene richtige Option markiert");
      assert($("qOptions").querySelector(".option.wrong") !== null, "Falsch gewählte Option rot markiert");
    }

    let steps = 0;
    while (visible("qNext") && steps < 4) {
      $("qNext").click(); await tick(5);
      const cq = curQ(); if (cq) clickByOrig([cq.correctIndices[0]]);
      $("qCheck").click(); await tick(5);
      steps++;
    }
    assert(steps > 0, "Mehrere Fragen durchlaufbar (" + steps + "x)");

    console.log("\n[3] Statistik-Seite");
    $("brandHome").click(); await tick(10);
    Array.from(win.document.querySelectorAll("[data-go]")).find((b) => b.getAttribute("data-go") === "stats").click();
    await tick(10);
    assert(visible("screen-stats"), "Statistik-Screen sichtbar");
    assert($("statsCards").children.length === 4, "4 Statistik-Karten");
    assert($("statsTerms").querySelectorAll(".bar-row").length === data.terms.length, data.terms.length + " Begriff-Fortschrittsbalken");
    const answered = parseInt($("statsCards").children[0].querySelector("b").textContent, 10);
    assert(answered >= 1, "Beantwortete Fragen werden gezählt (" + answered + ")");

    console.log("\n[4] Prüfungsmodus mit Timer");
    $("brandHome").click(); await tick(10);
    $("examCount").value = "15"; $("examTime").value = "15";
    $("startExam").click(); await tick(10);
    assert(visible("screen-quiz"), "Prüfungs-Quiz sichtbar");
    assert(!$("quizTimer").classList.contains("hidden"), "Timer sichtbar im Prüfungsmodus");
    assert($("quizModeBadge").textContent === "Prüfungsmodus", "Badge zeigt Prüfungsmodus");
    assert($("qCheck").classList.contains("hidden"), "Kein 'Prüfen'-Button im Prüfungsmodus");
    assert(visible("qNext") || visible("qFinish"), "Weiter/Auswerten direkt sichtbar");
    $("qOptions").querySelectorAll(".option")[0].click();
    await tick(5);
    const before = $("qText").textContent;
    (visible("qNext") ? $("qNext") : $("qFinish")).click();
    await tick(10);
    assert($("qFeedback").classList.contains("hidden"), "Kein Feedback im Prüfungsmodus");
    assert($("qText").textContent !== before || !visible("screen-quiz"), "Prüfung springt ohne Feedback weiter");

    let guard = 0;
    while (visible("screen-quiz") && guard < 40) {
      if (visible("qFinish")) $("qFinish").click();
      else if (visible("qNext")) { $("qOptions").querySelectorAll(".option")[0].click(); $("qNext").click(); }
      await tick(5); guard++;
    }
    assert(visible("screen-result"), "Ergebnis-Screen nach Prüfung sichtbar");
    assert($("resultBreakdown").children.length >= 1, "Aufschlüsselung nach Gebiet vorhanden");
    $("resultReview").click(); await tick(8);
    assert(visible("reviewList") && $("reviewList").children.length >= 1, "Antworten-Durchsicht funktioniert");

    console.log("\n[5] Theme-Umschaltung");
    const t0 = win.document.documentElement.getAttribute("data-theme");
    $("themeToggle").click(); await tick(5);
    assert(t0 !== win.document.documentElement.getAttribute("data-theme"), "Theme wechselt (" + t0 + " -> " + win.document.documentElement.getAttribute("data-theme") + ")");

    console.log("\n" + (errors.length ? "❌ " + errors.length + " Problem(e):\n" + errors.join("\n") : "✅ Alle UI-Tests bestanden, keine JS-Laufzeitfehler."));
    process.exit(errors.length ? 1 : 0);
  } catch (e) {
    console.error("\n❌ Ausnahme im Test:", e.stack || e.message);
    process.exit(1);
  }
})();

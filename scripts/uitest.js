// Headless-Integrationstest der Quiz-App mit jsdom
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..", "public");
let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "questions.json"), "utf8"));
// externes Script entfernen, wir injizieren manuell
html = html.replace('<script src="./js/app.js"></script>', "");

const errors = [];
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
const win = dom.window;
win.addEventListener("error", (e) => errors.push("window.error: " + e.message));

// Polyfills
win.fetch = (url) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
win.scrollTo = () => {};
win.alert = (m) => {};
win.confirm = (m) => true;

function tick(ms = 0) { return new Promise((r) => win.setTimeout(r, ms)); }
const $ = (id) => win.document.getElementById(id);
const visible = (id) => $(id) && !$(id).classList.contains("hidden");
function assert(cond, msg) { if (!cond) { errors.push("ASSERT: " + msg); console.log("  ✗ " + msg); } else { console.log("  ✓ " + msg); } }

(async () => {
  try {
    // app.js ausführen + DOMContentLoaded auslösen
    const s = win.document.createElement("script");
    s.textContent = appJs;
    win.document.body.appendChild(s);
    win.document.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));
    await tick(30);

    console.log("\n[1] Init / Startseite");
    assert(visible("screen-home"), "Startseite sichtbar nach Laden");
    assert($("fieldGrid").querySelectorAll(".field-chip").length === 3, "3 Gebiets-Kärtchen gerendert");
    assert($("termList").querySelectorAll(".term-item").length === 55, "55 Begriffe in Liste");
    assert($("heroStats").children.length === 3, "Hero-Statistik gerendert");
    assert(/Fragen/.test($("practiceMeta").textContent), "Übungs-Meta zeigt Fragenzahl");

    console.log("\n[2] Übungsmodus");
    $("startPractice").click();
    await tick(10);
    assert(visible("screen-quiz"), "Quiz-Screen sichtbar");
    assert($("qOptions").querySelectorAll(".option").length === 4, "4 Antwortoptionen gerendert");
    assert($("qText").textContent.length > 0, "Fragetext vorhanden");

    // erste Option klicken -> Feedback
    $("qOptions").querySelectorAll(".option")[0].click();
    await tick(10);
    assert(visible("qFeedback"), "Feedback nach Antwort sichtbar");
    assert($("qOptions").querySelector(".option.correct") !== null, "Korrekte Option markiert");
    const nextOrFinish = visible("qNext") || visible("qFinish");
    assert(nextOrFinish, "Weiter/Auswerten-Button erscheint");

    // ein paar Fragen durchklicken
    let steps = 0;
    while (visible("qNext") && steps < 5) {
      $("qNext").click(); await tick(5);
      $("qOptions").querySelectorAll(".option")[1].click(); await tick(5);
      steps++;
    }
    assert(steps > 0, "Mehrere Fragen durchlaufbar (" + steps + " x Weiter)");

    console.log("\n[3] Statistik-Seite");
    $("brandHome").click(); await tick(10);
    Array.from(win.document.querySelectorAll("[data-go]")).find((b) => b.getAttribute("data-go") === "stats").click();
    await tick(10);
    assert(visible("screen-stats"), "Statistik-Screen sichtbar");
    assert($("statsCards").children.length === 4, "4 Statistik-Karten");
    assert($("statsTerms").querySelectorAll(".bar-row").length === 55, "55 Begriff-Fortschrittsbalken");
    const answered = parseInt($("statsCards").children[0].querySelector("b").textContent, 10);
    assert(answered >= 1, "Beantwortete Fragen werden gezählt (" + answered + ")");

    console.log("\n[4] Prüfungsmodus mit Timer");
    $("brandHome").click(); await tick(10);
    $("examCount").value = "15"; $("examTime").value = "15";
    $("startExam").click(); await tick(10);
    assert(visible("screen-quiz"), "Prüfungs-Quiz sichtbar");
    assert(!$("quizTimer").classList.contains("hidden"), "Timer sichtbar im Prüfungsmodus");
    assert($("quizModeBadge").textContent === "Prüfungsmodus", "Badge zeigt Prüfungsmodus");
    // erste Antwort -> sollte automatisch weiterspringen (kein Feedback)
    $("qOptions").querySelectorAll(".option")[0].click();
    await tick(300);
    assert($("qFeedback").classList.contains("hidden"), "Kein Feedback im Prüfungsmodus");

    console.log("\n[5] Theme-Umschaltung");
    const before = win.document.documentElement.getAttribute("data-theme");
    $("themeToggle").click(); await tick(5);
    const after = win.document.documentElement.getAttribute("data-theme");
    assert(before !== after, "Theme wechselt (" + before + " -> " + after + ")");

    console.log("\n" + (errors.length ? "❌ " + errors.length + " Problem(e):\n" + errors.join("\n") : "✅ Alle UI-Tests bestanden, keine JS-Laufzeitfehler."));
    process.exit(errors.length ? 1 : 0);
  } catch (e) {
    console.error("\n❌ Ausnahme im Test:", e.stack || e.message);
    process.exit(1);
  }
})();

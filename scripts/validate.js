#!/usr/bin/env node
/**
 * CI-Validierung der Fragen-Datenbank (public/data/questions.json).
 * Prüft Struktur, Pflichtfelder und Mindestanzahl. Exit-Code 1 bei Fehlern.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "public", "data", "questions.json");
const MIN_QUESTIONS = 600;
const DIFFICULTIES = ["leicht", "mittel", "schwer"];

function fail(msg) { console.error("❌ " + msg); process.exitCode = 1; }

let raw;
try {
  raw = fs.readFileSync(FILE, "utf8");
} catch (e) {
  console.error("❌ Datei nicht gefunden: " + FILE);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("❌ Ungültiges JSON: " + e.message);
  process.exit(1);
}

const errors0 = process.exitCode;

if (!Array.isArray(data.fields) || data.fields.length === 0) fail("`fields` fehlt oder ist leer.");
if (!Array.isArray(data.terms) || data.terms.length === 0) fail("`terms` fehlt oder ist leer.");
if (!Array.isArray(data.questions)) { console.error("❌ `questions` fehlt."); process.exit(1); }

const termIds = new Set(data.terms.map((t) => t.id));
const seenIds = new Set();
let problems = 0;

data.questions.forEach((q, i) => {
  const where = "Frage[" + i + "]" + (q && q.id ? " (" + q.id + ")" : "");
  const bad = (m) => { if (problems < 25) console.error("  ⚠️  " + where + ": " + m); problems++; };

  if (!q || typeof q !== "object") return bad("kein Objekt");
  if (!q.id || seenIds.has(q.id)) bad("fehlende/doppelte id");
  seenIds.add(q.id);
  if (typeof q.question !== "string" || q.question.trim().length < 5) bad("Fragetext zu kurz/fehlt");
  if (!Array.isArray(q.options) || q.options.length !== 6) bad("braucht genau 6 Optionen");
  else {
    if (q.options.some((o) => typeof o !== "string" || !o.trim())) bad("leere Option");
    if (new Set(q.options.map((o) => String(o).trim())).size !== 6) bad("doppelte Optionen");
  }
  if (!Array.isArray(q.correctIndices) || q.correctIndices.length < 1) bad("correctIndices leer/fehlt");
  else {
    if (q.correctIndices.some((x) => !Number.isInteger(x) || x < 0 || x > 5)) bad("correctIndices muss 0–5 sein");
    if (new Set(q.correctIndices).size !== q.correctIndices.length) bad("correctIndices doppelt");
    if (q.correctIndices.length > 5) bad("zu viele richtige (max 5)");
  }
  if (!q.termId || !termIds.has(q.termId)) bad("termId nicht in terms: " + q.termId);
  if (q.difficulty && DIFFICULTIES.indexOf(q.difficulty) < 0) bad("unbekannte difficulty: " + q.difficulty);
});

if (problems > 0) fail(problems + " fehlerhafte Frage(n) gefunden (erste 25 oben).");

const total = data.questions.length;
if (total < MIN_QUESTIONS) fail("Nur " + total + " Fragen – Minimum ist " + MIN_QUESTIONS + ".");

// Verteilung pro Gebiet ausgeben
const byField = {};
data.questions.forEach((q) => { byField[q.field] = (byField[q.field] || 0) + 1; });

console.log("──────────────────────────────────────────");
console.log("  Fragen gesamt : " + total);
console.log("  Begriffe      : " + data.terms.length);
console.log("  Gebiete       : " + data.fields.length);
Object.keys(byField).forEach((f) => console.log("    • " + f + ": " + byField[f]));
console.log("──────────────────────────────────────────");

if (process.exitCode === errors0 || process.exitCode === undefined) {
  console.log("✅ Validierung erfolgreich.");
} else {
  console.error("❌ Validierung fehlgeschlagen.");
}

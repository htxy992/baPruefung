# 🎓 Begriffsrunde-Quiz — Senat 3

Interaktives Multiple-Choice-Quiz zur Vorbereitung auf **Prüfungsteil 3 (Begriffsrunde)**
der kommissionellen Bachelorprüfung im Studiengang Wirtschaftsingenieurwesen.

Es deckt alle **55 Begriffe** der drei Keyword-Listen ab (Anlagen 5.3, 5.7, 5.8 der Richtlinie BP2026):

| Gebiet | Begriffe |
|---|---|
| ⚙️ Fertigungstechnik | 15 |
| 📣 Marketing & Strategie | 20 |
| 🔄 Prozessmanagement | 20 |

Die Fragen wurden aus der eigenen Lernunterlage erzeugt (je 15 pro Begriff, ~825 insgesamt) und enthalten
Definition, Einordnung, Abgrenzungen, Beispiele und Detailwissen — jeweils mit Erklärung zur Lösung.

## ✨ Funktionen

- **📝 Übungsmodus** — Frage für Frage mit sofortigem Feedback und Erklärung.
- **⏱️ Prüfungsmodus** — Zufallsziehung auf Zeit (10/15/25 min), Bewertung am Ende, wie die echte Begriffsrunde.
- **🎯 Filter** — gezielt nach Gebiet oder einzelnen Begriffen üben.
- **🔁 Falsch-beantwortete wiederholen** — eigener Wiederholungs-Stapel (Spaced-Repetition-light).
- **📊 Statistik & Fortschritt** — Trefferquote pro Gebiet und Beherrschung pro Begriff, lokal gespeichert (`localStorage`).
- **🌙 Hell-/Dunkel-Modus**, vollständig responsiv, Tastatursteuerung (A–D / 1–4, Enter).

## 🗂️ Projektstruktur

```
.
├── public/                  # Die statische Website (wird deployt)
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js            # Quiz-Engine (Vanilla JS, kein Build nötig)
│   └── data/questions.json  # Die Fragen-Datenbank
├── scripts/
│   ├── validate.js          # CI: prüft Struktur & Mindestanzahl der Fragen
│   ├── uitest.js            # CI: Headless-UI-Smoke-Test (jsdom)
│   └── assemble.py          # Baut questions.json aus den Roh-Fragedateien
├── .github/workflows/deploy.yml   # CI/CD: Validieren → Testen → Deploy auf Pages
└── package.json
```

> Hinweis: Die Roh-Materialien (PDF-Text, pro-Begriff erzeugte Fragedateien) liegen unter `scratch/`
> und sind via `.gitignore` ausgenommen. Die fertige `public/data/questions.json` ist eingecheckt.

## 🚀 Lokale Entwicklung

```bash
# Website lokal starten (http://localhost:8099)
npm run serve

# Fragen-Datenbank validieren (Struktur + Mindestanzahl)
npm run validate

# Headless-UI-Test (benötigt jsdom: npm ci)
npm run uitest

# Beides zusammen
npm test
```

Die Website braucht **keinen Build-Schritt** — reines HTML/CSS/JS. `npm` wird nur für die Tests benötigt.

## ⚙️ Fragen neu erzeugen / ergänzen

`scripts/assemble.py` setzt die finale `public/data/questions.json` aus den einzelnen
Begriff-Dateien (`scratch/questions/<id>.json`) zusammen und validiert sie dabei:

```bash
python3 scripts/assemble.py
```

Jede Begriff-Datei ist ein JSON-Array mit Objekten der Form:

```json
{ "question": "…", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "…", "difficulty": "leicht" }
```

## ☁️ Deployment (GitHub Pages + Actions)

Bei jedem Push auf `main` (oder den Entwicklungsbranch) läuft `.github/workflows/deploy.yml`:

1. **validate** — `npm ci`, JSON-Struktur prüfen, Headless-UI-Test.
2. **deploy** — `./public` als Artefakt hochladen und auf **GitHub Pages** veröffentlichen.

### Einmalige Einrichtung (im Repo nötig)

Damit das Deployment greift, muss GitHub Pages auf **GitHub Actions** als Quelle gestellt werden:

> **Repo → Settings → Pages → Build and deployment → Source: „GitHub Actions“**

Danach ist die Seite erreichbar unter:

```
https://htxy992.github.io/bapruefung/
```

Läuft das Deployment von einem Feature-Branch und wird durch die Environment-Schutzregeln blockiert,
entweder nach `main` mergen **oder** unter *Settings → Environments → github-pages* den Branch erlauben.

## 📄 Datenschutz

Es werden keine Daten an Server gesendet. Lernfortschritt und Statistik liegen ausschließlich
lokal im Browser (`localStorage`).

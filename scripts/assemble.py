#!/usr/bin/env python3
"""
Baut aus den pro-Begriff erzeugten Fragedateien (scratch/questions/*.json)
die finale Fragen-Datenbank public/data/questions.json zusammen.

Aufruf:  python3 scripts/assemble.py
"""
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TERMS_FILE = os.path.join(ROOT, "scratch", "terms.json")
Q_DIR = os.path.join(ROOT, "scratch", "questions")
OUT = os.path.join(ROOT, "public", "data", "questions.json")
DIFFS = {"leicht", "mittel", "schwer"}


def valid_question(q):
    if not isinstance(q, dict):
        return False, "kein Objekt"
    if not isinstance(q.get("question"), str) or len(q["question"].strip()) < 5:
        return False, "Fragetext fehlt/zu kurz"
    opts = q.get("options")
    if not isinstance(opts, list) or len(opts) != 6:
        return False, "braucht 6 Optionen"
    if any(not isinstance(o, str) or not o.strip() for o in opts):
        return False, "leere Option"
    if len({o.strip() for o in opts}) != 6:
        return False, "doppelte Optionen"
    ci = q.get("correctIndices")
    if not isinstance(ci, list) or len(ci) < 1:
        return False, "correctIndices leer/fehlt"
    if any((not isinstance(x, int)) or isinstance(x, bool) or x < 0 or x > 5 for x in ci):
        return False, "correctIndices muss 0-5 sein"
    if len(set(ci)) != len(ci):
        return False, "correctIndices doppelt"
    if len(set(ci)) > 5:
        return False, "zu viele richtige (max 5)"
    return True, ""


def main():
    terms = json.load(open(TERMS_FILE, encoding="utf-8"))
    terms_meta = [{"id": t["id"], "field": t["field"], "title": t["title"]} for t in terms]
    fields = []
    for t in terms_meta:
        if t["field"] not in fields:
            fields.append(t["field"])

    questions = []
    per_term = {}
    issues = []
    missing = []

    for t in terms_meta:
        path = os.path.join(Q_DIR, t["id"] + ".json")
        if not os.path.exists(path):
            missing.append(t["id"])
            per_term[t["id"]] = 0
            continue
        try:
            arr = json.load(open(path, encoding="utf-8"))
        except Exception as e:
            issues.append(f"{t['id']}: JSON-Fehler ({e})")
            per_term[t["id"]] = 0
            continue
        if not isinstance(arr, list):
            issues.append(f"{t['id']}: kein Array")
            per_term[t["id"]] = 0
            continue
        kept = 0
        for i, q in enumerate(arr):
            ok, why = valid_question(q)
            if not ok:
                issues.append(f"{t['id']}[{i}]: {why}")
                continue
            diff = q.get("difficulty")
            if diff not in DIFFS:
                diff = "mittel"
            kept += 1
            questions.append({
                "id": f"{t['id']}-{kept}",
                "termId": t["id"],
                "field": t["field"],
                "termTitle": t["title"],
                "question": q["question"].strip(),
                "options": [o.strip() for o in q["options"]],
                "correctIndices": sorted(set(int(x) for x in q["correctIndices"])),
                "explanation": (q.get("explanation") or "").strip(),
                "difficulty": diff,
            })
        per_term[t["id"]] = kept

    data = {
        "meta": {
            "generated": date.today().isoformat(),
            "format": "multiple-response",
            "optionsPerQuestion": 6,
            "totalQuestions": len(questions),
            "terms": len(terms_meta),
            "fields": len(fields),
        },
        "fields": fields,
        "terms": terms_meta,
        "questions": questions,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # Bericht
    print(f"Geschrieben: {OUT}")
    print(f"Format: Multiple-Response (6 Optionen, mehrere richtige)")
    print(f"Fragen gesamt: {len(questions)}  |  Begriffe: {len(terms_meta)}  |  Gebiete: {len(fields)}")
    for f in fields:
        n = sum(1 for q in questions if q["field"] == f)
        print(f"  • {f}: {n}")
    dist = {}
    for q in questions:
        k = len(q["correctIndices"])
        dist[k] = dist.get(k, 0) + 1
    print("  richtige Antworten/Frage: " + ", ".join(f"{k}x→{dist[k]}" for k in sorted(dist)))
    low = [tid for tid, n in per_term.items() if n < 15]
    if missing:
        print(f"\n⚠️  FEHLENDE Begriff-Dateien ({len(missing)}): {', '.join(missing)}")
    if low:
        print(f"\n⚠️  Begriffe mit < 15 gültigen Fragen ({len(low)}):")
        for tid in low:
            print(f"     {tid}: {per_term[tid]}")
    if issues:
        print(f"\n⚠️  {len(issues)} Einzelprobleme (erste 20):")
        for s in issues[:20]:
            print("     " + s)
    if not missing and not low and not issues:
        print(f"\n✅ Alle {len(terms_meta)} Begriffe mit je 15 gültigen Fragen, keine Probleme.")

    # Exit-Code für CI/Automatisierung
    return 0 if (not missing and len(questions) >= 600) else 1


if __name__ == "__main__":
    sys.exit(main())

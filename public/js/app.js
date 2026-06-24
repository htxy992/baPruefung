/* ===== BA-Prüfung Begriffsrunde-Quiz — App-Logik ===== */
(function () {
  "use strict";

  var FIELD_COLORS = {
    "Fertigungstechnik": "var(--f-fertigung)",
    "Marketing": "var(--f-marketing)",
    "Prozessmanagement": "var(--f-prozess)"
  };
  var LS = { theme: "bq_theme", stats: "bq_stats", wrong: "bq_wrong", sel: "bq_sel" };

  var DATA = null;            // { meta, fields, terms, questions }
  var QBY_ID = {};            // id -> question
  var sel = { fields: new Set(), terms: new Set() };
  var session = null;         // aktuelle Quiz-Sitzung

  /* ---------- Hilfsfunktionen ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function load(key, def) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  /* ---------- Statistik ---------- */
  function getStats() { return load(LS.stats, { perTerm: {}, perField: {}, totalAnswered: 0, totalCorrect: 0 }); }
  function recordAnswer(q, isCorrect) {
    var st = getStats();
    st.totalAnswered++; if (isCorrect) st.totalCorrect++;
    var pt = st.perTerm[q.termId] || { c: 0, t: 0 }; pt.t++; if (isCorrect) pt.c++; st.perTerm[q.termId] = pt;
    var pf = st.perField[q.field] || { c: 0, t: 0 }; pf.t++; if (isCorrect) pf.c++; st.perField[q.field] = pf;
    save(LS.stats, st);
    var wrong = load(LS.wrong, []);
    var i = wrong.indexOf(q.id);
    if (isCorrect) { if (i >= 0) wrong.splice(i, 1); }
    else if (i < 0) wrong.push(q.id);
    save(LS.wrong, wrong);
  }

  /* ---------- Routing ---------- */
  function showScreen(name) {
    ["loading", "home", "quiz", "result", "stats"].forEach(function (s) {
      var node = $("screen-" + s); if (node) node.classList.toggle("hidden", s !== name);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- Theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $("themeToggle").textContent = t === "dark" ? "☀️" : "🌙";
    save(LS.theme, t);
  }

  /* ---------- Startseite ---------- */
  function renderHome() {
    // Hero-Statistik
    var hs = $("heroStats"); hs.innerHTML = "";
    [["Begriffe", DATA.terms.length], ["Fragen", DATA.questions.length], ["Gebiete", DATA.fields.length]]
      .forEach(function (x) { hs.appendChild(el("div", "hero-stat", "<b>" + x[1] + "</b><span>" + x[0] + "</span>")); });

    // Gebiete
    var fg = $("fieldGrid"); fg.innerHTML = "";
    DATA.fields.forEach(function (f) {
      var n = DATA.questions.filter(function (q) { return q.field === f; }).length;
      var t = DATA.terms.filter(function (x) { return x.field === f; }).length;
      var chip = el("button", "field-chip" + (sel.fields.has(f) ? " active" : ""));
      chip.type = "button";
      chip.dataset.field = f;
      chip.style.setProperty("--accent", FIELD_COLORS[f] || "var(--primary)");
      chip.innerHTML = '<div class="fc-top"><span class="fc-name"><span class="fc-dot"></span>' + esc(f) +
        '</span><span class="fc-check">✓</span></div><span class="fc-meta">' + t + " Begriffe · " + n + " Fragen</span>";
      chip.addEventListener("click", function () {
        if (sel.fields.has(f)) sel.fields.delete(f); else sel.fields.add(f);
        // Begriffsauswahl an Gebiete angleichen
        syncTermsToFields();
        persistSel(); renderHome();
      });
      fg.appendChild(chip);
    });

    // Begriffsliste
    var tl = $("termList"); tl.innerHTML = "";
    DATA.terms.forEach(function (t) {
      var row = el("label", "term-item");
      var checked = sel.terms.has(t.id) ? "checked" : "";
      row.innerHTML = '<input type="checkbox" ' + checked + ' data-term="' + t.id + '">' +
        '<span class="ti-id">' + t.id + '</span><span>' + esc(t.title) + "</span>";
      row.querySelector("input").addEventListener("change", function (e) {
        if (e.target.checked) sel.terms.add(t.id); else sel.terms.delete(t.id);
        syncFieldsToTerms(); persistSel(); updateCounts();
      });
      tl.appendChild(row);
    });

    updateCounts();
    renderRetryRow();
  }

  function selectedQuestions() {
    return DATA.questions.filter(function (q) { return sel.terms.has(q.termId); });
  }
  function updateCounts() {
    var n = selectedQuestions().length;
    $("termPickerCount").textContent = "(" + sel.terms.size + "/" + DATA.terms.length + " Begriffe · " + n + " Fragen)";
    $("practiceMeta").textContent = n + " Fragen ausgewählt";
    // Modus-Buttons sperren, wenn nichts gewählt
    $("startPractice").disabled = n === 0;
    $("startExam").disabled = n === 0;
  }
  function syncTermsToFields() {
    // Wenn ein Gebiet aktiv ist, alle seine Begriffe wählen; sonst abwählen
    DATA.terms.forEach(function (t) {
      if (sel.fields.has(t.field)) sel.terms.add(t.id); else sel.terms.delete(t.id);
    });
  }
  function syncFieldsToTerms() {
    DATA.fields.forEach(function (f) {
      var termsOfField = DATA.terms.filter(function (t) { return t.field === f; });
      var allOn = termsOfField.every(function (t) { return sel.terms.has(t.id); });
      if (allOn && termsOfField.length) sel.fields.add(f); else sel.fields.delete(f);
    });
    updateFieldChips();
  }
  function updateFieldChips() {
    document.querySelectorAll(".field-chip").forEach(function (c) {
      c.classList.toggle("active", sel.fields.has(c.dataset.field));
    });
  }
  function persistSel() { save(LS.sel, { fields: Array.from(sel.fields), terms: Array.from(sel.terms) }); }

  function renderRetryRow() {
    var wrong = load(LS.wrong, []).filter(function (id) { return QBY_ID[id]; });
    $("retryCount").textContent = wrong.length;
    $("startRetry").disabled = wrong.length === 0;
  }

  /* ---------- Quiz starten ---------- */
  function startQuiz(mode, opts) {
    opts = opts || {};
    var pool;
    if (mode === "retry") {
      var wrong = load(LS.wrong, []);
      pool = wrong.map(function (id) { return QBY_ID[id]; }).filter(Boolean);
    } else {
      pool = selectedQuestions();
    }
    if (!pool.length) { alert("Keine Fragen ausgewählt."); return; }
    var questions = shuffle(pool);
    if (mode === "exam" && opts.count && questions.length > opts.count) questions = questions.slice(0, opts.count);

    session = {
      mode: mode, questions: questions, idx: 0,
      answers: new Array(questions.length).fill(null),
      timeLeft: (mode === "exam" && opts.time) ? opts.time * 60 : 0,
      timer: null, startTs: Date.now()
    };
    showScreen("quiz");
    setupQuizChrome();
    renderQuestion();
    if (session.timeLeft > 0) startTimer();
  }

  function setupQuizChrome() {
    var labels = { practice: "Übungsmodus", exam: "Prüfungsmodus", retry: "Wiederholung" };
    $("quizModeBadge").textContent = labels[session.mode];
    var fields = Array.from(new Set(session.questions.map(function (q) { return q.field; })));
    $("quizFieldBadge").textContent = fields.length === DATA.fields.length ? "Alle Gebiete" : fields.join(" · ");
    $("quizTimer").classList.toggle("hidden", session.timeLeft <= 0);
    $("quizScore").classList.toggle("hidden", session.mode === "exam");
  }

  function startTimer() {
    updateTimerDisplay();
    session.timer = setInterval(function () {
      session.timeLeft--;
      updateTimerDisplay();
      if (session.timeLeft <= 0) { clearInterval(session.timer); finishQuiz(); }
    }, 1000);
  }
  function updateTimerDisplay() {
    var m = Math.floor(session.timeLeft / 60), s = session.timeLeft % 60;
    var t = $("quizTimer");
    t.textContent = "⏱️ " + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    t.classList.toggle("warn", session.timeLeft <= 30);
  }

  function renderQuestion() {
    var q = session.questions[session.idx];
    var n = session.questions.length;
    $("quizProgress").style.width = pct(session.idx, n) + "%";
    $("quizCounter").textContent = "Frage " + (session.idx + 1) + " von " + n;
    if (session.mode !== "exam") {
      var correct = session.answers.filter(function (a) { return a && a.correct; }).length;
      $("quizScore").textContent = "✔ " + correct + " richtig";
    }
    var term = DATA.terms.find(function (t) { return t.id === q.termId; });
    var fc = $("qTerm"); fc.style.setProperty("--accent", FIELD_COLORS[q.field] || "var(--primary)");
    fc.textContent = q.field + " · " + q.termId + " " + (term ? term.title : "");

    $("qText").textContent = q.question;
    session.selected = {};      // orig-Index -> true
    session.checked = false;
    var ob = $("qOptions"); ob.innerHTML = "";
    var keys = ["A", "B", "C", "D", "E", "F"];
    // 6 Optionen pro Anzeige zufällig mischen (gegen Positions-Bias & Auswendiglernen)
    shuffle([0, 1, 2, 3, 4, 5]).forEach(function (origIdx, pos) {
      var b = el("button", "option"); b.type = "button";
      b.dataset.orig = origIdx;
      b.setAttribute("aria-pressed", "false");
      b.innerHTML = '<span class="opt-key">' + keys[pos] + '</span><span class="opt-text">' + esc(q.options[origIdx]) + "</span>";
      b.addEventListener("click", function () { toggleOption(origIdx, b); });
      ob.appendChild(b);
    });
    $("qFeedback").classList.add("hidden");
    var exam = session.mode === "exam";
    $("qCheck").classList.toggle("hidden", exam);   // Übung: erst prüfen; Prüfung: direkt weiter
    if (exam) showLastButton();
    else { $("qNext").classList.add("hidden"); $("qFinish").classList.add("hidden"); }
  }

  function toggleOption(orig, btn) {
    if (session.checked) return;                    // nach dem Prüfen gesperrt
    if (session.selected[orig]) { delete session.selected[orig]; btn.classList.remove("selected"); btn.setAttribute("aria-pressed", "false"); }
    else { session.selected[orig] = true; btn.classList.add("selected"); btn.setAttribute("aria-pressed", "true"); }
  }

  function selectedSet() { return Object.keys(session.selected).map(Number); }

  function isAnswerCorrect(q) {                      // exakte Mengengleichheit
    var sel = selectedSet(), corr = q.correctIndices;
    if (sel.length !== corr.length) return false;
    for (var i = 0; i < corr.length; i++) if (!session.selected[corr[i]]) return false;
    return true;
  }

  function markOptions(q) {
    $("qOptions").querySelectorAll(".option").forEach(function (b) {
      var orig = parseInt(b.dataset.orig, 10);
      var isCorr = q.correctIndices.indexOf(orig) >= 0;
      var sel = !!session.selected[orig];
      b.disabled = true;
      b.classList.remove("selected");
      var mark = "";
      if (isCorr && sel) { b.classList.add("correct"); mark = " ✔"; }
      else if (isCorr && !sel) { b.classList.add("missed"); mark = " ✔ übersehen"; }
      else if (!isCorr && sel) { b.classList.add("wrong"); mark = " ✗"; }
      if (mark) b.querySelector(".opt-text").insertAdjacentHTML("beforeend", '<span class="opt-mark">' + mark + "</span>");
    });
  }

  function checkAnswer() {                            // Übung / Wiederholung
    if (session.checked) return;
    var q = session.questions[session.idx];
    var isCorrect = isAnswerCorrect(q);
    session.answers[session.idx] = { selected: selectedSet(), correct: isCorrect };
    session.checked = true;
    recordAnswer(q, isCorrect);
    markOptions(q);
    var fb = $("qFeedback");
    fb.className = "feedback " + (isCorrect ? "ok" : "no");
    $("qFeedbackHead").textContent = isCorrect ? "✔ Richtig!" : "✗ Nicht ganz";
    $("qExplanation").textContent = q.explanation || "";
    $("qCheck").classList.add("hidden");
    showLastButton();
  }

  function recordCurrentExam() {                      // Prüfungsmodus: Auswahl ohne Feedback sichern
    var q = session.questions[session.idx];
    session.answers[session.idx] = { selected: selectedSet(), correct: isAnswerCorrect(q) };
  }

  function showLastButton() {
    var last = session.idx === session.questions.length - 1;
    $("qNext").classList.toggle("hidden", last);
    $("qFinish").classList.toggle("hidden", !last);
  }

  function advance() {
    if (session.mode === "exam") recordCurrentExam();
    if (session.idx < session.questions.length - 1) { session.idx++; renderQuestion(); }
    else finishQuiz();
  }

  function finishQuiz() {
    if (session.timer) clearInterval(session.timer);
    if (session.mode === "exam") {
      // Statistik erst am Ende verbuchen
      session.questions.forEach(function (q, i) {
        var a = session.answers[i];
        recordAnswer(q, !!(a && a.correct));
      });
    }
    renderResult();
  }

  /* ---------- Ergebnis ---------- */
  function renderResult() {
    showScreen("result");
    var qs = session.questions, ans = session.answers;
    var correct = ans.filter(function (a) { return a && a.correct; }).length;
    var total = qs.length, p = pct(correct, total);

    $("resultScore").innerHTML = "<b>" + correct + "</b> von " + total + " richtig &nbsp;·&nbsp; " + p + " %";
    var bar = $("resultBarFill"); bar.style.width = p + "%";
    bar.style.background = p >= 80 ? "var(--green)" : p >= 50 ? "var(--amber)" : "var(--red)";
    var emoji = p >= 90 ? "🏆" : p >= 75 ? "🎉" : p >= 50 ? "👍" : "📚";
    $("resultEmoji").textContent = emoji;
    var titles = { practice: "Übung abgeschlossen", exam: "Prüfung ausgewertet", retry: "Wiederholung fertig" };
    $("resultTitle").textContent = titles[session.mode] || "Ergebnis";

    // Aufschlüsselung nach Gebiet
    var byField = {};
    qs.forEach(function (q, i) {
      var f = byField[q.field] || { c: 0, t: 0 }; f.t++; if (ans[i] && ans[i].correct) f.c++; byField[q.field] = f;
    });
    var bd = $("resultBreakdown"); bd.innerHTML = "";
    Object.keys(byField).forEach(function (f) {
      var d = byField[f], pp = pct(d.c, d.t);
      var row = el("div", "rb-row");
      row.innerHTML = '<span class="rb-name">' + esc(f) + '</span>' +
        '<span class="rb-track"><span class="rb-fill" style="width:' + pp + '%;background:' + (FIELD_COLORS[f] || "var(--primary)") + '"></span></span>' +
        '<span class="rb-val">' + d.c + "/" + d.t + " · " + pp + "%</span>";
      bd.appendChild(row);
    });

    // Review vorbereiten
    $("reviewList").classList.add("hidden");
    $("reviewList").innerHTML = "";
    var wrongCount = total - correct;
    $("resultRetryWrong").style.display = wrongCount > 0 ? "" : "none";
    renderRetryRow();
  }

  function renderReview() {
    var rl = $("reviewList"); rl.innerHTML = "";
    session.questions.forEach(function (q, i) {
      var a = session.answers[i];
      var ok = a && a.correct;
      var sel = (a && a.selected) || [];
      var item = el("div", "review-item" + (ok ? " ok" : ""));
      var correctTxt = q.correctIndices.map(function (ci) { return esc(q.options[ci]); }).join(" · ");
      var html = '<div class="review-q">' + (i + 1) + ". " + esc(q.question) + "</div>";
      html += '<div class="review-a correct"><span class="tag">✔ Richtig:</span> ' + correctTxt + "</div>";
      if (!ok) {
        var wrongPicks = sel.filter(function (s) { return q.correctIndices.indexOf(s) < 0; }).map(function (s) { return esc(q.options[s]); });
        var missed = q.correctIndices.filter(function (ci) { return sel.indexOf(ci) < 0; }).map(function (ci) { return esc(q.options[ci]); });
        if (wrongPicks.length) html += '<div class="review-a yours"><span class="tag">✗ Falsch gewählt:</span> ' + wrongPicks.join(" · ") + "</div>";
        if (missed.length) html += '<div class="review-a miss"><span class="tag">⚠ Übersehen:</span> ' + missed.join(" · ") + "</div>";
        if (!sel.length) html += '<div class="review-a yours"><span class="tag">—</span> nichts ausgewählt</div>';
      }
      if (q.explanation) html += '<div class="review-expl">💡 ' + esc(q.explanation) + "</div>";
      item.innerHTML = html;
      rl.appendChild(item);
    });
    rl.classList.remove("hidden");
    rl.scrollIntoView({ behavior: "smooth" });
  }

  /* ---------- Statistik-Seite ---------- */
  function renderStats() {
    showScreen("stats");
    var st = getStats();
    var acc = pct(st.totalCorrect, st.totalAnswered);
    var practicedTerms = Object.keys(st.perTerm).length;
    var cards = $("statsCards"); cards.innerHTML = "";
    [["Beantwortet", st.totalAnswered], ["Davon richtig", st.totalCorrect], ["Trefferquote", acc + " %"], ["Begriffe geübt", practicedTerms + "/" + DATA.terms.length]]
      .forEach(function (x) { cards.appendChild(el("div", "stat-card", "<b>" + x[1] + "</b><span>" + x[0] + "</span>")); });

    var sf = $("statsFields"); sf.innerHTML = "";
    DATA.fields.forEach(function (f) {
      var d = st.perField[f] || { c: 0, t: 0 }, pp = pct(d.c, d.t);
      var row = el("div", "bar-row");
      row.innerHTML = '<span class="bar-name"><span class="dot" style="background:' + (FIELD_COLORS[f] || "var(--primary)") + '"></span>' + esc(f) + "</span>" +
        '<span class="bar-track"><span class="bar-fill" style="width:' + pp + '%;background:' + (FIELD_COLORS[f] || "var(--primary)") + '"></span></span>' +
        '<span class="bar-val">' + d.c + "/" + d.t + " · " + pp + "%</span>";
      sf.appendChild(row);
    });

    var stm = $("statsTerms"); stm.innerHTML = "";
    DATA.terms.forEach(function (t) {
      var d = st.perTerm[t.id] || { c: 0, t: 0 }, pp = pct(d.c, d.t);
      var row = el("div", "bar-row");
      var label = d.t ? (d.c + "/" + d.t + " · " + pp + "%") : "noch nicht geübt";
      row.innerHTML = '<span class="bar-name"><span class="term-stat-id">' + t.id + "</span>&nbsp;" + esc(t.title) + "</span>" +
        '<span class="bar-track"><span class="bar-fill" style="width:' + pp + '%;background:' + (FIELD_COLORS[t.field] || "var(--primary)") + '"></span></span>' +
        '<span class="bar-val">' + label + "</span>";
      stm.appendChild(row);
    });
  }

  /* ---------- Beenden / bestätigen ---------- */
  function quitQuiz() {
    if (session && session.timer) clearInterval(session.timer);
    var answered = session ? session.answers.filter(Boolean).length : 0;
    if (answered > 0 && session.mode === "exam") {
      if (confirm("Prüfung beenden und auswerten?")) { finishQuiz(); return; }
      if (session.timeLeft > 0) startTimer();
      return;
    }
    goHome();
  }
  function goHome() { if (session && session.timer) clearInterval(session.timer); session = null; renderHome(); showScreen("home"); }

  /* ---------- Events ---------- */
  function bindEvents() {
    $("themeToggle").addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      applyTheme(cur === "dark" ? "light" : "dark");
    });
    document.querySelectorAll("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () { var g = b.getAttribute("data-go"); if (g === "home") goHome(); else if (g === "stats") renderStats(); });
    });
    $("brandHome").addEventListener("click", goHome);

    $("termAll").addEventListener("click", function () { DATA.terms.forEach(function (t) { sel.terms.add(t.id); }); syncFieldsToTerms(); persistSel(); renderHome(); });
    $("termNone").addEventListener("click", function () { sel.terms.clear(); sel.fields.clear(); persistSel(); renderHome(); });

    $("startPractice").addEventListener("click", function () { startQuiz("practice", {}); });
    $("startExam").addEventListener("click", function () {
      startQuiz("exam", { count: parseInt($("examCount").value, 10), time: parseInt($("examTime").value, 10) });
    });
    $("startRetry").addEventListener("click", function () { startQuiz("retry", {}); });
    $("clearRetry").addEventListener("click", function () { if (confirm("Liste der falsch beantworteten Fragen leeren?")) { save(LS.wrong, []); renderRetryRow(); } });

    $("qCheck").addEventListener("click", checkAnswer);
    $("qNext").addEventListener("click", advance);
    $("qFinish").addEventListener("click", function () { if (session && session.mode === "exam") recordCurrentExam(); finishQuiz(); });
    $("quizQuit").addEventListener("click", quitQuiz);

    $("resultReview").addEventListener("click", renderReview);
    $("resultHome").addEventListener("click", goHome);
    $("resultRetryWrong").addEventListener("click", function () {
      // Falsche dieser Runde wiederholen
      var wrongQs = session.questions.filter(function (q, i) { return !(session.answers[i] && session.answers[i].correct); });
      if (!wrongQs.length) return;
      session = { mode: "retry", questions: shuffle(wrongQs), idx: 0, answers: new Array(wrongQs.length).fill(null), timeLeft: 0, timer: null, startTs: Date.now() };
      showScreen("quiz"); setupQuizChrome(); renderQuestion();
    });

    $("resetStats").addEventListener("click", function () {
      if (confirm("Wirklich alle Statistiken, den Fortschritt und die Wiederholungs-Liste löschen?")) {
        localStorage.removeItem(LS.stats); localStorage.removeItem(LS.wrong);
        renderStats();
      }
    });

    // Tastatur: A–F / 1–6 zum Aus-/Abwählen, Enter = Prüfen bzw. Weiter
    document.addEventListener("keydown", function (e) {
      if ($("screen-quiz").classList.contains("hidden") || !session) return;
      var map = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5 };
      var k = e.key.toLowerCase();
      if (map[k] != null) {
        var btns = $("qOptions").querySelectorAll(".option");
        if (btns[map[k]]) btns[map[k]].click();
      } else if (e.key === "Enter") {
        if (!$("qCheck").classList.contains("hidden")) checkAnswer();
        else if (!$("qNext").classList.contains("hidden")) advance();
        else if (!$("qFinish").classList.contains("hidden")) { if (session.mode === "exam") recordCurrentExam(); finishQuiz(); }
      }
    });
  }

  /* ---------- Init ---------- */
  var booted = false;
  function init() {
    if (booted) return;   // gegen doppeltes DOMContentLoaded absichern
    booted = true;
    applyTheme(load(LS.theme, window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    bindEvents();
    fetch("./data/questions.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) {
        DATA = data;
        DATA.questions.forEach(function (q) { QBY_ID[q.id] = q; });
        $("footMeta").textContent = (DATA.meta && DATA.meta.generated ? "Stand: " + DATA.meta.generated + " · " : "") + DATA.questions.length + " Fragen";
        // Auswahl wiederherstellen oder alle Gebiete vorwählen
        var saved = load(LS.sel, null);
        if (saved && saved.terms && saved.terms.length) {
          saved.fields.forEach(function (f) { sel.fields.add(f); });
          saved.terms.forEach(function (t) { if (DATA.terms.some(function (x) { return x.id === t; })) sel.terms.add(t); });
        } else {
          DATA.fields.forEach(function (f) { sel.fields.add(f); });
          DATA.terms.forEach(function (t) { sel.terms.add(t.id); });
        }
        renderHome();
        showScreen("home");
      })
      .catch(function (err) {
        $("screen-loading").innerHTML = '<div class="loading"><p>⚠️ Fragen konnten nicht geladen werden.<br><span class="muted small">' + esc(err.message) + "</span></p></div>";
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();

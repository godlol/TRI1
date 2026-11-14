(function () {
  'use strict';

  var D = JSON.parse(document.getElementById('guide-data').textContent);
  var KEY = 'ap-study-guide-v2';
  var L = ['A', 'B', 'C', 'D'];
  var state = { answers: {}, graded: {} };
  var units = [], Q = {}, U = {};

  D.courses.forEach(function (c) {
    c.units.forEach(function (u) {
      u.course = c;
      units.push(u);
      U[u.id] = u;
      u.q.forEach(function (q) { q.unit = u; Q[q.id] = q; });
    });
  });

  var views = {};
  Array.prototype.forEach.call(document.querySelectorAll('.view'), function (el) {
    views[el.getAttribute('data-view')] = el;
  });
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.mainnav a'));
  var current = 'overview';

  function $(id) { return document.getElementById(id); }
  function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- saved answers ----------
  function clean(s) {
    var out = { answers: {}, graded: {} };
    if (s && typeof s === 'object') {
      var a = s.answers || {}, g = s.graded || {};
      Object.keys(a).forEach(function (k) {
        if (Q[k] && (a[k] === 0 || a[k] === 1 || a[k] === 2 || a[k] === 3)) out.answers[k] = a[k];
      });
      Object.keys(g).forEach(function (k) { if (U[k] && g[k]) out.graded[k] = g[k]; });
    }
    return out;
  }
  function load(seed) {
    var stored = null;
    try { stored = JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (e) { stored = null; }
    var useSeed = seed && seed.answers && Object.keys(seed.answers).length > 0;
    state = clean(useSeed ? seed : stored);
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable: answers last for this visit only */ }
  }

  // Saved answers hold the position a choice was written in; q.o maps displayed positions to those.
  function picked(q) {
    var v = state.answers[q.id];
    if (v === undefined) return undefined;
    var k = q.o.indexOf(v);
    return k < 0 ? undefined : k;
  }

  function stats(u) {
    var s = { total: u.q.length, answered: 0, correct: 0, graded: !!state.graded[u.id] };
    u.q.forEach(function (q) {
      var a = picked(q);
      if (a !== undefined) { s.answered++; if (a === q.a) s.correct++; }
    });
    return s;
  }
  function topicStats(u) {
    var map = {}, order = [];
    u.q.forEach(function (q) {
      if (!map[q.n]) { map[q.n] = { n: q.n, t: q.t, total: 0, correct: 0, unit: u, first: q }; order.push(map[q.n]); }
      map[q.n].total++;
      if (picked(q) === q.a) map[q.n].correct++;
    });
    return order;
  }
  function gradedUnits() { return units.filter(function (u) { return !!state.graded[u.id]; }); }

  // ---------- practice ----------
  function btn(label, action, uid, solid, disabled) {
    return '<button type="button" class="btn' + (solid ? ' btn-solid' : '') + '" data-action="' + action + '" data-unit="' + esc(uid || '') + '"' +
      (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
  }

  function paintBar(u, mode) {
    var s = stats(u), bar = $('gb-' + u.id), text, actions, status;
    var left = s.total - s.answered;
    if (mode === 'confirm') {
      text = 'Clear your answers for ' + esc(u.label) + ' and start it again?';
      actions = btn('Yes, clear and retake', 'retake-yes', u.id, true) + btn('Cancel', 'retake-no', u.id);
    } else if (s.graded) {
      text = '<b>' + s.correct + ' of ' + s.total + ' correct (' + pct(s.correct, s.total) + '%).</b> ' +
        (left ? left + ' skipped. ' : '') + 'Each miss has an explanation under it.';
      actions = '<a class="btn btn-solid" href="#report" data-go="report">See score report</a>' + btn('Retake ' + u.label, 'retake-ask', u.id);
    } else {
      if (s.answered === 0) text = 'Answer the questions, then grade this unit.';
      else if (left) text = s.answered + ' of ' + s.total + ' answered. Unanswered questions will be marked as skipped.';
      else text = 'All ' + s.total + ' answered. Ready to grade.';
      actions = btn('Grade ' + u.label, 'grade', u.id, true, s.answered === 0);
    }
    bar.querySelector('.gb-text').innerHTML = text;
    bar.querySelector('.gb-actions').innerHTML = actions;
    if (s.graded) status = 'Graded: ' + s.correct + ' of ' + s.total + ' correct (' + pct(s.correct, s.total) + '%)';
    else if (s.answered) status = s.answered + ' of ' + s.total + ' answered, not graded yet';
    else status = 'Not started';
    $('us-' + u.id).textContent = status;
  }

  function paintUnit(u) {
    var graded = !!state.graded[u.id];
    u.q.forEach(function (q) {
      var el = $(q.el);
      var chosen = picked(q);
      var inputs = el.querySelectorAll('input');
      var labels = el.querySelectorAll('.choice');
      var verdict = el.querySelector('.verdict');
      var why = el.querySelector('.why');
      var k;
      el.classList.remove('is-graded', 'is-right', 'is-wrong', 'is-skipped');
      for (k = 0; k < inputs.length; k++) {
        inputs[k].checked = chosen === k;
        inputs[k].disabled = graded;
        labels[k].classList.remove('is-answer', 'is-miss');
      }
      if (graded) {
        el.classList.add('is-graded');
        labels[q.a].classList.add('is-answer');
        if (chosen === undefined) {
          el.classList.add('is-skipped');
          verdict.textContent = 'Skipped. The answer is ' + L[q.a] + '.';
        } else if (chosen === q.a) {
          el.classList.add('is-right');
          verdict.textContent = 'Correct.';
        } else {
          el.classList.add('is-wrong');
          labels[chosen].classList.add('is-miss');
          verdict.textContent = 'Incorrect. You chose ' + L[chosen] + '. The answer is ' + L[q.a] + '.';
        }
        verdict.hidden = false;
        why.hidden = false;
        why.open = chosen !== q.a;
      } else {
        verdict.hidden = true;
        verdict.textContent = '';
        why.hidden = true;
        why.open = false;
      }
    });
    paintBar(u);
  }

  // ---------- overview answer sheet ----------
  function paintSheet() {
    var gradedCount = 0, correct = 0, total = 0;
    units.forEach(function (u) {
      var row = $('sheet-' + u.id);
      if (!row) return;
      var s = stats(u);
      var dots = row.querySelectorAll('.dot');
      u.q.forEach(function (q, i) {
        var a = picked(q), cls = 'dot';
        if (s.graded) cls += a === undefined ? ' dot-skip' : (a === q.a ? ' dot-right' : ' dot-wrong');
        else if (a !== undefined) cls += ' dot-fill';
        if (dots[i]) dots[i].className = cls;
      });
      var label;
      if (s.graded) { label = s.correct + '/' + s.total + ' correct'; gradedCount++; correct += s.correct; total += s.total; }
      else if (s.answered) label = s.answered + '/' + s.total + ' answered';
      else label = 'Not started';
      row.querySelector('.sheet-status').textContent = label;
    });
    var sum = $('sheet-summary');
    if (sum) {
      sum.textContent = gradedCount
        ? gradedCount + ' of ' + units.length + ' units graded: ' + correct + ' of ' + total + ' correct (' + pct(correct, total) + '%).'
        : 'No units graded yet.';
    }
  }

  // ---------- score report ----------
  function unitName(u) { return u.course.name + ', ' + u.label; }

  function reportText() {
    var gu = gradedUnits(), out = [], date;
    try { date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { date = String(new Date()); }
    out.push('AP PRACTICE SCORE REPORT');
    out.push('Source: ' + D.title + ' (' + D.scope + ')');
    out.push('Date: ' + date);
    out.push('');
    if (!gu.length) {
      out.push('No units have been graded yet. Take a practice set, grade it, then copy this report again.');
      return out.join('\n');
    }
    out.push('Request for the AI tutor: Please act as my AP tutor. For each missed or skipped question below, explain the concept step by step, show why the correct answer is right, and explain what was wrong with my answer. Then give me two new practice questions on each weak topic, one at a time, and check my answers. Math is written in LaTeX between dollar signs.');
    out.push('');

    var c = 0, t = 0, missed = [], skipped = [], weak = [];
    gu.forEach(function (u) {
      var s = stats(u);
      c += s.correct; t += s.total;
      u.q.forEach(function (q) {
        var a = picked(q);
        if (a === undefined) skipped.push(q); else if (a !== q.a) missed.push(q);
      });
      topicStats(u).forEach(function (ts) { if (ts.correct < ts.total) weak.push(ts); });
    });
    out.push('OVERALL: ' + c + '/' + t + ' correct (' + pct(c, t) + '%) across ' + gu.length + ' graded unit' + (gu.length === 1 ? '' : 's'));
    out.push('');
    out.push('SCORES BY UNIT');
    gu.forEach(function (u) {
      var s = stats(u), sk = s.total - s.answered;
      out.push('- ' + unitName(u) + ' (' + u.title + '): ' + s.correct + '/' + s.total + ' (' + pct(s.correct, s.total) + '%)' + (sk ? ', ' + sk + ' skipped' : ''));
    });
    out.push('');
    out.push('TOPICS WITH MISSES (weakest first)');
    if (!weak.length) out.push('- None. Every graded question was answered correctly.');
    weak.sort(function (x, y) { return x.correct / x.total - y.correct / y.total || y.total - x.total; });
    weak.forEach(function (w) {
      out.push('- ' + w.unit.course.name + ' ' + w.n + ' ' + w.t + ': ' + w.correct + '/' + w.total + ' correct');
    });

    function block(q, i, kind) {
      var a = picked(q);
      out.push('');
      out.push((i + 1) + '. [' + unitName(q.unit) + ', topic ' + q.n + ' ' + q.t + ']');
      out.push('   Question: ' + q.s);
      out.push('   Choices: ' + q.c.map(function (ch, k) { return '(' + L[k] + ') ' + ch; }).join('  '));
      out.push('   My answer: ' + (kind === 'skip' ? 'none (skipped)' : '(' + L[a] + ') ' + q.c[a]));
      out.push('   Correct answer: (' + L[q.a] + ') ' + q.c[q.a]);
      out.push('   Why: ' + q.w);
    }
    out.push('');
    out.push('MISSED QUESTIONS (' + missed.length + ')');
    if (!missed.length) out.push('None.');
    missed.forEach(function (q, i) { block(q, i, 'miss'); });
    if (skipped.length) {
      out.push('');
      out.push('SKIPPED QUESTIONS (' + skipped.length + ')');
      skipped.forEach(function (q, i) { block(q, i, 'skip'); });
    }
    var rest = units.filter(function (u) { return !state.graded[u.id]; });
    if (rest.length) {
      out.push('');
      out.push('UNITS NOT GRADED YET: ' + rest.map(unitName).join('; '));
    }
    return out.join('\n');
  }

  function level(p) { return p >= 80 ? ['pill-good', 'Strong'] : (p >= 60 ? ['pill-warn', 'Review'] : ['pill-bad', 'Needs work']); }

  function paintReport() {
    var gu = gradedUnits();
    var c = 0, t = 0, misses = 0, weak = [], clear = 0;
    gu.forEach(function (u) {
      var s = stats(u);
      c += s.correct; t += s.total; misses += s.total - s.correct;
      topicStats(u).forEach(function (ts) { if (ts.correct < ts.total) weak.push(ts); else clear++; });
    });

    function tile(n, label) { return '<div class="tile"><div class="tile-n">' + n + '</div><div class="tile-l">' + label + '</div></div>'; }
    $('rep-tiles').innerHTML =
      tile(gu.length ? pct(c, t) + '%' : '–', gu.length ? c + ' of ' + t + ' correct' : 'Overall score') +
      tile(gu.length + '/' + units.length, 'Units graded') +
      tile(gu.length ? misses : '–', 'Missed or skipped') +
      tile(gu.length ? weak.length : '–', 'Topics to review');

    // units table
    var rows = '';
    units.forEach(function (u) {
      var s = stats(u), p = pct(s.correct, s.total), lv = level(p);
      rows += '<tr><td class="u-name"><b>' + esc(u.course.short) + ' ' + esc(u.label) + '</b><span>' + esc(u.title) + '</span></td>' +
        '<td class="num">' + (s.graded ? s.correct + '/' + s.total : (s.answered ? s.answered + '/' + s.total + ' answered' : '–')) + '</td>' +
        '<td><span class="bar" aria-hidden="true"><span style="width:' + (s.graded ? p : 0) + '%"></span></span></td>' +
        '<td class="num">' + (s.graded ? p + '%' : '') + '</td>' +
        '<td>' + (s.graded ? '<span class="pill ' + lv[0] + '">' + lv[1] + '</span>' : '<span class="pill pill-none">Not graded</span>') + '</td>' +
        '<td><a href="#' + u.course.id + '-practice" data-go="' + u.course.id + '-practice" data-jump="pu-' + u.id + '">' + (s.graded ? 'Review' : 'Practice') + '</a></td></tr>';
    });
    $('rep-units').innerHTML = '<div class="table-wrap"><table class="rtable"><thead><tr><th>Unit</th><th class="num">Score</th><th></th><th class="num">Percent</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';

    // topics
    var th = '';
    if (!gu.length) th = '<p class="empty">Grade a unit and the topics you missed will be listed here, weakest first.</p>';
    else if (!weak.length) th = '<p class="empty">No misses in the units you have graded.</p>';
    else {
      weak.sort(function (x, y) { return x.correct / x.total - y.correct / y.total || y.total - x.total; });
      weak.forEach(function (w) {
        var cid = w.unit.course.id;
        th += '<div class="trow"><span class="pill ' + (w.correct === 0 ? 'pill-bad' : 'pill-warn') + '">' + w.correct + '/' + w.total + '</span>' +
          '<span><span class="t-course">' + esc(w.unit.course.name) + ' · ' + esc(w.unit.label) + '</span>' + $(w.first.el).querySelector('.q-topic a').innerHTML + '</span>' +
          '<a href="#' + cid + '" data-go="' + cid + '" data-jump="n-' + cid + '-' + w.n.replace(/\./g, '-') + '">Notes</a></div>';
      });
      if (clear) th += '<p class="empty" style="margin-top:.8rem">' + clear + ' other topic' + (clear === 1 ? '' : 's') + ' in graded units had no misses.</p>';
    }
    $('rep-topics').innerHTML = th;

    // missed questions
    var mh = '';
    gu.forEach(function (u) {
      u.q.forEach(function (q) {
        var a = picked(q);
        if (a === q.a) return;
        var el = $(q.el), texts = el.querySelectorAll('.choice-text'), cid = u.course.id;
        mh += '<div class="miss"><p class="miss-head">' + esc(u.course.name) + ' · ' + esc(u.label) + ' · ' + el.querySelector('.q-topic a').innerHTML + '</p>' +
          '<div class="miss-stem">' + el.querySelector('.q-stem').innerHTML + '</div><dl>' +
          '<dt class="dt-bad">Your answer</dt><dd>' + (a === undefined ? '<span class="empty">Skipped</span>' : '(' + L[a] + ') ' + texts[a].innerHTML) + '</dd>' +
          '<dt class="dt-good">Correct answer</dt><dd>(' + L[q.a] + ') ' + texts[q.a].innerHTML + '</dd>' +
          '<dt>Why</dt><dd>' + el.querySelector('.why-body').innerHTML + '</dd></dl>' +
          '<p class="miss-link"><a href="#' + cid + '-practice" data-go="' + cid + '-practice" data-jump="' + q.el + '">Go to this question</a></p></div>';
      });
    });
    if (!gu.length) mh = '<p class="empty">Nothing graded yet. Each question you miss will appear here with your answer, the correct answer, and a short explanation.</p>';
    else if (!mh) mh = '<p class="empty">No missed or skipped questions in the units you have graded.</p>';
    $('rep-missed').innerHTML = mh;

    $('report-text').value = reportText();
    var st = $('copy-status');
    st.textContent = '';
    st.className = '';
  }

  function copyReport() {
    var ta = $('report-text'), st = $('copy-status');
    function ok() { st.className = ''; st.textContent = 'Copied. Paste it into any AI chat.'; }
    function manual() {
      var done = false;
      try { ta.focus(); ta.select(); done = document.execCommand('copy'); } catch (e) { done = false; }
      if (done) ok();
      else { st.className = 'is-warn'; st.textContent = 'Copying was blocked. The text below is selected: press Ctrl+C or Cmd+C.'; }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(ok, manual);
        return;
      }
    } catch (e) { /* fall through */ }
    manual();
  }

  function paintAll() {
    units.forEach(paintUnit);
    paintSheet();
    paintReport();
  }

  // ---------- navigation ----------
  function jumpTo(id, smooth) {
    var el = id && $(id);
    if (!el) return false;
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { el.scrollIntoView({ behavior: smooth && !calm ? 'smooth' : 'auto', block: 'start' }); } catch (e) { el.scrollIntoView(); }
    return true;
  }

  function show(name, jump) {
    if (!views[name]) name = 'overview';
    var changed = name !== current;
    current = name;
    Object.keys(views).forEach(function (k) { views[k].classList.toggle('is-active', k === name); });
    var group = name.replace(/-practice$/, '');
    navLinks.forEach(function (a) {
      var on = a.getAttribute('data-go') === name || a.getAttribute('data-group') === group;
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (name === 'report') paintReport();
    if (jumpTo(jump, !changed)) return;
    if (changed) {
      window.scrollTo(0, 0);
      var h = views[name].querySelector('h1');
      if (h) { try { h.focus({ preventScroll: true }); } catch (e) { /* older browsers */ } }
    }
  }

  function go(name, jump) {
    show(name, jump);
    try { if (window.location.hash.slice(1) !== current) window.location.hash = current; } catch (e) { /* hash not writable here */ }
  }

  window.addEventListener('hashchange', function () {
    var n = window.location.hash.slice(1) || 'overview';
    if (n !== current) show(n);
  });

  function resetZone(asking) {
    $('reset-zone').innerHTML = asking
      ? '<span class="confirm">Clear every answer in all four courses?' + btn('Yes, clear everything', 'reset-yes', '', true) + btn('Cancel', 'reset-no', '') + '</span>'
      : btn('Clear all answers', 'reset-ask', '');
  }

  function act(action, uid) {
    var u = U[uid];
    if (action === 'grade' && u) {
      if (!stats(u).answered) return;
      state.graded[u.id] = Date.now();
      save(); paintUnit(u); paintSheet(); jumpTo('pu-' + u.id, false);
    } else if (action === 'retake-ask' && u) {
      paintBar(u, 'confirm');
    } else if (action === 'retake-no' && u) {
      paintBar(u);
    } else if (action === 'retake-yes' && u) {
      delete state.graded[u.id];
      u.q.forEach(function (q) { delete state.answers[q.id]; });
      save(); paintUnit(u); paintSheet(); jumpTo('pu-' + u.id, false);
    } else if (action === 'reset-ask') {
      resetZone(true);
    } else if (action === 'reset-no') {
      resetZone(false);
    } else if (action === 'reset-yes') {
      state = { answers: {}, graded: {} };
      save(); paintAll(); resetZone(false);
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-go],[data-jump],[data-action],#copy-report') : null;
    if (!t) return;
    if (t.id === 'copy-report') { copyReport(); return; }
    var action = t.getAttribute('data-action');
    if (action) { e.preventDefault(); act(action, t.getAttribute('data-unit')); return; }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(t.getAttribute('data-go') || current, t.getAttribute('data-jump'));
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || el.type !== 'radio' || !el.closest) return;
    var qEl = el.closest('.q');
    var q = qEl && Q[qEl.getAttribute('data-qid')];
    if (!q || state.graded[q.unit.id]) return;
    state.answers[q.id] = q.o[Number(el.value)];
    save(); paintBar(q.unit); paintSheet();
  });

  // ---------- start ----------
  var started = false;
  function boot(seed) {
    if (started) return;
    started = true;
    load(seed);
    paintAll();
    show(window.location.hash.slice(1) || 'overview');
    try {
      if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
        window.claude.hot.snapshot(function () { return state; });
      }
    } catch (e) { /* not running in the viewer */ }
  }
  try {
    var hot = window.claude && window.claude.hot;
    if (hot && typeof hot.ready === 'function') {
      hot.ready(boot);
      window.setTimeout(function () { boot(); }, 1200);
    } else {
      boot(hot && hot.data);
    }
  } catch (e) {
    boot();
  }
})();

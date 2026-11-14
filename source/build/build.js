// Builds dist/index.html from the plain-text content files.
const fs = require('fs');
const path = require('path');
const mj = require('./mj.js');
const figs = require('./figures.js');

const ROOT = path.resolve(__dirname, '..');
const TITLE = 'AP Five-Course Study Guide';
const LETTERS = ['A', 'B', 'C', 'D'];

// ---------- parsing ----------
function parse(text, file) {
  let course = null, unit = null, topic = null, q = null;
  const err = (n, msg) => { throw new Error(`${file}:${n}: ${msg}`); };
  text.split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1;
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) return;
    let m;
    if (line.startsWith('@course ')) {
      const p = line.slice(8).split(' | ').map((s) => s.trim());
      if (p.length !== 4) err(n, 'course needs 4 fields');
      course = { id: p[0], name: p[1], short: p[2], scope: p[3], units: [] };
      return;
    }
    if (line.startsWith('@unit ')) {
      const p = line.slice(6).split(' | ').map((s) => s.trim());
      if (p.length !== 4) err(n, 'unit needs 4 fields');
      unit = { id: p[0], label: p[1], title: p[2], weight: p[3], topics: [] };
      course.units.push(unit); topic = null; q = null;
      return;
    }
    if (line.startsWith('@topic ')) {
      const p = line.slice(7).split(' | ').map((s) => s.trim());
      if (p.length !== 2) err(n, 'topic needs 2 fields');
      topic = { num: p[0], title: p[1], points: [], formulas: [], traps: [], examples: [], figures: [], questions: [] };
      unit.topics.push(topic); q = null;
      return;
    }
    if (!topic) err(n, 'content before any topic');
    if ((m = /^\?(=?) (.*)$/.exec(line))) {
      q = { stem: m[2], fixed: !!m[1], choices: [], answer: -1, why: '' };
      topic.questions.push(q);
      return;
    }
    if ((m = /^(\*?)([a-d])\) (.*)$/.exec(line))) {
      if (!q) err(n, 'choice outside a question');
      const idx = 'abcd'.indexOf(m[2]);
      if (idx !== q.choices.length) err(n, 'choice letters out of order');
      if (m[1]) { if (q.answer !== -1) err(n, 'two answers marked'); q.answer = idx; }
      q.choices.push(m[3]);
      return;
    }
    if (line.startsWith('% ')) {
      if (!q) err(n, 'explanation outside a question');
      if (q.why) err(n, 'two explanations');
      q.why = line.slice(2);
      return;
    }
    if (q) err(n, 'note line after questions began: ' + line.slice(0, 40));
    if (line.startsWith('- ')) { topic.points.push(line.slice(2)); return; }
    if (line.startsWith('= ')) {
      const parts = line.slice(2).split(' :: ');
      topic.formulas.push({ body: parts[0].trim(), label: (parts[1] || '').trim() });
      return;
    }
    if (line.startsWith('! ')) { topic.traps.push(line.slice(2)); return; }
    if (line.startsWith('> ')) { topic.examples.push(line.slice(2)); return; }
    if (line.startsWith('~ ')) {
      const id = line.slice(2).trim();
      if (!figs[id]) err(n, 'unknown figure ' + id);
      topic.figures.push(id);
      return;
    }
    err(n, 'unrecognized line: ' + line.slice(0, 40));
  });
  return course;
}

function validate(course) {
  const problems = [];
  const seen = new Set();
  course.units.forEach((u) => u.topics.forEach((t) => {
    const where = `${course.id} ${t.num}`;
    if (seen.has(t.num)) problems.push(where + ': duplicate topic number');
    seen.add(t.num);
    if (!t.points.length) problems.push(where + ': no notes');
    if (!t.questions.length) problems.push(where + ': no questions');
    t.questions.forEach((q, i) => {
      const w = `${where} Q${i + 1}`;
      if (q.choices.length !== 4) problems.push(w + `: ${q.choices.length} choices`);
      if (q.answer < 0) problems.push(w + ': no answer marked');
      if (!q.why) problems.push(w + ': no explanation');
      if (new Set(q.choices.map((c) => c.trim().toLowerCase())).size !== q.choices.length) problems.push(w + ': duplicate choices');
    });
  }));
  return problems;
}

// Spread correct answers evenly over A-D. Only text choices are moved, by one swap; numeric or formula
// choices keep the order they were written in. q.order maps each displayed position to the position the
// choice was written in, and saved answers use the written position, so rebalancing never corrupts them.
function balance(course) {
  let seed = 0;
  for (const ch of course.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const all = [];
  course.units.forEach((u) => u.topics.forEach((t) => t.questions.forEach((q) => { q.order = [0, 1, 2, 3]; all.push(q); })));
  const movable = (q) => !q.fixed && q.choices.every((c) => /^[A-Za-z]/.test(c));
  const counts = [0, 0, 0, 0];
  all.filter((q) => !movable(q)).forEach((q) => counts[q.answer]++);
  let prev = -1;
  all.forEach((q, i) => {
    if (movable(q)) {
      const next = all[i + 1] && !movable(all[i + 1]) ? all[i + 1].answer : -1;
      const cands = [0, 1, 2, 3].filter((k) => k !== prev && k !== next);
      const max = Math.max(...counts);
      const weights = cands.map((k) => Math.pow(max - counts[k] + 1, 2));
      let roll = rnd() * weights.reduce((a, b) => a + b, 0);
      let target = cands[cands.length - 1];
      for (let k = 0; k < cands.length; k++) { roll -= weights[k]; if (roll <= 0) { target = cands[k]; break; } }
      if (target !== q.answer) {
        const a = q.answer;
        [q.choices[target], q.choices[a]] = [q.choices[a], q.choices[target]];
        [q.order[target], q.order[a]] = [q.order[a], q.order[target]];
        q.answer = target;
      }
      counts[target]++;
    }
    prev = q.answer;
  });
  return counts;
}

// Extra notes and questions for topics that already exist (files named x-*.txt).
function extend(text, file, courses) {
  let course = null, topic = null, q = null;
  const err = (n, msg) => { throw new Error(`${file}:${n}: ${msg}`); };
  text.split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1;
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) return;
    let m;
    if (line.startsWith('@extend ')) {
      course = courses.find((c) => c.id === line.slice(8).trim());
      if (!course) err(n, 'unknown course'); topic = null; q = null; return;
    }
    if (line.startsWith('@topic ')) {
      const num = line.slice(7).trim();
      topic = null;
      course.units.forEach((u) => u.topics.forEach((t) => { if (t.num === num) topic = t; }));
      if (!topic) err(n, 'unknown topic ' + num); q = null; return;
    }
    if (!topic) err(n, 'content before a topic');
    if ((m = /^\?(=?) (.*)$/.exec(line))) { q = { stem: m[2], fixed: !!m[1], choices: [], answer: -1, why: '' }; topic.questions.push(q); return; }
    if ((m = /^(\*?)([a-d])\) (.*)$/.exec(line))) {
      if (!q) err(n, 'choice outside a question');
      const idx = 'abcd'.indexOf(m[2]);
      if (idx !== q.choices.length) err(n, 'choice letters out of order');
      if (m[1]) { if (q.answer !== -1) err(n, 'two answers marked'); q.answer = idx; }
      q.choices.push(m[3]); return;
    }
    if (line.startsWith('% ')) { if (!q || q.why) err(n, 'bad explanation'); q.why = line.slice(2); return; }
    if (line.startsWith('- ')) { topic.points.push(line.slice(2)); return; }
    if (line.startsWith('! ')) { topic.traps.push(line.slice(2)); return; }
    if (line.startsWith('> ')) { topic.examples.push(line.slice(2)); return; }
    err(n, 'unrecognized line: ' + line.slice(0, 40));
  });
}

// ---------- inline markup ----------
const PH = '\u0001';
function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

function splitMath(src) {
  const parts = src.replace(/\\\$/g, PH).split('$');
  if (parts.length % 2 === 0) throw new Error('Unbalanced $ in: ' + src);
  return parts;
}
function fmtText(t) {
  if ((t.match(/\*\*/g) || []).length % 2) throw new Error('Unbalanced ** in: ' + t);
  let h = escHtml(t.split(PH).join('$'));
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[\s(])_([^_]+?)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  return h;
}
function inline(src, display) {
  return splitMath(src).map((p, i) => {
    if (i % 2 === 0) return fmtText(p);
    let tex = p.split(PH).join('\\$');
    if (display) tex = '\\displaystyle ' + tex;
    return mj.render(tex, false);
  }).join('');
}
function plain(src) {
  return splitMath(src).map((p, i) => {
    if (i % 2 === 0) {
      return p.split(PH).join('$').replace(/\*\*/g, '').replace(/(^|[\s(])_([^_]+?)_(?=[\s).,;:!?]|$)/g, '$1$2');
    }
    const tex = p.split(PH).join('\\$')
      .replace(/\\[dt]frac/g, '\\frac')
      .replace(/\\left([(\[])/g, '$1').replace(/\\right([)\]])/g, '$1')
      .replace(/\s+/g, ' ').trim();
    return '$' + tex + '$';
  }).join('');
}

// ---------- html ----------
const slug = (s) => s.replace(/\./g, '-');
const noteId = (c, t) => `n-${c.id}-${slug(t.num)}`;
const qElId = (c, t, i) => `q-${c.id}-${slug(t.num)}-${i + 1}`;
const qId = (c, t, i) => `${c.id}-${t.num}-${i + 1}`;
const unitQs = (u) => u.topics.reduce((n, t) => n + t.questions.length, 0);
const courseQs = (c) => c.units.reduce((n, u) => n + unitQs(u), 0);
const courseTopics = (c) => c.units.reduce((n, u) => n + u.topics.length, 0);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function notesView(c) {
  let toc = '', chips = '', body = '';
  c.units.forEach((u) => {
    chips += `<button type="button" class="chip" data-jump="nu-${u.id}">${escHtml(u.label)}</button>`;
    toc += `<div class="toc-unit"><button type="button" class="toc-head" data-jump="nu-${u.id}">${escHtml(u.label)}</button><ul>`;
    body += `<section class="unit" id="nu-${u.id}"><header class="unit-head"><p class="eyebrow">${escHtml(u.label)} · ${escHtml(u.weight)}</p><h2>${inline(u.title)}</h2></header>`;
    u.topics.forEach((t) => {
      toc += `<li><button type="button" data-jump="${noteId(c, t)}"><span class="toc-n">${t.num}</span>${inline(t.title)}</button></li>`;
      let h = `<article class="topic" id="${noteId(c, t)}"><div class="t-num" aria-hidden="true">${t.num}</div><div class="t-body"><h3><span class="sr">${t.num} </span>${inline(t.title)}</h3>`;
      h += '<ul class="pts">' + t.points.map((p) => `<li>${inline(p)}</li>`).join('') + '</ul>';
      if (t.formulas.length) {
        h += '<div class="fbox">' + t.formulas.map((f) =>
          `<div class="frow">${f.label ? `<span class="flabel">${escHtml(f.label)}</span>` : ''}<span class="fmath">${inline(f.body, true)}</span></div>`).join('') + '</div>';
      }
      t.figures.forEach((id) => { h += figs[id](); });
      t.examples.forEach((e) => { h += `<p class="callout ex"><span class="tag">Example</span>${inline(e)}</p>`; });
      t.traps.forEach((e) => { h += `<p class="callout trap"><span class="tag">Watch out</span>${inline(e)}</p>`; });
      h += `<p class="t-foot"><a href="#${c.id}-practice" data-go="${c.id}-practice" data-jump="${qElId(c, t, 0)}">Practice ${t.num} · ${plural(t.questions.length, 'question')}</a></p>`;
      h += '</div></article>';
      body += h;
    });
    toc += '</ul></div>';
    body += '</section>';
  });
  return `<section class="view" data-view="${c.id}" aria-labelledby="h-${c.id}"><div class="wrap">
<header class="course-head"><p class="eyebrow">${escHtml(c.name)} · ${escHtml(c.scope)}</p><h1 id="h-${c.id}" tabindex="-1">${escHtml(c.short)} notes</h1>
<div class="seg"><a class="seg-on" href="#${c.id}" data-go="${c.id}" aria-current="page">Notes</a><a href="#${c.id}-practice" data-go="${c.id}-practice">Practice · ${courseQs(c)} questions</a></div>
<nav class="chips" aria-label="Jump to a unit">${chips}</nav></header>
<div class="course-body"><nav class="toc" aria-label="${escAttr(c.short)} topics">${toc}</nav><div class="units">${body}</div></div>
</div></section>`;
}

function practiceView(c) {
  let chips = '', body = '';
  c.units.forEach((u) => {
    chips += `<button type="button" class="chip" data-jump="pu-${u.id}">${escHtml(u.label)}</button>`;
    let n = 0;
    body += `<section class="unit punit" id="pu-${u.id}" data-unit="${u.id}"><header class="unit-head"><p class="eyebrow">${escHtml(u.label)} · ${plural(unitQs(u), 'question')}</p><h2>${inline(u.title)}</h2><p class="unit-status" id="us-${u.id}">Not started</p></header>`;
    u.topics.forEach((t) => {
      t.questions.forEach((q, i) => {
        n++;
        const el = qElId(c, t, i);
        body += `<div class="q" id="${el}" data-qid="${qId(c, t, i)}" role="group" aria-labelledby="${el}-s"><div class="q-num" aria-hidden="true">${n}</div><div class="q-body">`;
        body += `<p class="q-topic"><a href="#${c.id}" data-go="${c.id}" data-jump="${noteId(c, t)}" title="Open the notes for this topic">${t.num} ${inline(t.title)}</a></p>`;
        body += `<div class="q-stem" id="${el}-s"><span class="sr">Question ${n}. </span>${inline(q.stem)}</div><div class="choices">`;
        q.choices.forEach((ch, k) => {
          body += `<label class="choice"><input type="radio" name="${el}" id="${el}-${'abcd'[k]}" value="${k}"><span class="bubble" aria-hidden="true">${LETTERS[k]}</span><span class="choice-text">${inline(ch)}</span></label>`;
        });
        body += `</div><p class="verdict" hidden></p><details class="why" hidden><summary>Explanation</summary><div class="why-body">${inline(q.why)}</div></details></div></div>`;
      });
    });
    body += `<div class="gradebar" id="gb-${u.id}"><p class="gb-text" role="status">Answer the questions, then grade this unit.</p><div class="gb-actions"><button type="button" class="btn btn-solid" data-action="grade" data-unit="${u.id}">Grade ${escHtml(u.label)}</button></div></div></section>`;
  });
  return `<section class="view" data-view="${c.id}-practice" aria-labelledby="h-${c.id}-p"><div class="wrap">
<header class="course-head"><p class="eyebrow">${escHtml(c.name)} · ${escHtml(c.scope)}</p><h1 id="h-${c.id}-p" tabindex="-1">${escHtml(c.short)} practice</h1>
<div class="seg"><a href="#${c.id}" data-go="${c.id}">Notes</a><a class="seg-on" href="#${c.id}-practice" data-go="${c.id}-practice" aria-current="page">Practice · ${courseQs(c)} questions</a></div>
<nav class="chips" aria-label="Jump to a unit">${chips}</nav>
<p class="lede small">Pick an answer for each question, then grade the unit. Grading shows which answers were right and explains every miss. You can change answers until you grade.</p></header>
<div class="units narrow">${body}</div>
</div></section>`;
}

function overviewView(courses, totals) {
  let sheet = '', cards = '';
  courses.forEach((c) => {
    c.units.forEach((u) => {
      const n = unitQs(u);
      let dots = '';
      for (let i = 0; i < n; i++) dots += '<span class="dot"></span>';
      sheet += `<a class="sheet-row" id="sheet-${u.id}" href="#${c.id}-practice" data-go="${c.id}-practice" data-jump="pu-${u.id}"><span class="sheet-name"><b>${escHtml(c.short)}</b> ${escHtml(u.label)}</span><span class="dots" aria-hidden="true">${dots}</span><span class="sheet-status">Not started</span></a>`;
    });
    const unitList = c.units.map((u) => `<li><span class="u-label">${escHtml(u.label)}</span><span class="u-title">${inline(u.title)}</span><span class="u-meta">${plural(u.topics.length, 'topic')} · ${plural(unitQs(u), 'question')}</span></li>`).join('');
    cards += `<article class="course-card"><p class="eyebrow">${escHtml(c.scope)}</p><h3>${escHtml(c.name)}</h3><ul class="u-list">${unitList}</ul><div class="card-actions"><a class="btn" href="#${c.id}" data-go="${c.id}">Read notes</a><a class="btn btn-solid" href="#${c.id}-practice" data-go="${c.id}-practice">Practice</a></div></article>`;
  });
  return `<section class="view is-active" data-view="overview" aria-labelledby="h-overview"><div class="wrap">
<header class="hero"><p class="eyebrow">${courses.map((c) => escHtml(c.short + ' ' + c.scope.replace(/^\D+/, ''))).join(' · ')}</p>
<h1 id="h-overview" tabindex="-1">AP Study Guide</h1>
<p class="lede">Notes for all ${totals.topics} topics in these ${totals.units} units, ${totals.questions} practice questions that cover every topic, and a score report you can paste into any AI chat for a deeper walkthrough of anything you miss.</p></header>
<section class="sheet" aria-labelledby="h-sheet"><div class="sheet-top"><h2 id="h-sheet">Answer sheet</h2>
<ul class="legend" aria-label="Legend"><li><span class="dot"></span>Blank</li><li><span class="dot dot-fill"></span>Answered</li><li><span class="dot dot-right"></span>Correct</li><li><span class="dot dot-wrong"></span>Missed</li><li><span class="dot dot-skip"></span>Skipped</li></ul></div>
<div class="sheet-rows">${sheet}</div>
<p class="sheet-foot"><span id="sheet-summary">No units graded yet.</span> <a href="#report" data-go="report">Open score report</a></p></section>
<section class="how" aria-labelledby="h-how"><h2 id="h-how">How to use it</h2><ol>
<li><b>Read the notes for a unit.</b> Key terms are highlighted, formulas are boxed, and each topic lists the mistake to watch for.</li>
<li><b>Take that unit's practice set and grade it.</b> Every miss gets a short explanation, and each question links back to its notes.</li>
<li><b>Open the score report and copy it into any AI chat.</b> It lists your weak topics and every missed question, so the AI can explain them and write more practice.</li></ol></section>
<section aria-labelledby="h-courses"><h2 id="h-courses">Courses</h2><div class="course-grid">${cards}</div></section>
</div></section>`;
}

function reportView() {
  return `<section class="view" data-view="report" aria-labelledby="h-report"><div class="wrap narrow-wrap">
<header class="course-head"><p class="eyebrow">All five courses</p><h1 id="h-report" tabindex="-1">Score report</h1>
<p class="lede small">This report covers every unit you have graded. It updates each time you grade or retake a unit.</p></header>
<div id="rep-tiles" class="tiles"></div>
<section class="copybox" aria-labelledby="h-copy"><h2 id="h-copy">Paste this into any AI chat</h2>
<p>The text below holds your scores, your weak topics, and every missed question with your answer, the correct answer, and a short explanation. It opens with a request for the AI to tutor you through the misses.</p>
<div class="copy-actions"><button type="button" class="btn btn-solid" id="copy-report">Copy score report</button><span id="copy-status" role="status"></span></div>
<label class="sr" for="report-text">Score report text</label><textarea id="report-text" readonly rows="12" spellcheck="false"></textarea></section>
<section aria-labelledby="h-units"><h2 id="h-units">Scores by unit</h2><div id="rep-units"></div></section>
<section aria-labelledby="h-topics"><h2 id="h-topics">Topics to review</h2><div id="rep-topics"></div></section>
<section aria-labelledby="h-missed"><h2 id="h-missed">Missed and skipped questions</h2><div id="rep-missed"></div></section>
<section class="reset" aria-labelledby="h-reset"><h2 id="h-reset">Start over</h2><p>Clear every answer and grade on this device.</p><div id="reset-zone"><button type="button" class="btn" data-action="reset-ask">Clear all answers</button></div></section>
</div></section>`;
}

const CREDIT_NAME = 'Tony Zheng';
const CREDIT_URL = 'https://github.com/godlol';
const REPO_URL = 'https://github.com/godlol/TRI1';

function creditsView() {
  return `<section class="view" data-view="credits" aria-labelledby="h-credits"><div class="wrap narrow-wrap">
<header class="course-head"><p class="eyebrow">About this guide</p><h1 id="h-credits" tabindex="-1">Credits</h1>
<p class="lede small">This study guide was made by <a href="${CREDIT_URL}" target="_blank" rel="noopener"><b>${escHtml(CREDIT_NAME)}</b></a>.</p></header>
<section class="credit-card" aria-labelledby="h-made"><h2 id="h-made">Made by</h2>
<p class="credit-name">${escHtml(CREDIT_NAME)}</p>
<p>Created, written and published by ${escHtml(CREDIT_NAME)}: the notes, the practice questions and explanations, the score report, and the site itself.</p>
<p><a class="btn" href="${CREDIT_URL}" target="_blank" rel="noopener">GitHub profile</a> <a class="btn" href="${REPO_URL}" target="_blank" rel="noopener">Source code</a></p></section>
<section class="credit-card" aria-labelledby="h-thanks"><h2 id="h-thanks">Tools and sources</h2><ul class="credit-list">
<li><b>Course outlines.</b> Topic lists follow the College Board course and exam descriptions for each course.</li>
<li><b>Formulas.</b> Typeset with MathJax and saved as images in the page.</li>
<li><b>Fonts.</b> Archivo and STIX Two Text, from Google Fonts.</li></ul>
<p class="credit-fine">AP is a trademark registered by the College Board, which is not affiliated with this guide.</p></section>
</div></section>`;
}

// ---------- main ----------
const files = fs.readdirSync(path.join(ROOT, 'content')).filter((f) => f.endsWith('.txt')).sort();
const courses = files.filter((f) => !f.startsWith('x-')).map((f) => parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'), f));
files.filter((f) => f.startsWith('x-')).forEach((f) => extend(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'), f, courses));

let problems = [];
courses.forEach((c) => { problems = problems.concat(validate(c)); });
if (problems.length) { console.error('CONTENT PROBLEMS:\n' + problems.join('\n')); process.exit(1); }

const dist = {};
courses.forEach((c) => { dist[c.id] = balance(c); });

const totals = { units: courses.reduce((n, c) => n + c.units.length, 0), topics: courses.reduce((n, c) => n + courseTopics(c), 0), questions: courses.reduce((n, c) => n + courseQs(c), 0) };

const views = overviewView(courses, totals) + courses.map((c) => notesView(c) + practiceView(c)).join('') + reportView() + creditsView();

const data = {
  title: TITLE,
  scope: courses.map((c) => c.name + ' ' + c.scope.replace('–', '-')).join(', '),
  courses: courses.map((c) => ({
    id: c.id, name: c.name, short: c.short,
    units: c.units.map((u) => ({
      id: u.id, label: u.label, title: plain(u.title),
      q: [].concat(...u.topics.map((t) => t.questions.map((q, i) => ({
        id: qId(c, t, i), el: qElId(c, t, i), n: t.num, t: plain(t.title),
        s: plain(q.stem), c: q.choices.map(plain), a: q.answer, o: q.order, w: plain(q.why),
      })))),
    })),
  })),
};

const nav = '<a href="#overview" data-go="overview">Overview</a>' +
  courses.map((c) => `<a href="#${c.id}" data-go="${c.id}" data-group="${c.id}">${escHtml(c.short)}</a>`).join('') +
  '<a href="#report" data-go="report" class="nav-report">Score report</a>' +
  '<a href="#credits" data-go="credits">Credits</a>';

const css = fs.readFileSync(path.join(__dirname, 'page.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, 'page.js'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&amp;family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&amp;display=swap" rel="stylesheet">
<style>
${css}
</style>
</head>
<body>
${mj.cacheSvg()}
<header class="top"><div class="top-in"><a class="brand" href="#overview" data-go="overview">AP Study Guide</a><nav class="mainnav" aria-label="Sections">${nav}</nav></div></header>
<main id="main">
${views}
</main>
<footer class="foot"><div class="wrap"><p class="foot-credit">Made by <a href="#credits" data-go="credits">${escHtml(CREDIT_NAME)}</a>. <a href="#credits" data-go="credits">Credits</a></p><p>Topic lists follow the College Board course and exam descriptions for each course. Practice questions are original and written for this guide. AP is a trademark registered by the College Board, which is not affiliated with this guide.</p></div></footer>
<script type="application/json" id="guide-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script>
${js}
</script>
</body>
</html>
`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), html);
fs.writeFileSync(path.join(ROOT, 'dist', 'data.json'), JSON.stringify(data, null, 1));

// Variant for the public site: adds page metadata, an icon and Vercel analytics.
const DESC = 'Study guide for five AP courses: notes for every topic, practice questions with explanations, and a score report. Progress saves in your browser.';
const siteHead = `<meta name="description" content="${DESC}">
<meta name="theme-color" content="#f1f2ec" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121513" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESC}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23191d1b'/%3E%3Ctext x='16' y='22' font-family='Arial' font-weight='900' font-size='16' text-anchor='middle' fill='%23ffe164'%3EAP%3C/text%3E%3C/svg%3E">
`;
const siteTail = `<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>
<script>window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };</script>
<script defer src="/_vercel/speed-insights/script.js"></script>
`;
fs.mkdirSync(path.join(ROOT, 'dist', 'site'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'site', 'index.html'), html.replace('</head>', siteHead + '</head>').replace('</body>\n</html>', siteTail + '</body>\n</html>'));

console.log('Built dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
courses.forEach((c) => {
  console.log(`${c.id}: ${courseTopics(c)} topics, ${courseQs(c)} questions; answers A-D = ${dist[c.id].join('/')}; per unit: ` +
    c.units.map((u) => `${u.label} ${u.topics.length}t/${unitQs(u)}q`).join(', '));
});
console.log('TOTAL', totals.topics, 'topics,', totals.questions, 'questions; unique formulas rendered:', mj.stats().unique);

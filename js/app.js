/*
 * Boxing Camp: views, the timer screen, the benchmark log and saved state.
 * Everything is stored in this browser only (localStorage).
 */
(function () {
  'use strict';

  var Camp = window.Camp;
  var P = Camp.plan;
  var Sound = Camp.Sound;

  /* ================= storage ================= */

  var KEY = 'boxing-camp:v1';
  var storageOk = true;

  function readStore() {
    try {
      var raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      storageOk = false;
      return null;
    }
  }

  function writeStore() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      storageOk = false;
      return false;
    }
  }

  /* ================= dates ================= */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function mondayOf(d) { var diff = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff); }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseIso(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) { return null; }
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function daysBetween(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
  function fmt(d, opts) {
    try { return d.toLocaleDateString(undefined, opts); } catch (e) { return isoDate(d); }
  }
  function fmtLong(d) { return fmt(d, { weekday: 'long', month: 'long', day: 'numeric' }); }
  function fmtShort(d) { return fmt(d, { month: 'short', day: 'numeric' }); }

  /* ================= state ================= */

  function normalize(d) {
    d = d && typeof d === 'object' ? d : {};
    var s = d.settings && typeof d.settings === 'object' ? d.settings : {};
    if (!parseIso(s.start)) { s.start = isoDate(mondayOf(today())); }
    if (typeof s.sound !== 'boolean') { s.sound = true; }
    if (typeof s.voice !== 'boolean') { s.voice = false; }
    if (['system', 'light', 'dark'].indexOf(s.theme) === -1) { s.theme = 'system'; }
    if (['tests', 'full'].indexOf(s.bagMode) === -1) { s.bagMode = 'tests'; }
    var c = s.custom && typeof s.custom === 'object' ? s.custom : {};
    s.custom = {
      rounds: clampInt(c.rounds, 1, 20, 6),
      round: clampInt(c.round, 15, 600, 180),
      rest: clampInt(c.rest, 0, 300, 60)
    };
    if (typeof s.metric !== 'string') { s.metric = 'pushups'; }
    var out = { version: 1, settings: s, done: {}, logs: {} };
    if (d.done && typeof d.done === 'object') {
      Object.keys(d.done).forEach(function (w) {
        var wk = +w;
        if (wk >= 1 && wk <= P.WEEKS && d.done[w] && typeof d.done[w] === 'object') {
          out.done[wk] = {};
          P.ORDER.forEach(function (k) { if (d.done[w][k] === true) { out.done[wk][k] = true; } });
        }
      });
    }
    if (d.logs && typeof d.logs === 'object') {
      Object.keys(d.logs).forEach(function (w) {
        var wk = +w;
        var entry = d.logs[w];
        if (wk >= 1 && wk <= P.WEEKS && entry && typeof entry === 'object') {
          var clean = {};
          if (parseIso(entry.date)) { clean.date = entry.date; }
          METRICS.forEach(function (m) {
            var v = entry[m.key];
            if (typeof v === 'number' && isFinite(v) && v >= 0) { clean[m.key] = v; }
          });
          if (Object.keys(clean).length) { out.logs[wk] = clean; }
        }
      });
    }
    return out;
  }

  function clampInt(v, lo, hi, dflt) {
    v = parseInt(v, 10);
    if (isNaN(v)) { return dflt; }
    return Math.min(hi, Math.max(lo, v));
  }

  var METRICS = [
    { key: 'weight', label: 'Bodyweight', short: 'Weight', unit: 'kg', type: 'decimal', better: null, notes: 'Weight (kg)', placeholder: '78.0', sub: 'kg, weighed in the morning before eating' },
    { key: 'pushups', label: 'Max push-ups', short: 'Push-ups', unit: 'reps', type: 'int', better: 'up', notes: 'Push-ups', placeholder: '30', sub: 'one set, higher is better', zero: true },
    { key: 'rope', label: 'Jump rope, unbroken', short: 'Rope', unit: '', type: 'time', better: 'up', notes: 'Rope (min)', placeholder: '2:30', sub: 'minutes:seconds, longer is better', zero: true },
    { key: 'burpees', label: 'Burpees in 3 min', short: 'Burpees', unit: 'reps', type: 'int', better: 'up', notes: 'Burpees 3 min', placeholder: '45', sub: 'higher is better', deloadSkip: true, zero: true },
    { key: 'hard', label: 'Hard rounds', short: 'Hard rounds', unit: 'of 8', type: 'int', max: 8, better: 'up', notes: 'Hard rounds (max 8)', placeholder: '4', sub: 'rounds finished before your form broke, out of 8', deloadSkip: true, zero: true },
    { key: 'run', label: '3 km run', short: '3 km', unit: '', type: 'time', better: 'down', notes: '3 km', placeholder: '16:00', sub: 'minutes:seconds, faster is better' }
  ];
  function metric(key) { for (var i = 0; i < METRICS.length; i++) { if (METRICS[i].key === key) { return METRICS[i]; } } return METRICS[1]; }

  var data = normalize(readStore());
  writeStore();

  var ui = {
    view: 'today',
    planWeek: null,
    logWeek: null,
    timerWeek: null,
    timerId: null,
    sheetSig: ''
  };

  /* ================= small helpers ================= */

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || typeof v === 'undefined' || v === false) { return; }
        if (k === 'class') { n.className = v; }
        else if (k === 'text') { n.textContent = v; }
        else if (k.indexOf('on') === 0 && typeof v === 'function') { n.addEventListener(k.slice(2), v); }
        else { n.setAttribute(k, v === true ? '' : v); }
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || typeof c === 'undefined' || c === false) { return; }
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } return node; }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
      }
    } catch (e) { /* fall through */ }
    return Promise.resolve(fallback());
  }

  function download(name, mime, content) {
    try {
      var blob = new Blob([content], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = el('a', { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ================= camp week ================= */

  function startDate() { return parseIso(data.settings.start) || mondayOf(today()); }
  function campDays() { return daysBetween(startDate(), today()); }
  function rawWeek() { var d = campDays(); return d < 0 ? 0 : Math.floor(d / 7) + 1; }
  function currentWeek() { return P.clampWeek(Math.max(1, rawWeek())); }
  function weekStart(w) { return addDays(startDate(), (w - 1) * 7); }
  function doneFor(w) { return data.done[w] || {}; }
  function doneCount(w) { var d = doneFor(w); return P.ORDER.filter(function (k) { return d[k]; }).length; }
  function nextSession(w) {
    var d = doneFor(w);
    for (var i = 0; i < P.ORDER.length; i++) { if (!d[P.ORDER[i]]) { return P.ORDER[i]; } }
    return null;
  }
  function setDone(w, key, value) {
    if (!data.done[w]) { data.done[w] = {}; }
    if (value) { data.done[w][key] = true; } else { delete data.done[w][key]; }
    writeStore();
  }

  /* ================= seven-segment display ================= */

  var NS = 'http://www.w3.org/2000/svg';
  var SEG_POINTS = {
    a: '6.5,5 11.5,0 44.5,0 49.5,5 44.5,10 11.5,10',
    b: '51,6.5 56,11.5 56,43.5 51,48.5 46,43.5 46,11.5',
    c: '51,51.5 56,56.5 56,88.5 51,93.5 46,88.5 46,56.5',
    d: '6.5,95 11.5,90 44.5,90 49.5,95 44.5,100 11.5,100',
    e: '5,51.5 10,56.5 10,88.5 5,93.5 0,88.5 0,56.5',
    f: '5,6.5 10,11.5 10,43.5 5,48.5 0,43.5 0,11.5',
    g: '6.5,50 11.5,45 44.5,45 49.5,50 44.5,55 11.5,55'
  };
  var DIGIT_SEGS = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '' };

  function sevenSeg(container) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-14 -4 304 108');
    svg.setAttribute('class', 'seg-display');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', 'skewX(-6)');
    svg.appendChild(g);
    var digits = [0, 70, 160, 230].map(function (x) {
      var dg = document.createElementNS(NS, 'g');
      dg.setAttribute('transform', 'translate(' + x + ' 0)');
      var segs = {};
      'abcdefg'.split('').forEach(function (k) {
        var p = document.createElementNS(NS, 'polygon');
        p.setAttribute('points', SEG_POINTS[k]);
        p.setAttribute('class', 'seg');
        dg.appendChild(p);
        segs[k] = p;
      });
      g.appendChild(dg);
      return segs;
    });
    [30, 70].forEach(function (y) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', '143');
      c.setAttribute('cy', String(y));
      c.setAttribute('r', '6');
      c.setAttribute('class', 'seg colon on');
      g.appendChild(c);
    });
    clear(container).appendChild(svg);
    var last = null;
    return {
      set: function (secs) {
        secs = Math.max(0, Math.floor(secs || 0));
        var m = Math.floor(secs / 60);
        var s = secs % 60;
        if (m > 99) { m = 99; s = 59; }
        var str = (m < 10 ? ' ' + m : String(m)) + pad(s);
        if (str === last) { return; }
        last = str;
        str.split('').forEach(function (ch, i) {
          var on = DIGIT_SEGS[ch] || '';
          Object.keys(digits[i]).forEach(function (k) { digits[i][k].classList.toggle('on', on.indexOf(k) !== -1); });
        });
      }
    };
  }

  /* ================= router ================= */

  var VIEWS = ['today', 'plan', 'timer', 'log', 'drills'];

  function route() {
    var h = (window.location.hash || '').replace('#', '');
    show(VIEWS.indexOf(h) !== -1 ? h : 'today');
  }

  function go(view) {
    if (window.location.hash === '#' + view) { show(view); }
    else { window.location.hash = view; }
  }

  function show(view) {
    var changed = ui.view !== view;
    ui.view = view;
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== view; });
    Array.prototype.forEach.call(document.querySelectorAll('.tabs a'), function (a) {
      if (a.getAttribute('data-tab') === view) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
    });
    if (view === 'today') { renderToday(); }
    if (view === 'plan') { renderPlan(); }
    if (view === 'timer') { enterTimer(); }
    if (view === 'log') { renderLog(); }
    updateLiveDot();
    if (changed) { window.scrollTo(0, 0); }
  }

  /* ================= strip (12 weeks) ================= */

  function renderStrip(container, opts) {
    clear(container);
    var cur = rawWeek();
    for (var w = 1; w <= P.WEEKS; w++) {
      var deload = P.isDeload(w);
      var cls = 'strip-cell';
      if (cur > 0 && w < cur) { cls += ' is-past'; }
      if (w === cur) { cls += ' is-current'; }
      if (deload) { cls += ' is-deload'; }
      var label = 'Week ' + w + (deload ? ', deload' : '') + (w === cur ? ', this week' : '') + (doneCount(w) === 4 ? ', all sessions done' : '');
      var btn = el('button', { type: 'button', class: cls, 'aria-label': label, 'data-week': String(w) }, [String(w)]);
      if (opts.selected) { btn.setAttribute('aria-pressed', w === opts.selected ? 'true' : 'false'); }
      if (doneCount(w) === 4) { btn.appendChild(el('span', { class: 'pip', 'aria-hidden': 'true' })); }
      btn.addEventListener('click', (function (week) { return function () { opts.onPick(week); }; })(w));
      container.appendChild(btn);
    }
    P.PHASES.forEach(function (ph) {
      var lab = el('span', { class: 'strip-phase', text: ph.name });
      lab.style.gridColumn = ph.from + ' / span ' + (ph.to - ph.from + 1);
      container.appendChild(lab);
    });
  }

  /* ================= TODAY ================= */

  var heroRound = null;
  var heroRest = null;

  function sessionMeta(info) {
    return info.where + ', ' + info.minutes + ' min';
  }

  function renderToday() {
    var days = campDays();
    var raw = rawWeek();
    var week = currentWeek();
    var phase = P.phaseOf(week);
    var rr = P.roundsFor(week);

    $('today-date').textContent = fmtLong(today());
    if (days < 0) {
      var n = -days;
      $('today-title').textContent = 'Starts in ' + n + (n === 1 ? ' day' : ' days');
    } else if (raw > P.WEEKS) {
      $('today-title').textContent = 'Camp complete';
    } else {
      $('today-title').textContent = 'Week ' + week + ' of ' + P.WEEKS;
    }
    var phaseLine = phase.name + ' phase. ' + phase.goal;
    if (P.isDeload(week)) { phaseLine = 'Deload week. Drop one round and halve the conditioning.'; }
    if (raw > P.WEEKS) { phaseLine = 'All 12 weeks are behind you. Compare week 12 with week 1 in the log.'; }
    $('today-phase').textContent = phaseLine;

    if (!heroRound) { heroRound = sevenSeg($('hero-round')); heroRest = sevenSeg($('hero-rest')); }
    heroRound.set(rr.round);
    heroRest.set(rr.rest);
    $('hero-clock').setAttribute('aria-label', 'This week: ' + P.clock(rr.round) + ' rounds with ' + P.clock(rr.rest) + ' rest. Open the timer.');

    renderStrip($('today-strip'), { onPick: function (w) { ui.planWeek = w; go('plan'); } });

    renderNextUp(week);
    renderWeekList(week);

    $('start-date').value = data.settings.start;
    var start = startDate();
    if (days < 0) {
      $('start-note').textContent = 'Week 1 begins ' + fmtLong(start) + '.';
    } else if (raw > P.WEEKS) {
      $('start-note').textContent = 'Your camp started ' + fmtLong(start) + '. Pick a new date to run it again.';
    } else {
      var dayOfWeek = (days % 7) + 1;
      $('start-note').textContent = 'Week 1 began ' + fmtLong(start) + '. Today is day ' + dayOfWeek + ' of week ' + week + '.';
    }
  }

  function roundChips(rounds) {
    var ul = el('ul', { class: 'next-rounds', 'aria-label': 'Rounds' });
    var shown = 0;
    rounds.forEach(function (rd) {
      if (rd.dropped) { return; }
      shown += 1;
      ul.appendChild(el('li', null, [el('b', { text: 'R' + shown }), rd.tag]));
    });
    return ul;
  }

  function renderNextUp(week) {
    var body = clear($('next-body'));
    var key = nextSession(week);
    if (!key) {
      var nextStart = weekStart(Math.min(P.WEEKS, week) + 1);
      var msg = week >= P.WEEKS ? 'That’s all 12 weeks. Log your week 12 tests and compare them with week 1.' : 'All four sessions are done. Rest up. Week ' + (week + 1) + ' starts ' + fmtLong(nextStart) + '.';
      body.appendChild(el('div', { class: 'next-card' }, [
        el('p', { class: 'next-name', text: 'Week ' + week + ' done' }),
        el('p', { class: 'next-line', text: msg }),
        el('div', { class: 'next-actions' }, [
          el('button', { type: 'button', class: 'btn btn-quiet', text: 'See the plan', onclick: function () { ui.planWeek = Math.min(P.WEEKS, week + 1); go('plan'); } }),
          el('button', { type: 'button', class: 'btn btn-quiet', text: 'Open the log', onclick: function () { go('log'); } })
        ])
      ]));
      return;
    }
    var info = P.sessionInfo(week, key);
    var card = el('div', { class: 'next-card' });
    card.appendChild(el('div', { class: 'next-head' }, [
      el('span', { class: 'badge', 'aria-hidden': 'true', text: info.letter }),
      el('div', null, [
        el('h3', { class: 'next-name', text: key === 'BAG' ? 'Bag day' : 'Session ' + key + ': ' + info.name.toLowerCase() }),
        el('p', { class: 'next-meta', text: sessionMeta(info) + '. ' + info.focus + '.' })
      ])
    ]));

    var startLabel = 'Start session';
    if (key === 'BAG') {
      var bp = P.bagPlan(week, data.settings.bagMode);
      if (data.settings.bagMode === 'tests') {
        card.appendChild(el('p', { class: 'next-line', text: bp.deload
          ? 'Test day: push-ups and rope tests, then easy bag rounds and a short finisher.'
          : 'Test day: push-ups, rope, burpees, then the hard rounds test on the bag.' }));
        startLabel = 'Start test day';
      } else {
        card.appendChild(roundChips(bp.rounds));
        card.appendChild(el('p', { class: 'next-line', text: bp.finisher }));
      }
    } else {
      var hp = P.homePlan(week, key);
      if (hp.fightSim) {
        card.appendChild(el('p', { class: 'next-line', text: '6 × 3 min jab-led shadow rounds with 1 min rest. Box it like a real fight.' }));
      } else {
        card.appendChild(roundChips(hp.rounds));
        card.appendChild(el('p', { class: 'next-line' }, [el('strong', { text: 'Conditioning: ' }), hp.conditioning]));
      }
    }

    var actions = el('div', { class: 'next-actions' }, [
      el('button', { type: 'button', class: 'btn btn-go', text: startLabel, onclick: function () { openTimer(week, timerIdFor(key)); } }),
      el('button', { type: 'button', class: 'btn btn-quiet', text: 'Mark done', onclick: function () { setDone(week, key, true); toast((key === 'BAG' ? 'Bag day' : 'Session ' + key) + ' marked done.'); renderToday(); } })
    ]);
    if (key === 'BAG') {
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-quiet', text: data.settings.bagMode === 'tests' ? 'Full session instead' : 'Test day instead', onclick: function () {
        data.settings.bagMode = data.settings.bagMode === 'tests' ? 'full' : 'tests';
        writeStore();
        renderToday();
      } }));
    }
    card.appendChild(actions);
    body.appendChild(card);
  }

  function timerIdFor(key) {
    if (key === 'BAG') { return 'BAG-' + data.settings.bagMode; }
    return key;
  }

  function renderWeekList(week) {
    var list = clear($('week-sessions'));
    var d = doneFor(week);
    P.ORDER.forEach(function (key) {
      var info = P.sessionInfo(week, key);
      var isDone = !!d[key];
      var name = key === 'BAG' ? 'Bag day' : 'Session ' + key + ': ' + info.name.toLowerCase();
      var row = el('li', { class: 'session-row' + (isDone ? ' is-done' : '') }, [
        el('span', { class: 'badge badge-small', 'aria-hidden': 'true', text: info.letter }),
        el('div', null, [
          el('div', { class: 'session-row-name', text: name }),
          el('div', { class: 'session-row-meta', text: sessionMeta(info) })
        ]),
        el('button', {
          type: 'button',
          class: 'done-toggle',
          'aria-pressed': isDone ? 'true' : 'false',
          'aria-label': (isDone ? 'Done: ' : 'Mark done: ') + name,
          onclick: function () { setDone(week, key, !isDone); renderToday(); }
        }, [checkIcon(isDone), isDone ? 'Done' : 'Mark done'])
      ]);
      list.appendChild(row);
    });
    var c = doneCount(week);
    $('week-count').textContent = c + ' of 4 sessions done this week.' + (c === 4 ? ' That’s the week.' : '');
  }

  function checkIcon(done) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    if (done) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M3 8.5l3 3 7-7');
      svg.appendChild(p);
    } else {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', '8');
      c.setAttribute('cy', '8');
      c.setAttribute('r', '5.5');
      svg.appendChild(c);
    }
    return svg;
  }

  /* ================= PLAN ================= */

  function renderPlan() {
    var week = ui.planWeek || currentWeek();
    ui.planWeek = week;
    renderStrip($('plan-strip'), { selected: week, onPick: function (w) { ui.planWeek = w; renderPlan(); } });

    var phase = P.phaseOf(week);
    var rr = P.roundsFor(week);
    var root = clear($('plan-week'));

    var facts = el('ul', { class: 'week-facts' }, [
      el('li', null, [phase.name + ' phase']),
      el('li', { class: 'fact-round' }, [el('b', { text: P.clock(rr.round) }), 'rounds']),
      el('li', { class: 'fact-rest' }, [el('b', { text: P.clock(rr.rest) }), 'rest']),
      P.isDeload(week) ? el('li', { class: 'fact-deload', text: 'Deload' }) : null,
      week === rawWeek() ? el('li', { text: 'This week' }) : null
    ]);
    var notes = [];
    if (rr.round === 120) { notes.push('2-minute rounds, so home sessions get a 5th round: jab-led freestyle.'); }
    if (P.isDeload(week)) { notes.push('Deload: drop one round and halve the conditioning.'); }
    if (week === 12) { notes.push('Week 12: test benchmarks on bag day, and make your last home session a fight simulation.'); }
    notes.push('Move up a round length only when your form holds for the full round.');

    root.appendChild(el('div', { class: 'week-head' }, [
      el('h2', { class: 'week-title', text: 'Week ' + week + (week === rawWeek() ? '' : ', ' + fmtShort(weekStart(week))) }),
      facts,
      el('p', { class: 'lede', text: phase.goal }),
      el('ul', { class: 'week-notes' }, notes.map(function (t) { return el('li', { text: t }); }))
    ]));

    var grid = el('div', { class: 'plan-sessions' });
    P.ORDER.forEach(function (key) {
      grid.appendChild(key === 'BAG' ? bagArticle(week) : homeArticle(week, key));
    });
    root.appendChild(grid);
  }

  function sessionHead(info, title, meta) {
    return el('div', { class: 'session-head' }, [
      el('span', { class: 'badge', 'aria-hidden': 'true', text: info.letter }),
      el('div', null, [
        el('h3', { class: 'session-name', text: title }),
        el('p', { class: 'session-meta', text: meta })
      ])
    ]);
  }

  function line(label, text) {
    return el('p', { class: 'session-line' }, [label ? el('span', { class: 'line-label', text: label }) : null, text]);
  }

  function roundsList(rounds, extraClass) {
    var ol = el('ol', { class: 'rounds' + (extraClass ? ' ' + extraClass : '') });
    rounds.forEach(function (rd) {
      var body = el('span', { class: 'round-body' }, [el('span', { class: 'round-text', text: rd.text })]);
      if (rd.extra) { body.appendChild(el('span', { class: 'round-tag', text: '2-min weeks only' })); }
      if (rd.dropped) { body.appendChild(el('span', { class: 'round-tag', text: 'Dropped this week' })); }
      if (rd.fixedDur) { body.appendChild(el('span', { class: 'round-tag', text: 'Always 3:00' })); }
      ol.appendChild(el('li', { class: rd.dropped ? 'is-dropped' : '' }, [body]));
    });
    return ol;
  }

  function homeArticle(week, key) {
    var plan = P.homePlan(week, key);
    var info = plan.info;
    var rr = P.roundsFor(week);
    var art = el('article', { class: 'session', id: 'plan-' + key, 'aria-labelledby': 'plan-' + key + '-name' });
    var head = sessionHead(info, (plan.fightSim ? 'Fight simulation' : info.name), 'Session ' + key + '. ' + sessionMeta(info) + '. ' + info.focus + '.');
    head.querySelector('h3').id = 'plan-' + key + '-name';
    art.appendChild(head);
    art.appendChild(line('Warm-up', plan.warmup));
    if (plan.fightSim) {
      var ol = el('ol', { class: 'rounds' }, [el('li', { class: 'is-fight' }, [el('span', { class: 'round-text', text: '3-min jab-led shadow rounds with 1 min rest. Jab, move and counter like it’s a real fight.' })])]);
      art.appendChild(el('div', null, [el('span', { class: 'line-label', text: 'Rounds, 3:00 each' }), ol]));
    } else {
      art.appendChild(el('div', null, [el('span', { class: 'line-label', text: 'Shadowboxing rounds, ' + P.clock(rr.round) + ' each, ' + P.clock(rr.rest) + ' rest' }), roundsList(plan.rounds)]));
      art.appendChild(line('Conditioning', plan.conditioning));
      art.appendChild(line('Core', plan.core));
    }
    art.appendChild(line(null, plan.finish));
    art.appendChild(el('div', { class: 'session-actions' }, [
      el('button', { type: 'button', class: 'btn btn-quiet btn-small', text: 'Open in timer', onclick: function () { openTimer(week, key); } })
    ]));
    return art;
  }

  function bagArticle(week) {
    var mode = data.settings.bagMode;
    var plan = P.bagPlan(week, mode);
    var art = el('article', { class: 'session', id: 'plan-BAG', 'aria-labelledby': 'plan-BAG-name' });
    var head = sessionHead(plan.info, 'Bag day', 'Gym, 60 min. One a week, whenever you can get to a bag.');
    head.querySelector('h3').id = 'plan-BAG-name';
    art.appendChild(head);

    var sw = el('div', { class: 'mode-switch', role: 'group', 'aria-label': 'Bag day type' });
    [['tests', 'Test day'], ['full', 'Full session']].forEach(function (m) {
      sw.appendChild(el('button', {
        type: 'button',
        'aria-pressed': mode === m[0] ? 'true' : 'false',
        text: m[1],
        onclick: function () { data.settings.bagMode = m[0]; writeStore(); renderPlan(); }
      }));
    });
    art.appendChild(sw);

    var rr = P.roundsFor(week);
    art.appendChild(line('Warm-up', 'Jump rope 5 min, then mobility 2 min.'));
    if (mode === 'tests') {
      art.appendChild(el('div', null, [
        el('span', { class: 'line-label', text: 'Tests, in this order' }),
        el('ol', { class: 'test-list' }, plan.tests.map(function (t) { return el('li', { text: t }); }))
      ]));
      art.appendChild(line('Then', plan.afterTests));
      if (plan.deload) {
        art.appendChild(el('div', null, [el('span', { class: 'line-label', text: 'Bag rounds, easy pace, ' + P.clock(rr.round) + ' each' }), roundsList(plan.rounds)]));
        art.appendChild(line('Finisher', plan.finisher));
      }
    } else {
      art.appendChild(el('div', null, [el('span', { class: 'line-label', text: 'Shadow rounds, ' + P.clock(rr.round) + ' each' }), roundsList(plan.shadow, 'rounds-shadow')]));
      art.appendChild(el('div', null, [el('span', { class: 'line-label', text: 'Bag rounds, ' + P.clock(rr.round) + ' each, ' + P.clock(rr.rest) + ' rest' }), roundsList(plan.rounds)]));
      art.appendChild(line('Finisher', plan.finisher));
      art.appendChild(line(null, 'Then plank and stretch.'));
    }
    art.appendChild(el('ul', { class: 'week-notes' }, plan.notes.map(function (t) { return el('li', { text: t }); })));
    art.appendChild(el('div', { class: 'session-actions' }, [
      el('button', { type: 'button', class: 'btn btn-quiet btn-small', text: 'Open in timer', onclick: function () { openTimer(week, 'BAG-' + mode); } })
    ]));
    return art;
  }

  function renderPlanReference() {
    var rules = $('rules-list');
    P.RULES.forEach(function (t) { rules.appendChild(el('li', { text: t })); });
    var rows = [['1–2', 'Foundation', 120, 60], ['3–4', 'Foundation', 150, 60], ['5–8', 'Build', 180, 45], ['9–12', 'Sharpen', 180, 30]];
    var tb = $('rounds-table').querySelector('tbody');
    rows.forEach(function (r) {
      tb.appendChild(el('tr', null, [el('td', { text: r[0] }), el('td', { text: r[1] }), el('td', { text: P.clock(r[2]) }), el('td', { text: P.clock(r[3]) })]));
    });
    [['home-structure', P.HOME_STRUCTURE], ['bag-structure', P.BAG_STRUCTURE]].forEach(function (pair) {
      var body = $(pair[0]).querySelector('tbody');
      pair[1].forEach(function (r) { body.appendChild(el('tr', null, [el('td', { text: r[0] }), el('td', { text: r[1] })])); });
    });
  }

  /* ================= TIMER ================= */

  var engine = new Camp.Engine(onEngine);
  var bigClock = null;

  var OTHER_TIMERS = [
    ['custom', 'Custom rounds'],
    ['hard', 'Hard rounds test'],
    ['finisher', 'Bag finisher, 8 × 20 s'],
    ['rope', 'Jump rope, 3 × 3 min'],
    ['morning', 'Morning routine']
  ];

  function sessionOptions(week) {
    var c = P.sessionInfo(week, 'C');
    return [
      ['A', 'A: jab & range'],
      ['B', 'B: counter power'],
      ['BAG-tests', 'Bag day: test day'],
      ['BAG-full', 'Bag day: full session'],
      ['C', week === 12 ? 'C: fight simulation' : 'C: ' + c.name.toLowerCase()]
    ];
  }

  function buildSequence(week, id) {
    if (id === 'A' || id === 'B' || id === 'C') { return P.sessionSequence(week, id); }
    if (id === 'BAG-tests') { return P.sessionSequence(week, 'BAG', 'tests'); }
    if (id === 'BAG-full') { return P.sessionSequence(week, 'BAG', 'full'); }
    if (id === 'custom') { var c = data.settings.custom; return P.customSequence(c.rounds, c.round, c.rest); }
    if (id === 'hard') { var h = P.hardRoundsSequence(); h.week = week; return h; }
    if (id === 'finisher') { return P.finisherSequence(); }
    if (id === 'rope') { return P.ropeSequence(); }
    if (id === 'morning') { return P.morningSequence(); }
    return P.sessionSequence(week, 'A');
  }

  function fillTimerSelects() {
    var wk = $('pick-week');
    clear(wk);
    var cur = rawWeek();
    for (var w = 1; w <= P.WEEKS; w++) {
      wk.appendChild(el('option', { value: String(w), text: String(w) + (w === cur ? ' (now)' : ''), 'aria-label': 'Week ' + w + (w === cur ? ', this week' : '') }));
    }
    wk.value = String(ui.timerWeek);
    var sel = $('pick-seq');
    clear(sel);
    var g1 = el('optgroup', { label: 'Week ' + ui.timerWeek + ' sessions' });
    sessionOptions(ui.timerWeek).forEach(function (o) { g1.appendChild(el('option', { value: o[0], text: o[1] })); });
    var g2 = el('optgroup', { label: 'Other timers' });
    OTHER_TIMERS.forEach(function (o) { g2.appendChild(el('option', { value: o[0], text: o[1] })); });
    sel.appendChild(g1);
    sel.appendChild(g2);
    sel.value = ui.timerId;
  }

  function loadTimer(week, id) {
    ui.timerWeek = P.clampWeek(week);
    ui.timerId = id;
    fillTimerSelects();
    $('custom-panel').hidden = id !== 'custom';
    renderCustom();
    var seq = buildSequence(ui.timerWeek, id);
    if (typeof seq.week !== 'number' && (id === 'A' || id === 'B' || id === 'C' || id.indexOf('BAG') === 0)) { seq.week = ui.timerWeek; }
    engine.load(seq);
  }

  function openTimer(week, id) {
    if (engine.running) {
      toast('Pause the timer before you load another session.');
      go('timer');
      return;
    }
    loadTimer(week, id);
    go('timer');
  }

  function enterTimer() {
    if (!bigClock) { bigClock = sevenSeg($('clock-digits')); }
    if (!engine.seq) {
      var w = currentWeek();
      loadTimer(w, timerIdFor(nextSession(w) || 'A'));
    } else {
      renderTimer('show');
    }
    var rs = $('runsheet');
    if (window.matchMedia && window.matchMedia('(min-width: 980px)').matches) { rs.open = true; }
  }

  function renderCustom() {
    var c = data.settings.custom;
    $('val-rounds').textContent = String(c.rounds);
    $('val-round').textContent = P.clock(c.round);
    $('val-rest').textContent = P.clock(c.rest);
  }

  function clockState(seg) {
    if (engine.done) { return 'done'; }
    if (!seg) { return 'idle'; }
    if (seg.kind === 'rest') { return 'rest'; }
    if (seg.kind === 'prep') { return 'prep'; }
    if (seg.kind === 'manual') { return 'manual'; }
    return engine.inWarning() ? 'warn' : 'work';
  }

  function describeNext(seg) {
    if (!seg) { return 'Last step.'; }
    var t = 'Next: ' + seg.title;
    if (typeof seg.dur === 'number' && seg.kind !== 'rest') { t += ', ' + P.clock(seg.dur); }
    if (seg.kind === 'rest') { t += ' ' + P.clock(seg.dur); }
    return t + '.';
  }

  function onEngine(type) {
    if (type === 'load') { ui.sheetSig = ''; }
    if (ui.view === 'timer' || type !== 'tick') { renderTimer(type); }
    updateLiveDot();
  }

  function renderTimer(type) {
    if (!bigClock) { return; }
    var seq = engine.seq;
    if (!seq) { return; }
    var seg = engine.segment();
    var next = engine.segment(engine.idx + 1);
    var state = clockState(seg);
    var clockEl = $('clock');
    clockEl.setAttribute('data-state', state);
    var started = engine.running || engine.held > 0 || engine.idx > 0;
    clockEl.setAttribute('data-paused', (!engine.running && started && !engine.done) ? 'true' : 'false');
    bigClock.set(engine.display());

    var fill = 0;
    if (seg && typeof seg.dur === 'number' && !engine.done) { fill = Math.min(1, engine.elapsed() / seg.dur); }
    if (engine.done) { fill = 1; }
    $('clock-bar-fill').style.width = (fill * 100).toFixed(1) + '%';

    if (type === 'tick') {
      updateCue(seg);
      return;
    }

    $('now-seq').textContent = seq.name;
    if (engine.done) {
      $('now-title').textContent = 'Session complete';
      $('now-detail').textContent = '';
      $('now-next').textContent = '';
      $('now-cue').hidden = true;
      $('now-input').hidden = true;
    } else {
      $('now-title').textContent = seg.title;
      if (seg.kind === 'rest' && !seg.detail && next) {
        $('now-detail').textContent = 'Up next: ' + next.title + (next.detail ? '. ' + next.detail : '.');
        var after = engine.segment(engine.idx + 2);
        $('now-next').textContent = after ? 'Then: ' + after.title + '.' : '';
      } else {
        $('now-detail').textContent = seg.detail || '';
        $('now-next').textContent = describeNext(next);
      }
      updateCue(seg);
      var inp = seg.input;
      $('now-input').hidden = !inp;
      if (inp) {
        $('now-input-label').textContent = inp.label;
        $('now-input-unit').textContent = inp.unit;
        var field = $('now-input-field');
        var v = engine.results[inp.key];
        if (document.activeElement !== field) { field.value = typeof v === 'number' ? String(v) : ''; }
        field.setAttribute('data-key', inp.key);
      }
    }

    var goBtn = $('btn-go');
    goBtn.classList.toggle('is-running', engine.running && !(seg && seg.kind === 'manual'));
    if (engine.done) {
      goBtn.textContent = 'Start again';
    } else if (seg.kind === 'manual' && engine.running) {
      goBtn.textContent = seg.nextLabel || 'Done, next';
    } else if (engine.running) {
      goBtn.textContent = 'Pause';
    } else if (started) {
      goBtn.textContent = seg.kind === 'manual' ? (seg.nextLabel || 'Done, next') : 'Resume';
    } else {
      goBtn.textContent = 'Start';
    }
    $('btn-next').disabled = engine.done;
    $('btn-prev').disabled = !started && !engine.done;
    $('btn-broke').hidden = !(seg && seg.test && !engine.done && started);

    var locked = engine.running;
    $('pick-week').disabled = locked;
    $('pick-seq').disabled = locked;
    Array.prototype.forEach.call(document.querySelectorAll('.step-btn'), function (b) { b.disabled = locked; });

    renderDone();
    renderRunsheet();
  }

  function updateCue(seg) {
    var cueEl = $('now-cue');
    var cue = seg && !engine.done ? engine.activeCue() : null;
    if (!cue) { cueEl.hidden = true; return; }
    cueEl.hidden = false;
    if (cueEl.textContent !== cue.label) { cueEl.textContent = cue.label; }
    cueEl.classList.toggle('is-hot', !!cue.hot);
  }

  function renderRunsheet() {
    var seq = engine.seq;
    var list = $('runsheet-list');
    var sig = seq.id + ':' + seq.segments.length + ':' + seq.name;
    if (ui.sheetSig !== sig) {
      ui.sheetSig = sig;
      clear(list);
      seq.segments.forEach(function (s, i) {
        var time = typeof s.dur === 'number' ? P.clock(s.dur) : 'tap';
        var btn = el('button', { type: 'button', class: 'k-' + s.kind, 'data-i': String(i) }, [
          el('span', { class: 'dot', 'aria-hidden': 'true' }),
          el('span', { text: s.title + (s.kind === 'work' && s.tag && s.title.indexOf(s.tag) === -1 ? ': ' + s.tag.toLowerCase() : '') }),
          el('span', { class: 't', text: time })
        ]);
        btn.addEventListener('click', function () { jumpTo(i); });
        list.appendChild(el('li', null, [btn]));
      });
      var dur = P.sequenceDuration(seq);
      var mins = Math.round(dur.timed / 60);
      $('runsheet-total').textContent = seq.segments.length + ' steps, about ' + mins + ' min' + (dur.manual ? ' plus ' + dur.manual + ' tap ' + (dur.manual === 1 ? 'step' : 'steps') : '');
    }
    Array.prototype.forEach.call(list.children, function (li, i) {
      li.classList.toggle('is-past', i < engine.idx || engine.done);
      li.classList.toggle('is-now', i === engine.idx && !engine.done);
      var b = li.firstChild;
      if (i === engine.idx && !engine.done) { b.setAttribute('aria-current', 'step'); } else { b.removeAttribute('aria-current'); }
    });
  }

  function jumpTo(i) {
    engine.done = false;
    engine.goto(i, true);
    renderTimer('segment');
  }

  /* Results and the end-of-session panel */
  function renderDone() {
    var panel = $('done-panel');
    if (!engine.done) { panel.hidden = true; return; }
    panel.hidden = false;
    var seq = engine.seq;
    $('done-text').textContent = seq.name + ' is done.';
    var mark = $('btn-mark-done');
    if (seq.session && typeof seq.week === 'number') {
      var already = !!doneFor(seq.week)[seq.session];
      mark.hidden = false;
      mark.disabled = already;
      mark.className = 'btn ' + (resultKeys(seq).length ? 'btn-quiet' : 'btn-go');
      mark.textContent = already ? 'Marked done' : 'Mark ' + (seq.session === 'BAG' ? 'bag day' : 'session ' + seq.session) + ' done for week ' + seq.week;
    } else {
      mark.hidden = true;
    }
    renderResultsForm();
  }

  function resultKeys(seq) {
    if (seq.id === 'hard') { return ['hard']; }
    if (!seq.tests) { return []; }
    return P.isDeload(seq.week) ? ['pushups', 'rope'] : ['pushups', 'rope', 'burpees', 'hard'];
  }

  function renderResultsForm() {
    var seq = engine.seq;
    var keys = resultKeys(seq);
    var form = $('results-form');
    if (!keys.length) { form.hidden = true; return; }
    form.hidden = false;
    var w = typeof seq.week === 'number' ? seq.week : currentWeek();
    $('results-note').textContent = 'Check your numbers, then save them to week ' + w + '.';
    $('btn-save-results').textContent = 'Save to week ' + w;
    var grid = clear($('results-fields'));
    keys.forEach(function (k) {
      var m = metric(k);
      var v = engine.results[k];
      var id = 'res-' + k;
      var input = el('input', {
        type: m.type === 'time' ? 'text' : 'number',
        id: id,
        inputmode: m.type === 'time' ? 'numeric' : 'numeric',
        min: '0',
        max: m.max ? String(m.max) : null,
        placeholder: m.placeholder,
        value: typeof v === 'number' ? (m.type === 'time' ? P.clock(v) : String(v)) : ''
      });
      grid.appendChild(el('div', { class: 'log-field' }, [el('label', { for: id, text: m.label }), input]));
    });
  }

  function saveResults(e) {
    e.preventDefault();
    var seq = engine.seq;
    var w = typeof seq.week === 'number' ? seq.week : currentWeek();
    var keys = resultKeys(seq);
    var entry = data.logs[w] ? Object.assign({}, data.logs[w]) : {};
    var bad = null;
    keys.forEach(function (k) {
      var m = metric(k);
      var input = $('res-' + k);
      var parsed = parseMetric(m, input.value);
      input.setAttribute('aria-invalid', parsed.error ? 'true' : 'false');
      if (parsed.error && !bad) { bad = parsed.error; input.focus(); }
      if (!parsed.error) {
        if (parsed.empty) { delete entry[k]; } else { entry[k] = parsed.value; }
      }
    });
    if (bad) { toast(bad); return; }
    if (!entry.date) { entry.date = isoDate(today()); }
    data.logs[w] = entry;
    writeStore();
    toast('Saved to week ' + w + '.');
  }

  function updateLiveDot() {
    $('tab-live').hidden = !(engine.running && ui.view !== 'timer');
  }

  function wireTimer() {
    $('btn-go').addEventListener('click', function () {
      var seg = engine.segment();
      if (engine.done) { engine.reset(); engine.start(); return; }
      if (seg && seg.kind === 'manual' && engine.running) { engine.next(); return; }
      if (seg && seg.kind === 'manual' && !engine.running && (engine.held > 0 || engine.idx > 0)) { engine.next(); return; }
      engine.toggle();
    });
    $('btn-next').addEventListener('click', function () { Sound.unlock(); engine.next(); });
    $('btn-prev').addEventListener('click', function () { engine.prev(); renderTimer('segment'); });
    $('btn-broke').addEventListener('click', function () { engine.formBroke(); toast('Hard rounds: ' + (engine.results.hard || 0) + ' of 8.'); });
    $('btn-again').addEventListener('click', function () { engine.reset(); });
    $('btn-mark-done').addEventListener('click', function () {
      var seq = engine.seq;
      setDone(seq.week, seq.session, true);
      toast('Marked done.');
      renderDone();
    });
    $('results-form').addEventListener('submit', saveResults);

    $('pick-week').addEventListener('change', function () {
      loadTimer(+this.value, ui.timerId);
    });
    $('pick-seq').addEventListener('change', function () {
      loadTimer(ui.timerWeek, this.value);
    });

    Array.prototype.forEach.call(document.querySelectorAll('.stepper'), function (st) {
      var key = st.getAttribute('data-key');
      Array.prototype.forEach.call(st.querySelectorAll('.step-btn'), function (b) {
        b.addEventListener('click', function () {
          var dir = +b.getAttribute('data-step');
          var c = data.settings.custom;
          if (key === 'rounds') { c.rounds = Math.min(20, Math.max(1, c.rounds + dir)); }
          if (key === 'round') { c.round = Math.min(600, Math.max(15, c.round + dir * 15)); }
          if (key === 'rest') { c.rest = Math.min(300, Math.max(0, c.rest + dir * 15)); }
          writeStore();
          loadTimer(ui.timerWeek, 'custom');
        });
      });
    });

    $('now-input-field').addEventListener('input', function () {
      var key = this.getAttribute('data-key');
      var v = this.value === '' ? '' : parseInt(this.value, 10);
      engine.setResult(key, v === '' ? '' : (isNaN(v) ? '' : Math.max(0, v)));
    });

    $('opt-sound').checked = data.settings.sound;
    $('opt-voice').checked = data.settings.voice;
    Sound.enabled = data.settings.sound;
    Sound.voice = data.settings.voice;
    $('opt-sound').addEventListener('change', function () {
      data.settings.sound = this.checked;
      Sound.enabled = this.checked;
      if (this.checked) { Sound.unlock(); Sound.beep(880, 0.1, 0.1); }
      writeStore();
    });
    $('opt-voice').addEventListener('change', function () {
      data.settings.voice = this.checked;
      Sound.voice = this.checked;
      if (this.checked) { Sound.unlock(); Sound.say('Voice on.'); }
      writeStore();
    });

    document.addEventListener('keydown', function (e) {
      if (ui.view !== 'timer' || e.metaKey || e.ctrlKey || e.altKey) { return; }
      var t = e.target;
      var tag = t && t.tagName ? t.tagName.toLowerCase() : '';
      if (['input', 'select', 'textarea', 'button', 'summary', 'a'].indexOf(tag) !== -1) { return; }
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); $('btn-go').click(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); engine.next(); }
    });

    $('hero-clock').addEventListener('click', function () {
      var w = currentWeek();
      openTimer(w, timerIdFor(nextSession(w) || 'A'));
    });
  }

  /* ================= LOG ================= */

  function parseTime(str) {
    str = String(str || '').trim();
    if (!str) { return { empty: true }; }
    var m = /^(\d{1,3})(?::(\d{1,2}))?$/.exec(str);
    if (m) {
      var mins = parseInt(m[1], 10);
      var secs = m[2] ? parseInt(m[2], 10) : 0;
      if (secs > 59) { return { error: 'Seconds must be 59 or less.' }; }
      return { value: mins * 60 + secs };
    }
    var d = /^(\d+)[.,](\d+)$/.exec(str);
    if (d) { return { value: Math.round(parseFloat(d[1] + '.' + d[2]) * 60) }; }
    return { error: 'Enter time as minutes:seconds, like 2:30.' };
  }

  function parseMetric(m, raw) {
    var str = String(raw || '').trim();
    if (!str) { return { empty: true }; }
    if (m.type === 'time') {
      var t = parseTime(str);
      if (t.error) { return { error: m.label + ': ' + t.error }; }
      return t;
    }
    var v = Number(str.replace(',', '.'));
    if (!isFinite(v) || v < 0) { return { error: m.label + ': enter a number of 0 or more.' }; }
    if (m.type === 'int') {
      if (Math.round(v) !== v) { return { error: m.label + ': use a whole number.' }; }
      if (m.max && v > m.max) { return { error: m.label + ': the most is ' + m.max + '.' }; }
    }
    if (m.key === 'weight' && (v < 25 || v > 250)) { return { error: 'Bodyweight: enter your weight in kg.' }; }
    return { value: m.type === 'decimal' ? Math.round(v * 10) / 10 : v };
  }

  function fmtMetric(m, v) {
    if (typeof v !== 'number') { return ''; }
    if (m.type === 'time') { return P.clock(v); }
    if (m.type === 'decimal') { return (Math.round(v * 10) / 10).toFixed(1); }
    return String(v);
  }

  function fmtMetricLong(m, v) {
    var s = fmtMetric(m, v);
    if (m.key === 'weight') { return s + ' kg'; }
    if (m.key === 'hard') { return s + ' of 8 rounds'; }
    if (m.type === 'int') { return s + ' ' + (v === 1 ? 'rep' : 'reps'); }
    return s;
  }

  function buildLogFields() {
    var wrap = clear($('log-fields'));
    METRICS.forEach(function (m) {
      var id = 'log-' + m.key;
      var input = el('input', {
        type: m.type === 'time' ? 'text' : 'number',
        id: id,
        name: m.key,
        inputmode: m.type === 'decimal' ? 'decimal' : 'numeric',
        step: m.type === 'decimal' ? '0.1' : '1',
        min: '0',
        max: m.max ? String(m.max) : null,
        placeholder: m.placeholder,
        autocomplete: 'off',
        'aria-describedby': id + '-hint'
      });
      wrap.appendChild(el('div', { class: 'log-field' }, [
        el('label', { for: id, text: m.label }),
        input,
        el('span', { class: 'hint', id: id + '-hint', text: m.sub })
      ]));
    });
  }

  function fillLogForm() {
    var w = ui.logWeek;
    $('log-week').value = String(w);
    var entry = data.logs[w] || {};
    var deload = P.isDeload(w);
    $('log-date').value = entry.date || (w === rawWeek() ? isoDate(today()) : isoDate(weekStart(w)));
    METRICS.forEach(function (m) {
      var input = $('log-' + m.key);
      input.value = fmtMetric(m, entry[m.key]);
      input.setAttribute('aria-invalid', 'false');
      var skip = deload && m.deloadSkip;
      input.disabled = skip && typeof entry[m.key] !== 'number';
      input.placeholder = skip ? 'Skip' : m.placeholder;
    });
    $('log-deload').hidden = !deload;
    $('log-error').hidden = true;
    $('btn-save-week').textContent = 'Save week ' + w;
  }

  function renderLog() {
    var sel = $('log-week');
    if (!sel.options.length || sel.getAttribute('data-cur') !== String(rawWeek())) {
      clear(sel);
      var cur = rawWeek();
      for (var w = 1; w <= P.WEEKS; w++) {
        sel.appendChild(el('option', { value: String(w), text: 'Week ' + w + (P.isDeload(w) ? ' (deload)' : '') + (w === cur ? ' (now)' : '') }));
      }
      sel.setAttribute('data-cur', String(cur));
    }
    if (!ui.logWeek) { ui.logWeek = currentWeek(); }
    fillLogForm();
    renderMetricTabs();
    renderChart();
    renderLogTable();
  }

  function saveLog(e) {
    e.preventDefault();
    var w = ui.logWeek;
    var entry = {};
    var firstBad = null;
    METRICS.forEach(function (m) {
      var input = $('log-' + m.key);
      if (input.disabled) { return; }
      var parsed = parseMetric(m, input.value);
      input.setAttribute('aria-invalid', parsed.error ? 'true' : 'false');
      if (parsed.error) { if (!firstBad) { firstBad = { msg: parsed.error, input: input }; } return; }
      if (!parsed.empty) { entry[m.key] = parsed.value; }
    });
    var errEl = $('log-error');
    if (firstBad) {
      errEl.textContent = firstBad.msg;
      errEl.hidden = false;
      firstBad.input.focus();
      return;
    }
    errEl.hidden = true;
    var date = $('log-date').value;
    var hasValues = Object.keys(entry).length > 0;
    if (hasValues) {
      if (parseIso(date)) { entry.date = date; }
      data.logs[w] = entry;
    } else {
      delete data.logs[w];
    }
    var ok = writeStore();
    toast(!ok ? 'Saved for now, but this browser won’t keep it. Copy it to Notes.' : hasValues ? 'Saved week ' + w + '.' : 'Cleared week ' + w + '.');
    renderChart();
    renderLogTable();
  }

  function notesBlock(w, entry) {
    var deload = P.isDeload(w);
    var d = entry && entry.date ? parseIso(entry.date) : null;
    var lines = ['WEEK ' + w + (deload ? ' (deload)' : '') + ' — Date: ' + (d ? fmtShort(d) : '')];
    METRICS.forEach(function (m) {
      var v = entry ? entry[m.key] : undefined;
      var text = typeof v === 'number' ? fmtMetric(m, v) : (deload && m.deloadSkip ? 'skip' : '');
      lines.push(m.notes + ': ' + text);
    });
    return lines.join('\n');
  }

  function formEntry() {
    var entry = {};
    METRICS.forEach(function (m) {
      var p = parseMetric(m, $('log-' + m.key).value);
      if (!p.error && !p.empty) { entry[m.key] = p.value; }
    });
    var date = $('log-date').value;
    if (parseIso(date)) { entry.date = date; }
    return entry;
  }

  function renderMetricTabs() {
    var tabs = clear($('metric-tabs'));
    METRICS.forEach(function (m) {
      var selected = data.settings.metric === m.key;
      tabs.appendChild(el('button', {
        type: 'button',
        role: 'tab',
        'aria-selected': selected ? 'true' : 'false',
        tabindex: selected ? '0' : '-1',
        text: m.short,
        onclick: function () { data.settings.metric = m.key; writeStore(); renderMetricTabs(); renderChart(); },
        onkeydown: function (e) {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') { return; }
          e.preventDefault();
          var i = METRICS.indexOf(m) + (e.key === 'ArrowRight' ? 1 : -1);
          i = (i + METRICS.length) % METRICS.length;
          data.settings.metric = METRICS[i].key;
          writeStore();
          renderMetricTabs();
          renderChart();
          $('metric-tabs').children[i].focus();
        }
      }));
    });
  }

  function best(m) {
    if (!m.better) { return null; }
    var bestW = null;
    for (var w = 1; w <= P.WEEKS; w++) {
      var v = data.logs[w] && data.logs[w][m.key];
      if (typeof v !== 'number') { continue; }
      if (m.zero === true && v === 0 && m.better === 'up') { continue; }
      if (bestW === null) { bestW = w; continue; }
      var b = data.logs[bestW][m.key];
      if ((m.better === 'up' && v > b) || (m.better === 'down' && v < b)) { bestW = w; }
    }
    return bestW;
  }

  function niceStep(span, target) {
    var raw = span / target;
    var pow = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / pow;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  function timeStep(span) {
    var steps = [10, 15, 30, 60, 120, 300, 600];
    for (var i = 0; i < steps.length; i++) { if (span / steps[i] <= 5) { return steps[i]; } }
    return 900;
  }

  function renderChart() {
    var m = metric(data.settings.metric);
    $('chart-title').textContent = m.label;
    $('chart-sub').textContent = m.sub.charAt(0).toUpperCase() + m.sub.slice(1) + '.';
    var box = clear($('chart'));
    box.removeAttribute('tabindex');
    box.removeAttribute('role');
    box.removeAttribute('aria-label');
    var pts = [];
    for (var w = 1; w <= P.WEEKS; w++) {
      var v = data.logs[w] && data.logs[w][m.key];
      if (typeof v === 'number') { pts.push({ w: w, v: v }); }
    }
    if (!pts.length) {
      box.appendChild(el('div', { class: 'chart-empty' }, [
        el('p', { text: 'No ' + m.label.toLowerCase() + ' logged yet. Save a week and your trend shows here, week by week.' })
      ]));
      return;
    }

    var W = Math.max(300, Math.round(box.clientWidth || 640));
    var H = Math.round(Math.min(300, Math.max(230, W * 0.46)));
    var ml = 48, mr = 18, mt = 30, mb = 42;
    ui.chartWidth = W;
    var vals = pts.map(function (p) { return p.v; });
    var lo = Math.min.apply(null, vals);
    var hi = Math.max.apply(null, vals);
    var y0, y1, step;
    if (m.type === 'int') {
      y0 = 0;
      hi = Math.max(hi, m.max || 1);
      step = Math.max(1, niceStep(hi || 1, 4));
      y1 = Math.ceil(hi / step) * step;
      if (y1 === hi && m.max !== hi) { y1 += step; }
    } else if (m.type === 'time') {
      var spanT = Math.max(hi - lo, 30);
      step = timeStep(spanT);
      y0 = Math.max(0, Math.floor((lo - spanT * 0.15) / step) * step);
      y1 = Math.ceil((hi + spanT * 0.15) / step) * step;
      if (y1 === y0) { y1 = y0 + step; }
    } else {
      var spanW = Math.max(hi - lo, 2);
      step = niceStep(spanW, 4);
      y0 = Math.floor((lo - spanW * 0.2) / step) * step;
      y1 = Math.ceil((hi + spanW * 0.2) / step) * step;
    }
    var x = function (wk) { return ml + (wk - 1) * (W - ml - mr) / (P.WEEKS - 1); };
    var y = function (val) { return mt + (1 - (val - y0) / (y1 - y0)) * (H - mt - mb); };
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', m.label + ' by week. ' + pts.map(function (p) { return 'Week ' + p.w + ': ' + fmtMetricLong(m, p.v); }).join('; ') + '.');

    function node(tag, attrs, text) {
      var n = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      if (text !== undefined) { n.textContent = text; }
      return n;
    }

    var stepX = (W - ml - mr) / (P.WEEKS - 1);
    P.DELOAD_WEEKS.forEach(function (dw) {
      svg.appendChild(node('rect', { class: 'deload-band', x: (x(dw) - stepX / 2).toFixed(1), y: mt, width: stepX.toFixed(1), height: H - mt - mb }));
    });

    var grid = node('g', { class: 'grid' });
    var axis = node('g', { class: 'axis' });
    var guard = 0;
    for (var t = y0; t <= y1 + 1e-9 && guard < 20; t += step, guard++) {
      var yy = y(t).toFixed(1);
      grid.appendChild(node('line', { x1: ml, x2: W - mr, y1: yy, y2: yy }));
      axis.appendChild(node('text', { x: ml - 10, y: yy, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, m.type === 'time' ? P.clock(t) : (m.type === 'decimal' ? String(Math.round(t * 10) / 10) : String(Math.round(t)))));
    }
    for (var wk = 1; wk <= P.WEEKS; wk++) {
      axis.appendChild(node('text', { x: x(wk).toFixed(1), y: H - mb + 20, 'text-anchor': 'middle' }, String(wk)));
    }
    axis.appendChild(node('text', { class: 'axis-title', x: ((ml + W - mr) / 2).toFixed(1), y: H - 4, 'text-anchor': 'middle' }, 'Week'));
    svg.appendChild(grid);
    svg.appendChild(axis);

    if (pts.length > 1) {
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p.w).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
      svg.appendChild(node('path', { class: 'series-line', d: d }));
    }
    var bw = best(m);
    pts.forEach(function (p) {
      var isBest = bw === p.w && pts.length > 1;
      svg.appendChild(node('circle', { class: 'dot' + (isBest ? ' is-best' : ''), cx: x(p.w).toFixed(1), cy: y(p.v).toFixed(1), r: isBest ? 6 : 4.5 }));
    });
    if (bw && pts.length > 1) {
      var bv = data.logs[bw][m.key];
      var lx = Math.min(Math.max(x(bw), ml + 30), W - mr - 30);
      svg.appendChild(node('text', { class: 'best-label', x: lx.toFixed(1), y: (y(bv) - 13).toFixed(1), 'text-anchor': 'middle' }, 'Best ' + fmtMetric(m, bv)));
    }

    var cross = node('line', { class: 'crosshair', x1: 0, x2: 0, y1: mt, y2: H - mb, visibility: 'hidden' });
    svg.appendChild(cross);
    var hit = node('rect', { class: 'hit', x: ml - stepX / 2, y: 0, width: W - ml - mr + stepX, height: H });
    svg.appendChild(hit);
    box.appendChild(svg);

    var tip = el('div', { class: 'chart-tip', hidden: true });
    box.appendChild(tip);
    var focusIdx = pts.length - 1;

    function showPoint(i) {
      var p = pts[i];
      if (!p) { return; }
      focusIdx = i;
      var px = x(p.w);
      cross.setAttribute('x1', px.toFixed(1));
      cross.setAttribute('x2', px.toFixed(1));
      cross.setAttribute('visibility', 'visible');
      var rect = svg.getBoundingClientRect();
      var scale = rect.width / W;
      clear(tip);
      tip.appendChild(el('b', { text: fmtMetricLong(m, p.v) }));
      tip.appendChild(document.createTextNode('Week ' + p.w + (P.isDeload(p.w) ? ', deload' : '') + (bw === p.w && pts.length > 1 ? ', best' : '')));
      tip.hidden = false;
      var left = px * scale;
      var tw = tip.offsetWidth || 120;
      left = Math.max(tw / 2, Math.min(rect.width - tw / 2, left));
      tip.style.left = left + 'px';
      tip.style.top = (y(p.v) * scale) + 'px';
    }
    function hide() { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); }
    function nearest(clientX) {
      var rect = svg.getBoundingClientRect();
      var vx = (clientX - rect.left) / (rect.width / W);
      var bi = 0, bd = Infinity;
      pts.forEach(function (p, i) { var dd = Math.abs(x(p.w) - vx); if (dd < bd) { bd = dd; bi = i; } });
      return bi;
    }
    hit.addEventListener('pointermove', function (e) { showPoint(nearest(e.clientX)); });
    hit.addEventListener('pointerdown', function (e) { showPoint(nearest(e.clientX)); });
    hit.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hide(); } });
    box.setAttribute('tabindex', '0');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', m.label + ' chart. Use the left and right arrow keys to read each week.');
    box.onkeydown = function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        showPoint(Math.max(0, Math.min(pts.length - 1, focusIdx + (e.key === 'ArrowRight' ? 1 : -1))));
      } else if (e.key === 'Escape') { hide(); }
    };
    box.onfocus = function () { showPoint(focusIdx); };
    box.onblur = hide;
  }

  function renderLogTable() {
    var table = clear($('log-table'));
    var bests = {};
    METRICS.forEach(function (m) { bests[m.key] = best(m); });
    var head = el('tr', null, [el('th', { scope: 'col', text: 'Week' }), el('th', { scope: 'col', text: 'Date' })].concat(METRICS.map(function (m) {
      return el('th', { scope: 'col', class: 'num', text: m.short + (m.key === 'weight' ? ' (kg)' : '') });
    })));
    table.appendChild(el('thead', null, [head]));
    var tb = el('tbody');
    var cur = rawWeek();
    for (var w = 1; w <= P.WEEKS; w++) {
      var entry = data.logs[w] || {};
      var row = el('tr', { class: w === cur ? 'is-current' : '' });
      row.appendChild(el('th', { scope: 'row' }, ['Week ' + w, el('span', { class: 'row-sub', text: P.phaseOf(w).name + (P.isDeload(w) ? ', deload' : '') })]));
      var dd = entry.date ? parseIso(entry.date) : null;
      row.appendChild(el('td', { class: dd ? '' : 'empty', text: dd ? fmtShort(dd) : '–' }));
      METRICS.forEach(function (m) {
        var v = entry[m.key];
        var has = typeof v === 'number';
        var isBest = has && bests[m.key] === w;
        var td = el('td', { class: 'num' + (has ? '' : ' empty') + (isBest ? ' is-best' : '') }, [has ? fmtMetric(m, v) : (P.isDeload(w) && m.deloadSkip ? 'skip' : '–')]);
        if (isBest) { td.appendChild(el('span', { class: 'visually-hidden', text: ' (best)' })); }
        row.appendChild(td);
      });
      tb.appendChild(row);
    }
    table.appendChild(tb);
  }

  function csv() {
    var head = ['Week', 'Phase', 'Deload', 'Date'].concat(METRICS.map(function (m) { return m.notes; }));
    var rows = [head];
    for (var w = 1; w <= P.WEEKS; w++) {
      var e = data.logs[w] || {};
      rows.push([String(w), P.phaseOf(w).name, P.isDeload(w) ? 'yes' : 'no', e.date || ''].concat(METRICS.map(function (m) { return fmtMetric(m, e[m.key]); })));
    }
    return rows.map(function (r) {
      return r.map(function (c) { c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
    }).join('\n') + '\n';
  }

  function wireLog() {
    buildLogFields();
    $('log-form').addEventListener('submit', saveLog);
    $('log-week').addEventListener('change', function () { ui.logWeek = +this.value; fillLogForm(); });
    $('btn-copy-week').addEventListener('click', function () {
      var text = notesBlock(ui.logWeek, formEntry());
      copyText(text).then(function (ok) { toast(ok ? 'Week ' + ui.logWeek + ' copied. Paste it into Notes.' : 'Copy didn’t work here. Select the numbers by hand.'); });
    });
    $('btn-copy-all').addEventListener('click', function () {
      var blocks = ['Boxing Benchmarks'];
      for (var w = 1; w <= P.WEEKS; w++) { blocks.push(notesBlock(w, data.logs[w])); }
      copyText(blocks.join('\n\n')).then(function (ok) { toast(ok ? 'All 12 weeks copied.' : 'Copy didn’t work here.'); });
    });
    $('btn-csv').addEventListener('click', function () {
      toast(download('boxing-benchmarks.csv', 'text/csv', csv()) ? 'CSV downloaded.' : 'Download didn’t start.');
    });
    $('btn-backup').addEventListener('click', function () {
      var payload = { app: 'boxing-camp', version: 1, exported: new Date().toISOString(), data: data };
      toast(download('boxing-camp-backup.json', 'application/json', JSON.stringify(payload, null, 2)) ? 'Backup downloaded.' : 'Download didn’t start.');
    });
    $('restore-file').addEventListener('change', function () {
      var file = this.files && this.files[0];
      var input = this;
      if (!file) { return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(String(reader.result));
          if (!parsed || parsed.app !== 'boxing-camp' || !parsed.data) { throw new Error('bad'); }
          data = normalize(parsed.data);
          writeStore();
          applyTheme();
          toast('Backup restored.');
          ui.logWeek = currentWeek();
          renderLog();
        } catch (e) {
          toast('That file isn’t a Boxing Camp backup.');
        }
        input.value = '';
      };
      reader.onerror = function () { toast('Couldn’t read that file.'); input.value = ''; };
      reader.readAsText(file);
    });
  }

  /* ================= DRILLS ================= */

  var PUNCHES = [
    [1, 'Jab', 'Lead hand, straight'],
    [2, 'Cross', 'Rear hand, straight'],
    [3, 'Lead hook', 'Lead hand'],
    [4, 'Rear hook', 'Rear hand'],
    [5, 'Lead uppercut', 'Lead hand'],
    [6, 'Rear uppercut', 'Rear hand']
  ];

  var FOOTWORK = [
    ['Step-drag', 'Push off the back foot to step forward and off the front foot to step back. Your feet never cross or come together, so your stance stays the same width and you can punch at any moment.'],
    ['Live at the edge of range', 'Stay just out of reach. Step in with the jab, then step straight back out.'],
    ['Make them miss, then counter', 'A small step back or pull back, then a 2 as they fall short.'],
    ['Exit at an angle', 'Pivot or side-step after a combo so you are never straight in front of them.'],
    ['Bounce is rhythm, not a punch', 'Don’t punch on every hop. Punch when you’re in range with your feet on the floor, because power comes from the ground.']
  ];

  var FOOT_DRILLS = [
    ['Line drill', 'Stand in stance over a line of tape. Step-drag forward, back and side to side. Each foot stays on its own side of the line.'],
    ['In-out jab', 'Step in with the jab, step back out, reset. Slow at first, then faster.'],
    ['Step back, counter', 'Step back, then throw a 2 straight away.'],
    ['Pivot out', 'Throw a 1-2, then pivot 45–90° on the ball of the lead foot.'],
    ['Film study', 'Watch Bivol vs Canelo with the sound off and only watch his feet.']
  ];

  var TERMS = [
    ['Range round', 'A round spent on distance. Touch the target with the jab, step out of range, reset. At home that’s the wall target, at the gym it’s the bag.'],
    ['Wall target', 'A strip of tape on a wall or door at chin height. Jab to just short of it, step out, reset.'],
    ['Sit down on the punch', 'Bend your knees a little as you turn your hips, so your bodyweight goes into the shot.'],
    ['Slip', 'Move your head just off the centre line, by bending your knees and turning your shoulders, so a straight punch goes past.'],
    ['Roll', 'Bend your knees and move your head in a U shape under a hook, coming up on the other side.'],
    ['Pull back', 'Lean back just out of reach of the jab, weight onto the back foot, then fire the 2 as you come forward.'],
    ['Catch the jab', 'Take the jab on your open rear glove held by your face, and fire back straight away.'],
    ['Feint', 'A small fake, a twitch of the shoulder or lead hand, to draw a reaction you can punch into.'],
    ['Pivot out', 'After a combo, turn on the ball of your lead foot and swing your back foot round to change the angle.'],
    ['Jab-led', 'Most of your punches are jabs, and your combos start with the jab.'],
    ['Punch-outs', 'Nonstop fast straight punches on the spot, as fast as you can while staying light.'],
    ['Burpee-sprawl', 'Hands to the floor, kick your legs back and drop your hips, then pop back up into your stance.'],
    ['Hard rounds test', '2-min bag rounds at a hard jab-led pace with 30 s rest. Count the rounds you finish before your hands drop or your pace clearly slows, up to 8.'],
    ['Deload', 'An easier week, weeks 4 and 8. Drop one round and halve the conditioning so your body catches up.']
  ];

  function renderDrills() {
    var pl = $('punch-list');
    PUNCHES.forEach(function (p) {
      pl.appendChild(el('li', null, [
        el('span', { class: 'punch-n', text: String(p[0]) }),
        el('span', { class: 'punch-name', text: p[1] }),
        el('span', { class: 'punch-hand', text: p[2] })
      ]));
    });
    function dl(target, rows) {
      rows.forEach(function (r) { target.appendChild(el('div', null, [el('dt', { text: r[0] }), el('dd', { text: r[1] })])); });
    }
    dl($('foot-principles'), FOOTWORK);
    dl($('foot-drills'), FOOT_DRILLS);
    dl($('terms-list'), TERMS);
    var M = P.MORNING;
    $('morning-note').textContent = M.note + ' 30 s rest between blocks, about 20 min in all.';
    var ml = $('morning-list');
    M.blocks.forEach(function (b) {
      ml.appendChild(el('li', null, [el('span', { class: 't', text: P.clock(b.dur) }), el('span', { text: b.text })]));
    });
    var mr = $('morning-rules');
    M.rules.forEach(function (t) { mr.appendChild(el('li', { text: t })); });
    $('btn-morning').addEventListener('click', function () { openTimer(currentWeek(), 'morning'); });
  }

  /* ================= theme, start date ================= */

  function applyTheme() {
    var t = data.settings.theme;
    if (t === 'light' || t === 'dark') { document.documentElement.setAttribute('data-theme', t); }
    else { document.documentElement.removeAttribute('data-theme'); }
    $('theme').value = t;
  }

  function wireGeneral() {
    $('theme').addEventListener('change', function () {
      data.settings.theme = this.value;
      writeStore();
      applyTheme();
    });
    $('start-date').addEventListener('change', function () {
      var d = parseIso(this.value);
      if (!d) { toast('Pick a date for week 1.'); this.value = data.settings.start; return; }
      data.settings.start = isoDate(d);
      writeStore();
      ui.planWeek = null;
      ui.logWeek = null;
      toast('Week 1 now begins ' + fmtLong(d) + '.');
      renderToday();
      if (!engine.running) {
        var w = currentWeek();
        loadTimer(w, timerIdFor(nextSession(w) || 'A'));
      }
    });
    window.addEventListener('hashchange', route);
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (ui.view === 'log' && $('chart').clientWidth && Math.abs($('chart').clientWidth - (ui.chartWidth || 0)) > 8) { renderChart(); }
      }, 150);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && ui.view === 'today') { renderToday(); }
    });
  }

  /* ================= boot ================= */

  function boot() {
    applyTheme();
    renderPlanReference();
    renderDrills();
    wireGeneral();
    wireTimer();
    wireLog();
    route();
    if (!storageOk) {
      setTimeout(function () { toast('This browser isn’t saving data, so your log and ticks reset when you leave.'); }, 600);
    }
    if ('serviceWorker' in navigator && window.location.protocol === 'https:' && !window.__noServiceWorker) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ });
      });
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();

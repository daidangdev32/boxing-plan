/*
 * The 12-week Bivol-style boxing plan: data, plus builders that turn a week
 * and a session into (a) a readable plan and (b) a step-by-step timer sequence.
 */
(function (Camp) {
  'use strict';

  var WEEKS = 12;
  var DELOAD_WEEKS = [4, 8];

  var PHASES = [
    { id: 1, name: 'Foundation', from: 1, to: 4, goal: 'Correct mechanics and an aerobic base. Slow and correct beats fast and sloppy.' },
    { id: 2, name: 'Build', from: 5, to: 8, goal: 'Longer rounds, defense that flows into counters, more work per minute.' },
    { id: 3, name: 'Sharpen', from: 9, to: 12, goal: 'Speed, explosive counters and holding a hard pace to the bell.' }
  ];

  var ORDER = ['A', 'B', 'BAG', 'C'];

  var SESSIONS = {
    A: { key: 'A', letter: 'A', name: 'Jab & range', where: 'Bag', minutes: 30, focus: 'Jab variety, distance and exits at 60–70% power', conditioning: 'Jump rope' },
    B: { key: 'B', letter: 'B', name: 'Counter power', where: 'Bag', minutes: 30, focus: 'Hard counters and body shots at full power', conditioning: 'Bodyweight circuit' },
    BAG: { key: 'BAG', letter: 'L', name: 'Long bag day', where: 'Bag', minutes: 60, focus: 'Everything on the bag, plus weekly tests', conditioning: 'Weekly tests or bag finisher' },
    C: { key: 'C', letter: 'C', name: 'Pace & defense', where: 'Bag', minutes: 30, focus: 'Guard switching, close range and output at 70%', conditioning: 'Intervals' }
  };

  var FIGHT_SIM = { key: 'C', letter: 'C', name: 'Fight simulation', where: 'Bag', minutes: 30, focus: '6 jab-led bag rounds at fight pace', conditioning: 'The rounds are the conditioning' };

  /* Sub-round patterns: the timer beeps when the drill switches. */
  var PATTERNS = {
    sprint: [{ label: 'Steady 1-2s', secs: 20 }, { label: 'Sprint', secs: 10, hot: true }],
    counters15: [{ label: 'Explosive counters', secs: 15, hot: true }, { label: 'Jab and move', secs: 15 }],
    pressure30: [{ label: 'Jab pressure', secs: 30, hot: true }, { label: 'Counters and exits', secs: 30 }],
    speedJabs: [{ label: 'Max-speed jabs', secs: 10, hot: true }, { label: 'Movement', secs: 20 }],
    counters10: [{ label: 'Explosive counters', secs: 10, hot: true }, { label: 'Jab and move', secs: 20 }],
    ropeBurst: [{ label: 'Easy rope', secs: 45 }, { label: 'Burst', secs: 15, hot: true }]
  };

  function r(tag, text, opts) {
    var o = { tag: tag, text: text };
    if (opts) { for (var k in opts) { o[k] = opts[k]; } }
    return o;
  }
  var NO = { noOpener: true };

  var RANGE = r('Range round', 'Range round: touch with the jab, step out, reset.');

  var HOME = {
    1: {
      A: {
        shadow: 'Footwork, then jab only.',
        rounds: [
          RANGE,
          r('Jab variety', 'Jab variety: touch jab, double jab, jab to the body, step left then jab.'),
          r('Jab with exit', 'Jab then step out. Jab, pull back, then 2.'),
          r('1-2, pivot out', '1-2, then pivot out.')
        ],
        cond: { type: 'rope', sets: 2, dur: 180, rest: 30 },
        core: { type: 'hold', name: 'Plank', sets: 2, dur: 30 }
      },
      B: {
        shadow: 'Slip, then 2-3.',
        rounds: [
          RANGE,
          r('Power 1-2', 'Power 1-2, sitting down on the 2.'),
          r('Slip, 2-3, out', 'Slip outside, then 2-3, then step out.'),
          r('Body jab, head 2', 'Jab to the body, then 2 to the head, full intent, then pivot.')
        ],
        cond: { type: 'circuit', rounds: 2, items: '10 push-ups, 15 squats and 10 burpees', rest: 60 },
        core: { type: 'reps', name: 'Leg raises', sets: 2, reps: 15 }
      },
      C: {
        shadow: 'Switch between long guard and high guard every few seconds, with footwork.',
        rounds: [
          RANGE,
          r('Catch, pull counter', 'Catch and jab back, then pull back and 2.'),
          r('Close range', 'Close range: high guard tight to the bag, short hooks and uppercuts, then step out.'),
          r('Nonstop 1-2s', 'Nonstop 1-2s, with a 10 s sprint every 30 s.', { pattern: 'sprint' })
        ],
        cond: { type: 'intervals', reps: 7, work: 30, rest: 30, label: 'High knees or burpees' },
        core: { type: 'reps', name: 'Russian twists', sets: 2, reps: 20 }
      }
    },
    2: {
      A: {
        shadow: 'Jab feints and guard switching.',
        rounds: [
          RANGE,
          r('Double jab, body-head', 'Double jab with a step, then jab to the body and jab to the head.'),
          r('Follow the slip', 'Jab, then 2 (he slipped inside) or 3 (he slipped outside), then out.'),
          r('Flicker, long hook', 'Flicker, long hook, 2 to the body, 1-2, pivot out.')
        ],
        cond: { type: 'rope', sets: 2, dur: 180, rest: 30, note: 'with a 15 s burst every minute', pattern: 'ropeBurst' },
        core: { type: 'hold', name: 'Plank with shoulder taps', sets: 2, dur: 40 }
      },
      B: {
        shadow: 'Pull back, then 2-3.',
        rounds: [
          RANGE,
          r('Counter the hook', 'Picture his hook, 2 straight down the middle, then 3, then out.'),
          r('Slip, body 2, head 3', 'Slip outside, 2 to the body, then 3 to the head.'),
          r('Counters, jab and move', 'Alternate 15 s of explosive counters with 15 s of jab and move.', { pattern: 'counters15' })
        ],
        cond: { type: 'circuit', rounds: 3, items: '12 push-ups, 10 jump squats and 8 burpees', rest: 45 },
        core: { type: 'hold', name: 'Hollow hold', sets: 2, dur: 30 }
      },
      C: {
        shadow: 'Picture his combo, cut it off with one shot, pivot out.',
        rounds: [
          RANGE,
          r('Pressure, counters', 'Alternate 30 s of jab pressure with 30 s of counters and exits.', { pattern: 'pressure30' }),
          r('Close range', 'Close range: high guard, cut his combo off with a short 2 or hook, frame off, pivot out.'),
          r('Nonstop 1-2s', 'Nonstop 1-2s, with a 10 s sprint every 30 s.', { pattern: 'sprint' })
        ],
        cond: { type: 'intervals', reps: 7, work: 40, rest: 20, label: 'Burpee-sprawls or punch-outs' },
        core: { type: 'reps', name: 'Bicycle crunches', sets: 2, reps: 20 }
      }
    },
    3: {
      A: {
        shadow: 'Feint, then the real jab.',
        rounds: [
          RANGE,
          r('Speed jabs', '10 s of max-speed jabs, then 20 s of movement, repeated.', { pattern: 'speedJabs' }),
          r('1-2-3, out', '1-2-3 with a short hook, then pivot or step out every time.'),
          r('Feint mix', 'Feint, then 2-3. Feint, 1-2, pivot. Mix them.')
        ],
        cond: { type: 'rope', sets: 2, dur: 180, rest: 30, note: 'hard' },
        core: { type: 'hold', name: 'Side plank', sets: 2, dur: 30, sides: true }
      },
      B: {
        shadow: 'Counters at full intent.',
        rounds: [
          RANGE,
          r('Counters, jab and move', 'Alternate 10 s of explosive counters with 20 s of jab and move.', { pattern: 'counters10' }),
          r('Counters, jab and move', 'Alternate 10 s of explosive counters with 20 s of jab and move.', { pattern: 'counters10' }),
          r('Counters, jab and move', 'Alternate 10 s of explosive counters with 20 s of jab and move.', { pattern: 'counters10' })
        ],
        cond: { type: 'circuit', rounds: 3, items: '8 explosive push-ups, 6 broad jumps, 10 jump squats and 8 burpees', rest: 45 },
        core: { type: 'reps', name: 'V-ups', sets: 2, reps: 12 }
      },
      C: {
        shadow: 'Guard switching at fight pace.',
        rounds: [
          r('Jab-led output', 'Steady, high, jab-led output with exits.'),
          r('Jab-led output', 'Steady, high, jab-led output with exits.'),
          r('Jab-led output', 'Steady, high, jab-led output with exits.'),
          r('Max output', 'Jab-heavy round at max output.')
        ],
        cond: { type: 'intervals', reps: 4, work: 60, rest: 30, label: 'Burpee-sprawls' },
        core: { type: 'hold', name: 'Plank', sets: 2, dur: 60 }
      }
    }
  };

  var EXTRA_ROUND = r('Jab-led freestyle', 'Jab-led freestyle, with an exit after every combo.');

  var BAG_SHADOW = [
    r('Footwork', 'Footwork: in, out, side to side, pivots.'),
    r('Jab only', 'Jab only: singles, doubles, jab to the body.')
  ];

  var BAG_ROUNDS = [
    r('Range round', 'Range round: jab, step out, reset.'),
    r('Jab variety', 'Jab variety: touch, double, body, step left then jab.'),
    r('1-2, pivot out', '1-2, then pivot out.'),
    r('Power 1-2s', 'Power 1-2s with a full hip turn.'),
    r('Flicker, long hook', 'Flicker, long hook, 2 to the body, 1-2, out.'),
    r('Step back, 2', 'Step back, then 2 as the opponent follows.'),
    r('Nonstop 1-2s', 'Nonstop 1-2s, with a 10 s sprint every 30 s.', { pattern: 'sprint' }),
    r('Push through', 'A full 3 min, jab-led, pushing through tired.', { fixedDur: 180 })
  ];

  var LIGHT_ROUNDS = [
    r('Range round', 'Light: range round. Jab, step out, reset.'),
    r('1-2, pivot out', 'Light: 1-2, then pivot out.')
  ];

  var RULES = [
    'Wrap your hands every session.',
    'Bag round 1 is always a range round: touch with the jab, step out, reset.',
    'Every combo ends with an exit: step out, pivot, pull back or roll. No standing still after the last punch.',
    'Rear hand stays on your cheek, lead elbow near your ribs.',
    'Snap punches back faster than you throw them. Keep the 3 short and tight.',
    'Change your rhythm: singles, doubles, pauses, feints. Never the same jab twice in a row.',
    'No more than 2 rounds of stiff jabs per session, to protect the lead shoulder.',
    'Stop bag work if your wrist or shoulder gives sharp pain.'
  ];

  var HOME_STRUCTURE = [
    ['0–4', 'Jump rope 3 min, then shoulder and wrist mobility 1 min'],
    ['4–7', '1 shadowboxing round to warm up the punches'],
    ['7–21', '4 bag rounds. On 2-min rounds, add a 5th: jab-led freestyle'],
    ['21–27', 'Conditioning'],
    ['27–30', 'Core, then stretch']
  ];

  var BAG_STRUCTURE = [
    ['0–8', 'Jump rope, then mobility'],
    ['8–14', '2 shadow rounds: footwork, then jab only'],
    ['14–44', '8 bag rounds'],
    ['44–55', 'Bag finisher: 8 × (20 s all-out punches, then 10 s rest), then 2 × 10 burpees'],
    ['55–60', 'Plank, then stretch']
  ];

  var MORNING = {
    name: 'Morning routine',
    note: 'Optional, on days you have time. Easy enough that you could talk through it.',
    blocks: [
      { tag: 'Jump rope', text: 'Jump rope: easy rhythm, light on the balls of your feet.', dur: 180 },
      { tag: 'Mobility', text: 'Mobility: arm circles, hip circles, neck, ankles.', dur: 120, kind: 'warm' },
      { tag: 'Footwork', text: 'Footwork: line drill forward, back and side to side, plus pivots.', dur: 180 },
      { tag: 'Jab only', text: 'Jab only: in-out jab, doubles, jab to the body.', dur: 180 },
      { tag: 'Shadowboxing', text: 'Shadowboxing: 1-2 then exit, pull back then 2. Slow and clean.', dur: 180 },
      { tag: 'Jump rope', text: 'Jump rope: steady, a little faster than the first round.', dur: 180 },
      { tag: 'Plank', text: 'Plank.', dur: 60 }
    ],
    rest: 30,
    rules: [
      'Breathe through your nose as much as you can. If you can’t, slow down.',
      'Keep it smooth rather than hard. This builds the habit and your base.',
      'On days with no boxing session, swap the rope rounds for a 15–20 min easy run.'
    ]
  };

  /* ---------- week helpers ---------- */

  function clampWeek(w) { return Math.min(WEEKS, Math.max(1, Math.round(w) || 1)); }
  function phaseOf(week) { week = clampWeek(week); return week <= 4 ? PHASES[0] : week <= 8 ? PHASES[1] : PHASES[2]; }
  function isDeload(week) { return DELOAD_WEEKS.indexOf(clampWeek(week)) !== -1; }
  function roundsFor(week) {
    week = clampWeek(week);
    if (week <= 2) { return { round: 120, rest: 60 }; }
    if (week <= 4) { return { round: 150, rest: 60 }; }
    if (week <= 8) { return { round: 180, rest: 45 }; }
    return { round: 180, rest: 30 };
  }
  function sessionInfo(week, key) {
    if (key === 'C' && clampWeek(week) === 12) { return FIGHT_SIM; }
    return SESSIONS[key];
  }

  /* ---------- text helpers ---------- */

  function clock(secs) {
    secs = Math.max(0, Math.round(secs));
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function span(secs) {
    if (secs % 60 === 0) { return (secs / 60) + ' min'; }
    if (secs < 60) { return secs + ' s'; }
    return clock(secs);
  }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function halve(n) { return Math.ceil(n / 2); }

  function conditioningFor(cond, deload) {
    var c = {};
    for (var k in cond) { c[k] = cond[k]; }
    if (deload) {
      if (c.type === 'rope') { c.sets = halve(c.sets); }
      if (c.type === 'circuit') { c.rounds = halve(c.rounds); }
      if (c.type === 'intervals') { c.reps = halve(c.reps); }
    }
    return c;
  }

  function conditioningText(c) {
    if (c.type === 'rope') {
      var t = 'Jump rope ' + c.sets + ' × 3 min';
      if (c.note) { t += ', ' + c.note; }
      if (c.sets > 1) { t += ', ' + c.rest + ' s rest between'; }
      return t + '.';
    }
    if (c.type === 'circuit') {
      var s = plural(c.rounds, 'round') + ' of ' + c.items;
      if (c.rounds > 1) { s += ', with ' + span(c.rest) + ' rest'; }
      return s + '.';
    }
    if (c.type === 'intervals') {
      return c.reps + ' × (' + span(c.work) + ' ' + c.label.toLowerCase() + ', then ' + span(c.rest) + ' rest).';
    }
    return '';
  }

  function coreText(core) {
    if (core.type === 'hold') {
      return core.name + ' ' + core.sets + ' × ' + span(core.dur) + (core.sides ? ' per side' : '') + '.';
    }
    return core.name + ' ' + core.sets + ' × ' + core.reps + '.';
  }

  /* ---------- readable plans ---------- */

  function homeRounds(week, key) {
    week = clampWeek(week);
    var base = HOME[phaseOf(week).id][key].rounds.slice();
    var list = base.map(function (x) { return copy(x); });
    if (roundsFor(week).round === 120) {
      var extra = copy(EXTRA_ROUND);
      extra.extra = true;
      list.push(extra);
    }
    if (isDeload(week)) { list[list.length - 1].dropped = true; }
    return list;
  }

  function copy(o) { var c = {}; for (var k in o) { c[k] = o[k]; } return c; }

  function homePlan(week, key) {
    week = clampWeek(week);
    var info = sessionInfo(week, key);
    var deload = isDeload(week);
    if (key === 'C' && week === 12) {
      return {
        key: key, week: week, info: info, fightSim: true,
        warmup: 'Jump rope 3 min, then mobility 1 min.',
        rounds: [r('Fight rounds', '6 × 3 min jab-led bag rounds with 1 min rest. Jab, move, counter, exit, like it’s a real fight.')],
        notes: ['Week 12: your last 30-min session is a fight simulation.'],
        finish: 'Then stretch: shoulders, chest, hips and calves.'
      };
    }
    var data = HOME[phaseOf(week).id][key];
    var cond = conditioningFor(data.cond, deload);
    var notes = [];
    if (roundsFor(week).round === 120) { notes.push('2-minute rounds this week, so add a 5th round: jab-led freestyle.'); }
    if (deload) { notes.push('Deload week: the last round is dropped and the conditioning is halved.'); }
    return {
      key: key, week: week, info: info,
      warmup: 'Jump rope 3 min, then shoulder and wrist mobility 1 min.',
      shadow: data.shadow,
      rounds: homeRounds(week, key),
      conditioning: conditioningText(cond),
      core: coreText(data.core),
      notes: notes,
      finish: 'Then stretch: shoulders, chest, hips and calves.'
    };
  }

  function bagRounds(week) {
    var list = BAG_ROUNDS.map(copy);
    if (isDeload(week)) { list[list.length - 1].dropped = true; }
    return list;
  }

  function bagPlan(week, mode) {
    week = clampWeek(week);
    var deload = isDeload(week);
    var finisherReps = deload ? 4 : 8;
    var burpeeSets = deload ? 1 : 2;
    var plan = { key: 'BAG', week: week, info: SESSIONS.BAG, mode: mode, deload: deload };
    plan.shadow = BAG_SHADOW.map(copy);
    plan.rounds = bagRounds(week);
    plan.finisher = 'Bag finisher: ' + finisherReps + ' × (20 s all-out punches, then 10 s rest), then ' + burpeeSets + ' × 10 burpees.';
    plan.tests = deload ? [
      'Max push-ups, one set. Rest 3 min.',
      'Jump rope, unbroken: the clock runs until you trip or stop. Rest 3 min.',
      'Deload week: skip the burpee test and the hard rounds test.'
    ] : [
      'Max push-ups, one set. Rest 3 min.',
      'Jump rope, unbroken: the clock runs until you trip or stop. Rest 3 min.',
      'Burpees in 3 min. Rest 4 min.',
      'Hard rounds on the bag: 2-min rounds at a hard jab-led pace, 30 s rest. Count the rounds you finish before your hands drop or your pace clearly slows, up to 8.'
    ];
    plan.afterTests = deload
      ? 'Then the bag rounds below at an easy pace, the halved finisher, and a stretch.'
      : 'Then 2 light technique rounds on the bag if you have time, and a stretch.';
    plan.notes = [];
    if (deload) { plan.notes.push('Deload week: drop the last bag round and halve the finisher.'); }
    if (week === 12) { plan.notes.push('Week 12: test day is your final result.'); }
    plan.notes.push('Wrap your hands for every bag round.');
    return plan;
  }

  /* ---------- timer sequences ---------- */

  function buildCues(dur, opener, patternKey, drillLabel) {
    var cues = [];
    var t = 0;
    var pattern = patternKey ? PATTERNS[patternKey] : null;
    if (opener) {
      cues.push({ at: 0, label: 'Jab only', hot: false });
      t = 30;
      if (!pattern && t < dur) { cues.push({ at: 30, label: drillLabel, hot: false }); }
    }
    if (pattern) {
      var i = 0;
      while (t < dur) {
        var p = pattern[i % pattern.length];
        cues.push({ at: t, label: p.label, hot: !!p.hot });
        t += p.secs;
        i += 1;
      }
    }
    return cues;
  }

  function prepSeg(detail) {
    return { kind: 'prep', title: 'Get ready', detail: detail || 'The first block starts when this reaches zero.', dur: 10 };
  }
  function restSeg(secs, title) {
    return { kind: 'rest', title: title || 'Rest', detail: '', dur: secs };
  }
  function roundSeg(round, i, n, dur, label) {
    var d = round.fixedDur || dur;
    return {
      kind: 'work', bell: true, warn: true,
      title: label + ' ' + i + ' of ' + n,
      tag: round.tag,
      detail: round.text,
      dur: d,
      cues: buildCues(d, !!round.opener, round.pattern, round.tag)
    };
  }

  function addRounds(segs, rounds, dur, rest, label) {
    rounds.forEach(function (rd, i) {
      if (i > 0) { segs.push(restSeg(rest)); }
      segs.push(roundSeg(rd, i + 1, rounds.length, dur, label));
    });
  }

  function addConditioning(segs, c) {
    var i;
    if (c.type === 'rope') {
      for (i = 1; i <= c.sets; i++) {
        if (i > 1) { segs.push(restSeg(c.rest)); }
        segs.push({
          kind: 'work', warn: false,
          title: 'Jump rope, set ' + i + ' of ' + c.sets,
          tag: 'Jump rope',
          detail: c.note ? cap(c.note) + '.' : 'Steady rhythm.',
          dur: c.dur,
          cues: c.pattern ? buildCues(c.dur, false, c.pattern) : []
        });
      }
    } else if (c.type === 'circuit') {
      for (i = 1; i <= c.rounds; i++) {
        if (i > 1) { segs.push(restSeg(c.rest)); }
        segs.push({ kind: 'manual', title: 'Circuit, round ' + i + ' of ' + c.rounds, tag: 'Circuit', detail: cap(c.items) + '. Tap Next when you finish.' });
      }
    } else if (c.type === 'intervals') {
      for (i = 1; i <= c.reps; i++) {
        if (i > 1) { segs.push(restSeg(c.rest)); }
        segs.push({ kind: 'work', warn: false, title: 'Interval ' + i + ' of ' + c.reps, tag: c.label, detail: c.label + '.', dur: c.work, cues: [] });
      }
    }
  }

  function addCore(segs, core) {
    if (core.type === 'hold') {
      var sides = core.sides ? ['left side', 'right side'] : [null];
      var n = core.sets;
      var first = true;
      for (var i = 1; i <= n; i++) {
        sides.forEach(function (side) {
          if (!first) { segs.push(restSeg(side === 'right side' ? 10 : 20, side === 'right side' ? 'Switch sides' : 'Rest')); }
          first = false;
          segs.push({ kind: 'work', warn: false, title: core.name + ', set ' + i + ' of ' + n + (side ? ', ' + side : ''), tag: core.name, detail: 'Hold it. Squeeze your glutes and brace your stomach.', dur: core.dur, cues: [] });
        });
      }
    } else {
      segs.push({ kind: 'manual', title: core.name, tag: core.name, detail: core.sets + ' × ' + core.reps + '. Tap Next when you finish.' });
    }
  }

  function stretchSeg() {
    return { kind: 'manual', title: 'Stretch', tag: 'Stretch', detail: 'Shoulders, chest, hips and calves. Tap Next to finish.' };
  }

  function homeSequence(week, key) {
    week = clampWeek(week);
    var info = sessionInfo(week, key);
    var rr = roundsFor(week);
    var segs = [prepSeg('Have your wraps and gloves ready.')];
    segs.push({ kind: 'warm', title: 'Warm-up: jump rope', tag: 'Jump rope', detail: 'Easy rhythm, light on the balls of your feet.', dur: 180 });
    segs.push({ kind: 'warm', title: 'Warm-up: mobility', tag: 'Mobility', detail: 'Arm circles, wrist circles, hips, upper back and ankles.', dur: 60 });
    segs.push(restSeg(15, 'Get in stance'));

    if (key === 'C' && week === 12) {
      var fight = [];
      for (var f = 0; f < 6; f++) { fight.push(r('Fight round', 'Jab-led bag round at fight pace. Jab, move, counter, exit.')); }
      addRounds(segs, fight, 180, 60, 'Fight round');
      segs.push(stretchSeg());
      return { id: 'w' + week + '-C', name: 'Week 12: fight simulation', week: week, session: key, segments: segs };
    }

    var data = HOME[phaseOf(week).id][key];
    segs.push({ kind: 'work', bell: true, warn: true, title: 'Shadow round', tag: 'Shadowboxing', detail: data.shadow + ' Wrap your hands after this.', dur: rr.round, cues: [] });
    segs.push(restSeg(rr.rest, 'Rest, then to the bag'));
    var rounds = homeRounds(week, key).filter(function (x) { return !x.dropped; });
    addRounds(segs, rounds, rr.round, rr.rest, 'Bag round');
    segs.push(restSeg(60, 'Rest before conditioning'));
    addConditioning(segs, conditioningFor(data.cond, isDeload(week)));
    segs.push(restSeg(20, 'Rest before core'));
    addCore(segs, data.core);
    segs.push(stretchSeg());
    return { id: 'w' + week + '-' + key, name: 'Week ' + week + ': session ' + key + ', ' + info.name.toLowerCase(), week: week, session: key, segments: segs };
  }

  function bagWarmup(segs) {
    segs.push(prepSeg('Wrap your hands before the first bag round.'));
    segs.push({ kind: 'warm', title: 'Warm-up: jump rope', tag: 'Jump rope', detail: 'Easy rhythm, then pick it up for the last minute.', dur: 300 });
    segs.push({ kind: 'warm', title: 'Warm-up: mobility', tag: 'Mobility', detail: 'Arm circles, hips, upper back and ankles.', dur: 120 });
  }

  function addBagWork(segs, week, easy) {
    var rr = roundsFor(week);
    segs.push(restSeg(15, 'Get in stance'));
    addRounds(segs, BAG_SHADOW, rr.round, rr.rest, 'Shadow round');
    segs.push(restSeg(rr.rest, 'Rest, then to the bag'));
    var rounds = bagRounds(week).filter(function (x) { return !x.dropped; });
    if (easy) {
      rounds = rounds.map(function (x) { var c = copy(x); c.text = 'Easy pace. ' + c.text; return c; });
    }
    addRounds(segs, rounds, rr.round, rr.rest, 'Bag round');
    var deload = isDeload(week);
    var reps = deload ? 4 : 8;
    segs.push(restSeg(60, 'Rest before the finisher'));
    for (var i = 1; i <= reps; i++) {
      if (i > 1) { segs.push(restSeg(10)); }
      segs.push({ kind: 'work', warn: false, title: 'Finisher ' + i + ' of ' + reps, tag: 'All-out punches', detail: 'All-out punches on the bag.', dur: 20, cues: [] });
    }
    segs.push({ kind: 'manual', title: 'Burpees', tag: 'Burpees', detail: (deload ? '1' : '2') + ' × 10 burpees. Tap Next when you finish.' });
  }

  function bagSequence(week, mode) {
    week = clampWeek(week);
    var deload = isDeload(week);
    var segs = [];
    bagWarmup(segs);
    if (mode === 'tests') {
      segs.push({ kind: 'manual', title: 'Test: max push-ups', tag: 'Push-ups', detail: 'One set with good form. Stop when your form breaks, then enter the number.', input: { key: 'pushups', label: 'Push-ups', unit: 'reps' } });
      segs.push(restSeg(180, 'Rest before the rope test'));
      segs.push({ kind: 'manual', title: 'Test: jump rope, unbroken', tag: 'Rope test', detail: 'Start skipping now. Tap Stop when you trip or stop.', record: 'rope', nextLabel: 'Stop' });
      segs.push(restSeg(180, 'Rest'));
      if (!deload) {
        segs.push({ kind: 'work', warn: true, title: 'Test: burpees in 3 min', tag: 'Burpees', detail: 'Count every burpee.', dur: 180, cues: [] });
        segs.push({ kind: 'rest', title: 'Rest before hard rounds', detail: 'Enter your burpee count.', dur: 240, input: { key: 'burpees', label: 'Burpees', unit: 'reps' } });
        for (var h = 1; h <= 8; h++) {
          if (h > 1) { segs.push({ kind: 'rest', title: 'Rest', detail: '', dur: 30, test: { name: 'hard', n: h - 1 } }); }
          segs.push({ kind: 'work', bell: true, warn: true, title: 'Hard round ' + h + ' of 8', tag: 'Hard round', detail: 'Hard, jab-led pace on the bag. Tap Form broke when your hands drop or your pace clearly slows.', dur: 120, cues: [], test: { name: 'hard', n: h } });
        }
        segs.push(restSeg(60, 'Rest, then light rounds'));
        var rr = roundsFor(week);
        addRounds(segs, LIGHT_ROUNDS, rr.round, rr.rest, 'Light round');
      } else {
        addBagWork(segs, week, true);
      }
      segs.push({ kind: 'manual', title: 'Plank, then stretch', tag: 'Stretch', detail: 'Plank as long as you like, then shoulders, chest, hips and calves.' });
      return { id: 'w' + week + '-BAG-tests', name: 'Week ' + week + ': long bag day with tests', week: week, session: 'BAG', tests: true, segments: segs };
    }
    addBagWork(segs, week, false);
    segs.push({ kind: 'manual', title: 'Plank, then stretch', tag: 'Stretch', detail: 'Plank as long as you like, then shoulders, chest, hips and calves.' });
    return { id: 'w' + week + '-BAG-full', name: 'Week ' + week + ': full bag session', week: week, session: 'BAG', segments: segs };
  }

  function sessionSequence(week, key, bagMode) {
    if (key === 'BAG') { return bagSequence(week, bagMode || 'tests'); }
    return homeSequence(week, key);
  }

  /* Simple timers */
  function customSequence(rounds, round, rest) {
    var segs = [prepSeg()];
    for (var i = 1; i <= rounds; i++) {
      if (i > 1) { segs.push(restSeg(rest)); }
      segs.push({ kind: 'work', bell: true, warn: true, title: 'Round ' + i + ' of ' + rounds, tag: 'Round', detail: '', dur: round, cues: [] });
    }
    return { id: 'custom', name: rounds + ' × ' + clock(round) + ' rounds, ' + clock(rest) + ' rest', segments: segs };
  }

  function hardRoundsSequence() {
    var segs = [prepSeg('2-min rounds at a hard jab-led pace, 30 s rest.')];
    for (var h = 1; h <= 8; h++) {
      if (h > 1) { segs.push({ kind: 'rest', title: 'Rest', detail: '', dur: 30, test: { name: 'hard', n: h - 1 } }); }
      segs.push({ kind: 'work', bell: true, warn: true, title: 'Hard round ' + h + ' of 8', tag: 'Hard round', detail: 'Hard, jab-led pace on the bag. Tap Form broke when your hands drop or your pace clearly slows.', dur: 120, cues: [], test: { name: 'hard', n: h } });
    }
    return { id: 'hard', name: 'Hard rounds test', tests: true, segments: segs };
  }

  function finisherSequence() {
    var segs = [prepSeg()];
    for (var i = 1; i <= 8; i++) {
      if (i > 1) { segs.push(restSeg(10)); }
      segs.push({ kind: 'work', warn: false, title: 'Finisher ' + i + ' of 8', tag: 'All-out punches', detail: 'All-out punches.', dur: 20, cues: [] });
    }
    return { id: 'finisher', name: 'Bag finisher, 8 × 20 s', segments: segs };
  }

  function ropeSequence() {
    var segs = [prepSeg()];
    for (var i = 1; i <= 3; i++) {
      if (i > 1) { segs.push(restSeg(30)); }
      segs.push({ kind: 'work', warn: false, title: 'Jump rope, set ' + i + ' of 3', tag: 'Jump rope', detail: 'Steady rhythm.', dur: 180, cues: [] });
    }
    return { id: 'rope', name: 'Jump rope, 3 × 3 min', segments: segs };
  }

  function morningSequence() {
    var segs = [prepSeg()];
    MORNING.blocks.forEach(function (b, i) {
      if (i > 0) { segs.push(restSeg(MORNING.rest)); }
      segs.push({ kind: b.kind || 'work', warn: false, title: b.tag, tag: b.tag, detail: b.text, dur: b.dur, cues: [] });
    });
    return { id: 'morning', name: 'Morning routine', segments: segs };
  }

  function sequenceDuration(seq) {
    var timed = 0;
    var manual = 0;
    seq.segments.forEach(function (s) {
      if (typeof s.dur === 'number') { timed += s.dur; } else { manual += 1; }
    });
    return { timed: timed, manual: manual };
  }

  Camp.plan = {
    WEEKS: WEEKS,
    DELOAD_WEEKS: DELOAD_WEEKS,
    PHASES: PHASES,
    ORDER: ORDER,
    SESSIONS: SESSIONS,
    RULES: RULES,
    HOME_STRUCTURE: HOME_STRUCTURE,
    BAG_STRUCTURE: BAG_STRUCTURE,
    MORNING: MORNING,
    clampWeek: clampWeek,
    phaseOf: phaseOf,
    isDeload: isDeload,
    roundsFor: roundsFor,
    sessionInfo: sessionInfo,
    homePlan: homePlan,
    bagPlan: bagPlan,
    homeRounds: homeRounds,
    sessionSequence: sessionSequence,
    customSequence: customSequence,
    hardRoundsSequence: hardRoundsSequence,
    finisherSequence: finisherSequence,
    ropeSequence: ropeSequence,
    morningSequence: morningSequence,
    sequenceDuration: sequenceDuration,
    clock: clock,
    span: span
  };
})(window.Camp = window.Camp || {});

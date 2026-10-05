/*
 * The round timer engine. It runs a sequence of segments (rounds, rests,
 * timed blocks and tap-to-continue steps) against the wall clock, so it stays
 * accurate when the phone throttles the page.
 */
(function (Camp) {
  'use strict';

  var Sound = Camp.Sound;

  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  function Engine(onChange) {
    this.onChange = onChange || function () {};
    this.seq = null;
    this.idx = 0;
    this.running = false;
    this.done = false;
    this.base = 0;
    this.held = 0;
    this.results = {};
    this.flags = {};
    this.interval = null;
    this.wake = null;
    var self = this;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && self.running) { self.lockScreen(); }
    });
  }

  Engine.prototype.emit = function (type) {
    try { this.onChange(type || 'tick', this); } catch (e) { if (window.console) { console.error(e); } }
  };

  Engine.prototype.load = function (seq) {
    this.halt();
    this.running = false;
    this.releaseScreen();
    this.seq = seq;
    this.idx = 0;
    this.done = false;
    this.held = 0;
    this.results = {};
    this.flags = {};
    this.emit('load');
  };

  Engine.prototype.segment = function (i) {
    if (!this.seq) { return null; }
    return this.seq.segments[typeof i === 'number' ? i : this.idx] || null;
  };

  Engine.prototype.elapsed = function () {
    return this.running ? (now() - this.base) / 1000 : this.held;
  };

  Engine.prototype.isTimed = function (seg) {
    seg = seg || this.segment();
    return !!seg && typeof seg.dur === 'number';
  };

  /* Seconds to show on the clock: counts down for timed blocks, up for tap-to-continue steps. */
  Engine.prototype.display = function () {
    var seg = this.segment();
    if (!seg) { return 0; }
    if (this.done) { return 0; }
    var e = this.elapsed();
    if (this.isTimed(seg)) { return Math.max(0, Math.ceil(seg.dur - e - 0.0001)); }
    return Math.floor(e);
  };

  Engine.prototype.activeCue = function () {
    var seg = this.segment();
    if (!seg || !seg.cues || !seg.cues.length) { return null; }
    var e = this.elapsed();
    var found = null;
    for (var i = 0; i < seg.cues.length; i++) {
      if (seg.cues[i].at <= e + 0.0001) { found = seg.cues[i]; } else { break; }
    }
    return found || seg.cues[0];
  };

  Engine.prototype.cueIndex = function (seg, e) {
    var ci = -1;
    for (var i = 0; i < seg.cues.length; i++) {
      if (seg.cues[i].at <= e + 0.0001) { ci = i; } else { break; }
    }
    return ci;
  };

  /* Time left in the whole sequence (timed blocks only) and how many tap steps remain. */
  Engine.prototype.left = function () {
    if (!this.seq) { return { secs: 0, manual: 0 }; }
    var secs = 0;
    var manual = 0;
    for (var i = this.idx; i < this.seq.segments.length; i++) {
      var s = this.seq.segments[i];
      if (typeof s.dur === 'number') {
        secs += i === this.idx ? Math.max(0, s.dur - this.elapsed()) : s.dur;
      } else {
        manual += 1;
      }
    }
    return { secs: this.done ? 0 : secs, manual: this.done ? 0 : manual };
  };

  Engine.prototype.inWarning = function () {
    var seg = this.segment();
    if (!seg || !seg.warn || !this.isTimed(seg) || seg.dur <= 20) { return false; }
    var rem = seg.dur - this.elapsed();
    return rem <= 10 && rem > 0;
  };

  Engine.prototype.start = function () {
    if (!this.seq || this.done || this.running) { return; }
    Sound.unlock();
    this.running = true;
    this.base = now() - this.held * 1000;
    if (!this.flags.entered) {
      this.flags.entered = true;
      this.enterSound(this.segment(), true);
    }
    this.loop();
    this.lockScreen();
    this.emit('state');
  };

  Engine.prototype.pause = function () {
    if (!this.running) { return; }
    this.held = this.elapsed();
    this.running = false;
    this.halt();
    this.releaseScreen();
    this.emit('state');
  };

  Engine.prototype.toggle = function () {
    if (this.running) { this.pause(); } else { this.start(); }
  };

  Engine.prototype.reset = function () {
    if (!this.seq) { return; }
    this.releaseScreen();
    this.load(this.seq);
  };

  Engine.prototype.halt = function () {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  };

  Engine.prototype.loop = function () {
    var self = this;
    this.halt();
    this.interval = setInterval(function () { self.tick(); }, 100);
    this.tick();
  };

  /* Step forward by hand: Next on a tap step, Skip on a timed block. */
  Engine.prototype.next = function () {
    if (!this.seq || this.done) { return; }
    var seg = this.segment();
    this.leave(seg, this.elapsed(), false);
    if (!this.running && seg.kind === 'manual') {
      this.goto(this.idx + 1, true);
      this.start();
      return;
    }
    this.goto(this.idx + 1, true);
  };

  Engine.prototype.prev = function () {
    if (!this.seq || this.idx === 0) {
      this.goto(0, false);
      return;
    }
    this.done = false;
    this.goto(this.idx - 1, false);
  };

  Engine.prototype.goto = function (i, sound) {
    if (!this.seq) { return; }
    if (i >= this.seq.segments.length) { this.finish(); return; }
    this.idx = Math.max(0, i);
    this.done = false;
    this.flags = { entered: this.running };
    this.held = 0;
    this.base = now();
    if (this.running && sound !== false) { this.enterSound(this.segment(), true); }
    this.emit('segment');
  };

  /* Hard rounds test: stop the test when form breaks and keep the completed count. */
  Engine.prototype.formBroke = function () {
    var seg = this.segment();
    if (!seg || !seg.test) { return; }
    var completed = seg.kind === 'work' ? seg.test.n - 1 : seg.test.n;
    this.results.hard = Math.max(0, completed);
    var j = this.idx;
    while (j < this.seq.segments.length && this.seq.segments[j].test) { j += 1; }
    this.emit('results');
    if (j >= this.seq.segments.length) { this.finish(); return; }
    if (this.running) { Sound.bell(3); }
    this.goto(j, false);
    this.flags.entered = true;
  };

  Engine.prototype.setResult = function (key, value) {
    if (value === '' || value === null || typeof value === 'undefined' || isNaN(value)) {
      delete this.results[key];
    } else {
      this.results[key] = value;
    }
  };

  Engine.prototype.finish = function () {
    this.running = false;
    this.done = true;
    this.halt();
    this.idx = this.seq.segments.length - 1;
    this.held = 0;
    Sound.bell(3);
    Sound.buzz([300, 120, 300]);
    Sound.say('Session complete.');
    this.releaseScreen();
    this.emit('done');
  };

  Engine.prototype.enterSound = function (seg, loud) {
    if (!seg || !loud) { return; }
    if (seg.kind === 'work' && seg.bell) {
      Sound.bell(1);
      Sound.buzz(250);
    } else if (seg.kind === 'work' || seg.kind === 'warm') {
      Sound.go();
      Sound.buzz(150);
    } else if (seg.kind === 'manual') {
      Sound.go();
    }
    Sound.say(this.speech(seg));
  };

  Engine.prototype.speech = function (seg) {
    if (!seg) { return ''; }
    if (seg.kind === 'rest') {
      var nx = this.segment(this.idx + 1);
      return 'Rest.' + (nx && nx.tag ? ' Next: ' + nx.tag + '.' : '');
    }
    if (seg.kind === 'prep') { return 'Get ready.'; }
    var cue = seg.cues && seg.cues.length ? seg.cues[0].label : '';
    return seg.title + '.' + (cue ? ' ' + cue + '.' : (seg.tag && seg.tag !== seg.title ? ' ' + seg.tag + '.' : ''));
  };

  /* Record what a step measured as it ends. */
  Engine.prototype.leave = function (seg, elapsed, natural) {
    if (!seg) { return; }
    if (seg.record) { this.results[seg.record] = Math.floor(elapsed); this.emit('results'); }
    if (natural && seg.test && seg.kind === 'work') { this.results.hard = seg.test.n; this.emit('results'); }
  };

  Engine.prototype.tick = function () {
    if (!this.running || !this.seq) { return; }
    var guard = 0;
    while (this.running && guard < 400) {
      guard += 1;
      var seg = this.segment();
      if (!seg) { this.finish(); return; }
      var e = this.elapsed();
      if (!this.isTimed(seg)) { break; }
      var remaining = seg.dur - e;
      var late = -remaining > 1.5;

      if (seg.kind === 'rest' || seg.kind === 'prep') {
        for (var n = 3; n >= 1; n--) {
          if (remaining <= n && remaining > n - 1 && !this.flags['t' + n] && seg.dur > n + 1) {
            this.flags['t' + n] = true;
            Sound.tick();
          }
        }
      }
      if (seg.warn && seg.dur > 20 && remaining <= 10 && remaining > 0 && !this.flags.warn) {
        this.flags.warn = true;
        Sound.clap(2);
        this.emit('warn');
      }
      if (seg.cues && seg.cues.length) {
        var ci = this.cueIndex(seg, e);
        if (ci !== this.flags.cue) {
          var first = typeof this.flags.cue === 'undefined';
          this.flags.cue = ci;
          var cue = seg.cues[ci];
          if (!first && cue && remaining > 0.5) {
            var onWarnBeat = seg.warn && Math.abs(cue.at - (seg.dur - 10)) < 0.6;
            if (!onWarnBeat) { Sound.cue(cue.hot); }
            Sound.say(cue.label);
          }
          this.emit('cue');
        }
      }
      if (remaining > 0) { break; }

      /* Block finished: carry the overshoot into the next one so time never drifts. */
      var overshoot = -remaining;
      this.leave(seg, seg.dur, true);
      if (!late) {
        if (seg.kind === 'work' && seg.bell) { Sound.bell(3); Sound.buzz([200, 100, 200]); }
        else if (seg.kind === 'work' || seg.kind === 'warm') { Sound.stop(); }
      }
      if (this.idx + 1 >= this.seq.segments.length) { this.finish(); return; }
      this.idx += 1;
      this.flags = { entered: true };
      this.held = 0;
      this.base = now() - overshoot * 1000;
      var nextSeg = this.segment();
      if (!late) {
        var justRang = seg.kind === 'work' && seg.bell;
        if (justRang && nextSeg.kind !== 'work') { Sound.say(this.speech(nextSeg)); }
        else { this.enterSound(nextSeg, true); }
      }
      this.emit('segment');
    }
    this.emit('tick');
  };

  Engine.prototype.lockScreen = function () {
    var self = this;
    try {
      if (!('wakeLock' in navigator) || this.wake) { return; }
      navigator.wakeLock.request('screen').then(function (lock) {
        self.wake = lock;
        lock.addEventListener('release', function () { self.wake = null; });
      }).catch(function () { self.wake = null; });
    } catch (e) { this.wake = null; }
  };

  Engine.prototype.releaseScreen = function () {
    try { if (this.wake) { this.wake.release(); } } catch (e) { /* already released */ }
    this.wake = null;
  };

  Camp.Engine = Engine;
})(window.Camp = window.Camp || {});

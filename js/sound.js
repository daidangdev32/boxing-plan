/*
 * Gym sounds made with the Web Audio API: the round bell, the 10-second
 * clapper, countdown ticks and drill-change beeps. No audio files needed.
 */
(function (Camp) {
  'use strict';

  var ctx = null;
  var master = null;
  var noiseBuffer = null;

  var Sound = {
    enabled: true,
    voice: false,

    /* Must be called from a tap or click so phones allow audio. */
    unlock: function () {
      try {
        if (navigator.audioSession) { navigator.audioSession.type = 'playback'; }
      } catch (e) { /* not supported */ }
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { return null; }
        try {
          ctx = new AC();
        } catch (e) {
          return null;
        }
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') { ctx.resume().catch(function () {}); }
      return ctx;
    },

    ready: function () {
      return !!(ctx && this.enabled && ctx.state !== 'closed');
    },

    /* A brass boxing bell: inharmonic partials with a long ring. */
    bell: function (times) {
      if (!this.ready()) { return; }
      times = times || 1;
      var partials = [
        { ratio: 1, gain: 0.55, decay: 2.2 },
        { ratio: 2.32, gain: 0.32, decay: 1.4 },
        { ratio: 2.76, gain: 0.3, decay: 1.2 },
        { ratio: 4.1, gain: 0.16, decay: 0.8 },
        { ratio: 5.4, gain: 0.1, decay: 0.6 }
      ];
      var base = 760;
      var now = ctx.currentTime + 0.02;
      for (var i = 0; i < times; i++) {
        var t0 = now + i * 0.3;
        var ring = times > 1 && i < times - 1 ? 0.45 : 1;
        partials.forEach(function (p) {
          var osc = ctx.createOscillator();
          var g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = base * p.ratio;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(p.gain, t0 + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay * ring + 0.05);
          osc.connect(g);
          g.connect(master);
          osc.start(t0);
          osc.stop(t0 + p.decay * ring + 0.1);
        });
      }
    },

    /* The wooden clapper coaches bang 10 seconds before the bell. */
    clap: function (times) {
      if (!this.ready()) { return; }
      times = times || 2;
      if (!noiseBuffer) {
        var len = Math.floor(ctx.sampleRate * 0.06);
        noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        var data = noiseBuffer.getChannelData(0);
        for (var j = 0; j < len; j++) { data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 3); }
      }
      var now = ctx.currentTime + 0.02;
      for (var i = 0; i < times; i++) {
        var t0 = now + i * 0.16;
        var src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        var bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1900;
        bp.Q.value = 2.2;
        var g = ctx.createGain();
        g.gain.setValueAtTime(1.6, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
        src.connect(bp);
        bp.connect(g);
        g.connect(master);
        src.start(t0);
        src.stop(t0 + 0.08);

        var knock = ctx.createOscillator();
        var kg = ctx.createGain();
        knock.type = 'triangle';
        knock.frequency.setValueAtTime(900, t0);
        knock.frequency.exponentialRampToValueAtTime(420, t0 + 0.05);
        kg.gain.setValueAtTime(0.35, t0);
        kg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
        knock.connect(kg);
        kg.connect(master);
        knock.start(t0);
        knock.stop(t0 + 0.07);
      }
    },

    beep: function (freq, dur, vol, delay) {
      if (!this.ready()) { return; }
      var t0 = ctx.currentTime + 0.02 + (delay || 0);
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq || 880;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime((vol || 0.12), t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.12));
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + (dur || 0.12) + 0.02);
    },

    tick: function () { this.beep(660, 0.09, 0.1); },
    go: function () { this.beep(1046, 0.35, 0.14); },
    stop: function () { this.beep(523, 0.35, 0.12); },
    cue: function (hot) {
      if (hot) {
        this.beep(1318, 0.08, 0.12);
        this.beep(1318, 0.08, 0.12, 0.12);
      } else {
        this.beep(784, 0.14, 0.1);
      }
    },

    say: function (text) {
      if (!this.voice || !this.enabled || !text) { return; }
      try {
        if (!('speechSynthesis' in window)) { return; }
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.rate = 1.02;
        u.lang = 'en-US';
        window.speechSynthesis.speak(u);
      } catch (e) { /* speech not available */ }
    },

    buzz: function (pattern) {
      if (!this.enabled) { return; }
      try { if (navigator.vibrate) { navigator.vibrate(pattern); } } catch (e) { /* no vibration */ }
    }
  };

  Camp.Sound = Sound;
})(window.Camp = window.Camp || {});

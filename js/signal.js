/*
 * Silent timer signals. The timer never plays audio, so music from another
 * app keeps playing. Each moment is shown as a screen flash instead, plus a
 * vibration on phones that support it (Android; iPhone browsers ignore it).
 */
(function (Camp) {
  'use strict';

  var listeners = [];

  function emit(kind) {
    listeners.forEach(function (fn) {
      try { fn(kind); } catch (e) { if (window.console) { console.error(e); } }
    });
  }

  function buzz(pattern) {
    try { if (navigator.vibrate) { navigator.vibrate(pattern); } } catch (e) { /* no vibration */ }
  }

  Camp.Signal = {
    on: function (fn) { listeners.push(fn); },
    /* A round begins: the bell moment. */
    roundStart: function () { emit('start'); buzz(300); },
    /* A round ends and rest begins. */
    roundEnd: function () { emit('end'); buzz([200, 100, 200]); },
    /* Any other timed block (warm-up, rope, interval, tap step) begins. */
    blockStart: function () { emit('go'); buzz(150); },
    /* A timed block that isn't a round finishes. */
    blockEnd: function () { emit('stop'); buzz(150); },
    /* 10 seconds left in a round. */
    warn: function () { emit('warn'); buzz([80, 80, 80, 80, 80]); },
    /* The last 3 seconds of a rest or the get-ready countdown. */
    count: function () { emit('count'); },
    /* The drill switches mid-round, for example into a sprint. */
    cue: function (hot) { emit(hot ? 'hot' : 'cue'); buzz(hot ? [60, 60, 60] : 60); },
    /* The whole session is finished. */
    done: function () { emit('done'); buzz([300, 120, 300]); }
  };
})(window.Camp = window.Camp || {});

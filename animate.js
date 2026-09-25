/* animate.js — easing curves and one-shot tweens (v1.18, refactor step 7).
   EASE.soft / pop / lift / snap; tween({ delay, duration, ease, update(k), done() }); update(now)
   once per frame. `tweens` is the live list (a ceremony may clear it — see updateTweens' note on
   why it iterates a snapshot). Used by the cut, the candles' pop-in, the smoke, the camera. */
(function () {
  var EASE = {
    soft: function (t) { return 1 - Math.pow(1 - t, 5); },
    pop:  function (t) { var c1 = 1.56, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    lift: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    snap: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  };
  var tweens = [];
  // The list is filtered IN PLACE: other code holds a reference to it, so it's never replaced.
  function keep(pred) { var w = 0; for (var i = 0; i < tweens.length; i++) if (pred(tweens[i])) tweens[w++] = tweens[i]; tweens.length = w; }
  function clear(tag) { if (!tag) tweens.length = 0; else keep(function (o) { return o.tag !== tag; }); }
  function tween(o) {
    // o: { delay, duration, ease, update(k), done() }
    o.start = performance.now() + (o.delay || 0);
    o.k = 0;
    tweens.push(o);
    return o;
  }
  function updateTweens(now) {
    // Iterate a snapshot. A done() callback is allowed to start new tweens, finish them
    // all, or clear the list — finishCeremony() does exactly that — and mutating the live
    // array mid-loop leaves the index pointing past the end of a replaced array.
    var list = tweens.slice();
    var finished = null;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (!o || now < o.start) continue;
      var t = Math.min(1, (now - o.start) / o.duration);
      o.k = (o.ease || EASE.soft)(t);
      o.update(o.k, t);
      if (t >= 1) (finished || (finished = [])).push(o);
    }
    if (!finished) return;
    keep(function (o) { return finished.indexOf(o) === -1; });
    for (var j = 0; j < finished.length; j++) {
      if (finished[j].done) finished[j].done();
    }
  }
  window.CakeAnimate = { EASE: EASE, tween: tween, update: updateTweens, tweens: tweens, clear: clear };
})();

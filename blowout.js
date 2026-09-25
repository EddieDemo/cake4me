/* blowout.js — blowing the candles out (v1.19, refactor step 7).
   create(deps) → { frontToBackOrder(), extinguish(flame, dirX, dirZ), wave(strength, dirX, dirZ), setLean(sideways, away), checkAllOut() }
   A breath (from the microphone, or the wind of a fast spin) is a WAVE that passes over the
   candles front to back; each flame it reaches leans, gutters and — if the breath is strong
   enough — goes out with a puff of smoke. When the last one is out, the reveal begins.
   deps: flames(), blow (state), camera, tween, EASE, puffSmoke, litCount(), reveal(). */
(function () {
  function create(deps) {
    function frontToBackOrder() {
      // Nearest to the deps.camera first. The deps.camera moves, not the cake, so sort by distance.
      var v = new THREE.Vector3();
      return deps.flames().map(function (f, i) {
          f.sprite.getWorldPosition(v);
          return [i, v.distanceToSquared(deps.camera.position), f.lit];
        })
        .filter(function (p) { return p[2] > 0.5; })
        .sort(function (a, b) { return a[1] - b[1]; }).map(function (p) { return p[0]; });
    }
    function extinguish(f, dirX, dirZ) {
      if (f.lit <= 0.5 || f.__out) return;
      f.__out = true;
      deps.tween({ duration: 80, ease: deps.EASE.snap,
        update: function (k) { f.lit = 1 - k; },
        done: function () { f.lit = 0; f.__out = false; f.leanX = f.leanZ = 0; deps.puffSmoke(f, dirX, dirZ); checkAllOut(); } });
    }
    function wave(strength, dirX, dirZ) {
      for (var j = 0; j < deps.flames().length; j++) {         // rescue any flame stranded mid-extinguish
        if (deps.flames()[j].__out && deps.flames()[j].lit > 0 && deps.flames()[j].lit < 1) { deps.flames()[j].lit = 0; deps.flames()[j].__out = false; }
      }
      var order = frontToBackOrder();
      if (!order.length) { checkAllOut(); return; }
      var size = Math.max(1, Math.ceil(deps.blow.total / 6 * (0.5 + strength)));
      for (var i = 0; i < Math.min(size, order.length); i++) extinguish(deps.flames()[order[i]], dirX, dirZ);
    }
    function setLean(sideways, away) {
      for (var i = 0; i < deps.flames().length; i++) { deps.flames()[i].leanX = sideways; deps.flames()[i].leanZ = away; }
    }
    function checkAllOut() {
      if (deps.blow.revealed) return;
      if (deps.litCount() === 0) {
        deps.blow.revealed = true;
        deps.blow.enabled = false;
        setTimeout(deps.reveal, 500);       // the beat. Don't shorten it.
      }
    }
    return { frontToBackOrder: frontToBackOrder, extinguish: extinguish, wave: wave, setLean: setLean, checkAllOut: checkAllOut };
  }
  window.CakeBlowout = { create: create };
})();

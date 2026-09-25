/* resources.js — who owns what on the GPU (v1.08→1.09, refactor step 4b).
   Textures, geometries and materials are either KEPT (made once, shared by every cake, never
   disposed) or OWNED by the cake that's built (disposed when it's rebuilt). Before, that was a
   `__shared` flag set in 49 places and checked in one; the policy now lives here:
     CakeResources.keep(x)        — x outlives any single cake (returns x, so it chains)
     CakeResources.keepAll(a, b)  — several at once
     CakeResources.own(x)         — the opposite (a kept thing handed to one cake)
     CakeResources.release(group) — dispose everything in the tree that isn't kept
     CakeResources.stats()        — how many objects are kept
   The flag itself is still `__shared`, so anything not yet migrated keeps working. */
(function () {
  var kept = 0;
  function keep(x) { if (x && !x.__shared) { x.__shared = true; kept++; } return x; }
  function keepAll() { for (var i = 0; i < arguments.length; i++) keep(arguments[i]); }
  function own(x) { if (x && x.__shared) { x.__shared = false; kept--; } return x; }
  function isKept(x) { return !!(x && x.__shared); }
  function release(g) {
    while (g.children.length) {
      var c = g.children[g.children.length - 1];
      g.remove(c);
      if (c.isGroup) { release(c); continue; }
      if (c.geometry && !c.geometry.__shared) c.geometry.dispose();
      if (c.material && !c.material.__shared) {
        (Array.isArray(c.material) ? c.material : [c.material]).forEach(function (m) {
          if (m.__shared) return;
          if (m.map && !m.map.__shared) m.map.dispose();
          m.dispose();
        });
      }
    }
  }
  window.CakeResources = { keep: keep, keepAll: keepAll, own: own, isKept: isKept, release: release, stats: function () { return { kept: kept }; } };
})();

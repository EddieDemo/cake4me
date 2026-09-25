/* cut.js — the cut cake's geometry and bookkeeping (v1.17, refactor step 7).
   create(deps) → { PLATE, slicesLeft(), topRemainingTier(), updateSeams(), makePlate(), wedgeOffsetFor(tier, i, x, z) }
   Works on the viewer's state object (deps.V: V.cut, V.slice, V.mode, V.group). How many slices
   are left, which tier is on top now, the seams where slices meet, the plate a lifted slice sits
   on, and where each wedge goes on it. The viewer's UI for cutting (cards, send, finished, the
   slice page) stays in app.js and calls these. deps: V, config(), tierTops(cfg), WEDGES_PER_TIER(). */
(function () {
  function create(deps) {
    var PLATE = { r: 1.3, h: 0.08, colour: 0xfafafa };
    function slicesLeft() { return deps.V.cut ? deps.V.cut.wedges.filter(function (w) { return w.visible && !w.userData.lifted; }).length : 0; }
    function topRemainingTier() {
      // You deps.V.cut the top tier first; a bottom wedge with a tier on top of it makes no sense.
      var best = -1;
      deps.V.cut.wedges.forEach(function (w) { if (w.visible && !w.userData.lifted) best = Math.max(best, w.userData.tier); });
      return best;
    }
    function updateSeams() {
      if (!deps.V.cut || !deps.V.cut.seams) return;
      while (deps.V.cut.seams.children.length) deps.V.cut.seams.remove(deps.V.cut.seams.children[0]);
      var ti = topRemainingTier(); if (ti < 0) return;
      var tier = deps.tierTops(deps.config())[ti], N = deps.WEDGES_PER_TIER();
      var topY = tier.y0 + tier.h + 0.003;
      for (var k = 0; k < N; k++) {
        var w = deps.V.cut.wedges[ti * N + k];
        if (!w.visible || w.userData.lifted) continue;
        // one line per remaining wedge, along its leading edge
        var th = k * Math.PI * 2 / N;
        var line = new THREE.Mesh(new THREE.BoxGeometry(tier.r + 0.06, 0.004, 0.012), deps.V.cut.seamMat);
        line.position.set(Math.sin(th) * (tier.r + 0.06) / 2, topY, Math.cos(th) * (tier.r + 0.06) / 2);
        // A box's length runs along local X; rotating by (th − π/2) about Y points X along (sin th, cos th).
        line.rotation.y = th - Math.PI / 2;
        deps.V.cut.seams.add(line);
      }
    }
    function makePlate() {
      var plate = new THREE.Mesh(new THREE.CylinderGeometry(PLATE.r, PLATE.r, PLATE.h, 48),
        new THREE.MeshStandardMaterial({ color: PLATE.colour, roughness: 0.4 }));
      plate.position.y = PLATE.h / 2;
      if (window.CakeLook) CakeLook.adopt(plate);
      return plate;
    }
    function wedgeOffsetFor(tier, i, x, z) {
      var thMid = (i + 0.5) * Math.PI * 2 / deps.WEDGES_PER_TIER();
      return new THREE.Vector3(x - Math.sin(thMid) * tier.r * 0.6, PLATE.h - tier.y0, z - Math.cos(thMid) * tier.r * 0.6);
    }
    return { PLATE: PLATE, slicesLeft: slicesLeft, topRemainingTier: topRemainingTier, updateSeams: updateSeams, makePlate: makePlate, wedgeOffsetFor: wedgeOffsetFor };
  }
  window.CakeCut = { create: create };
})();

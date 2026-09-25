/* tiers.js — how many tiers, how big, and where they sit (v1.11, refactor step 5).
   create(deps) → { tiersFor(cfg), tierTops(cfg) }
   tiersFor: each tier's radius and height in world units from the cake's shape steps, with the
   frosting's thickness added when it has any; tierTops: the same with each tier's base height
   and the radius of the tier above (what the sprinkles, wedges and candles use).
   deps: classicShape, stepToR, stepToH, frostingHasThickness(cfg), FROST_T(), FROST_TOP(), PLATE_TOP() */
(function () {
  function create(deps) {
    function tiersFor(cfg) {
      var sh = (cfg && cfg.sh && cfg.sh.length) ? cfg.sh : deps.classicShape(cfg ? cfg.t : 1);
      return sh.map(function (x, i) {
        var rs = deps.stepToR(x.r), hs = deps.stepToH(x.h), thick = deps.frostingHasThickness(cfg, i);
        return { r: rs + (thick ? deps.FROST_T() : 0), h: hs + (thick ? deps.FROST_TOP() : 0), rs: rs, hs: hs };
      });
    }
    function tierTops(cfg) {
      var tiers = tiersFor(cfg), y = deps.PLATE_TOP(), out = [];
      tiers.forEach(function (t, i) { out.push({ r: t.r, h: t.h, rs: t.rs, hs: t.hs, y0: y, idx: i, aboveR: tiers[i + 1] ? tiers[i + 1].r : undefined }); y += t.h; });
      return out;
    }
    return { tiersFor: tiersFor, tierTops: tierTops };
  }
  window.CakeTiers = { create: create };
})();

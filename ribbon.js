/* ribbon.js — the ribbon round a tier (v1.11, refactor step 5).
   create(deps) → { RIBBON, ribbonWidth(step), ribbonY(TM, tier, width, p), ribbonRadius(TM, rr, bodyH, pOpts, y, w),
                    ribbonHandFor(cfg, tier, TM, w, rt), makeRibbonMaterial(cfg, rt) }
   Its widths and lift (RIBBON), where it sits on the tier's wall (ribbonY), how it was tied by
   hand from the cake's seed (ribbonHandFor: a few mm of tilt, kept clear of the tier's edges),
   and its cloth (satin or grosgrain, from frosting.js). deps: PALETTES, clampIndex, baseFillet(). */
(function () {
  function create(deps) {
    var RIBBON = { thick: 0.02, lift: 0.16, widthMin: 0.12, widthStep: 0.05, steps: 8 };
    function ribbonWidth(step) { return RIBBON.widthMin + RIBBON.widthStep * Math.max(0, Math.min(RIBBON.steps - 1, step | 0)); }
    // Per-tier ribbon settings, three characters per tier: on (0/1), colour index, width step.
    // "rt" is the live array of {on, c, w}; "rbt" is its string form in the link.
    // Ribbon POSITION per tier (v0.77): 0–9, where 0 puts the ribbon's bottom at the bottom of the
    // tier's straight wall and 9 its top at the top of it. −1 = the fixed lift older links used.
    function ribbonY(TM, tier, width, p) {
      if (p === undefined || p < 0) return RIBBON.lift;
      var bottom, top;
      if (TM.fdOn) {
        var capRim = Math.min(CakeShapes.P.capRim, TM.capH * 0.9);
        bottom = deps.baseFillet(); top = TM.hh - capRim;
      } else {
        bottom = CakeShapes.P.disc.spongeFillet; top = tier.hs - CakeShapes.P.disc.spongeFillet;
      }
      return bottom + (Math.max(0, Math.min(9, p)) / 9) * Math.max(0, top - bottom - width);
    }
    // How far the band may tilt before it would ride off the wall: the angle slider asks, the
    // wall decides. A ribbon flush with the top or bottom of a tier simply tilts less.
    function ribbonHandFor(cfg, tier, TM, w, rt) {
      if (!window.CakeFrosting) return null;
      var H = CakeFrosting.ribbonHand(tier.idx || 0);
      H.amp = 0; H.lift = 0;                                // no gathering: it read as bunched-up fabric
      var y = ribbonY(TM, tier, w, rt.p), bottom, top;
      if (TM.fdOn) { bottom = deps.baseFillet(); top = TM.hh - Math.min(CakeShapes.P.capRim, TM.capH * 0.9); }
      else { bottom = CakeShapes.P.disc.spongeFillet; top = tier.hs - CakeShapes.P.disc.spongeFillet; }
      var room = Math.max(0, Math.min(y - bottom, top - (y + w))) * 0.9;
      var asked = (rt.a || 0) * 0.014;                      // ±4 steps ≈ ±5.6mm at the rim
      H.tilt = Math.sign(asked) * Math.min(Math.abs(asked), room);
      return H;
    }
    // (the gift box already has a `ribbonMat` variable in this scope — hence the longer name)
    // The fondant wall swells slightly at mid-height, so a ribbon at a fixed radius would sink
    // into it. Sit it on the wall's actual radius at its own height (the widest point it covers).
    function ribbonRadius(TM, rr, bodyH, pOpts, y, w) {
      if (!TM.fdOn) return rr;
      var prof = CakeShapes.bodyProfile(rr, bodyH, null, pOpts);
      return Math.max(CakeShapes.radiusAt(prof, y), CakeShapes.radiusAt(prof, y + w), CakeShapes.radiusAt(prof, y + w * 0.5));
    }
    function makeRibbonMaterial(cfg, rt) {
      var ti = cfg.rt ? cfg.rt.indexOf(rt) : -1, own = (ti >= 0 && cfg.cxs) ? cfg.cxs['r' + ti] : null;   // v1.31: an exact colour of its own
      var hex = own != null ? own : deps.PALETTES.ribbon[deps.clampIndex(rt.c, deps.PALETTES.ribbon)].hex;
      return window.CakeFrosting ? CakeFrosting.ribbonMaterial(hex, cfg.rm)
                                 : new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, side: THREE.DoubleSide });
    }
    return { RIBBON: RIBBON, ribbonY: ribbonY, ribbonHandFor: ribbonHandFor, makeRibbonMaterial: makeRibbonMaterial, ribbonWidth: ribbonWidth, ribbonRadius: ribbonRadius };
  }
  window.CakeRibbon = { create: create };
})();

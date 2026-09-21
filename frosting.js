/* =====================================================================
   frosting.js — frosting STYLES: how the shell is painted or shaped.

   Smooth is the plain shell (app.js). The styles that need more than a
   colour live here, one function each, so app.js stays the product and
   this file grows as styles do: semi-naked now; drip and rustic next.

   Styles are numbered in the link's `fr` field:
     0 none (naked) · 1 smooth · 2 drip (reserved) · 3 rustic (reserved) · 4 semi-naked

   API (window.CakeFrosting):
     semiNakedTexture(opts)  a CanvasTexture for a tier's side: a thin scrape of
                             frosting over the sponge, the layers showing through.
       opts.frostingRgb  [r,g,b] 0–255
       opts.paintBase    function(ctx, W, H) — paints the sponge + fillings under it
       opts.seed         number — varies the streaks per tier
       opts.size         [W, H] (default 768×384: smeared, so it needn't be sharp)
   ===================================================================== */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { console.warn('frosting.js: THREE not loaded'); return; }

  // Small value noise, smooth in both axes.
  function hash1(n) { var x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
  function noise2(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash1(xi + yi * 57), b = hash1(xi + 1 + yi * 57), c = hash1(xi + (yi + 1) * 57), d = hash1(xi + 1 + (yi + 1) * 57);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  var SEMI = {
    coverage: 0.28,     // lower = more frosting; the noise threshold
    contrast: 2.2,      // how hard the streak edges are
    edgeBand: 0.12,     // fraction of the height near top and bottom that's fuller
    edgeFill: 0.35,     // how much extra frosting in those bands
    smearY: 140,        // vertical stretch of the streaks (px at 512 tall)
    grainX: 22          // horizontal scale of the streaks
  };

  // Paints the base (sponge + fillings) then composites a streaky scrape of frosting over
  // it, per pixel. Done in image data rather than blend modes so the alpha field is ours.
  function semiNakedTexture(opts) {
    var W = (opts.size && opts.size[0]) || 768, H = (opts.size && opts.size[1]) || 384;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    opts.paintBase(g, W, H);
    var img = g.getImageData(0, 0, W, H), d = img.data;
    var R = opts.frostingRgb[0], G = opts.frostingRgb[1], B = opts.frostingRgb[2];
    var seed = (opts.seed || 0) * 31.7, sy = H / 512, S = SEMI;
    for (var y = 0; y < H; y++) {
      var edge = Math.min(1, Math.min(y, H - y) / (H * S.edgeBand));   // 0 at the rims → 1 inside
      var extra = (1 - edge) * S.edgeFill;
      for (var x = 0; x < W; x++) {
        var n = noise2(x / S.grainX + seed, y / (S.smearY * sy)) * 0.7 + noise2(x / 6 + 100 + seed, y / (40 * sy)) * 0.3;
        var a = Math.max(0, Math.min(1, (n - S.coverage) * S.contrast)) * (0.55 + 0.45 * (1 - edge)) + extra;
        if (a > 1) a = 1;
        var i = (y * W + x) * 4;
        d[i] = d[i] + (R - d[i]) * a; d[i + 1] = d[i + 1] + (G - d[i + 1]) * a; d[i + 2] = d[i + 2] + (B - d[i + 2]) * a;
      }
    }
    g.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping;
    return t;
  }

  window.CakeFrosting = { semiNakedTexture: semiNakedTexture, SEMI: SEMI, noise2: noise2 };
})();

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

  // =================================================================
  // FONDANT FINISHES (v0.75): procedural normal + roughness maps.
  // No image files. A normal map tells the lighting the surface has relief without adding
  // geometry; a roughness map lets ridges catch a little shine. They describe SHAPE only, so
  // one set serves every tier and every colour — the material colour still does the tinting.
  //
  //   0 grain  — a faint sugar grain (the default)
  //   1 swept  — long palette sweeps on the side, turntable spatula rings on top
  //   2 rustic — broad palette-knife strokes, and a hand-worked rim (vertex displacement)
  //   3 raking — rustic, shown under a low raking key light (app.js sets the light)
  //
  // Mapping: every side texture spans the WHOLE circumference once (u = angle / 2π) and the
  // body height (v), so it needs no repeat — r128 shares one UV transform between a material's
  // maps, and the message band's transform would otherwise override the normal map's repeat.
  // Tops are projected straight down (planar), so nothing pinches at the centre. Both are
  // derived from vertex positions, so a wedge's texture lines up exactly with the whole cake.
  // Normal and roughness maps are DATA: they stay linear, never sRGB.
  // =================================================================
  // ---- The cake's texture seed (v0.83) ----
  // Every pattern here is built from this one hash, so shifting it rearranges all of them at
  // once — a different comb, a different set of knife strokes, rings that wander differently —
  // while the recipe (spacing, depth, profile, wander) stays put, so a Rings is still a Rings.
  // The seed travels in the link, so the recipient's cake, their slices and the sender's all
  // match. Set it with setSeed() before anything is generated.
  var SEED = 0;
  function setSeed(n) { n = (n | 0) % 1000; SEED = (n < 0 ? n + 1000 : n) * 0.6180339887; return SEED; }
  function seedOf() { return SEED; }
  function phash(x, y, s) { var n = Math.sin(x * 127.1 + y * 311.7 + (s + SEED) * 74.7) * 43758.5453; return n - Math.floor(n); }
  // Periodic value noise: tiles with period (px, py) lattice cells.
  function pnoise(x, y, px, py, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    function h(a, b) { return phash(((a % px) + px) % px, ((b % py) + py) % py, s); }
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  }
  // Fractal noise over (u, v) in 0..1 with an integer number of cycles, so it tiles seamlessly.
  function fu(u, v, cx, cy, oct, s) {
    var a = 0, amp = 0.5, f = 1, t = 0;
    for (var o = 0; o < oct; o++) { a += amp * pnoise(u * cx * f, v * cy * f, cx * f, cy * f, s + o); t += amp; amp *= 0.5; f *= 2; }
    return a / t;
  }
  // A canvas texture is flipped when it's uploaded, so paint with v measured from the BOTTOM.
  // Without this every pattern was read upside down — and because the normals are derived in
  // canvas order, dips rendered as ridges (v0.81).
  function field(W, H, fn) { var a = new Float32Array(W * H); for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) a[y * W + x] = fn(x / W, 1 - y / H, x, y); return a; }
  // Separable box blur with wrap, in place (canvas `filter` isn't reliable on iOS Safari).
  function blur(a, W, H, r, passes) {
    var tmp = new Float32Array(W * H);
    for (var p = 0; p < passes; p++) {
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var s0 = 0; for (var k = -r; k <= r; k++) s0 += a[y * W + ((x + k + W) % W)]; tmp[y * W + x] = s0 / (2 * r + 1); }
      for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) { var s1 = 0; for (var k2 = -r; k2 <= r; k2++) s1 += tmp[((y2 + k2 + H) % H) * W + x2]; a[y2 * W + x2] = s1 / (2 * r + 1); }
    }
    return a;
  }
  // Knife strokes, stamped into a height field: each a soft curved swipe, raised along one
  // edge (the lip the knife leaves) and dipped along the other. Wraps horizontally.
  function strokes(W, H, count, lenR, widR, seed) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
    var rnd = function (k) { return phash(k, seed, 3.1); };
    for (var i = 0; i < count; i++) {
      var x = rnd(i * 5 + 1) * W, y = rnd(i * 5 + 2) * H, len = lenR[0] + rnd(i * 5 + 3) * (lenR[1] - lenR[0]);
      var ang = (rnd(i * 5 + 4) - 0.5) * 1.2, bend = (rnd(i * 5 + 5) - 0.5) * len * 0.5, wdt = widR[0] + rnd(i * 7 + 1) * (widR[1] - widR[0]);
      for (var ox = -W; ox <= W; ox += W) {
        g.save(); g.translate(x + ox, y); g.rotate(ang);
        var gr = g.createLinearGradient(0, -wdt, 0, wdt);
        gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.55, 'rgba(160,160,160,0.15)');
        gr.addColorStop(0.85, 'rgba(60,60,60,0.35)'); gr.addColorStop(1, 'rgba(128,128,128,0)');
        g.strokeStyle = gr; g.lineWidth = wdt; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-len / 2, 0); g.quadraticCurveTo(0, bend, len / 2, 0); g.stroke(); g.restore();
      }
    }
    var d = g.getImageData(0, 0, W, H).data, a = new Float32Array(W * H);
    for (var j = 0; j < W * H; j++) a[j] = d[j * 4] / 255;
    return a;
  }
  function toNormal(h, W, H, strength) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var xl = (x - 1 + W) % W, xr = (x + 1) % W, yu = (y - 1 + H) % H, yd = (y + 1) % H;
      var dx = (h[y * W + xr] - h[y * W + xl]) * strength, dy = (h[yd * W + x] - h[yu * W + x]) * strength;
      var nx = -dx, ny = dy, l = Math.sqrt(nx * nx + ny * ny + 1), i = (y * W + x) * 4;   // canvas y runs down; texture v runs up
      d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.__shared = true;
    return t;                                            // LINEAR encoding: data, not colour
  }
  function toRough(h, W, H, base, span) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    for (var i = 0; i < W * H; i++) { var r = Math.max(0.05, Math.min(1, base - span * (h[i] - 0.5) * 2)) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = r; d[i * 4 + 3] = 255; }   // ridges shinier
    g.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.__shared = true;
    return t;
  }
  // Side textures span the full circumference (≈ 4 mock tiles), tops the full diameter.
  var SW = 1024, SH = 192, TW = 512;
  // ---- Finishes in WORLD units (v0.81) ----
  // Side textures wrap the circumference once and cover a band of height SPAN; top textures
  // cover the diameter. Writing the patterns in centimetres — not in texture cycles — is what
  // keeps the sides and the top at the same scale, and each map's normal strength is scaled by
  // its pixels-per-unit so their relief matches too.
  var REF_R = 2.2, CIRC = 2 * Math.PI * REF_R, SPAN = CIRC * SH / SW;
  var PX_SIDE = SW / CIRC, PX_TOP = TW / (2 * REF_R);
  function sideField(fn) { return field(SW, SH, function (u, v) { return fn(u * CIRC, v * SPAN, u); }); }
  function topField(fn) { return field(TW, TW, function (u, v) { return fn((u - 0.5) * 2 * REF_R, (v - 0.5) * 2 * REF_R); }); }
  function strokesAt(W, H, count, lenR, widR, seed, ref) {
    var k = W / ref;
    return blur(strokes(W, H, count, [lenR[0] * k, lenR[1] * k], [widR[0] * k, widR[1] * k], seed), W, H, Math.max(1, Math.round(2 * k)), 2);
  }
  // A groove: a hollow running the full width of its band, meeting its neighbour at a cusp —
  // a broad floor with a peak that comes almost to a point.
  function scoopProfile(f) { return 1 - Math.pow(Math.sin(Math.PI * f), 0.42); }
  // Combed: fine vertical grooves pulled with a comb. The spacing wanders, each groove has its
  // own depth, and each line drifts sideways on its own as it rises (not in unison).
  // How varied a comb's hand is: each groove leans its own way, wanders, and has its own width.
  var COMB = { sp: 0.26, lean: 0.10, sway: 1.6, wid: [0.62, 1] };
  function grooveAt(f, wid) {                            // a narrower groove leaves flat icing either side
    var lo = (1 - wid) / 2;
    if (f < lo || f > 1 - lo) return 1;
    return scoopProfile((f - lo) / wid);
  }
  function combSide(x, y, u) {
    var sp = COMB.sp;
    var warp = 2.2 * (fu(u, 0.5, 4, 1, 2, 12) - 0.5) + 1.1 * (fu(u, 0.5, 11, 1, 2, 14) - 0.5) + 0.5 * (fu(u, 0.5, 27, 1, 2, 16) - 0.5);
    var drift = 0.55 * (fu(u, y / 12, 40, 1, 2, 11) - 0.5) * (0.25 + 0.75 * Math.min(1, y / 1.6));
    var t0 = x / sp + warp + drift, i0 = Math.floor(t0), n = Math.max(4, Math.round(CIRC / sp)), id0 = ((i0 % n) + n) % n;
    var p1 = phash(id0, 11, 2) * 6.28, p2 = phash(id0, 13, 3) * 6.28;
    var sway = 0.095 * Math.sin(y * 1.25 + p1) + 0.038 * Math.sin(y * 3.1 + p2);
    var lean = (phash(id0, 31, 7) - 0.5) * 2 * COMB.lean;
    var t = t0 + sway * COMB.sway + lean * y / sp, i = Math.floor(t), f = t - i, id = ((i % n) + n) % n;
    var dep = 0.6 + 0.55 * phash(id, 5, 6), fade = 0.78 + 0.22 * fu(u * 2 + id * 0.21, y / 5, 1000, 1, 1, 13);
    var wid = COMB.wid[0] + (COMB.wid[1] - COMB.wid[0]) * phash(id, 41, 9);
    return 0.92 - 0.5 * (1 - grooveAt(f, wid)) * dep * fade + 0.03 * fu(u, y / SPAN, 300, 50, 1, 7);
  }
  // Ridged: a spatula held against the turning cake. Bands of uneven height, each drifting up
  // and down a little of its own accord as it goes round.
  function ridgeSide(x, y, u) {
    var wave = 0.11 * (fu(u, y / 40, 4, 1, 2, 21) - 0.5) + 0.05 * (fu(u, y / 40, 15, 1, 2, 22) - 0.5) + 0.02 * (fu(u, y / 40, 37, 1, 2, 24) - 0.5);
    var yy0 = y + wave, t0 = yy0 / 0.3 + 0.95 * Math.sin(yy0 * 1.5) + 0.45 * Math.sin(yy0 * 3.9 + 1.1) + 0.2 * Math.sin(yy0 * 9.7), i0 = Math.floor(t0);
    var th = u * Math.PI * 2, q1 = phash(i0 + 70, 17, 4) * 6.28, q2 = phash(i0 + 71, 19, 5) * 6.28;
    var band = 0.105 * Math.sin(th + q1) + 0.052 * Math.sin(th * 2 + q2) + 0.026 * Math.sin(th * 3 + q1 * 0.5);
    var t = t0 + band, i = Math.floor(t), f = t - i;
    var dep = 0.6 + 0.55 * phash(i + 50, 7, 8), body = 0.03 * (fu(u, (y + i * 0.7) / 6, 60, 1, 2, 26) - 0.5);
    return 0.92 - 0.5 * (1 - scoopProfile(f)) * dep + body;
  }
  function smoothTop(crownDip) {
    return function (x, z) {
      var r = Math.hypot(x, z) / REF_R, crown = crownDip * Math.max(0, (r - 0.9) / 0.1);
      return 0.5 + crown + 0.04 * fu(x / (2 * REF_R) + 0.5, z / (2 * REF_R) + 0.5, 40, 40, 2, 9);
    };
  }
  // Swept and Spiral share their sides: long sweeps at the same groove spacing as the top.
  var GROOVE = 0.3, SWEEP_CYCLES = Math.max(1, Math.round(SPAN / GROOVE)), SWEEP_G = SPAN / SWEEP_CYCLES;
  function sweepSide(x, y, u) { var ph = fu(u, 0, 16, 1, 2, 6) * 2.2; return 0.5 + 0.3 * Math.sin(2 * Math.PI * y / SWEEP_G + ph); }
  function grainAt(u, v, a, b) { return fu(u, v, a, b, 2, 1) * 0.6 + fu(u, v, Math.round(a / 4.7), Math.round(b / 4.7), 2, 2) * 0.4; }
  // The sugarpaste grain: the old Grain recipe at four times the fidelity, at a third of the
  // depth (doubling the fidelity at the same depth reads harsher, not finer). It is both the
  // plain "Grain" finish and the underlay beneath every other one.
  var GRAIN_MULT = 4, GRAIN_AMP = 0.3;
  function grainField(W, H, a, b) { return field(W, H, function (u, v) { return fu(u, v, a * GRAIN_MULT, b * GRAIN_MULT, 2, 1) * 0.6 + fu(u, v, Math.round(a / 4.7) * GRAIN_MULT, Math.round(b / 4.7) * GRAIN_MULT, 2, 2) * 0.4; }); }
  var grainCache = {};
  function grainMaps() {
    var key = 'g@' + SEED.toFixed(4);
    if (!grainCache[key]) {
      Object.keys(grainCache).forEach(function (k) { [grainCache[k].sideN, grainCache[k].topN].forEach(function (t) { if (t && t.dispose) t.dispose(); }); delete grainCache[k]; });
      grainCache[key] = { sideN: toNormal(grainField(SW, SH, 340, 64), SW, SH, 2.2 * GRAIN_AMP), topN: toNormal(grainField(TW, TW, 170, 170), TW, TW, 2.2 * GRAIN_AMP) };
    }
    return grainCache[key];
  }
  // Rustic, carved rather than painted (v0.86): each stroke takes a hollow OUT of the icing, so
  // where two overlap the crest between them is a real intersection — the same cusped peaks as
  // Rings, Whirl, Combed and Ridged, as though one tool made them all.
  // Each stroke is a hollow taken OUT; `depth` varies per stroke so the crests between them read.
  function carve(W, H, count, lenR, widR, depth, seed) {
    var h = new Float32Array(W * H); for (var i = 0; i < W * H; i++) h[i] = 1;
    var rs = function (k) { return phash(k, seed, 1.7); };
    for (var n = 0; n < count; n++) {
      var cx = rs(n * 9 + 1) * W, cy = rs(n * 9 + 2) * H;
      var A = (lenR[0] + (lenR[1] - lenR[0]) * rs(n * 9 + 3)) * W, B = (widR[0] + (widR[1] - widR[0]) * rs(n * 9 + 4)) * W;
      var th = rs(n * 9 + 5) * Math.PI * 2, cur = (rs(n * 9 + 6) - 0.5) * 2.4, dep = depth * (0.45 + 0.55 * rs(n * 9 + 7));
      var ct = Math.cos(th), st = Math.sin(th), rad = Math.ceil(Math.max(A, B) * 1.25);
      for (var ox = -W; ox <= W; ox += W) {
        var y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(H - 1, Math.ceil(cy + rad));
        for (var y = y0; y <= y1; y++) for (var xx = Math.floor(cx + ox - rad); xx <= Math.ceil(cx + ox + rad); xx++) {
          var px = ((xx % W) + W) % W, dx = xx - (cx + ox), dy = y - cy;
          var u = (dx * ct + dy * st) / A, v = (-dx * st + dy * ct) / B - cur * Math.pow((dx * ct + dy * st) / A, 2);
          var t = Math.sqrt(u * u + v * v); if (t > 1) continue;
          var k = y * W + px, d = dep * Math.pow(1 - Math.pow(t, 4), 0.5);
          if (1 - d < h[k]) h[k] = 1 - d;
        }
      }
    }
    return blur(h, W, H, 1, 1);
  }
  var FINISHES = [];
  // Smooth icing: nothing but the fine grain (the underlay carries it) — the one finish that
  // really is rolled fondant; the tooled ones read as buttercream.
  FINISHES[0] = { name: 'Smooth', normalScale: 0.0001, rough: [0.6, 0.06], displace: 0, k: 0.001,
    side: function () { return field(SW, SH, function () { return 0.5; }); },
    top:  function () { return field(TW, TW, function () { return 0.5; }); } };
  FINISHES[1] = { name: 'Swept', normalScale: 0.6, rough: [0.55, 0.2], displace: 0, k: 5, world: true,
    side: function () { return sideField(sweepSide); },
    top:  function () { return topField(function (x, z) { var r = Math.hypot(x, z), a = Math.atan2(x, z); return 0.5 + 0.3 * Math.sin(2 * Math.PI * r / GROOVE + fu(a / (Math.PI * 2) + 0.5, r, 6, 1, 2, 8) * 2.2); }); } };
  FINISHES[2] = { name: 'Rustic', normalScale: 1.0, rough: [0.62, 0.3], displace: 0.05, k: 4.5, world: true,
    side: function () { return carve(SW, SH, 260, [0.07, 0.13], [0.026, 0.045], 0.62, 11); },
    top:  function () { return carve(TW, TW, 95, [0.14, 0.26], [0.052, 0.09], 0.62, 23); } };
  FINISHES[3] = FINISHES[2];                             // retired "Low sun" → Rustic (its lighting is in the link)
  // The comb carried over the rim and in to the centre: a spatula of FIXED width pulled from the
  // rim inward, once per groove, as the decorator works round the cake. The tool doesn't narrow
  // as it converges — the strokes simply overlap more, and near the centre each cuts over its
  // neighbour. Carved (the lower height wins) and rasterised along each stroke rather than
  // tested per pixel, which would be far too slow.
  function spatulaTop(W) {
    var h = new Float32Array(W * W);
    for (var i = 0; i < W * W; i++) h[i] = 0.92 + 0.03 * (fu(i % W / W, 1 - Math.floor(i / W) / W, 40, 40, 2, 33) - 0.5);
    var n = Math.max(6, Math.round(CIRC / COMB.sp)), HW = COMB.sp * 0.5, steps = W, M = 18;
    for (var k = 0; k < n; k++) {
      var lean = (phash(k, 31, 7) - 0.5) * 2 * COMB.lean * 0.8;
      var p1 = phash(k, 11, 2) * 6.28, p2 = phash(k, 13, 3) * 6.28;
      var hw = HW * (COMB.wid[0] + (COMB.wid[1] - COMB.wid[0]) * phash(k, 41, 9));
      var dep = 0.5 * (0.6 + 0.55 * phash(k, 5, 6));
      for (var st = 0; st < steps; st++) {
        var r = REF_R * (1 - st / (steps - 1));
        var wob = COMB.sway * (0.05 * Math.sin(r * 1.5 + p1) + 0.02 * Math.sin(r * 3.4 + p2));
        var th = (k / n) * Math.PI * 2 + lean * (REF_R - r) / REF_R + wob;
        var cx = Math.sin(th) * r, cz = Math.cos(th) * r, px = Math.cos(th), pz = -Math.sin(th);
        for (var j = -M; j <= M; j++) {
          var d = (j / M) * hw, wx = cx + px * d, wz = cz + pz * d;
          var u = wx / (2 * REF_R) + 0.5, v = wz / (2 * REF_R) + 0.5;
          if (u < 0 || u > 1 || v < 0 || v > 1) continue;
          var xi = Math.min(W - 1, Math.max(0, Math.round(u * W))), yi = Math.min(W - 1, Math.max(0, Math.round((1 - v) * W)));
          var t = Math.abs(j) / M, carved = 1 - dep * Math.pow(1 - t * t, 0.6), idx = yi * W + xi;
          if (carved < h[idx]) h[idx] = carved;          // the later stroke wins where they overlap
        }
      }
    }
    return h;
  }
  FINISHES[4] = { name: 'Combed', normalScale: 1.0, rough: [0.55, 0.2], displace: 0, k: 4, world: true, soften: true,
    side: function () { return sideField(combSide); }, top: function () { return spatulaTop(TW); } };
  FINISHES[5] = { name: 'Spiral', normalScale: 0.6, rough: [0.55, 0.2], displace: 0, k: 5, world: true,
    side: function () { return sideField(sweepSide); },
    top:  function () { return topField(function (x, z) { var r = Math.hypot(x, z), a = Math.atan2(x, z); return 0.5 + 0.3 * Math.sin(2 * Math.PI * r / GROOVE - a + fu(a / (Math.PI * 2) + 0.5, r, 6, 1, 2, 8) * 0.8); }); } };
  FINISHES[6] = { name: 'Deep rustic', normalScale: 1.35, rough: [0.62, 0.38], displace: 0.085, k: 6, world: true,
    side: function () { return carve(SW, SH, 190, [0.09, 0.17], [0.036, 0.065], 0.95, 71); },
    top:  function () { return carve(TW, TW, 70, [0.18, 0.34], [0.072, 0.13], 0.95, 73); } };
  // Rings and Whirl (v0.82): the spatula treatment all the way through — Ridged's sides, and a
  // top of rings (or one continuous pass) with the same cusped grooves, uneven depths and wander.
  function ringTop(x, z) {
    var r = Math.hypot(x, z), a = Math.atan2(x, z), u = a / (Math.PI * 2) + 0.5;
    var t0 = r / GROOVE, i0 = Math.floor(t0), q1 = phash(i0 + 20, 3, 9) * 6.28, q2 = phash(i0 + 21, 5, 11) * 6.28;
    var wob = 0.16 * Math.sin(a + q1) + 0.075 * Math.sin(a * 2 + q2) + 0.035 * Math.sin(a * 3 + q1 * 0.5);
    var t = t0 + wob + 0.25 * (fu(u, r / 4, 7, 1, 2, 31) - 0.5), i = Math.floor(t), f = t - i;
    var dep = 0.6 + 0.55 * phash(i + 20, 7, 8);
    return 0.92 - 0.5 * (1 - scoopProfile(f)) * dep + 0.03 * (fu(u, r / 3, 40, 1, 2, 33) - 0.5);
  }
  function whirlTop(x, z) {
    var r = Math.hypot(x, z), a = Math.atan2(x, z), u = a / (Math.PI * 2) + 0.5;
    var t0 = r / GROOVE - a / (Math.PI * 2), i0 = Math.floor(t0), q1 = phash(i0 + 40, 3, 9) * 6.28, q2 = phash(i0 + 41, 5, 11) * 6.28;
    var wob = 0.14 * Math.sin(a + q1) + 0.07 * Math.sin(a * 2 + q2);
    var t = t0 + wob + 0.22 * (fu(u, r / 4, 7, 1, 2, 35) - 0.5), i = Math.floor(t), f = t - i;
    var dep = 0.6 + 0.55 * phash(i + 40, 7, 8);
    return 0.92 - 0.5 * (1 - scoopProfile(f)) * dep + 0.03 * (fu(u, r / 3, 40, 1, 2, 37) - 0.5);
  }
  FINISHES[8] = { name: 'Rings', normalScale: 1.0, rough: [0.55, 0.2], displace: 0, k: 4, world: true, soften: true,
    side: function () { return sideField(ridgeSide); }, top: function () { return topField(ringTop); } };
  FINISHES[9] = { name: 'Whirl', normalScale: 1.0, rough: [0.55, 0.2], displace: 0, k: 4, world: true, soften: true,
    side: function () { return sideField(ridgeSide); }, top: function () { return topField(whirlTop); } };
  FINISHES[7] = { name: 'Ridged', normalScale: 1.0, rough: [0.55, 0.2], displace: 0, k: 4, world: true, soften: true,
    side: function () { return sideField(ridgeSide); }, top: function () { return topField(smoothTop(-0.12)); } };
  var FINISH_COUNT = 10;
  // Each cache now holds the last few (finish, seed) sets and lets older ones go: with seeds,
  // two cakes no longer share one set of textures.
  function trimCache(cache, keys, max) {
    while (keys.length > max) {
      var old = keys.shift(), set = cache[old];
      if (set) Object.keys(set).forEach(function (k) { if (set[k] && set[k].dispose) set[k].dispose(); });
      delete cache[old];
    }
  }
  var mapCache = {}, mapKeys = [];
  function fondantMaps(finish) {
    finish = Math.max(0, Math.min(FINISH_COUNT - 1, finish | 0));
    var F = FINISHES[finish], key = F.name + '@' + SEED.toFixed(4);
    if (!mapCache[key]) {
      var hs = F.side(), ht = F.top();
      if (F.soften) { blur(hs, SW, SH, 1, 1); blur(ht, TW, TW, 1, 1); }
      // World patterns are written in centimetres, so their normal strength scales with each
      // map's pixels-per-unit; the older patterns keep their own.
      var kS = F.world ? F.k * PX_SIDE / 100 : F.k, kT = F.world ? F.k * PX_TOP / 100 : F.k;
      mapCache[key] = {
        sideN: toNormal(hs, SW, SH, kS), sideR: toRough(hs, SW, SH, F.rough[0], F.rough[1]),
        topN: toNormal(ht, TW, TW, kT), topR: toRough(ht, TW, TW, F.rough[0], F.rough[1])
      };
      mapKeys.push(key); trimCache(mapCache, mapKeys, 3);
    }
    var m = mapCache[key], g = grainMaps();
    return { sideN: m.sideN, sideR: m.sideR, topN: m.topN, topR: m.topR, normalScale: F.normalScale, displace: F.displace,
             grainSideN: g.sideN, grainTopN: g.topN, grain: 0.5 };   // the sugarpaste grain, under every pattern
  }
  // A small lit preview of a finish's top, for the builder's tiles: the height field shaded by a
  // light from the upper left, in a neutral cream. Cheap — drawn at tile size, cached.
  var previewCache = {};
  function finishPreview(finish, N) {
    var key = finish + '@' + N;
    if (previewCache[key]) return previewCache[key];
    var F = FINISHES[finish], M = N * 2, sideOne = !!F.world, src = sideOne ? F.side() : F.top();
    var FW = sideOne ? SW : TW, FH = sideOne ? SH : TW, patch = sideOne ? Math.round(SH * 1.0) : FW;
    var h = new Float32Array(M * M);
    for (var yy = 0; yy < M; yy++) for (var xx = 0; xx < M; xx++) h[yy * M + xx] = src[(Math.round(yy * patch / M) % FH) * FW + (Math.round(xx * patch / M) % FW)];
    var st = (sideOne ? F.k * PX_SIDE / 100 : F.k) * (patch / M) * 1.4;
    var c = document.createElement('canvas'); c.width = c.height = M;
    var g = c.getContext('2d'), img = g.createImageData(M, M), d = img.data;
    var L = [-0.55, 0.55, 0.63];
    for (var y = 0; y < M; y++) for (var x = 0; x < M; x++) {
      var xr = (x + 1) % M, xl = (x - 1 + M) % M, yd = (y + 1) % M, yu = (y - 1 + M) % M;
      var nx = -(h[y * M + xr] - h[y * M + xl]) * st, ny = (h[yd * M + x] - h[yu * M + x]) * st, l = Math.sqrt(nx * nx + ny * ny + 1);
      var sh = Math.max(0, (nx * L[0] + ny * L[1] + L[2]) / l), k = 0.55 + 0.5 * sh, i = (y * M + x) * 4;
      d[i] = 244 * k; d[i + 1] = 226 * k; d[i + 2] = 214 * k; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return (previewCache[key] = c.toDataURL());
  }
  // Put a finish on a material by BIPLANAR mapping in the shader (v0.77): the normal and
  // roughness maps are sampled twice — wrapped around the side by angle and height, and
  // projected straight down onto the top — and blended by how steep the surface is. Sides get
  // pure wrap, the top pure projection, the shoulder a smooth mix, so the texture never
  // stretches and has no seam anywhere, a wedge included (it uses the cake's own object space).
  // No UVs are involved, so the material can still carry a UV-mapped colour map (the message
  // band). `R` is the tier's outer radius.
  var BP_VERT_DECL = 'varying vec3 vBpPos; varying vec3 vBpN; varying vec3 vBpSideT; varying vec3 vBpUp; varying vec3 vBpTopT; varying vec3 vBpTopB;\n';
  var BP_VERT =
    '\n vBpPos = position; vBpN = objectNormal;' +
    // atan(0, 0) is undefined — NaN on iPhone GPUs — and every triangle of the flat top shares
    // the vertex on the axis, so one NaN there blackened the whole top. Guard it.
    '\n float bpA = (abs(position.x) + abs(position.z) < 1e-5) ? 0.0 : atan(position.x, position.z);' +
    '\n vBpSideT = normalize(normalMatrix * vec3(cos(bpA), 0.0, -sin(bpA)));' +
    '\n vBpUp = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));' +
    '\n vBpTopT = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));' +
    '\n vBpTopB = normalize(normalMatrix * vec3(0.0, 0.0, -1.0));\n';
  var BP_FRAG_DECL = BP_VERT_DECL +
    'uniform sampler2D uBpSideN; uniform sampler2D uBpSideR; uniform sampler2D uBpTopN; uniform sampler2D uBpTopR;\n' +
    'uniform float uBpR; uniform float uBpSpan; uniform float uBpScale;\n' +
    'uniform sampler2D uBpSideA; uniform sampler2D uBpTopA; uniform float uBpAlb;\n' +
    'uniform sampler2D uBpSideG; uniform sampler2D uBpTopG; uniform float uBpGrain;\n';
  var BP_FRAG =
    '\n{' +
    '\n  float bpA = ((abs(vBpPos.x) + abs(vBpPos.z) < 1e-5) ? 0.0 : atan(vBpPos.x, vBpPos.z)) / 6.2831853 + 0.5;' +
    '\n  float bpA2 = fract(bpA + 0.5) - 0.5;' +                        // the same angle, seam moved to the back
    '\n  float bpU = (fwidth(bpA) > fwidth(bpA2) + 1e-5) ? bpA2 : bpA;' + // pick whichever has no jump here (no mip seam)
    '\n  vec2 uvS = vec2(bpU, vBpPos.y / uBpSpan);' +
    '\n  vec2 uvT = vec2(vBpPos.x / (2.0 * uBpR) + 0.5, 0.5 - vBpPos.z / (2.0 * uBpR));' +
    '\n  float bpW = smoothstep(0.72, 0.97, abs(normalize(vBpN).y));' +   // the side pattern carries over the shoulder
    '\n  vec3 nS = texture2D(uBpSideN, uvS).xyz * 2.0 - 1.0; nS.xy *= uBpScale;' +
    '\n  vec3 nT = texture2D(uBpTopN, uvT).xyz * 2.0 - 1.0; nT.xy *= uBpScale;' +
    '\n  vec3 pS = normalize(vBpSideT * nS.x + vBpUp * nS.y + normal * nS.z);' +
    '\n  vec3 pT = normalize(vBpTopT * nT.x + vBpTopB * nT.y + normal * nT.z);' +
    // Never let one projection's bad sample poison the other: mix(a, b, 1) is still NaN if a is.
    '\n  if (bpW > 0.999) normal = pT; else if (bpW < 0.001) normal = pS; else normal = normalize(mix(pS, pT, bpW));' +
    '\n  roughnessFactor *= mix(texture2D(uBpSideR, uvS).g, texture2D(uBpTopR, uvT).g, bpW);' +
    // Optional colour variation (the sponge crust's browning and pores). The lights read
    // diffuseColor after this block, so multiplying it here is in time.
    '\n  if (uBpAlb > 0.5) diffuseColor.rgb *= mix(texture2D(uBpSideA, uvS).rgb, texture2D(uBpTopA, uvT).rgb, bpW);' +
    // The sugarpaste grain, mixed in UNDER whatever pattern this finish has, so a patterned
    // fondant still reads as rolled icing rather than as clay.
    '\n  if (uBpGrain > 0.001) {' +
    '\n    vec3 gS = texture2D(uBpSideG, uvS).xyz * 2.0 - 1.0, gT = texture2D(uBpTopG, uvT).xyz * 2.0 - 1.0;' +
    '\n    vec3 gN = mix(gS, gT, bpW) * uBpGrain;' +
    '\n    vec3 t1 = normalize(vBpSideT - normal * dot(vBpSideT, normal));' +
    '\n    normal = normalize(normal + t1 * gN.x + normalize(cross(normal, t1)) * gN.y);' +
    '\n  }' +
    '\n}\n';
  var _flat = null;
  function flatTex() {
    if (!_flat) { var c = document.createElement('canvas'); c.width = c.height = 2; var g = c.getContext('2d'); g.fillStyle = '#8080ff'; g.fillRect(0, 0, 2, 2); _flat = new THREE.CanvasTexture(c); _flat.__shared = true; }
    return _flat;
  }
  var _white = null;
  function whiteTex() {
    if (!_white) { var c = document.createElement('canvas'); c.width = c.height = 2; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2); _white = new THREE.CanvasTexture(c); _white.__shared = true; }
    return _white;
  }
  function dressFondant(mat, maps, R) {
    R = R || 2;
    mat.normalMap = null; mat.roughnessMap = null;
    mat.roughness = 1;
    mat.extensions = mat.extensions || {}; mat.extensions.derivatives = true;
    var U = {
      uBpSideN: { value: maps.sideN }, uBpSideR: { value: maps.sideR },
      uBpTopN: { value: maps.topN }, uBpTopR: { value: maps.topR },
      uBpR: { value: R }, uBpSpan: { value: 2 * Math.PI * R * SH / SW }, uBpScale: { value: maps.normalScale },
      uBpSideA: { value: (maps.sideA && !maps.noAlbedo) ? maps.sideA : whiteTex() }, uBpTopA: { value: (maps.topA && !maps.noAlbedo) ? maps.topA : whiteTex() },
      uBpAlb: { value: (maps.sideA && !maps.noAlbedo) ? 1 : 0 },
      uBpSideG: { value: maps.grainSideN || flatTex() }, uBpTopG: { value: maps.grainTopN || flatTex() },
      uBpGrain: { value: maps.grain || 0 }
    };
    mat.onBeforeCompile = function (shader) {
      for (var k in U) shader.uniforms[k] = U[k];
      shader.vertexShader = BP_VERT_DECL + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + BP_VERT);
      shader.fragmentShader = BP_FRAG_DECL + shader.fragmentShader
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness;')
        .replace('#include <normal_fragment_maps>', BP_FRAG);
    };
    mat.customProgramCacheKey = function () { return 'cake-biplanar-1'; };
    mat.userData.bp = U;
    mat.needsUpdate = true;
    return mat;
  }
  // Side UVs: u = true angle / 2π, whatever part of the circle the geometry sweeps (a wedge).
  function angleUV(geo, phi0, phiLen) {
    var uv = geo.attributes.uv, n = uv.count;
    for (var i = 0; i < n; i++) uv.setX(i, (phi0 + uv.getX(i) * phiLen) / (Math.PI * 2));
    uv.needsUpdate = true;
    return geo;
  }
  // Top UVs: projected straight down over the tier's diameter. Optional rustic rim: the upper
  // part of the cap moves a little, by angle, so a wedge's rim matches the whole cake's.
  function capUV(geo, R, capH, displace) {
    var pos = geo.attributes.position, uv = geo.attributes.uv;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      uv.setXY(i, x / (2 * R) + 0.5, z / (2 * R) + 0.5);
      if (displace) {
        var rr = Math.sqrt(x * x + z * z);
        if (rr > R * 0.8 && y > capH * 0.35) {
          var th = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
          var k = Math.min(1, (rr - R * 0.8) / (R * 0.2)) * Math.min(1, (y - capH * 0.35) / (capH * 0.4));
          var n = (fu(th, 0.5, 40, 1, 2, 9) - 0.5) * 2 * displace * k;
          var sc = (rr + n) / rr;
          pos.setXYZ(i, x * sc, y + n * 0.6, z * sc);
        }
      }
    }
    uv.needsUpdate = true; pos.needsUpdate = true;
    return geo;
  }

  // =================================================================
  // SPONGE (v0.79): the crust and the crumb, all procedural so they react to the light.
  // The crumb is modelled as what it is — a FOAM: a solid full of air cells of mixed sizes,
  // stretched a little upward because the cake rose ("open chiffon"). The crust is the same
  // idea at a finer scale — sandy and porous. Rack marks are where the cooling rack's wires
  // pressed the top: slightly sunken and paler, because the crust browned less there.
  // =================================================================
  // Tileable Worley foam: height 1 on the walls, dipping as a hemisphere into each air cell.
  function foam(W, H, layers, seed) {
    var h = new Float32Array(W * H); for (var i = 0; i < W * H; i++) h[i] = 1;
    layers.forEach(function (L, li) {
      var gx = L.cells, gy = Math.max(1, Math.round(L.cells * H / W / L.stretch)), s = seed + li * 13;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var fx = x / W * gx, fy = y / H * gy, cx = Math.floor(fx), cy = Math.floor(fy), best = 1e9, rad = 0;
        for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
          var ix = cx + ox, iy = cy + oy, wx = ((ix % gx) + gx) % gx, wy = ((iy % gy) + gy) % gy;
          var px = ix + phash(wx, wy, s), py = iy + phash(wx, wy, s + 1), dx = fx - px, dy = (fy - py) * L.stretch, d = Math.sqrt(dx * dx + dy * dy);
          if (d < best) { best = d; rad = L.hole[0] + (L.hole[1] - L.hole[0]) * Math.pow(phash(wx, wy, s + 2), L.skew || 1); }
        }
        if (best < rad) { var t = best / rad, dip = L.depth * Math.sqrt(1 - t * t), k = y * W + x; if (1 - dip < h[k]) h[k] = 1 - dip; }
      }
    });
    for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) h[y2 * W + x2] -= 0.06 * fu(x2 / W, y2 / H, Math.round(W / 3), Math.round(H / 3), 1, seed + 99);
    return h;
  }
  function toColour(fn, W, H) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var v = fn(x, y), i = (y * W + x) * 4; d[i] = Math.min(255, v[0] * 255); d[i + 1] = Math.min(255, v[1] * 255); d[i + 2] = Math.min(255, v[2] * 255); d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.__shared = true;
    return t;
  }
  // Rack patterns across the top (texture space = the tier's diameter). 0 plain · 1 wires · 2 bars.
  var RACKS = [null, { sp: 0.045, w: 0.0065 }, { sp: 0.105, w: 0.013 }];
  function rackAt(kind, u, v) {
    var R = RACKS[kind]; if (!R) return 0;
    var a = 0.35, p = u * Math.cos(a) + v * Math.sin(a);
    var wob = 0.003 * (fu(p * 3, v * 3, 3, 3, 2, 31) - 0.5);
    var t = (p + wob) / R.sp, f = t - Math.floor(t), k = Math.max(0, 1 - Math.abs(f - 0.5) / (R.w / R.sp));
    var str = 0.7 + 0.3 * phash(Math.floor(t), 7, 5);                     // some wires pressed harder
    return k * k * (3 - 2 * k) * str;
  }
  var spongeCache = {}, spongeSeed = null;
  function spongeMaps(rackKind) {
    rackKind = Math.max(0, Math.min(2, rackKind | 0));
    if (spongeSeed !== SEED) {                           // a new seed: a new crust and new rack marks
      Object.keys(spongeCache).forEach(function (k) {
        var set = spongeCache[k];
        if (set && set.n) Object.keys(set).forEach(function (t) { if (set[t] && set[t].dispose) set[t].dispose(); });
        delete spongeCache[k];
      });
      spongeSeed = SEED;
    }
    if (!spongeCache.side) {
      var hs = foam(SW, SH, [{ cells: 340, stretch: 1, hole: [0.12, 0.42], depth: 0.55, skew: 2.2 }, { cells: 760, stretch: 1, hole: [0.1, 0.3], depth: 0.35 }], 41);
      spongeCache.side = {
        n: toNormal(hs, SW, SH, 2.6), r: toRough(hs, SW, SH, 0.72, 0.4),
        a: toColour(function (x, y) { var k = (0.95 + 0.06 * (fu(x / SW, y / SH, 40, 8, 3, 5) - 0.5) * 2) * (0.86 + 0.14 * hs[y * SW + x]); return [k, k, k]; }, SW, SH)
      };
      spongeCache.topFoam = foam(TW, TW, [{ cells: 170, stretch: 1, hole: [0.12, 0.42], depth: 0.55, skew: 2.2 }, { cells: 380, stretch: 1, hole: [0.1, 0.3], depth: 0.35 }], 43);
    }
    if (!spongeCache['top' + rackKind]) {
      var tf = spongeCache.topFoam, th = new Float32Array(TW * TW), tm = new Float32Array(TW * TW);
      for (var y = 0; y < TW; y++) for (var x = 0; x < TW; x++) { var m = rackAt(rackKind, x / TW, y / TW), i = y * TW + x; tm[i] = m; th[i] = tf[i] * (1 - 0.5 * m) - 0.25 * m; }
      spongeCache['top' + rackKind] = {
        n: toNormal(th, TW, TW, 3.2), r: toRough(th, TW, TW, 0.72, 0.4),
        a: toColour(function (x, y) { var i = y * TW + x, k = (0.95 + 0.06 * (fu(x / TW, y / TW, 24, 24, 3, 5) - 0.5) * 2) * (0.86 + 0.14 * Math.max(0, th[i] + 0.25 * tm[i])); var pale = 1 + 0.3 * tm[i]; return [k * pale, k * pale * 1.01, k * pale * 1.05]; }, TW, TW)
      };
    }
    var S = spongeCache.side, T = spongeCache['top' + rackKind];
    return { sideN: S.n, sideR: S.r, sideA: S.a, topN: T.n, topR: T.r, topA: T.a, normalScale: 1.0, displace: 0 };
  }
  // The crumb: open chiffon foam, tiled at CRUMB_TILE world units (a cut face's UVs are in
  // world units). Holes darker (light can't get in), walls warm and pale.
  var CRUMB_TILE = 1.2, crumbPlaceholder = null, crumbQueued = false;
  // The crumb is only seen once the cake is cut, so it's generated in the background shortly
  // after load (≈0.3s of work) instead of on the load path. Until then — or for the shader
  // warm-up, where only the material's SHAPE matters — a tiny placeholder set stands in.
  // `now` forces it (the slice page needs the real crumb at once).
  // Flavour details live in the crumb, not just its colour: carrot has orange and dark spice
  // flecks, lemon a faint scatter of zest, chocolate a slightly tighter crumb, red velvet darker
  // cell walls so the red reads deep rather than flat. The foam itself is shared.
  var crumbFoam = null, crumbSets = {};
  function crumbMaps(now, variant) {
    variant = variant || 'plain';
    if (!crumbFoam && !now) {
      if (!crumbQueued) { crumbQueued = true; setTimeout(function () { crumbMaps(true, variant); }, 900); }
      if (!crumbPlaceholder) {
        var mk1 = function (rgb) { var c = document.createElement('canvas'); c.width = c.height = 2; var g = c.getContext('2d'); g.fillStyle = rgb; g.fillRect(0, 0, 2, 2); var t = new THREE.CanvasTexture(c); t.__shared = true; return t; };
        crumbPlaceholder = { a: mk1('#f0ece4'), n: mk1('#8080ff'), r: mk1('#f2f2f2') };
        crumbPlaceholder.a.encoding = THREE.sRGBEncoding;
      }
      return crumbPlaceholder;
    }
    var N = 448;
    if (crumbFoam && crumbFoam.seed !== SEED) {          // a new seed: a new crumb
      [crumbFoam.n, crumbFoam.r].forEach(function (t) { if (t && t.dispose) t.dispose(); });
      Object.keys(crumbSets).forEach(function (k) { Object.keys(crumbSets[k]).forEach(function (t) { if (crumbSets[k][t].dispose) crumbSets[k][t].dispose(); }); delete crumbSets[k]; });
      crumbFoam = null;
    }
    if (!crumbFoam) {
      var h0 = foam(N, N, [{ cells: 13, stretch: 1.6, hole: [0.1, 0.7], depth: 1, skew: 2.5 }, { cells: 35, stretch: 1.4, hole: [0.2, 0.55], depth: 0.8 }, { cells: 90, stretch: 1.2, hole: [0.15, 0.4], depth: 0.5 }], 17);
      crumbFoam = { h: h0, n: toNormal(h0, N, N, 4.5), r: toRough(h0, N, N, 0.95, -0.1), seed: SEED };
    }
    if (!crumbSets[variant]) {
      var h = crumbFoam.h, tile = variant === 'tight' ? CRUMB_TILE / 1.45 : CRUMB_TILE;
      var rep = function (t) { var c = t.clone(); c.needsUpdate = true; c.repeat.set(1 / tile, 1 / tile); c.__shared = true; return c; };
      var fleck = function (x, y, seed, dens) { return phash(Math.floor(x / 2), Math.floor(y / 2), seed) > 1 - dens; };
      var a = toColour(function (x, y) {
        var v = Math.max(0, h[y * N + x]), k;
        if (variant === 'velvet') k = 0.66 + 0.36 * Math.pow(v, 1.6);   // darker walls: a deep red, not a flat one
        else k = 0.84 + 0.2 * Math.pow(v, 1.3);
        var c = [k, k * 0.985, k * 0.95];
        if (variant === 'carrot') {                                      // carrot shreds and spice
          if (fleck(x, y, 81, 0.012)) c = [k * 1.05, k * 0.62, k * 0.3];
          else if (fleck(x, y, 83, 0.008)) c = [k * 0.45, k * 0.33, k * 0.25];
        } else if (variant === 'lemon') {                                // zest
          if (fleck(x, y, 85, 0.006)) c = [k * 1.08, k * 1.02, k * 0.45];
        }
        return c;
      }, N, N);
      a.repeat.set(1 / tile, 1 / tile);
      crumbSets[variant] = { a: a, n: rep(crumbFoam.n), r: rep(crumbFoam.r) };
    }
    return crumbSets[variant];
  }
  // Sponge is slightly translucent: light soaks in, so its shaded side stays soft and warm.
  // The diffuse term is lit by a "wrapped" N·L; the extra light let round the terminator is
  // tinted warm, like light that travelled through the crumb.
  var WRAP_DIFF = 'reflectedLight.directDiffuse += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );';
  function wrapLighting(mat, wrap, tint) {
    var chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
    if (chunk.indexOf(WRAP_DIFF) < 0) { console.warn('frosting.js: wrap-lighting anchor not found; crumb uses standard lighting'); return mat; }
    var U = { uWrap: { value: wrap }, uScatter: { value: tint } };
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uWrap = U.uWrap; sh.uniforms.uScatter = U.uScatter;
      sh.fragmentShader = 'uniform float uWrap; uniform vec3 uScatter;\n' + sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', chunk.replace(WRAP_DIFF,
        'float wNL = saturate( ( dot( geometry.normal, directLight.direction ) + uWrap ) / ( 1.0 + uWrap ) );' +
        '\n vec3 wIrr = wNL * directLight.color;\n #ifndef PHYSICALLY_CORRECT_LIGHTS\n wIrr *= PI;\n #endif' +
        '\n reflectedLight.directDiffuse += ( 1.0 - clearcoatDHR ) * ( irradiance + max( wIrr - irradiance, 0.0 ) * uScatter ) * BRDF_Diffuse_Lambert( material.diffuseColor );'));
    };
    mat.customProgramCacheKey = function () { return 'cake-crumb-wrap-1'; };
    mat.needsUpdate = true;
    return mat;
  }
  // A baked sponge isn't a machined cylinder: the wall leans and bulges a little and has soft
  // lumps, and the top layer's shoulder is crumbly. Applied to every part of a stack (walls,
  // lids, fillings, cut ends) by position, so a wedge matches the whole cake and the fillings
  // keep their inset. amp is a fraction of the radius.
  function spongeWobble(geo, R, topY, amp) {
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), rr = Math.sqrt(x * x + z * z);
      if (rr < 1e-4) continue;
      var u = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
      var k = 1 + amp * ((fu(u, y * 0.25 / 1000, 3, 1000, 2, 51) - 0.5) * 1.4 + (fu(u, y * 0.9 / 1000, 18, 1000, 2, 52) - 0.5) * 0.7);   // fu scales v by its period: divide it back out
      var dy = 0;
      if (y > topY - 0.1 && rr > R * 0.86) {                             // the crumbly shoulder
        var e = Math.min(1, (rr - R * 0.86) / (R * 0.14)) * Math.min(1, (y - (topY - 0.1)) / 0.1);
        dy = -e * (0.035 + 0.03 * fu(u, 0.5, 60, 1, 2, 53));
        k -= e * 0.012 * fu(u, 0.5, 140, 1, 1, 54);
      }
      pos.setXYZ(i, x * k, y + dy, z * k);
    }
    pos.needsUpdate = true;
    return geo;
  }

  // Rustic rim on a one-piece shell: vertices above `yFrom` and near the edge move a little, by
  // angle, so a wedge's rim matches the whole cake's. (Normals are left alone: the finish maps
  // carry the light; recomputing would fold the lathe's seam column.)
  function displaceRim(geo, R, yFrom, capH, displace) {
    if (!displace) return geo;
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), rr = Math.sqrt(x * x + z * z);
      if (rr > R * 0.8 && y > yFrom) {
        var th = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
        var k = Math.min(1, (rr - R * 0.8) / (R * 0.2)) * Math.min(1, (y - yFrom) / (capH * 0.4));
        var n = (fu(th, 0.5, 40, 1, 2, 9) - 0.5) * 2 * displace * k, sc = (rr + n) / rr;
        pos.setXYZ(i, x * sc, y + n * 0.6, z * sc);
      }
    }
    pos.needsUpdate = true;
    return geo;
  }
  // =================================================================
  // RIBBON (v0.84): cloth, not a painted stripe.
  //  · a fine SELVEDGE — a thin cord at each woven edge — with the middle cupped in
  //  · an ANISOTROPIC highlight: satin's threads run the ribbon's length, so the highlight
  //    smears along them instead of sitting as a round spot (grosgrain smears across its ribs)
  //  · hand-tied imperfection: a few millimetres off level, and a gathered stretch that narrows
  //    and lifts off the cake, all from the cake's seed
  // =================================================================
  var RW = 1024, RH = 64, ribCloth = {};
  function ribbonCloth(kind) {
    if (ribCloth[kind]) return ribCloth[kind];
    var h, nk, rf;
    if (kind === 1) {                                   // grosgrain: fine ribs ACROSS the ribbon
      h = field(RW, RH, function (u, v) { return 0.5 + 0.3 * Math.sin(u * Math.PI * 2 * 300) + 0.06 * fu(u, v, 300, 10, 1, 7); });
      nk = 1.5; rf = function (u) { return 0.55 + 0.12 * Math.sin(u * Math.PI * 2 * 300); };
    } else {                                            // satin: threads running its length
      h = field(RW, RH, function (u, v) { return 0.5 + 0.28 * Math.sin(v * Math.PI * 2 * 34) + 0.12 * fu(u, v, 260, 8, 3, 5); });
      nk = 0.55; rf = function (u, v) { return 0.24 + 0.12 * fu(u, v, 80, 6, 1, 5); };
    }
    var rough = document.createElement('canvas'); rough.width = RW; rough.height = RH;
    var g = rough.getContext('2d'), img = g.createImageData(RW, RH), d = img.data;
    for (var y = 0; y < RH; y++) for (var x = 0; x < RW; x++) { var q = rf(x / RW, y / RH) * 255, i = (y * RW + x) * 4; d[i] = d[i + 1] = d[i + 2] = q; d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    var rt = new THREE.CanvasTexture(rough); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.__shared = true;
    ribCloth[kind] = { n: toNormal(h, RW, RH, nk), r: rt };
    return ribCloth[kind];
  }
  // The anisotropic highlight. three's standard material spreads its highlight evenly; this
  // patches the specular term to an anisotropic GGX with two roughnesses — along the threads and
  // across them — with the thread direction (the circumference) passed from the vertex shader.
  var RIB_SPEC = 'reflectedLight.directSpecular += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Specular_GGX( directLight, geometry.viewDir, geometry.normal, material.specularColor, material.specularRoughness);';
  var ANISO_FN = [
    'vec3 BRDF_Aniso( const in IncidentLight dl, const in vec3 V, const in vec3 N, const in vec3 T, const in vec3 B, const in vec3 F0, const in float ax, const in float ay ) {',
    '  vec3 H = normalize( dl.direction + V );',
    '  float dotNL = saturate( dot( N, dl.direction ) ), dotNV = saturate( dot( N, V ) );',
    '  float dotNH = saturate( dot( N, H ) ), dotVH = saturate( dot( V, H ) );',
    '  float a2 = ax * ay;',
    '  vec3 v = vec3( ay * dot( T, H ), ax * dot( B, H ), a2 * dotNH );',
    '  float D = min( a2 * pow2( a2 / max( dot( v, v ), 1e-5 ) ) / PI, 40.0 );',   // clamped: the peak runs away at grazing angles and blows out to white
    '  float k = pow2( ax + ay ) / 8.0;',
    '  float G = ( dotNL / ( dotNL * ( 1.0 - k ) + k ) ) * ( dotNV / ( dotNV * ( 1.0 - k ) + k ) );',
    '  vec3 F = F0 + ( 1.0 - F0 ) * exp2( ( -5.55473 * dotVH - 6.98316 ) * dotVH );',
    '  return F * ( G * D ) / ( 4.0 * max( dotNL * dotNV, 1e-4 ) );',
    '}'].join('\n');
  function ribbonMaterial(colourHex, kind) {
    kind = kind | 0;
    var cloth = ribbonCloth(kind);
    var m = new THREE.MeshStandardMaterial({ color: colourHex, roughness: 1, metalness: kind === 1 ? 0.05 : 0.2, side: THREE.DoubleSide });
    m.normalMap = cloth.n; m.normalScale = new THREE.Vector2(kind === 1 ? 1.1 : 0.9, kind === 1 ? 1.1 : 0.9);
    m.roughnessMap = cloth.r;
    var chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
    if (chunk.indexOf(RIB_SPEC) < 0) { console.warn('frosting.js: ribbon sheen anchor missing'); return m; }
    var ax = kind === 1 ? 0.12 : 0.5, ay = kind === 1 ? 0.5 : 0.055;   // grosgrain smears across its ribs instead
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uAx = { value: ax }; sh.uniforms.uAy = { value: ay };
      sh.vertexShader = 'varying vec3 vRibT;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n float rA = (abs(position.x)+abs(position.z) < 1e-5) ? 0.0 : atan(position.x, position.z);\n vRibT = normalize(normalMatrix * vec3(cos(rA), 0.0, -sin(rA)));');
      // The function goes in WITH the chunk it patches: three's light structs are declared there.
      sh.fragmentShader = 'varying vec3 vRibT;\nuniform float uAx; uniform float uAy;\n' +
        sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', ANISO_FN + '\n' + chunk.replace(RIB_SPEC,
          'vec3 aT = normalize( vRibT - geometry.normal * dot( vRibT, geometry.normal ) );' +
          '\n vec3 aB = normalize( cross( geometry.normal, aT ) );' +
          '\n reflectedLight.directSpecular += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Aniso( directLight, geometry.viewDir, geometry.normal, aT, aB, material.specularColor, uAx, uAy );'));
    };
    m.customProgramCacheKey = function () { return 'cake-ribbon-aniso-1'; };
    return m;
  }
  // How this ribbon was tied: from the cake's seed, so the sender and the recipient see the same
  // one. `tilt` is in world units (the requested angle, already clamped by app.js).
  function ribbonHand(tierIdx) {
    var r1 = phash(tierIdx + 3, 17, 1.3), r2 = phash(tierIdx + 5, 23, 2.7), r3 = phash(tierIdx + 7, 29, 3.9);
    return { tiltAt: r1 * Math.PI * 2, at: r2 * Math.PI * 2, amp: 0.020 + 0.010 * r3, width: 0.6 + 0.2 * r1, freq: 7 + 2 * r2, lift: 0.7 + 0.3 * r3 };
  }
  window.CakeFrosting = { ribbonMaterial: ribbonMaterial, ribbonHand: ribbonHand, setSeed: setSeed, seedOf: seedOf, semiNakedTexture: semiNakedTexture, SEMI: SEMI, noise2: noise2, displaceRim: displaceRim,
                          finishPreview: finishPreview, FINISH_COUNT: FINISH_COUNT,
                          spongeMaps: spongeMaps, crumbMaps: crumbMaps, wrapLighting: wrapLighting, spongeWobble: spongeWobble, CRUMB_TILE: CRUMB_TILE,
                          fondantMaps: fondantMaps, dressFondant: dressFondant, angleUV: angleUV, capUV: capUV, FINISHES: FINISHES };
})();

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
  function phash(x, y, s) { var n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
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
  function field(W, H, fn) { var a = new Float32Array(W * H); for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) a[y * W + x] = fn(x / W, y / H, x, y); return a; }
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
  var FINISHES = [
    { name: 'Grain',  normalScale: 0.35, rough: [0.6, 0.06], displace: 0,
      side: function () { return field(SW, SH, function (u, v) { return fu(u, v, 340, 64, 2, 1) * 0.6 + fu(u, v, 72, 14, 2, 2) * 0.4; }); },
      top:  function () { return field(TW, TW, function (u, v) { return fu(u, v, 170, 170, 2, 1) * 0.6 + fu(u, v, 36, 36, 2, 2) * 0.4; }); },
      strength: 2.2 },
    { name: 'Swept',  normalScale: 0.6, rough: [0.55, 0.25], displace: 0,
      side: function () { return field(SW, SH, function (u, v) { var ph = fu(u, 0, 16, 1, 2, 6) * 5; return 0.5 + 0.28 * Math.sin(v * Math.PI * 2 * 4 + ph) + fu(u, v, 200, 36, 2, 7) * 0.12; }); },
      top:  function () { return field(TW, TW, function (u, v) { var dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx); return 0.5 + 0.3 * Math.sin(r * 90 + fu(a / (Math.PI * 2) + 0.5, r, 6, 1, 2, 8) * 4); }); },
      strength: 5 },
    { name: 'Rustic', normalScale: 1.0, rough: [0.62, 0.35], displace: 0.05,
      side: function () { return blur(strokes(SW, SH, 110, [60, 150], [22, 48], 11), SW, SH, 2, 2); },
      top:  function () { return blur(strokes(TW, TW, 90, [60, 150], [22, 48], 23), TW, TW, 2, 2); },
      strength: 6 }
  ];
  // Low sun = the rustic maps (same name, so the same cached textures) with a little more relief;
  // app.js turns the light into a low raking sun.
  FINISHES[3] = Object.assign({}, FINISHES[2], { normalScale: 1.3 });
  var mapCache = {};
  function fondantMaps(finish) {
    finish = Math.max(0, Math.min(3, finish | 0));
    var F = FINISHES[finish], key = F.name;
    if (!mapCache[key]) {
      var hs = F.side(), ht = F.top();
      mapCache[key] = {
        sideN: toNormal(hs, SW, SH, F.strength), sideR: toRough(hs, SW, SH, F.rough[0], F.rough[1]),
        topN: toNormal(ht, TW, TW, F.strength), topR: toRough(ht, TW, TW, F.rough[0], F.rough[1])
      };
    }
    var m = mapCache[key];
    return { sideN: m.sideN, sideR: m.sideR, topN: m.topN, topR: m.topR, normalScale: F.normalScale, displace: F.displace };
  }
  // Put the maps on a material (keeps its colour; roughness then comes from the map).
  function dressFondant(mat, maps, which) {
    mat.normalMap = which === 'top' ? maps.topN : maps.sideN;
    mat.roughnessMap = which === 'top' ? maps.topR : maps.sideR;
    mat.roughness = 1;
    mat.normalScale = new THREE.Vector2(maps.normalScale, maps.normalScale);
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

  window.CakeFrosting = { semiNakedTexture: semiNakedTexture, SEMI: SEMI, noise2: noise2,
                          fondantMaps: fondantMaps, dressFondant: dressFondant, angleUV: angleUV, capUV: capUV, FINISHES: FINISHES };
})();

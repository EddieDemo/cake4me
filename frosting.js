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
    'uniform sampler2D uBpSideA; uniform sampler2D uBpTopA; uniform float uBpAlb;\n';
  var BP_FRAG =
    '\n{' +
    '\n  float bpA = ((abs(vBpPos.x) + abs(vBpPos.z) < 1e-5) ? 0.0 : atan(vBpPos.x, vBpPos.z)) / 6.2831853 + 0.5;' +
    '\n  float bpA2 = fract(bpA + 0.5) - 0.5;' +                        // the same angle, seam moved to the back
    '\n  float bpU = (fwidth(bpA) > fwidth(bpA2) + 1e-5) ? bpA2 : bpA;' + // pick whichever has no jump here (no mip seam)
    '\n  vec2 uvS = vec2(bpU, vBpPos.y / uBpSpan);' +
    '\n  vec2 uvT = vec2(vBpPos.x / (2.0 * uBpR) + 0.5, 0.5 - vBpPos.z / (2.0 * uBpR));' +
    '\n  float bpW = smoothstep(0.35, 0.85, abs(normalize(vBpN).y));' +
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
    '\n}\n';
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
      uBpAlb: { value: (maps.sideA && !maps.noAlbedo) ? 1 : 0 }
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
  var spongeCache = {};
  function spongeMaps(rackKind) {
    rackKind = Math.max(0, Math.min(2, rackKind | 0));
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
  var CRUMB_TILE = 1.2, crumbCache = null, crumbPlaceholder = null, crumbQueued = false;
  // The crumb is only seen once the cake is cut, so it's generated in the background shortly
  // after load (≈0.3s of work) instead of on the load path. Until then — or for the shader
  // warm-up, where only the material's SHAPE matters — a tiny placeholder set stands in.
  // `now` forces it (the slice page needs the real crumb at once).
  function crumbMaps(now) {
    if (!crumbCache && !now) {
      if (!crumbQueued) { crumbQueued = true; setTimeout(function () { crumbMaps(true); }, 900); }
      if (!crumbPlaceholder) {
        var mk1 = function (rgb) { var c = document.createElement('canvas'); c.width = c.height = 2; var g = c.getContext('2d'); g.fillStyle = rgb; g.fillRect(0, 0, 2, 2); var t = new THREE.CanvasTexture(c); t.__shared = true; return t; };
        crumbPlaceholder = { a: mk1('#f0ece4'), n: mk1('#8080ff'), r: mk1('#f2f2f2') };
        crumbPlaceholder.a.encoding = THREE.sRGBEncoding;
      }
      return crumbPlaceholder;
    }
    if (!crumbCache) {
      var N = 448, h = foam(N, N, [{ cells: 13, stretch: 1.6, hole: [0.1, 0.7], depth: 1, skew: 2.5 }, { cells: 35, stretch: 1.4, hole: [0.2, 0.55], depth: 0.8 }, { cells: 90, stretch: 1.2, hole: [0.15, 0.4], depth: 0.5 }], 17);
      var set = function (t) { t.repeat.set(1 / CRUMB_TILE, 1 / CRUMB_TILE); return t; };
      crumbCache = {
        a: set(toColour(function (x, y) { var k = 0.84 + 0.2 * Math.pow(Math.max(0, h[y * N + x]), 1.3); return [k, k * 0.985, k * 0.95]; }, N, N)),
        n: set(toNormal(h, N, N, 4.5)), r: set(toRough(h, N, N, 0.95, -0.1))
      };
    }
    return crumbCache;
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
  window.CakeFrosting = { semiNakedTexture: semiNakedTexture, SEMI: SEMI, noise2: noise2, displaceRim: displaceRim,
                          spongeMaps: spongeMaps, crumbMaps: crumbMaps, wrapLighting: wrapLighting, spongeWobble: spongeWobble, CRUMB_TILE: CRUMB_TILE,
                          fondantMaps: fondantMaps, dressFondant: dressFondant, angleUV: angleUV, capUV: capUV, FINISHES: FINISHES };
})();

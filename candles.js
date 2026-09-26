/* candles.js — the candles' parts (v1.13, refactor step 6).
   create() → { candleGeo, HOLDER, holderGeo(r), holderMat, wickGeo, wickMat, makeWaxMaterial(hex),
                CANDLE_STYLES, STYLE_ALL, STYLE_GEO, STYLE_HEIGHT, styleMaterial(style, hex), candleStyleOf(cs, i),
                studioEnv(renderer), CANDLE_HAND, candleHand(i, height), composeCandle, composeHolder, candleTop,
                NUM, digitGeometry(ch, H), numberSpikeGeo }
   The wax candle shape and its shader (light soaking in, the glow at the top per candle), the
   holder on its spike, the wick; the seven styles (shapes, patterns, metal in a studio); how each
   candle is placed by hand from the seed; and the extruded Fredoka digits for number candles.
   Placing them on a cake — and the flames — is done by the caller (app.js's placeCandles). */
(function () {
  function create() {
    var candleGeo = (function () {
      var p = [new THREE.Vector2(0, -0.5), new THREE.Vector2(0.96, -0.5)];
      for (var i = 0; i <= 16; i++) p.push(new THREE.Vector2(1 + 0.012 * Math.sin(i * 1.3), -0.5 + 0.94 * (i / 16)));
      p.push(new THREE.Vector2(0.985, 0.475), new THREE.Vector2(0.9, 0.5), new THREE.Vector2(0.8, 0.504),
             new THREE.Vector2(0.7, 0.492), new THREE.Vector2(0.35, 0.482), new THREE.Vector2(0, 0.48));
      var g = new THREE.LatheGeometry(p, 24), pos = g.attributes.position, uv = g.attributes.uv;
      for (var j = 0; j < pos.count; j++) uv.setY(j, pos.getY(j) + 0.5);
      uv.needsUpdate = true;
      return g;
    })();
    // How candles stand: in a small white holder — a cup on a spike pushed into the cake, with a
    // couple of millimetres of spike showing below the cup.
    var HOLDER = { gap: 0.05, cupH: 2.0, floor: 0.4, wall: 0.2 };   // cupH/floor/wall in candle radii
    var holderGeos = {};
    function holderGeo(r) {
      var key = r.toFixed(3);
      if (holderGeos[key]) return holderGeos[key];
      var ri = r * 1.02, ro = ri + r * HOLDER.wall, h = r * HOLDER.cupH, gap = HOLDER.gap, p = [];
      p.push(new THREE.Vector2(0, gap), new THREE.Vector2(ro * 0.92, gap), new THREE.Vector2(ro * 0.96, gap + 0.006),
             new THREE.Vector2(ro * 1.03, gap + 0.012), new THREE.Vector2(ro * 0.97, gap + 0.02),     // a ring round the foot
             new THREE.Vector2(ro, gap + h * 0.8), new THREE.Vector2(ro * 1.05, gap + h * 0.95),      // the wall, a rolled lip
             new THREE.Vector2(ro * 1.04, gap + h), new THREE.Vector2(ri, gap + h),
             new THREE.Vector2(ri * 0.98, gap + h * HOLDER.floor * 0.5), new THREE.Vector2(0, gap + h * HOLDER.floor * 0.5));
      var cup = new THREE.LatheGeometry(p, 24);
      var rib = new THREE.BoxGeometry(r * 0.18, h * 0.72, r * 0.12); rib.translate(0, gap + h * 0.52, ro + r * 0.03);   // the moulded rib
      var spike = new THREE.CylinderGeometry(r * 0.32, r * 0.25, gap + 0.02, 12); spike.translate(0, (gap - 0.02) / 2, 0);
      var merged = CakeShapes.merge([cup, rib, spike], function () { return 0; });
      [cup, rib, spike].forEach(function (g) { g.dispose(); });
      merged.clearGroups();
      CakeResources.keep(merged);
      return (holderGeos[key] = merged);
    }
    // Wax: light soaks into it (warm wrap lighting), a soft sheen that's glossier in the melted
    // pool, very fine drawing lines, and the top glowing from within while the flame is lit —
    // per candle, through an instance attribute, so blowing one out puts out its glow.
    var waxMaps = null;
    function makeWaxMaps() {
      if (waxMaps) return waxMaps;
      function tex(W, H, fn, srgb) {
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var g = c.getContext('2d'), im = g.createImageData(W, H);
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var v = fn(x / W, 1 - y / H, x, y), i = (y * W + x) * 4; im.data[i] = v[0] * 255; im.data[i + 1] = v[1] * 255; im.data[i + 2] = v[2] * 255; im.data[i + 3] = 255; }
        g.putImageData(im, 0, 0);
        var t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; if (srgb) t.encoding = THREE.sRGBEncoding; CakeResources.keep(t); return t;
      }
      var WW = 128, WH = 256, h = new Float32Array(WW * WH);
      for (var y = 0; y < WH; y++) for (var x = 0; x < WW; x++) {
        var u = x / WW, v = 1 - y / WH;
        h[y * WW + x] = 0.5 + 0.05 * Math.sin(u * Math.PI * 2 * 34 + 3 * Math.sin(u * 6.28 * 3 + v * 4)) + 0.04 * Math.sin(u * 6.28 * 11 + v * 9.1);
      }
      waxMaps = {
        n: tex(WW, WH, function (u, v, x, y) {
          var xl = (x - 1 + WW) % WW, xr = (x + 1) % WW, yu = Math.max(0, y - 1), yd = Math.min(WH - 1, y + 1);
          var dx = (h[y * WW + xr] - h[y * WW + xl]) * 1.6, dy = (h[yd * WW + x] - h[yu * WW + x]) * 1.6, nx = -dx, ny = dy, l = Math.sqrt(nx * nx + ny * ny + 1);
          return [nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, 1 / l * 0.5 + 0.5];
        }, false),
        r: tex(4, WH, function (u, v) { var q = v > 0.965 ? 0.12 : 0.42; return [q, q, q]; }, false),
        glow: tex(4, WH, function (u, v) { var q = Math.pow(Math.max(0, (v - 0.55) / 0.45), 2.2); return [q, q * 0.82, q * 0.55]; }, true)
      };
      return waxMaps;
    }
    function makeWaxMaterial(hex) {
      var W = makeWaxMaps();
      var m = new THREE.MeshStandardMaterial({ color: hex, roughness: 1, roughnessMap: W.r, normalMap: W.n,
        emissive: new THREE.Color(1, 0.7, 0.4), emissiveMap: W.glow, emissiveIntensity: 1.1 });
      m.normalScale = new THREE.Vector2(0.3, 0.3);
      if (window.CakeFrosting) CakeFrosting.wrapLighting(m, 0.75, new THREE.Color(1, 0.82, 0.6));
      var wrapCompile = m.onBeforeCompile;
      m.onBeforeCompile = function (sh) {
        if (wrapCompile) wrapCompile(sh);
        CakePatch.declare(sh, 'vertex', 'attribute float aLit;\nvarying float vLit;');
        CakePatch.after(sh, 'vertex', 'begin_vertex', ' vLit = aLit;');
        CakePatch.declare(sh, 'fragment', 'varying float vLit;');
        CakePatch.after(sh, 'fragment', 'emissivemap_fragment', ' totalEmissiveRadiance *= vLit;');
      };
      m.customProgramCacheKey = function () { return 'cake-candle-wax-1'; };
      return m;
    }
    var holderMat = new THREE.MeshStandardMaterial({ color: 0xFBFAF7, roughness: 0.34 });
    if (window.CakeFrosting) {
      CakeFrosting.wrapLighting(holderMat, 0.5, new THREE.Color(1, 0.95, 0.9));    // plastic that light soaks into a little
      holderMat.customProgramCacheKey = function () { return 'cake-candle-holder-1'; };
    }
    CakeResources.keep(holderMat);
    var wickGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6);
    var wickMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 1 });
    // ---- Candle styles (v0.98) ----
    // 0 Classic · 1 Twisted · 2 Striped · 3 Ombré · 4 Gold · 5 Silver · 6 Tapered · 7 All (each candle
    // picks one, from the cake's seed). All share the holders, the hand-placed variation, the flames;
    // the waxy ones share the wax shader (with the glow), the metallic ones reflect a soft studio.
    var CANDLE_STYLES = ['Classic', 'Twisted', 'Striped', 'Ombré', 'Gold', 'Silver', 'Tapered'];
    var STYLE_ALL = 7;
    var twistGeo = (function () {                        // three ridges spiralling up, fading at the ends
      var g = new THREE.CylinderGeometry(1, 1, 1, 48, 64, false), pos = g.attributes.position, uv = g.attributes.uv;
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), r = Math.sqrt(x * x + z * z);
        uv.setY(i, y + 0.5);
        if (r < 1e-5) continue;
        var th = Math.atan2(z, x), yy = y + 0.5, fade = Math.max(0, Math.min(1, yy / 0.04, (1 - yy) / 0.05));
        var k = 0.97 * (1 + 0.2 * Math.cos(3 * th + yy * 17) * fade);
        pos.setXYZ(i, x * k, y, z * k);
      }
      uv.needsUpdate = true; g.computeVertexNormals(); return g;
    })();
    var taperGeo = (function () {                        // slimmer toward the top
      var p = [new THREE.Vector2(0, -0.5), new THREE.Vector2(1.05, -0.5)];
      for (var i = 0; i <= 20; i++) { var t = i / 20; p.push(new THREE.Vector2(1.05 - 0.4 * t, -0.5 + t * 0.994)); }
      p.push(new THREE.Vector2(0.5, 0.5), new THREE.Vector2(0, 0.49));
      var g = new THREE.LatheGeometry(p, 24), pos = g.attributes.position, uv = g.attributes.uv;
      for (var j = 0; j < pos.count; j++) uv.setY(j, pos.getY(j) + 0.5);
      uv.needsUpdate = true; return g;
    })();
    CakeResources.keepAll(twistGeo, taperGeo);
    var STYLE_GEO = [candleGeo, twistGeo, candleGeo, candleGeo, candleGeo, candleGeo, taperGeo];
    var STYLE_HEIGHT = [1, 1, 1, 1, 1, 1, 1.22];          // tapered candles stand taller
    var patternCache = {};
    function candlePattern(hex, kind) {                   // stripes or an ombré, in the candle's colour, on white wax
      var key = kind + hex;
      if (patternCache[key]) return patternCache[key];
      var W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d'), col = '#' + ('000000' + hex.toString(16)).slice(-6);
      if (kind === 'stripe') {
        g.fillStyle = '#FFFDF8'; g.fillRect(0, 0, W, H); g.fillStyle = col;
        for (var k = -8; k < 16; k++) { var y0 = k * 32; g.beginPath(); g.moveTo(0, y0); g.lineTo(W, y0 - 64); g.lineTo(W, y0 - 51); g.lineTo(0, y0 + 13); g.closePath(); g.fill(); }
      } else {
        var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#FFFBF4'); gr.addColorStop(0.55, col); gr.addColorStop(1, col);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; CakeResources.keep(t);
      return (patternCache[key] = t);
    }
    var studioEnv = null;                                  // a soft studio for metal to reflect
    // v1.37: metal in any colour — the number toppers' Metal finish. The colour is the metal's own tint
    // (gold, silver, rose gold… or anything from the picker or the dropper); the studio reflections, the
    // same ones the gold and silver candles use, do the rest.
    function makeMetalMaterial(hex) {
      return new THREE.MeshStandardMaterial({ color: hex, metalness: 0.95, roughness: 0.27, envMap: getStudioEnv(), envMapIntensity: 1.15 });
    }
    function getStudioEnv(renderer) {
      if (studioEnv) return studioEnv;
      if (!renderer) renderer = window.cake && cake.renderer;
      var c = document.createElement('canvas'); c.width = 512; c.height = 256; var g = c.getContext('2d');
      var gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#fff6e8'); gr.addColorStop(0.45, '#f3dcc0'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(0.56, '#b89a7c'); gr.addColorStop(1, '#5a4637');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(60, 40, 90, 70); g.fillRect(330, 30, 120, 60);
      var t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
      var pm = new THREE.PMREMGenerator(renderer);
      studioEnv = pm.fromEquirectangular(t).texture; CakeResources.keep(studioEnv);
      t.dispose(); pm.dispose();
      return studioEnv;
    }
    function styleMaterial(style, candleHex) {
      if (style === 4 || style === 5) {
        return new THREE.MeshStandardMaterial({ color: style === 4 ? 0xD8B25A : 0xD9DCE0, metalness: 0.9, roughness: 0.28,
                                                envMap: getStudioEnv(), envMapIntensity: 1.1 });
      }
      if (style === 2 || style === 3) {
        var m = makeWaxMaterial(0xffffff);
        m.map = candlePattern(candleHex, style === 2 ? 'stripe' : 'ombre');
        return m;
      }
      return makeWaxMaterial(candleHex);
    }
    function candleStyleOf(cs, i) {
      if (cs !== STYLE_ALL) return cs;
      var sd = window.CakeFrosting ? CakeFrosting.seedOf() : 0;
      var n = Math.sin(i * 91.7 + 9 * 311.7 + sd * 74.7) * 43758.5453;
      return Math.floor((n - Math.floor(n)) * CANDLE_STYLES.length);
    }
    var CANDLE_HAND = { push: 0.035, lean: 0.07, burn: 0.13 };
    var _eu = new THREE.Euler(), _v3 = new THREE.Vector3(), _s3 = new THREE.Vector3(), _q2 = new THREE.Quaternion(), _m5 = new THREE.Matrix4();
    function candleHand(i, height) {
      var sd = window.CakeFrosting ? CakeFrosting.seedOf() : 0;
      function h(k) { var n = Math.sin(i * 127.1 + k * 311.7 + sd * 74.7) * 43758.5453; return n - Math.floor(n); }
      var dGap = Math.max(0.006 - HOLDER.gap, (h(1) - 0.5) * 2 * CANDLE_HAND.push);
      _eu.set((h(2) - 0.5) * 2 * CANDLE_HAND.lean, 0, (h(3) - 0.5) * 2 * CANDLE_HAND.lean);
      return { dGap: dGap, q: new THREE.Quaternion().setFromEuler(_eu), h: height * (1 - CANDLE_HAND.burn * Math.pow(h(4), 1.4)),
               rib: ((i * 0.618) % 1) * Math.PI * 2, c1: h(5), c2: h(6), c3: h(7) };
    }
    // The candle: stands in its holder, leaning with it, scaled k (for the pop-in).
    function composeCandle(m, p, C, radius, lift, k) {
      _v3.set(0, C.dGap + lift + (C.h * k) / 2, 0).applyQuaternion(C.q).add(_s3.set(p.x, p.y, p.z));
      m.compose(_v3, C.q, _s3.set(radius * k, C.h * k, radius * k));
    }
    function composeHolder(m, p, C) {
      _q2.setFromAxisAngle(_s3.set(0, 1, 0), C.rib).premultiply(C.q);   // the rib faces its own way; the whole holder leans
      _v3.set(0, C.dGap, 0).applyQuaternion(C.q).add(_s3.set(p.x, p.y, p.z));
      m.compose(_v3, _q2, _s3.set(1, 1, 1));
    }
    function candleTop(p, C, lift, k) {
      return new THREE.Vector3(0, C.dGap + lift + C.h * k, 0).applyQuaternion(C.q).add(new THREE.Vector3(p.x, p.y, p.z));
    }
    // ---- Number candles (v0.94) ----
    // Each digit is Fredoka's own outline, extruded ~1.2cm thick with a soft rounded bevel, in the
    // same wax as the candles. The wick sits at the digit's highest point; one spike under the
    // middle of its foot holds it a few millimetres off the icing. Built once per digit and height.
    var NUM = { height: 1.3, depth: 0.24, bevel: 0.045, gap: 0.05, spacing: 0.08, glow: 0.55 };
    var digitCache = {};
    function digitGeometry(ch, H, font) {
      var classic = font === 1 && window.CakeDigitsClassic;   // v1.36: 1 = the Classic digits (digits-classic.js)
      var key = (classic ? 'c' : '') + ch + '@' + H.toFixed(3);
      if (digitCache[key]) return digitCache[key];
      var set = classic ? window.CakeDigitsClassic : window.CakeDigits, G = set && set.glyphs[ch];
      if (!G) return null;
      var sp = new THREE.ShapePath();
      G.c.forEach(function (c) {
        if (c[0] === 'M') sp.moveTo(c[1], c[2]);
        else if (c[0] === 'L') sp.lineTo(c[1], c[2]);
        else if (c[0] === 'Q') sp.quadraticCurveTo(c[1], c[2], c[3], c[4]);
        else if (c[0] === 'C') sp.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
      });
      // Holes (the 0, 4, 6, 8, 9): take whichever winding gives the counters as holes.
      var a = sp.toShapes(false), b = sp.toShapes(true);
      function holes(list) { return list.reduce(function (n, x) { return n + x.holes.length; }, 0); }
      var shapes = holes(a) >= holes(b) ? a : b;
      var s = H / (G.b[3] - G.b[1]), bev = NUM.bevel;
      var geo = new THREE.ExtrudeGeometry(shapes, { depth: (NUM.depth - 2 * bev) / s, curveSegments: 12, bevelEnabled: true,
        bevelThickness: bev / s, bevelSize: bev / s * 0.9, bevelSegments: 5 });
      geo.scale(s, s, s);
      geo.computeBoundingBox();
      var bb = geo.boundingBox;
      geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
      geo.computeBoundingBox(); bb = geo.boundingBox;
      var pos = geo.attributes.position, uv = geo.attributes.uv, top = { x: 0, y: -1e9 }, lows = [];
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), y = pos.getY(i);
        uv.setXY(i, 0.5, (y - bb.min.y) / (bb.max.y - bb.min.y));   // v runs up the digit, for the glow
        if (y > top.y) top = { x: x, y: y };
        if (y < bb.min.y + 0.03) lows.push(x);
      }
      uv.needsUpdate = true;
      CakeShapes.smoothNormals(geo, 50);                   // v1.30: one smooth surface, not flat facets
      geo.setAttribute('aLit', new THREE.Float32BufferAttribute(new Float32Array(pos.count).fill(1), 1));   // the wax shader's per-candle glow switch; per digit it's driven by the material instead
      CakeResources.keep(geo);
      return (digitCache[key] = { geo: geo, width: bb.max.x - bb.min.x, top: top,
        foot: lows.length ? lows.reduce(function (p, q) { return p + q; }, 0) / lows.length : 0 });
    }
    var numberSpikeGeo = new THREE.CylinderGeometry(0.03, 0.02, NUM.gap + 0.06, 12);
    CakeResources.keep(numberSpikeGeo);
    CakeResources.keepAll(candleGeo, wickGeo); CakeResources.keep(wickMat);
    return { candleGeo: candleGeo, HOLDER: HOLDER, holderGeo: holderGeo, holderMat: holderMat, wickGeo: wickGeo, wickMat: wickMat, makeWaxMaterial: makeWaxMaterial, makeMetalMaterial: makeMetalMaterial,
             CANDLE_STYLES: CANDLE_STYLES, STYLE_ALL: STYLE_ALL, STYLE_GEO: STYLE_GEO, STYLE_HEIGHT: STYLE_HEIGHT, styleMaterial: styleMaterial, candleStyleOf: candleStyleOf,
             studioEnv: getStudioEnv, CANDLE_HAND: CANDLE_HAND, candleHand: candleHand, composeCandle: composeCandle, composeHolder: composeHolder, candleTop: candleTop,
             NUM: NUM, digitGeometry: digitGeometry, numberSpikeGeo: numberSpikeGeo };
  }
  window.CakeCandles = { create: create };
})();

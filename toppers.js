/* toppers.js — toppers: things that stand on the top tier (v1.22).
   Toppers go only on a tier with nothing above it, three at most per cake. Today there are two
   kinds — the digits of a number, and emojis. They're decorations cast in candle wax, not
   candles: no wick, no flame (v1.23). Candles can stand with them, round the outside. More kinds can be added as another `part` builder.
   create(deps) → { parse(text) → { keys, unknown }, part(key, H) → { geo, width, top, foot, material() },
                    available(key), label(key), texture(key) }
   Emojis: Noto Emoji artwork (Apache 2.0 — emoji/NOTICE.txt), prepared offline into an outline
   (joined into one shape with a cream wax rim) and a face printed on cream (emoji/<key>.jpg).
   deps: makeWaxMaterial(hex), NUM (the number candles' depth, bevel) */
(function () {
  function create(deps) {
    var E = window.CakeEmoji || {}, geoCache = {}, texCache = {};
    var TONES = ['1f3fb', '1f3fc', '1f3fd', '1f3fe', '1f3ff'];
    // Outlines load once, only when needed (v1.24). ensure(cb) calls back when they're in.
    var waiting = [], loading = false;
    function ready() { return !!window.CakeEmojiOutlines; }
    function ensure(cb) {
      if (ready()) { if (cb) cb(); return; }
      if (cb) waiting.push(cb);
      if (loading) return; loading = true;
      var sc = document.createElement('script'); sc.src = 'emoji/outlines.js?v=' + (window.CAKE_VERSION || '');
      sc.onload = function () { var w = waiting; waiting = []; w.forEach(function (f) { try { f(); } catch (e) {} }); };
      document.head.appendChild(sc);
    }
    // A skin-toned emoji we haven't prepared falls back to its default-toned self.
    function resolve(k) {
      if (E[k]) return k;
      var bare = k.split('-').filter(function (h) { return TONES.indexOf(h) < 0; }).join('-');
      return E[bare] ? bare : null;
    }
    function keyOf(grapheme) {                      // code points without FE0F, lower-case hex, '-'-joined
      var cps = []; for (var ch of grapheme) { var cp = ch.codePointAt(0); if (cp !== 0xFE0F) cps.push(cp.toString(16)); }
      return cps.join('-');
    }
    function graphemes(text) {
      if (window.Intl && Intl.Segmenter) { var out = []; for (var s of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) out.push(s.segment); return out; }
      return Array.from(text);                      // older browsers: fine for single-code-point emojis
    }
    // Text from the phone's own emoji keyboard → the emojis we have, in order, and the ones we don't.
    function parse(text) {
      var keys = [], unknown = [];
      graphemes(String(text || '')).forEach(function (g) {
        if (!g.trim()) return;
        var k = resolve(keyOf(g));
        if (k) keys.push(k); else unknown.push(g);
      });
      return { keys: keys, unknown: unknown };
    }
    // One sprite sheet holds every emoji's face (emoji/sheet.jpg): one download for the whole set,
    // and one file to upload. Each topper uses its own cell by offsetting the shared texture —
    // so a cake with three emojis still costs one image.
    var sheetTex = null;
    function sheet() {
      if (sheetTex) return sheetTex;
      sheetTex = new THREE.TextureLoader().load('emoji/sheet.jpg?v=' + (window.CAKE_VERSION || ''), function (t) {
        (t.__pending || []).forEach(function (c) { c.image = t.image; c.needsUpdate = true; });   // the clones made while it loaded
        t.__pending = null;
      });
      sheetTex.encoding = THREE.sRGBEncoding; sheetTex.anisotropy = 8;
      sheetTex.generateMipmaps = false; sheetTex.minFilter = THREE.LinearFilter;   // no mipmaps: they'd bleed between cells
      sheetTex.wrapS = sheetTex.wrapT = THREE.ClampToEdgeWrapping;
      return CakeResources.keep(sheetTex);
    }
    function texture(key) {
      if (texCache[key]) return texCache[key];
      var S = window.CakeEmojiSheet, o = window.CakeEmojiOutlines && window.CakeEmojiOutlines[key];
      if (!S || !o) return sheet();
      var base = sheet(), t = base.clone();          // its own offset; the image itself is shared
      if (base.image) t.needsUpdate = true;          // the sheet may still be loading: mark it when it arrives
      else base.__pending = (base.__pending || []).concat(t);
      var inset = 0.5 / S.cell;                     // half a pixel in, so no neighbouring cell shows at the edge
      t.repeat.set(1 / S.cols - 2 * inset, 1 / S.rows - 2 * inset);
      t.offset.set((o.i % S.cols) / S.cols + inset, 1 - Math.floor(o.i / S.cols + 1) / S.rows + inset);
      return (texCache[key] = CakeResources.keep(t));
    }
    // An emoji as a candle: its outline extruded to the number candles' depth and bevel, the face
    // printed on the front (and mirrored on the back, so it reads the right way round from behind);
    // the sides and rim sample the cream corner of the face image.
    function part(key, H) {
      var gk = key + '@' + H.toFixed(3);
      if (geoCache[gk]) return geoCache[gk];
      var e = window.CakeEmojiOutlines && window.CakeEmojiOutlines[key]; if (!e) return null;
      var sh = new THREE.Shape();
      e.p.forEach(function (p, i) { if (i === 0) sh.moveTo(p[0], p[1]); else sh.lineTo(p[0], p[1]); });
      var s = H, NUM = deps.NUM, bev = NUM.bevel;
      var geo = new THREE.ExtrudeGeometry(sh, { depth: (NUM.depth - 2 * bev) / s, bevelEnabled: true, bevelThickness: bev / s, bevelSize: bev / s * 0.8, bevelSegments: 5, curveSegments: 4 });
      geo.scale(s, s, s); geo.computeBoundingBox();
      var bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cy0 = bb.min.y, cz = (bb.min.z + bb.max.z) / 2;
      geo.translate(-cx, -cy0, -cz); geo.computeBoundingBox(); bb = geo.boundingBox; geo.computeVertexNormals();
      var pos = geo.attributes.position, uv = geo.attributes.uv, nrm = geo.attributes.normal, top = { x: 0, y: -1e9 }, lows = [];
      var centre = e.w === 'centre', w2 = bb.max.x - bb.min.x;
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (Math.abs(nrm.getZ(i)) > 0.5) { var u = (x + cx) / s, v = (y + cy0) / s; uv.setXY(i, z < 0 ? 1 - u : u, v); }
        else uv.setXY(i, 0.01, 0.01);                               // sides: the cream corner
        if (y > top.y && (!centre || Math.abs(x) < w2 * 0.08)) top = { x: x, y: y };
        if (y < bb.min.y + 0.03) lows.push(x);
      }
      uv.needsUpdate = true;
      geo.setAttribute('aLit', new THREE.Float32BufferAttribute(new Float32Array(pos.count).fill(1), 1));   // the wax shader's glow switch
      CakeResources.keep(geo);
      return (geoCache[gk] = { geo: geo, width: w2, top: top, foot: lows.length ? lows.reduce(function (a, b) { return a + b; }, 0) / lows.length : 0,
        material: function () { var m = deps.makeWaxMaterial(0xffffff); m.map = texture(key); return m; } });
    }
    return { parse: parse, part: part, ready: ready, ensure: ensure, available: function (k) { return !!E[k]; }, count: function () { return Object.keys(E).filter(function (k) { return !TONES.some(function (t) { return k.indexOf(t) >= 0; }); }).length; }, texture: texture, keyOf: keyOf };
  }
  window.CakeToppers = { create: create };
})();

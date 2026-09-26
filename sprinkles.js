/* sprinkles.js — hundreds and thousands (v1.10, refactor step 5).
   create(deps) → { place(cfg, tiers), forSlice(tier, i, n), updateLights(), keys() }
   deps: renderer, camera, lights {key, fill, ambient, candle, spark}, tierTops(cfg),
         tierGroups(), messageBodyH(), messageSpan(), clampInt
   Balls are placed on the tier's REAL surface (random triangles by area), pushed in by their own
   amount, drawn as sphere impostors (one point each, real depth), lit by the scene's lights
   mirrored into their shader each frame. Each ball belongs to one tier and one angle, so a cut
   slice keeps exactly the ones that were on it (forSlice). */
(function () {
  var SPR_VS = CakeShaders.sprinkles.vertex, SPR_FS = CakeShaders.sprinkles.fragment;
  function tierKey(tier) { return (tier.y0 || 0).toFixed(3); }
  function create(deps) {
    // ---- Hundreds and thousands (v1.00) ----
    // A topping, not an icing: it goes over whatever finish each tier has. Balls are placed on the
    // cake's REAL surface — random triangles of the tier's actual meshes, by area — so they cover
    // the top, the rounded edge and the sides evenly. Each is pushed in by its own amount, from half
    // buried to barely touching, is its own size and colour, and belongs to one tier and one angle,
    // so a cut slice keeps exactly the ones that were on it.
    // They're drawn as SPHERE IMPOSTORS: one point each, which the shader paints as a lit ball and
    // gives the depth a real ball would have (so sunk balls look sunk). A fully covered cake is
    // ~90,000 balls — as real geometry that's millions of triangles; as points it's cheap.
    var SPR = { min: 700, max: 90000, refArea: 41, palettes: [
      [0xFF4F8B, 0xFFD23F, 0x3FA7FF, 0x4CD07D, 0xFF8A3D, 0x9B6BFF, 0xFFFFFF],   // rainbow
      [0xF7B6CC, 0xFBE7A1, 0xB5DAF7, 0xBFE8C9, 0xD9C6F5, 0xFFFFFF],             // pastel
      [0xD8B25A, 0xE6C77A, 0xC9A04A, 0xF1DDA0]                                  // gold
    ] };
    var sprinkleSets = {};                                 // by tier (keyed by its base height), for the slices
    var sprinkleMat = null, sprinkleLights = null;
    function prng(seed) { var a = seed | 0; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    // v1.33, for the dropper: a sprinkle's colour is stored converted for the shader, so find which
    // palette colour it is and give that back exactly.
    function colourAt(pts, i, cfg) {
      var a = pts && pts.geometry && pts.geometry.attributes.aColor; if (!a || i == null || i >= a.count) return null;
      var pal = SPR.palettes[deps.clampInt(cfg.spal, 0, SPR.palettes.length - 1, 0)], best = null, bd = Infinity;
      pal.forEach(function (h) {
        var c = new THREE.Color(h).convertSRGBToLinear(), d = Math.pow(c.r - a.getX(i), 2) + Math.pow(c.g - a.getY(i), 2) + Math.pow(c.b - a.getZ(i), 2);
        if (d < bd) { bd = d; best = h; }
      });
      return best;
    }
    function getSprinkleMaterial() {
      if (sprinkleMat) return sprinkleMat;
      sprinkleMat = new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 1000 }, uKeyDir: { value: new THREE.Vector3(0, 1, 0) }, uKeyCol: { value: new THREE.Color(1, 1, 1) },
          uSky: { value: new THREE.Color() }, uGround: { value: new THREE.Color() }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uFillDir: { value: new THREE.Vector3(0, 0, 1) }, uFillCol: { value: new THREE.Color(0, 0, 0) },
          uP1Pos: { value: new THREE.Vector3() }, uP1Col: { value: new THREE.Color(0, 0, 0) }, uP1Cut: { value: 0 },
          uP2Pos: { value: new THREE.Vector3() }, uP2Col: { value: new THREE.Color(0, 0, 0) }, uP2Cut: { value: 0 } },
        vertexShader: SPR_VS, fragmentShader: SPR_FS, extensions: { fragDepth: true }
      });
      CakeResources.keep(sprinkleMat);
      return sprinkleMat;
    }
    var _sv3 = new THREE.Vector3(), _sBuf = new THREE.Vector2();
    function updateSprinkleLights() {                     // mirror the scene's lights in the balls' own shader, each frame
      if (!sprinkleMat) return;
      var camera = deps.camera, renderer = deps.renderer, key = deps.lights.key, fill = deps.lights.fill, ambientLight = deps.lights.ambient, candleLight = deps.lights.candle, sparkLight = deps.lights.spark;
      var U = sprinkleMat.uniforms, V = camera.matrixWorldInverse;
      renderer.getDrawingBufferSize(_sBuf);
      U.uScale.value = _sBuf.y * camera.projectionMatrix.elements[5];
      _sv3.copy(key.position).sub(key.target.position).normalize().transformDirection(V); U.uKeyDir.value.copy(_sv3);
      U.uKeyCol.value.copy(key.color).multiplyScalar(key.intensity);
      U.uUp.value.set(0, 1, 0).transformDirection(V);
      _sv3.copy(fill.position).sub(fill.target.position).normalize().transformDirection(V); U.uFillDir.value.copy(_sv3); U.uFillCol.value.copy(fill.color).multiplyScalar(fill.visible ? fill.intensity : 0);
      if (ambientLight.isHemisphereLight) { U.uSky.value.copy(ambientLight.color).multiplyScalar(ambientLight.intensity); U.uGround.value.copy(ambientLight.groundColor).multiplyScalar(ambientLight.intensity); }
      else { U.uSky.value.copy(ambientLight.color).multiplyScalar(ambientLight.intensity); U.uGround.value.copy(U.uSky.value); }
      U.uP1Pos.value.copy(candleLight.position).applyMatrix4(V); U.uP1Col.value.copy(candleLight.color).multiplyScalar(candleLight.intensity); U.uP1Cut.value = candleLight.distance;
      U.uP2Pos.value.copy(sparkLight.position).applyMatrix4(V); U.uP2Col.value.copy(sparkLight.color).multiplyScalar(sparkLight.intensity); U.uP2Cut.value = sparkLight.distance;
    }
    // What a tier's sprinkles may land on (v1.28): they stick to icing, never bare sponge or filling.
    // Fondant: all of it. A semi-naked scrape: only its frosted top. A naked tier: nothing.
    function coverOf(cfg, i) {
      if (cfg.fds ? cfg.fds[i] : cfg.fd) return 'all';
      if ((cfg.frsty ? cfg.frsty[i] : cfg.fr) === 4) return 'top';
      return 'none';
    }
    function placeSprinkles(cfg, tiers) {
      sprinkleSets = {};
      var amt = cfg.sa | 0; if (!amt) return;
      var perRef = SPR.min * Math.pow(SPR.max / SPR.min, (amt - 1) / 9);
      var pal = SPR.palettes[deps.clampInt(cfg.spal, 0, SPR.palettes.length - 1, 0)].map(function (h) { return new THREE.Color(h).convertSRGBToLinear(); });
      var rnd = prng((cfg.sr | 0) * 7919 + (cfg.sd | 0) * 31 + 13);
      var span = deps.messageSpan(), canon = deps.tierTops(cfg);   // the canonical tier objects (with their base heights), as the slices see them
      tiers.forEach(function (tier, i) {
        var ct = canon[i] || tier;
        var tg = deps.tierGroups()[i]; if (!tg) return;
        var cover = coverOf(cfg, i); if (cover === 'none') return;
        var bands = [];                                  // the ribbons round this tier: nothing lands under them (v1.28)
        tg.updateMatrixWorld(true);
        var inv = new THREE.Matrix4().copy(tg.matrixWorld).invert();
        var upper = tiers[i + 1], upperR = upper ? (upper.r || 0) + 0.02 : -1;
        // Gather this tier's outer surface as triangles (tier-group coordinates).
        var tris = [], topY = -1e9, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m4 = new THREE.Matrix4();
        tg.traverse(function (o) {
          if (o.userData && o.userData.band) { var bd = o.userData.band; bands.push({ y: o.position.y + bd.y, w: bd.w, tilt: bd.tilt, at: bd.at }); }
          if (!o.isMesh || o.isInstancedMesh || (o.userData && o.userData.noSprinkle) || !o.geometry || !o.geometry.attributes.position) return;
          if (o.material && !Array.isArray(o.material) && o.material.transparent) return;
          m4.multiplyMatrices(inv, o.matrixWorld);
          var pos = o.geometry.attributes.position, idx = o.geometry.index ? o.geometry.index.array : null, n = idx ? idx.length / 3 : pos.count / 3;
          for (var t = 0; t < n; t++) {
            a.fromBufferAttribute(pos, idx ? idx[t * 3] : t * 3).applyMatrix4(m4);
            b.fromBufferAttribute(pos, idx ? idx[t * 3 + 1] : t * 3 + 1).applyMatrix4(m4);
            c.fromBufferAttribute(pos, idx ? idx[t * 3 + 2] : t * 3 + 2).applyMatrix4(m4);
            var nrm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)), area = nrm.length() * 0.5;
            if (area < 1e-9) continue;
            nrm.normalize();
            var cx = (a.x + b.x + c.x) / 3, cz = (a.z + b.z + c.z) / 3;
            if (nrm.x * cx + nrm.z * cz < 0 && Math.abs(nrm.y) < 0.9) nrm.negate();     // outward
            if (nrm.y < -0.3) continue;                                                   // undersides
            if (cover === 'top' && nrm.y <= 0.9) continue;                                // a scrape's sides are mostly sponge
            if (nrm.y > 0.9) topY = Math.max(topY, (a.y + b.y + c.y) / 3);
            tris.push([a.clone(), b.clone(), c.clone(), nrm, area]);
          }
        });
        tris = tris.filter(function (T) { return !(T[3].y > 0.9 && (T[0].y + T[1].y + T[2].y) / 3 < topY - 0.03); });   // no internal layers
        if (!tris.length) return;
        var cdf = [], A = 0; tris.forEach(function (T) { A += T[4]; cdf.push(A); });
        var count = Math.round(perRef * A / SPR.refArea);
        var P = [], Rr = [], Cc = [], Ang = [];
        var msg = (tier === tiers[0] && cfg.m && span) ? span : null, bodyH = deps.messageBodyH();
        for (var k = 0; k < count; k++) {
          var x = rnd() * A, lo = 0, hi = cdf.length - 1; while (lo < hi) { var mid = (lo + hi) >> 1; if (cdf[mid] < x) lo = mid + 1; else hi = mid; }
          var T = tris[lo], u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
          var px = T[0].x + (T[1].x - T[0].x) * u + (T[2].x - T[0].x) * v, py = T[0].y + (T[1].y - T[0].y) * u + (T[2].y - T[0].y) * v, pz = T[0].z + (T[1].z - T[0].z) * u + (T[2].z - T[0].z) * v;
          var nn = T[3], rr = Math.sqrt(px * px + pz * pz), ang = Math.atan2(px, pz); if (ang < 0) ang += Math.PI * 2;
          if (nn.y > 0.9 && rr < upperR) continue;                                        // under the tier above
          if (bands.length && Math.abs(nn.y) < 0.6) {                                      // under a ribbon: it would poke through
            var under = false;
            for (var bi = 0; bi < bands.length && !under; bi++) {
              var Bd = bands[bi], b0 = Bd.y + Bd.tilt * Math.cos(ang - Bd.at);             // the band follows its hand-tied tilt
              under = py > b0 - 0.04 && py < b0 + Bd.w + 0.04;
            }
            if (under) continue;
          }
          if (msg && Math.abs(nn.y) < 0.6) {                                               // keep the writing clear
            var dAng = Math.min(ang, Math.PI * 2 - ang), yRel = (py - (ct.y0 || 0)) / bodyH;
            if (dAng < msg.w * Math.PI + 0.12 && Math.abs(yRel - 0.5) < msg.h / 2 + 0.06) continue;
          }
          var s2 = 0.014 + 0.011 * Math.pow(rnd(), 1.3), e = 0.15 + 0.45 * rnd(), off = s2 * (1 - 2 * e);
          P.push(px + nn.x * off, py + nn.y * off, pz + nn.z * off); Rr.push(s2);
          var col = pal[Math.floor(rnd() * pal.length)], j = 0.9 + 0.1 * rnd(); Cc.push(col.r * j, col.g * j, col.b * j);
          Ang.push(ang);
        }
        var set = { pos: new Float32Array(P), rad: new Float32Array(Rr), col: new Float32Array(Cc), ang: new Float32Array(Ang) };
        sprinkleSets[tierKey(ct)] = set;
        tg.add(sprinklePoints(set, 0, Math.PI * 2 + 1));
      });
    }
    function sprinklePoints(set, from, to) {                // the balls between two angles, as one Points object
      var keep = [];
      for (var i = 0; i < set.rad.length; i++) { var a = set.ang[i]; if (a >= from && a < to) keep.push(i); }
      var P = new Float32Array(keep.length * 3), R = new Float32Array(keep.length), C = new Float32Array(keep.length * 3);
      keep.forEach(function (k, j) { P[j * 3] = set.pos[k * 3]; P[j * 3 + 1] = set.pos[k * 3 + 1]; P[j * 3 + 2] = set.pos[k * 3 + 2]; R[j] = set.rad[k]; C[j * 3] = set.col[k * 3]; C[j * 3 + 1] = set.col[k * 3 + 1]; C[j * 3 + 2] = set.col[k * 3 + 2]; });
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aRadius', new THREE.BufferAttribute(R, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(C, 3));
      g.computeBoundingSphere(); if (g.boundingSphere) g.boundingSphere.radius += 0.05;
      var pts = new THREE.Points(g, getSprinkleMaterial());
      pts.userData.noAO = true; pts.userData.noSprinkle = true;
      return pts;
    }

    function forSlice(tier, i, n) {
      var set = sprinkleSets[tierKey(tier)]; if (!set) return null;
      var th0 = i * Math.PI * 2 / n; return sprinklePoints(set, th0, th0 + Math.PI * 2 / n);
    }
    function keys() { return Object.keys(sprinkleSets).map(function (k) { return k + ':' + sprinkleSets[k].rad.length; }); }
    CakeMaterials.warm('sprinkles', function () { return sprinklePoints({ pos: new Float32Array(3), rad: new Float32Array([0.02]), col: new Float32Array(3), ang: new Float32Array([0]) }, 0, 7); });
    return { colourAt: colourAt, place: placeSprinkles, forSlice: forSlice, updateLights: updateSprinkleLights, keys: keys, SPR: SPR };
  }
  window.CakeSprinkles = { create: create, tierKey: tierKey };
})();

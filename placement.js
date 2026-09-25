/* placement.js — putting candles on a cake (v1.20, refactor step 7).
   create(deps) → { layout(n, surfaces), placeCandles(n, surfaces, hex, animateFrom, cs),
                    placeNumberCandles(age, surface, hex), setCandleScale(sp, i, k), updateSpawn(now) }
   layout: where n candles go on the cake's tops, in rings; placeCandles: one instanced set per
   candle style in use, holders, wicks, flames (and their flame records in deps.flames), each
   placed by hand from the seed; placeNumberCandles: the extruded digits, side by side;
   updateSpawn: the candles popping in one by one. The parts come from candles.js (deps.candles).
   deps: candles, flames[], wicks[] (emptied in place per build), D {spawn}, EASE, built(),
         flameMat, flameMesh(phase). */
(function () {
  function create(deps) {
    var K = deps.candles, _m4 = new THREE.Matrix4();   // K, not C: placeCandles already uses C for each candle's params
    function ringsFor(surface, s) {
      // Concentric rings from the outside in. Returns [{ r, cap }].
      var rings = [];
      var r = surface.rMax - s * 0.5;
      while (r >= surface.rMin + s * 0.35) {
        if (surface.rMin === 0 && r <= s * 0.6) { rings.push({ r: 0, cap: 1 }); break; }
        rings.push({ r: r, cap: Math.max(1, Math.floor((2 * Math.PI * r) / s)) });
        r -= s;
      }
      if (!rings.length && surface.rMin === 0) rings.push({ r: 0, cap: 1 });
      return rings;
    }
    function layout(n, surfaces) {
      if (n === 0) return [];
      var top = surfaces[0];
      if (n === 1) return [{ x: 0, z: 0, y: top.y }];
      if (n <= 8) {
        // Small counts: one neat ring, growing with the count.
        var rr = Math.min(top.rMax * 0.6, 0.35 + n * 0.09);
        return ringPoints(n, rr, top.y, 0);
      }
      // Largest spacing that fits n across the surfaces.
      var s = 0.46, plan = null;
      while (s >= 0.2) {
        var total = 0, per = [];
        surfaces.forEach(function (sf) {
          var rings = ringsFor(sf, s);
          per.push(rings);
          rings.forEach(function (rg) { total += rg.cap; });
        });
        if (total >= n) { plan = per; break; }
        s -= 0.02;
      }
      if (!plan) { s = 0.2; plan = surfaces.map(function (sf) { return ringsFor(sf, s); }); }

      // Fill rings outer→inner on the top surface, then the next surface.
      var pts = [], left = n;
      for (var i = 0; i < surfaces.length && left > 0; i++) {
        var rings = plan[i];
        for (var k = 0; k < rings.length && left > 0; k++) {
          var take = Math.min(rings[k].cap, left);
          pts = pts.concat(ringPoints(take, rings[k].r, surfaces[i].y, k * 0.37));
          left -= take;
        }
      }
      return pts;
    }
    function ringPoints(count, r, y, phase) {
      var out = [];
      for (var i = 0; i < count; i++) {
        var a = phase + (i / count) * Math.PI * 2;
        out.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, y: y });
      }
      return out;
    }
    function placeNumberCandles(age, surface, candleHex) {
      if (!surface || !window.CakeDigits) return;
      var chars = age.replace(/[^0-9]/g, '').slice(0, 2).split('');
      if (!chars.length) return;
      var H = K.NUM.height * Math.max(0.7, Math.min(1, surface.rMax / 1.95));   // smaller on a smaller top tier
      var parts = chars.map(function (ch) { return K.digitGeometry(ch, H); }).filter(Boolean);
      var total = parts.reduce(function (w, p) { return w + p.width; }, 0) + K.NUM.spacing * (parts.length - 1);
      var x = -total / 2, fs = 0.28;
      parts.forEach(function (P, i) {
        var sd = window.CakeFrosting ? CakeFrosting.seedOf() : 0;
        function h(k) { var n = Math.sin((i + 3) * 127.1 + k * 311.7 + sd * 74.7) * 43758.5453; return n - Math.floor(n); }
        var cx = x + P.width / 2; x += P.width + K.NUM.spacing;
        var grp = new THREE.Group();
        grp.position.set(cx, surface.y + K.NUM.gap, (h(1) - 0.5) * 0.08);
        grp.rotation.set((h(2) - 0.5) * 0.06, (h(3) - 0.5) * 0.12, (h(4) - 0.5) * 0.05);   // placed by hand
        var mat = K.makeWaxMaterial(candleHex);
        mat.emissiveIntensity = 1.1 * K.NUM.glow;            // thick wax: a gentler glow than the thin candles'
        grp.add(new THREE.Mesh(P.geo, mat));
        var spike = new THREE.Mesh(K.numberSpikeGeo, K.holderMat);
        spike.position.set(P.foot, -(K.NUM.gap + 0.06) / 2 + 0.01, 0);
        grp.add(spike);
        var wick = new THREE.Mesh(K.wickGeo, K.wickMat);
        wick.position.set(P.top.x, P.top.y + 0.02, 0);
        grp.add(wick);
        deps.built().add(grp);
        grp.updateMatrixWorld(true);
        var fp = new THREE.Vector3(P.top.x, P.top.y + 0.18, 0).applyMatrix4(grp.matrix);
        var flame = new THREE.Sprite(deps.flameMat.clone());
        CakeResources.own(flame.material); flame.material.visible = false;
        flame.scale.set(fs * 0.7, fs, 1);
        flame.position.copy(fp);
        deps.built().add(flame);
        var halo = null;
        if (false) {                                         // flat halos retired (v0.96)
          halo = new THREE.Sprite(CakeLook.haloMaterial());
          halo.scale.set(fs * CakeLook.LOOK.halo.scale, fs * CakeLook.LOOK.halo.scale, 1);
          halo.position.copy(fp); halo.renderOrder = -1; deps.built().add(halo);
        }
        deps.wicks.push(wick);
        var fm = deps.flameMesh(i * 2.3 + 0.9); deps.built().add(fm);
        deps.flames.push({ sprite: flame, halo: halo, base: fs, phase: ((i * 0.618) % 1) * Math.PI * 2, x: fp.x, z: fp.z,
                      k: 1, lit: 1, y: fp.y, leanX: 0, leanZ: 0, mat: mat, glowBase: mat.emissiveIntensity, mesh: fm, root: 0.15 });
      });
    }
    function placeCandles(n, surfaces, candleHex, animateFrom, cs) {
      var pts = layout(n, surfaces);
      if (!pts.length) return;
      if (animateFrom === undefined) animateFrom = Infinity;

      // Thinner, shorter candles when they're packed tight.
      var dense = n > 60;
      var radius = dense ? 0.05 : 0.065;
      var height = dense ? 0.52 : 0.62;                   // v0.90: ~23% taller than before
      var fs = dense ? 0.22 : 0.28;
      // Each candle stands in its holder: lifted by the spike showing, and the cup's floor.
      var lift = K.HOLDER.gap + radius * K.HOLDER.cupH * K.HOLDER.floor * 0.5;

      // One instanced mesh per style in use; each candle knows its set and its slot in it.
      cs = cs | 0;
      var styleOf = pts.map(function (p, i) { return K.candleStyleOf(cs, i); });
      var sets = {};
      styleOf.forEach(function (st) { sets[st] = sets[st] || { count: 0 }; sets[st].count++; });
      Object.keys(sets).forEach(function (k) {
        var st = +k, S = sets[k];
        var g = K.STYLE_GEO[st].clone();                     // its own copy: it carries this set's per-candle glow
        S.lit = new THREE.InstancedBufferAttribute(new Float32Array(S.count).fill(1), 1);
        g.setAttribute('aLit', S.lit);
        S.mesh = new THREE.InstancedMesh(g, K.styleMaterial(st, candleHex), S.count);
        S.next = 0;
      });
      var holders = new THREE.InstancedMesh(K.holderGeo(radius), K.holderMat, pts.length);
      var m = new THREE.Matrix4();
      var col = new THREE.Color();
      var hsl = { h: 0, s: 0, l: 0 };
      new THREE.Color(candleHex).getHSL(hsl);

      var flameBase = deps.flames.length;
      var params = [];
      pts.forEach(function (p, i) {
        var C = K.candleHand(i, height);
        var st = styleOf[i], S = sets[st];
        C.h *= K.STYLE_HEIGHT[st]; C.set = S; C.j = S.next++;
        params.push(C);
        K.composeCandle(m, p, C, radius, lift, 1);
        S.mesh.setMatrixAt(C.j, m);
        var bodies = S.mesh, litAttr = S.lit;
        var plainColour = st === 2 || st === 3 || st === 4 || st === 5;   // patterned and metal: the colour lives in the material
        K.composeHolder(m, p, C, i);
        holders.setMatrixAt(i, m);
        if (bodies.setColorAt) {
          // Quality control: each candle a touch off its nominal colour — hue, saturation and
          // lightness — seeded, so the recipient sees the same box of candles. Pale yellows drift
          // towards green quickly, so their hue is kept on a tighter leash.
          var yellow = hsl.h > 0.1 && hsl.h < 0.2;
          if (plainColour) col.setHSL(0, 0, Math.max(0, Math.min(1, 0.97 + (C.c3 - 0.5) * 0.05)));
          else col.setHSL((hsl.h + (C.c1 - 0.5) * 0.035 * (yellow ? 0.35 : 1) + 1) % 1,
                     Math.max(0, Math.min(1, hsl.s + (C.c2 - 0.5) * 0.14)),
                     Math.max(0, Math.min(1, hsl.l + (C.c3 - 0.5) * 0.07)));
          bodies.setColorAt(C.j, col);
        }

        var wick = new THREE.Mesh(K.wickGeo, K.wickMat);
        var top = K.candleTop(p, C, lift, 1);                 // where this candle's top really is: leaning, burned down
        wick.position.set(top.x, top.y + 0.03, top.z);
        wick.quaternion.copy(C.q);
        deps.built().add(wick);
        deps.wicks.push(wick);

        var flame = new THREE.Sprite(deps.flameMat.clone());   // an invisible anchor now (v0.96): the flame is a 3D mesh
        CakeResources.own(flame.material); flame.material.visible = false;
        flame.scale.set(fs * 0.7, fs, 1);
        flame.position.set(top.x, top.y + 0.16, top.z);    // flames stay upright while the candle leans
        deps.built().add(flame);
        // The halo: same pivot, follows the flame in the update loop. Skipped on every other
        // candle past the budget so 100 candles is still 150 sprites, not 200.
        var halo = null;
        if (false) {                                         // flat halos retired (v0.96): the 3D flame carries its own
          halo = new THREE.Sprite(CakeLook.haloMaterial());
          halo.scale.set(fs * CakeLook.LOOK.halo.scale, fs * CakeLook.LOOK.halo.scale, 1);
          halo.position.copy(flame.position);
          halo.renderOrder = -1;                           // behind the core
          deps.built().add(halo);
        }
        var fm = deps.flameMesh(((i * 0.618) % 1) * Math.PI * 2 + i * 1.7); deps.built().add(fm);
        deps.flames.push({ sprite: flame, halo: halo, base: fs, phase: ((i * 0.618) % 1) * Math.PI * 2, x: top.x, z: top.z,
                      k: 1, lit: 1, y: top.y + 0.16, leanX: 0, leanZ: 0, glow: litAttr, gi: C.j, mesh: fm, root: 0.13 });
      });
      Object.keys(sets).forEach(function (k) {
        var M = sets[k].mesh;
        M.instanceMatrix.needsUpdate = true;
        if (M.instanceColor) M.instanceColor.needsUpdate = true;
        deps.built().add(M);
      });
      holders.instanceMatrix.needsUpdate = true;
      deps.built().add(holders);

      // Pop-in for new candles: outer ring first, staggered, capped at ~1.2s total.
      if (animateFrom < pts.length) {
        var count = pts.length - animateFrom;
        var stagger = Math.min(12, 1200 / Math.max(1, count));
        deps.D.spawn = { bodies: null, pts: pts, radius: radius, height: height, lift: lift, params: params, from: animateFrom,
                  stagger: stagger, start: performance.now(), done: false };
        // Hide new ones immediately
        for (var i = animateFrom; i < pts.length; i++) {
          setCandleScale(deps.D.spawn, i, 0);
        }
      }
    }
    function setCandleScale(sp, i, k) {
      var p = sp.pts[i], C = sp.params[i], m = _m4;
      K.composeCandle(m, p, C, sp.radius, sp.lift || 0, Math.max(0.001, k));
      C.set.mesh.setMatrixAt(C.j, m); C.set.mesh.instanceMatrix.needsUpdate = true;
      var f = deps.flames[i];
      if (f) { f.k = k; f.sprite.visible = k > 0.05; }
      var w = deps.wicks[i];
      if (w) { var tp = K.candleTop(p, C, sp.lift || 0, k); w.visible = k > 0.5; w.position.set(tp.x, tp.y + 0.03, tp.z); }
    }
    function updateSpawn(now) {
      if (!deps.D.spawn || deps.D.spawn.done) return;
      var sp = deps.D.spawn, allDone = true;
      for (var i = sp.from; i < sp.pts.length; i++) {
        var t = (now - sp.start - (i - sp.from) * sp.stagger) / 160;
        if (t < 0) { allDone = false; continue; }
        if (t < 1) allDone = false;
        setCandleScale(sp, i, deps.EASE.pop(Math.min(1, t)));
      }
      if (allDone) sp.done = true;                         // (each style's mesh is flagged in setCandleScale)
    }
    return { layout: layout, placeCandles: placeCandles, placeNumberCandles: placeNumberCandles, setCandleScale: setCandleScale, updateSpawn: updateSpawn };
  }
  window.CakePlacement = { create: create };
})();

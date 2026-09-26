/* placement.js — putting candles and toppers on a cake (v1.20; front-first and footprints v1.28).
   create(deps) → { layout(n, surfaces, opts), placeCandles(n, surfaces, hex, animateFrom, cs, opts) → how many placed,
                    placeToppers(T, surface, hex) → the row's footprint, placeNumberCandles(age, surface, hex),
                    setCandleScale(sp, i, k), updateSpawn(now), last() → { wanted, placed } }
   Without toppers, candles take the familiar arrangement: one in the middle, a neat ring for a
   few, even rings for many. With toppers (v1.28) they go FRONT FIRST: spots round the rings,
   outer ring first, nearest the front (θ = 0, where the builder opens and the recipient's view
   lands) first, filled symmetrically — an odd count puts one dead centre, the rest go in mirrored
   pairs — so candles stand in front of the toppers and only go behind when there are lots.
   FOOTPRINTS (v1.28): whatever already stands on the top — the topper row, the sparklers — is
   passed in as opts.blocks, and a spot closer to one than a candle needs (its holder, its lean,
   its flame) is skipped. Spacing tightens until they fit; the rest spill to the tier below; if
   even that runs out, fewer are placed and last() says how many.
   The parts come from candles.js (deps.candles).
   deps: candles, flames[], wicks[] (emptied in place per build), D {spawn}, EASE, built(),
         flameMat, flameMesh(phase), toppers. */
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
    // ---- v1.28: footprints and front-first ----
    var TWO_PI = Math.PI * 2;
    var PAD = 0.17;                                     // a candle's clearance from anything: its holder, its lean, its flame
    var lastInfo = { wanted: 0, placed: 0 };
    // A spot is clear when it's at least PAD from every block: a circle { x, z, r } (a sparkler) or
    // a rectangle { x0, x1, z0, z1 } (the topper row).
    function clearOf(p, blocks) {
      for (var i = 0; blocks && i < blocks.length; i++) {
        var b = blocks[i], d = (b.r !== undefined)
          ? Math.hypot(p.x - b.x, p.z - b.z) - b.r
          : Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1));
        if (d < PAD) return false;
      }
      return true;
    }
    function frontDist(a) { a = ((a % TWO_PI) + TWO_PI) % TWO_PI; return Math.round(Math.min(a, TWO_PI - a) * 1e6) / 1e6; }
    // Every clear spot on one surface at spacing s, ring by ring from the outside in. Each ring comes
    // two ways — with a spot dead centre at the front, or with a pair straddling it — nearest the front first.
    function slotsFor(sf, s, blocks) {
      return ringsFor(sf, s).map(function (rg) {
        function variant(off) {
          var out = [];
          for (var k = 0; k < rg.cap; k++) {
            var a = rg.r === 0 ? 0 : (k + off) / rg.cap * TWO_PI;
            var p = { x: Math.sin(a) * rg.r, z: Math.cos(a) * rg.r, y: sf.y, f: frontDist(a) };
            if (clearOf(p, blocks)) out.push(p);
          }
          return out.sort(function (p, q) { return (p.f - q.f) || (p.x - q.x); });
        }
        var A = variant(0);
        return { aligned: A, half: rg.cap > 1 ? variant(0.5) : A };
      });
    }
    // An odd number from a ring: the centre spot and pairs. An even number: pairs only. Symmetric
    // either way, unless something in the way makes that impossible.
    function takeFrom(rg, want) {
      var A = rg.aligned, H = rg.half;
      if (want >= Math.max(A.length, H.length)) return A.length >= H.length ? A : H;
      var pref = (want % 2) ? A : H, other = (pref === A) ? H : A;
      return (pref.length >= want ? pref : other).slice(0, want);
    }
    function frontFirst(n, surfaces, blocks) {
      var plan = null;
      for (var s = 0.46; s >= 0.2 - 1e-9; s -= 0.02) {          // the largest spacing that fits them all
        plan = surfaces.map(function (sf, i) { return slotsFor(sf, s, i === 0 ? blocks : null); });
        var total = 0;
        plan.forEach(function (rings) { rings.forEach(function (rg) { total += Math.max(rg.aligned.length, rg.half.length); }); });
        if (total >= n) break;
      }
      var pts = [], left = n;                                    // top tier first, outer ring first; then the tier below
      plan.forEach(function (rings) { rings.forEach(function (rg) {
        if (left <= 0) return;
        var got = takeFrom(rg, left); pts = pts.concat(got); left -= got.length;
      }); });
      return pts;
    }
    // The arrangement for a cake with no toppers (unchanged from before v1.28). `phase` turns it,
    // to step a ring round a sparkler.
    function neat(n, surfaces, phase) {
      var top = surfaces[0];
      if (n === 1) return [{ x: 0, z: 0, y: top.y }];
      if (n <= 8) return ringPoints(n, Math.min(top.rMax * 0.6, 0.35 + n * 0.09), top.y, phase);
      var s = 0.46, plan = null;
      while (s >= 0.2) {
        var total = 0, per = [];
        surfaces.forEach(function (sf) { var rings = ringsFor(sf, s); per.push(rings); rings.forEach(function (rg) { total += rg.cap; }); });
        if (total >= n) { plan = per; break; }
        s -= 0.02;
      }
      if (!plan) { s = 0.2; plan = surfaces.map(function (sf) { return ringsFor(sf, s); }); }
      var pts = [], left = n;
      for (var i = 0; i < surfaces.length && left > 0; i++) {
        var rings = plan[i];
        for (var k = 0; k < rings.length && left > 0; k++) {
          var take = Math.min(rings[k].cap, left);
          pts = pts.concat(ringPoints(take, rings[k].r, surfaces[i].y, k * 0.37 + phase));
          left -= take;
        }
      }
      return pts;
    }
    function layout(n, surfaces, opts) {
      opts = opts || {};
      var blocks = opts.blocks || [], top = surfaces[0], pts = null;
      lastInfo = { wanted: n, placed: 0 };
      if (!n || !top) return [];
      if (!opts.toppers) {
        var tries = (n > 1 && n <= 8) ? 12 : 1;
        for (var t = 0; t < tries && !pts; t++) {
          var cand = neat(n, surfaces, t * TWO_PI / n / tries);
          if (cand.every(function (p) { return p.y !== top.y || clearOf(p, blocks); })) pts = cand;
        }
      }
      if (!pts) pts = frontFirst(n, surfaces, blocks);
      lastInfo.placed = pts.length;
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
    function placeNumberCandles(age, surface, candleHex) {   // (kept for older callers) the number alone, as toppers
      placeToppers({ digits: String(age), emojis: [] }, surface, candleHex);
    }
    // v1.22: toppers — a row on the top tier: the number's digits first, then the emojis. Digits
    // wear the candle colour; emojis their own printed face on cream wax. They face the front (+z),
    // where the builder opens and the recipient's view lands. Returns the row's FOOTPRINT (v1.28)
    // so the candles keep clear of it.
    var ROW_D = 0.23;                                   // half the row's depth: the wax, its hand-placed jitter and lean
    // v1.29: a topper's height is a set share of the top tier's width — full size (NUM.height) on the
    // Classic top with fondant (4.84 wide), as before, and in proportion on any other — times the
    // builder's Size slider (T.size, 0.6–1.4). Never shorter than about a candle; and the row must
    // still fit across the top, which wins over both (lastTop.capped says it did).
    var REF_W = 4.84, MIN_H = 0.75;
    var lastTop = { H: 0, capped: false };
    function placeToppers(T, surface, candleHex) {
      lastTop = { H: 0, capped: false };
      if (!surface) return null;
      var chars = String(T.digits || '').replace(/[^0-9]/g, '').slice(0, 2).split('');
      function partsAt(H) {
        var out = [];
        if (window.CakeDigits) chars.forEach(function (ch) { var P = K.digitGeometry(ch, H, T.font | 0); if (P) out.push({ P: P, material: function () { return T.metal ? K.makeMetalMaterial(candleHex, T.envTint) : K.makeWaxMaterial(candleHex); } }); });   // v1.37: wax or metal
        (T.emojis || []).forEach(function (key) { var P = deps.toppers && deps.toppers.part(key, H * 0.92); if (P) out.push({ P: P, material: P.material }); });
        return out.slice(0, 3);
      }
      function widthOf(ps) { return ps.reduce(function (w, q) { return w + q.P.width; }, 0) + K.NUM.spacing * (ps.length - 1); }
      var tierW = 2 * (surface.rMax + 0.25);             // the top tier's own width (its top surface keeps 0.25 from the edge)
      var H = Math.max(MIN_H, K.NUM.height * (tierW / REF_W) * (T.size || 1));
      var parts = partsAt(H);
      if (!parts.length) return null;
      // v1.28: the row must fit across the top with a little rim to spare — shrink it, all together, if not.
      var gaps = K.NUM.spacing * (parts.length - 1), total = widthOf(parts), capped = false;
      var room = 2 * Math.sqrt(Math.max(0, surface.rMax * surface.rMax - ROW_D * ROW_D)) * 0.96;
      if (total > room && total > gaps) { H *= Math.max(0.3, (room - gaps) / (total - gaps)); parts = partsAt(H); total = widthOf(parts); capped = true; }
      lastTop = { H: +H.toFixed(3), capped: capped };
      var x = -total / 2;
      parts.forEach(function (q, i) {
        var P = q.P;
        var sd = window.CakeFrosting ? CakeFrosting.seedOf() : 0;
        function h(k) { var n = Math.sin((i + 3) * 127.1 + k * 311.7 + sd * 74.7) * 43758.5453; return n - Math.floor(n); }
        var cx = x + P.width / 2; x += P.width + K.NUM.spacing;
        var grp = new THREE.Group();
        grp.position.set(cx, surface.y + K.NUM.gap, (h(1) - 0.5) * 0.08);
        grp.rotation.set((h(2) - 0.5) * 0.06, (h(3) - 0.5) * 0.12, (h(4) - 0.5) * 0.05);   // placed by hand
        // v1.23: toppers are decorations in candle wax, not candles — no wick, no flame, and so no
        // glow from within (that glow is the flame's light); blowing out is only for candles.
        var mat = q.material();
        mat.emissiveIntensity = 0;
        grp.add(new THREE.Mesh(P.geo, mat));
        var spike = new THREE.Mesh(K.numberSpikeGeo, K.holderMat);
        spike.position.set(P.foot, -(K.NUM.gap + 0.06) / 2 + 0.01, 0);
        grp.add(spike);
        deps.built().add(grp);
      });
      return { x0: -total / 2 - 0.03, x1: total / 2 + 0.03, z0: -ROW_D, z1: ROW_D };
    }
    function placeCandles(n, surfaces, candleHex, animateFrom, cs, opts) {
      var pts = layout(n, surfaces, opts);
      if (!pts.length) return 0;
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
        // v1.33: a plain candle's colour is carried ONCE — by each candle's own, slightly varied colour
        // (set below) — not by the wax material as well: the two multiplied, so candles came out deeper
        // than their swatch (a pale blue as a strong one). The set colour is kept for the dropper.
        var plain = !(st === 2 || st === 3 || st === 4 || st === 5);
        if (plain) { S.mesh.material.color.setRGB(1, 1, 1); S.mesh.userData.baseHex = candleHex; }
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
      return pts.length;
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
    return { layout: layout, placeCandles: placeCandles, placeNumberCandles: placeNumberCandles, placeToppers: placeToppers, setCandleScale: setCandleScale, updateSpawn: updateSpawn,
             noToppers: function () { lastTop = { H: 0, capped: false }; },   // a build without toppers (v1.29)
             last: function () { return { wanted: lastInfo.wanted, placed: lastInfo.placed, topperH: lastTop.H, topperCapped: lastTop.capped }; }, PAD: PAD };
  }
  window.CakePlacement = { create: create };
})();

/* body.js — a tier's body: its materials, a naked tier's stack, and the wedge a slice is cut
   from (v1.12, refactor step 5).
   create(deps) → { tierMaterials(cfg, tier), buildStack(cfg, tier, TM, sideMat, θ0, len, seg, partial),
                    makeWedgeBody(tier, i, cfg, TM, msgMap), nightGlow(mat, hex, isMessage), pickInk(frostingHex, tc), luminance(hex) }
   tierMaterials: the side, cap and cut-face materials for one tier — naked sponge, frosting, or
   fondant wearing its finish — and the base painter the message band sits on.
   buildStack: a naked tier as sponge discs and fillings (wobbled, crumbed), whole or partial.
   makeWedgeBody: one of WEDGES_PER_TIER wedges: body + cap + cut faces (+ its ribbon).
   deps: PALETTES, clampIndex, hexCss, frostingHasThickness, layerScheme, paintLayers,
         makeCutFaceTexture, spongeOf, ribbons(), glowMats() (the night-glow list app.js eases), constants as getters, INK_DARK/INK_LIGHT. */
(function () {
  function create(deps) {
    function luminance(hex) {
      var c = new THREE.Color(hex);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    }

    function nightGlow(mat, hex, isMessage) {
      if (!window.CakeLook) return;
      var N = CakeLook.LOOK.night;
      mat.emissive = new THREE.Color(hex);
      mat.emissiveIntensity = 0;                        // starts dark; the flames bring it up
      if (isMessage && mat.map) mat.emissiveMap = mat.map;
      deps.glowMats().push({ m: mat, base: isMessage ? N.emissiveMessage : N.emissiveFrosting });
      var gm = deps.glowMats(); if (gm.length > 64) gm.splice(0, gm.length - 64);   // old builds' materials fall away
    }

    function pickInk(frostingHex, tcIndex, custom) {
      if (custom != null) return deps.hexCss(custom);     // v1.31: an exact colour of its own
      var opt = deps.PALETTES.text[deps.clampIndex(tcIndex, deps.PALETTES.text)];
      if (!opt.auto) return deps.hexCss(opt.hex);
      return luminance(frostingHex) > THREE.Color.srgbToLinear(0.42) ? deps.INK_DARK : deps.INK_LIGHT;   // luminance is linear now
    }

    // v1.50: a FILLING'S EDGE on a naked side — one flowing sheet, as in the mock-ups. Creamy: a stiff
    // bead, a little uneven, standing just proud where more was squeezed out. Glossy and Rich: a sheet
    // tucked under the sponge above that sags onto the sponge below in soft waves and a few broad lobes
    // (merged by a smooth union, so the edge is one curve), its lower edge thickened and rounded like
    // poured paint; no drips. Built over the tier's arc (a cut cake's too), then merged with the stack
    // so the sponge's wobble moves it with the sponge.
    function seeded(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function waves(a, s) { return 0.5 + 0.5 * (0.42 * Math.sin(a * 2 + s) + 0.3 * Math.sin(a * 5 + s * 1.7) + 0.18 * Math.sin(a * 11 + s * 2.9) + 0.1 * Math.sin(a * 23 + s * 4.3)); }
    function smaxp(a, b, k) { var h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; }
    function sstep(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
    // v1.51: REACH — where the spread filling stops, round each layer: a few mm short of the edge (the
    // sponges nearly meet there, the filling set back in the gap), flush, or over it; it only bulges and
    // sags where it overhangs. VARY — how unevenly it was spread: each layer's thickness wanders round
    // the cake by ± that share (see unevenStack).
    var SHEET = [ { bead: 0.06, reachA: 0.07, reachBias: 0.02, vary: 0.4 },                                                 // Creamy
                  { skin: 0.024, lip: 0.06, lobes: 6, lw: [0.3, 0.6], ll: 2.4, reachA: 0.085, reachBias: -0.005, vary: 0.5 },  // Glossy
                  { skin: 0.038, lip: 0.05, lobes: 6, lw: [0.3, 0.65], ll: 2.8, reachA: 0.08, reachBias: 0.012, vary: 0.45 } ];  // Rich
    function reachAt(P, ph, sd) { return Math.max(-(CakeShapes.P.groove.inset - 0.006), P.reachA * (waves(ph, sd + 11) * 2 - 1) + P.reachBias); }
    function fillingSheet(r, y0, t, kind, seed, phi0, phiLen, band) {
      var P = SHEET[kind] || SHEET[0], rnd = seeded(seed), y1 = y0 + t, sd = rnd() * 10;
      var cols = Math.max(16, Math.round(phiLen / (Math.PI * 2) * 280)), NS = kind === 0 ? 12 : 22, pos = [], uv = [], idx = [];
      var lobes = [], swells = [];
      if (kind === 0) for (var b = 0; b < 5; b++) swells.push({ a: rnd() * Math.PI * 2, w: 0.22 + rnd() * 0.35, h: 0.12 + rnd() * 0.28 });
      else for (b = 0; b < P.lobes; b++) { var w = P.lw[0] + rnd() * (P.lw[1] - P.lw[0]); lobes.push({ a: rnd() * Math.PI * 2, w: w, L: P.lip * (1.6 + rnd() * P.ll) }); }
      var D = [];
      for (var i = 0; i <= cols; i++) {
        var ph = phi0 + phiLen * i / cols, d = kind === 0 ? 0 : P.lip * (0.3 + 0.9 * waves(ph, sd));
        lobes.forEach(function (q) { var u = Math.atan2(Math.sin(ph - q.a), Math.cos(ph - q.a)) * r;
          if (Math.abs(u) < q.w) { var c = Math.sqrt(1 - Math.pow(u / q.w, 2)); d = smaxp(d, q.L > q.w ? (q.L - q.w) + q.w * c : q.L * c, 0.04); } });
        D.push(d * sstep(-0.005, 0.06, reachAt(P, ph, sd)));   // it only sags where it overhangs
      }
      for (i = 1; i < cols; i++) D[i] = D[i] * 0.5 + (D[i - 1] + D[i + 1]) * 0.25;
      for (i = 0; i <= cols; i++) {
        var ph2 = phi0 + phiLen * i / cols, sx = Math.sin(ph2), cz = Math.cos(ph2), yb = y0 - D[i], rc = reachAt(P, ph2, sd), over = sstep(-0.005, 0.05, rc);
        var sw = 0; swells.forEach(function (q) { var x = Math.atan2(Math.sin(ph2 - q.a), Math.cos(ph2 - q.a)) / q.w; sw += q.h * Math.exp(-x * x); });
        var A = kind === 0 ? P.bead * Math.max(0.08, 0.45 + 0.28 * 1.5 * (waves(ph2, sd) * 2 - 1) + sw) : 0, shift = 0.22 * (waves(ph2, sd + 5) * 2 - 1);
        var tk = kind === 0 ? 0 : P.skin * (0.8 + 0.4 * waves(ph2, sd + 3)) * over;
        if (kind === 0) A *= over;
        for (var k = 0; k <= NS; k++) {
          var sv = kind === 0 ? k / NS : 1 - Math.pow(1 - k / NS, 1.7), y = y1 + (yb - y1) * sv, th = 0;
          if (k > 0 && k < NS) {
            if (kind === 0) { var v = 1 - sv; th = A * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, v + shift * Math.sin(Math.PI * v))))), 0.45); }
            else {
              var span = y1 - yb, s = (y1 - y) / span, rH = tk * 2.2, e = y - yb;
              th = tk * sstep(0, Math.min(0.5, 0.06 / span), s);                        // tucked in under the sponge above
              if (e < rH) th = tk * 1.35 * Math.sqrt(Math.max(0, 1 - Math.pow((rH - e) / rH, 2)));   // the rounded lower edge
              else th = Math.max(th, tk * (1 + 0.35 * Math.exp(-(e - rH) / (rH * 1.5))));
            }
          }
          if (band) th *= 1 - sstep(band[0] - 0.03, band[0] + 0.01, y) * (1 - sstep(band[1] - 0.01, band[1] + 0.03, y));   // pressed flat under a ribbon
          var rr = r + 0.003 + Math.min(0, rc) + th;                                           // short of the edge: set back in the gap
          pos.push(rr * sx, y, rr * cz); uv.push(i / cols * 6, k / NS);
        }
      }
      var R1 = NS + 1;
      for (i = 0; i < cols; i++) for (k = 0; k < NS; k++) { var q = i * R1 + k; idx.push(q, q + 1, q + R1, q + 1, q + R1 + 1, q + R1); }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      CakeShapes.bakeAO(g, function () { return 0.95; });
      return g;
    }
    // v1.51: UNEVEN LAYERS. A spread filling is never level (spooned honey, Nutella spread thick): each
    // layer's thickness wanders round the cake by ± vary of its usual. The sponge above rests on it —
    // its underside follows the filling, its top a little less (soft sponge squashes over a thick spot)
    // — and the next layer builds on that; the top sponge's top stays level. One remap of every vertex
    // of the tier by its angle and height — sponges, fillings, their flowing edges and cut faces alike
    // — so they can never disagree.
    function unevenStack(geo, scheme, vary, seed) {
      var n = scheme.n, sT = scheme.spongeT, fT = scheme.fillT, top = n * sT + (n - 1) * fT, p = geo.attributes.position;
      var nb = [], ub = [];
      for (var v = 0; v < p.count; v++) {
        var x = p.getX(v), yv = p.getY(v), z = p.getZ(v);
        if (yv <= 0 || yv >= top) continue;
        var a = Math.atan2(x, z), y = 0, prev = fT;
        nb.length = 0; ub.length = 0;
        for (var k = 0; k < n; k++) {
          var sb = y, st = k === n - 1 ? top : y + sT - (prev - fT) * 0.25;
          nb.push(k * (sT + fT), k * (sT + fT) + sT); ub.push(sb, st); y = st;
          if (k < n - 1) { var ft = fT * (1 - vary + 2 * vary * waves(a, seed + k * 7.3)); nb.push(k * (sT + fT) + sT, (k + 1) * (sT + fT)); ub.push(y, y + ft); y += ft; prev = ft; }
        }
        for (var s = 0; s < nb.length; s += 2) if (yv >= nb[s] && yv <= nb[s + 1]) { p.setY(v, ub[s] + (yv - nb[s]) / (nb[s + 1] - nb[s]) * (ub[s + 1] - ub[s])); break; }
      }
      p.needsUpdate = true;
    }
    function buildStack(cfg, tier, TM, sideMat, theta0, len, seg, partial) {
      var rs = tier.rs, hs = tier.hs, scheme = deps.layerScheme(hs, cfg.ly), filling = TM.filling;
      var G = CakeShapes.P.groove, D = CakeShapes.P.disc;
      var textured = !!sideMat;
      // Outside: the CRUST — sandy, porous, browned — mapped biplanar (wrap on the walls, straight
      // down on the top, where the rack marks are). Inside: the CRUMB — open foam, soft wrap light.
      var smaps = window.CakeFrosting ? CakeFrosting.spongeMaps(cfg.rk) : null;
      var wall = sideMat || new THREE.MeshStandardMaterial({ color: deps.SPONGE(), roughness: 1, vertexColors: true });
      if (!sideMat && smaps) CakeFrosting.dressFondant(wall, smaps, rs);
      // Ends face both ways: of the two faces bounding a gap in a cut cake, one points into it
      // and one away, so single-sided ends vanished from half the angles.
      var crumbMat = new THREE.MeshStandardMaterial({ color: deps.SPONGE_CRUMB(), roughness: 1, side: THREE.DoubleSide, vertexColors: true });
      if (window.CakeFrosting) {
        var cm = CakeFrosting.crumbMaps(partial && deps.crumbNow(), deps.spongeOf(cfg).detail);   // real crumb when it can be seen; the slice page can't wait
        crumbMat.map = cm.a; crumbMat.normalMap = cm.n; crumbMat.roughnessMap = cm.r;
        CakeFrosting.wrapLighting(crumbMat, 0.6, new THREE.Color(1, 0.86, 0.62));
      }
      var geoms = [], mats = [wall, crumbMat];
      // [2] the top surface of the top layer: plain — sponge, or the buttercream where a scrape
      // covers the top fully. The side texture must not be sampled across the lid.
      var topHex = (TM.style === 4) ? deps.PALETTES.frosting[deps.clampIndex(cfg.frs ? cfg.frs[tier.idx || 0] : cfg.fc, deps.PALETTES.frosting)].hex : deps.SPONGE();
      var lidMat = new THREE.MeshStandardMaterial({ color: topHex, roughness: TM.style === 4 ? 0.75 : 1, vertexColors: true });
      if (TM.style !== 4 && smaps) CakeFrosting.dressFondant(lidMat, smaps, rs);   // the baked top, rack marks and all
      mats.push(lidMat);
      var fillMatIndex = {};   // filling end materials start at index 3
      // v1.49: the filling's material, by its type: Creamy satin (the icing's kind of finish); Glossy a
      // clear glassy coat and a little glow from within, as light scatters through jam; Rich dense and
      // glass-smooth. They all take their light from the rig.
      var fKind = deps.fillKind ? deps.fillKind(cfg) : 0;
      function fillMat(hex) {
        if (fillMatIndex[hex] === undefined) {
          fillMatIndex[hex] = mats.length;
          var o = { color: hex, side: THREE.DoubleSide, vertexColors: true };
          if (fKind === 1) { o.roughness = 0.12; o.clearcoat = 1; o.clearcoatRoughness = 0.05; o.emissive = new THREE.Color(hex).multiplyScalar(0.18); }
          else if (fKind === 2) { o.roughness = 0.16; o.clearcoat = 1; o.clearcoatRoughness = 0.06; }
          else { o.roughness = 0.55; o.clearcoat = 0.08; o.clearcoatRoughness = 0.6; }
          mats.push(new THREE.MeshPhysicalMaterial(o));
        }
        return fillMatIndex[hex];
      }
      var matOf = [];                                   // material index per geometry, parallel to geoms
      function addSolid(r, t, f, y0, endMat, isTop) {
        var g = CakeShapes.disc(r, t, f, seg, theta0, len, y0, hs, isTop);
        if (isTop) {
          var lid = CakeShapes.discTop(r, t, f, seg, theta0, len, y0);
          CakeShapes.bakeAO(lid, function () { return 1; });
          geoms.push(lid); matOf.push(2);
        }
        // occlusion: the bottom layer's foot, and every filling sits in shadow
        CakeShapes.bakeAO(g, function (rr, y) { var v = 1; if (y0 === 0) v = Math.min(v, 0.62 + 0.38 * Math.min(1, y / 0.28)); if (endMat !== 1) v = Math.min(v, 0.72); return v; });
        // Walls: the spanning texture if there is one; otherwise the solid's own material.
        geoms.push(g); matOf.push(endMat === 1 ? 0 : endMat);   // v1.49: a filling's own material on its wall, not a painted band
        if (partial) {
          [theta0, theta0 + len].forEach(function (th) {
            var fg = CakeShapes.faceAt(CakeShapes.discFace(r, t, f, y0), th);
            geoms.push(fg); matOf.push(endMat);
          });
        }
      }
      // Sponge layers and fillings, bottom → top, from the same scheme the textures use.
      var y = 0, n = scheme.n;
      var rbBand = null, rtt = cfg.rt && cfg.rt[tier.idx || 0];     // v1.51: where this tier's ribbon presses the filling flat
      if (rtt && rtt.on && deps.ribbons) { var RB = deps.ribbons(), rbw = RB.ribbonWidth(rtt.w), rbc = RB.ribbonY(TM, tier, rbw, rtt.p); rbBand = [rbc - rbw - 0.02, rbc + rbw + 0.02]; }
      for (var k = 0; k < n; k++) {
        addSolid(rs, scheme.spongeT, D.spongeFillet, y, 1, k === n - 1); y += scheme.spongeT;
        if (k < n - 1) {
          var hex = filling[k % filling.length];
          addSolid(rs - G.inset, scheme.fillT, D.fillingFillet, y, fillMat(hex));
          if (TM.style !== 4) {                            // v1.50: its edge, flowing out over the side (not under a scraped coat)
            var shg = fillingSheet(rs, y, scheme.fillT, fKind, 977 + (tier.idx || 0) * 131 + k * 17, theta0 || 0, len || Math.PI * 2, rbBand);
            geoms.push(shg); matOf.push(fillMat(hex));
          }
          y += scheme.fillT;
        }
      }
      var geo = CakeShapes.merge(geoms, function (k) { return matOf[k]; });
      geoms.forEach(function (g) { g.dispose(); });
      if (TM.style !== 4 && n > 1) unevenStack(geo, scheme, (SHEET[fKind] || SHEET[0]).vary, 311 + (tier.idx || 0) * 97);   // v1.51
      if (window.CakeFrosting) CakeFrosting.spongeWobble(geo, rs, hs, deps.SPONGE_WOBBLE());   // baked, not machined
      var mesh = new THREE.Mesh(geo, mats);
      mats.forEach(function (m) { if (m !== sideMat) nightGlow(m, m.color.getHex(), false); });
      return mesh;
    }

    function tierMaterials(cfg, tier) {
      var ti = tier.idx !== undefined ? tier.idx : 0;
      var fondantHex = (cfg.cxs && cfg.cxs['f' + ti] != null) ? cfg.cxs['f' + ti]   // v1.31: an exact colour of its own
        : deps.PALETTES.frosting[deps.clampIndex(cfg.fcs ? cfg.fcs[ti] : cfg.fc, deps.PALETTES.frosting)].hex;
      var creamHex = deps.PALETTES.frosting[deps.clampIndex(cfg.frs ? cfg.frs[ti] : cfg.fc, deps.PALETTES.frosting)].hex;
      var fdOn = cfg.fds ? !!cfg.fds[ti] : !!cfg.fd, style = cfg.frsty ? cfg.frsty[ti] : cfg.fr;
      // "frosting" below is the colour of the OUTERMOST layer on this tier — what the writing sits on.
      var frosting = fdOn ? fondantHex : (style ? creamHex : fondantHex);
      var filling = (cfg.cxs && cfg.cxs.fl != null) ? [cfg.cxs.fl] : deps.PALETTES.filling[deps.clampIndex(cfg.ic, deps.PALETTES.filling)].layers;
      var naked = !style && !fdOn;
      var thick = deps.frostingHasThickness(cfg, ti);
      // Geometry: the sponge itself (rs/hs, grooved) unless the frosting has thickness, in which
      // case the outer shell (r/h, smooth). Semi-naked has no thickness, so it wears the sponge.
      var rr = thick ? tier.r : tier.rs, hh = thick ? tier.h : tier.hs;
      var capH = thick ? deps.CAP_H() : deps.NAKED_CAP_H(), bodyH = hh - capH;
      var scheme = deps.layerScheme(tier.hs, cfg.ly);   // fillings live in the sponge
      var side, cap, base = null, fMaps = null;
      var semi = !fdOn && style === 4 && window.CakeFrosting;   // fondant hides a scrape
      // Base painters span the deps.SPONGE() height — the same span the stack's UVs use — so a message
      // or a scrape lands on the fillings exactly where the filling solids are.
      var hs = tier.hs;
      var paintSponge = function (g, W, H) { deps.paintLayers(g, W, H, filling, scheme, hs); };
      if (naked) {
        side = null;                                       // the stack wears its own materials
        cap = new THREE.MeshStandardMaterial({ color: deps.SPONGE(), roughness: 0.95, vertexColors: true });
        base = paintSponge;
      } else if (semi) {
        // Semi-naked: the sponge's own geometry wearing a thin scrape of buttercream.
        var hx = deps.hexCss(creamHex), rgb = [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
        var scrape = function (g, W, H) {
          // paint into a scratch canvas via the style, then copy — keeps the style's own resolution
          var t = CakeFrosting.semiNakedTexture({ frostingRgb: rgb, paintBase: paintSponge, seed: (tier.idx || 0) + 1, size: [W, H] });
          g.drawImage(t.image, 0, 0, W, H); t.dispose();
        };
        // The scrape is a per-pixel canvas pass, so it's cached on its inputs: scrubbing a shape
        // slider back and forth doesn't repaint it, and cached textures are shared across builds.
        var key = [hx, filling.join(','), cfg.ly, hs.toFixed(2), tier.idx || 0, deps.SPONGE()].join('|');
        var tex = semiCache[key];
        if (!tex) {
          tex = CakeFrosting.semiNakedTexture({ frostingRgb: rgb, paintBase: paintSponge, seed: (tier.idx || 0) + 1 });
          CakeResources.keep(tex);                         // owned by the cache, not by any one build
          semiKeys.push(key); semiCache[key] = tex;
          while (semiKeys.length > 12) { var old = semiKeys.shift(); semiCache[old].dispose(); delete semiCache[old]; }
        }
        side = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, vertexColors: true, map: tex });
        cap = new THREE.MeshStandardMaterial({ color: creamHex, roughness: 0.75, vertexColors: true });
        base = scrape;
      } else {
        // Fondant: a shell in the fondant colour, with its FINISH as normal + roughness maps
        // (frosting.js). There is no flat fondant any more.
        side = new THREE.MeshStandardMaterial({ color: fondantHex, roughness: 0.62, vertexColors: true });
        cap = new THREE.MeshStandardMaterial({ color: fondantHex, roughness: 0.55, vertexColors: true });
        if (window.CakeFrosting) { fMaps = CakeFrosting.fondantMaps(cfg.ff, rr); /* v1.44: sampled at this tier's own size */ CakeFrosting.dressFondant(side, fMaps, rr); CakeFrosting.dressFondant(cap, fMaps, rr); }
      }
      if (side) nightGlow(side, naked ? deps.SPONGE() : frosting, false);
      nightGlow(cap, naked ? deps.SPONGE() : frosting, false);
      // The cut-face material is made on demand: only the cut, the slice page and the dev cut-away
      // use it, and creating it eagerly leaked three textures per build (one per tier) — dozens of
      // times a second while a shape slider was being dragged. Safari reloaded the tab for memory.
      var faceMat = null;
      function face() {
        if (!faceMat) faceMat = new THREE.MeshStandardMaterial({ map: deps.makeCutFaceTexture(filling, scheme, { r: rr, h: hh, rs: tier.rs, hs: tier.hs }, frosting, thick), roughness: 0.9, side: THREE.DoubleSide, vertexColors: true });
        return faceMat;
      }
      return { side: side, cap: cap, face: face, frosting: frosting, filling: filling, naked: naked, fdOn: fdOn, style: style,
               scheme: thick ? null : scheme,            // grooves only when the sponge is what's seen
               capH: capH, bodyH: bodyH, rr: rr, hh: hh,
               profileOpts: thick ? { baseFillet: deps.FONDANT_BASE_FILLET() } : null,   // fondant: tighter at the board
               maps: fMaps,                                   // fondant finish maps (null when no fondant)
               base: base };
    }

    function makeWedgeBody(tier, i, cfg, TM, msgMap) {
      TM = TM || tierMaterials(cfg, tier);
      var frostingMat = TM.side, capMat = TM.cap, scheme = TM.scheme, capH = TM.capH, pOpts = TM.profileOpts;
      var N = deps.WEDGES_PER_TIER(), theta0 = i * Math.PI * 2 / N, len = Math.PI * 2 / N;
      var g = new THREE.Group();
      var bodyH = TM.bodyH;
      var side = frostingMat;
      if (msgMap) {
        var t = msgMap.clone(); t.needsUpdate = true;
        t.wrapS = THREE.RepeatWrapping;
        if (TM.fdOn) { t.repeat.x = 1; t.offset.x = 0; }      // fondant wedge (shell): u is already the true angle
        else { t.repeat.x = len / (Math.PI * 2); t.offset.x = theta0 / (Math.PI * 2); }
        side = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, map: t, vertexColors: true });
        if (TM.maps) CakeFrosting.dressFondant(side, TM.maps, TM.rr);
        else if (!TM.fdOn && window.CakeFrosting) { var wbm = CakeFrosting.spongeMaps(cfg.rk); wbm.noAlbedo = true; CakeFrosting.dressFondant(side, wbm, tier.rs); }
      }
      var wseg = Math.max(6, Math.round(deps.CYL_SEG() / N) + 2);
      var rr = TM.rr;                                           // the sponge, or the shell when the fondant is on
      // The ribbon goes with the slice: the same band as the whole cake's, cut to this wedge.
      var rtw = cfg.rt && cfg.rt[tier.idx || 0];
      if (rtw && rtw.on) {
        var wRw = deps.ribbons().ribbonWidth(rtw.w), wHand = deps.ribbons().ribbonHandFor(cfg, tier, TM, wRw, rtw), wRbY = deps.ribbons().ribbonY(TM, tier, wRw, rtw.p);
        var wbGeo = CakeShapes.ribbon(deps.ribbons().ribbonRadius(TM, rr, bodyH, pOpts, wRbY, wRw), wRbY, wRw, wseg, theta0, len, wHand);
        if (!TM.fdOn && window.CakeFrosting) CakeFrosting.spongeWobble(wbGeo, rr, 1e3, deps.SPONGE_WOBBLE());
        var band = new THREE.Mesh(wbGeo, deps.ribbons().makeRibbonMaterial(cfg, rtw)); band.userData.noSprinkle = true;
        band.position.y = tier.y0; g.add(band);
      }
      if (!TM.fdOn) {
        // A naked or semi-naked wedge is the stack itself, cut: real layer solids with their ends.
        var stack = buildStack(cfg, tier, TM, side, theta0, len, wseg, true);
        stack.position.y = tier.y0; g.add(stack);
      } else {
        // Fondant: the shell, cut, with an L-shaped face showing only the fondant's thickness —
        // and the sponge stack inside it, cut, showing the layers.
        var wBodyGeo = CakeShapes.shell(rr, bodyH, capH, wseg, theta0, len, tier.aboveR, pOpts);
        CakeFrosting.angleUV(wBodyGeo, theta0, len);
        if (TM.maps) CakeFrosting.displaceRim(wBodyGeo, rr, bodyH + capH * 0.35, capH, TM.maps.displace);
        var body = new THREE.Mesh(wBodyGeo, [side, capMat]);
        body.position.y = tier.y0; g.add(body);
        var fondFace = new THREE.MeshStandardMaterial({ color: TM.frosting, roughness: 0.62, side: THREE.DoubleSide, vertexColors: true });
        [theta0, theta0 + len].forEach(function (th) {
          var f = new THREE.Mesh(CakeShapes.cutFace(rr, bodyH, capH, null, pOpts, { rs: tier.rs, hs: tier.hs }), fondFace);
          f.position.set(0, tier.y0, 0);
          f.rotation.y = th - Math.PI / 2;               // +x (radius) → along (sin θ, cos θ)
          g.add(f);
        });
        var stack2 = buildStack(cfg, tier, TM, null, theta0, len, wseg, true);
        stack2.position.y = tier.y0; g.add(stack2);
      }
      g.traverse(function (o) { if (o.isMesh) o.userData.wedge = g; });
      return g;
    }
    return { tierMaterials: tierMaterials, buildStack: buildStack, makeWedgeBody: makeWedgeBody, nightGlow: nightGlow, pickInk: pickInk, luminance: luminance };
  }
  window.CakeBody = { create: create };
})();

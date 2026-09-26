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
      function fillMat(hex) {
        if (fillMatIndex[hex] === undefined) { fillMatIndex[hex] = mats.length; mats.push(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, side: THREE.DoubleSide, vertexColors: true })); }
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
        geoms.push(g); matOf.push(textured ? 0 : (endMat === 1 ? 0 : endMat));
        if (partial) {
          [theta0, theta0 + len].forEach(function (th) {
            var fg = CakeShapes.faceAt(CakeShapes.discFace(r, t, f, y0), th);
            geoms.push(fg); matOf.push(endMat);
          });
        }
      }
      // Sponge layers and fillings, bottom → top, from the same scheme the textures use.
      var y = 0, n = scheme.n;
      for (var k = 0; k < n; k++) {
        addSolid(rs, scheme.spongeT, D.spongeFillet, y, 1, k === n - 1); y += scheme.spongeT;
        if (k < n - 1) {
          var hex = filling[k % filling.length];
          addSolid(rs - G.inset, scheme.fillT, D.fillingFillet, y, fillMat(hex)); y += scheme.fillT;
        }
      }
      var geo = CakeShapes.merge(geoms, function (k) { return matOf[k]; });
      geoms.forEach(function (g) { g.dispose(); });
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
        if (window.CakeFrosting) { fMaps = CakeFrosting.fondantMaps(cfg.ff); CakeFrosting.dressFondant(side, fMaps, rr); CakeFrosting.dressFondant(cap, fMaps, rr); }
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

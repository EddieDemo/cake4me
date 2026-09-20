/* =====================================================================
   shapes.js — the cake's geometry: rounded lathe profiles.

   Kept out of app.js for the same reason look.js is: app.js is the product,
   this is how a tier is SHAPED. It knows radii and heights, not messages
   or candles. Everything here is a LatheGeometry — you describe half a
   cross-section as a line of (radius, y) points and three.js spins it —
   so a tier, and a wedge of a tier, come from the same profile with a
   different sweep angle.

   Why: with soft lighting in place, what still says "shape, not cake" is
   the silhouette. Cylinders have perfectly sharp 90° edges; a baked sponge
   bulges slightly and rounds at the rim, frosting pools where it meets
   the board. A rounded edge catches a gradient of light across it, which
   is where the clay-render quality comes from. Same triangle budget.

   Ambient occlusion is BAKED here as vertex colours. The profiles know
   exactly where the creases are — the base fillet, the underside of the
   cap's overhang, the ring on a tier's top where the tier above sits — so
   analytic occlusion along the profile is smoother and more accurate than a
   screen-space pass, and free at runtime. Materials that use these
   geometries must set `vertexColors: true`; the attribute multiplies colour.

   API (window.CakeShapes):
     bodyProfile(r, bodyH)             sponge side: bottom fillet, gentle bulge, top fillet
     capProfile(r, capH)               frosting cap: underside lip, rounded rim, flat top
     body(r, bodyH, seg, phi0, phiLen) LatheGeometry, UV v = height (so a message band isn't stretched)
     cap(r, capH, seg, phi0, phiLen)   LatheGeometry
     cutFace(r, bodyH, capH)           ShapeGeometry of the whole tier outline, UVs 0–1, for wedge faces
     P                                  the profile knobs
   ===================================================================== */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { console.warn('shapes.js: THREE not loaded'); return; }

  var P = {
    bulge: 0.018,        // sponge: fraction of r wider at mid-height
    baseFillet: 0.10,    // sponge: rounded base, world units
    capOverhang: 0.08,   // cap sticks out past the sponge by this
    capRim: 0.14,        // cap: radius of the rounded top edge
    capUnder: 0.03,      // cap: how far the underside curls back in
    arcSteps: 5,         // points per rounded corner
    // Baked ambient occlusion (0 = black, 1 = untouched)
    ao: {
      base: 0.55,        // darkness right at a tier's foot, where it meets what it sits on
      baseReach: 0.28,   // world units the foot darkening fades over, up the wall
      underCap: 0.62,    // the sponge's top tuck, in the shadow of the cap's overhang
      capLip: 0.50,      // the cap's underside lip
      seat: 0.55,        // a tier's top surface directly under the tier above
      seatReach: 0.42    // how far out from the upper tier's edge the ring fades
    }
  };

  // A quarter-arc of points from angle a0 to a1 around (cx, cy) with radius rr.
  function arc(cx, cy, rr, a0, a1, n, out) {
    for (var i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * i / n;
      out.push(new THREE.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
    }
    return out;
  }

  function bodyProfile(r, bodyH) {
    var pts = [];
    var f = Math.min(P.baseFillet, bodyH * 0.25);
    // base: from the axis-side inset up through a fillet to the wall
    arc(r - f, f, f, -Math.PI / 2, 0, P.arcSteps, pts);          // (r-f,0) → (r,f)
    // wall with a gentle bulge
    pts.push(new THREE.Vector2(r * (1 + P.bulge), bodyH * 0.5));
    // top: small inward tuck so the cap's underside lip has something to sit on
    pts.push(new THREE.Vector2(r, bodyH - 0.04));
    pts.push(new THREE.Vector2(r - 0.02, bodyH));
    return pts;
  }

  function capProfile(r, capH) {
    var pts = [];
    var ro = r + P.capOverhang;                 // outer radius
    var rim = Math.min(P.capRim, capH * 0.9);
    // underside lip: from under the sponge edge out to the rim, curling up
    pts.push(new THREE.Vector2(r - P.capUnder, 0));
    pts.push(new THREE.Vector2(ro - 0.03, 0));
    pts.push(new THREE.Vector2(ro, 0.03));
    // wall up to where the rounded rim begins
    pts.push(new THREE.Vector2(ro, capH - rim));
    // rounded rim: quarter arc from (ro, capH-rim) to (ro-rim, capH)
    arc(ro - rim, capH - rim, rim, 0, Math.PI / 2, P.arcSteps, pts);
    // flat top to the axis
    pts.push(new THREE.Vector2(0, capH));
    return pts;
  }

  // LatheGeometry spreads UV v evenly per profile POINT, not per unit of height, so a
  // profile with many points packed into the fillets would stretch a texture. Rewrite v
  // as normalised height, so the message band maps straight.
  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // Write an AO value per vertex as a grey vertex colour. `f(r, y)` returns 0–1.
  function bakeAO(geo, f) {
    var pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var v = f(Math.sqrt(x * x + z * z), y);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  // Sponge: dark at the foot, fading up the wall; a little dark again under the cap.
  function bodyAO(r, bodyH) {
    var A = P.ao;
    return function (rr, y) {
      var foot = lerp(A.base, 1, smooth(y / A.baseReach));
      var under = lerp(1, A.underCap, smooth((y - (bodyH - 0.14)) / 0.14));
      return Math.min(foot, under);
    };
  }
  // Cap: the underside lip is occluded by the sponge and the overhang; the top is open,
  // except for a ring where the tier above sits (occluderR, if any).
  function capAO(r, capH, occluderR) {
    var A = P.ao, ro = r + P.capOverhang;
    return function (rr, y) {
      var lip = lerp(A.capLip, 1, smooth(y / 0.05));                     // y=0 lip → 1 by y=0.05
      if (!occluderR || y < capH - 0.02) return lip;
      // top face: covered under the tier above, fading out from its edge
      var d = rr - occluderR;
      var seat = d <= 0 ? A.seat : lerp(A.seat, 1, smooth(d / A.seatReach));
      return Math.min(lip, seat);
    };
  }

  function heightUVs(geo, y0, y1) {
    var pos = geo.attributes.position, uv = geo.attributes.uv;
    for (var i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - y0) / (y1 - y0));
    uv.needsUpdate = true;
  }

  function body(r, bodyH, seg, phi0, phiLen) {
    var geo = new THREE.LatheGeometry(bodyProfile(r, bodyH), seg, phi0 || 0, phiLen || Math.PI * 2);
    heightUVs(geo, 0, bodyH);
    // No computeVertexNormals() here. LatheGeometry already computes normals and, for a full
    // sweep, averages the duplicated first/last columns so the join is seamless; recomputing
    // from the triangles gave each seam column a one-sided normal and a visible fold at 0°.
    bakeAO(geo, bodyAO(r, bodyH));
    // One material group covering everything, so a [message, frosting, frosting] material
    // array keeps working: index 0 is the whole side.
    geo.clearGroups(); geo.addGroup(0, Infinity, 0);
    return geo;
  }
  // occluderR: radius of the tier sitting on this one (undefined for the top tier).
  function cap(r, capH, seg, phi0, phiLen, occluderR) {
    var geo = new THREE.LatheGeometry(capProfile(r, capH), seg, phi0 || 0, phiLen || Math.PI * 2);
    bakeAO(geo, capAO(r, capH, occluderR));                  // normals: see body()
    return geo;
  }

  // The tier's outline (sponge + cap) as a flat shape, for a wedge's cut face. A plain
  // rectangle no longer matches a bulged, rounded tier. UVs normalised to 0–1 so the
  // filling-layers texture maps the same way it did on the rectangle.
  function cutFace(r, bodyH, capH) {
    var outline = bodyProfile(r, bodyH).concat(
      capProfile(r, capH).map(function (p) { return new THREE.Vector2(p.x, p.y + bodyH); })
    );
    var shape = new THREE.Shape();
    shape.moveTo(0, 0);
    outline.forEach(function (p) { shape.lineTo(p.x, p.y); });
    shape.lineTo(0, bodyH + capH);
    shape.closePath();
    var geo = new THREE.ShapeGeometry(shape, 4);
    var pos = geo.attributes.position, uv = geo.attributes.uv, H = bodyH + capH, R = r + P.capOverhang;
    for (var i = 0; i < pos.count; i++) { uv.setXY(i, pos.getX(i) / R, pos.getY(i) / H); }
    uv.needsUpdate = true;
    bakeAO(geo, function () { return 1; });      // a plain white attribute: the filling material shares the vertexColors flag
    return geo;
  }

  window.CakeShapes = { P: P, bodyProfile: bodyProfile, capProfile: capProfile, body: body, cap: cap, cutFace: cutFace };
})();

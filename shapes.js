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
    arcSteps: 5          // points per rounded corner
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
  function heightUVs(geo, y0, y1) {
    var pos = geo.attributes.position, uv = geo.attributes.uv;
    for (var i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - y0) / (y1 - y0));
    uv.needsUpdate = true;
  }

  function body(r, bodyH, seg, phi0, phiLen) {
    var geo = new THREE.LatheGeometry(bodyProfile(r, bodyH), seg, phi0 || 0, phiLen || Math.PI * 2);
    heightUVs(geo, 0, bodyH);
    geo.computeVertexNormals();
    // One material group covering everything, so a [message, frosting, frosting] material
    // array keeps working: index 0 is the whole side.
    geo.clearGroups(); geo.addGroup(0, Infinity, 0);
    return geo;
  }
  function cap(r, capH, seg, phi0, phiLen) {
    var geo = new THREE.LatheGeometry(capProfile(r, capH), seg, phi0 || 0, phiLen || Math.PI * 2);
    geo.computeVertexNormals();
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
    return geo;
  }

  window.CakeShapes = { P: P, bodyProfile: bodyProfile, capProfile: capProfile, body: body, cap: cap, cutFace: cutFace };
})();

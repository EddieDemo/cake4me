/* =====================================================================
   shapes.js — the cake's geometry: rounded lathe profiles.

   Kept out of app.js for the same reason look.js is: app.js is the product,
   this is how a tier is SHAPED. It knows radii and heights, not messages
   or candles. Everything here is a LatheGeometry — you describe half a
   cross-section as a line of (radius, y) points and three.js spins it —
   so a tier, and a wedge of a tier, come from the same profile with a
   different sweep angle.

   Frosting is ONE SHELL (v0.53): the cap is the same colour and radius as
   the sponge, with no underside lip and no tuck, so the wall runs straight
   up into a single rounded top edge. The earlier overhanging, lighter cap
   was drawn to suggest icing on a flat-shaded cylinder; with real lighting
   it read as a lid on a tin. The cap stays separate geometry only because
   the side carries the message texture and the top doesn't.

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
    capOverhang: 0.0,    // one shell: the cap is flush with the sponge
    capRim: 0.14,        // cap: radius of the rounded top edge
    arcSteps: 5,         // points per rounded corner
    // Baked ambient occlusion (0 = black, 1 = untouched)
    ao: {
      base: 0.55,        // darkness right at a tier's foot, where it meets what it sits on
      baseReach: 0.28,   // world units the foot darkening fades over, up the wall
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

  // `scheme` (optional, naked cakes): { fills: [[y0, y1], …] } in world units from the tier's
  // base. Each filling becomes a slight inset groove with softly chamfered sponge edges, so a
  // naked cake reads as stacked discs with something squeezed between them.
  P.groove = { inset: 0.045, chamfer: 0.025 };
  function bodyProfile(r, bodyH, scheme) {
    var pts = [];
    var f = Math.min(P.baseFillet, bodyH * 0.25);
    // base: from the axis-side inset up through a fillet to the wall
    arc(r - f, f, f, -Math.PI / 2, 0, P.arcSteps, pts);          // (r-f,0) → (r,f)
    if (scheme && scheme.fills && scheme.fills.length) {
      var G = P.groove;
      scheme.fills.forEach(function (fb) {
        var y0 = fb[0], y1 = fb[1];
        if (y1 > bodyH - 0.01) return;                             // a filling inside the cap: the cap hides it
        pts.push(new THREE.Vector2(r, y0 - G.chamfer));
        pts.push(new THREE.Vector2(r - G.inset, y0));
        pts.push(new THREE.Vector2(r - G.inset, y1));
        pts.push(new THREE.Vector2(r, y1 + G.chamfer));
      });
      pts.push(new THREE.Vector2(r, bodyH));
    } else {
      // frosted shell: wall with a gentle bulge, running straight into the cap
      pts.push(new THREE.Vector2(r * (1 + P.bulge), bodyH * 0.5));
      pts.push(new THREE.Vector2(r, bodyH));
    }
    return pts;
  }

  function capProfile(r, capH) {
    var pts = [];
    var ro = r + P.capOverhang;                 // outer radius
    var rim = Math.min(P.capRim, capH * 0.9);
    // the wall continues from the sponge at the same radius, up to the rounded rim
    pts.push(new THREE.Vector2(ro, 0));
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
  // Sponge: dark at the foot, fading up the wall; darker inside each filling groove.
  function bodyAO(r, bodyH, scheme) {
    var A = P.ao, fills = (scheme && scheme.fills) || [];
    return function (rr, y) {
      var v = lerp(A.base, 1, smooth(y / A.baseReach));
      for (var i = 0; i < fills.length; i++) {
        var y0 = fills[i][0], y1 = fills[i][1], c = P.groove.chamfer;
        if (y >= y0 - c && y <= y1 + c) {
          var edge = Math.min(y - (y0 - c), (y1 + c) - y) / c;    // 0 at the lips, 1 inside
          v = Math.min(v, lerp(1, 0.72, smooth(edge)));
        }
      }
      return v;
    };
  }
  // Cap: open, except for a ring on the top where the tier above sits (occluderR, if any).
  function capAO(r, capH, occluderR) {
    var A = P.ao;
    return function (rr, y) {
      if (!occluderR || y < capH - 0.02) return 1;
      var d = rr - occluderR;
      return d <= 0 ? A.seat : lerp(A.seat, 1, smooth(d / A.seatReach));
    };
  }

  function heightUVs(geo, y0, y1) {
    var pos = geo.attributes.position, uv = geo.attributes.uv;
    for (var i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - y0) / (y1 - y0));
    uv.needsUpdate = true;
  }

  function body(r, bodyH, seg, phi0, phiLen, scheme) {
    var geo = new THREE.LatheGeometry(bodyProfile(r, bodyH, scheme), seg, phi0 || 0, phiLen || Math.PI * 2);
    heightUVs(geo, 0, bodyH);
    // No computeVertexNormals() here. LatheGeometry already computes normals and, for a full
    // sweep, averages the duplicated first/last columns so the join is seamless; recomputing
    // from the triangles gave each seam column a one-sided normal and a visible fold at 0°.
    bakeAO(geo, bodyAO(r, bodyH, scheme));
    // One material group covering everything, so a [message, frosting, frosting] material
    // array keeps working: index 0 is the whole side.
    // The group must carry the REAL index count. `Infinity` renders fine, but r128's Mesh.raycast
    // bounds a material-group loop by min(group.start + group.count, drawRange end) — both
    // Infinity here — so any raycast that hit a tier body looped forever (tap-to-select, and
    // tap-to-cut on a wedge, both froze the tab).
    geo.clearGroups(); geo.addGroup(0, geo.index ? geo.index.count : geo.attributes.position.count, 0);
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
  function cutFace(r, bodyH, capH, scheme) {
    var outline = bodyProfile(r, bodyH, scheme).concat(
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

  // Radius of a profile at height y (piecewise linear between its points), so things that lie
  // on the wall — a ribbon — can follow its bulge and fillets instead of assuming a cylinder.
  function radiusAt(profile, y) {
    if (y <= profile[0].y) return profile[0].x;
    for (var i = 1; i < profile.length; i++) {
      var a = profile[i - 1], b = profile[i];
      if (y <= b.y) { var t = (b.y - a.y) > 1e-6 ? (y - a.y) / (b.y - a.y) : 0; return a.x + (b.x - a.x) * t; }
    }
    return profile[profile.length - 1].x;
  }
  // A strip lying ON the wall: inner face on the wall, outer face `thick` out, closed top and
  // bottom. Samples the wall so it stays flush across a bulge or a groove.
  function bandGeometry(r, bodyH, scheme, y0, width, thick, seg) {
    var prof = bodyProfile(r, bodyH, scheme), pts = [], n = 8;
    for (var i = 0; i <= n; i++) { var y = y0 + width * i / n; pts.push(new THREE.Vector2(radiusAt(prof, y) + thick, y)); }
    for (var j = n; j >= 0; j--) { var yy = y0 + width * j / n; pts.push(new THREE.Vector2(radiusAt(prof, yy) - 0.012, yy)); }
    pts.push(new THREE.Vector2(radiusAt(prof, y0) + thick, y0));
    var geo = new THREE.LatheGeometry(pts, seg);
    return geo;
  }
  window.CakeShapes = { P: P, bodyProfile: bodyProfile, capProfile: capProfile, body: body, cap: cap, cutFace: cutFace, radiusAt: radiusAt, bandGeometry: bandGeometry };
})();

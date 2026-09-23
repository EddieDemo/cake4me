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
  // `opts.baseFillet` overrides the base fillet radius: fondant is trimmed at the board and
  // meets the base with a tighter curve than it turns over the top; buttercream pools.
  function bodyProfile(r, bodyH, scheme, opts) {
    var pts = [];
    var f = Math.min((opts && opts.baseFillet !== undefined) ? opts.baseFillet : P.baseFillet, bodyH * 0.25);
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

  function body(r, bodyH, seg, phi0, phiLen, scheme, opts) {
    var geo = new THREE.LatheGeometry(bodyProfile(r, bodyH, scheme, opts), seg, phi0 || 0, phiLen || Math.PI * 2);
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

  // ONE continuous surface for a shell tier (fondant): wall, shoulder and top in a single lathe,
  // so there's no join, no crease and no lid (v0.77). Two material groups — group 0 the wall
  // (rows up to the straight wall's top: the message band lives here), group 1 the shoulder and
  // top — so a [side, top] material pair still works. Texture v runs over the body height like
  // body() (rows above it clamp; the finish maps don't use UVs at all — see frosting.js).
  function shell(r, bodyH, capH, seg, phi0, phiLen, occluderR, opts) {
    var bp = bodyProfile(r, bodyH, null, opts), cp = capProfile(r, capH);
    var prof = bp.slice();
    for (var k = 1; k < cp.length; k++) prof.push(new THREE.Vector2(cp[k].x, cp[k].y + bodyH));
    var np = prof.length;
    var geo = new THREE.LatheGeometry(prof, seg, phi0 || 0, phiLen || Math.PI * 2);
    heightUVs(geo, 0, bodyH);
    var bAO = bodyAO(r, bodyH, null), cAO = capAO(r, capH, occluderR);
    bakeAO(geo, function (rr, y) { return y <= bodyH ? bAO(rr, y) : cAO(rr, y - bodyH); });
    // Regroup the triangles: wall first (profile rows below the top of the straight wall), then
    // the shoulder and top. Vertex v sits on profile row v % np (r128's lathe order).
    var rim = Math.min(P.capRim, capH * 0.9), split = 0;
    for (var j = 0; j < np; j++) if (prof[j].y <= bodyH + capH - rim + 1e-6) split = j;
    var idx = geo.index.array, side = [], top = [];
    for (var t = 0; t < idx.length; t += 3) {
      var jm = Math.max(idx[t] % np, idx[t + 1] % np, idx[t + 2] % np);
      (jm <= split ? side : top).push(idx[t], idx[t + 1], idx[t + 2]);
    }
    geo.setIndex(side.concat(top));
    geo.clearGroups(); geo.addGroup(0, side.length, 0); geo.addGroup(side.length, top.length, 1);
    return geo;
  }

  // The tier's outline (sponge + cap) as a flat shape, for a wedge's cut face. A plain
  // rectangle no longer matches a bulged, rounded tier. UVs normalised to 0–1 so the
  // filling-layers texture maps the same way it did on the rectangle.
  // `inner` (optional) {rs, hs}: leave the sponge's rectangle out of the face, so what's drawn
  // is only the fondant's own thickness — an L-shaped band around and above the sponge.
  function cutFace(r, bodyH, capH, scheme, opts, inner) {
    var outline = bodyProfile(r, bodyH, scheme, opts).concat(
      capProfile(r, capH).map(function (p) { return new THREE.Vector2(p.x, p.y + bodyH); })
    );
    var shape = new THREE.Shape();
    if (inner) { shape.moveTo(inner.rs, 0); } else { shape.moveTo(0, 0); }
    outline.forEach(function (p) { shape.lineTo(p.x, p.y); });
    shape.lineTo(0, bodyH + capH);
    if (inner) { shape.lineTo(0, inner.hs); shape.lineTo(inner.rs, inner.hs); }
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
  function bandGeometry(r, bodyH, scheme, y0, width, thick, seg, opts, phi0, phiLen) {
    // `opts.straight`: a flat band at radius r (a naked stack: it bridges the filling gaps like
    // a ribbon pulled taut, instead of tucking into them). Otherwise it follows the wall's
    // profile — the fondant's gentle bulge — which is the real surface there.
    var prof = (opts && opts.straight) ? [new THREE.Vector2(r, -1), new THREE.Vector2(r, 1e3)] : bodyProfile(r, bodyH, scheme, opts), pts = [], n = 8;
    for (var i = 0; i <= n; i++) { var y = y0 + width * i / n; pts.push(new THREE.Vector2(radiusAt(prof, y) + thick, y)); }
    for (var j = n; j >= 0; j--) { var yy = y0 + width * j / n; pts.push(new THREE.Vector2(radiusAt(prof, yy) - 0.012, yy)); }
    pts.push(new THREE.Vector2(radiusAt(prof, y0) + thick, y0));
    var geo = new THREE.LatheGeometry(pts, seg, phi0 || 0, phiLen || Math.PI * 2);
    return geo;
  }
  // ---------- The sponge as a STACK of solids (v0.69) ----------
  // Each sponge layer and each filling is a real closed solid: a lathe with softly rounded
  // edges. A cut face is simply the end of each solid, in that solid's own material — nothing
  // is painted on. `y0` is where the disc sits in the tier (bottom), `span` the tier's height,
  // so texture v runs over the whole tier and a message wraps across the layers seamlessly.
  P.disc = { spongeFillet: 0.05, fillingFillet: 0.015 };
  function discProfile(r, t, f, openTop) {
    var pts = [];
    f = Math.min(f, t * 0.45);
    pts.push(new THREE.Vector2(0, 0));
    if (f > 0) { arc(r - f, f, f, -Math.PI / 2, 0, 4, pts); pts.push(new THREE.Vector2(r, t - f)); arc(r - f, t - f, f, 0, Math.PI / 2, 4, pts); }
    else { pts.push(new THREE.Vector2(r, 0), new THREE.Vector2(r, t)); }
    if (!openTop) pts.push(new THREE.Vector2(0, t));
    return pts;
  }
  // `openTop`: leave the flat top off so it can be its own geometry (and material) — the
  // top of the top layer wants a plain surface, not the side texture sampled radially.
  function disc(r, t, f, seg, phi0, phiLen, y0, span, openTop) {
    var geo = new THREE.LatheGeometry(discProfile(r, t, f, openTop), seg, phi0 || 0, phiLen || Math.PI * 2);
    heightUVs(geo, -y0, span - y0);                 // v in tier space
    geo.translate(0, y0, 0);
    return geo;
  }
  // The flat top of a disc: an annulus-free lid from the rounded rim in to the axis.
  function discTop(r, t, f, seg, phi0, phiLen, y0) {
    f = Math.min(f, t * 0.45);
    var geo = new THREE.LatheGeometry([new THREE.Vector2(r - f, t), new THREE.Vector2(0, t)], seg, phi0 || 0, phiLen || Math.PI * 2);
    geo.translate(0, y0, 0);
    return geo;
  }
  // The flat end of a disc, in the (radius, height) plane, to be rotated into place.
  function discFace(r, t, f, y0) {
    var prof = discProfile(r, t, f), shape = new THREE.Shape();
    shape.moveTo(0, 0); prof.forEach(function (p) { shape.lineTo(p.x, p.y); }); shape.closePath();
    var geo = new THREE.ShapeGeometry(shape, 3);
    geo.translate(0, y0, 0);
    // UVs in world units (radius, height in the tier) so a tiled crumb texture runs on across
    // the layers instead of restarting on each.
    var pos = geo.attributes.position, uv = geo.attributes.uv;
    for (var i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i));
    uv.needsUpdate = true;
    return geo;
  }
  // Merge geometries into one, with a material group per input, so a stack of solids and their
  // faces draw as one mesh with a material array. Missing colour attributes become white.
  function merge(list, materialIndexOf) {
    var pos = [], nor = [], uv = [], col = [], idx = [], groups = [], base = 0, off = 0;
    list.forEach(function (g, k) {
      var p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, c = g.attributes.color, cnt = p.count;
      for (var i = 0; i < cnt; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
        uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
        col.push(c ? c.getX(i) : 1, c ? c.getY(i) : 1, c ? c.getZ(i) : 1);
      }
      var start = idx.length;
      if (g.index) { var ix = g.index; for (var j = 0; j < ix.count; j++) idx.push(ix.getX(j) + base); }
      else { for (var j2 = 0; j2 < cnt; j2++) idx.push(j2 + base); }
      groups.push({ start: start, count: idx.length - start, materialIndex: materialIndexOf(k, g) });
      base += cnt;
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    groups.forEach(function (gr) { geo.addGroup(gr.start, gr.count, gr.materialIndex); });
    return geo;
  }
  // Rotate a face geometry so its +x (radius) points along (sin θ, cos θ).
  function faceAt(geo, theta) { geo.rotateY(theta - Math.PI / 2); return geo; }

  // ---- A ribbon (v0.84) ----
  // A band with a fine SELVEDGE — a thin cord at each woven edge — and its middle cupped in
  // toward the cake, built as a closed cross-section so the edges are real. Optional
  // hand-tied imperfection: `tilt` lifts one side; `crumple` gathers a stretch of it, which
  // narrows the band there and lifts it off the cake, the way a real gather does.
  var RIB = { thick: 0.018, bead: 0.5, cup: 0.25, edge: 0.03, across: 30 };
  function ribbonProfile(r0, y0, w) {
    var pts = [new THREE.Vector2(r0, y0)];
    for (var i = 0; i <= RIB.across; i++) {
      var t = i / RIB.across;
      var e = Math.exp(-Math.pow(t / RIB.edge, 2)) + Math.exp(-Math.pow((1 - t) / RIB.edge, 2));
      pts.push(new THREE.Vector2(r0 + RIB.thick * (1 + RIB.bead * e - RIB.cup * Math.sin(Math.PI * t)), y0 + w * t));
    }
    pts.push(new THREE.Vector2(r0, y0 + w));
    return pts;
  }
  function ribbon(r0, y0, w, seg, phi0, phiLen, hand) {
    var geo = new THREE.LatheGeometry(ribbonProfile(r0, y0, w), seg, phi0 || 0, phiLen === undefined ? Math.PI * 2 : phiLen);
    if (hand) {
      var pos = geo.attributes.position, H = hand;
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), rr = Math.sqrt(x * x + z * z);
        if (rr < 1e-4) continue;
        var th = Math.atan2(x, z), t = (y - y0) / w, dy = 0, k = 1;
        if (H.tilt) dy += H.tilt * Math.cos(th - H.tiltAt);                       // a few millimetres off level
        if (H.amp) {
          var d = Math.atan2(Math.sin(th - H.at), Math.cos(th - H.at));
          var win = Math.exp(-Math.pow(d / H.width, 2));
          var pleat = Math.sin(d * H.freq) * 0.6 + Math.sin(d * H.freq * 2.3 + 1.1) * 0.4;
          k += H.amp * pleat * win * (0.45 + 0.55 * Math.sin(Math.PI * Math.max(0, Math.min(1, t))));
          dy += H.lift * win * pleat * w * 0.35;
          // a gather takes the band in a little and lifts it off the cake, which is what makes
          // it read as a gather rather than a bump
          dy += (t - 0.5) * w * 0.22 * win * Math.abs(pleat);
          k += 0.6 * RIB.thick * win * Math.abs(pleat) / Math.max(0.2, rr);
        }
        pos.setXYZ(i, x * k, y + dy, z * k);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }
    return geo;
  }
  window.CakeShapes = { RIB: RIB, ribbon: ribbon,
                        P: P, bodyProfile: bodyProfile, capProfile: capProfile, body: body, cap: cap, shell: shell, cutFace: cutFace, radiusAt: radiusAt, bandGeometry: bandGeometry,
                        disc: disc, discTop: discTop, discFace: discFace, merge: merge, faceAt: faceAt, bakeAO: bakeAO };
})();

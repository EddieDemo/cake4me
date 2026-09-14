/* Cake — Phase 2a
   Two modes in one page.
     No hash  → builder (sender): live cake + form + "Get my link".
     #c=…     → viewer (recipient): the cake, candles lit, message hidden until Phase 3.
   The whole cake lives in the link. No server, no storage.
*/

(function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var MAX_CANDLES = 100;
  var MAX_MSG = 80;
  var MAX_NAME = 24;

  var DEFAULTS = { v: SCHEMA_VERSION, to: '', from: '', m: '', n: 30, t: 1, fc: 0, ic: 0, cc: 0 };
  var PRICES = { 1: '£4.49', 2: '£9.99' };
  var SLICES = { 1: 8, 2: 16 };

  var PALETTES = {
    frosting: [
      { name: 'Strawberry', hex: 0xF7A8C1 },
      { name: 'Vanilla',    hex: 0xFFF1D6 },
      { name: 'Chocolate',  hex: 0x5A3826 },
      { name: 'Mint',       hex: 0xB9E4D0 },
      { name: 'Lemon',      hex: 0xFFE27A },
      { name: 'Lavender',   hex: 0xC9B8F0 },
      { name: 'Sky',        hex: 0xA9D8F5 },
      { name: 'Coral',      hex: 0xFF8A73 }
    ],
    candle: [
      { name: 'White',  hex: 0xFFFFFF },
      { name: 'Pink',   hex: 0xFF6F91 },
      { name: 'Yellow', hex: 0xFFD166 },
      { name: 'Blue',   hex: 0x4FC3F7 },
      { name: 'Purple', hex: 0x9B6BFF },
      { name: 'Gold',   hex: 0xE9C46A }
    ],
    filling: [
      { name: 'Raspberry',  layers: [0xD6336C] },
      { name: 'Lemon curd', layers: [0xFFD43B] },
      { name: 'Ganache',    layers: [0x3E2723] },
      { name: 'Pistachio',  layers: [0xA8D08D] },
      { name: 'Blueberry',  layers: [0x4C5FD5] },
      { name: 'Caramel',    layers: [0xC77B3B] },
      { name: 'Cream',      layers: [0xFFF3C4] },
      { name: 'Rainbow',    layers: [0xE63946, 0xF4A261, 0xFFD166, 0x52B788, 0x4C5FD5, 0x9B6BFF] }
    ]
  };

  var SPONGE = 0xE9C07A;
  var INK_DARK = '#3b2a2a';
  var INK_LIGHT = '#fffaf0';
  var TIERS = {
    1: [ { r: 2.2, h: 1.6 } ],
    2: [ { r: 2.5, h: 1.5 }, { r: 1.45, h: 1.3 } ]
  };
  var CAP_H = 0.32;
  var PLATE_TOP = 0;      // cake sits on the ground; the contact shadow does the grounding
  var ROTATION_SECONDS_PER_TURN = 24;
  var MAX_PIXEL_RATIO = 2;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =====================================================================
  //  URL schema  —  #c=<base64url("1|to|from|m|n|t|fc|ic|cc")>
  //  Text fields are URI-encoded so '|' can't break the split. Version first.
  //  Decoders must ignore extra fields so v1 links survive later additions.
  // =====================================================================
  function b64url(s) { return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return atob(s);
  }
  function cleanText(s, max) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  }
  function clampInt(v, lo, hi, dflt) {
    v = parseInt(v, 10);
    if (isNaN(v)) return dflt;
    return Math.max(lo, Math.min(hi, v));
  }
  function normalize(c) {
    return {
      v: SCHEMA_VERSION,
      to: cleanText(c.to, MAX_NAME),
      from: cleanText(c.from, MAX_NAME),
      m: cleanText(c.m, MAX_MSG),
      n: clampInt(c.n, 0, MAX_CANDLES, DEFAULTS.n),
      t: TIERS[c.t] ? (c.t | 0) : 1,
      fc: clampInt(c.fc, 0, PALETTES.frosting.length - 1, 0),
      ic: clampInt(c.ic, 0, PALETTES.filling.length - 1, 0),
      cc: clampInt(c.cc, 0, PALETTES.candle.length - 1, 0)
    };
  }
  function encodeConfig(c) {
    c = normalize(c);
    var parts = [c.v, encodeURIComponent(c.to), encodeURIComponent(c.from), encodeURIComponent(c.m),
                 c.n, c.t, c.fc, c.ic, c.cc];
    return b64url(parts.join('|'));
  }
  function decodeConfig(code) {
    try {
      var p = unb64url(code).split('|');
      if ((p[0] | 0) < 1) return null;
      var dec = function (s) { try { return decodeURIComponent(s || ''); } catch (e) { return ''; } };
      return normalize({ to: dec(p[1]), from: dec(p[2]), m: dec(p[3]), n: p[4], t: p[5], fc: p[6], ic: p[7], cc: p[8] });
    } catch (e) { return null; }
  }
  function readHash() {
    var h = location.hash || '';
    var m = /[#&]c=([A-Za-z0-9_-]+)/.exec(h);
    return m ? decodeConfig(m[1]) : null;
  }
  function baseUrl() { return location.origin + location.pathname; }
  function linkFor(c) { return baseUrl() + '#c=' + encodeConfig(c); }

  // =====================================================================
  //  Easing vocabulary (see cake-feel-spec.md) and a tiny tween engine
  // =====================================================================
  var EASE = {
    soft: function (t) { return 1 - Math.pow(1 - t, 5); },
    pop:  function (t) { var c1 = 1.56, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    lift: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    snap: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  };
  var tweens = [];
  function tween(o) {
    // o: { delay, duration, ease, update(k), done() }
    o.start = performance.now() + (o.delay || 0);
    o.k = 0;
    tweens.push(o);
    return o;
  }
  function updateTweens(now) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var o = tweens[i];
      if (now < o.start) continue;
      var t = Math.min(1, (now - o.start) / o.duration);
      o.k = (o.ease || EASE.soft)(t);
      o.update(o.k, t);
      if (t >= 1) { tweens.splice(i, 1); if (o.done) o.done(); }
    }
  }
  function finishTweens() {
    var all = tweens.slice(); tweens = [];
    all.forEach(function (o) { o.update(1, 1); if (o.done) o.done(); });
  }
  function killTweens(tag) {
    if (!tag) { tweens = []; return; }
    tweens = tweens.filter(function (o) { return o.tag !== tag; });
  }

  // =====================================================================
  //  Renderer, scene, camera, lights
  // =====================================================================
  var canvas = document.getElementById('cake');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 6.2, 12.4);
  camera.lookAt(0, 1.35, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  var key = new THREE.DirectionalLight(0xfff1dd, 0.9);
  key.position.set(-4, 7, 5);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xdcefff, 0.35);
  fill.position.set(5, 3, -2);
  scene.add(fill);
  var candleLight = new THREE.PointLight(0xffb36b, 0, 8, 2);
  scene.add(candleLight);

  // Two nested groups so spin and tilt can't interfere:
  //   tiltGroup  – X (tilt toward/away) and Z (bank), clamped, springs back
  //     cakeGroup – Y (the turntable spin), unbounded
  var tiltGroup = new THREE.Group();
  scene.add(tiltGroup);
  var cakeGroup = new THREE.Group();
  tiltGroup.add(cakeGroup);

  // Contact shadow instead of a plate: a soft dark disc on the ground.
  // Lives in the scene, not cakeGroup, so it never spins.
  var shadowTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    // Core stays strong out to ~0.62 of the radius (that's where the cake's own footprint
    // ends), then falls away, so what you actually see is a soft ring hugging the base.
    var grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0.00, 'rgba(70,45,40,0.46)');
    grad.addColorStop(0.62, 'rgba(70,45,40,0.40)');
    grad.addColorStop(0.76, 'rgba(70,45,40,0.18)');
    grad.addColorStop(0.90, 'rgba(70,45,40,0.05)');
    grad.addColorStop(1.00, 'rgba(70,45,40,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c); t.__shared = true; return t;
  })();
  var contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.004;
  contactShadow.renderOrder = -1;
  scene.add(contactShadow);
  function fitShadow(radius) {
    // The solid core of the gradient sits at ~52% of the texture, so scale so that
    // core lands just outside the cake's footprint. Perspective does the squashing.
    var w = radius * 3.3;
    contactShadow.scale.set(w, w, 1);
  }

  var built = new THREE.Group();
  cakeGroup.add(built);

  // Shared candle resources (never disposed)
  var candleGeo = new THREE.CylinderGeometry(1, 1, 1, 10);   // unit; scaled per instance
  var wickGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6);
  var wickMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 1 });
  var flameTex = makeFlameTexture();
  // Normal blending, not additive: additive flames vanish against light backgrounds.
  var flameMat = new THREE.SpriteMaterial({
    map: flameTex, transparent: true, depthWrite: false
  });
  candleGeo.__shared = wickGeo.__shared = true;
  wickMat.__shared = flameMat.__shared = true;
  flameTex.__shared = true;

  var flames = [];     // { sprite, base, phase, x, z, k, lit, leanX, leanZ }
  var wicks = [];
  var leanNow = 1;     // global multiplier applied to per-flame lean (eases back to rest)
  function litCount() { var n = 0; for (var i = 0; i < flames.length; i++) if (flames[i].lit > 0.5) n++; return n; }
  var config = null;

  // =====================================================================
  //  Build
  // =====================================================================
  function clearGroup(g) {
    while (g.children.length) {
      var c = g.children[g.children.length - 1];
      g.remove(c);
      if (c.isGroup) { clearGroup(c); continue; }
      if (c.geometry && !c.geometry.__shared) c.geometry.dispose();
      if (c.material && !c.material.__shared) {
        (Array.isArray(c.material) ? c.material : [c.material]).forEach(function (m) {
          if (m.__shared) return;
          if (m.map && !m.map.__shared) m.map.dispose();
          m.dispose();
        });
      }
    }
  }

  var messageMesh = null;   // body mesh of the tier carrying the message (for cheap message-only updates)
  var showMessage = true;

  var tierGroups = [];
  var spawn = null;          // candle pop-in animation state

  function build(cfg, opts) {
    var prevN = (config && config.t === cfg.t) ? (config.n | 0) : 0;
    var prevT = config ? config.t : null;
    config = cfg;
    if (opts && typeof opts.showMessage === 'boolean') showMessage = opts.showMessage;
    clearGroup(built);
    flames = [];
    wicks = [];
    messageMesh = null;
    tierGroups = [];
    spawn = null;
    var animate = !(opts && opts.animate === false) && !reduceMotion;
    var candleFrom = animate ? Math.min(prevN, MAX_CANDLES) : Infinity;   // candles with index ≥ this pop in
    var tierDrop = animate && prevT !== null && prevT !== cfg.t && cfg.t === 2;

    var tiers = TIERS[cfg.t] || TIERS[1];
    var frosting = PALETTES.frosting[clampIndex(cfg.fc, PALETTES.frosting)].hex;
    var filling = PALETTES.filling[clampIndex(cfg.ic, PALETTES.filling)].layers;
    var candleHex = PALETTES.candle[clampIndex(cfg.cc, PALETTES.candle)].hex;
    var ink = pickInk(frosting);

    var frostingMat = new THREE.MeshStandardMaterial({ color: frosting, roughness: 0.62 });
    var capMat = new THREE.MeshStandardMaterial({ color: lighten(frosting, 0.12), roughness: 0.55 });
    frostingMat.__shared = capMat.__shared = true;   // reused across meshes within this build
    var localShared = [frostingMat, capMat];

    var y = PLATE_TOP;
    var surfaces = [];            // where candles may stand
    var messageTier = tiers[0];   // message goes on the biggest tier's side

    tiers.forEach(function (tier, i) {
      var isTop = (i === tiers.length - 1);
      var bodyH = tier.h - CAP_H;
      var open = cfg.cutaway ? Math.PI / 4 : 0;          // dev wedge removed
      var tg = new THREE.Group();                        // this tier's meshes, so it can drop in
      built.add(tg);
      tierGroups.push(tg);

      // Body: frosted all round; sponge only shows on cut faces.
      var sideMat = frostingMat;
      if (tier === messageTier && cfg.m && showMessage) {
        // Frosting colour is baked into the canvas so light ink stays light on dark cakes.
        sideMat = new THREE.MeshStandardMaterial({
          color: 0xffffff, roughness: 0.62, map: makeMessageTexture(cfg.m, ink, frosting, tier.r, bodyH)
        });
      }
      var bodyGeo = new THREE.CylinderGeometry(tier.r, tier.r, bodyH, 72, 1, false, open, Math.PI * 2 - open);
      var body = new THREE.Mesh(bodyGeo, [sideMat, frostingMat, frostingMat]);
      body.position.y = y + bodyH / 2;
      tg.add(body);
      if (tier === messageTier) { messageMesh = body; body.__tier = tier; body.__bodyH = bodyH; }

      // Frosting cap, a touch wider than the body
      var capGeo = new THREE.CylinderGeometry(tier.r + 0.08, tier.r + 0.02, CAP_H, 72, 1, false, open, Math.PI * 2 - open);
      var cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = y + bodyH + CAP_H / 2;
      tg.add(cap);

      // Drip band where cap meets body
      if (!cfg.cutaway) {
        var drip = new THREE.Mesh(new THREE.TorusGeometry(tier.r + 0.02, 0.07, 10, 96), capMat);
        drip.rotation.x = Math.PI / 2;
        drip.position.y = y + bodyH;
        tg.add(drip);
      }

      // Cut faces (dev cut-away): two planes showing sponge + filling layers
      if (cfg.cutaway) {
        var faceTex = makeLayersTexture(filling);
        var faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.9, side: THREE.DoubleSide });
        faceMat.__shared = true; localShared.push(faceMat);
        [0, open].forEach(function (theta) {
          var face = new THREE.Mesh(new THREE.PlaneGeometry(tier.r, tier.h), faceMat);
          face.position.set(Math.sin(theta) * tier.r / 2, y + tier.h / 2, Math.cos(theta) * tier.r / 2);
          face.rotation.y = theta + Math.PI / 2;
          tg.add(face);
        });
        // Inner core so the cake isn't hollow when you look in
        var core = new THREE.Mesh(
          new THREE.CylinderGeometry(tier.r - 0.01, tier.r - 0.01, tier.h - 0.02, 72, 1, true, open, Math.PI * 2 - open),
          new THREE.MeshStandardMaterial({ color: SPONGE, roughness: 1, side: THREE.BackSide })
        );
        core.position.y = y + tier.h / 2;
        tg.add(core);
      }

      // Ribbon at the base of upper tiers, in the candle colour
      if (i > 0) {
        var ribbon = new THREE.Mesh(
          new THREE.CylinderGeometry(tier.r + 0.05, tier.r + 0.05, 0.16, 72, 1, true),
          new THREE.MeshStandardMaterial({ color: candleHex, roughness: 0.5, side: THREE.DoubleSide })
        );
        ribbon.position.y = y + 0.14;
        tg.add(ribbon);
      }

      var topY = y + tier.h;
      if (isTop) {
        surfaces.push({ y: topY, rMax: tier.r - 0.25, rMin: 0 });
      } else {
        // Exposed annulus around the next tier up
        surfaces.push({ y: topY, rMax: tier.r - 0.22, rMin: tiers[i + 1].r + 0.22 });
      }
      y = topY;
    });

    // Candles go on the top tier first, then overflow onto the annulus below.
    surfaces.reverse();
    placeCandles(Math.max(0, Math.min(MAX_CANDLES, cfg.n | 0)), surfaces, candleHex, candleFrom);

    if (tierDrop && tierGroups[1]) {
      var top = tierGroups[1];
      top.position.y = 3.2;
      tween({ duration: 450, ease: EASE.lift,
        update: function (k) { top.position.y = 3.2 * (1 - k); },
        done: function () {
          tween({ duration: 160, ease: EASE.pop, update: function (k) { top.scale.y = 0.94 + 0.06 * k; } });
        } });
    }

    // Materials created for this build are "shared" only until the next build.
    localShared.forEach(function (m) { m.__shared = false; });

    fitShadow((TIERS[cfg.t] || TIERS[1])[0].r);
    candleLight.position.set(0, y + 0.9, 0);
    candleLight.intensity = Math.min(1.6, 0.25 + flames.length * 0.03);

    applyBackground(frosting);
  }

  // Cheap path for typing: swap only the message texture.
  function updateMessage(m) {
    config.m = m;
    if (!messageMesh) { build(config); return; }
    var tier = messageMesh.__tier, bodyH = messageMesh.__bodyH;
    var frosting = PALETTES.frosting[clampIndex(config.fc, PALETTES.frosting)].hex;
    var old = messageMesh.material[0];
    var mat;
    if (m && showMessage) {
      mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.62, map: makeMessageTexture(m, pickInk(frosting), frosting, tier.r, bodyH)
      });
    } else {
      mat = messageMesh.material[1];   // plain frosting
    }
    messageMesh.material[0] = mat;
    if (old !== messageMesh.material[1]) { if (old.map) old.map.dispose(); old.dispose(); }
  }

  function clampIndex(i, arr) {
    i = i | 0;
    return i < 0 || i >= arr.length ? 0 : i;
  }

  // =====================================================================
  //  Candles
  // =====================================================================
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

  function placeCandles(n, surfaces, candleHex, animateFrom) {
    var pts = layout(n, surfaces);
    if (!pts.length) return;
    if (animateFrom === undefined) animateFrom = Infinity;

    // Thinner, shorter candles when they're packed tight.
    var dense = n > 60;
    var radius = dense ? 0.05 : 0.065;
    var height = dense ? 0.42 : 0.5;
    var fs = dense ? 0.22 : 0.28;

    var bodyMat = new THREE.MeshStandardMaterial({ color: candleHex, roughness: 0.45 });
    var bodies = new THREE.InstancedMesh(candleGeo, bodyMat, pts.length);
    var m = new THREE.Matrix4();
    var col = new THREE.Color();
    var hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(candleHex).getHSL(hsl);

    pts.forEach(function (p, i) {
      m.makeScale(radius, height, radius);
      m.setPosition(p.x, p.y + height / 2, p.z);
      bodies.setMatrixAt(i, m);
      if (bodies.setColorAt) {
        // Slight per-candle drift so a hundred of them don't look stamped.
        var d1 = (Math.sin(i * 12.9898) * 43758.5453) % 1, d2 = (Math.sin(i * 78.233) * 43758.5453) % 1;
        col.setHSL((hsl.h + (d1 - 0.5) * 0.03 + 1) % 1, hsl.s,
                   Math.max(0, Math.min(1, hsl.l + (d2 - 0.5) * 0.06)));
        bodies.setColorAt(i, col);
      }

      var wick = new THREE.Mesh(wickGeo, wickMat);
      wick.position.set(p.x, p.y + height + 0.03, p.z);
      built.add(wick);
      wicks.push(wick);

      var flame = new THREE.Sprite(flameMat.clone());   // own material: lean is per-sprite rotation
      flame.material.__shared = false;
      flame.scale.set(fs * 0.7, fs, 1);
      flame.position.set(p.x, p.y + height + 0.16, p.z);
      built.add(flame);
      flames.push({ sprite: flame, base: fs, phase: ((i * 0.618) % 1) * Math.PI * 2, x: p.x, z: p.z,
                    k: 1, lit: 1, y: p.y + height + 0.16, leanX: 0, leanZ: 0 });
    });
    bodies.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    built.add(bodies);

    // Pop-in for new candles: outer ring first, staggered, capped at ~1.2s total.
    if (animateFrom < pts.length) {
      var count = pts.length - animateFrom;
      var stagger = Math.min(12, 1200 / Math.max(1, count));
      spawn = { bodies: bodies, pts: pts, radius: radius, height: height, from: animateFrom,
                stagger: stagger, start: performance.now(), done: false };
      // Hide new ones immediately
      for (var i = animateFrom; i < pts.length; i++) {
        setCandleScale(spawn, i, 0);
      }
    }
  }

  var _m4 = new THREE.Matrix4();
  function setCandleScale(sp, i, k) {
    var p = sp.pts[i];
    var m = _m4;
    m.makeScale(sp.radius * Math.max(0.001, k), sp.height * Math.max(0.001, k), sp.radius * Math.max(0.001, k));
    m.setPosition(p.x, p.y + (sp.height * k) / 2, p.z);
    sp.bodies.setMatrixAt(i, m);
    var f = flames[i];
    if (f) { f.k = k; f.sprite.visible = k > 0.05; }
    var w = wicks[i];
    if (w) { w.visible = k > 0.5; w.position.y = p.y + sp.height * k + 0.03; }
  }
  function updateSpawn(now) {
    if (!spawn || spawn.done) return;
    var sp = spawn, allDone = true;
    for (var i = sp.from; i < sp.pts.length; i++) {
      var t = (now - sp.start - (i - sp.from) * sp.stagger) / 160;
      if (t < 0) { allDone = false; continue; }
      if (t < 1) allDone = false;
      setCandleScale(sp, i, EASE.pop(Math.min(1, t)));
    }
    sp.bodies.instanceMatrix.needsUpdate = true;
    if (allDone) sp.done = true;
  }

  function makeFlameTexture() {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 96;
    var g = c.getContext('2d');
    // Teardrop flame: draw in a squashed local space so the gradient stays centred.
    g.translate(32, 54);
    g.scale(1, 1.4);
    var grad = g.createRadialGradient(0, 4, 1, 0, 0, 28);
    grad.addColorStop(0.0, 'rgba(255,255,235,1)');
    grad.addColorStop(0.3, 'rgba(255,220,120,1)');
    grad.addColorStop(0.62, 'rgba(255,150,50,0.85)');
    grad.addColorStop(0.85, 'rgba(255,110,40,0.35)');
    grad.addColorStop(1.0, 'rgba(255,90,30,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, 28, 0, Math.PI * 2);
    g.fill();
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // =====================================================================
  //  Message, piped on the side of the biggest tier
  // =====================================================================
  function makeMessageTexture(text, ink, frostingHex, radius, bodyH) {
    text = String(text).slice(0, MAX_MSG);
    var circumference = 2 * Math.PI * radius;
    var W = 2048;
    var H = Math.max(96, Math.round(W * (bodyH / circumference)));   // square pixels on the cylinder
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = hexCss(frostingHex);
    g.fillRect(0, 0, W, H);

    // Text occupies ~34% of the circumference (≈120° arc) so it reads from the front.
    var maxW = W * 0.34;
    var maxH = H * 0.78;
    var fit = wrapLines(g, text, maxW, maxH);
    var size = fit.size;

    g.font = size + 'px "Pacifico", cursive';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var lineH = size * 1.15;
    var startY = H / 2 - ((fit.lines.length - 1) * lineH) / 2;

    fit.lines.forEach(function (ln, i) {
      var yy = startY + i * lineH;
      // Piped look: soft shadow, a raised highlight, then the ink.
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillText(ln, W / 2 + size * 0.03, yy + size * 0.06);
      g.fillStyle = ink === INK_DARK ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';
      g.fillText(ln, W / 2 - size * 0.02, yy - size * 0.03);
      g.fillStyle = ink;
      g.fillText(ln, W / 2, yy);
    });

    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = THREE.RepeatWrapping;
    t.offset.x = 0;                // canvas centre → BACK of the cylinder (theta = π).
                                   // The message is always on the reverse side; you spin to find it.
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  function wrapLines(g, text, maxW, maxH) {
    // One line, then two, then three; shrink until it fits.
    for (var n = 1; n <= 3; n++) {
      var size = Math.floor(maxH / (n * 1.15));
      while (size > 36) {
        g.font = size + 'px "Pacifico", cursive';
        var lines = splitInto(g, text, n, maxW);
        if (lines) return { lines: lines, size: size };
        size -= 4;
      }
    }
    return { lines: [text], size: 36 };
  }

  function splitInto(g, text, n, maxW) {
    if (n === 1) return g.measureText(text).width <= maxW ? [text] : null;
    var words = text.split(/\s+/).filter(Boolean);
    var lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (g.measureText(test).width <= maxW) { cur = test; continue; }
      if (!cur) return null;                       // one word too long at this size
      lines.push(cur); cur = words[i];
      if (lines.length === n) return null;
      if (g.measureText(cur).width > maxW) return null;
    }
    if (cur) lines.push(cur);
    return lines.length <= n ? lines : null;
  }

  function makeLayersTexture(layers) {
    // Sponge / filling stripes for cut faces. Filling colours run bottom→top.
    var c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = hexCss(SPONGE);
    g.fillRect(0, 0, 256, 256);
    var bands = layers.length === 1 ? 2 : layers.length;   // single filling = two layers
    var spongeH = 256 / ((bands + 1) + bands * 0.55);
    var fillH = spongeH * 0.55;
    var y = 256;
    for (var i = 0; i < bands; i++) {
      y -= spongeH + fillH;
      g.fillStyle = hexCss(layers[layers.length === 1 ? 0 : i]);
      g.fillRect(0, y, 256, fillH);
    }
    g.fillStyle = 'rgba(120,80,30,0.08)';                  // crumb
    for (var k = 0; k < 400; k++) g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // =====================================================================
  //  Colour helpers
  // =====================================================================
  function hexCss(hex) { return '#' + ('000000' + hex.toString(16)).slice(-6); }
  function lighten(hex, amt) {
    return new THREE.Color(hex).lerp(new THREE.Color(0xffffff), amt).getHex();
  }
  function luminance(hex) {
    var c = new THREE.Color(hex);
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  }
  function pickInk(frostingHex) {
    return luminance(frostingHex) > 0.42 ? INK_DARK : INK_LIGHT;
  }
  function applyBackground(frostingHex) {
    var top = new THREE.Color(frostingHex).lerp(new THREE.Color(0xffffff), 0.72);
    var bottom = new THREE.Color(0xffe9c7).lerp(new THREE.Color(frostingHex), 0.15);
    var root = document.documentElement.style;
    root.setProperty('--sky-top', '#' + top.getHexString());
    root.setProperty('--sky-bottom', '#' + bottom.getHexString());
  }


  // =====================================================================
  //  Resize & loop
  // =====================================================================
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frameCamera();
  }
  // Keep the whole plate in shot whatever the canvas aspect (portrait phones are narrow).
  // Elevation: 26° read as "table height"; 36° shows the candles and the top face,
  // which is the shot. Past ~40° the message on the side starts to squash.
  var CAM_ELEV_DEG = 36;
  // Radius the camera frames to. Cake: two-tier r=2.5 plus air (bigger number = smaller cake).
  // Box: its corner diagonal, or the lid gets cropped on a narrow phone.
  var FRAME = { cake: 3.3, box: 4.7 };
  var frameRadius = FRAME.cake;
  var camTargetY = 1.3, camY = 1.3;
  var frameTarget = 3.3;
  function frameCamera() {
    var vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    var hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    var dist = Math.max(9.0, frameRadius / Math.tan(hHalf));
    var e = THREE.MathUtils.degToRad(CAM_ELEV_DEG);
    camera.position.set(0, dist * Math.sin(e), dist * Math.cos(e));
    camera.lookAt(0, camY, 0);
  }
  // Ease between framings rather than cutting (the box needs a wider frame than the cake).
  function setFrame(which, y, immediate) {
    frameTarget = FRAME[which];
    camTargetY = y;
    if (immediate) { frameRadius = frameTarget; camY = y; }
    frameCamera();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });

  var clock = new THREE.Clock();
  var spinEnabled = true;     // off only while the cake is inside the closed box
  var running = false;

  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
    var now = performance.now();
    updateTweens(now);
    updateSpawn(now);
    if (Math.abs(camY - camTargetY) > 0.001 || Math.abs(frameRadius - frameTarget) > 0.001) {
      camY += (camTargetY - camY) * Math.min(1, dt * 5);
      frameRadius += (frameTarget - frameRadius) * Math.min(1, dt * 5);
      frameCamera();
    }
    if (spinEnabled) updateSpin(now, dt);
    if (ceremony && ceremony.labelShown) positionLidLabel();
    for (var i = 0; i < flames.length; i++) {
      var f = flames[i];
      var lx = f.leanX * leanNow, lz = f.leanZ * leanNow;
      var s = f.base * f.k * f.lit * (1 + 0.10 * Math.sin(t * 3.1 + f.phase) + 0.04 * Math.sin(t * 21 + f.phase * 3));
      f.sprite.scale.set(s * 0.7 * (1 + 0.25 * Math.abs(lx)), s * (1 - 0.45 * Math.abs(lz)) * (1 + 0.3 * Math.abs(lx)), 1);
      f.sprite.material.rotation = -lx * 0.6;
      f.sprite.position.x = f.x + 0.01 * Math.sin(t * 2.3 + f.phase) + lx * 0.08;
      f.sprite.position.y = f.y - (1 - f.k) * 0.5 - Math.abs(lz) * 0.06;
      f.sprite.visible = f.k > 0.05 && f.lit > 0.01;
    }
    if (flames.length) {
      candleLight.intensity = Math.min(1.6, 0.25 + litCount() * 0.03) * (0.92 + 0.08 * Math.sin(t * 7));
    }
    updateSmoke(dt);
    updateRipple(now);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // =====================================================================
  //  Ceremony: box rises, lid lowers, ribbon tightens, label, share.
  //  Objects live in cakeGroup so they turn with the cake.
  // =====================================================================
  var BOX = { half: 2.95, wall: 0.07, h: 0 };         // hugs the cake; h set per tier
  var box = new THREE.Group(), lid = new THREE.Group(), ribbon = new THREE.Group();
  box.visible = lid.visible = ribbon.visible = false;
  cakeGroup.add(box); cakeGroup.add(lid); cakeGroup.add(ribbon);
  var boxMat = new THREE.MeshStandardMaterial({ color: 0xFFF3E2, roughness: 0.9 });
  var boxEdgeMat = new THREE.MeshStandardMaterial({ color: 0xF2DCC2, roughness: 0.9 });
  var ribbonMat = new THREE.MeshStandardMaterial({ color: 0xFF6F91, roughness: 0.45 });
  boxMat.__shared = boxEdgeMat.__shared = ribbonMat.__shared = true;
  var ceremony = null;      // { active, finished }

  function buildBox(height) {
    clearGroup(box); clearGroup(lid); clearGroup(ribbon);
    BOX.h = height;
    var s2 = BOX.half * 2;
    // Base: floor + four walls
    var floor = new THREE.Mesh(new THREE.BoxGeometry(s2, BOX.wall, s2), boxEdgeMat);
    floor.position.y = -BOX.wall / 2 - 0.02;
    box.add(floor);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(function (d) {
      var w = new THREE.Mesh(new THREE.BoxGeometry(d[0] ? BOX.wall : s2, height, d[1] ? BOX.wall : s2), boxMat);
      w.position.set(d[0] * (BOX.half - BOX.wall / 2), height / 2 - 0.02, d[1] * (BOX.half - BOX.wall / 2));
      box.add(w);
    });
    // Lid: slightly larger, top + short skirt
    var lh = BOX.half + 0.06, ls = lh * 2, skirt = 0.55;
    var top = new THREE.Mesh(new THREE.BoxGeometry(ls, BOX.wall, ls), boxMat);
    top.position.y = skirt;
    lid.add(top);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(function (d) {
      var w = new THREE.Mesh(new THREE.BoxGeometry(d[0] ? BOX.wall : ls, skirt, d[1] ? BOX.wall : ls), boxEdgeMat);
      w.position.set(d[0] * (lh - BOX.wall / 2), skirt / 2, d[1] * (lh - BOX.wall / 2));
      lid.add(w);
    });
    // Ribbon: two bands across the lid top, plus a bow
    var band = 0.42, lift2 = skirt + BOX.wall / 2 + 0.03;
    var b1 = new THREE.Mesh(new THREE.BoxGeometry(ls + 0.02, 0.06, band), ribbonMat); b1.position.y = lift2;
    var b2 = new THREE.Mesh(new THREE.BoxGeometry(band, 0.06, ls + 0.02), ribbonMat); b2.position.y = lift2;
    ribbon.add(b1); ribbon.add(b2);
    var knot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), ribbonMat); knot.position.y = lift2 + 0.16;
    ribbon.add(knot);
    [-1, 1].forEach(function (side) {
      var loop = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.09, 10, 24), ribbonMat);
      loop.position.set(side * 0.45, lift2 + 0.2, 0);
      loop.rotation.y = Math.PI / 2; loop.rotation.z = side * 0.25;
      loop.scale.set(1, 0.6, 1);
      ribbon.add(loop);
    });
    ribbon.userData.lidTop = lift2;
  }

  function cakeHeight() {
    var tiers = TIERS[config.t] || TIERS[1], h = PLATE_TOP;
    tiers.forEach(function (t) { h += t.h; });
    return h + 0.7;     // candles + flames
  }

  function startCeremony(onReady) {
    killTweens();
    var candleHex = PALETTES.candle[clampIndex(config.cc, PALETTES.candle)].hex;
    var frostingHex = PALETTES.frosting[clampIndex(config.fc, PALETTES.frosting)].hex;
    // Box takes a tint of the frosting; ribbon takes the candle colour unless that's too pale to read.
    boxMat.color.setHex(lighten(frostingHex, 0.55));
    boxEdgeMat.color.setHex(lighten(frostingHex, 0.35));
    var rib = candleHex;
    if (luminance(rib) > 0.8) rib = luminance(frostingHex) > 0.8 ? 0x3b2a2a : frostingHex;
    ribbonMat.color.setHex(rib);
    var h = Math.max(3.4, cakeHeight() + 0.25);
    buildBox(h);
    ceremony = { active: true, finished: false, onReady: onReady };

    box.visible = true; box.position.y = -h - 1.5;
    lid.visible = false; lid.position.y = h + 6;
    ribbon.visible = false; ribbon.scale.set(0.001, 1, 0.001);

    // Camera lifts to keep the lid in frame
    setFrame('box', 1.7);

    var startAt = 200;
    tween({ delay: startAt, duration: 700, ease: EASE.lift,
      update: function (k) { box.position.y = (-h - 1.5) * (1 - k); } });
    tween({ delay: startAt + 700, duration: 450, ease: EASE.lift,
      update: function (k) { lid.visible = true; lid.position.y = (h - 0.04) + (6 + 0.04) * (1 - k); } });
    tween({ delay: startAt + 700 + 450, duration: 280, ease: EASE.snap,
      update: function (k) { ribbon.visible = true; ribbon.position.y = h - 0.04; ribbon.scale.set(Math.max(0.001, k), 1, Math.max(0.001, k)); } });
    tween({ delay: startAt + 700 + 450 + 280, duration: 280, ease: EASE.soft,
      update: function () { if (!ceremony.labelShown) { ceremony.labelShown = true; showLidLabel(true); } } });
    tween({ delay: startAt + 700 + 450 + 280 + 280, duration: 280, ease: EASE.pop,
      update: function () {}, done: function () { finishCeremony(); } });
  }

  function finishCeremony() {
    if (!ceremony || ceremony.finished) return;
    ceremony.finished = true;
    finishTweens();
    var h = BOX.h;
    box.position.y = 0; lid.visible = true; lid.position.y = h - 0.04;
    ribbon.visible = true; ribbon.position.y = h - 0.04; ribbon.scale.set(1, 1, 1);
    showLidLabel(true);
    if (ceremony.onReady) ceremony.onReady();
  }

  function endCeremony() {
    killTweens();
    ceremony = null;
    box.visible = lid.visible = ribbon.visible = false;
    showLidLabel(false);
    setFrame('cake', 1.3);
  }

  var _v3 = new THREE.Vector3();
  function positionLidLabel() {
    var el = document.getElementById('lid-label');
    if (!el || el.hidden) return;
    _v3.set(0, BOX.h + 0.75, 0);
    _v3.project(camera);
    var x = (_v3.x * 0.5 + 0.5) * canvas.clientWidth;
    var y = (-_v3.y * 0.5 + 0.5) * canvas.clientHeight;
    el.style.left = '0'; el.style.right = 'auto'; el.style.top = '0';
    el.style.width = canvas.clientWidth + 'px';
    el.style.transform = 'translate(' + (x - canvas.clientWidth / 2) + 'px, ' + (y - 24) + 'px)';
  }
  function showLidLabel(on) {
    var el = document.getElementById('lid-label');
    if (!el) return;
    if (on) {
      document.getElementById('lid-for').textContent = config.to ? 'For ' + config.to : 'For you';
      document.getElementById('lid-from').textContent = config.from ? 'from ' + config.from : '';
      el.hidden = false;
      requestAnimationFrame(function () { el.classList.add('on'); });
    } else {
      el.classList.remove('on');
      el.hidden = true;
    }
  }

  // =====================================================================
  //  Phase 3 — smoke, lighting ripple, blowing, confetti, reveal
  // =====================================================================
  var smokeTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(120,110,105,0.55)');
    grad.addColorStop(0.6, 'rgba(120,110,105,0.18)');
    grad.addColorStop(1, 'rgba(120,110,105,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(c); t.__shared = true; return t;
  })();
  var smokes = [];   // { sprite, age, life, vx, vz }
  var smokeGroup = new THREE.Group(); cakeGroup.add(smokeGroup);

  function puffSmoke(f, dirX, dirZ) {
    var m = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.9 });
    var sp = new THREE.Sprite(m);
    sp.position.set(f.x, f.y + 0.05, f.z);
    sp.scale.set(0.12, 0.12, 1);
    smokeGroup.add(sp);
    smokes.push({ sprite: sp, age: 0, life: 0.9, vx: dirX * 0.25 + (Math.random() - 0.5) * 0.08, vz: dirZ * 0.25 });
  }
  function updateSmoke(dt) {
    for (var i = smokes.length - 1; i >= 0; i--) {
      var s = smokes[i]; s.age += dt;
      var t = Math.min(1, s.age / s.life), k = EASE.soft(t);
      s.sprite.position.y += dt * 0.5 * (1 - t * 0.6);
      s.sprite.position.x += s.vx * dt; s.sprite.position.z += s.vz * dt;
      var sc = 0.12 + 0.3 * k;
      s.sprite.scale.set(sc, sc * 1.3, 1);
      s.sprite.material.opacity = 0.9 * (1 - t);
      if (t >= 1) { smokeGroup.remove(s.sprite); s.sprite.material.dispose(); smokes.splice(i, 1); }
    }
  }

  // Light / relight candles in a ripple: order = array of flame indices
  var ripple = null;
  function lightRipple(order, stagger, to) {
    ripple = { order: order, stagger: stagger, start: performance.now(), to: to, done: false };
  }
  function updateRipple(now) {
    if (!ripple || ripple.done) return;
    var all = true;
    for (var j = 0; j < ripple.order.length; j++) {
      var f = flames[ripple.order[j]]; if (!f) continue;
      var t = (now - ripple.start - j * ripple.stagger) / 160;
      if (t < 0) { all = false; continue; }
      if (t < 1) all = false;
      var k = EASE.pop(Math.min(1, t));
      f.lit = ripple.to ? Math.min(1, k) : 1 - Math.min(1, k);
    }
    if (all) ripple.done = true;
  }
  function centreOutOrder() {
    return flames.map(function (f, i) { return [i, f.x * f.x + f.z * f.z]; })
      .sort(function (a, b) { return a[1] - b[1]; }).map(function (p) { return p[0]; });
  }
  function frontToBackOrder() {
    // In world space: the cake rotates, so use each flame's current world z.
    var v = new THREE.Vector3();
    return flames.map(function (f, i) { f.sprite.getWorldPosition(v); return [i, -v.z, f.lit]; })
      .filter(function (p) { return p[2] > 0.5; })
      .sort(function (a, b) { return a[1] - b[1]; }).map(function (p) { return p[0]; });
  }

  // ---- Spin physics ----
  // One model: the cake is a lazy susan. Drag it, fling it, it coasts and decays back
  // to the ambient spin. Spin it fast enough and the wind puts the candles out.
  // There is no separate "blow" gesture.
  var SPIN = {
    idle: (Math.PI * 2) / ROTATION_SECONDS_PER_TURN,   // ambient, rad/s (~0.26)
    max: 8.5,                                          // hard cap, rad/s (~1.35 turns/sec)
    drag: 2.1,                                         // coast decay, per second
    blowAt: 2.2,                                       // wind starts to bite, rad/s
    blowFull: 6.5,                                     // a wave every ~120ms up here
    pxPerTurn: 620,                                    // thumb travel for one full turn (higher = heavier)
    flingGain: 0.55,                                   // how much of the release velocity is kept
    bank: 0.05                                         // max Z lean into the turn, radians
  };
  var TILT = { min: -0.34, max: 0.30, pxPerRad: 520, spring: 2.2 };   // X limits: can't flip
  var omega = SPIN.idle;        // current angular velocity, rad/s
  var tiltX = 0;                // held tilt, radians, clamped to TILT
  var bankZ = 0;                // automatic lean into the turn
  var dragging = false;
  var spinFree = false;         // true once the user has taken hold of the cake

  var blow = { enabled: false, lastWave: 0, micLevel: 0, micHold: 0, total: 0, revealed: false };

  function extinguish(f, dirX, dirZ) {
    if (f.lit <= 0.5 || f.__out) return;
    f.__out = true;
    tween({ duration: 80, ease: EASE.snap,
      update: function (k) { f.lit = 1 - k; },
      done: function () { f.lit = 0; f.__out = false; f.leanX = f.leanZ = 0; puffSmoke(f, dirX, dirZ); checkAllOut(); } });
  }
  function wave(strength, dirX, dirZ) {
    for (var j = 0; j < flames.length; j++) {         // rescue any flame stranded mid-extinguish
      if (flames[j].__out && flames[j].lit > 0 && flames[j].lit < 1) { flames[j].lit = 0; flames[j].__out = false; }
    }
    var order = frontToBackOrder();
    if (!order.length) { checkAllOut(); return; }
    var size = Math.max(1, Math.ceil(blow.total / 6 * (0.5 + strength)));
    for (var i = 0; i < Math.min(size, order.length); i++) extinguish(flames[order[i]], dirX, dirZ);
  }
  function setLean(sideways, away) {
    for (var i = 0; i < flames.length; i++) { flames[i].leanX = sideways; flames[i].leanZ = away; }
  }

  function updateSpin(now, dt) {
    // Drag sets omega directly (see the pointer handlers). Otherwise coast toward idle.
    if (!dragging) {
      var target = SPIN.idle;
      var k = 1 - Math.exp(-SPIN.drag * dt);
      omega += (target - omega) * k;
      if (Math.abs(omega - target) < 0.004) omega = target;
      // Tilt springs back to level once you let go.
      tiltX += (0 - tiltX) * (1 - Math.exp(-TILT.spring * dt));
      if (Math.abs(tiltX) < 0.002) tiltX = 0;
    }
    omega = Math.max(-SPIN.max, Math.min(SPIN.max, omega));
    if (!reduceMotion) cakeGroup.rotation.y += omega * dt;

    // Bank: the cake leans into the turn. Automatic, small, eases.
    var bankTarget = -Math.max(-1, Math.min(1, omega / SPIN.blowFull)) * SPIN.bank;
    bankZ += (bankTarget - bankZ) * Math.min(1, dt * 4);
    tiltGroup.rotation.x = tiltX;
    tiltGroup.rotation.z = bankZ;

    // Apparent wind = how hard the cake is turning, relative to its resting spin.
    var wind = (Math.abs(omega) - SPIN.blowAt) / (SPIN.blowFull - SPIN.blowAt);
    wind = Math.max(0, Math.min(1, wind));
    var mic = blow.enabled ? blow.micLevel : 0;

    // Flames lean against the direction of travel; mic pushes them away from the viewer.
    var spinLean = Math.max(-1, Math.min(1, -omega / SPIN.blowFull)) * (0.35 + 0.65 * wind);
    if (Math.abs(omega) > SPIN.idle * 1.5 || mic > 0) setLean(spinLean, mic);
    else setLean(0, 0);
    leanNow += (((Math.abs(spinLean) > 0.02 || mic > 0) ? 1 : 0) - leanNow) * Math.min(1, dt * 10);

    if (!blow.enabled) return;
    if (mic > 0) blow.micHold += dt * 1000; else blow.micHold = 0;
    var micReady = mic > 0 && blow.micHold >= 150;

    if (wind > 0 && now - blow.lastWave > (260 - 140 * wind)) {
      blow.lastWave = now;
      wave(wind, omega > 0 ? -1 : 1, 0);
    } else if (micReady && now - blow.lastWave > 180) {
      blow.lastWave = now;
      wave(mic, 0, -1);
    }
  }

  function checkAllOut() {
    if (blow.revealed) return;
    if (litCount() === 0) {
      blow.revealed = true;
      blow.enabled = false;
      setTimeout(reveal, 500);            // the beat. Don't shorten it.
    }
  }

  // Drag: horizontal spins the turntable, vertical tilts it. Tilt is clamped so the
  // cake can never flip, and springs back to level when released.
  (function () {
    var id = null, lastX = 0, lastY = 0, lastT = 0, vel = 0;
    function toOmega(dxPx, dtMs) {
      return (dxPx / SPIN.pxPerTurn) * Math.PI * 2 / (dtMs / 1000);
    }
    canvas.addEventListener('pointerdown', function (e) {
      if (id !== null) return;
      id = e.pointerId; lastX = e.clientX; lastY = e.clientY; lastT = performance.now(); vel = 0;
      dragging = true; spinFree = true;
      killTweens('turn');                 // a drag interrupts the auto-facing turn, nothing else
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(id); } catch (err) {} }
    });
    canvas.addEventListener('pointermove', function (e) {
      if (e.pointerId !== id) return;
      var now = performance.now(), dt = Math.max(8, now - lastT);
      var dx = e.clientX - lastX, dy = e.clientY - lastY;

      vel = toOmega(dx, dt);
      omega = Math.max(-SPIN.max, Math.min(SPIN.max, vel));
      cakeGroup.rotation.y += (dx / SPIN.pxPerTurn) * Math.PI * 2;   // tracks the thumb

      // Drag down to look further over the top, up to see more of the side.
      tiltX = Math.max(TILT.min, Math.min(TILT.max, tiltX + dy / TILT.pxPerRad));

      lastX = e.clientX; lastY = e.clientY; lastT = now;
    });
    function release(e) {
      if (e.pointerId !== id) return;
      id = null; dragging = false;
      if (performance.now() - lastT > 90) vel = 0;    // finger stopped before lifting: no fling
      var launch = vel * SPIN.flingGain;
      omega = Math.abs(launch) > SPIN.idle ? Math.max(-SPIN.max, Math.min(SPIN.max, launch)) : SPIN.idle;
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  })();

  // Microphone
  var audioCtx = null, micStream = null, analyser = null, micData = null, micFloor = 0, micCal = 0, micLowBins = 8;
  function unlockAudio() {
    try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
  }
  function startMic(onResult) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { onResult(false); return; }
    unlockAudio();
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then(function (stream) {
        micStream = stream;
        var src = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.5;
        src.connect(analyser);
        micData = new Uint8Array(analyser.frequencyBinCount);
        micLowBins = Math.max(4, Math.round(400 / (audioCtx.sampleRate / analyser.fftSize)));
        micFloor = 0; micCal = 0;
        pollMic();
        onResult(true);
      }, function () { onResult(false); });
  }
  function pollMic() {
    if (!analyser) return;
    analyser.getByteFrequencyData(micData);
    var sum = 0; for (var i = 0; i < micLowBins; i++) sum += micData[i];
    var v = sum / micLowBins;
    if (micCal < 30) { micFloor = micFloor + (v - micFloor) / (micCal + 1); micCal++; blow.micLevel = 0; }
    else {
      var thr = Math.max(micFloor + 28, micFloor * 1.6, 40);
      blow.micLevel = Math.max(0, Math.min(1, (v - thr) / 60));
    }
    requestAnimationFrame(pollMic);
  }
  function stopMic() {
    if (micStream) { micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null; }
    analyser = null; blow.micLevel = 0;
  }

  // ---- Confetti (2D overlay) ----
  var confettiCanvas = document.getElementById('confetti');
  function confettiBurst(colors, count) {
    if (!confettiCanvas) return;
    if (reduceMotion && count > 40) count = 40;
    confettiCanvas.classList.add('on');                 // must be displayed before measuring
    var W = confettiCanvas.clientWidth, H = confettiCanvas.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!W || !H) { confettiCanvas.classList.remove('on'); return; }
    confettiCanvas.width = W * dpr; confettiCanvas.height = H * dpr;
    var g = confettiCanvas.getContext('2d'); g.scale(dpr, dpr);
    var ps = [];
    for (var i = 0; i < count; i++) {
      var side = i % 5 === 0 ? (i % 10 === 0 ? -1 : 1) : 0;
      ps.push({
        x: side ? (side < 0 ? -10 : W + 10) : Math.random() * W,
        y: side ? H * 0.45 + Math.random() * 60 : -20 - Math.random() * 80,
        vx: side ? -side * (3 + Math.random() * 4) : (Math.random() - 0.5) * 2,
        vy: side ? -(3 + Math.random() * 3) : Math.random() * 1.5,
        w: 6, h: 10, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, tilt: Math.random() * Math.PI, vt: 0.08 + Math.random() * 0.1,
        c: colors[i % colors.length]
      });
    }
    var start = performance.now(), last = start;
    (function step(now) {
      var dt = Math.min(2, (now - last) / 16.67); last = now;
      g.clearRect(0, 0, W, H);
      var alive = 0;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.vy += 0.35 * dt; p.vx *= Math.pow(0.98, dt); p.vy *= Math.pow(0.985, dt);
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.tilt += p.vt * dt;
        if (p.y < H + 20) alive++;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
        g.fillStyle = p.c; g.globalAlpha = 0.95;
        g.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.tilt)), p.w, p.h * Math.abs(Math.cos(p.tilt)) + 1);
        g.restore();
      }
      if (alive && now - start < 4000) requestAnimationFrame(step);
      else { g.clearRect(0, 0, W, H); confettiCanvas.classList.remove('on'); }
    })(start);
  }

  // ---- Reveal ----
  // The message isn't revealed here: it's always on the back of the cake, found by
  // spinning. Blowing the candles out just earns the confetti and the next step.
  function reveal() {
    var pal = [PALETTES.frosting[clampIndex(config.fc, PALETTES.frosting)].hex,
               PALETTES.candle[clampIndex(config.cc, PALETTES.candle)].hex, 0xffffff, 0xFFD166, 0xFF6F91];
    confettiBurst(pal.map(function (h) { return hexCss(h); }), 120);
    setTimeout(showRevealedControls, 700);
  }
  function showRevealedControls() {
    setViewerState('revealed');
    requestAnimationFrame(function () { document.getElementById('vs-revealed').classList.add('on'); });
  }

  // ---- Gate & open ----
  var boxOpenDone = false;
  function setViewerState(st) {
    ['gate', 'blow', 'revealed'].forEach(function (k) {
      var el = document.getElementById('vs-' + k); if (el) el.hidden = (k !== st);
    });
    document.body.setAttribute('data-vstate', st);
  }
  function enterGate(cfg) {
    build(cfg, { showMessage: true, animate: false });
    for (var i = 0; i < flames.length; i++) flames[i].lit = 0;      // unlit inside the box
    blow = { enabled: false, lastWave: 0, micLevel: 0, micHold: 0, total: flames.length, revealed: false };
    boxOpenDone = false;
    // Closed box, ribbon on, cake inside
    var candleHex = PALETTES.candle[clampIndex(cfg.cc, PALETTES.candle)].hex;
    var frostingHex = PALETTES.frosting[clampIndex(cfg.fc, PALETTES.frosting)].hex;
    boxMat.color.setHex(lighten(frostingHex, 0.55));
    boxEdgeMat.color.setHex(lighten(frostingHex, 0.35));
    var rib = candleHex; if (luminance(rib) > 0.8) rib = luminance(frostingHex) > 0.8 ? 0x3b2a2a : frostingHex;
    ribbonMat.color.setHex(rib);
    var h = Math.max(3.4, cakeHeight() + 0.25);
    buildBox(h);
    box.visible = lid.visible = ribbon.visible = true;
    box.position.y = 0; lid.position.y = h - 0.04; lid.rotation.set(0, 0, 0); ribbon.position.y = h - 0.04; ribbon.scale.set(1, 1, 1);
    cakeGroup.rotation.set(0, 0.4, 0);
    omega = SPIN.idle; tiltX = 0; bankZ = 0; spinFree = false; spinEnabled = false;
    tiltGroup.rotation.set(0, 0, 0);
    setFrame('box', 1.7, true);
    els.viewerHead.classList.remove('on');
    els.viewerHead.hidden = false;
    setViewerState('gate');
    document.getElementById('use-mic').hidden = !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    document.getElementById('mic-status').innerHTML = '&nbsp;';
    document.getElementById('vs-revealed').classList.remove('on');
  }
  function openBox() {
    if (boxOpenDone) return; boxOpenDone = true;
    unlockAudio();
    var h = BOX.h;
    // 1. ribbon loosens and drops
    tween({ duration: 280, ease: EASE.soft, update: function (k) { ribbon.scale.set(1 + 0.15 * k, 1, 1 + 0.15 * k); ribbon.position.y = (h - 0.04) - 1.2 * k; ribbon.traverse(function (o) { if (o.material) { o.material.transparent = true; o.material.opacity = 1 - k; } }); },
      done: function () { ribbon.visible = false; ribbon.traverse(function (o) { if (o.material) { o.material.opacity = 1; o.material.transparent = false; } }); } });
    // 2. lid lifts and tilts back, exits upward
    tween({ delay: 200, duration: 700, ease: EASE.lift, update: function (k) {
      lid.position.y = (h - 0.04) + 9 * k; lid.rotation.x = -0.9 * k; lid.position.z = -2.5 * k;
    }, done: function () { lid.visible = false; } });
    // 3. box sinks away while the cake rises 12% and settles
    tween({ delay: 700, duration: 700, ease: EASE.lift, update: function (k) {
      box.position.y = -(h + 1.5) * k;
      built.position.y = 0.5 * Math.sin(Math.PI * k) * 0.6;
    }, done: function () {
      box.visible = false; built.position.y = 0;
      tween({ duration: 160, ease: EASE.pop, update: function (k) { var sc = 1.03 - 0.03 * k; built.scale.set(sc, sc, sc); } });
      setFrame('cake', 1.3);
    } });
    // 4. candles light in a ripple, centre out, capped at 1.2s
    setTimeout(function () {
      spinEnabled = true;
      var order = centreOutOrder();
      lightRipple(order, Math.min(20, 1200 / Math.max(1, order.length)), true);
      // 5. header, then the blow state
      els.viewerHead.classList.add('on');
      setTimeout(function () { setViewerState('blow'); blow.enabled = true; }, 500);
    }, 1200);
  }
  function relight() {
    blow.revealed = false;
    for (var i = 0; i < flames.length; i++) { flames[i].__out = false; }
    lightRipple(centreOutOrder().reverse(), Math.min(20, 1200 / Math.max(1, flames.length)), true);
    document.getElementById('vs-revealed').classList.remove('on');
    setTimeout(function () { setViewerState('blow'); blow.enabled = true; }, 600);
  }

  // =====================================================================
  //  UI: builder
  // =====================================================================
  var $ = function (id) { return document.getElementById(id); };
  var els = {
    builder: $('builder'), linkpanel: $('linkpanel'), viewerFoot: $('viewer-foot'), viewerHead: $('viewer-head'),
    to: $('f-to'), from: $('f-from'), m: $('f-m'), mCount: $('m-count'), n: $('f-n'), nOut: $('n-out'),
    tiers: $('tiers'), swFc: $('sw-fc'), swIc: $('sw-ic'), swCc: $('sw-cc'),
    getLink: $('get-link'), linkOut: $('link-out'), share: $('share-link'), copy: $('copy-link'),
    copyHint: $('copy-hint'), open: $('open-link'), edit: $('edit-cake'),
    vhTitle: $('vh-title'), vhFrom: $('vh-from')
  };

  var draft = null;          // builder state
  var msgTimer = null;

  function hexCssStr(hex) { return '#' + ('000000' + hex.toString(16)).slice(-6); }

  function makeSwatches(container, list, key) {
    container.innerHTML = '';
    list.forEach(function (item, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.title = item.name;
      b.setAttribute('aria-label', item.name);
      if (item.layers) {
        if (item.layers.length > 1) {
          var stops = item.layers.map(function (h, k) {
            var a = (k / item.layers.length) * 100, z = ((k + 1) / item.layers.length) * 100;
            return hexCssStr(h) + ' ' + a + '% ' + z + '%';
          }).join(', ');
          b.style.background = 'linear-gradient(180deg, ' + stops + ')';
        } else {
          b.style.background = hexCssStr(item.layers[0]);
        }
      } else {
        b.style.background = hexCssStr(item.hex);
      }
      b.addEventListener('click', function () {
        draft[key] = i;
        syncSwatches(container, i);
        build(draft, { showMessage: true });
      });
      container.appendChild(b);
    });
  }
  function syncSwatches(container, active) {
    Array.prototype.forEach.call(container.children, function (b, i) {
      b.setAttribute('aria-pressed', i === active ? 'true' : 'false');
    });
  }
  function syncTiers(active) {
    Array.prototype.forEach.call(els.tiers.children, function (b) {
      b.setAttribute('aria-pressed', (b.getAttribute('data-t') | 0) === active ? 'true' : 'false');
    });
  }
  function syncForm() {
    els.to.value = draft.to;
    els.from.value = draft.from;
    els.m.value = draft.m;
    els.mCount.textContent = draft.m.length + ' / ' + MAX_MSG;
    els.n.value = draft.n;
    els.nOut.textContent = draft.n;
    syncTiers(draft.t);
    syncSwatches(els.swFc, draft.fc);
    syncSwatches(els.swIc, draft.ic);
    syncSwatches(els.swCc, draft.cc);
  }

  function wireBuilder() {
    makeSwatches(els.swFc, PALETTES.frosting, 'fc');
    makeSwatches(els.swIc, PALETTES.filling, 'ic');
    makeSwatches(els.swCc, PALETTES.candle, 'cc');

    els.to.addEventListener('input', function () { draft.to = cleanText(els.to.value, MAX_NAME); });
    els.from.addEventListener('input', function () { draft.from = cleanText(els.from.value, MAX_NAME); });

    els.m.addEventListener('input', function () {
      draft.m = cleanText(els.m.value, MAX_MSG);
      els.mCount.textContent = draft.m.length + ' / ' + MAX_MSG;
      clearTimeout(msgTimer);
      msgTimer = setTimeout(function () { updateMessage(draft.m); }, 120);
    });

    els.n.addEventListener('input', function () {
      draft.n = clampInt(els.n.value, 0, MAX_CANDLES, 0);
      els.nOut.textContent = draft.n;
      build(draft, { showMessage: true });
    });

    Array.prototype.forEach.call(els.tiers.children, function (b) {
      b.addEventListener('click', function () {
        draft.t = b.getAttribute('data-t') | 0;
        syncTiers(draft.t);
        build(draft, { showMessage: true });
      });
    });

    els.getLink.addEventListener('click', function () {
      draft = normalize(draft);
      config = draft;
      var url = linkFor(draft);
      els.linkOut.value = url;
      els.open.href = url;
      els.copyHint.innerHTML = '&nbsp;';
      els.share.hidden = !(navigator.share);
      // Phase 6 puts checkout between this click and the link.

      // Sheet slides away, then the box ceremony, then the link panel arrives in stages.
      els.linkpanel.classList.remove('stage1', 'stage2');
      els.builder.classList.add('away');
      setTimeout(function () {
        els.builder.hidden = true; els.builder.classList.remove('away');
        els.linkpanel.hidden = false; els.linkpanel.classList.add('away');
        setTimeout(resize, 0);
      }, 280);
      startCeremony(function () {
        els.linkpanel.classList.remove('away');
        els.linkpanel.classList.add('stage1');
        setTimeout(function () { els.linkpanel.classList.add('stage2'); }, 240);
      });
    });

    // Tap anywhere during the ceremony to skip to the end.
    ['pointerdown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, function () {
        if (ceremony && ceremony.active && !ceremony.finished) finishCeremony();
      }, { passive: true });
    });

    els.copy.addEventListener('click', function () {
      var url = els.linkOut.value;
      var done = function () { els.copyHint.textContent = 'Copied'; setTimeout(function () { els.copyHint.innerHTML = '&nbsp;'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { els.linkOut.select(); document.execCommand('copy'); done(); });
      } else {
        els.linkOut.select(); document.execCommand('copy'); done();
      }
    });

    els.share.addEventListener('click', function () {
      var url = els.linkOut.value;
      if (navigator.share) {
        navigator.share({ title: 'I made you a cake', text: (draft.to ? draft.to + ', ' : '') + 'I made you a cake 🎂', url: url })
          .catch(function () {});
      }
    });

    els.edit.addEventListener('click', function () {
      endCeremony();
      els.linkpanel.classList.remove('stage1', 'stage2');
      showSheet('builder');
    });
  }

  function showSheet(which) {
    els.builder.hidden = which !== 'builder';
    els.linkpanel.hidden = which !== 'linkpanel';
    els.viewerFoot.hidden = which !== 'viewer';
    els.viewerHead.hidden = which !== 'viewer';
    setTimeout(resize, 0);
  }
  function wireViewer() {
    document.getElementById('open-cake').addEventListener('click', function () { openBox(); });
    document.getElementById('use-mic').addEventListener('click', function () {
      var st = document.getElementById('mic-status');
      startMic(function (ok) {
        if (ok) { st.textContent = 'Listening… blow!'; }
        else { document.getElementById('use-mic').hidden = true; }     // never an error
      });
      openBox();
    });
    document.getElementById('relight').addEventListener('click', relight);
    document.getElementById('cut-cake').addEventListener('click', function () {
      var h = document.getElementById('cut-hint');
      h.textContent = 'Slices arrive in the next update.';
      setTimeout(function () { h.innerHTML = '&nbsp;'; }, 2000);
    });
  }

  // =====================================================================
  //  Router
  // =====================================================================
  function route() {
    endCeremony();
    stopMic();
    cakeGroup.rotation.set(0, cakeGroup.rotation.y, 0);
    built.position.y = 0; built.scale.set(1, 1, 1);
    spinEnabled = true; spinFree = false; omega = SPIN.idle; tiltX = 0; bankZ = 0;
    tiltGroup.rotation.set(0, 0, 0);
    blow.enabled = false;
    els.viewerHead.classList.remove('on');
    els.linkpanel.classList.remove('stage1', 'stage2', 'away');
    els.builder.classList.remove('away');
    var fromLink = readHash();
    if (fromLink) {
      // Viewer
      document.body.classList.remove('mode-builder');
      document.body.classList.add('mode-viewer');
      els.vhTitle.textContent = fromLink.to ? 'Happy Birthday, ' + fromLink.to : 'Happy Birthday';
      els.vhFrom.textContent = fromLink.from ? 'from ' + fromLink.from : '';
      showSheet('viewer');
      enterGate(fromLink);
    } else {
      // Builder
      document.body.classList.remove('mode-viewer');
      document.body.classList.add('mode-builder');
      if (!draft) draft = normalize(DEFAULTS);
      syncForm();
      showSheet('builder');
      build(draft, { showMessage: true });
      cakeGroup.rotation.y = Math.PI;      // message side toward the sender while they write it
    }
    resize();
  }

  function boot() {
    if (running) return;
    running = true;
    wireBuilder();
    wireViewer();
    route();
    window.addEventListener('hashchange', route);
    frame();
  }
  if (document.fonts && document.fonts.load) {
    document.fonts.load('60px "Pacifico"').then(boot, boot);
    setTimeout(boot, 1500);
    document.fonts.ready.then(function () { if (config) build(config, { showMessage: showMessage }); });
  } else {
    boot();
  }

  // Console API (handy while building)
  window.cake = {
    set: function (partial) {
      var next = {};
      for (var k in config) next[k] = config[k];
      for (var j in partial) next[j] = partial[j];
      if (draft && !document.body.classList.contains('mode-viewer')) { draft = normalize(next); syncForm(); }
      build(next, { showMessage: showMessage });
    },
    get config() { return config; },
    set rotate(v) { spinEnabled = !!v; },
    set spin(v) { omega = v; },
    get spin() { return omega; },
    link: function () { return linkFor(config); },
    encode: encodeConfig, decode: decodeConfig,
    palettes: PALETTES, group: cakeGroup, tilt: tiltGroup, SPIN: SPIN, TILT: TILT,
    debug: function () { return { omega: +omega.toFixed(2), tilt: +tiltX.toFixed(3), bank: +bankZ.toFixed(3), dragging: dragging, lit: litCount(), state: document.body.getAttribute('data-vstate') }; },
    blowAll: function () { for (var i = 0; i < flames.length; i++) extinguish(flames[i], 0, -1); }
  };
})();

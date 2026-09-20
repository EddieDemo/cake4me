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

  // fr defaults to 1 (smooth) so links from before the sponge-first builder still decode as
  // frosted cakes; the BUILDER starts a fresh cake at fr = 0 (naked) — see newDraft().
  var DEFAULTS = { v: SCHEMA_VERSION, to: '', from: '', m: '', n: 30, t: 1, fc: 0, ic: 0, cc: 0, bg: 1, rc: 0, tc: 0, o: 0, lt: '', ly: 3, fr: 1 };
  var FROST_T = 0.08;            // frosting thickness: a naked sponge is this much smaller than the shell
  var PRICES = { 1: '£4.49', 2: '£9.99', 3: '£24.99' };
  var SLICES = { 1: 8, 2: 16, 3: 24 };

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
    ],
    // Ribbons: the band round each upper tier and the bow on the gift box. These used to
    // borrow the candle colour, so you couldn't have white candles and a red ribbon. One
    // field covers both — they read as the same ribbon.
    ribbon: [
      { name: 'Pink',  hex: 0xFF6F91 },
      { name: 'Red',   hex: 0xE03131 },
      { name: 'Gold',  hex: 0xE9C46A },
      { name: 'Cream', hex: 0xFFF1D6 },
      { name: 'Sage',  hex: 0x9BBF9B },
      { name: 'Blue',  hex: 0x4FC3F7 },
      { name: 'Plum',  hex: 0x8E5A9B },
      { name: 'Ink',   hex: 0x3B2A2A },
      { name: 'White', hex: 0xFFFFFF }          // appended: indices in existing links are unchanged
    ],
    // Message colour. Index 0 keeps the old behaviour: dark or light picked from the
    // frosting's luminance. Everything after it is an explicit choice.
    text: [
      { name: 'Auto',  auto: true },
      { name: 'Ink',   hex: 0x3B2A2A },
      { name: 'White', hex: 0xFFFAF0 },
      { name: 'Gold',  hex: 0xE9C46A },
      { name: 'Red',   hex: 0xE03131 },
      { name: 'Pink',  hex: 0xFF6F91 },
      { name: 'Blue',  hex: 0x2F6FB5 },
      { name: 'Green', hex: 0x3E7B55 },
      { name: 'Plum',  hex: 0x8E5A9B }
    ],
    // Background gradients. Index 0 is the legacy behaviour (derived from the frosting),
    // kept so every link sent before v0.16 renders exactly as it did. Everything else is
    // a deliberate choice, because a backdrop that matches the cake washes it out.
    // One paint colour each. The world is a single featureless plane (stage.js), so the
    // "sky" is the same paint receding into the distance — there is no second colour.
    // (`layers` is kept for the swatch preview: a slightly lighter top hints at depth.)
    background: [
      { name: 'Match the cake', auto: true },
      { name: 'Cream',     floor: 0xFFEBD2, layers: [0xFFF6E9, 0xFFE7CE] },
      { name: 'Warm grey', floor: 0xE1DBD2, layers: [0xF2EFEA, 0xDCD6CE] },
      { name: 'Blush',     floor: 0xF9DDE6, layers: [0xFFEDF2, 0xF7D9E3] },
      { name: 'Sky',       floor: 0xC9E3F7, layers: [0xDFF1FF, 0xBFDFF5] },
      { name: 'Mint',      floor: 0xCBE9DB, layers: [0xE4F6EE, 0xC2E6D6] },
      { name: 'Dusk',      floor: 0x453E6B, layers: [0x6E6597, 0x3B3560] },
      { name: 'Midnight',  floor: 0x161C33, layers: [0x24304A, 0x11162A] },
      { name: 'Ink',       floor: 0x18131C, layers: [0x2A2430, 0x141018] },
      { name: 'White',     floor: 0xFFFFFF, layers: [0xFFFFFF, 0xF4F4F4] }   // appended: indices unchanged
    ]
  };

  // Occasions. `rule` says whether and how it recurs, which is what the reminder needs:
  //   yearly   — recurs on a date the sender tells us (birthday, anniversary)
  //   fixed    — same date for everyone (Christmas, Valentine's)
  //   weekday  — nth weekday of a month (Father's Day: 3rd Sunday of June, UK/US/CA)
  //   becomes  — a one-off that turns into a yearly one (a birth → first birthday; a wedding → anniversary)
  //   none     — one-off; we offer a birthday reminder for the recipient instead
  // Mother's Day and Easter move by country/calendar and aren't expressible as a simple rule; skipped.
  var OCCASIONS = [
    { name: 'Birthday',        emoji: '🎂', rule: { type: 'yearly' },                     say: 'birthday' },
    { name: 'Christmas',       emoji: '🎄', rule: { type: 'fixed', m: 12, d: 25 },          say: 'Christmas' },
    { name: 'Anniversary',     emoji: '💍', rule: { type: 'yearly' },                     say: 'anniversary' },
    { name: 'New baby',        emoji: '🍼', rule: { type: 'becomes', into: 'first birthday' }, say: 'first birthday' },
    { name: 'Wedding',         emoji: '💒', rule: { type: 'becomes', into: 'anniversary' }, say: 'anniversary' },
    { name: "Valentine's",     emoji: '❤️', rule: { type: 'fixed', m: 2, d: 14 },           say: "Valentine's" },
    { name: "Mother's Day",    emoji: '🌷', rule: { type: 'none' } },
    { name: "Father's Day",    emoji: '👔', rule: { type: 'weekday', m: 6, wd: 'SU', n: 3 }, say: "Father's Day" },
    { name: 'Get well',        emoji: '🩹', rule: { type: 'none' } },
    { name: 'Congratulations', emoji: '🎉', rule: { type: 'none' } },
    { name: 'Thank you',       emoji: '🙏', rule: { type: 'none' } },
    { name: 'Just because',    emoji: '✨', rule: { type: 'none' } },
    { name: 'Graduation',      emoji: '🎓', rule: { type: 'none' } },
    { name: 'Leaving',         emoji: '👋', rule: { type: 'none' } },
    { name: 'Halloween',       emoji: '🎃', rule: { type: 'fixed', m: 10, d: 31 },          say: 'Halloween' },
    { name: 'New Year',        emoji: '🥂', rule: { type: 'fixed', m: 1, d: 1 },            say: 'New Year' }
  ];
  var REMIND_LEAD_DAYS = 3;
  // If the sender never picks an occasion, this is what the cake is sent as. "Just because"
  // makes no recurrence claim, so the reminder honestly asks for a birthday instead of
  // inventing an anniversary. (Links decode a missing `o` as Birthday for legacy reasons;
  // this only applies to a fresh build where nothing was chosen.)
  var OCCASION_UNCHOSEN = -1;
  var OCCASION_FALLBACK = 11;   // 'Just because'

  var SPONGE = 0xE9C07A;
  var INK_DARK = '#3b2a2a';
  var INK_LIGHT = '#fffaf0';
  var TIERS = {
    1: [ { r: 2.2, h: 1.6 } ],                                                  // bottom tier first
    2: [ { r: 2.5, h: 1.5 }, { r: 1.45, h: 1.3 } ],
    3: [ { r: 2.7, h: 1.4 }, { r: 1.95, h: 1.2 }, { r: 1.2, h: 1.0 } ]
  };
  var CAP_H = 0.32;
  var PLATE_TOP = 0;      // cake sits on the ground; the contact shadow does the grounding
  var ROTATION_SECONDS_PER_TURN = 24;
  // Rendering fidelity.
  //
  // Capping at 2 was leaving detail on the table: iPhone Pro screens report
  // devicePixelRatio 3, so we were rendering at two-thirds of the panel's real
  // resolution. But going straight to 3 is 2.25× the pixels, which some phones
  // can't hold at 60fps with 100 candles and 400 confetti pieces on screen.
  //
  // So: start at 2, measure, and climb toward the device's real ratio only if
  // there's frame-time headroom — dropping back if there isn't.
  // Rendering runs at the device's full pixel ratio with every effect on. Phone testing
  // (20 Sept) showed the frame rate barely moves, so nothing is traded away by default.
  //
  // The ONE remaining safety net is an emergency fallback for a phone that genuinely can't
  // hold the target, sustained over several seconds: hard shadows and no halos, and back
  // again once it has been comfortable for a while. It never touches resolution.
  var PIXEL = {
    ceil: 4,                     // the device's ratio, up to this
    lateMs: 22,                  // a frame slower than this (≈45fps) counts as late
    dropFrac: 0.25,              // a window is "bad" when more than this fraction were late
    climbFrac: 0.05,             // …and "good" when fewer than this were
    badWindows: 4,               // ≈5s of sustained trouble before the fallback engages
    goodWindows: 8,              // ≈10s of comfort before it lets go
    checkMs: 1200,
    graceMs: 1500,               // ignore the first window: first paint, font load, texture upload
    rebuildGraceMs: 900,         // …and the window after any rebuild (tier switch, cut, slice)
    minSamples: 10               // a window with fewer frames than this (tab hidden, keyboard up) is ignored
  };
  // Strategy: START HIGH, DROP ON EVIDENCE. The previous "start at 2 and climb" never climbed on
  // iPhones: lateness was judged against the display's fastest interval, and on a 120Hz
  // ProMotion panel a rock-steady 60fps read as every frame being late. A moment of stutter in
  // the first second is far less bad than permanent blur.
  // Why not frame interval: requestAnimationFrame is locked to the display, so on a 60Hz
  // screen every frame reports ~16.7ms however cheap it was to draw. Measured that way the
  // ratio could never climb — which is exactly what happened on iPhones from v0.15 to v0.23.
  var CYL_SEG = 96;              // cylinder segments: silhouette stays smooth when zoomed in

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
      cc: clampInt(c.cc, 0, PALETTES.candle.length - 1, 0),
      // Missing on pre-v0.16 links, which is exactly what index 0 means: derive it
      // from the frosting, as those cakes always did. New fields append, never rename.
      bg: clampInt(c.bg, 0, PALETTES.background.length - 1, 0),
      // Appended after bg. Missing on older links → index 0 (Pink), which is what the
      // default candle colour produced on those cakes anyway.
      rc: clampInt(c.rc, 0, PALETTES.ribbon.length - 1, 0),
      // Appended after rc. Missing on older links → 0 (Auto), which is what they did.
      tc: clampInt(c.tc, 0, PALETTES.text.length - 1, 0),
      // Appended after tc. Missing on older links → 0 (Birthday), which is what they were.
      o: clampInt(c.o, 0, OCCASIONS.length - 1, 0),
      // Lighting, appended after o: the room the sender lit the cake in (look.js serialises
      // it; '' means "as designed"). Only digits, '.', '-' and '~' survive.
      lt: String(c.lt || '').replace(/[^0-9.~-]/g, '').slice(0, 200),
      ly: clampInt(c.ly, 2, 4, 3),          // sponge layers (fillings = ly − 1)
      fr: clampInt(c.fr, 0, 1, 1)           // frosting: 0 none (naked), 1 smooth
    };
  }
  function encodeConfig(c) {
    c = normalize(c);
    var parts = [c.v, encodeURIComponent(c.to), encodeURIComponent(c.from), encodeURIComponent(c.m),
                 c.n, c.t, c.fc, c.ic, c.cc, c.bg, c.rc, c.tc, c.o, c.lt, c.ly, c.fr];
    return b64url(parts.join('|'));
  }
  function decodeConfig(code) {
    try {
      var p = unb64url(code).split('|');
      if ((p[0] | 0) < 1) return null;
      var dec = function (s) { try { return decodeURIComponent(s || ''); } catch (e) { return ''; } };
      return normalize({ to: dec(p[1]), from: dec(p[2]), m: dec(p[3]), n: p[4], t: p[5],
                         fc: p[6], ic: p[7], cc: p[8], bg: p[9], rc: p[10], tc: p[11], o: p[12], lt: p[13], ly: p[14], fr: p[15] });
    } catch (e) { return null; }
  }
  function readHash() {
    var h = location.hash || '';
    var m = /[#&]c=([A-Za-z0-9_-]+)/.exec(h);
    return m ? decodeConfig(m[1]) : null;
  }
  // #edit=<code>: open the BUILDER pre-filled with that cake. This is what a calendar
  // reminder links to ("send Hollie a cake" → last year's cake, ready to tweak), and what
  // "Send one back to Eddie" links to.
  function readEditHash() {
    var h = location.hash || '';
    var m = /[#&]edit=([A-Za-z0-9_-]+)/.exec(h);
    return m ? decodeConfig(m[1]) : null;
  }
  function editLinkFor(c) { return baseUrl() + '#edit=' + encodeConfig(c); }
  // Slice links: #c=<cake>&s=<slice index>[&b=1][&n=<name>][&sb=1]
  //   b  = the candles had been blown out when this slice was sent
  //   n  = who the slice is for
  //   sb = this slice went back to the sender (the acknowledgement)
  function readSliceHash() {
    var h = location.hash || '';
    var m = /[#&]s=(\d+)/.exec(h);
    if (!m) return null;
    var n = /[#&]n=([^&]*)/.exec(h);
    var name = ''; try { name = n ? cleanText(decodeURIComponent(n[1]), MAX_NAME) : ''; } catch (e) {}
    return { index: m[1] | 0, blown: /[#&]b=1/.test(h), name: name, back: /[#&]sb=1/.test(h) };
  }
  function sliceLinkFor(c, index, opts) {
    var u = linkFor(c) + '&s=' + index;
    if (opts.blown) u += '&b=1';
    if (opts.name) u += '&n=' + encodeURIComponent(opts.name);
    if (opts.back) u += '&sb=1';
    return u;
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
    // Iterate a snapshot. A done() callback is allowed to start new tweens, finish them
    // all, or clear the list — finishCeremony() does exactly that — and mutating the live
    // array mid-loop leaves the index pointing past the end of a replaced array.
    var list = tweens.slice();
    var finished = null;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (!o || now < o.start) continue;
      var t = Math.min(1, (now - o.start) / o.duration);
      o.k = (o.ease || EASE.soft)(t);
      o.update(o.k, t);
      if (t >= 1) (finished || (finished = [])).push(o);
    }
    if (!finished) return;
    tweens = tweens.filter(function (o) { return finished.indexOf(o) === -1; });
    for (var j = 0; j < finished.length; j++) {
      if (finished[j].done) finished[j].done();
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
  var deviceDPR = window.devicePixelRatio || 1;
  var pixelRatio = Math.min(deviceDPR, PIXEL.ceil);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 6.2, 12.4);
  camera.lookAt(0, 1.35, 0);

  // Lights. Intensities come from look.js when it's present: the environment provides
  // most of the fill, so the direct lights step back.
  var LI = (window.CakeLook && CakeLook.LOOK.lights) || { ambient: 0.55, key: 0.9, fill: 0.35 };
  // Hemisphere light when the look supplies one (sky from above, warm bounce from below);
  // flat ambient otherwise.
  var ambientLight = LI.hemiSky
    ? new THREE.HemisphereLight(new THREE.Color(LI.hemiSky), new THREE.Color(LI.hemiGround), LI.hemi)
    : new THREE.AmbientLight(0xffffff, LI.ambient);
  scene.add(ambientLight);
  var key = new THREE.DirectionalLight(0xfff1dd, LI.key);
  key.position.set(-4, 7, 5);
  scene.add(key);
  // The spot: off unless the look says otherwise. Aimed at the cake's centre.
  var spot = new THREE.SpotLight(0xffffff, 0, 30, Math.PI / 6, 0.5, 2);
  spot.visible = false; spot.target.position.set(0, 0.8, 0);
  scene.add(spot); scene.add(spot.target);
  var fill = new THREE.DirectionalLight(0xdcefff, LI.fill);
  fill.position.set(5, 3, -2);
  scene.add(fill);
  // The look (shadows, optional environment and tone mapping) lives in look.js.
  if (window.CakeLook) CakeLook.apply(renderer, scene, key);
  // The stage (lit floor, fog, sky) lives in stage.js.
  if (window.CakeStage) CakeStage.attach(scene);
  var candleLight = new THREE.PointLight(0xffb36b, 0, 8, 2);
  scene.add(candleLight);

  // Nothing on screen is ever rotated: the camera orbits, the cake stays put and upright.
  var cakeGroup = new THREE.Group();
  scene.add(cakeGroup);

  // Contact shadow instead of a plate: a soft dark disc on the ground.
  // Lives in the scene, not cakeGroup, so it never spins.
  var shadowTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    // Core stays strong out to ~0.62 of the radius (that's where the cake's own footprint
    // ends), then falls away, so what you actually see is a soft ring hugging the base.
    // Transparent BLACK, not a warm tint: compositing black at alpha a is a multiply by
    // (1 − a), so the disc can only darken what's under it. The old warm brown was lighter
    // than a dark floor and showed as a halo around the cake with every light off.
    var grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0.00, 'rgba(0,0,0,0.34)');
    grad.addColorStop(0.62, 'rgba(0,0,0,0.30)');
    grad.addColorStop(0.76, 'rgba(0,0,0,0.13)');
    grad.addColorStop(0.90, 'rgba(0,0,0,0.04)');
    grad.addColorStop(1.00, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c); t.__shared = true; return t;
  })();
  // Multiply blending: the disc darkens whatever is under it and can never add light — on a
  // cream floor it deepens the base, on a black floor it stays black. As a painted decal it
  // showed as a faint halo around the cake when every light was off.
  var contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.004;
  contactShadow.renderOrder = -1;
  scene.add(contactShadow);
  // The cake never tilts, so nothing can cut the shadow plane. It only needs to fade
  // out as the view approaches side-on, where a ground shadow is edge-on anyway.
  var shadowRadius = 2.2;
  function updateShadow() {
    var t = Math.max(0, Math.min(1, (camElev - CAM_ELEV_MIN) / 18));
    var discScale = (window.CakeLook && CakeLook.LOOK.shadows) ? CakeLook.LOOK.contactDiscScale : 1;
    if (window.CakeStage) discScale *= 0.7;                    // the lit floor carries the real shadow now
    contactShadow.material.opacity = (0.12 + 0.88 * t) * (0.18 + 0.82 * Math.min(1, bgLuminance / 0.55)) * discScale;
  }
  function fitShadow(radius) {
    shadowRadius = radius;
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
    toneMapped: false,             // additive glow tuned by eye; ACES would dim it
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
    markHeavy();
    built.visible = true;
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
    var ribbonHex = PALETTES.ribbon[clampIndex(cfg.rc, PALETTES.ribbon)].hex;
    var ink = pickInk(frosting, cfg.tc);

    // Frosting is a choice (v0.54). Naked: the sponge itself, slightly smaller, wearing its
    // filling stripes round the side and a plain crumb top. Frosted: the one-shell frosting.
    var naked = !cfg.fr;
    var sponge = { layers: filling, count: cfg.ly };
    var frostingMat = naked
      ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: makeLayersTexture(filling, cfg.ly), vertexColors: true })
      : new THREE.MeshStandardMaterial({ color: frosting, roughness: 0.62, vertexColors: true });
    if (naked) frostingMat.map.wrapS = THREE.RepeatWrapping;
    // Same colour as the sides (v0.53): one frosting shell. The cap is separate geometry only
    // because the side carries the message texture and the top doesn't.
    var capMat = naked
      ? new THREE.MeshStandardMaterial({ color: SPONGE, roughness: 0.95, vertexColors: true })
      : new THREE.MeshStandardMaterial({ color: frosting, roughness: 0.55, vertexColors: true });
    nightGlow(frostingMat, naked ? SPONGE : frosting, false); nightGlow(capMat, naked ? SPONGE : frosting, false);
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
          color: 0xffffff, roughness: naked ? 0.95 : 0.62,
          map: makeMessageTexture(cfg.m, ink, frosting, tier.r, bodyH, naked ? sponge : null), vertexColors: true
        });
        nightGlow(sideMat, 0xffffff, true);
      }
      // Rounded lathe profiles (shapes.js): a slight bulge, a rounded base, a rounded rim.
      // The lathe's origin is its base, not its centre, hence the different .position.y.
      var rr = naked ? tier.r - FROST_T : tier.r;   // the sponge is what's left when the frosting is off
      var bodyGeo = CakeShapes.body(rr, bodyH, CYL_SEG, open, Math.PI * 2 - open);
      var body = new THREE.Mesh(bodyGeo, [sideMat, frostingMat, frostingMat]);
      body.position.y = y;
      tg.add(body);
      if (tier === messageTier) { messageMesh = body; body.__tier = tier; body.__bodyH = bodyH; }

      // Frosting cap, a touch wider than the body
      var above = tiers[i + 1];                 // the tier sitting on this one, if any
      var capGeo = CakeShapes.cap(rr, CAP_H, CYL_SEG, open, Math.PI * 2 - open, above ? (naked ? above.r - FROST_T : above.r) : undefined);
      var cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = y + bodyH;
      tg.add(cap);
      // (The old torus "drip band" at the cap/body seam is gone: the cap's underside lip
      // and the sponge's top tuck now meet properly, so there's no seam to hide.)

      // Cut faces (dev cut-away): two planes showing sponge + filling layers
      if (cfg.cutaway) {
        var faceTex = makeLayersTexture(filling);
        var faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.9, side: THREE.DoubleSide, vertexColors: true });
        faceMat.__shared = true; localShared.push(faceMat);
        [0, open].forEach(function (theta) {
          var face = new THREE.Mesh(CakeShapes.cutFace(tier.r, bodyH, CAP_H), faceMat);
          face.position.set(0, y, 0);
          // The shape's +x is radius; rotating by (θ − π/2) about Y points it along (sin θ, cos θ).
          face.rotation.y = theta - Math.PI / 2;
          tg.add(face);
        });
        // Inner core so the cake isn't hollow when you look in
        var core = new THREE.Mesh(
          new THREE.CylinderGeometry(tier.r - 0.01, tier.r - 0.01, tier.h - 0.02, CYL_SEG, 1, true, open, Math.PI * 2 - open),
          new THREE.MeshStandardMaterial({ color: SPONGE, roughness: 1, side: THREE.BackSide })
        );
        core.position.y = y + tier.h / 2;
        tg.add(core);
      }

      // Ribbon at the base of upper tiers, in the candle colour
      if (i > 0) {
        var ribbon = new THREE.Mesh(
          new THREE.CylinderGeometry(tier.r + 0.05, tier.r + 0.05, 0.16, CYL_SEG, 1, true),
          new THREE.MeshStandardMaterial({ color: ribbonHex, roughness: 0.5, side: THREE.DoubleSide })
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
    rebuildLandings(cfg);
    if (window.CakeLook) CakeLook.adopt(built);
    FRAME.cake = cakeFrame(cfg.t);
    if (!boxMode) { frameTarget = FRAME.cake; camTargetY = centreOfMass(cfg.t); }
    candleLight.position.set(0, y + 0.9, 0);
    candleLight.intensity = window.CakeLook ? CakeLook.candleIntensity(flames.length, darkness) : Math.min(1.6, 0.25 + flames.length * 0.03);

    applyBackground(frosting, cfg.bg);
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
      var nakedNow = !config.fr;
      var fillingNow = PALETTES.filling[clampIndex(config.ic, PALETTES.filling)].layers;
      mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: nakedNow ? 0.95 : 0.62,
        map: makeMessageTexture(m, pickInk(frosting, config.tc), frosting, tier.r, bodyH, nakedNow ? { layers: fillingNow, count: config.ly } : null), vertexColors: true
      });
      nightGlow(mat, 0xffffff, true);
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
      // The halo: same pivot, follows the flame in the update loop. Skipped on every other
      // candle past the budget so 100 candles is still 150 sprites, not 200.
      var halo = null;
      if (window.CakeLook && CakeLook.LOOK.halo.enabled && (pts.length <= CakeLook.LOOK.halo.maxHalos || i % 2 === 0)) {
        halo = new THREE.Sprite(CakeLook.haloMaterial());
        halo.scale.set(fs * CakeLook.LOOK.halo.scale, fs * CakeLook.LOOK.halo.scale, 1);
        halo.position.copy(flame.position);
        halo.renderOrder = -1;                           // behind the core
        built.add(halo);
      }
      flames.push({ sprite: flame, halo: halo, base: fs, phase: ((i * 0.618) % 1) * Math.PI * 2, x: p.x, z: p.z,
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
  // `sponge` (optional): { layers, count } — paint the naked sponge's stripes as the background
  // instead of a flat frosting colour, so the message is piped straight onto the cake.
  function makeMessageTexture(text, ink, frostingHex, radius, bodyH, sponge) {
    text = String(text).slice(0, MAX_MSG);
    var circumference = 2 * Math.PI * radius;
    // The message is the thing people zoom into, so size its canvas off the real
    // device ratio rather than a fixed number. The texture is short (a thin band
    // round the cylinder), so even 4096 wide costs little memory.
    var W = deviceDPR >= 2 ? 4096 : 2048;
    var H = Math.max(96, Math.round(W * (bodyH / circumference)));   // square pixels on the cylinder
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    if (sponge) paintLayers(g, W, H, sponge.layers, Math.max(1, sponge.count - 1));
    else { g.fillStyle = hexCss(frostingHex); g.fillRect(0, 0, W, H); }

    // Text occupies ~34% of the circumference (≈120° arc) so it reads from the front.
    var maxW = W * 0.34;
    var maxH = H * 0.78;
    var fit = wrapLines(g, text, maxW, maxH);
    var size = fit.size;

    g.font = size + 'px "Pacifico", cursive';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';          // position by the baseline, not the em box
    var lineH = fit.lineH;
    var blockH = fit.ink.asc + fit.ink.desc + (fit.lines.length - 1) * lineH;
    var startY = (H - blockH) / 2 + fit.ink.asc;   // centre the INK block, then step by baselines

    fit.lines.forEach(function (ln, i) {
      var yy = startY + i * lineH;
      // Piped look: soft shadow, a raised highlight, then the ink.
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillText(ln, W / 2 + size * 0.03, yy + size * 0.06);
      var inkLum = (function () { var c = new THREE.Color(ink); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; })();
      g.fillStyle = inkLum < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';
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

  // Real ink extents, not the em box. Pacifico's ascenders and descenders overshoot its
  // em box badly, which is why a 'y' tail was being clipped off the bottom of the band.
  function inkExtents(g, lines, size) {
    var asc = 0, desc = 0, ok = false;
    for (var i = 0; i < lines.length; i++) {
      var m = g.measureText(lines[i]);
      if (typeof m.actualBoundingBoxAscent === 'number') {
        ok = true;
        asc = Math.max(asc, m.actualBoundingBoxAscent);
        desc = Math.max(desc, m.actualBoundingBoxDescent);
      }
    }
    if (!ok) { asc = size * 0.80; desc = size * 0.34; }   // fallback for engines without ink metrics
    return { asc: asc, desc: desc };
  }

  function wrapLines(g, text, maxW, maxH) {
    // One line, then two, then three; shrink until it fits.
    for (var n = 1; n <= 3; n++) {
      var size = Math.floor(maxH / (n * 1.15));
      while (size > 24) {
        g.font = size + 'px "Pacifico", cursive';
        var lines = splitInto(g, text, n, maxW);
        if (lines) {
          // Does the actual ink fit, tallest ascender to deepest descender? Shrink until it does.
          var ink = inkExtents(g, lines, size);
          var lineH = size * 1.06;
          if (ink.asc + ink.desc + (lines.length - 1) * lineH <= maxH) {
            return { lines: lines, size: size, ink: ink, lineH: lineH };
          }
        }
        size -= 3;
      }
    }
    g.font = '24px "Pacifico", cursive';
    return { lines: [text], size: 24, ink: inkExtents(g, [text], 24), lineH: 26 };
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

  // Draws sponge and filling stripes onto a 2D context, bottom→top. `bands` fillings.
  function paintLayers(g, W, H, layers, bands) {
    g.fillStyle = hexCss(SPONGE);
    g.fillRect(0, 0, W, H);
    var spongeH = H / ((bands + 1) + bands * 0.55);
    var fillH = spongeH * 0.55;
    var y = H;
    for (var i = 0; i < bands; i++) {
      y -= spongeH + fillH;
      g.fillStyle = hexCss(layers[i % layers.length]);
      g.fillRect(0, y, W, fillH);
    }
    g.fillStyle = 'rgba(120,80,30,0.08)';                  // crumb
    var n = Math.round(W * H / 160);
    for (var k = 0; k < n; k++) g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  function makeLayersTexture(layers, spongeLayers) {
    // Sponge / filling stripes for cut faces and naked sides. Filling colours run bottom→top.
    var c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    var g = c.getContext('2d');
    var bands = Math.max(1, (spongeLayers || 3) - 1);       // fillings between the sponge layers
    paintLayers(g, 256, 256, layers, bands);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function makeLayersTextureOLD(layers) {
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
  function darken(hex, amt) {
    return new THREE.Color(hex).lerp(new THREE.Color(0x000000), amt).getHex();
  }
  function lighten(hex, amt) {
    return new THREE.Color(hex).lerp(new THREE.Color(0xffffff), amt).getHex();
  }
  function luminance(hex) {
    var c = new THREE.Color(hex);
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  }
  // The cake→floor colour bleed disc: frosting colour, sized to the bottom tier, off while the
  // cake is boxed or gone.
  function updateBleed() {
    if (!window.CakeLook || !config) return;
    var frosting = PALETTES.frosting[clampIndex(config.fc, PALETTES.frosting)].hex;
    var r = (TIERS[config.t] || TIERS[1])[0].r;
    var onFloor = !boxMode && built.visible !== false || !!cut;
    var left = cut ? slicesLeft() + (cut.lifted ? 1 : 0) : 1;
    CakeLook.setBleed(scene, new THREE.Color(frosting), r, onFloor && left > 0 && viewerMode !== 'slice', roomLit, candleLight.intensity);
  }
  // Materials for a tier — frosted shell or naked sponge — from a config. Shared by the whole
  // cake, the cut wedges and the slice page so the three can't disagree.
  function tierMaterials(cfg) {
    var frosting = PALETTES.frosting[clampIndex(cfg.fc, PALETTES.frosting)].hex;
    var filling = PALETTES.filling[clampIndex(cfg.ic, PALETTES.filling)].layers;
    var naked = !cfg.fr;
    var side, cap;
    if (naked) {
      side = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: makeLayersTexture(filling, cfg.ly), vertexColors: true });
      side.map.wrapS = THREE.RepeatWrapping;
      cap = new THREE.MeshStandardMaterial({ color: SPONGE, roughness: 0.95, vertexColors: true });
    } else {
      side = new THREE.MeshStandardMaterial({ color: frosting, roughness: 0.62, vertexColors: true });
      cap = new THREE.MeshStandardMaterial({ color: frosting, roughness: 0.55, vertexColors: true });
    }
    nightGlow(side, naked ? SPONGE : frosting, false); nightGlow(cap, naked ? SPONGE : frosting, false);
    var face = new THREE.MeshStandardMaterial({ map: makeLayersTexture(filling, cfg.ly), roughness: 0.9, side: THREE.DoubleSide, vertexColors: true });
    return { side: side, cap: cap, face: face, frosting: frosting, filling: filling, naked: naked };
  }
  // At night the cake gets a faint self-glow so the shape never goes fully black, and the
  // message band a little more so the writing stays readable. Zero in daylight.
  // Materials that carry the night self-glow, with their full-strength intensity. The
  // per-frame loop scales them by how many candles are lit (see updateFlames).
  var glowMats = [];
  function nightGlow(mat, hex, isMessage) {
    if (!window.CakeLook) return;
    var N = CakeLook.LOOK.night;
    mat.emissive = new THREE.Color(hex);
    mat.emissiveIntensity = 0;                        // starts dark; the flames bring it up
    if (isMessage && mat.map) mat.emissiveMap = mat.map;
    glowMats.push({ m: mat, base: isMessage ? N.emissiveMessage : N.emissiveFrosting });
    if (glowMats.length > 64) glowMats.splice(0, glowMats.length - 64);   // old builds' materials fall away
  }
  function pickInk(frostingHex, tcIndex) {
    var opt = PALETTES.text[clampIndex(tcIndex, PALETTES.text)];
    if (!opt.auto) return hexCss(opt.hex);
    return luminance(frostingHex) > 0.42 ? INK_DARK : INK_LIGHT;
  }
  // Rough WCAG-ish contrast between the message and the frosting it sits on.
  function inkContrast(inkCss, frostingHex) {
    var a = new THREE.Color(inkCss), b = new THREE.Color(frostingHex);
    var la = 0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b;
    var lb = 0.2126 * b.r + 0.7152 * b.g + 0.0722 * b.b;
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  var bgLuminance = 1;          // 0 = dark backdrop, 1 = light. Drives the shadow and the room lights.
  var darkness = 0;             // 0 daylight … 1 candlelit (look.js decides from bgLuminance)
  var floorPaint = new THREE.Color(0xffebd2), roomLit = 1;
  function updateRoomLights() {
    if (!window.CakeLook) return;
    darkness = CakeLook.darknessFor(bgLuminance);
    var R = CakeLook.roomLights(darkness, floorPaint);
    if (ambientLight.isHemisphereLight) { ambientLight.intensity = R.hemi; ambientLight.color.copy(R.hemiSky); ambientLight.groundColor.copy(R.hemiGround); }
    else ambientLight.intensity = R.hemi;
    key.intensity = R.key; fill.intensity = R.fill;
    CakeLook.keyPosition(key.position);              // elevation / azimuth from the look
    if (CakeLook.LOOK.keyHex >= 0) key.color.setHex(CakeLook.LOOK.keyHex);
    else CakeLook.kelvinToColor(CakeLook.LOOK.keyKelvin, key.color);
    var wasCasting = spot.castShadow, wasVisible = spot.visible;
    CakeLook.applySpot(spot);
    spot.target.position.set(0, config ? centreOfMass(config.t) : 0.8, 0);
    // A light that starts or stops casting changes every material's shader; recompile once, now.
    if (spot.castShadow !== wasCasting || spot.visible !== wasVisible) {
      scene.traverse(function (o) { var m = o.material; if (!m) return; (Array.isArray(m) ? m : [m]).forEach(function (mm) { mm.needsUpdate = true; }); });
      markHeavy();
    }
    candleLight.distance = CakeLook.LOOK.night.distance; candleLight.decay = CakeLook.LOOK.night.decay;
    if (window.CakeStage) {
      var kd = key.position.clone().normalize();
      roomLit = CakeLook.litFactor(R, kd, key.color);
      CakeStage.setBrightness(roomLit);
    }
    updateBleed();
  }
  function applyBackground(frostingHex, bgIndex) {
    var opt = PALETTES.background[clampIndex(bgIndex, PALETTES.background)];
    var top, bottom;
    if (opt.auto) {
      top = new THREE.Color(frostingHex).lerp(new THREE.Color(0xffffff), 0.72);
      bottom = new THREE.Color(0xffe9c7).lerp(new THREE.Color(frostingHex), 0.15);
    } else {
      bottom = new THREE.Color(opt.floor || opt.layers[1]);
      top = bottom;
    }
    // The palette's two colours are now the SKY and the FLOOR PAINT. The floor is a real lit
    // plane (stage.js); the sky is the CSS gradient above the horizon. Both dim with the room.
    bgLuminance = 0.2126 * bottom.r + 0.7152 * bottom.g + 0.0722 * bottom.b;
    floorPaint.copy(bottom);
    document.body.classList.toggle('dark-bg', bgLuminance < 0.42);
    if (window.CakeStage) CakeStage.setColour('#' + bottom.getHexString());
    else {
      var root = document.documentElement.style;
      root.setProperty('--sky-top', '#' + top.getHexString());
      root.setProperty('--sky-bottom', '#' + bottom.getHexString());
    }
    updateRoomLights();
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
    // One comfortable swipe (80% of the canvas height) should cover the entire tilt range.
    TILT.pxPerRad = (h * TILT.swipeFraction) / (TILT.max - TILT.min);
    measureFree(); free.top = freeTarget.top; free.bottom = freeTarget.bottom;   // no easing on resize
    frameCamera();
  }
  // Keep the whole plate in shot whatever the canvas aspect (portrait phones are narrow).
  // Elevation: 26° read as "table height"; 36° shows the candles and the top face,
  // which is the shot. Past ~40° the message on the side starts to squash.
  var CAM_ELEV_BASE = 36;        // resting elevation
  var CAM_ELEV_MIN = 2;          // fully side on
  var CAM_ELEV_MAX = 88;         // fully top down (never exactly 90: the up-vector degenerates)
  var camElev = CAM_ELEV_BASE;   // degrees
  var camAzimuth = 0;            // radians, around Y
  var camRoll = 0;               // radians, about the view axis
  var camZoom = 1;               // multiplier on the framed distance (smaller = closer)
  var ZOOM = { min: 0.64, max: 2.4 };   // smaller = closer. 0.64 = halfway between v0.12 (0.45) and v0.13 (0.82).
  // Radius the camera frames to. Cake: two-tier r=2.5 plus air (bigger number = smaller cake).
  // Box: its corner diagonal, or the lid gets cropped on a narrow phone.
  var FRAME = { cake: 3.6, box: 5.2 };   // 'cake' is recomputed per tier by cakeFrame()
  // Volume-weighted centre of mass (r²h per tier). The camera aims here, so one-, two- and
  // three-tier cakes all sit balanced instead of a fixed height that only suits the Classic.
  function centreOfMass(tierKey) {
    var tiers = TIERS[tierKey] || TIERS[1], num = 0, den = 0, y = PLATE_TOP;
    tiers.forEach(function (t) { var v = t.r * t.r * t.h; num += v * (y + t.h / 2); den += v; y += t.h; });
    return den ? num / den : 0.8;
  }
  // Framing radius from the cake's real size: wide cakes need width, tall cakes need height.
  function cakeFrame(tierKey) {
    var tiers = TIERS[tierKey] || TIERS[1], h = PLATE_TOP;
    tiers.forEach(function (t) { h += t.h; });
    return Math.max(tiers[0].r * 1.45, (h + 0.7) * 0.95);
  }
  var frameRadius = FRAME.cake;
  var camTargetY = 1.3, camY = 1.3;
  var frameTarget = 3.3;
  function frameCamera() {
    var vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    var hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    // Distance: far enough that the framed radius fits the free HEIGHT and the full width.
    var vh = canvas.clientHeight || 1;
    var freeH = Math.max(80, free.bottom - free.top);
    var distH = frameRadius / Math.tan(hHalf);
    var distV = frameRadius / (Math.tan(vHalf) * (freeH / vh));
    var dist = Math.max(9.0, distH, distV) * camZoom;
    var e = THREE.MathUtils.degToRad(camElev);
    var a = camAzimuth;
    // Orbit AROUND the cake's centre and aim AT it. Every gesture then pivots on the cake:
    // spin and tilt orbit it, roll turns about the axis through it, pinch zooms toward it.
    camera.position.set(
      dist * Math.cos(e) * Math.sin(a),
      camY + dist * Math.sin(e),
      dist * Math.cos(e) * Math.cos(a)
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(0, camY, 0);
    if (camRoll) camera.rotateZ(camRoll);      // about the view axis — which now passes through the cake
    // Put the cake where the free space is by shifting the PROJECTION, not the aim. Aiming
    // below the cake (the previous approach) made every rotation pivot on a point that
    // wasn't the cake, so a two-finger roll swung it round the screen centre instead of
    // turning it in place. A view offset is a shift lens: same perspective, verticals stay
    // vertical, and the pivot stays on the cake.
    var vw = canvas.clientWidth || 1;
    var pxOffset = (free.top + free.bottom) / 2 - vh / 2;     // negative = free centre is above middle
    camera.setViewOffset(vw, vh, 0, -pxOffset, vw, vh);
  }
  // Ease between framings rather than cutting (the box needs a wider frame than the cake).
  // Height of the TALLEST UI state, measured from the DOM rather than hardcoded, so the
  // cake's pinned position survives any future UI change — and, crucially, doesn't shift
  // as the sender moves from tray to tray.
  // The cake lives in the space the UI leaves free RIGHT NOW: from the bottom of anything
  // pinned to the top (slice header, gift tag) to the top of whatever is showing at the
  // bottom (chip row, tray, slice card, link panel). Measured, not assumed, so it keeps
  // working when the UI changes — and re-measured cheaply so the cake eases to a new spot
  // as trays open and close. That easing is the "scaling effect" and it's deliberate.
  var FREE_MARGIN = 22;                       // px of breathing room above and below the cake
  var free = { top: 0, bottom: 0 };           // eased, in canvas px
  var freeTarget = { top: 0, bottom: 0 };
  // Bottom-edge UI and top-edge UI are known by ROLE. Sorting elements by which half of
  // the screen their centre fell in — the first version — broke the moment a tall tray
  // pushed the chip row above the midpoint: the chips were counted as a top edge, the free
  // space collapsed to a sliver, and the cake was scaled into it, behind the UI.
  var TOP_UI = '.slice-head:not([hidden]), .lid-label';
  var BOTTOM_UI = '#builder:not([hidden]) .chiprow, #builder:not([hidden]) .tray:not([hidden]), #builder:not([hidden]) > .primary, ' +
                  '#viewer-foot:not([hidden]) .vstate:not([hidden]) > *, #linkpanel:not([hidden]) .sheet-scroll > *';
  var FREE_MIN = 140;                          // px: below this the cake is too small to mean anything
  function rendered(el) {
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    var b = el.getBoundingClientRect();
    return b.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
  function measureFree() {
    var r = canvas.getBoundingClientRect(), vh = r.height || 1;
    var top = 0, bottom = vh, i, b;
    var tops = document.querySelectorAll(TOP_UI);
    for (i = 0; i < tops.length; i++) if (rendered(tops[i])) { b = tops[i].getBoundingClientRect(); top = Math.max(top, b.bottom - r.top); }
    var bots = document.querySelectorAll(BOTTOM_UI);
    for (i = 0; i < bots.length; i++) if (rendered(bots[i])) { b = bots[i].getBoundingClientRect(); bottom = Math.min(bottom, b.top - r.top); }
    top += FREE_MARGIN; bottom -= FREE_MARGIN;
    if (bottom - top < FREE_MIN) {             // squeezed: keep a minimum, centred on what's left
      var mid = (top + bottom) / 2;
      top = mid - FREE_MIN / 2; bottom = mid + FREE_MIN / 2;
    }
    freeTarget.top = top; freeTarget.bottom = bottom;
  }
  var lastMeasure = 0;

  function setFrame(which, y, immediate) {
    frameTarget = FRAME[which];
    camTargetY = y;
    if (immediate) { frameRadius = frameTarget; camY = y; }
    frameCamera();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });

  var _right = new THREE.Vector3(), _upv = new THREE.Vector3(), _fwd = new THREE.Vector3();
  var clock = new THREE.Clock();
  var spinEnabled = true;     // off only while the cake is inside the closed box
  var running = false;

  // Frame-time sampling for the adaptive pixel ratio.
  var costAccum = 0, costCount = 0, lateCount = 0, fpsSince = 0, lastFrameAt = 0, bootAt = performance.now();
  var lastLateFrac = 0, badRun = 0, goodRun = 0, heavyUntil = 0, fallback = false;
  var qualityLog = [];
  // Anything that rebuilds the scene calls this so the spike it causes isn't read as evidence.
  function markHeavy() { heavyUntil = performance.now() + PIXEL.rebuildGraceMs; }
  function setFallback(on) {
    if (fallback === on || !window.CakeLook) return;
    fallback = on;
    CakeLook.emergency(on, renderer, scene, key);
    qualityLog.push((on ? 'fallback on' : 'fallback off') + ' @' + Math.round(performance.now() / 1000) + 's');
    markHeavy();
  }

  function tunePixelRatio(now, costMs) {
    // Lateness against a FIXED budget: a steady 60fps is the goal, and a frame under ~22ms is
    // fine whatever the display could do.
    if (lastFrameAt && now - lastFrameAt > PIXEL.lateMs) lateCount++;
    lastFrameAt = now;
    costAccum += costMs; costCount++;
    if (now - fpsSince < PIXEL.checkMs) return;
    var lateFrac = lastLateFrac = lateCount / Math.max(1, costCount);
    var samples = costCount;
    costAccum = 0; costCount = 0; lateCount = 0; fpsSince = now;
    if (now - bootAt < PIXEL.graceMs) return;                // first paint isn't evidence
    if (now < heavyUntil + PIXEL.checkMs) return;             // neither is the window after a rebuild
    if (samples < PIXEL.minSamples) return;                   // nor a window with hardly any frames (tab hidden, keyboard)
    if (lateFrac > PIXEL.dropFrac) { badRun++; goodRun = 0; }
    else if (lateFrac < PIXEL.climbFrac) { goodRun++; badRun = 0; }
    else { badRun = 0; goodRun = 0; }
    if (!fallback && badRun >= PIXEL.badWindows) { setFallback(true); badRun = 0; }
    else if (fallback && goodRun >= PIXEL.goodWindows) { setFallback(false); goodRun = 0; }
  }

  function frame() {
    var now = performance.now();
    if (window.CakeDev && CakeDev.on && !CakeDev.shouldRender(now)) { requestAnimationFrame(frame); return; }
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
    var frameStart = now;
    updateTweens(now);
    updateSpawn(now);
    if (Math.abs(camY - camTargetY) > 0.001 || Math.abs(frameRadius - frameTarget) > 0.001) {
      camY += (camTargetY - camY) * Math.min(1, dt * 5);
      frameRadius += (frameTarget - frameRadius) * Math.min(1, dt * 5);
    }
    if (now - lastMeasure > 180) { lastMeasure = now; measureFree(); if (window.CakeLook) { CakeLook.tick(scene); updateBleed(); } }
    free.top += (freeTarget.top - free.top) * Math.min(1, dt * 6);
    free.bottom += (freeTarget.bottom - free.bottom) * Math.min(1, dt * 6);
    if (spinEnabled) updateSpin(now, dt);
    // Tilt and twist are held, not sprung, and apply whether or not the spin loop runs.
    camElev = Math.max(CAM_ELEV_MIN, Math.min(CAM_ELEV_MAX, CAM_ELEV_BASE + tiltX * 180 / Math.PI));
    camRoll = bankZ;
    frameCamera();
    updateShadow();
    for (var i = 0; i < flames.length; i++) {
      var f = flames[i];
      var lx = f.leanX * leanNow, lz = f.leanZ * leanNow;
      camera.matrixWorld.extractBasis(_right, _upv, _fwd);
      var s = f.base * f.k * f.lit * (1 + 0.10 * Math.sin(t * 3.1 + f.phase) + 0.04 * Math.sin(t * 21 + f.phase * 3));
      f.sprite.scale.set(s * 0.7 * (1 + 0.25 * Math.abs(lx)), s * (1 - 0.45 * Math.abs(lz)) * (1 + 0.3 * Math.abs(lx)), 1);
      f.sprite.material.rotation = -lx * 0.6;
      // Lean along the camera's right/forward axes so it always reads as sideways
      // on screen, whatever angle the rig is at.
      var wob = 0.01 * Math.sin(t * 2.3 + f.phase);
      f.sprite.position.x = f.x + wob + (_right.x * lx + _fwd.x * lz) * 0.08;
      f.sprite.position.z = f.z + (_right.z * lx + _fwd.z * lz) * 0.08;
      f.sprite.position.y = f.y - (1 - f.k) * 0.5 - Math.abs(lz) * 0.06;
      f.sprite.visible = f.k > 0.05 && f.lit > 0.01;
      if (f.halo) {
        // Halo rides the flame: same position, a touch higher, scaled with it (and with the
        // flame's own flicker, so the glow breathes).
        var hs = f.base * CakeLook.LOOK.halo.scale * f.k * f.lit * (1 + 0.06 * Math.sin(t * 3.1 + f.phase));
        f.halo.scale.set(hs, hs, 1);
        f.halo.position.set(f.sprite.position.x + (_right.x * lx) * 0.03, f.sprite.position.y + CakeLook.LOOK.halo.liftY, f.sprite.position.z + (_right.z * lx) * 0.03);
        f.halo.visible = f.sprite.visible;
      }
    }
    if (flames.length) {
      var lit = litCount();
      var target = window.CakeLook ? CakeLook.candleIntensity(lit, darkness) : Math.min(1.6, 0.25 + lit * 0.03);
      // Ease toward it so each extinguished wave reads as a wave of dimming, not a step.
      candleLight.intensity += (target * (0.92 + 0.08 * Math.sin(t * 7)) - candleLight.intensity) * Math.min(1, dt * 6);
      // The cake's night self-glow follows the candles too.
      if (window.CakeLook && glowMats.length) {
        var gf = CakeLook.glowFactor(flames.length ? lit / flames.length : 0, darkness) * CakeLook.LOOK.ambientScale;
        for (var gi = 0; gi < glowMats.length; gi++) glowMats[gi].m.emissiveIntensity += (glowMats[gi].base * gf - glowMats[gi].m.emissiveIntensity) * Math.min(1, dt * 6);
      }
    }
    updateSmoke(dt);
    updateConfetti(dt, t);
    updateRipple(now);
    if (window.CakeStage) CakeStage.update(camera.position.length());
    renderer.render(scene, camera);
    if (window.CakeDev && CakeDev.on) CakeDev.tick(performance.now());   // measure; the ladder is off in dev
    else tunePixelRatio(now, performance.now() - frameStart);
    requestAnimationFrame(frame);
  }

  // =====================================================================
  //  Ceremony: box rises, lid lowers, ribbon tightens, label, share.
  //  Objects live in cakeGroup so they turn with the cake.
  // =====================================================================
  var BOX = { half: 2.62, wall: 0.06, h: 0 };         // hugs the cake; h set per tier
  var box = new THREE.Group(), lid = new THREE.Group(), ribbon = new THREE.Group();
  box.visible = lid.visible = ribbon.visible = false;
  cakeGroup.add(box); cakeGroup.add(lid); cakeGroup.add(ribbon);
  var boxMat = new THREE.MeshStandardMaterial({ color: 0xFFF3E2, roughness: 0.9 });
  var boxEdgeMat = new THREE.MeshStandardMaterial({ color: 0xF2DCC2, roughness: 0.9 });
  var ribbonMat = new THREE.MeshStandardMaterial({ color: 0xFF6F91, roughness: 0.45 });
  boxMat.__shared = boxEdgeMat.__shared = ribbonMat.__shared = true;
  var ceremony = null;      // { active, finished }
  var boxMode = false;      // true while the box is the thing on screen (its own pivot/framing)

  function buildBox(height) {
    clearGroup(box); clearGroup(lid); clearGroup(ribbon);
    // The box has to contain the WIDEST tier. A fixed half-width fits the Classic, but
    // the Showstopper's bottom tier (r 2.7) pushes straight through it.
    var widest = 2.2;
    (TIERS[(config && config.t) || 1] || TIERS[1]).forEach(function (t) { widest = Math.max(widest, t.r); });
    BOX.half = widest + 0.30;
    BOX.h = height;
    boxMode = true;
    fitShadow(BOX.half * 1.05);
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
    var rib = PALETTES.ribbon[clampIndex(config.rc, PALETTES.ribbon)].hex;
    // Only nudge it if a pale ribbon would vanish against a pale box.
    if (luminance(rib) > 0.82 && luminance(lighten(frostingHex, 0.55)) > 0.75) rib = darken(rib, 0.32);
    ribbonMat.color.setHex(rib);
    var h = Math.max(2.9, cakeHeight() + 0.18);
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
    boxMode = false;
    box.visible = lid.visible = ribbon.visible = false;
    showLidLabel(false);
    setFrame('cake', centreOfMass(config ? config.t : 1));
  }

  // Kept for reference; the label is now pinned in screen space by CSS so the cake
  // can't drag it around. (It used to be projected from the lid every frame, which is
  // why it jittered as the box turned.)
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
    var m = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.9, toneMapped: false });
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
    // Nearest to the camera first. The camera moves, not the cake, so sort by distance.
    var v = new THREE.Vector3();
    return flames.map(function (f, i) {
        f.sprite.getWorldPosition(v);
        return [i, v.distanceToSquared(camera.position), f.lit];
      })
      .filter(function (p) { return p[2] > 0.5; })
      .sort(function (a, b) { return a[1] - b[1]; }).map(function (p) { return p[0]; });
  }

  // ---- Spin physics ----
  // One model: the cake is a lazy susan. Drag it, fling it, it coasts and decays back
  // to the ambient spin. Spin it fast enough and the wind puts the candles out.
  // There is no separate "blow" gesture.
  var SPIN = {
    idle: (Math.PI * 2) / ROTATION_SECONDS_PER_TURN,   // ambient, rad/s (~0.26)
    max: Infinity,                                     // no cap: flick it as hard as you like
    friction: 1.4,                                     // rad/s² — constant deceleration, like a real turntable
    blowAt: 1.9,                                       // wind starts to bite, rad/s
    blowFull: 5.5,                                     // a wave every ~120ms up here
    pxPerTurn: 820,                                    // thumb travel for one full turn (higher = heavier)
    flingGain: 0.5,                                    // how much of the smoothed release velocity is kept
    velSmoothMs: 80                                    // window the release velocity is averaged over
  };
  // Tilt (X) and twist (Z) are held, not sprung: they stay where the user leaves them.
  //
  // Nothing is ever rotated: vertical drag moves the CAMERA's elevation, so the cake
  // stays upright, candles stay vertical and gravity looks right at every angle.
  //
  // Bounds are derived from the camera's resting elevation so that the full range is
  // exactly side-on to top-down: 36° one way, 54° the other, 90° total.
  var TILT = {
    min: -(36 - 2) * Math.PI / 180,     // -0.593 rad: fully side on
    max:  (88 - 36) * Math.PI / 180,    // +0.908 rad: fully top down
    pxPerRad: 400,                      // recomputed on resize so one swipe covers the lot
    swipeFraction: 0.8                  // of the canvas height = the whole range
  };
  // Two-finger rotate → camera roll. Temporarily OFF (20 Sept): set `enabled: true` to restore.
  var TWIST = { enabled: false, min: -0.44, max: 0.44 };   // ±25° when enabled
  var omega = SPIN.idle;        // free-spin angular velocity, rad/s (momentum)
  // The ambient turn is for the recipient's cake, which should feel alive. The sender is
  // working on theirs, and a thing that keeps turning while you're placing candles is a
  // nuisance — so in the builder the resting rate is zero: it only moves when dragged.
  function idleRate() { return document.body.classList.contains('mode-builder') ? 0 : SPIN.idle; }
  var dragW = 0;                // the thumb's own angular velocity right now, rad/s
  var tiltX = 0;                // held tilt (X), radians, clamped to TILT
  var bankZ = 0;                // held twist (Z), radians, clamped to TWIST — two-finger gesture
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
    // Constant deceleration toward the ambient orbit, not exponential decay.
    // Exponential sheds big speeds almost instantly, which is what made a hard
    // flick feel like it was being clamped. With friction, twice the speed coasts
    // for twice as long, which is how a real turntable behaves.
    //
    // This runs while dragging too: the cake keeps its momentum under your thumb,
    // the way brushing a spinning turntable does. Hold it still long enough and
    // friction bleeds the speed away, so a press-and-hold still settles it.
    var target = idleRate();
    var diff = omega - target;
    var step = SPIN.friction * dt;
    if (Math.abs(diff) <= step) omega = target;
    else omega -= Math.sign(diff) * step;
    if (!isFinite(omega)) omega = SPIN.idle;           // only guard left: never let NaN in
    // The camera orbits; the cake never moves. Negative so a rightward drag still
    // makes the cake appear to turn to the right.
    if (!reduceMotion) camAzimuth -= omega * dt;
    // Unbounded spin means azimuth could run away over a long session; fold it back
    // by whole turns so the float never loses precision. Invisible: same angle.
    if (camAzimuth > Math.PI * 20 || camAzimuth < -Math.PI * 20) {
      camAzimuth -= Math.round(camAzimuth / (Math.PI * 2)) * Math.PI * 2;
    }

    // Apparent wind = how hard the cake is turning, relative to its resting spin.
    var apparent = Math.abs(omega) + (dragging ? Math.abs(dragW) : 0);
    var wind = (apparent - SPIN.blowAt) / (SPIN.blowFull - SPIN.blowAt);
    wind = Math.max(0, Math.min(1, wind));
    var mic = blow.enabled ? blow.micLevel : 0;

    // Flames lean against the direction of travel; mic pushes them away from the viewer.
    var signed = omega + (dragging ? dragW : 0);
    var spinLean = Math.max(-1, Math.min(1, -signed / SPIN.blowFull)) * (0.35 + 0.65 * wind);
    if (Math.abs(signed) > SPIN.idle * 1.5 || mic > 0) setLean(spinLean, mic);
    else setLean(0, 0);
    leanNow += (((Math.abs(spinLean) > 0.02 || mic > 0) ? 1 : 0) - leanNow) * Math.min(1, dt * 10);

    if (!blow.enabled) return;
    if (mic > 0) blow.micHold += dt * 1000; else blow.micHold = 0;
    var micReady = mic > 0 && blow.micHold >= 150;

    if (wind > 0 && now - blow.lastWave > (260 - 140 * wind)) {
      blow.lastWave = now;
      wave(wind, signed > 0 ? -1 : 1, 0);
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

  // Drag: horizontal spins the turntable, vertical tilts it, two fingers twist it.
  // Tilt and twist are clamped (it can never flip) and are HELD — they stay where
  // you leave them. Only the spin decays, back to the ambient turn.
  (function () {
    var pts = {};              // active pointers by id
    var primary = null;
    var lastT = 0;
    var samples = [];          // recent {t, w} for a smoothed release velocity
    var pinchPrev = null;      // previous two-finger angle
    var spanPrev = null;       // previous two-finger distance

    function count() { var n = 0; for (var k in pts) n++; return n; }
    function twoAngle() {
      var ids = Object.keys(pts);
      if (ids.length < 2) return null;
      var a = pts[ids[0]], b = pts[ids[1]];
      return Math.atan2(b.y - a.y, b.x - a.x);
    }
    function twoSpan() {
      var ids = Object.keys(pts);
      if (ids.length < 2) return null;
      var a = pts[ids[0]], b = pts[ids[1]];
      return Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    }
    function pushSample(w, now) {
      samples.push({ t: now, w: w });
      while (samples.length && now - samples[0].t > SPIN.velSmoothMs) samples.shift();
    }
    function smoothedVel(now) {
      // Mean of the last velSmoothMs of angular velocity; a single fast frame can't spike it.
      var n = 0, sum = 0;
      for (var i = 0; i < samples.length; i++) {
        if (now - samples[i].t > SPIN.velSmoothMs) continue;
        sum += samples[i].w; n++;
      }
      return n ? sum / n : 0;
    }

    canvas.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (primary === null) {
        primary = e.pointerId;
        lastT = performance.now();
        samples.length = 0;
        dragging = true; spinFree = true; dragW = 0;
        killTweens('turn');
        if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
      }
      if (count() === 2) { pinchPrev = twoAngle(); spanPrev = twoSpan(); }
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      var prev = pts[e.pointerId];
      var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };

      // Two fingers: rotate to roll the view, pinch to zoom. Zoom is centred on the
      // cake because the camera always looks at the same point.
      if (count() >= 2) {
        var ang = twoAngle(), sp = twoSpan();
        if (TWIST.enabled && ang !== null && pinchPrev !== null) {
          var d = ang - pinchPrev;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          // Twisting the hand clockwise should turn the cake clockwise. Rolling the
          // camera one way makes the scene appear to roll the other, hence the sign.
          bankZ = Math.max(TWIST.min, Math.min(TWIST.max, bankZ + d));
        }
        if (sp !== null && spanPrev) {
          camZoom = Math.max(ZOOM.min, Math.min(ZOOM.max, camZoom * (spanPrev / sp)));
        }
        pinchPrev = ang; spanPrev = sp;
        return;
      }

      if (e.pointerId !== primary) return;
      var now = performance.now(), dt = Math.max(8, now - lastT);
      var dTheta = (dx / SPIN.pxPerTurn) * Math.PI * 2;

      camAzimuth -= dTheta;                           // tracks the thumb, gently
      var w = dTheta / (dt / 1000);
      pushSample(w, now);
      dragW = isFinite(w) ? w : 0;

      // Drag down to look further over the top, up to see more of the side.
      tiltX = Math.max(TILT.min, Math.min(TILT.max, tiltX + dy / TILT.pxPerRad));
      lastT = now;
    });

    function release(e) {
      delete pts[e.pointerId];
      if (count() < 2) { pinchPrev = null; spanPrev = null; }
      if (e.pointerId !== primary) return;
      primary = null; dragging = false;
      var now = performance.now();
      // ADD the fling to whatever the cake was already doing, so repeated flicks
      // build speed and a flick against the spin brakes it. Replacing it here is
      // what made multiple swipes feel capped.
      var v = (now - lastT > 90) ? 0 : smoothedVel(now) * SPIN.flingGain;
      if (isFinite(v)) omega += v;
      dragW = 0;
      samples.length = 0;
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

  // ---- Confetti (3D, in the scene) ----
  // A 2D overlay is glued to the screen, which is obvious the moment the camera orbits
  // during a burst — and the whole point of this moment is that people film it. So the
  // paper lives in the world: it falls, tumbles, lands on the floor and on the cake, and
  // stays there. Once everything has settled the update loop stops entirely, leaving one
  // static draw call.
  var CONFETTI = {
    max: 420,            // pool size; new bursts recycle the oldest settled pieces
    size: 0.15,          // width of a piece
    thick: 0.012,        // real thickness: a flat quad vanishes edge-on
    gravity: 5.4,
    dragFlat: 1.15,      // broadside drag. Was 3.1 — high enough that pieces hit terminal
                         // velocity in a few frames, and since lift scales with speed there
                         // was nothing left to push them sideways.
    dragEdge: 0.16,      // edge-on: it slices
    lift: 3.4,           // sideways force from angle of attack
    torque: 5.2,         // AERODYNAMIC TORQUE — the air drives the flipping, not just resists it
    spinDamp: 0.16,      // light. Paper keeps tumbling until it lands.
    spin: 7,             // initial tumble, rad/s
    wind: 0.5,           // amplitude of the shared, slowly-varying air current
    maxSpin: 13,         // rad/s — torque feedback is unbounded, so cap it
    settleMs: 7000,      // after this, gravity ramps up so nothing can hover forever
    forceMs: 12000,      // hard stop: drop it straight down
    streamMs: 420,       // spawn spread over time, so it streams in rather than popping
    marginY: 1.2         // extra height above the top of frame
  };

  // Fall archetypes. Real confetti shows all of these at once, and that variety is most
  // of what makes it read as paper rather than particles.
  //   flutter   — rocks side to side, strong torque response, the classic falling leaf
  //   tumble    — turns end over end continuously and drifts steadily one way
  //   autorotate— spins about its own axis and descends in a slow helix (sycamore seed)
  var FALL = [
    { name: 'flutter',    w: 0.46, torque: 1.35, spinDamp: 1.0,  drag: 1.0,  seed: 0.6 },
    { name: 'tumble',     w: 0.34, torque: 0.55, spinDamp: 0.55, drag: 0.85, seed: 1.7 },
    { name: 'autorotate', w: 0.20, torque: 0.30, spinDamp: 0.25, drag: 1.25, seed: 2.4 }
  ];
  function pickFall() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < FALL.length; i++) { acc += FALL[i].w; if (r <= acc) return FALL[i]; }
    return FALL[0];
  }
  var confettiGeo = new THREE.BoxGeometry(CONFETTI.size, CONFETTI.thick, CONFETTI.size * 1.5);
  // vertexColors (needed below) makes the shader multiply by the geometry's `color`
  // attribute as well as instanceColor. BoxGeometry has no `color`, so it defaults to
  // zero and everything renders black. Give it a white one.
  (function () {
    var n = confettiGeo.attributes.position.count;
    var arr = new Float32Array(n * 3);
    for (var i = 0; i < arr.length; i++) arr[i] = 1;
    confettiGeo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  })();
  confettiGeo.__shared = true;
  // vertexColors MUST be true: in r128 the instancing-colour shader chunk writes
  // instanceColor into vColor, but the fragment shader only multiplies it into the
  // diffuse when USE_COLOR is defined — which comes from vertexColors, not from
  // instanceColor existing. Without it every piece renders white.
  var confettiMat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, vertexColors: true });
  confettiMat.__shared = true;
  var confetti = new THREE.InstancedMesh(confettiGeo, confettiMat, CONFETTI.max);
  confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Allocate the colour buffer at full size up front. Letting setColorAt create it
  // lazily sizes it to whatever `count` happens to be at the first burst, and the
  // second burst then writes off the end of the array in silence.
  confetti.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CONFETTI.max * 3), 3);
  confetti.instanceColor.setUsage(THREE.DynamicDrawUsage);
  confetti.count = 0;
  confetti.frustumCulled = false;
  if (window.CakeLook) CakeLook.adopt(confetti);
  scene.add(confetti);
  var confettiPieces = [];           // { p, v, rot, rv, phase, resting }
  var confettiActive = 0;            // how many are still moving
  var _dummy = new THREE.Object3D();
  var _col = new THREE.Color();

  // Landing surfaces, outer first: [{ y, r, rInner }]. Rebuilt with the cake.
  var landings = [];
  function rebuildLandings(cfg) {
    landings = [];
    var tiers = TIERS[cfg.t] || TIERS[1];
    var y = PLATE_TOP;
    tiers.forEach(function (t, i) {
      y += t.h;
      var inner = (i < tiers.length - 1) ? tiers[i + 1].r : 0;
      landings.push({ y: y, r: t.r + 0.06, rInner: inner });
    });
    landings.reverse();              // highest tier first
  }

  // World height that is just off the top of the screen, at the cake's own depth.
  // A fixed offset above the cake is visible on screen at low camera elevations, which
  // is why pieces appeared to pop into existence.
  var _ndc = new THREE.Vector3();
  function offscreenTop() {
    _ndc.set(0, 1, 0.5).unproject(camera);                 // top-centre of the frustum
    var dir = _ndc.clone().sub(camera.position).normalize();
    // Walk that ray to the vertical axis of the cake and read off its height there.
    var t = (dir.z !== 0) ? (-camera.position.z / dir.z) : 1;
    var y = camera.position.y + dir.y * Math.max(0.1, t);
    return Math.max((landings.length ? landings[0].y : 2) + 2, y + CONFETTI.marginY);
  }

  function confettiBurst(colors, count) {
    var pal = colors.map(function (c) { return new THREE.Color(c); });
    var top = offscreenTop();
    var spread = (landings.length ? landings[landings.length - 1].r : 2.2) * 2.1;
    for (var i = 0; i < count; i++) {
      var piece;
      if (confettiPieces.length < CONFETTI.max) {
        piece = { p: new THREE.Vector3(), v: new THREE.Vector3(),
                  // Orientation as a quaternion with a free angular-velocity vector, not
                  // Euler increments: the spin axis can precess, so tumbling looks
                  // irregular instead of turning about one fixed axis forever.
                  q: new THREE.Quaternion(), w: new THREE.Vector3(),
                  rot: new THREE.Euler(), phase: 0, resting: false, col: new THREE.Color(),
                  sx: 1, sz: 1, delay: 0, born: 0, mass: 1, fall: FALL[0] };
        confettiPieces.push(piece);
      } else {
        // Recycle the oldest settled piece so repeated bursts accumulate without growing.
        piece = null;
        for (var k = 0; k < confettiPieces.length; k++) {
          if (confettiPieces[k].resting) { piece = confettiPieces.splice(k, 1)[0]; confettiPieces.push(piece); break; }
        }
        if (!piece) continue;
      }
      var a = Math.random() * Math.PI * 2;
      var rr = spread * Math.sqrt(Math.random());
      piece.p.set(Math.sin(a) * rr, top + Math.random() * 2.4, Math.cos(a) * rr);
      piece.v.set((Math.random() - 0.5) * 1.6, -0.3 - Math.random() * 0.7, (Math.random() - 0.5) * 1.6);
      piece.q.setFromEuler(_e.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
      piece.w.set((Math.random() - 0.5) * CONFETTI.spin,
                  (Math.random() - 0.5) * CONFETTI.spin,
                  (Math.random() - 0.5) * CONFETTI.spin);
      piece.fall = pickFall();
      if (piece.fall.name === 'autorotate') {
        // Autorotators spin mostly about their own face normal.
        piece.w.set((Math.random() - 0.5) * 1.2, (6 + Math.random() * 5) * (Math.random() < 0.5 ? -1 : 1), (Math.random() - 0.5) * 1.2);
      }
      // Slight mass variation so terminal velocities differ — without it the whole burst
      // descends as one uniform curtain.
      piece.mass = 0.75 + Math.random() * 0.6;
      piece.phase = Math.random() * 6.28;
      piece.resting = false;
      // Mixed stock, like a real handful: squares, long strips, a few big flakes.
      var shape = Math.random();
      piece.sx = shape < 0.25 ? 0.55 + Math.random() * 0.2 : 0.8 + Math.random() * 0.5;
      piece.sz = shape < 0.25 ? 1.5 + Math.random() * 0.7 : 0.8 + Math.random() * 0.5;
      // Held back so the burst streams in over ~400ms instead of appearing as a block.
      piece.delay = Math.random() * CONFETTI.streamMs;
      piece.born = performance.now();
      piece.col.copy(pal[i % pal.length]);
    }
    confetti.count = confettiPieces.length;
    confettiActive = 1;              // wake the update loop
    writeConfetti();
  }

  function writeConfetti() {
    for (var i = 0; i < confettiPieces.length; i++) {
      var c = confettiPieces[i];
      _dummy.position.copy(c.p);
      _dummy.quaternion.copy(c.q);
      _dummy.scale.set(c.sx, 1, c.sz);
      // Not yet released: park it at zero scale rather than showing it waiting.
      if (c.delay > 0 && performance.now() - c.born < c.delay) _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      confetti.setMatrixAt(i, _dummy.matrix);
      if (confetti.setColorAt) confetti.setColorAt(i, c.col);
    }
    confetti.instanceMatrix.needsUpdate = true;
    if (confetti.instanceColor) confetti.instanceColor.needsUpdate = true;
  }

  function landingFor(x, z, yFrom, yTo) {
    // Which surface, if any, this piece passed through on its way down.
    var d2 = x * x + z * z;
    for (var i = 0; i < landings.length; i++) {
      var L = landings[i];
      if (yFrom > L.y && yTo <= L.y && d2 <= L.r * L.r && d2 >= L.rInner * L.rInner) return L.y;
    }
    return (yTo <= 0) ? 0 : null;
  }

  // Orientation-coupled aerodynamics with feedback.
  //
  // The previous version had drag and lift depending on orientation, but nothing the
  // other way round: the forces never changed how the piece was facing. Real falling
  // paper is a loop — it presents a face to the air, that generates a TORQUE about its
  // centre of pressure, the torque flips it, the new orientation changes the force, and
  // round it goes. That loop is what produces the rock-flip-rock of real confetti, and
  // without it rotation and translation just run alongside each other, which reads as
  // "everything falls the same way".
  var _n = new THREE.Vector3(), _vn = new THREE.Vector3(), _liftDir = new THREE.Vector3(),
      _torque = new THREE.Vector3(), _e = new THREE.Euler(), _dq = new THREE.Quaternion(),
      _wq = new THREE.Quaternion(), _air = new THREE.Vector3();

  // One shared, slowly-varying air current. Cheap, and it makes the burst behave like a
  // cloud in a room rather than 200 independent particles.
  function airAt(t) {
    _air.set(
      Math.sin(t * 0.31) * 0.6 + Math.sin(t * 0.13 + 1.7) * 0.4,
      Math.sin(t * 0.21 + 0.6) * 0.18,
      Math.cos(t * 0.27 + 2.1) * 0.6 + Math.cos(t * 0.11) * 0.4
    );
    return _air.multiplyScalar(CONFETTI.wind);
  }

  function updateConfetti(dt, t) {
    if (!confettiActive) return;
    var now = performance.now();
    var moving = 0;
    var air = airAt(t);
    for (var i = 0; i < confettiPieces.length; i++) {
      var c = confettiPieces[i];
      if (c.resting) continue;
      moving++;
      if (c.delay > 0 && now - c.born < c.delay) continue;     // not released yet

      var fall = c.fall;

      // Face normal in world space (the piece is a flat slab in its own XZ plane).
      _n.set(0, 1, 0).applyQuaternion(c.q);

      // Velocity relative to the moving air is what the piece actually feels.
      _vn.copy(c.v).sub(air);
      var speed = _vn.length();

      if (speed > 0.0001) {
        _vn.multiplyScalar(1 / speed);
        var dotNV = _n.dot(_vn);
        var face = Math.abs(dotNV);                 // 1 = broadside, 0 = edge-on

        // Drag, quadratic, scaled by how much area is presented.
        var cd = (CONFETTI.dragEdge + (CONFETTI.dragFlat - CONFETTI.dragEdge) * face) * fall.drag / c.mass;
        c.v.addScaledVector(_vn, -Math.min(speed, cd * speed * speed * dt));

        // Lift perpendicular to travel, peaking at ~45° angle of attack.
        var aoa = face * (1 - face) * 4;
        _liftDir.copy(_n).addScaledVector(_vn, -dotNV);
        if (_liftDir.lengthSq() > 1e-6) {
          _liftDir.normalize();
          c.v.addScaledVector(_liftDir, (dotNV > 0 ? -1 : 1) * CONFETTI.lift * aoa * speed * dt / c.mass);
        }

        // AERODYNAMIC TORQUE. The centre of pressure sits ahead of the centre of mass on
        // a flat plate, so the air twists it toward edge-on — it overshoots, flips, and
        // the cycle repeats. Torque axis is normal × velocity.
        _torque.crossVectors(_n, _vn).multiplyScalar(
          CONFETTI.torque * fall.torque * speed * dotNV * dt / c.mass
        );
        c.w.add(_torque);
      }

      // Lift with a torque feedback loop can, occasionally, keep one piece hovering
      // indefinitely — which would leave this whole loop running forever on someone's
      // phone. Age ramps gravity up so everything lands eventually.
      var age = now - c.born;
      var extraG = age > CONFETTI.settleMs
        ? 1 + 2.5 * Math.min(1, (age - CONFETTI.settleMs) / (CONFETTI.forceMs - CONFETTI.settleMs))
        : 1;
      c.v.y -= CONFETTI.gravity * extraG * dt;
      if (age > CONFETTI.forceMs) { c.v.x *= 0.9; c.v.z *= 0.9; }
      var yPrev = c.p.y;
      c.p.addScaledVector(c.v, dt);

      // Integrate the quaternion from the angular-velocity vector.
      var wlen = c.w.length();
      if (wlen > 0.0001) {
        _wq.setFromAxisAngle(_torque.copy(c.w).multiplyScalar(1 / wlen), wlen * dt);
        c.q.premultiply(_wq).normalize();
      }
      c.w.multiplyScalar(Math.max(0, 1 - CONFETTI.spinDamp * fall.spinDamp * dt));
      var wl = c.w.length();
      if (wl > CONFETTI.maxSpin) c.w.multiplyScalar(CONFETTI.maxSpin / wl);

      var land = landingFor(c.p.x, c.p.z, yPrev, c.p.y);
      if (land !== null) {
        c.p.y = land + CONFETTI.thick * 0.5 + 0.002;
        c.p.x += c.v.x * 0.04;                       // a little slide on impact
        c.p.z += c.v.z * 0.04;
        c.q.setFromEuler(_e.set((Math.random() - 0.5) * 0.24, Math.random() * 6.28, (Math.random() - 0.5) * 0.24));
        c.resting = true;
        moving--;
      }
    }
    writeConfetti();
    if (moving === 0) confettiActive = 0;    // everything has settled: stop updating
  }

  function clearConfetti() {
    confettiPieces.length = 0;
    confetti.count = 0;
    confettiActive = 0;
  }

  // ---- Reveal ----
  // The message isn't revealed here: it's always on the back of the cake, found by
  // spinning. Blowing the candles out just earns the confetti and the next step.
  function reveal() {
    var pal = [PALETTES.frosting[clampIndex(config.fc, PALETTES.frosting)].hex,
               PALETTES.candle[clampIndex(config.cc, PALETTES.candle)].hex, 0xffffff, 0xFFD166, 0xFF6F91];
    confettiBurst(pal.map(function (h) { return hexCss(h); }), viewerMode === 'slice' ? 40 : 160);
    setTimeout(showRevealedControls, 700);
  }
  function showRevealedControls() {
    if (viewerMode === 'slice') { showSliceDone(); return; }
    setViewerState('revealed');
    requestAnimationFrame(function () { document.getElementById('vs-revealed').classList.add('on'); });
  }

  // ---- Gate & open ----
  var boxOpenDone = false;
  function setViewerState(st) {
    ['gate', 'blow', 'revealed', 'cut', 'slice', 'slice-done'].forEach(function (k) {
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
    var rib = PALETTES.ribbon[clampIndex(cfg.rc, PALETTES.ribbon)].hex;
    if (luminance(rib) > 0.82 && luminance(lighten(frostingHex, 0.55)) > 0.75) rib = darken(rib, 0.32);
    ribbonMat.color.setHex(rib);
    var h = Math.max(2.9, cakeHeight() + 0.18);
    buildBox(h);
    box.visible = lid.visible = ribbon.visible = true;
    box.position.y = 0; lid.position.y = h - 0.04; lid.rotation.set(0, 0, 0); ribbon.position.y = h - 0.04; ribbon.scale.set(1, 1, 1);
    camAzimuth = -0.4;
    omega = SPIN.idle; tiltX = 0; bankZ = 0; spinFree = false;
    camElev = CAM_ELEV_BASE; camRoll = 0; camZoom = 1; frameCamera();
    spinEnabled = true;          // the box is handled exactly like the cake
    setFrame('box', 1.7, true);
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
      boxMode = false; fitShadow((TIERS[config.t] || TIERS[1])[0].r);
      tween({ duration: 160, ease: EASE.pop, update: function (k) { var sc = 1.03 - 0.03 * k; built.scale.set(sc, sc, sc); } });
      setFrame('cake', centreOfMass(config ? config.t : 1));
    } });
    // 4. candles light in a ripple, centre out, capped at 1.2s
    setTimeout(function () {
      spinEnabled = true;
      var order = centreOutOrder();
      lightRipple(order, Math.min(20, 1200 / Math.max(1, order.length)), true);
      // 5. header, then the blow state
      setTimeout(function () { setViewerState('blow'); blow.enabled = true; }, 500);
    }, 1200);
  }
  function relight() {
    if (cut) { while (cutGroup.children.length) cutGroup.remove(cutGroup.children[0]); cut = null; built.visible = true; }
    blow.revealed = false;
    for (var i = 0; i < flames.length; i++) { flames[i].__out = false; }
    lightRipple(centreOutOrder().reverse(), Math.min(20, 1200 / Math.max(1, flames.length)), true);
    document.getElementById('vs-revealed').classList.remove('on');
    setTimeout(function () { setViewerState('blow'); blow.enabled = true; }, 600);
  }

  // =====================================================================
  //  Phase 4 — cut the cake, send slices. The loop.
  // =====================================================================
  var WEDGES_PER_TIER = 8;
  var cutGroup = new THREE.Group(); cakeGroup.add(cutGroup);
  var cut = null;          // { wedges: [ {mesh group, tier, i, gone} ], plate, lifted, code, sentBack }
  var viewerMode = 'cake'; // 'cake' | 'slice'
  var slice = null;        // slice-page state

  function cakeCode() { return config ? encodeConfig(config) : ''; }
  function loadCutState(code) {
    try { return JSON.parse(localStorage.getItem('cake.cut.' + code) || 'null') || { gone: [], sentBack: false }; }
    catch (e) { return { gone: [], sentBack: false }; }
  }
  function saveCutState(code, st) { try { localStorage.setItem('cake.cut.' + code, JSON.stringify(st)); } catch (e) {} }

  function tierTops(cfg) {
    var tiers = TIERS[cfg.t] || TIERS[1], y = PLATE_TOP, out = [];
    tiers.forEach(function (t, i) { out.push({ r: t.r, h: t.h, y0: y, aboveR: tiers[i + 1] ? tiers[i + 1].r : undefined }); y += t.h; });
    return out;
  }

  // One wedge: body + cap + two cut faces showing the filling. The message band on the
  // bottom tier is carried by a cloned texture whose offset/repeat select this wedge's arc.
  function makeWedge(tier, i, cfg, frostingMat, capMat, faceMat, msgMap) {
    var N = WEDGES_PER_TIER, theta0 = i * Math.PI * 2 / N, len = Math.PI * 2 / N;
    var g = new THREE.Group();
    var bodyH = tier.h - CAP_H;
    var side = frostingMat;
    if (msgMap) {
      var t = msgMap.clone(); t.needsUpdate = true;
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.x = len / (Math.PI * 2);
      t.offset.x = theta0 / (Math.PI * 2);
      side = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, map: t, vertexColors: true });
    }
    var wseg = Math.max(6, Math.round(CYL_SEG / N) + 2);
    var rr = cfg.fr ? tier.r : tier.r - FROST_T;             // naked wedges are sponge-sized
    var body = new THREE.Mesh(CakeShapes.body(rr, bodyH, wseg, theta0, len), [side, frostingMat, frostingMat]);
    body.position.y = tier.y0; g.add(body);
    var cap = new THREE.Mesh(CakeShapes.cap(rr, CAP_H, wseg, theta0, len, tier.aboveR ? (cfg.fr ? tier.aboveR : tier.aboveR - FROST_T) : undefined), capMat);
    cap.position.y = tier.y0 + bodyH; g.add(cap);
    // Cut faces follow the rounded outline, so the wedge matches the whole cake.
    [theta0, theta0 + len].forEach(function (th) {
      var f = new THREE.Mesh(CakeShapes.cutFace(rr, bodyH, CAP_H), faceMat);
      f.position.set(0, tier.y0, 0);
      f.rotation.y = th - Math.PI / 2;               // +x (radius) → along (sin θ, cos θ)
      g.add(f);
    });
    g.traverse(function (o) { if (o.isMesh) o.userData.wedge = g; });
    return g;
  }

  function startCut() {
    if (cut) return;
    markHeavy();
    var cfg = config, code = cakeCode();
    var st = loadCutState(code);
    var TM = tierMaterials(cfg), frostingMat = TM.side, capMat = TM.cap, faceMat = TM.face;
    var msgMap = messageMesh && messageMesh.material[0] && messageMesh.material[0].map ? messageMesh.material[0].map : null;

    built.visible = false;                    // the whole cake, candles included, steps aside
    cut = { wedges: [], plate: null, lifted: null, code: code, sentBack: !!st.sentBack, total: 0 };
    var tiers = tierTops(cfg);
    tiers.forEach(function (tier, ti) {
      for (var i = 0; i < WEDGES_PER_TIER; i++) {
        var w = makeWedge(tier, i, cfg, frostingMat, capMat, faceMat, ti === 0 ? msgMap : null);
        var idx = ti * WEDGES_PER_TIER + i;
        w.userData.index = idx; w.userData.tier = ti; w.userData.i = i;
        if (st.gone.indexOf(idx) >= 0) w.visible = false;
        if (window.CakeLook) CakeLook.adopt(w);
        cutGroup.add(w);
        cut.wedges.push(w);
      }
    });
    cut.total = cut.wedges.length;
    cut.tiers = tiers.length;
    cut.seams = new THREE.Group(); cutGroup.add(cut.seams);
    cut.seamMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false });
    var fin = $('vs-finished'); if (fin) fin.hidden = true;
    setViewerState('cut');
    updateSeams();
    updateCutUI();
  }

  // Seams show only on the tier you can cut right now, so the affordance itself says
  // where to tap. Redrawn whenever the cuttable tier changes.
  function updateSeams() {
    if (!cut || !cut.seams) return;
    while (cut.seams.children.length) cut.seams.remove(cut.seams.children[0]);
    var ti = topRemainingTier(); if (ti < 0) return;
    var tier = tierTops(config)[ti], N = WEDGES_PER_TIER;
    var topY = tier.y0 + tier.h + 0.003;
    for (var k = 0; k < N; k++) {
      var w = cut.wedges[ti * N + k];
      if (!w.visible || w.userData.lifted) continue;
      // one line per remaining wedge, along its leading edge
      var th = k * Math.PI * 2 / N;
      var line = new THREE.Mesh(new THREE.BoxGeometry(tier.r + 0.06, 0.004, 0.012), cut.seamMat);
      line.position.set(Math.sin(th) * (tier.r + 0.06) / 2, topY, Math.cos(th) * (tier.r + 0.06) / 2);
      // A box's length runs along local X; rotating by (th − π/2) about Y points X along (sin th, cos th).
      line.rotation.y = th - Math.PI / 2;
      cut.seams.add(line);
    }
  }
  // Tap on a tier that still has one above it: acknowledge it with a wobble on the tier
  // in the way, so the tap isn't ignored and the reason is visible.
  function wobbleTier(ti) {
    cut.wedges.forEach(function (w) {
      if (w.userData.tier !== ti || !w.visible || w.userData.lifted) return;
      tween({ duration: 380, ease: EASE.soft, update: function (k) {
        w.rotation.z = Math.sin(k * Math.PI * 3) * 0.035 * (1 - k);
      }, done: function () { w.rotation.z = 0; } });
    });
    var lead = $('cut-lead');
    if (lead) { lead.textContent = 'Start at the top'; setTimeout(updateCutUI, 1100); }
  }
  function slicesLeft() { return cut ? cut.wedges.filter(function (w) { return w.visible && !w.userData.lifted; }).length : 0; }
  function topRemainingTier() {
    // You cut the top tier first; a bottom wedge with a tier on top of it makes no sense.
    var best = -1;
    cut.wedges.forEach(function (w) { if (w.visible && !w.userData.lifted) best = Math.max(best, w.userData.tier); });
    return best;
  }

  var _ray = new THREE.Raycaster(), _ndc2 = new THREE.Vector2();
  function wedgeAt(clientX, clientY) {
    if (!cut) return null;
    var r = canvas.getBoundingClientRect();
    _ndc2.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    _ray.setFromCamera(_ndc2, camera);
    var hits = _ray.intersectObjects(cutGroup.children, true);
    var top = topRemainingTier();
    for (var i = 0; i < hits.length; i++) {
      var w = hits[i].object.userData.wedge;
      if (!w || !w.visible || w.userData.lifted) continue;
      if (w.userData.tier === top) return w;
      wobbleTier(top);                         // they tapped a lower tier: show why not
      return null;
    }
    return null;
  }

  function liftWedge(w) {
    if (!cut || cut.lifted) return;
    cut.lifted = w; w.userData.lifted = true;
    // Toward the viewer, whatever the camera's doing: the slice always comes to you.
    var dir = new THREE.Vector3(camera.position.x, 0, camera.position.z).normalize();
    var tier = tierTops(config)[w.userData.tier];
    var out = tier.r + 1.9;
    var target = dir.clone().multiplyScalar(out);
    // Small plate arrives from the side
    var plate = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.08, 48), new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.4 }));
    plate.position.set(target.x + dir.z * 3, 0.04, target.z - dir.x * 3);
    if (window.CakeLook) CakeLook.adopt(plate);
    cutGroup.add(plate); cut.plate = plate;
    // The wedge's own centroid direction, so it lands centred on the plate
    var thMid = (w.userData.i + 0.5) * Math.PI * 2 / WEDGES_PER_TIER;
    var cen = new THREE.Vector3(Math.sin(thMid) * tier.r * 0.6, 0, Math.cos(thMid) * tier.r * 0.6);
    var startP = w.position.clone();
    var endP = new THREE.Vector3(target.x - cen.x, 0.08 - tier.y0, target.z - cen.z);
    tween({ duration: 450, ease: EASE.lift, update: function (k) {
      w.position.lerpVectors(startP, endP, k);
      w.position.y += Math.sin(Math.PI * k) * 0.55;                  // up and over
      w.rotation.z = Math.sin(k * Math.PI * 2) * 0.05 * (1 - k);      // wobble, decaying
    }, done: function () {
      w.position.copy(endP);
      tween({ duration: 160, ease: EASE.pop, update: function (k) { w.scale.y = 0.96 + 0.04 * k; } });
    } });
    tween({ delay: 120, duration: 280, ease: EASE.soft, update: function (k) {
      plate.position.set(target.x + dir.z * 3 * (1 - k), 0.04, target.z - dir.x * 3 * (1 - k));
    } });
    updateCutUI();
  }

  function updateCutUI() {
    if (!cut) return;
    var lead = $('cut-lead'), card = $('slicecard'), left = $('slices-left'), back = $('slice-back'), nameEl = $('slice-name');
    var n = slicesLeft();
    if (cut.lifted) {
      lead.textContent = 'Send this slice to someone';
      card.hidden = false;
      var canBack = !!config.from && !cut.sentBack;
      back.hidden = !canBack;
      back.textContent = 'Send a slice back to ' + config.from;
      nameEl.value = '';
      left.textContent = n + ' slice' + (n === 1 ? '' : 's') + ' left';
    } else if (n === 0) {
      lead.textContent = 'You shared the whole cake 🎉';
      card.hidden = true; left.textContent = '';
      fitShadow(0.6);                                   // nothing left to cast it
      showFinished();
    } else {
      // Multi-tier: say where to start, and say when the next tier comes into play.
      var top = topRemainingTier(), multi = cut.tiers > 1;
      var tierDone = multi && top < cut.tiers - 1;
      lead.textContent = !multi ? 'Tap a slice to cut it'
                       : (tierDone ? 'Now the next tier — tap a slice' : 'Start at the top — tap a slice to cut it');
      card.hidden = true;
      left.textContent = n + ' slice' + (n === 1 ? '' : 's') + ' left';
    }
    updateSeams();
  }

  function sendLiftedSlice(name, back) {
    if (!cut || !cut.lifted) return null;
    var w = cut.lifted, idx = w.userData.index;
    var st = loadCutState(cut.code);
    if (st.gone.indexOf(idx) < 0) st.gone.push(idx);
    if (back) { st.sentBack = true; cut.sentBack = true; }
    st.names = st.names || [];
    var who = back ? config.from : name;
    if (who && st.names.indexOf(who) < 0) st.names.push(who);
    saveCutState(cut.code, st);
    var url = sliceLinkFor(config, idx, { blown: true, name: back ? config.from : name, back: back });
    // The wedge leaves; the plate goes with it.
    var plate = cut.plate;
    tween({ duration: 280, ease: EASE.soft, update: function (k) {
      w.position.y += 0.02; w.scale.setScalar(1 - 0.6 * k);
      if (plate) plate.scale.setScalar(1 - k);
    }, done: function () {
      w.visible = false; w.scale.setScalar(1);
      if (plate) { cutGroup.remove(plate); }
      cut.plate = null; cut.lifted = null;
      updateCutUI();
    } });
    return url;
  }

  // The end of the cake is the most generous moment in the whole flow — straight back into
  // the loop from here: send one back, set the reminder, or send someone a cake.
  function showFinished() {
    var st = loadCutState(cut.code), names = st.names || [];
    var sub = $('finished-sub'), back = $('finished-back'), rem = $('finished-remind'), send = $('finished-send');
    var n = cut.total;
    var who = names.length === 0 ? '' :
              names.length === 1 ? names[0] :
              names.length === 2 ? names[0] + ' and ' + names[1] :
              names.slice(0, 2).join(', ') + ' and ' + (names.length - 2) + ' more';
    sub.textContent = n + ' slices' + (who ? ', shared with ' + who : '') + (config.from ? ' — ' + config.from + "'s cake went a long way" : '');
    var canBack = !!config.from && !st.sentBack;
    back.hidden = !canBack;
    if (canBack) {
      var pre = normalize(config); var t = pre.from, f = pre.to; pre.to = t; pre.from = f; pre.m = '';
      back.textContent = 'Send one back to ' + config.from; back.href = editLinkFor(pre);
    }
    rem.hidden = !config.from;
    rem.textContent = 'Remind me for ' + (config.from || 'their') + "'s birthday";
    rem.onclick = function () { openRemind('recipient', config); };
    send.href = './?src=slice';
    $('vs-finished').hidden = false;
  }

  // ---- Slice page: one wedge on a plate ----
  function enterSlice(cfg, sl) {
    viewerMode = 'slice'; slice = sl;
    build(cfg, { showMessage: true, animate: false });
    built.visible = false;                                   // no whole cake here
    while (cutGroup.children.length) cutGroup.remove(cutGroup.children[0]);
    var TM = tierMaterials(cfg), frostingMat = TM.side, capMat = TM.cap, faceMat = TM.face;
    var tiers = tierTops(cfg);
    var ti = Math.min(tiers.length - 1, Math.floor(sl.index / WEDGES_PER_TIER));
    var tier = { r: tiers[ti].r, h: tiers[ti].h, y0: 0.08 };
    var w = makeWedge(tier, 0, cfg, frostingMat, capMat, faceMat, null);
    // Centre the wedge's centroid on the plate and face the cut toward +z
    // The wedge is built around the cake's axis; rotate it so the cut points at the camera,
    // then move it by its (rotated) centroid so it sits on the plate's centre.
    var thMid = 0.5 * Math.PI * 2 / WEDGES_PER_TIER;
    w.rotation.y = Math.PI - thMid;                          // centroid now points to -z (away)
    var cr = tier.r * 0.62;
    w.position.set(0, 0, cr);                                 // pull it back to the centre
    if (window.CakeLook) CakeLook.adopt(w);
    cutGroup.add(w);
    var plate = new THREE.Mesh(new THREE.CylinderGeometry(tier.r * 0.78, tier.r * 0.78, 0.08, 64), new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.4 }));
    plate.position.y = 0.04; if (window.CakeLook) CakeLook.adopt(plate); cutGroup.add(plate);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(tier.r * 0.74, 0.045, 10, 96),
      new THREE.MeshStandardMaterial({ color: PALETTES.ribbon[clampIndex(cfg.rc, PALETTES.ribbon)].hex, roughness: 0.5 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.09; cutGroup.add(rim);
    // No candle on a slice: the candles went when the cake was cut, and a slice that
    // sprouted a new one would contradict that. It's a piece of the cake you were sent.
    flames.length = 0; wicks.length = 0;
    var topY = 0.08 + tier.h;
    landings = [{ y: topY, r: tier.r * 0.8, rInner: 0 }];
    fitShadow(tier.r * 0.8);
    blow = { enabled: false, lastWave: 0, micLevel: 0, micHold: 0, total: 0, revealed: true };
    setFrame('cake', 0.9, true);
    camAzimuth = 0; spinEnabled = true; spinFree = false;
    // Chrome
    var head = $('slice-head'); head.hidden = false;
    var isBack = sl.back && cfg.from;
    $('sh-title').textContent = (cfg.to || 'Someone') + ' sent you a slice';
    $('sh-sub').textContent = isBack ? 'They blew out the candles 🎂' : ('of the cake ' + (cfg.from ? cfg.from + ' made' : 'they were sent'));
    $('slice-msg').textContent = cfg.m ? ((cfg.from || 'They') + ' wrote “' + cfg.m + '”') : (isBack ? 'Your cake landed.' : 'Someone is thinking of you.');
    setViewerState('slice');
    // A little confetti as it lands, then the actions. No blow step to wait for.
    setTimeout(function () {
      var pal = [PALETTES.frosting[clampIndex(cfg.fc, PALETTES.frosting)].hex, PALETTES.candle[clampIndex(cfg.cc, PALETTES.candle)].hex, 0xffffff, 0xFFD166];
      confettiBurst(pal.map(function (h) { return hexCss(h); }), 40);
    }, 700);
    setTimeout(showSliceDone, 2200);
  }
  function showSliceDone() {
    var isBack = slice && slice.back && config.from;
    $('slice-done-lead').textContent = isBack ? 'Your cake landed.' : ((config.to || 'They') + ' shared their cake with you.');
    var cta = $('slice-cta'), hint = $('slice-cta-hint');
    if (isBack) {
      cta.textContent = 'Send ' + config.to + ' another next year';
      cta.href = '#'; cta.onclick = function (e) { e.preventDefault(); openRemind('sender', config); };
      hint.textContent = "We'll put it in your calendar";
    } else {
      cta.textContent = 'Send someone a cake'; cta.href = './?src=slice'; cta.onclick = null;
      hint.textContent = 'Cakes from ' + PRICES[1];
    }
    setViewerState('slice-done');
    requestAnimationFrame(function () { $('vs-slice-done').classList.add('on'); });
  }

  // =====================================================================
  //  Reminders — a calendar file, no server.
  //  Moonpig's reminders drive ~40% of its orders and need a database and an email
  //  operation. A .ics with a yearly RRULE gets most of the effect for free: the alert
  //  comes from the phone's own calendar, works everywhere, and never depends on us.
  // =====================================================================
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function nthWeekdayOfMonth(year, month1, weekday0, n) {
    var d = new Date(year, month1 - 1, 1);
    var offset = (weekday0 - d.getDay() + 7) % 7;
    return new Date(year, month1 - 1, 1 + offset + (n - 1) * 7);
  }
  var WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  // Returns { first: Date (the first alert date), rrule: string|null, label } or null if no rule.
  function reminderPlan(occ, pickedDate) {
    var rule = occ.rule, now = new Date(), yr = now.getFullYear();
    var next, rrule = null;
    if (rule.type === 'yearly' || rule.type === 'becomes') {
      if (!pickedDate) return null;
      next = new Date(yr, pickedDate.getMonth(), pickedDate.getDate());
      if (next <= now) next = new Date(yr + 1, pickedDate.getMonth(), pickedDate.getDate());
      rrule = 'FREQ=YEARLY';
    } else if (rule.type === 'fixed') {
      next = new Date(yr, rule.m - 1, rule.d);
      if (next <= now) next = new Date(yr + 1, rule.m - 1, rule.d);
      rrule = 'FREQ=YEARLY';
    } else if (rule.type === 'weekday') {
      next = nthWeekdayOfMonth(yr, rule.m, WD[rule.wd], rule.n);
      if (next <= now) next = nthWeekdayOfMonth(yr + 1, rule.m, WD[rule.wd], rule.n);
      rrule = 'FREQ=YEARLY;BYMONTH=' + rule.m + ';BYDAY=' + rule.n + rule.wd;
    } else {
      return null;
    }
    // The event goes on the real date. The early nudge is an ALARM on it (see icsFor),
    // not a shifted event — a shifted event would show the wrong date in the month view.
    return { first: next, rrule: rrule, eventDate: next };
  }

  // summary = the occasion as it should appear in the calendar ("Hollie's birthday 🎂").
  // nudge   = what the alarm says ("Send Hollie a cake").
  // Alarms on an all-day event are relative to 00:00 on the day, so "3 days before at
  // 09:00" is -P2DT15H, and "on the day at 09:00" is +PT9H. Apple and Google both honour
  // these; a bare -P3D would fire at midnight, which nobody wants.
  function icsFor(summary, description, plan, url, nudge) {
    var uid = 'cake-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@cake4.me';
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    var esc = function (t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); };
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//cake4.me//Reminder//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + ymd(plan.first),
      'DTEND;VALUE=DATE:' + ymd(addDays(plan.first, 1)),
      plan.rrule ? 'RRULE:' + plan.rrule : null,
      'SUMMARY:' + esc(summary),
      'DESCRIPTION:' + esc(description + '\n' + url),
      'URL:' + url,
      'BEGIN:VALARM', 'TRIGGER:-P' + (REMIND_LEAD_DAYS - 1) + 'DT15H', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(nudge || summary), 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:PT9H', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(nudge || summary), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].filter(Boolean);
    return lines.join('\r\n') + '\r\n';
  }

  function downloadIcs(filename, text) {
    var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // ---- The pop-up. Big "Yes", quiet "Maybe next time". ----
  // mode 'sender'    → after sending: remind me next year (or, for one-offs, ask for their birthday)
  // mode 'recipient' → after opening: remind me for the sender's birthday
  function poss(name) { return name === 'their' ? 'their' : (name + (/s$/i.test(name) ? "'" : "'s")); }
  var remindState = null;
  function openRemind(mode, cfg) {
    var occ = OCCASIONS[clampIndex(cfg.o, OCCASIONS)];
    var el = $('remind'); if (!el) return;
    var known = mode === 'sender' ? cfg.to : cfg.from;
    var who = known || 'their';               // possessive-safe fallback: "their birthday"
    var whoWrap = $('remind-who-wrap'), whoIn = $('remind-who');
    whoWrap.hidden = !!known; if (!known) whoIn.value = '';
    var title = $('remind-title'), body = $('remind-body'), dateWrap = $('remind-date-wrap'), date = $('remind-date');
    var needsDate = false, plan = null, summary, description;

    if (mode === 'sender' && occ.rule.type !== 'none') {
      needsDate = (occ.rule.type === 'yearly' || occ.rule.type === 'becomes');
      if (occ.rule.type === 'becomes') {
        title.textContent = 'Remind you for ' + poss(who) + ' ' + occ.rule.into + '?';
        body.textContent = "We'll add it to your calendar, yearly, with a nudge three days before and this cake ready to send again.";
      } else if (needsDate) {
        title.textContent = 'Remind you next year?';
        body.textContent = "We'll put " + poss(who) + ' ' + occ.say + " in your calendar, with a nudge three days before and this cake ready to send again.";
      } else {
        title.textContent = 'Remind you next ' + occ.say + '?';
        body.textContent = "We'll add " + occ.say + " to your calendar, yearly, with a nudge three days before and this cake ready to send again.";
      }
      var occLabel = (occ.rule.type === 'fixed' || occ.rule.type === 'weekday') ? occ.name : (poss(who) + ' ' + (occ.say || occ.name));
      summary = occLabel + ' 🎂';
      var whoObj = known ? who : 'them';
      description = 'Send ' + whoObj + ' a cake. Last time you sent this one:';
      remindState = { mode: mode, occ: occ, cfg: cfg, summary: summary, nudge: 'Send ' + whoObj + ' a cake 🎂', description: description, needsDate: needsDate };
    } else {
      // One-off occasion, or the recipient's side: capture a birthday.
      needsDate = true;
      title.textContent = "When's " + poss(who) + ' birthday?';
      body.textContent = mode === 'sender'
        ? "We'll put it in your calendar with a nudge three days before and a cake ready to go."
        : "We'll put it in your calendar with a nudge three days before, so you can send one back.";
      summary = poss(who) + ' birthday 🎂';
      var whoObj2 = known ? who : 'them';
      description = 'Send ' + whoObj2 + ' a cake:';
      remindState = { mode: mode, occ: OCCASIONS[0], cfg: cfg, summary: summary, nudge: 'Send ' + whoObj2 + ' a birthday cake 🎂', description: description, needsDate: true, birthday: true };
    }
    dateWrap.hidden = !needsDate;
    if (needsDate) { var t = new Date(); date.value = t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()); }
    refreshGoogleLink();
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('on'); });
  }
  // Google Calendar takes an event as a URL — no file, no preview, works everywhere Google
  // Calendar does (Android, and iPhones that live in it). Built from the same plan as the .ics.
  function googleCalendarUrl(summary, description, plan, url) {
    var d1 = ymd(plan.first), d2 = ymd(addDays(plan.first, 1));
    var q = 'action=TEMPLATE&text=' + encodeURIComponent(summary) +
            '&dates=' + d1 + '/' + d2 +
            '&details=' + encodeURIComponent(description + '\n' + url) +
            (plan.rrule ? '&recur=' + encodeURIComponent('RRULE:' + plan.rrule) : '');
    return 'https://calendar.google.com/calendar/render?' + q;
  }
  // If the pop-up asked for a name, fold it into the wording before anything is built.
  function applyTypedName(st) {
    var w = $('remind-who');
    if (!w || $('remind-who-wrap').hidden) return st;
    var name = cleanText(w.value, MAX_NAME);
    if (!name) return st;
    var out = {}; for (var k in st) out[k] = st[k];
    out.summary = st.summary.replace(/\btheir\b/g, poss(name));
    out.nudge = (st.nudge || '').replace(/\bthem\b/g, name).replace(/\btheir\b/g, poss(name));
    out.description = st.description.replace(/\bthem\b/g, name).replace(/\btheir\b/g, poss(name));
    out.name = name;
    return out;
  }
  function currentPlan() {
    if (!remindState) return null;
    var st = remindState, picked = null;
    if (st.needsDate) {
      var v = $('remind-date').value; if (!v) return null;
      var parts = v.split('-'); picked = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    }
    return reminderPlan(st.birthday ? OCCASIONS[0] : st.occ, picked);
  }
  function prefillFor(st) {
    var pre = normalize(st.cfg);
    if (st.mode !== 'sender') { var to = pre.from, from = pre.to; pre.to = to; pre.from = from; pre.m = ''; }
    return pre;
  }
  function refreshGoogleLink() {
    var a = $('remind-google'); if (!a || !remindState) return;
    var plan = currentPlan();
    if (!plan) { a.hidden = true; return; }
    a.hidden = false;
    var st = applyTypedName(remindState);
    var pre = prefillFor(st); if (st.name) pre.to = st.name;
    a.href = googleCalendarUrl(st.summary, st.description, plan, editLinkFor(pre));
  }
  function closeRemind() {
    var el = $('remind'); if (!el) return;
    el.classList.remove('on');
    setTimeout(function () { el.hidden = true; }, 220);
  }
  function confirmRemind() {
    if (!remindState) return;
    var st = remindState, picked = null;
    if (st.needsDate) {
      var v = $('remind-date').value;
      if (!v) return;
      var parts = v.split('-'); picked = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    }
    var occForPlan = st.birthday ? OCCASIONS[0] : st.occ;
    var plan = reminderPlan(occForPlan, picked);
    if (!plan) { closeRemind(); return; }
    st = applyTypedName(st);
    // The reminder's link opens the builder pre-filled. Sender: this cake, same names.
    // Recipient: names swapped, message cleared, same cake as a starting point.
    var pre = prefillFor(st); if (st.name) pre.to = st.name;
    var url = editLinkFor(pre);
    downloadIcs('cake-reminder.ics', icsFor(st.summary, st.description, plan, url, st.nudge));
    rememberDate(st.name || (st.mode === 'sender' ? st.cfg.to : st.cfg.from), occForPlan.name, plan.eventDate);
    var hint = $('remind-done');
    if (hint) {
      // iOS opens the file in a preview: the event only lands when they tap "Add To Calendar"
      // at the bottom. The tick in the corner just closes the preview. Say so.
      hint.textContent = 'Tap "Add To Calendar" when it opens — "' + st.summary + '" will repeat yearly with a nudge three days before.';
      hint.hidden = false;
    }
    closeRemind();
  }
  // Birthday book: dates the sender has told us, kept on their phone. No account.
  function rememberDate(name, occasion, date) {
    if (!name) return;
    try {
      var book = JSON.parse(localStorage.getItem('cake.book') || '[]');
      book = book.filter(function (e) { return !(e.name === name && e.occasion === occasion); });
      book.push({ name: name, occasion: occasion, month: date.getMonth() + 1, day: date.getDate() });
      localStorage.setItem('cake.book', JSON.stringify(book));
    } catch (e) {}
  }

  // =====================================================================
  //  UI: builder
  // =====================================================================
  var $ = function (id) { return document.getElementById(id); };
  var els = {
    builder: $('builder'), linkpanel: $('linkpanel'), viewerFoot: $('viewer-foot'),
    to: $('f-to'), from: $('f-from'), m: $('f-m'), mCount: $('m-count'), n: $('f-n'), nOut: $('n-out'),
    tiers: $('tiers'), swFc: $('sw-fc'), swIc: $('sw-ic'), swCc: $('sw-cc'), swRc: $('sw-rc'), swTc: $('sw-tc'), swBg: $('sw-bg'),
    getLink: $('get-link'), linkOut: $('link-out'), share: $('share-link'), copy: $('copy-link'),
    copyHint: $('copy-hint'), open: $('open-link'), edit: $('edit-cake')
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
      if (item.auto) {
        b.classList.add('swatch-auto');       // filled in by refreshAutoSwatch()
      } else if (item.layers) {
        if (key === 'bg') {
          // Backgrounds are two-stop gradients, shown as they'll actually appear.
          b.style.background = 'linear-gradient(180deg, ' + hexCssStr(item.layers[0]) + ', ' + hexCssStr(item.layers[1]) + ')';
        } else if (item.layers.length > 1) {
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
        if (key === 'fc' || key === 'tc') refreshAutoSwatch();
        updateColourNote();
        build(draft, { showMessage: true });
      });
      container.appendChild(b);
    });
  }
  // The "Match the cake" swatch previews what it would actually produce.
  // Both "Auto" swatches preview what they'd actually produce for the current frosting.
  function refreshAutoSwatch() {
    if (!draft) return;
    var f = PALETTES.frosting[clampIndex(draft.fc, PALETTES.frosting)].hex;
    if (els.swBg) {
      var bgEl = els.swBg.querySelector('.swatch-auto');
      if (bgEl) {
        var top = new THREE.Color(f).lerp(new THREE.Color(0xffffff), 0.72);
        var bottom = new THREE.Color(0xffe9c7).lerp(new THREE.Color(f), 0.15);
        bgEl.style.background = 'linear-gradient(180deg, #' + top.getHexString() + ', #' + bottom.getHexString() + ')';
      }
    }
    if (els.swTc) {
      var tcEl = els.swTc.querySelector('.swatch-auto');
      if (tcEl) tcEl.style.background = pickInk(f, 0);
    }
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
    syncSwatches(els.swRc, draft.rc);
    syncSwatches(els.swTc, draft.tc);
    syncSwatches(els.swBg, draft.bg);
    syncFrosting();
    updateColourNote();
    refreshAutoSwatch();
    syncOccasions();
    updateCta();
  }

  // ---- Chip bar: one tray at a time, or none (so the cake is fully clear) ----
  var openTray = null;
  function setTray(name) {
    openTray = (openTray === name) ? null : name;      // tapping the open chip closes it
    ['occasion', 'message', 'cake', 'candles', 'backdrop'].forEach(function (k) {
      var el = $('tray-' + k);
      if (el) el.hidden = (k !== openTray);
    });
    Array.prototype.forEach.call($('chiprow').children, function (c) {
      c.setAttribute('aria-selected', c.getAttribute('data-tray') === openTray ? 'true' : 'false');
    });
    $('trays').classList.toggle('open', !!openTray);
    setTimeout(resize, 0);
  }
  // The frosting going on. The shell fades in over the sponge with a tiny settle in scale, so
  // toggling reads as an event rather than a swap. (A clipping-plane "pour" wants its own shader
  // variant; deferred to the textures pass.)
  function frostOn() {
    var mats = [];
    built.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
        if (m.isMeshStandardMaterial && m.vertexColors && mats.indexOf(m) < 0) mats.push(m);
      });
    });
    mats.forEach(function (m) { m.transparent = true; m.opacity = 0; });
    tierGroups.forEach(function (tg) { tg.scale.set(0.985, 0.985, 0.985); });
    tween({ duration: 520, ease: EASE.soft, update: function (k) {
      mats.forEach(function (m) { m.opacity = k; });
      var sc = 0.985 + 0.015 * k;
      tierGroups.forEach(function (tg) { tg.scale.set(sc, sc, sc); });
    }, done: function () {
      mats.forEach(function (m) { m.transparent = false; m.opacity = 1; });
      tierGroups.forEach(function (tg) { tg.scale.set(1, 1, 1); });
    } });
  }
  // Cake tray sub-tabs: Tiers · Sponge · Frosting — the order a cake is made.
  var cakeTab = 'tiers';
  function setCakeTab(k) {
    cakeTab = k;
    Array.prototype.forEach.call($('caketabs').children, function (t) { t.classList.toggle('on', t.getAttribute('data-k') === k); });
    ['tiers', 'sponge', 'frosting'].forEach(function (x) { var el = $('ck-' + x); if (el) el.hidden = (x !== k); });
    setTimeout(resize, 0);
  }
  function syncFrosting() {
    var on = !!draft.fr;
    var box = $('f-frost'); if (box) box.checked = on;
    var opts = $('frost-opts'); if (opts) opts.classList.toggle('dim', !on);
    Array.prototype.forEach.call($('layers').children, function (b) { b.classList.toggle('on', +b.getAttribute('data-ly') === draft.ly); });
    var lo = $('ly-out'); if (lo) lo.textContent = draft.ly;
  }
  // The writing-colour note lives in the Message tray now.
  function updateColourNote() {
    var note = $('colour-note');
    if (!note) return;
    var frosting = PALETTES.frosting[clampIndex(draft.fc, PALETTES.frosting)].hex;
    var bgHex = draft.fr ? frosting : SPONGE;
    var ink = pickInk(bgHex, draft.tc);
    // Their cake, their call — but say so if it'll be hard to read.
    note.textContent = inkContrast(ink, bgHex) < 2.2
      ? 'Low contrast — this may be hard to read on the cake'
      : (draft.fr ? 'Auto picks dark or light to suit the frosting' : 'Auto picks dark or light to suit the sponge');
  }
  function updateCta() {
    var el = $('cta-price');
    if (el) el.textContent = PRICES[draft.t] || PRICES[1];
    var cn = $('chip-n');
    if (cn) cn.textContent = draft.n;
  }

  function makeOccasions() {
    var host = $('occasions'); if (!host) return;
    host.innerHTML = '';
    OCCASIONS.forEach(function (o, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'occ'; b.setAttribute('role', 'radio');
      var em = document.createElement('span'); em.className = 'em'; em.textContent = o.emoji;
      b.appendChild(em); b.appendChild(document.createTextNode(o.name));
      b.addEventListener('click', function () {
        draft.o = i;
        syncOccasions();
        // The first two questions should feel like one motion: pick, then straight to the words.
        setTimeout(function () { if (openTray === 'occasion') setTray('message'); }, 220);
      });
      host.appendChild(b);
    });
  }
  function syncOccasions() {
    var host = $('occasions'); if (!host || !draft) return;
    Array.prototype.forEach.call(host.children, function (b, i) {
      b.setAttribute('aria-checked', i === draft.o ? 'true' : 'false');
    });
    var chip = $('chip-o'), ic = $('chip-o-ic');
    var occ = OCCASIONS[draft.o];
    if (chip) chip.textContent = occ ? occ.name : 'Occasion';
    if (ic) ic.textContent = occ ? occ.emoji : '🎁';
  }

  function wireBuilder() {
    makeOccasions();
    Array.prototype.forEach.call($('chiprow').children, function (c) {
      c.addEventListener('click', function () { setTray(c.getAttribute('data-tray')); });
    });
    Array.prototype.forEach.call($('caketabs').children, function (t) {
      t.addEventListener('click', function () { setCakeTab(t.getAttribute('data-k')); });
    });
    $('f-frost').addEventListener('change', function (e) {
      draft.fr = e.target.checked ? 1 : 0;
      syncFrosting(); updateColourNote();
      build(draft);
      if (draft.fr) frostOn();                           // the moment: the frosting goes on
    });
    Array.prototype.forEach.call($('layers').children, function (b) {
      b.addEventListener('click', function () { draft.ly = +b.getAttribute('data-ly'); syncFrosting(); build(draft); });
    });
    setCakeTab('tiers');

    makeSwatches(els.swFc, PALETTES.frosting, 'fc');
    makeSwatches(els.swIc, PALETTES.filling, 'ic');
    makeSwatches(els.swCc, PALETTES.candle, 'cc');
    makeSwatches(els.swRc, PALETTES.ribbon, 'rc');
    makeSwatches(els.swTc, PALETTES.text, 'tc');
    makeSwatches(els.swBg, PALETTES.background, 'bg');

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
      updateCta();
      build(draft, { showMessage: true });
    });

    Array.prototype.forEach.call(els.tiers.children, function (b) {
      b.addEventListener('click', function () {
        draft.t = b.getAttribute('data-t') | 0;
        syncTiers(draft.t);
        updateCta();
        build(draft, { showMessage: true });
      });
    });

    els.getLink.addEventListener('click', function () {
      if (draft.o === OCCASION_UNCHOSEN) draft.o = OCCASION_FALLBACK;
      // The lighting the sender is looking at right now is part of the cake.
      draft.lt = window.CakeLook ? CakeLook.serializeLighting() : '';
      draft = normalize(draft);
      syncOccasions();
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
      var remindDone = $('remind-done'); if (remindDone) { remindDone.hidden = true; }
      startCeremony(function () {
        els.linkpanel.classList.remove('away');
        els.linkpanel.classList.add('stage1');
        setTimeout(function () { els.linkpanel.classList.add('stage2'); }, 240);
        // Once the link is in hand, arm next year: the highest-value moment for this ask.
        setTimeout(function () { openRemind('sender', config); }, 900);
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

  var firstBuilderVisit = true;
  function showSheet(which) {
    els.builder.hidden = which !== 'builder';
    if (which === 'builder' && firstBuilderVisit) {
      firstBuilderVisit = false;
      // Fresh build: "What's the occasion?" is the first question. Pre-filled (a reminder or
      // "send one back"): the occasion is already known, go straight to the message.
      openTray = null; setTray(draft && draft.o >= 0 && draft.__prefilled ? 'message' : 'occasion');
    }
    els.linkpanel.hidden = which !== 'linkpanel';
    els.viewerFoot.hidden = which !== 'viewer';
    setTimeout(resize, 0);
  }
  function wireRemind() {
    var yes = $('remind-yes'), later = $('remind-later'), modal = $('remind'), date = $('remind-date'), g = $('remind-google');
    if (yes) yes.addEventListener('click', confirmRemind);
    if (date) date.addEventListener('change', refreshGoogleLink);
    var who = $('remind-who'); if (who) who.addEventListener('input', refreshGoogleLink);
    if (g) g.addEventListener('click', function () {
      // They chose Google: record the date and close, same as Yes, but the link does the adding.
      var st = remindState, plan = currentPlan();
      if (st && plan) rememberDate(st.mode === 'sender' ? st.cfg.to : st.cfg.from, (st.birthday ? OCCASIONS[0] : st.occ).name, plan.eventDate);
      setTimeout(closeRemind, 300);
    });
    if (later) later.addEventListener('click', closeRemind);
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeRemind(); });
  }
  function wireViewer() {
    wireRemind();
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
    var rb = $('remind-back');
    if (rb) rb.addEventListener('click', function () { if (config) openRemind('recipient', config); });
    document.getElementById('cut-cake').addEventListener('click', startCut);

    // Tap (not drag) on a wedge lifts it
    (function () {
      var down = null;
      canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
      canvas.addEventListener('pointerup', function (e) {
        if (!down || !cut || cut.lifted) { down = null; return; }
        var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        var quick = performance.now() - down.t < 450;
        down = null;
        if (moved < 10 && quick) { var w = wedgeAt(e.clientX, e.clientY); if (w) liftWedge(w); }
      });
    })();

    // Slice card
    function shareUrl(url, title) {
      if (navigator.share) { navigator.share({ title: title, text: title, url: url }).catch(function () {}); return true; }
      return false;
    }
    function copyUrl(url, done) {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done); else done();
    }
    $('slice-back').addEventListener('click', function () {
      var url = sendLiftedSlice('', true); if (!url) return;
      var title = 'A slice of the cake you sent ' + (config.to || 'me') + ' 🍰';
      if (!shareUrl(url, title)) copyUrl(url, function () { $('slice-hint').textContent = 'Link copied — send it to ' + config.from; });
    });
    $('slice-share').addEventListener('click', function () {
      var name = cleanText($('slice-name').value, MAX_NAME);
      var url = sendLiftedSlice(name, false); if (!url) return;
      var title = (config.to || 'Someone') + ' sent you a slice of cake 🍰';
      if (!shareUrl(url, title)) copyUrl(url, function () { $('slice-hint').textContent = 'Link copied'; });
    });
    $('slice-copy').addEventListener('click', function () {
      var name = cleanText($('slice-name').value, MAX_NAME);
      var url = sendLiftedSlice(name, false); if (!url) return;
      copyUrl(url, function () { $('slice-hint').textContent = 'Link copied'; setTimeout(function () { $('slice-hint').innerHTML = '&nbsp;'; }, 1800); });
    });
  }

  // =====================================================================
  //  Router
  // =====================================================================
  // =====================================================================
  //  Shader warm-compile. Three compiles a material's program on its first draw, and the
  //  PCSS variant is heavy — a compile mid-gesture reads as a freeze. Rather than maintain a
  //  hand-written list of material variants (which drifted out of date within a day), build
  //  one of each REAL thing the app makes, let renderer.compile() initialise every program,
  //  then throw the stand-ins away. renderer.compile walks every object with a material,
  //  visible or not, so nothing needs to be on screen.
  // =====================================================================
  function warmCompile() {
    var tmp = new THREE.Group(); tmp.name = 'warm-compile'; tmp.visible = false;
    var cfg = normalize(DEFAULTS); cfg.m = 'warm'; cfg.t = 2;
    var frosting = PALETTES.frosting[0].hex, filling = PALETTES.filling[7].layers;
    var frostingMat = new THREE.MeshStandardMaterial({ color: frosting, roughness: 0.62, vertexColors: true });
    var capMat = new THREE.MeshStandardMaterial({ color: frosting, roughness: 0.55, vertexColors: true });
    var faceMat = new THREE.MeshStandardMaterial({ map: makeLayersTexture(filling), roughness: 0.9, side: THREE.DoubleSide, vertexColors: true });
    var msgTex = makeMessageTexture('warm', INK_DARK, frosting, 2.2, 1.2);
    var msgMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, map: msgTex, vertexColors: true });
    nightGlow(msgMat, 0xffffff, true);                                   // message band: map + emissiveMap
    var tier = { r: 2.2, h: 1.6, y0: 0, aboveR: 1.4 };
    tmp.add(makeWedge(tier, 0, cfg, frostingMat, capMat, faceMat, msgTex)); // wedge band: map, no emissive
    tmp.add(makeWedge(tier, 1, cfg, frostingMat, capMat, faceMat, null));
    var wholeBody = new THREE.Mesh(CakeShapes.body(2.2, 1.28, 8), [msgMat, frostingMat, frostingMat]); tmp.add(wholeBody);
    tmp.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 8), new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.4 })));   // plate
    tmp.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.16, depthWrite: false }))); // seams
    tmp.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 4, 8), new THREE.MeshStandardMaterial({ color: 0xff6f91, roughness: 0.5 })));      // plate rim
    tmp.add(new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xff6f91, roughness: 0.5, side: THREE.DoubleSide }))); // ribbon band (double-sided)
    var smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.9, toneMapped: false })); tmp.add(smoke); // smoke wisp (linear-encoded texture)
    if (window.CakeLook) CakeLook.adopt(tmp);
    scene.add(tmp);
    // The box, the confetti mesh (count 0) and the floor already exist in the scene; the
    // built cake and its candles do too. compile() takes all of them in one pass.
    try { renderer.compile(scene, camera); } catch (e) {}
    scene.remove(tmp);
    tmp.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    msgTex.dispose();
  }

  function route() {
    endCeremony();
    stopMic();
    clearConfetti();
    built.position.y = 0; built.scale.set(1, 1, 1);
    spinEnabled = true; spinFree = false; omega = SPIN.idle; tiltX = 0; bankZ = 0;
    camElev = CAM_ELEV_BASE; camRoll = 0; camZoom = 1; frameCamera();
    blow.enabled = false;
    els.linkpanel.classList.remove('stage1', 'stage2', 'away');
    els.builder.classList.remove('away');
    var fromLink = readHash();
    var sl = fromLink ? readSliceHash() : null;
    // Lighting travels with the cake. Apply it before anything is built so the shadow shader
    // (which bakes the two light sizes) and the material warm-up see the final state; a
    // recipient must never pay a shader compile mid-gesture. No field → as designed.
    if (window.CakeLook) {
      var pre0 = readEditHash();
      var lt = fromLink ? fromLink.lt : (pre0 ? pre0.lt : '');
      CakeLook.resetLighting();
      CakeLook.applyLighting(lt);
      CakeLook.rebuild(renderer, scene, key);
      updateRoomLights();
    }
    // Reset Phase 4 state on any route
    while (cutGroup.children.length) cutGroup.remove(cutGroup.children[0]);
    cut = null; slice = null; viewerMode = 'cake';
    var shead = $('slice-head'); if (shead) shead.hidden = true;
    if (fromLink && sl) {
      // Slice recipient: one wedge, one candle, no cutting further.
      document.body.classList.remove('mode-builder');
      document.body.classList.add('mode-viewer');
      showSheet('viewer');
      enterSlice(fromLink, sl);
      resize();
      return;
    }
    if (fromLink) {
      // Viewer
      document.body.classList.remove('mode-builder');
      document.body.classList.add('mode-viewer');
      showSheet('viewer');
      // Reciprocity, pre-filled: the recipient's call to action names the sender and
      // opens the builder with the names swapped and this cake as the starting point.
      var so = $('send-own');
      if (so) {
        if (fromLink.from) {
          var back = normalize(fromLink);
          var t = back.from, f = back.to; back.to = t; back.from = f; back.m = '';
          so.textContent = 'Send one back to ' + fromLink.from;
          so.href = editLinkFor(back);
        } else {
          so.textContent = 'Send someone a cake'; so.href = './';
        }
      }
      var rb2 = $('remind-back');
      if (rb2) {
        rb2.hidden = !fromLink.from;
        rb2.textContent = 'Remind me for ' + (fromLink.from || 'their') + "'s birthday";
      }
      enterGate(fromLink);
    } else {
      // Builder
      document.body.classList.remove('mode-viewer');
      document.body.classList.add('mode-builder');
      var pre = readEditHash();
      if (pre) { draft = pre; draft.__prefilled = true; history.replaceState(null, '', location.pathname); }   // consume the pre-fill
      if (!draft) { draft = normalize(DEFAULTS); draft.o = OCCASION_UNCHOSEN; draft.fr = 0; }   // a new cake starts naked
      syncForm();
      showSheet('builder');
      build(draft, { showMessage: true });
      camAzimuth = Math.PI;                // looking at the message side while they write it
    }
    resize();
  }

  function boot() {
    if (running) return;
    running = true;
    wireBuilder();
    wireViewer();
    route();
    warmCompile();
    window.addEventListener('hashchange', function () { route(); warmCompile(); });
    frame();
  }
  if (document.fonts && document.fonts.load) {
    document.fonts.load('60px "Pacifico"').then(boot, boot);
    setTimeout(boot, 1500);
    // Redraw the message texture with the real typeface once it lands. Never a full build:
    // on a phone the font arrives after a slice or cut page has set itself up, and a full
    // rebuild put the whole cake back — candles and all — on top of the slice.
    document.fonts.ready.then(function () { if (config && viewerMode !== 'slice' && !cut) updateMessage(config.m); });
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
    palettes: PALETTES, group: cakeGroup, camera: camera, SPIN: SPIN, TILT: TILT, TWIST: TWIST, ZOOM: ZOOM,
    set azimuth(v) { camAzimuth = v; }, get azimuth() { return camAzimuth; },
    set zoom(v) { camZoom = Math.max(ZOOM.min, Math.min(ZOOM.max, v)); },
    look: window.CakeLook ? CakeLook.LOOK : null,
    relight: updateRoomLights,
    renderer: renderer,               // for cake.renderer.info.programs — count should not grow after load
    relook: function () {
      if (!window.CakeLook) return;
      CakeLook.rebuild(renderer, scene, key);
      var L = CakeLook.LOOK.lights;
      ambientLight.intensity = L.hemiSky ? L.hemi : L.ambient;
      if (ambientLight.isHemisphereLight) { ambientLight.color.set(L.hemiSky); ambientLight.groundColor.set(L.hemiGround); }
      key.intensity = L.key; fill.intensity = L.fill;
      updateRoomLights();
    },
    quality: function () { return { pixelRatio: pixelRatio, devicePixelRatio: deviceDPR, lateFrac: +lastLateFrac.toFixed(2), fallback: fallback, log: qualityLog.slice(-8) }; },
    PIXEL: PIXEL,
    cut: function () { return cut ? { left: slicesLeft(), lifted: !!cut.lifted, sentBack: cut.sentBack, total: cut.total } : null; },
    startCut: startCut, liftFirst: function () { if (!cut) return; var w = cut.wedges.filter(function (x) { return x.visible && x.userData.tier === topRemainingTier(); })[0]; if (w) liftWedge(w); },
    sendSlice: function (name, back) { return sendLiftedSlice(name || '', !!back); },
    confettiRaw: function () {
      return confettiPieces.slice(0, 200).map(function (c) {
        return { fall: c.fall.name, resting: c.resting,
                 p: [+c.p.x.toFixed(2), +c.p.y.toFixed(2), +c.p.z.toFixed(2)],
                 w: +c.w.length().toFixed(2), v: +c.v.length().toFixed(2) };
      });
    },
    confetti: function () { return { count: confetti.count, active: confettiActive, resting: confettiPieces.filter(function (c) { return c.resting; }).length }; },
    debug: function () { return { azimuth: +camAzimuth.toFixed(2), omega: +omega.toFixed(2), elev: +camElev.toFixed(1), roll: +camRoll.toFixed(3), twist: +bankZ.toFixed(3), zoom: +camZoom.toFixed(2), dragging: dragging, lit: litCount(), state: document.body.getAttribute('data-vstate') }; },
    blowAll: function () { for (var i = 0; i < flames.length; i++) extinguish(flames[i], 0, -1); }
  };
})();

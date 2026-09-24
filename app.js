/* Cake — Phase 2a
   Two modes in one page.
     No hash  → builder (sender): live cake + form + "Get my link".
     #c=…     → viewer (recipient): the cake, candles lit, message hidden until Phase 3.
   The whole cake lives in the link. No server, no storage.
*/

(function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var MAX_CANDLES = 100;          // what a LINK may carry (old gifts keep their count)
  var BUILDER_MAX_CANDLES = 6;    // what the builder offers (v0.94: bigger birthdays get number candles)
  // ---- MVP feature flags (Phase 1, 21 Sept 2026) ----
  // These hide parts of the detailed builder. They change what a SENDER can choose, never what
  // a recipient can see: links carrying an occasion, buttercream or a third tier still decode
  // and render exactly as sent. Flip to true to bring a feature back.
  var FEATURES = {
    occasion: false,      // the Occasion chip + tray; new cakes are silently Birthday
    buttercream: false,   // the Frosting chip (semi-naked etc.); fondant remains
    tier3: false          // the Showstopper card; the builder offers one or two tiers
  };
  var OCCASION_DEFAULT = 0;       // Birthday — used when the picker is hidden
  // "Low sun" is the rustic finish shown under a raking key light, which is what makes the
  // strokes come alive. Choosing it lowers the key; choosing another finish restores it.
  // The light is fixed to the ROOM, like a low window: it doesn't follow the camera, so the lit
  // side turns past as the cake spins and the shadow sweeps round. It comes from almost exactly
  // the side (azimuth −80°), which rakes across the visible face both from the recipient's
  // opening view (front, 0°) and from the builder's writing view (back, 180°). The key is turned
  // up and the room's ambient down, because relief is carried by the key: with the soft default
  // balance (ambient stronger than key) a low sun barely changes the picture.
  // ---- Lighting presets (v0.80): the Light chip. A preset is just lighting values — they travel
  // in the link like any lighting. Light SIZE is deliberately not part of a preset: it's baked
  // into the shadow shader, so changing it would recompile every material (a freeze on a phone).
  // Low sun used to be a fondant finish; it's a lighting setup, so it lives here now.
  var LIGHT_PRESETS = [
    { name: 'Daylight',  keyScale: 1.0,  elevation: 47.5, azimuth: -38.7, kelvin: 5000, ambient: 1.0 },
    { name: 'Warm',      keyScale: 1.1,  elevation: 32,   azimuth: -62,   kelvin: 3800, ambient: 0.92 },
    { name: 'Cool',      keyScale: 1.0,  elevation: 42,   azimuth: 30,    kelvin: 6400, ambient: 1.0 },
    { name: 'Low sun',   keyScale: 1.6,  elevation: 14,   azimuth: -80,   kelvin: 4600, ambient: 0.7 },
    { name: 'Overhead',  keyScale: 0.9,  elevation: 72,   azimuth: -20,   kelvin: 5200, ambient: 1.05 }
  ];
  var lightPreset = 0;
  // jitter (optional): small random nudges so generated cakes still vary within a preset.
  function applyLightPreset(i, jitter) {
    if (!window.CakeLook) return;
    var P = LIGHT_PRESETS[Math.max(0, Math.min(LIGHT_PRESETS.length - 1, i | 0))], LK = CakeLook.LOOK, j = jitter ? 1 : 0;
    lightPreset = i | 0;
    LK.keyScale = +(P.keyScale + j * (Math.random() - 0.5) * 0.2).toFixed(2);
    LK.keyDir.elevation = Math.round(Math.max(8, Math.min(85, P.elevation + j * (Math.random() - 0.5) * 12)));
    LK.keyDir.azimuth = Math.round(P.azimuth + j * (Math.random() - 0.5) * 50);
    LK.keyKelvin = Math.round((P.kelvin + j * (Math.random() - 0.5) * 600) / 100) * 100;
    LK.ambientScale = P.ambient; LK.keyHex = -1;
  }

  // ---- Curated looks for the starting cake and the Shuffle chip (v0.73, first pass) ----
  // Independent random picks clash, so randomness chooses a LOOK (colours that belong together)
  // and then varies the shape, the fillings and the ribbon within comfortable bounds.
  // Indices into PALETTES: fc frosting/fondant, ic filling, rc ribbon, cc candle, bg backdrop.
  var LOOKS = [
    { name: 'Strawberries & cream', fc: 0, ic: 0, rc: 3, cc: 0, bg: 1 },
    { name: 'Chocolate & gold',     fc: 2, ic: 5, rc: 2, cc: 5, bg: 2 },
    { name: 'Mint garden',          fc: 3, ic: 3, rc: 4, cc: 0, bg: 1 },
    { name: 'Lemon & sky',          fc: 4, ic: 1, rc: 8, cc: 0, bg: 4 },
    { name: 'Lavender',             fc: 5, ic: 4, rc: 6, cc: 4, bg: 3 },
    { name: 'Blue sky',             fc: 6, ic: 6, rc: 8, cc: 3, bg: 9 },
    { name: 'Coral',                fc: 7, ic: 0, rc: 3, cc: 2, bg: 1 },
    { name: 'Vanilla & raspberry',  fc: 1, ic: 0, rc: 1, cc: 1, bg: 3 },
    { name: 'Midnight',             fc: 1, ic: 2, rc: 2, cc: 5, bg: 7 },
    { name: 'Party',                fc: 1, ic: 7, rc: 0, cc: 3, bg: 9 }
  ];
  var LOOK_BOUNDS = {
    bottomW: [0, 9], bottomH: [0, 9],      // shape steps for the bottom tier: the builder's full range
    topH: [3, 6], topInset: [2, 4],         // upper tier: height, and how many width steps narrower
    fillings: [1, 2],                       // sponge layers − 1 (a very shallow tier gets one)
    ribbonChance: 0.5, ribbonW: [2, 5],
    bakedChance: 0.4,                       // a baked (naked) cake rather than a fondant one
    candles: [1, 3, 5],                     // odd counts only
    finishes: [0, 0, 8, 8, 9, 9, 4, 4, 7, 7, 10, 10, 11, 2, 6],   // icing finish: the tooled ones most often, then the rest
    sponges: [0, 0, 0, 1, 2, 4, 4, 3, 5, 6, 7, 8],   // the vanilla bakes most often, chocolate next, the rest now and then
    lights: [0, 0, 0, 1, 1, 2, 3, 4],       // lighting preset, daylight most often
    numberChance: 0.3,                      // how often a random cake gets number candles
    racks: [0, 0, 1, 1, 2],                 // plain or wire marks most often, bars now and then
    spongeVanillaChance: 0.35,              // otherwise any other sponge, equally
    // The key light (every slider on the dev panel's Key tab). Light size is baked into the
    // shadow shader, so it's randomised on LOAD only — on Shuffle it would force every material
    // to recompile mid-session.
    key: { strength: [0.8, 1.2], elevation: [30, 65], azimuth: [-180, 180], kelvin: [4000, 6500], lightSize: [0.35, 0.9] }
  };
  function randRange(a, b) { return a + Math.random() * (b - a); }
  var lastLook = -1;
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  // Dress `d` (a normalized draft) in a random look, for its current tier count. Words,
  // names, candles count and lighting are the sender's and are left alone.
  function applyRandomLook(d, onLoad) {
    var li; do { li = Math.floor(Math.random() * LOOKS.length); } while (LOOKS.length > 1 && li === lastLook);
    lastLook = li;
    var L = LOOKS[li], B = LOOK_BOUNDS, n = TIERS[d.t].length;
    var sh = [];
    for (var i = 0; i < n; i++) {
      if (i === 0) sh.push({ r: randInt(B.bottomW[0], B.bottomW[1]), h: randInt(B.bottomH[0], B.bottomH[1]) });
      else sh.push({ r: Math.max(0, sh[i - 1].r - randInt(B.topInset[0], B.topInset[1])), h: randInt(B.topH[0], B.topH[1]) });
    }
    var baked = Math.random() < B.bakedChance;
    d.sp = B.sponges[randInt(0, B.sponges.length - 1)];
    d.n = B.candles[randInt(0, B.candles.length - 1)];
    // The lighting: a preset, nudged a little. (Light size varies on load only — see LIGHT_PRESETS.)
    applyLightPreset(B.lights[randInt(0, B.lights.length - 1)], true);
    if (onLoad && window.CakeLook) CakeLook.LOOK.pcss.lightSize = +randRange(B.key.lightSize[0], B.key.lightSize[1]).toFixed(2);
    d.rm = Math.random() < 0.7 ? 0 : 1;                  // satin mostly, grosgrain now and then
    // Number candles now and then, spelling a random age: children's birthdays and grown-up ones.
    d.cm = Math.random() < B.numberChance ? 1 : 0;
    d.age = Math.random() < 0.3 ? randInt(1, 12) : randInt(13, 90);
    d.sd = randInt(0, 999);                              // this cake's own arrangement of every texture
    d.ff = B.finishes[randInt(0, B.finishes.length - 1)];
    d.rk = B.racks[randInt(0, B.racks.length - 1)];
    d.sh = sh;
    d.fc = L.fc; d.ic = L.ic; d.cc = L.cc; d.bg = L.bg; d.rc = L.rc;
    d.fcs = sh.map(function () { return L.fc; }); d.frs = d.fcs.slice();
    d.fds = sh.map(function () { return baked ? 0 : 1; });   // fondant, or a baked cake
    d.frsty = sh.map(function () { return 0; });
    d.ly = 1 + (sh[0].h <= 2 ? B.fillings[0] : randInt(B.fillings[0], B.fillings[1]));
    d.rt = [0, 1, 2].map(function (i) {
      return { on: i < n && Math.random() < B.ribbonChance, c: L.rc, w: randInt(B.ribbonW[0], B.ribbonW[1]), p: randInt(0, 9), a: randInt(-2, 2) };
    });
    return normalize(d);
  }
  var MAX_MSG = 80;
  var MAX_NAME = 24;

  // fr defaults to 1 (smooth) so links from before the sponge-first builder still decode as
  // frosted cakes; the BUILDER starts a fresh cake at fr = 0 (naked) — see newDraft().
  // rb: 0 none · 1 every tier · 2 = legacy (upper tiers only, which is what links before v0.57
  // showed). Missing → 2 so old links look exactly as they did; a fresh draft starts at 0.
  var DEFAULTS = { v: SCHEMA_VERSION, to: '', from: '', m: '', n: 1, t: 1, fc: 0, ic: 0, cc: 0, bg: 1, rc: 0, tc: 0, o: 0, lt: '', ly: 3, fr: 1, rb: 2 };
  // Ribbon geometry: a strip lying ON the cake — inner face at the cake's radius, a hair thick,
  // bottom edge just above the base fillet. Width comes per tier from the settings below.
  var RIBBON = { thick: 0.02, lift: 0.16, widthMin: 0.12, widthStep: 0.05, steps: 8 };
  function ribbonWidth(step) { return RIBBON.widthMin + RIBBON.widthStep * Math.max(0, Math.min(RIBBON.steps - 1, step | 0)); }
  // Per-tier ribbon settings, three characters per tier: on (0/1), colour index, width step.
  // "rt" is the live array of {on, c, w}; "rbt" is its string form in the link.
  function parseRibbons(str, legacyRb, legacyRc) {
    var out = [], clean = String(str || '').replace(/[^0-9]/g, '');
    for (var i = 0; i < 3; i++) {
      if (clean.length >= (i + 1) * 3) {
        out.push({ on: clean[i * 3] === '1', c: clampInt(+clean[i * 3 + 1], 0, PALETTES.ribbon.length - 1, 0), w: clampInt(+clean[i * 3 + 2], 0, RIBBON.steps - 1, 4) });
      } else {
        // No per-tier data: derive from the older rb/rc fields so old links look as they did.
        var on = legacyRb === 1 || (legacyRb === 2 && i > 0);
        out.push({ on: on, c: clampInt(legacyRc, 0, PALETTES.ribbon.length - 1, 0), w: 4 });
      }
    }
    return out;
  }
  // Ribbon POSITION per tier (v0.77): 0–9, where 0 puts the ribbon's bottom at the bottom of the
  // tier's straight wall and 9 its top at the top of it. −1 = the fixed lift older links used.
  function ribbonY(TM, tier, width, p) {
    if (p === undefined || p < 0) return RIBBON.lift;
    var bottom, top;
    if (TM.fdOn) {
      var capRim = Math.min(CakeShapes.P.capRim, TM.capH * 0.9);
      bottom = FONDANT_BASE_FILLET; top = TM.hh - capRim;
    } else {
      bottom = CakeShapes.P.disc.spongeFillet; top = tier.hs - CakeShapes.P.disc.spongeFillet;
    }
    return bottom + (Math.max(0, Math.min(9, p)) / 9) * Math.max(0, top - bottom - width);
  }
  // How far the band may tilt before it would ride off the wall: the angle slider asks, the
  // wall decides. A ribbon flush with the top or bottom of a tier simply tilts less.
  function ribbonHandFor(cfg, tier, TM, w, rt) {
    if (!window.CakeFrosting) return null;
    var H = CakeFrosting.ribbonHand(tier.idx || 0);
    H.amp = 0; H.lift = 0;                                // no gathering: it read as bunched-up fabric
    var y = ribbonY(TM, tier, w, rt.p), bottom, top;
    if (TM.fdOn) { bottom = FONDANT_BASE_FILLET; top = TM.hh - Math.min(CakeShapes.P.capRim, TM.capH * 0.9); }
    else { bottom = CakeShapes.P.disc.spongeFillet; top = tier.hs - CakeShapes.P.disc.spongeFillet; }
    var room = Math.max(0, Math.min(y - bottom, top - (y + w))) * 0.9;
    var asked = (rt.a || 0) * 0.014;                      // ±4 steps ≈ ±5.6mm at the rim
    H.tilt = Math.sign(asked) * Math.min(Math.abs(asked), room);
    return H;
  }
  // (the gift box already has a `ribbonMat` variable in this scope — hence the longer name)
  // The fondant wall swells slightly at mid-height, so a ribbon at a fixed radius would sink
  // into it. Sit it on the wall's actual radius at its own height (the widest point it covers).
  function ribbonRadius(TM, rr, bodyH, pOpts, y, w) {
    if (!TM.fdOn) return rr;
    var prof = CakeShapes.bodyProfile(rr, bodyH, null, pOpts);
    return Math.max(CakeShapes.radiusAt(prof, y), CakeShapes.radiusAt(prof, y + w), CakeShapes.radiusAt(prof, y + w * 0.5));
  }
  function makeRibbonMaterial(cfg, rt) {
    var hex = PALETTES.ribbon[clampIndex(rt.c, PALETTES.ribbon)].hex;
    return window.CakeFrosting ? CakeFrosting.ribbonMaterial(hex, cfg.rm)
                               : new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, side: THREE.DoubleSide });
  }
  function syncCandleMode() {
    var numbers = draft.cm === 1;
    Array.prototype.forEach.call($('candle-mode').children, function (b) { b.classList.toggle('on', +b.getAttribute('data-cm') === draft.cm); });
    function show(id, on) { var el = $(id); el.hidden = !on; el.style.display = on ? '' : 'none'; }   // not relying on CSS for this
    show('count-row', !numbers); show('age-row', numbers);
    show('count-hint', !numbers && draft.n >= BUILDER_MAX_CANDLES);
    var ag = $('f-age'); if (document.activeElement !== ag) ag.value = String(draft.age);
    syncMessageNudge();
  }
  // A gentle suggestion only: the message box's placeholder offers "Happy 60th!" — never its text.
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function syncMessageNudge() {
    var m = els && els.m; if (!m) return;
    m.placeholder = draft.cm === 1 ? 'Happy ' + ordinal(draft.age) + '!' : 'Happy birthday!';
  }
  function serializeRibbons(rt) {
    return rt.map(function (t) { return (t.on ? '1' : '0') + String(t.c % 10) + String(t.w % 10); }).join('');
  }
  // The SPONGE is the object: the shape sliders size it, the fillings sit inside it, the grooves
  // are in it. Frosting is a layer ON the sponge. Smooth frosting is a shell of real thickness
  // (FROST_T on the sides, FROST_TOP on top) so a frosted tier is fractionally bigger than the
  // same sponge naked; semi-naked is a scrape of no thickness, so it IS the sponge's geometry.
  // Layers on the sponge, outermost last: frosting (buttercream, spread on) then fondant (a
  // rolled sheet draped over). Only fondant has thickness for now; a semi-naked scrape has none.
  var FROST_T = 0.12;            // fondant: side thickness
  var FROST_TOP = 0.15;          // fondant: extra height on top
  var FONDANT_BASE_FILLET = 0.05; // fondant is trimmed at the board: half the top rim's roundness
  var FILL_T = 0.16;             // filling thickness, world units — the same whatever the layer count (v0.71: was 0.09)
  var NAKED_CAP_H = 0.12;        // a naked tier's top disc is thin, so no filling hides inside it
  function capHeightFor(cfg, i) { return frostingHasThickness(cfg, i) ? CAP_H : NAKED_CAP_H; }
  // Where the fillings sit in a tier, bottom→top, in world units. Sponge layers are equal;
  // the top layer runs up into the cap.
  function layerScheme(tierH, spongeLayers) {
    var n = Math.max(1, Math.min(4, spongeLayers | 0)), fills = [];
    var spongeT = (tierH - (n - 1) * FILL_T) / n;
    for (var i = 1; i < n; i++) { var y0 = i * spongeT + (i - 1) * FILL_T; fills.push([y0, y0 + FILL_T]); }
    return { n: n, spongeT: spongeT, fillT: FILL_T, fills: fills, h: tierH };
  }
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
    // The cake itself (v0.74). Index 0 is the original vanilla so older links are unchanged.
    sponge: [
      { name: 'Vanilla',     hex: 0xE9C07A },
      { name: 'Chocolate',   hex: 0x6E4630 },
      { name: 'Red velvet',  hex: 0xA8403F },
      { name: 'Lemon',       hex: 0xF0D275 },
      { name: 'Matcha',      hex: 0xAABD74 },
      { name: 'Carrot',      hex: 0xC8894C },
      { name: 'Strawberry',  hex: 0xE9A7AE }
    ],
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

  var SPONGE_DEFAULT = 0xE9C07A;
  var SPONGE = SPONGE_DEFAULT;   // the sponge's CRUST (outside) colour for the cake being built — set at the top of build()
  var SPONGE_CRUMB = 0xFBE3A1;   // the sponge's CRUMB (inside) colour
  // Bakes (v0.79): crumb and crust as a pair. These are the vanilla hexes; any other sponge
  // flavour takes the same browning — its colour is scaled per channel by the bake's ratio to
  // the vanilla base — so chocolate gets a dark crust and a lighter crumb in the same spirit.
  // The sponges (v0.80): one curated list, each a crumb + crust pair in baked-in tones — muted, a
  // little brown, the crust always browner than the crumb — so none of them reads as icing.
  // `crumb` picks the crumb texture's flavour detail (frosting.js).
  var SPONGES = [
    { name: 'Classic vanilla', crumb: 0xFBE3A1, crust: 0xD8883A, detail: 'plain' },
    { name: 'Honey sponge',    crumb: 0xF6D588, crust: 0xBF6A27, detail: 'plain' },
    { name: 'Butter sponge',   crumb: 0xFFEDB8, crust: 0xE6A24E, detail: 'plain' },
    { name: 'Lemon',           crumb: 0xFAE59A, crust: 0xD9963E, detail: 'lemon' },
    { name: 'Chocolate',       crumb: 0x7B5238, crust: 0x4B2E1E, detail: 'tight' },
    { name: 'Coffee',          crumb: 0xC0936A, crust: 0x8A5634, detail: 'plain' },
    { name: 'Red velvet',      crumb: 0x9C3F36, crust: 0x6A2A25, detail: 'velvet' },
    { name: 'Carrot',          crumb: 0xD6A873, crust: 0x9A5F31, detail: 'carrot' },
    { name: 'Matcha',          crumb: 0xB9B97C, crust: 0x8E7E4A, detail: 'plain' }
  ];
  // Links from before v0.80 stored a flavour (sc) and a bake (bk); map them onto the list.
  var SC_TO_SP = [0, 4, 6, 3, 8, 7, 2];               // vanilla, chocolate, red velvet, lemon, matcha, carrot, strawberry → butter
  function spongeOf(cfg) { return SPONGES[clampIndex(cfg.sp, SPONGES)]; }
  function spongeColours(cfg) { var S = spongeOf(cfg); return { crust: S.crust, crumb: S.crumb }; }
  var INK_DARK = '#3b2a2a';
  var INK_LIGHT = '#fffaf0';
  var TIERS = {
    1: [ { r: 2.2, h: 1.6 } ],                                                  // bottom tier first
    2: [ { r: 2.5, h: 1.5 }, { r: 1.45, h: 1.3 } ],
    3: [ { r: 2.7, h: 1.4 }, { r: 1.95, h: 1.2 }, { r: 1.2, h: 1.0 } ]
  };
  var CAP_H = 0.32;
  // Tier proportions are the sender's (v0.60): per tier a width step and a height step, each
  // 0–9. Missing → the classic table above, so older links are untouched. Radius runs 0.9–2.7,
  // height 0.6–2.0. An upper tier can never be wider than the one below it minus a ledge.
  var SHAPE = { rMin: 0.9, rMax: 2.7, hMin: 0.6, hMax: 2.0, steps: 10, ledge: 0 };   // ledge 0: a tier may be exactly as wide as the one below
  function stepToR(st) { return SHAPE.rMin + (SHAPE.rMax - SHAPE.rMin) * clampInt(st, 0, SHAPE.steps - 1, 0) / (SHAPE.steps - 1); }
  function stepToH(st) { return SHAPE.hMin + (SHAPE.hMax - SHAPE.hMin) * clampInt(st, 0, SHAPE.steps - 1, 0) / (SHAPE.steps - 1); }
  function rToStep(r) { return Math.round((r - SHAPE.rMin) / (SHAPE.rMax - SHAPE.rMin) * (SHAPE.steps - 1)); }
  function hToStep(h) { return Math.round((h - SHAPE.hMin) / (SHAPE.hMax - SHAPE.hMin) * (SHAPE.steps - 1)); }
  // The classic proportions as steps, per tier count — what a fresh draft starts with.
  function classicShape(t) { return (TIERS[t] || TIERS[1]).map(function (x) { return { r: rToStep(x.r), h: hToStep(x.h) }; }); }
  // Enforce the stack: each tier's radius ≤ the tier below minus the ledge (in steps).
  function constrainShape(sh) {
    for (var i = 1; i < sh.length; i++) {
      var maxR = stepToR(sh[i - 1].r) - SHAPE.ledge;
      if (stepToR(sh[i].r) > maxR) sh[i].r = Math.max(0, Math.floor(rToStep(maxR)));
    }
    return sh;
  }
  function parseShape(str, t) {
    var clean = String(str || '').replace(/[^0-9]/g, ''), n = (TIERS[t] || TIERS[1]).length, out = [];
    if (clean.length < n * 2) return classicShape(t);
    for (var i = 0; i < n; i++) out.push({ r: clampInt(+clean[i * 2], 0, 9, 0), h: clampInt(+clean[i * 2 + 1], 0, 9, 0) });
    return constrainShape(out);
  }
  function serializeShape(sh) { return sh.map(function (x) { return String(x.r) + String(x.h); }).join(''); }
  // THE tier list for a cake: radii and heights from the sender's shape. Everything that used
  // to read TIERS[cfg.t] reads this.
  // OUTER tier dimensions (what the camera, box, candles, cut and ribbon see), plus the sponge's
  // own dimensions (rs, hs). Frosting that has thickness makes the outer bigger than the sponge.
  // Per TIER: fondant on this tier (smooth buttercream will count too when it exists).
  function frostingHasThickness(cfg, i) { return !!cfg && !!(cfg.fds ? cfg.fds[i | 0] : cfg.fd); }
  function tiersFor(cfg) {
    var sh = (cfg && cfg.sh && cfg.sh.length) ? cfg.sh : classicShape(cfg ? cfg.t : 1);
    return sh.map(function (x, i) {
      var rs = stepToR(x.r), hs = stepToH(x.h), thick = frostingHasThickness(cfg, i);
      return { r: rs + (thick ? FROST_T : 0), h: hs + (thick ? FROST_TOP : 0), rs: rs, hs: hs };
    });
  }
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
    var out = {
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
      ly: clampInt(c.ly, 1, 4, 3),          // sponge layers (fillings = ly − 1); 1 = just cake, no fillings
      fr: clampInt(c.fr, 0, 5, 1),          // frosting (buttercream): 0 none · 4 semi-naked · 3 rustic / 5 smooth reserved · 1 = legacy shell (also what a very old link means)
      rb: clampInt(c.rb, 0, 2, 2),          // ribbon (legacy summary): 0 none, 1 all tiers, 2 upper-only
      rbt: String(c.rbt || '').replace(/[^0-9]/g, '').slice(0, 9),  // per-tier ribbons (v0.58); wins when present
      tp: String(c.tp || '').replace(/[^0-9]/g, '').slice(0, 6),    // tier proportions (v0.60): width/height steps per tier
      fct: String(c.fct || '').replace(/[^0-9]/g, '').slice(0, 3),  // FONDANT colour per tier (was the shell's colour); wins when present
      fd: clampInt(c.fd, 0, 1, -1),         // fondant on/off (v0.67); -1 = missing, resolved below from the legacy fr
      frt: String(c.frt || '').replace(/[^0-9]/g, '').slice(0, 3),  // frosting (buttercream) colour per tier (v0.67)
      frst: String(c.frst || '').replace(/[^0-9]/g, '').slice(0, 3), // frosting STYLE per tier (v0.68); missing → fr on every tier
      fdt: String(c.fdt || '').replace(/[^0-9]/g, '').slice(0, 3),  // fondant on/off per tier (v0.68); missing → fd on every tier
      sc: clampInt(c.sc, 0, 6, 0),          // sponge colour (v0.74); missing → vanilla
      bk: clampInt(c.bk, 0, 2, 0),          // bake (v0.79) — legacy; see sp
      rm: clampInt(c.rm, 0, 1, 0),          // ribbon material (v0.84): 0 satin · 1 grosgrain
      cm: clampInt(c.cm, 0, 1, 0),          // candle mode (v0.94): 0 candles · 1 number candles
      age: clampInt(c.age, 1, 99, 30),      // the age the number candles spell
      sd: clampInt(c.sd, 0, 999, 0),        // texture seed (v0.83): one number that arranges every pattern on this cake
      sp: (c.sp !== undefined && c.sp !== '' && !isNaN(+c.sp)) ? clampInt(c.sp, 0, 8, 0)
          : ((clampInt(c.sc, 0, 6, 0) === 0) ? clampInt(c.bk, 0, 2, 0) : SC_TO_SP[clampInt(c.sc, 0, 6, 0)]),   // the sponge (v0.80)
      rk: clampInt(c.rk, 0, 2, 0),          // cooling-rack marks on a baked top: 0 none · 1 wires · 2 bars
      ff: (function (f) { return f === 3 ? 2 : f; })(clampInt(c.ff, 0, 11, 0))   // 3 was Low sun (now a light preset) → Rustic; 4 was Coarse → Combed   // fondant finish; 3 was Low sun (now a light preset) → Rustic (v0.75): 0 grain · 1 swept · 2 rustic · 3 rustic, raking light. Missing → grain (flat fondant is retired)
    };
    // A legacy "smooth shell" (fr 1; 2/3 were reserved) IS fondant now: the field changes meaning,
    // the picture doesn't. Reserved buttercream styles fall back to none.
    var legacyShell = (out.fr === 1 || out.fr === 2 || out.fr === 3);
    if (out.fd === -1) out.fd = legacyShell ? 1 : 0;
    if (legacyShell || out.fr === 5) out.fr = 0;
    // Live shape array; derived like rt. An explicit `sh` (UI edits) wins over the string.
    out.sh = (c.sh && c.sh.length === (TIERS[out.t] || TIERS[1]).length)
      ? constrainShape(c.sh.map(function (x) { return { r: clampInt(x.r, 0, 9, 0), h: clampInt(x.h, 0, 9, 0) }; }))
      : parseShape(out.tp, out.t);
    out.tp = serializeShape(out.sh);
    // Frosting colour per tier. Live array `fcs`; string `fct` in the link; `fc` stays as the
    // summary (the bottom tier) for the bow, the bleed and older readers.
    var nT = out.sh.length;
    if (c.fcs && c.fcs.length === nT) out.fcs = c.fcs.map(function (v) { return clampInt(v, 0, PALETTES.frosting.length - 1, 0); });
    else if (out.fct.length >= nT) out.fcs = out.fct.slice(0, nT).split('').map(function (ch) { return clampInt(+ch, 0, PALETTES.frosting.length - 1, 0); });
    else { out.fcs = []; while (out.fcs.length < nT) out.fcs.push(out.fc); }
    out.fct = out.fcs.map(function (v) { return String(v % 10); }).join('');
    // Buttercream colours per tier: live `frs`, link `frt`; missing → the fondant colours.
    if (c.frs && c.frs.length === nT) out.frs = c.frs.map(function (v) { return clampInt(v, 0, PALETTES.frosting.length - 1, 0); });
    else if (out.frt.length >= nT) out.frs = out.frt.slice(0, nT).split('').map(function (ch) { return clampInt(+ch, 0, PALETTES.frosting.length - 1, 0); });
    else out.frs = out.fcs.slice();
    out.frt = out.frs.map(function (v) { return String(v % 10); }).join('');
    // Per-tier style and fondant. Live arrays win (UI edits); else the link strings; else the
    // whole-cake fields, which stay as summaries (bottom tier) for older readers.
    var okStyle = function (v) { v = clampInt(v, 0, 5, 0); return (v === 4) ? 4 : 0; };   // only none / semi-naked are real
    if (c.frsty && c.frsty.length === nT) out.frsty = c.frsty.map(okStyle);
    else if (out.frst.length >= nT) out.frsty = out.frst.slice(0, nT).split('').map(function (ch) { return okStyle(+ch); });
    else { out.frsty = []; while (out.frsty.length < nT) out.frsty.push(okStyle(out.fr)); }
    if (c.fds && c.fds.length === nT) out.fds = c.fds.map(function (v) { return v ? 1 : 0; });
    else if (out.fdt.length >= nT) out.fds = out.fdt.slice(0, nT).split('').map(function (ch) { return ch === '1' ? 1 : 0; });
    else { out.fds = []; while (out.fds.length < nT) out.fds.push(out.fd); }
    out.frst = out.frsty.join(''); out.fdt = out.fds.join('');
    out.fr = out.frsty[0]; out.fd = out.fds[0];
    // `fc` is the OUTERMOST layer's bottom-tier colour (bow, bleed, older readers).
    out.fc = out.fds[0] ? out.fcs[0] : (out.frsty[0] ? out.frs[0] : out.fcs[0]);
    out.rt = c.rt && c.rt.length === 3 ? c.rt.map(function (t) { return { on: !!t.on, c: clampInt(t.c, 0, PALETTES.ribbon.length - 1, 0), w: clampInt(t.w, 0, RIBBON.steps - 1, 4), p: (t.p === undefined ? -1 : clampInt(t.p, -1, 9, -1)), a: (t.a === undefined ? undefined : clampInt(t.a, -4, 4, 0)) }; })
                                       : parseRibbons(out.rbt, out.rb, out.rc);
    out.rbt = serializeRibbons(out.rt);
    // Positions: live `p` wins; else the link string `rbp` (one digit per tier); else −1 (legacy).
    var rbpStr = String(c.rbp || '').replace(/[^0-9]/g, '');
    out.rt.forEach(function (t, i) { if (t.p === undefined || (t.p < 0 && rbpStr.length > i)) t.p = rbpStr.length > i ? +rbpStr[i] : -1; });
    out.rbp = out.rt.every(function (t) { return t.p < 0; }) ? '' : out.rt.map(function (t) { return String(t.p < 0 ? 1 : t.p); }).join('');
    // Angle: 0–8 in the link (4 = level), ±4 steps of tilt in the builder.
    var rbaStr = String(c.rba || '').replace(/[^0-8]/g, '');
    out.rt.forEach(function (t, i) { if (t.a === undefined) t.a = rbaStr.length > i ? +rbaStr[i] - 4 : 0; else t.a = clampInt(t.a, -4, 4, 0); });
    out.rba = out.rt.map(function (t) { return String((t.a || 0) + 4); }).join('');
    // Legacy summary kept in step with the per-tier truth (the bow, older readers).
    var firstOn = out.rt.filter(function (t) { return t.on; })[0];
    out.rb = firstOn ? 1 : 0; if (firstOn) out.rc = firstOn.c;
    return out;
  }
  function encodeConfig(c) {
    c = normalize(c);
    var parts = [c.v, encodeURIComponent(c.to), encodeURIComponent(c.from), encodeURIComponent(c.m),
                 c.n, c.t, c.fc, c.ic, c.cc, c.bg, c.rc, c.tc, c.o, c.lt, c.ly, c.fr, c.rb, c.rbt, c.tp, c.fct, c.fd, c.frt, c.frst, c.fdt, c.sc, c.ff, c.rbp, c.bk, c.rk, c.sp, c.sd, c.rm, c.rba, c.cm, c.age];
    return b64url(parts.join('|'));
  }
  function decodeConfig(code) {
    try {
      var p = unb64url(code).split('|');
      if ((p[0] | 0) < 1) return null;
      var dec = function (s) { try { return decodeURIComponent(s || ''); } catch (e) { return ''; } };
      return normalize({ to: dec(p[1]), from: dec(p[2]), m: dec(p[3]), n: p[4], t: p[5],
                         fc: p[6], ic: p[7], cc: p[8], bg: p[9], rc: p[10], tc: p[11], o: p[12], lt: p[13], ly: p[14], fr: p[15], rb: p[16], rbt: p[17], tp: p[18], fct: p[19], fd: p[20], frt: p[21], frst: p[22], fdt: p[23], sc: p[24], ff: p[25], rbp: p[26], bk: p[27], rk: p[28], sp: p[29], sd: p[30], rm: p[31], rba: p[32], cm: p[33], age: p[34] });
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
  // ---- Screen-space ambient occlusion (v0.92) ----
  // A real effect, not a painted one: after the frame is drawn, the actual geometry on screen is
  // rendered again as depth and normals, and every pixel is darkened by how much nearby geometry
  // crowds it — under the candle holders, in the icing's grooves, beneath the ribbon, where the
  // tiers meet. Computed at half resolution (it's soft by nature) and multiplied onto the frame.
  // Flames, sprites, confetti and anything transparent are left out, so they don't occlude.
  // kernelRadius: how far round a point it looks (world units). maxDistance: how far BEHIND a point
  // something may be and still count — small, or thin things like candles cast dark halos on
  // whatever is far behind them. strength: how much of it to apply.
  // v0.93: full resolution and a much tighter radius. At half resolution, the visible sliver of
  // icing under a holder was only a pixel or two tall — the blur smeared its occlusion outward into
  // a halo. Now the darkening sits where it belongs: under the holder, fading within millimetres.
  var AO = { on: !/[?&]ao=0/.test(location.search), scale: 1.0, kernelRadius: 0.045, minDistance: 0.0003, maxDistance: 0.003, kernelSize: 16, strength: 0.8, pass: null, w: 0, h: 0, mix: null };
  var _aoSize = new THREE.Vector2();
  // The flames: drawn last, into the same depth buffer, so the cake still hides them where it
  // should — but nothing is multiplied onto them afterwards.
  function renderFlames() {
    if (!flames.length) return;
    var ac = renderer.autoClear;
    renderer.autoClear = false;
    camera.layers.set(FLAME_LAYER);
    renderer.render(scene, camera);
    camera.layers.set(0);
    renderer.autoClear = ac;
  }
  function renderAO() {
    if (!AO.on || !THREE.SSAOPass || !THREE.SimplexNoise) return;
    renderer.getDrawingBufferSize(_aoSize);
    var w = Math.max(1, Math.round(_aoSize.x * AO.scale)), h = Math.max(1, Math.round(_aoSize.y * AO.scale));
    if (!AO.pass) {
      AO.pass = new THREE.SSAOPass(scene, camera, w, h);
      // half the samples of the default: it's blurred afterwards anyway, and phones will thank us
      var P0 = AO.pass; P0.kernel = []; P0.kernelSize = AO.kernelSize; P0.generateSampleKernel();
      P0.ssaoMaterial.defines.KERNEL_SIZE = AO.kernelSize; P0.ssaoMaterial.uniforms.kernel.value = P0.kernel; P0.ssaoMaterial.needsUpdate = true;
      // v0.95: 24-bit depth. At 16 bits, depth at our viewing distance was coarser than the
      // occlusion test itself, so flat and curved surfaces occluded themselves in bands — the
      // stripes in the background and the moiré on the cake as the camera moved.
      if (P0.normalRenderTarget.depthTexture) P0.normalRenderTarget.depthTexture.type = THREE.UnsignedIntType;
      AO.w = w; AO.h = h;
    } else if (w !== AO.w || h !== AO.h) { AO.pass.setSize(w, h); AO.w = w; AO.h = h; }
    var P = AO.pass, U = P.ssaoMaterial.uniforms;
    // the camera moves and zooms: keep the pass's copy of it current
    U.cameraNear.value = camera.near; U.cameraFar.value = camera.far;
    U.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
    U.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    P.kernelRadius = AO.kernelRadius; P.minDistance = AO.minDistance; P.maxDistance = AO.maxDistance;
    // depth and normals, without the things that shouldn't occlude
    P.overrideVisibility();
    // Only the cake (and its candles) take part: the backdrop and floor are far away, where the
    // test is least reliable, and there's nothing on them to occlude.
    scene.children.forEach(function (c) { if (c !== cakeGroup && !c.isLight && !c.isCamera) c.visible = false; });
    scene.traverse(function (o) {
      if (o.isSprite || o.isPoints || o.isLine || (o.material && !Array.isArray(o.material) && o.material.transparent) || (o.userData && o.userData.noAO)) o.visible = false;
    });
    P.renderOverride(renderer, P.normalMaterial, P.normalRenderTarget, 0x7777ff, 1.0);
    P.restoreVisibility();
    U.kernelRadius.value = P.kernelRadius; U.minDistance.value = P.minDistance; U.maxDistance.value = P.maxDistance;
    P.renderPass(renderer, P.ssaoMaterial, P.ssaoRenderTarget);
    P.renderPass(renderer, P.blurMaterial, P.blurRenderTarget);
    // multiply the occlusion onto the frame already on screen, at AO.strength
    if (!AO.mix) {
      AO.mix = new THREE.ShaderMaterial({
        uniforms: { tAO: { value: null }, uStrength: { value: AO.strength } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform sampler2D tAO; uniform float uStrength; varying vec2 vUv; void main(){ float a = texture2D(tAO, vUv).r; gl_FragColor = vec4(vec3(mix(1.0, a, uStrength)), 1.0); }',
        blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
        blendSrcAlpha: THREE.DstAlphaFactor, blendDstAlpha: THREE.ZeroFactor, depthTest: false, depthWrite: false
      });
    }
    AO.mix.uniforms.tAO.value = P.blurRenderTarget.texture; AO.mix.uniforms.uStrength.value = AO.strength;
    P.renderPass(renderer, AO.mix, null);
  }
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
    contactShadow.material.opacity = (0.12 + 0.88 * t) * (0.18 + 0.82 * Math.min(1, bgLuminance / THREE.Color.srgbToLinear(0.55))) * discScale;
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
  // A wax candle (v0.90), unit radius and height, centred like the old cylinder so the instance
  // transforms are unchanged: a gently uneven wall, a shoulder that rounds over, a thin raised
  // rim and a shallow melted pool round the wick. UV v runs up the candle (for the glow and the
  // drawing lines), u round it.
  var candleGeo = (function () {
    var p = [new THREE.Vector2(0, -0.5), new THREE.Vector2(0.96, -0.5)];
    for (var i = 0; i <= 16; i++) p.push(new THREE.Vector2(1 + 0.012 * Math.sin(i * 1.3), -0.5 + 0.94 * (i / 16)));
    p.push(new THREE.Vector2(0.985, 0.475), new THREE.Vector2(0.9, 0.5), new THREE.Vector2(0.8, 0.504),
           new THREE.Vector2(0.7, 0.492), new THREE.Vector2(0.35, 0.482), new THREE.Vector2(0, 0.48));
    var g = new THREE.LatheGeometry(p, 24), pos = g.attributes.position, uv = g.attributes.uv;
    for (var j = 0; j < pos.count; j++) uv.setY(j, pos.getY(j) + 0.5);
    uv.needsUpdate = true;
    return g;
  })();
  // How candles stand: in a small white holder — a cup on a spike pushed into the cake, with a
  // couple of millimetres of spike showing below the cup.
  var HOLDER = { gap: 0.05, cupH: 2.0, floor: 0.4, wall: 0.2 };   // cupH/floor/wall in candle radii
  var holderGeos = {};
  function holderGeo(r) {
    var key = r.toFixed(3);
    if (holderGeos[key]) return holderGeos[key];
    var ri = r * 1.02, ro = ri + r * HOLDER.wall, h = r * HOLDER.cupH, gap = HOLDER.gap, p = [];
    p.push(new THREE.Vector2(0, gap), new THREE.Vector2(ro * 0.92, gap), new THREE.Vector2(ro * 0.96, gap + 0.006),
           new THREE.Vector2(ro * 1.03, gap + 0.012), new THREE.Vector2(ro * 0.97, gap + 0.02),     // a ring round the foot
           new THREE.Vector2(ro, gap + h * 0.8), new THREE.Vector2(ro * 1.05, gap + h * 0.95),      // the wall, a rolled lip
           new THREE.Vector2(ro * 1.04, gap + h), new THREE.Vector2(ri, gap + h),
           new THREE.Vector2(ri * 0.98, gap + h * HOLDER.floor * 0.5), new THREE.Vector2(0, gap + h * HOLDER.floor * 0.5));
    var cup = new THREE.LatheGeometry(p, 24);
    var rib = new THREE.BoxGeometry(r * 0.18, h * 0.72, r * 0.12); rib.translate(0, gap + h * 0.52, ro + r * 0.03);   // the moulded rib
    var spike = new THREE.CylinderGeometry(r * 0.32, r * 0.25, gap + 0.02, 12); spike.translate(0, (gap - 0.02) / 2, 0);
    var merged = CakeShapes.merge([cup, rib, spike], function () { return 0; });
    [cup, rib, spike].forEach(function (g) { g.dispose(); });
    merged.clearGroups();
    merged.__shared = true;
    return (holderGeos[key] = merged);
  }
  // Wax: light soaks into it (warm wrap lighting), a soft sheen that's glossier in the melted
  // pool, very fine drawing lines, and the top glowing from within while the flame is lit —
  // per candle, through an instance attribute, so blowing one out puts out its glow.
  var waxMaps = null;
  function makeWaxMaps() {
    if (waxMaps) return waxMaps;
    function tex(W, H, fn, srgb) {
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d'), im = g.createImageData(W, H);
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var v = fn(x / W, 1 - y / H, x, y), i = (y * W + x) * 4; im.data[i] = v[0] * 255; im.data[i + 1] = v[1] * 255; im.data[i + 2] = v[2] * 255; im.data[i + 3] = 255; }
      g.putImageData(im, 0, 0);
      var t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; if (srgb) t.encoding = THREE.sRGBEncoding; t.__shared = true; return t;
    }
    var WW = 128, WH = 256, h = new Float32Array(WW * WH);
    for (var y = 0; y < WH; y++) for (var x = 0; x < WW; x++) {
      var u = x / WW, v = 1 - y / WH;
      h[y * WW + x] = 0.5 + 0.05 * Math.sin(u * Math.PI * 2 * 34 + 3 * Math.sin(u * 6.28 * 3 + v * 4)) + 0.04 * Math.sin(u * 6.28 * 11 + v * 9.1);
    }
    waxMaps = {
      n: tex(WW, WH, function (u, v, x, y) {
        var xl = (x - 1 + WW) % WW, xr = (x + 1) % WW, yu = Math.max(0, y - 1), yd = Math.min(WH - 1, y + 1);
        var dx = (h[y * WW + xr] - h[y * WW + xl]) * 1.6, dy = (h[yd * WW + x] - h[yu * WW + x]) * 1.6, nx = -dx, ny = dy, l = Math.sqrt(nx * nx + ny * ny + 1);
        return [nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, 1 / l * 0.5 + 0.5];
      }, false),
      r: tex(4, WH, function (u, v) { var q = v > 0.965 ? 0.12 : 0.42; return [q, q, q]; }, false),
      glow: tex(4, WH, function (u, v) { var q = Math.pow(Math.max(0, (v - 0.55) / 0.45), 2.2); return [q, q * 0.82, q * 0.55]; }, true)
    };
    return waxMaps;
  }
  function makeWaxMaterial(hex) {
    var W = makeWaxMaps();
    var m = new THREE.MeshStandardMaterial({ color: hex, roughness: 1, roughnessMap: W.r, normalMap: W.n,
      emissive: new THREE.Color(1, 0.7, 0.4), emissiveMap: W.glow, emissiveIntensity: 1.1 });
    m.normalScale = new THREE.Vector2(0.3, 0.3);
    if (window.CakeFrosting) CakeFrosting.wrapLighting(m, 0.75, new THREE.Color(1, 0.82, 0.6));
    var wrapCompile = m.onBeforeCompile;
    m.onBeforeCompile = function (sh) {
      if (wrapCompile) wrapCompile(sh);
      sh.vertexShader = 'attribute float aLit;\nvarying float vLit;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLit = aLit;');
      sh.fragmentShader = 'varying float vLit;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vLit;');
    };
    m.customProgramCacheKey = function () { return 'cake-candle-wax-1'; };
    return m;
  }
  var holderMat = new THREE.MeshStandardMaterial({ color: 0xFBFAF7, roughness: 0.34 });
  if (window.CakeFrosting) {
    CakeFrosting.wrapLighting(holderMat, 0.5, new THREE.Color(1, 0.95, 0.9));    // plastic that light soaks into a little
    holderMat.customProgramCacheKey = function () { return 'cake-candle-holder-1'; };
  }
  holderMat.__shared = true;
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

  var lastBgKey = '';
  var messageMesh = null;   // body mesh of the tier carrying the message (for cheap message-only updates)
  var showMessage = true;

  var tierGroups = [];
  var spawn = null;          // candle pop-in animation state

  function build(cfg, opts) {
    markHeavy();
    cfg = normalize(cfg);                                // derived arrays (rt, sh) must match the tier count; always normalise
    var SC = spongeColours(cfg); SPONGE = SC.crust; SPONGE_CRUMB = SC.crumb;   // every painter and material below reads these
    if (window.CakeFrosting) CakeFrosting.setSeed(cfg.sd);   // …and every texture and the baked wobble read this
    var keepMessageMap = (opts && opts.keepMessage && messageMesh && messageMesh.material[0] && messageMesh.material[0].map) ? messageMesh.material[0].map : null;
    if (keepMessageMap) keepMessageMap.__shared = true;   // survives the clear below
    built.visible = true;
    var prevN = config ? (config.n | 0) : 0;            // only NEW candles pop in — a tier switch doesn't re-pop them
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

    var tiers = tiersFor(cfg);
    var frosting = PALETTES.frosting[clampIndex(cfg.fc, PALETTES.frosting)].hex;
    var filling = PALETTES.filling[clampIndex(cfg.ic, PALETTES.filling)].layers;
    var candleHex = PALETTES.candle[clampIndex(cfg.cc, PALETTES.candle)].hex;
    var ribbonHex = PALETTES.ribbon[clampIndex(cfg.rc, PALETTES.ribbon)].hex;
    var ink = pickInk(frosting, cfg.tc);

    // Frosting is a choice (v0.54). Naked: the sponge itself, slightly smaller, wearing its
    // filling stripes round the side and a thin crumb top. Frosted: the one-shell frosting.
    // Materials come per tier from tierMaterials(), the same function the cut and the slice use.
    var localShared = [];

    var y = PLATE_TOP;
    var surfaces = [];            // where candles may stand
    var messageTier = tiers[0];   // message goes on the biggest tier's side

    tiers.forEach(function (tier, i) {
      var isTop = (i === tiers.length - 1);
      tier.idx = i;
      var TM = tierMaterials(cfg, tier);
      var frosting = TM.frosting;                         // this tier's own colour
      var ink = pickInk(frosting, cfg.tc);
      var frostingMat = TM.side, capMat = TM.cap, msgBase = TM.base, scheme = TM.scheme, capH = TM.capH, pOpts = TM.profileOpts;
      if (frostingMat) { frostingMat.__shared = true; localShared.push(frostingMat); }
      capMat.__shared = true; localShared.push(capMat);
      var bodyH = TM.bodyH, rr = TM.rr;
      var open = cfg.cutaway ? Math.PI / 4 : 0;          // dev wedge removed
      var tg = new THREE.Group();                        // this tier's meshes, so it can drop in
      built.add(tg);
      tierGroups.push(tg);

      // Body: frosted all round; sponge only shows on cut faces.
      var sideMat = frostingMat;
      if (tier === messageTier && cfg.m && showMessage) {
        // Frosting colour is baked into the canvas so light ink stays light on dark cakes.
        // During a slider drag (opts.keepMessage) the previous band texture is kept and only
        // redrawn on release: the text scales a hair with the tier for a moment, and the tab
        // doesn't churn a 16MB canvas per frame.
        var keptMap = (opts && opts.keepMessage && keepMessageMap) ? keepMessageMap : null;
        sideMat = new THREE.MeshStandardMaterial({
          color: 0xffffff, roughness: TM.naked ? 0.95 : ((!TM.fdOn && TM.style === 4) ? 0.85 : 0.62),
          map: keptMap || makeMessageTexture(cfg.m, ink, frosting, rr, TM.fdOn ? bodyH : tier.hs, msgBase), vertexColors: true
        });
        if (keptMap) keptMap.__shared = true;                 // don't let clearGroup dispose what we're reusing
        if (TM.maps) CakeFrosting.dressFondant(sideMat, TM.maps, rr);   // the writing sits on the finished fondant
        else if (!TM.fdOn && window.CakeFrosting) { var bm = CakeFrosting.spongeMaps(cfg.rk); bm.noAlbedo = true; CakeFrosting.dressFondant(sideMat, bm, tier.rs); }   // …or on the baked crust
        nightGlow(sideMat, 0xffffff, true);
      }
      var body;
      if (!TM.fdOn) {
        // The sponge itself: a stack of real layer solids (buildStack). The side material
        // (layers texture, scrape or message band) wraps the whole stack in tier space.
        body = buildStack(cfg, tier, TM, sideMat, 0, Math.PI * 2, CYL_SEG, false);
        body.position.y = y;
        tg.add(body);
        if (tier === messageTier) { messageMesh = body; body.__tier = tier; body.__bodyH = tier.hs; body.__stack = true; }
      } else {
        // Fondant: the shell is what's seen; the stack inside it is built only when cut.
        // ONE continuous surface — wall, shoulder and top — so there's no lid (v0.77).
        var above = tiers[i + 1];                 // the tier sitting on this one, if any
        var aboveTM = above ? above.r : undefined;             // outer radius, per tier (tiersFor folds thickness in)
        var bodyGeo = CakeShapes.shell(rr, bodyH, capH, CYL_SEG, open, Math.PI * 2 - open, aboveTM, pOpts);
        CakeFrosting.angleUV(bodyGeo, open, Math.PI * 2 - open);          // the message band's u = true angle
        if (TM.maps) CakeFrosting.displaceRim(bodyGeo, rr, bodyH + capH * 0.35, capH, TM.maps.displace);
        body = new THREE.Mesh(bodyGeo, [sideMat, capMat]);
        body.position.y = y;
        tg.add(body);
        if (tier === messageTier) { messageMesh = body; body.__tier = tier; body.__bodyH = bodyH; }
      }
      // (The old torus "drip band" at the cap/body seam is gone: the cap's underside lip
      // and the sponge's top tuck now meet properly, so there's no seam to hide.)

      // Cut faces (dev cut-away): two planes showing sponge + filling layers
      if (cfg.cutaway) {
        var faceMat = TM.face();
        faceMat.__shared = true; localShared.push(faceMat);
        [0, open].forEach(function (theta) {
          var face = new THREE.Mesh(CakeShapes.cutFace(rr, bodyH, capH, scheme, pOpts), faceMat);
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

      // Ribbon: per tier — on/off, colour and width of its own. A strip lying on the cake:
      // inner face at the cake's radius, a hair thick, closed top and bottom so the edge catches light.
      var rt = cfg.rt[i];
      if (rt && rt.on) {
        var rw = ribbonWidth(rt.w);
        // Hugs the fondant's surface, or bridges a naked stack's fillings taut (no tucking in).
        var rbY = ribbonY(TM, tier, rw, rt.p), hand = ribbonHandFor(cfg, tier, TM, rw, rt);
        var rbR = ribbonRadius(TM, rr, bodyH, pOpts, rbY, rw);
        var rbGeo = CakeShapes.ribbon(rbR, rbY, rw, CYL_SEG, 0, Math.PI * 2, hand);
        if (!TM.fdOn && window.CakeFrosting) CakeFrosting.spongeWobble(rbGeo, rr, 1e3, SPONGE_WOBBLE);   // follows the baked wall's wobble, still bridging the fillings
        var ribbon = new THREE.Mesh(rbGeo, makeRibbonMaterial(cfg, rt));
        ribbon.position.y = y;
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
    if (cfg.cm === 1) placeNumberCandles(String(cfg.age), surfaces[0], candleHex);
    else placeCandles(Math.max(0, Math.min(MAX_CANDLES, cfg.n | 0)), surfaces, candleHex, candleFrom);

    // (A "top tier drops in" animation used to live here. It had been dead since the builder
    // began mutating its config in place, came back to life when v0.60 made the tier switch
    // produce a fresh config, and was unwanted. Removed for good.)

    // Materials created for this build are "shared" only until the next build.
    localShared.forEach(function (m) { m.__shared = false; });
    if (keepMessageMap) keepMessageMap.__shared = false;

    fitShadow(tiersFor(cfg)[0].r);
    rebuildLandings(cfg);
    if (window.CakeLook) CakeLook.adopt(built);
    FRAME.cake = cakeFrame(cfg);
    if (!boxMode) { frameTarget = FRAME.cake; camTargetY = centreOfMass(cfg); }
    candleLight.position.set(0, y + 0.9, 0);
    candleLight.intensity = window.CakeLook ? CakeLook.candleIntensity(flames.length, darkness) : Math.min(1.6, 0.25 + flames.length * 0.03);

    if (lastBgKey !== frosting + '|' + cfg.bg) { lastBgKey = frosting + '|' + cfg.bg; applyBackground(frosting, cfg.bg); }
  }

  // Cheap path for typing: swap only the message texture.
  function updateMessage(m) {
    config.m = m;
    if (!messageMesh) { build(config); return; }
    // On a stack (naked / semi-naked) the wall materials are assigned per solid at build time —
    // the writing must span sponge AND fillings — so a message change rebuilds the tier.
    if (messageMesh.__stack) { build(config); return; }
    var tier = messageMesh.__tier, bodyH = messageMesh.__bodyH;
    var frosting = PALETTES.frosting[clampIndex(config.fc, PALETTES.frosting)].hex;
    var old = messageMesh.material[0];
    var mat;
    if (m && showMessage) {
      var TMm = tierMaterials(config, tier);              // the message tier's own layers
      frosting = TMm.frosting;                             // its OUTERMOST layer colour
      mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: TMm.naked ? 0.95 : ((!TMm.fdOn && TMm.style === 4) ? 0.85 : 0.62),
        map: makeMessageTexture(m, pickInk(frosting, config.tc), frosting, TMm.rr, bodyH, TMm.base), vertexColors: true
      });
      if (TMm.maps) CakeFrosting.dressFondant(mat, TMm.maps, TMm.rr);
      nightGlow(mat, 0xffffff, true);
    } else {
      mat = messageMesh.__plainWall || messageMesh.material[1];   // the tier's plain wall
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

  // ---- Number candles (v0.94) ----
  // Each digit is Fredoka's own outline, extruded ~1.2cm thick with a soft rounded bevel, in the
  // same wax as the candles. The wick sits at the digit's highest point; one spike under the
  // middle of its foot holds it a few millimetres off the icing. Built once per digit and height.
  var NUM = { height: 1.3, depth: 0.24, bevel: 0.045, gap: 0.05, spacing: 0.08, glow: 0.55 };
  var digitCache = {};
  function digitGeometry(ch, H) {
    var key = ch + '@' + H.toFixed(3);
    if (digitCache[key]) return digitCache[key];
    var G = window.CakeDigits && CakeDigits.glyphs[ch];
    if (!G) return null;
    var sp = new THREE.ShapePath();
    G.c.forEach(function (c) {
      if (c[0] === 'M') sp.moveTo(c[1], c[2]);
      else if (c[0] === 'L') sp.lineTo(c[1], c[2]);
      else if (c[0] === 'Q') sp.quadraticCurveTo(c[1], c[2], c[3], c[4]);
      else if (c[0] === 'C') sp.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
    });
    // Holes (the 0, 4, 6, 8, 9): take whichever winding gives the counters as holes.
    var a = sp.toShapes(false), b = sp.toShapes(true);
    function holes(list) { return list.reduce(function (n, x) { return n + x.holes.length; }, 0); }
    var shapes = holes(a) >= holes(b) ? a : b;
    var s = H / (G.b[3] - G.b[1]), bev = NUM.bevel;
    var geo = new THREE.ExtrudeGeometry(shapes, { depth: (NUM.depth - 2 * bev) / s, curveSegments: 12, bevelEnabled: true,
      bevelThickness: bev / s, bevelSize: bev / s * 0.9, bevelSegments: 5 });
    geo.scale(s, s, s);
    geo.computeBoundingBox();
    var bb = geo.boundingBox;
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    geo.computeBoundingBox(); bb = geo.boundingBox;
    var pos = geo.attributes.position, uv = geo.attributes.uv, top = { x: 0, y: -1e9 }, lows = [];
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i);
      uv.setXY(i, 0.5, (y - bb.min.y) / (bb.max.y - bb.min.y));   // v runs up the digit, for the glow
      if (y > top.y) top = { x: x, y: y };
      if (y < bb.min.y + 0.03) lows.push(x);
    }
    uv.needsUpdate = true;
    geo.computeVertexNormals();
    geo.setAttribute('aLit', new THREE.Float32BufferAttribute(new Float32Array(pos.count).fill(1), 1));   // the wax shader's per-candle glow switch; per digit it's driven by the material instead
    geo.__shared = true;
    return (digitCache[key] = { geo: geo, width: bb.max.x - bb.min.x, top: top,
      foot: lows.length ? lows.reduce(function (p, q) { return p + q; }, 0) / lows.length : 0 });
  }
  function placeNumberCandles(age, surface, candleHex) {
    if (!surface || !window.CakeDigits) return;
    var chars = age.replace(/[^0-9]/g, '').slice(0, 2).split('');
    if (!chars.length) return;
    var H = NUM.height * Math.max(0.7, Math.min(1, surface.rMax / 1.95));   // smaller on a smaller top tier
    var parts = chars.map(function (ch) { return digitGeometry(ch, H); }).filter(Boolean);
    var total = parts.reduce(function (w, p) { return w + p.width; }, 0) + NUM.spacing * (parts.length - 1);
    var x = -total / 2, fs = 0.28;
    parts.forEach(function (P, i) {
      var sd = window.CakeFrosting ? CakeFrosting.seedOf() : 0;
      function h(k) { var n = Math.sin((i + 3) * 127.1 + k * 311.7 + sd * 74.7) * 43758.5453; return n - Math.floor(n); }
      var cx = x + P.width / 2; x += P.width + NUM.spacing;
      var grp = new THREE.Group();
      grp.position.set(cx, surface.y + NUM.gap, (h(1) - 0.5) * 0.08);
      grp.rotation.set((h(2) - 0.5) * 0.06, (h(3) - 0.5) * 0.12, (h(4) - 0.5) * 0.05);   // placed by hand
      var mat = makeWaxMaterial(candleHex);
      mat.emissiveIntensity = 1.1 * NUM.glow;            // thick wax: a gentler glow than the thin candles'
      grp.add(new THREE.Mesh(P.geo, mat));
      var spike = new THREE.Mesh(numberSpikeGeo, holderMat);
      spike.position.set(P.foot, -(NUM.gap + 0.06) / 2 + 0.01, 0);
      grp.add(spike);
      var wick = new THREE.Mesh(wickGeo, wickMat);
      wick.position.set(P.top.x, P.top.y + 0.02, 0);
      grp.add(wick);
      built.add(grp);
      grp.updateMatrixWorld(true);
      var fp = new THREE.Vector3(P.top.x, P.top.y + 0.18, 0).applyMatrix4(grp.matrix);
      var flame = new THREE.Sprite(flameMat.clone());
      flame.material.__shared = false; flame.material.visible = false;
      flame.scale.set(fs * 0.7, fs, 1);
      flame.position.copy(fp);
      built.add(flame);
      var halo = null;
      if (false) {                                         // flat halos retired (v0.96)
        halo = new THREE.Sprite(CakeLook.haloMaterial());
        halo.scale.set(fs * CakeLook.LOOK.halo.scale, fs * CakeLook.LOOK.halo.scale, 1);
        halo.position.copy(fp); halo.renderOrder = -1; built.add(halo);
      }
      wicks.push(wick);
      var fm = makeFlameMesh(i * 2.3 + 0.9); built.add(fm);
      flames.push({ sprite: flame, halo: halo, base: fs, phase: ((i * 0.618) % 1) * Math.PI * 2, x: fp.x, z: fp.z,
                    k: 1, lit: 1, y: fp.y, leanX: 0, leanZ: 0, mat: mat, glowBase: mat.emissiveIntensity, mesh: fm, root: 0.15 });
    });
  }
  var numberSpikeGeo = new THREE.CylinderGeometry(0.03, 0.02, NUM.gap + 0.06, 12);
  numberSpikeGeo.__shared = true;
  // ---- Flames (v0.96) ----
  // A flame is a small 3D teardrop with its own shader, not a flat picture: widest a third of the
  // way up, tapering to a fine tip. It glows from the inside — brightest where you look through
  // the most flame, fading to nothing at its edges — with a blue root at the wick, a dimmer cone
  // round the wick, a white-gold heart, and orange edges and tip. The vertex shader sways it
  // (more at the tip than the root) and stretches its tip on several unrelated rhythms, each
  // flame on its own phase. A faint larger copy is its halo; a tiny ember marks the wick's tip.
  // The old sprite stays as an invisible anchor, so blowing out, smoke and the rest are unchanged.
  var FLAME_VS = [
    'uniform float uTime; uniform float uPhase; varying float vH; varying vec3 vN; varying vec3 vV;',
    'void main(){',
    '  vec3 p = position; float h = clamp(p.y / 0.30, 0.0, 1.0); vH = h;',
    '  float t = uTime + uPhase;',
    '  float sway = 0.55 * sin(t * 1.7) + 0.30 * sin(t * 3.9 + 1.3) + 0.15 * sin(t * 7.3 + 2.1);',
    '  float sway2 = 0.5 * sin(t * 2.3 + 0.7) + 0.35 * sin(t * 5.1 + 2.2);',
    '  float stretch = 1.0 + 0.10 * sin(t * 9.1) + 0.06 * sin(t * 15.7 + 1.1) + 0.04 * sin(t * 23.3 + 0.4);',
    '  p.y *= stretch;',
    '  p.x += 0.018 * sway * h * h; p.z += 0.012 * sway2 * h * h;',
    '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    '  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '}'].join('\n');
  var FLAME_FS = [
    'uniform float uGlow; uniform float uCover; varying float vH; varying vec3 vN; varying vec3 vV;',
    'void main(){',
    '  float f = abs(dot(normalize(vN), normalize(vV)));',
    '  float core = pow(f, 2.2), edge = pow(f, 0.8);',
    '  vec3 white = vec3(1.0, 0.95, 0.80), yellow = vec3(1.0, 0.76, 0.30), orange = vec3(1.0, 0.45, 0.12), blue = vec3(0.25, 0.35, 1.0);',
    '  vec3 c = mix(orange, yellow, edge);',
    '  c = mix(c, white, core * smoothstep(0.1, 0.35, vH) * (1.0 - smoothstep(0.55, 0.95, vH)));',
    '  float root = 1.0 - smoothstep(0.0, 0.14, vH);',
    '  c = mix(c, blue, root * 0.8);',
    '  float cone = (1.0 - smoothstep(0.08, 0.3, vH)) * core;',
    '  c *= 1.0 - 0.45 * cone;',
    '  float a = edge * (0.35 + 0.65 * smoothstep(0.0, 0.2, vH)) * (1.0 - 0.55 * root) * (1.0 - smoothstep(0.85, 1.0, vH) * 0.6);',
    '  gl_FragColor = vec4(c * a * uGlow, a * uCover);',
    '}'].join('\n');
  var FLAME = { glow: 0.95, haloGlow: 0.1, cover: 0.55, lean: 0.6 };
  var FLAME_LAYER = 1;   // cover: how much the heart hides what's behind it   // heart toned down: daylight flames read gold, not white
  var flameGeo = (function () {
    var p = [];
    for (var i = 0; i <= 24; i++) { var t = i / 24, r = 0.042 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.9) * Math.pow(1 - t, 0.25); p.push(new THREE.Vector2(Math.max(r, 0.0005), t * 0.30)); }
    var g = new THREE.LatheGeometry(p, 20); g.__shared = true; return g;
  })();
  var emberGeo = new THREE.SphereGeometry(0.009, 8, 6); emberGeo.__shared = true;
  var emberMat = new THREE.MeshBasicMaterial({ color: 0xFF7A2A }); emberMat.__shared = true;
  function flameMaterial(phase, glow, cover) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPhase: { value: phase }, uGlow: { value: glow }, uCover: { value: cover || 0 } },
      vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor   // premultiplied: cover 0 = purely additive
    });
  }
  function makeFlameMesh(phase) {
    var g = new THREE.Group();
    var core = new THREE.Mesh(flameGeo, flameMaterial(phase, FLAME.glow, FLAME.cover));
    var halo = new THREE.Mesh(flameGeo, flameMaterial(phase, FLAME.haloGlow));
    halo.scale.set(1.9, 1.25, 1.9); halo.position.y = -0.025;
    var ember = new THREE.Mesh(emberGeo, emberMat); ember.position.set(0.006, -0.018, 0); ember.userData.noAO = true;
    core.renderOrder = halo.renderOrder = 2;
    // v0.97: flames live on layer 1 and are drawn after the ambient occlusion, which otherwise
    // multiplied onto them — at some angles the surfaces behind a flame were occluded (the
    // candle's top, the wick) and the flame was darkened almost to nothing.
    core.layers.set(FLAME_LAYER); halo.layers.set(FLAME_LAYER); ember.layers.set(FLAME_LAYER);
    g.add(halo); g.add(core); g.add(ember);
    g.userData.noAO = true;
    g.__mats = [core.material, halo.material];
    return g;
  }
  var _leanAxis = new THREE.Vector3(), _up3 = new THREE.Vector3(0, 1, 0);
  function updateFlameMesh(f, t, lx, lz) {
    var g = f.mesh; if (!g) return;
    g.visible = f.sprite.visible;
    if (!g.visible) return;
    var sz = (f.base / 0.28) * f.k * Math.max(0.05, f.lit);
    g.scale.setScalar(sz);
    g.position.set(f.x, f.y - f.root, f.z);
    // lean with the cake's spin, pivoting at the wick
    var dx = _right.x * lx + _fwd.x * lz, dz = _right.z * lx + _fwd.z * lz, amt = Math.sqrt(dx * dx + dz * dz);
    if (amt > 1e-4) { _leanAxis.set(dz, 0, -dx).normalize(); g.quaternion.setFromAxisAngle(_leanAxis, Math.min(0.8, amt * FLAME.lean)); }
    else g.quaternion.identity();
    g.__mats[0].uniforms.uTime.value = t; g.__mats[1].uniforms.uTime.value = t;
  }
  function placeCandles(n, surfaces, candleHex, animateFrom) {
    var pts = layout(n, surfaces);
    if (!pts.length) return;
    if (animateFrom === undefined) animateFrom = Infinity;

    // Thinner, shorter candles when they're packed tight.
    var dense = n > 60;
    var radius = dense ? 0.05 : 0.065;
    var height = dense ? 0.52 : 0.62;                   // v0.90: ~23% taller than before
    var fs = dense ? 0.22 : 0.28;
    // Each candle stands in its holder: lifted by the spike showing, and the cup's floor.
    var lift = HOLDER.gap + radius * HOLDER.cupH * HOLDER.floor * 0.5;

    var bodyMat = makeWaxMaterial(candleHex);
    var bGeo = candleGeo.clone();                        // its own copy: it carries this set's per-candle glow
    var litAttr = new THREE.InstancedBufferAttribute(new Float32Array(pts.length).fill(1), 1);
    bGeo.setAttribute('aLit', litAttr);
    var bodies = new THREE.InstancedMesh(bGeo, bodyMat, pts.length);
    bodies.__litAttr = litAttr;
    var holders = new THREE.InstancedMesh(holderGeo(radius), holderMat, pts.length);
    var m = new THREE.Matrix4();
    var col = new THREE.Color();
    var hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(candleHex).getHSL(hsl);

    var flameBase = flames.length;
    var params = [];
    pts.forEach(function (p, i) {
      var C = candleHand(i, height);
      params.push(C);
      composeCandle(m, p, C, radius, lift, 1);
      bodies.setMatrixAt(i, m);
      composeHolder(m, p, C, i);
      holders.setMatrixAt(i, m);
      if (bodies.setColorAt) {
        // Quality control: each candle a touch off its nominal colour — hue, saturation and
        // lightness — seeded, so the recipient sees the same box of candles. Pale yellows drift
        // towards green quickly, so their hue is kept on a tighter leash.
        var yellow = hsl.h > 0.1 && hsl.h < 0.2;
        col.setHSL((hsl.h + (C.c1 - 0.5) * 0.035 * (yellow ? 0.35 : 1) + 1) % 1,
                   Math.max(0, Math.min(1, hsl.s + (C.c2 - 0.5) * 0.14)),
                   Math.max(0, Math.min(1, hsl.l + (C.c3 - 0.5) * 0.07)));
        bodies.setColorAt(i, col);
      }

      var wick = new THREE.Mesh(wickGeo, wickMat);
      var top = candleTop(p, C, lift, 1);                 // where this candle's top really is: leaning, burned down
      wick.position.set(top.x, top.y + 0.03, top.z);
      wick.quaternion.copy(C.q);
      built.add(wick);
      wicks.push(wick);

      var flame = new THREE.Sprite(flameMat.clone());   // an invisible anchor now (v0.96): the flame is a 3D mesh
      flame.material.__shared = false; flame.material.visible = false;
      flame.scale.set(fs * 0.7, fs, 1);
      flame.position.set(top.x, top.y + 0.16, top.z);    // flames stay upright while the candle leans
      built.add(flame);
      // The halo: same pivot, follows the flame in the update loop. Skipped on every other
      // candle past the budget so 100 candles is still 150 sprites, not 200.
      var halo = null;
      if (false) {                                         // flat halos retired (v0.96): the 3D flame carries its own
        halo = new THREE.Sprite(CakeLook.haloMaterial());
        halo.scale.set(fs * CakeLook.LOOK.halo.scale, fs * CakeLook.LOOK.halo.scale, 1);
        halo.position.copy(flame.position);
        halo.renderOrder = -1;                           // behind the core
        built.add(halo);
      }
      var fm = makeFlameMesh(((i * 0.618) % 1) * Math.PI * 2 + i * 1.7); built.add(fm);
      flames.push({ sprite: flame, halo: halo, base: fs, phase: ((i * 0.618) % 1) * Math.PI * 2, x: top.x, z: top.z,
                    k: 1, lit: 1, y: top.y + 0.16, leanX: 0, leanZ: 0, glow: litAttr, gi: i, mesh: fm, root: 0.13 });
    });
    bodies.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    built.add(bodies);
    holders.instanceMatrix.needsUpdate = true;
    built.add(holders);

    // Pop-in for new candles: outer ring first, staggered, capped at ~1.2s total.
    if (animateFrom < pts.length) {
      var count = pts.length - animateFrom;
      var stagger = Math.min(12, 1200 / Math.max(1, count));
      spawn = { bodies: bodies, pts: pts, radius: radius, height: height, lift: lift, params: params, from: animateFrom,
                stagger: stagger, start: performance.now(), done: false };
      // Hide new ones immediately
      for (var i = animateFrom; i < pts.length; i++) {
        setCandleScale(spawn, i, 0);
      }
    }
  }

  var _m4 = new THREE.Matrix4();
  function setCandleScale(sp, i, k) {
    var p = sp.pts[i], C = sp.params[i], m = _m4;
    composeCandle(m, p, C, sp.radius, sp.lift || 0, Math.max(0.001, k));
    sp.bodies.setMatrixAt(i, m);
    var f = flames[i];
    if (f) { f.k = k; f.sprite.visible = k > 0.05; }
    var w = wicks[i];
    if (w) { var tp = candleTop(p, C, sp.lift || 0, k); w.visible = k > 0.5; w.position.set(tp.x, tp.y + 0.03, tp.z); }
  }
  // ---- Each candle placed by hand (v0.91), all from the cake's seed ----
  //  · pushed in a little more or less: the spike showing varies
  //  · leaning up to about four degrees (the flame stays upright, as real flames do)
  //  · burned down a little differently: up to ~13% shorter, most only slightly
  //  · and a touch off its nominal colour (see placeCandles)
  var CANDLE_HAND = { push: 0.035, lean: 0.07, burn: 0.13 };
  var _eu = new THREE.Euler(), _v3 = new THREE.Vector3(), _s3 = new THREE.Vector3(), _q2 = new THREE.Quaternion(), _m5 = new THREE.Matrix4();
  function candleHand(i, height) {
    var sd = window.CakeFrosting ? CakeFrosting.seedOf() : 0;
    function h(k) { var n = Math.sin(i * 127.1 + k * 311.7 + sd * 74.7) * 43758.5453; return n - Math.floor(n); }
    var dGap = Math.max(0.006 - HOLDER.gap, (h(1) - 0.5) * 2 * CANDLE_HAND.push);
    _eu.set((h(2) - 0.5) * 2 * CANDLE_HAND.lean, 0, (h(3) - 0.5) * 2 * CANDLE_HAND.lean);
    return { dGap: dGap, q: new THREE.Quaternion().setFromEuler(_eu), h: height * (1 - CANDLE_HAND.burn * Math.pow(h(4), 1.4)),
             rib: ((i * 0.618) % 1) * Math.PI * 2, c1: h(5), c2: h(6), c3: h(7) };
  }
  // The candle: stands in its holder, leaning with it, scaled k (for the pop-in).
  function composeCandle(m, p, C, radius, lift, k) {
    _v3.set(0, C.dGap + lift + (C.h * k) / 2, 0).applyQuaternion(C.q).add(_s3.set(p.x, p.y, p.z));
    m.compose(_v3, C.q, _s3.set(radius * k, C.h * k, radius * k));
  }
  function composeHolder(m, p, C) {
    _q2.setFromAxisAngle(_s3.set(0, 1, 0), C.rib).premultiply(C.q);   // the rib faces its own way; the whole holder leans
    _v3.set(0, C.dGap, 0).applyQuaternion(C.q).add(_s3.set(p.x, p.y, p.z));
    m.compose(_v3, _q2, _s3.set(1, 1, 1));
  }
  function candleTop(p, C, lift, k) {
    return new THREE.Vector3(0, C.dGap + lift + C.h * k, 0).applyQuaternion(C.q).add(new THREE.Vector3(p.x, p.y, p.z));
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
  var msgCanvas = null;
  // `base` (optional): function(ctx, W, H) painting what's under the writing — the sponge
  // stripes on a naked cake, the frosting scrape on a semi-naked one. Flat frosting otherwise.
  // `ownCanvas`: paint into a fresh canvas instead of the shared one. The warm-up compile uses
  // this — otherwise its placeholder band overwrote the shared canvas, and any texture that
  // later re-uploaded from it (a wedge's clone) wore the word "warm".
  function makeMessageTexture(text, ink, frostingHex, radius, bodyH, base, ownCanvas) {
    text = String(text).slice(0, MAX_MSG);
    var circumference = 2 * Math.PI * radius;
    // The message is the thing people zoom into, so size its canvas off the real
    // device ratio rather than a fixed number. The texture is short (a thin band
    // round the cylinder), so even 4096 wide costs little memory.
    var W = deviceDPR >= 2 ? 4096 : 2048;
    var H = Math.max(96, Math.round(W * (bodyH / circumference)));   // square pixels on the cylinder
    // One persistent canvas, redrawn: at 4096 wide this is ~16MB, and allocating a fresh one on
    // every rebuild was what made Safari reload the tab under a slider drag. There is only ever
    // one live message band, so a single element serves every build (and the warm-up).
    var c = ownCanvas ? document.createElement('canvas') : (msgCanvas || (msgCanvas = document.createElement('canvas')));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    var g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    if (base) base(g, W, H);
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
      g.fillStyle = inkLum < THREE.Color.srgbToLinear(0.5) ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';
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
    // Every band shares ONE canvas (v0.62), so the GPU copy must be taken NOW, before the next
    // caller repaints it. Without this, the warm-up's 'warm' band — painted after the real cake
    // was built but before its texture had uploaded — is what the cake wore.
    renderer.initTexture(t);
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
  // `scheme` from layerScheme(); `span` is the world height the texture covers (v 0 → 1),
  // which is the body height for a side and the whole tier height for a cut face.
  function paintLayers(g, W, H, layers, scheme, span) {
    g.fillStyle = hexCss(SPONGE);
    g.fillRect(0, 0, W, H);
    scheme.fills.forEach(function (fb, i) {
      var top = H * (1 - fb[1] / span), bottom = H * (1 - fb[0] / span);   // canvas y runs down
      g.fillStyle = hexCss(layers[i % layers.length]);
      g.fillRect(0, top, W, bottom - top);
    });
    g.fillStyle = 'rgba(120,80,30,0.08)';                  // crumb
    var n = Math.round(W * H / 160);
    for (var k = 0; k < n; k++) g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  // A cut face: the sponge and its fillings, with the frosting band around the outside and on
  // top when the frosting has thickness. The face geometry spans the OUTER radius and height
  // (u = x/R, v = y/H); the sponge occupies u < rs/R, v < hs/H.
  function makeCutFaceTexture(layers, scheme, tier, frostingHex, thick) {
    var W = 256, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    if (thick) {
      g.fillStyle = hexCss(frostingHex); g.fillRect(0, 0, W, H);
      var sw = W * (tier.rs / tier.r), sh = H * (tier.hs / tier.h);
      g.save(); g.beginPath(); g.rect(0, H - sh, sw, sh); g.clip();
      // sponge stripes laid out over the sponge's own height, inside the frosting
      g.translate(0, H - sh); paintLayers(g, sw, sh, layers, scheme, tier.hs); g.restore();
    } else {
      paintLayers(g, W, H, layers, scheme, tier.h);
    }
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function makeLayersTexture(layers, scheme, span) {
    // Sponge / filling stripes for cut faces and naked sides. Filling colours run bottom→top.
    var c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    var g = c.getContext('2d');
    paintLayers(g, 256, 512, layers, scheme, span);
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
    var r = tiersFor(config)[0].r;
    var onFloor = !boxMode && built.visible !== false || !!cut;
    var left = cut ? slicesLeft() + (cut.lifted ? 1 : 0) : 1;
    CakeLook.setBleed(scene, new THREE.Color(frosting), r, onFloor && left > 0 && viewerMode !== 'slice', roomLit, candleLight.intensity);
  }
  // Materials for a tier — frosted shell or naked sponge — from a config. Shared by the whole
  // cake, the cut wedges and the slice page so the three can't disagree.
  var semiCache = {}, semiKeys = [];   // semi-naked side textures, by their inputs (see tierMaterials)
  var SPONGE_WOBBLE = 0.025;           // how far a baked wall strays from round, as a fraction of its radius
  // The sponge's crumb, with no stripes: fillings are solids with their own material now, so
  // nothing about them is painted. One tileable texture, made once.
  var crumbTex = null;
  function makeCrumbTexture() {
    if (crumbTex) return crumbTex;
    var c = document.createElement('canvas'); c.width = 256; c.height = 256;
    // White with faint crumb specks: the sponge COLOUR comes from the material, so one texture
    // serves every sponge. (It used to be painted in the sponge colour and then tinted by it
    // again — the walls came out a shade darker than the lid.)
    var g0 = c.getContext('2d'); g0.fillStyle = '#ffffff'; g0.fillRect(0, 0, 256, 256);
    g0.fillStyle = 'rgba(120,80,30,0.10)';
    for (var k0 = 0; k0 < 400; k0++) g0.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    crumbTex = new THREE.CanvasTexture(c); crumbTex.encoding = THREE.sRGBEncoding;
    crumbTex.wrapS = crumbTex.wrapT = THREE.RepeatWrapping; crumbTex.repeat.set(6, 1); crumbTex.__shared = true;
    return crumbTex;
  }

  // ---- The sponge as a stack of real solids (v0.69) ----
  // Builds one merged mesh: each sponge layer and each filling a closed solid of its own, and —
  // when `partial` — the flat ends of every solid at both cut angles, each in the solid's own
  // colour. Material array: [0] the outer side (layers texture, scrape, or the message band),
  // [1] sponge ends, [2..] filling ends by palette colour. Positioned at the tier's base.
  // `sideMat` is a texture that must span the whole stack (the writing, or a scrape); pass null
  // and every solid wears its own material — sponge crumb, filling colour — with nothing painted.
  function buildStack(cfg, tier, TM, sideMat, theta0, len, seg, partial) {
    var rs = tier.rs, hs = tier.hs, scheme = layerScheme(hs, cfg.ly), filling = TM.filling;
    var G = CakeShapes.P.groove, D = CakeShapes.P.disc;
    var textured = !!sideMat;
    // Outside: the CRUST — sandy, porous, browned — mapped biplanar (wrap on the walls, straight
    // down on the top, where the rack marks are). Inside: the CRUMB — open foam, soft wrap light.
    var smaps = window.CakeFrosting ? CakeFrosting.spongeMaps(cfg.rk) : null;
    var wall = sideMat || new THREE.MeshStandardMaterial({ color: SPONGE, roughness: 1, vertexColors: true });
    if (!sideMat && smaps) CakeFrosting.dressFondant(wall, smaps, rs);
    // Ends face both ways: of the two faces bounding a gap in a cut cake, one points into it
    // and one away, so single-sided ends vanished from half the angles.
    var crumbMat = new THREE.MeshStandardMaterial({ color: SPONGE_CRUMB, roughness: 1, side: THREE.DoubleSide, vertexColors: true });
    if (window.CakeFrosting) {
      var cm = CakeFrosting.crumbMaps(partial && viewerMode === 'slice', spongeOf(cfg).detail);   // real crumb when it can be seen; the slice page can't wait
      crumbMat.map = cm.a; crumbMat.normalMap = cm.n; crumbMat.roughnessMap = cm.r;
      CakeFrosting.wrapLighting(crumbMat, 0.6, new THREE.Color(1, 0.86, 0.62));
    }
    var geoms = [], mats = [wall, crumbMat];
    // [2] the top surface of the top layer: plain — sponge, or the buttercream where a scrape
    // covers the top fully. The side texture must not be sampled across the lid.
    var topHex = (TM.style === 4) ? PALETTES.frosting[clampIndex(cfg.frs ? cfg.frs[tier.idx || 0] : cfg.fc, PALETTES.frosting)].hex : SPONGE;
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
    if (window.CakeFrosting) CakeFrosting.spongeWobble(geo, rs, hs, SPONGE_WOBBLE);   // baked, not machined
    var mesh = new THREE.Mesh(geo, mats);
    mats.forEach(function (m) { if (m !== sideMat) nightGlow(m, m.color.getHex(), false); });
    return mesh;
  }
  // Per TIER, because the fillings are laid out in world units and tiers differ in height.
  // tier.idx (from tierTops / the build loop) picks the tier's own frosting colour.
  function tierMaterials(cfg, tier) {
    var ti = tier.idx !== undefined ? tier.idx : 0;
    var fondantHex = PALETTES.frosting[clampIndex(cfg.fcs ? cfg.fcs[ti] : cfg.fc, PALETTES.frosting)].hex;
    var creamHex = PALETTES.frosting[clampIndex(cfg.frs ? cfg.frs[ti] : cfg.fc, PALETTES.frosting)].hex;
    var fdOn = cfg.fds ? !!cfg.fds[ti] : !!cfg.fd, style = cfg.frsty ? cfg.frsty[ti] : cfg.fr;
    // "frosting" below is the colour of the OUTERMOST layer on this tier — what the writing sits on.
    var frosting = fdOn ? fondantHex : (style ? creamHex : fondantHex);
    var filling = PALETTES.filling[clampIndex(cfg.ic, PALETTES.filling)].layers;
    var naked = !style && !fdOn;
    var thick = frostingHasThickness(cfg, ti);
    // Geometry: the sponge itself (rs/hs, grooved) unless the frosting has thickness, in which
    // case the outer shell (r/h, smooth). Semi-naked has no thickness, so it wears the sponge.
    var rr = thick ? tier.r : tier.rs, hh = thick ? tier.h : tier.hs;
    var capH = thick ? CAP_H : NAKED_CAP_H, bodyH = hh - capH;
    var scheme = layerScheme(tier.hs, cfg.ly);   // fillings live in the sponge
    var side, cap, base = null, fMaps = null;
    var semi = !fdOn && style === 4 && window.CakeFrosting;   // fondant hides a scrape
    // Base painters span the SPONGE height — the same span the stack's UVs use — so a message
    // or a scrape lands on the fillings exactly where the filling solids are.
    var hs = tier.hs;
    var paintSponge = function (g, W, H) { paintLayers(g, W, H, filling, scheme, hs); };
    if (naked) {
      side = null;                                       // the stack wears its own materials
      cap = new THREE.MeshStandardMaterial({ color: SPONGE, roughness: 0.95, vertexColors: true });
      base = paintSponge;
    } else if (semi) {
      // Semi-naked: the sponge's own geometry wearing a thin scrape of buttercream.
      var hx = hexCss(creamHex), rgb = [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
      var scrape = function (g, W, H) {
        // paint into a scratch canvas via the style, then copy — keeps the style's own resolution
        var t = CakeFrosting.semiNakedTexture({ frostingRgb: rgb, paintBase: paintSponge, seed: (tier.idx || 0) + 1, size: [W, H] });
        g.drawImage(t.image, 0, 0, W, H); t.dispose();
      };
      // The scrape is a per-pixel canvas pass, so it's cached on its inputs: scrubbing a shape
      // slider back and forth doesn't repaint it, and cached textures are shared across builds.
      var key = [hx, filling.join(','), cfg.ly, hs.toFixed(2), tier.idx || 0, SPONGE].join('|');
      var tex = semiCache[key];
      if (!tex) {
        tex = CakeFrosting.semiNakedTexture({ frostingRgb: rgb, paintBase: paintSponge, seed: (tier.idx || 0) + 1 });
        tex.__shared = true;                         // owned by the cache, not by any one build
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
    if (side) nightGlow(side, naked ? SPONGE : frosting, false);
    nightGlow(cap, naked ? SPONGE : frosting, false);
    // The cut-face material is made on demand: only the cut, the slice page and the dev cut-away
    // use it, and creating it eagerly leaked three textures per build (one per tier) — dozens of
    // times a second while a shape slider was being dragged. Safari reloaded the tab for memory.
    var faceMat = null;
    function face() {
      if (!faceMat) faceMat = new THREE.MeshStandardMaterial({ map: makeCutFaceTexture(filling, scheme, { r: rr, h: hh, rs: tier.rs, hs: tier.hs }, frosting, thick), roughness: 0.9, side: THREE.DoubleSide, vertexColors: true });
      return faceMat;
    }
    return { side: side, cap: cap, face: face, frosting: frosting, filling: filling, naked: naked, fdOn: fdOn, style: style,
             scheme: thick ? null : scheme,            // grooves only when the sponge is what's seen
             capH: capH, bodyH: bodyH, rr: rr, hh: hh,
             profileOpts: thick ? { baseFillet: FONDANT_BASE_FILLET } : null,   // fondant: tighter at the board
             maps: fMaps,                                   // fondant finish maps (null when no fondant)
             base: base };
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
    return luminance(frostingHex) > THREE.Color.srgbToLinear(0.42) ? INK_DARK : INK_LIGHT;   // luminance is linear now
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
  var floorPaint = new THREE.Color(0xffebd2), roomLit = 1, skyDirty = true, skyCalibrations = 0, skyKey = '';
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
    spot.target.position.set(0, config ? centreOfMass(config) : 0.8, 0);
    // A light that starts or stops casting changes every material's shader; recompile once, now.
    if (spot.castShadow !== wasCasting || spot.visible !== wasVisible) {
      scene.traverse(function (o) { var m = o.material; if (!m) return; (Array.isArray(m) ? m : [m]).forEach(function (mm) { mm.needsUpdate = true; }); });
      markHeavy();
    }
    candleLight.distance = CakeLook.LOOK.night.distance; candleLight.decay = CakeLook.LOOK.night.decay;
    if (window.CakeStage) {
      var kd = key.position.clone().normalize();
      roomLit = CakeLook.litFactor(R, kd, key.color);
      CakeStage.setBrightness(roomLit);                 // fallback until measured
      // Measure the sky only when something that could change it has changed: the paint, the
      // room lights, the key, the spot. A rebuild with the same backdrop measures nothing —
      // the measurement is a GPU readback, and one per slider tick was the "freeze".
      var k = floorPaint.getHex() + '|' + R.hemi.toFixed(3) + R.key.toFixed(3) + R.fill.toFixed(3) + R.hemiSky.getHex() + R.hemiGround.getHex() +
              '|' + key.color.getHex() + key.position.x.toFixed(2) + key.position.y.toFixed(2) + key.position.z.toFixed(2) +
              '|' + (spot.visible ? spot.intensity.toFixed(2) + spot.color.getHex() : 'off');
      if (k !== skyKey) { skyKey = k; skyDirty = true; }
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
    // bgLuminance is LINEAR now (color.js); 0.42 in sRGB terms is ≈0.15 linear.
    document.body.classList.toggle('dark-bg', bgLuminance < THREE.Color.srgbToLinear(0.42));
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
  function centreOfMass(cfgOrKey) {
    var tiers = tiersFor(typeof cfgOrKey === 'object' ? cfgOrKey : config), num = 0, den = 0, y = PLATE_TOP;
    tiers.forEach(function (t) { var v = t.r * t.r * t.h; num += v * (y + t.h / 2); den += v; y += t.h; });
    return den ? num / den : 0.8;
  }
  // Framing radius from the cake's real size: wide cakes need width, tall cakes need height.
  function cakeFrame(cfgOrKey) {
    var tiers = tiersFor(typeof cfgOrKey === 'object' ? cfgOrKey : config), h = PLATE_TOP;
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
      if (f.glow) {                                      // the candle's inner glow goes with its flame
        var gv = Math.max(0, Math.min(1, f.lit * f.k));
        if (Math.abs(f.glow.array[f.gi] - gv) > 0.01) { f.glow.array[f.gi] = gv; f.glow.needsUpdate = true; }
      } else if (f.mat) f.mat.emissiveIntensity = f.glowBase * Math.max(0, Math.min(1, f.lit * f.k));   // a number candle
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
      updateFlameMesh(f, t, lx, lz);
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
    if (window.CakeStage) {
      CakeStage.update(camera.position.length());
      // Measure the sky when the lighting has changed — and a couple of times early on, so the
      // first measurement isn't taken before the materials have compiled.
      if (skyDirty || skyCalibrations < 3) { CakeStage.calibrate(renderer, scene); skyDirty = false; skyCalibrations++; }
      else CakeStage.finishCalibrate(renderer);        // the readback happens a frame later, when the GPU is done
    }
    renderer.render(scene, camera);                      // everything but the flames (layer 0)
    renderAO();                                          // real occlusion from the geometry on screen
    renderFlames();                                      // then the flames, on top, still hidden behind the cake where they should be
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
    tiersFor(config).forEach(function (t) { widest = Math.max(widest, t.r); });
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
    var tiers = tiersFor(config), h = PLATE_TOP;
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
    if (luminance(rib) > THREE.Color.srgbToLinear(0.82) && luminance(lighten(frostingHex, 0.55)) > THREE.Color.srgbToLinear(0.75)) rib = darken(rib, 0.32);   // linear luminance (color.js)
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
    setFrame('cake', centreOfMass(config));
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
    max: 12,                                           // rad/s (~2 turns/s): repeated flicks build to here
    catchIdleDelay: 2200,                              // ms after a catch before the ambient turn resumes (viewer)
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
  var heldOmega = 0;            // the speed the cake had when it was caught (for building speed)
  var idleResumeAt = 0;         // after a catch, the ambient turn waits until this time

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
    // A finger on the cake holds it: no momentum, no ambient turn — it follows the thumb 1:1.
    if (dragging) { omega = 0; }
    var target = (dragging || now < idleResumeAt) ? 0 : idleRate();
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
        // Catch: the cake stops dead under the finger. Its speed is remembered so a swipe the
        // same way can build on it (a lazy Susan: catch it, push it further).
        heldOmega = omega; omega = 0;
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
      if (!isFinite(v)) v = 0;
      // Held still (or a tap): it stays stopped, and the viewer's ambient turn waits a moment.
      // Flung the same way it was already going: speed builds. Flung the other way: the catch
      // already stopped it, so it simply goes the new way.
      if (Math.abs(v) < 0.15) { omega = 0; idleResumeAt = now + SPIN.catchIdleDelay; }
      else if (heldOmega && Math.sign(v) === Math.sign(heldOmega)) omega = heldOmega + v;
      else omega = v;
      omega = Math.max(-SPIN.max, Math.min(SPIN.max, omega));
      heldOmega = 0;
      dragW = 0;
      samples.length = 0;
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    // Tap a tier to make it the current one (builder only; a drag is not a tap).
    var tapDown = null;
    canvas.addEventListener('pointerdown', function (e) { if (e.isPrimary) tapDown = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', function (e) {
      if (!tapDown || !e.isPrimary) { tapDown = null; return; }
      var moved = Math.hypot(e.clientX - tapDown.x, e.clientY - tapDown.y), quick = performance.now() - tapDown.t < 400;
      tapDown = null;
      if (moved > 8 || !quick || !document.body.classList.contains('mode-builder') || !draft) return;
      var i = tierAt(e.clientX, e.clientY);
      if (i >= 0) setCurTier(i, true);
    });
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
    var tiers = tiersFor(cfg);
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
    if (luminance(rib) > THREE.Color.srgbToLinear(0.82) && luminance(lighten(frostingHex, 0.55)) > THREE.Color.srgbToLinear(0.75)) rib = darken(rib, 0.32);   // linear luminance (color.js)
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
      boxMode = false; fitShadow(tiersFor(config)[0].r);
      tween({ duration: 160, ease: EASE.pop, update: function (k) { var sc = 1.03 - 0.03 * k; built.scale.set(sc, sc, sc); } });
      setFrame('cake', centreOfMass(config));
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
    var tiers = tiersFor(cfg), y = PLATE_TOP, out = [];
    tiers.forEach(function (t, i) { out.push({ r: t.r, h: t.h, rs: t.rs, hs: t.hs, y0: y, idx: i, aboveR: tiers[i + 1] ? tiers[i + 1].r : undefined }); y += t.h; });
    return out;
  }

  // One wedge: body + cap + two cut faces showing the filling. The message band on the
  // bottom tier is carried by a cloned texture whose offset/repeat select this wedge's arc.
  // Materials are per tier (tierMaterials): pass `TM` for the tier, or nothing to make them here.
  function makeWedge(tier, i, cfg, TM, msgMap) {
    TM = TM || tierMaterials(cfg, tier);
    var frostingMat = TM.side, capMat = TM.cap, scheme = TM.scheme, capH = TM.capH, pOpts = TM.profileOpts;
    var N = WEDGES_PER_TIER, theta0 = i * Math.PI * 2 / N, len = Math.PI * 2 / N;
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
    var wseg = Math.max(6, Math.round(CYL_SEG / N) + 2);
    var rr = TM.rr;                                           // the sponge, or the shell when the fondant is on
    // The ribbon goes with the slice: the same band as the whole cake's, cut to this wedge.
    var rtw = cfg.rt && cfg.rt[tier.idx || 0];
    if (rtw && rtw.on) {
      var wRw = ribbonWidth(rtw.w), wHand = ribbonHandFor(cfg, tier, TM, wRw, rtw), wRbY = ribbonY(TM, tier, wRw, rtw.p);
      var wbGeo = CakeShapes.ribbon(ribbonRadius(TM, rr, bodyH, pOpts, wRbY, wRw), wRbY, wRw, wseg, theta0, len, wHand);
      if (!TM.fdOn && window.CakeFrosting) CakeFrosting.spongeWobble(wbGeo, rr, 1e3, SPONGE_WOBBLE);
      var band = new THREE.Mesh(wbGeo, makeRibbonMaterial(cfg, rtw));
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

  function startCut() {
    if (cut) return;
    markHeavy();
    var cfg = config, code = cakeCode();
    var st = loadCutState(code);
    var msgMap = messageMesh && messageMesh.material[0] && messageMesh.material[0].map ? messageMesh.material[0].map : null;

    built.visible = false;                    // the whole cake, candles included, steps aside
    cut = { wedges: [], plate: null, lifted: null, code: code, sentBack: !!st.sentBack, total: 0 };
    var tiers = tierTops(cfg);
    var TMs = tiers.map(function (tier) { return tierMaterials(cfg, tier); });   // one set per tier, shared by its wedges
    tiers.forEach(function (tier, ti) {
      for (var i = 0; i < WEDGES_PER_TIER; i++) {
        var w = makeWedge(tier, i, cfg, TMs[ti], ti === 0 ? msgMap : null);
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

  // ---- One plate and one way of plating a slice (v0.73) ----
  // The sender's lifted wedge and the recipient's slice page used to build their own plates
  // (the recipient's was smaller, with a ribbon-coloured rim) and the recipient's wedge was
  // made from a stub of the tier (no sponge size, no index) so its layers came out empty.
  // Both now use these, with the full tier from tierTops, so they cannot drift apart.
  var PLATE = { r: 1.3, h: 0.08, colour: 0xfafafa };
  function makePlate() {
    var plate = new THREE.Mesh(new THREE.CylinderGeometry(PLATE.r, PLATE.r, PLATE.h, 48),
      new THREE.MeshStandardMaterial({ color: PLATE.colour, roughness: 0.4 }));
    plate.position.y = PLATE.h / 2;
    if (window.CakeLook) CakeLook.adopt(plate);
    return plate;
  }
  // Where a wedge must sit so its centroid is over (x, z) on a plate there. The wedge is built
  // in cake space at its tier's height; this drops it onto the plate.
  function wedgeOffsetFor(tier, i, x, z) {
    var thMid = (i + 0.5) * Math.PI * 2 / WEDGES_PER_TIER;
    return new THREE.Vector3(x - Math.sin(thMid) * tier.r * 0.6, PLATE.h - tier.y0, z - Math.cos(thMid) * tier.r * 0.6);
  }
  // The message band texture of the cake as built (for wedges from the message tier).
  function currentMessageMap() {
    return messageMesh && messageMesh.material[0] && messageMesh.material[0].map ? messageMesh.material[0].map : null;
  }

  function liftWedge(w) {
    if (!cut || cut.lifted) return;
    cut.lifted = w; w.userData.lifted = true;
    // Toward the viewer, whatever the camera's doing: the slice always comes to you.
    var dir = new THREE.Vector3(camera.position.x, 0, camera.position.z).normalize();
    var tier = tierTops(config)[w.userData.tier];
    var out = tier.r + 1.9;
    var target = dir.clone().multiplyScalar(out);
    // The plate arrives from the side
    var plate = makePlate();
    plate.position.set(target.x + dir.z * 3, PLATE.h / 2, target.z - dir.x * 3);
    cutGroup.add(plate); cut.plate = plate;
    // Land with the wedge's own centroid over the plate's centre
    var startP = w.position.clone();
    var endP = wedgeOffsetFor(tier, w.userData.i, target.x, target.z);
    tween({ duration: 450, ease: EASE.lift, update: function (k) {
      w.position.lerpVectors(startP, endP, k);
      w.position.y += Math.sin(Math.PI * k) * 0.55;                  // up and over
      w.rotation.z = Math.sin(k * Math.PI * 2) * 0.05 * (1 - k);      // wobble, decaying
    }, done: function () {
      w.position.copy(endP);
      tween({ duration: 160, ease: EASE.pop, update: function (k) { w.scale.y = 0.96 + 0.04 * k; } });
    } });
    tween({ delay: 120, duration: 280, ease: EASE.soft, update: function (k) {
      plate.position.set(target.x + dir.z * 3 * (1 - k), PLATE.h / 2, target.z - dir.x * 3 * (1 - k));
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
    // The same wedge the sender lifted: the FULL tier (sponge size, index, the tier above),
    // the same wedge index, the same message band, on the same plate.
    var tiers = tierTops(cfg);
    var ti = Math.min(tiers.length - 1, Math.floor(sl.index / WEDGES_PER_TIER));
    var tier = tiers[ti], wi = sl.index % WEDGES_PER_TIER;
    var w = makeWedge(tier, wi, cfg, null, ti === 0 ? currentMessageMap() : null);
    // Face the cut toward the camera: turn the wedge so its centroid points away (−z), then
    // drop it so the centroid sits over the plate's centre.
    var holder = new THREE.Group();
    holder.add(w);
    var off = wedgeOffsetFor(tier, wi, 0, 0);
    w.position.set(off.x, off.y, off.z);
    var thMid = (wi + 0.5) * Math.PI * 2 / WEDGES_PER_TIER;
    holder.rotation.y = Math.PI - thMid;
    if (window.CakeLook) CakeLook.adopt(w);
    cutGroup.add(holder);
    cutGroup.add(makePlate());
    // No candle on a slice: the candles went when the cake was cut, and a slice that
    // sprouted a new one would contradict that. It's a piece of the cake you were sent.
    flames.length = 0; wicks.length = 0;
    var topY = PLATE.h + tier.h;
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
    tiers: $('tiers'), swFc: $('sw-fc'), swFrc: $('sw-frc'), swIc: $('sw-ic'), swCc: $('sw-cc'), swRc: $('sw-rc'), swTc: $('sw-tc'), swBg: $('sw-bg'),
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
        if (key === 'rc') { draft.rt[curTier].c = i; draft = normalize(draft); }   // per tier
        else if (key === 'fc') { if (fondAll) draft.fcs = draft.fcs.map(function () { return i; }); else draft.fcs[curTier] = i; draft = normalize(draft); }
        else if (key === 'frc') { if (frostAll) draft.frs = draft.frs.map(function () { return i; }); else draft.frs[curTier] = i; draft = normalize(draft); }
        else draft[key] = i;
        syncSwatches(container, i);
        if (key === 'fc' || key === 'frc' || key === 'tc') refreshAutoSwatch();
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
  // What the builder may offer, applied to whatever draft it's given (a fresh one, or a
  // reminder / "send one back" pre-fill from an older link). The viewer is never clamped.
  function applyBuilderLimits() {
    if (!FEATURES.tier3 && draft.t > 2) {
      // Keep the bottom two tiers as they were: drop the live arrays so normalize re-derives
      // them for two tiers from the link strings.
      draft.t = 2; delete draft.sh; delete draft.fcs; delete draft.frs; delete draft.frsty; delete draft.fds;
      draft = normalize(draft);
    }
    if (draft.n > BUILDER_MAX_CANDLES) draft.n = BUILDER_MAX_CANDLES;
  }
  function syncForm() {
    applyBuilderLimits();
    els.to.value = draft.to;
    els.from.value = draft.from;
    els.m.value = draft.m;
    els.mCount.textContent = draft.m.length + ' / ' + MAX_MSG;
    els.n.value = draft.n;
    els.nOut.textContent = draft.n;
    syncCandleMode();
    syncTiers(draft.t);
    // frosting swatches: see syncFrostTiers (per tier)
    Array.prototype.forEach.call($('sw-sp').children, function (b, i) { b.setAttribute('aria-pressed', i === draft.sp ? 'true' : 'false'); });
    syncSwatches(els.swIc, draft.ic);
    syncSwatches(els.swCc, draft.cc);
    // ribbon swatches: see syncRibbon (per tier)
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
    ['occasion', 'message', 'tiers', 'shape', 'sponge', 'frosting', 'fondant', 'candles', 'ribbon', 'backdrop', 'light'].forEach(function (k) {
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
  // ---- One current tier, shared by Shape, Frosting and Ribbon ----
  // Pick Tier 2 in Shape and you're still on Tier 2 in Frosting. Tapping a tier on the cake
  // sets it too. Frosting also has an "All" mode (the default) so one swatch colours every tier.
  var curTier = 0, frostAll = true, fondAll = true;
  function setCurTier(i, fromCake) {
    var n = tiersFor(draft).length;
    curTier = Math.max(0, Math.min(n - 1, i | 0));
    if (fromCake) { frostAll = false; fondAll = false; }
    syncShape(); syncRibbon(); syncFrostTiers();
    if (fromCake) pulseTier(curTier);
  }
  // A brief scale pulse on the tapped tier, so the tap is acknowledged where it landed.
  function pulseTier(i) {
    var tg = tierGroups[i]; if (!tg) return;
    tween({ duration: 260, ease: EASE.soft, update: function (k) { var sc = 1 + 0.03 * Math.sin(k * Math.PI); tg.scale.set(sc, sc, sc); }, done: function () { tg.scale.set(1, 1, 1); } });
  }
  // Which tier is under a screen point (builder only).
  var _tierRay = new THREE.Raycaster(), _tierNdc = new THREE.Vector2();
  function tierAt(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    _tierNdc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    _tierRay.setFromCamera(_tierNdc, camera);
    var hits = _tierRay.intersectObjects(tierGroups, true);
    for (var h = 0; h < hits.length; h++) {
      var o = hits[h].object;
      while (o && tierGroups.indexOf(o) < 0) o = o.parent;
      if (o) return tierGroups.indexOf(o);
    }
    return -1;
  }

  // ---- Tier shape controls: width and height per tier, the stack always valid ----
  function syncShape() {
    var n = tiersFor(draft).length;
    if (curTier >= n) curTier = 0;
    Array.prototype.forEach.call($('shape-tiers').children, function (b, i) { b.hidden = i >= n; b.classList.toggle('on', i === curTier); });
    var st = draft.sh[curTier];
    var w = $('f-sw'), h = $('f-sh');
    // Width can't exceed the tier below minus the ledge — the slider's max moves with it.
    var maxStep = curTier === 0 ? SHAPE.steps - 1 : Math.max(0, Math.floor(rToStep(stepToR(draft.sh[curTier - 1].r) - SHAPE.ledge)));
    w.max = maxStep; w.value = Math.min(st.r, maxStep); h.value = st.h;
    $('sw-out').textContent = (stepToR(st.r) * 2).toFixed(1); $('sh-out').textContent = stepToH(st.h).toFixed(1);
  }
  // Sliders fire many times per second; rebuilding the cake on every tick is wasted work and,
  // on a phone, memory pressure. Coalesce: at most one rebuild per animation frame.
  var buildPending = false, buildOpts = null;
  function scheduleBuild(opts) {
    buildOpts = opts || null;
    if (buildPending) return;
    buildPending = true;
    requestAnimationFrame(function () { buildPending = false; var o = buildOpts; buildOpts = null; build(draft, o || undefined); });
  }
  function syncRibbon() {
    var tiers = tiersFor(draft).length;
    if (curTier >= tiers) curTier = 0;
    Array.prototype.forEach.call($('ribbon-tiers').children, function (b, i) {
      b.hidden = i >= tiers; b.classList.toggle('on', i === curTier);
    });
    var rt = draft.rt[curTier];
    var box = $('f-ribbon'); if (box) box.checked = !!rt.on;
    var opts = $('ribbon-opts'); if (opts) opts.classList.toggle('dim', !rt.on);
    syncSwatches(els.swRc, rt.c);
    var rw = $('f-rw'); if (rw) rw.value = rt.w;
    var rp = $('f-rp'); if (rp) rp.value = rt.p < 0 ? 1 : rt.p;
    var ra = $('f-ra'); if (ra) ra.value = rt.a || 0;
    Array.prototype.forEach.call($('rib-material').children, function (b) { b.classList.toggle('on', +b.getAttribute('data-rm') === draft.rm); });
    var out = $('rw-out'); if (out) out.textContent = ribbonWidth(rt.w).toFixed(2);
  }
  function syncTierPills(id, all) {
    var n = tiersFor(draft).length;
    Array.prototype.forEach.call($(id).children, function (b) {
      var k = b.getAttribute('data-tier');
      b.hidden = k !== 'all' && +k >= n;
      b.classList.toggle('on', all ? k === 'all' : +k === curTier);
    });
  }
  function syncFrostTiers() {
    syncTierPills('frost-tiers', frostAll);
    syncSwatches(els.swFrc, draft.frs[frostAll ? 0 : curTier]);
    var st = draft.frsty[frostAll ? 0 : curTier];
    Array.prototype.forEach.call($('frost-style').children, function (b) { b.classList.toggle('on', +b.getAttribute('data-fr') === st); });
    syncTierPills('fond-tiers', fondAll);
    syncSwatches(els.swFc, draft.fcs[fondAll ? 0 : curTier]);
    var fdOn = !!draft.fds[fondAll ? 0 : curTier];
    var box = $('f-fondant'); if (box) box.checked = fdOn;
    var opts = $('fond-opts'); if (opts) opts.classList.toggle('dim', !fdOn);
    var anyFd = draft.fds.some(function (v) { return v; });
    var frow = $('fond-finish-row'); if (frow) frow.classList.toggle('dim', !anyFd);
    Array.prototype.forEach.call($('fond-finish').children, function (b) { b.classList.toggle('on', +b.getAttribute('data-ff') === draft.ff); });
    Array.prototype.forEach.call($('light-presets').children, function (b, i) { b.classList.toggle('on', i === lightPreset); });
  }
  function syncFrosting() {
    syncRibbon();
    syncShape();
    syncFrostTiers();
    Array.prototype.forEach.call($('layers').children, function (b) { b.classList.toggle('on', +b.getAttribute('data-ly') === draft.ly); });
    Array.prototype.forEach.call($('bake-rack').children, function (b) { b.classList.toggle('on', +b.getAttribute('data-rk') === draft.rk); });
    var lo = $('ly-out'); if (lo) lo.textContent = draft.ly;
  }
  // The writing-colour note lives in the Message tray now.
  function updateColourNote() {
    var note = $('colour-note');
    if (!note) return;
    var outer = (draft.fds[0] || draft.frsty[0]) ? PALETTES.frosting[clampIndex(draft.fc, PALETTES.frosting)].hex : SPONGE;   // fc = the message tier's outermost colour
    var ink = pickInk(outer, draft.tc);
    // Their cake, their call — but say so if it'll be hard to read.
    // inkContrast is a real (linear-luminance) WCAG ratio now; 3:1 is the large-text minimum.
    note.textContent = inkContrast(ink, outer) < 3.0
      ? 'Low contrast — this may be hard to read on the cake'
      : (draft.fds[0] ? 'Auto picks dark or light to suit the icing' : draft.frsty[0] ? 'Auto picks dark or light to suit the frosting' : 'Auto picks dark or light to suit the sponge');
  }
  function updateCta() {
    var el = $('cta-price');
    if (el) el.textContent = PRICES[draft.t] || PRICES[1];
    var cn = $('chip-n');
    if (cn) cn.textContent = draft.n;                   // (the chip is "Decorate" now; the count lives in the tray)
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
    // Hidden features: remove their chips (and the Showstopper card) from the builder.
    function hideEl(el) { if (el) { el.hidden = true; el.style.display = 'none'; } }
    if (!FEATURES.occasion) hideEl($('chiprow').querySelector('.chip[data-tray="occasion"]'));
    if (!FEATURES.buttercream) hideEl($('chiprow').querySelector('.chip[data-tray="frosting"]'));
    if (!FEATURES.tier3) { hideEl(els.tiers.querySelector('.tier[data-t="3"]')); els.tiers.style.gridTemplateColumns = 'repeat(2, 1fr)'; }
    Array.prototype.forEach.call($('chiprow').querySelectorAll('.chip[data-tray]'), function (c) {
      c.addEventListener('click', function () { setTray(c.getAttribute('data-tray')); });
    });
    // Shuffle: a new look for the same cake (tier count, words and candles kept).
    var shuf = $('chiprow').querySelector('.chip[data-action="shuffle"]');
    if (shuf) shuf.addEventListener('click', function () {
      draft = applyRandomLook(draft, false);
      updateRoomLights();                                 // key light re-randomised (no shader change)
      syncForm(); updateColourNote(); updateCta();
      build(draft, { showMessage: true });
      frostOn();
      shuf.classList.remove('spin'); void shuf.offsetWidth; shuf.classList.add('spin');
    });
    // Fondant on/off — the moment: the sheet goes over the cake.
    $('f-fondant').addEventListener('change', function (e) {
      var on = e.target.checked ? 1 : 0;
      if (fondAll) draft.fds = draft.fds.map(function () { return on; }); else draft.fds[curTier] = on;
      draft = normalize(draft);
      syncFrosting(); updateColourNote();
      build(draft);
      if (on) frostOn();
    });
    // Bake and rack marks (whole cake). Maps and colours only — no shader change.
    Array.prototype.forEach.call($('bake-rack').children, function (b) {
      b.addEventListener('click', function () { draft.rk = +b.getAttribute('data-rk'); draft = normalize(draft); syncFrosting(); build(draft); });
    });
    // Buttercream style: None is a style, so there's no toggle. Per tier, or every tier with "All".
    Array.prototype.forEach.call($('frost-style').children, function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        var st = +b.getAttribute('data-fr') || 0;
        if (frostAll) draft.frsty = draft.frsty.map(function () { return st; }); else draft.frsty[curTier] = st;
        draft = normalize(draft);
        syncFrosting(); updateColourNote(); build(draft);
      });
    });
    Array.prototype.forEach.call($('layers').children, function (b) {
      b.addEventListener('click', function () { draft.ly = +b.getAttribute('data-ly'); syncFrosting(); build(draft); });
    });
    // Tier pills in Shape, Frosting and Ribbon all set the one current tier.
    Array.prototype.forEach.call($('shape-tiers').children, function (b, i) { b.addEventListener('click', function () { setCurTier(i); }); });
    Array.prototype.forEach.call($('ribbon-tiers').children, function (b, i) { b.addEventListener('click', function () { setCurTier(i); }); });
    Array.prototype.forEach.call($('frost-tiers').children, function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-tier');
        if (k === 'all') { frostAll = true; syncFrostTiers(); } else { frostAll = false; setCurTier(+k); }
      });
    });
    Array.prototype.forEach.call($('fond-tiers').children, function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-tier');
        if (k === 'all') { fondAll = true; syncFrostTiers(); } else { fondAll = false; setCurTier(+k); }
      });
    });
    // Shape sliders: keep the message texture during the drag; one full rebuild on release.
    $('f-sw').addEventListener('input', function (e) {
      draft.sh[curTier].r = +e.target.value; draft = normalize(draft);   // normalize re-clamps the tiers above
      syncShape(); syncRibbon(); scheduleBuild({ keepMessage: true });
    });
    $('f-sh').addEventListener('input', function (e) {
      draft.sh[curTier].h = +e.target.value; draft = normalize(draft);
      syncShape(); scheduleBuild({ keepMessage: true });
    });
    ['f-sw', 'f-sh'].forEach(function (id) { $(id).addEventListener('change', function () { scheduleBuild(); }); });
    $('shape-reset').addEventListener('click', function () {
      draft.sh = classicShape(draft.t); draft = normalize(draft);
      syncShape(); build(draft);
    });
    $('f-ribbon').addEventListener('change', function (e) {
      draft.rt[curTier].on = e.target.checked;
      if (e.target.checked && draft.rt[curTier].p < 0) draft.rt[curTier].p = 1;   // a new ribbon starts near the base
      draft = normalize(draft);
      syncRibbon(); build(draft);
    });
    $('f-ra').addEventListener('input', function (e) {
      draft.rt[curTier].a = +e.target.value; draft = normalize(draft);
      syncRibbon(); scheduleBuild();
    });
    Array.prototype.forEach.call($('rib-material').children, function (b) {
      b.addEventListener('click', function () { draft.rm = +b.getAttribute('data-rm'); draft = normalize(draft); syncRibbon(); build(draft); });
    });
    $('f-rp').addEventListener('input', function (e) {
      draft.rt[curTier].p = +e.target.value; draft = normalize(draft);
      syncRibbon(); scheduleBuild();
    });
    $('f-rw').addEventListener('input', function (e) {
      draft.rt[curTier].w = +e.target.value; draft = normalize(draft);
      syncRibbon(); scheduleBuild();
    });


    makeSwatches(els.swFc, PALETTES.frosting, 'fc');      // fondant colours
    makeSwatches(els.swFrc, PALETTES.frosting, 'frc');    // buttercream colours
    // Sponges: split swatches — the crust as a ring round the crumb, a slice seen end-on.
    SPONGES.forEach(function (S, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'swatch split'; b.title = S.name; b.setAttribute('aria-label', S.name);
      b.style.setProperty('--crumb', '#' + ('000000' + S.crumb.toString(16)).slice(-6));
      b.style.setProperty('--crust', '#' + ('000000' + S.crust.toString(16)).slice(-6));
      b.addEventListener('click', function () { draft.sp = i; draft = normalize(draft); syncFrosting(); updateColourNote(); build(draft); });
      $('sw-sp').appendChild(b);
    });
    // Finishes: small lit previews, in the order they're shown.
    // Swept (1) and Spiral (5) are retired — Rings and Whirl replaced them — but old links
    // carrying them still decode and render.
    [[0, 'Smooth'], [8, 'Rings'], [9, 'Whirl'], [4, 'Combed'], [7, 'Ridged'], [10, 'Sweep'], [11, 'Broad sweep'], [2, 'Rustic'], [6, 'Deep rustic']].forEach(function (f) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tile'; b.setAttribute('data-ff', f[0]);
      var im = document.createElement('img'); im.alt = ''; im.src = window.CakeFrosting ? CakeFrosting.finishPreview(f[0], 28) : '';
      var t = document.createElement('span'); t.textContent = f[1];
      b.appendChild(im); b.appendChild(t);
      b.addEventListener('click', function () {
        var ff = f[0]; if (ff === draft.ff) return;
        draft.ff = ff; draft = normalize(draft); syncFrosting(); build(draft);   // maps only: same shader
      });
      $('fond-finish').appendChild(b);
    });
    // Lighting presets.
    LIGHT_PRESETS.forEach(function (P, i) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = P.name; b.setAttribute('data-lp', i);
      b.addEventListener('click', function () { applyLightPreset(i, false); updateRoomLights(); syncFrosting(); });
      $('light-presets').appendChild(b);
    });
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

    // Candles | Numbers, and the age. Each side keeps its own settings when you switch.
    $('candle-mode').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-cm]') : null;
      if (!b) return;
      e.stopPropagation();
      draft.cm = +b.getAttribute('data-cm'); draft = normalize(draft); syncCandleMode(); build(draft);
    });
    $('f-age').addEventListener('input', function (e) {
      var v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
      if (v !== e.target.value) e.target.value = v;
      if (!v || +v < 1) return;                           // mid-typing: keep the last good age on the cake
      draft.age = +v; draft = normalize(draft); syncMessageNudge(); scheduleBuild();
    });
    els.n.addEventListener('input', function () {
      draft.n = clampInt(els.n.value, 0, BUILDER_MAX_CANDLES, 0);
      var hint = $('count-hint'), atCap = draft.n >= BUILDER_MAX_CANDLES; hint.hidden = !atCap; hint.style.display = atCap ? '' : 'none';   // at the cap: point to number candles
      els.nOut.textContent = draft.n;
      updateCta();
      scheduleBuild();
    });

    // Per-tier settings are remembered across a tier-count change: going 2 → 1 → 2 brings the
    // top tier back as it was (re-clamped if the bottom has narrowed meanwhile). A tier that has
    // never existed starts from the classic shape and the bottom tier's colours.
    var tierMem = { sh: [], fcs: [], frs: [], frsty: [], fds: [] };
    function rememberTiers() {
      Object.keys(tierMem).forEach(function (k) {
        (draft[k] || []).forEach(function (v, i) { tierMem[k][i] = (typeof v === 'object') ? { r: v.r, h: v.h } : v; });
      });
    }
    Array.prototype.forEach.call(els.tiers.children, function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-t') | 0;
        if (t === draft.t) return;
        rememberTiers();
        var n = TIERS[t].length, classic = classicShape(t), next = { sh: [], fcs: [], frs: [], frsty: [], fds: [] };
        for (var i = 0; i < n; i++) {
          next.sh.push(tierMem.sh[i] ? { r: tierMem.sh[i].r, h: tierMem.sh[i].h } : classic[i]);
          ['fcs', 'frs', 'frsty', 'fds'].forEach(function (k) { next[k].push(tierMem[k][i] !== undefined ? tierMem[k][i] : tierMem[k][0]); });
        }
        draft.t = t;
        Object.keys(next).forEach(function (k) { draft[k] = next[k]; });
        draft = normalize(draft);                         // re-clamps the stack
        if (curTier >= n) curTier = n - 1;
        syncTiers(draft.t); syncShape(); syncRibbon(); syncFrostTiers();
        updateCta();
        build(draft, { showMessage: true });
      });
    });

    els.getLink.addEventListener('click', function () {
      if (draft.o === OCCASION_UNCHOSEN) draft.o = FEATURES.occasion ? OCCASION_FALLBACK : OCCASION_DEFAULT;
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
      openTray = null; setTray((!FEATURES.occasion || (draft && draft.o >= 0 && draft.__prefilled)) ? 'message' : 'occasion');
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
    tmp.add(makeFlameMesh(0));                            // the flame shader
    var dg = digitGeometry('1', 1);                       // a number candle: wax on a plain mesh, and its spike
    if (dg) { tmp.add(new THREE.Mesh(dg.geo, makeWaxMaterial(0x4FC3F7))); tmp.add(new THREE.Mesh(numberSpikeGeo, holderMat)); }
    var cfg = normalize(DEFAULTS); cfg.m = 'warm'; cfg.t = 2;
    var frosting = PALETTES.frosting[0].hex, filling = PALETTES.filling[7].layers;
    var frostingMat = new THREE.MeshStandardMaterial({ color: frosting, roughness: 0.62, vertexColors: true });
    var msgTex = makeMessageTexture('warm', INK_DARK, frosting, 2.2, 1.2, null, true);   // its own canvas
    var msgMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, map: msgTex, vertexColors: true });
    nightGlow(msgMat, 0xffffff, true);                                   // message band: map + emissiveMap
    var tier = { r: 2.2, h: 1.6, rs: 2.08, hs: 1.45, y0: 0, aboveR: 1.4, idx: 0 };
    if (window.CakeFrosting) {                                           // fondant now always wears a finish
      var wm = CakeFrosting.fondantMaps(0);
      CakeFrosting.dressFondant(msgMat, wm, 2.2); CakeFrosting.dressFondant(frostingMat, wm, 2.2);
    }
    tmp.add(makeWedge(tier, 0, cfg, null, msgTex)); // wedge band: map, no emissive
    tmp.add(makeWedge(tier, 1, cfg, null, null));
    var savedF = cfg.fds; cfg.fds = cfg.fds.map(function () { return 0; }); tmp.add(makeWedge(tier, 2, cfg, null, null)); cfg.fds = savedF;   // a naked wedge too
    var wholeBody = new THREE.Mesh(CakeShapes.shell(2.2, 1.28, 0.32, 8), [msgMat, frostingMat]); tmp.add(wholeBody);
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
      if (!draft) { draft = normalize(DEFAULTS); draft.o = FEATURES.occasion ? OCCASION_UNCHOSEN : OCCASION_DEFAULT; draft.ly = 2; draft.frsty = draft.frsty.map(function () { return 0; }); draft.fds = draft.fds.map(function () { return 0; }); draft.rt.forEach(function (t) { t.on = false; }); draft = normalize(draft); draft = applyRandomLook(draft, true);
        if (window.CakeLook) { CakeLook.rebuild(renderer, scene, key); updateRoomLights(); }   // before the first build and the warm-up: the light size is in the shader
      }   // a new cake starts as a random finished cake in a curated look
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
      if ('rbt' in partial || 'rbp' in partial || 'rba' in partial) delete next.rt;   // an explicit ribbon string beats the live per-tier array
      if ('tp' in partial) delete next.sh;               // likewise an explicit shape string
      if ('fct' in partial) delete next.fcs;             // an explicit per-tier fondant string
      if ('frt' in partial) delete next.frs;             // an explicit per-tier buttercream string
      if ('frst' in partial || 'fr' in partial) delete next.frsty;   // explicit style (per tier, or whole cake)
      if ('fdt' in partial || 'fd' in partial) delete next.fds;      // explicit fondant (per tier, or whole cake)
      if ('fc' in partial && !('fct' in partial)) { delete next.fcs; delete next.frs; }   // a plain fc recolours every tier
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
    get tierGroups() { return tierGroups; },
    ao: AO,
    __tierAt: function (x, y) { return tierAt(x, y); }, __tm: function (i) { var t=tierTops(config)[i]; var TM=tierMaterials(config, t); return { frosting: TM.frosting.toString(16), hasBase: !!TM.base, style: TM.style, fdOn: TM.fdOn, msgTier: messageMesh && messageMesh.__tier ? messageMesh.__tier.idx : null }; }, __setCurTier: function (i, c) { return setCurTier(i, c); }, __pulse: function (i) { return pulseTier(i); },
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

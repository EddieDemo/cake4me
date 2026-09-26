/* theme.js — a whole cake's colours, as one THEME (v1.34), in OKLCH (oklch.js).
   Used by Shuffle, and by "Theme from this colour" in the picker.
   A theme starts from one BASE colour — given (the picker), one of an emoji topper's own colours
   (emoji/index.js), or random — and a STRATEGY for the rest:
     mono        one hue family: the tiers an ombré, the ribbon a deep shade of the same
     analogous   neighbours: accents ~30° either side
     complement  the opposite hue as the accent
     triad       three hues, 120° apart
     neutral     a quiet, near-white icing with one vivid accent
     emoji       the emoji's own other colours as the accents
   Shades follow Eddie's pixel-art RAMP: as a colour darkens its chroma rises and its hue bends
   towards violet; as it lightens its hue bends towards yellow — so tiers and ribbons feel alive,
   not just greyed. Rules: the backdrop stays quiet (low chroma) and always stands clear of the
   cake; no muddy icing (mid-light and greyish); sponge and filling stay food-real mostly (presets),
   now and then theme-tinted. The writing picks dark or light itself (body.js), so it's always legible.
   API (window.CakeTheme): make(opts) → { strategy, icing: [hex per tier, bottom first], ribbon,
     candles, topper (hex | null = match the candles), backdrop, sponge (hex | null), filling (hex | null) }
     opts: tiers, base (hex), anchor (the role `base` is for: 'icing' default, 'ribbon', 'candles',
     'topper', 'backdrop', …), palette ([hex] from an emoji), baked (no icing), cakeHex (what the
     backdrop must stand clear of on a baked cake), strategy (force one), rng. */
(function () {
  var O = window.CakeOklch, TAU = 360;
  function wrap(h) { return ((h % TAU) + TAU) % TAU; }
  function toward(h, target, amt) { var d = ((target - h + 540) % 360) - 180; return h + Math.max(-amt, Math.min(amt, d)); }
  function lab(c) { var r = c[2] * Math.PI / 180; return [c[0], c[1] * Math.cos(r), c[1] * Math.sin(r)]; }
  function dist(a, b) { var p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
  // The ramp: t from −1 (lightest) to +1 (darkest).
  function shade(c, t, dL) {
    var L = c[0] - t * (dL || 0.2), C = c[1] * (1 + 0.35 * t);
    var h = t < 0 ? toward(c[2], 95, -t * 18) : toward(c[2], 285, t * 18);
    return [Math.min(0.97, Math.max(0.12, L)), Math.max(0, C), wrap(h)];
  }
  function unmuddy(c) {                                    // mid-light and greyish reads as mud: lift it
    if (c[0] > 0.4 && c[0] < 0.68 && c[1] < 0.075) return [0.74, Math.max(c[1], 0.05), c[2]];
    return c;
  }
  function hex(c) { return O.toHex(c[0], c[1], wrap(c[2])); }
  function make(o) {
    o = o || {};
    var rnd = o.rng || Math.random;
    function pick(a) { return a[Math.floor(rnd() * a.length)]; }
    function range(a, b) { return a + rnd() * (b - a); }
    function rot(c, d, minC) { return [c[0], Math.max(c[1], minC || 0.08), wrap(c[2] + d)]; }
    var n = Math.max(1, o.tiers || 1), anchor = o.anchor || 'icing';
    var pal = (o.palette || []).map(function (h) { return O.fromHex(parseInt(h, 16)); });
    var usable = pal.filter(function (c) { return c[1] > 0.04 && c[0] > 0.35 && c[0] < 0.97; });
    var given = o.base != null ? O.fromHex(o.base) : null, base;
    if (given) base = given;
    else if (usable.length) { var w = [0.4, 0.3, 0.2, 0.1], x = rnd() * w.slice(0, usable.length).reduce(function (a, b) { return a + b; }, 0), i = 0; while (i < usable.length - 1 && x > w[i]) { x -= w[i]; i++; } base = usable[i]; }
    else base = [range(0.62, 0.9), range(0.05, 0.15), rnd() * TAU];
    // The base belongs to one role. When that's not the icing, the icing is found from it.
    if (given && anchor !== 'icing' && anchor !== 'sponge' && anchor !== 'filling' && anchor !== 'writing') {
      if (anchor === 'backdrop') base = given[0] > 0.6 ? [range(0.55, 0.78), range(0.08, 0.14), wrap(given[2] + pick([0, 30, -30, 180]))]
                                                      : [range(0.82, 0.92), range(0.05, 0.1), wrap(given[2] + pick([0, 30, -30, 180]))];
      else base = [Math.max(0.8, given[0]), given[1] * 0.45, wrap(given[2] + pick([0, 0, 30, -30, 180]))];
    }
    var strategy = o.strategy || (usable.length && !given && rnd() < 0.75 ? 'emoji'
                 : pick(['mono', 'mono', 'analogous', 'analogous', 'complement', 'triad', 'neutral', 'neutral']));
    var acc;                                               // [ribbon's colour, candles' colour], before shading
    if (strategy === 'emoji') {
      var others = pal.filter(function (c) { return c !== base && dist(c, base) > 0.06; });
      acc = [others[0] || rot(base, 180), others[1] || others[0] || rot(base, 150)];
    } else if (strategy === 'mono') acc = [base, base];
    else if (strategy === 'analogous') { var sg = rnd() < 0.5 ? 1 : -1; acc = [rot(base, 32 * sg), rot(base, -28 * sg)]; }
    else if (strategy === 'complement') acc = [rot(base, 180), rot(base, 180 + pick([20, -20]))];
    else if (strategy === 'triad') acc = [rot(base, 120), rot(base, -120)];
    else acc = [rot(base, 0, 0.1), rot(base, 20, 0.12)];                                  // neutral: the base, vivid, as the accent
    // Icing: an ombré up the tiers, lightest at the top (now and then at the bottom).
    var iceBase = strategy === 'neutral' ? [range(0.88, 0.95), range(0.012, 0.03), wrap(base[2] + range(-10, 10))] : base;
    var span = strategy === 'mono' ? 0.7 : 0.45, up = rnd() < 0.75, icing = [];
    for (var t = 0; t < n; t++) {
      var k = n === 1 ? 0 : t / (n - 1) * 2 - 1;          // −1 bottom … +1 top
      icing.push(unmuddy(shade(iceBase, (up ? -k : k) * span, 0.16)));
    }
    icing = icing.map(function (c) { return O.fromHex(hex(c)); });   // as a screen will show them: every check below measures what's really seen
    // Ribbon: a deeper shade of its accent, and always clear of the icing it's tied round.
    var rib = O.fromHex(hex(shade(acc[0], strategy === 'mono' ? 0.85 : 0.5)));
    for (var g = 0; g < 3 && dist(rib, icing[0]) < 0.08; g++) rib = O.fromHex(hex(shade(rib, 0.5)));
    // Candles: lighter and vivid. They and a number topper stand on the top tier, so they must stand
    // apart from its icing: if they'd blend in (one hue family, say), they step along the ramp —
    // deeper on a light icing, lighter on a dark one.
    var topIce = icing[n - 1];
    function apart(c) {
      c = O.fromHex(hex(c));
      for (var z = 0; z < 5 && dist(c, topIce) < 0.1; z++) c = O.fromHex(hex(shade(c, topIce[0] > 0.62 ? 0.55 : -0.55)));
      return c;
    }
    var cand = apart([Math.min(0.86, Math.max(0.7, acc[1][0])), Math.max(acc[1][1], 0.11), acc[1][2]]);
    var topper = rnd() < 0.5 ? null : apart([Math.min(0.84, Math.max(0.62, acc[0][0])), Math.max(acc[0][1], 0.12), acc[0][2]]);
    // Backdrop: quiet, and clear of the cake (the icing, or a baked cake's crust).
    var ref = o.cakeHex != null ? O.fromHex(o.cakeHex) : icing[0], bh = wrap(base[2] + (rnd() < 0.5 ? 0 : 180));
    var tries = rnd() < 0.12 ? [[0.24, 0.03], [0.95, 0.016]] : [[0.95, 0.016], [0.9, 0.03], [0.84, 0.035], [0.24, 0.03]], bg = null;
    for (var q = 0; q < tries.length && !bg; q++) {
      var cnd = [tries[q][0], tries[q][1], bh];
      if (dist(cnd, ref) >= 0.09) bg = cnd;                // the cake's own shading and shadow do the rest (white icing on cream reads fine)
    }
    if (!bg) {                                             // none fits: whichever stands furthest from the cake
      [[0.97, 0.008], [0.93, 0.02], [0.2, 0.025], [0.12, 0.015]].forEach(function (x) {
        var cnd = [x[0], x[1], bh]; if (!bg || dist(cnd, ref) > dist(bg, ref)) bg = cnd;
      });
    }
    var out = {
      strategy: strategy, icing: icing.map(hex), ribbon: hex(rib), candles: hex(cand), topper: topper ? hex(topper) : null, backdrop: hex(bg),
      sponge: rnd() < (o.baked ? 0.2 : 0.1) ? hex([range(0.78, 0.88), Math.min(0.1, Math.max(0.05, base[1] * 0.7)), base[2]]) : null,
      filling: rnd() < 0.3 ? hex([0.72, 0.1, acc[0][2]]) : null
    };
    // The given colour stays exactly itself in its own role.
    if (given) {
      var gx = o.base;
      if (anchor === 'icing') out.icing = out.icing.map(function (h, i) { return i === 0 || n === 1 ? gx : h; });
      else if (anchor === 'ribbon') out.ribbon = gx; else if (anchor === 'candles') out.candles = gx;
      else if (anchor === 'topper') out.topper = gx; else if (anchor === 'backdrop') out.backdrop = gx;
      else if (anchor === 'sponge') out.sponge = gx; else if (anchor === 'filling') out.filling = gx;
    }
    return out;
  }
  window.CakeTheme = { make: make, shade: function (hx, t) { return hex(shade(O.fromHex(hx), t)); } };
})();

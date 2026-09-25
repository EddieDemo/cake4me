/* schema.js — the cake's contract (v1.06, refactor step 2).
   One place that knows every field a cake has, its limits and defaults, how older links map onto
   today's fields (normalize is the migration layer), and how a cake becomes a link and back.
   Links come in two formats:
     v1 — the original positional list (39 fields in a fixed order). Decoded forever.
     v2 — named fields, `2|key=value|…`, only the ones that differ from the default. Written from
          v1.06 on: shorter, self-describing, and a new field can't shift the ones after it.
   Everything else in the app reads its config from normalize() and never parses a link itself. */
(function () {
  var PALETTES = CakePalettes.PALETTES, OCCASIONS = CakePalettes.OCCASIONS, SPONGES = CakePalettes.SPONGES, SC_TO_SP = CakePalettes.SC_TO_SP, TIERS = CakePalettes.TIERS, SHAPE = CakePalettes.SHAPE;
  var MAX_CANDLES = 100;          // what a LINK may carry (old gifts keep their count)
  var RIBBON = { steps: 8 };
  // shape steps ↔ world sizes (the builder's sliders and the classic tier sizes share these)
  function rToStep(r) { return Math.round((r - SHAPE.rMin) / (SHAPE.rMax - SHAPE.rMin) * (SHAPE.steps - 1)); }
  function hToStep(h) { return Math.round((h - SHAPE.hMin) / (SHAPE.hMax - SHAPE.hMin) * (SHAPE.steps - 1)); }
  function stepToR(st) { return SHAPE.rMin + (SHAPE.rMax - SHAPE.rMin) * clampInt(st, 0, SHAPE.steps - 1, 0) / (SHAPE.steps - 1); }
  function stepToH(st) { return SHAPE.hMin + (SHAPE.hMax - SHAPE.hMin) * clampInt(st, 0, SHAPE.steps - 1, 0) / (SHAPE.steps - 1); }
  function classicShape(t) { return (TIERS[t] || TIERS[1]).map(function (x) { return { r: rToStep(x.r), h: hToStep(x.h) }; }); }          // ribbon width steps (the geometry's RIBBON in app.js agrees)
  var SCHEMA_VERSION = 1;
  var MAX_MSG = 80;
  var MAX_NAME = 24;
  var DEFAULTS = { v: SCHEMA_VERSION, to: '', from: '', m: '', n: 1, t: 1, fc: 0, ic: 0, cc: 0, bg: 1, rc: 0, tc: 0, o: 0, lt: '', ly: 3, fr: 1, rb: 2 };
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
  function serializeRibbons(rt) {
    return rt.map(function (t) { return (t.on ? '1' : '0') + String(t.c % 10) + String(t.w % 10); }).join('');
  }
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
  function clampIndex(i, arr) {
    i = i | 0;
    return i < 0 || i >= arr.length ? 0 : i;
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
      cs: clampInt(c.cs, 0, 7, 0),
      sk: clampInt(c.sk, 0, 2, 0),
      sa: clampInt(c.sa, 0, 10, 0),         // hundreds and thousands (v1.00): 0 none … 10 fully covered
      spal: clampInt(c.spal, 0, 2, 0),      // their colours: 0 rainbow · 1 pastel · 2 gold
      sr: clampInt(c.sr, 0, 999, 0),        // the roll: which arrangement
      lp: clampInt(c.lp, 0, 4, 0),          // light preset (v1.14): Daylight · Warm · Cool · Low sun · Overhead — travels with the cake now
      lj: clampInt(c.lj, 0, 99, 0),         // the generator's small nudge to that preset, as a seed (0 = none), so the recipient sees the same light          // sparklers (v0.99): 0–2, alongside candles or numbers          // candle style (v0.98): 0 classic … 6 tapered · 7 all, mixed
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
                 c.n, c.t, c.fc, c.ic, c.cc, c.bg, c.rc, c.tc, c.o, c.lt, c.ly, c.fr, c.rb, c.rbt, c.tp, c.fct, c.fd, c.frt, c.frst, c.fdt, c.sc, c.ff, c.rbp, c.bk, c.rk, c.sp, c.sd, c.rm, c.rba, c.cm, c.age, c.cs, c.sk, c.sa, c.spal, c.sr];
    return b64url(parts.join('|'));
  }
  function decodeConfig(code) {
    try {
      var p = unb64url(code).split('|');
      if ((p[0] | 0) < 1) return null;
      var dec = function (s) { try { return decodeURIComponent(s || ''); } catch (e) { return ''; } };
      return normalize({ to: dec(p[1]), from: dec(p[2]), m: dec(p[3]), n: p[4], t: p[5],
                         fc: p[6], ic: p[7], cc: p[8], bg: p[9], rc: p[10], tc: p[11], o: p[12], lt: p[13], ly: p[14], fr: p[15], rb: p[16], rbt: p[17], tp: p[18], fct: p[19], fd: p[20], frt: p[21], frst: p[22], fdt: p[23], sc: p[24], ff: p[25], rbp: p[26], bk: p[27], rk: p[28], sp: p[29], sd: p[30], rm: p[31], rba: p[32], cm: p[33], age: p[34], cs: p[35], sk: p[36], sa: p[37], spal: p[38], sr: p[39] });
    } catch (e) { return null; }
  }
  // ---- v2: named fields ----
  var V2_FIELDS = ['to', 'from', 'm', 'n', 't', 'fc', 'ic', 'cc', 'bg', 'rc', 'tc', 'o', 'lt', 'ly', 'fr', 'rb', 'rbt', 'tp', 'fct', 'fd', 'frt', 'frst', 'fdt', 'sc', 'ff', 'rbp', 'bk', 'rk', 'sp', 'sd', 'rm', 'rba', 'cm', 'age', 'cs', 'sk', 'sa', 'spal', 'sr', 'lp', 'lj'];
  var V2_DEFAULT = null;
  function v2Default() { if (!V2_DEFAULT) V2_DEFAULT = normalize({}); return V2_DEFAULT; }
  function encodeV2(c) {
    c = normalize(c);
    var d = v2Default(), parts = ['2'];
    V2_FIELDS.forEach(function (k) {
      var v = c[k]; if (v === undefined || v === null) return;
      if (String(v) === String(d[k])) return;                       // only what differs from the default
      parts.push(k + '=' + encodeURIComponent(String(v)));
    });
    return b64url(parts.join('|'));
  }
  function decodeAny(code) {
    try {
      var raw = unb64url(code), p = raw.split('|');
      if (p[0] === '2') {
        var o = {};
        p.slice(1).forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) { var k = kv.slice(0, i); if (V2_FIELDS.indexOf(k) >= 0) { try { o[k] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { o[k] = ''; } } } });
        return normalize(o);
      }
      return decodeConfig(code);                                     // v1, positional
    } catch (e) { return null; }
  }
  // Merging a partial change into a config: an explicit whole-cake string beats the live
  // per-tier array it would otherwise be reconstructed from (v1.16, from app.js's set()).
  function merge(base, partial) {
    var next = {};
    for (var k in base) next[k] = base[k];
    for (var j in partial) next[j] = partial[j];
    if ('rbt' in partial || 'rbp' in partial || 'rba' in partial) delete next.rt;
    if ('tp' in partial) delete next.sh;
    if ('fct' in partial) delete next.fcs;
    if ('frt' in partial) delete next.frs;
    if ('frst' in partial || 'fr' in partial) delete next.frsty;
    if ('fdt' in partial || 'fd' in partial) delete next.fds;
    if ('fc' in partial && !('fct' in partial)) { delete next.fcs; delete next.frs; }
    return next;
  }
  window.CakeSchema = {
    merge: merge,
    SCHEMA_VERSION: SCHEMA_VERSION, MAX_MSG: MAX_MSG, MAX_NAME: MAX_NAME, MAX_CANDLES: MAX_CANDLES, DEFAULTS: DEFAULTS,
    normalize: normalize, encode: encodeV2, encodeV1: encodeConfig, decode: decodeAny,
    clampInt: clampInt, clampIndex: clampIndex, cleanText: cleanText,
    parseRibbons: parseRibbons, serializeRibbons: serializeRibbons, constrainShape: constrainShape, parseShape: parseShape, serializeShape: serializeShape,
    rToStep: rToStep, hToStep: hToStep, stepToR: stepToR, stepToH: stepToH, classicShape: classicShape,
    fields: V2_FIELDS.slice()
  };
})();

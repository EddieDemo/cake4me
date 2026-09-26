/* oklch.js — OKLCH colour maths (v1.32): the colour picker now, the palette generator later.
   OKLCH is lightness (0–1), chroma (0 grey … ~0.37 at its most vivid) and hue (degrees). Its
   lightness is honest — two colours at the same L really do look equally light — which keeps the
   picker and the generator's ramps well behaved. Colours stay as sRGB hex ints everywhere else.
   API (window.CakeOklch):
     fromHex(0xRRGGBB) → [L, C, h]         toHex(L, C, h) → 0xRRGGBB (clipped into sRGB)
     rgb(L, C, h) → [r, g, b] 0–255 or null when a screen can't show it
     inGamut(L, C, h)                       maxChroma(L, h) → the most vivid C a screen can show there
     crustOf(crumbHex) → the sponge's baked crust for that crumb (see below) */
(function () {
  function toLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function toSrgb(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function fromHex(hex) {
    var r = toLin(hex >> 16 & 255), g = toLin(hex >> 8 & 255), b = toLin(hex & 255);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    var L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    var A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    var B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    var h = Math.atan2(B, A) * 180 / Math.PI; if (h < 0) h += 360;
    return [L, Math.hypot(A, B), h];
  }
  function linear(L, C, h) {                               // OKLCH → linear sRGB (may fall outside 0–1)
    var hr = h * Math.PI / 180, A = C * Math.cos(hr), B = C * Math.sin(hr);
    var l = L + 0.3963377774 * A + 0.2158037573 * B, m = L - 0.1055613458 * A - 0.0638541728 * B, s = L - 0.0894841775 * A - 1.2914855480 * B;
    l *= l * l; m *= m * m; s *= s * s;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  var EPS = 1e-4;
  function inGamut(L, C, h) { var c = linear(L, C, h); return c[0] >= -EPS && c[0] <= 1 + EPS && c[1] >= -EPS && c[1] <= 1 + EPS && c[2] >= -EPS && c[2] <= 1 + EPS; }
  function maxChroma(L, h) {
    if (L <= 0 || L >= 1) return 0;
    var lo = 0, hi = 0.4;
    for (var i = 0; i < 18; i++) { var mid = (lo + hi) / 2; if (inGamut(L, mid, h)) lo = mid; else hi = mid; }
    return lo;
  }
  function rgb(L, C, h) {
    if (!inGamut(L, C, h)) return null;
    return linear(L, C, h).map(function (c) { return Math.round(255 * toSrgb(Math.min(1, Math.max(0, c)))); });
  }
  function toHex(L, C, h) {
    L = Math.min(1, Math.max(0, L)); C = Math.min(Math.max(0, C), maxChroma(L, h));
    var c = linear(L, C, h).map(function (v) { return Math.round(255 * toSrgb(Math.min(1, Math.max(0, v)))); });
    return (c[0] << 16) | (c[1] << 8) | c[2];
  }
  // A sponge's crust, from its crumb — fitted to the nine sponge presets (v1.32). Darker (×0.74),
  // chroma up for pale crumbs and down for vivid ones, and the hue bent the way baking goes: from
  // yellows and greens down towards orange-brown (up to 30°), a touch from the other side (up to 12°,
  // so a blue sponge's crust leans violet — the pixel artist's shading direction).
  function crustOf(crumb) {
    var o = fromHex(crumb), L = o[0], C = o[1], h = C < 0.02 ? 70 : o[2];
    var d = ((50 - h + 540) % 360) - 180;
    h += d < 0 ? Math.max(-30, 0.75 * d) : Math.min(12, 0.1 * d);
    return toHex(L * 0.74, Math.max(0, 0.734 * C + 0.152 * L - 0.078), (h + 360) % 360);
  }
  window.CakeOklch = { fromHex: fromHex, toHex: toHex, rgb: rgb, inGamut: inGamut, maxChroma: maxChroma, crustOf: crustOf };
})();

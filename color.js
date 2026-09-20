/* =====================================================================
   color.js — colour management for three.js r128.

   Later versions of three ship ColorManagement: a hex or CSS colour handed
   to THREE.Color is understood as sRGB (what a swatch, a designer and a
   screen mean by "#FFC6D9") and converted to linear light for shading;
   reading it back converts to sRGB again. r128 has none of that: it takes
   the hex as if it were already linear, and because the output stage then
   converts linear→sRGB, every plain-coloured surface renders lighter and
   less saturated than its hex — while sRGB-encoded textures, which ARE
   decoded, render true. That is why a plain-coloured sponge top sat next
   to a textured sponge side in two different tans.

   This file gives r128 the later behaviour, so a swatch and its surface
   agree everywhere, textures and plain colours match, and every site in
   the app that turns a hex into a Color is correct without being touched.

   Rules after loading this:
     - setHex / setStyle / set(number|string) / new Color(hex|css): sRGB in
     - getHex / getHexString / getStyle: sRGB out
     - setRGB / setHSL / copy / lerp / multiply: LINEAR, unchanged
     - luminance computed from .r .g .b is linear luminance — thresholds
       written against sRGB values must be re-expressed (see app.js)
   Load before any other script that creates a Color.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { console.warn('color.js: THREE not loaded'); return; }
  var P = THREE.Color.prototype;
  if (P.__managed) return;

  var _setHex = P.setHex, _setStyle = P.setStyle, _getHex = P.getHex, _getHexString = P.getHexString, _getStyle = P.getStyle;

  P.setHex = function (hex) { _setHex.call(this, hex); return this.convertSRGBToLinear(); };
  P.setStyle = function (style) { _setStyle.call(this, style); return this.convertSRGBToLinear(); };
  // Color.set() dispatches to setHex/setStyle/copy internally, so it's covered.

  var _tmp = null;
  function srgbCopy(c) { _tmp = _tmp || new THREE.Color(); _tmp.r = c.r; _tmp.g = c.g; _tmp.b = c.b; return _tmp.convertLinearToSRGB(); }
  P.getHex = function () { return _getHex.call(srgbCopy(this)); };
  P.getHexString = function () { return _getHexString.call(srgbCopy(this)); };
  P.getStyle = function () { return _getStyle.call(srgbCopy(this)); };

  // sRGB→linear for a single 0..1 channel or a luminance threshold written in sRGB terms.
  THREE.Color.srgbToLinear = function (v) { return v < 0.04045 ? v * 0.0773993808 : Math.pow(v * 0.9478672986 + 0.0521327014, 2.4); };
  THREE.Color.linearToSRGB = function (v) { return v < 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 0.41666) - 0.055; };

  P.__managed = true;
})();

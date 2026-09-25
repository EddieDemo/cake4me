/* message.js — the writing on the cake (v1.10, refactor step 5).
   texture(text, ink, frostingHex, radius, bodyH, base, ownCanvas) → a CanvasTexture wrapped round
   the tier's side, the text on the BACK (θ = π), fitted and wrapped to ~34% of the circumference;
   lastSpan() → where the writing is (fractions of circumference and height), so sprinkles keep
   clear of it. One persistent canvas is redrawn for every live band (allocating 16MB per drag
   step is what used to make Safari reload). */
(function () {
  var lastSpan = null, renderer = null;
  function init(r) { renderer = r; }
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
  function hexCss(hex) { return '#' + ('000000' + hex.toString(16)).slice(-6); }
    var msgCanvas = null;
    // `base` (optional): function(ctx, W, H) painting what's under the writing — the sponge
    // stripes on a naked cake, the frosting scrape on a semi-naked one. Flat frosting otherwise.
    // `ownCanvas`: paint into a fresh canvas instead of the shared one. The warm-up compile uses
    // this — otherwise its placeholder band overwrote the shared canvas, and any texture that
    // later re-uploaded from it (a wedge's clone) wore the word "warm".
    function makeMessageTexture(text, ink, frostingHex, radius, bodyH, base, ownCanvas) {
      text = String(text).slice(0, CakeSchema.MAX_MSG);
      var circumference = 2 * Math.PI * radius;
      // The message is the thing people zoom into, so size its canvas off the real
      // device ratio rather than a fixed number. The texture is short (a thin band
      // round the cylinder), so even 4096 wide costs little memory.
      var W = (window.devicePixelRatio || 1) >= 2 ? 4096 : 2048;
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
      var widest = 0; fit.lines.forEach(function (ln) { widest = Math.max(widest, g.measureText(ln).width); });
      lastSpan = { w: widest / W, h: blockH / H };          // so the sprinkles can leave the writing clear
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
  window.CakeMessage = { init: init, texture: makeMessageTexture, lastSpan: function () { return lastSpan; } };
})();

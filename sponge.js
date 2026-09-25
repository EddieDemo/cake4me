/* sponge.js — the sponge's layers and its cut faces (v1.11, refactor step 5).
   create(deps) → { layerScheme(tierH, spongeLayers), paintLayers(g, W, H, layers, scheme, span),
                    makeCutFaceTexture(layers, scheme, tier, frostingHex, thick) }
   layerScheme: where the sponge layers and fillings sit up a tier of a given height;
   paintLayers: paints them as stripes (the base of a naked tier's message band, and the cut face);
   makeCutFaceTexture: a slice's cut face — sponge, fillings, and the frosting round the edge.
   deps: FILL_T(), spongeColour() (the crust colour of the cake being built), hexCss */
(function () {
  function create(deps) {
    function layerScheme(tierH, spongeLayers) {
      var n = Math.max(1, Math.min(4, spongeLayers | 0)), fills = [];
      var spongeT = (tierH - (n - 1) * deps.FILL_T()) / n;
      for (var i = 1; i < n; i++) { var y0 = i * spongeT + (i - 1) * deps.FILL_T(); fills.push([y0, y0 + deps.FILL_T()]); }
      return { n: n, spongeT: spongeT, fillT: deps.FILL_T(), fills: fills, h: tierH };
    }
    function paintLayers(g, W, H, layers, scheme, span) {
      g.fillStyle = deps.hexCss(deps.spongeColour());
      g.fillRect(0, 0, W, H);
      scheme.fills.forEach(function (fb, i) {
        var top = H * (1 - fb[1] / span), bottom = H * (1 - fb[0] / span);   // canvas y runs down
        g.fillStyle = deps.hexCss(layers[i % layers.length]);
        g.fillRect(0, top, W, bottom - top);
      });
      g.fillStyle = 'rgba(120,80,30,0.08)';                  // crumb
      var n = Math.round(W * H / 160);
      for (var k = 0; k < n; k++) g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    function makeCutFaceTexture(layers, scheme, tier, frostingHex, thick) {
      var W = 256, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d');
      if (thick) {
        g.fillStyle = deps.hexCss(frostingHex); g.fillRect(0, 0, W, H);
        var sw = W * (tier.rs / tier.r), sh = H * (tier.hs / tier.h);
        g.save(); g.beginPath(); g.rect(0, H - sh, sw, sh); g.clip();
        // sponge stripes laid out over the sponge's own height, inside the frosting
        g.translate(0, H - sh); paintLayers(g, sw, sh, layers, scheme, tier.hs); g.restore();
      } else {
        paintLayers(g, W, H, layers, scheme, tier.h);
      }
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    }
    return { layerScheme: layerScheme, paintLayers: paintLayers, makeCutFaceTexture: makeCutFaceTexture };
  }
  window.CakeSponge = { create: create };
})();

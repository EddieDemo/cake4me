/* rig.js — the LIGHTING RIG (v1.39): one description of the light, seen the same way by every material.
   A lighting preset used to be only lights: a sky-and-ground (hemisphere) light, a key, a fill, a
   spot, the candles. Those light a surface but give a shiny one nothing to reflect, so metal later got
   an imaginary studio of its own — two lighting worlds in one scene. The rig makes the SURROUNDINGS
   part of the light: a picture of the room all round the cake, painted from the same values as the
   lights, and given to every standard material (scene.environment):
   - the sky colour above the horizon and the ground colour below, at the hemisphere light's strength.
     A split sky/ground picture lights a surface exactly as a hemisphere light does (the share of sky
     a surface sees is (1 + cos θ)/2 either way), so it REPLACES the hemisphere light — the room looks
     as it did, but now it's something shiny things can reflect;
   - the key, the fill and the spot, painted where they really are, in their colours, as compact
     glowing shapes: small enough to add almost nothing to the room's light (the real lights still
     do that, and cast the shadows) but bright enough to be what a glossy surface reflects.
   So the gleams on anything shiny agree with the lights and shadows, under every preset.
   The candles stay real point lights only (they flicker every frame).
   API (window.CakeRig): create(renderer) → { update(state) → texture | null, texture() }
     state: { sky, ground (THREE.Color, linear, × intensity), lights: [{ dir (Vector3 towards the
     light), colour (THREE.Color × intensity), size (angular radius, degrees) }] } */
(function () {
  var W = 512, H = 256;
  function create(renderer) {
    var rt = null, lastKey = null;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    function toS(v) { v = Math.max(0, v); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
    function css(col, k, a) {                              // a linear colour → an sRGB canvas colour (clipped at 1)
      return 'rgba(' + [col.r, col.g, col.b].map(function (v) { return Math.round(255 * Math.min(1, toS(v * k))); }).join(',') + ',' + (a == null ? 1 : a) + ')';
    }
    function at(dir) {                                     // a direction → its spot on the equirectangular picture (three's own mapping)
      var d = dir.clone().normalize();
      return { x: (Math.atan2(d.z, d.x) / (2 * Math.PI) + 0.5) * W, y: (0.5 - Math.asin(Math.max(-1, Math.min(1, d.y))) / Math.PI) * H, el: Math.asin(d.y) };
    }
    function paint(st) {
      g.clearRect(0, 0, W, H);
      var gr = g.createLinearGradient(0, 0, 0, H);         // sky above, ground below: a hemisphere light, as a picture
      if (st.seen) {
        // v1.40: and round the horizon, what's really there — the backdrop as you see it, the lit floor
        // running away into the sky. It's what upright shiny surfaces (the numbers' faces) look at.
        // Straight up stays the room's sky light; straight down the dimmer bounce (under the cake is in
        // its shadow).
        gr.addColorStop(0, css(st.sky, 1)); gr.addColorStop(0.3, css(st.sky, 1));
        gr.addColorStop(0.42, css(st.seen, 1)); gr.addColorStop(0.58, css(st.seen, 1));
        gr.addColorStop(0.72, css(st.ground, 1)); gr.addColorStop(1, css(st.ground, 1));
      } else {
        gr.addColorStop(0, css(st.sky, 1)); gr.addColorStop(0.49, css(st.sky, 1));
        gr.addColorStop(0.51, css(st.ground, 1)); gr.addColorStop(1, css(st.ground, 1));
      }
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      if (st.glow) {                                       // v1.40: the cake glowing in its candlelight — below the horizon only,
        var gw = g.createLinearGradient(0, H * 0.5, 0, H * 0.76);   // where it is from the numbers' point of view
        gw.addColorStop(0, css(st.glow, 1)); gw.addColorStop(1, css(st.glow, 1, 0));
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gw; g.fillRect(0, H * 0.5, W, H * 0.26); g.restore();
      }
      (st.lights || []).forEach(function (L) {             // each light where it really is, a soft-edged glow
        if (!L || L.colour.r + L.colour.g + L.colour.b <= 0) return;
        var p = at(L.dir), ry = (L.size || 8) / 180 * H, rx = Math.min(W / 2, ry / Math.max(0.2, Math.cos(p.el)));
        if (L.box) {                                       // v1.41: a softbox or a strip — a hard-edged panel, as a studio's lights look
          var m0 = Math.max(L.colour.r, L.colour.g, L.colour.b), c0 = L.colour.clone().multiplyScalar(Math.min(1, m0 * (L.gain || 2)) / m0);
          var bw = L.box[0] / 360 * W / Math.max(0.2, Math.cos(p.el)), bh = L.box[1] / 180 * H;
          [-W, 0, W].forEach(function (off) {
            g.fillStyle = css(c0, 1, 0.35); g.fillRect(p.x + off - bw / 2 - 2, p.y - bh / 2 - 2, bw + 4, bh + 4);   // a little feather
            g.fillStyle = css(c0, 1, L.core); g.fillRect(p.x + off - bw / 2, p.y - bh / 2, bw, bh);
          });
          return;
        }
        // its hue, as bright as the light is strong (so a night room's lights glow dimmer), capped at white
        var m = Math.max(L.colour.r, L.colour.g, L.colour.b), col = L.colour.clone().multiplyScalar(Math.min(1, m * (L.gain || 2)) / m);
        [-W, 0, W].forEach(function (off) {                // wrap round the seam
          g.save(); g.translate(p.x + off, p.y); g.scale(rx / ry, 1);
          var rg = g.createRadialGradient(0, 0, 0, 0, 0, ry);
          rg.addColorStop(0, css(col, 1, L.core)); rg.addColorStop(0.6, css(col, 1, L.core * 0.85)); rg.addColorStop(1, css(col, 1, 0));
          g.fillStyle = rg; g.beginPath(); g.arc(0, 0, ry, 0, Math.PI * 2); g.fill(); g.restore();
        });
      });
    }
    function keyOf(st) {
      var f = function (col) { return col.r.toFixed(3) + ',' + col.g.toFixed(3) + ',' + col.b.toFixed(3); };
      return f(st.sky) + '|' + f(st.ground) + '|' + (st.seen ? f(st.seen) : '-') + '|' + (st.glow ? f(st.glow) : '-') + '|' + (st.lights || []).map(function (L) {
        return L ? L.dir.x.toFixed(2) + L.dir.y.toFixed(2) + L.dir.z.toFixed(2) + f(L.colour) + L.size + L.core + (L.box ? 'b' + L.box.join('x') : '') : '-';
      }).join('|');
    }
    function update(st) {
      var k = keyOf(st); if (k === lastKey && rt) return rt.texture;
      paint(st);
      var tex = new THREE.CanvasTexture(c); tex.mapping = THREE.EquirectangularReflectionMapping; tex.encoding = THREE.sRGBEncoding;
      var pm = new THREE.PMREMGenerator(renderer), next = pm.fromEquirectangular(tex);
      tex.dispose(); pm.dispose();
      if (rt) rt.dispose();
      rt = next; lastKey = k;
      return rt.texture;
    }
    return { update: update, texture: function () { return rt ? rt.texture : null; }, canvas: c };
  }
  window.CakeRig = { create: create };
})();

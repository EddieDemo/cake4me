/* =====================================================================
   dev.js — the developer overlay. Only when the URL carries ?dev=1 (or
   #…&dev=1). Never shown to a recipient; app.js doesn't know it exists
   beyond two small hooks (a frame-cap check and a per-frame tick).

   Top left:   current FPS · lowest FPS in the last second · dropped count
   Top right:  target toggle 30 / 45 / 60 — caps the render loop to that
               rate AND defines what counts as a dropped frame.

   While the overlay is on, the adaptive quality ladder is OFF: full pixel
   ratio, 1024 VSM shadows, halo on every candle. Worst case, on purpose,
   so you can see whether the phone holds it.
   ===================================================================== */
(function () {
  'use strict';
  var on = /[?&#]dev=1/.test(location.href);
  var Dev = { on: on, target: 60, shouldRender: function () { return true; }, tick: function () {} };
  window.CakeDev = Dev;
  if (!on) return;

  try { Dev.target = +(localStorage.getItem('cake.dev.fps') || 60) || 60; } catch (e) {}

  // ---- overlay ----
  var css = document.createElement('style');
  css.textContent = [
    '.devfps{position:fixed;top:max(8px,env(safe-area-inset-top));left:8px;z-index:9999;font:600 13px/1.25 -apple-system,system-ui,sans-serif;',
    'color:#fff;background:rgba(20,12,12,.72);padding:6px 9px;border-radius:10px;pointer-events:none;font-variant-numeric:tabular-nums;letter-spacing:.2px}',
    '.devfps b{font-size:20px;display:block}.devfps span{opacity:.8}',
    '.devtgl{position:fixed;top:max(8px,env(safe-area-inset-top));right:8px;z-index:9999;display:flex;gap:2px;background:rgba(20,12,12,.72);border-radius:10px;padding:3px}',
    '.devtgl button{font:600 13px -apple-system,system-ui,sans-serif;color:#fff;background:transparent;border:0;border-radius:8px;padding:6px 10px}',
    '.devtgl button[aria-pressed="true"]{background:#fff;color:#2a1c1c}'
  ].join('');
  document.head.appendChild(css);
  var fps = document.createElement('div'); fps.className = 'devfps';
  fps.innerHTML = '<b id="dev-now">—</b><span>low <em id="dev-low">—</em> · dropped <em id="dev-drop">0</em></span>';
  var tgl = document.createElement('div'); tgl.className = 'devtgl';
  [30, 45, 60].forEach(function (t) {
    var b = document.createElement('button'); b.textContent = t; b.setAttribute('aria-pressed', String(t === Dev.target));
    b.addEventListener('click', function () {
      Dev.target = t; try { localStorage.setItem('cake.dev.fps', t); } catch (e) {}
      Array.prototype.forEach.call(tgl.children, function (x) { x.setAttribute('aria-pressed', String(+x.textContent === t)); });
      dropped = 0;
    });
    tgl.appendChild(b);
  });
  function mount() { document.body.appendChild(fps); document.body.appendChild(tgl); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  // ---- render cap ----
  // rAF fires at the display's rate (120Hz on a ProMotion iPhone). Rendering on every tick
  // attempts 120fps, halving the per-frame budget for nothing anyone asked for. The cap skips
  // ticks so rendering lands at the target rate.
  var lastRender = 0;
  Dev.shouldRender = function (now) {
    var interval = 1000 / Dev.target;
    if (now - lastRender < interval - 1.5) return false;   // small slack so 16.6ms ticks aren't skipped at 60
    lastRender = now;
    return true;
  };

  // ---- measurement (only rendered frames) ----
  var times = [], dropped = 0, lastShown = 0, lastFrame = 0;
  Dev.tick = function (now) {
    if (lastFrame) {
      var dt = now - lastFrame;
      times.push({ t: now, dt: dt });
      var budget = 1000 / Dev.target;
      if (dt > budget * 1.5) dropped++;                     // a frame that took ~2 slots or more
    }
    lastFrame = now;
    while (times.length && now - times[0].t > 1000) times.shift();
    if (now - lastShown < 120 || times.length < 2) return;   // readable, not flickering
    lastShown = now;
    // current: over the last ~10 frames; low: the slowest single frame in the last second
    var n = Math.min(10, times.length), sum = 0;
    for (var i = times.length - n; i < times.length; i++) sum += times[i].dt;
    var cur = 1000 / (sum / n), worst = 0;
    for (var j = 0; j < times.length; j++) worst = Math.max(worst, times[j].dt);
    document.getElementById('dev-now').textContent = Math.round(cur);
    document.getElementById('dev-low').textContent = Math.round(1000 / worst);
    document.getElementById('dev-drop').textContent = dropped;
  };
})();

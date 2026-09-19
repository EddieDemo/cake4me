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
    '.devtgl button[aria-pressed="true"]{background:#fff;color:#2a1c1c}',
    // light-size slider: sits under the target toggle
    '.devlight{position:fixed;top:calc(max(8px,env(safe-area-inset-top)) + 44px);right:8px;z-index:9999;width:190px;',
    'background:rgba(20,12,12,.72);border-radius:10px;padding:7px 10px 8px;font:600 12px -apple-system,system-ui,sans-serif;color:#fff}',
    '.devlight label{display:flex;justify-content:space-between;margin-bottom:4px}.devlight em{font-style:normal;opacity:.85;font-variant-numeric:tabular-nums}',
    '.devlight input{width:100%;margin:0;accent-color:#fff}',
    '.devlight .q{display:flex;gap:2px;margin-top:6px}.devlight .q button{flex:1;font:600 11px -apple-system,system-ui,sans-serif;color:#fff;background:transparent;border:0;border-radius:6px;padding:4px 0}',
    '.devlight .q button[aria-pressed="true"]{background:#fff;color:#2a1c1c}'
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
  // ---- light size (contact-hardening) ----
  // One slider: the light's size is the only physical variable left with a directional light and
  // a fixed shadow camera. It sets how fast a shadow's far edge softens; the near edge is always
  // crisp. maxRadius (the penumbra cap) follows it under the hood so it never clips the effect at
  // small sizes and never lets a far shadow dissolve at large ones. Applied on RELEASE, because the
  // value is baked into the shader and every change recompiles all materials (a brief hitch).
  var light = document.createElement('div'); light.className = 'devlight';
  light.innerHTML = '<label>light size <em id="dev-ls">—</em></label>' +
    '<input type="range" id="dev-ls-in" min="0.1" max="1.5" step="0.05">' +
    '<div class="q" id="dev-q"></div>';
  function lookReady() { return window.CakeLook && window.cake && cake.relook; }
  function syncLight() {
    if (!lookReady()) return;
    var v = CakeLook.LOOK.pcss.lightSize;
    light.querySelector('#dev-ls-in').value = v;
    light.querySelector('#dev-ls').textContent = v.toFixed(2) + (Math.abs(v - 0.6) < 0.001 ? ' (default)' : '');
    Array.prototype.forEach.call(light.querySelectorAll('#dev-q button'), function (b) {
      b.setAttribute('aria-pressed', String(+b.textContent === CakeLook.LOOK.pcss.samples));
    });
  }
  function applyLight(v) {
    if (!lookReady()) return;
    var L = CakeLook.LOOK;
    L.pcss.lightSize = v;
    L.pcss.maxRadius = Math.max(0.012, Math.min(0.07, 0.02 + v * 0.03));   // cap follows size
    L.shadowType = 'PCSS';
    cake.relook();
    syncLight();
  }
  var slider = light.querySelector('#dev-ls-in');
  slider.addEventListener('input', function () { light.querySelector('#dev-ls').textContent = (+slider.value).toFixed(2); });
  slider.addEventListener('change', function () { applyLight(+slider.value); });
  [9, 13, 17].forEach(function (n) {
    var b = document.createElement('button'); b.textContent = n;
    b.addEventListener('click', function () { if (!lookReady()) return; CakeLook.LOOK.pcss.samples = n; cake.relook(); syncLight(); });
    light.querySelector('#dev-q').appendChild(b);
  });

  function mount() {
    document.body.appendChild(fps); document.body.appendChild(tgl); document.body.appendChild(light);
    // app.js exposes `cake` after this script runs; sync once it's there.
    var tries = 0, iv = setInterval(function () { if (lookReady() || ++tries > 50) { clearInterval(iv); syncLight(); } }, 100);
  }
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

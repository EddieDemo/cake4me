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
    '.devlight{position:fixed;top:calc(max(8px,env(safe-area-inset-top)) + 44px);right:8px;z-index:9999;width:200px;',
    'background:rgba(20,12,12,.72);border-radius:10px;padding:7px 10px 8px;font:600 12px -apple-system,system-ui,sans-serif;color:#fff}',
    '.devlight label{display:flex;justify-content:space-between;margin:6px 0 3px}.devlight label:first-child{margin-top:0}',
    '.devlight em{font-style:normal;opacity:.85;font-variant-numeric:tabular-nums}',
    '.devlight input{width:100%;margin:0;accent-color:#fff;display:block}',
    '.devlight .q{display:flex;gap:2px;margin-top:4px;align-items:center}.devlight .q span{font-size:11px;opacity:.75;margin-right:6px}',
    '.devlight .q button{flex:1;font:600 11px -apple-system,system-ui,sans-serif;color:#fff;background:transparent;border:0;border-radius:6px;padding:4px 0}',
    '.devlight .q button[aria-pressed="true"]{background:#fff;color:#2a1c1c}',
    '.devlight .tabs{display:flex;gap:2px;margin:-2px -4px 6px;background:rgba(255,255,255,.08);border-radius:8px;padding:2px}',
    '.devlight .tabs button{flex:1;font:600 12px -apple-system,system-ui,sans-serif;color:#fff;background:transparent;border:0;border-radius:6px;padding:5px 0}',
    '.devlight .tabs button[aria-selected="true"]{background:#fff;color:#2a1c1c}',
    '.devlight section[hidden]{display:none}',
    // a small toggle on the target bar: hides the lighting panel so the cake can be seen
    '.devtgl label{display:flex;align-items:center;gap:5px;padding:0 8px 0 6px;font:600 12px -apple-system,system-ui,sans-serif;color:#fff;border-left:1px solid rgba(255,255,255,.18);margin-left:2px}',
    '.devtgl label input{margin:0;accent-color:#fff;width:14px;height:14px}',
    '.devlight[hidden]{display:none}'
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
  // The panel is the whole lighting rig for a clay render:
  //   ambient  — the room's brightness; floor, cake and sky dim together (live)
  //   key      — the sun/window; sets highlight strength and shadow DEPTH (live)
  //   light size — the softness of the shadow's far edge (on release: recompiles)
  //   samples  — shadow filter quality vs cost (not a look control)
  // Two tabs. Ambient: the room. Key: the window — strength, where it is (elevation, azimuth),
  // how big it is (light size → penumbra) and the shadow filter quality.
  var light = document.createElement('div'); light.className = 'devlight';
  light.innerHTML =
    '<div class="tabs"><button data-tab="amb" aria-selected="true">Ambient</button><button data-tab="key" aria-selected="false">Key</button><button data-tab="spot" aria-selected="false">Spot</button></div>' +
    '<section id="dev-tab-amb">' +
      '<label>ambient <em id="dev-am">—</em></label><input type="range" id="dev-am-in" min="0" max="2" step="0.05">' +
    '</section>' +
    '<section id="dev-tab-key" hidden>' +
      '<label>strength <em id="dev-ky">—</em></label><input type="range" id="dev-ky-in" min="0" max="2" step="0.05">' +
      '<label>elevation <em id="dev-el">—</em></label><input type="range" id="dev-el-in" min="5" max="85" step="1">' +
      '<label>azimuth <em id="dev-az">—</em></label><input type="range" id="dev-az-in" min="-180" max="180" step="5">' +
      '<label>warmth <em id="dev-kk">—</em></label><input type="range" id="dev-kk-in" min="2500" max="9000" step="100">' +
      '<label>light size <em id="dev-ls">—</em></label><input type="range" id="dev-ls-in" min="0.1" max="1.5" step="0.05">' +
      '<div class="q" id="dev-q"><span>samples</span></div>' +
    '</section>' +
    '<section id="dev-tab-spot" hidden>' +
      '<label><span><input type="checkbox" id="dev-sp-on" style="vertical-align:-2px;margin-right:6px">on</span><em id="dev-sp-note">contact-hardened</em></label>' +
      '<label>strength <em id="dev-sp-i">—</em></label><input type="range" id="dev-sp-i-in" min="0" max="6" step="0.1">' +
      '<label>elevation <em id="dev-sp-el">—</em></label><input type="range" id="dev-sp-el-in" min="5" max="89" step="1">' +
      '<label>azimuth <em id="dev-sp-az">—</em></label><input type="range" id="dev-sp-az-in" min="-180" max="180" step="5">' +
      '<label>distance <em id="dev-sp-d">—</em></label><input type="range" id="dev-sp-d-in" min="3" max="20" step="0.5">' +
      '<label>cone <em id="dev-sp-a">—</em></label><input type="range" id="dev-sp-a-in" min="5" max="80" step="1">' +
      '<label>softness <em id="dev-sp-s">—</em></label><input type="range" id="dev-sp-s-in" min="0" max="1" step="0.05">' +
      '<label>warmth <em id="dev-sp-k">—</em></label><input type="range" id="dev-sp-k-in" min="2500" max="9000" step="100">' +
      '<label>light size <em id="dev-sp-ls">—</em></label><input type="range" id="dev-sp-ls-in" min="0.05" max="1.5" step="0.05">' +
    '</section>';
  Array.prototype.forEach.call(light.querySelectorAll('.tabs button'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(light.querySelectorAll('.tabs button'), function (x) { x.setAttribute('aria-selected', String(x === b)); });
      light.querySelector('#dev-tab-amb').hidden = b.dataset.tab !== 'amb';
      light.querySelector('#dev-tab-key').hidden = b.dataset.tab !== 'key';
      light.querySelector('#dev-tab-spot').hidden = b.dataset.tab !== 'spot';
    });
  });
  function lookReady() { return window.CakeLook && window.cake && cake.relook; }
  function fmt(v, def) { return v.toFixed(2) + (Math.abs(v - def) < 0.001 ? ' (default)' : ''); }
  function syncLight() {
    if (!lookReady()) return;
    var L = CakeLook.LOOK, v = L.pcss.lightSize;
    light.querySelector('#dev-ls-in').value = v;
    light.querySelector('#dev-ls').textContent = fmt(v, 0.6);
    light.querySelector('#dev-am-in').value = L.ambientScale;
    light.querySelector('#dev-am').textContent = fmt(L.ambientScale, 1);
    light.querySelector('#dev-ky-in').value = L.keyScale;
    light.querySelector('#dev-ky').textContent = fmt(L.keyScale, 1);
    light.querySelector('#dev-el-in').value = L.keyDir.elevation;
    light.querySelector('#dev-el').textContent = Math.round(L.keyDir.elevation) + '°' + (Math.abs(L.keyDir.elevation - 47.5) < 0.6 ? ' (default)' : '');
    var S = L.spot;
    light.querySelector('#dev-sp-on').checked = !!S.enabled;
    [['i','intensity',1,''],['el','elevation',0,'°'],['az','azimuth',0,'°'],['d','distance',1,''],['a','angle',0,'°'],['s','softness',2,''],['k','kelvin',0,'K'],['ls','lightSize',2,'']].forEach(function (f) {
      light.querySelector('#dev-sp-' + f[0] + '-in').value = S[f[1]];
      light.querySelector('#dev-sp-' + f[0]).textContent = (+S[f[1]]).toFixed(f[2]) + f[3];
    });
    light.querySelector('#dev-kk-in').value = L.keyKelvin;
    light.querySelector('#dev-kk').textContent = L.keyKelvin + 'K' + (L.keyKelvin === 5000 ? ' (default)' : '');
    light.querySelector('#dev-az-in').value = L.keyDir.azimuth;
    light.querySelector('#dev-az').textContent = Math.round(L.keyDir.azimuth) + '°' + (Math.abs(L.keyDir.azimuth + 38.7) < 2.6 ? ' (default)' : '');
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
  // Spot: all live. Turning it on/off recompiles materials (a light that casts shadows is
  // part of every shader's signature) — one brief hitch, the same as toggling shadows.
  light.querySelector('#dev-sp-on').addEventListener('change', function (e) {
    if (!lookReady()) return; CakeLook.LOOK.spot.enabled = e.target.checked; cake.relight(); syncLight();
  });
  [['i','intensity'],['el','elevation'],['az','azimuth'],['d','distance'],['a','angle'],['s','softness'],['k','kelvin']].forEach(function (f) {
    var el = light.querySelector('#dev-sp-' + f[0] + '-in');
    el.addEventListener('input', function () { if (!lookReady()) return; CakeLook.LOOK.spot[f[1]] = +el.value; cake.relight(); syncLight(); });
  });
  // Spot light size is baked into the shader: on release, full relook (recompile).
  var spLs = light.querySelector('#dev-sp-ls-in');
  spLs.addEventListener('input', function () { light.querySelector('#dev-sp-ls').textContent = (+spLs.value).toFixed(2); });
  spLs.addEventListener('change', function () { if (!lookReady()) return; CakeLook.LOOK.spot.lightSize = +spLs.value; cake.relook(); syncLight(); });
  var slider = light.querySelector('#dev-ls-in');
  slider.addEventListener('input', function () { light.querySelector('#dev-ls').textContent = (+slider.value).toFixed(2); });
  slider.addEventListener('change', function () { applyLight(+slider.value); });
  // Ambient, key strength and key direction are plain light properties: live, no recompile.
  [['am', function (v) { CakeLook.LOOK.ambientScale = v; }],
   ['ky', function (v) { CakeLook.LOOK.keyScale = v; }],
   ['el', function (v) { CakeLook.LOOK.keyDir.elevation = v; }],
   ['az', function (v) { CakeLook.LOOK.keyDir.azimuth = v; }],
   ['kk', function (v) { CakeLook.LOOK.keyKelvin = v; }]].forEach(function (pair) {
    var el = light.querySelector('#dev-' + pair[0] + '-in');
    el.addEventListener('input', function () {
      if (!lookReady()) return;
      pair[1](+el.value);
      cake.relight();
      syncLight();
    });
  });
  [9, 13, 17].forEach(function (n) {
    var b = document.createElement('button'); b.textContent = n;
    b.addEventListener('click', function () { if (!lookReady()) return; CakeLook.LOOK.pcss.samples = n; cake.relook(); syncLight(); });
    light.querySelector('#dev-q').appendChild(b);
  });

  // Show/hide the lighting panel. Persisted, so it stays out of the way once you've tuned.
  var showLight = true;
  try { showLight = localStorage.getItem('cake.dev.light') !== '0'; } catch (e) {}
  var lightToggle = document.createElement('label');
  lightToggle.innerHTML = '<input type="checkbox" id="dev-light-vis"> light';
  var lightBox = lightToggle.querySelector('input');
  lightBox.checked = showLight;
  lightBox.addEventListener('change', function () {
    showLight = lightBox.checked;
    light.hidden = !showLight;
    try { localStorage.setItem('cake.dev.light', showLight ? '1' : '0'); } catch (e) {}
  });
  tgl.appendChild(lightToggle);
  light.hidden = !showLight;

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

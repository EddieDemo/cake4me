/* picker.js — the custom colour picker (v1.32): a sheet over the trays, in OKLCH (oklch.js).
   A hue strip, and for that hue a square of lightness (up) by chroma (across) that shows only
   colours a screen can display: past the edge it's plain, and the handle stops at the edge rather
   than quietly shifting the colour. A hex box for typing one in. The cake above updates live.
   v1.33: a dropper button (when opts.drop is given) picks a colour from the cake itself.
   v1.34: "Theme the cake from this colour" (when opts.theme is given): each tap, another theme.
   API (window.CakePicker): open({ hex, title, input(hex), done(hex), cancel(), drop(back), theme(hex) }), isOpen() */
(function () {
  var O = window.CakeOklch, CMAX = 0.33, OUT = [236, 231, 226];
  var root, plane, planeCv, planeKnob, hueBox, hueCv, hueKnob, oldSw, newSw, hexIn, readEl, titleEl;
  var st = null, cb = null, pending = false, shownHue = null;
  function css(hex) { return '#' + ('000000' + hex.toString(16)).slice(-6); }
  function build() {
    root = document.createElement('div'); root.className = 'picker'; root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Custom colour');
    root.innerHTML = '<div class="pk-head"><button type="button" class="pk-cancel">Cancel</button><span class="pk-title"></span><button type="button" class="pk-done">Done</button></div>' +
      '<div class="pk-row"><span class="pk-sw pk-old" title="Before"></span><span class="pk-sw pk-new" title="Now"></span>' +
      '<input class="pk-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Hex colour">' +
      '<button type="button" class="pk-drop" title="Pick from the cake" aria-label="Pick a colour from the cake"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg></button><span class="pk-read"></span></div>' +
      '<div class="pk-plane"><canvas></canvas><span class="pk-knob"></span></div>' +
      '<div class="pk-hue"><canvas></canvas><span class="pk-knob"></span></div>' +
      '<button type="button" class="pk-theme">✨ Theme the cake from this colour</button>';
    document.body.appendChild(root);
    plane = root.querySelector('.pk-plane'); planeCv = plane.querySelector('canvas'); planeKnob = plane.querySelector('.pk-knob');
    hueBox = root.querySelector('.pk-hue'); hueCv = hueBox.querySelector('canvas'); hueKnob = hueBox.querySelector('.pk-knob');
    oldSw = root.querySelector('.pk-old'); newSw = root.querySelector('.pk-new'); hexIn = root.querySelector('.pk-hex');
    readEl = root.querySelector('.pk-read'); titleEl = root.querySelector('.pk-title');
    root.querySelector('.pk-cancel').addEventListener('click', function () { close('cancel'); });
    root.querySelector('.pk-done').addEventListener('click', function () { close('done'); });
    // v1.34: a whole theme from this colour (theme.js); each tap tries another.
    root.querySelector('.pk-theme').addEventListener('click', function () { if (cb && cb.theme && st) cb.theme(st.hex); });
    // v1.33: the dropper (dropper.js). The sheet steps aside while you pick, then comes back with that colour.
    root.querySelector('.pk-drop').addEventListener('click', function () {
      if (!cb || !cb.drop) return;
      root.hidden = true;
      cb.drop(function (hex) {
        if (!st) return;
        root.hidden = false;
        if (hex != null) { var o = O.fromHex(hex); set(o[0], o[1], o[1] < 0.002 ? st.h : o[2]); }
      });
    });
    drag(plane, function (x, y) {                          // across: chroma · up: lightness
      var L = Math.min(0.995, Math.max(0.005, 1 - y)), C = Math.max(0, x) * CMAX;
      set(L, Math.min(C, O.maxChroma(L, st.h)), st.h);
    });
    drag(hueBox, function (x) {                            // a new hue keeps the lightness; chroma stays inside what a screen can show
      var h = Math.min(359.9, Math.max(0, x * 360));
      set(st.L, Math.min(st.want, O.maxChroma(st.L, h)), h, true);
    });
    hexIn.addEventListener('change', function () {
      if (!st) return;                                    // a late change (the box losing focus as the sheet closes)
      var m = /^#?([0-9a-f]{6})$/i.exec(hexIn.value.trim());
      if (!m) { hexIn.value = css(st.hex).toUpperCase(); return; }
      var o = O.fromHex(parseInt(m[1], 16)); set(o[0], o[1], o[1] < 0.002 ? st.h : o[2]);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) close('cancel'); });
  }
  function drag(el, fn) {
    function at(e) { if (!st) return; var r = el.getBoundingClientRect(); fn(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))); }
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); el.setPointerCapture(e.pointerId); at(e); });
    el.addEventListener('pointermove', function (e) { if (el.hasPointerCapture(e.pointerId)) at(e); });
  }
  function set(L, C, h, keepWant) {
    st.L = L; st.C = C; st.h = h; if (!keepWant) st.want = C;
    st.hex = O.toHex(L, C, h);
    show();
    if (!pending) { pending = true; requestAnimationFrame(function () { pending = false; if (cb && st) cb.input(st.hex); }); }
  }
  function paintPlane() {                                  // low resolution, smoothed by the browser: fast enough to redraw while the hue moves
    var w = Math.max(40, Math.round(plane.clientWidth / 2)), h = Math.max(30, Math.round(plane.clientHeight / 2));
    if (planeCv.width !== w || planeCv.height !== h) { planeCv.width = w; planeCv.height = h; }
    var g = planeCv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (var y = 0; y < h; y++) {
      var L = 1 - (y + 0.5) / h, cm = O.maxChroma(L, st.h);
      for (var x = 0; x < w; x++) {
        var C = (x + 0.5) / w * CMAX, i = (y * w + x) * 4, c = C <= cm ? O.rgb(L, C, st.h) : null;
        if (!c) c = OUT;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0); shownHue = st.h;
  }
  function paintHue() {
    var w = 180; hueCv.width = w; hueCv.height = 1;
    var g = hueCv.getContext('2d'), img = g.createImageData(w, 1), d = img.data;
    for (var x = 0; x < w; x++) {
      var hh = (x + 0.5) / w * 360, c = O.rgb(0.75, Math.min(0.14, O.maxChroma(0.75, hh)), hh) || OUT;
      d[x * 4] = c[0]; d[x * 4 + 1] = c[1]; d[x * 4 + 2] = c[2]; d[x * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  function show() {
    if (shownHue !== st.h) paintPlane();
    planeKnob.style.left = (st.C / CMAX * 100) + '%'; planeKnob.style.top = ((1 - st.L) * 100) + '%';
    planeKnob.style.background = css(st.hex);
    hueKnob.style.left = (st.h / 360 * 100) + '%';
    newSw.style.background = css(st.hex);
    if (document.activeElement !== hexIn) hexIn.value = css(st.hex).toUpperCase();
    readEl.textContent = 'L ' + Math.round(st.L * 100) + ' · C ' + st.C.toFixed(2) + ' · H ' + Math.round(st.h) + '°';
  }
  function open(opts) {
    if (!root) build();
    cb = opts;
    var o = O.fromHex(opts.hex);
    st = { L: o[0], C: o[1], h: o[1] < 0.002 ? 30 : o[2], want: o[1], hex: opts.hex };
    titleEl.textContent = opts.title || 'Custom colour';
    root.querySelector('.pk-drop').style.display = opts.drop ? '' : 'none';
    root.querySelector('.pk-theme').style.display = opts.theme ? '' : 'none';
    oldSw.style.background = css(opts.hex);
    root.hidden = false; document.body.classList.add('picking');
    shownHue = null; paintHue(); show();
  }
  function close(how) {
    if (!root || root.hidden) return;
    root.hidden = true; document.body.classList.remove('picking');
    var c = cb, s = st; cb = null; st = null;
    if (c) { if (how === 'done') c.done(s.hex); else c.cancel(); }
  }
  function isOpen() { return !!root && !root.hidden; }
  window.CakePicker = { open: open, isOpen: isOpen, close: close };
})();

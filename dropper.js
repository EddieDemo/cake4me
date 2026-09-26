/* dropper.js — the colour dropper (v1.33), opened from the colour picker.
   It picks a surface's BASE colour — its own colour before any lighting — not the lit pixel: it
   finds what's under the aim point (a ray from the camera) and reads that surface's colour, times
   its artwork at that exact spot when it has some (an emoji, the writing, a stripe). Baked shading
   (the vertex colours) is ignored, so is anything see-through or glowing; sprinkles report their
   palette colour; the sky and floor report the backdrop's.
   On a phone the finger hides the spot, so the aim is a little above the finger, marked by a ring,
   and a magnifier above that shows a still of the cake, zoomed, with the picked colour round it.
   Let go to pick; Cancel to leave.
   API: CakeDropper.create(deps) → { start(back), baseAt(x, y) }
     deps: renderer, camera, scene, snapshot(fn(canvas)) — calls fn with the canvas right after a frame,
           backdrop() → hex, sprinkleAt(points, index) → hex | null. back(hex | null) is called once. */
(function () {
  var AIM_UP = 64, LOUPE = 120, ZOOM = 5, RING = 7;
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function css(hex) { return '#' + ('000000' + hex.toString(16)).slice(-6); }
  function create(deps) {
    var ray = new THREE.Raycaster(); ray.params.Points = { threshold: 0.035 };
    var ndc = new THREE.Vector2(), tmpUv = new THREE.Vector2();
    var scratch = document.createElement('canvas'); scratch.width = scratch.height = 3;
    var sg = scratch.getContext('2d', { willReadFrequently: true });
    var root, bar, loupe, lg, aim, label, snap = null, cur = null, back = null, dpr = 1;
    function visible(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
    function sampleMap(tex, uv) {                          // the artwork's colour at that spot (sRGB bytes), averaged over 3×3
      var img = tex.image; if (!img) return null;
      var w = img.width || img.naturalWidth, h = img.height || img.naturalHeight; if (!w || !h) return null;
      tmpUv.copy(uv); tex.updateMatrix(); tex.transformUv(tmpUv);
      var x = Math.min(w - 1, Math.max(0, Math.floor(tmpUv.x * w))), y = Math.min(h - 1, Math.max(0, Math.floor(tmpUv.y * h)));
      if (img.data) {                                      // a DataTexture
        if (!(img.data instanceof Uint8Array || img.data instanceof Uint8ClampedArray)) return null;
        var ch = Math.round(img.data.length / (w * h)), i = (y * w + x) * ch;
        return ch >= 3 ? [img.data[i], img.data[i + 1], img.data[i + 2]] : [img.data[i], img.data[i], img.data[i]];
      }
      try {
        sg.clearRect(0, 0, 3, 3); sg.drawImage(img, x - 1, y - 1, 3, 3, 0, 0, 3, 3);
        var d = sg.getImageData(0, 0, 3, 3).data, r = 0, g = 0, b = 0, n = 0;
        for (var k = 0; k < 36; k += 4) if (d[k + 3] > 0) { r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
        return n ? [r / n, g / n, b / n] : null;
      } catch (e) { return null; }
    }
    function baseAt(x, y) {
      var el = deps.renderer.domElement, rc = el.getBoundingClientRect();
      ndc.set((x - rc.left) / rc.width * 2 - 1, -((y - rc.top) / rc.height) * 2 + 1);
      ray.setFromCamera(ndc, deps.camera);             // layer 0 only: flames and halos (layer 1) are never hit
      var hits = ray.intersectObjects(deps.scene.children, true);
      for (var i = 0; i < hits.length; i++) {
        var hit = hits[i], o = hit.object;
        if (!visible(o)) continue;
        if (o.isPoints) { var sp = deps.sprinkleAt(o, hit.index); if (sp != null) return sp; continue; }
        if (!o.isMesh) continue;
        if (o.userData.baseHex != null) return o.userData.baseHex;   // a part that knows its set colour (plain candles vary a touch each)
        var m = Array.isArray(o.material) ? o.material[hit.face ? hit.face.materialIndex : 0] : o.material;
        if (!m || m.visible === false || m.isShaderMaterial || !m.color) continue;
        if ((m.transparent && m.opacity < 0.999) || (m.blending !== undefined && m.blending !== THREE.NormalBlending)) continue;
        var c = m.color.clone();
        if (o.isInstancedMesh && o.instanceColor && hit.instanceId != null) { var ic = new THREE.Color(); o.getColorAt(hit.instanceId, ic); c.multiply(ic); }
        if (m.map && hit.uv) { var s = sampleMap(m.map, hit.uv); if (s) c.multiply(new THREE.Color().setRGB(lin(s[0]), lin(s[1]), lin(s[2]))); }
        return c.getHex();
      }
      return deps.backdrop();                              // the sky: the backdrop
    }
    function build() {
      root = document.createElement('div'); root.className = 'dropper'; root.hidden = true;
      root.innerHTML = '<div class="dr-bar"><span>Touch the cake, let go on your colour</span><button type="button">Cancel</button></div>' +
        '<canvas class="dr-loupe"></canvas><span class="dr-aim"></span><span class="dr-hex"></span>';
      document.body.appendChild(root);
      bar = root.querySelector('.dr-bar'); loupe = root.querySelector('.dr-loupe'); lg = loupe.getContext('2d');
      aim = root.querySelector('.dr-aim'); label = root.querySelector('.dr-hex');
      bar.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      bar.querySelector('button').addEventListener('click', function () { finish(null); });
      root.addEventListener('pointerdown', function (e) { e.preventDefault(); root.setPointerCapture(e.pointerId); track(e); });
      root.addEventListener('pointermove', function (e) { if (root.hasPointerCapture(e.pointerId)) track(e); });
      root.addEventListener('pointerup', function (e) { if (cur != null) finish(cur); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !root.hidden) finish(null); });
    }
    function track(e) {
      var ax = e.clientX, ay = e.clientY - (e.pointerType === 'mouse' ? 0 : AIM_UP);   // a finger hides the spot; a mouse doesn't
      cur = baseAt(ax, ay);
      // the magnifier sits above the aim, or beside it near the top of the screen
      var lx = ax, ly = ay - LOUPE / 2 - 28;
      if (ly < LOUPE / 2 + 56) { ly = Math.max(LOUPE / 2 + 8, ay); lx = ax + (ax < window.innerWidth / 2 ? 1 : -1) * (LOUPE / 2 + 30); }
      loupe.style.left = lx + 'px'; loupe.style.top = ly + 'px'; loupe.style.display = 'block';
      aim.style.left = ax + 'px'; aim.style.top = ay + 'px'; aim.style.display = 'block';
      label.style.left = lx + 'px'; label.style.top = (ly + LOUPE / 2 + 6) + 'px'; label.style.display = 'block';
      label.textContent = css(cur).toUpperCase();
      draw(ax, ay);
    }
    function draw(ax, ay) {
      var W = Math.round(LOUPE * dpr); if (loupe.width !== W) { loupe.width = W; loupe.height = W; }
      lg.clearRect(0, 0, W, W);
      lg.save(); lg.beginPath(); lg.arc(W / 2, W / 2, W / 2 - RING * dpr, 0, Math.PI * 2); lg.clip();
      lg.fillStyle = '#fff'; lg.fillRect(0, 0, W, W);
      if (snap) {
        var rc = deps.renderer.domElement.getBoundingClientRect(), k = snap.width / rc.width, src = LOUPE / ZOOM * k;
        lg.imageSmoothingEnabled = false;
        lg.drawImage(snap, (ax - rc.left) * k - src / 2, (ay - rc.top) * k - src / 2, src, src, 0, 0, W, W);
      }
      var q = ZOOM * dpr * 1.5;                            // the spot, boxed
      lg.lineWidth = 2 * dpr; lg.strokeStyle = 'rgba(0,0,0,0.55)'; lg.strokeRect(W / 2 - q, W / 2 - q, 2 * q, 2 * q);
      lg.lineWidth = 1 * dpr; lg.strokeStyle = '#fff'; lg.strokeRect(W / 2 - q + dpr, W / 2 - q + dpr, 2 * q - 2 * dpr, 2 * q - 2 * dpr);
      lg.restore();
      lg.beginPath(); lg.arc(W / 2, W / 2, W / 2 - RING * dpr / 2, 0, Math.PI * 2);
      lg.lineWidth = RING * dpr; lg.strokeStyle = css(cur); lg.stroke();
    }
    function start(cb) {
      if (!root) build();
      back = cb; cur = null; dpr = Math.min(3, window.devicePixelRatio || 1);
      [loupe, aim, label].forEach(function (el) { el.style.display = 'none'; });
      deps.snapshot(function (canvas) {                    // a still of the cake, taken right after a frame, for the magnifier
        try {
          if (!snap) snap = document.createElement('canvas');
          snap.width = canvas.width; snap.height = canvas.height;
          snap.getContext('2d').drawImage(canvas, 0, 0);
        } catch (e) { snap = null; }
        root.hidden = false;
      });
    }
    function finish(hex) {
      root.hidden = true; if (snap) { snap.width = 1; snap.height = 1; }
      var b = back; back = null; if (b) b(hex);
    }
    return { start: start, baseAt: baseAt };
  }
  window.CakeDropper = { create: create };
})();

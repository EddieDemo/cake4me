/* =====================================================================
   stage.js — the room the cake sits in: a lit floor, a sky, and fog.

   Before this, the "background" was a CSS gradient behind a transparent
   canvas and the cast shadow was a tinted decal on an invisible plane.
   Neither knew about the other, so on a dark backdrop the shadow could be
   LIGHTER than the floor — which light can't do. Now the background is a
   real, vast floor plane with a paint colour, lit by the same lights as
   the cake and receiving the same shadows. A shadow is simply the floor
   with ambient light only, so it is always darker than the floor beside
   it, by exactly the share the direct light contributed.

   The world is one featureless plane, so the "sky" is just that plane
   receding into the distance: the same paint at the same brightness. The
   CSS backdrop is painted the lit-floor colour and fog in the same colour
   dissolves the plane into it, so there is no horizon to hide. Turn every
   light off and the whole scene goes black — the test that the model is
   honest.

   Owns: the floor mesh, the fog, the CSS sky variables.
   Knows nothing about cakes, candles or palettes — it takes a paint colour
   and measures the rest.

   The sky colour is MEASURED, not estimated (v0.57): a 2×2 probe render of
   the far floor, straight down, with the fog pushed out of the way, read
   back and used for both the CSS backdrop and the fog. An analytic guess
   drifted as soon as the key went low or a colour picker came into play;
   a measurement can't. It runs on relight, not per frame.

   API (window.CakeStage):
     attach(scene)                        create the floor and fog once
     setColour(floorHex)                  the sender's choice of backdrop
     calibrate(renderer, scene)           measure the far floor and set the sky + fog to it
     setBrightness(litFactor)             fallback estimate, used until the first calibrate
     update(cameraDistance)               keep the fog just past the cake, every frame
     floor                                the mesh (receives shadows; never casts)
   ===================================================================== */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { console.warn('stage.js: THREE not loaded'); return; }

  var S = {
    size: 400,            // world units; the horizon is fogged long before the edge
    fogNearPast: 3.5,     // fog starts this far beyond the camera-to-cake distance (just behind the cake)…
    fogFarPast: 48        // …and is total this far beyond it: a long, gentle fade, not a band
  };

  var scene = null, floor = null, fog = null;
  var floorCol = new THREE.Color(0xffe7ce), lit = 1;
  var measured = null;                  // THREE.Color, linear: the far floor as actually rendered
  var probeRT = null, probeCam = null, probeBuf = new Uint8Array(4 * 4);

  function attach(sc) {
    scene = sc;
    if (!floor) {
      floor = new THREE.Mesh(
        new THREE.PlaneGeometry(S.size, S.size),
        new THREE.MeshStandardMaterial({ color: floorCol, roughness: 0.96, metalness: 0 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0;
      floor.receiveShadow = true;
      floor.castShadow = false;
      floor.name = 'stage-floor';
      floor.userData.__look = true;         // look.js's shadow pass leaves it alone
      scene.add(floor);
    }
    if (!fog) { fog = new THREE.Fog(0xffffff, 20, 60); scene.fog = fog; }
    refresh();
  }

  // The lit floor at the horizon must match the CSS sky's bottom, or the seam shows. We
  // can't sample the render, so approximate: floor paint × lit factor, clamped like the
  // renderer clamps (no tone mapping).
  var _c = new THREE.Color();
  function litFloor() {
    _c.copy(floorCol).multiplyScalar(lit);
    _c.r = Math.min(1, _c.r); _c.g = Math.min(1, _c.g); _c.b = Math.min(1, _c.b);
    return _c;
  }
  function refresh() {
    if (!floor) return;
    floor.material.color.copy(floorCol);
    var horizon = measured || litFloor();
    // r128 applies fog AFTER output encoding (fog_fragment follows encodings_fragment), so the
    // fog colour must be given in SCREEN (sRGB) space, not linear — or the far floor renders
    // darker and more saturated than the sky and the plane's edge shows as a line.
    fog.color.copy(horizon).convertLinearToSRGB();
    // The backdrop IS the lit floor, top to bottom.
    var root = document.documentElement.style;
    root.setProperty('--sky-top', '#' + horizon.getHexString());
    root.setProperty('--sky-bottom', '#' + horizon.getHexString());
  }

  function setColour(floorHex) { floorCol.set(floorHex); measured = null; refresh(); }

  // Render the far floor into a 2×2 target and read it back. Straight down from high up at a
  // point well outside the shadow frustum and any local light's reach, so what comes back is
  // "floor paint under the room's lights" — exactly what the sky should be. The fog is pushed
  // out of range for the render (uniforms only; no shader change) and restored after.
  // Two phases so the readback never stalls the pipeline: render the probe on one frame, read
  // it on the next, when the GPU has long finished. glReadPixels is a full drain otherwise —
  // on a tile-based phone GPU, tens of milliseconds while a shadow pass is in flight.
  var probePending = false;
  function calibrate(renderer, scene) {
    if (!floor || !fog || !renderer) return;
    if (!probeRT) {
      probeRT = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
      // A render target isn't output-encoded unless told to; encode it like the screen so the
      // bytes we read back mean the same thing the viewer sees.
      probeRT.texture.encoding = THREE.sRGBEncoding;
      probeCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 100);
      probeCam.position.set(0, 20, -60); probeCam.lookAt(0, 0, -60);
    }
    var near = fog.near, far = fog.far;
    fog.near = 1e6; fog.far = 1e6 + 1;
    var shadowAuto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;                       // the far floor is outside the frustum anyway
    var prev = renderer.getRenderTarget();
    renderer.setRenderTarget(probeRT);
    renderer.render(scene, probeCam);
    renderer.setRenderTarget(prev);
    renderer.shadowMap.autoUpdate = shadowAuto;
    fog.near = near; fog.far = far;
    probePending = true;
  }
  function finishCalibrate(renderer) {
    if (!probePending || !probeRT) return false;
    probePending = false;
    renderer.readRenderTargetPixels(probeRT, 0, 0, 2, 2, probeBuf);
    // The target holds output-encoded (sRGB) bytes; setRGB is linear by contract, so decode.
    measured = measured || new THREE.Color();
    measured.setRGB(probeBuf[0] / 255, probeBuf[1] / 255, probeBuf[2] / 255).convertSRGBToLinear();
    refresh();
    return true;
  }
  function setBrightness(litFactor) { lit = litFactor; refresh(); }
  function update(cameraDistance) {
    if (!fog) return;
    fog.near = cameraDistance + S.fogNearPast;
    fog.far = cameraDistance + S.fogFarPast;
  }

  window.CakeStage = { attach: attach, setColour: setColour, setBrightness: setBrightness, calibrate: calibrate, finishCalibrate: finishCalibrate, update: update, S: S,
                       get floor() { return floor; } };
})();

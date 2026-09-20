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

   The sky stays a CSS gradient above the horizon; fog in the sky colour
   dissolves the floor into it before its edge can show. Both the floor's
   lit colour and the sky darken with the room's brightness, so an ambient
   slider dims everything together, as a room would.

   Owns: the floor mesh, the fog, the CSS sky variables.
   Knows nothing about cakes, candles or palettes — it takes two colours
   (sky, floor) and a brightness estimate.

   API (window.CakeStage):
     attach(scene)                        create the floor and fog once
     setColours(skyHex, floorHex)         the sender's choice of backdrop
     setBrightness(litFactor)             how much light the lit floor gets (≈1 daylight)
     update(cameraDistance)               keep the fog just past the cake, every frame
     floor                                the mesh (receives shadows; never casts)
   ===================================================================== */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { console.warn('stage.js: THREE not loaded'); return; }

  var S = {
    size: 400,            // world units; the horizon is fogged long before the edge
    fogNearPast: 6,       // fog starts this far beyond the camera-to-cake distance…
    fogFarPast: 34,       // …and is total this far beyond it
    skyDim: 0.85          // how much of the room's brightness change the sky follows (it's not a lit surface)
  };

  var scene = null, floor = null, fog = null;
  var sky = new THREE.Color(0xfff6ea), floorCol = new THREE.Color(0xffe7ce), lit = 1;

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
    var horizon = litFloor();
    fog.color.copy(horizon);
    // Sky: the palette's sky colour, dimmed most of the way with the room.
    var skyLit = sky.clone().multiplyScalar(1 - S.skyDim + S.skyDim * Math.min(1, lit));
    var root = document.documentElement.style;
    root.setProperty('--sky-top', '#' + skyLit.getHexString());
    root.setProperty('--sky-bottom', '#' + horizon.getHexString());
  }

  function setColours(skyHex, floorHex) {
    sky.set(skyHex); floorCol.set(floorHex);
    refresh();
  }
  function setBrightness(litFactor) { lit = litFactor; refresh(); }
  function update(cameraDistance) {
    if (!fog) return;
    fog.near = cameraDistance + S.fogNearPast;
    fog.far = cameraDistance + S.fogFarPast;
  }

  window.CakeStage = { attach: attach, setColours: setColours, setBrightness: setBrightness, update: update, S: S,
                       get floor() { return floor; } };
})();

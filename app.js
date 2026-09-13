/* Cake — Phase 0
   A cake on a plate, turning slowly. No UI, no state, no candles yet.
   Everything here is deliberately plain: geometry and colours will be
   replaced in Phase 1, so keep this file small and readable. */

(function () {
  'use strict';

  // ---------- Config (placeholder tokens; Phase 1 turns these into palettes) ----------
  var COLORS = {
    sponge:   0xe8b96f,   // golden sponge
    frosting: 0xf6a5c0,   // strawberry frosting
    plate:    0xfafafa,
    plateRim: 0x9ad3f0
  };

  var ROTATION_SECONDS_PER_TURN = 24;   // slow: reads as "still" but a 10s clip shows the whole cake
  var MAX_PIXEL_RATIO = 2;              // cap for phone GPUs

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Renderer ----------
  var canvas = document.getElementById('cake');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x000000, 0);   // transparent: the CSS gradient shows through

  // ---------- Scene & camera ----------
  var scene = new THREE.Scene();

  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 5.2, 9.5);     // slightly above, looking down ~25°
  camera.lookAt(0, 0.9, 0);

  // ---------- Lights ----------
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  var key = new THREE.DirectionalLight(0xfff1dd, 0.9);   // warm key from upper left
  key.position.set(-4, 7, 5);
  scene.add(key);

  var fill = new THREE.DirectionalLight(0xdcefff, 0.35);  // cool soft fill from the right
  fill.position.set(5, 3, -2);
  scene.add(fill);

  // ---------- The cake ----------
  // A group so Phase 1 can add candles and Phase 4 can swap the body for wedges
  // without touching anything else.
  var cake = new THREE.Group();
  scene.add(cake);

  var plate = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.12, 64),
    new THREE.MeshStandardMaterial({ color: COLORS.plate, roughness: 0.35 })
  );
  plate.position.y = 0.06;
  cake.add(plate);

  var rim = new THREE.Mesh(
    new THREE.TorusGeometry(3.3, 0.08, 12, 96),
    new THREE.MeshStandardMaterial({ color: COLORS.plateRim, roughness: 0.4 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.12;
  cake.add(rim);

  var body = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 1.6, 64),
    new THREE.MeshStandardMaterial({ color: COLORS.sponge, roughness: 0.85 })
  );
  body.position.y = 0.12 + 0.8;
  cake.add(body);

  var cap = new THREE.Mesh(
    new THREE.CylinderGeometry(2.32, 2.26, 0.35, 64),
    new THREE.MeshStandardMaterial({ color: COLORS.frosting, roughness: 0.6 })
  );
  cap.position.y = 0.12 + 1.6 + 0.175;
  cake.add(cap);

  // A soft drip band where frosting meets sponge, so the cap doesn't float.
  var drip = new THREE.Mesh(
    new THREE.TorusGeometry(2.22, 0.09, 10, 96),
    new THREE.MeshStandardMaterial({ color: COLORS.frosting, roughness: 0.6 })
  );
  drip.rotation.x = Math.PI / 2;
  drip.position.y = 0.12 + 1.6;
  cake.add(drip);

  // ---------- Resize ----------
  function resize() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  resize();

  // ---------- Loop ----------
  var clock = new THREE.Clock();
  var turn = (Math.PI * 2) / ROTATION_SECONDS_PER_TURN;

  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05);   // clamp so a background tab doesn't jump
    if (!reduceMotion) cake.rotation.y += turn * dt;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  // Handy in the console while building: window.cake.rotation.y = 0
  window.cake = cake;
})();

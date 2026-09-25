/* scene.js — the renderer, the scene, the camera and the lights (v1.07, refactor step 3).
   One function makes them; app.js (for now) keeps aliases to the pieces it uses. Nothing here
   knows about cakes. The stage (floor, sky) is attached from stage.js; shadows, environment
   and tone mapping from look.js. */
(function () {
  function create(canvas, PIXEL) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    var deviceDPR = window.devicePixelRatio || 1;
    var pixelRatio = Math.min(deviceDPR, PIXEL.ceil);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 6.2, 12.4);
    camera.lookAt(0, 1.35, 0);

    // Lights. Intensities come from look.js when it's present: the environment provides most
    // of the fill, so the direct lights step back. Every light the scene will ever need is
    // created here, at load — adding one later would recompile every material.
    var LI = (window.CakeLook && CakeLook.LOOK.lights) || { ambient: 0.55, key: 0.9, fill: 0.35 };
    var ambient = LI.hemiSky
      ? new THREE.HemisphereLight(new THREE.Color(LI.hemiSky), new THREE.Color(LI.hemiGround), LI.hemi)   // sky above, warm bounce below
      : new THREE.AmbientLight(0xffffff, LI.ambient);
    scene.add(ambient);
    var key = new THREE.DirectionalLight(0xfff1dd, LI.key);
    key.position.set(-4, 7, 5);
    scene.add(key);
    var spot = new THREE.SpotLight(0xffffff, 0, 30, Math.PI / 6, 0.5, 2);   // off unless the look says otherwise
    spot.visible = false; spot.target.position.set(0, 0.8, 0);
    scene.add(spot); scene.add(spot.target);
    var fill = new THREE.DirectionalLight(0xdcefff, LI.fill);
    fill.position.set(5, 3, -2);
    scene.add(fill);
    if (window.CakeLook) CakeLook.apply(renderer, scene, key);                 // shadows, environment, tone mapping
    if (window.CakeStage && (!window.CakeDebug || CakeDebug.on('backdrop'))) CakeStage.attach(scene);   // floor, fog, sky
    if (window.CakeDebug && !CakeDebug.on('shadows') && window.CakeLook) CakeLook.LOOK.shadows = false;
    var candle = new THREE.PointLight(0xffb36b, 0, 8, 2);   // the candles' shared light
    scene.add(candle);
    var spark = new THREE.PointLight(0xffd9a0, 0, 7, 2);    // the sparklers' light (zero when there are none)
    scene.add(spark);

    return { renderer: renderer, scene: scene, camera: camera, deviceDPR: deviceDPR, pixelRatio: pixelRatio,
             lights: { ambient: ambient, key: key, spot: spot, fill: fill, candle: candle, spark: spark } };
  }
  window.CakeScene = { create: create };
})();

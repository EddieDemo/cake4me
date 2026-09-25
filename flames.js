/* flames.js — a candle's flame (v1.13, refactor step 6).
   create() → { FLAME, makeFlameMesh(phase), updateFlameMesh(f, t, lx, lz, right, fwd) }
   A 3D teardrop that glows from inside (shaders.js), sways and stretches on its own phase, is
   blended as an object with soft edges (v1.06) with only its halo additive, lives on the
   emissive layer (drawn after the occlusion), pivots at the wick when the cake spins, and fades
   with its flame record's k and lit. The old sprite stays as an invisible anchor (see app.js). */
(function () {
  var FLAME_VS = CakeShaders.flame.vertex, FLAME_FS = CakeShaders.flame.fragment;
  function create() {
    // ---- Flames (v0.96) ----
    // A flame is a small 3D teardrop with its own shader, not a flat picture: widest a third of the
    // way up, tapering to a fine tip. It glows from the inside — brightest where you look through
    // the most flame, fading to nothing at its edges — with a blue root at the wick, a dimmer cone
    // round the wick, a white-gold heart, and orange edges and tip. The vertex shader sways it
    // (more at the tip than the root) and stretches its tip on several unrelated rhythms, each
    // flame on its own phase. A faint larger copy is its halo; a tiny ember marks the wick's tip.
    // The old sprite stays as an invisible anchor, so blowing out, smoke and the rest are unchanged.
    // v1.06: the flame no longer adds its light to whatever is behind it (which made it rich against
    // the backdrop's wall and pale, with the horizon showing through, against the bright floor —
    // ?backdrop=0 proved it). It's blended like an opaque-edged object, brighter to compensate; only
    // the halo stays additive.
    var FLAME = { glow: window.CakeDebug ? CakeDebug.num('glow', 1.6) : 1.6, haloGlow: 0.1, cover: window.CakeDebug ? CakeDebug.num('cover', 1.0) : 1.0, lean: 0.6 };
    var flameGeo = (function () {
      var p = [];
      for (var i = 0; i <= 24; i++) { var t = i / 24, r = 0.042 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.9) * Math.pow(1 - t, 0.25); p.push(new THREE.Vector2(Math.max(r, 0.0005), t * 0.30)); }
      var g = new THREE.LatheGeometry(p, 20); CakeResources.keep(g); return g;
    })();
    var emberGeo = new THREE.SphereGeometry(0.009, 8, 6); CakeResources.keep(emberGeo);
    var emberMat = new THREE.MeshBasicMaterial({ color: 0xFF7A2A }); CakeResources.keep(emberMat);
    function flameMaterial(phase, glow, cover, opaque) {
      return new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPhase: { value: phase }, uGlow: { value: glow }, uCover: { value: cover || 0 }, uOpaque: { value: opaque || 0 } },
        vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
        // v1.26: the NEAR side only. Drawing both sides meant the far wall of the teardrop showed
        // through the near one, and where its silhouette fell inside the flame it drew a hard
        // contour — the flame read as an outlined shape rather than one body of light.
        transparent: true, depthWrite: false, side: THREE.FrontSide,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor   // premultiplied: cover 0 = purely additive
      });
    }
    function makeFlameMesh(phase) {
      var g = new THREE.Group();
      var core = new THREE.Mesh(flameGeo, flameMaterial(phase, FLAME.glow, FLAME.cover, 1));   // the halo stays purely additive
      var halo = new THREE.Mesh(flameGeo, flameMaterial(phase, FLAME.haloGlow));
      halo.scale.set(1.9, 1.25, 1.9); halo.position.y = 0.0;   // never below the flame's base
      var ember = new THREE.Mesh(emberGeo, emberMat); ember.position.set(0.006, -0.018, 0); ember.userData.noAO = true;
      core.renderOrder = halo.renderOrder = 2;
      if (window.CakeDebug && !CakeDebug.on('halo')) halo.visible = false;
      // v0.97: flames live on layer 1 and are drawn after the ambient occlusion, which otherwise
      // multiplied onto them — at some angles the surfaces behind a flame were occluded (the
      // candle's top, the wick) and the flame was darkened almost to nothing.
      core.layers.set(CakePipeline.LAYER.emissive); halo.layers.set(CakePipeline.LAYER.emissive); ember.layers.set(CakePipeline.LAYER.emissive);
      g.add(halo); g.add(core); g.add(ember);
      g.userData.noAO = true;
      g.__mats = [core.material, halo.material];
      return g;
    }
    CakeMaterials.warm('flame', function () { return makeFlameMesh(0); });
    var _leanAxis = new THREE.Vector3(), _up3 = new THREE.Vector3(0, 1, 0);
    function updateFlameMesh(f, t, lx, lz, _right, _fwd) {
      var g = f.mesh; if (!g) return;
      g.visible = f.sprite.visible;
      if (!g.visible) return;
      var sz = (f.base / 0.28) * f.k * Math.max(0.05, f.lit);
      g.scale.setScalar(sz);
      g.position.set(f.x, f.y - f.root, f.z);
      // lean with the cake's spin, pivoting at the wick
      var dx = _right.x * lx + _fwd.x * lz, dz = _right.z * lx + _fwd.z * lz, amt = Math.sqrt(dx * dx + dz * dz);
      if (amt > 1e-4) { _leanAxis.set(dz, 0, -dx).normalize(); g.quaternion.setFromAxisAngle(_leanAxis, Math.min(0.8, amt * FLAME.lean)); }
      else g.quaternion.identity();
      g.__mats[0].uniforms.uTime.value = t; g.__mats[1].uniforms.uTime.value = t;
    }
    return { FLAME: FLAME, makeFlameMesh: makeFlameMesh, updateFlameMesh: updateFlameMesh };
  }
  window.CakeFlames = { create: create };
})();

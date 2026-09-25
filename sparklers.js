/* sparklers.js — cake sparklers (v1.13, refactor step 6).
   create(deps) → { list, makeSparkler(), place(n, surface), update(t), SPK }
   A coated wire burning at a fixed point (never burning down), sparks entirely on the GPU
   (shaders.js), a glow, and a shared crackling light. deps: light() (the scene's sparkler light),
   darkness() (0 day … 1 night), parent() (the group to add to), studioEnv() (for the wire's metal).
   `list` is the live array of placed sparklers; app.js empties it (length = 0) on each build. */
(function () {
  var SPARK_VS = CakeShaders.sparks.vertex, SPARK_FS = CakeShaders.sparks.fragment;
  function create(deps) {
    // ---- Sparklers (v0.99) ----
    // A wire, far thinner than a candle, the top two-thirds coated in rough pyrotechnic slurry. It
    // burns at one fixed point near the top and never burns down: a white-hot bead, a short stub of
    // spent wire above it, and sparks — thin streaks thrown out in every direction, arcing and
    // falling, nearly half bursting at the end of their flight into small stars of finer streaks.
    // The sparks run entirely on the GPU: each is a quad whose path is worked out in the vertex
    // shader from its seed and the time, so nothing is recalculated in JavaScript per frame.
    // Sparklers aren't candles: blowing out the candles leaves them going.
    var SPK = { len: 2.5, wire: 0.0075, coat: 0.017, coatFrom: 0.34, burnAt: 0.9, sparks: 300, burst: 8, max: 2 };
    var sparklers = [];
    var spkStickGeo = null, spkMats = null, spkSparkGeo = null, spkGlowTex = null;
    function sparklerParts() {
      if (spkStickGeo) return;
      var cl = SPK.len * (SPK.burnAt - SPK.coatFrom);
      var coat = new THREE.CylinderGeometry(SPK.coat, SPK.coat * 1.05, cl, 12, 48), pos = coat.attributes.position;
      for (var i = 0; i < pos.count; i++) {                 // lumpy, as a dipped coating is
        var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), r = Math.sqrt(x * x + z * z); if (r < 1e-6) continue;
        var a = Math.atan2(z, x), n = Math.sin(a * 5 + y * 90) * 0.5 + Math.sin(a * 11 - y * 170) * 0.3 + Math.sin(y * 410 + a * 3) * 0.2;
        var k = 1 + 0.13 * n; pos.setXYZ(i, x * k, y, z * k);
      }
      coat.computeVertexNormals(); coat.translate(0, SPK.len * SPK.coatFrom + cl / 2, 0);
      var wire = new THREE.CylinderGeometry(SPK.wire, SPK.wire, SPK.len * SPK.burnAt, 8); wire.translate(0, SPK.len * SPK.burnAt / 2, 0);
      var spent = new THREE.CylinderGeometry(SPK.wire * 1.3, SPK.wire * 1.3, SPK.len * (1 - SPK.burnAt), 8); spent.translate(0, SPK.len * (SPK.burnAt + 1) / 2, 0);
      spkStickGeo = { coat: coat, wire: wire, spent: spent };
      [coat, wire, spent].forEach(function (g) { CakeResources.keep(g); });
      spkMats = {
        wire: new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.8, roughness: 0.4, envMap: deps.studioEnv() }),
        coat: new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.95, metalness: 0.05 }),
        spent: new THREE.MeshStandardMaterial({ color: 0x2a2522, roughness: 0.8 })
      };
      Object.keys(spkMats).forEach(function (k) { CakeResources.keep(spkMats[k]); });
      // the sparks: per quad, a seed; per vertex, which corner
      var N = SPK.sparks, B = SPK.burst, quads = N + N * B, seeds = new Float32Array(quads * 4 * 4), corner = new Float32Array(quads * 4 * 2), idx = [];
      function h(i, k) { var v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); }
      var q = 0;
      function quad(a, b, c, d) {
        for (var v = 0; v < 4; v++) {
          seeds.set([a, b, c, d], (q * 4 + v) * 4);
          corner.set([v < 2 ? 0 : 1, v % 2 ? 1 : -1], (q * 4 + v) * 2);
        }
        var o = q * 4; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); q++;
      }
      for (var i = 0; i < N; i++) quad(i, -1, 0, 0);                                  // a spark
      for (var j = 0; j < N; j++) for (var k = 0; k < B; k++) quad(j, k, h(j, 7) < 0.45 ? 1 : 0, 0);   // its burst (if it has one)
      spkSparkGeo = new THREE.BufferGeometry();
      spkSparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(quads * 4 * 3), 3));
      spkSparkGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
      spkSparkGeo.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2));
      spkSparkGeo.setIndex(idx);
      CakeResources.keep(spkSparkGeo);
      var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(0.12, 'rgba(255,240,200,0.9)'); gr.addColorStop(0.35, 'rgba(255,190,110,0.35)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      spkGlowTex = new THREE.CanvasTexture(c); CakeResources.keep(spkGlowTex);
    }
    function makeSparkler() {
      sparklerParts();
      var g = new THREE.Group();
      g.add(new THREE.Mesh(spkStickGeo.wire, spkMats.wire));
      g.add(new THREE.Mesh(spkStickGeo.coat, spkMats.coat));
      g.add(new THREE.Mesh(spkStickGeo.spent, spkMats.spent));
      var burn = new THREE.Vector3(0, SPK.len * SPK.burnAt, 0);
      var mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uOrigin: { value: burn.clone() } },
        vertexShader: SPARK_VS, fragmentShader: SPARK_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      var sp = new THREE.Mesh(spkSparkGeo, mat); sp.frustumCulled = false; sp.layers.set(CakePipeline.LAYER.emissive); sp.userData.noAO = true;
      g.add(sp);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: spkGlowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.scale.set(0.45, 0.45, 1); glow.position.copy(burn); glow.layers.set(CakePipeline.LAYER.emissive); g.add(glow);
      var glow2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: spkGlowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 }));
      glow2.scale.set(1.4, 1.4, 1); glow2.position.copy(burn); glow2.layers.set(CakePipeline.LAYER.emissive); g.add(glow2);
      g.__spark = { mat: mat, glow: glow, burn: burn, phase: (sparklers.length + 1) * 2.7 };   // its own rhythm, but the same one every time (the harness compares stills)
      return g;
    }
    CakeMaterials.warm('sparkler', function () { return makeSparkler(); });
    function placeSparklers(n, surface) {
      n = Math.max(0, Math.min(SPK.max, n | 0));
      if (!n || !surface) return;
      var r = surface.rMax, spots = n === 1 ? [[0.05 * r, -0.5 * r]] : [[-0.38 * r, -0.42 * r], [0.38 * r, -0.42 * r]];
      var scale = Math.max(0.75, Math.min(1, r / 1.95));
      spots.forEach(function (sp, i) {
        var g = makeSparkler();
        g.position.set(sp[0], surface.y - 0.05, sp[1]);    // pushed straight into the cake
        g.scale.setScalar(scale);
        g.rotation.set((i ? -1 : 1) * 0.03, 0, (i ? 1 : -1) * 0.05);
        deps.parent().add(g); sparklers.push(g);
      });
    }
    var _sv = new THREE.Vector3();
    function updateSparklers(t) {
      var sparkLight = deps.light();
      if (!sparklers.length) { sparkLight.intensity = 0; return; }
      var sum = new THREE.Vector3();
      sparklers.forEach(function (g) {
        var S = g.__spark; S.mat.uniforms.uTime.value = t + S.phase;
        var fl = 0.85 + 0.15 * Math.sin(t * 37 + S.phase) * Math.sin(t * 23.3);   // the crackle
        S.glow.scale.set(0.45 * fl, 0.45 * fl, 1);
        g.localToWorld(_sv.copy(S.burn)); sum.add(_sv);
      });
      sparkLight.position.copy(sum.multiplyScalar(1 / sparklers.length));
      sparkLight.intensity = (0.9 + 0.4 * Math.max(0, deps.darkness())) * sparklers.length * (0.85 + 0.15 * Math.sin(t * 31));
    }
    return { list: sparklers, makeSparkler: makeSparkler, place: placeSparklers, update: updateSparklers, SPK: SPK };
  }
  window.CakeSparklers = { create: create };
})();

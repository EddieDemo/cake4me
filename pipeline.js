/* pipeline.js — the frame, declared once (v1.07, refactor step 3).
   Three passes, in order:
     opaque    — everything on layer 0 (the cake, candles, floor…), with shadows and lights
     occlusion — screen-space ambient occlusion from that geometry, multiplied onto the frame
     emissive  — flames and sparks, on their own layer: drawn LAST, into the same depth, so the
                 cake still hides them but nothing is multiplied onto them (v0.97's bug)
   Objects say which pass they belong to with tag(): 'emissive' puts a flame on the emissive
   layer and out of the occlusion; 'noOcclusion' keeps a light-only thing (an ember, sparks)
   out of the occlusion pass; 'noSprinkle' keeps sprinkles off a ribbon. The old flags
   (userData.noAO, layers.set(1)) are what tag() sets, so existing objects keep working.
   Debug switches (?ao=0 ?flames=0) turn passes off here and nowhere else. */
(function () {
  var LAYER = { opaque: 0, emissive: 1 };
  function tag(obj, kind) {
    if (kind === 'emissive') { obj.traverse ? obj.traverse(function (o) { o.layers.set(LAYER.emissive); o.userData.noAO = true; }) : (obj.layers.set(LAYER.emissive), obj.userData.noAO = true); }
    else if (kind === 'noOcclusion') obj.userData.noAO = true;
    else if (kind === 'noSprinkle') obj.userData.noSprinkle = true;
    return obj;
  }
  function create(opts) {
    var renderer = opts.renderer, scene = opts.scene, camera = opts.camera;
    // ---- Screen-space ambient occlusion (v0.92) ----
    // A real effect, not a painted one: after the frame is drawn, the actual geometry on screen is
    // rendered again as depth and normals, and every pixel is darkened by how much nearby geometry
    // crowds it — under the candle holders, in the icing's grooves, beneath the ribbon, where the
    // tiers meet. Computed at half resolution (it's soft by nature) and multiplied onto the frame.
    // Flames, sprites, confetti and anything transparent are left out, so they don't occlude.
    // kernelRadius: how far round a point it looks (world units). maxDistance: how far BEHIND a point
    // something may be and still count — small, or thin things like candles cast dark halos on
    // whatever is far behind them. strength: how much of it to apply.
    // v0.93: full resolution and a much tighter radius. At half resolution, the visible sliver of
    // icing under a holder was only a pixel or two tall — the blur smeared its occlusion outward into
    // a halo. Now the darkening sits where it belongs: under the holder, fading within millimetres.
      var AO = { on: !window.CakeDebug || CakeDebug.on('ao'), scale: 1.0, kernelRadius: 0.045, minDistance: 0.0003, maxDistance: 0.003, kernelSize: 16, strength: 0.8, pass: null, w: 0, h: 0, mix: null };
    var _aoSize = new THREE.Vector2();
    // The flames: drawn last, into the same depth buffer, so the cake still hides them where it
    // should — but nothing is multiplied onto them afterwards.
    function renderEmissive() {
      if (!opts.hasEmissive()) return;
      if (window.CakeDebug && !CakeDebug.on('flames')) return;
      var ac = renderer.autoClear;
      renderer.autoClear = false;
      camera.layers.set(LAYER.emissive);
      renderer.render(scene, camera);
      camera.layers.set(0);
      renderer.autoClear = ac;
    }
    function renderAO() {
      if (!AO.on || !THREE.SSAOPass || !THREE.SimplexNoise) return;
      renderer.getDrawingBufferSize(_aoSize);
      var w = Math.max(1, Math.round(_aoSize.x * AO.scale)), h = Math.max(1, Math.round(_aoSize.y * AO.scale));
      if (!AO.pass) {
        AO.pass = new THREE.SSAOPass(scene, camera, w, h);
        // half the samples of the default: it's blurred afterwards anyway, and phones will thank us
        var P0 = AO.pass; P0.kernel = []; P0.kernelSize = AO.kernelSize; P0.generateSampleKernel();
        P0.ssaoMaterial.defines.KERNEL_SIZE = AO.kernelSize; P0.ssaoMaterial.uniforms.kernel.value = P0.kernel; P0.ssaoMaterial.needsUpdate = true;
        // v0.95: 24-bit depth. At 16 bits, depth at our viewing distance was coarser than the
        // occlusion test itself, so flat and curved surfaces occluded themselves in bands — the
        // stripes in the background and the moiré on the cake as the camera moved.
        if (P0.normalRenderTarget.depthTexture) P0.normalRenderTarget.depthTexture.type = THREE.UnsignedIntType;
        AO.w = w; AO.h = h;
      } else if (w !== AO.w || h !== AO.h) { AO.pass.setSize(w, h); AO.w = w; AO.h = h; }
      var P = AO.pass, U = P.ssaoMaterial.uniforms;
      // the camera moves and zooms: keep the pass's copy of it current
      U.cameraNear.value = camera.near; U.cameraFar.value = camera.far;
      U.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      U.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
      P.kernelRadius = AO.kernelRadius; P.minDistance = AO.minDistance; P.maxDistance = AO.maxDistance;
      // depth and normals, without the things that shouldn't occlude
      P.overrideVisibility();
      // Only the cake (and its candles) take part: the backdrop and floor are far away, where the
      // test is least reliable, and there's nothing on them to occlude.
      var root = opts.cakeRoot(); scene.children.forEach(function (c) { if (c !== root && !c.isLight && !c.isCamera) c.visible = false; });
      scene.traverse(function (o) {
        if (o.isSprite || o.isPoints || o.isLine || (o.material && !Array.isArray(o.material) && o.material.transparent) || (o.userData && o.userData.noAO)) o.visible = false;
      });
      P.renderOverride(renderer, P.normalMaterial, P.normalRenderTarget, 0x7777ff, 1.0);
      P.restoreVisibility();
      U.kernelRadius.value = P.kernelRadius; U.minDistance.value = P.minDistance; U.maxDistance.value = P.maxDistance;
      P.renderPass(renderer, P.ssaoMaterial, P.ssaoRenderTarget);
      P.renderPass(renderer, P.blurMaterial, P.blurRenderTarget);
      // multiply the occlusion onto the frame already on screen, at AO.strength
      if (!AO.mix) {
        AO.mix = new THREE.ShaderMaterial({
          uniforms: { tAO: { value: null }, uStrength: { value: AO.strength } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform sampler2D tAO; uniform float uStrength; varying vec2 vUv; void main(){ float a = texture2D(tAO, vUv).r; gl_FragColor = vec4(vec3(mix(1.0, a, uStrength)), 1.0); }',
          blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
          blendSrcAlpha: THREE.DstAlphaFactor, blendDstAlpha: THREE.ZeroFactor, depthTest: false, depthWrite: false
        });
      }
      AO.mix.uniforms.tAO.value = P.blurRenderTarget.texture; AO.mix.uniforms.uStrength.value = AO.strength;
      P.renderPass(renderer, AO.mix, null);
    }
    var passes = [
      { name: 'opaque',    run: function () { renderer.render(scene, camera); } },
      { name: 'occlusion', run: renderAO },
      { name: 'emissive',  run: renderEmissive }
    ];
    function render() { for (var i = 0; i < passes.length; i++) passes[i].run(); }
    function runPass(name) { for (var i = 0; i < passes.length; i++) if (passes[i].name === name) return passes[i].run(); }
    return { render: render, runPass: runPass, passes: passes, ao: AO, LAYER: LAYER, tag: tag };
  }
  window.CakePipeline = { create: create, LAYER: LAYER, tag: tag };
})();

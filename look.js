/* =====================================================================
   look.js — the scene's "look": shadows, environment, tone mapping.

   Kept out of app.js on purpose. app.js is the product (routing, builder,
   viewer, cutting, reminders); this file is how the render LOOKS, which
   will keep growing (flame halo, lighting presets, occasion skins) and
   wants to be tuned on its own. It knows nothing about cakes: it takes a
   renderer, a scene and a key light and makes them look like a clay render.

   What we learned building it (19 Sept 2026), rendered side by side:
   - A real SHADOW MAP is the big lever for this look. Candles shadow the
     frosting, each cap shadows the tier below, the cake sits on the floor.
     That's what "clay render" means — big soft shadows — and it grounds
     everything at once.
   - An ENVIRONMENT MAP barely registers on matte materials at this
     roughness (it adds diffuse tint, not sheen) and ACES TONE MAPPING
     desaturates the pastel palette. Both are kept here as options, off by
     default, for glossier skins later (ganache, glaze, satin ribbon).

   API (window.CakeLook):
     apply(renderer, scene, keyLight)   set everything up per LOOK
     tick(scene)                        cheap per-interval pass: shadow flags on new meshes
     rebuild(renderer, scene, keyLight) re-apply after tuning LOOK from the console
     LOOK                               the knobs
   ===================================================================== */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { console.warn('look.js: THREE not loaded'); return; }

  var LOOK = {
    // ---- Shadows: the lever ----
    shadows: true,
    shadowMapSize: 1024,           // one caster only; 1024 is the phone budget
    // VSM (variance shadow maps) rather than PCFSoft: PCFSoft ignores `radius` and has a
    // fixed small kernel, which is why v0.28's shadows read as cel-shaded. VSM blurs the map
    // itself, giving the wide, soft penumbra of a large light source (a window, a softbox)
    // rather than the crisp edge of a tiny distant sun.
    shadowType: 'VSM',             // 'VSM' | 'PCFSoft'
    shadowRadius: 9,               // VSM blur radius (in shadow-map texels)
    shadowBlurSamples: 12,
    shadowOpacity: 0.18,           // the cast shadow on the floor
    shadowColour: '#5a3c2e',       // warm-dark, not black: real shadows are tinted by the room
    shadowBias: -0.0002,
    shadowNormalBias: 0.03,
    // Ortho frustum around the whole scene (Showstopper + box + a lifted slice).
    shadowExtent: { half: 6.5, top: 8, bottom: -2, near: 1, far: 40 },
    // Contact disc under the cake (the pre-shadow grounding) fades to this once real
    // shadows exist, so it reads as soft ambient occlusion under the cast shadow.
    contactDiscScale: 0.5,

    // ---- Environment: off by default (see header) ----
    environment: false,
    sky: { top: '#efe3d5', horizon: '#cfc0b0', floor: '#7a6650' },
    window: { u: 0.30, v: 0.28, w: 0.16, h: 0.26, colour: '#ffffff', strength: 1.0 },
    rim:    { u: 0.80, v: 0.34, w: 0.20, h: 0.18, colour: '#dfe9ff', strength: 0.3 },
    bounce: { strength: 0.15, colour: '#ffd9b0' },
    size: 1024,

    // ---- Tone mapping: none by default (pastels) ----
    toneMapping: 'None',           // 'ACESFilmic' | 'Reinhard' | 'None'
    exposure: 1.0,

    // ---- Flame halo: the fake bloom ----
    // A sharp core sprite plus a large, very soft, additive halo on the same pivot. At 100
    // candles this is the difference between dots and a glow, and it's the prerequisite for
    // candlelight-as-light-source: flames have to look like they give off light.
    halo: {
      enabled: true,
      scale: 3.4,              // × the flame's size
      opacity: 0.30,
      colour: '#ffb55e',       // warm; the core stays yellow-white
      liftY: 0.02,             // sits a touch above the flame's centre
      maxHalos: 100            // over this, every other candle skips its halo
    },

    // Lighting to pair with this look. (Read by app.js at startup.)
    // A HEMISPHERE light replaces the flat white ambient: a cool sky tone from above and a warm
    // bounce from below fill the shadow side with colour instead of grey, which softens the
    // lit-to-shadow step — the other half of what made v0.28 look cel-shaded.
    lights: {
      hemiSky: '#e9f0ff', hemiGround: '#f0d6bd', hemi: 0.62,
      key: 0.82, fill: 0.22
    },

    // ---- Candlelight as the light source ----
    // On a dark background the room goes dim and the flames light the cake. The candle point
    // light already tracked the lit count; now it's strong enough to matter, scales with the
    // square root of the count (or one candle looks nearly as bright as twenty), and the room
    // lights step down with the background's darkness. Blowing the candles out visibly dims
    // the cake; relighting brings it back. Free drama that was being thrown away.
    night: {
      hemi: 0.20, key: 0.26, fill: 0.10,     // the room, at full darkness
      hemiSky: '#8fa4d6', hemiGround: '#6b5a52',
      // candle light: intensity = base + perSqrt·√lit, boosted by darkness
      candleBase: 0.12, candlePerSqrt: 0.30, candleBoost: 2.4, distance: 11, decay: 2,
      // materials get a faint self-glow so the shape never goes fully black, and the
      // message band gets a little more so the writing stays readable
      emissiveFrosting: 0.05, emissiveMessage: 0.14
    },
    // Darkness ramps from 0 at this background luminance…
    nightAbove: 0.55,
    // …to 1 at this one.
    nightBelow: 0.16
  };

  // 0 = daylight room, 1 = candlelit room, from the backdrop's luminance.
  function darknessFor(bgLuminance) {
    var t = (LOOK.nightAbove - bgLuminance) / (LOOK.nightAbove - LOOK.nightBelow);
    return Math.max(0, Math.min(1, t));
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // Room light intensities for a given darkness.
  function roomLights(d) {
    var L = LOOK.lights, N = LOOK.night;
    return {
      hemi: lerp(L.hemi, N.hemi, d), key: lerp(L.key, N.key, d), fill: lerp(L.fill, N.fill, d),
      hemiSky: new THREE.Color(L.hemiSky).lerp(new THREE.Color(N.hemiSky), d),
      hemiGround: new THREE.Color(L.hemiGround).lerp(new THREE.Color(N.hemiGround), d)
    };
  }
  // Candle light intensity for a lit count and darkness (flicker applied by the caller).
  function candleIntensity(lit, d) {
    var N = LOOK.night;
    return (N.candleBase + N.candlePerSqrt * Math.sqrt(Math.max(0, lit))) * (1 + N.candleBoost * d);
  }

  // ---------- environment (optional) ----------
  function rgba(h, a) {
    var s = h.replace('#', ''); var r = parseInt(s.substr(0, 2), 16), g = parseInt(s.substr(2, 2), 16), b = parseInt(s.substr(4, 2), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function drawStudio() {
    var W = LOOK.size, H = W / 2;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0.00, LOOK.sky.top); grad.addColorStop(0.48, LOOK.sky.horizon);
    grad.addColorStop(0.56, LOOK.sky.floor); grad.addColorStop(1.00, LOOK.sky.floor);
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    var bounce = g.createLinearGradient(0, H * 0.55, 0, H);
    bounce.addColorStop(0, rgba(LOOK.bounce.colour, 0)); bounce.addColorStop(1, rgba(LOOK.bounce.colour, LOOK.bounce.strength));
    g.fillStyle = bounce; g.fillRect(0, H * 0.55, W, H * 0.45);
    function patch(p) {
      var cx = p.u * W, cy = p.v * H, rx = p.w * W / 2, ry = p.h * H / 2;
      g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
      var rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      rg.addColorStop(0, rgba(p.colour, p.strength)); rg.addColorStop(0.55, rgba(p.colour, p.strength * 0.55)); rg.addColorStop(1, rgba(p.colour, 0));
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
    }
    patch(LOOK.window); patch(LOOK.rim);
    return c;
  }
  var envTarget = null;
  function applyEnvironment(renderer, scene) {
    if (envTarget) { envTarget.dispose(); envTarget = null; }
    if (!LOOK.environment) { scene.environment = null; return; }
    var tex = new THREE.CanvasTexture(drawStudio());
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.encoding = THREE.sRGBEncoding;
    var pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
    envTarget = pmrem.fromEquirectangular(tex);
    scene.environment = envTarget.texture;
    tex.dispose(); pmrem.dispose();
  }

  // ---------- tone mapping (optional) ----------
  function applyToneMapping(renderer) {
    renderer.toneMapping = { ACESFilmic: THREE.ACESFilmicToneMapping, Reinhard: THREE.ReinhardToneMapping, None: THREE.NoToneMapping }[LOOK.toneMapping] || THREE.NoToneMapping;
    renderer.toneMappingExposure = LOOK.exposure;
  }

  // ---------- shadows ----------
  var ground = null;
  function applyShadows(renderer, scene, key) {
    renderer.shadowMap.enabled = !!LOOK.shadows;
    renderer.shadowMap.type = LOOK.shadowType === 'PCFSoft' ? THREE.PCFSoftShadowMap : THREE.VSMShadowMap;
    if (!key) return;
    key.castShadow = !!LOOK.shadows;
    if (LOOK.shadows) {
      var e = LOOK.shadowExtent, cam = key.shadow.camera;
      key.shadow.mapSize.set(LOOK.shadowMapSize, LOOK.shadowMapSize);
      cam.left = -e.half; cam.right = e.half; cam.top = e.top; cam.bottom = e.bottom; cam.near = e.near; cam.far = e.far;
      cam.updateProjectionMatrix();
      key.shadow.bias = LOOK.shadowBias; key.shadow.normalBias = LOOK.shadowNormalBias;
      key.shadow.radius = LOOK.shadowRadius; key.shadow.blurSamples = LOOK.shadowBlurSamples;
      if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }   // resize/type change takes effect
      if (!ground) {
        // The floor only exists to catch the cast shadow; ShadowMaterial is invisible otherwise.
        ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: LOOK.shadowOpacity }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = 0.0015; ground.receiveShadow = true; ground.name = 'shadow-ground';
        ground.userData.__look = true;
        scene.add(ground);
      }
      ground.material.opacity = LOOK.shadowOpacity;
      ground.material.color.set(LOOK.shadowColour);
      ground.visible = true;
    } else if (ground) {
      ground.visible = false;
    }
  }
  // Give every mesh that arrives (cake, candles, box, wedges, confetti…) shadow flags once.
  // Called on an interval from the frame loop; a few hundred objects, trivially cheap.
  function tick(scene) {
    if (!LOOK.shadows) return;
    scene.traverse(function (o) {
      if (o.userData.__look || o.userData.__shadowed) return;
      if (o.isSprite) { o.userData.__shadowed = true; return; }
      if (o.isMesh || o.isInstancedMesh) {
        var m = o.material, basic = m && !Array.isArray(m) && (m.isMeshBasicMaterial || m.isShadowMaterial);
        // Basic-material helpers (contact disc, seams, flames) neither cast nor receive.
        o.castShadow = !basic; o.receiveShadow = !basic;
        o.userData.__shadowed = true;
      }
    });
  }

  // ---------- flame halo ----------
  var haloTex = null, haloMat = null;
  function makeHaloTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.00, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.18, 'rgba(255,235,190,0.55)');
    grad.addColorStop(0.45, 'rgba(255,190,110,0.18)');
    grad.addColorStop(1.00, 'rgba(255,150,60,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  // One shared material: halos don't lean-rotate, so they can share.
  function haloMaterial() {
    if (!haloMat) {
      haloTex = makeHaloTexture();
      haloMat = new THREE.SpriteMaterial({
        map: haloTex, color: new THREE.Color(LOOK.halo.colour),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        opacity: LOOK.halo.opacity, toneMapped: false
      });
      haloMat.__shared = true; haloTex.__shared = true;
    }
    haloMat.opacity = LOOK.halo.opacity; haloMat.color.set(LOOK.halo.colour);
    return haloMat;
  }

  function apply(renderer, scene, key) {
    applyToneMapping(renderer);
    applyEnvironment(renderer, scene);
    applyShadows(renderer, scene, key);
    scene.traverse(function (o) {
      var m = o.material; if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach(function (mm) { mm.needsUpdate = true; });
      if (o.userData) delete o.userData.__shadowed;
    });
    tick(scene);
  }

  window.CakeLook = { apply: apply, rebuild: apply, tick: tick, haloMaterial: haloMaterial,
                      darknessFor: darknessFor, roomLights: roomLights, candleIntensity: candleIntensity, LOOK: LOOK };
})();

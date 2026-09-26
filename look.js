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
    shadowType: 'PCSS',            // 'PCSS' | 'VSM' | 'PCFSoft'
    // PCSS: contact-hardening. Crisp where the caster touches, soft further away.
    pcss: {
      lightSize: 0.6,              // world units — how big the light is. Bigger = softer far penumbra.
                                   // (2.4 was the first guess; it's wider than the cake and dissolved every shadow.)
      samples: 13,                 // Poisson samples per pass (×3 lookups). 9 is cheap, 17 is silky.
      maxRadius: 0.035             // penumbra cap in shadow-map UV, so distant shadows don't dissolve
    },
    shadowRadius: 9,               // VSM blur radius (in shadow-map texels)
    shadowBlurSamples: 12,
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
    // Retuned (v0.37) for a LIT floor: the floor's paint colour × (ambient + direct) should land
    // close to the paint colour in daylight, so Cream renders as cream rather than clipping white.
    // v0.44: tuned on the phone — a brighter, airier room with lighter shadows (was 0.55 / 0.62 /
    // 0.20, i.e. the old values × 1.2 and × 0.8). Baked in as the design values so the dev
    // panel's multipliers still mean "as designed" at 1.0.
    lights: {
      hemiSky: '#e9f0ff', hemiGround: '#b8a48f', hemi: 0.66,
      key: 0.50, fill: 0.24
    },
    // Where the key light comes from. Directional, so only the direction matters: elevation
    // (low and raking → long shadows; high → short) and azimuth (which side of the room the
    // window is on). The defaults reproduce the original hand-placed position (−4, 7, 5).
    keyDir: { elevation: 47.5, azimuth: -38.7, distance: 9.5 },
    // Colour temperature of the key, in kelvin: 2700 is a tungsten lamp, 5000 a warm-ish
    // daylight, 8000 an overcast sky. Converted to RGB with the usual (Helland) fit.
    keyKelvin: 5000,
    // Any colour, overriding kelvin when set. -1 = "use kelvin". Stored as a 24-bit int so it
    // can ride in the lighting field; -1 there decodes back to "use kelvin".
    keyHex: -1,
    // ---- A spot light: the lamp over the table ----
    // Off by default. A LOCAL light, so distance finally matters: bring it closer and the light
    // pools on the cake, the falloff shows across the tiers, and its shadow fans out with
    // perspective. Casts a plain soft shadow: the PCSS patch assumes the key's parallel map.
    spot: {
      enabled: false,
      intensity: 1.6,
      elevation: 62, azimuth: 30, distance: 9,     // degrees, degrees, world units
      angle: 32, softness: 0.45,                   // cone half-angle (deg), penumbra 0–1
      kelvin: 3400,
      hex: -1,                                     // any colour; -1 = use kelvin
      castShadow: true, shadowMapSize: 1024,
      lightSize: 0.5,                              // world units: the size of the lamp. Contact-hardening softness.
      shadowFar: 60                                // fixed, so changing distance doesn't recompile
    },
    // ---- Colour bleed: the targeted fake for global illumination ----
    // Real GI (light bouncing between surfaces) is out of reach on a phone browser. This fakes
    // the one bounce a viewer would miss, in both directions:
    //   floor → cake: the hemisphere's ground colour becomes the lit floor paint, so the
    //                 undersides of the tiers are warmed by whatever the cake sits on;
    //   cake → floor: a soft disc of frosting colour on the floor around the cake, so the
    //                 cake appears to tint its surroundings.
    // `strength` 0 = off; `reach` = disc radius as a multiple of the bottom tier's.
    bleed: { strength: 0.5, reach: 1.7 },
    // Dev-panel multipliers on the room (ambient) and the sun/window (key). 1 = as designed.
    // The product sets the base from the sender's backdrop; these let you explore around it.
    ambientScale: 1.0,
    keyScale: 1.0,

    // ---- Candlelight as the light source ----
    // On a dark background the room goes dim and the flames light the cake. The candle point
    // light already tracked the lit count; now it's strong enough to matter, scales with the
    // square root of the count (or one candle looks nearly as bright as twenty), and the room
    // lights step down with the background's darkness. Blowing the candles out visibly dims
    // the cake; relighting brings it back. Free drama that was being thrown away.
    night: {
      hemi: 0.24, key: 0.21, fill: 0.12,     // the room, at full darkness (scaled with the day set, v0.44)
      hemiSky: '#8fa4d6', hemiGround: '#6b5a52',
      // candle light: intensity = base + perSqrt·√lit, boosted by darkness
      candleBase: 0.12, candlePerSqrt: 0.30, candleBoost: 2.4, distance: 11, decay: 2,
      // materials get a faint self-glow so the shape never goes fully black, and the
      // message band gets a little more so the writing stays readable
      emissiveFrosting: 0.05, emissiveMessage: 0.14
    },
    // Darkness ramps from 0 at this background luminance (sRGB terms; converted to linear
    // in darknessFor, since color.js makes Color channels linear)…
    nightAbove: 0.55,
    // …to 1 at this one.
    nightBelow: 0.16
  };

  // 0 = daylight room, 1 = candlelit room, from the backdrop's luminance.
  function darknessFor(bgLuminance) {
    var hi = THREE.Color.srgbToLinear(LOOK.nightAbove), lo = THREE.Color.srgbToLinear(LOOK.nightBelow);
    var t = (hi - bgLuminance) / (hi - lo);
    return Math.max(0, Math.min(1, t));
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // Room light intensities for a given darkness.
  // floorPaint (optional THREE.Color): the floor's paint, for the floor→cake bounce.
  function roomLights(d, floorPaint) {
    var L = LOOK.lights, N = LOOK.night;
    var ground = new THREE.Color(L.hemiGround).lerp(new THREE.Color(N.hemiGround), d);
    if (floorPaint && LOOK.bleed.strength > 0) {
      // The ground bounce IS the floor: pull its colour toward the paint, keeping the designed
      // brightness so a white floor doesn't turn the room into a lightbox.
      var gl = 0.2126 * ground.r + 0.7152 * ground.g + 0.0722 * ground.b;
      var pl = Math.max(0.05, 0.2126 * floorPaint.r + 0.7152 * floorPaint.g + 0.0722 * floorPaint.b);
      var tinted = floorPaint.clone().multiplyScalar(gl / pl);
      ground.lerp(tinted, LOOK.bleed.strength);
    }
    return {
      hemi: lerp(L.hemi, N.hemi, d) * LOOK.ambientScale,
      key: lerp(L.key, N.key, d) * LOOK.keyScale,
      fill: lerp(L.fill, N.fill, d) * LOOK.ambientScale,
      hemiSky: new THREE.Color(L.hemiSky).lerp(new THREE.Color(N.hemiSky), d),
      hemiGround: ground
    };
  }

  // The cake→floor disc. Owned here; app.js tells it the colour, radius and whether a cake is
  // on the floor. A painted decal is honest for this one: it's ADDING bounced colour, and its
  // opacity follows the room's brightness so it vanishes in the dark.
  var bleedDisc = null, bleedTex = null;
  function bleedDiscFor(scene) {
    if (bleedDisc) return bleedDisc;
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0.00, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.32)');
    grad.addColorStop(1.00, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    bleedTex = new THREE.CanvasTexture(c); bleedTex.encoding = THREE.sRGBEncoding;
    bleedDisc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: bleedTex, transparent: true, depthWrite: false, opacity: 0 }));
    bleedDisc.rotation.x = -Math.PI / 2; bleedDisc.position.y = 0.0025; bleedDisc.renderOrder = -2;
    bleedDisc.name = 'bleed-disc'; bleedDisc.userData.__look = true;
    scene.add(bleedDisc);
    return bleedDisc;
  }
  // colour: THREE.Color (the frosting); radius: bottom tier radius; lit: room brightness 0–1+;
  // candle: candle light intensity (so a candlelit cake still bleeds a little in the dark).
  function setBleed(scene, colour, radius, visible, lit, candle) {
    var disc = bleedDiscFor(scene), B = LOOK.bleed;
    disc.visible = !!visible && B.strength > 0;
    if (!disc.visible) return;
    var r = radius * B.reach;
    disc.scale.set(r * 2, r * 2, 1);
    disc.material.color.copy(colour);
    var glow = Math.min(1, lit) + Math.min(0.5, (candle || 0) / 8);
    disc.material.opacity = B.strength * 0.55 * glow;
  }
  // Kelvin → RGB (Tanner Helland's fit; good enough between 1000K and 12000K).
  function kelvinToColor(k, out) {
    var t = Math.max(1000, Math.min(12000, k)) / 100, r, g, b;
    if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
    else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
    if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    var c = function (v) { return Math.max(0, Math.min(255, v)) / 255; };
    out = out || new THREE.Color();
    return out.setRGB(c(r), c(g), c(b)).convertSRGBToLinear();   // the fit is in sRGB terms
  }
  // Key light position from LOOK.keyDir (degrees). Distance is cosmetic for a directional
  // light; it only keeps the shadow camera's near plane sensible.
  function keyPosition(out) {
    var e = LOOK.keyDir.elevation * Math.PI / 180, a = LOOK.keyDir.azimuth * Math.PI / 180, d = LOOK.keyDir.distance;
    out = out || new THREE.Vector3();
    return out.set(d * Math.cos(e) * Math.sin(a), d * Math.sin(e), d * Math.cos(e) * Math.cos(a));
  }
  function spotPosition(out) {
    var S = LOOK.spot, e = S.elevation * Math.PI / 180, a = S.azimuth * Math.PI / 180, d = S.distance;
    out = out || new THREE.Vector3();
    return out.set(d * Math.cos(e) * Math.sin(a), d * Math.sin(e), d * Math.cos(e) * Math.cos(a));
  }
  // Apply LOOK.spot to a THREE.SpotLight (position, cone, colour, shadow).
  function applySpot(spot) {
    if (!spot) return;
    var S = LOOK.spot;
    spot.visible = !!S.enabled;
    spot.intensity = S.intensity;
    spotPosition(spot.position);
    spot.angle = S.angle * Math.PI / 180;
    spot.penumbra = S.softness;
    spot.distance = S.distance * 3;                 // reach: well past the cake
    spot.decay = 2;
    if (S.hex >= 0) spot.color.setHex(S.hex); else kelvinToColor(S.kelvin, spot.color);
    spot.castShadow = !!(S.enabled && S.castShadow && LOOK.shadows);
    if (spot.shadow) {
      if (spot.shadow.mapSize.x !== S.shadowMapSize) { spot.shadow.mapSize.set(S.shadowMapSize, S.shadowMapSize); if (spot.shadow.map) { spot.shadow.map.dispose(); spot.shadow.map = null; } }
      spot.shadow.camera.near = 1; spot.shadow.camera.far = S.shadowFar;
      spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.03;
      // Under PCSS, shadow.radius > 0 flags a perspective map and carries tan(half-cone), so the
      // shader can turn world sizes into map UV at any depth. (SpotLightShadow's fov = 2·angle.)
      spot.shadow.radius = (LOOK.shadowType === 'PCSS') ? Math.tan(spot.angle) : LOOK.shadowRadius;
      spot.shadow.camera.updateProjectionMatrix();
    }
  }
  // How much light an upward-facing floor receives under these lights (≈1 in daylight).
  // Hemisphere: an up normal sees the sky colour at full weight. Key: cos of its elevation.
  function litFactor(R, keyDir, keyColour) {
    var skyL = 0.2126 * R.hemiSky.r + 0.7152 * R.hemiSky.g + 0.0722 * R.hemiSky.b;
    var kL = keyColour ? (0.2126 * keyColour.r + 0.7152 * keyColour.g + 0.0722 * keyColour.b) : 1;
    var cos = keyDir ? Math.max(0, keyDir.y) : 0.74;
    return R.hemi * skyL + R.key * cos * kL;
  }
  // Candle light intensity for a lit count and darkness (flicker applied by the caller).
  // Exactly zero with no flames: the base term only exists once something is burning.
  function candleIntensity(lit, d) {
    var N = LOOK.night;
    lit = Math.max(0, lit);
    if (lit <= 0) return 0;
    return (N.candleBase * Math.min(1, lit) + N.candlePerSqrt * Math.sqrt(lit)) * (1 + N.candleBoost * d);
  }
  // The cake's faint self-glow at night. It stands in for the candlelight bouncing around
  // inside the frosting, so it follows the candles: full with them lit, nothing with them out.
  // (It used to follow the backdrop, which made the cake glow in a room with no light at all.)
  function glowFactor(litFraction, d) { return d * Math.max(0, Math.min(1, litFraction)); }

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
    if (LOOK.rigOwnsEnvironment) return;                // v1.39: the lighting rig (rig.js) owns the environment
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
  function applyShadows(renderer, scene, key) {
    renderer.shadowMap.enabled = !!LOOK.shadows;
    var type = LOOK.shadowType;
    if (type === 'PCSS' && !window.CakePCSS) type = 'VSM';         // pcss.js not loaded: fall back
    if (window.CakePCSS) {
      if (type === 'PCSS' && LOOK.shadows) {
        var e0 = LOOK.shadowExtent;
        CakePCSS.install({ lightSize: LOOK.pcss.lightSize, samples: LOOK.pcss.samples, maxRadius: LOOK.pcss.maxRadius,
                           frustumWidth: e0.half * 2, near: e0.near, far: e0.far,
                           spotLightSize: LOOK.spot.lightSize, spotNear: 1, spotFar: LOOK.spot.shadowFar });
      } else {
        CakePCSS.uninstall();
      }
    }
    // PCSS reads a plain depth map, so its renderer type is PCF; VSM stores moments instead.
    renderer.shadowMap.type = type === 'PCFSoft' ? THREE.PCFSoftShadowMap
                            : type === 'PCSS' ? THREE.PCFShadowMap
                            : THREE.VSMShadowMap;
    if (!key) return;
    key.castShadow = !!LOOK.shadows;
    if (LOOK.shadows) {
      var e = LOOK.shadowExtent, cam = key.shadow.camera;
      key.shadow.mapSize.set(LOOK.shadowMapSize, LOOK.shadowMapSize);
      cam.left = -e.half; cam.right = e.half; cam.top = e.top; cam.bottom = e.bottom; cam.near = e.near; cam.far = e.far;
      cam.updateProjectionMatrix();
      key.shadow.bias = LOOK.shadowBias; key.shadow.normalBias = LOOK.shadowNormalBias;
      // Under PCSS, shadow.radius is repurposed as the projection flag: 0 = orthographic (the key).
      key.shadow.radius = (type === 'PCSS') ? 0 : LOOK.shadowRadius; key.shadow.blurSamples = LOOK.shadowBlurSamples;
      if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }   // resize/type change takes effect
      // No shadow-catching plane any more: the stage's lit floor (stage.js) receives the
      // shadow as a real lack of direct light, which is what a shadow is.
    }
  }
  // Give a mesh (or a subtree) its shadow flags. Call this AT CREATION, before the first
  // draw: a mesh's shadow flags are part of its shader's signature, so flagging it a frame
  // later meant every new mesh compiled its shader twice — the second time with the full
  // PCSS filter, right when the user was tapping. That was the "freeze" on cutting a slice.
  function adopt(root) {
    if (!LOOK.shadows || !root) return root;
    root.traverse(function (o) {
      if (o.userData.__look || o.userData.__shadowed) return;
      if (o.isSprite) { o.userData.__shadowed = true; return; }
      if (o.isMesh || o.isInstancedMesh) {
        var m = o.material, basic = m && !Array.isArray(m) && (m.isMeshBasicMaterial || m.isShadowMaterial);
        // Basic-material helpers (contact disc, seams, flames) neither cast nor receive.
        o.castShadow = !basic; o.receiveShadow = !basic;
        o.userData.__shadowed = true;
      }
    });
    return root;
  }
  // Safety net for anything that wasn't adopted at creation. Interval-driven from the frame loop.
  function tick(scene) { adopt(scene); }

  // ---------- shader warm-up ----------
  // Three compiles a material's shader on its first draw, and the PCSS variant is heavy. So
  // one tiny mesh per shader variant the app ever uses lives permanently under the floor —
  // inside the shadow frustum, hidden by the floor — and every program (including the
  // shadow-depth variants) compiles on the very first frame instead of mid-gesture.
  // A pair of tiny permanent casters under the floor so the shadow-DEPTH programs (plain and
  // instanced) compile on the first frame. renderer.compile() doesn't cover the shadow pass.
  // The material programs themselves are warmed by app.js's warmCompile(), which builds one
  // of each real thing the app makes rather than a hand-written list.
  function warmUp(scene) {
    var g = new THREE.Group(); g.name = 'shader-warmup'; g.position.y = -0.6;
    var tiny = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    var m = new THREE.Mesh(tiny, new THREE.MeshStandardMaterial({ roughness: 0.6 })); m.castShadow = true; m.receiveShadow = true; g.add(m);
    var inst = new THREE.InstancedMesh(tiny, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 1);
    inst.castShadow = true; inst.receiveShadow = true; inst.setMatrixAt(0, new THREE.Matrix4()); g.add(inst);
    g.traverse(function (o) { o.userData.__look = true; });
    scene.add(g);
    return g;
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
      CakeResources.keep(haloMat); CakeResources.keep(haloTex);
    }
    haloMat.opacity = LOOK.halo.opacity; haloMat.color.set(LOOK.halo.colour);
    return haloMat;
  }

  var warmed = false;
  function apply(renderer, scene, key) {
    applyToneMapping(renderer);
    applyEnvironment(renderer, scene);
    applyShadows(renderer, scene, key);
    if (!warmed) { warmUp(scene); warmed = true; }
    scene.traverse(function (o) {
      var m = o.material; if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach(function (mm) { mm.needsUpdate = true; });
      if (o.userData) delete o.userData.__shadowed;
    });
    tick(scene);
  }

  // The one-rung emergency fallback. Only for a phone that genuinely can't hold the target,
  // sustained over several seconds: hard shadows, no halos. Never touches resolution.
  function emergency(on, renderer, scene, key) {
    LOOK.shadowType = on ? 'PCFSoft' : 'PCSS';
    LOOK.halo.enabled = !on;
    apply(renderer, scene, key);
  }
  // ---------- lighting as data ----------
  // The lighting is part of the cake the sender saw, so it travels in the link. A fixed-order
  // list of numbers; `''` when everything is at its default so an unlit cake's link doesn't
  // grow. Ranges are clamped on the way back in — a malformed field is ignored, never fatal.
  var LIGHT_FIELDS = [
    // [getter, setter, default, min, max, decimals]
    [function () { return LOOK.ambientScale; },      function (v) { LOOK.ambientScale = v; },      1,    0, 3, 2],
    [function () { return LOOK.keyScale; },          function (v) { LOOK.keyScale = v; },          1,    0, 3, 2],
    [function () { return LOOK.keyDir.elevation; },  function (v) { LOOK.keyDir.elevation = v; },  47.5, 1, 89, 1],
    [function () { return LOOK.keyDir.azimuth; },    function (v) { LOOK.keyDir.azimuth = v; },    -38.7, -180, 180, 1],
    [function () { return LOOK.keyKelvin; },         function (v) { LOOK.keyKelvin = v; },         5000, 1500, 12000, 0],
    [function () { return LOOK.pcss.lightSize; },    function (v) { LOOK.pcss.lightSize = v; },    0.6,  0.02, 3, 2],
    [function () { return LOOK.spot.enabled ? 1 : 0; }, function (v) { LOOK.spot.enabled = v >= 0.5; }, 0, 0, 1, 0],
    [function () { return LOOK.spot.intensity; },    function (v) { LOOK.spot.intensity = v; },    1.6,  0, 20, 2],
    [function () { return LOOK.spot.elevation; },    function (v) { LOOK.spot.elevation = v; },    62,   1, 89, 1],
    [function () { return LOOK.spot.azimuth; },      function (v) { LOOK.spot.azimuth = v; },      30,   -180, 180, 1],
    [function () { return LOOK.spot.distance; },     function (v) { LOOK.spot.distance = v; },     9,    1, 40, 1],
    [function () { return LOOK.spot.angle; },        function (v) { LOOK.spot.angle = v; },        32,   1, 89, 1],
    [function () { return LOOK.spot.softness; },     function (v) { LOOK.spot.softness = v; },     0.45, 0, 1, 2],
    [function () { return LOOK.spot.kelvin; },       function (v) { LOOK.spot.kelvin = v; },       3400, 1500, 12000, 0],
    [function () { return LOOK.spot.lightSize; },    function (v) { LOOK.spot.lightSize = v; },    0.5,  0.02, 3, 2],
    // appended (v0.51): colour bleed. Older 15-number strings leave these at default.
    [function () { return LOOK.bleed.strength; },    function (v) { LOOK.bleed.strength = v; },    0.5,  0, 1, 2],
    [function () { return LOOK.bleed.reach; },       function (v) { LOOK.bleed.reach = v; },       1.7,  1, 3, 2],
    // appended (v0.52): explicit colours. -1 = use kelvin. Older strings leave them at -1.
    [function () { return LOOK.keyHex; },            function (v) { LOOK.keyHex = v; },            -1,   -1, 0xFFFFFF, 0],
    [function () { return LOOK.spot.hex; },          function (v) { LOOK.spot.hex = v; },          -1,   -1, 0xFFFFFF, 0]
  ];
  function serializeLighting() {
    var allDefault = true, out = [];
    LIGHT_FIELDS.forEach(function (f) {
      var v = +f[0]().toFixed(f[5]);
      if (Math.abs(v - f[2]) > 1e-9) allDefault = false;
      out.push(String(v));
    });
    return allDefault ? '' : out.join('~');
  }
  // Returns true if anything was applied. Unknown or malformed → nothing changes.
  function applyLighting(str) {
    if (!str) return false;
    var parts = String(str).split('~');
    if (parts.length < 6) return false;
    var applied = false;
    LIGHT_FIELDS.forEach(function (f, i) {
      if (i >= parts.length) return;
      var v = parseFloat(parts[i]);
      if (!isFinite(v)) return;
      f[1](Math.max(f[3], Math.min(f[4], v)));
      applied = true;
    });
    return applied;
  }
  function resetLighting() { LIGHT_FIELDS.forEach(function (f) { f[1](f[2]); }); }

  window.CakeLook = {
    serializeLighting: serializeLighting, applyLighting: applyLighting, resetLighting: resetLighting, setBleed: setBleed, apply: apply, rebuild: apply, tick: tick, adopt: adopt, haloMaterial: haloMaterial, emergency: emergency, litFactor: litFactor, glowFactor: glowFactor, keyPosition: keyPosition, kelvinToColor: kelvinToColor, applySpot: applySpot,
                      darknessFor: darknessFor, roomLights: roomLights, candleIntensity: candleIntensity, LOOK: LOOK };
})();

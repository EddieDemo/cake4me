/* confetti.js — the confetti burst when the candles go out (v1.15, refactor step 7).
   create(deps) → { mesh, pieces, burst(colors, count), update(dt, t), rebuildLandings(cfg),
                    setLandings(list), clear(), active() }
   One instanced mesh of pieces; each falls with its own air, lands on the cake's tops or the
   plate (the landings), settles and rests. deps: scene, camera, tiersFor(cfg), PLATE_TOP(). */
(function () {
  function create(deps) {
    var CONFETTI = {
      max: 420,            // pool size; new bursts recycle the oldest settled pieces
      size: 0.15,          // width of a piece
      thick: 0.012,        // real thickness: a flat quad vanishes edge-on
      gravity: 5.4,
      dragFlat: 1.15,      // broadside drag. Was 3.1 — high enough that pieces hit terminal
                           // velocity in a few frames, and since lift scales with speed there
                           // was nothing left to push them sideways.
      dragEdge: 0.16,      // edge-on: it slices
      lift: 3.4,           // sideways force from angle of attack
      torque: 5.2,         // AERODYNAMIC TORQUE — the air drives the flipping, not just resists it
      spinDamp: 0.16,      // light. Paper keeps tumbling until it lands.
      spin: 7,             // initial tumble, rad/s
      wind: 0.5,           // amplitude of the shared, slowly-varying air current
      maxSpin: 13,         // rad/s — torque feedback is unbounded, so cap it
      settleMs: 7000,      // after this, gravity ramps up so nothing can hover forever
      forceMs: 12000,      // hard stop: drop it straight down
      streamMs: 420,       // spawn spread over time, so it streams in rather than popping
      marginY: 1.2         // extra height above the top of frame
    };

    // Fall archetypes. Real confetti shows all of these at once, and that variety is most
    // of what makes it read as paper rather than particles.
    //   flutter   — rocks side to side, strong torque response, the classic falling leaf
    //   tumble    — turns end over end continuously and drifts steadily one way
    //   autorotate— spins about its own axis and descends in a slow helix (sycamore seed)
    var FALL = [
      { name: 'flutter',    w: 0.46, torque: 1.35, spinDamp: 1.0,  drag: 1.0,  seed: 0.6 },
      { name: 'tumble',     w: 0.34, torque: 0.55, spinDamp: 0.55, drag: 0.85, seed: 1.7 },
      { name: 'autorotate', w: 0.20, torque: 0.30, spinDamp: 0.25, drag: 1.25, seed: 2.4 }
    ];
    function pickFall() {
      var r = Math.random(), acc = 0;
      for (var i = 0; i < FALL.length; i++) { acc += FALL[i].w; if (r <= acc) return FALL[i]; }
      return FALL[0];
    }
    var confettiGeo = new THREE.BoxGeometry(CONFETTI.size, CONFETTI.thick, CONFETTI.size * 1.5);
    // vertexColors (needed below) makes the shader multiply by the geometry's `color`
    // attribute as well as instanceColor. BoxGeometry has no `color`, so it defaults to
    // zero and everything renders black. Give it a white one.
    (function () {
      var n = confettiGeo.attributes.position.count;
      var arr = new Float32Array(n * 3);
      for (var i = 0; i < arr.length; i++) arr[i] = 1;
      confettiGeo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    })();
    CakeResources.keep(confettiGeo);
    // vertexColors MUST be true: in r128 the instancing-colour shader chunk writes
    // instanceColor into vColor, but the fragment shader only multiplies it into the
    // diffuse when USE_COLOR is defined — which comes from vertexColors, not from
    // instanceColor existing. Without it every piece renders white.
    var confettiMat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, vertexColors: true });
    CakeResources.keep(confettiMat);
    var confetti = new THREE.InstancedMesh(confettiGeo, confettiMat, CONFETTI.max);
    confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Allocate the colour buffer at full size up front. Letting setColorAt create it
    // lazily sizes it to whatever `count` happens to be at the first burst, and the
    // second burst then writes off the end of the array in silence.
    confetti.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CONFETTI.max * 3), 3);
    confetti.instanceColor.setUsage(THREE.DynamicDrawUsage);
    confetti.count = 0;
    confetti.frustumCulled = false;
    if (window.CakeLook) CakeLook.adopt(confetti);
    deps.scene.add(confetti);
    var confettiPieces = [];           // { p, v, rot, rv, phase, resting }
    var confettiActive = 0;            // how many are still moving
    var _dummy = new THREE.Object3D();
    var _col = new THREE.Color();

    // Landing surfaces, outer first: [{ y, r, rInner }]. Rebuilt with the cake.
    var landings = [];
    function rebuildLandings(cfg) {
      landings = [];
      var tiers = deps.tiersFor(cfg);
      var y = deps.PLATE_TOP();
      tiers.forEach(function (t, i) {
        y += t.h;
        var inner = (i < tiers.length - 1) ? tiers[i + 1].r : 0;
        landings.push({ y: y, r: t.r + 0.06, rInner: inner });
      });
      landings.reverse();              // highest tier first
    }

    // World height that is just off the top of the screen, at the cake's own depth.
    // A fixed offset above the cake is visible on screen at low camera elevations, which
    // is why pieces appeared to pop into existence.
    var _ndc = new THREE.Vector3();
    function offscreenTop() {
      _ndc.set(0, 1, 0.5).unproject(deps.camera);            // top-centre of the frustum
      var dir = _ndc.clone().sub(deps.camera.position).normalize();
      // Walk that ray to the vertical axis of the cake and read off its height there.
      var t = (dir.z !== 0) ? (-deps.camera.position.z / dir.z) : 1;
      var y = deps.camera.position.y + dir.y * Math.max(0.1, t);
      return Math.max((landings.length ? landings[0].y : 2) + 2, y + CONFETTI.marginY);
    }

    function confettiBurst(colors, count) {
      var pal = colors.map(function (c) { return new THREE.Color(c); });
      var top = offscreenTop();
      var spread = (landings.length ? landings[landings.length - 1].r : 2.2) * 2.1;
      for (var i = 0; i < count; i++) {
        var piece;
        if (confettiPieces.length < CONFETTI.max) {
          piece = { p: new THREE.Vector3(), v: new THREE.Vector3(),
                    // Orientation as a quaternion with a free angular-velocity vector, not
                    // Euler increments: the spin axis can precess, so tumbling looks
                    // irregular instead of turning about one fixed axis forever.
                    q: new THREE.Quaternion(), w: new THREE.Vector3(),
                    rot: new THREE.Euler(), phase: 0, resting: false, col: new THREE.Color(),
                    sx: 1, sz: 1, delay: 0, born: 0, mass: 1, fall: FALL[0] };
          confettiPieces.push(piece);
        } else {
          // Recycle the oldest settled piece so repeated bursts accumulate without growing.
          piece = null;
          for (var k = 0; k < confettiPieces.length; k++) {
            if (confettiPieces[k].resting) { piece = confettiPieces.splice(k, 1)[0]; confettiPieces.push(piece); break; }
          }
          if (!piece) continue;
        }
        var a = Math.random() * Math.PI * 2;
        var rr = spread * Math.sqrt(Math.random());
        piece.p.set(Math.sin(a) * rr, top + Math.random() * 2.4, Math.cos(a) * rr);
        piece.v.set((Math.random() - 0.5) * 1.6, -0.3 - Math.random() * 0.7, (Math.random() - 0.5) * 1.6);
        piece.q.setFromEuler(_e.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28));
        piece.w.set((Math.random() - 0.5) * CONFETTI.spin,
                    (Math.random() - 0.5) * CONFETTI.spin,
                    (Math.random() - 0.5) * CONFETTI.spin);
        piece.fall = pickFall();
        if (piece.fall.name === 'autorotate') {
          // Autorotators spin mostly about their own face normal.
          piece.w.set((Math.random() - 0.5) * 1.2, (6 + Math.random() * 5) * (Math.random() < 0.5 ? -1 : 1), (Math.random() - 0.5) * 1.2);
        }
        // Slight mass variation so terminal velocities differ — without it the whole burst
        // descends as one uniform curtain.
        piece.mass = 0.75 + Math.random() * 0.6;
        piece.phase = Math.random() * 6.28;
        piece.resting = false;
        // Mixed stock, like a real handful: squares, long strips, a few big flakes.
        var shape = Math.random();
        piece.sx = shape < 0.25 ? 0.55 + Math.random() * 0.2 : 0.8 + Math.random() * 0.5;
        piece.sz = shape < 0.25 ? 1.5 + Math.random() * 0.7 : 0.8 + Math.random() * 0.5;
        // Held back so the burst streams in over ~400ms instead of appearing as a block.
        piece.delay = Math.random() * CONFETTI.streamMs;
        piece.born = performance.now();
        piece.col.copy(pal[i % pal.length]);
      }
      confetti.count = confettiPieces.length;
      confettiActive = 1;              // wake the update loop
      writeConfetti();
    }

    function writeConfetti() {
      for (var i = 0; i < confettiPieces.length; i++) {
        var c = confettiPieces[i];
        _dummy.position.copy(c.p);
        _dummy.quaternion.copy(c.q);
        _dummy.scale.set(c.sx, 1, c.sz);
        // Not yet released: park it at zero scale rather than showing it waiting.
        if (c.delay > 0 && performance.now() - c.born < c.delay) _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        confetti.setMatrixAt(i, _dummy.matrix);
        if (confetti.setColorAt) confetti.setColorAt(i, c.col);
      }
      confetti.instanceMatrix.needsUpdate = true;
      if (confetti.instanceColor) confetti.instanceColor.needsUpdate = true;
    }

    function landingFor(x, z, yFrom, yTo) {
      // Which surface, if any, this piece passed through on its way down.
      var d2 = x * x + z * z;
      for (var i = 0; i < landings.length; i++) {
        var L = landings[i];
        if (yFrom > L.y && yTo <= L.y && d2 <= L.r * L.r && d2 >= L.rInner * L.rInner) return L.y;
      }
      return (yTo <= 0) ? 0 : null;
    }

    // Orientation-coupled aerodynamics with feedback.
    //
    // The previous version had drag and lift depending on orientation, but nothing the
    // other way round: the forces never changed how the piece was facing. Real falling
    // paper is a loop — it presents a face to the air, that generates a TORQUE about its
    // centre of pressure, the torque flips it, the new orientation changes the force, and
    // round it goes. That loop is what produces the rock-flip-rock of real confetti, and
    // without it rotation and translation just run alongside each other, which reads as
    // "everything falls the same way".
    var _n = new THREE.Vector3(), _vn = new THREE.Vector3(), _liftDir = new THREE.Vector3(),
        _torque = new THREE.Vector3(), _e = new THREE.Euler(), _dq = new THREE.Quaternion(),
        _wq = new THREE.Quaternion(), _air = new THREE.Vector3();

    // One shared, slowly-varying air current. Cheap, and it makes the burst behave like a
    // cloud in a room rather than 200 independent particles.
    function airAt(t) {
      _air.set(
        Math.sin(t * 0.31) * 0.6 + Math.sin(t * 0.13 + 1.7) * 0.4,
        Math.sin(t * 0.21 + 0.6) * 0.18,
        Math.cos(t * 0.27 + 2.1) * 0.6 + Math.cos(t * 0.11) * 0.4
      );
      return _air.multiplyScalar(CONFETTI.wind);
    }

    function updateConfetti(dt, t) {
      if (!confettiActive) return;
      var now = performance.now();
      var moving = 0;
      var air = airAt(t);
      for (var i = 0; i < confettiPieces.length; i++) {
        var c = confettiPieces[i];
        if (c.resting) continue;
        moving++;
        if (c.delay > 0 && now - c.born < c.delay) continue;     // not released yet

        var fall = c.fall;

        // Face normal in world space (the piece is a flat slab in its own XZ plane).
        _n.set(0, 1, 0).applyQuaternion(c.q);

        // Velocity relative to the moving air is what the piece actually feels.
        _vn.copy(c.v).sub(air);
        var speed = _vn.length();

        if (speed > 0.0001) {
          _vn.multiplyScalar(1 / speed);
          var dotNV = _n.dot(_vn);
          var face = Math.abs(dotNV);                 // 1 = broadside, 0 = edge-on

          // Drag, quadratic, scaled by how much area is presented.
          var cd = (CONFETTI.dragEdge + (CONFETTI.dragFlat - CONFETTI.dragEdge) * face) * fall.drag / c.mass;
          c.v.addScaledVector(_vn, -Math.min(speed, cd * speed * speed * dt));

          // Lift perpendicular to travel, peaking at ~45° angle of attack.
          var aoa = face * (1 - face) * 4;
          _liftDir.copy(_n).addScaledVector(_vn, -dotNV);
          if (_liftDir.lengthSq() > 1e-6) {
            _liftDir.normalize();
            c.v.addScaledVector(_liftDir, (dotNV > 0 ? -1 : 1) * CONFETTI.lift * aoa * speed * dt / c.mass);
          }

          // AERODYNAMIC TORQUE. The centre of pressure sits ahead of the centre of mass on
          // a flat plate, so the air twists it toward edge-on — it overshoots, flips, and
          // the cycle repeats. Torque axis is normal × velocity.
          _torque.crossVectors(_n, _vn).multiplyScalar(
            CONFETTI.torque * fall.torque * speed * dotNV * dt / c.mass
          );
          c.w.add(_torque);
        }

        // Lift with a torque feedback loop can, occasionally, keep one piece hovering
        // indefinitely — which would leave this whole loop running forever on someone's
        // phone. Age ramps gravity up so everything lands eventually.
        var age = now - c.born;
        var extraG = age > CONFETTI.settleMs
          ? 1 + 2.5 * Math.min(1, (age - CONFETTI.settleMs) / (CONFETTI.forceMs - CONFETTI.settleMs))
          : 1;
        c.v.y -= CONFETTI.gravity * extraG * dt;
        if (age > CONFETTI.forceMs) { c.v.x *= 0.9; c.v.z *= 0.9; }
        var yPrev = c.p.y;
        c.p.addScaledVector(c.v, dt);

        // Integrate the quaternion from the angular-velocity vector.
        var wlen = c.w.length();
        if (wlen > 0.0001) {
          _wq.setFromAxisAngle(_torque.copy(c.w).multiplyScalar(1 / wlen), wlen * dt);
          c.q.premultiply(_wq).normalize();
        }
        c.w.multiplyScalar(Math.max(0, 1 - CONFETTI.spinDamp * fall.spinDamp * dt));
        var wl = c.w.length();
        if (wl > CONFETTI.maxSpin) c.w.multiplyScalar(CONFETTI.maxSpin / wl);

        var land = landingFor(c.p.x, c.p.z, yPrev, c.p.y);
        if (land !== null) {
          c.p.y = land + CONFETTI.thick * 0.5 + 0.002;
          c.p.x += c.v.x * 0.04;                       // a little slide on impact
          c.p.z += c.v.z * 0.04;
          c.q.setFromEuler(_e.set((Math.random() - 0.5) * 0.24, Math.random() * 6.28, (Math.random() - 0.5) * 0.24));
          c.resting = true;
          moving--;
        }
      }
      writeConfetti();
      if (moving === 0) confettiActive = 0;    // everything has settled: stop updating
    }
    function setLandings(l) { landings = l; }
    return { mesh: confetti, pieces: confettiPieces, burst: confettiBurst, update: updateConfetti, rebuildLandings: rebuildLandings,
             setLandings: setLandings, clear: function () { confettiPieces.length = 0; confetti.count = 0; confettiActive = 0; }, active: function () { return confettiActive; } };
  }
  window.CakeConfetti = { create: create };
})();

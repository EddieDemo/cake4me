/* spin.js — the cake's spin, per frame (v1.19, refactor step 7).
   create(deps) → { idleRate(), update(now, dt) }
   Momentum (S.omega) turns the camera round the cake, easing to the ambient turn when no one's
   holding it; a fast spin makes a wind that leans the flames and, past a point, sends a wave over
   them (blowout.js); so does a breath into the microphone. The spin's state is the object S
   (app.js); its input handlers (drag, flick, tilt) stay with the rest of the viewer's input.
   deps: S, SPIN, blow, wave, setLean, reduceMotion(), get/setAzimuth, getLean/setLeanNow. */
(function () {
  function create(deps) {
    function idleRate() { return document.body.classList.contains('mode-builder') ? 0 : deps.SPIN.idle; }
    function updateSpin(now, dt) {
      // Drag sets omega directly (see the pointer handlers). Otherwise coast toward idle.
      // Constant deceleration toward the ambient orbit, not exponential decay.
      // Exponential sheds big speeds almost instantly, which is what made a hard
      // flick feel like it was being clamped. With friction, twice the speed coasts
      // for twice as long, which is how a real turntable behaves.
      //
      // This runs while dragging too: the cake keeps its momentum under your thumb,
      // the way brushing a spinning turntable does. Hold it still long enough and
      // friction bleeds the speed away, so a press-and-hold still settles it.
      // A finger on the cake holds it: no momentum, no ambient turn — it follows the thumb 1:1.
      if (deps.S.dragging) { deps.S.omega = 0; }
      var target = (deps.S.dragging || now < deps.S.idleResumeAt) ? 0 : idleRate();
      var diff = deps.S.omega - target;
      var step = deps.SPIN.friction * dt;
      if (Math.abs(diff) <= step) deps.S.omega = target;
      else deps.S.omega -= Math.sign(diff) * step;
      if (!isFinite(deps.S.omega)) deps.S.omega = deps.SPIN.idle;           // only guard left: never let NaN in
      // The camera orbits; the cake never moves. Negative so a rightward drag still
      // makes the cake appear to turn to the right.
      if (!deps.reduceMotion()) deps.setAzimuth(deps.getAzimuth() - deps.S.omega * dt);
      // Unbounded spin means azimuth could run away over a long session; fold it back
      // by whole turns so the float never loses precision. Invisible: same angle.
      var az = deps.getAzimuth();
      if (az > Math.PI * 20 || az < -Math.PI * 20) {
        deps.setAzimuth(az - Math.round(az / (Math.PI * 2)) * Math.PI * 2);
      }

      // Apparent wind = how hard the cake is turning, relative to its resting spin.
      var apparent = Math.abs(deps.S.omega) + (deps.S.dragging ? Math.abs(deps.S.dragW) : 0);
      var wind = (apparent - deps.SPIN.blowAt) / (deps.SPIN.blowFull - deps.SPIN.blowAt);
      wind = Math.max(0, Math.min(1, wind));
      var mic = deps.blow.enabled ? deps.blow.micLevel : 0;

      // Flames lean against the direction of travel; mic pushes them away from the viewer.
      var signed = deps.S.omega + (deps.S.dragging ? deps.S.dragW : 0);
      var spinLean = Math.max(-1, Math.min(1, -signed / deps.SPIN.blowFull)) * (0.35 + 0.65 * wind);
      if (Math.abs(signed) > deps.SPIN.idle * 1.5 || mic > 0) deps.setLean(spinLean, mic);
      else deps.setLean(0, 0);
      var ln = deps.getLean(); deps.setLeanNow(ln + (((Math.abs(spinLean) > 0.02 || mic > 0) ? 1 : 0) - ln) * Math.min(1, dt * 10));

      if (!deps.blow.enabled) return;
      if (mic > 0) deps.blow.micHold += dt * 1000; else deps.blow.micHold = 0;
      var micReady = mic > 0 && deps.blow.micHold >= 150;

      if (wind > 0 && now - deps.blow.lastWave > (260 - 140 * wind)) {
        deps.blow.lastWave = now;
        deps.wave(wind, signed > 0 ? -1 : 1, 0);
      } else if (micReady && now - deps.blow.lastWave > 180) {
        deps.blow.lastWave = now;
        deps.wave(mic, 0, -1);
      }
    }
    return { idleRate: idleRate, update: updateSpin };
  }
  window.CakeSpin = { create: create };
})();

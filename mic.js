/* mic.js — listening for a breath (v1.18, refactor step 7).
   create({ blow }) → { unlock(), start(onResult), stop() }
   Opens the microphone, calibrates the room's noise floor over the first ~30 frames, then writes
   how hard someone is blowing (0…1, low frequencies only — breath, not speech) into blow.micLevel,
   which the frame reads. unlock() resumes audio on a user gesture (iOS requires one). */
(function () {
  function create(deps) {
    var audioCtx = null, micStream = null, analyser = null, micData = null, micFloor = 0, micCal = 0, micLowBins = 8;
    function unlockAudio() {
      try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
    }
    function startMic(onResult) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { onResult(false); return; }
      unlockAudio();
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        .then(function (stream) {
          micStream = stream;
          var src = audioCtx.createMediaStreamSource(stream);
          analyser = audioCtx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.5;
          src.connect(analyser);
          micData = new Uint8Array(analyser.frequencyBinCount);
          micLowBins = Math.max(4, Math.round(400 / (audioCtx.sampleRate / analyser.fftSize)));
          micFloor = 0; micCal = 0;
          pollMic();
          onResult(true);
        }, function () { onResult(false); });
    }
    function pollMic() {
      if (!analyser) return;
      analyser.getByteFrequencyData(micData);
      var sum = 0; for (var i = 0; i < micLowBins; i++) sum += micData[i];
      var v = sum / micLowBins;
      if (micCal < 30) { micFloor = micFloor + (v - micFloor) / (micCal + 1); micCal++; deps.blow.micLevel = 0; }
      else {
        var thr = Math.max(micFloor + 28, micFloor * 1.6, 40);
        deps.blow.micLevel = Math.max(0, Math.min(1, (v - thr) / 60));
      }
      requestAnimationFrame(pollMic);
    }
    function stopMic() {
      if (micStream) { micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null; }
      analyser = null; deps.blow.micLevel = 0;
    }
    // The test harness breathes through THIS module's reference to the blow state — the exact
    // path the microphone uses (v1.18's bug was that path pointing at a stale object).
    function simulate(level) { deps.blow.micLevel = Math.max(0, Math.min(1, +level || 0)); }
    return { unlock: unlockAudio, start: startMic, stop: stopMic, simulate: simulate };
  }
  window.CakeMic = { create: create };
})();

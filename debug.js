/* debug.js — on-device switches (v1.05).
   Add flags to the address to turn parts of the picture off, so a phone-only bug can be bisected
   in minutes instead of guessed at across versions. All default ON; 0 turns off. Examples:
     ?ao=0            no ambient occlusion
     ?flames=0        no flames at all      ?halo=0   flames without their soft halo
     ?backdrop=0      no floor/backdrop     ?shadows=0
     ?sprinkles=0     ?sparklers=0          ?candles=0
     ?cover=0.9       the flame heart's opacity (0–1); ?glow=1.2 its brightness
     ?freeze=1        a frozen clock: no flicker, no sparks moving, no idle drift (for the harness)
   Several can be combined: ?ao=0&halo=0. The version tag shows which are active. */
(function () {
  var q = {};
  (location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
    if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = p.length > 1 ? decodeURIComponent(p[1]) : '1';
  });
  var KNOWN = ['ao', 'flames', 'halo', 'backdrop', 'shadows', 'sprinkles', 'sparklers', 'candles', 'cover', 'glow', 'freeze', 'v'];
  function on(name) { return !(name in q) || !(q[name] === '0' || q[name] === 'false' || q[name] === 'off'); }
  function num(name, dflt) { var v = parseFloat(q[name]); return isNaN(v) ? dflt : v; }
  var active = KNOWN.filter(function (k) { return k in q && k !== 'v'; }).map(function (k) { return k + '=' + q[k]; });
  function is(name) { return (name in q) && !(q[name] === '0' || q[name] === 'false' || q[name] === 'off'); }   // present and on (default OFF)
  window.CakeDebug = { on: on, num: num, is: is, active: active, q: q };
  document.addEventListener('DOMContentLoaded', function () {
    var tag = document.getElementById('build-tag');
    if (tag && active.length) tag.textContent += ' · ' + active.join(' ');
  });
})();

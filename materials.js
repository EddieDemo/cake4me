/* materials.js — the material registry (v1.08, refactor step 4a).
   Every kind of material the scene can ever use is REGISTERED here by the code that owns it,
   with a small builder that returns one throwaway object using it. The warm-up compiles the
   whole registry at load, so a recipient never pays a shader compile mid-gesture — and a new
   material can't be forgotten: registering it is the same line that defines it.
     CakeMaterials.warm('flame', function () { return makeFlameMesh(0); });
   Builders may return an Object3D, or { object, dispose } when they own a texture to free. */
(function () {
  var entries = [];
  function warm(name, build) { entries.push({ name: name, build: build }); }
  function warmGroup() {
    var g = new THREE.Group(); g.name = 'warm-compile'; g.visible = false; var cleanups = [];
    entries.forEach(function (e) {
      try {
        var r = e.build(); if (!r) return;
        var obj = r.isObject3D ? r : r.object;
        if (obj) g.add(obj);
        if (r.dispose) cleanups.push(r.dispose);
      } catch (err) { if (window.console) console.warn('warm-up: ' + e.name + ' failed', err); }
    });
    return { group: g, dispose: function () { g.traverse(function (o) { if (o.geometry && !o.geometry.__shared) o.geometry.dispose(); }); cleanups.forEach(function (f) { try { f(); } catch (e) {} }); } };
  }
  function names() { return entries.map(function (e) { return e.name; }); }
  window.CakeMaterials = { warm: warm, warmGroup: warmGroup, names: names };
})();

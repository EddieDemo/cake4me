/* patch.js — the one place three.js's shader chunks are edited (v1.09, refactor step 4b).
   Several materials extend three's own shaders (the biplanar icing, the wax glow, the ribbon's
   sheen, the crumb's wrap lighting). Each used to splice strings its own way. Now:
     CakePatch.after(shader, 'fragment', 'emissivemap_fragment', code)  — insert after a chunk
     CakePatch.replace(shader, 'fragment', 'normal_fragment_maps', code) — replace the chunk
     CakePatch.declare(shader, 'vertex', decls)                          — prepend declarations
   Every call checks the chunk is really there — a silent miss is how a patch quietly stops
   working when three.js is updated — and logs once if not. */
(function () {
  var warned = {};
  function src(shader, stage) { return stage === 'vertex' ? shader.vertexShader : shader.fragmentShader; }
  function set(shader, stage, s) { if (stage === 'vertex') shader.vertexShader = s; else shader.fragmentShader = s; }
  function chunk(name) { return '#include <' + name + '>'; }
  function check(shader, stage, name) {
    if (src(shader, stage).indexOf(chunk(name)) >= 0) return true;
    var key = stage + ':' + name; if (!warned[key] && window.console) { console.warn('CakePatch: chunk not found: ' + key); warned[key] = true; }
    return false;
  }
  function after(shader, stage, name, code) { if (check(shader, stage, name)) set(shader, stage, src(shader, stage).replace(chunk(name), chunk(name) + '\n' + code)); return shader; }
  function before(shader, stage, name, code) { if (check(shader, stage, name)) set(shader, stage, src(shader, stage).replace(chunk(name), code + '\n' + chunk(name))); return shader; }
  function replace(shader, stage, name, code) { if (check(shader, stage, name)) set(shader, stage, src(shader, stage).replace(chunk(name), code)); return shader; }
  function declare(shader, stage, decls) { set(shader, stage, decls + '\n' + src(shader, stage)); return shader; }
  window.CakePatch = { after: after, before: before, replace: replace, declare: declare };
})();

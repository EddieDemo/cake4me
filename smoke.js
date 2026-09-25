/* smoke.js — a wisp of smoke from a blown-out wick (v1.18, refactor step 7).
   create({ parent, EASE }) → { texture, list, puff(flame, dirX, dirZ), update(dt) }
   Each wisp is a soft sprite that rises, drifts with the breath that blew it out, grows and fades. */
(function () {
  function create(deps) {
    var smokeTex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var g = c.getContext('2d');
      var grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(120,110,105,0.55)');
      grad.addColorStop(0.6, 'rgba(120,110,105,0.18)');
      grad.addColorStop(1, 'rgba(120,110,105,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      var t = new THREE.CanvasTexture(c); CakeResources.keep(t); return t;
    })();
    var smokes = [];   // { sprite, age, life, vx, vz }
    var smokeGroup = new THREE.Group(); deps.parent.add(smokeGroup);

    function puffSmoke(f, dirX, dirZ) {
      var m = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.9, toneMapped: false });
      var sp = new THREE.Sprite(m);
      sp.position.set(f.x, f.y + 0.05, f.z);
      sp.scale.set(0.12, 0.12, 1);
      smokeGroup.add(sp);
      smokes.push({ sprite: sp, age: 0, life: 0.9, vx: dirX * 0.25 + (Math.random() - 0.5) * 0.08, vz: dirZ * 0.25 });
    }
    function updateSmoke(dt) {
      for (var i = smokes.length - 1; i >= 0; i--) {
        var s = smokes[i]; s.age += dt;
        var t = Math.min(1, s.age / s.life), k = deps.EASE.soft(t);
        s.sprite.position.y += dt * 0.5 * (1 - t * 0.6);
        s.sprite.position.x += s.vx * dt; s.sprite.position.z += s.vz * dt;
        var sc = 0.12 + 0.3 * k;
        s.sprite.scale.set(sc, sc * 1.3, 1);
        s.sprite.material.opacity = 0.9 * (1 - t);
        if (t >= 1) { smokeGroup.remove(s.sprite); s.sprite.material.dispose(); smokes.splice(i, 1); }
      }
    }
    return { texture: smokeTex, list: smokes, puff: puffSmoke, update: updateSmoke };
  }
  window.CakeSmoke = { create: create };
})();

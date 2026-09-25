/* store.js — the one place the cake's config is held and changed (v1.16, refactor step 7c).
   create({ normalize, merge }) → { get(), set(cfg, opts), update(partial, opts), commit(opts), subscribe(fn) }
   get():     the current config — always normalized (every field present, in range).
   update():  merge a partial change in (with the schema's rules for which fields override
              which), normalize, and notify.
   set():     replace the whole config, normalize, notify.
   commit():  the config was edited in place (the builder's sliders do that for speed) — normalize
              it and notify. opts pass straight through to subscribers (e.g. { showMessage }).
   opts.silent: store without notifying (the builder syncs its form itself on some paths).
   Subscribers are called in order: build first (app.js registers it), then the UI's sync.
   There is exactly one path from "something changed" to "the cake was rebuilt": notify(). */
(function () {
  function create(deps) {
    var cfg = null, subs = [];
    function notify(opts) { for (var i = 0; i < subs.length; i++) subs[i](cfg, opts || {}); }
    function set(next, opts) { cfg = deps.normalize(next); if (!(opts && opts.silent)) notify(opts); return cfg; }
    function update(partial, opts) { return set(deps.merge(cfg || {}, partial), opts); }
    function commit(opts) { return set(cfg, opts); }
    function subscribe(fn) { subs.push(fn); return function () { var i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; }
    return { get: function () { return cfg; }, set: set, update: update, commit: commit, subscribe: subscribe };
  }
  window.CakeStore = { create: create };
})();

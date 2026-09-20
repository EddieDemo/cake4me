# Cake — v0.53 (one frosting shell)

The "lid" is gone. Each tier's cap is now the **same colour and radius** as its sides, with no
underside lip and no tuck in the sponge: the wall runs straight up into a single rounded top edge.
The overhang and the lighter tint were early tricks to suggest icing on a flat-shaded cylinder;
with real lighting, they read as a lid on a tin. The ribbon is now the only thing that breaks the
shell, which is the right job for it. The cap remains separate geometry only because the side
carries the message texture and the top doesn't; the wedges inherit everything.

`shapes.js`: `capOverhang` 0, `capUnder` removed, the under-cap and lip occlusion terms removed
(no crease to occlude). `app.js`: the seven `lighten(frosting, 0.12)` cap colours are now `frosting`.

## Two regressions caught on the way, both fixed
- **Every route change was recompiling every shader.** Since v0.49 each route re-installs the PCSS
  patch, and `install()` bumped the global cache key even when nothing changed — 14 programs became
  26 across one navigation. `install()`/`uninstall()` are now idempotent: identical settings are a
  no-op.
- **Two variants had slipped past the warm-compile:** the double-sided ribbon band and the smoke
  wisp (whose canvas texture is linear-encoded, unlike the flames'). Both added.

Verified: **16 programs at load, 16 after the whole journey**, from both a builder start and a cold
viewer link.

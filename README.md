# Cake — v0.41 (baked ambient occlusion)

## The bright streaks at every tier junction
They were the hemisphere light's **ground bounce** — a warm colour applied to every downward-facing
surface, everywhere, with no idea whether anything is in the way. The rounded profiles from v0.30
gave every tier a base fillet and every cap an underside lip, both facing down, so they caught
that fake bounce at full strength. In reality those creases are the darkest part of a cake: floor
bounce can't get into the gap where a tier sits on another. That's ambient occlusion, and we had
none.

## Fix 1 — ambient occlusion, baked into the geometry
`shapes.js` writes a darkness value per vertex along the lathe profiles: full brightness up the
wall, fading to ~0.55 at the foot; ~0.62 in the tuck under the cap's overhang; ~0.50 on the cap's
underside lip; and a ring on a tier's top surface where the tier above sits, fading out over ~0.4
units from its edge. The cake materials multiply by it (`vertexColors: true`). Analytic, noise-free,
zero runtime cost — the same technique most stylised games use for static geometry, and here the
geometry is parametric so it's exact. Wedges inherit it, so a cut cake matches.

Knobs: `CakeShapes.P.ao` (base, baseReach, underCap, capLip, seat, seatReach).

## Fix 2 — the fake bounce turned down
`hemiGround` #f0d6bd → #b8a48f: one window's worth of floor bounce rather than a lightbox.

## Shader warm-up, done properly this time
The vertex-colour materials are new shader variants, and my hand-written warm-up list from v0.40
missed three of them within a day. Replaced with **`warmCompile()`**: at load, `app.js` builds one
of each *real* thing it makes — two wedges (with and without the message band), a whole-cake body,
a plate, a seam, a plate rim — with the box, confetti mesh, floor and built cake already in the
scene, runs `renderer.compile()` over all of it, and throws the stand-ins away. `look.js` keeps only
two tiny permanent casters under the floor for the shadow-depth programs, which `compile()` doesn't
cover.

Verified: **13 programs at load, 13 after the whole journey**, from both a builder start and a cold
viewer link.

## docs/
Aesthetics doc: AO recorded as done; the "what engines have that we don't" list is now in the doc
under its own heading, to return to.

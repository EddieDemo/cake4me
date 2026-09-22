# Cake — v0.77

## 1. No more lid
A fondant tier was two pieces — a wall and a cap sitting on it — with different texture mapping
(wrap on the wall, straight-down projection on the cap), so the finish smeared over the shoulder
and the join showed. Now:
- **One surface.** `CakeShapes.shell` builds wall, shoulder and top as a single lathe, with two
  material groups (wall, where the message lives; shoulder and top). No join, no crease.
- **Biplanar mapping in the shader** (`CakeFrosting.dressFondant`). The finish's normal and
  roughness maps are sampled twice — wrapped around by angle and height, and projected straight
  down — and blended by how steep the surface is. Sides get pure wrap, the top pure projection,
  the shoulder a smooth mix: no stretching and no seam anywhere, wedges included (the maps live in
  the cake's own space). The mip seam where the angle wraps is avoided by choosing, per pixel,
  whichever of two angle forms has no jump. The message band is still a normal UV map, so it
  coexists.
- Cost: two extra texture reads per fondant pixel; one shader variant (`customProgramCacheKey`),
  warmed up. A fresh recipient: 18 programs at load → 18 opened → 18 cut.

## 2. Ribbons bridge the fillings
On a naked cake the ribbon was following the wall profile groove by groove. It's now a flat band at
the sponge's outer radius, pulled taut across the fillings. On fondant it still follows the gentle
bulge, which is the real surface.

## 3. Ribbon height
A **Height** slider beside Width in the Ribbon tray, per tier: 0 puts the ribbon's bottom at the
bottom of the tier's straight wall, 9 its top at the top of it (not over the rounded shoulder, where
a flat band can't sit). Schema `rbp` appended, one digit per tier; links without it keep the old
fixed position. A new ribbon starts near the base. The generator randomises it.

## 4. Sponge textures
Mocked, not built — see `cake-sponge-mock.png`.

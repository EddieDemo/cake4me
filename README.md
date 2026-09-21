# Cake — v0.66 (the sponge is the object)

You were right: semi-naked in v0.65 was a reskin of the frosted shell — the frosted geometry at
the frosted radius, no grooves, with sponge painted on. This build makes the model honest.

## The model
- **The shape sliders size the sponge.** Its radius, its height, its fillings and its grooves
  belong to the sponge, whether or not you can see it.
- **Frosting is a layer on the sponge.** Smooth frosting is a shell of real thickness — 0.08 on
  the sides, 0.10 on top — so a frosted tier is fractionally bigger than the same sponge naked,
  as a real cake is. Semi-naked is a scrape of no thickness: it *is* the sponge's geometry, grooves
  and all, with the frosting painted on. Drip and rustic will be the shell plus a curtain, and the
  shell with a worked surface.
- **Cut faces agree.** A cut smooth cake shows the sponge and its fillings with the frosting band
  around the outside and on top, at the shell's thickness. A semi-naked cut shows the sponge.

Measured: naked and semi-naked tiers share the identical grooved geometry (same radius, same
1455 vertices); smooth is a separate shell 0.08 wider with 776 vertices and no grooves.

## Underneath
`tiersFor(cfg)` now returns the **outer** dimensions everything else expects (camera, box,
candles, cut, ribbon) *and* the sponge's own (`rs`, `hs`); `frostingHasThickness(cfg)` decides
which the tier geometry uses. `tierMaterials` picks the geometry (`rr`, `hh`), the grooves and the
cut-face painter from that one rule, so the whole cake, the wedges and the slice page can't
disagree. `makeCutFaceTexture` paints the sponge inside the frosting band from the same numbers.

A consequence to know: the classic proportions now describe the *sponge*, so a classic frosted
cake is 0.08 wider and 0.10 taller than before. The camera fits to it.

## Fillings can be zero
The Sponge tray's row is **Fillings: 0 · 1 · 2 · 3** (sponge layers 1–4; `ly` = 1 is just cake).
Older links are unchanged.

Verified: naked/semi/smooth renders, zero fillings, a recipient cutting a smooth cake with the
frosting band on the face; no errors.

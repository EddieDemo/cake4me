# Cake — v0.96 (real flames)

The flat flame pictures and their halos are replaced by **3D flames**: a small teardrop, widest
a third of the way up and tapering to a fine tip, with its own shader —
- glowing from the inside: brightest where you look through the most flame, fading to nothing at
  its edges, so there's no hard outline; reads the same from any angle, including from above;
- a blue root at the wick, a dimmer cone round the wick, a gold-white heart, orange edges and tip;
- **flicker** in the vertex shader: it sways more at the tip than the root, and its tip stretches
  and shrinks on several unrelated rhythms, each flame on its own phase, so it never visibly
  repeats;
- a faint larger copy as its halo, and a tiny ember at the wick's tip.

By day an additive flame vanishes into a pale backdrop, so the heart covers what's behind it a
little (`FLAME.cover`): a gold teardrop by day, a glow at night.

Everything else is unchanged: the old sprites stay as invisible anchors, so blowing out, smoke,
the lean when the cake spins (the flame now pivots at the wick) and number candles all work as
before. The flame shader is compiled at load. Tunables in `FLAME`: `glow`, `haloGlow`, `cover`,
`lean`. Files load with `?v=0.96`.

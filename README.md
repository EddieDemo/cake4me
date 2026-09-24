# Cake — v0.99 (sparklers)

**Sparklers**, up to two, alongside regular candles or number candles. In the Candles tray: a
**Sparklers** row — None · One · Two — shown in both modes.

- **The stick:** a bare wire, far thinner than a candle, the top two-thirds in a rough, lumpy grey
  coating; pushed straight into the cake (no holder).
- **The burning point** stays fixed near the top — it never burns down: a white-hot bead with a soft
  glow, and a short stub of spent wire above it.
- **The sparks** run entirely on the GPU: ~300 streaks per sparkler, thrown out in every direction,
  arcing and falling, and nearly half bursting at the end of their flight into small stars of eight
  finer streaks. Each is a quad whose path the vertex shader works out from its seed and the time,
  so nothing is recalculated in JavaScript per frame. Drawn after the ambient occlusion, like the
  flames.
- **Light:** a warm, crackling light on the cake, stronger at night. It's one light that's always in
  the scene (at zero when there are no sparklers), so adding a sparkler never recompiles materials.
- **They keep going** when the candles are blown out.
- One sparkler stands behind the candles, just off-centre; two stand either side, behind.
- Schema `sk` (0–2). Generator: one sparkler on ~20% of random cakes, two on ~5%.

Verified: one sparkler by day; two with number candles at night; still sparkling after blowing out
the candles. No errors. Toggling sparklers on in the builder compiles one small shader the first
time. Files load with `?v=0.99`.

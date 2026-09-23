# Cake — v0.92 (real ambient occlusion)

**Screen-space ambient occlusion**, computed from the actual geometry every frame — not painted
on. After the frame is drawn, the scene is rendered again as depth and normals, and each pixel is
darkened by how much nearby geometry crowds it: under the candle holders, in the icing's grooves,
beneath the ribbon, where the tiers meet, where the cake meets the table.

- three r128's own SSAO pass (vendored unmodified: `vendor/SSAOPass.js`, `SSAOShader.js`,
  `CopyShader.js`, `Pass.js`, `SimplexNoise.js`), driven by our frame rather than a composer, so
  the colour management and tone mapping of the main render are untouched: the occlusion is
  multiplied onto the finished frame.
- Half resolution, 16 samples, blurred. Flames, sprites, confetti and anything transparent are
  left out, so they don't occlude.
- Tuned to avoid the classic SSAO halo round thin objects: it only counts geometry very close
  *behind* a point (`maxDistance`), so candles don't cast dark auras on the cake behind them.

Tunables in `AO` at the top of app.js: `on`, `strength` (0.6), `kernelRadius` (how far it looks),
`maxDistance`, `scale` (resolution). From the console: `cake.ao.on = false` to compare.

Cost: one extra geometry pass plus two half-resolution screen passes per frame. It's the heaviest
thing added in a while — worth watching the frame rate on the phone, and on an older one if you
have it. No new materials for the scene itself; no errors.

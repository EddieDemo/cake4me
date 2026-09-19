# Cake — v0.36 (light-size slider in the dev overlay)

With `?dev=1`, under the 30/45/60 toggle: a **light size** slider (0.1–1.5 world units, default
0.6) and a **9 / 13 / 17** samples toggle.

- **Light size** is the one physical variable left with a directional light and a fixed shadow
  camera. It sets how fast a shadow's far edge softens; the near edge is always crisp. Small values
  keep every shadow crisp end to end; large ones let the top tier's shadow bloom on the floor while
  a candle's foot stays sharp.
- **`maxRadius` follows the slider** under the hood (0.02 + 0.03 × size, clamped), so it never clips
  the effect at small sizes and never lets a far shadow dissolve at large ones. No second slider.
- **Applied on release**, not live: the value is baked into the shader and every change recompiles
  all materials — a brief hitch. The number shows while you drag so you can aim.
- **Samples** is quality versus cost, not look: 9 is grainier and cheaper, 17 silkier and dearer.
  Watch the low-FPS number when you change it.

The readout shows the exact value, so once you find the one you like, put it in `look.js` under
`LOOK.pcss.lightSize`.

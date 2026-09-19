# Cake — v0.32 (candlelight as the light source)

The last item in the look pass, and the one the halo was for.

## What it does
On a dark background the room goes dim and **the flames light the cake**. Blowing the candles out
visibly darkens it — each extinguished wave is a wave of dimming, not just flames disappearing — and
relighting brings the glow back. On light backgrounds nothing changes.

Nothing is gated or chosen: it follows the background the sender already picked. Darkness ramps from
the backdrop's luminance (0 above 0.55, 1 below 0.16), so Dusk is half-lit and Midnight and Ink are
fully candlelit.

## How (all in `look.js` → `LOOK.night`, applied by `app.js`)
- **Room lights** lerp toward a dim, cooler night set as darkness rises (hemisphere 0.62 → 0.20, key
  0.82 → 0.26, fill 0.22 → 0.10).
- **Candle light** = `base + perSqrt·√lit`, boosted 2.4× at full darkness. Square root, or one candle
  looks nearly as bright as twenty. Eased at 6/s so a wave of candles going out reads as dimming.
- **A faint self-glow** on the cake materials at night (5%) so the shape never goes fully black, and
  a little more on the message band (14%, using the message texture as its emissive map) so the
  writing stays readable when the candles are out.

Tuned from a sweep: the tops were clipping to white at the first strength, so the per-candle factor
came down from 0.42 to 0.30, and the night ambient came up so the sides keep some form.

## The look pass, complete
Shadows (v0.28/29) → rounded geometry (v0.30) → flame halo (v0.31) → candlelight (v0.32). What
remains in the aesthetics doc is cake-ness — sprinkles, drips, rosettes — which belongs to the
builder's object library, and environment/tone mapping, which wait for a glossy skin.

# Cake — v0.91 (candles placed by hand)

Every candle now differs a little from its neighbours, all from the cake's seed, so the recipient
sees exactly the candles the sender did:
- **Pushed in by hand** — each holder sits a little higher or lower on its spike (±3.5mm-ish,
  never touching the icing) and leans by up to about four degrees; the flame stays upright, as
  real flames do.
- **Burned a little differently** — up to ~13% shorter, most only slightly. Static: no live
  burning.
- **Quality-control colour** — each candle a touch off its nominal hue, saturation and lightness;
  pale yellows kept on a tighter leash so they don't drift green.
Tunable in one place: `CANDLE_HAND = { push, lean, burn }` in app.js.

Verified: a recipient's cake loads in ~1.5s and lights and blows out with no errors or new
shaders. The full visual check didn't complete in my test renderer, so the look itself is best
judged on the phone.

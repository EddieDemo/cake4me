# Cake — v0.5 (Phase 3: the recipient's moment)

Open a cake link and you get the whole arc: gate → open → blow → beat → reveal.

**Gate.** A closed box with a ribbon, "Someone sent you a cake", one button: **Open**. Under it, a quiet "Use microphone to blow" link (hidden if the browser can't do it). The Open tap unlocks audio for later.

**Open.** Ribbon loosens and drops, lid lifts and tilts away, the box sinks while the cake rises and settles, candles light in a ripple from the centre out (capped at 1.2s), the header fades in, then "Blow… or swipe to blow".

**Blow.**
- *Swipe* (always works): horizontal drag across the cake. Distance-based (one wave per ~70px), so a slow swipe works as well as a flick. Flames lean in the swipe direction first. Each wave puts out a front-to-back group; about three swipes for a full cake.
- *Mic* (bonus): low band (≈0–400Hz) energy over a 500ms room-noise calibration; needs ≥150ms sustained. Flames flatten and lean away; louder and longer puts out more. Denied or unsupported → the link just disappears. Never an error.
- Each candle: flame snaps out in 80ms, a smoke wisp rises and drifts with the breath. The warm light fades with the count.

**The beat.** 500ms of nothing after the last candle. Don't shorten it.

**Reveal.** Paper confetti (2D overlay, 120 pieces, tier colours), the cake turns to face you and tilts 8°, the message pipes itself onto the frosting letter by letter (~35ms/char, capped at 1.2s), then **Cut the cake** pops in (Phase 4 does the cutting; tapping it says so), **Relight the candles** (reverse ripple, blow again, confetti again: good for filming) and **Send someone a cake**.

## Console
`cake.debug()` → blow state, lit count, viewer state · `cake.blowAll()` → skip to the reveal · `cake.rotate = false`

## Things to feel for on the phone
- Does the open sequence build anticipation or drag? (It's ~2.4s.)
- Does swiping feel like blowing, or like scrubbing?
- Mic: try it in real Safari and inside WhatsApp's browser. The second may not offer it at all; that's expected.
- The beat. If it feels awkward, that's usually the confetti being late, not the pause being long.

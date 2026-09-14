# Cake — Feel Spec

The four moments, with the easings, timings and sounds decided up front so they don't get invented under pressure. Companion to `cake-build-plan.md` (Phase 3–5 and the feel passes) and `cake-business-plan.md` (section 2 and 3.3).

## Principles

1. **Juice has a budget. Spend it on peaks.** Four peaks: link ready, last candle out, wedge lifts, slice arrives. Everything between them is calm.
2. **One easing vocabulary.** Four curves, used everywhere. If an animation doesn't fit one of them, it's probably wrong.
3. **60fps or cut it.** A stutter during a peak is worse than no effect. Test on the oldest phone available before adding anything.
4. **Tone: pastry chef, not slot machine.** Warm, handmade, a little cheeky. No screen shake, no lens flare, no neon. Confetti is paper, not sparks.
5. **Sound is optional, never surprising.** Off by default, unlocked by the open tap, one toggle, everything under 600ms.
6. **Reduced motion is a real mode.** `prefers-reduced-motion` gets cross-fades instead of motion, no confetti physics, flames still flicker (gently).

## Easing vocabulary

| Name | Use for | CSS | JS (t → eased) |
|---|---|---|---|
| `soft` | Things arriving, fading, settling | `cubic-bezier(0.22, 1, 0.36, 1)` | ease-out quint: `1 - (1-t)^5` |
| `pop` | Things appearing that should feel alive (candles, buttons, confetti burst) | `cubic-bezier(0.34, 1.56, 0.64, 1)` | back-out, overshoot 1.56 |
| `lift` | Physical objects moving with weight (lid, wedge, plate) | `cubic-bezier(0.45, 0, 0.15, 1)` | ease-in-out with a slow start |
| `snap` | Feedback that must feel instant (tap responses, slider ticks) | `cubic-bezier(0.16, 1, 0.3, 1)` | ease-out expo |

## Timing scale

Use only these durations. Pick the nearest.

`80ms` tap feedback · `160ms` micro (a candle popping in) · `280ms` small (button, card) · `450ms` medium (wedge lift, plate slide) · `700ms` large (lid, cake rise) · `1200ms` reveal (message writing) · `2000ms` ambient loop (flicker cycle, rotation quarter-turn)

Rotation: one full turn every 24s. Slow enough to feel still, fast enough that a 10s screen recording shows the whole cake.

## Sound palette

All mono, short, quiet. Decoded once at unlock. Names are file names.

| Cue | Length | Character | Fires on |
|---|---|---|---|
| `tick` | 40ms | Soft wooden click | Slider steps, candle count changes, toggles |
| `pipe` | 120ms | Icing squeeze, one per letter | Name/message being piped onto the cake in the builder |
| `pop` | 90ms | Small cork | A candle appearing, a decoration placed |
| `lid` | 500ms | Cardboard lid lifting, a little air | Box opening |
| `flame` | loop, 2s | Very quiet candle hiss, ≤ -30dB | While candles are lit (fades with count) |
| `puff` | 150ms | Breath through a flame, pitched slightly random ±10% | Each wave of candles going out |
| `hush` | 300ms | Near-silence with a tiny room tone | The beat after the last candle |
| `confetti` | 600ms | Paper burst + a two-note chime (major third) | Confetti |
| `knife` | 250ms | Knife through sponge, soft | Cut |
| `plate` | 200ms | Ceramic set-down | Wedge landing on plate, slice page arrival |
| `bow` | 400ms | Ribbon pulled tight | Link ready |

No "Happy Birthday" song. Licensing is fine now but it's naff and long.

---

## Moment 1 — Sending

Goal: the builder feels like decorating, and getting the link feels like tying a bow.

**Layout.** Cake in the top 55% of the viewport, always visible, gently rotating. Controls in a bottom sheet that never covers the cake. Primary action ("Get my link") pinned at the bottom in the thumb zone.

**Every control changes the cake instantly, with a micro-reward.**
- Name field: each character pipes onto the frosting as typed (`pipe` per letter, `soft` 160ms scale-in per glyph). Backspace un-pipes.
- Candle slider: candles pop up one at a time from the outside ring in (`pop` 160ms, `tick` per step). At 100, a single extra `pop` and the flames intensify for 300ms. It should be funny.
- Colour swatches (frosting, filling, candles): frosting colour crossfades 280ms `soft`. Filling colour: the cake briefly shows a translucent cut-away for 700ms so the sender sees what they've hidden. This is the only time the sender sees the filling.
- Tier switch (Classic ↔ Two-tier): second tier drops in from above with `lift` 450ms, slight squash on landing (scale Y 0.94 → 1, 160ms `pop`).

**Link-ready ceremony (~2.2s total, skippable by tap).**
1. Controls sheet slides down and away, `soft` 280ms.
2. A box rises from below the plate, `lift` 700ms.
3. Lid lowers on, `lift` 450ms, `lid` sound reversed (softer).
4. Ribbon tightens across the lid, `snap` 280ms, `bow` sound.
5. Label appears on the lid: "For Hollie, from Eddie", `soft` 280ms.
6. Share sheet button pops in, `pop` 280ms. If Web Share exists, the button *is* the native share. Otherwise "Copy link" with a 1.5s "Copied ✓" state.

Never make them wait for the ceremony to copy the link. Tap anywhere to skip to step 6.

---

## Moment 2 — Receiving

Goal: anticipation, then a moment they want to film.

**Load (0–1s).** Instantly: background gradient + flat CSS cake silhouette + "Someone sent you a cake" in the tier's typeface. No spinner. When three.js is ready, the silhouette crossfades to the real scene, `soft` 450ms. If load takes over 1.5s, candles on the silhouette light one by one as a progress indicator.

**Gate.** A closed box on the plate, ribbon on top. One button: **Open**. This tap unlocks audio and is the only place the mic is ever offered (small secondary link under the button: "Use microphone to blow", never a modal, never on load).

**Open sequence (~1.6s).**
1. Ribbon loosens and drops away, `soft` 280ms.
2. Lid lifts and tilts back, `lift` 700ms, `lid` sound. Lid exits upward and fades.
3. Cake rises 12% and settles, `lift` 450ms, then `pop` scale 1.03 → 1 over 160ms. Spin is disabled until the lid is off.
4. Candles light in a quick ripple from centre out, 20ms apart (100 candles = 2s; cap the ripple at 1.2s by lighting in batches).
5. Header: "Happy Birthday, Hollie" fades in `soft` 450ms. "from Eddie" 200ms later.

**Idle.** Rotation 24s/turn (the resting value of the spin model above). Flames: each has random phase; scale oscillates ±10% on a 2s cycle plus a faster ±4% at 0.3s; slight lean that drifts. Flame light: one warm point light at the cake centre whose intensity tracks lit-candle count. `flame` loop at whisper level.

**Spin (primary, decided 13 Sept).** There is no separate blow gesture. The cake is a lazy susan: drag it and it tracks the finger 1:1 (~360px = one turn), release and it coasts, decaying back to the ambient spin rather than to a stop. Spun backwards it slows through zero and resumes forwards. Spin it fast enough and the apparent wind puts the candles out — flames lean against the direction of travel and go out in waves from the leading edge. Idle spin sits well under the threshold so the cake never snuffs itself. A drag interrupts any auto-facing turn and nothing else.

**Blow (mic, bonus).** Map low-band (≈0–400Hz) energy above a room-noise calibration to flame lean away from the viewer; needs ≥150ms sustained. Louder and longer puts out more. `puff` per wave, pitch random.

**Extinguish (per candle).** Flame scales to 0 in 80ms `snap`; a smoke wisp (sprite) rises 40px over 900ms with `soft`, fading and drifting slightly in the swipe/blow direction. The point light fades with the count.

**The beat.** After the last candle: 500ms of nothing. Rotation continues. `hush`. This pause is the most important 500ms in the product; don't shorten it.

**Reveal (~2.5s).** *(Superseded 13 Sept: the message now lives permanently on the back of the cake and is found by spinning, not revealed. Blowing the candles out earns the confetti and the next step only. Steps 2–3 below no longer apply; kept for the confetti spec.)*
1. Confetti: 2D canvas overlay, 120 pieces (60 on reduced budget), rectangles 6×10px in the tier palette + white, spawn from top edge and two side bursts, gravity 0.35, drag 0.98, tumble on two axes, fall time 2–3s, `confetti` sound. Paper, not glitter.
2. The message turns to the front, `lift` 700ms — **no tilt** (dropped 13 Sept; the reveal gets redesigned later). If the recipient has already spun the cake themselves, it is left alone: the cake is theirs to hold.
3. ~~Message pipes itself onto the frosting letter by letter~~ — dropped; the message is always on the cake's reverse side.
4. "Cut the cake" button pops in below, `pop` 280ms, 300ms after the last letter.
5. "Relight the candles" appears as a small text link. Relight = reverse ripple, no sound. Lets them film it again.

---

## Moment 3 — Cutting

Goal: physical satisfaction and a second reveal.

**Cut.** Tapping "Cut the cake" swaps the whole cake for its 8 wedges (invisible swap, same frame) and shows faint seam lines for 700ms, fading. A knife icon follows the finger; dragging across a seam draws a cut line (`knife` sound). Tap a wedge to select it.

**Lift (~1.1s).**
1. Wedge rises 30px and pulls 20% outward, `lift` 450ms, with a small sideways wobble (rotate Z ±3° decaying over 450ms).
2. A small plate slides in from the right, `soft` 280ms, `plate` sound as the wedge lands (scale Y 0.96 → 1 squash, 160ms `pop`).
3. The wedge's inner faces show the filling colour/layers. This is the reveal. The remaining cake also shows the filling on its exposed faces.
4. Slice card rises from the bottom, `soft` 280ms: "Send this slice to someone", optional name field, Share button. "7 slices left" counter.

**After sending.** Card drops away, wedge fades, the gap stays. `tick`. On the last one: plate empty, crumbs, "You gave away the whole cake ❤️".

---

## Moment 4 — Receiving a slice

Goal: it is a gift, small but complete. This page carries the business.

**Load.** Same skeleton approach, silhouette of a wedge on a plate.

**Arrival (~1.5s).** Plate slides in from the right, `soft` 450ms, `plate` sound. Wedge already on it, filling visible on the cut faces. One candle, lit. Header: "**Hollie** sent you a slice of her birthday cake 🎂" `soft` 450ms.

**Blow.** Same mechanic, one candle, mic or swipe. Flame leans, goes out, single `puff`, one tiny smoke wisp. A small burst of confetti (30 pieces).

**Message.** The original message pipes onto the frosting, same as the cake.

**The ask.** 600ms later: "Send someone a cake" button pops in, `pop` 280ms. One button. Under it, quietly: "Cakes from £4.49". Nothing else on the page.

---

## Mobile constraints (non-negotiable)

- Portrait layout; landscape gets a gentle "turn your phone" card, no rotation handling.
- Primary action always in the bottom third. Touch targets ≥ 44px.
- `100dvh`, not `100vh`. `overscroll-behavior: none`. `touch-action: none` on the canvas. `-webkit-tap-highlight-color: transparent`. `user-select: none` on interactive text.
- `devicePixelRatio` capped at 2. Flames as sprites. Candles share one geometry and material. No shadows, no post-processing, one point light + one directional + ambient.
- Confetti on a 2D canvas overlay, never in three.js. Show the overlay before measuring it — a hidden canvas measures zero.
- No plate. A soft contact-shadow disc does the grounding; camera elevation rests at 36°.
- **Nothing on screen is ever rotated.** The camera orbits; the cake and the box stay put and upright, so gravity looks right at every angle. One rig, four controls:
  - one-finger horizontal drag → azimuth, with momentum, decaying back to the ambient orbit
  - one-finger vertical drag → elevation, fully side-on (2°) to fully top-down (88°), the whole 90° in one swipe of 80% of the canvas height
  - two-finger rotate → camera roll, ±25°
  - two-finger pinch → zoom, 0.45×–1.7× of the framed distance, always centred on the cake
  Elevation, roll and zoom are held, not sprung. Only the orbit decays.
- The "wind" that blows the candles out is still driven by orbit speed. Nothing is physically moving the air; it's a toy and it reads fine.
- Audio: one `AudioContext` created on the open tap; all buffers decoded once; a single mute toggle.
- No vibration API on iOS Safari. Don't design around haptics.
- Anything requiring `getUserMedia` must have a swipe fallback that is visibly primary.

## Reduced motion

Ceremonies become 280ms crossfades. Candles light all at once. Flames flicker at half amplitude. No confetti physics: a single soft burst image that fades. Message appears whole. Rotation stops (a single 8° tilt remains).

## Feel-pass checklist (run once per moment, after it works plainly)

- [ ] Every state change has a start, an overshoot or settle, and an end. Nothing snaps without `snap`.
- [ ] Every sound is under 600ms and quieter than you think.
- [ ] Filmed on a phone at 30fps: does the peak read in a 10-second clip?
- [ ] Skippable by tap wherever someone could be in a hurry.
- [ ] Runs at 60fps on the oldest phone available, with 100 candles.
- [ ] Reduced-motion mode still communicates everything.

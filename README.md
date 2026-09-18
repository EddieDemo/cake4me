# Cake — v0.23 (Phase 4: cut the cake, send slices)

The loop, built.

## Cutting
- **"Cut the cake"** clears the spent candles and replaces the cake with wedges: 8 per tier, so
  8 / 16 / 24. Faint seams on top. **Tap a wedge to lift it** (raycast on a tap, never on a drag,
  so the cake stays spinnable). The top tier cuts first — a bottom wedge with a tier resting on it
  makes no sense.
- The wedge lifts up and over onto a small plate that slides in **toward the viewer**, whichever way
  the camera happens to be facing, with a decaying wobble and a squash on landing.
- **The filling shows on both cut faces** — the second reveal, and the sender's secret.
- **The message survives cutting.** Each bottom-tier wedge carries its arc of the message band via a
  cloned texture with per-wedge `offset`/`repeat`, so the writing reads continuously round the
  remaining cake and a lifted wedge carries its fragment.
- Slices gone are persisted in `localStorage` keyed by the cake's code, so a reopened cake is still
  missing the slices you gave away. "7 slices left" → "You gave away the whole cake ❤️".

## Sending a slice
The card under a lifted wedge: an optional name, then **"Send a slice back to Eddie"** as the
primary (once — it hides after use), then Share / Copy. Slice links are the cake link plus
`&s=<index>&b=1&n=<name>` (and `&sb=1` when it's going back to the sender). Web Share where it
exists, clipboard otherwise.

## The slice page
`#c=…&s=…` renders **one wedge on a plate with one candle** and no cutting further. Header:
*"Hollie sent you a slice / of the cake Eddie made"*, then the original message as text ("Eddie wrote
'Happy 30th, love you'"), then "Blow out the candle, or spin it". The same spin/mic/wind mechanic
works on the single flame; a small confetti burst; then **"Send someone a cake — Cakes from £4.49"**
with `?src=slice` on the link so slice-to-cake conversion is measurable.

## The slice back to the sender — acknowledgement without a server
When the slice link carries `sb=1`, the sender's page reads *"Hollie sent you a slice / They blew
out the candles 🎂"*, the lead is **"Your cake landed."**, and the call to action is **"Send Hollie
another next year"**, which opens the reminder pop-up. That's the loop from the revenue doc, delivered
by the chat thread instead of an email server, in the same conversation the gift went out in.

## Decisions made here
- **Tap-a-wedge, not a knife drag.** The drag is polish for the feel pass.
- **The message is text on the slice page**, not on the wedge — a wedge carries only a fragment.
- **Spent candles vanish when cutting begins**, rather than persisting per wedge.

## Not yet
The moment-3/4 feel pass from `cake-feel-spec.md` (sounds, knife drag, the plate ceremony timing),
and the group-chat idea of suggesting the *other* names the sender typed.

## Three bugs found on the way
- `.primary { display: block }` beats the `hidden` attribute, so "Send a slice back" stayed visible
  after use. Same trap as the swatch rows; now `.primary[hidden] { display: none }`.
- The slice-page wedge sat beside its plate rather than on it: I offset by the wedge's centroid
  *before* rotating it, and the centroid moves when you rotate. Rotate first, then offset by where
  the centroid ended up.
- Not a bug, but it looked like one: the cut cake appeared to have lost its message. It hadn't —
  the message is on the back of the cake and the render showed the front.

Verified end to end headlessly: cut → real touch-tap lift → send back → three to a friend →
persistence → the friend's slice page (candle lit, blow, done) → the sender's slice-back page.

## docs/
Build plan updated with Phase 4 status. Everything else as before.

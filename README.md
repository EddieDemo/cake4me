# Cake — v0.19

## 1. Message colour
New `tc` field with a **Text** sub-tab under Colours. Index 0 is `Auto`, which keeps the old
behaviour of picking dark or light from the frosting's luminance; the Auto swatch previews the
colour it would actually choose.

Low-contrast combinations aren't blocked — it's their cake — but the note under the row says so:
"Low contrast — this may be hard to read on the cake". Contrast is a WCAG-style ratio against the
frosting, under 2.2 triggers it.

## 2. Descenders and ascenders no longer clip
The text was being fitted and centred on the **em box** with `textBaseline: 'middle'`, and
Pacifico's ascenders and descenders overshoot its em box considerably — so a `y` tail ran off the
bottom of the band.

It now measures real ink extents (`actualBoundingBoxAscent` / `Descent`), fits the block of ink to
the band, and positions by the **baseline**. There's a fallback for engines without ink metrics.
It also shrinks the text a little further on the Showstopper, whose bottom band is shorter than
the Classic's — which is correct, and is what was clipping worst.

## 3. The cake is pinned, and doesn't move between trays
`measureUiReserve()` measures every tray's height straight from the DOM — briefly un-hiding each
to measure it — takes the **tallest**, adds the chip row and CTA, and offsets the camera's look-at
so the cake lands in the centre of the remaining free space.

Nothing is hardcoded, so this survives the UI changing. Verified: the camera's Y is identical with
the Cake tray open and with the (taller) Message tray open. Recomputed on resize and orientation
change.

## 4. Focus ring clipping — not a render-order problem
The swatch row is a horizontal scroller, and `overflow-x: auto` forces `overflow-y` to clip as
well. The selected swatch's ring was simply being cut off by the scroll container. Fixed with
padding inside the scroller and compensating negative margin.

## 5. The "your cake is ready" screen
- **The cake no longer bursts out of the box.** `BOX.half` was a constant 2.62 while the
  Showstopper's bottom tier is 2.7, so it pushed straight through the side. The box is now sized
  from the widest tier of the actual cake, with the box camera framing widened to match. It only
  ever affected the Showstopper, as you guessed.
- **The gift tag stopped jittering.** It was being projected from the lid's 3D position every
  frame, so it inherited the box's rotation and the camera easing. It's now pinned top-centre in
  screen space and the scene can't touch it.
- **Floating UI**, matching everywhere else: no card, link as a pill, actions as chips.

## Compatibility
`tc` appends after `rc`. A 9-field link from before either field existed still decodes, coming
back with `bg: 0`, `rc: 0`, `tc: 0` — exactly what those cakes rendered. Links are 98 characters.

## docs/
Business plan, build plan, feel spec, aesthetics notes, serverless mitigations.

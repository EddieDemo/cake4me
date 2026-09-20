# Cake — v0.52 (any colour for the key and the spot)

Both the Key and Spot tabs gain a **colour picker** (the phone's native one) beneath the warmth
slider. Picking a colour overrides warmth; **use warmth** hands control back to kelvin. The label
says which is in charge.

- `LOOK.keyHex` and `LOOK.spot.hex`: a 24-bit colour, or **−1 = use kelvin** (the default).
- Two numbers appended to the lighting field (18 and 19), so existing 17-number strings decode
  with the colours still coming from warmth. Round-trip verified; legacy strings verified.

The reason the slider stays the default: every point on the warmth line is a light that exists in
the world, and most of the colour space is lighting that reads as a mistake (light colour multiplies
surface colour — a green key on pink frosting is mud). Where a full colour earns its place is the
spot and the product's future moods: a pink spot on a white cake, red and green for Christmas, a
cold blue rim for Midnight.

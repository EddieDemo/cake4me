# Cake — v0.54 (sponge first, then frosting)

The builder now makes a cake in the order a cake is made. The signed-off UI, implemented:

## The Cake chip has three sub-tabs
- **Tiers** — the tier picker, as before.
- **Sponge** — filling colour and a **2 / 3 / 4 layers** picker. The layer count drives the filling
  stripes on the naked sides *and* on every cut face.
- **Frosting** — a **"Frost the cake"** toggle (off by default: a new cake starts naked), the
  frosting colour, and a style row: Smooth now, with Drip, Rustic and Semi-naked reserved.

## Colours dissolved into their homes
Candle colour and ribbon in **Candles**; writing colour (and its contrast note) in **Message**; the
background on its own **Backdrop** chip. The Colours chip is gone.

## The naked cake
A tier without frosting is the sponge itself: drawn `FROST_T` (0.08) smaller than the shell, wearing
its filling stripes round the side and a plain crumb top, matte. The message is piped straight onto
the sponge — the message texture now paints the stripes as its background instead of a flat frosting
colour. Wedges and the slice page match, because one function (`tierMaterials`) now builds the
materials for the whole cake, the cut and the slice, so the three can't disagree.

## The moment
Toggling frosting on rebuilds the cake and fades the shell in over the sponge with a tiny settle in
scale (`frostOn`). A clipping-plane "pour" would need its own shader variant; it's parked for the
textures pass.

## Schema
`ly` (sponge layers, 2–4, default 3) and `fr` (frosting type, 0 none / 1 smooth) appended after
`lt`. `fr` **defaults to 1 on decode**, so every link made before this build is still a frosted cake;
only the builder's fresh draft starts at 0.

Verified end to end: layer count changes the stripes; toggle round-trips through the link; a
recipient opens, cuts and slices a naked cake; a legacy 14-field link decodes as frosted with 3
layers; 16 shader programs at load, 16 after the journey.

## docs/
Builder spec updated with the new structure.

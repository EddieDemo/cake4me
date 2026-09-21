# Cake — v0.73 (MVP Phase 2)

## Slice parity
The recipient's slice was built from half the information and on its own plate. Now:
- **One plate** (`makePlate`, `PLATE`): the sender's lifted wedge and the recipient's slice page
  use the same plate. The slice page's smaller plate and its ribbon-coloured torus rim — the red
  ring — are gone.
- **One way of plating** (`wedgeOffsetFor`): the recipient's wedge is made by the same
  `makeWedge` from the **full tier** (`tierTops`: sponge size, index, the tier above), with the
  same wedge index the sender cut, the same message band, dropped onto the plate the same way.
  So a fondant slice shows the fondant band with the layered sponge inside, not "a slice of
  frosting".
- **Ribbons go with the slice.** Wedges now carry their tier's ribbon, cut to the wedge
  (`bandGeometry` takes a sweep); before, cutting silently removed it.
Lighting and backdrop already travelled in the link and were applied on the slice route.

## A finished cake to start with
A new cake is a **finished single-tier cake in a random curated look**: fondant on, one or two
fillings, a comfortable shape, a ribbon about half the time. Randomness picks a *look* from
`LOOKS` (ten colour sets that belong together: fondant, filling, ribbon, candle, backdrop), then
varies shape, fillings and ribbon within `LOOK_BOUNDS`. Never the same look twice running. The
words, names, candle count and lighting are the sender's and are left alone. First pass — both
tables are at the top of `app.js` for tuning later.

## Shuffle
A 🎲 **Shuffle** chip at the start of the row re-dresses the cake in a new look for its current
tier count (a two-tier cake gets two tiers, the upper one narrower). The die tumbles.

Verified: three looks from load + shuffles; sender's lifted slice and recipient's slice match
(same plate, fondant band, three fillings); no rim; 16 programs at load, 16 after; no errors.

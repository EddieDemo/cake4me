# Cake — v0.60 (tier shape)

Each tier's **width and height are the sender's**. In the Cake tray's Tiers sub-tab, under the tier
picker: tier pills (only as many as the cake has), a **Width** slider and a **Height** slider for
the selected tier, and **Reset shape**. Ten steps each; radius 0.9–2.7, height 0.6–2.0.

## The constraint, as a clamp rather than a rule
An upper tier can never be wider than the tier below it minus a 0.3 ledge (about a candle's width,
so a tier always reads as a tier). The width slider's maximum for tier 2 *is* tier 1's current
width minus the ledge, and likewise for tier 3; and narrowing a lower tier pulls the tiers above it
down with it, so the stack is always valid and no slider ever sits somewhere illegal. Candles go on
whatever ledge has room, or the top when none does — the placement already did that.

## Under the surface
The fixed tier table (`TIERS`) is now only the classic starting point. Everything that read it — the
camera framing and centre of mass, the box size, the free-area fit, candle placement, the cut
wedges, the slice page, the ribbon pills — reads **`tiersFor(cfg)`** instead, so a custom shape is
a first-class cake everywhere. Price and slice count stay keyed to tier *count*.

## Schema
`tp` appended: two characters per tier, width step and height step. Missing → the classic
proportions, so every existing link is untouched; a new tier count also starts from the classic
shape for that count. The live `sh` array is the runtime truth (UI edits); `tp` enters via decode
or an explicit `cake.set({tp})`.

## A bug this exposed and fixed
`build()` only normalised its config when the ribbon array was missing, so `cake.set({t:3})` on a
one-tier cake built a one-tier shape under a Showstopper label. `build()` now always normalises —
the derived arrays must match the tier count.

Verified: the clamp (tier 3's width max fell to step 1 after tier 1 went slim); link round trip; a
recipient cutting a custom-shaped cake; legacy links decode to classic; 16 programs at load, 16 after.

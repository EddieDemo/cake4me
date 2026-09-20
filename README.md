# Cake — v0.58 (ribbons: flush, and per tier)

## 1. Flush
The old ribbon was an open cylinder standing 0.07 off the sponge with no thickness — a hoop. It's
now a real **band**: a lathe with its inner face on the wall, a hair (0.02) thick, closed top and
bottom so the edge catches light. And it **follows the wall's profile** — `CakeShapes.bandGeometry`
samples the body profile at eight heights — so it hugs the frosted tier's bulge and crosses a naked
tier's grooves without lifting off. (The first version assumed a straight radius and the bulging
wall swallowed everything but the bottom edge.)

## 2. Per tier
Each tier has its own **on/off, colour and width**. In the Decorate tray the Ribbon section starts
with tier pills (Tier 1 · 2 · 3, only as many as the cake has); the toggle, the swatches and a
**width slider** (0.12–0.47 world units in eight steps, default 0.32) edit the selected tier.

## Schema
`rbt` appended: three characters per tier — on (0/1), colour index, width step — nine characters
for a Showstopper. It wins when present. `rb` and `rc` stay as a legacy summary: a link without
`rbt` derives per-tier settings from them, so every existing link looks exactly as it did (verified:
an old rb=2/rc=3 link decodes to ribbons on tiers 2 and 3 in colour 3). New links write both; the
summary is kept in step with the per-tier truth, and the box bow uses the first tier that has a
ribbon.

The live `rt` array is the runtime truth; `rbt` only enters via decode (or an explicit
`cake.set({rbt})`, which now clears the array so the string is honoured).

Verified: two different ribbons on tiers 1 and 3 round-trip through a link; a recipient opens and
cuts it; 20 shader programs at load, 20 after.

# Cake — v0.65 (semi-naked frosting)

## New file: `frosting.js`
Frosting **styles** — how the shell is painted or shaped beyond a colour — live here, one function
each, so `app.js` stays the product and this file grows as styles do: semi-naked now, drip and
rustic next. It knows nothing about cakes; it takes a base painter and a frosting colour.

## Semi-naked
The smooth shell wearing a thin scrape of frosting: the sponge and its filling lines show through
in vertical smears, fuller near the rims. Per pixel over the layer painting (768×384, smeared, so
it needn't be sharp), with a per-tier seed so tiers don't repeat. The message is piped straight
onto the scrape — `makeMessageTexture` now takes a general *base painter* rather than the
naked-only sponge, so any style can sit under the writing. Wedges and the slice page inherit it.

Textures are cached on their inputs (colour, filling, layers, tier height, tier index), so
scrubbing a shape slider doesn't repaint them; the cache holds 12 and disposes the oldest.

## Style row
Smooth and Semi-naked are live; Drip and Rustic stay reserved. `fr`: 0 none · 1 smooth · 2 drip ·
3 rustic · 4 semi-naked. A link asking for a reserved style decodes as smooth. The Frost toggle
remembers the last style chosen, so off-then-on comes back semi-naked.

Verified: style selection, toggle memory, link round trip, reserved fallback, 16 programs at load
and 16 after.

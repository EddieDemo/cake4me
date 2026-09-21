# Cake — v0.69 (the sponge as a stack of real solids)

Cutting no longer paints a picture of layers on a flat face. **The sponge is a stack**: each sponge
layer and each filling is a real, closed, softly-rounded solid, fillings set slightly in; a cut
face is just the end of each solid, in that solid's own colour. The uncut naked cake is built
from the same parts, so the grooves you see outside *are* the filling solids, and the cut and the
uncut cake cannot disagree.

## How it's put together
- `shapes.js`: `disc` (a closed lathe solid with rounded edges, UVs in *tier* space), `discTop`
  (the lid, so the top layer's top can be its own plain material rather than the side texture
  sampled radially), `discFace` (a solid's flat end), `merge` (many geometries → one, with a
  material group per part), and `cutFace(...inner)` (an L-shaped face showing only the fondant's
  thickness).
- `app.js`: `buildStack(cfg, tier, TM, sideMat, θ0, len, seg, partial)` builds one merged mesh per
  tier — materials `[side, sponge ends, lid, filling ends…]` — for the whole cake (full sweep) and
  for every wedge (partial sweep with ends). A fondant wedge is the shell, its L-band, and the
  stack inside. A fondant tier uncut is still just the shell (the stack inside is invisible).
- One mesh per tier uncut; two per fondant wedge, one otherwise — draw calls unchanged.

## A bug this exposed, older than the stack
The persistent message canvas (v0.62) is shared by every band texture, and the **warm-up compile
painted its own band into it after the real cake had been built but before that texture had
uploaded** — so a recipient's cake could wear the warm-up's pink band. `makeMessageTexture` now
uploads eagerly (`renderer.initTexture`) the moment it paints.

Verified: uncut naked + semi-naked with the message wrapping across the layers; a recipient
cutting a naked cake (real layer ends); a fondant cake cut (L-band with the stack inside); 16
programs at load, 16 after; no errors.

# Cake — v0.56 (sweep)

Is there redundant code after `color.js`? A little, not a lot: the shim replaces work that was
never being done rather than work that was, so there were no hand-written conversions to delete.
The one explicit conversion that remains — the kelvin→RGB fit in `look.js` — is needed, because
that fit produces sRGB-ish channels through `setRGB`, which is linear by contract.

What the sweep found and removed or fixed:
- `makeLayersTextureOLD` — the pre-v0.54 layers texture, left behind when the layer count went in.
  Deleted.
- Two more sRGB-era luminance thresholds the v0.55 pass missed: the ribbon darkening rule
  (0.82 / 0.75) and the contact disc's backdrop fade (÷0.55). Both now go through
  `THREE.Color.srgbToLinear`, so every luminance comparison in the app is in one space.

Also checked and clean: no leftovers from the removed quality ladder, the old tallest-tray layout,
or the dissolved Colours tray. `lighten / darken / luminance / hexCss` are all still in use (canvas
painting is sRGB and must stay hex-based). `look.js` still carries the VSM, environment and
tone-mapping knobs — not dead, they're the switched-off options for glossy skins.

Verified: 16 programs at load, 16 after the journey; no errors.

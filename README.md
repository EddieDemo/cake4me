# Cake — v0.59 (sky and floor, for real)

Three colour-space mistakes, all mine, all fixed. The sky and the floor now agree to within a
couple of levels on every backdrop, including Midnight, and the floor plane's far edge no longer
shows as a line.

1. **The probe read back the wrong space.** An offscreen render target isn't output-encoded unless
   told to, so the bytes were linear and I decoded them as sRGB — too dark. `probeRT.texture.encoding
   = sRGBEncoding` makes the readback mean what the viewer sees.
2. **Fog is applied in screen space in r128.** `fog_fragment` comes *after* `encodings_fragment`
   (checked in the vendored build), so the fog colour must be handed over already converted to
   sRGB. Handing it linear drew the far floor darker and more saturated than the sky — the band in
   your screenshots.
3. **The colour shim converted hex strings twice.** Three's `getHexString` calls `getHex` internally;
   I had patched both, so the linear→sRGB conversion ran twice for strings. Barely visible on light
   colours, dramatic on dark ones (Midnight's sky came out pale slate). Every CSS sky variable since
   v0.55 was a little too bright because of it. `getHexString` is now derived from the *original*
   `getHex` on an already-converted copy; `#161c33` round-trips as `#161c33`.

Verified: Midnight top-of-canvas (19,20,31) vs near floor (24,21,31) vs CSS `#0f111d`; Sky and
Cream within two levels; no errors.

A consequence worth knowing: Midnight is properly dark now rather than slate — that's the true
palette under the night lighting. If it reads too dark on the phone, the night ambient in
`LOOK.night.hemi` is the knob.

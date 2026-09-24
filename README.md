# Cake — v0.95 (fixes)

**The Numbers button.** Every script and the stylesheet now load with `?v=0.95`, so a phone can't
mix a new page with a cached old stylesheet or script — the likeliest reason the button did
nothing and the Age row showed in Candles mode. The switch is also sturdier: one delegated
handler, and the rows are shown and hidden by the script directly rather than relying on CSS.
Verified with real taps: Numbers switches, the Age row appears, the count row goes.
Bump the `?v=` number in index.html with each release from now on.

**Banding in the background, moiré on the cake.** Both came from the ambient occlusion's depth:
at 16 bits it was coarser, at our viewing distance, than the occlusion test itself, so surfaces
occluded themselves in stripes that crawled as the camera moved. Now:
- 24-bit depth for the occlusion pass,
- a slightly larger minimum distance, so a surface can't occlude itself,
- only the cake and its candles take part (the backdrop and floor are far away and have nothing
  on them to occlude).
And for the finer textures: anisotropic filtering on every procedural map, so they stay sharp at
grazing angles instead of shimmering, and the rack wires are slightly wider so they don't alias
into a cross-hatch.

To compare on the phone without the console: add `?ao=0` to the address to turn the occlusion off.

# Cake — v0.84 (the ribbon becomes cloth)

- **Selvedge and shape.** The band is a real cross-section now: a fine cord at each woven edge
  with the middle cupped in toward the cake (`CakeShapes.ribbon`).
- **Satin and grosgrain.** Two materials, chosen by the icons in the Ribbon tray (`rm`). Both have
  a woven normal and roughness map, and both use an **anisotropic highlight**: a shader patch that
  smears the highlight *along* satin's threads (and *across* grosgrain's ribs) instead of leaving a
  round spot. The peak is clamped — at grazing angles it runs away and blows the ribbon out to
  white. One shared program for every ribbon.
- **Tied by hand.** From the cake's seed: a few millimetres off level, and a gathered stretch that
  narrows the band and lifts it off the cake, so a gather reads as a gather.
- **Angle slider**, per tier (`rba`, ±4 steps ≈ ±5.6mm at the rim), beside Width and Height. It's
  an ask, not a command: the wall decides. The tilt is clamped to the room left between the band
  and the top and bottom of the tier's straight wall, so a ribbon flush with either simply tilts
  less rather than riding off the cake. Verified with position 9 and angle +4.
- The generator ties ribbons with a small random angle and picks satin most of the time.

One thing found on the way: the fondant wall swells slightly at mid-height, so a ribbon at a fixed
radius sank inside it and vanished. It now sits on the wall's actual radius at its own height.

Verified: satin level, satin angled, grosgrain and the clamped case all render; link round trip;
18 shader programs (one new, for the ribbon), no errors.

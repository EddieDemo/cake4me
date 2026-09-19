# Cake — v0.27

## 1. The cake shows on the occasion screen (and scales to fit)
The free-area measurement was sorting UI elements into "top edge" or "bottom edge" by which half
of the screen their centre sat in. With a tall tray — the occasion grid, especially at larger text
sizes — the chip row's centre crossed above the midpoint, got counted as a top edge, and the free
space collapsed to a sliver between the chips and the tray. The cake was faithfully scaled into
that sliver, behind the UI.

Edges are now classified **by role**: the builder, viewer footer and link panel are always the
bottom edge; the slice header and gift tag are always the top. A floor of 140px keeps the cake
meaningful when a tray is very tall. Reproduced with the chip row at 30% of the screen (your phone's
layout): the cake now sits, small, in the space above it.

## 2. Resolution: start at the device's ratio, drop on evidence
Two things were wrong with the adaptive ratio.

- **It judged lateness against the display's fastest interval.** On a 120Hz ProMotion iPhone a
  rock-steady 60fps read as *every frame late*, so it never climbed and could even drop. Lateness is
  now judged against a fixed budget: anything under ~22ms is fine, whatever the display could do.
- **It started low and climbed on evidence.** Now it **starts at the device's ratio (up to 3) and
  drops on evidence** — more than 20% late frames in a 1.2s window, after a 1.5s grace period for
  first paint and font load. A moment of stutter at load is far less bad than permanent blur. It
  climbs back only when late frames are under 4% and CPU cost is low.

Net: on an iPhone Pro, 3× from the first frame unless the phone proves it can't hold it.
`cake.quality()` now reports `lateFrac` so you can see the evidence it's acting on.

## docs/
Unchanged.

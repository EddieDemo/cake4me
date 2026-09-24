# Cake — v1.04 (the flame no longer borrows its look from the backdrop)

**Found it, and reproduced it.** The flame was translucent everywhere — it added its light to
whatever was behind it. Side-on, what's behind it is the backdrop's wall: darker, so the flame
read rich and gold. As the camera rises, the horizon of the backdrop climbs the screen and the
flame ends up in front of the bright floor: the floor shows through, the flame goes pale and grey
and flat, and the horizon line itself is visible across it. The "horizontal line that moves as the
camera tilts" IS the backdrop's horizon, seen through the flame.

Fix: the flame's **heart is opaque** (it hides what's behind it, and brings its own light), while
its edges and its halo stay translucent and additive. Against the wall it looks as it did; against
the floor it now looks the same instead of washing out. The tag reads **v1.04**.

Ruled out along the way: the occlusion pass (v0.97 moved the flames after it), the flame's
surface shading (tried and reverted in v1.02), and the halo's hard edge at the candle's rim
(v1.03 — real, but a different, smaller thing).

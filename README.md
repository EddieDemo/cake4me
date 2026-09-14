# Cake — v0.9 (handling, part three)

## 1. The hard crescent under a tilted cake
That was the contact shadow. Tilting pushes the near edge of the cake *below* the ground plane,
and two surfaces crossing gives you a hard intersection line.

`depthTest: false` was the wrong fix — I tried it and it broke worse. The cake is opaque and the
shadow is transparent, so three.js draws the shadow *after* all opaque geometry; with depth testing
off it painted a grey ellipse straight over the front of the box.

The fix in this build is geometric: the shadow plane rides just below whatever the lowest point of
the tilted object currently is (`updateShadow()` computes the dip from the current tilt, the pivot
height and the footprint radius). There is never an intersection to draw. It also fades to 50% at
full tilt, since a heavily tilted object wouldn't cast a full-strength footprint.

## 2. The thumb pushes much less
The previous build fixed the wrong end — clamping the top speed hid an over-sensitive input rather
than fixing it.

- `pxPerTurn` **1600** (was 620). The cake now moves about a third as far for the same thumb travel.
- Release velocity is **averaged over the last 80ms** (`velSmoothMs`) instead of taken from the final
  frame, so a fast last frame can't spike into a fling.
- `flingGain` **0.35** (was 0.55).
- `max` 7.0 rad/s, but it now rarely comes into play, which is the point.

A full-width swipe across the phone now lands at about 0.75 rad/s. Before it was 4.6.

## 3. Tilt and twist are held, not sprung
Only the spin decays, back to the ambient turn. Tilt (X) and twist (Z) stay exactly where you leave
them. A new cake starts level.

## 4. Twist is a real gesture now
The automatic "bank into the turn" is gone — it couldn't persist and it would have fought a held
value on the same axis. **Two-finger rotate** twists the cake, clamped to ±0.44 rad (±25°), held.
That's the native touch gesture for rotating an object, so it needs no explanation, and it leaves
the one-finger drag free for spin and tilt.

## 5. Smaller box
`BOX.half` 2.62 (was 2.95), height floor 2.9 (was 3.4), and `FRAME.box` 4.5. It reads as a gift box
rather than a packing crate, and it no longer crops on a narrow phone.

## 6. The box handles like the cake
Spin, tilt and twist are live at the gate, so the box idles and can be picked up and turned before
you open it. It gets its own pivot (its middle) and its own shadow footprint; when the lid comes off,
the pivot hands back to the cake.

## Pivot: centre of mass
Tilt and twist pivot about the object's centre of mass, not its base — it's an object you're holding,
not one resting on a table. `centreOfMass()` weights each tier by volume (r²h): a Classic lands at
y ≈ 0.80, a Two-tier at y ≈ 1.07 (the wide base dominates). Implemented as a pivot offset, so nothing
moves until you actually tilt.

## Tuning
`SPIN { idle, max, drag, blowAt, blowFull, pxPerTurn, flingGain, velSmoothMs }`
`TILT { min, max, pxPerRad }` · `TWIST { min, max }`
Console: `cake.debug()`, `cake.SPIN`, `cake.TILT`, `cake.TWIST`, `cake.tilt`, `cake.group`

## docs/
Current copies of the business plan, build plan, feel spec and aesthetics notes.

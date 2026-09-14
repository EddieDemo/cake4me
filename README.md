# Cake — v0.20 (confetti that actually tumbles)

You were right that it looked wrong, and the honest diagnosis is that the previous version already
had orientation-coupled drag and lift — the physics was nominally there, it just wasn't reading.
Three reasons, all now fixed.

## 1. The air never drove the rotation
Orientation affected the forces, but the forces never affected orientation, so rotation and
translation ran alongside each other and never talked. That's exactly what "everything falls the
same way" looks like.

There's now **aerodynamic torque**: the centre of pressure on a flat plate sits ahead of its centre
of mass, so airflow twists the piece toward edge-on, it overshoots, flips, and the cycle repeats.
Torque axis is `normal × velocity`, magnitude scaled by speed and angle of attack. That feedback
loop is what produces the rock-flip-rock of real paper.

## 2. The tumble was being damped to nothing
`spinDamp` was 0.55, so within a second or two pieces had stopped turning. It's now 0.16 — light,
because paper keeps tumbling until it lands. Measured across a burst: median spin holds around
3.7–4.8 rad/s the whole way down instead of decaying to zero.

## 3. Drag was too high for lift to do anything
`dragFlat` was 3.1, high enough that pieces hit terminal velocity within a few frames. Lift scales
with speed, so there was nothing left to push them sideways. Now 1.15, and lift raised to 3.4.

## Also added
- **Quaternion orientation with a free angular-velocity vector**, rather than Euler increments, so
  the spin axis itself precesses and tumbling looks irregular instead of turning about one fixed
  axis forever.
- **Three fall archetypes**, mixed per burst: `flutter` (rocks side to side, strong torque
  response — the classic falling leaf, 46%), `tumble` (continuous end-over-end with a steady
  sideways drift, 34%), `autorotate` (spins about its own face normal and descends in a slow
  helix, like a sycamore seed, 20%). Real confetti shows all three at once and that variety is
  most of what sells it.
- **Per-piece mass variation** (0.75–1.35), so terminal velocities differ. Without it the burst
  descends as one uniform curtain. Measured speed spread grows from 1.3 to 3.8 during a fall.
- **One shared, slowly-varying air current**, so the cloud drifts and swirls together rather than
  being 200 independent particles. Drag and lift are computed against velocity *relative to the
  air*, not absolute velocity.

## Two guards this needed
A torque feedback loop plus lift is not unconditionally stable, and both failure modes would land
on a real phone:

- **A piece could hover forever.** One in 160 did, in testing — which would leave the whole update
  loop running indefinitely and drain battery, since it only stops when everything has settled.
  Gravity now ramps up from 7s and horizontal motion is bled off at 12s, so everything lands.
  Verified: all 160 pieces settle on all three tiers.
- **Angular velocity is unbounded**, since torque only ever adds. Capped at 13 rad/s.

## Tuning
`CONFETTI { gravity, dragFlat, dragEdge, lift, torque, spinDamp, spin, maxSpin, wind, settleMs,
forceMs, streamMs, marginY }` · `FALL[]` for the archetype mix.
Console: `cake.confetti()` for counts, `cake.confettiRaw()` for per-piece state.

## docs/
Business plan, build plan, feel spec, aesthetics notes, serverless mitigations.

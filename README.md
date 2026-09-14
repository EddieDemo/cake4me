# Cake — v0.12 (no speed limit)

`SPIN.max` is now `Infinity`. Flick it as hard as you like; the orbit takes whatever velocity the
gesture gives it and decays from there.

## What's left in place of the clamp
- **A finite guard.** `isFinite()` checks on the drag velocity, the release velocity and the
  running value, so a pathological pointer event can't put `NaN` into the camera and blank the
  scene. It's not a limit, it's a crash guard.
- **An azimuth fold.** With no ceiling, a long session of hard spinning could run the azimuth into
  numbers big enough to lose float precision. Once past ±20 turns it folds back by whole
  revolutions — the same angle, so nothing visibly happens.

Everything else is unchanged: `pxPerTurn` 1600 and `flingGain` 0.35 still mean a normal swipe is
gentle, and the decay (`SPIN.drag` 2.1/s) still brings it back to the ambient orbit. You've removed
the ceiling, not the weight.

## The one consequence worth knowing
Above roughly 20 rad/s the camera moves more than 20° per frame at 60fps, and the cake reads as
strobing rather than spinning — the frame rate can't keep up with the motion. Nothing breaks, and
it's arguably fun at that point. Fixing it properly would need motion blur, which means a
post-processing pass, which is on the "skip for now" list in `docs/cakeAesthetics.md`.

Wind scales as before: `blowAt` 1.9, `blowFull` 5.5, so anything above 5.5 rad/s is already blowing
at full strength and a harder flick just looks more dramatic.

## docs/
Business plan, build plan, feel spec, aesthetics notes, serverless mitigations.

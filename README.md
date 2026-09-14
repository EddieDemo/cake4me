# Cake — v0.8 (handling, part two)

## What changed

**1. Docs travel with the code.** `docs/` now holds the current version of every planning
document (business plan, build plan, feel spec, aesthetics notes). See `docs/README.md`.

**2. Everything is ~10% smaller.** The camera frames to a radius rather than a fixed distance,
and there are now two framings: `FRAME.cake` (3.3) and `FRAME.box` (4.7). The box needed its own,
wider one — it was being cropped at the sides on a phone because a square box's corner diagonal
is much bigger than a round cake's radius. The camera eases between them when the box opens.
Bigger number = smaller object. The look-at also sits higher (1.3), which drops the cake down the
screen and stops the "Happy Birthday" header colliding with the candles.

**3. Spin is slower and heavier.**
- `pxPerTurn` 620 (was 360): the thumb has to travel further for one turn.
- `flingGain` 0.55: only just over half the release velocity is kept, so a flick doesn't launch it.
- `max` 8.5 rad/s (was 22), about 1.35 turns a second.
- `blowAt` 2.2 and `blowFull` 6.5 rescaled to match, so blowing the candles out takes about the
  same effort as before relative to the new ceiling.

**4. Tilt on the vertical axis, bank on the third.**
- Drag **down** to look further over the top of the cake, **up** to see more of the side.
- Clamped to −0.34…+0.30 radians (about −19°…+17°). It cannot flip, and it springs back to level
  when you let go (`TILT.spring`; set it to 0 if you'd rather a tilt stayed put).
- The third axis (roll) is **not** on the thumb: one finger only has two degrees of freedom, and a
  cake rolling sideways reads as broken. Instead the cake **banks into the turn** automatically,
  proportional to spin speed, capped at `SPIN.bank` (0.05 rad). If you want explicit roll later,
  two-finger twist is the right gesture for it.

Structurally, tilt lives on a new parent group (`tiltGroup`) wrapping `cakeGroup`, so tilt and
spin compose as a proper turntable instead of fighting each other through one set of Euler angles.

## Tuning
Everything is in two objects near the top of the spin section:
`SPIN = { idle, max, drag, blowAt, blowFull, pxPerTurn, flingGain, bank }`
`TILT = { min, max, pxPerRad, spring }`

## Console
`cake.debug()` → omega, tilt, bank, lit, state · `cake.SPIN` / `cake.TILT` → live tuning objects ·
`cake.tilt` → the tilt group · `cake.group` → the spin group

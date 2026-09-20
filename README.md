# Cake — v0.62

## 1. The tier-switch animation is back to how it was
What you were seeing was **dead code that came back to life.** A "top tier drops in from above"
animation had existed since the early builds but never fired, because the builder mutated the same
config object the build compared against, so the build never saw a tier change. When v0.60 made the
tier switch produce a fresh config, the comparison started working and the drop woke up — along
with a re-pop of every candle. Both are gone for good; a tier switch is once again just the camera
easing to the new cake.

## 2. A tier may be exactly as wide as the tier below
The ledge minimum is 0. Tier 2's width slider now maxes out *at* tier 1's width.

## 3. One candle by default
`DEFAULTS.n` is 1. (Links always carry their own count.)

## 4. The page "refreshing" — Safari killing the tab for memory
Every slider tick rebuilt the whole cake, and each rebuild allocated a fresh **4096px-wide message
canvas (~16MB on your phone)** plus a cut-face texture per tier that nothing used unless the cake
was cut. At dozens of ticks a second, iOS Safari's canvas memory limit was blown and it reloaded
the tab. Three fixes:
- **One persistent message canvas**, redrawn rather than reallocated. There's only ever one live
  band, so one element serves every build.
- **Slider rebuilds are coalesced** to at most one per animation frame, and during a shape drag
  the existing message texture is **kept** (`keepMessage`) — the text scales a hair with the tier
  for a moment — with one full redraw on release.
- The cut-face material is **made on demand** (cut, slice page, dev cut-away), not per build.

Measured: **zero canvas allocations across 20 slider ticks**, two on release; GPU texture count
flat at 8 throughout.

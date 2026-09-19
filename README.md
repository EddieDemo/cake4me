# Cake — v0.35 (contact-hardening shadows; one-rung fallback)

## New file: `pcss.js`
Contact-hardening shadows — crisp where the caster touches the receiver, softening the further the
shadow falls from it — as a self-contained patch of three.js's shadow lookup. Nothing else in the app
knows the shader exists; `look.js` turns it on with one call.

How it works, per shadowed pixel: a **blocker search** (how far away is the thing casting on me?),
a **penumbra estimate** from that distance and the light's size (similar triangles), then a
**Poisson-disk filter** of that width, rotated per pixel so the grain reads as texture rather than
banding. Nothing in the way → early out, fully lit, cheap.

Two architectural points worth knowing:
- Three caches compiled shader programs by parameters that don't include chunk text, so a patched
  chunk would never reach an already-compiled material. `pcss.js` installs a global program-cache
  key that changes on each install/uninstall, so **every material recompiles on the next frame** and
  the shadow type can be switched live from the console.
- The map is a plain depth map (renderer type PCF); VSM stores something else, so the two can't mix.

## Defaults and tuning
`LOOK.shadowType = 'PCSS'` (VSM and PCFSoft remain). `LOOK.pcss`: `lightSize` 0.6 world units,
`samples` 13, `maxRadius` 0.035. My first guess for light size was 2.4 — wider than the cake — and it
dissolved every shadow; 0.25–0.9 is the useful range. A/B on the phone:
`cake.look.shadowType = 'VSM'; cake.relook()`.

Cost: ~39 texture taps per shadowed pixel, three times PCFSoft. Watch the dev overlay's low number.

## The quality system is now one rung
Phone testing showed frame rate barely moves, so nothing is traded away by default: full device
pixel ratio, PCSS shadows, halo on every candle. The single remaining safety net is an
**emergency fallback** for a phone that genuinely can't hold the target — more than 25% late frames
for four consecutive windows (≈5s) — which switches to hard shadows and no halos, and lets go after
eight comfortable windows (≈10s). It never touches resolution. `cake.quality()` reports
`fallback: true/false` and a log.

## docs/
Aesthetics doc updated.

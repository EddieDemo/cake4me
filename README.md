# Cake — v0.37 (a real floor; no spin while building)

## 1. The builder doesn't turn on its own
The ambient turn is for the recipient's cake. The sender is working on theirs, and a thing that
keeps rotating while you place candles is a nuisance. In the builder the resting rate is now zero:
it moves only when dragged. The viewer keeps its idle turn.

## 2. The background is a lit floor — `stage.js`
Before: a CSS gradient behind a transparent canvas, and the cast shadow as a tinted decal on an
invisible plane. Neither knew about the other, so on Midnight the "shadow" was lighter than the
floor — which light can't do.

Now the palette's two colours are the **sky** and the **floor paint**. The floor is a real 400-unit
plane lit by the same hemisphere and key light as the cake, receiving the PCSS shadow as a genuine
absence of direct light. So:
- a shadow is always darker than the floor beside it, by exactly the share the key light contributed;
- dark backdrops are dark paint, not a trick, and the candlelight pools on the floor around the cake;
- confetti and slices land on a lit surface rather than a decal.

**The horizon.** A finite plane has an edge. Fog in the lit-floor colour dissolves the plane into the
CSS sky before that edge, and the fog distance follows the camera every frame so the cake itself is
never fogged, even zoomed out. Both the floor and the sky darken with the room.

**Lights retuned.** The old intensities were set against an unlit gradient and would have blown the
floor out to white. Now paint × (ambient + direct) lands close to the paint in daylight
(hemisphere 0.55, key 0.62). The cake is fractionally dimmer than v0.36 as a result — that's the
honest number.

## 3. The dev panel is the whole lighting rig
Under the target toggle, with `?dev=1`:
- **ambient** — the room's brightness; floor, cake and sky dim together. Live.
- **key light** — the sun/window; sets highlight strength and **shadow depth**. Live.
- **light size** — how fast a shadow's far edge softens (contact-hardening). On release.
- **samples** — shadow filter quality vs cost. Labelled now.

`cake.relight()` applies intensity changes without a shader recompile; `cake.relook()` still does
the full rebuild.

## Architecture
`app.js` (product) → `look.js` (lights, shadows, halo, night) → `pcss.js` (shadow shader) →
`stage.js` (floor, fog, sky) → `shapes.js` (geometry) → `dev.js` (overlay, `?dev=1` only). Each
knows its own job and nothing about cakes.

## docs/
Aesthetics doc updated.

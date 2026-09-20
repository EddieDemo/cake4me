# Cake — v0.48 (contact-hardening for the spot)

The spot's shadow is now contact-hardened like the key's — and, being a close local light, shows it
more: crisp where the cake meets the floor, dissolving toward the far end of a long shadow.

## What it took
A perspective shadow map differs from the key's orthographic one in two ways, and both are now in
`pcss.js`:
- **Depth is non-linear.** The map stores NDC depth; the shader recovers real distance from the
  light using the shadow camera's near/far (`pcssSpotDist`).
- **The map's world width grows with distance** (2·d·tan(half-cone)), so the blocker-search and
  penumbra radii are converted to map UV *at the receiver's depth* rather than with a constant.

The penumbra formula itself is unchanged — lightSize × (dReceiver − dBlocker) / dBlocker — which is
the whole point: it's the same physics, just measured in the right space.

## How the shader knows which map it's sampling
three's `getShadow()` is shared by directional and spot lights and doesn't say which. The
otherwise-unused `shadowRadius` uniform is borrowed as a flag: **0 = orthographic** (the key),
**> 0 = perspective**, with the value being **tan(half-cone)** so the shader can convert world sizes
to UV at any depth. `look.js` sets both; the spot's shadow far plane is fixed at 60 so changing
its distance doesn't recompile.

## Dev panel
Spot tab gains **light size** (world units, default 0.5, on release). The note now reads
"contact-hardened". Try it with a low spot from the side in a dimmed room: the floor shadow is the
clearest demonstration of the effect in the whole app.

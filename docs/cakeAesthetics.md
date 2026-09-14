# Cake — Aesthetics

Options for taking the render from "flat shape" to "cake", captured 13 Sept 2026 after the v0.2 renders. Parked deliberately: none of this blocks Phases 2–6. Come back to it as a dedicated pass (probably between Phase 5 and launch, or as the first post-launch update).

## Why v0.2 looks flat

`MeshStandardMaterial` with one ambient and two directional lights and **no environment**. Physically-based materials need something to reflect and shadows to sit in. Everything below follows from that.

## Direction decision (make this first)

Two directions, pulling different levers:

- **Stylised "clay render"** — matte-ish materials, rounded everything, big soft shadows, saturated colours. Toy-like, Pixar-adjacent. Forgiving, always looks intentional, reads well small, survives in-app browsers. Matches "fun and bright" and the existing palettes.
- **Realistic buttercream** — glossier, textured, subtler lighting. Higher ceiling, harder to land, one bad texture makes it look like a supermarket render.

Recommendation: **clay**. Revisit only if the clay look feels too generic once sprinkles and drips are on.

## Tier A — the big four (cheap, transforms everything)

1. **Environment lighting.** Build a small procedural environment once at startup (gradient sky, one bright "window" patch, a warm floor) into a `PMREMGenerator` result and set `scene.environment`. Every material gets soft sheen, colour bleed and believable highlights. Zero per-frame cost. r128 has `PMREMGenerator.fromEquirectangular`; draw the equirect on a canvas.
2. **Tone mapping.** `renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure ≈ 1.1`. Whites stop clipping, colours gain depth, flames get warmth. Check `physicallyCorrectLights` too.
3. **A real shadow.** One directional light with a 1024 `PCFSoftShadowMap`. Candles get contact shadows on the frosting; the cake sits on the plate. Under that, a cheap radial-gradient contact-shadow plane beneath the plate for grounding. Budget: one shadow-casting light only.
4. **Rounded geometry.** Replace the cylinders with `LatheGeometry` profiles: rounded lip on the cap, slight bulge in the sponge, softened plate edge. Same triangle count, reads as a baked object rather than a can. Optional: a little vertex noise on the cap for a hand-finished look.

## Tier B — cake-ness

5. **Sprinkles.** 300–400 tiny instanced capsules scattered on the cap, colours from the candle-colour family. One draw call.
6. **Piped rosette ring** around the top edge: instanced blobs (squashed sphere, slight twist) at regular intervals.
7. **Drips.** A ring of instanced capsules hanging from the cap edge at random lengths, in the cap colour. Hides the cap/body seam. Drip-cake look.
8. **Buttercream bump map.** A canvas of soft noise as `bumpMap` on the frosting for knife-swirl texture. Ganache/glaze skins: `MeshPhysicalMaterial` with `clearcoat` for the wet look.

## Tier C — candles and flames

9. **Two-layer flames**: sharp core sprite plus a large, soft halo sprite. This is the fake bloom; it's what makes 100 candles glow. Feel spec wants the flame to lean with breath: keep both layers on the same pivot.
10. Striped/spiral candles via a small canvas texture; a wax-drip blob at the top.
11. A faint warm emissive tint on the cap under the candles so the light appears to land on the frosting.

## Tier D — skip for now

Real bloom, SSAO, subsurface scattering, depth of field. All need post-processing passes (EffectComposer from the examples bundle) that hurt phones. The halo sprite gets ~80% of bloom for free.

## Performance budget (mobile, 60fps target)

- One shadow-casting light, 1024 map.
- Environment computed once; never per frame.
- Sprinkles / rosettes / drips all `InstancedMesh`.
- Flames: up to 200 sprites (100 core + 100 halo). If that stutters, halo only on every other candle over 60.
- No post-processing.
- `devicePixelRatio` stays capped at 2.

## Later / occasion skins

- Christmas: white "royal icing" cap (rougher bump), holly cluster, snow sprinkle.
- Wedding: tiered white, satin ribbon (lower roughness), pearl sprinkles.
- Halloween: black frosting needs the environment to read at all; test early.
- Photo on frosting: canvas texture on the cap, needs storage (post-launch).

## Plan when we come back

Do Tier A, then sprinkles, rosettes, drips and the two-layer flame as one "v0.x look pass", render headless side by side with v0.2, then test on the phone for frame rate before keeping anything.

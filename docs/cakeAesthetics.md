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

## Tier B+ — Lighting design as a sender feature (added 14 Sept 2026)

Once the sender can choose a **background** (shipped in v0.16), lighting becomes the natural next
lever — and it's the one that changes a cake's mood most for the least geometry.

**Ambient strength.** One slider from "daylight" to near-dark. At the low end the flames become the
main light source, which they already are physically: `candleLight` intensity already tracks the lit
count, so a dark scene means blowing the candles out visibly darkens the cake. That's a free piece of
drama we currently throw away by keeping the room bright. Dark backgrounds (Dusk, Midnight, Ink) exist
in v0.16 specifically to make this land.

**Candlelight as the actual light source.** This is the best thing in the whole lighting idea and it
is nearly free, because the machinery already exists: `candleLight` is a warm point light above the
cake whose intensity already tracks the number of lit candles. Today the room is bright enough that
nobody notices. Drop the ambient and it becomes the story:

- With 100 candles lit on a Midnight background the cake glows from above, warm, with the frosting
  falling off into shadow at the base.
- As candles go out **the scene dims progressively** — every wave of extinguishing is visibly a wave
  of darkening, not just flames disappearing.
- The last candle out leaves the cake nearly dark, which makes the 500ms beat in the feel spec land
  properly instead of being an empty pause, and gives the confetti a black canvas to burst against.
- **Relight** reverses it, so the cake brightens as the ripple runs. Good for filming twice.

Implementation notes:
- Intensity should scale non-linearly with the lit count (roughly `sqrt`), or one candle looks nearly
  as bright as twenty.
- Keep the existing per-frame flicker on the point light; at low ambient it reads as real candlelight
  rather than a lamp.
- The light's height should follow the top tier (it already does) and its distance/decay want tuning
  once ambient is low, since it's now doing all the work.
- Needs a dark background to mean anything. Either gate the preset on a dark `bg`, or have choosing
  it switch the background automatically and say so.
- Watch the message: at low ambient the piped text on the side can disappear into shadow. It may need
  a slight emissive lift, or a fill light that only affects the message band.

**Spotlights.** Two or three `THREE.SpotLight`s aimed at the cake from different angles, each with a
colour, an angle and a penumbra. Presets worth having: single hard key (dramatic, one side in shadow),
warm three-point (flattering, birthday-photo), coloured pair (pink/blue disco), and a single overhead
cone (restaurant "here comes the cake" moment).

**Moving spotlights — the premiere-searchlight idea.** Two beams sweeping in slow opposing arcs, like
a film premiere. Genuinely good for the Showstopper and Absurd tiers, and it reads instantly in a
vertical video. Implementation notes:
- Animate `spotLight.target.position` on a slow Lissajous or simple counter-rotating orbit. Cheap.
- **The visible beam is not the light.** A `SpotLight` illuminates surfaces but is invisible in air.
  The shaft needs a separate mesh: an open-ended `CylinderGeometry` (or `ConeGeometry`) with an
  additive, depth-write-off material and a soft gradient along its length, parented to the light. This
  is the whole trick, and it's how every "god rays" effect that isn't volumetric is done.
- Beams read best against dark backgrounds, so gate the preset on a dark `bg` or force one.
- Budget: shadow-casting spotlights are expensive on phones. Start with **no shadows on the
  spotlights** and keep the single existing shadow-caster, if any. Test on the oldest phone available
  before adding a second.
- Sweeping light on a matte cake looks flat; this preset wants the frosting roughness dropped a little
  so the beam produces a moving highlight.

**Suggested link fields when built:** `li` (lighting preset index), `ls` (ambient strength, 0–9).
Both append to the schema, so old links keep working — same rule as `bg`.

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

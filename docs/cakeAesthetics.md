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

## What the pass actually found (19 Sept 2026, v0.28)

Rendered side by side against v0.27 across four palettes, the box and a cut cake:

- **A real shadow map is the lever**, not the environment. With one 1024 PCF-soft caster on the key
  light: candles shadow the frosting, each cap shadows the tier below, the box and the lifted wedge
  cast onto the floor. That is what "clay render" means and it grounds everything at once. **Shipped
  on by default in `look.js`.** The old contact disc stays at half strength underneath, reading as
  ambient occlusion beneath the cast shadow.
- **The environment map barely registers** on matte materials at roughness ~0.6 — it adds diffuse
  tint, not sheen — and **ACES desaturates the pastel palette** and greys the whites. Both are
  implemented and kept in `look.js` as options, **off by default**, for glossier skins later
  (ganache, glaze, satin ribbon), where they will earn their place. Tier A items 1 and 2 above are
  therefore demoted; item 3 promoted to first.
- **Penumbra matters more than the shadow itself (v0.29).** The first shadows read as cel-shaded: three.js's PCFSoft mode ignores its blur radius, so the edge was crisp like sunlight. Switched to **VSM** (variance shadow maps), which blurs the map itself and gives the wide, soft edge of a large light source. Paired with a **hemisphere light** in place of the flat ambient (cool sky above, warm bounce below), so the shadow side fills with colour rather than grey, and a warm-dark, lower-opacity floor shadow. That combination is the "diffuse but directional" look — like the contact disc, with a direction.
- **Rounded geometry (v0.30)** — `shapes.js`. Sponge and cap are lathe profiles: a rounded base, a
  1.8% bulge at mid-height, a small tuck under the cap, an overhanging cap with a rounded rim. The
  cap's underside lip meets the sponge's tuck, so the old torus "drip band" hiding the seam is gone.
  Wedges use the same profiles with a partial sweep; cut faces are the tier's actual outline rather
  than a rectangle. UV v on the sponge is rewritten as normalised height so the message band isn't
  stretched by the fillet points. Same triangle budget.
- **Two-layer flame (v0.31)** — `look.js` supplies a shared additive halo sprite (radial gradient,
  warm, `toneMapped: false`); `app.js` gives each flame one on the same pivot, scaled 3.4× and
  breathing with the flame's flicker, behind the core. Over 100 candles every other candle skips its
  halo so 100 candles is 150 sprites, not 200. This is the fake bloom, and it's what the
  candlelight-as-light-source idea (Tier B+) needs before it can be built.
- **Candlelight as the light source (v0.32)** — built as described in Tier B+, in `look.js`
  (`LOOK.night`). Darkness ramps from the backdrop's luminance (0 above 0.55, 1 below 0.16); the
  room lights lerp toward a dim, cooler night set; the candle point light is `base + perSqrt·√lit`,
  boosted 2.4× at full darkness and eased so each extinguished wave reads as a wave of dimming; cake
  materials get a faint emissive lift at night, the message band a little more. Lit → out → relit
  now visibly changes the room on Midnight/Ink/Dusk and does nothing on light backdrops. No gating
  needed: it follows the background the sender already chose.
- **Contact-hardening shadows (v0.35)** — `pcss.js`, a self-contained patch of three's shadow chunk.
  Crisp where the caster touches the receiver, wider the further the shadow falls: a blocker search,
  a penumbra estimate from blocker distance and light size (0.6 world units), then a per-pixel-rotated
  Poisson filter of that width. Default shadow type is now `PCSS`; VSM and PCFSoft remain as options,
  and a live switch recompiles every material via a global program-cache key. Costs ~39 texture taps
  per shadowed pixel; the dev overlay is the arbiter on old phones.
- **A lit floor (v0.37)** — `stage.js`. The backdrop used to be a CSS gradient behind a transparent
  canvas with the shadow as a tinted decal on an invisible plane; on a dark backdrop the "shadow"
  could be lighter than the floor, which light can't do. The background palette's two colours are
  now the SKY and the FLOOR PAINT: a real 400-unit plane lit by the same hemisphere and key as the
  cake, receiving the PCSS shadow as a genuine absence of direct light. Fog in the lit-floor colour
  dissolves the plane into the CSS sky before the horizon; both dim with the room. Lights retuned so
  paint × (ambient + direct) lands near the paint in daylight. The dev panel's ambient and key
  sliders are the whole rig: ambient scales everything, key sets shadow depth, light size sets
  softness.
- **Baked ambient occlusion (v0.41)** — `shapes.js` writes a darkness per vertex along the lathe
  profiles (the tier's foot, the tuck under the cap's overhang, the cap's underside lip, and a ring
  on a tier's top where the tier above sits), and the cake materials multiply by it via
  `vertexColors`. Analytic, noise-free, free at runtime. The bright streaks at every tier junction
  were the hemisphere's ground bounce lighting the new downward-facing fillets — light that can't
  physically reach a crease. The ground bounce was also turned down (#f0d6bd → #b8a48f).
- Order now: shadows (done) → rounded geometry (done) → flame halo (done) → candlelight (done) →
  contact-hardening (done) → lit floor (done) → baked AO (done) →
  environment/tone mapping only alongside a glossy skin. The Tier A/B+ list is complete except for
  cake-ness items (sprinkles, drips, rosettes), which belong to the builder's object library.
- Console: `cake.look.shadows = false; cake.relook()` to A/B on the phone; `cake.look.environment = true; cake.relook()` to see the env; `cake.look.toneMapping = 'ACESFilmic'`.

## What game engines have that we still don't (20 Sept 2026) — to return to

In the order they'd matter for a cake:

1. ~~Ambient occlusion~~ — baked, v0.41. Screen-space AO (three's SSAOPass) remains available as a
   dev-toggle experiment for the dynamic layer; not planned.
2. **Subsurface scattering.** Sponge and buttercream are translucent; without it they read as
   plaster. A cheap "wrap lighting" term — light bleeding slightly past the terminator into the
   shadow side with a warm tint — is most of the food-ness for almost nothing. The one that would
   make it look like cake.
3. **Colour bleeding / GI.** Pink frosting should tint the floor beside it and the tier below. Real
   GI is out of reach; a proxy is tinting the hemisphere's ground colour with the frosting colour.
4. **Environment reflections and tone mapping.** Built, switched off, waiting for glossy materials
   (glaze, satin ribbon, sugar work).
5. **Real bloom.** Faked with halo sprites; a true post-process bloom would also glow the message
   and the wax. Perf-dependent.
6. **Physically-correct light units.** One-line switch affecting the candle light's falloff; needs
   retuning.
7. **Depth of field** for the photo/video export only.

Point-light shadows from the candles and motion blur are on the engine list too; neither is worth
its cost here.

## Tier D — skip for now

Real bloom, SSAO, subsurface scattering, depth of field. All need post-processing passes (EffectComposer from the examples bundle) that hurt phones. The halo sprite gets ~80% of bloom for free.

## Performance budget (mobile, 60fps target)

- One shadow-casting light, 1024 map.
- Environment computed once; never per frame.
- Sprinkles / rosettes / drips all `InstancedMesh`.
- Flames: up to 200 sprites (100 core + 100 halo). If that stutters, halo only on every other candle over 60.
- No post-processing.
- `devicePixelRatio` is adaptive, up to 3 (v0.27).

## Later / occasion skins

- Christmas: white "royal icing" cap (rougher bump), holly cluster, snow sprinkle.
- Wedding: tiered white, satin ribbon (lower roughness), pearl sprinkles.
- Halloween: black frosting needs the environment to read at all; test early.
- Photo on frosting: canvas texture on the cap, needs storage (post-launch).

## Plan when we come back

Do Tier A, then sprinkles, rosettes, drips and the two-layer flame as one "v0.x look pass", render headless side by side with v0.2, then test on the phone for frame rate before keeping anything.

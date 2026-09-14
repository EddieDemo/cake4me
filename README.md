# Cake — v0.16.1

Same code as v0.16. The only change is docs: **candlelight as the real light source** is now its own
entry in the feature list (`docs/cake-build-plan.md`) with a full write-up in `docs/cakeAesthetics.md`
— progressive dimming as candles go out, near-darkness for the beat, brightening again on relight,
plus the two things that need care (non-linear intensity scaling, and keeping the side message from
vanishing into shadow).

---

# Cake — v0.16 (background colour)

## Background is now the sender's choice
You were right that deriving it from the frosting washes the cake out — everything matched, so
nothing stood out. There's a **Background** row in the builder with nine options:

`Match the cake` · Cream · Warm grey · Blush · Sky · Mint · **Dusk · Midnight · Ink**

The three dark ones are the interesting part: a pastel cake against Midnight pops in a way it
simply can't against a pastel backdrop, and they're the groundwork for the lighting feature below.

**Default for new cakes is Cream**, not "Match the cake".

### Backwards compatibility
`bg` is a **new field appended to the link schema**, so every link sent before today still decodes
— with `bg` missing, it falls to index 0, "Match the cake", which is exactly the behaviour those
cakes always had. Verified against a hand-built v0.15-format link. A typical link is now 99
characters including the `#`.

### Two knock-on adjustments
- **The shadow fades on dark backdrops.** A dark contact shadow on a dark floor is just a smudge,
  so its opacity now scales with the backdrop's luminance as well as the camera elevation.
- **The sheet stops assuming a light page** (`body.dark-bg`), so the controls stay readable.

### The "Match the cake" swatch previews itself
It shows the gradient it would actually produce, and updates when you change the frosting — with a
dashed inner ring so it reads as automatic rather than as a colour.

## Lighting feature: written up, not built
Added to `docs/cakeAesthetics.md` (new "Tier B+" section) and the build plan's post-launch list.

Ambient strength from daylight to near-dark, at which point the flames become the main light source
— `candleLight` already tracks the lit count, so in a dark scene **blowing the candles out visibly
darkens the cake**. That's free drama we currently discard by keeping the room bright.

Spotlight presets including the sweeping film-premiere searchlights. The note worth reading before
building it: **a `SpotLight` is invisible in air** — it lights surfaces but casts no visible shaft.
The beam needs its own additive, depth-write-off cone mesh parented to the light. That's the whole
trick, and it's why "just add a spotlight" doesn't produce the effect you're picturing.

Suggested schema fields when it's built: `li` (preset) and `ls` (strength), appended like `bg`.

## docs/
Business plan, build plan, feel spec, aesthetics notes, serverless mitigations.

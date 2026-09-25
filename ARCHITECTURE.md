# Cake4.me — architecture and the refactor plan (v1.05, 24 Sept 2026)

## Ground rules
- No build step, vanilla JS, GitHub Pages. Native ES modules (`<script type="module">`) give real
  file boundaries without tooling; Safari has supported them for years.
- **No new features until the refactor is done.** Every step ships as a version with the tag,
  passes `tools/compare.py` (~0% pixel change for structural moves) and `tools/golden_check.py`
  (every saved link decodes to the same cake).

## Where things are today (inventory)
| file | lines | holds |
|---|---|---|
| app.js | ~5,000 | schema · state · build · camera/spin · cut/slices · blow · candles/numbers/flames/sparklers/sprinkles · warm-up · generator · all UI wiring · render loop · AO |
| frosting.js | ~840 | textures (finishes, sponge, crumb), biplanar shader, wrap lighting, ribbon cloth + anisotropic sheen, seed |
| shapes.js | ~370 | lathe/shell/stack/ribbon geometry |
| look.js | ~500 | lighting looks, shadows, adopt(), night |
| stage.js / pcss.js / color.js / dev.js | small | backdrop · soft shadows · colour maths · dev HUD |
| index.html / style.css | 320 / 690 | every tray, all styles |

Pain points: module-level mutable state touched from everywhere; a 39-field positional link;
shaders as string arrays patched into three.js in five separate places; render-pass rules as
scattered flags (`layers`, `userData.noAO`, `noSprinkle`, `__shared`); warm-up by hand.

## Target layout
```
src/
  schema/      link.js (versioned, named fields + migrations) · normalize.js · palettes.js
  state/       store.js (one config, set(), subscribe()) · generator.js
  scene/       renderer.js · camera.js · lights.js (looks, presets) · stage.js · pipeline.js
               (declared passes: opaque → occlusion → emissive; objects register by tag)
  materials/   registry.js (every material type, warm-up derived from it) · cache.js (refcounted
               textures/geometry, replaces __shared) · shaders/*.glsl.js · patch.js (the one
               place three.js chunks are patched)
  cake/        tiers.js · finishes/ (one file per finish: side(), top(), params) · sponge.js ·
               ribbon.js · sprinkles.js · message.js
  decor/       candles.js · styles/ · numbers.js · holders.js · flames.js · sparklers.js
  interaction/ spin.js · cut.js · blow.js · spawn.js
  ui/          trays/*.js (bound to the store) · chips.js · builder.js
  app.js       composition root only
tools/         render.py · compare.py · golden_check.py · golden/
```
Definitions become data: finishes, candle styles, palettes, lighting presets, generator weights.

## Order of work
1. **Safety net + switches** — this version. `tools/`, golden links, `debug.js` (`?ao=0 ?flames=0
   ?halo=0 ?backdrop=0 ?shadows=0 ?sprinkles=0 ?sparklers=0 ?candles=0 ?cover= ?glow=`).
2. **Schema + state** — ✅ schema.js + palettes.js, named v2 links (v1.06). The store (UI binding) folds into step 7.
3. **Scene + pipeline** — ✅ scene.js + pipeline.js, frozen clock, deterministic harness (v1.07) — renderer/camera/lights/stage/post as modules; passes declared once.
4. **Materials** — ✅ registry (v1.08) · resources, shaders as files, patch helper (v1.09)
5. **Cake** — ✅ sprinkles, message (v1.10) · tiers, ribbon, sponge (v1.11) · body (v1.12). Finishes stay as frosting.js's table (already data + two functions each).
6. **Decor** — ✅ candles.js (parts, styles, hand, digits) · flames.js · sparklers.js (v1.13)
7. **Interaction, then UI** — ✅ light in the link (v1.14) · confetti (v1.15) · store (v1.16) · viewer state + cut (v1.17) · animate, smoke, mic (v1.18) · spin state, spin, blowout (v1.19) · placement + breath test (v1.20) · build() split into phases with buildTier(), 49 forwarding wrappers removed (v1.21).

## Where it ended up (v1.21)
app.js ~2,970 lines (from 5,000): the composition root — it creates the modules, wires their
dependencies, holds the few pieces of shared state (config via the store, V for the viewer, S for
the spin, blow, D for the decor), runs the frame, and owns the viewer's and builder's UI.
32 modules alongside it, each with a header saying what it does and what it needs.

What's deliberately left for later, not done:
- The trays' HTML-wiring (~1,000 lines of builder UI) is still in app.js. It now goes through the
  store, so it can be split per tray (ui/trays/*.js) whenever a tray is next touched.
- Native ES modules: every file is still a classic script exposing one `window.Cake*` object.
  Moving to `import`/`export` is mechanical now that each file has one clear export.
- Nine small wrappers remain because the function is passed as a value (`tween`, `wave`, …).
Each step: extract, run render+compare (expect ~0%), run golden_check, ship with the tag.

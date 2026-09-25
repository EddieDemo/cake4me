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
5. **Cake** (next) — tiers, finishes as data-driven modules, sponge, ribbon, sprinkles, message.
6. **Decor** — candles/styles/numbers/holders/flames/sparklers.
7. **Interaction, then UI** — trays as components on the store.
Each step: extract, run render+compare (expect ~0%), run golden_check, ship with the tag.

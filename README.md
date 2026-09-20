# Cake — v0.57

## 1. Sky and floor
Not acne after all — headless matched them exactly at default lighting. The mismatch appeared only
under settings the analytic estimate couldn't track (a low key, a hex-coloured key, the spot). So
the estimate is gone: **`stage.js` now measures.** On every relight it renders a 2×2 probe of the
far floor straight down, with the fog pushed out of the way, reads the pixel back and uses that
exact colour for the CSS backdrop and the fog. And the fog is much wider — it starts just behind the
cake and finishes 48 units out — so the floor fades into the sky rather than meeting it at a band.
Verified with a low warm hex-coloured key and the spot on: no line.

## 2. Filling thickness and spacing
Fillings are a constant **0.09 world units** whatever the layer count, sponge layers are all equal,
and the layout runs over the whole tier so the top sponge runs up into the cap. A naked tier's cap
is now thin (0.12) so no filling can hide inside it. Because the layout is in world units, textures
and materials are now **per tier** (`tierMaterials(cfg, tier)`), and the cut faces map the same
layout over the full tier height.

## 3. Layers as geometry
Each filling is an **inset groove** in the lathe profile (0.045 in, 0.025 chamfers), so a naked cake
reads as stacked discs with something squeezed between them, and the baked occlusion darkens the
groove. Wedges and cut faces follow the same profile. Filling types later change the profile as well
as the colour: jam inset and glossy, cream proud and matte.

## 4. Ribbons
A **Ribbon** toggle in the Candles tray, which is now the **Decorate** chip (candles and ribbon now;
sprinkles and toppers later). Off by default. One ribbon per tier round the base — a Classic gets one
too — taller (0.30) and a touch prouder (0.07) than the old band. Schema `rb` appended: 0 none,
1 every tier, 2 = legacy upper-tiers-only, which is what a missing field means so every existing
link looks exactly as it did. The builder never writes 2.

Verified: layer counts 2/3/4; the toggle round-trips; legacy decode; a recipient cutting a naked
four-layer grooved cake; 20 shader programs at load, 20 after the journey.

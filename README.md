# Cake — v0.75 (fondant finishes)

Flat fondant is retired. Fondant now always wears a **finish**, chosen in a new **Finish** row in
the Fondant tray (whole cake):

- **Grain** (default) — a faint sugar grain.
- **Swept** — long palette sweeps down the side, turntable spatula rings on top.
- **Rustic** — broad palette-knife strokes, plus a hand-worked rim (the top edge's vertices move
  a little).
- **Low sun** — the rustic finish under a raking key light (14°). Choosing it lowers the key light;
  choosing another finish restores the elevation you had. The light travels in the link as usual.

Old links with fondant decode as Grain. Schema: `ff` appended (0 grain · 1 swept · 2 rustic ·
3 low sun). The random generator picks a finish too (weighted towards Grain and Swept).

## How it's done — `frosting.js`
All procedural, no image files: height fields from seamless noise (and knife strokes stamped into
a canvas, blurred by hand because canvas `filter` isn't reliable on iOS Safari), turned into
**normal maps** (relief the light catches) and **roughness maps** (ridges a little shinier). They
describe shape only, so one set serves every tier and colour; maps are built once per finish and
cached; they stay **linear** (data, not colour).

Mapping: side textures span the whole circumference once, with `u` set from the true angle
(`angleUV`) — so a wedge's texture lines up exactly with the whole cake — and need no repeat
(r128 shares one UV transform across a material's maps, so the message band's would otherwise
win). Tops are **projected straight down** (`capUV`), so nothing pinches at the centre. The
message band sits on the finished fondant, with the same normal map.

## Cost
All four finishes share one shader variant (normal + roughness maps), so switching finish swaps
textures without a recompile. The warm-up includes it: a fresh recipient of a finished, ribboned
two-tier cake goes **18 programs at load → 18 opened → 18 cut**.

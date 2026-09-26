# Cake — v1.38 (metal toppers that read as metal, not glossy plastic)

The tag reads **v1.38**.

Metal has almost no colour of its own: it shows its surroundings, tinted. In v1.37 the metal toppers
reflected the candles' soft beige studio — no darks, no hard edges — so they looked evenly coloured
and softly shaded, which is what glossy plastic looks like. Now:

1. **A jeweller's-studio reflection world, just for metal**, drawn in code (nothing to download): a
   room with tall, hard-edged, very bright light panels round it, a window band, a ceiling light, a
   thin bright horizon line, and a broad soft reflector card where the numbers' faces look at first
   (so gold glows rather than going antique). The panels sit at different angles, so bright and dark
   bands slide across the numbers as the cake turns.
2. **Purer, sharper metal**: metalness 1 (no plastic-like base shading), roughness 0.14 (was 0.27).
3. **It reflects the scene it's in**: below the horizon, the room takes the backdrop's colour — worked
   out from the cake's settings, so it's right on the first build — and it's rebuilt when the
   backdrop changes.

The gold and silver candles keep their own look.

Checked in the harness: rose gold on a dark backdrop, rich gold on blush and silver on sky, v1.37
against v1.38, front and turned (see the comparison sheet, which also shows a first attempt that
was too dark); no errors; the six saved links decode unchanged.

Changed files: `candles.js`, `placement.js`, `app.js`, `index.html`, `README.md`.

# Cake — v1.52 (emoji toppers share one texture — a fix for blank white emojis on iPhone)

The tag reads **v1.52**.

**The bug:** on iPhone, emoji toppers rendered as blank white silhouettes. It couldn't be reproduced in
the desktop test browser (the emojis render correctly there), so this fixes the likeliest cause.

**The likely cause:** each emoji topper made its own copy of the whole emoji sheet on the GPU — a
2688-pixel image, about 29 MB uncompressed — so three emojis meant ~90 MB for one picture. Recent
versions added GPU memory on every page (the lighting rig's room pictures, metal's reflections, the
always-present Studio lamp's shadow), and iPhone Safari's GPU memory budget is far tighter than a
desktop's: an upload that doesn't fit can come out blank.

**The fix:** each emoji's cell on the sheet is now baked into its own shape, so every emoji shares
ONE copy of the sheet — 29 MB however many emojis. (In the harness: 3 copies → 1 for three emojis.)

Checked in the harness: three emojis render correctly from the shared sheet; no errors; the six saved
links decode unchanged. Please check on the iPhone — if they're still white, the next step is an
on-screen diagnostic (the GPU's limits and any shader errors) to screenshot.

Changed files: `toppers.js`, `index.html`, `README.md`.

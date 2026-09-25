# Cake — v1.25 (one sprite sheet instead of 187 files)

The tag reads **v1.25**. No visual changes.

**The emoji folder is now four files** (was 190): `sheet.jpg` (every emoji's face, 14×14 cells of
192px, ~1MB), `outlines.js` (the outlines and each emoji's cell), `index.js` (the list of keys)
and `NOTICE.txt`. One drag to upload, whatever the set grows to.

It's also better for the app: one image for the whole set instead of one request per emoji, so a
cake with three emoji toppers downloads one file. Each topper uses its own cell by offsetting the
shared texture. Two details that matter: mipmaps are off and the cells are sampled half a pixel
in, so no neighbouring emoji can bleed into another's edge; and toppers created while the sheet is
still loading are updated when it arrives.

Checks: typed combinations (🐐👍🏽🎂, 🥳🫶🍆, 💀😂🤡), a rendered 🐐👑🎂 (each cell on the right
topper), a recipient link, six golden links: clean.

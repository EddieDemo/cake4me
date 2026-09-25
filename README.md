# Cake — v1.30 (smooth emoji toppers, printed right round; Shuffle faces you)

The tag reads **v1.30**.

**Smooth emoji edges.** Each emoji's traced outline (about 55 points, joined by straight lines —
the flat "cuts" round the edge) is now a smooth curve through the same points, about 300 points
round, with genuine corners kept sharp. Where two parts of an outline come very close (💃), the
curve stays straight at just those points so it can't cross itself.

**Smooth shading.** The walls and rounded edges were shaded panel by panel, hence the banding. Now
they shade as one smooth surface, with real corners kept crisp. The numbers get the same
treatment, so the emoji edges now round off exactly like the numbers'.

**The back is a true mirror image.** The back used to be flipped to read the right way round, which
stopped it lining up with the shape seen from behind: on an asymmetric emoji the picture fell off
the edge. Now front and back use one mapping, so the back lines up exactly, like a real two-sided
topper. Lettering (💯) reads backwards from behind, as the numbers do.

**The emoji's own colour on the rim.** The rim and rounded edges used to be cream. The sprite sheet
now carries each emoji's edge colour outward past its outline, so the rim picks up the colour at
that point of the emoji. The one cream line at the very edge of the face is gone too.

**Shuffle faces you.** The new cake arrives facing the front — toppers and writing to you — with
your tilt, zoom and any spin kept.

Checked in the harness: all 187 emojis build with sound shapes (no crossings, no broken normals);
close-ups front and back as described; Shuffle from turned-away (2.6) arrives at the front (0.2)
with the tilt kept; the six saved links decode unchanged.

Changed files: `toppers.js`, `shapes.js`, `candles.js`, `app.js`, `index.html`, `emoji/sheet.jpg`,
`emoji/NOTICE.txt`, `README.md`.

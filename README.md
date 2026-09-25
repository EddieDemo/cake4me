# Cake — v1.29 (toppers sized to the cake, with a Size slider)

The tag reads **v1.29**.

**Toppers are sized to the top tier.** A topper's height is now a set share of the top tier's
width (about 27%), at every width, so widening the cake always grows them and narrowing always
shrinks them. On the Classic shape with fondant they're exactly the size they were before. Until
now they only responded across a narrow band of widths: full size at notch 7 and wider (never
bigger), 70% at notch 4 and narrower.

**A Size slider** in the Toppers tray scales the whole row from 60% to 140% (100% to start). It
travels in the link (a new field, `tz`; a cake without it gets 100%), and Shuffle always uses 100%.
It's dimmed until there's a topper to size.

**Two limits.** The row must still fit across the top: if the chosen size would overhang, it stops
at the largest size that fits and the tray says "As big as fits on this top tier" — the slider keeps
your choice, so widening the cake afterwards lets the toppers grow into it. And toppers aren't made
shorter than about a candle (0.75), unless that's the only way they fit. Bigger toppers leave less
room for candles; v1.28's layout moves candles to the next free spots.

Checked in the harness: Classic with fondant 1.30 (unchanged), Classic naked 1.24, notch 5 0.98,
notch 10 1.52; 60% 0.78; "30❤" at 140% on Classic fits at 1.60 (about 123%) with the note showing;
the note clears when the toppers are removed; the size survives a link round-trip, and a link
without it reads 100%; the six saved links decode unchanged.

Changed files: `placement.js`, `app.js`, `schema.js`, `index.html`, `style.css`, `README.md`.

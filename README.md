# Cake — v1.34 (colour, stage 4: themes — Shuffle and "Theme the cake from this colour")

The tag reads **v1.34**.

**Shuffle makes a colour THEME** (`theme.js`, in OKLCH). It starts from one base colour — one of
an emoji topper's own colours when the cake has one, otherwise a random colour — and one of six
strategies for the rest:

- **mono**: one hue family — the tiers an ombré, the ribbon a deep shade of the same
- **analogous**: neighbouring hues (~30° either side) for the accents
- **complement**: the opposite hue as the accent
- **triad**: three hues, 120° apart
- **neutral**: a quiet, near-white icing with one vivid accent
- **emoji**: the emoji's own other colours as the accents (🤮: vomit-green candles on yellow icing)

Shades follow **Eddie's pixel-art ramp**: as a colour darkens its chroma rises and its hue bends
towards violet; as it lightens, towards yellow. Rules every theme keeps: the backdrop stays quiet
and always stands clear of the cake (about one in six are dark); candles and number toppers always
stand apart from the icing they're on; the ribbon never disappears into its icing; no muddy icing;
sponge and filling stay food-real mostly (now and then theme-tinted); the writing picks dark or
light itself, so it's always legible. The curated presets stay for choosing by hand.

**Emoji colours.** Every emoji's 2–4 main colours, extracted offline from the artwork (k-means in
OKLab, inside its outline, the cream wax left out), live in `emoji/index.js` — about 5 KB.

**"✨ Theme the cake from this colour"**, in the picker under the hue strip: the whole cake themed
round the colour you've picked (or dropped), which stays exactly itself on the part you're editing.
Each tap tries another theme; Done keeps it; Cancel puts back every part as it was. When the colour
is for the backdrop, the icing is chosen to stand out against it; for the ribbon, candles or
toppers, the icing is found to go with it.

Checked: 5,000 generated themes (half from emojis, one to three tiers) are all valid, with no
backdrop too close to the cake, no candles or toppers lost on their icing, no ribbon lost, no muddy
icing, and all six strategies used. In the harness: six Shuffles by eye; the picker's Theme on
#7DBD3C gives a different theme each tap, Done keeps #7DBD3C exactly on both tiers, Cancel restores
everything; no errors; the six saved links decode unchanged.

Also: the picker's hex box keeps its width now the dropper sits beside it, and a late "change" from
the hex box as the sheet closes no longer throws an error.

Changed files: `theme.js` (new), `emoji/index.js`, `picker.js`, `app.js`, `index.html`, `style.css`,
`README.md`.

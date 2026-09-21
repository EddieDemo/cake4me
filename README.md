# Cake — v0.67 (frosting and fondant)

The smooth shell was fondant all along — a rolled, sharp-edged, uniform sheet — so it's called that
now, and buttercream is its own layer. The model, outermost last:

    Sponge  →  Frosting (buttercream, spread on)  →  Fondant (a sheet draped over)

- **Frosting** chip: All/tier pills, a **style** row — **None · Semi-naked** (Smooth and Rustic
  reserved) — and a colour row. None is a style, so there's no toggle. Colour per tier (`frt`).
- **Fondant** chip: All/tier pills, the toggle at the head of its colour row. Colour per tier
  (`fct`, the field that used to hold the shell's colour). Fondant has real thickness (0.08 sides,
  0.10 top) and **meets the base with half the top rim's roundness** — trimmed at the board, as
  rolled icing is — via a `baseFillet` option on the body profile that the ribbon band and cut
  face share.
- Fondant over a semi-naked scrape hides the scrape: that's the crumb coat, and it's right.
- The writing sits on the outermost layer; the auto ink and the contrast note follow it.
- Shape, Frosting, Fondant and Ribbon share the one current tier; Frosting and Fondant each have
  their own "All".

## Links
`fd` (fondant on/off) and `frt` (buttercream colours) appended. **Every existing link with
`fr` = 1 decodes as fondant on, frosting none** — the field changes meaning, the picture doesn't
(verified for 13-field and 17-field legacy links, and for a v0.65 semi-naked link). `fc` is now
the outermost layer's bottom-tier colour for the bow, the bleed and older readers. A fresh cake
starts naked: no buttercream, no fondant, no ribbons.

Verified: the style row, per-tier buttercream colour, fondant on/off and colour, base fillet 0.05
vs the sponge's 0.10, link round trip; no errors.

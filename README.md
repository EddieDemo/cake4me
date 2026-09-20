# Cake — v0.61 (the flattened builder)

The recommended option, implemented. **One chip row of nine decisions in four labelled groups**,
left to right in the order a cake is made:

    gift: Occasion · Message | cake: Tiers · Shape · Sponge · Frosting | decorate: Candles · Ribbon | scene: Backdrop

Small group labels and hairlines keep nine chips reading as sections rather than a list. "Cake" and
"Decorate" were never decisions, only folders that existed because the row was short; they're gone,
and with them the second level of navigation.

## Every tray is one decision, at most three rows
- **Message:** names side by side, the text, a writing-colour row (plus the contrast note).
- **Tiers:** the three cards.
- **Shape:** tier pills with Reset, Width, Height.
- **Sponge:** filling row, layers.
- **Frosting:** the toggle at the head of the colour row, then the style row.
- **Candles:** count slider, colour row.
- **Ribbon:** tier pills, the toggle at the head of the colour row, width.
- **Backdrop:** one row.

Two refinements from the "everything as scrollers" option: **swatch rows always scroll on one line**
and never wrap, and **a toggle lives at the head of the row it controls** rather than on its own
line. `.rowline` is the one layout primitive: a label, a control, an optional readout.

## Result
Free space above the chip row on a 390×844 phone: **~440–660px in every tray**, up from ~300 on
the old Cake › Tiers tab.

All control ids are unchanged, so the JS behind them is untouched apart from the tray list and the
removal of the Cake sub-tab machinery. Verified: every tray opens and its controls work (frosting
toggle, ribbon per tier, shape sliders, layers); no errors.

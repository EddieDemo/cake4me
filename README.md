# Cake — v0.94 (number candles)

**Number candles.** In the Candles tray, a switch: **Candles | Numbers**. Numbers swaps the count
slider for an **Age** field (the phone's number keyboard); type 60 and a 6 and a 0 appear, in the
order typed; 7 gives a single 7. Each side keeps its own settings when you switch.
- Each digit is **Fredoka's** own outline (digits only, `digits.js`, ~10KB; SIL Open Font
  License), extruded ~1.2cm with a soft rounded bevel, in the same **wax** as the candles, with a
  gentler glow (thick wax). Wick at the digit's highest point; **one spike** under the middle of
  its foot, a few millimetres of it showing. Placed by hand from the seed: a slight lean and turn.
- One flame per digit; blowing out works exactly as before, and each digit's glow goes out with it.
- Smaller on a smaller top tier. Built once per digit and cached.
- Schema `cm` (0 candles · 1 numbers) and `age` (1–99) appended.

**Normal candles now max out at 6** in the builder (links still carry up to 100). At the cap, a
hint: "Bigger birthday? Try number candles."

**Message nudge.** With numbers set, the message box's placeholder suggests "Happy 60th!" — a
suggestion only, never its text.

**Generator.** 30% of random cakes get number candles, with a random age (a third children's,
the rest 13–90).

Verified: numbers 60 and 7 render; shader count unchanged when switching to numbers (both new
variants are compiled up front); link round trip; count capped at 6. No errors.

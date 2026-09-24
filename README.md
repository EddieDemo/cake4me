# Cake — v1.00 (hundreds and thousands)

A **Sprinkles** chip (in the cake group, after Icing): **Amount** (none → fully covered),
**Colours** (Rainbow · Pastel · Gold) and **🎲 Roll** for a new arrangement with the same settings.
It's a topping, not an icing: it goes over whatever finish each tier has.

- **On the real surface.** Balls are placed on random triangles of each tier's actual meshes, by
  area, so the top, the rounded edge and the sides are covered evenly — no bare band at the
  shoulder. Never on ribbons, never on the part of a lower tier hidden under the tier above,
  never inside the cake (no internal layers).
- **Part of the icing.** Each ball is pushed in by its own amount (half buried … barely touching),
  is its own size, and its own shade of its colour.
- **Sphere impostors.** One point per ball, painted by the shader as a lit sphere with the depth a
  real ball would have — so sunk balls look sunk. Fully covered is ~90,000 balls: as geometry that
  would be millions of triangles; as points it's cheap. The balls take the scene's key, fill,
  ambient, candle and sparkler light.
- **The writing stays clear.** With a message, the balls leave the area of the writing bare.
- **Slices keep theirs.** Every ball belongs to one tier and one angle; a cut slice carries exactly
  the ones that were on it.
- **Amount** is exponential (700 → 90,000 per standard tier area), so the low end is a light
  scatter and the top end hides the icing entirely.

Schema `sa` (0–10), `spal` (0–2), `sr` (roll). Generator: a quarter of random cakes, amount 3–10,
Rainbow most often. The sprinkle shader is compiled at load. Files load with `?v=1.00`.

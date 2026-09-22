# Cake — v0.81 (finishes, properly scaled)

## Two new finishes
- **Combed** — fine vertical grooves pulled with a comb: a hollow the full width of each band
  meeting its neighbour at a cusp (broad floor, peak almost to a point), spacing that wanders,
  each groove its own depth, and each line drifting sideways on its own as it rises.
- **Ridged** — a spatula held to the turning cake: bands of uneven height, each rising and falling
  a little of its own accord as it goes round.
The tile row is now **Grain · Swept · Spiral · Combed · Ridged · Rustic · Deep rustic**. Coarse is
gone (its slot, `ff` 4, is Combed; the few links carrying it show Combed).

## Everything in centimetres
Patterns are written in world units rather than texture cycles, so the **side and the top match**:
grooves 3cm apart on both, the same depth, the same smoothness. Each map's normal strength is
scaled by its pixels-per-unit, so their relief matches too. The fondant wall is straight — the old
slight bulge left a crease at the shoulder that read as a separate lid.

## Two bugs fixed
- **Upside-down textures.** A canvas texture is flipped when it's uploaded, so every pattern was
  read upside down — and because the normals are derived in canvas order, **dips rendered as
  ridges**. Fixed in one place (`field`), which corrects every finish and the sponge: Rustic's
  knife lips and the sponge's pores were subtly inside-out.
- **The pattern stopped at the shoulder.** The side/top blend now holds the side pattern until the
  surface is nearly flat, so combing and ridges run right up to the top edge.

Verified in the app: Combed, Ridged, Swept and Spiral all render, the tiles show their real grain,
17 shader programs throughout, no errors.

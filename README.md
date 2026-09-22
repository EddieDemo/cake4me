# Cake — v0.83 (seeded textures)

Every cake now has its own **texture seed** — one number, `sd` (0–999) — that arranges every
pattern on it: which grooves the comb left and how deep, where the knife strokes fell, how the
rings wander, the crust's pores, the crumb's cells, the rack marks, even the baked wobble in the
sponge's walls. The recipes don't change — spacing, depth, profile, wander are fixed — so a Rings
is still clearly a Rings; only the arrangement differs.

Every pattern in `frosting.js` is built from one hash, so the seed is injected there once
(`setSeed`, called at the top of every build from `cfg.sd`) and reaches all of them.

- **In the link**, so the recipient's cake, their slices and the sender's all match. Older links
  carry no seed and decode as 0, which is the look they were made with.
- **The generator rolls one** per cake, and **Shuffle rerolls it**.
- **Caching**: two cakes no longer share one set of textures, so each cache keeps the last few sets
  and disposes the rest — the fondant maps keep 3 (about 4 MB each); the sponge and crumb keep the
  current seed's only.

Cost, measured in the test renderer: a new seed regenerates a finish in ~2.4s there, which is
dominated by that renderer's shader work; the texture generation itself is ~0.3s and unchanged.
Worth timing a Shuffle on the phone.

Verified: three seeds of Rings and two of Rustic all differ and stay in character; the sponge's
crust and crumb change with the seed too; link round trip; legacy links decode as seed 0;
17 shader programs, no errors.

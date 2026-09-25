# Cake — v1.09 (refactor step 4 complete: resources, shaders, patches)

No visual changes. The tag reads **v1.09**.

- **resources.js** — who owns what on the GPU. `keep(x)` for things every cake shares (made
  once, never disposed), `own(x)` for the opposite, `release(group)` disposes a cake's own things
  when it's rebuilt. The `__shared` flag was set in 49 places across four files and checked in
  one; all 49 now go through `keep`/`keepAll`, and the disposal policy lives in one function.
- **shaders.js** — the cake's own GLSL (flame, sparks, sprinkle impostors) as plain strings in one
  file, readable on their own instead of inside the functions that use them.
- **patch.js** — the one way three.js's built-in shaders are extended: `declare`, `after`,
  `before`, `replace` on a named chunk, each checking the chunk exists (and warning once if a
  three.js update has moved it). The icing (biplanar), the wax glow, the crumb's wrap lighting
  and the ribbon's sheen all go through it now.
- Also confirmed: the "+1 program on a two-tier fondant cake with a message" seen in v1.08 was a
  transient during a combined change, not a missing material — step by step, no program compiles.

Checks: load, feature switching (35 programs throughout), blow-out: no errors; six golden links ok.
Step 4 is done: registry (v1.08) + resources + shaders + patches (v1.09).

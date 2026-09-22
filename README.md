# Cake — v0.78 (black fondant tops on iPhone)

The v0.77 finish shader works out each point's angle round the cake with `atan(x, z)`. At the
exact centre of the top that's `atan(0, 0)`, which is undefined: the headless renderer returns 0,
but iPhone GPUs return NaN. Every triangle of the flat top shares the vertex on the axis, so that
one NaN spread across the whole top and rendered it black. And because a blend of NaN with anything
is still NaN, the top-down projection couldn't rescue it.

Fixed in three places in `frosting.js`: the vertex shader guards `atan` on the axis; the fragment
shader does the same; and the side/top blend uses the pure projection outright when it's fully one
or the other, so a bad sample from the unused projection can never reach the pixel.

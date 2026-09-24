# Cake — v1.02

No visual changes from v1.01. The top-left tag reads **v1.02**.

- `cake.elev = 24` (console) now really tilts the camera, via the same tilt the drag sets, so the
  angle in a screenshot can be reproduced exactly when testing.
- A change to the flame shader was tried for the reported "cut" and **reverted**: checked with the
  app's real blending, it made the flame worse from above, not better.

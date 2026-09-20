# Cake — v0.43

The vertical seam down the front of each tier is gone. It was the join where the lathe sweep
starts and ends: three's `LatheGeometry` averages the normals across its duplicated first and last
columns so the join is seamless, and my `computeVertexNormals()` call afterwards undid that, giving
each seam column a one-sided normal — a tiny fold that soft lighting on a matte surface shows as a
band. The call is removed; the lathe's own normals are correct.

Measured: the two seam columns' normals were (0.031, 0.933) vs (−0.032, 0.966) — a visible kink —
and are now identical at (−0.001, 0.951).

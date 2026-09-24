# Cake — v0.97 (flames no longer fade at some angles)

The flames were being darkened by the ambient occlusion. Occlusion is multiplied onto the finished
frame, and a flame's pixels sit in front of whatever is behind it — at some angles that's the
candle's own top and wick, which are occluded, so the flame was multiplied down almost to nothing.

Now the flames live on their own render layer and are drawn **after** the occlusion, into the same
depth buffer: the cake still hides them where it should (behind the cake, the far side of the
top), but nothing is multiplied onto them. They also no longer take part in the occlusion pass
at all. No new shaders; files load with `?v=0.97`.

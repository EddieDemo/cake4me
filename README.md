# Cake — v0.40 (no compiles mid-gesture; an honest disc)

## The freeze on cutting a slice
Reproduced: no error, but the frame after tapping a wedge took **8.6 seconds** in the software
renderer. Not a hang — a **shader compile**. Two causes compounded:

1. Three compiles a material's shader on its first draw, and the PCSS variant is heavy. The lifted
   wedge's plate was a brand-new material, so it compiled on the tap.
2. The look pass added shadow flags to new meshes a fraction of a second after creation. Shadow
   flags are part of a shader's signature, so **every new mesh compiled twice** — the second time
   with the full shadow code, right when the user was interacting.

### The fix, in two parts
- **`CakeLook.adopt(mesh)` at creation.** Wedges, plates, the built cake and the confetti get their
  shadow flags before their first draw. The interval tick remains only as a safety net.
- **A permanent shader warm-up.** One tiny mesh per shader variant the app ever uses — standard,
  with map, with map + emissive map, double-sided, transparent, basic with and without map,
  instanced with and without per-instance colour — lives under the floor, inside the shadow frustum
  and hidden by the floor. Every program, including the shadow-depth variants, compiles on the first
  frame. Texture *encoding* is part of the signature too, which caught my first attempt: the app's
  canvas textures are sRGB, so the warm-up's must be.

Verified: `cake.renderer.info.programs.length` is **15 at load and 15 after the whole journey** —
gate, open, blow-out, confetti, cut, lift, send, slice page. Nothing compiles after the first frame.

## The halo with every light off
The contact disc was painted in a warm brown, which is lighter than a dark floor. It's now painted
**transparent black**: compositing black at alpha *a* is a multiply by (1 − *a*), so the disc can
only darken what's under it, keeps its fade control, and is invisible on a black floor.

## Console
`cake.renderer` is exposed so the program count can be checked on the phone.

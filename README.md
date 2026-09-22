# Cake — v0.79 (a real baked sponge)

The sponge of a naked cake — and inside any cake once it's cut — is now built the way the mocks
were, all procedural so it reacts to the light:

- **Crust** (outside): sandy and porous, browned, with a slight sheen. Mapped with the same
  seamless biplanar shader as fondant (wrap on the walls, straight down on the top), now with an
  optional colour map, so there's no seam and no stretching over the shoulder.
- **Crumb** (cut faces): **C · open chiffon** — foam with air cells of mixed sizes, stretched
  upward. Holes darker, walls warm and pale, with **wrap lighting** so the shaded side stays soft
  and warm, as translucent sponge does. Cut-face UVs are in world units so the crumb runs on across
  the layers.
- **A baked shape**: the walls lean and bulge a little and have soft lumps; the top layer's shoulder
  is crumbly. Applied to every part of the stack by position, so wedges match the whole cake and the
  fillings keep their inset. Ribbons follow the wobble while still bridging the fillings.

## New: the Bake chip (cake group)
- **Bake:** Golden (default) · Honey · Butter — crumb and crust as a pair. Other sponge flavours take
  the same browning (their colour scaled by the bake's ratio to the vanilla base), so chocolate
  gets a dark crust and a lighter crumb.
- **Top:** Plain · Rack wires · Rack bars — cooling-rack marks, sunken and paler where the wires
  pressed.
Schema `bk`, `rk` appended; older links decode as Golden, plain. The generator picks both (Golden
most often; plain or wires most often, bars now and then).

## Cost
- Texture generation is ~1.5s of work in total. The crust is needed on load; the **crumb is only
  seen once cut, so it's generated in the background ~1s after load** (the slice page generates it
  at once). Worth timing on the phone.
- Shaders: the crust shares the fondant's biplanar program; the crumb adds one (wrap lighting),
  covered by the warm-up. Verified: 17 programs in the builder across bakes; a recipient cutting a
  naked cake: 17 → 17; no errors.

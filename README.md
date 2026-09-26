# Cake — v1.41 (the lighting rig, step 3: a Studio preset)

The tag reads **v1.41**.

**Studio**, a sixth preset under the Light chip — a product-photography rig lighting the whole cake:

- **The key is a real local lamp, a big softbox** (the spot light): it pools on the cake and falls
  off, so the room round it goes dim — the backdrop really darkens, because the lamp doesn't reach it.
  It casts its own soft shadows.
- **The room light drops to a faint glow**, and **the fill moves behind the cake as a cool rim**.
- **The studio's other lights**: a big panel by the camera and strip lights left, right and behind.
  They live in the rig's room picture, so they light everything softly through it (no shadows of
  their own), and wherever a shiny face turns there's a light to catch, with dark between. In the
  picture the lamp is a big bright rectangle and the rim a tall strip, so what metal reflects is the
  very lights lighting the cake.

Gold under Studio glows brighter than in Daylight, with crisp darker edges, and dims and brightens
as the cake turns. The icing gets the product-shot mood: a pool of light, the room falling away.
The link keeps it (`lp` 5), and Shuffle gives metal numbers the Studio now and then.

A face mirrors the camera's angle to the other side, so the camera panel is centred on the front —
off-centre, the faces reflected just past its edge (found and fixed in the harness).

Switching to or from Studio updates every material's shader once (the lamp's shadow turns on or
off), as the spot light always has: a brief pause on a phone.

Checked in the harness: pastel and gold cakes in Daylight and Studio, gold turning and from behind
(see the comparison sheet); the Light chip shows Studio and the link keeps it; no errors; the six
saved links decode unchanged.

**Next:** step 4, tuning across all six presets.

Changed files: `app.js`, `rig.js`, `schema.js`, `index.html`, `README.md`.

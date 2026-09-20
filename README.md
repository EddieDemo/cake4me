# Cake — v0.49 (the lighting travels with the cake)

The room the sender lit the cake in is now part of the gift. Whatever the dev panel was set to
when "Get my link" was pressed — ambient, key strength, elevation, azimuth, warmth, light size,
and the spot's on/off, strength, position, distance, cone, softness, warmth and light size — is
serialised into the link and applied on the recipient's side before the cake is built.

## Schema
A new field `lt`, appended after `o` as always. Fifteen numbers in a fixed order, `~`-separated,
ranges clamped on decode; a malformed field is ignored, never fatal. **Empty when everything is at
its default**, so an ordinary sender's link doesn't grow at all — only a cake someone has actually
lit gets the extra ~50 characters (184 total in the test). Older links have no field and behave
exactly as before. `look.js` owns the serialisation (`serializeLighting / applyLighting /
resetLighting`); `app.js` only carries the string.

## Order of operations matters
On any route — viewer, slice, or a pre-filled `#edit=` builder — the lighting is reset, the link's
values applied, the look rebuilt, and *then* the cake is built and the shader warm-up runs. The two
light sizes are baked into the shadow shader and a spot that casts changes every material's
signature, so applying them first means the warm-up covers them and **nothing compiles later**:
14 programs at load, 14 after cutting, for a spot-lit cake in a fresh context.

Pre-filled links (reminders, "send one back") carry the lighting too, so last year's cake reopens
in the builder lit the way it was sent.

## Two honest notes
- **A spot-lit cake compiles more at load.** Every program is bigger (two shadow lookups) and all
  of them compile up front. On a phone that's a second or two extra before the first frame; in the
  software renderer it ran to minutes, which is why the headless verification used a reduced
  filter. Worth timing on your phone with a spot-lit link.
- **This is the presets arriving early.** A future "mood" in the product is just a named set of
  these fifteen numbers, so the schema doesn't change again when they come, and the dev panel is
  now the tool for authoring them.

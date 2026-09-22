# Cake — v0.76 (Low sun, done properly)

In v0.75 "Low sun" only lowered the key light, so it looked almost the same as Rustic: the light
kept whatever direction it had (often from roughly behind the camera, which lights the face evenly),
and the app's room light — ambient stronger than key, the soft balance we tuned — drowned out
what relief there was.

Choosing **Low sun** now turns the light into a low sun, **fixed to the room** like a low window:
- elevation **14°**, azimuth **−80°** — almost exactly from the side, which rakes across the
  visible face both from the recipient's opening view (front) and from the builder's writing view
  (back). As the cake spins, the lit side turns past and the shadow sweeps round.
- key **×1.6**, room ambient **×0.7** — relief is carried by the key.
- a little more relief in the maps (normal strength 1.3 vs Rustic's 1.0, same textures).
Choosing another finish restores the key's elevation, direction and strength and the ambient
exactly as they were. The random generator applies the same preset when it rolls Low sun (and
resets ambient first, so repeated shuffles can't compound the dimming).

The whole scene reads a little dusky under a low sun — the backdrop is measured from the lit floor,
so it follows. That's the mood; tune `RAKING` in `app.js` if it's too much.

No new shaders: 18 programs throughout.

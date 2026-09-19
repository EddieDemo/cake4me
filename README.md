# Cake — v0.34 (dev overlay: measure before sacrificing)

## `dev.js`, only with `?dev=1`
Add `?dev=1` to the URL (works alongside a `#c=` link too). Without it nothing changes and nothing
is shown — recipients never see this, and `app.js` only carries two small hooks.

**Top left:** the current frame rate (over the last ~10 frames, updated a few times a second so it's
readable), the **lowest** frame rate in the last second, and a count of dropped frames since load.
The low number is the one to watch: an average hides a stutter, the worst frame *is* the stutter.
A tier switch or a cut will show a dip for a second, then clear — that's a rebuild, not a stutter.

**Top right:** a 30 / 45 / 60 toggle. It does two things at once: **caps the render loop** to that
rate, and **defines what counts as a dropped frame** (slower than 1.5× the target's slot). Choice
persists in `localStorage`.

**While the overlay is on, all limits are off.** Full device pixel ratio (not even the 3 cap), the
quality ladder never runs, shadows at 1024 with the soft VSM blur, halo on every candle. Worst
case, on purpose.

## The thing to look at first
Your phone is 120Hz. Until now the app rendered on every animation frame, so it was *attempting*
120fps with an 8ms budget — half the headroom of 60 — for nothing anyone asked for. With the toggle
at 60, rendering lands at 60 and the budget doubles. If the low number holds at 60 through a spin,
the open ceremony and a confetti burst, the phone can do the full look and the ladder's whole
premise was wrong. If it sags, the number tells you by how much, and 45 is one tap away to feel
whether that's smooth enough.

Verified headlessly: no overlay without the flag; overlay and toggle with it; ratio at the device's
full value; the ladder inert for 10s under the slow software renderer.

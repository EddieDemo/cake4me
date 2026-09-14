# Cake — v0.18 (chip-bar builder)

The builder now matches the viewer: **no solid panel anywhere**. The cake is full-bleed and the
controls are a row of frosted chips with one tray open at a time.

## How it works
- Four chips: **Message · 🕯 30 · Cake · Colours**. The candle chip shows the current count.
- Tapping a chip opens its tray; **tapping the same chip again closes it**, so you can clear the
  screen completely and just handle the cake.
- The message tray opens automatically on arrival, so it's obvious there's something to fill in.
- **Colours** is one tray with sub-tabs (Frosting · Filling · Candles · Ribbon · Background) and a
  single horizontally-scrolling swatch row, so five palettes cost one tray's height rather than five.
  The tab carries its own note where one helps: "Hidden until they cut the cake" on Filling,
  "Used on the cake and the gift box" on Ribbon.
- The CTA shows the price and **tracks the tier**: `Get my link · £4.49` → `· £24.99`.
- The scrim is `pointer-events: none`, so the cake stays draggable in the gaps between controls.
- The link panel floats now too, instead of being a half-screen sheet.
- Dark backdrops get a dark scrim and more opaque chips, same as the viewer.

## Two bugs this flushed out

**All five colour rows rendered at once.** The base `.swatches { display: flex }` overrides the
`hidden` attribute's default `display: none`, so hiding four of the five rows did nothing. Needs an
explicit `.swatches[hidden] { display: none }`. Worth remembering: the `hidden` attribute loses to
any explicit `display` rule.

**An intermittent crash in the tween engine.** `updateTweens` iterated the tween array by index
while a `done()` callback was free to mutate it — and the last tween of the link ceremony calls
`finishCeremony()` → `finishTweens()`, which *reassigns* the array. The loop then read past the end
of a replaced array and threw. It only appeared on some runs, which is exactly what makes this class
of bug expensive later. It now iterates a snapshot, collects what finished, and fires the callbacks
after the list has been rebuilt. Verified clean across four full end-to-end runs.

## docs/
Business plan, build plan, feel spec, aesthetics notes, serverless mitigations.

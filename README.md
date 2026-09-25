# Cake — v1.21 (refactor complete)

No visual changes. The tag reads **v1.21**.

- **build() is the orchestrator.** Its hundred-line per-tier loop is now `buildTier(B, tier, i)`
  with an explicit build context `B`, so build() reads as its phases: prepare → each tier →
  sparklers, sprinkles, candles → shadow, confetti landings, framing, light, background.
- **49 forwarding wrappers removed.** Every `function x(…) { return MODULE.x(…); }` left by the
  earlier steps is gone; call sites call the module directly. Nine remain where the function is
  passed as a value.
- `cake.debug()` now reports the blow state; the breath test waits for the candles to be fully
  lit and breathes until they're out (the software renderer runs few frames a second).

Checks: load and feature switching (35 programs); the builder by taps; a recipient's journey;
blowing out by breath (5 → 0); cut and lift; six golden links; pixel comparison against v1.12:
0.00–0.05% on every cake.

See ARCHITECTURE.md for where everything lives and what's deliberately left for later.

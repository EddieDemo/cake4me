# Cake — v0.98 (candle styles)

Seven candle styles, plus **All**, which gives each candle its own style (from the cake's seed, so
the recipient sees the same mix):
**Classic · Twisted · Striped · Ombré · Gold · Silver · Tapered · All**

- **Twisted** — three ridges spiralling up the candle (a new shape).
- **Striped / Ombré** — the wax with a pattern in the candle's colour on white (candy stripes; a
  fade to pale at the top).
- **Gold / Silver** — metallic, reflecting a soft generated studio environment (without it, metal
  reads flat brown or grey).
- **Tapered** — slimmer toward the top and ~22% taller.
All share the holders, the hand-placed variation (push depth, lean, burn height), the per-candle
glow for the waxy ones, and the new flames. One instanced mesh per style in use, so a mix costs a
few draw calls, not one per candle.

**Builder:** a **Style** row of pills in the Candles tray (Candles mode; number candles stay
classic wax for now). **Generator:** picks a style for every random cake — Classic most often,
then Twisted, Striped, Gold and All-mixed, the rest now and then.

Schema `cs` (0–6, 7 = All) appended; older links are Classic. The patterned wax and metal shaders
are compiled at load. No errors; files load with `?v=0.98`.

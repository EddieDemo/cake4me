# Cake — v0.90 (waxy candles in holders)

**Waxy candles.** The candle is a real shape now — a gently uneven wall, a shoulder that rounds
over, a thin raised rim and a shallow melted pool round the wick — with a wax material: light soaks
into it (warm wrap lighting, so the shadow side stays soft), a soft sheen that's glossier in the
melted pool, very fine drawing lines, and the top glowing from within while the flame burns. The
glow is **per candle**: an instance attribute follows each flame, so blowing one out puts out its
glow. Still one draw call for all the candles.

**Holders.** Every candle stands in a small white holder — a cup with a rolled lip, a moulded rib
and a ring round its foot — on a spike pushed into the cake, with a couple of millimetres of spike
showing below the cup (`HOLDER.gap`). One instanced mesh for all of them; each rib faces its own way.

**Taller.** Candles are ~23% taller than before (0.5 → 0.62; 0.42 → 0.52 when packed tight).

Shaders: two new programs (wax, holder), both compiled up front — a recipient goes 18 at load → 18
lit → 18 blown out, no errors.

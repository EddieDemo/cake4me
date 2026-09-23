# Cake — v0.85

**No more bunching.** The gathered stretch is gone. The ribbon keeps its fine selvedge, its cloth
(satin or grosgrain), the anisotropic sheen and the few millimetres off level — the hand-tied cues
that worked — without the pleats, which read as bunched-up fabric rather than as a tied ribbon.

**The angle slider now sticks.** It wasn't a touch problem: `normalize` rebuilt each ribbon without
carrying the new angle across, so every rebuild threw the slider's value away and the thumb sprang
back — which is exactly what a slider that won't drag looks like. Verified: dragging to +3 leaves
the ribbon at +3 and the link carrying it.

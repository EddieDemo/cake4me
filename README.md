# Cake — v1.05 (refactor step 1: the safety net and the switches)

No visual changes. The tag reads **v1.05**.

**Debug switches** (`debug.js`), in the address bar, combinable; the tag lists the active ones:
`?ao=0 ?flames=0 ?halo=0 ?backdrop=0 ?shadows=0 ?sprinkles=0 ?sparklers=0 ?candles=0`
`?cover=0.9` (flame heart opacity) `?glow=1.2` (flame brightness).

**tools/** — `render.py` (golden cakes → PNGs), `compare.py` (pixel-diff two versions),
`golden_check.py` (every saved link still decodes to the same cake), `golden/` (six saved links
and their decoded configs). The refactor's rule: structural moves show ~0% change and pass the
link check.

**ARCHITECTURE.md** — inventory, target layout, and the order of work.

One thing the harness surfaced immediately: `cake.set()` merges into the current cake, so the
golden set needed a base config or the previous cake's number candles and sprinkles leaked into
the next. That's the kind of hidden state the store in step 2 removes.

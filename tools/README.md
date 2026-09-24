# tools/ — the safety net for the refactor

- `render.py <app> <out>` — renders the golden cakes (tools/golden_links.json) headlessly.
- `compare.py <before> <after> <sheet.png>` — pixel-diffs two render folders; prints % changed
  per cake and writes a side-by-side sheet. Structural refactors should show ~0%.
- `golden_check.py <app>` — decodes every saved link in tools/golden/ and checks the config
  matches what it decoded to when saved. Any change here means old cakes would change.
- Debug switches (debug.js): `?ao=0 ?flames=0 ?halo=0 ?backdrop=0 ?shadows=0 ?sprinkles=0
  ?sparklers=0 ?candles=0 ?cover=0.9 ?glow=1.2`, combinable; the version tag lists active ones.
These run where there's a terminal (Claude's side). The phone gets the switches.

# Cake — docs

The current version of every planning document, shipped inside each build so the code and
the thinking never drift apart. If you edit one of these, edit it here; the next zip carries
it forward.

| File | What it's for |
|---|---|
| `cake-business-plan.md` | What, why, for whom. Tiers and pricing, competitors, the slice loop, sharing channels, international/VAT, names, go-to-market, the numbers, risks, MVP definition (§12). |
| `cake-build-plan.md` | The phased build. Ground rules, workflow, Phase 0–7 with a "done when" for each, and what's deliberately not in v1. Status notes record where we've got to. |
| `cake-feel-spec.md` | The four moments (sending, receiving, cutting, receiving a slice) with easings, timings, sound cues and mobile constraints. Superseded sections are marked, not deleted. |
| `cakeAesthetics.md` | Parked: how to make the render less flat. Lighting tiers, materials, sprinkles/drips/rosettes, the clay-vs-realistic decision, performance budget. |
| `cake-builder-spec.md` | The next stage: a Quick (seed-placed) generator and a Detailed hand-decoration builder sharing one object model. The replay, the psychology→feature map, ugly-proofing, monetisation stance (sending is the product), the no-install backend paths, per-feature notes, and the build order. |
| `cake-serverless-growth.md` | The list of things that arm a future purchase without a server, in build order: occasion taxonomy and recurrence rules, the reminder pop-up and `.ics`, pre-filled edit links, "send one back", the birthday book, the slice-back acknowledgement loop, and what still needs a server. |
| `cake-revenue-strategy.md` | How to maximise earnings while staying simple. What Moonpig and TikTok gifting prove, twelve levers ranked by impact × simplicity (calendar reminders and reciprocity pre-fill first, both serverless), pricing architecture, the metrics that matter, and sequencing. |
| `cake-backend-options.md` | The backend, for a no-install workflow: what it has to do and when, Firestore vs Supabase vs Cloudflare Workers+D1 vs GitHub Actions vs browser function editors, a comparison table, and the recommendation (Firestore first, Cloudflare when trusted code is needed, not Supabase). |
| `cake-serverless-mitigations.md` | Parked: what happens when a paid link gets shared or forged, and the serverless options for each. Signed links, open counting, slice ledger, platform free tiers, and a recommended sequence (which starts with "do nothing"). |

Reading order for a cold start: business plan §1–3, then build plan, then feel spec.

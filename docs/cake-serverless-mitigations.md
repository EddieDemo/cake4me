# Cake — Serverless mitigations

Options for dealing with shared links and forged cakes, and what each one costs. Written 14 Sept 2026. Nothing here is built. Read `cake-business-plan.md` §12 for where a backend sits in the roadmap (month six, and only if asked for).

---

## 1. What the problem actually is

The cake is the link. The whole config is base64url-encoded in the hash, the page is a static file, and nothing is checked against a server. So:

- **Sharing.** A hundred people opening the same link get a hundred identical cakes. There's no way for us to know.
- **Per-viewer state.** Slice counts and relights live in each visitor's own `localStorage`, so every viewer independently gets their own eight slices. "7 slices left" is a fiction on a public link.
- **Forgery.** Anyone who looks at the URL format can hand-craft a cake without paying. Takes about a minute.

Severity, in order: **the slice count losing meaning** matters most, because slices are the marketing and their scarcity is what makes them feel like a gift. The revenue leak from sharing is second. Forgery is third and is probably never worth fixing at £4.49.

A cake going viral because someone posted it publicly is free advertising with a "send someone a cake" button on it. That's not obviously a problem to solve.

---

## 2. The non-negotiable rule

**The viewer must fail open.** If a worker is down, rate-limited, blocked by a corporate network, or the recipient is on a plane, the cake must still open and still work. A gift that shows an error is worse than a gift that was free.

Every option below is written to degrade to current behaviour on any failure. Never `await` a network call before the first frame renders.

---

## 3. Option A — Signed links

**Stops:** forgery (hand-crafted free cakes).
**Doesn't stop:** sharing. A shared signed link is still a valid signed link.
**Needs:** one stateless endpoint. No database.

### How
1. A worker holds a **private** key and signs the cake config at checkout, returning `#c=<config>&s=<signature>`.
2. The page verifies with the matching **public** key, baked into `app.js`, using Web Crypto (`crypto.subtle.verify`).

**Use an asymmetric signature (ECDSA P-256 or Ed25519), not an HMAC.** An HMAC needs the same secret on both sides, and the client side is a public JS file — the secret would be there for anyone to read, which defeats the whole thing.

### Why this one is nice
The viewer stays completely static. No network call on open, works offline, links keep working if the worker is ever switched off (verification is local). It's the only option here that doesn't compromise the "links live forever" property.

### Costs
- **Link length: about +86 characters** for a P-256 signature in base64url. We've been optimising hard for short links (currently ~70 chars after the `#`), so this roughly doubles it. That's the real price.
- Key rotation is awkward: rotate and every old link fails verification. Ship a small array of accepted public keys from day one so old ones can be retired gracefully.
- Unsigned legacy cakes must be grandfathered (accept `v:1` unsigned, require signatures from `v:2`), or every link sent before the change breaks.

### Verdict
Only build this if forged cakes actually show up. At £4.49 the effort-to-reward for a forger is terrible, and the link-length cost is real and permanent.

---

## 4. Option B — Open counting (detection, not enforcement)

**Stops:** nothing.
**Tells you:** which cakes are being shared, and how much.
**Needs:** one endpoint + a database.

### How
The viewer fires a `fetch` (fire-and-forget, after first render) with the cake's hash, or a short hash of it. The worker records an open. You get "this one cake has 400 opens" as a signal in a dashboard.

### Critical implementation note: use D1, not KV
Workers KV's free tier allows 100,000 reads a day but only **1,000 writes**. A counter that increments on every page view of a 5,000-visitor day exhausts that before lunch, and the cap is hard — you get a failed response, not throttling. D1 (Cloudflare's edge SQLite) gives **5 million rows read and 100,000 rows written per day** on the same free plan. For any write-per-open pattern, D1 is the right store.

Alternative: don't count every open. Write once per cake per day (`INSERT ... ON CONFLICT` on a `(hash, date)` key), which collapses a viral cake into one write a day and keeps KV viable. Cheaper, still answers the question.

### Costs
- Privacy: you're now logging something per open. Keep it to a hash of the config and a timestamp — no IPs, no names, no message text. Say so in the privacy notice.
- It's a network call from the viewer, so it must be fire-and-forget and must never block rendering.

### Verdict
**Build this first if you build anything.** It's cheap, it enforces nothing, it can't break a gift, and it's the only way to find out whether Option C is ever worth building. Do not build the ledger on a hunch.

---

## 5. Option C — Server-side slice ledger

**Stops:** the shared-link problem properly. Slices become a global count rather than per-browser.
**Needs:** endpoint + database + real thought about failure modes.

### How
1. First open creates a row for the cake with `slices_remaining = 8` (or 16/24/48 by tier).
2. Claiming a slice calls the worker, which decrements atomically and returns the new count.
3. The viewer renders the count it's given.

**Storage choice:** D1 is fine if a little staleness is acceptable. If you want strict consistency — two people tapping the last slice at the same moment — use a **Durable Object per cake**, which serialises access by design. Durable Objects are on the free tier at 100,000 requests a day.

### Costs
- **This is where "no server, links live forever" stops being true.** If the worker ever goes away, or you stop paying, or the free tier caps out, every old cake degrades. That's a promise to your customers you'd be quietly breaking.
- Needs a fallback path anyway (see the rule in §2): if the worker doesn't answer within ~800ms, fall back to `localStorage` and let the slice through. Which means a determined sharer can still get extra slices by going offline. You're raising the effort, not sealing it.
- More moving parts to debug on a day when someone's birthday cake isn't working.

### Verdict
Only if Option B shows sharing is materially eating into sales. It's the correct fix, and it's the expensive one.

---

## 6. Option D — Claim on first device

**Stops:** sharing, bluntly.
**Don't build this.**

First open sets a token; subsequent devices get a view-only cake. The failure mode is the recipient opening their cake on their phone at breakfast and their laptop at lunch, and finding it broken. You'd be damaging the actual gift to protect £4.49. If sharing ever needs stopping, Option C does it without punishing the person the cake was for.

---

## 7. Platform notes (as of Sept 2026)

Constraint that matters here: **no terminal, no npm**. That rules some options in and out.

| Platform | Free tier | Fits the workflow? |
|---|---|---|
| **Cloudflare Workers** | 100,000 requests/day, 10ms CPU per invocation | Yes. Deploys from a GitHub repo, and small scripts can be edited in the dashboard. Best fit. |
| **Cloudflare D1** | 5 GB storage, 5M rows read/day, 100K rows written/day | Yes. The right store for anything write-per-open. |
| **Cloudflare KV** | 1 GB, 100K reads/day, **1K writes/day** | Only for read-heavy/rarely-written data. The write cap will bite. |
| **Cloudflare Durable Objects** | 100,000 requests/day | Yes, if strict consistency is needed. |
| **Netlify / Vercel functions** | Comparable | Yes, both deploy from GitHub. |
| **Firebase Functions** | — | No. Wants the CLI. Skip despite already using Firebase Hosting. |

All the free tiers above are far beyond anything this product will see before it's obviously working.

---

## 8. Recommended sequence

1. **Launch with none of it.** The no-server design is a feature — it's why links work forever and why there's nothing to run. Don't trade that for a problem you haven't observed.
2. **Add Option B (counting)** once there's real traffic. Cheap, safe, answers the question.
3. **Add Option A (signing)** only if forged cakes actually appear. Weigh the +86 characters on every link.
4. **Add Option C (ledger)** only if B shows sharing is costing real money.
5. **Never add Option D.**

Anything built here belongs in the business plan's "month 6: decide whether to stay serverless" milestone, not before.

---

## 9. Sources

- Cloudflare Workers free tier: 100K requests/day, 10ms CPU (AgentDeals vendor page, Aug 2026; Cloudflare free-tier checklists, May 2026)
- Workers KV free tier: 1 GB, 100K reads/day, 1K writes/day, hard caps resetting 00:00 UTC (Cloudflare blog; BaseKV, May 2026)
- D1 free tier: 5 GB, 5M rows read/day, 100K rows written/day (AgentDeals, Aug 2026)
- Durable Objects free tier: 100K requests/day (AgentDeals, Aug 2026)

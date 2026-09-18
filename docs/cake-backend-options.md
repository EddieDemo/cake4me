# Cake — Backend Options (no-install)

What the backend has to do, the ways to get one without installing anything on the work machine, and which one to pick. Written 16 Sept 2026. Reads alongside `cake-serverless-mitigations.md` (why a backend might be needed for sharing/forgery) and `cake-builder-spec.md` §8 (why Detailed cakes need one).

## 0. The constraint

Everything has to be done from a browser, VS Code, and files dragged into a GitHub repo. No terminal, no npm, no admin rights, no local installs beyond a VS Code extension. Anything that needs `npm install` or a CLI on the laptop is out.

That rules out less than it sounds like. It rules *in* anything that is either (a) a database the page can talk to directly from a `<script>` tag, or (b) code that someone else's computer builds and deploys from your GitHub repo.

## 1. What the backend actually has to do

Now, and in the order it'll be needed:

| Need | Why | When |
|---|---|---|
| **Save a cake, get a short ID, load it by ID** | Detailed cakes (strokes, placements) don't fit in a URL | Builder spec step 6 |
| Cakes must **never disappear** | A gift link is a promise; an old cake has to open years later | Same |
| **Open counting** | Detect sharing/virality (detection, not enforcement) | Optional, post-launch |
| **Verify payment before saving** | Close the soft gate properly | When it matters |
| **Global slice ledger** | Slices as a real count, not per-browser | Only if counting shows sharing is eating sales |
| **Collaborative cakes** | Several people editing before send | Later |
| **Store exported video/photos by link** | Only if "share a link to my video" is wanted; local download needs no storage | Much later |

The first two are the whole requirement for Detailed v1. Everything below the line needs code the client can't be trusted to run.

## 2. The options

### Option A — Firebase Firestore, straight from the page

A document database the static page writes to and reads from using Firebase's browser SDK, loaded from a CDN `<script>` tag. No server code. Access control is a rules file edited in the Firebase console.

**How it's set up, from a browser only**
1. Firebase console → add Firestore to the existing project (the one already hosting eddiedemo.com), or a new project for Cake4.me.
2. Copy the web config snippet into `index.html` (these keys are public by design; security lives in the rules).
3. Rules: anyone may **create** a document in `cakes/` if it's under a size cap and has the expected shape; anyone may **read** a document by ID; nobody may list, update or delete. Cakes are immutable once saved.
4. In `app.js`: on "Get my link" for a Detailed cake, `addDoc(cakes, cake)` → ID → link is `#id=<ID>`. On open with `#id=`, `getDoc` → render.

**Free tier (Spark), as of mid-2026**
- 1 GiB storage, 50,000 reads/day, 20,000 writes/day. Stays active; no inactivity pause.
- A cake is one document, a few KB. One open = one read. 50K opens a day is far past the business plan's target.
- Note: Cloud **Storage** (files) was removed from the free plan in Feb 2026 — irrelevant unless video/photos are ever stored server-side; local download needs nothing.

**Good**
- The least new stuff. Zero server code, zero deployment pipeline. The console is already familiar.
- Links live forever on a free plan with no upkeep.
- Immutable documents + rules = very little to get wrong.

**Bad**
- Payment gating stays soft: the write happens on the checkout success page, same trade-off as today's URL cakes.
- Anything the client can't be trusted with (payment verification, ledgers) can't be done here without Cloud Functions, which want the CLI. That work goes to Option C instead.
- Google lock-in, mildly. Cakes are plain JSON, so migration is an export and re-import.

### Option B — Supabase, straight from the page

Same shape as A (browser SDK from a CDN, rules in a console, no server code), on Postgres instead of Firestore. Nice product.

**Why not, for this product:** free-tier projects **pause after 7 days of inactivity**, and unpausing is manual. For a gift-link service that means a cake sent in January can be dead by February if nothing else happened that week. The Pro plan (~$25/month per project) removes the pause. So it's either a monthly bill from day one, or a keep-alive ping from a third-party monitor, which is exactly the kind of fragile workaround a gift promise shouldn't rest on.

Keep it in mind for later if the product ever wants SQL. Not for v1.

### Option C — Cloudflare Workers + D1, built and deployed from GitHub

Real server code (a Worker), with a SQLite database (D1) and key-value store (KV) bound to it. Cloudflare's dashboard connects to a GitHub repo, and **every push builds and deploys the Worker on Cloudflare's machines** — the deploy command runs there, not on the laptop. Files go into the repo by drag-and-drop in the browser, the same as the site today. The dashboard's "get started" flow will create the repo for you. Small Workers can also be edited directly in the dashboard.

**Free tier, as of mid-2026**
- Workers: 100,000 requests/day.
- D1: 5 GB, 5M rows read/day, 100K rows written/day.
- KV: 100K reads/day but only **1,000 writes/day** — fine for config, useless for per-open counters (see mitigations doc).
- Durable Objects: 100K requests/day, for strict consistency (a per-cake slice ledger).

**Good**
- Everything the client can't be trusted with lives here: verify a Lemon Squeezy webhook, then save; count opens; run a slice ledger; sign links; merge collaborative edits.
- One vendor for the whole later roadmap. Generous limits.
- Cloudflare can also host the static site, so at some point everything can sit in one dashboard.

**Bad**
- More to learn than A: a Worker is a small program with routes, and D1 wants a schema. Not hard, but it's a second thing.
- Even plain save/load needs a Worker, because D1 has no browser SDK. So for v1 it's strictly more work than A for the same result.
- Deploy-on-push means a broken commit can take the API down until the next push. Keep the Worker tiny and boring.

### Option D — GitHub Actions as a computer in the cloud

Not a backend, but the escape hatch. An Action runs any script or build from a YAML file committed via the browser: build steps, `wrangler deploy` for Option C if the dashboard integration ever falls short, scheduled jobs. Already used once on another project. Free minutes are ample for this.

### Option E — Browser-based function editors (Val Town, Deno Deploy playground, and similar)

Write and run server-side JavaScript entirely in a web editor; no repo, no build. Genuinely no-install. They're good for a quick webhook receiver or a one-off endpoint, and worth knowing about. Not the foundation for something that has to keep old links alive for years — free tiers and product direction on these are less settled than A or C, so check current terms before relying on one.

## 3. Comparison

| | A · Firestore | B · Supabase | C · Workers + D1 | D · Actions | E · Val Town etc. |
|---|---|---|---|---|---|
| Server code to write | none | none | yes (small) | n/a | yes (small) |
| Deploy pipeline | none | none | GitHub → Cloudflare | is one | none |
| Links live forever on free tier | **yes** | **no** (7-day pause) | yes | n/a | check |
| Save/load by ID | ✅ | ✅ | ✅ (via Worker) | – | ✅ |
| Verify payment before save | ✗ (Functions need CLI) | ✗ | ✅ | – | ✅ |
| Open counting | ✓ (crude, via writes) | ✓ | ✅ (D1) | – | ✓ |
| Slice ledger | ✗ | ✗ | ✅ (D1 / Durable Object) | – | risky |
| Collaborative cakes | partial | partial | ✅ | – | – |
| New things to learn | ~1 | ~1 | ~3 | ~1 | ~1 |
| Free-tier headroom for the plan's targets | plenty | plenty (if paid) | plenty | plenty | check |

## 4. Recommendation

**Start with Option A (Firestore). Move the trusted work to Option C (Cloudflare Workers + D1) when it's needed. Skip B.**

Why A first:
- It's the smallest step that delivers the actual requirement: save a Detailed cake, get an ID, open it forever. No server code, no pipeline, one console that's already in use.
- It stays alive for free with nothing to maintain. That is the single most important property for a product whose links are promises.
- The soft payment gate is the same trade-off already accepted for URL cakes, and the mitigations doc's advice still stands: don't build enforcement before there's evidence it's needed.

Why C later, not instead:
- The things that need it — payment verification, counting, a ledger, collaboration — are all post-launch, evidence-driven decisions. Building a Worker and a schema before any of them are needed is the "backend before you know you need one" mistake, just with a different vendor.
- When one of them arrives, the Worker is a small, boring program deployed by dragging files into GitHub, which fits the workflow. D1's 100K writes/day is what makes counting viable, where KV's 1,000 isn't.
- Cakes are immutable JSON documents. If the store ever moves from Firestore to D1, it's an export and an import, not a rewrite.

Why not B: the inactivity pause on the free tier is disqualifying for gift links, and paying $25/month from day one to avoid it buys nothing A doesn't give for free.

## 5. Rules of the road (whichever option)

- **Fail open.** If the backend doesn't answer within ~800ms, the viewer still opens whatever it can. A gift that shows an error is worse than a gift that was free.
- **Cakes are immutable.** Never update or delete a saved cake. Fixes ship as new cakes.
- **Nothing runs on the laptop.** If a step needs a terminal, it's the wrong step.
- **No secrets in the page.** Firebase web keys are public by design; anything actually secret (webhook signing keys) lives only in a Worker's environment, set in the Cloudflare dashboard.
- **Privacy notice** gets a line when cakes are stored: what's stored (the cake), what isn't (no accounts, no IPs), and that it's kept so the link keeps working.

## 6. Sources (mid-2026)

- Supabase free tier and 7-day pause: dev.to (May 2026), techsy.io (May 2026), itpathsolutions.com (May 2026), agentdeals.dev (Jul 2026), guptadeepak.com (Sep 2026)
- Firestore Spark limits and Feb 2026 Storage removal: agentdeals.dev, designrevision.com (Jul 2026)
- Cloudflare Workers Builds git integration and dashboard get-started: developers.cloudflare.com (May–Aug 2026), blog.cloudflare.com (Jul 2026)
- Cloudflare free-tier figures: see `cake-serverless-mitigations.md` §7

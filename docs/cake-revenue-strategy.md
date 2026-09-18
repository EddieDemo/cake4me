# Cake — Revenue Strategy

How to maximise what Cake4.me earns while keeping the app simple. Written 16 Sept 2026. Companion to `cake-business-plan.md` (the base plan), `cake-builder-spec.md` (Quick/Detailed) and `cake-backend-options.md` (what needs a server and what doesn't).

The short version: **in gifting, the money is in the second purchase, not the first.** Design for repeat from day one, and most of the best levers need no backend at all.

---

## 1. Where the money actually is: what the incumbents prove

**Moonpig** (UK's largest card and gift platform, ~12m active customers) is the closest public precedent, and its numbers are unusually instructive:

- Nearly **nine-tenths of revenue comes from existing customers**. Growth compounds through three levers: more active customers, higher purchase frequency, higher order value.
- Its database of **107 million occasion reminders drives close to 40% of orders**. Reminders let it reach customers "at nil cost at moments of high gifting intent". That is the moat, and it's a database of dates, not a product feature.
- **88% of card purchases are tied to annual events**, and the average UK card-giving adult sends **19 cards a year**. The demand is calendar-shaped and repeats forever.
- **Moonpig Plus** subscribers (1.02m) set 2.5× more reminders and attach more gifts.
- **Gift attach rate** is 17.8% and climbing: nearly one in five card orders adds a gift, lifting order value.
- Over half of cards now use a creative feature (AI stickers, handwriting, audio/video). Personalisation is what people pay for.

**TikTok Live gifting** is the closest precedent for the psychology of a digital token:
- 82% of gifts sent are the cheapest tier; ~3% reach the premium tier. Revenue is whale-shaped, so the top of the ladder matters far more than its volume suggests.
- 34% of gifters do it to *be noticed*. Conversion roughly doubles (1.5% → 4%) when the recipient visibly acknowledges the gift. **Acknowledgement is a revenue lever.**
- The platform keeps ~50%. Our margin after a merchant of record is ~87%. We can afford to be generous with the loop.

**Kudoboard / Thankbox** show the B2B seam: offices buy group cards on subscriptions at ~$25/user/month. Same emotional product, different buyer, ten times the price.

**The UK greeting card market** is £1.5bn a year on single cards, 92% of households buy them, and everyday occasions are three-quarters of it. This isn't a market to create.

**Translation for Cake4.me:** the product already has the emotional payload and the sharing loop. What it needs to earn properly is (1) a way to bring senders back at the next occasion, (2) a price ladder with a top, (3) a reason for the recipient to become a sender, and (4) a channel to acknowledge the sender. Everything below is those four, ranked.

---

## 2. The levers, ranked by impact × simplicity

Scored 1–5 on revenue impact and on how little there is to build. "Backend" flags anything that needs `cake-backend-options.md` Path 1 or 2.

| # | Lever | Impact | Simplicity | Backend? | When |
|---|---|---|---|---|---|
| 1 | **Reminders, without a server** (calendar export) | 5 | 5 | no | Launch |
| 2 | **Reciprocity pre-fill** on the recipient's screen | 5 | 5 | no | Launch |
| 3 | **Price ladder with a whale tier** | 4 | 5 | no | Built |
| 4 | **Credits and packs** (prepay) | 4 | 4 | no (codes) | Month 2 |
| 5 | **Occasion breadth + seasonal drops** | 4 | 4 | no | Rolling |
| 6 | **Share assets** (video export, watermark) | 4 | 4 | no | With replay |
| 7 | **Attach at checkout** (a second cake, premium object) | 3 | 4 | no | Month 2 |
| 8 | **Acknowledgement loop** ("Hollie opened your cake") | 5 | 2 | yes | Month 4+ |
| 9 | **B2B office packs** | 4 | 3 | light | Month 3 |
| 10 | **Cake Club subscription** | 4 | 2 | yes | Only once repeat is proven |
| 11 | **Light gamification** (collection, unlocks) | 2 | 4 | no | Opportunistic |
| 12 | **Affiliate real cake** | 2 | 5 | no | Test cheaply |

### 2.1 Reminders without a server — the Moonpig moat, for free
Reminders drive ~40% of Moonpig's orders and cost them a database of 107m dates and an email/push operation. We can get most of the effect with none of the infrastructure:

- After every send: **"Remind me next year?"** → generates an `.ics` calendar file (one line of JS) with an annual recurring event, *"Send Hollie a cake"*, three days before the date, whose description holds a link that opens the builder **pre-filled with Hollie's name and last year's cake** as the starting point.
- Calendar alerts are more reliable than any push notification we could send, they work on every phone, and they never depend on us running anything.
- Keep a **birthday book** in `localStorage`: names and dates the sender has entered. Each visit: "Coming up: Nan, 12 days". Export the whole book as one `.ics`.
- Occasion prompts by date: on the site in February, the Valentine's cake is first; in early December, Christmas.

This is the single highest-value thing that isn't built, and it's an afternoon.

### 2.2 Reciprocity pre-fill — turning recipients into senders
The recipient's CTA is currently generic ("Send someone a cake"). Make it **specific and pre-filled**:
- The link carries `from`, so the recipient's screen can say **"Send one back to Eddie"** with the builder opening pre-filled `to: Eddie`.
- Then ask the one question that creates the next sale: **"When's Eddie's birthday?"** → reminder (§2.1). The recipient leaves with a calendar entry that will bring them back.
- Reciprocity is the strongest lever in gift psychology and this makes acting on it one tap. It also asks for the date at the moment of maximum warmth, which is when people give it.

Zero backend. Fits in the URL fields already there.

### 2.3 The price ladder — already built, now stated as strategy
Classic £4.49 → Two-tier £9.99 → Showstopper £24.99 → The Absurd £99. TikTok's data says to expect ~80% at the bottom and ~3% at the top; the top still matters because a £99 sale is 22 Classics. The middle tier exists partly as a **decoy** that makes £24.99 look reasonable. Don't collapse the ladder for "simplicity"; the whole reason it earns is the spread.

Price display: always show what it *isn't* — "less than a posted card" — and never the price on the cake itself.

### 2.4 Credits and packs — prepay, fewer fees, more sends
- **3 for £11.99, 10 for £34.99** (Classics; upgrades pay the difference). Per-cake cost drops to £3.50 and the buyer has nine reasons to come back.
- Prepay solves the small-ticket fee problem: one merchant-of-record fee on £34.99 instead of ten on £4.49 (~13% each).
- **Breakage** (unused credits) is real revenue in every prepaid model; don't design for it, but don't pretend it's zero.
- Gift the credits: "Cake credits for the office manager". Same mechanism, new buyer.
- Implementation stays serverless: codes checked client-side against a hashed list in the repo, as the business plan already describes. Soft, and fine.

### 2.5 Occasion breadth and seasonal drops
88% of card buying is annual events. Every occasion skin is a new reason to send to the same people. Order of value for the UK: **birthday → Christmas → Mother's Day → Valentine's → Father's Day → new baby → wedding/anniversary → get well/thank you** (the "blank card" long tail).

Seasonal **limited items** (a topper that exists for a month) add scarcity and a reason to check back. Cheap: it's a date check in the object list.

### 2.6 Share assets
Makers share what they made; receivers share what they were given. The replay (`cake-builder-spec.md` §3) produces a 15-second vertical video, exported client-side. **Only after paying to send.** A small wordmark on every export. This is the marketing budget.

### 2.7 Attach at checkout
Moonpig's attach rate is 17.8%. Ours can be: *"Add a cake for someone else, 30% off"* on the success page, and premium objects (gold leaf, a rare topper, +£1) in the builder. Both are one screen and no server.

### 2.8 Acknowledgement loop — the big one that needs a backend
TikTok's numbers: gifting conversion roughly doubles when the gift is acknowledged. Right now the sender gets nothing back. The loop to build, when the backend exists:
- Sender's email is already captured at checkout (merchant of record).
- The viewer pings on open (the "counting" option in the mitigations doc).
- Sender gets one email: **"Hollie opened your cake and blew out the candles 🎂"**, with a still of the settled confetti and *"Send another"*.
- Optionally the recipient can tap **"Say thanks"** which sends a one-line reply to that email. No accounts on either side.

This is the feature most likely to turn a one-off buyer into a repeat one, because it closes the emotional loop that a physical gift closes automatically. It's month 4+, Path 1 or 2 in the backend doc, and it needs the privacy notice updated. Worth it.

### 2.9 B2B office packs
Kudoboard charges companies ~$25/user/month for the same emotion. A simpler entry: **"Office pack — 20 Classics, £59, invoice available"**, a "cake in the Slack channel" demo, and leaving/retirement/new-job skins. The buyer is an office manager with a card budget. Later: collaborative cakes (spec §9), which is the real B2B product.

### 2.10 Cake Club — later, and only if the data says so
Moonpig Plus works because reminders and repeat already exist; membership deepens a habit, it doesn't create one. A **£24.99/year Cake Club** (12 Classics, member toppers, early seasonal access) makes sense once a meaningful share of buyers have sent three or more. Not before. Needs a backend for entitlement.

### 2.11 Gamification, lightly
Streaks are wrong for gifting; nobody sends a cake daily and a broken streak is a guilt trip. What fits:
- **A collection**: "Cakes you've sent" gallery in `localStorage`, with occasion badges. Costs nothing, feels like a history.
- **Unlocks by sending**: send five cakes, unlock a topper set. Encourages the next send without gating the product.
- **Seasonal badges** on the collection. Scarcity, again.
Avoid anything that makes the gift feel like a game score.

### 2.12 Affiliate real cake
"Send Hollie a real slice too" via a postal-cake partner (Send a Slice, CakeDrop). Affiliate commission, nothing to build, and it tests whether the digital cake can carry a physical upsell. Small money; worth one afternoon.

---

## 3. What to leave alone

- **No ads, no free sendable cake.** Both destroy the paid-gift signal the whole plan rests on.
- **No subscription before repeat exists** (§2.10).
- **No backend before evidence** (`cake-serverless-mitigations.md` §8). The acknowledgement loop is the first thing worth one.
- **No streaks, no leaderboards, no "score".** It's a gift.
- **No price collapse.** The ladder earns because it's a ladder.
- **No discount culture.** Credits, not coupons. A gift bought at 40% off is a worse gift.

---

## 4. The customer journey, revenue-shaped

```
See a cake (chat / slice / video)
   → open builder, pre-filled name              [§2.2]
   → choose tier                                 [§2.3 ladder]
   → decorate (Quick or Detailed)                [effort = value]
   → pay                                         [MoR, currency localised]
   → success page: attach a second cake? remind me next year?   [§2.7, §2.1]
   → share the link; export the video            [§2.6]
   → recipient opens, blows, cuts, sends slices  [loop]
   → recipient: "send one back to Eddie" + "when's his birthday?"   [§2.2 → §2.1]
   → sender: "Hollie opened your cake"           [§2.8, later]
   → calendar alert next year → pre-filled builder                  [§2.1]
```
Every arrow that isn't there today is one of the levers above. Notice how many terminate in a calendar entry: that's the repeat engine.

---

## 5. Pricing architecture (proposed)

| Product | Price | Note |
|---|---|---|
| Classic | £4.49 | The base. Test £3.99/£4.99 in the first two months. |
| Two-tier | £9.99 | Decoy for the Showstopper. |
| Showstopper | £24.99 | Where the "worth it" buyers land. |
| The Absurd | £99 | Exists to be screenshotted and to anchor. |
| 3-pack | £11.99 | Effective £4.00. |
| 10-pack | £34.99 | Effective £3.50. The organiser's product. |
| Office 20-pack | £59 | Invoice, occasion skins for work. |
| Premium object | +£1 | Gold leaf, rare toppers. Attach lever. |
| Cake Club (later) | £24.99/yr | 12 Classics + member items. Only after repeat is proven. |

USD/EUR/AUD/CAD set per currency, not converted (business plan §7.2).

---

## 6. The numbers that tell you whether it's working

| Metric | Why | Target to aim at |
|---|---|---|
| **Slice → cake conversion** | The loop's strength | >5% (business plan) |
| **Recipient → sender conversion** (via pre-fill) | §2.2 working | 8–12% |
| **Reminder set rate** at send | The repeat engine being armed | >40% of sends |
| **Repeat rate at 90 / 365 days** | The Moonpig number | 25% / 55% of buyers send again within a year |
| **Tier mix** | Ladder health | ~80 / 12 / 6 / 2 |
| **Average order value** | Ladder + attach | >£6.00 |
| **Attach rate** on success page | §2.7 | 10–15% |
| **Video exports per paid cake** | Share asset uptake | >30% |
| **Revenue from existing buyers** | The whole thesis | rising toward 50%+ by month 12 |

Most of these are measurable with a privacy-friendly analytics tool and UTM parameters; only the acknowledgement loop and true repeat attribution need a backend.

---

## 7. Sequencing — cheapest, biggest first

1. **This month, no backend:** calendar reminders on the success page; reciprocity pre-fill and the birthday question on the recipient screen; birthday book in `localStorage`; "add a second cake" on success.
2. **Month 2:** credit packs by code; seasonal drop mechanism; premium objects as the first attach.
3. **Month 3:** office pack and a work-occasion skin set; affiliate real-cake test.
4. **With the replay:** video export and wordmark.
5. **Month 4+, first backend:** acknowledgement email loop. Then counting. Then, if the data supports it, Cake Club and collaborative cakes.

The ordering principle: **anything that arms a future purchase without a server goes first.** The reminder and the pre-fill are worth more than any feature in the builder spec, and together they're a day's work.

---

## 8. Sources

- Moonpig Group plc FY25 annual report and FY26 half-year results (Jul 2025 / Dec 2025): revenue mix, 107m reminders, 88% annual-event share, 19 cards/adult/year, Plus membership, gift attach 17.8%, creative-feature usage. Reminders "drive nearly 40% of orders" via MatrixBCG summary (Nov 2025).
- TikTok Live gifting: Ipsos study for TikTok via Tubefilter (Dec 2025); TTS Vibes conversion analysis (Jul 2026); BeetGames catalogue study (Aug 2026).
- Kudoboard / Thankbox pricing: see `cake-business-plan.md` §4.
- UK card market: GCA Market Report 2025, see `cake-business-plan.md` §3.

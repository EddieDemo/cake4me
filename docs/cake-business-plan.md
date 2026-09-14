# Cake — Business Plan

Working title: **Cake** (see "Names" below). Written 13 Sept 2026. Companion to `cake-build-plan.md`, which covers *how* to build it; this document covers *what*, *why*, *for whom*, and *how it makes money*.

---

## 1. One-paragraph summary

A browser-based digital cake you send as a link. The sender picks an occasion and a cake tier (from a Classic at £4.49 up to an absurd five-tier flex), chooses colours for the frosting, the hidden filling and the candles, writes a message, chooses how many candles (0–100), pays, and gets a URL they can send through anything that carries a link. The recipient opens it on their phone, blows out the candles (microphone or swipe), the message is revealed, and they cut the cake into slices (eight on a Classic, more on bigger tiers) and send each slice to someone else as its own link. Every slice is a free advert that lands in a new person's chat, with a "send someone a cake" button on it. No app to install, no account, no server, no database: the whole cake is encoded in the link. UK launch, priced in GBP, sellable to most Western countries from day one via a merchant-of-record checkout.

The bet: the market for "send something small and lovely to a person who isn't in the room" is enormous and mostly served by either paper cards or ugly free e-cards. A beautifully made, physically satisfying cake, that costs something and that the sender can make their own, with a built-in sharing loop, can take a slice of it (sorry).

---

## 2. The product

### 2.1 What the sender does
1. Picks an occasion (birthday by default; see 2.4).
2. Picks a cake tier: Classic, Two-tier, Showstopper or The Absurd (see 6.2). Bigger cakes cost more and have more slices.
3. Chooses colours: frosting, candles, and the **filling**, which stays hidden until the recipient cuts the cake.
4. Types a name, a from-name and a short message (~80 chars).
5. Sets candles: 0–100. Number candles ("4" and "7") available as an alternative. 100 is a joke people will make on purpose.
6. Optionally decorates (post-launch, see 2.6): constrained, curated, can't be made ugly.
7. Pays (see 6), receives the link, shares it.

Whole flow under two minutes on a phone with defaults; decorating is optional so the fast path never gets slower.

### 2.2 What the recipient gets
1. A slowly turning 3D cake with their name on it, candles lit.
2. They blow (mic) or swipe. Candles go out in waves, wisp of smoke, confetti.
3. The message is revealed on the cake.
4. "Cut the cake": tap a wedge, it lifts out onto a plate and reveals the filling colour the sender chose (a second reveal). "Send this slice to someone." Eight slices on a Classic, then the plate is empty.

### 2.3 What the slice recipient gets
A single wedge on a plate with a candle, the original message on the frosting, "**Hollie sent you a slice of her birthday cake**", and one button: **Send someone a cake**. Slice recipients cannot slice further. Scarcity is part of the charm.

### 2.4 Occasions (the real product surface)
Birthday is the entry point but the engine is occasion-agnostic. Each occasion is a skin plus a change of copy ("Happy Birthday" → "Merry Christmas"), which is cheap to add and expensive for competitors to match in quality.

| Occasion | Cake | Notes |
|---|---|---|
| Birthday | Classic layered, chocolate, sprinkles | Year-round volume. The base. |
| Christmas | Iced fruit cake, holly, robin | UK-specific and huge. Sender sends one link to the whole family group; everyone gets a slice. |
| Anniversary | Two-tier, gold | Couples; higher willingness to pay. |
| Wedding / engagement | Tiered white | "We're engaged!" reveal under the candles. |
| Baby shower / new baby | Pastel, tiny booties | Slice loop is natural: "share the news". |
| Mother's Day / Father's Day | Victoria sponge / "World's best" | UK Mother's Day is March; US is May. Localise the prompt by country. |
| Valentine's | Heart-shaped, red velvet | The rose app's whole market, one day a year. |
| Easter | Simnel cake, mini eggs | UK. |
| Halloween | Black frosting, pumpkin | Fun skin, small revenue. |
| Graduation / new job / leaving / retirement | Mortarboard, "Good luck" | Office use, weekday volume. |
| Get well / thinking of you / congratulations | Simple, warm | Blank-card equivalent: covers the long tail. |

Ship with birthday plus two more (Christmas by November, anniversary). Add one per month based on what sellers ask for.

### 2.5 What it deliberately isn't
- Not a group card (Kudoboard territory). One sender, one recipient, then the loop.
- Not a "digital gifts platform" with fifty gift types. One object, made properly, with variants.
- Not an app store app. No install friction, no 30% cut, no review queue, works in any chat.
- Not free-with-ads. The free competitors exist and they are ugly for a reason.
- Not free at all. There is no sendable free version (see 3.5). Free is a preview for the sender, never a gift.

### 2.6 Sender decoration (first major post-launch update)
Effort is the second costly signal (3.5), so the sender should be able to *make* the cake, not just pick it. But free-form painting produces ugly cakes with our name on them, and paint strokes can't live in a URL. So decoration is a designed system, not a canvas: zones coloured from curated palettes; decorations (sprinkles, piped rosettes, strawberries, chocolate curls) placed from a set we've drawn, snapping to sensible positions; every combination looks good by construction. Think Nike By You, not MS Paint. Each choice is one or two small numbers in the link.

- **v1 (launch):** frosting colour, filling colour, candle colour. Three dropdowns, three numbers.
- **v2:** the decorator proper, launched with its own video once people have cakes to compare against. The choice set to build toward: **candle style** (plain / striped / spiral / tapered / number candles / sparklers), **confetti colour** (or themed sets), **background colour** (currently derived from the frosting — letting the sender set it changes the whole feel of a cake for no rendering cost), alongside the decorations themselves.
- **Later tier:** square "Tray Bake" cut into a 12-square grid (different slicing animation and count), not a shape toggle.
- **Always:** the recipient is told. A line such as "Hollie decorated this cake herself", or the effort is invisible and the signal is wasted.

---

## 3. Why this can work

### 3.1 People already pay for exactly this feeling
The UK is the most card-obsessed country on earth. UK shoppers spent about £1.53bn on single greeting cards in 2024, roughly 782 million cards, and Kantar's research found 92% of UK households buy greeting cards, ahead of toothpaste and tea. Everyday cards (birthdays, occasions, blanks) are around three-quarters of that. This isn't a market we need to create.

The digital version is under-served at the *quality* end. Moonpig, the biggest UK card retailer, sells e-cards at 99p and physical cards at around £3.99 plus £2.49 postage. There is an empty space between "99p e-card that looks like clip art" and "£6.50 posted card" for a digital thing that feels like an actual present.

### 3.2 The loop
The rose app you read about works because it's a gift: the recipient discovers the product at the moment of maximum warmth. This cake goes one step further. One purchase produces up to nine exposures (recipient plus eight slice recipients), each in a private chat, each with a personal sender's name attached. That's the closest thing to word-of-mouth you can manufacture.

Working backwards from the target: £7,500 a month (about $10k) at £4.99 is roughly 1,700 cakes a month, or 57 a day. If 5% of slice recipients eventually send a cake, each cake generates 0.4 new cakes on its own. That doesn't make it self-sustaining (you'd need 1.0) but it cuts the paid/organic acquisition needed by 40%. The number to watch from day one is **slice-to-cake conversion**.

### 3.3 Why a designer wins here
Every competitor found in research (section 4) is built by developers. The cakes look like clip art, the sites are covered in ads and cookie banners, the reveal moments are flat. The entire value of this product is in the two seconds after the last candle goes out. That is craft, not code. Nobody in this category is competing on craft.

### 3.4 Timing
- Stripe's merchant-of-record product went into public preview in early 2026, and Lemon Squeezy (now part of Stripe) has been doing the same for years. A UK solo seller can sell digital goods to the EU, US, Australia etc. and have VAT/sales tax handled from the first sale (section 7).
- Building in September gives a Christmas launch window, which for cakes is the second-biggest occasion of the year.

### 3.5 Gift psychology: why it must cost money, and why cost must be visible
A gift's value to the recipient comes partly from what it cost the giver, in money or in effort, and a gift with no practical use signals the relationship even more clearly because there's no other reason to have bought it (economists call these costly signals). Reddit Gold, Twitch bits, Super Chats and TikTok's gift ladder (from a 1-coin rose up to a ~$500 "Universe") are all people paying real money to hand someone a token with no intrinsic value. The payment is the gift. A free digital cake is a GIF; a paid one is a gesture.

Consequences:
- **No sendable free tier.** If a free version exists, every recipient wonders whether theirs was free, and the brand drops to "probably free".
- **Cost must be legible without being crass.** Nobody prints the price on a gift, but everyone knows roughly what a Moonpig card costs. Tiers carry the signal: a Two-tier looks unmistakably grander than a Classic, has more slices, and has a name the recipient sees ("Hollie sent you a Showstopper"). A public prices page lets anyone look it up. The price never appears on the cake.
- **Effort stacks with cost.** Sender decoration (2.6) adds the second signal, and the IKEA effect works on the sender too: someone who has spent three minutes on a cake converts harder at checkout and shows it off more afterwards.
- **Flex tiers exist for the top few percent.** Digital gifting revenue everywhere is whale-shaped; a small share of buyers produces a large share of revenue. The most expensive cake sells rarely, makes the mid tier look reasonable, gets screenshotted, and produces the most slices, so it markets itself.

---

## 4. Competitors

### 4.1 Direct: "send a virtual cake link" (all found live, Sept 2026)

| Product | What it is | Price | What they do well | Where they're weak |
|---|---|---|---|---|
| **gifft.me** | Free "virtual gift" links since 2017: gift box, love letter, birthday cake, scratch-to-reveal, seasonal (Christmas tree, Halloween, Eid, Easter). Cake has vibes, photo upload, mic blow-out, message reveal. Available in ~20 languages. | Free with ads; ad-free subscription. | Breadth of occasions, SEO ("free virtual birthday cake" is theirs), multilingual, gifts saved to a feed. The closest thing to the whole idea. | Ad-supported (so the recipient experience is compromised), video-based cakes, no 3D, no slice loop, no cutting, "gift feed" and accounts add friction. Feels like a content farm. |
| **birthday-cake.online** | Browser cake with configurable scene, mic blow-out, shareable link that stores settings. | Free. | Link-carries-state approach (same as ours). Sensible two-use-case framing (in-room and remote). | Utility aesthetic, no monetisation, no loop. |
| **Birthday Cake – Blow out Candles** (iOS, Cemal Onur Tokoglu) | App: custom cakes, up to 70 candles, send cakes + recorded voice message to friends. | Free w/ IAP. | Voice message on a cake is a nice feature. Reviews literally ask for more candles ("my dad turned 80"). | App install required on both ends, dated design, capped candles. |
| **Birthday Candle Blowout** (Android), **Blow out the Birthday Candles** (iOS), various | In-room candle simulators; number candles 0–99, photo, mic. | Free w/ IAP. | Prove demand for "blow out candles on a phone". | Not gifts, not shareable, not pretty. |
| Various GitHub / CodePen demos | Open-source mic cake toys. | Free. | Show the mic trick is well understood. | Toys. |

**Takeaway:** the feature set already exists for free. The market has been tested and there's demand. Nobody has made it *beautiful*, nobody has 3D cutting, and nobody has the slice loop. That's the whole position.

### 4.2 Adjacent: group e-cards (who we'll be compared to on price)

| Product | Model | Price (2026) |
|---|---|---|
| Kudoboard (US) | Per-board or subscription | $5.99 Lite (20 posts), $8.99 Premium, $19.99 Milestone; business from ~$25/user/mo |
| Thankbox (UK) | Per-card + money collection fee | £4.99 standard, £8.99 premium; 1.1% + 17p on GBP contributions |
| GroupTogether | Per-card | $5.50, unlimited signers |
| ExpressWithACard (UK) | Per-card | From £3.99 |
| RecoCards | Single card / lifetime | ~$2.49 single |
| Moonpig e-card | Per-card | £0.99 |
| Paperless Post | Coins/freemium | ~$1–3 per digital card/invite |

These anchor what a UK buyer thinks a digital celebration should cost: **£1 for a flat e-card, £4–9 for something with effort in it.** We sit at the bottom of the second band.

### 4.3 The rose app pattern
Single object, one-time purchase, gift-driven discovery, seasonal spike. We copy the mechanism and add the loop. Expect the same shape of risk: copyable, spiky, dependent on one channel taking off.

### 4.4 Substitutes
A WhatsApp voice note. A GIF. A Moonpig card. Doing nothing. Most of our competition is "doing nothing", which is why the product has to be a delight to *send*, not just to receive.

---

## 5. Sharing via link

The link is the product's distribution, so every platform's link behaviour matters.

| Channel | Link clickable? | Preview? | Opens in | Notes |
|---|---|---|---|---|
| WhatsApp | Yes | Yes (Open Graph image/title) | Real Safari/Chrome | Primary channel in the UK. Mic works. |
| iMessage / SMS | Yes | Yes (rich link) | Safari | Mic works. |
| Email | Yes | No | Browser | Fine. Older relatives. |
| Facebook Messenger | Yes | Yes | **In-app browser** | Mic often blocked; swipe fallback essential. |
| Instagram DM | Yes | Yes | **In-app browser** | Same. |
| Instagram post/comment | **No** — URLs in captions and comments are plain text (a paid-tier caption-link test was reported in March 2026) | — | — | Stories link sticker and bio link only. Instagram is a *marketing* channel for demo videos, not a delivery channel. |
| TikTok | Bio link only (business accounts) | — | — | Same: demos, not delivery. |
| Reddit / Discord / Slack / Teams | Yes | Yes | Browser | Office and community use. Slack/Teams unfurls are good for a "cake in the team channel". |
| Facebook post | Yes | Yes | In-app browser | "Happy birthday Nan" wall posts. |

Design consequences:
- **Swipe-to-blow is the primary path; mic is the bonus.** In-app browsers will break mic constantly.
- **One static Open Graph image** for all cakes (per-cake previews need a server). Make it a gorgeous cake with "Someone sent you a cake 🎂".
- **Short domain.** Links carry the whole cake in the hash; a long domain plus a long hash looks like spam. Target: `domain.tld/#c=...` under ~120 characters total for a typical cake.
- **Links must work forever.** No expiry, no "gift feed", nothing that can be deleted by us. Version the schema (`v:1`) so old links still render after redesigns.
- **Instagram and TikTok are where the demo videos live.** The share moment (candles going out, slice lifting) is 8 seconds long and vertical. That's the entire content strategy.

---

## 6. Monetisation and pricing

### 6.1 Model
One-time purchase per cake, priced by tier. No accounts, no subscriptions, no sendable free version. Slices are always free.

### 6.2 Tiers
Price scales with slices, so the expensive cakes produce more marketing as well as more revenue.

| Tier | Cake | Slices | GBP | USD | EUR |
|---|---|---|---|---|---|
| **Classic** | Single, one skin per occasion | 8 | £4.49 | $5.99 | €5.49 |
| **Two-tier** | Two tiers, ribbon | 16 | £9.99 | $12.99 | €11.99 |
| **Showstopper** | Three tiers, sparklers | 24 | £24.99 | $32.99 | €29.99 |
| **The Absurd** | Five tiers, fireworks, gold leaf, 100-candle option | 48 | £99 | $129 | €119 |

MVP launches with **Classic and Two-tier only**: enough to establish that cakes have prices and to see whether anyone buys up. Showstopper and The Absurd follow post-launch, each with its own video. The Absurd sells rarely; it exists to be screenshotted, to make £24.99 look reasonable, and to give the few people who love flexing a way to do it.

Reasoning on the base price:
- Under Thankbox (£4.99) and Kudoboard ($5.99), above Moonpig e-cards (99p). "Less than a posted card, more than a text."
- Fees on small tickets are brutal, which pushes the floor up. With a merchant of record at 5% + $0.50 per transaction (Lemon Squeezy's published rate), approximate take on a £3.99 sale is ~14%, on £4.49 ~13%, on £9.99 ~9%, on £24.99 ~7%. Below £3 the fixed fee eats the product. Tiers fix this by lifting average order value.
- Gift purchases are emotionally priced, not rationally. £4.49 vs £3.99 barely changes conversion; it changes revenue by 12%.
- Test £3.99 and £4.99 for the Classic in the first two months; leave the upper tiers alone until there's volume.

### 6.3 Bundles (from month 2)
- **3 Classics for £9.99** ("birthday season")
- **10 Classics for £24.99** (the office card-runner)
Bundles pull the habit forward. Delivered as a code the buyer redeems in the builder (needs a tiny amount of state: a code list checked client-side against a hashed list in the repo, updated via the GitHub web editor. Not secure. Doesn't need to be.)

### 6.4 What's free
- Previewing your own cake in the builder, fully, before paying.
- Every slice.
- Nothing that can be sent as a gift. (The free "cupcake" idea was dropped for the reasons in 3.5.)

### 6.5 Upsells (later)
- Premium decorations in the decorator (+£1): gold leaf, edible flowers, a photo-print topper once storage exists.
- Voice message under the candles (+£1): the iOS competitor proves people want this. Needs storage, so it's the first feature that needs a backend. Defer.
- Occasion-specific premium skins (+£1): tiered wedding cake, personalised photo on the frosting.
- Scheduled delivery: not possible without a server. Defer.

### 6.6 What not to do
- Ads. Kills the recipient moment, which is the product.
- Subscriptions for consumers. Nobody subscribes to cake.
- Any sendable free cake, watermarked or otherwise. It trains people that the free one is fine and makes every paid cake look possibly free.
- Printing the price on the cake. Tier names and a prices page carry the signal.

---

## 7. International from day one

### 7.1 Payments and tax
Use a **merchant of record** (Lemon Squeezy, or Stripe Managed Payments once it's out of preview and available to UK sellers). The MoR is the legal seller: they charge the right VAT/sales tax in each country, file it, handle refunds and chargebacks, and pay you out. Cost is roughly 5% + $0.50 per sale versus ~1.5–3% on plain Stripe, but plain Stripe makes *you* responsible for VAT in every country you sell to. The EU requires VAT on digital services to consumers from the first sale, with no threshold for a non-EU seller. For a £4 product sold to Germany, that admin is not worth doing yourself. (Not tax advice; confirm with an accountant when revenue is real.)

UK-specific: the UK VAT registration threshold is £90k, so you won't charge UK VAT on UK sales until you're well past the target. Register as a sole trader with HMRC once trading income passes £1,000 in a tax year.

### 7.2 Currency and price display
MoR checkouts localise currency automatically. Set prices per major currency rather than letting them float: £4.49 / $5.99 / €5.49 / AU$8.99 / CA$7.99.

### 7.3 Localising the product (cheap wins)
- Occasion prompts by country: Mother's Day date (UK March vs US/AU May), Thanksgiving (US/CA), Boxing Day.
- Copy strings in a single JSON so languages can be added later. English only at launch. gifft.me's 20 languages are a moat you can't match quickly and don't need to.
- Date formats don't matter (nothing is dated).
- Names with accents and non-Latin scripts must render on the cake: test the canvas text with "Zoë", "Søren", "Müller", and emoji.

### 7.4 Legal minimums
- Terms, privacy notice, refund policy (MoR usually requires these and often provides templates).
- Privacy is a genuine selling point: **we store nothing**. No names, no messages, no recipients. The cake lives in the link. Say so on the site.

---

## 8. Names

Criteria: short (it's in every link), says cake or slice or candle, spellable when heard, available as a .com or a clean .co.uk/.co, and not adjacent to "gifft". Most single-word .coms are taken; check every one. Ordered by preference.

1. **Slice** / **Sendslice** — the loop is the name. `sendslice.com`, `slice.gift`.
2. **Piece of Cake** — `pieceofcake.gift` / `pieceof.cake` (only if a real TLD; check). Instantly memorable, slightly long.
3. **Cakefor** — `cakefor.co` reads as a sentence in a link: `cakefor.co/#hollie`.
4. **Blowout** — the moment. `blowout.gift`. Risk: hair salons.
5. **Candlelit** — soft, occasion-agnostic, works for Christmas and anniversaries.
6. **Cakelink** — literal, boring, available-sounding.
7. **Wishcake** — "make a wish". Slightly twee.
8. **Cut the Cake** — `cutthe.cake` if the TLD exists, else `cutthecake.co`.
9. **Eight Slices** — quirky, tells the story, long.
10. **Cakepost** — echoes Moonpig/Paperless Post, UK-flavoured.

Recommendation: go for **Slice** if any decent domain exists, otherwise **Cakefor**. Register .com and .co.uk of whichever you pick, plus the obvious typo.

Don't use eddiedemo.com for this. It needs its own short domain, and you've said you'd rather keep the venture separate for now.

---

## 9. Go-to-market

### 9.1 Phase A: UK, birthdays, organic (launch → month 2)
- Launch the moment Phase 5 of the build plan is done. Don't wait for Christmas skins.
- **Ten vertical demo videos** in the can before launch: candles going out by breath, the slice lifting, the 100-candle cake, a cake for a dog. Post one a day on TikTok, Instagram Reels, YouTube Shorts. Caption is always "send one: [link in bio]".
- Send a cake to everyone you know with a birthday in the first month. Ask for the screen recording.
- Reddit: r/InternetIsBeautiful, r/SideProject, r/webdev (the "no database, whole cake in the URL" angle is catnip there), r/CasualUK. One post each, honest, not salesy.
- Product Hunt: fine, low expectations. Indie Hackers: the no-server story.
- The site itself: one page, the builder, a demo cake link above the fold. No blog, no "about".

### 9.2 Phase B: Christmas (Nov–Dec)
- Christmas cake skin live by 15 Nov. Copy: "Send the family a Christmas cake. Everyone gets a slice."
- The family-group-chat use case is the Christmas pitch: one cake, eight slices, Nan gets one.
- 3-cake bundle launches here (people send several at Christmas).

### 9.3 Phase C: Valentine's and Mother's Day (Feb–Mar)
- Heart cake. Victoria sponge for Mother's Day (UK 15 March 2027). Two of the biggest single days for cards in the UK.

### 9.4 Phase D: offices (month 4+)
- 10-cake bundle, a "cake in the Slack channel" demo, leaving/retirement/new-job skins. This is where Thankbox and Kudoboard live, so it's slower, but it's weekday volume.

### 9.5 SEO reality
gifft.me owns "free virtual birthday cake" and has since 2017. Don't fight that head-on. Own the long tail instead: "send a virtual christmas cake", "digital cake with candles you can blow out", "send someone a slice of cake". A "how it works" page with an embedded demo cake is the SEO asset; there is no free cake to land on, and that's deliberate.

### 9.6 Press angle (UK)
"Bristol designer builds a birthday cake you can blow out through your phone, and it has no servers." Local press (Bristol Post, Bristol24/7), design press (It's Nice That, Creative Boom — the craft angle), and UK tech (The Register likes a no-database story). Worth one afternoon of emails at launch.

---

## 10. The numbers

### 10.1 Unit economics (at £4.49, MoR fees)
| | Per cake |
|---|---|
| Price | £4.49 |
| MoR fee (~5% + ~£0.38) | ~£0.60 |
| Hosting, domain, incidentals | ~£0.02 |
| **Net** | **~£3.87** |

Gross margin ~86%. No COGS to speak of. Hosting on Firebase/GitHub Pages is pennies at this scale; three.js from a CDN is free.

### 10.2 What £7,500 a month needs
| Price | Net per cake | Cakes / month | Cakes / day |
|---|---|---|---|
| £3.99 | ~£3.41 | 2,200 | 73 |
| £4.49 | ~£3.87 | 1,940 | 65 |
| £4.99 | ~£4.36 | 1,720 | 57 |

Tiers change this materially. If 12% of buyers take the Two-tier, 3% the Showstopper and 0.5% The Absurd, average order value rises from £4.49 to roughly £6.30 and the target needs about 1,350 cakes a month instead of 1,940. Track tier mix from day one.

### 10.3 Scenarios (steady state, month 6+, excluding seasonal spikes)
| Scenario | Cakes / month | Monthly net | What it implies |
|---|---|---|---|
| Quiet | 200 | ~£770 | A nice side income; the loop didn't catch. Keep it running, cost is ~zero. |
| Working | 800 | ~£3,100 | Slice conversion 5%+, one channel producing steady demos. Add offices and bundles. |
| Target | 2,000 | ~£7,700 | The rose-app outcome. Needs one viral moment plus the loop. |
| Christmas month | 3–5× base | — | Plan for it; it's the best shot at the viral moment. |

### 10.4 Costs to launch
Domain (~£10–30), MoR account (free), hosting (free tier), a month of evenings. There is no financial downside to this beyond time.

### 10.5 The one number
**Slice-to-cake conversion**: of people who receive a slice, what fraction send a cake within 30 days. Track it with a UTM parameter on the slice page's CTA (`?src=slice`) and read it in the MoR dashboard or a privacy-friendly analytics tool (Plausible, Fathom). Under 3% after two months: the slice page copy or the product isn't landing; fix that before spending on anything else. Over 8%: pour everything into distribution.

---

## 11. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Nobody shares the demo videos; no spark.** | High | Ten videos ready before launch, posted daily for 30 days minimum. Seed with real birthdays. Judge only after 60 days. |
| **Copied in a weekend once it works.** | High if it works | Craft is the moat: skins, animation quality, occasion breadth. Move fast on occasions. Accept that this is a 12–24 month window, not a fortress. |
| **In-app browsers break the mic.** | Certain | Swipe is primary. Mic is a bonus. Never show an error. |
| **Abusive messages in URLs under your brand.** | Medium | Client-side word filter on the builder; "report this cake" link on every viewer that emails you the hash; a `blocklist.json` in the repo checked on load, editable via the GitHub web UI. |
| **Payment bypass** (anyone can craft a link without paying). | Certain, low impact | Soft gate. Don't fight it. If it ever matters, sign the hash with a small serverless function. |
| **Seasonality**: birthdays smooth it, but Christmas/Valentine's/Mother's Day dominate. | Medium | Price bundles into peaks; build occasion skins ahead of each peak. |
| **Low ticket, fixed fees.** | Certain | £4.49 floor, bundles, never sub-£3. |
| **gifft.me adds 3D and slices.** | Low-medium | They're ad-funded and broad; matching craft is not their model. If it happens, we're the premium one. |
| **Too many projects, this one stalls.** | High (historically) | The build plan is phased so every phase is shippable. Launch at Phase 5, not Phase 7. |

---

## 12. Milestones

Principle: **launch at MVP, then ship features into a live product.** MVP means minimum catalogue, finished moments. Links are versioned (`v:1`) from the first commit so nothing sent before an update ever breaks.

**MVP (what launch contains):** builder → link → viewer; birthday only; Classic and Two-tier; frosting/filling/candle colours; candles 0–100; swipe-to-blow with mic as a silent bonus; message reveal and confetti; cut, filling reveal, send slices, slice page; merchant-of-record checkout with a soft gate; one static link preview; a prices page; a "report this cake" link; the four moments tuned to the feel spec.

**Not in MVP, in the order they come back:** Christmas cake → Showstopper and Absurd tiers → the decorator → number candles, more skins, sound design pass → bundles and office occasions → anything needing a server.

| When | Milestone | Kill / continue test |
|---|---|---|
| Week 1 | Build plan Phase 0–2: a cake link that works on your phone | — |
| Week 2 | Phase 3–4: blow-out, filling reveal and slices working on three friends' phones; feel passes on moments 2–4 | Did anyone screen-record it unprompted? |
| Week 3 | Phase 5–6: polish, two tiers, payment; domain live; 10 demo videos filmed | — |
| Week 4 | **Launch** (UK, birthdays, MVP) | — |
| Launch + 2 wks | Showstopper tier, launched with its own video | — |
| Mid Nov | Christmas cake + 3-pack | — |
| Early Dec | The Absurd, launched as a stunt video | — |
| Mid Jan | Read the numbers: cakes/day, slice conversion, tier mix | <5 cakes/day organic and <3% slice conversion after 60 days of daily posting → pause and reconsider; anything better → continue |
| Feb | Valentine's heart cake; Mother's Day sponge; the decorator (2.6) | — |
| Month 4 | Office bundle, leaving/retirement skins, Tray Bake tier | — |
| Month 6 | Decide: voice messages / photos (first backend) or stay serverless | Based on user asks, not roadmap |

---

## 13. Open questions

- **Name and domain**: check availability for the top three today; the name affects the link, which affects everything.
- **Photo on the cake?** gifft.me and the iOS apps offer it. It's the most-requested personalisation in this category, but photos can't live in a URL. First feature that would need storage. Decide after launch based on requests.
- **Is 8 slices right for the Classic?** Test by watching how many slices actually get sent in month one. Upper tiers scale from whatever the Classic settles on.
- **Tier naming.** "Classic / Two-tier / Showstopper / The Absurd" is a placeholder set. The names are what the recipient sees, so they carry the cost signal; worth an hour.
- **Does a decorated cake get a visible mark?** ("Hollie decorated this herself".) Yes in principle; decide the wording and placement when the decorator ships.

---

## 14. Sources consulted (Sept 2026)

- GCA Market Report 2025 coverage — Progressive Greetings (issuu, Oct 2025); gca.cards conference summary; pgbuzz.net 2024 report coverage
- Moonpig e-card FAQ (help.moonpig.com) — e-cards £0.99
- gifft.me/create/virtual-birthday-cake — feature set, pricing, occasions
- birthday-cake.online — feature set
- App Store: "Birthday Cake – Blow out Candles" (Cemal Onur Tokoglu); "Blow out the Birthday Candles"; Google Play: "Birthday Candle Blowout"
- GitHub: sherryuser/cake-blow; cnmeow/bdcake
- Kudoboard pricing — Capterra, RecoCards blog, checkthat.ai (2026)
- Thankbox pricing — thankbox.com/pricing, givetastic.com, wishwarmly.com (2026)
- GroupTogether, ExpressWithACard, RecoCards pricing pages/blogs (2026)
- Lemon Squeezy merchant-of-record pages and "2026 Update: Lemon Squeezy + Stripe Managed Payments" (Jan 2026)
- solobuild.io, getstacksmart.com, globalsolo.global — Stripe vs Lemon Squeezy vs Paddle fee comparisons (2026)
- inro.social, socialbeat.io, ai-ap.com — Instagram link behaviour and the March 2026 caption-link test
- Paperless Post pricing guides (2026)
- theswiftk.it.com — indie app revenue distribution (Sensor Tower data)

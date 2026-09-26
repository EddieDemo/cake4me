/* palettes.js — the DATA the cake is built from (v1.06, refactor step 2).
   Colour palettes, occasions, sponges, tier sizes and shape limits. Nothing here does anything:
   it's the tables the schema validates against and the builder shows. Add a colour or a sponge
   here, and both pick it up. */
(function () {
  var PALETTES = {
    frosting: [
      { name: 'Strawberry', hex: 0xF7A8C1 },
      { name: 'Vanilla',    hex: 0xFFF1D6 },
      { name: 'Chocolate',  hex: 0x5A3826 },
      { name: 'Mint',       hex: 0xB9E4D0 },
      { name: 'Lemon',      hex: 0xFFE27A },
      { name: 'Lavender',   hex: 0xC9B8F0 },
      { name: 'Sky',        hex: 0xA9D8F5 },
      { name: 'Coral',      hex: 0xFF8A73 }
    ],
    candle: [
      { name: 'White',  hex: 0xFFFFFF },
      { name: 'Pink',   hex: 0xFF6F91 },
      { name: 'Yellow', hex: 0xFFD166 },
      { name: 'Blue',   hex: 0x4FC3F7 },
      { name: 'Purple', hex: 0x9B6BFF },
      { name: 'Gold',   hex: 0xE9C46A }
    ],
    // v1.31: number toppers' colours. The first follows the candles (as before v1.31, and the default).
    topper: [
      { name: 'Match candles', auto: true },
      { name: 'White',  hex: 0xFFFFFF },
      { name: 'Cream',  hex: 0xFFF1D6 },
      { name: 'Pink',   hex: 0xFF6F91 },
      { name: 'Coral',  hex: 0xFF8A73 },
      { name: 'Red',    hex: 0xE03131 },
      { name: 'Yellow', hex: 0xFFD166 },
      { name: 'Gold',   hex: 0xE9C46A },
      { name: 'Mint',   hex: 0x7ED3B2 },
      { name: 'Blue',   hex: 0x4FC3F7 },
      { name: 'Purple', hex: 0x9B6BFF },
      { name: 'Ink',    hex: 0x3B2A2A },
      // v1.37: metal-friendly tints (they're fine in wax too)
      { name: 'Rich gold', hex: 0xD8B25A },
      { name: 'Silver',    hex: 0xD9DCE0 },
      { name: 'Rose gold', hex: 0xE8A790 },
      { name: 'Champagne', hex: 0xF1D7A7 },
      { name: 'Copper',    hex: 0xC77B4A }
    ],
    filling: [
      { name: 'Raspberry',  layers: [0xD6336C] },
      { name: 'Lemon curd', layers: [0xFFD43B] },
      { name: 'Ganache',    layers: [0x3E2723] },
      { name: 'Pistachio',  layers: [0xA8D08D] },
      { name: 'Blueberry',  layers: [0x4C5FD5] },
      { name: 'Caramel',    layers: [0xC77B3B] },
      { name: 'Cream',      layers: [0xFFF3C4] },
      { name: 'Rainbow',    layers: [0xE63946, 0xF4A261, 0xFFD166, 0x52B788, 0x4C5FD5, 0x9B6BFF] }
    ],
    // Ribbons: the band round each upper tier and the bow on the gift box. These used to
    // borrow the candle colour, so you couldn't have white candles and a red ribbon. One
    // field covers both — they read as the same ribbon.
    // The cake itself (v0.74). Index 0 is the original vanilla so older links are unchanged.
    sponge: [
      { name: 'Vanilla',     hex: 0xE9C07A },
      { name: 'Chocolate',   hex: 0x6E4630 },
      { name: 'Red velvet',  hex: 0xA8403F },
      { name: 'Lemon',       hex: 0xF0D275 },
      { name: 'Matcha',      hex: 0xAABD74 },
      { name: 'Carrot',      hex: 0xC8894C },
      { name: 'Strawberry',  hex: 0xE9A7AE }
    ],
    ribbon: [
      { name: 'Pink',  hex: 0xFF6F91 },
      { name: 'Red',   hex: 0xE03131 },
      { name: 'Gold',  hex: 0xE9C46A },
      { name: 'Cream', hex: 0xFFF1D6 },
      { name: 'Sage',  hex: 0x9BBF9B },
      { name: 'Blue',  hex: 0x4FC3F7 },
      { name: 'Plum',  hex: 0x8E5A9B },
      { name: 'Ink',   hex: 0x3B2A2A },
      { name: 'White', hex: 0xFFFFFF }          // appended: indices in existing links are unchanged
    ],
    // Message colour. Index 0 keeps the old behaviour: dark or light picked from the
    // frosting's luminance. Everything after it is an explicit choice.
    text: [
      { name: 'Auto',  auto: true },
      { name: 'Ink',   hex: 0x3B2A2A },
      { name: 'White', hex: 0xFFFAF0 },
      { name: 'Gold',  hex: 0xE9C46A },
      { name: 'Red',   hex: 0xE03131 },
      { name: 'Pink',  hex: 0xFF6F91 },
      { name: 'Blue',  hex: 0x2F6FB5 },
      { name: 'Green', hex: 0x3E7B55 },
      { name: 'Plum',  hex: 0x8E5A9B }
    ],
    // Background gradients. Index 0 is the legacy behaviour (derived from the frosting),
    // kept so every link sent before v0.16 renders exactly as it did. Everything else is
    // a deliberate choice, because a backdrop that matches the cake washes it out.
    // One paint colour each. The world is a single featureless plane (stage.js), so the
    // "sky" is the same paint receding into the distance — there is no second colour.
    // (`layers` is kept for the swatch preview: a slightly lighter top hints at depth.)
    background: [
      { name: 'Match the cake', auto: true },
      { name: 'Cream',     floor: 0xFFEBD2, layers: [0xFFF6E9, 0xFFE7CE] },
      { name: 'Warm grey', floor: 0xE1DBD2, layers: [0xF2EFEA, 0xDCD6CE] },
      { name: 'Blush',     floor: 0xF9DDE6, layers: [0xFFEDF2, 0xF7D9E3] },
      { name: 'Sky',       floor: 0xC9E3F7, layers: [0xDFF1FF, 0xBFDFF5] },
      { name: 'Mint',      floor: 0xCBE9DB, layers: [0xE4F6EE, 0xC2E6D6] },
      { name: 'Dusk',      floor: 0x453E6B, layers: [0x6E6597, 0x3B3560] },
      { name: 'Midnight',  floor: 0x161C33, layers: [0x24304A, 0x11162A] },
      { name: 'Ink',       floor: 0x18131C, layers: [0x2A2430, 0x141018] },
      { name: 'White',     floor: 0xFFFFFF, layers: [0xFFFFFF, 0xF4F4F4] }   // appended: indices unchanged
    ]
  };
  var OCCASIONS = [
    { name: 'Birthday',        emoji: '🎂', rule: { type: 'yearly' },                     say: 'birthday' },
    { name: 'Christmas',       emoji: '🎄', rule: { type: 'fixed', m: 12, d: 25 },          say: 'Christmas' },
    { name: 'Anniversary',     emoji: '💍', rule: { type: 'yearly' },                     say: 'anniversary' },
    { name: 'New baby',        emoji: '🍼', rule: { type: 'becomes', into: 'first birthday' }, say: 'first birthday' },
    { name: 'Wedding',         emoji: '💒', rule: { type: 'becomes', into: 'anniversary' }, say: 'anniversary' },
    { name: "Valentine's",     emoji: '❤️', rule: { type: 'fixed', m: 2, d: 14 },           say: "Valentine's" },
    { name: "Mother's Day",    emoji: '🌷', rule: { type: 'none' } },
    { name: "Father's Day",    emoji: '👔', rule: { type: 'weekday', m: 6, wd: 'SU', n: 3 }, say: "Father's Day" },
    { name: 'Get well',        emoji: '🩹', rule: { type: 'none' } },
    { name: 'Congratulations', emoji: '🎉', rule: { type: 'none' } },
    { name: 'Thank you',       emoji: '🙏', rule: { type: 'none' } },
    { name: 'Just because',    emoji: '✨', rule: { type: 'none' } },
    { name: 'Graduation',      emoji: '🎓', rule: { type: 'none' } },
    { name: 'Leaving',         emoji: '👋', rule: { type: 'none' } },
    { name: 'Halloween',       emoji: '🎃', rule: { type: 'fixed', m: 10, d: 31 },          say: 'Halloween' },
    { name: 'New Year',        emoji: '🥂', rule: { type: 'fixed', m: 1, d: 1 },            say: 'New Year' }
  ];
  var SPONGES = [
    { name: 'Classic vanilla', crumb: 0xFBE3A1, crust: 0xD8883A, detail: 'plain' },
    { name: 'Honey sponge',    crumb: 0xF6D588, crust: 0xBF6A27, detail: 'plain' },
    { name: 'Butter sponge',   crumb: 0xFFEDB8, crust: 0xE6A24E, detail: 'plain' },
    { name: 'Lemon',           crumb: 0xFAE59A, crust: 0xD9963E, detail: 'lemon' },
    { name: 'Chocolate',       crumb: 0x7B5238, crust: 0x4B2E1E, detail: 'tight' },
    { name: 'Coffee',          crumb: 0xC0936A, crust: 0x8A5634, detail: 'plain' },
    { name: 'Red velvet',      crumb: 0x9C3F36, crust: 0x6A2A25, detail: 'velvet' },
    { name: 'Carrot',          crumb: 0xD6A873, crust: 0x9A5F31, detail: 'carrot' },
    { name: 'Matcha',          crumb: 0xB9B97C, crust: 0x8E7E4A, detail: 'plain' }
  ];
  var SC_TO_SP = [0, 4, 6, 3, 8, 7, 2];               // vanilla, chocolate, red velvet, lemon, matcha, carrot, strawberry → butter
  var TIERS = {
    1: [ { r: 2.2, h: 1.6 } ],                                                  // bottom tier first
    2: [ { r: 2.5, h: 1.5 }, { r: 1.45, h: 1.3 } ],
    3: [ { r: 2.7, h: 1.4 }, { r: 1.95, h: 1.2 }, { r: 1.2, h: 1.0 } ]
  };
  var SHAPE = { rMin: 0.9, rMax: 2.7, hMin: 0.6, hMax: 2.0, steps: 10, ledge: 0 };   // ledge 0: a tier may be exactly as wide as the one below
  window.CakePalettes = { PALETTES: PALETTES, OCCASIONS: OCCASIONS, SPONGES: SPONGES, SC_TO_SP: SC_TO_SP, TIERS: TIERS, SHAPE: SHAPE };
})();

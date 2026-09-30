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
    // v1.49: FILLINGS BY TYPE — kind 0 Creamy (buttercreams: satin, the icing's own kind of
    // material), 1 Glossy (jams and curds: glassy, glowing a little from within), 2 Rich (ganaches
    // and caramels: dense, glass-smooth). One list, so the link's preset index says the type too.
    filling: [
      { name: 'Vanilla',          layers: [0xF3E3BF], kind: 0 },
      { name: 'Swiss meringue',   layers: [0xFFF8EE], kind: 0 },
      { name: 'Chocolate',        layers: [0x6B4632], kind: 0 },
      { name: 'Coffee',           layers: [0xB08462], kind: 0 },
      { name: 'Strawberry',       layers: [0xF4A7B9], kind: 0 },
      { name: 'Lemon',            layers: [0xF7E08A], kind: 0 },
      { name: 'Pistachio',        layers: [0xC5D8A4], kind: 0 },
      { name: 'Salted caramel',   layers: [0xD9A36B], kind: 0 },
      { name: 'Cream cheese',     layers: [0xFBF1E1], kind: 0 },
      { name: 'Lavender',         layers: [0xCDB8E6], kind: 0 },
      { name: 'Rainbow',          layers: [0xE63946, 0xF4A261, 0xFFD166, 0x52B788, 0x4C5FD5, 0x9B6BFF], kind: 0 },
      { name: 'Raspberry',        layers: [0xB3122E], kind: 1 },
      { name: 'Strawberry',       layers: [0xD7263D], kind: 1 },
      { name: 'Cherry',           layers: [0x8E1330], kind: 1 },
      { name: 'Blackcurrant',     layers: [0x4A1036], kind: 1 },
      { name: 'Blueberry',        layers: [0x3B2F7A], kind: 1 },
      { name: 'Apricot',          layers: [0xF2A03D], kind: 1 },
      { name: 'Orange marmalade', layers: [0xE8751A], kind: 1 },
      { name: 'Lemon curd',       layers: [0xF6D23A], kind: 1 },
      { name: 'Passion fruit',    layers: [0xF7B21B], kind: 1 },
      { name: 'Lime',             layers: [0x9CC43B], kind: 1 },
      { name: 'Dark chocolate',   layers: [0x3A1D12], kind: 2 },
      { name: 'Milk chocolate',   layers: [0x6B3E26], kind: 2 },
      { name: 'White chocolate',  layers: [0xF1E6CF], kind: 2 },
      { name: 'Ruby chocolate',   layers: [0xB0485E], kind: 2 },
      { name: 'Salted caramel',   layers: [0xB5651D], kind: 2 },
      { name: 'Dulce de leche',   layers: [0xC48A4B], kind: 2 },
      { name: 'Hazelnut',         layers: [0x5C3A24], kind: 2 },
      { name: 'Coffee',           layers: [0x4B2E20], kind: 2 },
      { name: 'Biscoff',          layers: [0xA0612F], kind: 2 },
      { name: 'Matcha',           layers: [0x7E9A4E], kind: 2 }
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
  // v1.44: REAL SIZES. One unit is 4.2 cm (the Classic is an 8-inch cake). Widths are cake-tin
  // sizes, 3–9 inches (the tier's cake, before its icing); heights are tier depths in half inches.
  // (Radius in units = inches × 2.54 / 4.2 / 2; height = inches × 2.54 / 4.2.)
  var TIERS = {
    1: [ { r: 2.42, h: 1.51 } ],                                                // 8 in × 2½ in — bottom tier first
    2: [ { r: 2.42, h: 1.51 }, { r: 1.51, h: 1.21 } ],                          // 8 in + 5 in
    3: [ { r: 2.72, h: 1.51 }, { r: 1.81, h: 1.21 }, { r: 1.21, h: 0.91 } ]    // 9 in + 6 in + 4 in
  };
  // v1.47: tins up to 10 and 12 inches, tiers up to 4, 5 and 6 inches deep (a "double barrel").
  var SHAPE = { cmPerUnit: 4.2, tinsIn: [3, 4, 5, 6, 7, 8, 9, 10, 12], depthsIn: [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6],
                rMin: 0.907, rMax: 3.629, hMin: 0.605, hMax: 3.629, steps: 9, ledge: 0 };   // ledge 0: a tier may be exactly as wide as the one below
  window.CakePalettes = { PALETTES: PALETTES, OCCASIONS: OCCASIONS, SPONGES: SPONGES, SC_TO_SP: SC_TO_SP, TIERS: TIERS, SHAPE: SHAPE };
})();

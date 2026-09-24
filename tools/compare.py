#!/usr/bin/env python3
"""Compare two render folders: prints the fraction of pixels that changed per cake, and writes a
   side-by-side sheet. usage: python3 tools/compare.py <before-folder> <after-folder> <sheet.png>"""
import sys, os
from PIL import Image, ImageChops
a, b, sheet = sys.argv[1], sys.argv[2], sys.argv[3]
names = sorted(n[:-4] for n in os.listdir(a) if n.endswith('.png'))
tiles = []
for n in names:
    pa, pb = os.path.join(a, n + '.png'), os.path.join(b, n + '.png')
    if not os.path.exists(pb): print('%-22s missing in after' % n); continue
    ia, ib = Image.open(pa).convert('RGB'), Image.open(pb).convert('RGB')
    d = ImageChops.difference(ia, ib).convert('L').point(lambda v: 255 if v > 24 else 0)
    changed = sum(1 for v in d.getdata() if v) / (d.width * d.height)
    print('%-22s %5.2f%% of pixels changed' % (n, changed * 100))
    w, h = ia.size; ch = int(h * 0.5)
    tiles.append((n, ia.crop((0, int(h * 0.05), w, int(h * 0.05) + ch)), ib.crop((0, int(h * 0.05), w, int(h * 0.05) + ch))))
if tiles:
    w, h = tiles[0][1].size
    out = Image.new('RGB', (w * 2 + 10, (h + 10) * len(tiles)), 'white')
    for i, (n, ia, ib) in enumerate(tiles): out.paste(ia, (0, i * (h + 10))); out.paste(ib, (w + 10, i * (h + 10)))
    out = out.resize((out.width // 3, out.height // 3)); out.save(sheet)

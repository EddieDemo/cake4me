#!/usr/bin/env python3
"""Render every golden cake headlessly (builder view + recipient link, plus a cut slice) to PNGs.
   usage: python3 tools/render.py <app-folder> <out-folder>
   Needs playwright (pip install playwright && playwright install chromium). This is Claude's
   harness; it runs where there's a terminal, not on the phone."""
import sys, os, json, threading, http.server, socketserver, functools, time
from playwright.sync_api import sync_playwright
app, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
G = json.load(open(os.path.join(os.path.dirname(__file__), 'golden_links.json')))
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=app); Handler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
srv = Q(('127.0.0.1', 0), Handler); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
CAM = G['camera']
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True)
    page = ctx.new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)[:200]))
    page.goto(f'http://127.0.0.1:{port}/index.html?freeze=1', timeout=300000); page.wait_for_timeout(2500)
    for name, cfg in G['cakes'].items():
        cfg = dict(G.get('base', {}), **cfg)
        # start from the full default cake, not the random one the page loaded with — otherwise
        # whatever the golden config doesn't mention (shape, filling, colours) is random
        page.evaluate("cake.set(cake.decode(cake.encode({})))")   # the light preset is in the link now (v1.14)
        page.evaluate("cake.set(%s); cake.rotate=false; cake.azimuth=%s; cake.elev=%s; cake.zoom=%s; cake.PIXEL.minSamples=1e9" % (json.dumps(cfg), CAM['azimuth'], CAM['elev'], CAM['zoom']))
        page.wait_for_timeout(2500)
        page.evaluate("cake.settle()"); page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(out, name + '.png'), timeout=250000)
        link = page.evaluate("cake.link()")
        with open(os.path.join(out, name + '.link.txt'), 'w') as f: f.write(link)
    print('errors:', errs or 'none')
    b.close()
srv.shutdown()

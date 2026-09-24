#!/usr/bin/env python3
"""Link compatibility: every saved link in tools/golden/*.link.txt must still decode to the same
   config after a change. usage: python3 tools/golden_check.py <app-folder>"""
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
app = sys.argv[1]; folder = os.path.join(os.path.dirname(__file__), 'golden')
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=app); Handler.log_message = lambda *a, **k: None
class Q(socketserver.TCPServer): allow_reuse_address = True
srv = Q(('127.0.0.1', 0), Handler); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
    page = b.new_page(); page.goto(f'http://127.0.0.1:{port}/index.html', timeout=300000); page.wait_for_timeout(1500)
    for fn in sorted(os.listdir(folder)):
        if not fn.endswith('.link.txt'): continue
        link = open(os.path.join(folder, fn)).read().strip().split('#c=')[-1]
        want = json.load(open(os.path.join(folder, fn.replace('.link.txt', '.json'))))
        got = page.evaluate("JSON.stringify(cake.decode(%s))" % json.dumps(link))
        got = json.loads(got)
        diffs = [k for k in want if json.dumps(want[k], sort_keys=True) != json.dumps(got.get(k), sort_keys=True)]
        print('%-28s %s' % (fn, 'ok' if not diffs else 'CHANGED: ' + ', '.join(diffs))); bad += bool(diffs)
    b.close()
srv.shutdown()
sys.exit(1 if bad else 0)

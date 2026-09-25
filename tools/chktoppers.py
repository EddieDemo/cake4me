import threading, http.server, socketserver, functools, json, base64
from playwright.sync_api import sync_playwright
Handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory='Cake-v1.23'); Handler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',0),Handler); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
def link(raw): return base64.urlsafe_b64encode(raw.encode()).decode().rstrip('=')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    out=[]
    for name,raw in [('toppers only','2|n=0|tn=30|te=1f346'),('toppers + 20 candles','2|n=20|tn=7|te=2764.1f984')]:
        pg=b.new_page(viewport={'width':390,'height':844}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto(f'http://127.0.0.1:{port}/index.html?freeze=1#c={link(raw)}', timeout=300000); pg.wait_for_timeout(2500)
        pg.evaluate("document.getElementById('open-cake') && document.getElementById('open-cake').click()")
        last=-1; st=0
        for k in range(30):
            pg.wait_for_timeout(500); n=pg.evaluate("cake.debug().lit"); st = st+1 if n==last else 0; last=n
            if st>=4: break
        lit=pg.evaluate("cake.debug().lit"); state=pg.evaluate("cake.debug().state")
        for k in range(40):
            if pg.evaluate("cake.debug().lit")==0: break
            pg.evaluate("cake.__breathe(0.8)"); pg.wait_for_timeout(400)
        pg.wait_for_timeout(2500)
        out.append('%s: lit %d (%s) → %d, then %s | errors %s' % (name, lit, state, pg.evaluate("cake.debug().lit"), pg.evaluate("cake.debug().state"), errs or 'none'))
        if name.startswith('toppers +'):
            pg.evaluate("cake.rotate=false; cake.azimuth=0; cake.elev=60"); pg.wait_for_timeout(1500); pg.screenshot(path='shots123_many.png', timeout=250000)
        pg.close()
    print(' || '.join(out))
    b.close()
srv.shutdown()

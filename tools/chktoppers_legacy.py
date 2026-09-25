import threading, http.server, socketserver, functools, json
from playwright.sync_api import sync_playwright
Handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory='Cake-v1.22'); Handler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',0),Handler); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
old=open('Cake-v1.22/tools/golden/numbers-sparklers.link.txt').read().strip().split('#c=')[-1]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':390,'height':844}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto(f'http://127.0.0.1:{port}/index.html#c={old}', timeout=300000); pg.wait_for_timeout(2500)
    mig=pg.evaluate("[cake.config.tn, cake.config.te, cake.config.n, cake.config.cm]")
    pg.evaluate("document.getElementById('open-cake') && document.getElementById('open-cake').click()")
    last=-1; st=0
    for k in range(40):
        pg.wait_for_timeout(500); n=pg.evaluate("cake.debug().lit"); st = st+1 if (n==last and n>0) else 0; last=n
        if st>=3: break
    lit0=pg.evaluate("cake.debug().lit")
    for k in range(40):
        pg.evaluate("cake.__breathe(0.8)"); pg.wait_for_timeout(400)
        if pg.evaluate("cake.debug().lit")==0: break
    print('old number-candle link → toppers', mig, '| recipient lit', lit0, '→ after breath', pg.evaluate("cake.debug().lit"), '| errors', errs or 'none')
    b.close()
srv.shutdown()

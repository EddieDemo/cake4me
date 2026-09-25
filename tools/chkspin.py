import threading, http.server, socketserver, functools, sys
from playwright.sync_api import sync_playwright
folder=sys.argv[1]
Handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=folder); Handler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',0),Handler); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
link=open(folder+'/tools/golden/fondant-rings.link.txt').read().strip().split('#c=')[-1]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':390,'height':844}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto(f'http://127.0.0.1:{port}/index.html#c={link}', timeout=300000); pg.wait_for_timeout(2500)
    pg.evaluate("document.getElementById('open-cake') && document.getElementById('open-cake').click()"); pg.wait_for_timeout(1500)
    a0=pg.evaluate("cake.azimuth"); pg.evaluate("cake.spin = 6"); pg.wait_for_timeout(1500)
    a1=pg.evaluate("cake.azimuth"); lit0=pg.evaluate("cake.debug().lit")
    pg.evaluate("cake.spin = 14"); pg.wait_for_timeout(3000)
    print(folder, '| spin moves the camera:', round(a1-a0,2), '| omega after 1.5s at 6:', '| lit before fast spin', lit0, '| lit after 3s at 14 rad/s:', pg.evaluate("cake.debug().lit"), '| errors', errs or 'none')
    b.close()
srv.shutdown()

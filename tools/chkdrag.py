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
    a0=pg.evaluate("cake.azimuth"); d0=pg.evaluate("cake.debug()")
    # a sideways flick
    pg.mouse.move(120,400); pg.mouse.down()
    for k in range(12): pg.mouse.move(120+k*18,400); pg.wait_for_timeout(16)
    pg.mouse.up(); pg.wait_for_timeout(400)
    d1=pg.evaluate("cake.debug()")
    # an upward drag (tilt)
    pg.mouse.move(200,500); pg.mouse.down()
    for k in range(10): pg.mouse.move(200,500-k*15); pg.wait_for_timeout(16)
    d2=pg.evaluate("cake.debug()"); pg.mouse.up(); pg.wait_for_timeout(300)
    print(folder, '| before', {k:d0[k] for k in ('azimuth','omega','elev')}, '| after flick', {k:d1[k] for k in ('azimuth','omega','elev')}, '| during tilt', {k:d2[k] for k in ('elev','dragging')}, '| errors', errs or 'none')
    b.close()
srv.shutdown()

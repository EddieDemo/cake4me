import threading, http.server, socketserver, functools, json
from playwright.sync_api import sync_playwright
Handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory='Cake-v1.25'); Handler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',0),Handler); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':390,'height':844}, device_scale_factor=2); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)[:150])); pg.on('console', lambda m: errs.append('C '+m.text[:120]) if m.type=='error' else None)
    pg.goto(f'http://127.0.0.1:{port}/index.html?freeze=1', timeout=300000); pg.wait_for_timeout(2500)
    pg.evaluate("cake.set(cake.decode(cake.encode({}))); cake.set({n:3, cs:0, sa:0, fdt:'1', fct:'1', bg:1, tn:'', te:'1f410.1f451.1f382'})"); pg.wait_for_timeout(4000)
    pg.evaluate("cake.rotate=false; cake.azimuth=0; cake.zoom=0.8; cake.PIXEL.minSamples=1e9; cake.settle()"); pg.wait_for_timeout(1200)
    pg.screenshot(path='shots125.png', timeout=250000)
    print('te', pg.evaluate("cake.config.te"), '| errors', errs or 'none', flush=True)
    b.close()
srv.shutdown()

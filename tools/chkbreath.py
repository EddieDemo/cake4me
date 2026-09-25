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
    pg.evaluate("document.getElementById('open-cake') && document.getElementById('open-cake').click()")
    last=-1; stable=0
    for k in range(40):                       # wait until every candle is lit and has stayed lit (blowing is enabled then)
        pg.wait_for_timeout(500)
        n=pg.evaluate("cake.debug().lit")
        stable = stable+1 if (n==last and n>0) else 0; last=n
        if pg.evaluate("cake.debug().state") == 'blow' and stable >= 3: break
    lit0=pg.evaluate("cake.debug().lit")
    enabled=pg.evaluate("(function(){ try { return cake.debug().state; } catch(e) { return '?'; } })()")
    
    for k in range(40):                       # a sustained breath, as the mic reports it (the software renderer runs few frames a second, so allow time)
        pg.evaluate("cake.__breathe(0.8)"); pg.wait_for_timeout(400)
        if pg.evaluate("cake.debug().lit") == 0: break
    print(folder, '| blow', pg.evaluate("cake.debug().blow"), '| state', enabled, '| lit before breath', lit0, '| after breathing', pg.evaluate("cake.debug().lit"), '| errors', errs or 'none')
    b.close()
srv.shutdown()

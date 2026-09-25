import threading, http.server, socketserver, functools, sys
from playwright.sync_api import sync_playwright
folder=sys.argv[1]
Handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=folder); Handler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',0),Handler); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
link=open(folder+'/tools/golden/two-tier-message.link.txt').read().strip().split('#c=')[-1]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    pg=b.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('console', lambda m: errs.append('C '+m.text[:120]) if m.type=='error' else None)
    # recipient: open, blow, cut, lift
    pg.goto(f'http://127.0.0.1:{port}/index.html?freeze=1#c={link}', timeout=300000); pg.wait_for_timeout(2500)
    pg.evaluate("document.getElementById('open-cake') && document.getElementById('open-cake').click()"); pg.wait_for_timeout(1500)
    pg.evaluate("cake.blowAll()"); pg.wait_for_timeout(1500)
    pg.evaluate("cake.startCut()"); pg.wait_for_timeout(1200); pg.evaluate("cake.liftFirst()"); pg.wait_for_timeout(1500)
    st=pg.evaluate("cake.cut && cake.cut()")
    print(folder, '| recipient cut state', st, '| errors', errs or 'none')
    b.close()
srv.shutdown()

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
    st=None
    # the slice page
    pg2=b.new_page(); e2=[]; pg2.on('pageerror', lambda e: e2.append(str(e)[:200]))
    pg2.goto(f'http://127.0.0.1:{port}/index.html?freeze=1#c={link}&s=3&b=1&n=Sam', timeout=300000); pg2.wait_for_timeout(9000)
    mode=pg2.evaluate("document.body.getAttribute('data-vstate')")
    print(folder, '| recipient cut state', st, '| slice page state', mode, '| errors', (errs+e2) or 'none')
    b.close()
srv.shutdown()

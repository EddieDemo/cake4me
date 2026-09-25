import threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
Handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory='Cake-v1.22'); Handler.log_message=lambda *a,**k: None
class Q(socketserver.TCPServer): allow_reuse_address=True
srv=Q(('127.0.0.1',0),Handler); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    page=ctx.new_page(); errs=[]; page.on('pageerror', lambda e: errs.append(str(e)[:200])); page.on('console', lambda m: errs.append('C '+m.text[:150]) if m.type=='error' else None)
    page.goto(f'http://127.0.0.1:{port}/index.html?freeze=1', timeout=300000); page.wait_for_timeout(2500)
    def tapchip(name): page.evaluate("var c=document.querySelector('.chip[data-tray=\"%s\"]'); c.scrollIntoView({inline:'center'});" % name); page.tap('.chip[data-tray="%s"]' % name); page.wait_for_timeout(400)
    out=[]
    tapchip('toppers'); page.evaluate("var a=document.getElementById('f-tn'); a.value='42'; a.dispatchEvent(new Event('input'))"); page.wait_for_timeout(1200); out.append('number=%s' % page.evaluate("cake.config.tn"))
    page.evaluate("var a=document.getElementById('f-te'); a.value='👀'; a.dispatchEvent(new Event('input'))"); page.wait_for_timeout(1200); out.append('emoji=%s' % page.evaluate("cake.config.te"))
    tapchip('candles'); page.tap('#candle-styles button[data-cs="1"]'); page.wait_for_timeout(1200); out.append('style=%s' % page.evaluate("cake.config.cs"))
    page.tap('#sparklers button[data-sk="1"]'); page.wait_for_timeout(1200); out.append('sparklers=%s' % page.evaluate("cake.config.sk"))
    tapchip('sprinkles'); page.evaluate("var a=document.getElementById('f-sa'); a.value='5'; a.dispatchEvent(new Event('input'))"); page.wait_for_timeout(1500); out.append('sprinkles=%s' % page.evaluate("cake.config.sa"))
    page.tap('#spr-roll'); page.wait_for_timeout(1200); out.append('roll=%s' % page.evaluate("cake.config.sr"))
    tapchip('light'); page.tap('#light-presets button:nth-child(4)'); page.wait_for_timeout(1200); out.append('light=%s elev=%s' % (page.evaluate("cake.config.lp"), page.evaluate("CakeLook.LOOK.keyDir.elevation")))
    page.evaluate("var s=document.querySelector('.chip[data-action=\"shuffle\"]'); s.scrollIntoView({inline:'center'});"); page.tap('.chip[data-action="shuffle"]'); page.wait_for_timeout(2000); out.append('shuffle ok')
    tapchip('message'); page.evaluate("var m=document.getElementById('f-m'); m.value='Hi Sam'; m.dispatchEvent(new Event('input'))"); page.wait_for_timeout(1500); out.append('message=%s' % page.evaluate("cake.config.m"))
    out.append('link has m: %s' % ('m=' in __import__('base64').urlsafe_b64decode(page.evaluate("cake.link().split('#c=')[1]")+'==').decode('utf8','ignore')))
    print(' | '.join(out), '| errors', errs or 'none')
    b.close()
srv.shutdown()

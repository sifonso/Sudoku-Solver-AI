#!/usr/bin/env python3
"""Packt einen Web-Export (expo export -p web, asyncRoutes aus) in eine einzige HTML-Datei:
Bundle inline, benötigte Schriften und Bilder als data:-URI. Optional werden Startdaten für den
Dienstplan als `globalThis.__DP_SEED__` eingesetzt (Personendaten, Ausgabe nicht ins Repo legen).

    python3 scripts/pack-single.py dist-single ausgabe.html [seed.json]
"""
import base64, glob, json, re, sys

USED_FONTS = ['BarlowSemiCondensed_600SemiBold.', 'BarlowSemiCondensed_700Bold.', 'Inter_400Regular.',
              'Inter_500Medium.', 'Inter_600SemiBold.', 'Inter_700Bold.']

def main(dist, out, seed=None):
    js = open(glob.glob(f'{dist}/_expo/static/js/web/entry-*.js')[0]).read()
    def rep(m):
        p = m.group(1)
        data = open(dist + p, 'rb').read()
        if p.endswith('.ttf'):
            if not any('/' + u in p for u in USED_FONTS):
                return '""'
            return '"data:font/ttf;base64,' + base64.b64encode(data).decode() + '"'
        return '"data:image/png;base64,' + base64.b64encode(data).decode() + '"'
    js = re.sub(r'"(/assets/[^"]+)"', rep, js).replace('</script', '<\\/script')
    # Der Rahmen erlaubt keine Adressänderung: History-Aufrufe abfangen, Router startet bei "/".
    shim = ('(function(){var h=window.history;["pushState","replaceState"].forEach(function(k){var o=h[k];'
            'h[k]=function(){try{return o.apply(h,arguments)}catch(e){}}});try{h.replaceState(null,"","/")}catch(e){}})();')
    seed_js = ''
    if seed:
        seed_js = '<script>globalThis.__DP_SEED__=' + json.dumps(json.load(open(seed)), ensure_ascii=False).replace('</', '<\\/') + ';</script>\n'
    html = f'''<title>Schichtplaner Demo</title>
<style>
:root{{--bg:#FFFFFF}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#1A1D2E}}}}
:root[data-theme="dark"]{{--bg:#1A1D2E}}
html,body{{height:100%}}
body{{overflow:hidden;background:var(--bg)}}
#root{{display:flex;height:100%;flex:1}}
</style>
<div id="root"></div>
{seed_js}<script>{shim}</script>
<script>{js}</script>
'''
    open(out, 'w').write(html)
    print(f'{out}: {len(html) / 1e6:.1f} MB')

if __name__ == '__main__':
    main(*sys.argv[1:4])

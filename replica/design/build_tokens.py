#!/usr/bin/env python3
"""tokens.json -> app/src/theme/tokens.ts und replica/design/tokens.css.
tokens.json ist die einzige Quelle. Nach jeder Änderung erneut ausführen:
    python3 replica/design/build_tokens.py
"""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, "..", ".."))
t = json.load(open(os.path.join(here, "tokens.json"), encoding="utf-8"))

def camel(k):
    p = k.split("-")
    return p[0] + "".join(x[:1].upper() + x[1:] for x in p[1:])

def strip(o):
    if isinstance(o, dict):
        return {camel(k): strip(v) for k, v in o.items() if not k.startswith("_")}
    return o

out = {k: strip(t[k]) for k in ("palette", "color", "font", "type", "space", "radius", "shadow", "motion", "size", "layout")}
ts = ("// Generiert aus replica/design/tokens.json mit build_tokens.py. Nicht von Hand ändern.\n"
      "export const tokens = " + json.dumps(out, indent=2, ensure_ascii=False) + " as const;\n\n"
      "export type ColorRole = keyof typeof tokens.color.light;\n"
      "export type TypeRole = keyof typeof tokens.type;\n")
p = os.path.join(root, "app", "src", "theme", "tokens.ts")
os.makedirs(os.path.dirname(p), exist_ok=True)
open(p, "w", encoding="utf-8").write(ts)

def block(cols):
    return "\n".join("  --color-%s: %s;" % (k, v) for k, v in cols.items())
css = ["/* Generiert aus tokens.json (build_tokens.py). Für Web-Seiten außerhalb der App. */",
       ":root {", block(t["color"]["light"]),
       "  --font-display: '%s', system-ui, sans-serif;" % t["font"]["display"],
       "  --font-sans: '%s', system-ui, sans-serif;" % t["font"]["sans"]]
css += ["  --radius-%s: %spx;" % (k, v) for k, v in t["radius"].items()]
css += ["  --space-%d: %spx;" % (i, v) for i, v in enumerate(t["space"])]
css += ["}", "@media (prefers-color-scheme: dark) {", "  :root:not([data-theme=\"light\"]) {",
        block(t["color"]["dark"]).replace("\n  ", "\n    ").replace("  --", "    --", 1), "  }", "}",
        ":root[data-theme=\"dark\"] {", block(t["color"]["dark"]), "}", ""]
open(os.path.join(here, "tokens.css"), "w", encoding="utf-8").write("\n".join(css))
print("tokens.ts + tokens.css geschrieben")

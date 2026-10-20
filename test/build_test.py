#!/usr/bin/env python3
"""Složi testnu verziju (za Artifact) iz public/index.html: sve isto, samo shim.js -> shim-test.js.
Upotreba: python3 test/build_test.py <izlazni_direktorij>"""
import re, sys, shutil, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
seed = sys.argv[2] if len(sys.argv) > 2 else None   # neobavezno: JSON sigurnosna kopija kao početni testni podaci (NE ide u git)
s = open(os.path.join(root, "public/index.html"), encoding="utf-8").read()
head = re.search(r"<head>(.*?)</head>", s, re.S).group(1)
body = re.search(r"<body[^>]*>(.*)</body>", s, re.S).group(1)
body_tag = re.search(r"<body([^>]*)>", s).group(1)
head = re.sub(r'<meta charset[^>]*>', '', head); head = re.sub(r'<meta name="viewport"[^>]*>', '', head)
head = re.sub(r'<link rel="(icon|apple-touch-icon)"[^>]*>', '', head)
head = head.replace("DPS Zagreb – oprema", "DPS oprema test", 1)
seed_tag = '<script src="seed-data.js"></script>' if seed else ''
body = body.replace('<script src="shim.js"></script>', seed_tag + '<script src="shim-test.js"></script>')
assert "shim-test.js" in body
body=body.replace("claude.use(","dpsApi.use(")
assert "claude.use(" not in body
# tijelo: klase s <body> prenosimo na omotač
m = re.search(r'class="([^"]*)"', body_tag); cls = m.group(1) if m else ""
page = '<meta name="claude:viewport-fit-sides" content="cover">\n' + head + '\n<script>document.body.className="' + cls + '"</script>\n' + body
open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(page)
for f in ["logo.png", "favicon.png"]: shutil.copy(os.path.join(root, "public", f), out)
shutil.copy(os.path.join(root, "test/shim-test.js"), out)
if seed:
    import json
    d = json.load(open(seed, encoding="utf-8"))
    open(os.path.join(out, "seed-data.js"), "w", encoding="utf-8").write("window.DPS_SEED=" + json.dumps(d, ensure_ascii=False) + ";")
print("OK", len(page))

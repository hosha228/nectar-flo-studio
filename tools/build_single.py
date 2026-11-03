"""Збирає сайт в один HTML-файл (стилі, скрипти й фото всередині).

Запуск з кореня проєкту:  python3 tools/build_single.py
Результат:                 dist/nectar-flo-studio.html  (+ архів вихідних файлів)
"""
import base64
import json
import os
import re
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
PHOTOS = os.path.join(ROOT, "assets", "photos")


def read(*p):
    with open(os.path.join(ROOT, *p), encoding="utf-8") as f:
        return f.read()


def b64(path, mime):
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode())


html = read("index.html")
css = read("assets", "css", "style.css")
data_js = read("assets", "js", "data.js")
main_js = read("assets", "js", "main.js")

# фото -> data URI (кожне один раз, у JS-мапі)
imgs = {}
for d, _, files in os.walk(PHOTOS):
    for n in sorted(files):
        if n.endswith(".jpg") and n != "og.jpg":
            full = os.path.join(d, n)
            imgs[os.path.relpath(full, PHOTOS)] = b64(full, "image/jpeg")

# шрифти -> data URI всередині CSS
fonts_css = read("assets", "fonts", "fonts.css")
fonts_css = re.sub(r"url\(\.\./fonts/([^)]+)\)", lambda m: "url(%s)" % b64(os.path.join(ROOT, "assets/fonts", m.group(1)), "font/woff2"), fonts_css)

# CSS: маска-лілія
css = css.replace('url("../img/lily.svg")', 'url("%s")' % b64(os.path.join(ROOT, "assets/img/lily.svg"), "image/svg+xml"))

# HTML: <img src="assets/photos/x.jpg"> -> data-nf="x.jpg" (src підставить скрипт)
html = re.sub(r'src="assets/photos/([^"]+)"', r'data-nf="\1"', html)
html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)
html = re.sub(r'\s*<meta property="og:image"[^>]*>', "", html)
html = re.sub(r'<link rel="stylesheet" href="assets/fonts/fonts.css[^"]*">', lambda m: "<style>\n" + fonts_css + "\n</style>", html)
html = html.replace('href="assets/img/favicon.svg"', 'href="%s"' % b64(os.path.join(ROOT, "assets/img/favicon.svg"), "image/svg+xml"))
html = re.sub(r'<link rel="stylesheet" href="assets/css/style.css[^"]*">', lambda m: "<style>\n" + css + "\n</style>", html)

# JS: фото беруться з мапи

boot = (
    "window.NF_IMG = " + json.dumps(imgs) + ";\n"
    "document.querySelectorAll('img[data-nf]').forEach(function (i) { i.src = NF_IMG[i.getAttribute('data-nf')]; });\n"
)
scripts = "<script>\n" + boot + "</script>\n  <script>\n" + data_js + "\n</script>\n  <script>\n" + main_js + "\n</script>"
html = re.sub(r'<script src="assets/js/data.js[^"]*"></script>\s*<script src="assets/js/main.js[^"]*"></script>', lambda m: scripts, html)
assert not re.search(r"(src|href)=\"assets/", html), "лишились зовнішні посилання на assets/"

os.makedirs(DIST, exist_ok=True)
out = os.path.join(DIST, "nectar-flo-studio.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)

# архів вихідних файлів для розробника
zpath = os.path.join(DIST, "nectar-flo-studio-source.zip")
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
    for rel in ["index.html", "README.md", "tools/build_single.py"]:
        z.write(os.path.join(ROOT, rel), "nectar-flo-studio/" + rel)
    for d, _, files in os.walk(os.path.join(ROOT, "assets")):
        for fn in files:
            if fn.startswith("."):
                continue
            full = os.path.join(d, fn)
            z.write(full, "nectar-flo-studio/" + os.path.relpath(full, ROOT))

print("%s  %.1f MB" % (out, os.path.getsize(out) / 1e6))
print("%s  %.1f MB" % (zpath, os.path.getsize(zpath) / 1e6))

"""Search Wikimedia Commons for candidate photos for each recipe and build contact sheets."""
import urllib.error, json, sys, os, urllib.request, urllib.parse, io, html, re
from PIL import Image, ImageDraw

UA = {"User-Agent": "FoodRecipeApp/1.0 (personal, non-commercial recipe PWA)"}
OUT = sys.argv[2]
recipes = json.load(open(sys.argv[1]))
N = 6

def get(url):
    import time
    for i in range(8):
        try:
            time.sleep(5)
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(45 * (i + 1))
    raise RuntimeError("rate limited: " + url)

def strip(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()

prev = {}
cpath = os.path.join(OUT, "candidates.json")
if os.path.exists(cpath): prev = json.load(open(cpath))
allc = prev
for r in recipes:
    if r["id"] in prev and os.path.exists(os.path.join(OUT, r["id"] + ".ok")): continue
    q = r["photo"]
    params = dict(action="query", format="json", generator="search", gsrsearch=f"filetype:bitmap {q}",
                  gsrnamespace=6, gsrlimit=15, prop="imageinfo", iiprop="url|extmetadata|size", iiurlwidth=330)
    d = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
    pages = sorted(d.get("query", {}).get("pages", {}).values(), key=lambda p: p["index"])
    cands = []
    for p in pages:
        ii = p["imageinfo"][0]; m = ii.get("extmetadata", {})
        lic = m.get("LicenseShortName", {}).get("value", "")
        if not re.search(r"CC|Public domain|PD", lic, re.I) or "NC" in lic: continue
        if ii.get("width", 0) < 600: continue
        cands.append(dict(title=p["title"], thumb=ii["thumburl"], page=ii["descriptionurl"], url=ii["url"],
                          license=lic, artist=strip(m.get("Artist", {}).get("value", ""))[:80]))
        if len(cands) == N: break
    allc[r["id"]] = cands
    # contact sheet
    sheet = Image.new("RGB", (N * 300, 260), "white"); dr = ImageDraw.Draw(sheet)
    for i, c in enumerate(cands):
        try:
            im = Image.open(io.BytesIO(get(c["thumb"]))).convert("RGB"); im.thumbnail((290, 230))
            sheet.paste(im, (i * 300 + 5, 25))
        except Exception as e:
            print("  thumb failed", c["title"], e, flush=True)
        dr.text((i * 300 + 5, 5), f"{i}", fill="red")
    dr.text((N*300-290, 245), r["id"], fill="black")
    sheet.save(os.path.join(OUT, r["id"] + ".jpg"), quality=70)
    open(os.path.join(OUT, r["id"] + ".ok"), "w").close()
    json.dump(allc, open(cpath, "w"), indent=1)
    print(r["id"], len(cands), flush=True)
json.dump(allc, open(os.path.join(OUT, "candidates.json"), "w"), indent=1)

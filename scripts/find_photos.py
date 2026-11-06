"""Find free-licence candidate photos for each recipe via Openverse and build contact sheets.

Usage: python3 scripts/find_photos.py public/recipes.json OUT_DIR
Resumable: recipes already searched are skipped. Thumbnails are kept in OUT_DIR/thumbs.
"""
import io, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from PIL import Image, ImageDraw

UA = {"User-Agent": "GentleKitchenRecipeApp/1.0 (https://github.com/eastburydigital/food)"}
N = 4
recipes = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
THUMBS = os.path.join(OUT, "thumbs")
os.makedirs(THUMBS, exist_ok=True)
cpath = os.path.join(OUT, "candidates.json")
allc = json.load(open(cpath)) if os.path.exists(cpath) else {}

def get(url):
    for i in range(8):
        time.sleep(3.5)
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            wait = int(e.headers.get("Retry-After") or 60)
            print(f"  429, waiting {wait}s", flush=True)
            time.sleep(wait + 2)
    raise RuntimeError("rate limited: " + url)

only = set(sys.argv[3:])
for r in recipes:
    if only and r["id"] not in only: continue
    if r["id"] in allc and not only: continue
    params = dict(q=r["photo"], license_type="commercial,modification", page_size=N + 4, mature="false")
    d = json.loads(get("https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(params)))
    cands = []
    for x in d.get("results", []):
        if (x.get("width") or 1000) < 500: continue
        cands.append(dict(id=x["id"], title=x.get("title"), author=x.get("creator"), license=f"CC {x['license'].upper()} {x.get('license_version') or ''}".strip() if x["license"] not in ("cc0", "pdm") else x["license"].upper(),
                          license_url=x.get("license_url"), page=x.get("foreign_landing_url"), source=x.get("source")))
        if len(cands) == N: break
    sheet = Image.new("RGB", (N * 300, 260), "white"); dr = ImageDraw.Draw(sheet)
    for i, c in enumerate(cands):
        path = os.path.join(THUMBS, c["id"] + ".jpg")
        try:
            if not os.path.exists(path):
                im = Image.open(io.BytesIO(get(f"https://api.openverse.org/v1/images/{c['id']}/thumb/"))).convert("RGB")
                im.save(path, quality=88)
            im = Image.open(path); c["size"] = im.size
            im = im.copy(); im.thumbnail((290, 230)); sheet.paste(im, (i * 300 + 5, 25))
        except Exception as e:
            print("  thumb failed", c["id"], e, flush=True)
        dr.text((i * 300 + 5, 5), str(i), fill="red")
    dr.text((5, 245), r["id"], fill="black")
    sheet.save(os.path.join(OUT, r["id"] + ".jpg"), quality=70)
    allc[r["id"]] = cands
    json.dump(allc, open(cpath, "w"), indent=1)
    print(r["id"], len(cands), flush=True)

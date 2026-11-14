"""Make card-size thumbnails and flag recipes that have an illustration.
Run with: python3 -I scripts/finalize_images.py  (from the repo root)"""
import json, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
img_dir = os.path.join(ROOT, 'img')
thumb_dir = os.path.join(img_dir, 'thumb')
os.makedirs(thumb_dir, exist_ok=True)

recipes_path = os.path.join(ROOT, 'recipes.json')
recipes = json.load(open(recipes_path))
have = 0
for r in recipes:
    src = os.path.join(img_dir, r['id'] + '.jpg')
    if os.path.exists(src):
        im = Image.open(src).convert('RGB')
        im.thumbnail((600, 600), Image.LANCZOS)
        im.save(os.path.join(thumb_dir, r['id'] + '.jpg'), 'JPEG', quality=78, progressive=True, optimize=True)
        r['image'] = True
        have += 1
    else:
        r.pop('image', None)
json.dump(recipes, open(recipes_path, 'w'), indent=2, ensure_ascii=False)
print(f'{have} of {len(recipes)} recipes have an image')

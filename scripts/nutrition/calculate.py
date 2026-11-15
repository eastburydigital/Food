"""Work out estimated nutrition per serving for every recipe.

Inputs (in this folder):
  foods.json  food key -> nutrients per 100 g (UK composition data)
  lines.json  ingredient line -> {"parts": [{"food": key, "grams": g}], "per_serving": bool, "include": bool}
              grams are for the whole recipe as written, or for ONE serving when per_serving is true
              (used for "White rice, to serve" style lines).
Output: adds a "nutrition" object to each recipe in public/recipes.json.

Run from the repo root: python3 -I scripts/nutrition/calculate.py
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..', 'public')
KEYS = ['kcal', 'protein', 'carbs', 'sugars', 'fat', 'satfat', 'fibre', 'salt']

foods = json.load(open(os.path.join(HERE, 'foods.json')))
lines = json.load(open(os.path.join(HERE, 'lines.json')))
recipes_path = os.path.join(ROOT, 'recipes.json')
recipes = json.load(open(recipes_path))

problems = []
for r in recipes:
    total = dict.fromkeys(KEYS, 0.0)
    served_with = []
    mapped = 0
    for line in r['ingredients']:
        m = lines.get(line)
        if m is None:
            problems.append(f"{r['id']}: no mapping for line: {line}")
            continue
        mapped += 1
        if not m.get('include', True):
            continue
        mult = r['serves'] if m.get('per_serving') else 1
        if m.get('per_serving'):
            served_with.append(line.split(',')[0].strip())
        for part in m.get('parts', []):
            f = foods.get(part['food'])
            if f is None:
                problems.append(f"{r['id']}: unknown food '{part['food']}' in line: {line}")
                continue
            g = float(part['grams']) * mult
            for k in KEYS:
                total[k] += f.get(k, 0) * g / 100
    per = {k: total[k] / r['serves'] for k in KEYS}
    r['nutrition'] = {
        'kcal': round(per['kcal'] / 5) * 5,
        'protein': round(per['protein']),
        'carbs': round(per['carbs']),
        'sugars': round(per['sugars']),
        'fat': round(per['fat']),
        'satfat': round(per['satfat'], 1),
        'fibre': round(per['fibre'], 1),
        'salt': round(per['salt'], 1),
        'servedWith': served_with,
        'complete': mapped == len(r['ingredients']),
    }

json.dump(recipes, open(recipes_path, 'w'), indent=2, ensure_ascii=False)
print(f"{len(recipes)} recipes calculated; {len(problems)} problems")
for p in problems[:50]:
    print('  ', p)
sys.exit(1 if problems else 0)

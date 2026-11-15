"""Check new recipe files against the Gentle Kitchen rules and schema.
Usage: python3 -I scripts/recipes100/validate.py file1.json [file2.json ...]
Prints problems; exit code 1 if any hard problems."""
import json, re, sys, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
existing = json.load(open(os.path.join(ROOT, 'public', 'recipes.json')))
KEYS = ["id", "title", "meal", "gentle", "time", "serves", "texture", "summary", "ingredients", "steps", "tip", "swaps", "nutrients", "storage"]

# Words that break the rules wherever they appear in ingredients or steps.
BANNED = [
    r'mushroom', r'chill?i(?! out)', r'cayenne', r'jalape', r'harissa', r'sriracha', r'hot sauce', r'wasabi', r'horseradish', r'hot paprika', r'hot curry',
    r'sweetcorn', r'\bcorn kernels?\b', r'popcorn', r'(?<!chick)(?<!split )\bpeas\b', r'\bpea\b', r'kidney bean', r'black bean', r'pinto', r'edamame', r'broad bean',
    r'brown rice', r'wild rice', r'quinoa', r'wholemeal', r'whole ?wheat', r'granary', r'(?<!de)\bseeded\b', r'\bbran\b',
    r'\braisins?\b', r'sultana', r'\bdates?\b', r'dried (apricot|fig|fruit|cranberr)', r'prune',
    r'raspberr', r'strawberr', r'blackberr', r'kiwi', r'pineapple', r'\bfigs?\b', r'olive(?! oil)', r'sun-?dried',
    r'sesame seed', r'\bchia\b', r'linseed', r'flaxseed', r'poppy', r'pumpkin seed', r'sunflower seed', r'pine nut', r'pistachio',
    r'walnut(?!-sized)', r'pecan', r'cashew(?! butter)', r'hazelnut(?! butter)', r'(?<!100% )peanuts\b', r'flaked almond', r'chopped (nuts|almonds)', r'desiccated', r'coconut flakes',
    r'lettuce', r'cucumber', r'\bkale\b', r'celery', r'cabbage', r'sprout', r'rocket\b', r'watercress',
    r'\bbacon\b', r'chicken', r'\bbeef\b', r'\bpork\b', r'\bham\b', r'\bfish\b(?! sauce-free)', r'anchov', r'prawn', r'shrimp', r'tuna', r'salmon', r'gelatine', r'fish sauce',
    r'chopped tomatoes', r'cherry tomato', r'tinned tomatoes', r'quorn',
]
# Allowed only with a qualifier.
NEEDS = [
    (r'parmesan', r'vegetarian'),
    (r'worcestershire', r'vegetarian'),
]
WARN = [r'\braw\b', r'spring onion', r'\bseeds?\b', r'\bnuts?\b', r'almond', r'\bonion\b(?!.*(soft|cook|fry|sweat|simmer))', r'basil', r'parsley', r'coriander leaves', r'mint', r'skin']
MEDICAL = [r'\bheal', r'inflamm', r'cure', r'\btreat', r'safe for crohn', r'good for (your )?strictur', r'prevent']


def check(r, ids, titles):
    hard, soft = [], []
    if list(r.keys()) != KEYS and set(r.keys()) != set(KEYS):
        hard.append(f'keys {sorted(set(r) ^ set(KEYS))}')
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', r.get('id', '')): hard.append('bad id')
    if r['id'] in ids: hard.append('duplicate id')
    if r['title'].lower() in titles: hard.append('duplicate title')
    if r['meal'] not in ('breakfast', 'lunch', 'dinner', 'snack', 'dessert'): hard.append('bad meal')
    if r['texture'] not in ('smooth', 'soft', 'regular'): hard.append('bad texture')
    if not isinstance(r['gentle'], bool): hard.append('gentle not bool')
    if not (isinstance(r['time'], int) and 1 <= r['time'] <= 600): hard.append('bad time')
    if not (isinstance(r['serves'], int) and 1 <= r['serves'] <= 16): hard.append('bad serves')
    for k in ('ingredients', 'steps', 'swaps', 'nutrients'):
        if not isinstance(r[k], list) or not all(isinstance(x, str) for x in r[k]): hard.append(f'{k} not list of str')
    if len(r['ingredients']) < 2 or len(r['steps']) < 1: hard.append('too few ingredients/steps')
    if any(n not in ('protein', 'iron', 'calcium', 'b12') for n in r['nutrients']): hard.append('bad nutrient')
    s = r['storage']
    if not (isinstance(s, dict) and isinstance(s.get('fridgeDays'), int) and isinstance(s.get('freezerMonths'), int) and isinstance(s.get('batch'), bool) and isinstance(s.get('text'), str)):
        hard.append('bad storage')
    elif s['fridgeDays'] > 4: hard.append('fridgeDays > 4')
    text = ' '.join(r['ingredients'] + r['steps'] + r['swaps'] + [r['title']]).lower()
    for b in BANNED:
        m = re.search(b, text)
        if m: hard.append(f'banned: "{m.group(0)}"')
    for word, qual in NEEDS:
        for line in r['ingredients']:
            if re.search(word, line, re.I) and not re.search(qual, line, re.I): hard.append(f'{word} needs "{qual}"')
    if re.search(r'\brice\b', text) and 'rice flour' not in text and 'rice noodle' not in text and not re.search(r'1 hour|1 day', s.get('text', '') if isinstance(s, dict) else ''):
        soft.append('rice: storage should say cool within 1 hour / eat within 1 day')
    for w in MEDICAL:
        if re.search(w, (r['tip'] + ' ' + r['summary']).lower()): hard.append(f'medical wording "{w}"')
    for w in WARN:
        for line in r['ingredients'] + r['steps']:
            if re.search(w, line.lower()):
                soft.append(f'check "{w}": {line[:80]}')
                break
    if r['gentle'] and r['texture'] == 'regular': hard.append('gentle but regular texture')
    return hard, soft


def main(paths):
    ids = {r['id'] for r in existing}
    titles = {r['title'].lower() for r in existing}
    bad = 0
    total = 0
    for p in paths:
        for r in json.load(open(p)):
            total += 1
            hard, soft = check(r, ids, titles)
            ids.add(r['id']); titles.add(r['title'].lower())
            if hard or soft:
                print(f"{os.path.basename(p)} :: {r['id']}")
                for h in hard: print('   HARD', h)
                for s_ in soft: print('   warn', s_)
            bad += bool(hard)
    print(f'{total} recipes checked, {bad} with hard problems')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

"""One-off: add texture, nutrients and swaps to the original recipes and append new_recipes.json."""
import json
P = "public/recipes.json"
recipes = json.load(open(P))
new = json.load(open("scripts/new_recipes.json"))

TEXTURE = {
 "smooth": "banana-peanut-smoothie carrot-ginger-soup butternut-squash-soup red-lentil-soup potato-leek-soup cheesy-polenta homemade-hummus",
 "regular": "tomato-soup-grilled-cheese hummus-pepper-wrap courgette-feta-fritters avocado-egg-toast honey-soy-tofu butter-paneer halloumi-traybake egg-fried-rice banana-bread",
}
NUTRIENTS = {
 "protein": "soft-scrambled-eggs banana-peanut-smoothie yoghurt-stewed-pear banana-pancakes mild-shakshuka cheese-spinach-omelette red-lentil-soup egg-mayo-sandwich courgette-feta-fritters avocado-egg-toast squash-lentil-dhal squash-mac-cheese honey-soy-tofu butter-paneer lentil-shepherds-pie halloumi-traybake egg-fried-rice spinach-ricotta-pasta-bake miso-noodle-soup baked-eggs-spinach homemade-hummus",
 "iron": "red-lentil-soup squash-lentil-dhal lemon-spinach-risotto honey-soy-tofu lentil-shepherds-pie spinach-ricotta-pasta-bake sweet-potato-coconut-curry homemade-hummus cheese-spinach-omelette",
 "calcium": "creamy-banana-porridge banana-peanut-smoothie yoghurt-stewed-pear squash-mac-cheese cauliflower-cheese butter-paneer halloumi-traybake spinach-ricotta-pasta-bake rice-pudding stewed-apple-custard tomato-soup-grilled-cheese cheesy-polenta honey-soy-tofu",
 "b12": "soft-scrambled-eggs cheese-spinach-omelette egg-mayo-sandwich baked-eggs-spinach mild-shakshuka yoghurt-stewed-pear egg-fried-rice",
}
SWAPS = {
 "creamy-banana-porridge": ["Use stewed pear instead of banana", "Use oat or soya milk"],
 "soft-scrambled-eggs": ["Serve on a soft white roll or crumpet"],
 "banana-peanut-smoothie": ["Use smooth almond butter or tahini instead of peanut butter"],
 "mild-shakshuka": ["Use crumbled firm tofu instead of eggs"],
 "carrot-ginger-soup": ["Use a little ground ginger if fresh is too strong"],
 "red-lentil-soup": ["Add a peeled sweet potato for a sweeter soup"],
 "squash-lentil-dhal": ["Use peeled sweet potato instead of squash"],
 "squash-mac-cheese": ["Use peeled sweet potato instead of squash"],
 "honey-soy-tofu": ["Use maple syrup to make it vegan"],
 "butter-paneer": ["Use firm tofu instead of paneer", "Use coconut milk instead of cream"],
 "lentil-shepherds-pie": ["Top with mashed sweet potato instead"],
 "halloumi-traybake": ["Use firm tofu or paneer instead of halloumi"],
 "egg-fried-rice": ["Add cubes of firm tofu for extra protein"],
 "red-pepper-pasta": ["Use ricotta instead of cream cheese"],
 "sweet-potato-coconut-curry": ["Use butternut squash instead of sweet potato"],
 "rice-pudding": ["Use oat or soya milk and maple syrup to make it vegan"],
 "banana-bread": ["Use oil instead of butter"],
}
ids = {r["id"] for r in recipes}
for k in list(TEXTURE) + list(NUTRIENTS):
    for i in (TEXTURE.get(k) or NUTRIENTS.get(k)).split():
        assert i in ids, i
for r in recipes:
    r.pop("photo", None)
    r["texture"] = next((t for t, s in TEXTURE.items() if r["id"] in s.split()), "soft")
    r["nutrients"] = [n for n, s in NUTRIENTS.items() if r["id"] in s.split()]
    r["swaps"] = SWAPS.get(r["id"], [])
for n in new:
    assert n["id"] not in ids, n["id"]
    if n["id"] == "slow-cooker-lentil-stew": n["time"] = 255
order = ["id","title","meal","gentle","time","serves","texture","summary","ingredients","steps","tip","swaps","nutrients","storage"]
out = [{k: r[k] for k in order} for r in recipes + new]
json.dump(out, open(P, "w"), indent=2, ensure_ascii=False)
print(len(out), "recipes")

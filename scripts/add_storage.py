"""Add storage info to each recipe. fridge = days, freezer = months (0 = don't)."""
import json, sys
P = "public/recipes.json"
S = {
 "creamy-banana-porridge": (1, 0, False, "Best fresh. Leftovers keep in a covered bowl in the fridge for 1 day — loosen with milk and reheat until piping hot."),
 "soft-scrambled-eggs": (0, 0, False, "Best eaten straight away. Scrambled eggs go rubbery when stored and reheated."),
 "banana-peanut-smoothie": (1, 0, False, "Best fresh. Can be kept in a sealed bottle in the fridge for up to 1 day — shake before drinking."),
 "yoghurt-stewed-pear": (3, 3, True, "Stew a big batch of pears. Keep in a sealed tub in the fridge for 3 days, or freeze in portions for 3 months. Add the yoghurt when serving."),
 "banana-pancakes": (2, 2, True, "Cool, then stack with baking paper between. Fridge for 2 days or freeze for 2 months. Reheat in a toaster or dry pan."),
 "mild-shakshuka": (2, 3, True, "Batch-cook the sauce only: fridge for 2 days or freeze for 3 months. Cook fresh eggs in the reheated sauce."),
 "cheese-spinach-omelette": (0, 0, False, "Best eaten straight away."),
 "carrot-ginger-soup": (3, 3, True, "Cool quickly, then fridge for 3 days or freeze in portions for 3 months. Add the crème fraîche after reheating."),
 "butternut-squash-soup": (3, 3, True, "Cool quickly, then fridge for 3 days or freeze in portions for 3 months. Add any cream after reheating."),
 "red-lentil-soup": (3, 3, True, "Thickens as it stands. Fridge for 3 days or freeze for 3 months; loosen with water when reheating."),
 "tomato-soup-grilled-cheese": (3, 3, True, "Batch-cook the soup: fridge for 3 days or freeze for 3 months. Make the toastie fresh."),
 "potato-leek-soup": (3, 3, True, "Fridge for 3 days or freeze for 3 months. Potato soup can go a little grainy when frozen — blend again after reheating."),
 "hummus-pepper-wrap": (1, 0, False, "Best made fresh. Can be wrapped and kept in the fridge until the next day."),
 "egg-mayo-sandwich": (2, 0, False, "Keep the egg mayo filling in a sealed tub in the fridge for 2 days. Make sandwiches fresh. Don't freeze."),
 "courgette-feta-fritters": (2, 2, True, "Cool, then fridge for 2 days or freeze between baking paper for 2 months. Reheat in the oven until hot all the way through."),
 "avocado-egg-toast": (0, 0, False, "Best eaten straight away — avocado browns quickly."),
 "squash-lentil-dhal": (3, 3, True, "Great for batch cooking. Fridge for 3 days or freeze in portions for 3 months. Cook rice fresh, or see the rice note below."),
 "butternut-risotto": (1, 0, False, "Risotto contains rice, so cool within 1 hour, fridge, and eat within 1 day. Reheat only once, until steaming hot. Don't freeze."),
 "lemon-spinach-risotto": (1, 0, False, "Risotto contains rice, so cool within 1 hour, fridge, and eat within 1 day. Reheat only once, until steaming hot. Don't freeze."),
 "squash-mac-cheese": (2, 2, True, "Fridge for 2 days or freeze in portions for 2 months. Add a splash of milk when reheating."),
 "honey-soy-tofu": (2, 0, False, "Store the tofu and carrots for 2 days in the fridge. Cooked rice must be cooled within 1 hour and eaten within 1 day."),
 "butter-paneer": (3, 3, True, "Fridge for 3 days or freeze for 3 months. The sauce freezes well; add a splash of cream when reheating."),
 "gnocchi-tomato-bake": (2, 0, False, "Fridge for 2 days. Gnocchi goes soft when frozen, but you can freeze the sauce on its own for 3 months."),
 "lentil-shepherds-pie": (3, 3, True, "Ideal for batch cooking. Fridge for 3 days or freeze (whole or in portions) for 3 months. Defrost in the fridge overnight, then reheat until piping hot."),
 "cauliflower-cheese": (2, 2, True, "Fridge for 2 days or freeze for 2 months. Reheat in the oven until bubbling."),
 "halloumi-traybake": (2, 0, False, "Fridge for 2 days. Halloumi goes rubbery if frozen, but the roast veg alone freezes for 2 months."),
 "egg-fried-rice": (1, 0, False, "Cool within 1 hour, fridge, and eat within 1 day. Reheat only once, until steaming hot. Don't freeze."),
 "red-pepper-pasta": (2, 3, True, "Batch-make the sauce: fridge for 3 days or freeze for 3 months. Cooked pasta with sauce keeps 2 days in the fridge."),
 "spinach-ricotta-pasta-bake": (2, 2, True, "Fridge for 2 days or freeze for 2 months. Reheat covered in the oven until hot all the way through."),
 "miso-noodle-soup": (1, 0, False, "Best fresh. The broth (without noodles or tofu) keeps 1 day in the fridge."),
 "sweet-potato-coconut-curry": (3, 3, True, "Great for batch cooking. Fridge for 3 days or freeze for 3 months. Cook rice fresh."),
 "baked-eggs-spinach": (0, 0, False, "Best eaten straight away."),
 "cheesy-polenta": (2, 3, False, "Polenta sets firm in the fridge (2 days) — slice and fry it, or reheat with milk. The tomato sauce freezes for 3 months."),
 "stewed-apple-custard": (3, 3, True, "Stewed apple keeps 3 days in the fridge or freezes for 3 months. Custard keeps 2 days in the fridge — don't freeze it."),
 "rice-pudding": (2, 0, False, "Cool within 1 hour and fridge for up to 2 days. Eat cold, or reheat once until hot. Don't freeze."),
 "banana-bread": (3, 3, True, "Keep wrapped at room temperature for 3 days. Freeze whole or in slices for 3 months."),
 "homemade-hummus": (3, 2, True, "Keep in a sealed tub in the fridge for 3 days, or freeze for 2 months. Stir well after thawing."),
}
recipes = json.load(open(P))
assert set(S) == {r["id"] for r in recipes}, set(S) ^ {r["id"] for r in recipes}
for r in recipes:
    f, z, b, t = S[r["id"]]
    r["storage"] = {"fridgeDays": f, "freezerMonths": z, "batch": b, "text": t}
json.dump(recipes, open(P, "w"), indent=2, ensure_ascii=False)
print(sum(s[2] for s in S.values()), "batch-friendly of", len(S))

"""Apply dietitian + chef review fixes to recipes.json (one-off). Every edit asserts its target exists."""
import json
P = "/home/user/Food/public/recipes.json"
R = {r["id"]: r for r in json.load(open(P))}
order = list(R)

def ing(rid, old, new=None):
    lst = R[rid]["ingredients"]; i = next(k for k, x in enumerate(lst) if x.startswith(old))
    if new is None: lst.pop(i)
    else: lst[i] = new
def add_ing(rid, new, after=None):
    lst = R[rid]["ingredients"]
    i = next(k for k, x in enumerate(lst) if x.startswith(after)) + 1 if after else len(lst)
    lst.insert(i, new)
def step(rid, n, new):  # n is 1-based
    assert len(R[rid]["steps"]) >= n, (rid, n); R[rid]["steps"][n - 1] = new
def step_sub(rid, old, new):
    s = R[rid]["steps"]; i = next(k for k, x in enumerate(s) if old in x); s[i] = s[i].replace(old, new)
def setf(rid, **kw):
    for k, v in kw.items():
        if k in ("fridgeDays", "freezerMonths", "batch", "text", "roomDays"): R[rid]["storage"][k] = v
        else: assert k in R[rid] or k in ("swaps",), k; R[rid][k] = v
def nut(rid, add=(), remove=()):
    n = R[rid]["nutrients"]
    for x in remove: assert x in n, (rid, x); n.remove(x)
    for x in add:
        if x not in n: n.append(x)
    R[rid]["nutrients"] = [k for k in ["protein", "iron", "calcium", "b12"] if k in n]
RICE = " Cook rice fresh, or cool leftover rice within 1 hour, fridge, and eat within 1 day; reheat only once."

# ---- Rule breaches / stricture risks ----
ing("egg-fried-rice", "250g cooked", "400g cooked and cooled white rice")
step("egg-fried-rice", 4, "Stir in the spring onion for the last minute so it softens.")
ing("miso-noodle-soup", "1 spring onion"); step("miso-noodle-soup", 4, "Add the tofu gently and serve.")
ing("miso-noodle-soup", "1 litre water", "800ml water"); ing("miso-noodle-soup", "2 tbsp white miso", "3 tbsp white miso paste")
ing("miso-noodle-soup", "150g udon", "300g straight-to-wok udon or 150g dried rice noodles")
step("miso-noodle-soup", 1, "Bring the water to a simmer with the ginger and carrot. Cook for 8–10 minutes until the carrot is very soft.")
ing("egg-drop-soup", "1 spring onion"); step("egg-drop-soup", 4, "Leave for 30 seconds, then stir gently and serve.")
ing("egg-onion-rice-bowl", "1 spring onion"); step("egg-onion-rice-bowl", 3, "Slide on to bowls of hot rice.")
ing("egg-onion-rice-bowl", "Cooked white rice", "300g cooked white rice")
ing("hummus-pepper-wrap", "Few leaves of soft butter lettuce")
setf("hummus-pepper-wrap", tip="Jarred peppers are already cooked and peel easily — check every strip for skin.")
setf("egg-mayo-sandwich", summary="Hard-boiled eggs mashed with mayo and chives on soft white bread.")
ing("egg-mayo-sandwich", "1 tbsp finely snipped chives", "1 tbsp very finely snipped chives (optional)")
ing("soft-scrambled-eggs", "Finely snipped chives", "Very finely snipped chives (optional)")
step("soft-scrambled-eggs", 4, "Toast the bread, spoon the eggs on top, then add pepper and chives if using.")
ing("cheese-potato-cakes", "2 tbsp snipped chives", "2 tbsp very finely snipped chives (optional)")
step("cheese-potato-cakes", 3, "With floured hands, shape into 8 cakes. Chill for 15 minutes if they feel soft.")
ing("egg-muffins", "1 tbsp finely snipped chives", "1 tbsp very finely snipped chives (optional)")
step("sweet-potato-coconut-curry", 3, "Stir in the spinach until wilted, then blend the spinach with a ladle of the sauce until smooth and stir back in.")
step("tofu-korma", 3, "Add the coconut milk and spinach, simmer for 5 minutes, then blend smooth.")
step("tofu-korma", 4, "Stir in the tofu and honey. Take off the heat and stir in the yoghurt.")
ing("tofu-korma", "100g spinach", "100g spinach"); ing("tofu-korma", "280g firm tofu", "280g firm tofu, pressed and cubed")
add_ing("tofu-korma", "1 tsp honey", after="200ml coconut milk")
ing("halloumi-traybake", "1 red onion", "1 onion, finely sliced")
ing("halloumi-traybake", "3 carrots", "3 carrots, peeled and cut into 1cm slices")
step("halloumi-traybake", 2, "Toss the veg with oil and oregano on a large tray. Cover with foil for the first 20 minutes so it steams soft, then uncover and roast for 10 more minutes.")
ing("leek-potato-gratin", "2 leeks", "2 leeks, white parts only, very finely chopped")
step("leek-potato-gratin", 1, "Heat the oven to 190°C (170°C fan).")
step("leek-potato-gratin", 2, "Soften the leeks in the butter for 15 minutes until silky.")
step("leek-potato-gratin", 3, "Warm the cream, milk and garlic with a pinch of salt and nutmeg. Layer the potatoes and leeks in a dish.")
step("leek-potato-gratin", 5, "Cover with foil and bake for 50 minutes, then uncover for 20 minutes until golden and a knife slides through easily.")
setf("leek-potato-gratin", time=90)
step("pepper-butter-bean-soup", 4, "Push through a fine sieve to remove any bean skins.")
step("mild-shakshuka", 4, "Blend the sauce smooth with a stick blender.")
ing("baked-eggs-spinach", "50g spinach", "50g spinach, wilted and blended to a purée")
ing("baked-eggs-spinach", "4 tbsp double cream", "4 tbsp milk or single cream")
step("banana-oat-bars", 3, "Blitz the oats briefly in a blender, then stir them in with the cinnamon and baking powder.")
setf("banana-oat-bars", tip="No nuts, seeds or dried fruit. Blitzing the oats gives a smoother bar.")
ing("peanut-overnight-oats", "40g porridge oats", "40g fine or instant oats")
step("spinach-feta-filo-pie", 4, "Line a 20cm square dish with 3 buttered filo sheets, add the filling and lay 3 more buttered sheets flat on top.")
step("spinach-feta-filo-pie", 5, "Cover with foil for the first 20 minutes for a softer top, then bake uncovered for 10–15 minutes until golden and set.")
add_ing("spinach-feta-filo-pie", "2 tbsp chopped dill", after="Pinch of nutmeg"); step_sub("spinach-feta-filo-pie", "eggs and nutmeg", "eggs, nutmeg and dill")

# ---- Gentle labels ----
ing("squash-lentil-dhal", "400ml tin coconut milk", "400ml tin light coconut milk")
ing("lemon-spinach-risotto", "1 tbsp mascarpone", "1 tbsp mascarpone or crème fraîche (optional)")

# ---- Nutrients ----
for rid in ("lemon-spinach-risotto", "sweet-potato-coconut-curry", "spinach-potato-soup"): nut(rid, remove=["iron"])
nut("banana-oat-bars", remove=["protein"]); nut("chocolate-tofu-pots", remove=["protein"])
nut("cauliflower-cheddar-soup", remove=["protein"]); setf("cauliflower-cheddar-soup", summary="Like cauliflower cheese in a bowl — velvety and comforting.")
for rid in ("stewed-apple-custard", "egg-muffins", "cheese-scones"): nut(rid, remove=["calcium"])
add_ing("egg-drop-soup", "150g silken tofu, cubed", after="2 eggs")
step_sub("egg-drop-soup", "Leave for 30 seconds", "Add the tofu and leave for 30 seconds")
nut("creamy-banana-porridge", add=["protein", "calcium", "b12"])
for rid in ("banana-peanut-smoothie", "rice-pudding", "avocado-egg-toast"): nut(rid, add=["b12"])
nut("cheese-spinach-omelette", add=["calcium"])
for rid in ("tomato-soup-grilled-cheese", "cauliflower-cheese"): nut(rid, add=["protein"])
ing("honey-soy-tofu", "280g firm tofu", "280g calcium-set firm tofu, pressed and cubed")
ing("tofu-korma", "280g firm tofu", "280g calcium-set firm tofu, pressed and cubed")

# ---- Storage ----
setf("rice-pudding", fridgeDays=1, text="Cool within 1 hour, fridge, and eat within 1 day. Eat cold, or reheat once until steaming hot. Don't freeze.")
setf("spanish-tortilla", fridgeDays=2, text="Cool, wrap and keep in the fridge for 2 days. Eat cold or warm gently. Don't freeze — the egg goes watery.")
setf("egg-muffins", fridgeDays=2, text="Fridge in a sealed tub for 2 days, or freeze for 2 months. Reheat until piping hot, or eat cold from the fridge.")
setf("squash-lentil-dhal", text="Great for batch cooking. Fridge for 3 days or freeze in portions for 3 months." + RICE)
for rid in ("butter-paneer", "saag-paneer", "tofu-korma", "mild-egg-curry", "sweet-potato-coconut-curry"):
    R[rid]["storage"]["text"] += RICE
setf("red-pepper-pasta", text="Sauce: fridge for 2 days or freeze for 3 months. Cooked pasta with sauce keeps 2 days in the fridge.")
setf("banana-bread", roomDays=3, fridgeDays=0, text="Keep wrapped in a tin at room temperature for 3 days. Freeze whole or in slices for 3 months.")
setf("apple-cinnamon-muffins", roomDays=3, fridgeDays=0, text="Keep in a tin at room temperature for 3 days, or freeze for 3 months. Thaw at room temperature or warm for 15 seconds.")
setf("cheese-scones", roomDays=2, fridgeDays=0, text="Best on the day. Keep in a tin at room temperature for 2 days, or freeze for 3 months and warm through in the oven.")

# ---- Wording ----
setf("carrot-ginger-soup", tip="Blending makes soups an easy way to enjoy veg. Choose a stock with a short ingredient list, or make your own.")
setf("banana-peanut-smoothie", summary="A filling, protein-rich smoothie.")
setf("rice-pudding", tip="Very soft and filling — handy on harder days.")
setf("egg-drop-soup", tip="Very quick and soft — handy on harder days.")
setf("mango-lassi", tip="A creamy, calcium-rich snack.")
setf("lentil-shepherds-pie", tip="No peas here — their skins can be hard to break down. Standard Worcestershire sauce contains anchovies — use a vegetarian one or soy.")
setf("spinach-potato-soup", tip="Blending the spinach fully avoids the stringy texture. A squeeze of lemon adds brightness.")

# ---- Chef: failures and timings ----
ing("slow-cooker-lentil-stew", "1 litre vegetable stock", "600ml vegetable stock")
setf("slow-cooker-lentil-stew", tip="The time shown is 15 minutes' prep plus 4 hours on high; on low allow 6–8 hours.")
ing("lentil-lasagne", "1 batch red lentil", "1 batch red lentil bolognese sauce (sauce only, no spaghetti)"); setf("lentil-lasagne", time=115)
step("rice-pudding", 2, "Simmer very gently for 40–45 minutes, stirring often, until thick and creamy."); setf("rice-pudding", time=50)
add_ing("red-pepper-pasta", "1 tsp olive oil", after="1 garlic clove")
step("red-pepper-pasta", 2, "Soften the garlic in the oil for 1 minute, then blend with the peppers, cream cheese and hard cheese until very smooth.")
step_sub("butternut-risotto", "soften the onion for 5 minutes.", "soften the onion for 5 minutes, adding the sage, finely chopped.")
step("gnocchi-tomato-bake", 3, "Stir the raw gnocchi straight into the sauce — no need to boil them first.")
step("gnocchi-tomato-bake", 4, "Tip into a baking dish, top with mozzarella and bake for 20 minutes, covered for the first 10, until bubbling. Scatter over basil.")

# ---- Chef: scaler-friendly lines ----
ing("carrot-ginger-soup", "Thumb-sized piece", "1 thumb-sized piece (3cm) fresh ginger, peeled and grated")
ing("lemon-spinach-risotto", "Zest and juice of 1 lemon", "1 lemon, zested and juiced (add juice to taste)")
ing("homemade-hummus", "Juice of 1 lemon", "1 lemon, juiced")
ing("courgette-ricotta-pasta", "Zest of 1 lemon", "1 lemon, zested, plus a squeeze of juice")
ing("cheese-spinach-omelette", "Handful of baby spinach", "30g baby spinach")
ing("courgette-feta-fritters", "Small handful of mint", "2 tbsp finely chopped mint or dill")

# ---- Chef: flavour ----
add_ing("lentil-bolognese", "1 tbsp soy sauce or vegetarian Worcestershire sauce", after="2 tbsp tomato purée")
step("lentil-bolognese", 2, "Stir in the tomato purée for 2 minutes, then add the lentils, passata, soy sauce, stock and oregano.")
add_ing("courgette-ricotta-pasta", "1 garlic clove, crushed", after="1 tbsp butter")
add_ing("courgette-ricotta-pasta", "30g vegetarian Italian-style hard cheese, grated")
step("courgette-ricotta-pasta", 2, "Cook the courgettes and garlic in the butter for 8 minutes until very soft.")
step("courgette-ricotta-pasta", 3, "Stir in the ricotta, hard cheese, lemon zest and a splash of pasta water to make a creamy sauce.")
for rid in ("carrot-ginger-soup", "butternut-squash-soup", "spinach-potato-soup", "sweet-potato-coconut-curry", "saag-paneer", "mild-egg-curry"):
    if not any(x.lower().startswith("squeeze of lemon") for x in R[rid]["ingredients"]):
        add_ing(rid, "Squeeze of lemon, and salt to taste")
    R[rid]["steps"].append("Finish with a squeeze of lemon and season with salt to taste.")
ing("cauliflower-cheese", "1 tsp mustard", "1 tsp Dijon mustard"); add_ing("cauliflower-cheese", "Pinch of nutmeg")
step_sub("cauliflower-cheese", "the mustard.", "the mustard and nutmeg.")
add_ing("potato-leek-soup", "1 bay leaf"); step("potato-leek-soup", 2, "Add the potatoes, stock and bay leaf and simmer for 15–20 minutes.")
step("potato-leek-soup", 3, "Remove the bay leaf, add the milk and blend until completely smooth. Season to taste.")
add_ing("honey-soy-tofu", "1 tsp rice vinegar", after="2 tbsp honey")
step("honey-soy-tofu", 4, "Mix the soy, honey, vinegar, garlic and ginger, pour into the pan and bubble until sticky. Toss the carrots through.")
step("spinach-feta-filo-pie", 3, "Mix with the feta, ricotta, eggs, nutmeg and dill.")
step("spanish-tortilla", 4, "Flip on to a plate and slide back in for 3–4 minutes — or skip the flip and finish under a hot grill for 3–4 minutes.")
setf("chocolate-tofu-pots", summary="Three ingredients — rich chocolate mousse made with silken tofu. Needs 1 hour to chill.")
setf("peanut-overnight-oats", summary="Five-ingredient oats that soften overnight — make it the night before.")

# ---- Swaps ----
setf("french-toast-apple", swaps=["Use pears instead of apples", "Fry sliced banana in butter instead of apple"])
setf("yoghurt-stewed-pear", swaps=["Use peeled apple, or add a strip of orange zest while stewing"])
setf("banana-pancakes", swaps=["Add ½ tsp cinnamon or vanilla", "Use oat milk"])
setf("butternut-squash-soup", swaps=["Use peeled carrot or sweet potato for half the squash"])
setf("spinach-ricotta-pasta-bake", swaps=["Use blended cottage cheese instead of ricotta"])
setf("gnocchi-tomato-bake", swaps=["Use cheddar instead of mozzarella"])
setf("butternut-risotto", swaps=["Use peeled sweet potato instead of squash"])

json.dump([R[k] for k in order], open(P, "w"), indent=2, ensure_ascii=False)
print("applied fixes to", len(R), "recipes")

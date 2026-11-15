# Gentle Kitchen recipe brief

You are writing new recipes for Gentle Kitchen, a personal recipe app for someone with Crohn's disease and MILD STRICTURES (narrowed bowel), UK-based.

## Hard rules (every recipe, no exceptions)
- Lacto-ovo vegetarian: eggs and dairy fine. No meat, fish, gelatine, anchovies, fish sauce, shrimp paste, Thai curry paste, chicken/beef stock. Worcestershire sauce only "vegetarian Worcestershire sauce". Parmesan only as "vegetarian Italian-style hard cheese".
- No mushrooms (personal trigger).
- No whole nuts or seeds of any kind on or in food: no sesame seeds, chia, linseed/flax, poppy, pumpkin/sunflower seeds, pine nuts, whole/flaked/chopped nuts, desiccated coconut, coconut flakes. Smooth nut butters, tahini, ground spices and seedless jam are fine.
- No raw vegetables or salad (lettuce, cucumber, raw tomato, raw onion/spring onion, raw peppers, celery, kale, cabbage, sprouts). Vegetables must be PEELED (where they have skins: courgette, potato, sweet potato, squash, carrot, aubergine, apple, pear, peach, peppers) and cooked until very soft, often blended.
- No sweetcorn, popcorn, peas, whole beans with skins (kidney, black, pinto, edamame, broad beans), whole chickpeas left whole (blend them), brown/wild rice, quinoa, wholemeal/seeded/granary bread, bran, dried fruit (raisins, sultanas, dates, apricots, figs), berries with seeds (raspberries, strawberries, blackberries, kiwi), pineapple, citrus segments/pith, tough skins, sweetcorn, olives, sun-dried tomatoes, tinned chopped tomatoes (use passata). Red lentils and split lentils are fine (they break down).
- Mild only: no chilli, chilli flakes, cayenne, hot paprika, hot curry powder, jalapeño, harissa, sriracha, hot sauce, wasabi, horseradish. Use "mild curry powder", "sweet paprika", herbs and warm spices.
- Minimally processed: cook from whole ingredients. Shop-bought staples are OK (stock, passata, tofu, pasta, white bread, filo, gnocchi, puff pastry, tinned coconut milk) — mention picking ones with short ingredient lists in the tip where relevant. No meat substitutes (Quorn etc), no ready sauces.
- Herbs: cooked into dishes are fine; any raw herb must be "very finely chopped" and optional. No raw garnish of whole leaves/sprigs.
- Wording: never medical claims ("heals", "reduces inflammation", "safe for Crohn's", "good for strictures"). Say things like "gentle", "soft", "easy to digest" sparingly. UK spelling and ingredients, metric, ovens as "200°C (180°C fan)".

## Fields (JSON object per recipe; exactly these keys, in this order)
- id: unique kebab-case slug (must not clash with existing ids listed below)
- title: short, appetising (must not duplicate an existing dish below)
- meal: one of "breakfast" | "lunch" | "dinner" | "snack" (snack also covers puddings/bakes/drinks)
- gentle: true ONLY for the very gentlest options shown on a flare day (smooth or very soft, not rich/fried/high-fat, no pastry), else false
- time: total minutes including cooking (integer; if it needs chilling/slow cooking, include that or say so in the summary)
- serves: integer
- texture: "smooth" (blended, no chewing) | "soft" (mashes with a fork) | "regular" (needs chewing but no skins/seeds/tough fibre)
- summary: one sentence
- ingredients: array of strings. START EACH LINE WITH THE QUANTITY where possible ("2 carrots, peeled and diced", "400ml milk", "1 lemon, juiced") so it can be scaled. Lines without a number are fine for "Pinch of …", "Salt and pepper", "Oil for frying", "White rice, to serve".
- steps: array of short, clear steps for a tired cook (one action-group each). Every ingredient listed must be used in the steps and vice versa.
- tip: one or two sentences on why it's gentle or how to keep it gentle (no medical claims)
- swaps: array of 1–2 useful swaps (all must follow the rules too)
- nutrients: array from ["protein","iron","calcium","b12"] — only if a NORMAL portion is a meaningful source (eggs/dairy→b12/protein/calcium, red lentils/tofu/lots of spinach→iron, calcium-set tofu→calcium). Empty array is fine.
- storage: {"fridgeDays": int, "freezerMonths": int (0 = don't freeze), "batch": bool (worth batch cooking), "text": "plain advice"}. Follow cautious UK Food Standards Agency advice: most cooked leftovers 2–3 days; anything with cooked rice: cool within 1 hour, eat within 1 day, reheat once, don't freeze — say so; egg dishes 1–2 days; for baked goods kept in a tin use "roomDays": int and fridgeDays 0. Don't freeze egg custards, yoghurt dishes, or mayo.

## Example (existing recipe)
{
  "id": "lentil-shepherds-pie",
  "title": "Lentil shepherd's pie",
  "meal": "dinner",
  "gentle": false,
  "time": 60,
  "serves": 4,
  "texture": "soft",
  "summary": "Rich red lentil and carrot filling under fluffy, buttery mash.",
  "ingredients": [
    "1 tbsp olive oil",
    "1 onion, finely chopped",
    "2 carrots, peeled and finely diced",
    "200g red lentils, rinsed",
    "2 tbsp tomato purée",
    "1 tbsp vegetarian Worcestershire sauce or soy sauce",
    "600ml vegetable stock",
    "1 tsp dried thyme",
    "1kg potatoes, peeled",
    "50g butter",
    "Splash of milk",
    "50g cheddar, grated"
  ],
  "steps": [
    "Soften the onion and carrots in the oil for 10 minutes.",
    "Add the lentils, tomato purée, Worcestershire, stock and thyme. Simmer for 20 minutes until thick.",
    "Meanwhile, boil the potatoes until soft and mash with the butter and milk.",
    "Spoon the filling into a dish, top with mash and cheese.",
    "Bake at 200°C (180°C fan) for 20 minutes until golden."
  ],
  "tip": "No peas here — their skins can be hard to break down. Standard Worcestershire sauce contains anchovies — use a vegetarian one or soy.",
  "swaps": [
    "Top with mashed sweet potato instead"
  ],
  "nutrients": [
    "protein",
    "iron"
  ],
  "storage": {
    "fridgeDays": 3,
    "freezerMonths": 3,
    "batch": true,
    "text": "Ideal for batch cooking. Fridge for 3 days or freeze (whole or in portions) for 3 months. Defrost in the fridge overnight, then reheat until piping hot."
  }
}

## Existing recipes (do NOT duplicate these dishes)
- Creamy banana porridge
- Soft scrambled eggs on toast
- Banana & peanut butter smoothie
- Yoghurt with stewed pear
- Fluffy banana pancakes
- Mild shakshuka
- Cheese & spinach omelette
- Carrot & ginger soup
- Butternut squash soup
- Red lentil & carrot soup
- Tomato soup & grilled cheese
- Potato & leek soup
- Hummus & roast pepper wrap
- Egg mayo sandwich
- Courgette & feta fritters
- Avocado & egg on toast
- Butternut squash dhal
- Butternut squash risotto
- Lemon & spinach risotto
- Butternut mac & cheese
- Sticky honey-soy tofu with rice
- Mild butter paneer
- Gnocchi & mozzarella bake
- Lentil shepherd's pie
- Cauliflower cheese
- Halloumi & peeled veg traybake
- Simple egg fried rice
- Creamy roast pepper pasta
- Spinach & ricotta pasta bake
- Miso noodle soup with tofu
- Mild sweet potato & coconut curry
- Creamy baked eggs
- Cheesy polenta with tomato sauce
- Stewed apple & custard
- Creamy rice pudding
- Simple banana bread
- Silky homemade hummus
- Banana oat breakfast bars
- Peanut butter overnight oats
- Mango & silken tofu smoothie
- Cinnamon French toast with apple
- Cottage cheese pancakes
- Cheese & courgette egg muffins
- Cauliflower & cheddar soup
- Silky spinach & potato soup
- Red pepper & butter bean soup
- Ginger egg drop soup
- Cheese & chive potato cakes
- Soft egg & onion rice bowl
- Spanish potato tortilla
- Red lentil bolognese
- Mild tofu & spinach korma
- Lentil & squash lasagne
- Cheesy leek & potato gratin
- Saag paneer
- Mild egg & tomato curry
- Courgette & ricotta pasta
- Slow-cooker lentil & sweet potato stew
- Creamy baked feta pasta
- Spinach & feta filo pie
- Silky chocolate pots
- Banana & peanut butter ice cream
- Baked egg custard
- Semolina pudding with jam
- Apple & cinnamon muffins
- Cheese scones
- Mango lassi
- Nourishing banana milkshake
- Silky steamed egg custard
- Lemon & egg orzo soup
- Ginger rice congee
- Vegetarian kedgeree
- Poached eggs on herby yoghurt
- Ricotta gnudi with sage butter
- Silky beetroot soup
- Lemon posset
- Butternut & silken tofu soup
- Cheesy egg-enriched mash
- Vanilla protein shake
- Smooth herby cottage cheese dip
- Yoghurt & seedless jam pot
- Peanut butter & banana toast
- Poached eggs on buttery mash
- Soft couscous with roast squash
- Potato & cheese pierogi
- Pumpkin & tofu coconut curry
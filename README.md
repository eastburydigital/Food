# Gentle Kitchen

A phone-first recipe web app for Crohn's with mild strictures: gentle, low-residue vegetarian recipe ideas.

Every recipe is:
- vegetarian (eggs and dairy are fine)
- mushroom-free
- free of whole nuts and seeds, raw veg and skins, sweetcorn, popcorn and peas
- mild (no chilli)
- made from whole, minimally processed ingredients

Recipe ideas only, not medical advice.

## Features
- **86 recipes** with texture levels (smooth / soft / regular), nutrient tags, swaps and storage advice
- **Flare day / Good day** switch, search and filters (quick, batch cook, few ingredients, texture, protein, iron, not tried)
- **Foods I avoid:** recipes are adapted with clearly marked, rule-safe swaps (ingredients and method). Recipes are hidden only when the food is the main ingredient or there's no safe swap
- **Like / Not for me:** disliked recipes go to Saved › Hidden and can be restored
- **Suggested for you:** on-device picks. About two-thirds match your taste, the rest are untried recipes, with near-duplicates kept apart
- **Cook mode** (screen stays on, step timers), **servings scaler**, **week planner**, **freezer tracker** with editable use-by dates
- **Shopping list** grouped by aisle with duplicates merged and cupboard staples listed last
- **How did it sit?** notes, your own recipe photos, large text, backup / restore, delete all data

All personal data stays on the phone (localStorage and IndexedDB). There are no accounts, ads or tracking.

## Project layout
- `public/` – the site Netlify serves (plain HTML, CSS and ES-module JS, no framework)
  - `recipes.json` – all recipes
  - `js/app.js` – views, routing and actions
  - `js/swaps.js` – food-list swap rules
  - `js/recommend.js` – suggestions
  - `js/scale.js` – ingredient scaling
  - `js/aisles.js` – shopping aisles
  - `js/store.js` – local storage and photos
  - `sw.js` – offline support (network first; the version is stamped on each Netlify build)
- `docs/personas.html` – personas and roadmap
- `scripts/` – one-off helpers used to build the recipe data and icons

## Adding a recipe
Copy an entry in `public/recipes.json` and give it a unique `id`. Start ingredient lines with the quantity (e.g. `2 carrots, peeled`) so the scaler can adjust them. Check it against the rules above, then deploy.

## Run locally
```
python3 -m http.server 8080 -d public
```

## Deploy
Netlify publishes `public/` and runs the build command in `netlify.toml`, which stamps a new service-worker version. The headers include a strict Content-Security-Policy, so don't use inline scripts or `style=` attributes.

## Install on your phone
- iPhone: open the site in Safari → Share → Add to Home Screen
- Android: open in Chrome → ⋮ → Install app

# Gentle Kitchen

A phone-friendly recipe web app for Crohn's with mild strictures.

Every recipe is:
- vegetarian (eggs and dairy are fine)
- mushroom-free
- free of whole nuts and seeds, raw veg and skins, sweetcorn, popcorn and peas
- mild (no chilli)
- made from whole, minimally processed ingredients

Features: search, meal and time filters, a **Flare day / Good day** switch, favourites, a shopping list, and your own "foods I avoid" list. Saved data stays on your phone.

Not medical advice — check big diet changes with your IBD team or dietitian.

## Project layout
- `public/` — the site Netlify serves (plain HTML, CSS and JS; no build step)
- `public/recipes.json` — all recipes. Add one by copying an entry; give it a unique `id`.
- `public/photos.json` + `public/img/` — recipe photos and their credits
- `scripts/` — helpers for finding photos and drawing the app icons

## Run locally
```
python3 -m http.server 8080 -d public
```

## Deploy
Netlify publishes the `public` folder (see `netlify.toml`). After changing files, bump `VERSION` in `public/sw.js` so phones pick up the update.

## Install on your phone
- iPhone: open the site in Safari → Share → Add to Home Screen
- Android: open in Chrome → ⋮ → Install app

// "For you" suggestions, worked out on the phone with no AI service.
//
// 1. Describe each recipe by a few features: key ingredients, meal, texture, dish type.
// 2. Build a taste profile from likes, favourites and "how did it sit?" notes
//    (dislikes and meals that sat badly count against their features).
// 3. Fill most slots with the best matches, but reserve some for recipes you haven't
//    tried yet, and penalise picks that look like ones already chosen. That way one
//    liked pizza doesn't turn into a page of pizzas.

const KEY_INGREDIENTS = [
  'egg', 'lentil', 'tofu', 'paneer', 'halloumi', 'feta', 'cheddar', 'ricotta', 'mozzarella', 'cottage cheese',
  'yoghurt', 'cream', 'potato', 'sweet potato', 'squash', 'carrot', 'spinach', 'courgette', 'pepper', 'cauliflower',
  'leek', 'passata', 'coconut', 'rice', 'pasta', 'spaghetti', 'noodle', 'gnocchi', 'oats', 'polenta', 'bread',
  'banana', 'apple', 'pear', 'mango', 'peanut butter', 'chocolate', 'miso', 'soy', 'ginger', 'cumin', 'garam masala',
  'curry powder', 'butter bean', 'chickpea', 'filo', 'semolina',
];
const DISH_TYPES = [
  ['soup', /soup/i], ['curry', /curry|dhal|korma|paneer|masala/i], ['pasta', /pasta|mac|lasagne|gnocchi|spaghetti|bolognese/i],
  ['bake', /bake|pie|gratin|traybake|lasagne/i], ['rice', /risotto|rice/i], ['eggs', /egg|omelette|shakshuka|tortilla|frittata/i],
  ['sweet', /pudding|custard|bread|muffin|pots|cream|pancake|lassi/i], ['drink', /smoothie|lassi/i],
];

const featureCache = new Map();
export function features(r) {
  if (featureCache.has(r.id)) return featureCache.get(r.id);
  const text = (r.title + ' ' + r.ingredients.join(' ')).toLowerCase();
  const f = new Set([`meal:${r.meal}`, `texture:${r.texture}`]);
  for (const k of KEY_INGREDIENTS) if (text.includes(k)) f.add(`ing:${k}`);
  for (const [name, re] of DISH_TYPES) if (re.test(r.title)) f.add(`dish:${name}`);
  featureCache.set(r.id, f);
  return f;
}

function similarity(a, b) {
  const fa = features(a), fb = features(b);
  let inter = 0;
  for (const x of fa) if (fb.has(x)) inter++;
  return inter / (fa.size + fb.size - inter || 1);
}

// Simple seeded random, so suggestions shuffle once a day rather than on every tap.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {object[]} pool  recipes the person could be shown (already filtered for hidden/avoid/mode)
 * @param {object} signals { ratings: {id: 1|-1}, favourites: Set, log: [{recipeId, sat}] }
 * @param {object[]} all   every recipe, to look up titles for reasons
 * @returns {{recipe, reason, kind}[]}
 */
export function suggest(pool, signals, all, count = 6) {
  const byId = new Map(all.map((r) => [r.id, r]));
  const weights = new Map();
  const add = (recipe, amount) => {
    const f = features(recipe);
    for (const x of f) weights.set(x, (weights.get(x) || 0) + amount / Math.sqrt(f.size));
  };

  const liked = [];
  for (const [id, v] of Object.entries(signals.ratings || {})) {
    const r = byId.get(id);
    if (!r) continue;
    add(r, v > 0 ? 1 : -1);
    if (v > 0) liked.push(r);
  }
  for (const id of signals.favourites || []) {
    const r = byId.get(id);
    if (r) { add(r, 0.8); if (!liked.includes(r)) liked.push(r); }
  }
  const tried = new Set();
  const satBadly = new Map();
  for (const entry of signals.log || []) {
    const r = byId.get(entry.recipeId);
    if (!r) continue;
    tried.add(r.id);
    if (entry.sat === 'good') add(r, 0.5);
    if (entry.sat === 'bad') { add(r, -0.7); satBadly.set(r.id, (satBadly.get(r.id) || 0) + 1); }
  }
  for (const id of Object.keys(signals.ratings || {})) tried.add(id);

  const day = Math.floor(Date.now() / 86400000);
  const rand = seededRandom(day * 7919 + pool.length);
  const scored = pool.map((r) => {
    const f = features(r);
    let s = 0;
    for (const x of f) s += weights.get(x) || 0;
    s = s / Math.sqrt(f.size);
    if (satBadly.has(r.id)) s -= 1.5 * satBadly.get(r.id);
    return { recipe: r, score: s, jitter: rand() * 0.15, untried: !tried.has(r.id) && !(signals.favourites || new Set()).has(r.id) };
  });

  const hasProfile = weights.size > 0;
  const exploreSlots = hasProfile ? Math.max(2, Math.round(count / 3)) : count;
  const picked = [];
  const pickBest = (candidates, scoreFn) => {
    let best = null, bestVal = -Infinity;
    for (const c of candidates) {
      if (picked.some((p) => p.recipe === c.recipe)) continue;
      const maxSim = picked.reduce((m, p) => Math.max(m, similarity(p.recipe, c.recipe)), 0);
      const val = 0.65 * scoreFn(c) - 0.35 * maxSim * 2 + c.jitter;
      if (val > bestVal) { bestVal = val; best = c; }
    }
    return best;
  };

  // Matches for what you like.
  if (hasProfile) {
    // Recipes you already liked live on the Saved tab, so suggest their neighbours instead.
    const seen = new Set([...Object.keys(signals.ratings || {}), ...(signals.favourites || [])]);
    let positive = scored.filter((c) => c.score > 0 && !seen.has(c.recipe.id));
    if (positive.length < count) positive = scored.filter((c) => c.score > 0);
    while (picked.length < count - exploreSlots) {
      const c = pickBest(positive, (x) => x.score);
      if (!c) break;
      const because = liked.reduce((b, l) => (l.id !== c.recipe.id && similarity(l, c.recipe) > (b ? similarity(b, c.recipe) : 0) ? l : b), null);
      picked.push({ ...c, kind: 'match', reason: because ? `Because you liked ${because.title}` : 'Matches what you like' });
    }
  }
  // Something new: untried, not disliked-looking, and different from what's already picked.
  const fresh = scored.filter((c) => c.untried && c.score > -0.25);
  while (picked.length < count) {
    const c = pickBest(fresh.length ? fresh : scored, () => 0.3);
    if (!c) break;
    picked.push({ ...c, kind: 'new', reason: hasProfile ? 'Something new to try' : 'A good place to start' });
  }
  return picked.map(({ recipe, reason, kind }) => ({ recipe, reason, kind }));
}

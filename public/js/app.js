import { store, photos, clearPhotos } from './store.js';
import { scaleLine, agree } from './scale.js';
import { aisleFor, AISLE_ORDER } from './aisles.js';
import { suggest } from './recommend.js';
import { adapt } from './swaps.js';

// ---------- Safe loading ----------
// Stored or restored data is checked before use, so bad data can never stop the app opening.
const isStr = (v) => typeof v === 'string';
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isDate = (v) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const SAT = ['good', 'ok', 'bad'];

const CLEAN = {
  mode: (v) => (v === 'flare' ? 'flare' : 'good'),
  textSize: (v) => (v === 'large' ? 'large' : 'normal'),
  shopView: (v) => (v === 'recipe' ? 'recipe' : 'aisle'),
  favourites: (v) => (Array.isArray(v) ? v.filter(isStr) : []),
  avoid: (v) => (Array.isArray(v) ? v.filter(isStr).map((s) => s.slice(0, 40)) : []),
  ratings: (v) => Object.fromEntries(Object.entries(v && typeof v === 'object' && !Array.isArray(v) ? v : {}).filter(([, r]) => r === 1 || r === -1)),
  servings: (v) => Object.fromEntries(Object.entries(v && typeof v === 'object' && !Array.isArray(v) ? v : {}).filter(([, n]) => int(n, 1, 24))),
  shopping: (v) => (Array.isArray(v) ? v : []).filter((i) => i && isStr(i.text)).map((i) => ({
    id: isStr(i.id) ? i.id : uid(), text: i.text.slice(0, 200), recipeId: isStr(i.recipeId) ? i.recipeId : null, done: i.done === true, planId: isStr(i.planId) ? i.planId : null,
  })),
  plan: (v) => (Array.isArray(v) ? v : []).filter((p) => p && int(p.day, 0, 6) && isStr(p.recipeId) && int(p.servings, 1, 24)).map((p) => ({
    id: isStr(p.id) ? p.id : uid(), day: p.day, recipeId: p.recipeId, servings: p.servings,
  })),
  freezer: (v) => (Array.isArray(v) ? v : []).filter((f) => f && isStr(f.recipeId) && int(f.portions, 1, 99) && isDate(f.frozenOn) && isDate(f.useBy)).map((f) => ({
    id: isStr(f.id) ? f.id : uid(), recipeId: f.recipeId, portions: f.portions, frozenOn: f.frozenOn, useBy: f.useBy,
  })),
  log: (v) => (Array.isArray(v) ? v : []).filter((l) => l && isStr(l.recipeId) && isDate(l.date) && SAT.includes(l.sat)).map((l) => ({
    id: isStr(l.id) ? l.id : uid(), recipeId: l.recipeId, date: l.date, sat: l.sat, note: isStr(l.note) ? l.note.slice(0, 140) : '',
  })),
  seenIntro: (v) => v === true,
};
const load = (key, fallback) => CLEAN[key](store.get(key, fallback));

const state = {
  recipes: [],
  byId: new Map(),
  query: '',
  meal: 'all',
  filters: new Set(),
  panel: null, // open panel on the recipe page: 'plan' | 'cooked' | 'freeze' | null
  showOriginal: new Set(),
};
function loadState() {
  Object.assign(state, {
    mode: load('mode', 'good'),
    favourites: new Set(load('favourites', [])),
    ratings: load('ratings', {}),
    shopping: load('shopping', []),
    shopView: load('shopView', 'aisle'),
    avoid: load('avoid', []),
    plan: load('plan', []),
    freezer: load('freezer', []),
    log: load('log', []),
    servings: load('servings', {}),
    textSize: load('textSize', 'normal'),
    seenIntro: load('seenIntro', false),
  });
  adaptCache.clear();
}
const adaptCache = new Map();
loadState();

const save = {
  favourites: () => store.set('favourites', [...state.favourites]),
  ratings: () => store.set('ratings', state.ratings),
  shopping: () => { store.set('shopping', state.shopping); updateBadge(); },
  plan: () => store.set('plan', state.plan),
  freezer: () => store.set('freezer', state.freezer),
  log: () => store.set('log', state.log),
  servings: () => store.set('servings', state.servings),
  avoid: () => { store.set('avoid', state.avoid); adaptCache.clear(); },
};
store.onError = () => toast('Couldn’t save — your phone’s storage may be full.');

// ---------- Constants ----------
const MEALS = [['all', 'All'], ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snacks & sweet']];
const FILTERS = [
  ['quick', '⏱ 20 min or less', (r) => r.time <= 20],
  ['batch', '🍱 Batch cook', (r) => r.storage?.batch],
  ['few', '🧺 6 ingredients or fewer', (r) => r.ingredients.length <= 6],
  ['smooth', 'Smooth', (r) => r.texture === 'smooth'],
  ['soft', 'Soft', (r) => r.texture === 'soft'],
  ['protein', '💪 Protein', (r) => r.nutrients.includes('protein')],
  ['iron', 'Iron', (r) => r.nutrients.includes('iron')],
  ['untried', '✨ Not tried yet', (r) => !hasTried(r.id)],
];
const TEXTURES = {
  smooth: ['Smooth', 'Blended or puréed. No chewing needed.'],
  soft: ['Soft', 'Tender enough to mash with a fork.'],
  regular: ['Regular', 'Needs normal chewing. Still free of skins, seeds and tough fibres.'],
};
const NUTRIENT_LABEL = { protein: 'Protein', iron: 'Iron', calcium: 'Calcium', b12: 'Vitamin B12' };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const EMOJI = { breakfast: '🥣', lunch: '🥪', dinner: '🍲', snack: '🍮' };
const SAT_LABEL = { good: '😊 Sat well', ok: '😐 OK', bad: '😣 Didn’t sit well' };
const DISCLAIMER = 'Recipe ideas only, not medical advice. Everyone’s Crohn’s is different, so check changes to your diet with your IBD team or dietitian.';
const RULES = [
  ['Vegetarian', 'Eggs and dairy are fine. No meat or fish, including the anchovies hidden in Worcestershire sauce and the animal rennet in parmesan.'],
  ['No mushrooms', 'Left out of every recipe.'],
  ['No whole nuts or seeds', 'Smooth nut butters and tahini only. Seedless jam.'],
  ['No raw veg or skins', 'Veg is peeled and well cooked, and often blended.'],
  ['No sweetcorn, popcorn or peas', 'Often advised against with strictures. Follow your IBD team’s advice.'],
  ['Mild only', 'No chilli. Flavour comes from gentle herbs and warm spices.'],
  ['Low in ultra-processed food', 'Homemade sauces, soups and bakes. Shop-bought staples (stock, gnocchi, mayo, filo) are flagged so you can pick ones with short ingredient lists.'],
];
// Cupboard items most people already have; shown last on the shopping list.
const STAPLES = /^(salt|pepper|black pepper|salt and pepper|olive oil|oil|butter for|oil for|oil and butter|pinch of|.*ground (cumin|turmeric|coriander|cinnamon|ginger)|.*(cumin|paprika|turmeric|garam masala|curry powder|cinnamon|nutmeg|oregano|thyme|cardamom|baking powder|bicarbonate of soda|vanilla extract|mustard powder|asafoetida))\b/i;

// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s).toLowerCase();
const pad = (n) => String(n).padStart(2, '0');
const localIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const fmtTime = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60}` : ''}`);
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
function addMonths(date, months) {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(date.getDate(), last));
  return d;
}
function safeDecode(s) {
  try { return decodeURIComponent(s || ''); } catch { return ''; }
}

const icon = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 3 2l-1 5h6a2 2 0 0 1 2 2.3l-1.3 6.5A2 2 0 0 1 17.7 20H7"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13V4h3v9zM17 13l-4 8a2 2 0 0 1-3-2l1-5H5a2 2 0 0 1-2-2.3l1.3-6.5A2 2 0 0 1 6.3 4H17"/></svg>',
};

function adapted(r) {
  if (!adaptCache.has(r.id)) adaptCache.set(r.id, adapt(r, state.avoid));
  return adaptCache.get(r.id);
}
const isHidden = (id) => state.ratings[id] === -1;
const hasTried = (id) => state.log.some((l) => l.recipeId === id);
const satBadly = (id) => state.log.filter((l) => l.recipeId === id && l.sat === 'bad').length;
const servingsFor = (r) => state.servings[r.id] || r.serves;
// Ingredient lines for this person: swapped where needed, unless they asked to see the original.
function linesFor(r) {
  if (state.showOriginal.has(r.id)) return r.ingredients.slice();
  return adapted(r).lines.filter((l) => l !== null);
}

function available(r) {
  if (isHidden(r.id) || adapted(r).status === 'hidden') return false;
  if (state.mode === 'flare' && !r.gentle) return false;
  return true;
}

function visibleRecipes() {
  const q = norm(state.query.trim());
  return state.recipes.filter((r) => {
    if (!available(r)) return false;
    if (state.meal !== 'all' && r.meal !== state.meal) return false;
    for (const [key, , test] of FILTERS) if (state.filters.has(key) && !test(r)) return false;
    if (q) {
      const hay = norm([r.title, r.summary, r.meal, r.texture, ...r.ingredients].join(' '));
      if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

function photoHtml(r) {
  if (photos.has(r.id)) return `<img src="${esc(photos.url(r.id))}" alt="" loading="lazy" decoding="async">`;
  return `<div class="placeholder" aria-hidden="true">${EMOJI[r.meal] || '🍽️'}</div>`;
}

function favButton(r) {
  const on = state.favourites.has(r.id);
  return `<button type="button" class="fav" data-fav="${esc(r.id)}" aria-pressed="${on}" aria-label="Favourite: ${esc(r.title)}">${icon.heart}</button>`;
}

function card(r, reason) {
  const warn = satBadly(r.id);
  const isAdapted = adapted(r).status === 'adapted';
  return `<article class="card">
    <a class="card-link" href="#/recipe/${esc(r.id)}">
      <div class="ph">${photoHtml(r)}</div>
      <div class="body">
        ${reason ? `<p class="reason">${esc(reason)}</p>` : ''}
        <h3>${esc(r.title)}</h3>
        <div class="meta">
          <span>${fmtTime(r.time)}</span>
          ${r.gentle ? '<span class="tag gentle">Flare-friendly</span>' : ''}
          ${r.storage?.batch ? '<span class="tag batch">Batch cook</span>' : ''}
          ${isAdapted ? '<span class="tag swap">Adapted for you</span>' : ''}
          ${warn ? '<span class="tag warn">Didn’t sit well</span>' : ''}
        </div>
      </div>
    </a>
    ${favButton(r)}
  </article>`;
}

// ---------- Toast with optional Undo ----------
let toastTimer;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" data-undo>Undo</button>' : ''}`;
  t.classList.add('show');
  toast.undo = undo || null;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); toast.undo = null; }, undo ? 6000 : 2400);
}
function announce(msg) {
  const live = $('#sr-live');
  live.textContent = '';
  setTimeout(() => { live.textContent = msg; }, 50);
}
// Snapshot a list, apply a change, and offer to undo it.
function undoable(key, change, message) {
  const before = JSON.stringify(state[key]);
  change();
  save[key]();
  render(true);
  toast(message, () => { state[key] = JSON.parse(before); save[key](); render(true); });
}

function updateBadge() {
  const n = mergedGroups(state.shopping).filter((g) => !g.done).length;
  const b = $('#shop-count');
  b.hidden = n === 0;
  b.textContent = n;
  b.setAttribute('aria-label', `${n} items to buy`);
}

function applyTextSize() {
  document.documentElement.classList.toggle('large-text', state.textSize === 'large');
}

// ---------- Home ----------
function viewHome() {
  const intro = state.seenIntro ? '' : `<div class="intro" role="note">
    <p><strong>Welcome to Gentle Kitchen.</strong> ${esc(DISCLAIMER)}</p>
    <button type="button" class="btn small secondary" data-dismiss-intro>Got it</button></div>`;
  app.innerHTML = `
    ${intro}
    <label class="search">${icon.search}<input id="q" type="search" placeholder="Search recipes or ingredients" value="${esc(state.query)}" autocomplete="off" enterkeyhint="search" aria-label="Search recipes"></label>
    <div class="chips" role="group" aria-label="Meal">
      ${MEALS.map(([k, l]) => `<button type="button" class="chip" data-meal="${k}" aria-pressed="${state.meal === k}">${l}</button>`).join('')}
    </div>
    <div class="chips chips-2" role="group" aria-label="Filters">
      ${FILTERS.map(([k, l]) => `<button type="button" class="chip small" data-filter="${k}" aria-pressed="${state.filters.has(k)}">${l}</button>`).join('')}
    </div>
    <div id="results"></div>`;
  $('#q').addEventListener('input', (e) => { state.query = e.target.value; renderResults(); });
  renderResults();
}

// Only the results change while typing, so the keyboard isn't disturbed.
function renderResults() {
  const list = visibleRecipes();
  const browsing = !state.query && state.meal === 'all' && !state.filters.size;
  const hiddenCount = state.recipes.filter((r) => isHidden(r.id) || adapted(r).status === 'hidden').length;
  let suggestions = '';
  if (browsing) {
    const picks = suggest(state.recipes.filter(available), { ratings: state.ratings, favourites: state.favourites, log: state.log }, state.recipes, 6);
    if (picks.length) {
      suggestions = `<section class="for-you" aria-labelledby="fy-h">
        <div class="row-head"><h2 id="fy-h">Suggested for you</h2><span class="hint">Learns from your likes</span></div>
        <div class="carousel">${picks.map((p) => card(p.recipe, p.reason)).join('')}</div>
      </section>`;
    }
  }
  $('#results').innerHTML = `
    ${state.mode === 'flare' ? '<p class="banner"><strong>Flare day:</strong> showing only the softest, smoothest meals: soups, purées, eggs and puddings.</p>' : ''}
    ${suggestions}
    <div class="row-head"><h2>${browsing ? 'All recipes' : 'Results'}</h2><span class="hint" aria-live="polite">${plural(list.length, 'recipe')}${hiddenCount ? ` · <a href="#/saved/hidden">${hiddenCount} hidden</a>` : ''}</span></div>
    <div class="grid">${list.map((r) => card(r)).join('')}</div>
    ${list.length ? '' : '<div class="empty"><div class="big" aria-hidden="true">🥄</div><p>No recipes match. Try clearing your search or filters.</p></div>'}`;
}

// ---------- Recipe ----------
function viewRecipe(id) {
  const r = state.byId.get(id);
  if (!r) { location.replace('#/'); return; }
  const n = servingsFor(r);
  const factor = n / r.serves;
  const a = adapted(r);
  const original = state.showOriginal.has(r.id);
  const onList = state.shopping.some((i) => i.recipeId === r.id);
  const rating = state.ratings[r.id] || 0;
  const history = state.log.filter((l) => l.recipeId === r.id);
  const s = r.storage || {};
  const bad = satBadly(r.id);

  let ingredients;
  if (a.status === 'adapted' && !original) {
    ingredients = r.ingredients.map((line, i) => {
      const next = a.lines[i];
      if (next === line) return `<li>${esc(scaleLine(line, factor))}</li>`;
      if (next === null) return `<li class="swapped"><span class="swap-tag">Left out</span><s>${esc(scaleLine(line, factor))}</s></li>`;
      return `<li class="swapped"><span class="swap-tag">Swap</span>${esc(scaleLine(next, factor))}<s class="was">${esc(scaleLine(line, factor))}</s></li>`;
    }).join('');
  } else {
    ingredients = r.ingredients.map((line) => `<li>${esc(scaleLine(line, factor))}</li>`).join('');
  }

  app.innerHTML = `
    <article class="detail">
      <div class="hero">
        ${photoHtml(r)}
        <button type="button" class="back" data-back>${icon.back}Back</button>
        ${favButton(r)}
        <label class="photo-btn">${icon.camera}<span>${photos.has(r.id) ? 'Change photo' : 'Add your photo'}</span>
          <input type="file" accept="image/*" data-photo="${esc(r.id)}" class="visually-hidden">
        </label>
        ${photos.has(r.id) ? `<button type="button" class="photo-remove" data-photo-remove="${esc(r.id)}">Remove photo</button>` : ''}
      </div>
      <div class="content">
        <h2>${esc(r.title)}</h2>
        <p class="summary">${esc(r.summary)}</p>
        <div class="facts">
          <span class="tag">⏱ ${fmtTime(r.time)}</span>
          <span class="tag">${TEXTURES[r.texture][0]} texture</span>
          ${r.gentle ? '<span class="tag gentle">Flare-friendly</span>' : ''}
          ${r.storage?.batch ? '<span class="tag batch">🍱 Batch cook</span>' : ''}
          ${r.nutrients.length ? `<span class="tag nutri">Good source of ${r.nutrients.map((k) => NUTRIENT_LABEL[k].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')}</span>` : ''}
        </div>
        ${a.status === 'adapted' ? `<div class="adapted">
          <p><strong>Adapted for you.</strong> ${original ? 'Showing the original recipe.' : 'Swaps are marked below, based on your food list.'}</p>
          ${original ? '' : `<ul>${a.swaps.map((x) => `<li>${x.to === null ? `Leave out ${esc(x.from.replace(/^[\d½¼¾⅓⅔.\s–-]+(g|ml|tbsp|tsp)?\s*/, ''))}` : `<strong>${esc(x.to)}</strong> instead of ${esc(x.from)}`}${x.note ? ` — ${esc(x.note)}` : ''}</li>`).join('')}</ul>`}
          <button type="button" class="linkish" data-toggle-original>${original ? 'Show my swaps' : 'Show original recipe'}</button>
        </div>` : ''}
        ${bad ? `<p class="banner">You noted this didn’t sit well ${plural(bad, 'time')}.</p>` : ''}

        <div class="actions" role="group" aria-label="Recipe actions">
          <a class="btn" href="#/cook/${esc(r.id)}">▶ Cook mode</a>
          <button type="button" class="btn secondary" data-panel="plan" aria-expanded="${state.panel === 'plan'}">📅 Add to plan</button>
          <button type="button" class="btn secondary" data-panel="cooked" aria-expanded="${state.panel === 'cooked'}">✓ I cooked this</button>
          ${s.freezerMonths ? `<button type="button" class="btn secondary" data-panel="freeze" aria-expanded="${state.panel === 'freeze'}">❄️ I froze some</button>` : ''}
        </div>
        ${panelHtml(r)}

        <div class="rate" role="group" aria-label="Do you like this recipe?">
          <span>Like this one?</span>
          <button type="button" class="rate-btn" data-rate="1" aria-pressed="${rating === 1}">${icon.up}<span>Like</span></button>
          <button type="button" class="rate-btn" data-rate="-1" aria-pressed="${rating === -1}">${icon.down}<span>${rating === -1 ? 'Hidden' : 'Not for me'}</span></button>
        </div>

        <div class="tip"><strong>Gut-friendly tip</strong>${esc(r.tip)}</div>

        <div class="section-head">
          <h3>Ingredients</h3>
          <div class="stepper" role="group" aria-label="Servings">
            <button type="button" data-serves="-1" aria-label="Fewer servings">−</button>
            <span aria-live="polite"><b>${n}</b> serving${n === 1 ? '' : 's'}</span>
            <button type="button" data-serves="1" aria-label="More servings">+</button>
          </div>
        </div>
        <ul class="ingredients">${ingredients}</ul>
        <button type="button" class="btn small ${onList ? 'secondary' : ''} add-shop" data-add-shop="${esc(r.id)}">${onList ? '✓ On shopping list' : `+ Add ${plural(n, 'serving')} to shopping list`}</button>

        ${r.swaps.length ? `<div class="section-head"><h3>Swaps</h3></div><ul class="swaps">${r.swaps.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}

        <div class="section-head"><h3>Method</h3></div>
        ${a.status === 'adapted' && !original ? '<p class="fine">The method uses the original ingredient names. Use your swaps where they appear.</p>' : ''}
        <ol class="steps">${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>

        ${storageHtml(r)}

        ${history.length ? `<div class="section-head"><h3>Your notes</h3></div>
          <ul class="history">${history.slice().reverse().map(historyItem).join('')}</ul>` : ''}
        <p class="fine disclaimer">${esc(DISCLAIMER)}</p>
      </div>
    </article>`;
}

function historyItem(h, withTitle = false) {
  const r = state.byId.get(h.recipeId);
  return `<li><span class="sat sat-${esc(h.sat)}">${esc(SAT_LABEL[h.sat] || '')}</span>
    ${withTitle ? `<a href="#/recipe/${esc(h.recipeId)}">${esc(r ? r.title : 'Recipe')}</a>` : ''}
    <span class="when">${esc(fmtDate(h.date))}</span>
    <button type="button" class="x small-x" data-log-remove="${esc(h.id)}" aria-label="Delete this note">×</button>
    ${h.note ? `<span class="note">${esc(h.note)}</span>` : ''}</li>`;
}

function panelHtml(r) {
  if (state.panel === 'plan') {
    const filled = new Set(state.plan.map((p) => p.day));
    return `<div class="panel-inline"><p>Which day? (${plural(servingsFor(r), 'serving')})</p>
      <div class="day-pick">${DAYS.map((d, i) => `<button type="button" class="chip" data-plan-day="${i}" aria-label="${DAY_NAMES[i]}${filled.has(i) ? ', already has a meal' : ''}">${d}${filled.has(i) ? ' <span class="dot" aria-hidden="true">•</span>' : ''}</button>`).join('')}</div>
      <p class="fine">• means that day already has a meal.</p></div>`;
  }
  if (state.panel === 'cooked') {
    return `<form class="panel-inline" id="cooked-form"><p>How did it sit afterwards?</p>
      <div class="day-pick" role="radiogroup" aria-label="How did it sit">
        <label class="chip-radio"><input type="radio" name="sat" value="good" checked><span>😊 Well</span></label>
        <label class="chip-radio"><input type="radio" name="sat" value="ok"><span>😐 OK</span></label>
        <label class="chip-radio"><input type="radio" name="sat" value="bad"><span>😣 Not well</span></label>
      </div>
      <label class="field"><span>Note (optional)</span><input id="cooked-note" maxlength="140" placeholder="e.g. a smaller portion was fine"></label>
      <button class="btn small" type="submit">Save</button>
      <p class="fine">Stored only on this phone.</p></form>`;
  }
  if (state.panel === 'freeze') {
    const s = r.storage;
    return `<form class="panel-inline" id="freeze-form"><p>How many portions did you freeze? Use within ${plural(s.freezerMonths, 'month')}.</p>
      <div class="stepper"><button type="button" data-freeze-step="-1" aria-label="Fewer portions">−</button><span aria-live="polite"><b id="freeze-n">${Math.max(1, servingsFor(r) - 1)}</b> portions</span><button type="button" data-freeze-step="1" aria-label="More portions">+</button></div>
      <button class="btn small" type="submit">Add to freezer list</button></form>`;
  }
  return '';
}

function storageHtml(r) {
  const s = r.storage;
  if (!s) return '';
  const fridge = s.fridgeDays ? plural(s.fridgeDays, 'day') : 'Eat fresh';
  const freezer = s.freezerMonths ? plural(s.freezerMonths, 'month') : 'Don’t freeze';
  const first = s.roomDays
    ? `<div class="store"><span class="store-ico" aria-hidden="true">🫙</span><span><small>In a tin</small>${plural(s.roomDays, 'day')}</span></div>`
    : `<div class="store ${s.fridgeDays ? '' : 'no'}"><span class="store-ico" aria-hidden="true">🥶</span><span><small>Fridge</small>${fridge}</span></div>`;
  return `
    <div class="section-head"><h3>Storage</h3>${s.batch ? '<span class="tag batch">🍱 Good for batch cooking</span>' : ''}</div>
    <div class="store-grid">
      ${first}
      <div class="store ${s.freezerMonths ? '' : 'no'}"><span class="store-ico" aria-hidden="true">❄️</span><span><small>Freezer</small>${freezer}</span></div>
    </div>
    <p class="store-text">${esc(s.text)}</p>
    <p class="store-note">Cool leftovers within 1–2 hours, keep them in sealed containers, and reheat until steaming hot all the way through. If in doubt, throw it out.</p>`;
}

// ---------- Cook mode ----------
let wakeLock = null;
const cook = { id: null, step: 0, checked: new Set() };

async function keepAwake() {
  if (wakeLock && !wakeLock.released) return;
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* not allowed */ }
}
function releaseAwake() {
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}

function stepMinutes(text) {
  const m = text.match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(minutes?|mins?|hours?)/i);
  if (!m) return 0;
  const v = Number(m[2] || m[1]);
  return /hour/i.test(m[3]) ? v * 60 : v;
}

function viewCook(id) {
  const r = state.byId.get(id);
  if (!r) { location.replace('#/'); return; }
  if (cook.id !== id) { cook.id = id; cook.step = 0; cook.checked = new Set(); }
  document.body.classList.add('cooking');
  keepAwake();
  const factor = servingsFor(r) / r.serves;
  const total = r.steps.length + 1;
  const i = cook.step;
  let body;
  if (i === 0) {
    body = `<h2 class="cook-title">Get ready</h2>
      <p class="cook-sub">${esc(r.title)} · ${plural(servingsFor(r), 'serving')}</p>
      <ul class="cook-ingredients">${linesFor(r).map((x, k) => `<li><label><input type="checkbox" data-cook-tick="${k}" ${cook.checked.has(k) ? 'checked' : ''}><span>${esc(scaleLine(x, factor))}</span></label></li>`).join('')}</ul>`;
  } else {
    const text = r.steps[i - 1];
    const mins = stepMinutes(text);
    body = `<p class="cook-count">Step ${i} of ${r.steps.length}</p>
      <p class="cook-step">${esc(text)}</p>
      ${mins ? `<button type="button" class="btn timer-btn" data-timer="${mins}" data-timer-label="Step ${i}">⏲ Start ${fmtTime(mins)} timer</button>` : ''}`;
  }
  app.innerHTML = `
    <div class="cook">
      <div class="cook-top">
        <button type="button" class="btn secondary small" data-cook-exit>✕ Exit</button>
        <div class="progress" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="${total - 1}" aria-valuenow="${i}"><span></span></div>
      </div>
      <div class="cook-body">${body}</div>
      <div class="cook-nav">
        <button type="button" class="btn secondary" data-cook-step="-1" ${i === 0 ? 'disabled' : ''}>← Back</button>
        ${i < total - 1
          ? `<button type="button" class="btn" data-cook-step="1">${i === 0 ? 'Start cooking →' : 'Next step →'}</button>`
          : '<button type="button" class="btn" data-cook-done>Done ✓</button>'}
      </div>
      <p class="fine center">The screen stays on while cook mode is open.</p>
    </div>`;
  $('.progress span').style.width = `${(i / (total - 1)) * 100}%`;
}

// ---------- Timer (shown on every screen while running) ----------
let timer = null; // {end, label, fired, interval}
let audio = null;
function timerBar() {
  const bar = $('#timer-bar');
  if (!timer) { bar.hidden = true; bar.innerHTML = ''; return; }
  const left = Math.max(0, Math.round((timer.end - Date.now()) / 1000));
  bar.hidden = false;
  bar.classList.toggle('done', left === 0);
  bar.innerHTML = `<span>${esc(timer.label)}</span><b>${left === 0 ? 'Time’s up!' : `${pad(Math.floor(left / 60))}:${pad(left % 60)}`}</b>
    <button type="button" class="btn small secondary" data-timer-stop>${left === 0 ? 'OK' : 'Cancel'}</button>`;
}
function tickTimer() {
  if (!timer) return;
  if (!timer.fired && Date.now() >= timer.end) {
    timer.fired = true;
    chime();
    try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch { /* ignore */ }
    announce(`${timer.label}: time’s up`);
  }
  timerBar();
}
function startTimer(mins, label) {
  // Create the sound player during the tap, so iPhone allows it to play later.
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch { audio = null; }
  stopTimer();
  timer = { end: Date.now() + mins * 60000, label, fired: false };
  timer.interval = setInterval(tickTimer, 500);
  announce(`${label}: ${fmtTime(mins)} timer started`);
  timerBar();
}
function stopTimer() {
  if (timer) clearInterval(timer.interval);
  timer = null;
  timerBar();
}
function chime() {
  if (!audio) return;
  try {
    [0, 0.35, 0.7].forEach((t) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, audio.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + t + 0.3);
      o.connect(g).connect(audio.destination);
      o.start(audio.currentTime + t);
      o.stop(audio.currentTime + t + 0.3);
    });
  } catch { /* no audio */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  tickTimer();
  if (location.hash.startsWith('#/cook')) keepAwake();
});

// ---------- Plan & freezer ----------
function viewPlan() {
  const items = state.plan.map((p) => ({ ...p, r: state.byId.get(p.recipeId) })).filter((p) => p.r);
  const freezer = state.freezer.slice().sort((a, b) => a.useBy.localeCompare(b.useBy));
  const today = localIso();
  const soon = localIso(new Date(Date.now() + 14 * 86400000));
  app.innerHTML = `
    <div class="row-head"><h2>This week</h2><span class="hint">${plural(items.length, 'meal')}</span></div>
    <div class="row">
      ${items.length ? '<button type="button" class="btn small" data-plan-shop>+ Add week to shopping list</button>' : ''}
      <button type="button" class="btn small ${items.length ? 'secondary' : ''}" data-plan-fill>✨ ${items.length ? 'Fill empty days' : 'Suggest dinners for the week'}</button>
      ${items.length ? '<button type="button" class="btn small danger" data-plan-clear>Clear week</button>' : ''}
    </div>
    <div class="week">
      ${DAYS.map((d, i) => {
        const day = items.filter((p) => p.day === i);
        return `<section class="day" aria-label="${DAY_NAMES[i]}"><h3>${d}</h3>${day.length ? day.map((p) => `
          <div class="plan-item">
            <a href="#/recipe/${esc(p.r.id)}">${esc(p.r.title)}</a>
            <span class="hint">${plural(p.servings, 'serving')}</span>
            <button type="button" class="x" data-plan-remove="${esc(p.id)}" aria-label="Remove ${esc(p.r.title)} from ${DAY_NAMES[i]}">×</button>
          </div>`).join('') : '<p class="hint">Nothing planned</p>'}</section>`;
      }).join('')}
    </div>

    <div class="row-head"><h2>In the freezer</h2><span class="hint">${plural(freezer.reduce((n, f) => n + f.portions, 0), 'portion')}</span></div>
    ${freezer.length ? `<div class="freezer">${freezer.map((f) => {
      const r = state.byId.get(f.recipeId);
      const status = f.useBy < today ? ['past', 'Past use-by'] : f.useBy <= soon ? ['soon', 'Use soon'] : ['ok', `Use by ${fmtDate(f.useBy)}`];
      return `<div class="freeze-item">
        <div><a href="#/recipe/${esc(f.recipeId)}">${esc(r ? r.title : 'Recipe')}</a>
        <p class="hint">${plural(f.portions, 'portion')} · frozen ${esc(fmtDate(f.frozenOn))}</p></div>
        <span class="tag status-${status[0]}">${esc(status[1])}</span>
        <button type="button" class="btn small secondary" data-freezer-eat="${esc(f.id)}">Ate one</button>
      </div>`;
    }).join('')}</div>` : '<p class="empty-inline">Nothing logged yet. On a recipe that freezes, tap “❄️ I froze some”.</p>'}
    <p class="fine">Use-by dates come from each recipe’s storage advice. Defrost in the fridge and reheat until piping hot.</p>`;
}

function fillWeek() {
  const used = new Set(state.plan.map((p) => p.day));
  const pool = state.recipes.filter((r) => available(r) && r.meal === 'dinner');
  const picks = suggest(pool, { ratings: state.ratings, favourites: state.favourites, log: state.log }, state.recipes, 7)
    .filter((p) => !state.plan.some((x) => x.recipeId === p.recipe.id));
  const empty = [0, 1, 2, 3, 4, 5, 6].filter((d) => !used.has(d));
  if (!empty.length) { toast('Every day already has a meal'); return; }
  undoable('plan', () => {
    for (const d of empty) {
      const p = picks.shift();
      if (!p) break;
      state.plan.push({ id: uid(), day: d, recipeId: p.recipe.id, servings: servingsFor(p.recipe) });
    }
  }, 'Added suggested dinners');
}

// ---------- Shopping ----------
// "1 onion, finely chopped" -> {qty: 1, unit: '', name: 'onion'}
const QTY = /^([\d.]+(?:\s?[½¼¾⅓⅔])?|[½¼¾⅓⅔])\s*(g|kg|ml|litres?|tsp|tbsp)?\s+(.*)$/i;
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
function parseItem(text) {
  const base = text.split(/,| \(/)[0].trim();
  const m = base.match(QTY);
  if (!m) return { qty: null, unit: '', name: base };
  let q = 0;
  for (const part of m[1].split(/\s+/)) q += FRAC[part] ?? (part.match(/[½¼¾⅓⅔]/) ? parseFloat(part) + FRAC[part.slice(-1)] : parseFloat(part));
  return { qty: q, unit: (m[2] || '').toLowerCase(), name: m[3].trim() };
}
const singular = (s) => s.toLowerCase().replace(/(es|s)$/, '');
function mergedGroups(items) {
  const groups = new Map();
  for (const it of items) {
    const p = parseItem(it.text);
    const key = `${p.unit}|${singular(p.name)}`;
    if (!groups.has(key)) groups.set(key, { ...p, ids: [], recipes: new Set(), done: true, text: it.text });
    const g = groups.get(key);
    if (g.ids.length && g.qty !== null && p.qty !== null) g.qty += p.qty;
    else if (g.ids.length && (g.qty === null || p.qty === null)) g.qty = null;
    g.ids.push(it.id);
    if (it.recipeId) g.recipes.add(it.recipeId);
    g.done = g.done && it.done;
  }
  for (const g of groups.values()) {
    if (g.ids.length > 1) {
      const q = g.qty === null ? '' : `${Math.round(g.qty * 100) / 100}${g.unit ? g.unit.replace(/^(tsp|tbsp|litres?)$/, ' $1') : ''} `;
      g.label = `${q}${agree(` ${g.name}`, g.qty ?? 2).trim()}`;
    } else g.label = g.text;
  }
  return [...groups.values()];
}

function viewShopping() {
  const byAisle = state.shopView === 'aisle';
  let sections = '';
  if (byAisle) {
    const groups = mergedGroups(state.shopping);
    const aisles = new Map();
    for (const g of groups) {
      const aisle = STAPLES.test(g.text) ? 'Check the cupboard first' : aisleFor(g.text);
      if (!aisles.has(aisle)) aisles.set(aisle, []);
      aisles.get(aisle).push(g);
    }
    const order = [...AISLE_ORDER, 'Check the cupboard first'].filter((k) => aisles.has(k));
    sections = order.map((k) => `<section class="shop-group"><h3><span>${esc(k)}</span></h3>
      ${aisles.get(k).map((g) => `<label class="check"><input type="checkbox" data-toggle="${esc(g.ids.join(' '))}" ${g.done ? 'checked' : ''}>
        <span>${esc(g.label)}${g.recipes.size ? `<small>${esc([...g.recipes].map((id) => state.byId.get(id)?.title || '').filter(Boolean).join(' · '))}</small>` : ''}</span></label>`).join('')}
    </section>`).join('');
  } else {
    const groups = new Map();
    for (const it of state.shopping) {
      const key = it.recipeId || '_own';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    }
    sections = [...groups].map(([k, items]) => `<section class="shop-group">
      <h3><span>${esc(k === '_own' ? 'My extras' : state.byId.get(k)?.title || 'Recipe')}</span>${k !== '_own' ? `<button type="button" data-remove-group="${esc(k)}">Remove</button>` : ''}</h3>
      ${items.map((i) => `<label class="check"><input type="checkbox" data-toggle="${esc(i.id)}" ${i.done ? 'checked' : ''}><span>${esc(i.text)}</span></label>`).join('')}
    </section>`).join('');
  }
  app.innerHTML = `
    <form class="add-item" id="add-item">
      <input id="new-item" placeholder="Add an item, e.g. bananas" autocomplete="off" enterkeyhint="done" aria-label="New shopping item" maxlength="200">
      <button class="btn" type="submit">Add</button>
    </form>
    ${state.shopping.length ? `
      <div class="seg" role="group" aria-label="Group list by">
        <button type="button" data-shop-view="aisle" aria-pressed="${byAisle}">By aisle</button>
        <button type="button" data-shop-view="recipe" aria-pressed="${!byAisle}">By recipe</button>
      </div>
      <div class="row">
        <button type="button" class="btn small secondary" data-clear-done>Remove ticked</button>
        <button type="button" class="btn small danger" data-clear-all>Clear all</button>
      </div>
      ${sections}`
    : '<div class="empty"><div class="big" aria-hidden="true">🧺</div><p>Your shopping list is empty.<br>Open a recipe and tap “+ Add to shopping list”, or add your week from the Plan tab.</p></div>'}`;
  $('#add-item').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#new-item').value.trim();
    if (!v) return;
    state.shopping.push({ id: uid(), text: v.slice(0, 200), recipeId: null, done: false, planId: null });
    save.shopping();
    viewShopping();
    $('#new-item').focus();
  });
}

function addRecipeToShopping(r, servings, planId = null) {
  const factor = servings / r.serves;
  linesFor(r).forEach((text) => state.shopping.push({ id: uid(), text: scaleLine(text, factor), recipeId: r.id, done: false, planId }));
  save.shopping();
}

// ---------- Saved ----------
const SAVED_TABS = [['favourites', 'Favourites'], ['liked', 'Liked'], ['cooked', 'Cooked'], ['hidden', 'Hidden']];
function viewSaved(tab) {
  if (!SAVED_TABS.some(([k]) => k === tab)) tab = 'favourites';
  let content = '';
  if (tab === 'favourites' || tab === 'liked') {
    const list = tab === 'favourites'
      ? state.recipes.filter((r) => state.favourites.has(r.id))
      : state.recipes.filter((r) => state.ratings[r.id] === 1);
    content = list.length ? `<div class="grid">${list.map((r) => card(r)).join('')}</div>`
      : `<div class="empty"><div class="big" aria-hidden="true">${tab === 'favourites' ? '♡' : '👍'}</div><p>${tab === 'favourites' ? 'Tap the heart on any recipe to keep it here.' : 'Tap 👍 Like on recipes you enjoy. Suggestions learn from them.'}</p></div>`;
  } else if (tab === 'hidden') {
    const disliked = state.recipes.filter((r) => isHidden(r.id));
    const blocked = state.recipes.filter((r) => !isHidden(r.id) && adapted(r).status === 'hidden');
    content = `<p class="fine">Recipes you marked “Not for me” stay out of your lists and suggestions. Bring any back whenever you like.</p>
      ${disliked.length ? `<ul class="hidden-list">${disliked.map((r) => `<li><a href="#/recipe/${esc(r.id)}">${esc(r.title)}</a><button type="button" class="btn small secondary" data-unhide="${esc(r.id)}">Show again</button></li>`).join('')}</ul>` : '<p class="empty-inline">Nothing hidden.</p>'}
      ${blocked.length ? `<h3 class="sub">Hidden by your food list</h3>
        <p class="fine">These use something on your list as the main ingredient, or there’s no safe swap yet.</p>
        <ul class="hidden-list">${blocked.map((r) => `<li><a href="#/recipe/${esc(r.id)}">${esc(r.title)}</a><span class="hint">${esc([...new Set(adapted(r).blockers)].join(', '))}</span></li>`).join('')}</ul>
        <p class="fine">Change your list on the <a href="#/settings">My foods</a> page.</p>` : ''}`;
  } else if (tab === 'cooked') {
    const entries = state.log.slice().reverse();
    const counts = { good: 0, ok: 0, bad: 0 };
    entries.forEach((e) => counts[e.sat]++);
    content = entries.length ? `<p class="fine">${counts.good} sat well · ${counts.ok} OK · ${counts.bad} didn’t sit well. Stored only on this phone.</p>
      <ul class="history">${entries.map((h) => historyItem(h, true)).join('')}</ul>`
      : '<div class="empty"><div class="big" aria-hidden="true">📝</div><p>After cooking, tap “✓ I cooked this” and note how it sat. Patterns show up here over time.</p></div>';
  }
  app.innerHTML = `
    <nav class="seg wide" aria-label="Saved recipes">
      ${SAVED_TABS.map(([k, l]) => `<a href="#/saved/${k}" ${tab === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}
    </nav>
    ${content}`;
}

// ---------- Settings ----------
function viewSettings() {
  const adaptedCount = state.recipes.filter((r) => adapted(r).status === 'adapted').length;
  const hiddenCount = state.recipes.filter((r) => adapted(r).status === 'hidden').length;
  app.innerHTML = `
    <section class="panel">
      <h2>Foods I avoid</h2>
      <p>Add foods that don’t agree with you. Where there’s a safe swap, recipes are adapted and the swap is clearly marked. Recipes built around the food are hidden.</p>
      <form class="add-item flush" id="add-avoid">
        <input id="new-avoid" placeholder="e.g. onion, garlic, dairy" autocomplete="off" enterkeyhint="done" aria-label="Food to avoid" maxlength="40">
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="pills">${state.avoid.map((w) => `<span class="pill">${esc(w)}<button type="button" data-unavoid="${esc(w)}" aria-label="Remove ${esc(w)}">×</button></span>`).join('') || '<span class="hint">Nothing added yet.</span>'}</div>
      ${state.avoid.length ? `<p class="fine">${plural(adaptedCount, 'recipe')} adapted with swaps · ${hiddenCount} hidden.</p>` : ''}
    </section>

    <section class="panel">
      <h2>Text size</h2>
      <div class="seg" role="group" aria-label="Text size">
        <button type="button" data-text-size="normal" aria-pressed="${state.textSize === 'normal'}">Normal</button>
        <button type="button" data-text-size="large" aria-pressed="${state.textSize === 'large'}">Large</button>
      </div>
    </section>

    <section class="panel">
      <h2>Built into every recipe</h2>
      <ul>${RULES.map(([t, d]) => `<li><strong>${esc(t)}.</strong> ${esc(d)}</li>`).join('')}</ul>
    </section>

    <section class="panel">
      <h2>Texture levels</h2>
      <ul>${Object.values(TEXTURES).map(([t, d]) => `<li><strong>${t}.</strong> ${d}</li>`).join('')}</ul>
      <p class="mt">The <strong>Flare day</strong> switch shows only the gentlest smooth and soft meals.</p>
    </section>

    <section class="panel">
      <h2>How suggestions work</h2>
      <p>“Suggested for you” looks at what you like, hide and favourite, and how meals sat. About two-thirds of picks match your taste. The rest are recipes you haven’t tried yet, so you keep finding new things instead of seeing the same dish over and over. It all runs on this phone.</p>
    </section>

    <section class="panel">
      <h2>Back up your data</h2>
      <p>Favourites, notes, plan, freezer list and photos are stored only on this phone. Save a backup before changing phones or clearing your browser.</p>
      <div id="backup-slot"><div class="row flush">
        <button type="button" class="btn small" data-export-start>Save backup</button>
        <label class="btn small secondary">Restore backup<input type="file" accept="application/json,.json" data-import class="visually-hidden"></label>
      </div></div>
    </section>

    <section class="panel">
      <h2>Add to your home screen</h2>
      <p class="flush"><strong>iPhone:</strong> open in Safari, tap Share, then “Add to Home Screen”.<br><strong>Android:</strong> open in Chrome, tap ⋮, then “Install app”.</p>
    </section>

    <section class="panel">
      <h2>Privacy</h2>
      <p class="flush">Gentle Kitchen has no accounts, ads or tracking. Everything you save stays on this phone. The website host (Netlify) keeps standard visit logs, such as IP addresses, for security.</p>
      <div class="row flush mt"><button type="button" class="btn small danger" data-wipe>Delete all my data</button></div>
    </section>

    <section class="panel">
      <h2>Please note</h2>
      <p class="flush">${esc(DISCLAIMER)}</p>
    </section>`;
  $('#add-avoid').addEventListener('submit', (e) => {
    e.preventDefault();
    const words = $('#new-avoid').value.split(',').map((w) => w.trim().slice(0, 40)).filter(Boolean);
    words.forEach((w) => { if (!state.avoid.some((a) => norm(a) === norm(w))) state.avoid.push(w); });
    save.avoid();
    viewSettings();
    if (words.length) {
      const changed = state.recipes.filter((r) => adapted(r).status !== 'ok').length;
      toast(changed ? `${plural(changed, 'recipe')} adapted or hidden` : 'Added — no recipes use that yet');
    }
  });
}

async function exportData(includeNotes) {
  const data = { app: 'gentle-kitchen', version: 2, exported: new Date().toISOString(), store: {}, photos: await photos.exportAll() };
  for (const k of Object.keys(CLEAN)) data.store[k] = store.get(k, undefined);
  if (!includeNotes) data.store.log = [];
  const name = `gentle-kitchen-backup-${localIso()}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Gentle Kitchen backup' });
      toast('Backup ready');
      return;
    }
  } catch { /* cancelled or not allowed: fall back to download */ }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Backup saved to your downloads');
}

async function importData(file) {
  try {
    if (file.size > 60 * 1024 * 1024) throw new Error('too big');
    const data = JSON.parse(await file.text());
    if (data?.app !== 'gentle-kitchen' || typeof data.store !== 'object') throw new Error('not a backup');
    // Check everything first, then write it all.
    const clean = {};
    for (const [k, fn] of Object.entries(CLEAN)) if (k in data.store && data.store[k] !== undefined) clean[k] = fn(data.store[k]);
    const known = new Set(state.recipes.map((r) => r.id));
    const pics = Object.fromEntries(Object.entries(data.photos || {}).filter(([id]) => known.has(id)));
    for (const [k, v] of Object.entries(clean)) store.set(k, v);
    await photos.importAll(pics);
    loadState();
    toast('Backup restored');
    render();
  } catch {
    toast('That file isn’t a Gentle Kitchen backup');
  }
}

async function wipeAll() {
  for (const k of store.keys()) store.remove(k);
  await clearPhotos();
  try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* ignore */ }
  loadState();
  updateBadge();
  applyTextSize();
  toast('All your data has been deleted');
  location.replace('#/');
  render();
}

// ---------- Router ----------
const TITLES = { home: 'Gentle Kitchen', plan: 'Plan', shopping: 'Shopping list', saved: 'Saved', settings: 'My foods' };
let lastListHash = '#/';
let lastRoute = '';
let prevRoute = '';

function render(keepPlace = false) {
  const hash = location.hash || '#/';
  const [, route = '', rawArg] = hash.split('/');
  const arg = safeDecode(rawArg);
  const newRoute = hash !== lastRoute;
  if (newRoute) prevRoute = lastRoute;
  lastRoute = hash;
  if (route !== 'cook') { document.body.classList.remove('cooking'); releaseAwake(); }
  if (route !== 'recipe') state.panel = null;
  const y = window.scrollY;
  let tab = 'home';
  if (route === 'recipe') viewRecipe(arg);
  else if (route === 'cook') viewCook(arg);
  else if (route === 'plan') { tab = 'plan'; viewPlan(); }
  else if (route === 'shopping') { tab = 'shopping'; viewShopping(); }
  else if (route === 'saved') { tab = 'saved'; viewSaved(arg); }
  else if (route === 'settings') { tab = 'settings'; viewSettings(); }
  else viewHome();
  if (route !== 'recipe' && route !== 'cook') lastListHash = hash;
  const inTab = route !== 'recipe' && route !== 'cook';
  document.querySelectorAll('.tabs a').forEach((a) => {
    const on = a.dataset.tab === tab && inTab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('#page-title').textContent = TITLES[tab];
  if (keepPlace || !newRoute) window.scrollTo(0, y);
  else {
    if (route && route !== 'recipe') window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
  timerBar();
}

// Re-render the current view, then put focus back on the control that was used.
function refresh(focusSelector) {
  render(true);
  if (focusSelector) $(focusSelector)?.focus({ preventScroll: true });
}
const sel = (attr, value) => `[${attr}="${CSS.escape(String(value))}"]`;

// ---------- Events ----------
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;
  const d = t.dataset;
  const recipeId = safeDecode(location.hash.split('/')[2]);

  if ('undo' in d) { const fn = toast.undo; toast.undo = null; $('#toast').classList.remove('show'); fn?.(); return; }
  if (d.fav) {
    e.preventDefault();
    const id = d.fav;
    if (state.favourites.has(id)) state.favourites.delete(id); else state.favourites.add(id);
    save.favourites();
    const on = state.favourites.has(id);
    document.querySelectorAll(sel('data-fav', id)).forEach((b) => b.setAttribute('aria-pressed', on));
    toast(on ? 'Saved to favourites' : 'Removed from favourites');
    if (location.hash.startsWith('#/saved')) refresh();
    return;
  }
  if (d.mode) {
    state.mode = d.mode;
    store.set('mode', d.mode);
    document.querySelectorAll('.mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === d.mode));
    toast(d.mode === 'flare' ? 'Flare day: lists show the gentlest meals' : 'Good day: showing all recipes');
    if (!/^#\/(recipe|cook)/.test(location.hash)) refresh(sel('data-mode', d.mode));
    return;
  }
  if ('dismissIntro' in d) { state.seenIntro = true; store.set('seenIntro', true); $('.intro')?.remove(); return; }
  if (d.meal) { state.meal = d.meal; viewHome(); $(sel('data-meal', d.meal))?.focus(); return; }
  if (d.filter) { state.filters.has(d.filter) ? state.filters.delete(d.filter) : state.filters.add(d.filter); viewHome(); $(sel('data-filter', d.filter))?.focus(); return; }
  if ('back' in d) {
    e.preventDefault();
    if (navCount > 0) history.back(); else location.hash = lastListHash;
    return;
  }

  // Recipe page
  if (d.rate) {
    const v = Number(d.rate);
    const before = state.ratings[recipeId];
    if (before === v) delete state.ratings[recipeId]; else state.ratings[recipeId] = v;
    save.ratings();
    const restore = () => { if (before === undefined) delete state.ratings[recipeId]; else state.ratings[recipeId] = before; save.ratings(); refresh(); };
    if (state.ratings[recipeId] === -1) toast('Hidden. Find it under Saved › Hidden', restore);
    else if (state.ratings[recipeId] === 1) toast('Liked. Suggestions will learn from this');
    else toast('Rating cleared');
    refresh(sel('data-rate', d.rate));
    return;
  }
  if ('toggleOriginal' in d) {
    if (state.showOriginal.has(recipeId)) state.showOriginal.delete(recipeId); else state.showOriginal.add(recipeId);
    refresh('[data-toggle-original]');
    return;
  }
  if (d.panel) { state.panel = state.panel === d.panel ? null : d.panel; refresh(sel('data-panel', d.panel)); return; }
  if (d.planDay) {
    const r = state.byId.get(recipeId);
    state.plan.push({ id: uid(), day: Number(d.planDay), recipeId, servings: servingsFor(r) });
    save.plan();
    state.panel = null;
    toast(`Added to ${DAY_NAMES[Number(d.planDay)]}`);
    refresh('[data-panel="plan"]');
    return;
  }
  if (d.freezeStep) {
    const el = $('#freeze-n');
    el.textContent = Math.max(1, Math.min(20, Number(el.textContent) + Number(d.freezeStep)));
    return;
  }
  if (d.serves) {
    const r = state.byId.get(recipeId);
    const n = Math.max(1, Math.min(24, servingsFor(r) + Number(d.serves)));
    if (n === r.serves) delete state.servings[r.id]; else state.servings[r.id] = n;
    save.servings();
    refresh(sel('data-serves', d.serves));
    return;
  }
  if (d.addShop) {
    const r = state.byId.get(d.addShop);
    if (state.shopping.some((i) => i.recipeId === r.id)) { location.hash = '#/shopping'; return; }
    addRecipeToShopping(r, servingsFor(r));
    toast(`Added ${plural(linesFor(r).length, 'item')}`);
    refresh('[data-add-shop]');
    return;
  }
  if (d.photoRemove) {
    if (!d.confirm) {
      d.confirm = '1';
      t.textContent = 'Tap again to remove';
      setTimeout(() => { if (t.isConnected) { delete t.dataset.confirm; t.textContent = 'Remove photo'; } }, 3000);
      return;
    }
    photos.remove(d.photoRemove).then(() => { toast('Photo removed'); refresh(); });
    return;
  }
  if (d.logRemove) {
    undoable('log', () => { state.log = state.log.filter((l) => l.id !== d.logRemove); }, 'Note deleted');
    return;
  }

  // Cook mode
  if (d.cookStep) {
    const r = state.byId.get(cook.id);
    cook.step = Math.max(0, Math.min(r.steps.length, cook.step + Number(d.cookStep)));
    viewCook(cook.id);
    window.scrollTo(0, 0);
    $(sel('data-cook-step', '1'))?.focus({ preventScroll: true }) || $(sel('data-cook-step', '-1'))?.focus({ preventScroll: true });
    return;
  }
  if ('cookExit' in d || 'cookDone' in d) {
    const id = cook.id;
    if ('cookDone' in d) { state.panel = 'cooked'; cook.id = null; }
    const recipeHash = `#/recipe/${encodeURIComponent(id)}`;
    // Step back to the recipe rather than adding another history entry.
    if (prevRoute === recipeHash && navCount > 0) history.back(); else location.replace(recipeHash);
    return;
  }
  if (d.timer) { startTimer(Number(d.timer), d.timerLabel); return; }
  if ('timerStop' in d) { stopTimer(); return; }

  // Plan
  if (d.planRemove) { undoable('plan', () => { state.plan = state.plan.filter((p) => p.id !== d.planRemove); }, 'Removed from your plan'); return; }
  if ('planClear' in d) { undoable('plan', () => { state.plan = []; }, 'Week cleared'); return; }
  if ('planFill' in d) { fillWeek(); return; }
  if ('planShop' in d) {
    const before = JSON.stringify(state.shopping);
    let n = 0;
    for (const p of state.plan) {
      const r = state.byId.get(p.recipeId);
      if (!r || state.shopping.some((i) => i.planId === p.id)) continue;
      addRecipeToShopping(r, p.servings, p.id);
      n++;
    }
    if (n) toast(`Added ${plural(n, 'meal')} to your list`, () => { state.shopping = JSON.parse(before); save.shopping(); refresh(); });
    else toast('Already on your shopping list');
    return;
  }
  if (d.freezerEat) {
    undoable('freezer', () => {
      const f = state.freezer.find((x) => x.id === d.freezerEat);
      if (f) { f.portions--; if (f.portions <= 0) state.freezer = state.freezer.filter((x) => x !== f); }
    }, 'One portion used');
    return;
  }

  // Shopping
  if (d.shopView) { state.shopView = d.shopView; store.set('shopView', d.shopView); refresh(sel('data-shop-view', d.shopView)); return; }
  if (d.removeGroup) { undoable('shopping', () => { state.shopping = state.shopping.filter((i) => i.recipeId !== d.removeGroup); }, 'Recipe removed from list'); return; }
  if ('clearDone' in d) { undoable('shopping', () => { state.shopping = state.shopping.filter((i) => !i.done); }, 'Ticked items removed'); return; }
  if ('clearAll' in d) { undoable('shopping', () => { state.shopping = []; }, 'List cleared'); return; }

  // Saved & settings
  if (d.unhide) { delete state.ratings[d.unhide]; save.ratings(); toast('Back in your recipes'); refresh(); return; }
  if (d.unavoid) {
    undoable('avoid', () => { state.avoid = state.avoid.filter((w) => w !== d.unavoid); adaptCache.clear(); }, `${d.unavoid} removed from your list`);
    adaptCache.clear();
    return;
  }
  if (d.textSize) { state.textSize = d.textSize; store.set('textSize', d.textSize); applyTextSize(); refresh(sel('data-text-size', d.textSize)); return; }
  if ('exportStart' in d) {
    $('#backup-slot').innerHTML = `<div class="panel-inline flush"><p>This file includes your “how did it sit” notes, which are health information. Keep it somewhere private.</p>
      <div class="row flush"><button type="button" class="btn small" data-export="1">Save with notes</button>
      <button type="button" class="btn small secondary" data-export="0">Save without notes</button></div></div>`;
    $('[data-export="1"]').focus();
    return;
  }
  if (d.export) { exportData(d.export === '1'); return; }
  if ('wipe' in d) {
    if (!d.confirm) {
      d.confirm = '1';
      t.textContent = 'Tap again to delete everything';
      setTimeout(() => { if (t.isConnected) { delete t.dataset.confirm; t.textContent = 'Delete all my data'; } }, 4000);
      return;
    }
    wipeAll();
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.toggle !== undefined) {
    const ids = new Set(t.dataset.toggle.split(' '));
    state.shopping.forEach((i) => { if (ids.has(i.id)) i.done = t.checked; });
    save.shopping();
  }
  if (t.dataset.cookTick !== undefined) {
    const k = Number(t.dataset.cookTick);
    if (t.checked) cook.checked.add(k); else cook.checked.delete(k);
  }
  if (t.dataset.photo && t.files?.[0]) {
    const id = t.dataset.photo;
    toast('Saving photo…');
    try {
      await photos.save(id, t.files[0]);
      toast('Photo saved on this phone');
    } catch (err) {
      toast(err.message || 'Couldn’t save that photo');
    }
    render(true);
  }
  if ('import' in t.dataset && t.files?.[0]) importData(t.files[0]);
});

document.addEventListener('submit', (e) => {
  const recipeId = safeDecode(location.hash.split('/')[2]);
  if (e.target.id === 'cooked-form') {
    e.preventDefault();
    const sat = new FormData(e.target).get('sat');
    state.log.push({ id: uid(), recipeId, date: localIso(), sat: SAT.includes(sat) ? sat : 'ok', note: $('#cooked-note').value.trim().slice(0, 140) });
    save.log();
    state.panel = null;
    toast(sat === 'bad' ? 'Noted. Sorry it didn’t sit well' : 'Noted, thanks');
    refresh('[data-panel="cooked"]');
  }
  if (e.target.id === 'freeze-form') {
    e.preventDefault();
    const r = state.byId.get(recipeId);
    const portions = Number($('#freeze-n').textContent);
    state.freezer.push({ id: uid(), recipeId, portions, frozenOn: localIso(), useBy: localIso(addMonths(new Date(), r.storage.freezerMonths)) });
    save.freezer();
    state.panel = null;
    toast(`${plural(portions, 'portion')} added to your freezer list`);
    refresh('[data-panel="freeze"]');
  }
});

let navCount = 0; // in-app moves, so Back can return to the same place in the list
window.addEventListener('hashchange', () => { navCount++; render(); });
// Another tab or the installed app changed the data: reload it.
window.addEventListener('storage', (e) => {
  if (e.key && !e.key.startsWith('gk:')) return;
  loadState();
  updateBadge();
  applyTextSize();
  render(true);
});

// ---------- Boot ----------
async function boot() {
  applyTextSize();
  document.querySelectorAll('.mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === state.mode));
  updateBadge();
  try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
  try {
    const [recipes] = await Promise.all([fetch('/recipes.json').then((r) => r.json()), photos.load()]);
    state.recipes = recipes;
    state.byId = new Map(recipes.map((r) => [r.id, r]));
  } catch {
    app.innerHTML = '<div class="empty"><div class="big" aria-hidden="true">⚠️</div><p>Couldn’t load recipes. Check your connection and try again.</p></div>';
    return;
  }
  render();
}

// When a new version of the app is deployed, reload once so it shows straight away.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update();
        // Check again whenever the app is brought back to the front.
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update(); });
      })
      .catch(() => {});
  });
}

boot();

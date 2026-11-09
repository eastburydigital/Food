import { store, photos } from './store.js';
import { scaleLine } from './scale.js';
import { aisleFor, AISLE_ORDER } from './aisles.js';
import { suggest } from './recommend.js';

// ---------- State ----------
const state = {
  recipes: [],
  byId: new Map(),
  mode: store.get('mode', 'good'),
  favourites: new Set(store.get('favourites', [])),
  ratings: store.get('ratings', {}), // id -> 1 (like) | -1 (hidden)
  shopping: store.get('shopping', []), // {text, recipeId, done}
  shopView: store.get('shopView', 'aisle'),
  avoid: store.get('avoid', []),
  plan: store.get('plan', []), // {day 0-6, recipeId, servings}
  freezer: store.get('freezer', []), // {id, recipeId, portions, frozenOn, useBy}
  log: store.get('log', []), // {recipeId, date, sat: good|ok|bad, note}
  servings: store.get('servings', {}), // id -> servings
  textSize: store.get('textSize', 'normal'),
  query: '',
  meal: 'all',
  filters: new Set(),
  panel: null, // open panel on recipe page: 'plan' | 'cooked' | 'freeze'
};

const save = {
  favourites: () => store.set('favourites', [...state.favourites]),
  ratings: () => store.set('ratings', state.ratings),
  shopping: () => { store.set('shopping', state.shopping); updateBadge(); },
  plan: () => store.set('plan', state.plan),
  freezer: () => store.set('freezer', state.freezer),
  log: () => store.set('log', state.log),
  servings: () => store.set('servings', state.servings),
  avoid: () => store.set('avoid', state.avoid),
};

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
const NUTRIENT_LABEL = { protein: 'Protein', iron: 'Iron', calcium: 'Calcium', b12: 'B12' };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EMOJI = { breakfast: '🥣', lunch: '🥪', dinner: '🍲', snack: '🍮' };
const RULES = [
  ['Vegetarian', 'Eggs and dairy are fine. No meat or fish, including the anchovies hidden in Worcestershire sauce and the animal rennet in parmesan.'],
  ['No mushrooms', 'Left out of every recipe.'],
  ['No whole nuts or seeds', 'Smooth nut butters and tahini only. Seedless jam.'],
  ['No raw veg or skins', 'Veg is peeled and well cooked, and often blended.'],
  ['No sweetcorn, popcorn or peas', 'Common stricture risks, so they are left out.'],
  ['Mild only', 'No chilli. Flavour comes from gentle herbs and warm spices.'],
  ['Low in ultra-processed food', 'Homemade sauces, soups and bakes. Shop-bought staples (stock, gnocchi, mayo, filo) are flagged so you can pick ones with short ingredient lists.'],
];

// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => s.toLowerCase();
const todayIso = () => new Date().toISOString().slice(0, 10);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const fmtTime = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60}` : ''}`);
const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const icon = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 3 2l-1 5h6a2 2 0 0 1 2 2.3l-1.3 6.5A2 2 0 0 1 17.7 20H7"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13V4h3v9zM17 13l-4 8a2 2 0 0 1-3-2l1-5H5a2 2 0 0 1-2-2.3l1.3-6.5A2 2 0 0 1 6.3 4H17"/></svg>',
};

function avoidHits(r) {
  if (!state.avoid.length) return [];
  const text = norm(r.title + ' ' + r.ingredients.join(' '));
  return state.avoid.filter((w) => text.includes(norm(w)));
}
const isHidden = (id) => state.ratings[id] === -1;
const hasTried = (id) => state.log.some((l) => l.recipeId === id);
const satBadly = (id) => state.log.filter((l) => l.recipeId === id && l.sat === 'bad').length;
const servingsFor = (r) => state.servings[r.id] || r.serves;

function available(r) {
  if (isHidden(r.id) || avoidHits(r).length) return false;
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
  if (photos.has(r.id)) return `<img src="${photos.url(r.id)}" alt="${esc(r.title)}" loading="lazy" decoding="async">`;
  return `<div class="placeholder" aria-hidden="true">${EMOJI[r.meal] || '🍽️'}</div>`;
}

function favButton(r) {
  const on = state.favourites.has(r.id);
  return `<button type="button" class="fav" data-fav="${esc(r.id)}" aria-pressed="${on}" aria-label="${on ? 'Remove from' : 'Add to'} favourites">${icon.heart}</button>`;
}

function card(r, reason) {
  const warn = satBadly(r.id);
  return `<a class="card" href="#/recipe/${esc(r.id)}">
    <div class="ph">${photoHtml(r)}</div>
    ${favButton(r)}
    <div class="body">
      ${reason ? `<p class="reason">${esc(reason)}</p>` : ''}
      <h3>${esc(r.title)}</h3>
      <div class="meta">
        <span>${fmtTime(r.time)}</span>
        ${r.gentle ? '<span class="tag gentle">Flare-friendly</span>' : ''}
        ${r.storage?.batch ? '<span class="tag batch">Batch</span>' : ''}
        ${warn ? '<span class="tag warn">Sat badly</span>' : ''}
      </div>
    </div>
  </a>`;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function updateBadge() {
  const n = state.shopping.filter((i) => !i.done).length;
  const b = $('#shop-count');
  b.hidden = n === 0;
  b.textContent = n;
}

function applyTextSize() {
  document.documentElement.classList.toggle('large-text', state.textSize === 'large');
}

// ---------- Home ----------
function viewHome() {
  const list = visibleRecipes();
  const browsing = !state.query && state.meal === 'all' && !state.filters.size;
  const hiddenCount = state.recipes.filter((r) => isHidden(r.id) || avoidHits(r).length).length;
  let suggestions = '';
  if (browsing) {
    const picks = suggest(state.recipes.filter(available), {
      ratings: state.ratings, favourites: state.favourites, log: state.log,
    }, state.recipes, 6);
    if (picks.length) {
      suggestions = `<section class="for-you" aria-labelledby="fy-h">
        <div class="row-head"><h2 id="fy-h">Suggested for you</h2><span class="hint">Learns from your 👍 and 👎</span></div>
        <div class="carousel">${picks.map((p) => card(p.recipe, p.reason)).join('')}</div>
      </section>`;
    }
  }
  app.innerHTML = `
    <label class="search">${icon.search}<input id="q" type="search" placeholder="Search recipes or ingredients" value="${esc(state.query)}" autocomplete="off" enterkeyhint="search" aria-label="Search recipes"></label>
    <div class="chips" role="group" aria-label="Meal">
      ${MEALS.map(([k, l]) => `<button type="button" class="chip" data-meal="${k}" aria-pressed="${state.meal === k}">${l}</button>`).join('')}
    </div>
    <div class="chips chips-2" role="group" aria-label="Filters">
      ${FILTERS.map(([k, l]) => `<button type="button" class="chip small" data-filter="${k}" aria-pressed="${state.filters.has(k)}">${l}</button>`).join('')}
    </div>
    ${state.mode === 'flare' ? '<p class="banner"><strong>Flare day:</strong> showing only the softest, smoothest meals: soups, purées, eggs and puddings.</p>' : ''}
    ${suggestions}
    <div class="row-head"><h2>${browsing ? 'All recipes' : 'Results'}</h2><span class="hint">${plural(list.length, 'recipe')}${hiddenCount ? ` · <a href="#/saved/hidden">${hiddenCount} hidden</a>` : ''}</span></div>
    <div class="grid">${list.map((r) => card(r)).join('')}</div>
    ${list.length ? '' : '<div class="empty"><div class="big">🥄</div><p>No recipes match. Try clearing your search or filters.</p></div>'}
  `;
  const q = $('#q');
  q.addEventListener('input', () => {
    state.query = q.value;
    const pos = q.selectionStart;
    viewHome();
    const nq = $('#q');
    nq.focus();
    nq.setSelectionRange(pos, pos);
  });
}

// ---------- Recipe ----------
function viewRecipe(id) {
  const r = state.byId.get(id);
  if (!r) { location.hash = '#/'; return; }
  const n = servingsFor(r);
  const factor = n / r.serves;
  const hits = avoidHits(r).map(norm);
  const onList = state.shopping.some((i) => i.recipeId === r.id);
  const rating = state.ratings[r.id] || 0;
  const history = state.log.filter((l) => l.recipeId === r.id);
  const s = r.storage || {};

  app.innerHTML = `
    <article class="detail">
      <div class="hero">
        ${photoHtml(r)}
        <a class="back" href="#/" data-back>${icon.back}Back</a>
        ${favButton(r)}
        <label class="photo-btn">${icon.camera}<span>${photos.has(r.id) ? 'Change photo' : 'Add your photo'}</span>
          <input type="file" accept="image/*" data-photo="${esc(r.id)}" hidden>
        </label>
        ${photos.has(r.id) ? `<button type="button" class="photo-remove" data-photo-remove="${esc(r.id)}">Remove photo</button>` : ''}
      </div>
      <div class="content">
        <h2>${esc(r.title)}</h2>
        <p class="summary">${esc(r.summary)}</p>
        <div class="facts">
          <span class="tag">⏱ ${fmtTime(r.time)}</span>
          <span class="tag" title="${esc(TEXTURES[r.texture][1])}">${TEXTURES[r.texture][0]} texture</span>
          ${r.gentle ? '<span class="tag gentle">Flare-friendly</span>' : ''}
          ${r.storage?.batch ? '<span class="tag batch">🍱 Batch cook</span>' : ''}
          ${r.nutrients.map((k) => `<span class="tag nutri">${NUTRIENT_LABEL[k]}</span>`).join('')}
        </div>
        ${hits.length ? `<p class="banner">Contains something on your food list: <strong>${esc(hits.join(', '))}</strong></p>` : ''}
        ${satBadly(r.id) ? `<p class="banner">You noted this sat badly ${plural(satBadly(r.id), 'time')}. Maybe try a smaller portion, or skip it for now.</p>` : ''}

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
            <span><b>${n}</b> serving${n === 1 ? '' : 's'}</span>
            <button type="button" data-serves="1" aria-label="More servings">+</button>
          </div>
        </div>
        <ul class="ingredients">
          ${r.ingredients.map((i) => `<li class="${hits.some((h) => norm(i).includes(h)) ? 'hit' : ''}">${esc(scaleLine(i, factor))}</li>`).join('')}
        </ul>
        <button type="button" class="btn small ${onList ? 'secondary' : ''} add-shop" data-add-shop="${esc(r.id)}">${onList ? '✓ On shopping list' : `+ Add ${plural(n, 'serving')} to shopping list`}</button>

        ${r.swaps.length ? `<div class="section-head"><h3>Swaps</h3></div><ul class="swaps">${r.swaps.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}

        <div class="section-head"><h3>Method</h3></div>
        <ol class="steps">${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>

        ${storageHtml(r)}

        ${history.length ? `<div class="section-head"><h3>Your notes</h3></div>
          <ul class="history">${history.slice().reverse().map((h) => `<li><span class="sat sat-${h.sat}">${satLabel(h.sat)}</span><span class="when">${fmtDate(h.date)}</span>${h.note ? `<span class="note">${esc(h.note)}</span>` : ''}</li>`).join('')}</ul>` : ''}
      </div>
    </article>`;
}

function satLabel(s) {
  return { good: '😊 Sat well', ok: '😐 OK', bad: '😣 Sat badly' }[s] || s;
}

function panelHtml(r) {
  if (state.panel === 'plan') {
    return `<div class="panel-inline"><p>Which day? (${plural(servingsFor(r), 'serving')})</p>
      <div class="day-pick">${DAYS.map((d, i) => `<button type="button" class="chip" data-plan-day="${i}">${d}</button>`).join('')}</div></div>`;
  }
  if (state.panel === 'cooked') {
    return `<form class="panel-inline" id="cooked-form"><p>How did it sit afterwards?</p>
      <div class="day-pick">
        <label class="chip-radio"><input type="radio" name="sat" value="good" checked><span>😊 Well</span></label>
        <label class="chip-radio"><input type="radio" name="sat" value="ok"><span>😐 OK</span></label>
        <label class="chip-radio"><input type="radio" name="sat" value="bad"><span>😣 Badly</span></label>
      </div>
      <label class="field"><span>Note (optional)</span><input id="cooked-note" maxlength="140" placeholder="e.g. smaller portion was fine"></label>
      <button class="btn small" type="submit">Save note</button>
      <p class="fine">Only stored on this phone. You can add a note later too.</p></form>`;
  }
  if (state.panel === 'freeze') {
    const s = r.storage;
    return `<form class="panel-inline" id="freeze-form"><p>How many portions did you freeze? Use within ${plural(s.freezerMonths, 'month')}.</p>
      <div class="stepper"><button type="button" data-freeze-step="-1" aria-label="Fewer">−</button><span><b id="freeze-n">${Math.max(1, servingsFor(r) - 1)}</b> portions</span><button type="button" data-freeze-step="1" aria-label="More">+</button></div>
      <button class="btn small" type="submit">Add to freezer list</button></form>`;
  }
  return '';
}

function storageHtml(r) {
  const s = r.storage;
  if (!s) return '';
  const fridge = s.fridgeDays ? plural(s.fridgeDays, 'day') : 'Eat fresh';
  const freezer = s.freezerMonths ? plural(s.freezerMonths, 'month') : "Don't freeze";
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
let timer = null; // {end, label, interval}
const cook = { id: null, step: 0 };

async function keepAwake() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* not allowed */ }
}
function releaseAwake() {
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && location.hash.startsWith('#/cook')) keepAwake();
});

function stepMinutes(text) {
  const m = text.match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(minutes?|mins?|hours?)/i);
  if (!m) return 0;
  const v = Number(m[2] || m[1]);
  return /hour/i.test(m[3]) ? v * 60 : v;
}

function viewCook(id) {
  const r = state.byId.get(id);
  if (!r) { location.hash = '#/'; return; }
  if (cook.id !== id) { cook.id = id; cook.step = 0; }
  document.body.classList.add('cooking');
  keepAwake();
  const factor = servingsFor(r) / r.serves;
  const total = r.steps.length + 1;
  const i = cook.step;
  let body;
  if (i === 0) {
    body = `<h2 class="cook-title">Get ready</h2>
      <p class="cook-sub">${esc(r.title)} · ${plural(servingsFor(r), 'serving')}</p>
      <ul class="cook-ingredients">${r.ingredients.map((x) => `<li><label><input type="checkbox"><span>${esc(scaleLine(x, factor))}</span></label></li>`).join('')}</ul>`;
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
        <a class="btn secondary small" href="#/recipe/${esc(r.id)}">✕ Exit</a>
        <div class="progress" aria-hidden="true"><span style="width:${(i / (total - 1)) * 100}%"></span></div>
      </div>
      <div class="cook-body">${body}</div>
      <div id="timer-slot">${timerHtml()}</div>
      <div class="cook-nav">
        <button type="button" class="btn secondary" data-cook-step="-1" ${i === 0 ? 'disabled' : ''}>← Back</button>
        ${i < total - 1
          ? `<button type="button" class="btn" data-cook-step="1">${i === 0 ? 'Start cooking →' : 'Next step →'}</button>`
          : `<a class="btn" href="#/recipe/${esc(r.id)}" data-finish-cook>Done ✓</a>`}
      </div>
      <p class="fine center">The screen stays on while cook mode is open.</p>
    </div>`;
}

function timerHtml() {
  if (!timer) return '';
  const left = Math.max(0, Math.round((timer.end - Date.now()) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return `<div class="timer ${left === 0 ? 'done' : ''}" role="timer" aria-live="off">
    <span>${esc(timer.label)}</span><b>${left === 0 ? 'Time’s up!' : `${mm}:${ss}`}</b>
    <button type="button" class="btn small secondary" data-timer-stop>${left === 0 ? 'OK' : 'Cancel'}</button></div>`;
}

function startTimer(mins, label) {
  stopTimer();
  timer = { end: Date.now() + mins * 60000, label, fired: false };
  timer.interval = setInterval(() => {
    const slot = $('#timer-slot');
    if (slot) slot.innerHTML = timerHtml();
    if (!timer.fired && Date.now() >= timer.end) {
      timer.fired = true;
      chime();
      try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch { /* ignore */ }
      toast(`${timer.label}: time's up`);
    }
  }, 500);
  const slot = $('#timer-slot');
  if (slot) slot.innerHTML = timerHtml();
}
function stopTimer() {
  if (timer) clearInterval(timer.interval);
  timer = null;
  const slot = $('#timer-slot');
  if (slot) slot.innerHTML = '';
}
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch { /* no audio */ }
}

// ---------- Plan & freezer ----------
function viewPlan() {
  const items = state.plan.map((p, idx) => ({ ...p, idx, r: state.byId.get(p.recipeId) })).filter((p) => p.r);
  const freezer = state.freezer.slice().sort((a, b) => a.useBy.localeCompare(b.useBy));
  const today = todayIso();
  const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  app.innerHTML = `
    <div class="row-head"><h2>This week</h2><span class="hint">${plural(items.length, 'meal')}</span></div>
    ${items.length ? `<div class="row">
      <button type="button" class="btn small" data-plan-shop>+ Add week to shopping list</button>
      <button type="button" class="btn small secondary" data-plan-fill>✨ Fill empty days</button>
      <button type="button" class="btn small danger" data-plan-clear>Clear week</button>
    </div>` : `<div class="row"><button type="button" class="btn small" data-plan-fill>✨ Suggest dinners for the week</button></div>`}
    <div class="week">
      ${DAYS.map((d, i) => {
        const day = items.filter((p) => p.day === i);
        return `<section class="day"><h3>${d}</h3>${day.length ? day.map((p) => `
          <div class="plan-item">
            <a href="#/recipe/${esc(p.r.id)}">${esc(p.r.title)}</a>
            <span class="hint">${plural(p.servings, 'serving')}</span>
            <button type="button" class="x" data-plan-remove="${p.idx}" aria-label="Remove ${esc(p.r.title)} from ${d}">×</button>
          </div>`).join('') : '<p class="hint">Nothing planned</p>'}</section>`;
      }).join('')}
    </div>

    <div class="row-head"><h2>In the freezer</h2><span class="hint">${plural(freezer.reduce((n, f) => n + f.portions, 0), 'portion')}</span></div>
    ${freezer.length ? `<div class="freezer">${freezer.map((f) => {
      const r = state.byId.get(f.recipeId);
      const status = f.useBy < today ? ['past', 'Past use-by'] : f.useBy <= soon ? ['soon', 'Use soon'] : ['ok', `Use by ${fmtDate(f.useBy)}`];
      return `<div class="freeze-item">
        <div><a href="#/recipe/${esc(f.recipeId)}">${esc(r ? r.title : 'Recipe')}</a>
        <p class="hint">${plural(f.portions, 'portion')} · frozen ${fmtDate(f.frozenOn)}</p></div>
        <span class="tag status-${status[0]}">${status[1]}</span>
        <button type="button" class="btn small secondary" data-freezer-eat="${esc(f.id)}">Ate one</button>
      </div>`;
    }).join('')}</div>` : '<p class="empty-inline">Nothing logged yet. On a recipe that freezes, tap “❄️ I froze some”.</p>'}
    <p class="fine">Use-by dates come from each recipe's storage advice. Defrost in the fridge and reheat until piping hot.</p>`;
}

function fillWeek() {
  const used = new Set(state.plan.map((p) => p.day));
  const pool = state.recipes.filter((r) => available(r) && r.meal === 'dinner');
  const picks = suggest(pool, { ratings: state.ratings, favourites: state.favourites, log: state.log }, state.recipes, 7)
    .filter((p) => !state.plan.some((x) => x.recipeId === p.recipe.id));
  let added = 0;
  for (let d = 0; d < 7 && picks.length; d++) {
    if (used.has(d)) continue;
    const p = picks.shift();
    state.plan.push({ day: d, recipeId: p.recipe.id, servings: servingsFor(p.recipe) });
    added++;
  }
  save.plan();
  toast(added ? `Added ${plural(added, 'dinner')}` : 'Every day already has a meal');
  viewPlan();
}

// ---------- Shopping ----------
function viewShopping() {
  const items = state.shopping.map((it, idx) => ({ ...it, idx }));
  const byAisle = state.shopView === 'aisle';
  const groups = new Map();
  for (const it of items) {
    const key = byAisle ? aisleFor(it.text) : (it.recipeId || '_own');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const keys = byAisle ? AISLE_ORDER.filter((k) => groups.has(k)) : [...groups.keys()];
  const title = (k) => (byAisle ? k : k === '_own' ? 'My extras' : state.byId.get(k)?.title || 'Recipe');
  app.innerHTML = `
    <form class="add-item" id="add-item">
      <input id="new-item" placeholder="Add an item, e.g. bananas" autocomplete="off" enterkeyhint="done" aria-label="New shopping item">
      <button class="btn" type="submit">Add</button>
    </form>
    ${items.length ? `
      <div class="seg" role="group" aria-label="Group list by">
        <button type="button" data-shop-view="aisle" aria-pressed="${byAisle}">By aisle</button>
        <button type="button" data-shop-view="recipe" aria-pressed="${!byAisle}">By recipe</button>
      </div>
      <div class="row">
        <button type="button" class="btn small secondary" data-clear-done>Remove ticked</button>
        <button type="button" class="btn small danger" data-clear-all>Clear all</button>
      </div>
      ${keys.map((k) => `
        <section class="shop-group">
          <h3><span>${esc(title(k))}</span>${!byAisle && k !== '_own' ? `<button type="button" data-remove-group="${esc(k)}">Remove</button>` : ''}</h3>
          ${groups.get(k).map((i) => `<label class="check"><input type="checkbox" data-toggle="${i.idx}" ${i.done ? 'checked' : ''}><span>${esc(i.text)}${byAisle && i.recipeId ? `<small>${esc(state.byId.get(i.recipeId)?.title || '')}</small>` : ''}</span></label>`).join('')}
        </section>`).join('')}`
    : '<div class="empty"><div class="big">🧺</div><p>Your shopping list is empty.<br>Open a recipe and tap “+ Add to shopping list”, or add your week from the Plan tab.</p></div>'}
  `;
  $('#add-item').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#new-item').value.trim();
    if (!v) return;
    state.shopping.push({ text: v, recipeId: null, done: false });
    save.shopping();
    viewShopping();
    $('#new-item').focus();
  });
}

function addRecipeToShopping(r, servings) {
  const factor = servings / r.serves;
  r.ingredients.forEach((text) => state.shopping.push({ text: scaleLine(text, factor), recipeId: r.id, done: false }));
  save.shopping();
}

// ---------- Saved ----------
function viewSaved(tab = 'favourites') {
  const tabs = [['favourites', 'Favourites'], ['liked', 'Liked'], ['cooked', 'Cooked'], ['hidden', 'Hidden']];
  let content = '';
  if (tab === 'favourites' || tab === 'liked') {
    const list = tab === 'favourites'
      ? state.recipes.filter((r) => state.favourites.has(r.id))
      : state.recipes.filter((r) => state.ratings[r.id] === 1);
    content = list.length ? `<div class="grid">${list.map((r) => card(r)).join('')}</div>`
      : `<div class="empty"><div class="big">${tab === 'favourites' ? '♡' : '👍'}</div><p>${tab === 'favourites' ? 'Tap the heart on any recipe to keep it here.' : 'Tap 👍 Like on recipes you enjoy. Suggestions will learn from them.'}</p></div>`;
  } else if (tab === 'hidden') {
    const disliked = state.recipes.filter((r) => isHidden(r.id));
    const avoided = state.recipes.filter((r) => !isHidden(r.id) && avoidHits(r).length);
    content = `<p class="fine">Recipes you marked “Not for me” stay out of your lists and suggestions. Bring any back whenever you like.</p>
      ${disliked.length ? `<ul class="hidden-list">${disliked.map((r) => `<li><a href="#/recipe/${esc(r.id)}">${esc(r.title)}</a><button type="button" class="btn small secondary" data-unhide="${esc(r.id)}">Show again</button></li>`).join('')}</ul>` : '<p class="empty-inline">Nothing hidden.</p>'}
      ${avoided.length ? `<h3 class="sub">Hidden by your food list</h3><ul class="hidden-list">${avoided.map((r) => `<li><a href="#/recipe/${esc(r.id)}">${esc(r.title)}</a><span class="hint">${esc(avoidHits(r).join(', '))}</span></li>`).join('')}</ul><p class="fine">Change these on the <a href="#/settings">My foods</a> page.</p>` : ''}`;
  } else if (tab === 'cooked') {
    const entries = state.log.slice().reverse();
    const counts = { good: 0, ok: 0, bad: 0 };
    entries.forEach((e) => counts[e.sat]++);
    content = entries.length ? `<p class="fine">${counts.good} sat well · ${counts.ok} OK · ${counts.bad} sat badly. Only stored on this phone. Bring it to appointments if it helps.</p>
      <ul class="history">${entries.map((h) => {
        const r = state.byId.get(h.recipeId);
        return `<li><span class="sat sat-${h.sat}">${satLabel(h.sat)}</span><a href="#/recipe/${esc(h.recipeId)}">${esc(r ? r.title : 'Recipe')}</a><span class="when">${fmtDate(h.date)}</span>${h.note ? `<span class="note">${esc(h.note)}</span>` : ''}</li>`;
      }).join('')}</ul>`
      : '<div class="empty"><div class="big">📝</div><p>After cooking, tap “✓ I cooked this” and note how it sat. Patterns show up here over time.</p></div>';
  }
  app.innerHTML = `
    <div class="seg wide" role="tablist" aria-label="Saved recipes">
      ${tabs.map(([k, l]) => `<a role="tab" href="#/saved/${k}" aria-selected="${tab === k}">${l}</a>`).join('')}
    </div>
    ${content}`;
}

// ---------- Settings ----------
function viewSettings() {
  app.innerHTML = `
    <section class="panel">
      <h2>Foods I avoid</h2>
      <p>Add any foods that don't agree with you. Recipes that contain them are hidden.</p>
      <form class="add-item" id="add-avoid" style="margin:0">
        <input id="new-avoid" placeholder="e.g. onion, garlic, lentils" autocomplete="off" enterkeyhint="done" aria-label="Food to avoid">
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="pills">${state.avoid.map((w, i) => `<span class="pill">${esc(w)}<button type="button" data-unavoid="${i}" aria-label="Remove ${esc(w)}">×</button></span>`).join('') || '<span class="hint">Nothing added yet.</span>'}</div>
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
      <p style="margin-top:8px">The <strong>Flare day</strong> switch shows only the gentlest smooth and soft meals.</p>
    </section>

    <section class="panel">
      <h2>How suggestions work</h2>
      <p>“Suggested for you” looks at what you like, hide, favourite and how meals sat. About two-thirds of picks match your taste. The rest are recipes you haven't tried yet, so you keep discovering new things instead of seeing the same dish over and over. It all runs on this phone.</p>
    </section>

    <section class="panel">
      <h2>Back up your data</h2>
      <p>Your favourites, notes, plan, freezer list and photos are stored only on this phone. Save a backup file before changing phones or clearing your browser.</p>
      <div class="row" style="margin:0">
        <button type="button" class="btn small" data-export>Save backup</button>
        <label class="btn small secondary">Restore backup<input type="file" accept="application/json,.json" data-import hidden></label>
      </div>
    </section>

    <section class="panel">
      <h2>Add to your home screen</h2>
      <p style="margin:0"><strong>iPhone:</strong> open in Safari, tap Share, then “Add to Home Screen”.<br><strong>Android:</strong> open in Chrome, tap ⋮, then “Install app”.</p>
    </section>

    <section class="panel">
      <h2>Please note</h2>
      <p style="margin:0">These recipes are general ideas, not medical advice. Everyone's Crohn's is different, so check big changes with your IBD team or dietitian, especially during a flare.</p>
    </section>`;
  $('#add-avoid').addEventListener('submit', (e) => {
    e.preventDefault();
    const words = $('#new-avoid').value.split(',').map((w) => w.trim()).filter(Boolean);
    words.forEach((w) => { if (!state.avoid.some((a) => norm(a) === norm(w))) state.avoid.push(w); });
    save.avoid();
    viewSettings();
    if (words.length) toast('Recipes with these are now hidden');
  });
}

async function exportData() {
  const data = { app: 'gentle-kitchen', version: 1, exported: new Date().toISOString(), store: {}, photos: await photos.exportAll() };
  for (const k of store.keys()) data.store[k] = store.get(k);
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gentle-kitchen-backup-${todayIso()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Backup saved to your downloads');
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'gentle-kitchen') throw new Error('not a backup');
    for (const [k, v] of Object.entries(data.store || {})) store.set(k, v);
    await photos.importAll(data.photos);
    toast('Backup restored');
    setTimeout(() => location.reload(), 600);
  } catch {
    toast('That file isn’t a Gentle Kitchen backup');
  }
}

// ---------- Router ----------
const TITLES = { home: 'Gentle Kitchen', plan: 'Plan', shopping: 'Shopping list', saved: 'Saved', settings: 'My foods' };
let lastListHash = '#/';
let navCount = 0;

function render() {
  const hash = location.hash || '#/';
  const [, route, arg] = hash.split('/');
  if (route !== 'cook') { document.body.classList.remove('cooking'); releaseAwake(); }
  if (route !== 'recipe') state.panel = null;
  let tab = 'home';
  if (route === 'recipe') viewRecipe(decodeURIComponent(arg || ''));
  else if (route === 'cook') viewCook(decodeURIComponent(arg || ''));
  else if (route === 'plan') { tab = 'plan'; viewPlan(); }
  else if (route === 'shopping') { tab = 'shopping'; viewShopping(); }
  else if (route === 'saved') { tab = 'saved'; viewSaved(arg || 'favourites'); }
  else if (route === 'settings') { tab = 'settings'; viewSettings(); }
  else viewHome();
  if (route !== 'recipe' && route !== 'cook') lastListHash = hash;
  if (route && route !== 'recipe') window.scrollTo(0, 0);
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab && route !== 'recipe' && route !== 'cook'));
  $('#page-title').textContent = TITLES[tab];
}

function rerenderRecipe(id, keepScroll = true) {
  const y = window.scrollY;
  viewRecipe(id);
  if (keepScroll) window.scrollTo(0, y);
}

// ---------- Events ----------
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;
  const d = t.dataset;
  const recipeId = decodeURIComponent((location.hash.split('/')[2] || ''));

  if (d.fav) {
    e.preventDefault(); e.stopPropagation();
    const id = d.fav;
    if (state.favourites.has(id)) state.favourites.delete(id); else state.favourites.add(id);
    save.favourites();
    const on = state.favourites.has(id);
    document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', `${on ? 'Remove from' : 'Add to'} favourites`);
    });
    toast(on ? 'Saved to favourites' : 'Removed from favourites');
    if (location.hash.startsWith('#/saved')) render();
    return;
  }
  if (d.mode) {
    state.mode = d.mode;
    store.set('mode', d.mode);
    document.querySelectorAll('.mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === d.mode));
    if (!/^#\/(recipe|cook)/.test(location.hash)) render();
    return;
  }
  if (d.meal) { state.meal = d.meal; viewHome(); return; }
  if (d.filter) { state.filters.has(d.filter) ? state.filters.delete(d.filter) : state.filters.add(d.filter); viewHome(); return; }
  if ('back' in d) {
    e.preventDefault();
    if (navCount > 0) history.back(); else location.hash = lastListHash;
    return;
  }

  // Recipe page
  if (d.rate) {
    const v = Number(d.rate);
    if (state.ratings[recipeId] === v) delete state.ratings[recipeId];
    else state.ratings[recipeId] = v;
    save.ratings();
    if (state.ratings[recipeId] === -1) toast('Hidden. Find it under Saved › Hidden');
    else if (state.ratings[recipeId] === 1) toast('Liked. Suggestions will learn from this');
    else toast('Rating cleared');
    rerenderRecipe(recipeId);
    return;
  }
  if (d.panel) { state.panel = state.panel === d.panel ? null : d.panel; rerenderRecipe(recipeId); return; }
  if (d.planDay) {
    const r = state.byId.get(recipeId);
    state.plan.push({ day: Number(d.planDay), recipeId, servings: servingsFor(r) });
    save.plan();
    state.panel = null;
    toast(`Added to ${DAYS[Number(d.planDay)]}`);
    rerenderRecipe(recipeId);
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
    rerenderRecipe(recipeId);
    return;
  }
  if (d.addShop) {
    const r = state.byId.get(d.addShop);
    if (state.shopping.some((i) => i.recipeId === r.id)) { location.hash = '#/shopping'; return; }
    addRecipeToShopping(r, servingsFor(r));
    toast(`Added ${plural(r.ingredients.length, 'item')}`);
    rerenderRecipe(r.id);
    return;
  }
  if (d.photoRemove) {
    photos.remove(d.photoRemove).then(() => { toast('Photo removed'); rerenderRecipe(d.photoRemove); });
    return;
  }

  // Cook mode
  if (d.cookStep) {
    const r = state.byId.get(cook.id);
    cook.step = Math.max(0, Math.min(r.steps.length, cook.step + Number(d.cookStep)));
    viewCook(cook.id);
    window.scrollTo(0, 0);
    return;
  }
  if (d.timer) { startTimer(Number(d.timer), d.timerLabel); return; }
  if ('timerStop' in d) { stopTimer(); return; }
  if ('finishCook' in d) { stopTimer(); state.panel = 'cooked'; cook.id = null; return; }

  // Plan
  if (d.planRemove) { state.plan.splice(Number(d.planRemove), 1); save.plan(); viewPlan(); return; }
  if ('planClear' in d) { state.plan = []; save.plan(); toast('Week cleared'); viewPlan(); return; }
  if ('planFill' in d) { fillWeek(); return; }
  if ('planShop' in d) {
    let n = 0;
    for (const p of state.plan) {
      const r = state.byId.get(p.recipeId);
      if (!r || state.shopping.some((i) => i.recipeId === r.id)) continue;
      addRecipeToShopping(r, p.servings);
      n++;
    }
    toast(n ? `Added ${plural(n, 'recipe')} to your list` : 'Already on your shopping list');
    return;
  }
  if (d.freezerEat) {
    const f = state.freezer.find((x) => x.id === d.freezerEat);
    if (f) { f.portions--; if (f.portions <= 0) state.freezer = state.freezer.filter((x) => x !== f); }
    save.freezer();
    viewPlan();
    return;
  }

  // Shopping
  if (d.shopView) { state.shopView = d.shopView; store.set('shopView', d.shopView); viewShopping(); return; }
  if (d.removeGroup) { state.shopping = state.shopping.filter((i) => i.recipeId !== d.removeGroup); save.shopping(); viewShopping(); return; }
  if ('clearDone' in d) { state.shopping = state.shopping.filter((i) => !i.done); save.shopping(); viewShopping(); return; }
  if ('clearAll' in d) {
    if (t.dataset.confirm) { state.shopping = []; save.shopping(); viewShopping(); toast('List cleared'); return; }
    t.dataset.confirm = '1';
    t.textContent = 'Tap again to clear';
    setTimeout(() => { if (t.isConnected) { delete t.dataset.confirm; t.textContent = 'Clear all'; } }, 3000);
    return;
  }

  // Saved & settings
  if (d.unhide) { delete state.ratings[d.unhide]; save.ratings(); toast('Back in your recipes'); viewSaved('hidden'); return; }
  if (d.unavoid) { state.avoid.splice(Number(d.unavoid), 1); save.avoid(); viewSettings(); return; }
  if (d.textSize) { state.textSize = d.textSize; store.set('textSize', d.textSize); applyTextSize(); viewSettings(); return; }
  if ('export' in d) { exportData(); }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.toggle !== undefined) {
    const item = state.shopping[Number(t.dataset.toggle)];
    if (item) { item.done = t.checked; save.shopping(); }
  }
  if (t.dataset.photo && t.files?.[0]) {
    const id = t.dataset.photo;
    toast('Saving photo…');
    try {
      await photos.save(id, t.files[0]);
      toast('Photo saved on this phone');
    } catch (err) {
      toast(err.message || 'Could not save that photo');
    }
    rerenderRecipe(id, false);
  }
  if ('import' in t.dataset && t.files?.[0]) importData(t.files[0]);
});

document.addEventListener('submit', (e) => {
  const recipeId = decodeURIComponent((location.hash.split('/')[2] || ''));
  if (e.target.id === 'cooked-form') {
    e.preventDefault();
    const sat = new FormData(e.target).get('sat');
    state.log.push({ recipeId, date: todayIso(), sat, note: $('#cooked-note').value.trim() });
    save.log();
    state.panel = null;
    toast(sat === 'bad' ? 'Noted. Sorry it didn’t sit well' : 'Noted, thanks');
    rerenderRecipe(recipeId);
  }
  if (e.target.id === 'freeze-form') {
    e.preventDefault();
    const r = state.byId.get(recipeId);
    const portions = Number($('#freeze-n').textContent);
    const useBy = new Date();
    useBy.setMonth(useBy.getMonth() + r.storage.freezerMonths);
    state.freezer.push({ id: `${Date.now()}`, recipeId, portions, frozenOn: todayIso(), useBy: useBy.toISOString().slice(0, 10) });
    save.freezer();
    state.panel = null;
    toast(`${plural(portions, 'portion')} added to your freezer list`);
    rerenderRecipe(recipeId);
  }
});

window.addEventListener('hashchange', () => { navCount++; render(); });

// ---------- Boot ----------
async function boot() {
  applyTextSize();
  document.querySelectorAll('.mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === state.mode));
  updateBadge();
  try {
    const [recipes] = await Promise.all([fetch('/recipes.json').then((r) => r.json()), photos.load()]);
    state.recipes = recipes;
    state.byId = new Map(recipes.map((r) => [r.id, r]));
  } catch {
    app.innerHTML = '<div class="empty"><div class="big">⚠️</div><p>Couldn’t load recipes. Check your connection and try again.</p></div>';
    return;
  }
  render();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

boot();

(() => {
  'use strict';

  // ---------- Storage (safe if blocked) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('gk:' + key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('gk:' + key, JSON.stringify(value)); } catch { /* ignore */ }
    },
  };

  const state = {
    recipes: [],
    photos: {},
    mode: store.get('mode', 'good'),
    favourites: new Set(store.get('favourites', [])),
    shopping: store.get('shopping', []),
    avoid: store.get('avoid', []),
    query: '',
    meal: 'all',
    quick: false,
  };

  const MEALS = [
    ['all', 'All'],
    ['breakfast', 'Breakfast'],
    ['lunch', 'Lunch'],
    ['dinner', 'Dinner'],
    ['snack', 'Snacks & sweet'],
  ];
  const EMOJI = { breakfast: '🥣', lunch: '🥪', dinner: '🍲', snack: '🍮' };

  // Built-in rules shown on the "My foods" page. Recipes were written to follow these.
  const RULES = [
    ['Vegetarian', 'Eggs and dairy are fine. No meat or fish (including hidden anchovies in Worcestershire sauce and animal rennet in parmesan).'],
    ['No mushrooms', 'Left out of every recipe.'],
    ['No whole nuts or seeds', 'Smooth nut butters and tahini only.'],
    ['No raw veg or skins', 'Veg is peeled and well cooked, and often blended.'],
    ['No sweetcorn, popcorn or peas', 'Common stricture risks — left out.'],
    ['Mild only', 'No chilli. Flavour comes from gentle herbs and warm spices.'],
    ['Low in ultra-processed food', 'Homemade sauces, soups and bakes. Shop-bought staples (stock, gnocchi, mayo) are flagged so you can pick ones with short ingredient lists.'],
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $('#app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => s.toLowerCase();

  const heartSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  const searchSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  const backSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

  // ---------- Helpers ----------
  function avoidHits(recipe) {
    if (!state.avoid.length) return [];
    const text = norm(recipe.title + ' ' + recipe.ingredients.join(' '));
    return state.avoid.filter((w) => text.includes(norm(w)));
  }

  function visibleRecipes() {
    const q = norm(state.query.trim());
    return state.recipes.filter((r) => {
      if (state.mode === 'flare' && !r.gentle) return false;
      if (state.meal !== 'all' && r.meal !== state.meal) return false;
      if (state.quick && r.time > 20) return false;
      if (avoidHits(r).length) return false;
      if (q) {
        const hay = norm([r.title, r.summary, r.meal, ...r.ingredients].join(' '));
        if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
      }
      return true;
    });
  }

  function photoHtml(r, cls = '') {
    const p = state.photos[r.id];
    if (!p) return `<div class="placeholder ${cls}" aria-hidden="true">${EMOJI[r.meal] || '🍽️'}</div>`;
    return `<img src="/img/${esc(p.file)}" alt="${esc(r.title)}" loading="lazy" decoding="async">`;
  }

  function favButton(r) {
    const on = state.favourites.has(r.id);
    return `<button type="button" class="fav" data-fav="${esc(r.id)}" aria-pressed="${on}" aria-label="${on ? 'Remove from' : 'Add to'} favourites">${heartSvg}</button>`;
  }

  function card(r) {
    return `<a class="card" href="#/recipe/${esc(r.id)}">
      <div class="ph">${photoHtml(r)}</div>
      ${favButton(r)}
      <div class="body">
        <h3>${esc(r.title)}</h3>
        <div class="meta"><span>${r.time} min</span>${r.gentle ? '<span class="tag gentle">Flare-friendly</span>' : ''}</div>
      </div>
    </a>`;
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  function saveShopping() {
    store.set('shopping', state.shopping);
    const n = state.shopping.filter((i) => !i.done).length;
    const b = $('#shop-count');
    b.hidden = n === 0;
    b.textContent = n;
  }

  function toggleFav(id) {
    if (state.favourites.has(id)) state.favourites.delete(id); else state.favourites.add(id);
    store.set('favourites', [...state.favourites]);
    document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => {
      const on = state.favourites.has(id);
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', `${on ? 'Remove from' : 'Add to'} favourites`);
    });
    toast(state.favourites.has(id) ? 'Saved to favourites' : 'Removed from favourites');
    if (location.hash.startsWith('#/favourites')) render();
  }

  function setMode(mode) {
    state.mode = mode;
    store.set('mode', mode);
    document.querySelectorAll('.mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === mode));
    if (!location.hash.startsWith('#/recipe')) render();
  }

  // ---------- Views ----------
  function viewHome() {
    const list = visibleRecipes();
    const hidden = state.recipes.filter((r) => avoidHits(r).length).length;
    app.innerHTML = `
      <label class="search">${searchSvg}<input id="q" type="search" placeholder="Search recipes or ingredients" value="${esc(state.query)}" autocomplete="off" enterkeyhint="search" aria-label="Search recipes"></label>
      <div class="chips" role="group" aria-label="Filter">
        ${MEALS.map(([k, l]) => `<button type="button" class="chip" data-meal="${k}" aria-pressed="${state.meal === k}">${l}</button>`).join('')}
        <button type="button" class="chip" data-quick aria-pressed="${state.quick}">⏱ 20 min or less</button>
      </div>
      ${state.mode === 'flare' ? '<p class="banner"><strong>Flare day:</strong> showing only the softest, smoothest meals — soups, purées, eggs and puddings.</p>' : ''}
      <p class="count">${list.length} recipe${list.length === 1 ? '' : 's'}${hidden ? ` · ${hidden} hidden by your food list` : ''}</p>
      <div class="grid" id="grid">${list.map(card).join('') || ''}</div>
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

  function viewFavourites() {
    const list = state.recipes.filter((r) => state.favourites.has(r.id));
    app.innerHTML = list.length
      ? `<p class="count">${list.length} favourite${list.length === 1 ? '' : 's'}</p><div class="grid">${list.map(card).join('')}</div>`
      : '<div class="empty"><div class="big">♡</div><p>No favourites yet.<br>Tap the heart on any recipe to save it here.</p></div>';
  }

  function viewRecipe(id) {
    const r = state.recipes.find((x) => x.id === id);
    if (!r) { location.hash = '#/'; return; }
    const p = state.photos[r.id];
    const hits = avoidHits(r).map(norm);
    const onList = state.shopping.some((i) => i.recipeId === r.id);
    app.innerHTML = `
      <article class="detail">
        <div class="hero">
          ${photoHtml(r)}
          <a class="back" href="#/" data-back>${backSvg}Back</a>
          ${favButton(r)}
          ${p ? `<div class="credit">Photo: <a href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.author || 'Wikimedia Commons')}</a>, ${esc(p.license)}</div>` : ''}
        </div>
        <div class="content">
          <h2>${esc(r.title)}</h2>
          <p class="summary">${esc(r.summary)}</p>
          <div class="facts">
            <span class="tag">⏱ ${r.time} min</span>
            <span class="tag">🍽 Serves ${r.serves}</span>
            <span class="tag">${MEALS.find(([k]) => k === r.meal)[1]}</span>
            ${r.gentle ? '<span class="tag gentle">Flare-friendly</span>' : ''}
          </div>
          ${hits.length ? `<p class="banner">Contains something on your food list: <strong>${esc(hits.join(', '))}</strong></p>` : ''}
          <div class="tip"><strong>Gut-friendly tip</strong>${esc(r.tip)}</div>

          <div class="section-head">
            <h3>Ingredients</h3>
            <button type="button" class="btn small ${onList ? 'secondary' : ''}" data-add-shop="${esc(r.id)}">${onList ? '✓ On shopping list' : '+ Shopping list'}</button>
          </div>
          <ul class="ingredients">
            ${r.ingredients.map((i) => `<li class="${hits.some((h) => norm(i).includes(h)) ? 'hit' : ''}">${esc(i)}</li>`).join('')}
          </ul>

          <div class="section-head"><h3>Method</h3></div>
          <ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        </div>
      </article>`;
    window.scrollTo(0, 0);
  }

  function viewShopping() {
    const groups = new Map();
    state.shopping.forEach((item, idx) => {
      const key = item.recipeId || '_own';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ ...item, idx });
    });
    const titleFor = (key) => key === '_own' ? 'My extras' : (state.recipes.find((r) => r.id === key) || {}).title || 'Recipe';
    app.innerHTML = `
      <form class="add-item" id="add-item">
        <input id="new-item" placeholder="Add an item, e.g. bananas" autocomplete="off" enterkeyhint="done" aria-label="New shopping item">
        <button class="btn" type="submit">Add</button>
      </form>
      ${state.shopping.length ? `
        <div class="row">
          <button type="button" class="btn small secondary" data-clear-done>Remove ticked</button>
          <button type="button" class="btn small danger" data-clear-all>Clear all</button>
        </div>
        ${[...groups].map(([key, items]) => `
          <section class="shop-group">
            <h3><span>${esc(titleFor(key))}</span>${key !== '_own' ? `<button type="button" data-remove-group="${esc(key)}">Remove</button>` : ''}</h3>
            ${items.map((i) => `<label class="check"><input type="checkbox" data-toggle="${i.idx}" ${i.done ? 'checked' : ''}><span>${esc(i.text)}</span></label>`).join('')}
          </section>`).join('')}`
      : '<div class="empty"><div class="big">🧺</div><p>Your shopping list is empty.<br>Open a recipe and tap “+ Shopping list”.</p></div>'}
    `;
    $('#add-item').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('#new-item').value.trim();
      if (!v) return;
      state.shopping.push({ text: v, recipeId: null, done: false });
      saveShopping();
      viewShopping();
      $('#new-item').focus();
    });
  }

  function viewSettings() {
    const credits = state.recipes.filter((r) => state.photos[r.id]).map((r) => {
      const p = state.photos[r.id];
      return `<li>${esc(r.title)}: <a href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.author || 'Unknown')}</a> (${esc(p.license)})</li>`;
    }).join('');
    app.innerHTML = `
      <section class="panel">
        <h2>Foods I avoid</h2>
        <p>Add any other foods that don't agree with you. Recipes that contain them are hidden.</p>
        <form class="add-item" id="add-avoid" style="margin:0">
          <input id="new-avoid" placeholder="e.g. onion, garlic, lentils" autocomplete="off" enterkeyhint="done" aria-label="Food to avoid">
          <button class="btn" type="submit">Add</button>
        </form>
        <div class="pills">${state.avoid.map((w, i) => `<span class="pill">${esc(w)}<button type="button" data-unavoid="${i}" aria-label="Remove ${esc(w)}">×</button></span>`).join('') || '<span class="count" style="margin:0">Nothing added yet.</span>'}</div>
      </section>

      <section class="panel">
        <h2>Built into every recipe</h2>
        <ul>${RULES.map(([t, d]) => `<li><strong>${esc(t)}.</strong> ${esc(d)}</li>`).join('')}</ul>
      </section>

      <section class="panel">
        <h2>Flare day vs good day</h2>
        <p style="margin:0">Use the switch at the top. <strong>Flare day</strong> shows only the gentlest meals: smooth soups, purées, eggs, porridge and puddings. <strong>Good day</strong> shows everything.</p>
      </section>

      <section class="panel">
        <h2>Add to your home screen</h2>
        <p style="margin:0"><strong>iPhone:</strong> open in Safari, tap Share, then “Add to Home Screen”.<br><strong>Android:</strong> open in Chrome, tap ⋮, then “Add to Home screen” or “Install app”.</p>
      </section>

      <section class="panel">
        <h2>Please note</h2>
        <p style="margin:0">These recipes are general ideas, not medical advice. Everyone's Crohn's is different — check big changes with your IBD team or dietitian, especially during a flare.</p>
      </section>

      ${credits ? `<section class="panel credits"><h2>Photo credits</h2><p>Photos from Wikimedia Commons, used under their free licences.</p><ul>${credits}</ul></section>` : ''}
    `;
    $('#add-avoid').addEventListener('submit', (e) => {
      e.preventDefault();
      const words = $('#new-avoid').value.split(',').map((w) => w.trim()).filter(Boolean);
      words.forEach((w) => { if (!state.avoid.some((a) => norm(a) === norm(w))) state.avoid.push(w); });
      store.set('avoid', state.avoid);
      viewSettings();
      if (words.length) toast('Recipes with these are now hidden');
    });
  }

  // ---------- Router ----------
  const TITLES = { home: 'Gentle Kitchen', favourites: 'Favourites', shopping: 'Shopping list', settings: 'My foods' };
  let lastListHash = '#/';
  let navCount = 0; // in-app navigations, so Back can use history and keep scroll position

  function render() {
    const hash = location.hash || '#/';
    const [, route, arg] = hash.split('/');
    let tab = 'home';
    if (route === 'recipe') viewRecipe(decodeURIComponent(arg || ''));
    else if (route === 'favourites') { tab = 'favourites'; viewFavourites(); }
    else if (route === 'shopping') { tab = 'shopping'; viewShopping(); }
    else if (route === 'settings') { tab = 'settings'; viewSettings(); }
    else viewHome();
    if (route !== 'recipe') lastListHash = hash;
    if (route && route !== 'recipe') window.scrollTo(0, 0);
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab && route !== 'recipe'));
    $('#page-title').textContent = TITLES[tab];
  }

  // ---------- Events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.fav) { e.preventDefault(); e.stopPropagation(); toggleFav(t.dataset.fav); return; }
    if (t.dataset.mode) { setMode(t.dataset.mode); return; }
    if (t.dataset.meal) { state.meal = t.dataset.meal; viewHome(); return; }
    if ('quick' in t.dataset) { state.quick = !state.quick; viewHome(); return; }
    if ('back' in t.dataset) {
      e.preventDefault();
      if (navCount > 0) history.back();
      else location.hash = lastListHash;
      return;
    }
    if (t.dataset.addShop) {
      const id = t.dataset.addShop;
      const r = state.recipes.find((x) => x.id === id);
      if (state.shopping.some((i) => i.recipeId === id)) { location.hash = '#/shopping'; return; }
      r.ingredients.forEach((text) => state.shopping.push({ text, recipeId: id, done: false }));
      saveShopping();
      toast(`Added ${r.ingredients.length} items`);
      viewRecipe(id);
      return;
    }
    if (t.dataset.removeGroup) {
      state.shopping = state.shopping.filter((i) => i.recipeId !== t.dataset.removeGroup);
      saveShopping(); viewShopping(); return;
    }
    if ('clearDone' in t.dataset) { state.shopping = state.shopping.filter((i) => !i.done); saveShopping(); viewShopping(); return; }
    if ('clearAll' in t.dataset) {
      if (confirm('Clear the whole shopping list?')) { state.shopping = []; saveShopping(); viewShopping(); }
      return;
    }
    if (t.dataset.unavoid) {
      state.avoid.splice(Number(t.dataset.unavoid), 1);
      store.set('avoid', state.avoid);
      viewSettings();
    }
  });


  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.toggle !== undefined) {
      const item = state.shopping[Number(t.dataset.toggle)];
      if (item) { item.done = t.checked; saveShopping(); }
    }
  });

  window.addEventListener('hashchange', () => { navCount++; render(); });

  // ---------- Boot ----------
  async function boot() {
    document.querySelectorAll('.mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === state.mode));
    saveShopping();
    try {
      const [recipes, photos] = await Promise.all([
        fetch('/recipes.json').then((r) => r.json()),
        fetch('/photos.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      ]);
      state.recipes = recipes;
      state.photos = photos;
    } catch {
      app.innerHTML = '<div class="empty"><div class="big">⚠️</div><p>Couldn\'t load recipes. Check your connection and try again.</p></div>';
      return;
    }
    render();
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  boot();
})();

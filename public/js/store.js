// Everything the app remembers lives on this phone: small settings in localStorage,
// photos in IndexedDB. Nothing is sent anywhere.

const PREFIX = 'gk:';

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  onError: null, // set by the app to tell the person a save failed
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      this.onError?.();
      return false;
    }
  },
  remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },
  keys() {
    try {
      return Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length));
    } catch {
      return [];
    }
  },
};

// ---------- Photos (IndexedDB) ----------
let dbPromise;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('gentle-kitchen', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('photos');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction('photos', mode);
    const result = fn(t.objectStore('photos'));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const photos = {
  urls: new Map(), // recipeId -> object URL
  async load() {
    try {
      const keys = await tx('readonly', (s) => s.getAllKeys());
      await Promise.all(keys.map(async (k) => {
        const blob = await tx('readonly', (s) => s.get(k));
        if (blob) this.urls.set(k, URL.createObjectURL(blob));
      }));
    } catch { /* IndexedDB unavailable: app works without photos */ }
  },
  has(id) { return this.urls.has(id); },
  url(id) { return this.urls.get(id); },
  async save(id, file) {
    const blob = await resizeImage(file, 1400, 0.82);
    await tx('readwrite', (s) => s.put(blob, id));
    if (this.urls.has(id)) URL.revokeObjectURL(this.urls.get(id));
    this.urls.set(id, URL.createObjectURL(blob));
  },
  async remove(id) {
    await tx('readwrite', (s) => s.delete(id));
    if (this.urls.has(id)) URL.revokeObjectURL(this.urls.get(id));
    this.urls.delete(id);
  },
  async exportAll() {
    const out = {};
    const keys = await tx('readonly', (s) => s.getAllKeys()).catch(() => []);
    for (const k of keys) {
      const blob = await tx('readonly', (s) => s.get(k));
      out[k] = await blobToDataUrl(blob);
    }
    return out;
  },
  async importAll(map) {
    for (const [id, dataUrl] of Object.entries(map || {})) {
      const blob = dataUrlToBlob(dataUrl);
      if (!blob) continue;
      await tx('readwrite', (s) => s.put(blob, id));
      this.urls.set(id, URL.createObjectURL(blob));
    }
  },
};

async function resizeImage(file, max, quality) {
  const img = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/jpeg', quality));
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That photo could not be read. Try a JPEG or PNG.')); };
    img.src = url;
  });
}

// Only accept embedded images; never fetch arbitrary URLs from a backup file.
function dataUrlToBlob(dataUrl) {
  const m = typeof dataUrl === 'string' && dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

export async function clearPhotos() {
  try { await tx('readwrite', (s) => s.clear()); } catch { /* ignore */ }
  photos.urls.clear();
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

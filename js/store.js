/* =========================================================
   Зберігання та надсилання
   ---------------------------------------------------------
   · чернетка відповідей — у localStorage (текст, дрібниця)
   · фото-референси      — в IndexedDB (там немає ліміту 5 МБ)
   · надсилання          — POST на Apps Script
   ========================================================= */

(function () {
  'use strict';

  const DB_NAME = 'dt-quiz';
  const STORE = 'files';

  /* ---------- IndexedDB: мінімальна обгортка ---------- */

  function openDb() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async function idbSet(key, value) {
    try {
      const db = await openDb();
      return await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) { console.warn('IndexedDB недоступна:', e); return false; }
  }

  async function idbGet(key) {
    try {
      const db = await openDb();
      return await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readonly');
        const r = tx.objectStore(STORE).get(key);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    } catch (e) { return undefined; }
  }

  async function idbClear() {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
    } catch (e) { /* нічого страшного */ }
  }

  /* ---------- стиснення фото просто в браузері ---------- */

  function compressImage(file, maxSide) {
    return new Promise((resolve) => {
      /* усе, що не картинка (наприклад, PDF з планом), лишаємо як є */
      if (!/^image\//.test(file.type)) {
        const fr = new FileReader();
        fr.onload = () => resolve({
          name: file.name, type: file.type, size: file.size, dataUrl: fr.result
        });
        fr.readAsDataURL(file);
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * k), h = Math.round(img.height * k);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = c.toDataURL('image/jpeg', 0.78);
        URL.revokeObjectURL(url);
        resolve({
          name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
          type: 'image/jpeg',
          size: Math.round((dataUrl.length - 22) * 0.75),
          dataUrl
        });
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  /* ---------- надсилання ---------- */

  /* Apps Script не вміє відповідати на preflight-запит, тому надсилаємо
     як text/plain — тоді браузер не робить OPTIONS. */
  async function post(url, payload) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    try { return JSON.parse(txt); } catch (e) { return { ok: true, raw: txt }; }
  }

  /**
   * Надсилає відповіді, потім файли — по одному, з повідомленням про прогрес.
   * onProgress({ stage, done, total })
   */
  async function submit(payload, files, onProgress) {
    const url = (window.CONFIG && window.CONFIG.endpoint || '').trim();
    if (!url) return { ok: false, demo: true };

    onProgress({ stage: 'answers', done: 0, total: 1 + files.length });
    const res = await post(url, { kind: 'answers', payload });
    const submissionId = res.submissionId || res.id || payload.submissionId;

    for (let i = 0; i < files.length; i++) {
      onProgress({ stage: 'files', done: 1 + i, total: 1 + files.length, name: files[i].name });
      try {
        await post(url, {
          kind: 'file',
          submissionId,
          client: payload.answers && payload.answers.contacts && payload.answers.contacts.name || '',
          file: files[i]
        });
      } catch (e) {
        console.warn('Не вдалося надіслати файл', files[i].name, e);
      }
    }
    onProgress({ stage: 'done', done: 1 + files.length, total: 1 + files.length });
    return { ok: true, submissionId, folderUrl: res.folderUrl };
  }

  window.STORE = { idbGet, idbSet, idbClear, compressImage, submit };
})();

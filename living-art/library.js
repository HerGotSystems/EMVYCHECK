/* EMVY CHECK Living Art V2 — local artwork library + portable ART CODE.

   No account system. Everything lives in this browser: IndexedDB when
   available, with an automatic localStorage fallback (private browsing,
   old browsers, storage disabled) so SAVE ARTWORK never hard-fails. */
(function (global) {
  'use strict';

  const DB_NAME = 'emvy-living-art';
  const STORE = 'artworks';
  const FALLBACK_KEY = 'emvy-living-art-library-v1';
  const ART_CODE_PREFIX = 'EMVYART1:';

  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!('indexedDB' in global)) { reject(new Error('no indexeddb')); return; }
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('indexeddb open failed')); };
    });
  }

  function readFallback() {
    try { return JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeFallback(list) {
    try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(list)); } catch (e) { /* nothing more we can do */ }
  }

  function Library() {
    this.dbPromise = null;
    this.useFallback = false;
  }

  Library.prototype._db = function () {
    if (this.useFallback) return Promise.resolve(null);
    if (!this.dbPromise) {
      const self = this;
      this.dbPromise = openDb().catch(function (err) {
        console.warn('[Living Art] IndexedDB unavailable, using localStorage library instead', err);
        self.useFallback = true;
        return null;
      });
    }
    return this.dbPromise;
  };

  Library.prototype.list = function () {
    return this._db().then(function (db) {
      if (!db) return readFallback().sort(function (a, b) { return b.createdAt - a.createdAt; });
      return new Promise(function (resolve) {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve((req.result || []).sort(function (a, b) { return b.createdAt - a.createdAt; })); };
        req.onerror = function () { resolve([]); };
      });
    });
  };

  Library.prototype.save = function (name, state) {
    const entry = { id: uid(), name: (name || 'Untitled').slice(0, 60), createdAt: Date.now(), favourite: false, state: state };
    return this._db().then(function (db) {
      if (!db) { const list = readFallback(); list.push(entry); writeFallback(list); return entry.id; }
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(entry);
        tx.oncomplete = function () { resolve(entry.id); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  };

  Library.prototype._mutate = function (id, mutator) {
    return this._db().then(function (db) {
      if (!db) {
        const list = readFallback();
        const idx = list.findIndex(function (e) { return e.id === id; });
        if (idx >= 0) { mutator(list[idx]); writeFallback(list); }
        return;
      }
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const req = store.get(id);
        req.onsuccess = function () {
          const entry = req.result;
          if (entry) { mutator(entry); store.put(entry); }
        };
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  };

  Library.prototype.rename = function (id, name) { return this._mutate(id, function (e) { e.name = (name || 'Untitled').slice(0, 60); }); };
  Library.prototype.toggleFavourite = function (id) { return this._mutate(id, function (e) { e.favourite = !e.favourite; }); };

  Library.prototype.remove = function (id) {
    return this._db().then(function (db) {
      if (!db) { writeFallback(readFallback().filter(function (e) { return e.id !== id; })); return; }
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  };

  // ---- portable ART CODE (JSON export/import, no persistence involved) ----
  function encodeArtCode(state) {
    try { return ART_CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(state)))); }
    catch (e) { throw new Error('Could not encode this artwork'); }
  }
  function decodeArtCode(code) {
    code = String(code || '').trim();
    if (!code) throw new Error('Empty art code');
    const body = code.indexOf(ART_CODE_PREFIX) === 0 ? code.slice(ART_CODE_PREFIX.length) : code;
    let json;
    try { json = decodeURIComponent(escape(atob(body))); }
    catch (e) { throw new Error('That does not look like a valid ART CODE'); }
    let parsed;
    try { parsed = JSON.parse(json); }
    catch (e) { throw new Error('ART CODE is corrupted'); }
    if (!parsed || typeof parsed !== 'object') throw new Error('ART CODE is corrupted');
    return parsed;
  }

  global.LivingArtLibrary = new Library();
  global.LivingArtArtCode = { encode: encodeArtCode, decode: decodeArtCode };
})(window);

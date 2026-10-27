/**
 * core/state_persistence.js
 * Pure state persistence, quota management, debounce scheduling and history clamping routines
 * for Tiling Stripes Studio v2.
 */

(function () {
  const STORAGE_KEY_STUDIO_STATE = 'tiling_stripes_studio_v3_state';
  const LEGACY_STORAGE_KEY = 'tiling_stripes_studio_state_v2';
  const STORAGE_VERSION = 3;
  const MAX_GENERATION_HISTORY = 30;
  const MAX_EDIT_HISTORY = 256;
  const STORAGE_BUDGET_BYTES = 3.2 * 1024 * 1024; // ~3.2 MB target to stay safely within 5 MB browser quota

  /**
   * Pure save scheduler with debounce, flush and cancel capabilities.
   * Can accept custom timers for deterministic testing.
   */
  function createSaveScheduler({ save, delayMs = 300, timers } = {}) {
    if (typeof save !== 'function') {
      throw new TypeError('createSaveScheduler requires a save function');
    }
    const _setTimeout = (timers && timers.setTimeout) || setTimeout;
    const _clearTimeout = (timers && timers.clearTimeout) || clearTimeout;
    let handle = null;
    let pendingCount = 0;

    return {
      schedule() {
        pendingCount++;
        _clearTimeout(handle);
        handle = _setTimeout(() => {
          handle = null;
          pendingCount = 0;
          save();
        }, delayMs);
      },
      flush() {
        if (handle === null) return false;
        _clearTimeout(handle);
        handle = null;
        pendingCount = 0;
        save();
        return true;
      },
      cancel() {
        _clearTimeout(handle);
        handle = null;
        pendingCount = 0;
      },
      pending() {
        return handle !== null;
      }
    };
  }

  /**
   * Validates payload version and enforces migration or future backup policies.
   */
  function validatePayloadVersion(payload, currentVersion = STORAGE_VERSION, storageKey = STORAGE_KEY_STUDIO_STATE) {
    if (!payload || typeof payload !== 'object') {
      return { restore: false, error: 'Payload inválido' };
    }
    const v = payload.version;
    if (typeof v !== 'number') {
      return {
        restore: true,
        warning: 'Estado migrado de versão anterior.',
        isLegacy: true,
        payload
      };
    }
    if (v > currentVersion) {
      const backupKey = `${storageKey}_backup_${Date.now()}`;
      return {
        restore: false,
        backupKey,
        warning: `Versão do estado (${v}) é mais recente que a versão suportada (${currentVersion}). Os dados foram preservados em backup para evitar corrupção.`,
        isFuture: true,
        payload
      };
    }
    return {
      restore: true,
      warning: null,
      isCurrent: true,
      payload
    };
  }

  /**
   * Detects whether an exception was caused by localStorage quota exhaustion.
   */
  function isQuotaError(err) {
    return (
      Boolean(err) &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22 ||
        err.code === 1014 ||
        (typeof err.message === 'string' && err.message.toLowerCase().includes('quota')))
    );
  }

  /**
   * Calculates maximum allowed edit history entries for a given mosaic size.
   */
  function getMaxEditHistoryForMosaic(mosaicData) {
    if (!mosaicData) return MAX_EDIT_HISTORY;
    const N = mosaicData.subtilesPerSide || 4;
    const totalSubtiles = (mosaicData.rows || 1) * (mosaicData.cols || 1) * (N * N);
    const approxBytesPerSnap = Math.max(1, totalSubtiles * 45);
    const maxAllowed = Math.floor(STORAGE_BUDGET_BYTES / approxBytesPerSnap);
    return Math.max(2, Math.min(MAX_EDIT_HISTORY, maxAllowed));
  }

  /**
   * Trims a history stack on push, discarding oldest entries when exceeding maxLimit.
   */
  function trimHistoryOnPush(historyArray, maxLimit, currentIndex) {
    const arr = Array.isArray(historyArray) ? [...historyArray] : [];
    let idx = typeof currentIndex === 'number' ? currentIndex : arr.length - 1;

    // Discard any forward (redo) entries beyond currentIndex
    if (idx >= 0 && idx < arr.length - 1) {
      arr.splice(idx + 1);
    }

    // Trim oldest entries if exceeding limit
    if (arr.length > maxLimit) {
      const dropCount = arr.length - maxLimit;
      arr.splice(0, dropCount);
      idx = Math.max(0, idx - dropCount);
    }

    return {
      history: arr,
      index: Math.min(idx, arr.length - 1)
    };
  }

  /**
   * Clamps and migrates payload history arrays before saving to storage.
   */
  function migratePayloadHistories(payload, currentMosaic) {
    if (!payload || typeof payload !== 'object') return payload;
    const result = { ...payload };

    // 1. Generation history
    if (Array.isArray(result.history)) {
      const maxGen = MAX_GENERATION_HISTORY;
      if (result.history.length > maxGen) {
        const drop = result.history.length - maxGen;
        result.history = result.history.slice(drop);
        if (typeof result.historyIndex === 'number') {
          result.historyIndex = Math.max(0, result.historyIndex - drop);
        }
      }
      if (typeof result.historyIndex === 'number') {
        result.historyIndex = Math.max(0, Math.min(result.history.length - 1, result.historyIndex));
      }
    }

    // 2. Edit history with dynamic budget
    if (Array.isArray(result.editHistory)) {
      const maxEdit = getMaxEditHistoryForMosaic(currentMosaic || result);
      if (result.editHistory.length > maxEdit) {
        const drop = result.editHistory.length - maxEdit;
        result.editHistory = result.editHistory.slice(drop);
        if (typeof result.editHistoryIndex === 'number') {
          result.editHistoryIndex = Math.max(0, result.editHistoryIndex - drop);
        }
      }
      if (typeof result.editHistoryIndex === 'number') {
        result.editHistoryIndex = Math.max(0, Math.min(result.editHistory.length - 1, result.editHistoryIndex));
      }
    }

    return result;
  }

  /**
   * Strips large history arrays to create an emergency minimal payload preserving current drawing.
   */
  function buildMinimalEmergencyPayload(fullPayload) {
    if (!fullPayload || typeof fullPayload !== 'object') return null;
    return {
      ...fullPayload,
      history: [],
      historyIndex: -1,
      editHistory: [],
      editHistoryIndex: -1
    };
  }

  /**
   * Attempts to save full payload to storage, automatically falling back to minimal payload on quota error.
   */
  function saveWithQuotaFallback(storage, storageKey, fullPayload, currentMosaic) {
    if (!storage || typeof storage.setItem !== 'function') {
      return { success: false, mode: 'no-storage', error: new Error('Storage unavailable') };
    }

    const migrated = migratePayloadHistories(fullPayload, currentMosaic);

    try {
      storage.setItem(storageKey, JSON.stringify(migrated));
      return { success: true, mode: 'full', reduced: (migrated.history?.length || 0) < (fullPayload.history?.length || 0) || (migrated.editHistory?.length || 0) < (fullPayload.editHistory?.length || 0),
        reduction: { history: (fullPayload.history?.length || 0) - (migrated.history?.length || 0), editHistory: (fullPayload.editHistory?.length || 0) - (migrated.editHistory?.length || 0) } };
    } catch (err) {
      if (isQuotaError(err)) {
        try {
          const minimal = buildMinimalEmergencyPayload(migrated);
          storage.setItem(storageKey, JSON.stringify(minimal));
          return {
            success: true,
            mode: 'fallback_minimal',
            reduction: { history: fullPayload.history?.length || 0, editHistory: fullPayload.editHistory?.length || 0 },
            warning: 'Limite de armazenamento atingido. O histórico foi liberado, mas o desenho atual foi salvo com sucesso.'
          };
        } catch (errMin) {
          return {
            success: false,
            mode: 'quota_exhausted',
            error: errMin,
            warning: 'Não foi possível salvar automaticamente no navegador. Exporte seu trabalho para evitar perda de dados.'
          };
        }
      }

      return {
        success: false,
        mode: 'error',
        error: err,
        warning: 'Não foi possível salvar automaticamente no navegador.'
      };
    }
  }

  const IDB_DATABASE_NAME = 'TilingStripesDB_v1';
  const IDB_STORE_NAME = 'studio_state';
  const IDB_VERSION = 1;
  const IDB_KEY_CURRENT = 'current_studio_state';
  const IDB_MAX_GENERATION_HISTORY = 256;
  const IDB_MAX_EDIT_HISTORY = 256;

  /**
   * Opens the Tiling Stripes IndexedDB instance.
   * Accepts an optional customFactory for Node/unit-testing environments.
   */
  function openIndexedDB(customFactory, databaseName = IDB_DATABASE_NAME, storeName = IDB_STORE_NAME) {
    const factory = customFactory || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    if (!factory) {
      return Promise.reject(new Error('IndexedDB not supported or unavailable'));
    }

    return new Promise((resolve, reject) => {
      let req;
      try {
        req = factory.open(databaseName, IDB_VERSION);
      } catch (err) {
        return reject(err);
      }
      req.onupgradeneeded = (e) => {
        const db = e.target ? e.target.result : req.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      req.onsuccess = (e) => {
        const db = e.target ? e.target.result : req.result;
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
    });
  }

  /**
   * Saves a state payload into IndexedDB asynchronously.
   */
  function saveToIndexedDB(key = IDB_KEY_CURRENT, payload, customFactory) {
    if (!payload || typeof payload !== 'object') return Promise.reject(new Error('Invalid payload for IndexedDB'));
    const saves = (typeof window !== 'undefined' && window.SaveStatus) || (typeof require === 'function' && require('./save_status.js'));
    let snapshot;
    try { snapshot = JSON.parse(JSON.stringify(payload)); } catch (error) { return Promise.reject(error); }
    return saves.enqueue('document:idb:' + key, () => openIndexedDB(customFactory).then(db => new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([IDB_STORE_NAME], 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        const close = () => { try { db.close(); } catch (_) {} };
        tx.oncomplete = () => { close(); resolve({ success: true, mode: 'indexeddb' }); };
        tx.onerror = tx.onabort = () => { close(); reject(tx.error || new Error('IndexedDB transaction failed')); };
        const request = store.get(key);
        request.onerror = () => { close(); reject(request.error || new Error('IndexedDB read error')); };
        request.onsuccess = () => {
          // A late migration or save must never replace a newer stored revision.
          if ((request.result?.timestamp || 0) > (snapshot.timestamp || 0)) return;
          const put = store.put(snapshot, key);
          put.onerror = () => { close(); reject(put.error || new Error('IndexedDB put error')); };
        };
      } catch (error) { try { db.close(); } catch (_) {} reject(error); }
    })));
  }

  /**
   * Loads a state payload from IndexedDB asynchronously.
   */
  function loadFromIndexedDB(key = IDB_KEY_CURRENT, customFactory, legacy = false) {
    const storeName = legacy ? 'studio_state_store' : IDB_STORE_NAME;
    return openIndexedDB(customFactory, legacy ? 'tiling_stripes_studio_db' : IDB_DATABASE_NAME, storeName).then((db) => {
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction([storeName], 'readonly');
          const store = tx.objectStore(storeName);
          const req = store.get(key);
          req.onsuccess = () => {
            resolve(req.result || null);
          };
          req.onerror = () => reject(req.error || new Error('IndexedDB get error'));
          if (tx.oncomplete !== undefined) {
            tx.oncomplete = () => {
              try { db.close(); } catch (_) {}
            };
          }
          if (tx.onerror !== undefined) {
            tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction error'));
          }
        } catch (err) {
          try { db.close(); } catch (_) {}
          reject(err);
        }
      });
    }).then(async payload => {
      if (payload || legacy) return payload;
      const oldPayload = await loadFromIndexedDB(key, customFactory, true).catch(() => null);
      if (oldPayload) await saveToIndexedDB(key, oldPayload, customFactory).catch(() => {});
      return oldPayload;
    });
  }

  /**
   * Decides whether an existing IndexedDB payload should take precedence over a localStorage cache payload.
   * Prevents truncated or emergency-minimal localStorage payloads from overwriting rich IndexedDB history.
   */
  function shouldPreferIndexedDB(idbPayload, localPayload) {
    if (!idbPayload || typeof idbPayload !== 'object') return false;
    if (!localPayload || typeof localPayload !== 'object') return true;

    const idbTs = typeof idbPayload.timestamp === 'number' ? idbPayload.timestamp : 0;
    const localTs = typeof localPayload.timestamp === 'number' ? localPayload.timestamp : 0;

    if (localTs > idbTs) return false;
    if (idbTs > localTs) return true;

    const idbHist = (Array.isArray(idbPayload.history) ? idbPayload.history.length : 0) +
      (Array.isArray(idbPayload.editHistory) ? idbPayload.editHistory.length : 0);
    const localHist = (Array.isArray(localPayload.history) ? localPayload.history.length : 0) +
      (Array.isArray(localPayload.editHistory) ? localPayload.editHistory.length : 0);

    return idbHist >= localHist;
  }

  /**
   * Seamlessly migrates existing localStorage data into IndexedDB ONLY if IndexedDB
   * is empty or strictly older than localStorage. Never overwrites rich IDB history
   * with a truncated or fallback-minimal localStorage cache.
   */
  function migrateLocalStorageToIndexedDB(storage, storageKey = STORAGE_KEY_STUDIO_STATE, customFactory) {
    if (!storage || typeof storage.getItem !== 'function') {
      return Promise.resolve(false);
    }
    let parsed;
    try {
      const raw = storage.getItem(storageKey) ||
          (storageKey === STORAGE_KEY_STUDIO_STATE ? storage.getItem(LEGACY_STORAGE_KEY) : null);
      if (!raw) return Promise.resolve(false);
      parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return Promise.resolve(false);
    } catch (_) {
      return Promise.resolve(false);
    }

    return loadFromIndexedDB(IDB_KEY_CURRENT, customFactory)
      .catch(() => null)
      .then((existingIDB) => {
        if (shouldPreferIndexedDB(existingIDB, parsed)) {
          return false;
        }
        return saveToIndexedDB(IDB_KEY_CURRENT, parsed, customFactory)
          .then(() => true)
          .catch(() => false);
      });
  }

  /**
   * Resolves the authoritative state on boot between IndexedDB and localStorage.
   */
  function resolveBootState(storage, storageKey = STORAGE_KEY_STUDIO_STATE, customFactory) {
    let localParsed = null;
    if (storage && typeof storage.getItem === 'function') {
      try {
        const raw = storage.getItem(storageKey) ||
          (storageKey === STORAGE_KEY_STUDIO_STATE ? storage.getItem(LEGACY_STORAGE_KEY) : null);
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && typeof obj === 'object') localParsed = obj;
        }
      } catch (_) {}
    }

    return migrateLocalStorageToIndexedDB(storage, storageKey, customFactory)
      .then(() => loadFromIndexedDB(IDB_KEY_CURRENT, customFactory))
      .then((idbParsed) => {
        if (shouldPreferIndexedDB(idbParsed, localParsed)) {
          return { source: 'indexeddb', payload: idbParsed };
        }
        if (localParsed) {
          return { source: 'localstorage', payload: localParsed };
        }
        return { source: 'none', payload: null };
      })
      .catch(() => ({
        source: localParsed ? 'localstorage' : 'none',
        payload: localParsed
      }));
  }

  const StatePersistence = {
    STORAGE_KEY_STUDIO_STATE,
    STORAGE_VERSION,
    MAX_GENERATION_HISTORY,
    MAX_EDIT_HISTORY,
    STORAGE_BUDGET_BYTES,
    IDB_DATABASE_NAME,
    IDB_STORE_NAME,
    IDB_KEY_CURRENT,
    IDB_MAX_GENERATION_HISTORY,
    IDB_MAX_EDIT_HISTORY,
    createSaveScheduler,
    validatePayloadVersion,
    isQuotaError,
    getMaxEditHistoryForMosaic,
    trimHistoryOnPush,
    migratePayloadHistories,
    buildMinimalEmergencyPayload,
    saveWithQuotaFallback,
    openIndexedDB,
    saveToIndexedDB,
    loadFromIndexedDB,
    shouldPreferIndexedDB,
    migrateLocalStorageToIndexedDB,
    resolveBootState
  };

  if (typeof window !== 'undefined') {
    window.StatePersistence = StatePersistence;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatePersistence;
  }
})();

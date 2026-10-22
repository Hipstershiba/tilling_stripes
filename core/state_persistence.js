/**
 * core/state_persistence.js
 * Pure state persistence, quota management, debounce scheduling and history clamping routines
 * for Tiling Stripes Studio v2.
 */

(function () {
  const STORAGE_KEY_STUDIO_STATE = 'tiling_stripes_studio_state_v2';
  const STORAGE_VERSION = 3;
  const MAX_GENERATION_HISTORY = 30;
  const MAX_EDIT_HISTORY = 25;
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
      return { success: true, mode: 'full' };
    } catch (err) {
      if (isQuotaError(err)) {
        try {
          const minimal = buildMinimalEmergencyPayload(migrated);
          storage.setItem(storageKey, JSON.stringify(minimal));
          return {
            success: true,
            mode: 'fallback_minimal',
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

  const StatePersistence = {
    STORAGE_KEY_STUDIO_STATE,
    STORAGE_VERSION,
    MAX_GENERATION_HISTORY,
    MAX_EDIT_HISTORY,
    STORAGE_BUDGET_BYTES,
    createSaveScheduler,
    validatePayloadVersion,
    isQuotaError,
    getMaxEditHistoryForMosaic,
    trimHistoryOnPush,
    migratePayloadHistories,
    buildMinimalEmergencyPayload,
    saveWithQuotaFallback
  };

  if (typeof window !== 'undefined') {
    window.StatePersistence = StatePersistence;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatePersistence;
  }
})();

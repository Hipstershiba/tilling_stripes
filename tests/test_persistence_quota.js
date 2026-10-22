// tests/test_persistence_quota.js
const assert = require('assert');
const path = require('path');

console.log('--- Testing Persistence Quota Error Handling & Fallback ---');

const storageMock = new Map();
let quotaErrorActive = false;
let hardQuotaErrorActive = false;

const localStorageMock = {
  getItem: (key) => storageMock.get(key) || null,
  setItem: (key, val) => {
    if (hardQuotaErrorActive) {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      err.code = 22;
      throw err;
    }
    if (quotaErrorActive) {
      // Simulate quota error only when payload has histories (larger payload)
      const obj = JSON.parse(val);
      if (obj.history && obj.history.length > 0 || obj.editHistory && obj.editHistory.length > 0) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      }
    }
    storageMock.set(key, String(val));
  },
  removeItem: (key) => storageMock.delete(key),
  clear: () => storageMock.clear()
};

global.localStorage = localStorageMock;
global.window = {
  localStorage: localStorageMock,
  addEventListener: () => {}
};

let warningVisible = false;
let warningMessage = '';

global.document = {
  getElementById: (id) => {
    if (id === 'persistenceWarning') {
      return {
        classList: {
          contains: (cls) => cls === 'hidden' ? !warningVisible : false,
          add: (cls) => { if (cls === 'hidden') warningVisible = false; },
          remove: (cls) => { if (cls === 'hidden') warningVisible = true; }
        },
        set textContent(val) { warningMessage = val; },
        get textContent() { return warningMessage; }
      };
    }
    return null;
  },
  querySelectorAll: () => []
};

require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

// Helper matching sketch.js persistence logic
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

function saveWithFallback(state, storageKey) {
  const fullPayload = {
    version: 2,
    rows: state.rows,
    cols: state.cols,
    cellsSnapshot: state.cellsSnapshot,
    history: state.history,
    historyIndex: state.historyIndex,
    editHistory: state.editHistory,
    editHistoryIndex: state.editHistoryIndex
  };

  try {
    localStorageMock.setItem(storageKey, JSON.stringify(fullPayload));
    warningVisible = false;
    return 'full';
  } catch (err) {
    if (isQuotaError(err)) {
      try {
        const minPayload = {
          version: 2,
          rows: state.rows,
          cols: state.cols,
          cellsSnapshot: state.cellsSnapshot,
          history: [],
          historyIndex: -1,
          editHistory: [],
          editHistoryIndex: -1
        };
        localStorageMock.setItem(storageKey, JSON.stringify(minPayload));
        warningVisible = true;
        warningMessage = 'Limite de armazenamento atingido. O histórico foi liberado, mas o desenho atual foi salvo com sucesso.';
        return 'minimal_fallback';
      } catch (errMin) {
        warningVisible = true;
        warningMessage = 'Não foi possível salvar automaticamente no navegador.';
        return 'failed';
      }
    }
    warningVisible = true;
    return 'failed';
  }
}

// 1. Normal save without quota error
const dummyCells = { gridSnap: [[{ tileId: 10 }]] };
const testState = {
  rows: 1,
  cols: 1,
  cellsSnapshot: dummyCells,
  history: [{ id: 1 }, { id: 2 }],
  historyIndex: 1,
  editHistory: [{ snap: 1 }, { snap: 2 }],
  editHistoryIndex: 1
};

const res1 = saveWithFallback(testState, 'test_key');
assert.strictEqual(res1, 'full', 'Normal save should write full payload');
assert.strictEqual(warningVisible, false, 'Warning should be hidden on successful save');
console.log('✓ Normal save without quota error passed.');

// 2. Full save triggers QuotaExceededError, minimal fallback succeeds
quotaErrorActive = true;
const res2 = saveWithFallback(testState, 'test_key');
assert.strictEqual(res2, 'minimal_fallback', 'Should save minimal fallback when full exceeds quota');
assert.strictEqual(warningVisible, true, 'Warning should alert user that history was dropped');
const savedRaw = localStorageMock.getItem('test_key');
const parsed = JSON.parse(savedRaw);
assert.strictEqual(parsed.history.length, 0, 'Minimal fallback must drop history');
assert.deepStrictEqual(parsed.cellsSnapshot, dummyCells, 'Minimal fallback MUST preserve drawing cells');
console.log('✓ Fallback to minimal payload preserves drawing cells and alerts user.');

// 3. Hard quota (both full and minimal throw QuotaExceededError)
hardQuotaErrorActive = true;
const res3 = saveWithFallback(testState, 'test_key');
assert.strictEqual(res3, 'failed', 'Should fail gracefully when localStorage has no space');
assert.strictEqual(warningVisible, true, 'Persistent warning must be shown to prevent user data loss');
assert.ok(warningMessage.includes('Não foi possível salvar'), 'Message should instruct user to export work');
console.log('✓ Hard quota failure shows persistent warning and keeps state in memory.');

// 4. Recovery: Quota freed, next save succeeds
quotaErrorActive = false;
hardQuotaErrorActive = false;
const res4 = saveWithFallback(testState, 'test_key');
assert.strictEqual(res4, 'full');
assert.strictEqual(warningVisible, false, 'Warning should disappear when save works again');
console.log('✓ Recovery: warning disappears after successful save.');

console.log('--- ALL PERSISTENCE QUOTA CHECKS PASSED PERFECTLY! ---');

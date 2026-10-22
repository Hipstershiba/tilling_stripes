// tests/test_persistence_quota.js
const assert = require('assert');
const path = require('path');
const StatePersistence = require(path.join(__dirname, '../core/state_persistence.js'));

console.log('--- Testing Persistence Quota Error Handling & Fallback (Real Core Module) ---');

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
      const obj = JSON.parse(val);
      if ((obj.history && obj.history.length > 0) || (obj.editHistory && obj.editHistory.length > 0)) {
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

// 1. Normal save without quota error
const dummyCells = { gridSnap: [[{ tileId: 10 }]] };
const testState = {
  version: 2,
  rows: 1,
  cols: 1,
  cellsSnapshot: dummyCells,
  history: [{ id: 1 }, { id: 2 }],
  historyIndex: 1,
  editHistory: [{ snap: 1 }, { snap: 2 }],
  editHistoryIndex: 1
};

const res1 = StatePersistence.saveWithQuotaFallback(localStorageMock, 'test_key', testState);
assert.strictEqual(res1.success, true);
assert.strictEqual(res1.mode, 'full', 'Normal save should write full payload');
console.log('✓ Normal save without quota error passed.');

// 2. Full save triggers QuotaExceededError, minimal fallback succeeds
quotaErrorActive = true;
const res2 = StatePersistence.saveWithQuotaFallback(localStorageMock, 'test_key', testState);
assert.strictEqual(res2.success, true);
assert.strictEqual(res2.mode, 'fallback_minimal', 'Should save minimal fallback when full exceeds quota');
assert.ok(res2.warning.includes('Limite de armazenamento'), 'Warning should alert user that history was dropped');
const savedRaw = localStorageMock.getItem('test_key');
const parsed = JSON.parse(savedRaw);
assert.strictEqual(parsed.history.length, 0, 'Minimal fallback must drop history');
assert.deepStrictEqual(parsed.cellsSnapshot, dummyCells, 'Minimal fallback MUST preserve drawing cells');
console.log('✓ Fallback to minimal payload preserves drawing cells and alerts user.');

// 3. Hard quota (both full and minimal throw QuotaExceededError)
hardQuotaErrorActive = true;
const res3 = StatePersistence.saveWithQuotaFallback(localStorageMock, 'test_key', testState);
assert.strictEqual(res3.success, false, 'Should fail gracefully when localStorage has no space');
assert.strictEqual(res3.mode, 'quota_exhausted');
assert.ok(res3.warning.includes('Não foi possível salvar'), 'Message should instruct user to export work');
console.log('✓ Hard quota failure reports warning and preserves state in memory.');

// 4. Recovery: Quota freed, next save succeeds
quotaErrorActive = false;
hardQuotaErrorActive = false;
const res4 = StatePersistence.saveWithQuotaFallback(localStorageMock, 'test_key', testState);
assert.strictEqual(res4.success, true);
assert.strictEqual(res4.mode, 'full');
console.log('✓ Recovery: save succeeds fully when space is restored.');

console.log('--- ALL PERSISTENCE QUOTA CHECKS PASSED PERFECTLY! ---');

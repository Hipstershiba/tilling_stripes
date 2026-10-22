// tests/test_history_nav.js
// Tests the pure history navigation planner (core/history_nav.js)
// 1. Entry with snapshot -> { action: 'restore_snapshot', snapshot, frozenCells }
// 2. Clean entry -> { action: 'regenerate' }
// 3. Over-budget scenario -> { action: 'regenerate', warning: true }

const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/history_nav.js'));

const HistoryNav = window.HistoryNav;

console.log('--- Testing History Navigation Planner (core/history_nav.js) ---');

assert.ok(HistoryNav, 'window.HistoryNav must be exported');
assert.strictEqual(typeof HistoryNav.planRestore, 'function', 'planRestore must be a function');

// Case 1: Clean entry without snapshot
const cleanEntry = {
  seed: 1024,
  rows: 4,
  cols: 4
};
const planClean = HistoryNav.planRestore(cleanEntry, { isOverBudget: false });
assert.deepStrictEqual(planClean, { action: 'regenerate' });
console.log('✓ Clean entry plans regenerate.');

// Case 2: Dirty entry with cellsSnapshot
const dirtyEntry = {
  seed: 1024,
  rows: 4,
  cols: 4,
  cellsSnapshot: { gridSnap: [[{ tileId: 5 }]] },
  frozenCells: [['0,0,0,0', { tileId: 5 }]]
};
const planDirty = HistoryNav.planRestore(dirtyEntry, { isOverBudget: false });
assert.strictEqual(planDirty.action, 'restore_snapshot');
assert.deepStrictEqual(planDirty.snapshot, dirtyEntry.cellsSnapshot);
assert.deepStrictEqual(planDirty.frozenCells, dirtyEntry.frozenCells);
console.log('✓ Dirty entry plans restore_snapshot.');

// Case 3: Over-budget entry
const planOverBudget = HistoryNav.planRestore(dirtyEntry, { isOverBudget: true });
assert.strictEqual(planOverBudget.action, 'regenerate');
assert.strictEqual(planOverBudget.warning, true);
console.log('✓ Over-budget entry plans regenerate with warning.');

console.log('--- ALL HISTORY NAV PLANNER TESTS PASSED! ---');

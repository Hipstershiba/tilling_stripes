// tests/test_history_limits.js
const assert = require('assert');
const path = require('path');
const StatePersistence = require(path.join(__dirname, '../core/state_persistence.js'));

const {
  MAX_GENERATION_HISTORY,
  MAX_EDIT_HISTORY,
  trimHistoryOnPush,
  migratePayloadHistories,
  getMaxEditHistoryForMosaic
} = StatePersistence;

console.log('--- Testing History Limits and Bounds Clamping (Real Core Module) ---');

// 1. Generation History Trim-on-Push via pure StatePersistence
let genHistory = [];
let genIndex = -1;

for (let i = 0; i < 50; i++) {
  genHistory.push({ seed: i });
  const trimmed = trimHistoryOnPush(genHistory, MAX_GENERATION_HISTORY, genHistory.length - 1);
  genHistory = trimmed.history;
  genIndex = trimmed.index;
}

assert.strictEqual(genHistory.length, MAX_GENERATION_HISTORY, 'Generation history length should be capped at 30');
assert.strictEqual(genIndex, MAX_GENERATION_HISTORY - 1, 'Generation index should be last item');
assert.strictEqual(genHistory[0].seed, 20, 'First item should be seed 20 (shifted 20 times)');
assert.strictEqual(genHistory[genHistory.length - 1].seed, 49, 'Last item should be seed 49');
console.log('✓ Generation history trim-on-push verified.');

// 2. Edit History Trim-on-Push via pure StatePersistence
let editHistory = [];
let editIndex = -1;

for (let i = 0; i < 300; i++) {
  editHistory.push({ editId: i });
  const trimmed = trimHistoryOnPush(editHistory, MAX_EDIT_HISTORY, editHistory.length - 1);
  editHistory = trimmed.history;
  editIndex = trimmed.index;
}

assert.strictEqual(editHistory.length, MAX_EDIT_HISTORY, 'Edit history length should be capped at 256');
assert.strictEqual(editIndex, MAX_EDIT_HISTORY - 1, 'Edit index should be last item');
assert.strictEqual(editHistory[0].editId, 44, 'First item should be edit 44');
assert.strictEqual(editHistory[editHistory.length - 1].editId, 299, 'Last item should be edit 299');
console.log('✓ Edit history trim-on-push verified.');

// 3. Dynamic Edit History Budget for large mosaics
const smallMosaic = { rows: 2, cols: 2, subtilesPerSide: 2 }; // 16 subtiles
const largeMosaic = { rows: 8, cols: 8, subtilesPerSide: 8 }; // 4096 subtiles

const smallCap = getMaxEditHistoryForMosaic(smallMosaic);
const largeCap = getMaxEditHistoryForMosaic(largeMosaic);

assert.strictEqual(smallCap, MAX_EDIT_HISTORY, 'Small mosaic should get full 256 edit snapshots');
assert.ok(largeCap < MAX_EDIT_HISTORY, 'Large mosaic should have budget clamped');
assert.ok(largeCap >= 2, 'Large mosaic should have at least 2 edit snapshots');
console.log(`✓ Dynamic budget verified: small=${smallCap}, large=${largeCap}.`);

// 4. Migration of Over-limit Payload & Index Clamping
const bloatedPayload = {
  version: 2,
  rows: 4,
  cols: 4,
  subdivision: 2,
  history: Array.from({ length: 100 }, (_, i) => ({ seed: i })),
  historyIndex: 99,
  editHistory: Array.from({ length: 80 }, (_, i) => ({ step: i })),
  editHistoryIndex: 79
};

const migrated = migratePayloadHistories(bloatedPayload, { rows: 4, cols: 4, subtilesPerSide: 4 });
assert.strictEqual(migrated.history.length, MAX_GENERATION_HISTORY);
assert.strictEqual(migrated.historyIndex, MAX_GENERATION_HISTORY - 1);
assert.strictEqual(migrated.history[0].seed, 70);

assert.ok(migrated.editHistory.length <= MAX_EDIT_HISTORY);
assert.strictEqual(migrated.editHistoryIndex, migrated.editHistory.length - 1);

// Test clamping when index was previously in the past (e.g. user had rewound)
const rewoundPayload = {
  version: 2,
  history: Array.from({ length: 50 }, (_, i) => ({ seed: i })),
  historyIndex: 5, // Dropping first 20 items shifts index 5 to 0
  editHistory: Array.from({ length: 300 }, (_, i) => ({ step: i })),
  editHistoryIndex: 3
};

const migratedRewound = migratePayloadHistories(rewoundPayload);
assert.strictEqual(migratedRewound.historyIndex, 0, 'Rewound history index shifted correctly');
assert.strictEqual(migratedRewound.editHistoryIndex, 0, 'Rewound edit index shifted correctly');

console.log('✓ Migration of over-limit payloads and rewound indices verified.');
console.log('--- ALL HISTORY LIMIT CHECKS PASSED PERFECTLY! ---');

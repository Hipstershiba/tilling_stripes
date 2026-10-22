// tests/test_history_limits.js
const assert = require('assert');

const MAX_GENERATION_HISTORY = 30;
const MAX_EDIT_HISTORY = 25;

console.log('--- Testing History Limits and Bounds Clamping ---');

// 1. Generation History Trim-on-Push
let genHistory = [];
let genIndex = -1;

function pushGen(item) {
  genHistory.push(item);
  while (genHistory.length > MAX_GENERATION_HISTORY) {
    genHistory.shift();
  }
  genIndex = genHistory.length - 1;
}

for (let i = 0; i < 50; i++) {
  pushGen({ seed: i });
}

assert.strictEqual(genHistory.length, MAX_GENERATION_HISTORY, 'Generation history length should be capped at 30');
assert.strictEqual(genIndex, MAX_GENERATION_HISTORY - 1, 'Generation index should be last item');
assert.strictEqual(genHistory[0].seed, 20, 'First item should be seed 20 (shifted 20 times)');
assert.strictEqual(genHistory[genHistory.length - 1].seed, 49, 'Last item should be seed 49');
console.log('✓ Generation history trim-on-push verified.');

// 2. Edit History Trim-on-Push
let editHistory = [];
let editIndex = -1;

function pushEdit(item) {
  if (editIndex < editHistory.length - 1) {
    editHistory = editHistory.slice(0, editIndex + 1);
  }
  editHistory.push(item);
  while (editHistory.length > MAX_EDIT_HISTORY) {
    editHistory.shift();
  }
  editIndex = editHistory.length - 1;
}

for (let i = 0; i < 40; i++) {
  pushEdit({ editId: i });
}

assert.strictEqual(editHistory.length, MAX_EDIT_HISTORY, 'Edit history length should be capped at 25');
assert.strictEqual(editIndex, MAX_EDIT_HISTORY - 1, 'Edit index should point to last item (24)');
assert.strictEqual(editHistory[0].editId, 15, 'First item should be editId 15');
assert.strictEqual(editHistory[editHistory.length - 1].editId, 39, 'Last item should be editId 39');
console.log('✓ Edit history trim-on-push verified.');

// 3. Payload Migration on Load (Over-limit payload with rewound index)
function migratePayloadHistories(saved) {
  let hist = Array.isArray(saved.history) ? saved.history.slice() : [];
  let hIdx = typeof saved.historyIndex === 'number' ? saved.historyIndex : hist.length - 1;
  if (hist.length > MAX_GENERATION_HISTORY) {
    const trimmed = hist.length - MAX_GENERATION_HISTORY;
    hist = hist.slice(-MAX_GENERATION_HISTORY);
    hIdx = Math.max(0, hIdx - trimmed);
  }
  if (hist.length > 0) {
    hIdx = Math.max(0, Math.min(hist.length - 1, hIdx));
  } else {
    hIdx = -1;
  }

  let eHist = Array.isArray(saved.editHistory) ? saved.editHistory.slice() : [];
  let eIdx = typeof saved.editHistoryIndex === 'number' ? saved.editHistoryIndex : eHist.length - 1;
  if (eHist.length > MAX_EDIT_HISTORY) {
    const trimmed = eHist.length - MAX_EDIT_HISTORY;
    eHist = eHist.slice(-MAX_EDIT_HISTORY);
    eIdx = Math.max(0, eIdx - trimmed);
  }
  if (eHist.length > 0) {
    eIdx = Math.max(0, Math.min(eHist.length - 1, eIdx));
  } else {
    eIdx = -1;
  }

  return { history: hist, historyIndex: hIdx, editHistory: eHist, editHistoryIndex: eIdx };
}

// Case 3a: Over-limit history where user had rewound 10 steps
const overLimitGen = Array.from({ length: 45 }, (_, i) => ({ id: i }));
const loadedGen = migratePayloadHistories({ history: overLimitGen, historyIndex: 35 });
assert.strictEqual(loadedGen.history.length, 30);
assert.strictEqual(loadedGen.historyIndex, 35 - (45 - 30)); // 35 - 15 = 20
assert.strictEqual(loadedGen.history[loadedGen.historyIndex].id, 35, 'Restored state must match original snapshot at index 35');

// Case 3b: Over-limit edit history where user rewound deep into trimmed items
const overLimitEdit = Array.from({ length: 40 }, (_, i) => ({ id: i }));
// Trimmed 15 items (0..14). Index was at 5 (which got trimmed).
const loadedDeepRewind = migratePayloadHistories({ editHistory: overLimitEdit, editHistoryIndex: 5 });
assert.strictEqual(loadedDeepRewind.editHistory.length, 25);
assert.strictEqual(loadedDeepRewind.editHistoryIndex, 0, 'Rewound index beyond trimmed window clamps to 0 safely');

// Case 3c: Empty payload
const emptyLoad = migratePayloadHistories({});
assert.strictEqual(emptyLoad.history.length, 0);
assert.strictEqual(emptyLoad.historyIndex, -1);
assert.strictEqual(emptyLoad.editHistory.length, 0);
assert.strictEqual(emptyLoad.editHistoryIndex, -1);

console.log('✓ Migration of over-limit payloads and rewound indices verified.');
console.log('--- ALL HISTORY LIMIT CHECKS PASSED PERFECTLY! ---');

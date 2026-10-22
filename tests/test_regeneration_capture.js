// tests/test_regeneration_capture.js
// Proves the fix for the "edited mosaic disappears when I touch the generator" bug:
// the previous generation entry must be captured BEFORE the mosaic is replaced and BEFORE
// the edit history is reset. The old code captured afterwards and silently did nothing.

const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));
const HistoryNav = require(path.join(__dirname, '../core/history_nav.js'));

const { generateMosaic, cloneMosaicCellsSnapshot } = window.MosaicEngine;

console.log('--- Testing capture-before-regeneration ---');

const config = {
  rows: 2,
  cols: 2,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [0, 1, 2, 3, 4, 5],
  seed: 42
};

const mosaic = generateMosaic(config, (arr) => arr[0]);

// Simulate a user edit: three cells get a distinctive tile/transform
const editedCells = [
  { r: 0, c: 0, sr: 0, sc: 1, tileId: 5, baseTileId: 5, transform: 'r90' },
  { r: 1, c: 1, sr: 2, sc: 3, tileId: 5, baseTileId: 5, transform: 'md' },
  { r: 0, c: 1, sr: 3, sc: 0, tileId: 5, baseTileId: 5, transform: 'id' }
];
for (const e of editedCells) {
  const cell = mosaic.grid[e.r][e.c].cells[e.sr][e.sc];
  cell.tileId = e.tileId;
  cell.baseTileId = e.baseTileId;
  cell.transform = e.transform;
}

const history = [{ seed: 42, rows: 2, cols: 2, gridSymmetryMode: 'mandala_d4', blockSymmetryMode: 'mandala_d4', subdivision: 2, allowedTiles: [0, 1, 2, 3, 4, 5] }];
const editHistory = [cloneMosaicCellsSnapshot(mosaic)]; // one snapshot, edited afterwards
const state = {
  history,
  historyIndex: 0,
  mosaicData: mosaic,
  frozenCells: new Map(),
  editHistory,
  editHistoryIndex: 3
};

// 1. Capture BEFORE regenerating
const captured = HistoryNav.captureBeforeRegeneration(state);
assert.strictEqual(captured, true, 'a dirty document must be captured');
assert.ok(history[0].cellsSnapshot, 'the current entry receives a cells snapshot');

// 2. The captured snapshot must hold the edited cells (this is what the old order broke)
for (const e of editedCells) {
  const snapCell = history[0].cellsSnapshot.gridSnap[e.r][e.c][e.sr][e.sc];
  assert.strictEqual(snapCell.tileId, e.tileId, `captured tileId at ${e.r},${e.c},${e.sr},${e.sc}`);
  assert.strictEqual(snapCell.transform, e.transform, `captured transform at ${e.r},${e.c},${e.sr},${e.sc}`);
}
console.log('✓ Edited cells are inside the captured snapshot.');

// 3. Simulating the regeneration afterwards must NOT overwrite the capture
const newMosaic = generateMosaic({ ...config, seed: 7 }, (arr) => arr[arr.length - 1]);
state.mosaicData = newMosaic;
const secondAttempt = HistoryNav.captureBeforeRegeneration(state);
assert.strictEqual(secondAttempt, false, 'an entry that already has a snapshot is never overwritten');
assert.strictEqual(history[0].cellsSnapshot.gridSnap[0][0][0][1].tileId, 5, 'capture survives the new mosaic');
console.log('✓ Regeneration cannot overwrite an existing capture.');

// 4. A clean document (no edits) is not captured
const cleanState = {
  history: [{ seed: 1 }],
  historyIndex: 0,
  mosaicData: newMosaic,
  frozenCells: new Map(),
  editHistory: [],
  editHistoryIndex: 0
};
assert.strictEqual(HistoryNav.captureBeforeRegeneration(cleanState), false, 'clean document is not captured');
assert.strictEqual(cleanState.history[0].cellsSnapshot, undefined);
console.log('✓ A clean document costs nothing (no snapshot, no budget).');

// 5. Invalid states never throw
assert.strictEqual(HistoryNav.captureBeforeRegeneration(null), false);
assert.strictEqual(HistoryNav.captureBeforeRegeneration({ history: [], historyIndex: 0 }), false);
assert.strictEqual(HistoryNav.captureBeforeRegeneration({ history: [{}], historyIndex: 5 }), false);
console.log('✓ Invalid states are rejected without throwing.');

// 6. Static contract: the capture must be wired BEFORE the generation inside regenerateMosaic,
//    and the old (broken) late call must be gone.
const fs = require('fs');
const sketchSource = fs.readFileSync(path.join(__dirname, '../sketch.js'), 'utf8');

const regenStart = sketchSource.indexOf('function regenerateMosaic(');
const regenEnd = sketchSource.indexOf('function pushGenerationHistory(');
assert.ok(regenStart > -1 && regenEnd > regenStart, 'regenerateMosaic must exist before pushGenerationHistory');

const regenBody = sketchSource.slice(regenStart, regenEnd);
const captureIdx = regenBody.indexOf('captureBeforeRegeneration');
const generateIdx = regenBody.indexOf('generateMosaicWithFrozen');

assert.ok(captureIdx > -1, 'regenerateMosaic must call captureBeforeRegeneration');
assert.ok(generateIdx > -1, 'regenerateMosaic must call generateMosaicWithFrozen');
assert.ok(captureIdx < generateIdx, 'captureBeforeRegeneration must run BEFORE the mosaic is replaced');
console.log('✓ Wiring: capture happens before generation (the bug was the opposite order).');

const pushBody = sketchSource.slice(regenEnd, sketchSource.indexOf('function restoreGenerationHistory('));
assert.ok(
  pushBody.indexOf('saveLazyHistorySnapshot') === -1,
  'pushGenerationHistory must not capture the previous entry any more (it runs after the reset)'
);
console.log('✓ The late, no-op capture was removed from pushGenerationHistory.');

console.log('--- ALL CAPTURE-BEFORE-REGENERATION CHECKS PASSED! ---');

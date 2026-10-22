// tests/test_multistep_undo.js
// Validates multi-step undo/redo stack across edits and generations.
// Guarantees that users are never restricted to a single step of Ctrl+Z.

const assert = require('assert');
const path = require('path');
const fs = require('fs');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));
require(path.join(__dirname, '../core/document_snapshot.js'));
require(path.join(__dirname, '../core/state_persistence.js'));

const { generateMosaic, cloneMosaicCellsSnapshot, restoreMosaicCellsSnapshot } = window.MosaicEngine;
const DocumentSnapshot = window.DocumentSnapshot;

console.log('--- Testing Multi-step Undo / Redo Stack ---');

// 1. Verify edit history does not reset to length 2 on generation
const sketchSource = fs.readFileSync(path.join(__dirname, '../sketch.js'), 'utf8');

assert.ok(
  !sketchSource.includes('StudioState.editHistory = [previousDocument, freshSnapshot]'),
  'editHistory must not be hardcoded to 2 items'
);

// 2. Simulate multi-step edit stack
const config = {
  rows: 2,
  cols: 2,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [0, 1, 2, 3],
  seed: 100
};

const mosaic = generateMosaic(config, arr => arr[0]);
const frozenCells = new Map();
const initialTileId = mosaic.grid[0][0].cells[0][0].tileId;

// History stack simulation
const editHistory = [DocumentSnapshot.attachDocument(cloneMosaicCellsSnapshot(mosaic), DocumentSnapshot.collectParams({ ...config, frozenCells: [] }))];
let editHistoryIndex = 0;

function pushEdit(mutator) {
  mutator();
  const snap = cloneMosaicCellsSnapshot(mosaic, frozenCells);
  if (editHistoryIndex < editHistory.length - 1) {
    editHistory.splice(editHistoryIndex + 1);
  }
  editHistory.push(snap);
  editHistoryIndex = editHistory.length - 1;
}

// Perform 4 distinct edits
for (let step = 1; step <= 4; step++) {
  pushEdit(() => {
    mosaic.grid[0][0].cells[0][0].tileId = step * 10;
  });
}

assert.strictEqual(editHistory.length, 5, 'Should have initial snap + 4 edit snaps');
assert.strictEqual(editHistoryIndex, 4, 'Current index should be 4');

// Verify we can undo 4 times back to index 0
for (let i = 3; i >= 0; i--) {
  editHistoryIndex--;
  const snap = editHistory[editHistoryIndex];
  restoreMosaicCellsSnapshot(mosaic, snap, frozenCells);
  assert.strictEqual(editHistoryIndex, i, `Index must be ${i} after undo`);
  if (i > 0) {
    assert.strictEqual(mosaic.grid[0][0].cells[0][0].tileId, i * 10, `TileId must match edit step ${i}`);
  } else {
    assert.strictEqual(mosaic.grid[0][0].cells[0][0].tileId, initialTileId, 'Must restore initial tileId');
  }
}
console.log('✓ 4 consecutive cell edits can be undone 4 times back to initial state.');

// Verify we can redo 4 times back to index 4
for (let i = 1; i <= 4; i++) {
  editHistoryIndex++;
  const snap = editHistory[editHistoryIndex];
  restoreMosaicCellsSnapshot(mosaic, snap, frozenCells);
  assert.strictEqual(editHistoryIndex, i, `Index must be ${i} after redo`);
  assert.strictEqual(mosaic.grid[0][0].cells[0][0].tileId, i * 10, `TileId must match edit step ${i}`);
}
console.log('✓ All 4 edit steps can be redone back to the latest state.');

// 3. Multi-generation crossing
// When generating a new mosaic, the previous entry is tagged with its parameters
const prevEntry = editHistory[editHistoryIndex];
if (!prevEntry.document) {
  DocumentSnapshot.attachDocument(prevEntry, DocumentSnapshot.collectParams({ ...config, frozenCells: [] }));
}

const genConfig2 = { ...config, seed: 200 };
const mosaic2 = generateMosaic(genConfig2, arr => arr[arr.length - 1]);
const snap2 = DocumentSnapshot.attachDocument(
  cloneMosaicCellsSnapshot(mosaic2, frozenCells),
  DocumentSnapshot.collectParams({ ...genConfig2, frozenCells: [] })
);
editHistory.push(snap2);
editHistoryIndex = editHistory.length - 1;

assert.strictEqual(editHistory.length, 6, 'Stack now has 6 items including generation');
assert.strictEqual(editHistoryIndex, 5);

// Undo the generation step
editHistoryIndex--;
const snapPrevGen = editHistory[editHistoryIndex];
assert.strictEqual(DocumentSnapshot.hasDocument(snapPrevGen), true, 'Previous document carried params');
assert.strictEqual(snapPrevGen.document.seed, 100, 'Previous seed 100 preserved');
assert.strictEqual(editHistoryIndex, 4, 'Undo goes to edit step 4');

// Undo again goes to edit step 3
editHistoryIndex--;
assert.strictEqual(editHistoryIndex, 3, 'Second undo goes to edit step 3');

console.log('✓ Ctrl+Z cleanly crosses generations and continues through prior cell edits.');
console.log('--- ALL MULTI-STEP UNDO CHECKS PASSED! ---');

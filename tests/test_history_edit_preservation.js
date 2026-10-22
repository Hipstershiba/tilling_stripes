// tests/test_history_edit_preservation.js
// Integration test: Generates mosaic, edits 3 cells, records snapshot lazily,
// navigates to another entry and navigates back -> the 3 edited cells return intact.

const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));
require(path.join(__dirname, '../core/history_nav.js'));

const MosaicEngine = window.MosaicEngine;
const HistoryNav = window.HistoryNav;

console.log('--- Testing History Navigation Edit Preservation Integration ---');

const config1 = {
  seed: 111,
  rows: 2,
  cols: 2,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [0, 1, 2, 3, 4, 5, 6, 7]
};

const config2 = {
  ...config1,
  seed: 222
};

// 1. Generate Entry 1
let s1 = 0;
const prng1 = (arr) => arr[(s1++) % arr.length];
const mosaic1 = MosaicEngine.generateMosaic(config1, prng1);

const entry1 = {
  ...config1,
  timestamp: '10:00:00'
};

// 2. Edit 3 cells in mosaic1
const editedPlacements = [
  { row: 0, col: 0, subRow: 0, subCol: 0, baseTileId: 5, transform: 'r90', tileId: 5 },
  { row: 0, col: 0, subRow: 0, subCol: 1, baseTileId: 6, transform: 'r180', tileId: 6 },
  { row: 0, col: 0, subRow: 1, subCol: 0, baseTileId: 7, transform: 'r270', tileId: 7 }
];
MosaicEngine.applyStampPlacements(mosaic1, editedPlacements);

// Verify cells were modified
assert.strictEqual(mosaic1.grid[0][0].cells[0][0].baseTileId, 5);
assert.strictEqual(mosaic1.grid[0][0].cells[0][1].baseTileId, 6);
assert.strictEqual(mosaic1.grid[0][0].cells[1][0].baseTileId, 7);

// 3. Before navigating away from entry1, save snapshot lazily
HistoryNav.saveLazyHistorySnapshot(entry1, mosaic1, new Map(), 3);
assert.ok(entry1.cellsSnapshot, 'entry1 must now have cellsSnapshot');
assert.strictEqual(entry1.isDirty, true, 'entry1 must be marked dirty');

// 4. Generate and navigate to Entry 2
let s2 = 0;
const prng2 = (arr) => arr[(s2++) % arr.length];
const mosaic2 = MosaicEngine.generateMosaic(config2, prng2);
const entry2 = {
  ...config2,
  timestamp: '10:01:00'
};

// 5. Navigate BACK to Entry 1
const plan = HistoryNav.planRestore(entry1, { isOverBudget: false });
assert.strictEqual(plan.action, 'restore_snapshot');

// Apply restoration
MosaicEngine.restoreMosaicCellsSnapshot(mosaic2, plan.snapshot);

// Verification: the 3 cells in mosaic2 must now match the edited cells of entry1!
assert.strictEqual(mosaic2.grid[0][0].cells[0][0].baseTileId, 5, 'Cell [0,0,0,0] preserved');
assert.strictEqual(mosaic2.grid[0][0].cells[0][1].baseTileId, 6, 'Cell [0,0,0,1] preserved');
assert.strictEqual(mosaic2.grid[0][0].cells[1][0].baseTileId, 7, 'Cell [0,0,1,0] preserved');

console.log('✓ Edited cells successfully preserved across history navigation roundtrip.');

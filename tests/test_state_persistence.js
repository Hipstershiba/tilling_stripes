// tests/test_state_persistence.js
const path = require('path');
const assert = require('assert');

// Setup Node.js browser mocks
const storageMap = new Map();
global.localStorage = {
  getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
  setItem: (key, val) => storageMap.set(key, String(val)),
  removeItem: (key) => storageMap.delete(key),
  clear: () => storageMap.clear()
};

global.window = {
  localStorage: global.localStorage,
  devicePixelRatio: 1,
  addEventListener: () => {}
};
global.document = {
  getElementById: (id) => ({
    classList: {
      contains: () => false,
      add: () => {},
      remove: () => {}
    },
    textContent: ''
  }),
  querySelectorAll: () => []
};

require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));
const StatePersistence = require(path.join(__dirname, '../core/state_persistence.js'));

const { generateMosaic, cloneMosaicCellsSnapshot, restoreMosaicCellsSnapshot } = window.MosaicEngine;
const totalTiles = window.TileRegistry.TILE_RENDERERS.length;
const storageKey = StatePersistence.STORAGE_KEY_STUDIO_STATE;

console.log(`--- Testing Robust Mosaic & Studio State Persistence (${totalTiles} tiles) ---`);

// 1. Generate a mosaic (3x3 blocks, subdivision 2 -> 4x4 subtiles per block)
const mosaic = generateMosaic({
  rows: 3,
  cols: 3,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  allowedTiles: [6, 37, 54], // fully symmetric tiles
  seed: 9999
}, (arr) => arr[0]);

const N = mosaic.subtilesPerSide;

// 2. Perform 15 distinct user edits across different blocks and subtiles
const editedCells = [];
for (let i = 0; i < 15; i++) {
  const br = i % 3;
  const bc = Math.floor(i / 3) % 3;
  const sr = i % N;
  const sc = (i * 2) % N;
  const tileId = (i * 5) % totalTiles;
  const transform = ['id', 'r90', 'r180', 'r270', 'mx', 'my', 'md', 'mad'][i % 8];

  const cell = mosaic.grid[br][bc].cells[sr][sc];
  cell.baseTileId = tileId;
  cell.transform = transform;
  cell.tileId = window.TileRegistry.getTransformedTileId(tileId, transform);

  editedCells.push({ br, bc, sr, sc, tileId: cell.tileId, baseTileId: tileId, transform });
}
console.log(`Simulated ${editedCells.length} edits across 3x3 blocks.`);

// 3. Simulate edit history stack with 30 snapshots and an undone state
const editHistoryStack = [];
for (let s = 0; s < 30; s++) {
  // Alter cell [0,0][0,0] sequentially across history
  mosaic.grid[0][0].cells[0][0].tileId = s;
  mosaic.grid[0][0].cells[0][0].baseTileId = s;
  mosaic.grid[0][0].cells[0][0].transform = 'id';
  editHistoryStack.push(cloneMosaicCellsSnapshot(mosaic));
}

// User undid 10 edits -> editHistoryIndex should be 19
const editHistoryIndex = 19;
const activeUndoneSnapshot = editHistoryStack[editHistoryIndex];

// Apply the undone snapshot to the active mosaic
restoreMosaicCellsSnapshot(mosaic, activeUndoneSnapshot);

// 4. Save to mock localStorage via StatePersistence
const payload = {
  version: 2,
  seed: 9999,
  rows: 3,
  cols: 3,
  subdivision: 2,
  workspace: 'edit',
  activeTool: 'paint',
  cellsSnapshot: cloneMosaicCellsSnapshot(mosaic),
  history: [{ seed: 100 }, { seed: 200 }],
  historyIndex: 1,
  editHistory: editHistoryStack,
  editHistoryIndex: editHistoryIndex
};

const saveRes = StatePersistence.saveWithQuotaFallback(localStorage, storageKey, payload, mosaic);
assert.strictEqual(saveRes.success, true, 'StatePersistence saveWithQuotaFallback must succeed');
console.log('✓ Successfully serialized and saved full studio state to localStorage.');

// 5. Simulate page reload
const raw = localStorage.getItem(storageKey);
assert.ok(raw, 'localStorage must contain saved state');
const restoredPayload = JSON.parse(raw);

// 6. Reload and restore mosaic
const reloadedMosaic = generateMosaic({
  rows: restoredPayload.rows,
  cols: restoredPayload.cols,
  subdivision: restoredPayload.subdivision,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  allowedTiles: [6, 37, 54],
  seed: restoredPayload.seed
}, (arr) => arr[0]);

const ok = restoreMosaicCellsSnapshot(reloadedMosaic, restoredPayload.cellsSnapshot);
assert.strictEqual(ok, true, 'restoreMosaicCellsSnapshot must succeed');

// 7. Verify all edited cells (excluding the undone cell [0,0][0,0])
for (const ec of editedCells) {
  if (ec.br === 0 && ec.bc === 0 && ec.sr === 0 && ec.sc === 0) continue;
  const target = reloadedMosaic.grid[ec.br][ec.bc].cells[ec.sr][ec.sc];
  assert.strictEqual(target.baseTileId, ec.baseTileId, `Cell [${ec.br},${ec.bc}][${ec.sr},${ec.sc}] baseTileId mismatch`);
  assert.strictEqual(target.transform, ec.transform, `Cell [${ec.br},${ec.bc}][${ec.sr},${ec.sc}] transform mismatch`);
  assert.strictEqual(target.tileId, ec.tileId, `Cell [${ec.br},${ec.bc}][${ec.sr},${ec.sc}] tileId mismatch`);
}

// 8. Verify the undone cell matches the 19th edit snapshot
const undoneCell = reloadedMosaic.grid[0][0].cells[0][0];
assert.strictEqual(undoneCell.tileId, 19, 'Restored cell [0,0][0,0] must match the 19th snapshot from undo state');

// 9. Verify history migration and clamping
assert.ok(restoredPayload.editHistory.length <= StatePersistence.MAX_EDIT_HISTORY, 'Edit history should be clamped');
assert.ok(restoredPayload.editHistoryIndex >= 0, 'Edit history index must be valid non-negative');

console.log('✓ All 15 edited cells and undo/redo history verified after reload.');
console.log('--- ALL PERSISTENCE CHECKS PASSED PERFECTLY! ---');

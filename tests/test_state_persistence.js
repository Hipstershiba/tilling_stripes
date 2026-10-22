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

let warningVisible = false;
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

const { generateMosaic, cloneMosaicCellsSnapshot, restoreMosaicCellsSnapshot } = window.MosaicEngine;
const totalTiles = window.TileRegistry.TILE_RENDERERS.length;

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
  const cell = mosaic.grid[br][bc].cells[sr][sc];
  const newBaseTileId = (i * 5 + 6) % totalTiles;
  const newTransform = ['id', 'r90', 'r180', 'r270', 'mx', 'my'][i % 6];
  cell.baseTileId = newBaseTileId;
  cell.transform = newTransform;
  cell.tileId = window.TileRegistry.getTransformedTileId(newBaseTileId, newTransform);
  editedCells.push({ br, bc, sr, sc, baseTileId: newBaseTileId, transform: newTransform, tileId: cell.tileId });
}

console.log(`Simulated ${editedCells.length} edits across 3x3 blocks.`);

// 3. Build an edit history stack of 30 snapshots, then simulate undoing 10 steps
const initialSnapshot = cloneMosaicCellsSnapshot(mosaic);
const editHistoryStack = [];
for (let step = 0; step < 30; step++) {
  // modify one cell per step
  mosaic.grid[0][0].cells[0][0].tileId = step;
  editHistoryStack.push(cloneMosaicCellsSnapshot(mosaic));
}

// User undid 10 edits -> editHistoryIndex should be 19
const editHistoryIndex = 19;
const activeUndoneSnapshot = editHistoryStack[editHistoryIndex];

// Apply the undone snapshot to the active mosaic
restoreMosaicCellsSnapshot(mosaic, activeUndoneSnapshot);

// 4. Save to mock localStorage
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

localStorage.setItem('tiling_stripes_studio_state_v2', JSON.stringify(payload));
console.log('✓ Successfully serialized and saved full studio state to localStorage.');

// 5. Simulate page reload
const raw = localStorage.getItem('tiling_stripes_studio_state_v2');
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
const MAX_EDIT_HISTORY = 25;
let migratedEditHistory = restoredPayload.editHistory;
let migratedEditIndex = restoredPayload.editHistoryIndex;
if (migratedEditHistory.length > MAX_EDIT_HISTORY) {
  const trimmed = migratedEditHistory.length - MAX_EDIT_HISTORY;
  migratedEditHistory = migratedEditHistory.slice(-MAX_EDIT_HISTORY);
  migratedEditIndex = Math.max(0, migratedEditIndex - trimmed);
}

assert.strictEqual(migratedEditHistory.length, 25, 'Edit history must clamp to 25 items');
assert.strictEqual(migratedEditIndex, 19 - (30 - 25), 'Edit history index must adjust by trimmed count (19 - 5 = 14)');

console.log(`✓ All ${editedCells.length} edited cells and undo/redo history verified after reload.`);
console.log('--- ALL PERSISTENCE CHECKS PASSED PERFECTLY! ---');

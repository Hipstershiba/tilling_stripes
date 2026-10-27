// tests/test_library_store_crud.js
// Tests LibraryStore CRUD (groups & families), duplicate built-in, orbit expansion/contraction remap,
// deletion tombstone (-> #84), studio state remapping, JSON export/import, reset, and IndexedDB hydration.

const assert = require('assert');
const path = require('path');

// Mock localStorage & IndexedDB before loading modules
const lsMap = new Map();
const idbMap = new Map();

global.localStorage = {
  getItem: (k) => (lsMap.has(k) ? lsMap.get(k) : null),
  setItem: (k, v) => lsMap.set(k, String(v)),
  removeItem: (k) => lsMap.delete(k)
};

function makeFakeIDB() {
  return {
    open(_name, _version) {
      const req = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      setImmediate(() => {
        const db = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => ({}),
          close: () => {},
          transaction(_stores, _mode) {
            const tx = { oncomplete: null, onerror: null, onabort: null,
              objectStore(_storeName) {
                return {
                  put(val, key) {
                    const r = { onsuccess: null, onerror: null };
                    setImmediate(() => {
                      idbMap.set(key, JSON.parse(JSON.stringify(val)));
                      if (r.onsuccess) r.onsuccess({ target: r });
                      if (tx.oncomplete) tx.oncomplete();
                    });
                    return r;
                  },
                  get(key) {
                    const r = { result: undefined, onsuccess: null, onerror: null };
                    setImmediate(() => {
                      r.result = idbMap.has(key) ? JSON.parse(JSON.stringify(idbMap.get(key))) : undefined;
                      if (r.onsuccess) r.onsuccess({ target: r });
                      if (_mode === 'readonly' && tx.oncomplete) tx.oncomplete();
                    });
                    return r;
                  }
                };
              }
            };
            return tx;
          }
        };
        req.result = db;
        if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    }
  };
}

global.indexedDB = makeFakeIDB();
global.window = {
  localStorage: global.localStorage,
  indexedDB: global.indexedDB
};

require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));

const LibraryStore = global.window.LibraryStore;
const TileRegistry = global.window.TileRegistry;

(async function runTests() {
  console.log('--- Testing LibraryStore CRUD, Remap & Persistence ---');

  // 1. Group CRUD & protection of built-in groups
  const newGrp = LibraryStore.createGroup('Geometria Autoral');
  assert(!newGrp.builtIn && newGrp.name === 'Geometria Autoral');
  const renamedGrp = LibraryStore.renameGroup(newGrp.id, 'Série Autoral');
  assert.strictEqual(renamedGrp.name, 'Série Autoral');
  assert.throws(() => LibraryStore.deleteGroup('grp-ribbons'), /built-in group/i);

  // 2. Family creation (symmetric_1 -> 1 tile at #85) & orbit expansion (1 -> 4 -> 8) + second family shift
  const createdA = LibraryStore.createFamily({
    name: 'Bloco Central',
    groupId: newGrp.id,
    shapes: [{ id: 's1', type: 'rect', x: -0.2, y: -0.2, w: 0.4, h: 0.4, fill: true }]
  });
  assert.deepStrictEqual(createdA.meta.tileIds, [85]);
  assert.strictEqual(TileRegistry.TILE_RENDERERS.length, 86);

  const createdB = LibraryStore.createFamily({
    name: 'Ponto Extra',
    groupId: newGrp.id,
    shapes: [{ id: 's1', type: 'ellipse', cx: 0, cy: 0, rx: 0.15, ry: 0.15, fill: true }]
  });
  assert.deepStrictEqual(createdB.meta.tileIds, [86]);
  assert.strictEqual(TileRegistry.TILE_RENDERERS.length, 87);

  // Simulate a live StudioState using tile #85 and #86 (real MosaicEngine grid + gridSnap + frozenCells Map)
  const fakeStudioState = {
    mosaicData: {
      rows: 1,
      cols: 1,
      subtilesPerSide: 2,
      grid: [[{
        cells: [
          [{ tileId: 85, baseTileId: 85, transform: 'id' }, { tileId: 86, baseTileId: 86, transform: 'id' }],
          [{ tileId: 0, baseTileId: 0, transform: 'id' }, { tileId: 84, baseTileId: 84, transform: 'id' }]
        ]
      }]]
    },
    frozenCells: new Map([['0,0,0,1', { tileId: 86, baseTileId: 86, transform: 'id' }]]),
    allowedTiles: new Set([0, 85, 86]),
    editBrushTileId: 86,
    supertilePattern: { rows: 1, cols: 1, cells: [[{ tileId: 86, baseTileId: 86, transform: 'id' }]] },
    editHistory: [{ gridSnap: [[[[{ tileId: 86, baseTileId: 86, transform: 'id' }]]]] }],
    history: [{ allowedTiles: [0, 86], lazyCellsSnapshot: { gridSnap: [[[[{ tileId: 86, baseTileId: 86, transform: 'id' }]]]] } }]
  };

  // Expand family A from 1 symmetric variant (#85) to 4 edge variants (#85..88) -> family B shifts #86 -> #89!
  const updatedA = LibraryStore.updateFamily(createdA.family.id, {
    shapes: [{ id: 's1', type: 'rect', x: -0.5, y: -0.5, w: 0.4, h: 1, fill: true }]
  });
  assert.deepStrictEqual(updatedA.meta.tileIds, [85, 86, 87, 88]);
  assert.strictEqual(updatedA.event.idRemap[86], 89, 'Family B (#86) should remap cleanly to #89');

  LibraryStore.remapStudioState(fakeStudioState, updatedA.event.idRemap, updatedA.event.maxValidTileId);
  assert.strictEqual(fakeStudioState.mosaicData.grid[0][0].cells[0][1].tileId, 89, 'Mosaic cell using Family B must shift to #89');
  assert.strictEqual(fakeStudioState.frozenCells.get('0,0,0,1').tileId, 89, 'Frozen cell must shift to #89');
  assert.strictEqual(fakeStudioState.editHistory[0].gridSnap[0][0][0][0].tileId, 89, 'Edit history gridSnap must shift to #89');
  assert.strictEqual(fakeStudioState.editBrushTileId, 89, 'Active brush must shift to #89');
  assert(fakeStudioState.allowedTiles.has(89) && !fakeStudioState.allowedTiles.has(86));
  console.log('✓ Orbit expansion (1 -> 4 variants) shifts subsequent custom IDs and remaps StudioState accurately.');

  // 3. Delete Family A (#85..88) -> Tombstone to #84 Empty Tile, and Family B compacts #89 -> #85!
  const delEvt = LibraryStore.deleteFamily(createdA.family.id);
  assert.strictEqual(delEvt.idRemap[85], 84, 'Deleted Family A must map to #84 Empty Tile');
  assert.strictEqual(delEvt.idRemap[89], 85, 'Remaining Family B must compact back to #85');

  LibraryStore.remapStudioState(fakeStudioState, delEvt.idRemap, delEvt.maxValidTileId);
  assert.strictEqual(fakeStudioState.mosaicData.grid[0][0].cells[0][0].tileId, 84, 'Deleted tile in mosaic must become #84 Empty Tile');
  assert.strictEqual(fakeStudioState.mosaicData.grid[0][0].cells[0][1].tileId, 85, 'Surviving Family B in mosaic must become #85');
  assert.strictEqual(TileRegistry.TILE_RENDERERS.length, 86);
  console.log('✓ Family deletion tombstones cells to #84 Empty Tile and keeps TILE_RENDERERS 100% dense.');

  // 4. Built-in protection & 1-click duplicateFamily (including zigzag true 4-variant orbit)
  assert.throws(() => LibraryStore.deleteFamily('empty-tile'), /Cannot delete/i);
  assert.throws(() => LibraryStore.updateFamily('empty-tile', { name: 'Hack' }), /protected/i);
  assert.throws(() => LibraryStore.updateFamily('half-circle', { shapes: [] }), /read-only/i);

  const dupZigzag = LibraryStore.duplicateFamily('zigzag', { name: 'Zigue-Zague Custom' });
  assert.strictEqual(dupZigzag.family.builtIn, false);
  assert.strictEqual(dupZigzag.meta.tileIds.length, 4, 'Duplicated custom zigzag uses true 4-variant C2 orbit');
  console.log('✓ Built-in protection enforced; duplicateFamily creates editable custom copy with automatic D4 orbit.');

  // 5. Export JSON, Reset to Defaults, and Import JSON (merge & replace)
  const exportedJson = LibraryStore.exportLibraryJSON({ customOnly: true });
  const resetEvt = LibraryStore.resetToDefaults();
  assert.strictEqual(TileRegistry.TILE_RENDERERS.length, 85);
  assert.strictEqual(resetEvt.idRemap[85], 84);

  LibraryStore.importLibraryJSON(exportedJson, { mode: 'merge' });
  assert.strictEqual(TileRegistry.TILE_RENDERERS.length, 90, 'Expected 85 + 1 + 4 = 90 tiles after merge import');
  console.log('✓ JSON export (customOnly), resetToDefaults, and merge import verified.');

  // 6. Async IndexedDB hydration precedence when localStorage is stale
  await new Promise((r) => setTimeout(r, 25)); // Let async IDB put settle
  lsMap.clear(); // Simulate cleared/missing localStorage while IndexedDB still holds the custom library
  const freshInstance = LibraryStore.createLibraryStoreInstance();
  assert.strictEqual(freshInstance.getCompiled().totalTiles, 85, 'Sync boot with empty LS starts at 85 built-ins');
  const hyd = await freshInstance.hydrateFromIndexedDB();
  assert.strictEqual(hyd.hydrated, true, 'Should hydrate richer library from IndexedDB');
  assert.strictEqual(freshInstance.getCompiled().totalTiles, 90, 'Hydrated store restores all 90 tiles from IndexedDB');
  console.log('✓ IndexedDB async hydration restores custom library when localStorage is empty/stale.');

  // Clean up default state
  LibraryStore.resetToDefaults();
  console.log('--- ALL LIBRARY STORE CRUD & REMAP TESTS PASSED! ---');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

// tests/test_indexeddb_persistence.js
// Tests the IndexedDB persistence layer, asynchronous round-trip storage,
// error handling, and localStorage-to-IndexedDB migration.

const assert = require('assert');
const path = require('path');
const StatePersistence = require(path.join(__dirname, '../core/state_persistence.js'));

console.log('--- Testing IndexedDB Persistence Layer ---');

// 1. Verify IndexedDB constants and exports
assert.strictEqual(typeof StatePersistence.openIndexedDB, 'function', 'openIndexedDB must be exported');
assert.strictEqual(typeof StatePersistence.saveToIndexedDB, 'function', 'saveToIndexedDB must be exported');
assert.strictEqual(typeof StatePersistence.loadFromIndexedDB, 'function', 'loadFromIndexedDB must be exported');
assert.strictEqual(typeof StatePersistence.migrateLocalStorageToIndexedDB, 'function', 'migrateLocalStorageToIndexedDB must be exported');
assert.strictEqual(typeof StatePersistence.IDB_DATABASE_NAME, 'string', 'IDB_DATABASE_NAME must be exported');
assert.strictEqual(typeof StatePersistence.IDB_STORE_NAME, 'string', 'IDB_STORE_NAME must be exported');
assert.strictEqual(typeof StatePersistence.IDB_KEY_CURRENT, 'string', 'IDB_KEY_CURRENT must be exported');
assert.strictEqual(StatePersistence.IDB_MAX_GENERATION_HISTORY, 256, 'IDB_MAX_GENERATION_HISTORY must be 256');
assert.strictEqual(StatePersistence.IDB_MAX_EDIT_HISTORY, 100, 'IDB_MAX_EDIT_HISTORY must be 100');
console.log('✓ IndexedDB function exports and expanded 256/100 constants verified.');

// 2. Test graceful rejection when IndexedDB is unavailable
async function testUnavailable() {
  let failed = false;
  try {
    await StatePersistence.openIndexedDB(null);
  } catch (err) {
    failed = true;
    assert.ok(err.message.includes('not supported') || err.message.includes('unavailable'));
  }
  assert.strictEqual(failed, true, 'openIndexedDB must reject gracefully when IndexedDB is not available');
  console.log('✓ Graceful fallback when IndexedDB is unavailable verified.');
}

// 3. Create a deterministic in-memory mock of the W3C IndexedDB API for testing
function createMockIndexedDB() {
  const databases = new Map();

  return {
    open(dbName, version = 1) {
      const req = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null
      };

      setTimeout(() => {
        let db = databases.get(dbName);
        let isUpgrade = false;
        if (!db) {
          isUpgrade = true;
          const stores = new Map();
          db = {
            name: dbName,
            version,
            objectStoreNames: {
              contains: (name) => stores.has(name)
            },
            createObjectStore: (name) => {
              stores.set(name, new Map());
              return {};
            },
            transaction: (storeNames, mode) => {
              const tx = {
                mode,
                error: null,
                oncomplete: null,
                onerror: null,
                objectStore: (name) => {
                  const storeData = stores.get(name);
                  if (!storeData) throw new Error(`Unknown store: ${name}`);
                  return {
                    put: (val, key) => {
                      const putReq = { onsuccess: null, onerror: null, result: key };
                      setTimeout(() => {
                        storeData.set(key, JSON.parse(JSON.stringify(val)));
                        if (putReq.onsuccess) putReq.onsuccess({ target: putReq });
                        if (tx.oncomplete) tx.oncomplete();
                      }, 0);
                      return putReq;
                    },
                    get: (key) => {
                      const getReq = { onsuccess: null, onerror: null, result: null };
                      setTimeout(() => {
                        const found = storeData.get(key);
                        getReq.result = found ? JSON.parse(JSON.stringify(found)) : undefined;
                        if (getReq.onsuccess) getReq.onsuccess({ target: getReq });
                        if (tx.oncomplete) tx.oncomplete();
                      }, 0);
                      return getReq;
                    }
                  };
                }
              };
              return tx;
            },
            close: () => {}
          };
          databases.set(dbName, db);
        }

        req.result = db;
        if (isUpgrade && req.onupgradeneeded) {
          req.onupgradeneeded({ target: req });
        }
        if (req.onsuccess) {
          req.onsuccess({ target: req });
        }
      }, 0);

      return req;
    }
  };
}

// 4. Test Save & Load Round-trip in Mock IndexedDB
async function testSaveAndLoad() {
  const mockIDB = createMockIndexedDB();
  const history256 = Array.from({ length: 256 }, (_, i) => ({ seed: 1000 + i, rows: 4, cols: 4 }));
  const edits100 = Array.from({ length: 100 }, (_, i) => ({ editId: i, rows: 4, cols: 4 }));

  const testPayload = {
    version: 3,
    seed: 42000,
    rows: 4,
    cols: 4,
    gridSymmetryMode: 'mandala_d4',
    history: history256,
    editHistory: edits100,
    cellsSnapshot: { gridSnap: [[{ tileId: 4 }]] }
  };

  const saveRes = await StatePersistence.saveToIndexedDB(
    StatePersistence.IDB_KEY_CURRENT,
    testPayload,
    mockIDB
  );
  assert.strictEqual(saveRes.success, true, 'saveToIndexedDB must return success: true');

  const loaded = await StatePersistence.loadFromIndexedDB(
    StatePersistence.IDB_KEY_CURRENT,
    mockIDB
  );
  assert.ok(loaded, 'loadFromIndexedDB must retrieve saved payload');
  assert.strictEqual(loaded.seed, 42000);
  assert.strictEqual(loaded.history.length, 256, 'All 256 generation snapshots must be preserved');
  assert.strictEqual(loaded.editHistory.length, 100, 'All 100 edit snapshots must be preserved');
  assert.deepStrictEqual(loaded.cellsSnapshot, testPayload.cellsSnapshot);
  console.log('✓ IndexedDB save & load round-trip succeeded with 256 generation and 100 edit history items.');
}

// 5. Test localStorage to IndexedDB Migration
async function testMigration() {
  const mockIDB = createMockIndexedDB();
  const legacyStorage = new Map();
  const localStorageMock = {
    getItem: (key) => legacyStorage.get(key) || null,
    setItem: (key, val) => legacyStorage.set(key, String(val))
  };

  const legacyData = {
    version: 3,
    seed: 99999,
    rows: 3,
    cols: 3,
    history: [{ seed: 99999 }]
  };
  localStorageMock.setItem(StatePersistence.STORAGE_KEY_STUDIO_STATE, JSON.stringify(legacyData));

  const migrated = await StatePersistence.migrateLocalStorageToIndexedDB(
    localStorageMock,
    StatePersistence.STORAGE_KEY_STUDIO_STATE,
    mockIDB
  );
  assert.strictEqual(migrated, true, 'migrateLocalStorageToIndexedDB must return true');

  const inIDB = await StatePersistence.loadFromIndexedDB(
    StatePersistence.IDB_KEY_CURRENT,
    mockIDB
  );
  assert.ok(inIDB, 'Migrated state must be present in IndexedDB');
  assert.strictEqual(inIDB.seed, 99999);
  console.log('✓ Legacy localStorage data migrated cleanly to IndexedDB.');
}

// 6. Test Boot Precedence: Rich IndexedDB MUST NOT be overwritten by truncated or fallback-minimal localStorage
async function testBootPrecedence() {
  const mockIDB = createMockIndexedDB();
  const storageMap = new Map();
  const localStorageMock = {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, val) => storageMap.set(key, String(val))
  };

  const ts = 1700000000000;
  const richPayload = {
    version: 3,
    timestamp: ts,
    seed: 77777,
    rows: 4,
    cols: 4,
    history: Array.from({ length: 60 }, (_, i) => ({ seed: i })),
    editHistory: Array.from({ length: 45 }, (_, i) => ({ editId: i }))
  };

  // Simulate normal dual-save: IDB gets 60/45, localStorage gets clamped 30/25
  await StatePersistence.saveToIndexedDB(StatePersistence.IDB_KEY_CURRENT, richPayload, mockIDB);
  StatePersistence.saveWithQuotaFallback(localStorageMock, StatePersistence.STORAGE_KEY_STUDIO_STATE, richPayload, { rows: 4, cols: 4, subtilesPerSide: 4 });

  const resolved1 = await StatePersistence.resolveBootState(
    localStorageMock,
    StatePersistence.STORAGE_KEY_STUDIO_STATE,
    mockIDB
  );
  assert.strictEqual(resolved1.source, 'indexeddb', 'Boot must prefer rich IndexedDB over clamped localStorage');
  assert.strictEqual(resolved1.payload.history.length, 60, 'All 60 generation snapshots must survive reload');
  assert.strictEqual(resolved1.payload.editHistory.length, 45, 'All 45 edit snapshots must survive reload');

  // Simulate emergency quota fallback (0/0 histories in localStorage with same timestamp)
  const minimal = StatePersistence.buildMinimalEmergencyPayload(richPayload);
  localStorageMock.setItem(StatePersistence.STORAGE_KEY_STUDIO_STATE, JSON.stringify(minimal));

  const resolved2 = await StatePersistence.resolveBootState(
    localStorageMock,
    StatePersistence.STORAGE_KEY_STUDIO_STATE,
    mockIDB
  );
  assert.strictEqual(resolved2.source, 'indexeddb', 'Emergency minimal localStorage must NOT overwrite IndexedDB');
  assert.strictEqual(resolved2.payload.history.length, 60, 'Rich history in IndexedDB must remain intact after fallback');
  console.log('✓ Boot precedence verified: localStorage cache never overwrites rich IndexedDB history.');
}

async function testLegacyDatabaseMigration() {
  const factory = createMockIndexedDB();
  const db = await StatePersistence.openIndexedDB(factory, 'tiling_stripes_studio_db', 'studio_state_store');
  const legacy = {version: 3, timestamp: 50, history: [{seed: 17}, {seed: 18}], editHistory: []};
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['studio_state_store'], 'readwrite');
    const req = tx.objectStore('studio_state_store').put(legacy, StatePersistence.IDB_KEY_CURRENT);
    req.onsuccess = resolve; req.onerror = reject;
  });
  const result = await StatePersistence.resolveBootState({getItem: () => null}, undefined, factory);
  assert.deepStrictEqual(result.payload, legacy);
  assert.deepStrictEqual(await StatePersistence.loadFromIndexedDB(undefined, factory), legacy);
  console.log('✓ Legacy database preserved and migrated to canonical database.');
}

async function run() {
  await testUnavailable();
  await testSaveAndLoad();
  await testMigration();
  await testBootPrecedence();
  await testLegacyDatabaseMigration();
  console.log('--- ALL INDEXEDDB PERSISTENCE CHECKS PASSED PERFECTLY! ---');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

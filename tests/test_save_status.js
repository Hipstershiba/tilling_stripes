const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { createSaveStatus } = require('../core/save_status.js');
const persistence = require('../core/state_persistence.js');
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
const full = () => ({ success: true, mode: 'full' });
const fail = () => { throw new Error('Storage denied'); };

// Transactional mock: successful requests do not become durable until commit.
function makeIDB() {
  const data = new Map(), held = [];
  const control = { hold: false, abort: false, data, held };
  control.factory = { open() {
    const req = {};
    queueMicrotask(() => {
      const db = { close() {}, objectStoreNames: { contains: () => true },
        transaction(_stores, mode) {
          let pending = 0, finished = false;
          const writes = new Map();
          const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
          const finish = () => {
            if (finished || pending) return;
            finished = true;
            if (control.abort && mode === 'readwrite') { tx.error = new Error('Transaction aborted'); tx.onabort?.(); }
            else { for (const [key, value] of writes) data.set(key, value); tx.oncomplete?.(); }
          };
          const operation = work => {
            pending++;
            const request = {};
            queueMicrotask(() => {
              request.result = work(); request.onsuccess?.({ target: request }); pending--;
              if (!pending) {
                if (control.hold && mode === 'readwrite') held.push(finish);
                else queueMicrotask(finish);
              }
            });
            return request;
          };
          tx.objectStore = () => ({
            get: key => operation(() => data.get(key)),
            put: (value, key) => operation(() => { writes.set(key, JSON.parse(JSON.stringify(value))); return key; })
          });
          return tx;
        } };
      req.result = db; req.onsuccess?.({ target: req });
    });
    return req;
  } };
  return control;
}

async function run() {
  for (const [local, indexed, expected] of [
    [full, async () => full(), 'saved'],
    [fail, async () => full(), 'saved'],
    [full, async () => { throw Error('IDB denied'); }, 'saved'],
    [fail, async () => { throw Error('IDB denied'); }, 'failed'],
    [fail, null, 'failed'],
    [() => ({ success: true, mode: 'fallback_minimal' }), async () => full(), 'saved'],
    [() => ({ success: true, mode: 'fallback_minimal' }), null, 'reduced']
  ]) {
    const tracker = createSaveStatus();
    await tracker.save('document', { revision: 1 }, { local, indexed });
    assert.equal(tracker.snapshot().state, expected);
  }

  // A pending retry must retain the warning; a document success cannot hide a library failure.
  const tracker = createSaveStatus();
  await tracker.save('library', {}, { local: fail });
  await tracker.save('document', {}, { local: full });
  assert.deepEqual(tracker.snapshot().failed, ['library']);
  assert(tracker.snapshot().details.includes('biblioteca'));
  let recover;
  const recovery = tracker.save('library', {}, { local: fail, indexed: () => new Promise(r => recover = r) });
  await flush(); assert.equal(tracker.snapshot().state, 'failed');
  recover(full()); await recovery; assert.equal(tracker.snapshot().text, 'Salvo neste navegador');

  // Write A is held, B is requested. B cannot start/commit before A, and A cannot announce B as saved.
  const ordered = createSaveStatus(), disk = new Map();
  let finishA, finishB;
  const aPayload = { value: 'A' };
  const a = ordered.save('document', aPayload, { local: fail, indexed: value => new Promise(resolve => {
    finishA = () => { disk.set('current', value); resolve(full()); };
  }) });
  aPayload.value = 'mutated'; await flush();
  const b = ordered.save('document', { value: 'B' }, { local: fail, indexed: value => new Promise(resolve => {
    finishB = () => { disk.set('current', value); resolve(full()); };
  }) });
  assert.equal(finishB, undefined, 'A delayed write must serialize B');
  finishA(); await a; await flush();
  assert.equal(ordered.snapshot().state, 'pending', 'Old success does not confirm the latest revision');
  assert.equal(disk.get('current').value, 'A', 'Queued payloads are immutable copies');
  finishB(); await b;
  assert.equal(disk.get('current').value, 'B');
  assert.equal(ordered.snapshot().scopes[0].revision, 2);

  // Old rejection cannot hide a new full synchronous save, even while its IDB copy waits.
  const stale = createSaveStatus(); let rejectOld;
  const old = stale.save('document', {}, { local: fail, indexed: () => new Promise((_, reject) => rejectOld = reject) });
  await flush();
  const latest = stale.save('document', {}, { local: full, indexed: async () => full() });
  rejectOld(Error('late rejection')); await old; await latest;
  assert.equal(stale.snapshot().state, 'saved');

  // Real document controller and UI messages with rejected promises and reduced fallback.
  const source = fs.readFileSync(require.resolve('../sketch.js'), 'utf8');
  const ui = { saveStatusText: { textContent: '', dataset: {} } };
  const view = { warning: false, message: '' };
  const controllerTracker = createSaveStatus();
  const storage = { setItem: fail };
  const context = { window: { localStorage: storage, StatePersistence: { ...persistence,
    saveToIndexedDB: async () => { throw Error('real rejection'); } } }, indexedDB: {},
    StudioState: { mosaicData: {}, history: [], editHistory: [] }, documentSaveTimestamp: 0, deferStudioSave: false, saveStatus: controllerTracker,
    buildStudioStatePayload: () => ({ version: 3, timestamp: 1, history: [], editHistory: [], cellsSnapshot: {} }),
    STORAGE_KEY_STUDIO_STATE: persistence.STORAGE_KEY_STUDIO_STATE,
    document: { getElementById: id => ui[id] || null },
    showPersistenceWarning(message) { view.warning = true; view.message = message; },
    hidePersistenceWarning() { view.warning = false; } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function saveStudioStateToStorage()'),
    source.indexOf('\nfunction ', source.indexOf('function renderSaveStatus(') + 10)), context);
  controllerTracker.subscribe(context.renderSaveStatus);
  await context.saveStudioStateToStorage();
  assert.equal(ui.saveStatusText.textContent, 'Não foi possível salvar'); assert(view.warning);
  assert(view.message.includes('mosaico'));
  storage.setItem = () => {};
  await context.saveStudioStateToStorage();
  assert.equal(ui.saveStatusText.textContent, 'Salvo neste navegador'); assert(!view.warning);
  storage.setItem = fail;
  delete context.indexedDB;
  await context.saveStudioStateToStorage(); assert(view.warning);

  // Access-denied getters are failures too, not exceptions that bypass the feedback.
  Object.defineProperty(context, 'indexedDB', { configurable: true, get() { throw Error('IDB access denied'); } });
  Object.defineProperty(context.window, 'localStorage', { configurable: true, get() { throw Error('LS access denied'); } });
  await context.saveStudioStateToStorage();
  assert.equal(ui.saveStatusText.textContent, 'Não foi possível salvar');
  Object.defineProperty(context.window, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(context, 'indexedDB', { value: {}, configurable: true });
  context.buildStudioStatePayload = () => ({ version: 3, timestamp: 1, history: [{seed:1},{seed:2}], editHistory: [], cellsSnapshot: {} });
  storage.setItem = (_key, json) => {
    if (JSON.parse(json).history.length) { const e = Error('quota'); e.name='QuotaExceededError'; throw e; }
  };
  await context.saveStudioStateToStorage();
  assert.equal(ui.saveStatusText.textContent, 'Desenho salvo; histórico reduzido');
  assert(view.message.includes('2 gerações'));
  context.window.StatePersistence.saveToIndexedDB = async () => full();
  await context.saveStudioStateToStorage();
  assert.equal(ui.saveStatusText.textContent, 'Salvo neste navegador');
  assert(!view.warning, 'Reduced cache plus intact IndexedDB must not claim history loss');

  // Delayed boot restoration must not overwrite a document edited since the read began.
  let finishBootRead, appliedBoot = 0;
  context.window.StatePersistence.resolveBootState = () => new Promise(resolve => finishBootRead = resolve);
  context.localStorage = storage;
  context.applySavedStudioState = () => { appliedBoot++; return true; };
  context.restoreMosaicFromSavedState = context.syncZoomUI = context.updateStatusBar = context.redraw = () => {};
  context.saveStatus.markPending('document');
  let bootRevision = context.saveStatus.snapshot().scopes[0].revision;
  const hydration = context.hydrateStudioStorage(false, Promise.resolve(), bootRevision);
  await flush();
  await context.saveStudioStateToStorage();
  finishBootRead({ source: 'indexeddb', payload: { timestamp: 1, history: [{},{}] } });
  await hydration; assert.equal(appliedBoot, 0);
  // Without intervening edits, restore first and only then save the restored document.
  context.saveStatus.markPending('document'); bootRevision=context.saveStatus.snapshot().scopes[0].revision;
  const normalBoot=context.hydrateStudioStorage(false,Promise.resolve(),bootRevision);
  await flush();finishBootRead({source:'indexeddb',payload:{timestamp:1}});
  await normalBoot;assert.equal(appliedBoot,1);
  context.deferStudioSave=true;
  const revisionBeforeDeferred=context.saveStatus.snapshot().scopes[0].revision;
  context.saveStudioStateToStorage();
  assert.equal(context.saveStatus.snapshot().scopes[0].revision,revisionBeforeDeferred);
  context.deferStudioSave=false;

  // Real IndexedDB writer: request success followed by abort is failure; A/B reload recovers B.
  const idb = makeIDB(); idb.hold = true;
  const pending = persistence.saveToIndexedDB('t04', { timestamp: 1, value: 'A' }, idb.factory);
  let settled = false; pending.then(() => settled = true, () => settled = true);
  await flush(); assert.equal(settled, false); assert.equal(idb.data.size, 0);
  idb.abort = true; idb.held.shift()(); await assert.rejects(pending); assert.equal(idb.data.size, 0);
  idb.abort = false;
  const pa = persistence.saveToIndexedDB('t04', { timestamp: 2, value: 'A' }, idb.factory);
  const pb = persistence.saveToIndexedDB('t04', { timestamp: 3, value: 'B' }, idb.factory);
  await flush(); assert.equal(idb.held.length, 1);
  idb.held.shift()(); await pa; await flush(); assert.equal(idb.held.length, 1);
  idb.held.shift()(); await pb;
  assert.equal((await persistence.loadFromIndexedDB('t04', idb.factory)).value, 'B');
  idb.hold = false;
  await persistence.saveToIndexedDB('t04', { timestamp: 1, value: 'late migration' }, idb.factory);
  assert.equal((await persistence.loadFromIndexedDB('t04', idb.factory)).value, 'B');

  // Real library mutations: failures are visible without IDB; recovery and queued IDB mutations retain B.
  global.window = { SaveStatus: createSaveStatus(), localStorage: { getItem: () => null, setItem: fail } };
  const library = require('../core/library_store.js');
  const group = library.createGroup('T04');
  assert.equal(window.SaveStatus.snapshot().state, 'failed');
  window.localStorage.setItem = () => {};
  await library.retrySave(); assert.equal(window.SaveStatus.snapshot().state, 'saved');
  const libraryIDB = makeIDB(); window.indexedDB = libraryIDB.factory;
  window.localStorage.setItem = fail; libraryIDB.abort = true;
  await library.retrySave(); assert.equal(window.SaveStatus.snapshot().state, 'failed');
  libraryIDB.abort = false; window.localStorage.setItem = () => {};
  library.renameGroup(group.id, 'A'); library.renameGroup(group.id, 'B');
  await library.retrySave();
  const fresh = library.createLibraryStoreInstance();
  await fresh.hydrateFromIndexedDB();
  assert.equal(fresh.getGroups().find(g => g.id === group.id).name, 'B');
  console.log('Save status matrix, actual controllers, transaction abort, ordering and recovery PASSED');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

/**
 * core/library_store.js
 * Persistent state manager and CRUD controller for the Tiling Stripes Subtile Library.
 * Dual-persistence: synchronous localStorage boot cache + asynchronous IndexedDB primary store.
 */

(function () {
  const saveStatus = (typeof window !== 'undefined' && window.SaveStatus) || (typeof require === 'function' && require('./save_status.js'));
  // Note: Intentionally named without the studio state prefix enforced by test_storage_key.js
  const STORAGE_KEY_TILE_LIBRARY = 'tiling_stripes_tile_library_v1';
  const IDB_LIBRARY_DB_NAME = 'tiling_stripes_library_db';
  const IDB_LIBRARY_DB_VERSION = 1;
  const IDB_LIBRARY_STORE_NAME = 'tile_library_store';
  const IDB_LIBRARY_RECORD_KEY = 'current_tile_library';

  function getDeps() {
    let lib = (typeof window !== 'undefined' && window.TileLibrary) ||
      (typeof global !== 'undefined' && global.window && global.window.TileLibrary);
    let compiler = (typeof window !== 'undefined' && window.LibraryCompiler) ||
      (typeof global !== 'undefined' && global.window && global.window.LibraryCompiler);

    if (typeof require === 'function') {
      if (!lib) lib = require('./tile_library.js');
      if (!compiler) compiler = require('./library_compiler.js');
    }

    return { lib, compiler };
  }

  function getLocalStorageSafe() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (_e) {
      // Ignore sandboxed / unavailable storage
    }
    return null;
  }

  function getIndexedDBSafe() {
    try {
      if (typeof window !== 'undefined' && window.indexedDB) return window.indexedDB;
      if (typeof indexedDB !== 'undefined') return indexedDB;
    } catch (_e) {
      // Ignore unavailable IDB
    }
    return null;
  }

  function openLibraryDB() {
    return new Promise((resolve, reject) => {
      const idb = getIndexedDBSafe();
      if (!idb) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = idb.open(IDB_LIBRARY_DB_NAME, IDB_LIBRARY_DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_LIBRARY_STORE_NAME)) {
          db.createObjectStore(IDB_LIBRARY_STORE_NAME);
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error || new Error('Failed to open library IndexedDB'));
    });
  }

  function saveToLibraryIDB(payload) {
    const snapshot = JSON.parse(JSON.stringify(payload));
    return saveStatus.enqueue('library:idb', () => openLibraryDB().then(db => new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([IDB_LIBRARY_STORE_NAME], 'readwrite');
        const store = tx.objectStore(IDB_LIBRARY_STORE_NAME);
        const close = () => { try { db.close(); } catch (_) {} };
        tx.oncomplete = () => { close(); resolve({ success: true, mode: 'indexeddb' }); };
        tx.onerror = tx.onabort = () => { close(); reject(tx.error || new Error('Library transaction failed')); };
        const request = store.get(IDB_LIBRARY_RECORD_KEY);
        request.onerror = () => { close(); reject(request.error || new Error('Library read failed')); };
        request.onsuccess = () => {
          if ((request.result?.timestamp || 0) > (snapshot.timestamp || 0)) return;
          const put = store.put(snapshot, IDB_LIBRARY_RECORD_KEY);
          put.onerror = () => { close(); reject(put.error || new Error('Library write failed')); };
        };
      } catch (error) { try { db.close(); } catch (_) {} reject(error); }
    })));
  }

  async function loadFromLibraryIDB() {
    const db = await openLibraryDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([IDB_LIBRARY_STORE_NAME], 'readonly');
      const store = tx.objectStore(IDB_LIBRARY_STORE_NAME);
      const req = store.get(IDB_LIBRARY_RECORD_KEY);
      req.onsuccess = (e) => {
        db.close();
        resolve(e.target.result || null);
      };
      req.onerror = (e) => {
        db.close();
        reject(e.target.error || new Error('Failed to read library IndexedDB'));
      };
    });
  }

  function slugifyId(prefix, rawName, existingIds) {
    const base = String(rawName || 'item')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'item';

    let candidate = `${prefix}-${base}`;
    let counter = 2;
    while (existingIds.has(candidate)) {
      candidate = `${prefix}-${base}-${counter++}`;
    }
    return candidate;
  }

  /**
   * Remaps numeric tileIds across an in-memory studio state snapshot (mosaic cells, allowedTiles,
   * brush, supertile template, stamp clipboard, and undo histories).
   */
  function remapStudioState(state, idRemap, maxValidTileId) {
    const { lib } = getDeps();
    const emptyId = lib.CANONICAL_EMPTY_TILE_ID;
    if (!state || typeof state !== 'object') return false;

    const mapTileId = (tid) => {
      if (typeof tid !== 'number' || !Number.isFinite(tid)) return emptyId;
      const mapped = (idRemap && idRemap[tid] !== undefined) ? idRemap[tid] : tid;
      if (typeof maxValidTileId === 'number' && (mapped < 0 || mapped > maxValidTileId)) {
        return emptyId;
      }
      return mapped;
    };

    const remapCellObj = (cell) => {
      if (!cell || typeof cell !== 'object') return;
      if (typeof cell.tileId === 'number') {
        const nextTile = mapTileId(cell.tileId);
        cell.tileId = nextTile;
        if (nextTile === emptyId) cell.transform = 'id';
      }
      if (typeof cell.baseTileId === 'number') {
        cell.baseTileId = mapTileId(cell.baseTileId);
      }
    };

    const remapGrid2D = (grid) => {
      if (!Array.isArray(grid)) return;
      for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        if (!Array.isArray(row)) continue;
        for (let c = 0; c < row.length; c++) {
          const item = row[c];
          if (!item || typeof item !== 'object') continue;
          if (Array.isArray(item.cells)) {
            remapGrid2D(item.cells);
          } else {
            remapCellObj(item);
          }
        }
      }
    };

    const remapFrozenCollection = (frozen) => {
      if (!frozen) return;
      if (frozen instanceof Map) {
        for (const val of frozen.values()) remapCellObj(val);
      } else if (Array.isArray(frozen)) {
        for (const entry of frozen) {
          if (Array.isArray(entry) && entry[1]) remapCellObj(entry[1]);
          else remapCellObj(entry);
        }
      }
    };

    const remapSnapshotObj = (snap) => {
      if (!snap || typeof snap !== 'object') return;
      if (Array.isArray(snap.gridSnap)) {
        for (const blockRow of snap.gridSnap) {
          if (!Array.isArray(blockRow)) continue;
          for (const blockCells of blockRow) {
            remapGrid2D(blockCells);
          }
        }
      }
      if (Array.isArray(snap.cells)) remapGrid2D(snap.cells);
      if (snap.frozenCells) remapFrozenCollection(snap.frozenCells);
      if (snap.document) remapSnapshotObj(snap.document);
      if (snap.lazyCellsSnapshot) remapSnapshotObj(snap.lazyCellsSnapshot);
      if (snap.cellsSnapshot) remapSnapshotObj(snap.cellsSnapshot);
    };

    if (state.mosaicData) {
      if (Array.isArray(state.mosaicData.grid)) {
        remapGrid2D(state.mosaicData.grid);
      } else if (Array.isArray(state.mosaicData)) {
        remapGrid2D(state.mosaicData);
      }
    }

    if (state.frozenCells) {
      remapFrozenCollection(state.frozenCells);
    }

    if (state.savedCellsSnapshot) {
      remapSnapshotObj(state.savedCellsSnapshot);
    }

    if (typeof state.editBrushTileId === 'number') {
      state.editBrushTileId = mapTileId(state.editBrushTileId);
    }
    if (typeof state.previousBrushTileId === 'number') {
      state.previousBrushTileId = mapTileId(state.previousBrushTileId);
    }

    if (state.allowedTiles instanceof Set) {
      const nextSet = new Set();
      for (const tid of state.allowedTiles) {
        const mapped = mapTileId(tid);
        if (mapped !== emptyId || state.allowedTiles.has(emptyId)) {
          nextSet.add(mapped);
        }
      }
      if (nextSet.size === 0) nextSet.add(0);
      state.allowedTiles = nextSet;
    } else if (Array.isArray(state.allowedTiles)) {
      const hadEmpty = state.allowedTiles.includes(emptyId);
      const nextArr = [];
      const seen = new Set();
      for (const tid of state.allowedTiles) {
        const mapped = mapTileId(tid);
        if ((mapped !== emptyId || hadEmpty) && !seen.has(mapped)) {
          seen.add(mapped);
          nextArr.push(mapped);
        }
      }
      if (nextArr.length === 0) nextArr.push(0);
      state.allowedTiles = nextArr;
    }

    if (state.supertilePattern && Array.isArray(state.supertilePattern.cells)) {
      remapGrid2D(state.supertilePattern.cells);
    }

    if (state.stampBlock && Array.isArray(state.stampBlock.cells)) {
      remapGrid2D(state.stampBlock.cells);
    }

    if (Array.isArray(state.editHistory)) {
      for (const snap of state.editHistory) {
        if (!snap) continue;
        if (Array.isArray(snap)) remapGrid2D(snap);
        else remapSnapshotObj(snap);
      }
    }

    if (Array.isArray(state.history)) {
      for (const entry of state.history) {
        if (!entry) continue;
        remapSnapshotObj(entry);
        if (Array.isArray(entry.allowedTiles)) {
          const seen = new Set();
          entry.allowedTiles = entry.allowedTiles
            .map(mapTileId)
            .filter((id) => {
              if (seen.has(id)) return false;
              seen.add(id);
              return true;
            });
          if (entry.allowedTiles.length === 0) entry.allowedTiles = [0];
        }
      }
    }

    return true;
  }

  function createLibraryStoreInstance() {
    const { lib, compiler } = getDeps();
    const listeners = new Set();

    let currentTimestamp = 0;
    let currentDoc = null;
    let currentCompiled = null;

    function loadInitialFromLocalStorage() {
      const ls = getLocalStorageSafe();
      if (ls) {
        try {
          const raw = ls.getItem(STORAGE_KEY_TILE_LIBRARY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              currentTimestamp = Number(parsed.timestamp) || 0;
              const docSource = parsed.doc || parsed;
              currentCompiled = compiler.compileLibrary(docSource);
              currentDoc = currentCompiled.doc;
              return;
            }
          }
        } catch (_e) {
          // Corrupted local cache -> fall back cleanly to built-in library
        }
      }

      currentCompiled = compiler.compileLibrary(lib.cloneDefaultLibrary());
      currentDoc = currentCompiled.doc;
      currentTimestamp = 0;
    }

    loadInitialFromLocalStorage();

    function persistCurrentDoc(reason = 'mutation') {
      currentTimestamp = Math.max(Date.now(), currentTimestamp + 1);
      const envelope = {
        version: lib.LIBRARY_SCHEMA_VERSION,
        timestamp: currentTimestamp,
        reason,
        doc: currentDoc
      };

      return saveStatus.save('library', envelope, {
        local: snapshot => {
          const ls = getLocalStorageSafe();
          if (!ls) return { success: false };
          ls.setItem(STORAGE_KEY_TILE_LIBRARY, JSON.stringify(snapshot));
          return { success: true, mode: 'full' };
        },
        indexed: getIndexedDBSafe() ? saveToLibraryIDB : null
      });
    }

    function commitDoc(nextRawDoc, reason = 'update', shouldPersist = true) {
      const prevCompiled = currentCompiled;
      const nextCompiled = compiler.compileLibrary(nextRawDoc);
      const { idRemap, hasChanges } = compiler.computeCompilationRemap(prevCompiled, nextCompiled);

      currentDoc = nextCompiled.doc;
      currentCompiled = nextCompiled;

      if (shouldPersist) {
        persistCurrentDoc(reason);
      }

      const event = {
        reason,
        doc: currentDoc,
        compiled: currentCompiled,
        idRemap,
        hasRemapChanges: hasChanges,
        maxValidTileId: currentCompiled.totalTiles - 1
      };

      for (const fn of listeners) {
        try {
          fn(event);
        } catch (err) {
          console.error('[LibraryStore] Listener error:', err);
        }
      }

      return event;
    }

    async function hydrateFromIndexedDB() {
      const startedTimestamp = currentTimestamp;
      if (!getIndexedDBSafe()) return { hydrated: false, source: 'memory' };
      try {
        const idbEnvelope = await loadFromLibraryIDB();
        if (currentTimestamp !== startedTimestamp) return { hydrated: false, source: 'memory' };
        if (!idbEnvelope || typeof idbEnvelope !== 'object') {
          if (currentTimestamp > 0) {
            await persistCurrentDoc('migrate-ls-to-idb');
          }
          return { hydrated: false, source: 'localStorage' };
        }

        const idbTs = Number(idbEnvelope.timestamp) || 0;
        const idbDoc = idbEnvelope.doc || idbEnvelope;
        const idbCustomCount = Array.isArray(idbDoc.families)
          ? idbDoc.families.filter((f) => f && !f.builtIn).length
          : 0;
        const curCustomCount = currentDoc.families.filter((f) => !f.builtIn).length;

        if (idbTs > currentTimestamp || (idbTs === currentTimestamp && idbCustomCount > curCustomCount)) {
          currentTimestamp = idbTs;
          const evt = commitDoc(idbDoc, 'hydrate-idb', false);
          const ls = getLocalStorageSafe();
          if (ls) {
            try {
              ls.setItem(STORAGE_KEY_TILE_LIBRARY, JSON.stringify({
                version: lib.LIBRARY_SCHEMA_VERSION,
                timestamp: currentTimestamp,
                reason: 'hydrate-idb',
                doc: currentDoc
              }));
            } catch (_e) {
              // Ignore LS quota if IDB library exceeds 5MB
            }
          }
          return { hydrated: true, source: 'indexedDB', event: evt };
        }

        return { hydrated: false, source: 'localStorage' };
      } catch (_err) {
        return { hydrated: false, source: 'localStorage' };
      }
    }

    function ensureCustomFallbackGroup(docCopy, preferredGroupId) {
      if (preferredGroupId) {
        const found = docCopy.groups.find((g) => g.id === preferredGroupId && g.id !== 'grp-void');
        if (found) return found.id;
      }
      let customGrp = docCopy.groups.find((g) => !g.builtIn);
      if (!customGrp) {
        customGrp = { id: 'grp-custom', name: 'Meus Subtiles', builtIn: false };
        const voidIdx = docCopy.groups.findIndex((g) => g.id === 'grp-void');
        if (voidIdx >= 0) docCopy.groups.splice(voidIdx, 0, customGrp);
        else docCopy.groups.push(customGrp);
      }
      return customGrp.id;
    }

    // --- Public Readers ---
    function getCompiled() {
      return currentCompiled;
    }

    function getDocument() {
      return JSON.parse(JSON.stringify(currentDoc));
    }

    function getGroups() {
      return JSON.parse(JSON.stringify(currentDoc.groups));
    }

    function getFamilies(options = {}) {
      let list = currentDoc.families.map((f) => JSON.parse(JSON.stringify(f)));
      if (options.groupId) {
        list = list.filter((f) => f.groupId === options.groupId);
      }
      if (options.customOnly) {
        list = list.filter((f) => !f.builtIn);
      }
      if (options.sortByUiOrder !== false) {
        list.sort((a, b) => (Number(a.uiOrder) || 0) - (Number(b.uiOrder) || 0));
      }
      return list;
    }

    function getFamilyById(familyId) {
      const found = currentDoc.families.find((f) => f.id === familyId);
      return found ? JSON.parse(JSON.stringify(found)) : null;
    }

    // --- Group CRUD ---
    function createGroup(name) {
      const trimmed = String(name || '').trim() || 'Novo Grupo';
      const docCopy = getDocument();
      const existingIds = new Set(docCopy.groups.map((g) => g.id));
      const newGroup = {
        id: slugifyId('grp', trimmed, existingIds),
        name: trimmed,
        builtIn: false
      };
      const voidIdx = docCopy.groups.findIndex((g) => g.id === 'grp-void');
      if (voidIdx >= 0) docCopy.groups.splice(voidIdx, 0, newGroup);
      else docCopy.groups.push(newGroup);

      commitDoc(docCopy, 'create-group');
      return JSON.parse(JSON.stringify(newGroup));
    }

    function renameGroup(groupId, newName) {
      const trimmed = String(newName || '').trim();
      if (!trimmed) throw new Error('Group name cannot be empty.');
      const docCopy = getDocument();
      const grp = docCopy.groups.find((g) => g.id === groupId);
      if (!grp) throw new Error(`Group not found: ${groupId}`);
      grp.name = trimmed;
      commitDoc(docCopy, 'rename-group');
      return JSON.parse(JSON.stringify(grp));
    }

    function deleteGroup(groupId) {
      const docCopy = getDocument();
      const grpIdx = docCopy.groups.findIndex((g) => g.id === groupId);
      if (grpIdx === -1) throw new Error(`Group not found: ${groupId}`);
      if (docCopy.groups[grpIdx].builtIn) {
        throw new Error(`Cannot delete built-in group: ${groupId}`);
      }

      docCopy.groups.splice(grpIdx, 1);

      // Reassign any families that lived inside the deleted group
      const affected = docCopy.families.filter((f) => f.groupId === groupId);
      if (affected.length > 0) {
        let fallbackCustomId = null;
        for (const fam of affected) {
          if (fam.builtIn) {
            const orig = lib.getBuiltInFamilyById(fam.id);
            fam.groupId = orig ? orig.groupId : 'grp-ribbons';
          } else {
            if (!fallbackCustomId) {
              fallbackCustomId = ensureCustomFallbackGroup(docCopy, null);
            }
            fam.groupId = fallbackCustomId;
          }
        }
      }

      return commitDoc(docCopy, 'delete-group');
    }

    function reorderGroups(orderedGroupIds) {
      if (!Array.isArray(orderedGroupIds)) return null;
      const docCopy = getDocument();
      const byId = new Map(docCopy.groups.map((g) => [g.id, g]));
      const nextGroups = [];
      const seen = new Set();

      for (const gid of orderedGroupIds) {
        if (byId.has(gid) && !seen.has(gid)) {
          seen.add(gid);
          nextGroups.push(byId.get(gid));
        }
      }
      for (const grp of docCopy.groups) {
        if (!seen.has(grp.id)) nextGroups.push(grp);
      }

      docCopy.groups = nextGroups;
      return commitDoc(docCopy, 'reorder-groups');
    }

    // --- Family CRUD ---
    function createFamily(spec = {}) {
      const docCopy = getDocument();
      const name = String(spec.name || '').trim() || 'Novo Subtile';
      const existingIds = new Set(docCopy.families.map((f) => f.id));
      const newId = (typeof spec.id === 'string' && spec.id.trim() && !existingIds.has(spec.id.trim()))
        ? spec.id.trim()
        : slugifyId('custom', name, existingIds);

      const groupId = ensureCustomFallbackGroup(docCopy, spec.groupId);
      const maxOrder = docCopy.families.reduce((m, f) => Math.max(m, Number(f.uiOrder) || 0), 0);
      const defaultShapes = Array.isArray(spec.shapes)
        ? spec.shapes
        : [
            { id: 's1', type: 'rect', name: 'Faixa Inicial', x: -0.5, y: -1 / 6, w: 1, h: 1 / 3, fill: true, stroke: false }
          ];

      const newFam = {
        id: newId,
        name,
        groupId,
        builtIn: false,
        protected: false,
        clipToTile: Boolean(spec.clipToTile),
        uiOrder: typeof spec.uiOrder === 'number' ? spec.uiOrder : maxOrder + 1,
        shapes: JSON.parse(JSON.stringify(defaultShapes))
      };

      docCopy.families.push(newFam);
      const evt = commitDoc(docCopy, 'create-family');
      return {
        family: getFamilyById(newId),
        meta: evt.compiled.familyMetaById.get(newId),
        event: evt
      };
    }

    function duplicateFamily(sourceFamilyId, overrides = {}) {
      const src = getFamilyById(sourceFamilyId);
      if (!src) throw new Error(`Family not found: ${sourceFamilyId}`);

      const docCopy = getDocument();
      const existingIds = new Set(docCopy.families.map((f) => f.id));
      const copyName = (typeof overrides.name === 'string' && overrides.name.trim())
        ? overrides.name.trim()
        : `${src.name} (Cópia)`;
      const newId = slugifyId('custom', copyName, existingIds);

      const targetGroupId = overrides.groupId
        ? ensureCustomFallbackGroup(docCopy, overrides.groupId)
        : (src.groupId === 'grp-void' ? ensureCustomFallbackGroup(docCopy, null) : src.groupId);

      const maxOrder = docCopy.families.reduce((m, f) => Math.max(m, Number(f.uiOrder) || 0), 0);

      const dupFam = {
        id: newId,
        name: copyName,
        groupId: targetGroupId,
        builtIn: false,
        protected: false,
        clipToTile: overrides.clipToTile !== undefined ? Boolean(overrides.clipToTile) : Boolean(src.clipToTile),
        uiOrder: typeof overrides.uiOrder === 'number' ? overrides.uiOrder : maxOrder + 1,
        shapes: JSON.parse(JSON.stringify(overrides.shapes || src.shapes || []))
      };

      docCopy.families.push(dupFam);
      const evt = commitDoc(docCopy, 'duplicate-family');
      return {
        family: getFamilyById(newId),
        meta: evt.compiled.familyMetaById.get(newId),
        event: evt
      };
    }

    function updateFamily(familyId, patch = {}) {
      if (!patch || typeof patch !== 'object') throw new Error('Invalid family patch.');
      const docCopy = getDocument();
      const fam = docCopy.families.find((f) => f.id === familyId);
      if (!fam) throw new Error(`Family not found: ${familyId}`);

      if (fam.protected || fam.isCanonicalEmpty) {
        throw new Error(`Family "${familyId}" is protected and cannot be modified.`);
      }

      if (fam.builtIn) {
        if (patch.shapes !== undefined || patch.clipToTile !== undefined || patch.name !== undefined) {
          throw new Error(
            `Built-in family "${familyId}" is read-only to preserve canonical 0..84 slots; call duplicateFamily("${familyId}") to edit.`
          );
        }
        if (typeof patch.groupId === 'string' && docCopy.groups.some((g) => g.id === patch.groupId)) {
          fam.groupId = patch.groupId;
        }
        if (typeof patch.uiOrder === 'number' && Number.isFinite(patch.uiOrder)) {
          fam.uiOrder = patch.uiOrder;
        }
      } else {
        if (typeof patch.name === 'string' && patch.name.trim()) {
          fam.name = patch.name.trim();
        }
        if (typeof patch.groupId === 'string' && docCopy.groups.some((g) => g.id === patch.groupId)) {
          fam.groupId = patch.groupId;
        }
        if (patch.clipToTile !== undefined) {
          fam.clipToTile = Boolean(patch.clipToTile);
        }
        if (typeof patch.uiOrder === 'number' && Number.isFinite(patch.uiOrder)) {
          fam.uiOrder = patch.uiOrder;
        }
        if (Array.isArray(patch.shapes)) {
          fam.shapes = JSON.parse(JSON.stringify(patch.shapes));
        }
      }

      const evt = commitDoc(docCopy, 'update-family');
      return {
        family: getFamilyById(familyId),
        meta: evt.compiled.familyMetaById.get(familyId),
        event: evt
      };
    }

    function deleteFamily(familyId) {
      const docCopy = getDocument();
      const idx = docCopy.families.findIndex((f) => f.id === familyId);
      if (idx === -1) throw new Error(`Family not found: ${familyId}`);

      const target = docCopy.families[idx];
      if (target.builtIn || target.protected || target.isCanonicalEmpty) {
        throw new Error(`Cannot delete built-in or protected family: ${familyId}`);
      }

      docCopy.families.splice(idx, 1);
      return commitDoc(docCopy, 'delete-family');
    }

    function reorderFamiliesInGroup(groupId, orderedFamilyIds) {
      if (!Array.isArray(orderedFamilyIds)) return null;
      const docCopy = getDocument();
      if (!docCopy.groups.some((g) => g.id === groupId)) {
        throw new Error(`Group not found: ${groupId}`);
      }

      const byId = new Map(docCopy.families.map((f) => [f.id, f]));
      let orderCursor = 0;

      for (const fid of orderedFamilyIds) {
        const fam = byId.get(fid);
        if (!fam || fam.protected) continue;
        fam.groupId = groupId;
        fam.uiOrder = orderCursor++;
      }

      // Preserve deterministic order for any remaining families in that group not listed explicitly
      const listed = new Set(orderedFamilyIds);
      const rest = docCopy.families
        .filter((f) => f.groupId === groupId && !listed.has(f.id))
        .sort((a, b) => (Number(a.uiOrder) || 0) - (Number(b.uiOrder) || 0));
      for (const fam of rest) {
        fam.uiOrder = orderCursor++;
      }

      return commitDoc(docCopy, 'reorder-families');
    }

    // --- Backup, Import & Reset ---
    function exportLibraryJSON(options = {}) {
      const docCopy = getDocument();
      if (options.customOnly) {
        const customFams = docCopy.families.filter((f) => !f.builtIn);
        const usedGroupIds = new Set(customFams.map((f) => f.groupId));
        const relevantGroups = docCopy.groups.filter((g) => !g.builtIn || usedGroupIds.has(g.id));
        return JSON.stringify({
          version: lib.LIBRARY_SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          groups: relevantGroups,
          families: customFams
        }, null, 2);
      }

      return JSON.stringify({
        version: lib.LIBRARY_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        groups: docCopy.groups,
        families: docCopy.families
      }, null, 2);
    }

    function importLibraryJSON(jsonInput, options = {}) {
      const mode = options.mode === 'replace' ? 'replace' : 'merge';
      const conflictPolicy = options.conflictPolicy === 'duplicate' ? 'duplicate' : 'overwrite';

      let parsed;
      if (typeof jsonInput === 'string') {
        try {
          parsed = JSON.parse(jsonInput);
        } catch (err) {
          throw new Error(`Invalid JSON syntax: ${err.message}`);
        }
      } else if (jsonInput && typeof jsonInput === 'object') {
        parsed = JSON.parse(JSON.stringify(jsonInput));
      } else {
        throw new Error('Expected JSON string or object for library import.');
      }

      const incomingRoot = parsed.doc && typeof parsed.doc === 'object' ? parsed.doc : parsed;
      if (!Array.isArray(incomingRoot.families)) {
        throw new Error('Invalid library JSON: missing "families" array.');
      }

      if (mode === 'replace') {
        return commitDoc(incomingRoot, 'import-replace');
      }

      // Merge mode: preserve existing groups & families, merge incoming custom groups & custom families
      const docCopy = getDocument();
      const incomingSanitized = compiler.sanitizeLibraryDoc(incomingRoot);
      const existingGroupById = new Map(docCopy.groups.map((g) => [g.id, g]));

      for (const incGrp of incomingSanitized.groups) {
        if (!existingGroupById.has(incGrp.id)) {
          const voidIdx = docCopy.groups.findIndex((g) => g.id === 'grp-void');
          if (voidIdx >= 0) docCopy.groups.splice(voidIdx, 0, incGrp);
          else docCopy.groups.push(incGrp);
          existingGroupById.set(incGrp.id, incGrp);
        }
      }

      const existingIds = new Set(docCopy.families.map((f) => f.id));
      let maxOrder = docCopy.families.reduce((m, f) => Math.max(m, Number(f.uiOrder) || 0), 0);

      for (const incFam of incomingSanitized.families) {
        if (incFam.builtIn) continue;
        if (existingIds.has(incFam.id)) {
          if (conflictPolicy === 'overwrite') {
            const idx = docCopy.families.findIndex((f) => f.id === incFam.id);
            if (idx >= 0 && !docCopy.families[idx].builtIn) {
              docCopy.families[idx] = {
                ...incFam,
                uiOrder: docCopy.families[idx].uiOrder
              };
            }
          } else {
            const dupId = slugifyId('custom', incFam.name, existingIds);
            existingIds.add(dupId);
            docCopy.families.push({
              ...incFam,
              id: dupId,
              name: `${incFam.name} (Importado)`,
              uiOrder: ++maxOrder
            });
          }
        } else {
          existingIds.add(incFam.id);
          docCopy.families.push({
            ...incFam,
            uiOrder: ++maxOrder
          });
        }
      }

      return commitDoc(docCopy, 'import-merge');
    }

    function resetToDefaults() {
      return commitDoc(lib.cloneDefaultLibrary(), 'reset-defaults');
    }

    function onChange(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }

    return {
      STORAGE_KEY_TILE_LIBRARY,
      IDB_LIBRARY_DB_NAME,
      IDB_LIBRARY_STORE_NAME,
      getCompiled,
      getDocument,
      getGroups,
      getFamilies,
      getFamilyById,
      createGroup,
      renameGroup,
      deleteGroup,
      reorderGroups,
      createFamily,
      duplicateFamily,
      updateFamily,
      deleteFamily,
      reorderFamiliesInGroup,
      exportLibraryJSON,
      importLibraryJSON,
      resetToDefaults,
      hydrateFromIndexedDB,
      retrySave: () => persistCurrentDoc('retry'),
      remapStudioState,
      onChange
    };
  }

  const LibraryStore = createLibraryStoreInstance();
  LibraryStore.createLibraryStoreInstance = createLibraryStoreInstance;

  if (typeof window !== 'undefined') {
    window.LibraryStore = LibraryStore;
  }
  if (typeof global !== 'undefined' && global.window) {
    global.window.LibraryStore = LibraryStore;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LibraryStore;
  }
})();

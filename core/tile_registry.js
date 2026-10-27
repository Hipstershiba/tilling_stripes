/**
 * core/tile_registry.js
 * Central facade for vector tile renderers, named D4-closed families, and Cayley orientation maps.
 * Backed by the normalized JSON vector compiler (LibraryCompiler + LibraryStore), while mutating
 * exported arrays/maps in-place so existing references in MosaicEngine and Studio UI stay live.
 */

(function () {
  function resolveDependencies() {
    const win = (typeof window !== 'undefined' && window) ||
      (typeof global !== 'undefined' && global.window) ||
      null;

    let d4 = win && win.D4Symmetry;
    let vr = win && win.VectorRenderer;
    let det = win && win.D4Detect;
    let lib = win && win.TileLibrary;
    let compiler = win && win.LibraryCompiler;
    let store = win && win.LibraryStore;

    if (typeof require === 'function') {
      if (!d4) {
        require('./d4_symmetry.js');
        d4 = win && win.D4Symmetry;
      }
      if (!vr) {
        vr = require('./vector_renderer.js');
        if (win) win.VectorRenderer = vr;
      }
      if (!det) {
        det = require('./d4_detect.js');
        if (win) win.D4Detect = det;
      }
      if (!lib) {
        lib = require('./tile_library.js');
        if (win) win.TileLibrary = lib;
      }
      if (!compiler) {
        compiler = require('./library_compiler.js');
        if (win) win.LibraryCompiler = compiler;
      }
      if (!store) {
        store = require('./library_store.js');
        if (win) win.LibraryStore = store;
      }
    }

    return { win, d4, vr, det, lib, compiler, store };
  }

  const deps = resolveDependencies();

  const TILE_RENDERERS = [];
  const TILE_NAMES = [];
  const TILE_FAMILIES_META = [];
  const TILE_D4_MAP = {};
  const registryListeners = new Set();

  let familyByTileId = [];
  let familyByIdMap = new Map();

  const TileRegistry = {
    TILE_RENDERERS,
    TILE_NAMES,
    TILE_FAMILIES_META,
    TILE_D4_MAP,
    CANONICAL_EMPTY_TILE_ID: deps.lib ? deps.lib.CANONICAL_EMPTY_TILE_ID : 84,
    BUILTIN_TILE_COUNT: deps.lib ? deps.lib.BUILTIN_TILE_COUNT : 85,
    libraryRevision: 0,
    getTransformedTileId,
    getFamilyForTile,
    getFamilyById,
    getNextTileInFamily,
    rebuildRegistry,
    onRegistryChange
  };

  /**
   * Synchronizes the live exported arrays and D4 action map in-place from a compiled library snapshot.
   */
  function syncCatalogInPlace(compiled) {
    TILE_RENDERERS.length = 0;
    for (let i = 0; i < compiled.TILE_RENDERERS.length; i++) {
      TILE_RENDERERS.push(compiled.TILE_RENDERERS[i]);
    }

    TILE_NAMES.length = 0;
    for (let i = 0; i < compiled.TILE_NAMES.length; i++) {
      TILE_NAMES.push(compiled.TILE_NAMES[i]);
    }

    TILE_FAMILIES_META.length = 0;
    familyByTileId = new Array(compiled.TILE_RENDERERS.length);
    familyByIdMap = new Map();

    for (let f = 0; f < compiled.TILE_FAMILIES_META.length; f++) {
      const fam = compiled.TILE_FAMILIES_META[f];
      TILE_FAMILIES_META.push(fam);
      familyByIdMap.set(fam.id, fam);
      for (let k = 0; k < fam.tileIds.length; k++) {
        familyByTileId[fam.tileIds[k]] = fam;
      }
    }

    for (const existingKey of Object.keys(TILE_D4_MAP)) {
      delete TILE_D4_MAP[existingKey];
    }
    for (const [tid, row] of Object.entries(compiled.TILE_D4_MAP)) {
      TILE_D4_MAP[tid] = row;
    }

    TileRegistry.libraryRevision += 1;
  }

  /**
   * Rebuilds the registry from an explicit library document or from the active LibraryStore snapshot.
   */
  function rebuildRegistry(optionalLibraryDoc) {
    const { compiler, store } = resolveDependencies();
    const compiled = optionalLibraryDoc
      ? compiler.compileLibrary(optionalLibraryDoc)
      : store.getCompiled();

    syncCatalogInPlace(compiled);

    for (const cb of registryListeners) {
      try {
        cb({ compiled, libraryRevision: TileRegistry.libraryRevision });
      } catch (err) {
        console.error('[TileRegistry] Listener error:', err);
      }
    }

    return compiled;
  }

  function onRegistryChange(listener) {
    if (typeof listener !== 'function') return () => {};
    registryListeners.add(listener);
    return () => {
      registryListeners.delete(listener);
    };
  }

  /**
   * Returns the transformed tileId for a given tileId and D4 transform key.
   */
  function getTransformedTileId(tileId, transformKey) {
    const entry = TILE_D4_MAP[tileId];
    if (!entry) return tileId;
    return entry[transformKey] !== undefined ? entry[transformKey] : tileId;
  }

  /**
   * Finds the family metadata object containing a given tileId in O(1) time.
   */
  function getFamilyForTile(tileId) {
    if (tileId >= 0 && tileId < familyByTileId.length && familyByTileId[tileId]) {
      return familyByTileId[tileId];
    }
    return TILE_FAMILIES_META.find((f) => f.tileIds.includes(tileId)) || null;
  }

  /**
   * Finds the family metadata object by string family ID.
   */
  function getFamilyById(familyId) {
    return familyByIdMap.get(familyId) || TILE_FAMILIES_META.find((f) => f.id === familyId) || null;
  }

  /**
   * Returns the next (or previous) tileId within the same family.
   */
  function getNextTileInFamily(tileId, step = 1) {
    const fam = getFamilyForTile(tileId);
    if (!fam || fam.tileIds.length <= 1) return tileId;
    const idx = fam.tileIds.indexOf(tileId);
    if (idx === -1) return tileId;
    const len = fam.tileIds.length;
    return fam.tileIds[(idx + step + len * 10) % len];
  }

  // Initial synchronous compilation at boot
  if (deps.store) {
    syncCatalogInPlace(deps.store.getCompiled());
    deps.store.onChange((evt) => {
      syncCatalogInPlace(evt.compiled);
      for (const cb of registryListeners) {
        try {
          cb({ compiled: evt.compiled, libraryRevision: TileRegistry.libraryRevision, storeEvent: evt });
        } catch (err) {
          console.error('[TileRegistry] Listener error:', err);
        }
      }
    });
  } else if (deps.compiler) {
    syncCatalogInPlace(deps.compiler.compileLibrary());
  }

  if (typeof window !== 'undefined') {
    window.TileRegistry = TileRegistry;
  }
  if (typeof global !== 'undefined' && global.window) {
    global.window.TileRegistry = TileRegistry;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TileRegistry;
  }
})();

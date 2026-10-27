/**
 * core/library_compiler.js
 * Compiles a normalized JSON tile library document into dense runtime catalogs:
 * TILE_RENDERERS, TILE_NAMES, TILE_FAMILIES_META, TILE_D4_MAP, and variant remap tables.
 */

(function () {
  function getDeps() {
    let d4 = (typeof window !== 'undefined' && window.D4Symmetry) ||
      (typeof global !== 'undefined' && global.window && global.window.D4Symmetry);
    let vr = (typeof window !== 'undefined' && window.VectorRenderer) ||
      (typeof global !== 'undefined' && global.window && global.window.VectorRenderer);
    let det = (typeof window !== 'undefined' && window.D4Detect) ||
      (typeof global !== 'undefined' && global.window && global.window.D4Detect);
    let lib = (typeof window !== 'undefined' && window.TileLibrary) ||
      (typeof global !== 'undefined' && global.window && global.window.TileLibrary);

    if (typeof require === 'function') {
      if (!d4) {
        require('./d4_symmetry.js');
        d4 = (typeof window !== 'undefined' && window.D4Symmetry) ||
          (typeof global !== 'undefined' && global.window && global.window.D4Symmetry);
      }
      if (!vr) vr = require('./vector_renderer.js');
      if (!det) det = require('./d4_detect.js');
      if (!lib) lib = require('./tile_library.js');
    }

    return { d4, vr, det, lib };
  }

  const VALID_SHAPE_TYPES = new Set(['rect', 'ellipse', 'line', 'triangle', 'polygon', 'arc', 'path']);

  function sanitizeShape(rawShape, index) {
    if (!rawShape || typeof rawShape !== 'object') return null;
    const type = String(rawShape.type || '');
    if (!VALID_SHAPE_TYPES.has(type)) return null;

    const cloned = JSON.parse(JSON.stringify(rawShape));
    cloned.id = typeof cloned.id === 'string' && cloned.id.trim()
      ? cloned.id.trim()
      : `s${index + 1}`;
    cloned.name = typeof cloned.name === 'string' && cloned.name.trim()
      ? cloned.name.trim()
      : `${type} ${index + 1}`;
    cloned.visible = cloned.visible !== false;
    cloned.locked = Boolean(cloned.locked);
    cloned.fill = cloned.fill !== false;
    cloned.stroke = Boolean(cloned.stroke);
    if (typeof cloned.strokeWeight !== 'number' || !Number.isFinite(cloned.strokeWeight) || cloned.strokeWeight <= 0) {
      cloned.strokeWeight = 0.1;
    }
    return cloned;
  }

  /**
   * Validates and normalizes a raw library JSON document, guaranteeing:
   * - All 6 canonical built-in groups exist
   * - All 31 canonical built-in families exist in exact slot order 0..30 (#84 = empty-tile)
   * - Custom groups and custom families are sanitized and preserved cleanly
   */
  function sanitizeLibraryDoc(rawDoc) {
    const { lib } = getDeps();
    const defaults = lib.cloneDefaultLibrary();

    if (!rawDoc || typeof rawDoc !== 'object') {
      return defaults;
    }

    // 1. Groups: preserve user ordering/renames where valid, ensure all built-in group IDs exist
    const builtInGroupById = new Map(defaults.groups.map((g) => [g.id, g]));
    const seenGroupIds = new Set();
    const sanitizedGroups = [];

    if (Array.isArray(rawDoc.groups)) {
      for (const g of rawDoc.groups) {
        if (!g || typeof g.id !== 'string') continue;
        const gid = g.id.trim();
        if (!gid || seenGroupIds.has(gid)) continue;
        seenGroupIds.add(gid);

        if (builtInGroupById.has(gid)) {
          const defG = builtInGroupById.get(gid);
          sanitizedGroups.push({
            id: gid,
            name: (typeof g.name === 'string' && g.name.trim()) ? g.name.trim() : defG.name,
            builtIn: true
          });
        } else {
          sanitizedGroups.push({
            id: gid,
            name: (typeof g.name === 'string' && g.name.trim()) ? g.name.trim() : 'Grupo Customizado',
            builtIn: false
          });
        }
      }
    }

    // Append any missing built-in groups in canonical order
    for (const defG of defaults.groups) {
      if (!seenGroupIds.has(defG.id)) {
        seenGroupIds.add(defG.id);
        sanitizedGroups.push({ id: defG.id, name: defG.name, builtIn: true });
      }
    }

    // 2. Map incoming family metadata for optional UI ordering/grouping on built-ins + custom families
    const rawFamilies = Array.isArray(rawDoc.families) ? rawDoc.families : [];
    const builtInIds = new Set(defaults.families.map((f) => f.id));
    const incomingBuiltInMeta = new Map();
    const customFamilies = [];
    const seenCustomIds = new Set();

    rawFamilies.forEach((rf, rawIdx) => {
      if (!rf || typeof rf !== 'object' || typeof rf.id !== 'string') return;
      const fid = rf.id.trim();
      if (!fid) return;

      if (builtInIds.has(fid)) {
        incomingBuiltInMeta.set(fid, {
          groupId: typeof rf.groupId === 'string' ? rf.groupId.trim() : null,
          uiOrder: typeof rf.uiOrder === 'number' && Number.isFinite(rf.uiOrder) ? rf.uiOrder : rawIdx
        });
        return;
      }

      if (seenCustomIds.has(fid)) return;
      seenCustomIds.add(fid);

      const shapes = Array.isArray(rf.shapes)
        ? rf.shapes.map((s, si) => sanitizeShape(s, si)).filter(Boolean)
        : [];

      customFamilies.push({
        id: fid,
        name: (typeof rf.name === 'string' && rf.name.trim()) ? rf.name.trim() : 'Subtile Customizado',
        groupId: (typeof rf.groupId === 'string' && rf.groupId.trim()) ? rf.groupId.trim() : 'grp-custom',
        builtIn: false,
        protected: false,
        clipToTile: Boolean(rf.clipToTile),
        uiOrder: typeof rf.uiOrder === 'number' && Number.isFinite(rf.uiOrder) ? rf.uiOrder : (1000 + customFamilies.length),
        shapes
      });
    });

    // If any custom family references a non-existent group, ensure that fallback group exists
    for (const cf of customFamilies) {
      if (!seenGroupIds.has(cf.groupId)) {
        if (!seenGroupIds.has('grp-custom')) {
          seenGroupIds.add('grp-custom');
          // Insert custom group right before grp-void for clean visual hierarchy
          const voidIdx = sanitizedGroups.findIndex((g) => g.id === 'grp-void');
          const customGrp = { id: 'grp-custom', name: 'Meus Subtiles', builtIn: false };
          if (voidIdx >= 0) sanitizedGroups.splice(voidIdx, 0, customGrp);
          else sanitizedGroups.push(customGrp);
        }
        cf.groupId = 'grp-custom';
      }
    }

    const groupNameById = new Map(sanitizedGroups.map((g) => [g.id, g.name]));

    // 3. Built-in families always keep canonical slot order 0..30 and canonical shapes
    const sanitizedBuiltIns = defaults.families.map((defFam, idx) => {
      const inc = incomingBuiltInMeta.get(defFam.id);
      const validGroupId = (!defFam.protected && inc && inc.groupId && seenGroupIds.has(inc.groupId))
        ? inc.groupId
        : defFam.groupId;
      const uiOrder = (inc && typeof inc.uiOrder === 'number') ? inc.uiOrder : idx;

      return {
        ...defFam,
        groupId: validGroupId,
        group: groupNameById.get(validGroupId) || defFam.group,
        uiOrder
      };
    });

    for (const cf of customFamilies) {
      cf.group = groupNameById.get(cf.groupId) || 'Meus Subtiles';
    }

    return {
      version: lib.LIBRARY_SCHEMA_VERSION,
      groups: sanitizedGroups,
      families: [...sanitizedBuiltIns, ...customFamilies]
    };
  }

  /**
   * Compiles a library document into runtime arrays/maps compatible with window.TileRegistry.
   */
  function compileLibrary(rawDoc) {
    const { d4, vr, det, lib } = getDeps();
    const doc = sanitizeLibraryDoc(rawDoc);
    const groupById = new Map(doc.groups.map((g) => [g.id, g]));

    const TILE_RENDERERS = [];
    const TILE_NAMES = [];
    const TILE_FAMILIES_META = [];
    const TILE_D4_MAP = {};

    const variantKeyToId = new Map();
    const idMeta = [];
    const familyMetaById = new Map();

    for (let fIdx = 0; fIdx < doc.families.length; fIdx++) {
      const fam = doc.families[fIdx];
      const grp = groupById.get(fam.groupId);
      const groupName = grp ? grp.name : (fam.group || 'Meus Subtiles');

      let orbitInfo;
      let renderReps;
      let localD4Map;

      if (fam.builtIn && fam.legacyOrbitOverride) {
        const ov = fam.legacyOrbitOverride;
        const detected = det.detectMasterD4(fam);
        renderReps = ov.reps.slice();
        const actionReps = Array.isArray(ov.actionReps) ? ov.actionReps : renderReps;
        localD4Map = det.buildCosetActionTable(ov.stabilizer, actionReps, d4);
        orbitInfo = {
          orbitType: ov.orbitType,
          label: ov.label || detected.label,
          orbitSize: renderReps.length,
          stabilizer: ov.stabilizer.slice(),
          variantTransforms: renderReps,
          variantSuffixes: [],
          isFullySymmetric: renderReps.length === 1,
          isAxisInvariant: ov.stabilizer.includes('mx') || ov.stabilizer.includes('my'),
          isDiagInvariant: ov.stabilizer.includes('md') || ov.stabilizer.includes('mad'),
          geometricOrbitType: detected.orbitType
        };
      } else {
        const detected = det.detectMasterD4(fam);
        renderReps = detected.variantTransforms;
        localD4Map = detected.localD4Map;
        orbitInfo = detected;
      }

      const famTileIds = [];
      for (let vIdx = 0; vIdx < renderReps.length; vIdx++) {
        const repTransform = renderReps[vIdx];
        const globalId = TILE_RENDERERS.length;

        const renderer = fam.isCanonicalEmpty
          ? function emptyCanonicalTile() {}
          : vr.createVariantRenderer(fam, repTransform);

        let variantName;
        if (Array.isArray(fam.variantNames) && typeof fam.variantNames[vIdx] === 'string' && fam.variantNames[vIdx].trim()) {
          variantName = fam.variantNames[vIdx].trim();
        } else {
          const suffix = (orbitInfo.variantSuffixes && orbitInfo.variantSuffixes[vIdx]) || '';
          variantName = suffix ? `${fam.name} ${suffix}` : fam.name;
        }

        TILE_RENDERERS.push(renderer);
        TILE_NAMES.push(variantName);
        famTileIds.push(globalId);

        variantKeyToId.set(`${fam.id}:${repTransform}`, globalId);
        idMeta.push({
          tileId: globalId,
          familyId: fam.id,
          transform: repTransform,
          variantIndex: vIdx,
          builtIn: Boolean(fam.builtIn)
        });
      }

      // Populate global D4 action table for this family's variants
      for (let vIdx = 0; vIdx < famTileIds.length; vIdx++) {
        const globalId = famTileIds[vIdx];
        const localRow = localD4Map[vIdx];
        const globalRow = {};
        for (const g of d4.D4_TRANSFORMS) {
          globalRow[g] = famTileIds[localRow[g]];
        }
        TILE_D4_MAP[globalId] = globalRow;
      }

      const metaEntry = {
        id: fam.id,
        name: fam.name,
        group: groupName,
        groupId: fam.groupId,
        builtIn: Boolean(fam.builtIn),
        protected: Boolean(fam.protected),
        isCanonicalEmpty: Boolean(fam.isCanonicalEmpty),
        clipToTile: Boolean(fam.clipToTile),
        uiOrder: typeof fam.uiOrder === 'number' ? fam.uiOrder : fIdx,
        orbitType: orbitInfo.orbitType,
        stabilizer: orbitInfo.stabilizer.slice(),
        variantTransforms: renderReps.slice(),
        isAxisInvariant: Boolean(orbitInfo.isAxisInvariant),
        isDiagInvariant: Boolean(orbitInfo.isDiagInvariant),
        tileIds: famTileIds
      };

      TILE_FAMILIES_META.push(metaEntry);
      familyMetaById.set(fam.id, metaEntry);
    }

    // Hard mathematical invariant guard: Canonical Empty Tile MUST stay at #84
    const emptyMeta = familyMetaById.get(lib.CANONICAL_EMPTY_FAMILY_ID);
    if (!emptyMeta || emptyMeta.tileIds.length !== 1 || emptyMeta.tileIds[0] !== lib.CANONICAL_EMPTY_TILE_ID) {
      throw new Error(
        `CRITICAL INVARIANT VIOLATION: empty-tile must compile to #${lib.CANONICAL_EMPTY_TILE_ID}, ` +
        `got ${emptyMeta ? JSON.stringify(emptyMeta.tileIds) : 'missing'}`
      );
    }

    return {
      doc,
      TILE_RENDERERS,
      TILE_NAMES,
      TILE_FAMILIES_META,
      TILE_D4_MAP,
      variantKeyToId,
      idMeta,
      familyMetaById,
      totalTiles: TILE_RENDERERS.length
    };
  }

  /**
   * Computes an exact numeric tileId remap table { [oldTileId]: newTileId } when recompiling a library.
   * - Built-ins 0..84 always map to themselves.
   * - Existing custom variants map to their matching orientation (or collapsed D4 equivalent in same family).
   * - Deleted custom families map cleanly to #84 (Canonical Empty Tile).
   */
  function computeCompilationRemap(prevCompiled, nextCompiled) {
    const { lib } = getDeps();
    const emptyId = lib.CANONICAL_EMPTY_TILE_ID;
    const idRemap = {};
    let hasChanges = false;

    if (!prevCompiled || !Array.isArray(prevCompiled.idMeta)) {
      return { idRemap, hasChanges: false };
    }

    for (let oldId = 0; oldId < prevCompiled.idMeta.length; oldId++) {
      const meta = prevCompiled.idMeta[oldId];
      if (!meta || oldId < lib.BUILTIN_TILE_COUNT) {
        idRemap[oldId] = oldId;
        continue;
      }

      const exactKey = `${meta.familyId}:${meta.transform}`;
      let newId;

      if (nextCompiled.variantKeyToId.has(exactKey)) {
        newId = nextCompiled.variantKeyToId.get(exactKey);
      } else if (nextCompiled.familyMetaById.has(meta.familyId)) {
        // Family still exists, but its symmetry orbit collapsed or changed coset representative:
        // apply original D4 transform onto the new primary (:id) tile of that family!
        const nextFamMeta = nextCompiled.familyMetaById.get(meta.familyId);
        const primaryNewId = nextFamMeta.tileIds[0];
        const mapRow = nextCompiled.TILE_D4_MAP[primaryNewId];
        newId = (mapRow && mapRow[meta.transform] !== undefined) ? mapRow[meta.transform] : primaryNewId;
      } else {
        // Family was deleted -> Tombstone to Canonical Empty Tile (#84)
        newId = emptyId;
      }

      idRemap[oldId] = newId;
      if (newId !== oldId) {
        hasChanges = true;
      }
    }

    return { idRemap, hasChanges };
  }

  const LibraryCompiler = {
    sanitizeShape,
    sanitizeLibraryDoc,
    compileLibrary,
    computeCompilationRemap
  };

  if (typeof window !== 'undefined') {
    window.LibraryCompiler = LibraryCompiler;
  }
  if (typeof global !== 'undefined' && global.window) {
    global.window.LibraryCompiler = LibraryCompiler;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LibraryCompiler;
  }
})();

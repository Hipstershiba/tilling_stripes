/**
 * core/subtile_studio_ui.js
 * Controller for Tiling Stripes Subtile Studio Mode (data-studio-mode="tiles"),
 * Group & Family Library Manager (CRUD, Drag-and-Drop, JSON Import/Export, Reset),
 * and Live D4 Orbit / Master Preview Viewport.
 */

(function () {
  function resolveDeps() {
    const win = (typeof window !== 'undefined' && window) ||
      (typeof global !== 'undefined' && global.window) ||
      null;

    let d4 = win && win.D4Symmetry;
    let vr = win && win.VectorRenderer;
    let det = win && win.D4Detect;
    let lib = win && win.TileLibrary;
    let compiler = win && win.LibraryCompiler;
    let store = win && win.LibraryStore;
    let reg = win && win.TileRegistry;

    if (typeof require === 'function') {
      if (!d4) {
        require('./d4_symmetry.js');
        d4 = win && win.D4Symmetry;
      }
      if (!vr) vr = require('./vector_renderer.js');
      if (!det) det = require('./d4_detect.js');
      if (!lib) lib = require('./tile_library.js');
      if (!compiler) compiler = require('./library_compiler.js');
      if (!store) store = require('./library_store.js');
      if (!reg) reg = require('./tile_registry.js');
    }

    return { win, d4, vr, det, lib, compiler, store, reg };
  }

  const ORBIT_LABELS_PT = {
    symmetric_1: 'Simétrico Total (D4 • 1v)',
    axis_2: 'Axial D2 (Eixos X/Y • 2v)',
    diag_2: 'Diagonal D2 (Diagonais • 2v)',
    rot_2: 'Rotacional C2 (180° • 2v)',
    edge_4: 'Borda Reflexiva (4 direções • 4v)',
    corner_4: 'Canto Diagonal (4 cantos • 4v)',
    chiral_4: 'Giro Quiral C2 (4v)',
    mirror_4: 'Espelho Simples (4v)',
    asymmetric_8: 'Assimétrico / Quiral Puro (8v)'
  };

  /**
   * Pure helper: moves an element inside a shallow copy of `arr` from `fromIndex` to `toIndex`.
   */
  function moveItemInArray(arr, fromIndex, toIndex) {
    if (!Array.isArray(arr)) return [];
    const copy = arr.slice();
    if (
      fromIndex < 0 ||
      fromIndex >= copy.length ||
      toIndex < 0 ||
      toIndex >= copy.length ||
      fromIndex === toIndex
    ) {
      return copy;
    }
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    return copy;
  }

  /**
   * Pure helper: counts how many active cells, frozen cells, or brush cells reference a family's tileIds.
   */
  function countFamilyUsageInMosaic(studioState, familyId, optionalRegistry) {
    const { reg } = resolveDeps();
    const registry = optionalRegistry || reg;
    const fam = registry && typeof registry.getFamilyById === 'function'
      ? registry.getFamilyById(familyId)
      : null;

    if (!fam || !Array.isArray(fam.tileIds) || fam.tileIds.length === 0 || !studioState) {
      return { mosaicCells: 0, frozenCells: 0, brushMatches: 0, total: 0 };
    }

    const targetIds = new Set(fam.tileIds);
    let mosaicCells = 0;
    let frozenCells = 0;
    let brushMatches = 0;

    const grid = studioState.mosaicData && Array.isArray(studioState.mosaicData.grid)
      ? studioState.mosaicData.grid
      : null;

    if (grid) {
      for (let r = 0; r < grid.length; r++) {
        const blockRow = grid[r];
        if (!Array.isArray(blockRow)) continue;
        for (let c = 0; c < blockRow.length; c++) {
          const block = blockRow[c];
          if (!block || !Array.isArray(block.cells)) continue;
          for (let sr = 0; sr < block.cells.length; sr++) {
            const subRow = block.cells[sr];
            if (!Array.isArray(subRow)) continue;
            for (let sc = 0; sc < subRow.length; sc++) {
              const cell = subRow[sc];
              if (cell && (targetIds.has(cell.tileId) || targetIds.has(cell.baseTileId))) {
                mosaicCells++;
              }
            }
          }
        }
      }
    }

    if (studioState.frozenCells instanceof Map) {
      for (const val of studioState.frozenCells.values()) {
        if (val && (targetIds.has(val.tileId) || targetIds.has(val.baseTileId))) {
          frozenCells++;
        }
      }
    }

    if (targetIds.has(studioState.editBrushTileId)) {
      brushMatches++;
    } else if (studioState.supertilePattern && Array.isArray(studioState.supertilePattern.cells)) {
      for (const row of studioState.supertilePattern.cells) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
          if (cell && (targetIds.has(cell.tileId) || targetIds.has(cell.baseTileId))) {
            brushMatches++;
          }
        }
      }
    }

    return {
      mosaicCells,
      frozenCells,
      brushMatches,
      total: mosaicCells + frozenCells + brushMatches
    };
  }

  /**
   * Pure helper: validates an incoming JSON string/object before importing into LibraryStore.
   */
  function inspectImportPayload(rawInput) {
    const { compiler } = resolveDeps();
    let parsed;
    try {
      parsed = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;
    } catch (err) {
      return { ok: false, error: `JSON inválido: ${err.message}` };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'O arquivo não contém um objeto de biblioteca válido.' };
    }

    const root = parsed.doc && typeof parsed.doc === 'object' ? parsed.doc : parsed;
    if (!Array.isArray(root.families)) {
      return { ok: false, error: 'Formato inválido: propriedade "families" ausente.' };
    }

    const sanitized = compiler.sanitizeLibraryDoc(root);
    const customFamilies = sanitized.families.filter((f) => !f.builtIn);
    const customGroups = sanitized.groups.filter((g) => !g.builtIn);

    return {
      ok: true,
      error: null,
      customFamilyCount: customFamilies.length,
      customGroupCount: customGroups.length,
      totalFamilies: sanitized.families.length,
      parsed: root
    };
  }

  /**
   * Pure helper: applies compilation ID remaps (including #84 tombstones) onto `studioState`
   * and auto-enrolls brand-new custom variants into `studioState.allowedTiles`.
   */
  function syncStudioStateWithLibraryEvent(studioState, evt, prevVariantKeys) {
    const { store, lib } = resolveDeps();
    const emptyId = lib ? lib.CANONICAL_EMPTY_TILE_ID : 84;
    const builtInCount = lib ? lib.BUILTIN_TILE_COUNT : 85;

    let remapped = false;
    if (evt && evt.hasRemapChanges && store && typeof store.remapStudioState === 'function') {
      remapped = store.remapStudioState(studioState, evt.idRemap, evt.maxValidTileId);
    }

    const nextKeys = new Set();
    const enrolledTileIds = [];
    const compiled = evt && evt.compiled ? evt.compiled : (store ? store.getCompiled() : null);

    if (compiled && compiled.variantKeyToId instanceof Map) {
      for (const [vKey, tileId] of compiled.variantKeyToId.entries()) {
        nextKeys.add(vKey);
        const isCustomSlot = typeof tileId === 'number' && tileId >= builtInCount && tileId !== emptyId;
        const isBrandNew = prevVariantKeys instanceof Set ? !prevVariantKeys.has(vKey) : false;
        if (isCustomSlot && isBrandNew && studioState && studioState.allowedTiles instanceof Set) {
          studioState.allowedTiles.add(tileId);
          enrolledTileIds.push(tileId);
        }
      }
    }

    // Clamp any out-of-range allowedTiles just in case
    if (compiled && studioState && studioState.allowedTiles instanceof Set) {
      for (const tid of Array.from(studioState.allowedTiles)) {
        if (typeof tid !== 'number' || tid < 0 || tid >= compiled.totalTiles) {
          studioState.allowedTiles.delete(tid);
        }
      }
      if (studioState.allowedTiles.size === 0) {
        studioState.allowedTiles.add(0);
      }
    }

    return {
      remapped,
      enrolledTileIds,
      variantKeys: nextKeys
    };
  }

  /**
   * Pure helper: computes the grid of preview cells for the Subtile Studio viewport.
   */
  function computePreviewCells(previewMode, masterTransform = 'id') {
    const { d4 } = resolveDeps();
    const compose = d4 && typeof d4.composeD4 === 'function'
      ? d4.composeD4
      : (_o, i) => i;
    const t0 = masterTransform || 'id';

    if (previewMode === 'neighbors_3x3') {
      const cells = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          cells.push({
            row: r,
            col: c,
            transform: t0,
            isMaster: r === 1 && c === 1,
            ghost: !(r === 1 && c === 1)
          });
        }
      }
      return { rows: 3, cols: 3, cells };
    }

    if (previewMode === 'mandala_d4') {
      return {
        rows: 2,
        cols: 2,
        cells: [
          { row: 0, col: 0, transform: t0, isMaster: true, ghost: false },
          { row: 0, col: 1, transform: compose('mx', t0), isMaster: false, ghost: false },
          { row: 1, col: 0, transform: compose('my', t0), isMaster: false, ghost: false },
          { row: 1, col: 1, transform: compose('r180', t0), isMaster: false, ghost: false }
        ]
      };
    }

    if (previewMode === 'rotational_c4') {
      return {
        rows: 2,
        cols: 2,
        cells: [
          { row: 0, col: 0, transform: t0, isMaster: true, ghost: false },
          { row: 0, col: 1, transform: compose('r90', t0), isMaster: false, ghost: false },
          { row: 1, col: 0, transform: compose('r270', t0), isMaster: false, ghost: false },
          { row: 1, col: 1, transform: compose('r180', t0), isMaster: false, ghost: false }
        ]
      };
    }

    // Default: 'single' (1x1 master view)
    return {
      rows: 1,
      cols: 1,
      cells: [
        { row: 0, col: 0, transform: t0, isMaster: true, ghost: false }
      ]
    };
  }

  // ==========================================================================
  // Browser Studio UI Controller State
  // ==========================================================================

  const uiState = {
    initialized: false,
    selectedFamilyId: 'elbow-ribbon',
    selectedVariantIndex: 0,
    previewMode: 'neighbors_3x3', // 'single' | 'neighbors_3x3' | 'mandala_d4' | 'rotational_c4'
    searchQuery: '',
    filterMode: 'all', // 'all' | 'custom' | 'builtin'
    collapsedGroups: new Set(),
    editingGroupId: null,
    editingFamilyId: null,
    dragState: null, // { kind: 'group' | 'family', id: string, groupId?: string }
    guides: {
      showGrid: true,
      showAxes: true,
      showPorts: true,
      showPadding: true
    },
    hoverNorm: null, // { nx, ny } in [-0.5, 0.5] inside active master cell
    lastMasterCellRect: null, // { cx, cy, side } in unscaled artboard coordinates
    pendingConfirmAction: null,
    pendingImportData: null
  };

  let hostCtx = null; // { studioState, redraw, showToast, selectBrushTile, setActiveTool, regenerateMosaic, saveStudioState, syncEditWorkspaceUI, updateStatusBar, renderSwatchesPanel, renderEditBrushPalette }

  function getSelectedFamilyMeta() {
    const { reg } = resolveDeps();
    if (!reg) return null;
    let fam = reg.getFamilyById(uiState.selectedFamilyId);
    if (!fam && reg.TILE_FAMILIES_META.length > 0) {
      fam = reg.TILE_FAMILIES_META[0];
      if (fam) uiState.selectedFamilyId = fam.id;
    }
    return fam || null;
  }

  function getSelectedFamilyDoc() {
    const { store } = resolveDeps();
    if (!store) return null;
    const fam = getSelectedFamilyMeta();
    return fam ? store.getFamilyById(fam.id) : null;
  }

  function ensureValidSelection() {
    const fam = getSelectedFamilyMeta();
    if (!fam) return null;
    if (uiState.selectedVariantIndex < 0 || uiState.selectedVariantIndex >= fam.tileIds.length) {
      uiState.selectedVariantIndex = 0;
    }
    return fam;
  }

  function notifyToast(msg, type = 'info') {
    if (hostCtx && typeof hostCtx.showToast === 'function') {
      hostCtx.showToast(msg, type);
    }
  }

  function requestHostRedraw() {
    if (hostCtx && typeof hostCtx.redraw === 'function') {
      hostCtx.redraw();
    }
  }

  // ==========================================================================
  // Mode Transitions (data-studio-mode="mosaic" | "tiles")
  // ==========================================================================

  function isTilesMode(studioState) {
    const st = studioState || (hostCtx && hostCtx.studioState);
    return Boolean(st && st.studioMode === 'tiles');
  }

  function syncModeDOM() {
    if (typeof document === 'undefined' || !document.body) return;
    const st = hostCtx && hostCtx.studioState;
    const activeMode = st && st.studioMode === 'tiles' ? 'tiles' : 'mosaic';
    document.body.dataset.studioMode = activeMode;

    const btnMode = document.getElementById('btnStudioTilesMode');
    if (btnMode) {
      const inTiles = activeMode === 'tiles';
      btnMode.classList.toggle('active', inTiles);
      btnMode.setAttribute('aria-pressed', inTiles ? 'true' : 'false');
      const labelEl = btnMode.querySelector('.studio-mode-btn-label');
      if (labelEl) {
        labelEl.textContent = inTiles ? '← Voltar ao Mosaico' : 'Subtiles';
      }
      btnMode.title = inTiles
        ? 'Voltar ao Mosaico (Atalho: Ctrl+E ou Esc)'
        : 'Abrir Estúdio de Subtiles e Gestão de Famílias (Atalho: Ctrl+E)';
    }

    const tilesDock = document.getElementById('dock-workspace-tiles');
    const genDock = document.getElementById('dock-workspace-generate');
    const editDock = document.getElementById('dock-workspace-edit');
    const ctxTitle = document.getElementById('ctxPanelTitle');

    if (activeMode === 'tiles') {
      tilesDock?.classList.remove('hidden');
      genDock?.classList.add('hidden');
      editDock?.classList.add('hidden');
      if (ctxTitle) ctxTitle.textContent = 'Subtiles & Famílias';
    } else {
      tilesDock?.classList.add('hidden');
      if (hostCtx && typeof hostCtx.syncEditWorkspaceUI === 'function') {
        hostCtx.syncEditWorkspaceUI();
      }
    }

    if (hostCtx && typeof hostCtx.updateStatusBar === 'function') {
      hostCtx.updateStatusBar();
    }
  }

  function openTilesStudio(familyId, options = {}) {
    if (!hostCtx || !hostCtx.studioState) return;
    const { reg } = resolveDeps();

    if (familyId && reg && reg.getFamilyById(familyId)) {
      uiState.selectedFamilyId = familyId;
      uiState.selectedVariantIndex = typeof options.variantIndex === 'number' ? options.variantIndex : 0;
    } else if (!familyId && typeof hostCtx.studioState.editBrushTileId === 'number' && reg) {
      const brushFam = reg.getFamilyForTile(hostCtx.studioState.editBrushTileId);
      if (brushFam && !brushFam.isCanonicalEmpty) {
        uiState.selectedFamilyId = brushFam.id;
        const vIdx = brushFam.tileIds.indexOf(hostCtx.studioState.editBrushTileId);
        uiState.selectedVariantIndex = vIdx >= 0 ? vIdx : 0;
      }
    }

    ensureValidSelection();
    hostCtx.studioState.studioMode = 'tiles';

    // Ensure right dock is expanded so the user sees the D4 & Library panels immediately
    if (typeof document !== 'undefined' && document.body.classList.contains('right-dock-collapsed')) {
      document.getElementById('btnToggleRightDock')?.click();
    }

    syncModeDOM();
    refresh();
    requestHostRedraw();
  }

  function closeTilesStudio(options = {}) {
    if (!hostCtx || !hostCtx.studioState) return;
    hostCtx.studioState.studioMode = 'mosaic';
    uiState.hoverNorm = null;

    if (options.paintWithTileId !== undefined && typeof hostCtx.selectBrushTile === 'function') {
      const tid = options.paintWithTileId;
      if (typeof hostCtx.setActiveTool === 'function') {
        hostCtx.setActiveTool('paint');
      }
      hostCtx.selectBrushTile(tid);
      const { reg } = resolveDeps();
      const tName = (reg && reg.TILE_NAMES[tid]) || `Tile #${tid}`;
      notifyToast(`Pincel ativo: #${tid} • ${tName}`);
    }

    syncModeDOM();
    requestHostRedraw();
  }

  function toggleTilesStudio() {
    if (isTilesMode()) {
      closeTilesStudio();
    } else {
      openTilesStudio();
    }
  }

  function selectFamily(familyId, variantIndex = 0) {
    const { reg } = resolveDeps();
    if (!reg || !reg.getFamilyById(familyId)) return;
    uiState.selectedFamilyId = familyId;
    uiState.selectedVariantIndex = variantIndex;
    ensureValidSelection();
    refresh();
    requestHostRedraw();
  }

  // ==========================================================================
  // Confirmation & Import Modals (Non-blocking Accessible Dialogs)
  // ==========================================================================

  function openConfirmModal({ title, descriptionHTML, confirmLabel = 'Confirmar', danger = false, onConfirm }) {
    if (typeof document === 'undefined') return;
    const dialog = document.getElementById('subtileConfirmDialog');
    const titleEl = document.getElementById('subtileConfirmTitle');
    const descEl = document.getElementById('subtileConfirmDesc');
    const confirmBtn = document.getElementById('btnSubtileConfirmOk');
    const cancelBtn = document.getElementById('btnSubtileConfirmCancel');
    if (!dialog || !confirmBtn) {
      if (typeof onConfirm === 'function') onConfirm();
      return;
    }

    if (titleEl) titleEl.textContent = title || 'Confirmar Ação';
    if (descEl) descEl.innerHTML = descriptionHTML || '';
    confirmBtn.textContent = confirmLabel;
    confirmBtn.classList.toggle('danger', Boolean(danger));

    uiState.pendingConfirmAction = onConfirm;
    dialog.classList.remove('hidden');
    cancelBtn?.focus();
  }

  function closeConfirmModal(confirmed) {
    if (typeof document === 'undefined') return;
    const dialog = document.getElementById('subtileConfirmDialog');
    dialog?.classList.add('hidden');
    const fn = uiState.pendingConfirmAction;
    uiState.pendingConfirmAction = null;
    if (confirmed && typeof fn === 'function') {
      fn();
    }
  }

  function openImportModal(fileName, rawJsonText) {
    if (typeof document === 'undefined') return;
    const inspection = inspectImportPayload(rawJsonText);
    if (!inspection.ok) {
      notifyToast(inspection.error, 'error');
      return;
    }

    const dialog = document.getElementById('subtileImportDialog');
    const summaryEl = document.getElementById('subtileImportSummary');
    if (!dialog) return;

    uiState.pendingImportData = { fileName, rawJsonText, inspection };

    if (summaryEl) {
      summaryEl.innerHTML =
        `Arquivo: <strong>${escapeHtml(fileName || 'biblioteca.json')}</strong><br>` +
        `Subtiles customizados detectados: <strong>${inspection.customFamilyCount}</strong> • ` +
        `Grupos customizados: <strong>${inspection.customGroupCount}</strong>`;
    }

    dialog.classList.remove('hidden');
    document.getElementById('btnSubtileImportConfirm')?.focus();
  }

  function closeImportModal(confirmed) {
    if (typeof document === 'undefined') return;
    const dialog = document.getElementById('subtileImportDialog');
    dialog?.classList.add('hidden');

    const pending = uiState.pendingImportData;
    uiState.pendingImportData = null;
    if (!confirmed || !pending) return;

    const { store } = resolveDeps();
    if (!store) return;

    const modeRadio = document.querySelector('input[name="subtileImportMode"]:checked');
    const conflictSelect = document.getElementById('subtileImportConflictSelect');
    const mode = modeRadio ? modeRadio.value : 'merge';
    const conflictPolicy = conflictSelect ? conflictSelect.value : 'overwrite';

    try {
      const evt = store.importLibraryJSON(pending.rawJsonText, { mode, conflictPolicy });
      const customFams = evt.doc.families.filter((f) => !f.builtIn);
      if (customFams.length > 0) {
        uiState.selectedFamilyId = customFams[customFams.length - 1].id;
        uiState.selectedVariantIndex = 0;
      }
      refresh();
      requestHostRedraw();
      notifyToast(
        mode === 'replace'
          ? `Biblioteca substituída (${customFams.length} subtiles customizados).`
          : `Biblioteca mesclada com sucesso (${pending.inspection.customFamilyCount} subtiles lidos).`
      );
    } catch (err) {
      notifyToast(`Falha ao importar JSON: ${err.message}`, 'error');
    }
  }

  function triggerDownloadJSON(filename, jsonString) {
    if (typeof document === 'undefined') return;
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ==========================================================================
  // CRUD Actions (Groups & Families)
  // ==========================================================================

  function handleCreateGroup() {
    const { store } = resolveDeps();
    if (!store) return;
    const created = store.createGroup('Novo Grupo');
    uiState.collapsedGroups.delete(created.id);
    uiState.editingGroupId = created.id;
    refresh();
    notifyToast(`Grupo "${created.name}" criado.`);
  }

  function handleDeleteGroup(groupId) {
    const { store } = resolveDeps();
    if (!store) return;
    const groups = store.getGroups();
    const grp = groups.find((g) => g.id === groupId);
    if (!grp || grp.builtIn) return;

    const famsInGroup = store.getFamilies({ groupId });
    const countNote = famsInGroup.length > 0
      ? `As <strong>${famsInGroup.length} famílias</strong> dentro dele não serão apagadas: serão movidas automaticamente para um grupo seguro.`
      : 'Este grupo está vazio e será removido da biblioteca.';

    openConfirmModal({
      title: `Excluir grupo "${grp.name}"?`,
      descriptionHTML: countNote,
      confirmLabel: 'Excluir Grupo',
      danger: true,
      onConfirm: () => {
        store.deleteGroup(groupId);
        uiState.collapsedGroups.delete(groupId);
        refresh();
        notifyToast(`Grupo "${grp.name}" excluído.`);
      }
    });
  }

  function handleCreateFamily(preferredGroupId = null) {
    const { store } = resolveDeps();
    if (!store) return;
    const curFam = getSelectedFamilyMeta();
    const targetGrp = preferredGroupId ||
      (curFam && !curFam.builtIn ? curFam.groupId : null);

    const res = store.createFamily({
      name: 'Novo Subtile',
      groupId: targetGrp || undefined
    });

    uiState.selectedFamilyId = res.family.id;
    uiState.selectedVariantIndex = 0;
    uiState.collapsedGroups.delete(res.family.groupId);
    if (uiState.filterMode === 'builtin') {
      uiState.filterMode = 'all';
    }
    refresh();
    requestHostRedraw();

    const nameInput = document.getElementById('tileActiveFamilyNameInput');
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
    notifyToast(`Subtile "${res.family.name}" criado (#${res.meta.tileIds[0]}).`);
  }

  function handleDuplicateFamily(sourceFamilyId) {
    const { store } = resolveDeps();
    if (!store) return;
    const targetId = sourceFamilyId || uiState.selectedFamilyId;
    if (!targetId) return;

    const src = store.getFamilyById(targetId);
    if (!src) return;

    // Special case: duplicating empty-tile gives a clean editable starter shape
    const overrides = src.isCanonicalEmpty
      ? {
          name: 'Subtile Customizado',
          shapes: [
            { id: 's1', type: 'rect', name: 'Bloco Central', x: -1 / 6, y: -1 / 6, w: 1 / 3, h: 1 / 3, fill: true, stroke: false }
          ]
        }
      : {};

    const res = store.duplicateFamily(targetId, overrides);
    uiState.selectedFamilyId = res.family.id;
    uiState.selectedVariantIndex = 0;
    uiState.collapsedGroups.delete(res.family.groupId);
    if (uiState.filterMode === 'builtin') {
      uiState.filterMode = 'all';
    }
    refresh();
    requestHostRedraw();
    notifyToast(`Cópia editável criada: "${res.family.name}" (#${res.meta.tileIds[0]}).`);
  }

  function handleDeleteFamily(familyId) {
    const { store, reg } = resolveDeps();
    if (!store || !reg) return;
    const famMeta = reg.getFamilyById(familyId);
    if (!famMeta || famMeta.builtIn || famMeta.protected || famMeta.isCanonicalEmpty) return;

    const usage = countFamilyUsageInMosaic(hostCtx ? hostCtx.studioState : null, familyId, reg);
    const idRange = famMeta.tileIds.length > 1
      ? `#${famMeta.tileIds[0]}..#${famMeta.tileIds[famMeta.tileIds.length - 1]}`
      : `#${famMeta.tileIds[0]}`;

    let usageWarning = '';
    if (usage.total > 0) {
      const parts = [];
      if (usage.mosaicCells > 0) parts.push(`<strong>${usage.mosaicCells}</strong> células do mosaico`);
      if (usage.frozenCells > 0) parts.push(`<strong>${usage.frozenCells}</strong> células travadas`);
      if (usage.brushMatches > 0) parts.push('o pincel ativo');
      usageWarning =
        `Esta família (${idRange}) está em uso em ${parts.join(', ')}. ` +
        `Ao excluir, todas as ocorrências serão higienizadas automaticamente para o <strong>Tile Vazio (#84)</strong>.`;
    } else {
      usageWarning =
        `Esta família (${idRange}) não está nas células visíveis do mosaico atual. ` +
        `Quaisquer referências em históricos antigos serão higienizadas para o <strong>Tile Vazio (#84)</strong>.`;
    }

    openConfirmModal({
      title: `Excluir "${famMeta.name}"?`,
      descriptionHTML: usageWarning,
      confirmLabel: 'Excluir Família',
      danger: true,
      onConfirm: () => {
        store.deleteFamily(familyId);
        if (uiState.selectedFamilyId === familyId) {
          const allFams = reg.TILE_FAMILIES_META;
          uiState.selectedFamilyId = allFams.length > 0 ? allFams[0].id : 'ribbon-curved-1-3';
          uiState.selectedVariantIndex = 0;
        }
        refresh();
        requestHostRedraw();
        notifyToast(`Família "${famMeta.name}" excluída (células higienizadas para #84).`, 'warn');
      }
    });
  }

  function handleResetLibraryDefaults() {
    const { store } = resolveDeps();
    if (!store) return;
    const customFams = store.getFamilies({ customOnly: true });
    const customGroups = store.getGroups().filter((g) => !g.builtIn);

    const desc = customFams.length > 0 || customGroups.length > 0
      ? `Isso removerá <strong>${customFams.length} famílias customizadas</strong> e <strong>${customGroups.length} grupos customizados</strong>, ` +
        `restaurando a ordem original dos 31 mestres (85 subtiles). Células customizadas no mosaico passarão para o <strong>Tile Vazio (#84)</strong>.`
      : 'Restaurar a ordem padrão dos 6 grupos e 31 famílias originais?';

    openConfirmModal({
      title: 'Restaurar Biblioteca Padrão?',
      descriptionHTML: desc,
      confirmLabel: 'Restaurar Padrão',
      danger: true,
      onConfirm: () => {
        store.resetToDefaults();
        uiState.selectedFamilyId = 'ribbon-curved-1-3';
        uiState.selectedVariantIndex = 0;
        uiState.collapsedGroups.clear();
        refresh();
        requestHostRedraw();
        notifyToast('Biblioteca restaurada para os 31 mestres padrão (85 subtiles).');
      }
    });
  }

  function moveGroupByDelta(groupId, delta) {
    const { store } = resolveDeps();
    if (!store) return;
    const groups = store.getGroups();
    const idx = groups.findIndex((g) => g.id === groupId);
    if (idx === -1) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= groups.length) return;
    const nextIds = moveItemInArray(groups.map((g) => g.id), idx, targetIdx);
    store.reorderGroups(nextIds);
    refresh();
  }

  function moveFamilyWithinGroupByDelta(groupId, familyId, delta) {
    const { store, reg } = resolveDeps();
    if (!store || !reg) return;
    const grouped = reg.getOrderedGroupedFamilies();
    const bucket = grouped.find((g) => g.id === groupId);
    if (!bucket) return;
    const ids = bucket.families.filter((f) => !f.protected).map((f) => f.id);
    const idx = ids.indexOf(familyId);
    if (idx === -1) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= ids.length) return;
    const nextIds = moveItemInArray(ids, idx, targetIdx);
    store.reorderFamiliesInGroup(groupId, nextIds);
    refresh();
  }

  function moveFamilyToGroupAt(familyId, targetGroupId, beforeFamilyId = null) {
    const { store, reg } = resolveDeps();
    if (!store || !reg) return;
    const fam = reg.getFamilyById(familyId);
    if (!fam || fam.protected || targetGroupId === 'grp-void') return;

    const grouped = reg.getOrderedGroupedFamilies();
    const targetBucket = grouped.find((g) => g.id === targetGroupId);
    if (!targetBucket) return;

    const ids = targetBucket.families
      .filter((f) => !f.protected && f.id !== familyId)
      .map((f) => f.id);

    if (beforeFamilyId) {
      const insertIdx = ids.indexOf(beforeFamilyId);
      if (insertIdx >= 0) ids.splice(insertIdx, 0, familyId);
      else ids.push(familyId);
    } else {
      ids.push(familyId);
    }

    store.reorderFamiliesInGroup(targetGroupId, ids);
    uiState.collapsedGroups.delete(targetGroupId);
    refresh();
  }

  // ==========================================================================
  // Rendering DOM Panels (Top Bar, Left Rail Guides, D4 Live, Library Tree)
  // ==========================================================================

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderTopBarControls() {
    if (typeof document === 'undefined') return;
    const fam = ensureValidSelection();
    if (!fam) return;

    const badgeEl = document.getElementById('tileStudioActiveBadge');
    const nameEl = document.getElementById('tileStudioActiveName');
    const dupBtn = document.getElementById('btnTileTopDuplicate');
    const clipBtn = document.getElementById('btnTileClipToggle');

    const activeTileId = fam.tileIds[uiState.selectedVariantIndex] ?? fam.tileIds[0];

    if (badgeEl) {
      badgeEl.textContent = fam.builtIn ? `Padrão #${activeTileId}` : `Custom #${activeTileId}`;
      badgeEl.classList.toggle('is-custom', !fam.builtIn);
    }
    if (nameEl) {
      nameEl.textContent = fam.name;
      nameEl.title = `${fam.name} (${fam.group})`;
    }
    if (dupBtn) {
      dupBtn.classList.toggle('hidden', !fam.builtIn);
    }
    if (clipBtn) {
      const famDoc = getSelectedFamilyDoc();
      const isClipped = Boolean(famDoc && famDoc.clipToTile);
      clipBtn.classList.toggle('active', isClipped);
      clipBtn.setAttribute('aria-pressed', isClipped ? 'true' : 'false');
      clipBtn.disabled = Boolean(fam.builtIn || fam.protected);
      clipBtn.title = fam.builtIn
        ? 'Duplique este mestre padrão para alterar o recorte (Clip)'
        : 'Recortar geometria nos limites [-0.5, 0.5] do subtile';
    }

    document.querySelectorAll('#tilePreviewModeGroup [data-tile-preview]').forEach((btn) => {
      const active = btn.dataset.tilePreview === uiState.previewMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderLeftPaneState() {
    if (typeof document === 'undefined') return;
    const map = [
      ['toggleTileGuideGrid', 'showGrid'],
      ['toggleTileGuideAxes', 'showAxes'],
      ['toggleTileGuidePorts', 'showPorts'],
      ['toggleTileGuidePadding', 'showPadding']
    ];
    for (const [id, key] of map) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      const on = Boolean(uiState.guides[key]);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function renderD4LivePanel() {
    if (typeof document === 'undefined') return;
    const { reg, d4, store } = resolveDeps();
    const fam = ensureValidSelection();
    if (!fam || !reg) return;

    const famDoc = getSelectedFamilyDoc();
    const countBadge = document.getElementById('tileLiveOrbitCountBadge');
    const orbitLabelEl = document.getElementById('tileLiveOrbitLabel');
    const stabCodeEl = document.getElementById('tileLiveStabilizerCode');
    const compatRow = document.getElementById('tileLiveCompatRow');
    const variantsGrid = document.getElementById('tileLiveVariantsGrid');
    const readOnlyNotice = document.getElementById('tileReadOnlyNotice');
    const customMetaBox = document.getElementById('tileCustomMetaBox');

    if (countBadge) {
      const n = fam.tileIds.length;
      countBadge.textContent = `${n} ${n === 1 ? 'variante' : 'variantes'}`;
    }
    if (orbitLabelEl) {
      orbitLabelEl.textContent = ORBIT_LABELS_PT[fam.orbitType] || fam.orbitType;
    }
    if (stabCodeEl) {
      const stab = Array.isArray(fam.stabilizer) && fam.stabilizer.length > 0
        ? fam.stabilizer.join(', ')
        : 'id';
      stabCodeEl.textContent = `H = {${stab}}`;
    }

    if (compatRow) {
      const axisOk = Boolean(fam.isAxisInvariant);
      const diagOk = Boolean(fam.isDiagInvariant);
      const centerOk = fam.tileIds.length === 1;
      compatRow.innerHTML = `
        <span class="d4-compat-pill ${axisOk ? 'ok' : 'neutral'}" title="${axisOk ? 'Possui variante invariante em eixos ortogonais (mx/my)' : 'Assimétrico nos eixos X/Y (usa #84 em células axiais estritas)'}">
          Eixos X/Y: ${axisOk ? 'Sim' : 'Não'}
        </span>
        <span class="d4-compat-pill ${diagOk ? 'ok' : 'neutral'}" title="${diagOk ? 'Possui variante invariante nas diagonais (md/mad) de Mandala D4' : 'Assimétrico nas diagonais (usa #84 na diagonal estrita de Mandala D4)'}">
          Diagonais: ${diagOk ? 'Sim' : 'Não'}
        </span>
        <span class="d4-compat-pill ${centerOk ? 'ok' : 'neutral'}" title="${centerOk ? 'Invariante no centro ímpar de Mandala D4' : 'Gera órbita rotacional/reflexiva fora do centro'}">
          Centro D4: ${centerOk ? 'Sim' : 'Não'}
        </span>
      `;
    }

    if (variantsGrid) {
      variantsGrid.innerHTML = '';
      const thumbs = hostCtx && hostCtx.studioState ? hostCtx.studioState.thumbnailCache : null;
      fam.tileIds.forEach((tid, vIdx) => {
        const repKey = (fam.variantTransforms && fam.variantTransforms[vIdx]) || 'id';
        const d4Meta = (d4 && d4.D4_METADATA && d4.D4_METADATA[repKey]) || { short: repKey.toUpperCase(), arrow: '' };
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tile-live-variant-card' + (vIdx === uiState.selectedVariantIndex ? ' active' : '');
        btn.title = `#${tid} • ${reg.TILE_NAMES[tid] || fam.name} (${repKey}) — Clique p/ inspecionar | Duplo-clique p/ pintar no mosaico`;

        const imgSrc = thumbs && thumbs.get(tid) ? thumbs.get(tid) : '';
        btn.innerHTML = `
          <div class="tile-live-variant-thumb">
            ${imgSrc ? `<img src="${imgSrc}" alt="Tile #${tid}">` : ''}
            <span class="tile-swatch-id">${tid}</span>
          </div>
          <span class="tile-live-variant-tag">${escapeHtml(d4Meta.short)} ${escapeHtml(d4Meta.arrow)}</span>
        `;

        btn.addEventListener('click', () => {
          uiState.selectedVariantIndex = vIdx;
          renderTopBarControls();
          renderD4LivePanel();
          requestHostRedraw();
          if (hostCtx && typeof hostCtx.updateStatusBar === 'function') {
            hostCtx.updateStatusBar();
          }
        });

        btn.addEventListener('dblclick', () => {
          closeTilesStudio({ paintWithTileId: tid });
        });

        variantsGrid.appendChild(btn);
      });
    }

    if (readOnlyNotice && customMetaBox) {
      if (fam.builtIn) {
        readOnlyNotice.classList.remove('hidden');
        customMetaBox.classList.add('hidden');
        const textEl = document.getElementById('tileReadOnlyText');
        if (textEl) {
          textEl.textContent = fam.isCanonicalEmpty
            ? 'O Tile Vazio (#84) é o respiro matemático canônico de Mandala D4 e da Borracha (E).'
            : `Família canônica protegida (slots #${fam.tileIds[0]}..#${fam.tileIds[fam.tileIds.length - 1]}). Duplique para editar livremente.`;
        }
      } else {
        readOnlyNotice.classList.add('hidden');
        customMetaBox.classList.remove('hidden');

        const nameInput = document.getElementById('tileActiveFamilyNameInput');
        if (nameInput && document.activeElement !== nameInput) {
          nameInput.value = fam.name;
        }

        const grpSelect = document.getElementById('tileActiveFamilyGroupSelect');
        if (grpSelect && store) {
          const groups = store.getGroups().filter((g) => g.id !== 'grp-void');
          grpSelect.innerHTML = '';
          for (const g of groups) {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            if (g.id === fam.groupId) opt.selected = true;
            grpSelect.appendChild(opt);
          }
        }

        const shapeCountBadge = document.getElementById('tileActiveShapeCountBadge');
        if (shapeCountBadge) {
          const count = famDoc && Array.isArray(famDoc.shapes) ? famDoc.shapes.length : 0;
          shapeCountBadge.textContent = `${count} ${count === 1 ? 'forma' : 'formas'}`;
        }
      }
    }
  }

  function renderLibraryManagerTree() {
    if (typeof document === 'undefined') return;
    const { reg } = resolveDeps();
    const container = document.getElementById('libMgrTreeContainer');
    const counterBadge = document.getElementById('libMgrCounterBadge');
    if (!container || !reg) return;

    const totalFams = reg.TILE_FAMILIES_META.length;
    const totalTiles = reg.TILE_RENDERERS.length;
    if (counterBadge) {
      counterBadge.textContent = `${totalFams} fam • ${totalTiles} tiles`;
    }

    document.querySelectorAll('#libMgrFilterControl [data-lib-filter]').forEach((btn) => {
      const active = btn.dataset.libFilter === uiState.filterMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const query = (uiState.searchQuery || '').trim().toLowerCase();
    const grouped = reg.getOrderedGroupedFamilies();
    const thumbs = hostCtx && hostCtx.studioState ? hostCtx.studioState.thumbnailCache : null;

    container.innerHTML = '';

    grouped.forEach((grp, grpIdx) => {
      const filteredFams = grp.families.filter((fam) => {
        if (uiState.filterMode === 'custom' && fam.builtIn) return false;
        if (uiState.filterMode === 'builtin' && !fam.builtIn) return false;
        if (!query) return true;
        const matchFam = fam.name.toLowerCase().includes(query) || fam.id.toLowerCase().includes(query);
        const matchGrp = grp.name.toLowerCase().includes(query);
        const matchTileId = fam.tileIds.some((id) => `#${id}` === query || String(id) === query);
        return matchFam || matchGrp || matchTileId;
      });

      // Keep empty custom groups visible when unfiltered so user can drop families into them or rename/delete them
      if (filteredFams.length === 0 && (query || (uiState.filterMode === 'custom' && grp.builtIn) || (uiState.filterMode === 'builtin' && !grp.builtIn))) {
        return;
      }

      const isCollapsed = !query && uiState.collapsedGroups.has(grp.id);
      const groupWrap = document.createElement('div');
      groupWrap.className = 'lib-group-block' + (isCollapsed ? ' is-collapsed' : '');
      groupWrap.dataset.groupId = grp.id;

      // --- Group Header ---
      const header = document.createElement('div');
      header.className = 'lib-group-header';
      header.draggable = uiState.editingGroupId !== grp.id;

      header.addEventListener('dragstart', (e) => {
        uiState.dragState = { kind: 'group', id: grp.id };
        header.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', `group:${grp.id}`);
        }
      });
      header.addEventListener('dragend', () => {
        uiState.dragState = null;
        header.classList.remove('dragging');
        container.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
      });
      header.addEventListener('dragover', (e) => {
        if (!uiState.dragState) return;
        if (uiState.dragState.kind === 'family' && grp.id === 'grp-void') return;
        e.preventDefault();
        header.classList.add('drag-over');
      });
      header.addEventListener('dragleave', () => {
        header.classList.remove('drag-over');
      });
      header.addEventListener('drop', (e) => {
        e.preventDefault();
        header.classList.remove('drag-over');
        const drag = uiState.dragState;
        uiState.dragState = null;
        if (!drag) return;

        if (drag.kind === 'group' && drag.id !== grp.id) {
          const allIds = grouped.map((g) => g.id);
          const fromIdx = allIds.indexOf(drag.id);
          const toIdx = allIds.indexOf(grp.id);
          if (fromIdx >= 0 && toIdx >= 0) {
            const { store } = resolveDeps();
            store?.reorderGroups(moveItemInArray(allIds, fromIdx, toIdx));
            refresh();
          }
        } else if (drag.kind === 'family' && grp.id !== 'grp-void') {
          moveFamilyToGroupAt(drag.id, grp.id, null);
        }
      });

      const leftPart = document.createElement('div');
      leftPart.className = 'lib-group-title-wrap';

      const chevronBtn = document.createElement('button');
      chevronBtn.type = 'button';
      chevronBtn.className = 'lib-group-chevron';
      chevronBtn.textContent = isCollapsed ? '▸' : '▾';
      chevronBtn.title = isCollapsed ? 'Expandir grupo' : 'Recolher grupo';
      chevronBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (uiState.collapsedGroups.has(grp.id)) uiState.collapsedGroups.delete(grp.id);
        else uiState.collapsedGroups.add(grp.id);
        renderLibraryManagerTree();
      });
      leftPart.appendChild(chevronBtn);

      if (uiState.editingGroupId === grp.id) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'lib-inline-rename-input';
        input.value = grp.name;
        const commitRename = () => {
          const nextName = input.value.trim();
          uiState.editingGroupId = null;
          if (nextName && nextName !== grp.name) {
            const { store } = resolveDeps();
            store?.renameGroup(grp.id, nextName);
          }
          refresh();
        };
        input.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commitRename();
          else if (e.key === 'Escape') {
            uiState.editingGroupId = null;
            renderLibraryManagerTree();
          }
        });
        input.addEventListener('blur', commitRename);
        leftPart.appendChild(input);
        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });
      } else {
        const titleSpan = document.createElement('span');
        titleSpan.className = 'lib-group-name';
        titleSpan.textContent = grp.name;
        titleSpan.title = 'Duplo-clique para renomear o grupo • Arraste para reordenar';
        titleSpan.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          uiState.editingGroupId = grp.id;
          renderLibraryManagerTree();
        });
        leftPart.appendChild(titleSpan);

        const countSpan = document.createElement('span');
        countSpan.className = 'lib-group-count';
        countSpan.textContent = `${filteredFams.length}`;
        leftPart.appendChild(countSpan);
      }

      const actionsPart = document.createElement('div');
      actionsPart.className = 'lib-group-actions';

      if (grp.id !== 'grp-void') {
        const addFamBtn = document.createElement('button');
        addFamBtn.type = 'button';
        addFamBtn.className = 'lib-mini-icon-btn';
        addFamBtn.textContent = '+';
        addFamBtn.title = `Criar novo subtile dentro de "${grp.name}"`;
        addFamBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleCreateFamily(grp.id);
        });
        actionsPart.appendChild(addFamBtn);
      }

      const upGrpBtn = document.createElement('button');
      upGrpBtn.type = 'button';
      upGrpBtn.className = 'lib-mini-icon-btn';
      upGrpBtn.textContent = '↑';
      upGrpBtn.disabled = grpIdx === 0;
      upGrpBtn.title = 'Mover grupo para cima';
      upGrpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveGroupByDelta(grp.id, -1);
      });

      const downGrpBtn = document.createElement('button');
      downGrpBtn.type = 'button';
      downGrpBtn.className = 'lib-mini-icon-btn';
      downGrpBtn.textContent = '↓';
      downGrpBtn.disabled = grpIdx === grouped.length - 1;
      downGrpBtn.title = 'Mover grupo para baixo';
      downGrpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moveGroupByDelta(grp.id, 1);
      });

      const renGrpBtn = document.createElement('button');
      renGrpBtn.type = 'button';
      renGrpBtn.className = 'lib-mini-icon-btn';
      renGrpBtn.textContent = '✎';
      renGrpBtn.title = 'Renomear grupo';
      renGrpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiState.editingGroupId = grp.id;
        renderLibraryManagerTree();
      });

      actionsPart.appendChild(upGrpBtn);
      actionsPart.appendChild(downGrpBtn);
      actionsPart.appendChild(renGrpBtn);

      if (!grp.builtIn) {
        const delGrpBtn = document.createElement('button');
        delGrpBtn.type = 'button';
        delGrpBtn.className = 'lib-mini-icon-btn danger';
        delGrpBtn.textContent = '×';
        delGrpBtn.title = 'Excluir grupo customizado';
        delGrpBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDeleteGroup(grp.id);
        });
        actionsPart.appendChild(delGrpBtn);
      }

      header.appendChild(leftPart);
      header.appendChild(actionsPart);
      groupWrap.appendChild(header);

      // --- Family Rows ---
      if (!isCollapsed) {
        const listEl = document.createElement('div');
        listEl.className = 'lib-family-list';

        filteredFams.forEach((fam, famIdx) => {
          const isSelected = fam.id === uiState.selectedFamilyId;
          const row = document.createElement('div');
          row.className = 'lib-family-row' +
            (isSelected ? ' active' : '') +
            (fam.builtIn ? ' is-builtin' : ' is-custom');
          row.dataset.familyId = fam.id;
          row.draggable = !fam.protected && uiState.editingFamilyId !== fam.id;

          row.addEventListener('click', () => {
            selectFamily(fam.id, 0);
          });

          if (!fam.protected) {
            row.addEventListener('dragstart', (e) => {
              e.stopPropagation();
              uiState.dragState = { kind: 'family', id: fam.id, groupId: grp.id };
              row.classList.add('dragging');
              if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', `family:${fam.id}`);
              }
            });
            row.addEventListener('dragend', () => {
              uiState.dragState = null;
              row.classList.remove('dragging');
              container.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
            });
            row.addEventListener('dragover', (e) => {
              if (!uiState.dragState || uiState.dragState.kind !== 'family') return;
              if (grp.id === 'grp-void') return;
              e.preventDefault();
              e.stopPropagation();
              row.classList.add('drag-over');
            });
            row.addEventListener('dragleave', () => {
              row.classList.remove('drag-over');
            });
            row.addEventListener('drop', (e) => {
              e.preventDefault();
              e.stopPropagation();
              row.classList.remove('drag-over');
              const drag = uiState.dragState;
              uiState.dragState = null;
              if (!drag || drag.kind !== 'family' || drag.id === fam.id) return;
              moveFamilyToGroupAt(drag.id, grp.id, fam.id);
            });
          }

          const masterTileId = fam.tileIds[0];
          const thumbSrc = thumbs && thumbs.get(masterTileId) ? thumbs.get(masterTileId) : '';
          const thumbWrap = document.createElement('div');
          thumbWrap.className = 'lib-family-thumb';
          if (thumbSrc) {
            const img = document.createElement('img');
            img.src = thumbSrc;
            img.alt = fam.name;
            thumbWrap.appendChild(img);
          }

          const infoWrap = document.createElement('div');
          infoWrap.className = 'lib-family-info';

          if (uiState.editingFamilyId === fam.id && !fam.builtIn) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'lib-inline-rename-input';
            input.value = fam.name;
            const commitFamRename = () => {
              const nextName = input.value.trim();
              uiState.editingFamilyId = null;
              if (nextName && nextName !== fam.name) {
                const { store } = resolveDeps();
                store?.updateFamily(fam.id, { name: nextName });
              }
              refresh();
            };
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('keydown', (e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitFamRename();
              else if (e.key === 'Escape') {
                uiState.editingFamilyId = null;
                renderLibraryManagerTree();
              }
            });
            input.addEventListener('blur', commitFamRename);
            infoWrap.appendChild(input);
            requestAnimationFrame(() => {
              input.focus();
              input.select();
            });
          } else {
            const nameLine = document.createElement('div');
            nameLine.className = 'lib-family-name-line';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'lib-family-name';
            nameSpan.textContent = fam.name;
            if (!fam.builtIn) {
              nameSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                uiState.editingFamilyId = fam.id;
                renderLibraryManagerTree();
              });
            }
            nameLine.appendChild(nameSpan);

            if (!fam.builtIn) {
              const customTag = document.createElement('span');
              customTag.className = 'lib-custom-pill';
              customTag.textContent = 'Custom';
              nameLine.appendChild(customTag);
            }

            const metaLine = document.createElement('div');
            metaLine.className = 'lib-family-meta-line';
            const idRange = fam.tileIds.length > 1
              ? `#${fam.tileIds[0]}..#${fam.tileIds[fam.tileIds.length - 1]}`
              : `#${fam.tileIds[0]}`;
            metaLine.textContent = `${idRange} • ${fam.tileIds.length}v`;

            infoWrap.appendChild(nameLine);
            infoWrap.appendChild(metaLine);
          }

          const rowActions = document.createElement('div');
          rowActions.className = 'lib-family-actions';

          if (!fam.protected) {
            const upBtn = document.createElement('button');
            upBtn.type = 'button';
            upBtn.className = 'lib-mini-icon-btn';
            upBtn.textContent = '↑';
            upBtn.disabled = famIdx === 0;
            upBtn.title = 'Subir na lista';
            upBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              moveFamilyWithinGroupByDelta(grp.id, fam.id, -1);
            });

            const downBtn = document.createElement('button');
            downBtn.type = 'button';
            downBtn.className = 'lib-mini-icon-btn';
            downBtn.textContent = '↓';
            downBtn.disabled = famIdx === filteredFams.length - 1;
            downBtn.title = 'Descer na lista';
            downBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              moveFamilyWithinGroupByDelta(grp.id, fam.id, 1);
            });

            rowActions.appendChild(upBtn);
            rowActions.appendChild(downBtn);
          }

          const dupBtn = document.createElement('button');
          dupBtn.type = 'button';
          dupBtn.className = 'lib-mini-icon-btn accent';
          dupBtn.textContent = '⧉';
          dupBtn.title = fam.builtIn ? 'Duplicar mestre padrão para editar' : 'Duplicar família';
          dupBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDuplicateFamily(fam.id);
          });
          rowActions.appendChild(dupBtn);

          if (!fam.builtIn && !fam.protected) {
            const renBtn = document.createElement('button');
            renBtn.type = 'button';
            renBtn.className = 'lib-mini-icon-btn';
            renBtn.textContent = '✎';
            renBtn.title = 'Renomear família';
            renBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              uiState.editingFamilyId = fam.id;
              renderLibraryManagerTree();
            });

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'lib-mini-icon-btn danger';
            delBtn.textContent = '×';
            delBtn.title = 'Excluir família customizada';
            delBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              handleDeleteFamily(fam.id);
            });

            rowActions.appendChild(renBtn);
            rowActions.appendChild(delBtn);
          }

          row.appendChild(thumbWrap);
          row.appendChild(infoWrap);
          row.appendChild(rowActions);
          listEl.appendChild(row);
        });

        groupWrap.appendChild(listEl);
      }

      container.appendChild(groupWrap);
    });
  }

  function refresh() {
    if (typeof document === 'undefined') return;
    ensureValidSelection();
    renderTopBarControls();
    renderLeftPaneState();
    renderD4LivePanel();
    renderLibraryManagerTree();
  }

  // ==========================================================================
  // Viewport Master & Ghost Neighbors Canvas Renderer
  // ==========================================================================

  function renderViewport(p, studioState) {
    const { reg, d4, vr } = resolveDeps();
    if (!p || !studioState || !reg) return;

    const W = studioState.width || p.width || 800;
    const H = studioState.height || p.height || 800;
    const fam = ensureValidSelection();
    const famDoc = getSelectedFamilyDoc();

    // Subtle studio backdrop around the subtile preview grid
    p.background(20, 22, 27);

    if (!fam || !famDoc) return;

    const selectedTransform = (fam.variantTransforms && fam.variantTransforms[uiState.selectedVariantIndex]) || 'id';
    const layout = computePreviewCells(uiState.previewMode, selectedTransform);

    const maxSpan = Math.max(layout.rows, layout.cols, 1);
    const fillFactor = maxSpan === 1 ? 0.72 : (maxSpan === 2 ? 0.78 : 0.84);
    const totalSide = Math.min(W, H) * fillFactor;
    const cellSide = totalSide / maxSpan;
    const gridW = cellSide * layout.cols;
    const gridH = cellSide * layout.rows;
    const startX = (W - gridW) / 2;
    const startY = (H - gridH) / 2;
    const padPx = cellSide * (studioState.paddingRatio || 0);

    // Artboard surface fill using user's BG color
    p.push();
    p.noStroke();
    p.fill(studioState.bgColor || '#0c0c0e');
    p.rect(startX, startY, gridW, gridH);
    p.pop();

    const fgBase = p.color(studioState.fgColor || '#e2e0dc');
    let fgGhost;
    if (typeof p.red === 'function' && typeof p.green === 'function' && typeof p.blue === 'function') {
      fgGhost = p.color(p.red(fgBase), p.green(fgBase), p.blue(fgBase), 84);
    } else {
      const hex = String(studioState.fgColor || '#e2e0dc').replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16) || 226;
      const g = parseInt(hex.slice(2, 4), 16) || 224;
      const b = parseInt(hex.slice(4, 6), 16) || 220;
      fgGhost = p.color(r, g, b, 84);
    }

    let masterRect = null;

    // Render each preview cell
    for (const cell of layout.cells) {
      const cx = startX + (cell.col + 0.5) * cellSide;
      const cy = startY + (cell.row + 0.5) * cellSide;

      if (cell.isMaster) {
        masterRect = { cx, cy, side: cellSide };
      }

      if (!fam.isCanonicalEmpty && vr && typeof vr.renderNormalizedShapes === 'function') {
        const visibleShapes = (famDoc.shapes || []).filter((s) => s && s.visible !== false);
        p.push();
        p.translate(cx, cy);
        if (d4 && typeof d4.applyD4ToContext === 'function') {
          d4.applyD4ToContext(p, cell.transform);
        }
        vr.renderNormalizedShapes(
          p,
          visibleShapes,
          cellSide,
          cellSide,
          padPx,
          cell.ghost ? fgGhost : fgBase,
          Boolean(famDoc.clipToTile)
        );
        p.pop();
      }
    }

    // Subtle cell borders for multi-cell previews
    p.push();
    p.noFill();
    p.stroke(120, 135, 160, 55);
    p.strokeWeight(1);
    for (let r = 0; r <= layout.rows; r++) {
      const y = startY + r * cellSide;
      p.line(startX, y, startX + gridW, y);
    }
    for (let c = 0; c <= layout.cols; c++) {
      const x = startX + c * cellSide;
      p.line(x, startY, x, startY + gridH);
    }
    p.pop();

    uiState.lastMasterCellRect = masterRect;

    // Guides & overlays on the active master cell
    if (masterRect) {
      const { cx, cy, side } = masterRect;
      const half = side / 2;
      const innerSide = Math.max(0, side - padPx * 2);
      const innerHalf = innerSide / 2;

      p.push();
      p.translate(cx, cy);
      p.noFill();

      // 1. Subtile Normalized Grid (1/6 & 1/4 divisions inside drawable area)
      if (uiState.guides.showGrid && innerSide > 12) {
        p.stroke(148, 163, 184, 34);
        p.strokeWeight(0.8);
        for (let k = -2; k <= 2; k++) {
          if (k === 0) continue;
          const pos6 = (k / 6) * innerSide;
          p.line(pos6, -innerHalf, pos6, innerHalf);
          p.line(-innerHalf, pos6, innerHalf, pos6);
        }
        p.stroke(56, 189, 248, 45);
        for (const frac of [-1 / 6, 1 / 6]) {
          const pos3 = frac * innerSide;
          p.line(pos3, -innerHalf, pos3, innerHalf);
          p.line(-innerHalf, pos3, innerHalf, pos3);
        }
      }

      // 2. Padding margin inner frame
      if (uiState.guides.showPadding && padPx > 0.5) {
        p.stroke(245, 158, 11, 120);
        p.strokeWeight(1);
        if (p.drawingContext && typeof p.drawingContext.setLineDash === 'function') {
          p.drawingContext.setLineDash([4, 4]);
        }
        p.rect(-innerHalf, -innerHalf, innerSide, innerSide);
        if (p.drawingContext && typeof p.drawingContext.setLineDash === 'function') {
          p.drawingContext.setLineDash([]);
        }
      }

      // 3. D4 Symmetry Axes (Orthogonal + Diagonals)
      if (uiState.guides.showAxes) {
        if (p.drawingContext && typeof p.drawingContext.setLineDash === 'function') {
          p.drawingContext.setLineDash([5, 4]);
        }
        p.stroke(96, 165, 250, 125);
        p.strokeWeight(1);
        p.line(0, -half, 0, half);
        p.line(-half, 0, half, 0);

        p.stroke(192, 132, 252, 105);
        p.line(-half, -half, half, half);
        p.line(-half, half, half, -half);

        if (p.drawingContext && typeof p.drawingContext.setLineDash === 'function') {
          p.drawingContext.setLineDash([]);
        }
      }

      // 4. Edge Port Ticks (1/3 Ribbon Ports at ±1/6 and Center Port at 0)
      if (uiState.guides.showPorts && innerSide > 20) {
        const tickLen = Math.max(4, Math.min(9, side * 0.035));
        const portOffsets = [-1 / 6, 0, 1 / 6];
        for (const off of portOffsets) {
          const d = off * innerSide;
          const isCenter = off === 0;
          p.stroke(isCenter ? p.color(52, 211, 153, 210) : p.color(56, 189, 248, 210));
          p.strokeWeight(isCenter ? 2 : 1.6);
          // Top & Bottom edges
          p.line(d, -innerHalf - tickLen * 0.5, d, -innerHalf + tickLen * 0.5);
          p.line(d, innerHalf - tickLen * 0.5, d, innerHalf + tickLen * 0.5);
          // Left & Right edges
          p.line(-innerHalf - tickLen * 0.5, d, -innerHalf + tickLen * 0.5, d);
          p.line(innerHalf - tickLen * 0.5, d, innerHalf + tickLen * 0.5, d);
        }
      }

      // 5. Crisp Master Cell Highlight Frame
      p.stroke(59, 130, 246, 220);
      p.strokeWeight(1.6);
      p.rect(-half, -half, side, side);

      p.pop();
    }
  }

  function handleViewportMouseMoved(mx, my, studioState) {
    if (!isTilesMode(studioState) || !uiState.lastMasterCellRect) return false;
    const scale = (studioState.zoomPercent || 100) / 100;
    const lx = mx / scale;
    const ly = my / scale;
    const { cx, cy, side } = uiState.lastMasterCellRect;
    const half = side / 2;

    if (lx >= cx - half && lx <= cx + half && ly >= cy - half && ly <= cy + half) {
      const nx = (lx - cx) / Math.max(1, side);
      const ny = (ly - cy) / Math.max(1, side);
      uiState.hoverNorm = { nx, ny };
    } else {
      uiState.hoverNorm = null;
    }

    if (hostCtx && typeof hostCtx.updateStatusBar === 'function') {
      hostCtx.updateStatusBar();
    }
    return false;
  }

  function getStatusBarTexts(studioState) {
    const { reg } = resolveDeps();
    const fam = ensureValidSelection();
    if (!fam || !reg) {
      return {
        artboard: 'Prancheta [-0.5, +0.5]',
        grid: 'Biblioteca D4',
        hover: 'Selecione ou crie um subtile no painel lateral'
      };
    }

    const activeTileId = fam.tileIds[uiState.selectedVariantIndex] ?? fam.tileIds[0];
    const repKey = (fam.variantTransforms && fam.variantTransforms[uiState.selectedVariantIndex]) || 'id';
    const previewLabels = {
      single: '1×1 Mestre',
      neighbors_3x3: '3×3 Vizinhos',
      mandala_d4: 'Bloco Espelhos 2×2',
      rotational_c4: 'Bloco Giro C4 2×2'
    };

    const artboard = `Subtile [-0.5, +0.5] (${studioState.zoomPercent || 100}%)`;
    const grid = `${fam.name} • #${activeTileId} (${repKey}) • ${fam.tileIds.length}v • ${previewLabels[uiState.previewMode] || ''}`;

    let hover;
    if (uiState.hoverNorm) {
      const xStr = uiState.hoverNorm.nx >= 0 ? `+${uiState.hoverNorm.nx.toFixed(3)}` : uiState.hoverNorm.nx.toFixed(3);
      const yStr = uiState.hoverNorm.ny >= 0 ? `+${uiState.hoverNorm.ny.toFixed(3)}` : uiState.hoverNorm.ny.toFixed(3);
      hover = `Coordenada Normalizada: <strong>(${xStr}, ${yStr})</strong> • Duplo-clique numa variante D4 para pintar no Mosaico`;
    } else if (fam.builtIn) {
      hover = `Mestre padrão protegido (slots 0..84) • Clique em <strong>Duplicar p/ Editar</strong> para criar versão customizada`;
    } else {
      hover = `Família customizada editável • Arraste grupos/famílias à direita para organizar ou exporte em <strong>.json</strong>`;
    }

    return { artboard, grid, hover };
  }

  // ==========================================================================
  // Event Binding & Initialization
  // ==========================================================================

  function init(ctx) {
    hostCtx = ctx;
    if (typeof document === 'undefined' || uiState.initialized) {
      syncModeDOM();
      refresh();
      return;
    }
    uiState.initialized = true;

    const { store } = resolveDeps();

    // Mode toggle buttons
    document.getElementById('btnStudioTilesMode')?.addEventListener('click', () => {
      toggleTilesStudio();
    });
    document.getElementById('btnSwatchesManageTiles')?.addEventListener('click', () => {
      openTilesStudio();
    });

    // Top bar controls in Tiles Mode
    document.getElementById('btnTileTopDuplicate')?.addEventListener('click', () => {
      handleDuplicateFamily(uiState.selectedFamilyId);
    });

    document.querySelectorAll('#tilePreviewModeGroup [data-tile-preview]').forEach((btn) => {
      btn.addEventListener('click', () => {
        uiState.previewMode = btn.dataset.tilePreview || 'neighbors_3x3';
        renderTopBarControls();
        if (hostCtx && typeof hostCtx.updateStatusBar === 'function') {
          hostCtx.updateStatusBar();
        }
        requestHostRedraw();
      });
    });

    document.getElementById('btnTileClipToggle')?.addEventListener('click', () => {
      const fam = getSelectedFamilyMeta();
      const famDoc = getSelectedFamilyDoc();
      if (!fam || !famDoc || fam.builtIn || fam.protected || !store) return;
      store.updateFamily(fam.id, { clipToTile: !famDoc.clipToTile });
      refresh();
      requestHostRedraw();
    });

    document.getElementById('btnTileTestInMosaic')?.addEventListener('click', () => {
      const fam = ensureValidSelection();
      if (!fam) return;
      const tid = fam.tileIds[uiState.selectedVariantIndex] ?? fam.tileIds[0];
      closeTilesStudio({ paintWithTileId: tid });
    });

    // Left rail quick actions & guide toggles in Tiles Mode
    document.getElementById('btnRailNewSubtile')?.addEventListener('click', () => handleCreateFamily());
    document.getElementById('btnRailDuplicateSubtile')?.addEventListener('click', () => handleDuplicateFamily(uiState.selectedFamilyId));
    document.getElementById('btnRailNewGroup')?.addEventListener('click', () => handleCreateGroup());

    const bindTileGuide = (btnId, guideKey) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        uiState.guides[guideKey] = !uiState.guides[guideKey];
        renderLeftPaneState();
        requestHostRedraw();
      });
    };
    bindTileGuide('toggleTileGuideGrid', 'showGrid');
    bindTileGuide('toggleTileGuideAxes', 'showAxes');
    bindTileGuide('toggleTileGuidePorts', 'showPorts');
    bindTileGuide('toggleTileGuidePadding', 'showPadding');

    document.getElementById('btnTileViewPan')?.addEventListener('click', () => {
      if (hostCtx && typeof hostCtx.setActiveTool === 'function') {
        hostCtx.setActiveTool('pan');
      }
    });
    document.getElementById('btnTileViewReset')?.addEventListener('click', () => {
      if (typeof window !== 'undefined' && typeof window.resetZoom100 === 'function') {
        window.resetZoom100();
      }
    });

    // Backup JSON Export / Import / Reset
    const exportFull = () => {
      if (!store) return;
      const stamp = new Date().toISOString().slice(0, 10);
      triggerDownloadJSON(`tiling_stripes_library_${stamp}.json`, store.exportLibraryJSON({ customOnly: false }));
      notifyToast('Biblioteca completa exportada em JSON.');
    };
    const exportCustomOnly = () => {
      if (!store) return;
      const stamp = new Date().toISOString().slice(0, 10);
      triggerDownloadJSON(`tiling_stripes_custom_subtiles_${stamp}.json`, store.exportLibraryJSON({ customOnly: true }));
      notifyToast('Pacote de subtiles customizados exportado em JSON.');
    };

    document.getElementById('btnExportLibraryJson')?.addEventListener('click', exportFull);
    document.getElementById('btnLibMgrExportCustom')?.addEventListener('click', exportCustomOnly);

    const fileInput = document.getElementById('libraryJsonFileInput');
    document.getElementById('btnImportLibraryJson')?.addEventListener('click', () => {
      if (fileInput) {
        fileInput.value = '';
        fileInput.click();
      }
    });
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        openImportModal(file.name, String(reader.result || ''));
      };
      reader.onerror = () => {
        notifyToast('Erro ao ler o arquivo selecionado.', 'error');
      };
      reader.readAsText(file);
    });

    document.getElementById('btnResetLibraryDefaults')?.addEventListener('click', handleResetLibraryDefaults);

    // D4 Live Panel inline metadata controls
    document.getElementById('btnNoticeDuplicateToEdit')?.addEventListener('click', () => {
      handleDuplicateFamily(uiState.selectedFamilyId);
    });

    const activeNameInput = document.getElementById('tileActiveFamilyNameInput');
    activeNameInput?.addEventListener('change', () => {
      const fam = getSelectedFamilyMeta();
      if (!fam || fam.builtIn || fam.protected || !store) return;
      const next = activeNameInput.value.trim();
      if (next && next !== fam.name) {
        store.updateFamily(fam.id, { name: next });
        refresh();
      } else {
        activeNameInput.value = fam.name;
      }
    });

    const activeGroupSelect = document.getElementById('tileActiveFamilyGroupSelect');
    activeGroupSelect?.addEventListener('change', () => {
      const fam = getSelectedFamilyMeta();
      if (!fam || fam.protected || !store) return;
      const nextGrp = activeGroupSelect.value;
      if (nextGrp && nextGrp !== fam.groupId) {
        moveFamilyToGroupAt(fam.id, nextGrp, null);
        notifyToast(`"${fam.name}" movida para o grupo selecionado.`);
      }
    });

    document.getElementById('btnUseActiveInBrush')?.addEventListener('click', () => {
      const fam = ensureValidSelection();
      if (!fam) return;
      const tid = fam.tileIds[uiState.selectedVariantIndex] ?? fam.tileIds[0];
      closeTilesStudio({ paintWithTileId: tid });
    });

    document.getElementById('btnSoloActiveInMosaic')?.addEventListener('click', () => {
      const fam = ensureValidSelection();
      if (!fam || !hostCtx || !hostCtx.studioState) return;
      hostCtx.studioState.allowedTiles.clear();
      fam.tileIds.forEach((id) => hostCtx.studioState.allowedTiles.add(id));
      if (typeof hostCtx.renderSwatchesPanel === 'function') hostCtx.renderSwatchesPanel();
      if (typeof hostCtx.regenerateMosaic === 'function') hostCtx.regenerateMosaic(true);
      if (typeof hostCtx.setActiveTool === 'function') hostCtx.setActiveTool('inspect');
      closeTilesStudio();
      notifyToast(`Família "${fam.name}" isolada (SOLO) no mosaico.`);
    });

    // Library Manager Toolbar
    document.getElementById('libMgrSearchInput')?.addEventListener('input', (e) => {
      uiState.searchQuery = e.target.value || '';
      renderLibraryManagerTree();
    });

    document.querySelectorAll('#libMgrFilterControl [data-lib-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        uiState.filterMode = btn.dataset.libFilter || 'all';
        renderLibraryManagerTree();
      });
    });

    document.getElementById('btnLibMgrNewFamily')?.addEventListener('click', () => handleCreateFamily());
    document.getElementById('btnLibMgrNewGroup')?.addEventListener('click', () => handleCreateGroup());

    // Confirm & Import Modal Buttons
    document.getElementById('btnSubtileConfirmCancel')?.addEventListener('click', () => closeConfirmModal(false));
    document.getElementById('btnSubtileConfirmOk')?.addEventListener('click', () => closeConfirmModal(true));
    document.getElementById('subtileConfirmDialog')?.addEventListener('click', (e) => {
      if (e.target.id === 'subtileConfirmDialog') closeConfirmModal(false);
    });

    document.getElementById('btnSubtileImportCancel')?.addEventListener('click', () => closeImportModal(false));
    document.getElementById('btnSubtileImportConfirm')?.addEventListener('click', () => closeImportModal(true));
    document.getElementById('subtileImportDialog')?.addEventListener('click', (e) => {
      if (e.target.id === 'subtileImportDialog') closeImportModal(false);
    });

    document.querySelectorAll('input[name="subtileImportMode"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const conflictRow = document.getElementById('subtileImportConflictRow');
        if (conflictRow) {
          conflictRow.classList.toggle('hidden', radio.value === 'replace' && radio.checked);
        }
      });
    });

    syncModeDOM();
    refresh();
  }

  /**
   * Handles keyboard shortcuts when `StudioState.studioMode === 'tiles'`.
   * Returns `true` if the event was handled or suppressed to protect Mosaic state.
   */
  function handleKeyDown(e, studioState) {
    if (typeof document !== 'undefined') {
      const confirmDlg = document.getElementById('subtileConfirmDialog');
      if (e.key === 'Escape' && confirmDlg && !confirmDlg.classList.contains('hidden')) {
        e.preventDefault();
        closeConfirmModal(false);
        return true;
      }
      const importDlg = document.getElementById('subtileImportDialog');
      if (e.key === 'Escape' && importDlg && !importDlg.classList.contains('hidden')) {
        e.preventDefault();
        closeImportModal(false);
        return true;
      }
    }

    // Global Ctrl+E toggles between Mosaic and Subtile Studio from anywhere (outside inputs)
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      toggleTilesStudio();
      return true;
    }

    if (!isTilesMode(studioState)) {
      return false;
    }

    // Inside Tiles Studio Mode: allow viewport pan/zoom & Escape, isolate Mosaic-mutating shortcuts!
    if (e.key === 'Escape') {
      e.preventDefault();
      closeTilesStudio();
      return true;
    }

    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === '1' || k === '0') {
        return false; // Let sketch.js handle zoom 100% / fit to window
      }
      if (k === 'd') {
        e.preventDefault();
        handleDuplicateFamily(uiState.selectedFamilyId);
        return true;
      }
      // Block Mosaic Ctrl+Z / Ctrl+Y / Ctrl+U while in Tiles Studio (Fase C wires VectorEditor Undo/Redo here)
      if (k === 'z' || k === 'y' || k === 'u') {
        e.preventDefault();
        return true;
      }
      return false;
    }

    if (e.code === 'Space') {
      return false; // Let sketch.js handle Spacebar pan
    }

    const k = e.key.toLowerCase();
    // Allow H (pan), Z (zoom), 0 (fit), 1 (100%) to pass through to sketch.js viewport helpers
    if (k === 'h' || k === 'z' || k === '0' || k === '1' || e.code === 'Digit0' || e.code === 'Digit1') {
      return false;
    }

    // Cycle variants within the selected family with [ and ]
    if (e.key === '[' || e.key === ']') {
      e.preventDefault();
      const fam = ensureValidSelection();
      if (fam && fam.tileIds.length > 1) {
        const step = e.key === ']' ? 1 : -1;
        uiState.selectedVariantIndex = (uiState.selectedVariantIndex + step + fam.tileIds.length) % fam.tileIds.length;
        renderTopBarControls();
        renderD4LivePanel();
        if (hostCtx && typeof hostCtx.updateStatusBar === 'function') hostCtx.updateStatusBar();
        requestHostRedraw();
      }
      return true;
    }

    // Suppress Mosaic-only single-key shortcuts (G, B, E, F, R, S, V, Q, Tab, ArrowLeft/Right, Delete)
    return true;
  }

  const SubtileStudioUI = {
    state: uiState,
    init,
    refresh,
    isTilesMode,
    openTilesStudio,
    closeTilesStudio,
    toggleTilesStudio,
    selectFamily,
    renderViewport,
    handleViewportMouseMoved,
    getStatusBarTexts,
    handleKeyDown,
    // Pure / headless helpers exported for unit & contract tests
    moveItemInArray,
    countFamilyUsageInMosaic,
    inspectImportPayload,
    syncStudioStateWithLibraryEvent,
    computePreviewCells
  };

  if (typeof window !== 'undefined') {
    window.SubtileStudioUI = SubtileStudioUI;
  }
  if (typeof global !== 'undefined' && global.window) {
    global.window.SubtileStudioUI = SubtileStudioUI;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubtileStudioUI;
  }
})();

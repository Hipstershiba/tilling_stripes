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
    let ve = win && win.VectorEditor;
    let vb = win && win.VectorBoolean;

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
      if (!ve) ve = require('./vector_editor.js');
      if (!vb) vb = require('./vector_boolean.js');
    }

    return { win, d4, vr, det, lib, compiler, store, reg, ve, vb };
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
    previewMode: 'single', // 'single' | 'neighbors_3x3' | 'mandala_d4' | 'rotational_c4'
    inspectorPanel: 'layers',
    libraryGroupFilter: '',
    searchQuery: '',
    filterMode: 'all', // 'all' | 'custom' | 'builtin'
    collapsedGroups: new Set(),
    editingGroupId: null,
    editingFamilyId: null,
    editingLayerId: null,
    dragState: null, // { kind: 'group' | 'family' | 'layer', id: string, groupId?: string }
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
        labelEl.textContent = inTiles ? 'Voltar ao mosaico' : 'Subtiles';
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
    if (!isTilesMode()) uiState.previousMosaicTool = hostCtx.studioState.activeTool;
    hostCtx.studioState.studioMode = 'tiles';
    hostCtx.setActiveTool?.('inspect');

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
    hostCtx.setActiveTool?.(uiState.previousMosaicTool || 'inspect');
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
    const { reg, ve } = resolveDeps();
    if (!reg || !reg.getFamilyById(familyId)) return;
    if (ve) ve.resetTransientForFamilySwitch(familyId);
    uiState.selectedFamilyId = familyId;
    uiState.selectedVariantIndex = variantIndex;
    ensureValidSelection();
    refresh();
    requestHostRedraw();
  }

  function syncNavigationState() {
    if (typeof document === 'undefined') return;
    const btnPan = document.getElementById('btnTileViewPan');
    const panActive = hostCtx?.studioState?.activeTool === 'pan';
    btnPan?.classList.toggle('active', panActive);
    btnPan?.setAttribute('aria-pressed', String(panActive));

    const btnZoom = document.getElementById('btnTileViewZoom');
    const zoomActive = hostCtx?.studioState?.activeTool === 'zoom';
    btnZoom?.classList.toggle('active', zoomActive);
    btnZoom?.setAttribute('aria-pressed', String(zoomActive));
  }

  function setVectorTool(toolId) {
    const { ve } = resolveDeps();
    if (!ve) return;
    const famDoc = getSelectedFamilyDoc();
    if (ve.state.penSession && toolId !== 'pen' && famDoc && !famDoc.builtIn) {
      const committed = ve.finalizePenPath(famDoc, false);
      if (committed) {
        commitFamilyShapes(famDoc.id, committed);
      }
    }
    if (isTilesMode()) hostCtx.setActiveTool?.('inspect');
    ve.state.activeTool = toolId;
    syncNavigationState();
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.vecTool = toolId;
    }
    renderLeftPaneState();
    renderShapePropsPanel(true);
    if (hostCtx && typeof hostCtx.updateStatusBar === 'function') {
      hostCtx.updateStatusBar();
    }
    requestHostRedraw();
  }

  function commitFamilyShapes(familyId, nextShapes, options = {}) {
    const { store, ve } = resolveDeps();
    if (!store || !familyId || !Array.isArray(nextShapes)) return false;
    const currentDoc = store.getFamilyById(familyId);
    if (!currentDoc || currentDoc.builtIn || currentDoc.protected) return false;

    if (ve) {
      ve.ensureFamilyHistory(familyId, currentDoc);
    }

    const patch = { shapes: nextShapes };
    if (options.clipToTile !== undefined) {
      patch.clipToTile = Boolean(options.clipToTile);
    }
    const res = store.updateFamily(familyId, patch);
    if (ve && options.recordUndo !== false && res && res.family) {
      ve.recordFamilySnapshot(familyId, res.family.shapes, res.family.clipToTile);
    }
    refresh();
    requestHostRedraw();
    return true;
  }

  function handleVecUndo() {
    const { store, ve } = resolveDeps();
    const famDoc = getSelectedFamilyDoc();
    if (!store || !ve || !famDoc || famDoc.builtIn || famDoc.protected) return false;
    const snap = ve.stepUndo(famDoc.id, famDoc);
    if (!snap) return false;

    store.updateFamily(famDoc.id, {
      shapes: snap.shapes,
      clipToTile: Boolean(snap.clipToTile)
    });
    const validIds = new Set((snap.shapes || []).map((s) => s.id));
    ve.state.selectedShapeIds = ve.state.selectedShapeIds.filter((id) => validIds.has(id));
    ve.state.selectedNodes = [];
    refresh();
    requestHostRedraw();
    return true;
  }

  function handleVecRedo() {
    const { store, ve } = resolveDeps();
    const famDoc = getSelectedFamilyDoc();
    if (!store || !ve || !famDoc || famDoc.builtIn || famDoc.protected) return false;
    const snap = ve.stepRedo(famDoc.id, famDoc);
    if (!snap) return false;

    store.updateFamily(famDoc.id, {
      shapes: snap.shapes,
      clipToTile: Boolean(snap.clipToTile)
    });
    const validIds = new Set((snap.shapes || []).map((s) => s.id));
    ve.state.selectedShapeIds = ve.state.selectedShapeIds.filter((id) => validIds.has(id));
    ve.state.selectedNodes = [];
    refresh();
    requestHostRedraw();
    return true;
  }

  // ==========================================================================
  // Confirmation & Import Modals (Non-blocking Accessible Dialogs)
  // ==========================================================================

  const modalFocus = new Map();
  function enterModal(dialog, cancel = () => {
    if (dialog.id === 'subtileImportDialog') closeImportModal(false);
    else closeConfirmModal(false);
  }, origin = document.activeElement) {
    if (modalFocus.has(dialog)) return;
    const blocked = [];
    for (let branch = dialog; branch.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch) { blocked.push([sibling, sibling.inert]); sibling.inert = true; }
      }
    }
    modalFocus.set(dialog, {origin, blocked, cancel, previousKeydown: dialog.onkeydown});
    dialog.onkeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        cancel();
      } else if (e.key === 'Tab') {
        const items = Array.from(dialog.querySelectorAll('button, input, select, textarea, [tabindex="0"]'))
          .filter(el => !el.disabled && !el.closest('.hidden') && !el.hidden && !el.inert && el.getClientRects().length > 0);
        const first = items[0], last = items[items.length - 1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    };
  }
  function leaveModal(dialog) {
    const record = modalFocus.get(dialog);
    modalFocus.delete(dialog);
    if (record) dialog.onkeydown = record.previousKeydown;
    record?.blocked.forEach(([el, inert]) => { el.inert = inert; });
    if (record?.origin?.isConnected) record.origin.focus();
  }
  if (typeof window !== 'undefined') window.StudioModal = {
    enter: enterModal, leave: leaveModal,
    isOpen: () => modalFocus.size > 0,
    cancel: () => Array.from(modalFocus.values()).at(-1)?.cancel()
  };

  function backupLibrary() {
    const { store } = resolveDeps();
    triggerDownloadJSON(`library-${Date.now()}.tiles-backup.json`, store.exportLibraryJSON());
  }

  function openConfirmModal({ title, descriptionHTML, confirmLabel = 'Confirmar', danger = false, offerBackup = false, onConfirm }) {
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

    const backupOption = document.getElementById('subtileConfirmBackupOption');
    const backupCheck = document.getElementById('subtileConfirmBackup');
    backupOption?.classList.toggle('hidden', !offerBackup);
    if (backupCheck) backupCheck.checked = false;
    uiState.pendingConfirmAction = () => {
      if (offerBackup && backupCheck?.checked) backupLibrary();
      if (typeof onConfirm === 'function') onConfirm();
    };
    enterModal(dialog);
    dialog.classList.remove('hidden');
    cancelBtn?.focus();
  }

  function closeConfirmModal(confirmed) {
    if (typeof document === 'undefined') return;
    const dialog = document.getElementById('subtileConfirmDialog');
    dialog?.classList.add('hidden');
    if (dialog) leaveModal(dialog);
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

    enterModal(dialog);
    dialog.classList.remove('hidden');
    const merge = document.querySelector('input[name="subtileImportMode"][value="merge"]');
    if (merge) merge.checked = true;
    document.getElementById('btnSubtileImportCancel')?.focus();
  }

  function closeImportModal(confirmed) {
    if (typeof document === 'undefined') return;
    const dialog = document.getElementById('subtileImportDialog');
    dialog?.classList.add('hidden');
    if (dialog) leaveModal(dialog);

    const pending = uiState.pendingImportData;
    uiState.pendingImportData = null;
    if (!confirmed || !pending) return;

    const { store } = resolveDeps();
    if (!store) return;

    const modeRadio = document.querySelector('input[name="subtileImportMode"]:checked');
    const conflictSelect = document.getElementById('subtileImportConflictSelect');
    const mode = modeRadio ? modeRadio.value : 'merge';
    const conflictPolicy = conflictSelect ? conflictSelect.value : 'overwrite';

    const applyImport = () => {
    try {
      backupLibrary();
      const evt = store.importLibraryJSON(pending.rawJsonText, { mode, conflictPolicy });
      revealLibraryItems();
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
    };
    if (mode === 'replace') {
      openConfirmModal({ title: 'Substituir biblioteca?',
        descriptionHTML: 'As famílias customizadas atuais serão removidas e suas células passarão para #84. Um backup JSON será baixado antes da substituição.',
        confirmLabel: 'Substituir', danger: true, onConfirm: applyImport });
    } else applyImport();
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

  function triggerDownloadSVG(filename, svgString) {
    if (typeof document === 'undefined') return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleExportSubtileSvg(customOptions = {}) {
    const { vb } = resolveDeps();
    const fam = ensureValidSelection();
    const famDoc = getSelectedFamilyDoc();
    if (!vb || !fam || !famDoc) return '';

    const selectedTransform = customOptions.transform ||
      (fam.variantTransforms && fam.variantTransforms[uiState.selectedVariantIndex]) ||
      'id';
    const st = hostCtx && hostCtx.studioState ? hostCtx.studioState : null;
    const svgStr = vb.exportFamilyToSVG(famDoc, {
      size: customOptions.size || 1000,
      transform: selectedTransform,
      fgColor: customOptions.fgColor || (st && st.fgColor) || '#111827',
      bgColor: customOptions.bgColor || (st && st.bgColor) || '#ffffff',
      includeBackground: Boolean(customOptions.includeBackground),
      paddingRatio: customOptions.paddingRatio !== undefined
        ? customOptions.paddingRatio
        : 0
    });

    if (!svgStr) {
      notifyToast('Não foi possível gerar o SVG deste subtile.', 'error');
      return '';
    }

    if (customOptions.download !== false && typeof document !== 'undefined') {
      const slug = String(fam.name || fam.id || 'subtile')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'subtile';
      const suffix = selectedTransform !== 'id' ? `_${selectedTransform}` : '';
      triggerDownloadSVG(`${slug}${suffix}.svg`, svgStr);
      notifyToast(`SVG exportado: ${slug}${suffix}.svg`);
    }

    return svgStr;
  }

  function handleImportSvgText(svgText, sourceFileName = 'subtile.svg', options = {}) {
    const { store, ve, vb } = resolveDeps();
    if (!vb || !store) {
      return { ok: false, error: 'Módulo vetorial indisponível.' };
    }

    const parsed = vb.importSVGToShapes(svgText, options);
    if (!parsed.ok) {
      notifyToast(parsed.error || 'Falha ao importar SVG.', 'error');
      return parsed;
    }

    const fam = getSelectedFamilyMeta();
    const famDoc = getSelectedFamilyDoc();
    const cleanFileBase = String(sourceFileName || 'SVG Importado')
      .replace(/\.svg$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .slice(0, 44) || 'SVG Importado';

    // When a built-in / protected master is selected, automatically create an editable custom family
    if (!famDoc || famDoc.builtIn || famDoc.protected || options.asNewFamily) {
      const targetGrp = fam && !fam.builtIn ? fam.groupId : undefined;
      const created = store.createFamily({
        name: cleanFileBase,
        groupId: targetGrp,
        shapes: parsed.shapes
      });
      if (ve) {
        ve.resetTransientForFamilySwitch(created.family.id);
        ve.ensureFamilyHistory(created.family.id, created.family);
        ve.state.selectedShapeIds = (created.family.shapes || []).map((s) => s.id);
        ve.state.selectedNodes = [];
      }
      uiState.selectedFamilyId = created.family.id;
      uiState.selectedVariantIndex = 0;
      uiState.collapsedGroups.delete(created.family.groupId);
      if (uiState.filterMode === 'builtin') {
        uiState.filterMode = 'all';
      }
      refresh();
      requestHostRedraw();
      notifyToast(`Novo subtile "${created.family.name}" criado a partir do SVG (${parsed.shapes.length} formas).`);
      return {
        ok: true,
        createdNewFamily: true,
        familyId: created.family.id,
        importedCount: parsed.shapes.length,
        shapes: created.family.shapes
      };
    }

    // Otherwise append imported shapes onto the active custom family
    const nextShapes = [
      ...(famDoc.shapes || []).map((s) => JSON.parse(JSON.stringify(s))),
      ...parsed.shapes
    ];
    if (ve) {
      ve.state.selectedShapeIds = parsed.shapes.map((s) => s.id);
      ve.state.selectedNodes = [];
    }
    commitFamilyShapes(famDoc.id, nextShapes);
    notifyToast(`${parsed.shapes.length} ${parsed.shapes.length === 1 ? 'forma importada' : 'formas importadas'} do SVG.`);
    return {
      ok: true,
      createdNewFamily: false,
      familyId: famDoc.id,
      importedCount: parsed.shapes.length,
      shapes: parsed.shapes
    };
  }

  // ==========================================================================
  // CRUD Actions (Groups & Families)
  // ==========================================================================

  function revealLibraryItems() {
    setInspectorPanel('library');
    uiState.libraryGroupFilter = '';
    uiState.searchQuery = '';
    uiState.filterMode = 'all';
    uiState.collapsedGroups.clear();
    if (typeof document !== 'undefined') {
      const search = document.getElementById('libMgrSearchInput');
      if (search) search.value = '';
    }
  }

  function handleCreateGroup() {
    revealLibraryItems();
    const { store } = resolveDeps();
    if (!store) return;
    const created = store.createGroup('Novo Conjunto');
    uiState.collapsedGroups.delete(created.id);
    uiState.editingGroupId = created.id;
    refresh();
    notifyToast(`Conjunto "${created.name}" criado.`);
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
    revealLibraryItems();
    const { store } = resolveDeps();
    if (!store) return;
    const curFam = getSelectedFamilyMeta();
    const targetGrp = preferredGroupId ||
      (curFam && !curFam.builtIn ? curFam.groupId : null);

    const res = store.createFamily({
      name: 'Novo Subtile',
      groupId: targetGrp || undefined
    });

    const { ve } = resolveDeps();
    if (ve) {
      ve.resetTransientForFamilySwitch(res.family.id);
      ve.ensureFamilyHistory(res.family.id, res.family);
      if (res.family.shapes && res.family.shapes[0]) {
        ve.state.selectedShapeIds = [res.family.shapes[0].id];
      }
    }
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
    const { ve } = resolveDeps();
    if (ve) {
      ve.resetTransientForFamilySwitch(res.family.id);
      ve.ensureFamilyHistory(res.family.id, res.family);
      ve.state.selectedShapeIds = res.family.shapes && res.family.shapes[0] ? [res.family.shapes[0].id] : [];
    }
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
      offerBackup: true,
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
    revealLibraryItems();
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
        backupLibrary();
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
    const { ve } = resolveDeps();
    const fam = ensureValidSelection();
    if (!fam) return;

    const famDoc = getSelectedFamilyDoc();
    const badgeEl = document.getElementById('tileStudioActiveBadge');
    const nameEl = document.getElementById('tileStudioActiveName');
    const dupBtn = document.getElementById('btnTileTopDuplicate');
    const clipBtn = document.getElementById('btnTileClipToggle');
    const undoBtn = document.getElementById('btnVecUndo');
    const redoBtn = document.getElementById('btnVecRedo');

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
    if (undoBtn && redoBtn) {
      const editable = Boolean(famDoc && !fam.builtIn && !fam.protected && ve);
      undoBtn.disabled = !editable || !ve.canUndo(fam.id, famDoc);
      redoBtn.disabled = !editable || !ve.canRedo(fam.id, famDoc);
    }
    if (clipBtn) {
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
    const { ve } = resolveDeps();
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

    if (ve) {
      if (document.body) {
        document.body.dataset.vecTool = ve.state.activeTool;
      }
      document.querySelectorAll('#vecToolsGrid [data-vec-tool]').forEach((btn) => {
        const active = btn.dataset.vecTool === ve.state.activeTool;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      const snapBtn = document.getElementById('btnTileSnapToggle');
      if (snapBtn) {
        snapBtn.classList.toggle('active', Boolean(ve.state.snapEnabled));
        snapBtn.setAttribute('aria-pressed', ve.state.snapEnabled ? 'true' : 'false');
      }
      const gridSel = document.getElementById('tileGridDivSelect');
      if (gridSel && String(gridSel.value) !== String(ve.state.gridDiv)) {
        gridSel.value = String(ve.state.gridDiv);
      }
      ve.state.snapPorts = Boolean(uiState.guides.showPorts);
    }
    syncNavigationState();
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
    const groupFilter = document.getElementById('tileLibraryGroupFilter');
    if (groupFilter && document.activeElement !== groupFilter) {
      groupFilter.innerHTML = '';
      const all = document.createElement('option');
      all.value = ''; all.textContent = 'Todos os conjuntos'; groupFilter.appendChild(all);
      grouped.forEach((g) => {
        const opt = document.createElement('option');
        opt.value = g.id; opt.textContent = `${g.name} (${g.families.length})`; groupFilter.appendChild(opt);
      });
      groupFilter.value = uiState.libraryGroupFilter;
    }
    const thumbs = hostCtx && hostCtx.studioState ? hostCtx.studioState.thumbnailCache : null;

    const focusedFamily = document.activeElement?.classList.contains('lib-family-row') ? document.activeElement.dataset.familyId : null;
    const previousScrollTop = container.scrollTop;
    container.innerHTML = '';

    grouped.forEach((grp, grpIdx) => {
      if (uiState.libraryGroupFilter && grp.id !== uiState.libraryGroupFilter) return;
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
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          row.setAttribute('aria-pressed', String(isSelected));
          row.addEventListener('keydown', (e) => {
            if (e.target === row && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault(); selectFamily(fam.id, 0);
            }
          });
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
    if (!container.children.length) {
      const empty = document.createElement('div');
      empty.className = 'vec-empty-hint';
      empty.textContent = 'Nenhuma família corresponde aos filtros. Altere o conjunto, o tipo ou a busca.';
      container.appendChild(empty);
    }
    container.scrollTop = previousScrollTop;
    if (focusedFamily) Array.from(container.querySelectorAll('.lib-family-row')).find(row => row.dataset.familyId === focusedFamily)?.focus({preventScroll: true});
  }

  let lastLiveD4Timestamp = 0;

  function updateLiveDragD4Preview(workingShapes, clipToTile) {
    if (typeof document === 'undefined') return;
    const now = Date.now();
    if (now - lastLiveD4Timestamp < 70) return;
    lastLiveD4Timestamp = now;

    const { det } = resolveDeps();
    if (!det || typeof det.detectMasterD4 !== 'function') return;

    const info = det.detectMasterD4({ shapes: workingShapes || [], clipToTile: Boolean(clipToTile) });
    if (!info) return;

    const countBadge = document.getElementById('tileLiveOrbitCountBadge');
    const orbitLabelEl = document.getElementById('tileLiveOrbitLabel');
    const stabCodeEl = document.getElementById('tileLiveStabilizerCode');
    const compatRow = document.getElementById('tileLiveCompatRow');

    if (countBadge) {
      const n = info.orbitSize;
      countBadge.textContent = `${n} ${n === 1 ? 'variante' : 'variantes'} (ao vivo)`;
    }
    if (orbitLabelEl) {
      orbitLabelEl.textContent = ORBIT_LABELS_PT[info.orbitType] || info.orbitType;
    }
    if (stabCodeEl) {
      const stab = Array.isArray(info.stabilizer) && info.stabilizer.length > 0
        ? info.stabilizer.join(', ')
        : 'id';
      stabCodeEl.textContent = `H = {${stab}}`;
    }
    if (compatRow) {
      const axisOk = Boolean(info.isAxisInvariant);
      const diagOk = Boolean(info.isDiagInvariant);
      const centerOk = info.orbitSize === 1;
      compatRow.innerHTML = `
        <span class="d4-compat-pill ${axisOk ? 'ok' : 'neutral'}">Eixos X/Y: ${axisOk ? 'Sim' : 'Não'}</span>
        <span class="d4-compat-pill ${diagOk ? 'ok' : 'neutral'}">Diagonais: ${diagOk ? 'Sim' : 'Não'}</span>
        <span class="d4-compat-pill ${centerOk ? 'ok' : 'neutral'}">Centro D4: ${centerOk ? 'Sim' : 'Não'}</span>
      `;
    }
  }

  function renderShapePropsPanel(forceRebuild = false) {
    if (typeof document === 'undefined') return;
    const { ve, vb } = resolveDeps();
    const container = document.getElementById('vecPropsContainer');
    const selBadge = document.getElementById('vecSelectionBadge');
    const toolLabelEl = document.getElementById('vecToolContextLabel');
    const snapBadgeEl = document.getElementById('vecSnapStatusBadge');
    if (!container || !ve) return;

    const toolMeta = ve.VECTOR_TOOLS.find((t) => t.id === ve.state.activeTool) || ve.VECTOR_TOOLS[0];
    if (toolLabelEl) {
      toolLabelEl.textContent = `${toolMeta.label} (${toolMeta.shortcut})`;
    }
    if (snapBadgeEl) {
      snapBadgeEl.textContent = ve.state.snapEnabled
        ? (ve.state.gridDiv > 0 ? `Ímã 1/${ve.state.gridDiv}` : 'Ímã Bordas')
        : 'Ímã Off';
    }

    const fam = ensureValidSelection();
    const famDoc = getSelectedFamilyDoc();
    if (!fam || !famDoc) return;

    // Avoid destroying active input focus inside #vecPropsContainer unless forced
    if (!forceRebuild && container.contains(document.activeElement) &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
      return;
    }

    const pathfinder = document.getElementById('tilePathfinderContainer');
    if (pathfinder) pathfinder.innerHTML = '';
    const summary = document.getElementById('tileSelectionSummary');
    if (summary) summary.textContent = fam.builtIn || fam.protected ? 'Família protegida · duplique para editar' : 'Nenhum objeto selecionado';
    const selectAllBtn = document.getElementById('btnTileSelectAll');
    const deselectBtn = document.getElementById('btnTileDeselect');
    if (selectAllBtn) selectAllBtn.disabled = Boolean(fam.builtIn || fam.protected || !(famDoc.shapes || []).some((s) => s && !s.locked && s.visible !== false));
    if (deselectBtn) deselectBtn.disabled = !ve.state.selectedShapeIds.length;

    if (fam.builtIn || fam.protected) {
      if (selBadge) selBadge.textContent = 'Somente Leitura';
      container.innerHTML = `
        <div class="vec-empty-hint">
          Este subtile pertence aos <strong>31 mestres canônicos</strong>. Crie uma cópia editável para desenhar, alinhar e esculpir curvas Bezier.
        </div>
        <button type="button" id="btnPropsDuplicateBuiltIn" class="mini-btn accent" style="width:100%;">
          ⧉ Duplicar p/ Editar (Ctrl+D)
        </button>
      `;
      document.getElementById('btnPropsDuplicateBuiltIn')?.addEventListener('click', () => {
        handleDuplicateFamily(fam.id);
      });
      return;
    }

    const shapes = famDoc.shapes || [];
    const selSet = new Set(ve.state.selectedShapeIds);
    const selected = shapes.filter((s) => s && selSet.has(s.id));
    if (summary && selected.length) summary.textContent = `${selected.length} objeto${selected.length === 1 ? '' : 's'} selecionado${selected.length === 1 ? '' : 's'}`;

    if (selBadge) {
      if (selected.length === 0) {
        selBadge.textContent = `${shapes.length} ${shapes.length === 1 ? 'forma' : 'formas'}`;
      } else if (selected.length === 1) {
        const typeNames = {
          rect: 'Retângulo',
          ellipse: 'Elipse',
          polygon: 'Polígono',
          arc: 'Arco/Fita',
          line: 'Linha',
          path: 'Caminho'
        };
        selBadge.textContent = typeNames[selected[0].type] || selected[0].type;
      } else {
        selBadge.textContent = `${selected.length} selecionadas`;
      }
    }

    container.innerHTML = '';

    // 0. Active Pen Construction Banner
    if (ve.state.penSession && ve.state.penSession.familyId === famDoc.id) {
      const penBlock = document.createElement('div');
      penBlock.className = 'vec-props-subblock';
      const nPts = ve.state.penSession.nodes.length;
      penBlock.innerHTML = `
        <div class="vec-subblock-title">Caneta Ativa (${nPts} ${nPts === 1 ? 'nó' : 'nós'})</div>
        <div class="vec-inline-actions">
          <button type="button" class="mini-btn accent" data-pen-act="close" ${nPts < 3 ? 'disabled' : ''}>Fechar Contorno</button>
          <button type="button" class="mini-btn" data-pen-act="open" ${nPts < 2 ? 'disabled' : ''}>Finalizar Aberto</button>
          <button type="button" class="mini-btn danger" data-pen-act="cancel">Cancelar</button>
        </div>
      `;
      penBlock.querySelectorAll('[data-pen-act]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = btn.dataset.penAct;
          if (act === 'cancel') {
            ve.state.penSession = null;
            ve.state.workingShapes = null;
            ve.state.workingFamilyId = null;
            renderShapePropsPanel(true);
            requestHostRedraw();
            return;
          }
          const committed = ve.finalizePenPath(famDoc, act === 'close');
          if (committed) commitFamilyShapes(famDoc.id, committed);
        });
      });
      container.appendChild(penBlock);
    }

    // 1. Quick 1/3 Ribbon Presets Block
    const presetBlock = document.createElement('details');
    presetBlock.className = 'vec-props-subblock';
    presetBlock.innerHTML = `
      <summary class="vec-subblock-title">Inserir base de fita (1/3)</summary>
      <div class="vec-preset-chips">
        <button type="button" class="vec-preset-btn" data-preset="stripe-h-1-3" title="Adicionar faixa horizontal central de largura 1/3">+ Faixa H 1/3</button>
        <button type="button" class="vec-preset-btn" data-preset="stripe-v-1-3" title="Adicionar faixa vertical central de largura 1/3">+ Faixa V 1/3</button>
        <button type="button" class="vec-preset-btn" data-preset="curve-tl-1-3" title="Adicionar arco anular Truchet 90° de largura 1/3">+ Curva 90° 1/3</button>
        <button type="button" class="vec-preset-btn" data-preset="quarter-pie-tl" title="Adicionar quarto de círculo sólido no canto">+ Quarto Sólido</button>
      </div>
    `;
    presetBlock.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const created = ve.createRibbonPreset(btn.dataset.preset);
        if (!created) return;
        const nextShapes = [...shapes.map((s) => JSON.parse(JSON.stringify(s))), created];
        ve.state.selectedShapeIds = [created.id];
        ve.state.selectedNodes = [];
        commitFamilyShapes(famDoc.id, nextShapes);
      });
    });
    container.appendChild(presetBlock);

    // 2. Align & Selection Quick Actions
    const hasSel = selected.length > 0;
    const alignBlock = document.createElement('div');
    alignBlock.className = 'vec-props-subblock';
    alignBlock.innerHTML = `
      <div class="vec-subblock-title"><span>Alinhar à Célula [-0.5, +0.5]</span></div>
      <div class="vec-align-strip">
        <button type="button" class="vec-align-btn" data-align="left" title="Alinhar à Borda Esquerda (-0.5)" ${!hasSel ? 'disabled' : ''}>⇤</button>
        <button type="button" class="vec-align-btn" data-align="centerX" title="Centralizar Horizontalmente (0)" ${!hasSel ? 'disabled' : ''}>⇹</button>
        <button type="button" class="vec-align-btn" data-align="right" title="Alinhar à Borda Direita (+0.5)" ${!hasSel ? 'disabled' : ''}>⇥</button>
        <button type="button" class="vec-align-btn" data-align="top" title="Alinhar ao Topo (-0.5)" ${!hasSel ? 'disabled' : ''}>⤒</button>
        <button type="button" class="vec-align-btn" data-align="centerY" title="Centralizar Verticalmente (0)" ${!hasSel ? 'disabled' : ''}>⇳</button>
        <button type="button" class="vec-align-btn" data-align="bottom" title="Alinhar à Base (+0.5)" ${!hasSel ? 'disabled' : ''}>⤓</button>
      </div>
      ${selected.length >= 3 ? `
        <div class="vec-inline-actions" style="margin-top:3px;">
          <button type="button" class="mini-btn" data-distrib="horizontal">Distribuir H</button>
          <button type="button" class="mini-btn" data-distrib="vertical">Distribuir V</button>
        </div>
      ` : ''}
      ${hasSel ? `
        <div class="vec-subblock-title" style="margin-top:5px;"><span>Transformar Seleção (D4)</span></div>
        <div class="vec-d4-strip">
          <button type="button" class="mini-btn" data-sel-d4="r90" title="Girar seleção +90° horário">↻ +90°</button>
          <button type="button" class="mini-btn" data-sel-d4="r270" title="Girar seleção -90° anti-horário">↺ -90°</button>
          <button type="button" class="mini-btn" data-sel-d4="mx" title="Espelhar seleção horizontalmente (mx)">↔ Esp. H</button>
          <button type="button" class="mini-btn" data-sel-d4="my" title="Espelhar seleção verticalmente (my)">↕ Esp. V</button>
        </div>
        <div class="vec-inline-actions" style="margin-top:3px;">
          <button type="button" class="mini-btn" id="btnVecPropDuplicate" title="Duplicar seleção (Ctrl+D)">⧉ Duplicar</button>
          ${selected.some((s) => s.type !== 'path') ? '<button type="button" class="mini-btn" id="btnVecPropToPath" title="Converter forma paramétrica em caminho Bezier editável">⬡ Virar Caminho</button>' : ''}
          <button type="button" class="mini-btn danger" id="btnVecPropDelete" title="Excluir seleção (Delete)">✕ Excluir</button>
        </div>
      ` : ''}
    `;

    alignBlock.querySelectorAll('[data-align]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextShapes = ve.alignShapesToCell(shapes, ve.state.selectedShapeIds, btn.dataset.align);
        commitFamilyShapes(famDoc.id, nextShapes);
      });
    });
    alignBlock.querySelectorAll('[data-distrib]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextShapes = ve.distributeShapes(shapes, ve.state.selectedShapeIds, btn.dataset.distrib);
        commitFamilyShapes(famDoc.id, nextShapes);
      });
    });
    alignBlock.querySelectorAll('[data-sel-d4]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!vb) return;
        const nextShapes = vb.transformSelectedShapesD4(shapes, ve.state.selectedShapeIds, btn.dataset.selD4);
        commitFamilyShapes(famDoc.id, nextShapes);
      });
    });
    alignBlock.querySelector('#btnVecPropDuplicate')?.addEventListener('click', () => {
      const res = ve.duplicateSelectedShapes(shapes, ve.state.selectedShapeIds);
      if (res.newIds.length > 0) {
        ve.state.selectedShapeIds = res.newIds;
        commitFamilyShapes(famDoc.id, res.shapes);
      }
    });
    alignBlock.querySelector('#btnVecPropToPath')?.addEventListener('click', () => {
      const nextShapes = shapes.map((s) => (s && selSet.has(s.id) ? ve.convertShapeToPath(s) : JSON.parse(JSON.stringify(s))));
      ve.state.activeTool = 'direct';
      commitFamilyShapes(famDoc.id, nextShapes);
    });
    alignBlock.querySelector('#btnVecPropDelete')?.addEventListener('click', () => {
      const nextShapes = shapes.filter((s) => s && !selSet.has(s.id));
      ve.state.selectedShapeIds = [];
      ve.state.selectedNodes = [];
      commitFamilyShapes(famDoc.id, nextShapes);
    });
    container.appendChild(alignBlock);

    // 2B. Pathfinder Boolean Operations (Unite, Subtract, Intersect, Exclude)
    if (vb) {
      const unlockedSelCount = selected.filter((s) => !s.locked && s.visible !== false).length;
      const canBool = unlockedSelCount >= 2;
      const boolBlock = document.createElement('div');
      boolBlock.className = 'vec-props-subblock';
      boolBlock.innerHTML = `
        <div class="vec-subblock-title">
          <span>Pathfinder (Booleanas)</span>
          <span style="font-weight:400;opacity:0.7;">${canBool ? `${unlockedSelCount} formas` : 'Selecione 2+'}</span>
        </div>
        <div class="vec-bool-strip">
          <button type="button" class="vec-bool-btn" data-bool-op="unite" title="Unir formas selecionadas num contorno contínuo" ${!canBool ? 'disabled' : ''}>∪ Unir</button>
          <button type="button" class="vec-bool-btn" data-bool-op="subtract" title="Subtrair formas da frente sobre a forma de trás (furos compostos)" ${!canBool ? 'disabled' : ''}>− Subtrair</button>
          <button type="button" class="vec-bool-btn" data-bool-op="intersect" title="Manter apenas a área comum de interseção" ${!canBool ? 'disabled' : ''}>∩ Interseç.</button>
          <button type="button" class="vec-bool-btn" data-bool-op="exclude" title="Diferença simétrica (XOR) vazando sobreposições" ${!canBool ? 'disabled' : ''}>⊕ Excluir</button>
        </div>
      `;
      boolBlock.querySelectorAll('[data-bool-op]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const op = btn.dataset.boolOp;
          const res = vb.applyBooleanOp(shapes, ve.state.selectedShapeIds, op);
          if (!res.ok) {
            notifyToast('Selecione ao menos 2 formas visíveis e destravadas.', 'info');
            return;
          }
          ve.state.selectedShapeIds = res.resultIds;
          ve.state.selectedNodes = [];
          commitFamilyShapes(famDoc.id, res.shapes);
          notifyToast(res.emptyResult ? 'Operação resultou em área vazia.' : `Booleana (${btn.textContent.trim()}) aplicada.`);
        });
      });
      (pathfinder || container).appendChild(boolBlock);
    }

    // 3. When NO shape is selected: show active drawing tool defaults
    if (selected.length === 0) {
      const tool = ve.state.activeTool;
      const defs = ve.state.toolDefaults;
      if (tool === 'rect' || tool === 'polygon' || tool === 'arc' || tool === 'line') {
        const defBlock = document.createElement('div');
        defBlock.className = 'vec-props-subblock';
        let fieldsHTML = '';
        if (tool === 'rect') {
          fieldsHTML = `
            <div class="vec-prop-field"><label>Raio</label><input type="number" step="0.02" min="0" max="0.5" data-tdef="rectRadius" value="${defs.rectRadius}"></div>
          `;
        } else if (tool === 'polygon') {
          fieldsHTML = `
            <div class="vec-prop-field"><label>Lados</label><input type="number" step="1" min="3" max="16" data-tdef="polygonSides" value="${defs.polygonSides}"></div>
            <div class="vec-prop-field"><label>Estrela</label><input type="number" step="0.05" min="0" max="0.9" data-tdef="polygonStarRatio" value="${defs.polygonStarRatio}"></div>
          `;
        } else if (tool === 'arc') {
          fieldsHTML = `
            <div class="vec-prop-field"><label>Furo</label><input type="number" step="0.05" min="0" max="0.95" data-tdef="arcInnerRatio" value="${defs.arcInnerRatio}"></div>
            <div class="vec-prop-field"><label>Modo</label>
              <select data-tdef="arcMode">
                <option value="pie" ${defs.arcMode === 'pie' ? 'selected' : ''}>Setor</option>
                <option value="chord" ${defs.arcMode === 'chord' ? 'selected' : ''}>Corda</option>
                <option value="open" ${defs.arcMode === 'open' ? 'selected' : ''}>Aberto</option>
              </select>
            </div>
          `;
        } else if (tool === 'line') {
          fieldsHTML = `
            <div class="vec-prop-field"><label>Espess.</label><input type="number" step="0.02" min="0.01" max="1" data-tdef="lineWeight" value="${defs.lineWeight}"></div>
          `;
        }
        defBlock.innerHTML = `
          <div class="vec-subblock-title">Opções da Ferramenta</div>
          <div class="vec-props-grid">${fieldsHTML}</div>
        `;
        defBlock.querySelectorAll('[data-tdef]').forEach((inp) => {
          inp.addEventListener('change', () => {
            const k = inp.dataset.tdef;
            if (inp.tagName === 'SELECT') defs[k] = inp.value;
            else defs[k] = parseFloat(inp.value) || 0;
          });
        });
        container.appendChild(defBlock);
      } else {
        const hint = document.createElement('div');
        hint.className = 'vec-empty-hint';
        hint.textContent = shapes.length === 0
          ? 'Prancheta vazia: desenhe com Retângulo (M), Arco/Fita (U) ou Caneta (P), ou insira uma Base de Fita acima.'
          : 'Clique numa forma no canvas para inspecionar e editar estilo, medidas ou nós Bezier.';
        container.appendChild(hint);
      }
      return;
    }

    // 4. Style Controls (Fill, Stroke, Weight, Cap, FillRule) for Selected Shape(s)
    const primary = selected[0];
    const styleBlock = document.createElement('div');
    styleBlock.className = 'vec-props-subblock';
    const hasFill = primary.fill !== false;
    const hasStroke = Boolean(primary.stroke);
    const weightVal = Number((Number(primary.strokeWeight) || 0.08).toFixed(4));
    const capVal = primary.strokeCap || 'round';
    const ruleVal = primary.fillRule || 'evenodd';

    styleBlock.innerHTML = `
      <div class="vec-subblock-title"><span>Preenchimento &amp; Traço</span></div>
      <div class="vec-style-toggles">
        <label class="vec-check-chip"><input type="checkbox" id="vecPropFillChk" ${hasFill ? 'checked' : ''}><span>Preencher</span></label>
        <label class="vec-check-chip"><input type="checkbox" id="vecPropStrokeChk" ${hasStroke ? 'checked' : ''}><span>Traço</span></label>
      </div>
      ${hasStroke ? `
        <div class="vec-props-grid" style="margin-top:3px;">
          <div class="vec-prop-field">
            <label>Espess.</label>
            <input type="number" id="vecPropStrokeW" step="0.02" min="0.01" max="1" value="${weightVal}">
          </div>
          <div class="vec-prop-field">
            <label>Ponta</label>
            <select id="vecPropStrokeCap">
              <option value="butt" ${capVal === 'butt' ? 'selected' : ''}>Reta</option>
              <option value="round" ${capVal === 'round' ? 'selected' : ''}>Redonda</option>
              <option value="square" ${capVal === 'square' ? 'selected' : ''}>Quadrada</option>
            </select>
          </div>
        </div>
        <div class="vec-inline-actions" style="margin-top:2px;">
          <button type="button" class="mini-btn" data-sw-preset="${(1 / 6).toFixed(6)}">Espess. 1/6</button>
          <button type="button" class="mini-btn" data-sw-preset="${(1 / 3).toFixed(6)}">Espess. 1/3</button>
        </div>
      ` : ''}
      ${primary.type === 'path' && hasFill ? `
        <div class="vec-prop-field" style="margin-top:3px;">
          <label>Regra</label>
          <select id="vecPropFillRule">
            <option value="evenodd" ${ruleVal === 'evenodd' ? 'selected' : ''}>Par-Ímpar (Furos)</option>
            <option value="nonzero" ${ruleVal === 'nonzero' ? 'selected' : ''}>Não-Zero</option>
          </select>
        </div>
      ` : ''}
    `;

    const patchSelectedStyle = (patch) => {
      const nextShapes = shapes.map((s) => {
        if (!s || !selSet.has(s.id)) return JSON.parse(JSON.stringify(s));
        return { ...JSON.parse(JSON.stringify(s)), ...patch };
      });
      commitFamilyShapes(famDoc.id, nextShapes);
    };

    styleBlock.querySelector('#vecPropFillChk')?.addEventListener('change', (e) => {
      const fillOn = Boolean(e.target.checked);
      patchSelectedStyle(fillOn ? { fill: true } : { fill: false, stroke: true });
    });
    styleBlock.querySelector('#vecPropStrokeChk')?.addEventListener('change', (e) => {
      const strokeOn = Boolean(e.target.checked);
      patchSelectedStyle(strokeOn ? { stroke: true } : { stroke: false, fill: true });
    });
    styleBlock.querySelector('#vecPropStrokeW')?.addEventListener('change', (e) => {
      const w = Math.max(0.005, Math.min(1, parseFloat(e.target.value) || 0.08));
      patchSelectedStyle({ strokeWeight: w });
    });
    styleBlock.querySelector('#vecPropStrokeCap')?.addEventListener('change', (e) => {
      patchSelectedStyle({ strokeCap: e.target.value });
    });
    styleBlock.querySelector('#vecPropFillRule')?.addEventListener('change', (e) => {
      patchSelectedStyle({ fillRule: e.target.value });
    });
    styleBlock.querySelectorAll('[data-sw-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        patchSelectedStyle({ stroke: true, strokeWeight: parseFloat(btn.dataset.swPreset) });
      });
    });
    container.appendChild(styleBlock);

    // 5. Contextual Geometry Inspector for Single Selected Shape
    if (selected.length === 1) {
      const sh = primary;
      const geoBlock = document.createElement('div');
      geoBlock.className = 'vec-props-subblock';
      const deg = (rad) => Number((((Number(rad) || 0) * 180) / Math.PI).toFixed(1));
      const fmt = (n) => Number((Number(n) || 0).toFixed(4));

      if (sh.type === 'rect') {
        geoBlock.innerHTML = `
          <div class="vec-subblock-title">Geometria • Retângulo</div>
          <div class="vec-props-grid">
            <div class="vec-prop-field"><label>X</label><input type="number" step="0.05" data-sprop="x" value="${fmt(sh.x)}"></div>
            <div class="vec-prop-field"><label>Y</label><input type="number" step="0.05" data-sprop="y" value="${fmt(sh.y)}"></div>
            <div class="vec-prop-field"><label>L (W)</label><input type="number" step="0.05" min="0.01" data-sprop="w" value="${fmt(sh.w)}"></div>
            <div class="vec-prop-field"><label>A (H)</label><input type="number" step="0.05" min="0.01" data-sprop="h" value="${fmt(sh.h)}"></div>
            <div class="vec-prop-field"><label>Raio</label><input type="number" step="0.02" min="0" data-sprop="radius" value="${fmt(sh.radius)}"></div>
            <div class="vec-prop-field"><label>Giro°</label><input type="number" step="15" data-sdeg="rotation" value="${deg(sh.rotation)}"></div>
          </div>
        `;
      } else if (sh.type === 'ellipse') {
        geoBlock.innerHTML = `
          <div class="vec-subblock-title">Geometria • Elipse</div>
          <div class="vec-props-grid">
            <div class="vec-prop-field"><label>CX</label><input type="number" step="0.05" data-sprop="cx" value="${fmt(sh.cx)}"></div>
            <div class="vec-prop-field"><label>CY</label><input type="number" step="0.05" data-sprop="cy" value="${fmt(sh.cy)}"></div>
            <div class="vec-prop-field"><label>RX</label><input type="number" step="0.05" min="0.01" data-sprop="rx" value="${fmt(sh.rx)}"></div>
            <div class="vec-prop-field"><label>RY</label><input type="number" step="0.05" min="0.01" data-sprop="ry" value="${fmt(sh.ry ?? sh.rx)}"></div>
            <div class="vec-prop-field"><label>Giro°</label><input type="number" step="15" data-sdeg="rotation" value="${deg(sh.rotation)}"></div>
          </div>
        `;
      } else if (sh.type === 'polygon') {
        geoBlock.innerHTML = `
          <div class="vec-subblock-title">Geometria • Polígono / Estrela</div>
          <div class="vec-props-grid">
            <div class="vec-prop-field"><label>CX</label><input type="number" step="0.05" data-sprop="cx" value="${fmt(sh.cx)}"></div>
            <div class="vec-prop-field"><label>CY</label><input type="number" step="0.05" data-sprop="cy" value="${fmt(sh.cy)}"></div>
            <div class="vec-prop-field"><label>RX</label><input type="number" step="0.05" min="0.01" data-sprop="rx" value="${fmt(sh.rx)}"></div>
            <div class="vec-prop-field"><label>RY</label><input type="number" step="0.05" min="0.01" data-sprop="ry" value="${fmt(sh.ry ?? sh.rx)}"></div>
            <div class="vec-prop-field"><label>Lados</label><input type="number" step="1" min="3" max="16" data-sint="sides" value="${sh.sides || 5}"></div>
            <div class="vec-prop-field"><label>Estrela</label><input type="number" step="0.05" min="0" max="0.95" data-sprop="starRatio" value="${fmt(sh.starRatio)}"></div>
            <div class="vec-prop-field"><label>Giro°</label><input type="number" step="15" data-sdeg="rotation" value="${deg(sh.rotation)}"></div>
          </div>
        `;
      } else if (sh.type === 'arc') {
        const modeVal = sh.mode || 'pie';
        geoBlock.innerHTML = `
          <div class="vec-subblock-title">Geometria • Arco / Fita Anular</div>
          <div class="vec-props-grid">
            <div class="vec-prop-field"><label>CX</label><input type="number" step="0.05" data-sprop="cx" value="${fmt(sh.cx)}"></div>
            <div class="vec-prop-field"><label>CY</label><input type="number" step="0.05" data-sprop="cy" value="${fmt(sh.cy)}"></div>
            <div class="vec-prop-field"><label>RX</label><input type="number" step="0.05" min="0.01" data-sprop="rx" value="${fmt(sh.rx)}"></div>
            <div class="vec-prop-field"><label>RY</label><input type="number" step="0.05" min="0.01" data-sprop="ry" value="${fmt(sh.ry ?? sh.rx)}"></div>
            <div class="vec-prop-field"><label>Furo</label><input type="number" step="0.05" min="0" max="0.95" data-sprop="innerRatio" value="${fmt(sh.innerRatio)}"></div>
            <div class="vec-prop-field"><label>Modo</label>
              <select data-sstr="mode">
                <option value="pie" ${modeVal === 'pie' ? 'selected' : ''}>Setor</option>
                <option value="chord" ${modeVal === 'chord' ? 'selected' : ''}>Corda</option>
                <option value="open" ${modeVal === 'open' ? 'selected' : ''}>Aberto</option>
              </select>
            </div>
            <div class="vec-prop-field"><label>Início°</label><input type="number" step="15" data-sdeg="start" value="${deg(sh.start)}"></div>
            <div class="vec-prop-field"><label>Fim°</label><input type="number" step="15" data-sdeg="end" value="${deg(sh.end)}"></div>
          </div>
        `;
      } else if (sh.type === 'line') {
        geoBlock.innerHTML = `
          <div class="vec-subblock-title">Geometria • Linha</div>
          <div class="vec-props-grid">
            <div class="vec-prop-field"><label>X1</label><input type="number" step="0.05" data-sprop="x1" value="${fmt(sh.x1)}"></div>
            <div class="vec-prop-field"><label>Y1</label><input type="number" step="0.05" data-sprop="y1" value="${fmt(sh.y1)}"></div>
            <div class="vec-prop-field"><label>X2</label><input type="number" step="0.05" data-sprop="x2" value="${fmt(sh.x2)}"></div>
            <div class="vec-prop-field"><label>Y2</label><input type="number" step="0.05" data-sprop="y2" value="${fmt(sh.y2)}"></div>
          </div>
        `;
      } else if (sh.type === 'path') {
        const contours = Array.isArray(sh.contours) ? sh.contours : (Array.isArray(sh.nodes) ? [sh.nodes] : []);
        const totalNodes = contours.reduce((acc, c) => acc + c.length, 0);
        const selNode = ve.state.selectedNodes.find((r) => r.shapeId === sh.id);
        const ndObj = selNode && contours[selNode.contourIdx] ? contours[selNode.contourIdx][selNode.nodeIdx] : null;

        geoBlock.innerHTML = `
          <div class="vec-subblock-title"><span>Caminho Bezier (${totalNodes} nós)</span></div>
          <div class="vec-style-toggles">
            <label class="vec-check-chip"><input type="checkbox" id="vecPropPathClosed" ${sh.closed !== false ? 'checked' : ''}><span>Contorno Fechado</span></label>
          </div>
          ${ndObj ? `
            <div class="vec-props-grid" style="margin-top:3px;">
              <div class="vec-prop-field"><label>Nó X</label><input type="number" step="0.02" id="vecPropNodeX" value="${fmt(ndObj.x)}"></div>
              <div class="vec-prop-field"><label>Nó Y</label><input type="number" step="0.02" id="vecPropNodeY" value="${fmt(ndObj.y)}"></div>
            </div>
            <div class="vec-inline-actions" style="margin-top:3px;">
              <button type="button" class="mini-btn" id="btnVecToggleSmooth">Alternar Canto/Suave</button>
              <button type="button" class="mini-btn" id="btnVecSubdivideSeg">+ Subdividir</button>
            </div>
          ` : '<div class="vec-empty-hint">Use Nós (A) para arrastar vértices, alças Bezier ou Alt+Clique para inserir nós.</div>'}
        `;

        geoBlock.querySelector('#vecPropPathClosed')?.addEventListener('change', (e) => {
          const closedOn = Boolean(e.target.checked);
          patchSelectedStyle(closedOn ? { closed: true } : { closed: false, fill: false, stroke: true });
        });
        if (ndObj && selNode) {
          const updateNodeCoord = () => {
            const nx = parseFloat(geoBlock.querySelector('#vecPropNodeX')?.value);
            const ny = parseFloat(geoBlock.querySelector('#vecPropNodeY')?.value);
            if (Number.isNaN(nx) || Number.isNaN(ny)) return;
            const nextShapes = shapes.map((item) => {
              if (!item || item.id !== sh.id) return JSON.parse(JSON.stringify(item));
              const clone = JSON.parse(JSON.stringify(item));
              if (!Array.isArray(clone.contours) && Array.isArray(clone.nodes)) {
                clone.contours = [clone.nodes];
                delete clone.nodes;
              }
              if (clone.contours[selNode.contourIdx] && clone.contours[selNode.contourIdx][selNode.nodeIdx]) {
                clone.contours[selNode.contourIdx][selNode.nodeIdx].x = nx;
                clone.contours[selNode.contourIdx][selNode.nodeIdx].y = ny;
              }
              return clone;
            });
            commitFamilyShapes(famDoc.id, nextShapes);
          };
          geoBlock.querySelector('#vecPropNodeX')?.addEventListener('change', updateNodeCoord);
          geoBlock.querySelector('#vecPropNodeY')?.addEventListener('change', updateNodeCoord);

          geoBlock.querySelector('#btnVecToggleSmooth')?.addEventListener('click', () => {
            const nextShapes = shapes.map((item) =>
              (item && item.id === sh.id)
                ? ve.togglePathNodeSmooth(item, selNode.contourIdx, selNode.nodeIdx)
                : JSON.parse(JSON.stringify(item))
            );
            commitFamilyShapes(famDoc.id, nextShapes);
          });
          geoBlock.querySelector('#btnVecSubdivideSeg')?.addEventListener('click', () => {
            const nextShapes = shapes.map((item) =>
              (item && item.id === sh.id)
                ? ve.subdividePathSegment(item, selNode.contourIdx, selNode.nodeIdx, 0.5)
                : JSON.parse(JSON.stringify(item))
            );
            commitFamilyShapes(famDoc.id, nextShapes);
          });
        }
      }

      const applyGeoField = (inp) => {
        const patch = {};
        if (inp.dataset.sprop) {
          const val = parseFloat(inp.value);
          if (Number.isNaN(val)) return;
          if (inp.dataset.sprop === 'starRatio' && val <= 0) {
            patch.starRatio = undefined;
          } else {
            patch[inp.dataset.sprop] = val;
          }
        } else if (inp.dataset.sint) {
          patch[inp.dataset.sint] = Math.max(3, Math.min(16, parseInt(inp.value, 10) || 3));
        } else if (inp.dataset.sdeg) {
          const degVal = parseFloat(inp.value) || 0;
          patch[inp.dataset.sdeg] = (degVal * Math.PI) / 180;
        } else if (inp.dataset.sstr) {
          patch[inp.dataset.sstr] = inp.value;
          if (inp.dataset.sstr === 'mode' && inp.value === 'open') {
            patch.fill = false;
            patch.stroke = true;
          }
        }
        const nextShapes = shapes.map((item) => {
          if (!item || item.id !== sh.id) return JSON.parse(JSON.stringify(item));
          const updated = { ...JSON.parse(JSON.stringify(item)), ...patch };
          if (sh.type === 'polygon' && (patch.sides !== undefined || patch.starRatio !== undefined || patch.rx !== undefined || patch.ry !== undefined)) {
            delete updated.points;
          }
          if (patch.starRatio === undefined && inp.dataset.sprop === 'starRatio') {
            delete updated.starRatio;
          }
          return updated;
        });
        commitFamilyShapes(famDoc.id, nextShapes);
      };

      geoBlock.querySelectorAll('[data-sprop],[data-sint],[data-sdeg],[data-sstr]').forEach((inp) => {
        inp.addEventListener('change', () => applyGeoField(inp));
      });

      if (geoBlock.innerHTML.trim()) {
        container.appendChild(geoBlock);
      }
    }
  }

  function renderLayersPanel() {
    if (typeof document === 'undefined') return;
    const { ve, vb } = resolveDeps();
    const listEl = document.getElementById('tileLayersListContainer');
    const countBadge = document.getElementById('tileLayersCountBadge');
    const bringFrontBtn = document.getElementById('btnLayerBringFront');
    const sendBackBtn = document.getElementById('btnLayerSendBack');
    if (!listEl) return;

    const fam = ensureValidSelection();
    const famDoc = getSelectedFamilyDoc();
    if (!fam || !famDoc) {
      listEl.innerHTML = '<div class="vec-empty-hint">Nenhuma família selecionada.</div>';
      if (countBadge) countBadge.textContent = '0 formas';
      if (bringFrontBtn) bringFrontBtn.disabled = true;
      if (sendBackBtn) sendBackBtn.disabled = true;
      return;
    }

    const shapes = famDoc.shapes || [];
    const isEditable = Boolean(!fam.builtIn && !fam.protected && ve && vb);
    const selSet = new Set(ve ? ve.state.selectedShapeIds : []);
    const focusedLayer = document.activeElement?.classList.contains('tile-layer-select')
      ? document.activeElement.closest('.tile-layer-row')?.dataset.shapeId : null;

    if (countBadge) {
      countBadge.textContent = `${shapes.length} ${shapes.length === 1 ? 'forma' : 'formas'}`;
    }
    if (bringFrontBtn) {
      bringFrontBtn.disabled = !isEditable || selSet.size !== 1 || shapes.length <= 1;
    }
    if (sendBackBtn) {
      sendBackBtn.disabled = !isEditable || selSet.size !== 1 || shapes.length <= 1;
    }

    listEl.innerHTML = '';

    if (shapes.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'vec-empty-hint';
      hint.textContent = fam.isCanonicalEmpty
        ? 'Célula vazia canônica (#84) — respiro geométrico sem formas.'
        : 'Nenhuma forma nesta família. Use as ferramentas vetoriais ou importe um SVG.';
      listEl.appendChild(hint);
      return;
    }

    const shortTags = {
      rect: 'RET',
      ellipse: 'ELI',
      polygon: 'POL',
      triangle: 'TRI',
      arc: 'ARC',
      line: 'LIN',
      path: 'CAM'
    };
    const defaultLabels = {
      rect: 'Retângulo',
      ellipse: 'Elipse',
      polygon: 'Polígono',
      triangle: 'Triângulo',
      arc: 'Arco/Fita',
      line: 'Linha',
      path: 'Caminho'
    };

    // Render top-to-bottom in visual Z-order (topmost shape = index length-1 first)
    for (let idx = shapes.length - 1; idx >= 0; idx--) {
      const sh = shapes[idx];
      if (!sh) continue;

      const isSelected = selSet.has(sh.id);
      const isHidden = sh.visible === false;
      const isLocked = Boolean(sh.locked);
      const isRenaming = isEditable && uiState.editingLayerId === sh.id;

      const row = document.createElement('div');
      row.className = [
        'tile-layer-row',
        isSelected ? 'is-selected' : '',
        isHidden ? 'is-hidden' : '',
        isLocked ? 'is-locked' : ''
      ].filter(Boolean).join(' ');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-pressed', String(isSelected));
      row.addEventListener('keydown', (e) => {
        if (e.target === row && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault(); e.stopPropagation(); row.click();
        }
      });
      row.dataset.shapeId = sh.id;
      row.dataset.zIndex = String(idx);

      if (isEditable) {
        const check = document.createElement('input');
        check.type = 'checkbox'; check.className = 'tile-layer-select';
        check.checked = isSelected; check.disabled = isHidden || isLocked;
        check.setAttribute('aria-label', `Selecionar ${sh.name || defaultLabels[sh.type] || 'objeto'} ${idx + 1}`);
        check.addEventListener('click', (e) => e.stopPropagation());
        check.addEventListener('change', () => {
          ve.state.selectedShapeIds = check.checked
            ? [...new Set([...ve.state.selectedShapeIds, sh.id])]
            : ve.state.selectedShapeIds.filter((id) => id !== sh.id);
          ve.state.selectedNodes = [];
          renderShapePropsPanel(true); renderLayersPanel(); requestHostRedraw();
        });
        row.appendChild(check);
      }

      if (isEditable && !isRenaming) {
        row.draggable = true;
        row.addEventListener('dragstart', (e) => {
          uiState.dragState = { kind: 'layer', id: sh.id };
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            try {
              e.dataTransfer.setData('text/plain', sh.id);
            } catch (_err) {
              // Ignore restricted dataTransfer environments
            }
          }
        });
        row.addEventListener('dragover', (e) => {
          if (!uiState.dragState || uiState.dragState.kind !== 'layer' || uiState.dragState.id === sh.id) return;
          e.preventDefault();
          row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', () => {
          row.classList.remove('drag-over');
        });
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          row.classList.remove('drag-over');
          const draggedId = uiState.dragState && uiState.dragState.kind === 'layer' ? uiState.dragState.id : null;
          uiState.dragState = null;
          if (!draggedId || draggedId === sh.id) return;
          const nextShapes = vb.reorderShapeZ(shapes, draggedId, idx);
          commitFamilyShapes(famDoc.id, nextShapes);
        });
        row.addEventListener('dragend', () => {
          uiState.dragState = null;
          row.classList.remove('drag-over');
        });
      }

      if (isEditable) {
        const grip = document.createElement('span');
        grip.className = 'tile-layer-drag-grip';
        grip.title = 'Arrastar para reordenar Z-index';
        grip.textContent = '⋮⋮';
        row.appendChild(grip);
      }

      const tag = document.createElement('span');
      tag.className = 'tile-layer-type-tag';
      tag.textContent = shortTags[sh.type] || 'VET';
      row.appendChild(tag);

      const displayName = sh.name || `${defaultLabels[sh.type] || 'Forma'} #${idx + 1}`;

      if (isRenaming) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'tile-layer-rename-input';
        inp.value = displayName;
        inp.maxLength = 44;

        let committed = false;
        const finishRename = (save) => {
          if (committed) return;
          committed = true;
          uiState.editingLayerId = null;
          const trimmed = inp.value.trim();
          if (save && trimmed && trimmed !== sh.name) {
            const nextShapes = vb.renameShape(shapes, sh.id, trimmed);
            commitFamilyShapes(famDoc.id, nextShapes);
          } else {
            renderLayersPanel();
          }
        };

        inp.addEventListener('click', (e) => e.stopPropagation());
        inp.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            finishRename(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finishRename(false);
          }
        });
        inp.addEventListener('blur', () => finishRename(true));
        row.appendChild(inp);
        setTimeout(() => {
          inp.focus();
          inp.select();
        }, 0);
      } else {
        const nameEl = document.createElement('span');
        nameEl.className = 'tile-layer-name';
        nameEl.textContent = displayName;
        if (isEditable) {
          nameEl.title = `${displayName} — Duplo-clique para renomear`;
          nameEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            uiState.editingLayerId = sh.id;
            renderLayersPanel();
          });
        }
        row.appendChild(nameEl);
      }

      if (isEditable) {
        row.addEventListener('click', (e) => {
          if (isHidden || isLocked) return;
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            if (selSet.has(sh.id)) {
              ve.state.selectedShapeIds = ve.state.selectedShapeIds.filter((id) => id !== sh.id);
            } else {
              ve.state.selectedShapeIds = [...ve.state.selectedShapeIds, sh.id];
            }
          } else {
            ve.state.selectedShapeIds = [sh.id];
          }
          ve.state.selectedNodes = [];
          renderShapePropsPanel(true);
          renderLayersPanel();
          requestHostRedraw();
        });

        const actions = document.createElement('div');
        actions.className = 'tile-layer-actions';

        // Move Up 1 step (forward)
        const btnUp = document.createElement('button');
        btnUp.type = 'button';
        btnUp.className = 'tile-layer-icon-btn';
        btnUp.title = 'Subir camada (Ctrl+])';
        btnUp.textContent = '↑';
        btnUp.disabled = idx === shapes.length - 1;
        btnUp.addEventListener('click', (e) => {
          e.stopPropagation();
          commitFamilyShapes(famDoc.id, vb.reorderShapeZ(shapes, sh.id, 'forward'));
        });

        // Move Down 1 step (backward)
        const btnDown = document.createElement('button');
        btnDown.type = 'button';
        btnDown.className = 'tile-layer-icon-btn';
        btnDown.title = 'Descer camada (Ctrl+[)';
        btnDown.textContent = '↓';
        btnDown.disabled = idx === 0;
        btnDown.addEventListener('click', (e) => {
          e.stopPropagation();
          commitFamilyShapes(famDoc.id, vb.reorderShapeZ(shapes, sh.id, 'backward'));
        });

        // Visibility toggle
        const btnVis = document.createElement('button');
        btnVis.type = 'button';
        btnVis.className = 'tile-layer-icon-btn';
        btnVis.title = isHidden ? 'Mostrar forma' : 'Ocultar forma';
        btnVis.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${isHidden ? '<path d="M3 3l18 18"/>' : ''}</svg>`;
        btnVis.setAttribute('aria-label', btnVis.title);
        btnVis.addEventListener('click', (e) => {
          e.stopPropagation();
          const nextShapes = vb.toggleShapeVisible(shapes, sh.id);
          if (!isHidden) {
            ve.state.selectedShapeIds = ve.state.selectedShapeIds.filter((id) => id !== sh.id);
          }
          commitFamilyShapes(famDoc.id, nextShapes);
        });

        // Lock toggle
        const btnLock = document.createElement('button');
        btnLock.type = 'button';
        btnLock.className = 'tile-layer-icon-btn';
        btnLock.title = isLocked ? 'Destravar forma' : 'Travar forma';
        btnLock.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="${isLocked ? 'M8 10V6a4 4 0 0 1 8 0v4' : 'M8 10V6a4 4 0 0 1 8 0'}"/><circle cx="12" cy="15" r="1"/></svg>`;
        btnLock.setAttribute('aria-label', btnLock.title);
        btnLock.addEventListener('click', (e) => {
          e.stopPropagation();
          const nextShapes = vb.toggleShapeLocked(shapes, sh.id);
          if (!isLocked) {
            ve.state.selectedShapeIds = ve.state.selectedShapeIds.filter((id) => id !== sh.id);
          }
          commitFamilyShapes(famDoc.id, nextShapes);
        });

        // Delete shape
        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'tile-layer-icon-btn danger';
        btnDel.title = 'Excluir forma';
        btnDel.textContent = '×';
        btnDel.addEventListener('click', (e) => {
          e.stopPropagation();
          const nextShapes = shapes.filter((item) => item && item.id !== sh.id);
          ve.state.selectedShapeIds = ve.state.selectedShapeIds.filter((id) => id !== sh.id);
          ve.state.selectedNodes = [];
          commitFamilyShapes(famDoc.id, nextShapes);
        });

        actions.appendChild(btnUp);
        actions.appendChild(btnDown);
        actions.appendChild(btnVis);
        actions.appendChild(btnLock);
        actions.appendChild(btnDel);
        row.appendChild(actions);
      }

      listEl.appendChild(row);
    }
    if (focusedLayer) {
      const row = Array.from(listEl.querySelectorAll('.tile-layer-row')).find((el) => el.dataset.shapeId === focusedLayer);
      row?.querySelector('.tile-layer-select')?.focus();
    }
  }

  function refresh() {
    if (typeof document === 'undefined') return;
    ensureValidSelection();
    const { ve } = resolveDeps();
    ve?.resetTransientForFamilySwitch(uiState.selectedFamilyId);
    syncNavigationState();
    renderTopBarControls();
    renderLeftPaneState();
    renderShapePropsPanel();
    renderLayersPanel();
    renderD4LivePanel();
    renderLibraryManagerTree();
    setInspectorPanel(uiState.inspectorPanel);
    hostCtx?.updateStatusBar?.();
  }

  function setInspectorPanel(panel, focusTab = false) {
    if (!['layers', 'properties', 'library', 'variants'].includes(panel)) return;
    uiState.inspectorPanel = panel;
    if (typeof document === 'undefined') return;
    const pane = document.getElementById('dock-workspace-tiles');
    if (!pane) return;
    pane.dataset.inspectorPanel = panel;
    const panels = { layers: 'panel-tile-layers', properties: 'panel-tile-shape-props', library: 'panel-tile-library-mgr', variants: 'panel-tile-d4-live' };
    Object.entries(panels).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) { el.hidden = key !== panel; el.setAttribute('role', 'tabpanel'); }
    });
    pane.querySelectorAll('[data-tile-panel]').forEach((btn) => {
      const active = btn.dataset.tilePanel === panel;
      btn.setAttribute('aria-selected', String(active)); btn.tabIndex = active ? 0 : -1;
      if (active && focusTab) btn.focus();
    });
  }

  // ==========================================================================
  // Viewport Master & Ghost Neighbors Canvas Renderer + Interactive Pointer Map
  // ==========================================================================

  function renderViewport(p, studioState) {
    const { reg, d4, vr, ve } = resolveDeps();
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
    const innerSide = Math.max(1, cellSide - padPx * 2);

    // Artboard surface fill using user's BG color
    p.push();
    p.noStroke();
    p.fill(studioState.bgColor || '#0c0c0e');
    p.rect(startX, startY, gridW, gridH);
    p.pop();

    const hasColorFn = typeof p.color === 'function';
    const fgBase = hasColorFn ? p.color(studioState.fgColor || '#e2e0dc') : (studioState.fgColor || '#e2e0dc');
    let fgGhost;
    if (hasColorFn && typeof p.red === 'function' && typeof p.green === 'function' && typeof p.blue === 'function') {
      fgGhost = p.color(p.red(fgBase), p.green(fgBase), p.blue(fgBase), 84);
    } else {
      const hex = String(studioState.fgColor || '#e2e0dc').replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16) || 226;
      const g = parseInt(hex.slice(2, 4), 16) || 224;
      const b = parseInt(hex.slice(4, 6), 16) || 220;
      fgGhost = hasColorFn ? p.color(r, g, b, 84) : `rgba(${r}, ${g}, ${b}, 0.33)`;
    }

    const activeShapes = ve ? ve.getActiveShapesForFamily(famDoc) : (famDoc.shapes || []);
    let masterRect = null;

    // Render each preview cell (including live draft shapes across all 3x3 / 2x2 ghost neighbors!)
    for (const cell of layout.cells) {
      const cx = startX + (cell.col + 0.5) * cellSide;
      const cy = startY + (cell.row + 0.5) * cellSide;

      if (cell.isMaster) {
        masterRect = { cx, cy, side: cellSide, innerSide, transform: selectedTransform };
      }

      if (!fam.isCanonicalEmpty && vr && typeof vr.renderNormalizedShapes === 'function') {
        const visibleShapes = (activeShapes || []).filter((s) => s && s.visible !== false);
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

    // Guides & interactive VectorEditor overlays on the active master cell
    if (masterRect) {
      const { cx, cy, side } = masterRect;
      const half = side / 2;
      const innerHalf = innerSide / 2;
      const gridDiv = ve ? ve.state.gridDiv : 6;

      p.push();
      p.translate(cx, cy);
      p.noFill();

      // 1. Subtile Normalized Magnetic Grid (dynamic division 2/3/4/6/8/12/16)
      if (uiState.guides.showGrid && innerSide > 12) {
        const effectiveGridDiv = gridDiv >= 2 ? gridDiv : 6;
        p.stroke(148, 163, 184, 55);
        p.strokeWeight(0.8);
        for (let k = 1; k < effectiveGridDiv; k++) {
          const frac = -0.5 + k / effectiveGridDiv;
          if (Math.abs(frac) < 1e-6 && uiState.guides.showAxes) continue;
          const pos = frac * innerSide;
          p.line(pos, -innerHalf, pos, innerHalf);
          p.line(-innerHalf, pos, innerHalf, pos);
        }
        // Crisp boundary frame for the magnetic grid area
        p.stroke(148, 163, 184, 75);
        p.strokeWeight(0.9);
        p.rect(-innerHalf, -innerHalf, innerSide, innerSide);
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

      // 4. Edge Port Ticks & Ribbon Guides (1/3 Ribbon Ports at ±1/6 and Center Port at 0)
      if (uiState.guides.showPorts && innerSide > 20) {
        // Subtle dashed ribbon connection lines connecting edge ports
        p.stroke(56, 189, 248, 75);
        p.strokeWeight(0.8);
        if (p.drawingContext && typeof p.drawingContext.setLineDash === 'function') {
          p.drawingContext.setLineDash([3, 4]);
        }
        for (const frac of [-1 / 6, 1 / 6]) {
          const pos3 = frac * innerSide;
          p.line(pos3, -innerHalf, pos3, innerHalf);
          p.line(-innerHalf, pos3, innerHalf, pos3);
        }
        if (p.drawingContext && typeof p.drawingContext.setLineDash === 'function') {
          p.drawingContext.setLineDash([]);
        }

        const tickLen = Math.max(4, Math.min(9, side * 0.035));
        const portOffsets = [-1 / 6, 0, 1 / 6];
        for (const off of portOffsets) {
          const d = off * innerSide;
          const isCenter = off === 0;
          if (isCenter) p.stroke(52, 211, 153, 210);
          else p.stroke(56, 189, 248, 210);
          p.strokeWeight(isCenter ? 2 : 1.6);
          p.line(d, -innerHalf - tickLen * 0.5, d, -innerHalf + tickLen * 0.5);
          p.line(d, innerHalf - tickLen * 0.5, d, innerHalf + tickLen * 0.5);
          p.line(-innerHalf - tickLen * 0.5, d, -innerHalf + tickLen * 0.5, d);
          p.line(innerHalf - tickLen * 0.5, d, innerHalf + tickLen * 0.5, d);
        }
      }

      // 5. Crisp Master Cell Highlight Frame
      p.stroke(59, 130, 246, 220);
      p.strokeWeight(1.6);
      p.rect(-half, -half, side, side);

      // 6. Interactive Vector Editor Overlay (BBox handles, Bezier nodes/tangents, Pen & Snap crosshairs)
      if (ve && typeof ve.renderEditorOverlay === 'function') {
        p.push();
        if (d4 && typeof d4.applyD4ToContext === 'function') {
          d4.applyD4ToContext(p, selectedTransform);
        }
        ve.renderEditorOverlay(p, innerSide, activeShapes, Boolean(fam.builtIn || fam.protected));
        p.pop();
      }

      p.pop();
    }
  }

  function screenToNormalizedMaster(mx, my, studioState) {
    const { d4, vr } = resolveDeps();
    if (!uiState.lastMasterCellRect) return null;
    const scale = (studioState.zoomPercent || 100) / 100;
    const lx = mx / scale;
    const ly = my / scale;
    const { cx, cy, side, innerSide, transform } = uiState.lastMasterCellRect;
    const effInner = innerSide || side;

    const rawU = (lx - cx) / Math.max(1, effInner);
    const rawV = (ly - cy) / Math.max(1, effInner);
    const invT = (d4 && d4.INVERSE_MAP && d4.INVERSE_MAP[transform]) || 'id';
    const [u, v] = vr && typeof vr.transformPointD4 === 'function'
      ? vr.transformPointD4(rawU, rawV, invT)
      : [rawU, rawV];

    const half = side / 2;
    const insideCell = lx >= cx - half && lx <= cx + half && ly >= cy - half && ly <= cy + half;
    const hitRadiusNorm = Math.max(0.018, Math.min(0.045, 9 / Math.max(80, effInner * scale)));

    return { u, v, insideCell, hitRadiusNorm };
  }

  function handleViewportMouseDown(mx, my, e, studioState) {
    const { ve } = resolveDeps();
    if (!isTilesMode(studioState) || !ve || (e && e.button !== 0)) return false;

    const mapped = screenToNormalizedMaster(mx, my, studioState);
    if (!mapped) return false;

    const famDoc = getSelectedFamilyDoc();
    if (!famDoc) return false;

    const mods = {
      shiftKey: Boolean(e && e.shiftKey),
      altKey: Boolean(e && e.altKey),
      ctrlKey: Boolean(e && e.ctrlKey),
      metaKey: Boolean(e && e.metaKey)
    };

    const res = ve.onPointerDown(mapped.u, mapped.v, mods, famDoc, mapped.hitRadiusNorm);
    if (res.readOnlyBlocked) {
      if (mapped.insideCell && ve.state.activeTool !== 'select') {
        notifyToast('Família padrão protegida — clique em "Duplicar p/ Editar" (Ctrl+D) para desenhar.', 'info');
      }
      return true;
    }

    if (res.commitShapes) {
      commitFamilyShapes(famDoc.id, res.commitShapes);
    } else {
      renderShapePropsPanel(true);
      renderLayersPanel();
      requestHostRedraw();
    }
    return Boolean(res.handled);
  }

  function handleViewportMouseDragged(mx, my, studioState) {
    const { ve } = resolveDeps();
    if (!isTilesMode(studioState) || !ve) return false;

    const mapped = screenToNormalizedMaster(mx, my, studioState);
    if (!mapped) return false;

    uiState.hoverNorm = mapped.insideCell ? { nx: mapped.u, ny: mapped.v } : null;
    const famDoc = getSelectedFamilyDoc();
    if (!famDoc) return false;

    const mods = {
      shiftKey: Boolean(studioState.isShiftDown),
      altKey: Boolean(studioState.isAltDown || (typeof window !== 'undefined' && window.keyIsDown && window.keyIsDown(18))),
      metaKey: false
    };

    const changed = ve.onPointerMove(mapped.u, mapped.v, mods, famDoc, mapped.hitRadiusNorm);
    if (changed) {
      if (ve.state.workingShapes) {
        updateLiveDragD4Preview(ve.state.workingShapes, famDoc.clipToTile);
      }
      if (hostCtx && typeof hostCtx.updateStatusBar === 'function') {
        hostCtx.updateStatusBar();
      }
      requestHostRedraw();
    }
    return changed;
  }

  function handleViewportMouseUp(_mx, _my, _e, studioState) {
    const { ve } = resolveDeps();
    if (!isTilesMode(studioState) || !ve) return false;
    // Global mouseup also runs over the inspector. Rebuilding its controls here
    // detaches the clicked checkbox/button before the browser dispatches click.
    if (!ve.state.dragOp) return false;
    const famDoc = getSelectedFamilyDoc();
    if (!famDoc) return false;

    const res = ve.onPointerUp(famDoc);
    if (res.commitShapes) {
      commitFamilyShapes(famDoc.id, res.commitShapes);
      return true;
    }
    renderShapePropsPanel(true);
    renderLayersPanel();
    renderD4LivePanel();
    requestHostRedraw();
    return false;
  }

  function handleViewportDoubleClick(mx, my, studioState) {
    const { ve } = resolveDeps();
    if (!isTilesMode(studioState) || !ve) return false;
    const mapped = screenToNormalizedMaster(mx, my, studioState);
    if (!mapped || !mapped.insideCell) return false;

    const famDoc = getSelectedFamilyDoc();
    if (!famDoc || famDoc.builtIn || famDoc.protected) return false;

    const res = ve.onDoubleClick(mapped.u, mapped.v, famDoc, mapped.hitRadiusNorm);
    if (res.switchedTool) {
      setVectorTool(res.switchedTool);
      return true;
    }
    if (res.commitShapes) {
      commitFamilyShapes(famDoc.id, res.commitShapes);
      return true;
    }
    return false;
  }

  function handleViewportMouseMoved(mx, my, studioState) {
    const { ve } = resolveDeps();
    if (!isTilesMode(studioState) || !uiState.lastMasterCellRect) return false;
    const mapped = screenToNormalizedMaster(mx, my, studioState);
    if (!mapped) return false;

    uiState.hoverNorm = mapped.insideCell ? { nx: mapped.u, ny: mapped.v } : null;

    const famDoc = getSelectedFamilyDoc();
    if (ve && famDoc && !famDoc.builtIn && ve.state.activeTool === 'pen' && ve.state.penSession) {
      ve.onPointerMove(mapped.u, mapped.v, { shiftKey: Boolean(studioState.isShiftDown) }, famDoc, mapped.hitRadiusNorm);
      requestHostRedraw();
    }

    if (hostCtx && typeof hostCtx.updateStatusBar === 'function') {
      hostCtx.updateStatusBar();
    }
    return false;
  }

  function getStatusBarTexts(studioState) {
    const { reg, ve } = resolveDeps();
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
      neighbors_3x3: 'Repetição 3×3',
      mandala_d4: 'Bloco Espelhos 2×2',
      rotational_c4: 'Bloco Giro C4 2×2'
    };

    const artboard = `Subtile [-0.5, +0.5] (${studioState.zoomPercent || 100}%)`;
    const grid = `${fam.name} • #${activeTileId} (${repKey}) • ${fam.tileIds.length}v • ${previewLabels[uiState.previewMode] || ''}`;

    let hover;
    if (uiState.hoverNorm) {
      const xStr = uiState.hoverNorm.nx >= 0 ? `+${uiState.hoverNorm.nx.toFixed(3)}` : uiState.hoverNorm.nx.toFixed(3);
      const yStr = uiState.hoverNorm.ny >= 0 ? `+${uiState.hoverNorm.ny.toFixed(3)}` : uiState.hoverNorm.ny.toFixed(3);
      const toolTag = ve ? ` • Ferramenta: <strong>${ve.state.activeTool.toUpperCase()}</strong>` : '';
      hover = `Coordenada Normalizada: <strong>(${xStr}, ${yStr})</strong>${toolTag} • Duplo-clique numa variante D4 para pintar no Mosaico`;
    } else if (fam.builtIn) {
      hover = `Mestre padrão protegido (slots 0..84) • Clique em <strong>Duplicar p/ Editar</strong> (Ctrl+D) para desenhar livremente`;
    } else {
      hover = `Editor Vetorial ativo • V Seleção | A Nós | P Caneta | M Retâng. | L Elipse | G Polígono | U Arco/Fita | \\ Linha`;
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


    const { store, ve } = resolveDeps();

    document.querySelectorAll('[data-tile-panel]').forEach((btn, index, tabs) => {
      btn.addEventListener('click', () => setInspectorPanel(btn.dataset.tilePanel));
      btn.addEventListener('keydown', (e) => {
        const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
        if (next !== null) { e.preventDefault(); e.stopPropagation(); setInspectorPanel(tabs[next].dataset.tilePanel, true); }
      });
    });
    // Keep family metadata beside its library, leaving the variants panel focused on previews.
    const libraryDetails = document.getElementById('tileLibraryDetails');
    ['tileReadOnlyNotice', 'tileCustomMetaBox'].forEach((id) => {
      const el = document.getElementById(id);
      if (libraryDetails && el) libraryDetails.appendChild(el);
    });
    const selectObjects = (all) => {
      const doc = getSelectedFamilyDoc();
      if (!ve || !doc || doc.builtIn || doc.protected) return;
      ve.state.selectedShapeIds = all ? (doc.shapes || []).filter((s) => s && !s.locked && s.visible !== false).map((s) => s.id) : [];
      ve.state.selectedNodes = []; setVectorTool('select');
      renderShapePropsPanel(true); renderLayersPanel(); requestHostRedraw();
    };
    document.getElementById('btnTileSelectAll')?.addEventListener('click', () => selectObjects(true));
    document.getElementById('btnTileDeselect')?.addEventListener('click', () => selectObjects(false));
    document.getElementById('tileLibraryGroupFilter')?.addEventListener('change', (e) => {
      uiState.libraryGroupFilter = e.target.value; renderLibraryManagerTree();
    });
    document.getElementById('btnTileExpandGroups')?.addEventListener('click', () => {
      uiState.collapsedGroups.clear(); renderLibraryManagerTree();
    });
    document.getElementById('btnTileCollapseGroups')?.addEventListener('click', () => {
      const { reg } = resolveDeps();
      uiState.collapsedGroups = new Set((reg?.getOrderedGroupedFamilies() || []).map((g) => g.id)); renderLibraryManagerTree();
    });
    document.getElementById('btnTileLocateFamily')?.addEventListener('click', () => {
      uiState.libraryGroupFilter = ''; uiState.filterMode = 'all'; uiState.searchQuery = '';
      const search = document.getElementById('libMgrSearchInput'); if (search) search.value = '';
      const fam = getSelectedFamilyMeta(); if (fam) uiState.collapsedGroups.delete(fam.groupId);
      renderLibraryManagerTree();
      const row = Array.from(document.querySelectorAll('.lib-family-row')).find((el) => el.dataset.familyId === uiState.selectedFamilyId);
      row?.scrollIntoView({ block: 'center' }); row?.focus();
    });

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
    document.getElementById('btnVecUndo')?.addEventListener('click', () => {
      handleVecUndo();
    });
    document.getElementById('btnVecRedo')?.addEventListener('click', () => {
      handleVecRedo();
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
      if (ve) ve.ensureFamilyHistory(fam.id, famDoc);
      const nextClip = !famDoc.clipToTile;
      const res = store.updateFamily(fam.id, { clipToTile: nextClip });
      if (ve && res && res.family) {
        ve.recordFamilySnapshot(fam.id, res.family.shapes, res.family.clipToTile);
      }
      refresh();
      requestHostRedraw();
    });

    document.getElementById('btnTileTestInMosaic')?.addEventListener('click', () => {
      const fam = ensureValidSelection();
      if (!fam) return;
      const tid = fam.tileIds[uiState.selectedVariantIndex] ?? fam.tileIds[0];
      closeTilesStudio({ paintWithTileId: tid });
    });

    // Vector Tool Buttons & Magnetic Snap Controls in Left Pane
    document.querySelectorAll('#vecToolsGrid [data-vec-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setVectorTool(btn.dataset.vecTool || 'select');
      });
    });

    document.getElementById('btnTileSnapToggle')?.addEventListener('click', () => {
      if (!ve) return;
      ve.state.snapEnabled = !ve.state.snapEnabled;
      renderLeftPaneState();
      renderShapePropsPanel(true);
      notifyToast(ve.state.snapEnabled ? 'Ímã Magnético: Ativado' : 'Ímã Magnético: Desativado');
    });

    document.getElementById('tileGridDivSelect')?.addEventListener('change', (e) => {
      if (!ve) return;
      ve.state.gridDiv = parseInt(e.target.value, 10) || 0;
      renderLeftPaneState();
      renderShapePropsPanel(true);
      requestHostRedraw();
    });

    // Left rail quick actions & guide toggles in Tiles Mode
    document.getElementById('btnRailNewSubtile')?.addEventListener('click', () => handleCreateFamily());
    document.getElementById('btnRailDuplicateSubtile')?.addEventListener('click', () => handleDuplicateFamily(uiState.selectedFamilyId));
    document.getElementById('btnRailNewGroup')?.addEventListener('click', () => handleCreateGroup());

    const bindTileGuide = (btnId, guideKey) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        uiState.guides[guideKey] = !uiState.guides[guideKey];
        const { ve } = resolveDeps();
        if (guideKey === 'showPorts' && ve) {
          ve.state.snapPorts = Boolean(uiState.guides.showPorts);
        }
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
        hostCtx.setActiveTool(hostCtx.studioState.activeTool === 'pan' ? 'inspect' : 'pan');
        syncNavigationState();
      }
    });
    document.getElementById('btnTileViewZoom')?.addEventListener('click', () => {
      if (hostCtx && typeof hostCtx.setActiveTool === 'function') {
        hostCtx.setActiveTool(hostCtx.studioState.activeTool === 'zoom' ? 'inspect' : 'zoom');
        syncNavigationState();
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
    document.getElementById('btnQuickLibraryBackup')?.addEventListener('click', exportFull);
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

    // Fase D: SVG Import / Export & Layer Z-Order toolbar
    const svgInput = document.getElementById('subtileSvgFileInput');
    const openSvgPicker = () => {
      if (svgInput) {
        svgInput.value = '';
        svgInput.click();
      }
    };
    document.getElementById('btnImportSubtileSvg')?.addEventListener('click', openSvgPicker);
    document.getElementById('btnLayersImportSvg')?.addEventListener('click', openSvgPicker);
    svgInput?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        handleImportSvgText(String(reader.result || ''), file.name);
      };
      reader.onerror = () => {
        notifyToast('Erro ao ler o arquivo SVG selecionado.', 'error');
      };
      reader.readAsText(file);
    });
    document.getElementById('btnExportSubtileSvg')?.addEventListener('click', () => handleExportSubtileSvg());
    document.getElementById('btnLayersExportSvg')?.addEventListener('click', () => handleExportSubtileSvg());

    const reorderSelected = (target) => {
      const { vb } = resolveDeps();
      const famDoc = getSelectedFamilyDoc();
      if (!vb || !ve || !famDoc || famDoc.builtIn || famDoc.protected) return;
      if (ve.state.selectedShapeIds.length !== 1) return;
      commitFamilyShapes(famDoc.id, vb.reorderShapeZ(famDoc.shapes || [], ve.state.selectedShapeIds[0], target));
    };
    document.getElementById('btnLayerBringFront')?.addEventListener('click', () => reorderSelected('front'));
    document.getElementById('btnLayerSendBack')?.addEventListener('click', () => reorderSelected('back'));

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
      const applySolo = () => {
      hostCtx.studioState.allowedTiles.clear();
      fam.tileIds.forEach((id) => hostCtx.studioState.allowedTiles.add(id));
      if (typeof hostCtx.renderSwatchesPanel === 'function') hostCtx.renderSwatchesPanel();
      if (typeof hostCtx.regenerateMosaic === 'function') hostCtx.regenerateMosaic(true);
      if (typeof hostCtx.setActiveTool === 'function') hostCtx.setActiveTool('inspect');
      closeTilesStudio();
      notifyToast(`Família "${fam.name}" isolada (SOLO) no mosaico.`);
      };
      if (typeof hostCtx.requestParamChangeWithGuard === 'function') {
        hostCtx.requestParamChangeWithGuard(document.getElementById('btnSoloActiveInMosaic'), () => {}, applySolo);
      } else applySolo();
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

    const { ve } = resolveDeps();
    const famDoc = getSelectedFamilyDoc();
    const isEditable = Boolean(famDoc && !famDoc.builtIn && !famDoc.protected && ve);

    // Enter commits an active open Pen path
    if (e.key === 'Enter' && isEditable && ve.state.penSession) {
      e.preventDefault();
      const committed = ve.finalizePenPath(famDoc, false);
      if (committed) commitFamilyShapes(famDoc.id, committed);
      return true;
    }

    // Progressive Escape: 1) finish/cancel Pen -> 2) clear vector selection -> 3) return to Mosaic
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isEditable && ve.state.penSession) {
        const committed = ve.finalizePenPath(famDoc, false);
        if (committed) commitFamilyShapes(famDoc.id, committed);
        else {
          renderShapePropsPanel(true);
          requestHostRedraw();
        }
        return true;
      }
      if (ve && (ve.state.selectedShapeIds.length > 0 || ve.state.selectedNodes.length > 0)) {
        ve.state.selectedShapeIds = [];
        ve.state.selectedNodes = [];
        renderShapePropsPanel(true);
        renderLayersPanel();
        requestHostRedraw();
        return true;
      }
      closeTilesStudio();
      return true;
    }

    // Ctrl / Cmd shortcuts inside Subtile Studio
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === '1' || k === '0') {
        return false; // Let sketch.js handle zoom 100% / fit to window
      }
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleVecUndo();
        return true;
      }
      if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleVecRedo();
        return true;
      }
      if (k === 'c' && isEditable) {
        e.preventDefault();
        const copied = ve.copySelectedShapes(famDoc.shapes || [], ve.state.selectedShapeIds);
        if (copied.length > 0) notifyToast(`${copied.length} forma(s) copiada(s).`);
        return true;
      }
      if (k === 'v' && isEditable) {
        e.preventDefault();
        const pasted = ve.pasteFromClipboard(famDoc.shapes || []);
        if (pasted.newIds.length > 0) {
          ve.state.selectedShapeIds = pasted.newIds;
          commitFamilyShapes(famDoc.id, pasted.shapes);
        }
        return true;
      }
      if (k === 'd') {
        e.preventDefault();
        if (isEditable && ve.state.selectedShapeIds.length > 0) {
          const dup = ve.duplicateSelectedShapes(famDoc.shapes || [], ve.state.selectedShapeIds);
          if (dup.newIds.length > 0) {
            ve.state.selectedShapeIds = dup.newIds;
            commitFamilyShapes(famDoc.id, dup.shapes);
          }
        } else {
          handleDuplicateFamily(uiState.selectedFamilyId);
        }
        return true;
      }
      if (k === 'a' && isEditable) {
        e.preventDefault();
        ve.state.selectedShapeIds = (famDoc.shapes || [])
          .filter((s) => s && !s.locked && s.visible !== false)
          .map((s) => s.id);
        renderShapePropsPanel(true);
        renderLayersPanel();
        requestHostRedraw();
        return true;
      }
      if ((e.key === ']' || e.key === '[' || e.code === 'BracketRight' || e.code === 'BracketLeft') && isEditable) {
        e.preventDefault();
        const { vb } = resolveDeps();
        if (vb && ve.state.selectedShapeIds.length === 1) {
          const isUp = e.key === ']' || e.key === '}' || e.code === 'BracketRight';
          const target = isUp ? (e.shiftKey ? 'front' : 'forward') : (e.shiftKey ? 'back' : 'backward');
          commitFamilyShapes(famDoc.id, vb.reorderShapeZ(famDoc.shapes || [], ve.state.selectedShapeIds[0], target));
        }
        return true;
      }
      if (k === 'u' && ve) {
        e.preventDefault();
        ve.state.snapEnabled = !ve.state.snapEnabled;
        renderLeftPaneState();
        renderShapePropsPanel(true);
        notifyToast(ve.state.snapEnabled ? 'Ímã Magnético: Ativado' : 'Ímã Magnético: Desativado');
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

    // Vector Tool Single-Key Shortcuts (V, A, P, M, L, G, U, \, ;)
    if (ve) {
      const toolKeyMap = {
        v: 'select',
        a: 'direct',
        p: 'pen',
        m: 'rect',
        l: 'ellipse',
        g: 'polygon',
        u: 'arc',
        '\\': 'line'
      };
      if (toolKeyMap[k]) {
        e.preventDefault();
        setVectorTool(toolKeyMap[k]);
        return true;
      }
      if (e.key === ';') {
        e.preventDefault();
        ve.state.snapEnabled = !ve.state.snapEnabled;
        renderLeftPaneState();
        renderShapePropsPanel(true);
        notifyToast(ve.state.snapEnabled ? 'Ímã Magnético: Ativado' : 'Ímã Magnético: Desativado');
        return true;
      }
    }

    // Delete / Backspace removes selected nodes (direct) or selected shapes (select)
    if ((e.key === 'Delete' || e.key === 'Backspace') && isEditable) {
      e.preventDefault();
      if (ve.state.penSession && ve.state.penSession.nodes.length > 0) {
        ve.state.penSession.nodes.pop();
        if (ve.state.penSession.nodes.length === 0) {
          ve.state.penSession = null;
          ve.state.workingShapes = null;
          ve.state.workingFamilyId = null;
        }
        renderShapePropsPanel(true);
        requestHostRedraw();
        return true;
      }
      if (ve.state.activeTool === 'direct' && ve.state.selectedNodes.length > 0) {
        const byShape = new Map();
        for (const ref of ve.state.selectedNodes) {
          if (!byShape.has(ref.shapeId)) byShape.set(ref.shapeId, []);
          byShape.get(ref.shapeId).push(ref);
        }
        const nextShapes = [];
        for (const sh of (famDoc.shapes || [])) {
          if (!sh || !byShape.has(sh.id)) {
            nextShapes.push(JSON.parse(JSON.stringify(sh)));
          } else {
            const updated = ve.deletePathNodes(sh, byShape.get(sh.id));
            if (updated) nextShapes.push(updated);
          }
        }
        ve.state.selectedNodes = [];
        commitFamilyShapes(famDoc.id, nextShapes);
        return true;
      }
      if (ve.state.selectedShapeIds.length > 0) {
        const sel = new Set(ve.state.selectedShapeIds);
        const nextShapes = (famDoc.shapes || []).filter((s) => s && !sel.has(s.id));
        ve.state.selectedShapeIds = [];
        ve.state.selectedNodes = [];
        commitFamilyShapes(famDoc.id, nextShapes);
      }
      return true;
    }

    // Arrow key precision nudging in normalized coordinates
    if (isEditable && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const baseStep = ve.state.gridDiv > 0 ? (1 / (ve.state.gridDiv * 4)) : 0.01;
      const step = e.shiftKey ? baseStep * 4 : baseStep;
      const du = e.key === 'ArrowLeft' ? -step : (e.key === 'ArrowRight' ? step : 0);
      const dv = e.key === 'ArrowUp' ? -step : (e.key === 'ArrowDown' ? step : 0);

      if (ve.state.activeTool === 'direct' && ve.state.selectedNodes.length > 0) {
        const byShape = new Map();
        for (const ref of ve.state.selectedNodes) {
          if (!byShape.has(ref.shapeId)) byShape.set(ref.shapeId, []);
          byShape.get(ref.shapeId).push(ref);
        }
        const nextShapes = (famDoc.shapes || []).map((sh) =>
          (sh && byShape.has(sh.id)) ? ve.movePathNodes(sh, byShape.get(sh.id), du, dv) : JSON.parse(JSON.stringify(sh))
        );
        commitFamilyShapes(famDoc.id, nextShapes);
        return true;
      }
      if (ve.state.selectedShapeIds.length > 0) {
        const sel = new Set(ve.state.selectedShapeIds);
        const nextShapes = (famDoc.shapes || []).map((sh) =>
          (sh && sel.has(sh.id) && !sh.locked) ? ve.translateShape(sh, du, dv) : JSON.parse(JSON.stringify(sh))
        );
        commitFamilyShapes(famDoc.id, nextShapes);
      }
      return true;
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

    // Suppress Mosaic-only single-key shortcuts (B, E, F, R, S, Q, Tab, etc.)
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
    setVectorTool,
    commitFamilyShapes,
    handleVecUndo,
    handleVecRedo,
    handleImportSvgText,
    handleExportSubtileSvg,
    renderLayersPanel,
    setInspectorPanel,
    renderViewport,
    screenToNormalizedMaster,
    handleViewportMouseDown,
    handleViewportMouseDragged,
    handleViewportMouseUp,
    handleViewportDoubleClick,
    handleViewportMouseMoved,
    getStatusBarTexts,
    syncNavigationState,
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

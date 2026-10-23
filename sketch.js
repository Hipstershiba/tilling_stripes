/**
 * sketch.js
 * Main Studio Controller for Tiling Stripes v2 (Phase 1: Generator & Phase 2: D4 Live Mosaic Editor).
 */

const StudioState = {
  // Workspace Context ('generate' | 'edit')
  workspace: 'generate',

  // Artboard / Canvas
  width: 600,
  height: 600,
  lockCanvasRatio: false,
  canvasRatio: 1,
  zoomPercent: 100,
  zoomMode: '100',

  // Grid & Structure
  rows: 3,
  cols: 3,
  lockGridRatio: false,
  gridRatio: 1,
  margin: 24,
  subdivision: 2, // 2x2 subtiles per quadrant -> 4x4 subtiles per block
  paddingRatio: 0.05,

  // Symmetry
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,

  // Colors
  fgColor: '#e2e0dc',
  bgColor: '#0c0c0e',

  // Seed & Allowed Tiles
  seed: 1024,
  allowedTiles: new Set(),
  searchQuery: '',

  // Freeze / Lock Subtiles State
  frozenCells: new Map(), // key: `${r},${c},${subR},${subC}` -> { baseTileId, transform, tileId }
  freezeMode: 'freeze', // 'freeze' | 'unfreeze'
  freezeSize: '1', // '1' | '2' | '3' | '4' | 'block'
  freezeUseScope: true,
  isFreezingDrag: false,
  freezeDragAction: 'freeze',
  lastFrozenCellKey: null,

  // Active Tool & Guides ('inspect' | 'paint' | 'rotate' | 'stamp' | 'pan' | 'zoom')
  activeTool: 'inspect',
  isSpaceDown: false,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panOffsetX: 0,
  panOffsetY: 0,
  panStartOffsetX: 0,
  panStartOffsetY: 0,

  // Stage 2: D4 Mosaic Editing State
  editScope: 'canvas_center', // 'canvas_center' | 'orbit_sym' | 'block_sym' | 'all_blocks' | 'single' | 'same_tile'
  canvasCenterSymmetry: 'mandala_d4', // 'mandala_d4' | 'rotational_c4' | 'bilateral_d2' | 'mirror_x' | 'mirror_y'
  editBrushTileId: 2,
  editBrushTransform: 'id',
  editBrushSearchQuery: '',
  brushSizeMode: '1', // '1' | '2' | '3' | '4' | 'block' | 'custom'
  brushSnapToBlock: false,
  supertilePattern: null,
  isPaintingMiniBuilder: false,

  // Rotate Tool State
  rotateSizeMode: '1', // '1' | '2' | '3' | '4' | 'block'
  rotateSnapToBlock: false,
  rotateGroupMode: 'group', // 'group' | 'individual'
  rotateBehavior: 'd4_r90', // 'd4_r90' | 'family'

  // Clone / Stamp Interaction State
  stampBlock: null,
  stampTransform: 'id',
  stampInteractionMode: 'select', // 'select' | 'apply'
  isSelectingStampDrag: false,
  stampDragStartGR: 0,
  stampDragStartGC: 0,
  stampDragCurrGR: 0,
  stampDragCurrGC: 0,
  isPaintingDrag: false,
  lastPaintedCellKey: null,
  pendingEditHistoryPush: false,
  editHistory: [],
  editHistoryIndex: -1,
  // Parameters of the document as it was last rendered (used by document-level undo).
  lastDocumentParams: null,

  guides: {
    showSymmetryAxes: false,
    showBlockGrid: false,
    showSubtileGrid: false,
    showOrbitBadges: false,
    highlightHoverOrbit: true
  },

  // Runtime Data
  mosaicData: null,
  hoveredCell: null,
  thumbnailCache: new Map(),
  savedCellsSnapshot: null,

  // Generation History
  history: [],
  historyIndex: -1,
  isRestoringHistory: false,

  // Workspace UI Layout & Drawer/Panels State
  rightDockCollapsed: false,
  dockPanels: {}
};

const LOCK_ICON_SVG = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>`;

const UNLOCK_ICON_SVG = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
  </svg>`;

const SYMMETRY_ICONS_SVG = {
  sync: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  mandala_d4: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/><line x1="18.4" y1="5.6" x2="5.6" y2="18.4"/></svg>`,
  kaleidoscope: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  rotational_c4: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="16 3 21 3 21 8"/></svg>`,
  bilateral_d2: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>`
};

const EDIT_SCOPE_ICONS = {
  canvas_center: '⊕',
  orbit_sym: '✦',
  block_sym: '❖',
  all_blocks: '⊞',
  single: '▪',
  same_tile: '⇄'
};

function ensureSupertilePattern() {
  if (!StudioState.supertilePattern || !StudioState.supertilePattern.cells) {
    StudioState.supertilePattern = window.MosaicEngine.createSupertilePattern(
      1,
      1,
      StudioState.editBrushTileId,
      StudioState.editBrushTransform || 'id'
    );
  }
  return StudioState.supertilePattern;
}

// ============================================================================
// State Persistence (Preserve Mosaic Across Page Reloads)
// ============================================================================

const STORAGE_KEY_STUDIO_STATE = window.StatePersistence ? window.StatePersistence.STORAGE_KEY_STUDIO_STATE : null;

let toastTimer = null;
function showEditorToast(message, type = 'info') {
  const el = document.getElementById('editorToast');
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 4200);
}

function showPersistenceWarning(msg) {
  const el = document.getElementById('persistenceWarning');
  if (el) {
    if (msg) el.textContent = msg;
    el.classList.remove('hidden');
  }
}

function hidePersistenceWarning() {
  const el = document.getElementById('persistenceWarning');
  if (el) {
    el.classList.add('hidden');
  }
}


const MAX_GENERATION_HISTORY = 30;
const MAX_EDIT_HISTORY = 25;
const IDB_MAX_GENERATION_HISTORY = 256;
const IDB_MAX_EDIT_HISTORY = 100;

const saveScheduler = (typeof window !== 'undefined' && window.StatePersistence && typeof window.StatePersistence.createSaveScheduler === 'function')
  ? window.StatePersistence.createSaveScheduler({
      save: () => saveStudioStateToStorage(),
      delayMs: 300
    })
  : {
      schedule: () => saveStudioStateToStorage(),
      flush: () => false,
      cancel: () => {},
      pending: () => false
    };

function scheduleSaveStudioStateToStorage() {
  saveScheduler.schedule();
}

function flushSaveStudioStateToStorage() {
  return saveScheduler.flush();
}

function isQuotaError(err) {
  return window.StatePersistence ? window.StatePersistence.isQuotaError(err) : (
    Boolean(err) && (err.name === 'QuotaExceededError' || err.code === 22)
  );
}

function getMaxEditHistoryForMosaic(mosaicData) {
  return window.StatePersistence ? window.StatePersistence.getMaxEditHistoryForMosaic(mosaicData) : 25;
}

function buildStudioStatePayload(includeHistories = true) {
  if (!StudioState.mosaicData) return null;
  const cellsSnapshot = window.MosaicEngine.cloneMosaicCellsSnapshot(StudioState.mosaicData);
  const totalTiles = window.TileRegistry.TILE_RENDERERS.length;

  return {
    version: (window.StatePersistence && window.StatePersistence.STORAGE_VERSION) || 3,
    totalTiles,
    timestamp: Date.now(),
    width: StudioState.width,
    height: StudioState.height,
    lockCanvasRatio: StudioState.lockCanvasRatio,
    canvasRatio: StudioState.canvasRatio,
    zoomPercent: StudioState.zoomPercent,
    zoomMode: StudioState.zoomMode,

    rows: StudioState.rows,
    cols: StudioState.cols,
    lockGridRatio: StudioState.lockGridRatio,
    gridRatio: StudioState.gridRatio,
    margin: StudioState.margin,
    subdivision: StudioState.subdivision,
    paddingRatio: StudioState.paddingRatio,

    gridSymmetryMode: StudioState.gridSymmetryMode,
    blockSymmetryMode: StudioState.blockSymmetryMode,
    syncBlockSymmetry: StudioState.syncBlockSymmetry,

    fgColor: StudioState.fgColor,
    bgColor: StudioState.bgColor,

    seed: StudioState.seed,
    allowedTiles: Array.from(StudioState.allowedTiles),

    workspace: StudioState.workspace,
    activeTool: StudioState.activeTool,
    editScope: StudioState.editScope,
    canvasCenterSymmetry: StudioState.canvasCenterSymmetry,
    editBrushTileId: StudioState.editBrushTileId,
    editBrushTransform: StudioState.editBrushTransform,
    brushSizeMode: StudioState.brushSizeMode,
    brushSnapToBlock: StudioState.brushSnapToBlock,
    supertilePattern: StudioState.supertilePattern,

    rotateSizeMode: StudioState.rotateSizeMode,
    rotateSnapToBlock: StudioState.rotateSnapToBlock,
    rotateGroupMode: StudioState.rotateGroupMode,
    rotateBehavior: StudioState.rotateBehavior,

    stampInteractionMode: StudioState.stampInteractionMode,

    guides: StudioState.guides,
    rightDockCollapsed: !!StudioState.rightDockCollapsed,
    dockPanels: StudioState.dockPanels ? Object.assign({}, StudioState.dockPanels) : {},
    cellsSnapshot,
    frozenCells: StudioState.frozenCells ? Array.from(StudioState.frozenCells.entries()) : [],
    freezeMode: StudioState.freezeMode,
    freezeSize: StudioState.freezeSize,
    freezeUseScope: StudioState.freezeUseScope,

    history: includeHistories ? StudioState.history : [],
    historyIndex: includeHistories ? StudioState.historyIndex : -1,
    editHistory: includeHistories ? StudioState.editHistory : [],
    editHistoryIndex: includeHistories ? StudioState.editHistoryIndex : -1
  };
}

function saveStudioStateToStorage() {
  if (!StudioState.mosaicData) return;

  const fullPayload = buildStudioStatePayload(true);
  if (!fullPayload) return;

  const persistence = window.StatePersistence;

  // 1. Primary Rich Storage: IndexedDB (asynchronous, gigabyte quota)
  if (persistence && typeof persistence.saveToIndexedDB === 'function' && typeof indexedDB !== 'undefined') {
    persistence.saveToIndexedDB(persistence.IDB_KEY_CURRENT, fullPayload).catch((err) => {
      console.warn('IndexedDB save failed:', err);
    });
  }

  // 2. Fast synchronous boot cache: localStorage
  if (persistence && typeof persistence.saveWithQuotaFallback === 'function') {
    const res = persistence.saveWithQuotaFallback(
      localStorage,
      STORAGE_KEY_STUDIO_STATE,
      fullPayload,
      StudioState.mosaicData
    );
    if (res.success) {
      if (typeof indexedDB === 'undefined' && res.mode === 'fallback_minimal') {
        showPersistenceWarning(res.warning);
      } else {
        hidePersistenceWarning();
      }
    } else {
      if (typeof indexedDB === 'undefined') {
        showPersistenceWarning(res.warning || 'Não foi possível salvar automaticamente no navegador.');
      }
    }
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY_STUDIO_STATE, JSON.stringify(fullPayload));
    hidePersistenceWarning();
  } catch (err) {
    if (typeof indexedDB === 'undefined') {
      if (isQuotaError(err)) {
        try {
          const minPayload = buildStudioStatePayload(false);
          localStorage.setItem(STORAGE_KEY_STUDIO_STATE, JSON.stringify(minPayload));
          showPersistenceWarning('Limite de armazenamento atingido. O histórico foi liberado, mas o desenho atual foi salvo com sucesso.');
        } catch (errMin) {
          showPersistenceWarning('Não foi possível salvar automaticamente no navegador. Exporte seu trabalho para evitar perda de dados.');
        }
      } else {
        showPersistenceWarning('Não foi possível salvar automaticamente no navegador.');
        console.warn('Failed to save StudioState to localStorage:', err);
      }
    }
  }
}

function applySavedStudioState(saved) {
  if (!saved || typeof saved !== 'object') return false;

  const totalTiles = window.TileRegistry.TILE_RENDERERS.length;

  // Artboard
  if (typeof saved.width === 'number' && saved.width >= 100 && saved.width <= 4096) StudioState.width = saved.width;
  if (typeof saved.height === 'number' && saved.height >= 100 && saved.height <= 4096) StudioState.height = saved.height;
  if (typeof saved.lockCanvasRatio === 'boolean') StudioState.lockCanvasRatio = saved.lockCanvasRatio;
  if (typeof saved.canvasRatio === 'number') StudioState.canvasRatio = saved.canvasRatio;
  if (typeof saved.zoomPercent === 'number') StudioState.zoomPercent = saved.zoomPercent;
  if (typeof saved.zoomMode === 'string') StudioState.zoomMode = saved.zoomMode;

  // Grid
  if (typeof saved.rows === 'number' && saved.rows >= 1 && saved.rows <= 32) StudioState.rows = saved.rows;
  if (typeof saved.cols === 'number' && saved.cols >= 1 && saved.cols <= 32) StudioState.cols = saved.cols;
  if (typeof saved.lockGridRatio === 'boolean') StudioState.lockGridRatio = saved.lockGridRatio;
  if (typeof saved.gridRatio === 'number') StudioState.gridRatio = saved.gridRatio;
  if (typeof saved.margin === 'number' && saved.margin >= 0) StudioState.margin = saved.margin;
  if (typeof saved.subdivision === 'number' && saved.subdivision >= 1 && saved.subdivision <= 4) StudioState.subdivision = saved.subdivision;
  if (typeof saved.paddingRatio === 'number' && saved.paddingRatio >= 0 && saved.paddingRatio <= 0.5) StudioState.paddingRatio = saved.paddingRatio;

  // Symmetry
  if (typeof saved.gridSymmetryMode === 'string' && window.D4Symmetry.SYMMETRY_MODES[saved.gridSymmetryMode]) {
    StudioState.gridSymmetryMode = saved.gridSymmetryMode;
  }
  if (typeof saved.blockSymmetryMode === 'string' && window.D4Symmetry.SYMMETRY_MODES[saved.blockSymmetryMode]) {
    StudioState.blockSymmetryMode = saved.blockSymmetryMode;
  }
  if (typeof saved.syncBlockSymmetry === 'boolean') StudioState.syncBlockSymmetry = saved.syncBlockSymmetry;

  // Colors
  if (typeof saved.fgColor === 'string') StudioState.fgColor = saved.fgColor;
  if (typeof saved.bgColor === 'string') StudioState.bgColor = saved.bgColor;

  // Seed
  if (typeof saved.seed === 'number') StudioState.seed = saved.seed;

  // Allowed Tiles (Automatically include newly added tiles if user had all tiles selected)
  if (Array.isArray(saved.allowedTiles)) {
    const validAllowed = saved.allowedTiles.filter((id) => Number.isInteger(id) && id >= 0 && id < totalTiles);
    if (validAllowed.length > 0) {
      const hadAllTiles = saved.allowedTiles.length >= (saved.totalTiles || totalTiles);
      StudioState.allowedTiles = new Set(validAllowed);
      if (hadAllTiles) {
        for (let i = 0; i < totalTiles; i++) {
          StudioState.allowedTiles.add(i);
        }
      }
    }
  }

  // Workspace & Tool State
  if (saved.workspace === 'generate' || saved.workspace === 'edit') StudioState.workspace = saved.workspace;
  if (typeof saved.activeTool === 'string') StudioState.activeTool = saved.activeTool;
  if (typeof saved.editScope === 'string' && window.MosaicEngine.EDIT_SCOPES[saved.editScope]) StudioState.editScope = saved.editScope;
  if (typeof saved.canvasCenterSymmetry === 'string') StudioState.canvasCenterSymmetry = saved.canvasCenterSymmetry;
  if (typeof saved.editBrushTileId === 'number' && saved.editBrushTileId >= 0 && saved.editBrushTileId < totalTiles) {
    StudioState.editBrushTileId = saved.editBrushTileId;
  }
  if (typeof saved.editBrushTransform === 'string') StudioState.editBrushTransform = saved.editBrushTransform;
  if (typeof saved.brushSizeMode === 'string') StudioState.brushSizeMode = saved.brushSizeMode;
  if (typeof saved.brushSnapToBlock === 'boolean') StudioState.brushSnapToBlock = saved.brushSnapToBlock;

  // Supertile pattern
  if (saved.supertilePattern && Array.isArray(saved.supertilePattern.cells)) {
    const pat = saved.supertilePattern;
    for (let r = 0; r < pat.rows; r++) {
      for (let c = 0; c < pat.cols; c++) {
        const cell = pat.cells[r]?.[c];
        if (cell) {
          if (!Number.isInteger(cell.baseTileId) || cell.baseTileId < 0 || cell.baseTileId >= totalTiles) {
            cell.baseTileId = 0;
          }
          if (!Number.isInteger(cell.tileId) || cell.tileId < 0 || cell.tileId >= totalTiles) {
            cell.tileId = cell.baseTileId;
          }
        }
      }
    }
    StudioState.supertilePattern = pat;
    StudioState.stampBlock = pat;
  }

  // Rotate tool options
  if (typeof saved.rotateSizeMode === 'string') StudioState.rotateSizeMode = saved.rotateSizeMode;
  if (typeof saved.rotateSnapToBlock === 'boolean') StudioState.rotateSnapToBlock = saved.rotateSnapToBlock;
  if (typeof saved.rotateGroupMode === 'string') StudioState.rotateGroupMode = saved.rotateGroupMode;
  if (typeof saved.rotateBehavior === 'string') StudioState.rotateBehavior = saved.rotateBehavior;
  if (typeof saved.stampInteractionMode === 'string') StudioState.stampInteractionMode = saved.stampInteractionMode;

  // Frozen Cells
  if (Array.isArray(saved.frozenCells)) {
    StudioState.frozenCells = new Map(saved.frozenCells);
  }
  if (saved.freezeMode === 'freeze' || saved.freezeMode === 'unfreeze') StudioState.freezeMode = saved.freezeMode;
  if (['1', '2', '3', '4', 'block'].includes(saved.freezeSize)) StudioState.freezeSize = saved.freezeSize;
  if (typeof saved.freezeUseScope === 'boolean') StudioState.freezeUseScope = saved.freezeUseScope;

  // Guides
  if (saved.guides && typeof saved.guides === 'object') {
    StudioState.guides = Object.assign({}, StudioState.guides, saved.guides);
  }

  // Right Dock Drawer & Accordion Panels
  if (typeof saved.rightDockCollapsed === 'boolean') {
    StudioState.rightDockCollapsed = saved.rightDockCollapsed;
  }
  if (saved.dockPanels && typeof saved.dockPanels === 'object') {
    StudioState.dockPanels = Object.assign({}, saved.dockPanels);
  }

  // Cells snapshot for mosaic reconstruction
  if (saved.cellsSnapshot && Array.isArray(saved.cellsSnapshot.gridSnap)) {
    StudioState.savedCellsSnapshot = saved.cellsSnapshot;
  }

  // Histories (validated and clamped to bounds)
  if (Array.isArray(saved.history) && saved.history.length > 0) {
    let hist = saved.history;
    let hIdx = typeof saved.historyIndex === 'number' ? saved.historyIndex : hist.length - 1;
    const maxGen = (typeof indexedDB !== 'undefined' && window.StatePersistence && window.StatePersistence.IDB_MAX_GENERATION_HISTORY) || MAX_GENERATION_HISTORY;
    if (hist.length > maxGen) {
      const trimmed = hist.length - maxGen;
      hist = hist.slice(-maxGen);
      hIdx = Math.max(0, hIdx - trimmed);
    }
    StudioState.history = hist;
    StudioState.historyIndex = Math.max(0, Math.min(StudioState.history.length - 1, hIdx));
  } else {
    StudioState.history = [];
    StudioState.historyIndex = -1;
  }

  if (Array.isArray(saved.editHistory) && saved.editHistory.length > 0) {
    let eHist = saved.editHistory.filter((snap) => {
      return snap && snap.rows === StudioState.rows && snap.cols === StudioState.cols && Array.isArray(snap.gridSnap);
    });
    let eIdx = typeof saved.editHistoryIndex === 'number' ? saved.editHistoryIndex : eHist.length - 1;
    const maxAllowedEdits = (typeof indexedDB !== 'undefined' && window.StatePersistence && window.StatePersistence.IDB_MAX_EDIT_HISTORY)
      ? window.StatePersistence.IDB_MAX_EDIT_HISTORY
      : getMaxEditHistoryForMosaic(StudioState.mosaicData);
    if (eHist.length > maxAllowedEdits) {
      const trimmed = eHist.length - maxAllowedEdits;
      eHist = eHist.slice(-maxAllowedEdits);
      eIdx = Math.max(0, eIdx - trimmed);
    }
    StudioState.editHistory = eHist;
    StudioState.editHistoryIndex = Math.max(0, Math.min(StudioState.editHistory.length - 1, eIdx));
  } else {
    StudioState.editHistory = [];
    StudioState.editHistoryIndex = -1;
  }

  return true;
}

function loadStudioStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STUDIO_STATE);
    if (!raw) return false;

    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return false;

    const persistence = window.StatePersistence;
    if (persistence && typeof persistence.validatePayloadVersion === 'function') {
      const vCheck = persistence.validatePayloadVersion(saved);
      if (vCheck.restore === false) {
        if (vCheck.backupKey) {
          try {
            localStorage.setItem(vCheck.backupKey, raw);
          } catch (_) {}
        }
        showPersistenceWarning(vCheck.warning || 'Versão do estado salva é incompatível com esta versão do aplicativo.');
        return false;
      }
      if (vCheck.warning) {
        showPersistenceWarning(vCheck.warning);
      }
    }

    return applySavedStudioState(saved);
  } catch (err) {
    console.warn('Failed to load StudioState from localStorage:', err);
    return false;
  }
}

function restoreMosaicFromSavedState() {
  if (!StudioState.savedCellsSnapshot) {
    regenerateMosaic(true);
    return;
  }

  // 1. Generate canonical mosaic structure (with frozen cells preserved)
  randomSeed(StudioState.seed);
  const allowedArray = Array.from(StudioState.allowedTiles).sort((a, b) => a - b);
  StudioState.mosaicData = window.MosaicEngine.generateMosaicWithFrozen(
    {
      rows: StudioState.rows,
      cols: StudioState.cols,
      subdivision: StudioState.subdivision,
      gridSymmetryMode: StudioState.gridSymmetryMode,
      blockSymmetryMode: StudioState.blockSymmetryMode,
      syncBlockSymmetry: StudioState.syncBlockSymmetry,
      allowedTiles: allowedArray
    },
    (arr) => arr[floor(random(arr.length))],
    StudioState.frozenCells
  );
  syncFreezeUI();

  // 2. Restore cells from savedCellsSnapshot if dimensions match
  const snap = StudioState.savedCellsSnapshot;
  const totalTiles = window.TileRegistry.TILE_RENDERERS.length;
  if (
    snap &&
    snap.rows === StudioState.rows &&
    snap.cols === StudioState.cols &&
    snap.subtilesPerSide === StudioState.mosaicData.subtilesPerSide &&
    Array.isArray(snap.gridSnap)
  ) {
    for (let r = 0; r < snap.rows; r++) {
      for (let c = 0; c < snap.cols; c++) {
        for (let sr = 0; sr < snap.subtilesPerSide; sr++) {
          for (let sc = 0; sc < snap.subtilesPerSide; sc++) {
            const cell = snap.gridSnap[r]?.[c]?.[sr]?.[sc];
            if (cell) {
              if (!Number.isInteger(cell.baseTileId) || cell.baseTileId < 0 || cell.baseTileId >= totalTiles) {
                cell.baseTileId = 0;
              }
              if (!Number.isInteger(cell.tileId) || cell.tileId < 0 || cell.tileId >= totalTiles) {
                cell.tileId = cell.baseTileId;
              }
            }
          }
        }
      }
    }
    window.MosaicEngine.restoreMosaicCellsSnapshot(StudioState.mosaicData, snap);
  } else {
    resetEditHistoryWithInitialSnapshot();
    pushGenerationHistory();
  }

  if (StudioState.brushSizeMode === 'block' && StudioState.mosaicData) {
    const N = StudioState.mosaicData.subtilesPerSide;
    StudioState.supertilePattern = window.MosaicEngine.resizeSupertilePattern(
      StudioState.supertilePattern,
      N,
      N,
      StudioState.editBrushTileId,
      StudioState.editBrushTransform
    );
  }
  renderSupertileBuilderCanvas();

  // If editHistory wasn't restored or is empty, initialize it
  if (!Array.isArray(StudioState.editHistory) || StudioState.editHistory.length === 0) {
    resetEditHistoryWithInitialSnapshot();
  } else {
    syncEditUndoUI();
  }

  renderHistoryUI();
  syncSymmetryPanelUI();
  updateStatusBar();
  applyZoomTransform();
  redraw();
}

window.clearStudioStorage = function () {
  localStorage.removeItem(STORAGE_KEY_STUDIO_STATE);
  console.log('Studio storage cleared.');
};

// ============================================================================
// p5.js Lifecycle
// ============================================================================

function setup() {
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  const hasSavedState = loadStudioStateFromStorage();

  const cnv = createCanvas(StudioState.width, StudioState.height);
  cnv.parent('canvas-stage');

  // Prevent right-click menu on canvas and bind direct canvas editing
  cnv.elt.addEventListener('contextmenu', (e) => e.preventDefault());
  cnv.elt.addEventListener('mousedown', handleCanvasMouseDown);

  const totalTiles = window.TileRegistry.TILE_RENDERERS.length;
  if (!hasSavedState || StudioState.allowedTiles.size === 0) {
    for (let i = 0; i < totalTiles; i++) {
      StudioState.allowedTiles.add(i);
    }
  } else {
    StudioState.allowedTiles = new Set(
      Array.from(StudioState.allowedTiles).filter((id) => Number.isInteger(id) && id >= 0 && id < totalTiles)
    );
    if (StudioState.allowedTiles.size === 0) {
      for (let i = 0; i < totalTiles; i++) {
        StudioState.allowedTiles.add(i);
      }
    }
  }

  ensureSupertilePattern();
  buildTileThumbnails();
  initStudioUI();

  if (hasSavedState && StudioState.savedCellsSnapshot) {
    restoreMosaicFromSavedState();
  } else {
    regenerateMosaic(true);
  }

  // Asynchronous IndexedDB migration & hydration
  if (typeof window !== 'undefined' && window.StatePersistence && typeof indexedDB !== 'undefined') {
    const persistence = window.StatePersistence;
    persistence.migrateLocalStorageToIndexedDB(localStorage, STORAGE_KEY_STUDIO_STATE).then(() => {
      if (!hasSavedState) {
        persistence.loadFromIndexedDB().then((idbState) => {
          if (idbState && typeof idbState === 'object') {
            const restored = applySavedStudioState(idbState);
            if (restored) {
              restoreMosaicFromSavedState();
              syncZoomUI();
              updateStatusBar();
              redraw();
            }
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  window.addEventListener('beforeunload', flushSaveStudioStateToStorage);

  requestAnimationFrame(() => {
    syncZoomUI();
    updateStatusBar();
  });

  noLoop();
}

function getEditPreviewState() {
  const isEditTool = StudioState.activeTool === 'paint' ||
    StudioState.activeTool === 'rotate' ||
    StudioState.activeTool === 'stamp';
  if (!isEditTool || StudioState.isSpaceDown || StudioState.isPanning || !StudioState.mosaicData) {
    return null;
  }

  const hit = StudioState.hoveredCell;
  const dragSelectionRect = StudioState.isSelectingStampDrag
    ? {
        minGR: Math.min(StudioState.stampDragStartGR, StudioState.stampDragCurrGR),
        minGC: Math.min(StudioState.stampDragStartGC, StudioState.stampDragCurrGC),
        maxGR: Math.max(StudioState.stampDragStartGR, StudioState.stampDragCurrGR),
        maxGC: Math.max(StudioState.stampDragStartGC, StudioState.stampDragCurrGC)
      }
    : null;

  if (StudioState.isSelectingStampDrag) {
    return {
      tool: StudioState.activeTool,
      scopeMode: StudioState.editScope,
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry,
      stampBlock: StudioState.stampBlock,
      dragSelectionRect,
      hoveredCell: hit
    };
  }

  if (StudioState.activeTool === 'stamp' && StudioState.stampInteractionMode === 'select') {
    return {
      tool: 'stamp',
      scopeMode: StudioState.editScope,
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry,
      stampBlock: StudioState.stampBlock,
      stampInteractionMode: 'select',
      snapToBlock: StudioState.brushSnapToBlock,
      hoveredCell: hit
    };
  }

  if (!hit) {
    return {
      tool: StudioState.activeTool,
      scopeMode: StudioState.editScope,
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry,
      stampBlock: StudioState.stampBlock,
      regionPlacements: []
    };
  }

  if (StudioState.activeTool === 'rotate') {
    const resolved = window.MosaicEngine.resolveRotateRegionPlacements(
      StudioState.mosaicData,
      hit,
      {
        rotateSize: StudioState.rotateSizeMode,
        snapToBlock: StudioState.rotateSnapToBlock,
        rotateGroupMode: StudioState.rotateGroupMode,
        rotateBehavior: StudioState.rotateBehavior,
        step: 1,
        scopeMode: StudioState.editScope,
        canvasCenterSymmetry: StudioState.canvasCenterSymmetry
      }
    );
    return {
      tool: 'rotate',
      scopeMode: StudioState.editScope,
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry,
      regionPlacements: resolved.placements,
      anchorBounds: resolved.anchorBounds
    };
  }

  // Paint or Stamp ('apply' mode): both use the unified Supertile / Brush pattern
  const activePattern = ensureSupertilePattern();
  const resolved = window.MosaicEngine.resolveStampRegionPlacements(
    StudioState.mosaicData,
    activePattern,
    hit,
    StudioState.editScope,
    'id',
    {
      snapToBlock: StudioState.brushSnapToBlock,
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry
    }
  );

  return {
    tool: StudioState.activeTool,
    scopeMode: StudioState.editScope,
    canvasCenterSymmetry: StudioState.canvasCenterSymmetry,
    stampBlock: StudioState.stampBlock,
    regionPlacements: resolved.placements,
    anchorBounds: resolved.anchorBounds
  };
}

function draw() {
  const layoutConfig = {
    width: StudioState.width,
    height: StudioState.height,
    margin: StudioState.margin,
    paddingRatio: StudioState.paddingRatio,
    fgColor: StudioState.fgColor,
    bgColor: StudioState.bgColor
  };

  const zoomScale = (StudioState.zoomPercent || 100) / 100;
  push();
  scale(zoomScale);
  window.MosaicEngine.renderMosaicToContext(window, StudioState.mosaicData, layoutConfig);
  const isEditTool = (StudioState.workspace === 'edit' && (
    StudioState.activeTool === 'paint' ||
    StudioState.activeTool === 'rotate' ||
    StudioState.activeTool === 'stamp'
  )) || StudioState.activeTool === 'freeze';
  window.MosaicEngine.renderGuidesAndOverlays(
    window,
    StudioState.mosaicData,
    layoutConfig,
    {
      ...StudioState.guides,
      isEditTool,
      frozenCells: StudioState.frozenCells,
      isFreezeTool: StudioState.activeTool === 'freeze',
      freezeHoverMode: StudioState.freezeMode,
      freezeHoverPlacements: StudioState.activeTool === 'freeze' ? resolveFreezeTargetPlacements(StudioState.hoveredCell) : null
    },
    StudioState.hoveredCell
  );
  const editPreview = getEditPreviewState();
  if (editPreview) {
    window.MosaicEngine.renderEditScopeAndGhostOverlay(
      window,
      StudioState.mosaicData,
      layoutConfig,
      editPreview
    );
  }
  pop();
}

// ============================================================================
// Mosaic Generation & History
// ============================================================================


function syncD4Badge() {
  const badgeEl = document.getElementById('d4EditedBadge');
  if (!badgeEl) return;
  if (!StudioState.mosaicData || !window.MosaicEngine || typeof window.MosaicEngine.isMosaicD4Invariant !== 'function') {
    badgeEl.classList.add('hidden');
    return;
  }
  const isInvariant = window.MosaicEngine.isMosaicD4Invariant(StudioState.mosaicData);
  badgeEl.classList.toggle('hidden', isInvariant);
}

function showD4Warning() {
  const warnEl = document.getElementById('d4SymmetryWarning');
  if (warnEl) warnEl.classList.remove('hidden');
  syncD4Badge();
}

function hideD4Warning() {
  const warnEl = document.getElementById('d4SymmetryWarning');
  if (warnEl) warnEl.classList.add('hidden');
}

function resetD4BrokenState() {
  hideD4Warning();
  syncD4Badge();
}

function regenerateMosaic(recordHistory = true) {
  resetD4BrokenState();

  const isDestructive = recordHistory && !StudioState.isRestoringHistory;

  // 4.2/T1 — the previous generation entry must be captured *before* the mosaic is replaced
  // and before the edit history is reset. After those two steps the capture is a silent no-op.
  if (isDestructive && window.HistoryNav && typeof window.HistoryNav.captureBeforeRegeneration === 'function') {
    window.HistoryNav.captureBeforeRegeneration({
      history: StudioState.history,
      historyIndex: StudioState.historyIndex,
      mosaicData: StudioState.mosaicData,
      frozenCells: StudioState.frozenCells,
      editHistory: StudioState.editHistory,
      editHistoryIndex: StudioState.editHistoryIndex
    });
  }

  // 4.2/T3 — document snapshot of what is on screen right now, carrying the parameters that produced it
  const previousDocument = isDestructive
    ? buildDocumentSnapshot(StudioState.lastDocumentParams || (window.DocumentSnapshot ? window.DocumentSnapshot.collectParams(StudioState) : null))
    : null;

  randomSeed(StudioState.seed);

  const allowedArray = Array.from(StudioState.allowedTiles).sort((a, b) => a - b);

  StudioState.mosaicData = window.MosaicEngine.generateMosaicWithFrozen(
    {
      rows: StudioState.rows,
      cols: StudioState.cols,
      subdivision: StudioState.subdivision,
      gridSymmetryMode: StudioState.gridSymmetryMode,
      blockSymmetryMode: StudioState.blockSymmetryMode,
      syncBlockSymmetry: StudioState.syncBlockSymmetry,
      allowedTiles: allowedArray
    },
    (arr) => arr[floor(random(arr.length))],
    StudioState.frozenCells
  );
  syncFreezeUI();

  if (StudioState.brushSizeMode === 'block' && StudioState.mosaicData) {
    const N = StudioState.mosaicData.subtilesPerSide;
    StudioState.supertilePattern = window.MosaicEngine.resizeSupertilePattern(
      StudioState.supertilePattern,
      N,
      N,
      StudioState.editBrushTileId,
      StudioState.editBrushTransform
    );
  }
  renderSupertileBuilderCanvas();

  if (previousDocument) {
    if (!Array.isArray(StudioState.editHistory) || StudioState.editHistory.length === 0) {
      StudioState.editHistory = [previousDocument];
      StudioState.editHistoryIndex = 0;
    } else {
      if (StudioState.editHistoryIndex < StudioState.editHistory.length - 1) {
        StudioState.editHistory = StudioState.editHistory.slice(0, StudioState.editHistoryIndex + 1);
      }
      const lastEntry = StudioState.editHistory[StudioState.editHistoryIndex];
      if (lastEntry && window.DocumentSnapshot && !lastEntry.document) {
        window.DocumentSnapshot.attachDocument(lastEntry, previousDocument.document);
      }
    }

    const currentParams = window.DocumentSnapshot ? window.DocumentSnapshot.collectParams(StudioState) : null;
    StudioState.lastDocumentParams = currentParams;
    const freshDocSnap = buildDocumentSnapshot(currentParams);
    if (freshDocSnap) {
      StudioState.editHistory.push(freshDocSnap);
      const maxAllowedEdits = getMaxEditHistoryForMosaic(StudioState.mosaicData);
      while (StudioState.editHistory.length > maxAllowedEdits) {
        StudioState.editHistory.shift();
      }
      StudioState.editHistoryIndex = StudioState.editHistory.length - 1;
      syncEditUndoUI();
    }
  } else {
    if (!Array.isArray(StudioState.editHistory) || StudioState.editHistory.length === 0) {
      resetEditHistoryWithInitialSnapshot();
    }
    if (window.DocumentSnapshot) {
      StudioState.lastDocumentParams = window.DocumentSnapshot.collectParams(StudioState);
    }
  }

  if (isDestructive) {
    pushGenerationHistory();
  }

  saveStudioStateToStorage();

  syncSymmetryPanelUI();
  updateStatusBar();
  redraw();
}

/**
 * Builds a snapshot that carries both the cells and the parameters that produced them.
 * The parameters come from the last rendered document (`lastDocumentParams`), because the
 * caller has usually already mutated StudioState before asking for a regeneration.
 */
function buildDocumentSnapshot(explicitParams = null) {
  if (!StudioState.mosaicData || !window.MosaicEngine || !window.DocumentSnapshot) return null;
  const cells = window.MosaicEngine.cloneMosaicCellsSnapshot(StudioState.mosaicData, StudioState.frozenCells);
  if (!cells) return null;
  const params = explicitParams || StudioState.lastDocumentParams || window.DocumentSnapshot.collectParams(StudioState);
  return window.DocumentSnapshot.attachDocument(cells, params);
}

/**
 * Restores a document snapshot: parameters, a mosaic with matching dimensions, then the cells.
 * Used by undo/redo when the step crosses a generation.
 */
function restoreDocumentSnapshot(snap) {
  if (!snap || !window.DocumentSnapshot || !window.MosaicEngine) return false;
  const doc = snap.document;
  if (!doc) return false;

  window.DocumentSnapshot.applyParams(StudioState, doc);

  randomSeed(StudioState.seed);
  const allowedArray = Array.from(StudioState.allowedTiles).sort((a, b) => a - b);
  const frozenMap = new Map(snap.frozenCells || []);
  StudioState.mosaicData = window.MosaicEngine.generateMosaicWithFrozen(
    {
      rows: StudioState.rows,
      cols: StudioState.cols,
      subdivision: StudioState.subdivision,
      gridSymmetryMode: StudioState.gridSymmetryMode,
      blockSymmetryMode: StudioState.blockSymmetryMode,
      syncBlockSymmetry: StudioState.syncBlockSymmetry,
      allowedTiles: allowedArray
    },
    (arr) => arr[floor(random(arr.length))],
    frozenMap
  );

  StudioState.frozenCells = frozenMap;
  const ok = window.MosaicEngine.restoreMosaicCellsSnapshot(StudioState.mosaicData, snap, StudioState.frozenCells);

  StudioState.lastDocumentParams = window.DocumentSnapshot.collectParams(StudioState);

  if (typeof syncAllInputsFromState === 'function') syncAllInputsFromState();
  if (typeof renderSwatchesPanel === 'function') renderSwatchesPanel();
  if (typeof syncSymmetryPanelUI === 'function') syncSymmetryPanelUI();
  if (typeof syncEditWorkspaceUI === 'function') syncEditWorkspaceUI();
  if (typeof renderSupertileBuilderCanvas === 'function') renderSupertileBuilderCanvas();
  if (typeof updateStatusBar === 'function') updateStatusBar();
  syncFreezeUI();
  syncD4Badge();
  syncEditUndoUI();
  saveStudioStateToStorage();
  redraw();

  return ok;
}

function pushGenerationHistory() {
  // NOTE (4.2): the previous entry is captured by HistoryNav.captureBeforeRegeneration()
  // at the top of regenerateMosaic(), before the mosaic is replaced. Capturing here would
  // snapshot the *new* mosaic with editHistoryIndex already reset — a silent no-op.
  const snapshot = {
    seed: StudioState.seed,
    rows: StudioState.rows,
    cols: StudioState.cols,
    width: StudioState.width,
    height: StudioState.height,
    margin: StudioState.margin,
    subdivision: StudioState.subdivision,
    paddingRatio: StudioState.paddingRatio,
    gridSymmetryMode: StudioState.gridSymmetryMode,
    blockSymmetryMode: StudioState.blockSymmetryMode,
    syncBlockSymmetry: StudioState.syncBlockSymmetry,
    allowedTiles: Array.from(StudioState.allowedTiles),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };

  // Avoid duplicate consecutive states
  if (StudioState.historyIndex >= 0) {
    const current = StudioState.history[StudioState.historyIndex];
    if (
      current &&
      current.seed === snapshot.seed &&
      current.rows === snapshot.rows &&
      current.cols === snapshot.cols &&
      current.gridSymmetryMode === snapshot.gridSymmetryMode &&
      current.blockSymmetryMode === snapshot.blockSymmetryMode &&
      current.subdivision === snapshot.subdivision &&
      current.allowedTiles.length === snapshot.allowedTiles.length
    ) {
      return;
    }
  }

  if (StudioState.historyIndex < StudioState.history.length - 1) {
    StudioState.history = StudioState.history.slice(0, StudioState.historyIndex + 1);
  }

  StudioState.history.push(snapshot);
  const maxGen = (typeof indexedDB !== 'undefined' && window.StatePersistence && window.StatePersistence.IDB_MAX_GENERATION_HISTORY)
    || IDB_MAX_GENERATION_HISTORY;
  while (StudioState.history.length > maxGen) {
    StudioState.history.shift();
  }
  StudioState.historyIndex = StudioState.history.length - 1;
  renderHistoryUI();
}

function restoreGenerationHistory(targetIndex) {
  if (targetIndex < 0 || targetIndex >= StudioState.history.length) return;
  const snap = StudioState.history[targetIndex];
  if (!snap) return;

  // 1. Before leaving current entry, save lazy snapshot if dirty
  const currentEntry = StudioState.history[StudioState.historyIndex];
  if (currentEntry && window.HistoryNav) {
    window.HistoryNav.saveLazyHistorySnapshot(
      currentEntry,
      StudioState.mosaicData,
      StudioState.frozenCells,
      StudioState.editHistoryIndex,
      StudioState.editHistory
    );
  }

  // 2. Enforce snapshot budget across history
  if (window.HistoryNav) {
    const pruned = window.HistoryNav.pruneSnapshotsOverBudget(StudioState.history);
    if (pruned > 0) {
      showEditorToast('Edição antiga descartada para respeitar o limite de memória.', 'warn');
    }
  }

  StudioState.isRestoringHistory = true;
  try {
    StudioState.seed = snap.seed;
    StudioState.rows = snap.rows;
    StudioState.cols = snap.cols;
    StudioState.margin = snap.margin;
    StudioState.subdivision = snap.subdivision;
    StudioState.paddingRatio = snap.paddingRatio;
    StudioState.gridSymmetryMode = snap.gridSymmetryMode;
    StudioState.blockSymmetryMode = snap.blockSymmetryMode;
    StudioState.syncBlockSymmetry = snap.syncBlockSymmetry;
    const totalTiles = window.TileRegistry.TILE_RENDERERS.length;
    StudioState.allowedTiles = new Set(
      (Array.isArray(snap.allowedTiles) ? snap.allowedTiles : [])
        .filter((tileId) => Number.isInteger(tileId) && tileId >= 0 && tileId < totalTiles)
    );

    if (StudioState.width !== snap.width || StudioState.height !== snap.height) {
      StudioState.width = snap.width;
      StudioState.height = snap.height;
      applyZoomTransform();
    }

    StudioState.historyIndex = targetIndex;
    syncAllInputsFromState();
    renderSwatchesPanel();

    // 3. Plan restoration: restore snapshot if available, otherwise regenerate
    const plan = window.HistoryNav ? window.HistoryNav.planRestore(snap) : { action: 'regenerate' };
    if (plan.action === 'restore_snapshot' && plan.snapshot) {
      if (!StudioState.mosaicData || StudioState.mosaicData.rows !== snap.rows || StudioState.mosaicData.cols !== snap.cols || StudioState.mosaicData.subdivision !== snap.subdivision) {
        regenerateMosaic(false);
      }
      window.MosaicEngine.restoreMosaicCellsSnapshot(StudioState.mosaicData, plan.snapshot);
      if (plan.frozenCells) {
        StudioState.frozenCells = new Map(plan.frozenCells);
      }
      if (snap.savedEditHistory && snap.savedEditHistory.length > 0) {
        StudioState.editHistory = snap.savedEditHistory.slice();
        StudioState.editHistoryIndex = snap.savedEditHistoryIndex ?? (StudioState.editHistory.length - 1);
      } else {
        resetEditHistoryWithInitialSnapshot();
      }
      syncFreezeUI();
      syncSymmetryPanelUI();
      updateStatusBar();
      redraw();
    } else {
      if (plan.warning) {
        showEditorToast('Edição descartada para respeitar o limite de memória.', 'warn');
      }
      regenerateMosaic(false);
    }

    renderHistoryUI();
  } finally {
    StudioState.isRestoringHistory = false;
  }
}

function renderHistoryUI() {
  const btnPrev = document.getElementById('btnPrevSeed');
  const btnNext = document.getElementById('btnNextSeed');
  const listEl = document.getElementById('seedHistoryList');

  if (btnPrev) btnPrev.disabled = StudioState.historyIndex <= 0;
  if (btnNext) btnNext.disabled = StudioState.historyIndex >= StudioState.history.length - 1;

  if (!listEl) return;
  listEl.innerHTML = '';

  if (StudioState.history.length === 0) {
    listEl.innerHTML = '<div style="padding:10px;text-align:center;color:#6b7280;">Sem histórico</div>';
    return;
  }

  const modes = window.D4Symmetry.SYMMETRY_MODES;
  for (let i = StudioState.history.length - 1; i >= 0; i--) {
    const item = StudioState.history[i];
    const row = document.createElement('div');
    row.className = 'history-item' + (i === StudioState.historyIndex ? ' active' : '');
    const modeLabel = modes[item.gridSymmetryMode]?.name || item.gridSymmetryMode;
    row.innerHTML = `
      <div class="history-item-seed">
        <span>#${item.seed}</span>
        <span class="history-item-meta">${item.timestamp || ''}</span>
      </div>
      <div class="history-item-meta">${item.rows}×${item.cols} • ${modeLabel}</div>
    `;
    row.addEventListener('click', () => {
      restoreGenerationHistory(i);
    });
    listEl.appendChild(row);
  }
}

// ============================================================================
// Thumbnails & Swatches Panel
// ============================================================================

function buildTileThumbnails() {
  StudioState.thumbnailCache.clear();
  const renderers = window.TileRegistry.TILE_RENDERERS;
  const size = 64;
  const pad = size * 0.08;

  for (let id = 0; id < renderers.length; id++) {
    const gfx = createGraphics(size, size);
    gfx.pixelDensity(1);
    gfx.clear();
    gfx.push();
    gfx.translate(size / 2, size / 2);
    const fam = window.TileRegistry.getFamilyForTile(id);
    if (fam && fam.id === 'empty-tile') {
      // Illustrator-style "Empty / None" swatch indicator for UI thumbnails only
      const s = size - pad * 3.2;
      gfx.noFill();
      gfx.stroke(130, 138, 155, 160);
      gfx.strokeWeight(1.5);
      gfx.rect(-s / 2, -s / 2, s, s, 3);
      gfx.stroke(239, 68, 68, 185);
      gfx.line(-s / 2 + 3, s / 2 - 3, s / 2 - 3, -s / 2 + 3);
    } else {
      renderers[id](gfx, size, size, pad, color(230, 228, 224));
    }
    gfx.pop();
    StudioState.thumbnailCache.set(id, gfx.canvas.toDataURL());
    gfx.remove();
  }
}

function renderSwatchesPanel() {
  const container = document.getElementById('familiesSwatchContainer');
  const counterEl = document.getElementById('activeTilesCounter');
  if (!container) return;

  const totalTiles = window.TileRegistry.TILE_RENDERERS.length;
  if (counterEl) {
    counterEl.textContent = `${StudioState.allowedTiles.size} / ${totalTiles}`;
  }

  const query = (StudioState.searchQuery || '').trim().toLowerCase();
  const families = window.TileRegistry.TILE_FAMILIES_META;
  const tileNames = window.TileRegistry.TILE_NAMES;

  container.innerHTML = '';

  let currentGroup = null;
  for (const fam of families) {
    const matchingTiles = fam.tileIds.filter((id) => {
      if (!query) return true;
      const tName = (tileNames[id] || '').toLowerCase();
      const gName = (fam.group || '').toLowerCase();
      return fam.name.toLowerCase().includes(query) || gName.includes(query) || tName.includes(query) || `#${id}` === query;
    });

    if (matchingTiles.length === 0) continue;

    if (fam.group && fam.group !== currentGroup) {
      currentGroup = fam.group;
      const groupHeading = document.createElement('div');
      groupHeading.className = 'swatches-group-heading';
      groupHeading.textContent = currentGroup;
      container.appendChild(groupHeading);
    }

    const selectedInFam = fam.tileIds.filter((id) => StudioState.allowedTiles.has(id)).length;
    const allSelected = selectedInFam === fam.tileIds.length;
    const noneSelected = selectedInFam === 0;

    const card = document.createElement('div');
    card.className = 'family-swatch-card ' +
      (allSelected ? 'family-all' : noneSelected ? 'family-none' : 'family-partial');

    const header = document.createElement('div');
    header.className = 'family-card-header';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'family-toggle-btn';
    toggleBtn.title = allSelected ? 'Desativar família inteira' : 'Ativar família inteira';
    toggleBtn.innerHTML = `
      <span class="family-check-indicator">${allSelected ? '✓' : (!noneSelected ? '–' : '')}</span>
      <span>${fam.name}</span>
    `;
    toggleBtn.addEventListener('click', () => {
      if (allSelected) {
        fam.tileIds.forEach((id) => StudioState.allowedTiles.delete(id));
      } else {
        fam.tileIds.forEach((id) => StudioState.allowedTiles.add(id));
      }
      renderSwatchesPanel();
      regenerateMosaic(true);
    });

    const rightWrap = document.createElement('div');
    rightWrap.className = 'family-actions-right';

    const countTag = document.createElement('span');
    countTag.className = 'family-count-tag';
    countTag.textContent = `${selectedInFam}/${fam.tileIds.length}`;

    const soloBtn = document.createElement('button');
    soloBtn.type = 'button';
    soloBtn.className = 'family-solo-btn';
    soloBtn.textContent = 'SOLO';
    soloBtn.title = `Isolar apenas a família "${fam.name}" para testar no mosaico`;
    soloBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      StudioState.allowedTiles.clear();
      fam.tileIds.forEach((id) => StudioState.allowedTiles.add(id));
      renderSwatchesPanel();
      regenerateMosaic(true);
    });

    rightWrap.appendChild(countTag);
    rightWrap.appendChild(soloBtn);

    header.appendChild(toggleBtn);
    header.appendChild(rightWrap);
    card.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'family-tiles-grid';

    for (const tileId of matchingTiles) {
      const isSelected = StudioState.allowedTiles.has(tileId);
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'tile-swatch-btn' + (isSelected ? ' selected' : '');
      swatch.title = `#${tileId}: ${tileNames[tileId] || 'Tile'}`;

      const img = document.createElement('img');
      img.src = StudioState.thumbnailCache.get(tileId) || '';
      img.alt = tileNames[tileId] || `Tile ${tileId}`;

      const idBadge = document.createElement('span');
      idBadge.className = 'tile-swatch-id';
      idBadge.textContent = tileId;

      swatch.appendChild(img);
      swatch.appendChild(idBadge);

      swatch.addEventListener('click', () => {
        if (StudioState.allowedTiles.has(tileId)) {
          StudioState.allowedTiles.delete(tileId);
        } else {
          StudioState.allowedTiles.add(tileId);
        }
        renderSwatchesPanel();
        regenerateMosaic(true);
      });

      grid.appendChild(swatch);
    }

    card.appendChild(grid);
    container.appendChild(card);
  }
}

// ============================================================================
// Symmetry Panel UI
// ============================================================================

function buildSymmetryPanelUI() {
  const gridContainer = document.getElementById('gridSymmetryGrid');
  const blockGrid = document.getElementById('blockSymmetryGrid');
  const modes = window.D4Symmetry.SYMMETRY_MODES;

  if (gridContainer) {
    gridContainer.innerHTML = '';
    for (const modeKey of Object.keys(modes)) {
      const m = modes[modeKey];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sym-card';
      btn.dataset.mode = m.id;
      btn.innerHTML = `
        <div class="sym-card-icon">${SYMMETRY_ICONS_SVG[m.id] || ''}</div>
        <div class="sym-card-text">
          <span class="sym-card-title">${m.name}</span>
          <span class="sym-card-sub">${m.subtitle}</span>
        </div>
      `;
      btn.addEventListener('click', () => {
        StudioState.gridSymmetryMode = m.id;
        if (StudioState.syncBlockSymmetry) {
          StudioState.blockSymmetryMode = m.id;
        }
        regenerateMosaic(true);
      });
      gridContainer.appendChild(btn);
    }
  }

  if (blockGrid) {
    blockGrid.innerHTML = '';
    const blockOptions = [
      {
        key: 'sync',
        title: 'Igual à Grade',
        sub: 'Automático',
        icon: SYMMETRY_ICONS_SVG.sync
      },
      {
        key: 'mandala_d4',
        title: 'Mandala',
        sub: '8 Octantes',
        icon: SYMMETRY_ICONS_SVG.mandala_d4
      },
      {
        key: 'kaleidoscope',
        title: 'Caleidoscópio',
        sub: 'Livre',
        icon: SYMMETRY_ICONS_SVG.kaleidoscope
      },
      {
        key: 'rotational_c4',
        title: 'Rotacional',
        sub: 'Giro 90°',
        icon: SYMMETRY_ICONS_SVG.rotational_c4
      },
      {
        key: 'bilateral_d2',
        title: 'Bilateral',
        sub: 'Espelho X/Y',
        icon: SYMMETRY_ICONS_SVG.bilateral_d2
      }
    ];

    for (const opt of blockOptions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'block-sym-pill';
      btn.dataset.blockMode = opt.key;
      btn.innerHTML = `
        <div class="block-sym-pill-icon">${opt.icon || ''}</div>
        <div class="block-sym-pill-text">
          <span class="block-sym-pill-title">${opt.title}</span>
          <span class="block-sym-pill-sub">${opt.sub}</span>
        </div>
      `;
      btn.addEventListener('click', () => {
        if (opt.key === 'sync') {
          StudioState.syncBlockSymmetry = true;
          StudioState.blockSymmetryMode = StudioState.gridSymmetryMode;
        } else {
          StudioState.syncBlockSymmetry = false;
          StudioState.blockSymmetryMode = opt.key;
        }
        regenerateMosaic(true);
      });
      blockGrid.appendChild(btn);
    }
  }
}

function syncSymmetryPanelUI() {
  const modes = window.D4Symmetry.SYMMETRY_MODES;
  const activeGridMode = modes[StudioState.gridSymmetryMode] || modes.mandala_d4;
  const effectiveBlockModeKey = StudioState.syncBlockSymmetry
    ? StudioState.gridSymmetryMode
    : StudioState.blockSymmetryMode;
  const activeBlockMode = modes[effectiveBlockModeKey] || modes.mandala_d4;

  // Step 1: Grid Symmetry Cards active state
  document.querySelectorAll('#gridSymmetryGrid .sym-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.mode === StudioState.gridSymmetryMode);
  });

  const gridBadge = document.getElementById('gridSymmetryBadge');
  if (gridBadge) gridBadge.textContent = activeGridMode.name;

  const descBox = document.getElementById('gridSymmetryDesc');
  if (descBox) descBox.textContent = activeGridMode.description;

  const nonSquareNotice = document.getElementById('nonSquareGridNotice');
  if (nonSquareNotice) {
    const needsSquare = activeGridMode.requiresSquareForFull && StudioState.rows !== StudioState.cols;
    nonSquareNotice.classList.toggle('hidden', !needsSquare);
  }

  // R8: Block Symmetry Incompatibility Warning
  const blockWarnEl = document.getElementById('blockSymmetryWarning');
  const blockWarnText = document.getElementById('blockSymmetryWarningText');
  if (blockWarnEl && blockWarnText) {
    if (!StudioState.syncBlockSymmetry) {
      if (StudioState.gridSymmetryMode === 'mandala_d4' && effectiveBlockModeKey === 'bilateral_d2') {
        blockWarnText.textContent = 'Bloco Bilateral reduz a simetria global de 8 para 4 eixos.';
        blockWarnEl.classList.remove('hidden');
      } else if (StudioState.gridSymmetryMode === 'mandala_d4' && effectiveBlockModeKey === 'rotational_c4') {
        blockWarnText.textContent = 'Bloco Rotacional reduz a simetria global de 8 para 4 eixos.';
        blockWarnEl.classList.remove('hidden');
      } else if (StudioState.gridSymmetryMode === 'kaleidoscope' && (effectiveBlockModeKey === 'bilateral_d2' || effectiveBlockModeKey === 'rotational_c4')) {
        blockWarnText.textContent = 'Bloco reduz a simetria radial global de 8 para 4 eixos.';
        blockWarnEl.classList.remove('hidden');
      } else {
        blockWarnEl.classList.add('hidden');
      }
    } else {
      blockWarnEl.classList.add('hidden');
    }
  }

  const selectedPillKey = StudioState.syncBlockSymmetry ? 'sync' : effectiveBlockModeKey;
  document.querySelectorAll('#blockSymmetryGrid .block-sym-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.blockMode === selectedPillKey);
  });

  const blockBadge = document.getElementById('blockSymmetryBadge');
  if (blockBadge) {
    blockBadge.textContent = StudioState.syncBlockSymmetry
      ? `Auto • ${activeBlockMode.name}`
      : activeBlockMode.name;
  }

  const blockDesc = document.getElementById('blockSymmetryDesc');
  if (blockDesc) {
    blockDesc.textContent = StudioState.syncBlockSymmetry
      ? `Cada bloco usa automaticamente a mesma simetria da grade (${activeBlockMode.name}).`
      : `Os 4 quadrantes internos de cada bloco usam ${activeBlockMode.name} (${activeBlockMode.subtitle}).`;
  }

  // Step 3: Subdivision buttons
  document.querySelectorAll('#subdivisionControl .seg-btn').forEach((btn) => {
    const s = parseInt(btn.dataset.sub, 10);
    btn.classList.toggle('active', s === StudioState.subdivision);
  });
  const subSummary = document.getElementById('subdivisionSummary');
  if (subSummary) {
    const n = StudioState.subdivision * 2;
    subSummary.textContent = `Bloco ${n}×${n}`;
  }
}

// ============================================================================
// Zoom, Pan & Viewport Management (True Vector-Sharp Zoom)
// ============================================================================

const ZOOM_PRESET_VALUES = ['25', '50', '75', '100', '125', '150', '200', '300', '400'];

function syncZoomUI() {
  const zoomSelect = document.getElementById('zoomPresetSelect');
  if (!zoomSelect) return;

  const pctStr = String(StudioState.zoomPercent);
  let customOpt = document.getElementById('zoomCustomOption');

  if (ZOOM_PRESET_VALUES.includes(pctStr)) {
    if (customOpt) customOpt.remove();
    zoomSelect.value = pctStr;
  } else {
    if (!customOpt) {
      customOpt = document.createElement('option');
      customOpt.id = 'zoomCustomOption';
      customOpt.value = 'custom';
      zoomSelect.prepend(customOpt);
    }
    customOpt.textContent = StudioState.zoomMode === 'fit'
      ? `${StudioState.zoomPercent}% (Ajustado)`
      : `${StudioState.zoomPercent}%`;
    zoomSelect.value = 'custom';
  }
}

function applyPanTransform() {
  const stage = document.getElementById('canvas-stage');
  const pasteboard = document.getElementById('artboard-pasteboard');
  const x = Math.round(StudioState.panOffsetX || 0);
  const y = Math.round(StudioState.panOffsetY || 0);
  if (stage) {
    stage.style.transform = `translate(${x}px, ${y}px)`;
  }
  if (pasteboard) {
    pasteboard.style.backgroundPosition = `${x % 20}px ${y % 20}px`;
  }
}

function applyZoomTransform() {
  const scale = (StudioState.zoomPercent || 100) / 100;
  const targetW = Math.max(1, Math.round(StudioState.width * scale));
  const targetH = Math.max(1, Math.round(StudioState.height * scale));

  if (typeof resizeCanvas === 'function' && (width !== targetW || height !== targetH)) {
    resizeCanvas(targetW, targetH);
  }

  const stage = document.getElementById('canvas-stage');
  const cnv = stage ? stage.querySelector('canvas') : null;
  if (cnv) {
    cnv.style.width = `${targetW}px`;
    cnv.style.height = `${targetH}px`;
  }

  syncZoomUI();
  updateStatusBar();
  applyPanTransform();
  if (typeof redraw === 'function') {
    redraw();
  }
}

function fitArtboardToWindow() {
  const pasteboard = document.getElementById('artboard-pasteboard');
  if (!pasteboard) return;

  const availW = Math.max(100, pasteboard.clientWidth - 72);
  const availH = Math.max(100, pasteboard.clientHeight - 72);
  const scale = Math.min(availW / StudioState.width, availH / StudioState.height);
  StudioState.zoomPercent = Math.max(15, Math.min(400, Math.round(scale * 100)));
  StudioState.zoomMode = 'fit';
  StudioState.panOffsetX = 0;
  StudioState.panOffsetY = 0;

  applyZoomTransform();
  applyPanTransform();
}

function setZoomPercent(nextPercent) {
  const oldZoom = StudioState.zoomPercent || 100;
  const clampedZoom = Math.max(15, Math.min(400, Math.round(nextPercent)));
  if (clampedZoom === oldZoom && StudioState.zoomMode === 'custom') {
    applyPanTransform();
    return;
  }

  const ratio = clampedZoom / oldZoom;
  StudioState.panOffsetX = Math.round((StudioState.panOffsetX || 0) * ratio);
  StudioState.panOffsetY = Math.round((StudioState.panOffsetY || 0) * ratio);

  StudioState.zoomPercent = clampedZoom;
  StudioState.zoomMode = 'custom';
  applyZoomTransform();
  applyPanTransform();
}

function recenterView() {
  StudioState.panOffsetX = 0;
  StudioState.panOffsetY = 0;
  applyPanTransform();
}

function resetZoom100() {
  StudioState.panOffsetX = 0;
  StudioState.panOffsetY = 0;
  StudioState.zoomPercent = 100;
  StudioState.zoomMode = 'custom';
  applyZoomTransform();
  applyPanTransform();
}

// ============================================================================
// Canvas Hover Inspection & Mouse Interaction
// ============================================================================

function getCanvasHitCell(mx, my) {
  const scale = (StudioState.zoomPercent || 100) / 100;
  const lx = mx / scale;
  const ly = my / scale;

  const m = StudioState.margin;
  const drawW = StudioState.width - m * 2;
  const drawH = StudioState.height - m * 2;
  if (drawW <= 0 || drawH <= 0) return null;
  if (lx < m || lx >= StudioState.width - m || ly < m || ly >= StudioState.height - m) {
    return null;
  }

  const col = Math.floor(((lx - m) / drawW) * StudioState.cols);
  const row = Math.floor(((ly - m) / drawH) * StudioState.rows);
  if (row < 0 || row >= StudioState.rows || col < 0 || col >= StudioState.cols) return null;

  const blockW = drawW / StudioState.cols;
  const blockH = drawH / StudioState.rows;
  const N = StudioState.subdivision * 2;
  const localX = lx - (m + col * blockW);
  const localY = ly - (m + row * blockH);
  const subCol = Math.min(N - 1, Math.max(0, Math.floor((localX / blockW) * N)));
  const subRow = Math.min(N - 1, Math.max(0, Math.floor((localY / blockH) * N)));

  return { row, col, subRow, subCol };
}

function resolveFreezeTargetPlacements(hit) {
  if (!StudioState.mosaicData || !hit) return [];
  const N = StudioState.mosaicData.subtilesPerSide;
  let size = 1;
  if (StudioState.freezeSize === 'block') {
    size = N;
  } else {
    size = Math.max(1, Math.min(N, parseInt(StudioState.freezeSize, 10) || 1));
  }

  const dummyPat = {
    rows: size,
    cols: size,
    cells: Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({ tileId: 1, baseTileId: 1, transform: 'id' }))
    )
  };

  const scopeMode = StudioState.editScope || 'single';

  const resolved = window.MosaicEngine.resolveStampRegionPlacements(
    StudioState.mosaicData,
    dummyPat,
    hit,
    scopeMode,
    'id',
    {
      snapToBlock: StudioState.freezeSize === 'block',
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry
    }
  );
  return Array.isArray(resolved) ? resolved : (resolved?.placements || []);
}

function syncFreezeUI() {
  const statusRow = document.getElementById('freezeStatusRow');
  const label = document.getElementById('freezeCountLabel');
  const editorCount = document.getElementById('freezeToolCountBadge');
  const btnClearEditor = document.getElementById('btnFreezeClearSelection');
  const count = StudioState.frozenCells ? StudioState.frozenCells.size : 0;

  if (statusRow) {
    statusRow.classList.toggle('hidden', count === 0);
  }
  if (label) {
    label.textContent = `${count} ${count === 1 ? 'subtile' : 'subtiles'}`;
  }
  if (editorCount) {
    editorCount.textContent = count === 0 ? 'Nenhum' : `${count} ${count === 1 ? 'subtile' : 'subtiles'}`;
    editorCount.className = count === 0 ? 'prop-badge secondary' : 'prop-badge freeze-active';
  }
  if (btnClearEditor) {
    btnClearEditor.disabled = count === 0;
  }
}

function clearFrozenCells() {
  if (!StudioState.frozenCells || StudioState.frozenCells.size === 0) return;
  const count = StudioState.frozenCells.size;
  if (!confirm(`Deseja descongelar todos os ${count} subtiles travados?`)) {
    return;
  }
  StudioState.frozenCells.clear();
  pushEditHistorySnapshot();
  syncFreezeUI();
  saveStudioStateToStorage();
  showEditorToast('Todos os subtiles foram descongelados (Ctrl+Z para desfazer).', 'info');
  redraw();
}

function mouseMoved() {
  const hit = getCanvasHitCell(mouseX, mouseY);
  const prev = StudioState.hoveredCell;
  const changed = (!prev && hit) || (prev && !hit) ||
    (prev && hit && (prev.row !== hit.row || prev.col !== hit.col || prev.subRow !== hit.subRow || prev.subCol !== hit.subCol));

  if (changed) {
    StudioState.hoveredCell = hit;
    updateHoverStatusText();
    const isEditTool = StudioState.activeTool === 'paint' ||
      StudioState.activeTool === 'rotate' ||
      StudioState.activeTool === 'stamp' ||
      StudioState.activeTool === 'freeze';
    if (StudioState.guides.highlightHoverOrbit || isEditTool) {
      redraw();
    }
  }
}

function performSubtileRotateStep(hit, step = 1) {
  if (!StudioState.mosaicData || !hit) return false;
  const { placements } = window.MosaicEngine.resolveRotateRegionPlacements(
    StudioState.mosaicData,
    hit,
    {
      rotateSize: StudioState.rotateSizeMode,
      snapToBlock: StudioState.rotateSnapToBlock,
      rotateGroupMode: StudioState.rotateGroupMode,
      rotateBehavior: StudioState.rotateBehavior,
      step,
      scopeMode: StudioState.editScope,
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry
    }
  );
  const changed = window.MosaicEngine.applyStampPlacements(StudioState.mosaicData, placements);
  if (changed && StudioState.frozenCells && StudioState.frozenCells.size > 0) {
    for (const p of placements) {
      const key = `${p.row},${p.col},${p.subRow},${p.subCol}`;
      if (StudioState.frozenCells.has(key)) {
        StudioState.frozenCells.set(key, { baseTileId: p.baseTileId, transform: p.transform, tileId: p.tileId });
      }
    }
  }
  if (changed) syncD4Badge();
  return changed;
}

function performBrushOrStampAtHit(hit) {
  if (!StudioState.mosaicData || !hit) return false;

  const activePattern = ensureSupertilePattern();
  const resolved = window.MosaicEngine.resolveStampRegionPlacements(
    StudioState.mosaicData,
    activePattern,
    hit,
    StudioState.editScope,
    'id',
    {
      snapToBlock: StudioState.brushSnapToBlock,
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry
    }
  );
  const placements = Array.isArray(resolved) ? resolved : (resolved?.placements || []);

  // R8: D4 Transparency Guard
  // Detect if painting with strict D4 symmetry places an asymmetric tile on a fixed axis cell
  const isStrictD4 = (StudioState.editScope === 'canvas_center' && StudioState.canvasCenterSymmetry === 'mandala_d4') ||
    (StudioState.editScope !== 'single' && StudioState.editScope !== 'same_tile' && StudioState.mosaicData.blockSymmetryMode === 'mandala_d4');

  if (isStrictD4) {
    const N = StudioState.mosaicData.subtilesPerSide;
    const totalR = StudioState.mosaicData.rows * N;
    const totalC = StudioState.mosaicData.cols * N;
    let breaksD4 = false;

    for (const p of placements) {
      let stab = [];
      if (StudioState.editScope === 'canvas_center') {
        stab = window.D4Symmetry.getCellStabilizer(p.gr, p.gc, totalR, totalC, 'mandala_d4');
      } else {
        stab = window.D4Symmetry.getCellStabilizer(p.subRow, p.subCol, N, N, 'mandala_d4');
      }
      for (const g of stab) {
        if (!window.D4Symmetry.isTileInvariantUnder(p.tileId, g)) {
          breaksD4 = true;
          break;
        }
      }
      if (breaksD4) break;
    }

    if (breaksD4) {
      
      showD4Warning();
    }
  }

  const changed = window.MosaicEngine.applyStampPlacements(StudioState.mosaicData, placements);
  if (changed) syncD4Badge();
  return changed;
}

function rotateOrFlipActiveBrush(d4Key) {
  const pat = ensureSupertilePattern();
  StudioState.supertilePattern = window.MosaicEngine.transformClonePattern(pat, d4Key);
  StudioState.stampBlock = StudioState.supertilePattern;
  StudioState.editBrushTransform = window.D4Symmetry.composeD4(d4Key, StudioState.editBrushTransform || 'id');
  renderSupertileBuilderCanvas();
  syncEditWorkspaceUI();
  saveStudioStateToStorage();
  redraw();
}

function setBrushSizeMode(sizeMode) {
  StudioState.brushSizeMode = sizeMode;
  const N = StudioState.mosaicData ? StudioState.mosaicData.subtilesPerSide : 4;
  let targetDim = 1;
  if (sizeMode === 'block') {
    targetDim = N;
    StudioState.brushSnapToBlock = true;
  } else {
    targetDim = Math.max(1, parseInt(sizeMode, 10) || 1);
    StudioState.brushSnapToBlock = false;
  }

  StudioState.supertilePattern = window.MosaicEngine.resizeSupertilePattern(
    StudioState.supertilePattern,
    targetDim,
    targetDim,
    StudioState.editBrushTileId,
    StudioState.editBrushTransform || 'id'
  );
  StudioState.stampBlock = StudioState.supertilePattern;
  renderSupertileBuilderCanvas();
  syncEditWorkspaceUI();
  saveStudioStateToStorage();
  redraw();
}

/**
 * Cycles the active tool's size (Round 6) — used by Shift+wheel over the canvas.
 * Paint/Stamp cycle the brush; the Freeze tool cycles its own size.
 */
function cycleActiveToolSize(direction) {
  const order = ['1', '2', '3', '4', 'block'];
  const label = (value) => (value === 'block' ? 'Bloco' : `${value}×${value}`);

  if (StudioState.activeTool === 'freeze') {
    const current = Math.max(0, order.indexOf(String(StudioState.freezeSize)));
    const next = order[(current + direction + order.length) % order.length];
    StudioState.freezeSize = next;
    syncEditWorkspaceUI();
    showEditorToast(`Trava ${label(next)}`);
    redraw();
    return true;
  }

  if (StudioState.activeTool === 'rotate') {
    const current = Math.max(0, order.indexOf(String(StudioState.rotateSizeMode)));
    const next = order[(current + direction + order.length) % order.length];
    StudioState.rotateSizeMode = next;
    StudioState.rotateSnapToBlock = (next === 'block');
    syncEditWorkspaceUI();
    showEditorToast(`Girar ${label(next)}`);
    redraw();
    return true;
  }

  if (StudioState.activeTool === 'paint' || StudioState.activeTool === 'stamp') {
    const current = Math.max(0, order.indexOf(String(StudioState.brushSizeMode)));
    const next = order[(current + direction + order.length) % order.length];
    setBrushSizeMode(next);
    showEditorToast(`Pincel ${label(next)}`);
    return true;
  }

  return false;
}

function mouseDragged() {
  const hit = getCanvasHitCell(mouseX, mouseY);
  const prev = StudioState.hoveredCell;
  const changed = (!prev && hit) || (prev && !hit) ||
    (prev && hit && (prev.row !== hit.row || prev.col !== hit.col || prev.subRow !== hit.subRow || prev.subCol !== hit.subCol));

  if (changed) {
    StudioState.hoveredCell = hit;
    updateHoverStatusText();
  }

  // Dragging a rectangular Clone / Supertile Selection marquee
  if (StudioState.isSelectingStampDrag && hit && StudioState.mosaicData) {
    const N = StudioState.mosaicData.subtilesPerSide;
    const gr = StudioState.brushSnapToBlock ? (hit.row + 1) * N - 1 : hit.row * N + hit.subRow;
    const gc = StudioState.brushSnapToBlock ? (hit.col + 1) * N - 1 : hit.col * N + hit.subCol;
    if (gr !== StudioState.stampDragCurrGR || gc !== StudioState.stampDragCurrGC) {
      StudioState.stampDragCurrGR = gr;
      StudioState.stampDragCurrGC = gc;
      redraw();
    }
    return;
  }

  // Drag-freezing in Freeze Tool ('freeze')
  if (StudioState.isFreezingDrag && StudioState.activeTool === 'freeze' && hit && StudioState.mosaicData) {
    const cellKey = `${hit.row},${hit.col},${hit.subRow},${hit.subCol}`;
    if (cellKey !== StudioState.lastFrozenCellKey) {
      StudioState.lastFrozenCellKey = cellKey;
      const placements = resolveFreezeTargetPlacements(hit);
      for (const p of placements) {
        const pKey = `${p.row},${p.col},${p.subRow},${p.subCol}`;
        if (StudioState.freezeDragAction === 'freeze') {
          const cell = StudioState.mosaicData.grid[p.row]?.[p.col]?.cells[p.subRow]?.[p.subCol];
          if (cell) {
            StudioState.frozenCells.set(pKey, {
              baseTileId: cell.baseTileId,
              transform: cell.transform,
              tileId: cell.tileId
            });
            StudioState.pendingEditHistoryPush = true;
          }
        } else {
          if (StudioState.frozenCells.has(pKey)) {
            StudioState.frozenCells.delete(pKey);
            StudioState.pendingEditHistoryPush = true;
          }
        }
      }
      syncFreezeUI();
      redraw();
    }
    return;
  }

  // Drag-painting in Paint or Stamp ('apply') mode
  if (
    StudioState.isPaintingDrag &&
    (StudioState.activeTool === 'paint' || (StudioState.activeTool === 'stamp' && StudioState.stampInteractionMode === 'apply')) &&
    hit &&
    StudioState.mosaicData
  ) {
    const cellKey = StudioState.brushSnapToBlock
      ? `blk_${hit.row},${hit.col}`
      : `${hit.row},${hit.col},${hit.subRow},${hit.subCol}`;
    if (cellKey !== StudioState.lastPaintedCellKey) {
      StudioState.lastPaintedCellKey = cellKey;
      const didChange = performBrushOrStampAtHit(hit);
      if (didChange) {
        StudioState.pendingEditHistoryPush = true;
      }
      redraw();
    }
  } else if (changed) {
    redraw();
  }
}

function startCanvasRegionCaptureDrag(hit) {
  if (!StudioState.mosaicData || !hit) return;
  const N = StudioState.mosaicData.subtilesPerSide;
  if (StudioState.brushSnapToBlock) {
    StudioState.isSelectingStampDrag = true;
    StudioState.stampDragStartGR = hit.row * N;
    StudioState.stampDragStartGC = hit.col * N;
    StudioState.stampDragCurrGR = (hit.row + 1) * N - 1;
    StudioState.stampDragCurrGC = (hit.col + 1) * N - 1;
  } else {
    const gr = hit.row * N + hit.subRow;
    const gc = hit.col * N + hit.subCol;
    StudioState.isSelectingStampDrag = true;
    StudioState.stampDragStartGR = gr;
    StudioState.stampDragStartGC = gc;
    StudioState.stampDragCurrGR = gr;
    StudioState.stampDragCurrGC = gc;
  }
  redraw();
}

function handleCanvasMouseDown(e) {
  if (
    StudioState.activeTool === 'pan' ||
    StudioState.activeTool === 'zoom' ||
    StudioState.isSpaceDown ||
    e.button === 1
  ) {
    return;
  }

  const hit = getCanvasHitCell(mouseX, mouseY);
  if (!hit || !StudioState.mosaicData) return;

  StudioState.hoveredCell = hit;
  updateHoverStatusText();

  // Alt + Left-Click/Drag anywhere = Capture Tile or Supertile Region from the Mosaic!
  if (e.altKey && e.button === 0 && (StudioState.activeTool === 'paint' || StudioState.activeTool === 'stamp' || StudioState.activeTool === 'inspect')) {
    e.preventDefault();
    if (StudioState.activeTool === 'inspect') {
      StudioState.activeTool = 'paint';
      StudioState.workspace = 'edit';
    }
    startCanvasRegionCaptureDrag(hit);
    return;
  }

  // Freeze / Lock Subtiles Tool ('freeze')
  if (StudioState.activeTool === 'freeze') {
    e.preventDefault();
    const placements = resolveFreezeTargetPlacements(hit);
    if (!placements || placements.length === 0) return;

    // Right-click inverts action; Left-click uses explicit freezeMode (monotonic)
    const action = e.button === 2
      ? (StudioState.freezeMode === 'freeze' ? 'unfreeze' : 'freeze')
      : StudioState.freezeMode;

    StudioState.isFreezingDrag = true;
    StudioState.freezeDragAction = action;
    StudioState.lastFrozenCellKey = `${hit.row},${hit.col},${hit.subRow},${hit.subCol}`;

    let didChangeFreeze = false;
    for (const p of placements) {
      const cellKey = `${p.row},${p.col},${p.subRow},${p.subCol}`;
      if (action === 'freeze') {
        const cell = StudioState.mosaicData.grid[p.row]?.[p.col]?.cells[p.subRow]?.[p.subCol];
        if (cell) {
          StudioState.frozenCells.set(cellKey, {
            baseTileId: cell.baseTileId,
            transform: cell.transform,
            tileId: cell.tileId
          });
          didChangeFreeze = true;
        }
      } else {
        if (StudioState.frozenCells.has(cellKey)) {
          StudioState.frozenCells.delete(cellKey);
          didChangeFreeze = true;
        }
      }
    }
    if (didChangeFreeze) {
      StudioState.pendingEditHistoryPush = true;
    }

    syncFreezeUI();
    saveScheduler.schedule();
    redraw();
    return;
  }

  // Paint Tool ('paint')
  if (StudioState.activeTool === 'paint') {
    e.preventDefault();
    if (e.button === 2) {
      // Right-click in paint mode = Rotate the ACTIVE BRUSH / SUPERTILE (+90° CW)
      rotateOrFlipActiveBrush('r90');
    } else if (e.button === 0) {
      const activePat = ensureSupertilePattern();
      const isMultiCell = activePat.rows > 1 || activePat.cols > 1;
      if (StudioState.editScope === 'same_tile' && isMultiCell) {
        showEditorToast('O escopo Iguais compara 1×1. Reduza o pincel para 1×1 ou use outro escopo.', 'warn');
        return;
      }
      StudioState.isPaintingDrag = true;
      StudioState.lastPaintedCellKey = StudioState.brushSnapToBlock
        ? `blk_${hit.row},${hit.col}`
        : `${hit.row},${hit.col},${hit.subRow},${hit.subCol}`;
      const didChange = performBrushOrStampAtHit(hit);
      if (didChange) {
        StudioState.pendingEditHistoryPush = true;
      }
      redraw();
    }
    return;
  }

  // Rotate / Cycle Tool ('rotate')
  if (StudioState.activeTool === 'rotate') {
    e.preventDefault();
    const step = e.button === 2 ? -1 : 1;
    const didChange = performSubtileRotateStep(hit, step);
    if (didChange) {
      pushEditHistorySnapshot();
      redraw();
    }
    return;
  }

  // Clone / Stamp Tool ('stamp')
  if (StudioState.activeTool === 'stamp') {
    e.preventDefault();
    if (e.button === 2) {
      // Right-click rotates the Clone / Supertile Brush by +90° CW
      rotateOrFlipActiveBrush('r90');
      return;
    }

    if (e.button === 0) {
      const shouldSelectRegion = StudioState.stampInteractionMode === 'select' || !StudioState.supertilePattern;
      if (shouldSelectRegion) {
        startCanvasRegionCaptureDrag(hit);
      } else {
        const activePat = ensureSupertilePattern();
        const isMultiCell = activePat.rows > 1 || activePat.cols > 1;
        if (StudioState.editScope === 'same_tile' && isMultiCell) {
          showEditorToast('O escopo Iguais compara 1×1. Reduza o pincel para 1×1 ou use outro escopo.', 'warn');
          return;
        }
        StudioState.isPaintingDrag = true;
        StudioState.lastPaintedCellKey = StudioState.brushSnapToBlock
          ? `blk_${hit.row},${hit.col}`
          : `${hit.row},${hit.col},${hit.subRow},${hit.subCol}`;
        const didChange = performBrushOrStampAtHit(hit);
        if (didChange) {
          StudioState.pendingEditHistoryPush = true;
        }
        redraw();
      }
    }
  }
}

// ============================================================================
// Stage 2: Mosaic Edit Undo/Redo Stack & Editor UI Builders
// ============================================================================


// ============================================================================
// Stage 4.2 / T2: Document Dirty State & Dirty Guard Dialog
// ============================================================================

function isDocumentDirty(state = StudioState) {
  if (!state) return false;
  const hasEdits = typeof state.editHistoryIndex === 'number' && state.editHistoryIndex > 0;
  const hasFrozen = Boolean(state.frozenCells && state.frozenCells.size > 0);
  return hasEdits || hasFrozen;
}

let dirtyGuardSessionSuppressed = false;
let pendingDirtyGuardAction = null;
let dirtyGuardTriggerElement = null;

function requestParamChangeWithGuard(triggerEl, revertFn, applyFn) {
  if (dirtyGuardSessionSuppressed || !isDocumentDirty(StudioState)) {
    applyFn();
    return;
  }

  const dialog = document.getElementById('dirtyGuardDialog');
  const btnCancel = document.getElementById('btnDirtyGuardCancel');
  const descEl = document.getElementById('dirtyGuardDesc');

  if (!dialog) {
    applyFn();
    return;
  }

  dirtyGuardTriggerElement = triggerEl;
  const editCount = StudioState.editHistoryIndex > 0 ? StudioState.editHistoryIndex : 0;
  const frozenCount = StudioState.frozenCells ? StudioState.frozenCells.size : 0;
  let reason = '';
  if (editCount > 0 && frozenCount > 0) {
    reason = `Este mosaico tem ${editCount} edições manuais e ${frozenCount} subtiles travados.`;
  } else if (editCount > 0) {
    reason = `Este mosaico tem ${editCount} edições manuais.`;
  } else {
    reason = `Este mosaico tem ${frozenCount} subtiles travados.`;
  }

  if (descEl) {
    descEl.innerHTML = `${reason} Alterar este parâmetro irá regenerar o desenho. Suas alterações vão para o histórico e podem ser recuperadas com <kbd>Ctrl+Z</kbd>.`;
  }

  pendingDirtyGuardAction = { revertFn, applyFn };
  dialog.classList.remove('hidden');
  btnCancel?.focus();
}

function closeDirtyGuard(confirmed) {
  const dialog = document.getElementById('dirtyGuardDialog');
  const dontAskCheckbox = document.getElementById('dirtyGuardDontAsk');
  if (dontAskCheckbox && dontAskCheckbox.checked) {
    dirtyGuardSessionSuppressed = true;
  }

  dialog?.classList.add('hidden');
  const action = pendingDirtyGuardAction;
  pendingDirtyGuardAction = null;

  if (confirmed) {
    if (action && typeof action.applyFn === 'function') action.applyFn();
  } else {
    if (action && typeof action.revertFn === 'function') action.revertFn();
  }

  if (dirtyGuardTriggerElement) {
    dirtyGuardTriggerElement.focus?.();
    dirtyGuardTriggerElement = null;
  }
}

function resetEditHistoryWithInitialSnapshot() {
  if (!StudioState.mosaicData) return;
  const initialSnap = window.MosaicEngine.cloneMosaicCellsSnapshot(StudioState.mosaicData, StudioState.frozenCells);
  if (initialSnap && window.DocumentSnapshot) {
    const params = window.DocumentSnapshot.collectParams(StudioState);
    StudioState.lastDocumentParams = params;
    window.DocumentSnapshot.attachDocument(initialSnap, params);
  }
  StudioState.editHistory = initialSnap ? [initialSnap] : [];
  StudioState.editHistoryIndex = StudioState.editHistory.length - 1;
  syncEditUndoUI();
}

function pushEditHistorySnapshot() {
  if (!StudioState.mosaicData) return;
  const snap = window.MosaicEngine.cloneMosaicCellsSnapshot(StudioState.mosaicData, StudioState.frozenCells);
  if (!snap) return;

  if (StudioState.editHistoryIndex < StudioState.editHistory.length - 1) {
    StudioState.editHistory = StudioState.editHistory.slice(0, StudioState.editHistoryIndex + 1);
  }

  StudioState.editHistory.push(snap);
  const maxAllowedEdits = (typeof indexedDB !== 'undefined' && window.StatePersistence && window.StatePersistence.IDB_MAX_EDIT_HISTORY)
    ? window.StatePersistence.IDB_MAX_EDIT_HISTORY
    : getMaxEditHistoryForMosaic(StudioState.mosaicData);
  while (StudioState.editHistory.length > maxAllowedEdits) {
    StudioState.editHistory.shift();
  }
  StudioState.editHistoryIndex = StudioState.editHistory.length - 1;
  syncEditUndoUI();
  saveStudioStateToStorage();
}

function undoMosaicEdit() {
  if (StudioState.editHistoryIndex <= 0) return;
  StudioState.editHistoryIndex--;
  const snap = StudioState.editHistory[StudioState.editHistoryIndex];

  // 4.2/T3 — steps that cross a generation carry the whole document (cells + parameters).
  if (window.DocumentSnapshot && window.DocumentSnapshot.hasDocument(snap)) {
    if (restoreDocumentSnapshot(snap)) return;
  }

  if (window.MosaicEngine.restoreMosaicCellsSnapshot(StudioState.mosaicData, snap, StudioState.frozenCells)) {
    syncFreezeUI();
    syncEditUndoUI();
    syncD4Badge();
    saveStudioStateToStorage();
    redraw();
  }
}

function redoMosaicEdit() {
  if (StudioState.editHistoryIndex >= StudioState.editHistory.length - 1) return;
  StudioState.editHistoryIndex++;
  const snap = StudioState.editHistory[StudioState.editHistoryIndex];

  if (window.DocumentSnapshot && window.DocumentSnapshot.hasDocument(snap)) {
    if (restoreDocumentSnapshot(snap)) return;
  }

  if (window.MosaicEngine.restoreMosaicCellsSnapshot(StudioState.mosaicData, snap, StudioState.frozenCells)) {
    syncFreezeUI();
    syncEditUndoUI();
    saveStudioStateToStorage();
    redraw();
  }
}

function syncEditUndoUI() {
  const btnUndo = document.getElementById('btnEditUndo');
  const btnRedo = document.getElementById('btnEditRedo');
  const stepLbl = document.getElementById('editHistoryStepLabel');

  const canUndo = StudioState.editHistoryIndex > 0;
  const canRedo = StudioState.editHistoryIndex >= 0 && StudioState.editHistoryIndex < StudioState.editHistory.length - 1;

  if (btnUndo) btnUndo.disabled = !canUndo;
  if (btnRedo) btnRedo.disabled = !canRedo;
  if (stepLbl) {
    const editsCount = Math.max(0, StudioState.editHistoryIndex);
    const totalEdits = Math.max(0, StudioState.editHistory.length - 1);
    stepLbl.textContent = totalEdits === 0 ? '0' : `${editsCount}/${totalEdits}`;
  }
}



function buildEditWorkspaceUI() {
  const scopeGrid = document.getElementById('editScopeGrid');
  const scopes = window.MosaicEngine.EDIT_SCOPES;
  if (!scopeGrid || !scopes) return;

  scopeGrid.innerHTML = '';
  const scopeKeys = ['canvas_center', 'orbit_sym', 'block_sym', 'all_blocks', 'single', 'same_tile'];
  const shortNames = {
    canvas_center: 'Centro',
    orbit_sym: 'Órbita',
    block_sym: 'Bloco',
    all_blocks: 'Todos',
    single: 'Livre',
    same_tile: 'Iguais'
  };

  for (const key of scopeKeys) {
    const s = scopes[key];
    if (!s) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'edit-scope-card';
    btn.dataset.scope = s.id;
    btn.title = `${s.name} (Tecla ${s.shortcut}) — ${s.description}`;
    btn.innerHTML = `
      <span class="edit-scope-icon">${EDIT_SCOPE_ICONS[s.id] || '•'}</span>
      <span class="edit-scope-title">${shortNames[s.id] || s.name}</span>
    `;
    btn.addEventListener('click', () => {
      StudioState.editScope = s.id;
      syncEditWorkspaceUI();
      saveStudioStateToStorage();
      redraw();
    });
    scopeGrid.appendChild(btn);
  }
}

function renderEditBrushPalette() {
  const container = document.getElementById('editBrushPaletteContainer');
  if (!container) return;

  const query = (StudioState.editBrushSearchQuery || '').trim().toLowerCase();
  const families = window.TileRegistry.TILE_FAMILIES_META;
  const tileNames = window.TileRegistry.TILE_NAMES;

  container.innerHTML = '';

  let currentGroup = null;
  for (const fam of families) {
    const matchingTiles = fam.tileIds.filter((id) => {
      if (!query) return true;
      const tName = (tileNames[id] || '').toLowerCase();
      const gName = (fam.group || '').toLowerCase();
      return fam.name.toLowerCase().includes(query) || gName.includes(query) || tName.includes(query) || `#${id}` === query;
    });

    if (matchingTiles.length === 0) continue;

    if (fam.group && fam.group !== currentGroup) {
      currentGroup = fam.group;
      const groupHeading = document.createElement('div');
      groupHeading.className = 'swatches-group-heading';
      groupHeading.textContent = currentGroup;
      container.appendChild(groupHeading);
    }

    const card = document.createElement('div');
    card.className = 'family-swatch-card family-all';

    const header = document.createElement('div');
    header.className = 'family-card-header';
    header.innerHTML = `
      <span style="font-size:10.5px;font-weight:600;color:var(--text-secondary);">${fam.name}</span>
      <span class="family-count-tag">${matchingTiles.length}</span>
    `;
    card.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'family-tiles-grid';

    for (const tileId of matchingTiles) {
      const isBrushActive = StudioState.editBrushTileId === tileId;
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'tile-swatch-btn' + (isBrushActive ? ' brush-active' : ' available');
      swatch.setAttribute('aria-pressed', isBrushActive ? 'true' : 'false');
      swatch.title = `#${tileId} • ${tileNames[tileId] || 'Tile'}`;

      const img = document.createElement('img');
      img.src = StudioState.thumbnailCache.get(tileId) || '';
      img.alt = tileNames[tileId] || `Tile ${tileId}`;


      const idBadge = document.createElement('span');
      idBadge.className = 'tile-swatch-id';
      idBadge.textContent = tileId;

      swatch.appendChild(img);
      swatch.appendChild(idBadge);

      swatch.addEventListener('click', () => {
        StudioState.editBrushTileId = tileId;
        StudioState.editBrushTransform = 'id';
        const pat = ensureSupertilePattern();
        if (pat.rows === 1 && pat.cols === 1) {
          StudioState.supertilePattern = window.MosaicEngine.createSupertilePattern(1, 1, tileId, 'id');
          StudioState.stampBlock = StudioState.supertilePattern;
        }
        if (StudioState.activeTool !== 'paint' && StudioState.activeTool !== 'stamp') {
          StudioState.activeTool = 'paint';
          StudioState.workspace = 'edit';
        }
        if (StudioState.activeTool === 'stamp') {
          StudioState.stampInteractionMode = 'apply';
        }
        renderEditBrushPalette();
        renderSupertileBuilderCanvas();
        syncEditWorkspaceUI();
        saveStudioStateToStorage();
        redraw();
      });

      grid.appendChild(swatch);
    }

    card.appendChild(grid);
    container.appendChild(card);
  }

  requestAnimationFrame(() => {
    const active = container.querySelector('.tile-swatch-btn.brush-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  });
}


function resetActiveBrushOrientation() {
  const pat = ensureSupertilePattern();
  for (const row of pat.cells) {
    for (const cell of row) {
      cell.transform = 'id';
      cell.tileId = cell.baseTileId;
    }
  }
  StudioState.editBrushTransform = 'id';
  StudioState.stampBlock = pat;
  renderSupertileBuilderCanvas();
  syncEditWorkspaceUI();
  saveStudioStateToStorage();
  redraw();
}

function renderSupertileBuilderCanvas() {
  const cnvEl = document.getElementById('supertileBuilderCanvas');
  if (!cnvEl) return;

  const ctx2d = cnvEl.getContext('2d');
  ctx2d.clearRect(0, 0, cnvEl.width, cnvEl.height);

  const pat = ensureSupertilePattern();
  const size = cnvEl.width;
  const gfx = createGraphics(size, size);
  gfx.pixelDensity(1);
  gfx.background(18, 19, 22);

  const maxDim = Math.max(pat.rows, pat.cols, 1);
  const subSide = (size - 8) / maxDim;
  const offsetX = (size - pat.cols * subSide) / 2;
  const offsetY = (size - pat.rows * subSide) / 2;
  const pad = subSide * StudioState.paddingRatio;
  const fgCol = color(StudioState.fgColor);

  for (let sr = 0; sr < pat.rows; sr++) {
    for (let sc = 0; sc < pat.cols; sc++) {
      const cell = pat.cells[sr]?.[sc];
      if (!cell) continue;
      const cx = offsetX + (sc + 0.5) * subSide;
      const cy = offsetY + (sr + 0.5) * subSide;
      const renderer = window.TileRegistry.TILE_RENDERERS[cell.baseTileId] || window.TileRegistry.TILE_RENDERERS[cell.tileId];
      if (renderer) {
        gfx.push();
        gfx.translate(cx, cy);
        window.D4Symmetry.applyD4ToContext(gfx, cell.transform || 'id');
        renderer(gfx, subSide, subSide, pad, fgCol);
        gfx.pop();
      }
    }
  }

  // Draw crisp cell grid lines when Supertile is larger than 1x1
  if (pat.rows > 1 || pat.cols > 1) {
    gfx.noFill();
    gfx.stroke(90, 140, 220, 115);
    gfx.strokeWeight(1);
    for (let sr = 0; sr < pat.rows; sr++) {
      for (let sc = 0; sc < pat.cols; sc++) {
        gfx.rect(offsetX + sc * subSide, offsetY + sr * subSide, subSide, subSide);
      }
    }
  }

  ctx2d.drawImage(gfx.elt, 0, 0, size, size);
  gfx.remove();
}

function handleMiniBuilderCanvasMouse(e, isDrag = false) {
  const cnvEl = document.getElementById('supertileBuilderCanvas');
  if (!cnvEl) return;
  const pat = ensureSupertilePattern();

  const rect = cnvEl.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * cnvEl.width;
  const my = ((e.clientY - rect.top) / Math.max(1, rect.height)) * cnvEl.height;

  const size = cnvEl.width;
  const maxDim = Math.max(pat.rows, pat.cols, 1);
  const subSide = (size - 8) / maxDim;
  const offsetX = (size - pat.cols * subSide) / 2;
  const offsetY = (size - pat.rows * subSide) / 2;

  const sc = Math.floor((mx - offsetX) / subSide);
  const sr = Math.floor((my - offsetY) / subSide);
  if (sr < 0 || sr >= pat.rows || sc < 0 || sc >= pat.cols) return;

  const cell = pat.cells[sr]?.[sc];
  if (!cell) return;

  if (e.button === 2 && !isDrag) {
    // Right-click on a cell in the Supertile Builder rotates that cell +90° CW
    const nextTr = window.D4Symmetry.composeD4('r90', cell.transform || 'id');
    cell.transform = nextTr;
    cell.tileId = window.TileRegistry.getTransformedTileId(cell.baseTileId, nextTr);
    if (pat.rows === 1 && pat.cols === 1) {
      StudioState.editBrushTransform = nextTr;
    }
  } else if (e.button === 0 || isDrag) {
    if (pat.rows === 1 && pat.cols === 1 && !isDrag) {
      rotateOrFlipActiveBrush('r90');
      return;
    }
    const baseId = StudioState.editBrushTileId;
    const tr = StudioState.editBrushTransform || 'id';
    cell.baseTileId = baseId;
    cell.transform = tr;
    cell.tileId = window.TileRegistry.getTransformedTileId(baseId, tr);
  }

  StudioState.stampBlock = pat;
  renderSupertileBuilderCanvas();
  syncEditWorkspaceUI();
  saveStudioStateToStorage();
  redraw();
}

/**
 * Round 6 — the dock is a single contextual panel. Its title and the rail's first icon
 * reflect the current context (generation vs. the active tool).
 */
const TOOL_CONTEXT_LABELS = {
  inspect: 'Inspeção',
  paint: 'Pincel',
  rotate: 'Girar',
  stamp: 'Carimbo',
  freeze: 'Trava',
  pan: 'Pan',
  zoom: 'Zoom'
};

function syncContextPanel() {
  const isGenerator = StudioState.workspace === 'generate';
  const title = document.getElementById('ctxPanelTitle');
  if (title) {
    title.textContent = isGenerator
      ? 'Geração'
      : (TOOL_CONTEXT_LABELS[StudioState.activeTool] || 'Edição');
  }
}

function syncEditWorkspaceUI() {
  syncFreezeUI();
  syncContextPanel();
  document.body.dataset.activeTool = StudioState.activeTool;
  document.body.dataset.stampMode = StudioState.stampInteractionMode;

  // 1. Workspace panes — driven by the tool: inspect shows generation, edit tools show their options.

  // 2. Right Dock Workspace Panes
  const genPane = document.getElementById('dock-workspace-generate');
  const editPane = document.getElementById('dock-workspace-edit');
  if (genPane && editPane) {
    genPane.classList.toggle('hidden', StudioState.workspace !== 'generate');
    editPane.classList.toggle('hidden', StudioState.workspace !== 'edit');
  }

  // 3. Left Toolbar Active Tool Highlight
  document.querySelectorAll('#left-toolbar .tool-btn[data-tool]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === StudioState.activeTool);
  });

  // 4. Edit Tool Segmented Control
  document.querySelectorAll('#editToolSegmented .seg-btn[data-edit-tool]').forEach((b) => {
    b.classList.toggle('active', b.dataset.editTool === StudioState.activeTool);
  });

  // 5. Edit Scope Pills & Canvas Center Sub-selector
  document.querySelectorAll('#editScopeGrid .edit-scope-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.scope === StudioState.editScope);
  });

  const centerSymWrap = document.getElementById('canvasCenterSymmetryWrap');
  if (centerSymWrap) {
    centerSymWrap.classList.toggle('hidden', StudioState.editScope !== 'canvas_center');
  }
  document.querySelectorAll('#canvasCenterSymControl .seg-btn[data-center-sym]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.centerSym === StudioState.canvasCenterSymmetry);
  });

  const chipEl = document.getElementById('editScopeChip');
  if (chipEl && window.UiFormat && typeof window.UiFormat.formatScopeChip === 'function') {
    chipEl.textContent = window.UiFormat.formatScopeChip(StudioState.editScope, ensureSupertilePattern());
  }

  // Freeze Tool Options Wrap
  const freezeWrap = document.getElementById('freezeToolOptionsWrap');
  if (freezeWrap) {
    freezeWrap.classList.toggle('hidden', StudioState.activeTool !== 'freeze');
  }
  document.querySelectorAll('#freezeModeControl .seg-btn').forEach((btn) => {
    const isActive = btn.dataset.freezeMode === StudioState.freezeMode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  document.querySelectorAll('#freezeSizeControl .seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.freezeSize === StudioState.freezeSize);
  });


  const sameTileNotice = document.getElementById('sameTileNotice');
  if (sameTileNotice) {
    const curPat = ensureSupertilePattern();
    const isMulti = curPat.rows > 1 || curPat.cols > 1;
    sameTileNotice.classList.toggle('hidden', !(StudioState.editScope === 'same_tile' && isMulti));
  }

  // 6. Contextual Rotate Tool Controls (and hide Brush Panel when Rotate tool is active)
  const isRotateTool = StudioState.activeTool === 'rotate';
  const rotateOpts = document.getElementById('rotateToolOptionsWrap');
  if (rotateOpts) {
    rotateOpts.classList.toggle('hidden', !isRotateTool);
  }
  const brushPanel = document.getElementById('panel-edit-brush');
  if (brushPanel) {
    brushPanel.classList.toggle('hidden', isRotateTool);
  }

  document.querySelectorAll('#rotateSizeControl .seg-btn[data-rot-size]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.rotSize === StudioState.rotateSizeMode);
  });

  const rotateGroupSection = document.getElementById('rotateGroupModeSection');
  if (rotateGroupSection) {
    rotateGroupSection.classList.toggle('hidden', StudioState.rotateSizeMode === '1');
  }
  document.querySelectorAll('#rotateGroupModeControl .seg-btn[data-rot-group]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.rotGroup === StudioState.rotateGroupMode);
  });
  document.querySelectorAll('#rotateBehaviorControl .seg-btn[data-rot-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.rotMode === StudioState.rotateBehavior);
  });

  // 7. Unified Supertile / Brush / Clone Panel Controls
  const stampModeSection = document.getElementById('stampModeSection');
  if (stampModeSection) {
    stampModeSection.classList.toggle('hidden', StudioState.activeTool !== 'stamp');
  }

  document.querySelectorAll('#stampInteractionSegmented .seg-btn[data-stamp-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.stampMode === StudioState.stampInteractionMode);
  });

  document.querySelectorAll('#brushSizeControl .seg-btn[data-brush-size]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.brushSize === StudioState.brushSizeMode);
  });


  // 8. Supertile Builder Metadata, Badges & Contextual Actions
  const pat = ensureSupertilePattern();
  const isSingleCell = pat.rows === 1 && pat.cols === 1;
  const builderActions = document.getElementById('supertileBuilderActions');
  if (builderActions) {
    builderActions.classList.toggle('hidden', isSingleCell && StudioState.activeTool !== 'stamp');
  }

  const brushNameEl = document.getElementById('activeBrushTileName');
  const brushD4El = document.getElementById('activeBrushD4Label');
  const brushBadgeEl = document.getElementById('activeBrushBadge');

  const d4Meta = window.D4Symmetry.D4_METADATA[StudioState.editBrushTransform] || window.D4Symmetry.D4_METADATA.id;

  if (isSingleCell) {
    const c0 = pat.cells[0][0];
    const cMeta = window.D4Symmetry.D4_METADATA[c0.transform] || window.D4Symmetry.D4_METADATA.id;
    const cName = window.TileRegistry.TILE_NAMES[c0.baseTileId] || `Tile #${c0.baseTileId}`;
    if (brushNameEl) brushNameEl.textContent = `#${c0.baseTileId} • ${cName}`;
    if (brushD4El) brushD4El.textContent = `${cMeta.label} ${cMeta.arrow}`;
    if (brushBadgeEl) brushBadgeEl.textContent = `1×1 • #${c0.baseTileId}`;
  } else {
    if (brushNameEl) brushNameEl.textContent = `Supertile ${pat.cols}×${pat.rows} (#${StudioState.editBrushTileId})`;
    if (brushD4El) brushD4El.textContent = `${d4Meta.label} ${d4Meta.arrow}`;
    if (brushBadgeEl) brushBadgeEl.textContent = `${pat.cols}×${pat.rows}`;
  }

  syncEditUndoUI();
  updateHoverStatusText();
}

function updateHoverStatusText() {
  const el = document.getElementById('statusHoverInspector');
  if (!el) return;

  const hit = StudioState.hoveredCell;
  if (!hit || !StudioState.mosaicData) {
    if (StudioState.activeTool === 'freeze') {
      const count = StudioState.frozenCells ? StudioState.frozenCells.size : 0;
      el.innerHTML = `<strong>Travar Subtiles (F):</strong> Clique para travar/destravar • Alt+Clique destrava • Escopo: <strong>${StudioState.editScope}</strong> • Travados: <strong>${count}</strong>`;
      return;
    }
    if (StudioState.workspace === 'edit') {
      if (StudioState.activeTool === 'rotate') {
        el.innerHTML = '<strong>Girar (R):</strong> Clique Esq gira +90° • Clique Dir gira -90° • Alt+Arraste captura área';
      } else if (StudioState.activeTool === 'stamp') {
        el.innerHTML = '<strong>Clonar (S):</strong> Arraste para capturar área • Clique Esq cola • Clique Dir gira o clone (+90°)';
      } else {
        el.innerHTML = '<strong>Pincel (B):</strong> Clique/arraste para pintar • Clique Dir gira o pincel (+90°) • Alt+Arraste captura área';
      }
    } else {
      el.textContent = 'Passe o cursor sobre o mosaico para inspecionar o bloco, sua órbita e rotação D4';
    }
    return;
  }

  const block = StudioState.mosaicData.grid[hit.row]?.[hit.col];
  if (!block) return;

  const d4Meta = window.D4Symmetry.D4_METADATA[block.transformFromSource] || window.D4Symmetry.D4_METADATA.id;
  const subCell = block.cells[hit.subRow]?.[hit.subCol];
  const tileName = subCell ? (window.TileRegistry.TILE_NAMES[subCell.tileId] || `Tile #${subCell.tileId}`) : '';
  const isCellFrozen = StudioState.frozenCells && StudioState.frozenCells.has(`${hit.row},${hit.col},${hit.subRow},${hit.subCol}`);
  const freezeBadge = isCellFrozen ? ' • <span style="color:#38bdf8;font-weight:700;">❄️ TRAVADO</span>' : '';

  el.innerHTML =
    `Bloco <strong>[L${hit.row + 1}, C${hit.col + 1}]</strong> • ` +
    `Órbita <strong>#${block.orbitId}</strong> • ` +
    `Giro/Espelho: <strong>${d4Meta.label} (${d4Meta.arrow})</strong> • ` +
    `Subtile [${hit.subRow + 1},${hit.subCol + 1}]: <strong>#${subCell ? subCell.tileId : '-'} ${tileName}</strong>${freezeBadge}`;
}

function updateStatusBar() {
  const artEl = document.getElementById('statusArtboardInfo');
  const gridEl = document.getElementById('statusGridInfo');

  if (artEl) {
    artEl.textContent = `${StudioState.width} × ${StudioState.height} px (${StudioState.zoomPercent}%)`;
  }
  if (gridEl && StudioState.mosaicData) {
    const totalBlocks = StudioState.rows * StudioState.cols;
    const subPerBlock = (StudioState.subdivision * 2) ** 2;
    gridEl.textContent = `Grade ${StudioState.rows}×${StudioState.cols} (${totalBlocks} blocos • ${StudioState.mosaicData.totalOrbits} órbitas • ${totalBlocks * subPerBlock} subtiles)`;
  }
}

// ============================================================================
// UI Initialization & Event Binding
// ============================================================================

function syncAllInputsFromState() {
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };

  setVal('canvasW', StudioState.width);
  setVal('canvasH', StudioState.height);
  setVal('gridRows', StudioState.rows);
  setVal('gridCols', StudioState.cols);
  setVal('gridMargin', StudioState.margin);
  setVal('seedInput', StudioState.seed);
  setVal('paddingInput', Math.round(StudioState.paddingRatio * 100));
  setVal('fgColorPicker', StudioState.fgColor);
  setVal('bgColorPicker', StudioState.bgColor);

  const btnLockCanvas = document.getElementById('btnLockCanvasRatio');
  if (btnLockCanvas) {
    btnLockCanvas.classList.toggle('locked', Boolean(StudioState.lockCanvasRatio));
    btnLockCanvas.innerHTML = StudioState.lockCanvasRatio ? LOCK_ICON_SVG : UNLOCK_ICON_SVG;
  }
  const btnLockGrid = document.getElementById('btnLockGridRatio');
  if (btnLockGrid) {
    btnLockGrid.classList.toggle('locked', Boolean(StudioState.lockGridRatio));
    btnLockGrid.innerHTML = StudioState.lockGridRatio ? LOCK_ICON_SVG : UNLOCK_ICON_SVG;
  }
}

function initStudioUI() {
  window.InfoUI?.init();

  document.getElementById('btnD4Undo')?.addEventListener('click', () => {
    undoMosaicEdit();
    hideD4Warning();
  });
  document.getElementById('btnD4Continue')?.addEventListener('click', () => {
    hideD4Warning();
  });

  buildSymmetryPanelUI();
  buildEditWorkspaceUI();
  renderSwatchesPanel();
  renderEditBrushPalette();
  renderSupertileBuilderCanvas();
  syncAllInputsFromState();
  syncEditWorkspaceUI();

  // --- Artboard Size Controls ---
  const wInput = document.getElementById('canvasW');
  const hInput = document.getElementById('canvasH');
  const btnSwapCanvas = document.getElementById('btnSwapCanvasSize');
  const btnLockCanvas = document.getElementById('btnLockCanvasRatio');
  const btnFitCanvasToGrid = document.getElementById('btnFitCanvasToGrid');

  const applyCanvasDimensions = (newW, newH) => {
    StudioState.width = Math.max(100, Math.min(4096, Math.round(newW)));
    StudioState.height = Math.max(100, Math.min(4096, Math.round(newH)));
    if (wInput) wInput.value = StudioState.width;
    if (hInput) hInput.value = StudioState.height;
    applyZoomTransform();
    regenerateMosaic(true);
  };

  wInput?.addEventListener('change', () => {
    const val = parseInt(wInput.value, 10) || StudioState.width;
    const nextH = StudioState.lockCanvasRatio ? Math.round(val / StudioState.canvasRatio) : StudioState.height;
    applyCanvasDimensions(val, nextH);
  });

  hInput?.addEventListener('change', () => {
    const val = parseInt(hInput.value, 10) || StudioState.height;
    const nextW = StudioState.lockCanvasRatio ? Math.round(val * StudioState.canvasRatio) : StudioState.width;
    applyCanvasDimensions(nextW, val);
  });

  btnSwapCanvas?.addEventListener('click', () => {
    applyCanvasDimensions(StudioState.height, StudioState.width);
    if (StudioState.lockCanvasRatio) {
      StudioState.canvasRatio = StudioState.width / StudioState.height;
    }
  });

  btnLockCanvas?.addEventListener('click', () => {
    StudioState.lockCanvasRatio = !StudioState.lockCanvasRatio;
    StudioState.canvasRatio = StudioState.width / Math.max(1, StudioState.height);
    btnLockCanvas.classList.toggle('locked', StudioState.lockCanvasRatio);
    btnLockCanvas.innerHTML = StudioState.lockCanvasRatio ? LOCK_ICON_SVG : UNLOCK_ICON_SVG;
  });

  btnFitCanvasToGrid?.addEventListener('click', () => {
    const ratio = StudioState.cols / Math.max(1, StudioState.rows);
    const maxSide = Math.max(StudioState.width, StudioState.height);
    const nextW = ratio >= 1 ? maxSide : Math.round(maxSide * ratio);
    const nextH = ratio >= 1 ? Math.round(maxSide / ratio) : maxSide;
    applyCanvasDimensions(nextW, nextH);
  });

  // --- Grid Controls ---
  const rowsInput = document.getElementById('gridRows');
  const colsInput = document.getElementById('gridCols');
  const btnSwapGrid = document.getElementById('btnSwapGridSize');
  const btnLockGrid = document.getElementById('btnLockGridRatio');
  const btnSquareGrid = document.getElementById('btnSquareGrid');
  const marginInput = document.getElementById('gridMargin');

  const applyGridDimensions = (r, c) => {
    StudioState.rows = Math.max(1, Math.min(32, Math.round(r)));
    StudioState.cols = Math.max(1, Math.min(32, Math.round(c)));
    if (rowsInput) rowsInput.value = StudioState.rows;
    if (colsInput) colsInput.value = StudioState.cols;
    regenerateMosaic(true);
  };

  rowsInput?.addEventListener('change', () => {
    const val = parseInt(rowsInput.value, 10) || StudioState.rows;
    const nextC = StudioState.lockGridRatio ? Math.max(1, Math.round(val * StudioState.gridRatio)) : StudioState.cols;
    applyGridDimensions(val, nextC);
  });

  colsInput?.addEventListener('change', () => {
    const val = parseInt(colsInput.value, 10) || StudioState.cols;
    const nextR = StudioState.lockGridRatio ? Math.max(1, Math.round(val / StudioState.gridRatio)) : StudioState.rows;
    applyGridDimensions(nextR, val);
  });

  btnSwapGrid?.addEventListener('click', () => {
    applyGridDimensions(StudioState.cols, StudioState.rows);
    if (StudioState.lockGridRatio) {
      StudioState.gridRatio = StudioState.cols / StudioState.rows;
    }
  });

  btnLockGrid?.addEventListener('click', () => {
    StudioState.lockGridRatio = !StudioState.lockGridRatio;
    StudioState.gridRatio = StudioState.cols / Math.max(1, StudioState.rows);
    btnLockGrid.classList.toggle('locked', StudioState.lockGridRatio);
    btnLockGrid.innerHTML = StudioState.lockGridRatio ? LOCK_ICON_SVG : UNLOCK_ICON_SVG;
  });

  btnSquareGrid?.addEventListener('click', () => {
    const drawW = Math.max(1, StudioState.width - StudioState.margin * 2);
    const drawH = Math.max(1, StudioState.height - StudioState.margin * 2);
    const nextCols = Math.max(1, Math.round(StudioState.rows * (drawW / drawH)));
    applyGridDimensions(StudioState.rows, nextCols);
  });

  document.getElementById('btnMakeGridEqual')?.addEventListener('click', () => {
    const n = Math.max(StudioState.rows, StudioState.cols);
    applyGridDimensions(n, n);
  });

  marginInput?.addEventListener('input', () => {
    StudioState.margin = Math.max(0, parseInt(marginInput.value, 10) || 0);
    saveScheduler.schedule();
    redraw();
  });

  // --- Custom Stepper Buttons (▴ / ▾) for Top-Bar Number Inputs ---
  document.querySelectorAll('.step-btn[data-step-target]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.dataset.stepTarget;
      const dir = parseInt(btn.dataset.stepDir, 10) || 1;
      const inputEl = document.getElementById(targetId);
      if (!inputEl) return;

      const step = parseFloat(inputEl.step) || 1;
      const min = inputEl.min !== '' ? parseFloat(inputEl.min) : -Infinity;
      const max = inputEl.max !== '' ? parseFloat(inputEl.max) : Infinity;
      const current = parseFloat(inputEl.value) || 0;
      const next = Math.max(min, Math.min(max, current + dir * step));

      inputEl.value = next;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  // --- Seed & History Controls ---
  const seedInput = document.getElementById('seedInput');
  const btnRandomize = document.getElementById('btnRandomize');
  const btnPrevSeed = document.getElementById('btnPrevSeed');
  const btnNextSeed = document.getElementById('btnNextSeed');
  const btnToggleHistory = document.getElementById('btnToggleHistory');
  const seedPopover = document.getElementById('seedHistoryPopover');

  const positionSeedPopover = () => {
    if (!btnToggleHistory || !seedPopover) return;
    const rect = btnToggleHistory.getBoundingClientRect();
    const popWidth = 290;
    if (rect.left < 100) {
      seedPopover.style.left = `${Math.round(rect.right + 8)}px`;
      seedPopover.style.top = `${Math.round(Math.max(8, Math.min(window.innerHeight - 320, rect.top)))}px`;
    } else {
      const left = Math.max(8, Math.min(window.innerWidth - popWidth - 8, rect.right - popWidth));
      seedPopover.style.top = `${Math.round(rect.bottom + 6)}px`;
      seedPopover.style.left = `${Math.round(left)}px`;
    }
  };

  seedInput?.addEventListener('change', () => {
    const val = parseInt(seedInput.value, 10);
    StudioState.seed = Number.isNaN(val) ? 0 : val;
    regenerateMosaic(true);
  });

  const triggerRandomSeed = () => {
    StudioState.seed = Math.floor(Math.random() * 100000);
    if (seedInput) seedInput.value = StudioState.seed;
    regenerateMosaic(true);
  };

  btnRandomize?.addEventListener('click', triggerRandomSeed);
  btnPrevSeed?.addEventListener('click', () => restoreGenerationHistory(StudioState.historyIndex - 1));
  btnNextSeed?.addEventListener('click', () => restoreGenerationHistory(StudioState.historyIndex + 1));

  btnToggleHistory?.addEventListener('click', (e) => {
    e.stopPropagation();
    const historyList = document.getElementById('seedHistoryList');
    const historyContainer = historyList?.closest('.sidebar-history-container');
    if (historyList) {
      const isCollapsed = historyList.classList.toggle('collapsed');
      if (historyContainer) historyContainer.classList.toggle('is-collapsed', isCollapsed);
      btnToggleHistory.textContent = isCollapsed ? '▸' : '▾';
      btnToggleHistory.setAttribute('aria-expanded', String(!isCollapsed));
      btnToggleHistory.title = isCollapsed ? 'Expandir Histórico' : 'Recolher Histórico';
    }
  });

  window.addEventListener('resize', () => {
    if (seedPopover && !seedPopover.classList.contains('hidden')) {
      positionSeedPopover();
    }
  });

  document.addEventListener('click', (e) => {
    if (seedPopover && !seedPopover.contains(e.target) && !btnToggleHistory?.contains(e.target)) {
      seedPopover.classList.add('hidden');
      btnToggleHistory?.classList.remove('active');
    }
  });

  // --- Export Controls ---
  document.getElementById('btnExport')?.addEventListener('click', () => {
    const fmt = document.getElementById('exportFormatSelect')?.value || 'png';
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `tilling_stripes_seed-${StudioState.seed}_${StudioState.rows}x${StudioState.cols}_${StudioState.gridSymmetryMode}_${stamp}`;

    if (fmt === 'svg') {
      const svgCtx = new SimpleSVG(StudioState.width, StudioState.height);
      window.MosaicEngine.renderMosaicToContext(svgCtx, StudioState.mosaicData, {
        width: StudioState.width,
        height: StudioState.height,
        margin: StudioState.margin,
        paddingRatio: StudioState.paddingRatio,
        fgColor: StudioState.fgColor,
        bgColor: StudioState.bgColor
      });
      svgCtx.save(`${filename}.svg`);
    } else {
      const gfx = createGraphics(StudioState.width, StudioState.height);
      window.MosaicEngine.renderMosaicToContext(gfx, StudioState.mosaicData, {
        width: StudioState.width,
        height: StudioState.height,
        margin: StudioState.margin,
        paddingRatio: StudioState.paddingRatio,
        fgColor: StudioState.fgColor,
        bgColor: StudioState.bgColor
      });
      saveCanvas(gfx, filename, 'png');
      gfx.remove();
    }
  });

  // --- Right Dock Controls (Symmetry, Subdivision, Padding, Colors) ---
  document.querySelectorAll('#subdivisionControl .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      StudioState.subdivision = parseInt(btn.dataset.sub, 10) || 2;
      regenerateMosaic(true);
    });
  });

  const paddingInput = document.getElementById('paddingInput');
  const applyPaddingValue = (raw) => {
    const pct = Math.max(0, Math.min(25, parseInt(raw, 10) || 0));
    StudioState.paddingRatio = pct / 100;
    if (paddingInput && String(paddingInput.value) !== String(pct)) paddingInput.value = pct;
    renderSupertileBuilderCanvas();
    saveScheduler.schedule();
    redraw();
  };
  paddingInput?.addEventListener('input', () => applyPaddingValue(paddingInput.value));
  paddingInput?.addEventListener('change', () => applyPaddingValue(paddingInput.value));

  const fgPicker = document.getElementById('fgColorPicker');
  const bgPicker = document.getElementById('bgColorPicker');
  fgPicker?.addEventListener('input', () => {
    StudioState.fgColor = fgPicker.value;
    renderSupertileBuilderCanvas();
    saveScheduler.schedule();
    redraw();
  });
  bgPicker?.addEventListener('input', () => {
    StudioState.bgColor = bgPicker.value;
    renderSupertileBuilderCanvas();
    saveScheduler.schedule();
    redraw();
  });
  document.getElementById('btnSwapColors')?.addEventListener('click', () => {
    const tmp = StudioState.fgColor;
    StudioState.fgColor = StudioState.bgColor;
    StudioState.bgColor = tmp;
    if (fgPicker) fgPicker.value = StudioState.fgColor;
    if (bgPicker) bgPicker.value = StudioState.bgColor;
    renderSupertileBuilderCanvas();
    saveScheduler.flush();
    saveStudioStateToStorage();
    redraw();
  });

  // --- Swatches Bulk Controls ---
  document.getElementById('tileSearchInput')?.addEventListener('input', (e) => {
    StudioState.searchQuery = e.target.value;
    renderSwatchesPanel();
  });

  document.getElementById('btnSelectAllTiles')?.addEventListener('click', () => {
    const total = window.TileRegistry.TILE_RENDERERS.length;
    for (let i = 0; i < total; i++) StudioState.allowedTiles.add(i);
    renderSwatchesPanel();
    regenerateMosaic(true);
  });

  document.getElementById('btnSelectNoTiles')?.addEventListener('click', () => {
    StudioState.allowedTiles.clear();
    renderSwatchesPanel();
    regenerateMosaic(true);
  });

  document.getElementById('btnInvertTiles')?.addEventListener('click', () => {
    const total = window.TileRegistry.TILE_RENDERERS.length;
    for (let i = 0; i < total; i++) {
      if (StudioState.allowedTiles.has(i)) StudioState.allowedTiles.delete(i);
      else StudioState.allowedTiles.add(i);
    }
    renderSwatchesPanel();
    regenerateMosaic(true);
  });

  document.getElementById('btnRandomFamilies')?.addEventListener('click', () => {
    const families = window.TileRegistry.TILE_FAMILIES_META;
    StudioState.allowedTiles.clear();
    const shuffled = [...families].sort(() => Math.random() - 0.5);
    const count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      shuffled[i].tileIds.forEach((id) => StudioState.allowedTiles.add(id));
    }
    StudioState.seed = Math.floor(Math.random() * 100000);
    if (seedInput) seedInput.value = StudioState.seed;
    renderSwatchesPanel();
    regenerateMosaic(true);
  });

  // --- Workspace Mode Switcher, Left Toolbar & Edit Tools ---
  const setActiveTool = (tool) => {
    saveScheduler.flush();
    StudioState.activeTool = tool;
    if (tool === 'paint' || tool === 'rotate' || tool === 'stamp' || tool === 'freeze') {
      StudioState.workspace = 'edit';
    } else if (tool === 'inspect') {
      // Inspect is the generation context: the panel shows grid/symmetry/tiles.
      StudioState.workspace = 'generate';
    }
    const pasteboard = document.getElementById('artboard-pasteboard');
    if (pasteboard) {
      pasteboard.classList.toggle('panning', tool === 'pan' || StudioState.isSpaceDown);
    }
    syncEditWorkspaceUI();
    saveStudioStateToStorage();
    redraw();
  };

  // Round 6: inspect is the generation context — no separate context button any more.



  const btnClearFrozen = document.getElementById('btnClearFrozen');
  if (btnClearFrozen) {
    btnClearFrozen.addEventListener('click', () => {
      clearFrozenCells();
    });
  }

  // Freeze Mode & Size segmented controls
  document.querySelectorAll('#freezeModeControl .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      StudioState.freezeMode = btn.dataset.freezeMode || 'freeze';
      syncEditWorkspaceUI();
      saveStudioStateToStorage();
      redraw();
    });
  });

  document.querySelectorAll('#freezeSizeControl .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      StudioState.freezeSize = btn.dataset.freezeSize || '1';
      syncEditWorkspaceUI();
      saveStudioStateToStorage();
      redraw();
    });
  });

  const btnFreezeClearSelection = document.getElementById('btnFreezeClearSelection');
  if (btnFreezeClearSelection) {
    btnFreezeClearSelection.addEventListener('click', () => {
      clearFrozenCells();
    });
  }

  document.querySelectorAll('#left-toolbar .tool-btn[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
  });

  document.querySelectorAll('#editToolSegmented .seg-btn[data-edit-tool]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTool(btn.dataset.editTool));
  });

  // --- Stage 2: Edit Undo/Redo, Canvas Center Sym, Rotate Options & Supertile Builder ---
  document.getElementById('btnEditUndo')?.addEventListener('click', undoMosaicEdit);
  document.getElementById('btnEditRedo')?.addEventListener('click', redoMosaicEdit);

  // Canvas Center Global Symmetry Sub-selector
  document.querySelectorAll('#canvasCenterSymControl .seg-btn[data-center-sym]').forEach((btn) => {
    btn.addEventListener('click', () => {
      StudioState.canvasCenterSymmetry = btn.dataset.centerSym || 'mandala_d4';
      syncEditWorkspaceUI();
      saveStudioStateToStorage();
      redraw();
    });
  });

  // Rotate Tool Controls (Size, Snap to Block, Group vs Individual, D4 vs Family)
  document.querySelectorAll('#rotateSizeControl .seg-btn[data-rot-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sz = btn.dataset.rotSize || '1';
      StudioState.rotateSizeMode = sz;
      StudioState.rotateSnapToBlock = (sz === 'block');
      syncEditWorkspaceUI();
      saveStudioStateToStorage();
      redraw();
    });
  });



  document.querySelectorAll('#rotateGroupModeControl .seg-btn[data-rot-group]').forEach((btn) => {
    btn.addEventListener('click', () => {
      StudioState.rotateGroupMode = btn.dataset.rotGroup || 'group';
      syncEditWorkspaceUI();
      saveStudioStateToStorage();
      redraw();
    });
  });

  document.querySelectorAll('#rotateBehaviorControl .seg-btn[data-rot-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      StudioState.rotateBehavior = btn.dataset.rotMode || 'd4_r90';
      syncEditWorkspaceUI();
      saveStudioStateToStorage();
      redraw();
    });
  });

  // Brush / Supertile Size & Snap to Block
  document.querySelectorAll('#brushSizeControl .seg-btn[data-brush-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setBrushSizeMode(btn.dataset.brushSize || '1');
    });
  });



  // Stamp Interaction Mode ('select' vs 'apply')
  document.querySelectorAll('#stampInteractionSegmented .seg-btn[data-stamp-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      StudioState.stampInteractionMode = btn.dataset.stampMode || 'select';
      syncEditWorkspaceUI();
      saveStudioStateToStorage();
      redraw();
    });
  });

  // Interactive Mini-Canvas for Supertile Builder
  const miniCanvas = document.getElementById('supertileBuilderCanvas');
  if (miniCanvas) {
    miniCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
    miniCanvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (e.button === 0) {
        StudioState.isPaintingMiniBuilder = true;
      }
      handleMiniBuilderCanvasMouse(e, false);
    });
    miniCanvas.addEventListener('mousemove', (e) => {
      if (StudioState.isPaintingMiniBuilder) {
        handleMiniBuilderCanvasMouse(e, true);
      }
    });
  }

  // Supertile / Brush D4 Transform & Builder Actions
  document.getElementById('btnBrushRot90')?.addEventListener('click', () => rotateOrFlipActiveBrush('r90'));
  document.getElementById('btnBrushFlipX')?.addEventListener('click', () => rotateOrFlipActiveBrush('mx'));
  document.getElementById('btnBrushFlipY')?.addEventListener('click', () => rotateOrFlipActiveBrush('my'));
  document.getElementById('btnBrushResetD4')?.addEventListener('click', resetActiveBrushOrientation);

  document.getElementById('btnSupertileFillAll')?.addEventListener('click', () => {
    const pat = ensureSupertilePattern();
    StudioState.supertilePattern = window.MosaicEngine.createSupertilePattern(
      pat.rows,
      pat.cols,
      StudioState.editBrushTileId,
      StudioState.editBrushTransform || 'id'
    );
    StudioState.stampBlock = StudioState.supertilePattern;
    renderSupertileBuilderCanvas();
    syncEditWorkspaceUI();
    saveStudioStateToStorage();
    redraw();
  });

  document.getElementById('btnSupertileSymmetrize')?.addEventListener('click', () => {
    const pat = ensureSupertilePattern();
    if (pat.rows === 1 && pat.cols === 1) {
      setBrushSizeMode('2');
    }
    StudioState.supertilePattern = window.MosaicEngine.symmetrizeSupertilePattern(
      ensureSupertilePattern(),
      'mandala_d4'
    );
    StudioState.stampBlock = StudioState.supertilePattern;
    renderSupertileBuilderCanvas();
    syncEditWorkspaceUI();
    saveStudioStateToStorage();
    redraw();
  });

  document.getElementById('btnSupertileCapture')?.addEventListener('click', () => {
    StudioState.activeTool = 'stamp';
    StudioState.workspace = 'edit';
    StudioState.stampInteractionMode = 'select';
    syncEditWorkspaceUI();
    redraw();
  });

  document.getElementById('editBrushSearchInput')?.addEventListener('input', (e) => {
    StudioState.editBrushSearchQuery = e.target.value;
    renderEditBrushPalette();
  });

  const bindGuideToggle = (btnId, guideKey) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const isActive = !!StudioState.guides[guideKey];
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    btn.addEventListener('click', () => {
      StudioState.guides[guideKey] = !StudioState.guides[guideKey];
      const active = !!StudioState.guides[guideKey];
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      saveStudioStateToStorage();
      redraw();
    });
  };

  bindGuideToggle('toggleGuideAxes', 'showSymmetryAxes');
  bindGuideToggle('toggleGuideBlocks', 'showBlockGrid');
  bindGuideToggle('toggleGuideSubtiles', 'showSubtileGrid');
  bindGuideToggle('toggleGuideOrbits', 'showOrbitBadges');

  document.getElementById('btnFitArtboard')?.addEventListener('click', fitArtboardToWindow);

  // Right Dock Accordion Panels Toggle & Keyboard Navigation
  function toggleDockPanel(header) {
    const targetId = header.dataset.collapseTarget;
    if (!targetId) return;
    const bodyEl = document.getElementById(targetId);
    const panelEl = header.closest('.dock-panel');
    if (!bodyEl || !panelEl) return;

    const isCollapsed = panelEl.classList.toggle('collapsed');
    bodyEl.classList.toggle('hidden', isCollapsed);
    header.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');

    if (!StudioState.dockPanels) StudioState.dockPanels = {};
    StudioState.dockPanels[targetId] = !isCollapsed;
    saveStudioStateToStorage();
  }

  document.querySelectorAll('.panel-header[data-collapse-target]').forEach((header) => {
    header.addEventListener('click', () => toggleDockPanel(header));
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleDockPanel(header);
      }
    });
  });

  // Restore persisted dock panels state
  if (StudioState.dockPanels) {
    document.querySelectorAll('.panel-header[data-collapse-target]').forEach((header) => {
      const targetId = header.dataset.collapseTarget;
      if (!targetId || StudioState.dockPanels[targetId] === undefined) return;
      const isOpen = !!StudioState.dockPanels[targetId];
      const panelEl = header.closest('.dock-panel');
      const bodyEl = document.getElementById(targetId);
      if (panelEl) panelEl.classList.toggle('collapsed', !isOpen);
      if (bodyEl) bodyEl.classList.toggle('hidden', !isOpen);
      header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // Right Dock Drawer Toggle (Rail 44px vs Full Width)
  const btnToggleDock = document.getElementById('btnToggleRightDock');
  const updateDockToggleUI = () => {
    const isCollapsed = document.body.classList.contains('right-dock-collapsed');
    StudioState.rightDockCollapsed = isCollapsed;
    if (btnToggleDock) {
      btnToggleDock.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      btnToggleDock.setAttribute('title', isCollapsed ? 'Expandir Painel Lateral (Tab)' : 'Recolher Painel Lateral (Tab)');
      btnToggleDock.setAttribute('aria-label', isCollapsed ? 'Expandir Painel Lateral' : 'Recolher Painel Lateral');
      const iconSpan = btnToggleDock.querySelector('.dock-toggle-icon');
      if (iconSpan) {
        // The arrow points where the panel goes: » to collapse, « to bring it back.
        iconSpan.textContent = isCollapsed ? '«' : '»';
      }
    }
  };

  const toggleRightDock = () => {
    document.body.classList.toggle('right-dock-collapsed');
    updateDockToggleUI();
    saveStudioStateToStorage();
  };
  btnToggleDock?.addEventListener('click', toggleRightDock);

  if (StudioState.rightDockCollapsed) {
    document.body.classList.add('right-dock-collapsed');
  }
  updateDockToggleUI();

  // --- Zoom Status Controls & Canvas Wheel/Pan ---
  document.getElementById('btnZoomIn')?.addEventListener('click', () => setZoomPercent(StudioState.zoomPercent + 25));
  document.getElementById('btnZoomOut')?.addEventListener('click', () => setZoomPercent(StudioState.zoomPercent - 25));
  document.getElementById('btnZoomReset100')?.addEventListener('click', resetZoom100);

  const zoomPreset = document.getElementById('zoomPresetSelect');
  zoomPreset?.addEventListener('change', () => {
    if (zoomPreset.value === 'fit') {
      fitArtboardToWindow();
    } else if (zoomPreset.value !== 'custom') {
      setZoomPercent(parseInt(zoomPreset.value, 10) || 100);
    }
  });

  const pasteboard = document.getElementById('artboard-pasteboard');
  let wheelDeltaAccumulator = 0;
  const WHEEL_STEP_THRESHOLD = 45;

  pasteboard?.addEventListener('wheel', (e) => {
    // 1. Zoom with modifier: Ctrl / Cmd / Alt + wheel (or active tool 'zoom')
    if (e.ctrlKey || e.metaKey || e.altKey || StudioState.activeTool === 'zoom') {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 15 : -15;
      setZoomPercent(StudioState.zoomPercent + delta);
      return;
    }

    // 2. Pan with modifier (Shift) or while Space is held or in Pan tool:
    if (e.shiftKey || StudioState.isSpaceDown || StudioState.activeTool === 'pan') {
      e.preventDefault();
      const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
      StudioState.panOffsetX = (StudioState.panOffsetX || 0) - dx;
      StudioState.panOffsetY = (StudioState.panOffsetY || 0) - dy;
      applyPanTransform();
      return;
    }

    // 3. Edit tools (paint, stamp, rotate, freeze) without modifier keys:
    // Directly cycle tool/brush size using the mouse wheel!
    const isEditTool = StudioState.activeTool === 'paint' ||
      StudioState.activeTool === 'stamp' ||
      StudioState.activeTool === 'rotate' ||
      StudioState.activeTool === 'freeze';

    if (isEditTool) {
      e.preventDefault();
      wheelDeltaAccumulator += e.deltaY;
      if (Math.abs(wheelDeltaAccumulator) >= WHEEL_STEP_THRESHOLD) {
        const direction = wheelDeltaAccumulator < 0 ? 1 : -1;
        wheelDeltaAccumulator = 0;
        cycleActiveToolSize(direction);
      }
      return;
    }

    // 4. Non-edit tools (inspect): plain wheel pans the canvas in 2D
    e.preventDefault();
    StudioState.panOffsetX = (StudioState.panOffsetX || 0) - e.deltaX;
    StudioState.panOffsetY = (StudioState.panOffsetY || 0) - e.deltaY;
    applyPanTransform();
  }, { passive: false });

  pasteboard?.addEventListener('mousedown', (e) => {
    if (StudioState.activeTool === 'zoom') {
      const delta = (e.altKey || e.button === 2) ? -25 : 25;
      setZoomPercent(StudioState.zoomPercent + delta);
      return;
    }
    if (StudioState.activeTool === 'pan' || StudioState.isSpaceDown || e.button === 1) {
      StudioState.isPanning = true;
      StudioState.panStartX = e.clientX;
      StudioState.panStartY = e.clientY;
      StudioState.panStartOffsetX = StudioState.panOffsetX || 0;
      StudioState.panStartOffsetY = StudioState.panOffsetY || 0;
      document.body.classList.add('is-panning');
      pasteboard?.classList.add('panning');
      e.preventDefault();
    }
  });

  pasteboard?.addEventListener('dblclick', (e) => {
    if (StudioState.activeTool === 'pan') {
      StudioState.panOffsetX = 0;
      StudioState.panOffsetY = 0;
      applyPanTransform();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!StudioState.isPanning) return;
    const dx = e.clientX - StudioState.panStartX;
    const dy = e.clientY - StudioState.panStartY;
    StudioState.panOffsetX = StudioState.panStartOffsetX + dx;
    StudioState.panOffsetY = StudioState.panStartOffsetY + dy;
    applyPanTransform();
  });

  window.addEventListener('mouseup', () => {
    if (StudioState.isPanning) {
      StudioState.isPanning = false;
      document.body.classList.remove('is-panning');
      if (StudioState.activeTool !== 'pan' && !StudioState.isSpaceDown) {
        pasteboard?.classList.remove('panning');
      }
    }
    StudioState.isPaintingMiniBuilder = false;
    if (StudioState.isFreezingDrag) {
      StudioState.isFreezingDrag = false;
      if (StudioState.pendingEditHistoryPush) {
        StudioState.pendingEditHistoryPush = false;
        pushEditHistorySnapshot();
      }
      saveStudioStateToStorage();
    }

    if (StudioState.isSelectingStampDrag) {
      StudioState.isSelectingStampDrag = false;
      if (StudioState.mosaicData) {
        const captured = window.MosaicEngine.captureSubtileRegion(
          StudioState.mosaicData,
          StudioState.stampDragStartGR,
          StudioState.stampDragStartGC,
          StudioState.stampDragCurrGR,
          StudioState.stampDragCurrGC
        );
        if (captured) {
          StudioState.supertilePattern = captured;
          StudioState.stampBlock = captured;
          StudioState.editBrushTransform = 'id';

          const N = StudioState.mosaicData.subtilesPerSide;
          if (captured.rows === 1 && captured.cols === 1) {
            const c0 = captured.cells[0][0];
            StudioState.editBrushTileId = c0.baseTileId ?? c0.tileId;
            StudioState.editBrushTransform = c0.transform || 'id';
            StudioState.brushSizeMode = '1';
          } else if (captured.rows === N && captured.cols === N) {
            StudioState.brushSizeMode = 'block';
          } else if (captured.rows === captured.cols && ['2', '3', '4'].includes(String(captured.rows))) {
            StudioState.brushSizeMode = String(captured.rows);
          } else {
            StudioState.brushSizeMode = 'custom';
          }

          StudioState.stampInteractionMode = 'apply';
          renderEditBrushPalette();
          renderSupertileBuilderCanvas();
          syncEditWorkspaceUI();
          saveStudioStateToStorage();
          redraw();
        }
      }
    }

    if (StudioState.isPaintingDrag) {
      StudioState.isPaintingDrag = false;
      StudioState.lastPaintedCellKey = null;
      if (StudioState.pendingEditHistoryPush) {
        StudioState.pendingEditHistoryPush = false;
        pushEditHistorySnapshot();
      }
    }
  });

  // --- Illustrator & Editor Keyboard Shortcuts ---
  window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (e.key === 'Enter') e.target.blur();
      return;
    }
    if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) {
      return;
    }

    // Illustrator Shortcut: X swaps foreground and background colors
    if (e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      const tmp = StudioState.fgColor;
      StudioState.fgColor = StudioState.bgColor;
      StudioState.bgColor = tmp;
      const fgPicker = document.getElementById('fgColorPicker');
      const bgPicker = document.getElementById('bgColorPicker');
      if (fgPicker) fgPicker.value = StudioState.fgColor;
      if (bgPicker) bgPicker.value = StudioState.bgColor;
      renderEditBrushPalette();
      renderSupertileBuilderCanvas();
      flushSaveStudioStateToStorage();
      redraw();
      return;
    }

    // Esc closes Dirty Guard Dialog if open
    const dirtyDialog = document.getElementById('dirtyGuardDialog');
    if (e.key === 'Escape' && dirtyDialog && !dirtyDialog.classList.contains('hidden')) {
      e.preventDefault();
      closeDirtyGuard(false);
      return;
    }

    // Shortcut: ? opens shortcuts help popover
    if (e.key === '?') {
      e.preventDefault();
      window.InfoUI?.showPopover('shortcuts', document.getElementById('btnHelp'));
      return;
    }

    // Undo / Redo Mosaic Edits (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoMosaicEdit();
        return;
      }
      if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redoMosaicEdit();
        return;
      }
      if (k === '1') {
        e.preventDefault();
        resetZoom100();
        return;
      }
      if (k === '0') {
        e.preventDefault();
        fitArtboardToWindow();
        return;
      }
      return;
    }

    if (e.code === 'Space') {
      StudioState.isSpaceDown = true;
      pasteboard?.classList.add('panning');
      e.preventDefault();
      return;
    }

    if (e.key === 'Tab') {
      if (e.target && e.target !== document.body && e.target.id !== 'canvas-stage') {
        return;
      }
      e.preventDefault();
      toggleRightDock();
      return;
    }

    const k = e.key.toLowerCase();
    const isEditTool = StudioState.activeTool === 'paint' ||
      StudioState.activeTool === 'rotate' ||
      StudioState.activeTool === 'stamp' ||
      StudioState.activeTool === 'freeze';

    if (StudioState.activeTool === 'freeze' && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      clearFrozenCells();
      return;
    }

    if (k === 'g') {
      e.preventDefault();
      triggerRandomSeed();
    } else if (k === 'f') {
      if (e.shiftKey) {
        e.preventDefault();
        clearFrozenCells();
      } else {
        setActiveTool('freeze');
      }
    } else if (k === 'v') {
      setActiveTool('inspect');
    } else if (k === 'b') {
      if (e.shiftKey) {
        document.getElementById('toggleGuideBlocks')?.click();
      } else {
        setActiveTool('paint');
      }
    } else if (k === 'r') {
      setActiveTool('rotate');
    } else if (k === 's') {
      setActiveTool('stamp');
    } else if (k === 'c' && StudioState.activeTool === 'stamp') {
      StudioState.stampInteractionMode = 'select';
      syncEditWorkspaceUI();
      redraw();
    } else if (k === 'h') {
      setActiveTool('pan');
    } else if (k === 'z') {
      setActiveTool('zoom');
    } else if (e.key === '[' || e.key === ']') {
      const rotKey = e.key === ']' ? 'r90' : 'r270';
      rotateOrFlipActiveBrush(rotKey);
    } else if (k === 'a') {
      document.getElementById('toggleGuideAxes')?.click();
    } else if (k === 'm') {
      document.getElementById('toggleGuideSubtiles')?.click();
    } else if (k === 'o') {
      document.getElementById('toggleGuideOrbits')?.click();
    } else if (k === '0' || (e.shiftKey && k === ')') || e.code === 'Digit0' || e.code === 'Numpad0') {
      e.preventDefault();
      fitArtboardToWindow();
    } else if ((k === '1' || (e.shiftKey && k === '!') || e.code === 'Digit1' || e.code === 'Numpad1') && !e.altKey) {
      e.preventDefault();
      resetZoom100();
    } else if (isEditTool) {
      const scopeOrder = ['canvas_center', 'orbit_sym', 'block_sym', 'all_blocks', 'single', 'same_tile'];
      let scopeIdx = -1;
      if (e.altKey && ['1', '2', '3', '4', '5', '6'].includes(k)) {
        scopeIdx = parseInt(k, 10) - 1;
      } else if (!e.shiftKey && !e.altKey && ['2', '3', '4', '5', '6'].includes(k)) {
        scopeIdx = parseInt(k, 10) - 1;
      }
      if (scopeIdx >= 0 && scopeOrder[scopeIdx]) {
        e.preventDefault();
        StudioState.editScope = scopeOrder[scopeIdx];
        syncEditWorkspaceUI();
        redraw();
      }
    } else if (e.key === 'ArrowLeft') {
      restoreGenerationHistory(StudioState.historyIndex - 1);
    } else if (e.key === 'ArrowRight') {
      restoreGenerationHistory(StudioState.historyIndex + 1);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      StudioState.isSpaceDown = false;
      if (StudioState.activeTool !== 'pan') {
        pasteboard?.classList.remove('panning');
      }
      redraw();
    }
  });
}

// Expose StudioState and viewport helpers to window for inspection and integration tests
window.StudioState = StudioState;
window.applyPanTransform = applyPanTransform;
window.applyZoomTransform = applyZoomTransform;
window.fitArtboardToWindow = fitArtboardToWindow;
window.setZoomPercent = setZoomPercent;
window.resetZoom100 = resetZoom100;
window.recenterView = recenterView;
window.cycleActiveToolSize = cycleActiveToolSize;

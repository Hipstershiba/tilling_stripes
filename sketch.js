/**
 * sketch.js
 * Main Studio Controller for Tiling Stripes v2 (Phase 1: Generator & Phase 2: D4 Live Mosaic Editor).
 */

const StudioState = {
  // Workspace Context ('generate' | 'edit') & Studio Surface Mode ('mosaic' | 'tiles')
  workspace: 'generate',
  studioMode: 'mosaic',

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

  // Generation mode: choose tiles so ink/background regions continue across edges
  edgeMatch: false,
  // 0 keeps the strictest seam fit; 1 maximises variety of tiles (temperature)
  edgeVariability: 0.3,

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
  previousBrushTileId: 2,
  editBrushTransform: 'id',
  editBrushSearchQuery: '',
  brushSizeMode: '1', // '1' | '2' | '3' | '4' | 'block' | 'custom'
  brushSnapToBlock: false,
  isShiftDown: false,
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

  // Spout output (frames go to tools/spout_bridge.py over WebSocket)
  spoutEnabled: false,
  spoutName: 'Tiling Stripes',

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

// Icons come from the shared registry (core/ui_format.js); keep sizes here in sync
// with the surface that hosts them.
const LOCK_ICON_SVG = window.UiFormat.icon('lock', 16);
const UNLOCK_ICON_SVG = window.UiFormat.icon('unlock', 16);

const SYMMETRY_ICONS_SVG = {
  sync: window.UiFormat.icon('sync', 16),
  mandala_d4: window.UiFormat.icon('mandala', 16),
  kaleidoscope: window.UiFormat.icon('kaleidoscope', 16),
  rotational_c4: window.UiFormat.icon('rotate', 16),
  bilateral_d2: window.UiFormat.icon('bilateral', 16)
};

const EDIT_SCOPE_ICONS = {
  canvas_center: window.UiFormat.icon('scopeCanvas', 14),
  orbit_sym: window.UiFormat.icon('scopeOrbit', 14),
  block_sym: window.UiFormat.icon('scopeBlock', 14),
  all_blocks: window.UiFormat.icon('scopeAll', 14),
  single: window.UiFormat.icon('scopeSingle', 14),
  same_tile: window.UiFormat.icon('scopeSame', 14)
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

const saveStatus = window.SaveStatus || (typeof require === 'function' && require('./core/save_status.js'));
let documentSaveTimestamp = 0;
let deferStudioSave = false;

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
    const text = document.getElementById('persistenceWarningText') || el;
    if (msg && text.textContent !== msg) text.textContent = msg;
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
const MAX_EDIT_HISTORY = 256;
const IDB_MAX_GENERATION_HISTORY = 256;
const IDB_MAX_EDIT_HISTORY = 256;

const baseSaveScheduler = (typeof window !== 'undefined' && window.StatePersistence && typeof window.StatePersistence.createSaveScheduler === 'function')
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

const saveScheduler = {
  ...baseSaveScheduler,
  schedule() { saveStatus.markPending('document'); baseSaveScheduler.schedule(); }
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
  return window.StatePersistence ? window.StatePersistence.getMaxEditHistoryForMosaic(mosaicData) : MAX_EDIT_HISTORY;
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
    edgeMatch: Boolean(StudioState.edgeMatch),
    edgeVariability: StudioState.edgeVariability,

    fgColor: StudioState.fgColor,
    bgColor: StudioState.bgColor,

    seed: StudioState.seed,
    allowedTiles: Array.from(StudioState.allowedTiles),
    spoutName: StudioState.spoutName,

    workspace: StudioState.workspace,
    activeTool: StudioState.activeTool,
    editScope: StudioState.editScope,
    canvasCenterSymmetry: StudioState.canvasCenterSymmetry,
    editBrushTileId: StudioState.editBrushTileId,
    editBrushTransform: StudioState.editBrushTransform,
    brushSizeMode: StudioState.brushSizeMode,
    brushSnapToBlock: StudioState.brushSnapToBlock,
    supertilePattern: StudioState.supertilePattern,
    brushToolSessions: collectBrushToolSessions(),

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
  if (deferStudioSave || !StudioState.mosaicData) return;
  const fullPayload = buildStudioStatePayload(true);
  if (!fullPayload) return;
  documentSaveTimestamp = Math.max(Date.now(), documentSaveTimestamp + 1, (StudioState.loadedTimestamp || 0) + 1);
  fullPayload.timestamp = documentSaveTimestamp;
  const persistence = window.StatePersistence;
  let hasIndexedDB = false;
  try { hasIndexedDB = typeof indexedDB !== 'undefined' && Boolean(indexedDB); } catch (_) {}
  return saveStatus.save('document', fullPayload, {
    local: snapshot => {
      const storage = window.localStorage || localStorage;
      if (persistence?.saveWithQuotaFallback) return persistence.saveWithQuotaFallback(storage, STORAGE_KEY_STUDIO_STATE, snapshot, StudioState.mosaicData);
      storage.setItem(STORAGE_KEY_STUDIO_STATE, JSON.stringify(snapshot));
      return { success: true, mode: 'full' };
    },
    indexed: persistence?.saveToIndexedDB && hasIndexedDB
      ? snapshot => persistence.saveToIndexedDB(persistence.IDB_KEY_CURRENT, snapshot) : null
  });
}

function hydrateStudioStorage(hasSavedState, libraryHydrationPromise, bootDocumentRevision) {
  return libraryHydrationPromise.then(() => {
    if (typeof window !== 'undefined' && window.StatePersistence && typeof indexedDB !== 'undefined') {
      const persistence = window.StatePersistence;
      return persistence.resolveBootState(localStorage, STORAGE_KEY_STUDIO_STATE).then((resolved) => {
        if (saveStatus.snapshot().scopes.find(scope => scope.scope === 'document')?.revision !== bootDocumentRevision) return;
        if (resolved && resolved.source === 'indexeddb' && resolved.payload) {
          const idbState = resolved.payload;
          const idbHistCount = (Array.isArray(idbState.history) ? idbState.history.length : 0) +
            (Array.isArray(idbState.editHistory) ? idbState.editHistory.length : 0);
          const curHistCount = (Array.isArray(StudioState.history) ? StudioState.history.length : 0) +
            (Array.isArray(StudioState.editHistory) ? StudioState.editHistory.length : 0);
          const isNewer = (typeof idbState.timestamp === 'number' && idbState.timestamp > (StudioState.loadedTimestamp || 0));

          if (!hasSavedState || isNewer || idbHistCount > curHistCount) {
            const restored = applySavedStudioState(idbState);
            if (restored) {
              restoreMosaicFromSavedState();
              syncZoomUI();
              updateStatusBar();
              redraw();
            }
          }
        }
      });
    }
    return null;
  }).catch(() => {}).then(() => {
    if (saveStatus.snapshot().scopes.find(scope => scope.scope === 'document')?.revision === bootDocumentRevision) {
      return saveStudioStateToStorage();
    }
  });
}

function renderSaveStatus(state) {
  const status = document.getElementById('saveStatusText');
  if (status && status.textContent !== state.text) status.textContent = state.text;
  if (status) status.dataset.state = state.state;
  const warn = state.failed.length || state.reduced.length;
  if (warn) {
    const reduction = state.scopes.find(scope => scope.state === 'reduced')?.reduction;
    const detail = reduction ? ` ${reduction.history} gerações e ${reduction.editHistory} etapas de edição ficaram fora da cópia salva.` : '';
    showPersistenceWarning([state.details, state.reduced.length ? 'Desenho salvo; histórico reduzido.' + detail : ''].filter(Boolean).join(' '));
  } else if (state.state === 'saved' || state.state === 'idle') hidePersistenceWarning();
  document.getElementById('btnBackupUnsavedLibrary')?.classList.toggle('hidden', !state.failed.includes('library'));
  const mosaicAtRisk = state.failed.includes('document') || state.reduced.includes('document');
  document.getElementById('btnExportUnsavedMosaic')?.classList.toggle('hidden', !mosaicAtRisk);
  document.getElementById('saveImageLimit')?.classList.toggle('hidden', !mosaicAtRisk);
}

function applySavedStudioState(saved) {
  if (!saved || typeof saved !== 'object') return false;

  if (typeof saved.timestamp === 'number') {
    StudioState.loadedTimestamp = saved.timestamp;
  }
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
  if (typeof saved.edgeMatch === 'boolean') StudioState.edgeMatch = saved.edgeMatch;
  if (typeof saved.edgeVariability === 'number' && Number.isFinite(saved.edgeVariability)) {
    StudioState.edgeVariability = Math.max(0, Math.min(1, saved.edgeVariability));
  }

  // Colors
  if (typeof saved.fgColor === 'string') StudioState.fgColor = saved.fgColor;
  if (typeof saved.bgColor === 'string') StudioState.bgColor = saved.bgColor;

  // Seed
  if (typeof saved.seed === 'number') StudioState.seed = saved.seed;

  // Spout sender name (the output itself always starts off)
  if (typeof saved.spoutName === 'string') {
    StudioState.spoutName = window.SpoutOutput
      ? window.SpoutOutput.sanitizeSenderName(saved.spoutName)
      : saved.spoutName;
  }

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
  restoreBrushToolSessions(saved.brushToolSessions);

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
      edgeMatch: Boolean(StudioState.edgeMatch),
      edgeVariability: StudioState.edgeVariability,
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
  StudioState.lastDocumentParams = window.DocumentSnapshot.collectParams(StudioState);
  if (!Array.isArray(StudioState.editHistory) || StudioState.editHistory.length === 0) {
    resetEditHistoryWithInitialSnapshot();
  } else {
    const currentEntry = StudioState.editHistory[StudioState.editHistoryIndex];
    if (currentEntry && !currentEntry.document) {
      window.DocumentSnapshot.attachDocument(currentEntry, StudioState.lastDocumentParams);
    }
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
  cnv.elt.addEventListener('dblclick', (e) => {
    if (StudioState.studioMode === 'tiles' && StudioState.activeTool !== 'pan' && !StudioState.isSpaceDown) {
      e.preventDefault();
      window.SubtileStudioUI?.handleViewportDoubleClick(mouseX, mouseY, StudioState);
    }
  });

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

  // Do not overwrite the durable IDB document with the temporary boot canvas.
  saveStatus.markPending('document');
  deferStudioSave = true;
  try {
    if (hasSavedState && StudioState.savedCellsSnapshot) restoreMosaicFromSavedState();
    else regenerateMosaic(true);
  } finally { deferStudioSave = false; }
  const bootDocumentRevision = saveStatus.snapshot().scopes.find(scope => scope.scope === 'document').revision;

  let knownLibraryVariantKeys = new Set(
    window.LibraryStore && window.LibraryStore.getCompiled()?.variantKeyToId instanceof Map
      ? window.LibraryStore.getCompiled().variantKeyToId.keys()
      : []
  );

  if (window.LibraryStore && typeof window.LibraryStore.onChange === 'function') {
    window.LibraryStore.onChange((evt) => {
      let shouldPersistStudio = false;
      if (window.SubtileStudioUI && typeof window.SubtileStudioUI.syncStudioStateWithLibraryEvent === 'function') {
        const syncRes = window.SubtileStudioUI.syncStudioStateWithLibraryEvent(StudioState, evt, knownLibraryVariantKeys);
        knownLibraryVariantKeys = syncRes.variantKeys;
        shouldPersistStudio = Boolean(syncRes.remapped || syncRes.enrolledTileIds.length > 0);
      } else if (evt && evt.hasRemapChanges) {
        window.LibraryStore.remapStudioState(StudioState, evt.idRemap, evt.maxValidTileId);
        shouldPersistStudio = true;
      }

      buildTileThumbnails();
      renderSwatchesPanel();
      renderEditBrushPalette();
      renderSupertileBuilderCanvas();
      window.SubtileStudioUI?.refresh();
      syncEditWorkspaceUI();
      if (shouldPersistStudio && evt.reason !== 'hydrate-idb') {
        saveStudioStateToStorage();
      }
      redraw();
    });
  }

  let libraryHydrationPromise = Promise.resolve(null);
  try {
    if (window.LibraryStore && typeof indexedDB !== 'undefined') {
      libraryHydrationPromise = window.LibraryStore.hydrateFromIndexedDB().catch(() => null);
    }
  } catch (_) {}
  hydrateStudioStorage(hasSavedState, libraryHydrationPromise, bootDocumentRevision);

  window.addEventListener('beforeunload', () => {
    commitDocumentEdit();
    flushSaveStudioStateToStorage();
  });

  requestAnimationFrame(() => {
    syncZoomUI();
    updateStatusBar();
  });

  noLoop();
}

function isEffectiveBrushSnap() {
  return StudioState.brushSnapToBlock ? !StudioState.isShiftDown : StudioState.isShiftDown;
}

function getEditPreviewState() {
  const isEditTool = StudioState.activeTool === 'paint' ||
    ['rotate','mirror'].includes(StudioState.activeTool) ||
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
      stampBlock: null,
      dragSelectionRect,
      selectionShape: mosaicSelectionShape,
      selectedCells: captureGesture?.baseSelection ? captureGesture.baseSelection.cells.flatMap((row,y)=>row.flatMap((cell,x)=>cell?[{gr:captureGesture.baseSelection.minGlobalRow+y,gc:captureGesture.baseSelection.minGlobalCol+x}]:[])) : [],
      selectionPoints: captureGesture?.points,
      selectionCells: captureGesture ? window.MosaicEngine.getRegionGestureCells(captureGesture) : [],
      hoveredCell: hit
    };
  }

  if (StudioState.activeTool === 'stamp' && mosaicTransferMode === 'move' && mosaicRegion && !StudioState.isSelectingStampDrag) {
    const selectedCells=[],placements=[];
    const {pattern,row,col}=mosaicRegion,m=StudioState.mosaicData,N=m.subtilesPerSide;
    const target=regionMoveGesture?.targetHit;
    const gr=target?target.row*N+target.subRow:row,gc=target?target.col*N+target.subCol:col;
    const valid=target && gr>=0 && gc>=0 && gr+pattern.rows<=m.rows*N && gc+pattern.cols<=m.cols*N;
    for(let y=0;y<pattern.rows;y++) for(let x=0;x<pattern.cols;x++) if(pattern.cells[y][x]) {
      selectedCells.push({gr:row+y,gc:col+x});
      if(valid) {
        const cell=m.grid[Math.floor((row+y)/N)][Math.floor((col+x)/N)].cells[(row+y)%N][(col+x)%N];
        placements.push({...cell,gr:gr+y,gc:gc+x,isAnchor:true});
      }
    }
    return {tool:'stamp',scopeMode:'single',selectedCells,regionPlacements:placements};
  }

  if (StudioState.activeTool === 'stamp' && StudioState.stampInteractionMode === 'select') {
    if (mosaicSelectionShape === 'brush' && hit) {
      const m=StudioState.mosaicData,N=m.subtilesPerSide;
      const preview=window.MosaicEngine.createRegionGesture('brush',m.rows*N,m.cols*N,selectionBrushDiameter);
      window.MosaicEngine.extendRegionGesture(preview,hit.selectionX ?? hit.col*N+hit.subCol+.5,hit.selectionY ?? hit.row*N+hit.subRow+.5);
      return {tool:'stamp',scopeMode:'single',dragSelectionRect:preview,selectionShape:'brush',selectionCells:window.MosaicEngine.getRegionGestureCells(preview)};
    }
    return {
      tool: 'stamp',
      scopeMode: StudioState.editScope,
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry,
      stampBlock: null,
      stampInteractionMode: 'select',
      snapToBlock: isEffectiveBrushSnap(),
      hoveredCell: hit
    };
  }

  if (!hit) {
    return {
      tool: StudioState.activeTool,
      scopeMode: StudioState.editScope,
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry,
      stampBlock: mosaicRegion ? StudioState.stampBlock : null,
      regionPlacements: []
    };
  }

  if (StudioState.activeTool === 'stamp' && !isCloneReady()) {
    return {tool: 'stamp', scopeMode: StudioState.editScope, regionPlacements: []};
  }

  if (['rotate','mirror'].includes(StudioState.activeTool)) {
    const resolved = window.MosaicEngine.resolveRotateRegionPlacements(
      StudioState.mosaicData,
      hit,
      {
        rotateSize: StudioState.rotateSizeMode,
        snapToBlock: StudioState.rotateSnapToBlock,
        rotateGroupMode: StudioState.rotateGroupMode,
        rotateBehavior: StudioState.activeTool==='mirror'?'d4_r90':StudioState.rotateBehavior,
        transformKey: StudioState.activeTool==='mirror'?'mx':undefined,
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
      snapToBlock: isEffectiveBrushSnap(),
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry
    }
  );

  return {
    tool: StudioState.activeTool,
    scopeMode: StudioState.editScope,
    canvasCenterSymmetry: StudioState.canvasCenterSymmetry,
    stampBlock: mosaicRegion ? StudioState.stampBlock : null,
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
  if (StudioState.studioMode === 'tiles' && window.SubtileStudioUI) {
    window.SubtileStudioUI.renderViewport(window, StudioState);
    pop();
    return;
  }
  window.MosaicEngine.renderMosaicToContext(window, StudioState.mosaicData, layoutConfig);
  const isEditTool = (StudioState.workspace === 'edit' && (
    StudioState.activeTool === 'paint' ||
    ['rotate','mirror'].includes(StudioState.activeTool) ||
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

function clampEdgeVariability(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.3;
  return Math.max(0, Math.min(1, numeric));
}

function syncEdgeVariabilityUI() {
  const input = document.getElementById('edgeVariabilityInput');
  const valueEl = document.getElementById('edgeVariabilityValue');
  const control = document.querySelector('.edge-variability-control');
  const pct = Math.round(clampEdgeVariability(StudioState.edgeVariability) * 100);
  if (input) {
    input.value = pct;
    input.disabled = !StudioState.edgeMatch;
  }
  if (valueEl) valueEl.textContent = `${pct}%`;
  if (control) control.classList.toggle('is-disabled', !StudioState.edgeMatch);
}

function setEdgeVariability(value) {
  const next = clampEdgeVariability(value);
  if (Math.abs(next - StudioState.edgeVariability) < 1e-9) return false;
  StudioState.edgeVariability = next;
  if (typeof syncEdgeVariabilityUI === 'function') syncEdgeVariabilityUI();
  regenerateMosaic(true);
  return true;
}

function setEdgeMatchMode(enabled) {
  const next = Boolean(enabled);
  if (StudioState.edgeMatch === next) return false;
  StudioState.edgeMatch = next;
  if (typeof syncEdgeVariabilityUI === 'function') syncEdgeVariabilityUI();
  regenerateMosaic(true);
  return true;
}

function regenerateMosaic(recordHistory = true) {
  mosaicRegion = null;
  regionMoveGesture = null;
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
      edgeMatch: Boolean(StudioState.edgeMatch),
      edgeVariability: StudioState.edgeVariability,
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
      const maxAllowedEdits = window.StatePersistence?.IDB_MAX_EDIT_HISTORY || 256;
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
  mosaicRegion = null;
  regionMoveGesture = null;
  if (!snap || !window.DocumentSnapshot || !window.MosaicEngine) return false;
  const doc = snap.document;
  if (!doc) return false;

  window.DocumentSnapshot.applyParams(StudioState, doc);
  StudioState.canvasRatio = StudioState.width / Math.max(1, StudioState.height);
  StudioState.gridRatio = StudioState.cols / Math.max(1, StudioState.rows);

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
      edgeMatch: Boolean(StudioState.edgeMatch),
      edgeVariability: StudioState.edgeVariability,
      allowedTiles: allowedArray
    },
    (arr) => arr[floor(random(arr.length))],
    frozenMap
  );

  StudioState.frozenCells = frozenMap;
  const ok = window.MosaicEngine.restoreMosaicCellsSnapshot(StudioState.mosaicData, snap, StudioState.frozenCells);

  StudioState.lastDocumentParams = window.DocumentSnapshot.collectParams(StudioState);

  if (typeof syncAllInputsFromState === 'function') syncAllInputsFromState();
  if (typeof applyZoomTransform === 'function') applyZoomTransform();
  if (typeof renderEditBrushPalette === 'function') renderEditBrushPalette();
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

// ============================================================================
// Spout output: browser → tools/spout_bridge.py → SpoutGL (shared texture)
// ============================================================================

let spoutSocket = null;
let spoutTimer = null;
let spoutFrameInfo = null;
let spoutLastSignature = null;

function setSpoutStatus(label, state, detail) {
  const el = document.getElementById('spoutStatus');
  if (!el) return;
  el.textContent = label;
  el.dataset.state = state;
  el.title = detail || label;
}

function syncSpoutUI() {
  const toggle = document.getElementById('spoutToggle');
  if (toggle) toggle.setAttribute('aria-checked', StudioState.spoutEnabled ? 'true' : 'false');
  const nameInput = document.getElementById('spoutName');
  if (nameInput && document.activeElement !== nameInput) {
    nameInput.value = StudioState.spoutName;
  }
  if (!StudioState.spoutEnabled) setSpoutStatus('Desligado', 'off', 'Saída Spout desligada');
}

// ---------------------------------------------------------------------------
// The Spout output renders the artwork, not the screen: no zoom, no guides,
// no hover ghost, no orbit badges. A p5.Graphics buffer at the artboard size
// is drawn with the same engine used by the on-screen canvas.
// ---------------------------------------------------------------------------

let spoutGraphics = null;

function spoutArtSignature() {
  if (!window.SpoutOutput) return 0;
  return window.SpoutOutput.artifactSignature(StudioState.mosaicData, {
    width: StudioState.width,
    height: StudioState.height,
    margin: StudioState.margin,
    paddingRatio: StudioState.paddingRatio,
    fgColor: StudioState.fgColor,
    bgColor: StudioState.bgColor,
    libraryRevision: (window.TileRegistry && window.TileRegistry.libraryRevision) || 0
  });
}

function renderSpoutFrame() {
  if (!StudioState.mosaicData || typeof createGraphics !== 'function' || !window.MosaicEngine) return null;

  const width = Math.max(1, Math.round(StudioState.width));
  const height = Math.max(1, Math.round(StudioState.height));

  if (!spoutGraphics || spoutGraphics.width !== width || spoutGraphics.height !== height) {
    if (spoutGraphics) {
      try { spoutGraphics.remove(); } catch (err) { /* already gone */ }
    }
    spoutGraphics = createGraphics(width, height);
    spoutGraphics.pixelDensity(1);
  }

  const g = spoutGraphics;
  g.push();
  window.MosaicEngine.renderMosaicToContext(g, StudioState.mosaicData, {
    width,
    height,
    margin: StudioState.margin,
    paddingRatio: StudioState.paddingRatio,
    fgColor: StudioState.fgColor,
    bgColor: StudioState.bgColor
  });
  g.pop();
  g.loadPixels();

  // Copy: p5 reuses the buffer on the next render.
  const pixels = new Uint8Array(g.pixels.length);
  pixels.set(g.pixels);
  return { width, height, pixels };
}

function spoutPump() {
  if (!spoutSocket || spoutSocket.readyState !== WebSocket.OPEN) return;
  // Keep at most one frame in flight. Once drained, render the newest artwork.
  if (spoutSocket.bufferedAmount > 0) return;

  // Cheap: only the artwork invalidates the frame. Panning, zooming or toggling guides do not.
  const signature = spoutArtSignature();
  if (spoutFrameInfo && signature === spoutLastSignature) return;

  const frame = renderSpoutFrame();
  if (!frame) {
    setSpoutStatus('sem canvas', 'error', 'Mosaico ainda não gerado');
    return;
  }

  if (!spoutFrameInfo || frame.width !== spoutFrameInfo.width || frame.height !== spoutFrameInfo.height) {
    spoutSocket.send(window.SpoutOutput.buildStartMessage(StudioState.spoutName, frame.width, frame.height));
  }

  spoutSocket.send(frame.pixels);
  spoutFrameInfo = { width: frame.width, height: frame.height };
  spoutLastSignature = signature;
  setSpoutStatus('on', 'on', 'Enviando o mosaico puro para o Spout');
}

let spoutRetryTimer = null;
const SPOUT_RETRY_MS = 3000;

function scheduleSpoutRetry() {
  if (!StudioState.spoutEnabled || spoutRetryTimer) return;
  setSpoutStatus('offline', 'error', 'Ponte offline — rode tools/spout_bridge.cmd');
  spoutRetryTimer = setTimeout(() => {
    spoutRetryTimer = null;
    if (StudioState.spoutEnabled && !spoutSocket) startSpoutOutput();
  }, SPOUT_RETRY_MS);
}

function startSpoutOutput() {
  if (spoutSocket) return;
  const url = window.SpoutOutput ? window.SpoutOutput.SPOUT_WS_URL : 'ws://127.0.0.1:8766';
  try {
    spoutSocket = new WebSocket(url);
  } catch (err) {
    spoutSocket = null;
    scheduleSpoutRetry();
    return;
  }
  spoutSocket.binaryType = 'arraybuffer';
  const socket = spoutSocket;

  spoutSocket.onopen = () => {
    if (spoutSocket !== socket) return;
    if (spoutRetryTimer) { clearTimeout(spoutRetryTimer); spoutRetryTimer = null; }
    spoutFrameInfo = null;
    spoutLastSignature = null;
    if (!spoutTimer) spoutTimer = setInterval(spoutPump, 50);
    spoutPump();
  };

  spoutSocket.onmessage = (ev) => {
    if (spoutSocket !== socket) return;
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'error') setSpoutStatus('erro', 'error', msg.reason || 'Erro na ponte');
      else if (msg.type === 'status' && msg.sender) setSpoutStatus('on', 'on', 'Enviando o canvas para o Spout');
    } catch (err) { /* status messages are best-effort */ }
  };

  spoutSocket.onerror = () => {
    if (spoutSocket !== socket) return;
    // A failed connect fires error and then close; the retry is scheduled in onclose.
    if (spoutRetryTimer) return;
    setSpoutStatus('offline', 'error', 'Ponte offline — rode tools/spout_bridge.cmd');
  };

  spoutSocket.onclose = () => {
    if (spoutSocket !== socket) return;
    if (spoutTimer) { clearInterval(spoutTimer); spoutTimer = null; }
    spoutSocket = null;
    spoutFrameInfo = null;
    if (StudioState.spoutEnabled) {
      scheduleSpoutRetry();   // keep the switch on and keep trying
    } else {
      setSpoutStatus('Desligado', 'off', 'Saída Spout desligada');
    }
  };
}

function stopSpoutOutput() {
  if (spoutRetryTimer) { clearTimeout(spoutRetryTimer); spoutRetryTimer = null; }
  if (spoutTimer) { clearInterval(spoutTimer); spoutTimer = null; }
  if (spoutSocket) {
    const socket = spoutSocket;
    spoutSocket = null;
    try { socket.send(JSON.stringify({ type: 'stop' })); } catch (err) { /* already closing */ }
    socket.close();
  }
  spoutFrameInfo = null;
  spoutLastSignature = null;
  setSpoutStatus('Desligado', 'off', 'Saída Spout desligada');
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
    edgeMatch: Boolean(StudioState.edgeMatch),
    edgeVariability: StudioState.edgeVariability,
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
      Boolean(current.edgeMatch) === Boolean(snapshot.edgeMatch) &&
      Number(current.edgeVariability || 0) === Number(snapshot.edgeVariability || 0) &&
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
    StudioState.edgeMatch = Boolean(snap.edgeMatch);
    StudioState.edgeVariability = clampEdgeVariability(snap.edgeVariability);
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

  const activeRow = listEl.querySelector('.history-item.active');
  if (activeRow) {
    activeRow.scrollIntoView({ block: 'nearest' });
  }
}

// ============================================================================
// Thumbnails & Swatches Panel
// ============================================================================

const thumbnailSignatures = new Map();
function buildTileThumbnails() {
  const renderers = window.TileRegistry.TILE_RENDERERS;
  const size = 64;
  const pad = size * 0.08;

  for (const id of StudioState.thumbnailCache.keys()) {
    if (id >= renderers.length) { StudioState.thumbnailCache.delete(id); thumbnailSignatures.delete(id); }
  }
  for (let id = 0; id < renderers.length; id++) {
    const family = window.TileRegistry.getFamilyForTile(id);
    const doc = family && window.LibraryStore?.getFamilyById(family.id);
    const signature = JSON.stringify([family?.id, family?.tileIds, doc]);
    if (StudioState.thumbnailCache.has(id) && thumbnailSignatures.get(id) === signature) continue;
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
    thumbnailSignatures.set(id, signature);
    gfx.remove();
  }
}

const generatorUiState = {expanded: new Set(), isolation: null};
function sameGeneratorTiles(a, b) { return a.size === b.size && [...a].every(id => b.has(id)); }
function toggleGeneratorIsolation(key, ids) {
  const previous = generatorUiState.isolation;
  if (previous && !sameGeneratorTiles(StudioState.allowedTiles, previous.selected)) generatorUiState.isolation = null;
  const active = generatorUiState.isolation;
  if (active?.key === key) {
    StudioState.allowedTiles = new Set(active.before); generatorUiState.isolation = null;
  } else {
    const selected = new Set(ids);
    generatorUiState.isolation = {key, before: new Set(active?.before || StudioState.allowedTiles), selected};
    StudioState.allowedTiles = new Set(selected);
  }
  renderSwatchesPanel(); regenerateMosaic(true);
}
function renderSwatchesPanel() {
  const container = document.getElementById('familiesSwatchContainer');
  if (!container) return;
  const counterEl = document.getElementById('activeTilesCounter');
  if (counterEl) counterEl.textContent = `${StudioState.allowedTiles.size}/${window.TileRegistry.TILE_RENDERERS.length} peças`;
  if (generatorUiState.isolation && !sameGeneratorTiles(StudioState.allowedTiles, generatorUiState.isolation.selected)) generatorUiState.isolation = null;
  const focusKey = document.activeElement?.dataset?.generatorFocus;
  const query = (StudioState.searchQuery || '').trim().toLowerCase();
  const grouped = window.TileRegistry.getOrderedGroupedFamilies();
  const tileNames = window.TileRegistry.TILE_NAMES;
  container.innerHTML = '';
  function button(text, className, label, key, action) {
    const el = document.createElement('button'); el.type = 'button'; el.className = className;
    el.textContent = text; el.setAttribute('aria-label', label); el.title = label; el.dataset.generatorFocus = key;
    el.addEventListener('click', action); return el;
  }
  function solo(key, ids, label) {
    const active = generatorUiState.isolation?.key === key;
    const el = button(active ? 'Restaurar seleção' : 'Isolar', 'family-solo-btn',
      active ? 'Restaurar a seleção anterior ao isolamento' : `Isolar ${label}`, key + ':solo', () => toggleGeneratorIsolation(key, ids));
    el.setAttribute('aria-pressed', String(active));
    if (window.UiFormat?.icon) el.innerHTML = window.UiFormat.icon(active ? 'reset' : 'eye');
    return el;
  }
  for (const group of grouped) {
    let headingAdded = false;
    for (const fam of group.families) {
      const matching = fam.tileIds.filter(id => !query || fam.name.toLowerCase().includes(query) || group.name.toLowerCase().includes(query) ||
        (tileNames[id] || '').toLowerCase().includes(query) || `#${id}` === query);
      if (!matching.length) continue;
      if (!headingAdded) {
        headingAdded = true;
        const heading = document.createElement('div'); heading.className = 'swatches-group-heading';
        const ids = [...new Set(group.families.flatMap(f => f.tileIds))];
        const count = ids.filter(id => StudioState.allowedTiles.has(id)).length;
        const toggle = button(group.name, 'swatches-group-toggle', `Conjunto ${group.name}: ${count} de ${ids.length} peças; inclui as ocultas pela busca`, group.id + ':toggle', () => {
          ids.forEach(id => count === ids.length ? StudioState.allowedTiles.delete(id) : StudioState.allowedTiles.add(id));
          renderSwatchesPanel(); regenerateMosaic(true);
        });
        toggle.setAttribute('role', 'checkbox'); toggle.setAttribute('aria-checked', count === ids.length ? 'true' : count ? 'mixed' : 'false');
        const indicator = document.createElement('span'); indicator.className = 'family-check-indicator'; indicator.setAttribute('aria-hidden', 'true');
        indicator.textContent = count === ids.length ? '✓' : count ? '–' : ''; toggle.prepend(indicator);
        heading.appendChild(toggle); heading.appendChild(solo('group:' + group.id, ids, `conjunto ${group.name}`)); container.appendChild(heading);
      }
      const selected = fam.tileIds.filter(id => StudioState.allowedTiles.has(id)).length;
      const all = selected === fam.tileIds.length;
      const card = document.createElement('div'); card.className = 'family-swatch-card ' + (all ? 'family-all' : selected ? 'family-partial' : 'family-none');
      const header = document.createElement('div'); header.className = 'family-card-header';
      const preview = document.createElement('img'); preview.className = 'generator-family-preview'; preview.alt = ''; preview.src = StudioState.thumbnailCache.get(fam.tileIds[0]) || ''; header.appendChild(preview);
      const toggle = button(fam.name, 'family-toggle-btn', `${fam.name}: ${selected} de ${fam.tileIds.length} variantes permitidas`, fam.id + ':toggle', () => {
        fam.tileIds.forEach(id => all ? StudioState.allowedTiles.delete(id) : StudioState.allowedTiles.add(id)); renderSwatchesPanel(); regenerateMosaic(true);
      });
      toggle.setAttribute('role', 'checkbox'); toggle.setAttribute('aria-checked', all ? 'true' : selected ? 'mixed' : 'false');
      const mark = document.createElement('span'); mark.className = 'family-check-indicator'; mark.setAttribute('aria-hidden', 'true'); mark.textContent = all ? '✓' : selected ? '–' : ''; toggle.prepend(mark);
      header.appendChild(toggle);
      const count = document.createElement('span'); count.className = 'family-count-tag'; count.textContent = `${selected}/${fam.tileIds.length}`; header.appendChild(count);
      const open = Boolean(query) || generatorUiState.expanded.has(fam.id);
      const disclosure = button(open ? '⌃' : '⌄', 'generator-family-expand', `Variantes de ${fam.name}`, fam.id + ':expand', () => {
        if (generatorUiState.expanded.has(fam.id)) generatorUiState.expanded.delete(fam.id); else generatorUiState.expanded.add(fam.id);
        renderSwatchesPanel();
      });
      disclosure.hidden = Boolean(query);
      disclosure.setAttribute('aria-expanded', String(open)); disclosure.setAttribute('aria-controls', `generatorVariants-${fam.id}`); header.appendChild(disclosure); card.appendChild(header);
      const details = document.createElement('div'); details.id = `generatorVariants-${fam.id}`; details.className = 'generator-variants'; details.hidden = !open;
      const actions = document.createElement('div'); actions.className = 'generator-family-actions';
      actions.appendChild(solo('family:' + fam.id, fam.tileIds, `família ${fam.name}`));
      actions.appendChild(button('Editar peça', 'family-solo-btn', `Abrir ${fam.name} no editor de peças`, fam.id + ':edit', () => window.SubtileStudioUI?.openTilesStudio(fam.id)));
      details.appendChild(actions);
      const grid = document.createElement('div'); grid.className = 'family-tiles-grid';
      for (const id of matching) {
        const active = StudioState.allowedTiles.has(id);
        const swatch = button('', 'tile-swatch-btn' + (active ? ' selected' : ''), `#${id}: ${tileNames[id]}`, 'tile:' + id, () => {
          if (StudioState.allowedTiles.has(id)) StudioState.allowedTiles.delete(id); else StudioState.allowedTiles.add(id);
          renderSwatchesPanel(); regenerateMosaic(true);
        });
        swatch.setAttribute('role', 'checkbox'); swatch.setAttribute('aria-checked', String(active));
        const img = document.createElement('img'); img.src = StudioState.thumbnailCache.get(id) || ''; img.alt = '';
        const badge = document.createElement('span'); badge.className = 'tile-swatch-id'; badge.textContent = id;
        swatch.appendChild(img); swatch.appendChild(badge); grid.appendChild(swatch);
      }
      details.appendChild(grid); card.appendChild(details); container.appendChild(card);
    }
  }
  if (focusKey) [...container.querySelectorAll('[data-generator-focus]')].find(el => el.dataset.generatorFocus === focusKey)?.focus({preventScroll: true});
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
      btn.title = m.name;
      btn.setAttribute('aria-label', m.name);
      btn.innerHTML = `
        <div class="sym-card-icon">${SYMMETRY_ICONS_SVG[m.id] || ''}</div>
        <div class="sym-card-text">
          <span class="sym-card-title">${m.name}</span>
        </div>
      `;
      btn.addEventListener('click', () => {
        if (StudioState.gridSymmetryMode === m.id) return;
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
        title: 'Igual à composição',
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
      btn.title = opt.title;
      btn.setAttribute('aria-label', opt.title);
      btn.innerHTML = `
        <div class="block-sym-pill-icon">${opt.icon || ''}</div>
        <div class="block-sym-pill-text">
          <span class="block-sym-pill-title">${opt.title}</span>
        </div>
      `;
      btn.addEventListener('click', () => {
        if (opt.key === 'sync' ? StudioState.syncBlockSymmetry :
          !StudioState.syncBlockSymmetry && StudioState.blockSymmetryMode === opt.key) return;
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
    card.setAttribute('aria-pressed', String(card.dataset.mode === StudioState.gridSymmetryMode));
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
    pill.setAttribute('aria-pressed', String(pill.dataset.blockMode === selectedPillKey));
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
    subSummary.textContent = `Bloco com ${n}×${n} peças`;
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

  return { row, col, subRow, subCol, selectionX: (lx-m)/blockW*N, selectionY: (ly-m)/blockH*N };
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
  if (window.WorkspaceNavigation?.isLibraryOpen() || window.LibraryExport?.isOpen()) return;
  if (StudioState.studioMode === 'tiles') {
    window.SubtileStudioUI?.handleViewportMouseMoved(mouseX, mouseY, StudioState);
    return;
  }
  const hit = getCanvasHitCell(mouseX, mouseY);
  const prev = StudioState.hoveredCell;
  const changed = (!prev && hit) || (prev && !hit) ||
    (prev && hit && (prev.row !== hit.row || prev.col !== hit.col || prev.subRow !== hit.subRow || prev.subCol !== hit.subCol));

  if (changed) {
    StudioState.hoveredCell = hit;
    updateHoverStatusText();
    const isEditTool = StudioState.activeTool === 'paint' ||
      ['rotate','mirror'].includes(StudioState.activeTool) ||
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
      rotateBehavior: StudioState.activeTool==='mirror'?'d4_r90':StudioState.rotateBehavior,
        transformKey: StudioState.activeTool==='mirror'?(step<0?'my':'mx'):undefined,
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

// Region transfer is transactional: clear only after validating the complete destination.
let mosaicRegion = null;
let mosaicTransferMode = 'stamp';
let mosaicSelectionShape = 'rect';
let captureGesture = null;
let selectionBrushDiameter = 1;
let regionMoveGesture = null;
function moveMosaicRegion(hit) {
  if (!mosaicRegion || !StudioState.mosaicData) return false;
  const m = StudioState.mosaicData, N = m.subtilesPerSide;
  const r = hit.row * N + hit.subRow, c = hit.col * N + hit.subCol;
  const {pattern, row, col} = mosaicRegion;
  if (r < 0 || c < 0 || r + pattern.rows > m.rows * N || c + pattern.cols > m.cols * N) return false;
  if (r === row && c === col) return false;
  const cell = (gr,gc) => m.grid[Math.floor(gr/N)][Math.floor(gc/N)].cells[gr%N][gc%N];
  const key = (gr,gc) => `${Math.floor(gr/N)},${Math.floor(gc/N)},${gr%N},${gc%N}`;
  const frozen = [];
  for (let y=0;y<pattern.rows;y++) for(let x=0;x<pattern.cols;x++) if(pattern.cells[y][x]) {
    frozen.push([y,x,StudioState.frozenCells?.get(key(row+y,col+x)), {...cell(row+y,col+x)}]);
    StudioState.frozenCells?.delete(key(row+y,col+x));
    Object.assign(cell(row+y,col+x), {baseTileId:84,tileId:84,transform:'id'});
  }
  for (const [y,x,preserved,contents] of frozen) {
    Object.assign(cell(r+y,c+x), contents);
    StudioState.frozenCells?.delete(key(r+y,c+x));
    if (preserved !== undefined) StudioState.frozenCells.set(key(r+y,c+x),preserved);
  }
  const movedPattern=JSON.parse(JSON.stringify(pattern));
  for (const [y,x,,contents] of frozen) movedPattern.cells[y][x]={...contents};
  Object.assign(movedPattern,{minGlobalRow:r,minGlobalCol:c,maxGlobalRow:r+pattern.rows-1,maxGlobalCol:c+pattern.cols-1});
  StudioState.supertilePattern=movedPattern;
  StudioState.stampBlock=movedPattern;
  mosaicRegion = {pattern:JSON.parse(JSON.stringify(movedPattern)),row:r,col:c};
  syncD4Badge(); syncFreezeUI();
  return true;
}

function regionContainsHit(hit) {
  if (!hit || !mosaicRegion || !StudioState.mosaicData) return false;
  const N=StudioState.mosaicData.subtilesPerSide;
  return Boolean(mosaicRegion.pattern.cells[hit.row*N+hit.subRow-mosaicRegion.row]?.[hit.col*N+hit.subCol-mosaicRegion.col]);
}
function regionTargetHit(row,col) {
  const N=StudioState.mosaicData.subtilesPerSide;
  return {row:Math.floor(row/N),col:Math.floor(col/N),subRow:row%N,subCol:col%N};
}
function beginRegionInteraction(hit, additive=false) {
  if (additive || StudioState.stampInteractionMode === 'select' || !regionContainsHit(hit)) { startCanvasRegionCaptureDrag(hit,additive); return; }
  const N=StudioState.mosaicData.subtilesPerSide;
  regionMoveGesture={startRow:hit.row*N+hit.subRow,startCol:hit.col*N+hit.subCol,
    targetHit:regionTargetHit(mosaicRegion.row,mosaicRegion.col)};
  StudioState.stampInteractionMode='apply';
  syncCanvasCursor(); redraw();
}
function updateRegionMove(hit) {
  if (!regionMoveGesture) return;
  if (!hit) { regionMoveGesture.targetHit=null; return; }
  const N=StudioState.mosaicData.subtilesPerSide;
  regionMoveGesture.targetHit=regionTargetHit(mosaicRegion.row+hit.row*N+hit.subRow-regionMoveGesture.startRow,
    mosaicRegion.col+hit.col*N+hit.subCol-regionMoveGesture.startCol);
}
function finishRegionMove() {
  const gesture=regionMoveGesture;
  regionMoveGesture=null;
  if (!gesture?.targetHit) return false;
  const changed=moveMosaicRegion(gesture.targetHit);
  if (changed) pushEditHistorySnapshot();
  syncEditWorkspaceUI(); redraw();
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
      snapToBlock: isEffectiveBrushSnap(),
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
  recordBrushEditorUndo();
  const pat = ensureSupertilePattern();
  StudioState.supertilePattern = window.MosaicEngine.transformClonePattern(pat, d4Key);
  StudioState.stampBlock = StudioState.supertilePattern;
  StudioState.editBrushTransform = window.D4Symmetry.composeD4(d4Key, StudioState.editBrushTransform || 'id');
  renderSupertileBuilderCanvas();
  syncEditWorkspaceUI();
  window.SubtileStudioUI?.syncNavigationState?.();
  saveStudioStateToStorage();
  redraw();
}

// Keep painter and clone patterns independent when switching tools.
const brushToolSessions = new Map();
let brushPatternOwner = null;
let cloneReady = null;
let captureOriginHit = null;
let brushEditorPortal = null;
function isCloneReady() {
  if (cloneReady === null) cloneReady = Number.isInteger(StudioState.supertilePattern?.minGlobalRow);
  return cloneReady;
}
function cancelToolGesture() {
  const wasCapturing = StudioState.isSelectingStampDrag || (StudioState.activeTool === 'stamp' && StudioState.stampInteractionMode === 'select');
  if (StudioState.pendingEditHistoryPush) {
    StudioState.pendingEditHistoryPush = false;
    pushEditHistorySnapshot();
  }
  StudioState.isSelectingStampDrag = false;
  regionMoveGesture = null;
  captureGesture = null;
  StudioState.isPaintingDrag = false;
  StudioState.isFreezingDrag = false;
  StudioState.isPaintingMiniBuilder = false;
  StudioState.lastPaintedCellKey = null;
  StudioState.lastFrozenCellKey = null;
  captureOriginHit = null;
  if (wasCapturing && isCloneReady()) StudioState.stampInteractionMode = 'apply';
}
function syncCanvasCursor() {
  let mode = StudioState.activeTool;
  if (StudioState.isPanning) mode = 'grabbing';
  else if (StudioState.isSpaceDown || mode === 'pan') mode = 'grab';
  else if (mode === 'zoom') mode = StudioState.isAltDown ? 'zoom-out' : 'zoom-in';
  else if (StudioState.studioMode === 'tiles') mode = 'vector';
  else if (StudioState.isSelectingStampDrag ||
    ((mode === 'paint' || mode === 'stamp') && StudioState.isAltDown)) mode = 'capture';
  else if (mode === 'stamp' && mosaicTransferMode === 'move') mode = !StudioState.isShiftDown && regionContainsHit(StudioState.hoveredCell) ? 'move' : 'capture';
  else if (mode === 'stamp') mode = StudioState.stampInteractionMode === 'select' ? 'capture' : isCloneReady() ? 'clone' : 'unavailable';
  else if (mode === 'paint' && StudioState.editBrushTileId === 84) mode = 'erase';
  if (StudioState.editScope === 'same_tile' && ['paint','erase','clone','rotate'].includes(mode)) {
    const pattern = StudioState.supertilePattern;
    const multi = mode === 'rotate' ? getToolSizeInfo('rotate').dim > 1
      : pattern && (pattern.rows > 1 || pattern.cols > 1);
    if (multi) mode = 'unavailable';
  }
  document.body.dataset.cursorMode = mode;
}
function initializeBrushPatternOwner() {
  if (!brushPatternOwner) brushPatternOwner = StudioState.activeTool === 'stamp' ||
    Number.isInteger(StudioState.supertilePattern?.minGlobalRow) ? 'stamp' : 'paint';
}
function currentBrushSession() {
  return {
    pattern: JSON.parse(JSON.stringify(ensureSupertilePattern())),
    tileId: StudioState.editBrushTileId, transform: StudioState.editBrushTransform,
    size: StudioState.brushSizeMode, snap: StudioState.brushSnapToBlock,
    stampMode: StudioState.stampInteractionMode, cloneReady: isCloneReady()
  };
}
function isEraserPattern() {
  const pattern = StudioState.supertilePattern;
  return brushPatternOwner === 'paint' && StudioState.editBrushTileId === 84 &&
    pattern?.cells?.every(row => row.every(cell => !cell || cell.baseTileId === 84));
}
function rememberBrushSession() {
  // Erasing is temporary; never replace the last non-empty painter with it.
  if (!isEraserPattern() || brushEditorPortal) brushToolSessions.set(brushPatternOwner, currentBrushSession());
}
function collectBrushToolSessions() {
  initializeBrushPatternOwner();
  rememberBrushSession();
  return {owner: brushPatternOwner, paint: brushToolSessions.get('paint'), stamp: brushToolSessions.get('stamp')};
}
function restoreBrushToolSessions(saved) {
  brushToolSessions.clear();
  brushPatternOwner = null;
  cloneReady = null;
  if (!saved || typeof saved !== 'object') return;
  const total = window.TileRegistry.TILE_RENDERERS.length;
  for (const tool of ['paint','stamp']) {
    const session = saved[tool], pattern = session?.pattern;
    if (!pattern || !Number.isInteger(pattern.rows) || !Number.isInteger(pattern.cols) ||
        pattern.rows < 1 || pattern.cols < 1 || !Array.isArray(pattern.cells) ||
        pattern.cells.length !== pattern.rows || !pattern.cells.every(row =>
          Array.isArray(row) && row.length === pattern.cols && row.every(cell =>
            (cell === null || (cell && Number.isInteger(cell.baseTileId) && cell.baseTileId >= 0 && cell.baseTileId < total &&
            window.D4Symmetry.D4_METADATA[cell.transform || 'id']))))) continue;
    const safe = JSON.parse(JSON.stringify(session));
    safe.tileId = Number.isInteger(safe.tileId) && safe.tileId >= 0 && safe.tileId < total ? safe.tileId : 2;
    safe.transform = window.D4Symmetry.D4_METADATA[safe.transform] ? safe.transform : 'id';
    brushToolSessions.set(tool, safe);
  }
  if (saved.owner === 'paint' || saved.owner === 'stamp') brushPatternOwner = saved.owner;
  if (brushPatternOwner === 'stamp') {
    cloneReady = Boolean(brushToolSessions.get('stamp')?.cloneReady);
    if (!cloneReady && StudioState.activeTool === 'stamp') StudioState.stampInteractionMode = 'select';
  }
}

function activateStudioTool(tool, restorePaint = true) {
  if (!['inspect','paint','rotate','mirror','stamp','freeze','pan','zoom'].includes(tool)) return;
  const previousTool = StudioState.activeTool;
  if (previousTool !== tool || (tool === 'paint' && restorePaint && isEraserPattern())) {
    cancelToolGesture();
    StudioState.isPanning = false;
    document.body.classList.remove('is-panning');
  }
  initializeBrushPatternOwner();
  if ((tool === 'paint' || tool === 'stamp') &&
      (brushPatternOwner !== tool || (tool === 'paint' && restorePaint && isEraserPattern()))) {
    rememberBrushSession();
    const session = brushToolSessions.get(tool);
    if (session) {
      StudioState.supertilePattern = JSON.parse(JSON.stringify(session.pattern));
      StudioState.stampBlock = StudioState.supertilePattern;
      StudioState.editBrushTileId = session.tileId;
      StudioState.editBrushTransform = session.transform;
      StudioState.brushSizeMode = session.size;
      StudioState.brushSnapToBlock = session.snap;
      if (tool === 'stamp') {
        cloneReady = session.cloneReady;
        StudioState.stampInteractionMode = cloneReady ? 'apply' : 'select';
      }
    } else if (tool === 'stamp') {
      cloneReady = false;
      StudioState.stampInteractionMode = 'select';
    } else {
      // Legacy saves had no independent painter snapshot. Restore a normal brush
      // and retain the captured artwork in the clone session for later use.
      StudioState.editBrushTileId = 2;
      StudioState.editBrushTransform = 'id';
      StudioState.brushSizeMode = '1';
      StudioState.brushSnapToBlock = false;
      StudioState.supertilePattern = window.MosaicEngine.createSupertilePattern(1, 1, 2, 'id');
      StudioState.stampBlock = StudioState.supertilePattern;
    }
    brushPatternOwner = tool;
  }

  saveScheduler.flush();
  StudioState.activeTool = tool;
  if (tool === 'stamp' && !isCloneReady()) StudioState.stampInteractionMode = 'select';
  if (['paint','rotate','mirror','stamp','freeze'].includes(tool)) StudioState.workspace = 'edit';
  else if (tool === 'inspect') StudioState.workspace = 'generate';
  document.getElementById('artboard-pasteboard')?.classList.toggle('panning', tool === 'pan' || StudioState.isSpaceDown);
  renderSupertileBuilderCanvas();
  renderEditBrushPalette();
  syncEditWorkspaceUI();
  saveStudioStateToStorage();
  redraw();
}
function activateEraser() {
  if (brushEditorPortal) { selectBrushTile(84); return; }
  cancelToolGesture();
  activateStudioTool('paint', false);
  if (!isEraserPattern()) {
    rememberBrushSession();
    StudioState.previousBrushTileId = StudioState.editBrushTileId;
    const pattern = ensureSupertilePattern();
    StudioState.editBrushTileId = 84;
    StudioState.editBrushTransform = 'id';
    StudioState.supertilePattern = window.MosaicEngine.createSupertilePattern(pattern.rows, pattern.cols, 84, 'id');
    StudioState.stampBlock = StudioState.supertilePattern;
  }
  syncEditWorkspaceUI();
  renderSupertileBuilderCanvas();
  renderEditBrushPalette();
  saveStudioStateToStorage();
  showEditorToast('Borracha · pinte para apagar. B restaura o pincel; S restaura o carimbo.');
  redraw();
}

function syncSelectionControls() {
  // The selection summary lives in the top control bar, beside the brush size.
  // Nothing moves between the dock and the canvas anymore.
}

function activateCloneTool() {
  cancelToolGesture();
  mosaicTransferMode = 'stamp';
  activateStudioTool('stamp');
}

function activateRegionSelection(shape) {
  if (!['rect','brush'].includes(shape)) return;
  mosaicSelectionShape = shape;
  mosaicTransferMode = 'move';
  beginCloneCapture();
}

function beginCloneCapture() {
  closeBrushEditor();
  activateStudioTool('stamp');
  cancelToolGesture();
  StudioState.stampInteractionMode = 'select';
  syncEditWorkspaceUI();

  redraw();
}
function cancelCloneCapture() {
  regionMoveGesture = null;
  StudioState.isSelectingStampDrag = false;
  captureGesture = null;
  captureOriginHit = null;
  StudioState.stampInteractionMode = 'apply';
  syncEditWorkspaceUI();
  redraw();
}
function restoreBrushEditorSnapshot(snapshot) {
  StudioState.supertilePattern = JSON.parse(JSON.stringify(snapshot.pattern));
  StudioState.stampBlock = StudioState.supertilePattern;
  StudioState.editBrushTileId = snapshot.tileId;
  StudioState.editBrushTransform = snapshot.transform;
  StudioState.brushSizeMode = snapshot.size;
  StudioState.brushSnapToBlock = snapshot.snap;
  if (StudioState.activeTool === 'stamp') { cloneReady = snapshot.cloneReady; StudioState.stampInteractionMode = snapshot.stampMode; }
  renderEditBrushPalette();
  renderSupertileBuilderCanvas();
  syncEditWorkspaceUI();
  saveStudioStateToStorage();
  redraw();
}
function recordBrushEditorUndo() {
  if (!brushEditorPortal) return;
  const snapshot = currentBrushSession();
  const previous = brushEditorPortal.undo[brushEditorPortal.undo.length - 1];
  if (!previous || JSON.stringify(previous) !== JSON.stringify(snapshot)) brushEditorPortal.undo.push(snapshot);
  if (brushEditorPortal.undo.length > 256) brushEditorPortal.undo.shift();
  brushEditorPortal.redo.length = 0;
}
function stepBrushEditorHistory(direction) {
  if (!brushEditorPortal) return false;
  const from = direction < 0 ? brushEditorPortal.undo : brushEditorPortal.redo;
  const to = direction < 0 ? brushEditorPortal.redo : brushEditorPortal.undo;
  if (!from.length) return false;
  to.push(currentBrushSession());
  restoreBrushEditorSnapshot(from.pop());
  return true;
}
function resizeBrushEditorGrid(rows, cols) {
  if (!brushEditorPortal) return;
  const max = getToolSizeInfo().max;
  rows = Math.max(1, Math.min(max, Math.round(Number(rows) || 1)));
  cols = Math.max(1, Math.min(max, Math.round(Number(cols) || 1)));
  const pattern = ensureSupertilePattern();
  if (rows === pattern.rows && cols === pattern.cols) return;
  recordBrushEditorUndo();
  StudioState.supertilePattern = window.MosaicEngine.resizeSupertilePattern(pattern, rows, cols, 84, 'id');
  StudioState.stampBlock = StudioState.supertilePattern;
  StudioState.brushSizeMode = rows === cols ? String(rows) : 'custom';
  document.getElementById('brushEditorRows').value = rows;
  document.getElementById('brushEditorCols').value = cols;
  renderSupertileBuilderCanvas(); syncEditWorkspaceUI(); saveStudioStateToStorage(); redraw();
}
function clearBrushEditorPattern() {
  if (!brushEditorPortal) return;
  recordBrushEditorUndo();
  const pattern = ensureSupertilePattern();
  StudioState.supertilePattern = window.MosaicEngine.createSupertilePattern(pattern.rows, pattern.cols, 84, 'id');
  StudioState.stampBlock = StudioState.supertilePattern;
  renderSupertileBuilderCanvas(); syncEditWorkspaceUI(); saveStudioStateToStorage(); redraw();
}
function syncBrushEditorUI() {
  if (!brushEditorPortal) return;
  const pattern = ensureSupertilePattern();
  const rows = document.getElementById('brushEditorRows'), cols = document.getElementById('brushEditorCols');
  if (rows && document.activeElement !== rows) rows.value = pattern.rows;
  if (cols && document.activeElement !== cols) cols.value = pattern.cols;
  if (rows) rows.max = getToolSizeInfo().max;
  if (cols) cols.max = getToolSizeInfo().max;
  const undo = document.getElementById('btnBrushEditorUndo'), redo = document.getElementById('btnBrushEditorRedo');
  if (undo) undo.disabled = !brushEditorPortal.undo.length;
  if (redo) redo.disabled = !brushEditorPortal.redo.length;
  const ink = document.getElementById('brushEditorInkLabel');
  if (ink) ink.textContent = StudioState.editBrushTileId === 84 ? 'Borracha'
    : `#${StudioState.editBrushTileId} · ${window.TileRegistry.TILE_NAMES[StudioState.editBrushTileId] || ''}`;
}

function openBrushEditor() {
  if (brushEditorPortal || StudioState.studioMode === 'tiles') return;
  const dialog = document.getElementById('brushEditorDialog');
  const body = document.getElementById('panelEditBrushBody');
  const host = document.getElementById('brushEditorHost');
  const canvas = document.getElementById('supertileBuilderCanvas');
  const size = document.getElementById('brushSizeControl');
  if (!dialog || !body || !host || !canvas) return;
  if (StudioState.activeTool !== 'paint' && StudioState.activeTool !== 'stamp') activateStudioTool('paint');
  cancelToolGesture();
  brushEditorPortal = {parent: body.parentNode, next: body.nextSibling, body, canvas,
    width: canvas.width, height: canvas.height, focus: document.activeElement, inert: [],
    wasHidden: body.classList.contains('hidden'),
    size, sizeParent: size?.parentNode, sizeNext: size?.nextSibling,
    original: currentBrushSession(), undo: [], redo: []};
  body.classList.remove('hidden');
  host.appendChild(body);
  if (size && size.parentNode && body.insertBefore) body.insertBefore(size, body.firstChild);
  canvas.width = canvas.height = 576;
  dialog.classList.remove('hidden');
  window.StudioModal.enter(dialog, () => closeBrushEditor(false));
  renderSupertileBuilderCanvas();
  syncBrushEditorUI();
  document.getElementById('btnCloseBrushEditor')?.focus();
}
function closeBrushEditor(commit = true) {
  if (!brushEditorPortal) return;
  const portal = brushEditorPortal;
  brushEditorPortal = null;
  StudioState.isPaintingMiniBuilder = false;
  portal.parent.insertBefore(portal.body, portal.next);
  if (portal.wasHidden) portal.body.classList.add('hidden');
  if (portal.size && portal.sizeParent) portal.sizeParent.insertBefore(portal.size, portal.sizeNext);
  portal.canvas.width = portal.width;
  portal.canvas.height = portal.height;
  document.getElementById('brushEditorDialog')?.classList.add('hidden');
  window.StudioModal.leave(document.getElementById('brushEditorDialog'));
  if (!commit) restoreBrushEditorSnapshot(portal.original);
  renderSupertileBuilderCanvas();
  if (portal.focus?.isConnected) portal.focus.focus();
}

function selectBrushTile(tileId) {
  if (isEraserPattern() && !brushEditorPortal) cancelToolGesture();
  if (StudioState.activeTool !== 'paint' && StudioState.activeTool !== 'stamp') activateStudioTool('paint');
  StudioState.editBrushTileId = tileId;
  StudioState.editBrushTransform = 'id';
  const pat = ensureSupertilePattern();
  // A swatch chooses ink for the builder. Only a 1×1 brush is replaced directly;
  // larger patterns are edited cell by cell, in both painter and clone tools.
  if (!brushEditorPortal && pat.rows === 1 && pat.cols === 1) {
    StudioState.supertilePattern = window.MosaicEngine.createSupertilePattern(1, 1, tileId, 'id');
    StudioState.stampBlock = StudioState.supertilePattern;
  }
  if (StudioState.activeTool === 'stamp' && isCloneReady()) {
    StudioState.stampInteractionMode = 'apply';
  }
  renderEditBrushPalette();
  renderSupertileBuilderCanvas();
  syncEditWorkspaceUI();
  saveStudioStateToStorage();
  redraw();
}

function setBrushSizeMode(sizeMode, preserveSnap = false) {
  recordBrushEditorUndo();
  StudioState.brushSizeMode = String(sizeMode);
  const N = StudioState.mosaicData ? StudioState.mosaicData.subtilesPerSide : 4;
  let targetDim = 1;
  if (sizeMode === 'block') {
    targetDim = N;
    StudioState.brushSnapToBlock = true;
  } else {
    targetDim = Math.max(1, parseInt(sizeMode, 10) || 1);
    if (!preserveSnap) {
      StudioState.brushSnapToBlock = false;
    }
  }

  StudioState.supertilePattern = window.MosaicEngine.resizeSupertilePattern(
    StudioState.supertilePattern,
    targetDim,
    targetDim,
    brushEditorPortal ? 84 : StudioState.editBrushTileId,
    brushEditorPortal ? 'id' : (StudioState.editBrushTransform || 'id')
  );
  StudioState.stampBlock = StudioState.supertilePattern;
  renderSupertileBuilderCanvas();
  syncEditWorkspaceUI();
  saveStudioStateToStorage();
  redraw();
}

/**
 * Cycles or steps active tool size.
 * Brush sizing: non-cyclic integer scaling up to canvas dimension.
 * When Snap to Block is active, steps in whole blocks (step = N).
 * When Snap to Block is inactive, steps in single subtiles (step = 1).
 */
function getToolSizeInfo(tool = StudioState.activeTool) {
  const N = StudioState.mosaicData ? StudioState.mosaicData.subtilesPerSide : 4;
  const canvasMax = StudioState.mosaicData
    ? Math.max(StudioState.mosaicData.rows * N, StudioState.mosaicData.cols * N) : 64;
  const mode = tool === 'rotate' ? StudioState.rotateSizeMode
    : tool === 'freeze' ? StudioState.freezeSize : StudioState.brushSizeMode;
  const custom = mode === 'custom' && StudioState.supertilePattern;
  const dim = mode === 'block' ? N : custom
    ? Math.max(custom.rows, custom.cols) : Math.max(1, parseInt(mode, 10) || 1);
  const blockStep = (tool === 'paint' || tool === 'stamp') && StudioState.brushSnapToBlock;
  const step = blockStep ? N : 1;
  return { dim, step, min: step, max: tool === 'freeze' ? N : canvasMax, N };
}

function setAreaToolSize(tool, mode) {
  const info = getToolSizeInfo(tool);
  const value = mode === 'block' ? 'block'
    : String(Math.max(1, Math.min(info.max, parseInt(mode, 10) || 1)));
  if (tool === 'freeze') StudioState.freezeSize = value;
  else {
    StudioState.rotateSizeMode = value;
    StudioState.rotateSnapToBlock = value === 'block';
  }
  syncEditWorkspaceUI();
  saveStudioStateToStorage();
  redraw();
}

let wheelDeltaAccumulator = 0;
let wheelSizeContext = '';
let lastSizeWheelTime = 0;
function stepToolSizeFromWheel(e) {
  const context = `${StudioState.activeTool}:${StudioState.brushSnapToBlock}:${Boolean(brushEditorPortal)}`;
  const now = e.timeStamp || Date.now();
  const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  if (!delta) return false;
  if (context !== wheelSizeContext || now - lastSizeWheelTime > 180 ||
      Math.sign(delta) !== Math.sign(wheelDeltaAccumulator)) wheelDeltaAccumulator = 0;
  wheelSizeContext = context;
  lastSizeWheelTime = now;
  wheelDeltaAccumulator += delta;
  if (Math.abs(wheelDeltaAccumulator) < 45) return false;
  const direction = wheelDeltaAccumulator < 0 ? 1 : -1;
  wheelDeltaAccumulator = 0;
  return cycleActiveToolSize(direction);
}

function cycleActiveToolSize(direction) {
  direction = Math.sign(direction);
  if (!direction) return false;
  if (typeof mosaicSelectionShape !== 'undefined' && mosaicSelectionShape === 'brush' && StudioState.activeTool === 'stamp' && (mosaicTransferMode === 'move' || StudioState.stampInteractionMode === 'select') && !brushEditorPortal) {
    const next = Math.max(1,Math.min(getToolSizeInfo().max,selectionBrushDiameter+direction));
    if (next === selectionBrushDiameter) return false;
    selectionBrushDiameter = next;
    syncEditWorkspaceUI(); redraw();
    return true;
  }
  if (StudioState.activeTool === 'freeze' || ['rotate','mirror'].includes(StudioState.activeTool)) {
    const info = getToolSizeInfo();
    const next = Math.max(info.min, Math.min(info.max, info.dim + direction));
    if (next === info.dim) return false;
    setAreaToolSize(StudioState.activeTool, String(next));
    showEditorToast(`${StudioState.activeTool === 'freeze' ? 'Trava' : 'Girar'} ${next}×${next}`);
    return true;
  }

  if (StudioState.activeTool === 'paint' || StudioState.activeTool === 'stamp') {
    const N = StudioState.mosaicData ? StudioState.mosaicData.subtilesPerSide : 4;
    const totalR = StudioState.mosaicData ? StudioState.mosaicData.rows * N : 64;
    const totalC = StudioState.mosaicData ? StudioState.mosaicData.cols * N : 64;
    const maxDim = Math.max(totalR, totalC);

    let currentDim = 1;
    if (StudioState.brushSizeMode === 'block') {
      currentDim = N;
    } else {
      currentDim = getToolSizeInfo().dim;
    }

    if (StudioState.brushSnapToBlock) {
      const maxBlocks = Math.max(1, Math.floor(maxDim / N));
      const currentBlocks = Math.max(1, Math.round(currentDim / N));
      const nextBlocks = Math.max(1, Math.min(maxBlocks, currentBlocks + direction));

      if (nextBlocks === currentBlocks) {
        return false; // Clamped at min (1 block) or max: no cycle
      }

      const nextDim = nextBlocks * N;
      setBrushSizeMode(String(nextDim), true);
      showEditorToast(`Pincel ${nextBlocks}×${nextBlocks} blocos (${nextDim}×${nextDim})`);
      return true;
    } else {
      const nextDim = Math.max(1, Math.min(maxDim, currentDim + direction));

      if (nextDim === currentDim) {
        return false; // Clamped at 1 or maxDim: no cycle
      }

      setBrushSizeMode(String(nextDim), true);
      showEditorToast(`Pincel ${nextDim}×${nextDim}`);
      return true;
    }
  }

  return false;
}

function mouseDragged() {
  if (window.WorkspaceNavigation?.isLibraryOpen() || window.LibraryExport?.isOpen()) return;
  if (StudioState.studioMode === 'tiles') {
    if (
      !StudioState.isPanning &&
      StudioState.activeTool !== 'pan' &&
      StudioState.activeTool !== 'zoom' &&
      !StudioState.isSpaceDown
    ) {
      window.SubtileStudioUI?.handleViewportMouseDragged(mouseX, mouseY, StudioState);
    }
    return;
  }
  const hit = getCanvasHitCell(mouseX, mouseY);
  if (regionMoveGesture) { updateRegionMove(hit); redraw(); return; }

  const prev = StudioState.hoveredCell;
  const changed = (!prev && hit) || (prev && !hit) ||
    (prev && hit && (prev.row !== hit.row || prev.col !== hit.col || prev.subRow !== hit.subRow || prev.subCol !== hit.subCol));

  if (changed) {
    StudioState.hoveredCell = hit;
    updateHoverStatusText();
  }

  // Dragging a rectangular Clone / Supertile Selection marquee
  if (StudioState.isSelectingStampDrag && hit && StudioState.mosaicData) {
    updateCaptureDragBounds(hit);
    redraw();
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
    const isSnap = isEffectiveBrushSnap();
    const cellKey = isSnap
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

function updateCaptureDragBounds(hit) {
  const origin = captureOriginHit || hit;
  const N = StudioState.mosaicData.subtilesPerSide;
  if (mosaicSelectionShape !== 'rect' && captureGesture) {
    const gr = hit.row*N+hit.subRow, gc = hit.col*N+hit.subCol;
    window.MosaicEngine.extendRegionGesture(captureGesture, hit.selectionX ?? gc+.5, hit.selectionY ?? gr+.5);
    StudioState.stampDragStartGR = captureGesture.minGR;
    StudioState.stampDragStartGC = captureGesture.minGC;
    StudioState.stampDragCurrGR = captureGesture.maxGR;
    StudioState.stampDragCurrGC = captureGesture.maxGC;
    return;
  }
  if (mosaicTransferMode !== 'move' && isEffectiveBrushSnap()) {
    StudioState.stampDragStartGR = Math.min(origin.row, hit.row) * N;
    StudioState.stampDragStartGC = Math.min(origin.col, hit.col) * N;
    StudioState.stampDragCurrGR = (Math.max(origin.row, hit.row) + 1) * N - 1;
    StudioState.stampDragCurrGC = (Math.max(origin.col, hit.col) + 1) * N - 1;
  } else {
    StudioState.stampDragStartGR = origin.row * N + origin.subRow;
    StudioState.stampDragStartGC = origin.col * N + origin.subCol;
    StudioState.stampDragCurrGR = hit.row * N + hit.subRow;
    StudioState.stampDragCurrGC = hit.col * N + hit.subCol;
  }
}
function startCanvasRegionCaptureDrag(hit, additive=false) {
  if (!StudioState.mosaicData || !hit) return;
  if (StudioState.activeTool !== 'stamp') activateStudioTool('stamp');
  captureGesture = window.MosaicEngine.createRegionGesture(mosaicSelectionShape, StudioState.mosaicData.rows*StudioState.mosaicData.subtilesPerSide, StudioState.mosaicData.cols*StudioState.mosaicData.subtilesPerSide, mosaicSelectionShape === 'brush' ? selectionBrushDiameter : 1);
  if(additive && mosaicTransferMode==='move' && mosaicRegion) {
    captureGesture.baseSelection=JSON.parse(JSON.stringify({...mosaicRegion.pattern,minGlobalRow:mosaicRegion.row,minGlobalCol:mosaicRegion.col}));
  }
  captureOriginHit = {...hit};
  StudioState.isSelectingStampDrag = true;
  StudioState.stampInteractionMode = 'select';
  updateCaptureDragBounds(hit);
  syncEditWorkspaceUI();
  syncCanvasCursor();
  redraw();
}

function finishCanvasRegionCapture() {
  if (!StudioState.isSelectingStampDrag) return false;
  StudioState.isSelectingStampDrag = false;
  if (StudioState.mosaicData) {
    let captured = window.MosaicEngine.captureSubtileRegion(
      StudioState.mosaicData,
      StudioState.stampDragStartGR,
      StudioState.stampDragStartGC,
      StudioState.stampDragCurrGR,
      StudioState.stampDragCurrGC
    );
    if (captured) {
      if (mosaicSelectionShape !== 'rect') {
        const cells = window.MosaicEngine.getRegionGestureCells(captureGesture);
        if (!cells.length) { cancelCloneCapture(); return false; }
        const selected = new Set(cells.map(cell => `${cell.gr},${cell.gc}`));
        for (let y=0;y<captured.rows;y++) for(let x=0;x<captured.cols;x++) {
          if (!selected.has(`${captured.minGlobalRow+y},${captured.minGlobalCol+x}`)) captured.cells[y][x] = null;
        }
      }
      if(captureGesture?.baseSelection && mosaicRegion) captured=window.MosaicEngine.mergeRegionSelections(StudioState.mosaicData,captureGesture.baseSelection,captured);
      captureGesture = null;
      mosaicRegion = {pattern: JSON.parse(JSON.stringify(captured)), row: captured.minGlobalRow, col: captured.minGlobalCol};
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

      if (StudioState.activeTool === 'stamp') cloneReady = true;
      captureOriginHit = null;
      StudioState.stampInteractionMode = 'apply';

      renderEditBrushPalette();
      renderSupertileBuilderCanvas();
      syncEditWorkspaceUI();
      saveStudioStateToStorage();
      redraw();
    }
  }
  return true;
}

function handleCanvasMouseDown(e) {
  if (window.WorkspaceNavigation?.isLibraryOpen() || window.LibraryExport?.isOpen()) return;
  if (StudioState.studioMode === 'tiles') {
    if (StudioState.activeTool === 'zoom') {
      e.preventDefault();
      const delta = (e.altKey || e.button === 2) ? -25 : 25;
      setZoomPercent(StudioState.zoomPercent + delta);
      return;
    }
    if (
      StudioState.activeTool !== 'pan' &&
      !StudioState.isSpaceDown &&
      e.button === 0
    ) {
      window.SubtileStudioUI?.handleViewportMouseDown(mouseX, mouseY, e, StudioState);
    }
    return;
  }
  if (
    StudioState.activeTool === 'pan' ||
    StudioState.activeTool === 'zoom' ||
    StudioState.isSpaceDown ||
    e.button === 1
  ) {
    return;
  }

  if (e.button !== 0 && e.button !== 2) return;
  const hit = getCanvasHitCell(mouseX, mouseY);
  if (!hit || !StudioState.mosaicData) return;

  StudioState.hoveredCell = hit;
  updateHoverStatusText();

  // Alt + Left-Click/Drag anywhere = Capture Tile or Supertile Region from the Mosaic!
  if (e.altKey && e.button === 0 && (StudioState.activeTool === 'paint' || StudioState.activeTool === 'stamp' || StudioState.activeTool === 'inspect')) {
    e.preventDefault();
    if (StudioState.activeTool !== 'stamp') mosaicTransferMode = 'stamp';
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
      const isSnap = isEffectiveBrushSnap();
      StudioState.isPaintingDrag = true;
      StudioState.lastPaintedCellKey = isSnap
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
  if (['rotate','mirror'].includes(StudioState.activeTool)) {
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
    if (mosaicTransferMode === 'move') {
      if (e.button === 0) beginRegionInteraction(hit,e.shiftKey);
      else if (e.button === 2) cancelCloneCapture();
      return;
    }

    if (e.button === 2) {
      if (StudioState.isSelectingStampDrag || StudioState.stampInteractionMode === 'select') { cancelCloneCapture(); return; }
      if (mosaicTransferMode === 'move') return;
      rotateOrFlipActiveBrush('r90');
      return;
    }

    if (e.button === 0) {
      const shouldSelectRegion = StudioState.stampInteractionMode === 'select';
      if (shouldSelectRegion) {
        startCanvasRegionCaptureDrag(hit);
      } else {
        if (!isCloneReady()) { showEditorToast('Segure Alt e arraste para capturar uma região antes de clonar.', 'info'); return; }
        const activePat = ensureSupertilePattern();
        const isMultiCell = activePat.rows > 1 || activePat.cols > 1;
        if (StudioState.editScope === 'same_tile' && isMultiCell) {
          showEditorToast('O escopo Iguais compara 1×1. Reduza o pincel para 1×1 ou use outro escopo.', 'warn');
          return;
        }
        const isSnap = isEffectiveBrushSnap();
        StudioState.isPaintingDrag = true;
        StudioState.lastPaintedCellKey = isSnap
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

function readDirtyGuardPreference() {
  try { return window.sessionStorage?.getItem('tiling_stripes_dirty_guard_suppressed') === 'true'; }
  catch (_) { return false; }
}
let dirtyGuardSessionSuppressed = readDirtyGuardPreference();
let pendingDirtyGuardAction = null;
let dirtyGuardTriggerElement = null;

function requestParamChangeWithGuard(triggerEl, revertFn, applyFn, { frozenLoss = 0 } = {}) {
  if (window.StudioModal?.isOpen()) { revertFn?.(); return; }
  if (dirtyGuardSessionSuppressed || (!frozenLoss && !isDocumentDirty(StudioState))) {
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

  const preference = document.getElementById('dirtyGuardDontAsk');
  if (preference) preference.checked = dirtyGuardSessionSuppressed;
  dirtyGuardTriggerElement = triggerEl;
  if (descEl) {
    descEl.innerHTML = `${frozenLoss ? `A nova grade removerá ${frozenLoss} preservações fora dos limites.` : 'O mosaico será regenerado. As preservações dentro da grade serão mantidas.'} Você pode desfazer com <kbd>Ctrl+Z</kbd>.`;
  }

  pendingDirtyGuardAction = { revertFn, applyFn };
  cancelToolGesture();
  window.StudioModal.enter(dialog, () => closeDirtyGuard(false), triggerEl || document.activeElement);
  dialog.classList.remove('hidden');
  btnCancel?.focus();
}

function closeDirtyGuard(confirmed) {
  const dialog = document.getElementById('dirtyGuardDialog');
  const dontAskCheckbox = document.getElementById('dirtyGuardDontAsk');
  if (confirmed && dontAskCheckbox && dontAskCheckbox.checked) {
    dirtyGuardSessionSuppressed = true;
    try { window.sessionStorage?.setItem('tiling_stripes_dirty_guard_suppressed', 'true'); } catch (_) {}
  }

  dialog?.classList.add('hidden');
  if (dialog) window.StudioModal.leave(dialog);
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

function countFrozenOutsideTopology(frozenCells, rows, cols, subdivision) {
  const n = subdivision * 2;
  return Array.from(frozenCells?.keys() || []).filter(key => {
    const parts = key.split(',').map(Number);
    return parts.length !== 4 || parts.some(v => !Number.isInteger(v) || v < 0) ||
      parts[0] >= rows || parts[1] >= cols || parts[2] >= n || parts[3] >= n;
  }).length;
}

function requestTopologyChange(next, trigger) {
  const rows = next.rows ?? StudioState.rows, cols = next.cols ?? StudioState.cols;
  const subdivision = next.subdivision ?? StudioState.subdivision;
  if (rows === StudioState.rows && cols === StudioState.cols && subdivision === StudioState.subdivision) return;
  const frozenLoss = countFrozenOutsideTopology(StudioState.frozenCells, rows, cols, subdivision);
  requestParamChangeWithGuard(trigger || document.activeElement, syncAllInputsFromState, () => {
    // A restored session may not yet have lastDocumentParams. Capture the old
    // topology before changing it, so the first undo after reload is complete.
    const previousParams = window.DocumentSnapshot.collectParams(StudioState);
    StudioState.lastDocumentParams = previousParams;
    const previousEntry = StudioState.editHistory[StudioState.editHistoryIndex];
    if (previousEntry) window.DocumentSnapshot.attachDocument(previousEntry, previousParams);
    Object.assign(StudioState, next);
    syncAllInputsFromState();
    regenerateMosaic(true);
  }, { frozenLoss });
}

function swapStudioColors() {
  commitDocumentEdit();
  beginDocumentEdit('swap');
  [StudioState.fgColor, StudioState.bgColor] = [StudioState.bgColor, StudioState.fgColor];
  const fg = document.getElementById('fgColorPicker'), bg = document.getElementById('bgColorPicker');
  if (fg) fg.value = StudioState.fgColor;
  if (bg) bg.value = StudioState.bgColor;
  renderEditBrushPalette();
  renderSupertileBuilderCanvas();
  flushSaveStudioStateToStorage();
  redraw();
  commitDocumentEdit();
}

// Appearance previews share one transaction until change/blur. No-op and
// cancelled previews leave both the undo stack and its redo branch untouched.
let documentEditTransaction = null;

function beginDocumentEdit(owner) {
  if (documentEditTransaction?.owner === owner) return;
  commitDocumentEdit();
  documentEditTransaction = { owner, before: buildDocumentSnapshot(window.DocumentSnapshot.collectParams(StudioState)) };
}

function commitDocumentEdit() {
  const transaction = documentEditTransaction;
  if (!transaction) return;
  documentEditTransaction = null;
  const current = window.DocumentSnapshot.collectParams(StudioState);
  if (!transaction.before || JSON.stringify(current) === JSON.stringify(transaction.before.document)) return;
  const entry = StudioState.editHistory[StudioState.editHistoryIndex];
  if (entry) window.DocumentSnapshot.attachDocument(entry, transaction.before.document);
  pushEditHistorySnapshot();
}

function cancelDocumentEdit() {
  const transaction = documentEditTransaction;
  if (!transaction) return;
  documentEditTransaction = null;
  restoreDocumentSnapshot(transaction.before);
}

function bindDocumentEditField(field) {
  field?.addEventListener('change', commitDocumentEdit);
  field?.addEventListener('blur', commitDocumentEdit);
  field?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || documentEditTransaction?.owner !== field.id) return;
    event.preventDefault();
    event.stopPropagation();
    cancelDocumentEdit();
  });
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
  if (window.DocumentSnapshot) {
    const params = window.DocumentSnapshot.collectParams(StudioState);
    window.DocumentSnapshot.attachDocument(snap, params);
    StudioState.lastDocumentParams = params;
  }
  if (JSON.stringify(snap) === JSON.stringify(StudioState.editHistory[StudioState.editHistoryIndex])) return;

  if (StudioState.editHistoryIndex < StudioState.editHistory.length - 1) {
    StudioState.editHistory = StudioState.editHistory.slice(0, StudioState.editHistoryIndex + 1);
  }

  StudioState.editHistory.push(snap);
  const maxAllowedEdits = window.StatePersistence?.IDB_MAX_EDIT_HISTORY || 256;
  while (StudioState.editHistory.length > maxAllowedEdits) {
    StudioState.editHistory.shift();
  }
  StudioState.editHistoryIndex = StudioState.editHistory.length - 1;
  syncEditUndoUI();
  saveStudioStateToStorage();
}

function undoMosaicEdit() {
  commitDocumentEdit();
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
  commitDocumentEdit();
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
    btn.title = shortNames[s.id] || s.name;
    btn.setAttribute('aria-label', btn.title);
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

function cycleEditScope(direction = 1) {
  const scopeOrder = ['canvas_center', 'orbit_sym', 'block_sym', 'all_blocks', 'single', 'same_tile'];
  const curIdx = Math.max(0, scopeOrder.indexOf(StudioState.editScope));
  const nextIdx = (curIdx + direction + scopeOrder.length) % scopeOrder.length;
  StudioState.editScope = scopeOrder[nextIdx];
  const meta = window.MosaicEngine?.EDIT_SCOPES?.[StudioState.editScope];
  const name = meta ? meta.name : StudioState.editScope;
  showEditorToast(`Escopo: ${name} (${nextIdx + 1}/6)`);
  syncEditWorkspaceUI();
  saveStudioStateToStorage();
  redraw();
  return StudioState.editScope;
}

function renderEditBrushPalette() {
  const container = document.getElementById('editBrushPaletteContainer');
  if (!container) return;

  const query = (StudioState.editBrushSearchQuery || '').trim().toLowerCase();
  const grouped = (window.TileRegistry && typeof window.TileRegistry.getOrderedGroupedFamilies === 'function')
    ? window.TileRegistry.getOrderedGroupedFamilies()
    : [{ id: 'all', name: '', families: window.TileRegistry.TILE_FAMILIES_META }];
  const tileNames = window.TileRegistry.TILE_NAMES;

  container.innerHTML = '';

  for (const grp of grouped) {
    let groupHeaderAppended = false;
    for (const fam of grp.families) {
      const groupLabel = grp.name || fam.group || '';
      const matchingTiles = fam.tileIds.filter((id) => {
        if (!query) return true;
        const tName = (tileNames[id] || '').toLowerCase();
        const gName = groupLabel.toLowerCase();
        return fam.name.toLowerCase().includes(query) || gName.includes(query) || tName.includes(query) || `#${id}` === query;
      });

      if (matchingTiles.length === 0) continue;

      if (groupLabel && !groupHeaderAppended) {
        groupHeaderAppended = true;
        const groupHeading = document.createElement('div');
        groupHeading.className = 'swatches-group-heading';
        groupHeading.textContent = groupLabel;
        container.appendChild(groupHeading);
      }

      const card = document.createElement('div');
      card.className = 'family-swatch-card family-all';

      const header = document.createElement('div');
      header.className = 'family-card-header';

      const titleSpan = document.createElement('span');
      titleSpan.style.cssText = 'font-size:var(--font-ui);font-weight:600;color:var(--text-secondary);';
      titleSpan.textContent = fam.name;

      const rightMeta = document.createElement('div');
      rightMeta.className = 'family-actions-right';

      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'family-studio-jump-btn';
      jumpBtn.innerHTML = window.UiFormat.icon(fam.builtIn ? 'copy' : 'edit');
      jumpBtn.title = fam.builtIn
        ? `Inspecionar / Duplicar "${fam.name}" no Estúdio de Subtiles`
        : `Abrir "${fam.name}" no Estúdio de Subtiles`;
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.SubtileStudioUI?.openTilesStudio(fam.id);
      });

      const countSpan = document.createElement('span');
      countSpan.className = 'family-count-tag';
      countSpan.textContent = String(matchingTiles.length);

      rightMeta.appendChild(jumpBtn);
      rightMeta.appendChild(countSpan);

      header.appendChild(titleSpan);
      header.appendChild(rightMeta);
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
          if (tileId !== 84) {
            StudioState.previousBrushTileId = tileId;
          }
          selectBrushTile(tileId);
        });

        grid.appendChild(swatch);
      }

      card.appendChild(grid);
      container.appendChild(card);
    }
  }

  requestAnimationFrame(() => {
    const active = container.querySelector('.tile-swatch-btn.brush-active');
    if (!active) return;
    // Scroll only the palette, never the static dock column around it.
    const box = container.getBoundingClientRect();
    const target = active.getBoundingClientRect();
    if (!box.height || !target.height) return;
    if (target.top < box.top) container.scrollTop -= box.top - target.top;
    else if (target.bottom > box.bottom) container.scrollTop += target.bottom - box.bottom;
  });
}


function resetActiveBrushOrientation() {
  recordBrushEditorUndo();
  const pat = ensureSupertilePattern();
  for (const row of pat.cells) {
    for (const cell of row) {
      if (!cell) continue;
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

  if (StudioState.activeTool === 'stamp' && !isCloneReady() && !brushEditorPortal) {
    gfx.noStroke(); gfx.fill(165, 175, 190); gfx.textSize(11);
    gfx.textAlign(gfx.CENTER, gfx.CENTER);

    ctx2d.drawImage(gfx.elt, 0, 0, size, size); gfx.remove();
    return;
  }

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
  if (e.altKey) {
    StudioState.editBrushTileId = cell.baseTileId;
    StudioState.editBrushTransform = cell.transform || 'id';
    renderEditBrushPalette(); syncEditWorkspaceUI(); saveStudioStateToStorage();
    return;
  }
  if ((e.button === 0 || isDrag) && cell.baseTileId === StudioState.editBrushTileId &&
      (cell.transform || 'id') === (StudioState.editBrushTransform || 'id')) return;
  if (!isDrag) recordBrushEditorUndo();
  if (StudioState.activeTool === 'stamp') { cloneReady = true; StudioState.stampInteractionMode = 'apply'; }

  if (e.button === 2 && !isDrag) {
    // Right-click on a cell in the Supertile Builder rotates that cell +90° CW
    const nextTr = window.D4Symmetry.composeD4('r90', cell.transform || 'id');
    cell.transform = nextTr;
    cell.tileId = window.TileRegistry.getTransformedTileId(cell.baseTileId, nextTr);
    if (pat.rows === 1 && pat.cols === 1) {
      StudioState.editBrushTransform = nextTr;
    }
  } else if (e.button === 0 || isDrag) {
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
 * The right dock is static: it always presents the same document panels. The
 * active tool is identified in the top control bar, where its options live.
 */
const TOOL_CONTEXT_LABELS = {
  inspect: 'Inspeção',
  paint: 'Pincel',
  rotate: 'Girar',
  mirror: 'Espelhar',
  stamp: 'Clonar',
  freeze: 'Preservar',
  pan: 'Mão',
  zoom: 'Zoom'
};
const TOOL_CONTEXT_ICONS = {
  inspect: 'cursor',
  paint: 'brush',
  rotate: 'rotate',
  mirror: 'mirror',
  stamp: 'stamp',
  freeze: 'snowflake',
  pan: 'hand',
  zoom: 'zoom'
};

function syncContextPanel() {
  const title = document.getElementById('ctxPanelTitle');
  if (title) title.textContent = StudioState.studioMode === 'tiles' ? 'Editar peças' : 'Propriedades';

  const tool = StudioState.activeTool;
  const label = tool === 'paint' && isEraserPattern()
    ? 'Borracha'
    : (window.StudioCommands?.get('mosaic', tool)?.name || TOOL_CONTEXT_LABELS[tool] || 'Edição');
  const nameEl = document.getElementById('topToolName');
  const iconEl = document.getElementById('topToolIcon');
  if (nameEl) nameEl.textContent = label;
  if (iconEl && window.UiFormat?.icon) {
    iconEl.innerHTML = window.UiFormat.icon(TOOL_CONTEXT_ICONS[tool] || 'cursor', 16);
  }
}

const DOCK_TAB_PANELS = [
  ['symmetry', 'panel-symmetry'],
  ['pieces', 'panel-swatches'],
  ['document', 'panel-document'],
  ['scope', 'panel-edit-scope'],
  ['brush', 'panel-edit-brush']
];
let activeDockTab = 'symmetry';

function setDockTab(tab, focus = false) {
  const entry = DOCK_TAB_PANELS.find(([id]) => id === tab) || DOCK_TAB_PANELS[0];
  activeDockTab = entry[0];
  DOCK_TAB_PANELS.forEach(([id, panelId]) => {
    const panel = document.getElementById(panelId);
    const button = document.querySelector?.(`#dockPanelTabs [data-dock-tab="${id}"]`);
    const selected = id === entry[0];
    if (panel) {
      panel.classList.toggle('hidden', !selected);
      panel.classList.remove('collapsed');
      panel.querySelector('.panel-body')?.classList.remove('hidden');
    }
    if (button) {
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.tabIndex = selected ? 0 : -1;
    }
  });
  if (focus) document.querySelector?.(`#dockPanelTabs [data-dock-tab="${entry[0]}"]`)?.focus();
}

function initDockPanelTabs() {
  const tabs = document.getElementById('dockPanelTabs');
  if (!tabs) return;
  tabs.querySelectorAll('[data-dock-tab]').forEach((button) => {
    button.addEventListener('click', () => setDockTab(button.dataset.dockTab));
  });
  tabs.addEventListener('keydown', (event) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...tabs.querySelectorAll('[data-dock-tab]')];
    const index = items.findIndex((button) => button.dataset.dockTab === activeDockTab);
    let next = index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else next = (index + 1) % items.length;
    setDockTab(items[next].dataset.dockTab, true);
  });
  setDockTab(activeDockTab);
}

function syncEditWorkspaceUI() {
  syncFreezeUI();
  syncContextPanel();
  syncCanvasCursor();
  window.SubtileStudioUI?.syncNavigationState?.();
  document.body.dataset.activeTool = StudioState.activeTool;
  document.body.dataset.stampMode = StudioState.stampInteractionMode;
  document.body.dataset.studioMode = StudioState.studioMode === 'tiles' ? 'tiles' : 'mosaic';

  // 1. Right dock is static in mosaic mode; only the piece editor swaps panes.

  // 2. Right Dock Workspace Panes
  const inTilesMode = StudioState.studioMode === 'tiles';
  const genPane = document.getElementById('dock-workspace-generate');
  const tilesPane = document.getElementById('dock-workspace-tiles');
  if (genPane) {
    genPane.classList.toggle('hidden', inTilesMode);
  }
  if (tilesPane) {
    tilesPane.classList.toggle('hidden', !inTilesMode);
  }

  // 3. Top control bar: only the active tool's options stay visible.
  const activeTool = StudioState.activeTool;
  const showBrushOptions = activeTool === 'paint' || activeTool === 'stamp';
  document.getElementById('ctxPaint')?.classList.toggle('hidden', !showBrushOptions);
  document.getElementById('rotateToolOptionsWrap')?.classList.toggle('hidden', !['rotate', 'mirror'].includes(activeTool));
  document.getElementById('freezeToolOptionsWrap')?.classList.toggle('hidden', activeTool !== 'freeze');
  document.getElementById('topToolContext')?.classList.toggle('hidden', inTilesMode);

  // 3. Left Toolbar Active Tool Highlight
  const selecting = StudioState.studioMode !== 'tiles' && StudioState.activeTool === 'stamp' && mosaicTransferMode === 'move';
  document.querySelectorAll('#left-toolbar .tool-btn[data-tool]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === StudioState.activeTool && !(selecting && b.dataset.tool === 'stamp'));
  });
  document.querySelectorAll('[data-region-shape]').forEach(button => {
    const active = selecting && button.dataset.regionShape === mosaicSelectionShape;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  document.body.dataset.regionTool = selecting ? 'selection' : 'clone';
  document.body.dataset.selectionShape = mosaicSelectionShape;
  document.getElementById('selectionSummary')?.classList.toggle('hidden',!selecting);
  const selectedPattern = mosaicRegion?.pattern;
  const dimensions = document.getElementById('selectionDimensions'), cellCount = document.getElementById('selectionCellCount');
  if (dimensions) dimensions.textContent = selectedPattern ? `${selectedPattern.cols} × ${selectedPattern.rows}` : '—';
  if (cellCount) cellCount.textContent = selectedPattern ? String(selectedPattern.cells.flat().filter(Boolean).length) : '0';
  const clearRegionButton = document.getElementById('btnClearRegion');
  if (clearRegionButton) clearRegionButton.disabled = !mosaicRegion;
  syncSelectionControls(selecting);

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
    const active = btn.dataset.freezeSize === StudioState.freezeSize;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
    btn.disabled = btn.dataset.freezeSize !== 'block' && Number(btn.dataset.freezeSize) > getToolSizeInfo('freeze').max;
  });


  const sameTileNotice = document.getElementById('sameTileNotice');
  if (sameTileNotice) {
    const curPat = ensureSupertilePattern();
    const isMulti = curPat.rows > 1 || curPat.cols > 1;
    sameTileNotice.classList.toggle('hidden', !(StudioState.editScope === 'same_tile' && isMulti));
  }

  // 6. Contextual Rotate / Mirror options in the top bar
  document.getElementById('rotateBehaviorControl')?.classList.toggle('hidden',StudioState.activeTool==='mirror');
  document.getElementById('rotateBehaviorControl')?.previousElementSibling?.classList.toggle('hidden',StudioState.activeTool==='mirror');
  const isRotateTool = ['rotate','mirror'].includes(StudioState.activeTool);
  const rotateOpts = document.getElementById('rotateToolOptionsWrap');
  if (rotateOpts) {
    rotateOpts.classList.toggle('hidden', !isRotateTool);
    const rotateLabel = document.getElementById('rotateToolLabel');
    if (rotateLabel) rotateLabel.textContent = StudioState.activeTool === 'mirror' ? 'Espelhar' : 'Girar';
  }

  document.querySelectorAll('#rotateSizeControl .seg-btn[data-rot-size]').forEach((btn) => {
    const active = btn.dataset.rotSize === StudioState.rotateSizeMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
    btn.disabled = btn.dataset.rotSize !== 'block' && Number(btn.dataset.rotSize) > getToolSizeInfo('rotate').max;
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
  // 7. Brush Size Display & Snap Status Badge
  const sizeValEl = document.getElementById('brushSizeValueText');
  const sizeSubEl = document.getElementById('brushSizeSubText');
  const snapStatusEl = document.getElementById('brushSnapStatusText');
  const snapBtn = document.getElementById('btnToggleBrushSnap');

  const N = StudioState.mosaicData ? StudioState.mosaicData.subtilesPerSide : 4;
  let currentDim = 1;
  if (StudioState.brushSizeMode === 'block') {
    currentDim = N;
  } else {
    currentDim = Math.max(1, parseInt(StudioState.brushSizeMode, 10) || 1);
  }

  if (sizeValEl) {
    sizeValEl.textContent = `${currentDim}×${currentDim}`;
  }
  if (sizeSubEl) {
    if (StudioState.brushSnapToBlock) {
      const blocks = Math.max(1, Math.round(currentDim / N));
      sizeSubEl.textContent = `${blocks}×${blocks} ${blocks === 1 ? 'bloco' : 'blocos'}`;
    } else {
      sizeSubEl.textContent = 'peças';
    }
  }
  if (snapStatusEl) {
    snapStatusEl.textContent = StudioState.brushSnapToBlock ? 'Ativado' : 'Desativado';
  }
  if (snapBtn) {
    snapBtn.classList.toggle('active', Boolean(StudioState.brushSnapToBlock));
    snapBtn.setAttribute('aria-pressed', StudioState.brushSnapToBlock ? 'true' : 'false');
  }


  document.querySelectorAll('[data-size-tool]').forEach(row => {
    const info = getToolSizeInfo(row.dataset.sizeTool);
    const value = row.querySelector('[data-size-value]');
    const detail = row.querySelector('[data-size-detail]');
    if (value) value.textContent = `${info.dim}×${info.dim}`;
    if (detail) detail.textContent = row.dataset.sizeTool === 'freeze'
      ? (info.dim >= info.N ? 'bloco' : 'peças') : 'peças';
    const decrease = row.querySelector('[data-size-step="-1"]');
    const increase = row.querySelector('[data-size-step="1"]');
    if (decrease) decrease.disabled = info.dim <= info.min;
    if (increase) increase.disabled = info.dim >= info.max;
  });
  const brushInfo = getToolSizeInfo('paint');
  const decreaseBrush = document.getElementById('btnBrushSizeDec');
  const increaseBrush = document.getElementById('btnBrushSizeInc');
  if (decreaseBrush) decreaseBrush.disabled = brushInfo.dim <= brushInfo.min;
  if (increaseBrush) increaseBrush.disabled = brushInfo.dim >= brushInfo.max;
  if (StudioState.brushSizeMode === 'custom' && StudioState.supertilePattern && sizeValEl) {
    sizeValEl.textContent = `${StudioState.supertilePattern.rows}×${StudioState.supertilePattern.cols}`;
    if (sizeSubEl) sizeSubEl.textContent = 'peças';
  }

  if (typeof mosaicSelectionShape !== 'undefined' && mosaicSelectionShape === 'brush' && StudioState.activeTool === 'stamp' && (mosaicTransferMode === 'move' || StudioState.stampInteractionMode === 'select') && !brushEditorPortal) {
    if (sizeValEl) sizeValEl.textContent = `${selectionBrushDiameter}×${selectionBrushDiameter}`;
    if (sizeSubEl) sizeSubEl.textContent = 'peças';
    if (decreaseBrush) decreaseBrush.disabled = selectionBrushDiameter <= 1;
    if (increaseBrush) increaseBrush.disabled = selectionBrushDiameter >= brushInfo.max;
  }

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
    if (brushNameEl) brushNameEl.textContent = 'Padrão';
    if (brushD4El) brushD4El.textContent = `${d4Meta.label} ${d4Meta.arrow}`;
    if (brushBadgeEl) brushBadgeEl.textContent = `${pat.rows}×${pat.cols}`;
  }

  if (StudioState.activeTool === 'paint' && isEraserPattern() && !brushEditorPortal) {
    if (brushNameEl) brushNameEl.textContent = 'Borracha · Tile Vazio #84';
    if (brushBadgeEl) brushBadgeEl.textContent = `Borracha ${pat.rows}×${pat.cols}`;
  }
  if (StudioState.activeTool === 'stamp' && !isCloneReady() && !brushEditorPortal) {
    if (brushNameEl) brushNameEl.textContent = 'Sem captura';
    if (brushD4El) brushD4El.textContent = '';
    if (brushBadgeEl) brushBadgeEl.textContent = 'Aguardando captura';
  }

  syncEditUndoUI();
  syncBrushEditorUI();
  updateHoverStatusText();
}

function updateHoverStatusText() {
  const el = document.getElementById('statusHoverInspector');
  if (!el) return;

  if (StudioState.studioMode === 'tiles' && window.SubtileStudioUI) {
    const texts = window.SubtileStudioUI.getStatusBarTexts(StudioState);
    el.innerHTML = texts.hover;
    return;
  }

  const hit = StudioState.hoveredCell;
  if (!hit || !StudioState.mosaicData) {
    el.textContent = 'Inspeção';
    return;
  }

  const block = StudioState.mosaicData.grid[hit.row]?.[hit.col];
  if (!block) return;

  const d4Meta = window.D4Symmetry.D4_METADATA[block.transformFromSource] || window.D4Symmetry.D4_METADATA.id;
  const subCell = block.cells[hit.subRow]?.[hit.subCol];
  const tileName = subCell ? (window.TileRegistry.TILE_NAMES[subCell.tileId] || `Tile #${subCell.tileId}`) : '';
  const isCellFrozen = StudioState.frozenCells && StudioState.frozenCells.has(`${hit.row},${hit.col},${hit.subRow},${hit.subCol}`);
  const freezeBadge = isCellFrozen ? ` • <span style="color:#38bdf8;font-weight:700;display:inline-flex;align-items:center;gap:3px;">${window.UiFormat.icon('snowflake', 12)}PRESERVADO</span>` : '';

  el.innerHTML =
    `Bloco <strong>[L${hit.row + 1}, C${hit.col + 1}]</strong> • ` +
    `Órbita <strong>#${block.orbitId}</strong> • ` +
    `Giro/Espelho: <strong>${d4Meta.label} (${d4Meta.arrow})</strong> • ` +
    `Subtile [${hit.subRow + 1},${hit.subCol + 1}]: <strong>#${subCell ? subCell.tileId : '-'} ${tileName}</strong>${freezeBadge}`;
}

function updateStatusBar() {
  const artEl = document.getElementById('statusArtboardInfo');
  const gridEl = document.getElementById('statusGridInfo');

  if (StudioState.studioMode === 'tiles' && window.SubtileStudioUI) {
    const texts = window.SubtileStudioUI.getStatusBarTexts(StudioState);
    if (artEl) artEl.textContent = texts.artboard;
    if (gridEl) gridEl.textContent = texts.grid;
    const hoverEl = document.getElementById('statusHoverInspector');
    if (hoverEl) hoverEl.innerHTML = texts.hover;
    return;
  }

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

  const edgeMatchToggle = document.getElementById('toggleEdgeMatch');
  if (edgeMatchToggle) edgeMatchToggle.checked = Boolean(StudioState.edgeMatch);
  if (typeof syncEdgeVariabilityUI === 'function') syncEdgeVariabilityUI();

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
  window.UiFields?.init(document, {onCancel: field => {
    if (documentEditTransaction?.owner === field.id) cancelDocumentEdit();
  }});
  saveStatus.subscribe(renderSaveStatus);
  document.getElementById('btnRetryPersistence')?.addEventListener('click', () => {
    saveScheduler.cancel();
    saveStudioStateToStorage();
    if (saveStatus.snapshot().scopes.some(scope => scope.scope === 'library')) window.LibraryStore?.retrySave();
  });
  document.getElementById('btnBackupUnsavedLibrary')?.addEventListener('click', () => document.getElementById('btnExportLibraryJson')?.click());
  document.getElementById('btnExportUnsavedMosaic')?.addEventListener('click', () => document.getElementById('btnExport')?.click());
  document.getElementById('btnDirtyGuardCancel')?.addEventListener('click', () => closeDirtyGuard(false));
  document.getElementById('btnDirtyGuardConfirm')?.addEventListener('click', () => closeDirtyGuard(true));
  window.InfoUI?.init();
  initDockPanelTabs();
  document.getElementById('railOpenLibrary')?.addEventListener('click', () => {
    window.WorkspaceNavigation?.openLibrary?.();
  });

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

  document.getElementById('btnClearRegion')?.addEventListener('click', () => { cancelToolGesture(); mosaicRegion = null; StudioState.stampInteractionMode = 'select'; syncEditWorkspaceUI(); redraw(); });
  document.querySelectorAll('[data-region-shape]').forEach(btn => btn.addEventListener('click', () => activateRegionSelection(btn.dataset.regionShape)));
  // --- Artboard Size Controls ---
  const wInput = document.getElementById('canvasW');
  const hInput = document.getElementById('canvasH');
  const btnSwapCanvas = document.getElementById('btnSwapCanvasSize');
  const btnLockCanvas = document.getElementById('btnLockCanvasRatio');
  const btnFitCanvasToGrid = document.getElementById('btnFitCanvasToGrid');

  const applyCanvasDimensions = (newW, newH) => {
    commitDocumentEdit();
    beginDocumentEdit('dimensions');
    StudioState.width = Math.max(100, Math.min(4096, Math.round(newW)));
    StudioState.height = Math.max(100, Math.min(4096, Math.round(newH)));
    if (wInput) wInput.value = StudioState.width;
    if (hInput) hInput.value = StudioState.height;
    applyZoomTransform();
    renderSupertileBuilderCanvas();
    commitDocumentEdit();
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
    requestTopologyChange({ rows: Math.max(1, Math.min(32, Math.round(r))),
      cols: Math.max(1, Math.min(32, Math.round(c))) });
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
    beginDocumentEdit(marginInput.id);
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
    const nextSeed = Number.isNaN(val) ? 0 : val;
    if (nextSeed === StudioState.seed) return;
    StudioState.seed = nextSeed;
    regenerateMosaic(true);
  });

  const triggerRandomSeed = () => {
    StudioState.seed = Math.floor(Math.random() * 100000);
    if (seedInput) seedInput.value = StudioState.seed;
    regenerateMosaic(true);
  };

  const mosaicCommandContext = {
    selectRegion: activateRegionSelection,
    selectTool: tool => tool === 'stamp' ? activateCloneTool() : activateStudioTool(tool), eraser: activateEraser, generate: triggerRandomSeed,
    undo: undoMosaicEdit, redo: redoMosaicEdit, swap: swapStudioColors,
    toggle: () => window.SubtileStudioUI.toggleTilesStudio(),
    canUndo: () => StudioState.editHistoryIndex > 0,
    canRedo: () => StudioState.editHistoryIndex < StudioState.editHistory.length - 1
  };
  const runMosaicCommand = id => window.StudioCommands.run('mosaic', id, mosaicCommandContext);
  window.StudioCommands.applyLabels(document, 'mosaic');
  btnRandomize?.addEventListener('click', () => runMosaicCommand('generate'));
  btnPrevSeed?.addEventListener('click', () => restoreGenerationHistory(StudioState.historyIndex - 1));
  btnNextSeed?.addEventListener('click', () => restoreGenerationHistory(StudioState.historyIndex + 1));

  btnToggleHistory?.addEventListener('click', (e) => {
    e.stopPropagation();
    const historyList = document.getElementById('seedHistoryList');
    const historyContainer = historyList?.closest('.sidebar-history-container');
    if (historyList) {
      const isCollapsed = historyList.classList.toggle('collapsed');
      if (historyContainer) historyContainer.classList.toggle('is-collapsed', isCollapsed);
      btnToggleHistory.classList.toggle('active', !isCollapsed);
      btnToggleHistory.setAttribute('aria-expanded', String(!isCollapsed));
      btnToggleHistory.title = isCollapsed ? 'Abrir histórico de gerações' : 'Fechar histórico';
      if (!isCollapsed) {
        const activeRow = historyList.querySelector('.history-item.active');
        if (activeRow) {
          activeRow.scrollIntoView({ block: 'nearest' });
        }
      }
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
    // O flyout do Histórico fecha ao clicar fora dele (canvas, painéis, etc.).
    // composedPath mantém o caminho original mesmo quando a lista é re-renderizada.
    const historyList = document.getElementById('seedHistoryList');
    const historyContainer = document.getElementById('dock-history');
    if (historyList && !historyList.classList.contains('collapsed') && historyContainer && !e.composedPath().includes(historyContainer)) {
      btnToggleHistory?.click();
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
      requestTopologyChange({ subdivision: parseInt(btn.dataset.sub, 10) || 2 }, btn);
    });
  });

  const edgeMatchToggle = document.getElementById('toggleEdgeMatch');
  edgeMatchToggle?.addEventListener('change', () => setEdgeMatchMode(edgeMatchToggle.checked));

  const edgeVariabilityInput = document.getElementById('edgeVariabilityInput');
  const edgeVariabilityValue = document.getElementById('edgeVariabilityValue');
  const previewEdgeVariability = () => {
    if (!edgeVariabilityValue) return;
    const pct = Math.round(clampEdgeVariability((parseInt(edgeVariabilityInput.value, 10) || 0) / 100) * 100);
    edgeVariabilityValue.textContent = `${pct}%`;
  };
  edgeVariabilityInput?.addEventListener('input', previewEdgeVariability);
  edgeVariabilityInput?.addEventListener('change', () => {
    setEdgeVariability((parseInt(edgeVariabilityInput.value, 10) || 0) / 100);
    syncEdgeVariabilityUI();
  });

  const paddingInput = document.getElementById('paddingInput');
  const applyPaddingValue = (raw) => {
    beginDocumentEdit(paddingInput.id);
    const pct = Math.max(0, Math.min(25, parseInt(raw, 10) || 0));
    StudioState.paddingRatio = pct / 100;
    if (paddingInput && String(paddingInput.value) !== String(pct)) paddingInput.value = pct;
    renderSupertileBuilderCanvas();
    saveScheduler.schedule();
    redraw();
  };
  paddingInput?.addEventListener('input', () => applyPaddingValue(paddingInput.value));
  paddingInput?.addEventListener('change', () => applyPaddingValue(paddingInput.value));

  // --- Spout output ---
  const spoutToggle = document.getElementById('spoutToggle');
  spoutToggle?.addEventListener('click', () => {
    StudioState.spoutEnabled = !StudioState.spoutEnabled;
    syncSpoutUI();
    if (StudioState.spoutEnabled) startSpoutOutput();
    else stopSpoutOutput();
  });

  const spoutNameInput = document.getElementById('spoutName');
  spoutNameInput?.addEventListener('change', () => {
    StudioState.spoutName = window.SpoutOutput
      ? window.SpoutOutput.sanitizeSenderName(spoutNameInput.value)
      : spoutNameInput.value;
    spoutNameInput.value = StudioState.spoutName;
    if (spoutSocket && spoutSocket.readyState === WebSocket.OPEN && spoutFrameInfo) {
      // Restart and resend together, even when the artwork itself is unchanged.
      spoutFrameInfo = null;
      spoutPump();
    }
    saveStudioStateToStorage();
  });
  syncSpoutUI();

  const fgPicker = document.getElementById('fgColorPicker');
  const bgPicker = document.getElementById('bgColorPicker');
  fgPicker?.addEventListener('input', () => {
    beginDocumentEdit(fgPicker.id);
    StudioState.fgColor = fgPicker.value;
    renderSupertileBuilderCanvas();
    saveScheduler.schedule();
    redraw();
  });
  bgPicker?.addEventListener('input', () => {
    beginDocumentEdit(bgPicker.id);
    StudioState.bgColor = bgPicker.value;
    renderSupertileBuilderCanvas();
    saveScheduler.schedule();
    redraw();
  });
  document.getElementById('btnSwapColors')?.addEventListener('click', () => runMosaicCommand('swap'));
  [marginInput, paddingInput, fgPicker, bgPicker].forEach(bindDocumentEditField);

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
  const setActiveTool = tool => tool === 'stamp' ? activateCloneTool() : activateStudioTool(tool);

  // Round 6: inspect is the generation context — no separate context button any more.

  window.SubtileStudioUI?.init({
    studioState: StudioState,
    redraw: () => redraw(),
    showToast: showEditorToast,
    selectBrushTile,
    setActiveTool,
    regenerateMosaic,
    requestParamChangeWithGuard,
    saveStudioState: saveStudioStateToStorage,
    syncEditWorkspaceUI,
    updateStatusBar,
    renderSwatchesPanel,
    renderEditBrushPalette
  });



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
      const next = StudioState.freezeSize === 'block' ? String(getToolSizeInfo('freeze').N) : 'block';
      setAreaToolSize('freeze', next);
    });
  });

  const btnFreezeClearSelection = document.getElementById('btnFreezeClearSelection');
  if (btnFreezeClearSelection) {
    btnFreezeClearSelection.addEventListener('click', () => {
      clearFrozenCells();
    });
  }

  document.querySelectorAll('#left-toolbar .tool-btn[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => runMosaicCommand(btn.dataset.tool));
  });

  document.querySelectorAll('#editToolSegmented .seg-btn[data-edit-tool]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTool(btn.dataset.editTool));
  });

  // --- Stage 2: Edit Undo/Redo, Canvas Center Sym, Rotate Options & Supertile Builder ---
  document.getElementById('btnEditUndo')?.addEventListener('click', () => runMosaicCommand('undo'));
  document.getElementById('btnEditRedo')?.addEventListener('click', () => runMosaicCommand('redo'));

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
      const next = StudioState.rotateSizeMode === 'block' ? String(getToolSizeInfo('rotate').N) : 'block';
      setAreaToolSize('rotate', next);
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

  document.querySelectorAll('[data-size-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      cycleActiveToolSize(Number(btn.dataset.sizeStep));
    });
  });

  // Brush Size Stepper Buttons & Snap to Block Toggle
  document.getElementById('btnBrushSizeInc')?.addEventListener('click', () => {
    cycleActiveToolSize(1);
  });
  document.getElementById('btnBrushSizeDec')?.addEventListener('click', () => {
    cycleActiveToolSize(-1);
  });
  document.getElementById('btnToggleBrushSnap')?.addEventListener('click', () => {
    StudioState.brushSnapToBlock = !StudioState.brushSnapToBlock;
    const N = StudioState.mosaicData ? StudioState.mosaicData.subtilesPerSide : 4;
    let currentDim = StudioState.brushSizeMode === 'block' ? N : (parseInt(StudioState.brushSizeMode, 10) || 1);
    if (StudioState.brushSnapToBlock) {
      const snappedDim = Math.max(1, Math.round(currentDim / N)) * N;
      setBrushSizeMode(String(snappedDim), true);
      const blocks = snappedDim / N;
      showEditorToast(`Ajuste ao Bloco: Ativado • Pincel ${blocks}×${blocks} blocos (Ctrl+U)`);
    } else {
      showEditorToast(`Ajuste ao Bloco: Desativado • Modo Subtile Livre (Ctrl+U)`);
      syncEditWorkspaceUI();
      redraw();
    }
    saveStudioStateToStorage();
  });



  document.getElementById('btnExpandBrushEditor')?.addEventListener('click', openBrushEditor);
  document.getElementById('btnCloseBrushEditor')?.addEventListener('click', () => closeBrushEditor());
  document.getElementById('btnCancelBrushEditor')?.addEventListener('click', () => closeBrushEditor(false));
  document.getElementById('btnBrushEditorUndo')?.addEventListener('click', () => stepBrushEditorHistory(-1));
  document.getElementById('btnBrushEditorRedo')?.addEventListener('click', () => stepBrushEditorHistory(1));
  document.getElementById('btnBrushEditorErase')?.addEventListener('click', () => selectBrushTile(84));
  document.getElementById('btnBrushEditorClear')?.addEventListener('click', clearBrushEditorPattern);
  for (const id of ['brushEditorRows','brushEditorCols']) document.getElementById(id)?.addEventListener('change', () => {
    resizeBrushEditorGrid(document.getElementById('brushEditorRows').value, document.getElementById('brushEditorCols').value);
  });
  const brushDialog = document.getElementById('brushEditorDialog');
  brushDialog?.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeBrushEditor(false); return; }
    if ((e.ctrlKey || e.metaKey) && !['INPUT','TEXTAREA'].includes(e.target?.tagName) && ['z','y'].includes(e.key.toLowerCase())) {
      e.preventDefault(); stepBrushEditorHistory(e.key.toLowerCase() === 'y' || e.shiftKey ? 1 : -1); return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName) && ['+','=','-'].includes(e.key)) {
      e.preventDefault(); cycleActiveToolSize(e.key === '-' ? -1 : 1); return;
    }
    if (e.key === 'Tab') {
      const controls = Array.from(brushDialog.querySelectorAll('button, input, select, [tabindex="0"]'))
        .filter(el => !el.disabled && el.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Interactive Mini-Canvas for Supertile Builder
  const miniCanvas = document.getElementById('supertileBuilderCanvas');
  if (miniCanvas) {
    miniCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
    miniCanvas.addEventListener('wheel', e => {
      if (!brushEditorPortal || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      e.preventDefault(); stepToolSizeFromWheel(e);
    }, {passive: false});
    miniCanvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      miniCanvas.focus();
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
    recordBrushEditorUndo();
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
    recordBrushEditorUndo();
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

  document.getElementById('btnSupertileCapture')?.addEventListener('click', beginCloneCapture);

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
      btnToggleDock.setAttribute('title', isCollapsed ? 'Expandir Painel Lateral' : 'Recolher Painel Lateral');
      btnToggleDock.setAttribute('aria-label', isCollapsed ? 'Expandir Painel Lateral' : 'Recolher Painel Lateral');
      const iconSpan = btnToggleDock.querySelector('.dock-toggle-icon');
      if (iconSpan) {
        // The arrow points where the panel goes: » to collapse, « to bring it back.
        iconSpan.innerHTML = window.UiFormat.icon(isCollapsed ? 'left' : 'right');
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

  pasteboard?.addEventListener('wheel', (e) => {
    // 1. Zoom with modifier: Ctrl / Cmd + wheel (or active tool 'zoom')
    if (e.ctrlKey || e.metaKey || StudioState.activeTool === 'zoom') {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 15 : -15;
      setZoomPercent(StudioState.zoomPercent + delta);
      return;
    }

    // 2. Vertical Pan with Alt:
    if (e.altKey) {
      e.preventDefault();
      const dy = e.deltaY;
      StudioState.panOffsetY = (StudioState.panOffsetY || 0) - dy;
      applyPanTransform();
      return;
    }

    // 3. Horizontal Pan with Shift, or 2D Pan when Space is held or in Pan tool:
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
      ['rotate','mirror'].includes(StudioState.activeTool) ||
      StudioState.activeTool === 'freeze';

    if (isEditTool && StudioState.studioMode !== 'tiles') {
      e.preventDefault();
      stepToolSizeFromWheel(e);
      return;
    }

    // 4. In tiles mode: default mouse wheel scroll zooms the artboard!
    if (StudioState.studioMode === 'tiles') {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 15 : -15;
      setZoomPercent(StudioState.zoomPercent + delta);
      return;
    }

    // 5. Non-edit tools (inspect): plain wheel pans the canvas in 2D
    e.preventDefault();
    StudioState.panOffsetX = (StudioState.panOffsetX || 0) - e.deltaX;
    StudioState.panOffsetY = (StudioState.panOffsetY || 0) - e.deltaY;
    applyPanTransform();
  }, { passive: false });

  pasteboard?.addEventListener('mousedown', (e) => {
    document.getElementById('canvas-stage')?.focus({ preventScroll: true });
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
      syncCanvasCursor();
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

  window.addEventListener('mouseup', (e) => {
    const wasPanning = StudioState.isPanning;
    if (StudioState.isPanning) {
      StudioState.isPanning = false;
      document.body.classList.remove('is-panning');
      if (StudioState.activeTool !== 'pan' && !StudioState.isSpaceDown) {
        pasteboard?.classList.remove('panning');
      }
    }
    syncCanvasCursor();
    if (StudioState.studioMode === 'tiles') {
      if (!wasPanning) {
        window.SubtileStudioUI?.handleViewportMouseUp(mouseX, mouseY, e, StudioState);
      }
      return;
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

    finishRegionMove();
    finishCanvasRegionCapture();

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
    if (e.defaultPrevented || e.isComposing) return;
    if (window.StudioModal?.isOpen()) {
      if (e.key === 'Escape') { e.preventDefault(); window.StudioModal.cancel(); }
      return;
    }
    if (window.WorkspaceNavigation?.isLibraryOpen()) {
      window.SubtileStudioUI?.handleKeyDown(e, StudioState);
      return;
    }
    if (e.target?.isContentEditable || e.target?.closest?.('[contenteditable]:not([contenteditable="false"])')) return;
    if (e.repeat && e.code !== 'Space' && !['Shift', 'Alt'].includes(e.key)) return;
    if (e.altKey && e.key !== 'Alt') return;
    StudioState.isShiftDown = Boolean(e.shiftKey);
    StudioState.isAltDown = Boolean(e.altKey);
    syncCanvasCursor();
    if (e.key === 'Shift') redraw();
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (e.key === 'Enter') e.target.blur();
      return;
    }
    if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) {
      return;
    }

    if (StudioState.studioMode !== 'tiles' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      if (window.StudioCommands) runMosaicCommand('swap');
      else swapStudioColors();
      return;
    }

    if (StudioState.studioMode !== 'tiles' && StudioState.activeTool === 'stamp' && e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (mosaicTransferMode === 'move') activateCloneTool();
      else { mosaicTransferMode = 'move'; syncEditWorkspaceUI(); redraw(); }
      return;
    }

    // Shortcut: ? opens shortcuts help popover
    if (e.key === '?') {
      e.preventDefault();
      window.InfoUI?.showPopover('shortcuts', document.getElementById('btnHelp'));
      return;
    }

    if (window.SubtileStudioUI && window.SubtileStudioUI.handleKeyDown(e, StudioState)) {
      return;
    }
    if (StudioState.studioMode !== 'tiles' && window.StudioCommands?.dispatch('mosaic', e, mosaicCommandContext)) return;

    // Undo / Redo Mosaic Edits (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (e.shiftKey && !['z', '0', '1'].includes(k)) return;
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
      if (k === 'u') {
        e.preventDefault();
        StudioState.brushSnapToBlock = !StudioState.brushSnapToBlock;
        const N = StudioState.mosaicData ? StudioState.mosaicData.subtilesPerSide : 4;
        let currentDim = StudioState.brushSizeMode === 'block' ? N : (parseInt(StudioState.brushSizeMode, 10) || 1);
        if (StudioState.brushSnapToBlock) {
          const snappedDim = Math.max(1, Math.round(currentDim / N)) * N;
          setBrushSizeMode(String(snappedDim), true);
          const blocks = snappedDim / N;
          showEditorToast(`Ajuste ao Bloco: Ativado • Pincel ${blocks}×${blocks} blocos (Ctrl+U)`);
        } else {
          showEditorToast(`Ajuste ao Bloco: Desativado • Modo Subtile Livre (Ctrl+U)`);
          syncEditWorkspaceUI();
          redraw();
        }
        saveStudioStateToStorage();
        return;
      }
      return;
    }

    if (e.code === 'Space') {
      cancelToolGesture();
      StudioState.isSpaceDown = true;
      syncCanvasCursor();
      pasteboard?.classList.add('panning');
      e.preventDefault();
      return;
    }

    const k = e.key.toLowerCase();
    if (e.shiftKey && /^[a-z]$/.test(k) && !['b', 'f', 'q'].includes(k)) return;
    const isEditTool = StudioState.activeTool === 'paint' ||
      ['rotate','mirror'].includes(StudioState.activeTool) ||
      StudioState.activeTool === 'stamp' ||
      StudioState.activeTool === 'freeze';

    if (isEditTool && !e.altKey && (e.key === '+' || e.key === '=' || e.key === '-')) {
      e.preventDefault();
      cycleActiveToolSize(e.key === '-' ? -1 : 1);
      return;
    }

    const stage = document.getElementById('canvas-stage');
    if (e.key === 'Tab') {
      if (e.target === stage && isEditTool) {
        e.preventDefault(); cycleEditScope(e.shiftKey ? -1 : 1);
      }
      return;
    }
    if (e.key === 'Escape' && e.target === stage) {
      e.preventDefault(); cancelToolGesture();
      if (StudioState.activeTool === 'stamp') cancelCloneCapture();
      document.querySelector('#left-toolbar [data-tool="' + StudioState.activeTool + '"]')?.focus();
      return;
    }

    if (e.key === 'Escape' && StudioState.activeTool === 'stamp' &&
        (StudioState.isSelectingStampDrag || StudioState.stampInteractionMode === 'select')) {
      e.preventDefault(); cancelCloneCapture(); return;
    }

    if (k === 'q') {
      e.preventDefault();
      cycleEditScope(e.shiftKey ? -1 : 1);
      return;
    }

    if (StudioState.activeTool === 'freeze' && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      clearFrozenCells();
      return;
    }

    if (k === 'g') {
      e.preventDefault();
      triggerRandomSeed();
    } else if (k === 'e') {
      e.preventDefault(); activateEraser();
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
    } else if (k === 'c') {
      e.preventDefault();
      beginCloneCapture();
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
    } else if (e.key === 'ArrowLeft' && e.target === stage && StudioState.activeTool === 'inspect') {
      restoreGenerationHistory(StudioState.historyIndex - 1);
    } else if (e.key === 'ArrowRight' && e.target === stage && StudioState.activeTool === 'inspect') {
      restoreGenerationHistory(StudioState.historyIndex + 1);
    }
  });

  window.addEventListener('keyup', (e) => {
    StudioState.isShiftDown = Boolean(e.shiftKey);
    StudioState.isAltDown = Boolean(e.altKey);
    if (e.key === 'Alt') {
      StudioState.isAltDown = false;
    }
    if (e.key === 'Shift') {
      StudioState.isShiftDown = false;
      redraw();
    }
    if (e.code === 'Space') {
      StudioState.isSpaceDown = false;
      if (StudioState.activeTool !== 'pan') {
        pasteboard?.classList.remove('panning');
      }
      redraw();
    }
  });
}

if (typeof window.addEventListener === 'function') {
  window.addEventListener('keyup', syncCanvasCursor);
  window.addEventListener('blur', () => {
    cancelToolGesture();
    StudioState.isPanning = false;
    StudioState.isSpaceDown = false;
    StudioState.isAltDown = false;
    StudioState.isShiftDown = false;
    document.body.classList.remove('is-panning');
    document.getElementById('artboard-pasteboard')?.classList.remove('panning');
    syncCanvasCursor();
    redraw();
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
window.selectBrushTile = selectBrushTile;
window.isEffectiveBrushSnap = isEffectiveBrushSnap;
window.setBrushSizeMode = setBrushSizeMode;
window.cycleEditScope = cycleEditScope;

window.activateStudioTool = activateStudioTool;
window.activateEraser = activateEraser;
window.cancelToolGesture = cancelToolGesture;
window.beginCloneCapture = beginCloneCapture;
window.cancelCloneCapture = cancelCloneCapture;

window.startCanvasRegionCaptureDrag = startCanvasRegionCaptureDrag;
window.updateCaptureDragBounds = updateCaptureDragBounds;

window.finishCanvasRegionCapture = finishCanvasRegionCapture;
window.syncCanvasCursor = syncCanvasCursor;

window.stepToolSizeFromWheel = stepToolSizeFromWheel;

window.collectBrushToolSessions = collectBrushToolSessions;
window.restoreBrushToolSessions = restoreBrushToolSessions;

window.openBrushEditor = openBrushEditor;
window.closeBrushEditor = closeBrushEditor;
window.resizeBrushEditorGrid = resizeBrushEditorGrid;
window.stepBrushEditorHistory = stepBrushEditorHistory;
window.handleMiniBuilderCanvasMouse = handleMiniBuilderCanvasMouse;

window.handleCanvasMouseDown = handleCanvasMouseDown;

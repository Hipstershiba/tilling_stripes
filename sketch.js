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

  // Active Tool & Guides ('inspect' | 'paint' | 'rotate' | 'stamp' | 'pan' | 'zoom')
  activeTool: 'inspect',
  isSpaceDown: false,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  scrollStartLeft: 0,
  scrollStartTop: 0,

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
  transformedThumbCache: new Map(),
  savedCellsSnapshot: null,

  // Generation History
  history: [],
  historyIndex: -1,
  isRestoringHistory: false
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

const STORAGE_KEY_STUDIO_STATE = 'tiling_stripes_studio_state_v2';

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


function saveStudioStateToStorage() {
  try {
    if (!StudioState.mosaicData) return;

    const cellsSnapshot = window.MosaicEngine.cloneMosaicCellsSnapshot(StudioState.mosaicData);
    const totalTiles = window.TileRegistry.TILE_RENDERERS.length;

    const payload = {
      version: 2,
      totalTiles,
      timestamp: Date.now(),
      // Artboard / Canvas
      width: StudioState.width,
      height: StudioState.height,
      lockCanvasRatio: StudioState.lockCanvasRatio,
      canvasRatio: StudioState.canvasRatio,
      zoomPercent: StudioState.zoomPercent,
      zoomMode: StudioState.zoomMode,

      // Grid & Structure
      rows: StudioState.rows,
      cols: StudioState.cols,
      lockGridRatio: StudioState.lockGridRatio,
      gridRatio: StudioState.gridRatio,
      margin: StudioState.margin,
      subdivision: StudioState.subdivision,
      paddingRatio: StudioState.paddingRatio,

      // Symmetry
      gridSymmetryMode: StudioState.gridSymmetryMode,
      blockSymmetryMode: StudioState.blockSymmetryMode,
      syncBlockSymmetry: StudioState.syncBlockSymmetry,

      // Colors
      fgColor: StudioState.fgColor,
      bgColor: StudioState.bgColor,

      // Seed & Allowed Tiles
      seed: StudioState.seed,
      allowedTiles: Array.from(StudioState.allowedTiles),

      // Workspace Context & Tool State
      workspace: StudioState.workspace,
      activeTool: StudioState.activeTool,
      editScope: StudioState.editScope,
      canvasCenterSymmetry: StudioState.canvasCenterSymmetry,
      editBrushTileId: StudioState.editBrushTileId,
      editBrushTransform: StudioState.editBrushTransform,
      brushSizeMode: StudioState.brushSizeMode,
      brushSnapToBlock: StudioState.brushSnapToBlock,
      supertilePattern: StudioState.supertilePattern,

      // Rotate Tool State
      rotateSizeMode: StudioState.rotateSizeMode,
      rotateSnapToBlock: StudioState.rotateSnapToBlock,
      rotateGroupMode: StudioState.rotateGroupMode,
      rotateBehavior: StudioState.rotateBehavior,

      // Clone / Stamp State
      stampInteractionMode: StudioState.stampInteractionMode,

      // Visual Guides
      guides: StudioState.guides,

      // The Exact Mosaic Data (All Painted / Rotated / Stamped Cells)
      cellsSnapshot,

      // Histories (Capped to preserve memory and storage)
      history: StudioState.history.slice(-30),
      historyIndex: StudioState.historyIndex,
      editHistory: StudioState.editHistory.slice(-25),
      editHistoryIndex: StudioState.editHistoryIndex
    };

    localStorage.setItem(STORAGE_KEY_STUDIO_STATE, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save StudioState to localStorage:', err);
  }
}

function loadStudioStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STUDIO_STATE);
    if (!raw) return false;

    const saved = JSON.parse(raw);
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

    // Guides
    if (saved.guides && typeof saved.guides === 'object') {
      StudioState.guides = Object.assign({}, StudioState.guides, saved.guides);
    }

    // Cells snapshot for mosaic reconstruction
    if (saved.cellsSnapshot && Array.isArray(saved.cellsSnapshot.gridSnap)) {
      StudioState.savedCellsSnapshot = saved.cellsSnapshot;
    }

    // Histories
    if (Array.isArray(saved.history) && saved.history.length > 0) {
      StudioState.history = saved.history;
      StudioState.historyIndex = typeof saved.historyIndex === 'number' ? saved.historyIndex : saved.history.length - 1;
    }

    if (Array.isArray(saved.editHistory) && saved.editHistory.length > 0) {
      StudioState.editHistory = saved.editHistory.filter((snap) => {
        return snap && snap.rows === StudioState.rows && snap.cols === StudioState.cols && Array.isArray(snap.gridSnap);
      });
      StudioState.editHistoryIndex = typeof saved.editHistoryIndex === 'number'
        ? Math.max(0, Math.min(StudioState.editHistory.length - 1, saved.editHistoryIndex))
        : StudioState.editHistory.length - 1;
    }

    return true;
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

  // 1. Generate canonical mosaic structure
  randomSeed(StudioState.seed);
  const allowedArray = Array.from(StudioState.allowedTiles).sort((a, b) => a - b);
  StudioState.mosaicData = window.MosaicEngine.generateMosaic(
    {
      rows: StudioState.rows,
      cols: StudioState.cols,
      subdivision: StudioState.subdivision,
      gridSymmetryMode: StudioState.gridSymmetryMode,
      blockSymmetryMode: StudioState.blockSymmetryMode,
      syncBlockSymmetry: StudioState.syncBlockSymmetry,
      allowedTiles: allowedArray
    },
    (arr) => arr[floor(random(arr.length))]
  );

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

  window.addEventListener('beforeunload', saveStudioStateToStorage);

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
  const isEditTool = StudioState.workspace === 'edit' && (
    StudioState.activeTool === 'paint' ||
    StudioState.activeTool === 'rotate' ||
    StudioState.activeTool === 'stamp'
  );
  window.MosaicEngine.renderGuidesAndOverlays(
    window,
    StudioState.mosaicData,
    layoutConfig,
    { ...StudioState.guides, isEditTool },
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

function regenerateMosaic(recordHistory = true) {
  randomSeed(StudioState.seed);

  const allowedArray = Array.from(StudioState.allowedTiles).sort((a, b) => a - b);

  StudioState.mosaicData = window.MosaicEngine.generateMosaic(
    {
      rows: StudioState.rows,
      cols: StudioState.cols,
      subdivision: StudioState.subdivision,
      gridSymmetryMode: StudioState.gridSymmetryMode,
      blockSymmetryMode: StudioState.blockSymmetryMode,
      syncBlockSymmetry: StudioState.syncBlockSymmetry,
      allowedTiles: allowedArray
    },
    (arr) => arr[floor(random(arr.length))]
  );

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

  resetEditHistoryWithInitialSnapshot();

  if (recordHistory && !StudioState.isRestoringHistory) {
    pushGenerationHistory();
  }

  saveStudioStateToStorage();

  syncSymmetryPanelUI();
  updateStatusBar();
  redraw();
}

function pushGenerationHistory() {
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
  if (StudioState.history.length > 35) {
    StudioState.history.shift();
  }
  StudioState.historyIndex = StudioState.history.length - 1;
  renderHistoryUI();
}

function restoreGenerationHistory(targetIndex) {
  if (targetIndex < 0 || targetIndex >= StudioState.history.length) return;
  const snap = StudioState.history[targetIndex];
  if (!snap) return;

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
    regenerateMosaic(false);
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
      <span>#${item.seed} • ${item.rows}×${item.cols} (${modeLabel})</span>
      <span style="font-size:10px;opacity:0.65;">${item.timestamp}</span>
    `;
    row.addEventListener('click', () => {
      restoreGenerationHistory(i);
      document.getElementById('seedHistoryPopover')?.classList.add('hidden');
      document.getElementById('btnToggleHistory')?.classList.remove('active');
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
        title: 'Mandala (D4)',
        sub: '8 octantes',
        icon: SYMMETRY_ICONS_SVG.mandala_d4
      },
      {
        key: 'rotational_c4',
        title: 'Rotacional (C4)',
        sub: 'Giro 90°',
        icon: SYMMETRY_ICONS_SVG.rotational_c4
      },
      {
        key: 'bilateral_d2',
        title: 'Bilateral (XY)',
        sub: 'Espelho X e Y',
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

  // Step 2: Block Internal Symmetry Pills active state
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

  applyZoomTransform();
}

function setZoomPercent(nextPercent) {
  StudioState.zoomPercent = Math.max(15, Math.min(400, Math.round(nextPercent)));
  StudioState.zoomMode = 'custom';
  applyZoomTransform();
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
      StudioState.activeTool === 'stamp';
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
  return window.MosaicEngine.applyStampPlacements(StudioState.mosaicData, placements);
}

function performBrushOrStampAtHit(hit) {
  if (!StudioState.mosaicData || !hit) return false;
  const activePattern = ensureSupertilePattern();
  const isMultiCell = activePattern.rows > 1 || activePattern.cols > 1;
  if (StudioState.editScope === 'same_tile' && isMultiCell) {
    showEditorToast('O escopo Iguais compara 1×1. Reduza o pincel para 1×1 ou use outro escopo.', 'warn');
    return false;
  }
  const { placements } = window.MosaicEngine.resolveStampRegionPlacements(
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
  return window.MosaicEngine.applyStampPlacements(StudioState.mosaicData, placements);
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
  if (e.altKey && e.button === 0) {
    e.preventDefault();
    if (StudioState.activeTool === 'inspect') {
      StudioState.activeTool = 'paint';
      StudioState.workspace = 'edit';
    }
    startCanvasRegionCaptureDrag(hit);
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

function resetEditHistoryWithInitialSnapshot() {
  if (!StudioState.mosaicData) return;
  const initialSnap = window.MosaicEngine.cloneMosaicCellsSnapshot(StudioState.mosaicData);
  StudioState.editHistory = initialSnap ? [initialSnap] : [];
  StudioState.editHistoryIndex = StudioState.editHistory.length - 1;
  syncEditUndoUI();
}

function pushEditHistorySnapshot() {
  if (!StudioState.mosaicData) return;
  const snap = window.MosaicEngine.cloneMosaicCellsSnapshot(StudioState.mosaicData);
  if (!snap) return;

  if (StudioState.editHistoryIndex < StudioState.editHistory.length - 1) {
    StudioState.editHistory = StudioState.editHistory.slice(0, StudioState.editHistoryIndex + 1);
  }

  StudioState.editHistory.push(snap);
  if (StudioState.editHistory.length > 50) {
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
  if (window.MosaicEngine.restoreMosaicCellsSnapshot(StudioState.mosaicData, snap)) {
    syncEditUndoUI();
    saveStudioStateToStorage();
    redraw();
  }
}

function redoMosaicEdit() {
  if (StudioState.editHistoryIndex >= StudioState.editHistory.length - 1) return;
  StudioState.editHistoryIndex++;
  const snap = StudioState.editHistory[StudioState.editHistoryIndex];
  if (window.MosaicEngine.restoreMosaicCellsSnapshot(StudioState.mosaicData, snap)) {
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

function getTransformedTileThumbDataURL(tileId, d4Key = 'id') {
  if (d4Key === 'id' && StudioState.thumbnailCache.has(tileId)) {
    return StudioState.thumbnailCache.get(tileId);
  }
  const cacheKey = `${tileId}_${d4Key}`;
  if (StudioState.transformedThumbCache.has(cacheKey)) {
    return StudioState.transformedThumbCache.get(cacheKey);
  }

  const renderer = window.TileRegistry.TILE_RENDERERS[tileId];
  if (!renderer) return '';

  const size = 64;
  const pad = size * 0.08;
  const gfx = createGraphics(size, size);
  gfx.pixelDensity(1);
  gfx.clear();
  gfx.push();
  gfx.translate(size / 2, size / 2);
  window.D4Symmetry.applyD4ToContext(gfx, d4Key);
  renderer(gfx, size, size, pad, color(230, 228, 224));
  gfx.pop();

  const url = gfx.canvas.toDataURL();
  gfx.remove();
  StudioState.transformedThumbCache.set(cacheKey, url);
  return url;
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

function syncEditWorkspaceUI() {
  document.body.dataset.activeTool = StudioState.activeTool;
  document.body.dataset.stampMode = StudioState.stampInteractionMode;

  // 1. Top-bar Workspace Switcher ('generate' vs 'edit')
  document.querySelectorAll('#workspaceSwitcher .ws-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.workspace === StudioState.workspace);
  });

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

  const scope = window.MosaicEngine.EDIT_SCOPES[StudioState.editScope];
  const hintEl = document.getElementById('editScopeHint');
  if (hintEl) {
    hintEl.textContent = scope ? `${scope.name} — ${scope.description}` : '';
  }

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
  document.getElementById('btnRotateSnapBlock')?.classList.toggle(
    'active',
    Boolean(StudioState.rotateSnapToBlock || StudioState.rotateSizeMode === 'block')
  );
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
  document.getElementById('btnBrushSnapBlock')?.classList.toggle('active', Boolean(StudioState.brushSnapToBlock));

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

  el.innerHTML =
    `Bloco <strong>[L${hit.row + 1}, C${hit.col + 1}]</strong> • ` +
    `Órbita <strong>#${block.orbitId}</strong> • ` +
    `Giro/Espelho: <strong>${d4Meta.label} (${d4Meta.arrow})</strong> • ` +
    `Subtile [${hit.subRow + 1},${hit.subCol + 1}]: <strong>#${subCell ? subCell.tileId : '-'} ${tileName}</strong>`;
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
  setVal('paddingSlider', Math.round(StudioState.paddingRatio * 100));
  setVal('fgColorPicker', StudioState.fgColor);
  setVal('bgColorPicker', StudioState.bgColor);

  const padLbl = document.getElementById('paddingValueLabel');
  if (padLbl) padLbl.textContent = `${Math.round(StudioState.paddingRatio * 100)}%`;

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
    saveStudioStateToStorage();
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
    const left = Math.max(8, Math.min(window.innerWidth - popWidth - 8, rect.right - popWidth));
    seedPopover.style.top = `${Math.round(rect.bottom + 6)}px`;
    seedPopover.style.left = `${Math.round(left)}px`;
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
    if (!seedPopover) return;
    const willOpen = seedPopover.classList.contains('hidden');
    if (willOpen) {
      positionSeedPopover();
      seedPopover.classList.remove('hidden');
      btnToggleHistory.classList.add('active');
    } else {
      seedPopover.classList.add('hidden');
      btnToggleHistory.classList.remove('active');
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
  document.querySelectorAll('.panel-header').forEach((header) => {
    header.addEventListener('click', () => {
      header.closest('.dock-panel')?.classList.toggle('collapsed');
    });
  });

  document.querySelectorAll('#subdivisionControl .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      StudioState.subdivision = parseInt(btn.dataset.sub, 10) || 2;
      regenerateMosaic(true);
    });
  });

  const paddingSlider = document.getElementById('paddingSlider');
  const paddingLabel = document.getElementById('paddingValueLabel');
  paddingSlider?.addEventListener('input', () => {
    const pct = parseInt(paddingSlider.value, 10) || 0;
    StudioState.paddingRatio = pct / 100;
    if (paddingLabel) paddingLabel.textContent = `${pct}%`;
    renderSupertileBuilderCanvas();
    redraw();
  });

  const fgPicker = document.getElementById('fgColorPicker');
  const bgPicker = document.getElementById('bgColorPicker');
  fgPicker?.addEventListener('input', () => {
    StudioState.fgColor = fgPicker.value;
    renderSupertileBuilderCanvas();
    saveStudioStateToStorage();
    redraw();
  });
  bgPicker?.addEventListener('input', () => {
    StudioState.bgColor = bgPicker.value;
    renderSupertileBuilderCanvas();
    saveStudioStateToStorage();
    redraw();
  });
  document.getElementById('btnSwapColors')?.addEventListener('click', () => {
    const tmp = StudioState.fgColor;
    StudioState.fgColor = StudioState.bgColor;
    StudioState.bgColor = tmp;
    if (fgPicker) fgPicker.value = StudioState.fgColor;
    if (bgPicker) bgPicker.value = StudioState.bgColor;
    renderSupertileBuilderCanvas();
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
    StudioState.activeTool = tool;
    if (tool === 'paint' || tool === 'rotate' || tool === 'stamp') {
      StudioState.workspace = 'edit';
    }
    const pasteboard = document.getElementById('artboard-pasteboard');
    if (pasteboard) {
      pasteboard.classList.toggle('panning', tool === 'pan' || StudioState.isSpaceDown);
    }
    syncEditWorkspaceUI();
    saveStudioStateToStorage();
    redraw();
  };

  const setWorkspaceMode = (mode) => {
    StudioState.workspace = mode === 'edit' ? 'edit' : 'generate';
    if (StudioState.workspace === 'edit') {
      const isEditTool = StudioState.activeTool === 'paint' ||
        StudioState.activeTool === 'rotate' ||
        StudioState.activeTool === 'stamp';
      if (!isEditTool) {
        StudioState.activeTool = 'paint';
      }
    } else {
      const isEditTool = StudioState.activeTool === 'paint' ||
        StudioState.activeTool === 'rotate' ||
        StudioState.activeTool === 'stamp';
      if (isEditTool) {
        StudioState.activeTool = 'inspect';
      }
    }
    syncEditWorkspaceUI();
    saveStudioStateToStorage();
    redraw();
  };

  document.querySelectorAll('#workspaceSwitcher .ws-mode-btn[data-workspace]').forEach((btn) => {
    btn.addEventListener('click', () => setWorkspaceMode(btn.dataset.workspace));
  });

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
      if (sz === 'block') {
        StudioState.rotateSnapToBlock = true;
      }
      syncEditWorkspaceUI();
      saveStudioStateToStorage();
      redraw();
    });
  });

  document.getElementById('btnRotateSnapBlock')?.addEventListener('click', () => {
    StudioState.rotateSnapToBlock = !StudioState.rotateSnapToBlock;
    syncEditWorkspaceUI();
    saveStudioStateToStorage();
    redraw();
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

  document.getElementById('btnBrushSnapBlock')?.addEventListener('click', () => {
    StudioState.brushSnapToBlock = !StudioState.brushSnapToBlock;
    syncEditWorkspaceUI();
    saveStudioStateToStorage();
    redraw();
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
    btn.classList.toggle('active', !!StudioState.guides[guideKey]);
    btn.addEventListener('click', () => {
      StudioState.guides[guideKey] = !StudioState.guides[guideKey];
      btn.classList.toggle('active', StudioState.guides[guideKey]);
      saveStudioStateToStorage();
      redraw();
    });
  };

  bindGuideToggle('toggleGuideAxes', 'showSymmetryAxes');
  bindGuideToggle('toggleGuideBlocks', 'showBlockGrid');
  bindGuideToggle('toggleGuideSubtiles', 'showSubtileGrid');
  bindGuideToggle('toggleGuideOrbits', 'showOrbitBadges');

  document.getElementById('btnFitArtboard')?.addEventListener('click', fitArtboardToWindow);

  const btnToggleDock = document.getElementById('btnToggleRightDock');
  const toggleRightDock = () => {
    document.body.classList.toggle('right-dock-collapsed');
    btnToggleDock?.classList.toggle('active', !document.body.classList.contains('right-dock-collapsed'));
  };
  btnToggleDock?.addEventListener('click', toggleRightDock);

  // --- Zoom Status Controls & Canvas Wheel/Pan ---
  document.getElementById('btnZoomIn')?.addEventListener('click', () => setZoomPercent(StudioState.zoomPercent + 25));
  document.getElementById('btnZoomOut')?.addEventListener('click', () => setZoomPercent(StudioState.zoomPercent - 25));
  document.getElementById('btnZoomReset100')?.addEventListener('click', () => setZoomPercent(100));

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
    if (e.ctrlKey || e.metaKey || StudioState.activeTool === 'zoom') {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 15 : -15;
      setZoomPercent(StudioState.zoomPercent + delta);
    }
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
      StudioState.scrollStartLeft = pasteboard.scrollLeft;
      StudioState.scrollStartTop = pasteboard.scrollTop;
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!StudioState.isPanning || !pasteboard) return;
    pasteboard.scrollLeft = StudioState.scrollStartLeft - (e.clientX - StudioState.panStartX);
    pasteboard.scrollTop = StudioState.scrollStartTop - (e.clientY - StudioState.panStartY);
  });

  window.addEventListener('mouseup', () => {
    StudioState.isPanning = false;
    StudioState.isPaintingMiniBuilder = false;

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
      StudioState.activeTool === 'stamp';

    if (k === 'g') {
      e.preventDefault();
      triggerRandomSeed();
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
    } else if (k === '0') {
      fitArtboardToWindow();
    } else if (['1', '2', '3', '4', '5', '6'].includes(k) && isEditTool) {
      const scopeOrder = ['canvas_center', 'orbit_sym', 'block_sym', 'all_blocks', 'single', 'same_tile'];
      const idx = parseInt(k, 10) - 1;
      if (scopeOrder[idx]) {
        StudioState.editScope = scopeOrder[idx];
        syncEditWorkspaceUI();
        redraw();
      }
    } else if (k === '1' && !isEditTool) {
      setZoomPercent(100);
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


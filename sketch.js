/**
 * sketch.js
 * Main Studio Controller for Tiling Stripes v2 (Phase 1: Mosaic Generation & Illustrator UI).
 */

const StudioState = {
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

  // Active Tool & Guides
  activeTool: 'inspect', // 'inspect' | 'pan' | 'zoom'
  isSpaceDown: false,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  scrollStartLeft: 0,
  scrollStartTop: 0,

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

// ============================================================================
// p5.js Lifecycle
// ============================================================================

function setup() {
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  const cnv = createCanvas(StudioState.width, StudioState.height);
  cnv.parent('canvas-stage');

  // Prevent right-click menu on canvas
  cnv.elt.addEventListener('contextmenu', (e) => e.preventDefault());

  // Enable all 45 built-in tiles initially
  const totalTiles = window.TileRegistry.TILE_RENDERERS.length;
  for (let i = 0; i < totalTiles; i++) {
    StudioState.allowedTiles.add(i);
  }

  buildTileThumbnails();
  initStudioUI();
  regenerateMosaic(true);

  requestAnimationFrame(() => {
    syncZoomUI();
    updateStatusBar();
  });

  noLoop();
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
  window.MosaicEngine.renderGuidesAndOverlays(
    window,
    StudioState.mosaicData,
    layoutConfig,
    StudioState.guides,
    StudioState.hoveredCell
  );
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

  if (recordHistory && !StudioState.isRestoringHistory) {
    pushGenerationHistory();
  }

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
    StudioState.allowedTiles = new Set(snap.allowedTiles);

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
    renderers[id](gfx, size, size, pad, color(230, 228, 224));
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

  for (const fam of families) {
    const matchingTiles = fam.tileIds.filter((id) => {
      if (!query) return true;
      const tName = (tileNames[id] || '').toLowerCase();
      return fam.name.toLowerCase().includes(query) || tName.includes(query) || `#${id}` === query;
    });

    if (matchingTiles.length === 0) continue;

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
    if (StudioState.guides.highlightHoverOrbit) {
      redraw();
    }
  }
}

function updateHoverStatusText() {
  const el = document.getElementById('statusHoverInspector');
  if (!el) return;

  const hit = StudioState.hoveredCell;
  if (!hit || !StudioState.mosaicData) {
    el.textContent = 'Passe o cursor sobre o mosaico para inspecionar o bloco, sua órbita e rotação D4';
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
}

function initStudioUI() {
  buildSymmetryPanelUI();
  renderSwatchesPanel();
  syncAllInputsFromState();

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
      // Render clean PNG without guide overlays
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
    redraw();
  });

  const fgPicker = document.getElementById('fgColorPicker');
  const bgPicker = document.getElementById('bgColorPicker');
  fgPicker?.addEventListener('input', () => {
    StudioState.fgColor = fgPicker.value;
    redraw();
  });
  bgPicker?.addEventListener('input', () => {
    StudioState.bgColor = bgPicker.value;
    redraw();
  });
  document.getElementById('btnSwapColors')?.addEventListener('click', () => {
    const tmp = StudioState.fgColor;
    StudioState.fgColor = StudioState.bgColor;
    StudioState.bgColor = tmp;
    if (fgPicker) fgPicker.value = StudioState.fgColor;
    if (bgPicker) bgPicker.value = StudioState.bgColor;
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
    // Pick 2 to 5 random families
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

  // --- Left Toolbar & Guides ---
  const setActiveTool = (tool) => {
    StudioState.activeTool = tool;
    document.querySelectorAll('#left-toolbar .tool-btn[data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    const pasteboard = document.getElementById('artboard-pasteboard');
    if (pasteboard) {
      pasteboard.classList.toggle('panning', tool === 'pan' || StudioState.isSpaceDown);
    }
  };

  document.querySelectorAll('#left-toolbar .tool-btn[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
  });

  const bindGuideToggle = (btnId, guideKey) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.toggle('active', !!StudioState.guides[guideKey]);
    btn.addEventListener('click', () => {
      StudioState.guides[guideKey] = !StudioState.guides[guideKey];
      btn.classList.toggle('active', StudioState.guides[guideKey]);
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
  });

  // --- Illustrator Keyboard Shortcuts ---
  window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (e.key === 'Enter') e.target.blur();
      return;
    }

    if (e.code === 'Space') {
      StudioState.isSpaceDown = true;
      pasteboard?.classList.add('panning');
      e.preventDefault();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      toggleRightDock();
      return;
    }

    const k = e.key.toLowerCase();
    if (k === 'g') {
      e.preventDefault();
      triggerRandomSeed();
    } else if (k === 'v') {
      setActiveTool('inspect');
    } else if (k === 'h') {
      setActiveTool('pan');
    } else if (k === 'z') {
      setActiveTool('zoom');
    } else if (k === 'a') {
      document.getElementById('toggleGuideAxes')?.click();
    } else if (k === 'b') {
      document.getElementById('toggleGuideBlocks')?.click();
    } else if (k === 'm') {
      document.getElementById('toggleGuideSubtiles')?.click();
    } else if (k === 'o') {
      document.getElementById('toggleGuideOrbits')?.click();
    } else if (k === '0') {
      fitArtboardToWindow();
    } else if (k === '1') {
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
    }
  });
}

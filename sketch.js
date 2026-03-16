let subtiles = [];
let tiles = [];
let rows = 4;
let cols = 4;
let tilesWidth, tilesHeight;
let seed = 0;
let allowedTypes = []; 
let totalTileTypes = (typeof TILE_RENDERERS !== 'undefined') ? TILE_RENDERERS.length : 21;
let margin = 0;

let isCanvasLocked = false;
let isGridLocked = false;
let canvasRatio = 1;
let gridRatio = 1;
let canvasZoomPercent = 100;

// Interaction State
let interactionMode = 'none'; // 'none' (Setup tab) or 'edit' (Edit tab). Right-click temporarily rotates.
let editToolMode = 'edit'; // 'edit' (paint) or 'mirror' (rotate)
let interactionScope = 'single'; // 'single', 'global'
let currentPaintTile = 0;
let lastInteractedId = null; // Tracks the last tile modified during a drag operation
let hoverPreviewTargets = [];
let hoverPreviewAnchor = null;
let zoomToolActive = false;
let applyCanvasZoomHandler = null;
let fitCanvasZoomHandler = null;
let canvasZoomStep = 5;
let updateCanvasCursorHandler = null;

// History State
let generationHistory = [];
let generationIndex = -1;
let editHistory = [];
let editHistoryIndex = -1;
let isRestoringHistory = false; // Flag to prevent infinite loops during restore
let hasPendingHistory = false; // Tracks if a gesture modified the state
let tileThumbnailCache = new Map();

function getTileFamilies() {
  if (typeof window !== 'undefined' && Array.isArray(window.TILE_FAMILIES)) {
    return window.TILE_FAMILIES;
  }
  return [];
}

function syncTotalTileTypes() {
  if (typeof TILE_RENDERERS !== 'undefined' && Array.isArray(TILE_RENDERERS)) {
    totalTileTypes = TILE_RENDERERS.length;
  }
}

function isTileVisible(tileId) {
  return !(window.SVGTileManager && typeof window.SVGTileManager.isTileHidden === 'function' && window.SVGTileManager.isTileHidden(tileId));
}

function getUploadedTileMeta(tileId) {
  if (window.SVGTileManager && typeof window.SVGTileManager.getUploadedTileMeta === 'function') {
    return window.SVGTileManager.getUploadedTileMeta(tileId);
  }
  return null;
}

function resetTileThumbnailCache() {
  tileThumbnailCache = new Map();
}

function getTileThumbnailSrc(tileId, size = 72) {
  let uploaded = getUploadedTileMeta(tileId);
  if (uploaded && uploaded.thumbnailDataUrl) {
    return uploaded.thumbnailDataUrl;
  }

  let key = `${tileId}_${size}`;
  if (tileThumbnailCache.has(key)) return tileThumbnailCache.get(key);

  let gfx = createGraphics(size, size);
  let s = new Subtile(size, size, tileId);
  s.color = color(220);
  s.render(gfx, size / 2, size / 2);
  let dataUrl = gfx.canvas.toDataURL();
  gfx.remove();

  tileThumbnailCache.set(key, dataUrl);
  return dataUrl;
}

// Helper to find next family member
function getNextInFamily(currentType) {
  for (let family of getTileFamilies()) {
    let visibleFamily = family.filter(isTileVisible);
    let idx = visibleFamily.indexOf(currentType);
        if (idx !== -1) {
      return visibleFamily[(idx + 1) % visibleFamily.length];
        }
    }
    return currentType; // No family found
}

function setup() {
  // Update total types from registry
  syncTotalTileTypes();
  // Initial canvas creation
  let canvas = createCanvas(600, 600);
  canvas.parent('canvas-container');
  
  // Use existing seed from input if valid, otherwise random
  let seedInput = select('#seedInput');
  if (seedInput && seedInput.value() !== "") {
     let s = parseInt(seedInput.value());
     if (!isNaN(s)) {
        seed = s;
     } else {
        seed = floor(random(10000));
     }
  } else {
     seed = floor(random(10000));
  }
  
  // Initialize UI controls
  setupUI(canvas);

  // Populate tile selector
  generateTileThumbnails();

  // Refresh thumbnails when uploaded SVG image previews become available.
  window.onUploadedTileThumbnailReady = (tileId) => {
    resetTileThumbnailCache();
    rerenderTilesUsingType(tileId);
    generateTileThumbnails();
    refreshAssetsManagerUI();
  };

  // Setup custom SVG upload panel
  setupSvgUploadUI();

  // Select all by default
  selectAllTiles();

  // Initial grid generation
  initGrid();
}

function setAssetsManagerMode(active) {
  if (active) {
    document.body.classList.add('assets-focus');
  } else {
    document.body.classList.remove('assets-focus');
  }
}

function rebuildTileBuffer(tileObj) {
  if (!tileObj) return;
  tileObj.subtiles = [];
  if (tileObj.buffer) tileObj.buffer.remove();
  tileObj.buffer = createGraphics(tileObj.w, tileObj.h);
  tileObj.create_subtiles();
  tileObj.render_to_buffer();
}

function rerenderTilesUsingType(tileType) {
  if (!Number.isInteger(tileType)) return;
  if (!Array.isArray(tiles) || tiles.length === 0) return;

  let changed = false;
  for (let supertile of tiles) {
    if (!supertile || !Array.isArray(supertile.tiles)) continue;
    for (let tileObj of supertile.tiles) {
      if (Array.isArray(tileObj.types) && tileObj.types.includes(tileType)) {
        rebuildTileBuffer(tileObj);
        changed = true;
      }
    }
  }

  if (changed) redraw();
}

function setSvgStatus(message, tone = '') {
  let status = select('#svgUploadStatus');
  if (!status) return;
  status.removeClass('error');
  status.removeClass('success');
  if (tone) status.addClass(tone);
  status.html(message);
}

let assetsUiState = {
  selectedFamily: null,
  selectedFamilies: new Set(),
  familySelectionAnchor: null,
  dragFamilyLabel: null,
  dragOverFamilyLabel: null,
  dragOverFamilyPosition: null,
  selectedTileId: null,
  selectedTileIds: new Set(),
  tileSelectionAnchor: null,
  lastSelectionKind: null,
  dragTileId: null,
  dragOverTileId: null,
  dragOverPosition: null,
  editorTransform: {
    rotate: 0,
    flipX: false,
    flipY: false
  }
};

let assetsHistory = [];
let assetsHistoryIndex = -1;
let isRestoringAssetsHistory = false;

function canUseAssetsHistory() {
  return !!(window.SVGTileManager
    && typeof window.SVGTileManager.exportHistoryState === 'function'
    && typeof window.SVGTileManager.importHistoryState === 'function');
}

function updateAssetsHistoryUi() {
  let btnUndo = document.getElementById('btnAssetsUndo');
  let btnRedo = document.getElementById('btnAssetsRedo');
  let state = document.getElementById('assetsHistoryState');
  let total = assetsHistory.length;
  let current = assetsHistoryIndex + 1;

  if (btnUndo) {
    btnUndo.disabled = !canUseAssetsHistory() || total <= 1 || assetsHistoryIndex <= 0 || isRestoringAssetsHistory;
  }
  if (btnRedo) {
    btnRedo.disabled = !canUseAssetsHistory() || total <= 1 || assetsHistoryIndex >= total - 1 || isRestoringAssetsHistory;
  }
  if (state) {
    if (!canUseAssetsHistory() || total === 0) {
      state.textContent = 'Assets history: -';
    } else {
      state.textContent = `Assets history: ${current} / ${total}`;
    }
  }
}

function resetAssetsHistory() {
  assetsHistory = [];
  assetsHistoryIndex = -1;
  pushAssetsHistoryCheckpoint();
}

function pushAssetsHistoryCheckpoint() {
  if (isRestoringAssetsHistory) return false;
  if (!canUseAssetsHistory()) {
    updateAssetsHistoryUi();
    return false;
  }

  let snapshot = window.SVGTileManager.exportHistoryState();
  if (!snapshot) {
    updateAssetsHistoryUi();
    return false;
  }

  let encoded = JSON.stringify(snapshot);
  if (assetsHistoryIndex >= 0) {
    let last = assetsHistory[assetsHistoryIndex];
    if (last && last.encoded === encoded) {
      updateAssetsHistoryUi();
      return false;
    }
  }

  if (assetsHistoryIndex < assetsHistory.length - 1) {
    assetsHistory = assetsHistory.slice(0, assetsHistoryIndex + 1);
  }

  assetsHistory.push({ encoded, snapshot });

  const MAX_ASSETS_HISTORY = 80;
  if (assetsHistory.length > MAX_ASSETS_HISTORY) {
    assetsHistory = assetsHistory.slice(assetsHistory.length - MAX_ASSETS_HISTORY);
  }

  assetsHistoryIndex = assetsHistory.length - 1;
  updateAssetsHistoryUi();
  return true;
}

function restoreAssetsHistoryTo(targetIndex) {
  if (!canUseAssetsHistory()) return false;
  if (!Number.isInteger(targetIndex)) return false;
  if (targetIndex < 0 || targetIndex >= assetsHistory.length) return false;
  if (targetIndex === assetsHistoryIndex) return false;

  let entry = assetsHistory[targetIndex];
  if (!entry || !entry.snapshot) return false;

  isRestoringAssetsHistory = true;
  updateAssetsHistoryUi();

  try {
    window.SVGTileManager.importHistoryState(entry.snapshot);
    assetsHistoryIndex = targetIndex;
    refreshTileCatalogUI();
    setSvgStatus(`Assets history restored (${assetsHistoryIndex + 1}/${assetsHistory.length}).`, 'success');
    return true;
  } catch (err) {
    setSvgStatus(`Assets undo/redo failed: ${err.message || err}`, 'error');
    return false;
  } finally {
    isRestoringAssetsHistory = false;
    updateAssetsHistoryUi();
  }
}

function listUploadedTiles() {
  if (window.SVGTileManager && typeof window.SVGTileManager.listUploadedSvgTiles === 'function') {
    return window.SVGTileManager.listUploadedSvgTiles();
  }
  return [];
}

function getFamilySummaryForManager() {
  let summary = (typeof window.getTileFamilySummary === 'function')
    ? window.getTileFamilySummary()
    : [];
  return summary
    .map((item) => ({
      label: item.label,
      tileIds: (item.tileIds || []).filter(isTileVisible)
    }));
}

function updateAssetUploadTargetLabel() {
  let label = document.getElementById('assetUploadFamilyTarget');
  let renameInput = document.getElementById('assetRenameFamilyInput');
  if (!label) return;

  let selectedFamilies = getSelectedFamilyLabels();
  if (selectedFamilies.length > 1) {
    label.textContent = `Selected families: ${selectedFamilies.length} (active: ${assetsUiState.selectedFamily || 'none'})`;
    if (renameInput) {
      renameInput.value = assetsUiState.selectedFamily || '';
      renameInput.placeholder = 'Rename active family';
    }
    return;
  }

  if (!assetsUiState.selectedFamily) {
    label.textContent = 'Selected family: none';
    if (renameInput) {
      renameInput.value = '';
      renameInput.placeholder = 'Rename selected family';
    }
    return;
  }
  label.textContent = `Selected family: ${assetsUiState.selectedFamily}`;
  if (renameInput) {
    renameInput.value = assetsUiState.selectedFamily;
  }
}

function getTileNameById(tileId) {
  if (typeof TILE_NAMES !== 'undefined' && TILE_NAMES[tileId]) {
    return TILE_NAMES[tileId];
  }
  return `Tile ${tileId}`;
}

function getSelectedFamilyTiles() {
  let summary = getFamilySummaryForManager();
  if (!assetsUiState.selectedFamily) return [];
  let match = summary.find((row) => row.label === assetsUiState.selectedFamily);
  return match ? match.tileIds.slice() : [];
}

function getSelectedFamilyLabels() {
  let labels = [...assetsUiState.selectedFamilies];
  if (labels.length > 0) return labels;
  return assetsUiState.selectedFamily ? [assetsUiState.selectedFamily] : [];
}

function canReorderSelectedFamiliesByDirection(direction) {
  let labels = getFamilySummaryForManager().map((item) => item.label);
  let selected = new Set(getSelectedFamilyLabels());
  if (selected.size === 0) return false;

  if (direction < 0) {
    for (let i = 1; i < labels.length; i++) {
      if (selected.has(labels[i]) && !selected.has(labels[i - 1])) return true;
    }
    return false;
  }

  for (let i = 0; i < labels.length - 1; i++) {
    if (selected.has(labels[i]) && !selected.has(labels[i + 1])) return true;
  }
  return false;
}

function reorderSelectedFamiliesBulkByDirection(direction) {
  if (typeof window.moveFamilyRelative !== 'function') return false;

  let selectedLabels = getSelectedFamilyLabels();
  if (selectedLabels.length === 0) return false;

  let selectedSet = new Set(selectedLabels);
  let order = getFamilySummaryForManager().map((item) => item.label);
  let moved = false;

  if (direction < 0) {
    for (let i = 1; i < order.length; i++) {
      let current = order[i];
      let prev = order[i - 1];
      if (!selectedSet.has(current) || selectedSet.has(prev)) continue;
      window.moveFamilyRelative(current, prev, false);
      order[i - 1] = current;
      order[i] = prev;
      moved = true;
    }
  } else {
    for (let i = order.length - 2; i >= 0; i--) {
      let current = order[i];
      let next = order[i + 1];
      if (!selectedSet.has(current) || selectedSet.has(next)) continue;
      window.moveFamilyRelative(current, next, true);
      order[i] = next;
      order[i + 1] = current;
      moved = true;
    }
  }

  if (!moved) return false;

  assetsUiState.selectedFamilies = new Set(selectedLabels);
  if (!assetsUiState.selectedFamily || !assetsUiState.selectedFamilies.has(assetsUiState.selectedFamily)) {
    assetsUiState.selectedFamily = selectedLabels[0] || null;
  }
  assetsUiState.familySelectionAnchor = assetsUiState.selectedFamily;
  refreshAssetsManagerUI();
  pushAssetsHistoryCheckpoint();
  setSvgStatus(`Family order updated for ${selectedLabels.length} family(s).`, 'success');
  return true;
}

function canMoveSelectedFamiliesToTop() {
  let labels = getFamilySummaryForManager().map((item) => item.label);
  let selectedSet = new Set(getSelectedFamilyLabels());
  if (selectedSet.size === 0) return false;

  for (let i = 0; i < labels.length; i++) {
    if (selectedSet.has(labels[i])) continue;
    for (let j = i + 1; j < labels.length; j++) {
      if (selectedSet.has(labels[j])) return true;
    }
    return false;
  }

  return false;
}

function moveSelectedFamiliesToTop() {
  let currentOrder = getFamilySummaryForManager().map((item) => item.label);
  if (currentOrder.length === 0) return false;

  let selectedLabels = getSelectedFamilyLabels();
  if (selectedLabels.length === 0) return false;

  let selectedSet = new Set(selectedLabels);
  let selectedOrder = currentOrder.filter((label) => selectedSet.has(label));
  let remaining = currentOrder.filter((label) => !selectedSet.has(label));
  let nextOrder = selectedOrder.concat(remaining);

  let unchanged = nextOrder.length === currentOrder.length && nextOrder.every((label, idx) => label === currentOrder[idx]);
  if (unchanged) return false;
  if (!applyFamilyOrder(nextOrder)) return false;

  assetsUiState.selectedFamilies = new Set(selectedOrder);
  assetsUiState.selectedFamily = selectedOrder[0] || null;
  assetsUiState.familySelectionAnchor = assetsUiState.selectedFamily;
  refreshAssetsManagerUI();
  pushAssetsHistoryCheckpoint();
  setSvgStatus(`Moved ${selectedOrder.length} family(s) to top.`, 'success');
  return true;
}

function canMoveSelectedFamiliesToBottom() {
  let labels = getFamilySummaryForManager().map((item) => item.label);
  let selectedSet = new Set(getSelectedFamilyLabels());
  if (selectedSet.size === 0) return false;

  for (let i = labels.length - 1; i >= 0; i--) {
    if (selectedSet.has(labels[i])) continue;
    for (let j = i - 1; j >= 0; j--) {
      if (selectedSet.has(labels[j])) return true;
    }
    return false;
  }

  return false;
}

function moveSelectedFamiliesToBottom() {
  let currentOrder = getFamilySummaryForManager().map((item) => item.label);
  if (currentOrder.length === 0) return false;

  let selectedLabels = getSelectedFamilyLabels();
  if (selectedLabels.length === 0) return false;

  let selectedSet = new Set(selectedLabels);
  let selectedOrder = currentOrder.filter((label) => selectedSet.has(label));
  let remaining = currentOrder.filter((label) => !selectedSet.has(label));
  let nextOrder = remaining.concat(selectedOrder);

  let unchanged = nextOrder.length === currentOrder.length && nextOrder.every((label, idx) => label === currentOrder[idx]);
  if (unchanged) return false;
  if (!applyFamilyOrder(nextOrder)) return false;

  assetsUiState.selectedFamilies = new Set(selectedOrder);
  assetsUiState.selectedFamily = selectedOrder[0] || null;
  assetsUiState.familySelectionAnchor = assetsUiState.selectedFamily;
  refreshAssetsManagerUI();
  pushAssetsHistoryCheckpoint();
  setSvgStatus(`Moved ${selectedOrder.length} family(s) to bottom.`, 'success');
  return true;
}

function applyFamilyOrder(orderedFamilyLabels) {
  if (!Array.isArray(orderedFamilyLabels) || orderedFamilyLabels.length === 0) return false;
  if (typeof window.moveFamilyRelative !== 'function') return false;

  let anchor = orderedFamilyLabels[0];
  for (let i = 1; i < orderedFamilyLabels.length; i++) {
    let current = orderedFamilyLabels[i];
    window.moveFamilyRelative(current, anchor, true);
    anchor = current;
  }
  return true;
}

function reorderSelectedFamiliesBulkByDrop(sourceLabel, targetLabel, placeAfter) {
  if (typeof sourceLabel !== 'string' || sourceLabel.trim() === '') return false;
  if (typeof targetLabel !== 'string' || targetLabel.trim() === '') return false;
  if (sourceLabel === targetLabel) return false;

  let currentOrder = getFamilySummaryForManager().map((item) => item.label);
  if (currentOrder.length === 0) return false;

  let selectedLabels = getSelectedFamilyLabels();
  let selectedSet = new Set(selectedLabels);

  if (selectedLabels.length <= 1 || !selectedSet.has(sourceLabel)) {
    if (selectedSet.has(targetLabel)) return false;
    if (typeof window.moveFamilyRelative !== 'function') return false;
    window.moveFamilyRelative(sourceLabel, targetLabel, !!placeAfter);
    assetsUiState.selectedFamilies = new Set([sourceLabel]);
    assetsUiState.selectedFamily = sourceLabel;
    assetsUiState.familySelectionAnchor = sourceLabel;
    refreshAssetsManagerUI();
    pushAssetsHistoryCheckpoint();
    setSvgStatus('Family order updated.', 'success');
    return true;
  }

  if (selectedSet.has(targetLabel)) return false;

  let selectedOrder = currentOrder.filter((label) => selectedSet.has(label));
  let remaining = currentOrder.filter((label) => !selectedSet.has(label));
  let targetIdx = remaining.indexOf(targetLabel);
  if (targetIdx === -1) return false;

  let insertAt = placeAfter ? targetIdx + 1 : targetIdx;
  if (insertAt < 0) insertAt = 0;
  if (insertAt > remaining.length) insertAt = remaining.length;

  let nextOrder = remaining.slice(0, insertAt).concat(selectedOrder, remaining.slice(insertAt));
  if (!applyFamilyOrder(nextOrder)) return false;

  assetsUiState.selectedFamilies = new Set(selectedOrder);
  assetsUiState.selectedFamily = selectedOrder[0] || null;
  assetsUiState.familySelectionAnchor = assetsUiState.selectedFamily;
  refreshAssetsManagerUI();
  pushAssetsHistoryCheckpoint();
  setSvgStatus(`Family order updated for ${selectedOrder.length} selected family(s).`, 'success');
  return true;
}

function clearFamilyDragState() {
  assetsUiState.dragFamilyLabel = null;
  assetsUiState.dragOverFamilyLabel = null;
  assetsUiState.dragOverFamilyPosition = null;
}

function getSelectedTileIdsInActiveFamily() {
  let familyTiles = new Set(getSelectedFamilyTiles());
  let selected = [...assetsUiState.selectedTileIds].filter((id) => familyTiles.has(id));
  if (selected.length > 0) return selected;
  if (Number.isInteger(assetsUiState.selectedTileId) && familyTiles.has(assetsUiState.selectedTileId)) {
    return [assetsUiState.selectedTileId];
  }
  return [];
}

function isMultiSelectInputEvent(evt) {
  return !!(evt && (evt.ctrlKey || evt.metaKey));
}

function reorderSelectedFamilyTileByDirection(direction) {
  if (getSelectedTileIdsInActiveFamily().length > 1) return false;
  if (!Number.isInteger(assetsUiState.selectedTileId)) return false;
  if (typeof assetsUiState.selectedFamily !== 'string' || assetsUiState.selectedFamily.trim() === '') return false;
  if (typeof window.moveTileRelativeInFamily !== 'function') return false;

  let tileIds = getSelectedFamilyTiles();
  let currentIdx = tileIds.indexOf(assetsUiState.selectedTileId);
  if (currentIdx === -1) return false;

  let targetIdx = currentIdx + (direction > 0 ? 1 : -1);
  if (targetIdx < 0 || targetIdx >= tileIds.length) return false;

  let referenceTileId = tileIds[targetIdx];
  let placeAfter = direction > 0;

  window.moveTileRelativeInFamily(
    assetsUiState.selectedTileId,
    assetsUiState.selectedFamily,
    referenceTileId,
    placeAfter
  );

  refreshTileCatalogUI([assetsUiState.selectedTileId]);
  pushAssetsHistoryCheckpoint();
  setSvgStatus(`Order updated in family "${assetsUiState.selectedFamily}".`, 'success');
  return true;
}

function canReorderSelectedTilesByDirection(direction) {
  let tileIds = getSelectedFamilyTiles();
  let selected = new Set(getSelectedTileIdsInActiveFamily());
  if (selected.size === 0) return false;

  if (direction < 0) {
    for (let i = 1; i < tileIds.length; i++) {
      if (selected.has(tileIds[i]) && !selected.has(tileIds[i - 1])) return true;
    }
    return false;
  }

  for (let i = 0; i < tileIds.length - 1; i++) {
    if (selected.has(tileIds[i]) && !selected.has(tileIds[i + 1])) return true;
  }
  return false;
}

function canMoveSelectedTilesToTop() {
  let tileIds = getSelectedFamilyTiles();
  let selectedSet = new Set(getSelectedTileIdsInActiveFamily());
  if (selectedSet.size === 0) return false;

  for (let i = 0; i < tileIds.length; i++) {
    if (selectedSet.has(tileIds[i])) continue;
    for (let j = i + 1; j < tileIds.length; j++) {
      if (selectedSet.has(tileIds[j])) return true;
    }
    return false;
  }

  return false;
}

function reorderSelectedTilesBulkByDirection(direction) {
  if (typeof assetsUiState.selectedFamily !== 'string' || assetsUiState.selectedFamily.trim() === '') return false;
  if (typeof window.moveTileRelativeInFamily !== 'function') return false;

  let selectedIds = getSelectedTileIdsInActiveFamily();
  if (selectedIds.length <= 1) {
    return reorderSelectedFamilyTileByDirection(direction);
  }

  let selectedSet = new Set(selectedIds);
  let order = getSelectedFamilyTiles();
  if (order.length === 0) return false;
  let moved = false;

  if (direction < 0) {
    for (let i = 1; i < order.length; i++) {
      let current = order[i];
      let prev = order[i - 1];
      if (!selectedSet.has(current) || selectedSet.has(prev)) continue;
      window.moveTileRelativeInFamily(current, assetsUiState.selectedFamily, prev, false);
      order[i - 1] = current;
      order[i] = prev;
      moved = true;
    }
  } else {
    for (let i = order.length - 2; i >= 0; i--) {
      let current = order[i];
      let next = order[i + 1];
      if (!selectedSet.has(current) || selectedSet.has(next)) continue;
      window.moveTileRelativeInFamily(current, assetsUiState.selectedFamily, next, true);
      order[i] = next;
      order[i + 1] = current;
      moved = true;
    }
  }

  if (!moved) return false;

  assetsUiState.selectedTileIds = new Set(selectedIds);
  refreshTileCatalogUI(selectedIds);
  pushAssetsHistoryCheckpoint();
  setSvgStatus(`Order updated for ${selectedIds.length} tile(s) in family "${assetsUiState.selectedFamily}".`, 'success');
  return true;
}

function reorderSelectedFamilyTileByDrop(sourceTileId, targetTileId, placeAfter) {
  if (!Number.isInteger(sourceTileId) || !Number.isInteger(targetTileId)) return false;
  if (sourceTileId === targetTileId) return false;
  if (typeof assetsUiState.selectedFamily !== 'string' || assetsUiState.selectedFamily.trim() === '') return false;
  if (typeof window.moveTileRelativeInFamily !== 'function') return false;

  window.moveTileRelativeInFamily(sourceTileId, assetsUiState.selectedFamily, targetTileId, !!placeAfter);
  assetsUiState.selectedTileId = sourceTileId;
  assetsUiState.selectedTileIds = new Set([sourceTileId]);
  assetsUiState.lastSelectionKind = 'tile';
  refreshTileCatalogUI([sourceTileId]);
  pushAssetsHistoryCheckpoint();
  setSvgStatus(`Order updated in family "${assetsUiState.selectedFamily}".`, 'success');
  return true;
}

function applyFamilyTileOrder(familyLabel, orderedTileIds) {
  if (typeof familyLabel !== 'string' || familyLabel.trim() === '') return false;
  if (!Array.isArray(orderedTileIds) || orderedTileIds.length === 0) return false;
  if (typeof window.moveTileRelativeInFamily !== 'function') return false;

  let anchor = orderedTileIds[0];
  for (let i = 1; i < orderedTileIds.length; i++) {
    let current = orderedTileIds[i];
    window.moveTileRelativeInFamily(current, familyLabel, anchor, true);
    anchor = current;
  }
  return true;
}

function reorderSelectedTilesBulkByDrop(sourceTileId, targetTileId, placeAfter) {
  if (!Number.isInteger(sourceTileId) || !Number.isInteger(targetTileId)) return false;
  if (typeof assetsUiState.selectedFamily !== 'string' || assetsUiState.selectedFamily.trim() === '') return false;

  let selectedIds = getSelectedTileIdsInActiveFamily();
  if (selectedIds.length <= 1) {
    return reorderSelectedFamilyTileByDrop(sourceTileId, targetTileId, placeAfter);
  }

  let selectedSet = new Set(selectedIds);
  if (!selectedSet.has(sourceTileId)) {
    return reorderSelectedFamilyTileByDrop(sourceTileId, targetTileId, placeAfter);
  }
  if (selectedSet.has(targetTileId)) return false;

  let familyOrder = getSelectedFamilyTiles();
  if (familyOrder.length === 0) return false;

  let selectedOrder = familyOrder.filter((id) => selectedSet.has(id));
  let remaining = familyOrder.filter((id) => !selectedSet.has(id));
  let targetIdx = remaining.indexOf(targetTileId);
  if (targetIdx === -1) return false;

  let insertAt = placeAfter ? targetIdx + 1 : targetIdx;
  if (insertAt < 0) insertAt = 0;
  if (insertAt > remaining.length) insertAt = remaining.length;

  let nextOrder = remaining.slice(0, insertAt).concat(selectedOrder, remaining.slice(insertAt));
  if (!applyFamilyTileOrder(assetsUiState.selectedFamily, nextOrder)) return false;

  assetsUiState.selectedTileIds = new Set(selectedOrder);
  assetsUiState.selectedTileId = selectedOrder[selectedOrder.length - 1] || assetsUiState.selectedTileId;
  assetsUiState.lastSelectionKind = 'tile';
  refreshTileCatalogUI(selectedOrder);
  pushAssetsHistoryCheckpoint();
  setSvgStatus(`Order updated for ${selectedOrder.length} selected tile(s).`, 'success');
  return true;
}

function moveSelectedTilesToTop() {
  if (typeof assetsUiState.selectedFamily !== 'string' || assetsUiState.selectedFamily.trim() === '') return false;

  let familyOrder = getSelectedFamilyTiles();
  if (familyOrder.length === 0) return false;

  let selectedIds = getSelectedTileIdsInActiveFamily();
  if (selectedIds.length === 0) return false;

  let selectedSet = new Set(selectedIds);
  let selectedOrder = familyOrder.filter((id) => selectedSet.has(id));
  let remaining = familyOrder.filter((id) => !selectedSet.has(id));
  let nextOrder = selectedOrder.concat(remaining);

  let unchanged = nextOrder.length === familyOrder.length && nextOrder.every((id, idx) => id === familyOrder[idx]);
  if (unchanged) return false;
  if (!applyFamilyTileOrder(assetsUiState.selectedFamily, nextOrder)) return false;

  assetsUiState.selectedTileIds = new Set(selectedOrder);
  assetsUiState.selectedTileId = selectedOrder[selectedOrder.length - 1] || assetsUiState.selectedTileId;
  assetsUiState.lastSelectionKind = 'tile';
  refreshTileCatalogUI(selectedOrder);
  pushAssetsHistoryCheckpoint();
  setSvgStatus(`Moved ${selectedOrder.length} tile(s) to the start of family "${assetsUiState.selectedFamily}".`, 'success');
  return true;
}

function canMoveSelectedTilesToBottom() {
  let tileIds = getSelectedFamilyTiles();
  let selectedSet = new Set(getSelectedTileIdsInActiveFamily());
  if (selectedSet.size === 0) return false;

  for (let i = tileIds.length - 1; i >= 0; i--) {
    if (selectedSet.has(tileIds[i])) continue;
    for (let j = i - 1; j >= 0; j--) {
      if (selectedSet.has(tileIds[j])) return true;
    }
    return false;
  }

  return false;
}

function moveSelectedTilesToBottom() {
  if (typeof assetsUiState.selectedFamily !== 'string' || assetsUiState.selectedFamily.trim() === '') return false;

  let familyOrder = getSelectedFamilyTiles();
  if (familyOrder.length === 0) return false;

  let selectedIds = getSelectedTileIdsInActiveFamily();
  if (selectedIds.length === 0) return false;

  let selectedSet = new Set(selectedIds);
  let selectedOrder = familyOrder.filter((id) => selectedSet.has(id));
  let remaining = familyOrder.filter((id) => !selectedSet.has(id));
  let nextOrder = remaining.concat(selectedOrder);

  let unchanged = nextOrder.length === familyOrder.length && nextOrder.every((id, idx) => id === familyOrder[idx]);
  if (unchanged) return false;
  if (!applyFamilyTileOrder(assetsUiState.selectedFamily, nextOrder)) return false;

  assetsUiState.selectedTileIds = new Set(selectedOrder);
  assetsUiState.selectedTileId = selectedOrder[selectedOrder.length - 1] || assetsUiState.selectedTileId;
  assetsUiState.lastSelectionKind = 'tile';
  refreshTileCatalogUI(selectedOrder);
  pushAssetsHistoryCheckpoint();
  setSvgStatus(`Moved ${selectedOrder.length} tile(s) to the end of family "${assetsUiState.selectedFamily}".`, 'success');
  return true;
}

function clearAssetDragState() {
  assetsUiState.dragTileId = null;
  assetsUiState.dragOverTileId = null;
  assetsUiState.dragOverPosition = null;
}

function getSelectedTileMeta() {
  if (!Number.isInteger(assetsUiState.selectedTileId)) return null;
  let tileId = assetsUiState.selectedTileId;
  let uploaded = getUploadedTileMeta(tileId);
  let summary = getFamilySummaryForManager();
  let familyLabel = 'unassigned';
  for (let item of summary) {
    if (item.tileIds.includes(tileId)) {
      familyLabel = item.label;
      break;
    }
  }

  return {
    tileId,
    name: getTileNameById(tileId),
    familyLabel,
    uploaded: uploaded || null
  };
}

function updateEditorTransformFromControls() {
  let rotate = Number(assetsUiState.editorTransform.rotate) || 0;
  rotate = ((Math.round(rotate / 90) * 90) % 360 + 360) % 360;
  assetsUiState.editorTransform = {
    rotate,
    flipX: !!assetsUiState.editorTransform.flipX,
    flipY: !!assetsUiState.editorTransform.flipY
  };
}

function toggleEditorMirrorAxis(axis) {
  let rotate = Number(assetsUiState.editorTransform.rotate) || 0;
  rotate = ((Math.round(rotate / 90) * 90) % 360 + 360) % 360;
  let quarterTurns = ((rotate / 90) % 4 + 4) % 4;
  let oddTurn = quarterTurns % 2 === 1;

  // Keep mirror buttons intuitive in screen space:
  // at 90/270deg, visual X/Y axes are swapped.
  if (axis === 'x') {
    if (oddTurn) {
      assetsUiState.editorTransform.flipY = !assetsUiState.editorTransform.flipY;
    } else {
      assetsUiState.editorTransform.flipX = !assetsUiState.editorTransform.flipX;
    }
    return;
  }

  if (axis === 'y') {
    if (oddTurn) {
      assetsUiState.editorTransform.flipX = !assetsUiState.editorTransform.flipX;
    } else {
      assetsUiState.editorTransform.flipY = !assetsUiState.editorTransform.flipY;
    }
  }
}

function getEditorVisualMirrorState() {
  let rotate = Number(assetsUiState.editorTransform.rotate) || 0;
  rotate = ((Math.round(rotate / 90) * 90) % 360 + 360) % 360;
  let quarterTurns = ((rotate / 90) % 4 + 4) % 4;
  let oddTurn = quarterTurns % 2 === 1;

  if (oddTurn) {
    return {
      mirrorXActive: !!assetsUiState.editorTransform.flipY,
      mirrorYActive: !!assetsUiState.editorTransform.flipX
    };
  }

  return {
    mirrorXActive: !!assetsUiState.editorTransform.flipX,
    mirrorYActive: !!assetsUiState.editorTransform.flipY
  };
}

function renderEditorToolbarState(canEditUploaded) {
  let btnMirrorX = document.getElementById('btnEditorMirrorX');
  let btnMirrorY = document.getElementById('btnEditorMirrorY');
  let btnRotateCW = document.getElementById('btnEditorRotateCW');
  let btnRotateCCW = document.getElementById('btnEditorRotateCCW');

  let visualState = getEditorVisualMirrorState();

  if (btnRotateCW) btnRotateCW.disabled = !canEditUploaded;
  if (btnRotateCCW) btnRotateCCW.disabled = !canEditUploaded;
  if (btnMirrorX) {
    btnMirrorX.disabled = !canEditUploaded;
    btnMirrorX.classList.toggle('active', visualState.mirrorXActive);
  }
  if (btnMirrorY) {
    btnMirrorY.disabled = !canEditUploaded;
    btnMirrorY.classList.toggle('active', visualState.mirrorYActive);
  }
}

function renderEditorPreview(tileMeta) {
  let preview = document.getElementById('assetEditorPreview');
  if (!preview || !tileMeta) return;

  if (!tileMeta.uploaded) {
    let transform = assetsUiState.editorTransform || { rotate: 0, flipX: false, flipY: false };
    let rotate = Number(transform.rotate) || 0;
    rotate = ((Math.round(rotate / 90) * 90) % 360 + 360) % 360;
    let scaleX = transform.flipX ? -1 : 1;
    let scaleY = transform.flipY ? -1 : 1;
    preview.style.transform = `rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`;
    preview.src = getTileThumbnailSrc(tileMeta.tileId, 96);
    return;
  }

  preview.style.transform = 'none';

  if (!window.SVGTileManager || typeof window.SVGTileManager.getTransformedTilePreview !== 'function') {
    preview.src = getTileThumbnailSrc(tileMeta.tileId, 96);
    return;
  }

  let transformed = window.SVGTileManager.getTransformedTilePreview(tileMeta.tileId, assetsUiState.editorTransform);
  preview.src = transformed || getTileThumbnailSrc(tileMeta.tileId, 96);
}

function ensureAssetSelection() {
  let summary = getFamilySummaryForManager();
  let validFamilies = new Set(summary.map((row) => row.label));

  if (!assetsUiState.selectedFamily || !validFamilies.has(assetsUiState.selectedFamily)) {
    assetsUiState.selectedFamily = summary.length > 0 ? summary[0].label : null;
  }
  if (!assetsUiState.familySelectionAnchor || !validFamilies.has(assetsUiState.familySelectionAnchor)) {
    assetsUiState.familySelectionAnchor = assetsUiState.selectedFamily;
  }

  let normalizedFamilySelection = new Set([...assetsUiState.selectedFamilies].filter((label) => validFamilies.has(label)));
  if (normalizedFamilySelection.size === 0 && assetsUiState.selectedFamily) {
    normalizedFamilySelection.add(assetsUiState.selectedFamily);
  }
  assetsUiState.selectedFamilies = normalizedFamilySelection;

  let visibleTiles = new Set(getSelectedFamilyTiles());
  if (!Number.isInteger(assetsUiState.selectedTileId) || !visibleTiles.has(assetsUiState.selectedTileId)) {
    assetsUiState.selectedTileId = visibleTiles.size > 0 ? [...visibleTiles][0] : null;
  }
  if (!Number.isInteger(assetsUiState.tileSelectionAnchor) || !visibleTiles.has(assetsUiState.tileSelectionAnchor)) {
    assetsUiState.tileSelectionAnchor = assetsUiState.selectedTileId;
  }

  let normalizedTileSelection = new Set([...assetsUiState.selectedTileIds].filter((id) => visibleTiles.has(id)));
  if (normalizedTileSelection.size === 0 && Number.isInteger(assetsUiState.selectedTileId) && visibleTiles.has(assetsUiState.selectedTileId)) {
    normalizedTileSelection.add(assetsUiState.selectedTileId);
  }
  assetsUiState.selectedTileIds = normalizedTileSelection;
}

function fillFamilySelect(selectEl, includeAll = false) {
  if (!selectEl) return;
  let previousValue = selectEl.value;
  let summary = getFamilySummaryForManager();
  selectEl.innerHTML = '';

  if (includeAll) {
    let allOpt = document.createElement('option');
    allOpt.value = '__all__';
    allOpt.textContent = 'All families';
    selectEl.appendChild(allOpt);
  }

  for (let item of summary) {
    let opt = document.createElement('option');
    opt.value = item.label;
    opt.textContent = `${item.label} (${item.tileIds.length})`;
    selectEl.appendChild(opt);
  }

  let fallback = includeAll ? '__all__' : (summary[0] ? summary[0].label : '');
  selectEl.value = Array.from(selectEl.options).some((op) => op.value === previousValue)
    ? previousValue
    : fallback;
}

function renderAssetFamilyList() {
  let familyList = document.getElementById('assetFamilyList');
  let btnRemoveFamily = document.getElementById('btnRemoveFamilyFromList');
  let btnMoveFamilyUp = document.getElementById('btnMoveFamilyOrderUp');
  let btnMoveFamilyDown = document.getElementById('btnMoveFamilyOrderDown');
  let btnMoveFamilyTop = document.getElementById('btnMoveFamilyOrderTop');
  let btnMoveFamilyBottom = document.getElementById('btnMoveFamilyOrderBottom');
  if (!familyList) return;

  let summary = getFamilySummaryForManager();
  let uploadedTiles = listUploadedTiles();
  let uploadedFamilySet = new Set(uploadedTiles.map((item) => item.familyLabel));
  familyList.innerHTML = '';

  if (summary.length === 0) {
    familyList.innerHTML = '<div class="status-text">No families available yet.</div>';
    if (btnRemoveFamily) btnRemoveFamily.textContent = 'Remove Selected Family';
    if (btnMoveFamilyUp) btnMoveFamilyUp.disabled = true;
    if (btnMoveFamilyDown) btnMoveFamilyDown.disabled = true;
    if (btnMoveFamilyTop) btnMoveFamilyTop.disabled = true;
    if (btnMoveFamilyBottom) btnMoveFamilyBottom.disabled = true;
    return;
  }

  if (!familyList.dataset.dndBound) {
    familyList.dataset.dndBound = '1';

    familyList.addEventListener('dragover', (e) => {
      if (!assetsUiState.dragFamilyLabel) return;

      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

      let rows = Array.from(familyList.querySelectorAll('.family-item'));
      if (rows.length === 0) return;

      let bestRow = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let rowEl of rows) {
        let rect = rowEl.getBoundingClientRect();
        let cx = rect.left + rect.width / 2;
        let cy = rect.top + rect.height / 2;
        let dx = cx - e.clientX;
        let dy = cy - e.clientY;
        let dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestRow = rowEl;
        }
      }

      if (!bestRow) return;

      let targetLabel = bestRow.dataset.familyLabel || '';
      if (!targetLabel) return;

      let selected = new Set(getSelectedFamilyLabels());
      if (selected.size > 1 && selected.has(targetLabel)) return;

      let rect = bestRow.getBoundingClientRect();
      let midpoint = rect.top + rect.height / 2;
      let placeAfter = e.clientY >= midpoint;

      if (assetsUiState.dragOverFamilyLabel !== targetLabel || assetsUiState.dragOverFamilyPosition !== (placeAfter ? 'after' : 'before')) {
        assetsUiState.dragOverFamilyLabel = targetLabel;
        assetsUiState.dragOverFamilyPosition = placeAfter ? 'after' : 'before';
        renderAssetFamilyList();
      }
    });

    familyList.addEventListener('drop', (e) => {
      if (!assetsUiState.dragFamilyLabel) return;
      e.preventDefault();

      let sourceLabel = assetsUiState.dragFamilyLabel;
      let targetLabel = assetsUiState.dragOverFamilyLabel;
      let placeAfter = assetsUiState.dragOverFamilyPosition === 'after';

      clearFamilyDragState();

      if (!targetLabel) {
        renderAssetFamilyList();
        return;
      }

      try {
        reorderSelectedFamiliesBulkByDrop(sourceLabel, targetLabel, placeAfter);
      } catch (err) {
        setSvgStatus(`Family move failed: ${err.message || err}`, 'error');
        renderAssetFamilyList();
      }
    });
  }

  let selectedFamilyCount = getSelectedFamilyLabels().length;
  if (btnRemoveFamily) {
    btnRemoveFamily.textContent = selectedFamilyCount > 1
      ? `Remove ${selectedFamilyCount} Families`
      : 'Remove Selected Family';
  }
  if (btnMoveFamilyUp) btnMoveFamilyUp.disabled = !canReorderSelectedFamiliesByDirection(-1);
  if (btnMoveFamilyDown) btnMoveFamilyDown.disabled = !canReorderSelectedFamiliesByDirection(1);
  if (btnMoveFamilyTop) btnMoveFamilyTop.disabled = !canMoveSelectedFamiliesToTop();
  if (btnMoveFamilyBottom) btnMoveFamilyBottom.disabled = !canMoveSelectedFamiliesToBottom();

  for (let item of summary) {
    let row = document.createElement('div');
    let isSelected = assetsUiState.selectedFamilies.has(item.label);
    let isPrimary = assetsUiState.selectedFamily === item.label;
    row.className = `family-item${isSelected ? ' active' : ''}${isPrimary ? ' primary' : ''}`;
    row.draggable = true;
    row.dataset.familyLabel = item.label;

    if (assetsUiState.dragOverFamilyLabel === item.label && assetsUiState.dragOverFamilyPosition === 'before') {
      row.classList.add('drag-over-before');
    }
    if (assetsUiState.dragOverFamilyLabel === item.label && assetsUiState.dragOverFamilyPosition === 'after') {
      row.classList.add('drag-over-after');
    }
    if (assetsUiState.dragFamilyLabel === item.label) {
      row.classList.add('dragging');
    }

    let main = document.createElement('div');
    main.className = 'family-item-main';
    main.innerHTML = `<div class="family-item-label">${item.label}</div><div class="family-item-meta">${item.tileIds.length} tile(s)</div>`;
    row.appendChild(main);

    let actions = document.createElement('div');
    actions.className = 'family-item-actions';

    let builtin = item.label.startsWith('builtin-');
    if (builtin) {
      let tag = document.createElement('button');
      tag.className = 'btn-accent';
      tag.disabled = true;
      tag.textContent = 'Built-in';
      actions.appendChild(tag);
    } else if (uploadedFamilySet.has(item.label)) {
      let tag = document.createElement('button');
      tag.className = 'btn-accent';
      tag.disabled = true;
      tag.textContent = 'Uploaded';
      actions.appendChild(tag);
    }

    if (actions.childNodes.length > 0) {
      row.appendChild(actions);
    }

    row.addEventListener('click', (evt) => {
      let isToggle = isMultiSelectInputEvent(evt);
      let isRange = !!evt.shiftKey;

      if (isRange) {
        let labels = summary.map((entry) => entry.label);
        let anchor = assetsUiState.familySelectionAnchor;
        if (!anchor || !labels.includes(anchor)) {
          anchor = item.label;
        }

        let anchorIdx = labels.indexOf(anchor);
        let currentIdx = labels.indexOf(item.label);
        let start = Math.min(anchorIdx, currentIdx);
        let end = Math.max(anchorIdx, currentIdx);
        let range = labels.slice(start, end + 1);

        if (isToggle) {
          for (let label of range) assetsUiState.selectedFamilies.add(label);
        } else {
          assetsUiState.selectedFamilies = new Set(range);
        }
      } else if (isToggle) {
        if (assetsUiState.selectedFamilies.has(item.label)) {
          assetsUiState.selectedFamilies.delete(item.label);
        } else {
          assetsUiState.selectedFamilies.add(item.label);
        }
      } else {
        assetsUiState.selectedFamilies = new Set([item.label]);
      }

      assetsUiState.selectedFamily = item.label;
  assetsUiState.familySelectionAnchor = item.label;
      ensureAssetSelection();
      assetsUiState.lastSelectionKind = 'family';
      updateAssetUploadTargetLabel();
      renderAssetFamilyList();
      renderAssetTileGrid();
      renderAssetInspector();
    });

    row.addEventListener('dragstart', (e) => {
      if (!assetsUiState.selectedFamilies.has(item.label)) {
        assetsUiState.selectedFamilies = new Set([item.label]);
        assetsUiState.selectedFamily = item.label;
        assetsUiState.familySelectionAnchor = item.label;
      }
      assetsUiState.dragFamilyLabel = item.label;
      assetsUiState.dragOverFamilyLabel = null;
      assetsUiState.dragOverFamilyPosition = null;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.label);
      }
      requestAnimationFrame(() => row.classList.add('dragging'));
    });

    row.addEventListener('dragover', (e) => {
      if (!assetsUiState.dragFamilyLabel) return;
      if (assetsUiState.dragFamilyLabel === item.label) return;

      let selected = new Set(getSelectedFamilyLabels());
      if (selected.size > 1 && selected.has(item.label)) return;

      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

      let rect = row.getBoundingClientRect();
      let midpoint = rect.top + rect.height / 2;
      let placeAfter = e.clientY >= midpoint;
      assetsUiState.dragOverFamilyLabel = item.label;
      assetsUiState.dragOverFamilyPosition = placeAfter ? 'after' : 'before';
      renderAssetFamilyList();
    });

    row.addEventListener('dragleave', () => {
      if (assetsUiState.dragOverFamilyLabel !== item.label) return;
      assetsUiState.dragOverFamilyLabel = null;
      assetsUiState.dragOverFamilyPosition = null;
      renderAssetFamilyList();
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();

      let sourceLabel = assetsUiState.dragFamilyLabel || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
      let placeAfter = assetsUiState.dragOverFamilyPosition === 'after';

      clearFamilyDragState();

      try {
        reorderSelectedFamiliesBulkByDrop(sourceLabel, item.label, placeAfter);
      } catch (err) {
        setSvgStatus(`Family move failed: ${err.message || err}`, 'error');
        renderAssetFamilyList();
      }
    });

    row.addEventListener('dragend', () => {
      clearFamilyDragState();
      renderAssetFamilyList();
    });

    familyList.appendChild(row);
  }
}

function renderAssetTileGrid() {
  let container = document.getElementById('assetTileGrid');
  if (!container) return;

  if (!container.dataset.dndBound) {
    container.dataset.dndBound = '1';

    container.addEventListener('dragover', (e) => {
      if (!Number.isInteger(assetsUiState.dragTileId)) return;

      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

      let cards = Array.from(container.querySelectorAll('.family-tile-card[data-tile-id]'));
      if (cards.length === 0) return;

      let bestCard = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let cardEl of cards) {
        let rect = cardEl.getBoundingClientRect();
        let cx = rect.left + rect.width / 2;
        let cy = rect.top + rect.height / 2;
        let dx = cx - e.clientX;
        let dy = cy - e.clientY;
        let dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestCard = cardEl;
        }
      }

      if (!bestCard) return;

      let targetTileId = Number.parseInt(bestCard.dataset.tileId || '', 10);
      if (!Number.isInteger(targetTileId)) return;

      let dragSelection = new Set(getSelectedTileIdsInActiveFamily());
      if (dragSelection.size > 1 && dragSelection.has(targetTileId)) return;

      let rect = bestCard.getBoundingClientRect();
      let midpoint = rect.left + rect.width / 2;
      let placeAfter = e.clientX >= midpoint;

      if (assetsUiState.dragOverTileId !== targetTileId || assetsUiState.dragOverPosition !== (placeAfter ? 'after' : 'before')) {
        assetsUiState.dragOverTileId = targetTileId;
        assetsUiState.dragOverPosition = placeAfter ? 'after' : 'before';
        renderAssetTileGrid();
      }
    });

    container.addEventListener('drop', (e) => {
      if (!Number.isInteger(assetsUiState.dragTileId)) return;
      e.preventDefault();

      let sourceTileId = assetsUiState.dragTileId;
      let targetTileId = assetsUiState.dragOverTileId;
      let placeAfter = assetsUiState.dragOverPosition === 'after';

      clearAssetDragState();

      if (!Number.isInteger(targetTileId)) {
        renderAssetTileGrid();
        return;
      }

      try {
        reorderSelectedTilesBulkByDrop(sourceTileId, targetTileId, placeAfter);
      } catch (err) {
        setSvgStatus(`Reorder failed: ${err.message || err}`, 'error');
        renderAssetTileGrid();
      }
    });
  }

  container.innerHTML = '';
  let tileIds = getSelectedFamilyTiles();

  if (typeof assetsUiState.selectedFamily === 'string' && assetsUiState.selectedFamily.trim() !== '') {
    let addCard = document.createElement('div');
    addCard.className = 'family-tile-card add-new';
    addCard.title = `Add SVG tile(s) to family "${assetsUiState.selectedFamily}"`;
    addCard.tabIndex = 0;

    let addIcon = document.createElement('div');
    addIcon.className = 'family-tile-add-icon';
    addIcon.textContent = '+';
    addCard.appendChild(addIcon);

    let addLabel = document.createElement('div');
    addLabel.className = 'family-tile-name';
    addLabel.textContent = 'Add SVG';
    addCard.appendChild(addLabel);

    let triggerUpload = () => {
      if (!assetsUiState.selectedFamily) {
        setSvgStatus('Select or create a family before uploading.', 'error');
        return;
      }
      let uploadInput = document.getElementById('svgUploadInput');
      if (!uploadInput) {
        setSvgStatus('Upload input not available.', 'error');
        return;
      }
      uploadInput.value = '';
      uploadInput.click();
    };

    addCard.addEventListener('click', triggerUpload);
    addCard.addEventListener('keydown', (evt) => {
      if (evt.key !== 'Enter' && evt.key !== ' ') return;
      evt.preventDefault();
      triggerUpload();
    });

    container.appendChild(addCard);
  }

  if (tileIds.length === 0) {
    let empty = document.createElement('div');
    empty.className = 'status-text';
    empty.textContent = 'No visible tiles in this family.';
    container.appendChild(empty);
    return;
  }

  for (let tileId of tileIds) {
    let card = document.createElement('div');
    let isSelected = assetsUiState.selectedTileIds.has(tileId);
    let isPrimary = assetsUiState.selectedTileId === tileId;
    card.className = `family-tile-card${isSelected ? ' active' : ''}${isPrimary ? ' primary' : ''}`;
    card.draggable = true;
    card.dataset.tileId = String(tileId);

    if (assetsUiState.dragOverTileId === tileId && assetsUiState.dragOverPosition === 'before') {
      card.classList.add('drag-over-before');
    }
    if (assetsUiState.dragOverTileId === tileId && assetsUiState.dragOverPosition === 'after') {
      card.classList.add('drag-over-after');
    }
    if (assetsUiState.dragTileId === tileId) {
      card.classList.add('dragging');
    }

    let img = document.createElement('img');
    img.src = getTileThumbnailSrc(tileId, 72);
    img.alt = getTileNameById(tileId);
    card.appendChild(img);

    let id = document.createElement('div');
    id.className = 'family-tile-id';
    id.textContent = `#${tileId}`;
    card.appendChild(id);

    let name = document.createElement('div');
    name.className = 'family-tile-name';
    name.textContent = getTileNameById(tileId);
    card.appendChild(name);

    card.addEventListener('click', (evt) => {
      let isToggle = isMultiSelectInputEvent(evt);
      let isRange = !!evt.shiftKey;

      if (isRange) {
        let anchor = assetsUiState.tileSelectionAnchor;
        if (!Number.isInteger(anchor) || !tileIds.includes(anchor)) {
          anchor = tileId;
        }

        let anchorIdx = tileIds.indexOf(anchor);
        let currentIdx = tileIds.indexOf(tileId);
        let start = Math.min(anchorIdx, currentIdx);
        let end = Math.max(anchorIdx, currentIdx);
        let range = tileIds.slice(start, end + 1);

        if (isToggle) {
          for (let id of range) assetsUiState.selectedTileIds.add(id);
        } else {
          assetsUiState.selectedTileIds = new Set(range);
        }
      } else if (isToggle) {
        if (assetsUiState.selectedTileIds.has(tileId)) {
          assetsUiState.selectedTileIds.delete(tileId);
        } else {
          assetsUiState.selectedTileIds.add(tileId);
        }
      } else {
        assetsUiState.selectedTileIds = new Set([tileId]);
      }

      assetsUiState.selectedTileId = tileId;
  assetsUiState.tileSelectionAnchor = tileId;
      assetsUiState.lastSelectionKind = 'tile';
      assetsUiState.editorTransform = { rotate: 0, flipX: false, flipY: false };
      renderAssetTileGrid();
      renderAssetInspector();
    });

    card.addEventListener('dragstart', (e) => {
      if (!assetsUiState.selectedTileIds.has(tileId)) {
        assetsUiState.selectedTileIds = new Set([tileId]);
        assetsUiState.selectedTileId = tileId;
        assetsUiState.tileSelectionAnchor = tileId;
      }
      assetsUiState.dragTileId = tileId;
      assetsUiState.dragOverTileId = null;
      assetsUiState.dragOverPosition = null;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(tileId));
      }
      requestAnimationFrame(() => {
        card.classList.add('dragging');
      });
    });

    card.addEventListener('dragover', (e) => {
      if (!Number.isInteger(assetsUiState.dragTileId)) return;
      if (assetsUiState.dragTileId === tileId) return;

      let dragSelection = new Set(getSelectedTileIdsInActiveFamily());
      if (dragSelection.size > 1 && dragSelection.has(tileId)) return;

      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

      let rect = card.getBoundingClientRect();
      let midpoint = rect.left + rect.width / 2;
      let placeAfter = e.clientX >= midpoint;
      assetsUiState.dragOverTileId = tileId;
      assetsUiState.dragOverPosition = placeAfter ? 'after' : 'before';
      renderAssetTileGrid();
    });

    card.addEventListener('dragleave', () => {
      if (assetsUiState.dragOverTileId !== tileId) return;
      assetsUiState.dragOverTileId = null;
      assetsUiState.dragOverPosition = null;
      renderAssetTileGrid();
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      let sourceTileId = Number.isInteger(assetsUiState.dragTileId)
        ? assetsUiState.dragTileId
        : Number.parseInt(e.dataTransfer?.getData('text/plain') || '', 10);
      let placeAfter = assetsUiState.dragOverPosition === 'after';

      clearAssetDragState();

      try {
        reorderSelectedTilesBulkByDrop(sourceTileId, tileId, placeAfter);
      } catch (err) {
        setSvgStatus(`Reorder failed: ${err.message || err}`, 'error');
        renderAssetTileGrid();
      }
    });

    card.addEventListener('dragend', () => {
      clearAssetDragState();
      renderAssetTileGrid();
    });

    container.appendChild(card);
  }
}

function renderAssetInspector() {
  let empty = document.getElementById('assetInspectorEmpty');
  let content = document.getElementById('assetInspectorContent');
  let selectedTileIds = getSelectedTileIdsInActiveFamily();
  let tileMeta = selectedTileIds.length > 0 ? getSelectedTileMeta() : null;
  let selectedCount = selectedTileIds.length;
  let hasMultiSelection = selectedCount > 1;

  if (!empty || !content) return;
  if (!tileMeta || selectedCount === 0) {
    empty.style.display = '';
    content.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  content.style.display = 'flex';

  let thumb = document.getElementById('assetInspectorThumb');
  let title = document.getElementById('assetInspectorTitle');
  let meta = document.getElementById('assetInspectorMeta');
  let tileNameInput = document.getElementById('assetTileNameInput');
  let btnRenameTile = document.getElementById('btnApplyTileRename');
  let moveFamilySelect = document.getElementById('assetMoveFamilySelect');
  let btnMoveTile = document.getElementById('btnMoveTileFamily');
  let btnCreateEdited = document.getElementById('btnCreateEditedTile');
  let btnRemoveTile = document.getElementById('btnRemoveSelectedTile');
  let btnOrderLeft = document.getElementById('btnMoveTileOrderLeft');
  let btnOrderRight = document.getElementById('btnMoveTileOrderRight');
  let btnOrderTop = document.getElementById('btnMoveTileOrderTop');
  let btnOrderBottom = document.getElementById('btnMoveTileOrderBottom');

  if (thumb) thumb.src = getTileThumbnailSrc(tileMeta.tileId, 72);
  if (title) {
    title.textContent = hasMultiSelection
      ? `${selectedCount} tiles selected`
      : `${tileMeta.name} (#${tileMeta.tileId})`;
  }
  if (meta) {
    if (hasMultiSelection) {
      meta.textContent = `Family: ${assetsUiState.selectedFamily}`;
    } else {
      let sourceLabel = tileMeta.uploaded ? 'Uploaded' : 'Built-in';
      meta.textContent = `${sourceLabel} | Family: ${tileMeta.familyLabel}`;
    }
  }

  if (tileNameInput) {
    tileNameInput.value = hasMultiSelection ? '' : tileMeta.name;
    tileNameInput.disabled = hasMultiSelection;
    tileNameInput.placeholder = hasMultiSelection ? 'Rename disabled for multi-select' : 'Tile name';
  }
  if (btnRenameTile) btnRenameTile.disabled = hasMultiSelection;

  fillFamilySelect(moveFamilySelect, false);
  if (moveFamilySelect && Array.from(moveFamilySelect.options).some((op) => op.value === tileMeta.familyLabel)) {
    moveFamilySelect.value = tileMeta.familyLabel;
  }

  let canEditUploaded = !!tileMeta.uploaded;
  let canEditInEditor = !hasMultiSelection;
  let familyTiles = getSelectedFamilyTiles();
  let selectedIdx = familyTiles.indexOf(tileMeta.tileId);
  if (btnCreateEdited) btnCreateEdited.disabled = !canEditInEditor;
  if (btnMoveTile) {
    btnMoveTile.textContent = hasMultiSelection ? `Move ${selectedCount} Tiles` : 'Move';
  }
  if (btnOrderLeft) {
    btnOrderLeft.disabled = hasMultiSelection
      ? !canReorderSelectedTilesByDirection(-1)
      : !(selectedIdx > 0);
  }
  if (btnOrderRight) {
    btnOrderRight.disabled = hasMultiSelection
      ? !canReorderSelectedTilesByDirection(1)
      : !(selectedIdx >= 0 && selectedIdx < familyTiles.length - 1);
  }
  if (btnOrderTop) {
    btnOrderTop.disabled = !canMoveSelectedTilesToTop();
  }
  if (btnOrderBottom) {
    btnOrderBottom.disabled = !canMoveSelectedTilesToBottom();
  }
  if (btnRemoveTile) {
    if (hasMultiSelection) {
      btnRemoveTile.textContent = 'Remove Selected Tiles';
    } else {
      btnRemoveTile.textContent = tileMeta.uploaded ? 'Remove Tile' : 'Delete Tile';
    }
  }

  updateEditorTransformFromControls();
  renderEditorToolbarState(canEditInEditor && canEditUploaded);
  renderEditorPreview(tileMeta);
}

function refreshAssetsManagerUI() {
  ensureAssetSelection();
  updateAssetUploadTargetLabel();

  // Keep Setup > Allowed Tiles in sync with current family/tile ordering.
  createAllowedTilesList();

  renderAssetFamilyList();
  renderAssetTileGrid();
  renderAssetInspector();
}

// Backward-compatible wrappers used in older call sites.
function refreshFamilyUI() {
  refreshAssetsManagerUI();
}

function refreshSvgLibraryUI() {
  refreshAssetsManagerUI();
}

function refreshFamilyTilesView() {
  refreshAssetsManagerUI();
}

function refreshTileCatalogUI(selectIds = []) {
  syncTotalTileTypes();
  resetTileThumbnailCache();

  let selectedSet = new Set(allowedTypes);
  for (let id of selectIds) {
    selectedSet.add(id);
  }

  allowedTypes = [...selectedSet].filter((id) => Number.isInteger(id) && id >= 0 && id < totalTileTypes && isTileVisible(id));
  generateTileThumbnails();
  refreshAssetsManagerUI();
  initGrid();
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsText(file);
  });
}

function setupSvgUploadUI() {
  let uploadInput = document.getElementById('svgUploadInput');
  let backupInput = document.getElementById('svgBackupImportInput');
  let btnAdd = document.getElementById('btnAddSvgTiles');
  let btnExportBackup = document.getElementById('btnExportSvgBackup');
  let btnImportBackup = document.getElementById('btnImportSvgBackup');
  let btnRestoreBuiltins = document.getElementById('btnRestoreBuiltins');
  let btnCreateFamily = document.getElementById('btnCreateFamily');
  let btnRenameFamilyFromList = document.getElementById('btnRenameFamilyFromList');
  let btnRemoveFamilyFromList = document.getElementById('btnRemoveFamilyFromList');
  let btnMoveFamilyOrderUp = document.getElementById('btnMoveFamilyOrderUp');
  let btnMoveFamilyOrderDown = document.getElementById('btnMoveFamilyOrderDown');
  let btnMoveFamilyOrderTop = document.getElementById('btnMoveFamilyOrderTop');
  let btnMoveFamilyOrderBottom = document.getElementById('btnMoveFamilyOrderBottom');
  let btnRenameTile = document.getElementById('btnApplyTileRename');
  let btnMoveTile = document.getElementById('btnMoveTileFamily');
  let btnMoveTileOrderLeft = document.getElementById('btnMoveTileOrderLeft');
  let btnMoveTileOrderRight = document.getElementById('btnMoveTileOrderRight');
  let btnMoveTileOrderTop = document.getElementById('btnMoveTileOrderTop');
  let btnMoveTileOrderBottom = document.getElementById('btnMoveTileOrderBottom');
  let btnAssetsUndo = document.getElementById('btnAssetsUndo');
  let btnAssetsRedo = document.getElementById('btnAssetsRedo');
  let backupScopeSelect = document.getElementById('assetBackupScope');
  let backupScopeHelp = document.getElementById('assetBackupScopeHelp');
  let inputCreateFamily = document.getElementById('assetCreateFamilyInput');
  let inputRenameFamily = document.getElementById('assetRenameFamilyInput');
  let inputRenameTile = document.getElementById('assetTileNameInput');
  let selectMoveFamily = document.getElementById('assetMoveFamilySelect');

  const getBackupScope = () => {
    let scope = backupScopeSelect && typeof backupScopeSelect.value === 'string'
      ? backupScopeSelect.value.trim().toLowerCase()
      : 'full';
    if (scope !== 'tiles' && scope !== 'layout' && scope !== 'full') return 'full';
    return scope;
  };

  const updateBackupScopeHelp = () => {
    if (!backupScopeHelp) return;
    let scope = getBackupScope();
    if (scope === 'tiles') {
      backupScopeHelp.textContent = 'Files Only: saves/restores imported SVG tiles. Families and visibility are not changed.';
      return;
    }
    if (scope === 'layout') {
      backupScopeHelp.textContent = 'Organization Only: saves/restores families, names, membership and visibility; no tile files are imported.';
      return;
    }
    backupScopeHelp.textContent = 'Full: saves/restores both imported tile files and organization (families, names, visibility).';
  };

  if (backupScopeSelect) {
    backupScopeSelect.addEventListener('change', updateBackupScopeHelp);
  }
  updateBackupScopeHelp();

  const bindEnterToButton = (fieldEl, buttonEl) => {
    if (!fieldEl || !buttonEl) return;
    fieldEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      buttonEl.click();
    });
  };

  bindEnterToButton(inputCreateFamily, btnCreateFamily);
  bindEnterToButton(inputRenameFamily, btnRenameFamilyFromList);
  bindEnterToButton(inputRenameTile, btnRenameTile);
  bindEnterToButton(selectMoveFamily, btnMoveTile);

  if (!uploadInput) return;

  let restoredIds = [];
  if (window.SVGTileManager && typeof window.SVGTileManager.restoreFromStorage === 'function') {
    restoredIds = window.SVGTileManager.restoreFromStorage();
  }

  refreshAssetsManagerUI();

  if (restoredIds.length > 0) {
    refreshTileCatalogUI(restoredIds);
    setSvgStatus(`Restored ${restoredIds.length} uploaded tile(s) from local library.`);
  }

  if (btnExportBackup) {
    btnExportBackup.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.SVGTileManager && typeof window.SVGTileManager.downloadBackup === 'function') {
        let scope = getBackupScope();
        window.SVGTileManager.downloadBackup(null, { scope });
        setSvgStatus(`Backup exported successfully (${scope}).`, 'success');
      }
    });
  }

  if (btnImportBackup && backupInput) {
    btnImportBackup.addEventListener('click', (e) => {
      e.preventDefault();
      backupInput.value = '';
      backupInput.click();
    });

    backupInput.addEventListener('change', async () => {
      let file = backupInput.files && backupInput.files[0];
      if (!file) return;

      try {
        let text = await readFileAsText(file);
        if (!window.SVGTileManager || typeof window.SVGTileManager.importBackupText !== 'function') {
          throw new Error('Backup import is not available.');
        }

        let scope = getBackupScope();
        let result = window.SVGTileManager.importBackupText(text, { scope });
        if (result.imported > 0 || result.registryApplied) {
          refreshTileCatalogUI(result.ids);
          pushAssetsHistoryCheckpoint();
          setSvgStatus(`Backup imported (${scope}): ${result.imported} new tile(s), ${result.skipped} skipped.${result.registryApplied ? ' Registry state restored.' : ''}`, 'success');
        } else {
          setSvgStatus(`Backup processed (${scope}): 0 imported, ${result.skipped} skipped.`, 'error');
        }
      } catch (err) {
        setSvgStatus(`Backup import failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnRestoreBuiltins) {
    btnRestoreBuiltins.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.restoreBuiltInRegistryDefaults !== 'function') {
        setSvgStatus('Built-in restore API not available.', 'error');
        return;
      }

      if (!window.confirm('Restore built-in tile names and families to default? Uploaded/custom tiles will be preserved.')) {
        return;
      }

      try {
        window.restoreBuiltInRegistryDefaults();
        if (window.SVGTileManager && typeof window.SVGTileManager.restoreBuiltInVisibility === 'function') {
          window.SVGTileManager.restoreBuiltInVisibility(window.DEFAULT_BUILTIN_TILE_LIMIT);
        }
        refreshTileCatalogUI();
        pushAssetsHistoryCheckpoint();
        setSvgStatus('Built-ins restored to default layout.', 'success');
      } catch (err) {
        setSvgStatus(`Built-in restore failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnRenameTile) {
    btnRenameTile.addEventListener('click', (e) => {
      e.preventDefault();
      let tileMeta = getSelectedTileMeta();
      let input = document.getElementById('assetTileNameInput');
      if (!tileMeta || !input) return;
      let nextName = input.value.trim();
      if (!nextName || nextName === tileMeta.name) return;
      try {
        if (tileMeta.uploaded && window.SVGTileManager && typeof window.SVGTileManager.renameUploadedTile === 'function') {
          window.SVGTileManager.renameUploadedTile(tileMeta.tileId, nextName);
        } else if (typeof window.renameTileName === 'function') {
          window.renameTileName(tileMeta.tileId, nextName);
        } else {
          throw new Error('Tile rename API not available.');
        }
        refreshTileCatalogUI([tileMeta.tileId]);
        pushAssetsHistoryCheckpoint();
        setSvgStatus(`Tile renamed to "${nextName}".`, 'success');
      } catch (err) {
        setSvgStatus(`Tile rename failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnMoveTile) {
    btnMoveTile.addEventListener('click', (e) => {
      e.preventDefault();
      let selectedTileIds = getSelectedTileIdsInActiveFamily();
      let tileMeta = getSelectedTileMeta();
      if (selectedTileIds.length === 0 || !tileMeta || !selectMoveFamily) return;
      let targetFamily = selectMoveFamily.value;
      if (!targetFamily) return;

      let movedIds = [];
      let failedIds = [];

      for (let tileId of selectedTileIds) {
        try {
          let summary = getFamilySummaryForManager();
          let currentFamily = null;
          for (let item of summary) {
            if (item.tileIds.includes(tileId)) {
              currentFamily = item.label;
              break;
            }
          }
          if (currentFamily === targetFamily) continue;

          let meta = getUploadedTileMeta(tileId);
          if (meta && window.SVGTileManager && typeof window.SVGTileManager.moveUploadedTileToFamily === 'function') {
            window.SVGTileManager.moveUploadedTileToFamily(tileId, targetFamily);
          } else if (typeof window.moveTileToFamily === 'function') {
            window.moveTileToFamily(tileId, targetFamily);
          } else {
            throw new Error('Move tile API not available.');
          }
          movedIds.push(tileId);
        } catch (_err) {
          failedIds.push(tileId);
        }
      }

      if (movedIds.length > 0) {
        assetsUiState.selectedFamily = targetFamily;
        assetsUiState.selectedFamilies = new Set([targetFamily]);
        assetsUiState.selectedTileIds = new Set(movedIds);
        assetsUiState.selectedTileId = movedIds[movedIds.length - 1] || null;
        refreshTileCatalogUI(movedIds);
        pushAssetsHistoryCheckpoint();

        if (failedIds.length > 0) {
          setSvgStatus(`Moved ${movedIds.length} tile(s). Failed to move ${failedIds.length}.`, 'error');
        } else {
          setSvgStatus(`${movedIds.length} tile(s) moved to family "${targetFamily}".`, 'success');
        }
      } else {
        setSvgStatus('No selected tiles could be moved.', 'error');
      }
    });
  }

  if (btnMoveTileOrderLeft) {
    btnMoveTileOrderLeft.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        if (!reorderSelectedTilesBulkByDirection(-1)) {
          setSvgStatus('Cannot move tile further left.', 'error');
        }
      } catch (err) {
        setSvgStatus(`Reorder failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnMoveTileOrderRight) {
    btnMoveTileOrderRight.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        if (!reorderSelectedTilesBulkByDirection(1)) {
          setSvgStatus('Cannot move tile further right.', 'error');
        }
      } catch (err) {
        setSvgStatus(`Reorder failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnMoveTileOrderTop) {
    btnMoveTileOrderTop.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        if (!moveSelectedTilesToTop()) {
          setSvgStatus('Selected tile(s) are already at the start.', 'error');
        }
      } catch (err) {
        setSvgStatus(`Reorder failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnMoveTileOrderBottom) {
    btnMoveTileOrderBottom.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        if (!moveSelectedTilesToBottom()) {
          setSvgStatus('Selected tile(s) are already at the end.', 'error');
        }
      } catch (err) {
        setSvgStatus(`Reorder failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnCreateFamily) {
    btnCreateFamily.addEventListener('click', (e) => {
      e.preventDefault();
      let input = document.getElementById('assetCreateFamilyInput');
      let label = input ? input.value.trim() : '';
      if (!label) {
        setSvgStatus('Enter a family name first.', 'error');
        return;
      }
      try {
        if (typeof window.createOrGetTileFamily !== 'function') {
          throw new Error('Family create API not available.');
        }
        window.createOrGetTileFamily(label);
        assetsUiState.selectedFamily = label;
        if (input) input.value = '';
        refreshTileCatalogUI();
        pushAssetsHistoryCheckpoint();
        setSvgStatus(`Family "${label}" created.`, 'success');
      } catch (err) {
        setSvgStatus(`Family create failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnMoveFamilyOrderUp) {
    btnMoveFamilyOrderUp.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        if (!reorderSelectedFamiliesBulkByDirection(-1)) {
          setSvgStatus('Cannot move selected families further up.', 'error');
        }
      } catch (err) {
        setSvgStatus(`Family move failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnMoveFamilyOrderDown) {
    btnMoveFamilyOrderDown.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        if (!reorderSelectedFamiliesBulkByDirection(1)) {
          setSvgStatus('Cannot move selected families further down.', 'error');
        }
      } catch (err) {
        setSvgStatus(`Family move failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnMoveFamilyOrderTop) {
    btnMoveFamilyOrderTop.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        if (!moveSelectedFamiliesToTop()) {
          setSvgStatus('Selected families are already at the top.', 'error');
        }
      } catch (err) {
        setSvgStatus(`Family move failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnMoveFamilyOrderBottom) {
    btnMoveFamilyOrderBottom.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        if (!moveSelectedFamiliesToBottom()) {
          setSvgStatus('Selected families are already at the bottom.', 'error');
        }
      } catch (err) {
        setSvgStatus(`Family move failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnRenameFamilyFromList) {
    btnRenameFamilyFromList.addEventListener('click', (e) => {
      e.preventDefault();
      if (!assetsUiState.selectedFamily) {
        setSvgStatus('Select a family first.', 'error');
        return;
      }

      let currentFamily = assetsUiState.selectedFamily;
      let input = document.getElementById('assetRenameFamilyInput');
      let newFamilyLabel = input ? input.value.trim() : '';
      if (!newFamilyLabel) {
        setSvgStatus('Enter the new family name.', 'error');
        return;
      }

      if (newFamilyLabel === currentFamily) {
        setSvgStatus('Family name is unchanged.', 'error');
        return;
      }

      try {
        if (window.SVGTileManager && typeof window.SVGTileManager.renameUploadedFamily === 'function') {
          window.SVGTileManager.renameUploadedFamily(currentFamily, newFamilyLabel);
        } else if (typeof window.renameTileFamilyLabel === 'function') {
          window.renameTileFamilyLabel(currentFamily, newFamilyLabel);
        } else {
          throw new Error('Family rename API not available.');
        }

        assetsUiState.selectedFamily = newFamilyLabel;
        refreshTileCatalogUI();
        pushAssetsHistoryCheckpoint();
        setSvgStatus(`Family renamed to "${newFamilyLabel}".`, 'success');
      } catch (err) {
        setSvgStatus(`Family rename failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnRemoveFamilyFromList) {
    btnRemoveFamilyFromList.addEventListener('click', (e) => {
      e.preventDefault();
      let targetFamilies = getSelectedFamilyLabels();
      if (targetFamilies.length === 0) {
        setSvgStatus('Select a family first.', 'error');
        return;
      }

      let prompt = targetFamilies.length === 1
        ? `Remove family "${targetFamilies[0]}" and delete all tiles currently assigned to it from library view?`
        : `Remove ${targetFamilies.length} selected families and delete their tiles from library view?`;
      if (!window.confirm(prompt)) return;

      try {
        for (let targetFamily of targetFamilies) {
          let summary = getFamilySummaryForManager().find((item) => item.label === targetFamily);
          let familyTileIds = summary ? summary.tileIds : [];

          for (let tileId of familyTileIds) {
            let uploadedMeta = getUploadedTileMeta(tileId);
            if (uploadedMeta) {
              if (!window.SVGTileManager || typeof window.SVGTileManager.deleteUploadedTile !== 'function') {
                throw new Error('Uploaded tile remove API not available.');
              }
              window.SVGTileManager.deleteUploadedTile(tileId);
              continue;
            }

            if (typeof window.removeTileFromFamily === 'function') {
              window.removeTileFromFamily(tileId);
            }

            if (window.SVGTileManager && typeof window.SVGTileManager.hideTile === 'function') {
              window.SVGTileManager.hideTile(tileId);
            }
          }

          if (typeof window.removeTileFamily === 'function') {
            window.removeTileFamily(targetFamily);
          }
        }

        assetsUiState.selectedFamily = null;
        assetsUiState.selectedFamilies = new Set();
        assetsUiState.selectedTileIds = new Set();
        assetsUiState.selectedTileId = null;
        refreshTileCatalogUI();
        pushAssetsHistoryCheckpoint();
        setSvgStatus(`${targetFamilies.length} family(s) removed.`, 'success');
      } catch (err) {
        setSvgStatus(`Family remove failed: ${err.message || err}`, 'error');
      }
    });
  }

  let btnRemoveTile = document.getElementById('btnRemoveSelectedTile');
  if (btnRemoveTile) {
    btnRemoveTile.addEventListener('click', (e) => {
      e.preventDefault();
      let selectedTileIds = getSelectedTileIdsInActiveFamily();
      if (selectedTileIds.length === 0) {
        setSvgStatus('Select a tile first.', 'error');
        return;
      }

      let tileMeta = getSelectedTileMeta();
      if (!tileMeta) return;

      if (selectedTileIds.length > 1) {
        if (!window.confirm(`Remove ${selectedTileIds.length} selected tiles?`)) return;
        try {
          for (let tileId of selectedTileIds) {
            let uploadedMeta = getUploadedTileMeta(tileId);
            if (uploadedMeta) {
              if (!window.SVGTileManager || typeof window.SVGTileManager.deleteUploadedTile !== 'function') {
                throw new Error('Tile remove API not available.');
              }
              let ok = window.SVGTileManager.deleteUploadedTile(tileId);
              if (!ok) throw new Error(`Tile #${tileId} could not be removed.`);
              continue;
            }

            if (typeof window.removeTileFromFamily !== 'function') {
              throw new Error('Tile remove API not available.');
            }

            let removed = window.removeTileFromFamily(tileId);
            if (!removed) continue;
            if (window.SVGTileManager && typeof window.SVGTileManager.hideTile === 'function') {
              window.SVGTileManager.hideTile(tileId);
            }
          }

          assetsUiState.selectedTileIds = new Set();
          assetsUiState.selectedTileId = null;
          refreshTileCatalogUI();
          pushAssetsHistoryCheckpoint();
          setSvgStatus(`${selectedTileIds.length} tile(s) removed.`, 'success');
        } catch (err) {
          setSvgStatus(`Tile remove failed: ${err.message || err}`, 'error');
        }
        return;
      }

      if (!tileMeta.uploaded) {
        if (!window.confirm(`Delete tile "${tileMeta.name}" from library view?`)) return;
        try {
          if (typeof window.removeTileFromFamily !== 'function') {
            throw new Error('Tile remove API not available.');
          }
          let removed = window.removeTileFromFamily(tileMeta.tileId);
          if (!removed) throw new Error('Tile is not assigned to any family.');
          if (window.SVGTileManager && typeof window.SVGTileManager.hideTile === 'function') {
            window.SVGTileManager.hideTile(tileMeta.tileId);
          }
          assetsUiState.selectedTileIds = new Set();
          assetsUiState.selectedTileId = null;
          refreshTileCatalogUI();
          pushAssetsHistoryCheckpoint();
          setSvgStatus(`Tile "${tileMeta.name}" deleted from library view.`, 'success');
        } catch (err) {
          setSvgStatus(`Tile delete failed: ${err.message || err}`, 'error');
        }
        return;
      }

      if (!window.confirm(`Remove uploaded tile "${tileMeta.name}"?`)) return;
      try {
        if (!window.SVGTileManager || typeof window.SVGTileManager.deleteUploadedTile !== 'function') {
          throw new Error('Tile remove API not available.');
        }
        let ok = window.SVGTileManager.deleteUploadedTile(tileMeta.tileId);
        if (!ok) throw new Error('Tile could not be removed.');
        assetsUiState.selectedTileIds = new Set();
        assetsUiState.selectedTileId = null;
        refreshTileCatalogUI();
        pushAssetsHistoryCheckpoint();
        setSvgStatus(`Tile "${tileMeta.name}" removed.`, 'success');
      } catch (err) {
        setSvgStatus(`Tile remove failed: ${err.message || err}`, 'error');
      }
    });
  }

  let btnRotateCCW = document.getElementById('btnEditorRotateCCW');
  let btnRotateCW = document.getElementById('btnEditorRotateCW');
  let btnMirrorX = document.getElementById('btnEditorMirrorX');
  let btnMirrorY = document.getElementById('btnEditorMirrorY');

  const rerenderEditorFromState = () => {
    updateEditorTransformFromControls();
    let tileMeta = getSelectedTileMeta();
    renderEditorToolbarState(!!tileMeta);
    renderEditorPreview(tileMeta);
  };

  if (btnRotateCCW) {
    btnRotateCCW.addEventListener('click', (e) => {
      e.preventDefault();
      let tileMeta = getSelectedTileMeta();
      if (!tileMeta) return;
      assetsUiState.editorTransform.rotate = (Number(assetsUiState.editorTransform.rotate) || 0) - 90;
      rerenderEditorFromState();
    });
  }

  if (btnRotateCW) {
    btnRotateCW.addEventListener('click', (e) => {
      e.preventDefault();
      let tileMeta = getSelectedTileMeta();
      if (!tileMeta) return;
      assetsUiState.editorTransform.rotate = (Number(assetsUiState.editorTransform.rotate) || 0) + 90;
      rerenderEditorFromState();
    });
  }

  if (btnMirrorX) {
    btnMirrorX.addEventListener('click', (e) => {
      e.preventDefault();
      let tileMeta = getSelectedTileMeta();
      if (!tileMeta) return;
      toggleEditorMirrorAxis('x');
      rerenderEditorFromState();
    });
  }

  if (btnMirrorY) {
    btnMirrorY.addEventListener('click', (e) => {
      e.preventDefault();
      let tileMeta = getSelectedTileMeta();
      if (!tileMeta) return;
      toggleEditorMirrorAxis('y');
      rerenderEditorFromState();
    });
  }

  let btnCreateEditedTile = document.getElementById('btnCreateEditedTile');
  if (btnCreateEditedTile) {
    btnCreateEditedTile.addEventListener('click', (e) => {
      e.preventDefault();
      let tileMeta = getSelectedTileMeta();
      if (!tileMeta) {
        setSvgStatus('Select a tile first.', 'error');
        return;
      }

      try {
        updateEditorTransformFromControls();
        let created;
        if (tileMeta.uploaded) {
          if (!window.SVGTileManager || typeof window.SVGTileManager.createEditedTile !== 'function') {
            throw new Error('Editor API not available.');
          }
          created = window.SVGTileManager.createEditedTile(tileMeta.tileId, assetsUiState.editorTransform);
        } else {
          if (typeof window.createDerivedTileFromExisting !== 'function') {
            throw new Error('Built-in editor API not available.');
          }
          created = window.createDerivedTileFromExisting(tileMeta.tileId, assetsUiState.editorTransform, {
            familyLabel: tileMeta.familyLabel
          });
        }
        refreshTileCatalogUI([created.tileId]);
        pushAssetsHistoryCheckpoint();
        setSvgStatus(`Edited tile created: #${created.tileId}.`, 'success');
      } catch (err) {
        setSvgStatus(`Could not create edited tile: ${err.message || err}`, 'error');
      }
    });
  }

  const importSelectedSvgFiles = async () => {
    if (!window.SVGTileManager || typeof window.SVGTileManager.registerUploadedSvgTile !== 'function') {
      setSvgStatus('SVG manager not available.', 'error');
      return;
    }

    let files = Array.from(uploadInput.files || []);
    if (files.length === 0) {
      setSvgStatus('Select at least one SVG file first.', 'error');
      return;
    }

    let chosenFamily = assetsUiState.selectedFamily;
    if (!chosenFamily) {
      setSvgStatus('Select or create a family before uploading.', 'error');
      return;
    }

    let newIds = [];
    let failures = [];

    setSvgStatus(`Importing ${files.length} file(s)...`);

    for (let file of files) {
      try {
        let content = await readFileAsText(file);
        let cleanName = file.name.replace(/\.svg$/i, '').trim() || 'Uploaded SVG';
        let result = window.SVGTileManager.registerUploadedSvgTile({
          name: cleanName,
          familyLabel: chosenFamily,
          svgText: content
        });
        newIds.push(result.tileId);
      } catch (err) {
        failures.push(`${file.name}: ${err.message || err}`);
      }
    }

    if (newIds.length > 0) {
      refreshTileCatalogUI(newIds);
      pushAssetsHistoryCheckpoint();
      uploadInput.value = '';
      setSvgStatus(
        failures.length > 0
          ? `Imported ${newIds.length} tile(s). ${failures.length} failed.`
          : `Imported ${newIds.length} tile(s) in family "${chosenFamily}".`,
        failures.length > 0 ? '' : 'success'
      );
    } else {
      setSvgStatus('No SVG was imported. Check file validity.', 'error');
    }

    if (failures.length > 0) {
      setSvgStatus(`Some files failed: ${failures.join(' | ')}`, 'error');
    }
  };

  uploadInput.addEventListener('change', () => {
    importSelectedSvgFiles();
  });

  if (btnAdd) {
    btnAdd.addEventListener('click', (e) => {
      e.preventDefault();
      if (!assetsUiState.selectedFamily) {
        setSvgStatus('Select or create a family before uploading.', 'error');
        return;
      }
      uploadInput.value = '';
      uploadInput.click();
    });
  }

  if (btnAssetsUndo) {
    btnAssetsUndo.addEventListener('click', (e) => {
      e.preventDefault();
      restoreAssetsHistoryTo(assetsHistoryIndex - 1);
    });
  }

  if (btnAssetsRedo) {
    btnAssetsRedo.addEventListener('click', (e) => {
      e.preventDefault();
      restoreAssetsHistoryTo(assetsHistoryIndex + 1);
    });
  }

  resetAssetsHistory();
}

function setupUI(mainCanvas) {
  // Bind inputs
  let wInput = select('#canvasW');
  let hInput = select('#canvasH');
  
  // SVG Icons
  // Unlock: Outline only, shackle lifted
  const ICON_UNLOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';
  // Lock: Filled body for emphasis, shackle closed
  const ICON_LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

  // Lock buttons
  let btnLockCanvasRatio = select('#btnLockCanvasRatio');
  let btnLockGridRatio = select('#btnLockGridRatio');

  if (mainCanvas && mainCanvas.elt) {
    mainCanvas.elt.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  if (btnLockCanvasRatio) {
    btnLockCanvasRatio.mousePressed(() => {
        isCanvasLocked = !isCanvasLocked;
        btnLockCanvasRatio.html(isCanvasLocked ? ICON_LOCK : ICON_UNLOCK);
        if (isCanvasLocked) {
           btnLockCanvasRatio.addClass('locked');
           let w = parseInt(wInput.value());
           let h = parseInt(hInput.value());
           if (h > 0) canvasRatio = w / h;
        } else {
           btnLockCanvasRatio.removeClass('locked');
        }
    });
  }

  wInput.input(() => {
    let val = parseInt(wInput.value());
    if (val > 0) {
      if (isCanvasLocked) {
        let newH = floor(val / canvasRatio);
        hInput.value(newH);
        resizeCanvasAndUpdate(val, newH);
      } else {
        resizeCanvasAndUpdate(val, height);
      }
    }
  });
  
  hInput.input(() => {
    let val = parseInt(hInput.value());
    if (val > 0) {
      if (isCanvasLocked) {
        let newW = floor(val * canvasRatio);
        wInput.value(newW);
        resizeCanvasAndUpdate(newW, val);
      } else {
        resizeCanvasAndUpdate(width, val);
      }
    }
  });

  let gridRowsInput = select('#gridRows');
  let gridColsInput = select('#gridCols');

  if (btnLockGridRatio) {
     btnLockGridRatio.mousePressed(() => {
        isGridLocked = !isGridLocked;
        btnLockGridRatio.html(isGridLocked ? ICON_LOCK : ICON_UNLOCK);
        if (isGridLocked) {
           btnLockGridRatio.addClass('locked');
           let r = parseInt(gridRowsInput.value());
           let c = parseInt(gridColsInput.value());
           if (r > 0) gridRatio = c / r; // cols per row
        } else {
           btnLockGridRatio.removeClass('locked');
        }
     });
  }
  
  gridRowsInput.input(() => { 
    let val = parseInt(gridRowsInput.value());
    if (val > 0) {
      rows = val;
      if (isGridLocked) {
         let newCols = floor(rows * gridRatio);
         if (newCols < 1) newCols = 1;
         cols = newCols;
         gridColsInput.value(cols);
      }
      initGrid(); 
    }
  });
  
  gridColsInput.input(() => { 
    let val = parseInt(gridColsInput.value());
    if (val > 0) { 
      cols = val;
      if (isGridLocked) {
        let newRows = floor(cols / gridRatio);
        if (newRows < 1) newRows = 1;
        rows = newRows;
        gridRowsInput.value(rows);
      }
      initGrid(); 
    }
  });
  
  select('#gridMargin').input(() => {
    let val = parseInt(select('#gridMargin').value());
    if (!isNaN(val) && val >= 0) { margin = val; initGrid(); }
  });

  select('#btnFitScreen').mousePressed(fitCanvasToScreen);
  // select('#btnSquareGrid').mousePressed(makeGridSquare); // Removing this one? No, I'll keep both.
  select('#btnFitCanvas').mousePressed(fitCanvasToGrid);
  select('#btnSquareGrid').mousePressed(makeGridSquare);
  select('#btnFullscreen').mousePressed(toggleFullscreen);

  const MIN_CANVAS_ZOOM = 25;
  const MAX_CANVAS_ZOOM = 300;
  const CANVAS_ZOOM_STEP = canvasZoomStep;

  let zoomSlider = select('#canvasZoom');
  let zoomValue = select('#canvasZoomValue');
  let btnZoomIn = select('#btnZoomIn');
  let btnZoomOut = select('#btnZoomOut');
  let btnZoomHide = select('#btnZoomHide');
  let btnZoomShow = select('#btnZoomShow');
  let zoomFitMode = select('#zoomFitMode');
  let zoomOverlay = document.getElementById('canvasZoomOverlay');

  const clampCanvasZoom = (value) => {
    if (!Number.isFinite(value)) return canvasZoomPercent;
    return Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, Math.round(value)));
  };

  const updateZoomUi = () => {
    if (zoomSlider) zoomSlider.value(canvasZoomPercent);
    if (zoomValue) zoomValue.html(`${canvasZoomPercent}%`);
  };

  const applyCanvasZoom = (value) => {
    canvasZoomPercent = clampCanvasZoom(value);
    if (mainCanvas && mainCanvas.elt) {
      mainCanvas.elt.style.transform = `scale(${canvasZoomPercent / 100})`;
    }
    updateZoomUi();
  };

  const updateCanvasCursor = () => {
    if (!mainCanvas || !mainCanvas.elt) return;
    if (zoomToolActive && !isAssetsTabActive()) {
      mainCanvas.elt.style.cursor = 'zoom-in';
    } else {
      mainCanvas.elt.style.cursor = '';
    }
  };

  const getViewportFitZoom = (mode) => {
    let canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer || width <= 0 || height <= 0) return 100;

    let availableWidth = Math.max(1, canvasContainer.clientWidth - 20);
    let availableHeight = Math.max(1, canvasContainer.clientHeight - 20);

    let horizontalZoom = (availableWidth / width) * 100;
    let verticalZoom = (availableHeight / height) * 100;

    if (mode === 'horizontal') return horizontalZoom;
    if (mode === 'vertical') return verticalZoom;
    if (mode === 'fill') return Math.max(horizontalZoom, verticalZoom);
    return Math.min(horizontalZoom, verticalZoom);
  };

  const fitCanvasZoom = (mode) => {
    if (mode === 'original') {
      applyCanvasZoom(100);
      return;
    }
    applyCanvasZoom(getViewportFitZoom(mode));
  };

  applyCanvasZoomHandler = applyCanvasZoom;
  fitCanvasZoomHandler = fitCanvasZoom;
  updateCanvasCursorHandler = updateCanvasCursor;

  const setZoomOverlayVisible = (visible) => {
    if (!zoomOverlay) return;
    if (visible) zoomOverlay.classList.remove('hidden');
    else zoomOverlay.classList.add('hidden');
  };

  if (zoomSlider) {
    zoomSlider.input(() => {
      let sliderVal = parseInt(zoomSlider.value(), 10);
      if (!isNaN(sliderVal)) applyCanvasZoom(sliderVal);
    });
  }

  if (btnZoomIn) {
    btnZoomIn.mousePressed(() => applyCanvasZoom(canvasZoomPercent + CANVAS_ZOOM_STEP));
  }

  if (btnZoomOut) {
    btnZoomOut.mousePressed(() => applyCanvasZoom(canvasZoomPercent - CANVAS_ZOOM_STEP));
  }

  if (btnZoomHide) {
    btnZoomHide.mousePressed(() => setZoomOverlayVisible(false));
  }

  if (btnZoomShow) {
    btnZoomShow.mousePressed(() => setZoomOverlayVisible(true));
  }

  if (zoomFitMode) {
    zoomFitMode.changed(() => {
      let mode = zoomFitMode.value() || 'best';
      fitCanvasZoom(mode);
    });
  }

  if (mainCanvas && mainCanvas.elt) {
    mainCanvas.elt.style.transformOrigin = 'center center';
  }

  const isTypingContext = (target) => {
    if (!target) return false;
    if (target.isContentEditable) return true;
    let tag = target.tagName ? target.tagName.toUpperCase() : '';
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  };

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingContext(event.target)) return;

    let key = event.key;
    let code = event.code;

    if (key === '-' || code === 'NumpadSubtract') {
      event.preventDefault();
      applyCanvasZoom(canvasZoomPercent - CANVAS_ZOOM_STEP);
    } else if (key === '=' || key === '+' || code === 'NumpadAdd') {
      event.preventDefault();
      applyCanvasZoom(canvasZoomPercent + CANVAS_ZOOM_STEP);
    } else if (key === '0' || code === 'Numpad0') {
      event.preventDefault();
      fitCanvasZoom('original');
    } else if (key === '1') {
      event.preventDefault();
      fitCanvasZoom('horizontal');
    } else if (key === '2') {
      event.preventDefault();
      fitCanvasZoom('vertical');
    } else if (key === '3') {
      event.preventDefault();
      fitCanvasZoom('best');
    } else if (key === '4') {
      event.preventDefault();
      fitCanvasZoom('fill');
    }
  });

  setZoomOverlayVisible(true);
  applyCanvasZoom(canvasZoomPercent);
  updateCanvasCursor();

  select('#seedInput').value(seed);
  select('#seedInput').input(() => { 
    let val = parseInt(select('#seedInput').value());
    if (!isNaN(val)) { seed = val; initGrid(); }
  });
  
  const randomizeSeedAndRegenerate = () => {
    seed = floor(random(10000));
    select('#seedInput').value(seed);
    initGrid();
    if(window.updateAllSummaries) window.updateAllSummaries();
  };

  select('#btnRandomize').mousePressed(randomizeSeedAndRegenerate);
  
  // History Button Bindings
  let bPrev = select('#btnPrevSeed');
  if(bPrev) bPrev.mousePressed(() => restoreGenerationState(generationIndex - 1));
  
  let bNext = select('#btnNextSeed');
  if(bNext) bNext.mousePressed(() => restoreGenerationState(generationIndex + 1));
  
  let bToggle = select('#btnToggleHistory');
  if(bToggle) {
     bToggle.mousePressed((e) => {
        let list = select('#seedHistoryList');
        // Toggle display logic
        if (list.style('display') === 'none') {
            list.style('display', 'block');
        } else {
            list.style('display', 'none');
        }
        e.stopPropagation(); // prevent window click from immediately closing it
     });
     
     // Close when clicking outside
     document.addEventListener('click', (e) => {
        let list = select('#seedHistoryList');
        if (list && list.style('display') === 'block') {
            // Check if click is outside list and button
            let target = e.target;
            // Native DOM check for containment
            if (!bToggle.elt.contains(target) && !list.elt.contains(target)) {
                list.style('display', 'none');
            }
        }
     });
  }
  
  let bUndo = select('#btnUndo');
  if(bUndo) bUndo.mousePressed(undoEdit);
  
  let bRedo = select('#btnRedo');
  if(bRedo) bRedo.mousePressed(redoEdit);
  
  // select('#btnRedraw').mousePressed(initGrid); // Removed as it auto-updates
  
  const buildExportMeta = () => {
    let currentRows = parseInt(select('#gridRows').value(), 10);
    let currentCols = parseInt(select('#gridCols').value(), 10);
    if (isNaN(currentRows) || currentRows < 1) currentRows = rows;
    if (isNaN(currentCols) || currentCols < 1) currentCols = cols;

    let timestamp = year() + nf(month(), 2) + nf(day(), 2) + '-' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
    let ratio = (width / height).toFixed(2);
    let basename = `tilling_stripes_seed-${seed}_canvas-${width}x${height}_grid-${currentRows}x${currentCols}_margin-${margin}_${timestamp}`;
    return { ratio, timestamp, basename, currentRows, currentCols };
  };

  const exportAsPng = () => {
    let meta = buildExportMeta();
    let filename = `${meta.basename}.png`;
    try {
      let dataURL = mainCanvas.elt.toDataURL('image/png');
      let link = document.createElement('a');
      link.download = filename;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error saving PNG:', err);
      alert('Error saving PNG. See console for details.');
    }
  };

  const exportAsSvg = () => {
    try {
      let svg = new SimpleSVG(width, height);
      let exportColor = 'black';

      for (let tile of tiles) {
        if (typeof tile.renderVector === 'function') {
          tile.renderVector(svg, exportColor);
        } else {
          console.warn('Tile missing renderVector method');
        }
      }

      let meta = buildExportMeta();
      svg.save(`${meta.basename}.svg`);
    } catch (err) {
      console.error('Error saving SVG:', err);
      alert('Error saving SVG. See console for details.');
    }
  };

  const exportAsGcode = () => {
    try {
      let meta = buildExportMeta();
      let lines = [
        '; tilling_stripes GCode export (initial scaffold)',
        `; seed: ${seed}`,
        `; canvas: ${width}x${height}`,
        `; grid: ${meta.currentRows}x${meta.currentCols}`,
        `; margin: ${margin}`,
        `; ratio: ${meta.ratio}`,
        '; NOTE: motion paths/conversion settings will be implemented in a future iteration.',
        'G21',
        'G90',
        'M5',
        '; No toolpaths generated yet.',
        'M2'
      ];

      let blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      let link = document.createElement('a');
      link.download = `${meta.basename}.gcode`;
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Error saving GCode:', err);
      alert('Error saving GCode. See console for details.');
    }
  };

  const exportHandlers = {
    png: exportAsPng,
    svg: exportAsSvg,
    gcode: exportAsGcode
  };

  let btnExport = document.getElementById('btnExport');
  let exportFormatSelect = document.getElementById('exportFormatSelect');

  if (btnExport && exportFormatSelect) {
    btnExport.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      let format = (exportFormatSelect.value || 'png').toLowerCase();
      let handler = exportHandlers[format];

      if (!handler) {
        console.warn('Unknown export format:', format);
        return;
      }

      handler();
    });
  }

  let btnSelectAll = select('#selectAll');
  if (btnSelectAll) btnSelectAll.mousePressed(selectAllTiles);

  let btnSelectNone = select('#selectNone');
  if (btnSelectNone) btnSelectNone.mousePressed(selectNoneTiles);

  let btnSetupAllTiles = select('#btnSetupAllTiles');
  if (btnSetupAllTiles) btnSetupAllTiles.mousePressed(selectAllTiles);

  let btnSetupNoTiles = select('#btnSetupNoTiles');
  if (btnSetupNoTiles) btnSetupNoTiles.mousePressed(selectNoneTiles);

  const isMobileInput = () => {
    return window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches;
  };

  const updateEditModeUI = () => {
    let paintBtn = select('#editModePaint');
    let rotateBtn = select('#editModeRotate');
    let toggleContainer = select('#editModeToggle');

    if (toggleContainer) {
      toggleContainer.attribute('data-active', editToolMode === 'mirror' ? 'rotate' : 'paint');
    }

    if (paintBtn) {
      if (editToolMode === 'edit') paintBtn.addClass('active');
      else paintBtn.removeClass('active');
    }

    if (rotateBtn) {
      if (editToolMode === 'mirror') rotateBtn.addClass('active');
      else rotateBtn.removeClass('active');
    }
  };

  const toggleEditToolMode = () => {
    editToolMode = editToolMode === 'edit' ? 'mirror' : 'edit';
    updateEditModeUI();
    updateEditUI();
    showCanvasStatusHintTemporarily(1800);
  };

  let editPaintBtn = select('#editModePaint');
  let editRotateBtn = select('#editModeRotate');

  if (editPaintBtn) {
    editPaintBtn.mousePressed(() => {
      editToolMode = 'edit';
      updateEditModeUI();
      updateEditUI();
      showCanvasStatusHintTemporarily(1800);
    });
  }

  if (editRotateBtn) {
    editRotateBtn.mousePressed(() => {
      editToolMode = 'mirror';
      updateEditModeUI();
      updateEditUI();
      showCanvasStatusHintTemporarily(1800);
    });
  }

  window.addEventListener('resize', () => {
    if (!isMobileInput()) {
      updateEditModeUI();
    }
  });

  // Interaction Logic (Wiring the buttons)
  // Initially, assume 'none' if Setup tab is active
  interactionMode = 'none';

  let canvasHintTimeout = null;

  const shouldShowCanvasStatusHint = () => {
    return interactionMode === 'edit'
      && window.matchMedia('(min-width: 769px)').matches
      && window.matchMedia('(pointer: fine)').matches;
  };

  const setCanvasStatusHintVisible = (visible) => {
    let hint = select('#canvasStatusHint');
    if (!hint) return;
    if (visible) hint.addClass('visible');
    else hint.removeClass('visible');
  };

  const updateCanvasStatusHintText = () => {
    let hint = select('#canvasStatusHint');
    if (!hint) return;

    if (zoomToolActive && isEditTabActive()) {
      hint.html('ZOOM tool • LMB + • RMB - • Z toggle');
      return;
    }

    if (editToolMode === 'edit') {
      hint.html('LMB paint • RMB rotate • R toggle');
    } else {
      hint.html('LMB rotate • RMB paint • R toggle');
    }
  };

  const updateCanvasStatusHintPlacement = () => {
    const hint = document.getElementById('canvasStatusHint');
    const container = document.getElementById('canvas-container');
    const canvasElement = container ? container.querySelector('canvas') : null;
    if (!hint || !container || !canvasElement) return;

    hint.style.top = '';
    hint.style.bottom = '6px';

    if (!shouldShowCanvasStatusHint()) return;

    const containerRect = container.getBoundingClientRect();
    const canvasRect = canvasElement.getBoundingClientRect();
    const hintHeight = Math.max(24, hint.offsetHeight || 0);

    const canvasFitsContainer =
      canvasRect.height <= (containerRect.height - 20)
      && canvasRect.width <= (containerRect.width - 20);

    const topBelowCanvas = (canvasRect.bottom - containerRect.top) + 6;
    const spaceBelowCanvas = containerRect.height - topBelowCanvas;

    if (canvasFitsContainer && spaceBelowCanvas >= (hintHeight + 4)) {
      hint.style.top = `${topBelowCanvas}px`;
      hint.style.bottom = 'auto';
    }
  };

  const hideCanvasStatusHint = () => {
    if (canvasHintTimeout) {
      clearTimeout(canvasHintTimeout);
      canvasHintTimeout = null;
    }
    setCanvasStatusHintVisible(false);
  };

  const showCanvasStatusHintTemporarily = (duration = 2400) => {
    if (!shouldShowCanvasStatusHint()) {
      hideCanvasStatusHint();
      return;
    }

    updateCanvasStatusHintText();
    updateCanvasStatusHintPlacement();
    setCanvasStatusHintVisible(true);
    requestAnimationFrame(updateCanvasStatusHintPlacement);

    if (canvasHintTimeout) clearTimeout(canvasHintTimeout);
    canvasHintTimeout = setTimeout(() => {
      setCanvasStatusHintVisible(false);
      canvasHintTimeout = null;
    }, duration);
  };

  if (mainCanvas && mainCanvas.elt) {
    mainCanvas.elt.addEventListener('mouseenter', () => {
      showCanvasStatusHintTemporarily(2200);
    });
    mainCanvas.elt.addEventListener('mousedown', () => {
      showCanvasStatusHintTemporarily(1600);
    });
    mainCanvas.elt.addEventListener('mouseleave', () => {
      hideCanvasStatusHint();
    });

    window.addEventListener('resize', () => {
      if (!shouldShowCanvasStatusHint()) {
        hideCanvasStatusHint();
      } else {
        updateCanvasStatusHintPlacement();
      }
    });

    let canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
      canvasContainer.addEventListener('scroll', () => {
        if (shouldShowCanvasStatusHint()) {
          updateCanvasStatusHintPlacement();
        }
      });
    }
  }

  const updateCanvasStatusHint = () => {
    if (interactionMode === 'edit') {
      showCanvasStatusHintTemporarily(2800);
    } else {
      hideCanvasStatusHint();
    }
  };

  window.refreshCanvasStatusHint = updateCanvasStatusHint;

  // Listen for Tab Changes
  window.addEventListener('tabChanged', (e) => {
     let tab = e.detail.tab;
     if (tab === 'setup') {
         setAssetsManagerMode(false);
         interactionMode = 'none';
         // Ensure paint mode Visuals are cleared from allowed tiles if they were there (unlikely due to split)
         select('#tileSelector').removeClass('paint-mode');
       updateHoverPreview();
       updateCanvasStatusHint();
       updateCanvasCursor();
       redraw();
     } else if (tab === 'edit') {
         setAssetsManagerMode(false);
         interactionMode = 'edit';
         updateEditUI();
       updateHoverPreview();
       updateCanvasStatusHint();
       updateCanvasCursor();
       redraw();
     } else {
         setAssetsManagerMode(true);
         interactionMode = 'none';
         zoomToolActive = false;
         updateEditUI();
       refreshAssetsManagerUI();
       updateHoverPreview();
       updateCanvasStatusHint();
       updateCanvasCursor();
       redraw();
     }
  });
  
  // Set initial UI state
  updateEditUI();
  updateEditModeUI();
  setAssetsManagerMode(false);
  updateCanvasStatusHint();
  updateCanvasCursor();

  window.toggleEditToolMode = toggleEditToolMode;
  
  // Scope Descriptions
  const SCOPE_DESCRIPTIONS = {
    'single': '<strong style="color: #fff;">Single Tile</strong> <br> <span style="font-size: 0.9em; opacity: 0.8">Update only the tile you click.</span>',
    'supertile': '<strong style="color: #fff;">Block (2x2)</strong> <br> <span style="font-size: 0.9em; opacity: 0.8">Update the entire 2x2 group.</span>',
    'global_exact': '<strong style="color: #fff;">Global Match</strong> <br> <span style="font-size: 0.9em; opacity: 0.8">Update ALL tiles of this type entirely.</span>',
    'global_pos': '<strong style="color: #fff;">Grid Position</strong> <br> <span style="font-size: 0.9em; opacity: 0.8">Update this specific slot in ALL blocks.</span>',
    'global_pos_sym': '<strong style="color: #fff;">Symmetry (4x)</strong> <br> <span style="font-size: 0.9em; opacity: 0.8">Update all 4 symmetric slots in ALL blocks.</span>'
  };

  // Set initial tooltip
  select('#scopeDesc').html(SCOPE_DESCRIPTIONS['single']);

  selectAll('.scope-btn').forEach(btn => {
      // Click Handler
      btn.mousePressed(() => {
          selectAll('.scope-btn').forEach(b => b.removeClass('active'));
          btn.addClass('active');
          interactionScope = btn.attribute('data-scope');
          
          // Update description
          let descDiv = select('#scopeDesc');
          if(descDiv && SCOPE_DESCRIPTIONS[interactionScope]) {
             descDiv.html(SCOPE_DESCRIPTIONS[interactionScope]);
          }

           updateHoverPreview();
           redraw();
      });

      // Hover Effects for Description
      btn.mouseOver(() => {
           let scope = btn.attribute('data-scope');
           let descDiv = select('#scopeDesc');
           if(descDiv && SCOPE_DESCRIPTIONS[scope]) {
             descDiv.html(SCOPE_DESCRIPTIONS[scope]);
           }
      });
      
      btn.mouseOut(() => {
           // Revert to active scope description
           let descDiv = select('#scopeDesc');
           if(descDiv && SCOPE_DESCRIPTIONS[interactionScope]) {
             descDiv.html(SCOPE_DESCRIPTIONS[interactionScope]);
           }
      });
  });
}

function updateEditUI() {
    let previewContainer = select('#paintTileDisplay'); 
    let scopeContainer = select('#scopeControl');

    // Logic-dependent visibility
    if (interactionMode === 'edit') {
  if(previewContainer) previewContainer.style('display', 'flex'); 
        if(scopeContainer) scopeContainer.style('display', 'block');
    } else {
    // Setup tab / disabled
        if(previewContainer) previewContainer.style('display', 'none');
    if(scopeContainer) scopeContainer.style('display', 'none');
    }
}

function resizeCanvasAndUpdate(w, h) {
  resizeCanvas(w, h);
  initGrid();
}

function fitCanvasToScreen() {
  // Get container dimensions
  let containerElt = document.getElementById('canvas-container');
  // Use clientWidth/Height accounting for padding (set to 10px in CSS)
  let w = containerElt.clientWidth - 20; 
  let h = containerElt.clientHeight - 20;

  if (w < 100) w = 100;
  if (h < 100) h = 100;
  
  select('#canvasW').value(floor(w));
  select('#canvasH').value(floor(h));
  resizeCanvasAndUpdate(w, h);
  if(window.updateAllSummaries) window.updateAllSummaries();
}

function windowResized() {
  // Optional: Automatically resize if in fullscreen or a "responsive" mode?
  // For now, let's just make sure the container is handled by CSS.
  // Unless the user wants the canvas content to resize:
  // fitCanvasToScreen(); 
}

function fitCanvasToGrid() {
  if (cols <= 0 || rows <= 0) return;
  
  // Calculate grid ratio
  let gridRatio = cols / rows;
  
  // Fit to width or height?
  // Let's try to maintain the largest dimension
  if (width > height) {
     let newH = width / gridRatio;
     select('#canvasH').value(floor(newH));
     resizeCanvasAndUpdate(width, newH);
  } else {
     let newW = height * gridRatio;
     select('#canvasW').value(floor(newW));
     resizeCanvasAndUpdate(newW, height);
  }
  if(window.updateAllSummaries) window.updateAllSummaries();
}

function makeGridSquare() {
  let drawW = width - (margin * 2);
  let drawH = height - (margin * 2);

  if (drawH <= 0 || drawW <= 0) return;

  // Let's adjust columns to match rows
  let ratio = drawW / drawH;
  let newCols = max(1, round(rows * ratio));
  
  cols = newCols;
  select('#gridCols').value(cols);
  initGrid();
  if(window.updateAllSummaries) window.updateAllSummaries();
}

function toggleFullscreen() {
  let body = select('body');
  if (body.hasClass('fullscreen')) {
    body.removeClass('fullscreen');
  } else {
    body.addClass('fullscreen');
  }
}

function generateTileThumbnails() {
  syncTotalTileTypes();
    createAllowedTilesList();
    createBrushList(); 
}

function createBrushList() {
    let container = select('#brushList');
    if (!container) return; // Element might not exist if HTML isn't updated
    
    container.html('');
    
    for (let i = 0; i < totalTileTypes; i++) {
      if (!isTileVisible(i)) continue;
        let div = createDiv('');
        div.class('tile-option');
        div.attribute('data-type', i);
        div.style('width', '40px');
        div.style('height', '40px');
        
        // Highlight active brush
        if (i === currentPaintTile) {
            div.addClass('paint-selected');
        }
        
        // Tooltip
        let tooltip = (typeof TILE_NAMES !== 'undefined' && TILE_NAMES[i]) ? `#${i}: ${TILE_NAMES[i]}` : `Tile #${i}`;
        div.attribute('title', tooltip);
        
        div.parent(container);

        let uploadedMeta = getUploadedTileMeta(i);
        let thumbSrc = uploadedMeta && uploadedMeta.thumbnailDataUrl;
        
        // Render Thumbnail
        let img;
        if (thumbSrc) {
          img = createImg(thumbSrc);
        } else {
          let gfx = createGraphics(40, 40);
          let c = color(220);
          let s = new Subtile(40, 40, i);
          s.color = c;
          s.render(gfx, 20, 20);
          img = createImg(gfx.canvas.toDataURL());
          gfx.remove();
        }
        img.style('width', '100%');
        img.style('height', '100%');
        img.style('display', 'block');
        img.parent(div);
        
        // Click Handler (Select Brush)
        div.mousePressed(() => {
            currentPaintTile = i;
            
            // UI Update: Remove active class from all brush items
            // Note: We scope this to #brushList to avoid clearing allowed tiles
            let allBrushes = container.elt.querySelectorAll('.tile-option');
            allBrushes.forEach(el => el.classList.remove('paint-selected'));
            div.addClass('paint-selected');
            
            // Update Preview Info
            let name = (typeof TILE_NAMES !== 'undefined' && TILE_NAMES[i]) ? TILE_NAMES[i] : ('#' + i);
            let nameLabel = select('#paintTileName');
            if(nameLabel) nameLabel.html(name);
            
            let previewBox = select('#paintTilePreview');
            if(previewBox) {
               previewBox.html('');
               let previewImg = createImg(img.attribute('src'));
               previewImg.style('width', '100%');
               previewImg.style('height', '100%'); 
               previewImg.parent(previewBox);
            }

        });
    }
}

function createAllowedTilesList() {
  let container = select('#tileSelector');
  container.html(''); // Clear existing

  let visibleTileIds = [];
  for (let i = 0; i < totalTileTypes; i++) {
    if (isTileVisible(i)) visibleTileIds.push(i);
  }

  let groups = [];
  let seen = new Set();
  if (typeof window.getTileFamilySummary === 'function') {
    let summaries = window.getTileFamilySummary() || [];
    for (let summary of summaries) {
      if (!summary || !Array.isArray(summary.tileIds)) continue;
      let ids = summary.tileIds.filter((id) => isTileVisible(id) && !seen.has(id));
      if (ids.length === 0) continue;
      ids.forEach((id) => seen.add(id));
      groups.push({ label: summary.label || `family-${summary.index}`, tileIds: ids });
    }
  }

  let ungrouped = visibleTileIds.filter((id) => !seen.has(id));
  if (ungrouped.length > 0) {
    groups.push({ label: 'Ungrouped', tileIds: ungrouped });
  }

  if (groups.length === 0 && visibleTileIds.length > 0) {
    groups.push({ label: 'All Tiles', tileIds: visibleTileIds.slice() });
  }

  const createTileOption = (tileId, parentEl) => {
    let div = createDiv('');
    div.class('tile-option');
    div.attribute('data-type', tileId);

    if (allowedTypes.includes(tileId)) {
      div.addClass('selected');
    }

    if (typeof TILE_NAMES !== 'undefined' && TILE_NAMES[tileId]) {
      div.attribute('title', `#${tileId}: ${TILE_NAMES[tileId]}`);
    } else {
      div.attribute('title', 'Tile #' + tileId);
    }

    div.parent(parentEl);

    let uploadedMeta = getUploadedTileMeta(tileId);
    let thumbSrc = uploadedMeta && uploadedMeta.thumbnailDataUrl;
    let img;
    if (thumbSrc) {
      img = createImg(thumbSrc);
    } else {
      let gfx = createGraphics(80, 80);
      let c = color(220);
      let s = new Subtile(80, 80, tileId);
      s.color = c;
      s.render(gfx, 40, 40);
      img = createImg(gfx.canvas.toDataURL());
      gfx.remove();
    }
    img.style('width', '100%');
    img.style('height', '100%');
    img.style('display', 'block');
    img.parent(div);

    div.mousePressed(() => {
      if (div.hasClass('selected')) {
        div.removeClass('selected');
      } else {
        div.addClass('selected');
      }
      updateAllowedTypes();
      initGrid();
    });
  };

  for (let group of groups) {
    let section = createDiv('');
    section.class('allowed-family-section');
    section.parent(container);

    let title = createDiv(`${group.label} (${group.tileIds.length})`);
    title.class('allowed-family-title');
    title.parent(section);

    let grid = createDiv('');
    grid.class('allowed-family-grid');
    grid.parent(section);

    for (let tileId of group.tileIds) {
      createTileOption(tileId, grid);
    }
  }
}


function selectAllTiles() {
  // Only select tiles in the allowed tiles area
  let options = selectAll('.tile-option', '#tileSelector');
  for (let opt of options) {
    opt.addClass('selected');
  }
  updateAllowedTypes();
  initGrid();
}

function selectNoneTiles() {
  // Only deselect tiles in the allowed tiles area
  let options = selectAll('.tile-option', '#tileSelector');
  for (let opt of options) {
    opt.removeClass('selected');
  }
  updateAllowedTypes();
  initGrid();
}

function updateAllowedTypes() {
  allowedTypes = [];
  // Only collect from allowed tiles area
  let options = selectAll('.tile-option', '#tileSelector');
  for (let opt of options) {
    if (opt.hasClass('selected')) {
      allowedTypes.push(parseInt(opt.attribute('data-type')));
    }
  }
}

function initGrid(recordHistory = true) {
  randomSeed(seed);
  
  if (recordHistory && !isRestoringHistory) {
      pushGenerationState();
  }
  
  // Clear Edit History on new generation
  if (!isRestoringHistory) {
      editHistory = [];
      editHistoryIndex = -1;
  }
  
  if (allowedTypes.length === 0) {
      tiles = [];
      background(0);
      return; 
  }

  // Calculate dimensions with margin
  let drawW = width - (margin * 2);
  let drawH = height - (margin * 2);
  
  if (drawW <= 0 || drawH <= 0) {
      tilesWidth = 0;
      tilesHeight = 0;
  } else {
      tilesWidth = drawW / cols;
      tilesHeight = drawH / rows;
  }

  tiles = [];
  
  // Create a 2D array to hold supertiles for reference
  let grid = new Array(cols).fill(0).map(() => new Array(rows));

  // Determine the center indices for symmetry.
  let centerX = ceil(cols / 2);
  let centerY = ceil(rows / 2);

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      
      let x = margin + j * tilesWidth + tilesWidth / 2;
      let y = margin + i * tilesHeight + tilesHeight / 2;
      
      // Determine the source coordinates. 
      // i=0,1,2,3. Maps to 0,1,1,0.
      let sourceI = i < centerY ? i : rows - 1 - i;
      let sourceJ = j < centerX ? j : cols - 1 - j;
      
      // Check if this tile IS the source tile
      if (i === sourceI && j === sourceJ) {
        // This is a source tile (Top-Left quadrant or center axes)
        let supertile = new Supertile(x, y, tilesWidth, tilesHeight, allowedTypes);
        grid[j][i] = supertile;
        tiles.push(supertile);
      } else {
        // This is a mirrored tile. 
        // We reuse the types from the source tile to ensure symmetry.
        let sourceTile = grid[sourceJ][sourceI];
        
        let supertile = new Supertile(x, y, tilesWidth, tilesHeight, allowedTypes);
        
        // Force the same types as the source
        // CRITICAL FIX: Ensure sourceTile exists before accessing property
        if (sourceTile && sourceTile.tiles) {
             // Copy types for each of the 4 independent quadrant tiles
             for(let k=0; k<4; k++) {
                 if (sourceTile.tiles[k] && sourceTile.tiles[k].types) {
                     supertile.tiles[k].types = [...sourceTile.tiles[k].types];
                     // Recreate buffer since we changed types
                     supertile.tiles[k].subtiles = [];
                     if (supertile.tiles[k].buffer) supertile.tiles[k].buffer.remove();
                     supertile.tiles[k].buffer = createGraphics(supertile.tiles[k].w, supertile.tiles[k].h);
                     supertile.tiles[k].create_subtiles();
                     supertile.tiles[k].render_to_buffer();
                 }
             }
        } else {
            // Fallback: This shouldn't happen if loop order is correct, but just in case
            console.warn(`Source tile missing at ${sourceJ},${sourceI} for target ${j},${i}`);
        }
        
        // Mark for mirroring in render
        supertile.mirrorX = (j >= cols / 2); 
        supertile.mirrorY = (i >= rows / 2); 
        
        tiles.push(supertile);
        grid[j][i] = supertile; 
      }
    }
  }
  
  redraw();
  
  // Push initial state for Edit History
  if (!isRestoringHistory) {
      // Clear previous history
      editHistory = [];
      editHistoryIndex = -1;
      pushEditState();
  }
}

function draw() {
  background(0);
  for (let tile of tiles) {
    if (tile.render) {
        tile.render();
    }
  }
  drawScopePreview();
  noLoop(); 
}

// -------------------------------------------------------------
// History Management
// -------------------------------------------------------------

function pushGenerationState() {
  if (isRestoringHistory) return;

  // Prune future states if we are in the middle of history
  if (generationIndex < generationHistory.length - 1) {
    generationHistory = generationHistory.slice(0, generationIndex + 1);
  }

  let state = {
    seed: seed,
    rows: rows,
    cols: cols,
    margin: margin,
    width: width,
    height: height,
    // allowed types logic is complex, storing just seed for now is often enough 
    // but if user changes allowed types, we should store it.
    // Simplifying for now to core params
    timestamp: new Date().toLocaleTimeString()
  };

  generationHistory.push(state);
  // Cap functionality
  if (generationHistory.length > 20) generationHistory.shift();
  
  generationIndex = generationHistory.length - 1;
  updateHistoryUI();
}

function restoreGenerationState(index) {
  if (index < 0 || index >= generationHistory.length) return;
  
  isRestoringHistory = true;
  let state = generationHistory[index];
  
  // Apply State
  seed = state.seed;
  rows = state.rows;
  cols = state.cols;
  margin = state.margin;
  
  // Update inputs
  select('#seedInput').value(seed);
  select('#gridRows').value(rows);
  select('#gridCols').value(cols);
  select('#gridMargin').value(margin);
  
  if (width !== state.width || height !== state.height) {
     resizeCanvas(state.width, state.height);
     select('#canvasW').value(width);
     select('#canvasH').value(height);
  }

  // Set internal index
  generationIndex = index;
  
  // Regenerate Grid without pushing new state
  initGrid(false); 
  
  isRestoringHistory = false;
  updateHistoryUI();
  if(window.updateAllSummaries) window.updateAllSummaries();
}

function pushEditState() {
  if (isRestoringHistory) return;

  // Prune future state if somehow we are back in history
  if (editHistoryIndex < editHistory.length - 1) {
     editHistory = editHistory.slice(0, editHistoryIndex + 1);
  }

  // Deep Snapshot of Current Grid Logic
  let snapshot = tiles.map(supertile => {
      // Create a clean object for the snapshot
      return {
          mirrorX: supertile.mirrorX,
          mirrorY: supertile.mirrorY,
          // Map the 4 subtiles and their properties
          tiles: supertile.tiles.map(t => ({
              types: [...t.types], // Deep copy of the array is critical
              rotation: t.rotation
          }))
      };
  });
  
  editHistory.push(snapshot);
  
  // Cap history size
  if (editHistory.length > 50) editHistory.shift();
  
  // Update index
  editHistoryIndex = editHistory.length - 1;
  
  updateHistoryUI();
}

function undoEdit() {
  if (editHistoryIndex > 0) {
    editHistoryIndex--;
    restoreEditState(editHistory[editHistoryIndex]);
  }
}

function redoEdit() {
  if (editHistoryIndex < editHistory.length - 1) {
    editHistoryIndex++;
    restoreEditState(editHistory[editHistoryIndex]);
  }
}

function restoreEditState(snapshot) {
   if (!snapshot) return;
   
   isRestoringHistory = true;
   
   // Safety check for grid size changes
   if (tiles.length !== snapshot.length) {
       console.warn("History Mismatch: Grid size likely changed.");
       isRestoringHistory = false;
       return;
   }
   
   // Apply snapshot to live objects
   for(let i=0; i<tiles.length; i++) {
       let st = tiles[i];
       let snap = snapshot[i];
       
       st.mirrorX = snap.mirrorX;
       st.mirrorY = snap.mirrorY;
       
       for(let j=0; j<4; j++) {
           let target = st.tiles[j];
           let source = snap.tiles[j];
           
           // Restore data
           target.types = [...source.types];
           target.rotation = source.rotation;
           
           // Re-render visual buffer
           // Ideally we recreate the buffer to ensure clean state
           if(target.buffer) target.buffer.remove();
           target.buffer = createGraphics(target.w, target.h);
           
           // Important: Regenerate the internal subtile objects based on the restored types
           target.subtiles = [];
           target.create_subtiles();
           target.render_to_buffer();
       }
   }
   
   redraw();
   isRestoringHistory = false;
   updateHistoryUI();
}

function updateHistoryUI() {
  // Generation Buttons
  let btnPrev = select('#btnPrevSeed');
  let btnNext = select('#btnNextSeed');
  if (btnPrev) {
    btnPrev.attribute('disabled', generationIndex <= 0 ? '' : null);
    if(generationIndex <= 0) btnPrev.attribute('disabled', 'true'); else btnPrev.removeAttribute('disabled');
  }
  if (btnNext) {
     if(generationIndex >= generationHistory.length - 1) btnNext.attribute('disabled', 'true'); else btnNext.removeAttribute('disabled');
  }

  // Edit Buttons
  let btnUndo = select('#btnUndo');
  let btnRedo = select('#btnRedo');
  if (btnUndo) {
      if(editHistoryIndex <= 0) btnUndo.attribute('disabled', 'true'); else btnUndo.removeAttribute('disabled');
  }
  if (btnRedo) {
      if(editHistoryIndex >= editHistory.length - 1) btnRedo.attribute('disabled', 'true'); else btnRedo.removeAttribute('disabled');
  }

  let editHistoryState = select('#editHistoryState');
  if (editHistoryState) {
    let currentStep = max(1, editHistoryIndex + 1);
    let totalSteps = max(1, editHistory.length);
    editHistoryState.html(`Step ${currentStep} / ${totalSteps}`);
  }
  
  // Update List (Optional)
  let list = select('#seedHistoryList');
  if (list) {
      list.html('');
      // Show last 20 (reversed)
      generationHistory.slice().reverse().forEach((state, reverseIdx) => {
          let realIdx = generationHistory.length - 1 - reverseIdx;
          let isCurrent = (realIdx === generationIndex);
          let item = createDiv(`#${state.seed} <span style="font-size:0.7em; color:#888">${state.timestamp}</span>`);
          item.style('padding', '6px 8px');
          item.style('cursor', 'pointer');
          item.style('border-bottom', '1px solid #333');
          item.style('font-size', '0.85rem');
          item.style('color', isCurrent ? '#fff' : '#bbb');
          item.style('background', isCurrent ? '#444' : 'transparent');
          item.mouseOver(() => item.style('background', isCurrent ? '#444' : '#333'));
          item.mouseOut(() => item.style('background', isCurrent ? '#444' : 'transparent'));
          
          item.mousePressed(() => {
             restoreGenerationState(realIdx);
             // Close dropdown on selection
             list.style('display', 'none');
          });
          list.child(item);
      });
      
      if (generationHistory.length === 0) {
          let empty = createDiv('No history yet');
          empty.style('padding', '8px');
          empty.style('color', '#888');
          empty.style('font-size', '0.8rem');
          empty.style('text-align', 'center');
          list.child(empty);
      }
  }
}

function getHitInfo(mx, my) {
  if (mx < margin || mx > width - margin || my < margin || my > height - margin) return null;

  let relativeX = mx - margin;
  let relativeY = my - margin;

  let col = floor(relativeX / tilesWidth);
  let row = floor(relativeY / tilesHeight);

  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;

  let index = row * cols + col;
  if (index < 0 || index >= tiles.length) return null;

  let supertile = tiles[index];
  let stLeft = supertile.x - supertile.w / 2;
  let stTop = supertile.y - supertile.h / 2;

  let localXVisual = mx - stLeft;
  let localYVisual = my - stTop;

  let halfW = supertile.w / 2;
  let halfH = supertile.h / 2;

  let visualCol = localXVisual >= halfW ? 1 : 0;
  let visualRow = localYVisual >= halfH ? 1 : 0;
  let visualQuadrant = visualRow * 2 + visualCol;

  let visualTileLocalXRaw = localXVisual - visualCol * halfW;
  let visualTileLocalYRaw = localYVisual - visualRow * halfH;
  visualTileLocalXRaw = constrain(visualTileLocalXRaw, 0, halfW - 0.0001);
  visualTileLocalYRaw = constrain(visualTileLocalYRaw, 0, halfH - 0.0001);
  let visualSubColRaw = visualTileLocalXRaw >= (halfW / 2) ? 1 : 0;
  let visualSubRowRaw = visualTileLocalYRaw >= (halfH / 2) ? 1 : 0;
  let visualSubtileDisplayIndex = visualSubRowRaw * 2 + visualSubColRaw;

  let visualTileLocalX = localXVisual - visualCol * halfW;
  let visualTileLocalY = localYVisual - visualRow * halfH;

  visualTileLocalX = constrain(visualTileLocalX, 0, halfW - 0.0001);
  visualTileLocalY = constrain(visualTileLocalY, 0, halfH - 0.0001);

  if (visualQuadrant === 1 || visualQuadrant === 3) visualTileLocalX = halfW - visualTileLocalX;
  if (visualQuadrant === 2 || visualQuadrant === 3) visualTileLocalY = halfH - visualTileLocalY;

  let visualSubCol = visualTileLocalX >= (halfW / 2) ? 1 : 0;
  let visualSubRow = visualTileLocalY >= (halfH / 2) ? 1 : 0;
  let visualSubtileIndex = visualSubRow * 2 + visualSubCol;

  let localXLogical = supertile.mirrorX ? (supertile.w - localXVisual) : localXVisual;
  let localYLogical = supertile.mirrorY ? (supertile.h - localYVisual) : localYVisual;

  let logicalCol = localXLogical >= halfW ? 1 : 0;
  let logicalRow = localYLogical >= halfH ? 1 : 0;
  let logicalQuadrant = logicalRow * 2 + logicalCol;

  let tileLocalX = localXLogical - logicalCol * halfW;
  let tileLocalY = localYLogical - logicalRow * halfH;

  tileLocalX = constrain(tileLocalX, 0, halfW - 0.0001);
  tileLocalY = constrain(tileLocalY, 0, halfH - 0.0001);

  if (logicalQuadrant === 1 || logicalQuadrant === 3) tileLocalX = halfW - tileLocalX;
  if (logicalQuadrant === 2 || logicalQuadrant === 3) tileLocalY = halfH - tileLocalY;

  let subCol = tileLocalX >= (halfW / 2) ? 1 : 0;
  let subRow = tileLocalY >= (halfH / 2) ? 1 : 0;
  let baseTileSubtileIndex = subRow * 2 + subCol;

  let targetTile = supertile.tiles[logicalQuadrant];
  let oldType = targetTile.types[baseTileSubtileIndex];

  return {
    index,
    supertile,
    visualQuadrant,
    visualSubtileDisplayIndex,
    visualSubtileIndex,
    logicalQuadrant,
    baseTileSubtileIndex,
    targetTile,
    oldType
  };
}

function mapVisualTargetToLogical(supertile, visualQuadrant, visualSubtileDisplayIndex) {
  let visualCol = visualQuadrant % 2;
  let visualRow = floor(visualQuadrant / 2);

  let logicalCol = supertile.mirrorX ? (1 - visualCol) : visualCol;
  let logicalRow = supertile.mirrorY ? (1 - visualRow) : visualRow;
  let logicalQuadrant = logicalRow * 2 + logicalCol;

  let subCol = visualSubtileDisplayIndex % 2;
  let subRow = floor(visualSubtileDisplayIndex / 2);

  if (supertile.mirrorX) subCol = 1 - subCol;
  if (supertile.mirrorY) subRow = 1 - subRow;

  if (logicalQuadrant === 1 || logicalQuadrant === 3) subCol = 1 - subCol;
  if (logicalQuadrant === 2 || logicalQuadrant === 3) subRow = 1 - subRow;

  let logicalSubtileIndex = subRow * 2 + subCol;

  return {
    quadrant: logicalQuadrant,
    subtileIndex: logicalSubtileIndex
  };
}

function buildScopePreviewTargets(hitInfo) {
  if (!hitInfo) return [];

  let targets = [];
  const pushTarget = (supertileIndex, quadrant, subtileIndex) => {
    targets.push({ supertileIndex, quadrant, subtileIndex });
  };

  if (interactionScope === 'single') {
    pushTarget(hitInfo.index, hitInfo.logicalQuadrant, hitInfo.baseTileSubtileIndex);
  } else if (interactionScope === 'supertile') {
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      pushTarget(hitInfo.index, quadrant, hitInfo.baseTileSubtileIndex);
    }
  } else if (interactionScope === 'global_exact') {
    for (let supertileIndex = 0; supertileIndex < tiles.length; supertileIndex++) {
      let supertile = tiles[supertileIndex];
      for (let quadrant = 0; quadrant < 4; quadrant++) {
        let tileObj = supertile.tiles[quadrant];
        for (let subtileIndex = 0; subtileIndex < 4; subtileIndex++) {
          if (tileObj.types[subtileIndex] === hitInfo.oldType) {
            pushTarget(supertileIndex, quadrant, subtileIndex);
          }
        }
      }
    }
  } else if (interactionScope === 'global_pos') {
    for (let supertileIndex = 0; supertileIndex < tiles.length; supertileIndex++) {
      let mapped = mapVisualTargetToLogical(
        tiles[supertileIndex],
        hitInfo.visualQuadrant,
        hitInfo.visualSubtileDisplayIndex
      );
      pushTarget(supertileIndex, mapped.quadrant, mapped.subtileIndex);
    }
  } else if (interactionScope === 'global_pos_sym') {
    for (let supertileIndex = 0; supertileIndex < tiles.length; supertileIndex++) {
      for (let quadrant = 0; quadrant < 4; quadrant++) {
        pushTarget(supertileIndex, quadrant, hitInfo.baseTileSubtileIndex);
      }
    }
  }

  return targets;
}

function updateHoverPreview(mx = mouseX, my = mouseY) {
  if (interactionMode === 'none' || (interactionMode === 'edit' && zoomToolActive)) {
    hoverPreviewTargets = [];
    hoverPreviewAnchor = null;
    return;
  }

  let hitInfo = getHitInfo(mx, my);
  if (!hitInfo) {
    hoverPreviewTargets = [];
    hoverPreviewAnchor = null;
    return;
  }

  hoverPreviewTargets = buildScopePreviewTargets(hitInfo);
  let anchorQuadrant = hitInfo.logicalQuadrant;
  let anchorSubtileIndex = hitInfo.baseTileSubtileIndex;
  if (interactionScope === 'global_pos') {
    let mapped = mapVisualTargetToLogical(
      hitInfo.supertile,
      hitInfo.visualQuadrant,
      hitInfo.visualSubtileDisplayIndex
    );
    anchorQuadrant = mapped.quadrant;
    anchorSubtileIndex = mapped.subtileIndex;
  }

  hoverPreviewAnchor = {
    supertileIndex: hitInfo.index,
    quadrant: anchorQuadrant,
    subtileIndex: anchorSubtileIndex
  };
}

function drawSubtileOverlay(supertile, quadrant, subtileIndex, isAnchor) {
  let tileW = supertile.w / 2;
  let tileH = supertile.h / 2;

  let subCol = subtileIndex % 2;
  let subRow = floor(subtileIndex / 2);

  let centerX = (subCol - 0.5) * tileW / 2;
  let centerY = (subRow - 0.5) * tileH / 2;

  let rectX = centerX - tileW / 4;
  let rectY = centerY - tileH / 4;
  let rectW = tileW / 2;
  let rectH = tileH / 2;

  push();
  translate(supertile.x, supertile.y);
  if (supertile.mirrorX) scale(-1, 1);
  if (supertile.mirrorY) scale(1, -1);

  if (quadrant === 0) {
    translate(-supertile.w / 4, -supertile.h / 4);
  } else if (quadrant === 1) {
    translate(supertile.w / 4, -supertile.h / 4);
    scale(-1, 1);
  } else if (quadrant === 2) {
    translate(-supertile.w / 4, supertile.h / 4);
    scale(1, -1);
  } else if (quadrant === 3) {
    translate(supertile.w / 4, supertile.h / 4);
    scale(-1, -1);
  }

  rectMode(CORNER);
  let lineW = max(1.0, min(rectW, rectH) * 0.04);

  if (isAnchor) {
    noStroke();
    fill(255, 170, 70, 78);
    rect(rectX, rectY, rectW, rectH, 2);

    stroke(255, 242, 220, 255);
    strokeWeight(lineW + 1.2);
    noFill();
    rect(rectX, rectY, rectW, rectH, 2);

    stroke(255, 150, 60, 220);
    strokeWeight(lineW + 0.3);
    rect(rectX + 0.8, rectY + 0.8, max(0, rectW - 1.6), max(0, rectH - 1.6), 2);
  } else {
    noStroke();
    fill(60, 150, 235, 56);
    rect(rectX, rectY, rectW, rectH, 2);

    stroke(205, 230, 255, 235);
    strokeWeight(lineW + 0.5);
    noFill();
    rect(rectX, rectY, rectW, rectH, 2);
  }

  pop();
}

function drawScopePreview() {
  if (interactionMode === 'none' || (interactionMode === 'edit' && zoomToolActive) || hoverPreviewTargets.length === 0) return;

  for (let marker of hoverPreviewTargets) {
    let supertile = tiles[marker.supertileIndex];
    if (!supertile) continue;

    let isAnchor = hoverPreviewAnchor
      && hoverPreviewAnchor.supertileIndex === marker.supertileIndex
      && hoverPreviewAnchor.quadrant === marker.quadrant
      && hoverPreviewAnchor.subtileIndex === marker.subtileIndex;

    drawSubtileOverlay(supertile, marker.quadrant, marker.subtileIndex, isAnchor);
  }
}

// -------------------------------------------------------------
// Mouse & Key Interaction
// -------------------------------------------------------------

// Replaced by window event listener below for better reliability
/*
function keyPressed() {
  // Ctrl+Z Undo
  if (keyIsDown(CONTROL) && (key === 'z' || key === 'Z')) {
    if (keyIsDown(SHIFT)) {
      redoEdit();
    } else {
      undoEdit();
    }
  }
  
  // Ctrl+Y Redo (Windows standard)
  if (keyIsDown(CONTROL) && (key === 'y' || key === 'Y')) {
    redoEdit();
  }
}
*/

// Global Key Handler
window.addEventListener('keydown', (e) => {
    // Check if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;

  if (isAssetsTabActive() && (e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (triggerAssetsDeleteShortcut()) {
      e.preventDefault();
      return;
    }
  }

  if (isAssetsTabActive() && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    let direction = e.key === 'ArrowLeft' ? -1 : 1;
    if (triggerAssetsReorderShortcut(direction)) {
      e.preventDefault();
      return;
    }
  }

  if (isAssetsTabActive() && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    let direction = e.key === 'ArrowUp' ? -1 : 1;
    if (triggerAssetsFamilyReorderShortcut(direction)) {
      e.preventDefault();
      return;
    }
  }

  if (isAssetsTabActive() && !e.ctrlKey && !e.metaKey && e.shiftKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
    if (triggerAssetsMoveExtremeShortcut(-1)) {
      e.preventDefault();
      return;
    }
  }

  if (isAssetsTabActive() && !e.ctrlKey && !e.metaKey && e.shiftKey && !e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
    if (triggerAssetsMoveExtremeShortcut(1)) {
      e.preventDefault();
      return;
    }
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'r' && isEditTabActive()) {
    if (typeof window.toggleEditToolMode === 'function') {
      window.toggleEditToolMode();
      e.preventDefault();
      return;
    }
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'z' && !isAssetsTabActive()) {
    zoomToolActive = !zoomToolActive;
    if (typeof window.refreshCanvasStatusHint === 'function') {
      window.refreshCanvasStatusHint();
    }
    if (typeof updateCanvasCursorHandler === 'function') {
      updateCanvasCursorHandler();
    }
    e.preventDefault();
    return;
  }

    // Ctrl+Z: Undo or Redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (isAssetsTabActive()) {
        if (e.shiftKey) {
          restoreAssetsHistoryTo(assetsHistoryIndex + 1);
        } else {
          restoreAssetsHistoryTo(assetsHistoryIndex - 1);
        }
        e.preventDefault();
        return;
      }

        if (e.shiftKey) {
            // Ctrl+Shift+Z acts as Redo
            redoEdit();
        } else {
            undoEdit();
        }
        e.preventDefault();
        return;
    }

    // Ctrl+Y: Redo (Windows standard)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      if (isAssetsTabActive()) {
        restoreAssetsHistoryTo(assetsHistoryIndex + 1);
      } else {
        redoEdit();
      }
      e.preventDefault();
      return;
    }
    
    // Previous Generation (Arrow Left)
    if (isSetupTabActive() && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key === 'ArrowLeft') {
        let bPrev = select('#btnPrevSeed');
        if(bPrev && !bPrev.attribute('disabled')) restoreGenerationState(generationIndex - 1);
    }

    // Next Generation (Arrow Right)
    if (isSetupTabActive() && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key === 'ArrowRight') {
        let bNext = select('#btnNextSeed');
        if(bNext && !bNext.attribute('disabled')) restoreGenerationState(generationIndex + 1);
    }
});

let isDrawing = false; // Add state to track if drag started on canvas

function isEditTabActive() {
  let editTab = document.getElementById('tab-edit');
  return !!(editTab && editTab.classList.contains('active'));
}

function isAssetsTabActive() {
  let assetsTab = document.getElementById('tab-assets');
  return !!(assetsTab && assetsTab.classList.contains('active'));
}

function isSetupTabActive() {
  let setupTab = document.getElementById('tab-setup');
  return !!(setupTab && setupTab.classList.contains('active'));
}

function triggerAssetsDeleteShortcut() {
  if (!isAssetsTabActive()) return false;

  let removeTileBtn = document.getElementById('btnRemoveSelectedTile');
  let removeFamilyBtn = document.getElementById('btnRemoveFamilyFromList');

  let hasTileSelection = getSelectedTileIdsInActiveFamily().length > 0;
  let hasFamilySelection = getSelectedFamilyLabels().length > 0;

  if (assetsUiState.lastSelectionKind === 'tile' && hasTileSelection && removeTileBtn) {
    removeTileBtn.click();
    return true;
  }

  if (assetsUiState.lastSelectionKind === 'family' && hasFamilySelection && removeFamilyBtn) {
    removeFamilyBtn.click();
    return true;
  }

  if (hasTileSelection && removeTileBtn) {
    removeTileBtn.click();
    return true;
  }

  if (hasFamilySelection && removeFamilyBtn) {
    removeFamilyBtn.click();
    return true;
  }

  return false;
}

function triggerAssetsReorderShortcut(direction) {
  if (!isAssetsTabActive()) return false;
  if (direction !== -1 && direction !== 1) return false;

  try {
    if (assetsUiState.lastSelectionKind === 'family') {
      return reorderSelectedFamiliesBulkByDirection(direction);
    }

    if (reorderSelectedTilesBulkByDirection(direction)) {
      return true;
    }

    if (getSelectedTileIdsInActiveFamily().length === 0) {
      return reorderSelectedFamiliesBulkByDirection(direction);
    }

    return false;
  } catch (err) {
    setSvgStatus(`Reorder failed: ${err.message || err}`, 'error');
    return false;
  }
}

function triggerAssetsFamilyReorderShortcut(direction) {
  if (!isAssetsTabActive()) return false;
  if (direction !== -1 && direction !== 1) return false;

  try {
    return reorderSelectedFamiliesBulkByDirection(direction);
  } catch (err) {
    setSvgStatus(`Family reorder failed: ${err.message || err}`, 'error');
    return false;
  }
}

function triggerAssetsMoveExtremeShortcut(direction) {
  if (!isAssetsTabActive()) return false;
  if (direction !== -1 && direction !== 1) return false;

  try {
    if (assetsUiState.lastSelectionKind === 'family') {
      return direction < 0 ? moveSelectedFamiliesToTop() : moveSelectedFamiliesToBottom();
    }

    if ((direction < 0 ? moveSelectedTilesToTop() : moveSelectedTilesToBottom())) {
      return true;
    }

    if (getSelectedTileIdsInActiveFamily().length === 0) {
      return direction < 0 ? moveSelectedFamiliesToTop() : moveSelectedFamiliesToBottom();
    }

    return false;
  } catch (err) {
    setSvgStatus(`Move failed: ${err.message || err}`, 'error');
    return false;
  }
}

function getPointerInteractionMode() {
  let isMobileInput = window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches;

  if ((isEditTabActive() || isSetupTabActive()) && zoomToolActive) {
    return 'zoom';
  }

  if (isMobileInput && isEditTabActive()) {
    return editToolMode;
  }

  if (isEditTabActive()) {
    if (mouseButton === RIGHT) {
      return editToolMode === 'edit' ? 'mirror' : 'edit';
    }
    return editToolMode;
  }
  return interactionMode;
}

function mousePressed() {
    // Only interact if click is on canvas
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
        isDrawing = false;
        return;
    }

  let pointerMode = getPointerInteractionMode();

  if (pointerMode === 'zoom') {
    if (applyCanvasZoomHandler) {
      let zoomDelta = (mouseButton === RIGHT) ? -canvasZoomStep : canvasZoomStep;
      applyCanvasZoomHandler(canvasZoomPercent + zoomDelta);
    }
    isDrawing = false;
    return;
  }
    
    // Ignore clicks if mode is none
  if (pointerMode === 'none') return;
    
    isDrawing = true;
    
    // Reset interaction tracker for new gesture
    lastInteractedId = null;

    updateHoverPreview(mouseX, mouseY);
    
    handleTileClick(mouseX, mouseY, pointerMode);
}

function mouseDragged() {
    // Only draw if we started on the canvas
    if (!isDrawing) return;

    // Only interact if drag is on canvas
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

    let pointerMode = getPointerInteractionMode();

    if (pointerMode === 'zoom') return;
    
    // Ignore clicks if mode is none
    if (pointerMode === 'none') return;
    
    updateHoverPreview(mouseX, mouseY);
    handleTileClick(mouseX, mouseY, pointerMode);
}

  function mouseMoved() {
    updateHoverPreview(mouseX, mouseY);
    redraw();
  }

  function mouseOut() {
    hoverPreviewTargets = [];
    hoverPreviewAnchor = null;
    redraw();
  }

function mouseReleased() {
    isDrawing = false;
    lastInteractedId = null;

    updateHoverPreview(mouseX, mouseY);
    redraw();
    
    // If a gesture modified the history, push the new state now
    if (hasPendingHistory) {
        pushEditState();
        hasPendingHistory = false;
    }
}

function handleTileClick(mx, my, modeOverride = null) {
  let effectiveMode = modeOverride || interactionMode;
  let hitInfo = getHitInfo(mx, my);
  if (!hitInfo) return;

  let index = hitInfo.index;
  let supertile = hitInfo.supertile;
  let visualQuadrant = hitInfo.visualQuadrant;
  let logicalQuadrant = hitInfo.logicalQuadrant;
  let baseTileSubtileIndex = hitInfo.baseTileSubtileIndex;
  let activeSubtileIndex = baseTileSubtileIndex;
  let activeQuadrant = logicalQuadrant;

  if (interactionScope === 'global_pos') {
    let mappedCurrent = mapVisualTargetToLogical(
      supertile,
      visualQuadrant,
      hitInfo.visualSubtileDisplayIndex
    );
    activeQuadrant = mappedCurrent.quadrant;
    activeSubtileIndex = mappedCurrent.subtileIndex;
  }
    
    // Unique ID for this specific subtile location
    // Format: SupertileIndex | VisualQuadrant | SubtileIndex
    let currentTileId = `${index}-${visualQuadrant}-${activeSubtileIndex}`;
    
    // If we are dragging over the same tile, ignore
    if (currentTileId === lastInteractedId) return;
    
    // Update tracker
    lastInteractedId = currentTileId;

    // Tile to edit in data space (logical quadrant)
    let targetTile = supertile.tiles[activeQuadrant];
    
    let oldType = hitInfo.oldType;
    let newType = oldType;
    
    const resolveMirrorType = (sourceType) => {
      if (keyIsDown(SHIFT)) {
        // Shift + Click: Randomize (Reseed)
        if (allowedTypes && allowedTypes.length > 0) {
          return random(allowedTypes);
        }
        return floor(random(totalTileTypes));
      }
      // Standard Click: Cycle Family for this specific source tile.
      return getNextInFamily(sourceType);
    };

    if (effectiveMode === 'mirror') {
        if (keyIsDown(SHIFT)) {
             // Shift + Click: Randomize (Reseed)
             // Prioritize "Allowed Types" if any are selected, else fully random
             if (allowedTypes && allowedTypes.length > 0) {
                 newType = random(allowedTypes);
             } else {
                 newType = floor(random(totalTileTypes));
             }
        } else {
             // Standard Click: Cycle Family
             newType = getNextInFamily(oldType);
        }
    } else if (effectiveMode === 'edit') {
      // WYSIWYG Painting:
      // Keep visual orientation equal to the selected brush, including single scope.

      // 1. Local Quadrant Flip (based on logical quadrant index)
      // 0: None, 1: FlipX, 2: FlipY, 3: FlipXY
      let isFlippedX = (logicalQuadrant === 1 || logicalQuadrant === 3);
      let isFlippedY = (logicalQuadrant === 2 || logicalQuadrant === 3);

      if (interactionScope === 'global_pos') {
        isFlippedX = (activeQuadrant === 1 || activeQuadrant === 3);
        isFlippedY = (activeQuadrant === 2 || activeQuadrant === 3);
      }

      // 2. Global Mirror Flip
      // If global mirror is active, the coordinate system is flipped.
      // This affects how the tile is rendered on screen.
      if (supertile.mirrorX) isFlippedX = !isFlippedX;
      if (supertile.mirrorY) isFlippedY = !isFlippedY;

      // 3. Get the inverse tile
      newType = getTransformedTile(currentPaintTile, isFlippedX, isFlippedY);
    }
    
    // console.log("OldType", oldType, "NewType", newType, "Mode", interactionMode);

    // In batch mirror scopes, each target computes its own next tile based on its current family.
    // So we can only early-return safely for non-batch interactions.
    if (oldType === newType && effectiveMode !== 'edit') {
      let isBatchMirrorScope = effectiveMode === 'mirror' && (
        interactionScope === 'supertile'
        || interactionScope === 'global_pos'
        || interactionScope === 'global_pos_sym'
      );
      if (!isBatchMirrorScope) return;
    }
    
    // Flag that a modification is happening
    // Note: For 'edit' mode (painting), we might be painting the same color. 
    // Ideally we check deeply, but dragging over same color is rare behavior to undo.
    hasPendingHistory = true;

    // Helper to update a single tile instance and redraw/recreate its buffer
    const refreshTile = (tileObj) => {
        tileObj.subtiles = [];
        if(tileObj.buffer) tileObj.buffer.remove();
        tileObj.buffer = createGraphics(tileObj.w, tileObj.h);
        tileObj.create_subtiles();
        tileObj.render_to_buffer();
    };

    // Apply Change based on Scope
    if (interactionScope === 'single') {
        // True Single: Only this quadrant, this subtile
        targetTile.types[activeSubtileIndex] = newType;
        refreshTile(targetTile);

    } else if (interactionScope === 'supertile') {
        // Current "Single" behavior: Update mirror-equivalent subtiles in all 4 quadrants of THIS supertile
        for(let t of supertile.tiles) {
          let nextType = (effectiveMode === 'mirror')
            ? resolveMirrorType(t.types[activeSubtileIndex])
            : newType;
          t.types[activeSubtileIndex] = nextType;
            refreshTile(t);
        }

    } else if (interactionScope === 'global_exact') {
        // Global Exact: Update ALL subtiles that match oldType to newType
        for (let s of tiles) {
            for (let t of s.tiles) {
                let changed = false;
                for (let i = 0; i < 4; i++) {
                    if (t.types[i] === oldType) {
                        t.types[i] = newType;
                        changed = true;
                    }
                }
                if (changed) {
                    refreshTile(t);
                }
            }
        }
    } else if (interactionScope === 'global_pos') {
        // Global Equivalent by Position (Single): 
      // Update the same visual slot in ALL supertiles.
        for (let s of tiles) {
        let mapped = mapVisualTargetToLogical(s, visualQuadrant, hitInfo.visualSubtileDisplayIndex);
        let t = s.tiles[mapped.quadrant]; 
        let nextType = (effectiveMode === 'mirror')
          ? resolveMirrorType(t.types[mapped.subtileIndex])
          : newType;
        t.types[mapped.subtileIndex] = nextType;
            refreshTile(t);
        }
    } else if (interactionScope === 'global_pos_sym') {
        // Global Equivalent by Position (Symmetric / Batch):
      // Update the same structural subtile slot in all 4 quadrants of ALL supertiles.
        for (let s of tiles) {
        for (let t of s.tiles) {
          let nextType = (effectiveMode === 'mirror')
            ? resolveMirrorType(t.types[baseTileSubtileIndex])
            : newType;
          t.types[baseTileSubtileIndex] = nextType;
                refreshTile(t);
            }
        }
    }
    
    redraw();
}

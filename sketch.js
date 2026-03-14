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

// Interaction State
let interactionMode = 'none'; // 'none' (Setup tab) or 'edit' (Edit tab). Right-click temporarily rotates.
let editToolMode = 'edit'; // 'edit' (paint) or 'mirror' (rotate)
let interactionScope = 'single'; // 'single', 'global'
let currentPaintTile = 0;
let lastInteractedId = null; // Tracks the last tile modified during a drag operation
let hoverPreviewTargets = [];
let hoverPreviewAnchor = null;

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
  selectedTileId: null,
  editorTransform: {
    rotate: 0,
    flipX: false,
    flipY: false
  }
};

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

function renderEditorToolbarState(canEditUploaded) {
  let btnMirrorX = document.getElementById('btnEditorMirrorX');
  let btnMirrorY = document.getElementById('btnEditorMirrorY');
  let btnRotateCW = document.getElementById('btnEditorRotateCW');
  let btnRotateCCW = document.getElementById('btnEditorRotateCCW');

  if (btnRotateCW) btnRotateCW.disabled = !canEditUploaded;
  if (btnRotateCCW) btnRotateCCW.disabled = !canEditUploaded;
  if (btnMirrorX) {
    btnMirrorX.disabled = !canEditUploaded;
    btnMirrorX.classList.toggle('active', !!assetsUiState.editorTransform.flipX);
  }
  if (btnMirrorY) {
    btnMirrorY.disabled = !canEditUploaded;
    btnMirrorY.classList.toggle('active', !!assetsUiState.editorTransform.flipY);
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

  let visibleTiles = new Set(getSelectedFamilyTiles());
  if (!Number.isInteger(assetsUiState.selectedTileId) || !visibleTiles.has(assetsUiState.selectedTileId)) {
    assetsUiState.selectedTileId = visibleTiles.size > 0 ? [...visibleTiles][0] : null;
  }
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
  if (!familyList) return;

  let summary = getFamilySummaryForManager();
  let uploadedTiles = listUploadedTiles();
  let uploadedFamilySet = new Set(uploadedTiles.map((item) => item.familyLabel));
  familyList.innerHTML = '';

  if (summary.length === 0) {
    familyList.innerHTML = '<div class="status-text">No families available yet.</div>';
    return;
  }

  for (let item of summary) {
    let row = document.createElement('div');
    row.className = `family-item${assetsUiState.selectedFamily === item.label ? ' active' : ''}`;

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

    row.addEventListener('click', () => {
      assetsUiState.selectedFamily = item.label;
      ensureAssetSelection();
      updateAssetUploadTargetLabel();
      renderAssetFamilyList();
      renderAssetTileGrid();
      renderAssetInspector();
    });

    familyList.appendChild(row);
  }
}

function renderAssetTileGrid() {
  let container = document.getElementById('assetTileGrid');
  if (!container) return;

  container.innerHTML = '';
  let tileIds = getSelectedFamilyTiles();

  if (tileIds.length === 0) {
    container.innerHTML = '<div class="status-text">No visible tiles in this family.</div>';
    return;
  }

  for (let tileId of tileIds) {
    let card = document.createElement('div');
    card.className = `family-tile-card${assetsUiState.selectedTileId === tileId ? ' active' : ''}`;

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

    card.addEventListener('click', () => {
      assetsUiState.selectedTileId = tileId;
      assetsUiState.editorTransform = { rotate: 0, flipX: false, flipY: false };
      renderAssetTileGrid();
      renderAssetInspector();
    });

    container.appendChild(card);
  }
}

function renderAssetInspector() {
  let empty = document.getElementById('assetInspectorEmpty');
  let content = document.getElementById('assetInspectorContent');
  let tileMeta = getSelectedTileMeta();

  if (!empty || !content) return;
  if (!tileMeta) {
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
  let moveFamilySelect = document.getElementById('assetMoveFamilySelect');
  let btnCreateEdited = document.getElementById('btnCreateEditedTile');

  if (thumb) thumb.src = getTileThumbnailSrc(tileMeta.tileId, 72);
  if (title) title.textContent = `${tileMeta.name} (#${tileMeta.tileId})`;
  if (meta) {
    let sourceLabel = tileMeta.uploaded ? 'Uploaded' : 'Built-in';
    meta.textContent = `${sourceLabel} | Family: ${tileMeta.familyLabel}`;
  }

  if (tileNameInput) tileNameInput.value = tileMeta.name;

  fillFamilySelect(moveFamilySelect, false);
  if (moveFamilySelect && Array.from(moveFamilySelect.options).some((op) => op.value === tileMeta.familyLabel)) {
    moveFamilySelect.value = tileMeta.familyLabel;
  }

  let canEditUploaded = !!tileMeta.uploaded;
  let canEditInEditor = true;
  if (btnCreateEdited) btnCreateEdited.disabled = !canEditInEditor;

  updateEditorTransformFromControls();
  renderEditorToolbarState(canEditInEditor);
  renderEditorPreview(tileMeta);
}

function refreshAssetsManagerUI() {
  ensureAssetSelection();
  updateAssetUploadTargetLabel();

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

  if (!uploadInput || !btnAdd) return;

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
        window.SVGTileManager.downloadBackup();
        setSvgStatus('Backup exported successfully.', 'success');
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

        let result = window.SVGTileManager.importBackupText(text);
        if (result.imported > 0 || result.registryApplied) {
          refreshTileCatalogUI(result.ids);
          setSvgStatus(`Backup imported: ${result.imported} new tile(s), ${result.skipped} skipped.${result.registryApplied ? ' Registry state restored.' : ''}`, 'success');
        } else {
          setSvgStatus(`Backup processed: 0 imported, ${result.skipped} skipped.`, 'error');
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
        setSvgStatus('Built-ins restored to default layout.', 'success');
        refreshTileCatalogUI();
      } catch (err) {
        setSvgStatus(`Built-in restore failed: ${err.message || err}`, 'error');
      }
    });
  }

  let btnRenameTile = document.getElementById('btnApplyTileRename');
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
        setSvgStatus(`Tile renamed to "${nextName}".`, 'success');
        refreshTileCatalogUI([tileMeta.tileId]);
      } catch (err) {
        setSvgStatus(`Tile rename failed: ${err.message || err}`, 'error');
      }
    });
  }

  let btnMoveTile = document.getElementById('btnMoveTileFamily');
  if (btnMoveTile) {
    btnMoveTile.addEventListener('click', (e) => {
      e.preventDefault();
      let tileMeta = getSelectedTileMeta();
      let selectFamily = document.getElementById('assetMoveFamilySelect');
      if (!tileMeta || !selectFamily) return;
      let targetFamily = selectFamily.value;
      if (!targetFamily || targetFamily === tileMeta.familyLabel) return;
      try {
        if (tileMeta.uploaded && window.SVGTileManager && typeof window.SVGTileManager.moveUploadedTileToFamily === 'function') {
          window.SVGTileManager.moveUploadedTileToFamily(tileMeta.tileId, targetFamily);
        } else if (typeof window.moveTileToFamily === 'function') {
          window.moveTileToFamily(tileMeta.tileId, targetFamily);
        } else {
          throw new Error('Move tile API not available.');
        }
        assetsUiState.selectedFamily = targetFamily;
        setSvgStatus(`Tile moved to family "${targetFamily}".`, 'success');
        refreshTileCatalogUI([tileMeta.tileId]);
      } catch (err) {
        setSvgStatus(`Move failed: ${err.message || err}`, 'error');
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
        setSvgStatus(`Family "${label}" created.`, 'success');
        refreshTileCatalogUI();
      } catch (err) {
        setSvgStatus(`Family create failed: ${err.message || err}`, 'error');
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
        setSvgStatus(`Family renamed to "${newFamilyLabel}".`, 'success');
        refreshTileCatalogUI();
      } catch (err) {
        setSvgStatus(`Family rename failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnRemoveFamilyFromList) {
    btnRemoveFamilyFromList.addEventListener('click', (e) => {
      e.preventDefault();
      if (!assetsUiState.selectedFamily) {
        setSvgStatus('Select a family first.', 'error');
        return;
      }

      let targetFamily = assetsUiState.selectedFamily;
      if (targetFamily.startsWith('builtin-')) {
        setSvgStatus('Built-in families cannot be removed.', 'error');
        return;
      }

      let summary = getFamilySummaryForManager().find((item) => item.label === targetFamily);
      let familyTileIds = summary ? summary.tileIds : [];
      let uploadedTileIds = familyTileIds.filter((id) => !!getUploadedTileMeta(id));
      let nonUploadedCount = familyTileIds.length - uploadedTileIds.length;

      if (nonUploadedCount > 0) {
        setSvgStatus(`Cannot remove family "${targetFamily}" while it still has ${nonUploadedCount} non-uploaded tile(s). Move them first.`, 'error');
        return;
      }

      if (!window.confirm(`Remove family "${targetFamily}" and all uploaded tiles inside it?`)) return;

      try {
        if (window.SVGTileManager && typeof window.SVGTileManager.deleteUploadedFamily === 'function') {
          window.SVGTileManager.deleteUploadedFamily(targetFamily);
        }
        if (typeof window.removeTileFamily === 'function') {
          window.removeTileFamily(targetFamily);
        }
        assetsUiState.selectedFamily = null;
        setSvgStatus(`Family "${targetFamily}" removed.`, 'success');
        refreshTileCatalogUI();
      } catch (err) {
        setSvgStatus(`Family remove failed: ${err.message || err}`, 'error');
      }
    });
  }

  let btnRemoveTile = document.getElementById('btnRemoveSelectedTile');
  if (btnRemoveTile) {
    btnRemoveTile.addEventListener('click', (e) => {
      e.preventDefault();
      let tileMeta = getSelectedTileMeta();
      if (!tileMeta || !tileMeta.uploaded) {
        setSvgStatus('Only uploaded tiles can be removed.', 'error');
        return;
      }
      if (!window.confirm(`Remove uploaded tile "${tileMeta.name}"?`)) return;
      try {
        if (!window.SVGTileManager || typeof window.SVGTileManager.deleteUploadedTile !== 'function') {
          throw new Error('Tile remove API not available.');
        }
        let ok = window.SVGTileManager.deleteUploadedTile(tileMeta.tileId);
        if (!ok) throw new Error('Tile could not be removed.');
        setSvgStatus(`Tile "${tileMeta.name}" removed.`, 'success');
        refreshTileCatalogUI();
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
      assetsUiState.editorTransform.flipX = !assetsUiState.editorTransform.flipX;
      rerenderEditorFromState();
    });
  }

  if (btnMirrorY) {
    btnMirrorY.addEventListener('click', (e) => {
      e.preventDefault();
      let tileMeta = getSelectedTileMeta();
      if (!tileMeta) return;
      assetsUiState.editorTransform.flipY = !assetsUiState.editorTransform.flipY;
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
        setSvgStatus(`Edited tile created: #${created.tileId}.`, 'success');
        refreshTileCatalogUI([created.tileId]);
      } catch (err) {
        setSvgStatus(`Could not create edited tile: ${err.message || err}`, 'error');
      }
    });
  }

  btnAdd.addEventListener('click', async (e) => {
    e.preventDefault();

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
  });
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

  select('#seedInput').value(seed);
  select('#seedInput').input(() => { 
    let val = parseInt(select('#seedInput').value());
    if (!isNaN(val)) { seed = val; initGrid(); }
  });
  
  select('#btnRandomize').mousePressed(() => {
    seed = floor(random(10000));
    select('#seedInput').value(seed);
    initGrid();
    if(window.updateAllSummaries) window.updateAllSummaries();
  });
  
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
  
  // Use Vanilla JS for save button to ensure reliability
  let btnSave = document.getElementById('btnSave');
  if (btnSave) {
    btnSave.addEventListener('click', (e) => {
      e.preventDefault(); 
      e.stopPropagation();

      let ratio = (width / height).toFixed(2);
      let timestamp = year() + nf(month(), 2) + nf(day(), 2) + '-' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
      let filename = `tilling_stripes_seed-${seed}_${width}x${height}_ratio-${ratio}_${timestamp}.png`;
      
      // Manual save to avoid potential p5.js/browser conflicts
      // mainCanvas is a p5.Element, .elt is the HTML5 canvas
      try {
        let dataURL = mainCanvas.elt.toDataURL('image/png');
        let link = document.createElement('a');
        link.download = filename;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("Error saving canvas:", err);
      }
    });
  }

  // Save SVG Logic
  let btnSaveSVG = document.getElementById('btnSaveSVG');
  if (btnSaveSVG) {
    btnSaveSVG.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            // Create off-screen SVG graphics using our custom SimpleSVG context
            let svg = new SimpleSVG(width, height);
            
            // Note: We do NOT draw a background rect here, so the background is transparent.
            // This is ideal for plotting.
            
            // Render all tiles to SVG buffer
            // We pass 'black' (or any dark color) to force high contrast for the plotter
            // regardless of the on-screen colors (which might be white-on-black).
            let exportColor = 'black'; 

            for (let tile of tiles) {
                if (typeof tile.renderVector === 'function') {
                    // Pass export color down the chain
                    tile.renderVector(svg, exportColor);
                } else {
                    console.warn('Tile missing renderVector method');
                }
            }

            let ratio = (width / height).toFixed(2);
            let timestamp = year() + nf(month(), 2) + nf(day(), 2) + '-' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
            let filename = `tilling_stripes_seed-${seed}_${width}x${height}_ratio-${ratio}_${timestamp}.svg`;
            
            svg.save(filename);
            
        } catch (err) {
            console.error("Error saving SVG:", err);
            alert("Error saving SVG. See console for details.");
        }
    });
  }

  select('#selectAll').mousePressed(selectAllTiles);
  select('#selectNone').mousePressed(selectNoneTiles);

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
       redraw();
     } else if (tab === 'edit') {
         setAssetsManagerMode(false);
         interactionMode = 'edit';
         updateEditUI();
       updateHoverPreview();
       updateCanvasStatusHint();
       redraw();
     } else {
         setAssetsManagerMode(true);
         interactionMode = 'none';
         updateEditUI();
       refreshAssetsManagerUI();
       updateHoverPreview();
       updateCanvasStatusHint();
       redraw();
     }
  });
  
  // Set initial UI state
  updateEditUI();
  updateEditModeUI();
  setAssetsManagerMode(false);
  updateCanvasStatusHint();

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

  for (let i = 0; i < totalTileTypes; i++) {
    if (!isTileVisible(i)) continue;
    // Create wrapper div
    let div = createDiv('');
    div.class('tile-option');
    div.attribute('data-type', i);
    
    // Restore selection state from global allowedTypes
    if (allowedTypes.includes(i)) {
        div.addClass('selected');
    }

    // Add tooltip
    if (typeof TILE_NAMES !== 'undefined' && TILE_NAMES[i]) {
        div.attribute('title', `#${i}: ${TILE_NAMES[i]}`);
    } else {
        div.attribute('title', 'Tile #' + i);
    }

    div.parent(container);

    let uploadedMeta = getUploadedTileMeta(i);
    let thumbSrc = uploadedMeta && uploadedMeta.thumbnailDataUrl;
    
    // Convert to image element and append to div
    let img;
    if (thumbSrc) {
      img = createImg(thumbSrc);
    } else {
      let gfx = createGraphics(80, 80);
      let c = color(220);
      let s = new Subtile(80, 80, i);
      s.color = c;
      s.render(gfx, 40, 40);
      img = createImg(gfx.canvas.toDataURL());
      gfx.remove();
    }
    img.style('width', '100%');
    img.style('height', '100%');
    img.style('display', 'block');
    img.parent(div);

    // Click event
    div.mousePressed(() => {
      // Normal behavior: Toggle allowed types
      if (div.hasClass('selected')) {
        div.removeClass('selected');
      } else {
        div.addClass('selected');
      }
      updateAllowedTypes();
      initGrid();
    });
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
  if (interactionMode === 'none') {
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
  if (interactionMode === 'none' || hoverPreviewTargets.length === 0) return;

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
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'r' && isEditTabActive()) {
    if (typeof window.toggleEditToolMode === 'function') {
      window.toggleEditToolMode();
      e.preventDefault();
      return;
    }
  }

    // Ctrl+Z: Undo or Redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
            // Ctrl+Shift+Z acts as Redo
            redoEdit();
        } else {
            undoEdit();
        }
        e.preventDefault();
        return;
    }
    
    // Previous Generation (Arrow Left)
    if (e.key === 'ArrowLeft') {
        let bPrev = select('#btnPrevSeed');
        if(bPrev && !bPrev.attribute('disabled')) restoreGenerationState(generationIndex - 1);
    }

    // Next Generation (Arrow Right)
    if (e.key === 'ArrowRight') {
        let bNext = select('#btnNextSeed');
        if(bNext && !bNext.attribute('disabled')) restoreGenerationState(generationIndex + 1);
    }
});

let isDrawing = false; // Add state to track if drag started on canvas

function isEditTabActive() {
  let editTab = document.getElementById('tab-edit');
  return !!(editTab && editTab.classList.contains('active'));
}

function getPointerInteractionMode() {
  let isMobileInput = window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches;

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

    if (oldType === newType && effectiveMode !== 'edit') return; 
    
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
          t.types[activeSubtileIndex] = newType;
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
        t.types[mapped.subtileIndex] = newType;
            refreshTile(t);
        }
    } else if (interactionScope === 'global_pos_sym') {
        // Global Equivalent by Position (Symmetric / Batch):
      // Update the same structural subtile slot in all 4 quadrants of ALL supertiles.
        for (let s of tiles) {
        for (let t of s.tiles) {
          t.types[baseTileSubtileIndex] = newType;
                refreshTile(t);
            }
        }
    }
    
    redraw();
}

(function () {
  'use strict';

  const STORAGE_KEY = 'tilling_stripes_uploaded_svg_v1';
  const BACKUP_VERSION = 2;
  const THUMBNAIL_SIZE = 96;
  const SYMMETRY_VARIANTS = [
    { key: 'r90', label: 'R90', rotate: 90, flipX: false, flipY: false },
    { key: 'r180', label: 'R180', rotate: 180, flipX: false, flipY: false },
    { key: 'r270', label: 'R270', rotate: 270, flipX: false, flipY: false },
    { key: 'mx', label: 'MX', rotate: 0, flipX: true, flipY: false },
    { key: 'my', label: 'MY', rotate: 0, flipX: false, flipY: true },
    { key: 'md', label: 'MD', rotate: 90, flipX: true, flipY: false },
    { key: 'mad', label: 'MAD', rotate: 90, flipX: false, flipY: true }
  ];
  const uploadedSvgTiles = [];
  const hiddenTileIds = new Set();

  if (typeof window !== 'undefined') {
    window.TILE_HIDDEN_IDS = hiddenTileIds;
  }

  function isSimpleSvgContext(ctx) {
    return !!(ctx && Array.isArray(ctx.elements) && typeof ctx._getTransformAttr === 'function');
  }

  function stripUnsafeNodesAndAttrs(root) {
    const blockedTags = new Set(['script', 'foreignObject']);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    const toRemove = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      if (blockedTags.has(tag)) {
        toRemove.push(node);
        continue;
      }

      const attrs = Array.from(node.attributes || []);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const value = (attr.value || '').trim().toLowerCase();
        if (name.startsWith('on')) {
          node.removeAttribute(attr.name);
        } else if ((name === 'href' || name === 'xlink:href') && value.startsWith('javascript:')) {
          node.removeAttribute(attr.name);
        }
      }
    }

    toRemove.forEach((node) => node.remove());
  }

  function parseSvgDimensions(svgElement) {
    let viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.trim().split(/\s+/).map(Number);
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        return {
          minX: parts[0],
          minY: parts[1],
          width: Math.abs(parts[2]) || 1,
          height: Math.abs(parts[3]) || 1
        };
      }
    }

    const width = parseFloat(svgElement.getAttribute('width')) || 100;
    const height = parseFloat(svgElement.getAttribute('height')) || 100;
    return {
      minX: 0,
      minY: 0,
      width: Math.abs(width) || 1,
      height: Math.abs(height) || 1
    };
  }

  function normalizeToSquareViewBox(dims) {
    const size = Math.max(dims.width, dims.height) || 1;
    const minX = dims.minX - (size - dims.width) / 2;
    const minY = dims.minY - (size - dims.height) / 2;

    return {
      minX,
      minY,
      width: size,
      height: size,
      normalized: (size !== dims.width || size !== dims.height)
    };
  }

  function sanitizeSvg(svgText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(svgText, 'image/svg+xml');

    const parseError = xml.querySelector('parsererror');
    if (parseError) {
      throw new Error('SVG invalido: nao foi possivel ler o arquivo.');
    }

    const svgElement = xml.querySelector('svg');
    if (!svgElement) {
      throw new Error('Arquivo sem elemento <svg>.');
    }

    stripUnsafeNodesAndAttrs(svgElement);

    const rawDims = parseSvgDimensions(svgElement);
    const dims = normalizeToSquareViewBox(rawDims);
    const viewBox = `${dims.minX} ${dims.minY} ${dims.width} ${dims.height}`;

    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.setAttribute('viewBox', viewBox);
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgElement.removeAttribute('width');
    svgElement.removeAttribute('height');

    return {
      svgMarkup: svgElement.outerHTML,
      viewBox: dims
    };
  }

  function buildDataUrl(svgMarkup) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  }

  function getContainSize(srcW, srcH, dstW, dstH) {
    const scale = Math.min(dstW / srcW, dstH / srcH);
    return {
      width: Math.max(1, srcW * scale),
      height: Math.max(1, srcH * scale)
    };
  }

  function generateThumbnailDataUrl(asset, size = THUMBNAIL_SIZE) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(null);
        return;
      }

      const src = asset.dataUrl;
      const img = new Image();
      img.onload = () => {
        const dims = getContainSize(img.width || 1, img.height || 1, size, size);
        const dx = (size - dims.width) / 2;
        const dy = (size - dims.height) / 2;

        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, dx, dy, dims.width, dims.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function buildTransformOps(viewBox, transform) {
    const cx = viewBox.minX + viewBox.width / 2;
    const cy = viewBox.minY + viewBox.height / 2;
    const sx = transform.flipX ? -1 : 1;
    const sy = transform.flipY ? -1 : 1;

    const ops = [`translate(${cx} ${cy})`];
    if (transform.rotate) ops.push(`rotate(${transform.rotate})`);
    if (sx !== 1 || sy !== 1) ops.push(`scale(${sx} ${sy})`);
    ops.push(`translate(${-cx} ${-cy})`);
    return ops.join(' ');
  }

  function makeVariantSvgMarkup(sourceSvgMarkup, sourceViewBox, transform) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(sourceSvgMarkup, 'image/svg+xml');
    const svg = xml.querySelector('svg');
    if (!svg) return null;

    const group = xml.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', buildTransformOps(sourceViewBox, transform));

    while (svg.firstChild) {
      group.appendChild(svg.firstChild);
    }
    svg.appendChild(group);
    return svg.outerHTML;
  }

  function drawSvgOnP5Context(ctx, asset, w, h, padding) {
    const imageObj = asset ? asset.image : null;
    const imageReady = !!(
      imageObj
      && imageObj.complete
      && typeof imageObj.naturalWidth === 'number'
      && typeof imageObj.naturalHeight === 'number'
      && imageObj.naturalWidth > 0
      && imageObj.naturalHeight > 0
    );

    if (!imageReady) {
      ctx.push();
      ctx.noFill();
      ctx.stroke(180);
      ctx.strokeWeight(Math.max(1, Math.min(w, h) * 0.04));
      const dw = w - padding * 2;
      const dh = h - padding * 2;
      ctx.rect(-dw / 2, -dh / 2, dw, dh);
      ctx.line(-dw / 2, -dh / 2, dw / 2, dh / 2);
      ctx.line(dw / 2, -dh / 2, -dw / 2, dh / 2);
      ctx.pop();
      return;
    }

    const drawW = Math.max(1, w - padding * 2);
    const drawH = Math.max(1, h - padding * 2);
    const vb = asset && asset.viewBox ? asset.viewBox : { width: 1, height: 1 };
    const contain = getContainSize(vb.width || 1, vb.height || 1, drawW, drawH);

    ctx.push();
    ctx.noStroke();
    // Use native drawImage for robustness with HTMLImageElement sources.
    ctx.drawingContext.drawImage(
      imageObj,
      -contain.width / 2,
      -contain.height / 2,
      contain.width,
      contain.height
    );
    ctx.pop();
  }

  function appendSvgToSimpleSvg(ctx, asset, w, h, padding, colorValue) {
    const vb = asset.viewBox;
    const innerWidth = Math.max(1, w - padding * 2);
    const innerHeight = Math.max(1, h - padding * 2);

    const scale = Math.min(innerWidth / vb.width, innerHeight / vb.height);
    const drawWidth = vb.width * scale;
    const drawHeight = vb.height * scale;

    const tx = -drawWidth / 2 - vb.minX * scale;
    const ty = -drawHeight / 2 - vb.minY * scale;

    const escaped = asset.innerMarkup;
    const styleColor = typeof colorValue === 'string' ? colorValue : 'currentColor';

    const transformAttr = ctx._getTransformAttr();
    const openGroup = transformAttr ? `<g ${transformAttr}>` : '<g>';
    const colorOverride = '<style>*{fill:currentColor !important;stroke:currentColor !important;}</style>';
    const tileGroup = `${openGroup}<g transform="translate(${ctx._fmt(tx)}, ${ctx._fmt(ty)}) scale(${ctx._fmt(scale)})" style="color:${styleColor}">${colorOverride}${escaped}</g></g>`;
    ctx.elements.push(tileGroup);
  }

  function createRenderer(asset) {
    return function renderUploadedSvg(ctx, w, h, padding, colorValue) {
      if (isSimpleSvgContext(ctx)) {
        appendSvgToSimpleSvg(ctx, asset, w, h, padding, colorValue);
        return;
      }

      drawSvgOnP5Context(ctx, asset, w, h, padding);
    };
  }

  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (err) {
      console.warn('Failed to read uploaded SVG storage:', err);
      return [];
    }
  }

  function writeStorage(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (err) {
      console.warn('Failed to persist uploaded SVG storage:', err);
    }
  }

  function createEntryId() {
    return `svg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  function getStoredEntries() {
    return readStorage();
  }

  function hasStoredEntry(entryId, name, familyLabel, svgMarkup) {
    const entries = readStorage();
    if (entryId && entries.some((item) => item.id === entryId)) return true;
    return entries.some((item) => item.name === name && item.familyLabel === familyLabel && item.svgMarkup === svgMarkup);
  }

  function updateStoredEntry(entryId, updater) {
    const entries = readStorage();
    let changed = false;
    const updated = entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      changed = true;
      return updater({ ...entry });
    });

    if (changed) writeStorage(updated);
    return changed;
  }

  function updateStoredEntriesForFamily(familyLabel, updater) {
    const entries = readStorage();
    let changed = false;
    const updated = entries.map((entry) => {
      if (entry.familyLabel !== familyLabel) return entry;
      changed = true;
      return updater({ ...entry });
    });

    if (changed) writeStorage(updated);
    return changed;
  }

  function registerUploadedSvgTile(config, options = {}) {
    if (!window.registerTile) {
      throw new Error('registerTile nao esta disponivel.');
    }

    const familyLabel = (config.familyLabel || 'uploads').trim() || 'uploads';
    const safeName = (config.name || 'Uploaded SVG').trim() || 'Uploaded SVG';
    const sanitized = sanitizeSvg(config.svgText || '');
    const dataUrl = buildDataUrl(sanitized.svgMarkup);

    const imageObj = new Image();

    const parser = new DOMParser();
    const xml = parser.parseFromString(sanitized.svgMarkup, 'image/svg+xml');
    const svgElement = xml.querySelector('svg');

    const asset = {
      entryId: options.entryId || createEntryId(),
      name: safeName,
      familyLabel,
      metadata: options.metadata || null,
      svgMarkup: sanitized.svgMarkup,
      innerMarkup: svgElement ? svgElement.innerHTML : '',
      viewBox: sanitized.viewBox,
      image: imageObj,
      dataUrl,
      thumbnailDataUrl: null
    };

    const tileId = window.registerTile({
      name: safeName,
      family: familyLabel,
      symmetric: true,
      render: createRenderer(asset)
    });

    asset.tileId = tileId;
    uploadedSvgTiles.push(asset);

    imageObj.onload = async () => {
      asset.thumbnailDataUrl = await generateThumbnailDataUrl(asset);
      if (typeof window.onUploadedTileThumbnailReady === 'function') {
        window.onUploadedTileThumbnailReady(asset.tileId);
      }
    };
    imageObj.src = dataUrl;

    if (options.persist !== false) {
      const entries = readStorage();
      entries.push({
        id: asset.entryId,
        name: asset.name,
        familyLabel: asset.familyLabel,
        metadata: asset.metadata,
        svgMarkup: asset.svgMarkup,
        createdAt: new Date().toISOString()
      });
      writeStorage(entries);
    }

    return asset;
  }

  function listUploadedSvgTiles() {
    return uploadedSvgTiles.map((tile) => ({
      entryId: tile.entryId,
      tileId: tile.tileId,
      name: tile.name,
      familyLabel: tile.familyLabel,
      metadata: tile.metadata,
      thumbnailDataUrl: tile.thumbnailDataUrl
    }));
  }

  function getUploadedTileMeta(tileId) {
    const item = uploadedSvgTiles.find((tile) => tile.tileId === tileId);
    if (!item) return null;
    return {
      entryId: item.entryId,
      tileId: item.tileId,
      name: item.name,
      familyLabel: item.familyLabel,
      metadata: item.metadata,
      thumbnailDataUrl: item.thumbnailDataUrl,
      viewBox: item.viewBox
    };
  }

  function deleteUploadedTile(tileId) {
    const idx = uploadedSvgTiles.findIndex((tile) => tile.tileId === tileId);
    if (idx === -1) return false;

    const tile = uploadedSvgTiles[idx];
    hiddenTileIds.add(tile.tileId);
    uploadedSvgTiles.splice(idx, 1);

    const entries = readStorage().filter((entry) => entry.id !== tile.entryId);
    writeStorage(entries);
    return true;
  }

  function deleteUploadedFamily(familyLabel) {
    const label = (familyLabel || '').trim();
    if (!label) return 0;

    const toDelete = uploadedSvgTiles.filter((tile) => tile.familyLabel === label);
    if (toDelete.length === 0) return 0;

    toDelete.forEach((tile) => hiddenTileIds.add(tile.tileId));
    for (let i = uploadedSvgTiles.length - 1; i >= 0; i--) {
      if (uploadedSvgTiles[i].familyLabel === label) {
        uploadedSvgTiles.splice(i, 1);
      }
    }

    const entries = readStorage().filter((entry) => entry.familyLabel !== label);
    writeStorage(entries);
    return toDelete.length;
  }

  function renameUploadedFamily(oldLabel, newLabel) {
    const source = (oldLabel || '').trim();
    const target = (newLabel || '').trim();
    if (!source || !target) throw new Error('Family labels must be non-empty');
    if (source === target) return 0;

    if (typeof window.renameTileFamilyLabel !== 'function') {
      throw new Error('Family rename API unavailable');
    }

    window.renameTileFamilyLabel(source, target);

    let count = 0;
    uploadedSvgTiles.forEach((tile) => {
      if (tile.familyLabel === source) {
        tile.familyLabel = target;
        count++;
      }
    });

    updateStoredEntriesForFamily(source, (entry) => {
      entry.familyLabel = target;
      return entry;
    });

    return count;
  }

  function renameUploadedTile(tileId, newName) {
    const item = uploadedSvgTiles.find((tile) => tile.tileId === tileId);
    if (!item) throw new Error('Tile not found');

    const name = (newName || '').trim();
    if (!name) throw new Error('Tile name must be non-empty');

    if (typeof window.renameTileName === 'function') {
      window.renameTileName(tileId, name);
    } else if (Array.isArray(window.TILE_NAMES) && window.TILE_NAMES[tileId] !== undefined) {
      window.TILE_NAMES[tileId] = name;
    }

    item.name = name;
    updateStoredEntry(item.entryId, (entry) => {
      entry.name = name;
      return entry;
    });

    return name;
  }

  function moveUploadedTileToFamily(tileId, targetFamilyLabel) {
    const item = uploadedSvgTiles.find((tile) => tile.tileId === tileId);
    if (!item) throw new Error('Tile not found');

    const target = (targetFamilyLabel || '').trim();
    if (!target) throw new Error('Target family must be non-empty');

    if (typeof window.moveTileToFamily === 'function') {
      window.moveTileToFamily(tileId, target);
    }

    item.familyLabel = target;
    updateStoredEntry(item.entryId, (entry) => {
      entry.familyLabel = target;
      return entry;
    });

    return target;
  }

  function restoreFromStorage() {
    const entries = readStorage();
    const restoredIds = [];

    for (const entry of entries) {
      try {
        const asset = registerUploadedSvgTile({
          name: entry.name,
          familyLabel: entry.familyLabel,
          svgText: entry.svgMarkup
        }, {
          persist: false,
          entryId: entry.id,
          metadata: entry.metadata || null
        });
        restoredIds.push(asset.tileId);
      } catch (err) {
        console.warn('Failed to restore uploaded SVG tile:', entry?.name, err);
      }
    }

    return restoredIds;
  }

  function buildBackupPayload() {
    const registrySnapshot = (typeof window.getTileRegistrySnapshot === 'function')
      ? window.getTileRegistrySnapshot()
      : null;

    return {
      app: 'tilling_stripes',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      tiles: getStoredEntries(),
      registry: registrySnapshot
    };
  }

  function downloadBackup(filename = null) {
    const payload = buildBackupPayload();
    const finalName = filename || `tilling_stripes_svg_backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function normalizeBackupInput(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.tiles)) return parsed.tiles;
    return [];
  }

  function importBackupText(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error('Backup JSON invalido.');
    }

    const incoming = normalizeBackupInput(parsed);
    let imported = 0;
    let skipped = 0;
    let ids = [];
    let registryApplied = false;

    for (const entry of incoming) {
      if (!entry || typeof entry.svgMarkup !== 'string') {
        skipped++;
        continue;
      }

      const name = (entry.name || 'Uploaded SVG').trim();
      const familyLabel = (entry.familyLabel || 'uploads').trim() || 'uploads';
      const entryId = entry.id || null;

      if (hasStoredEntry(entryId, name, familyLabel, entry.svgMarkup)) {
        skipped++;
        continue;
      }

      const asset = registerUploadedSvgTile({
        name,
        familyLabel,
        svgText: entry.svgMarkup
      }, {
        persist: true,
        entryId: entryId || createEntryId()
      });

      imported++;
      ids.push(asset.tileId);
    }

    if (parsed && parsed.registry && typeof window.applyTileRegistrySnapshot === 'function') {
      window.applyTileRegistrySnapshot(parsed.registry);
      registryApplied = true;
    }

    return { imported, skipped, ids, registryApplied };
  }

  function hasStoredVariantFor(entryId, variantKey) {
    const entries = readStorage();
    return entries.some((entry) => entry.metadata && entry.metadata.variantOf === entryId && entry.metadata.variantKey === variantKey);
  }

  function listSymmetryVariantOptions() {
    return SYMMETRY_VARIANTS.map((variant) => ({
      key: variant.key,
      label: variant.label
    }));
  }

  function getUploadedTileById(tileId) {
    return uploadedSvgTiles.find((item) => item.tileId === tileId) || null;
  }

  function getSymmetryVariantPreviews(tileId, size = 92) {
    const source = getUploadedTileById(tileId);
    if (!source) return [];

    return SYMMETRY_VARIANTS.map((variant) => {
      const markup = makeVariantSvgMarkup(source.svgMarkup, source.viewBox, variant);
      return {
        key: variant.key,
        label: variant.label,
        exists: hasStoredVariantFor(source.entryId, variant.key),
        previewDataUrl: markup ? buildDataUrl(markup) : source.dataUrl
      };
    });
  }

  function normalizeCustomTransform(transform) {
    const input = transform || {};
    let rotate = Number(input.rotate);
    if (!Number.isFinite(rotate)) rotate = 0;
    rotate = ((Math.round(rotate / 90) * 90) % 360 + 360) % 360;

    return {
      key: 'custom',
      label: 'Custom',
      rotate,
      flipX: !!input.flipX,
      flipY: !!input.flipY
    };
  }

  function getTransformedTilePreview(tileId, transform) {
    const source = getUploadedTileById(tileId);
    if (!source) return null;

    const normalized = normalizeCustomTransform(transform);
    if (normalized.rotate === 0 && !normalized.flipX && !normalized.flipY) {
      return source.dataUrl;
    }

    const markup = makeVariantSvgMarkup(source.svgMarkup, source.viewBox, normalized);
    return markup ? buildDataUrl(markup) : source.dataUrl;
  }

  function createEditedTile(tileId, transform, customName = '') {
    const source = getUploadedTileById(tileId);
    if (!source) {
      throw new Error('Source tile not found in uploaded library.');
    }

    const normalized = normalizeCustomTransform(transform);
    if (normalized.rotate === 0 && !normalized.flipX && !normalized.flipY) {
      throw new Error('No transform selected.');
    }

    const markup = makeVariantSvgMarkup(source.svgMarkup, source.viewBox, normalized);
    if (!markup) throw new Error('Failed to generate transformed tile.');

    const suffixParts = [];
    if (normalized.rotate) suffixParts.push(`R${normalized.rotate}`);
    if (normalized.flipX) suffixParts.push('MX');
    if (normalized.flipY) suffixParts.push('MY');
    const defaultName = `${source.name} [${suffixParts.join('+')}]`;
    const nextName = (customName || '').trim() || defaultName;

    const created = registerUploadedSvgTile({
      name: nextName,
      familyLabel: source.familyLabel,
      svgText: markup
    }, {
      metadata: {
        variantOf: source.entryId,
        variantKey: 'custom',
        editorTransform: {
          rotate: normalized.rotate,
          flipX: normalized.flipX,
          flipY: normalized.flipY
        }
      }
    });

    return created;
  }

  function normalizeVariantKeys(keys) {
    const allowed = new Set(SYMMETRY_VARIANTS.map((variant) => variant.key));
    if (!Array.isArray(keys) || keys.length === 0) {
      return SYMMETRY_VARIANTS.map((variant) => variant.key);
    }

    const normalized = [];
    for (const key of keys) {
      if (typeof key !== 'string') continue;
      const clean = key.trim();
      if (!clean || !allowed.has(clean)) continue;
      if (!normalized.includes(clean)) normalized.push(clean);
    }
    return normalized;
  }

  function generateSymmetryVariants(tileId, variantKeys = null) {
    const source = uploadedSvgTiles.find((item) => item.tileId === tileId);
    if (!source) {
      throw new Error('Source tile not found in uploaded library.');
    }

    const selectedKeys = normalizeVariantKeys(variantKeys);
    if (selectedKeys.length === 0) {
      return { created: 0, skipped: 0, ids: [] };
    }

    const selectedVariants = SYMMETRY_VARIANTS.filter((variant) => selectedKeys.includes(variant.key));
    const createdIds = [];
    let skipped = 0;

    for (const variant of selectedVariants) {
      if (hasStoredVariantFor(source.entryId, variant.key)) {
        skipped++;
        continue;
      }

      const variantMarkup = makeVariantSvgMarkup(source.svgMarkup, source.viewBox, variant);
      if (!variantMarkup) {
        skipped++;
        continue;
      }

      const variantName = `${source.name} [${variant.label}]`;
      const created = registerUploadedSvgTile({
        name: variantName,
        familyLabel: source.familyLabel,
        svgText: variantMarkup
      }, {
        metadata: {
          variantOf: source.entryId,
          variantKey: variant.key
        }
      });

      createdIds.push(created.tileId);
    }

    return {
      created: createdIds.length,
      skipped,
      ids: createdIds
    };
  }

  function isTileHidden(tileId) {
    return hiddenTileIds.has(tileId);
  }

  function getFamilyOptions() {
    if (typeof window.getTileFamilySummary === 'function') {
      return window.getTileFamilySummary();
    }
    return [];
  }

  window.SVGTileManager = {
    registerUploadedSvgTile,
    restoreFromStorage,
    getUploadedTileMeta,
    deleteUploadedTile,
    deleteUploadedFamily,
    isTileHidden,
    downloadBackup,
    importBackupText,
    renameUploadedFamily,
    renameUploadedTile,
    moveUploadedTileToFamily,
    listSymmetryVariantOptions,
    getSymmetryVariantPreviews,
    getTransformedTilePreview,
    createEditedTile,
    generateSymmetryVariants,
    listUploadedSvgTiles,
    getFamilyOptions
  };
})();

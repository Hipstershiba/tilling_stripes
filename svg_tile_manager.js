(function () {
  'use strict';

  const STORAGE_KEY = 'tilling_stripes_uploaded_svg_v1';
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

    const dims = parseSvgDimensions(svgElement);
    const viewBox = `${dims.minX} ${dims.minY} ${dims.width} ${dims.height}`;

    svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgElement.setAttribute('viewBox', viewBox);
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

  function drawSvgOnP5Context(ctx, imageObj, w, h, padding) {
    if (!imageObj || !imageObj.complete) {
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

    ctx.push();
    ctx.imageMode(CENTER);
    ctx.noStroke();
    ctx.image(imageObj, 0, 0, drawW, drawH);
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

      drawSvgOnP5Context(ctx, asset.image, w, h, padding);
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

  function registerUploadedSvgTile(config, options = {}) {
    if (!window.registerTile) {
      throw new Error('registerTile nao esta disponivel.');
    }

    const familyLabel = (config.familyLabel || 'uploads').trim() || 'uploads';
    const safeName = (config.name || 'Uploaded SVG').trim() || 'Uploaded SVG';
    const sanitized = sanitizeSvg(config.svgText || '');
    const dataUrl = buildDataUrl(sanitized.svgMarkup);

    const imageObj = new Image();
    imageObj.src = dataUrl;

    const parser = new DOMParser();
    const xml = parser.parseFromString(sanitized.svgMarkup, 'image/svg+xml');
    const svgElement = xml.querySelector('svg');

    const asset = {
      entryId: options.entryId || createEntryId(),
      name: safeName,
      familyLabel,
      svgMarkup: sanitized.svgMarkup,
      innerMarkup: svgElement ? svgElement.innerHTML : '',
      viewBox: sanitized.viewBox,
      image: imageObj,
      dataUrl
    };

    const tileId = window.registerTile({
      name: safeName,
      family: familyLabel,
      symmetric: true,
      render: createRenderer(asset)
    });

    asset.tileId = tileId;
    uploadedSvgTiles.push(asset);

    if (options.persist !== false) {
      const entries = readStorage();
      entries.push({
        id: asset.entryId,
        name: asset.name,
        familyLabel: asset.familyLabel,
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
      familyLabel: tile.familyLabel
    }));
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
          entryId: entry.id
        });
        restoredIds.push(asset.tileId);
      } catch (err) {
        console.warn('Failed to restore uploaded SVG tile:', entry?.name, err);
      }
    }

    return restoredIds;
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
    deleteUploadedTile,
    deleteUploadedFamily,
    isTileHidden,
    listUploadedSvgTiles,
    getFamilyOptions
  };
})();

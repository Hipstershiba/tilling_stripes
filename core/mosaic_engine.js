/**
 * core/mosaic_engine.js
 * Pure data generation and vector/canvas rendering engine for Tiling Stripes v2.
 */

(function () {
  const {
    D4_METADATA,
    transformGridCoords,
    composeD4,
    applyD4ToContext,
    resolveCellSymmetry
  } = window.D4Symmetry;

  const {
    TILE_RENDERERS,
    getTransformedTileId
  } = window.TileRegistry;

  // Distinct palette for orbit badges (Illustrator layer colors style)
  const ORBIT_COLORS = [
    [0, 210, 255],   // #1 Cyan
    [255, 145, 0],   // #2 Orange
    [170, 100, 255], // #3 Purple
    [76, 217, 100],  // #4 Green
    [255, 75, 130],  // #5 Pink
    [255, 214, 10],  // #6 Yellow
    [90, 200, 250],  // #7 Light Blue
    [255, 105, 97]   // #8 Coral
  ];

  /**
   * Generates a single canonical source Block (Supertile) of size N x N subtiles
   * where N = 2 * subdivision.
   */
  function generateSourceBlock(subdivision, blockSymmetryMode, allowedTiles, randomPick) {
    const N = Math.max(1, subdivision * 2);
    const sourceMap = Array.from({ length: N }, () => new Array(N).fill(null));
    const cells = Array.from({ length: N }, () => new Array(N).fill(null));

    // Step 1: Resolve symmetry relations inside the N x N block and generate canonical subtiles
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const rel = resolveCellSymmetry(r, c, N, N, blockSymmetryMode);
        if (rel.isSource) {
          const pickedTileId = allowedTiles.length > 0 ? randomPick(allowedTiles) : 0;
          sourceMap[r][c] = {
            baseTileId: pickedTileId
          };
        }
      }
    }

    // Step 2: Populate all N x N subtile slots by transforming from their canonical source slot
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const rel = resolveCellSymmetry(r, c, N, N, blockSymmetryMode);
        const src = sourceMap[rel.sourceRow]?.[rel.sourceCol] || { baseTileId: 0 };
        const transformedTileId = getTransformedTileId(src.baseTileId, rel.transformFromSource);

        cells[r][c] = {
          row: r,
          col: c,
          baseTileId: src.baseTileId,
          tileId: transformedTileId,
          transform: rel.transformFromSource,
          sourceSubtile: [rel.sourceRow, rel.sourceCol],
          isCanonicalSubtile: rel.isSource
        };
      }
    }

    return {
      subtilesPerSide: N,
      subdivision,
      blockSymmetryMode,
      cells
    };
  }

  /**
   * Applies a D4 transformation to an entire N x N Block (both positions and tile orientations).
   */
  function transformBlock(sourceBlock, transformKey) {
    const N = sourceBlock.subtilesPerSide;
    const nextCells = Array.from({ length: N }, () => new Array(N).fill(null));

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const [tr, tc] = transformGridCoords(r, c, N, N, transformKey);
        const srcCell = sourceBlock.cells[r][c];
        const nextTileId = getTransformedTileId(srcCell.tileId, transformKey);
        const nextTransform = composeD4(transformKey, srcCell.transform);

        nextCells[tr][tc] = {
          row: tr,
          col: tc,
          baseTileId: srcCell.baseTileId,
          tileId: nextTileId,
          transform: nextTransform,
          sourceSubtile: srcCell.sourceSubtile,
          isCanonicalSubtile: srcCell.isCanonicalSubtile && transformKey === 'id'
        };
      }
    }

    return {
      subtilesPerSide: N,
      subdivision: sourceBlock.subdivision,
      blockSymmetryMode: sourceBlock.blockSymmetryMode,
      cells: nextCells
    };
  }

  /**
   * Builds the full mosaic state for the given configuration.
   */
  function generateMosaic(config, randomPick) {
    const rows = Math.max(1, parseInt(config.rows, 10) || 4);
    const cols = Math.max(1, parseInt(config.cols, 10) || 4);
    const subdivision = Math.max(1, Math.min(4, parseInt(config.subdivision, 10) || 2));
    const gridSymmetryMode = config.gridSymmetryMode || 'mandala_d4';
    const effectiveBlockSymmetry = config.syncBlockSymmetry
      ? gridSymmetryMode
      : (config.blockSymmetryMode || 'mandala_d4');
    const allowedTiles = Array.isArray(config.allowedTiles) ? config.allowedTiles : [];

    const sourceBlocks = new Map();
    const orbitIds = new Map();
    let nextOrbitId = 1;

    // Pass 1: Identify all canonical source cells in the grid and generate their base blocks
    const cellRelations = Array.from({ length: rows }, () => new Array(cols).fill(null));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rel = resolveCellSymmetry(r, c, rows, cols, gridSymmetryMode);
        cellRelations[r][c] = rel;
        const key = `${rel.sourceRow},${rel.sourceCol}`;

        if (!orbitIds.has(key)) {
          orbitIds.set(key, nextOrbitId++);
        }
        if (rel.isSource && !sourceBlocks.has(key)) {
          const block = generateSourceBlock(subdivision, effectiveBlockSymmetry, allowedTiles, randomPick);
          sourceBlocks.set(key, block);
        }
      }
    }

    // Fallback if any source cell wasn't visited as isSource (safety guard)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rel = cellRelations[r][c];
        const key = `${rel.sourceRow},${rel.sourceCol}`;
        if (!sourceBlocks.has(key)) {
          sourceBlocks.set(
            key,
            generateSourceBlock(subdivision, effectiveBlockSymmetry, allowedTiles, randomPick)
          );
        }
      }
    }

    // Pass 2: Build every cell of the grid by transforming its canonical source block
    const grid = Array.from({ length: rows }, () => new Array(cols).fill(null));
    const blocksFlat = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rel = cellRelations[r][c];
        const key = `${rel.sourceRow},${rel.sourceCol}`;
        const srcBlock = sourceBlocks.get(key);
        const orbitId = orbitIds.get(key);

        const transformedBlock = rel.transformFromSource === 'id'
          ? srcBlock
          : transformBlock(srcBlock, rel.transformFromSource);

        const blockInstance = {
          row: r,
          col: c,
          index: r * cols + c,
          orbitId,
          sourceRow: rel.sourceRow,
          sourceCol: rel.sourceCol,
          isCanonicalSource: rel.isSource,
          transformFromSource: rel.transformFromSource,
          subtilesPerSide: transformedBlock.subtilesPerSide,
          subdivision: transformedBlock.subdivision,
          cells: transformedBlock.cells
        };

        grid[r][c] = blockInstance;
        blocksFlat.push(blockInstance);
      }
    }

    return {
      rows,
      cols,
      subdivision,
      subtilesPerSide: subdivision * 2,
      gridSymmetryMode,
      blockSymmetryMode: effectiveBlockSymmetry,
      totalOrbits: nextOrbitId - 1,
      grid,
      blocks: blocksFlat
    };
  }

  /**
   * Renders the mosaic onto a p5.js context or SimpleSVG vector context.
   */
  function renderMosaicToContext(ctx, mosaicData, layoutConfig) {
    const canvasW = layoutConfig.width;
    const canvasH = layoutConfig.height;
    const margin = Math.max(0, Number(layoutConfig.margin) || 0);
    const paddingRatio = Math.max(0, Math.min(0.35, Number(layoutConfig.paddingRatio ?? 0.05)));
    const bgColor = layoutConfig.bgColor || '#0c0c0e';
    const fgColor = layoutConfig.fgColor || '#e2e0dc';

    ctx.background(bgColor);

    if (!mosaicData || !Array.isArray(mosaicData.blocks) || mosaicData.blocks.length === 0) {
      return;
    }

    const drawW = canvasW - margin * 2;
    const drawH = canvasH - margin * 2;
    if (drawW <= 0 || drawH <= 0) return;

    const blockW = drawW / mosaicData.cols;
    const blockH = drawH / mosaicData.rows;
    const N = mosaicData.subtilesPerSide;
    const subW = blockW / N;
    const subH = blockH / N;
    const subPadding = Math.min(subW, subH) * paddingRatio;

    for (const block of mosaicData.blocks) {
      const blockLeft = margin + block.col * blockW;
      const blockTop = margin + block.row * blockH;

      for (let sr = 0; sr < N; sr++) {
        for (let sc = 0; sc < N; sc++) {
          const cell = block.cells[sr][sc];
          if (!cell) continue;
          const baseRenderer = TILE_RENDERERS[cell.baseTileId] || TILE_RENDERERS[cell.tileId];
          if (!baseRenderer) continue;

          const centerX = blockLeft + (sc + 0.5) * subW;
          const centerY = blockTop + (sr + 0.5) * subH;
          const d4Meta = D4_METADATA[cell.transform] || D4_METADATA.id;
          const drawSubW = d4Meta.swapsAxes ? subH : subW;
          const drawSubH = d4Meta.swapsAxes ? subW : subH;

          ctx.push();
          ctx.translate(centerX, centerY);
          applyD4ToContext(ctx, cell.transform);
          baseRenderer(ctx, drawSubW, drawSubH, subPadding, fgColor);
          ctx.pop();
        }
      }
    }
  }

  /**
   * Draws Illustrator-style non-printing guides & orbit overlays onto the main p5 canvas.
   */
  function renderGuidesAndOverlays(p, mosaicData, layoutConfig, guideOptions, hoveredCell) {
    if (!mosaicData) return;

    const canvasW = layoutConfig.width;
    const canvasH = layoutConfig.height;
    const margin = Math.max(0, Number(layoutConfig.margin) || 0);
    const drawW = canvasW - margin * 2;
    const drawH = canvasH - margin * 2;
    if (drawW <= 0 || drawH <= 0) return;

    const blockW = drawW / mosaicData.cols;
    const blockH = drawH / mosaicData.rows;
    const N = mosaicData.subtilesPerSide;
    const subW = blockW / N;
    const subH = blockH / N;

    p.push();

    // 1. Subtile internal grid lines (subtle cyan)
    if (guideOptions.showSubtileGrid) {
      p.stroke(0, 210, 255, 38);
      p.strokeWeight(1);
      for (let r = 0; r <= mosaicData.rows * N; r++) {
        const y = margin + r * subH;
        p.line(margin, y, margin + drawW, y);
      }
      for (let c = 0; c <= mosaicData.cols * N; c++) {
        const x = margin + c * subW;
        p.line(x, margin, x, margin + drawH);
      }
    }

    // 2. Quadrant & Block boundaries
    if (guideOptions.showBlockGrid) {
      // Quadrant midlines inside each block (dashed feel via lower alpha)
      p.stroke(0, 210, 255, 70);
      p.strokeWeight(1);
      for (let r = 0; r < mosaicData.rows; r++) {
        const midY = margin + (r + 0.5) * blockH;
        p.line(margin, midY, margin + drawW, midY);
      }
      for (let c = 0; c < mosaicData.cols; c++) {
        const midX = margin + (c + 0.5) * blockW;
        p.line(midX, margin, midX, margin + drawH);
      }

      // Major Block (Supertile) boundaries
      p.stroke(0, 210, 255, 165);
      p.strokeWeight(1.5);
      p.noFill();
      p.rect(margin, margin, drawW, drawH);

      for (let r = 1; r < mosaicData.rows; r++) {
        const y = margin + r * blockH;
        p.line(margin, y, margin + drawW, y);
      }
      for (let c = 1; c < mosaicData.cols; c++) {
        const x = margin + c * blockW;
        p.line(x, margin, x, margin + drawH);
      }
    }

    // 3. Global Symmetry Axes (Illustrator Magenta/Amber guide lines)
    if (guideOptions.showSymmetryAxes) {
      const sym = mosaicData.gridSymmetryMode;
      const cx = margin + drawW / 2;
      const cy = margin + drawH / 2;

      p.strokeWeight(1.75);
      p.stroke(255, 64, 129, 210);
      p.line(cx, margin, cx, margin + drawH);
      p.line(margin, cy, margin + drawW, cy);

      // Diagonal axes for Mandala D4 (when square grid)
      if (sym === 'mandala_d4' && mosaicData.rows === mosaicData.cols) {
        p.stroke(255, 180, 0, 175);
        p.strokeWeight(1.25);
        p.line(margin, margin, margin + drawW, margin + drawH);
        p.line(margin + drawW, margin, margin, margin + drawH);
      }

      // Center pivot marker
      p.fill(255, 64, 129, 240);
      p.noStroke();
      p.circle(cx, cy, 7);
      p.noFill();
      p.stroke(255, 255, 255, 200);
      p.strokeWeight(1);
      p.circle(cx, cy, 12);
    }

    // 4. Hover Orbit Highlight (highlights hovered block + its symmetry orbit siblings)
    if (hoveredCell && guideOptions.highlightHoverOrbit) {
      const hoveredBlock = mosaicData.grid[hoveredCell.row]?.[hoveredCell.col];
      if (hoveredBlock) {
        for (const block of mosaicData.blocks) {
          if (block.orbitId !== hoveredBlock.orbitId) continue;
          const bx = margin + block.col * blockW;
          const by = margin + block.row * blockH;
          const isHovered = block.row === hoveredCell.row && block.col === hoveredCell.col;

          p.noFill();
          p.stroke(isHovered ? p.color(255, 180, 50, 245) : p.color(0, 210, 255, 190));
          p.strokeWeight(isHovered ? 2.5 : 1.75);
          p.rect(bx + 1, by + 1, blockW - 2, blockH - 2, 3);
        }
      }
    }

    // 5. Orbit & Orientation Badges ([1,2,1][2,3,2][1,2,1] visualizer)
    if (guideOptions.showOrbitBadges) {
      p.textAlign(p.CENTER, p.CENTER);
      for (const block of mosaicData.blocks) {
        const cx = margin + (block.col + 0.5) * blockW;
        const cy = margin + (block.row + 0.5) * blockH;
        const rgb = ORBIT_COLORS[(block.orbitId - 1) % ORBIT_COLORS.length];
        const meta = D4_METADATA[block.transformFromSource] || D4_METADATA.id;

        const badgeW = Math.min(blockW * 0.78, 64);
        const badgeH = Math.min(blockH * 0.48, 30);

        p.fill(14, 15, 19, 215);
        p.stroke(rgb[0], rgb[1], rgb[2], 225);
        p.strokeWeight(1.5);
        p.rectMode(p.CENTER);
        p.rect(cx, cy, badgeW, badgeH, 6);

        p.noStroke();
        p.fill(rgb[0], rgb[1], rgb[2], 255);
        p.textSize(Math.max(10, Math.min(13, badgeH * 0.45)));
        p.textStyle(p.BOLD);
        p.text(`${block.orbitId} ${meta.arrow}`, cx, cy + 0.5);
      }
      p.rectMode(p.CORNER);
    }

    p.pop();
  }

  window.MosaicEngine = {
    generateMosaic,
    renderMosaicToContext,
    renderGuidesAndOverlays
  };
})();

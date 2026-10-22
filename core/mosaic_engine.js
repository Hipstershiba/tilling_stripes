/**
 * core/mosaic_engine.js
 * Pure data generation and vector/canvas rendering engine for Tiling Stripes v2.
 */

(function () {
  const {
    D4_METADATA,
    transformGridCoords,
    composeD4,
    invertD4,
    applyD4ToContext,
    getAllowedTransformsForSymmetry,
    resolveCellSymmetry
  } = window.D4Symmetry;

  const {
    TILE_RENDERERS,
    getTransformedTileId,
    getNextTileInFamily
  } = window.TileRegistry;

  const EDIT_SCOPES = {
    canvas_center: {
      id: 'canvas_center',
      name: 'Centro do Canvas',
      subtitle: 'Simetria Global Pura',
      shortcut: '1',
      description: 'Propaga em torno do centro absoluto do canvas (Mandala 8×, Giro 4× ou Espelho X/Y), independente das divisões de blocos.'
    },
    orbit_sym: {
      id: 'orbit_sym',
      name: 'Órbita (Bloco+Grade)',
      subtitle: 'Caleidoscópio Hierárquico',
      shortcut: '2',
      description: 'Edita e propaga combinando a simetria interna do Supertile (Bloco) com a simetria macro da grade.'
    },
    block_sym: {
      id: 'block_sym',
      name: 'Dentro do Supertile',
      subtitle: '4 quadrantes do bloco',
      shortcut: '3',
      description: 'Reflete/rotaciona apenas dentro dos quadrantes internos do Supertile (bloco) clicado.'
    },
    all_blocks: {
      id: 'all_blocks',
      name: 'Todos os Supertiles',
      subtitle: 'Grade inteira sincronizada',
      shortcut: '4',
      description: 'Propaga a edição (respeitando a simetria e orientação de cada bloco) para todos os Supertiles da grade.'
    },
    single: {
      id: 'single',
      name: 'Livre (Pontual)',
      subtitle: 'Sem espelhamento',
      shortcut: '5',
      description: 'Aplica exclusivamente na área sob o cursor (Tile ou Supertile), sem propagar para outros cantos.'
    },
    same_tile: {
      id: 'same_tile',
      name: 'Mesmo Tile',
      subtitle: 'Substituição global',
      shortcut: '6',
      description: 'Seleciona todos os subtiles do mosaico que usam exatamente o mesmo Tile sob o cursor.'
    }
  };

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
    if (hoveredCell && guideOptions.highlightHoverOrbit && !guideOptions.isEditTool) {
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

  /**
   * Computes internal block symmetry targets for (subRow, subCol) inside an N x N block.
   */
  function resolveInternalBlockSubtileTargets(subRow, subCol, N, blockSymmetryMode) {
    const blockTransforms = getAllowedTransformsForSymmetry(blockSymmetryMode, N, N);
    const seen = new Set();
    const list = [];

    for (const gBlock of blockTransforms) {
      const [sr, sc] = transformGridCoords(subRow, subCol, N, N, gBlock);
      const key = `${sr},${sc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        subRow: sr,
        subCol: sc,
        relTransform: gBlock,
        isAnchorSubtile: sr === subRow && sc === subCol
      });
    }
    return list;
  }

  /**
   * Resolves all target subtiles in the mosaic for a given hitCell and D4 scopeMode.
   * Each target contains { row, col, subRow, subCol, relTransform, isAnchor }.
   */
  function resolveEditScopeTargets(mosaicData, hitCell, scopeMode, canvasCenterSymmetry = 'mandala_d4') {
    if (!mosaicData || !hitCell) return [];
    const { rows, cols, subtilesPerSide: N } = mosaicData;
    const { row: r0, col: c0, subRow: sr0, subCol: sc0 } = hitCell;

    const anchorBlock = mosaicData.grid[r0]?.[c0];
    const anchorCell = anchorBlock?.cells[sr0]?.[sc0];
    if (!anchorBlock || !anchorCell) return [];

    if (scopeMode === 'single') {
      return [
        {
          row: r0,
          col: c0,
          subRow: sr0,
          subCol: sc0,
          relTransform: 'id',
          isAnchor: true
        }
      ];
    }

    if (scopeMode === 'canvas_center') {
      const totalR = rows * N;
      const totalC = cols * N;
      const gr0 = r0 * N + sr0;
      const gc0 = c0 * N + sc0;
      const globalTransforms = getAllowedTransformsForSymmetry(
        canvasCenterSymmetry || 'mandala_d4',
        totalR,
        totalC
      );
      const seen = new Set();
      const targets = [];

      for (const gGlobal of globalTransforms) {
        const [tGR, tGC] = transformGridCoords(gr0, gc0, totalR, totalC, gGlobal);
        if (tGR < 0 || tGR >= totalR || tGC < 0 || tGC >= totalC) continue;
        const key = `${tGR},${tGC}`;
        if (seen.has(key)) continue;
        seen.add(key);

        targets.push({
          row: Math.floor(tGR / N),
          col: Math.floor(tGC / N),
          subRow: tGR % N,
          subCol: tGC % N,
          relTransform: gGlobal,
          isAnchor: tGR === gr0 && tGC === gc0
        });
      }
      return targets;
    }

    if (scopeMode === 'block_sym') {
      const internal = resolveInternalBlockSubtileTargets(sr0, sc0, N, mosaicData.blockSymmetryMode);
      return internal.map((bt) => ({
        row: r0,
        col: c0,
        subRow: bt.subRow,
        subCol: bt.subCol,
        relTransform: bt.relTransform,
        isAnchor: bt.isAnchorSubtile
      }));
    }

    if (scopeMode === 'orbit_sym') {
      const internal = resolveInternalBlockSubtileTargets(sr0, sc0, N, mosaicData.blockSymmetryMode);
      const gridTransforms = getAllowedTransformsForSymmetry(mosaicData.gridSymmetryMode, rows, cols);
      const seen = new Set();
      const targets = [];

      for (const gGrid of gridTransforms) {
        const [br, bc] = transformGridCoords(r0, c0, rows, cols, gGrid);
        if (br < 0 || br >= rows || bc < 0 || bc >= cols) continue;

        for (const bt of internal) {
          const [sr, sc] = transformGridCoords(bt.subRow, bt.subCol, N, N, gGrid);
          const key = `${br},${bc},${sr},${sc}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const totalTransform = composeD4(gGrid, bt.relTransform);
          targets.push({
            row: br,
            col: bc,
            subRow: sr,
            subCol: sc,
            relTransform: totalTransform,
            isAnchor: br === r0 && bc === c0 && sr === sr0 && sc === sc0
          });
        }
      }
      return targets;
    }

    if (scopeMode === 'all_blocks') {
      const internal = resolveInternalBlockSubtileTargets(sr0, sc0, N, mosaicData.blockSymmetryMode);
      const invAnchorBlockTransform = invertD4(anchorBlock.transformFromSource || 'id');
      const seen = new Set();
      const targets = [];

      for (let br = 0; br < rows; br++) {
        for (let bc = 0; bc < cols; bc++) {
          const targetBlock = mosaicData.grid[br][bc];
          const relGrid = br === r0 && bc === c0
            ? 'id'
            : composeD4(targetBlock.transformFromSource || 'id', invAnchorBlockTransform);

          for (const bt of internal) {
            const [sr, sc] = transformGridCoords(bt.subRow, bt.subCol, N, N, relGrid);
            const key = `${br},${bc},${sr},${sc}`;
            if (seen.has(key)) continue;
            seen.add(key);

            targets.push({
              row: br,
              col: bc,
              subRow: sr,
              subCol: sc,
              relTransform: composeD4(relGrid, bt.relTransform),
              isAnchor: br === r0 && bc === c0 && sr === sr0 && sc === sc0
            });
          }
        }
      }
      return targets;
    }

    if (scopeMode === 'same_tile') {
      const matchTileId = anchorCell.tileId;
      const targets = [];
      for (let br = 0; br < rows; br++) {
        for (let bc = 0; bc < cols; bc++) {
          const block = mosaicData.grid[br][bc];
          for (let sr = 0; sr < N; sr++) {
            for (let sc = 0; sc < N; sc++) {
              const cell = block.cells[sr][sc];
              if (cell && cell.tileId === matchTileId) {
                targets.push({
                  row: br,
                  col: bc,
                  subRow: sr,
                  subCol: sc,
                  relTransform: 'id',
                  isAnchor: br === r0 && bc === c0 && sr === sr0 && sc === sc0
                });
              }
            }
          }
        }
      }
      return targets;
    }

    return [];
  }

  /**
   * Creates a uniform H x W Supertile / Brush pattern filled with (baseTileId, transform).
   */
  function createSupertilePattern(rows, cols, baseTileId = 2, transform = 'id') {
    const H = Math.max(1, parseInt(rows, 10) || 1);
    const W = Math.max(1, parseInt(cols, 10) || 1);
    const tileId = getTransformedTileId(baseTileId, transform || 'id');
    const cells = Array.from({ length: H }, () =>
      Array.from({ length: W }, () => ({
        baseTileId,
        tileId,
        transform: transform || 'id'
      }))
    );
    return {
      rows: H,
      cols: W,
      cells
    };
  }

  /**
   * Resizes an existing Supertile pattern to (newRows x newCols), preserving overlapping cells.
   */
  function resizeSupertilePattern(prevPattern, newRows, newCols, fillBaseTileId = 2, fillTransform = 'id') {
    const H = Math.max(1, parseInt(newRows, 10) || 1);
    const W = Math.max(1, parseInt(newCols, 10) || 1);
    const defaultTileId = getTransformedTileId(fillBaseTileId, fillTransform || 'id');

    const cells = Array.from({ length: H }, (_, r) =>
      Array.from({ length: W }, (__, c) => {
        const prev = prevPattern?.cells?.[r]?.[c];
        if (prev) {
          return {
            baseTileId: prev.baseTileId,
            tileId: prev.tileId,
            transform: prev.transform || 'id'
          };
        }
        return {
          baseTileId: fillBaseTileId,
          tileId: defaultTileId,
          transform: fillTransform || 'id'
        };
      })
    );

    return {
      rows: H,
      cols: W,
      cells
    };
  }

  /**
   * Applies internal D4 symmetry (e.g. mandala_d4, rotational_c4, bilateral_d2)
   * from the top-left canonical cells of a Supertile pattern to all its cells.
   */
  function symmetrizeSupertilePattern(pattern, symmetryMode = 'mandala_d4') {
    if (!pattern || !pattern.cells) return pattern;
    const H = pattern.rows;
    const W = pattern.cols;
    const nextCells = Array.from({ length: H }, () => new Array(W));

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const rel = resolveCellSymmetry(r, c, H, W, symmetryMode);
        const srcCell = pattern.cells[rel.sourceRow]?.[rel.sourceCol] || {
          baseTileId: 0,
          tileId: 0,
          transform: 'id'
        };
        const composed = composeD4(rel.transformFromSource, srcCell.transform || 'id');
        nextCells[r][c] = {
          baseTileId: srcCell.baseTileId,
          tileId: getTransformedTileId(srcCell.baseTileId, composed),
          transform: composed
        };
      }
    }

    return {
      ...pattern,
      rows: H,
      cols: W,
      cells: nextCells
    };
  }

  /**
   * Captures any rectangular region of subtiles [gr0..gr1, gc0..gc1] in global subtile coordinates
   * for the Clone / Stamp / Supertile brush.
   */
  function captureSubtileRegion(mosaicData, gr0, gc0, gr1, gc1) {
    if (!mosaicData) return null;
    const N = mosaicData.subtilesPerSide;
    const totalRows = mosaicData.rows * N;
    const totalCols = mosaicData.cols * N;

    const minGR = Math.max(0, Math.min(totalRows - 1, Math.min(gr0, gr1)));
    const maxGR = Math.max(0, Math.min(totalRows - 1, Math.max(gr0, gr1)));
    const minGC = Math.max(0, Math.min(totalCols - 1, Math.min(gc0, gc1)));
    const maxGC = Math.max(0, Math.min(totalCols - 1, Math.max(gc0, gc1)));

    const patRows = maxGR - minGR + 1;
    const patCols = maxGC - minGC + 1;
    if (patRows <= 0 || patCols <= 0) return null;

    const cells = Array.from({ length: patRows }, (_, pr) =>
      Array.from({ length: patCols }, (__, pc) => {
        const gr = minGR + pr;
        const gc = minGC + pc;
        const br = Math.floor(gr / N);
        const bc = Math.floor(gc / N);
        const sr = gr % N;
        const sc = gc % N;
        const cell = mosaicData.grid[br]?.[bc]?.cells[sr]?.[sc];
        return cell
          ? {
              baseTileId: cell.baseTileId,
              tileId: cell.tileId,
              transform: cell.transform || 'id'
            }
          : { baseTileId: 0, tileId: 0, transform: 'id' };
      })
    );

    return {
      minGlobalRow: minGR,
      minGlobalCol: minGC,
      maxGlobalRow: maxGR,
      maxGlobalCol: maxGC,
      rows: patRows,
      cols: patCols,
      subtilesPerSide: N,
      cells
    };
  }

  /**
   * Captures a full block (Supertile) at (row, col) as a Clone Pattern.
   */
  function captureBlockPattern(mosaicData, row, col) {
    if (!mosaicData) return null;
    const N = mosaicData.subtilesPerSide;
    return captureSubtileRegion(
      mosaicData,
      row * N,
      col * N,
      (row + 1) * N - 1,
      (col + 1) * N - 1
    );
  }

  /**
   * Transforms a rectangular Clone / Supertile Pattern (H x W subtiles) by any D4 transform key.
   */
  function transformClonePattern(stampPattern, transformKey = 'id') {
    if (!stampPattern || !stampPattern.cells) return null;
    if (!transformKey || transformKey === 'id') return stampPattern;

    const H = stampPattern.rows;
    const W = stampPattern.cols;
    const meta = D4_METADATA[transformKey] || D4_METADATA.id;
    const outRows = meta.swapsAxes ? W : H;
    const outCols = meta.swapsAxes ? H : W;

    const outCells = Array.from({ length: outRows }, () => new Array(outCols));

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const srcCell = stampPattern.cells[r][c];
        const [tr, tc] = transformGridCoords(r, c, H, W, transformKey);
        const nextTransform = composeD4(transformKey, srcCell.transform || 'id');
        const nextTileId = getTransformedTileId(srcCell.baseTileId, nextTransform);
        if (tr >= 0 && tr < outRows && tc >= 0 && tc < outCols) {
          outCells[tr][tc] = {
            baseTileId: srcCell.baseTileId,
            tileId: nextTileId,
            transform: nextTransform
          };
        }
      }
    }

    return {
      ...stampPattern,
      rows: outRows,
      cols: outCols,
      cells: outCells
    };
  }

  /**
   * Resolves all target subtile placements when stamping/painting `stampPattern` at `hitCell`
   * under the active D4 `scopeMode` and `stampTransform`.
   * Supports `options = { snapToBlock, canvasCenterSymmetry, explicitStartGR, explicitStartGC }`.
   */
  function resolveStampRegionPlacements(
    mosaicData,
    stampPattern,
    hitCell,
    scopeMode,
    stampTransform = 'id',
    options = {}
  ) {
    if (!mosaicData || !stampPattern || !hitCell) {
      return { placements: [], anchorBounds: null };
    }

    const N = mosaicData.subtilesPerSide;
    const totalR = mosaicData.rows * N;
    const totalC = mosaicData.cols * N;

    const transformedPat = transformClonePattern(stampPattern, stampTransform || 'id');
    if (!transformedPat) return { placements: [], anchorBounds: null };

    const H = transformedPat.rows;
    const W = transformedPat.cols;

    let startGR;
    let startGC;
    if (Number.isInteger(options.explicitStartGR) && Number.isInteger(options.explicitStartGC)) {
      startGR = options.explicitStartGR;
      startGC = options.explicitStartGC;
    } else if (options.snapToBlock) {
      startGR = hitCell.row * N;
      startGC = hitCell.col * N;
    } else {
      const anchorGR = hitCell.row * N + hitCell.subRow;
      const anchorGC = hitCell.col * N + hitCell.subCol;
      startGR = anchorGR - Math.floor((H - 1) / 2);
      startGC = anchorGC - Math.floor((W - 1) / 2);
    }

    const anchorBounds = {
      minGR: startGR,
      minGC: startGC,
      maxGR: startGR + H - 1,
      maxGC: startGC + W - 1,
      rows: H,
      cols: W
    };

    // Collect valid anchor cells
    const anchorCells = [];
    for (let pr = 0; pr < H; pr++) {
      for (let pc = 0; pc < W; pc++) {
        const gr = startGR + pr;
        const gc = startGC + pc;
        if (gr < 0 || gr >= totalR || gc < 0 || gc >= totalC) continue;
        const c = transformedPat.cells[pr][pc];
        if (!c) continue;
        anchorCells.push({
          gr,
          gc,
          baseTileId: c.baseTileId,
          tileId: c.tileId,
          transform: c.transform || 'id'
        });
      }
    }

    const cellMap = new Map();
    const putPlacement = (gr, gc, baseTileId, transform, isAnchor) => {
      if (gr < 0 || gr >= totalR || gc < 0 || gc >= totalC) return;
      const key = `${gr},${gc}`;
      const existing = cellMap.get(key);
      if (existing) {
        if (isAnchor && !existing.isAnchor) {
          existing.isAnchor = true;
          existing.baseTileId = baseTileId;
          existing.transform = transform;
          existing.tileId = getTransformedTileId(baseTileId, transform);
        }
        return;
      }
      cellMap.set(key, {
        gr,
        gc,
        row: Math.floor(gr / N),
        col: Math.floor(gc / N),
        subRow: gr % N,
        subCol: gc % N,
        baseTileId,
        transform,
        tileId: getTransformedTileId(baseTileId, transform),
        isAnchor: Boolean(isAnchor)
      });
    };

    if (scopeMode === 'single') {
      for (const ac of anchorCells) {
        putPlacement(ac.gr, ac.gc, ac.baseTileId, ac.transform, true);
      }
      return { placements: Array.from(cellMap.values()), anchorBounds };
    }

    if (scopeMode === 'same_tile') {
      if (anchorCells.length === 1) {
        const ac = anchorCells[0];
        const hoveredCell = mosaicData.grid[hitCell.row]?.[hitCell.col]?.cells[hitCell.subRow]?.[hitCell.subCol];
        const matchTileId = hoveredCell ? hoveredCell.tileId : null;
        if (matchTileId !== null) {
          for (let br = 0; br < mosaicData.rows; br++) {
            for (let bc = 0; bc < mosaicData.cols; bc++) {
              for (let sr = 0; sr < N; sr++) {
                for (let sc = 0; sc < N; sc++) {
                  const cell = mosaicData.grid[br][bc].cells[sr][sc];
                  if (cell && cell.tileId === matchTileId) {
                    const gr = br * N + sr;
                    const gc = bc * N + sc;
                    const isAnc = br === hitCell.row && bc === hitCell.col && sr === hitCell.subRow && sc === hitCell.subCol;
                    putPlacement(gr, gc, ac.baseTileId, ac.transform, isAnc);
                  }
                }
              }
            }
          }
          return { placements: Array.from(cellMap.values()), anchorBounds };
        }
      }
      // If multi-cell pattern in same_tile mode, do not perform silent partial fallback
      return { placements: [], anchorBounds };
    }

    if (scopeMode === 'canvas_center') {
      const centerSym = options.canvasCenterSymmetry || 'mandala_d4';
      const globalTransforms = getAllowedTransformsForSymmetry(centerSym, totalR, totalC);

      for (const gGlobal of globalTransforms) {
        const isAnchorCopy = gGlobal === 'id';
        for (const ac of anchorCells) {
          const [tGR, tGC] = transformGridCoords(ac.gr, ac.gc, totalR, totalC, gGlobal);
          const finalTransform = composeD4(gGlobal, ac.transform);
          putPlacement(tGR, tGC, ac.baseTileId, finalTransform, isAnchorCopy);
        }
      }
      return { placements: Array.from(cellMap.values()), anchorBounds };
    }

    if (scopeMode === 'block_sym') {
      const blockTransforms = getAllowedTransformsForSymmetry(mosaicData.blockSymmetryMode, N, N);
      const bRow = hitCell.row;
      const bCol = hitCell.col;

      for (const gBlock of blockTransforms) {
        const isId = gBlock === 'id';
        for (const ac of anchorCells) {
          const localR = ac.gr - bRow * N;
          const localC = ac.gc - bCol * N;
          const [tr, tc] = transformGridCoords(localR, localC, N, N, gBlock);
          const tGR = bRow * N + tr;
          const tGC = bCol * N + tc;
          const composed = composeD4(gBlock, ac.transform);
          putPlacement(tGR, tGC, ac.baseTileId, composed, isId);
        }
      }
      return { placements: Array.from(cellMap.values()), anchorBounds };
    }

    if (scopeMode === 'all_blocks') {
      const anchorBlock = mosaicData.grid[hitCell.row]?.[hitCell.col];
      const invAnchor = invertD4(anchorBlock?.transformFromSource || 'id');

      for (let br = 0; br < mosaicData.rows; br++) {
        for (let bc = 0; bc < mosaicData.cols; bc++) {
          const blk = mosaicData.grid[br][bc];
          const isAnchorBlk = br === hitCell.row && bc === hitCell.col;
          const relGrid = isAnchorBlk
            ? 'id'
            : composeD4(blk.transformFromSource || 'id', invAnchor);

          for (const ac of anchorCells) {
            const localR = ac.gr - hitCell.row * N;
            const localC = ac.gc - hitCell.col * N;
            const [tr, tc] = transformGridCoords(localR, localC, N, N, relGrid);
            const tGR = br * N + tr;
            const tGC = bc * N + tc;
            const composed = composeD4(relGrid, ac.transform);
            putPlacement(tGR, tGC, ac.baseTileId, composed, isAnchorBlk);
          }
        }
      }
      return { placements: Array.from(cellMap.values()), anchorBounds };
    }

    // Default: 'orbit_sym' (Caleidoscópio Hierárquico Bloco + Grade)
    const gridTransforms = getAllowedTransformsForSymmetry(mosaicData.gridSymmetryMode, totalR, totalC);
    const smallFitsQuadrant = H <= Math.max(1, Math.floor(N / 2)) && W <= Math.max(1, Math.floor(N / 2));
    const blockTransforms = smallFitsQuadrant
      ? getAllowedTransformsForSymmetry(mosaicData.blockSymmetryMode, N, N)
      : ['id'];

    const bRow = hitCell.row;
    const bCol = hitCell.col;

    for (const gGrid of gridTransforms) {
      for (const gBlock of blockTransforms) {
        const isAnchorCopy = gGrid === 'id' && gBlock === 'id';
        for (const ac of anchorCells) {
          let interGR = ac.gr;
          let interGC = ac.gc;
          let interTransform = ac.transform;

          if (gBlock !== 'id') {
            const localR = ac.gr - bRow * N;
            const localC = ac.gc - bCol * N;
            const [br, bc] = transformGridCoords(localR, localC, N, N, gBlock);
            interGR = bRow * N + br;
            interGC = bCol * N + bc;
            interTransform = composeD4(gBlock, interTransform);
          }

          const [tGR, tGC] = transformGridCoords(interGR, interGC, totalR, totalC, gGrid);
          const finalTransform = composeD4(gGrid, interTransform);
          putPlacement(tGR, tGC, ac.baseTileId, finalTransform, isAnchorCopy);
        }
      }
    }

    return { placements: Array.from(cellMap.values()), anchorBounds };
  }

  /**
   * Resolves all target subtile placements for the Rotate tool ('rotate') of any brush size
   * (1x1, 2x2, 3x3, 4x4, or full Supertile 'block') in either:
   * - rotateGroupMode === 'group' (rotates the K x K region as a rigid Supertile block)
   * - rotateGroupMode === 'individual' (rotates each subtile in place inside the K x K region)
   */
  function resolveRotateRegionPlacements(mosaicData, hitCell, options = {}) {
    if (!mosaicData || !hitCell) {
      return { placements: [], anchorBounds: null };
    }

    const N = mosaicData.subtilesPerSide;
    const totalR = mosaicData.rows * N;
    const totalC = mosaicData.cols * N;

    const isBlockSize = options.rotateSize === 'block';
    const K = isBlockSize ? N : Math.max(1, parseInt(options.rotateSize, 10) || 1);
    const snapToBlock = Boolean(options.snapToBlock || isBlockSize);
    const rotateGroupMode = options.rotateGroupMode || 'group'; // 'group' | 'individual'
    const rotateBehavior = options.rotateBehavior || 'd4_r90'; // 'd4_r90' | 'family'
    const step = options.step < 0 ? -1 : 1;
    const scopeMode = options.scopeMode || 'canvas_center';
    const canvasCenterSymmetry = options.canvasCenterSymmetry || 'mandala_d4';

    let startGR;
    let startGC;
    if (snapToBlock) {
      startGR = hitCell.row * N;
      startGC = hitCell.col * N;
    } else {
      const anchorGR = hitCell.row * N + hitCell.subRow;
      const anchorGC = hitCell.col * N + hitCell.subCol;
      startGR = Math.max(0, Math.min(totalR - K, anchorGR - Math.floor((K - 1) / 2)));
      startGC = Math.max(0, Math.min(totalC - K, anchorGC - Math.floor((K - 1) / 2)));
    }

    const captured = captureSubtileRegion(
      mosaicData,
      startGR,
      startGC,
      startGR + K - 1,
      startGC + K - 1
    );
    if (!captured) return { placements: [], anchorBounds: null };

    const rotKey = step < 0 ? 'r270' : 'r90';
    let rotatedPattern;

    if (K > 1 && rotateGroupMode === 'group') {
      // Rigid Supertile rotation: rotates the KxK coordinates AND each tile's orientation by +/-90°
      rotatedPattern = transformClonePattern(captured, rotKey);
    } else {
      // Individual subtile rotation in place
      const nextCells = Array.from({ length: captured.rows }, (_, r) =>
        Array.from({ length: captured.cols }, (__, c) => {
          const src = captured.cells[r][c];
          if (rotateBehavior === 'family') {
            const nextBase = getNextTileInFamily(src.baseTileId, step);
            const nextTr = src.transform || 'id';
            return {
              baseTileId: nextBase,
              tileId: getTransformedTileId(nextBase, nextTr),
              transform: nextTr
            };
          }
          const nextTr = composeD4(rotKey, src.transform || 'id');
          return {
            baseTileId: src.baseTileId,
            tileId: getTransformedTileId(src.baseTileId, nextTr),
            transform: nextTr
          };
        })
      );
      rotatedPattern = {
        ...captured,
        cells: nextCells
      };
    }

    return resolveStampRegionPlacements(
      mosaicData,
      rotatedPattern,
      hitCell,
      scopeMode,
      'id',
      {
        snapToBlock,
        canvasCenterSymmetry,
        explicitStartGR: startGR,
        explicitStartGC: startGC
      }
    );
  }

  /**
   * Backwards-compatible wrapper for resolveStampBlockTargets.
   */
  function resolveStampBlockTargets(mosaicData, hitRow, hitCol, scopeMode, stampTransform = 'id') {
    if (!mosaicData) return [];
    return [];
  }

  /**
   * Applies a subtile edit (Paint or Rotate/Cycle) across all resolved scope targets.
   * Returns true if at least one cell changed.
   */
  function applySubtileEdit(mosaicData, targets, newAnchorBaseTileId, newAnchorTransform = 'id') {
    if (!mosaicData || !Array.isArray(targets) || targets.length === 0) return false;
    let changed = false;

    for (const t of targets) {
      const cell = mosaicData.grid[t.row]?.[t.col]?.cells[t.subRow]?.[t.subCol];
      if (!cell) continue;

      const composedTransform = composeD4(t.relTransform, newAnchorTransform);
      const nextTileId = getTransformedTileId(newAnchorBaseTileId, composedTransform);

      if (
        cell.baseTileId !== newAnchorBaseTileId ||
        cell.transform !== composedTransform ||
        cell.tileId !== nextTileId
      ) {
        cell.baseTileId = newAnchorBaseTileId;
        cell.transform = composedTransform;
        cell.tileId = nextTileId;
        changed = true;
      }
    }

    return changed;
  }

  /**
   * Applies resolved clone/stamp placements to the mosaic.
   * Returns true if at least one cell changed.
   */
  function applyStampPlacements(mosaicData, placements) {
    if (!mosaicData || !Array.isArray(placements) || placements.length === 0) {
      return false;
    }

    let changed = false;
    for (const p of placements) {
      const dstCell = mosaicData.grid[p.row]?.[p.col]?.cells[p.subRow]?.[p.subCol];
      if (!dstCell) continue;
      if (
        dstCell.baseTileId !== p.baseTileId ||
        dstCell.transform !== p.transform ||
        dstCell.tileId !== p.tileId
      ) {
        dstCell.baseTileId = p.baseTileId;
        dstCell.transform = p.transform;
        dstCell.tileId = p.tileId;
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Creates a lightweight deep snapshot of all cells in mosaicData for Undo/Redo.
   */
  function cloneMosaicCellsSnapshot(mosaicData) {
    if (!mosaicData) return null;
    const { rows, cols, subtilesPerSide: N } = mosaicData;
    const gridSnap = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (__, c) =>
        Array.from({ length: N }, (___, sr) =>
          Array.from({ length: N }, (____, sc) => {
            const cell = mosaicData.grid[r][c].cells[sr][sc];
            return {
              baseTileId: cell.baseTileId,
              tileId: cell.tileId,
              transform: cell.transform
            };
          })
        )
      )
    );
    return {
      rows,
      cols,
      subtilesPerSide: N,
      gridSnap
    };
  }

  /**
   * Restores a snapshot into mosaicData in-place.
   */
  function restoreMosaicCellsSnapshot(mosaicData, snapshot) {
    if (!mosaicData || !snapshot) return false;
    if (
      mosaicData.rows !== snapshot.rows ||
      mosaicData.cols !== snapshot.cols ||
      mosaicData.subtilesPerSide !== snapshot.subtilesPerSide
    ) {
      return false;
    }

    const { rows, cols, subtilesPerSide: N } = mosaicData;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        for (let sr = 0; sr < N; sr++) {
          for (let sc = 0; sc < N; sc++) {
            const dst = mosaicData.grid[r][c].cells[sr][sc];
            const src = snapshot.gridSnap[r][c][sr][sc];
            dst.baseTileId = src.baseTileId;
            dst.tileId = src.tileId;
            dst.transform = src.transform;
          }
        }
      }
    }
    return true;
  }

  /**
   * Helper to draw corner brackets around a subtile bounding box [minGR..maxGR, minGC..maxGC].
   */
  function drawSubtileRegionBrackets(p, margin, subW, subH, minGR, minGC, maxGR, maxGC, strokeCol) {
    const sx = margin + minGC * subW;
    const sy = margin + minGR * subH;
    const rw = (maxGC - minGC + 1) * subW;
    const rh = (maxGR - minGR + 1) * subH;
    const bLen = Math.min(rw, rh, Math.max(subW, subH) * 1.2) * 0.28;

    p.noFill();
    p.stroke(strokeCol);
    p.strokeWeight(2.2);
    // TL
    p.line(sx + 2, sy + 2 + bLen, sx + 2, sy + 2);
    p.line(sx + 2, sy + 2, sx + 2 + bLen, sy + 2);
    // TR
    p.line(sx + rw - 2 - bLen, sy + 2, sx + rw - 2, sy + 2);
    p.line(sx + rw - 2, sy + 2, sx + rw - 2, sy + 2 + bLen);
    // BL
    p.line(sx + 2, sy + rh - 2 - bLen, sx + 2, sy + rh - 2);
    p.line(sx + 2, sy + rh - 2, sx + 2 + bLen, sy + rh - 2);
    // BR
    p.line(sx + rw - 2 - bLen, sy + rh - 2, sx + rw - 2, sy + rh - 2);
    p.line(sx + rw - 2, sy + rh - 2 - bLen, sx + rw - 2, sy + rh - 2);
  }

  /**
   * Renders the interactive Edit Scope highlights and Ghost Preview onto the p5 canvas.
   */
  function renderEditScopeAndGhostOverlay(p, mosaicData, layoutConfig, editPreview) {
    if (!mosaicData || !editPreview) return;

    const canvasW = layoutConfig.width;
    const canvasH = layoutConfig.height;
    const margin = Math.max(0, Number(layoutConfig.margin) || 0);
    const paddingRatio = Math.max(0, Math.min(0.35, Number(layoutConfig.paddingRatio ?? 0.05)));
    const drawW = canvasW - margin * 2;
    const drawH = canvasH - margin * 2;
    if (drawW <= 0 || drawH <= 0) return;

    const blockW = drawW / mosaicData.cols;
    const blockH = drawH / mosaicData.rows;
    const N = mosaicData.subtilesPerSide;
    const subW = blockW / N;
    const subH = blockH / N;
    const subPadding = Math.min(subW, subH) * paddingRatio;
    const bgColor = layoutConfig.bgColor || '#0c0c0e';
    const fgColor = layoutConfig.fgColor || '#e2e0dc';

    p.push();

    // Subtle Global Canvas Center Axis Indicator when 'canvas_center' scope is active
    if (editPreview.scopeMode === 'canvas_center') {
      const cx = margin + drawW / 2;
      const cy = margin + drawH / 2;
      const sym = editPreview.canvasCenterSymmetry || 'mandala_d4';

      p.noFill();
      p.stroke(0, 210, 255, 85);
      p.strokeWeight(1.1);
      if (sym === 'mandala_d4' || sym === 'bilateral_d2' || sym === 'mirror_x' || sym === 'rotational_c4') {
        p.line(cx, margin, cx, margin + drawH);
      }
      if (sym === 'mandala_d4' || sym === 'bilateral_d2' || sym === 'mirror_y' || sym === 'rotational_c4') {
        p.line(margin, cy, margin + drawW, cy);
      }
      if (sym === 'mandala_d4' && mosaicData.rows === mosaicData.cols) {
        p.stroke(0, 210, 255, 55);
        p.line(margin, margin, margin + drawW, margin + drawH);
        p.line(margin + drawW, margin, margin, margin + drawH);
      }
      p.fill(14, 18, 24, 210);
      p.stroke(0, 210, 255, 220);
      p.strokeWeight(1.6);
      p.circle(cx, cy, 10);
    }

    // 1. Highlight captured source region with emerald corner brackets if present
    if (editPreview.stampBlock && Number.isInteger(editPreview.stampBlock.minGlobalRow)) {
      drawSubtileRegionBrackets(
        p,
        margin,
        subW,
        subH,
        editPreview.stampBlock.minGlobalRow,
        editPreview.stampBlock.minGlobalCol,
        editPreview.stampBlock.maxGlobalRow,
        editPreview.stampBlock.maxGlobalCol,
        p.color(52, 211, 153, 200)
      );
    }

    // 2. If user is actively Click-and-Dragging to select a Clone / Supertile Region
    if (editPreview.dragSelectionRect) {
      const { minGR, minGC, maxGR, maxGC } = editPreview.dragSelectionRect;
      const sx = margin + minGC * subW;
      const sy = margin + minGR * subH;
      const rw = (maxGC - minGC + 1) * subW;
      const rh = (maxGR - minGR + 1) * subH;

      p.fill(52, 211, 153, 42);
      p.stroke(52, 211, 153, 245);
      p.strokeWeight(2);
      p.rect(sx, sy, rw, rh, 3);

      // Subtile grid inside selection marquee
      p.stroke(52, 211, 153, 120);
      p.strokeWeight(1);
      for (let r = minGR; r <= maxGR; r++) {
        for (let c = minGC; c <= maxGC; c++) {
          p.rect(margin + c * subW + 1, margin + r * subH + 1, subW - 2, subH - 2, 2);
        }
      }

      // Dimensions badge
      const selCols = maxGC - minGC + 1;
      const selRows = maxGR - minGR + 1;
      const label = `Supertile: ${selCols} × ${selRows} subtiles`;
      p.noStroke();
      p.fill(16, 24, 22, 235);
      p.rectMode(p.CENTER);
      p.rect(sx + rw / 2, Math.max(margin + 14, sy - 14), 144, 22, 5);
      p.fill(52, 211, 153, 255);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(11);
      p.textStyle(p.BOLD);
      p.text(label, sx + rw / 2, Math.max(margin + 14, sy - 14));
      p.rectMode(p.CORNER);

      p.pop();
      return;
    }

    // 3. If in 'select' mode (waiting for user to click & drag a region), highlight hovered subtile or block
    if (editPreview.stampInteractionMode === 'select') {
      if (editPreview.hoveredCell) {
        if (editPreview.snapToBlock) {
          const minGR = editPreview.hoveredCell.row * N;
          const minGC = editPreview.hoveredCell.col * N;
          const sx = margin + minGC * subW;
          const sy = margin + minGR * subH;
          p.fill(52, 211, 153, 35);
          p.stroke(52, 211, 153, 245);
          p.strokeWeight(2.2);
          p.rect(sx + 1, sy + 1, blockW - 2, blockH - 2, 4);
        } else {
          const gr = editPreview.hoveredCell.row * N + editPreview.hoveredCell.subRow;
          const gc = editPreview.hoveredCell.col * N + editPreview.hoveredCell.subCol;
          const sx = margin + gc * subW;
          const sy = margin + gr * subH;
          p.fill(52, 211, 153, 35);
          p.stroke(52, 211, 153, 245);
          p.strokeWeight(2.2);
          p.rect(sx + 1, sy + 1, subW - 2, subH - 2, 3);
        }
      }
      p.pop();
      return;
    }

    // 4. Unified Region Placements Ghost Preview (Paint Supertile / Rotate Region / Clone Stamp)
    const placements = editPreview.regionPlacements || editPreview.stampPlacements || [];
    if (placements.length > 0) {
      const bgCol = p.color(bgColor);
      bgCol.setAlpha(185);
      const ghostFg = p.color(fgColor);
      ghostFg.setAlpha(220);

      const isRotateTool = editPreview.tool === 'rotate';

      for (const pl of placements) {
        const sx = margin + pl.gc * subW;
        const sy = margin + pl.gr * subH;

        if (!isRotateTool) {
          p.noStroke();
          p.fill(bgCol);
          p.rect(sx, sy, subW, subH);

          const renderer = TILE_RENDERERS[pl.baseTileId] || TILE_RENDERERS[pl.tileId];
          if (renderer) {
            const meta = D4_METADATA[pl.transform] || D4_METADATA.id;
            const dw = meta.swapsAxes ? subH : subW;
            const dh = meta.swapsAxes ? subW : subH;

            p.push();
            p.translate(sx + subW / 2, sy + subH / 2);
            applyD4ToContext(p, pl.transform);
            renderer(p, dw, dh, subPadding, ghostFg);
            p.pop();
          }
        }

        p.noFill();
        p.stroke(pl.isAnchor ? p.color(255, 180, 50, 235) : p.color(0, 210, 255, 195));
        p.strokeWeight(pl.isAnchor ? 1.8 : 1.3);
        p.rect(sx + 1, sy + 1, subW - 2, subH - 2, 2);
      }

      if (editPreview.anchorBounds && (editPreview.anchorBounds.rows > 1 || editPreview.anchorBounds.cols > 1)) {
        const ab = editPreview.anchorBounds;
        drawSubtileRegionBrackets(
          p,
          margin,
          subW,
          subH,
          Math.max(0, ab.minGR),
          Math.max(0, ab.minGC),
          Math.min(mosaicData.rows * N - 1, ab.maxGR),
          Math.min(mosaicData.cols * N - 1, ab.maxGC),
          p.color(255, 180, 50, 255)
        );
      }

      p.pop();
      return;
    }

    // 5. Fallback: Single Subtile Scope Overlay + Ghost Preview
    const targets = editPreview.subtileTargets || [];
    if (targets.length === 0) {
      p.pop();
      return;
    }

    const showGhostTile = Number.isInteger(editPreview.previewBaseTileId);
    const previewAnchorTransform = editPreview.previewAnchorTransform || 'id';

    for (const t of targets) {
      const sx = margin + t.col * blockW + t.subCol * subW;
      const sy = margin + t.row * blockH + t.subRow * subH;

      if (showGhostTile && !editPreview.isEyedropper) {
        const bgCol = p.color(bgColor);
        bgCol.setAlpha(185);
        p.noStroke();
        p.fill(bgCol);
        p.rect(sx, sy, subW, subH);

        const renderer = TILE_RENDERERS[editPreview.previewBaseTileId];
        if (renderer) {
          const composed = composeD4(t.relTransform, previewAnchorTransform);
          const meta = D4_METADATA[composed] || D4_METADATA.id;
          const dw = meta.swapsAxes ? subH : subW;
          const dh = meta.swapsAxes ? subW : subH;
          const ghostFg = p.color(fgColor);
          ghostFg.setAlpha(220);

          p.push();
          p.translate(sx + subW / 2, sy + subH / 2);
          applyD4ToContext(p, composed);
          renderer(p, dw, dh, subPadding, ghostFg);
          p.pop();
        }
      }

      p.noFill();
      if (editPreview.isEyedropper) {
        if (t.isAnchor) {
          p.stroke(52, 211, 153, 255);
          p.strokeWeight(2.4);
          p.rect(sx + 1, sy + 1, subW - 2, subH - 2, 2);
        }
      } else if (t.isAnchor) {
        p.stroke(255, 180, 50, 255);
        p.strokeWeight(2.2);
        p.rect(sx + 1, sy + 1, subW - 2, subH - 2, 2);
      } else {
        p.stroke(0, 210, 255, 205);
        p.strokeWeight(1.4);
        p.rect(sx + 1, sy + 1, subW - 2, subH - 2, 2);
      }
    }

    p.pop();
  }

  window.MosaicEngine = {
    EDIT_SCOPES,
    generateMosaic,
    transformBlock,
    renderMosaicToContext,
    renderGuidesAndOverlays,
    resolveEditScopeTargets,
    resolveStampBlockTargets,
    applySubtileEdit,
    createSupertilePattern,
    resizeSupertilePattern,
    symmetrizeSupertilePattern,
    captureSubtileRegion,
    captureBlockPattern,
    transformClonePattern,
    resolveStampRegionPlacements,
    resolveRotateRegionPlacements,
    applyStampPlacements,
    cloneMosaicCellsSnapshot,
    restoreMosaicCellsSnapshot,
    renderEditScopeAndGhostOverlay
  };
})();


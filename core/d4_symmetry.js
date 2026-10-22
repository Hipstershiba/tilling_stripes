/**
 * core/d4_symmetry.js
 * Mathematical engine for the Dihedral Group D4 (8 symmetries of the square)
 * and grid/block orbit calculations for Tiling Stripes v2.
 */

const D4_TRANSFORMS = ['id', 'r90', 'r180', 'r270', 'mx', 'my', 'md', 'mad'];

// Priority order when resolving a transform from canonical source to target cell in D4:
// D2 reflections (id, mx, my, r180) first, followed by 90°/270° rotations and diagonal reflections (r90, r270, md, mad).
// In [1,2,1][2,3,2][1,2,1], edge blocks ('2') rotate 90° continuously (Top=id, Right=r90, Bottom=r180, Left=r270).
const D4_RESOLUTION_ORDER = ['id', 'mx', 'r180', 'my', 'r90', 'r270', 'md', 'mad'];
const C4_RESOLUTION_ORDER = ['id', 'r90', 'r180', 'r270'];
const D2_RESOLUTION_ORDER = ['id', 'mx', 'my', 'r180'];

const D4_METADATA = {
  id:   { label: '0° (Original)',       short: 'ID',   arrow: '↑', swapsAxes: false },
  r90:  { label: '90° Horário',         short: 'R90',  arrow: '→', swapsAxes: true  },
  r180: { label: '180° Rotação',        short: 'R180', arrow: '↓', swapsAxes: false },
  r270: { label: '270° Horário',        short: 'R270', arrow: '←', swapsAxes: true  },
  mx:   { label: 'Espelho Horizontal',  short: 'MX',   arrow: '⇄', swapsAxes: false },
  my:   { label: 'Espelho Vertical',    short: 'MY',   arrow: '⇅', swapsAxes: false },
  md:   { label: 'Espelho Diagonal \\', short: 'MD',   arrow: '⤡', swapsAxes: true  },
  mad:  { label: 'Espelho Diagonal /',  short: 'MAD',  arrow: '⤢', swapsAxes: true  }
};

const SYMMETRY_MODES = {
  mandala_d4: {
    id: 'mandala_d4',
    name: 'Mandala (D4)',
    subtitle: '8 eixos • Rotação 90° + Espelhos',
    description: 'Simetria caleidoscópica de 8 octantes. Os blocos das bordas giram 90° em torno do centro ([1,2,1][2,3,2][1,2,1]).',
    requiresSquareForFull: true
  },
  rotational_c4: {
    id: 'rotational_c4',
    name: 'Rotacional (C4)',
    subtitle: '4 quadrantes • Giro contínuo 90°',
    description: 'Simetria de cata-vento (pinwheel): os 4 quadrantes giram 0°, 90°, 180° e 270° em sentido horário ao redor do centro.',
    requiresSquareForFull: true
  },
  bilateral_d2: {
    id: 'bilateral_d2',
    name: 'Bilateral (XY)',
    subtitle: '4 quadrantes • Espelho X e Y',
    description: 'Espelhamento clássico nos eixos horizontal e vertical nos 4 quadrantes.',
    requiresSquareForFull: false
  }
};

/**
 * Transforms coordinates (row, col) inside a (rows x cols) grid using a D4 transform key.
 */
function transformGridCoords(row, col, rows, cols, transformKey) {
  switch (transformKey) {
    case 'id':   return [row, col];
    case 'r90':  return [col, rows - 1 - row];
    case 'r180': return [rows - 1 - row, cols - 1 - col];
    case 'r270': return [cols - 1 - col, row];
    case 'mx':   return [row, cols - 1 - col];
    case 'my':   return [rows - 1 - row, col];
    case 'md':   return [col, row];
    case 'mad':  return [cols - 1 - col, rows - 1 - row];
    default:     return [row, col];
  }
}

/**
 * Precompute the exact 8x8 Cayley composition table for D4:
 * D4_COMPOSE_TABLE[outer][inner] = outer(inner(p))
 */
const D4_COMPOSE_TABLE = (() => {
  const table = {};
  const N = 4;
  for (const outer of D4_TRANSFORMS) {
    table[outer] = {};
    for (const inner of D4_TRANSFORMS) {
      let matched = 'id';
      for (const candidate of D4_TRANSFORMS) {
        let allEqual = true;
        for (let r = 0; r < N && allEqual; r++) {
          for (let c = 0; c < N && allEqual; c++) {
            const [r1, c1] = transformGridCoords(r, c, N, N, inner);
            const [r2, c2] = transformGridCoords(r1, c1, N, N, outer);
            const [rc, cc] = transformGridCoords(r, c, N, N, candidate);
            if (r2 !== rc || c2 !== cc) {
              allEqual = false;
            }
          }
        }
        if (allEqual) {
          matched = candidate;
          break;
        }
      }
      table[outer][inner] = matched;
    }
  }
  return table;
})();

/**
 * Returns outer(inner(x)) in D4.
 */
function composeD4(outerTransform, innerTransform) {
  const outer = D4_COMPOSE_TABLE[outerTransform] ? outerTransform : 'id';
  const inner = D4_COMPOSE_TABLE[innerTransform] ? innerTransform : 'id';
  return D4_COMPOSE_TABLE[outer][inner];
}

/**
 * Returns the inverse transform g^-1 in D4.
 */
function invertD4(transformKey) {
  for (const candidate of D4_TRANSFORMS) {
    if (composeD4(candidate, transformKey) === 'id') {
      return candidate;
    }
  }
  return 'id';
}

/**
 * Applies a D4 geometric transformation to a p5.js or SimpleSVG context
 * assumed to be centered at the target cell's (0, 0).
 */
function applyD4ToContext(ctx, transformKey) {
  switch (transformKey) {
    case 'r90':
      ctx.rotate(Math.PI / 2);
      break;
    case 'r180':
      ctx.rotate(Math.PI);
      break;
    case 'r270':
      ctx.rotate((3 * Math.PI) / 2);
      break;
    case 'mx':
      ctx.scale(-1, 1);
      break;
    case 'my':
      ctx.scale(1, -1);
      break;
    case 'md':
      // Main diagonal transpose: (x, y) -> (y, x)
      ctx.rotate(Math.PI / 2);
      ctx.scale(1, -1);
      break;
    case 'mad':
      // Anti-diagonal transpose: (x, y) -> (-y, -x)
      ctx.rotate(Math.PI / 2);
      ctx.scale(-1, 1);
      break;
    case 'id':
    default:
      break;
  }
}

/**
 * Returns the list of active transform keys for a given symmetry mode and grid dimensions.
 */
function getAllowedTransformsForSymmetry(symmetryMode, rows, cols) {
  const isSquare = rows === cols;
  switch (symmetryMode) {
    case 'mandala_d4':
      return isSquare ? D4_RESOLUTION_ORDER : D2_RESOLUTION_ORDER;
    case 'rotational_c4':
      return isSquare ? C4_RESOLUTION_ORDER : ['id', 'r180'];
    case 'mirror_x':
      return ['id', 'mx'];
    case 'mirror_y':
      return ['id', 'my'];
    case 'none':
    case 'free':
      return ['id'];
    case 'bilateral_d2':
    default:
      return D2_RESOLUTION_ORDER;
  }
}

/**
 * Given a cell (row, col) in a (rows x cols) grid and a symmetryMode,
 * determines:
 * - sourceRow, sourceCol: the canonical generator cell for its orbit (always inside the Top-Left Quadrant)
 * - transformFromSource: the D4 transform key that maps (sourceRow, sourceCol) -> (row, col)
 * - isSource: whether (row, col) is the canonical source cell itself
 */
function resolveCellSymmetry(row, col, rows, cols, symmetryMode) {
  const transforms = getAllowedTransformsForSymmetry(symmetryMode, rows, cols);
  const candidates = [];
  const halfRows = Math.ceil(rows / 2);
  const halfCols = Math.ceil(cols / 2);

  for (const t of transforms) {
    const inv = invertD4(t);
    const [sr, sc] = transformGridCoords(row, col, rows, cols, inv);
    if (sr >= 0 && sr < rows && sc >= 0 && sc < cols) {
      const inTopLeftQuad = (sr < halfRows && sc < halfCols) ? 0 : 1;
      const inUpperOctant = (symmetryMode === 'mandala_d4' && sr > sc) ? 1 : 0;
      candidates.push({
        sr,
        sc,
        inTopLeftQuad,
        inUpperOctant,
        transformFromSource: t
      });
    }
  }

  if (candidates.length === 0) {
    return {
      sourceRow: row,
      sourceCol: col,
      transformFromSource: 'id',
      isSource: true
    };
  }

  // Prioritize:
  // 1) Inside the Top-Left Quadrant (sr < ceil(rows/2) && sc < ceil(cols/2))
  // 2) For Mandala D4, inside the upper octant (sr <= sc)
  // 3) Topmost row (sr), then leftmost col (sc)
  candidates.sort((a, b) =>
    (a.inTopLeftQuad - b.inTopLeftQuad) ||
    (a.inUpperOctant - b.inUpperOctant) ||
    (a.sr - b.sr) ||
    (a.sc - b.sc)
  );

  const bestSr = candidates[0].sr;
  const bestSc = candidates[0].sc;

  // Find the first transform in resolution order that maps (bestSr, bestSc) -> (row, col)
  let chosenTransform = 'id';
  for (const t of transforms) {
    const [tr, tc] = transformGridCoords(bestSr, bestSc, rows, cols, t);
    if (tr === row && tc === col) {
      chosenTransform = t;
      break;
    }
  }

  return {
    sourceRow: bestSr,
    sourceCol: bestSc,
    transformFromSource: chosenTransform,
    isSource: row === bestSr && col === bestSc
  };
}


/**
 * Calculates the stabilizer subgroup of a cell (row, col) in a (rows x cols) grid
 * under the specified symmetryMode.
 */
function getCellStabilizer(row, col, rows, cols, symmetryMode) {
  const transforms = getAllowedTransformsForSymmetry(symmetryMode, rows, cols);
  return transforms.filter((g) => {
    const [r, c] = transformGridCoords(row, col, rows, cols, g);
    return r === row && c === col;
  });
}

/**
 * Checks whether tileId is invariant under transformation g (g(tileId) === tileId).
 */
function isTileInvariantUnder(tileId, g) {
  const registry = (typeof window !== 'undefined' && window.TileRegistry) ||
    (typeof global !== 'undefined' && global.window && global.window.TileRegistry);
  if (registry && typeof registry.getTransformedTileId === 'function') {
    return registry.getTransformedTileId(tileId, g) === tileId;
  }
  return true;
}

/**
 * Filters allowedTiles to only those tiles invariant under every transform in stabilizer.
 */
function getCompatibleTiles(allowedTiles, stabilizer) {
  if (!Array.isArray(allowedTiles) || allowedTiles.length === 0) return [];
  if (!Array.isArray(stabilizer) || stabilizer.length === 0) return allowedTiles.slice();
  return allowedTiles.filter((tileId) =>
    stabilizer.every((g) => isTileInvariantUnder(tileId, g))
  );
}

// Export to window
window.D4Symmetry = {
  D4_TRANSFORMS,
  D4_METADATA,
  SYMMETRY_MODES,
  transformGridCoords,
  composeD4,
  invertD4,
  applyD4ToContext,
  getAllowedTransformsForSymmetry,
  resolveCellSymmetry,
  getCellStabilizer,
  isTileInvariantUnder,
  getCompatibleTiles
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.D4Symmetry;
}

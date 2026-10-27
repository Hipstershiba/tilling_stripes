// tests/test_library_compiler.js
// Verifies 1:1 backward compatibility of all 85 built-in tiles (0..84) and compilation of custom D4 families (>= 85).

const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

const LibraryCompiler = global.window.LibraryCompiler;
const TileLibrary = global.window.TileLibrary;
const { D4_TRANSFORMS, composeD4 } = global.window.D4Symmetry;

console.log('--- Testing LibraryCompiler & 85 Built-in Regression Contract ---');

const EXPECTED_FAMILIES = [
  { id: 'center-stripe', name: 'Faixa Central', group: 'Fitas & Tubos', tileIds: [0, 1], kind: 'axis2' },
  { id: 'center-tee', name: 'Junção Central (T)', group: 'Fitas & Tubos', tileIds: [2, 3, 4, 5], kind: 'edge4' },
  { id: 'center-cross', name: 'Cruz Central (+)', group: 'Fitas & Tubos', tileIds: [6], kind: 'sym1' },
  { id: 'elbow-ribbon', name: 'Arco de Fita (90°)', group: 'Fitas & Tubos', tileIds: [7, 8, 9, 10], kind: 'corner4' },
  { id: 'truchet-ribbon', name: 'Fita Truchet Dupla', group: 'Fitas & Tubos', tileIds: [11, 12], kind: 'diag2' },
  { id: 'center-elbow', name: 'Cantoneira Central (L)', group: 'Fitas & Tubos', tileIds: [13, 14, 15, 16], kind: 'corner4' },
  { id: 'edge-l-shape', name: 'Cantoneira de Borda (L)', group: 'Fitas & Tubos', tileIds: [17, 18, 19, 20], kind: 'corner4' },
  { id: 'edge-t-shape', name: 'Junção de Borda (T)', group: 'Fitas & Tubos', tileIds: [21, 22, 23, 24], kind: 'edge4' },

  { id: 'stripes', name: 'Listras Paralelas', group: 'Listras & Tramas', tileIds: [25, 26], kind: 'axis2' },
  { id: 'corner-stripes', name: 'Curva de Listras Duplas (90°)', group: 'Listras & Tramas', tileIds: [27, 28, 29, 30], kind: 'corner4' },
  { id: 'diagonal-line', name: 'Linha Diagonal', group: 'Listras & Tramas', tileIds: [31, 32], kind: 'diag2' },
  { id: 'diagonal-hatch', name: 'Listras Diagonais (Hachura)', group: 'Listras & Tramas', tileIds: [33, 34], kind: 'diag2' },
  { id: 'zigzag', name: 'Zigue-Zague', group: 'Listras & Tramas', tileIds: [35, 36], kind: 'axis2' },
  { id: 'mini-grid', name: 'Mini Grade 2×2', group: 'Listras & Tramas', tileIds: [37], kind: 'sym1' },
  { id: 'checkers', name: 'Xadrez (Checkers)', group: 'Listras & Tramas', tileIds: [38, 39], kind: 'diag2' },

  { id: 'half-block', name: 'Meio Bloco Sólido', group: 'Massas Sólidas', tileIds: [40, 41, 42, 43], kind: 'edge4' },
  { id: 'corner-triangle', name: 'Triângulos de Canto', group: 'Massas Sólidas', tileIds: [44, 45, 46, 47], kind: 'corner4' },
  { id: 'side-triangle', name: 'Triângulos Laterais', group: 'Massas Sólidas', tileIds: [48, 49, 50, 51], kind: 'edge4' },
  { id: 'bowtie', name: 'Ampulheta & Laço', group: 'Massas Sólidas', tileIds: [52, 53], kind: 'axis2' },
  { id: 'diamond', name: 'Losango Sólido', group: 'Massas Sólidas', tileIds: [54], kind: 'sym1' },

  { id: 'half-circle', name: 'Meio Bloco & Círculo', group: 'Círculos & Arcos', tileIds: [55, 56, 57, 58], kind: 'edge4' },
  { id: 'edge-semicircle', name: 'Semicírculo de Borda', group: 'Círculos & Arcos', tileIds: [59, 60, 61, 62], kind: 'edge4' },
  { id: 'quarter-arc-mid', name: 'Arco de Quarto (Médio)', group: 'Círculos & Arcos', tileIds: [63, 64, 65, 66], kind: 'corner4' },
  { id: 'quarter-arc-full', name: 'Arco de Quarto (Total)', group: 'Círculos & Arcos', tileIds: [67, 68, 69, 70], kind: 'corner4' },
  { id: 'corner-petal', name: 'Pétala de Canto (Roseta)', group: 'Círculos & Arcos', tileIds: [71, 72, 73, 74], kind: 'corner4' },
  { id: 'corner-waves', name: 'Ondas de Canto', group: 'Círculos & Arcos', tileIds: [75, 76, 77, 78], kind: 'corner4' },

  { id: 'target-circle', name: 'Alvo Circular (Target)', group: 'Focos & Pontos', tileIds: [79], kind: 'sym1' },
  { id: 'target-square', name: 'Alvo Quadrado', group: 'Focos & Pontos', tileIds: [80], kind: 'sym1' },
  { id: 'four-dots', name: 'Quatro Pontos', group: 'Focos & Pontos', tileIds: [81], kind: 'sym1' },
  { id: 'diagonal-dots', name: 'Três Pontos Diagonais', group: 'Focos & Pontos', tileIds: [82, 83], kind: 'diag2' },

  { id: 'empty-tile', name: 'Tile Vazio (Espaço)', group: 'Espaço Negativo', tileIds: [84], kind: 'sym1' }
];

function buildExpectedD4Map() {
  const map = {};
  for (const fam of EXPECTED_FAMILIES) {
    const ids = fam.tileIds;
    if (fam.kind === 'sym1') {
      const [T] = ids;
      map[T] = {};
      for (const g of D4_TRANSFORMS) map[T][g] = T;
    } else if (fam.kind === 'axis2') {
      const [H, V] = ids;
      map[H] = { id: H, r90: V, r180: H, r270: V, mx: H, my: H, md: V, mad: V };
      map[V] = { id: V, r90: H, r180: V, r270: H, mx: V, my: V, md: H, mad: H };
    } else if (fam.kind === 'diag2') {
      const [D1, D2] = ids;
      map[D1] = { id: D1, r90: D2, r180: D1, r270: D2, mx: D2, my: D2, md: D1, mad: D1 };
      map[D2] = { id: D2, r90: D1, r180: D2, r270: D1, mx: D1, my: D1, md: D2, mad: D2 };
    } else if (fam.kind === 'edge4') {
      const [L, R, T, B] = ids;
      const baseFromL = { id: L, r90: T, r180: R, r270: B, mx: R, my: L, md: T, mad: B };
      for (const { tile, fromL } of [{ tile: L, fromL: 'id' }, { tile: T, fromL: 'r90' }, { tile: R, fromL: 'r180' }, { tile: B, fromL: 'r270' }]) {
        map[tile] = {};
        for (const g of D4_TRANSFORMS) map[tile][g] = baseFromL[composeD4(g, fromL)];
      }
    } else if (fam.kind === 'corner4') {
      const [TL, TR, BR, BL] = ids;
      const baseFromTL = { id: TL, r90: TR, r180: BR, r270: BL, mx: TR, my: BL, md: TL, mad: BR };
      for (const { tile, fromTL } of [{ tile: TL, fromTL: 'id' }, { tile: TR, fromTL: 'r90' }, { tile: BR, fromTL: 'r180' }, { tile: BL, fromTL: 'r270' }]) {
        map[tile] = {};
        for (const g of D4_TRANSFORMS) map[tile][g] = baseFromTL[composeD4(g, fromTL)];
      }
    }
  }
  return map;
}

const compiled = LibraryCompiler.compileLibrary();
assert.strictEqual(compiled.TILE_RENDERERS.length, 85, 'Expected 85 built-in renderers');
assert.strictEqual(compiled.TILE_FAMILIES_META.length, 31, 'Expected 31 built-in families');
assert.strictEqual(compiled.TILE_NAMES[84], 'Tile Vazio (Espaço)', 'Expected #84 to be Canonical Empty Tile');

for (let i = 0; i < EXPECTED_FAMILIES.length; i++) {
  const exp = EXPECTED_FAMILIES[i];
  const got = compiled.TILE_FAMILIES_META[i];
  assert.strictEqual(got.id, exp.id, `Family[${i}] id mismatch`);
  assert.strictEqual(got.name, exp.name, `Family[${i}] name mismatch`);
  assert.strictEqual(got.group, exp.group, `Family[${i}] group mismatch`);
  assert.deepStrictEqual(got.tileIds, exp.tileIds, `Family[${i}] tileIds mismatch`);
}

const expectedMap = buildExpectedD4Map();
for (let tid = 0; tid < 85; tid++) {
  for (const g of D4_TRANSFORMS) {
    assert.strictEqual(
      compiled.TILE_D4_MAP[tid][g],
      expectedMap[tid][g],
      `TILE_D4_MAP[${tid}][${g}] mismatch`
    );
  }
}
console.log('✓ All 31 built-in families and 680 (85×8) D4 action entries match legacy catalog 1:1.');

// 2. Test compiling custom families (>= 85) including chiral 8-variant family + Mandala D4 generation
const customDoc = TileLibrary.cloneDefaultLibrary();
customDoc.groups.push({ id: 'grp-custom', name: 'Meus Subtiles', builtIn: false });
customDoc.families.push({
  id: 'custom-chiral-f',
  name: 'Motivo F Quiral',
  groupId: 'grp-custom',
  builtIn: false,
  shapes: [
    { id: 's1', type: 'rect', x: -0.35, y: -0.4, w: 0.16, h: 0.8, fill: true },
    { id: 's2', type: 'rect', x: -0.35, y: -0.4, w: 0.65, h: 0.16, fill: true },
    { id: 's3', type: 'rect', x: -0.35, y: -0.08, w: 0.42, h: 0.14, fill: true }
  ]
});

global.window.TileRegistry.rebuildRegistry(customDoc);
assert.strictEqual(global.window.TileRegistry.TILE_RENDERERS.length, 93, 'Expected 85 + 8 = 93 total tiles');
const chiralMeta = global.window.TileRegistry.getFamilyById('custom-chiral-f');
assert(chiralMeta, 'Expected custom-chiral-f in TileRegistry');
assert.deepStrictEqual(chiralMeta.tileIds, [85, 86, 87, 88, 89, 90, 91, 92]);

// Generate a Mandala D4 mosaic using ONLY the chiral 8-variant family:
// Diagonal stabilizer subtile cells have no invariant variant in asymmetric_8, so Mandala D4 must use #84 Empty Tile!
const mosaic = global.window.MosaicEngine.generateMosaic(
  {
    rows: 3,
    cols: 3,
    subdivision: 2, // 4x4 subtiles per block -> off-diagonal subtile (0, 1) has trivial stabilizer!
    gridSymmetryMode: 'mandala_d4',
    blockSymmetryMode: 'mandala_d4',
    allowedTiles: chiralMeta.tileIds.slice()
  },
  (arr) => arr[0]
);

// Diagonal cell (0, 0) inside corner block (0, 0) has { id, md } stabilizer -> must breathe with #84 Empty Tile!
assert.strictEqual(
  mosaic.grid[0][0].cells[0][0].tileId,
  84,
  'Mandala D4 diagonal cell must breathe with #84 when chiral 8-variant family has no invariant tile'
);
// Off-diagonal subtile (0, 1) inside off-axis block (0, 1) has trivial stabilizer -> must use one of [85..92]!
assert(
  chiralMeta.tileIds.includes(mosaic.grid[0][1].cells[0][1].tileId),
  'Off-axis cell must use custom chiral tile [85..92]'
);
assert.strictEqual(
  global.window.MosaicEngine.isMosaicD4Invariant(mosaic),
  true,
  'Generated Mandala D4 mosaic with custom 8-variant family must satisfy strict D4 invariance'
);

// Reset registry back to defaults
global.window.TileRegistry.rebuildRegistry();
assert.strictEqual(global.window.TileRegistry.TILE_RENDERERS.length, 85);
console.log('✓ Custom 8-variant family (>= 85) compiles & integrates seamlessly with MosaicEngine Mandala D4.');

console.log('--- ALL LIBRARY COMPILER TESTS PASSED! ---');

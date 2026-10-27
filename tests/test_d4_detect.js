// tests/test_d4_detect.js
// Verifies pure-JS headless D4 stabilizer subgroup classification across all 10 subgroups of D4
// (orbit sizes 1, 2, 4, and 8) and validates Cayley coset action axioms + visual orientation parity.

const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
const VectorRenderer = require(path.join(__dirname, '../core/vector_renderer.js'));
const D4Detect = require(path.join(__dirname, '../core/d4_detect.js'));

const { D4_TRANSFORMS, composeD4, invertD4 } = global.window.D4Symmetry;

console.log('--- Testing D4Detect (All 10 Subgroups of D4) ---');

const subgroupFixtures = [
  {
    expectedOrbit: 'symmetric_1',
    expectedSize: 1,
    shapes: [{ type: 'rect', x: -0.25, y: -0.25, w: 0.5, h: 0.5, fill: true }]
  },
  {
    expectedOrbit: 'axis_2',
    expectedSize: 2,
    shapes: [{ type: 'rect', x: -0.5, y: -1 / 6, w: 1, h: 1 / 3, fill: true }]
  },
  {
    expectedOrbit: 'diag_2',
    expectedSize: 2,
    shapes: [
      { type: 'rect', x: -0.5, y: -0.5, w: 0.5, h: 0.5, fill: true },
      { type: 'rect', x: 0, y: 0, w: 0.5, h: 0.5, fill: true }
    ]
  },
  {
    expectedOrbit: 'rotational_2',
    expectedSize: 2,
    // Chiral C4 pinwheel: 4 blades rotated 90° around (0,0) with no mirror symmetry
    shapes: [
      { type: 'polygon', points: [[0, 0], [0.45, -0.1], [0.2, -0.45]], fill: true },
      { type: 'polygon', points: [[0, 0], [0.1, 0.45], [0.45, 0.2]], fill: true },
      { type: 'polygon', points: [[0, 0], [-0.45, 0.1], [-0.2, 0.45]], fill: true },
      { type: 'polygon', points: [[0, 0], [-0.1, -0.45], [-0.45, -0.2]], fill: true }
    ]
  },
  {
    expectedOrbit: 'edge_lr_4',
    expectedSize: 4,
    shapes: [{ type: 'rect', x: -0.5, y: -0.5, w: 0.4, h: 1, fill: true }]
  },
  {
    expectedOrbit: 'edge_tb_4',
    expectedSize: 4,
    shapes: [{ type: 'rect', x: -0.5, y: -0.5, w: 1, h: 0.4, fill: true }]
  },
  {
    expectedOrbit: 'corner_tl_4',
    expectedSize: 4,
    shapes: [{ type: 'polygon', points: [[-0.5, -0.5], [0.4, -0.5], [-0.5, 0.4]], fill: true }]
  },
  {
    expectedOrbit: 'corner_tr_4',
    expectedSize: 4,
    shapes: [{ type: 'polygon', points: [[0.5, -0.5], [-0.4, -0.5], [0.5, 0.4]], fill: true }]
  },
  {
    expectedOrbit: 'half_turn_4',
    expectedSize: 4,
    // S / Z motif invariant ONLY under { id, r180 }
    shapes: [
      { type: 'rect', x: -0.1, y: -0.4, w: 0.2, h: 0.8, fill: true },
      { type: 'rect', x: -0.1, y: -0.4, w: 0.45, h: 0.2, fill: true },
      { type: 'rect', x: -0.35, y: 0.2, w: 0.45, h: 0.2, fill: true }
    ]
  },
  {
    expectedOrbit: 'asymmetric_8',
    expectedSize: 8,
    // Chiral F-shape: trivial stabilizer { id }, 8 distinct variants!
    shapes: [
      { type: 'rect', x: -0.35, y: -0.4, w: 0.16, h: 0.8, fill: true },
      { type: 'rect', x: -0.35, y: -0.4, w: 0.65, h: 0.16, fill: true },
      { type: 'rect', x: -0.35, y: -0.08, w: 0.42, h: 0.14, fill: true }
    ]
  }
];

for (const fix of subgroupFixtures) {
  const res = D4Detect.detectMasterD4({ shapes: fix.shapes });
  assert.strictEqual(
    res.orbitType,
    fix.expectedOrbit,
    `Expected orbitType "${fix.expectedOrbit}", got "${res.orbitType}" (discrepancies=${JSON.stringify(res.discrepancies)})`
  );
  assert.strictEqual(res.orbitSize, fix.expectedSize, `Expected orbitSize ${fix.expectedSize}, got ${res.orbitSize}`);

  // Verify group action axioms on localD4Map
  const map = res.localD4Map;
  assert.strictEqual(map.length, fix.expectedSize);

  for (let i = 0; i < fix.expectedSize; i++) {
    assert.strictEqual(map[i].id, i, `Identity failed on ${fix.expectedOrbit} variant ${i}`);

    for (const g of D4_TRANSFORMS) {
      const tgt = map[i][g];
      const back = map[tgt][invertD4(g)];
      assert.strictEqual(back, i, `Inverse failed on ${fix.expectedOrbit} variant ${i} under ${g}`);
    }

    for (const g1 of D4_TRANSFORMS) {
      for (const g2 of D4_TRANSFORMS) {
        const step = map[map[i][g2]][g1];
        const direct = map[i][composeD4(g1, g2)];
        assert.strictEqual(step, direct, `Composition failed on ${fix.expectedOrbit} variant ${i} (${g1} o ${g2})`);
      }
    }

    // Verify visual parity: applying g to variant[i]'s shapes matches variant[map[i][g]]'s shapes!
    const repShapesI = fix.shapes.map((s) => VectorRenderer.transformShapeD4(s, res.variantTransforms[i]));
    for (const g of D4_TRANSFORMS) {
      const expectedIdx = map[i][g];
      const transformedShapes = repShapesI.map((s) => VectorRenderer.transformShapeD4(s, g));
      const targetRepShapes = fix.shapes.map((s) => VectorRenderer.transformShapeD4(s, res.variantTransforms[expectedIdx]));

      const r1 = D4Detect.rasterizeMasterSymmetric({ shapes: transformedShapes }, 64);
      const r2 = D4Detect.rasterizeMasterSymmetric({ shapes: targetRepShapes }, 64);
      let diff = 0;
      for (let k = 0; k < r1.buffer.length; k++) diff += Math.abs(r1.buffer[k] - r2.buffer[k]);
      diff /= r1.buffer.length;
      assert(
        diff < 0.005,
        `Visual D4 map mismatch on ${fix.expectedOrbit} variant ${i} under ${g}: diff=${diff}`
      );
    }
  }

  console.log(`✓ Subgroup ${fix.expectedOrbit.padEnd(14)} (${fix.expectedSize} var.) classified & verified algebraically + visually.`);
}

console.log('--- ALL 10 D4 SUBGROUP DETECTION TESTS PASSED! ---');

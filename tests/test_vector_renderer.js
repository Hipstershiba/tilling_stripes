// tests/test_vector_renderer.js
// Tests normalized [-0.5, 0.5] vector primitives, algebraic D4 transformations, SimpleSVG output, and headless mockCtx compatibility.

const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
const VectorRenderer = require(path.join(__dirname, '../core/vector_renderer.js'));
const D4Detect = require(path.join(__dirname, '../core/d4_detect.js'));
const SimpleSVG = require(path.join(__dirname, '../libraries/simple-svg.js'));

const { D4_TRANSFORMS, composeD4 } = global.window.D4Symmetry;

console.log('--- Testing VectorRenderer ---');

// 1. Minimal headless mockCtx compatibility (no push/pop/rotate/bezierVertex)
const minimalMockOps = [];
const minimalCtx = {
  fill: () => {},
  noFill: () => {},
  stroke: () => {},
  noStroke: () => {},
  strokeWeight: () => {},
  rect: (...args) => minimalMockOps.push(['rect', ...args]),
  ellipse: (...args) => minimalMockOps.push(['ellipse', ...args]),
  line: (...args) => minimalMockOps.push(['line', ...args]),
  triangle: (...args) => minimalMockOps.push(['triangle', ...args]),
  arc: (...args) => minimalMockOps.push(['arc', ...args]),
  beginShape: () => minimalMockOps.push(['beginShape']),
  vertex: (x, y) => minimalMockOps.push(['vertex', x, y]),
  endShape: (m) => minimalMockOps.push(['endShape', m])
};

const allPrimitiveShapes = [
  { id: 's1', type: 'rect', x: -0.4, y: -0.2, w: 0.6, h: 0.3, radius: 0.05, rotation: 0.3, fill: true, stroke: false },
  { id: 's2', type: 'ellipse', cx: 0.1, cy: -0.15, rx: 0.2, ry: 0.1, rotation: 0.2, fill: true, stroke: true, strokeWeight: 0.08 },
  { id: 's3', type: 'line', x1: -0.5, y1: -0.25, x2: 0.5, y2: 0.4, fill: false, stroke: true, strokeWeight: 0.1 },
  { id: 's4', type: 'triangle', points: [[-0.4, -0.4], [0.3, -0.2], [-0.1, 0.4]], fill: true, stroke: false },
  { id: 's5', type: 'polygon', cx: 0, cy: 0, rx: 0.35, ry: 0.35, sides: 5, starRatio: 0.45, fill: true, stroke: false },
  { id: 's6', type: 'arc', cx: -0.5, cy: -0.5, rx: 0.66, ry: 0.66, innerRatio: 0.5, start: 0, end: Math.PI / 2, mode: 'pie', fill: true, stroke: false },
  {
    id: 's7',
    type: 'path',
    closed: true,
    fill: true,
    fillRule: 'evenodd',
    stroke: false,
    contours: [
      [
        { x: -0.4, y: -0.4, out: [0.2, 0] },
        { x: 0.4, y: -0.4, in: [-0.2, 0] },
        { x: 0.4, y: 0.4 },
        { x: -0.4, y: 0.4 }
      ],
      [
        { x: -0.15, y: -0.15 },
        { x: -0.15, y: 0.15 },
        { x: 0.15, y: 0.15 },
        { x: 0.15, y: -0.15 }
      ]
    ]
  }
];

VectorRenderer.renderNormalizedShapes(minimalCtx, allPrimitiveShapes, 100, 100, 5, '#ffffff', true);
assert(minimalMockOps.length > 20, 'Minimal headless context should receive fallback draw calls for all 7 primitives');
console.log('✓ All 7 vector primitives execute cleanly on minimal headless contexts.');

// 1B. Canvas 2D drawingContext fillRule propagation
const recordedFills = [];
const mockCanvasCtx = {
  ...minimalCtx,
  drawingContext: {
    fill: (rule) => recordedFills.push(rule)
  },
  endShape: () => {
    mockCanvasCtx.drawingContext.fill();
  }
};
VectorRenderer.renderNormalizedShapes(mockCanvasCtx, [allPrimitiveShapes[6]], 100, 100, 5, '#ffffff', false);
assert.strictEqual(recordedFills[0], 'evenodd', 'Expected Canvas 2D drawingContext.fill to receive evenodd rule');
console.log('✓ Canvas 2D drawingContext propagates fillRule correctly to native fill calls.');

// 2. SimpleSVG rendering with clipPath, Bezier curves, rounded rect, and compound contours
const svg = new SimpleSVG(120, 120);
svg.push();
svg.translate(60, 60);
VectorRenderer.renderNormalizedShapes(
  svg,
  [
    { id: 'r1', type: 'rect', x: -0.6, y: -0.2, w: 1.2, h: 0.4, radius: 0.08, fill: true, stroke: false },
    allPrimitiveShapes[6]
  ],
  100,
  100,
  0,
  '#ff5500',
  true
);
svg.pop();
const svgMarkup = svg.toSVGString();
assert(svgMarkup.includes('<clipPath id="ts_clip_1">'), 'Expected SVG clipPath when clipToTile=true');
assert(svgMarkup.includes('rx="8.000"'), 'Expected rounded rect rx attribute in SVG');
assert(svgMarkup.includes(' C '), 'Expected cubic Bezier C command in SVG path');
assert(svgMarkup.includes('fill-rule="evenodd"'), 'Expected evenodd fill-rule for multi-contour path in SVG');
console.log('✓ SimpleSVG exports clipToTile, rounded rect, cubic Bezier, and compound holes accurately.');

// 3. Algebraic D4 composition law: T(g1, T(g2, shape)) === T(composeD4(g1, g2), shape)
const chiralShapes = [
  { id: 'c1', type: 'rect', x: -0.4, y: -0.45, w: 0.25, h: 0.85, fill: true, stroke: false },
  { id: 'c2', type: 'arc', cx: -0.5, cy: -0.5, rx: 0.7, ry: 0.7, innerRatio: 0.4, start: 0, end: Math.PI / 2, fill: true, stroke: false },
  {
    id: 'c3',
    type: 'path',
    closed: true,
    fill: true,
    stroke: false,
    nodes: [
      { x: -0.35, y: -0.4, out: [0.25, 0.05] },
      { x: 0.3, y: -0.1, in: [0, -0.2], out: [0.1, 0.25] },
      { x: -0.1, y: 0.35 }
    ]
  }
];

for (const g1 of D4_TRANSFORMS) {
  for (const g2 of D4_TRANSFORMS) {
    const g12 = composeD4(g1, g2);
    const sequential = chiralShapes.map((s) => VectorRenderer.transformShapeD4(VectorRenderer.transformShapeD4(s, g2), g1));
    const direct = chiralShapes.map((s) => VectorRenderer.transformShapeD4(s, g12));

    const rSeq = D4Detect.rasterizeMasterSymmetric({ shapes: sequential }, 64);
    const rDir = D4Detect.rasterizeMasterSymmetric({ shapes: direct }, 64);
    let diff = 0;
    for (let i = 0; i < rSeq.buffer.length; i++) {
      diff += Math.abs(rSeq.buffer[i] - rDir.buffer[i]);
    }
    diff /= rSeq.buffer.length;
    assert(
      diff < 1e-6,
      `D4 composition mismatch for (${g1} o ${g2} = ${g12}): L1 discrepancy = ${diff}`
    );
  }
}
console.log('✓ transformShapeD4 satisfies exact D4 group composition across all 64 (g1, g2) pairs (0.000% raster error).');

console.log('--- ALL VECTOR RENDERER TESTS PASSED! ---');

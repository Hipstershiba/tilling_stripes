// tests/test_vector_editor_ops.js
// Comprehensive verification suite for Fase C (Interactive Vector Editor Engine):
// 1. HTML/CSS/Script-order & Info UI contracts for Fase C controls
// 2. Magnetic grid (0, 2, 3, 4, 6, 8, 12, 16) & smart snapping (ports, borders, center, vertices)
// 3. Parametric creation tools & 1/3 Ribbon Presets
// 4. Parametric-to-Bezier conversion (convertShapeToPath) with D4Detect & SimpleSVG parity
// 5. Hit-testing (including annular holes), translate/scale/rotate, cell alignment & distribution
// 6. Direct node & cubic Bezier operations (coupled/broken handles, smooth toggle, De Casteljau split, delete)
// 7. Interactive pointer state machine (select, direct, pen, marquee, read-only guard), Undo/Redo & Clipboard
// 8. End-to-End Acceptance: custom composite family from scratch -> D4 classification -> mandala_d4 mosaic -> SVG export

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

console.log('--- Testing Interactive Vector Editor Operations & End-to-End Flow (Fase C) ---');

// ----------------------------------------------------------------------------
// 1. Static HTML, CSS, Script Order & Sketch Pointer Forwarding Contract
// ----------------------------------------------------------------------------
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(baseDir, 'style.css'), 'utf8');
const sketchSrc = fs.readFileSync(path.join(baseDir, 'sketch.js'), 'utf8');

const faseCIds = [
  'btnVecUndo',
  'btnVecRedo',
  'vecToolsGrid',
  'btnTileSnapToggle',
  'tileGridDivSelect',
  'panel-tile-shape-props',
  'vecSelectionBadge',
  'vecToolContextLabel',
  'vecSnapStatusBadge',
  'vecPropsContainer'
];

for (const id of faseCIds) {
  const matches = html.match(new RegExp(`\\bid=["']${id}["']`, 'g')) || [];
  assert.strictEqual(
    matches.length,
    1,
    `Expected exactly 1 occurrence of #${id} in index.html, found ${matches.length}`
  );
}

const expectedTools = ['select', 'direct', 'pen', 'rect', 'ellipse', 'polygon', 'arc', 'line'];
for (const toolId of expectedTools) {
  assert.ok(
    html.includes(`data-vec-tool="${toolId}"`),
    `#vecToolsGrid must include button [data-vec-tool="${toolId}"]`
  );
}

// Verify #leftToolbarTilesPane never leaks [data-tool]
const leftTilesStart = html.indexOf('id="leftToolbarTilesPane"');
const leftAsideEnd = html.indexOf('</aside>', leftTilesStart);
assert.ok(
  !/data-tool=/.test(html.slice(leftTilesStart, leftAsideEnd)),
  '#leftToolbarTilesPane must NOT contain [data-tool] attributes'
);

// Verify script order: tile_registry.js < vector_editor.js < subtile_studio_ui.js < sketch.js
const idxRegistry = html.indexOf('core/tile_registry.js');
const idxVecEditor = html.indexOf('core/vector_editor.js');
const idxSubtileUI = html.indexOf('core/subtile_studio_ui.js');
const idxSketch = html.indexOf('sketch.js');
assert.ok(
  idxRegistry > -1 && idxVecEditor > idxRegistry && idxSubtileUI > idxVecEditor && idxSketch > idxSubtileUI,
  'Script load order must be tile_registry.js < vector_editor.js < subtile_studio_ui.js < sketch.js'
);

assert.ok(
  css.includes('.vec-props-container') && css.includes('data-vec-tool="pen"'),
  'style.css must define .vec-props-container and vector tool cursor styles'
);

for (const hookName of [
  'handleViewportMouseDown',
  'handleViewportMouseDragged',
  'handleViewportMouseUp',
  'handleViewportDoubleClick',
  'handleViewportMouseMoved'
]) {
  assert.ok(
    sketchSrc.includes(hookName),
    `sketch.js must forward pointer events via SubtileStudioUI.${hookName}`
  );
}
console.log('✓ Static HTML, CSS, script order, and sketch.js pointer hooks verified.');

// ----------------------------------------------------------------------------
// Bootstrap Headless Modules
// ----------------------------------------------------------------------------
global.window = global.window || {};
const memMap = new Map();
global.localStorage = {
  getItem: (k) => (memMap.has(k) ? memMap.get(k) : null),
  setItem: (k, v) => memMap.set(k, String(v)),
  removeItem: (k) => memMap.delete(k),
  clear: () => memMap.clear()
};
global.window.localStorage = global.localStorage;

const SimpleSVG = require(path.join(baseDir, 'libraries', 'simple-svg.js'));
global.window.SimpleSVG = SimpleSVG;
require(path.join(baseDir, 'core', 'd4_symmetry.js'));
const VectorRenderer = require(path.join(baseDir, 'core', 'vector_renderer.js'));
const D4Detect = require(path.join(baseDir, 'core', 'd4_detect.js'));
require(path.join(baseDir, 'core', 'tile_library.js'));
require(path.join(baseDir, 'core', 'library_compiler.js'));
const LibraryStore = require(path.join(baseDir, 'core', 'library_store.js'));
const TileRegistry = require(path.join(baseDir, 'core', 'tile_registry.js'));
const MosaicEngine = require(path.join(baseDir, 'core', 'mosaic_engine.js'));
require(path.join(baseDir, 'ui_info.js'));
const VectorEditor = require(path.join(baseDir, 'core', 'vector_editor.js'));
const SubtileStudioUI = require(path.join(baseDir, 'core', 'subtile_studio_ui.js'));

assert.ok(global.window.InfoUI && global.window.InfoUI.INFO_TOPICS['vector-editor'], 'InfoUI must register vector-editor topic');

function approx(a, b, tol = 1e-4, msg = '') {
  assert.ok(Math.abs(a - b) <= tol, `${msg} Expected ${a} ≈ ${b} (tol=${tol})`);
}

// ----------------------------------------------------------------------------
// 2. Magnetic Grid & Smart Snapping
// ----------------------------------------------------------------------------
assert.deepStrictEqual(VectorEditor.GRID_DIVISIONS, [0, 2, 3, 4, 6, 8, 12, 16]);

const snapOff = VectorEditor.snapPoint(0.161, -0.491, { enabled: false });
assert.strictEqual(snapOff.snappedX, false);
assert.strictEqual(snapOff.snappedY, false);
approx(snapOff.u, 0.161);
approx(snapOff.v, -0.491);

// Snap to 1/6 port (+0.166667) and top border (-0.5)
const snapPort = VectorEditor.snapPoint(0.161, -0.491, { enabled: true, gridDiv: 6, threshold: 0.025 });
assert.strictEqual(snapPort.snappedX, true);
assert.strictEqual(snapPort.snappedY, true);
approx(snapPort.u, 1 / 6, 1e-5, 'u should snap to +1/6');
approx(snapPort.v, -0.5, 1e-5, 'v should snap to -0.5');

// Snap to 1/8 magnetic grid (-0.375) when ports are outside threshold
const snapEighth = VectorEditor.snapPoint(-0.371, 0.121, { enabled: true, gridDiv: 8, snapPorts: false, threshold: 0.02 });
approx(snapEighth.u, -0.375, 1e-5, 'u should snap to -3/8');
approx(snapEighth.v, 0.125, 1e-5, 'v should snap to +1/8');

// Priority 2D snap to existing object anchor point
const refRect = { id: 'r_ref', type: 'rect', x: 0.11, y: 0.22, w: 0.2, h: 0.14, fill: true };
const objSnapPts = VectorEditor.extractObjectSnapPoints([refRect]);
const snapVertex = VectorEditor.snapPoint(0.114, 0.217, {
  enabled: true,
  gridDiv: 0,
  snapPorts: false,
  objectPoints: objSnapPts,
  threshold: 0.02
});
approx(snapVertex.u, 0.11, 1e-5, 'should snap to rect top-left x');
approx(snapVertex.v, 0.22, 1e-5, 'should snap to rect top-left y');
console.log('✓ Magnetic grid (0..16) and smart snapping (ports, borders, object anchors) verified.');

// ----------------------------------------------------------------------------
// 3. Parametric Shape Creation & 1/3 Ribbon Presets
// ----------------------------------------------------------------------------
const sqRect = VectorEditor.createRectFromDrag(-0.4, -0.3, 0.1, -0.05, { shiftKey: true, radius: 0.05 });
assert.strictEqual(sqRect.type, 'rect');
approx(sqRect.w, sqRect.h, 1e-5, 'Shift-drag rect must be square');
approx(sqRect.radius, 0.05, 1e-5);

const centerRect = VectorEditor.createRectFromDrag(0, 0, 0.25, 0.15, { altKey: true });
approx(centerRect.x, -0.25, 1e-5);
approx(centerRect.y, -0.15, 1e-5);
approx(centerRect.w, 0.5, 1e-5);
approx(centerRect.h, 0.3, 1e-5);

const circleShape = VectorEditor.createEllipseFromDrag(0, 0, 0.3, 0.1, { altKey: true, shiftKey: true });
assert.strictEqual(circleShape.type, 'ellipse');
approx(circleShape.cx, 0, 1e-5);
approx(circleShape.rx, circleShape.ry, 1e-5, 'Shift-drag ellipse must be circular');

const starShape = VectorEditor.createPolygonFromDrag(0, 0, 0, -0.35, { sides: 5, starRatio: 0.45, shiftKey: true });
assert.strictEqual(starShape.type, 'polygon');
assert.strictEqual(starShape.sides, 5);
approx(starShape.starRatio, 0.45, 1e-5);
approx(starShape.rx, 0.35, 1e-5);

const diagLine = VectorEditor.createLineFromDrag(-0.3, -0.3, 0.28, 0.21, { shiftKey: true, strokeWeight: 0.12 });
assert.strictEqual(diagLine.type, 'line');
approx(Math.abs(diagLine.x2 - diagLine.x1), Math.abs(diagLine.y2 - diagLine.y1), 1e-4, 'Shift-line snaps to 45°');

const ribbonArc = VectorEditor.createArcFromDrag(-0.5, -0.5, -0.5 + 2 / 3, -0.45, { innerRatio: 0.5, mode: 'pie' });
assert.strictEqual(ribbonArc.type, 'arc');
approx(ribbonArc.innerRatio, 0.5, 1e-5);
approx(ribbonArc.start, 0, 1e-5);
approx(ribbonArc.end, Math.PI / 2, 1e-4);

for (const presetId of ['stripe-h-1-3', 'stripe-v-1-3', 'curve-tl-1-3', 'quarter-pie-tl']) {
  const pShape = VectorEditor.createRibbonPreset(presetId);
  assert.ok(pShape && pShape.id, `Preset ${presetId} must return a valid shape`);
}
console.log('✓ Parametric creation helpers and 1/3 Ribbon presets verified.');

// ----------------------------------------------------------------------------
// 4. Parametric-to-Bezier Path Conversion & D4 / SVG Parity
// ----------------------------------------------------------------------------
const sampleShapes = [
  { id: 's_rect', type: 'rect', x: -0.5, y: -1 / 6, w: 1, h: 1 / 3, fill: true },
  { id: 's_rrect', type: 'rect', x: -0.3, y: -0.2, w: 0.5, h: 0.4, radius: 0.08, rotation: Math.PI / 6, fill: true },
  { id: 's_ell', type: 'ellipse', cx: 0.1, cy: -0.15, rx: 0.25, ry: 0.15, fill: true },
  { id: 's_poly', type: 'polygon', cx: 0, cy: 0, rx: 0.35, ry: 0.35, sides: 6, starRatio: 0.5, fill: true },
  { id: 's_tri', type: 'triangle', points: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]], fill: true },
  { id: 's_line', type: 'line', x1: -0.4, y1: -0.4, x2: 0.4, y2: 0.2, fill: false, stroke: true, strokeWeight: 0.1 },
  VectorEditor.createRibbonPreset('curve-tl-1-3'),
  VectorEditor.createRibbonPreset('quarter-pie-tl')
];

for (const orig of sampleShapes) {
  const pathVer = VectorEditor.convertShapeToPath(orig);
  assert.ok(pathVer && pathVer.type === 'path', `convertShapeToPath failed for ${orig.type}`);
  assert.ok(Array.isArray(pathVer.contours) && pathVer.contours.length >= 1, 'path must contain contours');

  const d4Orig = D4Detect.detectMasterD4({ shapes: [orig], clipToTile: true });
  const d4Conv = D4Detect.detectMasterD4({ shapes: [pathVer], clipToTile: true });
  assert.strictEqual(
    d4Conv.orbitSize,
    d4Orig.orbitSize,
    `Orbit size mismatch after converting ${orig.type} (${orig.id}): ${d4Conv.orbitSize} vs ${d4Orig.orbitSize}`
  );
  assert.strictEqual(
    d4Conv.orbitType,
    d4Orig.orbitType,
    `Orbit type mismatch after converting ${orig.type} (${orig.id}): ${d4Conv.orbitType} vs ${d4Orig.orbitType}`
  );

  // Verify SimpleSVG renders converted path without errors
  const svgCtx = new global.window.SimpleSVG(120, 120);
  svgCtx.push();
  svgCtx.translate(60, 60);
  VectorRenderer.renderNormalizedShapes(svgCtx, [pathVer], 100, 100, 0, '#111111', true);
  svgCtx.pop();
  const svgOut = svgCtx.toSVGString();
  assert.ok(svgOut.includes('<path '), `SimpleSVG output for converted ${orig.type} must emit <path>`);
}
console.log('✓ convertShapeToPath verified across all 6 parametric types with exact D4 & SVG parity.');

// ----------------------------------------------------------------------------
// 5. Hit-Testing (Including Annular Holes), Transforms, Alignment & Distribution
// ----------------------------------------------------------------------------
const elbowShape = VectorEditor.createRibbonPreset('curve-tl-1-3'); // center (-0.5,-0.5), outer R=2/3, inner R=1/3
// Point inside the corner hole (-0.42, -0.42) has r = hypot(0.08, 0.08) ≈ 0.113 < 1/3 -> MUST NOT HIT!
assert.strictEqual(
  VectorEditor.hitTestShape(elbowShape, -0.42, -0.42, 0.02),
  false,
  'Annular arc inner hole must not register hit'
);
// Point on the 1/3 ribbon band (-0.5 + 0.5/sqrt(2), -0.5 + 0.5/sqrt(2)) has r = 0.5 in [1/3, 2/3] -> MUST HIT!
assert.strictEqual(
  VectorEditor.hitTestShape(elbowShape, -0.5 + 0.35, -0.5 + 0.35, 0.02),
  true,
  'Annular arc band must register hit'
);

// Translate, Scale & Rotate
const baseBox = { id: 'b1', type: 'rect', x: -0.2, y: -0.1, w: 0.4, h: 0.2, fill: true };
const movedBox = VectorEditor.translateShape(baseBox, 0.1, 0.25);
approx(movedBox.x, -0.1, 1e-5);
approx(movedBox.y, 0.15, 1e-5);

const oldBounds = VectorEditor.computeShapeBounds(baseBox);
const newBoundsTarget = { minX: -0.4, minY: -0.2, maxX: 0.4, maxY: 0.2 };
const scaledBox = VectorEditor.scaleShapeFromBox(baseBox, oldBounds, newBoundsTarget);
approx(scaledBox.x, -0.4, 1e-5);
approx(scaledBox.w, 0.8, 1e-5);
approx(scaledBox.h, 0.4, 1e-5);

const rotBox = VectorEditor.rotateShapeAround(baseBox, 0, 0, Math.PI / 2);
approx(rotBox.rotation, Math.PI / 2, 1e-5);

// Cell Alignment (left, centerX, right, top, centerY, bottom)
const alignModes = [
  ['left', (b) => approx(b.minX, -0.5, 1e-5)],
  ['centerX', (b) => approx(b.cx, 0, 1e-5)],
  ['right', (b) => approx(b.maxX, 0.5, 1e-5)],
  ['top', (b) => approx(b.minY, -0.5, 1e-5)],
  ['centerY', (b) => approx(b.cy, 0, 1e-5)],
  ['bottom', (b) => approx(b.maxY, 0.5, 1e-5)]
];
for (const [mode, checkFn] of alignModes) {
  const aligned = VectorEditor.alignShapesToCell([movedBox], ['b1'], mode);
  checkFn(VectorEditor.computeShapeBounds(aligned[0]));
}

// Distribute 3 shapes horizontally
const threeRects = [
  { id: 'd1', type: 'rect', x: -0.45, y: -0.1, w: 0.1, h: 0.2, fill: true }, // cx = -0.40
  { id: 'd2', type: 'rect', x: -0.32, y: -0.1, w: 0.1, h: 0.2, fill: true }, // cx = -0.27 (skewed left)
  { id: 'd3', type: 'rect', x: 0.35, y: -0.1, w: 0.1, h: 0.2, fill: true }   // cx = +0.40
];
const distributed = VectorEditor.distributeShapes(threeRects, ['d1', 'd2', 'd3'], 'horizontal');
const bMid = VectorEditor.computeShapeBounds(distributed.find((s) => s.id === 'd2'));
approx(bMid.cx, 0, 1e-5, 'Middle shape center X should be evenly distributed to 0');
console.log('✓ Hit-testing, transforms, cell alignment, and multi-shape distribution verified.');

// ----------------------------------------------------------------------------
// 6. Direct Node & Cubic Bezier Manipulation (De Casteljau, Handles, Delete)
// ----------------------------------------------------------------------------
// Note: Bezier handles in VectorRenderer / VectorEditor are relative [dx, dy] offsets from anchor (x, y)
const cubicOpenPath = {
  id: 'p_bez',
  type: 'path',
  closed: false,
  fill: false,
  stroke: true,
  strokeWeight: 0.08,
  contours: [[
    { x: -0.4, y: 0, out: [0.2, -0.4] },  // absolute c1 = (-0.2, -0.4)
    { x: 0.4, y: 0, in: [-0.2, 0.4] }     // absolute c2 = (+0.2, +0.4)
  ]]
};

function evalCubic(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return [
    mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
    mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1]
  ];
}

const tSplit = 0.37;
const expectedPt = evalCubic([-0.4, 0], [-0.2, -0.4], [0.2, 0.4], [0.4, 0], tSplit);
const splitPath = VectorEditor.subdividePathSegment(cubicOpenPath, 0, 0, tSplit);
assert.strictEqual(splitPath.contours[0].length, 3, 'Subdividing segment must insert 1 anchor node');
const insertedNode = splitPath.contours[0][1];
approx(insertedNode.x, expectedPt[0], 1e-5, 'De Casteljau inserted node X must lie on original cubic');
approx(insertedNode.y, expectedPt[1], 1e-5, 'De Casteljau inserted node Y must lie on original cubic');

// Coupled smooth handle vs Alt-broken cusp handle
const smoothEdited = VectorEditor.setPathHandle(splitPath, 0, 1, 'out', 0.15, 0, { altKey: false });
const smNode = smoothEdited.contours[0][1];
approx(smNode.in[1], 0, 1e-4, 'Smooth opposite handle dy must stay collinear (0)');
assert.ok(smNode.in[0] < 0, 'Smooth opposite handle dx must point opposite (-x) to out handle (+0.15)');

const brokenEdited = VectorEditor.setPathHandle(smoothEdited, 0, 1, 'out', 0, 0.2, { altKey: true });
const brNode = brokenEdited.contours[0][1];
approx(brNode.in[0], smNode.in[0], 1e-5, 'Alt-broken handle drag must leave opposite handle untouched');
approx(brNode.out[1], 0.2, 1e-5, 'Out handle updated independently');

// Toggle smooth <-> corner
const cornerToggled = VectorEditor.togglePathNodeSmooth(smoothEdited, 0, 1);
assert.strictEqual(cornerToggled.contours[0][1].in, undefined, 'Corner toggle must clear in handle');
assert.strictEqual(cornerToggled.contours[0][1].out, undefined, 'Corner toggle must clear out handle');
const reSmoothed = VectorEditor.togglePathNodeSmooth(cornerToggled, 0, 1);
assert.ok(Array.isArray(reSmoothed.contours[0][1].in) && Array.isArray(reSmoothed.contours[0][1].out), 'Second toggle must synthesize smooth handles');

// Move node shifts anchor while preserving relative handle offsets (so absolute handle moves by the exact same delta)
const movedNodePath = VectorEditor.movePathNodes(
  reSmoothed,
  [{ contourIdx: 0, nodeIdx: 1 }],
  0.05,
  -0.08
);
approx(movedNodePath.contours[0][1].x, reSmoothed.contours[0][1].x + 0.05, 1e-5);
approx(movedNodePath.contours[0][1].y, reSmoothed.contours[0][1].y - 0.08, 1e-5);
approx(
  movedNodePath.contours[0][1].y + movedNodePath.contours[0][1].out[1],
  (reSmoothed.contours[0][1].y + reSmoothed.contours[0][1].out[1]) - 0.08,
  1e-5
);

// Delete middle node returns 2-node open path; deleting another returns null (below minimum 2 nodes)
const afterOneDel = VectorEditor.deletePathNodes(movedNodePath, [{ contourIdx: 0, nodeIdx: 1 }]);
assert.strictEqual(afterOneDel.contours[0].length, 2);
const afterTwoDel = VectorEditor.deletePathNodes(afterOneDel, [{ contourIdx: 0, nodeIdx: 0 }]);
assert.strictEqual(afterTwoDel, null, 'Open path with < 2 nodes must clean up to null');
console.log('✓ Direct node editing, coupled/broken Bezier tangents, and De Casteljau subdivision verified.');

// ----------------------------------------------------------------------------
// 7. Interactive State Machine, Per-Family Undo/Redo & Clipboard
// ----------------------------------------------------------------------------
// Shift-click must select the second object even when it lies on the first object's resize handle.
const multiDoc = { id: 'multi-selection-regression', shapes: [
  { id: 'first', type: 'rect', x: -0.3, y: -0.3, w: 0.3, h: 0.3, fill: true },
  { id: 'second', type: 'rect', x: -0.02, y: -0.02, w: 0.2, h: 0.2, fill: true },
  { id: 'third', type: 'rect', x: 0.3, y: 0.3, w: 0.1, h: 0.1, fill: true },
  { id: 'locked', type: 'rect', x: 0.3, y: 0.3, w: 0.1, h: 0.1, fill: true, locked: true }
] };
VectorEditor.state.activeTool = 'select';
VectorEditor.state.selectedShapeIds = ['first'];
VectorEditor.onPointerDown(0, 0, { shiftKey: true }, multiDoc, 0.028);
assert.deepStrictEqual(VectorEditor.state.selectedShapeIds, ['first', 'second']);
assert.strictEqual(VectorEditor.state.dragOp.type, 'move-selection', 'Shift-click must not start a resize');
assert.strictEqual(VectorEditor.onPointerUp(multiDoc).commitShapes, null, 'Selection must not mutate geometry');
VectorEditor.onPointerDown(0, 0, { shiftKey: true }, multiDoc, 0.028);
VectorEditor.onPointerUp(multiDoc);
assert.deepStrictEqual(VectorEditor.state.selectedShapeIds, ['first'], 'Shift-click removes an already selected object');
VectorEditor.onPointerDown(0.25, 0.25, { shiftKey: true }, multiDoc, 0.028);
VectorEditor.onPointerMove(0.45, 0.45, { shiftKey: true }, multiDoc, 0.028);
VectorEditor.onPointerUp(multiDoc);
assert.deepStrictEqual(VectorEditor.state.selectedShapeIds, ['first', 'third'], 'Shift-marquee must add objects and skip locked ones');
VectorEditor.onPointerDown(0.24, 0.24, {}, multiDoc, 0.028);
VectorEditor.onPointerMove(0.46, 0.46, {}, multiDoc, 0.028);
VectorEditor.onPointerUp(multiDoc);
assert.deepStrictEqual(VectorEditor.state.selectedShapeIds, ['third'], 'Ordinary marquee replaces the selection');

// Read-only guard on built-in family
VectorEditor.state.activeTool = 'rect';
const roRes = VectorEditor.onPointerDown(-0.2, -0.2, {}, { id: 'builtin-test', builtIn: true, shapes: [] }, 0.025);
assert.strictEqual(roRes.readOnlyBlocked, true, 'Built-in families must block destructive pointer operations');

// Interactive creation + direct node drag + Pen closed Bezier path on custom family doc
let liveDoc = { id: 'fam-interactive', builtIn: false, clipToTile: true, shapes: [] };
VectorEditor.ensureFamilyHistory(liveDoc.id, liveDoc);
assert.strictEqual(VectorEditor.canUndo(liveDoc.id, liveDoc), false);

// Draw a rectangle interactively
VectorEditor.state.snapEnabled = false;
VectorEditor.state.activeTool = 'rect';
VectorEditor.onPointerDown(-0.3, -0.2, {}, liveDoc, 0.025);
VectorEditor.onPointerMove(0.2, 0.25, {}, liveDoc, 0.025);
const upRect = VectorEditor.onPointerUp(liveDoc);
assert.ok(Array.isArray(upRect.commitShapes) && upRect.commitShapes.length === 1);
liveDoc.shapes = upRect.commitShapes;
VectorEditor.recordFamilySnapshot(liveDoc.id, liveDoc.shapes, liveDoc.clipToTile);
assert.strictEqual(VectorEditor.canUndo(liveDoc.id, liveDoc), true);

// Double-click the rectangle in 'select' mode -> switches to 'direct'
VectorEditor.state.activeTool = 'select';
const dblRes = VectorEditor.onDoubleClick(0, 0, liveDoc, 0.025);
assert.strictEqual(dblRes.switchedTool, 'direct');
assert.strictEqual(VectorEditor.state.activeTool, 'direct');

// Drag top-left corner (-0.3, -0.2) in 'direct' mode -> auto-converts rect to path and moves corner!
VectorEditor.onPointerDown(-0.3, -0.2, {}, liveDoc, 0.03);
VectorEditor.onPointerMove(-0.4, -0.35, {}, liveDoc, 0.03);
const upDirect = VectorEditor.onPointerUp(liveDoc);
assert.ok(upDirect.commitShapes && upDirect.commitShapes[0].type === 'path', 'Direct node drag must auto-convert rect to path');
liveDoc.shapes = upDirect.commitShapes;
VectorEditor.recordFamilySnapshot(liveDoc.id, liveDoc.shapes, liveDoc.clipToTile);

// Draw a closed triangle with Pen tool (3 clicks + click on first anchor to close)
VectorEditor.state.activeTool = 'pen';
VectorEditor.onPointerDown(-0.4, 0.4, {}, liveDoc, 0.03);
VectorEditor.onPointerUp(liveDoc);
VectorEditor.onPointerDown(0.4, 0.4, {}, liveDoc, 0.03);
VectorEditor.onPointerMove(0.45, 0.35, {}, liveDoc, 0.03); // pull smooth Bezier handle!
VectorEditor.onPointerUp(liveDoc);
VectorEditor.onPointerDown(0, -0.1, {}, liveDoc, 0.03);
VectorEditor.onPointerUp(liveDoc);
const penCloseRes = VectorEditor.onPointerDown(-0.4, 0.4, {}, liveDoc, 0.03); // click first node -> closes!
assert.ok(penCloseRes.commitShapes && penCloseRes.commitShapes.length === 2, 'Closing Pen path must commit 2nd shape');
assert.strictEqual(penCloseRes.commitShapes[1].closed, true);
liveDoc.shapes = penCloseRes.commitShapes;
VectorEditor.recordFamilySnapshot(liveDoc.id, liveDoc.shapes, liveDoc.clipToTile);

// Undo twice -> back to 1 parametric rect; Redo once -> converted path!
const undo1 = VectorEditor.stepUndo(liveDoc.id, liveDoc);
assert.strictEqual(undo1.shapes.length, 1);
assert.strictEqual(undo1.shapes[0].type, 'path');
liveDoc.shapes = undo1.shapes;

const undo2 = VectorEditor.stepUndo(liveDoc.id, liveDoc);
assert.strictEqual(undo2.shapes.length, 1);
assert.strictEqual(undo2.shapes[0].type, 'rect');
liveDoc.shapes = undo2.shapes;

const redo1 = VectorEditor.stepRedo(liveDoc.id, liveDoc);
assert.strictEqual(redo1.shapes[0].type, 'path');
liveDoc.shapes = redo1.shapes;

// Copy / Paste / Duplicate
const copied = VectorEditor.copySelectedShapes(liveDoc.shapes, [liveDoc.shapes[0].id]);
assert.strictEqual(copied.length, 1);
const pasted = VectorEditor.pasteFromClipboard(liveDoc.shapes);
assert.strictEqual(pasted.shapes.length, 2);
assert.notStrictEqual(pasted.newIds[0], liveDoc.shapes[0].id);
const duped = VectorEditor.duplicateSelectedShapes(pasted.shapes, pasted.newIds);
assert.strictEqual(duped.shapes.length, 3);
console.log('✓ Interactive pointer state machine, Pen Bezier closure, per-family Undo/Redo, and Clipboard verified.');

// ----------------------------------------------------------------------------
// 8. End-to-End Fase C Acceptance Test:
//    Custom Family from Scratch -> D4 Classification -> Mandala D4 Mosaic -> SVG Export
// ----------------------------------------------------------------------------
LibraryStore.resetToDefaults();
const createdRes = LibraryStore.createFamily({
  name: 'Curva Truchet Composta',
  groupId: 'grp-curves',
  shapes: []
});
assert.ok(createdRes && createdRes.family, 'LibraryStore.createFamily must create custom family');
const customFamId = createdRes.family.id;

// Build a composite diagonal-symmetric subtile using VectorEditor:
// 1/3 curved ribbon in top-left corner + circular accent on the main diagonal (-0.15, -0.15)
const curveRibbon = VectorEditor.createRibbonPreset('curve-tl-1-3');
const diagDot = VectorEditor.createEllipseFromDrag(-0.15, -0.15, -0.07, -0.07, { altKey: true, shiftKey: true });
const updatedRes = LibraryStore.updateFamily(customFamId, {
  clipToTile: true,
  shapes: [curveRibbon, diagDot]
});
assert.ok(updatedRes && updatedRes.family);

const compiledMeta = TileRegistry.getFamilyById(customFamId);
assert.ok(compiledMeta, 'Compiled custom family must appear immediately in TileRegistry');
assert.strictEqual(
  compiledMeta.tileIds.length,
  4,
  `Diagonal-symmetric curved ribbon + diagonal dot must yield exactly 4 D4 variants, got ${compiledMeta.tileIds.length}`
);
assert.strictEqual(compiledMeta.isDiagInvariant, true, 'Composite corner ribbon on main diagonal must be md/mad invariant');

// Generate a strict 2x2 Mandala D4 mosaic (subdivision 3) using ONLY the new custom family + Empty #84
const allowedCustom = [...compiledMeta.tileIds];
let rngState = 42;
const deterministicRng = (arr) => {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return arr[rngState % arr.length];
};

const mosaic = MosaicEngine.generateMosaic(
  {
    rows: 2,
    cols: 2,
    subdivision: 3,
    gridSymmetryMode: 'mandala_d4',
    blockSymmetryMode: 'mandala_d4',
    syncBlockSymmetry: true,
    allowedTiles: allowedCustom
  },
  deterministicRng
);
assert.ok(mosaic && mosaic.grid.length === 2, 'MosaicEngine must generate 2x2 Mandala D4 mosaic with custom family');

// Verify every cell in the generated Mandala D4 mosaic uses either our custom variants or canonical #84
let customCellCount = 0;
for (let r = 0; r < mosaic.rows; r++) {
  for (let c = 0; c < mosaic.cols; c++) {
    const cells = mosaic.grid[r][c].cells;
    for (let sr = 0; sr < mosaic.subtilesPerSide; sr++) {
      for (let sc = 0; sc < mosaic.subtilesPerSide; sc++) {
        const tid = cells[sr][sc].tileId;
        assert.ok(
          allowedCustom.includes(tid) || tid === 84,
          `Unexpected tileId #${tid} in custom Mandala D4 mosaic`
        );
        if (allowedCustom.includes(tid)) customCellCount++;
      }
    }
  }
}
assert.ok(customCellCount > 0, 'Generated mosaic must place custom family variants in compatible orbits');

assert.strictEqual(
  MosaicEngine.isMosaicD4Invariant(mosaic),
  true,
  'Generated Mandala D4 mosaic with custom family must satisfy strict D4 invariance'
);

// Render the full mosaic to SimpleSVG and verify clean vector <svg> output
const svgMosaic = new global.window.SimpleSVG(600, 600);
MosaicEngine.renderMosaicToContext(svgMosaic, mosaic, {
  width: 600,
  height: 600,
  margin: 24,
  paddingRatio: 0.04,
  fgColor: '#111827',
  bgColor: '#f8fafc'
});
const finalSvg = svgMosaic.toSVGString();
assert.ok(finalSvg.includes('<svg') && finalSvg.includes('</svg>'), 'Mosaic SVG export must produce valid <svg>');
assert.ok(finalSvg.includes('<path ') && finalSvg.includes('<ellipse '), 'Mosaic SVG export must include custom vector primitives');

// Verify SubtileStudioUI.renderViewport also renders the interactive VectorEditor overlay cleanly
SubtileStudioUI.selectFamily(customFamId);
VectorEditor.state.selectedShapeIds = [curveRibbon.id];
VectorEditor.state.activeTool = 'select';
let overlayDrawOps = 0;
const mockP5 = {
  background: () => {},
  push: () => {},
  pop: () => {},
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  fill: () => {},
  noFill: () => {},
  stroke: () => {},
  noStroke: () => {},
  strokeWeight: () => {},
  strokeCap: () => {},
  strokeJoin: () => {},
  rectMode: () => {},
  ellipseMode: () => {},
  rect: () => { overlayDrawOps++; },
  ellipse: () => { overlayDrawOps++; },
  circle: () => { overlayDrawOps++; },
  line: () => { overlayDrawOps++; },
  arc: () => { overlayDrawOps++; },
  beginShape: () => {},
  vertex: () => {},
  bezierVertex: () => {},
  beginContour: () => {},
  endContour: () => {},
  endShape: () => { overlayDrawOps++; },
  drawingContext: {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
    setLineDash: () => {}
  }
};
SubtileStudioUI.renderViewport(mockP5, {
  studioMode: 'tiles',
  width: 640,
  height: 640,
  zoomPercent: 100,
  fgColor: '#1e293b',
  bgColor: '#ffffff',
  paddingRatio: 0.05
});
assert.ok(overlayDrawOps > 10, 'SubtileStudioUI.renderViewport must render master tile, ghost cells, and selection handles');

LibraryStore.resetToDefaults();
console.log('✓ End-to-End Acceptance (custom composite family -> 4 D4 variants -> Mandala D4 mosaic -> SVG export) PASSED!');
console.log('ALL FASE C VECTOR EDITOR TESTS PASSED!\n');

// Body dragging with Direct Selection and lazy Alt-drag duplication.
for (const tool of ['direct', 'select']) {
  const doc = {id: 'body-'+tool, shapes:[{id:'body',type:'rect',x:-.2,y:-.2,w:.4,h:.4,fill:true}]};
  VectorEditor.state.activeTool = tool;
  VectorEditor.state.snapEnabled = false;
  VectorEditor.onPointerDown(0,0,{},doc,.01);
  VectorEditor.onPointerMove(.1,.05,{},doc,.01);
  const moved = VectorEditor.onPointerUp(doc).commitShapes;
  assert.ok(moved, tool+' body drag commits');
  approx(moved[0].x,-.1,1e-5);
  assert.strictEqual(doc.shapes[0].x,-.2, 'document unchanged until commit');
  VectorEditor.onPointerDown(0,0,{altKey:true},doc,.01);
  assert.strictEqual(VectorEditor.onPointerUp(doc).commitShapes,null, 'Alt-click creates no copy');
  VectorEditor.onPointerDown(0,0,{altKey:true},doc,.01);
  VectorEditor.onPointerMove(.1,.05,{altKey:true},doc,.01);
  VectorEditor.onPointerMove(.2,.1,{altKey:true},doc,.01);
  const copies = VectorEditor.onPointerUp(doc).commitShapes;
  assert.strictEqual(copies.length,2,'one duplicate for entire gesture');
  assert.deepStrictEqual(copies[0],doc.shapes[0],'original remains');
  approx(copies[1].x,0,1e-5);
  assert.deepStrictEqual(VectorEditor.state.selectedShapeIds,[copies[1].id]);
}
console.log('Body drag and Alt-drag duplication PASSED');

// Segment curvature: circular quarter, partial sweeps, bounds and reversible interaction.
{
  const ve=VectorEditor;
  const line={id:'curve-line',type:'line',x1:-.3,y1:0,x2:.3,y2:0,strokeWeight:.02};
  const original=JSON.stringify(line);
  const quarter=ve.toggleSegmentCurve(line,0,0);
  assert(quarter.curved && !quarter.limited);
  assert.equal(JSON.stringify(line),original,'pure conversion preserves input');
  const ns=quarter.shape.contours[0];
  assert.deepStrictEqual([ns[0].x,ns[0].y,ns[1].x,ns[1].y],[-.3,0,.3,0]);
  const r=.6/Math.sqrt(2);
  for (const [x,y] of ve.sampleContourPoints(ns,false,100)) {
    assert(Math.abs(Math.hypot(x,y+.3)-r)<r*.00028,'standard cubic approximates a circular quarter');
  }
  for (const f of [.001,1/16,1/8,1/6,1/4]) {
    const arc=ve.toggleSegmentCurve(line,0,0,f);
    approx(arc.fraction,f,1e-9);
    const reversed=ve.toggleSegmentCurve(arc.shape,0,0,0);
    assert(!reversed.curved);
    assert.deepStrictEqual(ve.sampleContourPoints(reversed.shape.contours[0],false,10),[[-.3,0],[.3,0]]);
  }
  assert.deepStrictEqual(ve.toggleSegmentCurve(quarter.shape,0,0).shape,quarter.shape,'reapplying quarter does not flatten the curve');
  assert.deepStrictEqual(ve.toggleSegmentCurve(line,0,0,0).shape,line,'Reta keeps an existing line intact');
  const reduced=ve.toggleSegmentCurve(quarter.shape,0,0,.125);
  approx(reduced.fraction,.125,1e-9);
  assert(reduced.shape.contours[0][0].out[1]<ns[0].out[1],'applying another fraction reshapes an existing curve');
  const collinear=ve.convertShapeToPath(line);
  collinear.contours[0][0].out=[.2,0];collinear.contours[0][1].in=[-.2,0];
  assert(ve.toggleSegmentCurve(collinear,0,0).curved,'collinear Bezier handles still describe a straight segment');
  const mirrored=ve.toggleSegmentCurve(quarter.shape,0,0,.25,1,true);
  assert(mirrored.curved,'reverse keeps a curve instead of flattening it');
  approx(mirrored.shape.contours[0][0].out[1],-ns[0].out[1],1e-9);
  const twice=ve.toggleSegmentCurve(mirrored.shape,0,0,.25,1,true);
  for(const [i,node] of twice.shape.contours[0].entries()) {
    assert.deepStrictEqual([node.x,node.y],[ns[i].x,ns[i].y]);
    for(const which of ['in','out']) if(ns[i][which]) ns[i][which].forEach((x,j)=>approx(node[which][j],x,1e-9));
  }
  const edgeArc=ve.toggleSegmentCurve({...line,y1:-.5,y2:-.5},0,0,.125,1);
  assert.equal(ve.toggleSegmentCurve(edgeArc.shape,0,0,.25,1,true),null,'reversal outside tile is rejected');
  const backwards=ve.toggleSegmentCurve(line,0,0,.25,-1);
  approx(backwards.shape.contours[0][0].out[1],-ns[0].out[1],1e-9);
  const nearEdge={...line,x1:.45,y1:-.4,x2:.49,y2:.4};
  const limited=ve.toggleSegmentCurve(nearEdge,0,0,.25,-1);
  assert(limited.limited && limited.fraction>0 && limited.fraction<.25);
  for(const pt of ve.sampleContourPoints(limited.shape.contours[0],false,1000)) {
    assert(pt.every(v=>v>=-.500000001 && v<=.500000001),'limited curve remains inside tile');
  }
  assert.equal(ve.toggleSegmentCurve({...line,y1:-.5,y2:-.5},0,0,.25,-1),null,'outward edge has no arc space');
  assert(ve.toggleSegmentCurve({...line,y1:-.5,y2:-.5},0,0,.25,1),'opposite side fits');
  assert.equal(ve.toggleSegmentCurve({...line,x2:-.3},0,0),null,'zero-length segment is ignored');
  const closed={id:'closed-curve',type:'path',closed:true,fill:true,contours:[[{x:-.2,y:-.2,out:[.03,0]},{x:.2,y:-.2},{x:.2,y:.2},{x:-.2,y:.2,in:[.02,0]}]]};
  const last=ve.toggleSegmentCurve(closed,0,3);
  assert.deepStrictEqual(last.shape.contours[0][0].out,[.03,0],'next segment tangent is preserved');
  assert.deepStrictEqual(last.shape.contours[0][3].in,[.02,0],'previous segment tangent is preserved');
  assert(last.shape.closed && last.shape.fill,'closing edge conversion preserves topology/style');
  const doc={id:'curve-interaction',builtIn:false,protected:false,shapes:[line]};
  ve.resetTransientForFamilySwitch(doc.id);ve.state.activeTool='curve';ve.state.toolDefaults.curveFraction=.25;
  ve.state.toolDefaults.curveDirection=1;
  assert(!ve.onPointerDown(.4,.4,{},doc,.01).commitShapes,'empty canvas is a no-op');
  const res=ve.onPointerDown(0,0,{},doc,.01);
  assert(res.commitShapes && ve.state.activeTool==='curve');
  ve.recordFamilySnapshot(doc.id,res.commitShapes,false);
  const undo=ve.stepUndo(doc.id,{...doc,shapes:res.commitShapes});
  assert.deepStrictEqual(undo.shapes,[line]);
  assert.deepStrictEqual(ve.stepRedo(doc.id,doc).shapes,res.commitShapes);
  const mid=ve.sampleContourPoints(res.commitShapes[0].contours[0],false,2)[1];
  const reversedByButton=ve.reverseSelectedCurve({...doc,shapes:res.commitShapes});
  assert(reversedByButton.commitShapes,'invert button can reverse the last edited curve');
  approx(reversedByButton.commitShapes[0].contours[0][0].out[1],-ns[0].out[1],1e-9);
  const reversedByShift=ve.onPointerDown(mid[0],mid[1],{shiftKey:true},{...doc,shapes:res.commitShapes},.01);
  assert(reversedByShift.commitShapes[0].contours[0][0].out[1]<0,'Shift-click reverses an existing curve');
  assert(!ve.reverseSelectedCurve({...doc,id:'another-family',shapes:res.commitShapes}).commitShapes);
  assert(ve.onPointerDown(mid[0],mid[1],{}, {...doc,shapes:res.commitShapes},.01).commitShapes,'default click toggles a curve back to straight');
  ve.state.toolDefaults.curveFraction=0;
  const straight=ve.onPointerDown(mid[0],mid[1],{}, {...doc,shapes:res.commitShapes},.01);
  assert(straight.commitShapes && !straight.commitShapes[0].contours[0][0].out,'Reta straightens the clicked curve');
  assert(!ve.onPointerDown(0,0,{}, {...doc,shapes:[{...line,locked:true}]},.01).commitShapes);
  assert(ve.onPointerDown(0,0,{}, {...doc,protected:true},.01).readOnlyBlocked);
}
console.log('Circular segment toggle, limits, neighbours, history and protected shapes PASSED');

// Multi-cubic circular spans stay one tool target across save/transform and cycling.
{
  const ve=VectorEditor;
  for(const [text,value] of [['3/8',.375],['0,3',.3],['7/8',.875],['0',0]]) assert.equal(ve.parseCurveFraction(text),value);
  for(const text of ['1/0','1','2/1','-1/4','','x','1/2/3']) assert.equal(ve.parseCurveFraction(text),null);
  const line={id:'half-arc',type:'line',x1:-.2,y1:0,x2:.2,y2:0,stroke:true,strokeWeight:.01};
  const half=ve.toggleSegmentCurve(line,0,0,.5);
  assert(half && !half.limited);
  assert.equal(half.shape.contours[0].length,3);
  assert(half.shape.contours[0][1].curveJoin);
  for(const [x,y] of ve.sampleContourPoints(half.shape.contours[0],false,100)) assert(Math.abs(Math.hypot(x,y)-.2)<.2*.00028);
  approx(ve.getCurveSpan(half.shape,0,1).fraction,.5,1e-9);
  const loaded=JSON.parse(JSON.stringify(half.shape));
  const reversed=ve.toggleSegmentCurve(loaded,0,1,.5,1,true);
  assert(reversed.shape.contours[0][1].y<0,'either piece reverses the full semicircle');
  const straight=ve.toggleSegmentCurve(loaded,0,1,0);
  assert.equal(straight.shape.contours[0].length,2,'straightening removes only tool-generated inner anchors');
  const custom=ve.toggleSegmentCurve({...line,x1:-.05,x2:.05},0,0,7/8);
  approx(custom.fraction,7/8,1e-9);
  assert.equal(custom.shape.contours[0].length,5);
  const {transformShapeD4}=require('../core/vector_renderer.js');
  const turned=transformShapeD4(custom.shape,'r90');
  assert(turned.contours[0][1].curveJoin,'D4 preserves the span annotation');
  assert.equal(ve.toggleSegmentCurve(turned,0,2,0).shape.contours[0].length,2);
  const compiler=require('../core/library_compiler.js');
  assert(compiler.sanitizeShape(loaded,0).contours[0][1].curveJoin,'library persistence preserves the span annotation');
  const closing={id:'closing-half',type:'path',closed:true,contours:[{x:-.2,y:0},{x:0,y:-.2},{x:.2,y:0}].map(n=>({...n}))};
  closing.contours=[closing.contours];
  const last=ve.toggleSegmentCurve(closing,0,2,.5);
  assert.equal(last.shape.contours[0].length,4);
  assert.equal(ve.toggleSegmentCurve(last.shape,0,3,0).shape.contours[0].length,3,'closing span can be straightened without breaking contour order');
  let doc={id:'cycle-curves',shapes:[line]};
  ve.resetTransientForFamilySwitch(doc.id);ve.state.activeTool='curve';ve.state.toolDefaults.curveCycle=true;
  ve.state.toolDefaults.curveFraction=.25;ve.state.toolDefaults.curveDirection=1;
  for(const expected of [...ve.CURVE_PRESETS.slice(1),0,...ve.CURVE_PRESETS.slice(1),0]) {
    const sh=doc.shapes[0], path=ve.convertShapeToPath(sh), pts=ve.sampleContourPoints(path.contours[0],false,20);
    const point=pts[Math.floor(pts.length/2)], res=ve.onPointerDown(point[0],point[1],{},doc,.01);
    assert(res.commitShapes,'each cycle step changes the target span');
    assert.equal(res.curveCycleFraction,expected);
    doc={...doc,shapes:res.commitShapes};
    assert.equal(doc.shapes[0].contours[0].length,expected>.25?3:2,'cycling does not accumulate auxiliary anchors');
  }
  // Shift must preserve cycle progress, even when a different arc was clicked first.
  const quarter=ve.toggleSegmentCurve(line,0,0,.25);
  const pts=ve.sampleContourPoints(quarter.shape.contours[0],false,20), mid=pts[Math.floor(pts.length/2)];
  ve.state.curveSegment={familyId:'other',shapeId:'other',contourIdx:0,segIdx:0,cycleFraction:.5};
  const shifted=ve.onPointerDown(mid[0],mid[1],{shiftKey:true},{...doc,shapes:[quarter.shape]},.01);
  assert.equal(shifted.curveCycleFraction,undefined,'Shift does not advance cycle');
  const flippedPts=ve.sampleContourPoints(shifted.commitShapes[0].contours[0],false,20), flippedMid=flippedPts[Math.floor(flippedPts.length/2)];
  const next=ve.onPointerDown(flippedMid[0],flippedMid[1],{},{...doc,shapes:shifted.commitShapes},.01);
  assert.equal(next.curveCycleFraction,.5,'cycle continues from the clicked quarter, independent of stale target');
  ve.state.toolDefaults.curveCycle=false;ve.state.toolDefaults.curveFraction=.5;
  let res=ve.onPointerDown(0,0,{},doc,.01);doc={...doc,shapes:res.commitShapes};
  res=ve.onPointerDown(0,.2,{},doc,.01);
  assert.equal(res.commitShapes[0].contours[0].length,2,'default mode toggles the entire semicircle to a line');
}
console.log('Semicircle, free fractions, grouped persistence, D4 and repeated preset cycling PASSED');

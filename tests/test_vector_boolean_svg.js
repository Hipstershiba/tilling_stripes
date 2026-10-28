// tests/test_vector_boolean_svg.js
// Verification suite for Fase D (Paper.js Headless Booleans, D4 Selection Transforms, Layers & SVG I/O):
// 1. HTML/CSS/Script-order & Info UI contracts for Fase D controls
// 2. Pathfinder boolean ops (unite, subtract, intersect, exclude) incl. Bezier curves & open stroked lines
// 3. Quick D4 transforms on selection (r90, r270, mx, my) with group closure
// 4. Layer stack operations (Z-order, visibility, lock, rename)
// 5. SVG import (path/rect/circle/ellipse/polygon/polyline/line, nested <g transform>, viewBox, defs skipping)
// 6. Unitary SVG export + 1:1 round-trip
// 7. SubtileStudioUI SVG import/export wiring (headless)
// 8. End-to-End Acceptance: boolean subtraction + SVG import -> node edit -> D4 detection -> mandala_d4 mosaic -> SVG

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

console.log('--- Testing Vector Booleans, Layers & SVG I/O (Fase D) ---');

// ----------------------------------------------------------------------------
// 1. Static HTML, CSS & Script Order Contracts
// ----------------------------------------------------------------------------
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(baseDir, 'style.css'), 'utf8');

assert.ok(fs.existsSync(path.join(baseDir, 'libraries', 'paper-core.min.js')), 'libraries/paper-core.min.js must exist locally');
assert.ok(fs.existsSync(path.join(baseDir, 'core', 'vector_boolean.js')), 'core/vector_boolean.js must exist');

const faseDIds = [
  'btnImportSubtileSvg',
  'btnExportSubtileSvg',
  'subtileSvgFileInput',
  'panel-tile-layers',
  'tileLayersCountBadge',
  'btnLayersImportSvg',
  'btnLayersExportSvg',
  'btnLayerBringFront',
  'btnLayerSendBack',
  'tileLayersListContainer'
];
for (const id of faseDIds) {
  const matches = html.match(new RegExp(`\\bid=["']${id}["']`, 'g')) || [];
  assert.strictEqual(matches.length, 1, `Expected exactly 1 occurrence of #${id} in index.html, found ${matches.length}`);
}

const idxPaper = html.indexOf('libraries/paper-core.min.js');
const idxEditor = html.indexOf('src="core/vector_editor.js"');
const idxBool = html.indexOf('src="core/vector_boolean.js"');
const idxStudio = html.indexOf('src="core/subtile_studio_ui.js"');
assert.ok(idxPaper > 0, 'index.html must load libraries/paper-core.min.js');
assert.ok(idxPaper < idxBool, 'paper-core.min.js must load before core/vector_boolean.js');
assert.ok(idxEditor < idxBool && idxBool < idxStudio, 'vector_boolean.js must load between vector_editor.js and subtile_studio_ui.js');

const layersTopicMatch = html.match(/<button[^>]*data-info-topic="vector-layers"[^>]*>/);
assert.ok(layersTopicMatch, 'index.html must contain a [data-info-topic="vector-layers"] trigger');
for (const attr of ['aria-controls="infoPopover"', 'aria-haspopup="dialog"', 'aria-expanded="false"']) {
  assert.ok(layersTopicMatch[0].includes(attr), `vector-layers info trigger must include ${attr}`);
}

// SVG buttons inside #leftToolbarTilesPane must not leak [data-tool]
const leftStart = html.indexOf('id="leftToolbarTilesPane"');
const leftEnd = html.indexOf('id="workspace-viewport"');
const leftPane = html.slice(leftStart, leftEnd > leftStart ? leftEnd : undefined);
const svgBtnMatch = leftPane.match(/<button[^>]*id="btnImportSubtileSvg"[^>]*>/);
assert.ok(svgBtnMatch && !svgBtnMatch[0].includes('data-tool='), '#btnImportSubtileSvg must not declare [data-tool]');

for (const cls of ['.vec-d4-strip', '.vec-bool-strip', '.vec-bool-btn', '.tile-layers-list', '.tile-layer-row', '.tile-layer-icon-btn']) {
  assert.ok(css.includes(cls), `style.css must define ${cls}`);
}
assert.ok(!html.includes('kaleidoscope_permissive'), 'index.html must never reference kaleidoscope_permissive');
console.log('✓ HTML/CSS/script-order & ARIA contracts PASSED!');

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
const VectorBoolean = require(path.join(baseDir, 'core', 'vector_boolean.js'));
const SubtileStudioUI = require(path.join(baseDir, 'core', 'subtile_studio_ui.js'));

assert.ok(global.window.InfoUI && global.window.InfoUI.INFO_TOPICS['vector-layers'], 'InfoUI must register vector-layers topic');
assert.ok(global.window.VectorBoolean === VectorBoolean, 'VectorBoolean must be exposed on window');
assert.strictEqual(typeof global.window.paper, 'undefined', 'Headless Paper.js must not pollute global.window.paper');

const scope = VectorBoolean.getPaperScope();
assert.ok(scope && scope.Path && scope.CompoundPath, 'getPaperScope must return a working headless PaperScope');

function approx(a, b, tol = 1e-3, msg = '') {
  assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b}, got ${a} (tol ${tol})`);
}

function boundsOfPathShape(shape) {
  const pts = [];
  for (const nodes of VectorRenderer.getNormalizedPathContours(shape)) {
    for (const p of VectorEditor.sampleContourPoints(nodes, shape.closed !== false, 24)) pts.push(p);
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function hasCurves(shape) {
  return VectorRenderer.getNormalizedPathContours(shape).some((nodes) =>
    nodes.some((nd) => (Array.isArray(nd.in) && (nd.in[0] || nd.in[1])) || (Array.isArray(nd.out) && (nd.out[0] || nd.out[1])))
  );
}

// ----------------------------------------------------------------------------
// 2. Pathfinder Boolean Operations
// ----------------------------------------------------------------------------
const sqA = { id: 'A', type: 'rect', name: 'A', x: -0.4, y: -0.4, w: 0.5, h: 0.5, fill: true, stroke: false };
const sqB = { id: 'B', type: 'rect', name: 'B', x: -0.1, y: -0.1, w: 0.5, h: 0.5, fill: true, stroke: false };
const bigSq = { id: 'BIG', type: 'rect', name: 'Big', x: -0.4, y: -0.4, w: 0.8, h: 0.8, fill: true, stroke: false };
const hole = { id: 'HOLE', type: 'ellipse', name: 'Hole', cx: 0, cy: 0, rx: 0.2, ry: 0.2, fill: true, stroke: false };
const keep = { id: 'KEEP', type: 'rect', name: 'Keep', x: 0.45, y: 0.45, w: 0.04, h: 0.04, fill: true, stroke: false };

// Invalid inputs
assert.strictEqual(VectorBoolean.applyBooleanOp([sqA, sqB], ['A'], 'unite').ok, false, 'Boolean op with 1 shape must fail');
assert.strictEqual(VectorBoolean.applyBooleanOp([sqA, sqB], ['A', 'B'], 'divide').ok, false, 'Unknown op must fail');
assert.strictEqual(
  VectorBoolean.applyBooleanOp([sqA, { ...sqB, locked: true }], ['A', 'B'], 'unite').ok,
  false,
  'Locked operands must be excluded from boolean ops'
);

// Unite
const uni = VectorBoolean.applyBooleanOp([sqA, sqB, keep], ['A', 'B'], 'unite');
assert.ok(uni.ok && uni.resultIds.length === 1, 'unite must return exactly one result shape');
assert.strictEqual(uni.shapes.length, 2, 'unite must consume both operands and keep non-selected shapes');
assert.ok(uni.shapes.some((s) => s.id === 'KEEP'), 'non-selected shapes must be preserved');
const uniShape = uni.shapes.find((s) => s.id === uni.resultIds[0]);
assert.strictEqual(uniShape.type, 'path');
assert.strictEqual(uniShape.fillRule, 'evenodd');
assert.strictEqual(uniShape.contours.length, 1, 'unite of overlapping squares must yield one contour');
assert.strictEqual(uniShape.contours[0].length, 8, 'L-shaped union outline of two squares must have 8 corners');
const ub = boundsOfPathShape(uniShape);
approx(ub.minX, -0.4, 1e-4, 'unite minX'); approx(ub.maxX, 0.4, 1e-4, 'unite maxX');
assert.ok(VectorEditor.hitTestShape(uniShape, -0.3, -0.3, 0.001), 'unite must contain A interior');
assert.ok(VectorEditor.hitTestShape(uniShape, 0.3, 0.3, 0.001), 'unite must contain B interior');
assert.ok(!VectorEditor.hitTestShape(uniShape, 0.3, -0.3, 0.001), 'unite must not fill outside region');

// Subtract (front from back) -> compound shape with hole
const sub = VectorBoolean.applyBooleanOp([bigSq, hole], ['BIG', 'HOLE'], 'subtract');
assert.ok(sub.ok, 'subtract must succeed');
const subShape = sub.shapes.find((s) => s.id === sub.resultIds[0]);
assert.strictEqual(subShape.contours.length, 2, 'square minus circle must yield outer contour + hole');
assert.ok(hasCurves(subShape), 'subtract must preserve cubic Bezier curves of the circular hole');
assert.ok(!VectorEditor.hitTestShape(subShape, 0, 0, 0.001), 'hit-test inside hole must be false');
assert.ok(VectorEditor.hitTestShape(subShape, 0.33, 0.33, 0.001), 'hit-test in solid ring must be true');
const subD4 = D4Detect.detectMasterD4({ shapes: [subShape], clipToTile: true });
assert.strictEqual(subD4.orbitSize, 1, 'centered square-with-circular-hole must be fully D4 symmetric');
const subSvg = new SimpleSVG(200, 200);
subSvg.translate(100, 100);
VectorRenderer.renderNormalizedShapes(subSvg, [subShape], 200, 200, 0, '#000');
const subSvgStr = subSvg.toSVGString();
assert.ok(subSvgStr.includes('fill-rule="evenodd"'), 'SimpleSVG must emit fill-rule="evenodd" for compound holes');
assert.ok(/ C /.test(subSvgStr) || subSvgStr.includes('C '), 'SimpleSVG must emit cubic C commands for curved hole');

// Intersect
const inter = VectorBoolean.applyBooleanOp([sqA, sqB], ['A', 'B'], 'intersect');
const interShape = inter.shapes.find((s) => s.id === inter.resultIds[0]);
const ib = boundsOfPathShape(interShape);
approx(ib.minX, -0.1, 1e-4, 'intersect minX'); approx(ib.maxX, 0.1, 1e-4, 'intersect maxX');
approx(ib.minY, -0.1, 1e-4, 'intersect minY'); approx(ib.maxY, 0.1, 1e-4, 'intersect maxY');

// Intersect of disjoint shapes -> empty result
const disjoint = VectorBoolean.applyBooleanOp(
  [{ ...sqA, w: 0.1, h: 0.1 }, { ...sqB, x: 0.3, y: 0.3, w: 0.1, h: 0.1 }],
  ['A', 'B'],
  'intersect'
);
assert.ok(disjoint.ok && disjoint.emptyResult && disjoint.shapes.length === 0, 'disjoint intersect must produce empty result');

// Exclude (XOR)
const xor = VectorBoolean.applyBooleanOp([sqA, sqB], ['A', 'B'], 'exclude');
const xorShape = xor.shapes.find((s) => s.id === xor.resultIds[0]);
assert.ok(xorShape, 'exclude must yield a result');
assert.ok(!VectorEditor.hitTestShape(xorShape, 0, 0, 0.001), 'XOR overlap region must be empty');
assert.ok(VectorEditor.hitTestShape(xorShape, -0.3, -0.3, 0.001), 'XOR must keep A-only region');
assert.ok(VectorEditor.hitTestShape(xorShape, 0.3, 0.3, 0.001), 'XOR must keep B-only region');

// Curved operands: unite two circles keeps Bezier handles
const c1 = { id: 'C1', type: 'ellipse', cx: -0.1, cy: 0, rx: 0.2, ry: 0.2, fill: true };
const c2 = { id: 'C2', type: 'ellipse', cx: 0.1, cy: 0, rx: 0.2, ry: 0.2, fill: true };
const cu = VectorBoolean.applyBooleanOp([c1, c2], ['C1', 'C2'], 'unite');
const cuShape = cu.shapes.find((s) => s.id === cu.resultIds[0]);
assert.ok(hasCurves(cuShape), 'unite of circles must preserve cubic Bezier handles');
const cb = boundsOfPathShape(cuShape);
approx(cb.minX, -0.3, 2e-3, 'circle unite minX'); approx(cb.maxX, 0.3, 2e-3, 'circle unite maxX');

// Open stroked line participates via stroke expansion
const stroked = { id: 'LN', type: 'line', x1: -0.5, y1: 0, x2: 0.5, y2: 0, stroke: true, fill: false, strokeWeight: 0.1 };
const lineCut = VectorBoolean.applyBooleanOp([bigSq, stroked], ['BIG', 'LN'], 'subtract');
const lineCutShape = lineCut.shapes.find((s) => s.id === lineCut.resultIds[0]);
assert.ok(lineCutShape && lineCutShape.contours.length === 2, 'square minus horizontal stroked line must split into 2 pieces');
assert.ok(!VectorEditor.hitTestShape(lineCutShape, 0, 0, 0.001), 'stroke channel must be cut out');
assert.ok(VectorEditor.hitTestShape(lineCutShape, 0, -0.3, 0.001), 'upper half must remain filled');
console.log('✓ Pathfinder boolean ops (unite/subtract/intersect/exclude, curves, stroked lines) PASSED!');

// ----------------------------------------------------------------------------
// 3. Quick D4 Selection Transforms
// ----------------------------------------------------------------------------
const asymRect = { id: 'R', type: 'rect', x: 0.1, y: -0.4, w: 0.3, h: 0.1, fill: true };
const asymPath = VectorEditor.convertShapeToPath({ id: 'P', type: 'ellipse', cx: -0.2, cy: 0.15, rx: 0.1, ry: 0.05, fill: true });
const d4Base = [asymRect, asymPath, { ...keep }];
const r90 = VectorBoolean.transformSelectedShapesD4(d4Base, ['R'], 'r90');
const r90Rect = VectorEditor.convertShapeToPath(r90.find((s) => s.id === 'R'));
const rb = boundsOfPathShape(r90Rect);
// Rotate around the off-origin selection center (0.25, -0.35).
approx(rb.minX, 0.2, 1e-4, 'r90 minX'); approx(rb.maxX, 0.3, 1e-4, 'r90 maxX');
approx(rb.minY, -0.5, 1e-4, 'r90 minY'); approx(rb.maxY, -0.2, 1e-4, 'r90 maxY');
assert.deepStrictEqual(r90.find((s) => s.id === 'KEEP'), keep, 'unselected shapes must remain untouched by D4 transforms');

function pathSig(shape) {
  const b = boundsOfPathShape(VectorEditor.convertShapeToPath(shape));
  return [b.minX, b.minY, b.maxX, b.maxY].map((n) => Math.round(n * 1e4) / 1e4).join(',');
}
let cur = d4Base;
for (let i = 0; i < 4; i++) cur = VectorBoolean.transformSelectedShapesD4(cur, ['R', 'P'], 'r90');
assert.strictEqual(pathSig(cur[0]), pathSig(asymRect), '4x r90 must return rect to identity');
assert.strictEqual(pathSig(cur[1]), pathSig(asymPath), '4x r90 must return path to identity');
const r90r270 = VectorBoolean.transformSelectedShapesD4(VectorBoolean.transformSelectedShapesD4(d4Base, ['R', 'P'], 'r90'), ['R', 'P'], 'r270');
assert.strictEqual(pathSig(r90r270[0]), pathSig(asymRect), 'r90 followed by r270 must be identity');
for (const k of ['mx', 'my']) {
  const once = VectorBoolean.transformSelectedShapesD4(d4Base, ['R', 'P'], k);
  assert.notStrictEqual(pathSig(once[0]), pathSig(asymRect), `${k} must move an asymmetric rect`);
  const twice = VectorBoolean.transformSelectedShapesD4(once, ['R', 'P'], k);
  assert.strictEqual(pathSig(twice[0]), pathSig(asymRect), `2x ${k} must be identity (rect)`);
  assert.strictEqual(pathSig(twice[1]), pathSig(asymPath), `2x ${k} must be identity (path)`);
}
const mxRect = boundsOfPathShape(VectorEditor.convertShapeToPath(VectorBoolean.transformSelectedShapesD4(d4Base, ['R'], 'mx')[0]));
approx(mxRect.minX, 0.1, 1e-4, 'mx minX'); approx(mxRect.maxX, 0.4, 1e-4, 'mx maxX');
const lockedT = VectorBoolean.transformSelectedShapesD4([{ ...asymRect, locked: true }], ['R'], 'r90');
assert.strictEqual(lockedT[0].x, asymRect.x, 'locked shapes must be ignored by D4 transforms');
console.log('✓ Quick D4 selection transforms (r90, r270, mx, my + closure) PASSED!');

// ----------------------------------------------------------------------------
// 4. Layer Stack Operations
// ----------------------------------------------------------------------------
const L = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
const ids = (arr) => arr.map((s) => s.id).join('');
assert.strictEqual(ids(VectorBoolean.reorderShapeZ(L, 'a', 'front')), 'bcda');
assert.strictEqual(ids(VectorBoolean.reorderShapeZ(L, 'd', 'back')), 'dabc');
assert.strictEqual(ids(VectorBoolean.reorderShapeZ(L, 'b', 'forward')), 'acbd');
assert.strictEqual(ids(VectorBoolean.reorderShapeZ(L, 'c', 'backward')), 'acbd');
assert.strictEqual(ids(VectorBoolean.reorderShapeZ(L, 'a', 2)), 'bcad');
assert.strictEqual(ids(VectorBoolean.reorderShapeZ(L, 'd', 'forward')), 'abcd', 'topmost forward is a no-op');
assert.strictEqual(ids(VectorBoolean.reorderShapeZ(L, 'zz', 'front')), 'abcd', 'unknown id is a no-op');
assert.strictEqual(ids(L), 'abcd', 'reorderShapeZ must be pure');

const visShapes = [sqA, sqB];
const hidden = VectorBoolean.toggleShapeVisible(visShapes, 'B');
assert.strictEqual(hidden[1].visible, false);
assert.strictEqual(VectorBoolean.toggleShapeVisible(hidden, 'B')[1].visible, true);
assert.strictEqual(VectorBoolean.setShapeVisible(visShapes, 'A', false)[0].visible, false);
const hiddenSvg = VectorBoolean.exportFamilyToSVG({ shapes: hidden }, { size: 100 });
assert.strictEqual((hiddenSvg.match(/<rect /g) || []).length, 1, 'hidden shapes must not be exported to SVG');
assert.strictEqual(VectorBoolean.applyBooleanOp(hidden, ['A', 'B'], 'unite').ok, false, 'hidden shapes must not participate in booleans');

const lockedArr = VectorBoolean.toggleShapeLocked(visShapes, 'A');
assert.strictEqual(lockedArr[0].locked, true);
assert.strictEqual(VectorBoolean.toggleShapeLocked(lockedArr, 'A')[0].locked, false);
assert.strictEqual(VectorBoolean.setShapeLocked(visShapes, 'B', true)[1].locked, true);
assert.strictEqual(VectorEditor.hitTestShape(lockedArr[0], -0.3, -0.3), false, 'locked shapes must not be hit-testable');

assert.strictEqual(VectorBoolean.renameShape(visShapes, 'A', '  Base  ')[0].name, 'Base');
assert.strictEqual(VectorBoolean.renameShape(visShapes, 'A', '   ')[0].name, 'A', 'blank rename must be ignored');
console.log('✓ Layer stack operations (Z-order, visibility, lock, rename) PASSED!');

// ----------------------------------------------------------------------------
// 5. SVG Import
// ----------------------------------------------------------------------------
assert.strictEqual(VectorBoolean.importSVGToShapes('').ok, false, 'empty SVG must fail');
assert.strictEqual(VectorBoolean.importSVGToShapes('<svg viewBox="0 0 10 10"></svg>').ok, false, 'SVG without geometry must fail');

const complexSvg = `<?xml version="1.0"?>
<!-- comment -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs><clipPath id="c"><rect x="0" y="0" width="100" height="100"/></clipPath></defs>
  <rect id="bgRect" x="0" y="0" width="50" height="50" fill="#000"/>
  <circle cx="75" cy="25" r="10"/>
  <ellipse cx="25" cy="75" rx="15" ry="5" style="fill:#222"/>
  <polygon points="60,60 90,60 75,90"/>
  <polyline points="10,95 30,95 30,80" fill="none" stroke="#000" stroke-width="2"/>
  <line x1="0" y1="100" x2="100" y2="100" stroke="#000" stroke-width="4"/>
  <path d="M 50 50 C 60 40, 70 60, 80 50 A 10 10 0 0 1 50 50 Z"/>
  <g transform="translate(50 50)"><g transform="rotate(45)"><rect x="-5" y="-5" width="10" height="10"/></g></g>
  <rect x="0" y="0" width="5" height="5" display="none"/>
</svg>`;
const imp = VectorBoolean.importSVGToShapes(complexSvg);
assert.ok(imp.ok, `complex SVG import must succeed: ${imp.error}`);
assert.deepStrictEqual(imp.viewBox, [0, 0, 100, 100]);
assert.strictEqual(imp.shapes.length, 8, `expected 8 imported shapes (defs/hidden skipped), got ${imp.shapes.length}`);
const byType = (t) => imp.shapes.filter((s) => s.type === t);
assert.strictEqual(byType('rect').length, 1, 'axis-aligned <rect> must import as editable rect');
assert.strictEqual(byType('ellipse').length, 2, '<circle> and <ellipse> must import as ellipses');
assert.strictEqual(byType('line').length, 1, '<line> must import as line');
assert.strictEqual(byType('path').length, 4, 'polygon, polyline, path and rotated rect must import as paths');

const r0 = byType('rect')[0];
assert.strictEqual(r0.name, 'bgRect', 'SVG id must become shape name');
approx(r0.x, -0.5, 1e-6, 'rect x'); approx(r0.y, -0.5, 1e-6, 'rect y');
approx(r0.w, 0.5, 1e-6, 'rect w'); approx(r0.h, 0.5, 1e-6, 'rect h');
const circ = byType('ellipse').find((s) => Math.abs(s.rx - s.ry) < 1e-9);
approx(circ.cx, 0.25, 1e-6, 'circle cx'); approx(circ.cy, -0.25, 1e-6, 'circle cy'); approx(circ.rx, 0.1, 1e-6, 'circle r');
const ln = byType('line')[0];
approx(ln.y1, 0.5, 1e-6, 'line y1'); approx(ln.strokeWeight, 0.04, 1e-6, 'line stroke weight normalized');
const polyline = imp.shapes.find((s) => s.type === 'path' && s.closed === false);
assert.ok(polyline && polyline.stroke && !polyline.fill, 'open polyline must import as open stroked path');
const curvedPath = imp.shapes.find((s) => s.type === 'path' && hasCurves(s) && s.closed);
assert.ok(curvedPath, '<path> with C and A commands must import with Bezier handles');
const rotated = imp.shapes.filter((s) => s.type === 'path' && s.closed && !hasCurves(s) && s.contours[0].length === 4);
const diamond = rotated.find((s) => {
  const b = boundsOfPathShape(s);
  return Math.abs(b.minX + 0.0707) < 1e-3 && Math.abs(b.maxX - 0.0707) < 1e-3;
});
assert.ok(diamond, 'nested <g translate(...)><g rotate(45)> must produce a centered diamond of half-diagonal ~0.0707');
for (const s of imp.shapes) {
  const b = boundsOfPathShape(VectorEditor.convertShapeToPath(s));
  assert.ok(b.minX >= -0.5 - 1e-6 && b.maxX <= 0.5 + 1e-6 && b.minY >= -0.5 - 1e-6 && b.maxY <= 0.5 + 1e-6,
    `imported shape ${s.name} must be normalized into [-0.5, 0.5]`);
}

// Compound path with hole (evenodd) + no viewBox (content-fit)
const holeSvg = `<svg xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 10 H 210 V 210 H 10 Z M 60 60 H 160 V 160 H 60 Z"/></svg>`;
const holeImp = VectorBoolean.importSVGToShapes(holeSvg);
assert.ok(holeImp.ok);
const holeShape = holeImp.shapes[0];
assert.strictEqual(holeShape.contours.length, 2, 'compound <path> must import as 2 contours');
assert.strictEqual(holeShape.fillRule, 'evenodd');
const hb = boundsOfPathShape(holeShape);
approx(hb.minX, -0.5, 1e-6, 'content-fit minX'); approx(hb.maxX, 0.5, 1e-6, 'content-fit maxX');
assert.ok(!VectorEditor.hitTestShape(holeShape, 0, 0, 0.001), 'imported hole must be empty');
assert.ok(VectorEditor.hitTestShape(holeShape, 0.4, 0.4, 0.001), 'imported ring must be filled');

// Transform parser
const m = VectorBoolean.parseTransformAttr('translate(10,20) scale(2)');
assert.deepStrictEqual(m, [2, 0, 0, 2, 10, 20]);
const fitImp = VectorBoolean.importSVGToShapes('<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>', { fitMargin: 0.1 });
approx(fitImp.shapes[0].w, 0.8, 1e-6, 'fitMargin=0.1 must scale content to 0.8');
console.log('✓ SVG import (primitives, nested transforms, viewBox, compound holes, defs skipping) PASSED!');

// ----------------------------------------------------------------------------
// 6. Unitary SVG Export + Round-Trip
// ----------------------------------------------------------------------------
const famForExport = { name: 'RoundTrip', clipToTile: false, shapes: [subShape, { ...keep }] };
const exported = VectorBoolean.exportFamilyToSVG(famForExport, { size: 1000, fgColor: '#123456', includeBackground: true, bgColor: '#ffffff' });
assert.ok(exported.startsWith('<svg') || exported.includes('<svg'), 'export must produce <svg>');
assert.ok(exported.includes('viewBox') || exported.includes('width="1000"'), 'export must declare 1000-unit artboard');
assert.ok(exported.includes('fill-rule="evenodd"'), 'export must keep evenodd holes');
assert.ok(exported.includes('data-tiling-role="bg"'), 'background rect must be tagged for round-trip skipping');
const rt = VectorBoolean.importSVGToShapes(exported);
assert.ok(rt.ok, 'exported SVG must re-import');
assert.strictEqual(rt.shapes.length, 2, 'round-trip must skip background and keep both shapes');
const rtHole = rt.shapes.find((s) => s.type === 'path');
assert.strictEqual(rtHole.contours.length, 2, 'round-trip must preserve compound hole');
assert.ok(hasCurves(rtHole), 'round-trip must preserve Bezier curves');
const ob = boundsOfPathShape(subShape);
const nb = boundsOfPathShape(rtHole);
approx(nb.minX, ob.minX, 2e-3, 'round-trip minX'); approx(nb.maxX, ob.maxX, 2e-3, 'round-trip maxX');
assert.ok(!VectorEditor.hitTestShape(rtHole, 0, 0, 0.001), 'round-trip hole must remain empty');
const rtD4 = D4Detect.detectMasterD4({ shapes: rt.shapes.filter((s) => s.type === 'path'), clipToTile: true });
assert.strictEqual(rtD4.orbitSize, 1, 'round-tripped centered ring must remain fully D4 symmetric');

const variantSvg = VectorBoolean.exportFamilyToSVG({ shapes: [asymRect] }, { size: 100, transform: 'r90' });
const variantImp = VectorBoolean.importSVGToShapes(variantSvg);
const vb2 = boundsOfPathShape(VectorEditor.convertShapeToPath(variantImp.shapes[0]));
approx(vb2.minX, 0.3, 2e-3, 'variant r90 export minX'); approx(vb2.minY, 0.1, 2e-3, 'variant r90 export minY');
console.log('✓ Unitary SVG export & 1:1 round-trip (holes, curves, D4 variants) PASSED!');

// ----------------------------------------------------------------------------
// 7. SubtileStudioUI SVG Import/Export Wiring (headless)
// ----------------------------------------------------------------------------
assert.strictEqual(typeof SubtileStudioUI.handleImportSvgText, 'function');
assert.strictEqual(typeof SubtileStudioUI.handleExportSubtileSvg, 'function');
assert.strictEqual(typeof SubtileStudioUI.renderLayersPanel, 'function');

LibraryStore.resetToDefaults();
SubtileStudioUI.selectFamily('elbow-ribbon');
const famCountBefore = LibraryStore.getFamilies().length;
const uiImp = SubtileStudioUI.handleImportSvgText(holeSvg, 'anel_quadrado.svg');
assert.ok(uiImp.ok && uiImp.createdNewFamily, 'importing SVG over a built-in family must create a new custom family');
assert.strictEqual(LibraryStore.getFamilies().length, famCountBefore + 1);
const newDoc = LibraryStore.getFamilyById(uiImp.familyId);
assert.ok(newDoc && !newDoc.builtIn, 'imported family must be custom');
assert.strictEqual(newDoc.name, 'anel quadrado', 'family name must derive from SVG filename');
assert.strictEqual(SubtileStudioUI.state.selectedFamilyId, uiImp.familyId);

const appendRes = SubtileStudioUI.handleImportSvgText('<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="1"/></svg>', 'dot.svg');
assert.ok(appendRes.ok && !appendRes.createdNewFamily, 'importing over a custom family must append shapes');
assert.strictEqual(LibraryStore.getFamilyById(uiImp.familyId).shapes.length, 2);
assert.deepStrictEqual(VectorEditor.state.selectedShapeIds, appendRes.shapes.map((s) => s.id), 'appended shapes must become selected');

const uiSvg = SubtileStudioUI.handleExportSubtileSvg({ download: false });
assert.ok(uiSvg.includes('<svg') && uiSvg.includes('fill-rule="evenodd"'), 'UI export must return SVG with holes');
LibraryStore.resetToDefaults();
console.log('✓ SubtileStudioUI SVG import/export wiring PASSED!');

// ----------------------------------------------------------------------------
// 8. End-to-End Fase D Acceptance:
//    Boolean subtraction + external SVG import -> node edit -> D4 detection ->
//    mandala_d4 mosaic -> full mosaic SVG export without losing holes or curves
// ----------------------------------------------------------------------------
LibraryStore.resetToDefaults();
const e2eFam = LibraryStore.createFamily({ name: 'Moldura Booleana', groupId: 'grp-curves', shapes: [] });
const e2eId = e2eFam.family.id;

// (a) Boolean: centered square frame minus centered circle -> D4-symmetric ring with curved hole
const frame = { id: 'frame', type: 'rect', x: -0.5, y: -1 / 6, w: 1, h: 1 / 3, fill: true };
const cutter = { id: 'cutter', type: 'ellipse', cx: 0, cy: 0, rx: 0.12, ry: 0.12, fill: true };
const boolRes = VectorBoolean.applyBooleanOp([frame, cutter], ['frame', 'cutter'], 'subtract');
assert.ok(boolRes.ok && boolRes.resultIds.length === 1);

// (b) External SVG import: a small asymmetric accent (triangle in upper-left)
const accentSvg = '<svg viewBox="0 0 120 120"><polygon id="accent" points="12,12 36,12 12,30"/></svg>';
const accentImp = VectorBoolean.importSVGToShapes(accentSvg);
assert.ok(accentImp.ok && accentImp.shapes.length === 1);

let e2eShapes = [...boolRes.shapes, ...accentImp.shapes];

// (c) Edit Bezier nodes via VectorEditor: nudge the accent's first node to make it a skewed triangle
const accentShape = e2eShapes.find((s) => s.name === 'accent');
const edited = VectorEditor.movePathNodes(accentShape, [{ contourIdx: 0, nodeIdx: 1 }], 0.02, 0.0);
e2eShapes = e2eShapes.map((s) => (s.id === accentShape.id ? edited : s));
assert.notStrictEqual(edited.contours[0][1].x, accentShape.contours[0][1].x, 'node edit must move the anchor');

LibraryStore.updateFamily(e2eId, { clipToTile: true, shapes: e2eShapes });
const e2eMeta = TileRegistry.getFamilyById(e2eId);
assert.ok(e2eMeta, 'E2E family must compile into TileRegistry');
const e2eDetect = D4Detect.detectMasterD4({ shapes: e2eShapes, clipToTile: true });
assert.strictEqual(e2eDetect.orbitSize, 8, 'asymmetric accent must break symmetry -> 8 variants');
assert.strictEqual(e2eMeta.tileIds.length, 8, 'TileRegistry must allocate 8 D4 variants for asymmetric subtile');

// Removing the accent leaves the axis-symmetric ribbon-with-hole -> 2 variants
const symOnly = D4Detect.detectMasterD4({ shapes: boolRes.shapes, clipToTile: true });
assert.strictEqual(symOnly.orbitSize, 2, 'horizontal ribbon with centered circular hole must be axis_2 (2 variants)');

let rng = 7;
const detRng = (arr) => {
  rng = (rng * 1664525 + 1013904223) >>> 0;
  return arr[rng % arr.length];
};
const allowed = [...e2eMeta.tileIds];
const mosaic = MosaicEngine.generateMosaic(
  {
    rows: 2,
    cols: 2,
    subdivision: 3,
    gridSymmetryMode: 'mandala_d4',
    blockSymmetryMode: 'mandala_d4',
    syncBlockSymmetry: true,
    allowedTiles: allowed
  },
  detRng
);
let customCells = 0;
for (let r = 0; r < mosaic.rows; r++) {
  for (let c = 0; c < mosaic.cols; c++) {
    for (const row of mosaic.grid[r][c].cells) {
      for (const cell of row) {
        assert.ok(allowed.includes(cell.tileId) || cell.tileId === 84, `Unexpected tile #${cell.tileId}`);
        if (allowed.includes(cell.tileId)) customCells++;
      }
    }
  }
}
assert.ok(customCells > 0, 'mandala_d4 mosaic must place the boolean/SVG custom variants');
assert.strictEqual(MosaicEngine.isMosaicD4Invariant(mosaic), true, 'E2E mosaic must be strictly D4 invariant');

const mosaicSvg = new SimpleSVG(600, 600);
MosaicEngine.renderMosaicToContext(mosaicSvg, mosaic, {
  width: 600,
  height: 600,
  margin: 20,
  paddingRatio: 0,
  fgColor: '#111827',
  bgColor: '#f8fafc'
});
const mosaicSvgStr = mosaicSvg.toSVGString();
assert.ok(mosaicSvgStr.includes('<svg') && mosaicSvgStr.includes('</svg>'));
assert.ok(mosaicSvgStr.includes('fill-rule="evenodd"'), 'mosaic SVG must preserve compound holes (evenodd)');
assert.ok(/C\s*-?\d/.test(mosaicSvgStr), 'mosaic SVG must preserve cubic Bezier curves (C)');

LibraryStore.resetToDefaults();
console.log('✓ End-to-End Acceptance (boolean + SVG import -> node edit -> D4 -> mandala_d4 mosaic -> SVG) PASSED!');
console.log('ALL FASE D VECTOR BOOLEAN & SVG TESTS PASSED!\n');

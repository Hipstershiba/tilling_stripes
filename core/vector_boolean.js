/**
 * core/vector_boolean.js
 * Fase D — Headless Paper.js Boolean Engine (Pathfinder), Quick D4 Selection Transforms,
 * Layer Z-Order / Visibility / Lock Operations, and Normalized SVG Import & Export.
 *
 * Runs identically in the browser (using `window.paper` from `libraries/paper-core.min.js`)
 * and in pure headless Node.js (loading `libraries/paper-core.min.js` inside an isolated `vm` context
 * with zero external npm dependencies).
 */

(function () {
  const PAPER_SCALE = 1000; // Maps [-0.5, 0.5] <-> [-500, 500] for sub-micrometer Paper.js precision

  const BOOLEAN_OPS = [
    { id: 'unite', label: 'Unir', shapeName: 'União Booleana' },
    { id: 'subtract', label: 'Subtrair Frente', shapeName: 'Subtração Booleana' },
    { id: 'intersect', label: 'Interseção', shapeName: 'Interseção Booleana' },
    { id: 'exclude', label: 'Excluir (XOR)', shapeName: 'Exclusão Booleana' }
  ];

  let cachedPaperLib = null;
  let cachedScope = null;
  let uidCounter = 1;

  function nextId(prefix = 'bool') {
    uidCounter = (uidCounter + 1) % 1000000;
    return `${prefix}_${Date.now().toString(36)}_${uidCounter.toString(36)}`;
  }

  function deepClone(obj) {
    return obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));
  }

  function roundCoord(v) {
    const n = Number(v) || 0;
    if (Math.abs(n) < 1e-9) return 0;
    return Math.round(n * 1e6) / 1e6;
  }

  function resolveDeps() {
    const win = (typeof window !== 'undefined' && window) ||
      (typeof global !== 'undefined' && global.window) ||
      null;

    let d4 = win && win.D4Symmetry;
    let vr = win && win.VectorRenderer;
    let ve = win && win.VectorEditor;
    let SimpleSVG = (win && win.SimpleSVG) || (typeof global !== 'undefined' && global.SimpleSVG) || null;

    if (typeof require === 'function') {
      if (!d4) {
        require('./d4_symmetry.js');
        d4 = win && win.D4Symmetry;
      }
      if (!vr) vr = require('./vector_renderer.js');
      if (!ve) ve = require('./vector_editor.js');
      if (!SimpleSVG) SimpleSVG = require('../libraries/simple-svg.js');
    }
    return { win, d4, vr, ve, SimpleSVG };
  }

  // ==========================================================================
  // 1. Isolated Headless Paper.js Scope Loader (Browser + Node.js VM)
  // ==========================================================================

  function resolvePaperLibrary() {
    if (cachedPaperLib) return cachedPaperLib;

    if (typeof window !== 'undefined' && window.paper && window.paper.PaperScope) {
      cachedPaperLib = window.paper;
      return cachedPaperLib;
    }
    if (typeof global !== 'undefined' && global.window && global.window.paper && global.window.paper.PaperScope) {
      cachedPaperLib = global.window.paper;
      return cachedPaperLib;
    }

    if (typeof require === 'function') {
      const fs = require('fs');
      const path = require('path');
      const vm = require('vm');
      const paperPath = path.resolve(__dirname, '..', 'libraries', 'paper-core.min.js');
      const src = fs.readFileSync(paperPath, 'utf8');

      const noop = () => {};
      const ctx2d = {
        save: noop,
        restore: noop,
        scale: noop,
        translate: noop,
        rotate: noop,
        transform: noop,
        setTransform: noop,
        clearRect: noop,
        beginPath: noop,
        closePath: noop,
        moveTo: noop,
        lineTo: noop,
        bezierCurveTo: noop,
        quadraticCurveTo: noop,
        arc: noop,
        fill: noop,
        stroke: noop,
        clip: noop,
        measureText: () => ({ width: 0 })
      };

      const doc = {
        body: { appendChild: noop },
        documentElement: { style: {} },
        addEventListener: noop,
        removeEventListener: noop
      };
      doc.createElement = () => ({
        ownerDocument: doc,
        width: PAPER_SCALE,
        height: PAPER_SCALE,
        style: {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: PAPER_SCALE, height: PAPER_SCALE }),
        getContext: () => ctx2d,
        addEventListener: noop,
        removeEventListener: noop,
        setAttribute: noop,
        getAttribute: () => null,
        hasAttribute: () => false
      });

      const sandbox = {
        navigator: { userAgent: 'Mozilla/5.0', platform: 'Win32' },
        document: doc,
        addEventListener: noop,
        removeEventListener: noop,
        requestAnimationFrame: noop,
        cancelAnimationFrame: noop,
        HTMLCanvasElement: function () {},
        Image: function () {},
        XMLSerializer: function () {},
        DOMParser: function () {},
        console,
        Math,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
        TypeError,
        RangeError,
        Float32Array,
        Float64Array,
        Int32Array,
        Uint8Array,
        Uint16Array,
        Uint32Array,
        parseFloat,
        parseInt,
        isNaN,
        isFinite,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval
      };
      sandbox.window = sandbox;
      sandbox.self = sandbox;

      vm.runInNewContext(src, sandbox);
      cachedPaperLib = sandbox.paper;
      return cachedPaperLib;
    }

    return null;
  }

  function getPaperScope() {
    if (cachedScope) {
      if (cachedScope.project) cachedScope.project.clear();
      return cachedScope;
    }
    const paper = resolvePaperLibrary();
    if (!paper) return null;

    const scope = new paper.PaperScope();
    scope.settings.insertItems = false;
    scope.setup(new scope.Size(PAPER_SCALE, PAPER_SCALE));
    cachedScope = scope;
    return scope;
  }

  // ==========================================================================
  // 2. Shape <-> Paper.js PathItem Conversion
  // ==========================================================================

  /**
   * Expands an open polyline/curve with `strokeWeight` into a closed polygon outline
   * so stroked open lines/arcs can participate cleanly in Pathfinder boolean operations.
   */
  function buildExpandedStrokePolygon(points, halfW, cap = 'butt') {
    if (!points || points.length < 2 || halfW <= 1e-6) return null;

    // Filter consecutive duplicate vertices
    const pts = [points[0]];
    for (let i = 1; i < points.length; i++) {
      if (Math.hypot(points[i][0] - pts[pts.length - 1][0], points[i][1] - pts[pts.length - 1][1]) > 1e-6) {
        pts.push(points[i]);
      }
    }
    if (pts.length < 2) return null;

    const normals = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1][0] - pts[i][0];
      const dy = pts[i + 1][1] - pts[i][1];
      const len = Math.hypot(dx, dy) || 1;
      normals.push([-dy / len, dx / len, dx / len, dy / len]); // nx, ny, tx, ty
    }

    const leftSide = [];
    const rightSide = [];

    for (let i = 0; i < pts.length; i++) {
      let nx, ny;
      if (i === 0) {
        [nx, ny] = normals[0];
      } else if (i === pts.length - 1) {
        [nx, ny] = normals[normals.length - 1];
      } else {
        const n0 = normals[i - 1];
        const n1 = normals[i];
        let mx = n0[0] + n1[0];
        let my = n0[1] + n1[1];
        const mLen = Math.hypot(mx, my);
        if (mLen < 1e-4) {
          nx = n1[0];
          ny = n1[1];
        } else {
          mx /= mLen;
          my /= mLen;
          const dot = Math.max(0.35, mx * n1[0] + my * n1[1]);
          const miter = Math.min(2.5, 1 / dot);
          nx = mx * miter;
          ny = my * miter;
        }
      }
      leftSide.push([pts[i][0] + nx * halfW, pts[i][1] + ny * halfW]);
      rightSide.push([pts[i][0] - nx * halfW, pts[i][1] - ny * halfW]);
    }

    const ring = [];
    // Start cap
    if (cap === 'square') {
      const [, , tx, ty] = normals[0];
      ring.push([leftSide[0][0] - tx * halfW, leftSide[0][1] - ty * halfW]);
    } else if (cap === 'round') {
      const [nx, ny] = normals[0];
      const startA = Math.atan2(-ny, -nx);
      for (let s = 1; s < 8; s++) {
        const a = startA - (Math.PI * s) / 8;
        ring.push([pts[0][0] + Math.cos(a) * halfW, pts[0][1] + Math.sin(a) * halfW]);
      }
    }

    for (let i = 0; i < leftSide.length; i++) ring.push(leftSide[i]);

    // End cap
    const lastIdx = pts.length - 1;
    if (cap === 'square') {
      const [, , tx, ty] = normals[normals.length - 1];
      ring.push([leftSide[lastIdx][0] + tx * halfW, leftSide[lastIdx][1] + ty * halfW]);
      ring.push([rightSide[lastIdx][0] + tx * halfW, rightSide[lastIdx][1] + ty * halfW]);
    } else if (cap === 'round') {
      const [nx, ny] = normals[normals.length - 1];
      const startA = Math.atan2(ny, nx);
      for (let s = 1; s < 8; s++) {
        const a = startA - (Math.PI * s) / 8;
        ring.push([pts[lastIdx][0] + Math.cos(a) * halfW, pts[lastIdx][1] + Math.sin(a) * halfW]);
      }
    }

    for (let i = rightSide.length - 1; i >= 0; i--) ring.push(rightSide[i]);

    if (cap === 'square') {
      const [, , tx, ty] = normals[0];
      ring.push([rightSide[0][0] - tx * halfW, rightSide[0][1] - ty * halfW]);
    }

    return ring;
  }

  function contourNodesToPaperPath(nodes, closed, scope) {
    const segs = (nodes || []).map((nd) => {
      const pt = new scope.Point((Number(nd.x) || 0) * PAPER_SCALE, (Number(nd.y) || 0) * PAPER_SCALE);
      const hIn = Array.isArray(nd.in)
        ? new scope.Point((Number(nd.in[0]) || 0) * PAPER_SCALE, (Number(nd.in[1]) || 0) * PAPER_SCALE)
        : new scope.Point(0, 0);
      const hOut = Array.isArray(nd.out)
        ? new scope.Point((Number(nd.out[0]) || 0) * PAPER_SCALE, (Number(nd.out[1]) || 0) * PAPER_SCALE)
        : new scope.Point(0, 0);
      return new scope.Segment(pt, hIn, hOut);
    });
    return new scope.Path({
      segments: segs,
      closed: Boolean(closed),
      insert: false
    });
  }

  function shapeToPaperItem(shape, scope) {
    if (!shape || !scope) return null;
    const { vr, ve } = resolveDeps();
    if (!ve) return null;

    const pathShape = shape.type === 'path' ? deepClone(shape) : ve.convertShapeToPath(shape);
    if (!pathShape) return null;

    const contours = vr ? vr.getNormalizedPathContours(pathShape) : (pathShape.contours || []);
    if (!contours || contours.length === 0) return null;

    const isClosed = pathShape.closed !== false;
    const hasFill = pathShape.fill !== false && isClosed;
    const strokeW = Math.max(0.01, Number(pathShape.strokeWeight) || 0.08);

    // Open stroked shape (e.g. 'line', open 'arc', open 'path') -> expand stroke into closed polygon
    if (!hasFill && pathShape.stroke) {
      const rings = [];
      for (const nodes of contours) {
        const sampled = ve.sampleContourPoints(nodes, isClosed, 24);
        const expanded = buildExpandedStrokePolygon(sampled, strokeW / 2, pathShape.strokeCap || 'butt');
        if (expanded && expanded.length >= 3) {
          const polyNodes = expanded.map(([x, y]) => ({ x, y }));
          rings.push(contourNodesToPaperPath(polyNodes, true, scope));
        }
      }
      if (rings.length === 0) return null;
      if (rings.length === 1) return rings[0];
      const cp = new scope.CompoundPath({ children: rings, fillRule: 'nonzero', insert: false });
      return cp;
    }

    if (contours.length === 1) {
      return contourNodesToPaperPath(contours[0], true, scope);
    }

    const children = contours
      .filter((c) => Array.isArray(c) && c.length >= 2)
      .map((c) => contourNodesToPaperPath(c, true, scope));
    if (children.length === 0) return null;
    const cp = new scope.CompoundPath({
      children,
      fillRule: pathShape.fillRule || 'evenodd',
      insert: false
    });
    if (typeof cp.reorient === 'function') {
      cp.reorient(false, true);
    }
    return cp;
  }

  function paperSegmentsToNodes(paperPath, invScale = 1 / PAPER_SCALE) {
    const segs = paperPath.segments || [];
    const nodes = [];
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const nd = {
        x: roundCoord(seg.point.x * invScale),
        y: roundCoord(seg.point.y * invScale)
      };
      const hxIn = seg.handleIn ? seg.handleIn.x * invScale : 0;
      const hyIn = seg.handleIn ? seg.handleIn.y * invScale : 0;
      const hxOut = seg.handleOut ? seg.handleOut.x * invScale : 0;
      const hyOut = seg.handleOut ? seg.handleOut.y * invScale : 0;

      if (Math.abs(hxIn) > 1e-6 || Math.abs(hyIn) > 1e-6) {
        nd.in = [roundCoord(hxIn), roundCoord(hyIn)];
      }
      if (Math.abs(hxOut) > 1e-6 || Math.abs(hyOut) > 1e-6) {
        nd.out = [roundCoord(hxOut), roundCoord(hyOut)];
      }
      nodes.push(nd);
    }

    // Merge coincident closing segment if an SVG repeated the start point right before 'Z'
    if (paperPath.closed && nodes.length > 3) {
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (
        Math.hypot(last.x - first.x, last.y - first.y) <= 1e-6 &&
        !last.out &&
        !first.in
      ) {
        if (last.in) first.in = last.in;
        nodes.pop();
      }
    }
    return nodes;
  }

  function paperItemToPathShape(item, options = {}) {
    if (!item) return null;

    if (item.className === 'CompoundPath' && typeof item.reorient === 'function') {
      item.reorient(false, true);
    }

    const contours = [];
    let closed = true;

    if (item.className === 'Path') {
      if (Math.abs(item.area || 0) < 1e-3 && item.closed) {
        return null;
      }
      closed = Boolean(item.closed);
      const minSegs = closed ? 3 : 2;
      if (item.segments && item.segments.length >= minSegs) {
        contours.push(paperSegmentsToNodes(item));
      }
    } else if (item.className === 'CompoundPath' && Array.isArray(item.children)) {
      for (const child of item.children) {
        if (!child || !child.segments) continue;
        const minSegs = child.closed ? 3 : 2;
        if (child.segments.length >= minSegs && (!child.closed || Math.abs(child.area || 0) >= 1e-3)) {
          contours.push(paperSegmentsToNodes(child));
        }
      }
    }

    if (contours.length === 0) return null;

    return {
      id: options.id || nextId('path'),
      type: 'path',
      name: options.name || 'Caminho Composto',
      closed,
      fillRule: options.fillRule || 'evenodd',
      contours,
      visible: true,
      locked: false,
      fill: options.fill !== undefined ? Boolean(options.fill) : true,
      stroke: Boolean(options.stroke),
      strokeWeight: typeof options.strokeWeight === 'number' ? roundCoord(options.strokeWeight) : 0.06
    };
  }

  // ==========================================================================
  // 3. Pathfinder Boolean Operations (Unite, Subtract, Intersect, Exclude)
  // ==========================================================================

  /**
   * Executes a Pathfinder boolean operation across >= 2 selected unlocked shapes in `shapes`.
   *
   * @param {Array} shapes - Family shape stack (index 0 = bottom, length-1 = top).
   * @param {string[]} selectedIds - Selected shape IDs.
   * @param {'unite'|'subtract'|'intersect'|'exclude'} op
   * @returns {{ ok: boolean, reason?: string, shapes: Array, resultIds: string[], emptyResult?: boolean }}
   */
  function applyBooleanOp(shapes, selectedIds, op = 'unite') {
    const validOps = new Set(['unite', 'subtract', 'intersect', 'exclude']);
    if (!validOps.has(op)) {
      return { ok: false, reason: 'invalid_op', shapes: deepClone(shapes || []), resultIds: [] };
    }

    const list = deepClone(shapes || []);
    const selSet = new Set(selectedIds || []);
    const operandEntries = [];

    list.forEach((sh, idx) => {
      if (sh && selSet.has(sh.id) && !sh.locked && sh.visible !== false) {
        operandEntries.push({ shape: sh, index: idx });
      }
    });

    if (operandEntries.length < 2) {
      return { ok: false, reason: 'need_two_shapes', shapes: list, resultIds: [] };
    }

    const scope = getPaperScope();
    if (!scope) {
      return { ok: false, reason: 'paper_unavailable', shapes: list, resultIds: [] };
    }

    const paperItems = [];
    for (const entry of operandEntries) {
      const pItem = shapeToPaperItem(entry.shape, scope);
      if (pItem) paperItems.push({ item: pItem, entry });
    }

    if (paperItems.length < 2) {
      return { ok: false, reason: 'need_two_shapes', shapes: list, resultIds: [] };
    }

    let acc = paperItems[0].item;
    for (let i = 1; i < paperItems.length; i++) {
      const next = paperItems[i].item;
      let combined = null;
      if (op === 'unite') {
        combined = acc.unite(next, { insert: false });
      } else if (op === 'subtract') {
        combined = acc.subtract(next, { insert: false });
      } else if (op === 'intersect') {
        combined = acc.intersect(next, { insert: false });
      } else if (op === 'exclude') {
        combined = acc.exclude(next, { insert: false });
      }
      if (!combined) {
        acc = null;
        break;
      }
      acc = combined;
    }

    const opMeta = BOOLEAN_OPS.find((m) => m.id === op) || BOOLEAN_OPS[0];
    const baseTemplate = op === 'subtract'
      ? operandEntries[0].shape
      : operandEntries[operandEntries.length - 1].shape;

    const resultShape = acc
      ? paperItemToPathShape(acc, {
          name: opMeta.shapeName,
          fillRule: 'evenodd',
          fill: true,
          stroke: Boolean(baseTemplate.stroke && baseTemplate.fill !== false),
          strokeWeight: baseTemplate.strokeWeight
        })
      : null;

    const consumedSet = new Set(operandEntries.map((e) => e.shape.id));
    const anchorIdx = op === 'subtract'
      ? operandEntries[0].index
      : operandEntries[operandEntries.length - 1].index;

    const nextShapes = [];
    let inserted = false;
    for (let i = 0; i < list.length; i++) {
      if (i === anchorIdx && resultShape && !inserted) {
        nextShapes.push(resultShape);
        inserted = true;
      }
      if (!consumedSet.has(list[i]?.id)) {
        nextShapes.push(list[i]);
      }
    }
    if (resultShape && !inserted) {
      nextShapes.push(resultShape);
    }

    return {
      ok: true,
      shapes: nextShapes,
      resultIds: resultShape ? [resultShape.id] : [],
      emptyResult: !resultShape
    };
  }

  // ==========================================================================
  // 4. Quick D4 Selection Transforms (Rotate +90°/-90°/180°, Mirror H/V/Diag)
  // ==========================================================================

  function roundShapeCoords(shape) {
    if (!shape || typeof shape !== 'object') return shape;
    const out = deepClone(shape);
    for (const k of ['x', 'y', 'w', 'h', 'cx', 'cy', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'start', 'end', 'rotation', 'radius']) {
      if (typeof out[k] === 'number') out[k] = roundCoord(out[k]);
    }
    if (Array.isArray(out.points)) {
      out.points = out.points.map(([px, py]) => [roundCoord(px), roundCoord(py)]);
    }
    if (Array.isArray(out.contours)) {
      out.contours = out.contours.map((nodes) =>
        nodes.map((nd) => {
          const r = { ...nd, x: roundCoord(nd.x), y: roundCoord(nd.y) };
          if (Array.isArray(nd.in)) r.in = [roundCoord(nd.in[0]), roundCoord(nd.in[1])];
          if (Array.isArray(nd.out)) r.out = [roundCoord(nd.out[0]), roundCoord(nd.out[1])];
          return r;
        })
      );
    }
    return out;
  }

  /**
   * Applies an exact D4 isometry (`r90`, `r270`, `r180`, `mx`, `my`, `md`, `mad`)
   * around the shared selection center to all selected unlocked shapes.
   */
  function transformSelectedShapesD4(shapes, selectedIds, d4Key) {
    const { vr, ve } = resolveDeps();
    const list = deepClone(shapes || []);
    if (!vr || !ve || !d4Key || d4Key === 'id') return list;

    const selSet = new Set(selectedIds || []);
    const bounds = ve.computeSelectionBounds(list.filter(sh => sh && selSet.has(sh.id) && !sh.locked));
    if (!bounds) return list;
    return list.map((sh) => {
      if (!sh || !selSet.has(sh.id) || sh.locked) return sh;
      return roundShapeCoords(ve.translateShape(vr.transformShapeD4(ve.translateShape(sh, -bounds.cx, -bounds.cy), d4Key), bounds.cx, bounds.cy));
    });
  }

  // ==========================================================================
  // 5. Layer Stack Pure Operations (Z-Order, Visibility, Lock, Rename)
  // ==========================================================================

  /**
   * Reorders `shapeId` in the Z-stack (`0` = backmost, `length - 1` = topmost).
   * `target` can be `'front'`, `'forward'`, `'backward'`, `'back'`, or an integer index.
   */
  function reorderShapeZ(shapes, shapeId, target) {
    const list = deepClone(shapes || []);
    const fromIdx = list.findIndex((s) => s && s.id === shapeId);
    if (fromIdx < 0 || list.length <= 1) return list;

    let toIdx = fromIdx;
    if (typeof target === 'number') {
      toIdx = Math.max(0, Math.min(list.length - 1, Math.round(target)));
    } else if (target === 'front') {
      toIdx = list.length - 1;
    } else if (target === 'forward') {
      toIdx = Math.min(list.length - 1, fromIdx + 1);
    } else if (target === 'backward') {
      toIdx = Math.max(0, fromIdx - 1);
    } else if (target === 'back') {
      toIdx = 0;
    }

    if (toIdx === fromIdx) return list;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    return list;
  }

  function setShapeVisible(shapes, shapeId, visible) {
    return deepClone(shapes || []).map((sh) => {
      if (!sh || sh.id !== shapeId) return sh;
      return { ...sh, visible: Boolean(visible) };
    });
  }

  function toggleShapeVisible(shapes, shapeId) {
    return deepClone(shapes || []).map((sh) => {
      if (!sh || sh.id !== shapeId) return sh;
      return { ...sh, visible: sh.visible === false };
    });
  }

  function setShapeLocked(shapes, shapeId, locked) {
    return deepClone(shapes || []).map((sh) => {
      if (!sh || sh.id !== shapeId) return sh;
      return { ...sh, locked: Boolean(locked) };
    });
  }

  function toggleShapeLocked(shapes, shapeId) {
    return deepClone(shapes || []).map((sh) => {
      if (!sh || sh.id !== shapeId) return sh;
      return { ...sh, locked: !sh.locked };
    });
  }

  function renameShape(shapes, shapeId, newName) {
    const clean = String(newName || '').trim();
    if (!clean) return deepClone(shapes || []);
    return deepClone(shapes || []).map((sh) => {
      if (!sh || sh.id !== shapeId) return sh;
      return { ...sh, name: clean };
    });
  }

  // ==========================================================================
  // 6. Pure-JS SVG Parser + Matrix CTM + Paper.js Normalized Import
  // ==========================================================================

  function multiplyMatrix2D(m1, m2) {
    // 2x3 SVG affine matrix [a, b, c, d, e, f]
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  }

  function parseTransformAttr(transformStr) {
    let mat = [1, 0, 0, 1, 0, 0];
    if (!transformStr || typeof transformStr !== 'string') return mat;

    const opRe = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
    let m;
    while ((m = opRe.exec(transformStr)) !== null) {
      const fn = m[1].toLowerCase();
      const nums = (m[2].match(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || []).map(Number);
      let next = [1, 0, 0, 1, 0, 0];

      if (fn === 'matrix' && nums.length >= 6) {
        next = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]];
      } else if (fn === 'translate') {
        next = [1, 0, 0, 1, nums[0] || 0, nums[1] || 0];
      } else if (fn === 'scale') {
        const sx = nums.length >= 1 ? nums[0] : 1;
        const sy = nums.length >= 2 ? nums[1] : sx;
        next = [sx, 0, 0, sy, 0, 0];
      } else if (fn === 'rotate') {
        const rad = ((nums[0] || 0) * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        if (nums.length >= 3) {
          const cx = nums[1];
          const cy = nums[2];
          next = multiplyMatrix2D(
            multiplyMatrix2D([1, 0, 0, 1, cx, cy], [c, s, -s, c, 0, 0]),
            [1, 0, 0, 1, -cx, -cy]
          );
        } else {
          next = [c, s, -s, c, 0, 0];
        }
      } else if (fn === 'skewx') {
        const t = Math.tan(((nums[0] || 0) * Math.PI) / 180);
        next = [1, 0, t, 1, 0, 0];
      } else if (fn === 'skewy') {
        const t = Math.tan(((nums[0] || 0) * Math.PI) / 180);
        next = [1, t, 0, 1, 0, 0];
      }
      mat = multiplyMatrix2D(mat, next);
    }
    return mat;
  }

  function applyMatrixToPoint(mat, x, y) {
    return [
      mat[0] * x + mat[2] * y + mat[4],
      mat[1] * x + mat[3] * y + mat[5]
    ];
  }

  function isAxisAlignedMatrix(mat) {
    return Math.abs(mat[1]) < 1e-6 && Math.abs(mat[2]) < 1e-6 && mat[0] > 0 && mat[3] > 0;
  }

  function parseSvgLength(val, fallback = 0) {
    if (val === undefined || val === null || val === '') return fallback;
    const str = String(val).trim();
    const num = parseFloat(str);
    if (!Number.isFinite(num)) return fallback;
    if (str.endsWith('pt')) return num * (96 / 72);
    if (str.endsWith('mm')) return num * (96 / 25.4);
    if (str.endsWith('cm')) return num * (96 / 2.54);
    if (str.endsWith('in')) return num * 96;
    return num;
  }

  function parseAttributes(attrString) {
    const attrs = {};
    if (!attrString) return attrs;
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let m;
    while ((m = attrRe.exec(attrString)) !== null) {
      const key = m[1];
      const val = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
      attrs[key] = val;
    }

    // Inline CSS style="..." overrides presentation attributes
    if (attrs.style) {
      const parts = attrs.style.split(';');
      for (const p of parts) {
        const idx = p.indexOf(':');
        if (idx > 0) {
          const sk = p.slice(0, idx).trim();
          const sv = p.slice(idx + 1).trim();
          if (sk && sv) attrs[sk] = sv;
        }
      }
    }
    return attrs;
  }

  function parseXmlTree(svgText) {
    const cleaned = String(svgText || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\?[\s\S]*?\?>/g, '')
      .replace(/<!DOCTYPE[^>]*>/gi, '');

    const root = { tag: '#root', attrs: {}, children: [] };
    const stack = [root];
    const tokenRe = /<\s*(\/?)\s*([a-zA-Z_:][-a-zA-Z0-9_:.]*)([^>]*?)(\/?)\s*>/g;
    let m;

    while ((m = tokenRe.exec(cleaned)) !== null) {
      const isClose = m[1] === '/';
      const rawTag = m[2];
      const localTag = rawTag.includes(':') ? rawTag.split(':').pop().toLowerCase() : rawTag.toLowerCase();
      const attrPart = m[3] || '';
      const selfClose = m[4] === '/' || attrPart.trim().endsWith('/');

      if (isClose) {
        for (let i = stack.length - 1; i >= 1; i--) {
          if (stack[i].tag === localTag) {
            stack.length = i;
            break;
          }
        }
      } else {
        const node = {
          tag: localTag,
          attrs: parseAttributes(attrPart),
          children: []
        };
        stack[stack.length - 1].children.push(node);
        if (!selfClose) {
          stack.push(node);
        }
      }
    }

    return root.children.find((n) => n.tag === 'svg') || root;
  }

  function parsePointsList(pointsStr) {
    const nums = (String(pointsStr || '').match(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || []).map(Number);
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      pts.push([nums[i], nums[i + 1]]);
    }
    return pts;
  }

  const SKIPPED_SVG_CONTAINERS = new Set([
    'defs',
    'clippath',
    'mask',
    'pattern',
    'lineargradient',
    'radialgradient',
    'style',
    'script',
    'title',
    'desc',
    'metadata',
    'symbol',
    'filter',
    'marker'
  ]);

  /**
   * Parses an SVG string (`<svg viewBox="...">...</svg>`) into normalized `[-0.5, 0.5]`
   * editable Tiling Stripes Studio shapes (`rect`, `ellipse`, `line`, `path`).
   *
   * @param {string} svgText
   * @param {Object} [options]
   * @param {number} [options.fitMargin=0] - Optional inset margin in [0, 0.4] inside [-0.5, 0.5].
   * @param {boolean} [options.normalizeToContent=false] - Force auto-fit to geometry bounding box instead of viewBox.
   * @returns {{ ok: boolean, error?: string, shapes: Array, viewBox: number[] }}
   */
  function importSVGToShapes(svgText, options = {}) {
    if (!svgText || typeof svgText !== 'string' || !svgText.includes('<')) {
      return { ok: false, error: 'Conteúdo SVG inválido ou vazio.', shapes: [], viewBox: [0, 0, 100, 100] };
    }

    const scope = getPaperScope();
    if (!scope) {
      return { ok: false, error: 'Motor Paper.js indisponível.', shapes: [], viewBox: [0, 0, 100, 100] };
    }

    const svgRoot = parseXmlTree(svgText);
    if (!svgRoot || (!svgRoot.children?.length && svgRoot.tag !== 'svg')) {
      return { ok: false, error: 'Nenhuma estrutura <svg> encontrada.', shapes: [], viewBox: [0, 0, 100, 100] };
    }

    // Resolve SVG viewBox [minX, minY, width, height]
    let vb = null;
    if (svgRoot.attrs && svgRoot.attrs.viewBox) {
      const vbNums = (svgRoot.attrs.viewBox.match(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || []).map(Number);
      if (vbNums.length >= 4 && vbNums[2] > 0 && vbNums[3] > 0) {
        vb = [vbNums[0], vbNums[1], vbNums[2], vbNums[3]];
      }
    }
    if (!vb && svgRoot.attrs) {
      const w = parseSvgLength(svgRoot.attrs.width, 0);
      const h = parseSvgLength(svgRoot.attrs.height, 0);
      if (w > 0 && h > 0) vb = [0, 0, w, h];
    }

    const rawItems = [];

    function walk(node, parentMat, inheritedStyle) {
      if (!node || SKIPPED_SVG_CONTAINERS.has(node.tag)) return;

      const attrs = node.attrs || {};
      if (attrs.display === 'none' || attrs.visibility === 'hidden' || attrs['data-tiling-role'] === 'bg') {
        return;
      }
      if (attrs.opacity !== undefined && Number(attrs.opacity) <= 0) {
        return;
      }

      const localMat = parseTransformAttr(attrs.transform);
      const ctm = multiplyMatrix2D(parentMat, localMat);

      const style = {
        fill: attrs.fill !== undefined ? attrs.fill : inheritedStyle.fill,
        stroke: attrs.stroke !== undefined ? attrs.stroke : inheritedStyle.stroke,
        strokeWidth: attrs['stroke-width'] !== undefined ? parseSvgLength(attrs['stroke-width'], inheritedStyle.strokeWidth) : inheritedStyle.strokeWidth,
        strokeLinecap: attrs['stroke-linecap'] !== undefined ? attrs['stroke-linecap'] : inheritedStyle.strokeLinecap,
        fillRule: attrs['fill-rule'] !== undefined ? attrs['fill-rule'] : inheritedStyle.fillRule
      };

      const hasFill = style.fill !== 'none' && style.fill !== 'transparent';
      const hasStroke = Boolean(style.stroke && style.stroke !== 'none' && style.stroke !== 'transparent' && style.strokeWidth > 0);
      const matScale = Math.hypot(ctm[0], ctm[1]) || 1;
      const effStrokeW = (style.strokeWidth || 1) * matScale;
      const labelBase = attrs.id || attrs['inkscape:label'] || null;

      if (node.tag === 'g' || node.tag === 'svg' || node.tag === 'a') {
        for (const child of (node.children || [])) {
          walk(child, ctm, style);
        }
        return;
      }

      if (node.tag === 'rect') {
        const w = parseSvgLength(attrs.width, 0);
        const h = parseSvgLength(attrs.height, 0);
        if (w <= 0 || h <= 0 || (!hasFill && !hasStroke)) return;
        const x = parseSvgLength(attrs.x, 0);
        const y = parseSvgLength(attrs.y, 0);
        const rx = parseSvgLength(attrs.rx ?? attrs.ry, 0);
        const ry = parseSvgLength(attrs.ry ?? attrs.rx, 0);

        if (isAxisAlignedMatrix(ctm) && Math.abs(rx * ctm[0] - ry * ctm[3]) < 1e-4) {
          const [tx, ty] = applyMatrixToPoint(ctm, x, y);
          rawItems.push({
            kind: 'rect',
            name: labelBase || 'Retângulo SVG',
            x: tx,
            y: ty,
            w: w * ctm[0],
            h: h * ctm[3],
            radius: rx * ctm[0],
            fill: hasFill,
            stroke: hasStroke,
            strokeW: effStrokeW
          });
        } else {
          const pRect = new scope.Path.Rectangle({
            point: [x, y],
            size: [w, h],
            radius: [rx, ry],
            insert: false
          });
          pRect.transform(new scope.Matrix(ctm[0], ctm[1], ctm[2], ctm[3], ctm[4], ctm[5]));
          rawItems.push({
            kind: 'paper',
            name: labelBase || 'Retângulo SVG',
            item: pRect,
            fill: hasFill,
            stroke: hasStroke,
            strokeW: effStrokeW,
            fillRule: style.fillRule
          });
        }
        return;
      }

      if (node.tag === 'circle' || node.tag === 'ellipse') {
        const cx = parseSvgLength(attrs.cx, 0);
        const cy = parseSvgLength(attrs.cy, 0);
        const rx = node.tag === 'circle' ? parseSvgLength(attrs.r, 0) : parseSvgLength(attrs.rx, 0);
        const ry = node.tag === 'circle' ? rx : parseSvgLength(attrs.ry, 0);
        if (rx <= 0 || ry <= 0 || (!hasFill && !hasStroke)) return;

        if (isAxisAlignedMatrix(ctm)) {
          const [tcx, tcy] = applyMatrixToPoint(ctm, cx, cy);
          rawItems.push({
            kind: 'ellipse',
            name: labelBase || (node.tag === 'circle' ? 'Círculo SVG' : 'Elipse SVG'),
            cx: tcx,
            cy: tcy,
            rx: rx * ctm[0],
            ry: ry * ctm[3],
            fill: hasFill,
            stroke: hasStroke,
            strokeW: effStrokeW
          });
        } else {
          const pEll = new scope.Path.Ellipse({
            center: [cx, cy],
            radius: [rx, ry],
            insert: false
          });
          pEll.transform(new scope.Matrix(ctm[0], ctm[1], ctm[2], ctm[3], ctm[4], ctm[5]));
          rawItems.push({
            kind: 'paper',
            name: labelBase || 'Elipse SVG',
            item: pEll,
            fill: hasFill,
            stroke: hasStroke,
            strokeW: effStrokeW,
            fillRule: style.fillRule
          });
        }
        return;
      }

      if (node.tag === 'line') {
        const x1 = parseSvgLength(attrs.x1, 0);
        const y1 = parseSvgLength(attrs.y1, 0);
        const x2 = parseSvgLength(attrs.x2, 0);
        const y2 = parseSvgLength(attrs.y2, 0);
        const [tx1, ty1] = applyMatrixToPoint(ctm, x1, y1);
        const [tx2, ty2] = applyMatrixToPoint(ctm, x2, y2);
        if (Math.hypot(tx2 - tx1, ty2 - ty1) < 1e-6) return;
        rawItems.push({
          kind: 'line',
          name: labelBase || 'Linha SVG',
          x1: tx1,
          y1: ty1,
          x2: tx2,
          y2: ty2,
          strokeW: effStrokeW > 0 ? effStrokeW : 1,
          strokeCap: style.strokeLinecap || 'butt'
        });
        return;
      }

      if (node.tag === 'polygon' || node.tag === 'polyline') {
        const pts = parsePointsList(attrs.points);
        const isPolyClosed = node.tag === 'polygon';
        if (pts.length < (isPolyClosed ? 3 : 2)) return;
        const tPts = pts.map(([px, py]) => applyMatrixToPoint(ctm, px, py));
        const pPath = new scope.Path({
          segments: tPts,
          closed: isPolyClosed,
          insert: false
        });
        rawItems.push({
          kind: 'paper',
          name: labelBase || (isPolyClosed ? 'Polígono SVG' : 'Polilinha SVG'),
          item: pPath,
          fill: isPolyClosed ? hasFill : false,
          stroke: isPolyClosed ? hasStroke : (hasStroke || !hasFill),
          strokeW: effStrokeW > 0 ? effStrokeW : 1,
          fillRule: style.fillRule
        });
        return;
      }

      if (node.tag === 'path') {
        const d = (attrs.d || '').trim();
        if (!d || (!hasFill && !hasStroke)) return;
        let pItem = null;
        try {
          pItem = new scope.CompoundPath(d);
          pItem.remove();
        } catch (_err) {
          pItem = null;
        }
        if (!pItem) return;
        pItem.transform(new scope.Matrix(ctm[0], ctm[1], ctm[2], ctm[3], ctm[4], ctm[5]));

        // Check if path is open when user omitted Z
        const children = pItem.children || [];
        const anyClosed = children.some((c) => c.closed);

        rawItems.push({
          kind: 'paper',
          name: labelBase || 'Caminho SVG',
          item: pItem,
          fill: anyClosed ? hasFill : (hasFill && !hasStroke),
          stroke: hasStroke || (!anyClosed && !hasFill),
          strokeW: effStrokeW > 0 ? effStrokeW : 1,
          fillRule: style.fillRule || 'evenodd'
        });
      }
    }

    walk(svgRoot, [1, 0, 0, 1, 0, 0], {
      fill: '#000000',
      stroke: 'none',
      strokeWidth: 1,
      strokeLinecap: 'butt',
      fillRule: 'evenodd'
    });

    if (rawItems.length === 0) {
      return { ok: false, error: 'Nenhuma geometria vetorial suportada foi encontrada no SVG.', shapes: [], viewBox: vb || [0, 0, 100, 100] };
    }

    // Compute content bounds if viewBox is missing or normalizeToContent === true
    if (!vb || options.normalizeToContent) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const expand = (x, y) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      };
      for (const r of rawItems) {
        if (r.kind === 'rect') {
          expand(r.x, r.y);
          expand(r.x + r.w, r.y + r.h);
        } else if (r.kind === 'ellipse') {
          expand(r.cx - r.rx, r.cy - r.ry);
          expand(r.cx + r.rx, r.cy + r.ry);
        } else if (r.kind === 'line') {
          expand(r.x1, r.y1);
          expand(r.x2, r.y2);
        } else if (r.kind === 'paper' && r.item && r.item.bounds) {
          const b = r.item.bounds;
          expand(b.left, b.top);
          expand(b.right, b.bottom);
        }
      }
      if (Number.isFinite(minX) && Number.isFinite(minY)) {
        const bw = Math.max(1e-3, maxX - minX);
        const bh = Math.max(1e-3, maxY - minY);
        vb = [minX, minY, bw, bh];
      } else {
        vb = [0, 0, 100, 100];
      }
    }

    const fitMargin = Math.max(0, Math.min(0.4, Number(options.fitMargin) || 0));
    const targetSpan = Math.max(0.1, 1 - 2 * fitMargin);
    const maxDim = Math.max(1e-6, vb[2], vb[3]);
    const normScale = targetSpan / maxDim;
    const vbCx = vb[0] + vb[2] / 2;
    const vbCy = vb[1] + vb[3] / 2;

    const mapX = (x) => roundCoord((x - vbCx) * normScale);
    const mapY = (y) => roundCoord((y - vbCy) * normScale);
    const mapLen = (l) => roundCoord(Math.abs(l) * normScale);

    const shapes = [];

    for (const r of rawItems) {
      if (r.kind === 'rect') {
        shapes.push({
          id: nextId('svg_rect'),
          type: 'rect',
          name: r.name,
          x: mapX(r.x),
          y: mapY(r.y),
          w: Math.max(0.004, mapLen(r.w)),
          h: Math.max(0.004, mapLen(r.h)),
          radius: mapLen(r.radius),
          rotation: 0,
          visible: true,
          locked: false,
          fill: Boolean(r.fill),
          stroke: Boolean(r.stroke),
          strokeWeight: Math.max(0.005, mapLen(r.strokeW || 0)) || 0.04
        });
      } else if (r.kind === 'ellipse') {
        shapes.push({
          id: nextId('svg_ell'),
          type: 'ellipse',
          name: r.name,
          cx: mapX(r.cx),
          cy: mapY(r.cy),
          rx: Math.max(0.004, mapLen(r.rx)),
          ry: Math.max(0.004, mapLen(r.ry)),
          rotation: 0,
          visible: true,
          locked: false,
          fill: Boolean(r.fill),
          stroke: Boolean(r.stroke),
          strokeWeight: Math.max(0.005, mapLen(r.strokeW || 0)) || 0.04
        });
      } else if (r.kind === 'line') {
        shapes.push({
          id: nextId('svg_line'),
          type: 'line',
          name: r.name,
          x1: mapX(r.x1),
          y1: mapY(r.y1),
          x2: mapX(r.x2),
          y2: mapY(r.y2),
          visible: true,
          locked: false,
          fill: false,
          stroke: true,
          strokeWeight: Math.max(0.005, mapLen(r.strokeW || 1)),
          strokeCap: r.strokeCap || 'butt'
        });
      } else if (r.kind === 'paper' && r.item) {
        // Transform Paper item directly into PAPER_SCALE [-500, 500] space so paperItemToPathShape normalizes cleanly
        const pScale = normScale * PAPER_SCALE;
        const normMatrix = new scope.Matrix(pScale, 0, 0, pScale, -vbCx * pScale, -vbCy * pScale);
        r.item.transform(normMatrix);
        if (r.item.className === 'CompoundPath' && typeof r.item.reorient === 'function') {
          r.item.reorient(false, true);
        }

        const children = r.item.className === 'CompoundPath' ? (r.item.children || []) : [r.item];
        const validContours = [];
        let anyClosed = false;

        for (const ch of children) {
          if (!ch || !ch.segments) continue;
          const minPts = ch.closed ? 3 : 2;
          if (ch.segments.length >= minPts) {
            if (ch.closed) anyClosed = true;
            validContours.push(paperSegmentsToNodes(ch, 1 / PAPER_SCALE));
          }
        }

        if (validContours.length > 0) {
          shapes.push({
            id: nextId('svg_path'),
            type: 'path',
            name: r.name,
            closed: anyClosed,
            fillRule: r.fillRule === 'nonzero' ? 'nonzero' : 'evenodd',
            contours: validContours,
            visible: true,
            locked: false,
            fill: Boolean(r.fill),
            stroke: Boolean(r.stroke),
            strokeWeight: Math.max(0.005, mapLen(r.strokeW || 1)) || 0.04
          });
        }
      }
    }

    if (shapes.length === 0) {
      return { ok: false, error: 'As formas do SVG são degeneradas ou vazias.', shapes: [], viewBox: vb };
    }

    return { ok: true, shapes, viewBox: vb };
  }

  // ==========================================================================
  // 7. Clean Unitary Subtile SVG Export
  // ==========================================================================

  /**
   * Exports a standalone unitary `.svg` string for a subtile family (master or D4 variant).
   *
   * @param {Object} familyDoc - `{ name, clipToTile, shapes }`
   * @param {Object} [options]
   * @param {number} [options.size=1000] - ViewBox side in SVG units.
   * @param {string} [options.transform='id'] - Optional D4 orientation ('id', 'r90', ...).
   * @param {string} [options.fgColor='#111827'] - Foreground vector color.
   * @param {string} [options.bgColor] - Optional background color when `includeBackground: true`.
   * @param {boolean} [options.includeBackground=false]
   * @param {number} [options.paddingRatio=0]
   * @returns {string} Valid UTF-8 SVG document string.
   */
  function exportFamilyToSVG(familyDoc, options = {}) {
    const { d4, vr, SimpleSVG } = resolveDeps();
    if (!SimpleSVG || !vr) return '';

    const size = Math.max(64, Math.round(Number(options.size) || 1000));
    const transform = options.transform || 'id';
    const fgColor = options.fgColor || '#111827';
    const padPx = size * Math.max(0, Math.min(0.45, Number(options.paddingRatio) || 0));

    const svg = new SimpleSVG(size, size);

    if (options.includeBackground && options.bgColor) {
      svg.push();
      svg.noStroke();
      svg.fill(options.bgColor);
      svg.rect(0, 0, size, size);
      svg.pop();
    }

    const visibleShapes = ((familyDoc && familyDoc.shapes) || []).filter((s) => s && s.visible !== false);
    if (visibleShapes.length > 0) {
      svg.push();
      svg.translate(size / 2, size / 2);
      if (d4 && transform !== 'id' && typeof d4.applyD4ToContext === 'function') {
        d4.applyD4ToContext(svg, transform);
      }
      vr.renderNormalizedShapes(
        svg,
        visibleShapes,
        size,
        size,
        padPx,
        fgColor,
        Boolean(familyDoc && familyDoc.clipToTile)
      );
      svg.pop();
    }

    let out = svg.toSVGString();
    // Tag optional background rect with data-tiling-role="bg" so round-trip import ignores background canvas
    if (options.includeBackground && options.bgColor) {
      out = out.replace('<rect ', '<rect data-tiling-role="bg" ');
    }
    return out;
  }

  const VectorBoolean = {
    PAPER_SCALE,
    BOOLEAN_OPS,
    getPaperScope,
    shapeToPaperItem,
    paperItemToPathShape,
    applyBooleanOp,
    transformSelectedShapesD4,
    reorderShapeZ,
    setShapeVisible,
    toggleShapeVisible,
    setShapeLocked,
    toggleShapeLocked,
    renameShape,
    parseTransformAttr,
    importSVGToShapes,
    exportFamilyToSVG
  };

  if (typeof window !== 'undefined') {
    window.VectorBoolean = VectorBoolean;
  }
  if (typeof global !== 'undefined' && global.window) {
    global.window.VectorBoolean = VectorBoolean;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VectorBoolean;
  }
})();

/**
 * core/vector_editor.js
 * Interactive normalized [-0.5, 0.5]^2 Vector Editor engine for Tiling Stripes Studio (Fase C).
 *
 * Provides:
 *  - Pure headless geometric operations (magnetic grid & smart snapping, exact shape bounds,
 *    parametric-to-Bezier path conversion, hit-testing, translate/scale/rotate, cell alignment/distribution,
 *    De Casteljau Bezier subdivision, node & tangent manipulation).
 *  - Per-family Undo/Redo stacks and internal shape clipboard.
 *  - Interactive state machine for tools:
 *      'select' (V), 'direct' (A), 'pen' (P), 'rect' (M), 'ellipse' (L),
 *      'polygon', 'arc', and 'line' (\).
 *  - Canvas overlay renderer for selection BBox, 8 resize handles + rotation handle,
 *    Bezier anchor/tangent handles, Pen rubber-band preview, marquee box, and snap crosshairs.
 */

(function () {
  const TWO_PI = Math.PI * 2;
  const HALF_PI = Math.PI / 2;
  const KAPPA = (4 / 3) * (Math.SQRT2 - 1);
  const MAX_HISTORY_PER_FAMILY = 80;

  const GRID_DIVISIONS = [0, 2, 3, 4, 6, 8, 12, 16];

  const VECTOR_TOOLS = [
    { id: 'select', label: 'Seleção', shortcut: 'V' },
    { id: 'direct', label: 'Nós (Direta)', shortcut: 'A' },
    { id: 'pen', label: 'Caneta Bezier', shortcut: 'P' },
    { id: 'rect', label: 'Retângulo', shortcut: 'M' },
    { id: 'ellipse', label: 'Elipse', shortcut: 'L' },
    { id: 'polygon', label: 'Polígono / Estrela', shortcut: 'G' },
    { id: 'arc', label: 'Arco / Fita', shortcut: 'U' },
    { id: 'line', label: 'Linha', shortcut: '\\' }
  ];

  function resolveDeps() {
    const win = (typeof window !== 'undefined' && window) ||
      (typeof global !== 'undefined' && global.window) ||
      null;

    let d4 = win && win.D4Symmetry;
    let vr = win && win.VectorRenderer;
    let det = win && win.D4Detect;

    if (typeof require === 'function') {
      if (!d4) {
        require('./d4_symmetry.js');
        d4 = win && win.D4Symmetry;
      }
      if (!vr) vr = require('./vector_renderer.js');
      if (!det) det = require('./d4_detect.js');
    }
    return { win, d4, vr, det };
  }

  let uidCounter = 1;
  function nextShapeId(prefix = 'sh') {
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

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function rotatePoint2D(x, y, cx, cy, angle) {
    if (!angle) return [x, y];
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  }

  // ==========================================================================
  // 1. Magnetic Grid & Smart Snapping in [-0.5, 0.5]^2
  // ==========================================================================

  function buildSnapAxisTargets(gridDiv = 6, snapPorts = true, extraValues = []) {
    const targets = new Set([-0.5, 0, 0.5]);
    if (snapPorts) {
      targets.add(-1 / 3);
      targets.add(-1 / 6);
      targets.add(1 / 6);
      targets.add(1 / 3);
    }
    const div = Number(gridDiv) || 0;
    if (div >= 2) {
      for (let k = 0; k <= div; k++) {
        targets.add(-0.5 + k / div);
      }
    }
    if (Array.isArray(extraValues)) {
      for (const v of extraValues) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          targets.add(v);
        }
      }
    }
    return Array.from(targets);
  }

  function snapScalar(val, candidates, threshold = 0.026) {
    let best = val;
    let bestDist = threshold;
    let snapped = false;
    let guide = null;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const d = Math.abs(val - c);
      if (d <= bestDist) {
        bestDist = d;
        best = c;
        snapped = true;
        guide = c;
      }
    }
    return { value: roundCoord(best), snapped, guide };
  }

  /**
   * Snaps a normalized point (u, v) to magnetic grid, cell edges/center, 1/3 ports, and object vertices.
   */
  function snapPoint(u, v, options = {}) {
    if (options.enabled === false) {
      return {
        u: roundCoord(u),
        v: roundCoord(v),
        snappedX: false,
        snappedY: false,
        guideX: null,
        guideY: null
      };
    }

    const threshold = typeof options.threshold === 'number' ? options.threshold : 0.026;
    const gridDiv = options.gridDiv !== undefined ? options.gridDiv : 6;
    const snapPorts = options.snapPorts !== false;
    const objPts = Array.isArray(options.objectPoints) ? options.objectPoints : [];

    // 1. Priority check: exact 2D point snap to existing object anchors/centers or cell corners/center
    const priorityPoints = [
      [0, 0],
      [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5],
      [0, -0.5], [0, 0.5], [-0.5, 0], [0.5, 0],
      ...objPts
    ];
    let bestPt = null;
    let bestPtDist = threshold * 1.15;
    for (const [px, py] of priorityPoints) {
      const dist = Math.hypot(u - px, v - py);
      if (dist <= bestPtDist) {
        bestPtDist = dist;
        bestPt = [px, py];
      }
    }
    if (bestPt) {
      return {
        u: roundCoord(bestPt[0]),
        v: roundCoord(bestPt[1]),
        snappedX: true,
        snappedY: true,
        guideX: roundCoord(bestPt[0]),
        guideY: roundCoord(bestPt[1])
      };
    }

    // 2. Axis-independent snap against grid divisions, ports, and object X/Y coordinates
    const extraX = objPts.map((p) => p[0]);
    const extraY = objPts.map((p) => p[1]);
    const xTargets = buildSnapAxisTargets(gridDiv, snapPorts, extraX);
    const yTargets = buildSnapAxisTargets(gridDiv, snapPorts, extraY);

    const sx = snapScalar(u, xTargets, threshold);
    const sy = snapScalar(v, yTargets, threshold);

    return {
      u: sx.value,
      v: sy.value,
      snappedX: sx.snapped,
      snappedY: sy.snapped,
      guideX: sx.guide,
      guideY: sy.guide
    };
  }

  function extractObjectSnapPoints(shapes, excludeIds = null) {
    const { vr } = resolveDeps();
    const pts = [];
    if (!Array.isArray(shapes)) return pts;
    const skip = excludeIds instanceof Set ? excludeIds : new Set(excludeIds || []);

    for (const sh of shapes) {
      if (!sh || sh.visible === false || skip.has(sh.id)) continue;
      const b = computeShapeBounds(sh);
      if (b) {
        pts.push([b.cx, b.cy], [b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]);
      }
      if (sh.type === 'line') {
        pts.push([Number(sh.x1) || 0, Number(sh.y1) || 0], [Number(sh.x2) || 0, Number(sh.y2) || 0]);
      } else if (sh.type === 'arc') {
        pts.push([Number(sh.cx) || 0, Number(sh.cy) || 0]);
      } else if (sh.type === 'path' && vr) {
        const contours = vr.getNormalizedPathContours(sh);
        for (const nodes of contours) {
          for (const n of nodes) {
            pts.push([Number(n.x) || 0, Number(n.y) || 0]);
          }
        }
      }
    }
    return pts;
  }

  // ==========================================================================
  // 2. Bezier Math, Tessellation & Exact Bounding Boxes
  // ==========================================================================

  function evalCubic1D(p0, c1, c2, p1, t) {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * c1 + 3 * mt * t * t * c2 + t * t * t * p1;
  }

  function evalCubic2D(p0x, p0y, c1x, c1y, c2x, c2y, p1x, p1y, t) {
    return [
      evalCubic1D(p0x, c1x, c2x, p1x, t),
      evalCubic1D(p0y, c1y, c2y, p1y, t)
    ];
  }

  /**
   * Exact De Casteljau subdivision of a cubic Bezier segment at parameter t in (0, 1).
   */
  function splitCubicBezier(p0, c1, c2, p1, t = 0.5) {
    const lerp = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
    const q0 = lerp(p0, c1, t);
    const q1 = lerp(c1, c2, t);
    const q2 = lerp(c2, p1, t);
    const r0 = lerp(q0, q1, t);
    const r1 = lerp(q1, q2, t);
    const s = lerp(r0, r1, t);
    return {
      left: [p0, q0, r0, s],
      right: [s, r1, q2, p1],
      mid: s
    };
  }

  function sampleContourPoints(nodes, closed, stepsPerCurve = 20) {
    const pts = [];
    if (!Array.isArray(nodes) || nodes.length === 0) return pts;
    const segCount = closed ? nodes.length : Math.max(0, nodes.length - 1);
    if (segCount === 0) {
      pts.push([Number(nodes[0].x) || 0, Number(nodes[0].y) || 0]);
      return pts;
    }

    for (let i = 0; i < segCount; i++) {
      const curr = nodes[i];
      const next = nodes[(i + 1) % nodes.length];
      const x0 = Number(curr.x) || 0;
      const y0 = Number(curr.y) || 0;
      const x1 = Number(next.x) || 0;
      const y1 = Number(next.y) || 0;
      const hasOut = Array.isArray(curr.out) && (curr.out[0] !== 0 || curr.out[1] !== 0);
      const hasIn = Array.isArray(next.in) && (next.in[0] !== 0 || next.in[1] !== 0);

      pts.push([x0, y0]);
      if (hasOut || hasIn) {
        const c1x = x0 + (hasOut ? Number(curr.out[0]) || 0 : 0);
        const c1y = y0 + (hasOut ? Number(curr.out[1]) || 0 : 0);
        const c2x = x1 + (hasIn ? Number(next.in[0]) || 0 : 0);
        const c2y = y1 + (hasIn ? Number(next.in[1]) || 0 : 0);
        for (let s = 1; s < stepsPerCurve; s++) {
          pts.push(evalCubic2D(x0, y0, c1x, c1y, c2x, c2y, x1, y1, s / stepsPerCurve));
        }
      }
    }
    if (!closed) {
      const last = nodes[nodes.length - 1];
      pts.push([Number(last.x) || 0, Number(last.y) || 0]);
    }
    return pts;
  }

  function boundsFromPointList(pts) {
    if (!pts || pts.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    if (!Number.isFinite(minX)) return null;
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2
    };
  }

  /**
   * Computes exact normalized axis-aligned bounding box of any vector shape.
   */
  function computeShapeBounds(shape) {
    if (!shape) return null;
    const { vr } = resolveDeps();

    switch (shape.type) {
      case 'rect': {
        const x = Number(shape.x) || 0;
        const y = Number(shape.y) || 0;
        const w = Number(shape.w) || 0;
        const h = Number(shape.h) || 0;
        const rot = Number(shape.rotation) || 0;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const corners = [
          rotatePoint2D(x, y, cx, cy, rot),
          rotatePoint2D(x + w, y, cx, cy, rot),
          rotatePoint2D(x + w, y + h, cx, cy, rot),
          rotatePoint2D(x, y + h, cx, cy, rot)
        ];
        return boundsFromPointList(corners);
      }

      case 'ellipse': {
        const cx = Number(shape.cx) || 0;
        const cy = Number(shape.cy) || 0;
        const rx = Math.abs(Number(shape.rx) || 0);
        const ry = Math.abs(Number(shape.ry ?? rx) || 0);
        const rot = Number(shape.rotation) || 0;
        if (!rot) {
          return boundsFromPointList([[cx - rx, cy - ry], [cx + rx, cy + ry]]);
        }
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const ex = Math.hypot(rx * c, ry * s);
        const ey = Math.hypot(rx * s, ry * c);
        return boundsFromPointList([[cx - ex, cy - ey], [cx + ex, cy + ey]]);
      }

      case 'line': {
        return boundsFromPointList([
          [Number(shape.x1) || 0, Number(shape.y1) || 0],
          [Number(shape.x2) || 0, Number(shape.y2) || 0]
        ]);
      }

      case 'triangle': {
        const pts = Array.isArray(shape.points) && shape.points.length === 3
          ? shape.points
          : [
              [Number(shape.x1) || 0, Number(shape.y1) || 0],
              [Number(shape.x2) || 0, Number(shape.y2) || 0],
              [Number(shape.x3) || 0, Number(shape.y3) || 0]
            ];
        return boundsFromPointList(pts);
      }

      case 'polygon': {
        const pts = Array.isArray(shape.points) && shape.points.length >= 3
          ? shape.points
          : (vr ? vr.buildPolygonVertices(shape) : []);
        return boundsFromPointList(pts);
      }

      case 'arc': {
        const cx = Number(shape.cx) || 0;
        const cy = Number(shape.cy) || 0;
        const rx = Math.abs(Number(shape.rx) || 0);
        const ry = Math.abs(Number(shape.ry ?? rx) || 0);
        const innerRatio = clamp(Number(shape.innerRatio) || 0, 0, 0.999);
        const start = Number(shape.start) || 0;
        const end = Number(shape.end) || 0;
        let sweep = end - start;
        while (sweep <= 0) sweep += TWO_PI;
        if (sweep > TWO_PI) sweep = TWO_PI;

        const pts = [];
        const steps = 32;
        for (let i = 0; i <= steps; i++) {
          const a = start + (sweep * i) / steps;
          pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
          if (innerRatio > 0) {
            pts.push([cx + Math.cos(a) * rx * innerRatio, cy + Math.sin(a) * ry * innerRatio]);
          }
        }
        if (innerRatio === 0 && (shape.mode || 'pie') === 'pie') {
          pts.push([cx, cy]);
        }
        return boundsFromPointList(pts);
      }

      case 'path': {
        const contours = vr ? vr.getNormalizedPathContours(shape) : [];
        const closed = shape.closed !== false;
        const allPts = [];
        for (const nodes of contours) {
          const sampled = sampleContourPoints(nodes, closed, 20);
          for (const p of sampled) allPts.push(p);
        }
        return boundsFromPointList(allPts);
      }

      default:
        return null;
    }
  }

  function computeSelectionBounds(shapes) {
    if (!Array.isArray(shapes) || shapes.length === 0) return null;
    const pts = [];
    for (const sh of shapes) {
      const b = computeShapeBounds(sh);
      if (b) {
        pts.push([b.minX, b.minY], [b.maxX, b.maxY]);
      }
    }
    return boundsFromPointList(pts);
  }

  // ==========================================================================
  // 3. Parametric-to-Bezier Path Conversion (convertShapeToPath)
  // ==========================================================================

  /**
   * Builds cubic Bezier nodes approximating an elliptical arc [aStart, aStart + sweep].
   */
  function buildEllipticalArcNodes(cx, cy, rx, ry, aStart, sweep) {
    const segs = Math.max(1, Math.ceil(Math.abs(sweep) / HALF_PI));
    const delta = sweep / segs;
    const alpha = (4 / 3) * Math.tan(delta / 4);
    const nodes = [];

    for (let i = 0; i <= segs; i++) {
      const a = aStart + i * delta;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      const x = roundCoord(cx + rx * cosA);
      const y = roundCoord(cy + ry * sinA);
      // Derivative d/da (cx + rx cos a, cy + ry sin a) = (-rx sin a, ry cos a)
      const tx = -rx * sinA * alpha;
      const ty = ry * cosA * alpha;

      const node = { x, y };
      if (i > 0) {
        node.in = [roundCoord(-tx), roundCoord(-ty)];
      }
      if (i < segs) {
        node.out = [roundCoord(tx), roundCoord(ty)];
      }
      nodes.push(node);
    }
    return nodes;
  }

  /**
   * Converts any parametric shape ('rect', 'ellipse', 'polygon', 'triangle', 'line', 'arc')
   * into an editable cubic Bezier 'path' preserving style, rotation, and geometry.
   */
  function convertShapeToPath(shape) {
    if (!shape) return null;
    if (shape.type === 'path') {
      const cloned = deepClone(shape);
      if (!Array.isArray(cloned.contours) && Array.isArray(cloned.nodes)) {
        cloned.contours = [cloned.nodes];
        delete cloned.nodes;
      }
      return cloned;
    }

    const { vr } = resolveDeps();
    const base = {
      id: shape.id || nextShapeId('path'),
      type: 'path',
      name: shape.name || 'Caminho',
      fill: shape.fill !== false,
      stroke: Boolean(shape.stroke),
      strokeWeight: typeof shape.strokeWeight === 'number' ? shape.strokeWeight : 0.08,
      strokeCap: shape.strokeCap || 'round',
      strokeJoin: shape.strokeJoin || 'round',
      fillRule: shape.fillRule || 'evenodd',
      closed: true,
      visible: shape.visible !== false,
      locked: Boolean(shape.locked),
      contours: []
    };

    switch (shape.type) {
      case 'rect': {
        const rawW = Number(shape.w) || 0;
        const rawH = Number(shape.h) || 0;
        const w = Math.abs(rawW);
        const h = Math.abs(rawH);
        const x = rawW >= 0 ? (Number(shape.x) || 0) : (Number(shape.x) || 0) + rawW;
        const y = rawH >= 0 ? (Number(shape.y) || 0) : (Number(shape.y) || 0) + rawH;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rot = Number(shape.rotation) || 0;
        const r = clamp(Number(shape.radius) || 0, 0, Math.min(w, h) / 2);

        let nodes;
        if (r <= 1e-6) {
          nodes = [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h }
          ];
        } else {
          const k = r * KAPPA;
          nodes = [
            { x: x + r, y, in: [-k, 0], out: [0, 0] },
            { x: x + w - r, y, in: [0, 0], out: [k, 0] },
            { x: x + w, y: y + r, in: [0, -k], out: [0, 0] },
            { x: x + w, y: y + h - r, in: [0, 0], out: [0, k] },
            { x: x + w - r, y: y + h, in: [k, 0], out: [0, 0] },
            { x: x + r, y: y + h, in: [0, 0], out: [-k, 0] },
            { x, y: y + h - r, in: [0, k], out: [0, 0] },
            { x, y: y + r, in: [0, 0], out: [0, -k] }
          ];
          // Fix corner tangents: arc sits between pair (1->2), (3->4), (5->6), (7->0)
          nodes[0].in = [-k, 0];
          nodes[7].out = [0, -k];
        }

        if (rot) {
          nodes = nodes.map((nd) => {
            const [rx, ry] = rotatePoint2D(nd.x, nd.y, cx, cy, rot);
            const outNd = { x: roundCoord(rx), y: roundCoord(ry) };
            if (nd.in) {
              const [ix, iy] = rotatePoint2D(nd.in[0], nd.in[1], 0, 0, rot);
              outNd.in = [roundCoord(ix), roundCoord(iy)];
            }
            if (nd.out) {
              const [ox, oy] = rotatePoint2D(nd.out[0], nd.out[1], 0, 0, rot);
              outNd.out = [roundCoord(ox), roundCoord(oy)];
            }
            return outNd;
          });
        } else {
          nodes = nodes.map((nd) => ({
            ...nd,
            x: roundCoord(nd.x),
            y: roundCoord(nd.y)
          }));
        }
        base.contours = [nodes];
        return base;
      }

      case 'ellipse': {
        const cx = Number(shape.cx) || 0;
        const cy = Number(shape.cy) || 0;
        const rx = Math.abs(Number(shape.rx) || 0);
        const ry = Math.abs(Number(shape.ry ?? rx) || 0);
        const rot = Number(shape.rotation) || 0;
        const kx = rx * KAPPA;
        const ky = ry * KAPPA;

        let nodes = [
          { x: cx, y: cy - ry, in: [-kx, 0], out: [kx, 0] },
          { x: cx + rx, y: cy, in: [0, -ky], out: [0, ky] },
          { x: cx, y: cy + ry, in: [kx, 0], out: [-kx, 0] },
          { x: cx - rx, y: cy, in: [0, ky], out: [0, -ky] }
        ];

        if (rot) {
          nodes = nodes.map((nd) => {
            const [nx, ny] = rotatePoint2D(nd.x, nd.y, cx, cy, rot);
            const [ix, iy] = rotatePoint2D(nd.in[0], nd.in[1], 0, 0, rot);
            const [ox, oy] = rotatePoint2D(nd.out[0], nd.out[1], 0, 0, rot);
            return {
              x: roundCoord(nx),
              y: roundCoord(ny),
              in: [roundCoord(ix), roundCoord(iy)],
              out: [roundCoord(ox), roundCoord(oy)]
            };
          });
        }
        base.contours = [nodes];
        return base;
      }

      case 'triangle': {
        const pts = Array.isArray(shape.points) && shape.points.length === 3
          ? shape.points
          : [
              [Number(shape.x1) || 0, Number(shape.y1) || 0],
              [Number(shape.x2) || 0, Number(shape.y2) || 0],
              [Number(shape.x3) || 0, Number(shape.y3) || 0]
            ];
        base.contours = [pts.map(([px, py]) => ({ x: roundCoord(px), y: roundCoord(py) }))];
        return base;
      }

      case 'polygon': {
        const pts = Array.isArray(shape.points) && shape.points.length >= 3
          ? shape.points
          : (vr ? vr.buildPolygonVertices(shape) : []);
        base.contours = [pts.map(([px, py]) => ({ x: roundCoord(px), y: roundCoord(py) }))];
        return base;
      }

      case 'line': {
        base.closed = false;
        base.fill = false;
        base.stroke = true;
        base.strokeWeight = typeof shape.strokeWeight === 'number' ? shape.strokeWeight : 1 / 6;
        base.contours = [[
          { x: roundCoord(Number(shape.x1) || 0), y: roundCoord(Number(shape.y1) || 0) },
          { x: roundCoord(Number(shape.x2) || 0), y: roundCoord(Number(shape.y2) || 0) }
        ]];
        return base;
      }

      case 'arc': {
        const cx = Number(shape.cx) || 0;
        const cy = Number(shape.cy) || 0;
        const rx = Math.abs(Number(shape.rx) || 0);
        const ry = Math.abs(Number(shape.ry ?? rx) || 0);
        const innerRatio = clamp(Number(shape.innerRatio) || 0, 0, 0.999);
        const start = Number(shape.start) || 0;
        const end = Number(shape.end) || 0;
        let sweep = end - start;
        while (sweep <= 0) sweep += TWO_PI;
        if (sweep > TWO_PI) sweep = TWO_PI;

        const mode = shape.mode || 'pie';
        const outerNodes = buildEllipticalArcNodes(cx, cy, rx, ry, start, sweep);

        if (mode === 'open' && innerRatio === 0) {
          base.closed = false;
          base.fill = false;
          base.stroke = true;
          base.contours = [outerNodes];
          return base;
        }

        if (innerRatio > 0) {
          const innerNodes = buildEllipticalArcNodes(
            cx,
            cy,
            rx * innerRatio,
            ry * innerRatio,
            start + sweep,
            -sweep
          );
          base.closed = true;
          base.contours = [[...outerNodes, ...innerNodes]];
          return base;
        }

        if (mode === 'pie' && sweep < TWO_PI - 1e-5) {
          outerNodes.push({ x: roundCoord(cx), y: roundCoord(cy) });
        }
        base.closed = true;
        base.contours = [outerNodes];
        return base;
      }

      default:
        return base;
    }
  }

  // ==========================================================================
  // 4. Geometric Hit-Testing (Shapes, Segments & Handles)
  // ==========================================================================

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return { dist: Math.hypot(px - x1, py - y1), t: 0 };
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
    return {
      dist: Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)),
      t
    };
  }

  function pointInContours(px, py, contoursPolys, fillRule = 'evenodd') {
    let crossings = 0;
    let winding = 0;

    for (const poly of contoursPolys) {
      const n = poly.length;
      if (n < 3) continue;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];

        const cond = (yi > py) !== (yj > py);
        if (cond) {
          const xIntersect = xj + ((py - yj) * (xi - xj)) / (yi - yj);
          if (px < xIntersect) crossings++;
        }

        if (yj <= py) {
          if (yi > py && (xi - xj) * (py - yj) - (px - xj) * (yi - yj) > 0) {
            winding++;
          }
        } else if (yi <= py && (xi - xj) * (py - yj) - (px - xj) * (yi - yj) < 0) {
          winding--;
        }
      }
    }

    if (fillRule === 'nonzero') return winding !== 0;
    return (crossings % 2) === 1;
  }

  function hitTestShape(shape, u, v, tolerance = 0.022) {
    if (!shape || shape.visible === false || shape.locked) return false;
    const strokeBand = shape.stroke
      ? Math.max(tolerance, (Number(shape.strokeWeight) || 0.08) * 0.5 + tolerance * 0.5)
      : tolerance;

    if (shape.type === 'line') {
      const d = distToSegment(
        u, v,
        Number(shape.x1) || 0, Number(shape.y1) || 0,
        Number(shape.x2) || 0, Number(shape.y2) || 0
      );
      return d.dist <= strokeBand;
    }

    const asPath = shape.type === 'path' ? shape : convertShapeToPath(shape);
    if (!asPath) return false;
    const { vr } = resolveDeps();
    const contours = vr ? vr.getNormalizedPathContours(asPath) : (asPath.contours || []);
    const closed = asPath.closed !== false;
    const polys = contours.map((nodes) => sampleContourPoints(nodes, closed, 20));

    // Check stroke / outline proximity first
    for (const poly of polys) {
      if (poly.length === 0) continue;
      const segs = closed ? poly.length : poly.length - 1;
      for (let i = 0; i < segs; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        if (distToSegment(u, v, a[0], a[1], b[0], b[1]).dist <= strokeBand) {
          return true;
        }
      }
    }

    // Check filled interior if shape has fill and is closed
    if (closed && shape.fill !== false) {
      return pointInContours(u, v, polys, shape.fillRule || 'evenodd');
    }
    return false;
  }

  function hitTestShapesTopmost(shapes, u, v, tolerance = 0.022) {
    if (!Array.isArray(shapes)) return null;
    for (let i = shapes.length - 1; i >= 0; i--) {
      const sh = shapes[i];
      if (hitTestShape(sh, u, v, tolerance)) {
        return sh;
      }
    }
    return null;
  }

  function findClosestSegmentOnPath(pathShape, u, v) {
    const { vr } = resolveDeps();
    const contours = vr ? vr.getNormalizedPathContours(pathShape) : (pathShape.contours || []);
    const closed = pathShape.closed !== false;
    let best = null;

    contours.forEach((nodes, cIdx) => {
      const segCount = closed ? nodes.length : Math.max(0, nodes.length - 1);
      for (let i = 0; i < segCount; i++) {
        const curr = nodes[i];
        const next = nodes[(i + 1) % nodes.length];
        const x0 = Number(curr.x) || 0;
        const y0 = Number(curr.y) || 0;
        const x1 = Number(next.x) || 0;
        const y1 = Number(next.y) || 0;
        const hasOut = Array.isArray(curr.out) && (curr.out[0] !== 0 || curr.out[1] !== 0);
        const hasIn = Array.isArray(next.in) && (next.in[0] !== 0 || next.in[1] !== 0);

        if (hasOut || hasIn) {
          const c1x = x0 + (hasOut ? Number(curr.out[0]) || 0 : 0);
          const c1y = y0 + (hasOut ? Number(curr.out[1]) || 0 : 0);
          const c2x = x1 + (hasIn ? Number(next.in[0]) || 0 : 0);
          const c2y = y1 + (hasIn ? Number(next.in[1]) || 0 : 0);
          const steps = 28;
          let prevPt = [x0, y0];
          for (let s = 1; s <= steps; s++) {
            const tVal = s / steps;
            const curPt = evalCubic2D(x0, y0, c1x, c1y, c2x, c2y, x1, y1, tVal);
            const segHit = distToSegment(u, v, prevPt[0], prevPt[1], curPt[0], curPt[1]);
            const exactT = (s - 1 + segHit.t) / steps;
            if (!best || segHit.dist < best.dist) {
              best = { contourIdx: cIdx, segIdx: i, t: clamp(exactT, 0.05, 0.95), dist: segHit.dist };
            }
            prevPt = curPt;
          }
        } else {
          const segHit = distToSegment(u, v, x0, y0, x1, y1);
          if (!best || segHit.dist < best.dist) {
            best = { contourIdx: cIdx, segIdx: i, t: clamp(segHit.t, 0.05, 0.95), dist: segHit.dist };
          }
        }
      }
    });

    return best;
  }

  // ==========================================================================
  // 5. Pure Shape Transformations (Translate, Scale, Rotate, Align, Distribute)
  // ==========================================================================

  function translateShape(shape, du, dv) {
    if (!shape) return shape;
    const out = deepClone(shape);

    switch (out.type) {
      case 'rect':
        out.x = roundCoord((Number(out.x) || 0) + du);
        out.y = roundCoord((Number(out.y) || 0) + dv);
        break;

      case 'ellipse':
      case 'arc':
        out.cx = roundCoord((Number(out.cx) || 0) + du);
        out.cy = roundCoord((Number(out.cy) || 0) + dv);
        break;

      case 'polygon':
        if (Array.isArray(out.points)) {
          out.points = out.points.map(([px, py]) => [roundCoord(px + du), roundCoord(py + dv)]);
        } else {
          out.cx = roundCoord((Number(out.cx) || 0) + du);
          out.cy = roundCoord((Number(out.cy) || 0) + dv);
        }
        break;

      case 'triangle':
        if (Array.isArray(out.points)) {
          out.points = out.points.map(([px, py]) => [roundCoord(px + du), roundCoord(py + dv)]);
        } else {
          out.x1 = roundCoord((Number(out.x1) || 0) + du);
          out.y1 = roundCoord((Number(out.y1) || 0) + dv);
          out.x2 = roundCoord((Number(out.x2) || 0) + du);
          out.y2 = roundCoord((Number(out.y2) || 0) + dv);
          out.x3 = roundCoord((Number(out.x3) || 0) + du);
          out.y3 = roundCoord((Number(out.y3) || 0) + dv);
        }
        break;

      case 'line':
        out.x1 = roundCoord((Number(out.x1) || 0) + du);
        out.y1 = roundCoord((Number(out.y1) || 0) + dv);
        out.x2 = roundCoord((Number(out.x2) || 0) + du);
        out.y2 = roundCoord((Number(out.y2) || 0) + dv);
        break;

      case 'path': {
        const { vr } = resolveDeps();
        const contours = vr ? vr.getNormalizedPathContours(out) : (out.contours || []);
        out.contours = contours.map((nodes) =>
          nodes.map((nd) => ({
            ...nd,
            x: roundCoord((Number(nd.x) || 0) + du),
            y: roundCoord((Number(nd.y) || 0) + dv)
          }))
        );
        delete out.nodes;
        break;
      }

      default:
        break;
    }

    return out;
  }

  /**
   * Scales a shape from `oldBox` ({ minX, minY, width, height }) into `newBox` ({ minX, minY, width, height }).
   */
  function scaleShapeFromBox(shape, oldBox, newBox) {
    if (!shape || !oldBox || !newBox) return shape;
    const oldW = oldBox.width !== undefined ? oldBox.width : ((oldBox.maxX ?? 0) - (oldBox.minX ?? 0));
    const oldH = oldBox.height !== undefined ? oldBox.height : ((oldBox.maxY ?? 0) - (oldBox.minY ?? 0));
    const newW = newBox.width !== undefined ? newBox.width : ((newBox.maxX ?? 0) - (newBox.minX ?? 0));
    const newH = newBox.height !== undefined ? newBox.height : ((newBox.maxY ?? 0) - (newBox.minY ?? 0));
    const ow = Math.abs(oldW) < 1e-6 ? 1e-6 : oldW;
    const oh = Math.abs(oldH) < 1e-6 ? 1e-6 : oldH;
    const sx = newW / ow;
    const sy = newH / oh;

    const mapPt = (px, py) => [
      roundCoord(newBox.minX + (px - oldBox.minX) * sx),
      roundCoord(newBox.minY + (py - oldBox.minY) * sy)
    ];

    const out = deepClone(shape);
    const hasRot = Math.abs(Number(out.rotation) || 0) > 1e-6;
    const isUniform = Math.abs(Math.abs(sx) - Math.abs(sy)) < 1e-4;

    if (out.type === 'rect' && !hasRot) {
      const [x0, y0] = mapPt(Number(out.x) || 0, Number(out.y) || 0);
      const [x1, y1] = mapPt((Number(out.x) || 0) + (Number(out.w) || 0), (Number(out.y) || 0) + (Number(out.h) || 0));
      out.x = roundCoord(Math.min(x0, x1));
      out.y = roundCoord(Math.min(y0, y1));
      out.w = roundCoord(Math.max(0.005, Math.abs(x1 - x0)));
      out.h = roundCoord(Math.max(0.005, Math.abs(y1 - y0)));
      if (out.radius) {
        out.radius = roundCoord(out.radius * Math.min(Math.abs(sx), Math.abs(sy)));
      }
      return out;
    }

    if (out.type === 'ellipse' && (!hasRot || isUniform)) {
      const [ncx, ncy] = mapPt(Number(out.cx) || 0, Number(out.cy) || 0);
      out.cx = ncx;
      out.cy = ncy;
      out.rx = roundCoord(Math.max(0.005, Math.abs((Number(out.rx) || 0) * sx)));
      out.ry = roundCoord(Math.max(0.005, Math.abs((Number(out.ry ?? out.rx) || 0) * sy)));
      return out;
    }

    if (out.type === 'polygon' && !Array.isArray(out.points)) {
      const [ncx, ncy] = mapPt(Number(out.cx) || 0, Number(out.cy) || 0);
      out.cx = ncx;
      out.cy = ncy;
      out.rx = roundCoord(Math.max(0.005, Math.abs((Number(out.rx) || 0) * sx)));
      out.ry = roundCoord(Math.max(0.005, Math.abs((Number(out.ry ?? out.rx) || 0) * sy)));
      return out;
    }

    if (out.type === 'line') {
      const [nx1, ny1] = mapPt(Number(out.x1) || 0, Number(out.y1) || 0);
      const [nx2, ny2] = mapPt(Number(out.x2) || 0, Number(out.y2) || 0);
      out.x1 = nx1; out.y1 = ny1;
      out.x2 = nx2; out.y2 = ny2;
      return out;
    }

    if (out.type === 'arc' && sx > 0 && sy > 0) {
      const [ncx, ncy] = mapPt(Number(out.cx) || 0, Number(out.cy) || 0);
      out.cx = ncx;
      out.cy = ncy;
      out.rx = roundCoord(Math.max(0.005, Math.abs((Number(out.rx) || 0) * sx)));
      out.ry = roundCoord(Math.max(0.005, Math.abs((Number(out.ry ?? out.rx) || 0) * sy)));
      return out;
    }

    // General path or sheared/flipped rotated shape: convert to path and scale nodes & handles
    const pathForm = out.type === 'path' ? out : convertShapeToPath(out);
    const { vr } = resolveDeps();
    const contours = vr ? vr.getNormalizedPathContours(pathForm) : (pathForm.contours || []);
    pathForm.contours = contours.map((nodes) =>
      nodes.map((nd) => {
        const [nx, ny] = mapPt(Number(nd.x) || 0, Number(nd.y) || 0);
        const res = { ...nd, x: nx, y: ny };
        if (Array.isArray(nd.in)) {
          res.in = [roundCoord(nd.in[0] * sx), roundCoord(nd.in[1] * sy)];
        }
        if (Array.isArray(nd.out)) {
          res.out = [roundCoord(nd.out[0] * sx), roundCoord(nd.out[1] * sy)];
        }
        return res;
      })
    );
    delete pathForm.nodes;
    return pathForm;
  }

  /**
   * Rotates a shape around `(pivotX, pivotY)` by `deltaAngle` radians.
   */
  function rotateShapeAround(shape, pivotX, pivotY, deltaAngle) {
    if (!shape || Math.abs(deltaAngle) < 1e-9) return deepClone(shape);
    const out = deepClone(shape);

    switch (out.type) {
      case 'rect': {
        const w = Number(out.w) || 0;
        const h = Number(out.h) || 0;
        const cx = (Number(out.x) || 0) + w / 2;
        const cy = (Number(out.y) || 0) + h / 2;
        const [ncx, ncy] = rotatePoint2D(cx, cy, pivotX, pivotY, deltaAngle);
        out.x = roundCoord(ncx - w / 2);
        out.y = roundCoord(ncy - h / 2);
        out.rotation = roundCoord((Number(out.rotation) || 0) + deltaAngle);
        return out;
      }

      case 'ellipse': {
        const [ncx, ncy] = rotatePoint2D(Number(out.cx) || 0, Number(out.cy) || 0, pivotX, pivotY, deltaAngle);
        out.cx = roundCoord(ncx);
        out.cy = roundCoord(ncy);
        out.rotation = roundCoord((Number(out.rotation) || 0) + deltaAngle);
        return out;
      }

      case 'polygon': {
        if (Array.isArray(out.points)) {
          out.points = out.points.map(([px, py]) => {
            const [nx, ny] = rotatePoint2D(px, py, pivotX, pivotY, deltaAngle);
            return [roundCoord(nx), roundCoord(ny)];
          });
        } else {
          const [ncx, ncy] = rotatePoint2D(Number(out.cx) || 0, Number(out.cy) || 0, pivotX, pivotY, deltaAngle);
          out.cx = roundCoord(ncx);
          out.cy = roundCoord(ncy);
          out.rotation = roundCoord((Number(out.rotation) || 0) + deltaAngle);
        }
        return out;
      }

      case 'line': {
        const [nx1, ny1] = rotatePoint2D(Number(out.x1) || 0, Number(out.y1) || 0, pivotX, pivotY, deltaAngle);
        const [nx2, ny2] = rotatePoint2D(Number(out.x2) || 0, Number(out.y2) || 0, pivotX, pivotY, deltaAngle);
        out.x1 = roundCoord(nx1); out.y1 = roundCoord(ny1);
        out.x2 = roundCoord(nx2); out.y2 = roundCoord(ny2);
        return out;
      }

      case 'arc': {
        const rx = Math.abs(Number(out.rx) || 0);
        const ry = Math.abs(Number(out.ry ?? rx) || 0);
        if (Math.abs(rx - ry) < 1e-6) {
          const [ncx, ncy] = rotatePoint2D(Number(out.cx) || 0, Number(out.cy) || 0, pivotX, pivotY, deltaAngle);
          out.cx = roundCoord(ncx);
          out.cy = roundCoord(ncy);
          out.start = roundCoord((Number(out.start) || 0) + deltaAngle);
          out.end = roundCoord((Number(out.end) || 0) + deltaAngle);
          return out;
        }
        return rotateShapeAround(convertShapeToPath(out), pivotX, pivotY, deltaAngle);
      }

      default: {
        const pathForm = out.type === 'path' ? out : convertShapeToPath(out);
        const { vr } = resolveDeps();
        const contours = vr ? vr.getNormalizedPathContours(pathForm) : (pathForm.contours || []);
        pathForm.contours = contours.map((nodes) =>
          nodes.map((nd) => {
            const [nx, ny] = rotatePoint2D(Number(nd.x) || 0, Number(nd.y) || 0, pivotX, pivotY, deltaAngle);
            const res = { ...nd, x: roundCoord(nx), y: roundCoord(ny) };
            if (Array.isArray(nd.in)) {
              const [ix, iy] = rotatePoint2D(nd.in[0], nd.in[1], 0, 0, deltaAngle);
              res.in = [roundCoord(ix), roundCoord(iy)];
            }
            if (Array.isArray(nd.out)) {
              const [ox, oy] = rotatePoint2D(nd.out[0], nd.out[1], 0, 0, deltaAngle);
              res.out = [roundCoord(ox), roundCoord(oy)];
            }
            return res;
          })
        );
        delete pathForm.nodes;
        return pathForm;
      }
    }
  }

  /**
   * Aligns selected shapes to the normalized [-0.5, 0.5]^2 master cell boundaries or center.
   * Modes: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'
   */
  function alignShapesToCell(shapes, selectedIds, mode) {
    if (!Array.isArray(shapes)) return [];
    const sel = new Set(selectedIds || []);
    return shapes.map((sh) => {
      if (!sh || !sel.has(sh.id) || sh.locked) return deepClone(sh);
      const b = computeShapeBounds(sh);
      if (!b) return deepClone(sh);

      let du = 0;
      let dv = 0;
      switch (mode) {
        case 'left':    du = -0.5 - b.minX; break;
        case 'centerX': du = 0 - b.cx; break;
        case 'right':   du = 0.5 - b.maxX; break;
        case 'top':     dv = -0.5 - b.minY; break;
        case 'centerY': dv = 0 - b.cy; break;
        case 'bottom':  dv = 0.5 - b.maxY; break;
        default: break;
      }
      return translateShape(sh, du, dv);
    });
  }

  /**
   * Evenly distributes centers of 3+ selected shapes along 'horizontal' or 'vertical' axis.
   */
  function distributeShapes(shapes, selectedIds, axis = 'horizontal') {
    if (!Array.isArray(shapes)) return [];
    const sel = new Set(selectedIds || []);
    const entries = [];
    shapes.forEach((sh, idx) => {
      if (sh && sel.has(sh.id) && !sh.locked) {
        const b = computeShapeBounds(sh);
        if (b) entries.push({ idx, sh, bounds: b });
      }
    });
    if (entries.length < 3) return deepClone(shapes);

    const isH = axis === 'horizontal';
    entries.sort((a, b) => (isH ? a.bounds.cx - b.bounds.cx : a.bounds.cy - b.bounds.cy));
    const firstVal = isH ? entries[0].bounds.cx : entries[0].bounds.cy;
    const lastVal = isH ? entries[entries.length - 1].bounds.cx : entries[entries.length - 1].bounds.cy;
    const step = (lastVal - firstVal) / (entries.length - 1);

    const out = deepClone(shapes);
    entries.forEach((entry, k) => {
      const target = firstVal + k * step;
      const du = isH ? target - entry.bounds.cx : 0;
      const dv = isH ? 0 : target - entry.bounds.cy;
      out[entry.idx] = translateShape(entry.sh, du, dv);
    });
    return out;
  }

  // ==========================================================================
  // 6. Direct Node & Bezier Tangent Operations
  // ==========================================================================

  function normalizePathShape(shape) {
    const p = shape.type === 'path' ? deepClone(shape) : convertShapeToPath(shape);
    if (!Array.isArray(p.contours) && Array.isArray(p.nodes)) {
      p.contours = [p.nodes];
      delete p.nodes;
    }
    return p;
  }

  function movePathNodes(pathShape, nodeRefs, du, dv) {
    const out = normalizePathShape(pathShape);
    const keySet = new Set((nodeRefs || []).map((r) => `${r.contourIdx}:${r.nodeIdx}`));
    out.contours = out.contours.map((nodes, cIdx) =>
      nodes.map((nd, nIdx) => {
        if (!keySet.has(`${cIdx}:${nIdx}`)) return nd;
        return {
          ...nd,
          x: roundCoord((Number(nd.x) || 0) + du),
          y: roundCoord((Number(nd.y) || 0) + dv)
        };
      })
    );
    return out;
  }

  function setPathHandle(pathShape, contourIdx, nodeIdx, which, relDx, relDy, options = {}) {
    const out = normalizePathShape(pathShape);
    const contour = out.contours[contourIdx];
    if (!contour || !contour[nodeIdx]) return out;

    const nd = contour[nodeIdx];
    let dx = relDx;
    let dy = relDy;
    if (options.shiftKey) {
      const len = Math.hypot(dx, dy);
      const snappedA = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      dx = Math.cos(snappedA) * len;
      dy = Math.sin(snappedA) * len;
    }

    nd[which] = [roundCoord(dx), roundCoord(dy)];

    // Coupled mirror handle unless Alt is held (which breaks tangent continuity for sharp cusps)
    if (options.coupled !== false && !options.altKey) {
      const opp = which === 'out' ? 'in' : 'out';
      if (Array.isArray(nd[opp])) {
        const oppLen = Math.hypot(nd[opp][0], nd[opp][1]);
        const curLen = Math.hypot(dx, dy);
        if (oppLen > 1e-6 && curLen > 1e-6) {
          const scale = options.symmetricLength ? 1 : (oppLen / curLen);
          nd[opp] = [roundCoord(-dx * scale), roundCoord(-dy * scale)];
        } else if (options.symmetricLength) {
          nd[opp] = [roundCoord(-dx), roundCoord(-dy)];
        }
      }
    }
    return out;
  }

  function togglePathNodeSmooth(pathShape, contourIdx, nodeIdx) {
    const out = normalizePathShape(pathShape);
    const contour = out.contours[contourIdx];
    if (!contour || !contour[nodeIdx]) return out;

    const nd = contour[nodeIdx];
    const hasHandles = (Array.isArray(nd.in) && (Math.abs(nd.in[0]) > 1e-5 || Math.abs(nd.in[1]) > 1e-5)) ||
      (Array.isArray(nd.out) && (Math.abs(nd.out[0]) > 1e-5 || Math.abs(nd.out[1]) > 1e-5));

    if (hasHandles) {
      delete nd.in;
      delete nd.out;
    } else {
      const n = contour.length;
      const prev = contour[(nodeIdx - 1 + n) % n];
      const next = contour[(nodeIdx + 1) % n];
      const vx = ((Number(next.x) || 0) - (Number(prev.x) || 0)) * 0.25;
      const vy = ((Number(next.y) || 0) - (Number(prev.y) || 0)) * 0.25;
      const fallbackX = Math.abs(vx) < 1e-5 && Math.abs(vy) < 1e-5 ? 0.12 : vx;
      nd.in = [roundCoord(-fallbackX), roundCoord(-vy)];
      nd.out = [roundCoord(fallbackX), roundCoord(vy)];
    }
    return out;
  }

  function subdividePathSegment(pathShape, contourIdx, segIdx, t = 0.5) {
    const out = normalizePathShape(pathShape);
    const contour = out.contours[contourIdx];
    if (!contour || contour.length < 2) return out;
    const closed = out.closed !== false;
    const maxSeg = closed ? contour.length - 1 : contour.length - 2;
    if (segIdx < 0 || segIdx > maxSeg) return out;

    const nextIdx = (segIdx + 1) % contour.length;
    const curr = contour[segIdx];
    const next = contour[nextIdx];
    const p0 = [Number(curr.x) || 0, Number(curr.y) || 0];
    const p1 = [Number(next.x) || 0, Number(next.y) || 0];
    const hasOut = Array.isArray(curr.out) && (curr.out[0] !== 0 || curr.out[1] !== 0);
    const hasIn = Array.isArray(next.in) && (next.in[0] !== 0 || next.in[1] !== 0);

    if (!hasOut && !hasIn) {
      const mx = roundCoord(p0[0] + (p1[0] - p0[0]) * t);
      const my = roundCoord(p0[1] + (p1[1] - p0[1]) * t);
      contour.splice(segIdx + 1, 0, { x: mx, y: my });
      return out;
    }

    const c1 = [p0[0] + (hasOut ? curr.out[0] : 0), p0[1] + (hasOut ? curr.out[1] : 0)];
    const c2 = [p1[0] + (hasIn ? next.in[0] : 0), p1[1] + (hasIn ? next.in[1] : 0)];
    const split = splitCubicBezier(p0, c1, c2, p1, t);

    curr.out = [roundCoord(split.left[1][0] - p0[0]), roundCoord(split.left[1][1] - p0[1])];
    next.in = [roundCoord(split.right[2][0] - p1[0]), roundCoord(split.right[2][1] - p1[1])];

    const newNode = {
      x: roundCoord(split.mid[0]),
      y: roundCoord(split.mid[1]),
      in: [roundCoord(split.left[2][0] - split.mid[0]), roundCoord(split.left[2][1] - split.mid[1])],
      out: [roundCoord(split.right[1][0] - split.mid[0]), roundCoord(split.right[1][1] - split.mid[1])]
    };
    contour.splice(segIdx + 1, 0, newNode);
    return out;
  }

  function deletePathNodes(pathShape, nodeRefs) {
    const out = normalizePathShape(pathShape);
    const delByContour = new Map();
    for (const ref of (nodeRefs || [])) {
      if (!delByContour.has(ref.contourIdx)) delByContour.set(ref.contourIdx, new Set());
      delByContour.get(ref.contourIdx).add(ref.nodeIdx);
    }

    const minNodes = out.closed !== false ? 3 : 2;
    const nextContours = [];
    out.contours.forEach((nodes, cIdx) => {
      const drop = delByContour.get(cIdx);
      const kept = drop ? nodes.filter((_n, idx) => !drop.has(idx)) : nodes;
      if (kept.length >= minNodes) {
        nextContours.push(kept);
      }
    });
    out.contours = nextContours;
    return nextContours.length > 0 ? out : null;
  }

  // ==========================================================================
  // 7. Parametric Shape Builders (Drag Creation & 1/3 Ribbon Presets)
  // ==========================================================================

  function createRectFromDrag(u0, v0, u1, v1, opts = {}) {
    let dx = u1 - u0;
    let dy = v1 - v0;
    if (opts.shiftKey) {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      dx = (dx < 0 ? -1 : 1) * m;
      dy = (dy < 0 ? -1 : 1) * m;
    }

    let x, y, w, h;
    if (opts.altKey) {
      w = Math.abs(dx) * 2;
      h = Math.abs(dy) * 2;
      x = u0 - w / 2;
      y = v0 - h / 2;
    } else {
      x = Math.min(u0, u0 + dx);
      y = Math.min(v0, v0 + dy);
      w = Math.abs(dx);
      h = Math.abs(dy);
    }

    return {
      id: opts.id || nextShapeId('rect'),
      type: 'rect',
      name: opts.name || 'Retângulo',
      x: roundCoord(x),
      y: roundCoord(y),
      w: roundCoord(Math.max(0.01, w)),
      h: roundCoord(Math.max(0.01, h)),
      radius: roundCoord(Math.max(0, Number(opts.radius) || 0)),
      rotation: 0,
      fill: opts.fill !== false,
      stroke: Boolean(opts.stroke),
      strokeWeight: typeof opts.strokeWeight === 'number' ? opts.strokeWeight : 0.08
    };
  }

  function createEllipseFromDrag(u0, v0, u1, v1, opts = {}) {
    let dx = u1 - u0;
    let dy = v1 - v0;
    if (opts.shiftKey) {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      dx = (dx < 0 ? -1 : 1) * m;
      dy = (dy < 0 ? -1 : 1) * m;
    }

    let cx, cy, rx, ry;
    if (opts.altKey) {
      cx = u0;
      cy = v0;
      rx = Math.abs(dx);
      ry = Math.abs(dy);
    } else {
      cx = u0 + dx / 2;
      cy = v0 + dy / 2;
      rx = Math.abs(dx) / 2;
      ry = Math.abs(dy) / 2;
    }

    return {
      id: opts.id || nextShapeId('ellipse'),
      type: 'ellipse',
      name: opts.name || 'Elipse',
      cx: roundCoord(cx),
      cy: roundCoord(cy),
      rx: roundCoord(Math.max(0.01, rx)),
      ry: roundCoord(Math.max(0.01, ry)),
      rotation: 0,
      fill: opts.fill !== false,
      stroke: Boolean(opts.stroke),
      strokeWeight: typeof opts.strokeWeight === 'number' ? opts.strokeWeight : 0.08
    };
  }

  function createPolygonFromDrag(u0, v0, u1, v1, opts = {}) {
    const dx = u1 - u0;
    const dy = v1 - v0;
    const r = Math.max(0.02, Math.hypot(dx, dy));
    let rot = Math.atan2(dy, dx) + HALF_PI;
    if (opts.shiftKey) {
      const step = Math.PI / 12; // 15°
      rot = Math.round(rot / step) * step;
    }
    const sides = clamp(Math.round(Number(opts.sides) || 5), 3, 16);
    const starRatio = Number(opts.starRatio) > 0 ? clamp(Number(opts.starRatio), 0.1, 0.95) : 0;

    const sh = {
      id: opts.id || nextShapeId('poly'),
      type: 'polygon',
      name: opts.name || (starRatio > 0 ? `Estrela (${sides})` : `Polígono (${sides})`),
      cx: roundCoord(u0),
      cy: roundCoord(v0),
      rx: roundCoord(r),
      ry: roundCoord(r),
      sides,
      rotation: roundCoord(rot),
      fill: opts.fill !== false,
      stroke: Boolean(opts.stroke),
      strokeWeight: typeof opts.strokeWeight === 'number' ? opts.strokeWeight : 0.08
    };
    if (starRatio > 0) sh.starRatio = roundCoord(starRatio);
    return sh;
  }

  function createLineFromDrag(u0, v0, u1, v1, opts = {}) {
    let x2 = u1;
    let y2 = v1;
    if (opts.shiftKey) {
      const dx = u1 - u0;
      const dy = v1 - v0;
      const len = Math.hypot(dx, dy);
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      x2 = u0 + Math.cos(a) * len;
      y2 = v0 + Math.sin(a) * len;
    }
    return {
      id: opts.id || nextShapeId('line'),
      type: 'line',
      name: opts.name || 'Linha',
      x1: roundCoord(u0),
      y1: roundCoord(v0),
      x2: roundCoord(x2),
      y2: roundCoord(y2),
      fill: false,
      stroke: true,
      strokeWeight: typeof opts.strokeWeight === 'number' ? roundCoord(opts.strokeWeight) : roundCoord(1 / 6),
      strokeCap: opts.strokeCap || 'butt'
    };
  }

  function createArcFromDrag(u0, v0, u1, v1, opts = {}) {
    const dx = u1 - u0;
    const dy = v1 - v0;
    const r = Math.max(0.04, Math.hypot(dx, dy));
    // Snap quadrant automatically based on direction from center (u0, v0) to cursor (u1, v1)
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += TWO_PI;
    const quad = Math.floor(angle / HALF_PI) % 4;
    const start = opts.start !== undefined ? Number(opts.start) : quad * HALF_PI;
    const sweep = opts.sweep !== undefined ? Number(opts.sweep) : HALF_PI;
    const innerRatio = opts.innerRatio !== undefined ? clamp(Number(opts.innerRatio), 0, 0.95) : 0.5;
    const mode = opts.mode || 'pie';

    return {
      id: opts.id || nextShapeId('arc'),
      type: 'arc',
      name: opts.name || (innerRatio > 0 ? 'Arco de Fita' : 'Setor Circular'),
      cx: roundCoord(u0),
      cy: roundCoord(v0),
      rx: roundCoord(r),
      ry: roundCoord(r),
      innerRatio: roundCoord(innerRatio),
      start: roundCoord(start),
      end: roundCoord(start + sweep),
      mode,
      fill: mode !== 'open',
      stroke: mode === 'open',
      strokeWeight: typeof opts.strokeWeight === 'number' ? opts.strokeWeight : 0.08
    };
  }

  function createRibbonPreset(presetId) {
    switch (presetId) {
      case 'stripe-h-1-3':
        return {
          id: nextShapeId('rect'),
          type: 'rect',
          name: 'Faixa 1/3 H',
          x: -0.5,
          y: roundCoord(-1 / 6),
          w: 1,
          h: roundCoord(1 / 3),
          radius: 0,
          rotation: 0,
          fill: true,
          stroke: false
        };
      case 'stripe-v-1-3':
        return {
          id: nextShapeId('rect'),
          type: 'rect',
          name: 'Faixa 1/3 V',
          x: roundCoord(-1 / 6),
          y: -0.5,
          w: roundCoord(1 / 3),
          h: 1,
          radius: 0,
          rotation: 0,
          fill: true,
          stroke: false
        };
      case 'curve-tl-1-3':
        return {
          id: nextShapeId('arc'),
          type: 'arc',
          name: 'Fita Curva 1/3',
          cx: -0.5,
          cy: -0.5,
          rx: roundCoord(2 / 3),
          ry: roundCoord(2 / 3),
          innerRatio: 0.5,
          start: 0,
          end: roundCoord(HALF_PI),
          mode: 'pie',
          fill: true,
          stroke: false
        };
      case 'quarter-pie-tl':
        return {
          id: nextShapeId('arc'),
          type: 'arc',
          name: 'Quarto Sólido',
          cx: -0.5,
          cy: -0.5,
          rx: 1,
          ry: 1,
          innerRatio: 0,
          start: 0,
          end: roundCoord(HALF_PI),
          mode: 'pie',
          fill: true,
          stroke: false
        };
      default:
        return null;
    }
  }

  // ==========================================================================
  // 8. Interactive Editor Session, Undo/Redo, Clipboard & State Machine
  // ==========================================================================

  const editorState = {
    activeTool: 'select', // 'select' | 'direct' | 'pen' | 'rect' | 'ellipse' | 'polygon' | 'arc' | 'line'
    snapEnabled: true,
    gridDiv: 6, // 0 (off), 2, 3, 4, 6, 8, 12, 16
    selectedShapeIds: [],
    selectedNodes: [], // [{ shapeId, contourIdx, nodeIdx }]
    activeSnapGuides: { guideX: null, guideY: null },
    clipboard: [],
    histories: new Map(), // familyId -> { entries: [{ shapes, clipToTile }], index: number }
    currentFamilyId: null,
    workingFamilyId: null,
    workingShapes: null, // live draft shapes during drag/pen
    dragOp: null, // active pointer drag operation
    penSession: null, // { familyId, nodes: [], draggingNewHandle: boolean, hoverU, hoverV, closeHover: boolean }
    toolDefaults: {
      rectRadius: 0,
      polygonSides: 6,
      polygonStarRatio: 0,
      arcInnerRatio: 0.5,
      arcMode: 'pie',
      lineWeight: roundCoord(1 / 6)
    }
  };

  function ensureFamilyHistory(familyId, currentDoc) {
    if (!familyId || !currentDoc) return null;
    let rec = editorState.histories.get(familyId);
    if (!rec) {
      rec = {
        entries: [{
          shapes: deepClone(currentDoc.shapes || []),
          clipToTile: Boolean(currentDoc.clipToTile)
        }],
        index: 0
      };
      editorState.histories.set(familyId, rec);
    }
    return rec;
  }

  function recordFamilySnapshot(familyId, shapes, clipToTile = false) {
    if (!familyId) return;
    let rec = editorState.histories.get(familyId);
    if (!rec) {
      rec = { entries: [], index: -1 };
      editorState.histories.set(familyId, rec);
    }
    if (rec.index < rec.entries.length - 1) {
      rec.entries = rec.entries.slice(0, rec.index + 1);
    }
    rec.entries.push({
      shapes: deepClone(shapes || []),
      clipToTile: Boolean(clipToTile)
    });
    if (rec.entries.length > MAX_HISTORY_PER_FAMILY) {
      rec.entries.shift();
    }
    rec.index = rec.entries.length - 1;
  }

  function canUndo(familyId, currentDoc) {
    const rec = ensureFamilyHistory(familyId, currentDoc);
    return Boolean(rec && rec.index > 0);
  }

  function canRedo(familyId, currentDoc) {
    const rec = ensureFamilyHistory(familyId, currentDoc);
    return Boolean(rec && rec.index >= 0 && rec.index < rec.entries.length - 1);
  }

  function stepUndo(familyId, currentDoc) {
    const rec = ensureFamilyHistory(familyId, currentDoc);
    if (!rec || rec.index <= 0) return null;
    rec.index--;
    return deepClone(rec.entries[rec.index]);
  }

  function stepRedo(familyId, currentDoc) {
    const rec = ensureFamilyHistory(familyId, currentDoc);
    if (!rec || rec.index >= rec.entries.length - 1) return null;
    rec.index++;
    return deepClone(rec.entries[rec.index]);
  }

  function clearHistoryForFamily(familyId) {
    if (familyId) editorState.histories.delete(familyId);
  }

  function copySelectedShapes(shapes, selectedIds) {
    const sel = new Set(selectedIds || []);
    const copied = (shapes || []).filter((s) => s && sel.has(s.id)).map((s) => deepClone(s));
    if (copied.length > 0) {
      editorState.clipboard = copied;
    }
    return deepClone(copied);
  }

  function pasteFromClipboard(shapes, offset = 1 / 18) {
    if (!editorState.clipboard || editorState.clipboard.length === 0) {
      return { shapes: deepClone(shapes || []), newIds: [] };
    }
    const next = deepClone(shapes || []);
    const newIds = [];
    for (const item of editorState.clipboard) {
      const moved = translateShape(item, offset, offset);
      moved.id = nextShapeId(moved.type || 'sh');
      moved.name = `${item.name || 'Forma'} Cópia`;
      next.push(moved);
      newIds.push(moved.id);
    }
    return { shapes: next, newIds };
  }

  function duplicateSelectedShapes(shapes, selectedIds, offset = 1 / 18) {
    const sel = new Set(selectedIds || []);
    const chosen = (shapes || []).filter((s) => s && sel.has(s.id));
    if (chosen.length === 0) {
      return { shapes: deepClone(shapes || []), newIds: [] };
    }
    const next = deepClone(shapes || []);
    const newIds = [];
    for (const item of chosen) {
      const moved = translateShape(item, offset, offset);
      moved.id = nextShapeId(moved.type || 'sh');
      moved.name = `${item.name || 'Forma'} Cópia`;
      next.push(moved);
      newIds.push(moved.id);
    }
    return { shapes: next, newIds };
  }

  // ==========================================================================
  // 9. Handle Geometry & Canvas Overlay Rendering
  // ==========================================================================

  function getBBoxHandlePositions(box, rotStalkNorm = 0.075) {
    if (!box) return [];
    const { minX, minY, maxX, maxY, cx, cy } = box;
    return [
      { id: 'nw', x: minX, y: minY },
      { id: 'n', x: cx, y: minY },
      { id: 'ne', x: maxX, y: minY },
      { id: 'e', x: maxX, y: cy },
      { id: 'se', x: maxX, y: maxY },
      { id: 's', x: cx, y: maxY },
      { id: 'sw', x: minX, y: maxY },
      { id: 'w', x: minX, y: cy },
      { id: 'rot', x: cx, y: minY - rotStalkNorm }
    ];
  }

  function computeResizedBox(startBox, handleId, u, v, shiftKey = false, altKey = false) {
    let { minX, minY, maxX, maxY } = startBox;
    const origW = Math.max(0.01, maxX - minX);
    const origH = Math.max(0.01, maxY - minY);
    const aspect = origW / origH;

    if (handleId.includes('w')) minX = u;
    if (handleId.includes('e')) maxX = u;
    if (handleId.includes('n')) minY = v;
    if (handleId.includes('s')) maxY = v;

    if (altKey) {
      if (handleId.includes('w')) maxX = startBox.cx + (startBox.cx - minX);
      if (handleId.includes('e')) minX = startBox.cx - (maxX - startBox.cx);
      if (handleId.includes('n')) maxY = startBox.cy + (startBox.cy - minY);
      if (handleId.includes('s')) minY = startBox.cy - (maxY - startBox.cy);
    }

    let nMinX = Math.min(minX, maxX);
    let nMaxX = Math.max(minX, maxX);
    let nMinY = Math.min(minY, maxY);
    let nMaxY = Math.max(minY, maxY);
    let nw = Math.max(0.01, nMaxX - nMinX);
    let nh = Math.max(0.01, nMaxY - nMinY);

    if (shiftKey) {
      if (handleId === 'n' || handleId === 's') {
        nw = nh * aspect;
        nMinX = startBox.cx - nw / 2;
        nMaxX = startBox.cx + nw / 2;
      } else if (handleId === 'e' || handleId === 'w') {
        nh = nw / aspect;
        nMinY = startBox.cy - nh / 2;
        nMaxY = startBox.cy + nh / 2;
      } else {
        if (nw / nh > aspect) {
          nw = nh * aspect;
        } else {
          nh = nw / aspect;
        }
        if (altKey) {
          nMinX = startBox.cx - nw / 2;
          nMaxX = startBox.cx + nw / 2;
          nMinY = startBox.cy - nh / 2;
          nMaxY = startBox.cy + nh / 2;
        } else {
          if (handleId.includes('w')) nMinX = startBox.maxX - nw;
          else nMaxX = startBox.minX + nw;
          if (handleId.includes('n')) nMinY = startBox.maxY - nh;
          else nMaxY = startBox.minY + nh;
        }
      }
    }

    return {
      minX: nMinX,
      minY: nMinY,
      maxX: nMaxX,
      maxY: nMaxY,
      width: Math.max(0.01, nMaxX - nMinX),
      height: Math.max(0.01, nMaxY - nMinY),
      cx: (nMinX + nMaxX) / 2,
      cy: (nMinY + nMaxY) / 2
    };
  }

  /**
   * Renders interactive VectorEditor overlays inside the translated/transformed Master Cell.
   * Called after `p.translate(cx, cy)` and `applyD4ToContext(p, selectedTransform)`.
   */
  function renderEditorOverlay(p, innerSide, shapes, isReadOnly = false) {
    if (!p || innerSide <= 8) return;
    const { vr } = resolveDeps();

    p.push();

    // 1. Active Magnetic Snap Crosshair Guides
    const { guideX, guideY } = editorState.activeSnapGuides;
    if (guideX !== null || guideY !== null) {
      p.stroke(244, 114, 182, 210);
      p.strokeWeight(1.1);
      if (p.drawingContext && typeof p.drawingContext.setLineDash === 'function') {
        p.drawingContext.setLineDash([3, 3]);
      }
      const half = innerSide * 0.56;
      if (guideX !== null) {
        const gx = guideX * innerSide;
        p.line(gx, -half, gx, half);
      }
      if (guideY !== null) {
        const gy = guideY * innerSide;
        p.line(-half, gy, half, gy);
      }
      if (p.drawingContext && typeof p.drawingContext.setLineDash === 'function') {
        p.drawingContext.setLineDash([]);
      }
    }

    if (isReadOnly) {
      p.pop();
      return;
    }

    const selSet = new Set(editorState.selectedShapeIds);
    const selectedShapes = (shapes || []).filter((s) => s && selSet.has(s.id) && s.visible !== false);

    // 2. Select Mode ('select'): Bounding Box, 8 Resize Handles & Rotation Stalk
    if (editorState.activeTool === 'select' && selectedShapes.length > 0) {
      const box = computeSelectionBounds(selectedShapes);
      if (box) {
        const bx = box.minX * innerSide;
        const by = box.minY * innerSide;
        const bw = box.width * innerSide;
        const bh = box.height * innerSide;

        p.noFill();
        p.stroke(56, 189, 248, 225);
        p.strokeWeight(1.3);
        p.rect(bx, by, bw, bh);

        const stalkNorm = Math.max(0.055, 22 / Math.max(100, innerSide));
        const handles = getBBoxHandlePositions(box, stalkNorm);
        const topHandle = handles.find((h) => h.id === 'n');
        const rotHandle = handles.find((h) => h.id === 'rot');
        if (topHandle && rotHandle) {
          p.stroke(56, 189, 248, 190);
          p.line(topHandle.x * innerSide, topHandle.y * innerSide, rotHandle.x * innerSide, rotHandle.y * innerSide);
        }

        const hs = 6.5;
        for (const h of handles) {
          const hx = h.x * innerSide;
          const hy = h.y * innerSide;
          if (h.id === 'rot') {
            p.fill(16, 185, 129);
            p.stroke(255);
            p.strokeWeight(1.2);
            p.ellipse(hx, hy, hs + 2, hs + 2);
          } else {
            p.fill(15, 23, 42);
            p.stroke(56, 189, 248);
            p.strokeWeight(1.4);
            p.rect(hx - hs / 2, hy - hs / 2, hs, hs);
          }
        }
      }
    }

    // 3. Direct Node Mode ('direct'): Path Contours, Bezier Tangents & Anchor Nodes
    if (editorState.activeTool === 'direct' && selectedShapes.length > 0) {
      const selNodeKeys = new Set(
        editorState.selectedNodes.map((r) => `${r.shapeId}:${r.contourIdx}:${r.nodeIdx}`)
      );

      for (const sh of selectedShapes) {
        const asPath = sh.type === 'path' ? sh : convertShapeToPath(sh);
        const contours = vr ? vr.getNormalizedPathContours(asPath) : (asPath.contours || []);
        const closed = asPath.closed !== false;

        // Subtle cyan wireframe over the editable contour
        p.noFill();
        p.stroke(56, 189, 248, 175);
        p.strokeWeight(1.1);
        for (const nodes of contours) {
          const sampled = sampleContourPoints(nodes, closed, 20);
          if (sampled.length >= 2) {
            p.beginShape();
            for (const [sx, sy] of sampled) {
              p.vertex(sx * innerSide, sy * innerSide);
            }
            if (closed) p.endShape(p.CLOSE);
            else p.endShape();
          }
        }

        contours.forEach((nodes, cIdx) => {
          nodes.forEach((nd, nIdx) => {
            const ax = (Number(nd.x) || 0) * innerSide;
            const ay = (Number(nd.y) || 0) * innerSide;
            const isNodeSel = selNodeKeys.has(`${sh.id}:${cIdx}:${nIdx}`);

            // Draw Bezier handles when shape is a true path
            if (sh.type === 'path') {
              if (Array.isArray(nd.in) && (Math.abs(nd.in[0]) > 1e-5 || Math.abs(nd.in[1]) > 1e-5)) {
                const ix = ax + nd.in[0] * innerSide;
                const iy = ay + nd.in[1] * innerSide;
                p.stroke(245, 158, 11, 210);
                p.strokeWeight(1.1);
                p.line(ax, ay, ix, iy);
                p.fill(245, 158, 11);
                p.noStroke();
                p.ellipse(ix, iy, 5.5, 5.5);
              }
              if (Array.isArray(nd.out) && (Math.abs(nd.out[0]) > 1e-5 || Math.abs(nd.out[1]) > 1e-5)) {
                const ox = ax + nd.out[0] * innerSide;
                const oy = ay + nd.out[1] * innerSide;
                p.stroke(245, 158, 11, 210);
                p.strokeWeight(1.1);
                p.line(ax, ay, ox, oy);
                p.fill(245, 158, 11);
                p.noStroke();
                p.ellipse(ox, oy, 5.5, 5.5);
              }
            }

            if (isNodeSel) {
              p.stroke(255);
              p.strokeWeight(1.4);
              p.fill(59, 130, 246);
            } else {
              p.stroke(56, 189, 248);
              p.strokeWeight(1.4);
              p.fill(15, 23, 42);
            }
            p.rect(ax - 3.5, ay - 3.5, 7, 7);
          });
        });
      }
    }

    // 4. Pen Tool ('pen') Live Construction & Rubber-Band Preview
    if (editorState.activeTool === 'pen' && editorState.penSession && editorState.penSession.nodes.length > 0) {
      const sess = editorState.penSession;
      const nodes = sess.nodes;
      const previewNodes = sess.hoverU !== null && sess.hoverV !== null && !sess.draggingNewHandle
        ? [...nodes, { x: sess.hoverU, y: sess.hoverV }]
        : nodes;

      const sampled = sampleContourPoints(previewNodes, false, 20);
      if (sampled.length >= 2) {
        p.noFill();
        p.stroke(52, 211, 153, 230);
        p.strokeWeight(1.5);
        p.beginShape();
        for (const [sx, sy] of sampled) {
          p.vertex(sx * innerSide, sy * innerSide);
        }
        p.endShape();
      }

      nodes.forEach((nd, idx) => {
        const ax = nd.x * innerSide;
        const ay = nd.y * innerSide;
        if (Array.isArray(nd.in)) {
          p.stroke(245, 158, 11, 200);
          p.strokeWeight(1);
          p.line(ax, ay, ax + nd.in[0] * innerSide, ay + nd.in[1] * innerSide);
          p.fill(245, 158, 11);
          p.noStroke();
          p.ellipse(ax + nd.in[0] * innerSide, ay + nd.in[1] * innerSide, 5, 5);
        }
        if (Array.isArray(nd.out)) {
          p.stroke(245, 158, 11, 200);
          p.strokeWeight(1);
          p.line(ax, ay, ax + nd.out[0] * innerSide, ay + nd.out[1] * innerSide);
          p.fill(245, 158, 11);
          p.noStroke();
          p.ellipse(ax + nd.out[0] * innerSide, ay + nd.out[1] * innerSide, 5, 5);
        }

        const isFirst = idx === 0;
        p.stroke(255);
        p.strokeWeight(1.4);
        if (isFirst && sess.closeHover) p.fill(16, 185, 129);
        else p.fill(59, 130, 246);
        if (isFirst && sess.closeHover) {
          p.ellipse(ax, ay, 11, 11);
        } else {
          p.rect(ax - 3.5, ay - 3.5, 7, 7);
        }
      });
    }

    // 5. Selection Marquee Box
    if (editorState.dragOp && editorState.dragOp.type === 'marquee') {
      const { u0, v0, u1, v1 } = editorState.dragOp;
      const mx = Math.min(u0, u1) * innerSide;
      const my = Math.min(v0, v1) * innerSide;
      const mw = Math.abs(u1 - u0) * innerSide;
      const mh = Math.abs(v1 - v0) * innerSide;
      p.fill(59, 130, 246, 32);
      p.stroke(59, 130, 246, 210);
      p.strokeWeight(1);
      p.rect(mx, my, mw, mh);
    }

    p.pop();
  }

  // ==========================================================================
  // 10. Interactive Pointer & Keyboard Event Handlers
  // ==========================================================================

  function getActiveShapesForFamily(familyDoc) {
    if (!familyDoc) return [];
    if (
      editorState.workingShapes &&
      editorState.workingFamilyId === familyDoc.id
    ) {
      return editorState.workingShapes;
    }
    return familyDoc.shapes || [];
  }

  function resetTransientForFamilySwitch(familyId) {
    if (editorState.currentFamilyId !== familyId) {
      editorState.currentFamilyId = familyId;
      editorState.workingFamilyId = null;
      editorState.workingShapes = null;
      editorState.dragOp = null;
      editorState.penSession = null;
      editorState.selectedShapeIds = [];
      editorState.selectedNodes = [];
      editorState.activeSnapGuides = { guideX: null, guideY: null };
    }
  }

  function finalizePenPath(familyDoc, closed = false) {
    const sess = editorState.penSession;
    editorState.penSession = null;
    editorState.workingFamilyId = null;
    editorState.workingShapes = null;
    editorState.activeSnapGuides = { guideX: null, guideY: null };

    if (!sess || !familyDoc || sess.nodes.length < 2) {
      return null;
    }

    const newShape = {
      id: nextShapeId('path'),
      type: 'path',
      name: closed ? 'Caminho Bezier' : 'Linha Bezier',
      closed: Boolean(closed),
      fill: Boolean(closed),
      stroke: !closed,
      strokeWeight: closed ? 0.08 : editorState.toolDefaults.lineWeight,
      strokeCap: 'round',
      strokeJoin: 'round',
      fillRule: 'evenodd',
      contours: [deepClone(sess.nodes)]
    };

    const nextShapes = [...deepClone(familyDoc.shapes || []), newShape];
    editorState.selectedShapeIds = [newShape.id];
    editorState.selectedNodes = [];
    return nextShapes;
  }

  function syncPenPreviewShapes(familyDoc) {
    const sess = editorState.penSession;
    if (!sess || !familyDoc) return;
    if (sess.nodes.length < 2) {
      editorState.workingFamilyId = familyDoc.id;
      editorState.workingShapes = deepClone(familyDoc.shapes || []);
      return;
    }
    const previewPath = {
      id: '__pen_preview__',
      type: 'path',
      name: 'Caminho (em desenho)',
      closed: false,
      fill: false,
      stroke: true,
      strokeWeight: 0.05,
      strokeCap: 'round',
      strokeJoin: 'round',
      contours: [deepClone(sess.nodes)]
    };
    editorState.workingFamilyId = familyDoc.id;
    editorState.workingShapes = [...deepClone(familyDoc.shapes || []), previewPath];
  }

  /**
   * Handles mousedown in normalized master coordinates (u, v).
   * Returns `{ handled, readOnlyBlocked, commitShapes }`
   */
  function onPointerDown(u, v, mods, familyDoc, hitRadiusNorm = 0.028) {
    if (!familyDoc) return { handled: false };
    if (familyDoc.builtIn || familyDoc.protected) {
      return { handled: true, readOnlyBlocked: true };
    }

    ensureFamilyHistory(familyDoc.id, familyDoc);
    const baseShapes = deepClone(familyDoc.shapes || []);
    const tool = editorState.activeTool;
    const objPts = extractObjectSnapPoints(baseShapes, editorState.selectedShapeIds);
    const snapped = snapPoint(u, v, {
      enabled: editorState.snapEnabled && !mods.metaKey,
      gridDiv: editorState.gridDiv,
      threshold: hitRadiusNorm,
      objectPoints: objPts
    });
    editorState.activeSnapGuides = { guideX: snapped.guideX, guideY: snapped.guideY };

    // --- PEN TOOL ('pen') ---
    if (tool === 'pen') {
      if (!editorState.penSession || editorState.penSession.familyId !== familyDoc.id) {
        editorState.penSession = {
          familyId: familyDoc.id,
          nodes: [{ x: snapped.u, y: snapped.v }],
          draggingNewHandle: true,
          hoverU: snapped.u,
          hoverV: snapped.v,
          closeHover: false
        };
        editorState.dragOp = { type: 'pen-handle', nodeIdx: 0 };
        syncPenPreviewShapes(familyDoc);
        return { handled: true };
      }

      const sess = editorState.penSession;
      const first = sess.nodes[0];
      if (sess.nodes.length >= 3 && Math.hypot(u - first.x, v - first.y) <= hitRadiusNorm * 1.4) {
        const committed = finalizePenPath(familyDoc, true);
        return { handled: true, commitShapes: committed };
      }

      sess.nodes.push({ x: snapped.u, y: snapped.v });
      sess.draggingNewHandle = true;
      editorState.dragOp = { type: 'pen-handle', nodeIdx: sess.nodes.length - 1 };
      syncPenPreviewShapes(familyDoc);
      return { handled: true };
    }

    // --- PARAMETRIC CREATION TOOLS ('rect', 'ellipse', 'polygon', 'arc', 'line') ---
    if (tool === 'rect' || tool === 'ellipse' || tool === 'polygon' || tool === 'arc' || tool === 'line') {
      const draftId = nextShapeId(tool);
      editorState.dragOp = {
        type: 'create-shape',
        shapeType: tool,
        draftId,
        u0: snapped.u,
        v0: snapped.v,
        u1: snapped.u,
        v1: snapped.v,
        baseShapes
      };
      editorState.workingFamilyId = familyDoc.id;
      editorState.workingShapes = baseShapes;
      return { handled: true };
    }

    // --- DIRECT NODE SELECTION TOOL ('direct') ---
    if (tool === 'direct') {
      const selSet = new Set(editorState.selectedShapeIds);
      const selectedShapes = baseShapes.filter((s) => s && selSet.has(s.id) && !s.locked && s.visible !== false);

      // 1. Hit-test Bezier handles ('in' / 'out') on selected path shapes
      for (const sh of selectedShapes) {
        if (sh.type !== 'path') continue;
        const { vr } = resolveDeps();
        const contours = vr ? vr.getNormalizedPathContours(sh) : (sh.contours || []);
        for (let cIdx = 0; cIdx < contours.length; cIdx++) {
          const nodes = contours[cIdx];
          for (let nIdx = 0; nIdx < nodes.length; nIdx++) {
            const nd = nodes[nIdx];
            if (Array.isArray(nd.in) && (Math.abs(nd.in[0]) > 1e-5 || Math.abs(nd.in[1]) > 1e-5)) {
              if (Math.hypot(u - (nd.x + nd.in[0]), v - (nd.y + nd.in[1])) <= hitRadiusNorm * 1.2) {
                editorState.selectedNodes = [{ shapeId: sh.id, contourIdx: cIdx, nodeIdx: nIdx }];
                editorState.dragOp = {
                  type: 'move-handle',
                  shapeId: sh.id,
                  contourIdx: cIdx,
                  nodeIdx: nIdx,
                  which: 'in',
                  anchorX: nd.x,
                  anchorY: nd.y,
                  baseShapes
                };
                editorState.workingFamilyId = familyDoc.id;
                editorState.workingShapes = deepClone(baseShapes);
                return { handled: true };
              }
            }
            if (Array.isArray(nd.out) && (Math.abs(nd.out[0]) > 1e-5 || Math.abs(nd.out[1]) > 1e-5)) {
              if (Math.hypot(u - (nd.x + nd.out[0]), v - (nd.y + nd.out[1])) <= hitRadiusNorm * 1.2) {
                editorState.selectedNodes = [{ shapeId: sh.id, contourIdx: cIdx, nodeIdx: nIdx }];
                editorState.dragOp = {
                  type: 'move-handle',
                  shapeId: sh.id,
                  contourIdx: cIdx,
                  nodeIdx: nIdx,
                  which: 'out',
                  anchorX: nd.x,
                  anchorY: nd.y,
                  baseShapes
                };
                editorState.workingFamilyId = familyDoc.id;
                editorState.workingShapes = deepClone(baseShapes);
                return { handled: true };
              }
            }
          }
        }
      }

      // 2. Hit-test anchor nodes (auto-converting parametric shapes to 'path' on vertex grab!)
      for (let sIdx = baseShapes.length - 1; sIdx >= 0; sIdx--) {
        const sh = baseShapes[sIdx];
        if (!sh || !selSet.has(sh.id) || sh.locked || sh.visible === false) continue;
        const asPath = sh.type === 'path' ? sh : convertShapeToPath(sh);
        const { vr } = resolveDeps();
        const contours = vr ? vr.getNormalizedPathContours(asPath) : (asPath.contours || []);
        for (let cIdx = 0; cIdx < contours.length; cIdx++) {
          const nodes = contours[cIdx];
          for (let nIdx = 0; nIdx < nodes.length; nIdx++) {
            const nd = nodes[nIdx];
            if (Math.hypot(u - nd.x, v - nd.y) <= hitRadiusNorm * 1.25) {
              if (sh.type !== 'path') {
                baseShapes[sIdx] = asPath;
              }
              const ref = { shapeId: asPath.id, contourIdx: cIdx, nodeIdx: nIdx };
              const exists = editorState.selectedNodes.some(
                (r) => r.shapeId === ref.shapeId && r.contourIdx === cIdx && r.nodeIdx === nIdx
              );
              if (mods.shiftKey) {
                if (exists) {
                  editorState.selectedNodes = editorState.selectedNodes.filter(
                    (r) => !(r.shapeId === ref.shapeId && r.contourIdx === cIdx && r.nodeIdx === nIdx)
                  );
                } else {
                  editorState.selectedNodes.push(ref);
                }
              } else if (!exists) {
                editorState.selectedNodes = [ref];
              }

              editorState.dragOp = {
                type: 'move-nodes',
                u0: nd.x,
                v0: nd.y,
                baseShapes: deepClone(baseShapes),
                convertedOnDown: sh.type !== 'path'
              };
              editorState.workingFamilyId = familyDoc.id;
              editorState.workingShapes = deepClone(baseShapes);
              return { handled: true };
            }
          }
        }
      }

      // 3. Alt+Click on selected path segment -> insert new subdivided node!
      if (mods.altKey && selectedShapes.length === 1) {
        const targetIdx = baseShapes.findIndex((s) => s && s.id === selectedShapes[0].id);
        if (targetIdx >= 0) {
          const asPath = baseShapes[targetIdx].type === 'path'
            ? baseShapes[targetIdx]
            : convertShapeToPath(baseShapes[targetIdx]);
          const closest = findClosestSegmentOnPath(asPath, u, v);
          if (closest && closest.dist <= hitRadiusNorm * 1.6) {
            const subdivided = subdividePathSegment(asPath, closest.contourIdx, closest.segIdx, closest.t);
            baseShapes[targetIdx] = subdivided;
            editorState.selectedNodes = [{
              shapeId: subdivided.id,
              contourIdx: closest.contourIdx,
              nodeIdx: closest.segIdx + 1
            }];
            return { handled: true, commitShapes: baseShapes };
          }
        }
      }

      // 4. Otherwise hit-test topmost shape to focus its nodes, or start marquee
      const hitSh = hitTestShapesTopmost(baseShapes, u, v, hitRadiusNorm);
      if (hitSh) {
        editorState.selectedShapeIds = [hitSh.id];
        editorState.selectedNodes = [];
        return { handled: true };
      }

      editorState.selectedNodes = [];
      editorState.dragOp = { type: 'marquee', mode: 'direct', u0: u, v0: v, u1: u, v1: v, baseShapes };
      return { handled: true };
    }

    // --- SELECT / TRANSFORM TOOL ('select') ---
    const selSet = new Set(editorState.selectedShapeIds);
    const selectedShapes = baseShapes.filter((s) => s && selSet.has(s.id) && !s.locked && s.visible !== false);

    // 1. Check 8 BBox Resize Handles + Rotation Handle
    if (selectedShapes.length > 0 && !mods.shiftKey) {
      const box = computeSelectionBounds(selectedShapes);
      if (box) {
        const handles = getBBoxHandlePositions(box, hitRadiusNorm * 2.6);
        for (const h of handles) {
          if (Math.hypot(u - h.x, v - h.y) <= hitRadiusNorm * 1.3) {
            if (h.id === 'rot') {
              editorState.dragOp = {
                type: 'rotate-selection',
                pivotX: box.cx,
                pivotY: box.cy,
                startAngle: Math.atan2(v - box.cy, u - box.cx),
                baseShapes,
                changed: false
              };
            } else {
              editorState.dragOp = {
                type: 'resize-selection',
                handleId: h.id,
                startBox: box,
                baseShapes,
                changed: false
              };
            }
            editorState.workingFamilyId = familyDoc.id;
            editorState.workingShapes = deepClone(baseShapes);
            return { handled: true };
          }
        }
      }
    }

    // 2. Hit-test topmost shape for selection & move drag
    const hitSh = hitTestShapesTopmost(baseShapes, u, v, hitRadiusNorm);
    if (hitSh) {
      if (mods.shiftKey) {
        if (selSet.has(hitSh.id)) {
          editorState.selectedShapeIds = editorState.selectedShapeIds.filter((id) => id !== hitSh.id);
        } else {
          editorState.selectedShapeIds = [...editorState.selectedShapeIds, hitSh.id];
        }
      } else if (!selSet.has(hitSh.id)) {
        editorState.selectedShapeIds = [hitSh.id];
      }
      editorState.selectedNodes = [];

      const activeBox = computeSelectionBounds(
        baseShapes.filter((s) => s && editorState.selectedShapeIds.includes(s.id))
      );
      editorState.dragOp = {
        type: 'move-selection',
        u0: u,
        v0: v,
        startBox: activeBox,
        baseShapes,
        changed: false
      };
      editorState.workingFamilyId = familyDoc.id;
      editorState.workingShapes = deepClone(baseShapes);
      return { handled: true };
    }

    // 3. Empty space -> clear selection (unless Shift) and start selection marquee
    if (!mods.shiftKey) {
      editorState.selectedShapeIds = [];
      editorState.selectedNodes = [];
    }
    editorState.dragOp = { type: 'marquee', mode: 'select', u0: u, v0: v, u1: u, v1: v, baseShapes,
      initialSelection: mods.shiftKey ? [...editorState.selectedShapeIds] : [] };
    editorState.activeSnapGuides = { guideX: null, guideY: null };
    return { handled: true };
  }

  function onPointerMove(u, v, mods, familyDoc, hitRadiusNorm = 0.028) {
    if (!familyDoc || familyDoc.builtIn || familyDoc.protected) return false;

    // Pen rubber-band hover when not actively dragging
    if (editorState.activeTool === 'pen' && editorState.penSession && !editorState.dragOp) {
      const sess = editorState.penSession;
      const snapped = snapPoint(u, v, {
        enabled: editorState.snapEnabled && !mods.metaKey,
        gridDiv: editorState.gridDiv,
        threshold: hitRadiusNorm,
        objectPoints: extractObjectSnapPoints(familyDoc.shapes || [])
      });
      sess.hoverU = snapped.u;
      sess.hoverV = snapped.v;
      sess.closeHover = sess.nodes.length >= 3 &&
        Math.hypot(u - sess.nodes[0].x, v - sess.nodes[0].y) <= hitRadiusNorm * 1.4;
      editorState.activeSnapGuides = { guideX: snapped.guideX, guideY: snapped.guideY };
      return true;
    }

    const op = editorState.dragOp;
    if (!op) {
      editorState.activeSnapGuides = { guideX: null, guideY: null };
      return false;
    }

    const objPts = extractObjectSnapPoints(op.baseShapes || [], editorState.selectedShapeIds);
    const snapped = snapPoint(u, v, {
      enabled: editorState.snapEnabled && !mods.metaKey,
      gridDiv: editorState.gridDiv,
      threshold: hitRadiusNorm,
      objectPoints: objPts
    });
    editorState.activeSnapGuides = { guideX: snapped.guideX, guideY: snapped.guideY };

    if (op.type === 'pen-handle' && editorState.penSession) {
      const nd = editorState.penSession.nodes[op.nodeIdx];
      if (nd) {
        let dx = u - nd.x;
        let dy = v - nd.y;
        if (Math.hypot(dx, dy) > 0.008) {
          if (mods.shiftKey) {
            const len = Math.hypot(dx, dy);
            const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
            dx = Math.cos(a) * len;
            dy = Math.sin(a) * len;
          }
          nd.out = [roundCoord(dx), roundCoord(dy)];
          nd.in = [roundCoord(-dx), roundCoord(-dy)];
        } else {
          delete nd.out;
          delete nd.in;
        }
        syncPenPreviewShapes(familyDoc);
      }
      return true;
    }

    if (op.type === 'create-shape') {
      op.u1 = snapped.u;
      op.v1 = snapped.v;
      const dist = Math.hypot(op.u1 - op.u0, op.v1 - op.v0);
      if (dist < 0.006) return true;

      let created = null;
      const common = { id: op.draftId, shiftKey: mods.shiftKey, altKey: mods.altKey };
      if (op.shapeType === 'rect') {
        created = createRectFromDrag(op.u0, op.v0, op.u1, op.v1, {
          ...common,
          radius: editorState.toolDefaults.rectRadius
        });
      } else if (op.shapeType === 'ellipse') {
        created = createEllipseFromDrag(op.u0, op.v0, op.u1, op.v1, common);
      } else if (op.shapeType === 'polygon') {
        created = createPolygonFromDrag(op.u0, op.v0, op.u1, op.v1, {
          ...common,
          sides: editorState.toolDefaults.polygonSides,
          starRatio: editorState.toolDefaults.polygonStarRatio
        });
      } else if (op.shapeType === 'arc') {
        created = createArcFromDrag(op.u0, op.v0, op.u1, op.v1, {
          ...common,
          innerRatio: editorState.toolDefaults.arcInnerRatio,
          mode: editorState.toolDefaults.arcMode
        });
      } else if (op.shapeType === 'line') {
        created = createLineFromDrag(op.u0, op.v0, op.u1, op.v1, {
          ...common,
          strokeWeight: editorState.toolDefaults.lineWeight
        });
      }

      if (created) {
        op.createdShape = created;
        editorState.workingShapes = [...deepClone(op.baseShapes), created];
      }
      return true;
    }

    if (op.type === 'move-selection') {
      let du = u - op.u0;
      let dv = v - op.v0;
      if (mods.shiftKey) {
        if (Math.abs(du) > Math.abs(dv) * 1.5) dv = 0;
        else if (Math.abs(dv) > Math.abs(du) * 1.5) du = 0;
        else {
          const avg = (Math.abs(du) + Math.abs(dv)) / 2;
          du = Math.sign(du) * avg;
          dv = Math.sign(dv) * avg;
        }
      } else if (editorState.snapEnabled && op.startBox && !mods.metaKey) {
        const snapCenter = snapPoint(op.startBox.cx + du, op.startBox.cy + dv, {
          enabled: true,
          gridDiv: editorState.gridDiv,
          threshold: hitRadiusNorm * 0.85,
          objectPoints: objPts
        });
        if (snapCenter.snappedX) {
          du = snapCenter.u - op.startBox.cx;
          editorState.activeSnapGuides.guideX = snapCenter.guideX;
        }
        if (snapCenter.snappedY) {
          dv = snapCenter.v - op.startBox.cy;
          editorState.activeSnapGuides.guideY = snapCenter.guideY;
        }
      }

      if (Math.hypot(du, dv) > 1e-4) op.changed = true;
      const sel = new Set(editorState.selectedShapeIds);
      editorState.workingShapes = op.baseShapes.map((sh) =>
        (sh && sel.has(sh.id) && !sh.locked) ? translateShape(sh, du, dv) : deepClone(sh)
      );
      return true;
    }

    if (op.type === 'resize-selection') {
      const newBox = computeResizedBox(op.startBox, op.handleId, snapped.u, snapped.v, mods.shiftKey, mods.altKey);
      op.changed = true;
      const sel = new Set(editorState.selectedShapeIds);
      editorState.workingShapes = op.baseShapes.map((sh) =>
        (sh && sel.has(sh.id) && !sh.locked) ? scaleShapeFromBox(sh, op.startBox, newBox) : deepClone(sh)
      );
      return true;
    }

    if (op.type === 'rotate-selection') {
      let delta = Math.atan2(v - op.pivotY, u - op.pivotX) - op.startAngle;
      if (mods.shiftKey) {
        const step = Math.PI / 12; // 15°
        delta = Math.round(delta / step) * step;
      }
      if (Math.abs(delta) > 1e-4) op.changed = true;
      editorState.activeSnapGuides = { guideX: null, guideY: null };
      const sel = new Set(editorState.selectedShapeIds);
      editorState.workingShapes = op.baseShapes.map((sh) =>
        (sh && sel.has(sh.id) && !sh.locked) ? rotateShapeAround(sh, op.pivotX, op.pivotY, delta) : deepClone(sh)
      );
      return true;
    }

    if (op.type === 'move-nodes') {
      const targetU = snapped.u;
      const targetV = snapped.v;
      const du = targetU - op.u0;
      const dv = targetV - op.v0;
      if (Math.hypot(du, dv) > 1e-4) op.changed = true;

      const byShape = new Map();
      for (const ref of editorState.selectedNodes) {
        if (!byShape.has(ref.shapeId)) byShape.set(ref.shapeId, []);
        byShape.get(ref.shapeId).push(ref);
      }

      editorState.workingShapes = op.baseShapes.map((sh) => {
        if (!sh || !byShape.has(sh.id)) return deepClone(sh);
        return movePathNodes(sh, byShape.get(sh.id), du, dv);
      });
      return true;
    }

    if (op.type === 'move-handle') {
      op.changed = true;
      const relDx = snapped.u - op.anchorX;
      const relDy = snapped.v - op.anchorY;
      editorState.workingShapes = op.baseShapes.map((sh) => {
        if (!sh || sh.id !== op.shapeId) return deepClone(sh);
        return setPathHandle(sh, op.contourIdx, op.nodeIdx, op.which, relDx, relDy, {
          shiftKey: mods.shiftKey,
          altKey: mods.altKey,
          coupled: true
        });
      });
      return true;
    }

    if (op.type === 'marquee') {
      op.u1 = u;
      op.v1 = v;
      editorState.activeSnapGuides = { guideX: null, guideY: null };
      return true;
    }

    return false;
  }

  function onPointerUp(familyDoc) {
    const op = editorState.dragOp;
    editorState.dragOp = null;
    editorState.activeSnapGuides = { guideX: null, guideY: null };

    if (!op || !familyDoc) return { commitShapes: null };

    if (op.type === 'pen-handle') {
      if (editorState.penSession) {
        editorState.penSession.draggingNewHandle = false;
      }
      return { commitShapes: null };
    }

    if (op.type === 'marquee') {
      const minX = Math.min(op.u0, op.u1);
      const maxX = Math.max(op.u0, op.u1);
      const minY = Math.min(op.v0, op.v1);
      const maxY = Math.max(op.v0, op.v1);
      if (Math.hypot(maxX - minX, maxY - minY) > 0.01) {
        if (op.mode === 'select') {
          const hits = [];
          for (const sh of (op.baseShapes || [])) {
            if (!sh || sh.locked || sh.visible === false) continue;
            const b = computeShapeBounds(sh);
            if (b && b.maxX >= minX && b.minX <= maxX && b.maxY >= minY && b.minY <= maxY) {
              hits.push(sh.id);
            }
          }
          editorState.selectedShapeIds = [...new Set([...(op.initialSelection || []), ...hits])];
        } else if (op.mode === 'direct') {
          const nodeHits = [];
          const { vr } = resolveDeps();
          for (const sh of (op.baseShapes || [])) {
            if (!sh || !editorState.selectedShapeIds.includes(sh.id) || sh.type !== 'path') continue;
            const contours = vr ? vr.getNormalizedPathContours(sh) : (sh.contours || []);
            contours.forEach((nodes, cIdx) => {
              nodes.forEach((nd, nIdx) => {
                if (nd.x >= minX && nd.x <= maxX && nd.y >= minY && nd.y <= maxY) {
                  nodeHits.push({ shapeId: sh.id, contourIdx: cIdx, nodeIdx: nIdx });
                }
              });
            });
          }
          editorState.selectedNodes = nodeHits;
        }
      }
      editorState.workingFamilyId = null;
      editorState.workingShapes = null;
      return { commitShapes: null };
    }

    const draft = editorState.workingShapes;
    editorState.workingFamilyId = null;
    editorState.workingShapes = null;

    if (op.type === 'create-shape') {
      if (op.createdShape && draft) {
        editorState.selectedShapeIds = [op.createdShape.id];
        editorState.selectedNodes = [];
        return { commitShapes: draft };
      }
      return { commitShapes: null };
    }

    if ((op.changed || op.convertedOnDown) && draft) {
      return { commitShapes: draft };
    }
    return { commitShapes: null };
  }

  function onDoubleClick(u, v, familyDoc, hitRadiusNorm = 0.028) {
    if (!familyDoc || familyDoc.builtIn || familyDoc.protected) return { commitShapes: null };

    if (editorState.activeTool === 'pen' && editorState.penSession) {
      return { commitShapes: finalizePenPath(familyDoc, false) };
    }

    if (editorState.activeTool === 'direct') {
      const shapes = deepClone(familyDoc.shapes || []);
      for (let i = shapes.length - 1; i >= 0; i--) {
        const sh = shapes[i];
        if (!sh || !editorState.selectedShapeIds.includes(sh.id) || sh.locked) continue;
        const asPath = sh.type === 'path' ? sh : convertShapeToPath(sh);
        const { vr } = resolveDeps();
        const contours = vr ? vr.getNormalizedPathContours(asPath) : (asPath.contours || []);
        for (let cIdx = 0; cIdx < contours.length; cIdx++) {
          const nodes = contours[cIdx];
          for (let nIdx = 0; nIdx < nodes.length; nIdx++) {
            if (Math.hypot(u - nodes[nIdx].x, v - nodes[nIdx].y) <= hitRadiusNorm * 1.3) {
              shapes[i] = togglePathNodeSmooth(asPath, cIdx, nIdx);
              editorState.selectedNodes = [{ shapeId: shapes[i].id, contourIdx: cIdx, nodeIdx: nIdx }];
              return { commitShapes: shapes };
            }
          }
        }
        // Double-click on segment subdivides & adds a node!
        const closest = findClosestSegmentOnPath(asPath, u, v);
        if (closest && closest.dist <= hitRadiusNorm * 1.5) {
          shapes[i] = subdividePathSegment(asPath, closest.contourIdx, closest.segIdx, closest.t);
          editorState.selectedNodes = [{
            shapeId: shapes[i].id,
            contourIdx: closest.contourIdx,
            nodeIdx: closest.segIdx + 1
          }];
          return { commitShapes: shapes };
        }
      }
    }

    // In 'select' mode: double-clicking a shape switches directly into 'direct' node editing!
    if (editorState.activeTool === 'select') {
      const hitSh = hitTestShapesTopmost(familyDoc.shapes || [], u, v, hitRadiusNorm);
      if (hitSh) {
        editorState.selectedShapeIds = [hitSh.id];
        editorState.activeTool = 'direct';
        return { switchedTool: 'direct', commitShapes: null };
      }
    }

    return { commitShapes: null };
  }

  const VectorEditor = {
    GRID_DIVISIONS,
    VECTOR_TOOLS,
    state: editorState,
    // Pure geometric & manipulation functions (100% Node-testable)
    snapScalar,
    snapPoint,
    extractObjectSnapPoints,
    splitCubicBezier,
    sampleContourPoints,
    computeShapeBounds,
    computeSelectionBounds,
    convertShapeToPath,
    hitTestShape,
    hitTestShapesTopmost,
    findClosestSegmentOnPath,
    translateShape,
    scaleShapeFromBox,
    rotateShapeAround,
    alignShapesToCell,
    distributeShapes,
    movePathNodes,
    setPathHandle,
    togglePathNodeSmooth,
    subdividePathSegment,
    deletePathNodes,
    createRectFromDrag,
    createEllipseFromDrag,
    createPolygonFromDrag,
    createLineFromDrag,
    createArcFromDrag,
    createRibbonPreset,
    // Session, History & Clipboard
    ensureFamilyHistory,
    recordFamilySnapshot,
    canUndo,
    canRedo,
    stepUndo,
    stepRedo,
    clearHistoryForFamily,
    copySelectedShapes,
    pasteFromClipboard,
    duplicateSelectedShapes,
    // Interactive Viewport Integration
    getActiveShapesForFamily,
    resetTransientForFamilySwitch,
    finalizePenPath,
    renderEditorOverlay,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick
  };

  if (typeof window !== 'undefined') {
    window.VectorEditor = VectorEditor;
  }
  if (typeof global !== 'undefined' && global.window) {
    global.window.VectorEditor = VectorEditor;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VectorEditor;
  }
})();

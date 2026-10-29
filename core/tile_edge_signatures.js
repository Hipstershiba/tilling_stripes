/**
 * core/tile_edge_signatures.js
 * Pre-processes a compiled tile catalog into edge signatures ("ports").
 *
 * Each tile side is sampled just inside the tile boundary to build:
 *  - a binary ink/background mask (the exact geometry that touches the neighbour),
 *  - run-length intervals for the fill and background regions,
 *  - the connected fill/background regions that touch the side (F:LR, B:T, ...),
 *  - a stable side ID derived from those fill/background regions.
 *
 * The signatures are used by MosaicEngine's edge-matching generation mode.
 * They are pure geometry: colours are irrelevant, only ink vs. background matters.
 */

(function () {
  const root = (typeof window !== 'undefined' && window) ||
    (typeof global !== 'undefined' && global.window) ||
    {};

  let d4 = root.D4Symmetry;
  let registry = root.TileRegistry;

  if (typeof require === 'function') {
    if (!d4) {
      require('./d4_symmetry.js');
      d4 = root.D4Symmetry;
    }
    if (!registry) {
      require('./tile_registry.js');
      registry = root.TileRegistry;
    }
  }

  const EDGE_SIGNATURE_VERSION = 1;
  const EDGE_RESOLUTION = 64;   // samples per side
  const REGION_GRID = 32;       // occupancy grid used to label connected regions
  const TILE_SIZE = 1000;       // logical tile side used for sampling
  const EDGE_INSET = TILE_SIZE * 0.0015; // probe just inside the exact border
  const STROKE_EPS = 0.5;
  const SIDES = ['left', 'right', 'top', 'bottom'];

  let cacheRevision = -1;
  let nextSideCacheId = 1;
  const tileProfileCache = new Map();
  const orientedProfileCache = new Map();
  // scoreCache[a.cacheId][b.cacheId] = score. The masks are symmetric, so both
  // directions are stored and repeated candidate evaluations become Map hits.
  const scoreCache = new Map();

  function currentRevision() {
    return registry && typeof registry.libraryRevision === 'number'
      ? registry.libraryRevision
      : 0;
  }

  function syncCacheRevision() {
    const rev = currentRevision();
    if (rev !== cacheRevision) {
      tileProfileCache.clear();
      orientedProfileCache.clear();
      scoreCache.clear();
      cacheRevision = rev;
    }
  }

  function hash32(input) {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36).padStart(7, '0');
  }

  function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
  }

  // ---------------------------------------------------------------------------
  // Recorder: turns a compiled renderer into flat polygons/strokes in tile space.
  // ---------------------------------------------------------------------------

  function multiplyMatrix(m, n) {
    // m * n, both are [a, b, c, d, e, f] (x' = a*x + c*y + e; y' = b*x + d*y + f)
    return [
      m[0] * n[0] + m[2] * n[1],
      m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4],
      m[1] * n[4] + m[3] * n[5] + m[5]
    ];
  }

  function applyMatrix(m, x, y) {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }

  function sampleCubic(p0, c1, c2, p1, steps) {
    const points = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      points.push([
        mt2 * mt * p0[0] + 3 * mt2 * t * c1[0] + 3 * mt * t2 * c2[0] + t2 * t * p1[0],
        mt2 * mt * p0[1] + 3 * mt2 * t * c1[1] + 3 * mt * t2 * c2[1] + t2 * t * p1[1]
      ]);
    }
    return points;
  }

  function createRecorder() {
    const shapes = [];
    const stack = [];
    let matrix = [1, 0, 0, 1, 0, 0];
    let style = { fill: false, stroke: false, weight: 1, fillRule: 'nonzero' };
    let shape = null;
    let contour = null;

    const point = (x, y) => applyMatrix(matrix, Number(x) || 0, Number(y) || 0);

    function ensureShape() {
      if (!shape) shape = { contours: [], fill: style.fill, stroke: style.stroke, weight: style.weight, fillRule: style.fillRule };
      return shape;
    }

    function beginContour() {
      ensureShape();
      contour = [];
      shape.contours.push(contour);
    }

    function emitContour(points, closed) {
      if (!Array.isArray(points) || points.length < 2) return;
      const s = ensureShape();
      s.contours.push(points.map(([x, y]) => point(x, y)));
      s.closed = Boolean(closed);
      flushShape();
    }

    function flushShape() {
      if (!shape) return;
      const valid = shape.contours.some((c) => c.length >= 2);
      if (valid && (shape.fill || shape.stroke)) {
        const xs = [];
        const ys = [];
        for (const c of shape.contours) {
          for (const [x, y] of c) {
            xs.push(x);
            ys.push(y);
          }
        }
        shape.bbox = [
          Math.min.apply(null, xs),
          Math.min.apply(null, ys),
          Math.max.apply(null, xs),
          Math.max.apply(null, ys)
        ];
        shapes.push(shape);
      }
      shape = null;
      contour = null;
    }

    const recorder = {
      shapes,
      fill() { style.fill = true; if (shape) shape.fill = true; },
      noFill() { style.fill = false; if (shape) shape.fill = false; },
      stroke() { style.stroke = true; if (shape) shape.stroke = true; },
      noStroke() { style.stroke = false; if (shape) shape.stroke = false; },
      strokeWeight(w) { style.weight = Math.max(0, Number(w) || 0); if (shape) shape.weight = style.weight; },
      fillRule(rule) { style.fillRule = rule === 'evenodd' ? 'evenodd' : 'nonzero'; if (shape) shape.fillRule = style.fillRule; },
      strokeCap() {},
      strokeJoin() {},
      push() {
        stack.push({ matrix: matrix.slice(), style: Object.assign({}, style) });
      },
      pop() {
        const saved = stack.pop();
        if (saved) {
          matrix = saved.matrix;
          style = saved.style;
        }
      },
      translate(tx, ty) {
        matrix = multiplyMatrix(matrix, [1, 0, 0, 1, Number(tx) || 0, Number(ty) || 0]);
      },
      rotate(angle) {
        const a = Number(angle) || 0;
        const c = Math.cos(a);
        const s = Math.sin(a);
        matrix = multiplyMatrix(matrix, [c, s, -s, c, 0, 0]);
      },
      scale(sx, sy) {
        matrix = multiplyMatrix(matrix, [Number(sx) || 0, 0, 0, Number(sy) || 0, 0, 0]);
      },
      rect(x, y, w, h, radius) {
        const px = Number(x) || 0;
        const py = Number(y) || 0;
        const pw = Number(w) || 0;
        const ph = Number(h) || 0;
        const r = Math.max(0, Math.min(Number(radius) || 0, Math.abs(pw) / 2, Math.abs(ph) / 2));
        const left = Math.min(px, px + pw);
        const top = Math.min(py, py + ph);
        const right = left + Math.abs(pw);
        const bottom = top + Math.abs(ph);
        if (r <= 0.0001) {
          emitContour([[left, top], [right, top], [right, bottom], [left, bottom]], true);
          return;
        }
        const pts = [];
        const steps = 6;
        const corners = [
          [right - r, top + r, -Math.PI / 2, 0],
          [right - r, bottom - r, 0, Math.PI / 2],
          [left + r, bottom - r, Math.PI / 2, Math.PI],
          [left + r, top + r, Math.PI, 3 * Math.PI / 2]
        ];
        for (const [cx, cy, a0, a1] of corners) {
          for (let i = 0; i <= steps; i++) {
            const a = a0 + (a1 - a0) * (i / steps);
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
          }
        }
        emitContour(pts, true);
      },
      ellipse(cx, cy, w, h) {
        const ex = Number(cx) || 0;
        const ey = Number(cy) || 0;
        const rx = Math.abs(Number(w) || 0) / 2;
        const ry = Math.abs(Number(h) || 0) / 2;
        const pts = [];
        const steps = 48;
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          pts.push([ex + Math.cos(a) * rx, ey + Math.sin(a) * ry]);
        }
        emitContour(pts, true);
      },
      triangle(x1, y1, x2, y2, x3, y3) {
        emitContour([[x1, y1], [x2, y2], [x3, y3]], true);
      },
      line(x1, y1, x2, y2) {
        emitContour([[x1, y1], [x2, y2]], false);
      },
      arc(cx, cy, w, h, start, stop) {
        const ex = Number(cx) || 0;
        const ey = Number(cy) || 0;
        const rx = Math.abs(Number(w) || 0) / 2;
        const ry = Math.abs(Number(h) || 0) / 2;
        const a0 = Number(start) || 0;
        const a1 = Number(stop) || 0;
        const steps = 40;
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const a = a0 + (a1 - a0) * (i / steps);
          pts.push([ex + Math.cos(a) * rx, ey + Math.sin(a) * ry]);
        }
        emitContour(pts, false);
      },
      beginShape() {
        flushShape();
        shape = { contours: [], fill: style.fill, stroke: style.stroke, weight: style.weight, fillRule: style.fillRule, closed: false };
        contour = [];
        shape.contours.push(contour);
      },
      beginContour,
      endContour() { contour = null; },
      vertex(x, y) {
        if (!shape) recorder.beginShape();
        if (!contour) beginContour();
        contour.push(point(x, y));
      },
      bezierVertex(c1x, c1y, c2x, c2y, x, y) {
        if (!shape) recorder.beginShape();
        if (!contour || contour.length === 0) {
          recorder.vertex(c1x, c1y);
          return;
        }
        const last = contour[contour.length - 1];
        const p0 = [last[0], last[1]];
        const c1 = point(c1x, c1y);
        const c2 = point(c2x, c2y);
        const p1 = point(x, y);
        const sampled = sampleCubic(p0, c1, c2, p1, 12);
        for (const p of sampled) contour.push(p);
      },
      endShape(mode) {
        if (!shape) return;
        const closed = mode === 'CLOSE' || mode === 'close';
        for (const c of shape.contours) {
          if (!c) continue;
          if (c.length > 1 && (closed || shape.fill)) {
            const first = c[0];
            const last = c[c.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) c.push([first[0], first[1]]);
          }
        }
        shape.closed = closed || shape.fill;
        shape.fill = style.fill;
        shape.stroke = style.stroke;
        shape.weight = style.weight;
        shape.fillRule = style.fillRule;
        flushShape();
      },
      beginClipRect() {},
      endClip() {}
    };

    return recorder;
  }

  function pointInShape(x, y, shape) {
    let crossings = 0;
    let wind = 0;
    for (const contour of shape.contours) {
      if (!contour || contour.length < 2) continue;
      for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
        const xi = contour[i][0];
        const yi = contour[i][1];
        const xj = contour[j][0];
        const yj = contour[j][1];
        if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
          crossings++;
        }
        const isLeft = (xj - xi) * (y - yi) - (x - xi) * (yj - yi);
        if (yi <= y) {
          if (yj > y && isLeft > 0) wind++;
        } else if (yj <= y && isLeft < 0) {
          wind--;
        }
      }
    }
    return shape.fillRule === 'evenodd' ? (crossings % 2 === 1) : wind !== 0;
  }

  function pointSegmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = clamp(t, 0, 1);
    const qx = ax + t * dx;
    const qy = ay + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  function pointOnStroke(x, y, shape) {
    const tol = shape.weight / 2 + STROKE_EPS;
    for (const contour of shape.contours) {
      if (!contour || contour.length < 2) continue;
      const lastIndex = shape.closed ? contour.length : contour.length - 1;
      for (let i = 0; i < lastIndex; i++) {
        const a = contour[i];
        const b = contour[(i + 1) % contour.length];
        if (pointSegmentDistance(x, y, a[0], a[1], b[0], b[1]) <= tol) return true;
      }
    }
    return false;
  }

  function pointInRecorder(rec, x, y) {
    for (const shape of rec.shapes) {
      const bb = shape.bbox;
      const pad = shape.stroke ? shape.weight / 2 + STROKE_EPS : 0;
      if (x < bb[0] - pad || x > bb[2] + pad || y < bb[1] - pad || y > bb[3] + pad) continue;
      if (shape.fill && shape.closed && pointInShape(x, y, shape)) return true;
      if (shape.stroke && pointOnStroke(x, y, shape)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Region tagging: which fill/background component touches each side.
  // ---------------------------------------------------------------------------

  function buildRegionTags(rec) {
    const n = REGION_GRID;
    const cell = TILE_SIZE / n;
    const half = TILE_SIZE / 2;
    const ink = new Uint8Array(n * n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const x = -half + (c + 0.5) * cell;
        const y = -half + (r + 0.5) * cell;
        ink[r * n + c] = pointInRecorder(rec, x, y) ? 1 : 0;
      }
    }

    const labels = new Int16Array(n * n);
    labels.fill(-1);
    const tags = [];
    const queue = new Int32Array(n * n);

    for (let start = 0; start < ink.length; start++) {
      if (labels[start] !== -1) continue;
      const kind = ink[start];
      const label = tags.length;
      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      labels[start] = label;
      const sides = new Set();
      while (head < tail) {
        const idx = queue[head++];
        const r = Math.floor(idx / n);
        const c = idx % n;
        if (r === 0) sides.add('T');
        if (r === n - 1) sides.add('B');
        if (c === 0) sides.add('L');
        if (c === n - 1) sides.add('R');
        const neighbours = [
          r > 0 ? idx - n : -1,
          r < n - 1 ? idx + n : -1,
          c > 0 ? idx - 1 : -1,
          c < n - 1 ? idx + 1 : -1
        ];
        for (const nb of neighbours) {
          if (nb >= 0 && labels[nb] === -1 && ink[nb] === kind) {
            labels[nb] = label;
            queue[tail++] = nb;
          }
        }
      }
      const ordered = ['L', 'R', 'T', 'B'].filter((s) => sides.has(s)).join('');
      tags.push(`${kind ? 'F' : 'B'}:${ordered || 'I'}`);
    }

    return { n, labels, tags };
  }

  function sideRegionTag(region, side, t) {
    const n = region.n;
    const idx = clamp(Math.floor(t * n), 0, n - 1);
    let r = idx;
    let c = idx;
    if (side === 'left') { r = idx; c = 0; }
    else if (side === 'right') { r = idx; c = n - 1; }
    else if (side === 'top') { r = 0; c = idx; }
    else { r = n - 1; c = idx; }
    const label = region.labels[r * n + c];
    return label >= 0 ? region.tags[label] : '?';
  }

  // ---------------------------------------------------------------------------
  // Side signatures
  // ---------------------------------------------------------------------------

  function sideSamplePoint(side, t) {
    const half = TILE_SIZE / 2;
    const p = -half + EDGE_INSET + t * (TILE_SIZE - EDGE_INSET * 2);
    if (side === 'left') return [-half + EDGE_INSET, p];
    if (side === 'right') return [half - EDGE_INSET, p];
    if (side === 'top') return [p, -half + EDGE_INSET];
    return [p, half - EDGE_INSET];
  }

  function blurBits(bits, radius) {
    const n = bits.length;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = i + k;
        if (j >= 0 && j < n) {
          sum += bits[j];
          count++;
        }
      }
      out[i] = count ? sum / count : 0;
    }
    return out;
  }

  function runsFromValues(values, isInk) {
    const runs = [];
    if (!values.length) return runs;
    let start = 0;
    for (let i = 1; i <= values.length; i++) {
      if (i === values.length || values[i] !== values[start]) {
        runs.push({
          start: start / values.length,
          end: i / values.length,
          ink: isInk ? Boolean(values[start]) : values[start]
        });
        start = i;
      }
    }
    return runs;
  }

  function intervalKey(intervals) {
    return intervals.map(([a, b]) => `${a.toFixed(4)}-${b.toFixed(4)}`).join(',');
  }

  function buildSide(bits, regionRuns) {
    const runs = runsFromValues(bits, true);
    const fillIntervals = runs.filter((r) => r.ink).map((r) => [r.start, r.end]);
    const bgIntervals = runs.filter((r) => !r.ink).map((r) => [r.start, r.end]);
    const patternKey = runs.map((r) => `${r.ink ? 1 : 0}:${r.start.toFixed(4)}-${r.end.toFixed(4)}`).join('|');
    const regionKey = (regionRuns || []).map((r) => `${r.tag}:${r.start.toFixed(3)}-${r.end.toFixed(3)}`).join('|');
    const coverage = fillIntervals.reduce((sum, [a, b]) => sum + (b - a), 0);
    const softBits = blurBits(bits, 2);
    const bgBits = new Uint8Array(bits.length);
    const softBgBits = new Float32Array(bits.length);
    let fillCount = 0;
    let word0 = 0;
    let word1 = 0;
    for (let i = 0; i < bits.length; i++) {
      bgBits[i] = bits[i] ? 0 : 1;
      softBgBits[i] = 1 - softBits[i];
      if (bits[i]) {
        fillCount++;
        if (i < 32) word0 |= (1 << i);
        else word1 |= (1 << (i - 32));
      }
    }

    return {
      cacheId: nextSideCacheId++,
      bits,
      softBits,
      bgBits,
      softBgBits,
      bitWord0: word0 >>> 0,
      bitWord1: word1 >>> 0,
      fillCount,
      coverage,
      runs,
      regionRuns: regionRuns || [],
      fillIntervals,
      bgIntervals,
      id: 'E' + hash32(patternKey + '#' + regionKey),
      fillId: 'F' + hash32(intervalKey(fillIntervals)),
      bgId: 'B' + hash32(intervalKey(bgIntervals))
    };
  }

  function emptyProfile(tileId) {
    const sides = {};
    for (const side of SIDES) {
      sides[side] = buildSide(new Uint8Array(EDGE_RESOLUTION), []);
      sides[side].emptyTile = true;
    }
    return { tileId, version: EDGE_SIGNATURE_VERSION, resolution: EDGE_RESOLUTION, sides, empty: true };
  }

  function computeTileProfile(tileId) {
    const renderer = registry && registry.TILE_RENDERERS ? registry.TILE_RENDERERS[tileId] : null;
    if (typeof renderer !== 'function') return emptyProfile(tileId);

    const rec = createRecorder();
    try {
      renderer(rec, TILE_SIZE, TILE_SIZE, 0, '#000');
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[TileEdgeSignatures] Renderer #${tileId} could not be sampled:`, err);
      }
      return emptyProfile(tileId);
    }

    const region = buildRegionTags(rec);
    const isEmpty = rec.shapes.length === 0;
    const sides = {};
    for (const side of SIDES) {
      const bits = new Uint8Array(EDGE_RESOLUTION);
      const regionValues = [];
      for (let i = 0; i < EDGE_RESOLUTION; i++) {
        const t = (i + 0.5) / EDGE_RESOLUTION;
        const [x, y] = sideSamplePoint(side, t);
        bits[i] = pointInRecorder(rec, x, y) ? 1 : 0;
        regionValues.push(sideRegionTag(region, side, t));
      }
      sides[side] = buildSide(bits, runsFromValues(regionValues, false));
      sides[side].emptyTile = isEmpty;
    }

    return {
      tileId,
      version: EDGE_SIGNATURE_VERSION,
      resolution: EDGE_RESOLUTION,
      sides,
      empty: isEmpty
    };
  }

  // ---------------------------------------------------------------------------
  // D4 remapping of a base signature to an oriented tile
  // ---------------------------------------------------------------------------

  function transformPoint(x, y, key) {
    switch (key) {
      case 'r90': return [-y, x];
      case 'r180': return [-x, -y];
      case 'r270': return [y, -x];
      case 'mx': return [-x, y];
      case 'my': return [x, -y];
      case 'md': return [y, x];
      case 'mad': return [-y, -x];
      case 'id':
      default: return [x, y];
    }
  }

  function nearestSideAndT(x, y) {
    const half = TILE_SIZE / 2;
    const dl = Math.abs(x + half);
    const dr = Math.abs(x - half);
    const dt = Math.abs(y + half);
    const db = Math.abs(y - half);
    const min = Math.min(dl, dr, dt, db);
    if (min === dl) return { side: 'left', t: clamp((y + half) / TILE_SIZE, 0, 0.999999) };
    if (min === dr) return { side: 'right', t: clamp((y + half) / TILE_SIZE, 0, 0.999999) };
    if (min === dt) return { side: 'top', t: clamp((x + half) / TILE_SIZE, 0, 0.999999) };
    return { side: 'bottom', t: clamp((x + half) / TILE_SIZE, 0, 0.999999) };
  }

  function getOrientedProfile(tileId, transformKey) {
    syncCacheRevision();
    const key = `${tileId}:${transformKey || 'id'}`;
    const cached = orientedProfileCache.get(key);
    if (cached) return cached;

    const base = getTileProfile(tileId);
    if (!transformKey || transformKey === 'id') {
      orientedProfileCache.set(key, base);
      return base;
    }

    const inverse = d4 && typeof d4.invertD4 === 'function' ? d4.invertD4(transformKey) : 'id';
    const sides = {};
    for (const targetSide of SIDES) {
      const bits = new Uint8Array(EDGE_RESOLUTION);
      for (let i = 0; i < EDGE_RESOLUTION; i++) {
        const t = (i + 0.5) / EDGE_RESOLUTION;
        const [tx, ty] = sideSamplePoint(targetSide, t);
        const [bx, by] = transformPoint(tx, ty, inverse);
        const mapped = nearestSideAndT(bx, by);
        const idx = clamp(Math.floor(mapped.t * EDGE_RESOLUTION), 0, EDGE_RESOLUTION - 1);
        bits[i] = base.sides[mapped.side].bits[idx];
      }
      sides[targetSide] = buildSide(bits, []);
      sides[targetSide].emptyTile = Boolean(base.empty);
    }

    const profile = {
      tileId,
      version: EDGE_SIGNATURE_VERSION,
      resolution: EDGE_RESOLUTION,
      transform: transformKey,
      sides,
      empty: base.empty
    };
    orientedProfileCache.set(key, profile);
    return profile;
  }

  function getTileProfile(tileId) {
    syncCacheRevision();
    const id = Number(tileId);
    const cached = tileProfileCache.get(id);
    if (cached) return cached;
    const profile = computeTileProfile(id);
    tileProfileCache.set(id, profile);
    return profile;
  }

  // ---------------------------------------------------------------------------
  // Matching
  // ---------------------------------------------------------------------------

  function softIoU(a, b, emptyResult = 0) {
    let intersection = 0;
    let union = 0;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      const y = b[i];
      intersection += Math.min(x, y);
      union += Math.max(x, y);
    }
    return union > 0 ? intersection / union : emptyResult;
  }

  function hardIoU(a, b, emptyResult = 0) {
    let intersection = 0;
    let union = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] || b[i]) {
        union++;
        if (a[i] && b[i]) intersection++;
      }
    }
    return union ? intersection / union : emptyResult;
  }

  /**
   * Scores a pair of touching sides.
   *
   * Both channels are first-class: the score rewards fill (ink) continuity and
   * background (empty) continuity, using overlap coefficients so a thin ribbon
   * can continue into a wider one. Saturated seams are handled
   * explicitly:
   *   - all-white against all-white is capped (avoid solid white masses);
   *   - all-empty against all-empty is capped (negative space is valid, but it
   *     must not swallow the mosaic);
   *   - all-white against all-empty is a contrast seam and scores high;
   *   - the canonical empty tile never becomes a good neighbour.
   * Near matches are still rewarded through a soft, blurred comparison.
   * Returns 0..1.
   */
  const FULL_COVERAGE = 0.85;
  const EMPTY_COVERAGE = 0.15;
  const FILL_WEIGHT = 0.6;
  const BG_WEIGHT = 0.4;
  const WHITE_WHITE_SCORE = 0.55;
  const CONTRAST_SCORE = 0.7;
  const EMPTY_EMPTY_SCORE = 0.4;
  const EMPTY_TILE_SCORE = 0.2;

  function popcount32(value) {
    let v = value - ((value >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }

  function scoreSide(a, b) {
    if (!a || !b || !a.bits || !b.bits) return 0;

    // The canonical empty tile must not win neighbours through background
    // continuity; otherwise emptiness propagates through the whole mosaic.
    if (a.emptyTile || b.emptyTile) {
      return a.emptyTile && b.emptyTile ? 0 : EMPTY_TILE_SCORE;
    }

    const aFull = a.coverage >= FULL_COVERAGE;
    const bFull = b.coverage >= FULL_COVERAGE;
    const aEmpty = a.coverage <= EMPTY_COVERAGE;
    const bEmpty = b.coverage <= EMPTY_COVERAGE;

    // Saturated same-colour seams are deliberately capped: joining two full
    // white sides makes a white mass, and joining two empty sides makes a hole.
    if (aFull && bFull) return WHITE_WHITE_SCORE;
    if (aEmpty && bEmpty) return EMPTY_EMPTY_SCORE;
    // A full white side against an empty side is a clean contrast boundary.
    if ((aFull && bEmpty) || (aEmpty && bFull)) return CONTRAST_SCORE;

    // Exact 64-bit mask equality: perfect seam, no further work.
    if (a.bitWord0 === b.bitWord0 && a.bitWord1 === b.bitWord1) return 1;

    const cacheIdA = a.cacheId;
    const cacheIdB = b.cacheId;
    const cacheKey = cacheIdA !== undefined && cacheIdB !== undefined
      ? cacheIdA * 10000000 + cacheIdB
      : null;
    if (cacheKey !== null) {
      const cached = scoreCache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const interFill = popcount32(a.bitWord0 & b.bitWord0) + popcount32(a.bitWord1 & b.bitWord1);
    const fillMin = Math.min(a.fillCount, b.fillCount);
    const interBg = a.bits.length - (a.fillCount + b.fillCount - interFill);
    const bgMin = Math.min(a.bits.length - a.fillCount, a.bits.length - b.fillCount);
    const hardFillOverlap = fillMin ? interFill / fillMin : 0;
    const hardBgOverlap = bgMin ? interBg / bgMin : 0;

    let softInterFill = 0;
    let softInterBg = 0;
    let softFillSumA = 0;
    let softFillSumB = 0;
    let softBgSumA = 0;
    let softBgSumB = 0;
    const softFillBitsA = a.softBits;
    const softFillBitsB = b.softBits;
    const softBgBitsA = a.softBgBits;
    const softBgBitsB = b.softBgBits;
    for (let i = 0; i < a.bits.length; i++) {
      const af = softFillBitsA[i];
      const bf = softFillBitsB[i];
      softInterFill += af < bf ? af : bf;
      softFillSumA += af;
      softFillSumB += bf;
      const ab = softBgBitsA[i];
      const bb = softBgBitsB[i];
      softInterBg += ab < bb ? ab : bb;
      softBgSumA += ab;
      softBgSumB += bb;
    }
    const softFillMin = Math.min(softFillSumA, softFillSumB);
    const softBgMin = Math.min(softBgSumA, softBgSumB);
    const softFillOverlap = softFillMin ? softInterFill / softFillMin : 0;
    const softBgOverlap = softBgMin ? softInterBg / softBgMin : 0;

    const fillScore = 0.8 * hardFillOverlap + 0.2 * softFillOverlap;
    const bgScore = 0.8 * hardBgOverlap + 0.2 * softBgOverlap;
    const score = clamp(FILL_WEIGHT * fillScore + BG_WEIGHT * bgScore, 0, 1);

    if (cacheKey !== null) {
      scoreCache.set(cacheKey, score);
      // The metric is symmetric; cache the reverse direction too.
      scoreCache.set(cacheIdB * 10000000 + cacheIdA, score);
    }

    return score;
  }

  function clearCache() {
    tileProfileCache.clear();
    orientedProfileCache.clear();
    scoreCache.clear();
    cacheRevision = currentRevision();
  }

  function warm(tileIds) {
    if (!Array.isArray(tileIds)) return;
    for (const id of tileIds) getTileProfile(id);
  }

  const TileEdgeSignatures = {
    EDGE_SIGNATURE_VERSION,
    EDGE_RESOLUTION,
    REGION_GRID,
    SIDES,
    getTileProfile,
    getOrientedProfile,
    scoreSide,
    hardIoU,
    softIoU,
    clearCache,
    warm,
    _createRecorder: createRecorder,
    _pointInRecorder: pointInRecorder
  };

  if (typeof window !== 'undefined') {
    window.TileEdgeSignatures = TileEdgeSignatures;
  }
  if (typeof global !== 'undefined' && global.window) {
    global.window.TileEdgeSignatures = TileEdgeSignatures;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TileEdgeSignatures;
  }
})();

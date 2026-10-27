/**
 * core/d4_detect.js
 * Pure-JS headless D4 symmetry detector and Cayley coset action builder.
 * Zero DOM / HTMLCanvasElement / p5 dependencies — runs identically in Browser and Node.js.
 */

(function () {
  function getDeps() {
    let d4 = (typeof window !== 'undefined' && window.D4Symmetry) ||
      (typeof global !== 'undefined' && global.window && global.window.D4Symmetry);
    let vr = (typeof window !== 'undefined' && window.VectorRenderer) ||
      (typeof global !== 'undefined' && global.window && global.window.VectorRenderer);

    if (typeof require === 'function') {
      if (!d4) {
        require('./d4_symmetry.js');
        d4 = (typeof window !== 'undefined' && window.D4Symmetry) ||
          (typeof global !== 'undefined' && global.window && global.window.D4Symmetry);
      }
      if (!vr) {
        vr = require('./vector_renderer.js');
      }
    }
    return { d4, vr };
  }

  /**
   * Complete lattice of all 10 subgroups of D4, ordered from highest symmetry (order 8 -> 1 variant)
   * down to trivial symmetry (order 1 -> 8 variants).
   * Coset representatives `reps` are chosen to match canonical Tiling Stripes ordering:
   * - edge_lr_4: [L, R, T, B] = ['id', 'r180', 'r90', 'r270']
   * - corner_tl_4: [TL, TR, BR, BL] = ['id', 'r90', 'r180', 'r270']
   */
  const D4_SUBGROUPS = [
    {
      orbitType: 'symmetric_1',
      label: 'Simétrico Total (D4)',
      stabilizer: ['id', 'r90', 'r180', 'r270', 'mx', 'my', 'md', 'mad'],
      reps: ['id'],
      variantSuffixes: ['']
    },
    {
      orbitType: 'axis_2',
      label: 'Bilateral Axial (2 var.)',
      stabilizer: ['id', 'r180', 'mx', 'my'],
      reps: ['id', 'r90'],
      variantSuffixes: ['Horizontal', 'Vertical']
    },
    {
      orbitType: 'diag_2',
      label: 'Diagonal (2 var.)',
      stabilizer: ['id', 'r180', 'md', 'mad'],
      reps: ['id', 'r90'],
      variantSuffixes: ['(TL-BR)', '(TR-BL)']
    },
    {
      orbitType: 'rotational_2',
      label: 'Rotacional Quiral C4 (2 var.)',
      stabilizer: ['id', 'r90', 'r180', 'r270'],
      reps: ['id', 'mx'],
      variantSuffixes: ['Horário', 'Espelhado']
    },
    {
      orbitType: 'edge_lr_4',
      label: 'Borda Axial (4 var.)',
      stabilizer: ['id', 'my'],
      reps: ['id', 'r180', 'r90', 'r270'],
      variantSuffixes: ['Esquerdo', 'Direito', 'Superior', 'Inferior']
    },
    {
      orbitType: 'edge_tb_4',
      label: 'Borda Vertical (4 var.)',
      stabilizer: ['id', 'mx'],
      reps: ['id', 'r180', 'r90', 'r270'],
      variantSuffixes: ['Superior', 'Inferior', 'Direito', 'Esquerdo']
    },
    {
      orbitType: 'corner_tl_4',
      label: 'Canto Diagonal (4 var.)',
      stabilizer: ['id', 'md'],
      reps: ['id', 'r90', 'r180', 'r270'],
      variantSuffixes: ['Top Left', 'Top Right', 'Bottom Right', 'Bottom Left']
    },
    {
      orbitType: 'corner_tr_4',
      label: 'Canto Anti-Diagonal (4 var.)',
      stabilizer: ['id', 'mad'],
      reps: ['id', 'r90', 'r180', 'r270'],
      variantSuffixes: ['Top Right', 'Bottom Right', 'Bottom Left', 'Top Left']
    },
    {
      orbitType: 'half_turn_4',
      label: 'Meia-Volta C2 (4 var.)',
      stabilizer: ['id', 'r180'],
      reps: ['id', 'r90', 'mx', 'md'],
      variantSuffixes: ['0°', '90°', 'Espelho X', 'Espelho Diag.']
    },
    {
      orbitType: 'asymmetric_8',
      label: 'Quiral Assimétrico (8 var.)',
      stabilizer: ['id'],
      reps: ['id', 'r90', 'r180', 'r270', 'mx', 'my', 'md', 'mad'],
      variantSuffixes: ['0°', '90°', '180°', '270°', 'Flip X', 'Flip Y', 'Diag \\', 'Diag /']
    }
  ];

  function evalCubic(p0, c1, c2, p1, t) {
    const mt = 1 - t;
    return (
      mt * mt * mt * p0 +
      3 * mt * mt * t * c1 +
      3 * mt * t * t * c2 +
      t * t * t * p1
    );
  }

  function distToSegmentSq(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 1e-12) {
      const ex = px - x1;
      const ey = py - y1;
      return ex * ex + ey * ey;
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const ex = px - projX;
    const ey = py - projY;
    return ex * ex + ey * ey;
  }

  function pointInContourEvenOdd(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1];
      const xj = pts[j][0], yj = pts[j][1];
      if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function windingNumberContour(px, py, pts) {
    let wn = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[j][0], yi = pts[j][1];
      const xj = pts[i][0], yj = pts[i][1];
      if (yi <= py) {
        if (yj > py) {
          const isLeft = (xj - xi) * (py - yi) - (px - xi) * (yj - yi);
          if (isLeft > 0) wn++;
        }
      } else if (yj <= py) {
        const isLeft = (xj - xi) * (py - yi) - (px - xi) * (yj - yi);
        if (isLeft < 0) wn--;
      }
    }
    return wn;
  }

  /**
   * Converts a normalized shape into compiled hit-test geometry { fillRings, strokePolylines, halfStrokeSq, fillRule }
   * for fast subpixel rasterization.
   */
  function compileShapeForRaster(shape, vr) {
    if (!shape || shape.visible === false) return null;
    const hasFill = shape.fill !== false;
    const hasStroke = Boolean(shape.stroke);
    if (!hasFill && !hasStroke) return null;

    const strokeW = hasStroke ? Math.max(0.005, Number(shape.strokeWeight) || 0.1) : 0;
    const halfStroke = strokeW / 2;
    const halfStrokeSq = halfStroke * halfStroke;
    const fillRule = shape.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';

    const fillRings = [];
    const strokePolylines = [];

    const addClosedRing = (ring) => {
      if (!ring || ring.length < 2) return;
      if (hasFill && ring.length >= 3) fillRings.push(ring);
      if (hasStroke) {
        const closedPoly = ring.slice();
        closedPoly.push(ring[0]);
        strokePolylines.push(closedPoly);
      }
    };

    switch (shape.type) {
      case 'rect': {
        const x = Number(shape.x) || 0;
        const y = Number(shape.y) || 0;
        const w = Number(shape.w) || 0;
        const h = Number(shape.h) || 0;
        const r = Math.min(Math.abs(w) / 2, Math.abs(h) / 2, Math.max(0, Number(shape.radius) || 0));
        const rot = Number(shape.rotation) || 0;
        const cx = x + w / 2;
        const cy = y + h / 2;

        const rotPt = (px, py) => {
          if (!rot) return [px, py];
          const c = Math.cos(rot), s = Math.sin(rot);
          const dx = px - cx, dy = py - cy;
          return [cx + dx * c - dy * s, cy + dx * s + dy * c];
        };

        if (r <= 1e-6) {
          addClosedRing([
            rotPt(x, y),
            rotPt(x + w, y),
            rotPt(x + w, y + h),
            rotPt(x, y + h)
          ]);
        } else {
          const rx0 = Math.min(x, x + w), ry0 = Math.min(y, y + h);
          const rw = Math.abs(w), rh = Math.abs(h);
          const pts = [];
          const cornerSteps = 8;
          const corners = [
            [rx0 + rw - r, ry0 + r, -Math.PI / 2, 0],
            [rx0 + rw - r, ry0 + rh - r, 0, Math.PI / 2],
            [rx0 + r, ry0 + rh - r, Math.PI / 2, Math.PI],
            [rx0 + r, ry0 + r, Math.PI, (3 * Math.PI) / 2]
          ];
          for (const [ccx, ccy, a0, a1] of corners) {
            for (let i = 0; i <= cornerSteps; i++) {
              const a = a0 + (a1 - a0) * (i / cornerSteps);
              pts.push(rotPt(ccx + Math.cos(a) * r, ccy + Math.sin(a) * r));
            }
          }
          addClosedRing(pts);
        }
        break;
      }

      case 'ellipse': {
        const cx = Number(shape.cx) || 0;
        const cy = Number(shape.cy) || 0;
        const rx = Math.abs(Number(shape.rx) || 0);
        const ry = Math.abs(Number(shape.ry ?? rx) || 0);
        const rot = Number(shape.rotation) || 0;
        if (rx <= 0 || ry <= 0) return null;

        // Analytical ellipse interior + stroke support
        const c = Math.cos(-rot);
        const s = Math.sin(-rot);
        let bboxMinX = cx - Math.max(rx, ry) - halfStroke;
        let bboxMaxX = cx + Math.max(rx, ry) + halfStroke;
        let bboxMinY = cy - Math.max(rx, ry) - halfStroke;
        let bboxMaxY = cy + Math.max(rx, ry) + halfStroke;

        if (!hasStroke && Math.abs(rx - ry) < 1e-9) {
          const rSq = rx * rx;
          return {
            bbox: [bboxMinX, bboxMinY, bboxMaxX, bboxMaxY],
            hitTest(px, py) {
              const dx = px - cx;
              const dy = py - cy;
              return dx * dx + dy * dy <= rSq;
            }
          };
        }

        const steps = 64;
        const ring = [];
        for (let i = 0; i < steps; i++) {
          const a = (Math.PI * 2 * i) / steps;
          const lx = Math.cos(a) * rx;
          const ly = Math.sin(a) * ry;
          const gx = rot ? (cx + lx * Math.cos(rot) - ly * Math.sin(rot)) : (cx + lx);
          const gy = rot ? (cy + lx * Math.sin(rot) + ly * Math.cos(rot)) : (cy + ly);
          ring.push([gx, gy]);
        }
        addClosedRing(ring);
        void c; void s;
        break;
      }

      case 'line': {
        if (!hasStroke) return null;
        strokePolylines.push([
          [Number(shape.x1) || 0, Number(shape.y1) || 0],
          [Number(shape.x2) || 0, Number(shape.y2) || 0]
        ]);
        break;
      }

      case 'triangle': {
        const pts = (Array.isArray(shape.points) && shape.points.length === 3)
          ? shape.points
          : [
              [Number(shape.x1) || 0, Number(shape.y1) || 0],
              [Number(shape.x2) || 0, Number(shape.y2) || 0],
              [Number(shape.x3) || 0, Number(shape.y3) || 0]
            ];
        addClosedRing(pts);
        break;
      }

      case 'polygon': {
        const pts = (Array.isArray(shape.points) && shape.points.length >= 3)
          ? shape.points
          : vr.buildPolygonVertices(shape);
        addClosedRing(pts);
        break;
      }

      case 'arc': {
        const cx = Number(shape.cx) || 0;
        const cy = Number(shape.cy) || 0;
        const rxOut = Math.abs(Number(shape.rx) || 0);
        const ryOut = Math.abs(Number(shape.ry ?? rxOut) || 0);
        const innerRatio = Math.max(0, Math.min(0.999, Number(shape.innerRatio) || 0));
        const aStart = Number(shape.start) || 0;
        const aEnd = Number(shape.end) || 0;
        const mode = shape.mode || (hasFill ? 'pie' : 'open');
        const steps = 48; // Divisible by 2, 3, 4, 6, 8 -> exact symmetry at 45° and 90°!

        if (mode === 'open' && innerRatio === 0) {
          const poly = [];
          for (let i = 0; i <= steps; i++) {
            const a = aStart + (aEnd - aStart) * (i / steps);
            poly.push([cx + Math.cos(a) * rxOut, cy + Math.sin(a) * ryOut]);
          }
          if (hasStroke) strokePolylines.push(poly);
        } else if (innerRatio > 0) {
          const rxIn = rxOut * innerRatio;
          const ryIn = ryOut * innerRatio;
          const ring = [];
          for (let i = 0; i <= steps; i++) {
            const a = aStart + (aEnd - aStart) * (i / steps);
            ring.push([cx + Math.cos(a) * rxOut, cy + Math.sin(a) * ryOut]);
          }
          for (let i = steps; i >= 0; i--) {
            const a = aStart + (aEnd - aStart) * (i / steps);
            ring.push([cx + Math.cos(a) * rxIn, cy + Math.sin(a) * ryIn]);
          }
          addClosedRing(ring);
        } else {
          const ring = [];
          if (mode === 'pie') ring.push([cx, cy]);
          for (let i = 0; i <= steps; i++) {
            const a = aStart + (aEnd - aStart) * (i / steps);
            ring.push([cx + Math.cos(a) * rxOut, cy + Math.sin(a) * ryOut]);
          }
          addClosedRing(ring);
        }
        break;
      }

      case 'path': {
        const contours = vr.getNormalizedPathContours(shape);
        const closed = shape.closed !== false;
        const bezierSteps = 24;

        for (const nodes of contours) {
          if (!nodes || nodes.length < 2) continue;
          const sampled = [[Number(nodes[0].x) || 0, Number(nodes[0].y) || 0]];
          const segCount = closed ? nodes.length : nodes.length - 1;

          for (let i = 0; i < segCount; i++) {
            const curr = nodes[i];
            const next = nodes[(i + 1) % nodes.length];
            const hasOut = Array.isArray(curr.out) && (curr.out[0] !== 0 || curr.out[1] !== 0);
            const hasIn = Array.isArray(next.in) && (next.in[0] !== 0 || next.in[1] !== 0);

            if (hasOut || hasIn) {
              const x0 = Number(curr.x) || 0, y0 = Number(curr.y) || 0;
              const x3 = Number(next.x) || 0, y3 = Number(next.y) || 0;
              const c1x = x0 + (hasOut ? Number(curr.out[0]) || 0 : 0);
              const c1y = y0 + (hasOut ? Number(curr.out[1]) || 0 : 0);
              const c2x = x3 + (hasIn ? Number(next.in[0]) || 0 : 0);
              const c2y = y3 + (hasIn ? Number(next.in[1]) || 0 : 0);
              for (let s = 1; s <= bezierSteps; s++) {
                const t = s / bezierSteps;
                sampled.push([evalCubic(x0, c1x, c2x, x3, t), evalCubic(y0, c1y, c2y, y3, t)]);
              }
            } else {
              sampled.push([Number(next.x) || 0, Number(next.y) || 0]);
            }
          }

          if (closed) {
            // Remove duplicate closing vertex for ring winding test, keep for stroke
            const ring = sampled.slice(0, sampled.length - 1);
            if (hasFill && ring.length >= 3) fillRings.push(ring);
            if (hasStroke) strokePolylines.push(sampled);
          } else if (hasStroke) {
            strokePolylines.push(sampled);
          }
        }
        break;
      }

      default:
        return null;
    }

    if (fillRings.length === 0 && strokePolylines.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ring of fillRings) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    for (const poly of strokePolylines) {
      for (const [x, y] of poly) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    minX -= halfStroke;
    minY -= halfStroke;
    maxX += halfStroke;
    maxY += halfStroke;

    const effectiveRule = (fillRings.length > 1 && !shape.fillRule) ? 'evenodd' : fillRule;

    return {
      bbox: [minX, minY, maxX, maxY],
      hitTest(px, py) {
        if (px < minX || px > maxX || py < minY || py > maxY) return false;

        if (fillRings.length > 0) {
          if (effectiveRule === 'evenodd') {
            let inside = false;
            for (let r = 0; r < fillRings.length; r++) {
              if (pointInContourEvenOdd(px, py, fillRings[r])) inside = !inside;
            }
            if (inside) return true;
          } else {
            let wn = 0;
            for (let r = 0; r < fillRings.length; r++) {
              wn += windingNumberContour(px, py, fillRings[r]);
            }
            if (wn !== 0) return true;
          }
        }

        if (strokePolylines.length > 0) {
          for (let p = 0; p < strokePolylines.length; p++) {
            const poly = strokePolylines[p];
            for (let i = 0; i < poly.length - 1; i++) {
              if (distToSegmentSq(px, py, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]) <= halfStrokeSq) {
                return true;
              }
            }
          }
        }
        return false;
      }
    };
  }

  /**
   * Rasterizes a master's shapes onto a symmetric cell-centered N x N float coverage grid
   * in [-0.5, 0.5]^2 using an 8-point D4-invariant dyadic subpixel stencil.
   * When N is a power of 2 (default 64), every sample coordinate is an odd multiple of 1/(16*N),
   * avoiding all axial/diagonal/modular boundaries (x=0, y=0, x=±y, ±1/2, ±1/3, ±1/4) with 0 ULP rounding error.
   */
  const D4_DYADIC_STENCIL = [
    [-3 / 16, -7 / 16], [ 3 / 16, -7 / 16], [-3 / 16,  7 / 16], [ 3 / 16,  7 / 16],
    [-7 / 16, -3 / 16], [ 7 / 16, -3 / 16], [-7 / 16,  3 / 16], [ 7 / 16,  3 / 16]
  ];

  function rasterizeMasterSymmetric(masterSpec, gridSize = 64) {
    const { vr } = getDeps();
    const N = Math.max(16, Math.floor(gridSize));
    const invN = 1 / N;
    const buffer = new Float32Array(N * N);
    const rawShapes = (masterSpec && Array.isArray(masterSpec.shapes)) ? masterSpec.shapes : [];
    const compiled = rawShapes.map((s) => compileShapeForRaster(s, vr)).filter(Boolean);

    if (compiled.length === 0) {
      return { size: N, buffer, inkFraction: 0 };
    }

    let totalCoverage = 0;

    for (let r = 0; r < N; r++) {
      const cy = (2 * r + 1 - N) / (2 * N);
      for (let c = 0; c < N; c++) {
        const cx = (2 * c + 1 - N) / (2 * N);
        let hits = 0;

        for (let s = 0; s < 8; s++) {
          const px = cx + D4_DYADIC_STENCIL[s][0] * invN;
          const py = cy + D4_DYADIC_STENCIL[s][1] * invN;
          for (let k = 0; k < compiled.length; k++) {
            if (compiled[k].hitTest(px, py)) {
              hits++;
              break;
            }
          }
        }

        const cov = hits * 0.125;
        buffer[r * N + c] = cov;
        totalCoverage += cov;
      }
    }

    return {
      size: N,
      buffer,
      inkFraction: totalCoverage / (N * N)
    };
  }

  /**
   * Computes normalized L1 discrepancy in [0, 1] between master raster R and R transformed by g in D4.
   * Because the sample grid is strictly symmetric under D4, g(R)[r,c] === R[g^-1(r,c)] with zero resampling error!
   */
  function measureTransformDiscrepancy(raster, transformKey, d4) {
    if (transformKey === 'id') return 0;
    const { size: N, buffer } = raster;
    const inv = d4.invertD4(transformKey);
    let diffSum = 0;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const [sr, sc] = d4.transformGridCoords(r, c, N, N, inv);
        diffSum += Math.abs(buffer[r * N + c] - buffer[sr * N + sc]);
      }
    }

    return diffSum / (N * N);
  }

  /**
   * Builds the exact local (k x 8) D4 action map for coset representatives `reps` of subgroup `stabilizer`.
   * Returns an array of length k where entry `i` maps each `g` in D4_TRANSFORMS to target index `0..k-1`.
   */
  function buildCosetActionTable(stabilizer, reps, d4) {
    const stabSet = new Set(stabilizer);
    const k = reps.length;
    const localMap = new Array(k);

    for (let i = 0; i < k; i++) {
      const gi = reps[i];
      const row = {};
      for (const g of d4.D4_TRANSFORMS) {
        // Target coset holds (g o gi) * H. It equals gj * H iff gj^-1 o (g o gi) in H.
        const gComposed = d4.composeD4(g, gi);
        let matchedIdx = -1;
        for (let j = 0; j < k; j++) {
          const gjInv = d4.invertD4(reps[j]);
          const rel = d4.composeD4(gjInv, gComposed);
          if (stabSet.has(rel)) {
            matchedIdx = j;
            break;
          }
        }
        row[g] = matchedIdx >= 0 ? matchedIdx : 0;
      }
      localMap[i] = row;
    }

    return localMap;
  }

  /**
   * Detects the exact D4 stabilizer subgroup, canonical variant transforms, and local Cayley action map
   * for any master tile specification.
   */
  function detectMasterD4(masterSpec, options = {}) {
    const { d4 } = getDeps();
    const gridSize = options.gridSize || 64;
    const tolerance = typeof options.tolerance === 'number' ? options.tolerance : 0.008;

    const raster = rasterizeMasterSymmetric(masterSpec, gridSize);
    const discrepancies = {};
    for (const g of d4.D4_TRANSFORMS) {
      discrepancies[g] = measureTransformDiscrepancy(raster, g, d4);
    }

    // Scale tolerance slightly if the tile has very sparse thin ink (e.g. small dots) so a real change isn't swallowed
    const effectiveTol = raster.inkFraction > 0
      ? Math.min(tolerance, Math.max(0.0015, raster.inkFraction * 0.12))
      : tolerance;

    // Pick the largest subgroup H <= D4 whose elements all leave the master invariant within effectiveTol.
    // Among subgroups of equal order (e.g. order 4 or order 2), pick the one with smallest max discrepancy.
    let bestSubgroup = D4_SUBGROUPS[D4_SUBGROUPS.length - 1];
    let bestOrder = 1;
    let bestMaxDiff = Infinity;

    for (const sg of D4_SUBGROUPS) {
      const order = sg.stabilizer.length;
      if (order < bestOrder) break; // Earlier higher-order match already succeeded

      let maxDiff = 0;
      let allPass = true;
      for (const h of sg.stabilizer) {
        const diff = discrepancies[h];
        if (diff > effectiveTol) {
          allPass = false;
          break;
        }
        if (diff > maxDiff) maxDiff = diff;
      }

      if (allPass && (order > bestOrder || maxDiff < bestMaxDiff)) {
        bestSubgroup = sg;
        bestOrder = order;
        bestMaxDiff = maxDiff;
      }
    }

    const localD4Map = buildCosetActionTable(bestSubgroup.stabilizer, bestSubgroup.reps, d4);
    const stabSet = new Set(bestSubgroup.stabilizer);

    return {
      orbitType: bestSubgroup.orbitType,
      label: bestSubgroup.label,
      orbitSize: bestSubgroup.reps.length,
      stabilizer: bestSubgroup.stabilizer.slice(),
      variantTransforms: bestSubgroup.reps.slice(),
      variantSuffixes: bestSubgroup.variantSuffixes.slice(),
      localD4Map,
      inkFraction: raster.inkFraction,
      discrepancies,
      isFullySymmetric: bestSubgroup.reps.length === 1,
      isAxisInvariant: stabSet.has('mx') || stabSet.has('my'),
      isDiagInvariant: stabSet.has('md') || stabSet.has('mad')
    };
  }

  const D4Detect = {
    D4_SUBGROUPS,
    rasterizeMasterSymmetric,
    measureTransformDiscrepancy,
    buildCosetActionTable,
    detectMasterD4
  };

  if (typeof window !== 'undefined') {
    window.D4Detect = D4Detect;
  }
  if (typeof global !== 'undefined' && global.window) {
    global.window.D4Detect = D4Detect;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = D4Detect;
  }
})();

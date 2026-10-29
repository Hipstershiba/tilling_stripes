/**
 * core/vector_renderer.js
 * Normalized [-0.5, 0.5] vector shape transformer and renderer for Tiling Stripes Studio.
 * Compatible with p5.js contexts, p5.Graphics, SimpleSVG, and minimal headless mock contexts.
 */

(function () {
  const TWO_PI = Math.PI * 2;
  const HALF_PI = Math.PI / 2;
  const KAPPA = (4 / 3) * (Math.SQRT2 - 1); // ~0.5522847498307936

  /**
   * Maps a point (u, v) in normalized master space [-0.5, 0.5]^2 under a D4 isometry.
   * Matches core/d4_symmetry.js applyD4ToContext & transformGridCoords exactly (y-down screen coords).
   */
  function transformPointD4(u, v, transformKey) {
    switch (transformKey) {
      case 'r90':  return [-v, u];
      case 'r180': return [-u, -v];
      case 'r270': return [v, -u];
      case 'mx':   return [-u, v];
      case 'my':   return [u, -v];
      case 'md':   return [v, u];
      case 'mad':  return [-v, -u];
      case 'id':
      default:     return [u, v];
    }
  }

  /**
   * Maps a relative tangent vector (du, dv) under a D4 isometry (linear part, identical to point map around 0).
   */
  function transformVectorD4(du, dv, transformKey) {
    return transformPointD4(du, dv, transformKey);
  }

  function isReflectionD4(transformKey) {
    return transformKey === 'mx' || transformKey === 'my' || transformKey === 'md' || transformKey === 'mad';
  }

  function swapsAxesD4(transformKey) {
    return transformKey === 'r90' || transformKey === 'r270' || transformKey === 'md' || transformKey === 'mad';
  }

  function transformAngleD4(angle, transformKey) {
    switch (transformKey) {
      case 'r90':  return angle + HALF_PI;
      case 'r180': return angle + Math.PI;
      case 'r270': return angle + 3 * HALF_PI;
      case 'mx':   return Math.PI - angle;
      case 'my':   return -angle;
      case 'md':   return HALF_PI - angle;
      case 'mad':  return -HALF_PI - angle;
      case 'id':
      default:     return angle;
    }
  }

  function rotateLocalPoint(x, y, cx, cy, angle) {
    if (!angle) return [x, y];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  }

  /**
   * Computes vertices of a parametric polygon or star in normalized space.
   */
  function buildPolygonVertices(shape) {
    const cx = Number(shape.cx) || 0;
    const cy = Number(shape.cy) || 0;
    const rx = Math.abs(Number(shape.rx ?? 0.5));
    const ry = Math.abs(Number(shape.ry ?? rx));
    const sides = Math.max(3, Math.floor(Number(shape.sides) || 3));
    const starRatio = (typeof shape.starRatio === 'number' && shape.starRatio > 0 && shape.starRatio < 1)
      ? shape.starRatio
      : null;
    const rot = Number(shape.rotation) || 0;
    // Default apex pointing up (-PI/2) so 4-sided unrotated polygon is a diamond and 3-sided points up
    const baseAngle = (typeof shape.startAngle === 'number' ? shape.startAngle : -HALF_PI) + rot;

    const cleanCoord = (val) => (Math.abs(val) < 1e-12 ? 0 : val);
    const pts = [];
    if (starRatio !== null) {
      const totalVerts = sides * 2;
      for (let i = 0; i < totalVerts; i++) {
        const a = baseAngle + (TWO_PI * i) / totalVerts;
        const rScale = (i % 2 === 0) ? 1 : starRatio;
        pts.push([cleanCoord(cx + Math.cos(a) * rx * rScale), cleanCoord(cy + Math.sin(a) * ry * rScale)]);
      }
    } else {
      for (let i = 0; i < sides; i++) {
        const a = baseAngle + (TWO_PI * i) / sides;
        pts.push([cleanCoord(cx + Math.cos(a) * rx), cleanCoord(cy + Math.sin(a) * ry)]);
      }
    }
    return pts;
  }

  /**
   * Deep-clones and algebraically transforms a normalized JSON shape under a D4 isometry.
   */
  function transformShapeD4(shape, transformKey) {
    if (!shape || !transformKey || transformKey === 'id') {
      return shape ? JSON.parse(JSON.stringify(shape)) : shape;
    }

    const out = JSON.parse(JSON.stringify(shape));
    const refl = isReflectionD4(transformKey);
    const swap = swapsAxesD4(transformKey);

    switch (shape.type) {
      case 'rect': {
        const x = Number(shape.x) || 0;
        const y = Number(shape.y) || 0;
        const w = Number(shape.w) || 0;
        const h = Number(shape.h) || 0;
        const rot = Number(shape.rotation) || 0;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const [ncx, ncy] = transformPointD4(cx, cy, transformKey);

        if (!rot) {
          const nw = swap ? Math.abs(h) : Math.abs(w);
          const nh = swap ? Math.abs(w) : Math.abs(h);
          out.x = ncx - nw / 2;
          out.y = ncy - nh / 2;
          out.w = nw;
          out.h = nh;
          out.rotation = 0;
        } else {
          // Rotated rect: preserve exact geometry via transformed center & angle
          const [ux, uy] = transformVectorD4(Math.cos(rot), Math.sin(rot), transformKey);
          const nRot = Math.atan2(uy, ux);
          out.x = ncx - Math.abs(w) / 2;
          out.y = ncy - Math.abs(h) / 2;
          out.w = Math.abs(w);
          out.h = Math.abs(h);
          out.rotation = nRot;
          if (refl) {
            // Note: reflection on an asymmetrically rotated non-square rect with unequal w/h swaps local sign;
            // since a rectangle is mirror-symmetric across both local axes, reflecting it is identical to negating rotation!
          }
        }
        break;
      }

      case 'ellipse': {
        const cx = Number(shape.cx) || 0;
        const cy = Number(shape.cy) || 0;
        const rx = Math.abs(Number(shape.rx) || 0);
        const ry = Math.abs(Number(shape.ry ?? rx) || 0);
        const rot = Number(shape.rotation) || 0;
        const [ncx, ncy] = transformPointD4(cx, cy, transformKey);
        out.cx = ncx;
        out.cy = ncy;
        if (!rot) {
          out.rx = swap ? ry : rx;
          out.ry = swap ? rx : ry;
          out.rotation = 0;
        } else {
          const [ux, uy] = transformVectorD4(Math.cos(rot), Math.sin(rot), transformKey);
          out.rx = rx;
          out.ry = ry;
          out.rotation = Math.atan2(uy, ux);
        }
        break;
      }

      case 'line': {
        const [nx1, ny1] = transformPointD4(Number(shape.x1) || 0, Number(shape.y1) || 0, transformKey);
        const [nx2, ny2] = transformPointD4(Number(shape.x2) || 0, Number(shape.y2) || 0, transformKey);
        out.x1 = nx1;
        out.y1 = ny1;
        out.x2 = nx2;
        out.y2 = ny2;
        break;
      }

      case 'triangle': {
        const pts = Array.isArray(shape.points) && shape.points.length === 3
          ? shape.points
          : [[shape.x1 || 0, shape.y1 || 0], [shape.x2 || 0, shape.y2 || 0], [shape.x3 || 0, shape.y3 || 0]];
        const tPts = pts.map(([px, py]) => transformPointD4(Number(px) || 0, Number(py) || 0, transformKey));
        if (Array.isArray(shape.points)) {
          out.points = tPts;
        } else {
          out.x1 = tPts[0][0]; out.y1 = tPts[0][1];
          out.x2 = tPts[1][0]; out.y2 = tPts[1][1];
          out.x3 = tPts[2][0]; out.y3 = tPts[2][1];
        }
        break;
      }

      case 'polygon': {
        if (Array.isArray(shape.points) && shape.points.length > 0) {
          out.points = shape.points.map(([px, py]) => transformPointD4(Number(px) || 0, Number(py) || 0, transformKey));
        } else {
          const verts = buildPolygonVertices(shape);
          out.points = verts.map(([px, py]) => transformPointD4(px, py, transformKey));
        }
        break;
      }

      case 'arc': {
        const cx = Number(shape.cx) || 0;
        const cy = Number(shape.cy) || 0;
        const rx = Math.abs(Number(shape.rx) || 0);
        const ry = Math.abs(Number(shape.ry ?? rx) || 0);
        const start = Number(shape.start) || 0;
        const end = Number(shape.end) || 0;
        let sweep = end - start;
        while (sweep < 0) sweep += TWO_PI;
        if (sweep > TWO_PI) sweep = TWO_PI;

        const [ncx, ncy] = transformPointD4(cx, cy, transformKey);
        out.cx = ncx;
        out.cy = ncy;
        out.rx = swap ? ry : rx;
        out.ry = swap ? rx : ry;

        if (!refl) {
          const nStart = transformAngleD4(start, transformKey);
          out.start = nStart;
          out.end = nStart + sweep;
        } else {
          // Reflection reverses orientation: the image of [start, start + sweep] runs from T(start + sweep) to T(start)
          const nStart = transformAngleD4(start + sweep, transformKey);
          out.start = nStart;
          out.end = nStart + sweep;
        }
        break;
      }

      case 'path': {
        const rawContours = getNormalizedPathContours(shape);
        out.contours = rawContours.map((nodes) =>
          nodes.map((node) => {
            const [nx, ny] = transformPointD4(Number(node.x) || 0, Number(node.y) || 0, transformKey);
            const res = { x: nx, y: ny };
            if (node.curveJoin===true) res.curveJoin=true;
            if (Array.isArray(node.in)) {
              res.in = transformVectorD4(Number(node.in[0]) || 0, Number(node.in[1]) || 0, transformKey);
            }
            if (Array.isArray(node.out)) {
              res.out = transformVectorD4(Number(node.out[0]) || 0, Number(node.out[1]) || 0, transformKey);
            }
            return res;
          })
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
   * Normalizes a path shape's contours list (supporting both `contours: [[...]]` and shorthand `nodes: [...]`).
   */
  function getNormalizedPathContours(shape) {
    if (Array.isArray(shape.contours) && shape.contours.length > 0) {
      return shape.contours;
    }
    if (Array.isArray(shape.nodes) && shape.nodes.length > 0) {
      return [shape.nodes];
    }
    return [];
  }

  function evalCubicBezier(p0, c1, c2, p1, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    return (
      mt2 * mt * p0 +
      3 * mt2 * t * c1 +
      3 * mt * t2 * c2 +
      t2 * t * p1
    );
  }

  function applyShapeStyle(ctx, shape, minDim, color) {
    const hasFill = shape.fill !== false;
    const hasStroke = Boolean(shape.stroke);

    if (hasFill) {
      ctx.fill(color);
    } else {
      ctx.noFill();
    }

    if (hasStroke) {
      const weightRatio = typeof shape.strokeWeight === 'number' ? shape.strokeWeight : 0.1;
      ctx.stroke(color);
      ctx.strokeWeight(Math.max(0.25, minDim * weightRatio));
      if (shape.strokeCap && typeof ctx.strokeCap === 'function') {
        ctx.strokeCap(shape.strokeCap);
      }
      if (shape.strokeJoin && typeof ctx.strokeJoin === 'function') {
        ctx.strokeJoin(shape.strokeJoin);
      }
    } else {
      ctx.noStroke();
    }

    if (shape.fillRule && typeof ctx.fillRule === 'function') {
      ctx.fillRule(shape.fillRule);
    }
  }

  function emitContourToContext(ctx, nodes, closed, dw, dh, bezierSteps = 16) {
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    ctx.vertex(first.x * dw, first.y * dh);

    const segCount = closed ? nodes.length : nodes.length - 1;
    for (let i = 0; i < segCount; i++) {
      const curr = nodes[i];
      const next = nodes[(i + 1) % nodes.length];
      const hasOut = Array.isArray(curr.out) && (curr.out[0] !== 0 || curr.out[1] !== 0);
      const hasIn = Array.isArray(next.in) && (next.in[0] !== 0 || next.in[1] !== 0);

      if (hasOut || hasIn) {
        const c1x = (curr.x + (hasOut ? curr.out[0] : 0)) * dw;
        const c1y = (curr.y + (hasOut ? curr.out[1] : 0)) * dh;
        const c2x = (next.x + (hasIn ? next.in[0] : 0)) * dw;
        const c2y = (next.y + (hasIn ? next.in[1] : 0)) * dh;
        const nx = next.x * dw;
        const ny = next.y * dh;

        if (typeof ctx.bezierVertex === 'function') {
          ctx.bezierVertex(c1x, c1y, c2x, c2y, nx, ny);
        } else {
          const sx = curr.x * dw;
          const sy = curr.y * dh;
          for (let s = 1; s <= bezierSteps; s++) {
            const t = s / bezierSteps;
            ctx.vertex(
              evalCubicBezier(sx, c1x, c2x, nx, t),
              evalCubicBezier(sy, c1y, c2y, ny, t)
            );
          }
        }
      } else {
        ctx.vertex(next.x * dw, next.y * dh);
      }
    }
  }

  /**
   * Renders a single normalized JSON shape into (ctx, dw, dh) centered at (0, 0).
   */
  function renderShape(ctx, shape, dw, dh, color) {
    if (!shape || shape.visible === false) return;
    const minDim = Math.min(dw, dh);
    applyShapeStyle(ctx, shape, minDim, color);

    switch (shape.type) {
      case 'rect': {
        const x = (Number(shape.x) || 0) * dw;
        const y = (Number(shape.y) || 0) * dh;
        const rw = (Number(shape.w) || 0) * dw;
        const rh = (Number(shape.h) || 0) * dh;
        const rad = (Number(shape.radius) || 0) * minDim;
        const rot = Number(shape.rotation) || 0;

        if (rot && typeof ctx.push === 'function' && typeof ctx.translate === 'function' && typeof ctx.rotate === 'function') {
          ctx.push();
          ctx.translate(x + rw / 2, y + rh / 2);
          ctx.rotate(rot);
          if (rad > 0) ctx.rect(-rw / 2, -rh / 2, rw, rh, rad);
          else ctx.rect(-rw / 2, -rh / 2, rw, rh);
          ctx.pop();
        } else if (rot) {
          // Fallback for minimal mock contexts without push/rotate
          const cx = x + rw / 2;
          const cy = y + rh / 2;
          const corners = [
            rotateLocalPoint(x, y, cx, cy, rot),
            rotateLocalPoint(x + rw, y, cx, cy, rot),
            rotateLocalPoint(x + rw, y + rh, cx, cy, rot),
            rotateLocalPoint(x, y + rh, cx, cy, rot)
          ];
          ctx.beginShape();
          for (const [ vx, vy ] of corners) ctx.vertex(vx, vy);
          ctx.endShape('CLOSE');
        } else {
          if (rad > 0) ctx.rect(x, y, rw, rh, rad);
          else ctx.rect(x, y, rw, rh);
        }
        break;
      }

      case 'ellipse': {
        const cx = (Number(shape.cx) || 0) * dw;
        const cy = (Number(shape.cy) || 0) * dh;
        const ew = Math.abs(Number(shape.rx) || 0) * 2 * dw;
        const eh = Math.abs(Number(shape.ry ?? shape.rx) || 0) * 2 * dh;
        const rot = Number(shape.rotation) || 0;

        if (rot && typeof ctx.push === 'function' && typeof ctx.translate === 'function' && typeof ctx.rotate === 'function') {
          ctx.push();
          ctx.translate(cx, cy);
          ctx.rotate(rot);
          ctx.ellipse(0, 0, ew, eh);
          ctx.pop();
        } else {
          ctx.ellipse(cx, cy, ew, eh);
        }
        break;
      }

      case 'line': {
        ctx.line(
          (Number(shape.x1) || 0) * dw,
          (Number(shape.y1) || 0) * dh,
          (Number(shape.x2) || 0) * dw,
          (Number(shape.y2) || 0) * dh
        );
        break;
      }

      case 'triangle': {
        if (Array.isArray(shape.points) && shape.points.length === 3) {
          const [[x1, y1], [x2, y2], [x3, y3]] = shape.points;
          ctx.triangle(x1 * dw, y1 * dh, x2 * dw, y2 * dh, x3 * dw, y3 * dh);
        } else {
          ctx.triangle(
            (Number(shape.x1) || 0) * dw, (Number(shape.y1) || 0) * dh,
            (Number(shape.x2) || 0) * dw, (Number(shape.y2) || 0) * dh,
            (Number(shape.x3) || 0) * dw, (Number(shape.y3) || 0) * dh
          );
        }
        break;
      }

      case 'polygon': {
        const verts = (Array.isArray(shape.points) && shape.points.length >= 3)
          ? shape.points
          : buildPolygonVertices(shape);
        if (verts.length === 3 && typeof ctx.triangle === 'function') {
          ctx.triangle(
            verts[0][0] * dw, verts[0][1] * dh,
            verts[1][0] * dw, verts[1][1] * dh,
            verts[2][0] * dw, verts[2][1] * dh
          );
        } else {
          const dc = ctx.drawingContext;
          const rule = shape.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
          let origFill = null;
          if (dc && typeof dc.fill === 'function' && shape.fill !== false) {
            origFill = dc.fill;
            dc.fill = function(r) {
              return origFill.call(this, r || rule);
            };
          }
          try {
            ctx.beginShape();
            for (const [vx, vy] of verts) {
              ctx.vertex(vx * dw, vy * dh);
            }
            ctx.endShape('CLOSE');
          } finally {
            if (origFill && dc) {
              dc.fill = origFill;
            }
          }
        }
        break;
      }

      case 'arc': {
        const cx = (Number(shape.cx) || 0) * dw;
        const cy = (Number(shape.cy) || 0) * dh;
        const rxOut = Math.abs(Number(shape.rx) || 0) * dw;
        const ryOut = Math.abs(Number(shape.ry ?? shape.rx) || 0) * dh;
        const innerRatio = Math.max(0, Math.min(0.999, Number(shape.innerRatio) || 0));
        const aStart = Number(shape.start) || 0;
        const aEnd = Number(shape.end) || 0;
        const mode = shape.mode || (shape.fill !== false ? 'pie' : 'open');
        const steps = Math.max(12, Math.min(48, Math.round(Math.abs(aEnd - aStart) / (Math.PI / 32)) || 16));

        if (mode === 'open' && innerRatio === 0) {
          ctx.arc(cx, cy, rxOut * 2, ryOut * 2, aStart, aEnd);
        } else if (innerRatio > 0) {
          const rxIn = rxOut * innerRatio;
          const ryIn = ryOut * innerRatio;
          ctx.beginShape();
          for (let i = 0; i <= steps; i++) {
            const a = aStart + (aEnd - aStart) * (i / steps);
            ctx.vertex(cx + Math.cos(a) * rxOut, cy + Math.sin(a) * ryOut);
          }
          for (let i = steps; i >= 0; i--) {
            const a = aStart + (aEnd - aStart) * (i / steps);
            ctx.vertex(cx + Math.cos(a) * rxIn, cy + Math.sin(a) * ryIn);
          }
          ctx.endShape('CLOSE');
        } else {
          // 'pie' or 'chord' filled sector
          ctx.beginShape();
          if (mode === 'pie') {
            ctx.vertex(cx, cy);
          }
          for (let i = 0; i <= steps; i++) {
            const a = aStart + (aEnd - aStart) * (i / steps);
            ctx.vertex(cx + Math.cos(a) * rxOut, cy + Math.sin(a) * ryOut);
          }
          ctx.endShape('CLOSE');
        }
        break;
      }

      case 'path': {
        const contours = getNormalizedPathContours(shape);
        if (contours.length === 0) break;
        const closed = shape.closed !== false;
        const dc = ctx.drawingContext;
        const rule = shape.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
        let origFill = null;
        if (dc && typeof dc.fill === 'function' && shape.fill !== false) {
          origFill = dc.fill;
          dc.fill = function(r) {
            return origFill.call(this, r || rule);
          };
        }

        try {
          ctx.beginShape();
          emitContourToContext(ctx, contours[0], closed, dw, dh);

          if (contours.length > 1) {
            for (let c = 1; c < contours.length; c++) {
              if (typeof ctx.beginContour === 'function' && typeof ctx.endContour === 'function') {
                ctx.beginContour();
                emitContourToContext(ctx, contours[c], true, dw, dh);
                ctx.endContour();
              } else {
                emitContourToContext(ctx, contours[c], true, dw, dh);
              }
            }
          }

          if (closed) {
            ctx.endShape('CLOSE');
          } else {
            ctx.endShape();
          }
        } finally {
          if (origFill && dc) {
            dc.fill = origFill;
          }
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Renders an array of pre-transformed normalized shapes into (ctx, w, h, padding, color).
   */
  function renderNormalizedShapes(ctx, shapes, w, h, padding, color, clipToTile = false) {
    if (!Array.isArray(shapes) || shapes.length === 0) return;
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    if (dw <= 0 || dh <= 0) return;

    let clipMode = 'none';
    if (clipToTile) {
      if (typeof ctx.beginClipRect === 'function' && typeof ctx.endClip === 'function') {
        ctx.beginClipRect(-dw / 2, -dh / 2, dw, dh);
        clipMode = 'svg';
      } else if (ctx.drawingContext && typeof ctx.drawingContext.clip === 'function') {
        ctx.drawingContext.save();
        ctx.drawingContext.beginPath();
        ctx.drawingContext.rect(-dw / 2, -dh / 2, dw, dh);
        ctx.drawingContext.clip();
        clipMode = 'canvas2d';
      }
    }

    try {
      for (let i = 0; i < shapes.length; i++) {
        renderShape(ctx, shapes[i], dw, dh, color);
      }
    } finally {
      if (clipMode === 'svg') {
        ctx.endClip();
      } else if (clipMode === 'canvas2d') {
        ctx.drawingContext.restore();
      }
    }
  }

  /**
   * Compiles a fast standalone renderer function (ctx, w, h, padding, color)
   * for a master specification under a given D4 variant transform.
   */
  function createVariantRenderer(masterSpec, variantTransform = 'id') {
    const rawShapes = (masterSpec && Array.isArray(masterSpec.shapes)) ? masterSpec.shapes : [];
    const visibleShapes = rawShapes.filter((s) => s && s.visible !== false);

    if (visibleShapes.length === 0) {
      return function emptyTileRenderer() {};
    }

    const preTransformed = variantTransform === 'id'
      ? visibleShapes.map((s) => JSON.parse(JSON.stringify(s)))
      : visibleShapes.map((s) => transformShapeD4(s, variantTransform));
    const clipToTile = Boolean(masterSpec && masterSpec.clipToTile);

    return function compiledVectorTileRenderer(ctx, w, h, padding, color) {
      renderNormalizedShapes(ctx, preTransformed, w, h, padding, color, clipToTile);
    };
  }

  const VectorRenderer = {
    KAPPA,
    transformPointD4,
    transformVectorD4,
    transformAngleD4,
    transformShapeD4,
    buildPolygonVertices,
    getNormalizedPathContours,
    renderShape,
    renderNormalizedShapes,
    createVariantRenderer
  };

  if (typeof window !== 'undefined') {
    window.VectorRenderer = VectorRenderer;
  }
  if (typeof global !== 'undefined' && global.window) {
    global.window.VectorRenderer = VectorRenderer;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VectorRenderer;
  }
})();

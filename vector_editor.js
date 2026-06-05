// ───────────────────────────────────────────────
// Vector Editor — Adobe Illustrator-inspired tile designer
// ───────────────────────────────────────────────

class VecShape {
  constructor(type) {
    this.type = type; // 'rect', 'ellipse', 'polygon', 'path'
    this.x = 0; this.y = 0;
    this.w = 40; this.h = 40;
    this.rotation = 0;
    this.fill = '#666666';
    this.stroke = '#cccccc';
    this.strokeWidth = 2;
    this.selected = false;
    this.points = []; // for polygon/path
    this.closed = true;
    this.usePatternColor = true; // tile mode: use pattern color instead of fixed fill
    this.dragOffset = null; // {dx, dy} while dragging
  }

  get bounds() {
    if (this.type === 'polygon' || this.type === 'path') {
      if (this.points.length === 0) return { x: this.x, y: this.y, w: 0, h: 0 };
      let xs = this.points.map(p => this.x + p.x), ys = this.points.map(p => this.y + p.y);
      let minX = Math.min(...xs), maxX = Math.max(...xs);
      let minY = Math.min(...ys), maxY = Math.max(...ys);
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  contains(px, py) {
    let b = this.bounds;
    if (px < b.x || px > b.x + b.w || py < b.y || py > b.y + b.h) return false;
    if (this.type === 'ellipse') {
      let cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      let dx = (px - cx) / (b.w / 2), dy = (py - cy) / (b.h / 2);
      return dx * dx + dy * dy <= 1;
    }
    if ((this.type === 'polygon' || this.type === 'path') && this.points.length >= 3) {
      // Ray casting algorithm for point-in-polygon
      let pts = this.points.map(p => ({ x: this.x + p.x, y: this.y + p.y }));
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        let xi = pts[i].x, yi = pts[i].y;
        let xj = pts[j].x, yj = pts[j].y;
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }
    return true;
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = this.fill;
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = this.strokeWidth;

    if (this.type === 'rect') {
      ctx.beginPath();
      ctx.rect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.fill(); ctx.stroke();
    } else if (this.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(0, 0, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else if (this.type === 'polygon') {
      if (this.points.length < 2) { ctx.restore(); return; }
      ctx.beginPath();
      // Points are relative to (0,0) in local space
      ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++)
        ctx.lineTo(this.points[i].x, this.points[i].y);
      if (this.closed) ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (this.type === 'path') {
      if (this.points.length < 2) { ctx.restore(); return; }
      ctx.beginPath();
      ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) {
        let p = this.points[i];
        if (p.handleIn || p.handleOut) {
          let prev = this.points[i - 1];
          let ctrlX = prev.x + (p.handleIn ? p.handleIn.x : 0);
          let ctrlY = prev.y + (p.handleIn ? p.handleIn.y : 0);
          ctx.bezierCurveTo(ctrlX, ctrlY, p.x - (p.handleOut ? p.handleOut.x : 0), p.y - (p.handleOut ? p.handleOut.y : 0), p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      if (this.closed) ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    ctx.restore();
  }

  drawHandles(ctx, scale) {
    let b = this.bounds;
    let hs = 5 / scale;
    ctx.fillStyle = '#2196F3';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / scale;

    // Corner handles
    let corners = [
      [b.x, b.y], [b.x + b.w, b.y],
      [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]
    ];
    for (let [hx, hy] of corners) {
      ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
      ctx.strokeRect(hx - hs, hy - hs, hs * 2, hs * 2);
    }
    // Rotation handle (top center)
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y - hs * 3, hs, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  hitHandle(px, py, scale) {
    let b = this.bounds;
    let hs = 8 / scale;
    let corners = [
      [b.x, b.y, 'tl'], [b.x + b.w, b.y, 'tr'],
      [b.x, b.y + b.h, 'bl'], [b.x + b.w, b.y + b.h, 'br']
    ];
    for (let [hx, hy, action] of corners) {
      if (Math.abs(px - hx) < hs && Math.abs(py - hy) < hs) return action;
    }
    // Rotation handle
    let rx = b.x + b.w / 2, ry = b.y - hs * 3;
    if (Math.abs(px - rx) < hs * 2 && Math.abs(py - ry) < hs * 2) return 'rotate';
    return null;
  }
}

class VecLayer {
  constructor(name) {
    this.name = name;
    this.visible = true;
    this.shapes = [];
    this.opacity = 1;
  }
}

// ── Core Editor ──

const vecEditor = {
  canvas: null,
  ctx: null,
  layers: [],
  activeLayerIdx: 0,
  tool: 'select',
  penPoints: [], // temp while drawing pen/poly
  dragState: null, // { shape, startX, startY, handle }
  selectedPoint: null, // { shape, pointIdx } for direct select
  dragPoint: null, // { shape, pointIdx, handle } for dragging a point/handle
  gridSize: 80, // subtile cell size in vector space
  nextId: 1,
  zoom: 3,
  _baseSize: 100, // tile size in logical units (100x100 = one subtile)
  undoStack: [],
  redoStack: [],

  init() {
    this.canvas = document.getElementById('vecCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.layers = [new VecLayer('Layer 1')];
    this.setupUI();
    this.setZoom(3);
    window.addEventListener('resize', () => this.resize());
    this.render();
    this.updateStatus('Tile Editor — draw shapes to create a tile');
  },

  resize() {
    // Fixed tile canvas — always 100x100 logical units
    this._baseSize = 100;
    this.canvas.width = Math.round(this._baseSize * this.zoom);
    this.canvas.height = Math.round(this._baseSize * this.zoom);
    this.render();
  },

  get activeLayer() {
    return this.layers[this.activeLayerIdx];
  },

  setTool(tool) {
    this.tool = tool;
    this.selectedPoint = null;
    this.dragPoint = null;
    document.querySelectorAll('[data-vec-tool]').forEach(b => b.classList.toggle('active', b.dataset.vecTool === tool));
    this.penPoints = [];
    this.dragState = null;
    this.updateStatus(`Tool: ${tool}`);
  },

  addShape(shape) {
    this.saveState();
    shape.id = this.nextId++;
    // Apply current fill/stroke/width from UI
    shape.fill = document.getElementById('vecFillColor').value;
    shape.stroke = document.getElementById('vecStrokeColor').value;
    shape.strokeWidth = parseFloat(document.getElementById('vecStrokeWidth').value) || 2;
    shape.usePatternColor = document.getElementById('vecPatternColorCheck')?.checked ?? true;
    this.activeLayer.shapes.push(shape);
    this.render();
    this.updateLayersUI();
  },

  selectedShapes() {
    return this.activeLayer.shapes.filter(s => s.selected);
  },

  // ── Undo / Redo ──
  saveState() {
    this.undoStack.push(JSON.parse(JSON.stringify(this.layers)));
    this.redoStack = [];
    if (this.undoStack.length > 50) this.undoStack.shift();
  },

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(JSON.parse(JSON.stringify(this.layers)));
    this.layers = JSON.parse(JSON.stringify(this.undoStack.pop()));
    this.activeLayerIdx = Math.min(this.activeLayerIdx, this.layers.length - 1);
    this.render();
    this.updateLayersUI();
  },

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.parse(JSON.stringify(this.layers)));
    this.layers = JSON.parse(JSON.stringify(this.redoStack.pop()));
    this.activeLayerIdx = Math.min(this.activeLayerIdx, this.layers.length - 1);
    this.render();
    this.updateLayersUI();
  },

  // ── Finish pen/polygon path ──
  finishPath() {
    if (this.penPoints.length < 2) return;
    let shape = new VecShape('path');
    shape.points = [...this.penPoints];
    shape.closed = false;
    let cx = this.penPoints.reduce((s, p) => s + p.x, 0) / this.penPoints.length;
    let cy = this.penPoints.reduce((s, p) => s + p.y, 0) / this.penPoints.length;
    shape.x = cx;
    shape.y = cy;
    for (let p of shape.points) { p.x -= cx; p.y -= cy; }
    this.addShape(shape);
    this.penPoints = [];
  },

  // ── Select All ──
  selectAll() {
    for (let s of this.activeLayer.shapes) s.selected = true;
    this.render();
    this.updateLayersUI();
  },

  // ── Sync selected shape props to UI ──
  syncPropsToUI() {
    let sel = this.selectedShapes();
    if (sel.length >= 1) {
      // Sync from first shape
      let s = sel[0];
      document.getElementById('vecFillColor').value = s.fill;
      document.getElementById('vecStrokeColor').value = s.stroke;
      document.getElementById('vecStrokeWidth').value = s.strokeWidth;
      let cb = document.querySelector('#vecPatternColorCheck input');
      if (cb) cb.checked = s.usePatternColor;
    }
  },

  // ── Zoom ──
  setZoom(z) {
    this.zoom = Math.max(0.25, Math.min(5, z));
    document.getElementById('vecZoomLevel').textContent = Math.round(this.zoom * 100) + '%';
    // Increase internal resolution so zoom stays sharp (no CSS scaling)
    this.canvas.width = Math.round(this._baseSize * this.zoom);
    this.canvas.height = Math.round(this._baseSize * this.zoom);
    this.render();
  },

  zoomIn() { this.setZoom(this.zoom * 1.25); },
  zoomOut() { this.setZoom(this.zoom / 1.25); },
  resetZoom() { this.setZoom(1); },

  // ── 3x3 Preview ──
  render3x3Preview() {
    let wrap = document.getElementById('vec3x3Preview');
    if (!wrap) return;
    let canvas = wrap.querySelector('canvas');
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    let w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    let tileW = w / 3, tileH = h / 3;
    // Colors to alternate in preview (simulate pattern colors)
    let colors = ['#888888', '#aaaaaa', '#666666', '#999999', '#777777', '#bbbbbb', '#555555', '#999999', '#888888'];

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        let x = col * tileW, y = row * tileH;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, tileW, tileH);
        ctx.clip();
        ctx.translate(x + tileW / 2, y + tileH / 2);
        ctx.scale(tileW / this._baseSize, tileH / this._baseSize);

        // Draw tile shapes
        let patternColor = colors[(row * 3 + col) % colors.length];
        for (let layer of this.layers) {
          if (!layer.visible) continue;
          for (let shape of layer.shapes) {
            this.renderShapeForPreview(ctx, shape, patternColor);
          }
        }
        ctx.restore();

        // Tile border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tileW, tileH);

        // Highlight center tile
        if (row === 1 && col === 1) {
          ctx.strokeStyle = '#4CAF50';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, tileW, tileH);
        }
      }
    }
  },

  renderShapeForPreview(ctx, shape, patternColor) {
    ctx.save();
    ctx.translate(shape.x, shape.y);
    ctx.rotate(shape.rotation);
    let fillColor = shape.usePatternColor ? patternColor : shape.fill;
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = shape.strokeWidth;

    if (shape.type === 'rect') {
      ctx.beginPath();
      ctx.rect(-shape.w / 2, -shape.h / 2, shape.w, shape.h);
      ctx.fill();
      if (shape.strokeWidth > 0) ctx.stroke();
    } else if (shape.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(0, 0, shape.w / 2, shape.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (shape.strokeWidth > 0) ctx.stroke();
    } else if (shape.type === 'polygon' || shape.type === 'path') {
      if (shape.points.length < 2) { ctx.restore(); return; }
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      if (shape.closed) ctx.closePath();
      ctx.fill();
      if (shape.strokeWidth > 0) ctx.stroke();
    }
    ctx.restore();
  },

  // ── Screen coords → canvas coords (in _baseSize space, before zoom) ──
  canvasCoords(e) {
    let rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this._baseSize / rect.width),
      y: (e.clientY - rect.top) * (this._baseSize / rect.height)
    };
  },

  // ── Get anchor points in absolute canvas coords ──
  getShapePoints(shape) {
    if (shape.type === 'rect' || shape.type === 'ellipse') {
      let b = shape.bounds;
      // 4 corner/quadrant anchors
      return [
        { x: b.x, y: b.y },
        { x: b.x + b.w, y: b.y },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x, y: b.y + b.h }
      ];
    }
    if (shape.points && shape.points.length > 0) {
      return shape.points.map(p => ({
        x: (shape.x + p.x),
        y: (shape.y + p.y)
      }));
    }
    return [];
  },

  getHandlePositions(shape, pointIdx) {
    let p = shape.points[pointIdx];
    if (!p) return null;
    let absX = shape.x + p.x;
    let absY = shape.y + p.y;
    let result = {};
    if (p.handleIn) {
      result.handleIn = { x: shape.x + p.x + p.handleIn.x, y: shape.y + p.y + p.handleIn.y };
    }
    if (p.handleOut) {
      result.handleOut = { x: shape.x + p.x + p.handleOut.x, y: shape.y + p.y + p.handleOut.y };
    }
    return result;
  },

  // ── Hit Testing ──
  hitTest(px, py) {
    let layer = this.activeLayer;
    const HIT_RADIUS = 6 / this.zoom;

    if (this.tool === 'direct') {
      // First check anchor points on selected shapes
      for (let shape of layer.shapes) {
        if (!shape.selected) continue;
        let pts = this.getShapePoints(shape);
        for (let i = pts.length - 1; i >= 0; i--) {
          let dx = px - pts[i].x, dy = py - pts[i].y;
          if (dx * dx + dy * dy < HIT_RADIUS * HIT_RADIUS) {
            return { shape, point: i };
          }
        }
        // Check bezier handles of selected point
        if (this.selectedPoint && this.selectedPoint.shape === shape) {
          let hp = this.getHandlePositions(shape, this.selectedPoint.pointIdx);
          if (hp) {
            for (let [key, pos] of Object.entries(hp)) {
              let dx = px - pos.x, dy = py - pos.y;
              if (dx * dx + dy * dy < HIT_RADIUS * HIT_RADIUS) {
                return { shape, handle: key, handlePoint: this.selectedPoint.pointIdx };
              }
            }
          }
        }
      }
      // Then check shapes
      for (let i = layer.shapes.length - 1; i >= 0; i--) {
        let s = layer.shapes[i];
        if (s.contains(px, py)) return { shape: s, handle: null };
      }
      return null;
    }

    // Normal select tool
    for (let i = layer.shapes.length - 1; i >= 0; i--) {
      let s = layer.shapes[i];
      if (this.tool === 'select' && s.selected) {
        let h = s.hitHandle(px, py, 1);
        if (h) return { shape: s, handle: h };
      }
      if (s.contains(px, py)) return { shape: s, handle: null };
    }
    return null;
  },

  // ── Rendering ──
  render() {
    let ctx = this.ctx;
    let w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // Apply zoom to drawing (canvas is _baseSize * zoom internally)
    ctx.save();
    ctx.scale(this.zoom, this.zoom);

    // Grid lines (in unscaled coords)
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 0.5;
    let step = this._baseSize / this.gridSize;
    for (let i = 0; i <= this.gridSize; i++) {
      let p = i * step;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, this._baseSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(this._baseSize, p); ctx.stroke();
    }

    // Center cross  
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(this._baseSize / 2, 0); ctx.lineTo(this._baseSize / 2, this._baseSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, this._baseSize / 2); ctx.lineTo(this._baseSize, this._baseSize / 2); ctx.stroke();
    ctx.setLineDash([]);

    // Tile boundary — 100x100 subtile
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(0, 0, this._baseSize, this._baseSize);
    ctx.setLineDash([]);

    // Subtile quadrants (2x2 grid inside tile — hint for 4-subtile pattern)
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(this._baseSize / 2, 0);
    ctx.lineTo(this._baseSize / 2, this._baseSize);
    ctx.moveTo(0, this._baseSize / 2);
    ctx.lineTo(this._baseSize, this._baseSize / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Tile label
    ctx.fillStyle = 'rgba(76, 175, 80, 0.6)';
    ctx.font = '9px sans-serif';
    ctx.fillText('SUBTILE (100×100)', 4, 10);

    // Render shapes per layer
    for (let layer of this.layers) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;
      for (let shape of layer.shapes) {
        shape.render(ctx);
      }
    }
    ctx.globalAlpha = 1;

    // Selection handles
    for (let layer of this.layers) {
      if (!layer.visible) continue;
      for (let shape of layer.shapes) {
        if (shape.selected) shape.drawHandles(ctx, this.zoom);
      }
    }

    // Anchor points on selected shapes when using Direct Select
    if (this.tool === 'direct') {
      for (let layer of this.layers) {
        if (!layer.visible) continue;
        for (let shape of layer.shapes) {
          if (!shape.selected) continue;
          let pts = this.getShapePoints(shape);
          for (let i = 0; i < pts.length; i++) {
            let p = this.selectedPoint && this.selectedPoint.shape === shape && this.selectedPoint.pointIdx === i;
            // Point dot
            ctx.fillStyle = p ? '#2196F3' : '#fff';
            ctx.strokeStyle = p ? '#fff' : '#888';
            ctx.lineWidth = 1.5 / this.zoom;
            ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, p ? 5 / this.zoom : 3.5 / this.zoom, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            // Bezier handles for selected point (only for path/polygon with points)
            if (p && shape.points && shape.points[i]) {
              let point = shape.points[i];
              if (point.handleIn) {
                let hx = shape.x + (point.x + point.handleIn.x);
                let hy = shape.y + (point.y + point.handleIn.y);
                ctx.strokeStyle = '#2196F3';
                ctx.lineWidth = 1 / this.zoom;
                ctx.setLineDash([2 / this.zoom, 2 / this.zoom]);
                ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(hx, hy); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = '#2196F3';
                ctx.beginPath(); ctx.arc(hx, hy, 3 / this.zoom, 0, Math.PI * 2); ctx.fill();
              }
              if (point.handleOut) {
                let hx = shape.x + (point.x + point.handleOut.x);
                let hy = shape.y + (point.y + point.handleOut.y);
                ctx.strokeStyle = '#2196F3';
                ctx.lineWidth = 1 / this.zoom;
                ctx.setLineDash([2 / this.zoom, 2 / this.zoom]);
                ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(hx, hy); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = '#2196F3';
                ctx.beginPath(); ctx.arc(hx, hy, 3 / this.zoom, 0, Math.PI * 2); ctx.fill();
              }
            }
          }
        }
      }
    }

    // Pen preview — show points and current drag handle
    if (this.tool === 'pen' && this.penPoints.length > 0) {
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.penPoints[0].x, this.penPoints[0].y);
      for (let i = 1; i < this.penPoints.length; i++) {
        let p = this.penPoints[i];
        let prev = this.penPoints[i - 1];
        if (p.handleIn || prev.handleOut) {
          let cpx = prev.x + (prev.handleOut ? prev.handleOut.x : 0);
          let cpy = prev.y + (prev.handleOut ? prev.handleOut.y : 0);
          ctx.bezierCurveTo(cpx, cpy, p.x, p.y, p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      if (this.penPoints.length > 1) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      for (let p of this.penPoints) {
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // Show handle preview for last point if it has handles
      let last = this.penPoints[this.penPoints.length - 1];
      if (last.handleOut) {
        let hx2 = last.x + last.handleOut.x;
        let hy2 = last.y + last.handleOut.y;
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(hx2, hy2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath(); ctx.arc(hx2, hy2, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Also show pen drag preview when dragging (no points yet)
    if (this.tool === 'pen' && this.penPoints.length === 0 && this.dragState && this.dragState.penDown && this.dragState.dragged) {
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(this.dragState.startX, this.dragState.startY);
      ctx.lineTo(this.dragState.dragX, this.dragState.dragY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath(); ctx.arc(this.dragState.dragX, this.dragState.dragY, 3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();

    this.render3x3Preview();
    this.updateStatus();
  },

  // ── UI Setup ──
  setupUI() {
    // Tool buttons
    document.querySelectorAll('[data-vec-tool]').forEach(btn => {
      btn.addEventListener('click', () => this.setTool(btn.dataset.vecTool));
    });

    // Canvas events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.onMouseUp());
    this.canvas.addEventListener('dblclick', (e) => this.onDblClick(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (document.getElementById('tab-vector').classList.contains('active')) {
        if (e.key === 'v' || e.key === 'V') this.setTool('select');
        else if (e.key === 'a' || e.key === 'A') this.setTool('direct');
        else if (e.key === 'p' || e.key === 'P') this.setTool('pen');
        else if (e.key === 'r' || e.key === 'R') this.setTool('rect');
        else if (e.key === 'e' || e.key === 'E') this.setTool('ellipse');
        else if (e.key === 'g' || e.key === 'G') this.setTool('polygon');
        else if (e.key === 'Delete' || e.key === 'Backspace') this.deleteSelected();
        else if (e.key === 'Escape') { this.deselectAll(); this.penPoints = []; this.render(); }
        else if (e.key === 'Enter' && this.tool === 'pen') {
          this.finishPath();
          e.preventDefault();
        }
        else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { this.undo(); e.preventDefault(); }
        else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { this.redo(); e.preventDefault(); }
        else if ((e.ctrlKey || e.metaKey) && (e.key === 'a')) { this.selectAll(); e.preventDefault(); }
        else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { this.zoomIn(); e.preventDefault(); }
        else if ((e.ctrlKey || e.metaKey) && (e.key === '-')) { this.zoomOut(); e.preventDefault(); }
        else if ((e.ctrlKey || e.metaKey) && e.key === '0') { this.resetZoom(); e.preventDefault(); }
      }
    });

    // Add layer
    document.getElementById('vecAddLayer').addEventListener('click', () => {
      this.saveState();
      this.layers.push(new VecLayer(`Layer ${this.layers.length + 1}`));
      this.activeLayerIdx = this.layers.length - 1;
      this.updateLayersUI();
      this.render();
    });

    // Boolean ops
    document.getElementById('vecUnion').addEventListener('click', () => this.booleanOp('union'));
    document.getElementById('vecSubtract').addEventListener('click', () => this.booleanOp('subtract'));
    document.getElementById('vecIntersect').addEventListener('click', () => this.booleanOp('intersect'));

    // Zoom
    document.getElementById('vecZoomIn').addEventListener('click', () => this.zoomIn());
    document.getElementById('vecZoomOut').addEventListener('click', () => this.zoomOut());
    document.getElementById('vecZoomReset').addEventListener('click', () => this.resetZoom());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) this.zoomIn();
      else this.zoomOut();
    });

    // Fill / Stroke / Width
    document.getElementById('vecFillColor').addEventListener('input', () => {
      if (this.selectedShapes().length) {
        for (let s of this.selectedShapes()) s.fill = document.getElementById('vecFillColor').value;
        this.render();
      }
    });
    document.getElementById('vecStrokeColor').addEventListener('input', () => {
      if (this.selectedShapes().length) {
        for (let s of this.selectedShapes()) s.stroke = document.getElementById('vecStrokeColor').value;
        this.render();
      }
    });
    document.getElementById('vecStrokeWidth').addEventListener('change', () => {
      let w = parseFloat(document.getElementById('vecStrokeWidth').value);
      if (this.selectedShapes().length) {
        for (let s of this.selectedShapes()) s.strokeWidth = w;
        this.render();
      }
    });

    // Grid size
    document.getElementById('vecGridSize').addEventListener('change', () => {
      let g = parseInt(document.getElementById('vecGridSize').value) || 80;
      this.gridSize = Math.max(4, Math.min(200, g));
      this.render();
    });

    // Pattern color checkbox
    document.getElementById('vecPatternColorCheck').addEventListener('change', (e) => {
      let usePattern = e.target.checked;
      for (let s of this.selectedShapes()) s.usePatternColor = usePattern;
      this.render();
    });

    // Register tile
    document.getElementById('vecRegisterTileBtn').addEventListener('click', () => {
      this.registerCurrentTile();
    });

    this.updateLayersUI();
  },

  updateLayersUI() {
    let list = document.getElementById('vecLayersList');
    let nameEl = document.getElementById('vecActiveLayerName');
    nameEl.textContent = this.activeLayer ? this.activeLayer.name : 'No layer';
    list.innerHTML = '';
    this.layers.forEach((layer, idx) => {
      let div = document.createElement('div');
      div.className = `vec-layer-item${idx === this.activeLayerIdx ? ' active' : ''}`;
      div.innerHTML = `
              <span class="vec-layer-vis" data-idx="${idx}">${layer.visible ? '👁' : '—'}</span>
              <span class="vec-layer-name" data-idx="${idx}">${layer.name}</span>
              <span class="vec-layer-del" data-idx="${idx}">✕</span>
            `;
      div.addEventListener('click', (e) => {
        if (e.target.classList.contains('vec-layer-vis')) {
          this.saveState();
          layer.visible = !layer.visible;
          this.render();
          this.updateLayersUI();
        } else if (e.target.classList.contains('vec-layer-del')) {
          if (this.layers.length <= 1) return;
          this.saveState();
          this.layers.splice(idx, 1);
          if (this.activeLayerIdx >= this.layers.length) this.activeLayerIdx = this.layers.length - 1;
          this.render();
          this.updateLayersUI();
        } else if (idx !== this.activeLayerIdx) {
          // Just update class + select active without full DOM rebuild
          let items = list.querySelectorAll('.vec-layer-item');
          items.forEach(el => el.classList.remove('active'));
          div.classList.add('active');
          this.activeLayerIdx = idx;
          nameEl.textContent = layer.name;
          // Also update layer label
        }
      });
      // Double-click to rename
      let nameSpan = div.querySelector('.vec-layer-name');
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        let input = document.createElement('input');
        input.type = 'text';
        input.value = layer.name;
        input.style.cssText = 'width:100%;background:#333;border:1px solid #2196F3;color:#fff;border-radius:3px;padding:1px 4px;font-size:inherit;outline:none;';
        nameSpan.replaceWith(input);
        input.focus();
        input.select();
        let done = () => {
          let val = input.value.trim() || layer.name;
          this.saveState();
          layer.name = val;
          this.updateLayersUI();
        };
        input.addEventListener('blur', done);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); done(); }
          if (ev.key === 'Escape') { ev.preventDefault(); this.updateLayersUI(); }
        });
      });
      // Drag to reorder (simple up/down buttons)
      let up = document.createElement('span');
      up.className = 'vec-layer-up';
      up.textContent = '↑';
      up.addEventListener('click', (e) => { e.stopPropagation(); if (idx > 0) { this.saveState(); [this.layers[idx], this.layers[idx-1]] = [this.layers[idx-1], this.layers[idx]]; this.activeLayerIdx = idx-1; this.render(); this.updateLayersUI(); } });
      let dn = document.createElement('span');
      dn.className = 'vec-layer-dn';
      dn.textContent = '↓';
      dn.addEventListener('click', (e) => { e.stopPropagation(); if (idx < this.layers.length-1) { this.saveState(); [this.layers[idx], this.layers[idx+1]] = [this.layers[idx+1], this.layers[idx]]; this.activeLayerIdx = idx+1; this.render(); this.updateLayersUI(); } });
      div.appendChild(up);
      div.appendChild(dn);
      list.appendChild(div);
    });
  },

  updateStatus(msg) {
    let el = document.getElementById('vecStatus');
    if (msg) { el.textContent = msg; return; }
    if (this.tool === 'direct') {
      let selCount = this.activeLayer.shapes.filter(s => s.selected).length;
      let ptInfo = this.selectedPoint ? ` | Point ${this.selectedPoint.pointIdx}` : '';
      el.textContent = `Direct Select | ${selCount} selected${ptInfo}`;
      return;
    }
    let sel = this.activeLayer.shapes.filter(s => s.selected).length;
    el.textContent = `${this.tool.charAt(0).toUpperCase() + this.tool.slice(1)} | ${this.activeLayer.shapes.length} shapes | ${sel} selected`;
  },

  // ── Mouse Handlers ──
  onMouseDown(e) {
    let { x: mx, y: my } = this.canvasCoords(e);

    // Pen tool drag preview
    if (this.tool === 'pen' && this.dragState && this.dragState.penDown) {
      let dx = mx - this.dragState.startX;
      let dy = my - this.dragState.startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        this.dragState.dragged = true;
        this.dragState.dragX = mx;
        this.dragState.dragY = my;
      }
      this.render();
      return;
    }

    if (this.tool === 'direct') {
      let hit = this.hitTest(mx, my);
      if (!e.shiftKey) this.deselectAll();
      this.selectedPoint = null;
      if (hit) {
        if (hit.point !== undefined) {
          // If dragging a rect/ellipse anchor, convert to polygon first
          let shape = hit.shape;
          if (shape.type === 'rect' || shape.type === 'ellipse') {
            let b = shape.bounds;
            let pts = [
              { x: 0, y: 0 },
              { x: b.w, y: 0 },
              { x: b.w, y: b.h },
              { x: 0, y: b.h }
            ];
            shape.type = 'polygon';
            shape.points = pts;
            shape.x = b.x;
            shape.y = b.y;
            shape.closed = true;
            // Re-get the point index from the new polygon
            let newPts = this.getShapePoints(shape);
            for (let i = 0; i < newPts.length; i++) {
              if (Math.abs(mx - newPts[i].x) < 6 / this.zoom && Math.abs(my - newPts[i].y) < 6 / this.zoom) {
                hit.point = i;
                break;
              }
            }
          }
          shape.selected = true;
          this.selectedPoint = { shape: shape, pointIdx: hit.point };
        } else if (hit.handle) {
          hit.shape.selected = true;
          this.selectedPoint = { shape: hit.shape, pointIdx: hit.handlePoint };
          let hp = this.getHandlePositions(hit.shape, hit.handlePoint);
          this.dragPoint = { shape: hit.shape, pointIdx: hit.handlePoint, handle: hit.handle, startX: mx, startY: my, origHandle: { ...hit.shape.points[hit.handlePoint][hit.handle] } };
        } else {
          if (e.shiftKey) {
            hit.shape.selected = !hit.shape.selected;
          } else {
            hit.shape.selected = true;
          }
        }
      }
      this.render();
      this.updateLayersUI();
      return;
    }

    if (this.tool === 'select') {
      let hit = this.hitTest(mx, my);
      if (hit) {
        if (!e.shiftKey) this.deselectAll();
        if (e.shiftKey && hit.shape.selected) {
          hit.shape.selected = false;
        } else {
          hit.shape.selected = true;
        }
        this.syncPropsToUI();
        if (hit.handle) {
          let b = hit.shape.bounds;
          if (hit.handle === 'rotate') {
            this.dragState = { shape: hit.shape, startX: mx, startY: my, handle: 'rotate', origBounds: {...b} };
          } else {
            this.dragState = { shape: hit.shape, startX: mx, startY: my, handle: hit.handle, origBounds: {...b}, corner: hit.handle };
          }
        } else {
          this.dragState = { shape: hit.shape, startX: mx, startY: my, handle: null };
        }
        this.render();
        this.updateLayersUI();
      } else {
        if (!e.shiftKey) this.deselectAll();
        this.render();
      }
    } else if (this.tool === 'pen') {
      // Store initial click pos to detect click-drag for bezier handles
      this.dragState = { penDown: true, startX: mx, startY: my };
    } else if (this.tool === 'polygon') {
      this.dragState = { tool: 'polygon', startX: mx, startY: my };
    } else if (this.tool === 'rect') {
      this.dragState = { tool: 'rect', startX: mx, startY: my };
    } else if (this.tool === 'ellipse') {
      this.dragState = { tool: 'ellipse', startX: mx, startY: my };
    }
  },

  onMouseMove(e) {
    let { x: mx, y: my } = this.canvasCoords(e);

    // Direct select: drag a point or bezier handle
    if (this.dragPoint) {
      let { shape, pointIdx, handle, startX, startY, origHandle } = this.dragPoint;
      if (handle) {
        // Dragging a bezier handle → update handle offset
        let p = shape.points[pointIdx];
        if (p[handle]) {
          let dx = mx - startX;
          let dy = my - startY;
          p[handle] = { x: origHandle.x + dx, y: origHandle.y + dy };
        }
      } else {
        // Dragging a point
        let p = shape.points[pointIdx];
        if (p) {
          let dx = mx - startX;
          let dy = my - startY;
          p.x += dx;
          p.y += dy;
          this.dragPoint.startX = mx;
          this.dragPoint.startY = my;
        }
      }
      this.render();
      return;
    }

    if (this.dragState) {
      if (this.dragState.shape && !this.dragState.handle) {
        // Move shape
        let dx = mx - this.dragState.startX;
        let dy = my - this.dragState.startY;
        this.dragState.shape.x += dx;
        this.dragState.shape.y += dy;
        this.dragState.startX = mx;
        this.dragState.startY = my;
        this.render();
      } else if (this.dragState.shape && (this.dragState.handle === 'tl' || this.dragState.handle === 'tr' || this.dragState.handle === 'bl' || this.dragState.handle === 'br')) {
        // Corner-aware resize
        let shape = this.dragState.shape;
        let b = this.dragState.origBounds;
        let dx = mx - this.dragState.startX;
        let dy = my - this.dragState.startY;
        let corner = this.dragState.corner;

        // nw/nh change based on corner
        let dw = (corner === 'tl' || corner === 'bl') ? -dx : dx;
        let dh = (corner === 'tl' || corner === 'tr') ? -dy : dy;
        let nw = Math.max(10, b.w + dw);
        let nh = Math.max(10, b.h + dh);

        // Corner fixes opposite edges:
        // TL → right & bottom stay;  TR → left & bottom stay
        // BL → right & top stay;     BR → left & top stay
        if (corner === 'tl' || corner === 'tr') {
          shape.y = (b.y + b.h) - nh / 2;  // bottom fixed
        } else {
          shape.y = b.y + nh / 2;          // top fixed
        }
        if (corner === 'tl' || corner === 'bl') {
          shape.x = (b.x + b.w) - nw / 2;  // right fixed
        } else {
          shape.x = b.x + nw / 2;          // left fixed
        }
        shape.w = nw;
        shape.h = nh;
        this.render();
      } else if (this.dragState.tool === 'rect') {
        this.dragState.w = mx - this.dragState.startX;
        this.dragState.h = my - this.dragState.startY;
        this.renderPreview(this.dragState);
      } else if (this.dragState.tool === 'ellipse') {
        this.dragState.w = mx - this.dragState.startX;
        this.dragState.h = my - this.dragState.startY;
        this.renderPreview(this.dragState);
      } else if (this.dragState.tool === 'polygon') {
        this.dragState.w = mx - this.dragState.startX;
        this.dragState.h = my - this.dragState.startY;
        this.renderPreview(this.dragState);
      }
    } else {
      // Update cursor
      let hit = this.hitTest(mx, my);
      if (this.tool === 'direct') {
        this.canvas.style.cursor = hit ? (hit.point !== undefined ? 'move' : 'pointer') : 'default';
      } else {
        this.canvas.style.cursor = hit ? 'pointer' : 'crosshair';
      }
    }
  },

  onMouseUp() {
    if (this.dragPoint) {
      this.dragPoint = null;
      this.render();
      return;
    }

    // Pen tool: finalize point (corner or smooth with handles)
    if (this.tool === 'pen' && this.dragState && this.dragState.penDown) {
      let mx = this.dragState.startX, my = this.dragState.startY;
      let hasDrag = this.dragState.dragged;
      if (hasDrag) {
        // Click-drag: smooth point with handles
        let hdx = this.dragState.dragX - mx;
        let hdy = this.dragState.dragY - my;
        let prevPt = this.penPoints.length > 0 ? this.penPoints[this.penPoints.length - 1] : null;
        let pt = { x: mx, y: my };
        if (prevPt) {
          // Handle direction is opposite to previous → smooth curve
          pt.handleIn = { x: 0, y: 0 };  // will be set from previous point's handleOut
        }
        pt.handleOut = { x: hdx, y: hdy };
        this.penPoints.push(pt);
        // Update previous point's handleIn to create smooth curve
        if (prevPt && !prevPt.handleIn) {
          prevPt.handleIn = { x: -hdx, y: -hdy };
        }
      } else {
        // Simple click: corner point
        this.penPoints.push({ x: mx, y: my });
      }
      this.dragState = null;
      this.render();
      return;
    }

    if (this.dragState) {
      if (this.dragState.shape && this.dragState.handle === null) {
        // Shape was moved — save state
        this.saveState();
      } else if (this.dragState.shape && (this.dragState.handle === 'tl' || this.dragState.handle === 'tr' || this.dragState.handle === 'bl' || this.dragState.handle === 'br')) {
        // Shape was resized — save state
        this.saveState();
      } else if (this.dragState.shape && this.dragState.handle === 'rotate') {
        // Shape was rotated — save state
        this.saveState();
      }
      if (this.dragState.tool === 'rect') {
        let w = Math.abs(this.dragState.w || 40);
        let h = Math.abs(this.dragState.h || 40);
        if (w > 5 && h > 5) {
          let shape = new VecShape('rect');
          shape.x = this.dragState.startX + (this.dragState.w || 0) / 2;
          shape.y = this.dragState.startY + (this.dragState.h || 0) / 2;
          shape.w = w;
          shape.h = h;
          this.addShape(shape);
        }
      } else if (this.dragState.tool === 'ellipse') {
        let w = Math.abs(this.dragState.w || 40);
        let h = Math.abs(this.dragState.h || 40);
        if (w > 5 && h > 5) {
          let shape = new VecShape('ellipse');
          shape.x = this.dragState.startX + (this.dragState.w || 0) / 2;
          shape.y = this.dragState.startY + (this.dragState.h || 0) / 2;
          shape.w = w;
          shape.h = h;
          this.addShape(shape);
        }
      } else if (this.dragState.tool === 'polygon') {
        let dx = this.dragState.w || 0;
        let dy = this.dragState.h || 0;
        let radius = Math.sqrt(dx * dx + dy * dy);
        if (radius > 5) {
          let sides = parseInt(document.getElementById('vecPolySides').value) || 6;
          let shape = new VecShape('polygon');
          shape.x = this.dragState.startX;
          shape.y = this.dragState.startY;
          shape.closed = true;
          shape.points = [];
          for (let i = 0; i < sides; i++) {
            let angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
            shape.points.push({
              x: Math.cos(angle) * radius,
              y: Math.sin(angle) * radius
            });
          }
          this.addShape(shape);
        }
      }
      this.dragState = null;
      this.render();
    }
  },

  onDblClick(e) {
    if (this.tool === 'pen' && this.penPoints.length >= 2) {
      let shape = new VecShape('path');
      shape.points = [...this.penPoints];
      shape.closed = false;
      // Center the shape at the centroid
      let cx = this.penPoints.reduce((s, p) => s + p.x, 0) / this.penPoints.length;
      let cy = this.penPoints.reduce((s, p) => s + p.y, 0) / this.penPoints.length;
      shape.x = cx;
      shape.y = cy;
      for (let p of shape.points) { p.x -= cx; p.y -= cy; }
      this.addShape(shape);
      this.penPoints = [];
    }
  },

  renderPreview(state) {
    let ctx = this.ctx;
    this.render(); // re-render base (ctx.restore() no final)
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    // Normalize negative dimensions
    let x = state.startX, y = state.startY, w = state.w || 0, h = state.h || 0;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    ctx.fillStyle = document.getElementById('vecFillColor').value;
    ctx.globalAlpha = 0.15;
    if (state.tool === 'rect') {
      ctx.fillRect(x, y, w, h);
    } else if (state.tool === 'polygon') {
      let sides = parseInt(document.getElementById('vecPolySides').value) || 6;
      let radius = Math.sqrt((state.w || 0) ** 2 + (state.h || 0) ** 2);
      let cx = state.startX, cy = state.startY;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        let angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        let px = cx + Math.cos(angle) * radius;
        let py = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    } else {
      ctx.beginPath(); ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    if (state.tool === 'rect') {
      ctx.strokeRect(x, y, w, h);
    } else {
      ctx.beginPath(); ctx.ellipse(x + w/2, y + h/2, w/2, h/2, 0, 0, Math.PI*2); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  },

  deselectAll() {
    this.selectedPoint = null;
    for (let layer of this.layers) {
      for (let s of layer.shapes) s.selected = false;
    }
  },

  deleteSelected() {
    if (!this.selectedShapes().length) return;
    this.saveState();
    for (let layer of this.layers) {
      layer.shapes = layer.shapes.filter(s => !s.selected);
    }
    this.render();
    this.updateLayersUI();
  },

  // ── Boolean Operations (pixel-perfect via Canvas compositing) ──
  booleanOp(op) {
    let selected = [];
    for (let layer of this.layers) {
      for (let s of layer.shapes) if (s.selected) selected.push(s);
    }
    if (selected.length < 2) {
      this.updateStatus('Boolean: select at least 2 shapes');
      return;
    }
    this.saveState();

    // Render all shapes to an offscreen canvas using compositing modes
    let oc = document.createElement('canvas');
    oc.width = this._baseSize;
    oc.height = this._baseSize;
    let octx = oc.getContext('2d');

    let compositeMode = op === 'union' ? 'source-over' : (op === 'subtract' ? 'destination-out' : 'source-in');

    // Draw first shape
    octx.clearRect(0, 0, oc.width, oc.height);
    this._renderShapeOnto(octx, selected[0], '#ffffff', true);
    if (op === 'subtract') {
      // For subtract: draw additional shapes with destination-out
      for (let i = 1; i < selected.length; i++) {
        octx.globalCompositeOperation = 'destination-out';
        this._renderShapeOnto(octx, selected[i], '#ffffff', true);
      }
      octx.globalCompositeOperation = 'source-over';
    } else {
      // Union / Intersect: draw all shapes with the composite mode
      for (let i = 1; i < selected.length; i++) {
        octx.globalCompositeOperation = compositeMode;
        this._renderShapeOnto(octx, selected[i], '#ffffff', true);
      }
      octx.globalCompositeOperation('source-over');
    }

    // Detect pixels → generate polygon outline
    let imageData = octx.getImageData(0, 0, oc.width, oc.height);
    let data = imageData.data;
    let outlinePoints = this._traceOutline(data, oc.width, oc.height);

    // Create result shape
    let merged = new VecShape('polygon');
    merged.fill = selected[0].fill;
    merged.stroke = selected[0].stroke;
    merged.strokeWidth = selected[0].strokeWidth;
    merged.usePatternColor = selected[0].usePatternColor;

    if (outlinePoints.length >= 3) {
      // Center the points
      let cx = outlinePoints.reduce((s, p) => s + p.x, 0) / outlinePoints.length;
      let cy = outlinePoints.reduce((s, p) => s + p.y, 0) / outlinePoints.length;
      merged.x = cx;
      merged.y = cy;
      merged.points = outlinePoints.map(p => ({ x: p.x - cx, y: p.y - cy }));
      merged.closed = true;
    } else {
      // Fallback: just use rect bounds
      let bx = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };
      for (let s of selected) {
        let b = s.bounds;
        bx.x = Math.min(bx.x, b.x);
        bx.y = Math.min(bx.y, b.y);
        bx.x2 = Math.max(bx.x2, b.x + b.w);
        bx.y2 = Math.max(bx.y2, b.y + b.h);
      }
      merged.type = 'rect';
      merged.x = (bx.x + bx.x2) / 2;
      merged.y = (bx.y + bx.y2) / 2;
      merged.w = bx.x2 - bx.x;
      merged.h = bx.y2 - bx.y;
    }

    // Remove selected shapes, add result
    let keepId = merged.id = this.nextId++;
    for (let layer of this.layers) {
      layer.shapes = layer.shapes.filter(s => !s.selected);
    }
    this.activeLayer.shapes.push(merged);
    merged.selected = true;
    this.render();
    this.updateLayersUI();
    this.updateStatus(`Boolean ${op} done`);
  },

  // Render a single shape onto an offscreen context
  _renderShapeOnto(ctx, shape, fillColor, useFill) {
    ctx.save();
    ctx.translate(shape.x, shape.y);
    ctx.rotate(shape.rotation);
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = fillColor;
    ctx.lineWidth = 0;

    if (shape.type === 'rect') {
      ctx.beginPath();
      ctx.rect(-shape.w / 2, -shape.h / 2, shape.w, shape.h);
      ctx.fill();
    } else if (shape.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(0, 0, shape.w / 2, shape.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape.type === 'polygon' || shape.type === 'path') {
      if (shape.points.length < 2) { ctx.restore(); return; }
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      if (shape.closed) ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },

  // Trace pixel outline to polygon points (Moore-Neighbor contour tracing)
  _traceOutline(data, w, h) {
    // Find starting pixel
    let startX = -1, startY = -1;
    for (let y = 0; y < h && startX < 0; y++) {
      for (let x = 0; x < w && startX < 0; x++) {
        if (data[(y * w + x) * 4 + 3] > 128) {
          startX = x; startY = y;
        }
      }
    }
    if (startX < 0) return [];

    // Moore-Neighbor tracing
    let points = [];
    let cx = startX, cy = startY;
    let dir = 7; // start direction (NW)
    let startDir = dir;
    let maxPts = w * h;

    // 8-direction offsets: E, SE, S, SW, W, NW, N, NE
    let dx = [1, 1, 0, -1, -1, -1, 0, 1];
    let dy = [0, 1, 1, 1, 0, -1, -1, -1];

    let first = true;
    while (maxPts-- > 0) {
      // Check if we've returned to start
      if (!first && cx === startX && cy === startY) break;
      first = false;
      points.push({ x: cx, y: cy });

      let found = false;
      for (let i = 0; i < 8; i++) {
        let nd = (dir + i) % 8;
        let nx = cx + dx[nd];
        let ny = cy + dy[nd];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          if (data[(ny * w + nx) * 4 + 3] > 128) {
            cx = nx; cy = ny;
            dir = (nd + 6) % 8; // turn back 2 steps (clockwise-1)
            found = true;
            break;
          }
        }
      }
      if (!found) break;

      // Simplify: only keep points that change direction significantly
      if (points.length > 2) {
        let p0 = points[points.length - 3];
        let p1 = points[points.length - 2];
        let p2 = points[points.length - 1];
        let dx1 = p1.x - p0.x, dy1 = p1.y - p0.y;
        let dx2 = p2.x - p1.x, dy2 = p2.y - p1.y;
        if (dx1 === dx2 && dy1 === dy2) {
          points.pop(); // remove redundant midpoint
        }
      }
    }

    // Simplify further: Douglas-Peucker or minimum distance
    if (points.length > 3) {
      let simplified = [points[0]];
      for (let i = 1; i < points.length - 1; i++) {
        let p = points[i];
        let prev = points[i - 1];
        let next = points[i + 1];
        // Skip if collinear (both axes same direction)
        if (!((p.x === prev.x && p.x === next.x) || (p.y === prev.y && p.y === next.y))) {
          simplified.push(p);
        }
      }
      simplified.push(points[points.length - 1]);
      points = simplified;
    }

    return points;
  },

  // ── Generate p5.js tile render code from vector shapes ──
  generateTileRenderCode() {
    if (this.activeLayer.shapes.length === 0) return '';
    let code = '';
    for (let shape of this.activeLayer.shapes) {
      code += this._shapeToP5Code(shape);
    }
    return code;
  },

  _shapeToP5Code(shape) {
    let parts = [];
    if (shape.usePatternColor) {
      parts.push('  ctx.fill(c);');
    } else {
      let hex = shape.fill.replace('#', '');
      let r = parseInt(hex.substr(0,2), 16);
      let g = parseInt(hex.substr(2,2), 16);
      let b = parseInt(hex.substr(4,2), 16);
      parts.push(`  ctx.fill(${r}, ${g}, ${b});`);
    }
    if (shape.strokeWidth > 0) {
      let shex = shape.stroke.replace('#', '');
      let sr = parseInt(shex.substr(0,2), 16);
      let sg = parseInt(shex.substr(2,2), 16);
      let sb = parseInt(shex.substr(4,2), 16);
      parts.push(`  ctx.stroke(${sr}, ${sg}, ${sb});`);
      parts.push(`  ctx.strokeWeight(${shape.strokeWidth});`);
    } else {
      parts.push('  ctx.noStroke();');
    }

    let sx = shape.x.toFixed(1), sy = shape.y.toFixed(1);

    if (shape.type === 'rect') {
      let sw = shape.w.toFixed(1), sh = shape.h.toFixed(1);
      parts.push(`  ctx.rect(${sx} - ${sw}/2, ${sy} - ${sh}/2, ${sw}, ${sh});`);
    } else if (shape.type === 'ellipse') {
      let sw = shape.w.toFixed(1), sh = shape.h.toFixed(1);
      parts.push(`  ctx.ellipse(${sx}, ${sy}, ${sw}, ${sh});`);
    } else if (shape.type === 'polygon' || shape.type === 'path') {
      if (shape.points.length < 2) return '';
      parts.push('  ctx.beginShape();');
      for (let p of shape.points) {
        let px = (shape.x + p.x).toFixed(1);
        let py = (shape.y + p.y).toFixed(1);
        if (p.handleIn || p.handleOut) {
          let cx1 = (shape.x + p.x + (p.handleIn ? p.handleIn.x : 0)).toFixed(1);
          let cy1 = (shape.y + p.y + (p.handleIn ? p.handleIn.y : 0)).toFixed(1);
          parts.push(`  ctx.vertex(${px}, ${py}, ${cx1}, ${cy1});`);
        } else {
          parts.push(`  ctx.vertex(${px}, ${py});`);
        }
      }
      if (shape.closed) parts.push('  ctx.endShape(ctx.CLOSE);');
      else parts.push('  ctx.endShape();');
    }
    return parts.join('\n') + '\n';
  },

  // ── Export Tile Mode: Generate complete tile renderer ──
  exportTile() {
    let shapeCode = this.generateTileRenderCode();
    if (!shapeCode) {
      this.updateStatus('❌ No shapes to export — draw something first!');
      return;
    }

    let name = document.getElementById('vecTileName')?.value?.trim() || `Vector Tile #${Date.now()}`;
    let code = `(ctx, w, h, pad, c) => {\n`;
    code += `  ctx.push();\n`;
    code += `  ctx.rectMode(ctx.CENTER);\n`;
    code += `  ctx.noStroke();\n`;
    code += `  // Auto-generated from Vector Editor shapes\n`;
    code += `  ctx.translate(w/2, h/2);\n`;
    code += `  ctx.scale(w/${this._baseSize}, h/${this._baseSize});\n`;
    code += shapeCode;
    code += `  ctx.pop();\n`;
    code += `};`;

    console.log('=== VECTOR TILE RENDERER ===');
    console.log(code);
    console.log('=== END ===');

    try {
      let renderFn = eval(code);
      let tileId = registerTile({
        name: name,
        family: document.getElementById('vecTileFamily')?.value?.trim() || 'vector',
        symmetric: true,
        render: renderFn
      });
      this.updateStatus(`✅ Tile #${tileId} ("${name}") registered!`);
      if (typeof generateTileThumbnails === 'function') {
        generateTileThumbnails();
      }
    } catch (err) {
      this.updateStatus(`❌ Export error: ${err.message}`);
      console.error(err);
    }
  },

  // ── Register current composition from UI ──
  registerCurrentTile() {
    this.exportTile();
  }
};

// ── Initialize on tab switch ──
window.addEventListener('tabChanged', (e) => {
  if (e.detail.tab === 'vector') {
    try {
      if (!vecEditor.canvas || !vecEditor.canvas.isConnected) vecEditor.init();
      else { vecEditor.resize(); vecEditor.render(); }
    } catch (err) {
      console.error('Vector Editor init error:', err);
    }
  }
});
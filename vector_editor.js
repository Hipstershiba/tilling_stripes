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
      [b.x, b.y, 'resize'], [b.x + b.w, b.y, 'resize'],
      [b.x, b.y + b.h, 'resize'], [b.x + b.w, b.y + b.h, 'resize']
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
  zoom: 1,
  _baseSize: 400,
  undoStack: [],
  redoStack: [],

  init() {
    this.canvas = document.getElementById('vecCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.layers = [new VecLayer('Layer 1')];
    this.setupUI();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.render();
  },

  resize() {
    let wrap = this.canvas.parentElement;
    if (!wrap) return;
    let rect = wrap.getBoundingClientRect();
    let size = Math.min(rect.width - 8, rect.height - 8, 1200);
    this._baseSize = Math.max(200, Math.round(size));
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
    if (sel.length === 1) {
      document.getElementById('vecFillColor').value = sel[0].fill;
      document.getElementById('vecStrokeColor').value = sel[0].stroke;
      document.getElementById('vecStrokeWidth').value = sel[0].strokeWidth;
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

  // ── Screen coords → canvas coords (in _baseSize space, before zoom) ──
  canvasCoords(e) {
    let rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this._baseSize / rect.width),
      y: (e.clientY - rect.top) * (this._baseSize / rect.height)
    };
  },

  // ── Get shape points in absolute canvas coords ──
  getShapePoints(shape) {
    if (!shape.points || shape.points.length === 0) return [];
    return shape.points.map(p => ({
      x: (shape.x + p.x),
      y: (shape.y + p.y)
    }));
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
      // First check points on selected path/polygon shapes
      for (let shape of layer.shapes) {
        if (!shape.selected || (shape.type !== 'path' && shape.type !== 'polygon')) continue;
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

    // Points on selected shapes when using Direct Select
    if (this.tool === 'direct') {
      for (let layer of this.layers) {
        if (!layer.visible) continue;
        for (let shape of layer.shapes) {
          if (!shape.selected || (shape.type !== 'path' && shape.type !== 'polygon')) continue;
          let pts = this.getShapePoints(shape);
          for (let i = 0; i < pts.length; i++) {
            let p = this.selectedPoint && this.selectedPoint.shape === shape && this.selectedPoint.pointIdx === i;
            // Point dot
            ctx.fillStyle = p ? '#2196F3' : '#fff';
            ctx.strokeStyle = p ? '#fff' : '#888';
            ctx.lineWidth = 1.5 / this.zoom;
            ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, p ? 5 / this.zoom : 3.5 / this.zoom, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            // Bezier handles for selected point
            if (p) {
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

    // Pen preview
    if (this.tool === 'pen' && this.penPoints.length > 0) {
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.penPoints[0].x, this.penPoints[0].y);
      for (let i = 1; i < this.penPoints.length; i++)
        ctx.lineTo(this.penPoints[i].x, this.penPoints[i].y);
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
    }

    ctx.restore();

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

    if (this.tool === 'direct') {
      let hit = this.hitTest(mx, my);
      if (!e.shiftKey) this.deselectAll();
      this.selectedPoint = null;
      if (hit) {
        if (hit.point !== undefined) {
          hit.shape.selected = true;
          this.selectedPoint = { shape: hit.shape, pointIdx: hit.point };
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
          this.dragState = { shape: hit.shape, startX: mx, startY: my, handle: hit.handle, origBounds: {...hit.shape.bounds} };
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
      this.penPoints.push({ x: mx, y: my });
      if (this.penPoints.length >= 2) {
        // Preview live
        this.render();
      }
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
        if (this.dragState.shape.points.length > 0) {
          // Move polygon/path points too
          for (let p of this.dragState.shape.points) { p.x += dx; p.y += dy; }
        }
        this.dragState.startX = mx;
        this.dragState.startY = my;
        this.render();
      } else if (this.dragState.shape && this.dragState.handle === 'resize') {
        // Resize from corner
        let b = this.dragState.origBounds;
        let dx = mx - this.dragState.startX;
        let dy = my - this.dragState.startY;
        // Simple proportional resize
        this.dragState.shape.w = Math.max(10, b.w + dx);
        this.dragState.shape.h = Math.max(10, b.h + dy);
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
    if (this.dragState) {
      if (this.dragState.shape && this.dragState.handle === null) {
        // Shape was moved — save state
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

  // ── Boolean Operations (simplified) ──
  booleanOp(op) {
    let selected = [];
    for (let layer of this.layers) {
      for (let s of layer.shapes) if (s.selected) selected.push(s);
    }
    if (selected.length < 2) {
      this.updateStatus(`Boolean: select at least 2 shapes`);
      return;
    }
    this.saveState();
    // For now, merge shapes that overlap (simple bounding-box union)
    // A full implementation would do proper polygon boolean
    let merged = selected[0];
    let b = merged.bounds;
    for (let i = 1; i < selected.length; i++) {
      let sb = selected[i].bounds;
      if (op === 'union') {
        // Expand to contain both
        let nx = Math.min(b.x, sb.x);
        let ny = Math.min(b.y, sb.y);
        let nw = Math.max(b.x + b.w, sb.x + sb.w) - nx;
        let nh = Math.max(b.y + b.h, sb.y + sb.h) - ny;
        merged.x = nx + nw / 2;
        merged.y = ny + nh / 2;
        merged.w = nw;
        merged.h = nh;
        if (merged.type === 'polygon' || merged.type === 'path') {
          merged.type = 'rect';
          merged.points = [];
        }
      } else if (op === 'subtract') {
        // Simple visual difference: color the first one differently
        merged.fill = '#ff4444';
      } else if (op === 'intersect') {
        // For overlap, shrink to intersection
        let ix = Math.max(b.x, sb.x);
        let iy = Math.max(b.y, sb.y);
        let iw = Math.min(b.x + b.w, sb.x + sb.w) - ix;
        let ih = Math.min(b.y + b.h, sb.y + sb.h) - iy;
        if (iw > 0 && ih > 0) {
          merged.x = ix + iw / 2;
          merged.y = iy + ih / 2;
          merged.w = iw;
          merged.h = ih;
          merged.type = 'rect';
          merged.points = [];
        }
      }
    }
    // Remove merged shapes, keep the result
    for (let layer of this.layers) {
      layer.shapes = layer.shapes.filter(s => !s.selected || s === merged);
    }
    merged.selected = true;
    this.render();
    this.updateLayersUI();
    this.updateStatus(`Boolean ${op} done`);
  },

  // ── Export as Tile Renderer ──
  exportTile() {
    // Rasterize the canvas to get the pixel pattern
    let w = this.canvas.width, h = this.canvas.height;
    let tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.gridSize;
    tempCanvas.height = this.gridSize;
    let tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(this.canvas, 0, 0, w, h, 0, 0, this.gridSize, this.gridSize);

    // Get pixel data
    let data = tCtx.getImageData(0, 0, this.gridSize, this.gridSize).data;

    // Generate renderer function code
    let code = `// Vector tile renderer — exported from Vector Editor\n`;
    code += `TILE_RENDERERS.push((ctx, w, h, pad, c) => {\n`;
    code += `  ctx.push();\n`;
    code += `  ctx.translate(w/2, h/2);\n`;
    code += `  ctx.fill(c);\n`;
    code += `  ctx.noStroke();\n`;
    code += `  ctx.rectMode(ctx.CENTER);\n`;
    code += `  // Raster pattern (${this.gridSize}x${this.gridSize})\n`;

    // Sample grid points for pixel pattern
    let step = this.gridSize / 4; // 4x4 subtile sampling
    for (let subY = 0; subY < 4; subY++) {
      for (let subX = 0; subX < 4; subX++) {
        // Sample center of each subtile area
        let sx = Math.floor((subX + 0.5) * step);
        let sy = Math.floor((subY + 0.5) * step);
        let idx = (sy * this.gridSize + sx) * 4;
        let r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        if (a > 128) {
          let lx = (subX - 1.5) * w / 4;
          let ly = (subY - 1.5) * h / 4;
          code += `  ctx.fill(${r}, ${g}, ${b}, ${a});\n`;
          code += `  ctx.rect(${lx.toFixed(1)}, ${ly.toFixed(1)}, w/4, h/4);\n`;
        }
      }
    }

    code += `  ctx.pop();\n`;
    code += `});\n`;

    // Show in a modal or console
    this.updateStatus(`Tile renderer generated! Registered as tile #${TILE_RENDERERS.length}`);
    console.log('=== VECTOR TILE RENDERER ===');
    console.log(code);
    console.log('=== END ===');

    // Actually register it
    try {
      eval(code);
      this.updateStatus(`✅ Tile #${TILE_RENDERERS.length - 1} registered! Check console for code.`);
    } catch (err) {
      this.updateStatus(`❌ Export error: ${err.message}`);
    }
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
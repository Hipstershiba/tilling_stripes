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
      let xs = this.points.map(p => p.x), ys = this.points.map(p => p.y);
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
  gridSize: 80, // subtile cell size in vector space
  nextId: 1,
  zoom: 1,
  panX: 0, panY: 0,
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
    // Fill available space — max 1200 to avoid absurd sizes
    let size = Math.min(rect.width - 8, rect.height - 8, 1200);
    this.canvas.width = Math.max(200, Math.round(size));
    this.canvas.height = this.canvas.width;
    this.render();
  },

  get activeLayer() {
    return this.layers[this.activeLayerIdx];
  },

  setTool(tool) {
    this.tool = tool;
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
    let type = this.tool === 'pen' ? 'path' : 'polygon';
    let shape = new VecShape(type);
    shape.points = [...this.penPoints];
    shape.closed = type === 'polygon';
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
    this.zoom = Math.max(0.1, Math.min(10, z));
    document.getElementById('vecZoomLevel').textContent = Math.round(this.zoom * 100) + '%';
    this.render();
  },

  zoomIn() { this.setZoom(this.zoom * 1.25); },
  zoomOut() { this.setZoom(this.zoom / 1.25); },
  resetZoom() { this.setZoom(1); },

  // ── Screen coords → canvas coords (accounting for zoom) ──
  canvasCoords(e) {
    let rect = this.canvas.getBoundingClientRect();
    let mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    let my = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    // Un-apply zoom transform: (coord - center) / zoom + center
    let cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    return {
      x: (mx - cx) / this.zoom + cx,
      y: (my - cy) / this.zoom + cy
    };
  },

  // ── Hit Testing ──
  hitTest(px, py) {
    // Check from top (last drawn = top of layer) to bottom
    let layer = this.activeLayer;
    for (let i = layer.shapes.length - 1; i >= 0; i--) {
      let s = layer.shapes[i];
      // Check handles first (if using select tool)
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

    // Apply zoom transform (centered)
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-w / 2, -h / 2);

    // Grid lines
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 0.5 / this.zoom;
    let step = w / this.gridSize;
    for (let i = 0; i <= this.gridSize; i++) {
      let p = i * step;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke();
    }

    // Center cross
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1 / this.zoom;
    ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
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

    // Pen preview
    if ((this.tool === 'pen' || this.tool === 'polygon') && this.penPoints.length > 0) {
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2 / this.zoom;
      ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
      ctx.beginPath();
      ctx.moveTo(this.penPoints[0].x, this.penPoints[0].y);
      for (let i = 1; i < this.penPoints.length; i++)
        ctx.lineTo(this.penPoints[i].x, this.penPoints[i].y);
      if (this.tool === 'polygon' || this.penPoints.length > 1) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      for (let p of this.penPoints) {
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4 / this.zoom, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5 / this.zoom;
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
        else if (e.key === 'p' || e.key === 'P') this.setTool('pen');
        else if (e.key === 'r' || e.key === 'R') this.setTool('rect');
        else if (e.key === 'e' || e.key === 'E') this.setTool('ellipse');
        else if (e.key === 'g' || e.key === 'G') this.setTool('polygon');
        else if (e.key === 'Delete' || e.key === 'Backspace') this.deleteSelected();
        else if (e.key === 'Escape') { this.deselectAll(); this.penPoints = []; this.render(); }
        else if (e.key === 'Enter' && (this.tool === 'pen' || this.tool === 'polygon')) {
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
    let sel = this.activeLayer.shapes.filter(s => s.selected).length;
    el.textContent = `${this.tool.charAt(0).toUpperCase() + this.tool.slice(1)} | ${this.activeLayer.shapes.length} shapes | ${sel} selected`;
  },

  // ── Mouse Handlers ──
  onMouseDown(e) {
    let { x: mx, y: my } = this.canvasCoords(e);

    if (this.tool === 'select') {
      let hit = this.hitTest(mx, my);
      if (hit) {
        this.deselectAll();
        hit.shape.selected = true;
        this.syncPropsToUI();
        if (hit.handle) {
          this.dragState = { shape: hit.shape, startX: mx, startY: my, handle: hit.handle, origBounds: {...hit.shape.bounds} };
        } else {
          this.dragState = { shape: hit.shape, startX: mx, startY: my, handle: null };
        }
        this.render();
        this.updateLayersUI();
      } else {
        this.deselectAll();
        this.render();
      }
    } else if (this.tool === 'pen') {
      this.penPoints.push({ x: mx, y: my });
      if (this.penPoints.length >= 2) {
        // Preview live
        this.render();
      }
    } else if (this.tool === 'polygon') {
      this.penPoints.push({ x: mx, y: my });
      this.render();
    } else if (this.tool === 'rect') {
      this.dragState = { tool: 'rect', startX: mx, startY: my };
    } else if (this.tool === 'ellipse') {
      this.dragState = { tool: 'ellipse', startX: mx, startY: my };
    }
  },

  onMouseMove(e) {
    let { x: mx, y: my } = this.canvasCoords(e);

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
      }
    } else {
      // Update cursor
      let hit = this.hitTest(mx, my);
      this.canvas.style.cursor = hit ? 'pointer' : 'crosshair';
    }
  },

  onMouseUp() {
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
      }
      this.dragState = null;
      this.render();
    }
  },

  onDblClick(e) {
    if (this.tool === 'pen' && this.penPoints.length >= 2) {
      let { x: mx, y: my } = this.canvasCoords(e);
      this.penPoints.push({ x: mx, y: my });
      // Close and create path shape
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
    } else if (this.tool === 'polygon' && this.penPoints.length >= 2) {
      let shape = new VecShape('polygon');
      shape.points = [...this.penPoints];
      shape.closed = true;
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
    this.render(); // re-render base first
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(state.startX, state.startY, state.w || 0, state.h || 0);
    ctx.setLineDash([]);
  },

  deselectAll() {
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
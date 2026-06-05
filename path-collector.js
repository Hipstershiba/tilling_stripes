/**
 * PathCollector — a drawing context with the same surface as p5.Graphics
 * and SimpleSVG (for the subset used by TILE_RENDERERS), but instead of
 * rendering to pixels or SVG elements it records every shape as a polyline
 * in world coordinates. The result is fed directly into GCode export.
 *
 * This enables pen‑plotter GCode generation: filled shapes become traced
 * outlines, stroked shapes become stroke paths.
 */
class PathCollector {

    constructor(w, h) {
        this.w = w;
        this.h = h;
        /** @type {{points:[number,number][], closed:boolean}[]} */
        this.paths = [];

        // Transform stack  (same layout as SimpleSVG)
        this.matrixStack = [{ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }];

        // Style state
        this.currentFill = 'none';
        this.currentStroke = 'none';
        this.currentStrokeWeight = 1;

        // beginShape / endShape accumulation
        this.isBuildingShape = false;
        this.vertices = [];
    }

    // ------------------------------------------------------------------
    //  Matrix helpers (shared with SimpleSVG)
    // ------------------------------------------------------------------
    get currentMatrix() {
        return this.matrixStack[this.matrixStack.length - 1];
    }

    push() {
        const m = this.currentMatrix;
        this.matrixStack.push({ ...m });
    }

    pop() {
        if (this.matrixStack.length > 1) this.matrixStack.pop();
    }

    translate(x, y) {
        const m = this.currentMatrix;
        m.e += m.a * x + m.c * y;
        m.f += m.b * x + m.d * y;
    }

    scale(sx, sy) {
        if (sy === undefined) sy = sx;
        const m = this.currentMatrix;
        m.a *= sx;
        m.b *= sx;
        m.c *= sy;
        m.d *= sy;
    }

    rotate(angle) {
        const m = this.currentMatrix;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const a = m.a, b = m.b, cv = m.c, d = m.d;
        m.a = a * c + cv * s;
        m.b = b * c + d * s;
        m.c = a * -s + cv * c;
        m.d = b * -s + d * c;
    }

    /** Map a point through the current transform matrix */
    _mapPoint(x, y) {
        const m = this.currentMatrix;
        return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
    }

    /** Map an array of [x,y] points through the current transform */
    _mapPoints(pts) {
        return pts.map(p => this._mapPoint(p[0], p[1]));
    }

    // ------------------------------------------------------------------
    //  Style – tracked but not rendered (used to decide what to trace)
    // ------------------------------------------------------------------
    fill(c) { this.currentFill = c; }
    noFill() { this.currentFill = 'none'; }
    stroke(c) { this.currentStroke = c; }
    noStroke() { this.currentStroke = 'none'; }
    strokeWeight(w) { this.currentStrokeWeight = w; }
    background() { /* ignored – no background rect for GCode */ }

    /** Whether we should trace this shape's outline / stroke path */
    _shouldTrace() {
        return this.currentFill !== 'none' || this.currentStroke !== 'none';
    }

    // ------------------------------------------------------------------
    //  Path emission helpers
    // ------------------------------------------------------------------
    _emitPolyline(points, closed) {
        if (points.length < 2) return;
        this.paths.push({
            points: this._mapPoints(points),
            closed: !!closed,
        });
    }

    /** Approximate an arc with line segments (clockwise) */
    _arcToPoints(cx, cy, rx, ry, startAngle, endAngle, numSegments) {
        const pts = [];
        let diff = endAngle - startAngle;
        while (diff < 0) diff += Math.PI * 2;
        while (diff > Math.PI * 2) diff -= Math.PI * 2;
        const steps = numSegments || Math.max(8, Math.ceil(diff / (Math.PI / 12)));
        for (let i = 0; i <= steps; i++) {
            const a = startAngle + diff * (i / steps);
            pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
        }
        return pts;
    }

    /** Approximate a full ellipse as line segments */
    _ellipseToPoints(cx, cy, rx, ry, numSegments) {
        const n = numSegments || Math.max(12, Math.ceil((rx + ry) / 4));
        const pts = [];
        for (let i = 0; i <= n; i++) {
            const a = (Math.PI * 2 * i) / n;
            pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
        }
        return pts;
    }

    // ------------------------------------------------------------------
    //  Shapes
    // ------------------------------------------------------------------
    rect(x, y, w, h) {
        if (!this._shouldTrace()) return;
        let rx = x, ry = y, rw = w, rh = h;
        if (rw < 0) { rx += rw; rw = -rw; }
        if (rh < 0) { ry += rh; rh = -rh; }
        this._emitPolyline([
            [rx, ry],
            [rx + rw, ry],
            [rx + rw, ry + rh],
            [rx, ry + rh],
            [rx, ry],
        ], true);
    }

    ellipse(x, y, w, h) {
        if (!this._shouldTrace()) return;
        const rx = w / 2;
        const ry = h / 2;
        const pts = this._ellipseToPoints(x, y, rx, ry);
        this._emitPolyline(pts, true);
    }

    triangle(x1, y1, x2, y2, x3, y3) {
        if (!this._shouldTrace()) return;
        this._emitPolyline([
            [x1, y1], [x2, y2], [x3, y3], [x1, y1],
        ], true);
    }

    line(x1, y1, x2, y2) {
        if (this.currentStroke === 'none') return;
        this._emitPolyline([
            [x1, y1], [x2, y2],
        ], false);
    }

    // ------------------------------------------------------------------
    //  Vertex shapes
    // ------------------------------------------------------------------
    beginShape() {
        this.isBuildingShape = true;
        this.vertices = [];
    }

    vertex(x, y) {
        if (this.isBuildingShape) {
            this.vertices.push([x, y]);
        }
    }

    endShape(mode) {
        if (!this.isBuildingShape) return;
        this.isBuildingShape = false;
        if (this.vertices.length < 2) return;

        const closed = (mode === 'CLOSE' || mode === 'close');
        const pts = [...this.vertices];
        // For closed paths (fill), close the polyline; for strokes emit as-is
        if (closed) pts.push(pts[0]);

        this._emitPolyline(pts, closed);
    }

    // ------------------------------------------------------------------
    //  Arc
    // ------------------------------------------------------------------
    arc(x, y, w, h, start, stop) {
        const rx = w / 2;
        const ry = h / 2;
        const diff = stop - start;

        if (this.currentFill !== 'none') {
            // Full circle shortcut
            if (diff >= Math.PI * 2 - 0.001) {
                this.ellipse(x, y, w, h);
                return;
            }
            // Filled arc = pie slice (sector): center → start → arc → close
            const arcPts = this._arcToPoints(x, y, rx, ry, start, stop);
            const sector = [[x, y], ...arcPts, [x, y]];
            this._emitPolyline(sector, true);
        } else if (this.currentStroke !== 'none') {
            // Stroked arc = just the arc curve
            const arcPts = this._arcToPoints(x, y, rx, ry, start, stop);
            this._emitPolyline(arcPts, false);
        }
    }

    // ------------------------------------------------------------------
    //  Results
    // ------------------------------------------------------------------
    /** Returns the collected polylines */
    getPathData() {
        return this.paths;
    }

    /** Returns total number of points across all paths */
    getPointCount() {
        let count = 0;
        for (const p of this.paths) count += p.points.length;
        return count;
    }
}
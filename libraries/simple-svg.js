class SimpleSVG {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.elements = []; // List of SVG strings
        this.defs = []; // List of <defs> children (e.g. clipPath)
        this._nextClipId = 1;
        // Transformation stack. Each matrix is {a,b,c,d,e,f} plus saved style state
        this.matrixStack = [{a:1, b:0, c:0, d:1, e:0, f:0}];

        this.currentFill = 'none';
        this.currentStroke = 'none';
        this.currentStrokeWeight = 1;
        this.currentFillRule = null;
        this.currentStrokeCap = null;
        this.currentStrokeJoin = null;

        // For beginShape/endShape (supports vertices, cubic/quadratic curves & inner contours/holes)
        this.isBuildingShape = false;
        this.isBuildingContour = false;
        this.vertices = [];
        this.contours = [];
        this.currentContour = [];
    }

    get currentMatrix() {
        return this.matrixStack[this.matrixStack.length - 1];
    }

    // --- Transforms ---

    push() {
        let m = this.currentMatrix;
        this.matrixStack.push({
            a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f,
            _fill: this.currentFill,
            _stroke: this.currentStroke,
            _strokeWeight: this.currentStrokeWeight,
            _fillRule: this.currentFillRule,
            _strokeCap: this.currentStrokeCap,
            _strokeJoin: this.currentStrokeJoin
        });
    }

    pop() {
        if (this.matrixStack.length > 1) {
            const popped = this.matrixStack.pop();
            if (popped._fill !== undefined) this.currentFill = popped._fill;
            if (popped._stroke !== undefined) this.currentStroke = popped._stroke;
            if (popped._strokeWeight !== undefined) this.currentStrokeWeight = popped._strokeWeight;
            if (popped._fillRule !== undefined) this.currentFillRule = popped._fillRule;
            if (popped._strokeCap !== undefined) this.currentStrokeCap = popped._strokeCap;
            if (popped._strokeJoin !== undefined) this.currentStrokeJoin = popped._strokeJoin;
        }
    }

    translate(x, y) {
        let m = this.currentMatrix;
        m.e += m.a * x + m.c * y;
        m.f += m.b * x + m.d * y;
    }

    scale(sx, sy) {
        if (sy === undefined) sy = sx;
        let m = this.currentMatrix;
        m.a *= sx;
        m.b *= sx;
        m.c *= sy;
        m.d *= sy;
    }

    rotate(angle) {
        let m = this.currentMatrix;
        let c = Math.cos(angle);
        let s = Math.sin(angle);

        let a = m.a;
        let b = m.b;
        let c_val = m.c;
        let d = m.d;

        m.a = a * c + c_val * s;
        m.b = b * c + d * s;
        m.c = a * -s + c_val * c;
        m.d = b * -s + d * c;
    }

    // --- Styling ---

    fill(c) {
        this.currentFill = this._parseColor(c);
    }

    noFill() {
        this.currentFill = 'none';
    }

    stroke(c) {
        this.currentStroke = this._parseColor(c);
    }

    noStroke() {
        this.currentStroke = 'none';
    }

    strokeWeight(w) {
        this.currentStrokeWeight = w;
    }

    fillRule(rule) {
        this.currentFillRule = (rule === 'evenodd' || rule === 'nonzero') ? rule : null;
    }

    strokeCap(cap) {
        const map = {
            round: 'round', ROUND: 'round',
            square: 'butt', SQUARE: 'butt', butt: 'butt',
            project: 'square', PROJECT: 'square'
        };
        this.currentStrokeCap = map[cap] || null;
    }

    strokeJoin(join) {
        const map = {
            miter: 'miter', MITER: 'miter',
            bevel: 'bevel', BEVEL: 'bevel',
            round: 'round', ROUND: 'round'
        };
        this.currentStrokeJoin = map[join] || null;
    }

    // --- Clipping ---

    beginClipRect(x, y, w, h) {
        let rx = x, ry = y, rw = w, rh = h;
        if (rw < 0) { rx += rw; rw = -rw; }
        if (rh < 0) { ry += rh; rh = -rh; }
        const id = `ts_clip_${this._nextClipId++}`;
        const trans = this._getTransformAttr();
        this.defs.push(`<clipPath id="${id}"><rect x="${this._fmt(rx)}" y="${this._fmt(ry)}" width="${this._fmt(rw)}" height="${this._fmt(rh)}" ${trans} /></clipPath>`);
        this.elements.push(`<g clip-path="url(#${id})">`);
    }

    endClip() {
        this.elements.push(`</g>`);
    }

    // --- Shapes ---

    background(c) {
        let col = this._parseColor(c);
        if (col !== 'none') {
            this.elements.push(`<rect x="0" y="0" width="${this.w}" height="${this.h}" fill="${col}" stroke="none" />`);
        }
    }

    rect(x, y, w, h, r) {
        let rx = x, ry = y, rw = w, rh = h;
        if (rw < 0) { rx += rw; rw = -rw; }
        if (rh < 0) { ry += rh; rh = -rh; }

        let radiusAttr = '';
        if (typeof r === 'number' && r > 0) {
            const clampedR = Math.min(r, rw / 2, rh / 2);
            radiusAttr = `rx="${this._fmt(clampedR)}" ry="${this._fmt(clampedR)}" `;
        }

        let attrs = this._getStyleAttrs();
        let trans = this._getTransformAttr();
        this.elements.push(`<rect x="${this._fmt(rx)}" y="${this._fmt(ry)}" width="${this._fmt(rw)}" height="${this._fmt(rh)}" ${radiusAttr}${attrs} ${trans} />`);
    }

    ellipse(x, y, w, h) {
        let rx = Math.abs(w) / 2;
        let ry = Math.abs(h === undefined ? w : h) / 2;
        let attrs = this._getStyleAttrs();
        let trans = this._getTransformAttr();
        this.elements.push(`<ellipse cx="${this._fmt(x)}" cy="${this._fmt(y)}" rx="${this._fmt(rx)}" ry="${this._fmt(ry)}" ${attrs} ${trans} />`);
    }

    triangle(x1, y1, x2, y2, x3, y3) {
        let pts = `${this._fmt(x1)},${this._fmt(y1)} ${this._fmt(x2)},${this._fmt(y2)} ${this._fmt(x3)},${this._fmt(y3)}`;
        let attrs = this._getStyleAttrs();
        let trans = this._getTransformAttr();
        this.elements.push(`<polygon points="${pts}" ${attrs} ${trans} />`);
    }

    line(x1, y1, x2, y2) {
        let attrs = this._getStyleAttrs();
        let trans = this._getTransformAttr();
        this.elements.push(`<line x1="${this._fmt(x1)}" y1="${this._fmt(y1)}" x2="${this._fmt(x2)}" y2="${this._fmt(y2)}" ${attrs} ${trans} />`);
    }

    // --- Vertex & Bezier Shapes (with Contour/Hole Support) ---

    beginShape() {
        this.isBuildingShape = true;
        this.isBuildingContour = false;
        this.vertices = [];
        this.contours = [];
        this.currentContour = [];
    }

    beginContour() {
        if (!this.isBuildingShape) return;
        this.isBuildingContour = true;
        this.currentContour = [];
    }

    endContour() {
        if (!this.isBuildingShape || !this.isBuildingContour) return;
        this.isBuildingContour = false;
        if (this.currentContour.length > 0) {
            this.contours.push({ commands: this.currentContour, closed: true });
        }
        this.currentContour = [];
    }

    vertex(x, y) {
        if (!this.isBuildingShape) return;
        const target = this.isBuildingContour ? this.currentContour : this.vertices;
        target.push({ type: target.length === 0 ? 'M' : 'L', x, y });
    }

    bezierVertex(cx1, cy1, cx2, cy2, x, y) {
        if (!this.isBuildingShape) return;
        const target = this.isBuildingContour ? this.currentContour : this.vertices;
        if (target.length === 0) {
            target.push({ type: 'M', x: cx1, y: cy1 });
        }
        target.push({ type: 'C', cx1, cy1, cx2, cy2, x, y });
    }

    quadraticVertex(cx, cy, x, y) {
        if (!this.isBuildingShape) return;
        const target = this.isBuildingContour ? this.currentContour : this.vertices;
        if (target.length === 0) {
            target.push({ type: 'M', x: cx, y: cy });
        }
        target.push({ type: 'Q', cx, cy, x, y });
    }

    _serializeContourCommands(commands, closed) {
        if (!commands || commands.length === 0) return '';
        const parts = [];
        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            if (cmd.type === 'M' || i === 0) {
                parts.push(`M ${this._fmt(cmd.x)},${this._fmt(cmd.y)}`);
            } else if (cmd.type === 'L') {
                parts.push(`L ${this._fmt(cmd.x)},${this._fmt(cmd.y)}`);
            } else if (cmd.type === 'C') {
                parts.push(`C ${this._fmt(cmd.cx1)},${this._fmt(cmd.cy1)} ${this._fmt(cmd.cx2)},${this._fmt(cmd.cy2)} ${this._fmt(cmd.x)},${this._fmt(cmd.y)}`);
            } else if (cmd.type === 'Q') {
                parts.push(`Q ${this._fmt(cmd.cx)},${this._fmt(cmd.cy)} ${this._fmt(cmd.x)},${this._fmt(cmd.y)}`);
            }
        }
        if (closed) {
            parts.push('Z');
        }
        return parts.join(' ');
    }

    endShape(mode) {
        if (!this.isBuildingShape) return;
        this.isBuildingShape = false;
        this.isBuildingContour = false;

        if (this.vertices.length === 0 && this.contours.length === 0) return;

        const isClosed = (mode === 'CLOSE' || mode === 'close' || mode === 2);
        const subpaths = [];
        if (this.vertices.length > 0) {
            subpaths.push(this._serializeContourCommands(this.vertices, isClosed));
        }
        for (const c of this.contours) {
            const sub = this._serializeContourCommands(c.commands, c.closed);
            if (sub) subpaths.push(sub);
        }

        const d = subpaths.join(' ');
        if (!d) return;

        const prevRule = this.currentFillRule;
        if (this.contours.length > 0 && !this.currentFillRule) {
            this.currentFillRule = 'evenodd';
        }
        let attrs = this._getStyleAttrs();
        this.currentFillRule = prevRule;

        let trans = this._getTransformAttr();
        this.elements.push(`<path d="${d}" ${attrs} ${trans} />`);
    }

    // --- Arcs ---

    arc(x, y, w, h, start, stop, mode) {
        let rx = Math.abs(w) / 2;
        let ry = Math.abs(h) / 2;

        let startAngle = start;
        let endAngle = stop;

        let rawDiff = endAngle - startAngle;
        if (Math.abs(rawDiff) >= Math.PI * 2 - 0.0001) {
            this.ellipse(x, y, w, h);
            return;
        }

        let diff = rawDiff;
        while (diff < 0) diff += Math.PI * 2;
        while (diff > Math.PI * 2) diff -= Math.PI * 2;

        if (diff > Math.PI * 2 - 0.001) {
            this.ellipse(x, y, w, h);
            return;
        }

        let x1 = x + rx * Math.cos(startAngle);
        let y1 = y + ry * Math.sin(startAngle);
        let x2 = x + rx * Math.cos(endAngle);
        let y2 = y + ry * Math.sin(endAngle);

        let largeArc = (diff > Math.PI) ? 1 : 0;
        let sweep = 1; // clockwise

        let d;
        const arcMode = typeof mode === 'string' ? mode.toLowerCase() : null;
        if (arcMode === 'pie' || (!arcMode && this.currentFill !== 'none')) {
            d = `M ${this._fmt(x)},${this._fmt(y)} L ${this._fmt(x1)},${this._fmt(y1)} A ${this._fmt(rx)} ${this._fmt(ry)} 0 ${largeArc} ${sweep} ${this._fmt(x2)},${this._fmt(y2)} Z`;
        } else if (arcMode === 'chord') {
            d = `M ${this._fmt(x1)},${this._fmt(y1)} A ${this._fmt(rx)} ${this._fmt(ry)} 0 ${largeArc} ${sweep} ${this._fmt(x2)},${this._fmt(y2)} Z`;
        } else {
            d = `M ${this._fmt(x1)},${this._fmt(y1)} A ${this._fmt(rx)} ${this._fmt(ry)} 0 ${largeArc} ${sweep} ${this._fmt(x2)},${this._fmt(y2)}`;
        }

        let attrs = this._getStyleAttrs();
        let trans = this._getTransformAttr();
        this.elements.push(`<path d="${d}" ${attrs} ${trans} />`);
    }

    // --- Helper Methods ---

    _fmt(n) {
        return Number(n).toFixed(3);
    }

    _parseColor(c) {
        if (!c) return 'none';
        if (typeof c === 'string') return c;
        if (c.toString) return c.toString();
        return 'black';
    }

    _getStyleAttrs() {
        let out = `fill="${this.currentFill}" stroke="${this.currentStroke}" stroke-width="${this.currentStrokeWeight}"`;
        if (this.currentFillRule) {
            out += ` fill-rule="${this.currentFillRule}"`;
        }
        if (this.currentStrokeCap) {
            out += ` stroke-linecap="${this.currentStrokeCap}"`;
        }
        if (this.currentStrokeJoin) {
            out += ` stroke-linejoin="${this.currentStrokeJoin}"`;
        }
        return out;
    }

    _getTransformAttr() {
        let m = this.currentMatrix;
        if (m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0) return '';
        return `transform="matrix(${this._fmt(m.a)}, ${this._fmt(m.b)}, ${this._fmt(m.c)}, ${this._fmt(m.d)}, ${this._fmt(m.e)}, ${this._fmt(m.f)})"`;
    }

    toSVGString() {
        const defsBlock = this.defs.length > 0
            ? `  <defs>\n    ${this.defs.join('\n    ')}\n  </defs>\n`
            : '';
        return `<?xml version="1.0" encoding="UTF-8"?>\n<svg width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}" xmlns="http://www.w3.org/2000/svg">\n${defsBlock}${this.elements.join('\n')}\n</svg>`;
    }

    save(filename) {
        let svgContent = this.toSVGString();

        let blob = new Blob([svgContent], {type: "image/svg+xml;charset=utf-8"});
        let url = URL.createObjectURL(blob);

        let link = document.createElement('a');
        link.href = url;
        link.download = filename || 'download.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

if (typeof window !== 'undefined') {
    window.SimpleSVG = SimpleSVG;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleSVG;
}

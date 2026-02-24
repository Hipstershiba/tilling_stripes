class SimpleSVG {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.elements = []; // List of SVG strings
        // Transformation stack. Each matrix is {a,b,c,d,e,f}
        this.matrixStack = [{a:1, b:0, c:0, d:1, e:0, f:0}]; 
        
        this.currentFill = 'none';
        this.currentStroke = 'none';
        this.currentStrokeWeight = 1;

        // For beginShape/endShape
        this.isBuildingShape = false;
        this.vertices = [];
    }

    get currentMatrix() {
        return this.matrixStack[this.matrixStack.length - 1];
    }

    // --- Transforms ---

    push() {
        let m = this.currentMatrix;
        this.matrixStack.push({...m});
    }

    pop() {
        if (this.matrixStack.length > 1) this.matrixStack.pop();
    }

    translate(x, y) {
        // Multiply current matrix by translation matrix [1 0 x]
        //                                             [0 1 y]
        //                                             [0 0 1]
        // Result:
        // a' = a, b' = b
        // c' = c, d' = d
        // e' = a*x + c*y + e
        // f' = b*x + d*y + f
        let m = this.currentMatrix;
        m.e += m.a * x + m.c * y;
        m.f += m.b * x + m.d * y;
    }

    scale(sx, sy) {
        if (sy === undefined) sy = sx;
        // Multiply current matrix by scaling matrix [sx 0 0]
        //                                          [0 sy 0]
        //                                          [0 0 1]
        // a' = a*sx, b' = b*sx
        // c' = c*sy, d' = d*sy
        // e' = e, f' = f
        let m = this.currentMatrix;
        
        m.a *= sx;
        m.b *= sx;
        m.c *= sy;
        m.d *= sy;
    }
    
    rotate(angle) {
        // Multiply current matrix by rotation matrix [cos -sin 0]
        //                                           [sin  cos 0]
        //                                           [ 0    0  1]
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

    // --- Shapes ---

    background(c) {
        let col = this._parseColor(c);
        // Background usually shouldn't have transforms applied if it's clearing the screen.
        // But if called inside a push/pop, maybe? 
        // For plotting, we usually DON'T want a background rectangle.
        // But for completeness:
        if (col !== 'none') {
             this.elements.push(`<rect x="0" y="0" width="${this.w}" height="${this.h}" fill="${col}" stroke="none" />`);
        }
    }

    rect(x, y, w, h) {
        // SVG requires width/height to be positive
        let rx = x, ry = y, rw = w, rh = h;
        
        if (rw < 0) { rx += rw; rw = -rw; }
        if (rh < 0) { ry += rh; rh = -rh; }

        let attrs = this._getStyleAttrs();
        let trans = this._getTransformAttr();
        this.elements.push(`<rect x="${this._fmt(rx)}" y="${this._fmt(ry)}" width="${this._fmt(rw)}" height="${this._fmt(rh)}" ${attrs} ${trans} />`);
    }

    ellipse(x, y, w, h) {
        let rx = w / 2;
        let ry = h / 2;
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

    // --- Vertex Shapes ---

    beginShape() {
        this.isBuildingShape = true;
        this.vertices = [];
    }

    vertex(x, y) {
        if (this.isBuildingShape) {
            this.vertices.push({x, y});
        }
    }

    endShape(mode) {
        if (!this.isBuildingShape) return;
        this.isBuildingShape = false;
        
        if (this.vertices.length === 0) return;

        let d = "M " + this.vertices.map(v => `${this._fmt(v.x)},${this._fmt(v.y)}`).join(" L ");
        if (mode === 'CLOSE' || mode === 'close') {
            d += " Z";
        }

        let attrs = this._getStyleAttrs();
        let trans = this._getTransformAttr();
        this.elements.push(`<path d="${d}" ${attrs} ${trans} />`);
    }
    
    // --- Arcs ---
    
    arc(x, y, w, h, start, stop) {
        let rx = w/2;
        let ry = h/2;
        
        // Ensure angles are properly ordered/normalized?
        let startAngle = start;
        let endAngle = stop;
        
        // p5 measure: right (0) -> clockwise
        // SVG: same
        
        let x1 = x + rx * Math.cos(startAngle);
        let y1 = y + ry * Math.sin(startAngle);
        
        let x2 = x + rx * Math.cos(endAngle);
        let y2 = y + ry * Math.sin(endAngle);
        
        let diff = endAngle - startAngle;
        while (diff < 0) diff += Math.PI*2;
        while (diff > Math.PI*2) diff -= Math.PI*2;
        
        // If it's a full circle or close to it?
        if (diff > Math.PI * 2 - 0.001) {
             this.ellipse(x, y, w, h);
             return;
        }

        let largeArc = (diff > Math.PI) ? 1 : 0;
        let sweep = 1; // clockwise
        
        let d = `M ${this._fmt(x1)},${this._fmt(y1)} A ${this._fmt(rx)} ${this._fmt(ry)} 0 ${largeArc} ${sweep} ${this._fmt(x2)},${this._fmt(y2)}`;
        
        // For arcs (like waves), usually no fill
        let attrs = this._getStyleAttrs();
        let trans = this._getTransformAttr();
        this.elements.push(`<path d="${d}" ${attrs} ${trans} />`);
    }

    // --- Helper Methods ---
    
    _fmt(n) {
        // Format to fixed precision to save space and clean up file
        return Number(n).toFixed(3);
    }

    _parseColor(c) {
        if (!c) return 'none';
        if (typeof c === 'string') return c;
        if (c.toString) return c.toString(); 
        return 'black';
    }

    _getStyleAttrs() {
        return `fill="${this.currentFill}" stroke="${this.currentStroke}" stroke-width="${this.currentStrokeWeight}"`;
    }

    _getTransformAttr() {
        let m = this.currentMatrix;
        // matrix(a, b, c, d, e, f)
        // Check for identity to save space?
        if (m.a===1 && m.b===0 && m.c===0 && m.d===1 && m.e===0 && m.f===0) return '';
        return `transform="matrix(${this._fmt(m.a)}, ${this._fmt(m.b)}, ${this._fmt(m.c)}, ${this._fmt(m.d)}, ${this._fmt(m.e)}, ${this._fmt(m.f)})"`;
    }


    save(filename) {
        let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}" xmlns="http://www.w3.org/2000/svg">
${this.elements.join('\n')}
</svg>`;
        
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

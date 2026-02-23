class Subtile {
    constructor(w, h, type) {
        this.w = w;
        this.h = h;
        // Padding based on smaller dimension or average? Let's use smaller dimension.
        this.padding = min(w, h) * 0.05;
        this.type = type;
        this.color = color(256, 256, 256);
    }

    set_color(color) {
        this.color = color;
    }

    render(ctx, x, y) {
        ctx.push();
        ctx.translate(x, y);
        let t = this.type;
        
        // 0-3: Rect + Circle Family
        if (t === 0) this.halfRectCircleLeft(ctx);
        else if (t === 1) this.halfRectCircleRight(ctx);
        else if (t === 2) this.halfRectCircleTop(ctx);
        else if (t === 3) this.halfRectCircleBottom(ctx);
        
        // 4-7: Quarter Triangles (Corners)
        else if (t === 4) this.triangleTopLeft(ctx);
        else if (t === 5) this.triangleTopRight(ctx);
        else if (t === 6) this.triangleBottomLeft(ctx);
        else if (t === 7) this.triangleBottomRight(ctx);

        // 8-11: Half Triangles (Diagonals)
        else if (t === 8) this.triangleHalfLeft(ctx);
        else if (t === 9) this.triangleHalfRight(ctx);
        else if (t === 10) this.triangleHalfTop(ctx);
        else if (t === 11) this.triangleHalfBottom(ctx);

        // 12-15: Geometric Shapes
        else if (t === 12) this.diamond(ctx);
        else if (t === 13) this.cross(ctx);
        else if (t === 14) this.checkers(ctx);
        else if (t === 15) this.stripes(ctx);

        // 16-19: Complex Shapes
        else if (t === 16) this.target(ctx);
        else if (t === 17) this.dots(ctx);
        else if (t === 18) this.waves(ctx);
        else if (t === 19) this.zigzag(ctx);
        else if (t === 20) this.bowtie(ctx); // Moved from 14/15 

        ctx.pop();
    }

    // --- Rect + Circle Family ---

    halfRectCircleLeft(ctx) {
        // Original type 0
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.rect(-this.w/2 + this.padding, -this.h/2 + this.padding, this.w/2 - this.padding, this.h - this.padding*2);
        ctx.ellipse(this.w/4, 0, this.w/2 - this.padding*2, this.h/2 - this.padding*2);
    }

    halfRectCircleRight(ctx) {
        // Original type 1
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.rect(0, -this.h/2 + this.padding, this.w/2 - this.padding, this.h - this.padding*2);
        ctx.ellipse(-this.w/4, 0, this.w/2 - this.padding*2, this.h/2 - this.padding*2);
    }

    halfRectCircleTop(ctx) {
        // Original type 2
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.rect(-this.w/2 + this.padding, -this.h/2 + this.padding, this.w - this.padding*2, this.h/2 - this.padding);
        ctx.ellipse(0, this.h/4, this.w/2 - this.padding*2, this.h/2 - this.padding*2);
    }

    halfRectCircleBottom(ctx) {
        // Original type 3
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.rect(-this.w/2 + this.padding, 0, this.w - this.padding*2, this.h/2 - this.padding);
        ctx.ellipse(0, -this.h/4, this.w/2 - this.padding*2, this.h/2 - this.padding*2);
    }

    // --- Corner Triangles Family ---

    triangleTopLeft(ctx) {
        // Original type 4
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.triangle(
            -this.w/2 + this.padding, -this.h/2 + this.padding,
            this.w/2 - this.padding, -this.h/2 + this.padding,
            -this.w/2 + this.padding, this.h/2 - this.padding
        );
    }

    triangleTopRight(ctx) {
        // New: Top Right
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.triangle(
            -this.w/2 + this.padding, -this.h/2 + this.padding,
            this.w/2 - this.padding, -this.h/2 + this.padding,
            this.w/2 - this.padding, this.h/2 - this.padding
        );
    }

    triangleBottomLeft(ctx) {
        // New: Bottom Left
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.triangle(
            -this.w/2 + this.padding, -this.h/2 + this.padding,
            -this.w/2 + this.padding, this.h/2 - this.padding,
            this.w/2 - this.padding, this.h/2 - this.padding
        );
    }

    triangleBottomRight(ctx) {
        // New: Bottom Right
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.triangle(
            this.w/2 - this.padding, -this.h/2 + this.padding,
            this.w/2 - this.padding, this.h/2 - this.padding,
            -this.w/2 + this.padding, this.h/2 - this.padding
        );
    }

    // --- Half Triangles Family (Centers) ---

    triangleHalfTop(ctx) { // Center Up
        // Original type 5
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.triangle(
            0, -this.h/2 + this.padding,
            this.w/2 - this.padding, this.h/2 - this.padding,
            -this.w/2 + this.padding, this.h/2 - this.padding
        );
    }

    triangleHalfBottom(ctx) { // Center Down
        // New
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.triangle(
            0, this.h/2 - this.padding,
            -this.w/2 + this.padding, -this.h/2 + this.padding,
            this.w/2 - this.padding, -this.h/2 + this.padding
        );
    }

    triangleHalfLeft(ctx) { // Point Left
        // Original type 12 (somewhat)
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.triangle(
            -this.w/2 + this.padding, 0,
            this.w/2 - this.padding, -this.h/2 + this.padding,
            this.w/2 - this.padding, this.h/2 - this.padding
        );
    }

    triangleHalfRight(ctx) { // Point Right
        // New
        ctx.fill(this.color);
        ctx.noStroke();
        ctx.triangle(
            this.w/2 - this.padding, 0,
            -this.w/2 + this.padding, -this.h/2 + this.padding,
            -this.w/2 + this.padding, this.h/2 - this.padding
        );
    }

    // --- Geometric Shapes ---

    stripes(ctx) {
        // Original type 6
        ctx.fill(this.color);
        ctx.noStroke();
        let stripeH = (this.h - this.padding*2) / 3;
        ctx.rect(-this.w/2 + this.padding, -this.h/2 + this.padding, this.w - this.padding*2, stripeH);
        ctx.rect(-this.w/2 + this.padding, -this.h/2 + this.padding + stripeH * 2, this.w - this.padding*2, stripeH);
    }

    cross(ctx) {
        // Original type 7
        ctx.fill(this.color);
        ctx.noStroke();
        let thicknessX = (this.w - this.padding*2) / 3;
        let thicknessY = (this.h - this.padding*2) / 3;
        ctx.rect(-thicknessX/2, -this.h/2 + this.padding, thicknessX, this.h - this.padding*2);
        ctx.rect(-this.w/2 + this.padding, -thicknessY/2, this.w - this.padding*2, thicknessY);
    }

    checkers(ctx) {
        // Original type 8
        ctx.fill(this.color);
        ctx.noStroke();
        let w = (this.w - this.padding*2)/2;
        let h = (this.h - this.padding*2)/2;
        ctx.rect(-this.w/2 + this.padding, -this.h/2 + this.padding, w, h);
        ctx.rect(0, 0, w, h);
    }

    diamond(ctx) {
        // Original type 9
        ctx.fill(this.color);
        ctx.noStroke();
        let w = (this.w - this.padding*2)/2;
        let h = (this.h - this.padding*2)/2;
        ctx.beginShape();
        ctx.vertex(0, -h); ctx.vertex(w, 0); ctx.vertex(0, h); ctx.vertex(-w, 0);
        ctx.endShape(CLOSE);
    }

    // --- Complex Shapes ---

    target(ctx) {
        // Original type 10
        ctx.noFill();
        ctx.stroke(this.color);
        let weight = min(this.w, this.h) / 20;
        ctx.strokeWeight(weight);
        let w = this.w - this.padding*2;
        let h = this.h - this.padding*2;
        ctx.ellipse(0, 0, w, h);
        ctx.ellipse(0, 0, w*0.6, h*0.6);
        ctx.ellipse(0, 0, w*0.2, h*0.2);
    }

    dots(ctx) {
        // Original type 11
        ctx.fill(this.color);
        ctx.noStroke();
        let w = (this.w - this.padding*2);
        let h = (this.h - this.padding*2);
        let d = min(w, h) * 0.2;
        let ox = w/4;
        let oy = h/4;
        ctx.ellipse(-ox, -oy, d, d); ctx.ellipse(ox, -oy, d, d);
        ctx.ellipse(-ox, oy, d, d); ctx.ellipse(ox, oy, d, d);
    }

    waves(ctx) {
        // Original type 17
        ctx.noFill();
        ctx.stroke(this.color);
        let w = this.w - this.padding*2;
        let h = this.h - this.padding*2;
        let size = min(w, h);
        let weight = size * 0.1;
        ctx.strokeWeight(weight);
        for(let i=1; i<=3; i++) {
           let r = (size * i) / 3;
           ctx.arc(-w/2, -h/2, r*2, r*2, 0, HALF_PI);
        }
    }

    zigzag(ctx) {
        // Original type 18
        ctx.noFill();
        ctx.stroke(this.color);
        let w = this.w - this.padding*2;
        let h = this.h - this.padding*2;
        let weight = min(w, h) * 0.1;
        ctx.strokeWeight(weight);
        ctx.beginShape();
        ctx.vertex(-w/2, 0); ctx.vertex(-w/4, -h/3); ctx.vertex(0, 0);
        ctx.vertex(w/4, h/3); ctx.vertex(w/2, 0);
        ctx.endShape();
    }
    
    bowtie(ctx) {
        // Original type 14
        ctx.fill(this.color);
        ctx.noStroke();
        let w = this.w - this.padding*2;
        let h = this.h - this.padding*2;
        ctx.triangle(-w/2, -h/2, -w/2, h/2, 0, 0);
        ctx.triangle(w/2, -h/2, w/2, h/2, 0, 0);
    }
}
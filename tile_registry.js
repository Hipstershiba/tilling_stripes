// TILE_RENDERERS is a global array of rendering functions.
// To add a new tile, simply add a new function to this array.
// The function receives:
//   ctx: The p5.js graphics context
//   w: Width of the tile
//   h: Height of the tile
//   padding: Padding to respect
//   color: The color to use (p5 color object)

const TILE_RENDERERS = [
    // --- Group 1: Half Rect + Circle ---

    // 0: Half Rect + Circle (Left)
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.rect(-w/2 + padding, -h/2 + padding, w/2 - padding, h - padding*2);
        ctx.ellipse(w/4, 0, w/2 - padding*2, h/2 - padding*2);
    },

    // 1: Half Rect + Circle (Right)
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.rect(0, -h/2 + padding, w/2 - padding, h - padding*2);
        ctx.ellipse(-w/4, 0, w/2 - padding*2, h/2 - padding*2);
    },

    // 2: Half Rect + Circle (Top)
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.rect(-w/2 + padding, -h/2 + padding, w - padding*2, h/2 - padding);
        ctx.ellipse(0, h/4, w/2 - padding*2, h/2 - padding*2);
    },

    // 3: Half Rect + Circle (Bottom)
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.rect(-w/2 + padding, 0, w - padding*2, h/2 - padding);
        ctx.ellipse(0, -h/4, w/2 - padding*2, h/2 - padding*2);
    },

    // --- Group 2: Corner Triangles ---

    // 4: Triangle Top Left
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.triangle(
            -w/2 + padding, -h/2 + padding,
            w/2 - padding, -h/2 + padding,
            -w/2 + padding, h/2 - padding
        );
    },

    // 5: Triangle Top Right
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.triangle(
            -w/2 + padding, -h/2 + padding,
            w/2 - padding, -h/2 + padding,
            w/2 - padding, h/2 - padding
        );
    },

    // 6: Triangle Bottom Left
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.triangle(
            -w/2 + padding, -h/2 + padding,
            -w/2 + padding, h/2 - padding,
            w/2 - padding, h/2 - padding
        );
    },

    // 7: Triangle Bottom Right
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.triangle(
            w/2 - padding, -h/2 + padding,
            w/2 - padding, h/2 - padding,
            -w/2 + padding, h/2 - padding
        );
    },

    // --- Group 3: Side Triangles ---

    // 8: Triangle Half Left
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.triangle(
            -w/2 + padding, 0,
            w/2 - padding, -h/2 + padding,
            w/2 - padding, h/2 - padding
        );
    },

    // 9: Triangle Half Right
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.triangle(
            w/2 - padding, 0,
            -w/2 + padding, -h/2 + padding,
            -w/2 + padding, h/2 - padding
        );
    },

    // 10: Triangle Half Top
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.triangle(
            0, -h/2 + padding,
            w/2 - padding, h/2 - padding,
            -w/2 + padding, h/2 - padding
        );
    },

    // 11: Triangle Half Bottom
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.triangle(
            0, h/2 - padding,
            -w/2 + padding, -h/2 + padding,
            w/2 - padding, -h/2 + padding
        );
    },

    // --- Group 4: Symmetric / Centered ---

    // 12: Diamond
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let dw = (w - padding*2)/2;
        let dh = (h - padding*2)/2;
        ctx.beginShape();
        ctx.vertex(0, -dh); ctx.vertex(dw, 0); ctx.vertex(0, dh); ctx.vertex(-dw, 0);
        ctx.endShape(CLOSE);
    },

    // 13: Cross
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let thicknessX = (w - padding*2) / 3;
        let thicknessY = (h - padding*2) / 3;
        ctx.rect(-thicknessX/2, -h/2 + padding, thicknessX, h - padding*2);
        ctx.rect(-w/2 + padding, -thicknessY/2, w - padding*2, thicknessY);
    },

    // 14: Target
    function(ctx, w, h, padding, color) {
        ctx.noFill();
        ctx.stroke(color);
        let weight = min(w, h) / 20;
        ctx.strokeWeight(weight);
        let dw = w - padding*2;
        let dh = h - padding*2;
        ctx.ellipse(0, 0, dw, dh);
        ctx.ellipse(0, 0, dw*0.6, dh*0.6);
        ctx.ellipse(0, 0, dw*0.2, dh*0.2);
    },

    // 15: Dots
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let dw = (w - padding*2);
        let dh = (h - padding*2);
        let d = min(dw, dh) * 0.2;
        let ox = dw/4;
        let oy = dh/4;
        ctx.ellipse(-ox, -oy, d, d); ctx.ellipse(ox, -oy, d, d);
        ctx.ellipse(-ox, oy, d, d); ctx.ellipse(ox, oy, d, d);
    },

    // --- Group 5: Checkers ---

    // 16: Checkers (TL/BR)
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let dw = (w - padding*2)/2;
        let dh = (h - padding*2)/2;
        ctx.rect(-w/2 + padding, -h/2 + padding, dw, dh);
        ctx.rect(0, 0, dw, dh);
    },

    // 17: Checkers Inverse (TR/BL)
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let dw = (w - padding*2)/2;
        let dh = (h - padding*2)/2;
        ctx.rect(0, -h/2 + padding, dw, dh);
        ctx.rect(-w/2 + padding, 0, dw, dh);
    },

    // --- Group 6: Stripes ---

    // 18: Stripes Horizontal
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let stripeH = (h - padding*2) / 3;
        ctx.rect(-w/2 + padding, -h/2 + padding, w - padding*2, stripeH);
        ctx.rect(-w/2 + padding, -h/2 + padding + stripeH * 2, w - padding*2, stripeH);
    },

    // 19: Stripes Vertical
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let stripeW = (w - padding*2) / 3;
        ctx.rect(-w/2 + padding, -h/2 + padding, stripeW, h - padding*2);
        ctx.rect(-w/2 + padding + stripeW * 2, -h/2 + padding, stripeW, h - padding*2);
    },

    // --- Group 7: Waves (Corners) ---

    // 20: Waves Top Left
    function(ctx, w, h, padding, color) {
        ctx.noFill();
        ctx.stroke(color);
        let dw = w - padding*2;
        let dh = h - padding*2;
        let size = min(dw, dh);
        let weight = size * 0.1;
        ctx.strokeWeight(weight);
        for(let i=1; i<=3; i++) {
           let r = (size * i) / 3;
           ctx.arc(-dw/2, -dh/2, r*2, r*2, 0, HALF_PI);
        }
    },
    
    // 21: Waves Top Right
    function(ctx, w, h, padding, color) {
        ctx.noFill();
        ctx.stroke(color);
        let dw = w - padding*2;
        let dh = h - padding*2;
        let size = min(dw, dh);
        let weight = size * 0.1;
        ctx.strokeWeight(weight);
        for(let i=1; i<=3; i++) {
           let r = (size * i) / 3;
           ctx.arc(dw/2, -dh/2, r*2, r*2, HALF_PI, PI);
        }
    },

    // 22: Waves Bottom Right
    function(ctx, w, h, padding, color) {
        ctx.noFill();
        ctx.stroke(color);
        let dw = w - padding*2;
        let dh = h - padding*2;
        let size = min(dw, dh);
        let weight = size * 0.1;
        ctx.strokeWeight(weight);
        for(let i=1; i<=3; i++) {
           let r = (size * i) / 3;
           ctx.arc(dw/2, dh/2, r*2, r*2, PI, PI + HALF_PI);
        }
    },

    // 23: Waves Bottom Left
    function(ctx, w, h, padding, color) {
        ctx.noFill();
        ctx.stroke(color);
        let dw = w - padding*2;
        let dh = h - padding*2;
        let size = min(dw, dh);
        let weight = size * 0.1;
        ctx.strokeWeight(weight);
        for(let i=1; i<=3; i++) {
           let r = (size * i) / 3;
           ctx.arc(-dw/2, dh/2, r*2, r*2, PI + HALF_PI, TWO_PI);
        }
    },

    // --- Group 8: Zigzag ---

    // 24: Zigzag Horizontal
    function(ctx, w, h, padding, color) {
        ctx.noFill();
        ctx.stroke(color);
        let dw = w - padding*2;
        let dh = h - padding*2;
        let weight = min(dw, dh) * 0.1;
        ctx.strokeWeight(weight);
        ctx.beginShape();
        ctx.vertex(-dw/2, 0); ctx.vertex(-dw/4, -dh/3); ctx.vertex(0, 0);
        ctx.vertex(dw/4, dh/3); ctx.vertex(dw/2, 0);
        ctx.endShape();
    },

    // 25: Zigzag Vertical
    function(ctx, w, h, padding, color) {
        ctx.noFill();
        ctx.stroke(color);
        let dw = w - padding*2;
        let dh = h - padding*2;
        let weight = min(dw, dh) * 0.1;
        ctx.strokeWeight(weight);
        ctx.beginShape();
        ctx.vertex(0, -dh/2); ctx.vertex(-dw/3, -dh/4); ctx.vertex(0, 0);
        ctx.vertex(dw/3, dh/4); ctx.vertex(0, dh/2);
        ctx.endShape();
    },

    // --- Group 9: Bowtie / Hourglass ---

    // 26: Bowtie (Horizontal)
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let dw = w - padding*2;
        let dh = h - padding*2;
        ctx.triangle(-dw/2, -dh/2, -dw/2, dh/2, 0, 0);
        ctx.triangle(dw/2, -dh/2, dw/2, dh/2, 0, 0);
    },

    // 27: Hourglass (Vertical)
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let dw = w - padding*2;
        let dh = h - padding*2;
        ctx.triangle(-dw/2, -dh/2, dw/2, -dh/2, 0, 0);
        ctx.triangle(-dw/2, dh/2, dw/2, dh/2, 0, 0);
    },

    // --- Group 10: L-Shape ---

    // 28: L-Shape Top Left
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let thickness = min(w, h) / 3;
        // Vertical part (left)
        ctx.rect(-w/2 + padding, -h/2 + padding, thickness, h - padding*2);
        // Horizontal part (top)
        ctx.rect(-w/2 + padding, -h/2 + padding, w - padding*2, thickness);
    },

    // 29: L-Shape Top Right
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let thickness = min(w, h) / 3;
        // Vertical part (right)
        ctx.rect(w/2 - padding - thickness, -h/2 + padding, thickness, h - padding*2);
        // Horizontal part (top)
        ctx.rect(-w/2 + padding, -h/2 + padding, w - padding*2, thickness);
    },

    // 30: L-Shape Bottom Right
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let thickness = min(w, h) / 3;
        // Vertical part (right)
        ctx.rect(w/2 - padding - thickness, -h/2 + padding, thickness, h - padding*2);
        // Horizontal part (bottom)
        ctx.rect(-w/2 + padding, h/2 - padding - thickness, w - padding*2, thickness);
    },

    // 31: L-Shape Bottom Left
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let thickness = min(w, h) / 3;
        // Vertical part (left)
        ctx.rect(-w/2 + padding, -h/2 + padding, thickness, h - padding*2);
        // Horizontal part (bottom)
        ctx.rect(-w/2 + padding, h/2 - padding - thickness, w - padding*2, thickness);
    },

    // --- Group 11: T-Shape ---

    // 32: T-Shape Top
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let thickness = min(w, h) / 3;
        // Horz (top)
        ctx.rect(-w/2 + padding, -h/2 + padding, w - padding*2, thickness);
        // Vert (center)
        ctx.rect(-thickness/2, -h/2 + padding, thickness, h - padding*2);
    },

    // 33: T-Shape Right
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let thickness = min(w, h) / 3;
        // Vert (right)
        ctx.rect(w/2 - padding - thickness, -h/2 + padding, thickness, h - padding*2);
        // Horz (center)
        ctx.rect(-w/2 + padding, -thickness/2, w - padding*2, thickness);
    },

    // 34: T-Shape Bottom
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let thickness = min(w, h) / 3;
        // Horz (bottom)
        ctx.rect(-w/2 + padding, h/2 - padding - thickness, w - padding*2, thickness);
        // Vert (center)
        ctx.rect(-thickness/2, -h/2 + padding, thickness, h - padding*2);
    },

    // 35: T-Shape Left
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let thickness = min(w, h) / 3;
        // Vert (left)
        ctx.rect(-w/2 + padding, -h/2 + padding, thickness, h - padding*2);
        // Horz (center)
        ctx.rect(-w/2 + padding, -thickness/2, w - padding*2, thickness);
    },

    // --- Group 12: Diagonal Line ---

    // 36: Diagonal (Top-Left to Bottom-Right)
    function(ctx, w, h, padding, color) {
        ctx.noFill();
        ctx.stroke(color);
        let weight = min(w, h) * 0.15;
        ctx.strokeWeight(weight);
        ctx.line(-w/2 + padding, -h/2 + padding, w/2 - padding, h/2 - padding);
    },

    // 37: Diagonal (Top-Right to Bottom-Left)
    function(ctx, w, h, padding, color) {
        ctx.noFill();
        ctx.stroke(color);
        let weight = min(w, h) * 0.15;
        ctx.strokeWeight(weight);
        ctx.line(w/2 - padding, -h/2 + padding, -w/2 + padding, h/2 - padding);
    },

    // --- Group 13: Quarter Arc (Filled) ---

    // 38: Arc Top Left
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        // Draw arc centered at corner
        ctx.arc(-w/2 + padding, -h/2 + padding, w*1.5, h*1.5, 0, HALF_PI);
    },

    // 39: Arc Top Right
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.arc(w/2 - padding, -h/2 + padding, w*1.5, h*1.5, HALF_PI, PI);
    },

    // 40: Arc Bottom Right
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.arc(w/2 - padding, h/2 - padding, w*1.5, h*1.5, PI, PI + HALF_PI);
    },

    // 41: Arc Bottom Left
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        ctx.arc(-w/2 + padding, h/2 - padding, w*1.5, h*1.5, PI + HALF_PI, TWO_PI);
    },

    // --- Group 15: Grid 2x2 ---

    // 42: Grid 2x2
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let gap = min(w, h) * 0.1;
        let blockSize = (min(w, h) - padding*2 - gap)/2;
        
        // Top Left
        ctx.rect(-blockSize - gap/2, -blockSize - gap/2, blockSize, blockSize);
        // Top Right
        ctx.rect(gap/2, -blockSize - gap/2, blockSize, blockSize);
        // Bottom Left
        ctx.rect(-blockSize - gap/2, gap/2, blockSize, blockSize);
        // Bottom Right
        ctx.rect(gap/2, gap/2, blockSize, blockSize);
    },
    
    // --- Group 16: Three Dots Diagonal ---

    // 43: Three Dots (TL-BR)
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let r = min(w, h) * 0.15;
        // Center
        ctx.ellipse(0, 0, r*2);
        // TL
        ctx.ellipse(-w/3 + padding/2, -h/3 + padding/2, r*2);
        // BR
        ctx.ellipse(w/3 - padding/2, h/3 - padding/2, r*2);
    },
    
    // 44: Three Dots (TR-BL)
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let r = min(w, h) * 0.15;
        // Center
        ctx.ellipse(0, 0, r*2);
        // TR
        ctx.ellipse(w/3 - padding/2, -h/3 + padding/2, r*2);
        // BL
        ctx.ellipse(-w/3 + padding/2, h/3 - padding/2, r*2);
    }
];

if (typeof window !== 'undefined') {
    window.TILE_RENDERERS = TILE_RENDERERS;
} else if (typeof module !== 'undefined') {
    module.exports = TILE_RENDERERS;
}

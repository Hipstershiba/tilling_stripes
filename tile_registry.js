// TILE_RENDERERS is a global array of rendering functions.
// To add a new tile, simply add a new function to this array.
// The function receives:
//   ctx: The p5.js graphics context
//   w: Width of the tile
//   h: Height of the tile
//   padding: Padding to respect
//   color: The color to use (p5 color object)

const TILE_RENDERERS = [
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

    // 14: Checkers
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let dw = (w - padding*2)/2;
        let dh = (h - padding*2)/2;
        ctx.rect(-w/2 + padding, -h/2 + padding, dw, dh);
        ctx.rect(0, 0, dw, dh);
    },

    // 15: Stripes
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let stripeH = (h - padding*2) / 3;
        ctx.rect(-w/2 + padding, -h/2 + padding, w - padding*2, stripeH);
        ctx.rect(-w/2 + padding, -h/2 + padding + stripeH * 2, w - padding*2, stripeH);
    },

    // 16: Target
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

    // 17: Dots
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

    // 18: Waves
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

    // 19: Zigzag
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

    // 20: Bowtie
    function(ctx, w, h, padding, color) {
        ctx.fill(color);
        ctx.noStroke();
        let dw = w - padding*2;
        let dh = h - padding*2;
        ctx.triangle(-dw/2, -dh/2, -dw/2, dh/2, 0, 0);
        ctx.triangle(dw/2, -dh/2, dw/2, dh/2, 0, 0);
    }
];

if (typeof window !== 'undefined') {
    window.TILE_RENDERERS = TILE_RENDERERS;
} else if (typeof module !== 'undefined') {
    module.exports = TILE_RENDERERS;
}

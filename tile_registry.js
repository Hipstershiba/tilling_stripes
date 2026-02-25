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

const TILE_NAMES = [
    "Half Rect + Circle (Left)",
    "Half Rect + Circle (Right)",
    "Half Rect + Circle (Top)",
    "Half Rect + Circle (Bottom)",
    "Triangle Top Left",
    "Triangle Top Right",
    "Triangle Bottom Left",
    "Triangle Bottom Right",
    "Triangle Half Left",
    "Triangle Half Right",
    "Triangle Half Top",
    "Triangle Half Bottom",
    "Diamond",
    "Cross",
    "Target",
    "Four Dots",
    "Checkers (TL/BR)",
    "Checkers Inverse (TR/BL)",
    "Stripes Horizontal",
    "Stripes Vertical",
    "Waves Top Left",
    "Waves Top Right",
    "Waves Bottom Right",
    "Waves Bottom Left",
    "Zigzag Horizontal",
    "Zigzag Vertical",
    "Bowtie (Horizontal)",
    "Hourglass (Vertical)",
    "L-Shape Top Left",
    "L-Shape Top Right",
    "L-Shape Bottom Right",
    "L-Shape Bottom Left",
    "T-Shape Top",
    "T-Shape Right",
    "T-Shape Bottom",
    "T-Shape Left",
    "Diagonal (TL-BR)",
    "Diagonal (TR-BL)",
    "Arc Top Left",
    "Arc Top Right",
    "Arc Bottom Right",
    "Arc Bottom Left",
    "Grid 2x2",
    "Three Dots (TL-BR)",
    "Three Dots (TR-BL)"
];

// Centralized metadata used by tools/edit modes
const TILE_FAMILIES = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
    [16, 17],
    [18, 19],
    [20, 21, 22, 23],
    [24, 25],
    [26, 27],
    [28, 29, 30, 31],
    [32, 33, 34, 35],
    [36, 37],
    [38, 39, 40, 41],
    [42],
    [43, 44]
];

const TILE_TRANSFORM_MAP = {
    0: { x: 1, y: 0, xy: 1 },
    1: { x: 0, y: 1, xy: 0 },
    2: { x: 2, y: 3, xy: 3 },
    3: { x: 3, y: 2, xy: 2 },
    4: { x: 5, y: 6, xy: 7 },
    5: { x: 4, y: 7, xy: 6 },
    6: { x: 7, y: 4, xy: 5 },
    7: { x: 6, y: 5, xy: 4 },
    8: { x: 9, y: 8, xy: 9 },
    9: { x: 8, y: 9, xy: 8 },
    10: { x: 10, y: 11, xy: 11 },
    11: { x: 11, y: 10, xy: 10 },
    12: { x: 12, y: 12, xy: 12 },
    13: { x: 13, y: 13, xy: 13 },
    14: { x: 14, y: 14, xy: 14 },
    15: { x: 15, y: 15, xy: 15 },
    16: { x: 17, y: 17, xy: 16 },
    17: { x: 16, y: 16, xy: 17 },
    18: { x: 18, y: 18, xy: 18 },
    19: { x: 19, y: 19, xy: 19 },
    20: { x: 21, y: 23, xy: 22 },
    21: { x: 20, y: 22, xy: 23 },
    22: { x: 23, y: 21, xy: 20 },
    23: { x: 22, y: 20, xy: 21 },
    24: { x: 24, y: 24, xy: 24 },
    25: { x: 25, y: 25, xy: 25 },
    26: { x: 26, y: 26, xy: 26 },
    27: { x: 27, y: 27, xy: 27 },
    28: { x: 29, y: 31, xy: 30 },
    29: { x: 28, y: 30, xy: 31 },
    30: { x: 31, y: 29, xy: 28 },
    31: { x: 30, y: 28, xy: 29 },
    32: { x: 32, y: 34, xy: 34 },
    33: { x: 35, y: 33, xy: 35 },
    34: { x: 34, y: 32, xy: 32 },
    35: { x: 33, y: 35, xy: 33 },
    36: { x: 37, y: 37, xy: 36 },
    37: { x: 36, y: 36, xy: 37 },
    38: { x: 39, y: 40, xy: 41 },
    39: { x: 38, y: 41, xy: 40 },
    40: { x: 41, y: 38, xy: 39 },
    41: { x: 40, y: 39, xy: 38 },
    42: { x: 42, y: 42, xy: 42 },
    43: { x: 43, y: 43, xy: 43 },
    44: { x: 44, y: 44, xy: 44 }
};

// Optional family labels for newly registered tiles.
// Existing built-in families keep their numeric grouping order.
const TILE_FAMILY_LABEL_TO_INDEX = {};

function resolveFamilyIndex(family) {
    if (family === undefined || family === null) return null;

    if (typeof family === 'number') {
        if (family >= 0 && family < TILE_FAMILIES.length) return family;
        return null;
    }

    if (typeof family === 'string') {
        if (TILE_FAMILY_LABEL_TO_INDEX[family] !== undefined) {
            return TILE_FAMILY_LABEL_TO_INDEX[family];
        }
        TILE_FAMILIES.push([]);
        let idx = TILE_FAMILIES.length - 1;
        TILE_FAMILY_LABEL_TO_INDEX[family] = idx;
        return idx;
    }

    return null;
}

function normalizeTransformTarget(value, selfId) {
    if (value === undefined || value === null || value === 'self') return selfId;
    if (typeof value === 'number') return value;
    return selfId;
}

function registerTile(config) {
    if (!config || typeof config.render !== 'function') {
        throw new Error('registerTile requires a config object with a render function');
    }

    let id = TILE_RENDERERS.length;
    TILE_RENDERERS.push(config.render);
    TILE_NAMES.push(config.name || `Tile ${id}`);

    let familyIndex = resolveFamilyIndex(config.family);
    if (familyIndex !== null) {
        TILE_FAMILIES[familyIndex].push(id);
    }

    if (config.symmetric === true) {
        TILE_TRANSFORM_MAP[id] = { x: id, y: id, xy: id };
    } else {
        let transforms = config.transforms || {};
        TILE_TRANSFORM_MAP[id] = {
            x: normalizeTransformTarget(transforms.x, id),
            y: normalizeTransformTarget(transforms.y, id),
            xy: normalizeTransformTarget(transforms.xy, id)
        };
    }

    return id;
}

// ------------------------------------------------------------------
// registerTile template (for future tiles)
// ------------------------------------------------------------------
// Example A: symmetric tile (same under X/Y/XY flips)
// const emptyTileId = registerTile({
//     name: "Empty Tile",
//     family: "utility", // or numeric index, e.g. 15
//     symmetric: true,
//     render: (ctx, w, h, padding, color) => {
//         // draw nothing
//     }
// });
//
// Example B: custom transform mapping
// const customTileId = registerTile({
//     name: "Custom Tile",
//     family: "custom",
//     transforms: {
//         x: 'self', // or explicit tile id
//         y: 'self',
//         xy: 'self'
//     },
//     render: (ctx, w, h, padding, color) => {
//         // your drawing commands
//     }
// });

// Empty tile available in palette (draws nothing)
registerTile({
    name: "Empty Tile",
    family: "utility",
    symmetric: true,
    render: (ctx, w, h, padding, color) => {
        // intentionally empty
    }
});

if (typeof window !== 'undefined') {
    window.TILE_RENDERERS = TILE_RENDERERS;
    window.TILE_NAMES = TILE_NAMES;
    window.TILE_FAMILIES = TILE_FAMILIES;
    window.TILE_TRANSFORMS = TILE_TRANSFORM_MAP;
    window.registerTile = registerTile;
} else if (typeof module !== 'undefined') {
    module.exports = {
        TILE_RENDERERS,
        TILE_NAMES,
        TILE_FAMILIES,
        TILE_TRANSFORM_MAP,
        registerTile
    };
}

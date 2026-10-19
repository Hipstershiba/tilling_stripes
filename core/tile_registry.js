/**
 * core/tile_registry.js
 * Central catalog of vector tile renderers, named families, and D4 orientation maps.
 */

const TILE_RENDERERS = [
  // --- Family 0: Half Rect + Circle (0..3) ---
  // 0: Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.rect(-w / 2 + padding, -h / 2 + padding, w / 2 - padding, h - padding * 2);
    ctx.ellipse(w / 4, 0, w / 2 - padding * 2, h / 2 - padding * 2);
  },
  // 1: Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.rect(0, -h / 2 + padding, w / 2 - padding, h - padding * 2);
    ctx.ellipse(-w / 4, 0, w / 2 - padding * 2, h / 2 - padding * 2);
  },
  // 2: Top
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.rect(-w / 2 + padding, -h / 2 + padding, w - padding * 2, h / 2 - padding);
    ctx.ellipse(0, h / 4, w / 2 - padding * 2, h / 2 - padding * 2);
  },
  // 3: Bottom
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.rect(-w / 2 + padding, 0, w - padding * 2, h / 2 - padding);
    ctx.ellipse(0, -h / 4, w / 2 - padding * 2, h / 2 - padding * 2);
  },

  // --- Family 1: Corner Triangles (4..7) ---
  // 4: Top Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.triangle(
      -w / 2 + padding, -h / 2 + padding,
      w / 2 - padding, -h / 2 + padding,
      -w / 2 + padding, h / 2 - padding
    );
  },
  // 5: Top Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.triangle(
      -w / 2 + padding, -h / 2 + padding,
      w / 2 - padding, -h / 2 + padding,
      w / 2 - padding, h / 2 - padding
    );
  },
  // 6: Bottom Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.triangle(
      -w / 2 + padding, -h / 2 + padding,
      -w / 2 + padding, h / 2 - padding,
      w / 2 - padding, h / 2 - padding
    );
  },
  // 7: Bottom Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.triangle(
      w / 2 - padding, -h / 2 + padding,
      w / 2 - padding, h / 2 - padding,
      -w / 2 + padding, h / 2 - padding
    );
  },

  // --- Family 2: Side Triangles (8..11) ---
  // 8: Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.triangle(
      -w / 2 + padding, 0,
      w / 2 - padding, -h / 2 + padding,
      w / 2 - padding, h / 2 - padding
    );
  },
  // 9: Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.triangle(
      w / 2 - padding, 0,
      -w / 2 + padding, -h / 2 + padding,
      -w / 2 + padding, h / 2 - padding
    );
  },
  // 10: Top
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.triangle(
      0, -h / 2 + padding,
      w / 2 - padding, h / 2 - padding,
      -w / 2 + padding, h / 2 - padding
    );
  },
  // 11: Bottom
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.triangle(
      0, h / 2 - padding,
      -w / 2 + padding, -h / 2 + padding,
      w / 2 - padding, -h / 2 + padding
    );
  },

  // --- Family 3: Symmetric / Centered (12..15) ---
  // 12: Diamond
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = (w - padding * 2) / 2;
    const dh = (h - padding * 2) / 2;
    ctx.beginShape();
    ctx.vertex(0, -dh);
    ctx.vertex(dw, 0);
    ctx.vertex(0, dh);
    ctx.vertex(-dw, 0);
    ctx.endShape('CLOSE');
  },
  // 13: Cross
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const thicknessX = (w - padding * 2) / 3;
    const thicknessY = (h - padding * 2) / 3;
    ctx.rect(-thicknessX / 2, -h / 2 + padding, thicknessX, h - padding * 2);
    ctx.rect(-w / 2 + padding, -thicknessY / 2, w - padding * 2, thicknessY);
  },
  // 14: Target
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const weight = Math.min(w, h) / 20;
    ctx.strokeWeight(weight);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.ellipse(0, 0, dw, dh);
    ctx.ellipse(0, 0, dw * 0.6, dh * 0.6);
    ctx.ellipse(0, 0, dw * 0.2, dh * 0.2);
  },
  // 15: Four Dots
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const d = Math.min(dw, dh) * 0.2;
    const ox = dw / 4;
    const oy = dh / 4;
    ctx.ellipse(-ox, -oy, d, d);
    ctx.ellipse(ox, -oy, d, d);
    ctx.ellipse(-ox, oy, d, d);
    ctx.ellipse(ox, oy, d, d);
  },

  // --- Family 4: Checkers (16..17) ---
  // 16: Checkers (TL/BR)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = (w - padding * 2) / 2;
    const dh = (h - padding * 2) / 2;
    ctx.rect(-w / 2 + padding, -h / 2 + padding, dw, dh);
    ctx.rect(0, 0, dw, dh);
  },
  // 17: Checkers Inverse (TR/BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = (w - padding * 2) / 2;
    const dh = (h - padding * 2) / 2;
    ctx.rect(0, -h / 2 + padding, dw, dh);
    ctx.rect(-w / 2 + padding, 0, dw, dh);
  },

  // --- Family 5: Stripes (18..19) ---
  // 18: Stripes Horizontal
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const stripeH = (h - padding * 2) / 3;
    ctx.rect(-w / 2 + padding, -h / 2 + padding, w - padding * 2, stripeH);
    ctx.rect(-w / 2 + padding, -h / 2 + padding + stripeH * 2, w - padding * 2, stripeH);
  },
  // 19: Stripes Vertical
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const stripeW = (w - padding * 2) / 3;
    ctx.rect(-w / 2 + padding, -h / 2 + padding, stripeW, h - padding * 2);
    ctx.rect(-w / 2 + padding + stripeW * 2, -h / 2 + padding, stripeW, h - padding * 2);
  },

  // --- Family 6: Waves (20..23) ---
  // 20: Waves Top Left
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const size = Math.min(dw, dh);
    ctx.strokeWeight(size * 0.1);
    for (let i = 1; i <= 3; i++) {
      const r = (size * i) / 3;
      ctx.arc(-dw / 2, -dh / 2, r * 2, r * 2, 0, Math.PI / 2);
    }
  },
  // 21: Waves Top Right
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const size = Math.min(dw, dh);
    ctx.strokeWeight(size * 0.1);
    for (let i = 1; i <= 3; i++) {
      const r = (size * i) / 3;
      ctx.arc(dw / 2, -dh / 2, r * 2, r * 2, Math.PI / 2, Math.PI);
    }
  },
  // 22: Waves Bottom Right
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const size = Math.min(dw, dh);
    ctx.strokeWeight(size * 0.1);
    for (let i = 1; i <= 3; i++) {
      const r = (size * i) / 3;
      ctx.arc(dw / 2, dh / 2, r * 2, r * 2, Math.PI, Math.PI * 1.5);
    }
  },
  // 23: Waves Bottom Left
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const size = Math.min(dw, dh);
    ctx.strokeWeight(size * 0.1);
    for (let i = 1; i <= 3; i++) {
      const r = (size * i) / 3;
      ctx.arc(-dw / 2, dh / 2, r * 2, r * 2, Math.PI * 1.5, Math.PI * 2);
    }
  },

  // --- Family 7: Zigzag (24..25) ---
  // 24: Zigzag Horizontal
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.1);
    ctx.beginShape();
    ctx.vertex(-dw / 2, 0);
    ctx.vertex(-dw / 4, -dh / 3);
    ctx.vertex(0, 0);
    ctx.vertex(dw / 4, dh / 3);
    ctx.vertex(dw / 2, 0);
    ctx.endShape();
  },
  // 25: Zigzag Vertical
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.1);
    ctx.beginShape();
    ctx.vertex(0, -dh / 2);
    ctx.vertex(-dw / 3, -dh / 4);
    ctx.vertex(0, 0);
    ctx.vertex(dw / 3, dh / 4);
    ctx.vertex(0, dh / 2);
    ctx.endShape();
  },

  // --- Family 8: Bowtie / Hourglass (26..27) ---
  // 26: Bowtie (Horizontal)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(-dw / 2, -dh / 2, -dw / 2, dh / 2, 0, 0);
    ctx.triangle(dw / 2, -dh / 2, dw / 2, dh / 2, 0, 0);
  },
  // 27: Hourglass (Vertical)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(-dw / 2, -dh / 2, dw / 2, -dh / 2, 0, 0);
    ctx.triangle(-dw / 2, dh / 2, dw / 2, dh / 2, 0, 0);
  },

  // --- Family 9: L-Shape (28..31) ---
  // 28: L-Shape Top Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const thickness = Math.min(w, h) / 3;
    ctx.rect(-w / 2 + padding, -h / 2 + padding, thickness, h - padding * 2);
    ctx.rect(-w / 2 + padding, -h / 2 + padding, w - padding * 2, thickness);
  },
  // 29: L-Shape Top Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const thickness = Math.min(w, h) / 3;
    ctx.rect(w / 2 - padding - thickness, -h / 2 + padding, thickness, h - padding * 2);
    ctx.rect(-w / 2 + padding, -h / 2 + padding, w - padding * 2, thickness);
  },
  // 30: L-Shape Bottom Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const thickness = Math.min(w, h) / 3;
    ctx.rect(w / 2 - padding - thickness, -h / 2 + padding, thickness, h - padding * 2);
    ctx.rect(-w / 2 + padding, h / 2 - padding - thickness, w - padding * 2, thickness);
  },
  // 31: L-Shape Bottom Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const thickness = Math.min(w, h) / 3;
    ctx.rect(-w / 2 + padding, -h / 2 + padding, thickness, h - padding * 2);
    ctx.rect(-w / 2 + padding, h / 2 - padding - thickness, w - padding * 2, thickness);
  },

  // --- Family 10: T-Shape (32..35) ---
  // 32: T-Shape Top
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const thickness = Math.min(w, h) / 3;
    ctx.rect(-w / 2 + padding, -h / 2 + padding, w - padding * 2, thickness);
    ctx.rect(-thickness / 2, -h / 2 + padding, thickness, h - padding * 2);
  },
  // 33: T-Shape Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const thickness = Math.min(w, h) / 3;
    ctx.rect(w / 2 - padding - thickness, -h / 2 + padding, thickness, h - padding * 2);
    ctx.rect(-w / 2 + padding, -thickness / 2, w - padding * 2, thickness);
  },
  // 34: T-Shape Bottom
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const thickness = Math.min(w, h) / 3;
    ctx.rect(-w / 2 + padding, h / 2 - padding - thickness, w - padding * 2, thickness);
    ctx.rect(-thickness / 2, -h / 2 + padding, thickness, h - padding * 2);
  },
  // 35: T-Shape Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const thickness = Math.min(w, h) / 3;
    ctx.rect(-w / 2 + padding, -h / 2 + padding, thickness, h - padding * 2);
    ctx.rect(-w / 2 + padding, -thickness / 2, w - padding * 2, thickness);
  },

  // --- Family 11: Diagonal Line (36..37) ---
  // 36: Diagonal (TL-BR)
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    ctx.strokeWeight(Math.min(w, h) * 0.15);
    ctx.line(-w / 2 + padding, -h / 2 + padding, w / 2 - padding, h / 2 - padding);
  },
  // 37: Diagonal (TR-BL)
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    ctx.strokeWeight(Math.min(w, h) * 0.15);
    ctx.line(w / 2 - padding, -h / 2 + padding, -w / 2 + padding, h / 2 - padding);
  },

  // --- Family 12: Quarter Arc (38..41) ---
  // 38: Arc Top Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.arc(-w / 2 + padding, -h / 2 + padding, w * 1.5, h * 1.5, 0, Math.PI / 2);
  },
  // 39: Arc Top Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.arc(w / 2 - padding, -h / 2 + padding, w * 1.5, h * 1.5, Math.PI / 2, Math.PI);
  },
  // 40: Arc Bottom Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.arc(w / 2 - padding, h / 2 - padding, w * 1.5, h * 1.5, Math.PI, Math.PI * 1.5);
  },
  // 41: Arc Bottom Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    ctx.arc(-w / 2 + padding, h / 2 - padding, w * 1.5, h * 1.5, Math.PI * 1.5, Math.PI * 2);
  },

  // --- Family 13: Grid 2x2 (42) ---
  // 42: Grid 2x2
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const gap = Math.min(w, h) * 0.1;
    const blockSize = (Math.min(w, h) - padding * 2 - gap) / 2;
    ctx.rect(-blockSize - gap / 2, -blockSize - gap / 2, blockSize, blockSize);
    ctx.rect(gap / 2, -blockSize - gap / 2, blockSize, blockSize);
    ctx.rect(-blockSize - gap / 2, gap / 2, blockSize, blockSize);
    ctx.rect(gap / 2, gap / 2, blockSize, blockSize);
  },

  // --- Family 14: Three Dots Diagonal (43..44) ---
  // 43: Three Dots (TL-BR)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const r = Math.min(w, h) * 0.15;
    ctx.ellipse(0, 0, r * 2, r * 2);
    ctx.ellipse(-w / 3 + padding / 2, -h / 3 + padding / 2, r * 2, r * 2);
    ctx.ellipse(w / 3 - padding / 2, h / 3 - padding / 2, r * 2, r * 2);
  },
  // 44: Three Dots (TR-BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const r = Math.min(w, h) * 0.15;
    ctx.ellipse(0, 0, r * 2, r * 2);
    ctx.ellipse(w / 3 - padding / 2, -h / 3 + padding / 2, r * 2, r * 2);
    ctx.ellipse(-w / 3 + padding / 2, h / 3 - padding / 2, r * 2, r * 2);
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

const TILE_FAMILIES_META = [
  { id: 'half-circle',     name: 'Meio Bloco & Círculo', tileIds: [0, 1, 2, 3] },
  { id: 'corner-triangle', name: 'Triângulos de Canto',  tileIds: [4, 5, 6, 7] },
  { id: 'side-triangle',   name: 'Triângulos Laterais',  tileIds: [8, 9, 10, 11] },
  { id: 'centered-geom',   name: 'Geometria Central',    tileIds: [12, 13, 14, 15] },
  { id: 'checkers',        name: 'Xadrez (Checkers)',    tileIds: [16, 17] },
  { id: 'stripes',         name: 'Listras (Stripes)',    tileIds: [18, 19] },
  { id: 'corner-waves',    name: 'Ondas de Canto',       tileIds: [20, 21, 22, 23] },
  { id: 'zigzag',          name: 'Zigue-Zague',          tileIds: [24, 25] },
  { id: 'bowtie',          name: 'Ampulheta & Laço',     tileIds: [26, 27] },
  { id: 'l-shape',         name: 'Cantoneira (L)',       tileIds: [28, 29, 30, 31] },
  { id: 't-shape',         name: 'Junção (T)',           tileIds: [32, 33, 34, 35] },
  { id: 'diagonal-line',   name: 'Linha Diagonal',       tileIds: [36, 37] },
  { id: 'quarter-arc',     name: 'Arco de Quarto',       tileIds: [38, 39, 40, 41] },
  { id: 'mini-grid',       name: 'Mini Grade 2×2',       tileIds: [42] },
  { id: 'diagonal-dots',   name: 'Três Pontos',          tileIds: [43, 44] }
];

/**
 * Build exact D4 group action tables for all 45 built-in tiles.
 * Every tileId maps under { id, r90, r180, r270, mx, my, md, mad } to its rotated/mirrored tileId.
 */
const TILE_D4_MAP = (() => {
  const map = {};
  const { D4_TRANSFORMS, composeD4 } = window.D4Symmetry;

  // 1) Register a 4-edge family given (L, R, T, B)
  function registerEdge4(L, R, T, B) {
    const baseFromL = {
      id: L,
      r90: T,
      r180: R,
      r270: B,
      mx: R,
      my: L,
      md: T,
      mad: B
    };
    const genTransforms = [
      { tile: L, fromL: 'id' },
      { tile: T, fromL: 'r90' },
      { tile: R, fromL: 'r180' },
      { tile: B, fromL: 'r270' }
    ];
    for (const { tile, fromL } of genTransforms) {
      map[tile] = {};
      for (const g of D4_TRANSFORMS) {
        const composed = composeD4(g, fromL);
        map[tile][g] = baseFromL[composed];
      }
    }
  }

  // 2) Register a 4-corner family given clockwise (TL, TR, BR, BL)
  function registerCorner4(TL, TR, BR, BL) {
    const baseFromTL = {
      id: TL,
      r90: TR,
      r180: BR,
      r270: BL,
      mx: TR,
      my: BL,
      md: TL,
      mad: BR
    };
    const genTransforms = [
      { tile: TL, fromTL: 'id' },
      { tile: TR, fromTL: 'r90' },
      { tile: BR, fromTL: 'r180' },
      { tile: BL, fromTL: 'r270' }
    ];
    for (const { tile, fromTL } of genTransforms) {
      map[tile] = {};
      for (const g of D4_TRANSFORMS) {
        const composed = composeD4(g, fromTL);
        map[tile][g] = baseFromTL[composed];
      }
    }
  }

  // 3) Register a 2-state axis-aligned family (Horizontal, Vertical)
  function registerAxis2(H, V) {
    map[H] = { id: H, r90: V, r180: H, r270: V, mx: H, my: H, md: V, mad: V };
    map[V] = { id: V, r90: H, r180: V, r270: H, mx: V, my: V, md: H, mad: H };
  }

  // 4) Register a 2-state diagonal family (TL_BR, TR_BL)
  function registerDiag2(D1, D2) {
    map[D1] = { id: D1, r90: D2, r180: D1, r270: D2, mx: D2, my: D2, md: D1, mad: D1 };
    map[D2] = { id: D2, r90: D1, r180: D2, r270: D1, mx: D1, my: D1, md: D2, mad: D2 };
  }

  // 5) Register a 1-state fully symmetric tile
  function registerSymmetric1(T) {
    map[T] = {};
    for (const g of D4_TRANSFORMS) {
      map[T][g] = T;
    }
  }

  // Populate all 15 families (tiles 0..44)
  registerEdge4(0, 1, 2, 3);        // Family 0: Half Rect + Circle
  registerCorner4(4, 5, 7, 6);      // Family 1: Corner Triangles (note: 6 is BL, 7 is BR)
  registerEdge4(8, 9, 10, 11);      // Family 2: Side Triangles
  registerSymmetric1(12);           // Family 3: Diamond
  registerSymmetric1(13);           // Family 3: Cross
  registerSymmetric1(14);           // Family 3: Target
  registerSymmetric1(15);           // Family 3: Four Dots
  registerDiag2(16, 17);            // Family 4: Checkers
  registerAxis2(18, 19);            // Family 5: Stripes
  registerCorner4(20, 21, 22, 23);  // Family 6: Corner Waves
  registerAxis2(24, 25);            // Family 7: Zigzag
  registerAxis2(26, 27);            // Family 8: Bowtie / Hourglass
  registerCorner4(28, 29, 30, 31);  // Family 9: L-Shape
  registerEdge4(35, 33, 32, 34);    // Family 10: T-Shape (32=T, 33=R, 34=B, 35=L)
  registerDiag2(36, 37);            // Family 11: Diagonal Line
  registerCorner4(38, 39, 40, 41);  // Family 12: Quarter Arc
  registerSymmetric1(42);           // Family 13: Grid 2x2
  registerDiag2(43, 44);            // Family 14: Three Dots Diagonal

  return map;
})();

/**
 * Returns the transformed tileId for a given tileId and D4 transform key.
 */
function getTransformedTileId(tileId, transformKey) {
  const entry = TILE_D4_MAP[tileId];
  if (!entry) return tileId;
  return entry[transformKey] !== undefined ? entry[transformKey] : tileId;
}

/**
 * Finds the family metadata object containing a given tileId.
 */
function getFamilyForTile(tileId) {
  return TILE_FAMILIES_META.find((f) => f.tileIds.includes(tileId)) || null;
}

window.TileRegistry = {
  TILE_RENDERERS,
  TILE_NAMES,
  TILE_FAMILIES_META,
  TILE_D4_MAP,
  getTransformedTileId,
  getFamilyForTile
};

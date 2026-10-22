/**
 * core/tile_registry.js
 * Central catalog of vector tile renderers, named families, and D4 orientation maps.
 */

/**
 * Vector drawing helper for annular sectors (curved bands / ribbons)
 */
function drawAnnularSector(ctx, cx, cy, rxIn, ryIn, rxOut, ryOut, aStart, aEnd, steps = 16) {
  ctx.beginShape();
  for (let i = 0; i <= steps; i++) {
    const a = aStart + (aEnd - aStart) * (i / steps);
    ctx.vertex(cx + Math.cos(a) * rxOut, cy + Math.sin(a) * ryOut);
  }
  for (let i = steps; i >= 0; i--) {
    const a = aStart + (aEnd - aStart) * (i / steps);
    ctx.vertex(cx + Math.cos(a) * rxIn, cy + Math.sin(a) * ryIn);
  }
  ctx.endShape('CLOSE');
}

/**
 * Vector drawing helper for smooth edge semicircles
 */
function drawSemicircle(ctx, cx, cy, rx, ry, aStart, aEnd, steps = 16) {
  ctx.beginShape();
  ctx.vertex(cx, cy);
  for (let i = 0; i <= steps; i++) {
    const a = aStart + (aEnd - aStart) * (i / steps);
    ctx.vertex(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  ctx.endShape('CLOSE');
}

/**
 * Vector drawing helper for Gothic corner petals / lens
 */
function drawPetal(ctx, rx, ry, c1x, c1y, a1Start, a1End, c2x, c2y, a2Start, a2End, steps = 12) {
  ctx.beginShape();
  for (let i = 0; i <= steps; i++) {
    const a = a1Start + (a1End - a1Start) * (i / steps);
    ctx.vertex(c1x + Math.cos(a) * rx, c1y + Math.sin(a) * ry);
  }
  for (let i = 0; i <= steps; i++) {
    const a = a2Start + (a2End - a2Start) * (i / steps);
    ctx.vertex(c2x + Math.cos(a) * rx, c2y + Math.sin(a) * ry);
  }
  ctx.endShape('CLOSE');
}

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
  },

  // --- Family 15: Empty / Blank Tile (45) ---
  // 45: Empty (Vazio)
  function () {
    // Intentionally empty (blank space / negative space tile)
  }
,

  // --- Family 16: Faixa Central / Center Stripe (46..47) ---
  // 46: Center Stripe Horizontal
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const barH = dh / 3;
    ctx.rect(-dw / 2, -barH / 2, dw, barH);
  },
  // 47: Center Stripe Vertical
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const barW = dw / 3;
    ctx.rect(-barW / 2, -dh / 2, barW, dh);
  },

  // --- Family 17: Arco de Fita (90°) / Elbow Ribbon (48..51) ---
  // 48: Elbow Ribbon Top Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, -dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, 0, Math.PI / 2);
  },
  // 49: Elbow Ribbon Top Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, -dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, Math.PI / 2, Math.PI);
  },
  // 50: Elbow Ribbon Bottom Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, Math.PI, (3 * Math.PI) / 2);
  },
  // 51: Elbow Ribbon Bottom Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, (3 * Math.PI) / 2, 2 * Math.PI);
  },

  // --- Family 18: Fita Truchet Dupla / Dual Ribbon Truchet (52..53) ---
  // 52: Dual Ribbon Truchet (TL-BR)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, -dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, 0, Math.PI / 2);
    drawAnnularSector(ctx, dw / 2, dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, Math.PI, (3 * Math.PI) / 2);
  },
  // 53: Dual Ribbon Truchet (TR-BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, -dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, Math.PI / 2, Math.PI);
    drawAnnularSector(ctx, -dw / 2, dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, (3 * Math.PI) / 2, 2 * Math.PI);
  },

  // --- Family 19: Semicírculo de Borda / Edge Semicircles (54..57) ---
  // 54: Semicircle Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawSemicircle(ctx, -dw / 2, 0, dw / 2, dh / 2, -Math.PI / 2, Math.PI / 2);
  },
  // 55: Semicircle Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawSemicircle(ctx, dw / 2, 0, dw / 2, dh / 2, Math.PI / 2, (3 * Math.PI) / 2);
  },
  // 56: Semicircle Top
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawSemicircle(ctx, 0, -dh / 2, dw / 2, dh / 2, 0, Math.PI);
  },
  // 57: Semicircle Bottom
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawSemicircle(ctx, 0, dh / 2, dw / 2, dh / 2, Math.PI, 2 * Math.PI);
  },

  // --- Family 20: Meio Bloco Sólido / Solid Half-Block (58..61) ---
  // 58: Solid Half Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw / 2, dh);
  },
  // 59: Solid Half Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(0, -dh / 2, dw / 2, dh);
  },
  // 60: Solid Half Top
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw, dh / 2);
  },
  // 61: Solid Half Bottom
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, 0, dw, dh / 2);
  },

  // --- Family 21: Pétala de Canto / Corner Petal (62..65) ---
  // 62: Corner Petal Top Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawPetal(ctx, dw / 2, dh / 2, -dw / 2, 0, 0, -Math.PI / 2, 0, -dh / 2, Math.PI, Math.PI / 2);
  },
  // 63: Corner Petal Top Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawPetal(ctx, dw / 2, dh / 2, dw / 2, 0, Math.PI, (3 * Math.PI) / 2, 0, -dh / 2, 0, Math.PI / 2);
  },
  // 64: Corner Petal Bottom Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawPetal(ctx, dw / 2, dh / 2, dw / 2, 0, Math.PI, Math.PI / 2, 0, dh / 2, 0, -Math.PI / 2);
  },
  // 65: Corner Petal Bottom Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawPetal(ctx, dw / 2, dh / 2, -dw / 2, 0, 0, Math.PI / 2, 0, dh / 2, Math.PI, (3 * Math.PI) / 2);
  },

  // --- Family 22: Alvo Quadrado / Concentric Squares (66) ---
  // 66: Concentric Squares
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const weight = Math.min(w, h) / 20;
    ctx.strokeWeight(weight);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw, dh);
    ctx.rect(-dw * 0.3, -dh * 0.3, dw * 0.6, dh * 0.6);
    ctx.rect(-dw * 0.1, -dh * 0.1, dw * 0.2, dh * 0.2);
  },

  // --- Family 23: Losango Vazado / Diamond Frame (67) ---
  // 67: Diamond Frame
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const weight = Math.min(w, h) * 0.14;
    ctx.strokeWeight(weight);
    const dw = (w - padding * 2 - weight) / 2;
    const dh = (h - padding * 2 - weight) / 2;
    ctx.beginShape();
    ctx.vertex(0, -dh);
    ctx.vertex(dw, 0);
    ctx.vertex(0, dh);
    ctx.vertex(-dw, 0);
    ctx.endShape('CLOSE');
  },

  // --- Family 24: Listras Diagonais / Diagonal Hatching (68..69) ---
  // 68: Diagonal Hatching (TL-BR)
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.12);
    ctx.line(-dw / 2, -dh / 2, dw / 2, dh / 2);
    ctx.line(0, -dh / 2, dw / 2, 0);
    ctx.line(-dw / 2, 0, 0, dh / 2);
  },
  // 69: Diagonal Hatching (TR-BL)
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.12);
    ctx.line(dw / 2, -dh / 2, -dw / 2, dh / 2);
    ctx.line(-dw / 2, 0, 0, -dh / 2);
    ctx.line(0, dh / 2, dw / 2, 0);
  },

  // --- Family 25: Ponta de Flecha / Chevron (70..73) ---
  // 70: Chevron Left
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.beginShape();
    ctx.vertex(-dw / 2, 0);
    ctx.vertex(dw / 2, -dh / 2);
    ctx.vertex(dw / 2, -dh / 6);
    ctx.vertex(-dw / 6, 0);
    ctx.vertex(dw / 2, dh / 6);
    ctx.vertex(dw / 2, dh / 2);
    ctx.endShape('CLOSE');
  },
  // 71: Chevron Right
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.beginShape();
    ctx.vertex(dw / 2, 0);
    ctx.vertex(-dw / 2, -dh / 2);
    ctx.vertex(-dw / 2, -dh / 6);
    ctx.vertex(dw / 6, 0);
    ctx.vertex(-dw / 2, dh / 6);
    ctx.vertex(-dw / 2, dh / 2);
    ctx.endShape('CLOSE');
  },
  // 72: Chevron Top
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.beginShape();
    ctx.vertex(0, -dh / 2);
    ctx.vertex(dw / 2, dh / 2);
    ctx.vertex(dw / 6, dh / 2);
    ctx.vertex(0, -dh / 6);
    ctx.vertex(-dw / 6, dh / 2);
    ctx.vertex(-dw / 2, dh / 2);
    ctx.endShape('CLOSE');
  },
  // 73: Chevron Bottom
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.beginShape();
    ctx.vertex(0, dh / 2);
    ctx.vertex(dw / 2, -dh / 2);
    ctx.vertex(dw / 6, -dh / 2);
    ctx.vertex(0, dh / 6);
    ctx.vertex(-dw / 6, -dh / 2);
    ctx.vertex(-dw / 2, -dh / 2);
    ctx.endShape('CLOSE');
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
  "Three Dots (TR-BL)",
  "Tile Vazio (Espaço)"
,
  // Family 16: Faixa Central (46..47)
  "Faixa Central Horizontal",
  "Faixa Central Vertical",
  // Family 17: Arco de Fita 90° (48..51)
  "Arco de Fita Top Left",
  "Arco de Fita Top Right",
  "Arco de Fita Bottom Right",
  "Arco de Fita Bottom Left",
  // Family 18: Fita Truchet Dupla (52..53)
  "Fita Truchet (TL-BR)",
  "Fita Truchet (TR-BL)",
  // Family 19: Semicírculo de Borda (54..57)
  "Semicírculo Esquerdo",
  "Semicírculo Direito",
  "Semicírculo Superior",
  "Semicírculo Inferior",
  // Family 20: Meio Bloco Sólido (58..61)
  "Meio Bloco Esquerdo",
  "Meio Bloco Direito",
  "Meio Bloco Superior",
  "Meio Bloco Inferior",
  // Family 21: Pétala de Canto (62..65)
  "Pétala Top Left",
  "Pétala Top Right",
  "Pétala Bottom Right",
  "Pétala Bottom Left",
  // Family 22: Alvo Quadrado (66)
  "Alvo Quadrado",
  // Family 23: Losango Vazado (67)
  "Losango Vazado",
  // Family 24: Listras Diagonais (68..69)
  "Listras Diagonais (TL-BR)",
  "Listras Diagonais (TR-BL)",
  // Family 25: Ponta de Flecha V (70..73)
  "Ponta de Flecha (Esquerda)",
  "Ponta de Flecha (Direita)",
  "Ponta de Flecha (Cima)",
  "Ponta de Flecha (Baixo)"
];

const TILE_FAMILIES_META = [
  { id: 'empty-tile',      name: 'Tile Vazio (Espaço)',  tileIds: [45] },
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
,
  { id: 'center-stripe',   name: 'Faixa Central',        tileIds: [46, 47] },
  { id: 'elbow-ribbon',    name: 'Arco de Fita (90°)',   tileIds: [48, 49, 50, 51] },
  { id: 'truchet-ribbon',  name: 'Fita Truchet Dupla',   tileIds: [52, 53] },
  { id: 'edge-semicircle', name: 'Semicírculo de Borda', tileIds: [54, 55, 56, 57] },
  { id: 'half-block',      name: 'Meio Bloco Sólido',    tileIds: [58, 59, 60, 61] },
  { id: 'corner-petal',    name: 'Pétala de Canto',      tileIds: [62, 63, 64, 65] },
  { id: 'target-square',   name: 'Alvo Quadrado',        tileIds: [66] },
  { id: 'diamond-frame',   name: 'Losango Vazado',       tileIds: [67] },
  { id: 'diagonal-hatch',  name: 'Listras Diagonais',    tileIds: [68, 69] },
  { id: 'chevron',         name: 'Ponta de Flecha (V)',  tileIds: [70, 71, 72, 73] }
];

/**
 * Build exact D4 group action tables for all 46 built-in tiles.
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

  // Populate all 16 families (tiles 0..45)
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
  registerSymmetric1(45);           // Family 15: Empty (Vazio)
  registerAxis2(46, 47);            // Family 16: Faixa Central
  registerCorner4(48, 49, 50, 51);  // Family 17: Arco de Fita (90°)
  registerDiag2(52, 53);            // Family 18: Fita Truchet Dupla
  registerEdge4(54, 55, 56, 57);    // Family 19: Semicírculo de Borda
  registerEdge4(58, 59, 60, 61);    // Family 20: Meio Bloco Sólido
  registerCorner4(62, 63, 64, 65);  // Family 21: Pétala de Canto
  registerSymmetric1(66);           // Family 22: Alvo Quadrado
  registerSymmetric1(67);           // Family 23: Losango Vazado
  registerDiag2(68, 69);            // Family 24: Listras Diagonais
  registerEdge4(70, 71, 72, 73);    // Family 25: Ponta de Flecha (V)

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

/**
 * Returns the next (or previous) tileId within the same family.
 */
function getNextTileInFamily(tileId, step = 1) {
  const fam = getFamilyForTile(tileId);
  if (!fam || fam.tileIds.length <= 1) return tileId;
  const idx = fam.tileIds.indexOf(tileId);
  if (idx === -1) return tileId;
  const len = fam.tileIds.length;
  return fam.tileIds[(idx + step + len * 10) % len];
}

window.TileRegistry = {
  TILE_RENDERERS,
  TILE_NAMES,
  TILE_FAMILIES_META,
  TILE_D4_MAP,
  getTransformedTileId,
  getFamilyForTile,
  getNextTileInFamily
};

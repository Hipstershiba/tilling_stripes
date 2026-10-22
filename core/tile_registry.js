/**
 * core/tile_registry.js
 * Central catalog of vector tile renderers, named families, and D4 orientation maps.
 * Fully harmonized to 1/3 and 1/2 modules with sub-pixel alignment and grouped clusters.
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
  // --- GRUPO 1: FITAS, CONEXÕES & TUBOS (Módulo 1/3) ---
  // Family 0: Faixa Central (0, 1)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 6, dw, dh / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 6, -dh / 2, dw / 3, dh);
  },

  // Family 1: Junção Central (T) (2..5: L, R, T, B)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 6, -dh / 2, dw / 3, dh);
    ctx.rect(-dw / 2, -dh / 6, dw / 2, dh / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 6, -dh / 2, dw / 3, dh);
    ctx.rect(0, -dh / 6, dw / 2, dh / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 6, dw, dh / 3);
    ctx.rect(-dw / 6, -dh / 2, dw / 3, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 6, dw, dh / 3);
    ctx.rect(-dw / 6, 0, dw / 3, dh / 2);
  },

  // Family 2: Cruz Central (+) (6)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 6, -dh / 2, dw / 3, dh);
    ctx.rect(-dw / 2, -dh / 6, dw, dh / 3);
  },

  // Family 3: Arco de Fita (90°) (7..10: TL, TR, BR, BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, -dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, 0, Math.PI / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, -dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, Math.PI / 2, Math.PI);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, Math.PI, (3 * Math.PI) / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, (3 * Math.PI) / 2, 2 * Math.PI);
  },

  // Family 4: Fita Truchet Dupla (11, 12: TL-BR, TR-BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, -dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, 0, Math.PI / 2);
    drawAnnularSector(ctx, dw / 2, dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, Math.PI, (3 * Math.PI) / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, -dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, Math.PI / 2, Math.PI);
    drawAnnularSector(ctx, -dw / 2, dh / 2, dw / 3, dh / 3, (2 * dw) / 3, (2 * dh) / 3, (3 * Math.PI) / 2, 2 * Math.PI);
  },

  // Family 5: Cantoneira Central (L) (13..16: TL, TR, BR, BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 6, dw / 2 + dw / 6, dh / 3);
    ctx.rect(-dw / 6, -dh / 2, dw / 3, dh / 2 + dh / 6);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 6, -dh / 6, dw / 2 + dw / 6, dh / 3);
    ctx.rect(-dw / 6, -dh / 2, dw / 3, dh / 2 + dh / 6);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 6, -dh / 6, dw / 2 + dw / 6, dh / 3);
    ctx.rect(-dw / 6, -dh / 6, dw / 3, dh / 2 + dh / 6);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 6, dw / 2 + dw / 6, dh / 3);
    ctx.rect(-dw / 6, -dh / 6, dw / 3, dh / 2 + dh / 6);
  },

  // Family 6: Cantoneira de Borda (L) (17..20: TL, TR, BR, BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw / 3, dh);
    ctx.rect(-dw / 2, -dh / 2, dw, dh / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(dw / 6, -dh / 2, dw / 3, dh);
    ctx.rect(-dw / 2, -dh / 2, dw, dh / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(dw / 6, -dh / 2, dw / 3, dh);
    ctx.rect(-dw / 2, dh / 6, dw, dh / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw / 3, dh);
    ctx.rect(-dw / 2, dh / 6, dw, dh / 3);
  },

  // Family 7: Junção de Borda (T) (21..24: L, R, T, B)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw / 3, dh);
    ctx.rect(-dw / 2, -dh / 6, dw, dh / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(dw / 6, -dh / 2, dw / 3, dh);
    ctx.rect(-dw / 2, -dh / 6, dw, dh / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw, dh / 3);
    ctx.rect(-dw / 6, -dh / 2, dw / 3, dh);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, dh / 6, dw, dh / 3);
    ctx.rect(-dw / 6, -dh / 2, dw / 3, dh);
  },

  // --- GRUPO 2: LISTRAS, GRADES & TRAMAS ---
  // Family 8: Listras Paralelas (25, 26: H, V)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw, dh / 3);
    ctx.rect(-dw / 2, dh / 6, dw, dh / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw / 3, dh);
    ctx.rect(dw / 6, -dh / 2, dw / 3, dh);
  },

  // Family 9: Curva de Listras Duplas (90°) (27..30: TL, TR, BR, BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, -dh / 2, 0, 0, dw / 3, dh / 3, 0, Math.PI / 2);
    drawAnnularSector(ctx, -dw / 2, -dh / 2, (2 * dw) / 3, (2 * dh) / 3, dw, dh, 0, Math.PI / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, -dh / 2, 0, 0, dw / 3, dh / 3, Math.PI / 2, Math.PI);
    drawAnnularSector(ctx, dw / 2, -dh / 2, (2 * dw) / 3, (2 * dh) / 3, dw, dh, Math.PI / 2, Math.PI);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, dh / 2, 0, 0, dw / 3, dh / 3, Math.PI, (3 * Math.PI) / 2);
    drawAnnularSector(ctx, dw / 2, dh / 2, (2 * dw) / 3, (2 * dh) / 3, dw, dh, Math.PI, (3 * Math.PI) / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, dh / 2, 0, 0, dw / 3, dh / 3, (3 * Math.PI) / 2, 2 * Math.PI);
    drawAnnularSector(ctx, -dw / 2, dh / 2, (2 * dw) / 3, (2 * dh) / 3, dw, dh, (3 * Math.PI) / 2, 2 * Math.PI);
  },

  // Family 10: Linha Diagonal (31, 32: TL-BR, TR-BL)
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.12);
    ctx.line(-dw / 2, -dh / 2, dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.12);
    ctx.line(dw / 2, -dh / 2, -dw / 2, dh / 2);
  },

  // Family 11: Listras Diagonais (Hachura) (33, 34: TL-BR, TR-BL)
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

  // Family 12: Zigue-Zague (35, 36: H, V)
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.12);
    ctx.beginShape();
    ctx.vertex(-dw / 2, 0);
    ctx.vertex(-dw / 4, -dh / 3);
    ctx.vertex(0, 0);
    ctx.vertex(dw / 4, dh / 3);
    ctx.vertex(dw / 2, 0);
    ctx.endShape();
  },
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.12);
    ctx.beginShape();
    ctx.vertex(0, -dh / 2);
    ctx.vertex(-dw / 3, -dh / 4);
    ctx.vertex(0, 0);
    ctx.vertex(dw / 3, dh / 4);
    ctx.vertex(0, dh / 2);
    ctx.endShape();
  },

  // Family 13: Mini Grade 2×2 (37)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const gapX = dw * 0.1;
    const gapY = dh * 0.1;
    const bw = (dw - gapX) / 2;
    const bh = (dh - gapY) / 2;
    ctx.rect(-dw / 2, -dh / 2, bw, bh);
    ctx.rect(gapX / 2, -dh / 2, bw, bh);
    ctx.rect(-dw / 2, gapY / 2, bw, bh);
    ctx.rect(gapX / 2, gapY / 2, bw, bh);
  },

  // Family 14: Xadrez (Checkers) (38, 39: TL-BR, TR-BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw / 2, dh / 2);
    ctx.rect(0, 0, dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(0, -dh / 2, dw / 2, dh / 2);
    ctx.rect(-dw / 2, 0, dw / 2, dh / 2);
  },

  // --- GRUPO 3: MASSAS SÓLIDAS & FORMAS ANGULARES ---
  // Family 15: Meio Bloco Sólido (40..43: L, R, T, B)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw / 2, dh);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(0, -dh / 2, dw / 2, dh);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, 0, dw, dh / 2);
  },

  // Family 16: Triângulos de Canto (44..47: TL, TR, BR, BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(-dw / 2, -dh / 2, dw / 2, -dh / 2, -dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(-dw / 2, -dh / 2, dw / 2, -dh / 2, dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(dw / 2, -dh / 2, dw / 2, dh / 2, -dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(-dw / 2, -dh / 2, -dw / 2, dh / 2, dw / 2, dh / 2);
  },

  // Family 17: Triângulos Laterais (48..51: L, R, T, B)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(-dw / 2, 0, dw / 2, -dh / 2, dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(dw / 2, 0, -dw / 2, -dh / 2, -dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(0, -dh / 2, dw / 2, dh / 2, -dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(0, dh / 2, -dw / 2, -dh / 2, dw / 2, -dh / 2);
  },

  // Family 18: Ponta de Flecha (Chevron) (52..55: L, R, T, B)
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
  },

  // Family 19: Ampulheta & Laço (Bowtie) (56, 57: H, V)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(-dw / 2, -dh / 2, -dw / 2, dh / 2, 0, 0);
    ctx.triangle(dw / 2, -dh / 2, dw / 2, dh / 2, 0, 0);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.triangle(-dw / 2, -dh / 2, dw / 2, -dh / 2, 0, 0);
    ctx.triangle(-dw / 2, dh / 2, dw / 2, dh / 2, 0, 0);
  },

  // Family 20: Losango Sólido (Diamond) (58)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.beginShape();
    ctx.vertex(0, -dh / 2);
    ctx.vertex(dw / 2, 0);
    ctx.vertex(0, dh / 2);
    ctx.vertex(-dw / 2, 0);
    ctx.endShape('CLOSE');
  },

  // Family 21: Losango Vazado (Diamond Frame) (59)
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const weight = Math.min(dw, dh) * 0.12;
    ctx.strokeWeight(weight);
    const halfW = (dw - weight) / 2;
    const halfH = (dh - weight) / 2;
    ctx.beginShape();
    ctx.vertex(0, -halfH);
    ctx.vertex(halfW, 0);
    ctx.vertex(0, halfH);
    ctx.vertex(-halfW, 0);
    ctx.endShape('CLOSE');
  },

  // --- GRUPO 4: CÍRCULOS, ARCOS & ROSETAS ---
  // Family 22: Meio Bloco & Círculo (60..63: L, R, T, B)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw / 2, dh);
    ctx.ellipse(dw / 4, 0, dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(0, -dh / 2, dw / 2, dh);
    ctx.ellipse(-dw / 4, 0, dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw, dh / 2);
    ctx.ellipse(0, dh / 4, dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.rect(-dw / 2, 0, dw, dh / 2);
    ctx.ellipse(0, -dh / 4, dw / 2, dh / 2);
  },

  // Family 23: Semicírculo de Borda (64..67: L, R, T, B)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawSemicircle(ctx, -dw / 2, 0, dw / 2, dh / 2, -Math.PI / 2, Math.PI / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawSemicircle(ctx, dw / 2, 0, dw / 2, dh / 2, Math.PI / 2, (3 * Math.PI) / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawSemicircle(ctx, 0, -dh / 2, dw / 2, dh / 2, 0, Math.PI);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawSemicircle(ctx, 0, dh / 2, dw / 2, dh / 2, Math.PI, 2 * Math.PI);
  },

  // Family 24: Arco de Quarto (Médio) (68..71: TL, TR, BR, BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, -dh / 2, 0, 0, dw / 2, dh / 2, 0, Math.PI / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, -dh / 2, 0, 0, dw / 2, dh / 2, Math.PI / 2, Math.PI);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, dh / 2, 0, 0, dw / 2, dh / 2, Math.PI, (3 * Math.PI) / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, dh / 2, 0, 0, dw / 2, dh / 2, (3 * Math.PI) / 2, 2 * Math.PI);
  },

  // Family 25: Arco de Quarto (Total) (72..75: TL, TR, BR, BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, -dh / 2, 0, 0, dw, dh, 0, Math.PI / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, -dh / 2, 0, 0, dw, dh, Math.PI / 2, Math.PI);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, dw / 2, dh / 2, 0, 0, dw, dh, Math.PI, (3 * Math.PI) / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawAnnularSector(ctx, -dw / 2, dh / 2, 0, 0, dw, dh, (3 * Math.PI) / 2, 2 * Math.PI);
  },

  // Family 26: Pétala de Canto (Roseta) (76..79: TL, TR, BR, BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawPetal(ctx, dw / 2, dh / 2, -dw / 2, 0, 0, -Math.PI / 2, 0, -dh / 2, Math.PI, Math.PI / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawPetal(ctx, dw / 2, dh / 2, dw / 2, 0, Math.PI, (3 * Math.PI) / 2, 0, -dh / 2, 0, Math.PI / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawPetal(ctx, dw / 2, dh / 2, dw / 2, 0, Math.PI, Math.PI / 2, 0, dh / 2, 0, -Math.PI / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    drawPetal(ctx, dw / 2, dh / 2, -dw / 2, 0, 0, Math.PI / 2, 0, dh / 2, Math.PI, (3 * Math.PI) / 2);
  },

  // Family 27: Ondas de Canto (80..83: TL, TR, BR, BL)
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.1);
    ctx.arc(-dw / 2, -dh / 2, (dw * 2) / 3, (dh * 2) / 3, 0, Math.PI / 2);
    ctx.arc(-dw / 2, -dh / 2, (dw * 4) / 3, (dh * 4) / 3, 0, Math.PI / 2);
    ctx.arc(-dw / 2, -dh / 2, dw * 2, dh * 2, 0, Math.PI / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.1);
    ctx.arc(dw / 2, -dh / 2, (dw * 2) / 3, (dh * 2) / 3, Math.PI / 2, Math.PI);
    ctx.arc(dw / 2, -dh / 2, (dw * 4) / 3, (dh * 4) / 3, Math.PI / 2, Math.PI);
    ctx.arc(dw / 2, -dh / 2, dw * 2, dh * 2, Math.PI / 2, Math.PI);
  },
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.1);
    ctx.arc(dw / 2, dh / 2, (dw * 2) / 3, (dh * 2) / 3, Math.PI, (3 * Math.PI) / 2);
    ctx.arc(dw / 2, dh / 2, (dw * 4) / 3, (dh * 4) / 3, Math.PI, (3 * Math.PI) / 2);
    ctx.arc(dw / 2, dh / 2, dw * 2, dh * 2, Math.PI, (3 * Math.PI) / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.1);
    ctx.arc(-dw / 2, dh / 2, (dw * 2) / 3, (dh * 2) / 3, (3 * Math.PI) / 2, 2 * Math.PI);
    ctx.arc(-dw / 2, dh / 2, (dw * 4) / 3, (dh * 4) / 3, (3 * Math.PI) / 2, 2 * Math.PI);
    ctx.arc(-dw / 2, dh / 2, dw * 2, dh * 2, (3 * Math.PI) / 2, 2 * Math.PI);
  },

  // --- GRUPO 5: FOCOS CENTRAIS & PONTOS ---
  // Family 28: Alvo Circular (Target) (84)
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const weight = Math.min(dw, dh) * 0.06;
    ctx.strokeWeight(weight);
    ctx.ellipse(0, 0, dw, dh);
    ctx.ellipse(0, 0, dw * 0.6, dh * 0.6);
    ctx.ellipse(0, 0, dw * 0.2, dh * 0.2);
  },

  // Family 29: Alvo Quadrado (85)
  function (ctx, w, h, padding, color) {
    ctx.noFill();
    ctx.stroke(color);
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const weight = Math.min(dw, dh) * 0.06;
    ctx.strokeWeight(weight);
    ctx.rect(-dw / 2, -dh / 2, dw, dh);
    ctx.rect(-dw * 0.3, -dh * 0.3, dw * 0.6, dh * 0.6);
    ctx.rect(-dw * 0.1, -dh * 0.1, dw * 0.2, dh * 0.2);
  },

  // Family 30: Quatro Pontos (86)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const d = Math.min(dw, dh) * 0.18;
    const ox = dw / 4;
    const oy = dh / 4;
    ctx.ellipse(-ox, -oy, d, d);
    ctx.ellipse(ox, -oy, d, d);
    ctx.ellipse(-ox, oy, d, d);
    ctx.ellipse(ox, oy, d, d);
  },

  // Family 31: Três Pontos Diagonais (87, 88: TL-BR, TR-BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const d = Math.min(dw, dh) * 0.18;
    ctx.ellipse(0, 0, d, d);
    ctx.ellipse(-dw / 3, -dh / 3, d, d);
    ctx.ellipse(dw / 3, dh / 3, d, d);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color);
    ctx.noStroke();
    const dw = w - padding * 2;
    const dh = h - padding * 2;
    const d = Math.min(dw, dh) * 0.18;
    ctx.ellipse(0, 0, d, d);
    ctx.ellipse(dw / 3, -dh / 3, d, d);
    ctx.ellipse(-dw / 3, dh / 3, d, d);
  },

  // --- GRUPO 6: ESPAÇO NEGATIVO ---
  // Family 32: Tile Vazio (Espaço) (89)
  function () {
    // Intentionally empty
  }
];

const TILE_NAMES = [
  // Grupo 1: Fitas, Conexões & Tubos
  "Faixa Central Horizontal",
  "Faixa Central Vertical",
  "Junção Central (T) Esquerda",
  "Junção Central (T) Direita",
  "Junção Central (T) Cima",
  "Junção Central (T) Baixo",
  "Cruz Central (+)",
  "Arco de Fita Top Left",
  "Arco de Fita Top Right",
  "Arco de Fita Bottom Right",
  "Arco de Fita Bottom Left",
  "Fita Truchet (TL-BR)",
  "Fita Truchet (TR-BL)",
  "Cantoneira Central (L) Top Left",
  "Cantoneira Central (L) Top Right",
  "Cantoneira Central (L) Bottom Right",
  "Cantoneira Central (L) Bottom Left",
  "Cantoneira de Borda (L) Top Left",
  "Cantoneira de Borda (L) Top Right",
  "Cantoneira de Borda (L) Bottom Right",
  "Cantoneira de Borda (L) Bottom Left",
  "Junção de Borda (T) Esquerda",
  "Junção de Borda (T) Direita",
  "Junção de Borda (T) Cima",
  "Junção de Borda (T) Baixo",

  // Grupo 2: Listras, Grades & Tramas
  "Listras Paralelas Horizontal",
  "Listras Paralelas Vertical",
  "Curva de Listras Duplas Top Left",
  "Curva de Listras Duplas Top Right",
  "Curva de Listras Duplas Bottom Right",
  "Curva de Listras Duplas Bottom Left",
  "Linha Diagonal (TL-BR)",
  "Linha Diagonal (TR-BL)",
  "Listras Diagonais (TL-BR)",
  "Listras Diagonais (TR-BL)",
  "Zigue-Zague Horizontal",
  "Zigue-Zague Vertical",
  "Mini Grade 2×2",
  "Xadrez (TL-BR)",
  "Xadrez Inverso (TR-BL)",

  // Grupo 3: Massas Sólidas & Formas Angulares
  "Meio Bloco Esquerdo",
  "Meio Bloco Direito",
  "Meio Bloco Superior",
  "Meio Bloco Inferior",
  "Triângulo de Canto Top Left",
  "Triângulo de Canto Top Right",
  "Triângulo de Canto Bottom Right",
  "Triângulo de Canto Bottom Left",
  "Triângulo Lateral Esquerdo",
  "Triângulo Lateral Direito",
  "Triângulo Lateral Superior",
  "Triângulo Lateral Inferior",
  "Ponta de Flecha (Esquerda)",
  "Ponta de Flecha (Direita)",
  "Ponta de Flecha (Cima)",
  "Ponta de Flecha (Baixo)",
  "Ampulheta (Horizontal / Laço)",
  "Ampulheta (Vertical)",
  "Losango Sólido",
  "Losango Vazado",

  // Grupo 4: Círculos, Arcos & Rosetas
  "Meio Bloco & Círculo (Esquerdo)",
  "Meio Bloco & Círculo (Direito)",
  "Meio Bloco & Círculo (Superior)",
  "Meio Bloco & Círculo (Inferior)",
  "Semicírculo de Borda (Esquerdo)",
  "Semicírculo de Borda (Direito)",
  "Semicírculo de Borda (Superior)",
  "Semicírculo de Borda (Inferior)",
  "Arco de Quarto Médio Top Left",
  "Arco de Quarto Médio Top Right",
  "Arco de Quarto Médio Bottom Right",
  "Arco de Quarto Médio Bottom Left",
  "Arco de Quarto Total Top Left",
  "Arco de Quarto Total Top Right",
  "Arco de Quarto Total Bottom Right",
  "Arco de Quarto Total Bottom Left",
  "Pétala de Canto Top Left",
  "Pétala de Canto Top Right",
  "Pétala de Canto Bottom Right",
  "Pétala de Canto Bottom Left",
  "Ondas de Canto Top Left",
  "Ondas de Canto Top Right",
  "Ondas de Canto Bottom Right",
  "Ondas de Canto Bottom Left",

  // Grupo 5: Focos Centrais & Pontos
  "Alvo Circular (Target)",
  "Alvo Quadrado",
  "Quatro Pontos",
  "Três Pontos (TL-BR)",
  "Três Pontos (TR-BL)",

  // Grupo 6: Espaço Negativo
  "Tile Vazio (Espaço)"
];

const TILE_FAMILIES_META = [
  // --- GRUPO 1: FITAS, CONEXÕES & TUBOS ---
  { id: 'center-stripe',   name: 'Faixa Central',                group: 'Fitas & Tubos',  tileIds: [0, 1] },
  { id: 'center-tee',      name: 'Junção Central (T)',           group: 'Fitas & Tubos',  tileIds: [2, 3, 4, 5] },
  { id: 'center-cross',    name: 'Cruz Central (+)',             group: 'Fitas & Tubos',  tileIds: [6] },
  { id: 'elbow-ribbon',    name: 'Arco de Fita (90°)',           group: 'Fitas & Tubos',  tileIds: [7, 8, 9, 10] },
  { id: 'truchet-ribbon',  name: 'Fita Truchet Dupla',           group: 'Fitas & Tubos',  tileIds: [11, 12] },
  { id: 'center-elbow',    name: 'Cantoneira Central (L)',       group: 'Fitas & Tubos',  tileIds: [13, 14, 15, 16] },
  { id: 'edge-l-shape',    name: 'Cantoneira de Borda (L)',      group: 'Fitas & Tubos',  tileIds: [17, 18, 19, 20] },
  { id: 'edge-t-shape',    name: 'Junção de Borda (T)',          group: 'Fitas & Tubos',  tileIds: [21, 22, 23, 24] },

  // --- GRUPO 2: LISTRAS, GRADES & TRAMAS ---
  { id: 'stripes',         name: 'Listras Paralelas',            group: 'Listras & Tramas', tileIds: [25, 26] },
  { id: 'corner-stripes',  name: 'Curva de Listras Duplas (90°)',group: 'Listras & Tramas', tileIds: [27, 28, 29, 30] },
  { id: 'diagonal-line',   name: 'Linha Diagonal',               group: 'Listras & Tramas', tileIds: [31, 32] },
  { id: 'diagonal-hatch',  name: 'Listras Diagonais (Hachura)',  group: 'Listras & Tramas', tileIds: [33, 34] },
  { id: 'zigzag',          name: 'Zigue-Zague',                  group: 'Listras & Tramas', tileIds: [35, 36] },
  { id: 'mini-grid',       name: 'Mini Grade 2×2',               group: 'Listras & Tramas', tileIds: [37] },
  { id: 'checkers',        name: 'Xadrez (Checkers)',            group: 'Listras & Tramas', tileIds: [38, 39] },

  // --- GRUPO 3: MASSAS SÓLIDAS & FORMAS ANGULARES ---
  { id: 'half-block',      name: 'Meio Bloco Sólido',            group: 'Massas Sólidas', tileIds: [40, 41, 42, 43] },
  { id: 'corner-triangle', name: 'Triângulos de Canto',          group: 'Massas Sólidas', tileIds: [44, 45, 46, 47] },
  { id: 'side-triangle',   name: 'Triângulos Laterais',          group: 'Massas Sólidas', tileIds: [48, 49, 50, 51] },
  { id: 'chevron',         name: 'Ponta de Flecha (Chevron)',    group: 'Massas Sólidas', tileIds: [52, 53, 54, 55] },
  { id: 'bowtie',          name: 'Ampulheta & Laço',             group: 'Massas Sólidas', tileIds: [56, 57] },
  { id: 'diamond',         name: 'Losango Sólido',               group: 'Massas Sólidas', tileIds: [58] },
  { id: 'diamond-frame',   name: 'Losango Vazado',               group: 'Massas Sólidas', tileIds: [59] },

  // --- GRUPO 4: CÍRCULOS, ARCOS & ROSETAS ---
  { id: 'half-circle',     name: 'Meio Bloco & Círculo',         group: 'Círculos & Arcos', tileIds: [60, 61, 62, 63] },
  { id: 'edge-semicircle', name: 'Semicírculo de Borda',         group: 'Círculos & Arcos', tileIds: [64, 65, 66, 67] },
  { id: 'quarter-arc-mid', name: 'Arco de Quarto (Médio)',       group: 'Círculos & Arcos', tileIds: [68, 69, 70, 71] },
  { id: 'quarter-arc-full',name: 'Arco de Quarto (Total)',       group: 'Círculos & Arcos', tileIds: [72, 73, 74, 75] },
  { id: 'corner-petal',    name: 'Pétala de Canto (Roseta)',     group: 'Círculos & Arcos', tileIds: [76, 77, 78, 79] },
  { id: 'corner-waves',    name: 'Ondas de Canto',               group: 'Círculos & Arcos', tileIds: [80, 81, 82, 83] },

  // --- GRUPO 5: FOCOS CENTRAIS & PONTOS ---
  { id: 'target-circle',   name: 'Alvo Circular (Target)',       group: 'Focos & Pontos', tileIds: [84] },
  { id: 'target-square',   name: 'Alvo Quadrado',                group: 'Focos & Pontos', tileIds: [85] },
  { id: 'four-dots',       name: 'Quatro Pontos',                group: 'Focos & Pontos', tileIds: [86] },
  { id: 'diagonal-dots',   name: 'Três Pontos Diagonais',        group: 'Focos & Pontos', tileIds: [87, 88] },

  // --- GRUPO 6: ESPAÇO NEGATIVO ---
  { id: 'empty-tile',      name: 'Tile Vazio (Espaço)',          group: 'Espaço Negativo', tileIds: [89] }
];

/**
 * Build exact D4 group action tables for all 90 built-in tiles across 33 families.
 * Every tileId maps under { id, r90, r180, r270, mx, my, md, mad } to its rotated/mirrored tileId.
 */
const TILE_D4_MAP = (() => {
  const map = {};
  const { D4_TRANSFORMS, composeD4 } = window.D4Symmetry;

  function registerEdge4(L, R, T, B) {
    const baseFromL = { id: L, r90: T, r180: R, r270: B, mx: R, my: L, md: T, mad: B };
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

  function registerCorner4(TL, TR, BR, BL) {
    const baseFromTL = { id: TL, r90: TR, r180: BR, r270: BL, mx: TR, my: BL, md: TL, mad: BR };
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

  function registerAxis2(H, V) {
    map[H] = { id: H, r90: V, r180: H, r270: V, mx: H, my: H, md: V, mad: V };
    map[V] = { id: V, r90: H, r180: V, r270: H, mx: V, my: V, md: H, mad: H };
  }

  function registerDiag2(D1, D2) {
    map[D1] = { id: D1, r90: D2, r180: D1, r270: D2, mx: D2, my: D2, md: D1, mad: D1 };
    map[D2] = { id: D2, r90: D1, r180: D2, r270: D1, mx: D1, my: D1, md: D2, mad: D2 };
  }

  function registerSymmetric1(T) {
    map[T] = {};
    for (const g of D4_TRANSFORMS) {
      map[T][g] = T;
    }
  }

  // --- GRUPO 1: FITAS, CONEXÕES & TUBOS ---
  registerAxis2(0, 1);              // Family 0: Faixa Central
  registerEdge4(2, 3, 4, 5);        // Family 1: Junção Central (T)
  registerSymmetric1(6);             // Family 2: Cruz Central (+)
  registerCorner4(7, 8, 9, 10);      // Family 3: Arco de Fita (90°)
  registerDiag2(11, 12);             // Family 4: Fita Truchet Dupla
  registerCorner4(13, 14, 15, 16);  // Family 5: Cantoneira Central (L)
  registerCorner4(17, 18, 19, 20);  // Family 6: Cantoneira de Borda (L)
  registerEdge4(21, 22, 23, 24);    // Family 7: Junção de Borda (T)

  // --- GRUPO 2: LISTRAS, GRADES & TRAMAS ---
  registerAxis2(25, 26);            // Family 8: Listras Paralelas
  registerCorner4(27, 28, 29, 30);  // Family 9: Curva de Listras Duplas (90°)
  registerDiag2(31, 32);            // Family 10: Linha Diagonal
  registerDiag2(33, 34);            // Family 11: Listras Diagonais (Hachura)
  registerAxis2(35, 36);            // Family 12: Zigue-Zague
  registerSymmetric1(37);            // Family 13: Mini Grade 2×2
  registerDiag2(38, 39);            // Family 14: Xadrez (Checkers)

  // --- GRUPO 3: MASSAS SÓLIDAS & FORMAS ANGULARES ---
  registerEdge4(40, 41, 42, 43);    // Family 15: Meio Bloco Sólido
  registerCorner4(44, 45, 46, 47);  // Family 16: Triângulos de Canto
  registerEdge4(48, 49, 50, 51);    // Family 17: Triângulos Laterais
  registerEdge4(52, 53, 54, 55);    // Family 18: Ponta de Flecha (Chevron)
  registerAxis2(56, 57);            // Family 19: Ampulheta & Laço
  registerSymmetric1(58);            // Family 20: Losango Sólido
  registerSymmetric1(59);            // Family 21: Losango Vazado

  // --- GRUPO 4: CÍRCULOS, ARCOS & ROSETAS ---
  registerEdge4(60, 61, 62, 63);    // Family 22: Meio Bloco & Círculo
  registerEdge4(64, 65, 66, 67);    // Family 23: Semicírculo de Borda
  registerCorner4(68, 69, 70, 71);  // Family 24: Arco de Quarto (Médio)
  registerCorner4(72, 73, 74, 75);  // Family 25: Arco de Quarto (Total)
  registerCorner4(76, 77, 78, 79);  // Family 26: Pétala de Canto (Roseta)
  registerCorner4(80, 81, 82, 83);  // Family 27: Ondas de Canto

  // --- GRUPO 5: FOCOS CENTRAIS & PONTOS ---
  registerSymmetric1(84);            // Family 28: Alvo Circular (Target)
  registerSymmetric1(85);            // Family 29: Alvo Quadrado
  registerSymmetric1(86);            // Family 30: Quatro Pontos
  registerDiag2(87, 88);            // Family 31: Três Pontos Diagonais

  // --- GRUPO 6: ESPAÇO NEGATIVO ---
  registerSymmetric1(89);            // Family 32: Tile Vazio (Espaço)

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

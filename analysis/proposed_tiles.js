/**
 * analysis/proposed_tiles.js
 * Protótipos das 10 famílias novas (19 subtiles, IDs 85..103).
 * Este arquivo NÃO é carregado pelo app; serve para validar geometria,
 * portas e gerar as pranchas da proposta.
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

const PROPOSED_FAMILIES = [
  {
    id: 'quarter-block',
    name: 'Quarto de Bloco',
    group: 'Massas Sólidas',
    module: 'half',
    material: 'fill',
    sets: ['massa-modular'],
    rationale: 'Fecha a gramática de massa 1/2: dois quartos = meio bloco; quatro = bloco cheio.',
    tiles: [
      { id: 85, name: 'Quarto de Bloco Top Left', rot: 'TL', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(-dw / 2, -dh / 2, dw / 2, dh / 2);
      } },
      { id: 86, name: 'Quarto de Bloco Top Right', rot: 'TR', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(0, -dh / 2, dw / 2, dh / 2);
      } },
      { id: 87, name: 'Quarto de Bloco Bottom Right', rot: 'BR', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(0, 0, dw / 2, dh / 2);
      } },
      { id: 88, name: 'Quarto de Bloco Bottom Left', rot: 'BL', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(-dw / 2, 0, dw / 2, dh / 2);
      } }
    ]
  },
  {
    id: 'band-cap',
    name: 'Terminal de Fita',
    group: 'Fitas & Tubos',
    module: 'third',
    material: 'fill',
    sets: ['fita'],
    rationale: 'Permite terminar uma fita 1/3 com um remate arredondado, sem inventar um novo tipo de porta.',
    tiles: [
      { id: 89, name: 'Terminal de Fita Esquerdo', rot: 'L', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(-dw / 2, -dh / 6, dw * 2 / 3, dh / 3);
        ctx.ellipse(dw / 6, 0, dh / 3, dh / 3);
      } },
      { id: 90, name: 'Terminal de Fita Direito', rot: 'R', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(0, -dh / 6, dw * 2 / 3, dh / 3);
        ctx.ellipse(-dw / 6, 0, dh / 3, dh / 3);
      } },
      { id: 91, name: 'Terminal de Fita Superior', rot: 'T', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(-dw / 6, -dh / 2, dw / 3, dh * 2 / 3);
        ctx.ellipse(0, dh / 6, dw / 3, dw / 3);
      } },
      { id: 92, name: 'Terminal de Fita Inferior', rot: 'B', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(-dw / 6, 0, dw / 3, dh * 2 / 3);
        ctx.ellipse(0, -dh / 6, dw / 3, dw / 3);
      } }
    ]
  },
  {
    id: 'stripe-uturn',
    name: 'Grampo de Listras Duplas',
    group: 'Listras & Tramas',
    module: 'third',
    material: 'fill',
    sets: ['listras-duplas', 'massa-modular'],
    rationale: 'Fecha o circuito de listras duplas com uma volta de 180°; as bordas externas ainda conversam com meias massas.',
    tiles: [
      { id: 93, name: 'Grampo de Listras (Abertura Esquerda)', rot: 'L', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(-dw / 2, -dh / 2, dw / 2, dh / 3);
        ctx.rect(-dw / 2, dh / 6, dw / 2, dh / 3);
        drawAnnularSector(ctx, 0, 0, dw / 6, dh / 6, dw / 2, dh / 2, -Math.PI / 2, Math.PI / 2, 24);
      } },
      { id: 94, name: 'Grampo de Listras (Abertura Direita)', rot: 'R', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(0, -dh / 2, dw / 2, dh / 3);
        ctx.rect(0, dh / 6, dw / 2, dh / 3);
        drawAnnularSector(ctx, 0, 0, dw / 6, dh / 6, dw / 2, dh / 2, Math.PI / 2, 3 * Math.PI / 2, 24);
      } },
      { id: 95, name: 'Grampo de Listras (Abertura Superior)', rot: 'T', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(-dw / 2, -dh / 2, dw / 3, dh / 2);
        ctx.rect(dw / 6, -dh / 2, dw / 3, dh / 2);
        drawAnnularSector(ctx, 0, 0, dw / 6, dh / 6, dw / 2, dh / 2, 0, Math.PI, 24);
      } },
      { id: 96, name: 'Grampo de Listras (Abertura Inferior)', rot: 'B', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(-dw / 2, 0, dw / 3, dh / 2);
        ctx.rect(dw / 6, 0, dw / 3, dh / 2);
        drawAnnularSector(ctx, 0, 0, dw / 6, dh / 6, dw / 2, dh / 2, Math.PI, 2 * Math.PI, 24);
      } }
    ]
  },
  {
    id: 'frame-ring',
    name: 'Moldura Fechada',
    group: 'Massas Sólidas',
    module: 'third',
    material: 'fill',
    sets: ['moldura', 'massa-modular'],
    rationale: 'Célula de moldura completa: fecha um vão sem precisar de quatro cantos; conversa com edge-L/edge-T por quatro lados.',
    tiles: [
      { id: 97, name: 'Moldura Fechada (Anel de Borda)', rot: '—', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.rect(-dw / 2, -dh / 2, dw, dh / 3);
        ctx.rect(-dw / 2, dh / 6, dw, dh / 3);
        ctx.rect(-dw / 2, -dh / 2, dw / 3, dh);
        ctx.rect(dw / 6, -dh / 2, dw / 3, dh);
      } }
    ]
  },
  {
    id: 'diagonal-x',
    name: 'Cruz Diagonal (X)',
    group: 'Listras & Tramas',
    module: 'line',
    material: 'stroke',
    sets: ['linha-diagonal', 'foco'],
    rationale: 'Permite que duas diagonais se cruzem e continuem; sem ele, o conjunto diagonal não fecha um lattice.',
    tiles: [
      { id: 98, name: 'Cruz Diagonal (X)', rot: '—', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.noFill(); ctx.stroke('#000');
        ctx.strokeWeight(Math.min(dw, dh) * 0.10);
        ctx.line(-dw / 2, -dh / 2, dw / 2, dh / 2);
        ctx.line(dw / 2, -dh / 2, -dw / 2, dh / 2);
      } }
    ]
  },
  {
    id: 'diagonal-crosshatch',
    name: 'Hachura Cruzada',
    group: 'Listras & Tramas',
    module: 'line',
    material: 'stroke',
    sets: ['linha-diagonal'],
    rationale: 'Transforma a hachura de uma direção em trama de losangos; dá textura sem mudar a espessura do traço.',
    tiles: [
      { id: 99, name: 'Hachura Cruzada', rot: '—', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        const sw = Math.min(dw, dh) * 0.10;
        ctx.noFill(); ctx.stroke('#000'); ctx.strokeWeight(sw);
        ctx.line(-dw / 2, -dh / 2, dw / 2, dh / 2);
        ctx.line(0, -dh / 2, dw / 2, 0);
        ctx.line(-dw / 2, 0, 0, dh / 2);
        ctx.line(dw / 2, -dh / 2, -dw / 2, dh / 2);
        ctx.line(0, -dh / 2, -dw / 2, 0);
        ctx.line(dw / 2, 0, 0, dh / 2);
      } }
    ]
  },
  {
    id: 'center-dot',
    name: 'Ponto Central',
    group: 'Focos & Pontos',
    module: 'free',
    material: 'fill',
    sets: ['foco', 'pontos'],
    rationale: 'O foco mais básico do sistema não existia: um único ponto central. Ancora alvos, anéis e rosetas.',
    tiles: [
      { id: 100, name: 'Ponto Central', rot: '—', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.ellipse(0, 0, dw / 3, dh / 3);
      } }
    ]
  },
  {
    id: 'edge-dots',
    name: 'Pontos de Borda',
    group: 'Focos & Pontos',
    module: 'free',
    material: 'fill',
    sets: ['foco', 'pontos'],
    rationale: 'Quatro pontos tangentes às bordas: criam uma malha de pontos entre células, o elo que faltava ao conjunto de foco.',
    tiles: [
      { id: 101, name: 'Pontos de Borda (Quatro)', rot: '—', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        const d = Math.min(dw, dh) / 6;
        const r = d / 2;
        ctx.fill('#000'); ctx.noStroke();
        ctx.ellipse(0, -dh / 2 + r, d, d);
        ctx.ellipse(0, dh / 2 - r, d, d);
        ctx.ellipse(-dw / 2 + r, 0, d, d);
        ctx.ellipse(dw / 2 - r, 0, d, d);
      } }
    ]
  },
  {
    id: 'diamond-outline',
    name: 'Losango Vazado',
    group: 'Focos & Pontos',
    module: 'line',
    material: 'stroke',
    sets: ['foco', 'linha-diagonal'],
    rationale: 'Contraponto de traço ao Losango Sólido; os vértices nos pontos médios das bordas fecham uma malha de losangos.',
    tiles: [
      { id: 102, name: 'Losango Vazado (Diamond Outline)', rot: '—', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.noFill(); ctx.stroke('#000');
        ctx.strokeWeight(Math.min(dw, dh) * 0.10);
        ctx.beginShape();
        ctx.vertex(0, -dh / 2);
        ctx.vertex(dw / 2, 0);
        ctx.vertex(0, dh / 2);
        ctx.vertex(-dw / 2, 0);
        ctx.endShape('CLOSE');
      } }
    ]
  },
  {
    id: 'ring',
    name: 'Anel',
    group: 'Focos & Pontos',
    module: 'line',
    material: 'stroke',
    sets: ['foco', 'arcos'],
    rationale: 'Fecha o vocabulário de arcos com um círculo completo de traço; é o elo entre alvos, arcos de quarto e pétalas.',
    tiles: [
      { id: 103, name: 'Anel (Círculo Vazado)', rot: '—', draw(ctx, w, h, p) {
        const dw = w - p * 2, dh = h - p * 2;
        ctx.noFill(); ctx.stroke('#000');
        ctx.strokeWeight(Math.min(dw, dh) * 0.10);
        ctx.ellipse(0, 0, dw * 2 / 3, dh * 2 / 3);
      } }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) module.exports = { PROPOSED_FAMILIES };

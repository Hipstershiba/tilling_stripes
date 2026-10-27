/**
 * core/tile_library.js
 * Canonical vector JSON library for Tiling Stripes Studio (Schema v1).
 * Contains the 6 built-in visual groups and 31 D4-closed master families (85 subtiles, IDs 0..84).
 * All coordinates are normalized to the unit square [-0.5, 0.5]^2 centered at (0, 0).
 */

(function () {
  const PI = Math.PI;
  const HALF_PI = Math.PI / 2;
  const THIRD = 1 / 3;
  const TWO_THIRDS = 2 / 3;
  const SIXTH = 1 / 6;
  const K_PETAL = 0.5 * (4 / 3) * (Math.SQRT2 - 1); // 0.5 * kappa for radius 0.5 quarter-circle Bezier

  const DEFAULT_GROUPS = [
    { id: 'grp-ribbons', name: 'Fitas & Tubos', builtIn: true },
    { id: 'grp-stripes', name: 'Listras & Tramas', builtIn: true },
    { id: 'grp-masses', name: 'Massas Sólidas', builtIn: true },
    { id: 'grp-circles', name: 'Círculos & Arcos', builtIn: true },
    { id: 'grp-foci', name: 'Focos & Pontos', builtIn: true },
    { id: 'grp-void', name: 'Espaço Negativo', builtIn: true }
  ];

  const DEFAULT_FAMILIES = [
    // --- GRUPO 1: FITAS & TUBOS ---
    {
      id: 'center-stripe',
      name: 'Faixa Central',
      groupId: 'grp-ribbons',
      group: 'Fitas & Tubos',
      builtIn: true,
      variantNames: ['Faixa Central Horizontal', 'Faixa Central Vertical'],
      shapes: [
        { id: 's1', type: 'rect', name: 'Faixa 1/3', x: -0.5, y: -SIXTH, w: 1, h: THIRD, fill: true, stroke: false }
      ]
    },
    {
      id: 'center-tee',
      name: 'Junção Central (T)',
      groupId: 'grp-ribbons',
      group: 'Fitas & Tubos',
      builtIn: true,
      variantNames: [
        'Junção Central (T) Esquerda',
        'Junção Central (T) Direita',
        'Junção Central (T) Cima',
        'Junção Central (T) Baixo'
      ],
      shapes: [
        { id: 's1', type: 'rect', name: 'Haste Vertical', x: -SIXTH, y: -0.5, w: THIRD, h: 1, fill: true, stroke: false },
        { id: 's2', type: 'rect', name: 'Braço Esquerdo', x: -0.5, y: -SIXTH, w: 0.5, h: THIRD, fill: true, stroke: false }
      ]
    },
    {
      id: 'center-cross',
      name: 'Cruz Central (+)',
      groupId: 'grp-ribbons',
      group: 'Fitas & Tubos',
      builtIn: true,
      variantNames: ['Cruz Central (+)'],
      shapes: [
        { id: 's1', type: 'rect', name: 'Eixo Vertical', x: -SIXTH, y: -0.5, w: THIRD, h: 1, fill: true, stroke: false },
        { id: 's2', type: 'rect', name: 'Eixo Horizontal', x: -0.5, y: -SIXTH, w: 1, h: THIRD, fill: true, stroke: false }
      ]
    },
    {
      id: 'elbow-ribbon',
      name: 'Arco de Fita (90°)',
      groupId: 'grp-ribbons',
      group: 'Fitas & Tubos',
      builtIn: true,
      variantNames: [
        'Arco de Fita Top Left',
        'Arco de Fita Top Right',
        'Arco de Fita Bottom Right',
        'Arco de Fita Bottom Left'
      ],
      shapes: [
        {
          id: 's1', type: 'arc', name: 'Arco Anelar 90°',
          cx: -0.5, cy: -0.5, rx: TWO_THIRDS, ry: TWO_THIRDS, innerRatio: 0.5,
          start: 0, end: HALF_PI, mode: 'pie', fill: true, stroke: false
        }
      ]
    },
    {
      id: 'truchet-ribbon',
      name: 'Fita Truchet Dupla',
      groupId: 'grp-ribbons',
      group: 'Fitas & Tubos',
      builtIn: true,
      variantNames: ['Fita Truchet (TL-BR)', 'Fita Truchet (TR-BL)'],
      shapes: [
        {
          id: 's1', type: 'arc', name: 'Arco Superior Esq.',
          cx: -0.5, cy: -0.5, rx: TWO_THIRDS, ry: TWO_THIRDS, innerRatio: 0.5,
          start: 0, end: HALF_PI, mode: 'pie', fill: true, stroke: false
        },
        {
          id: 's2', type: 'arc', name: 'Arco Inferior Dir.',
          cx: 0.5, cy: 0.5, rx: TWO_THIRDS, ry: TWO_THIRDS, innerRatio: 0.5,
          start: PI, end: 3 * HALF_PI, mode: 'pie', fill: true, stroke: false
        }
      ]
    },
    {
      id: 'center-elbow',
      name: 'Cantoneira Central (L)',
      groupId: 'grp-ribbons',
      group: 'Fitas & Tubos',
      builtIn: true,
      variantNames: [
        'Cantoneira Central (L) Top Left',
        'Cantoneira Central (L) Top Right',
        'Cantoneira Central (L) Bottom Right',
        'Cantoneira Central (L) Bottom Left'
      ],
      shapes: [
        { id: 's1', type: 'rect', name: 'Braço Horizontal', x: -0.5, y: -SIXTH, w: TWO_THIRDS, h: THIRD, fill: true, stroke: false },
        { id: 's2', type: 'rect', name: 'Braço Vertical', x: -SIXTH, y: -0.5, w: THIRD, h: TWO_THIRDS, fill: true, stroke: false }
      ]
    },
    {
      id: 'edge-l-shape',
      name: 'Cantoneira de Borda (L)',
      groupId: 'grp-ribbons',
      group: 'Fitas & Tubos',
      builtIn: true,
      variantNames: [
        'Cantoneira de Borda (L) Top Left',
        'Cantoneira de Borda (L) Top Right',
        'Cantoneira de Borda (L) Bottom Right',
        'Cantoneira de Borda (L) Bottom Left'
      ],
      shapes: [
        { id: 's1', type: 'rect', name: 'Borda Esquerda', x: -0.5, y: -0.5, w: THIRD, h: 1, fill: true, stroke: false },
        { id: 's2', type: 'rect', name: 'Borda Superior', x: -0.5, y: -0.5, w: 1, h: THIRD, fill: true, stroke: false }
      ]
    },
    {
      id: 'edge-t-shape',
      name: 'Junção de Borda (T)',
      groupId: 'grp-ribbons',
      group: 'Fitas & Tubos',
      builtIn: true,
      variantNames: [
        'Junção de Borda (T) Esquerda',
        'Junção de Borda (T) Direita',
        'Junção de Borda (T) Cima',
        'Junção de Borda (T) Baixo'
      ],
      shapes: [
        { id: 's1', type: 'rect', name: 'Borda Esquerda', x: -0.5, y: -0.5, w: THIRD, h: 1, fill: true, stroke: false },
        { id: 's2', type: 'rect', name: 'Faixa Central', x: -0.5, y: -SIXTH, w: 1, h: THIRD, fill: true, stroke: false }
      ]
    },

    // --- GRUPO 2: LISTRAS & TRAMAS ---
    {
      id: 'stripes',
      name: 'Listras Paralelas',
      groupId: 'grp-stripes',
      group: 'Listras & Tramas',
      builtIn: true,
      variantNames: ['Listras Paralelas Horizontal', 'Listras Paralelas Vertical'],
      shapes: [
        { id: 's1', type: 'rect', name: 'Listra Superior', x: -0.5, y: -0.5, w: 1, h: THIRD, fill: true, stroke: false },
        { id: 's2', type: 'rect', name: 'Listra Inferior', x: -0.5, y: SIXTH, w: 1, h: THIRD, fill: true, stroke: false }
      ]
    },
    {
      id: 'corner-stripes',
      name: 'Curva de Listras Duplas (90°)',
      groupId: 'grp-stripes',
      group: 'Listras & Tramas',
      builtIn: true,
      variantNames: [
        'Curva de Listras Duplas Top Left',
        'Curva de Listras Duplas Top Right',
        'Curva de Listras Duplas Bottom Right',
        'Curva de Listras Duplas Bottom Left'
      ],
      shapes: [
        {
          id: 's1', type: 'arc', name: 'Quarto Interno',
          cx: -0.5, cy: -0.5, rx: THIRD, ry: THIRD, innerRatio: 0,
          start: 0, end: HALF_PI, mode: 'pie', fill: true, stroke: false
        },
        {
          id: 's2', type: 'arc', name: 'Faixa Externa',
          cx: -0.5, cy: -0.5, rx: 1, ry: 1, innerRatio: TWO_THIRDS,
          start: 0, end: HALF_PI, mode: 'pie', fill: true, stroke: false
        }
      ]
    },
    {
      id: 'diagonal-line',
      name: 'Linha Diagonal',
      groupId: 'grp-stripes',
      group: 'Listras & Tramas',
      builtIn: true,
      variantNames: ['Linha Diagonal (TL-BR)', 'Linha Diagonal (TR-BL)'],
      shapes: [
        {
          id: 's1', type: 'line', name: 'Diagonal Principal',
          x1: -0.5, y1: -0.5, x2: 0.5, y2: 0.5,
          fill: false, stroke: true, strokeWeight: 0.12
        }
      ]
    },
    {
      id: 'diagonal-hatch',
      name: 'Listras Diagonais (Hachura)',
      groupId: 'grp-stripes',
      group: 'Listras & Tramas',
      builtIn: true,
      variantNames: ['Listras Diagonais (TL-BR)', 'Listras Diagonais (TR-BL)'],
      shapes: [
        { id: 's1', type: 'line', name: 'Diagonal Central', x1: -0.5, y1: -0.5, x2: 0.5, y2: 0.5, fill: false, stroke: true, strokeWeight: 0.12 },
        { id: 's2', type: 'line', name: 'Diagonal Superior', x1: 0, y1: -0.5, x2: 0.5, y2: 0, fill: false, stroke: true, strokeWeight: 0.12 },
        { id: 's3', type: 'line', name: 'Diagonal Inferior', x1: -0.5, y1: 0, x2: 0, y2: 0.5, fill: false, stroke: true, strokeWeight: 0.12 }
      ]
    },
    {
      id: 'zigzag',
      name: 'Zigue-Zague',
      groupId: 'grp-stripes',
      group: 'Listras & Tramas',
      builtIn: true,
      variantNames: ['Zigue-Zague Horizontal', 'Zigue-Zague Vertical'],
      // Preserves exact 2-slot built-in compatibility (#35 Horizontal, #36 Vertical = md(#35))
      legacyOrbitOverride: {
        orbitType: 'axis_2',
        stabilizer: ['id', 'r180', 'mx', 'my'],
        reps: ['id', 'md'],
        actionReps: ['id', 'r90']
      },
      shapes: [
        {
          id: 's1', type: 'path', name: 'Polilinha Zigue-Zague',
          closed: false, fill: false, stroke: true, strokeWeight: 0.12,
          nodes: [
            { x: -0.5, y: 0 },
            { x: -0.25, y: -THIRD },
            { x: 0, y: 0 },
            { x: 0.25, y: THIRD },
            { x: 0.5, y: 0 }
          ]
        }
      ]
    },
    {
      id: 'mini-grid',
      name: 'Mini Grade 2×2',
      groupId: 'grp-stripes',
      group: 'Listras & Tramas',
      builtIn: true,
      variantNames: ['Mini Grade 2×2'],
      shapes: [
        { id: 's1', type: 'rect', name: 'Bloco TL', x: -0.5, y: -0.5, w: 0.45, h: 0.45, fill: true, stroke: false },
        { id: 's2', type: 'rect', name: 'Bloco TR', x: 0.05, y: -0.5, w: 0.45, h: 0.45, fill: true, stroke: false },
        { id: 's3', type: 'rect', name: 'Bloco BL', x: -0.5, y: 0.05, w: 0.45, h: 0.45, fill: true, stroke: false },
        { id: 's4', type: 'rect', name: 'Bloco BR', x: 0.05, y: 0.05, w: 0.45, h: 0.45, fill: true, stroke: false }
      ]
    },
    {
      id: 'checkers',
      name: 'Xadrez (Checkers)',
      groupId: 'grp-stripes',
      group: 'Listras & Tramas',
      builtIn: true,
      variantNames: ['Xadrez (TL-BR)', 'Xadrez Inverso (TR-BL)'],
      shapes: [
        { id: 's1', type: 'rect', name: 'Quadrante TL', x: -0.5, y: -0.5, w: 0.5, h: 0.5, fill: true, stroke: false },
        { id: 's2', type: 'rect', name: 'Quadrante BR', x: 0, y: 0, w: 0.5, h: 0.5, fill: true, stroke: false }
      ]
    },

    // --- GRUPO 3: MASSAS SÓLIDAS ---
    {
      id: 'half-block',
      name: 'Meio Bloco Sólido',
      groupId: 'grp-masses',
      group: 'Massas Sólidas',
      builtIn: true,
      variantNames: [
        'Meio Bloco Esquerdo',
        'Meio Bloco Direito',
        'Meio Bloco Superior',
        'Meio Bloco Inferior'
      ],
      shapes: [
        { id: 's1', type: 'rect', name: 'Meio Bloco', x: -0.5, y: -0.5, w: 0.5, h: 1, fill: true, stroke: false }
      ]
    },
    {
      id: 'corner-triangle',
      name: 'Triângulos de Canto',
      groupId: 'grp-masses',
      group: 'Massas Sólidas',
      builtIn: true,
      variantNames: [
        'Triângulo de Canto Top Left',
        'Triângulo de Canto Top Right',
        'Triângulo de Canto Bottom Right',
        'Triângulo de Canto Bottom Left'
      ],
      shapes: [
        { id: 's1', type: 'polygon', name: 'Triângulo Retângulo', points: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]], fill: true, stroke: false }
      ]
    },
    {
      id: 'side-triangle',
      name: 'Triângulos Laterais',
      groupId: 'grp-masses',
      group: 'Massas Sólidas',
      builtIn: true,
      variantNames: [
        'Triângulo Lateral Esquerdo',
        'Triângulo Lateral Direito',
        'Triângulo Lateral Superior',
        'Triângulo Lateral Inferior'
      ],
      shapes: [
        { id: 's1', type: 'polygon', name: 'Triângulo Isósceles', points: [[-0.5, 0], [0.5, -0.5], [0.5, 0.5]], fill: true, stroke: false }
      ]
    },
    {
      id: 'bowtie',
      name: 'Ampulheta & Laço',
      groupId: 'grp-masses',
      group: 'Massas Sólidas',
      builtIn: true,
      variantNames: ['Ampulheta (Horizontal / Laço)', 'Ampulheta (Vertical)'],
      shapes: [
        { id: 's1', type: 'polygon', name: 'Asa Esquerda', points: [[-0.5, -0.5], [-0.5, 0.5], [0, 0]], fill: true, stroke: false },
        { id: 's2', type: 'polygon', name: 'Asa Direita', points: [[0.5, -0.5], [0.5, 0.5], [0, 0]], fill: true, stroke: false }
      ]
    },
    {
      id: 'diamond',
      name: 'Losango Sólido',
      groupId: 'grp-masses',
      group: 'Massas Sólidas',
      builtIn: true,
      variantNames: ['Losango Sólido'],
      shapes: [
        { id: 's1', type: 'polygon', name: 'Losango', cx: 0, cy: 0, rx: 0.5, ry: 0.5, sides: 4, rotation: 0, fill: true, stroke: false }
      ]
    },

    // --- GRUPO 4: CÍRCULOS & ARCOS ---
    {
      id: 'half-circle',
      name: 'Meio Bloco & Círculo',
      groupId: 'grp-circles',
      group: 'Círculos & Arcos',
      builtIn: true,
      variantNames: [
        'Meio Bloco & Círculo (Esquerdo)',
        'Meio Bloco & Círculo (Direito)',
        'Meio Bloco & Círculo (Superior)',
        'Meio Bloco & Círculo (Inferior)'
      ],
      shapes: [
        { id: 's1', type: 'rect', name: 'Meio Bloco', x: -0.5, y: -0.5, w: 0.5, h: 1, fill: true, stroke: false },
        { id: 's2', type: 'ellipse', name: 'Círculo Lateral', cx: 0.25, cy: 0, rx: 0.25, ry: 0.25, fill: true, stroke: false }
      ]
    },
    {
      id: 'edge-semicircle',
      name: 'Semicírculo de Borda',
      groupId: 'grp-circles',
      group: 'Círculos & Arcos',
      builtIn: true,
      variantNames: [
        'Semicírculo de Borda (Esquerdo)',
        'Semicírculo de Borda (Direito)',
        'Semicírculo de Borda (Superior)',
        'Semicírculo de Borda (Inferior)'
      ],
      shapes: [
        {
          id: 's1', type: 'arc', name: 'Semicírculo',
          cx: -0.5, cy: 0, rx: 0.5, ry: 0.5, innerRatio: 0,
          start: -HALF_PI, end: HALF_PI, mode: 'pie', fill: true, stroke: false
        }
      ]
    },
    {
      id: 'quarter-arc-mid',
      name: 'Arco de Quarto (Médio)',
      groupId: 'grp-circles',
      group: 'Círculos & Arcos',
      builtIn: true,
      variantNames: [
        'Arco de Quarto Médio Top Left',
        'Arco de Quarto Médio Top Right',
        'Arco de Quarto Médio Bottom Right',
        'Arco de Quarto Médio Bottom Left'
      ],
      shapes: [
        {
          id: 's1', type: 'arc', name: 'Setor 1/2',
          cx: -0.5, cy: -0.5, rx: 0.5, ry: 0.5, innerRatio: 0,
          start: 0, end: HALF_PI, mode: 'pie', fill: true, stroke: false
        }
      ]
    },
    {
      id: 'quarter-arc-full',
      name: 'Arco de Quarto (Total)',
      groupId: 'grp-circles',
      group: 'Círculos & Arcos',
      builtIn: true,
      variantNames: [
        'Arco de Quarto Total Top Left',
        'Arco de Quarto Total Top Right',
        'Arco de Quarto Total Bottom Right',
        'Arco de Quarto Total Bottom Left'
      ],
      shapes: [
        {
          id: 's1', type: 'arc', name: 'Setor Cheio',
          cx: -0.5, cy: -0.5, rx: 1, ry: 1, innerRatio: 0,
          start: 0, end: HALF_PI, mode: 'pie', fill: true, stroke: false
        }
      ]
    },
    {
      id: 'corner-petal',
      name: 'Pétala de Canto (Roseta)',
      groupId: 'grp-circles',
      group: 'Círculos & Arcos',
      builtIn: true,
      variantNames: [
        'Pétala de Canto Top Left',
        'Pétala de Canto Top Right',
        'Pétala de Canto Bottom Right',
        'Pétala de Canto Bottom Left'
      ],
      shapes: [
        {
          id: 's1', type: 'path', name: 'Pétala Gótica',
          closed: true, fill: true, stroke: false,
          nodes: [
            { x: 0, y: 0, in: [-K_PETAL, 0], out: [0, -K_PETAL] },
            { x: -0.5, y: -0.5, in: [K_PETAL, 0], out: [0, K_PETAL] }
          ]
        }
      ]
    },
    {
      id: 'corner-waves',
      name: 'Ondas de Canto',
      groupId: 'grp-circles',
      group: 'Círculos & Arcos',
      builtIn: true,
      variantNames: [
        'Ondas de Canto Top Left',
        'Ondas de Canto Top Right',
        'Ondas de Canto Bottom Right',
        'Ondas de Canto Bottom Left'
      ],
      shapes: [
        { id: 's1', type: 'arc', name: 'Onda Interna', cx: -0.5, cy: -0.5, rx: THIRD, ry: THIRD, start: 0, end: HALF_PI, mode: 'open', fill: false, stroke: true, strokeWeight: 0.1 },
        { id: 's2', type: 'arc', name: 'Onda Média', cx: -0.5, cy: -0.5, rx: TWO_THIRDS, ry: TWO_THIRDS, start: 0, end: HALF_PI, mode: 'open', fill: false, stroke: true, strokeWeight: 0.1 },
        { id: 's3', type: 'arc', name: 'Onda Externa', cx: -0.5, cy: -0.5, rx: 1, ry: 1, start: 0, end: HALF_PI, mode: 'open', fill: false, stroke: true, strokeWeight: 0.1 }
      ]
    },

    // --- GRUPO 5: FOCOS & PONTOS ---
    {
      id: 'target-circle',
      name: 'Alvo Circular (Target)',
      groupId: 'grp-foci',
      group: 'Focos & Pontos',
      builtIn: true,
      variantNames: ['Alvo Circular (Target)'],
      shapes: [
        { id: 's1', type: 'ellipse', name: 'Anel Externo', cx: 0, cy: 0, rx: 0.5, ry: 0.5, fill: false, stroke: true, strokeWeight: 0.06 },
        { id: 's2', type: 'ellipse', name: 'Anel Médio', cx: 0, cy: 0, rx: 0.3, ry: 0.3, fill: false, stroke: true, strokeWeight: 0.06 },
        { id: 's3', type: 'ellipse', name: 'Anel Central', cx: 0, cy: 0, rx: 0.1, ry: 0.1, fill: false, stroke: true, strokeWeight: 0.06 }
      ]
    },
    {
      id: 'target-square',
      name: 'Alvo Quadrado',
      groupId: 'grp-foci',
      group: 'Focos & Pontos',
      builtIn: true,
      variantNames: ['Alvo Quadrado'],
      shapes: [
        { id: 's1', type: 'rect', name: 'Quadro Externo', x: -0.5, y: -0.5, w: 1.0, h: 1.0, fill: false, stroke: true, strokeWeight: 0.06 },
        { id: 's2', type: 'rect', name: 'Quadro Médio', x: -0.3, y: -0.3, w: 0.6, h: 0.6, fill: false, stroke: true, strokeWeight: 0.06 },
        { id: 's3', type: 'rect', name: 'Quadro Central', x: -0.1, y: -0.1, w: 0.2, h: 0.2, fill: false, stroke: true, strokeWeight: 0.06 }
      ]
    },
    {
      id: 'four-dots',
      name: 'Quatro Pontos',
      groupId: 'grp-foci',
      group: 'Focos & Pontos',
      builtIn: true,
      variantNames: ['Quatro Pontos'],
      shapes: [
        { id: 's1', type: 'ellipse', name: 'Ponto TL', cx: -0.25, cy: -0.25, rx: 0.09, ry: 0.09, fill: true, stroke: false },
        { id: 's2', type: 'ellipse', name: 'Ponto TR', cx: 0.25, cy: -0.25, rx: 0.09, ry: 0.09, fill: true, stroke: false },
        { id: 's3', type: 'ellipse', name: 'Ponto BL', cx: -0.25, cy: 0.25, rx: 0.09, ry: 0.09, fill: true, stroke: false },
        { id: 's4', type: 'ellipse', name: 'Ponto BR', cx: 0.25, cy: 0.25, rx: 0.09, ry: 0.09, fill: true, stroke: false }
      ]
    },
    {
      id: 'diagonal-dots',
      name: 'Três Pontos Diagonais',
      groupId: 'grp-foci',
      group: 'Focos & Pontos',
      builtIn: true,
      variantNames: ['Três Pontos (TL-BR)', 'Três Pontos (TR-BL)'],
      shapes: [
        { id: 's1', type: 'ellipse', name: 'Ponto Central', cx: 0, cy: 0, rx: 0.09, ry: 0.09, fill: true, stroke: false },
        { id: 's2', type: 'ellipse', name: 'Ponto Superior', cx: -THIRD, cy: -THIRD, rx: 0.09, ry: 0.09, fill: true, stroke: false },
        { id: 's3', type: 'ellipse', name: 'Ponto Inferior', cx: THIRD, cy: THIRD, rx: 0.09, ry: 0.09, fill: true, stroke: false }
      ]
    },

    // --- GRUPO 6: ESPAÇO NEGATIVO ---
    {
      id: 'empty-tile',
      name: 'Tile Vazio (Espaço)',
      groupId: 'grp-void',
      group: 'Espaço Negativo',
      builtIn: true,
      protected: true,
      isCanonicalEmpty: true,
      variantNames: ['Tile Vazio (Espaço)'],
      shapes: []
    }
  ];

  const DEFAULT_TILE_LIBRARY = {
    version: 1,
    groups: DEFAULT_GROUPS,
    families: DEFAULT_FAMILIES
  };

  function cloneDefaultLibrary() {
    return JSON.parse(JSON.stringify(DEFAULT_TILE_LIBRARY));
  }

  function getBuiltInFamilyById(familyId) {
    const found = DEFAULT_FAMILIES.find((f) => f.id === familyId);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  const TileLibrary = {
    LIBRARY_SCHEMA_VERSION: 1,
    CANONICAL_EMPTY_FAMILY_ID: 'empty-tile',
    CANONICAL_EMPTY_TILE_ID: 84,
    BUILTIN_TILE_COUNT: 85,
    BUILTIN_FAMILY_COUNT: 31,
    DEFAULT_GROUPS,
    DEFAULT_FAMILIES,
    DEFAULT_TILE_LIBRARY,
    cloneDefaultLibrary,
    getBuiltInFamilyById
  };

  if (typeof window !== 'undefined') {
    window.TileLibrary = TileLibrary;
  }
  if (typeof global !== 'undefined' && global.window) {
    global.window.TileLibrary = TileLibrary;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TileLibrary;
  }
})();

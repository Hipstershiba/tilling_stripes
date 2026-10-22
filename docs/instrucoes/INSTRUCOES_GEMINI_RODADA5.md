# Instruções — Rodada 5: Gramática de conjuntos e 10 famílias novas

**Destinatário:** Gemini 3.8 Flash
**Repositório:** raiz deste projeto (caminhos relativos)
**Estado de referência:** commit `565be96` + as mudanças não commitadas da Rodada 4. Antes de começar, rode `node tests/run_all.js` e registre o resultado; a linha de base tem de passar.
**Documentos de leitura obrigatória:**
- [`docs/relatorios/ANALISE_SUBTILES_FAMILIAS_CONJUNTOS.md`](../relatorios/ANALISE_SUBTILES_FAMILIAS_CONJUNTOS.md) — a análise que justifica cada decisão.
- [`docs/MANUAL_MANUTENCAO.md`](../MANUAL_MANUTENCAO.md) — arquitetura, D4, persistência.
- [`analysis/sets_meta.json`](../../analysis/sets_meta.json) — dados dos 9 conjuntos (papéis, padding, descrições).
- [`analysis/geometry.json`](../../analysis/geometry.json) — geometria dos 85 tiles + 19 propostas (referência de conferência).
- [`analysis/proposed_tiles.js`](../../analysis/proposed_tiles.js) — protótipos dos 19 renderers.
- [`docs/analise/`](../analise/) — atlas, prancha de propostas, mapa de conjuntos, emendas.

**Objetivo:** transformar a análise em produto — 19 subtiles novos (IDs 85–103) que completam conjuntos nomeados, 9 conjuntos como **lentes de curadoria** (não regras), e três ajustes cirúrgicos de harmonia. Nenhum ID existente muda; nenhuma lógica do motor de mosaico muda.

---

## 0. O que esta rodada é e o que ela não é

**É:**
- expansão **aditiva** do catálogo (85 → 104 tiles; 31 → 41 famílias);
- metadados de curadoria (`TILE_SETS_META`, `TILE_FAMILY_STYLES`) em módulo separado;
- UI de “Conjuntos” que liga/desliga a união de tiles de um conjunto no `allowedTiles`;
- testes que provam D4, portas, conjuntos e compatibilidade com saves antigos;
- ajustes de harmonia A1, A2 (condicional), A7.

**Não é:**
- renumeração, reordenação ou remoção de tiles 0–84;
- mudança no motor de geração, na álgebra D4, no formato do payload ou na chave de storage;
- conjunto como constraint do gerador; nada de “só posso sortear tiles do conjunto X”;
- nova dependência, novo bundler, novo framework de UI;
- mudança de paleta, tema, layout das quatro superfícies ou atalhos.

---

## 1. Estado atual medido (não confie na memória)

| Medida | Valor | Onde conferir |
|---|---:|---|
| Renderers | 85 (IDs 0–84) | `core/tile_registry.js` — `TILE_RENDERERS` |
| Nomes | 85 | `TILE_NAMES` |
| Famílias | 31 | `TILE_FAMILIES_META` |
| Tiles D4 | 85 × 8 | `TILE_D4_MAP` |
| Testes | 20 suítes | `tests/run_all.js` |
| Storage | `tiling_stripes_studio_state_v2`, versão 3 | `core/state_persistence.js` |
| Padding padrão | 5% | `sketch.js` — `StudioState.paddingRatio` |

Famílias e IDs atuais: ver tabela §2.2 da análise. Os IDs são persistidos diretamente em `allowedTiles`, `cells`, históricos e snapshots; **não renumerar**.

Pontos de inserção:

| Arquivo | O que adicionar | Onde |
|---|---|---|
| `core/tile_registry.js` | 19 renderers | antes do `];` de `TILE_RENDERERS` (depois do Tile Vazio, ~linha 810) |
| `core/tile_registry.js` | 19 nomes | antes do `];` de `TILE_NAMES` (~linha 910) |
| `core/tile_registry.js` | 10 famílias | antes do `];` de `TILE_FAMILIES_META` (~linha 955) |
| `core/tile_registry.js` | 10 registros D4 | antes de `return map;` (~linha 1059) |
| `core/tile_registry.js` | exportar `TILE_SETS_META`? | **não** — vai em `core/tile_sets.js` |
| `core/tile_sets.js` | **novo** | carregado depois de `tile_registry.js` |
| `index.html` | script + seção de conjuntos | ordem de carga + painel de swatches |
| `sketch.js` | `renderSetsPanel()` e chamada | junto de `renderSwatchesPanel()` |
| `style.css` | estilos `.sets-*` / `.set-chip` | junto dos estilos de swatches |

---

## 2. Contrato conceitual

### 2.1 Família

Família = órbita D4 do tile radical. O app já implementa isso em `TILE_D4_MAP`; a Rodada 5 **não altera** a definição. Cada família nova é fechada sob D4 e registrada com `registerCorner4`, `registerEdge4` ou `registerSymmetric1`.

### 2.2 Conjunto

Conjunto = agrupamento **consultivo** de famílias que se encaixam. Regras:

1. um conjunto tem `families: { familyId: papel }`, com papel `core | bridge | terminal | accent | texture | tangent`;
2. uma família pode estar em **vários** conjuntos, com papéis diferentes;
3. conjuntos podem se sobrepor e não precisam cobrir todas as famílias;
4. o gerador **não lê** `TILE_SETS_META`; a UI usa os conjuntos apenas para ligar/desligar tiles em `StudioState.allowedTiles`;
5. não há “modo conjunto” que altere a simetria, o sorteio ou a validação D4.

### 2.3 Papéis

| Papel | Uso na UI | Regra de teste |
|---|---|---|
| `core` | cor de destaque | conjunto precisa de ≥1 core |
| `bridge` | badge “ponte” | família-bridge deve aparecer em ≥2 conjuntos |
| `terminal` | badge “terminal” | conjunto pode ter 0 ou 1 terminal |
| `accent` | badge “acento” | sem restrição |
| `texture` | badge “textura” | sem restrição |
| `tangent` | badge “tangente (!)” | não pode ser `core` de conjunto de continuidade |

---

## 3. T1 — `core/tile_sets.js` (novo módulo)

### 3.1 Ordem de carga

Em `index.html`, depois de `core/tile_registry.js` e antes de `core/mosaic_engine.js`:

```html
<script src="core/tile_registry.js"></script>
<script src="core/tile_sets.js"></script>
<script src="core/mosaic_engine.js"></script>
```

O módulo depende de `window.TileRegistry.TILE_FAMILIES_META` para `getSetTileIds`. Não depende de p5.

> **Ordem de implementação:** T1 e T2 devem ser commitados juntos (ou T2 antes de rodar os testes). O `TILE_SETS_META` referencia famílias novas (`band-cap`, `frame-ring`, etc.); enquanto elas não existirem no registro, `getSetTileIds` as ignora e `test_tile_sets.js` falha — não por bug, por ordem.

### 3.2 Estrutura

```js
/**
 * core/tile_sets.js
 * Curadoria de conjuntos e estilos de família. Dados consultivos:
 * NÃO são lidos pelo motor de mosaico nem alteram a geração.
 */
(function () {
  const TILE_FAMILY_STYLES = {
    'center-stripe': { code: 'F01', module: 'third', material: 'fill' },
    // ... 41 entradas (31 existentes + 10 novas)
  };

  const TILE_SETS_META = [
    // ... 9 objetos; copie os dados de analysis/sets_meta.json
  ];

  function getFamilyStyle(familyId) {
    return TILE_FAMILY_STYLES[familyId] || null;
  }

  function getSetsForFamily(familyId) {
    return TILE_SETS_META
      .filter((set) => Object.prototype.hasOwnProperty.call(set.families, familyId))
      .map((set) => ({ id: set.id, name: set.name, role: set.families[familyId] }));
  }

  function getSetTileIds(setId) {
    const set = TILE_SETS_META.find((s) => s.id === setId);
    if (!set) return [];
    const registry = window.TileRegistry;
    const ids = [];
    for (const familyId of Object.keys(set.families)) {
      const fam = registry.TILE_FAMILIES_META.find((f) => f.id === familyId);
      if (!fam) continue;
      for (const id of fam.tileIds) if (!ids.includes(id)) ids.push(id);
    }
    return ids.sort((a, b) => a - b);
  }

  const TileSets = { TILE_FAMILY_STYLES, TILE_SETS_META, getFamilyStyle, getSetsForFamily, getSetTileIds };
  window.TileSets = TileSets;
  if (typeof module !== 'undefined' && module.exports) module.exports = TileSets;
})();
```

### 3.3 `TILE_FAMILY_STYLES`

Copie a tabela abaixo. `code` é documental (não é ID de tile); `module` é `third | half | line | free`; `material` é `fill | stroke | mixed | void`.

| familyId | code | module | material |
|---|---|---|---|
| center-stripe | F01 | third | fill |
| center-tee | F02 | third | fill |
| center-cross | F03 | third | fill |
| elbow-ribbon | F04 | third | fill |
| truchet-ribbon | F05 | third | fill |
| center-elbow | F06 | third | fill |
| edge-l-shape | F07 | third | fill |
| edge-t-shape | F08 | third | fill |
| stripes | F09 | third | fill |
| corner-stripes | F10 | third | fill |
| diagonal-line | F11 | line | stroke |
| diagonal-hatch | F12 | line | stroke |
| zigzag | F13 | line | stroke |
| mini-grid | F14 | free | fill |
| checkers | F15 | half | fill |
| half-block | F16 | half | fill |
| corner-triangle | F17 | half | fill |
| side-triangle | F18 | half | fill |
| bowtie | F19 | half | fill |
| diamond | F20 | half | fill |
| half-circle | F21 | half | fill |
| edge-semicircle | F22 | half | fill |
| quarter-arc-mid | F23 | half | fill |
| quarter-arc-full | F24 | half | fill |
| corner-petal | F25 | free | fill |
| corner-waves | F26 | line | stroke |
| target-circle | F27 | free | stroke |
| target-square | F28 | free | stroke |
| four-dots | F29 | free | fill |
| diagonal-dots | F30 | free | fill |
| empty-tile | F31 | free | void |
| quarter-block | F32 | half | fill |
| band-cap | F33 | third | fill |
| stripe-uturn | F34 | third | fill |
| frame-ring | F35 | third | fill |
| diagonal-x | F36 | line | stroke |
| diagonal-crosshatch | F37 | line | stroke |
| center-dot | F38 | free | fill |
| edge-dots | F39 | free | fill |
| diamond-outline | F40 | line | stroke |
| ring | F41 | line | stroke |

### 3.4 `TILE_SETS_META`

Copie os 9 objetos de `analysis/sets_meta.json` **sem alterar** os papéis. Forma de cada objeto:

```js
{
  id: 'fita',
  name: 'Fita 1/3',
  tagline: 'Circuito de fitas contínuas',
  module: 'third',
  material: 'fill',
  connection: 'continuidade',
  description: '...',
  recommendedPadding: [0, 0.02],
  families: {
    'center-stripe': 'core',
    // ...
    'edge-t-shape': 'bridge',
    'band-cap': 'terminal'
  }
}
```

Os 9 IDs e seus membros (resumo; os papéis exatos estão no JSON):

| Set | Membros (papel) |
|---|---|
| `fita` | F01–F06 core; F08 bridge; F33 terminal |
| `moldura` | F07, F08, F35 core; F28, F09 bridge; F26 tangent |
| `listras-duplas` | F09, F10 core; F34 terminal |
| `massa-modular` | F16–F19, F15, F21–F24, F32 core; F07, F34, F35, F28 bridge; F20 accent |
| `arcos` | F21–F26, F41 core; F04, F10, F27 accent |
| `linha-diagonal` | F11, F12, F36, F37 core; F40 bridge; F13 texture; F17 accent; F26 texture |
| `foco` | F27–F29, F20, F38–F41 core; F25, F36, F37 accent |
| `pontos` | F38, F39, F29, F30 core; F20, F40 accent |
| `respiro` | F31 core; F29, F30, F38 accent |

**Atenção:** `target-square` (F28) é `bridge` em `moldura` e `core` em `foco`; `corner-waves` (F26) é `tangent` em `moldura` e `texture` em `linha-diagonal`; `target-circle` (F27) é `accent` em `arcos` e `core` em `foco`, **nunca** em `fita`.

---

## 4. T2 — 19 renderers novos (IDs 85–103)

### 4.1 Nomes (adicionar em `TILE_NAMES`, na ordem)

> **Vírgula obrigatória:** o último item existente (`"Tile Vazio (Espaço)"`) não tem vírgula. Acrescente `,` nele antes de colar o bloco novo. O mesmo vale para `TILE_RENDERERS` e `TILE_FAMILIES_META`.

```js
  // --- GRUPO 7: GRAMÁTICA DE CONJUNTOS (NOVOS) ---
  "Quarto de Bloco Top Left",
  "Quarto de Bloco Top Right",
  "Quarto de Bloco Bottom Right",
  "Quarto de Bloco Bottom Left",
  "Terminal de Fita Esquerdo",
  "Terminal de Fita Direito",
  "Terminal de Fita Superior",
  "Terminal de Fita Inferior",
  "Grampo de Listras (Abertura Esquerda)",
  "Grampo de Listras (Abertura Direita)",
  "Grampo de Listras (Abertura Superior)",
  "Grampo de Listras (Abertura Inferior)",
  "Moldura Fechada (Anel de Borda)",
  "Cruz Diagonal (X)",
  "Hachura Cruzada",
  "Ponto Central",
  "Pontos de Borda (Quatro)",
  "Losango Vazado (Diamond Outline)",
  "Anel (Círculo Vazado)"
```

### 4.2 Famílias (adicionar em `TILE_FAMILIES_META`)

```js
  // --- GRUPO 7: GRAMÁTICA DE CONJUNTOS (NOVOS) ---
  { id: 'quarter-block', name: 'Quarto de Bloco', group: 'Massas Sólidas', tileIds: [85, 86, 87, 88] },
  { id: 'band-cap', name: 'Terminal de Fita', group: 'Fitas & Tubos', tileIds: [89, 90, 91, 92] },
  { id: 'stripe-uturn', name: 'Grampo de Listras Duplas', group: 'Listras & Tramas', tileIds: [93, 94, 95, 96] },
  { id: 'frame-ring', name: 'Moldura Fechada', group: 'Massas Sólidas', tileIds: [97] },
  { id: 'diagonal-x', name: 'Cruz Diagonal (X)', group: 'Listras & Tramas', tileIds: [98] },
  { id: 'diagonal-crosshatch', name: 'Hachura Cruzada', group: 'Listras & Tramas', tileIds: [99] },
  { id: 'center-dot', name: 'Ponto Central', group: 'Focos & Pontos', tileIds: [100] },
  { id: 'edge-dots', name: 'Pontos de Borda', group: 'Focos & Pontos', tileIds: [101] },
  { id: 'diamond-outline', name: 'Losango Vazado', group: 'Focos & Pontos', tileIds: [102] },
  { id: 'ring', name: 'Anel', group: 'Focos & Pontos', tileIds: [103] }
```

### 4.3 Renderers (adicionar em `TILE_RENDERERS`)

Todos seguem o padrão do catálogo: `dw = w - padding * 2`, `dh = h - padding * 2`, coordenadas centradas em (0,0), uma cor (`color`).

> **Vírgula obrigatória:** o renderer do Tile Vazio (#84) termina com `}` sem vírgula. Troque por `},` antes de inserir o bloco novo.

```js
  // --- GRUPO 7: GRAMÁTICA DE CONJUNTOS (NOVOS) ---
  // Family 32: Quarto de Bloco (85..88: TL, TR, BR, BL)
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(0, -dh / 2, dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(0, 0, dw / 2, dh / 2);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(-dw / 2, 0, dw / 2, dh / 2);
  },

  // Family 33: Terminal de Fita (89..92: L, R, T, B)
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 6, (dw * 2) / 3, dh / 3);
    ctx.ellipse(dw / 6, 0, dh / 3, dh / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(0, -dh / 6, (dw * 2) / 3, dh / 3);
    ctx.ellipse(-dw / 6, 0, dh / 3, dh / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(-dw / 6, -dh / 2, dw / 3, (dh * 2) / 3);
    ctx.ellipse(0, dh / 6, dw / 3, dw / 3);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(-dw / 6, 0, dw / 3, (dh * 2) / 3);
    ctx.ellipse(0, -dh / 6, dw / 3, dw / 3);
  },

  // Family 34: Grampo de Listras Duplas (93..96: L, R, T, B)
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw / 2, dh / 3);
    ctx.rect(-dw / 2, dh / 6, dw / 2, dh / 3);
    drawAnnularSector(ctx, 0, 0, dw / 6, dh / 6, dw / 2, dh / 2, -Math.PI / 2, Math.PI / 2, 24);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(0, -dh / 2, dw / 2, dh / 3);
    ctx.rect(0, dh / 6, dw / 2, dh / 3);
    drawAnnularSector(ctx, 0, 0, dw / 6, dh / 6, dw / 2, dh / 2, Math.PI / 2, (3 * Math.PI) / 2, 24);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw / 3, dh / 2);
    ctx.rect(dw / 6, -dh / 2, dw / 3, dh / 2);
    drawAnnularSector(ctx, 0, 0, dw / 6, dh / 6, dw / 2, dh / 2, 0, Math.PI, 24);
  },
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(-dw / 2, 0, dw / 3, dh / 2);
    ctx.rect(dw / 6, 0, dw / 3, dh / 2);
    drawAnnularSector(ctx, 0, 0, dw / 6, dh / 6, dw / 2, dh / 2, Math.PI, 2 * Math.PI, 24);
  },

  // Family 35: Moldura Fechada (97)
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.rect(-dw / 2, -dh / 2, dw, dh / 3);
    ctx.rect(-dw / 2, dh / 6, dw, dh / 3);
    ctx.rect(-dw / 2, -dh / 2, dw / 3, dh);
    ctx.rect(dw / 6, -dh / 2, dw / 3, dh);
  },

  // Family 36: Cruz Diagonal (98)
  function (ctx, w, h, padding, color) {
    ctx.noFill(); ctx.stroke(color);
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.10);
    ctx.line(-dw / 2, -dh / 2, dw / 2, dh / 2);
    ctx.line(dw / 2, -dh / 2, -dw / 2, dh / 2);
  },

  // Family 37: Hachura Cruzada (99)
  function (ctx, w, h, padding, color) {
    ctx.noFill(); ctx.stroke(color);
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.10);
    ctx.line(-dw / 2, -dh / 2, dw / 2, dh / 2);
    ctx.line(0, -dh / 2, dw / 2, 0);
    ctx.line(-dw / 2, 0, 0, dh / 2);
    ctx.line(dw / 2, -dh / 2, -dw / 2, dh / 2);
    ctx.line(0, -dh / 2, -dw / 2, 0);
    ctx.line(dw / 2, 0, 0, dh / 2);
  },

  // Family 38: Ponto Central (100)
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    const d = Math.min(dw, dh) / 3;
    ctx.ellipse(0, 0, d, d);
  },

  // Family 39: Pontos de Borda (101)
  function (ctx, w, h, padding, color) {
    ctx.fill(color); ctx.noStroke();
    const dw = w - padding * 2, dh = h - padding * 2;
    const d = Math.min(dw, dh) / 6;
    const r = d / 2;
    ctx.ellipse(0, -dh / 2 + r, d, d);
    ctx.ellipse(0, dh / 2 - r, d, d);
    ctx.ellipse(-dw / 2 + r, 0, d, d);
    ctx.ellipse(dw / 2 - r, 0, d, d);
  },

  // Family 40: Losango Vazado (102)
  function (ctx, w, h, padding, color) {
    ctx.noFill(); ctx.stroke(color);
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.10);
    ctx.beginShape();
    ctx.vertex(0, -dh / 2);
    ctx.vertex(dw / 2, 0);
    ctx.vertex(0, dh / 2);
    ctx.vertex(-dw / 2, 0);
    ctx.endShape('CLOSE');
  },

  // Family 41: Anel (103)
  function (ctx, w, h, padding, color) {
    ctx.noFill(); ctx.stroke(color);
    const dw = w - padding * 2, dh = h - padding * 2;
    ctx.strokeWeight(Math.min(dw, dh) * 0.10);
    ctx.ellipse(0, 0, (dw * 2) / 3, (dh * 2) / 3);
  },
```

> `drawAnnularSector` já existe no topo de `core/tile_registry.js`; use a versão existente, não duplique.

### 4.4 Registros D4 (adicionar antes de `return map;` em `TILE_D4_MAP`)

```js
  // --- GRUPO 7: GRAMÁTICA DE CONJUNTOS (NOVOS) ---
  registerCorner4(85, 86, 87, 88); // Quarto de Bloco: TL, TR, BR, BL
  registerEdge4(89, 90, 91, 92);   // Terminal de Fita: L, R, T, B
  registerEdge4(93, 94, 95, 96);   // Grampo: L, R, T, B
  registerSymmetric1(97);           // Moldura Fechada
  registerSymmetric1(98);           // Cruz Diagonal
  registerSymmetric1(99);           // Hachura Cruzada
  registerSymmetric1(100);          // Ponto Central
  registerSymmetric1(101);          // Pontos de Borda
  registerSymmetric1(102);          // Losango Vazado
  registerSymmetric1(103);          // Anel
```

### 4.5 Conferência rápida de portas esperadas

| Tile | L | R | T | B |
|---|---|---|---|---|
| 85 | H0 | ∅ | H0 | ∅ |
| 86 | ∅ | H0 | H1 | ∅ |
| 87 | ∅ | H1 | ∅ | H1 |
| 88 | H1 | ∅ | ∅ | H0 |
| 89 | C | ∅ | ∅ | ∅ |
| 90 | ∅ | C | ∅ | ∅ |
| 91 | ∅ | ∅ | C | ∅ |
| 92 | ∅ | ∅ | ∅ | C |
| 93 | D | P(0,5) | H0 | H0 |
| 94 | P(0,5) | D | H1 | H1 |
| 95 | H0 | H0 | D | P(0,5) |
| 96 | H1 | H1 | P(0,5) | D |
| 97 | F | F | F | F |
| 98 | S duplo | S duplo | S duplo | S duplo |
| 99 | S triplo | S triplo | S triplo | S triplo |
| 100 | ∅ | ∅ | ∅ | ∅ |
| 101 | P(0,5) | P(0,5) | P(0,5) | P(0,5) |
| 102 | S médio | S médio | S médio | S médio |
| 103 | ∅ | ∅ | ∅ | ∅ |

Se algum valor divergir, **não ajuste o teste**: ajuste a geometria.

---

## 5. T3 — Ajustes de harmonia

### 5.1 A1 — normalizar o traço fino em 0,10

Em `core/tile_registry.js`, substituir `* 0.12` por `* 0.10` nas **seis** ocorrências:

- `diagonal-line` (linhas 324 e 332);
- `diagonal-hatch` (linhas 342 e 352);
- `zigzag` (linhas 364 e 378).

Antes:

```js
ctx.strokeWeight(Math.min(dw, dh) * 0.12);
```

Depois:

```js
ctx.strokeWeight(Math.min(dw, dh) * 0.10);
```

Não alterar `target-circle` / `target-square` (0,06) nem `corner-waves` (0,10). O resultado é `LINE = 0,10`, `HAIRLINE = 0,06`.

### 5.2 A2 — recuar o Alvo Circular (condicional)

Em `core/tile_registry.js`, no renderer do tile 79:

```js
- ctx.ellipse(0, 0, dw, dh);
- ctx.ellipse(0, 0, dw * 0.6, dh * 0.6);
- ctx.ellipse(0, 0, dw * 0.2, dh * 0.2);
+ ctx.ellipse(0, 0, dw * 0.86, dh * 0.86);
+ ctx.ellipse(0, 0, dw * 0.52, dh * 0.52);
+ ctx.ellipse(0, 0, dw * 0.18, dh * 0.18);
```

**Condição:** implemente se o aceite visual permitir. Se o cliente rejeitar a mudança de pixel, **não implemente** e registre no relatório que o Alvo Circular permanece como `tangente` e está fora de `fita`. Nesse caso, adicione um comentário no renderer:

```js
// NOTA: o anel externo tangencia as bordas e imita uma porta C.
// Não usar como conector de Fita (ver TILE_SETS_META: F27 é accent de arcos/foco).
```

### 5.3 A7 — corrigir o comentário da família 18

Em dois lugares (`TILE_RENDERERS` e `TILE_D4_MAP`):

```js
- // Family 17: Triângulos Laterais (48..51)
+ // Family 18: Triângulos Laterais (48..51)
```

Não renumerar nada; é só comentário.

### 5.4 A6 — Zigue-Zague (opcional)

Se o teste visual mostrar emenda ruim, adicione um trecho horizontal de 2% em cada ponta:

```js
ctx.vertex(-dw / 2, 0);
ctx.vertex(-dw / 2 + dw * 0.02, 0);   // lead-in
// ... vértices existentes ...
ctx.vertex(dw / 2 - dw * 0.02, 0);    // lead-out
ctx.vertex(dw / 2, 0);
```

Não faça isso sem ver o antes/depois; é opcional.

---

## 6. T4 — UI “Conjuntos” (lente, não regra)

### 6.0 Agrupamento das famílias (obrigatório antes dos chips)

As 10 famílias novas são **anexadas ao fim** de `TILE_FAMILIES_META` para manter os IDs sequenciais (o teste de registro exige isso). Só que o painel atual cria um cabeçalho sempre que `fam.group` muda; com as novas famílias no fim, apareceriam cabeçalhos repetidos (“Massas Sólidas” de novo, “Fitas & Tubos” de novo etc.).

Corrija a exibição sem reordenar o registro:

```js
const FAMILY_GROUP_ORDER = [
  'Fitas & Tubos',
  'Listras & Tramas',
  'Massas Sólidas',
  'Círculos & Arcos',
  'Focos & Pontos',
  'Espaço Negativo'
];

function getFamiliesForDisplay() {
  return window.TileRegistry.TILE_FAMILIES_META
    .map((fam, index) => ({ fam, index }))
    .sort((a, b) => {
      const ga = FAMILY_GROUP_ORDER.indexOf(a.fam.group);
      const gb = FAMILY_GROUP_ORDER.indexOf(b.fam.group);
      return (ga - gb) || (a.index - b.index);
    })
    .map((entry) => entry.fam);
}
```

Use `getFamiliesForDisplay()` em vez de `TILE_FAMILIES_META` em:

- `renderSwatchesPanel()` (painel de swatches do Gerador);
- `renderEditBrushPalette()` (paleta do Editor).

Dentro de cada grupo, a ordem relativa é a do registro (estável), então as famílias existentes não mudam de lugar. As novas entram no grupo certo, no fim do grupo.

> Não altere `TILE_FAMILIES_META` para “colocar cada família no seu grupo”: isso quebraria a sequência de IDs exigida por `test_tile_registry.js`.

### 6.1 HTML

Em `index.html`, dentro de `#panelSwatchesBody`, **antes** de `#familiesSwatchContainer`:

```html
<div id="setsSwatchContainer" class="sets-swatch-strip">
  <div class="sets-strip-head">
    <span class="sets-strip-title">Conjuntos</span>
    <span class="sets-strip-hint">lente de curadoria — não é regra</span>
  </div>
  <div id="setsChips" class="sets-chips"></div>
</div>
```

Não mover nem renomear `#familiesSwatchContainer`, `#tileSearchInput` ou `#activeTilesCounter`. Não criar um novo painel no dock; é uma faixa dentro do painel de swatches.

### 6.2 JS

Em `sketch.js`, adicione antes de `renderSwatchesPanel()`:

```js
function renderSetsPanel() {
  const host = document.getElementById('setsChips');
  if (!host || !window.TileSets) return;
  host.innerHTML = '';

  const sets = window.TileSets.TILE_SETS_META;
  const totalTiles = window.TileRegistry.TILE_RENDERERS.length;

  for (const set of sets) {
    const ids = window.TileSets.getSetTileIds(set.id);
    if (ids.length === 0) continue;
    const selected = ids.filter((id) => StudioState.allowedTiles.has(id)).length;
    const isFull = selected === ids.length;
    const isPartial = selected > 0 && !isFull;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'set-chip' + (isFull ? ' full' : isPartial ? ' partial' : '');
    btn.setAttribute('aria-pressed', isFull ? 'true' : 'false');
    btn.title = [
      set.description,
      `Módulo: ${set.module} · ${set.material}`,
      `Padding recomendado: ${Math.round(set.recommendedPadding[0] * 100)}–${Math.round(set.recommendedPadding[1] * 100)}%`,
      `Papéis: ${Object.values(set.families).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`
    ].filter(Boolean).join('\n');

    const name = document.createElement('span');
    name.className = 'set-chip-name';
    name.textContent = set.name;

    const count = document.createElement('span');
    count.className = 'set-chip-count';
    count.textContent = `${selected}/${ids.length}`;

    btn.appendChild(name);
    btn.appendChild(count);

    btn.addEventListener('click', () => {
      if (isFull) ids.forEach((id) => StudioState.allowedTiles.delete(id));
      else ids.forEach((id) => StudioState.allowedTiles.add(id));
      renderSwatchesPanel();
      regenerateMosaic(true);
    });

    host.appendChild(btn);
  }

  const badge = document.getElementById('activeTilesCounter');
  if (badge) badge.textContent = `${StudioState.allowedTiles.size} / ${totalTiles}`;
}
```

No início de `renderSwatchesPanel()` (depois dos guards de container), chame:

```js
renderSetsPanel();
```

Não coloque a chamada dentro do loop de famílias; não recrie o painel a cada chip.

### 6.3 CSS

Em `style.css`, junto dos estilos de swatches:

```css
.sets-swatch-strip {
  flex: 0 0 auto;
  padding: 8px 10px 10px;
  border-bottom: 1px solid var(--border-subtle);
}
.sets-strip-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}
.sets-strip-title {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.sets-strip-hint {
  font-size: 9.5px;
  color: var(--text-tertiary, #7c8497);
}
.sets-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.set-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 7px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--bg-elevated, #1d222c);
  color: var(--text-secondary);
  font-size: 10px;
  cursor: pointer;
}
.set-chip:hover { border-color: var(--accent); color: var(--text-primary); }
.set-chip.full { border-color: var(--accent); color: var(--text-primary); background: rgba(224, 168, 78, 0.12); }
.set-chip.partial { border-style: dashed; color: var(--text-primary); }
.set-chip-count {
  font-variant-numeric: tabular-nums;
  font-size: 9px;
  color: var(--text-tertiary, #7c8497);
}
```

Use os tokens existentes; não invente cores novas. Se `--text-tertiary` não existir, use `--text-muted` ou `#7c8497`.

### 6.4 Comportamento

- Clicar num chip **liga** a união de tiles do conjunto; clicar de novo **desliga**.
- Conjuntos sobrepostos somam; não há exclusão mútua.
- O chip reflete `selected/ids.length`; `aria-pressed` só é `true` quando todos estão ativos.
- O painel não altera `StudioState.seed`, simetria, padding ou histórico.
- `renderSetsPanel()` precisa ser idempotente e barato; ele roda a cada `renderSwatchesPanel()`.

---

## 7. T5 — Testes

### 7.1 Atualizar `tests/test_tile_registry.js` (se necessário)

O teste atual é dinâmico: conta renderers, nomes, famílias e valida D4. Com os 19 tiles e 10 famílias, ele deve passar sem mudanças. Se houver hard-code de 85/31, troque pelos valores dinâmicos. Acrescente uma asserção explícita:

```js
if (TILE_RENDERERS.length !== 104) throw new Error(`Expected 104 renderers, got ${TILE_RENDERERS.length}`);
if (TILE_FAMILIES_META.length !== 41) throw new Error(`Expected 41 families, got ${TILE_FAMILIES_META.length}`);
```

### 7.2 Novo `tests/test_tile_sets.js`

```js
const path = require('path');
global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/tile_sets.js'));

const { TILE_FAMILIES_META } = window.TileRegistry;
const { TILE_SETS_META, TILE_FAMILY_STYLES, getSetTileIds, getSetsForFamily } = window.TileSets;
const ROLES = new Set(['core', 'bridge', 'terminal', 'accent', 'texture', 'tangent']);
const famIds = new Set(TILE_FAMILIES_META.map((f) => f.id));

if (TILE_SETS_META.length !== 9) throw new Error(`Expected 9 sets, got ${TILE_SETS_META.length}`);

for (const set of TILE_SETS_META) {
  if (!set.id || !set.name) throw new Error('Set without id/name');
  if (!Array.isArray(set.recommendedPadding) || set.recommendedPadding.length !== 2) {
    throw new Error(`Set ${set.id} missing recommendedPadding`);
  }
  const roles = Object.values(set.families);
  if (!roles.includes('core')) throw new Error(`Set ${set.id} has no core`);
  for (const [fid, role] of Object.entries(set.families)) {
    if (!famIds.has(fid)) throw new Error(`Set ${set.id} references unknown family ${fid}`);
    if (!ROLES.has(role)) throw new Error(`Set ${set.id} has invalid role ${role}`);
  }
  const ids = getSetTileIds(set.id);
  if (ids.length === 0) throw new Error(`Set ${set.id} resolves to zero tiles`);
  if (new Set(ids).size !== ids.length) throw new Error(`Set ${set.id} has duplicate tile ids`);
}

// Famílias-ponte precisam estar em >= 2 conjuntos
const bridges = ['edge-t-shape', 'edge-l-shape', 'stripes', 'frame-ring', 'stripe-uturn', 'target-square', 'diamond-outline', 'ring'];
for (const fid of bridges) {
  const sets = getSetsForFamily(fid);
  if (sets.length < 2) throw new Error(`Bridge ${fid} should be in >=2 sets, got ${sets.length}`);
}

// Alvo Circular não pode ser núcleo de Fita
const fita = TILE_SETS_META.find((s) => s.id === 'fita');
if (fita.families['target-circle']) throw new Error('target-circle must not belong to fita');

// Estilos: toda família tem estilo
for (const fid of famIds) {
  if (!TILE_FAMILY_STYLES[fid]) throw new Error(`Missing TILE_FAMILY_STYLES for ${fid}`);
}

console.log('✓ 9 sets, roles, bridges and styles verified.');
```

### 7.3 Novo `tests/test_tile_ports.js`

Objetivo: amostrar as bordas dos 19 tiles novos com um recorder puro (sem canvas) e provar que as portas são as esperadas. Use `analysis/edge_profiles.js` como referência; a versão do teste pode ser mais simples (256 amostras).

```js
const path = require('path');
global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));

const { TILE_RENDERERS } = window.TileRegistry;
const S = 400, N = 256;

function makeRecorder() {
  const fillPolys = [], strokePaths = [];
  let fill = null, stroke = null, weight = 1, cur = null;
  const rec = {
    fill: () => { fill = 1; }, noFill: () => { fill = null; },
    stroke: () => { stroke = 1; }, noStroke: () => { stroke = null; },
    strokeWeight: (w) => { weight = w; },
    rect: (x, y, w, h) => emit([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true),
    ellipse: (x, y, w, h) => { const p = []; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; p.push([x + Math.cos(a) * w / 2, y + Math.sin(a) * h / 2]); } emit(p, true); },
    triangle: (x1, y1, x2, y2, x3, y3) => emit([[x1, y1], [x2, y2], [x3, y3]], true),
    line: (x1, y1, x2, y2) => strokePaths.push({ pts: [[x1, y1], [x2, y2]], w: weight }),
    arc: () => {},
    beginShape: () => { cur = []; },
    vertex: (x, y) => cur.push([x, y]),
    endShape: (m) => { emit(cur, m === 'CLOSE'); cur = null; }
  };
  function emit(points, closed) {
    if (fill) fillPolys.push(points);
    if (stroke) strokePaths.push({ pts: closed ? [...points, points[0]] : points, w: weight });
  }
  return { rec, fillPolys, strokePaths };
}

function pip(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function edgeRuns(id, side) {
  const { rec, fillPolys, strokePaths } = makeRecorder();
  TILE_RENDERERS[id](rec, S, S, 0, '#000');
  const half = S / 2, runs = [];
  let start = -1;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const p = -half + t * S;
    const [x, y] = side === 'left' ? [-half + 0.5, p] : side === 'right' ? [half - 0.5, p] : side === 'top' ? [p, -half + 0.5] : [p, half - 0.5];
    let ink = fillPolys.some((poly) => pip(x, y, poly));
    if (!ink) ink = strokePaths.some((sp) => sp.pts.some((pt, k) => k > 0 && segDist(x, y, sp.pts[k - 1][0], sp.pts[k - 1][1], pt[0], pt[1]) <= sp.w / 2 + 0.25));
    if (ink && start < 0) start = i;
    if (!ink && start >= 0) { runs.push([start / N, i / N]); start = -1; }
  }
  if (start >= 0) runs.push([start / N, 1]);
  return runs.filter(([a, b]) => b - a >= 0.04);
}

function near(runs, expected, tol = 0.03) {
  if (runs.length !== expected.length) return false;
  return runs.every(([a, b], i) => Math.abs(a - expected[i][0]) <= tol && Math.abs(b - expected[i][1]) <= tol);
}

const SIDES = ['left', 'right', 'top', 'bottom'];
const checks = [
  [85, { left: [[0, 0.5]], right: [], top: [[0, 0.5]], bottom: [] }],
  [89, { left: [[1 / 3, 2 / 3]], right: [], top: [], bottom: [] }],
  [93, { left: [[0, 1 / 3], [2 / 3, 1]], right: [], top: [[0, 0.5]], bottom: [[0, 0.5]] }],
  [97, { left: [[0, 1]], right: [[0, 1]], top: [[0, 1]], bottom: [[0, 1]] }],
  [98, { left: [[0, 0.09], [0.91, 1]], right: [[0, 0.09], [0.91, 1]], top: [[0, 0.09], [0.91, 1]], bottom: [[0, 0.09], [0.91, 1]] }],
  [100, { left: [], right: [], top: [], bottom: [] }],
  [101, { left: [], right: [], top: [], bottom: [] }],
  [103, { left: [], right: [], top: [], bottom: [] }]
];

for (const [id, expected] of checks) {
  for (const side of SIDES) {
    const runs = edgeRuns(id, side);
    if (!near(runs, expected[side])) {
      throw new Error(`Tile ${id} ${side}: expected ${JSON.stringify(expected[side])}, got ${JSON.stringify(runs)}`);
    }
  }
}
console.log('✓ New tile edge ports verified.');
```

> O tile 101 tem contato pontual; o teste de intervalos mínimos de 4% retorna vazio, o que é esperado. Se quiser testar o ponto, diminua o filtro para 1% e verifique um run em torno de 0,5.

### 7.4 Novo `tests/test_ui_sets.js` (estático)

```js
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const sketch = fs.readFileSync(path.join(__dirname, '../sketch.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');

for (const id of ['setsSwatchContainer', 'setsChips']) {
  const matches = html.match(new RegExp(`id=["']${id}["']`, 'g')) || [];
  if (matches.length !== 1) throw new Error(`#${id} must exist exactly once in index.html`);
}
if (!sketch.includes('function renderSetsPanel')) throw new Error('renderSetsPanel missing');
if (!sketch.includes('renderSetsPanel()')) throw new Error('renderSetsPanel is never called');
if (!css.includes('.set-chip')) throw new Error('.set-chip styles missing');
console.log('✓ Sets UI contract verified.');
```

### 7.5 `tests/run_all.js`

Adicione as novas suítes na seção “UI Architecture” / “Documentation & Contracts”:

```js
  'test_tile_sets.js',
  'test_tile_ports.js',
  'test_ui_sets.js',
```

A ordem recomendada: `test_tile_registry.js`, `test_tile_sets.js`, `test_tile_ports.js` logo após o registro.

### 7.6 Persistência

Adicione um teste (ou um caso em `test_tile_sets.js`) que simule um payload antigo com `allowedTiles: [0, 1, 2, 3]` e `totalTiles: 85`; depois de carregar com 104 tiles, os IDs 0–3 continuam válidos e os novos (85–103) não são adicionados automaticamente. Não altere `STORAGE_VERSION`.

---

## 8. T6 — Documentação e pranchas

1. Atualize `README.md`:
   - 85 → 104 tiles; 31 → 41 famílias;
   - adicione `core/tile_sets.js` à árvore;
   - “10 suítes” → “23 suítes” (ajuste ao número real do `run_all.js`);
   - mencione os 9 conjuntos e que são consultivos.
2. Atualize `docs/MANUAL_MANUTENCAO.md`:
   - seção 3: 104 renderers, 41 famílias, IDs 85–103, `TILE_SETS_META`;
   - regra de manutenção: IDs novos só no fim; conjunto não é constraint;
   - ordem de carga com `core/tile_sets.js`.
3. Atualize `docs/README.md`:
   - adicione a análise e a Rodada 5 ao índice.
4. Copie as pranchas para `docs/analise/` (já estão lá):
   - `atlas_subtiles.png`, `propostas_familias.png`, `paineis_conjuntos.png`, `mapa_conjuntos.png`, `emendas.png`.
5. Se implementar A1/A2, registre no relatório a mudança visual (tiles 79 e os 8 de traço) e anexe um antes/depois.

---

## 9. T7 — Validação e capturas

### 9.1 Comandos

```powershell
node tests/run_all.js
node tests/test_tile_registry.js
node tests/test_tile_sets.js
node tests/test_tile_ports.js
node tests/test_ui_sets.js
```

Todos precisam passar. `test_tile_registry.js` deve logar **104 renderers, 104 nomes, 41 famílias**.

### 9.2 Runtime (navegador)

Servidor local:

```powershell
python -m http.server 8765
```

Cenários:

1. **Gerador** com todas as famílias: os novos tiles aparecem no painel; os chips de conjunto aparecem no topo; nenhum erro no console.
2. **Conjunto Fita**: clicar no chip “Fita 1/3”; apenas os tiles das 7 famílias ficam ativos; gerar; as fitas continuam nas bordas (com padding 0–2%).
3. **Conjunto Massa**: clicar em “Massa Modular”; gerar; verificar que o Quarto de Bloco aparece e que não há tiles de fita misturados.
4. **Conjunto Listras Duplas**: ativar; gerar; verificar o Grampo e a Curva.
5. **Conjunto Moldura**: ativar; gerar; verificar a Moldura Fechada.
6. **Sobreposição**: ativar Fita + Moldura; verificar que `Junção de Borda (T)` participa dos dois (contagem não duplica tiles).
7. **Save antigo**: limpar storage, criar um desenho, recarregar; depois forçar `localStorage` com um payload de 85 tiles; recarregar; o desenho antigo deve restaurar e os novos tiles devem ficar desligados.
8. **D4 estrito**: ativar famílias novas com tiles assimétricos; gerar em `mandala_d4`; o fallback para o Vazio (#84) deve continuar funcionando.

### 9.3 Capturas

Em `tests/screenshots/`:

- `conjuntos_fita_1440x900.png`
- `conjuntos_massa_1440x900.png`
- `conjuntos_moldura_1440x900.png`
- `conjuntos_sobreposicao_1440x900.png`
- `conjuntos_painel_1280x800.png`

Todas posteriores ao último commit.

---

## 10. Critérios de aceite finais

- [ ] `node tests/run_all.js` passa; 104 renderers, 41 famílias.
- [ ] IDs 0–84 intactos; nenhum tile existente reordenado ou removido.
- [ ] 19 tiles novos (85–103) com nomes, famílias, D4 e renderers.
- [ ] `TILE_D4_MAP` cobre 85–103; axiomas de grupo passam.
- [ ] `core/tile_sets.js` com 9 conjuntos, papéis válidos, `getSetTileIds`, `getSetsForFamily`.
- [ ] Uma família-bridge aparece em ≥2 conjuntos; `target-circle` fora de `fita`.
- [ ] UI de conjuntos: chips, contagem, `aria-pressed`, toggle, sem constraint no gerador.
- [ ] Saves antigos restauram; novos tiles não são auto-adicionados.
- [ ] A1 aplicado (0,12 → 0,10); A2 aplicado ou explicitamente recusado; A7 corrigido.
- [ ] Documentação atualizada (104/41, 23 suítes, `core/tile_sets.js`).
- [ ] 5 capturas em 1440×900 e 1280×800.
- [ ] Nenhum erro no console.

---

## 11. O que não fazer

- Não renumere, reordene ou remova tiles 0–84.
- Não use `TILE_SETS_META` no `mosaic_engine.js`, no `regenerateMosaic` ou em `getCompatibleTiles`.
- Não faça o conjunto “solo” limpar `allowedTiles` automaticamente sem o usuário clicar; o chip só liga/desliga a união.
- Não altere `STORAGE_VERSION` nem a chave de storage.
- Não adicione dependências.
- Não mude a paleta, o tema, o layout das quatro superfícies ou os atalhos.
- Não altere a matemática D4.
- Não “conserte” a numeração das famílias existentes; só o comentário A7.
- Não implemente as candidatas da fase 2 (S-bend, cruz dupla, roseta central) nesta rodada.
- Não mexa em `_legacy/`, `libraries/` ou nos testes de rodadas anteriores sem necessidade.

---

## 12. Formato da resposta final

1. **Resumo por tarefa** (T1–T7): `feito` / `não feito` / `feito com ressalva`.
2. **Contagens**: renderers, nomes, famílias, conjuntos; IDs 85–103.
3. **Tabela de-para**: família nova → IDs → portas → conjunto → papel.
4. **Ajustes**: A1, A2 (feito/recusado, com motivo), A7, A6 (se fez).
5. **Testes**: comandos + saídas; `run_all.js` com o total de suítes.
6. **Capturas**: caminhos e resoluções.
7. **Prova de persistência**: payload antigo restaurado, novos tiles desligados.
8. **`git diff --stat`**.
9. **O que foi considerado e descartado** (ex.: conjunto como constraint, renumerar IDs, fase 2).

Não escreva “concluído” sem os números. Se algo ficou pela metade, diga o que e por quê.

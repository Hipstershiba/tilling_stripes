# Manual de Manutenção e Arquitetura — Tiling Stripes Studio

Este documento serve como guia técnico detalhado para desenvolvedores e mantenedores do projeto `tilling_stripes`.

---

## 1. Visão Geral da Arquitetura

O Tiling Stripes Studio é implementado em vanilla JavaScript (ES6+) e p5.js sem bundlers ou frameworks, organizado modularmente na pasta `core/`:

```
core/
├── d4_symmetry.js     # Álgebra do grupo D4, estabilizadores e resolução de órbitas
├── tile_registry.js   # Catálogo estático de 85 renderers vetoriais organizados em 31 famílias
└── mosaic_engine.js   # Motor de geração determinística, propagação por escopo e snapshots
sketch.js              # Controlador principal da UI, eventos de canvas, histórico e atalhos
style.css              # Regras visuais, tema Adobe Illustrator CC Dark e visibilidade (.hidden)
index.html             # Shell estrutural, dock contextual e ordem de carga
tests/                 # Suíte de testes automatizados executáveis com Node.js
```

### Ordem Obrigatória de Carga dos Scripts em `index.html`

```html
<script src="libraries/p5.min.js"></script>
<script src="libraries/simple-svg.js"></script>
<script src="core/d4_symmetry.js"></script>
<script src="core/tile_registry.js"></script>
<script src="core/mosaic_engine.js"></script>
<script src="sketch.js"></script>
```

---

## 2. Álgebra de Simetria e Grupo Diédrico D4 (`core/d4_symmetry.js`)

O grupo diédrico $D_4$ consiste nas 8 isometrias do quadrado:
- `id`: Identidade (0°)
- `r90`: Rotação de 90° no sentido horário
- `r180`: Rotação de 180°
- `r270`: Rotação de 270° no sentido horário
- `mx`: Reflexão horizontal (troca colunas)
- `my`: Reflexão vertical (troca linhas)
- `md`: Reflexão na diagonal principal ($r = c$)
- `mad`: Reflexão na anti-diagonal ($r + c = N - 1$)

### Invariância e Estabilizadores de Célula

Quando uma célula do mosaico $(r, c)$ é invariante sob uma transformação $g$ ($g(r, c) = (r, c)$), o elemento $g$ pertence ao **estabilizador** da célula ($\mathrm{Stab}(r, c)$).

Para que o mosaico ou bloco seja matematicamente invariante sob $g$, o tile atribuído a essa célula **deve obrigatoriamente ser invariante sob $g$**:
$$g(\mathrm{tileId}) = \mathrm{tileId}$$

O módulo disponibiliza as seguintes funções matemáticas fundamentais:
- `transformGridCoords(row, col, rows, cols, transformKey)`: Mapeia coordenadas em uma grade sob qualquer elemento de $D_4$.
- `composeD4(outer, inner)`: Consulta a tabela pré-calculada de Cayley $8 \times 8$ para composição de transformações.
- `invertD4(transformKey)`: Retorna o elemento inverso $g^{-1}$.
- `getCellStabilizer(row, col, rows, cols, symmetryMode)`: Calcula o subgrupo estabilizador de uma coordenada.
- `isTileInvariantUnder(tileId, g)`: Verifica se o tile não altera visualmente sob $g$.
- `getCompatibleTiles(allowedTiles, stabilizer)`: Filtra o conjunto de tiles para aqueles compatíveis com todas as transformações do estabilizador.

---

## 3. Catálogo de Tiles (`core/tile_registry.js`)

O catálogo é a fonte de verdade para a renderização vetorial:
- 85 renderers procedurais (`TILE_RENDERERS`), indexados de 0 a 84.
- 31 famílias fechadas sob a ação de $D_4$ (`TILE_FAMILIES_META`).
- `TILE_D4_MAP`: Tabela $85 \times 8$ que define para cada tile e transformação em $D_4$ o tile resultante dentro da mesma família.
- Tiles totalmente simétricos (invariantes sob todas as 8 transformações de $D_4$): IDs `#6, #37, #54, #79, #80, #81, #84`.

> **Regra de Manutenção:** Não altere a numeração dos 85 IDs existentes sem migração de versão do storage, pois saves de usuários usam esses índices diretamente.

---

## 4. Motor de Mosaico (`core/mosaic_engine.js`)

### Estrutura Hierárquica
1. **Mosaico Macro**: Grade de $rows \times cols$ blocos (Supertiles).
2. **Bloco / Supertile**: Bloco quadrado composto por $N \times N$ subtiles, onde $N = 2 \times \text{subdivisão}$.
3. **Subtile**: Célula mínima que renderiza um tile indexado com sua transformação de orientação.

### Escopos de Edição
- `canvas_center`: Propaga globalmente em torno do centro do artboard. Requer que células nos eixos obedeçam aos estabilizadores da simetria do centro.
- `orbit_sym`: Combina a simetria do bloco com a órbita macro da grade.
- `block_sym`: Propaga exclusivamente nos 4 quadrantes internos do bloco clicado.
- `all_blocks`: Propaga para todos os blocos mantendo a rotação macro de cada um.
- `single`: Modo pontual livre; permite aplicar qualquer tile na célula sob o cursor sem propagação.
- `same_tile`: Substituição global de todas as ocorrências de um tile. Opera exclusivamente no tamanho 1×1 (tamanhos maiores exibem `#sameTileNotice` e aviso no editor).

---

## 5. Persistência e Tratamento de Quota (`sketch.js`)

### Armazenamento em `localStorage`
A chave utilizada é `tiling_stripes_studio_state_v2`.

### Limites e Gestão de Histórico
- `MAX_GENERATION_HISTORY = 30`: Histórico de parâmetros da grade e sementes.
- `MAX_EDIT_HISTORY = 25`: Snapshots completos das células do mosaico para Undo/Redo.
- **Corte no Push**: O corte de limites (`shift()`) é feito imediatamente no momento em que um novo estado é inserido (`pushGenerationHistory` e `pushEditHistorySnapshot`), garantindo que os índices ativos apontem com precisão para o snapshot correto e não sofram descolamento ao salvar.
- **Redução Dinâmica por Bytes**: Em grades muito grandes (ex.: $16 \times 16$, subdivisão 4), `getMaxEditHistoryForMosaic()` reduz dinamicamente o número máximo de snapshots para assegurar que o payload caiba no orçamento de ~3,5 MB do navegador.

### Fallback de Quota
Ao capturar `QuotaExceededError`:
1. Tentativa 1: Gravar payload completo com históricos.
2. Tentativa 2 (Fallback): Gravar payload mínimo contendo apenas a configuração, semente e o `cellsSnapshot` (desenho atual completo), descartando os arrays de histórico. O usuário é avisado via banner `#persistenceWarning`.
3. Tentativa 3: Se o armazenamento estiver totalmente bloqueado, exibe aviso persistente orientando a exportação manual em SVG/PNG sem perder o estado em memória.

---

## 6. Como Rodar e Testar

### Servidor Local
```powershell
python -m http.server 8765
```

### Execução dos Testes Automatizados
```powershell
node tests/test_tile_registry.js
node tests/test_mosaic_engine.js
node tests/test_state_persistence.js
node tests/test_d4_invariance.js
node tests/test_history_limits.js
node tests/test_persistence_quota.js
node tests/test_editor_ui_state.js
```

---

## 7. Informações de Legado

Arquivos anteriores da versão 1 (`subtile.js`, `tiles.js`, `supertile.js`, `svg_tile_manager.js`, `tile_transforms.js`) foram arquivados na pasta `_legacy/` para fins históricos e de referência. Não devem ser alterados nem carregados no runtime do estúdio atual.

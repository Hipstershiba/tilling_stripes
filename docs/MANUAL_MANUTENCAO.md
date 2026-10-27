# Manual de Manutenção e Arquitetura — Tiling Stripes Studio

Este documento serve como guia técnico detalhado para desenvolvedores e mantenedores do projeto `tilling_stripes`.

---

## 1. Visão Geral da Arquitetura

O Tiling Stripes Studio é implementado em vanilla JavaScript (ES6+) e p5.js sem bundlers ou frameworks, organizado modularmente na pasta `core/`:

```
core/
├── d4_symmetry.js         # Álgebra do grupo D4, transformações, estabilizadores e resolução de órbitas
├── vector_renderer.js     # Renderizador normalizado [-0.5, 0.5] para primitivas e curvas vetoriais JSON
├── d4_detect.js           # Detector analítico headless dos 10 subgrupos de D4 (1, 2, 4 e 8 variantes)
├── tile_library.js        # Biblioteca canônica JSON v1 com os 6 grupos e 31 mestres built-in (85 subtiles)
├── library_compiler.js    # Compilador determinístico de mestres JSON em catálogos D4 e tabelas de remap
├── library_store.js       # Persistência híbrida (IDB + localStorage), CRUD de grupos/famílias e I/O JSON
├── tile_registry.js       # Fachada reativa do catálogo de renderers, famílias e mapas D4 (libraryRevision)
├── vector_editor.js       # Motor vetorial interativo [-0.5, 0.5] (8 ferramentas, Bezier, snap, undo/redo)
├── vector_boolean.js      # Booleanas Paper.js headless (vm isolado no Node), transformações D4, camadas e I/O SVG
├── subtile_studio_ui.js   # Controlador do Modo Estúdio de Subtiles (data-studio-mode="tiles"), CRUD UI e preview D4
├── mosaic_engine.js       # Motor de geração determinística, propagação por escopo, render e snapshots
├── state_persistence.js   # Lógica pura de persistência (IndexedDB + localStorage), quotas e histórico
├── history_nav.js         # Navegação preguiçosa no histórico de geração, orçamento e snapshots
├── document_snapshot.js   # Captura e aplicação de snapshots de parâmetros do documento para undo entre gerações
├── spout_output.js        # Sanitização de nomes, probe de mudanças e formatação de quadros para saída Spout
└── ui_format.js           # Formatadores puros de rótulos de escopos de simetria e interface
ui_info.js                 # Motor de divulgação progressiva (17 tópicos, popovers e tooltips acessíveis)
sketch.js                  # Controlador principal da UI, eventos de canvas, histórico, atalhos e Spout
style.css                  # Regras visuais, tema Adobe Illustrator CC Dark e visibilidade (.hidden)
index.html                 # Shell estrutural, superfícies de controle e ordem estrita de carga
tests/                     # Suíte com 44 testes automatizados executáveis com Node.js puro
tools/                     # Bridge local WebSocket -> SpoutGL em Python (spout_bridge.py / .cmd)
```

### Ordem Obrigatória de Carga dos Scripts em `index.html`

```html
<script src="libraries/p5.min.js"></script>
<script src="libraries/simple-svg.js"></script>
<script src="libraries/paper-core.min.js"></script>
<script src="core/d4_symmetry.js"></script>
<script src="core/vector_renderer.js"></script>
<script src="core/d4_detect.js"></script>
<script src="core/tile_library.js"></script>
<script src="core/library_compiler.js"></script>
<script src="core/library_store.js"></script>
<script src="core/tile_registry.js"></script>
<script src="core/mosaic_engine.js"></script>
<script src="core/state_persistence.js"></script>
<script src="core/history_nav.js"></script>
<script src="core/document_snapshot.js"></script>
<script src="core/spout_output.js"></script>
<script src="core/ui_format.js"></script>
<script src="ui_info.js"></script>
<script src="core/vector_editor.js"></script>
<script src="core/vector_boolean.js"></script>
<script src="core/subtile_studio_ui.js"></script>
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

### Os 4 Modos de Simetria
1. **`mandala_d4` (Mandala Estrita)**:
   - 8 eixos de simetria com respeito rigoroso aos estabilizadores matemáticos de cada célula.
   - Caso o conjunto de famílias ativas impossibilite tiles invariantes em células fixas, o motor utiliza o **Tile Vazio (#84)** garantindo D4 perfeito sem bloquear a geração.
2. **`kaleidoscope` (Caleidoscópio Livre)**:
   - Propagação nos 8 octantes aplicando rotações e reflexões sem exigir estabilizadores para as células fixas, permitindo composições ricas mesmo com famílias assimétricas.
3. **`rotational_c4` (Giro Contínuo)**:
   - 4 quadrantes em giro rotacional contínuo de 90° ao redor do centro.
4. **`bilateral_d2` (Espelhamento Duplo)**:
   - Espelhamento bilateral nos eixos horizontal e vertical.

---

## 3. Motor Vetorial JSON e Catálogo de Tiles (`core/tile_library.js`, `core/library_compiler.js`, `core/library_store.js` e `core/tile_registry.js`)

O catálogo vetorial é compilado deterministicamente a partir de mestres JSON normalizados em `[-0.5, 0.5]^2`:
- **85 subtiles built-in canônicos** (`TILE_RENDERERS`, indexados de `0` a `84`) gerados a partir das **31 famílias built-in** em **6 grupos** (`TILE_FAMILIES_META`), seguidos dinamicamente por famílias customizadas (`>= 85`).
- **Detecção automática de simetria $D_4$ (`core/d4_detect.js`)**: Classifica qualquer mestre em um dos 10 subgrupos estabilizadores de $D_4$, gerando `1`, `2`, `4` ou `8` variantes e preenchendo `TILE_D4_MAP` com fechamento algébrico exato.
- **Mutação in-place e `libraryRevision`**: `TileRegistry` sincroniza `TILE_RENDERERS`, `TILE_NAMES`, `TILE_FAMILIES_META` e `TILE_D4_MAP` in-place, expõe `getOrderedGroupedFamilies()` respeitando `LibraryStore.getGroups()` e `uiOrder`, e incrementa `libraryRevision` (integrado ao `artifactSignature` do Spout).
- **Modo Estúdio de Subtiles e Editor Vetorial (`core/vector_editor.js` e `core/subtile_studio_ui.js`)**: Alterna `body[data-studio-mode="mosaic|tiles"]` (`Ctrl+E`) sem violar a hierarquia das 4 superfícies nem os 60 controles congelados, oferecendo 8 ferramentas vetoriais interativas (`select`, `direct`, `pen`, `rect`, `ellipse`, `polygon`, `arc`, `line`), grade magnética (`0..16`), subdivisão De Casteljau, *undo/redo* por família, árvore *Drag-and-Drop* de grupos/famílias, preview de vizinhos (`1×1`, `3×3`, `mandala_d4`, `rotational_c4`), auto-matrícula de novos IDs em `allowedTiles` e sanitização *tombstone* $\to$ `#84`.

- **Booleanas, Camadas & SVG (`core/vector_boolean.js`)**: Expõe `window.VectorBoolean` com `applyBooleanOp(shapes, selectedIds, op)` (`unite` | `subtract` | `intersect` | `exclude`), `transformSelectedShapesD4(shapes, selectedIds, d4Key)`, `reorderShapeZ(shapes, id, target)` (`front` | `forward` | `backward` | `back` | índice), `setShapeVisible`/`toggleShapeVisible`, `setShapeLocked`/`toggleShapeLocked`, `renameShape`, `importSVGToShapes(svgText, options)` e `exportFamilyToSVG(familyDoc, options)`. No navegador usa `window.paper` (`libraries/paper-core.min.js`); no Node carrega a mesma biblioteca num contexto `vm` isolado (zero dependências npm). As coordenadas são escaladas por `PAPER_SCALE = 1000` (`[-0.5, 0.5] ↔ [-500, 500]`) para respeitar as tolerâncias internas do Paper.js. Formas travadas ou ocultas nunca participam de booleanas/transformações.
- **Persistência e Remapeamento (`core/library_store.js`)**: Persiste bibliotecas customizadas em `IndexedDB` (`tiling_stripes_library_db` / `tile_library_store`) com cache síncrono em `localStorage` (`tiling_stripes_tile_library_v1`), remapeando IDs em memória e convertendo famílias excluídas em *tombstone* para `#84`.
- Tiles built-in totalmente simétricos (invariantes sob todas as 8 transformações de $D_4$): IDs `#6, #37, #54, #79, #80, #81, #84`.

> **Regra de Manutenção:** Não altere a numeração dos 85 IDs existentes sem migração de versão do storage, pois saves de usuários usam esses índices diretamente. O tile `#84` é reservado como o Tile Nulo / Vazio oficial do sistema.

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

## 5. Arquitetura de UI — As Quatro Superfícies

A interface adota a taxonomia de quatro superfícies estritas com responsabilidades dedicadas e layout responsivo testado em 1280×800 e 1440×900:

1. **Barra Superior (`#top-control-bar` — O Documento)**:
   - Configurações do documento: Artboard (largura, altura, inversão W ⇄ H, proporção travada, ajuste à grade), Grade (linhas, colunas, inversão L ⇄ C, proporção travada, células quadradas 1:1, margem externa em px, respiro percentual `#paddingInput`).
   - Sem rolagem horizontal nos monitores 1440×900 e 1280×800 (`scrollWidth <= clientWidth`).

2. **Barra Lateral Esquerda (`#left-toolbar` — Ferramentas e Ações)**:
   - Organizada em duas colunas funcionais contendo:
     - **7 Ferramentas**: Inspecionar (`V`), Pincel (`B`), Girar (`R`), Carimbo/Clonar (`S`), Travar Subtiles (`F`), Pan (`H`) e Zoom (`Z`).
     - **Guias Visuais**: 4 toggles (`toggleGuideAxes`, `toggleGuideBlocks`, `toggleGuideSubtiles`, `toggleGuideOrbits`) com estado `aria-pressed`.
     - **Controle de Cores**: Widget estilo Adobe Illustrator (`.color-tool-section`) com swatches sobrepostos de Primeiro Plano (`#fgColorPicker`) e Fundo (`#bgColorPicker`) e botão de inversão rápida (`#btnSwapColors`, tecla `X`).
     - **Gerador e Semente**: Botão de sorteio aleatório (`#btnRandomize`, tecla `G`), campo numérico de seed (`#seedInput`), navegação de sementes (`#btnPrevSeed`, `#btnNextSeed`) e lista permanente de histórico recente (`#seedHistoryList`).
     - **Exportação**: Seletor de formato PNG/SVG (`#exportFormatSelect`) e botão de download (`#btnExport`).

3. **Área Central e Viewport (`#workspace-viewport` / `#canvas-stage`)**:
   - Artboard do mosaico centrado sobre o pasteboard escuro.
   - Pan 2D contínuo via CSS transforms (sem re-renderizar primitivas geométricas) operável via ferramenta Pan (`H`), arrasto com botão do meio, `Espaço + Arrasto` ou `Alt + Arrasto`.
   - Zoom centrado na janela ou sob o cursor (Ctrl + Roda do mouse) com limites de 25% a 400%.
   - Teclas `1`, `Shift+1` e `Ctrl+1` recentralizam o canvas e fixam zoom em 100%; tecla `0` ajusta o artboard à janela visível. Roda do mouse livre redimensiona o tamanho do pincel.

4. **Barra Inferior de Status (`#status-bar` — A Visão e Saída)**:
   - Zona esquerda: Grupo de zoom integrado (`.zoom-widget`) com `[−] [100% ▾] [+] [Ajustar] [1:1]`.
   - Zona central: Dimensões em pixels, contagem de grade/órbitas e Inspetor de Hover com reticências automáticas (`text-overflow: ellipsis`) em viewports compactas.
   - Zona direita: Streaming Spout em tempo real (`#spoutToggle`, `#spoutName`), indicador de status de conexão e botão de Central de Ajuda (`#btnHelp` / `?`).

5. **Dock Lateral Direito (`#right-dock` — Painel Contextual Dinâmico)**:
   - Adapta-se automaticamente à ferramenta ativa no estúdio (`inspect` abre o painel de Geração; `paint` exibe opções de Pincel, Supertile e paleta; `rotate` exibe opções de rotação; `stamp` exibe opções de captura/carimbo; `freeze` exibe opções de trava de subtiles).
   - Botão de alternância de gaveta (`#btnToggleRightDock`, `«` expandido, `»` recolhido, `aria-expanded`). Quando recolhido (`body.right-dock-collapsed`), comprime-se em régua de 44 px liberando ~306 px para o canvas.

---

## 6. Divulgação Progressiva de Informações (`ui_info.js`)

O sistema adota o padrão de Progressive Disclosure para manter a interface desobstruída e visualmente limpa:
- **`INFO_TOPICS`**: Dicionário contendo os 13 tópicos técnicos e explicativos (Grid, Bloco, Escopos, Centro, Pincel, Girar, Carimbo, Trava, Mesmo Tile, D4 Estrito, Caleidoscópio, Persistência, Atalhos, Inspecionar).
- **Popover Não-Modal (`#infoPopover`)**: Componente flutuante singleton reposicionado dinamicamente com foco acessível e fechamento ao clicar fora ou via tecla Escape.
- **Floating Tooltip (`#uiTooltip`)**: Dica rápida acionada via atributo `data-tooltip`.
- **Botões `ⓘ` e `?`**: Disparadores contextuais que conectam elementos visuais aos tópicos sem exibir textos extensos permanentes.

---

## 7. Persistência de Estado e Snapshots (`core/state_persistence.js` e `core/document_snapshot.js`)

A persistência do estúdio opera em arquitetura híbrida de duas camadas:

### 1. Camada Primária: IndexedDB (`TilingStripesDB_v1`)
- Opera de forma assíncrona com capacidade ampla de armazenamento.
- Armazena histórico rico de até 256 gerações (`IDB_MAX_GENERATION_HISTORY`) e até 100 etapas de desfazer/refazer edições (`IDB_MAX_EDIT_HISTORY`).
- Funções exportadas: `openIndexedDB`, `saveToIndexedDB`, `loadFromIndexedDB`, `migrateLocalStorageToIndexedDB`, `shouldPreferIndexedDB`, `resolveBootState` (garante que estados mais ricos/recentes no IndexedDB nunca sejam sobrescritos por caches truncados no boot).

### 2. Camada Secundária de Boot: `localStorage` (`tiling_stripes_studio_v3_state`)
- Cache síncrono para inicialização imediata e recuperação sem travamento.
- Funções puras exportadas de `core/state_persistence.js`:
  - `isQuotaError(err)`: Detecta falhas de cota de armazenamento no browser.
  - `saveWithQuotaFallback(storage, key, fullPayload, fallbackPayload)`: Mecanismo de persistência em duas etapas que previne perda de dados em caso de quota esgotada.
  - `trimHistoryOnPush(array, limit)`: Garante que arrays de histórico nunca ultrapassem a capacidade máxima permitida.
  - `getMaxEditHistoryForMosaic(mosaic)`: Calcula o orçamento dinâmico de snapshots conforme o tamanho da grade.
  - `migratePayloadHistories(payload, maxGen, maxEdit)`: Valida e corrige payloads carregados de versões antigas do storage.
  - `buildMinimalEmergencyPayload(state)`: Monta payload de contingência contendo apenas o estado visual atual do mosaico.
  - `createSaveScheduler(options)`: Agendador de salvamento com debounce de 300 ms para ações contínuas.
  - `validatePayloadVersion(payload)`: Validador semântico de integridade e versão do schema salvo (versão 3).

### 3. Snapshots de Documento (`core/document_snapshot.js`)
- `collectParams(state)`: Coleta parâmetros macro do documento (seed, linhas, colunas, subdivisão, simetrias, margem, respiro e tiles permitidos).
- `attachDocument(cellsSnapshot, documentParams)`: Vincula o registro de parâmetros ao snapshot de células.
- Permite que o comando `Ctrl+Z` / `Ctrl+Y` atravesse regenerações destrutivas mantendo o estado de parâmetros sincronizado com as células.

---

## 8. Saída em Tempo Real via Spout (`core/spout_output.js` e `tools/spout_bridge.py`)

Para integração com softwares de VJ e projeção visual (Resolume Arena, TouchDesigner, MadMapper, OBS Studio):
- O estúdio renderiza um buffer `p5.Graphics` offscreen exclusivo no tamanho nativo do artboard (sem zoom de tela, sem guias de alinhamento e sem cursor de hover).
- `core/spout_output.js` calcula a assinatura de arte limpa (`artifactSignature`) e descarta frames inalterados, transmitindo pela porta WebSocket local `ws://127.0.0.1:8766` a até 20 fps.
- O utilitário `tools/spout_bridge.py` recebe os bytes RGBA do WebSocket e os publica diretamente na GPU através da API SpoutGL (DirectX/OpenGL).
- Script de inicialização com 1 clique: `tools/spout_bridge.cmd` (com teste de saúde `/health`).

---

## 9. Como Rodar e Testar

### Servidor Local
```powershell
# Python 3
python -m http.server 8765

# Ou via Node.js
npx serve -l 8765
```

### Execução de Todas as 44 Suítes Automatizadas
```powershell
node tests/run_all.js
```

As 44 suítes cobrem:
1. Álgebra D4 e axiomas de grupo (`test_tile_registry.js`, `test_d4_invariance.js`, `test_d4_block_combinations.js`, `test_d4_editor.js`, `test_d4_badge_state.js`).
2. Motor de mosaico e renderização vetorial (`test_mosaic_engine.js`).
3. Persistência de estado híbrida, IndexedDB, quotas e limites (`test_state_persistence.js`, `test_indexeddb_persistence.js`, `test_save_scheduler.js`, `test_storage_key.js`, `test_payload_version.js`, `test_history_limits.js`, `test_persistence_quota.js`, `test_history_nav.js`, `test_history_edit_preservation.js`, `test_document_snapshot.js`, `test_regeneration_capture.js`, `test_multistep_undo.js`, `test_dirty_guard.js`).
4. UI, acessibilidade, navegação e contratos estruturais (`test_scope_chip.js`, `test_info_scopes_source.js`, `test_info_aria.js`, `test_editor_ui_state.js`, `test_info_ui_state.js`, `test_viewport_pan_zoom.js`, `test_brush_sizing_snap.js`, `test_ui_control_registry.js`, `test_ui_layout_contract.js`).
5. Consistência e fidelidade da documentação (`test_docs_consistency.js`).
6. Sistema de trava de subtiles e persistência sob regeneração (`test_freeze_subtiles.js`, `test_freeze_generation.js`, `test_freeze_wiring.js`, `test_freeze_state.js`, `test_freeze_undo.js`, `test_freeze_ui_contract.js`).
7. Pipeline Spout, WebSocket bridge e exportação SVG avançada (`test_spout_output.js`, `test_simple_svg_paths.js`).
8. Motor vetorial de subtiles, detecção $D_4$, compilador JSON, CRUD de biblioteca, contrato de UI e operações interativas do Editor Vetorial (`test_vector_renderer.js`, `test_d4_detect.js`, `test_library_compiler.js`, `test_library_store_crud.js`, `test_tile_studio_ui_contract.js`, `test_vector_editor_ops.js`, `test_vector_boolean_svg.js`).

---

## 10. Informações de Legado

Arquivos anteriores da versão 1 (`subtile.js`, `tiles.js`, `supertile.js`, `svg_tile_manager.js`, `tile_transforms.js`) foram arquivados na pasta `_legacy/` para fins históricos e de referência. Não devem ser alterados nem carregados no runtime do estúdio atual.

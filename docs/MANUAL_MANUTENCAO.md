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
   - Pan 2D contínuo via CSS transforms (sem re-renderizar primitivas geométricas) operável via ferramenta Pan (`H`), arrasto com botão do meio, `Espaço + Arrasto`.
   - Zoom centrado na janela ou sob o cursor (Ctrl + Roda do mouse) com limites de 25% a 400%.
   - Teclas `1`, `Shift+1` e `Ctrl+1` recentralizam o canvas e fixam zoom em 100%; tecla `0` ajusta o artboard à janela visível. Roda do mouse livre redimensiona o tamanho do pincel.

4. **Barra Inferior de Status (`#status-bar` — A Visão e Saída)**:
   - Zona esquerda: Grupo de zoom integrado (`.zoom-widget`) com `[−] [100% ▾] [+] [Ajustar] [1:1]`.
   - Zona central: Dimensões em pixels, contagem de grade/órbitas e Inspetor de Hover com reticências automáticas (`text-overflow: ellipsis`) em viewports compactas.
   - Zona direita: Streaming Spout em tempo real (`#spoutToggle`, `#spoutName`), indicador de status de conexão e botão de Central de Ajuda (`#btnHelp` / `?`).

5. **Dock Lateral Direito (`#right-dock` — Painel Contextual Dinâmico)**:
   - Adapta-se automaticamente à ferramenta ativa no estúdio (`inspect` abre o painel de Geração; `paint` exibe opções de Pincel, Supertile e paleta; `rotate` exibe opções de rotação; `stamp` exibe opções de captura/carimbo; `freeze` exibe opções de trava de subtiles).
   - Botão de alternância de gaveta (`#btnToggleRightDock`, `»` expandido, `«` recolhido, `aria-expanded`). Quando recolhido (`body.right-dock-collapsed`), comprime-se em régua de 44 px liberando ~306 px para o canvas.

---

## 6. Divulgação Progressiva de Informações (`ui_info.js`)

O sistema adota o padrão de Progressive Disclosure para manter a interface desobstruída e visualmente limpa:
- **`INFO_TOPICS`**: Dicionário contendo os 17 tópicos técnicos e explicativos (Grid, Bloco, Escopos, Centro, Pincel, Girar, Carimbo, Trava, Mesmo Tile, D4 Estrito, Caleidoscópio, Persistência, Atalhos, Inspecionar).
- **Popover Não-Modal (`#infoPopover`)**: Componente flutuante singleton reposicionado dinamicamente com foco acessível e fechamento ao clicar fora ou via tecla Escape.
- **Floating Tooltip (`#uiTooltip`)**: Dica rápida acionada via atributo `data-tooltip`.
- **Botões `ⓘ` e `?`**: Disparadores contextuais que conectam elementos visuais aos tópicos sem exibir textos extensos permanentes.

---

## 7. Persistência de Estado e Snapshots (`core/state_persistence.js` e `core/document_snapshot.js`)

A persistência do estúdio opera em arquitetura híbrida de duas camadas:

### 1. Camada Primária: IndexedDB (`TilingStripesDB_v1`)
- Opera de forma assíncrona com capacidade ampla de armazenamento.
- Armazena histórico rico de até 256 gerações (`IDB_MAX_GENERATION_HISTORY`) e até 256 etapas de desfazer/refazer edições (`IDB_MAX_EDIT_HISTORY`).
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
- `collectParams(state)`: Coleta parâmetros do documento (seed, linhas, colunas, subdivisão, simetrias, margem, respiro, tiles permitidos, largura/altura e cores). Campos ausentes são opcionais: `applyParams` conserva os valores atuais ao restaurar snapshots antigos.
- `attachDocument(cellsSnapshot, documentParams)`: Vincula o registro de parâmetros ao snapshot de células.
- `Ctrl+Z` / `Ctrl+Shift+Z` atravessa gerações e edições mantendo células, preservações, parâmetros, campos e tamanho do canvas sincronizados.
- `beginDocumentEdit` captura antes do primeiro evento de aparência; `commitDocumentEdit` confirma no `change`/`blur`, inclusive ao sair da página, e `cancelDocumentEdit` restaura com Escape. Preview de cor, margem ou espaçamento não cria uma etapa por evento. No-op/cancelamento preserva redo; edição real o invalida.
- Dimensões da prancheta, troca de cores (`X`) e cada gesto de pintura entram no mesmo histórico, respeitando os limites existentes. Alterar largura/altura não regenera células. Navegação, zoom, filtros e foco ficam fora do histórico do documento. O botão de recorte `clipToTile` já grava/restaura no histórico da família, independente do mosaico.
- Regressões comportamentais em `test_document_edit_transactions.js`: handlers reais, 30 eventos em uma etapa, cancelamento/no-op, aparência seguida de pintura/geração, campos/canvas, dados antigos e botão de recorte com undo/redo.

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

## Correções da revisão do Subtile Studio (27/10/2026)

O dock de Subtiles permite rolagem vertical do conjunto; a biblioteca tem uma lista de 280 px e os grupos não encolhem. Selecionar uma ferramenta vetorial encerra Pan/Zoom; sair do Estúdio restaura a ferramenta anterior do mosaico. A seleção e as sessões temporárias são limpas ao trocar de família.

SVG unitário usa margem zero por padrão, independente do respiro do mosaico. Famílias e camadas aceitam Enter/Espaço; os modais retêm Tab/Shift+Tab e restauram o foco. A importação começa em Mesclar, pede confirmação adicional para Substituir e baixa backup JSON antes de importar/restaurar. Isolar usa a proteção de documento alterado. Miniaturas são reutilizadas enquanto a geometria da família permanece igual.

Persistência canônica: `tiling_stripes_studio_v3_state`, IndexedDB `TilingStripesDB_v1` / `studio_state`. Os dados da chave e do banco antigos continuam legíveis e não são apagados pela migração.

Graphify: `.\venv\Scripts\python.exe -m graphify query "símbolo"`. Sincronização: `scripts/sync_knowledge.ps1`. Abra `_local/obsidian_vault` como vault no Obsidian e use `INICIO_WORKSPACE.md`; o grafo AST e suas notas são artefatos locais ignorados pelo Git. A suíte agora reúne 45 testes; os 60 controles congelados pertencem ao contrato original do mosaico, não ao total de elementos do novo Estúdio.

O botão **Editar peças** fica na grade de ferramentas da barra esquerda. Ao abrir o criador, ele muda para **Voltar ao mosaico**, seguido pelas ferramentas vetoriais. Propriedades, camadas, órbita D4 e biblioteca continuam no dock direito. O atalho `Ctrl+E` alterna os modos.

As ferramentas do mosaico usam pares de mesma largura: Inspecionar/Subtiles, Pintar/Girar, Carimbo/Travar e Pan/Zoom. Na edição, grades e eixos globais aparecem apenas pelos botões de Guias Visuais; a prévia mantém a geometria fantasma e o contorno da área de ação, sem uma malha automática sobre as réplicas simétricas.

Tamanhos de Pintar/Carimbo, Girar e Travar usam o padrão **− | tamanho | +**, também acessível por `−`/`+` no teclado e roda do mouse sobre o canvas. Os tamanhos param nos limites, sem voltar ao início; botões indisponíveis ficam desativados. Girar e pintar alcançam a dimensão máxima do mosaico; Travar respeita o tamanho de um bloco. No pincel com ajuste ao bloco, o passo é um bloco. A indicação `linhas × colunas` preserva o tamanho real de carimbos retangulares. Os atalhos dos escopos são `Q`/`Tab`, com `Shift` para voltar.

A barra esquerda recolhe **Geração e histórico** por padrão; no criador de subtiles, Biblioteca, Arquivos SVG e Backup também ficam em grupos expansíveis. O histórico começa recolhido e tem altura limitada quando aberto. Os tamanhos de Girar e Travar têm apenas o controle − / medida / + e um botão independente para ajustar ao bloco; não há uma segunda linha de presets numéricos.

A prévia de Girar destaca todas as células alcançadas pelo escopo ativo, usando os mesmos alvos da operação. O contorno ciano delimita as regiões afetadas e o âmbar marca a origem. As bordas internas entre células vizinhas não são desenhadas, preservando a ausência de grade automática.

Girar opera sobre o conteúdo atual de cada região afetada pelo escopo. Réplicas simétricas leem suas próprias células editadas, em vez de receber uma cópia da região de origem. A direção do giro respeita os espelhamentos D4. Sobreposições só aplicam ciclos completos de movimentação de células para preservar o conteúdo; a prévia usa os mesmos alvos da operação. Pintar e Carimbo mantêm sua semântica de aplicação de um padrão.

O botão **Ampliar editor** abre um popup com canvas maior e paleta lado a lado; os mesmos controles do dock são movidos para ele, sem cópias independentes. O editor trabalha ao vivo; **Concluir** mantém as alterações; **Cancelar** ou `Esc` restaura o pincel da abertura e retorna ao dock. Clique/arraste pinta células e o botão direito gira a célula, inclusive em 1×1. A roda sobre o canvas ampliado e `−`/`+` seguem o mesmo controle de tamanho do mosaico.

**Clone:** `S` restaura a captura anterior; sem captura, entra automaticamente em Capturar. O gesto **Alt + clique/arraste** permite recapturar, seguido de aplicação com clique normal. `C` continua como alternativa para iniciar captura. Arraste e solte para capturar; a ferramenta passa automaticamente a aplicar. Clique/arraste aplica e botão direito gira o clone. `Esc` ou botão direito durante a captura cancela sem substituir o clone anterior. Capturas com ajuste ao bloco funcionam em qualquer direção de arrasto. Pincel e clone conservam padrões independentes durante a sessão; trocar ferramenta encerra o gesto anterior. Os dois padrões são salvos separadamente no campo opcional `brushToolSessions` do payload v3 e restaurados após recarregar.

**Cursores:** captura usa mira; aplicar clone usa cópia; Girar usa seta circular com ponto de ação; Borracha usa célula; Pan/Espaço usam mão aberta e fechada durante o arrasto; Zoom com Alt indica afastamento. Navegação tem prioridade sobre os cursores vetoriais. Combinações sem aplicação válida no escopo Iguais usam cursor de ação indisponível.

Capturar uma região com Alt também entra na sessão de Clone antes de substituir o padrão ativo. Voltar a Pintar recupera seu tile, orientação, tamanho e ajuste ao bloco. Saves antigos sem um pincel separado retomam um pincel normal 1×1 (#2), preservando a região capturada na ferramenta Clone.

O editor ampliado permite definir **Linhas e Colunas** separadamente, escolher o tile da paleta sem preencher o padrão inteiro, pintar/apagar células e desfazer/refazer com `Ctrl+Z`/`Ctrl+Shift+Z`. Redimensionar preserva as células existentes e cria células vazias. Limpar grade pode ser desfeito; Cancelar/Esc restaura o padrão anterior à abertura. No Clone sem captura, a ferramenta entra em Capturar automaticamente: arraste com o botão esquerdo para capturar. Depois da captura, o clique normal aplica; Alt+arraste ou C permitem recapturar.


### Criador de subtiles — seleção e organização dos painéis

O criador abre na visualização **1×1 Mestre**, com mais espaço para desenhar. O painel contextual usa abas **Camadas**, **Propriedades**, **Biblioteca** e **Variantes**, com navegação pelas setas do teclado. A aba Camadas apresenta a pilha de objetos da família, da frente para o fundo: marque caixas para selecionar vários objetos, arraste linhas para reordenar, dê duplo clique no nome para renomear e use os controles de visibilidade e bloqueio. São objetos empilhados da família; não há grupos de camadas aninhados.

No canvas, **V** ativa Seleção; **Shift+clique** adiciona ou remove um objeto, **arrastar no vazio** seleciona por área e **Shift+arrastar no vazio** acrescenta à seleção existente. **Todos / Ctrl+A** seleciona os objetos visíveis e destravados. O Pathfinder fica acima das abas Camadas e Propriedades e habilita Unir, Subtrair, Interseção e Excluir com dois ou mais objetos elegíveis. A seleção permanece ao trocar de aba; **Ctrl+Z** desfaz edições e booleanas.

Na Biblioteca, **conjunto** é o nome de interface para os grupos de famílias existentes no modelo de dados. Há busca, filtros Todos / Meus subtiles / Padrão, filtro por conjunto, Expandir/Recolher e Localizar atual. Os metadados da família selecionada ficam junto da biblioteca. Cada família reúne um mestre e suas variantes D4; mover uma família para outro conjunto preserva suas variantes. Os formatos de persistência e os IDs canônicos 0–84 permanecem iguais.

### Criador de subtiles — Navegação, Grade e Guias

A barra esquerda do Criador de Subtiles separa claramente **Navegação** (`Pan (H)` e `Zoom (Z)`) de **Grade & Guias** (`Ímã`, seletor de divisão, `Grade`, `Eixos D4`, `Portas` e `Margem`). O botão redundante 1:1 foi removido, pois o status bar e o atalho `1` já centralizam em 100%.

No modo de Subtiles, a **rodinha do mouse (scroll) sem modificadores realiza Zoom direto**, permitindo navegar e inspecionar detalhes com agilidade sem exigir `Ctrl`. O scroll com `Shift` faz pan horizontal, com `Alt` faz pan vertical, e segurar `Espaço` ou ativar a ferramenta Pan executa arrasto 2D irrestrito. Clicar no canvas com a ferramenta Zoom ativa executa zoom (+25% no clique normal, −25% com Alt ou botão direito).

A **Grade fracionária** exibe divisões uniformes correspondentes ao seletor (com divisão visual padrão 1/6 quando o ímã estiver em *Off*), desenha a linha de centro mesmo sem eixos D4 ativos e inclui o contorno nítido da área ativa. As linhas de fita em $\pm 1/6$ pertencem estritamente ao botão **Portas**, não poluindo grades binárias (1/4, 1/8, 1/16). O snap magnético em grades que não são múltiplos de 3 só atrai para portas quando o botão Portas estiver explicitamente ativado.


A exclusão de uma família pede apenas a confirmação da ação e informa seu uso; não baixa backup automaticamente nem limpa o histórico vetorial das outras famílias. Exportar a biblioteca continua disponível quando desejado. Referências à família excluída continuam sendo convertidas para o Tile Vazio (#84). A guia visual **Subtiles** usa ciano com a mesma espessura e opacidade dos limites de blocos (1,5 px; alfa 165/255), sem contorno adicional; a guia Blocos usa lilás para diferenciar as escalas; continua opcional e não aparece nas exportações nem na saída Spout.


O botão **Backup da biblioteca** fica sempre acessível na barra esquerda, tanto no mosaico como no criador. Na confirmação de exclusão de família, a opção **Baixar backup da biblioteca antes de excluir (.json)** começa desmarcada; marque-a para baixar o estado anterior à exclusão. Cancelar não baixa backup nem exclui. Fazer backup não apaga o histórico de edição vetorial. O **Gerador** fica visível por padrão, e o cabeçalho **Histórico** permanece acessível logo abaixo, com sua lista recolhível.

Nos swatches do gerador, o cabeçalho de cada **conjunto** permite ativar/desativar todas as suas famílias, indica seleção parcial e mostra a contagem de tiles ativos. O botão **SOLO** do conjunto gera apenas com ele. A ação inclui o conjunto completo mesmo quando a busca exibe só parte das famílias.


A saída Spout acompanha os blocos realmente renderizados, incluindo mudanças de tile-base, transformações, cores, margem, padding, dimensões e revisão da biblioteca. Conectar antes de existir um mosaico mantém a atualização ativa; renomear o remetente reenvia também a imagem; redimensionar recria o buffer em resolução nativa. Sob congestionamento, quadros intermediários não são enfileirados: o próximo envio usa a edição mais recente. Conexões antigas não interrompem um remetente recém-conectado. O canvas dedicado permanece limpo, sem guias, zoom, pan, seleção, hover ou prévias de ferramentas.

### Roteamento de teclado e proteção de alterações (T02)

Diálogos modais bloqueiam comandos externos, mantêm o foco com Tab/Shift+Tab e o restauram ao fechar. X sem modificadores troca cores; Ctrl+X mantém sua função de edição de texto. Campos editáveis, composição de texto e eventos já consumidos não acionam o documento; comandos discretos não repetem ao manter a tecla pressionada.

Q cicla os seis escopos. Tab é alias somente com foco na área de trabalho e ferramenta de edição do mosaico; em controles ou no gerador, navega pelo foco. Escape no canvas cancela o gesto e retorna à ferramenta. Setas navegam gerações somente no canvas com Inspecionar. Shift inverte momentaneamente o encaixe.

Reduzir linhas, colunas ou subdivisão informa a quantidade de preservações fora da nova grade antes de aplicar; Cancelar conserva a topologia, e desfazer recupera a grade e as preservações anteriores. Nova semente mantém as preservações que cabem na grade.

### Borracha, pincel e carimbo (T03)

E ativa a borracha em Pintar, sem alterar a captura do carimbo. A paleta do construtor escolhe tinta: selecionar o Tile Vazio #84 no clone mantém Clonar e permite apagar células do padrão. Repetir E mantém a borracha; B ou o botão Pintar restaura o último pincel não vazio, incluindo padrão, tamanho e encaixe. S ou Clonar restaura a captura; sem captura, entra em Capturar automaticamente. Trocar de ferramenta encerra o gesto temporário, sem aplicar um traço ou captura na soltura residual. O dock e o indicador do padrão identificam Borracha. Salvar durante o apagamento conserva as sessões independentes do pincel e do carimbo no payload v3 existente. No editor ampliado, #84 continua sendo tinta vazia para apagar células individuais do padrão.

No construtor lateral, selecionar um tile em padrões maiores que 1×1 escolhe a tinta; clique/arraste na miniatura para alterar células individuais. Isso vale tanto para Pincel quanto para Clonar, inclusive com o tile vazio. Preencher continua sendo a ação explícita para preencher todo o padrão. Aumentar ou reduzir o tamanho conserva as células que cabem na nova grade. Em 1×1, a seleção da paleta atualiza diretamente a única célula; no editor ampliado, a paleta sempre escolhe tinta.

### Salvamento confirmado de mosaico e biblioteca (T04)

O status mostra **Salvando…**, **Salvo neste navegador**, **Desenho salvo; histórico reduzido** ou **Não foi possível salvar**. Documento e biblioteca têm revisões independentes: todos os escopos alterados precisam ter uma cópia íntegra confirmada para o status global ser Salvo. A existência de IndexedDB não equivale a uma gravação bem-sucedida. Cache local reduzido com IndexedDB íntegro não anuncia perda de histórico; sem cópia íntegra, o aviso informa quantas gerações e etapas de edição ficaram fora da cópia salva.

Falhas permanecem visíveis acima da área de trabalho, inclusive com o dock recolhido e no editor de peças. **Tentar salvar** reenvia o mosaico e a biblioteca alterada; o aviso só sai após confirmação. O backup JSON protege a biblioteca. Exportar PNG/SVG protege a imagem do mosaico, sem prometer um backup editável do projeto.

`core/save_status.js` acompanha resultados por revisão e serializa pedidos. Os escritores de IndexedDB também ordenam gravações por destino, copiam o payload antes de enfileirar, aguardam `transaction.oncomplete` e recusam sobrescrever um timestamp mais recente. Erro/abort da transação não confirma o pedido. A abertura restaura primeiro o documento persistido antes de salvar o canvas inicial; restauração atrasada não substitui edição feita depois de abrir. Chaves, schema v3, limites e funções puras de persistência permanecem compatíveis.

A suíte `tests/test_save_status.js` cobre a matriz dos dois armazenamentos, fallback reduzido, rejeições reais, falha da biblioteca com mosaico salvo, recuperação, getters bloqueados, abort após sucesso do pedido, ordem A/B com recarga de B e restauração tardia. A lista completa de testes vem de `tests/run_all.js`.

O histórico de undo/redo do mosaico, das famílias e do editor ampliado de pincel tem limite de 256 estados. A cópia de segurança em localStorage pode reduzir o histórico conforme o orçamento/quota; IndexedDB preserva até 256 estados de edição.


### Comandos compartilhados e contextos (T06)

`core/studio_commands.js` reúne nomes, atalhos, contexto, disponibilidade e execução das ações principais. Botões, teclado e ajuda usam o catálogo; os adaptadores em `sketch.js` e `core/subtile_studio_ui.js` fornecem as operações do ambiente. O catálogo deve ser carregado antes de `ui_info.js` e dos controladores. A suíte `test_studio_commands.js` valida os handlers reais e sua concordância com títulos e ajuda.

No editor de peças, **Ctrl+D duplica apenas formas selecionadas**. Sem seleção, o aviso pede selecionar formas; em peças protegidas, aponta para **Criar cópia editável**, ação explícita sem Ctrl+D. **Enter conclui a Caneta**; **Escape cancela Caneta/arrasto provisório ou limpa a seleção**, sem sair do editor nem criar undo. Trocar ferramenta conclui um caminho válido já solto; um arrasto em andamento é descartado. Ctrl+E e Voltar ao mosaico restauram a ferramenta e o padrão de pincel do mosaico. G continua Polígono e A continua Editar pontos no editor de peças.

Termos da interface: Prancheta, Espaçamento, Peças permitidas, Editar peças, Grade de peças, Bloco, Padrão de pincel, Semente, Carimbo, Preservar, Mão, Encaixe, Isolar e Recortar aos limites da peça. IDs internos, nomes de famílias e desenhos do usuário permanecem inalterados. No mosaico, Alt+arraste captura e Shift inverte temporariamente o encaixe; H/Espaço move a visualização. Undo/refazer indica seu alvo: mosaico, peça ou pincel.


### Sistema visual compartilhado (T07)

`style.css` define os papéis semânticos de painel, campo, hover, seleção, texto, borda funcional, foco, aviso e erro em `:root`. Botões/campos comuns usam 32 px, ações de lista têm alvo mínimo 28×28 px, texto funcional usa 12 px e valores numéricos usam 13 px. A barra esquerda usa 216 px; o rodapé ocupa toda a largura da aplicação e tem altura mínima de 36 px; a ordem das quatro superfícies permanece igual. Bordas decorativas podem ser discretas; controles essenciais usam `--border-control`. Foco é um contorno externo de 2 px, separado do preenchimento de seleção. Guias ligadas têm fundo neutro e marca lateral; o pasteboard não usa pontos.

A pele comum fica junto às regras base, com variantes junto ao componente. Evite reintroduzir tamanhos/cores concorrentes ao fim da folha. Nomes de papéis antigos não resolvidos foram substituídos; `--font-mono` está definido. `test_visual_tokens.js` verifica referências CSS e inline, contraste dos pares semânticos (texto ≥4,5:1; indicadores essenciais ≥3:1), escala e segurança dos ícones.

`UiFormat.icon` fornece SVGs de comando com viewBox 24×24, desenho de 16 px e traço de 1,75, escondidos da árvore acessível; seus botões mantêm nome por aria-label/título. Alinhamento, ordenação, cópia, edição, exclusão, undo/redo e controles pequenos usam essa família. Tooltips aceitam quebra de linha e limites da viewport, funcionam por foco/ponteiro e associam `aria-describedby` sem apagar descrições anteriores. Avisos e falhas mantêm texto e ações; a mudança de tema não altera as cores da obra, a matemática ou o formato salvo.

Correção da T07: dimensões de controles especiais são independentes da pele comum (Spout 40×24 px, marca informativa de 16 px dentro de alvo de 28 px). Campos conservam borda funcional; ações usam superfícies discretas e espaçamento interno. A barra superior quebra por grupos até 1400 px. Mensagens ficam dentro da área de trabalho, acima do rodapé. A ajuda separa mosaico/editor e ferramentas/ações, com corpo rolável e cabeçalho fixo.

Ajuda contextual: os tópicos usam títulos curtos e listas sem subtítulo técnico. Itens são filhos de uma lista semântica, com espaçamento e rolagem próprios; textos dos escopos continuam derivados de `MosaicEngine.EDIT_SCOPES`. Camadas e Biblioteca concentram instruções nos popups para evitar repetições permanentes nos painéis.

### Campos acessíveis e edição numérica (T08)

`core/ui_fields.js` associa os rótulos das propriedades a IDs estáveis e fornece nomes completos com unidades (pixels, porcentagem, graus ou unidades da peça). Os IDs legados são preservados. A regra final de foco mantém o contorno visível nos próprios campos, sem duplicá-lo no contêiner.

Enter confirma um número válido; Escape restaura o valor anterior e cancela a prévia de margem/espaçamento sem criar undo. Valores vazios, não finitos, inteiros inválidos e valores fora dos limites do controle são bloqueados antes dos handlers do documento. O erro recebe `aria-invalid` e descrição acessível; sair de um campo inválido cancela o rascunho. O atributo step continua sendo incremento, permitindo por exemplo largura de 900 px com passo de 50.

As três buscas (gerador, pincel e biblioteca) têm nome independente do placeholder, botão Limpar que retorna o foco ao campo e contador de resultados anunciado. O contador respeita os filtros existentes; não redefine a seleção de peças nem os atalhos do canvas. Os testes ficam em `tests/test_ui_fields.js`.

Ajuste de densidade após T08: a busca ocupa uma linha, com limpeza por × apenas quando há texto. A contagem permanece anunciada, mas não ocupa uma linha visual; busca vazia de resultados mostra “Nenhum resultado”. Dicas de tamanho/encaixe ficam na ajuda. Guias ligadas mantêm a marca lateral sem borda adicional. Alinhar/transformar exige seleção; Combinar formas aparece com duas ou mais formas elegíveis. Rótulos completos, foco e validação numérica são preservados; erros exibem somente a mensagem necessária.

### Gerador por composição e famílias (T09)

A simetria da composição mantém os quatro modos existentes. A simetria do bloco fica em “Igual à composição” em documentos novos; Acionar esse controle revela os modos independentes. Ao restaurar documento independente, o modo salvo é apresentado e a lista fica aberta. Abrir/fechar a lista não altera o documento. Os botões 2×2, 4×4, 6×6 e 8×8 representam o bloco completo; `data-sub` continua de 1 a 4 por quadrante.

Peças permitidas mostra famílias com miniatura, contador e seleção total/parcial/vazia. Variantes ficam sob expansão; buscar revela as correspondências e limpar restaura a expansão manual. Isolar família/conjunto oferece Restaurar seleção; alternar entre isolamentos conserva a seleção inicial. Uma alteração manual invalida o isolamento anterior. Todos/Nenhum/Inverter mantêm o alcance de toda a biblioteca, inclusive itens ocultos pela busca (informado no título dos controles). Gerar e semente permanecem à esquerda. Estado de expansão e isolamento é temporário; não altera o schema v3.

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

### Modo de Geração por Encaixe de Bordas (`#toggleEdgeMatch`)

O interruptor **Bordas** (ícone `edgeJoin`) no painel Simetria & Estrutura ativa um modo de geração alternativo; o nome completo `Encaixe por bordas` aparece no hover e a explicação vive no tópico `edge-match` do popover de info. Logo abaixo, o controle **Variedade** (ícone `variability`, 0–100%, padrão 30%) é a temperatura do encaixe: 0% preserva a busca estritamente fiel à emenda e 100% prioriza peças diferentes, aceitando emendas mais soltas. O controle fica desabilitado quando **Bordas** está desligado. Antes de montar o mosaico, `core/tile_edge_signatures.js` pré-processa cada tile do catálogo:

- Amostra as quatro bordas logo dentro do quadrado do subtile e produz uma máscara binária de tinta/fundo.
- Converte a máscara em intervalos normalizados de preenchimento e de fundo.
- Rotula as componentes conectadas de tinta e de fundo e registra quais lados cada região toca (`F:LR`, `B:T`, etc.).
- Deriva um ID estável por lado a partir do padrão de intervalos e das regiões conectadas (`fillId`, `bgId` e `id`).
- Remapeia a assinatura por qualquer transformação D4, sem rasterizar novamente.

A geração (`generateEdgeMatchedMosaic`) mantém a hierarquia e as órbitas D4: só as células canônicas dos blocos-fonte são escolhidas; todas as demais continuam sendo imagens D4. A escolha inicial é aleatória, como no modo clássico, e depois uma busca local (duas passadas por padrão) maximiza a soma das notas de encaixe entre lados vizinhos. A nota dá peso aos dois canais — 60% tinta e 40% fundo — e mede a sobreposição da região menor, então uma fita fina pode continuar numa mais larga sem exigir coberturas iguais. Emendas saturadas são limitadas: dois lados totalmente brancos valem 0,55 (não formam massa), branco contra vazio vale 0,70 (contraste), dois lados vazios valem 0,40 (espaço negativo), e o tile vazio #84 vale no máximo 0,20 e não se propaga. Um encaixe imperfeito é aceito, mas vale menos. Células congeladas são restrições fixas e bloqueiam a órbita canônica correspondente. O modo não altera o schema de persistência: `edgeMatch` (booleano) e `edgeVariability` (0..1) são campos do payload v3 e dos snapshots de documento.

Com `edgeVariability > 0`, cada variável canônica não escolhe mais apenas o melhor encaixe. O motor abre uma janela de perda de encaixe proporcional à temperatura (`variabilidade × nº de arestas afetadas × 0,5`), mantém nessa janela os candidatos ainda aceitáveis e, entre eles, prefere o tile menos repetido. A novidade cai com o número de variáveis canônicas que já usam aquele tile (`1 / (1 + usos)`) e com a presença dele nos vizinhos imediatos (até 50% de desconto), então subir o controle cria pressão real por peças diferentes. Com 0% o caminho é exatamente o guloso anterior; com 100% a variedade domina o encaixe. A escolha continua restrita aos tiles compatíveis com o estabilizador de cada célula, então D4 e células congeladas permanecem intactos.

O caminho interno evita trabalho repetido: perfis orientados e pontuações de par ficam em cache (invalidado por `libraryRevision`), candidatos são pré-filtrados por igualdade exata de máscara e proximidade de cobertura antes da pontuação completa, e a segunda passada visita apenas variáveis vizinhas de células que mudaram. `edgeMatchCandidateLimit` permite fixar o tamanho do pré-filtro; sem ele, o limite automático é 20 (16 em grades com mais de 1000 subtiles), sobe para 32 quando nenhum candidato tem encaixe exato e cresce até +16 conforme a variabilidade aumenta.

---

## 3. Motor Vetorial JSON e Catálogo de Tiles (`core/tile_library.js`, `core/library_compiler.js`, `core/library_store.js`, `core/tile_registry.js` e `core/tile_edge_signatures.js`)

O catálogo vetorial é compilado deterministicamente a partir de mestres JSON normalizados em `[-0.5, 0.5]^2`:
- **85 subtiles built-in canônicos** (`TILE_RENDERERS`, indexados de `0` a `84`) gerados a partir das **31 famílias built-in** em **6 grupos** (`TILE_FAMILIES_META`), seguidos dinamicamente por famílias customizadas (`>= 85`).
- **Detecção automática de simetria $D_4$ (`core/d4_detect.js`)**: Classifica qualquer mestre em um dos 10 subgrupos estabilizadores de $D_4$, gerando `1`, `2`, `4` ou `8` variantes e preenchendo `TILE_D4_MAP` com fechamento algébrico exato.
- **Mutação in-place e `libraryRevision`**: `TileRegistry` sincroniza `TILE_RENDERERS`, `TILE_NAMES`, `TILE_FAMILIES_META` e `TILE_D4_MAP` in-place, expõe `getOrderedGroupedFamilies()` respeitando `LibraryStore.getGroups()` e `uiOrder`, e incrementa `libraryRevision` (integrado ao `artifactSignature` do Spout).
- **Assinaturas de borda (`core/tile_edge_signatures.js`)**: `getTileProfile(tileId)` grava a geometria do renderer num recorder afim (formas, furos, traços e curvas), amostra as quatro bordas e calcula máscara, intervalos, regiões conectadas e IDs. `getOrientedProfile(tileId, transform)` remapeia a assinatura por D4. O cache é invalidado quando `TileRegistry.libraryRevision` muda, então tiles customizados também recebem IDs atualizados. `scoreSide(a, b)` devolve uma nota 0..1 com IoU rígido e suave, balanceando tinta (60%) e fundo (40%) e limitando emendas saturadas; `edgeVariability` abre a janela de variedade descrita adiante.
- **Modo Estúdio de Subtiles e Editor Vetorial (`core/vector_editor.js` e `core/subtile_studio_ui.js`)**: Alterna `body[data-studio-mode="mosaic|tiles"]` (`Ctrl+E`) sem violar a hierarquia das cinco superfícies nem os 60 controles congelados, oferecendo 8 ferramentas vetoriais interativas (`select`, `direct`, `pen`, `rect`, `ellipse`, `polygon`, `arc`, `line`), grade magnética (`0..16`), subdivisão De Casteljau, *undo/redo* por família, árvore *Drag-and-Drop* de grupos/famílias, preview de vizinhos (`1×1`, `3×3`, `mandala_d4`, `rotational_c4`), auto-matrícula de novos IDs em `allowedTiles` e sanitização *tombstone* $\to$ `#84`.

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

### Geração Clássica e Geração por Encaixe

`generateMosaic(config, randomPick, frozenCells)` escolhe o caminho clássico ou o modo de encaixe quando `config.edgeMatch === true`. O caminho clássico sorteia cada célula canônica. `generateEdgeMatchedMosaic` monta o mesmo grafo de blocos e órbitas, mas trata as células canônicas como variáveis:

1. Sorteia uma atribuição inicial dentro dos tiles compatíveis com o estabilizador de cada célula.
2. Constrói a grade real de subtiles, incluindo as posições deslocadas pelas transformações de bloco.
3. Calcula a nota de cada aresta entre vizinhos com `TileEdgeSignatures.scoreSide`.
4. Faz busca local nas variáveis. Sem variabilidade, aceita apenas melhorias (e desempates na primeira passada). Com `edgeVariability > 0`, abre a janela de encaixe descrita acima e escolhe, dentro dela, a peça menos repetida; a semente continua determinando os empates.
5. Materializa `grid`/`blocks` com `transformBlock`, aplica células congeladas e calcula `edgeMatchStats` (`edges`, `average`, `perfect`, `fillPairs`).

Como apenas as células canônicas mudam, `isMosaicD4Invariant` continua verdadeiro para mandala, caleidoscópio, rotacional e bilateral. Células congeladas são aplicadas antes da busca e bloqueiam sua órbita.

### Escopos de Edição
- `canvas_center`: Propaga globalmente em torno do centro do artboard. Requer que células nos eixos obedeçam aos estabilizadores da simetria do centro.
- `orbit_sym`: Combina a simetria do bloco com a órbita macro da grade.
- `block_sym`: Propaga exclusivamente nos 4 quadrantes internos do bloco clicado.
- `all_blocks`: Propaga para todos os blocos mantendo a rotação macro de cada um.
- `single`: Modo pontual livre; permite aplicar qualquer tile na célula sob o cursor sem propagação.
- `same_tile`: Substituição global de todas as ocorrências de um tile. Opera exclusivamente no tamanho 1×1 (tamanhos maiores exibem `#sameTileNotice` e aviso no editor).

---

## 5. Arquitetura de UI — As Cinco Superfícies

A interface adota a taxonomia de cinco superfícies estritas com responsabilidades dedicadas e layout responsivo testado em 1280×800 e 1440×900:

1. **Barra Superior (`#top-control-bar` — Control Bar Contextual)**:
   - Segue o modelo do Illustrator: `#topToolContext` mostra o ícone e o nome da ferramenta ativa; o restante da barra pertence a ela.
   - **Pincel / Carimbo**: `#brushSizeControl` (tamanho, encaixe em bloco) e `#btnExpandBrushEditor`; a paleta e o construtor ficam em `#panel-edit-brush`, no dock.
   - **Girar / Espelhar**: `#rotateToolOptionsWrap` com área, ajuste ao bloco, modo Conjunto/Individual e Tipo (Giro 90°/Família).
   - **Preservar**: `#freezeToolOptionsWrap` com ação Preservar/Liberar, tamanho, contagem e `#btnFreezeClearSelection`.
   - **Seleção de região**: `#selectionSummary` com área, peças e limpar, exibido no modo mover do Carimbo.
   - Inspeção, Mão e Zoom não têm opções próprias: a barra mostra apenas a identidade da ferramenta.
   - Nenhum controle de documento fica no topo; Prancheta e Grade vivem em `#panel-document`, no dock direito. A barra quebra em mais de uma linha abaixo de 1400 px.

2. **Barra Lateral Esquerda (`#left-toolbar` — Ferramentas)**:
   - Organizada em duas colunas funcionais contendo:
     - **7 Ferramentas**: Inspecionar (`V`), Pincel (`B`), Girar (`R`), Carimbo/Clonar (`S`), Travar Subtiles (`F`), Pan (`H`) e Zoom (`Z`).
     - **Guias Visuais**: 4 toggles (`toggleGuideAxes`, `toggleGuideBlocks`, `toggleGuideSubtiles`, `toggleGuideOrbits`) com estado `aria-pressed`; grade 2×N de 48×38 px, ícones de 17 px e estado ativo `--bg-selected` + anel interno, igual às ferramentas. Atalhos: `A`, `Shift+B`, `M`, `O`.
     - **Controle de Cores**: par Peça/Fundo (`.illustrator-color-widget`, `#fgColorPicker` e `#bgColorPicker`) em chips de 32 px, prévia de 24 px, botão fantasma de inversão (`#btnSwapColors`, tecla `X`) e rótulos em `title`/`aria-label`. A prévia usa `appearance: none` e `inset: 0` para o input nativo preencher o chip; sem isso o controle desenha apenas um canto.
   - O **Gerador**, o **Histórico** e o **Exportar** não ficam mais aqui: seguem o padrão do Illustrator (coluna esquerda só com ferramentas), com o gerador/exportação no dock (item 6) e o histórico no trilho (item 4).

3. **Área Central e Viewport (`#workspace-viewport` / `#canvas-stage`)**:
   - Artboard do mosaico centrado sobre o pasteboard escuro.
   - Pan 2D contínuo via CSS transforms (sem re-renderizar primitivas geométricas) operável via ferramenta Pan (`H`), arrasto com botão do meio, `Espaço + Arrasto`.
   - Zoom centrado na janela ou sob o cursor (Ctrl + Roda do mouse) com limites de 25% a 400%.
   - Teclas `1`, `Shift+1` e `Ctrl+1` recentralizam o canvas e fixam zoom em 100%; tecla `0` ajusta o artboard à janela visível. Roda do mouse livre redimensiona o tamanho do pincel.

4. **Trilho de Utilitários (`#utility-rail` — Ferramentas de Documento)**:
   - Faixa vertical de 40 px entre o canvas e o dock direito; concentra as ferramentas de documento que não precisam de largura permanente.
   - **Histórico (`#dock-history`)** com `#btnToggleHistory`; a lista (`#seedHistoryList`) abre à esquerda do trilho.
   - **Peças permitidas (`#railTogglePieces` / `#railFlyoutPieces`)**: flyout com altura explícita; a lista de famílias rola dentro.
   - **Documento (`#railToggleDocument` / `#railFlyoutDocument`)**: Prancheta, Grade, margem e respiro.
   - **Biblioteca (`#railOpenLibrary`)** no rodapé do trilho.
   - Os flyouts abrem à esquerda, sobre o canvas, e permanecem abertos até o mesmo botão ser clicado de novo ou outro item do trilho abrir. Não fecham ao clicar fora.
   - É `mosaic-mode-only`: some no criador de peças e devolve a largura ao canvas.

5. **Barra Inferior de Status (`#status-bar` — A Visão e Saída)**:
   - Zona esquerda: Grupo de zoom integrado (`.zoom-widget`) com `[−] [100% ▾] [+] [Ajustar] [1:1]`.
   - Zona central: Dimensões em pixels, contagem de grade/órbitas e Inspetor de Hover com reticências automáticas (`text-overflow: ellipsis`) em viewports compactas.
   - Zona direita: Streaming Spout em tempo real (`#spoutToggle`, `#spoutName`), indicador de status de conexão e botão de Central de Ajuda (`#btnHelp` / `?`).

6. **Dock Lateral Direito (`#right-dock` — Painéis Estáticos)**:
   - **Faixa do Gerador (`#dock-generator`)**: logo abaixo do cabeçalho, reúne `#btnRandomize` (tecla `G`) e a navegação de sementes (`#seedInput`, `#btnPrevSeed`, `#btnNextSeed`). Fica visível no modo mosaico.
   - **Faixa de Exportação (`#dock-export`)**: rodapé fixo com seletor PNG/SVG (`#exportFormatSelect`) e botão de download (`#btnExport`), no modo mosaico.
   - **Grupo superior em abas**: `#panelSymmetryGroup` reúne **Simetria** (`#panel-symmetry`) e **Escopo** (`#panel-edit-scope`) em `#propertiesTabs`, com desfazer/refazer no mesmo cabeçalho. Só uma aba fica visível; o corpo rola por dentro.
   - **Pincel sozinho**: `#panel-edit-brush` ocupa o restante da altura, com construtor fixo e paleta rolável. A ferramenta ativa não troca o conteúdo. O dock não rola (`#right-dock` e `#dock-workspace-generate` com `overflow: hidden`): só o corpo de cada painel, a lista de peças e a paleta do pincel rolam.
   - `#dock-workspace-edit` não existe mais; a troca de contexto que ele fazia foi substituída pelos grupos da barra superior. O modo Editar peças continua usando `#dock-workspace-tiles`.
   - Botão de alternância de gaveta (`#btnToggleRightDock`, `»` expandido, `«` recolhido, `aria-expanded`). Quando recolhido (`body.right-dock-collapsed`), comprime-se em régua de 44 px liberando ~306 px para o canvas; gerador e exportação somem junto com os painéis.

### Iconografia — `core/ui_format.js`

Todos os ícones da aplicação vêm de um único registro (`ICON_PATHS`) em `core/ui_format.js`. Nenhuma tela ou módulo define SVG de ícone à mão.

- **Grade**: 24 × 24, área viva de 20 × 20 (margem segura de 2 px), traço em `currentColor` com `stroke-linecap` e `stroke-linejoin` arredondados.
- **Peso óptico constante**: 1,75 em 16 px; o traço acompanha o tamanho (14 → 2; 18 → 1,56; 22 → 1,27) para manter a mesma densidade aparente.
- **Escala de tamanhos**: 12 (passos do documento), 14 (cabeçalhos de painel e listas densas), 16 (padrão), 18 (ferramentas e ações vetoriais), 22 (pranchas de ajuda).
- **Semântica**: `fill` é reservado a "resultado/área preenchida/cópia espelhada" e ao glifo da caneta (sólido, vindo de `pen-tool-svgrepo-com.svg`); o restante é traço, para que nenhum comando pareça selecionado sem estar.
- **Nomes**: um nome = um significado. Apelidos gráficos são explícitos no teste (`flipX`/`mirror`/`symmetry`); duplicações acidentais reprovam.
- **HTML estático**: os ícones são declarados como `<span class="icon-slot" data-icon-slot="nome" data-icon-size="18">`; `UiFormat.hydrateIcons()` substitui cada slot pelo SVG canônico no boot. O `index.html` não guarda caminho de ícone.
- **CSS**: regras de tamanho de ícone por seletor foram removidas; tamanho e traço vêm do registro. O CSS ajusta apenas cor, opacidade, alinhamento e a rotação do chevron de painel.
- **Contrato**: `tests/test_icon_system.js` valida nomes, grade, pesos, aliases, ausência de SVGs manuais em `index.html`, `sketch.js` e `core/subtile_studio_ui.js`, e a hidratação dos slots.

A revisão completa (diagnóstico, decisões e evidências) está em [`ux/REVISAO_ICONES_2026-10-29.md`](ux/REVISAO_ICONES_2026-10-29.md).

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
- `collectParams(state)`: Coleta parâmetros do documento (seed, linhas, colunas, subdivisão, simetrias, modo de encaixe por bordas, margem, respiro, tiles permitidos, largura/altura e cores). Campos ausentes são opcionais: `applyParams` conserva os valores atuais ao restaurar snapshots antigos.
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

### Execução de Todas as 60 Suítes Automatizadas
```powershell
node tests/run_all.js
```

As 60 suítes cobrem:
1. Álgebra D4 e axiomas de grupo (`test_tile_registry.js`, `test_d4_invariance.js`, `test_d4_block_combinations.js`, `test_d4_editor.js`, `test_d4_badge_state.js`).
2. Motor de mosaico, renderização vetorial e encaixe de bordas (`test_mosaic_engine.js`, `test_edge_signatures.js`, `test_edge_match_generation.js` — inclui a temperatura de variedade —, `test_edge_match_ui.js`).
3. Persistência de estado híbrida, IndexedDB, quotas e limites (`test_state_persistence.js`, `test_indexeddb_persistence.js`, `test_save_scheduler.js`, `test_storage_key.js`, `test_payload_version.js`, `test_history_limits.js`, `test_persistence_quota.js`, `test_history_nav.js`, `test_history_edit_preservation.js`, `test_document_snapshot.js`, `test_regeneration_capture.js`, `test_multistep_undo.js`, `test_dirty_guard.js`).
4. UI, acessibilidade, navegação e contratos estruturais (`test_scope_chip.js`, `test_info_scopes_source.js`, `test_info_aria.js`, `test_editor_ui_state.js`, `test_info_ui_state.js`, `test_ui_microcopy.js`, `test_viewport_pan_zoom.js`, `test_brush_sizing_snap.js`, `test_ui_control_registry.js`, `test_ui_layout_contract.js`, `test_visual_tokens.js`, `test_visual_system_v2.js`, `test_icon_system.js`).
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

Graphify: `.\venv\Scripts\python.exe -m graphify query "símbolo"`. Sincronização: `scripts/sync_knowledge.ps1`. Abra `_local/obsidian_vault` como vault no Obsidian e use `INICIO_WORKSPACE.md`; o grafo AST e suas notas são artefatos locais ignorados pelo Git. A suíte agora reúne 60 testes; os 60 controles congelados pertencem ao contrato original do mosaico, não ao total de elementos do novo Estúdio.

O botão **Editar peças** fica na grade de ferramentas da barra esquerda. Ao abrir o criador, ele muda para **Voltar ao mosaico**, seguido pelas ferramentas vetoriais. Propriedades, camadas, órbita D4 e biblioteca continuam no dock direito. O atalho `Ctrl+E` alterna os modos.

As ferramentas do mosaico usam pares de mesma largura: Inspecionar/Subtiles, Pintar/Girar, Carimbo/Travar e Pan/Zoom. Na edição, grades e eixos globais aparecem apenas pelos botões de Guias Visuais; a prévia mantém a geometria fantasma e o contorno da área de ação, sem uma malha automática sobre as réplicas simétricas.

Tamanhos de Pintar/Carimbo, Girar e Travar usam o padrão **− | tamanho | +**, também acessível por `−`/`+` no teclado e roda do mouse sobre o canvas. Os tamanhos param nos limites, sem voltar ao início; botões indisponíveis ficam desativados. Girar e pintar alcançam a dimensão máxima do mosaico; Travar respeita o tamanho de um bloco. No pincel com ajuste ao bloco, o passo é um bloco. A indicação `linhas × colunas` preserva o tamanho real de carimbos retangulares. Os atalhos dos escopos são `Q`/`Tab`, com `Shift` para voltar.

A barra esquerda mantém ferramentas, guias e cores; o **Gerador** e o **Exportar** ficam no dock direito, e o **Histórico** no trilho de utilitários. O histórico recolhe por padrão e abre em flyout. No editor de peças, a barra esquerda reúne Ferramentas (incluindo Mão e Zoom), Guias Visuais e um atalho para Biblioteca. A organização de famílias tem página própria. Importar e exportar SVG ficam no menu Arquivo; backup, importação JSON e restauração ficam no menu Biblioteca. Os tamanhos de Girar e Travar têm apenas o controle − / medida / + e um botão independente para ajustar ao bloco; não há uma segunda linha de presets numéricos.

A prévia de Girar destaca todas as células alcançadas pelo escopo ativo, usando os mesmos alvos da operação. O contorno ciano delimita as regiões afetadas e o âmbar marca a origem. As bordas internas entre células vizinhas não são desenhadas, preservando a ausência de grade automática.

Girar opera sobre o conteúdo atual de cada região afetada pelo escopo. Réplicas simétricas leem suas próprias células editadas, em vez de receber uma cópia da região de origem. A direção do giro respeita os espelhamentos D4. Sobreposições só aplicam ciclos completos de movimentação de células para preservar o conteúdo; a prévia usa os mesmos alvos da operação. Pintar e Carimbo mantêm sua semântica de aplicação de um padrão.

O botão **Ampliar editor** abre um popup com canvas maior e paleta lado a lado; a paleta/construtor do dock e o controle de tamanho da barra contextual são movidos para ele e devolvidos ao fechar, sem cópias independentes. O editor trabalha ao vivo; **Concluir** mantém as alterações; **Cancelar** ou `Esc` restaura o pincel da abertura e retorna ao dock. Clique/arraste pinta células e o botão direito gira a célula, inclusive em 1×1. A roda sobre o canvas ampliado e `−`/`+` seguem o mesmo controle de tamanho do mosaico.

**Clone:** `S` restaura a captura anterior; sem captura, entra automaticamente em Capturar. O gesto **Alt + clique/arraste** permite recapturar, seguido de aplicação com clique normal. `C` continua como alternativa para iniciar captura. Arraste e solte para capturar; a ferramenta passa automaticamente a aplicar. Clique/arraste aplica e botão direito gira o clone. `Esc` ou botão direito durante a captura cancela sem substituir o clone anterior. Capturas com ajuste ao bloco funcionam em qualquer direção de arrasto. Pincel e clone conservam padrões independentes durante a sessão; trocar ferramenta encerra o gesto anterior. Os dois padrões são salvos separadamente no campo opcional `brushToolSessions` do payload v3 e restaurados após recarregar.

**Cursores:** captura usa mira; aplicar clone usa cópia; Girar usa seta circular com ponto de ação; Borracha usa célula; Pan/Espaço usam mão aberta e fechada durante o arrasto; Zoom com Alt indica afastamento. Navegação tem prioridade sobre os cursores vetoriais. Combinações sem aplicação válida no escopo Iguais usam cursor de ação indisponível.

Capturar uma região com Alt também entra na sessão de Clone antes de substituir o padrão ativo. Voltar a Pintar recupera seu tile, orientação, tamanho e ajuste ao bloco. Saves antigos sem um pincel separado retomam um pincel normal 1×1 (#2), preservando a região capturada na ferramenta Clone.

O editor ampliado permite definir **Linhas e Colunas** separadamente, escolher o tile da paleta sem preencher o padrão inteiro, pintar/apagar células e desfazer/refazer com `Ctrl+Z`/`Ctrl+Shift+Z`. Redimensionar preserva as células existentes e cria células vazias. Limpar grade pode ser desfeito; Cancelar/Esc restaura o padrão anterior à abertura. No Clone sem captura, a ferramenta entra em Capturar automaticamente: arraste com o botão esquerdo para capturar. Depois da captura, o clique normal aplica; Alt+arraste ou C permitem recapturar.


### Criador de subtiles — seleção e organização dos painéis

O criador abre na visualização **1×1 Mestre**, com mais espaço para desenhar. O painel contextual usa abas **Propriedades** (entrada de edição), **Camadas** e **Variantes**; a Biblioteca tem página própria, acessível pelo menu superior e pelo atalho lateral, com navegação pelas setas do teclado. A aba Camadas apresenta a pilha de objetos da família, da frente para o fundo: marque caixas para selecionar vários objetos, arraste linhas para reordenar, dê duplo clique no nome para renomear e use os controles de visibilidade e bloqueio. São objetos empilhados da família; não há grupos de camadas aninhados.

No canvas, **V** ativa Seleção; **Shift+clique** adiciona ou remove um objeto, **arrastar no vazio** seleciona por área e **Shift+arrastar no vazio** acrescenta à seleção existente. **Todos / Ctrl+A** seleciona os objetos visíveis e destravados. O Pathfinder fica expandido por padrão em Propriedades. Unir, Subtrair, Interseção e Excluir são habilitados com dois ou mais objetos elegíveis; em peças protegidas, os quatro comandos ficam visíveis e desabilitados. O recolhimento manual é preservado durante as atualizações do painel. A seleção permanece ao trocar de aba; **Ctrl+Z** desfaz edições e booleanas.

Na Biblioteca, **conjunto** é o nome de interface para os grupos de famílias existentes no modelo de dados. Há busca, filtros Todos / Meus subtiles / Padrão, filtro por conjunto, Expandir/Recolher e Localizar atual. Os metadados da família selecionada ficam junto da biblioteca. Cada família reúne um mestre e suas variantes D4; mover uma família para outro conjunto preserva suas variantes. Os formatos de persistência e os IDs canônicos 0–84 permanecem iguais.

### Criador de subtiles — Navegação, Grade e Guias

A barra esquerda do editor reúne **Ferramentas**, com `Mão (H)` e `Zoom (Z)` na última linha, e **Guias Visuais**, com encaixe, divisão da grade, Grade, Eixos D4, Portas e Margem. O botão redundante 1:1 foi removido, pois o status bar e o atalho `1` já centralizam em 100%.

No modo de Subtiles, a **rodinha do mouse (scroll) sem modificadores realiza Zoom direto**, permitindo navegar e inspecionar detalhes com agilidade sem exigir `Ctrl`. O scroll com `Shift` faz pan horizontal, com `Alt` faz pan vertical, e segurar `Espaço` ou ativar a ferramenta Pan executa arrasto 2D irrestrito. Clicar no canvas com a ferramenta Zoom ativa executa zoom (+25% no clique normal, −25% com Alt ou botão direito).

A **Grade fracionária** exibe divisões uniformes correspondentes ao seletor (com divisão visual padrão 1/6 quando o ímã estiver em *Off*), desenha a linha de centro mesmo sem eixos D4 ativos e inclui o contorno nítido da área ativa. As linhas de fita em $\pm 1/6$ pertencem estritamente ao botão **Portas**, não poluindo grades binárias (1/4, 1/8, 1/16). O snap magnético em grades que não são múltiplos de 3 só atrai para portas quando o botão Portas estiver explicitamente ativado.


A exclusão de uma família pede apenas a confirmação da ação e informa seu uso; não baixa backup automaticamente nem limpa o histórico vetorial das outras famílias. Exportar a biblioteca continua disponível quando desejado. Referências à família excluída continuam sendo convertidas para o Tile Vazio (#84). A guia visual **Subtiles** usa ciano com a mesma espessura e opacidade dos limites de blocos (1,5 px; alfa 165/255), sem contorno adicional; a guia Blocos usa lilás para diferenciar as escalas; continua opcional e não aparece nas exportações nem na saída Spout.


O **Backup da biblioteca** fica acessível pelo menu superior Biblioteca, reunindo exportação (.json), importação e restauração. Na confirmação de exclusão de família, a opção **Baixar backup da biblioteca antes de excluir (.json)** começa desmarcada; marque-a para baixar o estado anterior à exclusão. Cancelar não baixa backup nem exclui. Fazer backup não apaga o histórico de edição vetorial. O **Gerador** fica visível por padrão no topo do dock direito, o **Histórico** no trilho de utilitários e a exportação no rodapé.

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

No editor de peças, **Ctrl+D duplica apenas formas selecionadas**. Sem seleção, o aviso pede selecionar formas; em peças protegidas, aponta para **Criar cópia**, ação explícita sem Ctrl+D. **Enter conclui a Caneta**; **Escape cancela Caneta/arrasto provisório ou limpa a seleção**, sem sair do editor nem criar undo. Trocar ferramenta conclui um caminho válido já solto; um arrasto em andamento é descartado. Ctrl+E e Voltar ao mosaico restauram a ferramenta e o padrão de pincel do mosaico. G continua Polígono e A continua Editar pontos no editor de peças.

Termos da interface: Prancheta, Espaçamento, Peças permitidas, Editar peças, Grade de peças, Bloco, Padrão de pincel, Semente, Carimbo, Preservar, Mão, Encaixe, Isolar e Recortar aos limites da peça. IDs internos, nomes de famílias e desenhos do usuário permanecem inalterados. No mosaico, Alt+arraste captura e Shift inverte temporariamente o encaixe; H/Espaço move a visualização. Undo/refazer indica seu alvo: mosaico, peça ou pincel.


### Sistema visual compartilhado (T07)

`style.css` define os papéis semânticos de painel, campo, hover, seleção, texto, borda funcional, foco, aviso e erro em `:root`. Botões/campos comuns usam 30–32 px, passos e ações de lista têm alvo mínimo de 24×24 px, texto funcional usa 12 px e valores numéricos usam 13 px. A barra esquerda usa 120 px; o rodapé fica na coluna da prancheta, entre as barras laterais, com 32 px de altura; a ordem das cinco superfícies permanece igual. Bordas decorativas podem ser discretas; controles essenciais usam `--border-control`. Foco é um contorno externo de 2 px, separado do preenchimento de seleção. Guias ligadas têm fundo neutro e marca lateral; o pasteboard não usa pontos.

A pele comum fica junto às regras base, com variantes junto ao componente. Evite reintroduzir tamanhos/cores concorrentes ao fim da folha. Nomes de papéis antigos não resolvidos foram substituídos; `--font-mono` está definido. `test_visual_tokens.js` verifica referências CSS e inline, contraste dos pares semânticos (texto ≥4,5:1; indicadores essenciais ≥3:1), escala e segurança dos ícones.

`UiFormat.icon` fornece SVGs de comando com viewBox 24×24, desenho de 16 px e traço de 1,75, escondidos da árvore acessível; seus botões mantêm nome por aria-label/título. Alinhamento, ordenação, cópia, edição, exclusão, undo/redo e controles pequenos usam essa família. Tooltips aceitam quebra de linha e limites da viewport, funcionam por foco/ponteiro e associam `aria-describedby` sem apagar descrições anteriores. Avisos e falhas mantêm texto e ações; a mudança de tema não altera as cores da obra, a matemática ou o formato salvo.

Correção da T07: dimensões de controles especiais são independentes da pele comum (Spout 40×24 px, marca informativa de 16 px dentro de alvo de 28 px). Campos conservam borda funcional; ações usam superfícies discretas e espaçamento interno. A barra superior quebra por grupos até 1400 px. Mensagens ficam dentro da área de trabalho, acima do rodapé. A ajuda separa mosaico/editor e ferramentas/ações, com corpo rolável e cabeçalho fixo.

Ajuda contextual: os tópicos usam títulos curtos e listas sem subtítulo técnico. Itens são filhos de uma lista semântica, com espaçamento e rolagem próprios; textos dos escopos continuam derivados de `MosaicEngine.EDIT_SCOPES`. Camadas e Biblioteca concentram instruções nos popups para evitar repetições permanentes nos painéis.

### Campos acessíveis e edição numérica (T08)

`core/ui_fields.js` associa os rótulos das propriedades a IDs estáveis e fornece nomes completos com unidades (pixels, porcentagem, graus ou unidades da peça). Os IDs legados são preservados. A regra final de foco mantém o contorno visível nos próprios campos, sem duplicá-lo no contêiner.

Enter confirma um número válido; Escape restaura o valor anterior e cancela a prévia de margem/espaçamento sem criar undo. Valores vazios, não finitos, inteiros inválidos e valores fora dos limites do controle são bloqueados antes dos handlers do documento. O erro recebe `aria-invalid` e descrição acessível; sair de um campo inválido cancela o rascunho. O atributo step continua sendo incremento, permitindo por exemplo largura de 900 px com passo de 50.

As três buscas (gerador, pincel e biblioteca) têm nome independente do placeholder, botão Limpar que retorna o foco ao campo e contador de resultados anunciado. O contador respeita os filtros existentes; não redefine a seleção de peças nem os atalhos do canvas. Os testes ficam em `tests/test_ui_fields.js`.

Ajuste de densidade após T08: a busca ocupa uma linha, com limpeza por × apenas quando há texto. A contagem permanece anunciada, mas não ocupa uma linha visual; busca vazia de resultados mostra “Nenhum resultado”. Dicas de tamanho/encaixe ficam na ajuda. Guias ligadas mantêm a marca lateral sem borda adicional. Alinhar/transformar exige seleção; Pathfinder fica expandido por padrão em Propriedades; operações exigem duas ou mais formas elegíveis. Rótulos completos, foco e validação numérica são preservados; erros exibem somente a mensagem necessária.

### Gerador por composição e famílias (T09)

A simetria da composição mantém os quatro modos existentes. A simetria do bloco apresenta as cinco opções diretamente, incluindo Igual à composição. Documentos novos começam sincronizados; documentos restaurados mantêm a opção independente salva. Os botões 2×2, 4×4, 6×6 e 8×8 representam o bloco completo; `data-sub` continua de 1 a 4 por quadrante.

Peças permitidas mostra famílias com miniatura, contador e seleção total/parcial/vazia. Variantes ficam sob expansão; buscar revela as correspondências e limpar restaura a expansão manual. Isolar família/conjunto oferece Restaurar seleção; alternar entre isolamentos conserva a seleção inicial. Uma alteração manual invalida o isolamento anterior. Todos/Nenhum/Inverter mantêm o alcance de toda a biblioteca, inclusive itens ocultos pela busca (informado no título dos controles). Gerar e semente permanecem à esquerda. Estado de expansão e isolamento é temporário; não altera o schema v3.

Revisão visual após T09: as cinco opções do bloco ficam sempre visíveis. Botões de simetria e ferramentas dos dois ambientes compartilham superfícies neutras, preenchimento de seleção e foco explícito; contornos decorativos usam `--border-subtle` (#2e3138). `--border-control` continua reservado aos indicadores funcionais que precisam de destaque. O rodapé pertence a `#workspace-viewport`; em colunas estreitas ele mantém Zoom, salvamento, Spout e Ajuda acessíveis, e o campo de nome do Spout é o primeiro a sair. Até 1050 px o estado de salvamento continua visível e anunciado; até 700 px o rodapé permanece em uma linha, sem a grade. O gerador usa rolagem externa para manter a lista de famílias alcançável com as opções do bloco abertas.

O grupo de zoom do rodapé usa pintura isolada (`translateZ(0)`) e não recorta seus controles (`overflow: visible`), evitando desaparecimento visual ao alternar entre mosaico e editor ou redimensionar a janela. O rodapé continua limitado à coluna central pelo layout responsivo.

### Reforma visual V2 (28/10/2026)

A camada **V2 — Reforma visual**, no fim de `style.css`, é a última palavra em apresentação e não altera contratos: 60 IDs congelados, ordem `#left-toolbar (0) → #workspace-viewport (1) → #utility-rail (2) → #right-dock (3)`, `#paddingInput` em `#panel-document`, gerador e exportação no dock, histórico no trilho e schema de persistência v3 permanecem iguais. Ela vence a herança por vir depois das regras históricas; ao editar um componente, altere a regra V2 correspondente ou consolide as duas — não acrescente uma terceira camada. Os blocos **V2 — Barra contextual e dock estático** e **V2 — Dock empilhado e flyouts do trilho** ficam no mesmo arquivo e no mesmo nível de camada.

Tokens de referência: `--top-bar-h: 48px`, `--status-bar-h: 32px`, `--font-section: 11px`, `--radius-chip: 6px`, `--radius-card: 8px`, `--bg-panel: #1c1d21`, `--border-subtle: #2e3138`, `--bg-primary: #2a5d9e`, `--transition-ui: 120ms`. A rampa de texto mantém `--text-primary/secondary/muted` com contraste mínimo de 5,33:1 sobre as superfícies semânticas.

Regras de composição: (1) um contorno por grupo de controle, nunca por chip; (2) rótulo em 10–11 px, valor em 13 px tabular, ícone em 16–17 px; (3) apenas a ação primária tem cor cheia persistente — no mosaico, **Gerar**, botão rotulado de 32 px de altura no topo do dock; (4) listas usam linhas de 40 px com hairline e ações reveladas no hover/foco/seleção; (5) o rodapé prioriza documento e salvamento — o nome do Spout é o primeiro a sair em colunas estreitas. Alvos mínimos de 24 px são verificados por `tests/test_visual_system_v2.js`.

Responsividade: a barra superior quebra em duas linhas alinhadas quando os grupos contextuais não couberem (`height: auto` abaixo de 1400 px). O rodapé permanece em uma linha de 32 px em colunas de 600 px (1024×768), escondendo a grade e o inspetor de hover; até 1050 px esconde apenas o campo de nome do Spout. Em 1024×768 a prancheta de 600 px ocupa exatamente a coluna central — use `0` (Ajustar) para trabalhar com margem. O inspetor de hover continua anunciado, mas visível apenas quando há espaço na coluna.

### Gerador, Histórico e Exportar fora da coluna esquerda (28/10/2026)

A coluna esquerda acumulava ferramentas, guias, cores, gerador, histórico e exportação, e ficava apertada em 900×768. Seguindo o Illustrator como guia — ferramentas à esquerda, ações de documento à direita —, o **Gerador** virou a faixa `#dock-generator`, o **Exportar** o rodapé `#dock-export` e o **Histórico** o primeiro item do trilho `#utility-rail`, uma faixa de 40 px entre o canvas e o dock. A lista do histórico abre à esquerda do trilho, sobre o canvas, sem cobrir nem reduzir Simetria e Peças. A ordem das superfícies é barra esquerda → canvas → trilho → dock; o trilho permanece quando o dock recolhe e some no criador de peças. Nenhum ID congelado, atalho ou campo de persistência mudou.

Diagnóstico, evidências e limites desta rodada: [`ux/REVISAO_VISUAL_2026-10-28.md`](ux/REVISAO_VISUAL_2026-10-28.md). A suíte atual tem 54 conjuntos; números antigos (36/44/45/52/53) são históricos — `tests/run_all.js` é a fonte.

### Ferramentas, Pathfinder e aviso de regeneração

Nomes revisados no catálogo de comandos: Inspeção, Pincel, Girar, Carimbo, Preservar, Mão e Zoom no mosaico; Seleção, Seleção direta, Caneta, Retângulo, Elipse, Polígono, Arco e Linha no editor. Seleção direta pode ocupar duas linhas sem reticências; nomes completos e atalhos permanecem nos tooltips. Preservar mantém a denominação própria do produto, pois não bloqueia a edição manual.

Pathfinder fica expandido por padrão em Propriedades, inclusive nas peças protegidas, cujas operações ficam desabilitadas. Unir, Menos frente, Interseção e Excluir ficam habilitados com duas ou mais formas visíveis e destravadas em uma cópia editável. Peças protegidas mostram a necessidade de criar cópia. As operações mantêm undo/redo.

“Não perguntar nesta sessão” passa a respeitar a sessão da aba via sessionStorage, inclusive após reload e em mudanças de grade com perda de preservações. A preferência é gravada ao confirmar Regenerar; Cancelar não grava a opção. Se sessionStorage estiver indisponível, a preferência continua funcionando em memória até recarregar. Alterações continuam recuperáveis pelo histórico.

### Seleção, transformação e recorte — 28/10/2026

No editor vetorial, os botões de giro e espelhamento usam o centro da caixa da seleção desbloqueada, como a alça de rotação. A Seleção direta permite arrastar o corpo de objetos; nós e alças continuam editáveis individualmente. Alt+arraste no corpo duplica a seleção uma única vez, preservando os originais. Um Alt+clique não duplica; cancelar o arrasto descarta a cópia provisória e restaura a seleção original.

Na barra lateral esquerda do mosaico, Retângulo (Shift+M) e Pincel de seleção (W) selecionam células inteiras. Arrastar dentro da região move seu conteúdo, mantendo o ponto de pega; arrastar fora dela inicia outra seleção. O movimento só altera a origem ao soltar em um destino válido e gera uma única entrada de desfazer. Escape cancela o gesto sem apagar células. O pincel usa diâmetro independente, ajustável por −/+, roda ou botões, e interpola eventos rápidos sem lacunas. S ativa Clonar para aplicar cópias da região capturada, sem apagar a fonte; C/Alt+arraste recapturam. T alterna as duas ferramentas. A seleção não replica por simetria; a clonagem usa o escopo ativo. Botões separados de Estampar, Mover e Capturar região foram retirados. O laço foi removido e L permanece disponível apenas como Elipse no editor vetorial. A origem da seleção é transitória e invalidada por regeneração, restauração ou recarga.

Ferramentas, guias, simetrias, escopos, biblioteca, importação/exportação, pincel e propriedades usam ícones com nomes curtos e acessíveis nos tooltips, também disponíveis pelo foco. Valores numéricos, abas, nomes do usuário e confirmações mantêm texto. Instruções ficam na ajuda ou nos tooltips; não acrescentar tutoriais, avisos de sucesso ou descrições redundantes aos painéis. A captura mostra apenas as dimensões durante o gesto. `tests/test_region_transfer.js` cobre sobreposição, máscaras, limites, preservações e cancelamento da duplicação; os testes vetoriais cobrem o pivô e Alt+arraste. Gate: 52 suítes.


### Espaço dos ícones e atalhos de seleção — 28/10/2026

A barra esquerda tem 120 px, o trilho de utilitários 40 px e o painel direito 304 px, preservando ferramentas em duas colunas e o rodapé entre as laterais. Ações com ícones usam alvos de 34×34 px, com intervalos de 4 px; ações auxiliares nos títulos usam 28 px. Simetrias, escopos, propriedades e biblioteca não esticam os botões para ocupar antigas colunas de texto. Encaixe compartilha a linha do tamanho do pincel e Ampliar fica junto do nome da prévia. Histórico mantém rolagem própria no flyout do trilho e Exportar permanece alcançável no rodapé do dock em 900×768.

Os comandos `selectRect` e `selectBrush` no catálogo compartilhado acionam a mesma função dos cliques e fornecem nomes, tooltips e ajuda. Atalhos respeitam campos, janelas modais e o ambiente: L continua sendo Elipse no editor vetorial. A seleção permanece destacada após a captura; Clonar recebe destaque apenas ao escolher S ou seu botão.


### Fluxo de seleção e clonagem — revisão de 28/10/2026

Durante a seleção, `#selectionSummary` aparece na barra contextual do topo com área, quantidade de peças e limpar; o dock direito permanece como está. O tamanho da seleção usa o mesmo `#brushSizeControl` do Pincel. Nenhum controle é movido entre o dock e o topo ao trocar de ferramenta; handlers e IDs permanecem nos mesmos elementos. Gerador, biblioteca e propriedades conservam o painel direito de 304 px; o histórico fica no trilho e o rodapé continua na coluna da prancheta. O ícone do pincel de seleção combina contorno tracejado, células e sinal de adição. Criar cópia nas Propriedades usa o mesmo `UiFormat.icon('copy')` da Biblioteca.

Os ícones de Pathfinder usam preenchimento para indicar o resultado: Interseção destaca a área comum e Excluir deixa essa área vazia. Propriedades e Biblioteca compartilham o ícone de cópia; setas de importação, exportação, camadas e histórico seguem a mesma escala.

Seleção define a região e move células existentes; Clonar (S) reutiliza a captura para aplicar cópias, no escopo ativo; Pincel (B) recupera seu próprio desenho e tamanho. Capturar durante a seleção atualiza a fonte de Clonar, sem substituir o pincel independente. A ferramenta de seleção permanece ativa depois da captura e do movimento, até uma troca explícita de ferramenta.

### Curvar segmentos — 28/10/2026

No criador de peças, Curvar (C) alterna o segmento clicado entre reta e arco circular em Bézier. A curva usa a fração escolhida em Propriedades: Reta, 1/16, 1/8, 1/6, 1/4 (padrão), 1/2 ou Livre. Livre aceita razões como 3/8 e números decimais com ponto ou vírgula, no intervalo de zero (reta) até valores menores que 1. Frações inválidas não alteram a configuração ativa. Shift+clique numa curva existente inverte o arco inteiro; o botão Inverter lado também reflete a última curva editada e define o lado das próximas retas.

Ciclar frações é um modo opcional, indicado pelo botão ativo: cada clique avança Reta → 1/16 → 1/8 → 1/6 → 1/4 → 1/2 → Reta. O ciclo considera o segmento clicado e mantém a progressão mesmo quando uma fração foi limitada pelo espaço disponível. Shift+clique inverte sem avançar o ciclo. Desativar o modo retorna à alternância simples reta/curva. Opções e controles mantêm nomes curtos em tooltip; não há instruções permanentes no painel.

Pontas, contornos, estilo e alças dos vizinhos são preservados. Arcos maiores que 90° usam vários trechos cúbicos de até 90°, com erro radial máximo inferior a 0,028% do raio por trecho. Âncoras auxiliares recebem o campo opcional `curveJoin: true` para que o arco continue sendo uma única unidade da ferramenta ao salvar, restaurar, transformar por D4, inverter, ciclar ou voltar à reta. Alterar manualmente uma dessas âncoras rompe essa união naquele ponto. A biblioteca preserva o campo sem mudar suas chaves, o schema v3 ou o esquema de snapshots. A abertura é limitada pelos extremos reais da curva dentro de [-0.5,0.5]²; aberturas numericamente degeneradas não alteram a forma. A inversão é recusada quando ultrapassa a peça. Formas ocultas, travadas e famílias protegidas não são alteradas. Cada mudança participa do histórico de 256 passos; a ferramenta permanece ativa.

### Adicionar à seleção com Shift — 28/10/2026

No mosaico, Shift+clique ou Shift+arraste com Retângulo/Pincel de seleção une a nova área à máscara existente, mesmo ao iniciar dentro da região já selecionada. Lacunas permanecem fora da seleção e células sobrepostas não são contadas duas vezes. Sem Shift, a captura substitui a seleção ou o arrasto interno move a região. Shift não ativa encaixe a blocos durante a seleção; esse modificador mantém sua função original de encaixe nas ferramentas de pintura/clonagem. O gesto registra a intenção no início, permite cancelar sem perder a máscara anterior e captura os valores atuais das células sem alterar o mosaico. Mover ou clonar a região composta preserva suas lacunas.

No criador de peças, Seleção (V) mantém Shift+clique para adicionar/remover objetos e Shift+arraste para adicionar objetos. Seleção direta (A) também adiciona objetos, âncoras de outros objetos e nós por marquee sem perder os já selecionados; Shift+clique num nó selecionado o remove. A seleção por marquee considera formas paramétricas sem convertê-las nem alterar o documento. Formas ocultas/travadas são ignoradas. Com Curvar (C), Shift+clique continua invertendo o sentido da curva.

Espelhar (O), na barra do mosaico, usa a área e o escopo da ferramenta Girar. Clique esquerdo aplica mx (horizontal), botão direito aplica my (vertical). Atua em peças individuais ou grupos, com prévia, preservações e desfazer/refazer. Espelhar não usa o modo de alternar famílias da rotação.

Uniformidade entre Mosaico e Editar peças (29/10/2026): ferramentas e guias usam a mesma grade de duas colunas, altura de 38 px, ícones de 18 px e estado ativo com preenchimento azul e contorno interno discreto. A barra esquerda usa uma única área de rolagem, sem estreitamento adicional no editor. O encaixe acompanha a geometria das ferramentas; os cabeçalhos do editor usam a superfície do painel. A troca de ambiente mantém aparência de navegação nos dois modos.

Revisão minuciosa entre ambientes (29/10/2026): removido o divisor exclusivo abaixo da troca de ambiente, alinhando o início de Ferramentas. As gavetas de arquivo foram consolidadas na Biblioteca; a coluna esquerda conserva a grade de ferramentas de 38 px e ícones de 18 px. Criar cópia mantém rótulo visível em Propriedades e Biblioteca; o atalho de cópia superior usa a superfície neutra das ações. Ver `docs/ux/REVISAO_UNIFORMIDADE_2026-10-29.md` para o escopo da inspeção.

Organização comum das ferramentas: Mão e Zoom encerram a grade principal de Ferramentas nos dois ambientes, juntos na mesma linha. O editor não tem seção separada de Navegação.


### Ergonomia do editor — 29/10/2026

Propriedades é a primeira aba. Para uma forma selecionada, a ordem é Geometria → Aparência → Alinhar/Transformar → bases de fita → Pathfinder (expandido por padrão). Ferramentas de desenho abrem Propriedades; Seleção e Seleção direta preservam a aba escolhida, permitindo trabalhar na pilha de Camadas. A barra esquerda contém ferramentas e guias; as opções de Curvar ficam em Propriedades. O atalho Biblioteca abre uma página própria sem alterar o estado do editor; o retorno preserva zoom, ferramenta e aba contextual. A página Biblioteca concentra catálogo, busca, conjuntos e detalhes da peça; SVG de subtiles e backup ficam no menu Biblioteca. Os 60 IDs congelados, as cinco superfícies e o schema v3 permanecem preservados.


### Menus e página Biblioteca — 29/10/2026

`core/workspace_navigation.js` gerencia a barra global de menus de 30 px (`#app-menubar`), acima da barra contextual de 48 px. Arquivo reúne exportação do mosaico e retorno ao estúdio; Editar e Objeto reutilizam os comandos do editor e suas condições de seleção; Exibir controla zoom e todas as guias do ambiente ativo; recolher o painel fica no próprio painel. Biblioteca reúne catálogo, SVG de subtiles, exportação por conjuntos, criação e backup; Ajuda mantém os atalhos existentes. Setas, Escape, Tab e F10 navegam os menus com foco visível e comandos indisponíveis desabilitados.

A Biblioteca usa a rota local `#biblioteca` e uma página fora das cinco superfícies do editor, com catálogo em grade, filtros, prévia e metadados. Ações rápidas e confirmações continuam em diálogos, mas o gerenciamento permanece na página ampla. Voltar ao estúdio e o histórico do navegador preservam o editor; Editar peça abre a família selecionada no editor vetorial. Atalhos de desenho não alteram o documento enquanto a página da Biblioteca está aberta. Importar SVG pelo menu Biblioteca cria uma nova família em qualquer ambiente; a importação pela aba Camadas mantém o fluxo na peça selecionada. Não foi alterado o schema de persistência v3.

Exportar conjuntos permite selecionar um ou vários conjuntos e salvar JSON reimportável ou ZIP com SVGs organizados e o JSON. O ZIP inclui opcionalmente as variantes D4 registradas. `core/library_export.js` filtra o snapshot sem alterar a biblioteca. Exibir oferece Eixos/Blocos/Peças/Órbitas no mosaico e Eixos/Grade/Portas/Margem/Encaixar na grade no editor de peças.

### Microcopy da interface — 29/10/2026

Regra permanente: o chrome não carrega texto explicativo. Cada controle começa pelo ícone e segue com o menor nome ainda intuitivo; o nome completo aparece no hover (`title`/`data-tooltip`) e a explicação fica no popover de info (`data-info-topic` → `INFO_TOPICS` em `ui_info.js`) ou no menu Ajuda. Avisos aparecem só quando um estado impede a ação e dizem apenas o necessário; diálogos com `role="dialog"` podem explicar a decisão por serem transitórios. O encaixe por bordas virou o interruptor **Bordas** (ícone `edgeJoin`), com tooltip `Encaixe por bordas` e tópico `edge-match`; a temperatura virou o controle **Variedade** (ícone `variability`), com tooltip `Variabilidade do encaixe` e a mesma explicação no tópico; a dica do inspetor na barra de status, o subtítulo da página Biblioteca e a frase do aviso de grade não quadrada foram encurtados. `tests/test_ui_microcopy.js` reprova rótulo estático acima de 64 caracteres, exige o ícone antes do nome e confere que todo `data-info-topic` resolve para um tópico existente.

### Barra contextual e dock estático — 29/10/2026

A geografia foi invertida para seguir o Illustrator. O topo deixou de ser um formulário estático de documento: `#top-control-bar` agora é a **Control Bar** da ferramenta ativa. `#topToolContext` mostra ícone e nome; os grupos `#ctxPaint`, `#rotateToolOptionsWrap`, `#freezeToolOptionsWrap` e `#selectionSummary` aparecem só quando a ferramenta correspondente está ativa. Inspeção, Mão e Zoom mantêm apenas a identidade.

O dock direito virou uma coluna estática com dois painéis empilhados: `#dock-generator`, `#dock-workspace-generate` (com `#panel-symmetry` e `#panel-edit-brush`), `#dock-workspace-tiles` no modo peças e `#dock-export`. `#panel-document`, `#panel-swatches` e `#panel-edit-scope` foram para flyouts do trilho. `#dock-workspace-edit` foi removido; `syncEditWorkspaceUI` só alterna `dock-workspace-generate`/`dock-workspace-tiles` e a visibilidade dos grupos do topo, sem mover controles. O construtor e a paleta do pincel continuam em `#panel-edit-brush`; tamanho, encaixe e Ampliar vivem no topo.

A segunda barra da direita ficou com o que é ocasional ou lista longa: Histórico, Peças permitidas, Documento e Biblioteca. Peças e Documento abrem em flyouts à esquerda (`#railFlyoutPieces`, `#railFlyoutDocument`); o de Peças tem altura explícita para a lista rolar. O dock principal ficou com um **grupo superior em abas** — `#panelSymmetryGroup`, com Simetria e Escopo em `#propertiesTabs` e desfazer/refazer no cabeçalho — e o **Pincel sozinho** ocupando o restante da altura. O corpo de cada painel rola por dentro. Os flyouts do trilho não fecham ao clicar fora: só recolhem com o mesmo botão ou quando outro item do trilho abre. O dock não rola (`#right-dock` e `#dock-workspace-generate` com `overflow: hidden`). Ao abrir o editor ampliado, `openBrushEditor` move o corpo e o controle de tamanho para o diálogo e os devolve ao fechar. `tests/test_ui_layout_contract.js` exige Prancheta/Grade em `#panel-document`, o grupo Simetria/Escopo, os flyouts no trilho, a ausência de `#dock-workspace-edit` e a regra de não rolagem das barras; `tests/test_freeze_ui_contract.js` exige `#freezeToolOptionsWrap` no topo.

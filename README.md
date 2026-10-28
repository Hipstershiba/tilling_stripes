# Tiling Stripes Studio

Aplicação interativa de arte generativa para criação de composições em mosaico estruturadas no grupo diédrico D4 (rotações de 90° e reflexões no plano), com subdivisão de blocos (Supertiles), edição contextual, divulgação progressiva de informações (Progressive Disclosure), persistência híbrida tolerante a falhas, transmissão em tempo real via SpoutGL e exportação vetorial (SVG) e raster (PNG).

Construído em JavaScript moderno (ES6+) e [p5.js](https://p5js.org/), sem necessidade de etapa de build ou dependências externas complexas para execução no navegador.

---

## Documentação

Toda a documentação técnica vive em [`docs/`](docs/README.md); a raiz guarda apenas o app e este README.

- [`docs/MANUAL_MANUTENCAO.md`](docs/MANUAL_MANUTENCAO.md) — arquitetura, álgebra D4, persistência, streaming Spout e regras de manutenção.
- [`docs/instrucoes/`](docs/instrucoes/) — especificações de cada rodada de desenvolvimento.
- [`docs/relatorios/`](docs/relatorios/) — relatórios de entrega e auditorias independentes de código.

---

## Como Rodar Localmente

Recomenda-se iniciar um servidor HTTP local para carregar os recursos sem bloqueios de CORS:

```powershell
# Python 3
python -m http.server 8765

# Ou via Node.js (npx)
npx serve -l 8765
```

Em seguida, acesse no navegador:
`http://127.0.0.1:8765`

---

## Arquitetura do Sistema

O projeto é organizado de maneira estritamente modular, mantendo separação nítida entre o núcleo matemático funcional puro, o motor de mosaicos, a persistência de dados, a arquitetura de informação e a interface do estúdio:

```
├── core/
│   ├── d4_symmetry.js         # Álgebra do grupo D4, transformações, estabilizadores e resolução de órbitas
│   ├── vector_renderer.js     # Renderizador normalizado [-0.5, 0.5] para formas vetoriais JSON (p5 & SimpleSVG)
│   ├── d4_detect.js           # Detector headless de subgrupos estabilizadores D4 (órbitas de 1, 2, 4 e 8 variantes)
│   ├── tile_library.js        # Biblioteca canônica JSON v1 (6 grupos e 31 mestres built-in = 85 subtiles)
│   ├── library_compiler.js    # Compilador determinístico de mestres JSON em catálogos D4 e tabelas de remap
│   ├── library_store.js       # Persistência híbrida (IDB + localStorage), CRUD de grupos/famílias e I/O JSON
│   ├── tile_registry.js       # Fachada reativa do catálogo de tiles, famílias e mapas D4 (libraryRevision)
│   ├── vector_editor.js       # Motor vetorial interativo [-0.5, 0.5] (8 ferramentas, Bezier, snap, undo/redo)
│   ├── vector_boolean.js      # Booleanas Paper.js headless, transformações D4 na seleção, camadas e I/O SVG
│   ├── subtile_studio_ui.js   # Modo Estúdio de Subtiles (data-studio-mode="tiles"), grupos/famílias e preview D4
│   ├── mosaic_engine.js       # Geração macro/micro, escopos de edição, render e snapshots de células
│   ├── state_persistence.js   # Lógica pura de persistência (IndexedDB + localStorage), quotas e histórico
│   ├── history_nav.js         # Navegação preguiçosa no histórico de geração, orçamento e snapshots
│   ├── document_snapshot.js   # Captura e aplicação de snapshots de parâmetros do documento para undo entre gerações
│   ├── spout_output.js        # Sanitização de nomes, probe de mudanças e formatação de quadros para saída Spout
│   └── ui_format.js           # Formatadores puros de rótulos de escopos de simetria e interface
├── tests/                     # Suíte com 44 testes automatizados em Node.js puro
├── tools/                     # Bridge local WebSocket -> SpoutGL em Python (spout_bridge.py / .cmd)
├── ui_info.js                 # Motor de divulgação progressiva (17 tópicos, popovers e tooltips acessíveis)
├── libraries/                 # Bibliotecas p5.min.js, simple-svg.js e paper-core.min.js (v0.12.18, booleanas)
├── index.html                 # Estrutura do shell e superfícies de controle
├── style.css                  # Tema Adobe Illustrator CC Dark e regras visuais responsivas
└── sketch.js                  # Controlador principal, UI, atalhos, histórico, canvas e Spout
```

---

## Ferramentas e Modos de Trabalho

### 1. Painel do Gerador (`Inspecionar` / `Gerador`)
- **Artboard**: Dimensões de largura/altura, inversão rápida (W ⇄ H), bloqueio de proporção e ajuste 1:1 à grade.
- **Grade**: Configuração de Linhas × Colunas, bloqueio de proporção, margem externa, respiro percentual interno e subdivisão de cada bloco ($N = 2 \times \text{subdivisão}$, gerando blocos de $2\times 2$, $4\times 4$, $6\times 6$ ou $8\times 8$ subtiles).
- **Simetria Global & Interna (4 Modos)**:
  - `Mandala Estrita (D4)`: 8 eixos de simetria com respeito rigoroso aos estabilizadores matemáticos de cada célula. Caso o conjunto de famílias ativas impossibilite tiles invariantes em células fixas, o motor utiliza o **Tile Vazio (#84)** como respiro geométrico garantindo D4 perfeito sem bloquear a geração.
  - `Caleidoscópio (Livre)`: Propagação geométrica nos 8 octantes sem restrição de invariância em eixos centrais ou diagonais, conferindo liberdade criativa total ao usuário.
  - `Giro Contínuo (C4)`: 4 quadrantes em giro rotacional contínuo de 90° ao redor do centro.
  - `Espelhamento Duplo (D2)`: Espelhamento bilateral nos eixos horizontal e vertical.
- **Swatches Permitidos**: Seleção e filtragem das famílias e tipos de tiles que entram no sorteio aleatório da semente (*Seed*).

### 2. Ferramentas do Editor
Ferramentas de edição direta na grade com propagação simétrica matemática:

- **🔍 Inspecionar (`V`)**: Exibe coordenadas de bloco, subtile, ID do tile, transformação e órbita no inspetor de hover. Atua como o contexto para as configurações de Geração no dock lateral.
- **✎ Pincel (`B`)**: Pinta células com o tile e rotação ativos. Suporta pincéis inteiros não-cíclicos (1×1 até dimensões de bloco) e Supertiles. Botão direito no mosaico gira o pincel em +90°.
- **🧹 Borracha (`E`)**: Ativa sempre o pincel vazio (#84), inclusive após usar o carimbo. E repetido mantém a borracha; B restaura o último pincel não vazio e S restaura a captura do carimbo. O escopo e o encaixe continuam valendo.
- **↻ Girar (`R`)**: Clique esquerdo gira a área em +90°; clique direito gira em -90°. Suporta rotação geométrica D4 ou ciclar variações da mesma família.
- **⧉ Clonar / Carimbo (`S`)**: Arraste para capturar uma região do mosaico e clique para colar com a simetria ativa (tecla `C` troca para modo de captura).
- **🔒 Travar Subtiles (`F`)**: Congela subtiles do mosaico para torná-los imunes a novas gerações ou sorteios de semente (`G`). Ação monotônica com modos de congelar e descongelar. Tecla `Shift+F` limpa as travas ativas.
- **✋ Mão (`H`)**: Move a visualização da prancheta por arrasto. Segurar `Espaço` ativa a Mão temporariamente; Alt+arrasto captura no mosaico.
- **🔎 Zoom (`Z`)**: Aproxima e afasta o canvas com precisão (ou através de `Ctrl + Roda do Mouse`).
- **Controle de Cores Estilo Illustrator**: Swatches sobrepostos de Primeiro Plano e Fundo localizados na barra lateral esquerda (`#left-toolbar`), com botão de inversão rápida (`⇄`) e atalho de teclado `X`.

### 3. Modo Estúdio de Subtiles & Gestão de Famílias (`Subtiles` / `Ctrl+E`)
Ambiente integrado na mesma janela (`data-studio-mode="tiles"`) respeitando as 4 superfícies da UI e mantendo a saída Spout do mosaico ao vivo:
- **Prancheta Normalizada `[-0.5, 0.5]` & Preview de Continuidade**: Modos de visualização `1×1`, `3×3` (8 vizinhos com a mesma transformação do mestre), `Espelhos 2×2` (`mandala_d4`) e `Giro C4 2×2` (`rotational_c4`), com grade magnética configurável (`Off`, `1/2`, `1/3`, `1/4`, `1/6`, `1/8`, `1/12`, `1/16`), eixos $D_4$, portas de fita (`±1/6` e centro) e margem de respiro (`#paddingInput` compartilhado).
- **Editor Vetorial Interativo (`core/vector_editor.js`)**: 8 ferramentas dedicadas — Seleção BBox com 8 alças e rotação (`V`), Seleção Direta de Nós e Tangentes Bezier Cúbicas (`A`, com subdivisão exata De Casteljau), Caneta Bezier (`P`), Retângulo arredondado (`M`), Elipse (`L`), Polígono/Estrela (`G`), Arco/Setor Anular Truchet (`U`) e Linha (`\`), além de presets rápidos de fita `1/3`, alinhamento/distribuição na célula, histórico *Undo/Redo* por família e área de transferência (`Ctrl+C`/`V`/`D`).
- **Pathfinder, Transformações $D_4$ & Camadas (`core/vector_boolean.js`)**: Operações booleanas **Unir**, **Subtrair**, **Interseção** e **Excluir (XOR)** via Paper.js headless local (`libraries/paper-core.min.js`), preservando curvas Bezier cúbicas e gerando caminhos compostos com furos (`fillRule: evenodd`); giro `+90°`/`-90°` e espelhos `H`/`V` sobre a seleção; painel **Camadas (Formas)** com reordenação de Z-index por *Drag-and-Drop*, setas e atalhos (`Ctrl+]`/`Ctrl+[`, `Ctrl+Shift+]`/`Ctrl+Shift+[`), renomeação inline (duplo-clique), visibilidade e trava por forma.
- **Importar / Exportar SVG**: `importSVGToShapes` converte `<path>` (incl. arcos `A`), `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<polyline>` e `<line>` com `<g transform>` aninhados, normalizando o `viewBox` para `[-0.5, 0.5]` como formas editáveis (sobre mestre built-in, cria automaticamente uma família customizada); `exportFamilyToSVG` gera um `.svg` unitário limpo da variante ativa.
- **Painel de Órbita & Variantes $D_4$ ao Vivo**: Exibe estabilizador $H$ (atualizado em tempo real durante o arrasto), compatibilidade axial/diagonal/central e miniaturas das variantes geradas (`1`, `2`, `4` ou `8`), com duplo-clique para pintar diretamente no mosaico.
- **Gerenciador de Grupos e Famílias**: Criação, renomeação inline, reordenação via *Drag-and-Drop* ou setas `↑`/`↓`, movimentação entre grupos, **Criar cópia** em 1 clique sobre mestres built-in protegidos (`#0..#84`), higienização automática para `#84` ao excluir famílias em uso, backup `.json` (`merge` ou `replace`) e **Restaurar Padrão**.

---

## Escopos de Simetria do Editor

Ao editar no modo Editor, as alterações propagam conforme o escopo selecionado:

| Atalho | Escopo | Descrição |
|---|---|---|
| `Q` / `Tab` | **Ciclar Escopos** | Alterna progressivamente entre os 6 escopos de simetria (`Shift+Q` / `Shift+Tab` cicla no sentido inverso). |
| — | **Centro do Canvas** | Propaga em torno do centro absoluto do canvas (Mandala 8×, Giro 4× ou Espelho X/Y). |
| — | **Órbita (Bloco+Grade)** | Combina a simetria interna do Supertile com a órbita macro da grade. |
| — | **Dentro do Supertile** | Reflete/rotaciona apenas dentro dos quadrantes internos do bloco clicado. |
| — | **Todos os Supertiles** | Propaga para todos os blocos da grade respeitando suas orientações. |
| — | **Livre (Pontual)** | Aplica pontualmente na célula sob o cursor, sem espelhamento. |
| — | **Mesmo Tile** | Substitui globalmente todas as ocorrências do mesmo tile no mosaico (opera em tamanho 1×1). |

*(Nota: As teclas numéricas `1` e `0` são reservadas para navegação de viewport no padrão gráfico — `1` recentraliza o canvas em 100% e `0` ajusta o artboard à janela).*

---

## Divulgação Progressiva de Informações (Progressive Disclosure)

O sistema adota uma infraestrutura limpa de informação contextual (`ui_info.js`), eliminando poluição visual em painéis:
- **Botões de Ajuda Contextual (`ⓘ`)**: Presentes em seções-chave do Gerador e do Editor. Ao clicar, abrem um popover não-modal flutuante (`#infoPopover`) com título e itens explicativos objetivos.
- **Floating Tooltip (`#uiTooltip`)**: Exibe dicas rápidas ao pairar sobre controles de simetria, ferramentas e atalhos.
- **Central de Ajuda (`?` / `#btnHelp`)**: Localizada na barra de status inferior (acessível pelo botão `?` ou tecla `?`), reunindo todos os tópicos e atalhos sem sobrecarregar a interface.

---

## Contrato de Transparência D4 no Editor

No modo Editor, a liberdade do usuário é preservada: caso o usuário pinte um tile assimétrico sobre um eixo ou diagonal de simetria D4, a ação é executada e o sistema sinaliza com transparência o status matemático:
- O banner `#d4SymmetryWarning` é exibido explicando que a célula quebrou a simetria D4 estrita.
- A badge visual `#d4EditedBadge` indica que o mosaico contém edições manuais livres fora do grupo estrito.
- Caso o usuário altere a simetria do bloco para uma configuração independente que reduza a simetria global da grade, o aviso contextual `#blockSymmetryWarning` alerta sobre a redução simétrica.

---

## Persistência Híbrida e Limites de Quota (`core/state_persistence.js`)

A arquitetura de armazenamento opera em duas camadas coordenadas:

1. **IndexedDB (`TilingStripesDB_v1`)**:
   - Camada primária assíncrona com capacidade ampla para sessões criativas longas.
   - Preserva até 256 gerações e até 256 etapas de desfazer/refazer edições manuais.

2. **`localStorage` (`tiling_stripes_studio_v3_state`)**:
   - Cache síncrono ultrarrápido para carregamento instantâneo no boot.
   - Histórico delimitado dinamicamente com orçamento dinâmico proporcional à grade.
   - Gerenciado pelas funções puras: `isQuotaError`, `getMaxEditHistoryForMosaic`, `trimHistoryOnPush`, `migratePayloadHistories`, `buildMinimalEmergencyPayload`, `saveWithQuotaFallback`, `createSaveScheduler` e `validatePayloadVersion`.
   - **Fallback Automático de Quota**: Caso a cota do navegador seja excedida (`QuotaExceededError`), um payload mínimo com o desenho completo e parâmetros essenciais é gravado, preservando o trabalho do usuário e exibindo o aviso `#persistenceWarning`.

3. **Snapshots de Documento (`core/document_snapshot.js`)**:
   - Associa parâmetros macro a cada snapshot de célula, permitindo que o `Ctrl+Z` atravesse regenerações destrutivas com integridade matemática.
   - Desfazer/refazer inclui cores (também `X`), largura/altura, margem e espaçamento. Cada gesto contínuo confirma uma etapa ao concluir o campo; `Escape` cancela o preview, sem descartar redo. Valores sem alteração não criam etapas.
   - Redimensionar a prancheta preserva células e travas. Campos opcionais ausentes em snapshots antigos conservam o estado atual. Zoom, navegação, foco e filtros não entram nesse histórico; o recorte `clipToTile` usa o histórico independente da família.

---

## Saída em Tempo Real via Spout (`core/spout_output.js`)

Para integração com softwares de projeção mapeada, VJs e instalações audiovisuais (Resolume, TouchDesigner, OBS Studio, MadMapper):
- Renderização offscreen isolada em buffer `p5.Graphics` no tamanho nativo do artboard.
- A saída transmite apenas a obra limpa (sem guias de eixos, sem zoom de tela e sem cursores de hover).
- Detecção inteligente de alterações (`artifactSignature`) evitando overhead de transmissão de quadros idênticos.
- Bridge WebSocket em Python (`tools/spout_bridge.py` / `tools/spout_bridge.cmd`) conectando o navegador ao servidor SpoutGL da GPU a até 20 quadros por segundo.

---

## Arquitetura de UI — As Quatro Superfícies

A interface adota a taxonomia de quatro superfícies estritas com responsabilidades dedicadas:

1. **Barra Superior (`#top-control-bar` — O Documento)**:
   - Artboard: Largura ($W$), Altura ($H$), Inversão ($W \rightleftarrows H$), Trava de proporção e Ajustar à Grade.
   - Grade: Linhas ($L$), Colunas ($C$), Inversão ($L \rightleftarrows C$), Trava de proporção, Células quadradas 1:1, Margem externa em px e Respiro percentual do bloco (`#paddingInput`).
   - Zero rolagem horizontal nos monitores 1440×900 e 1280×800 (`scrollWidth <= clientWidth`).

2. **Barra Lateral Esquerda (`#left-toolbar` — Ferramentas e Ações)**:
   - Estrutura em duas colunas compactas reunindo:
     - 7 Ferramentas essenciais: Inspecionar (`V`), Pincel (`B`), Girar (`R`), Carimbo (`S`), Travar Subtiles (`F`), Pan (`H`) e Zoom (`Z`).
     - Guias visuais: Eixos (`A`), Blocos (`Shift+B`), Subtiles (`M`) e Órbitas (`O`).
     - Widget de cores sobrepostas estilo Photoshop/Illustrator (`.color-tool-section`) com botão de inversão rápida (`X`).
     - Painel do Gerador: Botão de sorteio aleatório (`G`), input de Seed (#), navegação (◀ ▶) e lista permanente de histórico de sementes.
     - Exportação: Seleção de formato (PNG/SVG) e botão de download.

3. **Barra Inferior de Status (`#status-bar` — A Visão e Saída)**:
   - Zona esquerda: Grupo de zoom integrado (`.zoom-widget`) com `[−] [100% ▾] [+] [Ajustar] [1:1]`.
   - Zona central: Dimensões em pixels, contagem de grade/órbitas e Inspetor de Hover com reticências automáticas (`text-overflow: ellipsis`) em resoluções compactas.
   - Zona direita: Controles de streaming Spout (`#spoutToggle`, `#spoutName`), indicador de status de conexão e Central de Ajuda (`#btnHelp` / `?`).

4. **Dock Lateral Direito (`#right-dock` — Propriedades e Contexto)**:
   - **Painel Contextual Dinâmico**: Exibe automaticamente as opções da ferramenta ativa (`inspect` exibe parâmetros de geração e famílias de tiles; `paint` exibe tamanho de pincel, Supertile e paleta; `rotate` exibe modos de giro; `stamp` exibe opções de cópia; `freeze` exibe modos de congelamento).
   - **Gaveta Recolhida (`body.right-dock-collapsed`)**: Dock recolhe para régua vertical de 44 px (`--dock-rail-w: 44px`), ocultando os painéis roláveis e expandindo a área útil do canvas em ~306 px.

---

## Testes Automatizados

O projeto conta com **44 suítes de teste automatizadas** executadas diretamente via Node.js puro sem dependências ou frameworks externos:

```powershell
# Executar todas as 44 suítes de teste:
node tests/run_all.js
```

### Cobertura das 44 Suítes:
1. **Álgebra D4 & Axiomas de Grupo**:
   - `test_tile_registry.js`: 85 renderers vetoriais, axiomas do grupo D4 (Identidade, Inversa, Composição e Fechamento de Família).
   - `test_d4_invariance.js`: Invariância matemática estrita D4/C4/D2 em grades 1×1 a 5×5 (168.960 asserções), modo Caleidoscópio e fallback para Tile Vazio #84.
   - `test_d4_block_combinations.js`: Validação da matriz completa de 20 combinações Grade × Bloco e detecção de redução de simetria.
   - `test_d4_editor.js`: Contrato de transparência D4 no Editor, detecção de quebra em eixos e modo Caleidoscópio livre.
   - `test_d4_badge_state.js`: Comportamento do badge D4 editado com restauração precisa no histórico de desfazer (undo/redo).
2. **Motor de Mosaico**:
   - `test_mosaic_engine.js`: Geração vetorial, renderização, contagem de primitivas e modos de simetria do motor.
3. **Persistência de Estado, Quota & Histórico**:
   - `test_state_persistence.js`: Serialização de estado completo, 15 edições em 3×3 blocos e restauração de histórico undo/redo.
   - `test_indexeddb_persistence.js`: Camada IndexedDB assíncrona, limites 256/100, tolerância a falhas e migração de localStorage.
   - `test_save_scheduler.js`: Agendador com debounce de 300 ms, cancelamento em flush síncrono e preservação em unload.
   - `test_storage_key.js`: Unificação na chave canônica `tiling_stripes_studio_v3_state` e isolamento de backups de migração.
   - `test_payload_version.js`: Validação estrita do schema versão 3 e migração segura de versões legadas.
   - `test_history_limits.js`: Trim-on-push, orçamento dinâmico de snapshots e migração de payloads antigos.
   - `test_persistence_quota.js`: Tratamento de erro de quota, gravação de fallback mínimo e restauração limpa.
   - `test_history_nav.js`: Navegação em histórico de geração com restauração preguiçosa e poda de snapshots acima do orçamento.
   - `test_history_edit_preservation.js`: Preservação de edições manuais ao navegar no histórico de sementes.
   - `test_document_snapshot.js`: Captura e restauração de parâmetros de documento integrados a snapshots de células.
   - `test_regeneration_capture.js`: Ordem de captura antes da geração destrutiva para permitir undo entre gerações.
   - `test_multistep_undo.js`: Desfazer e refazer múltiplos passos através de regenerações de semente e alterações de grade.
   - `test_dirty_guard.js`: Contrato do diálogo de proteção contra descarte acidental de edições (`#dirtyGuardDialog`).
4. **Arquitetura de UI, Navegação & Acessibilidade**:
   - `test_scope_chip.js`: Atualização dinâmica do chip de escopo de simetria refletindo seletores e atalhos.
   - `test_info_scopes_source.js`: Fonte canônica única para os 6 escopos de simetria conectando UI, popover e motor.
   - `test_info_aria.js`: Acessibilidade ARIA (`aria-expanded`, `aria-controls`, `aria-haspopup`) e foco nos componentes informativos.
   - `test_editor_ui_state.js`: Matriz de visibilidade do editor, seletores CSS `.hidden` e cursores de ferramentas.
   - `test_info_ui_state.js`: Validação dos 17 tópicos de informação, singleton popover/tooltip e widget Illustrator.
   - `test_viewport_pan_zoom.js`: Navegação de viewport, pan 2D contínuo via CSS transforms, atalhos de centralização 100% e ajuste.
   - `test_brush_sizing_snap.js`: Pincel com tamanhos inteiros não-cíclicos, ajuste ao bloco (`Ctrl+U` / `Shift`) e atalho da borracha (`E`).
   - `test_ui_control_registry.js`: Congelamento do inventário dos 60 controles com ID único em `index.html`.
   - `test_ui_layout_contract.js`: Contrato estrutural das superfícies (posições de dock, gaveta, zoom, cores e ferramentas).
5. **Consistência Documental**:
   - `test_docs_consistency.js`: Validação contínua da documentação contra assinaturas de funções e chaves reais do código.
6. **Sistema de Trava de Subtiles (Freeze)**:
   - `test_freeze_subtiles.js`: Preservação de células travadas durante novas gerações.
   - `test_freeze_generation.js`: Integração da lógica de freeze no pipeline de geração.
   - `test_freeze_wiring.js`: Conexão de eventos de UI da ferramenta de trava.
   - `test_freeze_state.js`: Serialização e restauração do conjunto de células travadas.
   - `test_freeze_undo.js`: Histórico de desfazer e refazer para operações de congelamento.
   - `test_freeze_ui_contract.js`: Contrato visual dos botões e controles de trava.
7. **Saída em Tempo Real & Exportação Vetorial SVG**:
   - `test_spout_output.js`: Sanitização de nomes de canal Spout, cálculo de assinatura de arte (incluindo `libraryRevision`) e contrato de comunicação via WebSocket.
   - `test_simple_svg_paths.js`: Exportação de curvas Bezier cúbicas, retângulos arredondados, caminhos compostos com furos (`evenodd`) e `<clipPath>` em `SimpleSVG`.
8. **Motor Vetorial de Subtiles, Detecção D4 & Biblioteca JSON**:
   - `test_vector_renderer.js`: Primitivas normalizadas em `[-0.5, 0.5]`, lei de composição algébrica $D_4$ nos 64 pares $(g_1, g_2)$ e compatibilidade p5/`SimpleSVG`.
   - `test_d4_detect.js`: Classificação exata dos 10 subgrupos de $D_4$ (órbitas de 1, 2, 4 e 8 variantes) em estêncil diádico $64 \times 64$.
   - `test_library_compiler.js`: Paridade regressiva 1:1 dos 85 tiles built-in (`0..84`, `#84` Vazio blindado) e geração `mandala_d4` com famílias quirais de 8 variantes.
   - `test_library_store_crud.js`: CRUD persistente de grupos e famílias, duplicação de built-ins, remapeamento de IDs e *tombstone* $\to$ `#84`, import/export `.json` e hidratação assíncrona IndexedDB.
   - `test_tile_studio_ui_contract.js`: Chaveamento `data-studio-mode="mosaic|tiles"`, ordenação reativa de grupos/famílias (`getOrderedGroupedFamilies`), auto-matrícula em `allowedTiles`, sanitização `#84`, preview $D_4$ e isolamento de atalhos.
   - `test_vector_editor_ops.js`: Grade magnética (`0..16`) e *smart snap*, criação paramétrica e presets `1/3`, conversão `convertShapeToPath` com paridade $D_4$/SVG, subdivisão De Casteljau e edição de nós/alças Bezier, *undo/redo* por família e fluxo ponta-a-ponta até exportação SVG de mosaico `mandala_d4`.
- `test_vector_boolean_svg.js`: Booleanas Paper.js headless (`unite`, `subtract`, `intersect`, `exclude`) com curvas e linhas traçadas, furos compostos `evenodd`, transformações $D_4$ na seleção, operações de camadas, importação SVG (primitivas, `<g transform>`, `viewBox`), *round-trip* de exportação e fluxo ponta-a-ponta (booleana + SVG → edição de nós → $D_4$ → mosaico `mandala_d4` → SVG).

---

## Atalhos de Teclado

### Ferramentas e Modos
- `Ctrl + E`: Alternar entre o Mosaico e o Estúdio de Subtiles & Famílias (Ctrl+E ou Voltar ao mosaico retorna; Escape cancela o gesto ou limpa seleção)
- `V`: Ferramenta Inspecionar (abre configurações de Geração no dock)
- `B`: Ferramenta Pincel (restaura o padrão, tamanho e encaixe do último pincel não vazio)
- `E`: Borracha (sempre ativa o Tile Vazio #84; repetir E mantém a borracha)
- `R`: Ferramenta Girar
- `S`: Ferramenta Carimbo (`C` ativa o modo de captura)
- `F`: Ferramenta Preservar peças (`Shift + F` limpa todas as travas)
- `H`: Ferramenta Mão
- `Z`: Ferramenta Zoom
- `X`: Inverter cores de Primeiro Plano e Fundo (Swatches)

### Edição e Pincel
- `Q` / `Tab`: Ciclar entre os 6 escopos de simetria (`Shift + Q` / `Shift + Tab` cicla no sentido inverso)
- `[` / `]`: Girar o pincel/supertile ativo em -90° / +90°
- `Ctrl + U`: Alternar Ajuste ao Bloco (*Snap to Block*)
- `Shift` (manter): Inverter temporariamente o ajuste ao bloco durante a pintura
- Roda do Mouse (sem modificadores): Redimensionar o diâmetro do pincel (números inteiros não-cíclicos)
- `Ctrl + Z`: Desfazer última edição ou geração
- `Ctrl + Y` ou `Ctrl + Shift + Z`: Refazer ação desfeita

### Viewport e Prancheta
- `1` / `Shift + 1` / `Ctrl + 1`: Recentralizar a prancheta com zoom em 100% (1:1)
- `0` / `Ctrl + 0`: Ajustar o artboard inteiro à janela visível
- `Espaço + Arrasto` ou Botão do Meio: Pan 2D contínuo
- `Ctrl + Roda do Mouse`: Zoom suave sob o cursor

### Guias e Documento
- `G`: Sortear nova semente aleatória (*Seed*)
- `◀` / `▶` (Setas Esquerda / Direita): Navegar pelo histórico de sementes geradas
- `A`: Mostrar/ocultar eixos de simetria
- `Shift + B`: Mostrar/ocultar grade de blocos
- `M`: Mostrar/ocultar grade de subtiles
- `O`: Mostrar/ocultar mapa de órbitas
- `?`: Abrir Central de Ajuda e Atalhos (Popover)
- `Escape`: Fechar popovers de ajuda ou diálogos ativos

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


A exclusão de uma família pede apenas a confirmação da ação e informa seu uso; não baixa backup automaticamente nem limpa o histórico vetorial das outras famílias. Exportar a biblioteca continua disponível quando desejado. Referências à família excluída continuam sendo convertidas para o Tile Vazio (#84). A guia visual **Subtiles** usa ciano com a mesma espessura e opacidade dos limites de blocos (1,5 px; alfa 165/255), sem contorno adicional; a guia Blocos usa lilás para diferenciar as escalas; continua opcional e não aparece nas exportações nem na saída Spout.


O grupo **Backup da biblioteca** fica sempre acessível na barra esquerda do criador, reunindo exportação (.json), importação e restauração. Na confirmação de exclusão de família, a opção **Baixar backup da biblioteca antes de excluir (.json)** começa desmarcada; marque-a para baixar o estado anterior à exclusão. Cancelar não baixa backup nem exclui. Fazer backup não apaga o histórico de edição vetorial. O **Gerador** fica visível por padrão, e o cabeçalho **Histórico** permanece acessível logo abaixo, com sua lista recolhível.

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

`style.css` define os papéis semânticos de painel, campo, hover, seleção, texto, borda funcional, foco, aviso e erro em `:root`. Botões/campos comuns usam 32 px, ações de lista têm alvo mínimo 28×28 px, texto funcional usa 12 px e valores numéricos usam 13 px. A barra esquerda usa 216 px; o rodapé fica na coluna da prancheta, entre as barras laterais, com altura mínima de 36 px; a ordem das quatro superfícies permanece igual. Bordas decorativas podem ser discretas; controles essenciais usam `--border-control`. Foco é um contorno externo de 2 px, separado do preenchimento de seleção. Guias ligadas têm fundo neutro e marca lateral; o pasteboard não usa pontos.

A pele comum fica junto às regras base, com variantes junto ao componente. Evite reintroduzir tamanhos/cores concorrentes ao fim da folha. Nomes de papéis antigos não resolvidos foram substituídos; `--font-mono` está definido. `test_visual_tokens.js` verifica referências CSS e inline, contraste dos pares semânticos (texto ≥4,5:1; indicadores essenciais ≥3:1), escala e segurança dos ícones.

`UiFormat.icon` fornece SVGs de comando com viewBox 24×24, desenho de 16 px e traço de 1,75, escondidos da árvore acessível; seus botões mantêm nome por aria-label/título. Alinhamento, ordenação, cópia, edição, exclusão, undo/redo e controles pequenos usam essa família. Tooltips aceitam quebra de linha e limites da viewport, funcionam por foco/ponteiro e associam `aria-describedby` sem apagar descrições anteriores. Avisos e falhas mantêm texto e ações; a mudança de tema não altera as cores da obra, a matemática ou o formato salvo.

Correção da T07: dimensões de controles especiais são independentes da pele comum (Spout 40×24 px, marca informativa de 16 px dentro de alvo de 28 px). Campos conservam borda funcional; ações usam superfícies discretas e espaçamento interno. A barra superior quebra por grupos até 1400 px. Mensagens ficam dentro da área de trabalho, acima do rodapé. A ajuda separa mosaico/editor e ferramentas/ações, com corpo rolável e cabeçalho fixo.

Ajuda contextual: os tópicos usam títulos curtos e listas sem subtítulo técnico. Itens são filhos de uma lista semântica, com espaçamento e rolagem próprios; textos dos escopos continuam derivados de `MosaicEngine.EDIT_SCOPES`. Camadas e Biblioteca concentram instruções nos popups para evitar repetições permanentes nos painéis.

### Campos acessíveis e edição numérica (T08)

`core/ui_fields.js` associa os rótulos das propriedades a IDs estáveis e fornece nomes completos com unidades (pixels, porcentagem, graus ou unidades da peça). Os IDs legados são preservados. A regra final de foco mantém o contorno visível nos próprios campos, sem duplicá-lo no contêiner.

Enter confirma um número válido; Escape restaura o valor anterior e cancela a prévia de margem/espaçamento sem criar undo. Valores vazios, não finitos, inteiros inválidos e valores fora dos limites do controle são bloqueados antes dos handlers do documento. O erro recebe `aria-invalid` e descrição acessível; sair de um campo inválido cancela o rascunho. O atributo step continua sendo incremento, permitindo por exemplo largura de 900 px com passo de 50.

As três buscas (gerador, pincel e biblioteca) têm nome independente do placeholder, botão Limpar que retorna o foco ao campo e contador de resultados anunciado. O contador respeita os filtros existentes; não redefine a seleção de peças nem os atalhos do canvas. Os testes ficam em `tests/test_ui_fields.js`.

Ajuste de densidade após T08: a busca ocupa uma linha, com limpeza por × apenas quando há texto. A contagem permanece anunciada, mas não ocupa uma linha visual; busca vazia de resultados mostra “Nenhum resultado”. Dicas de tamanho/encaixe ficam na ajuda. Guias ligadas mantêm a marca lateral sem borda adicional. Alinhar/transformar exige seleção; Pathfinder permanece visível e habilita operações com duas ou mais formas elegíveis. Rótulos completos, foco e validação numérica são preservados; erros exibem somente a mensagem necessária.

### Gerador por composição e famílias (T09)

A simetria da composição mantém os quatro modos existentes. A simetria do bloco apresenta as cinco opções diretamente, incluindo Igual à composição. Documentos novos começam sincronizados; documentos restaurados mantêm a opção independente salva. Os botões 2×2, 4×4, 6×6 e 8×8 representam o bloco completo; `data-sub` continua de 1 a 4 por quadrante.

Peças permitidas mostra famílias com miniatura, contador e seleção total/parcial/vazia. Variantes ficam sob expansão; buscar revela as correspondências e limpar restaura a expansão manual. Isolar família/conjunto oferece Restaurar seleção; alternar entre isolamentos conserva a seleção inicial. Uma alteração manual invalida o isolamento anterior. Todos/Nenhum/Inverter mantêm o alcance de toda a biblioteca, inclusive itens ocultos pela busca (informado no título dos controles). Gerar e semente permanecem à esquerda. Estado de expansão e isolamento é temporário; não altera o schema v3.

Revisão visual após T09: as cinco opções do bloco ficam sempre visíveis. Botões de simetria e ferramentas dos dois ambientes compartilham superfícies neutras, preenchimento de seleção e foco explícito; contornos decorativos usam `--border-subtle` (#36393f). `--border-control` continua reservado aos indicadores funcionais que precisam de destaque. O rodapé pertence a `#workspace-viewport`; abaixo de 640 px de coluna ele quebra em duas linhas, mantendo Zoom/Spout/Ajuda acessíveis. Em colunas até 1050 px, os textos de inspeção/salvamento permanecem anunciados, sem disputar espaço visual com controles. O gerador usa rolagem externa para manter a lista de famílias alcançável com as opções do bloco abertas.

O grupo de zoom do rodapé usa pintura isolada (`translateZ(0)`) e não recorta seus controles (`overflow: visible`), evitando desaparecimento visual ao alternar entre mosaico e editor ou redimensionar a janela. O rodapé continua limitado à coluna central pelo layout responsivo.

### Ferramentas, Pathfinder e aviso de regeneração

Nomes revisados no catálogo de comandos: Inspeção, Pincel, Girar, Carimbo, Preservar, Mão e Zoom no mosaico; Seleção, Seleção direta, Caneta, Retângulo, Elipse, Polígono, Arco e Linha no editor. Seleção direta pode ocupar duas linhas sem reticências; nomes completos e atalhos permanecem nos tooltips. Preservar mantém a denominação própria do produto, pois não bloqueia a edição manual.

Pathfinder permanece visível nas abas Camadas/Propriedades, inclusive em peças protegidas. Unir, Menos frente, Interseção e Excluir ficam habilitados com duas ou mais formas visíveis e destravadas em uma cópia editável. Peças protegidas mostram a necessidade de criar cópia. As operações mantêm undo/redo.

“Não perguntar nesta sessão” passa a respeitar a sessão da aba via sessionStorage, inclusive após reload e em mudanças de grade com perda de preservações. A preferência é gravada ao confirmar Regenerar; Cancelar não grava a opção. Se sessionStorage estiver indisponível, a preferência continua funcionando em memória até recarregar. Alterações continuam recuperáveis pelo histórico.

### Seleção, transformação e recorte — 28/10/2026

No editor vetorial, os botões de giro e espelhamento usam o centro da caixa da seleção desbloqueada, como a alça de rotação. A Seleção direta permite arrastar o corpo de objetos; nós e alças continuam editáveis individualmente. Alt+arraste no corpo duplica a seleção uma única vez, preservando os originais. Um Alt+clique não duplica; cancelar o arrasto descarta a cópia provisória e restaura a seleção original.

Na barra lateral esquerda do mosaico, Retângulo (Shift+M) e Pincel de seleção (W) selecionam células inteiras. Arrastar dentro da região move seu conteúdo, mantendo o ponto de pega; arrastar fora dela inicia outra seleção. O movimento só altera a origem ao soltar em um destino válido e gera uma única entrada de desfazer. Escape cancela o gesto sem apagar células. O pincel usa diâmetro independente, ajustável por −/+, roda ou botões, e interpola eventos rápidos sem lacunas. S ativa Clonar para aplicar cópias da região capturada, sem apagar a fonte; C/Alt+arraste recapturam. T alterna as duas ferramentas. A seleção não replica por simetria; a clonagem usa o escopo ativo. Botões separados de Estampar, Mover e Capturar região foram retirados. O laço foi removido e L permanece disponível apenas como Elipse no editor vetorial. A origem da seleção é transitória e invalidada por regeneração, restauração ou recarga.

Ferramentas, guias, simetrias, escopos, biblioteca, importação/exportação, pincel e propriedades usam ícones com nomes curtos e acessíveis nos tooltips, também disponíveis pelo foco. Valores numéricos, abas, nomes do usuário e confirmações mantêm texto. Instruções ficam na ajuda ou nos tooltips; não acrescentar tutoriais, avisos de sucesso ou descrições redundantes aos painéis. A captura mostra apenas as dimensões durante o gesto. `tests/test_region_transfer.js` cobre sobreposição, máscaras, limites, preservações e cancelamento da duplicação; os testes vetoriais cobrem o pivô e Alt+arraste. Gate: 52 suítes.


### Espaço dos ícones e atalhos de seleção — 28/10/2026

A barra esquerda tem 120 px e o painel direito tem 304 px, preservando ferramentas em duas colunas e o rodapé entre as laterais. Ações com ícones usam alvos de 34×34 px, com intervalos de 4 px; ações auxiliares nos títulos usam 28 px. Simetrias, escopos, propriedades e biblioteca não esticam os botões para ocupar antigas colunas de texto. Encaixe compartilha a linha do tamanho do pincel e Ampliar fica junto do nome da prévia. Histórico mantém rolagem própria e Exportar permanece alcançável em 900×768.

Os comandos `selectRect` e `selectBrush` no catálogo compartilhado acionam a mesma função dos cliques e fornecem nomes, tooltips e ajuda. Atalhos respeitam campos, janelas modais e o ambiente: L continua sendo Elipse no editor vetorial. A seleção permanece destacada após a captura; Clonar recebe destaque apenas ao escolher S ou seu botão.


### Fluxo de seleção e clonagem — revisão de 28/10/2026

Durante a seleção, o painel lateral direito cede lugar à prancheta. Uma barra contextual compacta no canto superior mostra área, quantidade de peças, limpar e os mesmos controles de desfazer/refazer. O tamanho aparece nessa barra apenas para o pincel de seleção. Os controles são movidos de volta aos seus painéis ao trocar de ferramenta, preservando handlers e IDs. Gerador, biblioteca e propriedades conservam o painel direito de 304 px; o rodapé continua na coluna da prancheta. O ícone do pincel de seleção combina contorno tracejado, células e sinal de adição. Criar cópia nas Propriedades usa o mesmo `UiFormat.icon('copy')` da Biblioteca.

Os ícones de Pathfinder usam preenchimento para indicar o resultado: Interseção destaca a área comum e Excluir deixa essa área vazia. Propriedades e Biblioteca compartilham o ícone de cópia; setas de importação, exportação, camadas e histórico seguem a mesma escala.

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
│   ├── mosaic_engine.js       # Geração macro/micro, escopos de edição, render e snapshots de células
│   ├── state_persistence.js   # Lógica pura de persistência (IndexedDB + localStorage), quotas e histórico
│   ├── history_nav.js         # Navegação preguiçosa no histórico de geração, orçamento e snapshots
│   ├── document_snapshot.js   # Captura e aplicação de snapshots de parâmetros do documento para undo entre gerações
│   ├── spout_output.js        # Sanitização de nomes, probe de mudanças e formatação de quadros para saída Spout
│   └── ui_format.js           # Formatadores puros de rótulos de escopos de simetria e interface
├── tests/                     # Suíte com 41 testes automatizados em Node.js puro
├── tools/                     # Bridge local WebSocket -> SpoutGL em Python (spout_bridge.py / .cmd)
├── ui_info.js                 # Motor de divulgação progressiva (13 tópicos, popovers e tooltips acessíveis)
├── libraries/                 # Bibliotecas p5.min.js e simple-svg.js
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
- **🧹 Borracha (`E`)**: Alterna rapidamente o pincel ativo para o Tile Vazio (#84), permitindo abrir respiros e apagar células preservando a rotação e o escopo de simetria.
- **↻ Girar (`R`)**: Clique esquerdo gira a área em +90°; clique direito gira em -90°. Suporta rotação geométrica D4 ou ciclar variações da mesma família.
- **⧉ Clonar / Carimbo (`S`)**: Arraste para capturar uma região do mosaico e clique para colar com a simetria ativa (tecla `C` troca para modo de captura).
- **🔒 Travar Subtiles (`F`)**: Congela subtiles do mosaico para torná-los imunes a novas gerações ou sorteios de semente (`G`). Ação monotônica com modos de congelar e descongelar. Tecla `Shift+F` limpa as travas ativas.
- **✋ Mão / Pan (`H`)**: Move o artboard no pasteboard (também acessível mantendo pressionada a barra de `Espaço` ou com `Alt + Arrasto`).
- **🔎 Zoom (`Z`)**: Aproxima e afasta o canvas com precisão (ou através de `Ctrl + Roda do Mouse`).
- **Controle de Cores Estilo Illustrator**: Swatches sobrepostos de Primeiro Plano e Fundo localizados na barra lateral esquerda (`#left-toolbar`), com botão de inversão rápida (`⇄`) e atalho de teclado `X`.

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
   - Preserva até 256 gerações e até 100 etapas de desfazer/refazer edições manuais.

2. **`localStorage` (`tiling_stripes_studio_v3_state`)**:
   - Cache síncrono ultrarrápido para carregamento instantâneo no boot.
   - Histórico delimitado dinamicamente com orçamento dinâmico proporcional à grade.
   - Gerenciado pelas funções puras: `isQuotaError`, `getMaxEditHistoryForMosaic`, `trimHistoryOnPush`, `migratePayloadHistories`, `buildMinimalEmergencyPayload`, `saveWithQuotaFallback`, `createSaveScheduler` e `validatePayloadVersion`.
   - **Fallback Automático de Quota**: Caso a cota do navegador seja excedida (`QuotaExceededError`), um payload mínimo com o desenho completo e parâmetros essenciais é gravado, preservando o trabalho do usuário e exibindo o aviso `#persistenceWarning`.

3. **Snapshots de Documento (`core/document_snapshot.js`)**:
   - Associa parâmetros macro a cada snapshot de célula, permitindo que o `Ctrl+Z` atravesse regenerações destrutivas com integridade matemática.

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

O projeto conta com **41 suítes de teste automatizadas** executadas diretamente via Node.js puro sem dependências ou frameworks externos:

```powershell
# Executar todas as 41 suítes de teste:
node tests/run_all.js
```

### Cobertura das 41 Suítes:
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
   - `test_info_ui_state.js`: Validação dos 13 tópicos de informação, singleton popover/tooltip e widget Illustrator.
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

---

## Atalhos de Teclado

### Ferramentas e Modos
- `V`: Ferramenta Inspecionar (abre configurações de Geração no dock)
- `B`: Ferramenta Pincel (se o tile ativo era borracha, restaura o tile anterior)
- `E`: Borracha (alterna entre o tile anterior e o Tile Vazio #84)
- `R`: Ferramenta Girar
- `S`: Ferramenta Carimbo / Clonar (`C` ativa o modo de captura)
- `F`: Ferramenta Travar / Congelar Subtiles (`Shift + F` limpa todas as travas)
- `H`: Ferramenta Pan (Mão)
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
- `Espaço + Arrasto` ou `Alt + Arrasto` ou Botão do Meio: Pan 2D contínuo
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

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
│   ├── tile_edge_signatures.js # Pré-processamento de bordas: IDs de preenchimento/fundo por lado do subtile
│   ├── vector_editor.js       # Motor vetorial interativo [-0.5, 0.5] (8 ferramentas, Bezier, snap, undo/redo)
│   ├── vector_boolean.js      # Booleanas Paper.js headless, transformações D4 na seleção, camadas e I/O SVG
│   ├── subtile_studio_ui.js   # Modo Estúdio de Subtiles (data-studio-mode="tiles"), grupos/famílias e preview D4
│   ├── mosaic_engine.js       # Geração macro/micro, escopos de edição, render e snapshots de células
│   ├── state_persistence.js   # Lógica pura de persistência (IndexedDB + localStorage), quotas e histórico
│   ├── history_nav.js         # Navegação preguiçosa no histórico de geração, orçamento e snapshots
│   ├── document_snapshot.js   # Captura e aplicação de snapshots de parâmetros do documento para undo entre gerações
│   ├── spout_output.js        # Sanitização de nomes, probe de mudanças e formatação de quadros para saída Spout
│   └── ui_format.js           # Formatadores puros de rótulos de escopos de simetria e interface
├── tests/                     # Suíte com 60 testes automatizados em Node.js puro
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
- **Encaixe por Bordas (`#toggleEdgeMatch`)**: Novo modo de geração. Antes de montar o mosaico, cada tile é pré-processado em quatro assinaturas de borda (máscara de tinta, intervalos de preenchimento/fundo, regiões conectadas e um ID estável). A geração escolhe as peças canônicas de cada bloco para maximizar a continuidade das regiões claras entre vizinhos, usando o ID como prioridade. O encaixe é suave: um casamento imperfeito ainda é aceito, mas perde prioridade. Duas bordas sem tinta não contam como encaixe, para o vazio não se propagar pelo mosaico. A estrutura de simetria e os estabilizadores D4 continuam valendo; apenas os tiles canônicos são escolhidos, e todas as réplicas continuam derivadas por D4. O caminho é otimizado com cache de perfis/pontuações, pré-filtro de candidatos por máscara exata/cobertura e visita apenas às variáveis vizinhas afetadas na segunda passada. Na interface ele é o interruptor **Bordas** (ícone de duas peças), com o nome completo no hover e a explicação no popover de info.
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
- **Controle de Cores Estilo Illustrator**: Par de amostras lado a lado (Peça e Fundo) na barra lateral esquerda (`#left-toolbar`), com prévia que preenche todo o chip, inversão rápida (`⇄`) e atalho `X`. Rótulos ficam em `title`/`aria-label`, como nas demais ações da coluna.

### 3. Modo Estúdio de Subtiles & Gestão de Famílias (`Subtiles` / `Ctrl+E`)
Ambiente integrado na mesma janela (`data-studio-mode="tiles"`) respeitando as 5 superfícies da UI e mantendo a saída Spout do mosaico ao vivo:
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

## Arquitetura de UI — As Cinco Superfícies

A interface adota a taxonomia de cinco superfícies estritas com responsabilidades dedicadas:

1. **Barra Superior (`#top-control-bar` — O Documento)**:
   - Artboard: Largura ($W$), Altura ($H$), Inversão ($W \rightleftarrows H$), Trava de proporção e Ajustar à Grade.
   - Grade: Linhas ($L$), Colunas ($C$), Inversão ($L \rightleftarrows C$), Trava de proporção, Células quadradas 1:1, Margem externa em px e Respiro percentual do bloco (`#paddingInput`).
   - Zero rolagem horizontal nos monitores 1440×900 e 1280×800 (`scrollWidth <= clientWidth`).

2. **Barra Lateral Esquerda (`#left-toolbar` — Ferramentas)**:
   - Estrutura em duas colunas compactas reunindo:
     - 7 Ferramentas essenciais: Inspecionar (`V`), Pincel (`B`), Girar (`R`), Carimbo (`S`), Travar Subtiles (`F`), Pan (`H`) e Zoom (`Z`).
     - Guias visuais: Eixos (`A`), Blocos (`Shift+B`), Peças (`M`) e Órbitas (`O`), em grade 2×N de 48×38 px com estado ativo igual ao das ferramentas.
     - Par de cores Peça/Fundo (`.illustrator-color-widget`) em chips de 32 px com prévia de 24 px e botão fantasma de inversão (`X`).
   - A coluna segue o padrão do Illustrator: só ferramentas, guias e cores.

3. **Barra Inferior de Status (`#status-bar` — A Visão e Saída)**:
   - Zona esquerda: Grupo de zoom integrado (`.zoom-widget`) com `[−] [100% ▾] [+] [Ajustar] [1:1]`.
   - Zona central: Dimensões em pixels, contagem de grade/órbitas e Inspetor de Hover com reticências automáticas (`text-overflow: ellipsis`) em resoluções compactas.
   - Zona direita: Controles de streaming Spout (`#spoutToggle`, `#spoutName`), indicador de status de conexão e Central de Ajuda (`#btnHelp` / `?`).

4. **Trilho de Utilitários (`#utility-rail` — Ferramentas de Documento)**:
   - Faixa vertical de 40 px entre o canvas e o dock direita, pensada para ferramentas de documento que abrem flyout para a esquerda, sobre o canvas.
   - Primeiro ocupante: **Histórico (`#dock-history`)** com o botão `#btnToggleHistory`; a lista (`#seedHistoryList`) abre à esquerda do trilho, com rolagem interna, sem cobrir nem encolher o dock.
   - O trilho é `mosaic-mode-only`: some no criador de peças, devolvendo a largura ao canvas.

5. **Dock Lateral Direito (`#right-dock` — Propriedades e Contexto)**:
   - **Gerador (`#dock-generator`)**: faixa fixa logo abaixo do cabeçalho do dock, com o botão **Gerar** (`G`) e a navegação de sementes (`#seedInput`, `#btnPrevSeed`, `#btnNextSeed`). Permanece visível tanto no contexto de geração quanto no de edição.
   - **Exportar (`#dock-export`)**: faixa fixa no rodapé do dock, com seletor PNG/SVG (`#exportFormatSelect`) e botão de download (`#btnExport`), alcançável sempre que o dock estiver aberto no modo mosaico.
   - **Painel Contextual Dinâmico**: Exibe automaticamente as opções da ferramenta ativa (`inspect` exibe parâmetros de geração e famílias de tiles; `paint` exibe tamanho de pincel, Supertile e paleta; `rotate` exibe modos de giro; `stamp` exibe opções de cópia; `freeze` exibe modos de congelamento).
   - **Gaveta Recolhida (`body.right-dock-collapsed`)**: Dock recolhe para régua vertical de 44 px (`--dock-rail-w: 44px`), ocultando os painéis roláveis, o gerador e a exportação e expandindo a área útil do canvas.

### Iconografia

Todo ícone da interface vem do registro único em `core/ui_format.js` (`ICON_PATHS`, 111 glifos). O `index.html` declara apenas slots (`<span class="icon-slot" data-icon-slot="nome">`) que `UiFormat.hydrateIcons()` troca pelo SVG canônico no boot; `sketch.js` e `core/subtile_studio_ui.js` chamam `UiFormat.icon(nome, tamanho)`.

- Grade de 24 × 24 com área viva de 20 × 20 e traço 1,75 em 16 px, ajustado por tamanho para manter o peso óptico.
- Escala de tamanhos 12 / 14 / 16 / 18 / 22 px; `fill` só para resultado, área preenchida, cópia espelhada e a caneta (glifo sólido de `pen-tool-svgrepo-com.svg`).
- Um nome por significado; aliases gráficos são declarados no teste (`flipX` / `mirror` / `symmetry`).
- Tamanho e traço não são mais definidos por CSS: o registro é a fonte da verdade.
- Contrato: `tests/test_icon_system.js`. Diagnóstico e decisões em [`docs/ux/REVISAO_ICONES_2026-10-29.md`](docs/ux/REVISAO_ICONES_2026-10-29.md).

---

## Testes Automatizados

O projeto conta com **60 suítes de teste automatizadas** executadas diretamente via Node.js puro sem dependências ou frameworks externos:

```powershell
# Executar todas as 60 suítes de teste:
node tests/run_all.js
```

### Cobertura das 60 Suítes:
1. **Álgebra D4 & Axiomas de Grupo**:
   - `test_tile_registry.js`: 85 renderers vetoriais, axiomas do grupo D4 (Identidade, Inversa, Composição e Fechamento de Família).
   - `test_d4_invariance.js`: Invariância matemática estrita D4/C4/D2 em grades 1×1 a 5×5 (168.960 asserções), modo Caleidoscópio e fallback para Tile Vazio #84.
   - `test_d4_block_combinations.js`: Validação da matriz completa de 20 combinações Grade × Bloco e detecção de redução de simetria.
   - `test_d4_editor.js`: Contrato de transparência D4 no Editor, detecção de quebra em eixos e modo Caleidoscópio livre.
   - `test_d4_badge_state.js`: Comportamento do badge D4 editado com restauração precisa no histórico de desfazer (undo/redo).
2. **Motor de Mosaico & Encaixe de Bordas**:
   - `test_mosaic_engine.js`: Geração vetorial, renderização, contagem de primitivas e modos de simetria do motor.
   - `test_edge_signatures.js`: Pré-processamento dos 85 tiles em IDs de borda de preenchimento/fundo, regiões conectadas, remapeamento D4 e pontuação de encaixe.
   - `test_edge_match_generation.js`: Novo modo de geração, melhora mensurável da continuidade, determinismo por seed, invariância D4, paletas restritas e células congeladas.
   - `test_edge_match_ui.js`: Checkbox único, rótulo, ordem de carregamento, alternância do modo e parâmetro `edgeMatch` em snapshots de documento.
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
   - `test_ui_microcopy.js`: Regra de microcopy do chrome, nome curto, ícone antes do texto, tooltip, tópico de info existente e ausência de frases explicativas permanentes.
   - `test_viewport_pan_zoom.js`: Navegação de viewport, pan 2D contínuo via CSS transforms, atalhos de centralização 100% e ajuste.
   - `test_brush_sizing_snap.js`: Pincel com tamanhos inteiros não-cíclicos, ajuste ao bloco (`Ctrl+U` / `Shift`) e atalho da borracha (`E`).
   - `test_ui_control_registry.js`: Congelamento do inventário dos 60 controles com ID único em `index.html`.
   - `test_ui_layout_contract.js`: Contrato estrutural das superfícies (posições de dock, gaveta, zoom, cores e ferramentas).
   - `test_visual_tokens.js`: Tokens CSS resolvidos, contraste dos papéis semânticos e renderização segura dos ícones de comando.
   - `test_visual_system_v2.js`: Contrato da reforma visual (rótulo de Gerar, escala tipográfica, geografia e alvos mínimos).
   - `test_icon_system.js`: Registro único de ícones, grade 24 × 24, pesos ópticos, aliases explícitos e hidratação dos slots do `index.html`.
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

Graphify: `.\venv\Scripts\python.exe -m graphify query "símbolo"`. Sincronização: `scripts/sync_knowledge.ps1`. Abra `_local/obsidian_vault` como vault no Obsidian e use `INICIO_WORKSPACE.md`; o grafo AST e suas notas são artefatos locais ignorados pelo Git. A suíte agora reúne 60 testes; os 60 controles congelados pertencem ao contrato original do mosaico, não ao total de elementos do novo Estúdio.

O botão **Editar peças** fica na grade de ferramentas da barra esquerda. Ao abrir o criador, ele muda para **Voltar ao mosaico**, seguido pelas ferramentas vetoriais. Propriedades, camadas, órbita D4 e biblioteca continuam no dock direito. O atalho `Ctrl+E` alterna os modos.

As ferramentas do mosaico usam pares de mesma largura: Inspecionar/Subtiles, Pintar/Girar, Carimbo/Travar e Pan/Zoom. Na edição, grades e eixos globais aparecem apenas pelos botões de Guias Visuais; a prévia mantém a geometria fantasma e o contorno da área de ação, sem uma malha automática sobre as réplicas simétricas.

Tamanhos de Pintar/Carimbo, Girar e Travar usam o padrão **− | tamanho | +**, também acessível por `−`/`+` no teclado e roda do mouse sobre o canvas. Os tamanhos param nos limites, sem voltar ao início; botões indisponíveis ficam desativados. Girar e pintar alcançam a dimensão máxima do mosaico; Travar respeita o tamanho de um bloco. No pincel com ajuste ao bloco, o passo é um bloco. A indicação `linhas × colunas` preserva o tamanho real de carimbos retangulares. Os atalhos dos escopos são `Q`/`Tab`, com `Shift` para voltar.

A barra esquerda mantém ferramentas, guias e cores; o **Gerador** e o **Exportar** ficam no dock direito, e o **Histórico** no trilho de utilitários entre o canvas e o dock. O histórico começa recolhido e abre em flyout. No editor de peças, a barra esquerda reúne Ferramentas (incluindo Mão e Zoom), Guias Visuais e um atalho para Biblioteca. A organização de famílias tem página própria. Importar e exportar SVG ficam no menu Arquivo; backup, importação JSON e restauração ficam no menu Biblioteca. Os tamanhos de Girar e Travar têm apenas o controle − / medida / + e um botão independente para ajustar ao bloco; não há uma segunda linha de presets numéricos.

A prévia de Girar destaca todas as células alcançadas pelo escopo ativo, usando os mesmos alvos da operação. O contorno ciano delimita as regiões afetadas e o âmbar marca a origem. As bordas internas entre células vizinhas não são desenhadas, preservando a ausência de grade automática.

Girar opera sobre o conteúdo atual de cada região afetada pelo escopo. Réplicas simétricas leem suas próprias células editadas, em vez de receber uma cópia da região de origem. A direção do giro respeita os espelhamentos D4. Sobreposições só aplicam ciclos completos de movimentação de células para preservar o conteúdo; a prévia usa os mesmos alvos da operação. Pintar e Carimbo mantêm sua semântica de aplicação de um padrão.

O botão **Ampliar editor** abre um popup com canvas maior e paleta lado a lado; os mesmos controles do dock são movidos para ele, sem cópias independentes. O editor trabalha ao vivo; **Concluir** mantém as alterações; **Cancelar** ou `Esc` restaura o pincel da abertura e retorna ao dock. Clique/arraste pinta células e o botão direito gira a célula, inclusive em 1×1. A roda sobre o canvas ampliado e `−`/`+` seguem o mesmo controle de tamanho do mosaico.

**Clone:** `S` restaura a captura anterior; sem captura, entra automaticamente em Capturar. O gesto **Alt + clique/arraste** permite recapturar, seguido de aplicação com clique normal. `C` continua como alternativa para iniciar captura. Arraste e solte para capturar; a ferramenta passa automaticamente a aplicar. Clique/arraste aplica e botão direito gira o clone. `Esc` ou botão direito durante a captura cancela sem substituir o clone anterior. Capturas com ajuste ao bloco funcionam em qualquer direção de arrasto. Pincel e clone conservam padrões independentes durante a sessão; trocar ferramenta encerra o gesto anterior. Os dois padrões são salvos separadamente no campo opcional `brushToolSessions` do payload v3 e restaurados após recarregar.

**Cursores:** captura usa mira; aplicar clone usa cópia; Girar usa seta circular com ponto de ação; Borracha usa célula; Pan/Espaço usam mão aberta e fechada durante o arrasto; Zoom com Alt indica afastamento. Navegação tem prioridade sobre os cursores vetoriais. Combinações sem aplicação válida no escopo Iguais usam cursor de ação indisponível.

Capturar uma região com Alt também entra na sessão de Clone antes de substituir o padrão ativo. Voltar a Pintar recupera seu tile, orientação, tamanho e ajuste ao bloco. Saves antigos sem um pincel separado retomam um pincel normal 1×1 (#2), preservando a região capturada na ferramenta Clone.

O editor ampliado permite definir **Linhas e Colunas** separadamente, escolher o tile da paleta sem preencher o padrão inteiro, pintar/apagar células e desfazer/refazer com `Ctrl+Z`/`Ctrl+Shift+Z`. Redimensionar preserva as células existentes e cria células vazias. Limpar grade pode ser desfeito; Cancelar/Esc restaura o padrão anterior à abertura. No Clone sem captura, a ferramenta entra em Capturar automaticamente: arraste com o botão esquerdo para capturar. Depois da captura, o clique normal aplica; Alt+arraste ou C permitem recapturar.


### Criador de subtiles — seleção e organização dos painéis

O criador abre na visualização **1×1 Mestre**, com mais espaço para desenhar. O painel contextual usa abas **Propriedades** (entrada de edição), **Camadas** e **Variantes**; a Biblioteca tem página própria, acessível pelo menu superior e pelo atalho lateral, com navegação pelas setas do teclado. A aba Camadas apresenta a pilha de objetos da família, da frente para o fundo: marque caixas para selecionar vários objetos, arraste linhas para reordenar, dê duplo clique no nome para renomear e use os controles de visibilidade e bloqueio. São objetos empilhados da família; não há grupos de camadas aninhados.

No canvas, **V** ativa Seleção; **Shift+clique** adiciona ou remove um objeto, **arrastar no vazio** seleciona por área e **Shift+arrastar no vazio** acrescenta à seleção existente. **Todos / Ctrl+A** seleciona os objetos visíveis e destravados. O Pathfinder fica expandido por padrão em Propriedades. Unir, Subtrair, Interseção e Excluir são habilitados com dois ou mais objetos elegíveis; em peças protegidas, os quatro comandos ficam visíveis e desabilitados. O recolhimento manual é preservado durante as atualizações do painel. A seleção permanece ao trocar de aba; **Ctrl+Z** desfaz edições e booleanas.

Na Biblioteca, **conjunto** é o nome de interface para os grupos de famílias existentes no modelo de dados. Há busca, filtros Todos / Meus subtiles / Padrão, filtro por conjunto, Expandir/Recolher e Localizar atual. Os metadados da família selecionada ficam junto da biblioteca. Cada família reúne um mestre e suas variantes D4; mover uma família para outro conjunto preserva suas variantes. Os formatos de persistência e os IDs canônicos 0–84 permanecem iguais.


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

A camada **V2 — Reforma visual** no fim de `style.css` refina a apresentação sem alterar contratos: 60 IDs, ordem das cinco superfícies, `#paddingInput` no topo e persistência permanecem iguais. Tokens: `--top-bar-h: 48px`, `--status-bar-h: 32px`, `--font-section: 11px`, `--radius-card: 8px` e uma rampa neutra com `--bg-panel #1c1d21`, `--border-subtle #2e3138` e `--bg-primary #2a5d9e`.

A barra superior passou a duas cartas de comando (`Prancheta`, `Grade`): um contorno por grupo, rótulos de 10 px, valores de 13 px tabulares, passos fantasma de 24×26 px e unidades explícitas. A ação **Gerar** é um botão rotulado com cor primária. A alternância de ambiente fica no topo da barra esquerda; o **Gerador** abre o topo do dock direito, o **Histórico** é o primeiro item do trilho de utilitários e o **Exportar** fecha o rodapé do dock, deixando a coluna esquerda só com ferramentas, guias e cores. O painel direito usa cabeçalhos finos e listas em linhas de 40 px; ações por linha aparecem no hover/foco. O rodapé tem três zonas e mostra o salvamento com ponto de estado, inclusive na coluna de 1016 px. Alvos mínimos: 24 px em toda a interface (`tests/test_visual_system_v2.js`). Evidências e diagnóstico completo em [`docs/ux/REVISAO_VISUAL_2026-10-28.md`](docs/ux/REVISAO_VISUAL_2026-10-28.md).

### Gerador, Histórico e Exportar fora da coluna esquerda — 28/10/2026

A coluna esquerda ficou apertada ao acumular ferramentas, guias, cores, gerador, histórico e exportação. Seguindo o Illustrator como guia — ferramentas à esquerda, ações de documento à direita —, o **Gerador** virou a faixa superior do dock (`#dock-generator`), o **Exportar** o rodapé fixo (`#dock-export`) e o **Histórico** ganhou o trilho de utilitários (`#utility-rail`), uma faixa de 40 px entre o canvas e o dock: o botão `#btnToggleHistory` fica no trilho e a lista abre à esquerda, sobre o canvas, para não cobrir nem encolher nem o dock nem Simetria/Peças. O trilho é `mosaic-mode-only` e foi pensado para receber outras ferramentas de documento com flyout. A ordem das superfícies é barra esquerda (0) → canvas (1) → trilho (2) → dock (3); ao recolher o dock, o trilho permanece. Os 60 IDs congelados, seus atalhos e a persistência não mudaram.

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

Durante a seleção, o painel lateral direito permanece visível. Seus controles contextuais mostram área, quantidade de peças, limpar e desfazer/refazer. O tamanho aparece apenas para o pincel de seleção. Os controles são movidos de volta aos seus painéis ao trocar de ferramenta, preservando handlers e IDs. Gerador, biblioteca e propriedades conservam o painel direito de 304 px; o histórico fica no trilho e o rodapé continua na coluna da prancheta. O ícone do pincel de seleção combina contorno tracejado, células e sinal de adição. Criar cópia nas Propriedades usa o mesmo `UiFormat.icon('copy')` da Biblioteca.

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

Regra permanente: o chrome não carrega texto explicativo. Cada controle começa pelo ícone e segue com o menor nome ainda intuitivo; o nome completo aparece no hover (`title`/`data-tooltip`) e a explicação fica no popover de info (`data-info-topic` → `INFO_TOPICS` em `ui_info.js`) ou no menu Ajuda. Avisos aparecem só quando um estado impede a ação e dizem apenas o necessário; diálogos com `role="dialog"` podem explicar a decisão por serem transitórios. O encaixe por bordas virou o interruptor **Bordas** (ícone `edgeJoin`), com tooltip `Encaixe por bordas` e tópico `edge-match`; a dica do inspetor na barra de status, o subtítulo da página Biblioteca e a frase do aviso de grade não quadrada foram encurtados. `tests/test_ui_microcopy.js` reprova rótulo estático acima de 64 caracteres, exige o ícone antes do nome e confere que todo `data-info-topic` resolve para um tópico existente.

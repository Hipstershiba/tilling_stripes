# Manual de Manutenção e Arquitetura — Tiling Stripes Studio

Este documento serve como guia técnico detalhado para desenvolvedores e mantenedores do projeto `tilling_stripes`.

---

## 1. Visão Geral da Arquitetura

O Tiling Stripes Studio é implementado em vanilla JavaScript (ES6+) e p5.js sem bundlers ou frameworks, organizado modularmente na pasta `core/`:

```
core/
├── d4_symmetry.js         # Álgebra do grupo D4, estabilizadores e resolução de órbitas
├── tile_registry.js       # Catálogo estático de 85 renderers vetoriais organizados em 31 famílias
├── mosaic_engine.js       # Motor de geração determinística, propagação por escopo e snapshots
└── state_persistence.js   # Lógica pura de persistência, fallbacks de cota e gestão de histórico
ui_info.js                 # Motor de divulgação progressiva (13 tópicos, popovers e tooltips)
sketch.js                  # Controlador principal da UI, eventos de canvas, histórico e atalhos
style.css                  # Regras visuais, tema Adobe Illustrator CC Dark e visibilidade (.hidden)
index.html                 # Shell estrutural, dock contextual e ordem de carga
tests/                     # Suíte com 10 testes automatizados executáveis com Node.js
```

### Ordem Obrigatória de Carga dos Scripts em `index.html`

```html
<script src="libraries/p5.min.js"></script>
<script src="libraries/simple-svg.js"></script>
<script src="core/d4_symmetry.js"></script>
<script src="core/tile_registry.js"></script>
<script src="core/mosaic_engine.js"></script>
<script src="core/state_persistence.js"></script>
<script src="ui_info.js"></script>
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
   - 4 quadrantes em giro rotacional contínuo de 90°.
4. **`bilateral_d2` (Espelhamento Duplo)**:
   - Espelhamento bilateral nos eixos horizontal e vertical.

---

## 3. Catálogo de Tiles (`core/tile_registry.js`)

O catálogo é a fonte de verdade para a renderização vetorial:
- 85 renderers procedurais (`TILE_RENDERERS`), indexados de 0 a 84.
- 31 famílias fechadas sob a ação de $D_4$ (`TILE_FAMILIES_META`).
- `TILE_D4_MAP`: Tabela $85 \times 8$ que define para cada tile e transformação em $D_4$ o tile resultante dentro da mesma família.
- Tiles totalmente simétricos (invariantes sob todas as 8 transformações de $D_4$): IDs `#6, #37, #54, #79, #80, #81, #84`.

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

A partir da Rodada 4, a interface é rigorosamente estruturada em quatro superfícies funcionais dedicadas:

1. **Barra Superior (`#top-control-bar` — O Documento)**:
   - Configurações do documento: Artboard (largura, altura, proporção travada, ajuste à grade), Grade (linhas, colunas, proporção, células 1:1, margem externa), Seed (semente, gerar aleatório, navegação e histórico) e Exportar (PNG/SVG).
   - Não contém seletores de modo nem ferramentas. Totalmente responsivo e sem acionar rolagem horizontal em 1440×900 e 1280×800 (`scrollWidth <= clientWidth`).

2. **Barra Lateral Esquerda (`#left-toolbar` — As Ferramentas)**:
   - Exatamente 6 botões de ferramentas (`inspect`, `paint`, `rotate`, `stamp`, `pan`, `zoom`).
   - Widget de cores sobrepostas estilo Photoshop/Illustrator (`.color-tool-section`) posicionado no rodapé da barra (`margin-top: auto;`) colado ao fundo (distância ≤ 16 px). Atalho `X` inverte cores.

3. **Barra Inferior de Status (`#status-bar` — A Visão)**:
   - Zona esquerda: Grupo coeso de zoom (`.zoom-widget`) contendo `[−] [100% ▾] [+] [Ajustar] [1:1]` (todos a ≤ 24 px do seletor).
   - Zona central: Dimensões do artboard, Grade/Órbitas e Inspetor de Hover com reticências automáticas (`text-overflow: ellipsis`) em viewports reduzidas.
   - Zona direita: 4 toggles de guias visuais (`#toggleGuideAxes`, `#toggleGuideBlocks`, `#toggleGuideSubtiles`, `#toggleGuideOrbits`) com classe `.status-guide-btn`, estado visual `.active` sincronizado com `aria-pressed`, e o botão de Central de Ajuda (`#btnHelp` / `?`).

4. **Dock Lateral Direito (`#right-dock` — Propriedades, Modos e Gaveta)**:
   - Cabeçalho Fixo (`#dock-header`): Seletor de Modo (`#workspaceSwitcher`, Gerador vs Editor) e botão de alternância de gaveta (`#btnToggleRightDock`, `«` expandido, `»` recolhido, `aria-expanded`).
   - Gaveta Recolhida (`body.right-dock-collapsed`): Dock reduz para régua de 44 px (`--dock-rail-w: 44px`), oculta os painéis roláveis e apresenta os dois modos como ícones verticais 32×32 acessíveis que alternam o workspace sem expandir a régua. A área útil do canvas expande ~306 px.
   - Acordeão de Painéis: Cabeçalhos `.panel-header[data-collapse-target]` acessíveis (`role="button"`, `tabindex="0"`, `aria-expanded`, `aria-controls`), operáveis via mouse e teclado (Enter/Espaço), com chevron giratório e persistência de estado.

---

## 6. Divulgação Progressiva de Informações (`ui_info.js`)

O sistema adota o padrão de Progressive Disclosure para manter a interface desobstruída e visualmente limpa:
- **`INFO_TOPICS`**: Dicionário contendo os 13 tópicos técnicos e explicativos (Grid, Bloco, Escopos, Centro, Pincel, Girar, Carimbo, Mesmo Tile, D4 Estrito, Caleidoscópio, Persistência, Atalhos, Inspecionar).
- **Popover Não-Modal (`#infoPopover`)**: Componente flutuante singleton reposicionado dinamicamente com foco acessível e fechamento ao clicar fora ou via tecla Escape.
- **Floating Tooltip (`#uiTooltip`)**: Dica rápida acionada via atributo `data-tooltip`.
- **Botões `ⓘ` e `?`**: Disparadores contextuais que conectam elementos visuais aos tópicos sem exibir textos extensos permanentes.

---

## 7. Persistência de Estado (`core/state_persistence.js`)

A lógica de serialização e persistência é isolada em módulo puro exportável para ambientes Node.js e browser:
- `isQuotaError(err)`: Detecta falhas de cota de armazenamento no browser.
- `saveWithQuotaFallback(storage, key, fullPayload, fallbackPayload)`: Mecanismo de persistência em duas etapas que previne perda de dados em caso de quota esgotada.
- `trimHistoryOnPush(array, limit)`: Garante que arrays de histórico nunca ultrapassem a capacidade máxima permitida.
- `getMaxEditHistoryForMosaic(mosaic)`: Calcula o orçamento dinâmico de snapshots conforme o tamanho da grade para permanecer em ~3,5 MB.
- `migratePayloadHistories(payload, maxGen, maxEdit)`: Valida e corrige payloads carregados de versões antigas do storage.
- `buildMinimalEmergencyPayload(state)`: Monta payload de contingência contendo apenas o estado visual atual do mosaico.
- `createSaveScheduler(options)`: Agendador de salvamento com debounce para ações contínuas.
- `validatePayloadVersion(payload)`: Validador semântico de integridade e versão do schema salvo.

Campos aditivos de UI persistidos (sem incremento de schema versão 3):
- `rightDockCollapsed`: Booleano do estado da gaveta lateral.
- `dockPanels`: Dicionário chave-booleano de abertura dos painéis do acordeão.

---

## 8. Como Rodar e Testar

### Servidor Local
```powershell
python -m http.server 8765
```

### Execução de Todas as 20 Suítes Automatizadas
```powershell
node tests/run_all.js
```

---

## 9. Informações de Legado

Arquivos anteriores da versão 1 (`subtile.js`, `tiles.js`, `supertile.js`, `svg_tile_manager.js`, `tile_transforms.js`) foram arquivados na pasta `_legacy/` para fins históricos e de referência. Não devem ser alterados nem carregados no runtime do estúdio atual.

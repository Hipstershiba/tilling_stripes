# Tiling Stripes Studio

Aplicação interativa de arte generativa para criação de composições em mosaico estruturadas no grupo diédrico D4 (rotações de 90° e reflexões no plano), com subdivisão de blocos (Supertiles), edição contextual, divulgação progressiva de informações (Progressive Disclosure) e exportação vetorial (SVG) e raster (PNG).

Construído em JavaScript moderno (ES6+) e [p5.js](https://p5js.org/), sem necessidade de etapa de build ou dependências externas complexas.

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

O projeto é organizado modularmente, com separação nítida entre álgebra de simetria, catálogo de renderização, motor de geração/propagação, persistência de estado, arquitetura de informação e interface do estúdio:

```
├── core/
│   ├── d4_symmetry.js         # Álgebra do grupo D4, transformações, estabilizadores e órbitas
│   ├── tile_registry.js       # Catálogo dos 85 tiles vetoriais organizados em 31 famílias
│   ├── mosaic_engine.js       # Geração macro/micro, escopos de edição, render e snapshots
│   └── state_persistence.js   # Lógica pura de persistência, quotas e gestão de histórico
├── tests/                     # Suíte com 10 testes automatizados em Node.js puro
├── ui_info.js                 # Motor de divulgação progressiva (13 tópicos, popovers e tooltips)
├── libraries/                 # Bibliotecas p5.min.js e simple-svg.js
├── index.html                 # Estrutura do shell e painéis contextuais
├── style.css                  # Tema Adobe Illustrator Dark CC e regras visuais responsivas
└── sketch.js                  # Controlador principal, UI, atalhos, histórico e canvas
```

---

## Modos de Trabalho (Workspaces)

### 1. Modo Gerador (`Gerador`)
- **Artboard**: Dimensões de largura/altura, bloqueio de proporção e ajuste 1:1 à grade.
- **Grade**: Configuração de Linhas × Colunas, margem externa e subdivisão interna de cada bloco ($N = 2 \times \text{subdivisão}$, gerando blocos de $2\times 2$, $4\times 4$, $6\times 6$ ou $8\times 8$ subtiles).
- **Simetria Global & Interna (4 Modos)**:
  - `Mandala Estrita (D4)`: 8 eixos de simetria com respeito rigoroso aos estabilizadores matemáticos de cada célula. Caso o conjunto de famílias ativas impossibilite tiles invariantes em células fixas, o motor utiliza o **Tile Vazio (#84)** garantindo D4 perfeito sem bloquear a geração.
  - `Caleidoscópio Permissivo (Livre)`: Propagação geométrica nos 8 octantes sem restrição de invariância em eixos centrais ou diagonais, conferindo liberdade criativa total ao usuário.
  - `Giro Contínuo (C4)`: 4 quadrantes em giro rotacional contínuo de 90°.
  - `Espelhamento Duplo (D2)`: Espelhamento bilateral nos eixos horizontal e vertical.
- **Swatches Permitidos**: Seleção e filtragem das famílias e tipos de tiles que entram no sorteio aleatório da semente (*Seed*).

### 2. Modo Editor (`Editor`)
Ferramentas de edição direta na grade com propagação simétrica matemática:

- **✎ Pincel (`B`)**: Pinta células com o tile e rotação ativos. Suporta pincéis 1×1 e Supertiles ($2\times 2$, $3\times 3$, $4\times 4$ ou tamanho de 1 Bloco). Botão direito no mosaico gira o pincel em +90°.
- **↻ Girar (`R`)**: Clique esquerdo gira a área em +90°; clique direito gira em -90°. Suporta rotação geométrica D4 ou ciclar variações da mesma família.
- **⧉ Clonar / Carimbo (`S`)**: Arraste para capturar uma região do mosaico e clique para colar com a simetria ativa.
- **Controle de Cores Estilo Illustrator**: Swatches sobrepostos de Primeiro Plano e Fundo localizados na barra lateral esquerda (`#left-toolbar`), com botão de inversão rápida (`⇄`) e atalho de teclado `X`.

---

## Escopos de Simetria do Editor

Ao editar no modo Editor, as alterações propagam conforme o escopo selecionado:

| Tecla | Escopo | Descrição |
|---|---|---|
| `1` | **Centro do Canvas** | Propaga em torno do centro absoluto do canvas (Mandala 8×, Giro 4× ou Espelho X/Y). |
| `2` | **Órbita (Bloco+Grade)** | Combina a simetria interna do Supertile com a órbita macro da grade. |
| `3` | **Dentro do Supertile** | Reflete/rotaciona apenas dentro dos quadrantes internos do bloco clicado. |
| `4` | **Todos os Supertiles** | Propaga para todos os blocos da grade respeitando suas orientações. |
| `5` | **Livre (Pontual)** | Aplica pontualmente na célula sob o cursor, sem espelhamento. |
| `6` | **Mesmo Tile** | Substitui globalmente todas as ocorrências do mesmo tile no mosaico (1×1). |

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

## Persistência e Limites de Quota (`core/state_persistence.js`)

O estado do estúdio é sincronizado automaticamente no `localStorage` do navegador com debouncing de 300 ms em ações contínuas e flush síncrono no descarregamento da página:

- **Históricos Delimitados**: Histórico de geração limitado a 30 itens e de edição a 25 passos (com orçamento dinâmico proporcional à grade).
- **Fallback Automático de Quota**: Caso a cota do navegador seja excedida (`QuotaExceededError`), um payload mínimo com o desenho completo e parâmetros essenciais é gravado, preservando o trabalho do usuário e exibindo o aviso persistente `#persistenceWarning`.
- **Restauração Segura**: Índices de histórico e limites são ajustados matematicamente contra inconsistências no carregamento.

---

## Barra Superior Responsiva

Projetada para nunca cortar ou exigir rolagem horizontal nos monitores de referência 1280×800 e 1440×900:
- O botão **Exportar** e o controle de **Seed** permanecem sempre visíveis e acessíveis.
- Rótulos textuais secundários se condensam automaticamente em viewports menores (`.btn-short-text`, `.chip-label-short`), mantendo steppers e ícones operacionais.

---

## Testes Automatizados

O projeto conta com 10 suítes de teste automatizadas executadas diretamente via Node.js sem frameworks externos:

```powershell
# Executar todos os testes:
node tests/test_tile_registry.js
node tests/test_mosaic_engine.js
node tests/test_state_persistence.js
node tests/test_d4_invariance.js
node tests/test_history_limits.js
node tests/test_persistence_quota.js
node tests/test_editor_ui_state.js
node tests/test_info_ui_state.js
node tests/test_d4_block_combinations.js
node tests/test_d4_editor.js
```

### Cobertura dos Testes:
- `test_tile_registry.js`: 85 renderers vetoriais, axiomas do grupo D4 (Identidade, Inversa, Composição e Fechamento de Família).
- `test_mosaic_engine.js`: Geração vetorial, renderização, contagem de primitivas e modos de simetria do motor.
- `test_state_persistence.js`: Serialização de estado completo, 15 edições em 3×3 blocos e restauração de histórico undo/redo.
- `test_d4_invariance.js`: Invariância matemática estrita D4/C4/D2 em grades 1×1 a 5×5 (168.960 asserções), modo Caleidoscópio e fallback para Tile Vazio #84.
- `test_history_limits.js`: Trim-on-push, orçamento dinâmico de snapshots e migração de payloads antigos.
- `test_persistence_quota.js`: Tratamento de erro de quota, gravação de fallback mínimo e restauração limpa.
- `test_editor_ui_state.js`: Matriz de visibilidade do editor, seletores CSS `.hidden` e cursores de ferramentas.
- `test_info_ui_state.js`: Validação dos 13 tópicos de informação, singleton popover/tooltip, remoção de `.shortcut-pill` e widget Illustrator.
- `test_d4_block_combinations.js`: Validação da matriz completa de 20 combinações Grade × Bloco e detecção de redução de simetria.
- `test_d4_editor.js`: Contrato de transparência D4 no Editor, detecção de quebra em eixos e modo Caleidoscópio livre.

---

## Atalhos de Teclado

- `B`: Ferramenta Pincel
- `R`: Ferramenta Girar
- `S`: Ferramenta Clonar (Carimbo)
- `X`: Inverter cores de Primeiro Plano e Fundo (Swatches)
- `G`: Sortear nova semente (Gerar)
- `?`: Abrir Central de Ajuda e Atalhos (Popover)
- `1` a `6`: Alternar escopo de simetria (no modo Editor)
- `[` / `]`: Girar o pincel/supertile ativo em -90° / +90°
- `Ctrl + Z` / `Ctrl + Y`: Desfazer / Refazer edições no mosaico
- `A`: Mostrar/ocultar eixos de simetria
- `M`: Mostrar/ocultar grade de subtiles
- `O`: Mostrar/ocultar mapa de órbitas
- `Tab`: Alternar visibilidade do painel direito

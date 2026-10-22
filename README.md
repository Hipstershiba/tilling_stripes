# Tiling Stripes Studio

Aplicação interativa de arte generativa para criação de composições em mosaico estruturadas no grupo diédrico D4 (rotações de 90° e reflexões no plano), com subdivisão de blocos (Supertiles), edição contextual e exportação vetorial (SVG) e raster (PNG).

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

O projeto é organizado na pasta `core/`, com separação nítida entre álgebra de simetria, catálogo de renderização, motor de geração/propagação e interface do estúdio:

```
├── core/
│   ├── d4_symmetry.js     # Álgebra do grupo D4, transformações, estabilizadores e órbitas
│   ├── tile_registry.js   # Catálogo dos 85 tiles vetoriais organizados em 31 famílias
│   └── mosaic_engine.js   # Geração macro/micro, escopos de edição, render e snapshots
├── tests/                 # Suíte de testes automatizados em Node.js puro
├── libraries/             # Bibliotecas p5.min.js e simple-svg.js
├── index.html             # Estrutura do shell e painéis contextuais
├── style.css              # Tema Adobe Illustrator Dark CC e regras visuais
└── sketch.js              # Controlador principal, UI, atalhos, histórico e canvas
```

---

## Modos de Trabalho (Workspaces)

### 1. Modo Gerador (`Gerador`)
- **Artboard**: Dimensões de largura/altura, bloqueio de proporção e ajuste 1:1 à grade.
- **Grade**: Configuração de Linhas × Colunas, margem externa e subdivisão interna de cada bloco ($N = 2 \times \text{subdivisão}$, gerando blocos de $2\times 2$, $4\times 4$, $6\times 6$ ou $8\times 8$ subtiles).
- **Simetria Global & Interna**:
  - `Mandala (D4)`: 8 eixos de simetria (rotações de 90° e reflexões).
  - `Rotacional (C4)`: 4 quadrantes em giro contínuo de 90°.
  - `Bilateral (D2)`: Espelhamento duplo nos eixos horizontal e vertical.
- **Swatches Permitidos**: Seleção e filtragem das famílias e tipos de tiles que entram no sorteio aleatório da semente (*Seed*).

### 2. Modo Editor (`Editor`)
Ferramentas de edição direta na grade com propagação simétrica matemática:

- **✎ Pincel (`B`)**: Pinta células com o tile e rotação ativos. Suporta pincéis 1×1 e Supertiles ($2\times 2$, $3\times 3$, $4\times 4$ ou tamanho de 1 Bloco). Botão direito no mosaico gira o pincel em +90°.
- **↻ Girar (`R`)**: Clique esquerdo gira a área em +90°; clique direito gira em -90°. Suporta rotação geométrica D4 ou ciclar variações da mesma família.
- **⧉ Clonar / Carimbo (`S`)**: Arraste para capturar uma região do mosaico e clique para colar com a simetria ativa.

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

## Persistência e Limites de Quota

O estado do mosaico e suas configurações são persistidos automaticamente no `localStorage` do navegador sob a chave `tiling_stripes_studio_state_v2`:

- **Históricos Delimitados**: O histórico de geração é limitado a 30 itens e o de edição a 25 passos (com redução dinâmica proporcional ao tamanho da grade para permanecer em ~3,5 MB).
- **Fallback Automático de Quota**: Caso o navegador atinja a quota de armazenamento (`QuotaExceededError`), o histórico é descartado e o estado atual das células e configuração é gravado em payload mínimo, alertando o usuário visualmente através do banner `#persistenceWarning`.
- **Restauração Segura**: Índices de histórico e dimensões são validados e ajustados contra os limites no momento do carregamento.

---

## Testes Automatizados

O repositório inclui suíte completa de testes automatizados executados diretamente com Node.js sem dependências extras:

```powershell
# Executar todos os testes:
node tests/test_tile_registry.js
node tests/test_mosaic_engine.js
node tests/test_state_persistence.js
node tests/test_d4_invariance.js
node tests/test_history_limits.js
node tests/test_persistence_quota.js
node tests/test_editor_ui_state.js
```

### O que cada teste valida:
- `test_tile_registry.js`: 85 renderers, axiomas do grupo D4 (Identidade, Inversa, Composição e Fechamento de Família).
- `test_mosaic_engine.js`: Geração vetorial, renderização e modos de simetria do motor.
- `test_state_persistence.js`: Serialização, restauração de múltiplas células editadas e coerência de undo/redo após reload.
- `test_d4_invariance.js`: Invariância estrita D4/C4/D2 contra estabilizadores de célula em grades 1×1 a 5×5 com 168.960 asserções.
- `test_history_limits.js`: Trim-on-push, migração de payloads antigos e ajuste de limites.
- `test_persistence_quota.js`: Tratamento de `QuotaExceededError`, salvamento de payload mínimo de fallback e alerta persistente.
- `test_editor_ui_state.js`: Matriz de visibilidade do editor e validação de regras `.hidden` e seletores CSS.

---

## Atalhos de Teclado

- `B`: Ferramenta Pincel
- `R`: Ferramenta Girar
- `S`: Ferramenta Clonar (Carimbo)
- `G`: Sortear nova semente (Gerar)
- `1` a `6`: Alternar escopo de simetria (no modo Editor)
- `[` / `]`: Girar o pincel/supertile ativo em -90° / +90°
- `Ctrl + Z` / `Ctrl + Y`: Desfazer / Refazer edições no mosaico
- `A`: Mostrar/ocultar eixos de simetria
- `M`: Mostrar/ocultar grade de subtiles
- `O`: Mostrar/ocultar mapa de órbitas
- `Tab`: Alternar visibilidade do painel direito (quando foco estiver no canvas)

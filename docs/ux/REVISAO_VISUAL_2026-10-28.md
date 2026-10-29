# Revisão de interface — experiência e estética

Data: 28/10/2026. Base: HEAD `511bbfb` + alterações locais presentes na sessão.
Escopo escolhido pelo usuário: **reforma visual ampla** — nova hierarquia, densidade e sistema visual das quatro superfícies, não apenas diagnóstico.

Este documento é o registro da rodada. O diagnóstico de 27/10 (`AUDITORIA_UX_2026-10-27.md`) e o
plano (`PLANO_IMPLEMENTACAO_UI_UX.md`) continuam válidos como histórico e roteiro; esta revisão
incorpora o que já estava correto e substitui, na prática, as decisões visuais ali propostas.

## 1. Resumo executivo

O aplicativo tinha boa arquitetura de superfícies (documento no topo, ferramentas à esquerda,
propriedades à direita, navegação no rodapé) e um tema escuro consistente. O problema não era o
arranjo, era a **falta de hierarquia**: tudo media 12 px, todo controle tinha borda, a ação
principal do produto era um ícone de 28 px dentro do título de uma seção e o estado de salvamento
media **1 × 1 px** na largura padrão de 1440 px.

A reforma manteve contratos e geografia e reconstruiu a camada de apresentação:

- ação primária **Gerar** com rótulo, cor cheia e 101 × 34 px;
- barra superior reorganizada em **duas cartas de comando** (Prancheta e Grade), com um único
  contorno por grupo, rótulos micro e valores tabulares;
- barra esquerda com alternância de ambiente no topo, seções em micro-rótulos e **zona de comando
  ancorada no rodapé** (Gerador → Histórico → Exportar);
- painel direito com cabeçalhos de seção finos, listas de peças em linhas (não cartões empilhados)
  e ações por linha reveladas no uso;
- rodapé de 32 px em três zonas, com estado de salvamento sempre visível, Spout compacto e
  separadores desenhados;
- escala tipográfica 10 / 11 / 12 / 13 px com pesos e cores semânticas;
- alvos mínimos de 24 px em toda a interface (0 controles abaixo disso).

## 2. Método e evidência

- Harness headless via CDP (`scratch/review_runner.js`, `review_audit.js`, `review_states.js`,
  `review_a11y.js`, `review_targets.js`): capturas em 1440×900, 1366×768, 1280×800 e 1024×768,
  nos estados gerador, pincel, seleção, peças (camadas/biblioteca/variantes), ajuda, foco e dock
  recolhido.
- Métricas no DOM real: contraste calculado par a par (texto × fundo efetivo), alvos, escala
  tipográfica, altura das superfícies, overflow e ordem de foco.
- Reprodução por teclado: `Tab` real via `Input.dispatchKeyEvent` para conferir `:focus-visible`.
- Suíte: `node tests/run_all.js` → **53/53** (inclui o novo `test_visual_system_v2.js`).
- Limites: sem teste em toque, leitor de tela, zoom de navegador alto ou Spout real; a inspeção
  visual é amostral; as capturas são de Chromium headless.

Evidências desta rodada ficam em [`evidencias/revisao-2026-10-28/`](evidencias/revisao-2026-10-28/).
As imagens `antes_*` são capturas reais da interface anterior, feitas na mesma sessão.
A pasta `docs/ux/evidencias/` é local e ignorada pelo Git (mesma convenção da auditoria de 27/10);
para reproduzir, use os harnesses de `scratch/` descritos acima — os nomes de arquivo e as medidas
no texto são suficientes para refazer cada captura.

## 3. Diagnóstico (antes)

### 3.1 Barra superior — densidade sem hierarquia

| Evidência | Achado |
|---|---|
| Captura `antes_1440_dock_recolhido.png`; medição `TOP_ITEMS` | 46 px de altura, **10 botões de passo** (dois por campo numérico) e **4 contornos** por campo (rótulo, valor, ↑, ↓). |
| HTML `index.html:30–111` | `Larg. 600 ↑ ↓ ⇄` e `Alt. 600 ↑ ↓`: o valor não domina, o rótulo e o ícone competem. |
| Medição | Sem unidade em Largura/Altura/Margem; `%` só no espaçamento. |
| Captura | "PRANCHETA" e "GRADE" em 11 px/600 tratados como texto comum, não como marcadores de grupo. |

### 3.2 Barra esquerda — a ação principal era um ícone

| Evidência | Achado |
|---|---|
| Medição: `#btnRandomize` = **28 × 28 px** | O comando que gera o produto (Gerar) era um `icon-only` no título da seção, com ícone que se lê como "tesoura/X". |
| Medição: `#btnStudioTilesMode` órfão no topo | A troca de ambiente não tinha título nem rótulo; o botão flutuava sozinho acima das ferramentas. |
| Captura `antes_1440_pecas.png` | Títulos de seção em 11 px/700 com 0,55 px de tracking — mais pesados que os próprios ícones. |
| Medição de layout | ~260 px vazios no fim da coluna; o bloco de geração/histórico/exportação ficava solto no meio. |
| HTML `index.html:349–361` | Amostras de cor de 15 px dentro de chips de 28 px; a troca de cores era um terceiro "chip". |

### 3.3 Painel direito — três tratamentos para a mesma lista

| Evidência | Achado |
|---|---|
| Captura `antes_1440_dock_recolhido.png` | Cabeçalho de painel com fundo mais claro, cartões de família com borda e contorno próprio, contador em pílula azul: três elevações competindo. |
| Medição: cartão de família 44 px de altura com `border: 1px` e `border-radius: 5px` | 31 famílias = 31 cartões; a lista vira um empilhamento pesado e cabe menos repertório na tela. |
| Captura | Checkbox de 16 px preenchido em azul cheio repetido em todas as linhas. |
| Captura da aba Biblioteca | Cada linha exibia ↑ ↓ duplicar sempre; 18 setas simultâneas. |
| HTML `index.html:1135–1137` | Aviso de peça protegida em âmbar com botão `icon-only` de largura total — parecia um campo desabilitado. |

### 3.4 Rodapé — o estado do documento era invisível

| Evidência | Achado |
|---|---|
| Medição `#saveStatusText` = **1 × 1 px** em 1440 | O estado de salvamento existia no DOM e era recortado pela regra de container ≤ 1050 px. |
| Medição `#statusHoverInspector` = 0 × 0 | O inspetor de bloco/órbita também não aparecia na largura padrão. |
| Contraste calculado dos separadores `|` | 1,69:1 (texto cinza-escuro sobre painel). |
| Captura | Spout "off" com botão claro e "Desligado" em pílula com borda — o desligado parecia ligado e o estado parecia um botão. |
| 1024×768 | Rodapé quebrava em 3 linhas (73 px) mantendo só a primeira visível; barra superior ia a 83 px e o canvas ficava sem respiro. |

### 3.5 Tipografia, alvos e acessibilidade

| Medida (antes) | Leitura |
|---|---|
| 214 nós de texto: **176 em 12 px**, 6 em 11 px, 31 em 13,33 px | Não havia escala: títulos, rótulos, valores e metadados no mesmo corpo. |
| 37 controles abaixo de 28 px (19 px em ações da biblioteca) | Alvos pequenos para mouse e teclado. |
| Contraste mínimo de texto: 4,86:1 | Correto; o problema era tamanho e peso, não contraste. |
| Ajuda: 440 × 640 px, topo em 223 e base em 863 | Não caberia em 768 px de altura. |
| `Tab` nos campos e botões | Foco visível de 2 px funciona; a hierarquia de foco começa nos campos do documento. |

## 4. Direção visual adotada

**Uma borda por grupo.** Os campos deixam de ser caixas isoladas e passam a viver dentro de cartas
de comando. Isso reduz o ruído sem esconder controles.

**Rótulo micro, valor forte, ícone discreto.** Hierarquia por três eixos ao mesmo tempo: tamanho
(10–13 px), peso (400–700) e cor (mutado/secundário/primário).

**Ação primária única.** Só o Gerar tem cor cheia persistente na barra esquerda. Ações raras são
fantasmas até o hover/foco.

**Listas em linhas.** Separadores finos em vez de cartões; ações contextuais aparecem quando a
linha está em uso (hover/foco/seleção).

**Rodapé como instrumento.** Documento, salvamento e saída sempre visíveis; o que sai primeiro é o
nome do Spout, nunca o estado do trabalho.

### Tokens

| Papel | Valor | Uso |
|---|---|---|
| `--bg-pasteboard` | `#121317` | Mesa ao redor da prancheta |
| `--bg-panel` | `#1c1d21` | Superfícies laterais |
| `--bg-panel-header` | `#232529` | Cabeçalho do dock |
| `--bg-control` | `#15161a` | Campos e poços |
| `--bg-control-hover` | `#2b2e34` | Hover |
| `--bg-selected` | `#1f3450` | Seleção |
| `--bg-primary` | `#2a5d9e` | Ação primária (Gerar) |
| `--border-subtle` / `--border-strong` | `#2e3138` / `#3a3e46` | Contornos decorativos |
| `--border-control` | `#868e9c` | Indicador funcional |
| `--border-focus` | `#7aa8ff` | Foco (2 px) |
| `--text-primary` / `secondary` / `muted` | `#f1f3f7` / `#c2c8d2` / `#9ca4b2` | Conteúdo / apoio / metadado |
| `--font-section` / `--font-ui` / `--font-value` / `--font-title` | 11 / 12 / 13 / 13 px | Escala |
| `--radius-chip` / `--radius-card` / `--radius-pill` | 6 / 8 / 999 px | Formas |
| `--top-bar-h` / `--status-bar-h` | 48 / 32 px | Geografia vertical |
| `--left-tool-w` / `--right-dock-w` | 120 / 304 px | Geografia horizontal |

Contraste verificado: o texto funcional mais baixo do aplicativo fica em **5,33:1**; texto
mutado em 6,1–7,2:1; foco em 5,3–7,6:1 sobre todas as superfícies semânticas.

## 5. O que mudou, superfície por superfície

### 5.1 Topo — documento

- Barra de 48 px com duas **cartas** (`Prancheta`, `Grade`): contorno único, rótulo à esquerda,
  campos sem borda interna e passos fantasma.
- Valores numéricos em 13 px/600 com algarismos tabulares; rótulos em 10 px/700 caixa alta.
- Unidades explícitas: `px` em Margem, `%` em Espaçamento.
- Ícones de travar/inverter/ajustar sem contorno até o hover; estado travado em azul suave.
- Quebra em duas linhas alinhadas quando não couber (a partir de ~1150 px), com altura automática.
- No editor de peças, a carta contextual usa o mesmo desenho para nome, cópia, undo/redo e modos
  de prévia.

### 5.2 Esquerda — ferramentas e comando

- `Editar peças` / `Mosaico` no topo, com ícone e rótulo de 11 px; estado ativo preenchido.
- Ferramentas em duas colunas de 48 × 38 px, ícones normalizados em 17 px e traço 1,65.
- Seções em micro-rótulos de 11 px/700 com 0,11 em de tracking.
- Amostras de cor preenchem o chip de 34 px.
- **Gerar** é um botão de 101 × 34 px, fundo `--bg-primary`, ícone de dado e rótulo "Gerar".
- Bloco Gerador → Histórico → Exportar ancorado no rodapé da coluna por `margin-top: auto` e
  separado por uma borda de zona.
- Gavetas do editor de peças (Biblioteca, Arquivos SVG, Backup) param de ser cortadas: o painel
  rola internamente e o espaçador não empurra mais o conteúdo para fora.

### 5.3 Direita — propriedades

- Cabeçalho do dock de 40 px, título 13 px/650 e botão de recolher fantasma.
- Cabeçalhos de painel em 11 px/700 caixa alta, fundo transparente e hairline; sem faixas claras
  alternadas.
- Etiquetas de propriedade em 11 px/600 e badges em pílula neutra.
- Lista de peças com linhas de 40 px, miniatura de 30 px, checkbox de 16 px em azul translúcido e
  contagem tabular; ações por linha reveladas no hover/foco/seleção.
- Abas do inspetor com sublinhado de 2 px no ativo.
- Aviso de peça protegida neutro, com borda âmbar de 2 px e botão "Criar cópia" legível.
- Grupos de ação (alinhamento, D4, booleanas, camadas) ganham uma superfície de cápsula comum.
- Ações da biblioteca (subir/descer/renomear/excluir) aparecem só na linha em uso.

### 5.4 Rodapé — navegação e estado

- 32 px, três zonas: zoom (esquerda), documento (centro), salvamento/Spout/ajuda (direita).
- Ponto de estado colorido + texto de salvamento sempre visível; em colunas estreitas o campo de
  nome do Spout é o primeiro a sair, depois a grade, nunca o salvamento.
- Spout vira rótulo + interruptor de 38 × 24 px com trilho neutro desligado e verde ligado; o texto
  de estado deixa de parecer um botão.
- Separadores são linhas de 1 px, não glifos de baixo contraste.
- Em 1024 px o rodapé continua em **uma linha** (32 px), em vez de três.

### 5.5 Ajuda

- 420 × 660 px máx., com rolagem interna; cabe em 768 px de altura (topo 76, base 736).
- Contextos Mosaico/Editor de peças como segmentos; listas de atalhos em micro-rótulos; `kbd`
  com borda e fundo de campo.

## 6. Antes e depois medido

| Medida | Antes | Depois |
|---|---|---|
| Altura da barra superior | 46 px | 48 px |
| Rodapé | 36 px (41 px pintados) | 32 px |
| Estado de salvamento em 1440 | 1 × 1 px | 135 × 16 px, visível |
| Informação de documento no rodapé | 0 × 0 px | 111 × 16 px + grade |
| Gerar | 28 × 28 px, só ícone | 101 × 34 px, rótulo "Gerar" |
| Controles abaixo de 24 px | 37 abaixo de 28 px (mín. 19) | **0** |
| Escala tipográfica em uso | 11 / 12 / 13,3 px | 10 / 11 / 12 / 13 px |
| Nós de texto em 12 px | 176 de 214 | 73 de 215 (corpo), com 10/11 para rótulos |
| Contraste mínimo de texto | 4,86:1 | 5,33:1 (separadores decorativos desenhados) |
| Ajuda a 900 px de altura | 640 px, base em 863 | 660 px, base em 868 com rolagem |
| 1024×768: topo / rodapé | 83 px / 73 px (3 linhas ocultas) | 99 px (2 linhas) / 32 px (1 linha) |
| Coluna esquerda | 120 px, ação no título da seção | 120 px, comando ancorado e botão rotulado |
| Alvos de ferramenta | 34 × 34 px | 48 × 38 px |

## 7. Verificação técnica

- `node tests/run_all.js` → **53/53** (52 anteriores + `test_visual_system_v2.js`).
- O novo teste fixa: rótulo visível em Gerar, posição da alternância de ambiente, tokens de escala
  e geografia, salvamento nunca oculto no container de 1050 px, separadores desenhados e alvos de
  linha/step ≥ 24 px.
- `test_visual_tokens.js` continua validando todos os `var(--token)` e o contraste dos papéis
  semânticos.
- 60 IDs congelados, ordem `left-toolbar (0) → viewport (1) → right-dock (2)` e `#paddingInput` no
  topo permanecem intactos (`test_ui_control_registry.js`, `test_ui_layout_contract.js`).
- Foco por teclado verificado com `Tab` real: contorno de 2 px `#7aa8ff` em todos os controles.

## 8. Riscos, limites e dívida

1. **Ícones ainda são a única pista de algumas ferramentas.** A reforma melhora o alvo e
   normaliza o traço, mas nomes continuam em `title`/tooltip. O ícone de Espelhar é o mais ambíguo.
2. **O inspetor de hover desaparece em colunas ≤ 1050 px** (caso padrão com o dock aberto). A
   doca recolhida ou uma janela mais larga o revela. Resolver exige escolher entre grade e
   inspeção no rodapé; ficou como pendência consciente.
3. **1024 px:** a prancheta de 600 px ocupa exatamente a coluna de 600 px; `0` (Ajustar) continua
   sendo o caminho para trabalhar com margem.
4. **Tema único escuro.** Não há alternância clara/escura nem preferência de alto contraste.
5. **CSS histórico permanece.** A camada V2 está no fim de `style.css` para vencer a herança; a
   consolidação definitiva (apagar regras substituídas) é uma tarefa própria, com o mesmo critério
   de captura antes/depois.
6. **Contagem de testes** é 53 agora; os números 36/44/45/52 em documentos antigos são históricos —
   o runner é a fonte.

## 9. Próximos passos sugeridos

1. Substituir o rodapé por uma política de prioridade explícita (documento sempre; inspeção em
   segundo plano com popover), resolvendo o item 8.2.
2. Revisar a iconografia das 10 ferramentas em uma prancha única (mesma grade óptica, teste de
   reconhecimento) e aposentar o rótulo oculto onde o ícone não for autoexplicativo.
3. Aplicar a mesma gramática de carta/cápsula ao painel de Variantes e ao diálogo de importação.
4. Consolidar a camada V2 no lugar das regras históricas e reduzir o número de `!important`.
5. Medir com usuários as duas jornadas centrais: gerar e ajustar uma região; e editar uma peça.

## 10. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `style.css` | Tokens refinados (cores, tipografia, raios, sombras, movimento) e camada **V2 — Reforma visual** com as quatro superfícies, ajuda, listas e responsividade. |
| `index.html` | Alternância de ambiente no topo da barra esquerda; Gerador com botão rotulado e ícone de dado; unidade `px` na margem; rótulo "Criar cópia editável" visível. |
| `core/studio_commands.js` | `labelText` para rótulos curtos de comando sem perder o nome completo em ajuda/tooltip. |
| `core/subtile_studio_ui.js` | Rótulo curto "Mosaico" na volta ao gerador. |
| `tests/test_visual_system_v2.js` | Novo contrato visual. |
| `tests/run_all.js` | Registra o novo conjunto. |

`scratch/` contém os harnesses de captura e medição usados nesta rodada; não faz parte do produto.

## 11. Correção de 29/10/2026 — cores e guias

Depois da reforma, duas seções ficaram fora do padrão compacto da coluna e foram corrigidas sem criar componentes novos.

### Problemas observados

| Evidência | Achado |
|---|---|
| Captura da amostra de cor | O `input[type=color]` nativo era desenhado deslocado (`top/left: -8px`) dentro de um wrap de 15 px; só um canto do chip mostrava a cor e o restante ficava vazio. Havia moldura dupla (chip + amostra). |
| Medição da grade de guias | A grade dos guias media 2×34 px enquanto as ferramentas mediam 2×48 px; a seção parecia recuada e os ícones menores que os vizinhos. |
| Captura | O rótulo da guia dizia "Subtiles" enquanto `title`/`aria-label` diziam "Peças". |
| Documentação | README e manual prometiam "swatches sobrepostos" (`.color-tool-section`) que a interface não tinha. |

### Correção aplicada

- Amostra de cor: `appearance: none`, `inset: 0` e reset de `::-webkit-color-swatch`; o input preenche a prévia de 24 px dentro de um chip fantasma de 32 px, com hover e foco no chip.
- Troca de cores: volta a ser um ícone fantasma de 28×32 px entre as duas amostras, como os demais comandos da coluna.
- Guias: mesma grade 2×N, altura de 38 px, ícones de 17 px e estado ativo `--bg-selected` + anel interno das ferramentas; rótulo interno alinhado a "Peças".
- Rótulos continuam em `title`/`aria-label` — nada de linhas com nome, valor hexadecimal ou lista com LEDs.
- Documentação corrigida para descrever o par lado a lado e a classe real (`.illustrator-color-widget`).

### O que foi descartado e por quê

Uma primeira tentativa transformou as duas seções em listas com nome, valor hex, botão textual "Trocar cores" e indicadores circulares. Era legível, mas introduzia um vocabulário visual que não existe no restante do aplicativo (nenhuma outra seção usa linhas com dois níveis de texto ou botões largos). O padrão da coluna é compacto e icônico; a correção passou a respeitá-lo. A inspiração no Illustrator fica na **diagramação** (coluna só de ferramentas/guias/cores, painéis à direita, gerador no cabeçalho do dock) e no par de cores com troca ao lado — não em componentes novos.

### Verificação

- Guias: alternar os quatro toggles altera o canvas (comparação de `toDataURL`) e `aria-pressed` acompanha `StudioState.guides`.
- Cores: `input` de `#ff0000` atualiza `StudioState.fgColor` e a obra; a troca inverte estado, inputs e desenho.
- `tests/test_visual_system_v2.js` ganhou dois blocos: a amostra precisa de `inset: 0` + `appearance: none` + reset do swatch, e os guias precisam da grade `repeat(2, minmax(0, 1fr))` com altura de 38 px.
- Suíte: **54/54**.

Evidências em `docs/ux/evidencias/ajuste-2026-10-29/` (pasta local ignorada pelo Git).

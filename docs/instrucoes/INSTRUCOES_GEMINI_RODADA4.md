# Instruções — Rodada 4: Arquitetura de informação das barras e a gaveta do dock

**Destinatário:** Gemini 3.8 Flash, no Antigravity
**Repositório:** a raiz deste projeto (caminhos relativos)
**Branch de trabalho:** `develop`
**Estado de referência:** `565be96` (ou o commit que já contiver a Rodada 3)
**Inspiração visual:** interface do Photoshop (barra de ferramentas à esquerda com cores no rodapé,
painéis à direita com cabeçalho próprio, zoom e navegação no rodapé da janela)

**Objetivo:** reorganizar **onde cada controle vive** — não o que ele faz. A barra superior passa a
ser do documento, a esquerda passa a ser só de ferramentas, a inferior passa a ser de visão, e o
dock da direita ganha cabeçalho (modo de trabalho + retrair) e vira uma gaveta de verdade.

> **Esta rodada é de layout e informação.** Nenhum recurso novo de produto, nenhuma mudança na
> lógica do motor de mosaico, nenhuma mudança na matemática D4. Se em algum momento for preciso
> alterar comportamento para mover um botão, **pare e reporte** — é sinal de que o controle está
> acoplado onde não deveria.

---

## 0. Dependências: o que a Rodada 3 deixou no lugar

Esta rodada assume o commit `ad6a01f` (Rodada 3 aplicada). O que já existe e **não pode ser
quebrado** pelo rearranjo:

| Item | Onde | Por que importa aqui |
|---|---|---|
| `core/ui_format.js` | `index.html:750` | entra **depois** de `state_persistence.js` e **antes** de `ui_info.js`; script novo respeita essa ordem |
| `#editScopeChip` | `index.html:567` | começa **vazio** e é escrito por `syncEditWorkspaceUI()`; se a mudança de layout quebrar essa chamada, o chip fica em branco — e isso é proposital, para o erro aparecer |
| `syncD4Badge()` | `sketch.js:757` | chamado em pintura (`1425`, `1480`) e no undo (`1725`); não remova essas chamadas ao enxugar handlers |
| `saveScheduler` | `sketch.js:179` | `schedule()` é para ações **contínuas**; recolher o dock e abrir/fechar painel são discretos → grave com `saveStudioStateToStorage()` direto |
| `STORAGE_VERSION = 3` + `validatePayloadVersion` | `core/state_persistence.js`, `sketch.js:324` | o estado novo da UI é **aditivo**: não suba a versão e não quebre `tests/test_payload_version.js` |
| Inventário de 58 ids | anexo A | reconferido em `ad6a01f`: continua exatamente 58; o teste de registro não muda |
| `tests/run_all.js` | 18 suítes hoje | a rodada 4 acrescenta 2 → 20; o CI executa o runner |
| `test_docs_consistency.js` | `tests/` | restringe o que você pode escrever no README/manual; mantenha verde |

**Regra de convivência:** se mover um controle exigir tocar em uma dessas amarras, ajuste a amarra
no mesmo commit e diga qual foi — não deixe a regressão aparecer no fim.

---

## 1. O princípio: quatro superfícies, quatro trabalhos

A causa da bagunça atual não é excesso de botões; é ausência de critério. Hoje o modo de trabalho
fica na barra superior, as cores ficam no meio da barra esquerda, o zoom fica no rodapé e o
"Ajustar" fica na barra esquerda. A regra desta rodada:

| Superfície | Trabalho | O que pode morar lá |
|---|---|---|
| **Barra superior** | O **documento** | tamanho do artboard, grade, margem, seed, exportar |
| **Barra esquerda** | As **ferramentas** | seleção, pincel, girar, carimbo, pan, zoom + cores (rodapé, como PS/AI) |
| **Barra inferior** | A **visão** | zoom (%, −, +), Ajustar, 1:1, guias visuais, inspeção, ajuda |
| **Dock direito** | As **propriedades + o modo** | seletor Gerador/Editor no cabeçalho, painéis empilháveis, retrair |

**Teste de decisão para qualquer controle novo:** “isto muda o documento, a ferramenta, a visão ou
a propriedade?”. A resposta define a barra. Sem exceção.

---

## 2. Estado atual medido (não confie na memória)

Medido em `ad6a01f`, depois da Rodada 3.

| Medida | Valor |
|---|---|
| Controles interativos com `id` | **58** |
| `--top-bar-h` / `--status-bar-h` | 46 px / 28 px |
| `--left-tool-w` / `--right-dock-w` | 44 px / 350 px |
| Dock recolhido | `body.right-dock-collapsed #right-dock { display: none }` — **desaparece**, não vira gaveta |
| Cabeçalho de painel | `.panel-header[data-collapse-target]` existe no HTML, `.dock-panel.collapsed` existe no CSS, **e nenhum JS os conecta** |
| Seletor de ferramentas | aparece **duas vezes**: `#left-toolbar` e `#editToolSegmented` dentro do dock |

Distribuição atual:

- **Topo (7 grupos):** marca · `#workspaceSwitcher` · Artboard (W/H, ⇄, trava, Ajustar à Grade) ·
  Grade (L/C, ⇄, trava, 1:1, Margem) · Seed (#, Gerar, ◀ ▶, histórico) · Exportar (formato + botão).
- **Esquerda (13 elementos):** inspect, paint, rotate, stamp · pan, zoom · cores (fg/bg, trocar) ·
  4 guias · Ajustar artboard · retrair dock.
- **Rodapé:** zoom (−, %, +), 1:1 · tamanho do artboard · grade/órbitas · inspetor · ajuda.
- **Dock:** painel “Simetria & Estrutura”, painel de swatches, painel “Edição & Simetria”
  (com seletor de ferramenta duplicado, escopo, centro, pincel/supertile, paleta).

---

## 3. Alvo

### 3.1 Layout expandido (1440×900)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ TS  Tiling Stripes │ Artboard W 600 ⇄ H 600 🔒 Ajustar │ Grade L 3 ⇄ C 3  │
│                    │ 🔒 1:1 Margem 24 │ Seed #1024 ⟳ ◀▶ ⏱ │ PNG ▾ Exportar │
├────┬───────────────────────────────────────────────────────┬──────────────┤
│ ✦  │                                                       │ Gerador│Editor  «│
│ ✎  │                                                       ├──────────────┤
│ ↻  │                                                       │ ▾ Simetria…  │
│ ⧉  │                    canvas                             │ ▸ Swatches   │
│ ─  │                                                       │              │
│ ✋ │                                                       │  (rolagem)   │
│ 🔍 │                                                       │              │
│    │                                                       │              │
│ ▣  │  ← cores no rodapé da barra (PS/AI)                   │              │
│ ◨  │                                                       │              │
├────┴───────────────────────────────────────────────────────┴──────────────┤
│ − 100% ▾ + │ Ajustar │ 1:1 │ 600×600 px │ Grade 3×3 │  hover…  │ ▦▤▩◍ │ ? │
└───────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Layout com o dock recolhido (régua de 44 px)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ TS  Tiling Stripes │ Artboard … │ Grade … │ Seed … │ PNG ▾ Exportar        │
├────┬───────────────────────────────────────────────────┬──────────────────┤
│ ✦  │                                                   │  »   ▣           │
│ ✎  │                                                   │      ▤           │
│ ↻  │                    canvas                         │                  │
│ ⧉  │              (ganha ~306 px)                      │                  │
│    │                                                   │                  │
│ ▣  │                                                   │                  │
├────┴───────────────────────────────────────────────────┴──────────────────┤
│ − 100% ▾ + │ Ajustar │ 1:1 │ … │ ▦▤▩◍ │ ?                              │
└───────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Em 1280×800

Mesmo desenho; o inspetor de hover encurta com reticências e a barra superior **não** pode
acionar rolagem horizontal. Com o seletor Gerador/Editor fora do topo, sobram ~150 px: reavalie se
os rótulos completos (“Ajustar à Grade”, “Células 1:1”, “Margem”) voltam a caber e registre a
medição. Se couberem, remova a regra de `@media (max-width: 1280px)` que os esconde; se não,
mantenha — não deixe as duas coisas pela metade.

---

## 4. Tarefas

### T1 — Cabeçalho do dock (modo + retrair)

**O que fazer**

1. Mova o nó `#workspaceSwitcher` (o `<div role="tablist">` inteiro, sem reescrever os botões) para
   dentro de `#right-dock`, como **primeiro filho**, antes de `#persistenceWarning`.
2. Mova `#btnToggleRightDock` para o mesmo cabeçalho, à direita do seletor.
3. Crie `#dock-header` envolvendo os dois (`display:flex; align-items:center; gap:8px; height:38px;
   padding:0 10px; border-bottom:1px solid var(--border-subtle)`) e mantenha o cabeçalho fixo
   (`flex-shrink:0`) acima da área rolável dos painéis.
4. `#persistenceWarning` continua logo abaixo do cabeçalho, sempre visível quando ativo.
5. Ajuste `.dock-workspace-pane`: troque `height:100%` por `flex:1; min-height:0`. Com o cabeçalho
   de 38 px dentro do dock (que é `flex-direction:column`), `height:100%` empurra o conteúdo para
   fora da área visível.
6. O cabeçalho do painel “Edição & Simetria” **mantém** a barra de undo/redo
   (`#btnEditUndo`, `#editHistoryStepLabel`, `#btnEditRedo`) onde está. Ela pertence ao painel, não
   ao `#dock-header` — não a promova junto.

**Não faça:** duplicar os botões de modo para o estado recolhido (ver T2). Um nó, dois layouts.

**Aceite**

- `#workspaceSwitcher` e `#btnToggleRightDock` são descendentes de `#right-dock`
  (`el.closest('#right-dock') !== null`).
- `document.querySelectorAll('.ws-mode-btn').length === 2` (não 4).
- A barra superior continua com Exportar e Seed visíveis em 1440 e 1280, sem rolagem horizontal
  (`#top-control-bar.scrollWidth <= clientWidth + 1`).

---

### T2 — Gaveta: recolher para régua de 44 px (não desaparecer)

**O que fazer**

1. `--dock-rail-w: 44px` em `:root`.
2. Substitua `body.right-dock-collapsed #right-dock { display:none }` por um estado de régua:

```css
body.right-dock-collapsed #right-dock { width: var(--dock-rail-w); }
body.right-dock-collapsed .dock-workspace-pane,
body.right-dock-collapsed #persistenceWarning { display: none; }
body.right-dock-collapsed #dock-header {
  flex-direction: column; height: auto; padding: 8px 0; gap: 8px;
}
body.right-dock-collapsed #workspaceSwitcher { flex-direction: column; }
body.right-dock-collapsed .ws-mode-btn span { display: none; }   /* só ícone */
body.right-dock-collapsed #workspaceSwitcher .ws-mode-btn { width: 32px; height: 32px; }
```

3. O **mesmo** `#btnToggleRightDock` passa a mostrar `»` (expandir) quando recolhido e `«` quando
   expandido. O `.active` atual continua valendo como “dock aberto”.
4. Ao recolher, os painéis não são destruídos: só escondidos. Ao expandir, o painel que estava
   aberto continua aberto.
5. **Estado persistido:** `StudioState.rightDockCollapsed` (boolean), gravado no payload e
   restaurado no load. Sem isso, recarregar sempre reabre o dock.

**Aceite**

- Recolhido: `#right-dock.getBoundingClientRect().width` entre 43 e 45; `#workspaceSwitcher`
  visível com 2 botões de 32×32; clicar em “Editor” troca o workspace **sem expandir** o dock.
- Expandido: largura 350 (ou o valor de `--right-dock-w`).
- Área útil cresce: `#workspace-viewport.getBoundingClientRect().width` aumenta ~306 px ao
  recolher (meça antes e depois; `#canvas-stage` pode continuar com o tamanho do artboard e não
  serve como prova).
- Recarregar mantém o estado recolhido.
- `Tab` continua alternando (o atalho atual deve seguir funcionando).

---

### T3 — Acordeão de painéis (ligar o que já existe)

**O que fazer**

1. Implemente o handler de `.panel-header[data-collapse-target]`: clique alterna
   `.collapsed` no `<section class="dock-panel">` e `.hidden` no corpo alvo.
2. Adicione `data-collapse-target` aos cabeçalhos que não têm (o painel “Edição & Simetria”, o de
   pincel/supertile e o de paleta) e dê `id` a cada corpo.
3. O cabeçalho vira botão acessível: `role="button"`, `tabindex="0"`, `aria-expanded`,
   `aria-controls`, e responde a `Enter`/`Espaço`.
4. **Persistência:** `StudioState.dockPanels = { panelSymmetry: true, panelSwatches: false, ... }`.
   Não é obrigatório mais de um painel aberto por vez; preserve a escolha do usuário.
5. Não mude o conteúdo dos painéis nesta tarefa.

**Aceite**

- Clicar no cabeçalho “Simetria & Estrutura” fecha o corpo; o chevron gira (`.dock-panel.collapsed`
  já existe no CSS); clicar de novo reabre.
- Estado sobrevive ao reload.
- `aria-expanded` acompanha o estado.

---

### T4 — Barra esquerda: só ferramentas, cores no rodapé

**O que fazer**

1. Ordem final: `inspect`, `paint`, `rotate`, `stamp` · divisor · `pan`, `zoom` · `flex:1` ·
   widget de cores.
2. Mova `.color-tool-section` para o **fim** da barra (rodapé), com `margin-top:auto`, alinhado ao
   centro, sem divisor acima — como Photoshop/Illustrator.
3. Remova da barra esquerda: `#btnFitArtboard` (vai para T5) e os quatro toggles de guias
   `#toggleGuideAxes`, `#toggleGuideBlocks`, `#toggleGuideSubtiles`, `#toggleGuideOrbits` (vão para
   T5). `#btnToggleRightDock` já saiu em T1.
4. A barra fica com 6 botões de ferramenta + cores. Nada mais.

**Aceite**

- `#left-toolbar` contém exatamente 6 `.tool-btn[data-tool]` e o widget de cores; nenhum outro
  botão.
- O widget de cores é o **último** elemento e seu `bottom` está a ≤ 16 px do fundo da barra.
- Clicar em fg/bg ainda abre o seletor nativo e o `X` continua invertendo.

---

### T5 — Barra inferior: a barra da visão

**O que fazer**

1. Reorganize `#status-bar` em três zonas:
   - **esquerda (visão):** `[−] [100% ▾] [+] [Ajustar] [1:1]` num único grupo coeso
     (`.zoom-widget`), com no máximo 8 px entre o seletor e os botões vizinhos;
   - **centro:** tamanho do artboard · grade/órbitas · inspetor de hover (este com `flex:1;
     min-width:0; text-overflow:ellipsis; white-space:nowrap`);
   - **direita:** os 4 toggles de guias + `?`.
2. `#btnFitArtboard` muda de lugar e de rótulo visível: texto **Ajustar** (ícone de cantos), com
   `title` “Ajustar à janela (0)”. `#btnZoomReset100` continua “1:1”.
3. Os 4 toggles de guias passam a `class="status-guide-btn"`, tamanho 22×22, com `aria-pressed`
   refletindo `StudioState.guides`, `aria-label` e `data-tooltip` de uma linha. Os `id` **não
   mudam** (`bindGuideToggle` depende deles) — mas ajuste `bindGuideToggle` para também atualizar
   `aria-pressed` a cada toggle, e garanta a regra CSS `.status-guide-btn.active` (a antiga
   `.tool-btn.guide-toggle.active` deixa de casar).
4. Nada de rolagem horizontal em 1280; o inspetor é o único que encurta.

**Aceite**

- `#btnFitArtboard` e `#btnZoomReset100` dentro de `#status-bar`, ambos a ≤ 24 px do
  `#zoomPresetSelect` (mesma linha, mesmo grupo).
- Clicar em “Ajustar” centraliza o artboard (comportamento atual preservado) e em “1:1” volta a
  100%.
- Os 4 guias continuam alternando por clique e por `A`, `M`, `O`, e `aria-pressed` acompanha.
- Em 1280, `#status-bar.scrollWidth <= clientWidth + 1`.

---

### T6 — Barra superior: só documento

**O que fazer**

1. Com o seletor de modo fora, reagrupe em quatro blocos, nesta ordem: marca · **Artboard** ·
   **Grade** · **Seed** · (espaçador) · **Exportar**.
2. Reavalie a compactação de 1280 descrita em §3.3 e registre a medição.
3. Remova o seletor de ferramentas duplicado do dock (`#editToolSegmented` e o bloco
   correspondente), já que a barra esquerda é a fonte única. As funções que o consultam usam
   `querySelectorAll` e continuam seguras com zero resultados — confirme.
4. Se remover o seletor do dock deixar o cabeçalho do painel “Edição & Simetria” vazio, esse
   cabeçalho vira o acordeão de T3 e o painel começa pelo escopo.

**Aceite**

- Nenhum controle de modo de trabalho na barra superior.
- `#editToolSegmented` não existe mais no DOM (ou existe vazio e escondido — escolha uma coisa e
  registre).
- A barra superior não rola em 1280 e Exportar termina a ≤ 6 px da borda direita.

---

### T7 — Acessibilidade e teclado (não regride nada)

1. `#workspaceSwitcher` mantém `role="tablist"`; cada botão `role="tab"` e `aria-selected`.
2. `#btnToggleRightDock`: `aria-expanded` refletindo o estado e `aria-controls="right-dock"`.
3. Toggles do rodapé: `aria-pressed`; botões de ícone: `aria-label`.
4. Ordem de tabulação coerente: barra superior → barra esquerda → canvas → rodapé → dock.
5. Foco visível em todos os novos botões (`:focus-visible` já existe — confirme que pegou).
6. Atalhos existentes intactos: `V B R S H Z X A M O 1–6 [ ] 0 ? Tab`, `Ctrl+Z/Y`, `G`.

**Aceite**

- Percurso completo por Tab sem armadilha e sem elemento fora da ordem visível.
- Nenhum atalho perdido (roteiro da seção 6).

---

### T8 — Trava de inventário, capturas e documentação

1. **Teste de registro:** `tests/test_ui_control_registry.js` valida que os **58 ids** do anexo A
   existem exatamente uma vez em `index.html`. Este teste é a garantia de que a reorganização não
   perdeu controle. Ele deve falhar se qualquer id desaparecer.
2. **Teste de contrato de layout:** `tests/test_ui_layout_contract.js` valida por análise do
   `index.html`:
   - `#workspaceSwitcher` e `#btnToggleRightDock` dentro de `#right-dock`;
   - `#btnFitArtboard`, `#btnZoomReset100` e os quatro `#toggleGuide*` dentro de `#status-bar`;
   - `#fgColorPicker` dentro de `#left-toolbar` e depois do último `.tool-btn[data-tool]`;
   - `#editToolSegmented` ausente.
   *(Conterência por substring aqui é legítima: é estrutura estática, não comportamento.)*
3. **Registre as duas suítes novas** em `tests/run_all.js` (passa de 18 para **20**) e confirme que
   o CI continua chamando apenas o runner. `node tests/run_all.js` precisa terminar com
   `ALL 20/20 TEST SUITES PASSED`.
4. **Prova de runtime** (navegador do Antigravity + CDP, como na rodada 2): geometria real dos
   itens acima nos estados expandido/recolhido e nas duas resoluções.
5. **Capturas** em `tests/screenshots/`, geradas **depois** do último commit:
   `layout_gerador_1440x900.png`, `layout_editor_1440x900.png`, `layout_dock_recolhido_1440x900.png`,
   `layout_gerador_1280x800.png`, `layout_editor_1280x800.png`,
   `layout_dock_recolhido_1280x800.png` + um close do cabeçalho do dock e do rodapé.
   **Cada arquivo precisa ser único e mostrar o que o nome promete.** A Rodada 3 entregou
   `popover_scopes_1440x900.png` byte-idêntico a `editor_paint_1440x900.png`; para não repetir,
   rode `Get-FileHash tests/screenshots/layout_*.png` e cole a tabela — se dois hashes coincidirem,
   a captura está errada. Aproveite e substitua `tests/screenshots/tooltip_1440x900.png`, que ficou
   parado na UI da Rodada 2.
6. **Documentação:** atualize `README.md` (seção de UI) e `docs/MANUAL_MANUTENCAO.md` com a nova
   taxonomia das quatro superfícies e o estado `right-dock-collapsed`. Registre no relatório qual
   alternativa foi descartada (ex.: guias como menu) e por quê. Mantenha
   `tests/test_docs_consistency.js` verde — ele reprova `kaleidoscope_permissive`, a chave antiga e
   qualquer função citada que não exista no módulo.

**Aceite**

- Os dois testes novos falham se o controle for movido para fora da superfície correta.
- `run_all.js` roda 20 suítes e o CI segue verde.
- 6 capturas + 2 closes, todas posteriores ao commit final, com **8 hashes distintos**.
- README e manual descrevem a UI que existe, não a antiga.

---

## 5. Regras de implementação

1. **Mova nós, não reescreva.** `#workspaceSwitcher`, `.ws-mode-btn`, `#btnToggleRightDock`,
   `#btnFitArtboard`, `#toggleGuide*` e os ids das ferramentas não mudam de nome nem de handler.
2. **Preserve os seletores que o JS usa:** `#workspaceSwitcher .ws-mode-btn`,
   `#left-toolbar .tool-btn[data-tool]`, `#canvasCenterSymControl .seg-btn[data-center-sym]`,
   `#editScopeGrid .edit-scope-card`. Se precisar mover algo que um desses seletores alcança,
   ajuste o seletor no mesmo commit e explique.
3. **Nenhuma mudança de lógica** em `core/*` nesta rodada. Em `sketch.js`, o diff deve se limitar a:
   estado do dock e dos painéis, handler do acordeão, `bindGuideToggle` (se o rótulo/estado mudar) e
   a chamada de `syncEditWorkspaceUI` no toggle.
4. Nada de `position:fixed` para “resolver” layout. A gaveta é flex, não overlay.
5. Um commit por tarefa (T1…T8), com mensagem no padrão já usado no repositório.
6. Não altere `--bg-*`, `--text-*`, `--accent-*` nem introduza cor nova. A paleta é a mesma.
7. Não mexa em `_legacy/`, `libraries/`, no catálogo de tiles nem no motor D4.

---

## 6. Roteiro de validação

Servidor local (`python -m http.server 8765`), storage limpo antes de cada cenário.
Testar em **1440×900** e **1280×800**.

**A — Cabeçalho do dock.** O seletor Gerador/Editor aparece no topo do dock; clicar alterna os
painéis; a barra superior fica sem ele; nada de rolagem horizontal no topo.

**B — Gaveta.** Clicar em `«`: dock vira régua de 44 px, canvas cresce, os dois ícones de modo
continuam clicáveis e trocam o workspace sem abrir o dock. Recarregar: continua recolhido. `Tab`
alterna. Clicar em `»`: volta aos 350 px com o mesmo painel aberto.

**C — Acordeão.** Fechar “Simetria & Estrutura” e “Swatches”; recarregar; os dois continuam
fechados. Chevron gira. Teclado: Tab até o cabeçalho, Enter fecha/abre.

**D — Barra esquerda.** Seis ferramentas, cores no rodapé coladas no fundo. Nenhum botão de guia
ou de ajustar sobrando ali.

**E — Rodapé.** `− 100% ▾ + Ajustar 1:1` no mesmo grupo, à esquerda. Guias à direita, com estado
visível. O inspetor encurta sem empurrar os vizinhos. Em 1280 nada é cortado.

**F — Nada perdido.** Percorrer o anexo A e confirmar que cada controle existe, está visível em
pelo menos um estado e faz o que fazia.

**G — Atalhos.** `V B R S H Z X A M O 1–6 [ ] 0 ? Tab Ctrl+Z Ctrl+Y G` — todos funcionando,
inclusive com o foco dentro do dock.

---

## 7. Critérios de aceite finais

- [ ] Seletor de modo e botão de retrair no cabeçalho do dock; topo sem modo de trabalho.
- [ ] Dock recolhe para régua de 44 px (não desaparece) e o estado persiste.
- [ ] Acordeão de painéis funciona, persiste e é acessível por teclado.
- [ ] Barra esquerda com 6 ferramentas + cores no rodapé.
- [ ] Rodapé com zoom, Ajustar e 1:1 juntos e próximos da porcentagem.
- [ ] Guias no rodapé, com `aria-pressed` e atalhos preservados.
- [ ] `#editToolSegmented` removido (sem duplicar ferramenta em dois lugares).
- [ ] Os 58 ids do anexo A intactos.
- [ ] Sem rolagem horizontal em 1280 no topo nem no rodapé.
- [ ] 6 capturas + 2 closes, posteriores ao commit final, com 8 hashes distintos.
- [ ] `run_all.js` com 20 suítes; CI verde; `test_payload_version.js` e `test_docs_consistency.js` intactos.
- [ ] `#editScopeChip` e o badge “D4 editado” continuam funcionando depois do rearranjo.
- [ ] README e manual atualizados.
- [ ] Nenhum erro no console.

---

## 8. Formato da resposta final

1. **Resumo por tarefa** (T1–T8): `feito` / `não feito` / `feito com ressalva`.
2. **Tabela de-para**: controle → superfície antiga → superfície nova (no mínimo os 13 que mudaram).
3. **Medições** (px) dos itens do aceite, nas duas resoluções e nos dois estados do dock.
4. **Testes** (comando + resultado) e as saídas das provas de runtime.
5. **Capturas** (caminhos, resoluções e a tabela de hashes SHA256 — oito distintos).
6. **O que foi considerado e descartado** (ex.: guias como menu, duas colunas na barra esquerda).
7. **`git diff --stat`**.

Não escreva “concluído” sem as medições. Se algo ficou pela metade, diga o que e por quê.

---

## 9. O que não fazer

- Não duplicar o seletor de modo (um nó, dois layouts).
- Não fazer o dock recolhido desaparecer: ele precisa continuar mostrando os dois modos.
- Não mover Exportar, Seed ou os campos de Artboard/Grade para dentro de menus “para enxugar”.
- Não transformar os guias em menu suspenso nesta rodada (eles vão para o rodapé, visíveis).
- Não usar overlay/`position:fixed` para a gaveta.
- Não renomear ids, classes ou handlers existentes.
- Não mexer em motor, catálogo, D4 ou persistência de mosaico.
- Não deixar `data-collapse-target` sem handler (é o estado atual e é o defeito que T3 corrige).
- Não trocar a paleta nem o tema.

---

## 10. Critério de escalação

Se mover um controle exigir mudar comportamento (por exemplo, `#btnFitArtboard` depender de estar
na barra esquerda para calcular o enquadramento), **pare e reporte**: o que tentou, o efeito
colateral, duas opções com trade-off e uma recomendação. Layout não justifica quebrar função.

---

## 11. P2 — Robustez do runner (opcional, fora do layout)

`tests/run_all.js` ignora `res.error`. Em ambiente restrito (política de processo no Windows),
`spawnSync` devolve `{ status: null, error: EPERM }` e o runner imprime um bloco `FAILURE` **vazio**,
sem a causa. Duas linhas resolvem:

```js
if (res.error) {
  console.error(`spawn falhou em ${suite}: ${res.error.code || res.error.message}`);
  process.exit(1);
}
```

Opcional: quando houver `res.error`, repetir com `stdio: 'inherit'` para o diagnóstico aparecer.
Não toca em layout nem em produto; se fizer, faça em commit separado.

---

## Anexo A — Inventário congelado (58 ids)

Use esta lista no `tests/test_ui_control_registry.js`. Todo id precisa existir exatamente uma vez.

```json
["canvasW","btnSwapCanvasSize","canvasH","btnLockCanvasRatio","btnFitCanvasToGrid",
 "gridRows","btnSwapGridSize","gridCols","btnLockGridRatio","btnSquareGrid","gridMargin",
 "seedInput","btnRandomize","btnPrevSeed","btnNextSeed","btnToggleHistory",
 "exportFormatSelect","btnExport",
 "toolInspect","toolPaint","toolRotate","toolStamp","toolPan","toolZoom",
 "bgColorPicker","fgColorPicker","btnSwapColors",
 "toggleGuideAxes","toggleGuideBlocks","toggleGuideSubtiles","toggleGuideOrbits",
 "btnFitArtboard","btnToggleRightDock",
 "btnZoomOut","zoomPresetSelect","btnZoomIn","btnZoomReset100","btnHelp",
 "btnMakeGridEqual","paddingSlider","tileSearchInput","btnSelectAllTiles","btnSelectNoTiles",
 "btnInvertTiles","btnRandomFamilies",
 "btnEditUndo","btnEditRedo","btnD4Undo","btnD4Continue",
 "btnBrushRot90","btnBrushFlipX","btnBrushFlipY","btnBrushResetD4",
 "btnSupertileFillAll","btnSupertileSymmetrize","btnSupertileCapture",
 "editBrushSearchInput","infoPopoverClose"]
```

## Anexo B — De-para pretendido

| Controle | Hoje | Depois |
|---|---|---|
| `#workspaceSwitcher` | barra superior | cabeçalho do dock |
| `#btnToggleRightDock` | barra esquerda (rodapé) | cabeçalho do dock |
| `#btnFitArtboard` | barra esquerda (rodapé) | rodapé, junto ao zoom |
| `#toggleGuideAxes/Blocks/Subtiles/Orbits` | barra esquerda | rodapé, à direita |
| `.color-tool-section` | meio da barra esquerda | rodapé da barra esquerda |
| `#editToolSegmented` | dock (duplicata) | removido |
| Cabeçalhos de painel | sem handler | acordeão persistente |

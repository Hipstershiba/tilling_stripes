# Instruções — Rodada 6: Painéis à direita e o fim da barra esquerda

**Destinatário:** Gemini 3.8 Flash, no Antigravity
**Repositório:** raiz deste projeto
**Branch:** `develop`
**Estado de referência:** commit que fechar a Rodada 4.2. **Anote o hash antes de começar.**
**Relação com a Rodada 5:** independente. Esta rodada pode rodar antes ou depois do catálogo de
tiles (Rodada 5); não toque em `core/tile_registry.js`.

**Objetivo:** inverter a geografia da interface — ferramentas à direita do canvas, painel contextual
na extrema direita, uma faixa reservada à esquerda, e os ajustes finos (respiro, pincel, snap, guias,
exportar) no lugar em que se usam.

> Esta rodada mexe em **onde os controles vivem**, não no que eles fazem. Nenhuma mudança de motor,
> catálogo, D4 ou persistência de mosaico. Se mover um botão exigir mudar comportamento, pare e
> reporte.

---

## 1. Decisões de layout (fechadas com o usuário)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TS  Tiling Stripes │ Artboard W 600 ⇄ H 600 🔒 Ajustar │ Grade L 3 ⇄ C 3    │
│                    │ 🔒 1:1 Margem 24 │ Seed #88873 ⟳ ◀ ▶ ⏱                  │
├────┬────────────────────────────────────────────────┬────┬──────────────────┤
│ F  │                                                │ F  │  painel          │
│ a  │                    canvas                      │ e  │  contextual      │
│ i  │                                                │ r  │  (350 px)        │
│ x  │                                                │ r  │                  │
│ a  │                                                │ a  │  ▸ Gerador       │
│ 44 │                                                │ 44 │  ▸ Pincel        │
│    │                                                │    │  ▸ Girar…        │
├────┴────────────────────────────────────────────────┴────┴──────────────────┤
│ − 100% ▾ + │ Ajustar │ 1:1 │ 600×600 │ Grade 3×3 │ hover… │ PNG ▾ Exportar │ ? │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Zona | Largura | Conteúdo |
|---|---|---|
| Faixa esquerda (`#left-rail`) | 44 px | **reservada** — ver T8 |
| Canvas (`#workspace-viewport`) | resto | artboard |
| Ferramentas (`#left-toolbar`, id mantido) | 44 px | contexto + ferramentas + guias + cores |
| Painel (`#right-dock`) | 350 px (44 recolhido) | conteúdo **conforme o contexto** |

Ordem na coluna de ferramentas, de cima para baixo:

1. **`#btnContextGenerator`** — o primeiro ícone, que abre o painel de **geração** (é o substituto do
   switch Gerador/Editor que hoje está no cabeçalho do dock).
2. Ferramentas: `inspect`, `paint`, `rotate`, `stamp`, `freeze`.
3. Navegação: `pan`, `zoom`.
4. **Guias** (os 4 toggles que hoje estão no rodapé) — entre o zoom e as cores.
5. Espaçador.
6. **Cores** (fg/bg + trocar), no rodapé da coluna — continua sendo o último.

**Por que os guias vêm para cá:** eles são estado de visualização da obra, e o rodapé precisa de
espaço para o Exportar. O usuário pediu explicitamente esse retorno, entre o ajuste de cores e a lupa.

---

## 2. Tarefas

### T1 — As quatro zonas (DOM + CSS)

**O que fazer**

1. Em `index.html`, mova o nó `<aside id="left-toolbar">` para **depois** de `#workspace-viewport` e
   **antes** de `#right-dock`. **Não renomeie** o id: meia dúzia de seletores e dois testes dependem
   dele.
2. Crie `<aside id="left-rail" aria-label="Faixa de ações do documento">` como primeiro filho de
   `#workspace-body`.
3. CSS: `--left-rail-w: 44px`; `#left-rail { width: var(--left-rail-w); ... }`; a coluna de
   ferramentas ganha `border-left` em vez de `border-right`; a faixa esquerda ganha `border-right`.
4. Em 1280×800 e 1440×900, `#workspace-viewport` perde 44 px de largura (a coluna de ferramentas
   mudou de lado e a faixa apareceu). Confirme que nada passa a rolar.

**Aceite**

- `index.html`: ordem dos irmãos em `#workspace-body` = `#left-rail`, `#workspace-viewport`,
  `#left-toolbar`, `#right-dock`.
- `#left-toolbar` continua com 9 `[data-tool]` (6 ferramentas + contexto + … — ver T2) e as cores.
- Nenhuma rolagem horizontal em 1440 nem em 1280.

### T2 — O primeiro ícone é o painel de geração

**O que fazer**

1. Remova do cabeçalho do dock o `#workspaceSwitcher` (o switch Gerador/Editor). O cabeçalho fica com
   o título do contexto e o botão de recolher (`#btnToggleRightDock`).
2. Crie na coluna de ferramentas o primeiro botão:

```html
<button type="button" id="btnContextGenerator" class="tool-btn ctx-btn active"
        title="Painel de geração (grade, simetria, tiles)" aria-pressed="true">
  <!-- ícone de geração: grade/sliders -->
</button>
```

3. O painel da direita passa a ter **um** conteúdo por vez, escolhido por contexto:
   - contexto `generator` → o antigo `#dock-workspace-generate` (painel de simetria, subdivisão,
     respiro, swatches);
   - contexto `paint` / `rotate` / `stamp` / `freeze` → as opções daquela ferramenta.
   Clique no `#btnContextGenerator` volta ao contexto de geração. Selecionar uma ferramenta no rail
   troca o contexto para ela — **sem** exigir um segundo clique.
4. `StudioState.workspace` continua existindo (`'generate' | 'edit'`), mas passa a ser derivado do
   contexto: `generator` → `'generate'`; qualquer ferramenta → `'edit'`. Mantenha o campo no payload
   para não quebrar saves antigos.
5. Título do painel (`#ctxPanelTitle`) mostra “Geração”, “Pincel”, “Girar”, “Carimbo”, “Trava”.

**Aceite**

- `document.querySelectorAll('#workspaceSwitcher').length === 0`.
- Clicar em `#btnContextGenerator` mostra o painel de geração; clicar em `#toolPaint` mostra as opções
  do pincel; o `#ctxPanelTitle` acompanha.
- Com a gaveta recolhida, clicar em `#btnContextGenerator` **expande** o painel (não troca escondido).
- `aria-pressed` marca o contexto ativo (gerador ou ferramenta).

### T3 — Guias de volta à coluna, entre o zoom e as cores

**O que fazer**

1. Mova os quatro `#toggleGuide*` do `#status-bar` para a coluna de ferramentas, logo **abaixo** do
   `#toolZoom` e **acima** do espaçador/cores.
2. Voltam a ser `.tool-btn.guide-toggle` (`32×32`), com `aria-pressed` e tooltips atuais; a classe
   `.status-guide-btn` e suas regras CSS são removidas.
3. O rodapé perde os quatro botões e ganha o Exportar (T4).

**Aceite**

- `#status-bar` não contém `#toggleGuide*`.
- Na coluna: `#toolZoom` vem antes dos guias; os guias vêm antes das cores.
- `A`, `M`, `O` continuam alternando; `aria-pressed` acompanha.
- Em 1280 o rodapé não rola.

### T4 — Exportar no rodapé

**O que fazer**

1. Mova `#exportFormatSelect` + `#btnExport` para o `#status-right`, antes do `#btnHelp`.
2. Rótulo continua “Exportar”, com ícone; o select fica compacto (altura do rodapé).
3. A barra superior perde o grupo de export e o espaçador passa a empurrar o fim.
4. Reavalie a compactação de 1280: com o export fora, os rótulos completos (“Ajustar à Grade”,
   “Células 1:1”, “Margem”) provavelmente voltam a caber. Se couberem, remova a regra de
   `@media (max-width: 1280px)` que os esconde; registre a medição.

**Aceite**

- `#btnExport` dentro de `#status-bar`; ausente de `#top-control-bar`.
- Clicar exporta nos dois formatos (PNG e SVG).
- `#top-control-bar` não rola em 1280 nem 1440.

### T5 — Respiro interno como contador

**O que fazer**

1. Substitua o `<input type="range" id="paddingSlider">` por um chip numérico no mesmo padrão de
   `#canvasW` (prefixo, input, steppers `▴▾`, sufixo `%`):

```html
<div class="input-chip chip-medium" title="Espaçamento interno dos azulejos (%)">
  <input type="number" id="paddingInput" min="0" max="25" step="1" value="5">
  <div class="chip-steppers">
    <button type="button" class="step-btn" data-step-target="paddingInput" data-step-dir="1" tabindex="-1" title="Aumentar">▴</button>
    <button type="button" class="step-btn" data-step-target="paddingInput" data-step-dir="-1" tabindex="-1" title="Diminuir">▾</button>
  </div>
  <span class="chip-suffix">%</span>
</div>
```

2. `#paddingSlider` é **removido** (não fica escondido). Atualize o handler para `change` + `input`
   com o mesmo clamp `0..25`, gravando `paddingRatio = valor / 100`.
3. Atualize `tests/test_ui_control_registry.js`: troca `paddingSlider` por `paddingInput` (a lista
   continua com 58 controles; o anexo A desta rodada substitui o da Rodada 4).
4. O handler de padding passa a usar `saveScheduler.schedule()` (é contínuo).

**Aceite**

- `#paddingSlider` não existe mais; `#paddingInput` responde a digitação e aos steppers.
- Valor 0 e 25 funcionam; valor fora da faixa é clampado.
- O desenho muda ao vivo e a alteração sobrevive ao reload.

### T6 — Tamanho do pincel pelo scroll

**O que fazer**

1. No `pasteboard`, `wheel` com **Shift** e uma ferramenta de tamanho ativa (`paint`, `stamp`,
   `freeze`) percorre `1×1 → 2×2 → 3×3 → 4×4 → Bloco → 1×1`.
2. `preventDefault()` só nesse caso: `Ctrl/Cmd + wheel` continua zoom e o wheel simples continua
   rolando a pasteboard.
3. Feedback: `showEditorToast('Pincel 2×2')` curto (ou o label do painel piscando), e o segmented de
   tamanho acompanha.

**Aceite**

- `Shift+wheel` para cima aumenta, para baixo diminui, e cicla.
- `Ctrl+wheel` continua alterando o zoom; wheel sem Shift continua rolando.
- Com a ferramenta `inspect`, `Shift+wheel` não faz nada (não há tamanho).

### T7 — Snap ao bloco como switch

**O que fazer**

1. Crie um componente `.switch` (role="switch", `aria-checked`) — não existe nenhum hoje.
2. Em **Pincel e Carimbo**: `#brushSnapSwitch` “Snap ao bloco”. Ligado: o pincel usa N×N alinhado à
   grade de blocos (`brushSizeMode = 'block'`, `brushSnapToBlock = true`) e os botões de tamanho ficam
   desabilitados. Desligado: volta ao último tamanho escolhido.
3. Em **Girar**: `#rotateSnapSwitch` equivalente, mapeado em `rotateSnapToBlock`.
4. Estado persistido como hoje (`brushSnapToBlock`, `rotateSnapToBlock`) — nada de campo novo.
5. Não remova o valor `'block'` de `brushSizeMode`: saves antigos o usam. O switch é a **interface**
   dele.

**Aceite**

- Ligar o switch força o tamanho de bloco; desligar restaura o tamanho anterior (ex.: 2×2).
- O switch e o estado do pincel nunca discordam após reload.
- `role="switch"` + `aria-checked` corretos; espaço/enter alternam.

### T8 — A faixa esquerda

O usuário quer o espaço, mas ainda não decidiu o conteúdo. Esta rodada **define o slot**, não inventa
produto:

1. `#left-rail` de 44 px, mesma cor de painel, sem conteúdo de ferramenta.
2. Ocupantes recomendados (se o usuário não vetar): o logo `TS` no topo e o par **desfazer/refazer**
   no rodapé, movidos do cabeçalho do painel de edição (`#btnEditUndo`, `#btnEditRedo`,
   `#editHistoryStepLabel`). São ações de documento, globais, e hoje estão espremidas num cabeçalho de
   painel.
3. Se o usuário preferir vazio, deixe só a borda e registre no relatório. **Não** invente atalhos.

**Aceite**

- A faixa tem 44 px e não sobrepõe o canvas.
- Se os undo/redo forem movidos, continuam com os mesmos ids, funcionando por clique e `Ctrl+Z`/`Ctrl+Y`.

### T9 — Contratos, testes e capturas

1. Atualize `tests/test_ui_layout_contract.js` para a nova geografia:
   - `#left-toolbar` vem **depois** de `#workspace-viewport`;
   - `#left-rail` vem antes;
   - `#btnContextGenerator` é o primeiro `[data-tool]`-like da coluna (ou o primeiro filho da seção 1);
   - `#toggleGuide*` dentro de `#left-toolbar` e depois de `#toolZoom`;
   - `#btnExport` em `#status-bar`, ausente do topo;
   - `#workspaceSwitcher` ausente.
2. Atualize `tests/test_ui_control_registry.js` (novo anexo A abaixo).
3. `tests/test_context_panel.js` (novo): o contexto troca com o botão de geração e com cada ferramenta;
   `#ctxPanelTitle` acompanha.
4. Capturas (hashes distintos, regra da Rodada 4): 1440 e 1280 × {geração, pincel, girar, trava, dock
   recolhido} + um close do rodapé com o Exportar.
5. `README.md` e `docs/MANUAL_MANUTENCAO.md`: nova geografia e o conceito de contexto.

**Aceite**

- 28 suítes verdes (24 + T2 + T3 + T5? — ajuste o número ao que criar e registre no runner).
- Nenhuma captura repetida (hash único).
- README descreve a UI que existe.

---

## 3. Anexo A — inventário de controles (rodada 6)

Base: os 58 ids da Rodada 4, com as diferenças:

- **removido:** `paddingSlider`
- **adicionado:** `paddingInput`, `btnContextGenerator`, `brushSnapSwitch`, `rotateSnapSwitch`

Total: **61**. Atualize `tests/test_ui_control_registry.js` com a lista completa e a contagem.

---

## 4. Regras

- Não renomeie `#left-toolbar`: ele muda de lugar, não de nome.
- Não apague `StudioState.workspace` do payload — saves antigos dependem dele.
- Não mexa em `core/` nesta rodada (exceto nada).
- Um commit por tarefa (T1…T9).
- Sem dependência nova, sem framework, sem bundler.

---

## 5. Roteiro de validação

1. 1440×900: canvas à esquerda da coluna de ferramentas; guias entre zoom e cores; cores no rodapé da
   coluna; painel à direita com o título do contexto.
2. Clicar em cada ferramenta: o painel troca e o título acompanha. Clicar no primeiro ícone: volta ao
   painel de geração.
3. Recolher o dock (`«`): coluna de 44 px com os ícones de contexto; clicar no gerador expande.
4. `Shift+wheel` no canvas: tamanho do pincel muda com toast; `Ctrl+wheel` dá zoom; wheel puro rola.
5. Respiro: digitar 12, usar steppers, recarregar.
6. Snap: ligar/desligar em Pincel e em Girar.
7. Exportar pelo rodapé nos dois formatos.
8. 1280×800: nada cortado, nada rolando.

---

## 6. Critérios de aceite finais

- [ ] Quatro zonas na ordem definida; barra de ferramentas à direita do canvas.
- [ ] Primeiro ícone abre o painel de geração; ferramentas trocam o painel.
- [ ] Switch Gerador/Editor removido; contexto único no painel.
- [ ] Guias na coluna, entre zoom e cores; rodapé sem guias.
- [ ] Exportar no rodapé; barra superior sem export.
- [ ] Respiro como contador numérico.
- [ ] `Shift+wheel` ajusta o pincel sem quebrar zoom/scroll.
- [ ] Snap como switch em pincel e girar.
- [ ] Faixa esquerda com 44 px (conteúdo conforme T8).
- [ ] Registro com 61 ids; 28 suítes; capturas com hash único.

---

## 7. Formato da resposta final

Tabela tarefa → status; medições de largura das quatro zonas em 1440 e 1280; capturas com hashes;
testes com comando e resultado; `git diff --stat`.

---

## 8. O que não fazer

- Não mover as ferramentas para a **extrema** direita: a ordem é canvas → ferramentas → painel.
- Não manter o switch Gerador/Editor no cabeçalho “por segurança”: ele foi substituído pelo primeiro
  ícone.
- Não deixar os guias no rodapé.
- Não transformar o Exportar num menu “⋯” com um item só (o usuário cogitou e descartou).
- Não usar wheel simples para o pincel (rouba a rolagem).
- Não inventar conteúdo para a faixa esquerda.

# Instruções — Rodada 4.1: Consertar a Trava e redesenhar sua integração

**Destinatário:** Gemini 3.8 Flash, no Antigravity
**Repositório:** raiz deste projeto (caminhos relativos)
**Branch de trabalho:** `develop`
**Estado de referência:** o commit que fechar a Rodada 4 + a extensão de freeze (§8 do relatório da
Rodada 4). **Antes de começar, commite a árvore de trabalho e anote o hash aqui** — a rodada 5 já
nasceu com linha de base móvel e não vamos repetir isso.
**Auditoria que originou esta rodada:** [`docs/relatorios/AVALIACAO_DEEPSEEK_RODADA4.md`](../relatorios/AVALIACAO_DEEPSEEK_RODADA4.md), §4.1, §4.2 e §4.3.

**Objetivo:** a ferramenta de congelar células está quebrada em dois pontos fatais e sua interface
duplica controles, promete o que não faz e esconde as opções que o artista precisa. Esta rodada
conserta os dois defeitos funcionais e **redesenha a integração** da Trava com as quatro superfícies.

> Esta rodada é curta e cirúrgica. Não há recurso novo de catálogo (isso é a Rodada 5), não há
> mudança no motor D4 e não há redesign das barras. O escopo é: **a Trava funcionar, não mentir e
> caber no lugar certo.**

---

## 1. O que está quebrado (medido, não suposto)

| # | Defeito | Evidência |
|---|---|---|
| F1 | O congelamento **não sobrevive à geração**. `regenerateMosaic()` (15 chamadas: seed, grade, simetria, tiles, artboard) gera um mosaico novo e nunca reaplica `frozenCells`. A reaplicação existe só no *load* (`sketch.js:527-548`) | §4.1 da auditoria |
| F2 | Travar/destravar **não salva**: o handler termina em `syncFreezeUI(); redraw();` sem `saveStudioStateToStorage()`. Recarregar perde a trava | `sketch.js:1758-1791` |
| F3 | **Navegar no histórico de gerações apaga a edição para sempre**: `restoreGenerationHistory()` → `regenerateMosaic(false)` substitui as células, `resetEditHistoryWithInitialSnapshot()` destrói o undo e `saveStudioStateToStorage()` grava a perda | §4.2 |
| F4 | O histórico guarda **só parâmetros** (seed, grade, modos, tiles), nunca células — não há versão editada de geração alguma | `sketch.js:884-899` |
| U1 | **Duplicata:** “Pincel Trava (F)” no painel chama o mesmo `setActiveTool('freeze')` do botão do rail — dois controles, um estado | `index.html:482`, `sketch.js:2785` |
| U2 | **Texto permanente** de ajuda no painel (“Subtiles travados ficam fixos…”), contrariando a divulgação progressiva da Rodada 2 | `index.html:493-495` |
| U3 | **Toggle implícito:** clicar numa célula já travada destrava; não existe gesto monotônico e não há undo | `sketch.js:1765-1767` |
| U4 | **Sem tamanho de pincel**: `resolveFreezeTargetPlacements()` usa um padrão 1×1 fixo, ignorando o brush | `sketch.js:1449` |
| U5 | **Sem controle de comportamento**: o escopo é herdado silenciosamente; com o padrão Centro, 1 clique trava 8 células | `sketch.js:1454` |
| U6 | **`Alt+Clique` prometido e morto**: o ramo de captura intercepta `altKey + botão 0` antes | `sketch.js:1748` |
| U7 | **Ícone errado:** cadeado no rail e no painel, micro-cadeado no overlay, floco só no inspetor de hover | `index.html:217`, `mosaic_engine.js:493`, `sketch.js:2353` |

---

## 2. Princípios (a integração é o que importa)

1. **Ferramenta ≠ modo.** A ferramenta mora no rail, com um único seletor. Modo (congelar/destravar)
   é **estado da ferramenta**, não uma segunda ferramenta.
2. **Gesto monotônico.** Em um modo, todo clique faz a mesma coisa. Nada de alternar conforme o
   estado da célula — é isso que faz o artista “desselecionar uma região sem querer”.
3. **Opções junto da ferramenta.** Tamanho e comportamento vão para o painel de edição, contextuais,
   no mesmo padrão de `#rotateToolOptionsWrap`.
4. **Estado e ação destrutiva onde o efeito aparece.** Contagem e “Descongelar tudo” no Gerador — numa
   linha que só existe quando há travas.
5. **Divulgação progressiva.** Explicação vai para `INFO_TOPICS.freeze` (já existe); no painel, só o
   `ⓘ`.
6. **Teste que falha sem a correção.** Vale o que a Rodada 3 estabeleceu: nenhuma tarefa conta como
   concluída porque um teste passou; ele precisa falhar no baseline.

---

## 3. Tarefas

### T1 — Congelamento sobrevive à geração (F1, F2)

**O que fazer**

1. Em `core/mosaic_engine.js`, crie e exporte:

```js
function applyFrozenCells(mosaicData, frozenCells) {
  // frozenCells: Map "r,c,sr,sc" -> { baseTileId, transform, tileId }
  // aplica nas células existentes; descarta chaves fora dos limites; devolve o Map saneado
}
```

2. Crie também o caminho único de geração:

```js
function generateMosaicWithFrozen(config, randomPick, frozenCells) {
  const mosaic = generateMosaic(config, randomPick);
  if (frozenCells && frozenCells.size) applyFrozenCells(mosaic, frozenCells);
  return mosaic;
}
```

3. `regenerateMosaic()` (`sketch.js:840`) passa a chamar `generateMosaicWithFrozen(..., StudioState.frozenCells)`
   — **sem** nenhum laço de restauração local.
4. O load (`sketch.js:527-548`) deixa de ter a cópia inline e usa `applyFrozenCells`.
5. O handler de trava e o de arrasto chamam `saveScheduler.schedule()` ao final.

**Aceite**

- `tests/test_freeze_generation.js` (novo) chama `generateMosaicWithFrozen` duas vezes com PRNGs
  diferentes e prova: células travadas idênticas (`baseTileId`, `transform`, `tileId`), células livres
  diferentes, chaves inválidas descartadas.
- `tests/test_freeze_wiring.js` (novo, de contrato): falha se `regenerateMosaic` deixar de chamar
  `generateMosaicWithFrozen` — checagem sobre o corpo da função em `sketch.js`, não sobre uma cópia.
- No app: travar 4 células → Gerar 3 vezes → as 4 continuam; recarregar → continuam (gravação no
  toggle).
- **Falha no baseline:** o construtor com congelamento não existe.

### T2 — Navegar no histórico não destrói a edição (F3, F4)

**O que fazer**

1. Crie `core/history_nav.js` (puro, testável):

```js
function planRestore(entry, current) { // current = { cellsSnapshot, frozenCells, editHistoryIndex }
  // devolve { action: 'restore_snapshot', snapshot } | { action: 'regenerate' }
}
```

2. Ao **sair** de uma entrada para navegar, se a entrada atual estiver “suja”
   (`editHistoryIndex > 0`), grave nela `cellsSnapshot` (via `cloneMosaicCellsSnapshot`) e o
   `frozenCells` serializado. Grave **preguiçosamente**: entrada sem edição continua custando só
   parâmetros.
3. Ao **entrar** numa entrada que tenha `cellsSnapshot`, restaure o snapshot em vez de regenerar.
4. Orçamento: reutilize `STORAGE_BUDGET_BYTES` / `getMaxEditHistoryForMosaic` do
   `core/state_persistence.js` para limitar o total. Se não couber, descarte as entradas editadas
   mais antigas e avise com `showEditorToast(..., 'warn')`. Nunca descarte em silêncio.
5. `restoreGenerationHistory()` não pode mais chamar `resetEditHistoryWithInitialSnapshot()` quando
   restaurar um snapshot — o undo da edição restaurada começa nela.
6. Se a navegação for para uma entrada **sem** snapshot e o mosaico atual estiver sujo, grave o
   snapshot da entrada atual antes de sair (2) — o caso comum passa a ter volta.

**Aceite**

- `tests/test_history_nav.js` (novo, módulo puro): entrada suja → `restore_snapshot`; entrada limpa →
  `regenerate`; snapshot acima do orçamento → `{ action: 'regenerate', warning: true }`.
- `tests/test_history_edit_preservation.js` (novo, integração com motor real): gera mosaico, edita 3
  células, tira snapshot, navega para outra entrada e volta → as 3 células voltam iguais.
- No app: editar → ◀ → ▶ → a edição está lá; `Ctrl+Z` continua funcionando depois de voltar.
- **Falha no baseline:** `core/history_nav.js` não existe e a edição se perde.

### T3 — Tirar a duplicata e o parágrafo (U1, U2)

**O que fazer**

1. Remova `#btnToggleFreezeTool` do DOM (o id é aposentado; nada mais o consulta).
2. Remova `#freezeHelpText`. O `ⓘ` (`data-info-topic="freeze"`) permanece — ele vai para o cabeçalho
   das opções (T4).
3. No painel do Gerador, substitua a seção inteira por uma linha de status:

```html
<div id="freezeStatusRow" class="freeze-status-row hidden">
  <span class="freeze-status-icon" aria-hidden="true"><!-- floco --></span>
  <span id="freezeCountLabel">16 subtiles</span>
  <span class="freeze-status-sep">·</span>
  <button type="button" id="btnClearFrozen" class="link-btn">Descongelar tudo</button>
</div>
```

4. A linha só aparece com `count > 0` (`syncFreezeUI`), some com zero e **não reserva altura**.

**Aceite**

- `document.querySelectorAll('[data-tool="freeze"]').length === 1` (só o rail).
- `#freezeHelpText` não existe no DOM; `#freezeCountBadge` também não (a contagem migra para
  `#freezeCountLabel`, no Editor e na linha de status).
- Com zero travas, `#freezeStatusRow` tem `display:none`; com uma, aparece.
- O botão “Descongelar tudo” continua funcionando e continua visível onde sempre esteve (Gerador).

### T4 — Modo, tamanho e comportamento no painel de edição (U3, U4, U5)

**O que fazer**

1. Em `index.html`, no painel do Editor, crie `#freezeToolOptionsWrap` no mesmo padrão de
   `#rotateToolOptionsWrap` (`class="prop-section hidden"`):

```html
<div id="freezeToolOptionsWrap" class="prop-section hidden">
  <div class="prop-label-row">
    <div class="prop-label-with-info">
      <label class="prop-label">Trava de Subtiles</label>
      <button type="button" class="info-btn" data-info-topic="freeze" aria-label="Saiba mais sobre a trava">i</button>
    </div>
    <span id="freezeCountLabel" class="prop-badge secondary">Nenhum</span>
  </div>

  <div class="segmented-control" id="freezeModeControl" role="group" aria-label="Modo da trava">
    <button type="button" data-freeze-mode="freeze" class="seg-btn active" aria-pressed="true">❄ Congelar</button>
    <button type="button" data-freeze-mode="unfreeze" class="seg-btn" aria-pressed="false">☀ Descongelar</button>
  </div>

  <div class="segmented-control" id="freezeSizeControl" role="group" aria-label="Tamanho da trava">
    <button type="button" data-freeze-size="1" class="seg-btn active">1×1</button>
    <button type="button" data-freeze-size="2" class="seg-btn">2×2</button>
    <button type="button" data-freeze-size="3" class="seg-btn">3×3</button>
    <button type="button" data-freeze-size="4" class="seg-btn">4×4</button>
    <button type="button" data-freeze-size="block" class="seg-btn">Bloco</button>
  </div>

  <label class="prop-checkbox">
    <input type="checkbox" id="freezeUseScope" checked>
    Aplicar ao escopo de simetria <span id="freezeScopeLabel" class="prop-hint-inline">Centro • 8 eixos</span>
  </label>
</div>
```

2. Estado novo em `StudioState`: `freezeMode: 'freeze'`, `freezeSize: '1'`, `freezeUseScope: true` —
   todos aditivos no payload (versão continua 3).
3. `syncEditWorkspaceUI()` mostra `#freezeToolOptionsWrap` só com `activeTool === 'freeze'` e
   atualiza `#freezeScopeLabel` a partir do `#editScopeChip`/`EDIT_SCOPES`.
4. `resolveFreezeTargetPlacements(hit)` passa a receber o modo, o tamanho e a flag de escopo:
   - tamanho `1..4` → padrão NxN; `block` → N do bloco;
   - `freezeUseScope === false` → **uma célula** (ou o padrão, sem propagação);
   - `freezeUseScope === true` → o caminho de escopo atual.
5. O clique **não alterna mais**: o modo decide. Clique direito inverte pontual (congelar ↔
   destravar) e o arrasto respeita o modo.
6. O preview do hover usa cor por modo: ciano (`6,182,212`) para congelar, âmbar (`245,158,11`) para
   destravar.

**Aceite**

- Modo Congelar: clicar numa célula já travada **mantém travada** (não remove).
- Modo Descongelar: clicar numa célula livre **não faz nada**.
- Tamanho 2×2 com escopo desligado trava exatamente 4 células.
- Escopo ligado no padrão Centro trava 8 e o contador mostra 8.
- `aria-pressed` acompanha os dois modos; teclado alterna com `Enter`.
- Preferência sobrevive ao reload.

### T5 — Undo da trava e proteção do “Descongelar tudo” (U3, U7)

**O que fazer**

1. O snapshot de edição passa a carregar `frozen`: `cloneMosaicCellsSnapshot` devolve também as
   entradas de `frozenCells` (array de pares), e `restoreMosaicCellsSnapshot` as restaura.
2. `pushEditHistorySnapshot()` continua igual; `performFreeze` passa a chamar
   `pushEditHistorySnapshot()` **uma vez por gesto** (no mousedown, não a cada célula do arrasto).
3. `#btnClearFrozen` → confirmação simples (`confirm` nativo é aceitável) **ou** toast com
   “Desfazer” por 5 s. Escolha uma e registre.

**Aceite**

- Travar 4 células → `Ctrl+Z` remove as 4 de uma vez; `Ctrl+Y` devolve.
- “Descongelar tudo” com 16 travas: pede confirmação (ou oferece desfazer) e o resultado é
  reversível.
- O undo de uma pincelada normal continua funcionando (não misturar as pilhas).

### T6 — Ícone, cursor, textos e contratos (U6, U7)

**O que fazer**

1. **Floco de neve** no botão do rail, na linha de status e no popover. SVG sugerido (24×24, herda
   `currentColor`):

```html
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <line x1="2" y1="12" x2="22" y2="12"></line>
  <line x1="12" y1="2" x2="12" y2="22"></line>
  <path d="m20 16-4-4 4-4"></path>
  <path d="m4 8 4 4-4 4"></path>
  <path d="m16 4-4 4-4-4"></path>
  <path d="m8 20 4-4 4 4"></path>
</svg>
```

   Marque o botão com `data-icon="snowflake"` para o teste de contrato. Os cadeados de
   **travar proporção** do artboard e da grade (`index.html:51`, `:86`) continuam cadeado.
2. **Overlay:** abaixo de ~10 px de célula, mantenha só a lavagem + borda e **não desenhe glifo**;
   acima disso, o micro-cadeado (`mosaic_engine.js:493-498`) vira um asterisco de 6 traços.
3. **Cursor:** `body[data-active-tool="freeze"] #canvas-stage canvas { cursor: cell; }`.
4. **`Alt+Clique`:** remova do tooltip e do popover. Se preferir mantê-lo, restrinja o ramo de
   captura (`sketch.js:1748`) a `paint | stamp | inspect` — nunca deixe anunciado e inalcançável.
5. **Popover `freeze`:** reescreva para descrever o comportamento real (modo, tamanho, escopo, undo)
   e só afirme “ficam imunes à geração” depois de T1 estar verde.
6. **Testes:**
   - `tests/test_freeze_ui_contract.js`: `[data-tool="freeze"]` único; `data-icon="snowflake"`;
     `#freezeToolOptionsWrap` existe e respeita `.hidden`; `#freezeHelpText` ausente;
     `#btnClearFrozen` presente em `#freezeStatusRow`; controles de modo/tamanho/escopo existem.
   - `tests/test_freeze_state.js`: `freezeMode`, `freezeSize`, `freezeUseScope` serializam e
     restauram sem subir `STORAGE_VERSION`.

**Aceite**

- O botão do rail e a linha de status mostram floco; nenhum cadeado no fluxo de congelamento.
- Cursor muda ao ativar a ferramenta e volta a `default` fora do canvas.
- `node tests/run_all.js` passa com **24 suítes** (21 + as 3 novas de T1/T2/T6 — a de wiring entra
  junto de T1).

---

## 4. Por que extrair para `core/`

Três dos defeitos existem porque a lógica está presa em `sketch.js`, que nenhum teste alcança:
`regenerateMosaic`, `restoreGenerationHistory` e o handler de pintura. Os testes que “passaram” nos
últimos ciclos copiaram essa lógica para dentro do teste — e ficaram verdes com o produto quebrado.

Mover `applyFrozenCells`, `generateMosaicWithFrozen` e `planRestore` para `core/` não é elegância:
é o que permite o próximo teste falhar de verdade. O `sketch.js` fica só com a cola de DOM/estado.

---

## 5. Regras

- Não renomeie ids existentes; `#btnToggleFreezeTool` é **removido**, não renomeado.
- `STORAGE_VERSION` continua 3 (campos novos são aditivos).
- Não toque em `core/tile_registry.js`, no motor D4, no catálogo ou no layout das quatro superfícies.
- Não mexa em `docs/instrucoes/` antigos nem em `docs/relatorios/`.
- Um commit por tarefa (T1…T6), com a mensagem no padrão do repositório.
- Nenhuma dependência nova.

---

## 6. Roteiro de validação

Servidor local, storage limpo, 1440×900.

**A — Trava sobrevive.** Travar 4 células (modo Congelar, 2×2, escopo desligado); Gerar 3× (G);
conferir que as 4 continuam e as demais mudam; recarregar; conferir de novo.

**B — Gesto monotônico.** No modo Congelar, clicar 3× na mesma célula: continua travada, contador
não muda. No modo Descongelar, clicar numa célula livre: nada acontece.

**C — Escopo.** Ligar escopo no padrão Centro, travar 1 célula: contador marca 8. Desligar, travar 1:
contador sobe 1.

**D — Undo.** Travar 4; `Ctrl+Z` remove as 4; `Ctrl+Y` devolve. “Descongelar tudo” pede confirmação.

**E — Histórico.** Editar 3 células; ◀ duas vezes; ▶ duas vezes: as 3 estão lá; `Ctrl+Z` funciona.

**F — UI.** Nenhum segundo botão de trava no painel; nenhum parágrafo fixo; floco no rail e na linha
de status; cursor de célula no canvas.

---

## 7. Critérios de aceite finais

- [ ] F1: congelamento sobrevive a 3 gerações e a reload.
- [ ] F2: travar grava no storage no mesmo gesto.
- [ ] F3: navegar no histórico preserva a edição e o undo.
- [ ] F4: entradas editadas guardam snapshot (e o orçamento é respeitado com aviso).
- [ ] U1: um único seletor de ferramenta (`[data-tool="freeze"]` = 1).
- [ ] U2: nenhum texto explicativo permanente no painel.
- [ ] U3/U4: modo explícito + tamanho 1×1…Bloco funcionando.
- [ ] U5: escopo visível e desligável.
- [ ] U6: `Alt+Clique` funciona ou desapareceu do texto.
- [ ] U7: floco no rail e na linha de status; cursor `cell`.
- [ ] 24 suítes verdes; cada teste novo falhou no baseline (saída colada).

---

## 8. Formato da resposta final

1. **Tabela**: tarefa → status (`feito` / `não feito` / `feito com ressalva`).
2. **Prova**: teste novo → saída no baseline (falha) → saída no HEAD (passa).
3. **Medições**: contador de travas em cada cenário do roteiro.
4. **Capturas**: trava ativa no rail, opções do Editor com o modo Congelar, linha de status no
   Gerador, e uma captura de antes/depois do overlay. **Hashes distintos** — a regra da Rodada 4
   continua valendo.
5. **`git diff --stat`**.

---

## 9. O que não fazer

- Não resolver F1 espalhando o laço de restauração em cada chamador de `regenerateMosaic` — o ponto
  único é `generateMosaicWithFrozen`.
- Não “consertar” F3 com `confirm()` a cada seta do histórico; o snapshot resolve o caso comum.
- Não manter o toggle por clique “porque já funcionava”: ele é a causa do destravamento acidental.
- Não colocar os controles de tamanho no painel do Gerador.
- Não duplicar o botão da ferramenta “para facilitar”.
- Não deixar o texto prometendo o que o código ainda não faz.
- Não testar a lógica copiada dentro do teste — é o que produziu os dois P0.

---

## 10. Critério de escalação

Se o snapshot por entrada estourar o orçamento do storage em grades grandes (16×16, subdivisão 4), não
descarte em silêncio: reporte a medição de bytes, a política aplicada e duas opções (reduzir o teto de
entradas editadas, ou manter só o snapshot mais recente por sessão). Um limite declarado é melhor que
uma perda invisível.

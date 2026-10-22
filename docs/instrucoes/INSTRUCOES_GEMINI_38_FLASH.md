# Instruções de Correção — Tiling Stripes Studio

**Destinatário:** Gemini 3.8 Flash, atuando como agente de implementação no Antigravity  
**Repositório:** `C:\Users\hipstershiba\Documents\Processing\sketches\tilling_stripes`  
**Branch de trabalho:** `develop`  
**Estado de referência:** commit `3b80068`  
**Objetivo desta rodada:** corrigir os defeitos de usabilidade do painel **Editor** e fechar os bugs críticos de persistência e de simetria D4, sem reescrever a aplicação.

Este documento é a especificação de trabalho. Ele não é uma sugestão de redesign. Execute as tarefas na ordem indicada, com mudanças pequenas, testes e evidências. Se algo for inviável, pare e reporte; não simule conclusão.

> **Instrução de abertura:** leia este arquivo inteiro antes de alterar qualquer coisa. Comece pela seção 2 (prioridade), execute T1 no browser e só depois avance. O objetivo principal desta rodada é o painel **Editor**; persistência e D4 são correções obrigatórias, não um redesign.

**Resumo das entregas:** 6 tarefas de usabilidade do Editor, 2 de persistência, 1 de correção matemática do D4, 1 de testes/docs. O detalhe de cada uma está nas seções 3 a 12; o roteiro de validação está na seção 14.

---

## 0. Contexto que você precisa saber

O projeto é uma aplicação vanilla JavaScript + p5.js, sem build e sem framework. O app é aberto diretamente pelo `index.html` (preferencialmente via servidor HTTP local).

Arquivos que importam para esta rodada:

- `index.html` — estrutura da UI, IDs e ordem dos scripts.
- `style.css` — layout e estados visuais.
- `sketch.js` — controlador principal, estado global, UI e interação.
- `core/d4_symmetry.js` — grupo D4, transforms e resolução de órbitas.
- `core/mosaic_engine.js` — geração, edição por escopo, render e snapshots.
- `core/tile_registry.js` — catálogo de 85 tiles, famílias e `TILE_D4_MAP`.
- `tests/*.js` — testes Node existentes.
- `_legacy/` — versão antiga. **Não edite `_legacy/`, `libraries/p5.min.js` nem `libraries/simple-svg.js`.**

Comandos úteis:

```powershell
python -m http.server 8765
# abra http://127.0.0.1:8765

node tests/test_tile_registry.js
node tests/test_mosaic_engine.js
node tests/test_state_persistence.js
```

O app é desktop-first. A UI é em português; mantenha o idioma e o vocabulário existentes.

### Como trabalhar no Antigravity

1. Abra o repositório, leia este documento inteiro e faça um plano curto antes de editar.
2. Use o browser embutido do Antigravity para abrir `http://127.0.0.1:8765` e validar a UI de verdade. Não confie apenas em leitura de código.
3. Use o console do browser para fazer asserções objetivas, por exemplo:

```js
getComputedStyle(document.querySelector('#rotateToolOptionsWrap')).display
document.querySelectorAll('#editBrushPaletteContainer .brush-active').length
```

4. Tire screenshots do painel Editor em 1440×900 e 1280×800, nos três modos (Pincel, Girar, Clonar).
5. Se uma ferramenta do ambiente falhar, registre o erro e use a alternativa mais próxima (servidor local, outro browser). Não invente evidência.
6. Trabalhe em ciclos curtos: implemente uma tarefa, rode o teste correspondente, valide no browser e só então passe para a próxima.

---

## 1. Regras de trabalho

1. **Leia antes de editar.** Abra os arquivos e localize as funções/IDs citados. Não substitua blocos inteiros por uma reescrita.
2. **Mudanças pequenas e focadas.** Um commit por assunto: UI, persistência, D4, testes/docs.
3. **Preserve IDs, classes e funções existentes.** Se precisar de um novo elemento, adicione um ID novo; não renomeie os usados pelo JS.
4. **Não troque a stack.** Nada de React/Vue/Svelte, bundler ou dependência nova sem necessidade demonstrada.
5. **Não altere o catálogo de tiles nesta rodada.** Os IDs numéricos são usados em saves. Se for inevitável, incremente a versão do storage e migre/invalide com aviso.
6. **Não esconda erros com `try/catch` silencioso.** Todo fallback precisa de aviso visível ao usuário.
7. **Teste no navegador, não só no Node.** A maior parte dos bugs desta rodada é de UI.
8. **Não declare concluído sem evidência.** A resposta final deve listar comandos executados, resultados e screenshots.
9. **Não faça reformatação em massa.** O diff deve ser revisável.
10. **Se um requisito for ambíguo ou impossível, pare e pergunte.** Não invente uma solução que quebre outro fluxo.

### Definição de pronto

- Os testes Node existentes passam.
- Os novos testes de D4, histórico e persistência passam.
- A matriz de visibilidade do painel Editor passa em 1440×900 e 1280×800.
- Não há erros no console do navegador.
- A documentação descreve o app atual, não a versão antiga.
- O resumo final informa o que foi feito, o que foi testado e o que ficou pendente.

---

## 2. Prioridade e ordem de execução

**P0 — bloqueia a entrega:**

1. T1: corrigir a classe `.hidden` e a visibilidade contextual do painel Editor.
2. T2: dica contextual do escopo.
3. T3: estado visual da paleta de pincel.
4. T4: reset 0° do Supertile e ações contextuais.
5. T5: evitar comportamento silencioso do escopo “Iguais” com pincel maior que 1×1.
6. T7: corrigir índices/caps dos históricos.
7. T8: quota do localStorage, fallback e aviso.
8. T9: corrigir a simetria D4 no motor e no editor.

**P1 — deve entrar na mesma rodada se possível:**

9. T6: cursores, foco visível e feedback de ferramenta.
10. T10: testes automatizados, CI, README e manual.

**P2 — se sobrar tempo:**

11. Limpeza de código morto e pequenos polimentos.

Se o tempo acabar, **não corte T1–T5 nem T7–T9** para fazer T6/T10. Entregue o P0 funcionando e reporte o restante.

---

## 3. T1 — Corrigir `.hidden` e a visibilidade contextual do Editor

### Problema atual

O CSS tem regras específicas para alguns `.hidden`, mas **não tem uma regra genérica**:

- `.prop-section.hidden` não existe.
- `.canvas-center-sym-wrap.hidden` não existe.
- `.stamp-mode-banner.hidden` não existe.

O HTML usa essas classes em:

- `#rotateToolOptionsWrap` (`class="prop-section hidden"`).
- `#stampModeSection` (`class="prop-section stamp-mode-banner hidden"`).
- `#canvasCenterSymmetryWrap` (o JS alterna `hidden`).

O JS alterna `hidden` em `syncEditWorkspaceUI`, mas o navegador ignora a classe. Resultado: opções de rotação aparecem no modo pincel, a barra de captura/colagem aparece fora do modo clone e o seletor de simetria do centro aparece em todos os escopos.

### O que fazer

1. Adicione uma regra genérica no topo do `style.css`, depois do reset:

```css
.hidden {
  display: none !important;
}
```

2. Mantenha as regras específicas existentes; elas podem ficar redundantes.
3. Revise `syncEditWorkspaceUI` e garanta a matriz abaixo. A lógica já existe em grande parte; o problema principal é o CSS, mas confira cada `classList.toggle('hidden', ...)`.
4. Não use `visibility:hidden` nem `opacity:0`: o elemento deve sair do layout.

### Matriz de visibilidade obrigatória

| Contexto | `#rotateToolOptionsWrap` | `#stampModeSection` | `#canvasCenterSymmetryWrap` | `#panel-edit-brush` |
|---|---|---|---|---|
| Ferramenta Pincel | oculto | oculto | visível só se escopo = Centro | visível |
| Ferramenta Girar | visível | oculto | visível só se escopo = Centro | oculto |
| Ferramenta Clonar | oculto | visível | visível só se escopo = Centro | visível |
| Escopo diferente de Centro | — | — | oculto | — |

### Aceite

- Em `Editor → Pincel`, `getComputedStyle(document.querySelector('#rotateToolOptionsWrap')).display === 'none'`.
- Em `Editor → Girar`, `#panel-edit-brush` tem `display:none` e `#rotateToolOptionsWrap` tem `display:flex`.
- Em `Editor → Clonar`, `#stampModeSection` tem `display:flex`, e `#rotateToolOptionsWrap` tem `display:none`.
- Ao alternar o escopo para Órbita/Bloco/Todos/Livre/Iguais, `#canvasCenterSymmetryWrap` fica oculto; ao voltar para Centro, reaparece.
- Ao alternar ferramenta por botão e por atalho (`B`, `R`, `S`), a matriz se mantém.
- Nenhum outro elemento com `.hidden` some por engano. Verifique `#nonSquareGridNotice`, `#seedHistoryPopover`, `#dock-workspace-edit` e `#supertileBuilderActions`.

---

## 4. T2 — Dica contextual do escopo

### Problema atual

Os seis cartões de escopo mostram apenas ícone e nome curto (“Centro”, “Órbita”, “Bloco”, “Todos”, “Livre”, “Iguais”). A explicação existe em `EDIT_SCOPES` (`name`, `description`), mas só aparece em `title` (tooltip). O usuário não sabe o que o escopo faz sem passar o mouse e esperar.

### O que fazer

1. Em `index.html`, logo após `#editScopeGrid`, adicione:

```html
<p id="editScopeHint" class="edit-scope-hint" aria-live="polite"></p>
```

2. Em `style.css`, adicione uma regra compacta:

```css
.edit-scope-hint {
  min-height: 30px;
  max-height: 46px;
  overflow-y: auto;
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1.35;
}
```

3. Em `sketch.js`, dentro de `syncEditWorkspaceUI`, atualize o texto:

```js
const scope = window.MosaicEngine.EDIT_SCOPES[StudioState.editScope];
const hintEl = document.getElementById('editScopeHint');
if (hintEl) {
  hintEl.textContent = scope
    ? `${scope.name} — ${scope.description}`
    : '';
}
```

4. Atualize a dica também ao trocar escopo por clique e por atalho `1`–`6`. Como ambos chamam `syncEditWorkspaceUI`, isso deve acontecer naturalmente; confirme.
5. Não remova o `title` dos cartões; ele continua útil.

### Aceite

- Cada um dos seis escopos exibe uma frase diferente, correspondente ao `description` de `EDIT_SCOPES`.
- A dica não muda de altura a cada troca (sem “pulo” de layout).
- A dica é legível em 350 px de largura, com no máximo 3 linhas e rolagem interna se necessário.
- Funciona por clique e por teclado.

---

## 5. T3 — Corrigir o estado visual da paleta de pincel

### Problema atual

Em `renderEditBrushPalette` (`sketch.js`), todos os tiles que não são o ativo recebem a classe `selected`:

```js
swatch.className = 'tile-swatch-btn' + (isBrushActive ? ' brush-active' : ' selected');
```

Como `.tile-swatch-btn.selected` tem borda azul e imagem opaca, a paleta inteira parece selecionada. O usuário não distingue o pincel ativo.

### O que fazer

1. Troque a classe dos não ativos para `available` (ou nenhuma classe adicional):

```js
swatch.className = 'tile-swatch-btn' + (isBrushActive ? ' brush-active' : ' available');
```

2. Adicione, se necessário, um estado neutro:

```css
.tile-swatch-btn.available {
  border-color: #2e3138;
  background: #121316;
}
```

3. Remova o `img.style.opacity = '0.72'` dos não ativos, ou deixe a opacidade no CSS. O importante é que **apenas um** swatch tenha `brush-active`.
4. Ao renderizar a paleta, faça o swatch ativo entrar na área visível:

```js
requestAnimationFrame(() => {
  const active = container.querySelector('.tile-swatch-btn.brush-active');
  if (active) active.scrollIntoView({ block: 'nearest' });
});
```

5. Adicione `aria-pressed="true/false"` ao botão do swatch, se não houver custo.

### Aceite

- `document.querySelectorAll('#editBrushPaletteContainer .brush-active').length === 1`.
- `document.querySelectorAll('#editBrushPaletteContainer .selected').length === 0`.
- O tile ativo tem borda ciano; os demais têm borda neutra e opacidade menor, mas continuam clicáveis.
- Ao trocar de tile, a seleção muda de lugar e o novo ativo fica visível na área de rolagem.
- A paleta de “Allowed Tiles” do Gerador não é afetada; ela usa `.selected` de propósito.

---

## 6. T4 — Reset 0° do Supertile e ações contextuais

### Problema atual

`btnBrushResetD4` (`sketch.js`) só recria o padrão quando ele é 1×1:

```js
if (pat.rows === 1 && pat.cols === 1) {
  StudioState.supertilePattern = createSupertilePattern(...);
}
```

Em um Supertile 2×2/3×3/4×4, o botão “0°” só muda `editBrushTransform`; as células continuam orientadas. Parece um no-op.

### O que fazer

1. Crie uma função `resetActiveBrushOrientation()`:

```js
function resetActiveBrushOrientation() {
  const pat = ensureSupertilePattern();
  for (const row of pat.cells) {
    for (const cell of row) {
      cell.transform = 'id';
      cell.tileId = cell.baseTileId;
    }
  }
  StudioState.editBrushTransform = 'id';
  StudioState.stampBlock = pat;
  renderSupertileBuilderCanvas();
  syncEditWorkspaceUI();
  saveStudioStateToStorage();
  redraw();
}
```

2. Faça `btnBrushResetD4` chamar essa função.
3. Para 1×1, o resultado deve ser idêntico ao atual.
4. Confirme que “Preencher” (`btnSupertileFillAll`) e “Simetria” (`btnSupertileSymmetrize`) continuam funcionando.
5. Ajuste a visibilidade de `#supertileBuilderActions`: deve aparecer quando o padrão tem mais de 1×1 ou quando a ferramenta é Clonar; não deve aparecer no modo Girar (o painel inteiro já fica oculto).

### Aceite

- Com um padrão 2×2, clicar “0°” faz todas as células voltarem a `transform === 'id'` e `tileId === baseTileId`.
- O rótulo `#activeBrushD4Label` mostra `0°`.
- O preview do builder mostra todas as células na orientação original.
- O botão “0°” não altera o conteúdo (base tile) das células; apenas a orientação.
- O botão continua funcionando em 1×1.

---

## 7. T5 — Evitar fallback silencioso no escopo “Iguais”

### Problema atual

Em `resolveStampRegionPlacements` (`core/mosaic_engine.js`), o escopo `same_tile` só faz a substituição global quando `anchorCells.length === 1`:

```js
if (scopeMode === 'same_tile') {
  if (anchorCells.length === 1) { /* ... */ }
  for (const ac of anchorCells) { putPlacement(...); }
}
```

Com pincel 2×2 ou maior, o código pinta apenas a âncora e ignora o resto, sem aviso. O usuário acha que o escopo está quebrado.

### O que fazer

Escolha **uma** das opções, nesta ordem de preferência:

**Opção A — implementar de verdade (preferida):**
- Para cada célula do padrão, encontre todas as células do mosaico com o mesmo `tileId` da célula correspondente e aplique o padrão com a transformação adequada.
- Documente a semântica: “Iguais” com Supertile significa “substituir todas as ocorrências de cada tile do padrão”.

**Opção B — bloquear com aviso claro (aceitável para esta rodada):**
- Adicione `#sameTileNotice` no painel Editor.
- Quando `editScope === 'same_tile'` e o padrão for maior que 1×1, mostre:
  “O escopo Iguais compara 1×1. Reduza o pincel para 1×1 ou use Outro escopo.”
- Em `performBrushOrStampAtHit`, se a combinação for inválida, não altere o mosaico e mostre um toast/aviso. Não pinte apenas a âncora silenciosamente.
- Faça o bloqueio **antes** de ativar `isPaintingDrag` em `handleCanvasMouseDown` e em `mouseDragged`; não basta retornar `false` depois de iniciar o arrasto.
- Ao trocar para 1×1, o aviso desaparece e o escopo volta a funcionar.

### Componente de aviso reutilizável (se ainda não existir)

Para não criar alertas inconsistentes em T5, T8 e T9, crie um único componente:

```html
<div id="editorToast" class="editor-toast hidden" role="status" aria-live="polite"></div>
```

```js
let toastTimer = null;
function showEditorToast(message, type = 'info') {
  const el = document.getElementById('editorToast');
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 4200);
}
```

CSS mínimo: posição fixa acima da status bar, fundo escuro, borda âmbar para `type="warn"`, sem bloquear cliques (`pointer-events:none`). O toast não substitui o `#persistenceWarning` persistente; ele é para avisos curtos de interação.

### Aceite

- Com escopo Iguais e pincel 1×1, o comportamento atual (substituir todos os tiles iguais) continua.
- Com pincel 2×2, ou o padrão é aplicado de forma coerente, ou o usuário recebe um aviso explícito e nada é alterado.
- Não existe caminho em que o app pinte só a âncora sem explicar.
- O aviso é acessível (`aria-live="polite"` ou equivalente).

---

## 8. T6 — Cursores, foco visível e feedback de ferramenta

### Problema atual

O canvas não muda de cursor conforme a ferramenta; `setActiveTool` só alterna a classe `panning` do pasteboard. Também há `outline:none` em vários controles e o `Tab` global é capturado, o que prejudica navegação por teclado.

### O que fazer

1. Em `setActiveTool` e no setup, defina:

```js
document.body.dataset.activeTool = StudioState.activeTool;
```

2. Adicione CSS:

```css
body[data-active-tool="paint"] #canvas-stage canvas { cursor: crosshair; }
body[data-active-tool="rotate"] #canvas-stage canvas { cursor: alias; }
body[data-active-tool="stamp"] #canvas-stage canvas { cursor: copy; }
body[data-active-tool="inspect"] #canvas-stage canvas { cursor: default; }
body[data-active-tool="pan"] #canvas-stage canvas { cursor: grab; }
body[data-active-tool="zoom"] #canvas-stage canvas { cursor: zoom-in; }
```

3. Para o modo Clonar, diferencie captura e aplicação:
   - `select` → `crosshair`.
   - `apply` → `copy`.
   Use `document.body.dataset.stampMode` ou uma classe.

4. Adicione foco visível sem quebrar o tema:

```css
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 1px;
}
```

5. Não remova o atalho `Tab` sem substituí-lo; se mantiver o toggle do dock, garanta que ele não dispare quando o foco estiver em um botão/input. No mínimo, não bloqueie a ativação de botão por `Space`:

```js
const tag = e.target?.tagName;
if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
```

### Aceite

- O cursor muda ao alternar Pincel/Girar/Clonar/Inspecionar/Pan/Zoom.
- Em Clonar, o cursor muda entre captura e aplicação.
- É possível navegar por Tab e ver o foco nos controles principais.
- `Space` com um botão focado ativa o botão, não inicia pan.
- Os atalhos `B`, `R`, `S`, `V`, `H`, `Z` continuam funcionando quando o foco não está em um campo de texto.

---

## 9. T7 — Corrigir índices e limites dos históricos

### Problema atual

Em `saveStudioStateToStorage`:

```js
history: StudioState.history.slice(-30),
historyIndex: StudioState.historyIndex,
editHistory: StudioState.editHistory.slice(-25),
editHistoryIndex: StudioState.editHistoryIndex
```

Os arrays são cortados, mas os índices não são ajustados. Na leitura, `historyIndex` é usado sem clamp e `editHistoryIndex` é limitado a `length - 1`, apontando para o snapshot errado.

### O que fazer

A forma mais simples e segura é **alinhar o limite no momento do push**, não no save:

1. Defina constantes únicas:

```js
const MAX_GENERATION_HISTORY = 30;
const MAX_EDIT_HISTORY = 25;
```

2. Em `pushGenerationHistory`, depois de adicionar:

```js
while (StudioState.history.length > MAX_GENERATION_HISTORY) {
  StudioState.history.shift();
}
StudioState.historyIndex = StudioState.history.length - 1;
```

3. Em `pushEditHistorySnapshot`, faça o mesmo com `MAX_EDIT_HISTORY`; como o snapshot recém-adicionado é sempre o atual, o índice deve ser o último.
4. No save, não fatie de novo: salve os arrays completos e os índices já válidos.
5. No load, valide:

```js
if (StudioState.history.length > 0) {
  StudioState.historyIndex = Math.max(
    0,
    Math.min(StudioState.history.length - 1, saved.historyIndex ?? StudioState.history.length - 1)
  );
} else {
  StudioState.historyIndex = -1;
}
```

Faça o equivalente para `editHistoryIndex`.

6. **Migre payloads antigos, não apenas os novos.** Se o array carregado tiver mais itens que o novo limite, remova os mais antigos e subtraia a quantidade removida do índice. Se o índice original apontar para um item removido, use o snapshot mais próximo disponível e mostre um aviso; nunca aponte silenciosamente para o último snapshot.
7. Ao restaurar um snapshot, valide `rows`, `cols` e `subtilesPerSide` antes de aplicar; se não bater, ignore e avise.
8. Atualize o label `editHistoryStepLabel` para refletir o índice real.

### Aceite

- Depois de 40 edições e 10 undos, recarregar mantém o estado atual e o undo/redo coerentes.
- Depois de 40 gerações, recarregar mantém os botões anterior/próximo funcionando.
- Nunca existe índice fora de `[0, length - 1]` quando o array não está vazio.
- O teste de persistência cobre esse cenário, não apenas uma célula.

---

## 10. T8 — Quota do localStorage, fallback e aviso

### Problema atual

O payload pode chegar a dezenas de MB em grades grandes. O `setItem` lança `QuotaExceededError`, o `catch` só faz `console.warn`, e o usuário continua achando que está salvo. Além disso, o save ocorre a cada traço.

### O que fazer

1. Crie um aviso persistente na UI, por exemplo no rodapé ou no topo do dock:

```html
<div id="persistenceWarning" class="persistence-warning hidden" role="alert">
  Não foi possível salvar automaticamente. Exporte seu trabalho ou reduza a grade/histórico.
</div>
```

2. Em `saveStudioStateToStorage`, trate a falha:

```js
try {
  localStorage.setItem(STORAGE_KEY_STUDIO_STATE, JSON.stringify(payload));
  hidePersistenceWarning();
} catch (err) {
  if (isQuotaError(err)) {
    // 1. tente um payload mínimo: estado atual + configuração, sem históricos
    // 2. se ainda falhar, mostre o aviso e mantenha o estado em memória
    showPersistenceWarning();
  } else {
    showPersistenceWarning();
    console.warn(err);
  }
}
```

3. Implemente o fallback mínimo:
   - Primeira tentativa: payload completo.
   - Segunda: apenas `cellsSnapshot`, configuração, seed, allowedTiles e ferramenta; sem `history`/`editHistory`.
   - Terceira: não grava; mostra o aviso.
4. Reduza o custo:
   - Faça o save em debounce (por exemplo 250 ms) durante edições.
   - Faça save imediato no `beforeunload` e ao trocar de ferramenta/escopo.
   - Limite o histórico por bytes, não só por quantidade: calcule o tamanho de um snapshot e reduza `MAX_EDIT_HISTORY` dinamicamente para caber em ~3,5 MB.
5. Não apague o estado em memória quando o save falhar.
6. Se o payload antigo não for compatível com o catálogo atual, **não restaure silenciosamente**. Incremente a chave/versão do storage e mostre um aviso; opcionalmente guarde o payload antigo em uma chave de backup.

### Aceite

- Com `localStorage.setItem` forçado a lançar quota, o app mostra o aviso e continua funcional.
- O fallback mínimo salva o desenho atual e a configuração; após reload, o desenho volta.
- Com uma grade 16×16/subdivisão 4, o app não tenta gravar 18 MB a cada traço; o histórico é reduzido ou o aviso aparece.
- O aviso desaparece quando um save posterior funciona.
- O teste automatizado cobre quota; não confie só no teste manual.

---

## 11. T9 — Corrigir a simetria D4 (motor e editor)

### Problema atual

O modo “Mandala (D4)” não garante invariância D4. Em um bloco 4×4 com o tile #2, a célula `(0,0)` é fixa por `md`; `md(#2) = #4`, mas o bloco grava `#2`. O resultado é apenas D2: passam `id`, `mx`, `my` e `r180`; falham `r90`, `r270`, `md` e `mad` em 8 das 16 células.

A causa é escolher uma única transformação representante por célula sem verificar o estabilizador da célula-fonte. Quando duas transformações chegam ao mesmo alvo, a orientação fica inconsistente.

### O que fazer

**Preferência: manter o modo D4 e corrigir a matemática.**

1. Crie um helper para o estabilizador de uma célula:

```js
function getCellStabilizer(row, col, rows, cols, symmetryMode) {
  const transforms = getAllowedTransformsForSymmetry(symmetryMode, rows, cols);
  return transforms.filter((g) => {
    const [r, c] = transformGridCoords(row, col, rows, cols, g);
    return r === row && c === col;
  });
}
```

2. Crie um helper de compatibilidade:

```js
function isTileInvariantUnder(tileId, g) {
  return getTransformedTileId(tileId, g) === tileId;
}

function getCompatibleTiles(allowedTiles, stabilizer) {
  return allowedTiles.filter((tileId) =>
    stabilizer.every((g) => isTileInvariantUnder(tileId, g))
  );
}
```

3. Em `generateSourceBlock`, ao escolher o tile de uma célula canônica:
   - calcule o estabilizador da célula;
   - filtre `allowedTiles` para os tiles invariantes sob todas as transformações do estabilizador;
   - sorteie apenas entre os compatíveis;
   - se a lista ficar vazia, use um fallback claramente definido (por exemplo, um tile totalmente simétrico como #6, #37, #54, #79, #80, #81 ou #84) e registre um aviso; não sorteie um tile incompatível.
4. Com essa garantia, a escolha de uma transformação representante por alvo deixa de ser ambígua: duas transformações que chegam ao mesmo alvo diferem por um elemento do estabilizador e produzem o mesmo tile.
5. No editor, ao pintar em um escopo que promete D4:
   - calcule o estabilizador da célula-alvo;
   - se o tile do pincel não for invariante, **não aplique silenciosamente**;
   - mostre um aviso: “Este tile não é invariante no eixo. Escolha um tile simétrico ou use o escopo Livre.”
   - Alternativa aceitável: substituir por um tile compatível, mas avise.
6. Para os escopos `single` e `same_tile`, a restrição pode ser relaxada; eles são explicitamente “livres” ou “substituição”, não prometem D4.
7. Adicione um teste de invariância:

```js
const allTiles = Array.from({ length: TILE_RENDERERS.length }, (_, i) => i);
const tileSets = [[2], [2, 7, 13, 44, 75], allTiles];
const cellAt = (mosaic, r, c, N) =>
  mosaic.grid[Math.floor(r / N)][Math.floor(c / N)].cells[r % N][c % N];

for (const mode of ['mandala_d4', 'rotational_c4', 'bilateral_d2']) {
  for (const n of [1, 2, 3, 4, 5]) {
    const N = n * 2;
    const R = n * N;
    const C = n * N;
    const transforms = getAllowedTransformsForSymmetry(mode, R, C);
    for (const allowedTiles of tileSets) {
      for (const seed of [1, 7, 42, 9999]) {
        const mosaic = generateMosaic(
          {
            rows: n,
            cols: n,
            subdivision: 2,
            gridSymmetryMode: mode,
            blockSymmetryMode: mode,
            syncBlockSymmetry: true,
            allowedTiles,
            seed
          },
          (arr) => arr[(seed + arr.length) % arr.length]
        );
        for (const g of transforms) {
          for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
              const [tr, tc] = transformGridCoords(r, c, R, C, g);
              const src = cellAt(mosaic, r, c, N);
              const dst = cellAt(mosaic, tr, tc, N);
              assert.strictEqual(
                dst.tileId,
                getTransformedTileId(src.tileId, g),
                `${mode} ${n} seed ${seed} ${g} (${r},${c})`
              );
            }
          }
        }
      }
    }
  }
}
```

8. O teste deve **falhar no código atual** e passar depois da correção. Não ajuste o teste para aceitar o comportamento errado.

**Alternativa honesta, se a correção completa for inviável nesta rodada:**

- Renomeie o modo para “Bilateral (D2)”, remova as promessas de “8 eixos” da UI/README e adicione um aviso de que D4 ainda não está disponível.
- Não mantenha o rótulo D4 com um resultado D2. Isso é pior do que assumir a limitação.

### Aceite

- O teste de invariância passa para todos os modos, grades e seeds testados.
- O bloco 1×1/4×4 com tile #2 deixa de ser usado como exemplo de D4 válido; se o gerador escolher #2 em uma célula fixa, ele deve rejeitar/trocar ou o modo não deve se chamar D4.
- O editor não permite que uma pintura quebre D4 sem aviso.
- Se a alternativa B for escolhida, a UI e a documentação não prometem mais D4.

---

## 12. T10 — Testes, CI e documentação

### 12.1 Testes

Adicione, no mínimo:

- `tests/test_d4_invariance.js` — o teste da seção T9.
- `tests/test_history_limits.js` — testa o helper de trim/índice (extraia a lógica pura para `core/history.js` ou equivalente, se necessário).
- `tests/test_persistence_quota.js` — simula `localStorage.setItem` lançando quota e verifica fallback/aviso (pode ser Node com mocks; isole a lógica de storage).
- `tests/test_editor_ui_state.js` — se houver browser automation no Antigravity, teste a matriz de visibilidade; se não houver, faça um teste estático que leia `style.css` e `index.html` e verifique que cada classe `hidden` usada no HTML tem regra CSS correspondente.

Atualize `tests/test_state_persistence.js` para:

- usar as funções reais de save/load, com mocks de DOM/localStorage;
- testar múltiplas células;
- testar undo/redo após reload;
- testar índice após corte de histórico;
- não declarar “100% restored” com uma única célula.

### 12.2 CI

Adicione um workflow `.github/workflows/tests.yml` que rode, em cada push/PR:

```yaml
- run: node tests/test_tile_registry.js
- run: node tests/test_mosaic_engine.js
- run: node tests/test_state_persistence.js
- run: node tests/test_d4_invariance.js
- run: node tests/test_history_limits.js
```

Sem dependências externas, se possível. Não substitua o workflow de deploy; adicione outro.

### 12.3 Documentação

Reescreva `README.md` e `MANUAL_MANUTENCAO.md` para o app atual:

- arquitetura em `core/` (`d4_symmetry.js`, `tile_registry.js`, `mosaic_engine.js`);
- escopos reais: Centro, Órbita, Bloco, Todos, Livre, Iguais;
- ferramentas reais: Pincel, Girar, Clonar;
- persistência em localStorage, com limitações e aviso de quota;
- como rodar os testes;
- como rodar localmente;
- **remova** as seções de Assets/upload/backup que não existem no app atual, ou mova para “Legacy”;
- corrija links quebrados (`tile_registry.js` na raiz, `svg_tile_manager.js`, `tile_transforms.js` etc.);
- remova a frase “não há testes automatizados”, que é falsa.

Atualize também o `README` para não prometer “fullscreen”, “Assets” ou “backup” se não existirem.

### Aceite

- `node tests/...` passa localmente.
- O CI roda os testes em push/PR.
- O README não menciona arquivos/recursos inexistentes.
- O manual descreve a arquitetura atual.
- Um novo contribuidor consegue rodar o app e os testes seguindo apenas a documentação.

---

## 13. Limpeza de código morto (P2)

Depois que o P0 estiver estável:

- `resolveEditScopeTargets` e `applySubtileEdit` não são usados pelo app. Ou remova, ou una com a rota de stamp e documente o contrato. Não deixe duas implementações divergentes.
- `resolveStampBlockTargets` retorna `[]` sempre; remova ou implemente de verdade. Não mantenha um stub exportado como “backwards-compatible”.
- `stampTransform`, `getTransformedTileThumbDataURL` e `transformedThumbCache` não são usados; remova se não forem necessários.
- Corrija o `sourceSubtile` em `transformBlock` para refletir a coordenada transformada, ou remova o campo se não for usado.
- Não faça essa limpeza antes dos testes de D4/histórico, para não misturar refatoração com correção.

---

## 14. Roteiro de teste manual no navegador

Use o navegador do Antigravity (ou Edge/Chrome via servidor local). Teste em **1440×900** e **1280×800**. Limpe o storage antes de cada cenário:

```js
window.clearStudioStorage();
location.reload();
```

### Cenário A — Matriz de painéis

1. Abra o app, vá para **Editor**.
2. Confirme Pincel: opções de giro ocultas, barra de clone oculta, brush visível.
3. Clique **Girar**: opções de giro visíveis, brush oculto, clone oculto.
4. Clique **Clonar**: barra de clone visível, opções de giro ocultas, brush visível.
5. Alterne o escopo para **Órbita**: seletor de centro oculto.
6. Volte para **Centro**: seletor de centro visível.
7. Repita usando os atalhos `B`, `R`, `S` e `1`–`6`.

### Cenário B — Dica e paleta

1. Passe pelos seis escopos e confirme que a dica textual muda.
2. Abra a paleta de pincel e confirme que só um tile tem borda ciano.
3. Troque de tile e confirme que o novo ativo fica visível.
4. Verifique no console:

```js
document.querySelectorAll('#editBrushPaletteContainer .brush-active').length // 1
document.querySelectorAll('#editBrushPaletteContainer .selected').length     // 0
```

### Cenário C — Supertile

1. Selecione 2×2.
2. Gire o pincel com o botão direito ou `]`.
3. Clique “0°” e confirme que todas as células voltam a `id`.
4. Verifique o preview do builder.

### Cenário D — Iguais

1. Escopo **Iguais**, pincel 1×1: pinte e confirme a substituição global.
2. Pincel 2×2: confirme aviso ou implementação correta; não aceite pintura silenciosa de uma única âncora.

### Cenário E — Persistência

1. Faça 30 edições.
2. Desfaça 10.
3. Recarregue.
4. Confirme que o estado atual é o do passo 2 e que undo/redo continuam coerentes.
5. Force quota no console (se possível) e confirme o aviso.
6. Recarregue e confirme que o fallback mínimo preservou o desenho.

### Cenário F — D4

1. Rode `node tests/test_d4_invariance.js`.
2. Confirme que o teste falha antes da correção e passa depois.
3. No app, use o escopo Centro com um tile assimétrico em célula fixa e confirme o aviso ou a substituição compatível.
4. Exporte PNG/SVG e confirme que não há erro no console.

### Cenário G — Responsividade básica

1. Em 1280×800, confirme que o painel direito não corta controles e que a paleta tem rolagem.
2. Confirme que não há rolagem horizontal dentro do painel.
3. Se a barra superior rolar horizontalmente, registre como problema separado; não esconda controles sem necessidade.

---

## 15. Critérios de aceite finais

Marque apenas o que realmente verificou:

- [ ] `.hidden` funciona globalmente; os três painéis contextuais obedecem à matriz.
- [ ] Dica de escopo existe e muda nos seis escopos.
- [ ] Paleta tem exatamente um `brush-active` e nenhum `selected` indevido.
- [ ] “0°” reseta todas as células de um Supertile multi-célula.
- [ ] “Iguais” com pincel >1 não pinta silenciosamente uma única âncora.
- [ ] Cursores/foco visível implementados sem quebrar atalhos.
- [ ] Históricos têm índices válidos após corte e reload.
- [ ] Quota tem fallback e aviso visível.
- [ ] Teste de invariância D4 passa; UI não promete D4 se o motor não entrega.
- [ ] Testes antigos e novos passam; CI executa testes.
- [ ] README/MANUAL descrevem o app atual.
- [ ] Nenhum erro no console; screenshots de 1440×900 e 1280×800.

---

## 16. Formato da resposta final do agente

Responda em português, de forma objetiva, com:

1. **Resumo** do que foi corrigido.
2. **Arquivos alterados** (lista).
3. **Testes executados** (comando + resultado).
4. **Evidências visuais** (caminhos das screenshots ou descrição do que foi verificado).
5. **Pendências** e riscos, se houver.
6. **`git diff --stat`** resumido.

Não escreva “está tudo funcionando” sem os itens acima. Se um P0 não foi concluído, diga explicitamente: “não está pronto para release”.

---

## 17. O que não fazer

- Não reescrever o app em framework.
- Não trocar o sistema de tiles/IDs.
- Não apagar `_legacy/` nem `libraries/`.
- Não “consertar” D4 apenas mudando o texto da UI.
- Não esconder falha de quota com `console.warn`.
- Não adicionar `.hidden` com `visibility`/`opacity` que ainda ocupe layout.
- Não remover o preview/ghost, os guias ou o undo/redo.
- Não alterar o visual global do tema; mantenha os tokens de `style.css`.
- Não commitar screenshots grandes em `gems/` ou `_legacy/`.

---

## 18. Critério de escalação

Se você encontrar um bloqueio real (por exemplo, a correção D4 exigir mudança de contrato que afete o produto), pare e reporte:

- o que tentou;
- o erro/comportamento observado;
- as opções com trade-offs;
- uma recomendação.

Não entregue uma meia-correção silenciosa. É melhor um P0 declaradamente pendente do que um app que parece pronto e quebra a simetria ou o save do usuário.

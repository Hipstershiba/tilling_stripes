# Análise Crítica — Tiling Stripes Studio (estado atual)

**Auditor:** DeepSeek v4.1 flash 1017  
**Data:** 22/10/2026  
**Repositório:** `d:\processing sketches\sketches2plot\tilling_stripes`  
**Branch:** `develop`  
**HEAD avaliado:** `255e5d0` — *style(ui): replace all emojis with crisp vector SVG icons*  
**Escopo:** aplicação inteira — motor D4, UI, editor, persistência, exportação, acessibilidade, desempenho, testes e documentação.

---

## 1. Veredito

O núcleo matemático e a linguagem visual do aplicativo são bons. O motor D4, o catálogo de 85 tiles, o editor por escopos e a organização em quatro zonas (documento no topo, ferramentas à esquerda, canvas no centro, painel contextual à direita) formam um produto coerente. As 35 suítes passam e a árvore está limpa.

O aplicativo **não está pronto para ser tratado como entrega confiável** por três motivos independentes:

1. **A proteção contra perda de edições é código morto.** O diálogo `#dirtyGuardDialog` existe, mas nenhum handler de parâmetro o abre e nenhum botão do diálogo tem listener. Na prática, nada mudou em relação ao estado anterior.
2. **A persistência “rica” em IndexedDB é sobrescrita pelo cache em localStorage a cada boot.** No fluxo normal o histórico de 256 gerações/100 edições é reduzido a 30/25; quando o localStorage entra em fallback mínimo, o histórico vai a zero. Há perda silenciosa de dados.
3. **A exportação não é adequada ao uso de plotter que o nome do projeto sugere:** o SVG sempre inclui um retângulo de fundo preenchido e não há opção de contorno, unidades físicas ou separação por camada/pen.

Além disso, o editor tem problemas sérios de acessibilidade (Tab sequestrado, modal sem focus trap, itens de histórico não focáveis, contraste insuficiente), o orçamento de snapshots é ignorado quando o IndexedDB existe, e a documentação descreve uma interface que não existe mais.

**Resumo por dimensão:**

| Dimensão | Estado |
|---|---|
| Motor D4 / catálogo / geração | **Bom** — determinístico, testado, 85 tiles |
| Layout 1280/1440 | **Bom** — quatro zonas, sem overflow visível nas capturas |
| Editor / ferramentas | **Bom, com atritos** — brush sizing, snap, eraser, freeze e escopos funcionam; alguns painéis são irrelevantes |
| Persistência | **Crítico** — IDB sobrescrito pelo localStorage; fallback apaga histórico |
| Segurança do documento | **Crítico** — dirty guard morto; undo com casos de borda |
| Exportação | **Parcial** — PNG/SVG existem; SVG não é plotter-friendly; sem unidades |
| Acessibilidade | **Frágil** — Tab, foco, ARIA de seleção, contraste, canvas sem nome |
| Desempenho em grade máxima | **Risco** — 65.536 células sem cache; payload de snapshots enorme |
| Testes | **Verdes, mas com cobertura enganosa** — testes estáticos/simulados escondem falhas |
| Documentação | **Desatualizada** — UI, atalhos, persistência e contagem de suítes errados |

---

## 2. O que a aplicação é hoje

- **Gerador** de mosaicos com simetria D4/C4/D2, 85 tiles em 31 famílias, subdivisão de 1×1 a 4×4 por quadrante (blocos de 2×2 a 8×8 subtiles).
- **Editor** com pincel, girar, carimbo, trava de subtiles, escopos de propagação (centro, órbita, bloco, todos, livre, mesmo tile), tamanhos de pincel, snap ao bloco, borracha (tile vazio #84) e construtor de supertile.
- **Workspace** com barra superior de documento, sidebar esquerda de ferramentas/guias/cores/gerador/histórico/exportação, canvas central e dock contextual direito.
- **Persistência híbrida** em IndexedDB + localStorage, com migração e fallback de quota.
- **Exportação** PNG (raster) e SVG (vetorial), sem opções de fundo, escala ou camadas.
- **35 suítes** de teste em Node.js puro, sem framework.

---

## 3. Pontos fortes

- **Núcleo puro e testável.** `core/d4_symmetry.js`, `core/mosaic_engine.js`, `core/state_persistence.js`, `core/document_snapshot.js` e `core/history_nav.js` são separados do DOM; a geração é determinística e a invariância D4 é exercitada por dezenas de milhares de asserções.
- **Catálogo consistente.** 85 renderers, 31 famílias, IDs sequenciais e D4 fechado.
- **Editor genuinamente útil.** Escopos de propagação, brush de tamanho inteiro sem ciclo, snap por bloco, borracha, carimbo, freeze monotônico e undo/redo são diferenciais reais, não cosmética.
- **Layout de 1440/1280 coerente.** As quatro zonas cabem sem rolagem horizontal nas capturas de 20:41; a sidebar de 192 px comporta ferramentas em duas colunas, guias, cores, gerador, histórico e exportação; o dock de 350 px rola verticalmente sem quebrar o canvas.
- **Identidade visual consistente.** Tema escuro, azul de ação, tipografia compacta, ícones vetoriais e estados ativos claros.
- **Undo entre gerações corrigido no fluxo principal.** O snapshot novo agora coleta `currentParams` depois da geração (`sketch.js:950-952`), então o caso “G, G, Ctrl+Z” deixou de gravar a seed antiga.
- **Persistência com intenção certa.** A separação entre IDB assíncrono e cache síncrono é uma boa arquitetura em potencial; o problema é a precedência, não a ideia.
- **Acessibilidade básica presente.** `aria-expanded`, `aria-pressed` em alguns toggles, `role="alert"`, `aria-live`, foco visível em boa parte dos controles e um diálogo com `role="dialog"`/`aria-modal="true"`.

---

## 4. Achados por gravidade

| # | Gravidade | Achado | Evidência |
|---|:---:|---|---|
| **A1** | **P0** | `#dirtyGuardDialog` é código morto: nenhum call site de `requestParamChangeWithGuard` e nenhum listener nos botões Cancelar/Gerar. O diálogo nunca abre; se abrisse, os botões não fariam nada. | `sketch.js:2293-2350`; `index.html:123-141`; busca por `requestParamChangeWithGuard` retorna só a definição |
| **A2** | **P0** | O cache em localStorage sobrescreve o IndexedDB a cada boot. Histórico rico (256/100) vira 30/25; em fallback mínimo vira 0/0. | `sketch.js:305-331`; `core/state_persistence.js:184-225,340-352`; demo reproduzível na §5.2 |
| **A3** | **P1** | O limite de 100 edições / 256 gerações do IDB ignora o orçamento dinâmico de bytes. Um snapshot 16×16/4 tem ~736 KB; 100 snapshots, ~74 MB. Em 32×32/4, ~2,9 MB por snapshot e ~295 MB na pilha. | `sketch.js:2375-2377`; `core/state_persistence.js:107-114`; benchmark §5.3 |
| **A4** | **P1** | SVG sempre inclui um retângulo de fundo preenchido; não há opção “sem fundo”, contorno, unidades físicas ou camadas. Para plotter, o arquivo pinta a folha inteira. | `libraries/simple-svg.js:106-114`; `sketch.js:3193-3202` |
| **A5** | **P1** | Acessibilidade: Tab é sequestrado quando o foco está no body/canvas; o modal não tem focus trap; itens do histórico são `div` com clique; o canvas não tem nome acessível; seleções de ferramenta/simetria não expõem `aria-pressed`; contrastes de 2,77:1 a 3,68:1 em textos pequenos. | `sketch.js:3891-3901,1198-1211`; `index.html:357-360`; `sketch.js:1485-1488`; `style.css:7,15-16`; §5.5 |
| **A6** | **P1** | O snapshot de documento não inclui `width`/`height`; `Ctrl+Z` depois de redimensionar o artboard restaura células/parâmetros, mas não o tamanho do canvas. | `core/document_snapshot.js:12-22`; `sketch.js:2999-3005` |
| **A7** | **P2** | `restoreGenerationHistory()` não atualiza `lastDocumentParams`; navegar no histórico e depois gerar grava parâmetros velhos no documento anterior. | `sketch.js:1094-1176`; `sketch.js:987-993` |
| **A8** | **P2** | `restoreGenerationHistory()` restaura `editHistory` mas não chama `syncEditUndoUI()`; o contador “x/y” e o estado dos botões ficam velhos até a próxima ação. | `sketch.js:1156-1165`; `sketch.js:2422` |
| **A9** | **P2** | `isDocumentDirty()` usa `editHistoryIndex > 0`, mas toda geração já empilha uma entrada nova. Se o guard fosse ligado, ele acusaria “sujo” desde o primeiro carregamento e em qualquer troca de parâmetro. | `sketch.js:2282-2286`; `sketch.js:950-959` |
| **A10** | **P2** | No modo Trava, o dock mostra “Pincel & Supertile” e “Tamanho do Pincel”, irrelevantes para a ferramenta; o painel só é escondido em Girar. | `sketch.js:2786-2792`; captura `freeze_editor_options` (20:41) |
| **A11** | **P2** | Hierarquia: a ação primária “Gerar Mosaico” e o “Exportar” ficam no fim da sidebar, abaixo de Ferramentas/Guias/Cores; em 1440 os rótulos “Margem”/“Respiro” são escondidos apesar de haver espaço. | `index.html:297-349`; `style.css:2459-2505` |
| **A12** | **P2** | Rodinha: o modo “roda livre = tamanho do pincel” não normaliza `deltaMode`; em Firefox o delta em linhas (≈3) exige ~15 ticks para atingir o threshold 45. Não há reset do acumulador ao trocar de ferramenta. | `sketch.js:3630-3685` |
| **A13** | **P2** | `isShiftDown`/`isSpaceDown` não são resetados em `blur`/`visibilitychange`; ao perder o foco com Shift pressionado, o snap pode ficar invertido. | `sketch.js:3790-3801,3988-4000`; nenhum handler de blur |
| **A14** | **P2** | Fallback de quota e falha do IDB são silenciosos quando o IDB existe; o aviso `#persistenceWarning` também fica oculto com o dock recolhido. | `sketch.js:306-329`; `style.css:846-849` |
| **A15** | **P2** | Ajuda contradiz o teclado: `syncScopeTopics()` localiza a linha “1 a 6” (que está na frase “antigos atalhos 1 a 6 removidos”) e a substitui por “1 a 6: Seleciona Escopo…”, apagando a instrução Q/Tab. | `ui_info.js:185-195`; `ui_info.js:128-137` |
| **A16** | **P2** | Documentação viva desatualizada: README fala em 32 suítes (são 35), 6 ferramentas (são 7), Seed/Export no topo, guias no rodapé e `#workspaceSwitcher`; o manual fala em 20 suítes e localStorage; o CI fala em 18 suítes. | `README.md:121-150,181-196`; `docs/MANUAL_MANUTENCAO.md:100-120,159`; `.github/workflows/tests.yml:25` |
| **A17** | **P2** | Testes verdes não provam o que dizem: `test_dirty_guard` redefine `isDocumentDirty` localmente e só procura strings; `test_multistep_undo` simula uma pilha e não chama `regenerateMosaic`; `test_ui_control_registry` continua em 58 IDs e ignora os novos controles; `test_indexeddb_persistence` não testa a precedência de boot. | `tests/test_dirty_guard.js:28-55`; `tests/test_multistep_undo.js:96-130`; `tests/test_ui_control_registry.js:16-34` |
| **A18** | **P2** | Desempenho em grade máxima: 32×32 com subdivisão 4 = 65.536 células; geração pura ~51 ms, sem cache de render; zoom 400% chega a canvas de 2400×2400 CSS com pixel density 2. | benchmark §5.7; `core/mosaic_engine.js` render loop; `sketch.js:1598-1620` |
| **A19** | **P3** | Higiene: CSS morto (`#left-rail`, `#workspaceSwitcher`, `.status-guide-btn`), `btnClearFrozen` sem DOM, `freezeUseScope` sem UI, `#seedHistoryPopover` vazio, 18 `!important`, 19 estilos inline, 3 media queries. | `style.css:426,805,861,2271`; `sketch.js:45,282,3035`; `index.html:120` |
| **A20** | **P3** | Exportação sem feedback de sucesso/falha; formato PNG/SVG não é persistido; captura de UI tem caminho hardcoded de outra máquina (`C:\Users\vituk\.gemini\...`); capturas de 20:41 são anteriores aos commits 21:53-21:58. | `sketch.js:3187-3217`; `scripts/capture_ui_eval.js:20-22`; timestamps |

---

## 5. Detalhamento dos achados principais

### 5.1 A1 — O dirty guard é uma casca vazia (P0)

O HTML tem o diálogo completo:

```html
<div id="dirtyGuardDialog" ... role="dialog" aria-modal="true">
  ...
  <button id="btnDirtyGuardCancel">Cancelar</button>
  <button id="btnDirtyGuardConfirm">Gerar mesmo assim</button>
</div>
```

(`index.html:123-141`)

E o `sketch.js` tem `isDocumentDirty`, `requestParamChangeWithGuard` e `closeDirtyGuard` (`2282-2350`). Mas:

- **Nenhum handler chama `requestParamChangeWithGuard`.** A busca em `sketch.js` e `core/*.js` retorna apenas a definição. Todos os handlers de artboard, grade, seed, simetria e paleta chamam `regenerateMosaic(true)` diretamente (por exemplo `2999-3005`, `3050-3055`, `3145-3154`).
- **Nenhum listener é ligado a `btnDirtyGuardCancel` ou `btnDirtyGuardConfirm`.** As únicas referências aos IDs são dentro de `closeDirtyGuard`, que por sua vez só é chamado pelo `Escape` (`3820-3824`).
- O diálogo nunca sai de `.hidden`; os botões são decorativos.

O teste `test_dirty_guard.js` passa porque:

1. Ele lê o HTML e confere os IDs (ok);
2. Ele **redefine** `isDocumentDirty` localmente (`28-55`), em vez de importar a função real;
3. Ele só procura a string `"e.key === 'Escape' && dirtyDialog"` no fonte.

Ou seja: o teste certifica a existência do esqueleto, não a proteção. O mesmo padrão aparece em `test_multistep_undo.js`, que constrói `snap2` manualmente e nunca executa `regenerateMosaic`/`undoMosaicEdit` (`96-130`).

**Consequência para o usuário:** trocar um tile, seed, grade ou simetria continua regenerando imediatamente. O `Ctrl+Z` pode recuperar em muitos casos, mas não há aviso, e os casos de borda da §5.6 podem falhar. A camada 3 que o usuário escolheu (1+3+4) não existe na prática.

**Correção mínima:** envolver os handlers de parâmetro em `requestParamChangeWithGuard` com `revertFn`/`applyFn`, ligar os dois botões, fechar por `Esc`/backdrop, e fazer o teste executar o app real (DOM mock) em vez de redefinir a função.

### 5.2 A2 — O IndexedDB é sobrescrito pelo cache local (P0)

O fluxo de escrita é:

```js
// saveStudioStateToStorage()
persistence.saveToIndexedDB(..., fullPayload);          // 100/256 snapshots
persistence.saveWithQuotaFallback(localStorage, ...);  // 30/25 snapshots
```

(`sketch.js:305-331`)

`saveWithQuotaFallback` chama `migratePayloadHistories`, que corta para `MAX_GENERATION_HISTORY = 30` e `MAX_EDIT_HISTORY = 25` (`core/state_persistence.js:144-179`), mesmo com o IDB disponível.

No boot:

```js
const hasSavedState = loadStudioStateFromStorage(); // localStorage
...
persistence.migrateLocalStorageToIndexedDB(localStorage, ...).then(() => {
  if (!hasSavedState) {
    persistence.loadFromIndexedDB().then(...)        // só se NÃO havia localStorage
  }
});
```

(`sketch.js:638,673-690`)

`migrateLocalStorageToIndexedDB` não verifica se o IDB já tem dados: pega o localStorage e faz `put` por cima (`core/state_persistence.js:340-352`). Como `hasSavedState` é verdadeiro sempre que o localStorage contém qualquer coisa, o IDB **não é lido** e é **sobrescrito** pelo payload reduzido.

Demonstração determinística com o módulo real e um mock de IDB:

```text
payload inicial: history=50, editHistory=40
localStorage mode: full   -> 30/25
depois do boot:            IDB 30/25   (esperado 50/40)

quota fallback:            localStorage 0/0
depois do boot:            IDB 0/0      (histórico rico apagado)
```

O segundo caso é o pior: o fallback mínimo é gravado no localStorage, e o boot o copia para o IDB, apagando o histórico completo que estava lá. O aviso de quota é suprimido quando `indexedDB` existe (`sketch.js:320-329`), então o usuário não sabe que perdeu o histórico.

**Correção mínima:** (a) migrar para o IDB somente se ele estiver vazio ou se o payload local for mais novo (timestamp); (b) no boot, carregar o IDB quando ele existir e usar o localStorage apenas como cache de primeira pintura; (c) nunca gravar o payload mínimo por cima de um IDB rico; (d) avisar o usuário quando o fallback mínimo for usado.

### 5.3 A3 — Orçamento de snapshots ignorado no IDB (P1)

`getMaxEditHistoryForMosaic` calcula um limite dinâmico para caber em ~3,2 MB (`core/state_persistence.js:107-114`). Mas `pushEditHistorySnapshot` usa:

```js
const maxAllowedEdits = (typeof indexedDB !== 'undefined' && ...)
  ? window.StatePersistence.IDB_MAX_EDIT_HISTORY   // 100
  : getMaxEditHistoryForMosaic(...);
```

(`sketch.js:2375-2377`)

Em qualquer navegador com IDB, o limite é 100, independentemente do tamanho do snapshot. O mesmo vale para as 256 gerações (`sketch.js:1085-1086`).

Benchmark dos snapshots (JSON, sem compactação):

| Grade / subdivisão | Células | Geração | Snapshot |
|---|---:|---:|---:|
| 3×3 / 2 | 144 | 2,1 ms | ~7 KB |
| 8×8 / 4 | 4.096 | 8,7 ms | ~184 KB |
| 16×16 / 4 | 16.384 | 15,6 ms | ~736 KB |
| 32×32 / 4 | 65.536 | 51,0 ms | ~2.946 KB |

Com 100 snapshots: ~18 MB (8×8), ~74 MB (16×16), ~295 MB (32×32). E `saveStudioStateToStorage` é chamado a cada edição (`pushEditHistorySnapshot` → `saveStudioStateToStorage`), com `JSON.stringify` do payload completo para o localStorage e `structured clone` para o IDB. Em grades grandes isso é uma receita de travamento e de quota.

Além disso, `captureBeforeRegeneration` guarda `savedEditHistory` (uma cópia da pilha) dentro de cada entrada de geração (`core/history_nav.js:42-75`), duplicando snapshots no payload.

**Correção mínima:** usar o menor entre o limite do IDB e o orçamento dinâmico; salvar snapshots incrementalmente (uma chave por snapshot) em vez do payload inteiro; aplicar debounce também nas edições discretas; medir o tamanho antes de gravar.

### 5.4 A4 — Exportação não é “plotter-ready” (P1)

`renderMosaicToContext` sempre chama `ctx.background(bgColor)` (`core/mosaic_engine.js:330-338`). No SVG, `SimpleSVG.background` materializa um `<rect>` de página inteira:

```js
background(c) {
  ...
  if (col !== 'none') {
    this.elements.push(`<rect x="0" y="0" width="${this.w}" height="${this.h}" fill="${col}" stroke="none" />`);
  }
}
```

(`libraries/simple-svg.js:106-114`)

O próprio comentário do arquivo diz: *“For plotting, we usually DON'T want a background rectangle”*. A aplicação não oferece “sem fundo” nem “somente contorno”. Para um plotter, o SVG baixado pinta a folha com o fundo e, pior, muitos tiles usam `fill` + `noStroke` — um plotter desenha contornos, não preenchimentos. Não há unidades físicas (`width="600"` em px), escala ou separação por camada/pen.

Se o alvo é impressão/plotter, isso é um bloqueio de produto, não um detalhe. Recomendações: opção “SVG sem fundo”, “contorno apenas”, unidades (mm), escala e separação por família/cor. Para PNG, também falta uma opção de densidade/tamanho explícito.

### 5.5 A5 — Acessibilidade (P1)

- **Tab sequestrado.** Com foco no body/canvas, `Tab` cicla escopo no editor ou alterna o dock no gerador (`sketch.js:3891-3901`). Um usuário de teclado que clica no canvas e pressiona Tab não chega aos controles; o comportamento só funciona quando um botão já está focado. Tab é navegação padrão e não deveria ser sobrescrito.
- **Modal sem focus trap e com botões mortos.** `requestParamChangeWithGuard` foca Cancelar (`2326`), mas não há trap; Tab sai para o fundo. Como A1, os botões nem têm listener.
- **Histórico não focável.** Os itens são `div` com `addEventListener('click')` (`1198-1211`); não recebem foco, não respondem a Enter/Espaço e não têm `role`.
- **Canvas sem nome acessível.** `#canvas-stage` é uma `div` vazia (`index.html:357-360`); o canvas p5 não tem `role="img"`, `aria-label` ou descrição. Leitores de tela não têm como perceber a obra.
- **Seleção sem estado ARIA.** Ferramentas usam `.active` (`2736-2740`) sem `aria-pressed`; cartões de simetria e pills de bloco usam `.active` (`1485-1488`, `1524-1527`) sem `role`/`aria-checked`; os segmentados de subdivisão/giro/trava também não expõem estado.
- **Contraste.** `--text-muted: #6b7280` sobre `--bg-panel: #232428` = **3,21:1** (usado em metadados de 9 px do histórico e títulos de seção); branco sobre `--accent-blue: #3b82f6` = **3,68:1**; branco sobre o gradiente `#0ea5e9` do botão “Gerar Mosaico” = **2,77:1**. Todos ficam abaixo de 4,5:1 para texto pequeno.
- **Tamanhos.** 9-10 px em metadados, títulos de seção e labels; abaixo do confortável para leitura contínua.
- **`confirm()` nativo** para descongelar (`1762`), enquanto o resto da UI usa modal customizado — inconsistência e baixa acessibilidade.

### 5.6 A6/A7/A8 — Undo e histórico: o fluxo principal melhorou, as bordas não (P1/P2)

**O que está bom:** `regenerateMosaic` coleta `currentParams` depois de gerar e antes de criar `freshDocSnap` (`950-952`). O caso “G, G, Ctrl+Z” deixa de gravar a seed anterior; o teste de captura e a lógica de `restoreDocumentSnapshot` estão corretos no caminho normal.

**O que continua frágil:**

1. **`width`/`height` fora do snapshot de documento.** `DocumentSnapshot.PARAM_FIELDS` lista nove campos (`core/document_snapshot.js:12-22`), sem largura/altura. `applyCanvasDimensions` muda `StudioState.width/height` e regenera (`2999-3005`); o `Ctrl+Z` restaura células e parâmetros, mas o canvas fica no tamanho novo. O desenho antigo é esticado/renderizado no novo artboard.
2. **Cache velho após navegar no histórico.** `restoreGenerationHistory` aplica os parâmetros da entrada, mas não atualiza `lastDocumentParams` (`1094-1176`). A próxima geração usa `buildDocumentSnapshot(lastDocumentParams)` (`987-993`) e grava o documento anterior com a seed/grade da entrada anterior, não da que está na tela. Undo depois disso pode restaurar parâmetros errados.
3. **UI de undo não sincroniza após navegação.** No ramo `restore_snapshot`, `editHistory` é restaurado (`1156-1161`), mas `syncEditUndoUI()` não é chamado; o label “x/y” e os botões ficam com o estado anterior até a próxima edição.
4. **`isDocumentDirty` sempre verdadeiro.** `editHistoryIndex > 0` (`2282-2286`) conta entradas de geração. Como `regenerateMosaic` empilha uma entrada nova (`950-959`), o índice já é > 0 após o primeiro load. Se o guard fosse ligado, ele pediria confirmação em toda troca de parâmetro, mesmo num mosaico recém-gerado. O “dirty” deveria comparar o documento atual com o último snapshot ou manter um contador de edições manuais.
5. **Falha de restore não desfaz o índice.** `undoMosaicEdit` decrementa `editHistoryIndex` antes de tentar restaurar (`2388`); se `restoreDocumentSnapshot` falhar, o índice fica avançado e o estado pode ter sido parcialmente mutado. Correção: restaurar em uma cópia/transação e só commitar o índice se `ok`.

### 5.7 A18 — Desempenho e escala (P2)

- 32×32 blocos com subdivisão 4 = **65.536 células**. O render loop percorre todas a cada `redraw` (`core/mosaic_engine.js:350-372`), sem cache, culling ou buffer intermediário.
- Geração pura medida em Node: **51 ms** para 32×32; o render JS (proxy no-op) ~**11 ms**, mas o custo real de 65 mil operações de canvas é maior e não foi medido no navegador.
- Zoom 400% redimensiona o canvas para 2400×2400 CSS; com `pixelDensity(2)`, o backing store chega a 4800×4800 (~92 MB só de pixels), e cada mudança de zoom realloca o canvas (`1598-1620`).
- A cada edição, `saveStudioStateToStorage` serializa o payload com `cellsSnapshot` + `history` + `editHistory`; em grade grande, isso pode bloquear a thread principal.
- O limite de 100 snapshots do IDB agrava: 16×16/4 = ~74 MB de histórico; 32×32/4 = ~295 MB.

**Recomendação:** cachear o mosaico em um `p5.Graphics`/offscreen e redesenhar somente overlays; limitar o histórico pelo orçamento real; usar `requestIdleCallback`/debounce para persistência; medir com browser real antes de prometer 32×32.

### 5.8 A10/A11/A12 — UX e hierarquia (P2)

- **Ação primária enterrada.** “Gerar Mosaico” e “Exportar” ficam no fim da sidebar, depois de Ferramentas, Guias e Cores (`index.html:297-349`). Num app generativo, “Gerar” é a ação mais frequente; o topo da sidebar é ocupado por ferramentas de edição. Isso é uma escolha de hierarquia, não um bug, mas custa descoberta.
- **Painel irrelevante.** No modo Trava, o dock mostra “Pincel & Supertile” e “Tamanho do Pincel” porque `brushPanel` só é escondido quando `activeTool === 'rotate'` (`2786-2792`). O usuário vê dois “tamanhos” diferentes (Trava e Pincel) na mesma tela.
- **Rótulos escondidos com espaço sobrando.** Em 1440, `Margem` vira `M` e `Respiro` vira `P` por causa do `@media (max-width: 1600px)` (`style.css:2459-2505`), embora a barra superior tenha um espaçador vazio. Em 1280 a compactação faz sentido; em 1440, não.
- **Duas histórias.** “Histórico” (gerações) na sidebar e “x/y” (edições) no dock não são explicados; o usuário pode achar que são a mesma coisa. Um label “Histórico de gerações” e “Edições (Ctrl+Z)” ajudaria.
- **Rodinha não convencional.** Roda livre muda o pincel; Ctrl+roda dá zoom; Alt+roda dá pan vertical; Shift+roda dá pan horizontal (`3633-3685`). É poderoso, mas exige aprendizado e não normaliza `deltaMode`; em trackpad/Firefox o comportamento pode ser errático.
- **Estado de modificador preso.** `isShiftDown` e `isSpaceDown` só são atualizados em keydown/keyup (`3790-3801,3988-4000`); perder o foco com Shift/Espaço pressionado deixa o estado invertido.

### 5.9 A15/A16/A17 — Documentação, ajuda e testes (P1/P2)

- **README** ainda descreve Seed/Export no topo, guias no rodapé, `#workspaceSwitcher`, 6 ferramentas e 32 suítes (`README.md:121-150`). O app tem 7 ferramentas, export na sidebar, guias na sidebar e 35 suítes.
- **Manual** fala em 20 suítes e localStorage (`docs/MANUAL_MANUTENCAO.md:100-120,159`); o app tem 35 e IDB + localStorage.
- **Atalhos** do README ainda dizem `1`–`6` para escopos e `Tab` para o dock (`README.md:190,196`); o app usa Q/Tab para escopos (em contexto de editor), 1 para 100%, 0 para fit e Tab para dock só no gerador.
- **Ajuda** tem a contradição descrita em A15: o sincronizador substitui a linha Q/Tab por “1 a 6”.
- **Testes** verdes não provam o produto: o registro tem 58 IDs e ignora `brushSizeControl`, `btnBrushSizeInc/Dec`, `btnToggleBrushSnap`, `dirtyGuardDialog`, etc.; `test_multistep` simula; `test_dirty_guard` redefine; `test_indexeddb` não testa boot; `test_viewport` copia funções em vez de carregar o app (comentário enganoso em `53-54`).
- **CI** rotula “All 18 Suites” (`.github/workflows/tests.yml:25`). Não é funcional, mas é sinal de documentação não acompanhada.
- **Capturas** de 20:41 são anteriores aos commits 21:53-21:58; o painel de pincel atual (display +/− e snap) não está nas imagens. As capturas `layout_*` de 15:50/18:06 mostram a UI antiga. Há evidência visual, mas não do HEAD.

### 5.10 A19/A20 — Higiene e ferramentas (P3)

- CSS morto: `#left-rail` (`style.css:426`), `#workspaceSwitcher` (`805,861`), `.status-guide-btn` (`2271`), regras antigas de `.history-item` (`356`).
- JS morto: `btnClearFrozen` (`3035`), `freezeUseScope` (`45,282,455`), `#seedHistoryPopover` vazio (`index.html:120`), `rotateSnapToBlock` sem UI dedicada.
- 18 `!important`, 19 estilos inline no HTML, 3 media queries; manutenção difícil.
- `scripts/capture_ui_eval.js` cria diretório em `C:\Users\vituk\.gemini\...` (`20-22`), não portátil.
- Formato de export não persiste; não há toast de sucesso/falha; o primeiro `Ctrl+Z` após o load pode ser um no-op (entrada duplicada inicial).
- Sem lint/formatter/`package.json`; o projeto depende de inspeção manual.

---

## 6. O que os testes realmente cobrem

| Suíte | O que faz | O que não faz |
|---|---|---|
| `test_d4_invariance` | 168.960 asserções de invariância | nada de UI |
| `test_mosaic_engine` | geração/render com mock | não mede performance real |
| `test_dirty_guard` | confere IDs e redefine `isDocumentDirty` | não verifica call sites/listeners |
| `test_multistep_undo` | simula pilha local e testa `applyParams` | não executa `regenerateMosaic`/`undoMosaicEdit` |
| `test_indexeddb_persistence` | round-trip e migração com mock | não testa boot/precedência/fallback |
| `test_brush_sizing_snap` | carrega `sketch.js` com DOM mock e exercita brush/snap/eraser | não testa UI real, wheel, export |
| `test_viewport_pan_zoom` | copia funções para o teste | não carrega o app |
| `test_ui_control_registry` | 58 IDs fixos | ignora novos controles |
| `test_docs_consistency` | 3 checagens de texto/funções | não valida UI/atalhos/contagens |

**Conclusão:** a suíte é boa para o núcleo e fraca para o produto. Os dois P0 (dirty guard e persistência) passam verdes. Esse é o achado metodológico mais importante: **o verde não é evidência de que o comportamento existe**.

---

## 7. Checklist antes de chamar de pronto

- [ ] `#dirtyGuardDialog` abre em troca de tile/seed/grade/simetria e “Cancelar” reverte o parâmetro.
- [ ] Botões Cancelar/Gerar têm listeners; Esc e backdrop fecham; foco fica preso no modal e volta ao gatilho.
- [ ] `isDocumentDirty` não é verdadeiro em um mosaico recém-gerado sem edições.
- [ ] Histórico de 100/256 sobrevive a reload; IDB não é sobrescrito pelo localStorage; fallback mínimo não apaga IDB.
- [ ] `Ctrl+Z` após mudar W/H restaura o tamanho do canvas.
- [ ] Após navegar no histórico e gerar, undo restaura a seed/grade corretas.
- [ ] SVG “sem fundo” e “somente contorno” disponíveis; unidades/escala documentadas.
- [ ] PNG exportado tem dimensão previsível e testada.
- [ ] Tab não sequestra navegação; histórico é focável; canvas tem nome acessível; seleções têm ARIA.
- [ ] Contraste ≥ 4,5:1 em textos pequenos.
- [ ] 32×32/4 não trava o navegador e o payload não estoura a memória.
- [ ] README/manual/ajuda/CI batem com 35 suítes, 7 ferramentas, Q/Tab, IDB e sidebar atual.
- [ ] Capturas do HEAD atual em 1280 e 1440, com hashes únicos.

---

## 8. Roadmap priorizado

1. **P0 — Religar o dirty guard.** Envolver os handlers de parâmetro; listeners nos botões; focus trap; teste que abre o diálogo de verdade. Corrigir `isDocumentDirty` para refletir edições manuais, não o índice da pilha.
2. **P0 — Corrigir a precedência de persistência.** IDB como fonte da verdade; localStorage só como cache de boot; migração condicional por timestamp/versão; nunca sobrescrever IDB rico com fallback mínimo; avisar o usuário.
3. **P1 — Orçamento de snapshots.** Usar `min(IDB_MAX, getMaxEditHistoryForMosaic)`; salvar snapshots incrementalmente; debounce de edições discretas; medir bytes.
4. **P1 — Exportação para plotter.** Opção sem fundo, somente contorno, unidades mm, escala e camadas; testar PNG em dimensão fixa.
5. **P1 — Acessibilidade.** Remover o sequestro de Tab; focus trap; histórico como botões; ARIA de seleção; nome do canvas; contraste e fontes.
6. **P1/P2 — Undo e histórico.** Incluir width/height no snapshot; atualizar `lastDocumentParams` após navegação; `syncEditUndoUI`; rollback em falha.
7. **P2 — Desempenho.** Cache de render, limite de grade/zoom, persistência assíncrona e medição no browser.
8. **P2 — UX.** Reordenar Gerar/Exportar; esconder brush panel em Trava; rótulos completos em 1440; explicar as duas histórias; normalizar wheel.
9. **P2 — Docs/testes.** Atualizar README/manual/ajuda/CI; testes de integração reais; capturas do HEAD.
10. **P3 — Higiene.** Remover código/CSS morto; lint/formatter; portabilidade dos scripts.

---

## 9. Evidências reproduzíveis

### Testes

```powershell
git rev-parse --short HEAD    # 255e5d0
Get-ChildItem tests/test_*.js | Measure-Object   # 35
# execução individual das 35 suítes: 35/35 exit 0
node tests/run_all.js         # EPERM neste sandbox (spawnSync + pipe)
```

### Benchmark (Node, módulos reais)

```text
3x3/2:   144 cells, gen 2.1ms, snapshot ~7KB
8x8/4:   4096 cells, gen 8.7ms, snapshot ~184KB
16x16/4: 16384 cells, gen 15.6ms, snapshot ~736KB
32x32/4: 65536 cells, gen 51.0ms, snapshot ~2946KB
```

### Persistência (mock IDB + módulo real)

```text
history=50, editHistory=40
localStorage full -> 30/25; após boot IDB 30/25
quota fallback -> localStorage 0/0; após boot IDB 0/0
```

### Contraste

```text
#6b7280 em #232428 = 3.21:1
#ffffff em #3b82f6 = 3.68:1
#ffffff em #0ea5e9 = 2.77:1
```

### Arquivos-chave

`sketch.js:882-980` (geração), `2282-2350` (dirty guard), `297-331` (persistência), `1094-1176` (histórico), `3630-3685` (wheel), `3891-3901` (Tab); `core/state_persistence.js:184-225,340-352`; `core/document_snapshot.js:12-22`; `libraries/simple-svg.js:106-114`; `tests/test_dirty_guard.js:28-55`; `tests/test_multistep_undo.js:96-130`.

### Limitações desta análise

- **Navegador headless indisponível neste sandbox.** Brave/Edge falham ao abrir named pipes (crashpad/mojo, acesso negado). Não foi possível medir 1280/1440 em runtime, testar o diálogo, exportar de fato ou reproduzir o dirty guard clicando. As conclusões de comportamento vêm do código, dos testes e de simulações Node; as de layout, das capturas de 20:41 (anteriores aos commits 21:53-21:58).
- **Benchmark de render é JS puro com contexto no-op**, não o custo real de canvas; serve como limite inferior.
- **Contraste calculado por luminância relativa**, não medido em tela.

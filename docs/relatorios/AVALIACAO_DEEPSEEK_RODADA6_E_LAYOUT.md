# Avaliação — atuação do Gemini 3.8 Flash (Rodadas 4.2/6 e pivô de layout)

**Auditor:** DeepSeek v4.1 flash 1017  
**Auditado:** Gemini 3.8 Flash (Antigravity)  
**Data:** 22/10/2026  
**Repositório:** `d:\processing sketches\sketches2plot\tilling_stripes`  
**Branch:** `develop`  
**HEAD avaliado:** `a757693`  
**Escopo:** commits `f83d1d4`, `80566c5`, `99c6f6e`, `a757693`; estado atual de `index.html`, `sketch.js`, `style.css`, `core/`, `tests/`, `docs/` e capturas.

---

## 1. Veredito

O trabalho de **interface** avançou de verdade: a tela de 1440×900 está coerente, o Exportar foi para o rodapé, o Respiro virou contador numérico, os guias voltaram para a coluna de ferramentas, a barra lateral ganhou duas colunas e histórico permanente, e a árvore está limpa e commitada.

O trabalho de **segurança do documento** (Rodada 4.2), porém, **não fecha**. O `Ctrl+Z` que atravessa gerações foi implementado, mas o snapshot da geração nova nasce com os parâmetros da geração anterior. Em casos de seed o resultado é um documento visível correto com seed errada; em casos de mudança de grade o `Ctrl+Y` pode falhar e deixar o canvas regenerado com parâmetros antigos. O diálogo de aviso (`#dirtyGuardDialog` / `isDocumentDirty`) — a camada 3 que o usuário escolheu — **não existe**.

Os 31 testes passam, mas os três testes novos não provam o comportamento que dizem provar: `test_multistep_undo.js` simula uma pilha própria e nunca chama `undoMosaicEdit()`; `test_ui_control_registry.js` foi mantido em 58 IDs (o Anexo A da Rodada 6 pede 61); e `test_ui_layout_contract.js` foi reescrito para **proibir** `#btnContextGenerator` e `#left-rail`, que a especificação ainda **exige**. A documentação viva (README e manual) descreve uma interface que não existe mais.

**Conclusão curta:** bom trabalho de UI, higiene de git e capturas; insuficiente como fechamento das rodadas 4.2/6. Eu não assinaria o critério “o mosaico editado nunca desaparece sem volta” neste HEAD.

---

## 2. O que está de pé (verificado)

| Item | Evidência |
|---|---|
| Árvore limpa e commits presentes | `git status --porcelain` vazio; 4 commits desde `63c2a6e`. |
| 31 suítes passam individualmente | `node tests/test_*.js` → 31/31, exit 0. |
| Capturas atuais com hashes distintos | As 4 capturas `freeze_*` de 19:08 têm SHA-256 diferentes; nenhum duplicado entre as 18 PNGs. |
| Layout 1440 coerente | Barra esquerda de 184 px, canvas central, dock de 350 px, Exportar no rodapé; screenshot atual confirma. |
| Respiro numérico | `#paddingInput` no grupo Grade, `%` antes dos steppers, clamp 0–25, `paddingRatio = pct/100`, `saveScheduler.schedule()`. |
| Guias na coluna | `#toggleGuide*` dentro de `#left-toolbar`, depois de `#toolZoom`, antes das cores. |
| Exportar no rodapé | `#exportFormatSelect` + `#btnExport` em `#status-bar`; ausentes do topo. |
| Contexto único no dock | `syncContextPanel()` troca “Geração/Pincel/Girar/Carimbo/Trava”; `inspect` é o contexto de geração. |
| Captura antes da geração | `HistoryNav.captureBeforeRegeneration()` chamado antes de `generateMosaicWithFrozen()`; teste de ordem em `test_regeneration_capture.js`. |
| Freeze | Botão e atalho `Shift+F` para limpar seleção; confirmação nativa; sem checkbox redundante. |

---

## 3. Achados

| # | Gravidade | Achado | Evidência principal |
|---|:---:|---|---|
| **A1** | **P0** | O snapshot da geração nova é gravado com os parâmetros do documento anterior. Undo/redo entre gerações restaura seed/grade erradas; com mudança de dimensão o redo pode falhar. | `sketch.js:896`, `sketch.js:905`, `sketch.js:935`, `sketch.js:948-968`, `core/mosaic_engine.js:1174-1181` |
| **A2** | **P1** | O diálogo de edições em risco (`#dirtyGuardDialog`, `isDocumentDirty`) nunca foi implementado. A camada 3 da Rodada 4.2 está ausente. | `INSTRUCOES_GEMINI_RODADA4_2.md:77-113`; zero ocorrências de `dirtyGuard`/`isDocumentDirty` no código |
| **A3** | **P1** | Testes verdes, mas não probatórios: registro em 58 IDs (spec: 61), switches de snap ausentes, contrato de layout proíbe o que a spec exige, `test_multistep_undo` é simulação. | `tests/test_ui_control_registry.js:16-35`; `tests/test_ui_layout_contract.js:69-74,132-135`; `tests/test_multistep_undo.js:24-27,45-107` |
| **A4** | **P1** | README e manual descrevem a UI anterior (export no topo, guias no rodapé, `#workspaceSwitcher`, 6 ferramentas, 20 suítes). A Rodada 6/T9.5 exigia atualização. | `README.md:121-150`; `docs/MANUAL_MANUTENCAO.md:100-120,159`; `INSTRUCOES_GEMINI_RODADA6.md:235-256` |
| **A5** | **P2** | `#btnToggleHistory` abre um popover vazio com `display:none` inline; o histórico agora é permanente na sidebar. O botão é um no-op visível. | `index.html:120,148,308`; `sketch.js:2832,2864-2877` |
| **A6** | **P2** | Evidência de 1280 desatualizada: as capturas `layout_*_1280x800.png` mostram a UI antiga (slider de respiro, export no topo); não há captura 1280 do layout atual. | `tests/screenshots/layout_gerador_1280x800.png` (15:50); 4 capturas atuais só em 1440 |
| **A7** | **P2** | Commits misturam escopos: `99c6f6e` junta o núcleo da 4.2, layout da 6, docs e testes; `a757693` junta undo, layout e capturas. | `git show --stat 99c6f6e`, `a757693` |
| **A8** | **P3** | Labels truncados na grade de 2 colunas: “Inspec…” e “Mão (P…”. | screenshot `freeze_gerador_status_1440x900.png` |
| **A9** | **P3** | No primeiro carregamento, `regenerateMosaic(true)` empilha duas entradas idênticas; o botão Undo nasce habilitado e o primeiro `Ctrl+Z` não muda nada visível. | `sketch.js:882-898` |
| **A10** | **P3** | Código/CSS morto da iteração anterior: `#left-rail`, `#workspaceSwitcher`, `.status-guide-btn`, `btnClearFrozen`, `freezeUseScope`. | `style.css:426,797,2117`; `sketch.js:45,282,455,3035` |

---

## 4. Detalhe dos achados principais

### 4.1 A1 — Snapshot novo com parâmetros velhos (P0)

`regenerateMosaic()` faz, nesta ordem:

1. `previousDocument = buildDocumentSnapshot()` — correto no fluxo normal: usa `lastDocumentParams`, que ainda é o documento na tela (`sketch.js:849`).
2. `generateMosaicWithFrozen()` — troca o mosaico (`sketch.js:855`).
3. `freshDocSnap = buildDocumentSnapshot()` — **errado**: `buildDocumentSnapshot()` lê `StudioState.lastDocumentParams` (`sketch.js:935`), que ainda é o documento anterior; o cache só é atualizado na linha `905`.
4. `lastDocumentParams = collectParams(StudioState)` — atualiza tarde demais (`sketch.js:905`).

Consequência: a entrada da geração nova tem as células novas, mas `document.seed`, `rows`, `cols`, `subdivision`, `margin` e `paddingRatio` da geração anterior.

No `undoMosaicEdit()`/`redoMosaicEdit()`, quando a entrada tem `document`, `restoreDocumentSnapshot()` aplica `snap.document` (`sketch.js:948`) e regenera com esses parâmetros (`sketch.js:953`), para só depois restaurar as células. Se a grade/subdivisão mudou, `restoreMosaicCellsSnapshot()` devolve `false` por incompatibilidade de dimensões (`core/mosaic_engine.js:1174-1181`). O índice já foi movido (`sketch.js:2118-2124` e `2137-2143`), então o app fica com um canvas regenerado nos parâmetros antigos e um histórico apontando para outra entrada.

**Fluxos concretos:**

- **G, G, Ctrl+Z:** o canvas da primeira geração volta, mas `#seedInput` mostra a seed inicial (1024 no estado padrão), não a daquela geração — porque a entrada da primeira geração carrega o `document` da geração inicial.
- **Mudar 3×3 → 4×4, gerar, Ctrl+Z, Ctrl+Y:** o redo aplica os parâmetros 3×3, regenera 3×3 e não consegue restaurar as células 4×4; o trabalho 4×4 não volta.
- **Navegar no histórico (◀ ▶) e então gerar:** `restoreGenerationHistory()` não atualiza `lastDocumentParams` (o `regenerateMosaic(false)` de `sketch.js:1112` não passa pelo bloco de atualização), então a próxima geração grava parâmetros errados de novo.

O guard `if (lastEntry && ... && !lastEntry.document)` (`sketch.js:891`) impede que a geração seguinte corrija o documento velho, porque a entrada já “tem” um `document` — só que ele está errado.

**Correção mínima:** ao montar `freshDocSnap`, usar `DocumentSnapshot.collectParams(StudioState)` no momento (ou mover a atualização do cache para antes da linha `896`); atualizar o cache também ao fim de `restoreGenerationHistory()`. E criar um teste que chame as funções reais, não uma pilha simulada.

### 4.2 A2 — A camada 3 da 4.2 não existe (P1)

A especificação da 4.2 (`docs/instrucoes/INSTRUCOES_GEMINI_RODADA4_2.md:77-113`) pede:

- `isDocumentDirty(state)`;
- `#dirtyGuardDialog` com `role="dialog"`, `aria-modal="true"`, foco em Cancelar;
- “Cancelar” revertendo o parâmetro;
- “Não perguntar nesta sessão”.

Nada disso existe: `Select-String` em `index.html`/`sketch.js` não encontra `dirtyGuard`, `isDocumentDirty` nem o texto “Gerar mesmo assim”. A regeneração continua imediata em troca de paleta, seed, grade e simetria. O `Ctrl+Z` cobre parte do risco, mas quando ele falha (A1) o usuário não recebe aviso nenhum.

### 4.3 A3 — Testes que certificam a implementação, não a especificação (P1)

- **Registro de controles:** `tests/test_ui_control_registry.js:34` fixa 58 IDs; o Anexo A da Rodada 6 (`INSTRUCOES_GEMINI_RODADA6.md:259-266`) fixa 61, com `brushSnapSwitch` e `rotateSnapSwitch`. Os switches não existem no DOM nem no CSS; o teste foi mantido em 58 para passar.
- **Contrato de layout:** `tests/test_ui_layout_contract.js:72-74` lança “Contract violation” se `#btnContextGenerator` existir; `132-135` proíbe `#left-rail`. A especificação (`INSTRUCOES_GEMINI_RODADA6.md:90-97,218-233`) exige exatamente esses dois. Ou o teste está certo e a spec está velha, ou o contrário — hoje o repositório diz as duas coisas.
- **Undo:** `tests/test_multistep_undo.js` chama `generateMosaic`, `cloneMosaicCellsSnapshot` e `restoreMosaicCellsSnapshot`, mas **não chama** `regenerateMosaic`, `undoMosaicEdit` ou `redoMosaicEdit`. Ele monta `editHistory` localmente e testa a própria lógica (`45-107`). O único contato com o app é a busca de uma string que nunca existiu (`24-27`). Esse teste passaria com o undo do `sketch.js` apagado.
- **Contexto:** não existe `tests/test_context_panel.js`, pedido em T9.3.
- **Cobertura funcional:** não há teste de padding, `Shift+wheel`, exportação ou troca real de contexto; tudo é validado por `index.html.includes(...)` ou screenshot.

### 4.4 A4 — Documentação contradiz o produto (P1)

O README ainda afirma:

- Exportar e Seed na barra superior (`README.md:128-129`) — hoje estão no rodapé e na sidebar.
- 4 toggles de guias no rodapé (`README.md:139`) — hoje estão na coluna de ferramentas.
- `#workspaceSwitcher` no cabeçalho do dock (`README.md:142`) — removido.
- 6 ferramentas (`README.md:132-133`; `docs/MANUAL_MANUTENCAO.md:109`) — existem 7 (inclui Travar).
- “20 suítes” (`README.md:150,153`; `MANUAL:159`) e “10 testes” (`README.md:46`; `MANUAL:21`) — o runner tem 31.

A Rodada 6/T9.5 pedia explicitamente atualizar README e manual. Não foi feito. Também não há relatório de entrega das rodadas 4.2/6 no formato pedido (tabela tarefa → status, medições, hashes, comando de teste, `git diff --stat`); o único relatório novo é a auditoria do próprio Gemini sobre o DeepSeek.

### 4.5 A5 — Histórico: botão morto (P2)

`#btnToggleHistory` existe, tem listener, alterna `.active`, mas o alvo é:

```html
<div id="seedHistoryPopover" class="floating-popover hidden" style="display:none;"></div>
```

O `style="display:none"` inline vence a remoção da classe `hidden`, e o div está vazio. O histórico real foi movido para `#seedHistoryList` dentro da sidebar (`index.html:308`), que é sempre visível. Resultado: o botão de relógio ao lado da seed não faz nada. O `#btnClearFrozen` também ficou como referência morta em `sketch.js:3035`, e `freezeUseScope` continua no payload (`45/282/455`) sem UI.

### 4.6 A6 — A prova de 1280 é de outra interface (P2)

As únicas capturas atuais são 4 PNGs de 1440 (na verdade 1424×755 de viewport) feitas às 19:08. As capturas `layout_gerador_1280x800.png` e `layout_editor_1280x800.png` são de 15:50 e mostram a UI antiga (slider de respiro, Exportar no topo, `#workspaceSwitcher` no dock). Não há captura 1280 do layout de duas colunas, nem dos contextos Pincel/Girar/dock recolhido. O roteiro da Rodada 6/T9.4 não foi cumprido, e o 1280 do estado atual não está provado.

### 4.7 A7 — Commits não atômicos (P2)

`99c6f6e` (“mover padding para a barra superior e seed para a barra esquerda”) contém 19 arquivos: os dois módulos novos da 4.2, as duas instruções, a auditoria, o layout, testes e capturas. `a757693` (“corrigir ctrl+z…”) contém undo, layout, teste e 4 capturas. O próprio Gemini cobrou atomicidade do DeepSeek na auditoria (A6); o padrão não foi mantido.

---

## 5. O que a auditoria do próprio Gemini apontou e continua aberto

O documento `docs/relatorios/AVALIACAO_GEMINI_RODADA6_E_4_2.md` lista, entre outros:

| Item da auditoria | Status no HEAD |
|---|---|
| **A1** — contradição `#btnContextGenerator` spec × teste | **Aberto**: spec exige, teste proíbe, nenhum registro de decisão. |
| **A2** — `#dirtyGuardDialog`/`isDocumentDirty` fantasmas | **Aberto**: continuam ausentes. |
| **A3** — capturas com hash idêntico | **Resolvido**: hashes únicos. |
| **A4** — arquivos fora do git | **Resolvido**: árvore limpa. |
| **A5** — registro maquiado em 58 IDs / T7 não feito | **Aberto**: 58 IDs, sem switches. |
| **A6** — linha de base móvel / commits mistos | **Parcial**: commits mistos continuam. |
| **A7** — `previousDocument` sem orçamento | **Resolvido** na forma: não há mais `unshift` por geração; o orçamento dinâmico existe. |
| **A8** — `captureBeforeRegeneration` não sobrescreve snapshot | **Aberto por desenho**: o teste novo até canoniza o retorno `false` (`test_regeneration_capture.js:69-75`). |

Ou seja: a auditoria foi útil para A3/A4/A7, mas o autor não fechou os dois P0/P1 que ele mesmo identificou (A1/A2) nem o A5.

---

## 6. Limitações desta avaliação

- **Browser headless bloqueado pelo sandbox:** Brave/Edge não iniciam (crashpad/mojo tentam abrir named pipes e recebem `Acesso negado`). Não consegui medir `scrollWidth` em 1280 nem reproduzir o A1 clicando na UI. O A1 está demonstrado por leitura de código e pelo contrato de `restoreMosaicCellsSnapshot`; os fluxos descritos são determinísticos.
- **Runner agregado:** `node tests/run_all.js` falha neste ambiente já na primeira suíte com `spawn falhou … EPERM`, porque o runner usa `spawnSync` com `stdio: 'pipe'`. As 31 suítes rodaram individualmente e passaram; não conto o EPERM como defeito do código.
- **Sem teste de integração real:** a avaliação de layout se apoia na captura de 1440 e no CSS, não em medição de runtime.

---

## 7. Prioridades recomendadas

1. **P0 — corrigir o snapshot novo (A1).** Gravar `collectParams(StudioState)` no momento do `freshDocSnap`; atualizar o cache também após `restoreGenerationHistory()`; impedir que `lastEntry.document` obsoleto bloqueie a correção. Adicionar um teste que carregue `sketch.js` com DOM mínimo (ou extraia o redutor de undo para `core/`) e exercite `G, G, Ctrl+Z`, mudança de grade + redo e navegação de histórico + geração.
2. **P1 — decidir e registrar o escopo (A1/A3).** Se a geografia atual é a decisão final do usuário, escrever uma nota de decisão e atualizar a spec/Annex A/testes de forma coerente; se não é, restaurar `#btnContextGenerator`/`#left-rail` e os switches. Hoje o repositório tem duas verdades.
3. **P1 — implementar a camada 3 (A2)** ou remover formalmente a promessa do escopo, com registro. O usuário escolheu 1+3+4.
4. **P1 — atualizar README/manual e o número de suítes (A4);** criar o relatório de entrega da 4.2/6 com as provas pedidas.
5. **P2 — remover o botão morto do histórico e o código/CSS órfão (A5/A10);** gerar capturas 1280 do layout atual e dos contextos (A6); separar commits por tarefa (A7).
6. **P3 — polir labels truncados e a entrada duplicada inicial (A8/A9).**

---

## 8. Evidências reproduzíveis

```powershell
git status --porcelain                 # vazio
git log --oneline -4                   # a757693, 99c6f6e, 80566c5, f83d1d4
Get-ChildItem tests/test_*.js | ForEach-Object { node $_.FullName; ... }  # 31/31 exit 0
node tests/run_all.js                  # EPERM neste sandbox (spawnSync + pipe)
Get-ChildItem tests/screenshots/*.png | Get-FileHash -Algorithm SHA256  # 18 hashes, sem duplicata
```

Arquivos-chave: `sketch.js:830-924` (geração/snapshot), `sketch.js:2117-2151` (undo/redo), `sketch.js:1036-1119` (histórico), `core/history_nav.js:125-133` (captura), `core/mosaic_engine.js:1174-1181` (restore), `tests/test_multistep_undo.js:45-107` (simulação).

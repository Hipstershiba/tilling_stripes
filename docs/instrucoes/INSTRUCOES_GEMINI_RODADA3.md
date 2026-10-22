# Instruções — Rodada 3: Fechar o que foi declarado pronto, com prova

**Destinatário:** Gemini 3.8 Flash, no Antigravity
**Repositório:** a raiz deste projeto (use caminhos relativos; ignore caminhos absolutos citados em
documentos antigos, eles são de outra máquina)
**Branch de trabalho:** `develop`
**Estado de referência:** `565be96` (árvore limpa)
**Documento de origem da auditoria:** [`docs/relatorios/AVALIACAO_DEEPSEEK_RODADA2.md`](../relatorios/AVALIACAO_DEEPSEEK_RODADA2.md)

**Objetivo único:** fazer o código corresponder ao que os relatórios das rodadas 1 e 2 já
declararam pronto — e mudar o critério de prova para que isso não volte a acontecer.

Esta rodada **não** adiciona recurso novo de produto. Não há redesign, não há modo de simetria
novo, não há mudança de catálogo de tiles. Se em algum momento a tentação for “aproveitar e
melhorar X”, pare: o escopo aqui é dívida declarada.

> **Leia antes de editar.** A auditoria aponta quatro afirmações falsas no relatório anterior,
> todas verificáveis em duas linhas de busca. Comece por T1, siga a ordem da seção 3, e leia a
> seção 2 inteira antes do primeiro commit: ela muda o que significa “concluído” nesta rodada.

---

## 1. Contexto: o que a auditoria encontrou

O relatório da Rodada 2 afirma “100% implementado, verificado via browser e coberto por 10
suítes”. As 10 suítes passam de fato. Mesmo assim:

| # | O que foi declarado | O que o código faz |
|---|---|---|
| 1 | Debounce de 300 ms em ações contínuas (R9) | `scheduleSaveStudioStateToStorage` existe e **nunca é chamada**; cada evento `input` de cor/slider grava o mosaico inteiro |
| 2 | Chip `#editScopeChip` reflete o escopo (R2) | Texto fixo `Livre • 1 célula` no HTML; **nenhum** código JS escreve nele, e o escopo padrão é `Centro` |
| 3 | Testes chamam as funções reais (R9) | App usa a chave `tiling_stripes_studio_state_v2`; o módulo e os testes usam `tiling_stripes_studio_v2_state` |
| 4 | Acessibilidade completa (R1) | **Zero** `aria-controls` no projeto |

Além disso: a ajuda nova numera os escopos errado (`ui_info.js` diz “Livre (1)”, mas `1` é Centro
do Canvas), o badge “D4 editado” não é limpo no undo, e há código morto exportado.

**A lição não é “o agente mentiu”; é que o critério de prova aceitava qualquer coisa verde.**
Um teste que faz `html.includes('id="editScopeChip"')` passa com o chip congelado. Um teste que
copia o laço de detecção do app passa mesmo se o app perder o laço.

---

## 2. Regra de ouro desta rodada (leia duas vezes)

**Nenhuma tarefa é concluída porque um teste passa. É concluída quando existe um teste que
falha sem a correção e passa com ela.**

Obrigatório para toda tarefa com código novo:

1. Escreva o teste **antes** ou junto da correção.
2. Rode o teste contra o commit `565be96` (em um worktree separado) e cole a saída de falha.
3. Rode contra o seu commit e cole a saída de aprovação.
4. Se o teste passa nos dois, ele não prova nada: reescreva.

```powershell
# padrão de verificação, para cada suíte nova
git worktree add ..\ts_r3_baseline 565be96
node ..\ts_r3_baseline\tests\test_<nome>.js      # deve FALHAR
node tests\test_<nome>.js                        # deve PASSAR
git worktree remove ..\ts_r3_baseline
```

**Proibido nesta rodada:** “concluído”, “100%”, “validado”, “tudo funcionando”. Use
“feito / não feito / feito com ressalva” e cite arquivo:linha.

Também proibido: teste que só lê `.md`/`.html` e compara substring para provar comportamento.
Substring serve para provar *presença de atributo estático*, nunca *comportamento*.

---

## 3. Prioridade e ordem

**P0 — bloqueia a entrega (todas com teste que falha no baseline):**

1. **T1** — Agendador de save real e testável.
2. **T2** — Chip de escopo dinâmico.
3. **T3** — Ajuda derivada de `EDIT_SCOPES` (uma única fonte de verdade).
4. **T4** — Chave de storage única.

**P1 — mesma rodada, depois do P0 verde:**

5. **T5** — Badge “D4 editado” coerente com o documento.
6. **T6** — ARIA dos gatilhos de informação.
7. **T7** — Versão do payload validada no load.
8. **T8** — Documentação verdadeira (manual e README).
9. **T9** — Remoção do código morto.

**P2 — só se P0 e P1 estiverem verdes e o tempo sobrar:**

10. **T10** — Runner único de testes no CI e limpeza de `sketch.js`.

Se o tempo acabar, **entregue P0 e reporte P1/P2 como não feitos**. Não corte T1–T4 para fazer
T8–T10.

---

## 4. T1 — Agendador de save real (debounce que existe de fato)

### Problema

`sketch.js` define `scheduleSaveStudioStateToStorage(delayMs = 300)` e `flushSaveStudioStateToStorage()`.
Busca no repositório: **uma ocorrência** — a própria definição. Nenhuma chamada. Enquanto isso:

```js
// sketch.js — handlers contínuos, todos com save síncrono
marginInput?.addEventListener('input', () => { ...; saveStudioStateToStorage(); ... });   // ~2342
paddingSlider?.addEventListener('input', () => { ...; saveStudioStateToStorage(); ... }); // ~2477
fgPicker?.addEventListener('input', () => { ...; saveStudioStateToStorage(); ... });      // ~2487
bgPicker?.addEventListener('input', () => { ...; saveStudioStateToStorage(); ... });      // ~2493
```

O color picker nativo dispara `input` dezenas de vezes por segundo. Em grade 16×16 com
subdivisão 4 são 4.096 células serializadas e gravadas a cada disparo, de forma síncrona.

### O que fazer

1. Em `core/state_persistence.js`, adicione um agendador **puro e testável**:

```js
function createSaveScheduler({ save, delayMs = 300, timers }) {
  // timers = { setTimeout, clearTimeout } injetáveis (teste usa fake timers)
  let handle = null;
  let pendingCount = 0;
  return {
    schedule() { pendingCount++; clearTimeout(handle); handle = setTimeout(() => { handle = null; pendingCount = 0; save(); }, delayMs); },
    flush()      { if (handle === null) return false; clearTimeout(handle); handle = null; pendingCount = 0; save(); return true; },
    cancel()     { clearTimeout(handle); handle = null; pendingCount = 0; },
    pending()    { return handle !== null; }
  };
}
```

2. Em `sketch.js`, crie **uma** instância e use-a:

```js
const saveScheduler = window.StatePersistence.createSaveScheduler({
  save: saveStudioStateToStorage,
  delayMs: 300
});
```

3. Substitua `saveStudioStateToStorage()` por `saveScheduler.schedule()` **somente** nos quatro
   handlers contínuos listados acima (e em qualquer outro `input`/`pointermove` que gravе estado).
4. `saveScheduler.flush()` em: `setActiveTool`, troca de escopo (clique e teclas `1`–`6`), troca de
   workspace, `btnSwapColors`, e `beforeunload`.
5. Mantenha `saveStudioStateToStorage()` como função síncrona — ela é o `save` do agendador e
   continua sendo chamada por ações estruturais (regenerar, aplicar supertile, undo/redo).
6. Remova o `clearTimeout(debouncedSaveTimer)` do início de `saveStudioStateToStorage()` e a
   variável `debouncedSaveTimer`: quem controla o timer agora é o agendador.

### Aceite

- `tests/test_save_scheduler.js` (novo), com fake timers, prova:
  - 50 chamadas a `schedule()` antes do delay → `save` chamado **1×**;
  - `flush()` com pedido pendente → **1** gravação imediata e `pending() === false`;
  - `flush()` sem nada pendente → **0** gravações e retorno `false`;
  - duas rajadas separadas por `flush()` → **2** gravações, não 1.
- Prova de runtime (Antigravity browser + CDP, como na rodada 2): instrumentar
  `localStorage.setItem`, arrastar `#paddingSlider` por ~2 s, contar gravações → **≤ 2**
  (uma no flush final). No baseline o número é da ordem de dezenas.
- Nenhum dos quatro handlers contínuos contém `saveStudioStateToStorage()` direto.
  Prova: `Select-String -Path sketch.js -Pattern 'saveStudioStateToStorage\(\)'` e conferir que
  as ocorrências restantes estão em ações estruturais, não em `addEventListener('input'`.
- `node tests/test_persistence_quota.js` e `test_history_limits.js` continuam verdes.

**Falha no baseline:** `createSaveScheduler` não existe (o teste lança `TypeError`), e a contagem
de gravações no slider é alta.

**Não faça:** debounce dentro de `saveStudioStateToStorage` (isso esconde o problema e quebra o
flush síncrono no `beforeunload`).

---

## 5. T2 — Chip de escopo dinâmico

### Problema

`index.html:567`:

```html
<span id="editScopeChip" class="prop-badge secondary">Livre • 1 célula</span>
```

`grep editScopeChip sketch.js` → **0 ocorrências**. O estado padrão é `canvas_center`
(`sketch.js:51`), então o app abre dizendo “Livre • 1 célula” com “Centro” selecionado. As
capturas de tela da rodada 2 mostram exatamente isso.

### O que fazer

1. Crie `core/ui_format.js` (novo, carregado depois de `mosaic_engine.js` e antes de `sketch.js`),
   exportando `window.UiFormat` e `module.exports`:

```js
const SCOPE_CHIP_LABELS = {
  canvas_center: (pat) => `Centro • 8 eixos`,
  orbit_sym:     (pat) => `Órbita • bloco+grade`,
  block_sym:     (pat) => `Bloco • 4 quadrantes`,
  all_blocks:    (pat) => `Todos • grade inteira`,
  single:        (pat) => `Livre • 1 célula`,
  same_tile:     (pat) => `Iguais • mesmo tile`
};

function formatScopeChip(scopeId, pattern) {
  const fn = SCOPE_CHIP_LABELS[scopeId];
  if (!fn) return '';
  const base = fn(pattern);
  // pincel multi-célula no escopo Iguais é bloqueado; sinalize no chip
  if (scopeId === 'same_tile' && pattern && (pattern.rows > 1 || pattern.cols > 1)) {
    return `${base} • pincel ${pattern.rows}×${pattern.cols}`;
  }
  return base;
}
```

2. Em `syncEditWorkspaceUI()` (onde hoje existe o bloco morto de `editScopeHint`), escreva:

```js
const chipEl = document.getElementById('editScopeChip');
if (chipEl) chipEl.textContent = window.UiFormat.formatScopeChip(StudioState.editScope, ensureSupertilePattern());
```

3. Remova o bloco morto `document.getElementById('editScopeHint')` e o literal do HTML — o chip
   começa vazio (`<span id="editScopeChip" class="prop-badge secondary"></span>`) para que um
   erro de wiring apareça como vazio, não como texto plausível.
4. Mantenha o `title` do chip explicando que ele reflete o escopo ativo.

### Aceite

- `tests/test_scope_chip.js` (novo): para os seis ids, o texto é exatamente o da tabela; id
  desconhecido devolve `''`; `same_tile` com padrão 2×2 devolve o sufixo.
- Prova de runtime: em `Editor`, pressionar `1`…`6` e ler `#editScopeChip.textContent` a cada
  troca — seis leituras, seis valores distintos, nenhum igual ao anterior.
- O chip nunca fica com texto de um escopo diferente do card ativo (`aria-pressed`/`.active`).

**Falha no baseline:** `formatScopeChip` não existe; e a leitura do chip devolve sempre
`Livre • 1 célula`.

---

## 6. T3 — Ajuda derivada do código (fim das duas verdades)

### Problema

`ui_info.js:32-37` (tópico `scopes`) numera:

| Popover diz | Código faz (`EDIT_SCOPES.shortcut`) |
|---|---|
| Livre (1) | 5 |
| No Bloco (2) | 3 |
| Órbita (3) | 2 |
| Todos os Blocos (4) | 4 ✔ |
| Centro do Canvas (5) | 1 |
| Mesmo Tile (6) | 6 ✔ |

Quatro teclas trocadas — e o `README.md` está correto. Quem segue a ajuda aperta `1` esperando
“Livre” e cai em “Centro do Canvas”. O mesmo erro está em `shortcuts` (`ui_info.js:127`).

### O que fazer

1. Em `ui_info.js`, **não** mantenha o texto dos escopos escrito à mão. Gere-o em `init()` a
   partir de `window.MosaicEngine.EDIT_SCOPES` (a fonte já existe e é a que o app usa):

```js
function buildScopeTopics() {
  const scopes = Object.values(window.MosaicEngine.EDIT_SCOPES)
    .sort((a, b) => Number(a.shortcut) - Number(b.shortcut));
  return scopes.map((s) => `${s.name} (${s.shortcut}): ${s.description}`);
}
```

2. `INFO_TOPICS.scopes.body` passa a ser recalculado no `init()` (ou vira um getter); o texto
   estático deve desaparecer do arquivo.
3. O bullet de `1`–`6` em `shortcuts` é gerado pela mesma lista (não escreva a ordem de novo).
4. Se `window.MosaicEngine` não estiver disponível, falhe visivelmente (`console.error` +
   tópico vazio) — não caia num texto fixo, que é como o erro nasceu.

### Aceite

- `tests/test_info_scopes_source.js` (novo): para cada um dos 6 escopos, o corpo de
  `INFO_TOPICS.scopes` contém `${name} (${shortcut})`; a ordem do array é `1..6`; se alguém
  trocar `EDIT_SCOPES[x].shortcut` no motor, o teste continua coerente (ele lê do motor).
- `tests/test_info_ui_state.js` continua verde (13 tópicos, títulos, bullets).
- Teste de regressão explícito: um caso que **falha** se `infoPopover` mostrar “Livre (1)” com
  `canvas_center.shortcut === '1'`. No baseline, falha.

---

## 7. T4 — Uma única chave de storage

### Problema

```js
sketch.js:148                  'tiling_stripes_studio_state_v2'   // o app usa esta
core/state_persistence.js:8    'tiling_stripes_studio_v2_state'   // os testes usam esta
```

O commit `17cde7b` introduziu a segunda. Consequência: `test_state_persistence.js` valida um
fluxo que o produto nunca executa — o mesmo defeito que a rodada 2 cobrou da rodada 1.

### O que fazer

1. A fonte única passa a ser `core/state_persistence.js`:

```js
const STORAGE_KEY_STUDIO_STATE = 'tiling_stripes_studio_state_v2'; // valor que os usuários já têm
```

2. `sketch.js` deixa de ter o literal e passa a ler
   `window.StatePersistence.STORAGE_KEY_STUDIO_STATE` (com fallback explícito e aviso no console
   se o módulo não carregou — não um literal silencioso).
3. `window.clearStudioStorage()` usa a mesma constante.
4. Nenhuma migração de chave é necessária (a chave antiga do módulo nunca foi gravada por
   ninguém em produção), mas **registre isso no README** para que a decisão não seja reaberta.

### Aceite

- `tests/test_storage_key.js` (novo): existe **um** literal `tiling_stripes_studio_` no código de
  produção (`sketch.js`, `core/*.js`, `ui_info.js`); o valor é o esperado; e um round-trip
  grava/restaura usando exatamente a constante que o app usa.
- `tests/test_state_persistence.js` passa a usar a mesma constante do app (importa do módulo e
  compara com o literal esperado, não com uma string solta).
- Busca no repositório: zero ocorrências de `tiling_stripes_studio_v2_state`.

**Falha no baseline:** o teste de unicidade encontra 2 literais divergentes.

---

## 8. T5 — Badge “D4 editado” coerente com o documento

### Problema

`resetD4BrokenState()` só é chamado em `regenerateMosaic` (`sketch.js:758`). Depois de desfazer
a pincelada que quebrou a simetria, o mosaico volta a ser D4 e o badge continua aceso. Hoje o
badge é um booleano grudento (`StudioState.d4Broken`), escrito e nunca lido, não um fato sobre o
mosaico.

### O que fazer

1. Em `core/mosaic_engine.js`, adicione uma verificação real e limitada:

```js
function isMosaicD4Invariant(mosaicData) {
  // para o modo efetivo (grid e bloco), todo g com g(r,c)=(r,c) deve ter g(tile)===tile
  // e toda célula deve ser o transformado do seu bloco-fonte
}
```

Use os helpers que já existem (`getAllowedTransformsForSymmetry`, `getCellStabilizer`,
`transformGridCoords`, `getTransformedTileId`). Reaproveite a lógica que já está provada em
`tests/test_d4_invariance.js` — mas no motor, não no teste.

2. `sketch.js`: o badge passa a refletir `!isMosaicD4Invariant(StudioState.mosaicData)`, chamado
   depois de pintar, depois de undo/redo, e uma vez no load. `#d4SymmetryWarning` continua sendo
   o aviso de interação (aparece na hora da pincelada) e pode ser dispensado; o **badge** é o
   estado persistente.
3. Remova `StudioState.d4Broken` se não sobrar leitor.

### Aceite

- `tests/test_d4_badge_state.js` (novo), com o motor real:
  - mosaico recém-gerado em `mandala_d4` → `isMosaicD4Invariant === true`;
  - aplicar com `applyStampPlacements` um tile assimétrico em célula de eixo → `false`;
  - restaurar o snapshot anterior com `restoreMosaicCellsSnapshot` → `true` (é o que o undo faz);
  - depois de `regenerateMosaic` → `true`.
- Prova de runtime: pintar quebrando D4 (badge acende) → `Ctrl+Z` → badge apaga sem regenerar.

**Falha no baseline:** a função não existe; e o badge não reage ao undo.

---

## 9. T6 — ARIA dos gatilhos de informação

### Problema

R1 exigia `aria-controls="infoPopover"` em cada gatilho. `grep aria-controls index.html` → **0**.
Há 9 gatilhos `[data-info-topic]`; o de `#blockSymmetryWarning` (`index.html:451`) nem tem
`aria-haspopup`/`aria-expanded`, enquanto os outros têm.

### O que fazer

1. Em todos os `[data-info-topic]`: `aria-haspopup="dialog"`, `aria-controls="infoPopover"`,
   `aria-expanded="false"` inicial.
2. `showPopover()` já alterna `aria-expanded`; garanta que `hidePopover()` volta a `false` e
   devolve o foco (hoje já devolve — confirme, não reescreva).
3. `#btnHelp` também aponta para `infoPopover`.
4. Não troque `role="dialog"` do popover nem adicione `aria-modal="true"` (ele não é modal).

### Aceite

- `tests/test_info_aria.js` (novo, estático — aqui substring é legítimo, é atributo estático):
  todo elemento com `data-info-topic` tem os três atributos; a contagem é ≥ 9.
- Prova de runtime: abrir com teclado (Tab até o `ⓘ`, Enter) → `aria-expanded="true"`; Escape →
  `false`, foco no gatilho, popover fechado.

**Falha no baseline:** zero `aria-controls`.

---

## 10. T7 — Versão do payload validada no load

### Problema

`buildStudioStatePayload` grava `version: 2`, e `loadStudioStateFromStorage` **nunca lê**
`version`. Um save de catálogo diferente é restaurado em silêncio — contrariando R8/T8
(“não restaure silenciosamente”).

### O que fazer

1. Defina `STORAGE_VERSION = 3` no módulo de persistência e grave-o.
2. No load, com a lógica em função pura (`core/state_persistence.js`), decida:
   - `version` ausente → tratar como legado, restaurar, **avisar** no `#persistenceWarning`
     (“Estado migrado de versão anterior”);
   - `version > STORAGE_VERSION` → **não restaurar**, copiar o payload para
     `..._backup_<timestamp>`, avisar o usuário via `#persistenceWarning` com ação de exportar;
   - `version <= STORAGE_VERSION` → restaurar normalmente.
3. `window.clearStudioStorage()` continua removendo apenas a chave principal (não os backups).

### Aceite

- `tests/test_payload_version.js` (novo, módulo puro): `version: 99` → `{ restore: false, backupKey }`;
  `version` ausente → `{ restore: true, warning: true }`; `version: 3` → `{ restore: true }`.
- O aviso é **persistente** (`#persistenceWarning`), não toast.

---

## 11. T8 — Documentação verdadeira

### Problema

- `docs/MANUAL_MANUTENCAO.md` descreve assinaturas que não existem:
  `saveWithQuotaFallback(storage, key, fullPayload, fallbackPayload)` (o 4º parâmetro real é
  `currentMosaic`) e `migratePayloadHistories(payload, maxGen, maxEdit)` (real:
  `(payload, currentMosaic)`).
- O manual cita o modo `kaleidoscope_permissive`, que não existe (o id é `kaleidoscope`).
- README (`:103`) e manual (`:119`) afirmam debounce de 300 ms — só passa a ser verdade depois
  de T1.

### O que fazer

1. Corrija as assinaturas e o id do modo.
2. Reescreva a seção de persistência **depois** de T1 e T4, descrevendo o que o código faz
   (agendador, flush, chave única, versão).
3. No `README.md`, acrescente a seção “Documentação” apontando para `docs/` e remova qualquer
   promessa que o código não cumpra.
4. Não edite `docs/instrucoes/*` nem `docs/relatorios/*`: são registro histórico. Correção de
   fato vai no documento vivo (README/manual) e no relatório desta rodada.

### Aceite

- `tests/test_docs_consistency.js` (novo): falha se aparecerem `kaleidoscope_permissive`,
  `tiling_stripes_studio_v2_state`, ou uma assinatura de função citada que não exista no módulo
  (checagem simples de nome + aridade a partir do `module.exports`).
- Um novo contribuidor consegue rodar app e testes seguindo só README + manual.

---

## 12. T9 — Remover o código morto

Remova, em commits separados e somente depois do P0 verde:

| Símbolo | Onde | Situação |
|---|---|---|
| `resolveEditScopeTargets` | `mosaic_engine.js:507` | definido + exportado, 0 chamadas |
| `applySubtileEdit` | `mosaic_engine.js:1195` | definido + exportado, 0 chamadas |
| `resolveStampBlockTargets` | `mosaic_engine.js:1186-1189` | stub que devolve `[]` |
| `getTransformedTileThumbDataURL` + `transformedThumbCache` | `sketch.js:1727`, `:94` | cadeia inteira sem uso |
| bloco `editScopeHint` | `sketch.js:2051-2055` | elemento não existe mais no HTML |
| `StudioState.d4Broken` | `sketch.js:78`, `:751`, `:1445` | escrito, nunca lido (ver T5) |

### Aceite

- `node tests/*.js` continua verde (as 10 suítes + as novas).
- Busca pelos nomes retorna 0 ocorrências (exceto no relatório histórico, que não se edita).
- `test_mosaic_engine.js` e `test_d4_invariance.js` continuam idênticos em resultados
  (168.960 checagens) — a remoção não alterou comportamento.

---

## 13. T10 — P2, só se sobrar tempo

1. `.github/workflows/tests.yml` passa a chamar `node tests/run_all.js` (novo runner que executa
   todas as suítes em ordem e sai com código 1 na primeira falha), mantendo a matriz Node 20/22.
2. Limpeza opcional de `sketch.js`: hoje são ~3.000 linhas e 93 consultas de DOM no mesmo arquivo.
   Extraia, no máximo, um módulo (`core/ui_state.js`) com as funções de sincronização de UI.
   Se isso exigir tocar em mais de 100 linhas, **não faça nesta rodada**: registre como dívida.

---

## 14. Estrutura de arquivos (regra permanente)

```
/                     index.html, sketch.js, style.css, ui_info.js, README.md, jsconfig.json, .gitignore
core/                 d4_symmetry.js, tile_registry.js, mosaic_engine.js, state_persistence.js, ui_format.js (novo)
tests/                test_*.js, screenshots/
docs/
├── README.md         índice da documentação
├── MANUAL_MANUTENCAO.md
├── instrucoes/       INSTRUCOES_GEMINI_38_FLASH.md, ..._RODADA2.md, ..._RODADA3.md
└── relatorios/       RELATORIO_*.md, AVALIACAO_*.md
_legacy/              não editar
libraries/            não editar
```

**Nada de `.md` solto na raiz além do `README.md`.** Documento novo desta rodada vai em
`docs/relatorios/RELATORIO_RODADA3.md`. Se criar screenshot, ele vai para `tests/screenshots/`.

---

## 15. Roteiro de validação (browser)

Servidor local (`python -m http.server 8765`), 1440×900 e 1280×800, storage limpo antes de cada
cenário (`window.clearStudioStorage(); location.reload();`).

**A — Chip e escopo.** Abrir Editor: chip deve dizer `Centro • 8 eixos`. Percorrer `1`…`6`: chip
muda nas seis, nunca repete o anterior, e nunca mostra “Livre” com “Centro” ativo.

**B — Save.** Com DevTools, instrumentar `localStorage.setItem`; arrastar o slider de padding por
2 s; contar chamadas (≤ 2). Trocar de ferramenta → flush imediato (1 gravação).

**C — Help.** Abrir `?` e o `ⓘ` de escopos: a lista deve ter `Centro do Canvas (1)`, `Órbita (2)`,
`Dentro do Supertile (3)`, `Todos os Supertiles (4)`, `Livre (5)`, `Mesmo Tile (6)`.

**D — D4.** Pintar tile assimétrico em eixo no modo Mandala: aviso + badge. `Ctrl+Z`: badge apaga.
Regenerar: badge apaga.

**E — Acessibilidade.** Tab até um `ⓘ`, Enter abre, Escape fecha e devolve o foco.

**F — Persistência.** Editar, recarregar, conferir desenho e undo/redo; simular `version: 99` no
storage e conferir que o app **não** restaura e avisa.

---

## 16. Critérios de aceite finais (marque só o que provou)

- [ ] T1: agendador testado com fake timers; contagem de gravações no slider ≤ 2 em runtime.
- [ ] T2: chip muda nos seis escopos (teste + runtime).
- [ ] T3: ajuda gerada de `EDIT_SCOPES`; nenhum texto de escopo escrito à mão.
- [ ] T4: um único literal de chave no código de produção.
- [ ] T5: badge reflete invariância real e reage a undo.
- [ ] T6: `aria-controls` em todos os gatilhos; teclado abre/fecha.
- [ ] T7: versão validada; payload futuro não é restaurado.
- [ ] T8: manual sem assinaturas falsas; README sem promessa não cumprida.
- [ ] T9: código morto removido sem alterar resultados de teste.
- [ ] Cada teste novo falhou no baseline `565be96` (saída colada no relatório).
- [ ] 10 suítes antigas + novas verdes; nenhum erro no console.
- [ ] Nenhum `.md` novo na raiz.

---

## 17. Formato da resposta final

Em português, objetivamente:

1. **Resumo** por tarefa: `feito` / `não feito` / `feito com ressalva` (uma linha).
2. **Tabela de prova**: tarefa → teste novo → saída no baseline (falha) → saída no HEAD (passa).
3. **Arquivos alterados** (lista com caminho relativo).
4. **Screenshots** novas, com resolução, geradas depois do último commit.
5. **O que não foi feito** e por quê.
6. **`git diff --stat`**.

Não escreva “concluído”, “100%” ou “validado” em nenhuma linha. Se T1–T4 não estiverem com prova
no baseline, diga explicitamente: **“não está pronto para release”**.

---

## 18. O que não fazer

- Não adicionar recurso novo de produto (modo, ferramenta, exportação).
- Não trocar a stack, não introduzir bundler nem dependência npm.
- Não alterar IDs de tile, `TILE_D4_MAP` ou o fallback `#84`.
- Não reescrever o motor D4: ele está correto e provado por 168.960 asserções.
- Não “consertar” o chip com texto no HTML; ele precisa vir do estado.
- Não duplicar o texto dos escopos em dois lugares — é a causa raiz do erro de numeração.
- Não esconder falha de save com `console.warn` nem com debounce que engole erro.
- Não editar `docs/instrucoes/` e `docs/relatorios/` antigos.
- Não declarar tarefa concluída com teste que passa no baseline.

---

## 19. Critério de escalação

Se uma correção exigir mudança de contrato que afete o produto (por exemplo, migrar a chave de
storage de usuários reais), **pare e reporte**: o que tentou, o comportamento observado, duas
opções com trade-off e uma recomendação. Um P0 declaradamente pendente é melhor que um app que
perde o save de quem já usa.

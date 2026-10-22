# Instruções — Rodada 4.2: Segurança do documento (1 + 3 + 4)

**Destinatário:** Gemini 3.8 Flash, no Antigravity
**Repositório:** raiz deste projeto
**Branch:** `develop`
**Estado de referência:** o commit que fechar a Rodada 4.1 (T1–T6). **Anote o hash aqui antes de começar.**
**Origem:** decisão do usuário sobre as 8 soluções propostas — combinação **1 + 3 + 4**.

**Objetivo:** impedir que qualquer ação do Gerador apague o mosaico editado, e dar ao usuário uma
volta atrás confiável. Três camadas: **(1)** consertar o snapshot que hoje é um no-op, **(3)** avisar
quando há edições em risco, **(4)** fazer `Ctrl+Z` atravessar a geração.

> Esta rodada não muda layout nem adiciona recurso de catálogo. O alvo é um só: **o mosaico editado
> nunca desaparece sem volta.**

---

## 1. O defeito

`regenerateMosaic()` (chamada por ~15 caminhos: paleta de tiles, seed, grade, simetria, artboard)
substitui `StudioState.mosaicData` na linha 834 e zera o histórico de edição na 861. Só depois,
`pushGenerationHistory()` tenta salvar a entrada anterior:

```js
// sketch.js:874-885 — hoje
function pushGenerationHistory() {
  if (StudioState.historyIndex >= 0 && ...) {
    const prevEntry = StudioState.history[StudioState.historyIndex];
    window.HistoryNav.saveLazyHistorySnapshot(
      prevEntry,
      StudioState.mosaicData,        // ← já é o mosaico NOVO
      StudioState.frozenCells,
      StudioState.editHistoryIndex,  // ← já é 0
      StudioState.editHistory
    );
  }
```

E `saveLazyHistorySnapshot` começa com `if (!historyEntry || editHistoryIndex <= 0 || !mosaicData) return false;`.
Portanto: **o backup nunca acontece**. Clicar num tile da biblioteca (`sketch.js:1147-1148`) destrói a
edição e não deixa rastro.

---

## 2. Tarefas

### T1 — Snapshot antes da geração (correção de ordem)

**O que fazer**

1. Em `core/history_nav.js`, adicione uma função explícita de captura, separada da navegação:

```js
function captureBeforeRegeneration({ history, historyIndex, mosaicData, frozenCells, editHistory, editHistoryIndex }) {
  // devolve { captured: boolean, entryIndex }
  // captura SOMENTE se a entrada atual estiver suja e ainda não tiver snapshot
}
```

2. Em `regenerateMosaic()`, chame `captureBeforeRegeneration(...)` **como primeira instrução**, antes
   de `generateMosaicWithFrozen` e antes de `resetEditHistoryWithInitialSnapshot()`.
3. Remova a chamada tardia de `saveLazyHistorySnapshot` de dentro de `pushGenerationHistory()`. Ela
   não tem mais razão de existir: quem captura é o início da geração.
4. `restoreGenerationHistory()` continua usando `saveLazyHistorySnapshot` antes de sair da entrada —
   são dois pontos de captura legítimos (navegação e geração), ambos **antes** da troca de estado.

**Aceite**

- `tests/test_regeneration_capture.js` (novo): monta histórico com entrada suja (3 células editadas),
  chama `captureBeforeRegeneration`, regenera e depois `planRestore(entrada)` → `restore_snapshot`
  com as 3 células.
- `tests/test_regeneration_order.js` (novo, contrato sobre `sketch.js`): a chamada de captura aparece
  **antes** de `generateMosaicWithFrozen` no corpo de `regenerateMosaic`.
- No app: editar 3 células → clicar num tile da biblioteca → ◀ → as 3 células voltam.
- **Falha no baseline:** a entrada anterior não tem `cellsSnapshot`.

### T2 — Aviso quando há edições em risco (3)

**O que fazer**

1. Defina o estado sujo em um lugar só:

```js
function isDocumentDirty(state) {
  return state.editHistoryIndex > 0 || (state.frozenCells && state.frozenCells.size > 0);
}
```

2. Antes de qualquer regeneração disparada por **parâmetro** (paleta, seed, grade, simetria,
   artboard), se `isDocumentDirty()`, abra um diálogo modal `#dirtyGuardDialog` (`role="dialog"`,
   `aria-modal="true"`, foco no botão de cancelar):

```
Este mosaico tem 12 edições.
Elas vão para o histórico e podem ser recuperadas com Ctrl+Z.

[ Cancelar ]   [ Gerar mesmo assim ]
☐ Não perguntar nesta sessão
```

3. “Cancelar” restaura o parâmetro que o usuário acabou de mexer (ex.: desfaz o toggle do tile) e
   mantém o mosaico intacto. Isso exige aplicar o parâmetro **depois** da confirmação — inverta a
   ordem nos handlers: primeiro pergunta, depois altera `StudioState` e regenera.
4. “Não perguntar nesta sessão” vale só para a sessão (não persiste no payload).
5. O botão **Gerar** (`#btnRandomize`) e o atalho `G` **não** abrem o diálogo: são intenção explícita
   de gerar. O aviso é para ações acessórias que arrastam uma regeneração sem o usuário pedir.

**Aceite**

- Com 0 edições, trocar um tile regenera direto, sem diálogo.
- Com edições, trocar um tile abre o diálogo; “Cancelar” mantém mosaico **e** a paleta anterior.
- “Gerar” com edições continua regenerando direto (por desenho).
- O diálogo é fechável por `Esc` (equivale a Cancelar) e devolve o foco ao gatilho.

### T3 — `Ctrl+Z` atravessa a geração (4)

**O que fazer**

1. O snapshot de edição passa a ser um **snapshot de documento**, não só de células:

```js
{ cells, frozen, rows, cols, subdivision, seed,
  gridSymmetryMode, blockSymmetryMode, syncBlockSymmetry,
  allowedTiles, margin, paddingRatio }
```

2. Antes de uma regeneração destrutiva (mesmo quando o usuário confirma “Gerar mesmo assim”), faça
   `pushDocumentSnapshot()` — entra na mesma pilha do `Ctrl+Z`.
3. `undoMosaicEdit()` / `redoMosaicEdit()` restauram o documento inteiro: células, congelamento e
   parâmetros; depois chamam `syncAllInputsFromState()`, `syncEditWorkspaceUI()`,
   `renderSwatchesPanel()` e `redraw()`.
4. Limite o custo: snapshots de documento contam no mesmo orçamento de bytes de
   `state_persistence.js`; acima de ~3,2 MB, descarte os mais antigos **com aviso**.

**Aceite**

- Editar → trocar a paleta → `Ctrl+Z` devolve o mosaico editado **e** a paleta anterior.
- `Ctrl+Y` refaz a troca.
- O undo de uma pincelada comum continua funcionando (mesma pilha, sem regressão).
- `test_document_undo.js` (novo): snapshot de documento restaura os 7 campos acima.

### T4 — Provas e documentação

- `tests/run_all.js` passa de 24 para **27** suítes (T1: 2, T2: 1, T3: 1 — nomeie como preferir, mas
  registre no runner).
- Todas as suítes novas precisam falhar no commit da 4.1 (cole a saída).
- `docs/MANUAL_MANUTENCAO.md`: documente as três camadas (captura antes de gerar, confirmação,
  undo de documento) e o conceito de “documento sujo”.
- Nada de novo em `README` que o código não cumpra.

---

## 3. Regras

- Não espalhe a captura pelos 15 call sites de `regenerateMosaic` — o ponto é um só, no início dele.
- Não use `confirm()` nativo: o diálogo precisa de “não perguntar nesta sessão” e de foco acessível.
- Não suba `STORAGE_VERSION` (campos são aditivos ao payload).
- Não altere o comportamento do botão Gerar / tecla `G`.
- Um commit por tarefa (T1…T4).

---

## 4. Roteiro de validação

1. Limpar storage. Editar 3 células. Clicar num tile da biblioteca → diálogo. Cancelar → mosaico e
   paleta intactos.
2. Repetir confirmando → mosaico novo. `Ctrl+Z` → mosaico editado volta, com a paleta anterior.
3. Editar, apertar `G` → regenera direto (sem diálogo), mas `Ctrl+Z` devolve o editado.
4. Editar, navegar ◀ ▶ → edição preservada (4.1 continua valendo).
5. Sem edições: trocar tile, seed e simetria não abre diálogo nenhum.

---

## 5. Critérios de aceite finais

- [ ] T1: entrada anterior recebe snapshot antes da geração (teste de ordem + teste de conteúdo).
- [ ] T2: diálogo só com documento sujo; Cancelar reverte o parâmetro; “Gerar” não pergunta.
- [ ] T3: `Ctrl+Z` restaura células + congelamento + parâmetros.
- [ ] Orçamento de snapshots respeitado com aviso, nunca descarte silencioso.
- [ ] 27 suítes verdes; cada nova falhou no baseline (saída colada).
- [ ] Manual atualizado.

---

## 6. Formato da resposta final

1. Tabela tarefa → status.
2. Prova: teste novo → saída no baseline (falha) → saída no HEAD (passa).
3. Roteiro de validação executado, com o resultado de cada passo.
4. `git diff --stat`.

---

## 7. O que não fazer

- Não resolver o #1 “salvando o mosaico atual num campo novo do payload” — o histórico é o lugar.
- Não colocar o diálogo em ações contínuas (slider de margem/padding). Se o slider regenera, ele
  entra na lista de “confirma só ao soltar”, não a cada `input`.
- Não criar um segundo histórico só para geração: a pilha de documento é uma.
- Não deixar o “não perguntar” persistir entre sessões — é o começo da perda silenciosa de novo.

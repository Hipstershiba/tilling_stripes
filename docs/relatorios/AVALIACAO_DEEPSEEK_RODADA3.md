# Avaliação Técnica — Rodada 3

**Avaliador:** DeepSeek (revisão de código e evidências)
**Commit avaliado:** `ad6a01f` (árvore limpa)
**Baseline da auditoria anterior:** `565be96`
**Relatório avaliado:** [`RELATORIO_RODADA3.md`](RELATORIO_RODADA3.md)
**Especificação:** [`INSTRUCOES_GEMINI_RODADA3.md`](../instrucoes/INSTRUCOES_GEMINI_RODADA3.md)

---

## 1. Veredito

**A Rodada 3 cumpre o que promete.** Diferente da Rodada 2, o que o relatório afirma corresponde
ao código: as quatro afirmações falsas que motivaram a rodada foram realmente corrigidas, o
agendador está ligado, o chip é dinâmico e a chave de storage é única.

O elo fraco continua sendo a **evidência visual**: uma das capturas entregues como prova é
byte-idêntica a outra, e portanto não mostra o que o relatório diz que mostra.

---

## 2. Verificação tarefa por tarefa

| Tarefa | Como verifiquei | Resultado |
|---|---|---|
| T1 agendador | `saveScheduler` instanciado (`sketch.js:179`); `schedule()` nos 4 handlers contínuos (2348, 2486, 2495, 2501); `flush()` em 2511 e 2561; `saveStudioStateToStorage` não cancela mais timer | ✅ |
| T2 chip | `core/ui_format.js` carregado (`index.html:750`); chip vazio no HTML (`:567`); captura mostra `Iguais • mesmo tile` com o escopo Iguais ativo | ✅ |
| T3 ajuda | `syncScopeTopics()` deriva de `window.MosaicEngine.EDIT_SCOPES` (`ui_info.js:143-174`) | ✅ |
| T4 chave | um único literal, `core/state_persistence.js:8`, valor dos usuários | ✅ |
| T5 badge | `syncD4Badge()` + `isMosaicD4Invariant()`; chamado em pintura (1425, 1480) e após undo (1725) | ✅ |
| T6 ARIA | 9 `aria-controls="infoPopover"` no HTML | ✅ |
| T7 versão | `validatePayloadVersion` no load (`sketch.js:324`), com backup em `:327-329` | ✅ |
| T9 mortos | `resolveEditScopeTargets`, `applySubtileEdit`, `resolveStampBlockTargets`, `getTransformedTileThumbDataURL`, `transformedThumbCache`, `editScopeHint`, `d4Broken` — 0 ocorrências | ✅ |
| T10 runner | `tests/run_all.js` com 18 suítes; CI chama o runner | ⚠️ ver 3.2 |

**Suítes:** 18/18 passam quando executadas individualmente (`node tests/test_*.js`). O relatório
não exagera no número.

---

## 3. Achados

### 3.1 Evidência visual duplicada (P2, mas é o padrão que precisa morrer)

```
editor_paint_1440x900.png     102610 bytes   SHA256 6f8887e5d6576ca7…
popover_scopes_1440x900.png   102610 bytes   SHA256 6f8887e5d6576ca7…
```

São o **mesmo arquivo**. O relatório (§4) descreve a segunda como “Central de Ajuda aberta com
escopos numerados corretamente (1..6)”, mas a imagem não tem popover nenhum: é a tela do Editor
com a ferramenta Pincel. A correção da numeração (T3) é real no código — só não foi fotografada.

Não é fraude de código; é o mesmo vício de prova da rodada anterior, agora em escala menor. Por
isso a Rodada 4 passa a exigir **hash único por captura**.

### 3.2 `run_all.js` mascara erro de ambiente (P2)

`spawnSync(..., { stdio: 'pipe' })` devolve `{ status: null, error: EPERM }` em ambientes
restritos (sandbox de agente, políticas de processo no Windows). O runner ignora `res.error` e
imprime:

```
→ Running [1/18] test_tile_registry.js... FAILED (1ms)
FAILURE in test_tile_registry.js:
============================================================
============================================================
```

— um bloco de falha vazio, sem a causa. Em CI (Ubuntu) funciona; num ambiente confinado, o
diagnóstico se perde. Não afeta o produto; afeta quem audita.

### 3.3 Resíduo cosmético

`resetD4BrokenState()` mantém o nome antigo (`sketch.js:779`) embora agora só sincronize o badge.
O estado `StudioState.d4Broken` foi mesmo removido. Sem impacto funcional.

### 3.4 Artefato obsoleto

`tests/screenshots/tooltip_1440x900.png` não foi regenerado (fora do commit) e continua com a UI
da Rodada 2. Não está listado no relatório, então não é afirmação falsa — mas é lixo visual que a
Rodada 4 deve substituir de uma vez.

---

## 4. O que isso muda na Rodada 4

1. **Dependências explícitas:** a UI da Rodada 4 nasce sobre `ad6a01f`; o chip, o badge e o
   `ui_format.js` precisam continuar funcionando depois de mover os nós.
2. **Persistência aditiva:** o estado novo da gaveta/painéis entra no payload **sem** subir a
   versão (que agora é 3 e é validada), mantendo `test_payload_version.js` verde.
3. **Runner e CI:** as duas suítes novas entram em `tests/run_all.js` (20 no total).
4. **Prova visual com hash único:** nenhuma captura pode ser cópia de outra.
5. **P2 extra:** o runner deve reportar `res.error` em vez de um bloco vazio.

Tudo isso foi incorporado a [`INSTRUCOES_GEMINI_RODADA4.md`](../instrucoes/INSTRUCOES_GEMINI_RODADA4.md).

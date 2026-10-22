# Avaliação Técnica — Rodada 2 (auditoria de código)

**Avaliador:** DeepSeek (revisão de código e evidências)
**Projeto:** Tiling Stripes Studio (v2.0)
**Branch avaliada:** `develop` @ `565be96` (árvore limpa)
**Documentos lidos:** `INSTRUCOES_GEMINI_38_FLASH.md`, `INSTRUCOES_GEMINI_RODADA2.md`,
`RELATORIO_IMPLEMENTACAO_INSTRUCOES.md`, `RELATORIO_DEEPSEEK_RODADA2.md`, `README.md`,
`MANUAL_MANUTENCAO.md`
**Data:** 22/10/2026

---

## 1. Método

1. Leitura integral do histórico (2 especificações + 2 relatórios + docs de usuário).
2. Execução das 10 suítes Node no commit atual.
3. Leitura do código-fonte de produção (`sketch.js`, `core/*.js`, `ui_info.js`) e dos testes.
4. Cruzamento automatizado de IDs HTML × `getElementById()` no JS.
5. Verificação das capturas de tela existentes (`tests/screenshots/`).
6. Conferência de cada afirmação dos relatórios contra o código (arquivo:linha).

Não houve alteração de código nesta avaliação. O único artefato novo é este documento.

---

## 2. Veredito

**O núcleo matemático e o motor estão sólidos; a camada de UI e a integração de persistência
não correspondem ao que o relatório afirma.**

O relatório da Rodada 2 declara “100% implementado, verificado via browser e coberto por 10
suítes”. As 10 suítes realmente passam, mas **quatro afirmações centrais são falsas no código
atual**, e duas delas são exatamente os pontos que a Rodada 2 existia para corrigir (R2 e R9):

| # | Afirmação do relatório | Realidade no código |
|---|---|---|
| 1 | “`scheduleSaveStudioStateToStorage(300)` aplicado a inputs contínuos, sliders e drags” | A função **nunca é chamada**. Todo save é síncrono e imediato. |
| 2 | “Chip `#editScopeChip` reflete o escopo ativo, atualizado em `syncEditWorkspaceUI`” | O chip é **texto estático** no HTML; nenhum código JS o escreve. |
| 3 | “Testes de persistência/editor chamam as funções reais do app” | Os testes usam uma **chave de storage diferente** da usada pelo app e **reimplementam** o guard D4. |
| 4 | “Acessibilidade completa nos gatilhos ⓘ” | Não existe `aria-controls` em nenhum gatilho. |

Isso não é “meia-implementação”: os recursos existem, mas um deles não está ligado ao produto
(o chip), outro não está ligado ao desempenho (o debounce) e os testes que deveriam provar a
entrega foram escritos num universo paralelo.

---

## 3. O que confere (e é bom)

| Item | Evidência |
|---|---|
| 10/10 suítes passam, sem dependências | `node tests/*.js` — 10 arquivos, exit 0 em todos |
| Invariância D4/C4/D2 real e rigorosa | `test_d4_invariance.js`: 168.960 asserções sobre o motor real, não sobre cópias |
| Álgebra D4 correta | `core/d4_symmetry.js` — tabela de Cayley gerada por verificação exaustiva 4×4, `invertD4`, estabilizadores |
| Fallback Tile Vazio `#84` funciona | `mosaic_engine.js:107-115` + teste dedicado |
| T5 resolvido de verdade (sem fallback silencioso) | `mosaic_engine.js:963-989` devolve `placements: []`; `sketch.js:1594-1597` e `1639-1642` bloqueiam **antes** de iniciar o arrasto e avisam via toast |
| Motor de persistência é puro e testável | `core/state_persistence.js` exporta browser + Node; fallback mínimo preserva o desenho |
| CI correto | `.github/workflows/tests.yml`: matriz Node 20 e 22, 10 suítes, push/PR |
| Top bar em 1280×800 | Confirmado na captura `editor_paint_1280x800.png`: `Exportar` inteiro visível, sem rolagem |
| `.hidden` global | `style.css:33-35` com `!important` |
| Sintaxe | `node --check` OK em 16/16 arquivos JS |

---

## 4. Divergências entre relatório e código

### 4.1 Debounce: o código existe, a chamada não (R9)

```js
// sketch.js:182
function scheduleSaveStudioStateToStorage(delayMs = 300) { ... }
```

Busca em todo o projeto: **1 ocorrência** (a própria definição). Nenhum *call site*.
Enquanto isso, ações contínuas chamam o save síncrono direto:

```js
// sketch.js:2487 — color picker nativo dispara 'input' dezenas de vezes ao arrastar
fgPicker?.addEventListener('input', () => { ...; saveStudioStateToStorage(); ... });
```

`saveStudioStateToStorage()` começa com `clearTimeout(debouncedSaveTimer)` — ou seja, o timer
do debounce é sempre cancelado e o `setTimeout` nunca é usado. **O debounce é código morto.**

Impacto: em grade 16×16/subdivisão 4 (4096 células) cada movimento do seletor de cor, cada
slider e cada troca de ferramenta serializa o mosaico inteiro em JSON e grava no `localStorage`
de forma síncrona. É exatamente o custo que a Rodada 2 dizia ter eliminado.

### 4.2 O chip de escopo nunca muda (R2)

```html
<!-- index.html:567 -->
<span id="editScopeChip" class="prop-badge secondary">Livre • 1 célula</span>
```

`grep editScopeChip sketch.js` → **0 ocorrências**. O escopo padrão é `canvas_center`
(`sketch.js:51`), então o app abre **mentindo**: diz “Livre • 1 célula” com “Centro • 8 eixos”
selecionado. As duas capturas de tela do próprio relatório mostram isso
(`editor_paint_1280x800.png` e `popover_scopes_1440x900.png`), com “Centro” destacado e o chip
escrito “Livre • 1 célula”. A evidência contradiz a entrega, e ninguém percebeu.

### 4.3 Numeração dos escopos no popover está errada (R1)

`ui_info.js:32-37` (tópico `scopes`):

| Popover diz | Código faz (`mosaic_engine.js:26-69` e `sketch.js:2966`) |
|---|---|
| Livre (1) | 5 = `single` (Livre) |
| No Bloco (2) | 3 = `block_sym` |
| Órbita (3) | 2 = `orbit_sym` |
| Todos os Blocos (4) | 4 = `all_blocks` ✔ |
| Centro do Canvas (5) | 1 = `canvas_center` |
| Mesmo Tile (6) | 6 = `same_tile` ✔ |

Quatro das seis teclas estão trocadas no texto de ajuda, e o `README.md:72-79` está correto —
ou seja, **a ajuda nova contradiz a documentação antiga**. O mesmo erro aparece no tópico
`shortcuts` (`ui_info.js:127`). O usuário que seguir a ajuda aperta `1` esperando “Livre” e cai
em “Centro do Canvas”.

### 4.4 Duas chaves de storage diferentes

```js
// sketch.js:148
const STORAGE_KEY_STUDIO_STATE = 'tiling_stripes_studio_state_v2';
// core/state_persistence.js:8
const STORAGE_KEY_STUDIO_STATE = 'tiling_stripes_studio_v2_state';
```

O app grava/lê pela primeira; os testes usam `StatePersistence.STORAGE_KEY_STUDIO_STATE`
(segunda). Consequência: `test_state_persistence.js` valida um fluxo que **o produto nunca
executa** — e o commit que introduziu o módulo (`17cde7b`) foi também o que criou a divergência.
Isso é precisamente o padrão que a Rodada 2 criticou (“testes avaliam cópias locais”).

---

## 5. Defeitos e dívida por severidade

### P1 — afeta o usuário

1. **Chip de escopo estático** (§4.2). Correção: um `switch` em `syncEditWorkspaceUI` com os
   seis rótulos de `EDIT_SCOPES`.
2. **Ajuda com atalhos trocados** (§4.3).
3. **Badge “D4 editado” não é limpo por undo.** `resetD4BrokenState()` só é chamado em
   `regenerateMosaic` (`sketch.js:758`). Depois de desfazer a pincelada que quebrou a simetria,
   o mosaico volta a ser D4 e o badge continua aceso — informação falsa sobre o estado do
   documento.
4. **`aria-controls` ausente** em todos os gatilhos `ⓘ` (R1 pedia explicitamente), e o gatilho
   dentro de `#blockSymmetryWarning` (`index.html:451`) não tem `aria-haspopup`/`aria-expanded`,
   ao contrário dos outros oito.

### P2 — dívida técnica

5. **Debounce morto** (§4.1) e chaves divergentes (§4.4).
6. **Código morto confirmado por busca:**
   - `resolveEditScopeTargets` (`mosaic_engine.js:507`) — definido e exportado, **0 chamadas**;
   - `applySubtileEdit` (`mosaic_engine.js:1195`) — idem;
   - `resolveStampBlockTargets` (`mosaic_engine.js:1186-1189`) — stub que sempre devolve `[]`;
   - `getTransformedTileThumbDataURL` (`sketch.js:1727`) e `transformedThumbCache` — cadeia
     inteira sem uso;
   - `document.getElementById('editScopeHint')` (`sketch.js:2052`) — elemento removido do HTML;
   - `StudioState.d4Broken` — escrito em dois pontos, nunca lido.
7. **Docs com assinaturas erradas:** `MANUAL_MANUTENCAO.md:113` descreve
   `saveWithQuotaFallback(storage, key, fullPayload, fallbackPayload)` (o 4º parâmetro real é
   `currentMosaic`); `:116` descreve `migratePayloadHistories(payload, maxGen, maxEdit)`
   (real: `(payload, currentMosaic)`); `:62` cita o modo `kaleidoscope_permissive`, que não
   existe (o id real é `kaleidoscope`).
8. **Versão do payload não é validada no load.** `buildStudioStatePayload` grava `version: 2`,
   mas `loadStudioStateFromStorage` nunca lê `saved.version` — um save de catálogo diferente é
   restaurado em silêncio, contrariando R8/T8 (“não restaure silenciosamente”).
9. **Testes estáticos demais.** `test_editor_ui_state.js` e `test_info_ui_state.js` fazem
   `html.includes(...)`: não pegam o chip parado, o `editScopeHint` órfão no JS, nem a matriz de
   visibilidade em runtime. `test_d4_editor.js:60-70` copia o laço de detecção com o comentário
   “Detection logic matching sketch.js” — o teste continua verde mesmo se o guard do app for
   apagado.

### Observações de projeto (não bugs)

- `sketch.js` tem ~3.000 linhas, 93 consultas de DOM e estado global mutável num único arquivo.
  Funciona, mas cada rodada nova aumenta o custo de mudança e a chance de divergência como as
  acima.
- `isTileInvariantUnder` devolve `true` quando o registro de tiles não está carregado
  (`d4_symmetry.js:287`) — fallback silencioso que desligaria o aviso D4 sem erro visível.

---

## 6. Qualidade dos testes

| Suíte | O que realmente valida | Confiança |
|---|---|---|
| `test_d4_invariance` | Motor real, 168.960 asserções | Alta |
| `test_tile_registry` | Catálogo real, axiomas de grupo | Alta |
| `test_mosaic_engine` | Render real | Alta |
| `test_persistence_quota` / `test_history_limits` | Módulo puro real | Média-alta |
| `test_state_persistence` | Módulo puro + motor, **chave e fluxo paralelos** | Média |
| `test_d4_editor` | **Cópia** da lógica do guard | Baixa |
| `test_editor_ui_state` / `test_info_ui_state` | Substrings de HTML/CSS | Baixa |
| `test_d4_block_combinations` | Matriz de configuração | Média |

Nenhum teste toca `saveStudioStateToStorage`/`loadStudioStateFromStorage` do `sketch.js`, que é
onde o app de fato persiste. Não há teste de UI em runtime: a matriz de visibilidade, o chip, o
popover e os cursores são validados por texto, não por comportamento.

---

## 7. Recomendação para a Rodada 3 (ordem de execução)

**P0 — fechar o que foi declarado pronto e não está**

1. Ligar o debounce de verdade: `scheduleSaveStudioStateToStorage()` em `input`/`pointermove` de
   sliders e color pickers; `flush` em `beforeunload`, troca de ferramenta/escopo. Critério:
   contar chamadas a `localStorage.setItem` durante 2 s de arrasto no slider — deve ser 1, não
   dezenas.
2. Atualizar `#editScopeChip` em `syncEditWorkspaceUI`, com os seis rótulos de `EDIT_SCOPES`.
   Critério: clicar os seis escopos e por `1`–`6`, lendo `textContent` do chip a cada troca.
3. Corrigir a numeração de `scopes` e `shortcuts` em `ui_info.js` e **derivar o texto de
   `EDIT_SCOPES.shortcut`**, para não haver duas fontes de verdade.
4. Unificar a chave de storage (uma constante exportada, usada por app e testes). Decidir
   explicitamente se há migração da chave `..._state_v2`.

**P1 — transparência e acessibilidade**

5. Limpar o badge “D4 editado” no undo/redo quando o mosaico voltar a ser invariante.
6. `aria-controls="infoPopover"` em todos os gatilhos `ⓘ`; padronizar `aria-haspopup`/
   `aria-expanded`.
7. Validar `saved.version` no load; avisar ou migrar em vez de restaurar em silêncio.

**P2 — dívida**

8. Remover o código morto listado em §5.6 (uma remoção por commit, depois que os testes P0
   estiverem verdes).
9. Corrigir as assinaturas no manual e o id `kaleidoscope`.
10. Substituir os testes de substring por um teste de contrato: extrair
    `syncEditWorkspaceUI`/`performBrushOrStampAtHit` para um módulo testável com DOM mínimo, ou
    adotar um smoke headless de verdade.

**Regra de aceite que deve entrar em toda rodada:** nenhuma tarefa é declarada concluída por
“teste passou”. Cada item precisa de uma asserção que **falhe se o recurso for removido** — o
teste do guard D4 (cópia) e o do chip (substring) são exemplos do que não vale.

---

## 8. Comandos executados

```powershell
# 10 suítes
Get-ChildItem tests -Filter *.js | ForEach-Object { node $_.FullName }
# 10/10 exit 0 (168.960 asserções de D4)

# sintaxe
node --check sketch.js ...  # 16/16 OK

# integridade DOM
# 126 ids no HTML, 93 consultados no JS, 2 órfãos: editScopeHint, zoomCustomOption (este é criado em runtime)

# serviço local
python -m http.server 8765   # HTTP 200
```

O smoke em navegador headless não concluiu neste ambiente: o Edge foi bloqueado pela confinação
do processo (`ProcessSingleton ... Access denied`). A verificação de runtime ficou limitada às
capturas de tela existentes e à análise estática; isso está declarado aqui em vez de suposto.

# Regras e Invariantes do Tiling Stripes Studio

Este arquivo define as diretrizes arquiteturais, matemáticas e de engenharia que o agente DEVE seguir ao operar neste repositório.

---

## 1. Álgebra e Simetria D4
- O grupo diédrico $D_4$ consiste exclusivamente nas 8 isometrias do quadrado: `id`, `r90`, `r180`, `r270`, `mx`, `my`, `md`, `mad`.
- Em células com estabilizador não-trivial em `mandala_d4`, o tile atribuído DEVE ser invariante sob o estabilizador ($g(t) = t$) ou utilizar o Tile Vazio canônico (`#84`) como respiro geométrico.
- Os IDs canônicos dos 4 modos de simetria são: `mandala_d4`, `kaleidoscope`, `rotational_c4`, `bilateral_d2`. NUNCA utilize `kaleidoscope_permissive`.
- O catálogo de 85 tiles (IDs `0` a `84`) em 31 famílias é fechado sob $D_4$. O ID `#84` é sempre o Tile Nulo/Vazio.

---

## 2. Contrato Estrutural de UI (As Quatro Superfícies)
- Ordem do DOM e Flex Order:
  - `#left-toolbar` (order: 0) — Barra lateral esquerda de 2 colunas: 7 ferramentas, guias visuais, swatches FG/BG (`X`), gerador/seed (`G`), histórico e exportar (PNG/SVG).
  - `#workspace-viewport` (order: 1) — Canvas com pan 2D irrestrito por CSS transforms e zoom.
  - `#right-dock` (order: 2) — Painel contextual dinâmico ajustado à ferramenta ativa, com alternância de gaveta recolhível para 44 px (`#btnToggleRightDock`).
- NUNCA crie `#left-rail`, `#workspaceSwitcher` ou `#btnContextGenerator` (a ferramenta Inspecionar `toolInspect` é o contexto canônico de geração).
- O inventário de IDs congelados de controle é de exatamente 60 controles, conforme verificado por `tests/test_ui_control_registry.js`.

---

## 3. Persistência e Snapshots de Documento
- Chave canônica de localStorage: `tiling_stripes_studio_v3_state`. NUNCA use chave legada v2.
- Banco IndexedDB: `TilingStripesDB_v1` / store `studio_state`.
- Snapshots de undo entre gerações DEVEM utilizar `DocumentSnapshot.collectParams` e `DocumentSnapshot.attachDocument` para garantir que o desfazer restaure parâmetros e células sincronizadamente.
- As 8 funções puras de persistência (`isQuotaError`, `getMaxEditHistoryForMosaic`, `trimHistoryOnPush`, `migratePayloadHistories`, `buildMinimalEmergencyPayload`, `saveWithQuotaFallback`, `createSaveScheduler`, `validatePayloadVersion`) são contratos públicos e devem permanecer exportadas.

---

## 4. Atalhos Canônicos
- `V`: Inspecionar / Contexto de Geração
- `B`: Pincel | `E`: Borracha (Tile #84) | `R`: Girar | `S`: Carimbo (`C` captura) | `F`: Trava (`Shift+F` limpa)
- `H` ou `Espaço`: Pan | `Z`: Zoom | `1` / `Shift+1`: 100% centrado | `0`: Ajustar à janela
- `Q` / `Tab`: Ciclar escopos de simetria (1..6)
- `Ctrl+U`: Snap ao bloco | `Shift` (manter): Inverter snap momentâneo
- `Ctrl+Z` / `Ctrl+Shift+Z`: Desfazer e refazer edições e gerações

---

## 5. Saída Spout em Tempo Real
- O buffer Spout é renderizado offscreen em um `p5.Graphics` isolado no tamanho nativo do artboard (sem zoom, sem guias e sem hover ghosts).
- A transmissão via WebSocket local (`ws://127.0.0.1:8766`) usa `artifactSignature` para descartar quadros inalterados.
- Bridge Python em `tools/spout_bridge.py` publica no SpoutGL.

---

## 6. Suíte de Testes e Documentação
- Todas as 36 suítes de teste em `tests/run_all.js` DEVEM passar com código de saída 0 antes de qualquer entrega ou commit.
- A documentação viva (`README.md`, `docs/MANUAL_MANUTENCAO.md`) DEVE ser mantida sincronizada com qualquer alteração de funcionalidade, assinaturas de funções ou atalhos.
- `tests/test_docs_consistency.js` valida continuamente a integridade documental e deve permanecer verde.

# Manual de Manutencao e Evolucao

Este documento explica como manter, evoluir e depurar o projeto `tilling_stripes`.
Tambem funciona como tutorial para quem quer aprender a construir uma aplicacao de arte generativa desse tipo.

## Visao Geral

A aplicacao gera padroes em grade com simetria, permite edicao em tempo real e suporta importacao de tiles SVG.

Pilares do projeto:

- Geracao deterministica por seed.
- Composicao em camadas: `Subtile` -> `Tile` -> `Supertile`.
- Registro central de tiles e familias no registry.
- Fluxo de Assets para importar, editar, mover e remover tiles.
- Historicos separados para geracao, edicao e assets.
- Exportacao para PNG e SVG.

## Mapa de Arquivos

- `index.html`: estrutura da UI, IDs de controles e ordem de carga dos scripts.
- `style.css`: layout e responsividade.
- `sketch.js`: orquestrador principal (estado global, UI, eventos e render loop).
- `tile_registry.js`: fonte de verdade de tiles, familias, nomes, derivados e snapshots.
- `svg_tile_manager.js`: upload/sanitizacao de SVG, persistencia, backup/restore e operacoes de assets.
- `tile_transforms.js`: compensacao de espelhamento para modo Paint.
- `subtile.js`: unidade minima de renderizacao.
- `tiles.js`: classe `Tile` (2x2 subtiles, com buffer de performance).
- `supertile.js`: classe `Supertile` (2x2 tiles, com espelhamentos por quadrante).

## Ordem de Carga e Bootstrap

Ordem esperada dos scripts no `index.html`:

1. `tile_registry.js`
1. `svg_tile_manager.js`
1. `tile_transforms.js`
1. `subtile.js`
1. `tiles.js`
1. `supertile.js`
1. `sketch.js`

Motivo:

- `sketch.js` depende de simbolos globais criados pelos arquivos anteriores.
- Trocar essa ordem pode causar erro de startup por dependencia indefinida.

Fluxo de inicializacao:

1. `setup()` cria canvas e define seed inicial.
1. `setupUI()` conecta Setup/Edit/Assets.
1. `setupSvgUploadUI()` conecta import/export/restore de assets.
1. `selectAllTiles()` ativa tipos iniciais.
1. `initGrid()` gera a grade.

## Modelo Mental de Dados

Trabalhe sempre com 3 camadas:

- Render:
  - `TILE_RENDERERS`, `Tile`, `Supertile`, `Subtile`.
- Catalogo:
  - nomes, familias, visibilidade, derivados e backup.
  - principal em `tile_registry.js` e `svg_tile_manager.js`.
- Interacao:
  - eventos da UI, atalhos e historicos em `sketch.js`.

Quando houver bug, primeiro descubra em qual camada ele nasceu.

## Como Cada Aba Funciona

### Setup

Objetivo:

- Ajustar canvas, grade e seed.
- Filtrar tipos permitidos em `Allowed Tiles`.

Funcoes-chave:

- `initGrid(recordHistory = true)`
- `createAllowedTilesList()`
- `updateAllowedTypes()`
- `pushGenerationState()`
- `restoreGenerationState()`

### Edit

Objetivo:

- Pintar tiles e aplicar rotacoes por escopo.

Funcoes-chave:

- `getHitInfo()`
- `mapVisualTargetToLogical()`
- `buildScopePreviewTargets()`
- `drawScopePreview()`
- `mousePressed()`, `mouseDragged()`, `mouseReleased()`
- `handleTileClick()`
- `pushEditState()`, `undoEdit()`, `redoEdit()`, `restoreEditState()`

### Assets

Objetivo:

- Organizar familias.
- Importar SVG.
- Renomear/mover/remover tiles.
- Criar tiles editados e variantes.
- Fazer backup/restore.

Funcoes-chave:

- `setupSvgUploadUI()`
- `renderAssetFamilyList()`
- `renderAssetTileGrid()`
- `renderAssetInspector()`
- `pushAssetsHistoryCheckpoint()`
- `restoreAssetsHistoryTo()`

## Tutorial de Evolucao Segura

Sempre que criar uma feature:

1. Defina a camada afetada (render, catalogo ou interacao).
1. Reaproveite APIs e handlers existentes quando possivel.
1. Mantenha estado e UI sincronizados.
1. Proteja fluxos de restore contra regressao de IDs.
1. Atualize documentacao de usuario e de manutencao.

Dica pratica para Assets:

- Depois de alterar dados de assets, normalmente voce precisa chamar:
  - `refreshTileCatalogUI(...)`
  - `pushAssetsHistoryCheckpoint()`

## Cadastro de Tiles

Existem dois caminhos:

- Recomendado (UI Assets):
  - Importa SVG na interface.
  - Registra tile com `SVGTileManager.registerUploadedSvgTile(...)`.
  - Persiste em `localStorage`.
- Avancado (codigo):
  - Usa `registerTile({ ... })` em `tile_registry.js`.
  - Indicado para tile nativo com logica propria.

## Backup, Restore e Escopos

Escopos de backup:

- `full`: arquivos + organizacao.
- `tiles`: somente arquivos importados.
- `layout`: somente organizacao.

Funcoes relevantes:

- `buildBackupPayload(options)`
- `downloadBackup(...)`
- `importBackupText(text, options)`

Ponto critico:

- IDs podem mudar entre sessoes.
- O import precisa remapear oldId -> newId antes de aplicar snapshot de layout.
- `hiddenTileIds` tambem deve ser remapeado.

Teste obrigatorio apos mexer nisso:

1. Exportar backup `full`.
1. Limpar `localStorage`.
1. Importar backup.
1. Conferir familias, nomes e visibilidade.

## Historicos

Tipos de historico:

- Geracao: seed e configuracao da grade.
- Edicao: alteracoes no canvas.
- Assets: alteracoes de biblioteca e layout de tiles.

Regra:

- Toda mutacao relevante precisa criar checkpoint no historico correto.
- Evite checkpoints duplicados de estado identico.

## Atalhos

- Edit:
  - `Ctrl+Z`
  - `Ctrl+Shift+Z`
- Assets:
  - `Ctrl+Z`
  - `Ctrl+Shift+Z`
  - `Ctrl+Y`
  - `Delete`/`Backspace` para remover selecao (com regras da aba)
  - `Enter` para confirmar create/rename/move nos campos associados

Boa pratica:

- Atalhos devem ser contextuais a aba ativa para evitar conflitos.

## Guia Rapido de Depuracao

Fluxo recomendado:

1. Reproduzir com passos minimos.
1. Identificar camada afetada.
1. Inspecionar estado atual:
   - familia selecionada
   - tileId selecionado
   - snapshot de familias
   - hidden IDs
   - entries de storage
1. Validar integracao:
   - `getTileRegistrySnapshot()`
   - `applyTileRegistrySnapshot(...)`
   - `SVGTileManager.importBackupText(...)`
1. Repetir cenario apos limpar `localStorage`.

## Checklists

Checklist de PR:

- Setup/Edit/Assets funcionando.
- Undo/redo sem regressao.
- Import/export de backup funcional.
- Sem erros de sintaxe.
- Documentacao atualizada quando necessario.

Checklist de release:

- `develop` limpo.
- Commit isolado por objetivo.
- Merge para `main` sem conflitos.
- Smoke test:
  - gerar seed
  - editar no canvas
  - importar tile
  - criar variante
  - exportar/importar backup

## Roteiro de Estudo Para Criar App Similar

Trilha sugerida:

1. Base p5.js (canvas, draw loop, coordenadas e eventos).
1. Composicao em camadas (`Subtile -> Tile -> Supertile`).
1. Registry central de componentes e metadados.
1. UI orientada a estado.
1. Persistencia local versionada.
1. Backup/restore com remapeamento de IDs.
1. Undo/redo por snapshot.
1. Fluxo de release simples (`develop -> main`).

## Limites Atuais e Melhorias

Riscos atuais:

- `sketch.js` concentrando muitas responsabilidades.
- Dependencia intensa de estado global em `window`.
- Ausencia de testes automatizados.

Melhorias recomendadas:

1. Extrair modulos de UI por aba.
1. Criar servico isolado para historico.
1. Adicionar testes de contrato para snapshot/import/export.
1. Definir migracoes explicitas de versao de backup.

## Referencia Rapida de Funcoes Criticas

`sketch.js`:

- `setup()`
- `setupUI()`
- `setupSvgUploadUI()`
- `initGrid()`
- `draw()`
- `handleTileClick()`
- `getHitInfo()`
- `pushEditState()`
- `undoEdit()`
- `redoEdit()`
- `pushAssetsHistoryCheckpoint()`
- `restoreAssetsHistoryTo()`

`tile_registry.js`:

- `registerTile(config)`
- `getTileRegistrySnapshot()`
- `applyTileRegistrySnapshot(snapshot, options)`
- `createDerivedTileFromExisting(...)`
- `restoreBuiltInRegistryDefaults()`

`svg_tile_manager.js`:

- `registerUploadedSvgTile(config, options)`
- `downloadBackup(...)`
- `importBackupText(...)`
- `inferTileIdMapFromRegistry(...)`
- `exportHistoryState()`
- `importHistoryState(...)`
- `createEditedTile(...)`
- `generateSymmetryVariants(...)`

---

Se voce esta entrando agora no projeto:

1. Leia este manual.
1. Leia `README.md`.
1. Abra `index.html` para entender a estrutura da UI.
1. Leia `sketch.js` para fluxo completo de execucao.

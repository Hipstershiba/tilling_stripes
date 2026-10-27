# Correções do Subtile Studio — 27/10/2026

Base: REVISAO_GEMINI_ARGON_SUBTILES.md. A revisão original e suas imagens foram preservadas.

## Avaliação

A arquitetura matemática e vetorial tem boa cobertura de testes. Os bloqueadores estavam na integração da interface: layout, estado de navegação e seleção. O grafo AST ajuda a navegar pelos módulos, mas seus resultados não substituem testes de interação no navegador.

## Aplicado

- P0-1: dock com rolagem, biblioteca com lista de 280 px e grupos sem encolhimento.
- P0-2: ferramentas vetoriais restauram edição após Pan/Zoom; Pan alternável e com estado acessível; saída restaura ferramenta do mosaico.
- P0-3: família corrente explícita, limpeza de seleção, nós, caneta, arrasto e guias na troca; importação/restauração/exclusão invalidam históricos.
- P1-1: cache de miniaturas por geometria/família, evitando renderizar novamente o catálogo inteiro em cada ajuste. A árvore conserva rolagem e foco de família.
- P1-2: exportação unitária com margem zero por padrão.
- P1-3: backup JSON antes de importar, excluir e restaurar; importação começa em Mesclar; Substituir requer segunda confirmação; SOLO passa pelo dirty guard.
- P1-4: Tab/Shift+Tab contidos, fundo inert, Escape local, foco inicial seguro e restauração de foco nos modais.
- P1-5: famílias e camadas focáveis, Enter/Espaço para seleção; rótulos textuais nos controles de visibilidade/trava.
- P1-6/7: emojis removidos da interface de camadas/ajuda; Q/Tab documentados corretamente.
- P1-8: falha de IndexedDB da biblioteca gera aviso e recomenda backup.
- P2: repetição 3×3 nomeada corretamente; controles de grade/cores ocultos no modo Subtiles; busca/filtro limpos ao criar/importar/restaurar; título da página atualizado.
- Persistência: nomes canônicos v3 e migração conservadora por leitura da chave v2 e do banco antigo, sem apagar as origens.
- Workspace: AGENTS.md com orientação Graphify, script de sincronização e vault Obsidian exportado com canvas.

## Verificação e limites

45 suítes automatizadas. A nova suíte exercita troca de família, retorno de Pan/Zoom e restauração da ferramenta anterior; o teste de IndexedDB cobre migração do banco legado. Os testes existentes cobrem motor, SVG, D4 e persistência.

A validação visual em navegador, com capturas em 1280/1440, não foi repetida nesta execução. Portanto o layout corrigido precisa dessa confirmação visual. Não há medição nova de desempenho com 150/300 tiles.

Continuam como melhorias maiores: atualização granular de todos os painéis, undo completo de operações de biblioteca, consolidação de ações duplicadas, revisão global da tipografia, navegação por setas nas listas e ajuste automático do canvas em telas menores. Backups JSON oferecem recuperação das operações destrutivas, mas não substituem undo de documento completo. A regra de organização de grupos built-in foi preservada.

## Obsidian e Graphify

Abra `_local/obsidian_vault` como vault existente no Obsidian. Comece por `INICIO_WORKSPACE.md` e `graph.canvas`. Para sincronizar novamente execute `scripts/sync_knowledge.ps1` na raiz do workspace. O script usa a instalação local `.venv` e interrompe em caso de erro. Notas e grafo gerados ficam fora do Git; configuração e script ficam versionáveis.


## Revisão de seleção, camadas e organização — 27/10/2026

- Corrigido mouseup global que reconstruía o inspetor antes do click, impedindo seleção nas camadas e acionamento do Pathfinder. Só gestos iniciados no canvas finalizam uma operação vetorial.
- Shift+clique tem prioridade sobre as alças de transformação; Shift+marquee soma objetos à seleção sem incluir os bloqueados ou ocultos.
- Abas Camadas/Propriedades/Biblioteca/Variantes evitam a pilha vertical de painéis. Prancheta inicial 1×1 maior, inspetor mais largo e responsivo.
- Seleção múltipla explícita por checkbox na pilha de objetos; ícones de olho/cadeado, renomear, reordenar e desfazer. Não introduz hierarquias aninhadas de camadas.
- Pathfinder compartilhado entre Camadas e Propriedades, sem perder seleção entre abas.
- Biblioteca com conjuntos, filtro, expandir/recolher e localizar família ativa; metadados próximos da gestão da biblioteca.
- Verificação real em sessão de navegador separada: dois checkboxes → união → um caminho → desfazer → dois objetos; troca de abas preserva seleção; ocultar reduz seleção e pode ser desfeito.

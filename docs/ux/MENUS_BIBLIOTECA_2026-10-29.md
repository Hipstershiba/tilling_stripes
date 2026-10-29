# Menus globais e biblioteca em página própria

Base de segurança: f035cf7. Implementação local de 29/10/2026.

## Página ou popup

Escolhida uma página para o gerenciamento da biblioteca. Buscar, comparar miniaturas, renomear, mudar conjuntos e trabalhar com arquivos são tarefas prolongadas, beneficiadas por catálogo amplo e detalhes simultâneos. Um popup reduziria o espaço útil e criaria outra área de rolagem sobre o canvas. Diálogos ficam reservados às confirmações e importações que já os utilizavam.

A rota é `#biblioteca`. O editor permanece montado e oculto enquanto a página aparece, preservando documento, zoom, ferramenta e aba. Voltar ao estúdio restaura o contexto; Editar peça abre a família escolhida no editor. Não há nova chave de armazenamento nem mudança de schema.

## Distribuição dos comandos

| Menu | Responsabilidade |
| --- | --- |
| Arquivo | Exportar mosaico e voltar ao estúdio |
| Editar | Desfazer, refazer, seleção, duplicar e excluir formas |
| Objeto | Cópia editável, caminho, giros, espelhos e booleanas |
| Exibir | Ajuste, zoom 100%, ampliar/reduzir e todas as guias do ambiente ativo |
| Biblioteca | Gerenciamento, SVG de subtiles, exportação por conjuntos, nova peça/conjunto, duplicação, JSON e restauração |
| Ajuda | Ajuda e atalhos do estúdio |

Os menus reutilizam os handlers existentes. A disponibilidade acompanha o ambiente e a seleção. Comandos de edição ficam desabilitados no gerenciamento da biblioteca. Importar SVG pela biblioteca cria família nova, evitando alterar a peça selecionada por acidente.

No mosaico, Exibir oferece Eixos, Blocos, Peças e Órbitas. No editor de peças, oferece Eixos, Grade, Portas, Margem e Encaixar na grade. Recolher o painel fica no botão do próprio painel.

Exportar conjuntos abre um diálogo de seleção múltipla, com o conjunto atual inicialmente marcado. JSON preserva os dados para reimportação; ZIP reúne SVGs por conjunto/família e um manifesto JSON. O ZIP permite exportar somente matrizes ou incluir as variantes D4 registradas. Backup completo continua disponível separadamente. Exportar não altera a biblioteca nem o schema.

## Pathfinder

Expandido por padrão, inclusive em peças protegidas. As operações permanecem visíveis e ficam desabilitadas até haver duas ou mais formas editáveis, visíveis e destravadas. O usuário pode recolher manualmente; atualizar seleção não redefine essa escolha.

## Verificação

- Teste de navegação preserva estado, foco, histórico do navegador e Escape em busca.
- Testes de contratos verificam os menus, o catálogo fora do dock e Pathfinder inicialmente aberto.
- Inspeção do navegador cobre abertura e retorno por menus, busca/filtros, edição da peça selecionada, estados indisponíveis e navegação por teclado.
- A verificação é amostral; não inclui leitor de tela nem dispositivos de toque.

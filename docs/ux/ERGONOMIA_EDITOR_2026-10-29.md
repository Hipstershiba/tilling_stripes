# Ergonomia e padronização do editor de peças

Referência: painel contextual Propriedades e distribuição de ferramentas/painéis do Adobe Illustrator. Implementação local de 29/10/2026.

## Fluxo final

1. Abrir Editar peças: Propriedades apresenta a peça protegida e Criar cópia.
2. Criar cópia e selecionar: Geometria, Aparência e ações de Alinhar/Transformar aparecem em ordem de edição. Bases de fita ficam recolhidas.
3. Selecionar duas ou mais formas elegíveis: Pathfinder abre dentro de Propriedades. A escolha manual de recolhê-lo é respeitada enquanto a seleção continua elegível.
4. Camadas: seleção, ordem, visibilidade e bloqueio; selecionar objetos preserva a aba. Escolher uma ferramenta de desenho revela suas Propriedades.
5. Biblioteca: metadados da família, busca, filtro por conjunto, filtros de origem e uma linha de comandos CRUD. Arquivos SVG e Backup ficam no rodapé recolhível.
6. Variantes: conferência D4 e prévias da família. A seleção é preservada entre as quatro abas.

## Espaço e ergonomia

- Esquerda: ferramentas com navegação integrada, guias e atalho Biblioteca. Sem repetir criação de família e arquivo em gavetas laterais.
- Opções de Curvar junto das propriedades, evitando mudanças de altura na grade de ferramentas.
- Abas de 36 px; resumos recolhíveis de 28 px; campos de 30 px. Ferramentas mantêm 38 px e SVGs de 18 px.
- Navegação por conjunto, localizar e expandir/recolher passam a compartilhar uma linha.
- Filtros de origem e comandos da biblioteca compartilham outra linha. A lista usa o espaço restante e conserva área mínima para rolagem.
- Grupos de ação sem cartões decorativos adicionais; separadores finos e cores semânticas do aplicativo.
- Nome do painel consistente: Editar peças. Peças autorais identificadas em português.

## Verificação

Inspeção no navegador em 1440×900 e 1280×768: peça protegida, cópia editável, seleção simples/múltipla, Camadas, Propriedades, Biblioteca, Variantes e gavetas de arquivo. Os testes verificam a posição dos controles, a preservação da aba Camadas durante a seleção e a abertura de Propriedades para ferramentas de desenho.

Não foram adicionadas novas operações vetoriais nem alterados D4, catálogo canônico, atalhos ou persistência. A inspeção visual é amostral e não cobre dispositivos de toque.

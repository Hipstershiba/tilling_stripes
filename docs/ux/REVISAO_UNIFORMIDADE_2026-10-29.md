# Revisão da uniformidade entre ambientes

Data: 29/10/2026. Base de segurança: commit c9740b8; revisão sobre as correções locais posteriores.

## Problemas confirmados e corrigidos

| Elemento | Diferença observada | Correção |
| --- | --- | --- |
| Entrada de Ferramentas | Editor tinha divisor adicional e início 11 px abaixo | Removido divisor exclusivo; título em y=100 nos dois modos em 1440×900 |
| Troca de ambiente | Regras antigas alteravam o espaçamento interno por modo | Removidas sobrescritas específicas; gap compartilhado de 7 px |
| Gavetas | Divisor separado, borda própria e espaçador acumulavam linhas e vazios | Uma borda por gaveta e espaçamento compartilhado de 8 px |
| Ações das gavetas | Botões de 26 px e largura total | Grade de duas colunas, altura de 38 px e ícones de 18 px |
| Backup | Cabeçalho quebrava em duas linhas | Rótulo Backup com descrição completa no título |
| Cópia no topo | Destaque âmbar exclusivo para uma ação comum | Superfície neutra compartilhada com as ações superiores |
| Criar cópia em Propriedades | Ícone isolado ocupava toda a linha | Ícone com rótulo visível, como na Biblioteca |

## Inspeção no navegador

- Comparação entre Mosaico e Editar peças em 1440×900 e 1280×768.
- Medidas e estilos das barras superior, esquerda, direita, cabeçalho e troca de ambiente.
- Ferramentas ativas: mesmo tamanho, fundo, texto, borda e raio.
- Camadas, Propriedades, Biblioteca e Variantes inspecionadas visualmente.
- Biblioteca, Arquivos SVG e Backup abertos: ações de 47×38 px e ícones de 18 px em 1280×768.
- Painel recolhido nos dois ambientes: largura de 44 px.
- A faixa de histórico de 40 px permanece exclusiva do Mosaico; por isso a coluna central e a posição horizontal dos controles do rodapé variam com a disponibilidade da faixa.
- O conteúdo dos painéis e as ferramentas específicas de cada ambiente continuam seguindo suas funções.

## Proteção contra regressões

Os testes existentes agora verificam a ausência do divisor antes da primeira seção, de divisores duplicados nas gavetas e do espaçador extra. O teste de ações de Propriedades verifica que Criar cópia conserva o rótulo visível.

A verificação é amostral nos estados e resoluções acima; não inclui dispositivos de toque nem todas as combinações de ferramentas e seleção.

Organização comum das ferramentas: Mão e Zoom encerram a grade principal de Ferramentas nos dois ambientes, juntos na mesma linha. O editor não tem seção separada de Navegação.

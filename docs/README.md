# Documentação — Tiling Stripes Studio

Índice do acervo documental. **Nenhum `.md` fica solto na raiz além do `README.md`.**

```
docs/
├── README.md                  este índice
├── MANUAL_MANUTENCAO.md       arquitetura, álgebra D4, persistência e regras de manutenção
├── instrucoes/                o que foi pedido em cada rodada
└── relatorios/                o que foi entregue e o que foi auditado
```

---

## Especificações (`instrucoes/`)

| Documento | Rodada | Objetivo |
|---|---|---|
| [INSTRUCOES_GEMINI_38_FLASH.md](instrucoes/INSTRUCOES_GEMINI_38_FLASH.md) | 1 | Usabilidade do painel Editor, persistência, correção D4 |
| [INSTRUCOES_GEMINI_RODADA2.md](instrucoes/INSTRUCOES_GEMINI_RODADA2.md) | 2 | Divulgação progressiva, densidade de UI, contrato D4 no editor, debounce |
| [INSTRUCOES_GEMINI_RODADA3.md](instrucoes/INSTRUCOES_GEMINI_RODADA3.md) | 3 | Fechar o que foi declarado pronto (debounce, chip, chave de storage, ajuda) com prova que falha no baseline |
| [INSTRUCOES_GEMINI_RODADA4.md](instrucoes/INSTRUCOES_GEMINI_RODADA4.md) | 4 | Arquitetura de informação das barras: modo no cabeçalho do dock, gaveta de 44 px, acordeão de painéis, cores no rodapé esquerdo, zoom/Ajustar/1:1 juntos |

## Relatórios e auditorias (`relatorios/`)

| Documento | Autor | Conteúdo |
|---|---|---|
| [RELATORIO_IMPLEMENTACAO_INSTRUCOES.md](relatorios/RELATORIO_IMPLEMENTACAO_INSTRUCOES.md) | Antigravity | Entrega da Rodada 1 |
| [RELATORIO_DEEPSEEK_RODADA2.md](relatorios/RELATORIO_DEEPSEEK_RODADA2.md) | Antigravity | Entrega da Rodada 2 |
| [AVALIACAO_DEEPSEEK_RODADA2.md](relatorios/AVALIACAO_DEEPSEEK_RODADA2.md) | DeepSeek | Auditoria da Rodada 2: 4 afirmações do relatório não se sustentam no código, com arquivo:linha |

---

## Como ler este acervo

1. **Para entender o app:** comece pelo [README](../README.md) e depois pelo
   [manual](MANUAL_MANUTENCAO.md).
2. **Para retomar o trabalho:** leia a instrução da rodada em aberto e o relatório da rodada
   anterior.
3. **Para saber em quem confiar:** `relatorios/` é o que o agente de implementação *declarou*;
   `AVALIACAO_DEEPSEEK_RODADA2.md` é o que foi *verificado*. Quando os dois divergirem, vale a
   auditoria — e a rodada 3 nasceu exatamente dessa divergência.

## Notas de manutenção

- Especificações e relatórios são **registro histórico**: não os reescreva depois do fato. Correção
  de conteúdo vai no documento vivo (`README.md`, `MANUAL_MANUTENCAO.md`) ou em relatório novo.
- Relatórios antigos contêm links `file:///c:/Users/hipstershiba/...` e caminhos de outra máquina.
  São preservados como registro; use os caminhos relativos deste índice.
- Screenshots de evidência ficam em [`tests/screenshots/`](../tests/screenshots/), não aqui.

# Diretório de Artefatos Locais (`_local/`)

Este diretório é reservado exclusivamente para artefatos e arquivos temporários de uso local gerados durante o desenvolvimento, experimentação artística, testes manuais ou depuração.

---

### O que colocar aqui:
- **Dumps e Logs de Execução**: arquivos de trace, saída de comandos, dumps de estado (`*.log`, `*.json`, `*.txt`).
- **Capturas e Gravações de Teste**: screenshots de inspeção local, comparações de layout antes/depois, vídeos e gravações de depuração.
- **Perfis de Navegador e Caches**: diretórios temporários de WebDriver / CDP / Edge Headless (ex: `.tmp-edge*`).
- **Scripts Scratch**: rascunhos rápidos em Node.js ou Python usados para investigar hipóteses ou validar APIs.
- **Exportações de Teste**: arquivos SVG, PNG ou JSON gerados para testes pontuais pelo usuário ou desenvolvedor.

---

### Configuração no `.gitignore`:
Todos os conteúdos deste diretório são ignorados pelo Git (com exceção deste arquivo `README.md`), garantindo que o repositório permaneça sempre limpo, sem commits acidentais de arquivos binários ou de depuração.

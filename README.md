# Sistema Executivo de Gestão de Cronogramas — FG

Aplicação estática para gestão de cronogramas por área, com painel executivo consolidado.

## Fase 1
- Painel executivo consolidado e visão separada por área.
- Cadastro, edição e exclusão de trabalhos e atividades.
- Cronograma mensal com preservação das marcações legadas.
- Filtros por área, ano, status e tipo de trabalho.
- Persistência local no navegador (`localStorage`).
- Exportação e importação de backup JSON.
- Histórico de origem incorporado em `data/historico.json`.

## Publicação
1. Em **Settings > Pages**, selecione **Deploy from a branch**.
2. Branch: `main`; pasta: `/ (root)`.
3. Salve e aguarde a publicação.

## Armazenamento e segurança
Os dados novos e as alterações ficam no navegador/dispositivo utilizado. Não existe sincronização entre usuários ou computadores nesta fase. Faça exportações JSON periódicas e mantenha cópias seguras. O repositório contém o modelo inicial e os dados históricos importados; não armazene dados pessoais ou sigilosos nesta aplicação pública.

## Histórico
A importação inicial mantém as marcações e legendas originais (`P`, `A`, `R`, `D`, `✔`, `-`) como referência. Os símbolos não são tratados como evidência de execução além do significado indicado na planilha. Os cronogramas de Compliance, Governança e Gerenciamento de Riscos de 2023 são mantidos como históricos legados, sem inventar datas reais para etapas sem preenchimento.

## Evolução
Esta versão não possui autenticação, banco de dados, trilha de auditoria inviolável nem sincronização corporativa. Essas capacidades devem ser avaliadas antes de uso multiusuário ou institucional.
<!-- quem alimenta: o /setup semeia na entrevista; o /atualizar acrescenta ferramenta nova, acesso novo ou "não alcanço"; a /faxina confere e pergunta. Lido antes de dizer "não consigo" e ao criar skill. -->
# Ferramentas

> O que o negócio usa e como o agente alcança cada coisa. **"não ligada" é resposta válida:** é assim
> que o agente sabe que aquilo existe e dá pra ligar, em vez de achar que é impossível.
> Chave nunca fica aqui. Chave mora no `.env` (fora do git) ou no gerenciador de senha; aqui vai só o
> nome da variável. O cardápio do que dá pra ligar está em `sistema/templates/ferramentas/catalogo.md`.

| ferramenta | pra quê | como o agente alcança | estado | última checagem |
|---|---|---|---|---|
| GitHub | código do site, PRs, issues, histórico de commits, workflow do Actions | MCP (`GITHUB_PERSONAL_ACCESS_TOKEN` no `.env`) pra repo/PR/issues; **`gh` CLI não está instalado nesta máquina** (tentado via Bash e PowerShell, não achou). **Leitura de Actions eu alcanço direto por REST** (curl com o mesmo token — workflows, runs, jobs, log completo de cada step), validado checando e depurando o cron da OdontoMinas. **Bloqueado por design, mesmo com autorização no chat**: disparar workflow (`workflow_dispatch`, token sem escopo `workflow`) e escrever/editar secret do Actions (classificador de segurança recusa qualquer escrita em cofre de segredo) — os dois continuam manuais, no site | ligada (repo + leitura de Actions); disparo e secret do Actions só manual | 2026-09-15 |
| Supabase | banco de dados do Diagnóstico Digital (leads, scoring) | MCP, somente-leitura (`SUPABASE_ACCESS_TOKEN` no `.env`) | ligada | 2026-09-10 |
| Supabase (CRM OdontoMinas) | banco do CRM da OdontoMinas (projeto `odontominas-crm`, separado do Diagnóstico Digital) | **MCP oficial autorizado hoje** (`supabase-crm-odontominas`, HTTP/OAuth, já configurado em `.mcp.json` da raiz) — Rafael aprovou via `/mcp` numa sessão interativa nova (guiado passo a passo). Ainda não confirmado se dá schema também: a autorização não chegou na sessão em andamento (MCP carrega só no início da sessão) — testar numa sessão nova. **Dado (ler/escrever linha) eu já alcanço direto de qualquer sessão**: REST da própria API do Supabase, autenticado com `SUPABASE_SERVICE_ROLE_KEY` de `crm/.env.local` (curl/Node local, sem precisar de você) — validado repetidas vezes, inclusive ligando/desligando o buffer de mensagens direto em produção. **Schema (migração, `CREATE TABLE`/`ALTER TABLE`) continua manual por enquanto**: SQL Editor (`https://supabase.com/dashboard/project/exaluyarsphucotprwpi/sql/new`), você roda o SQL que eu preparo — deve deixar de ser assim se o MCP recém-autorizado cobrir schema, a confirmar | ligada (dado, via REST, de qualquer sessão); MCP autorizado, ainda não confirmado se cobre schema; schema segue manual por ora | 2026-09-16 |
| Cloudflare | hospedagem de sites (Pages) — 1º uso: site da OdontoMinas, no ar | só você, no dashboard (deploy automático via Git); sem MCP/API conectado aqui | não ligada (deploy roda sozinho; eu não gerencio o projeto) | 2026-09-12 |
| Twenty CRM | ficha do cliente, pipeline comercial | só você, na mão (Cloud Pro, trial — Fase 1 pausada até fechar o piloto #1) | não ligada | 2026-09-10 |
| Kaptar | prospecção de leads (busca por nicho/área; enriquecimento por IA); Campanha, Automação e WhatsApp existem no app mas pausados por decisão | só você, no app desktop (Electron, local, dados em `AppData\Roaming\Kaptar`; sem MCP/API conectado aqui) | ligada (uso restrito: só a aba Buscar por ora) | 2026-09-14 |
| Railway | hospedagem da Evolution API e do CRM da OdontoMinas (mesmo projeto, `illustrious-perfection`) | CLI instalada e logada (`railway login`) + MCP local (`railway`, reaproveita a mesma sessão) — deploy do CRM via `railway up`, sem GitHub conectado; `railway up` autoaprovado nesta máquina (`Bash(railway up)` em `.claude/settings.local.json`, a pedido do Rafael) — antes disso o classificador de modo automático bloqueava o comando mesmo com autorização no chat | ligada (painel + CLI/MCP, deploy autoaprovado) | 2026-09-15 |
| Evolution API | WhatsApp do CRM da OdontoMinas (instância `odontominas-teste`, número de teste, não o da clínica) | chamada HTTP direta (REST), chave em `clientes/odontominas/crm/.env.local` (`EVOLUTION_API_URL`/`EVOLUTION_API_KEY`, fora do git) | ligada | 2026-09-15 |
| RoiZap | ferramenta que o Rafael usa em outro negócio — referência de layout pros Agentes de IA do CRM | nenhum acesso: não existe ferramenta de navegador nesta sessão, nem pra login nem pra clicar em nada; autorização dada no navegador dele não chega até aqui de jeito nenhum. Caminho que funciona: ele manda print da tela/aba que precisar | não ligada (sem navegador disponível) | 2026-09-15 |
| Mensagem com cliente | — | — | não ligada | 2026-09-10 |
| Tarefa e prazo | — | — | não ligada | 2026-09-10 |
| Email | — | — | não ligada | 2026-09-10 |
| Agenda | — | — | não ligada | 2026-09-10 |
| Dinheiro entrando e saindo | — | — | não ligada | 2026-09-10 |
| Reunião | — | — | não ligada | 2026-09-10 |

## Os sete assuntos que todo negócio tem

Mensagem com cliente · tarefa e prazo · email · agenda · dinheiro entrando e saindo · ficha do cliente
(Twenty CRM, em configuração) · reunião. Nenhum ligado ainda além do CRM — empresa em fase inicial.

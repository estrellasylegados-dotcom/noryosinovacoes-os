<!-- quem alimenta: o /setup semeia na entrevista; o /atualizar acrescenta ferramenta nova, acesso novo ou "não alcanço"; a /faxina confere e pergunta. Lido antes de dizer "não consigo" e ao criar skill. -->
# Ferramentas

> O que o negócio usa e como o agente alcança cada coisa. **"não ligada" é resposta válida:** é assim
> que o agente sabe que aquilo existe e dá pra ligar, em vez de achar que é impossível.
> Chave nunca fica aqui. Chave mora no `.env` (fora do git) ou no gerenciador de senha; aqui vai só o
> nome da variável. O cardápio do que dá pra ligar está em `sistema/templates/ferramentas/catalogo.md`.

| ferramenta | pra quê | como o agente alcança | estado | última checagem |
|---|---|---|---|---|
| GitHub | código do site, PRs, issues, histórico de commits | MCP (`GITHUB_PERSONAL_ACCESS_TOKEN` no `.env`) | ligada | 2026-09-10 |
| Supabase | banco de dados do Diagnóstico Digital (leads, scoring) | MCP, somente-leitura (`SUPABASE_ACCESS_TOKEN` no `.env`) | ligada | 2026-09-10 |
| Cloudflare | hospedagem de sites (Pages) — 1º uso: site da OdontoMinas, no ar | só você, no dashboard (deploy automático via Git); sem MCP/API conectado aqui | não ligada (deploy roda sozinho; eu não gerencio o projeto) | 2026-09-12 |
| Twenty CRM | ficha do cliente, pipeline comercial | só você, na mão (Cloud Pro, trial — Fase 1 pausada até fechar o piloto #1) | não ligada | 2026-09-10 |
| Kaptar | prospecção de leads (busca por nicho/área; enriquecimento por IA); Campanha, Automação e WhatsApp existem no app mas pausados por decisão | só você, no app desktop (Electron, local, dados em `AppData\Roaming\Kaptar`; sem MCP/API conectado aqui) | ligada (uso restrito: só a aba Buscar por ora) | 2026-09-14 |
| Railway | hospedagem da Evolution API (WhatsApp do CRM da OdontoMinas) | só você, no dashboard; sem MCP conectado aqui | ligada (uso só painel) | 2026-09-15 |
| Evolution API | WhatsApp do CRM da OdontoMinas (instância `odontominas-teste`, número de teste, não o da clínica) | chamada HTTP direta (REST), chave em `clientes/odontominas/crm/.env.local` (`EVOLUTION_API_URL`/`EVOLUTION_API_KEY`, fora do git) | ligada | 2026-09-15 |
| Mensagem com cliente | — | — | não ligada | 2026-09-10 |
| Tarefa e prazo | — | — | não ligada | 2026-09-10 |
| Email | — | — | não ligada | 2026-09-10 |
| Agenda | — | — | não ligada | 2026-09-10 |
| Dinheiro entrando e saindo | — | — | não ligada | 2026-09-10 |
| Reunião | — | — | não ligada | 2026-09-10 |

## Os sete assuntos que todo negócio tem

Mensagem com cliente · tarefa e prazo · email · agenda · dinheiro entrando e saindo · ficha do cliente
(Twenty CRM, em configuração) · reunião. Nenhum ligado ainda além do CRM — empresa em fase inicial.

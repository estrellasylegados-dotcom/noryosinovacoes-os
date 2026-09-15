<!-- quem alimenta: o /setup semeia na entrevista; o /atualizar acrescenta quando algo passa a estar hospedado. Lido quando a sessão precisa saber onde algo está (mapa). -->
# Infra

> Onde as coisas estão hospedadas: site, domínio, servidor, banco, DNS, email, área de membros.
> É diferente de `ferramentas.md` (o que você usa) e aponta pra onde cada coisa **mora**.
> Sem chave, sem senha. Aqui vai o nome do serviço, o endereço e quem tem acesso.

| o quê | onde mora (serviço) | endereço | quem acessa e como | observações |
|---|---|---|---|---|
| Site institucional | Hostinger Web Apps (Node.js) + CDN Hostinger | noryosinovacoes.com.br | Rafael; deploy automático a partir da branch `main` no GitHub | Next.js 15.5.24 fixado (restrição de glibc do build da Hostinger) |
| Código-fonte | GitHub | `estrellasylegados-dotcom/noryosinovacoes` | Rafael; MCP conectado | site vive em `projetos/Noryos-Inovacoes/site/` dentro desse repo (projeto anterior, a ser linkado) |
| Banco de dados | Supabase | projeto de produção (ref no `.env`) | Rafael; MCP conectado (somente-leitura) | dados do Diagnóstico Digital: leads, scoring, rate limit |
| Email transacional | Resend | domínio noryosinovacoes.com.br verificado | Rafael | notificação interna do Diagnóstico Digital |
| Anti-bot | Cloudflare Turnstile | — | Rafael | obrigatório no `POST /api/diagnostico` |
| CRM comercial | Twenty CRM (Cloud Pro, trial 30 dias) | `noryos.twenty.com` (workspace ainda não criado) | Rafael | Fase 1 aprovada, runbook pronto |
| Site OdontoMinas (cliente-piloto) | Cloudflare Pages | https://odontominas.pages.dev/ | Rafael; deploy automático a cada push na `main` do repo `noryosinovacoes-os` (root `clientes/odontominas/site`) | Domínio próprio ainda não existe — subdomínio gratuito por enquanto |
| Banco de dados do CRM OdontoMinas | Supabase | projeto `odontominas-crm` (`exaluyarsphucotprwpi`) | Rafael; agente via MCP local (`supabase-crm`) | schema V1 aplicado 2026-09-15 (6 tabelas, RLS + grants pra `service_role`); separado do banco do Diagnóstico Digital |
| CRM OdontoMinas (app) | Railway | https://odontominas-crm-production.up.railway.app | Rafael; agente via CLI (`railway up`) e MCP local (`railway`) | mesmo projeto Railway da Evolution API (`illustrious-perfection`, serviço `odontominas-crm`); deploy manual, sem auto-deploy do GitHub ainda |

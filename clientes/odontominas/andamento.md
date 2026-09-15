# Andamento · OdontoMinas

## Onde está (2026-09-15, Fase 5)

CRM: **Fase 5 completa e em produção** — automação de reativação de paciente inativo (conversa
resolvida sem mensagem há mais de 30 dias recebe 1 WhatsApp de reativação, uma vez só por
conversa), disparada 1x/dia por um cron do GitHub Actions. Detalhe completo em "Feito" abaixo.
Próximo passo é a Fase 6 (demo pro marido, e se validar, pra Ariadna) — não sobra mais nenhuma
fase técnica antes da demo.

## Onde está (2026-09-15, Fase 4)

CRM: pendência da revisão técnica fechada (migração `aguardando_desde` rodada, `railway up` feito
e validado em produção) e **Fase 4 completa e em produção**: ficha de paciente
(`/pacientes/[id]`) + resumo executivo (`/resumo`, com alerta de leads esfriando). Detalhe
completo em "Feito" abaixo. Próximo passo é a Fase 5 (1 automação de destaque).

## Onde está (2026-09-15, revisão técnica)

Revisão técnica aprofundada das Fases 1-3 do CRM, a pedido do Rafael. 2 bugs reais corrigidos no
funil de atendimento, login endurecido (rate limit), suite de testes criada do zero (71 testes),
escopo do MCP do Supabase enxugado. Detalhe completo em "Feito" abaixo. **Nada disso está em
produção ainda** — falta rodar a migração nova no SQL Editor e fazer `railway up`.

## Onde está (2026-09-15, atualizado)

CRM: Fase 3 (painel de atendimento) completa e validada de ponta a ponta, em produção. Detalhe
completo em "Feito" abaixo. Painel agora exige login (remendo mínimo — 2 perfis, admin/atendente,
senha temporária). Próximo passo é a Fase 4 (ficha de paciente + resumo executivo).

## Onde está (2026-09-15)

CRM: Fase 2 (espelhamento) completa e validada de ponta a ponta. Detalhe completo em "Feito"
abaixo. Próximo passo era a Fase 3 (painel de atendimento) — ver bloco atualizado acima.

## Onde está (2026-09-12)

Pasta criada. Escopo e compliance mapeados. O site em `site/` deixou de ser scaffold técnico e
virou um redesign editorial completo, com uma revisão de direção de arte e uma seção nova,
"Protocolo Correct Full Arch" (ver "Feito" abaixo). **No ar em produção**: Cloudflare Pages,
https://odontominas.pages.dev/ — repositório `noryosinovacoes-os`, root `clientes/odontominas/site`,
build `npm run build` → `out`, deploy automático a cada push na `main` (conectado por Rafael no
dashboard, confirmado carregando certo, com a seção do Protocolo Correct visível). Domínio próprio
ainda não existe — segue pendência abaixo.

Reunião de Rafael com o marido da Ariadna aconteceu em 14/09: escopo do piloto mudou de "site+GMN
grátis, tráfego cobrado à parte" pra pacote completo de graça — site + CRM de captação + tráfego
pago (verba de mídia por conta da clínica) — pensado como prova de conceito replicável pros
contatos dele com outros dentistas (detalhe em `contexto.md`). **A "proposta" não vai ser um
documento**: Ariadna só avança em projeto que vê funcionando, então o plano combinado com o marido
é demonstrar o CRM rodando — a demonstração É a proposta. Por isso o CRM virou a atividade
principal do projeto agora; site (já no ar) e tráfego pago ficam em segundo plano até lá.

## Pendências

**Negócio**
- [ ] Ter o CRM num estado demonstrável e marcar a demonstração com o marido (e depois, se ele
  validar, com a Ariadna) — isso substitui "apresentar proposta formal" (2026-09-14).
- [ ] Definir prazo de entrega com ela (depende da demonstração acontecer primeiro).
- [ ] Definir o critério de "100%"/pronto pra replicar — o que precisa estar rodando antes de
  oferecer a mesma estrutura pros contatos do marido com outros dentistas (2026-09-14).

**CRM — atividade principal do projeto agora (2026-09-14)**
- [ ] Confirmar com a clínica se o incômodo real com o Controle Odonto é custo da assinatura ou
  falta de automação — decide se dá pra só simplificar módulos em vez de construir substituto
  completo (o CRM não mexe na camada clínica/prontuário/financeiro dele, só na de
  captação/relacionamento).
- [x] Fase 1a — Evolution API no ar na Railway (instância `odontominas-teste`, WHATSAPP-BAILEYS),
  conectada via QR no número de teste do Rafael (`state: open`), confirmado por chamada direta à
  API (2026-09-15). Chave e URL em `crm/.env.local` (fora do git).
- [x] Fase 1b — projeto Supabase novo criado (`odontominas-crm`, região Americas/São Paulo,
  RLS automático ligado em toda tabela nova, tabela não exposta por padrão). Chaves salvas e
  validadas em `crm/.env.local` (2026-09-15). **Fase 1 (infra) completa.**
- [x] Fase 2 — espelhamento: mensagem recebida/enviada grava em `conversas`/`mensagens`, sem tela
  ainda. Validada com WhatsApp real (2026-09-15) — ver "Feito".
- [x] Fase 3 — painel de atendimento (o "uau" da demo): lista de conversas, status
  (novo/respondido/aguardando/agendado/perdido), tempo até a 1ª resposta. Validada em produção
  (2026-09-15) — ver "Feito".
- [x] Aplicar em produção a revisão técnica de 2026-09-15: migração
  `2026-09-15_v2_aguardando_desde.sql` rodada no SQL Editor do Supabase e `railway up` feito
  (corrige o funil de atendimento e endurece o login) — ver "Feito".
- [x] Fase 4 — ficha de paciente + resumo executivo (dashboard simples). Completa e em produção
  (2026-09-15) — ver "Feito".
- [x] Fase 5 — automação de reativação de paciente inativo (escolhida em vez de lembrete de
  consulta — ver `_memoria/decisoes.md`). Completa e em produção (2026-09-15) — ver "Feito".
- [ ] Fase 6 — demo pro marido; se validar, demo pra Ariadna.
- [ ] Trocar as senhas temporárias do painel (`dev-admin-temp`/`dev-atendente-temp`) antes de expor
  o painel pra equipe real da clínica; RBAC completo por perfil fica pra depois que o piloto validar
  (2026-09-15) — o Resumo executivo já é exclusivo de admin (2026-09-15), o resto do painel segue
  igual pros 2 papéis.
- [ ] Decidir se apaga os 5 dados fictícios de demo (Camila, Rodrigo, Fernanda, Marcos, Beatriz —
  telefones 556199990001-5) antes da demo real, ou mantém como demonstração fixa (2026-09-15).

## Plano técnico do CRM (2026-09-14)

- **Código:** `clientes/odontominas/crm/` (Next.js 15 + TypeScript + Tailwind, UI kit reaproveitado
  por referência do `site/` — mesmo padrão de sempre, não é submodule nem dependência entre
  projetos).
- **Banco:** Supabase novo, dedicado a este CRM — dado de paciente é mais sensível (LGPD) e é de
  outra empresa, não mistura com o banco do Diagnóstico Digital. Toda tabela leva `clinica_id`
  (arquitetura "path B": modelo de dado pronto pra multi-clínica, mas cada clínica roda numa
  instância própria — não é plataforma multi-tenant compartilhada por ora).
  Tabelas do V1: `clinicas`, `pacientes`, `conversas`, `mensagens`, `eventos_funil` (log de
  mudança de status — alimenta o resumo executivo e o alerta de lead esfriando), `consultas`.
- **WhatsApp:** Evolution API (self-hosted, conecta via QR, não exige migrar o número oficial da
  clínica) — rota não-oficial consciente pro V1; migração pra API oficial da Meta fica pra quando
  virar operação com vários clientes pagando.
- **Hospedagem da Evolution API:** Railway (template oficial, deploy de um clique) — validado por
  pesquisa como escolha certa **pra esta fase** (custo real esperado ~US$5-20/mês, não
  necessariamente o piso de US$5; há relatos de instabilidade recente, tolerável em fase de
  teste/demo). Quando replicar pra várias clínicas pagando, reavaliar VPS (ex: Hostinger) +
  Coolify — custo fixo por servidor em vez de consumo por instância, mais barato em escala.
- **Reaproveitado do Diagnóstico Digital** (`projetos/Noryos-Inovacoes/site/src/lib/`, por
  referência, não por dependência): padrão de scoring determinístico e versionado
  (`diagnostico-scoring.ts`) adaptado pro funil de atendimento; disciplina de persistência
  (`diagnostico-store.ts` — Supabase como driver principal, sem fallback silencioso em produção,
  log de erro sem PII, migração sempre aditiva); `rate-limit.ts`/`turnstile.ts` se o CRM ganhar
  formulário público; UI kit (`ui/`, `system/`) pra acelerar a interface.
- **Fora do V1, de propósito:** camada clínica/prontuário (fica com o Controle Odonto), chat 2-way
  completo dentro do CRM (v1 é visibilidade + ação leve), tráfego pago (entra só depois do CRM
  validado).

**Confirmar com a Ariadna antes de publicar de verdade** (tudo já centralizado em
`site/src/lib/config.ts` / `site/src/content/`, nada solto no código):
- [ ] Número oficial do WhatsApp (`config.ts` → `whatsappNumber`, hoje vazio — CTA cai no e-mail
  como fallback).
- [ ] Endereço: validar Setor Norte, Quadra 5, Lote 17 (existe registro antigo com outro lote).
- [ ] E-mail odontominasdf@gmail.com segue monitorado?
- [ ] Nome + CRO do responsável técnico da pessoa jurídica (pode ou não ser a própria Ariadna).
- [ ] Redação exata do item "2011 — atuação em Implantodontia" e confirmação do Mestrado em
  Biologia Oral (2019) — os dois ficam fora do site até ela validar (`equipe.ts`).
- [ ] Confirmar Endodontia/Periodontia como tratamentos oferecidos (`tratamentos.ts`, hoje
  `confirmado: false`, não aparecem no site).
- [ ] Convênios aceitos e formas de pagamento — FAQ hoje redireciona pro WhatsApp em vez de
  inventar resposta.
- [ ] Foto real da Dra. Ariadna e da clínica (fachada, recepção, consultório) — o site usa um
  painel editorial no lugar, nunca uma foto de banco fingindo ser da OdontoMinas.
- [ ] Domínio próprio (hoje usa `.example` reservado só pra não quebrar o build).
- [ ] Instagram/Facebook oficiais (hoje vazios em `config.ts`).

## Feito

- 2026-09-11: pasta criada, escopo e checklist de compliance do CFO documentados em
  `contexto.md`.
- 2026-09-11: logo salva em `marca/logo/logo_site.png`, design-guide atualizado com a cor real
  (teal/turquesa, fundo transparente).
- 2026-09-11: material institucional (prêmio, história, valores) recebido por WhatsApp e
  destilado em `contexto.md`.
- 2026-09-11: scaffold técnico do site criado em `site/` — Next.js 15 + Tailwind v4, UI kit
  reaproveitado do site institucional da Noryos (retemado de escuro pra claro/teal), 4 páginas
  (Home, Sobre, Serviços, Contato) com placeholder explícito onde falta fato real, formulário de
  contato direto pro WhatsApp (sem banco), faixa de compliance (nome+CRO) no rodapé de toda
  página. Testado localmente: `npm run build`/`typecheck`/`lint` limpos, 4 rotas verificadas no
  navegador sem erro de console.
- 2026-09-11: rebuild completo do site a pedido do Rafael (brief de agência: UX, copy, SEO local,
  compliance, performance, Cloudflare). Resumo — detalhe completo pedido separadamente:
  - Dados reais encontrados por pesquisa pública (CNPJ, endereço, telefone, CRO da Ariadna,
    horário, avaliações) entraram em `config.ts`/`content/equipe.ts`, com o que não pôde ser
    confirmado (WhatsApp, RT da PJ, mestrado, convênios) explicitamente fora do HTML publicado —
    nunca mais `[PLACEHOLDER: ...]` visível na página.
  - Home, Sobre e Serviços reconstruídos em composição editorial (texto+imagem alternado,
    numeração, timeline) — saiu o padrão "hero + 3 cards + FAQ" e o visual "tech/SaaS" herdado do
    Diagnóstico Digital (tech-grid, glow, spotlight de mouse); entrou um único motion system
    (fade-up/fade/scale-in + stagger, `prefers-reduced-motion` respeitado).
  - Novo: páginas `/politica-de-privacidade` e `/termos-de-uso` (LGPD), Schema.org Dentist +
    Service + FAQPage, eventos de analytics por origem de clique (`whatsapp_hero`,
    `whatsapp_implantes`, `phone_click`, `maps_click`...) via um listener único (`AnalyticsBinder`).
  - Hospedagem trocada de `output: "standalone"` (padrão Hostinger do site institucional) pra
    `output: "export"` + `public/_headers` (Cloudflare Pages) — decisão do dia, ver `_contexto`.
  - Validado: `typecheck`, `lint` e `next build` limpos; export estático em `site/out/` conferido
    (sem placeholder visível, formatação pt-BR correta, favicon real aplicado). Não testado em
    navegador de verdade (sem ferramenta de screenshot neste ambiente) — só via HTML renderizado e
    smoke test HTTP no dev server.
- 2026-09-12 (reconstruído de sessão que fechou a janela sem salvar — ver nota em "Onde está"):
  revisão de direção de arte do site (paleta de texto mais azulada, degradê de assinatura de 3
  tons, tipografia unificada em Manrope, motion de entrada mais discreto, hover do botão primário
  escurecendo em vez de clarear) e seção nova "Protocolo Correct Full Arch": `Hero.tsx` extraído
  com o placeholder antigo trocado por um diagrama SVG comparativo interativo
  (`CorrectTransformation.tsx`, slider manual + loop automático que respeita
  `prefers-reduced-motion`), seção dedicada com benefícios/jornada/FAQ próprios
  (`CorrectProtocol.tsx`, substituindo o antigo bloco genérico "Destaque Implantes"), copy em
  `content/protocolo.ts` sob os mesmos limites de compliance do CFO (nunca equiparar a "All-on-4",
  nunca afirmar quantidade fixa de implantes, carga imediata ou tratamento no mesmo dia). Validado:
  `typecheck`/`lint`/`next build` limpos, commitado e sincronizado no GitHub.
- 2026-09-12: primeiro deploy de produção. Rafael conectou o repositório à Cloudflare Pages pelo
  dashboard (root `clientes/odontominas/site`, build `npm run build`, saída `out`, deploy
  automático a cada push na `main`). Site confirmado no ar em https://odontominas.pages.dev/, com
  a seção do Protocolo Correct carregando. Ainda no subdomínio gratuito — domínio próprio é
  pendência separada.
- 2026-09-14 (fonte: reunião presencial de Rafael com o marido da Ariadna, relatada no chat no
  mesmo dia): escopo do piloto mudou. Deixa de ser "site+GMN grátis, tráfego cobrado à parte" e
  vira pacote completo de graça — site + CRM de captação/relacionamento + tráfego pago (verba de
  mídia por conta da clínica, gestão sem custo) — pensado como prova de conceito replicável: o
  marido tem contatos com outros dentistas e pretende indicar a mesma estrutura depois que rodar
  100% na OdontoMinas. Ordem de execução definida: site + CRM primeiro, tráfego pago entra depois
  que captação/follow-up estiver validado. Ver escopo completo em `contexto.md`.
- 2026-09-14: plano técnico do CRM fechado (stack, banco, arquitetura, hospedagem da Evolution API,
  o que reaproveitar do Diagnóstico Digital, fases de construção até a demo) — ver "Plano técnico
  do CRM" acima. Rafael confirmou número de WhatsApp separado pra teste (não o da clínica) e
  Railway como hospedagem da Evolution API pra esta fase.
- 2026-09-15: **Fase 2 do CRM completa e validada de ponta a ponta.** Scaffold Next.js 15 +
  TypeScript + Tailwind em `crm/`; migração V1 (`clinicas`, `pacientes`, `conversas`, `mensagens`,
  `eventos_funil`, `consultas`, todas com `clinica_id`, RLS ligado, ver `crm/supabase/migrations/`);
  webhook `/api/webhook/evolution` recebe `messages.upsert`, acha-ou-cria paciente/conversa por
  telefone, avança status `novo→respondido` na 1ª resposta da clínica (logado em `eventos_funil`),
  idempotência por `evolution_message_id`.
  - Migração precisou de 2ª passada: o projeto Supabase não tinha default privileges no schema
    `public` — toda tabela nova nascia sem `GRANT` pra `service_role` (RLS bypass e privilégio de
    tabela são camadas diferentes no Postgres). Corrigido em `2026-09-15_v1_grants.sql`.
  - Deploy no Railway, mesmo projeto da Evolution API (`illustrious-perfection`), serviço
    `odontominas-crm`, domínio `odontominas-crm-production.up.railway.app`. **Sem auto-deploy do
    GitHub ainda** — deploy é manual via `railway up` (CLI), não dispara sozinho em push na `main`
    como o site.
  - Bug real achado e corrigido: o endpoint validava a `apikey` do webhook contra a chave global da
    Evolution API, mas ela ecoa o **token da instância** (UUID de 36 caracteres) nesse campo, não a
    chave global (88 caracteres) — todo webhook real tomava 401 em silêncio. Corrigido aceitando as
    duas (env nova `EVOLUTION_INSTANCE_TOKEN`).
  - Validado com mensagem real de um segundo número (self-chat mostrou disparo de webhook
    inconsistente via Baileys, não serve de teste confiável): paciente, conversa e mensagem
    gravados certos, status avançou pra `respondido`. Dado de teste limpo do Supabase depois.
  - MCP: Supabase (`supabase-crm-odontominas`, HTTP/OAuth) ficou em "Pending approval" mesmo após
    3 aprovações numa sessão interativa separada — causa não identificada. Contornado com um MCP
    local (`supabase-crm`) autenticado por token de acesso pessoal. Railway CLI instalada e logada
    (`railway login --browserless`), MCP oficial configurado (`railway mcp install`). Os dois MCPs
    novos só ficam disponíveis numa sessão futura desta máquina.
- 2026-09-15: **Fase 3 do CRM completa e validada de ponta a ponta, em produção.** Painel de
  atendimento em `crm/src/app/page.tsx`: lista de conversas (paciente/telefone), status em dropdown
  colorido e clicável (a "ação leve" do plano técnico — grava em `eventos_funil` com
  `motivo: "manual"`), filtro por status via link, tempo até 1ª resposta calculado a partir do
  primeiro `eventos_funil` que tira a conversa de `novo` (destaque vermelho acima de 30min ainda
  sem resposta — o "uau" da demo), auto-refresh de 20s pra mensagem nova aparecer sozinha numa
  demonstração ao vivo. Zero dependência nova, só Tailwind. Testado com uma conversa sintética real
  no Supabase (criada e apagada na sessão).
  - Ao entregar, identificado que o painel não tinha login nenhum — URL pública do Railway expunha
    telefone e conversa de paciente (LGPD). Rafael decidiu 2 perfis (`admin`, `atendente`) em vez
    dos 6 cargos sugeridos (Admin, Gestor, Gerente, Dentista, Assistente, Atendente) — ver
    `_memoria/decisoes.md` pro porquê — e um remendo mínimo de senha antes de RBAC completo.
  - Implementado: `src/middleware.ts` protege painel + API (webhook da Evolution segue público, é
    servidor-a-servidor); cookie assinado por HMAC via Web Crypto (`src/lib/sessao.ts`, sem
    dependência nova, edge-safe); `/login` + logout; `.env.example` com as 3 variáveis novas
    (`PAINEL_SENHA_ADMIN`, `PAINEL_SENHA_ATENDENTE`, `SESSAO_SECRET`).
  - Deploy no Railway (`railway up`, serviço `odontominas-crm`) — variáveis setadas via MCP depois
    de aprovação explícita do Rafael (o classificador de modo automático bloqueia escrita de
    segredo em serviço remoto por padrão). Validado em produção: login errado rejeita, login certo
    entra com o papel certo, painel exige sessão, webhook segue aberto, serviço irmão
    (`evolution-api`) intocado.
  - **Senhas de produção hoje são as temporárias de desenvolvimento**
    (`dev-admin-temp`/`dev-atendente-temp`) — decisão consciente do Rafael, "por enquanto". Trocar
    antes de expor o painel pra equipe real da clínica (pendência acima).
- 2026-09-15 (revisão técnica, a pedido do Rafael: "análise aprofundada, melhorias e testes em
  tudo que foi feito até aqui"): leitura completa do código das Fases 1-3 (schema, webhook,
  sessão/login, middleware, painel) e 2 bugs reais encontrados e corrigidos:
  - Métrica "tempo até 1ª resposta" contava qualquer saída de `novo` como resposta — marcar uma
    conversa `perdido` direto a partir de `novo` (sem nunca responder) aparecia como "respondeu em
    Xmin" no painel, em verde. Corrigido: só conta transição de verdade pra `respondido`
    (`status_novo = 'respondido'` em `eventos_funil`, não qualquer saída de `novo`).
  - Conversa já resolvida (`respondido`/`agendado`/`perdido`) não reabria quando o paciente
    escrevia de novo — sumia do radar do painel em vez de voltar a aparecer como `novo` (um
    paciente pedindo remarcação, ou um lead "perdido" que volta a escrever, ficava invisível).
    Corrigido: mensagem nova reabre o ciclo — automático no webhook, manual pelo dropdown de
    status — com coluna nova `aguardando_desde` marcando o início do ciclo de espera atual
    (`primeira_mensagem_em` continua intacto como registro do 1º contato de sempre, pra não perder
    esse dado). Lógica de transição extraída pra `src/lib/funil.ts`, pura e testável isolada do
    Supabase.
  - Migração nova: `crm/supabase/migrations/2026-09-15_v2_aguardando_desde.sql` — **ainda não
    rodada** no Supabase (pendência acima).
  - Login: rate limit (`src/lib/rate-limit-login.ts`, 5 tentativas erradas / 15min por IP, em
    memória) e comparação de senha em tempo constante (`src/lib/senha.ts`, `node:crypto`
    `timingSafeEqual`) — as senhas continuam as temporárias, isto só reduz o risco de força bruta
    enquanto isso.
  - Testes: Vitest instalado (não existia nenhum teste no projeto), 71 testes novos cobrindo
    normalização de telefone/mensagem do Baileys (`evolution-webhook.ts`), formatação
    (`tempo.ts`), validação de status (`status.ts`), a regra de transição do funil (`funil.ts`),
    assinatura HMAC da sessão — token adulterado, expirado, segredo trocado (`sessao.ts`), rate
    limit e comparação de senha, e `conversas.ts` (listagem + troca manual de status) com um fake
    de Supabase em memória cobrindo os dois bugs acima. `npm run test`, `typecheck`, `lint` e
    `next build` — todos limpos.
  - `.mcp.json`: escopo do MCP do Supabase enxugado — ver `_memoria/decisoes.md` pro porquê.
  - `npm audit`: 4 vulnerabilidades em ferramenta de build/dev (postcss, vitest mocker), não em
    código servido; correção exige Next.js v16 (major breaking) — registrado, não urgente.
  - **Nada disso está em produção ainda**: falta rodar a migração no SQL Editor e fazer
    `railway up`. Nada foi commitado nem enviado ao GitHub nesta sessão.
- 2026-09-15: pendência de produção da revisão técnica fechada — migração
  `2026-09-15_v2_aguardando_desde.sql` rodada no SQL Editor do Supabase, `railway up` feito e
  validado (webhook 200, login 200, painel redireciona 307 sem sessão).
- 2026-09-15: **Fase 4 completa e validada em produção.** Ficha de paciente
  (`crm/src/app/pacientes/[id]/page.tsx`): dados de contato, status atual do funil, jornada
  (histórico de transições de `eventos_funil`) e histórico de mensagens em bolhas de chat —
  buscada por `paciente_id` (relação 1:1 com conversa, telefone é único por clínica nas duas
  tabelas). Resumo executivo (`crm/src/app/resumo/page.tsx`): contagens por status, tempo médio
  até 1ª resposta (só conta conversas que de fato viraram `respondido`/`agendado`) e lista de leads
  esfriando (em aberto há mais de `LIMITE_ESPERA_MS`, 30min) — o alerta que `contexto.md` já
  previa que `eventos_funil`/`aguardando_desde` deveriam alimentar. Painel principal agora linka o
  contato pra ficha (`crm/src/lib/conversas.ts` passou a expor `paciente_id`) e navega pro resumo.
  - Lógica de agregação extraída pura em `calcularResumo` (`crm/src/lib/resumo.ts`), testável sem
    Supabase — mesmo padrão de `funil.ts`. 4 testes novos, 75 no total; `typecheck`, `lint` e
    `next build` limpos.
  - Tabela `consultas` (agendamentos) ficou de fora da Fase 4 de propósito: nada no código escreve
    nela ainda (nem o webhook, nem o painel) — mostrar uma seção sempre vazia na ficha não
    agregaria nada agora. Ela deve entrar quando a Fase 5 (lembrete de consulta) precisar.
  - Validado ao vivo: com aprovação do Rafael, semeado um paciente/conversa/mensagens sintéticos
    direto no Supabase de produção (via REST, service role key) pra ver a ficha renderizada de
    verdade — nome, telefone, as duas mensagens (recebida/enviada), jornada "Novo → Respondido", e
    o resumo calculando o tempo médio certo (5min). Dado apagado logo em seguida.
  - **Achado técnico**: nem o CLI local do Supabase (logado numa conta que só enxerga o projeto
    `noryos-inovacoes`, não o `odontominas-crm`) nem o MCP local `supabase-crm` (citado como
    "ligado" numa sessão anterior) apareceram disponíveis nesta sessão — hoje só o SQL Editor
    manual funciona pra escrever neste banco. Corrigido em `ferramentas.md` da raiz.
  - Commitado (`29d4187`) e deployado no Railway (`railway up`).
- 2026-09-15: **Fase 5 completa e em produção.** Automação de reativação de paciente inativo.
  Perguntei ao Rafael qual das duas automações da pendência construir — lembrete de consulta
  dependia de criar do zero um jeito de cadastrar consulta (`consultas` segue sem nenhuma escrita,
  nem webhook nem painel gravam nela); reativação reaproveita dado que já existe. Ele escolheu
  reativação (decisão completa em `_memoria/decisoes.md`).
  - `crm/src/lib/evolution-send.ts`: primeiro ponto do código que **envia** mensagem (contraparte
    do webhook, que só recebia) — `POST {EVOLUTION_API_URL}/message/sendText/{instance}`.
  - `crm/src/lib/reativacao.ts`: regra pura (`selecionarCandidatos`) — conversa resolvida
    (respondido/agendado/perdido) sem mensagem há mais de 30 dias (`LIMITE_INATIVIDADE_MS`) vira
    candidata; manda 1x só por conversa (`ultima_reativacao_em` é o trinco, sem cadência de
    repetição automática na V1) — mais orquestração (`executarReativacao`) que busca no Supabase,
    manda pela Evolution API e grava (`ultima_reativacao_em`, `ultima_mensagem_em` e a mensagem em
    si, pra aparecer na ficha do paciente igual qualquer outra). Mensagem de check-in simples, sem
    promessa de resultado nem superlativo (Resolução CFO-196/2019).
  - `crm/src/app/api/cron/reativacao/route.ts`: dispara a automação, protegida por `CRON_SECRET`
    comparado em tempo constante — mesmo padrão do webhook (servidor-a-servidor, sem sessão de
    painel; adicionada às rotas públicas do `middleware.ts`).
  - Migração `2026-09-15_v3_reativacao.sql`: coluna `ultima_reativacao_em` em `conversas`.
  - **Decisão técnica**: em vez de um serviço novo no Railway só pra cron (custo e infra extra), o
    disparo diário roda por `.github/workflows/odontominas-crm-reativacao.yml` (GitHub Actions,
    1x/dia às ~9h Brasília, chama a rota via `curl` autenticado) — reaproveita o GitHub que já
    estava conectado, sem nada pago a mais.
  - De bônus: `crm/.env.example` nunca tinha sido versionado — o `.env*` do `.gitignore` excluía
    ele por engano (não tem segredo nenhum, só nome de variável). Corrigido.
  - 12 testes novos (87 no total); `typecheck`, `lint` e `next build` limpos.
  - Validação sem risco: antes de tocar produção, li (sem escrever) a tabela `conversas` do
    Supabase de produção direto por REST — confirmei que está vazia, então nenhum paciente real
    corria risco de receber mensagem nesta sessão. O classificador de modo automático bloqueou uma
    tentativa minha de chamar a rota com o segredo real pra smoke test (dispararia a automação de
    verdade) — segui só com checagens que não executam envio, por decisão do próprio Rafael de não
    validar com envio real desta vez.
  - Deploy: `CRON_SECRET` setado no Railway via MCP e `railway up` rodado. Rafael aplicou a
    migração no SQL Editor do Supabase e criou o secret `ODONTOMINAS_CRM_CRON_SECRET` no GitHub
    Actions (os 2 passos que esta sessão não conseguia fazer sozinha: sem MCP do Supabase
    disponível, sem `gh` CLI instalado nesta máquina — ver `ferramentas.md`). Commitado (`c72a211`)
    e enviado ao GitHub.
- 2026-09-15: preparo pra Fase 6. Ao testar o login em produção, o painel voltou "não consegui
  conectar ao banco".
  - **Bug real encontrado e corrigido**: logs do Railway mostraram `PGRST303 "JWT issued at
    future"` — erro transiente real do Supabase (a mesma consulta, refeita na mão, funcionou
    normal em seguida). `src/lib/clinica.ts` guardava esse resultado em cache **pra sempre**,
    inclusive quando era erro — um soluço passageiro do Supabase travava o painel até o processo
    reiniciar sozinho. Corrigido: só cacheia sucesso, nunca falha. Reiniciei o serviço no Railway
    (MCP) pra limpar o estado travado na hora, e depois deployei a correção. Testado
    (typecheck/lint/test/build limpos).
  - A pedido do Rafael ("admin e atendente têm os mesmos menus, não faz sentido"): Resumo
    executivo virou exclusivo de admin. `resumo/page.tsx` redireciona pro painel se quem não é
    admin tentar acessar (gate de verdade, não só esconder o link); `page.tsx` só mostra o link
    "Resumo" pra admin. Painel principal segue igual pros 2 papéis — é onde o atendente trabalha.
    Decisão completa em `_memoria/decisoes.md`.
  - Com aprovação do Rafael, semeei 5 conversas fictícias direto no Supabase de produção (nomes e
    telefones claramente falsos, 556199990001-5) cobrindo os 5 status: Camila Duarte (novo),
    Rodrigo Alves (aguardando 52min, aparece em vermelho), Fernanda Lima (respondido em 8min),
    Marcos Teixeira (agendado, jornada respondido→agendado), Beatriz Nogueira (perdido, inativa há
    47 dias, `ultima_reativacao_em` já preenchida de propósito pra não disparar mensagem de
    verdade no cron de amanhã). Validado ao vivo por login real (cookie de sessão): admin vê
    Resumo e entra (200), atendente não vê o link e toma redirect (307) se tentar a URL, os 5
    nomes aparecem certos no painel.
  - 2 deploys nesta sessão (1 só com a correção do cache, 1 com o RBAC do Resumo).

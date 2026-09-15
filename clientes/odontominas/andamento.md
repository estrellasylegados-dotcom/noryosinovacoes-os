# Andamento · OdontoMinas

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
- [ ] Fase 1 — infra: projeto Supabase novo (separado do Diagnóstico Digital) + Evolution API no
  Railway (template oficial), conectado no número de teste do Rafael, não o da clínica.
- [ ] Fase 2 — espelhamento: mensagem recebida/enviada grava em `conversas`/`mensagens`, sem tela
  ainda, só validar que o dado chega certo.
- [ ] Fase 3 — painel de atendimento (o "uau" da demo): lista de conversas, status
  (novo/respondido/aguardando/agendado/perdido), tempo até a 1ª resposta.
- [ ] Fase 4 — ficha de paciente + resumo executivo (dashboard simples).
- [ ] Fase 5 — 1 automação de destaque (lembrete de consulta ou reativação de paciente inativo).
- [ ] Fase 6 — demo pro marido; se validar, demo pra Ariadna.

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

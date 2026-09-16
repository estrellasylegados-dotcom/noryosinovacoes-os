-- ============================================================================
-- CRM OdontoMinas — V14: Pixel de Conversão (Agentes de IA)
-- Data: 2026-09-16
--
-- A pedido do Rafael: das 4 abas novas do print da RoiZap, "Pixel" tinha
-- ficado de fora (v12/v13) porque tráfego pago ainda não tinha começado no
-- piloto (ver decisão 2026-09-16 em _memoria/decisoes.md). Critério fechado
-- agora: 3 eventos do funil (novo lead, lead quente, agendado), disparados
-- pra Facebook Conversions API e Google Ads (Data Manager API), sem disparar
-- o mesmo evento 2x pra mesma conversa — ver src/lib/agentes-pixel.ts.
--
-- `pixel_ativo` nasce `false` — mesmo padrão de `qualificacao_automatica`
-- (v13): não muda nada no agente "Recepção Virtual" que já está em produção
-- até alguém preencher credencial de verdade e ligar o toggle.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v13.
-- ============================================================================

alter table public.agentes_ia
  add column if not exists pixel_ativo boolean not null default false,
  add column if not exists pixel_facebook_pixel_id text,
  add column if not exists pixel_facebook_access_token text,
  add column if not exists pixel_google_customer_id text,
  add column if not exists pixel_google_login_customer_id text,
  add column if not exists pixel_google_refresh_token text,
  add column if not exists pixel_google_conversion_action_novo_lead text,
  add column if not exists pixel_google_conversion_action_quente text,
  add column if not exists pixel_google_conversion_action_agendado text;

-- `ultimo_agente_id` persiste qual agente é "dono" da conversa mesmo depois
-- que `agente_ativo_id` zera (fluxo concluído) — é dele que o disparo do
-- evento "agendado" (troca manual de status, src/lib/conversas.ts) busca a
-- config de Pixel, já que nesse momento o agente pode não estar mais ativo.
alter table public.conversas
  add column if not exists ultimo_agente_id uuid references public.agentes_ia (id) on delete set null;

alter table public.conversas
  add column if not exists pixel_novo_lead_enviado_em timestamptz,
  add column if not exists pixel_quente_enviado_em timestamptz,
  add column if not exists pixel_agendado_enviado_em timestamptz;

-- Atribuição do lead — hoje só `origem_lead` tem chance real de ser
-- preenchida (contextInfo.externalAdReplyInfo do próprio protocolo do
-- WhatsApp, melhor-esforço). utm_*/gclid/fbclid não têm canal de chegada
-- ainda (Evolution API é Baileys, não a API oficial da Meta — ctwa_clid só
-- existe lá; o site manda pro WhatsApp sem querystring de tracking) — as
-- colunas nascem prontas pra quando existir, mas ficam null por enquanto.
alter table public.pacientes
  add column if not exists origem_lead text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists gclid text,
  add column if not exists fbclid text;

create index if not exists conversas_ultimo_agente_idx on public.conversas (ultimo_agente_id);

-- Verificação rápida (opcional):
--   select id, nome, pixel_ativo from public.agentes_ia;
--   select ultimo_agente_id, pixel_novo_lead_enviado_em, pixel_quente_enviado_em, pixel_agendado_enviado_em from public.conversas limit 5;
--   select origem_lead, utm_source, gclid, fbclid from public.pacientes limit 5;

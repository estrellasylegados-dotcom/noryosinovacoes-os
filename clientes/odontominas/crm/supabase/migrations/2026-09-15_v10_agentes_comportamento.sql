-- ============================================================================
-- CRM OdontoMinas — V10: Agentes de IA, Fase 2A (comportamento + segurança)
-- Data: 2026-09-15
--
-- Depois da v9 (schema base dos Agentes de IA), Rafael comparou com o print
-- completo da RoiZap de novo e pediu mais comportamento. Adaptado ao que faz
-- sentido numa clínica de instância única (sem multi-cliente/faturamento):
-- horário de atendimento, tamanho máximo de resposta, pausar após concluir o
-- fluxo, dividir resposta em mensagens curtas, transferência pra humano de
-- verdade (com detecção), e "Avisar Membro da Equipe" (a rede de segurança —
-- notifica um número interno quando a IA não sabe responder, o paciente pede
-- humano, mostra intenção de compra, ou é um lead novo).
--
-- Mesma tabela `agentes_ia` já existente (migração v9) e já com grant pro
-- service_role — GRANT é por tabela, não por coluna, não precisa repetir
-- aqui.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v9.
-- ============================================================================

alter table public.agentes_ia
  add column if not exists responder_apenas_horario boolean not null default false;

alter table public.agentes_ia
  add column if not exists horario_inicio text;

alter table public.agentes_ia
  add column if not exists horario_fim text;

alter table public.agentes_ia
  add column if not exists max_caracteres_resposta integer;

alter table public.agentes_ia
  add column if not exists pausar_apos_concluir_fluxo boolean not null default false;

alter table public.agentes_ia
  add column if not exists dividir_em_mensagens_curtas boolean not null default false;

alter table public.agentes_ia
  add column if not exists ativar_transferencia boolean not null default false;

alter table public.agentes_ia
  add column if not exists notificar_numeros text;

alter table public.agentes_ia
  add column if not exists notificar_pedido_humano boolean not null default true;

alter table public.agentes_ia
  add column if not exists notificar_fallback boolean not null default false;

alter table public.agentes_ia
  add column if not exists notificar_intencao_compra boolean not null default false;

alter table public.agentes_ia
  add column if not exists notificar_novo_lead boolean not null default false;

alter table public.agentes_ia
  add column if not exists mensagem_notificacao text;

-- Verificação rápida (opcional):
--   select nome, responder_apenas_horario, ativar_transferencia, notificar_numeros
--   from public.agentes_ia;

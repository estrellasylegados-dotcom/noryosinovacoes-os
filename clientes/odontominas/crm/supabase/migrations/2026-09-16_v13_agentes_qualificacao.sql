-- ============================================================================
-- CRM OdontoMinas — V13: Qualificação Automática de Leads (Agentes de IA)
-- Data: 2026-09-16
--
-- A pedido do Rafael: das 4 abas novas do print da RoiZap, "Qualificação"
-- tinha ficado de fora na v12 porque não tinha critério definido (ver
-- decisão 2026-09-16 em _memoria/decisoes.md). Critério fechado agora:
-- escala fixa Quente/Morno/Frio, reavaliada depois de cada resposta do
-- agente (src/lib/agentes-qualificacao.ts).
--
-- `qualificacao_automatica` nasce `false` — não muda nada no agente
-- "Recepção Virtual" que já está em produção, mesmo padrão de `modo_prompt`
-- na v12. As 3 etiquetas (Quente/Morno/Frio) não nascem aqui: são criadas
-- por clínica, na hora, só quando alguém liga o toggle (garantirEtiquetasQualificacao),
-- pra não sujar clínica que nunca usar a função.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v12.
-- ============================================================================

alter table public.agentes_ia
  add column if not exists qualificacao_automatica boolean not null default false;

-- Verificação rápida (opcional):
--   select id, nome, qualificacao_automatica from public.agentes_ia;

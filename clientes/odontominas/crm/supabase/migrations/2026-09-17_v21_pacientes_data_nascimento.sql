-- ============================================================================
-- CRM OdontoMinas — V21: pacientes.data_nascimento
-- Data: 2026-09-17
--
-- Fase 3 do motor de Fluxo de Conversa (evolução arquitetural — ver
-- _memoria/decisoes.md). Campo opcional: nunca preenchido com dado falso,
-- editável na ficha do paciente (src/components/pacientes/
-- PacienteDataNascimento.tsx), usado pelo scanner temporal de aniversário
-- (src/lib/fluxo-scanner-temporal.ts).
--
-- Sem índice funcional por mês/dia nesta migration — volume atual (1 clínica
-- piloto) não justifica; o scanner filtra em aplicação. Reavaliar índice
-- quando o volume de pacientes com data_nascimento preenchida crescer.
--
-- Rodar depois da v20.
-- ============================================================================

alter table public.pacientes
  add column if not exists data_nascimento date;

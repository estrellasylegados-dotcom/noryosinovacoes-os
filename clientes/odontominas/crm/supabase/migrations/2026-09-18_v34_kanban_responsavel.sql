-- ============================================================================
-- CRM OdontoMinas — V34: troca manual de responsável da oportunidade (atômica)
-- Data: 2026-09-18. Aditiva. Rodar depois da v33.
-- p_esperado = responsável que quem chamou VIU (concorrência otimista, mesmo
-- padrão de transferir_conversa). Não mexe em `versao` (versão = estágio).
-- ROLLBACK: drop function if exists public.definir_responsavel_oportunidade(uuid, uuid, uuid, uuid, uuid, text);
-- ============================================================================
create or replace function public.definir_responsavel_oportunidade(
  p_clinica uuid, p_oportunidade uuid, p_esperado uuid, p_novo uuid, p_ator uuid, p_origem text default 'manual'
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_atual uuid;
begin
  if p_novo is not null and not exists (
    select 1 from public.atendentes where id = p_novo and clinica_id = p_clinica and status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'responsavel_invalido');
  end if;

  update public.oportunidades set responsavel_id = p_novo, updated_at = now()
  where id = p_oportunidade and clinica_id = p_clinica
    and responsavel_id is not distinct from p_esperado and responsavel_id is distinct from p_novo;

  if found then
    insert into public.oportunidade_historico (clinica_id, oportunidade_id, tipo, responsavel_de, responsavel_para, ator_id, origem)
    values (p_clinica, p_oportunidade, 'owner_changed', p_esperado, p_novo, p_ator, p_origem);
    return jsonb_build_object('ok', true);
  end if;

  select responsavel_id into v_atual from public.oportunidades where id = p_oportunidade and clinica_id = p_clinica;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_atual is not distinct from p_novo then return jsonb_build_object('ok', true, 'sem_mudanca', true); end if;
  return jsonb_build_object('ok', false, 'error', 'conflito', 'por_id', v_atual);
end $$;

grant execute on function public.definir_responsavel_oportunidade(uuid, uuid, uuid, uuid, uuid, text) to service_role;

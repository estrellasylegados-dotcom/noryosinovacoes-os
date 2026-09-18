-- ============================================================================
-- CRM OdontoMinas — V32: trocar o canal principal de forma atômica
-- Data: 2026-09-18
--
-- `canais_principal_unq` (1 principal por clínica) impede fazer "marca o novo,
-- desmarca o velho" em dois UPDATEs soltos; esta função faz os dois na mesma
-- transação, então nunca existe um instante sem canal principal.
-- Rodar depois da v30.
-- ============================================================================

create or replace function public.definir_canal_principal(p_clinica uuid, p_canal uuid)
returns jsonb language plpgsql as $$
begin
  if not exists (select 1 from public.canais where id = p_canal and clinica_id = p_clinica and ativo) then
    return jsonb_build_object('ok', false, 'error', 'canal_invalido');
  end if;
  update public.canais set principal = false, updated_at = now()
    where clinica_id = p_clinica and principal and id <> p_canal;
  update public.canais set principal = true, updated_at = now() where id = p_canal;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.definir_canal_principal(uuid, uuid) to service_role;

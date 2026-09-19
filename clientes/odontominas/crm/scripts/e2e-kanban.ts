/**
 * Teste real (banco de produção) do Kanban, sem login/UI: usa o MESMO código das rotas
 * (src/lib/kanban.ts + atribuicao.ts) com as atendentes "[TESTE]" como atores.
 * Cria SÓ dados "[TESTE KANBAN]" (telefones 55000000KBxx) e NÃO apaga nada: evidência
 * preservada até a apresentação. Não imprime segredo.
 *
 * Uso (na pasta crm/): npx vite-node --config vitest.config.ts scripts/e2e-kanban.ts
 * Lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env.local.
 */
import { readFileSync } from "node:fs";

for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  if (!l || l.startsWith("#") || !l.includes("=")) continue;
  const i = l.indexOf("=");
  const k = l.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const { getSupabaseServerClient } = await import("@/lib/supabase");
const { getClinicaId } = await import("@/lib/clinica");
const { buscarAtendenteCompletoPorId } = await import("@/lib/atendentes");
const { PERFIS_PADRAO, resolverPermissoes } = await import("@/lib/permissoes");
const K = await import("@/lib/kanban");
const { assumirConversa, transferirConversa } = await import("@/lib/atribuicao");
const { adicionarEtiquetaConversa } = await import("@/lib/etiquetas");
const { buscarStatusSlaLista } = await import("@/lib/sla");

const supabase = getSupabaseServerClient()!;
const clinicaId = (await getClinicaId())!;
let falhas = 0;
const confere = (cond: boolean, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHOU"} ${msg}`);
  if (!cond) falhas++;
};

const { data: quem } = await supabase.from("atendentes").select("id, usuario").in("usuario", ["teste_atendente_a", "teste_atendente_b", "teste_supervisora"]);
const idDe = (u: string) => quem?.find((a) => a.usuario === u)?.id as string;
const [A, B] = [idDe("teste_atendente_a"), idDe("teste_atendente_b")];
const SUP = idDe("teste_supervisora");
async function atorReal(id: string) {
  const a = (await buscarAtendenteCompletoPorId(id))!;
  return { atendenteId: a.id, perfil: a.perfil, permissoes: resolverPermissoes(a.perfil, a.permissoesCustomizadas) };
}
const atorA = await atorReal(A);
const atorB = await atorReal(B);
const atorSup = SUP ? await atorReal(SUP) : { atendenteId: A, perfil: "supervisora" as const, permissoes: PERFIS_PADRAO.supervisora };
// Gerência (kanban.mover + visualizar_todas) usando o id da conta de teste A só como "quem fez".
const atorGerente = { atendenteId: A, perfil: "gerente" as const, permissoes: PERFIS_PADRAO.gerente };

const { data: canal } = await supabase.from("canais").select("id, nome").eq("provider_instance_id", "teste-recepcao").single();
const sufixo = Date.now().toString().slice(-6);
const tel = (n: number) => `55000${sufixo}${String(n).padStart(2, "0")}`;

async function novoLead(nome: string, tel: string, origem: string | null = null) {
  const { data: p } = await supabase.from("pacientes").insert({ clinica_id: clinicaId, telefone: tel, nome: `[TESTE KANBAN] ${nome}`, origem_lead: origem }).select("id").single();
  const agora = new Date().toISOString();
  const { data: c } = await supabase
    .from("conversas")
    .insert({ clinica_id: clinicaId, canal_id: canal!.id, paciente_id: p!.id, telefone: tel, status: "novo", primeira_mensagem_em: agora, ultima_mensagem_em: agora, aguardando_desde: agora })
    .select("id")
    .single();
  await K.garantirOportunidadeDaConversa(clinicaId, p!.id as string, c!.id as string, { conversaNova: true });
  const { data: o } = await supabase.from("oportunidades").select("*").eq("paciente_id", p!.id).eq("status", "open").single();
  return { pacienteId: p!.id as string, conversaId: c!.id as string, opp: o! };
}
const estagios = (await supabase.from("pipeline_estagios").select("id, nome, tipo").eq("clinica_id", clinicaId).order("ordem")).data!;
const est = (nome: string) => estagios.find((e) => e.nome === nome)!.id as string;
const carregar = async (id: string) => (await supabase.from("oportunidades").select("*").eq("id", id).single()).data!;
const historico = async (id: string) => (await supabase.from("oportunidade_historico").select("*").eq("oportunidade_id", id).order("created_at")).data!;
const eventos = async (id: string) => (await supabase.from("automacao_eventos").select("id").eq("evento_tipo", "kanban_stage_changed").contains("detalhe", { oportunidade_id: id })).data!;

console.log("== 1. Criação (paciente novo → 1 oportunidade; retry não duplica)");
const maria = await novoLead("Maria Implante", tel(1), "instagram");
confere(maria.opp.estagio_id === est("Novo"), "nasce em Novo");
await K.garantirOportunidadeDaConversa(clinicaId, maria.pacienteId, maria.conversaId, { conversaNova: true });
await K.garantirOportunidadeDaConversa(clinicaId, maria.pacienteId, maria.conversaId, { conversaNova: false });
const { count: nMaria } = await supabase.from("oportunidades").select("id", { count: "exact", head: true }).eq("paciente_id", maria.pacienteId);
confere(nMaria === 1, "retry (nova/antiga) não duplica: 1 oportunidade");
const dup = await supabase.from("oportunidades").insert({ clinica_id: clinicaId, paciente_id: maria.pacienteId, pipeline_id: maria.opp.pipeline_id, estagio_id: maria.opp.estagio_id });
confere(dup.error?.code === "23505", "índice único parcial barra 2ª aberta (23505)");
const manual = await K.criarOportunidadeManual(clinicaId, atorGerente, maria.pacienteId, "Clareamento");
confere(!manual.ok && manual.error === "ja_existe_aberta", "criação manual com aberta existente → ja_existe_aberta");
await K.atualizarInteresse(clinicaId, atorGerente, maria.opp.id as string, "Implante");

console.log("== 2. Fluxo completo Novo → … → Convertido (persistido + histórico + evento)");
let versao = maria.opp.versao as number;
for (const nome of ["Em atendimento", "Qualificado", "Agendado", "Follow-up"]) {
  const r = await K.moverOportunidade(clinicaId, atorGerente, maria.opp.id as string, { estagioId: est(nome), versaoEsperada: versao });
  confere(r.ok && r.estagioId === est(nome), `→ ${nome}`);
  if (r.ok) versao = r.versao;
}
const conv = await K.moverParaTipo(clinicaId, atorGerente, maria.opp.id as string, "won", { versaoEsperada: versao });
confere(conv.ok && conv.status === "won", "→ Convertido (won)");
const mRow = await carregar(maria.opp.id as string);
confere(mRow.status === "won" && mRow.converted_at !== null && mRow.estagio_id === est("Convertido"), "linha persistida como won + converted_at");
const hMaria = await historico(maria.opp.id as string);
confere(hMaria.filter((h) => h.tipo === "stage_changed").length === 5, "5 mudanças de estágio no histórico (+ criação)");
confere((await eventos(maria.opp.id as string)).length === 5, "5 eventos kanban_stage_changed em automacao_eventos");

console.log("== 3. Perdido exige motivo");
const joao = await novoLead("Joao Perdido", tel(2));
const semMotivo = await K.moverParaTipo(clinicaId, atorGerente, joao.opp.id as string, "lost", { versaoEsperada: 1 });
confere(!semMotivo.ok && semMotivo.error === "motivo_obrigatorio", "sem motivo → motivo_obrigatorio");
const { data: motivo } = await supabase.from("motivos_perda").select("id").eq("clinica_id", clinicaId).eq("nome", "Preço").single();
const perdeu = await K.moverParaTipo(clinicaId, atorGerente, joao.opp.id as string, "lost", { versaoEsperada: 1, motivoPerdaId: motivo!.id as string, observacao: "achou caro [TESTE KANBAN]" });
const jRow = await carregar(joao.opp.id as string);
confere(perdeu.ok && jRow.status === "lost" && jRow.motivo_perda_id === motivo!.id && jRow.lost_at !== null && jRow.motivo_perda_obs?.includes("caro"), "perdido persistido com motivo estruturado + obs + lost_at");

console.log("== 4. Concorrência (A e B em paralelo, mesma versão)");
const ana = await novoLead("Ana Concorrencia", tel(3));
const [rA, rB] = await Promise.all([
  K.moverOportunidade(clinicaId, atorGerente, ana.opp.id as string, { estagioId: est("Qualificado"), versaoEsperada: 1 }),
  K.moverOportunidade(clinicaId, atorGerente, ana.opp.id as string, { estagioId: est("Perdido"), versaoEsperada: 1, motivoPerdaId: motivo!.id as string }),
]);
confere([rA, rB].filter((r) => r.ok).length === 1 && [rA, rB].filter((r) => !r.ok && r.error === "conflito").length === 1, "exatamente 1 vence e o outro recebe conflito (409)");
confere((await historico(ana.opp.id as string)).filter((h) => h.tipo === "stage_changed").length === 1, "só 1 histórico de estágio");

console.log("== 5. Idempotência");
const bia = await novoLead("Bia Idempotencia", tel(4));
const chave = `e2e-${sufixo}`;
const r1 = await K.moverOportunidade(clinicaId, atorGerente, bia.opp.id as string, { estagioId: est("Em atendimento"), versaoEsperada: 1, idempotencyKey: chave });
const r2 = await K.moverOportunidade(clinicaId, atorGerente, bia.opp.id as string, { estagioId: est("Em atendimento"), versaoEsperada: 1, idempotencyKey: chave });
confere(r1.ok && r2.ok && Boolean(r2.ok && r2.idempotente), "retry devolve idempotente");
confere((await historico(bia.opp.id as string)).filter((h) => h.tipo === "stage_changed").length === 1 && (await eventos(bia.opp.id as string)).length === 1, "1 histórico e 1 evento (sem duplicar)");

console.log("== 6. RBAC e clínica");
const rSup = await K.moverOportunidade(clinicaId, atorSup, bia.opp.id as string, { estagioId: est("Qualificado"), versaoEsperada: 2 });
confere(!rSup.ok && rSup.error === "forbidden", "Supervisora (sem kanban.mover) → forbidden");
await K.definirResponsavel(clinicaId, atorGerente, bia.opp.id as string, null, A);
const rB2 = await K.moverOportunidade(clinicaId, atorB, bia.opp.id as string, { estagioId: est("Qualificado"), versaoEsperada: 2 });
confere(!rB2.ok && rB2.error === "forbidden", "Atendente B não move card da A");
const rA2 = await K.moverOportunidade(clinicaId, atorA, bia.opp.id as string, { estagioId: est("Qualificado"), versaoEsperada: 2 });
confere(rA2.ok, "Atendente A (kanban.mover) move o próprio card");
const rOutra = await K.moverOportunidade("00000000-0000-0000-0000-000000000000", atorGerente, bia.opp.id as string, { estagioId: est("Qualificado"), versaoEsperada: 3 });
confere(!rOutra.ok && rOutra.error === "not_found", "outra clínica nunca alcança a oportunidade");
const boardB = await K.buscarBoard(clinicaId, atorB);
confere(boardB.ok && !boardB.board.cards.some((c) => c.id === bia.opp.id) && boardB.board.cards.some((c) => c.id === ana.opp.id), "B não vê card da A, vê os sem responsável");

console.log("== 7. Responsável (assumir / transferir)");
const cris = await novoLead("Cris Assumir", tel(5));
await assumirConversa(clinicaId, cris.conversaId, atorA);
confere((await carregar(cris.opp.id as string)).responsavel_id === A, "conversa assumida por A → oportunidade sem responsável recebe A");
const dora = await novoLead("Dora Ja Tem Dono", tel(6));
await K.definirResponsavel(clinicaId, atorGerente, dora.opp.id as string, null, B);
await assumirConversa(clinicaId, dora.conversaId, atorA);
confere((await carregar(dora.opp.id as string)).responsavel_id === B, "oportunidade que já tem dono NÃO é trocada ao assumir");
await transferirConversa(clinicaId, cris.conversaId, atorA, A, B);
confere((await carregar(cris.opp.id as string)).responsavel_id === B, "transferência: responsável comercial = anterior da conversa → vai junto");
await transferirConversa(clinicaId, dora.conversaId, atorA, A, SUP);
confere((await carregar(dora.opp.id as string)).responsavel_id === B, "transferência: responsável comercial ≠ anterior da conversa → oportunidade preservada");
const hCris = await historico(cris.opp.id as string);
confere(hCris.filter((h) => h.tipo === "owner_changed").length === 2, "histórico de responsável registrado (assumir + transferir)");

console.log("== 8. Tags, canal, origem, SLA (sem alterar estágio)");
const { data: tag } = await supabase.from("etiquetas").select("id").eq("clinica_id", clinicaId).eq("nome", "[TESTE KANBAN] Urgente").maybeSingle();
let tagId = tag?.id as string | undefined;
if (!tagId) tagId = (await supabase.from("etiquetas").insert({ clinica_id: clinicaId, nome: "[TESTE KANBAN] Urgente", cor: "#dc2626" }).select("id").single()).data!.id as string;
const estagioAntes = (await carregar(maria.opp.id as string)).estagio_id;
await adicionarEtiquetaConversa(clinicaId, maria.conversaId, tagId);
const board = await K.buscarBoard(clinicaId, atorGerente, { etiquetaIds: [tagId] });
confere(board.ok && board.board.cards.length === 1 && board.board.cards[0].id === maria.opp.id, "filtro por tag acha só o card marcado");
confere((await carregar(maria.opp.id as string)).estagio_id === estagioAntes, "adicionar tag não muda o estágio");
const cardMaria = board.ok ? board.board.cards[0] : null;
confere(cardMaria?.canalNome === canal!.nome && cardMaria?.origem === "instagram", "card mostra canal da conversa e origem existente");
const boardTudo = await K.buscarBoard(clinicaId, atorGerente);
const slaLista = await buscarStatusSlaLista(clinicaId, new Date());
const cardCris = boardTudo.ok ? boardTudo.board.cards.find((c) => c.id === cris.opp.id) : null;
const slaCris = slaLista.find((i) => i.conversaId === cris.conversaId)?.status;
confere(cardCris?.sla === (slaCris && slaCris.tipo !== "sem_ciclo" ? slaCris.tipo : null), `card espelha o SLA do serviço existente (${cardCris?.sla ?? "sem ciclo"})`);

console.log("== 9. Reload");
const reload = await K.buscarBoard(clinicaId, atorGerente);
const cardMariaRelido = reload.ok ? reload.board.cards.find((c) => c.id === maria.opp.id) : null;
confere(cardMariaRelido?.estagioId === est("Convertido") && cardMariaRelido.status === "won", "após reload o card segue em Convertido");
const det = await K.buscarDetalheOportunidade(clinicaId, atorGerente, maria.opp.id as string);
confere(det.ok && det.detalhe.historico.length === 6, "detalhe traz o histórico completo (6 entradas)");

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);

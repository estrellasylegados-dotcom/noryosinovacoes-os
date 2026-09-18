/**
 * Teste real de produção da caixa compartilhada (sem login/UI): mensagem real
 * recebida → canal → conversa sem responsável → A assume → B NÃO responde →
 * A responde (envio real pelo canal) → A transfere pra B → A NÃO responde →
 * B responde (envio real) → histórico. Usa o código de produção (mesmas
 * funções das rotas) com as atendentes "[TESTE]" como atores. Não imprime segredo.
 *
 * Uso: railway run --service odontominas-crm -- npx vite-node --config vitest.config.ts \
 *        scripts/e2e-canais-fluxo-real.ts -- <telefone da conversa, só dígitos>
 */
import { getSupabaseServerClient } from "@/lib/supabase";
import { getClinicaId } from "@/lib/clinica";
import { assumirConversa, transferirConversa, type AtorConversa } from "@/lib/atribuicao";
import { enviarRespostaChat } from "@/lib/chat";
import { PERFIS_PADRAO, type Perfil } from "@/lib/permissoes";

const telefone = process.argv[process.argv.length - 1].replace(/\D/g, "");
const supabase = getSupabaseServerClient()!;
const clinicaId = (await getClinicaId())!;

async function ator(usuario: string): Promise<AtorConversa & { nome: string }> {
  const { data } = await supabase.from("atendentes").select("id, nome, perfil").eq("clinica_id", clinicaId).eq("usuario", usuario).single();
  const perfil = data!.perfil as Perfil;
  return { atendenteId: data!.id as string, nome: data!.nome as string, perfil, permissoes: PERFIS_PADRAO[perfil] };
}
const A = await ator("teste_atendente_a");
const B = await ator("teste_atendente_b");

const { data: conv } = await supabase
  .from("conversas")
  .select("id, status, atribuido_a, aguardando_desde, canal_id, canais(nome, provider_instance_id)")
  .eq("clinica_id", clinicaId)
  .eq("telefone", telefone)
  .single();
const conversaId = conv!.id as string;
const canalNome = (conv!.canais as unknown as { nome: string }).nome;
const aguardandoAntes = conv!.aguardando_desde as string;
const resultados: [string, boolean, string][] = [];
const passo = (nome: string, ok: boolean, detalhe = "") => {
  resultados.push([nome, ok, detalhe]);
  console.log(`${ok ? "OK    " : "FALHOU"} ${nome}${detalhe ? " — " + detalhe : ""}`);
};

passo("conversa chegou pelo canal certo e sem responsável", conv!.atribuido_a === null, `canal="${canalNome}", status=${conv!.status}`);

const assumiu = await assumirConversa(clinicaId, conversaId, A);
passo("Atendente A assume", assumiu.ok, JSON.stringify(assumiu));

const bNega = await enviarRespostaChat(clinicaId, conversaId, "[TESTE Canais] B não deveria conseguir enviar isto", B);
passo("Atendente B (comum) é BARRADA ao responder conversa da A", !bNega.ok && bNega.error === "nao_e_responsavel", bNega.error ?? "enviou!");

const aResp = await enviarRespostaChat(clinicaId, conversaId, "[TESTE Canais] Resposta da Atendente A pelo canal " + canalNome, A);
passo("Atendente A responde (envio real pelo canal)", aResp.ok, aResp.error ?? "mensagem enviada");

const transf = await transferirConversa(clinicaId, conversaId, A, A.atendenteId, B.atendenteId, "troca de turno (teste)");
passo("A transfere para B", transf.ok, JSON.stringify(transf));

const aNega = await enviarRespostaChat(clinicaId, conversaId, "[TESTE Canais] A não deveria mais conseguir enviar isto", A);
passo("A é BARRADA depois de transferir", !aNega.ok && aNega.error === "nao_e_responsavel", aNega.error ?? "enviou!");

const bResp = await enviarRespostaChat(clinicaId, conversaId, "[TESTE Canais] Resposta da Atendente B após a transferência", B);
passo("Atendente B responde (envio real pelo canal)", bResp.ok, bResp.error ?? "mensagem enviada");

const { data: fim } = await supabase.from("conversas").select("atribuido_a, aguardando_desde, status").eq("id", conversaId).single();
passo("responsável final = B", fim!.atribuido_a === B.atendenteId);
passo("SLA: aguardando_desde não foi zerado por assumir/transferir", new Date(fim!.aguardando_desde as string).getTime() === new Date(aguardandoAntes).getTime());

const { data: eventos } = await supabase.from("conversa_eventos").select("tipo, ator_id, de_atendente_id, para_atendente_id, motivo, created_at").eq("conversa_id", conversaId).order("created_at");
console.log("\nHistórico (conversa_eventos):");
const nome = (id: string | null) => (id === A.atendenteId ? "A" : id === B.atendenteId ? "B" : id ? "?" : "-");
for (const e of eventos ?? []) console.log(`  ${e.tipo}  ator=${nome(e.ator_id as string)}  de=${nome(e.de_atendente_id as string)}  para=${nome(e.para_atendente_id as string)}  ${e.motivo ?? ""}`);
passo("histórico registra assign + transfer", (eventos ?? []).some((e) => e.tipo === "CONVERSATION_ASSIGNED") && (eventos ?? []).some((e) => e.tipo === "CONVERSATION_TRANSFERRED"));

const { data: msgs } = await supabase.from("mensagens").select("direcao, enviada_por_atendente_id, conteudo").eq("conversa_id", conversaId).like("conteudo", "[TESTE Canais]%").order("created_at");
console.log("\nMensagens gravadas:");
for (const m of msgs ?? []) console.log(`  ${m.direcao}  por=${nome(m.enviada_por_atendente_id as string)}  "${String(m.conteudo).slice(0, 60)}"`);

const falhas = resultados.filter((r) => !r[1]).length;
console.log(falhas === 0 ? "\nRESULTADO: OK" : `\nRESULTADO: ${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);

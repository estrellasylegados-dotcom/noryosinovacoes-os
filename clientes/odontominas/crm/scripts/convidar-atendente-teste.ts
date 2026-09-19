/**
 * Convite oficial para conta `[TESTE] Atendente` JÁ EXISTENTE (sem senha e sem e-mail),
 * preservando o id e o histórico (conversas atribuídas, transferências, evidência do E2E).
 * Liga o e-mail, coloca a conta em `invited` e dispara o convite oficial (token aleatório,
 * só hash no banco, 24h, uso único — src/lib/convites.ts). A pessoa define a própria senha.
 *
 * Uso (credenciais de produção injetadas pelo Railway, nunca no repositório):
 *   railway run --service odontominas-crm -- npx vite-node --config vitest.config.ts \
 *     scripts/convidar-atendente-teste.ts -- --id <uuid> --email <e-mail> [--dry-run | --reenviar]
 *
 * Proteções: só age em conta com nome começando por "[TESTE] Atendente", perfil `atendente`,
 * sem senha e sem e-mail (ou já `invited` com o mesmo e-mail, com --reenviar). Nunca imprime token.
 */
import { normalizarEmail } from "@/lib/atendentes";
import { registrarEvento } from "@/lib/auditoria";
import { getClinicaId } from "@/lib/clinica";
import { criarConvite } from "@/lib/convites";
import { enviarEmailConvite } from "@/lib/email";
import { sanitizarMensagemErro } from "@/lib/sanitizar-erro";
import { getSupabaseServerClient } from "@/lib/supabase";

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (nome: string) => process.argv.includes(`--${nome}`);

function sair(msg: string, codigo = 1): never {
  console.log(msg);
  process.exit(codigo);
}

async function main() {
  const id = (arg("id") ?? "").trim();
  const email = normalizarEmail(arg("email") ?? "");
  if (!id || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) sair("Parâmetros inválidos. Use --id <uuid> --email <e-mail>.");

  const supabase = getSupabaseServerClient();
  const clinicaId = await getClinicaId();
  if (!supabase || !clinicaId) sair("Sem acesso ao banco (rode via `railway run`, com as variáveis de produção).");

  const { data: conta, error } = await supabase!
    .from("atendentes")
    .select("id, nome, email, perfil, status, senha_hash, clinica_id")
    .eq("id", id)
    .maybeSingle();
  if (error) sair(`Falha ao buscar a conta: ${sanitizarMensagemErro(error.message)}`);
  if (!conta || conta.clinica_id !== clinicaId) sair("Conta não encontrada nesta clínica. Nada foi feito.");
  if (!String(conta.nome).startsWith("[TESTE] Atendente") || conta.perfil !== "atendente") sair("Esta ferramenta só age em conta `[TESTE] Atendente` de perfil atendente. Nada foi feito.");
  if (conta.senha_hash) sair("A conta já tem senha. Nada foi feito.");

  const reenvio = conta.status === "invited" && conta.email === email;
  if (reenvio && !flag("reenviar")) sair("Convite já pendente para este e-mail. Use --reenviar para gerar e enviar um novo.", 0);
  if (!reenvio && (conta.email || conta.status !== "active")) sair(`Estado inesperado (email=${conta.email ?? "nenhum"}, status=${conta.status}). Nada foi feito.`);

  const { data: outra } = await supabase!.from("atendentes").select("id").eq("email", email).neq("id", id).maybeSingle();
  if (outra) sair("Este e-mail já pertence a outra conta. Nada foi feito.");

  if (flag("dry-run")) sair(`[dry-run] ${reenvio ? "reenviaria" : "ligaria o e-mail, poria em invited e enviaria"} o convite de ${conta.nome} para ${email}.`, 0);

  if (!reenvio) {
    const { error: eUp } = await supabase!.from("atendentes").update({ email, status: "invited", ativo: false }).eq("id", id);
    if (eUp) sair(`Falha ao atualizar a conta (${eUp.code ?? "n/a"}): ${sanitizarMensagemErro(eUp.message)}`);
    await registrarEvento({ clinicaId, atorPerfil: "cli", evento: "USER_INVITED", alvoId: id, detalhes: { via: "scripts/convidar-atendente-teste.ts", conta_existente: true } });
  }

  const token = await criarConvite(id, null);
  if (!token) sair("Conta pronta, mas não foi possível gerar o convite. Rode de novo com --reenviar.");
  const envio = await enviarEmailConvite(email, conta.nome as string, token!);
  sair(envio.ok ? `Convite enviado por e-mail para ${email} (${conta.nome}).` : "Convite gerado, mas o e-mail NÃO saiu (motivo na linha [email] envio_falhou acima). Rode com --reenviar.", envio.ok ? 0 : 2);
}

main().catch((e) => {
  console.log(`ERRO: ${sanitizarMensagemErro(e)}`);
  process.exit(1);
});

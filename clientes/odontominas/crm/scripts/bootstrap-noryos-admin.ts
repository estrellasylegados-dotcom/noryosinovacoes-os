/**
 * Bootstrap do PRIMEIRO Noryos Admin — ferramenta administrativa de CLI, não
 * é rota nem endpoint. Resolve o bloqueio circular (só Noryos Admin cria
 * Noryos Admin, e no primeiro deploy não existe nenhum) SEM senha em SQL,
 * SEM senha em migration e SEM backdoor: cria a conta como `invited`, sem
 * senha, e a pessoa define a própria pelo convite oficial (token aleatório,
 * só hash no banco, 24h, uso único — src/lib/convites.ts).
 *
 * Uso (credenciais de produção injetadas pelo Railway, nunca no repositório):
 *   railway run --service odontominas-crm -- npx vite-node --config vitest.config.ts \
 *     scripts/bootstrap-noryos-admin.ts -- --email <e-mail> --nome "<nome>" [--dry-run]
 *
 * Proteções:
 *  - recusa se já existir QUALQUER noryos_admin (ativo, convidado…) — só passa
 *    com --extraordinario --motivo "<texto>", que fica gravado na auditoria;
 *  - idempotente: mesmo e-mail nunca duplica; convite pendente só reenvia com --reenviar;
 *  - nunca recebe, lê ou imprime senha/token/chave; não aceita senha por parâmetro;
 *  - grava auditoria PLATFORM_ADMIN_BOOTSTRAPPED (ator = "cli", sem sessão).
 */
import { criarAtendenteConvidado, normalizarEmail, validarDadosConvite } from "@/lib/atendentes";
import { registrarEvento } from "@/lib/auditoria";
import { getClinicaId } from "@/lib/clinica";
import { criarConvite } from "@/lib/convites";
import { enviarEmailConvite } from "@/lib/email";
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
  const email = normalizarEmail(arg("email") ?? "");
  const nome = (arg("nome") ?? "").trim();
  const dryRun = flag("dry-run");
  const extraordinario = flag("extraordinario");
  const motivo = (arg("motivo") ?? "").trim();

  const erro = validarDadosConvite({ nome, email, perfil: "noryos_admin" });
  if (erro) sair(`Parâmetros inválidos (${erro}). Use --email e --nome.`);
  if (extraordinario && !motivo) sair("--extraordinario exige --motivo \"<texto>\" (fica na auditoria).");

  const supabase = getSupabaseServerClient();
  const clinicaId = await getClinicaId();
  if (!supabase || !clinicaId) sair("Sem acesso ao banco (rode via `railway run`, com as variáveis de produção).");

  const { data: admins, error } = await supabase!.from("atendentes").select("id, email, status").eq("perfil", "noryos_admin");
  if (error) sair("Falha ao consultar contas noryos_admin existentes.");
  const existentes = (admins ?? []) as { id: string; email: string | null; status: string }[];

  const { data: mesmoEmail } = await supabase!.from("atendentes").select("id, perfil, status").eq("email", email).maybeSingle();
  if (mesmoEmail && mesmoEmail.perfil !== "noryos_admin") {
    sair(`Este e-mail já pertence a uma conta de outro perfil (${mesmoEmail.perfil}). Nada foi feito.`);
  }

  if (mesmoEmail) {
    if (mesmoEmail.status === "active") sair("Este Noryos Admin já existe e está ativo. Nada a fazer.", 0);
    if (mesmoEmail.status !== "invited") sair(`Conta existe com status ${mesmoEmail.status}. Nada foi feito.`);
    if (!flag("reenviar")) sair("Convite pendente já existe para este e-mail. Use --reenviar para gerar e enviar um novo.", 0);
    if (dryRun) sair("[dry-run] reenviaria o convite.", 0);
    // Se uma execução anterior caiu antes de auditar, recupera o registro (uma vez só).
    const { count: jaAuditado } = await supabase!.from("auditoria_eventos").select("id", { count: "exact", head: true }).eq("evento", "PLATFORM_ADMIN_BOOTSTRAPPED").eq("alvo_id", mesmoEmail.id as string);
    if (!jaAuditado) {
      await registrarEvento({ clinicaId, atorPerfil: "cli", evento: "PLATFORM_ADMIN_BOOTSTRAPPED", alvoId: mesmoEmail.id as string, detalhes: { via: "scripts/bootstrap-noryos-admin.ts", recuperado: true, extraordinario: false, motivo: null } });
    }
    const token = await criarConvite(mesmoEmail.id as string, null);
    if (!token) sair("Não foi possível gerar o convite.");
    const envio = await enviarEmailConvite(email, nome || "Noryos Admin", token!);
    await registrarEvento({ clinicaId, atorPerfil: "cli", evento: "PLATFORM_ADMIN_BOOTSTRAP_REINVITED", alvoId: mesmoEmail.id as string, detalhes: { emailEnviado: envio.ok } });
    sair(envio.ok ? "Convite reenviado por e-mail." : "Convite gerado, mas o e-mail NÃO saiu (veja os logs do provedor).", envio.ok ? 0 : 2);
  }

  if (existentes.length > 0 && !extraordinario) {
    sair(`Já existe ${existentes.length} conta(s) noryos_admin (${existentes.map((a) => a.status).join(", ")}). Bootstrap recusado; use o fluxo normal de convite por um Noryos Admin ativo.`);
  }

  if (dryRun) sair(`[dry-run] criaria ${email} como noryos_admin (invited) na clínica atual e enviaria o convite.`, 0);

  const criada = await criarAtendenteConvidado(clinicaId, { nome, email, perfil: "noryos_admin" }, null);
  if (!criada.ok || !criada.atendente) sair(`Falha ao criar a conta (${criada.error ?? "erro"}).`);
  const alvoId = criada.atendente!.id;

  // Auditoria ANTES do envio: a criação da conta é o fato sensível, não o e-mail.
  await registrarEvento({
    clinicaId,
    atorPerfil: "cli",
    evento: "PLATFORM_ADMIN_BOOTSTRAPPED",
    alvoId,
    detalhes: { via: "scripts/bootstrap-noryos-admin.ts", extraordinario, motivo: extraordinario ? motivo : null },
  });

  const token = await criarConvite(alvoId, null);
  if (!token) sair("Conta criada, mas não foi possível gerar o convite. Rode de novo com --reenviar.");
  const envio = await enviarEmailConvite(email, nome, token!);

  sair(envio.ok ? "Noryos Admin criado (invited) e convite enviado por e-mail." : "Noryos Admin criado (invited), mas o e-mail NÃO saiu. Veja os logs e rode com --reenviar.", envio.ok ? 0 : 2);
}

main().catch(() => sair("Erro inesperado no bootstrap (detalhes omitidos de propósito)."));

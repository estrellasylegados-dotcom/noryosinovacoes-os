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
 *     scripts/bootstrap-noryos-admin.ts -- --email <e-mail> --nome "<nome>" [--dry-run | --diagnostico | --reenviar]
 *
 * Proteções:
 *  - recusa se já existir QUALQUER noryos_admin (ativo, convidado…) — só passa
 *    com --extraordinario --motivo "<texto>", que fica gravado na auditoria;
 *  - idempotente: mesmo e-mail nunca duplica; convite pendente só reenvia com --reenviar;
 *  - nunca recebe, lê ou imprime senha/token/chave; não aceita senha por parâmetro;
 *  - grava auditoria PLATFORM_ADMIN_BOOTSTRAPPED (ator = "cli", sem sessão);
 *  - falha inesperada imprime só BOOTSTRAP_STEP/CLASS/CODE/MESSAGE, sanitizados.
 *
 * --diagnostico: SOMENTE LEITURA. Não cria conta, não gera convite, não envia
 * e-mail. Mostra presença das variáveis (nunca o valor das sensíveis), e o
 * resultado de cada etapa (clínica, contas, convites, API do Resend).
 */
import { criarAtendenteConvidado, normalizarEmail, validarDadosConvite } from "@/lib/atendentes";
import { registrarEvento } from "@/lib/auditoria";
import { getClinicaId } from "@/lib/clinica";
import { criarConvite } from "@/lib/convites";
import { enviarEmailConvite } from "@/lib/email";
import { sanitizarMensagemErro } from "@/lib/sanitizar-erro";
import { getSupabaseServerClient } from "@/lib/supabase";

let etapa = "inicio";

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (nome: string) => process.argv.includes(`--${nome}`);

function sair(msg: string, codigo = 1): never {
  console.log(msg);
  process.exit(codigo);
}

/** Erro de resposta do Supabase ({ error }) — não lança, então vira diagnóstico explícito com a etapa. */
function falhaEtapa(nomeEtapa: string, err: { code?: string | null; message?: string } | null | undefined): never {
  console.log(`BOOTSTRAP_STEP=${nomeEtapa}`);
  console.log(`BOOTSTRAP_ERROR_CODE=${err?.code ?? "n/a"}`);
  console.log(`BOOTSTRAP_ERROR_MESSAGE=${sanitizarMensagemErro(err?.message ?? "sem mensagem")}`);
  process.exit(1);
}

function diagnosticoErro(e: unknown): never {
  const classe = e instanceof Error ? e.constructor.name : typeof e;
  const codigo = (e as { code?: string; status?: number; statusCode?: number } | null)?.code ?? (e as { status?: number })?.status ?? (e as { statusCode?: number })?.statusCode ?? "n/a";
  console.log(`BOOTSTRAP_STEP=${etapa}`);
  console.log(`BOOTSTRAP_ERROR_CLASS=${classe}`);
  console.log(`BOOTSTRAP_ERROR_CODE=${codigo}`);
  console.log(`BOOTSTRAP_ERROR_MESSAGE=${sanitizarMensagemErro(e)}`);
  process.exit(1);
}

const presente = (nome: string) => (process.env[nome] ? "presente" : "AUSENTE");

/** Só propriedades booleanas/contagem do formato da chave — nunca o valor nem qualquer trecho dele. */
function formatoChave(chave: string | undefined) {
  if (!chave) return;
  const invalidosHeader = [...chave].filter((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f || c.charCodeAt(0) > 0xff).length;
  console.log(`  formato: tamanho=${chave.length}, prefixo "re_"=${chave.startsWith("re_") ? "sim" : "NÃO"}`);
  const temQuebraDeLinha = chave.includes("\n") || chave.includes("\r");
  const temEspacoNoMeio = chave.trim().split(/\s+/).length > 1;
  const temAspasNasPontas = /^["'].*["']$/.test(chave.trim());
  const temNaoAscii = [...chave.trim()].some((c) => c.charCodeAt(0) < 0x21 || c.charCodeAt(0) > 0x7e);
  console.log(`  formato: espaço/tab nas pontas=${chave !== chave.trim() ? "SIM" : "não"}, quebra de linha=${temQuebraDeLinha ? "SIM" : "não"}`);
  console.log(`  formato: aspas nas pontas=${temAspasNasPontas ? "SIM" : "não"}, espaço no meio=${temEspacoNoMeio ? "SIM" : "não"}`);
  console.log(`  formato: caracteres inválidos em cabeçalho HTTP=${invalidosHeader}, fora de ASCII imprimível=${temNaoAscii ? "SIM" : "não"}`);
}

async function diagnostico(email: string) {
  console.log("== DIAGNÓSTICO (somente leitura; nada é criado, gerado ou enviado) ==");
  console.log(`node=${process.version}`);
  console.log(`RESEND_API_KEY=${presente("RESEND_API_KEY")}`);
  formatoChave(process.env.RESEND_API_KEY);
  console.log(`RESEND_FROM=${process.env.RESEND_FROM ? process.env.RESEND_FROM : "AUSENTE (usa o remetente de teste do Resend)"}`);
  console.log(`APP_URL=${process.env.APP_URL || "AUSENTE"}`);
  console.log(`NEXT_PUBLIC_SUPABASE_URL=${presente("NEXT_PUBLIC_SUPABASE_URL")}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${presente("SUPABASE_SERVICE_ROLE_KEY")}`);
  console.log(`CLINICA_SLUG=${process.env.CLINICA_SLUG || "(não definida; padrão odontominas)"}`);

  etapa = "conectar_supabase";
  const supabase = getSupabaseServerClient();
  console.log(`[${etapa}] ${supabase ? "cliente criado" : "FALHOU (faltam variáveis do Supabase)"}`);
  if (!supabase) return;

  etapa = "buscar_clinica";
  const clinicaId = await getClinicaId();
  console.log(`[${etapa}] ${clinicaId ? "ok" : "FALHOU (clínica não encontrada ou Supabase inacessível)"}`);

  etapa = "listar_noryos_admin";
  const { data: admins, error: eAdm } = await supabase.from("atendentes").select("id, status").eq("perfil", "noryos_admin");
  if (eAdm) falhaEtapa(etapa, eAdm);
  console.log(`[${etapa}] ${admins?.length ?? 0} conta(s): ${(admins ?? []).map((a) => a.status).join(", ") || "nenhuma"}`);

  etapa = "buscar_usuario_por_email";
  const { data: conta, error: eConta } = await supabase.from("atendentes").select("id, perfil, status").eq("email", email).maybeSingle();
  if (eConta) falhaEtapa(etapa, eConta);
  console.log(`[${etapa}] ${conta ? `existe (perfil=${conta.perfil}, status=${conta.status})` : "não existe"}`);

  if (conta) {
    etapa = "convites_existentes";
    const { data: convites, error: eConv } = await supabase.from("convites").select("expires_at, used_at").eq("atendente_id", conta.id);
    if (eConv) falhaEtapa(etapa, eConv);
    const pendentes = (convites ?? []).filter((c) => !c.used_at && new Date(c.expires_at as string).getTime() > Date.now()).length;
    console.log(`[${etapa}] total=${convites?.length ?? 0}, válidos e não usados=${pendentes}`);
  }

  etapa = "resend_api";
  if (!process.env.RESEND_API_KEY) {
    console.log(`[${etapa}] pulado (sem chave)`);
    return;
  }
  try {
    // Leitura de metadados (lista de domínios) — não envia e-mail. Uma chave só de envio recebe 401/403 aqui, o que também é informação útil.
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
    const j = (await r.json().catch(() => ({}))) as { name?: string; message?: string; data?: { name: string; status: string }[] };
    console.log(`[${etapa}] http=${r.status} erro=${j.name ?? "nenhum"} mensagem=${sanitizarMensagemErro(j.message ?? "")}`);
    if (Array.isArray(j.data)) console.log(`[${etapa}] domínios: ${j.data.length ? j.data.map((d) => `${d.name}:${d.status}`).join(", ") : "nenhum verificado"}`);
  } catch (e) {
    console.log(`[${etapa}] FALHOU alcançar api.resend.com: ${e instanceof Error ? e.constructor.name : "erro"} — ${sanitizarMensagemErro(e)}`);
  }
}

async function main() {
  const email = normalizarEmail(arg("email") ?? "");
  const nome = (arg("nome") ?? "").trim();
  const dryRun = flag("dry-run");
  const extraordinario = flag("extraordinario");
  const motivo = (arg("motivo") ?? "").trim();

  etapa = "validar_parametros";
  const erro = validarDadosConvite({ nome, email, perfil: "noryos_admin" });
  if (erro) sair(`Parâmetros inválidos (${erro}). Use --email e --nome.`);
  if (extraordinario && !motivo) sair("--extraordinario exige --motivo \"<texto>\" (fica na auditoria).");

  if (flag("diagnostico")) return diagnostico(email);

  etapa = "conectar_supabase";
  const supabase = getSupabaseServerClient();
  etapa = "buscar_clinica";
  const clinicaId = await getClinicaId();
  if (!supabase || !clinicaId) sair("Sem acesso ao banco (rode via `railway run`, com as variáveis de produção). Use --diagnostico pra ver qual etapa falha.");

  etapa = "listar_noryos_admin";
  const { data: admins, error } = await supabase!.from("atendentes").select("id, email, status").eq("perfil", "noryos_admin");
  if (error) falhaEtapa(etapa, error);
  const existentes = (admins ?? []) as { id: string; email: string | null; status: string }[];

  etapa = "buscar_usuario_por_email";
  const { data: mesmoEmail, error: erroEmail } = await supabase!.from("atendentes").select("id, perfil, status").eq("email", email).maybeSingle();
  if (erroEmail) falhaEtapa(etapa, erroEmail);
  if (mesmoEmail && mesmoEmail.perfil !== "noryos_admin") {
    sair(`Este e-mail já pertence a uma conta de outro perfil (${mesmoEmail.perfil}). Nada foi feito.`);
  }

  if (mesmoEmail) {
    if (mesmoEmail.status === "active") sair("Este Noryos Admin já existe e está ativo. Nada a fazer.", 0);
    if (mesmoEmail.status !== "invited") sair(`Conta existe com status ${mesmoEmail.status}. Nada foi feito.`);
    if (!flag("reenviar")) sair("Convite pendente já existe para este e-mail. Use --reenviar para gerar e enviar um novo.", 0);
    if (dryRun) sair("[dry-run] reenviaria o convite.", 0);

    // Se uma execução anterior caiu antes de auditar, recupera o registro (uma vez só).
    etapa = "auditar_bootstrap";
    const { count: jaAuditado, error: erroAud } = await supabase!
      .from("auditoria_eventos")
      .select("id", { count: "exact", head: true })
      .eq("evento", "PLATFORM_ADMIN_BOOTSTRAPPED")
      .eq("alvo_id", mesmoEmail.id as string);
    if (erroAud) falhaEtapa(etapa, erroAud);
    if (!jaAuditado) {
      await registrarEvento({ clinicaId, atorPerfil: "cli", evento: "PLATFORM_ADMIN_BOOTSTRAPPED", alvoId: mesmoEmail.id as string, detalhes: { via: "scripts/bootstrap-noryos-admin.ts", recuperado: true, extraordinario: false, motivo: null } });
    }

    etapa = "gerar_convite";
    const token = await criarConvite(mesmoEmail.id as string, null);
    if (!token) sair("BOOTSTRAP_STEP=gerar_convite\nNão foi possível gerar o convite (veja o log [convites] criar_failed acima).");

    etapa = "enviar_email";
    const envio = await enviarEmailConvite(email, nome || "Noryos Admin", token!);

    etapa = "auditar_reenvio";
    await registrarEvento({ clinicaId, atorPerfil: "cli", evento: "PLATFORM_ADMIN_BOOTSTRAP_REINVITED", alvoId: mesmoEmail.id as string, detalhes: { emailEnviado: envio.ok } });
    sair(envio.ok ? "Convite reenviado por e-mail." : "BOOTSTRAP_STEP=enviar_email\nConvite gerado, mas o e-mail NÃO saiu (motivo na linha [email] envio_falhou acima).", envio.ok ? 0 : 2);
  }

  if (existentes.length > 0 && !extraordinario) {
    sair(`Já existe ${existentes.length} conta(s) noryos_admin (${existentes.map((a) => a.status).join(", ")}). Bootstrap recusado; use o fluxo normal de convite por um Noryos Admin ativo.`);
  }

  if (dryRun) sair(`[dry-run] criaria ${email} como noryos_admin (invited) na clínica atual e enviaria o convite.`, 0);

  etapa = "criar_conta_convidada";
  const criada = await criarAtendenteConvidado(clinicaId, { nome, email, perfil: "noryos_admin" }, null);
  if (!criada.ok || !criada.atendente) sair(`BOOTSTRAP_STEP=criar_conta_convidada\nFalha ao criar a conta (${criada.error ?? "erro"}).`);
  const alvoId = criada.atendente!.id;

  // Auditoria ANTES do envio: a criação da conta é o fato sensível, não o e-mail.
  etapa = "auditar_bootstrap";
  await registrarEvento({
    clinicaId,
    atorPerfil: "cli",
    evento: "PLATFORM_ADMIN_BOOTSTRAPPED",
    alvoId,
    detalhes: { via: "scripts/bootstrap-noryos-admin.ts", extraordinario, motivo: extraordinario ? motivo : null },
  });

  etapa = "gerar_convite";
  const token = await criarConvite(alvoId, null);
  if (!token) sair("BOOTSTRAP_STEP=gerar_convite\nConta criada, mas não foi possível gerar o convite. Rode de novo com --reenviar.");

  etapa = "enviar_email";
  const envio = await enviarEmailConvite(email, nome, token!);

  sair(envio.ok ? "Noryos Admin criado (invited) e convite enviado por e-mail." : "BOOTSTRAP_STEP=enviar_email\nNoryos Admin criado (invited), mas o e-mail NÃO saiu (motivo na linha [email] envio_falhou acima). Rode com --reenviar depois de resolver.", envio.ok ? 0 : 2);
}

main().catch(diagnosticoErro);

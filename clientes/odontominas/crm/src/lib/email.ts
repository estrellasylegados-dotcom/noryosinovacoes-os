import { Resend } from "resend";

/**
 * Envio de e-mail transacional (convite/reset de senha — seções 25-28, 71
 * do pedido). Sem `RESEND_API_KEY` configurada (ainda não existe em
 * produção nesta fase — ver ferramentas.md), não quebra o fluxo: loga um
 * aviso e devolve `ok: false`. Quem chama (convites/reset-senha) continua
 * funcionando por token — só o e-mail em si não sai até a chave existir.
 */

function getBaseUrl(): string {
  // Mesmo padrão de src/lib/reputacao-tracking.ts: nunca confiar em Host
  // header pra montar link sensível, só na URL configurada.
  return (process.env.APP_URL ?? "").replace(/\/$/, "");
}

let client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

const REMETENTE = process.env.RESEND_FROM || "Noryos <onboarding@resend.dev>";

async function enviar(destino: string, assunto: string, html: string, tipo: string): Promise<{ ok: boolean }> {
  const resend = getClient();
  if (!resend) {
    console.warn("[email] resend_nao_configurado", JSON.stringify({ tipo }));
    return { ok: false };
  }

  const { error } = await resend.emails.send({ from: REMETENTE, to: destino, subject: assunto, html });
  if (error) {
    // Só nome/status do erro do provedor (nunca destino, chave ou corpo) — o suficiente pra distinguir "domínio não verificado" de "chave inválida".
    console.error("[email] envio_falhou", JSON.stringify({ tipo, erro: error.name ?? null, status: (error as { statusCode?: number | null }).statusCode ?? null }));
    return { ok: false };
  }
  return { ok: true };
}

export async function enviarEmailConvite(destino: string, nome: string, tokenBruto: string): Promise<{ ok: boolean }> {
  const link = `${getBaseUrl()}/convite/${tokenBruto}`;
  return enviar(
    destino,
    "Você foi convidado para acessar o Noryos",
    `<p>Olá, ${nome}.</p><p>Você foi convidado para acessar o Noryos.</p><p><a href="${link}">Criar minha senha</a></p><p>Este link expira em 24 horas e só funciona uma vez.</p>`,
    "convite"
  );
}

export async function enviarEmailResetSenha(destino: string, nome: string, tokenBruto: string): Promise<{ ok: boolean }> {
  const link = `${getBaseUrl()}/redefinir-senha/${tokenBruto}`;
  return enviar(
    destino,
    "Redefinir sua senha do Noryos",
    `<p>Olá, ${nome}.</p><p>Recebemos um pedido pra redefinir sua senha.</p><p><a href="${link}">Escolher nova senha</a></p><p>Este link expira em 30 minutos e só funciona uma vez. Se não foi você, ignore este e-mail.</p>`,
    "reset_senha"
  );
}

export async function enviarEmailSenhaAlterada(destino: string, nome: string): Promise<{ ok: boolean }> {
  return enviar(
    destino,
    "Sua senha do Noryos foi alterada",
    `<p>Olá, ${nome}.</p><p>Sua senha foi alterada agora, e todas as sessões abertas foram encerradas. Se não foi você, avise a administração da clínica imediatamente.</p>`,
    "senha_alterada"
  );
}

import { NextResponse } from "next/server";
import { criarAtendenteConvidado, type DadosConviteAtendente } from "@/lib/atendentes";
import { criarConvite } from "@/lib/convites";
import { enviarEmailConvite } from "@/lib/email";
import { getClinicaId } from "@/lib/clinica";
import { requirePermission } from "@/lib/autorizacao";
import { podeAtribuirPerfil, type Perfil } from "@/lib/permissoes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requirePermission("usuarios.criar");
  if ("erro" in auth) return auth.erro;
  const { sessao } = auth;

  let body: DadosConviteAtendente;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Regra de elevação (seção 40/41): ninguém convida um perfil mais
  // poderoso que o próprio escopo — checado no servidor, nunca só na UI.
  if (!podeAtribuirPerfil(sessao.perfil, body.perfil as Perfil)) {
    return NextResponse.json({ ok: false, error: "perfil_nao_permitido" }, { status: 403 });
  }

  const clinicaId = sessao.clinicaId ?? (await getClinicaId());
  const resultado = await criarAtendenteConvidado(clinicaId, body, sessao.atendenteId);
  if (!resultado.ok || !resultado.atendente) return NextResponse.json(resultado, { status: 400 });

  const tokenBruto = await criarConvite(resultado.atendente.id, sessao.atendenteId);
  let emailEnviado = false;
  if (tokenBruto && resultado.atendente.email) {
    const envio = await enviarEmailConvite(resultado.atendente.email, resultado.atendente.nome, tokenBruto);
    emailEnviado = envio.ok;
  }

  return NextResponse.json({ ok: true, atendente: resultado.atendente, emailEnviado }, { status: 201 });
}

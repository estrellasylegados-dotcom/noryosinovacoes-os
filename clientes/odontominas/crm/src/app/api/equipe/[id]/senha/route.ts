import { NextResponse } from "next/server";
import { trocarSenhaAtendente } from "@/lib/atendentes";
import { getClinicaId } from "@/lib/clinica";
import { requirePermission } from "@/lib/autorizacao";
import { buscarAtendentePorId } from "@/lib/atendentes";
import { podeRedefinirCredencial } from "@/lib/permissoes";

export const runtime = "nodejs";

/** Dona/Noryos Admin/Suporte define senha nova pra outra conta — ver nota em atendentes.ts sobre não ser o reset self-service (isso é src/lib/reset-senha.ts). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("usuarios.resetar_acesso");
  if ("erro" in auth) return auth.erro;
  const { sessao } = auth;

  const { id } = await context.params;

  let body: { novaSenha?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const clinicaId = sessao.clinicaId ?? (await getClinicaId());
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  // Elevação: redefinir senha é tomar a conta de alguém — só de perfil que o
  // ator pode administrar (Suporte nunca da Dona; ninguém a própria conta).
  const alvo = await buscarAtendentePorId(clinicaId, id);
  if (!alvo) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (id === sessao.atendenteId || !podeRedefinirCredencial(sessao.perfil, alvo.perfil)) {
    return NextResponse.json({ ok: false, error: "perfil_nao_permitido" }, { status: 403 });
  }

  const resultado = await trocarSenhaAtendente(clinicaId, id, body.novaSenha ?? "", sessao.atendenteId);
  if (!resultado.ok) return NextResponse.json(resultado, { status: resultado.error === "not_found" ? 404 : 400 });

  return NextResponse.json(resultado);
}

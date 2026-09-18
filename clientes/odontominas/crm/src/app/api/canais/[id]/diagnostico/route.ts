import { NextResponse } from "next/server";
import { autorizarCanais, carregarCanalDaRota } from "@/lib/canais-rotas";
import { verificarSaudeCanal } from "@/lib/canais";

export const runtime = "nodejs";

/**
 * Diagnóstico do canal (base do futuro Noryos Ops): consulta o provider AGORA e
 * devolve status, último webhook, última mensagem entrada/saída e último erro.
 * O identificador técnico da instância só aparece pra quem configura o canal
 * ou tem acesso técnico (Noryos Suporte/Admin). Nunca devolve token nem credencial.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCanais(["canais.visualizar", "suporte.acesso_tecnico"]);
  if ("erro" in auth) return auth.erro;

  const canal = await carregarCanalDaRota(auth, context.params);
  if ("erro" in canal) return canal.erro;

  const saude = await verificarSaudeCanal(canal);
  const verTecnico = auth.sessao.permissoes.has("canais.configurar") || auth.sessao.permissoes.has("suporte.acesso_tecnico");

  return NextResponse.json({
    ok: true,
    saude,
    tecnico: verTecnico ? { provider: canal.provider, tipo: canal.tipo, instancia: canal.providerInstanceId } : null,
  });
}

import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { getControleOdontoConfig } from "@/lib/controle-odonto/config";
import { getControleOdontoCapabilities } from "@/lib/controle-odonto/capabilities";
import { getSyncState } from "@/lib/controle-odonto/sync-state";
import { RECURSO_AGENDAMENTOS } from "@/lib/controle-odonto/sync";

export const runtime = "nodejs";

async function exigirAdmin() {
  const sessao = await getSessaoAtual();
  return sessao?.papel === "admin";
}

/**
 * Teste de conexão (seção TESTE DE CONEXÃO do pedido): valida configuração,
 * nunca cria dado real, e só chega a fazer uma chamada de verdade se
 * `canReadAppointments` estiver confirmada — hoje não está, então esta rota
 * sempre responde sem tocar a rede externa.
 */
export async function POST() {
  if (!(await exigirAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const config = getControleOdontoConfig();
  const capabilities = getControleOdontoCapabilities(config);
  const inicio = Date.now();

  if (!config.enabled) {
    return NextResponse.json({
      ok: true,
      status: "nao_configurada",
      mensagem: "Integração desligada — preencha CONTROLE_ODONTO_BASE_URL e ligue CONTROLE_ODONTO_ENABLED.",
      capabilities,
    });
  }

  if (!capabilities.canReadAppointments) {
    return NextResponse.json({
      ok: true,
      status: "aguardando_credencial",
      mensagem:
        "Configuração presente, mas a leitura de agenda ainda não foi validada contra uma conta real " +
        "(autenticação e endpoint pendentes de confirmação). Nenhuma chamada foi feita.",
      capabilities,
    });
  }

  // Nenhum caminho de produção alcança este ponto hoje.
  const estado = await getSyncState(clinicaId, RECURSO_AGENDAMENTOS);
  return NextResponse.json({ ok: true, status: "conectada", duracaoMs: Date.now() - inicio, capabilities, estado });
}

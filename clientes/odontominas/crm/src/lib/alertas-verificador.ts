import { adquirirLock, liberarLock } from "@/lib/fluxo-lock";
import { carregarContextoSla } from "@/lib/sla";
import { buscarConfigVerificador, registrarVerificacao } from "@/lib/alertas-config";
import { sincronizacaoVazia, sincronizarAlertas, type DeteccaoAlertas, type ResultadoSincronizacao } from "@/lib/alertas";
import { detectarCanais, detectarConversas, detectarDisparos, detectarFluxos, detectarKanban, type ContextoVerificacao } from "@/lib/alertas-detectores";
import type { TipoAlerta } from "@/lib/alertas-tipos";

/**
 * O ÚNICO verificador temporal de alertas (não um worker por tipo). Roda a
 * cada minuto (alertas-worker.ts) ou sob demanda (rota de cron), sempre sob
 * lock — e é IDEMPOTENTE: 1 condição = 1 alerta (dedupe no banco), a mesma
 * passada resolve o que deixou de ser verdade. Complementa a detecção por
 * evento (resposta humana, conversa assumida, oportunidade movida, mensagem
 * definitivamente falha), que age na hora; aqui ficam as condições que
 * dependem de TEMPO ou de ESTADO EXTERNO (SLA, sem dono, etapa parada,
 * canal fora, execução travada).
 */

export const LOCK_PROVIDER = "alertas";
export const LOCK_RESOURCE = "verificador";
/** Folga larga: a passada leva de 8 a 30 s conforme a latência do banco; o lock só evita sobreposição (a verificação já é idempotente). */
export const LOCK_TTL_MS = 180_000;

export type ResultadoVerificacao = {
  pulada: boolean;
  duracaoMs: number;
  totais: ResultadoSincronizacao;
  deteccoesComFalha: string[];
};

function somar(a: ResultadoSincronizacao, b: ResultadoSincronizacao): void {
  for (const k of Object.keys(a) as (keyof ResultadoSincronizacao)[]) a[k] += b[k];
}

export async function verificarAlertas(clinicaId: string, agora: Date = new Date()): Promise<ResultadoVerificacao> {
  const inicio = Date.now();
  const totais = sincronizacaoVazia();
  const deteccoesComFalha: string[] = [];

  const [config, sla] = await Promise.all([buscarConfigVerificador(clinicaId), carregarContextoSla(clinicaId)]);
  const ctx: ContextoVerificacao = { clinicaId, agora, config, sla };
  const ligado = (t: TipoAlerta) => !config.tiposDesabilitados.has(t);

  // Se um detector falha, NÃO se resolve nada daquele grupo: falta de dado não é "condição acabou".
  async function tentar<T>(nome: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (e) {
      deteccoesComFalha.push(nome);
      console.error("[alertas] deteccao_falhou", JSON.stringify({ deteccao: nome, message: (e as Error).message }));
      return null;
    }
  }
  async function aplicar(det: DeteccaoAlertas | null): Promise<void> {
    if (!det) return;
    const on = det.tipos.filter(ligado);
    if (on.length > 0) somar(totais, await sincronizarAlertas(clinicaId, { ...det, tipos: on, ativas: det.ativas.filter((c) => on.includes(c.tipo)) }));
  }

  // Tipo desligado: o que já estava aberto some da fila (motivo registrado no histórico).
  const desligados = (["sla_limite", "conversa_sem_responsavel", "oportunidade_parada", "canal_desconectado", "fluxo_falhou", "fluxo_preso", "automacao_indisponivel", "disparo_falhas"] as TipoAlerta[]).filter((t) => !ligado(t));
  if (desligados.length > 0) somar(totais, await sincronizarAlertas(clinicaId, { tipos: desligados, ativas: [], motivoEncerramento: "tipo_desabilitado" }));

  const precisaConversas = ligado("sla_limite") || ligado("conversa_sem_responsavel") || ligado("oportunidade_parada");
  const conversas = precisaConversas ? await tentar("conversas", () => detectarConversas(ctx)) : null;
  if (conversas) {
    if (ligado("sla_limite")) await aplicar(conversas.sla);
    if (ligado("conversa_sem_responsavel")) await aplicar(conversas.semResponsavel);
  }

  await Promise.all([
    // Kanban depende do resultado de SLA (evita repetir o mesmo problema): sem ele, pula a rodada em vez de arriscar duplicar.
    (async () => {
      if (!ligado("oportunidade_parada") || !conversas) return;
      await aplicar(await tentar("kanban", () => detectarKanban(ctx, ligado("sla_limite") ? conversas.conversasComSla : new Set())));
    })(),
    (async () => {
      if (ligado("canal_desconectado")) await aplicar(await tentar("canais", () => detectarCanais(ctx)));
    })(),
    (async () => {
      if (!ligado("fluxo_falhou") && !ligado("fluxo_preso") && !ligado("automacao_indisponivel")) return;
      const f = await tentar("fluxos", () => detectarFluxos(ctx));
      if (f) {
        if (ligado("fluxo_falhou")) await aplicar(f.falhou);
        if (ligado("fluxo_preso")) await aplicar(f.preso);
        if (ligado("automacao_indisponivel")) await aplicar(f.indisponivel);
      }
    })(),
    (async () => {
      if (ligado("disparo_falhas")) await aplicar(await tentar("disparos", () => detectarDisparos(ctx)));
    })(),
  ]);

  const duracaoMs = Date.now() - inicio;
  await registrarVerificacao(clinicaId, agora, duracaoMs);
  console.log("[alertas] verificacao_alertas_executada", JSON.stringify({ clinicaId, duracaoMs, ...totais, deteccoesComFalha }));
  return { pulada: false, duracaoMs, totais, deteccoesComFalha };
}

/** Com lock: worker e cron manual nunca rodam ao mesmo tempo. Ocupado → devolve `pulada`, sem erro. */
export async function verificarAlertasComLock(clinicaId: string, agora: Date = new Date()): Promise<ResultadoVerificacao> {
  const lock = await adquirirLock(clinicaId, LOCK_RESOURCE, LOCK_TTL_MS, LOCK_PROVIDER);
  if (!lock.ok || !lock.holder) return { pulada: true, duracaoMs: 0, totais: sincronizacaoVazia(), deteccoesComFalha: [] };
  try {
    return await verificarAlertas(clinicaId, agora);
  } finally {
    await liberarLock(clinicaId, LOCK_RESOURCE, lock.holder, LOCK_PROVIDER);
  }
}

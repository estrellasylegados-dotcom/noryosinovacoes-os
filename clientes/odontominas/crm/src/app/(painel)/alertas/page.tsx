import Link from "next/link";
import { redirect } from "next/navigation";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { can } from "@/lib/autorizacao";
import { listarAtendentes } from "@/lib/atendentes";
import { marcarVisualizados } from "@/lib/alertas";
import { atorAlerta, clinicaDaSessao } from "@/lib/alertas-http";
import { listarAlertas, resumirAlertas, type AlertaView, type FiltrosAlertas } from "@/lib/alertas-consulta";
import { CATEGORIAS, CATEGORIA_ROTULO, isSeveridade, SEVERIDADES, SEVERIDADE_ROTULO } from "@/lib/alertas-tipos";
import { formatDuracao } from "@/lib/tempo";
import { AlertaCard } from "@/components/alertas/AlertaCard";

export const dynamic = "force-dynamic";

type Params = { situacao?: string; severidade?: string; categoria?: string; responsavel?: string; busca?: string; de?: string; ate?: string; pagina?: string };

const VERIFICADOR_ATRASADO_MS = 5 * 60_000;

function href(p: Params, mudar: Partial<Params>): string {
  const merged = { ...p, ...mudar };
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/alertas?${s}` : "/alertas";
}

function Secao({ titulo, itens, agoraIso, permissoes }: { titulo: string; itens: AlertaView[]; agoraIso: string; permissoes: string[] }) {
  if (itens.length === 0) return null;
  return (
    <section aria-label={titulo} className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {titulo} <span className="text-neutral-400">({itens.length})</span>
      </h2>
      {itens.map((a) => (
        <AlertaCard key={a.id} alerta={a} agoraIso={agoraIso} permissoes={permissoes} />
      ))}
    </section>
  );
}

/** Central de Alertas: o que exige ação humana agora, críticos primeiro (mais antigos primeiro dentro de cada nível). */
export default async function AlertasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const [sessao, clinicaBase, params] = await Promise.all([getSessaoAtual(), getClinicaId(), searchParams]);
  if (!sessao || !can(sessao, "alertas.visualizar")) redirect("/");

  const clinicaId = clinicaDaSessao(sessao, clinicaBase);
  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">Não consegui abrir os alertas desta clínica. Confira a conta e as variáveis do Supabase.</p>
      </main>
    );
  }

  const ator = atorAlerta(sessao);
  const situacao = params.situacao === "resolvidos" ? "resolvidos" : "ativos";
  const filtros: FiltrosAlertas = {
    situacao,
    severidade: params.severidade && isSeveridade(params.severidade) ? params.severidade : undefined,
    categoria: params.categoria || undefined,
    responsavel: params.responsavel || undefined,
    busca: params.busca || undefined,
    de: params.de ? `${params.de}T00:00:00-03:00` : undefined,
    ate: params.ate ? `${params.ate}T23:59:59.999-03:00` : undefined,
    pagina: Number(params.pagina) || 1,
  };

  const [lista, resumo, atendentes] = await Promise.all([listarAlertas(clinicaId, ator, filtros), resumirAlertas(clinicaId, ator), listarAtendentes(clinicaId)]);
  if (situacao === "ativos") await marcarVisualizados(clinicaId, lista.alertas.map((a) => a.id));

  const agora = new Date();
  const agoraIso = agora.toISOString();
  const permissoes = Array.from(sessao.permissoes);
  const criticos = lista.alertas.filter((a) => a.severidade === "critico");
  const atencao = lista.alertas.filter((a) => a.severidade === "atencao");
  const outros = lista.alertas.filter((a) => a.severidade === "informativo");
  const totalPaginas = Math.max(1, Math.ceil(lista.total / lista.porPagina));
  const idadeVerificacao = resumo.ultimaVerificacaoEm ? agora.getTime() - new Date(resumo.ultimaVerificacaoEm).getTime() : null;
  const temFiltro = Boolean(params.severidade || params.categoria || params.responsavel || params.busca || params.de || params.ate);

  const CAMPO = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm";

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Alertas</h1>
            <p className="text-sm text-neutral-500">O que exige ação da equipe agora. Alertas se resolvem sozinhos quando a situação acaba.</p>
          </div>
          {can(sessao, "alertas.configurar") && (
            <Link href="/configuracoes/alertas" className="text-sm font-medium text-teal-700 hover:text-teal-800">
              Configurar alertas
            </Link>
          )}
        </header>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <dt className="text-xs font-medium text-red-700">Críticos abertos</dt>
            <dd className="text-2xl font-semibold text-red-700">{resumo.criticos}</dd>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <dt className="text-xs font-medium text-amber-800">De atenção abertos</dt>
            <dd className="text-2xl font-semibold text-amber-800">{resumo.atencao}</dd>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <dt className="text-xs font-medium text-sky-800">Informativos</dt>
            <dd className="text-2xl font-semibold text-sky-800">{resumo.informativos}</dd>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <dt className="text-xs font-medium text-emerald-800">Resolvidos hoje</dt>
            <dd className="text-2xl font-semibold text-emerald-800">{resumo.resolvidosHoje}</dd>
          </div>
        </dl>

        {(idadeVerificacao === null || idadeVerificacao > VERIFICADOR_ATRASADO_MS) && (
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {idadeVerificacao === null
              ? "A verificação automática ainda não rodou nesta clínica."
              : `A verificação automática não roda há ${formatDuracao(idadeVerificacao)}. Alertas por tempo (SLA, etapa parada) podem estar atrasados.`}
          </p>
        )}

        <nav className="flex gap-2" aria-label="Situação">
          <Link href={href(params, { situacao: undefined, pagina: undefined })} aria-current={situacao === "ativos" ? "page" : undefined} className={`rounded-full px-4 py-1.5 text-sm font-medium ${situacao === "ativos" ? "bg-teal-700 text-white" : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50"}`}>
            Abertos
          </Link>
          <Link href={href(params, { situacao: "resolvidos", pagina: undefined })} aria-current={situacao === "resolvidos" ? "page" : undefined} className={`rounded-full px-4 py-1.5 text-sm font-medium ${situacao === "resolvidos" ? "bg-teal-700 text-white" : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50"}`}>
            Resolvidos
          </Link>
        </nav>

        <form method="get" action="/alertas" className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-3">
          {situacao === "resolvidos" && <input type="hidden" name="situacao" value="resolvidos" />}
          <div className="min-w-[10rem] flex-1">
            <label htmlFor="busca" className="mb-1 block text-xs font-medium text-neutral-600">
              Buscar
            </label>
            <input id="busca" name="busca" defaultValue={params.busca ?? ""} placeholder="Paciente, telefone ou título" className={`${CAMPO} w-full`} />
          </div>
          <div>
            <label htmlFor="severidade" className="mb-1 block text-xs font-medium text-neutral-600">
              Severidade
            </label>
            <select id="severidade" name="severidade" defaultValue={params.severidade ?? ""} className={CAMPO}>
              <option value="">Todas</option>
              {[...SEVERIDADES].reverse().map((s) => (
                <option key={s} value={s}>
                  {SEVERIDADE_ROTULO[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="categoria" className="mb-1 block text-xs font-medium text-neutral-600">
              Categoria
            </label>
            <select id="categoria" name="categoria" defaultValue={params.categoria ?? ""} className={CAMPO}>
              <option value="">Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_ROTULO[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="responsavel" className="mb-1 block text-xs font-medium text-neutral-600">
              Responsável
            </label>
            <select id="responsavel" name="responsavel" defaultValue={params.responsavel ?? ""} className={CAMPO}>
              <option value="">Todos</option>
              <option value="sem">Sem responsável (equipe)</option>
              {atendentes
                .filter((a) => a.status === "active")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="de" className="mb-1 block text-xs font-medium text-neutral-600">
              De
            </label>
            <input id="de" type="date" name="de" defaultValue={params.de ?? ""} className={CAMPO} />
          </div>
          <div>
            <label htmlFor="ate" className="mb-1 block text-xs font-medium text-neutral-600">
              Até
            </label>
            <input id="ate" type="date" name="ate" defaultValue={params.ate ?? ""} className={CAMPO} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900">
              Filtrar
            </button>
            {temFiltro && (
              <Link href={href({ situacao: params.situacao }, {})} className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
                Limpar
              </Link>
            )}
          </div>
        </form>

        {lista.alertas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <p className="text-base font-medium text-neutral-700">{situacao === "ativos" ? (temFiltro ? "Nenhum alerta com esses filtros." : "Tudo em ordem por aqui.") : "Nenhum alerta resolvido com esses filtros."}</p>
            <p className="mt-1 text-sm text-neutral-500">{situacao === "ativos" && !temFiltro ? "Nada exige ação da equipe agora." : "Ajuste ou limpe os filtros para ver outros."}</p>
          </div>
        ) : situacao === "ativos" ? (
          <div className="space-y-8">
            <Secao titulo="Críticos" itens={criticos} agoraIso={agoraIso} permissoes={permissoes} />
            <Secao titulo="Atenção" itens={atencao} agoraIso={agoraIso} permissoes={permissoes} />
            <Secao titulo="Outros" itens={outros} agoraIso={agoraIso} permissoes={permissoes} />
          </div>
        ) : (
          <Secao titulo="Resolvidos e ignorados" itens={lista.alertas} agoraIso={agoraIso} permissoes={permissoes} />
        )}

        {totalPaginas > 1 && (
          <nav className="flex items-center justify-between text-sm" aria-label="Paginação">
            {lista.pagina > 1 ? (
              <Link href={href(params, { pagina: String(lista.pagina - 1) })} className="font-medium text-teal-700">
                ← Anteriores
              </Link>
            ) : (
              <span />
            )}
            <span className="text-neutral-500">
              Página {lista.pagina} de {totalPaginas}
            </span>
            {lista.pagina < totalPaginas ? (
              <Link href={href(params, { pagina: String(lista.pagina + 1) })} className="font-medium text-teal-700">
                Próximos →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  );
}

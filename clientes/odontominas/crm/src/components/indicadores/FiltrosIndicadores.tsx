import type { OpcaoIndicador } from "@/lib/indicadores";
import type { PeriodoRelatorio } from "@/lib/relatorios";

export function FiltrosIndicadores({
  periodo,
  responsavel,
  canal,
  atendentes,
  canais,
}: {
  periodo: PeriodoRelatorio;
  responsavel?: string;
  canal?: string;
  atendentes: OpcaoIndicador[];
  canais: OpcaoIndicador[];
}) {
  const campo = "h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
  return (
    <form action="/resumo" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
      <input type="hidden" name="periodo" value={periodo} />
      <label className="min-w-44 flex-1 sm:flex-none">
        <span className="mb-1 block text-xs font-medium text-neutral-500">Responsável</span>
        <select name="responsavel" defaultValue={responsavel ?? ""} className={`${campo} w-full sm:w-52`}>
          <option value="">Toda a equipe</option>
          {atendentes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      </label>
      <label className="min-w-44 flex-1 sm:flex-none">
        <span className="mb-1 block text-xs font-medium text-neutral-500">Canal</span>
        <select name="canal" defaultValue={canal ?? ""} className={`${campo} w-full sm:w-52`}>
          <option value="">Todos os canais</option>
          {canais.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      </label>
      <button type="submit" className="h-10 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800">
        Aplicar filtros
      </button>
      {(responsavel || canal) && (
        <a href={`/resumo?periodo=${periodo}`} className="flex h-10 items-center px-2 text-sm font-medium text-neutral-500 hover:text-neutral-800">
          Limpar
        </a>
      )}
    </form>
  );
}

/**
 * Gráfico de barras (1 ou 2 séries) em SVG puro — zero dependência nova,
 * mesmo padrão já usado no resto do CRM. Cores validadas pra acessibilidade
 * (contraste + separação por daltonismo) via a skill de dataviz: slot 1 azul
 * `#2a78d6`/`#3987e5` (claro/escuro), slot 2 laranja `#eb6834`/`#d95926` —
 * ordem fixa em todo gráfico do painel, nunca trocada por gráfico (ver
 * skill: "assign categorical hues in fixed order, never cycled"). Os
 * valores de verdade ficam em `--chart-series-a`/`-b` (globals.css, com o
 * par escuro validado à parte pra dark mode) — os nomes aqui só apontam
 * pra lá, pra não duplicar a cor em dois lugares.
 */

export const COR_SERIE_A = "var(--chart-series-a)";
export const COR_SERIE_B = "var(--chart-series-b)";

type Serie = { label: string; cor: string; valores: number[] };

export function BarChart({
  titulo,
  categorias,
  series,
}: {
  titulo: string;
  categorias: string[];
  series: Serie[];
}) {
  const altura = 180;
  const larguraCategoria = 56;
  const largura = Math.max(categorias.length * larguraCategoria, 280);
  const maxValor = Math.max(1, ...series.flatMap((s) => s.valores));
  const escalaY = (altura - 24) / maxValor;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-700">{titulo}</h3>
        {series.length > 1 && (
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            {series.map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.cor }} />
                {s.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {maxValor <= 1 && series.every((s) => s.valores.every((v) => v === 0)) ? (
        <p className="py-10 text-center text-sm text-neutral-400">Sem dados no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${largura} ${altura}`}
            width="100%"
            height={altura}
            style={{ minWidth: largura }}
            role="img"
            aria-label={titulo}
          >
            {categorias.map((cat, i) => {
              const grupoLargura = larguraCategoria - 12;
              const barraLargura = grupoLargura / series.length - 4;
              const grupoX = i * larguraCategoria + 6;

              return (
                <g key={cat}>
                  {series.map((s, si) => {
                    const valor = s.valores[i] ?? 0;
                    const alturaBarra = valor * escalaY;
                    const x = grupoX + si * (barraLargura + 4);
                    const y = altura - 20 - alturaBarra;
                    return (
                      <rect
                        key={s.label}
                        x={x}
                        y={y}
                        width={Math.max(barraLargura, 4)}
                        height={Math.max(alturaBarra, 0)}
                        rx={3}
                        style={{ fill: s.cor }}
                      >
                        <title>{`${cat} · ${s.label}: ${valor}`}</title>
                      </rect>
                    );
                  })}
                  <text x={grupoX + grupoLargura / 2} y={altura - 4} textAnchor="middle" fontSize={10} fill="#898781">
                    {cat}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

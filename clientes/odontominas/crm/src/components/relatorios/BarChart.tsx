/**
 * Gráfico de barras (1 ou 2 séries) em SVG puro — zero dependência nova,
 * mesmo padrão já usado no resto do CRM. Cores validadas pra acessibilidade
 * (contraste + separação por daltonismo) via a skill de dataviz: slot 1 azul
 * `#2a78d6`, slot 2 laranja `#eb6834` — ordem fixa em todo gráfico do painel,
 * nunca trocada por gráfico (ver skill: "assign categorical hues in fixed
 * order, never cycled").
 */

export const COR_SERIE_A = "#2a78d6";
export const COR_SERIE_B = "#eb6834";

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

  // Passo do gridline: nice number simples (1/2/5 x 10^n) pra não repetir "1,1,1,1".
  const passo = calcularPasso(maxValor);
  const linhasGrid = [];
  for (let v = 0; v <= maxValor; v += passo) linhasGrid.push(v);

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
            {linhasGrid.map((v) => {
              const y = altura - 20 - v * escalaY;
              return (
                <line key={v} x1={0} y1={y} x2={largura} y2={y} stroke="#e1e0d9" strokeWidth={1} />
              );
            })}

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
                        fill={s.cor}
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

function calcularPasso(maxValor: number): number {
  if (maxValor <= 4) return 1;
  const bruto = maxValor / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const normalizado = bruto / potencia;
  const passo = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10;
  return passo * potencia;
}

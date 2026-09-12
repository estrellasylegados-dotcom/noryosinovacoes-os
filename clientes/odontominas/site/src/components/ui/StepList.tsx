/**
 * Lista numerada com trilho vertical conectando as etapas — usada na jornada
 * do paciente e na trajetória da Dra. Ariadna. Linguagem visual própria,
 * deliberadamente diferente da grade de tratamentos e das linhas de
 * diferenciais (ver §7 do briefing: cada seção com composição própria).
 */
export function StepList({
  items,
}: {
  items: { numero: string; titulo: string; texto: string }[];
}) {
  return (
    <ol className="relative grid gap-10 sm:pl-14">
      <div
        className="absolute left-[15px] top-2 bottom-2 hidden w-px bg-[var(--hairline-strong)] sm:block"
        aria-hidden
      />
      {items.map((item) => (
        <li key={item.numero} className="relative">
          <span
            className="absolute -left-14 top-0 hidden h-8 w-8 items-center justify-center rounded-full border border-[var(--hairline-strong)] bg-[var(--color-ink-secondary)] font-mono text-xs text-[var(--color-cyan)] sm:flex"
            aria-hidden
          >
            {item.numero}
          </span>
          <span className="t-label text-[var(--color-text-dim)] sm:hidden">{item.numero}</span>
          <h3 className="mt-1 t-h3 sm:mt-0">{item.titulo}</h3>
          <p className="mt-2 max-w-md text-[var(--color-text-muted)]">{item.texto}</p>
        </li>
      ))}
    </ol>
  );
}

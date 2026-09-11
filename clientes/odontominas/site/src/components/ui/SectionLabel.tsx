export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-5 flex items-center gap-2.5 t-label text-[var(--color-green)]">
      <span className="h-px w-6 bg-[var(--color-green)]/50" aria-hidden />
      {children}
    </span>
  );
}

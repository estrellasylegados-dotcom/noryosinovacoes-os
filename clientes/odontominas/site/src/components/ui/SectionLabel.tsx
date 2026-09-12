export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`mb-5 flex items-center gap-2.5 t-label text-[var(--color-green)] ${className}`}>
      <span className="h-px w-6 bg-[var(--color-green)]/50" aria-hidden />
      {children}
    </span>
  );
}

import { buscarClinicaAtual } from "@/lib/clinica";
import { obterBranding } from "@/lib/branding";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

/** Server Component — Fase 3, branding dinâmico: só o servidor pode ler o nome da clínica (Supabase); o formulário interativo vive em LoginForm.tsx (client). */
export default async function LoginPage() {
  const clinica = await buscarClinicaAtual();
  const branding = obterBranding(clinica);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-8">
      <LoginForm clinicaNome={clinica?.nome ?? "Clínica"} logoSrc={branding.logoSrc} />
    </main>
  );
}

import { EsqueciSenhaForm } from "@/components/EsqueciSenhaForm";

export const dynamic = "force-dynamic";

export default function EsqueciSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-8">
      <EsqueciSenhaForm />
    </main>
  );
}

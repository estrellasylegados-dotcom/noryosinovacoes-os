import { AceitarConviteForm } from "@/components/AceitarConviteForm";

export const dynamic = "force-dynamic";

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-8">
      <AceitarConviteForm token={token} />
    </main>
  );
}

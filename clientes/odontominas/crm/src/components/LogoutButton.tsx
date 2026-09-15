"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={sair}
      disabled={saindo}
      className="text-sm text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-700 disabled:opacity-50"
    >
      Sair
    </button>
  );
}

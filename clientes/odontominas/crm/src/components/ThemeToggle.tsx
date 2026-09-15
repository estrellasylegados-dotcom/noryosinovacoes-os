"use client";

import { useEffect, useState } from "react";

const CHAVE_TEMA = "crm-tema";

export function ThemeToggle() {
  // null até o efeito rodar no cliente — evita mostrar o ícone errado por
  // uma fração de segundo antes de saber a preferência real (ver o script
  // em src/app/layout.tsx, que já aplicou a classe antes disto montar).
  const [escuro, setEscuro] = useState<boolean | null>(null);

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.classList.toggle("dark", novo);
    localStorage.setItem(CHAVE_TEMA, novo ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={alternar}
      title={escuro ? "Mudar pra tema claro" : "Mudar pra tema escuro"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
    >
      {escuro ? (
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8Z" />
        </svg>
      )}
    </button>
  );
}

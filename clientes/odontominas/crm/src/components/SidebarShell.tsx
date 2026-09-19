"use client";

import { useEffect, useState, type ReactNode } from "react";

const CHAVE_MENU_COLAPSADO = "crm-menu-colapsado";

function IconeMenu({ colapsado }: { colapsado: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d={colapsado ? "m14 9 3 3-3 3" : "m17 9-3 3 3 3"} />
    </svg>
  );
}

/**
 * Casca do menu lateral: recolhe/expande (fica só uma faixa estreita, com a
 * bolinha de status) e prende o menu à altura da tela — a rolagem da página
 * não leva o menu junto, e o bloco de conexão/sessão fica sempre no rodapé
 * visível. O conteúdo ao lado (`flex-1 min-w-0`) se reajusta sozinho.
 * Preferência guardada por navegador; só vale a partir de `sm` (no celular o
 * menu segue empilhado no topo).
 */
export function SidebarShell({
  titulo,
  nav,
  rodape,
  rodapeCompacto,
}: {
  titulo: ReactNode;
  nav: ReactNode;
  rodape: ReactNode;
  rodapeCompacto: ReactNode;
}) {
  const [colapsado, setColapsado] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE_MENU_COLAPSADO) === "1") setColapsado(true);
    } catch {
      /* sem localStorage: segue expandido */
    }
  }, []);

  function alternar() {
    setColapsado((atual) => {
      const novo = !atual;
      try {
        localStorage.setItem(CHAVE_MENU_COLAPSADO, novo ? "1" : "0");
      } catch {
        /* preferência não persiste, mas o menu funciona */
      }
      return novo;
    });
  }

  return (
    <aside
      data-colapsado={colapsado}
      className="group flex flex-col gap-4 border-b border-neutral-200 bg-white px-4 py-4 transition-[width] duration-150 sm:sticky sm:top-0 sm:h-screen sm:w-60 sm:shrink-0 sm:border-b-0 sm:border-r sm:px-5 sm:py-6 sm:data-[colapsado=true]:w-16 sm:data-[colapsado=true]:px-3"
    >
      <div className="flex shrink-0 items-start justify-between gap-2 sm:group-data-[colapsado=true]:justify-center">
        <div className="min-w-0 sm:group-data-[colapsado=true]:hidden">{titulo}</div>
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!colapsado}
          aria-label={colapsado ? "Expandir menu" : "Recolher menu"}
          title={colapsado ? "Expandir menu" : "Recolher menu"}
          className="hidden shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 sm:block"
        >
          <IconeMenu colapsado={colapsado} />
        </button>
      </div>

      <div className="min-h-0 sm:flex-1 sm:overflow-y-auto sm:group-data-[colapsado=true]:hidden">{nav}</div>

      <div className="shrink-0 border-t border-neutral-100 pt-4 sm:mt-auto sm:group-data-[colapsado=true]:hidden">{rodape}</div>
      <div className="hidden shrink-0 sm:group-data-[colapsado=true]:mt-auto sm:group-data-[colapsado=true]:block">{rodapeCompacto}</div>
    </aside>
  );
}

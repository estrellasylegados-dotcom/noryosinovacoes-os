"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Container } from "./ui/Container";
import { WhatsappCTA } from "./WhatsappCTA";
import { navegacaoHeader } from "@/content/navegacao";
import { siteConfig } from "@/lib/config";

/**
 * Header transparente sobre o hero; ao rolar ganha fundo translúcido + blur
 * + hairline. Menu mobile em painel full-height. Logo (`/odontominas-logo.png`,
 * 1448×1086 — lockup quase quadrado, diferente do wordmark largo da Noryos)
 * trava a ALTURA em ambos os breakpoints (`h-10 w-auto md:h-12`), nunca a
 * largura — travar largura estouraria a altura do header (`--header-h`
 * 72px) com um logo quase quadrado.
 */
export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      data-scrolled={scrolled}
      className="site-header fixed inset-x-0 top-0 z-50 border-b"
    >
      <Container className="flex h-[var(--header-h)] items-center justify-between">
        <Link
          href="/"
          className="flex items-center"
          aria-label={`${siteConfig.name} — página inicial`}
          onClick={() => setOpen(false)}
        >
          <Image
            src="/odontominas-logo.png"
            alt={siteConfig.name}
            width={1448}
            height={1086}
            priority
            className="h-10 w-auto md:h-12"
          />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navegação principal">
          {navegacaoHeader.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-[var(--color-text-muted)] transition-colors duration-200 hover:text-[var(--color-text)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <WhatsappCTA origem="header" variant="primary" className="!px-5 !py-2.5 text-sm">
            Agendar avaliação
          </WhatsappCTA>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] text-[var(--color-text)] md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            {open ? <path d="M4 4l10 10M14 4L4 14" /> : <path d="M2 5h14M2 9h14M2 13h14" />}
          </svg>
        </button>
      </Container>

      {/* painel mobile */}
      <div
        className={`fixed inset-0 top-[var(--header-h)] z-40 origin-top bg-[var(--color-ink)] transition-[opacity,transform] duration-300 ease-[var(--ease-premium)] md:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <Container className="flex h-full flex-col gap-1 py-6">
          {navegacaoHeader.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b border-[var(--hairline)] py-4 text-lg font-medium tracking-tight text-[var(--color-text)]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-6">
            <WhatsappCTA origem="header" variant="primary" className="w-full">
              Agendar uma avaliação
            </WhatsappCTA>
          </div>
        </Container>
      </div>
    </header>
  );
}

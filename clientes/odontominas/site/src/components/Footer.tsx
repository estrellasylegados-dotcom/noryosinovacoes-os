import Link from "next/link";
import Image from "next/image";
import { Container } from "./ui/Container";
import { navegacaoFooter, navegacaoLegal } from "@/content/navegacao";
import { Icon } from "./ui/Icon";
import {
  siteConfig,
  isFilled,
  getWhatsappLink,
  getTelLink,
  analyticsEvents,
} from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-[var(--hairline)] surface-1">
      <Container className="grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Link href="/" className="inline-flex items-center" aria-label={`${siteConfig.name} — página inicial`}>
            <Image
              src="/odontominas-logo.png"
              alt={siteConfig.name}
              width={1448}
              height={1086}
              className="h-12 w-auto md:h-14"
            />
          </Link>
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">{siteConfig.description}</p>
          <p className="mt-4 font-mono text-xs uppercase tracking-wider text-[var(--color-text-dim)]">
            {siteConfig.atendimento}
          </p>
        </div>

        <nav aria-label="Navegação do rodapé">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
            Navegação
          </span>
          <ul className="mt-4 grid gap-3 text-sm">
            {navegacaoFooter.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
            Contato
          </span>
          <ul className="mt-4 grid gap-3 text-sm">
            <li>
              <a
                href={getTelLink()}
                data-analytics-event={analyticsEvents.phoneClick}
                className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                {siteConfig.telefoneFixo}
              </a>
            </li>
            <li>
              <a
                href={getWhatsappLink("footer")}
                target="_blank"
                rel="noopener noreferrer"
                data-analytics-event={analyticsEvents.whatsapp("footer")}
                className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                WhatsApp
              </a>
            </li>
            <li>
              <a href={`mailto:${siteConfig.email}`} className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">
                {siteConfig.email}
              </a>
            </li>
          </ul>
        </div>
      </Container>

      {/*
        Faixa de compliance (Resolução CFO-196/2019): nome + CRO do
        responsável técnico é obrigatório em toda peça, uma vez que o dado
        exista de verdade. Até a Ariadna confirmar, a faixa não renderiza —
        nunca expor `[PLACEHOLDER]` no HTML publicado (ver isFilled()).
      */}
      {isFilled(siteConfig.responsavelTecnico.nome) && (
        <div className="border-t border-[var(--color-border-strong)] surface-1">
          <Container className="py-4 text-center text-xs text-[var(--color-text)]">
            <p>
              Responsável técnico: <strong>{siteConfig.responsavelTecnico.nome}</strong> — CRO{" "}
              {siteConfig.responsavelTecnico.cro}
            </p>
          </Container>
        </div>
      )}

      <div className="border-t border-[var(--hairline)]">
        <Container className="flex flex-col gap-3 py-6 text-xs text-[var(--color-text-dim)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Icon name="check" size={12} className="hidden sm:block" />
            <p>
              {siteConfig.razaoSocial} — CNPJ {siteConfig.cnpj}
            </p>
          </div>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
            {navegacaoLegal.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-[var(--color-text)]">
                {item.label}
              </Link>
            ))}
            <span>© {new Date().getFullYear()} {siteConfig.name}</span>
          </nav>
        </Container>
      </div>
    </footer>
  );
}

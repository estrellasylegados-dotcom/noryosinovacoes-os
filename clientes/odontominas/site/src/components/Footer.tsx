import Link from "next/link";
import Image from "next/image";
import { Container } from "./ui/Container";
import { navegacaoFooter } from "@/content/navegacao";
import { siteConfig, getWhatsappLink, whatsappDisplay, analyticsEvents } from "@/lib/config";

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
          <p className="mt-4 text-sm">
            <a
              href={getWhatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              data-analytics-event={analyticsEvents.clickWhatsapp}
              className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              WhatsApp: {whatsappDisplay}
            </a>
          </p>
          <p className="mt-2 text-sm">
            <a href={`mailto:${siteConfig.email}`} className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">
              {siteConfig.email}
            </a>
          </p>
        </div>
      </Container>

      {/*
        Faixa de compliance (Resolução CFO-196/2019): nome + CRO do
        responsável técnico obrigatório em toda peça. Fica no Footer, que é
        montado uma vez no layout raiz, pra cobrir 100% das páginas.
        Visualmente destacada de propósito (não em cinza-claro ilegível) —
        hoje é 100% placeholder e precisa ser óbvio pra quem revisar
        internamente que ainda falta preencher com o dado real.
      */}
      <div className="border-t border-[var(--color-border-strong)] surface-1">
        <Container className="py-4 text-center text-xs text-[var(--color-text)]">
          <p>
            Responsável técnico: <strong>{siteConfig.responsavelTecnico.nome}</strong> — CRO{" "}
            {siteConfig.responsavelTecnico.cro}
          </p>
        </Container>
      </div>

      <div className="border-t border-[var(--hairline)]">
        <Container className="flex flex-col gap-2 py-6 text-xs text-[var(--color-text-dim)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
          <p>{siteConfig.domain}</p>
        </Container>
      </div>
    </footer>
  );
}

import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Icon } from "@/components/ui/Icon";
import { WhatsappCTA } from "@/components/WhatsappCTA";
import { ButtonLink } from "@/components/ui/Button";
import { ContactForm } from "@/components/ContactForm";
import { SectionReveal } from "@/components/ui/motion";
import {
  siteConfig,
  getTelLink,
  getGoogleMapsSearchUrl,
  getGoogleMapsEmbedUrl,
  analyticsEvents,
} from "@/lib/config";

export const metadata: Metadata = {
  title: "Contato",
  description: "Endereço, horário e WhatsApp da OdontoMinas em Brazlândia-DF.",
  alternates: { canonical: "/contato" },
};

export default function ContatoPage() {
  return (
    <>
      <section className="hero-bleed border-b border-[var(--hairline)] pb-16 pt-[calc(var(--header-h)+72px)]">
        <Container className="max-w-2xl">
          <SectionLabel>Localização</SectionLabel>
          <h1 className="t-display text-[clamp(2.25rem,1.6rem+2.6vw,3.4rem)]">OdontoMinas em Brazlândia</h1>
        </Container>
      </section>

      <section className="section">
        <Container className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <SectionReveal anim="fade-up" className="grid gap-7">
            <div>
              <Icon name="pin" size={22} className="text-[var(--color-cyan)]" />
              <p className="mt-2 text-[var(--color-text-muted)]">{siteConfig.endereco.display}</p>
            </div>
            <div>
              <Icon name="clock" size={22} className="text-[var(--color-cyan)]" />
              <div className="mt-2 grid gap-1 text-[var(--color-text-muted)]">
                {siteConfig.horarios.map((h) => (
                  <p key={h.dias}>
                    <span className="text-[var(--color-text)]">{h.dias}:</span> {h.horario}
                  </p>
                ))}
              </div>
            </div>
            <div>
              <Icon name="phone" size={22} className="text-[var(--color-cyan)]" />
              <p className="mt-2 text-[var(--color-text-muted)]">
                <a href={getTelLink()} data-analytics-event={analyticsEvents.phoneClick} className="hover:text-[var(--color-text)]">
                  {siteConfig.telefoneFixo}
                </a>
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <WhatsappCTA origem="localizacao">Conversar no WhatsApp</WhatsappCTA>
              <ButtonLink
                href={getGoogleMapsSearchUrl()}
                variant="secondary"
                data-analytics-event={analyticsEvents.mapsClick}
              >
                Como chegar
              </ButtonLink>
            </div>
          </SectionReveal>

          <SectionReveal anim="fade-left" delay={80}>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline)]">
              <iframe
                title={`Mapa — ${siteConfig.name} em Brazlândia-DF`}
                src={getGoogleMapsEmbedUrl()}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[320px] w-full sm:h-[380px]"
              />
            </div>
          </SectionReveal>
        </Container>
      </section>

      <section className="section surface-1 border-t border-[var(--hairline)]">
        <Container className="max-w-2xl">
          <SectionReveal anim="fade-up">
            <SectionLabel>Formulário</SectionLabel>
            <h2 className="t-h2">Prefere escrever? Deixe seus dados.</h2>
            <p className="mt-3 text-[var(--color-text-muted)]">
              Ao enviar, a mensagem abre direto no WhatsApp da equipe — nenhum dado fica armazenado neste site.
            </p>
          </SectionReveal>
          <SectionReveal anim="fade-up" delay={80} className="mt-8 max-w-lg">
            <ContactForm />
          </SectionReveal>
        </Container>
      </section>
    </>
  );
}

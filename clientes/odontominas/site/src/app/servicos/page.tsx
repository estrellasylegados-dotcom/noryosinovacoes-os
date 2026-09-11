import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Icon } from "@/components/ui/Icon";
import { WhatsappCTA } from "@/components/WhatsappCTA";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Serviços",
  description: "Implantes e ortodontia na OdontoMinas, em Brazlândia-DF.",
  alternates: { canonical: "/servicos" },
};

export default function ServicosPage() {
  return (
    <>
      <section className="hero-bleed tech-grid glow-cyan relative overflow-hidden border-b border-[var(--hairline)] pb-16 pt-[calc(var(--header-h)+72px)]">
        <Container className="max-w-3xl">
          <SectionLabel>Serviços</SectionLabel>
          <h1 className="t-display text-[clamp(2.25rem,1.6rem+2.6vw,3.4rem)]">Implantes e Ortodontia</h1>
        </Container>
      </section>

      <section id="implantes" className="section border-b border-[var(--hairline)]">
        <Container className="max-w-3xl">
          <Reveal>
            <Icon name="tooth" size={28} className="text-[var(--color-cyan)]" />
            <h2 className="mt-4 t-h2">Implantes</h2>
            <p className="mt-4 text-[var(--color-text-muted)]">
              [PLACEHOLDER: quais tipos de implante a clínica oferece — confirmar com a Ariadna
              antes de publicar]
            </p>
          </Reveal>
        </Container>
      </section>

      <section id="ortodontia" className="section border-b border-[var(--hairline)] surface-1">
        <Container className="max-w-3xl">
          <Reveal>
            <Icon name="shield" size={28} className="text-[var(--color-cyan)]" />
            <h2 className="mt-4 t-h2">Ortodontia</h2>
            <p className="mt-4 text-[var(--color-text-muted)]">
              [PLACEHOLDER: quais tipos de tratamento ortodôntico — fixo, estético, invisível —
              confirmar com a Ariadna antes de publicar]
            </p>
          </Reveal>
        </Container>
      </section>

      <section className="section">
        <Container className="max-w-3xl">
          <Reveal>
            <h2 className="t-h3">Convênios</h2>
            <p className="mt-3 text-[var(--color-text-muted)]">
              [PLACEHOLDER: atende convênio odontológico? quais? — confirmar]
            </p>
          </Reveal>
        </Container>
      </section>

      <section className="section surface-1 border-t border-[var(--hairline)] text-center">
        <Container>
          <h2 className="text-xl font-medium">Quer agendar uma avaliação?</h2>
          <div className="mt-6 flex justify-center">
            <WhatsappCTA message="Olá! Vi os serviços da OdontoMinas no site e gostaria de mais informações.">
              Conversar no WhatsApp
            </WhatsappCTA>
          </div>
        </Container>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Icon } from "@/components/ui/Icon";
import { WhatsappCTA } from "@/components/WhatsappCTA";
import { ButtonLink } from "@/components/ui/Button";
import { ContactForm } from "@/components/ContactForm";
import { Reveal } from "@/components/ui/Reveal";
import { siteConfig, whatsappDisplay } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com a OdontoMinas e agende sua avaliação.",
  alternates: { canonical: "/contato" },
};

export default function ContatoPage() {
  return (
    <section className="section-impact">
      <Container className="max-w-4xl">
        <Reveal>
          <SectionLabel>Contato</SectionLabel>
          <h1 className="t-display text-[clamp(2.25rem,1.6rem+2.6vw,3.4rem)]">
            Vamos agendar sua avaliação?
          </h1>
        </Reveal>

        <div className="mt-10 grid gap-10 md:grid-cols-[1fr_1.2fr]">
          <Reveal delay={70} className="grid gap-6">
            <div>
              <Icon name="pin" size={22} className="text-[var(--color-cyan)]" />
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Brazlândia-DF
                <br />
                {siteConfig.enderecoDisplay}
              </p>
            </div>
            <div>
              <Icon name="clock" size={22} className="text-[var(--color-cyan)]" />
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{siteConfig.horarioDisplay}</p>
            </div>
            <div>
              <Icon name="phone" size={22} className="text-[var(--color-cyan)]" />
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{whatsappDisplay}</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <WhatsappCTA message="Olá! Gostaria de falar com a OdontoMinas sobre uma consulta.">
                Conversar no WhatsApp
              </WhatsappCTA>
              <ButtonLink href={`mailto:${siteConfig.email}`} variant="secondary">
                E-mail
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <ContactForm />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

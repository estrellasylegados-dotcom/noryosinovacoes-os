import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { Reveal } from "@/components/ui/Reveal";
import { Icon } from "@/components/ui/Icon";
import { FaqAccordion } from "@/components/FaqAccordion";
import { WhatsappCTA } from "@/components/WhatsappCTA";
import { ButtonLink } from "@/components/ui/Button";
import { faq } from "@/content/faq";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

const diferenciais = [
  {
    icon: "calendar" as const,
    titulo: "Mais de 18 anos de atuação",
    texto: "Clínica em atividade há mais de 18 anos em Brazlândia-DF.",
  },
  {
    icon: "shield" as const,
    titulo: "Prêmio Top Empresarial",
    texto: "Reconhecida na categoria Clínica Odontológica desde 2014.",
  },
  {
    icon: "check" as const,
    titulo: "Ética e transparência",
    texto: "Atendimento pautado em ética, transparência e tecnologia atualizada.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="hero-bleed tech-grid glow-cyan relative overflow-hidden border-b border-[var(--hairline)] pb-16 pt-[calc(var(--header-h)+72px)]">
        <Container className="max-w-3xl">
          <SectionLabel>Implantes e Ortodontia</SectionLabel>
          <h1 className="t-display text-[clamp(2.25rem,1.6rem+2.6vw,3.4rem)]">
            Cuidado odontológico em implantes e ortodontia, em Brazlândia-DF.
          </h1>
          <p className="mt-6 t-lead">{siteConfig.description}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <WhatsappCTA message="Olá! Vi o site da OdontoMinas e gostaria de agendar uma avaliação.">
              Agendar avaliação
            </WhatsappCTA>
            <ButtonLink href="/servicos" variant="secondary">
              Ver serviços
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="section">
        <Container>
          <Reveal>
            <SectionLabel>Especialidades</SectionLabel>
            <h2 className="t-h2 max-w-xl">Duas frentes de cuidado, um só padrão de atendimento.</h2>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <SpotlightCard>
              <Link href="/servicos#implantes" className="block p-8">
                <Icon name="tooth" size={28} className="text-[var(--color-cyan)]" />
                <h3 className="mt-5 t-h3">Implantes</h3>
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                  [PLACEHOLDER: descrição dos tipos de implante oferecidos — confirmar com a clínica]
                </p>
              </Link>
            </SpotlightCard>
            <SpotlightCard>
              <Link href="/servicos#ortodontia" className="block p-8">
                <Icon name="shield" size={28} className="text-[var(--color-cyan)]" />
                <h3 className="mt-5 t-h3">Ortodontia</h3>
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                  [PLACEHOLDER: descrição dos tipos de tratamento ortodôntico — confirmar com a clínica]
                </p>
              </Link>
            </SpotlightCard>
          </div>
        </Container>
      </section>

      <section className="section surface-1 border-t border-[var(--hairline)]">
        <Container>
          <Reveal>
            <SectionLabel>Por que a OdontoMinas</SectionLabel>
            <h2 className="t-h2 max-w-xl">O que já é fato, sem promessa em cima.</h2>
          </Reveal>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {diferenciais.map((item) => (
              <div key={item.titulo}>
                <Icon name={item.icon} size={24} className="text-[var(--color-cyan)]" />
                <h3 className="mt-4 font-medium tracking-tight">{item.titulo}</h3>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{item.texto}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="section">
        <Container className="max-w-2xl">
          <Reveal>
            <SectionLabel>Perguntas frequentes</SectionLabel>
            <h2 className="t-h2">Antes de agendar</h2>
          </Reveal>
          <div className="mt-8">
            <FaqAccordion items={faq} />
          </div>
        </Container>
      </section>

      <section className="section surface-1 border-t border-[var(--hairline)] text-center">
        <Container>
          <h2 className="text-xl font-medium">Quer agendar uma avaliação?</h2>
          <div className="mt-6 flex justify-center">
            <WhatsappCTA>Conversar no WhatsApp</WhatsappCTA>
          </div>
        </Container>
      </section>
    </>
  );
}

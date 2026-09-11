import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { WhatsappCTA } from "@/components/WhatsappCTA";
import { Reveal } from "@/components/ui/Reveal";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Sobre",
  description: "Conheça a OdontoMinas, clínica de implantes e ortodontia em Brazlândia-DF.",
  alternates: { canonical: "/sobre" },
};

export default function SobrePage() {
  return (
    <>
      <section className="hero-bleed tech-grid glow-cyan relative overflow-hidden border-b border-[var(--hairline)] pb-16 pt-[calc(var(--header-h)+72px)]">
        <Container className="max-w-3xl">
          <SectionLabel>Sobre a OdontoMinas</SectionLabel>
          <h1 className="t-display text-[clamp(2.25rem,1.6rem+2.6vw,3.4rem)]">
            Mais de 18 anos de cuidado odontológico em Brazlândia-DF.
          </h1>
        </Container>
      </section>

      <section className="section">
        <Container className="grid gap-10 max-w-3xl">
          <Reveal>
            <h2 className="t-h3">História</h2>
            <p className="mt-3 text-[var(--color-text-muted)]">
              A OdontoMinas atua há mais de 18 anos em Brazlândia-DF, com foco em implantes e
              ortodontia. A clínica foi reconhecida com o Prêmio Top Empresarial, categoria
              Clínica Odontológica, todos os anos desde 2014.
            </p>
          </Reveal>
          <Reveal delay={70}>
            <h2 className="t-h3">Valores</h2>
            <p className="mt-3 text-[var(--color-text-muted)]">
              Atendimento pautado em ética, transparência e tecnologia atualizada, com foco no
              bem-estar de pacientes de todas as idades.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <h2 className="t-h3">Responsável técnico</h2>
            <p className="mt-3 text-[var(--color-text-muted)]">
              {siteConfig.responsavelTecnico.nome} — CRO {siteConfig.responsavelTecnico.cro}
            </p>
          </Reveal>
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

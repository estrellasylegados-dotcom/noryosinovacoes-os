import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Icon } from "@/components/ui/Icon";
import { PhotoPlaceholder } from "@/components/ui/PhotoPlaceholder";
import { StepList } from "@/components/ui/StepList";
import { SectionReveal } from "@/components/ui/motion";
import { WhatsappCTA } from "@/components/WhatsappCTA";
import { getPublicTratamentos } from "@/content/tratamentos";
import { jornada } from "@/content/jornada";
import { siteConfig } from "@/lib/config";
import { serviceJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Tratamentos",
  description: "Implantodontia, ortodontia, prótese dentária e harmonização orofacial na OdontoMinas, em Brazlândia-DF.",
  alternates: { canonical: "/servicos" },
};

export default function ServicosPage() {
  const tratamentos = getPublicTratamentos();

  return (
    <>
      <section className="hero-bleed relative overflow-hidden border-b border-[var(--hairline)] pb-16 pt-[calc(var(--header-h)+72px)]">
        <Container className="max-w-2xl">
          <SectionLabel>Tratamentos</SectionLabel>
          <h1 className="t-display text-[clamp(2.25rem,1.6rem+2.6vw,3.4rem)]">
            Cada tratamento parte de uma avaliação individual.
          </h1>
        </Container>
      </section>

      {tratamentos.map((t, i) => (
        <section
          key={t.slug}
          id={t.slug}
          className={`section scroll-mt-[var(--header-h)] ${i % 2 === 1 ? "surface-1" : ""} ${
            i < tratamentos.length - 1 ? "border-b border-[var(--hairline)]" : ""
          }`}
        >
          <Container className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <SectionReveal anim={i % 2 === 1 ? "fade-left" : "fade-right"}>
              <PhotoPlaceholder aspect="aspect-[5/4]" icon={<Icon name={t.icon} size={56} strokeWidth={1} />} />
            </SectionReveal>
            <SectionReveal anim={i % 2 === 1 ? "fade-right" : "fade-left"} delay={80}>
              <Icon name={t.icon} size={26} className="text-[var(--color-cyan)]" />
              <h2 className="mt-4 t-h2">{t.nome}</h2>
              <p className="mt-4 max-w-lg text-[var(--color-text-muted)]">{t.descricao}</p>
              <div className="mt-6">
                <WhatsappCTA origem={t.slug === "implantes" ? "implantes" : "servicos"} variant="secondary" withArrow>
                  Quero avaliar meu caso
                </WhatsappCTA>
              </div>
              <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(serviceJsonLd({
                nome: t.nome,
                descricao: t.descricao,
                url: `${siteConfig.url}/servicos#${t.slug}`,
              }))} />
            </SectionReveal>
          </Container>
        </section>
      ))}

      {/* COMO FUNCIONA O ATENDIMENTO ---------------------------------------- */}
      <section className="section">
        <Container className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <SectionReveal anim="fade-up">
            <SectionLabel>Atendimento</SectionLabel>
            <h2 className="t-h2 max-w-xs">Como funciona, do primeiro contato ao acompanhamento.</h2>
          </SectionReveal>
          <SectionReveal anim="fade-up" delay={80}>
            <StepList items={jornada} />
          </SectionReveal>
        </Container>
      </section>

      <section className="section surface-1 border-t border-[var(--hairline)] text-center">
        <Container>
          <SectionReveal anim="scale-in" className="mx-auto max-w-lg">
            <h2 className="t-h2">Quer agendar uma avaliação?</h2>
            <div className="mt-7 flex justify-center">
              <WhatsappCTA origem="servicos" withArrow>
                Conversar no WhatsApp
              </WhatsappCTA>
            </div>
          </SectionReveal>
        </Container>
      </section>
    </>
  );
}

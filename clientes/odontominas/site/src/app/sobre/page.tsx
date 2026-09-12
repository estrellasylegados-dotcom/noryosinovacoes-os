import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Icon } from "@/components/ui/Icon";
import { PhotoPlaceholder } from "@/components/ui/PhotoPlaceholder";
import { StepList } from "@/components/ui/StepList";
import { SectionReveal } from "@/components/ui/motion";
import { WhatsappCTA } from "@/components/WhatsappCTA";
import { ariadna, getPublicTimeline } from "@/content/equipe";
import { siteConfig, getAnosDeAtuacao } from "@/lib/config";

export const metadata: Metadata = {
  title: "Sobre",
  description: "Conheça a OdontoMinas e a Dra. Ariadna Pires, em Brazlândia-DF.",
  alternates: { canonical: "/sobre" },
};

export default function SobrePage() {
  const timeline = getPublicTimeline();

  return (
    <>
      <section className="hero-bleed relative overflow-hidden border-b border-[var(--hairline)] pb-16 pt-[calc(var(--header-h)+72px)]">
        <Container className="max-w-2xl">
          <SectionLabel>A clínica</SectionLabel>
          <h1 className="t-display text-[clamp(2.25rem,1.6rem+2.6vw,3.4rem)]">
            Em Brazlândia desde {siteConfig.anoFundacao}, atendimento conduzido por quem assina.
          </h1>
        </Container>
      </section>

      {/* SOBRE A ODONTOMINAS ------------------------------------------- */}
      <section className="section">
        <Container className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <SectionReveal anim="fade-up" className="max-w-xl">
            <h2 className="t-h3">A OdontoMinas</h2>
            <p className="mt-4 text-[var(--color-text-muted)]">
              A OdontoMinas atua em Brazlândia-DF oferecendo acompanhamento odontológico especializado,
              combinando experiência profissional, planejamento individualizado e atualização constante. A
              empresa existe formalmente desde {siteConfig.anoFundacao} — {getAnosDeAtuacao()} anos de
              atuação contínua na cidade.
            </p>
            <p className="mt-4 text-[var(--color-text-muted)]">
              Reconhecida com o Prêmio Top Empresarial, categoria Clínica Odontológica, todos os anos desde
              2014.
            </p>
          </SectionReveal>
          <SectionReveal anim="fade-left" delay={80}>
            <PhotoPlaceholder aspect="aspect-[4/3]" label="Fachada" icon={<Icon name="pin" size={48} strokeWidth={1} />} />
          </SectionReveal>
        </Container>
      </section>

      {/* DRA. ARIADNA ---------------------------------------------------- */}
      <section id="ariadna" className="section surface-1 border-y border-[var(--hairline)] scroll-mt-[var(--header-h)]">
        <Container className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <SectionReveal anim="fade-right">
            <PhotoPlaceholder
              aspect="aspect-[3/4]"
              label={ariadna.nomeExibicao}
              icon={<Icon name="check" size={48} strokeWidth={1} />}
            />
          </SectionReveal>

          <div>
            <SectionReveal anim="fade-up">
              <SectionLabel>Responsável técnica</SectionLabel>
              <h2 className="t-h2">{ariadna.nomeCompleto}</h2>
              <p className="mt-2 text-sm text-[var(--color-text-dim)]">
                {ariadna.profissao} — {ariadna.cro}
              </p>
              <p className="mt-5 max-w-lg text-[var(--color-text-muted)]">{ariadna.resumo}</p>

              <ul className="mt-6 flex flex-wrap gap-2">
                {ariadna.areasAtuacao.map((area) => (
                  <li
                    key={area}
                    className="rounded-full border border-[var(--hairline-strong)] px-3.5 py-1.5 text-xs text-[var(--color-text-muted)]"
                  >
                    {area}
                  </li>
                ))}
              </ul>
            </SectionReveal>

            <SectionReveal anim="fade-up" delay={100} className="mt-12">
              <h3 className="t-label text-[var(--color-text-dim)]">Trajetória</h3>
              <div className="mt-6">
                <StepList
                  items={timeline.map((item) => ({ numero: item.ano, titulo: item.titulo, texto: item.descricao }))}
                />
              </div>
            </SectionReveal>
          </div>
        </Container>
      </section>

      <section className="section text-center">
        <Container>
          <SectionReveal anim="scale-in" className="mx-auto max-w-lg">
            <h2 className="t-h2">Quer agendar uma avaliação com a equipe?</h2>
            <div className="mt-7 flex justify-center">
              <WhatsappCTA origem="ariadna" withArrow>
                Conversar no WhatsApp
              </WhatsappCTA>
            </div>
          </SectionReveal>
        </Container>
      </section>
    </>
  );
}

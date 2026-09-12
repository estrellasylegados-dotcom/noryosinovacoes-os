import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Icon } from "@/components/ui/Icon";
import { PhotoPlaceholder } from "@/components/ui/PhotoPlaceholder";
import { RatingStars } from "@/components/ui/RatingStars";
import { StepList } from "@/components/ui/StepList";
import { SectionReveal, Stagger, StaggerItem, Parallax } from "@/components/ui/motion";
import { FaqAccordion } from "@/components/FaqAccordion";
import { WhatsappCTA } from "@/components/WhatsappCTA";
import { ButtonLink } from "@/components/ui/Button";
import { faq } from "@/content/faq";
import { diferenciais } from "@/content/diferenciais";
import { jornada } from "@/content/jornada";
import { getPublicTratamentos, getDestaque } from "@/content/tratamentos";
import { ariadna } from "@/content/equipe";
import { siteConfig, getAnosDeAtuacao, getNotaDisplay, getGoogleMapsSearchUrl } from "@/lib/config";
import { faqJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const tratamentos = getPublicTratamentos();
  const destaque = getDestaque();

  return (
    <>
      {/* HERO ---------------------------------------------------------- */}
      <section className="hero-bleed relative overflow-hidden border-b border-[var(--hairline)] pb-20 pt-[calc(var(--header-h)+64px)] sm:pb-24">
        <Container className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <SectionReveal anim="fade-up">
            <SectionLabel>Odontologia em Brazlândia — Implantes e Ortodontia</SectionLabel>
            <h1 className="t-display max-w-xl">
              Implantes e ortodontia com planejamento individual, em Brazlândia.
            </h1>
            <p className="mt-6 t-lead max-w-lg">
              A OdontoMinas atua em Brazlândia-DF desde {siteConfig.anoFundacao}, sob responsabilidade
              da {ariadna.nomeExibicao} ({ariadna.cro}), com avaliação clínica própria para cada tratamento.
            </p>

            <div className="mt-7 flex items-center gap-3">
              <RatingStars />
              <p className="text-sm text-[var(--color-text-muted)]">
                <strong className="text-[var(--color-text)]">{getNotaDisplay()}</strong> no Google ·{" "}
                <a href={getGoogleMapsSearchUrl()} target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--hairline-strong)] underline-offset-4 hover:text-[var(--color-text)]">
                  mais de {siteConfig.avaliacoes.total} avaliações
                </a>
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <WhatsappCTA origem="hero" withArrow>
                Agendar uma avaliação
              </WhatsappCTA>
              <ButtonLink href="/servicos" variant="secondary">
                Conhecer tratamentos
              </ButtonLink>
            </div>
          </SectionReveal>

          <SectionReveal anim="fade-left" delay={100}>
            <Parallax strength={14}>
              <PhotoPlaceholder
                aspect="aspect-[4/5]"
                label="Brazlândia-DF"
                icon={<Icon name="tooth" size={72} strokeWidth={1} />}
              />
            </Parallax>
          </SectionReveal>
        </Container>
      </section>

      {/* TRATAMENTOS ----------------------------------------------------- */}
      <section className="section">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <SectionReveal anim="fade-up">
            <SectionLabel>Tratamentos</SectionLabel>
            <h2 className="t-h2 max-w-sm">Cada tratamento parte de uma avaliação, não de um pacote pronto.</h2>
            <p className="mt-5 max-w-sm text-[var(--color-text-muted)]">
              A OdontoMinas concentra a atuação em quatro frentes. O que muda de paciente pra paciente é o
              plano — nunca o padrão de avaliação.
            </p>
          </SectionReveal>

          <Stagger as="ol" className="grid divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
            {tratamentos.map((t, i) => (
              <StaggerItem key={t.slug} as="li" index={i} anim="fade-up">
                <Link
                  href={`/servicos#${t.slug}`}
                  className="group/row flex items-center gap-5 py-6 transition-colors hover:bg-[var(--color-surface-1)]"
                >
                  <span className="font-mono text-xs text-[var(--color-text-dim)]">0{i + 1}</span>
                  <Icon name={t.icon} size={22} className="shrink-0 text-[var(--color-cyan)]" />
                  <span className="flex-1">
                    <span className="block t-h3">{t.nome}</span>
                    <span className="mt-1 block text-sm text-[var(--color-text-muted)]">{t.resumo}</span>
                  </span>
                  <Icon
                    name="arrow"
                    size={18}
                    className="shrink-0 text-[var(--color-text-dim)] transition-transform duration-200 group-hover/row:translate-x-1 group-hover/row:text-[var(--color-cyan)]"
                  />
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </Container>
      </section>

      {/* DESTAQUE IMPLANTES ------------------------------------------------ */}
      <section id="implantes" className="section surface-1 border-y border-[var(--hairline)]">
        <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionReveal anim="fade-right">
            <PhotoPlaceholder aspect="aspect-[5/4]" icon={<Icon name="tooth" size={64} strokeWidth={1} />} />
          </SectionReveal>
          <SectionReveal anim="fade-left" delay={80}>
            <SectionLabel>Implantodontia</SectionLabel>
            <h2 className="t-h2">Volte a sorrir e mastigar com mais segurança.</h2>
            <p className="mt-5 text-[var(--color-text-muted)]">{destaque.descricao}</p>
            <div className="mt-7">
              <WhatsappCTA origem="implantes" withArrow>
                Quero avaliar meu caso
              </WhatsappCTA>
            </div>
          </SectionReveal>
        </Container>
      </section>

      {/* DRA. ARIADNA (prévia) -------------------------------------------- */}
      <section className="section">
        <Container className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <SectionReveal anim="fade-right">
            <PhotoPlaceholder
              aspect="aspect-[3/4]"
              label={ariadna.nomeExibicao}
              icon={<Icon name="check" size={48} strokeWidth={1} />}
            />
          </SectionReveal>
          <SectionReveal anim="fade-left" delay={80}>
            <SectionLabel>Responsável técnica</SectionLabel>
            <h2 className="t-h2">{ariadna.nomeExibicao}</h2>
            <p className="mt-2 text-sm text-[var(--color-text-dim)]">
              {ariadna.profissao} — {ariadna.cro}
            </p>
            <p className="mt-5 max-w-lg text-[var(--color-text-muted)]">{ariadna.resumo}</p>
            <ButtonLink href="/sobre#ariadna" variant="ghost" className="mt-6 !px-0" withArrow>
              Conhecer a trajetória
            </ButtonLink>
          </SectionReveal>
        </Container>
      </section>

      {/* SOBRE A ODONTOMINAS + DIFERENCIAIS -------------------------------- */}
      <section className="section surface-1 border-y border-[var(--hairline)]">
        <Container>
          <SectionReveal anim="fade-up" className="max-w-2xl">
            <SectionLabel>A clínica</SectionLabel>
            <h2 className="t-h2">
              Em Brazlândia desde {siteConfig.anoFundacao}, com {getAnosDeAtuacao()} anos de atuação contínua.
            </h2>
            <p className="mt-5 text-[var(--color-text-muted)]">
              A OdontoMinas atua em Brazlândia-DF oferecendo acompanhamento odontológico especializado,
              combinando experiência profissional, planejamento individualizado e atualização constante.
            </p>
          </SectionReveal>

          <Stagger className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {diferenciais.map((d, i) => (
              <StaggerItem key={d.numero} index={i} anim="fade-up" className="flex gap-5 border-t border-[var(--hairline)] pt-6">
                <span className="font-mono text-xs text-[var(--color-cyan)]">{d.numero}</span>
                <div>
                  <h3 className="t-h3">{d.titulo}</h3>
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">{d.texto}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </Container>
      </section>

      {/* JORNADA DO PACIENTE ----------------------------------------------- */}
      <section className="section">
        <Container className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <SectionReveal anim="fade-up">
            <SectionLabel>Como funciona</SectionLabel>
            <h2 className="t-h2 max-w-xs">Do primeiro contato ao acompanhamento.</h2>
          </SectionReveal>
          <SectionReveal anim="fade-up" delay={80}>
            <StepList items={jornada} />
          </SectionReveal>
        </Container>
      </section>

      {/* AVALIAÇÕES ---------------------------------------------------- */}
      <section id="avaliacoes" className="section surface-1 border-y border-[var(--hairline)] text-center">
        <Container className="max-w-xl">
          <SectionReveal anim="scale-in">
            <SectionLabel className="justify-center">Avaliações</SectionLabel>
            <RatingStars size={22} />
            <p className="mt-4 t-h2">{getNotaDisplay()} no Google</p>
            <p className="mt-2 text-[var(--color-text-muted)]">
              Mais de {siteConfig.avaliacoes.total} avaliações de pacientes em Brazlândia-DF.
            </p>
            <ButtonLink href={getGoogleMapsSearchUrl()} variant="secondary" className="mt-7" withArrow>
              Ver avaliações no Google
            </ButtonLink>
          </SectionReveal>
        </Container>
      </section>

      {/* LOCALIZAÇÃO (prévia) ---------------------------------------------- */}
      <section className="section">
        <Container className="grid items-start gap-10 sm:grid-cols-2">
          <SectionReveal anim="fade-up">
            <SectionLabel>Localização</SectionLabel>
            <h2 className="t-h2">OdontoMinas em Brazlândia</h2>
            <p className="mt-4 text-[var(--color-text-muted)]">{siteConfig.endereco.display}</p>
          </SectionReveal>
          <SectionReveal anim="fade-up" delay={80} className="grid gap-3 sm:justify-items-end sm:text-right">
            {siteConfig.horarios.map((h) => (
              <p key={h.dias} className="text-sm text-[var(--color-text-muted)]">
                <span className="text-[var(--color-text)]">{h.dias}:</span> {h.horario}
              </p>
            ))}
            <ButtonLink href="/contato" variant="ghost" className="mt-2 sm:!px-0" withArrow>
              Ver mapa e como chegar
            </ButtonLink>
          </SectionReveal>
        </Container>
      </section>

      {/* FAQ -------------------------------------------------------------- */}
      <section id="faq" className="section surface-1 border-t border-[var(--hairline)]">
        <Container className="max-w-2xl">
          <SectionReveal anim="fade-up">
            <SectionLabel>Perguntas frequentes</SectionLabel>
            <h2 className="t-h2">Antes de agendar</h2>
          </SectionReveal>
          <SectionReveal anim="fade-up" delay={80} className="mt-8">
            <FaqAccordion items={faq} />
          </SectionReveal>
          <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqJsonLd(faq))} />
        </Container>
      </section>

      {/* CTA FINAL ---------------------------------------------------------- */}
      <section className="section-impact border-t border-[var(--hairline)] text-center">
        <Container>
          <SectionReveal anim="scale-in" className="mx-auto max-w-lg">
            <h2 className="t-h2">Quer agendar uma avaliação na OdontoMinas?</h2>
            <p className="mt-4 text-[var(--color-text-muted)]">
              Fale com a equipe pelo WhatsApp e encontre um horário para conhecer o seu caso.
            </p>
            <div className="mt-8 flex justify-center">
              <WhatsappCTA origem="geral" withArrow>
                Conversar no WhatsApp
              </WhatsappCTA>
            </div>
          </SectionReveal>
        </Container>
      </section>
    </>
  );
}

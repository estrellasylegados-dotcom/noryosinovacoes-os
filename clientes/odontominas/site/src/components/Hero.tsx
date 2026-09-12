import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { RatingStars } from "@/components/ui/RatingStars";
import { Stagger, StaggerItem, SectionReveal, Parallax } from "@/components/ui/motion";
import { WhatsappCTA } from "@/components/WhatsappCTA";
import { ButtonLink } from "@/components/ui/Button";
import { CorrectTransformation } from "@/components/CorrectTransformation";
import { ariadna } from "@/content/equipe";
import { siteConfig, getNotaDisplay, getGoogleMapsSearchUrl } from "@/lib/config";

/**
 * Hero da home — revisão de direção de arte 2026-09 (ver decisões).
 * Título em duas cores (ink + degradê de assinatura), entrada com stagger
 * pontual entre eyebrow/título/subtítulo/prova social/CTA, e o antigo
 * placeholder (ícone de dente sozinho num bloco vazio) substituído pela
 * simulação do Protocolo Correct Full Arch — ver CorrectTransformation.tsx.
 */
export function Hero() {
  return (
    <section className="hero-bleed relative overflow-hidden border-b border-[var(--hairline)] pb-20 pt-[calc(var(--header-h)+64px)] sm:pb-24">
      <Container className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <Stagger>
          <StaggerItem index={0} anim="fade-up">
            <SectionLabel>Brazlândia · Distrito Federal</SectionLabel>
          </StaggerItem>

          <StaggerItem index={1} anim="fade-up">
            <h1 className="hero-title max-w-[19ch]">
              <span className="block">Implantes e ortodontia</span>
              <span className="accent-gradient block">com planejamento feito para cada sorriso.</span>
            </h1>
          </StaggerItem>

          <StaggerItem index={2} anim="fade-up">
            <p className="mt-6 t-lead max-w-lg">
              A OdontoMinas atua em Brazlândia-DF desde {siteConfig.anoFundacao}, sob responsabilidade da{" "}
              {ariadna.nomeExibicao} ({ariadna.cro}), com avaliação clínica própria para cada tratamento.
            </p>
          </StaggerItem>

          <StaggerItem index={3} anim="fade-up">
            <div className="mt-7 flex items-center gap-3">
              <RatingStars />
              <p className="text-sm text-[var(--color-text-muted)]">
                <strong className="text-[var(--color-text)]">{getNotaDisplay()}</strong> no Google ·{" "}
                <a
                  href={getGoogleMapsSearchUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-[var(--hairline-strong)] underline-offset-4 hover:text-[var(--color-text)]"
                >
                  mais de {siteConfig.avaliacoes.total} avaliações
                </a>
              </p>
            </div>
          </StaggerItem>

          <StaggerItem index={4} anim="fade-up">
            <div className="mt-8 flex flex-wrap gap-4">
              <WhatsappCTA origem="hero" withArrow>
                Agendar uma avaliação
              </WhatsappCTA>
              <ButtonLink href="/servicos" variant="secondary">
                Conhecer tratamentos
              </ButtonLink>
            </div>
          </StaggerItem>
        </Stagger>

        <SectionReveal anim="fade-left" delay={120}>
          <Parallax strength={10}>
            <CorrectTransformation variant="interactive" />
            <a
              href="#protocolo-correct"
              className="group/link mt-4 flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-cyan)]"
            >
              Conhecer o Protocolo Correct
              <span aria-hidden className="transition-transform duration-200 group-hover/link:translate-x-1">
                →
              </span>
            </a>
          </Parallax>
        </SectionReveal>
      </Container>
    </section>
  );
}

import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Icon } from "@/components/ui/Icon";
import { SectionReveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { WhatsappCTA } from "@/components/WhatsappCTA";
import { ButtonLink } from "@/components/ui/Button";
import { CorrectTransformation } from "@/components/CorrectTransformation";
import { FaqAccordion } from "@/components/FaqAccordion";
import { protocolo, beneficiosProtocolo, jornadaProtocolo } from "@/content/protocolo";
import { faqProtocolo } from "@/content/faq";
import { siteConfig } from "@/lib/config";
import { serviceJsonLd, faqJsonLd, jsonLdScript } from "@/lib/seo";

/**
 * Seção editorial dedicada ao Protocolo Correct Full Arch — substitui o
 * antigo bloco genérico "Volte a sorrir e mastigar com mais segurança"
 * (raso demais pro diferencial real da clínica). Linguagem própria: lista
 * de benefícios sem borda (distinta da lista de diferenciais mais abaixo na
 * página) e jornada em fluxo horizontal (distinta do StepList vertical da
 * seção "Como funciona" geral) — cada seção da home com composição própria,
 * nada de "3 cards, 4 cards" repetido.
 */
export function CorrectProtocol() {
  return (
    <section id="protocolo-correct" className="section scroll-mt-[var(--header-h)] bg-[var(--color-aqua-50)]">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <SectionReveal anim="fade-up">
            <SectionLabel>{protocolo.overline}</SectionLabel>
            <h2 className="t-h2 max-w-lg">{protocolo.headline}</h2>
            <p className="mt-5 max-w-lg text-[var(--color-text-muted)]">{protocolo.subheadline}</p>
            <p className="mt-4 max-w-lg text-sm text-[var(--color-text-dim)]">{protocolo.medica}</p>

            <div className="mt-8 flex flex-wrap gap-4">
              <WhatsappCTA origem="protocolo" withArrow>
                {protocolo.ctaPrincipal}
              </WhatsappCTA>
              <ButtonLink href="#protocolo-faq" variant="ghost">
                {protocolo.ctaSecundario}
              </ButtonLink>
            </div>
          </SectionReveal>

          <SectionReveal anim="fade-left" delay={100} className="mx-auto w-full max-w-sm lg:max-w-none">
            <CorrectTransformation variant="ambient" showLabel={false} />
          </SectionReveal>
        </div>

        {/* BENEFÍCIOS — lista editorial sem borda, sem número fixo de implantes/prazos */}
        <Stagger className="mt-20 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
          {beneficiosProtocolo.map((b, i) => (
            <StaggerItem key={b.numero} index={i} anim="fade-up">
              <span className="font-mono text-2xl text-[var(--color-cyan)]">{b.numero}</span>
              <h3 className="mt-3 t-h3">{b.titulo}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{b.texto}</p>
            </StaggerItem>
          ))}
        </Stagger>

        {/* COMO FUNCIONA — fluxo horizontal compacto, sem prazo nem carga imediata */}
        <SectionReveal anim="fade-up" className="mt-16 lg:mt-20">
          <h3 className="t-label text-[var(--color-text-dim)]">Como funciona</h3>
          <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-4">
            {jornadaProtocolo.map((etapa, i) => (
              <li key={etapa.numero} className="flex items-center gap-2">
                <span className="flex items-baseline gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--color-surface-1)] px-4 py-2">
                  <span className="font-mono text-xs text-[var(--color-cyan)]">{etapa.numero}</span>
                  <span className="text-sm font-medium text-[var(--color-text)]">{etapa.titulo}</span>
                </span>
                {i < jornadaProtocolo.length - 1 && (
                  <Icon name="arrow" size={16} className="text-[var(--color-text-dim)]" />
                )}
              </li>
            ))}
          </ol>
        </SectionReveal>

        {/* FAQ DO PROTOCOLO --------------------------------------------------- */}
        <SectionReveal anim="fade-up" id="protocolo-faq" className="mt-20 max-w-2xl scroll-mt-[var(--header-h)] lg:mt-24">
          <h3 className="t-h2 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">Perguntas sobre o Protocolo Correct</h3>
          <div className="mt-8">
            <FaqAccordion items={faqProtocolo} />
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={jsonLdScript(faqJsonLd(faqProtocolo))}
          />
        </SectionReveal>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(
            serviceJsonLd({
              nome: "Protocolo Correct Full Arch",
              descricao: protocolo.subheadline,
              url: `${siteConfig.url}/#protocolo-correct`,
            })
          )}
        />
      </Container>
    </section>
  );
}

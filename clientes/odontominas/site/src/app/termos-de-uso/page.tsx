import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: `Condições de uso do site da ${siteConfig.name}.`,
  alternates: { canonical: "/termos-de-uso" },
};

export default function TermosDeUsoPage() {
  return (
    <section className="section-impact">
      <Container className="max-w-2xl">
        <SectionLabel>Termos</SectionLabel>
        <h1 className="t-h2">Termos de Uso</h1>
        <p className="mt-3 text-sm text-[var(--color-text-dim)]">Última atualização: 11 de setembro de 2026.</p>

        <div className="mt-10 grid gap-8 text-[var(--color-text-muted)]">
          <div>
            <h2 className="t-h3 text-[var(--color-text)]">Sobre este site</h2>
            <p className="mt-2">
              Este site é um canal institucional de {siteConfig.razaoSocial} (CNPJ {siteConfig.cnpj}),
              mantido para apresentar a clínica e facilitar o contato com a equipe. O uso deste site implica
              a concordância com estes termos.
            </p>
          </div>

          <div>
            <h2 className="t-h3 text-[var(--color-text)]">Caráter informativo</h2>
            <p className="mt-2">
              O conteúdo deste site é institucional e não substitui uma consulta odontológica. Nenhuma
              informação publicada aqui constitui diagnóstico, indicação de tratamento ou promessa de
              resultado — toda indicação clínica depende de avaliação presencial.
            </p>
          </div>

          <div>
            <h2 className="t-h3 text-[var(--color-text)]">Conteúdo e propriedade</h2>
            <p className="mt-2">
              Textos, imagens e identidade visual deste site pertencem a {siteConfig.razaoSocial} e não podem
              ser reproduzidos sem autorização.
            </p>
          </div>

          <div>
            <h2 className="t-h3 text-[var(--color-text)]">Links externos</h2>
            <p className="mt-2">
              Este site pode conter links para serviços de terceiros (como WhatsApp e Google Maps). Não nos
              responsabilizamos pelo conteúdo ou pelas políticas desses serviços.
            </p>
          </div>

          <div>
            <h2 className="t-h3 text-[var(--color-text)]">Legislação aplicável</h2>
            <p className="mt-2">
              Estes termos são regidos pela legislação brasileira, com foro no Distrito Federal. Dúvidas
              podem ser enviadas para{" "}
              <a href={`mailto:${siteConfig.email}`} className="underline decoration-[var(--hairline-strong)] underline-offset-4 hover:text-[var(--color-text)]">
                {siteConfig.email}
              </a>
              .
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

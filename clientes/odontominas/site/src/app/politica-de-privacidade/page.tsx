import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: `Como a ${siteConfig.name} trata os dados de quem visita o site.`,
  alternates: { canonical: "/politica-de-privacidade" },
};

export default function PoliticaDePrivacidadePage() {
  return (
    <section className="section-impact">
      <Container className="max-w-2xl">
        <SectionLabel>Privacidade</SectionLabel>
        <h1 className="t-h2">Política de Privacidade</h1>
        <p className="mt-3 text-sm text-[var(--color-text-dim)]">Última atualização: 11 de setembro de 2026.</p>

        <div className="mt-10 grid gap-8 text-[var(--color-text-muted)]">
          <div>
            <h2 className="t-h3 text-[var(--color-text)]">Quem trata os dados</h2>
            <p className="mt-2">
              Este site é mantido por {siteConfig.razaoSocial}, CNPJ {siteConfig.cnpj}, controladora dos
              dados tratados aqui, nos termos da Lei nº 13.709/2018 (LGPD).
            </p>
          </div>

          <div>
            <h2 className="t-h3 text-[var(--color-text)]">Quais dados são coletados</h2>
            <p className="mt-2">
              Este site não usa formulário com banco de dados nem cadastro de usuário. Os únicos dados
              tratados são os que você mesmo decide enviar por WhatsApp, e-mail ou pelo formulário de
              contato — normalmente nome, telefone e o conteúdo da sua mensagem. O formulário de contato
              não armazena nada neste servidor: ao enviar, ele apenas abre o WhatsApp com sua mensagem
              pré-preenchida.
            </p>
            <p className="mt-2">
              Não solicitamos informações médicas ou de saúde por este site. Detalhes clínicos são tratados
              apenas presencialmente, durante o atendimento.
            </p>
          </div>

          <div>
            <h2 className="t-h3 text-[var(--color-text)]">Para que os dados são usados</h2>
            <p className="mt-2">
              Exclusivamente para responder ao seu contato e organizar o agendamento de uma avaliação. Não
              compartilhamos esses dados com terceiros para fins de marketing.
            </p>
          </div>

          <div>
            <h2 className="t-h3 text-[var(--color-text)]">Cookies e métricas</h2>
            <p className="mt-2">
              Este site pode usar ferramentas de métricas de audiência (como Google Analytics) para entender,
              de forma agregada, como as páginas são acessadas. Nenhuma informação de identificação pessoal é
              coletada por essas ferramentas.
            </p>
          </div>

          <div>
            <h2 className="t-h3 text-[var(--color-text)]">Seus direitos</h2>
            <p className="mt-2">
              Você pode pedir a confirmação, o acesso, a correção ou a eliminação dos seus dados a qualquer
              momento, escrevendo para{" "}
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

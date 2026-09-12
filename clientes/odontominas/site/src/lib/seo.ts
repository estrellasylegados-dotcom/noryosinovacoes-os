import { siteConfig } from "./config";

/** JSON-LD Dentist — entidade principal do site, usado uma vez no layout raiz. */
export function dentistJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Dentist",
    name: siteConfig.name,
    legalName: siteConfig.razaoSocial,
    url: siteConfig.url,
    image: `${siteConfig.url}/odontominas-logo.png`,
    telephone: siteConfig.telefoneFixo,
    email: siteConfig.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.endereco.logradouro,
      addressLocality: siteConfig.endereco.cidade,
      addressRegion: siteConfig.endereco.uf,
      postalCode: siteConfig.endereco.cep,
      addressCountry: "BR",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:00",
        closes: "18:00",
      },
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "08:00", closes: "12:00" },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: siteConfig.avaliacoes.nota,
      reviewCount: siteConfig.avaliacoes.total,
    },
    areaServed: "Brazlândia, Brasília-DF",
  };
}

/** JSON-LD WebSite — usado uma vez no layout raiz. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: "pt-BR",
  };
}

/** JSON-LD Service — usado por tratamento confirmado na página de Serviços. */
export function serviceJsonLd(input: { nome: string; descricao: string; url: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: input.nome,
    description: input.descricao,
    url: input.url,
    provider: {
      "@type": "Dentist",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    areaServed: "Brazlândia, Brasília-DF",
  };
}

/** JSON-LD BreadcrumbList — usado nas páginas internas. */
export function breadcrumbJsonLd(items: { nome: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.nome,
      item: item.url,
    })),
  };
}

/** JSON-LD FAQPage — usado na seção de FAQ da Home. */
export function faqJsonLd(perguntas: { pergunta: string; resposta: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: perguntas.map((item) => ({
      "@type": "Question",
      name: item.pergunta,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.resposta,
      },
    })),
  };
}

/** Componente utilitário — injeta JSON-LD com segurança (sem dangerouslySetInnerHTML espalhado). */
export function jsonLdScript(data: object) {
  return {
    __html: JSON.stringify(data),
  };
}

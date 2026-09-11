import { siteConfig } from "./config";

/** JSON-LD Organization — usado uma vez no layout raiz. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    alternateName: siteConfig.shortName,
    url: siteConfig.url,
    logo: `${siteConfig.url}/odontominas-logo.png`,
    email: siteConfig.email,
    description: siteConfig.description,
    areaServed: "BR",
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

/** JSON-LD Service — usado nas páginas de solução. */
export function serviceJsonLd(input: { nome: string; descricao: string; url: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: input.nome,
    description: input.descricao,
    url: input.url,
    provider: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    areaServed: "BR",
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

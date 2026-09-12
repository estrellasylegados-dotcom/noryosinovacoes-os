/**
 * Configuração central da OdontoMinas.
 *
 * Regra do projeto: nenhum componente tem WhatsApp, e-mail, endereço, CNPJ
 * ou nome do responsável técnico hardcoded espalhado pelo código — tudo
 * referencia este arquivo. Campo ainda não confirmado pela Ariadna fica
 * vazio aqui (nunca com dado inventado) e o componente que o exibiria checa
 * `isFilled()` antes de renderizar — nenhum texto de placeholder pode chegar
 * ao HTML publicado. Ver `clientes/odontominas/contexto.md` pra origem de
 * cada dado e o que ainda falta confirmar com a cliente.
 */

const rawWhatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

/** Número em formato E.164 sem símbolos. Vazio = TODO_CLIENTE: confirmar número oficial do WhatsApp. */
export const whatsappNumber = rawWhatsapp.replace(/\D/g, "");

/** true quando um campo de config foi preenchido de verdade (não vazio). Usar antes de renderizar dado opcional. */
export function isFilled(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export const siteConfig = {
  name: "OdontoMinas",
  shortName: "OdontoMinas",
  razaoSocial: "Odontominas Serviços Odontológicos Ltda.",
  cnpj: "18.268.981/0001-18",
  tagline: "Implantes e Ortodontia",
  /** Ano de constituição da empresa — usado pra calcular "anos de atuação" sem hardcode que envelhece errado. */
  anoFundacao: 2013,

  // TODO_CLIENTE: domínio ainda não registrado. `.example` é reservado (RFC 2606) —
  // sintaticamente válido pro `new URL()` do metadata não quebrar, sem parecer domínio real.
  domain: "odontominas.example",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://odontominas.example",
  // Achado público (pesquisa colada por Rafael em 11/09/2026) — confirmar com a Ariadna se segue monitorado.
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "odontominasdf@gmail.com",
  locale: "pt_BR",

  description:
    "Clínica odontológica em Brazlândia-DF, especializada em implantes e ortodontia, com avaliação individual conduzida pela Dra. Ariadna Pires da Fonseca (CRO-DF 7868).",

  cidade: "Brazlândia",
  uf: "DF",
  atendimento: "Brazlândia, Brasília-DF",

  /**
   * Endereço público encontrado. ATENÇÃO: existem registros antigos na
   * internet apontando outro lote — confirmar com a Ariadna antes deste
   * site ir ao ar de verdade. Centralizado aqui de propósito: se o endereço
   * mudar, corrige em um lugar só.
   */
  endereco: {
    logradouro: "Setor Norte, Quadra 5, Lote 17",
    bairro: "Brazlândia",
    cidade: "Brasília",
    uf: "DF",
    cep: "72705-050",
    display: "Setor Norte, Quadra 5, Lote 17 — Brazlândia, Brasília-DF — CEP 72705-050",
  },

  /** Telefone fixo público — diferente do WhatsApp (ainda não confirmado, ver whatsappNumber). */
  telefoneFixo: "(61) 3479-3574",

  horarios: [
    { dias: "Segunda a sexta", horario: "08:00 às 18:00" },
    { dias: "Sábado", horario: "08:00 às 12:00" },
    { dias: "Domingo", horario: "Fechado" },
  ],

  /** Reputação pública encontrada (Google). Atualizar aqui quando o número mudar. */
  avaliacoes: {
    nota: 4.9,
    total: 80,
    plataforma: "Google",
  },

  responsavelTecnico: {
    // TODO_CLIENTE: confirmar nome + CRO do responsável técnico registrado na
    // Odontominas Serviços Odontológicos Ltda. — pode ou não ser a própria
    // Ariadna, nunca presumir. Nunca renderizar vazio: usar isFilled().
    nome: "",
    cro: "",
  },

  social: {
    // TODO_CLIENTE: confirmar Instagram/Facebook oficiais da clínica.
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "",
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? "",
  },
} as const;

/** Anos de atuação calculado a partir da fundação — nunca hardcode "há X anos" (envelhece e erra sozinho). */
export function getAnosDeAtuacao(): number {
  return new Date().getFullYear() - siteConfig.anoFundacao;
}

/** "4,9" (vírgula, pt-BR) em vez do "4.9" que o JS renderiza por padrão — nunca interpolar `avaliacoes.nota` direto num texto visível. */
export function getNotaDisplay(): string {
  return siteConfig.avaliacoes.nota.toLocaleString("pt-BR", { minimumFractionDigits: 1 });
}

/** Link direto pro telefone fixo (tel:), com DDI. */
export function getTelLink(): string {
  const digits = siteConfig.telefoneFixo.replace(/\D/g, "");
  return `tel:+55${digits}`;
}

/**
 * Link de busca do Google Maps a partir do nome + endereço reais — não
 * depende de Place ID (ainda não confirmado). Serve pro botão "Como chegar".
 * Trocar por um link direto do perfil quando a Ariadna confirmar o Google
 * Business Profile oficial da clínica.
 */
export function getGoogleMapsSearchUrl(): string {
  const query = `${siteConfig.name} - ${siteConfig.endereco.display}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** src do iframe de mapa incorporado — sem chave de API; lazy-load fica no componente que usa isto. */
export function getGoogleMapsEmbedUrl(): string {
  const query = `${siteConfig.name}, ${siteConfig.endereco.display}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

/**
 * Mensagens pré-preenchidas do WhatsApp por origem do clique — ponto único,
 * nenhum componente monta texto de wa.me na mão. Nomeadas junto com os
 * eventos de analytics (`analyticsEvents.whatsapp`) pra manter os dois em
 * sincronia por construção, não por convenção solta.
 */
export const whatsappMessages = {
  geral: "Olá! Vi o site da OdontoMinas e gostaria de agendar uma avaliação.",
  header: "Olá! Vim pelo site da OdontoMinas e gostaria de agendar uma avaliação.",
  hero: "Olá! Vim pelo site da OdontoMinas e gostaria de agendar uma avaliação.",
  implantes: "Olá! Vi a página de implantes da OdontoMinas e gostaria de avaliar meu caso.",
  ariadna: "Olá! Conheci a Dra. Ariadna pelo site da OdontoMinas e gostaria de agendar uma avaliação.",
  servicos: "Olá! Vi os tratamentos da OdontoMinas no site e gostaria de mais informações.",
  contato: "Olá! Gostaria de falar com a OdontoMinas sobre uma consulta.",
  localizacao: "Olá! Vi a localização da OdontoMinas no site e gostaria de agendar uma avaliação.",
  footer: "Olá! Vim pelo site da OdontoMinas e gostaria de agendar uma avaliação.",
  float: "Olá! Vim pelo site da OdontoMinas e gostaria de tirar uma dúvida.",
} as const;

export type WhatsappOrigem = keyof typeof whatsappMessages;

/**
 * Gera o link de WhatsApp centralizado. Sem número confirmado (fase atual),
 * cai no mailto de contato como fallback — nunca quebra o CTA, nunca expõe
 * número de placeholder falso no HTML.
 */
export function getWhatsappLink(origem: WhatsappOrigem = "geral", messageOverride?: string): string {
  const message = messageOverride ?? whatsappMessages[origem];
  if (!whatsappNumber) {
    return `mailto:${siteConfig.email}?subject=${encodeURIComponent("Contato via site — OdontoMinas")}&body=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

/** IDs de analytics — ficam vazios até serem configurados de verdade. Nunca hardcode um ID de teste. */
export const analyticsConfig = {
  ga4Id: process.env.NEXT_PUBLIC_GA4_ID ?? "",
  gtmId: process.env.NEXT_PUBLIC_GTM_ID ?? "",
} as const;

/**
 * Nomes de evento usados em toda a aplicação, lidos via `data-analytics-event`
 * pelo `AnalyticsBinder` (um único listener delegado, sem `onClick` espalhado
 * pelos componentes de CTA — a maioria continua Server Component). Sem PII:
 * no máximo a origem do clique.
 */
export const analyticsEvents = {
  whatsapp: (origem: WhatsappOrigem) => `whatsapp_${origem}`,
  phoneClick: "phone_click",
  mapsClick: "maps_click",
} as const;

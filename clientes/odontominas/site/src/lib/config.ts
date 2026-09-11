/**
 * Configuração central da OdontoMinas.
 *
 * Regra do projeto: nenhum componente deve ter número de WhatsApp, e-mail,
 * URL, endereço ou nome do responsável técnico "hardcoded" espalhado pelo
 * código. Tudo referencia este arquivo (que por sua vez lê de variáveis de
 * ambiente quando existem).
 *
 * Vários campos abaixo ainda são `[PLACEHOLDER: ...]` de propósito — a
 * proposta ainda não foi apresentada à cliente e esses fatos (endereço,
 * telefone, nome + CRO do responsável técnico) ainda não existem em nenhum
 * lugar do sistema. Ver `clientes/odontominas/contexto.md`. Não preencher
 * com dado inventado — só com o que a Ariadna confirmar.
 */

const rawWhatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

/** Número em formato E.164 sem símbolos, ex: 5561999999999. Vazio = ainda não definido. */
export const whatsappNumber = rawWhatsapp.replace(/\D/g, "");

/** Exibição humana do número — usar em texto visível (rodapé, página de contato). */
export const whatsappDisplay = "[PLACEHOLDER: telefone/WhatsApp]";

/**
 * Mensagens pré-preenchidas do WhatsApp por origem/intenção. Ponto único —
 * nenhum componente monta texto de wa.me na mão.
 */
export const whatsappMessages = {
  geral: "Olá! Vi o site da OdontoMinas e gostaria de agendar uma avaliação.",
  servicos: "Olá! Vi os serviços da OdontoMinas no site e gostaria de mais informações.",
  contato: "Olá! Gostaria de falar com a OdontoMinas sobre uma consulta.",
} as const;

export type WhatsappPreset = keyof typeof whatsappMessages;

const defaultWhatsappMessage = whatsappMessages.geral;

/**
 * Gera o link de WhatsApp centralizado. Se o número ainda não estiver
 * configurado (fase atual), cai no mailto de contato como fallback — nunca
 * quebra o CTA, nunca expõe número de placeholder fake no HTML.
 */
export function getWhatsappLink(message: string = defaultWhatsappMessage): string {
  if (!whatsappNumber) {
    return `mailto:${siteConfig.email}?subject=${encodeURIComponent("Contato via site")}`;
  }
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const siteConfig = {
  name: "OdontoMinas",
  shortName: "OdontoMinas",
  tagline: "Implantes e Ortodontia",
  /**
   * Domínio ainda não registrado/definido — usa o TLD reservado `.example`
   * (RFC 2606), sintaticamente válido pro `new URL()` do metadata não
   * quebrar, sem parecer um domínio real registrado.
   */
  domain: "odontominas.example",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://odontominas.example",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "[PLACEHOLDER: e-mail de contato]",
  locale: "pt_BR",
  description: "[PLACEHOLDER: descrição institucional — validar tom de voz com a Ariadna]",
  atendimento: "[PLACEHOLDER: cidade/bairro de atendimento]",
  enderecoDisplay: "[PLACEHOLDER: endereço completo]",
  horarioDisplay: "[PLACEHOLDER: horário de funcionamento]",
  responsavelTecnico: {
    nome: "[PLACEHOLDER: nome completo do(s) cirurgião(ões)-dentista(s) responsável(is)]",
    cro: "[PLACEHOLDER: número de CRO]",
  },
  social: {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "",
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? "",
  },
} as const;

/** IDs de analytics — ficam vazios até serem configurados de verdade. Nunca hardcode um ID de teste. */
export const analyticsConfig = {
  ga4Id: process.env.NEXT_PUBLIC_GA4_ID ?? "",
  gtmId: process.env.NEXT_PUBLIC_GTM_ID ?? "",
} as const;

/** Nomes de evento usados em toda a aplicação. Sem PII: no máximo a origem do clique. */
export const analyticsEvents = {
  clickWhatsapp: "clique_whatsapp",
  contato: "contato",
  lead: "lead",
} as const;

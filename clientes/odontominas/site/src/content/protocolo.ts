/**
 * Protocolo Correct Full Arch — copy editorial da seção dedicada e do bloco
 * visual do hero.
 *
 * Compliance (ver clientes/odontominas/contexto.md, Resolução CFO-196/2019):
 * há evidência pública de a Dra. Ariadna usar a nomenclatura "Protocolo
 * Correct Full Arch". NUNCA equiparar tecnicamente a "All-on-4", NUNCA
 * afirmar quantidade fixa de implantes, material de prótese, protocolo
 * cirúrgico, carga imediata, tratamento no mesmo dia, ausência de enxerto ou
 * indicação universal — tudo isso depende de confirmação direta da Dra.
 * Ariadna. Usar só as formulações seguras abaixo ("reabilitação de arco
 * completo sobre implantes", "planejamento individualizado", "em casos
 * indicados"/"conforme avaliação").
 */

export const protocolo = {
  overline: "Protocolo Correct Full Arch",
  headline: "Quando o tratamento precisa devolver muito mais do que dentes.",
  subheadline:
    "O Protocolo Correct Full Arch é uma abordagem de reabilitação oral sobre implantes, pensada para devolver estabilidade, função e harmonia em casos cuidadosamente avaliados.",
  /** Texto curto usado no bloco visual do hero (ao lado da transformação). */
  heroKicker: "Reabilitação pensada para devolver segurança ao seu sorriso.",
  heroTexto:
    "Uma abordagem de reabilitação de arco completo sobre implantes, planejada individualmente para casos em que estabilidade, função e harmonia precisam ser reconstruídas em conjunto.",
  /** Liga a Dra. Ariadna ao protocolo sem alegar exclusividade ou pioneirismo não confirmados. */
  medica:
    "Planejamento conduzido por quem atua diariamente com reabilitação oral — Dra. Ariadna Pires, com atuação voltada à implantodontia e à prótese, em Brazlândia-DF.",
  disclaimer: "Simulação ilustrativa. A indicação e o planejamento variam conforme cada caso.",
  ctaPrincipal: "Quero saber se o protocolo é indicado para mim",
  ctaSecundario: "Entender minhas opções",
} as const;

export type BeneficioProtocolo = { numero: string; titulo: string; texto: string };

/** Lista editorial, não cards — linguagem sempre condicional ("pode", "em casos indicados"). */
export const beneficiosProtocolo: BeneficioProtocolo[] = [
  {
    numero: "01",
    titulo: "Planejamento individual",
    texto: "Cada caso começa pela avaliação das condições clínicas e das necessidades do paciente.",
  },
  {
    numero: "02",
    titulo: "Estabilidade",
    texto: "A reabilitação sobre implantes pode oferecer mais segurança no dia a dia, em casos indicados.",
  },
  {
    numero: "03",
    titulo: "Função",
    texto: "O planejamento considera mastigação, conforto e adaptação funcional.",
  },
  {
    numero: "04",
    titulo: "Naturalidade",
    texto: "Forma, proporção e harmonia do sorriso fazem parte do planejamento protético.",
  },
];

export type EtapaProtocolo = { numero: string; titulo: string; texto: string };

/** Jornada conceitual — sem prazo, sem número de sessões, sem carga imediata implícita. */
export const jornadaProtocolo: EtapaProtocolo[] = [
  { numero: "01", titulo: "Avaliação", texto: "Exame clínico e, quando necessário, exames de imagem complementares." },
  { numero: "02", titulo: "Planejamento", texto: "Definição individual da reabilitação, conforme a condição de cada paciente." },
  { numero: "03", titulo: "Reabilitação", texto: "Execução do plano definido, com acompanhamento da equipe em cada etapa." },
  { numero: "04", titulo: "Acompanhamento", texto: "Manutenção e revisões periódicas após a conclusão do tratamento." },
];

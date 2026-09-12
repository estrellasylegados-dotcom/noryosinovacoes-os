/**
 * Perfil da Dra. Ariadna. Dado público confirmado por Rafael (pesquisa
 * colada no chat em 11/09/2026) — ver clientes/odontominas/contexto.md.
 * Nunca usar "especialista em X" sem RQE registrado no CFO (Resolução
 * CFO-196/2019) — por isso "atuação em", nunca título que não existe.
 */
export const ariadna = {
  nomeCompleto: "Ariadna Pires da Fonseca",
  nomeExibicao: "Dra. Ariadna Pires",
  profissao: "Cirurgiã-dentista",
  cro: "CRO-DF 7868",
  areasAtuacao: ["Implantodontia", "Prótese dentária", "Cirurgias odontológicas", "Harmonização orofacial"],
  resumo:
    "Cirurgiã-dentista formada pela Universidade de Uberaba, à frente da OdontoMinas em Brazlândia-DF desde a constituição da clínica em 2013, com atuação voltada à implantodontia e à reabilitação oral.",
};

export type TimelineItem = {
  ano: string;
  titulo: string;
  descricao: string;
  /** só item confirmado chega ao HTML — ver getPublicTimeline(). */
  confirmado: boolean;
};

const timeline: TimelineItem[] = [
  {
    ano: "2001–2006",
    titulo: "Graduação em Odontologia",
    descricao: "Universidade de Uberaba (UNIUBE).",
    confirmado: true,
  },
  {
    // TODO_CLIENTE: validar a redação exata desta formação/atuação em
    // Implantodontia antes de publicar (há registro público de 2011 sobre
    // implante imediato em região estética, mas não o nome formal do curso).
    ano: "2011",
    titulo: "Atuação em Implantodontia",
    descricao: "",
    confirmado: false,
  },
  {
    ano: "2013",
    titulo: "Constituição da OdontoMinas",
    descricao: "Início da atuação formal da clínica em Brazlândia-DF.",
    confirmado: true,
  },
  {
    // TODO_CLIENTE_CONFIRMAR: mestrado em Biologia Oral (2019) — não
    // publicar este item até validação direta com a Dra. Ariadna.
    ano: "2019",
    titulo: "Mestrado em Biologia Oral",
    descricao: "",
    confirmado: false,
  },
  {
    ano: "Hoje",
    titulo: "Atuação atual",
    descricao: "Reabilitação oral, implantodontia e atendimento individualizado em Brazlândia-DF.",
    confirmado: true,
  },
];

export function getPublicTimeline(): TimelineItem[] {
  return timeline.filter((item) => item.confirmado);
}

export type EtapaJornada = { numero: string; titulo: string; texto: string };

export const jornada: EtapaJornada[] = [
  { numero: "01", titulo: "Agendamento", texto: "O primeiro contato é feito pelo WhatsApp." },
  { numero: "02", titulo: "Avaliação", texto: "A Dra. Ariadna conhece o caso e realiza a avaliação clínica." },
  { numero: "03", titulo: "Planejamento", texto: "O tratamento é planejado individualmente, conforme a indicação profissional." },
  { numero: "04", titulo: "Acompanhamento", texto: "O paciente recebe acompanhamento ao longo do tratamento indicado." },
];

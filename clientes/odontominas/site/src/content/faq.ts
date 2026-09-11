export type FaqItem = { pergunta: string; resposta: string };

/**
 * FAQ compliance-safe (Resolução CFO-196/2019): sem promessa de resultado,
 * sem superlativo, sem depoimento de paciente. Respostas com dado ainda não
 * confirmado usam `[PLACEHOLDER: ...]` — ver clientes/odontominas/contexto.md.
 */
export const faq: FaqItem[] = [
  {
    pergunta: "Onde a clínica está localizada?",
    resposta: "Em Brazlândia-DF. [PLACEHOLDER: endereço completo]",
  },
  {
    pergunta: "Como funciona a primeira consulta?",
    resposta:
      "[PLACEHOLDER: descrição do processo de avaliação inicial — confirmar com a clínica]",
  },
  {
    pergunta: "A clínica atende convênio odontológico?",
    resposta: "[PLACEHOLDER: quais convênios são aceitos, se algum]",
  },
  {
    pergunta: "Quais são os horários de atendimento?",
    resposta: "[PLACEHOLDER: horário de funcionamento]",
  },
  {
    pergunta: "Quais formas de pagamento são aceitas?",
    resposta: "[PLACEHOLDER: formas de pagamento]",
  },
];

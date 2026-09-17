/**
 * Catálogo estático de templates de Campanha (Ferramentas → Campanhas,
 * item 21 do briefing) — só pré-preenche o wizard de criação, nunca dispara
 * nada sozinho. Sem tabela, sem CRUD de admin: é dado de código, do mesmo
 * jeito que `PERIODO_CONFIG` em `relatorios.ts` é uma constante, não uma
 * tabela.
 */

import type { MetasCampanha } from "@/lib/campanhas";

export type CampanhaTemplate = {
  id: string;
  nome: string;
  descricao: string;
  objetivo: string;
  tipo: string;
  canaisSugeridos: string[];
  metasSugeridas: MetasCampanha;
};

export const CAMPANHA_TEMPLATES: CampanhaTemplate[] = [
  {
    id: "implantes",
    nome: "Campanha de Implantes",
    descricao: "Captação de novos pacientes pra avaliação de implante.",
    objetivo: "captar_pacientes",
    tipo: "implantes",
    canaisSugeridos: ["whatsapp", "meta_ads", "google_ads"],
    metasSugeridas: { leads: 30, agendamentos: 10, fechamentos: 3 },
  },
  {
    id: "ortodontia",
    nome: "Ortodontia",
    descricao: "Captação e conversão de avaliação em tratamento ortodôntico.",
    objetivo: "converter_avaliacao",
    tipo: "ortodontia",
    canaisSugeridos: ["whatsapp", "meta_ads"],
    metasSugeridas: { leads: 25, agendamentos: 12 },
  },
  {
    id: "clareamento",
    nome: "Clareamento",
    descricao: "Oferta de clareamento pra base de pacientes existente.",
    objetivo: "gerar_agendamentos",
    tipo: "clareamento",
    canaisSugeridos: ["whatsapp"],
    metasSugeridas: { leads: 20, agendamentos: 8 },
  },
  {
    id: "reativacao",
    nome: "Reativação de pacientes",
    descricao: "Retomar contato com pacientes inativos há algum tempo.",
    objetivo: "reativar_pacientes",
    tipo: "reativacao",
    canaisSugeridos: ["whatsapp"],
    metasSugeridas: { respostas: 15, agendamentos: 5 },
  },
  {
    id: "recuperacao-orcamento",
    nome: "Recuperação de orçamento",
    descricao: "Follow-up de pacientes com orçamento em aberto, sem fechamento.",
    objetivo: "recuperar_orcamento",
    tipo: "recuperacao_orcamento",
    canaisSugeridos: ["whatsapp"],
    metasSugeridas: { fechamentos: 5 },
  },
  {
    id: "retorno",
    nome: "Retorno",
    descricao: "Lembrete de retorno periódico (limpeza/revisão) pra base ativa.",
    objetivo: "gerar_retorno",
    tipo: "retorno",
    canaisSugeridos: ["whatsapp"],
    metasSugeridas: { agendamentos: 10 },
  },
  {
    id: "faltas",
    nome: "Pacientes que faltaram",
    descricao: "Reagendamento de quem faltou à consulta.",
    objetivo: "recuperar_faltas",
    tipo: "retorno",
    canaisSugeridos: ["whatsapp"],
    metasSugeridas: { agendamentos: 8 },
  },
];

export function buscarTemplate(id: string): CampanhaTemplate | null {
  return CAMPANHA_TEMPLATES.find((t) => t.id === id) ?? null;
}

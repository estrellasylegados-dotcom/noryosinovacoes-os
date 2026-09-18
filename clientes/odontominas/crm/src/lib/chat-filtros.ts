import type { Prioridade } from "@/lib/prioridade";
import type { StatusConversa } from "@/lib/status";

/**
 * Tipos e regras PURAS da caixa compartilhada (filas, filtros, ordenação). Vive
 * separado de chat.ts de propósito: o Chat ao Vivo (client component) importa
 * isto, e chat.ts puxa código de servidor (Supabase, sessão, node:crypto) que
 * nunca pode entrar no bundle do navegador.
 */

export type ConversaChat = {
  id: string;
  telefone: string;
  pacienteId: string | null;
  pacienteNome: string | null;
  status: StatusConversa;
  prioridade: Prioridade;
  naoLida: boolean;
  mensagensNaoLidas: number;
  arquivada: boolean;
  atribuidoAId: string | null;
  atribuidoANome: string | null;
  atribuidoEm: string | null;
  canalId: string | null;
  canalNome: string | null;
  finalizadaEm: string | null;
  statusOperacional: StatusOperacional;
  /** Quem responde AGORA (roteador de ownership): humano, agente_ia ou fluxo. */
  donoConversa: "humano" | "agente_ia" | "fluxo";
  ultimaMensagemEm: string | null;
  ultimaMensagemPreview: string | null;
  ultimaMensagemDirecao: "recebida" | "enviada" | null;
  etiquetas: { id: string; nome: string; cor: string }[];
  agenteAtivoId: string | null;
};

/**
 * Estado operacional da caixa compartilhada — DERIVADO, não um enum novo: o
 * `status` do funil (novo/aguardando/respondido/agendado/perdido) já cobre
 * quase tudo; só `respondido` fazia dois papéis (aguardando paciente OU
 * finalizada), e `finalizada_em` desempata. Kanban é outra coisa (estágio
 * comercial), nunca misturado aqui.
 */
export type StatusOperacional = "nova" | "aguardando_atendente" | "aguardando_paciente" | "finalizada";

export function derivarStatusOperacional(status: StatusConversa, finalizadaEm: string | null): StatusOperacional {
  if (finalizadaEm || status === "agendado" || status === "perdido") return "finalizada";
  if (status === "novo") return "nova";
  if (status === "aguardando") return "aguardando_atendente";
  return "aguardando_paciente";
}

export type MensagemChat = {
  id: string;
  direcao: "recebida" | "enviada";
  tipo: string;
  conteudo: string | null;
  quando: string;
};

export type AbaChat =
  | "todos"
  | "novos"
  | "sem_responsavel"
  | "atribuidos"
  | "aguardando_paciente"
  | "aguardando_atendente"
  | "concluidos"
  | "nao_lidas"
  | "arquivadas";

export function contarAbasChat(conversas: ConversaChat[], atendenteIdAtual: string | null) {
  const visiveis = conversas.filter((c) => !c.arquivada);
  return {
    todos: visiveis.length,
    novos: visiveis.filter((c) => c.statusOperacional === "nova").length,
    sem_responsavel: visiveis.filter((c) => c.atribuidoAId === null && c.statusOperacional !== "finalizada").length,
    aguardando_paciente: visiveis.filter((c) => c.statusOperacional === "aguardando_paciente").length,
    aguardando_atendente: visiveis.filter((c) => c.statusOperacional === "aguardando_atendente" || c.statusOperacional === "nova").length,
    nao_lidas: visiveis.filter((c) => c.naoLida).length,
    concluidos: visiveis.filter((c) => c.statusOperacional === "finalizada").length,
    atribuidos: atendenteIdAtual ? visiveis.filter((c) => c.atribuidoAId === atendenteIdAtual).length : 0,
    arquivadas: conversas.filter((c) => c.arquivada).length,
  };
}

export function filtrarConversasChat(
  conversas: ConversaChat[],
  opts: {
    aba: AbaChat;
    atendenteIdAtual: string | null;
    prioridade?: Prioridade | null;
    etiquetaId?: string | null;
    busca?: string;
    canalId?: string | null;
    /** "" = todos, "sem" = sem responsável, senão o id do atendente. */
    responsavelId?: string | null;
  }
): ConversaChat[] {
  let resultado = conversas;

  if (opts.aba === "arquivadas") {
    resultado = resultado.filter((c) => c.arquivada);
  } else {
    resultado = resultado.filter((c) => !c.arquivada);
    if (opts.aba === "nao_lidas") resultado = resultado.filter((c) => c.naoLida);
    else if (opts.aba === "concluidos") resultado = resultado.filter((c) => c.statusOperacional === "finalizada");
    else if (opts.aba === "novos") resultado = resultado.filter((c) => c.statusOperacional === "nova");
    else if (opts.aba === "sem_responsavel") resultado = resultado.filter((c) => c.atribuidoAId === null && c.statusOperacional !== "finalizada");
    else if (opts.aba === "aguardando_paciente") resultado = resultado.filter((c) => c.statusOperacional === "aguardando_paciente");
    else if (opts.aba === "aguardando_atendente") {
      resultado = resultado.filter((c) => c.statusOperacional === "aguardando_atendente" || c.statusOperacional === "nova");
    }
    else if (opts.aba === "atribuidos") {
      resultado = resultado.filter((c) => c.atribuidoAId !== null && c.atribuidoAId === opts.atendenteIdAtual);
    }
  }

  if (opts.canalId) resultado = resultado.filter((c) => c.canalId === opts.canalId);
  if (opts.responsavelId === "sem") resultado = resultado.filter((c) => c.atribuidoAId === null);
  else if (opts.responsavelId) resultado = resultado.filter((c) => c.atribuidoAId === opts.responsavelId);
  if (opts.prioridade) resultado = resultado.filter((c) => c.prioridade === opts.prioridade);
  if (opts.etiquetaId) resultado = resultado.filter((c) => c.etiquetas.some((e) => e.id === opts.etiquetaId));

  const busca = opts.busca?.trim().toLowerCase();
  if (busca && busca.length >= 3) {
    const buscaDigitos = busca.replace(/\D/g, "");
    resultado = resultado.filter((c) => {
      const bateNome = c.pacienteNome?.toLowerCase().includes(busca) ?? false;
      const bateTelefone = buscaDigitos.length > 0 && c.telefone.includes(buscaDigitos);
      return bateNome || bateTelefone;
    });
  }

  return resultado;
}

export type OrdemChat = "recentes" | "antigos" | "sem_responsavel";

/** Ordenação pura (SLA crítico depende do SLA ao vivo por conversa e continua no componente). */
export function ordenarConversasChat(conversas: ConversaChat[], ordem: OrdemChat): ConversaChat[] {
  const t = (c: ConversaChat) => new Date(c.ultimaMensagemEm ?? 0).getTime();
  const copia = [...conversas];
  if (ordem === "antigos") return copia.sort((a, b) => t(a) - t(b));
  if (ordem === "sem_responsavel") {
    return copia.sort((a, b) => Number(a.atribuidoAId !== null) - Number(b.atribuidoAId !== null) || t(b) - t(a));
  }
  return copia.sort((a, b) => t(b) - t(a));
}


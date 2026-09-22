import type { Permissao } from "@/lib/permissoes";

/**
 * Central de Alertas Operacionais — núcleo PURO (sem I/O), testado direto.
 *
 * ALERTA NÃO É LOG: representa uma condição que exige ação humana. Cada tipo
 * declara aqui, num só lugar, o que ele é (categoria, natureza), quem enxerga
 * (permissão que JÁ existe no catálogo — nada de mapa de audiência paralelo)
 * e se o verificador pode resolvê-lo sozinho. Tipo novo = uma linha aqui +
 * um detector; sem migration (categoria/tipo são texto livre no banco).
 */

export const SEVERIDADES = ["informativo", "atencao", "critico"] as const;
export type Severidade = (typeof SEVERIDADES)[number];

export const STATUS_ALERTA = ["aberto", "assumido", "resolvido", "ignorado"] as const;
export type StatusAlerta = (typeof STATUS_ALERTA)[number];

/** Status em que o alerta ainda exige atenção (conta no cabeçalho e aparece na fila). */
export const STATUS_ATIVOS: readonly StatusAlerta[] = ["aberto", "assumido"];
export const STATUS_ENCERRADOS: readonly StatusAlerta[] = ["resolvido", "ignorado"];

/** Operacional = atendimento da clínica. Técnico = funcionamento da plataforma (base do futuro Noryos Ops). */
export type Natureza = "operacional" | "tecnico";

export const CATEGORIAS = ["SLA", "CONVERSA", "KANBAN", "CANAL", "MENSAGEM", "FLUXO", "REPUTACAO", "INTEGRACAO", "SISTEMA"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const CATEGORIA_ROTULO: Record<Categoria, string> = {
  SLA: "SLA",
  CONVERSA: "Conversa",
  KANBAN: "Kanban",
  CANAL: "Canal",
  MENSAGEM: "Mensagem",
  FLUXO: "Fluxo",
  REPUTACAO: "Reputação",
  INTEGRACAO: "Integração",
  SISTEMA: "Sistema",
};

export const SEVERIDADE_ROTULO: Record<Severidade, string> = { informativo: "Informativo", atencao: "Atenção", critico: "Crítico" };
export const STATUS_ROTULO: Record<StatusAlerta, string> = { aberto: "Aberto", assumido: "Assumido", resolvido: "Resolvido", ignorado: "Ignorado" };

const RANK: Record<Severidade, number> = { informativo: 0, atencao: 1, critico: 2 };

export function rankSeveridade(s: Severidade): number {
  return RANK[s];
}

export function isSeveridade(v: unknown): v is Severidade {
  return typeof v === "string" && (SEVERIDADES as readonly string[]).includes(v);
}

export function isStatusAlerta(v: unknown): v is StatusAlerta {
  return typeof v === "string" && (STATUS_ALERTA as readonly string[]).includes(v);
}

/** Alerta "relevante" (cabeçalho, sino): atenção ou crítico. Informativo só aparece na central. */
export function severidadeRelevante(s: Severidade): boolean {
  return s !== "informativo";
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TipoEntidade = "conversa" | "oportunidade" | "canal" | "fluxo_execucao" | "disparo" | "clinica";

export type DefinicaoTipo = {
  categoria: Categoria;
  natureza: Natureza;
  /** Permissão JÁ existente que dá acesso a este tipo (alertas técnicos usam `alertas.tecnicos`). */
  permissaoLeitura: Permissao;
  /** true = o alerta pertence a uma pessoa: quem só vê "o que é seu" enxerga os próprios + os sem dono (fila). */
  porResponsavel: boolean;
  /** true = o verificador resolve sozinho quando a condição termina. false = fato pontual (só a pessoa encerra). */
  autoResolve: boolean;
  tipoEntidade: TipoEntidade;
  /** Nome curto pra configuração ("Alertar quando…"). */
  rotulo: string;
  descricaoConfig: string;
};

export const TIPOS_ALERTA = {
  acompanhamento_comercial: {
    categoria: "KANBAN", natureza: "operacional", permissaoLeitura: "kanban.visualizar", porResponsavel: true,
    autoResolve: false, tipoEntidade: "oportunidade", rotulo: "Acompanhamento comercial solicitado",
    descricaoConfig: "Uma automação solicitou atenção a uma oportunidade.",
  },
  sla_limite: {
    categoria: "SLA",
    natureza: "operacional",
    permissaoLeitura: "conversas.visualizar_proprias",
    porResponsavel: true,
    autoResolve: true,
    tipoEntidade: "conversa",
    rotulo: "SLA próximo do limite ou estourado",
    descricaoConfig: "Usa os limites e a faixa de atenção da tela SLA / Atendimento.",
  },
  conversa_sem_responsavel: {
    categoria: "CONVERSA",
    natureza: "operacional",
    permissaoLeitura: "conversas.visualizar_proprias",
    porResponsavel: true,
    autoResolve: true,
    tipoEntidade: "conversa",
    rotulo: "Conversa sem responsável",
    descricaoConfig: "Paciente esperando e ninguém assumiu a conversa.",
  },
  oportunidade_parada: {
    categoria: "KANBAN",
    natureza: "operacional",
    permissaoLeitura: "kanban.visualizar",
    porResponsavel: true,
    autoResolve: true,
    tipoEntidade: "oportunidade",
    rotulo: "Oportunidade parada numa etapa",
    descricaoConfig: "Tempo máximo por etapa do Kanban (definido abaixo).",
  },
  canal_desconectado: {
    categoria: "CANAL",
    natureza: "operacional",
    permissaoLeitura: "canais.visualizar",
    porResponsavel: false,
    autoResolve: true,
    tipoEntidade: "canal",
    rotulo: "Canal desconectado ou com erro",
    descricaoConfig: "WhatsApp fora do ar ou sem resposta do provedor.",
  },
  mensagem_falha_definitiva: {
    categoria: "MENSAGEM",
    natureza: "operacional",
    permissaoLeitura: "automacoes.visualizar",
    porResponsavel: false,
    autoResolve: false,
    tipoEntidade: "conversa",
    rotulo: "Mensagem automática não entregue",
    descricaoConfig: "Só depois de esgotar as tentativas de envio.",
  },
  disparo_falhas: {
    categoria: "MENSAGEM",
    natureza: "operacional",
    permissaoLeitura: "automacoes.visualizar",
    porResponsavel: false,
    autoResolve: false,
    tipoEntidade: "disparo",
    rotulo: "Disparo concluído com falhas",
    descricaoConfig: "Falhas do próprio envio; queda de canal já tem alerta próprio.",
  },
  fluxo_falhou: {
    categoria: "FLUXO",
    natureza: "operacional",
    permissaoLeitura: "automacoes.visualizar",
    porResponsavel: false,
    autoResolve: false,
    tipoEntidade: "fluxo_execucao",
    rotulo: "Fluxo de conversa falhou",
    descricaoConfig: "Execução terminou em erro — o paciente pode não ter sido atendido.",
  },
  automacao_indisponivel: {
    categoria: "FLUXO",
    natureza: "operacional",
    permissaoLeitura: "automacoes.visualizar",
    porResponsavel: false,
    autoResolve: true,
    tipoEntidade: "clinica",
    rotulo: "Automações temporariamente indisponíveis",
    descricaoConfig: "Aviso em linguagem simples quando um problema técnico afeta as automações (sem expor detalhes internos).",
  },
  experiencia_insatisfatoria: {
    categoria: "REPUTACAO", natureza: "operacional", permissaoLeitura: "alertas.visualizar", porResponsavel: true,
    autoResolve: false, tipoEntidade: "conversa", rotulo: "Experiência do paciente precisa de atenção",
    descricaoConfig: "Paciente informou que a experiência poderia melhorar.",
  },
  fluxo_preso: {
    categoria: "FLUXO",
    natureza: "tecnico",
    permissaoLeitura: "alertas.tecnicos",
    porResponsavel: false,
    autoResolve: true,
    tipoEntidade: "fluxo_execucao",
    rotulo: "Execução de fluxo travada (técnico)",
    descricaoConfig: "Execução parada sem o motor processar. Visível só ao suporte.",
  },
} as const satisfies Record<string, DefinicaoTipo>;

export type TipoAlerta = keyof typeof TIPOS_ALERTA;
export const TODOS_OS_TIPOS = Object.keys(TIPOS_ALERTA) as TipoAlerta[];

export function isTipoAlerta(v: unknown): v is TipoAlerta {
  return typeof v === "string" && v in TIPOS_ALERTA;
}

export function definicaoDoTipo(tipo: string): DefinicaoTipo | null {
  return isTipoAlerta(tipo) ? TIPOS_ALERTA[tipo] : null;
}

// ---------------------------------------------------------------------------
// Chaves de deduplicação — 1 condição = 1 alerta ativo
// ---------------------------------------------------------------------------

export const chaves = {
  /** conversa + ciclo (mensagem que abriu a espera): resposta e nova pergunta = nova ocorrência. */
  sla: (conversaId: string, cicloMensagemId: string) => `sla:${conversaId}:${cicloMensagemId}`,
  semResponsavel: (conversaId: string, cicloMensagemId: string) => `sem_resp:${conversaId}:${cicloMensagemId}`,
  /** oportunidade + etapa + regra: sair da etapa resolve; voltar depois é ocorrência nova. */
  oportunidadeParada: (oportunidadeId: string, estagioId: string, regraId: string) => `kanban_parada:${oportunidadeId}:${estagioId}:${regraId}`,
  canal: (canalId: string) => `canal:${canalId}`,
  mensagemFalha: (origem: string, referencia: string) => `msg_falha:${origem}:${referencia}`,
  disparo: (disparoId: string) => `disparo_falhas:${disparoId}`,
  fluxoFalhou: (execucaoId: string) => `fluxo_falhou:${execucaoId}`,
  fluxoPreso: (execucaoId: string) => `fluxo_preso:${execucaoId}`,
  automacaoIndisponivel: (clinicaId: string) => `automacao_indisponivel:${clinicaId}`,
  experienciaInsatisfatoria: (recuperacaoId: string) => `experiencia:${recuperacaoId}`,
};

// ---------------------------------------------------------------------------
// Condição (o que os detectores produzem) e transições
// ---------------------------------------------------------------------------

export type Condicao = {
  tipo: TipoAlerta;
  chave: string;
  severidade: Severidade;
  titulo: string;
  descricao?: string;
  tipoEntidade: TipoEntidade;
  entidadeId: string;
  responsavelId: string | null;
  /** Só fatos estruturais (limites, ids, minutos). Nada de texto de mensagem nem dado pessoal desnecessário. */
  dados?: Record<string, unknown>;
};

export type AcaoAlerta = "assumir" | "resolver" | "ignorar";

/** Estados de origem permitidos por ação. aberto→assumido→resolvido, aberto→resolvido, aberto|assumido→ignorado. */
const ORIGENS: Record<AcaoAlerta, readonly StatusAlerta[]> = {
  assumir: ["aberto"],
  resolver: ["aberto", "assumido"],
  ignorar: ["aberto", "assumido"],
};

const DESTINO: Record<AcaoAlerta, StatusAlerta> = { assumir: "assumido", resolver: "resolvido", ignorar: "ignorado" };

export function origensValidas(acao: AcaoAlerta): readonly StatusAlerta[] {
  return ORIGENS[acao];
}

export function statusDestino(acao: AcaoAlerta): StatusAlerta {
  return DESTINO[acao];
}

export function transicaoValida(status: StatusAlerta, acao: AcaoAlerta): boolean {
  return ORIGENS[acao].includes(status);
}

export const PERMISSAO_DA_ACAO: Record<AcaoAlerta, Permissao> = {
  assumir: "alertas.assumir",
  resolver: "alertas.resolver",
  ignorar: "alertas.ignorar",
};

// ---------------------------------------------------------------------------
// Visibilidade — mesma regra no SQL da listagem e na checagem de cada ação
// ---------------------------------------------------------------------------

export type AtorAlerta = { atendenteId: string; permissoes: ReadonlySet<Permissao> };
export type AlertaMinimo = { tipo: string; responsavelId: string | null; status?: StatusAlerta; assumidoPor?: string | null };

/** Visão de equipe: quem enxerga todas as conversas enxerga os alertas de todos. Os demais, só os próprios + a fila sem dono. */
export function escopoEquipe(ator: AtorAlerta): boolean {
  return ator.permissoes.has("conversas.visualizar_todas");
}

export function podeVerTipo(ator: AtorAlerta, tipo: string): boolean {
  const def = definicaoDoTipo(tipo);
  if (!def) return false;
  if (!ator.permissoes.has("alertas.visualizar")) return false;
  return ator.permissoes.has(def.permissaoLeitura);
}

export function tiposVisiveis(ator: AtorAlerta): TipoAlerta[] {
  return TODOS_OS_TIPOS.filter((t) => podeVerTipo(ator, t));
}

export function podeVerAlerta(ator: AtorAlerta, alerta: AlertaMinimo): boolean {
  if (!podeVerTipo(ator, alerta.tipo)) return false;
  const def = definicaoDoTipo(alerta.tipo);
  if (!def?.porResponsavel || escopoEquipe(ator)) return true;
  return alerta.responsavelId === null || alerta.responsavelId === ator.atendenteId;
}

export type NegacaoAcao = "forbidden" | "not_found";

/**
 * `not_found` quando a pessoa nem deveria saber que o alerta existe (outra
 * clínica, outro escopo); `forbidden` quando vê mas não pode agir.
 */
export function avaliarAcaoHumana(ator: AtorAlerta, alerta: AlertaMinimo, acao: AcaoAlerta): { ok: true } | { ok: false; error: NegacaoAcao } {
  if (!podeVerAlerta(ator, alerta)) return { ok: false, error: "not_found" };
  if (!ator.permissoes.has(PERMISSAO_DA_ACAO[acao])) return { ok: false, error: "forbidden" };
  // Alerta assumido por outra pessoa: quem só vê "o seu" não passa por cima (supervisão passa).
  if (alerta.status === "assumido" && alerta.assumidoPor && alerta.assumidoPor !== ator.atendenteId && !escopoEquipe(ator)) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Destino do clique (ação direta)
// ---------------------------------------------------------------------------

export type DestinoAlerta = { href: string; rotulo: string };

export function destinoDoAlerta(alerta: { tipoEntidade: string | null; entidadeId: string | null; dados: Record<string, unknown> }): DestinoAlerta | null {
  const id = alerta.entidadeId;
  if (!id) return null;
  switch (alerta.tipoEntidade) {
    case "conversa":
      return { href: `/chat?conversa=${id}`, rotulo: "Abrir conversa" };
    case "oportunidade":
      return { href: `/kanban?card=${id}`, rotulo: "Abrir no Kanban" };
    case "canal":
      return { href: `/configuracoes/canais?canal=${id}`, rotulo: "Abrir canal" };
    case "fluxo_execucao": {
      const fluxoId = typeof alerta.dados.fluxoId === "string" ? alerta.dados.fluxoId : null;
      return fluxoId ? { href: `/fluxos/${fluxoId}/editar`, rotulo: "Abrir fluxo" } : { href: "/fluxos", rotulo: "Abrir fluxos" };
    }
    case "disparo":
      return { href: `/disparos/${id}`, rotulo: "Abrir disparo" };
    case "clinica":
      return { href: "/fluxos", rotulo: "Ver automações" };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Configuração — validação pura
// ---------------------------------------------------------------------------

export const LIMITES_CONFIG = {
  semResponsavelMinutos: { min: 1, max: 1440 },
  canalCarenciaMinutos: { min: 0, max: 60 },
  kanbanLimiteMinutos: { min: 1, max: 60 * 24 * 90 },
} as const;

export function inteiroEntre(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

// ---------------------------------------------------------------------------
// Texto de "o que resolveu" (interface em português; o banco guarda o identificador técnico)
// ---------------------------------------------------------------------------

const ROTULO_RESOLUCAO: Record<string, string> = {
  manual: "resolvido manualmente",
  resposta_humana: "a equipe respondeu o paciente",
  conversa_assumida: "alguém assumiu a conversa",
  conversa_transferida: "a conversa foi transferida",
  oportunidade_movida: "a oportunidade mudou de etapa",
  canal_recuperado: "o canal voltou a funcionar",
  canal_pausado: "o canal foi pausado",
  condicao_encerrada: "a situação deixou de existir",
  execucao_retomada: "a execução voltou a andar",
  tipo_desabilitado: "este tipo de alerta foi desligado",
};

export function rotuloResolucao(evento: string | null): string {
  if (!evento) return "encerrado";
  return ROTULO_RESOLUCAO[evento] ?? "encerrado";
}

export const ROTULO_HISTORICO: Record<string, string> = {
  criado: "Alerta criado",
  severidade_alterada: "Severidade alterada",
  responsavel_alterado: "Responsável alterado",
  assumido: "Assumido",
  resolvido: "Resolvido",
  ignorado: "Ignorado",
  reaberto: "Reaberto",
};

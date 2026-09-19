/**
 * Catálogo de permissões e defaults por perfil (ver docs/RBAC.md e
 * decisoes.md 2026-09-18). Fonte única de verdade — nenhum outro arquivo
 * deve hardcodar `perfil === "..."` pra decidir o que alguém pode fazer;
 * isso é exatamente o que esta fase substitui (18 pontos de `papel ===
 * "admin"` espalhados, achados na auditoria antes desta fase).
 *
 * Catálogo em código, não em tabela: dá pra auditar/testar sem JOIN, e a
 * escala atual (1 clínica, poucas contas) não justifica uma tabela
 * relacional pra algo que muda por deploy, não por usuário. Customização
 * por pessoa (Dona ajustando permissões de alguém) mora em
 * `atendentes.permissoes_customizadas` — ver resolverPermissoes().
 */

export const PERMISSOES = [
  // usuários
  "usuarios.visualizar",
  "usuarios.criar",
  "usuarios.editar",
  "usuarios.desativar",
  "usuarios.reativar",
  "usuarios.aprovar",
  "usuarios.gerenciar_permissoes",
  "usuarios.resetar_acesso",
  // atendimento
  "conversas.visualizar_proprias",
  "conversas.visualizar_todas",
  "conversas.assumir",
  "conversas.transferir",
  "conversas.intervir",
  "conversas.finalizar",
  "conversas.reabrir",
  "conversas.notas_internas",
  // crm
  "pacientes.visualizar",
  "pacientes.editar",
  "kanban.visualizar",
  "kanban.mover",
  "kanban.configurar",
  // sla
  "sla.visualizar",
  "sla.visualizar_equipe",
  "sla.configurar",
  // alertas operacionais (`alertas.tecnicos` = ver/operar alertas de natureza técnica)
  "alertas.visualizar",
  "alertas.assumir",
  "alertas.resolver",
  "alertas.ignorar",
  "alertas.configurar",
  "alertas.tecnicos",
  // relatórios
  "relatorios.visualizar",
  "relatorios.exportar",
  // automações
  "automacoes.visualizar",
  "automacoes.criar",
  "automacoes.editar",
  "automacoes.excluir",
  // canais
  "canais.visualizar",
  "canais.configurar",
  "canais.conectar",
  "canais.desconectar",
  // configurações
  "configuracoes.clinica",
  "configuracoes.reputacao",
  "configuracoes.integracoes",
  "configuracoes.horario",
  // suporte (identidade de plataforma)
  "suporte.visualizar_logs",
  "suporte.acesso_tecnico",
  "suporte.resetar_usuario",
  "suporte.sessao_temporaria",
  // administração Noryos (identidade de plataforma)
  "platform.clinicas",
  "platform.suporte",
  "platform.feature_flags",
  "platform.ops",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

export function isPermissaoValida(v: string): v is Permissao {
  return (PERMISSOES as readonly string[]).includes(v);
}

/** `dona`/`gerente`/`supervisora`/`atendente` são escopo de clínica; `noryos_admin`/`noryos_suporte` são escopo de plataforma (clinica_id pode ser null). */
export const PERFIS = ["noryos_admin", "noryos_suporte", "dona", "gerente", "supervisora", "atendente"] as const;

export type Perfil = (typeof PERFIS)[number];

export function isPerfilValido(v: string): v is Perfil {
  return (PERFIS as readonly string[]).includes(v);
}

export const PERFIS_PLATAFORMA: ReadonlySet<Perfil> = new Set(["noryos_admin", "noryos_suporte"]);
export const PERFIS_CLINICA: ReadonlySet<Perfil> = new Set(["dona", "gerente", "supervisora", "atendente"]);

function set(...permissoes: Permissao[]): ReadonlySet<Permissao> {
  return new Set(permissoes);
}

const TODAS_PERMISSOES = set(...PERMISSOES);

/**
 * Defaults seguros por perfil (seções 6-11 do pedido original). Dona e
 * Noryos Admin podem customizar por pessoa — ver resolverPermissoes().
 */
export const PERFIS_PADRAO: Record<Perfil, ReadonlySet<Permissao>> = {
  // Identidade de plataforma: administra a Noryos, não "é admin da clínica".
  noryos_admin: TODAS_PERMISSOES,

  // Identidade de plataforma, escopo deliberadamente menor que a Dona —
  // nunca ganha usuarios.criar/editar/gerenciar_permissoes por padrão.
  noryos_suporte: set(
    "usuarios.visualizar",
    "usuarios.resetar_acesso",
    "suporte.visualizar_logs",
    "suporte.acesso_tecnico",
    "suporte.resetar_usuario",
    "suporte.sessao_temporaria",
    "canais.visualizar",
    "alertas.visualizar",
    "alertas.assumir",
    "alertas.resolver",
    "alertas.tecnicos",
    "platform.suporte"
  ),

  // Controle completo da própria clínica — nunca platform.*/suporte.*.
  dona: set(
    "usuarios.visualizar",
    "usuarios.criar",
    "usuarios.editar",
    "usuarios.desativar",
    "usuarios.reativar",
    "usuarios.aprovar",
    "usuarios.gerenciar_permissoes",
    "usuarios.resetar_acesso",
    "conversas.visualizar_proprias",
    "conversas.visualizar_todas",
    "conversas.assumir",
    "conversas.transferir",
    "conversas.intervir",
    "conversas.finalizar",
    "conversas.reabrir",
    "conversas.notas_internas",
    "pacientes.visualizar",
    "pacientes.editar",
    "kanban.visualizar",
    "kanban.mover",
    "kanban.configurar",
    "sla.visualizar",
    "sla.visualizar_equipe",
    "sla.configurar",
    "alertas.visualizar",
    "alertas.assumir",
    "alertas.resolver",
    "alertas.ignorar",
    "alertas.configurar",
    "relatorios.visualizar",
    "relatorios.exportar",
    "automacoes.visualizar",
    "automacoes.criar",
    "automacoes.editar",
    "automacoes.excluir",
    "canais.visualizar",
    "canais.configurar",
    "canais.conectar",
    "canais.desconectar",
    "configuracoes.clinica",
    "configuracoes.reputacao",
    "configuracoes.integracoes",
    "configuracoes.horario"
  ),

  // Operacional gerencial — sem gerenciar permissões nem config técnica por padrão.
  gerente: set(
    "usuarios.visualizar",
    "conversas.visualizar_proprias",
    "conversas.visualizar_todas",
    "conversas.assumir",
    "conversas.transferir",
    "conversas.intervir",
    "conversas.finalizar",
    "conversas.reabrir",
    "conversas.notas_internas",
    "pacientes.visualizar",
    "pacientes.editar",
    "kanban.visualizar",
    "kanban.mover",
    "sla.visualizar",
    "sla.visualizar_equipe",
    "alertas.visualizar",
    "alertas.assumir",
    "alertas.resolver",
    "alertas.ignorar",
    "canais.visualizar",
    "relatorios.visualizar",
    "relatorios.exportar"
  ),

  // Foco em operação/equipe — sem gerenciar usuários nem configurações.
  supervisora: set(
    "conversas.visualizar_proprias",
    "conversas.visualizar_todas",
    "conversas.assumir",
    "conversas.transferir",
    "conversas.intervir",
    "conversas.notas_internas",
    "pacientes.visualizar",
    "kanban.visualizar",
    "sla.visualizar_equipe",
    "alertas.visualizar",
    "alertas.assumir",
    "alertas.resolver",
    "canais.visualizar",
    "relatorios.visualizar"
  ),

  // Acesso mínimo operacional.
  atendente: set(
    "conversas.visualizar_proprias",
    "conversas.assumir",
    "conversas.transferir",
    "conversas.notas_internas",
    "pacientes.visualizar",
    "kanban.visualizar",
    "kanban.mover",
    "sla.visualizar",
    "alertas.visualizar",
    "alertas.assumir",
    "alertas.resolver"
  ),
};

/**
 * null = usa o default do perfil; array (mesmo vazio) = customização
 * explícita que substitui o default por inteiro. Distinguir null de "[]" é
 * o que permite zerar as permissões de alguém sem cair de volta no default.
 */
export function resolverPermissoes(perfil: Perfil, customizadas: readonly string[] | null): ReadonlySet<Permissao> {
  if (customizadas !== null) {
    return new Set(customizadas.filter(isPermissaoValida));
  }
  return PERFIS_PADRAO[perfil];
}

/**
 * Regra de elevação (seção 40/41 do pedido): ninguém atribui um perfil mais
 * poderoso que o próprio escopo. Noryos Admin é o único que cria outra
 * identidade de plataforma; Dona nunca cria Dona nem perfil de plataforma.
 */
const PERFIS_QUE_PODE_ATRIBUIR: Record<Perfil, ReadonlyArray<Perfil>> = {
  noryos_admin: PERFIS,
  noryos_suporte: [],
  dona: ["gerente", "supervisora", "atendente"],
  gerente: [],
  supervisora: [],
  atendente: [],
};

export function podeAtribuirPerfil(atorPerfil: Perfil, perfilAlvo: Perfil): boolean {
  return PERFIS_QUE_PODE_ATRIBUIR[atorPerfil].includes(perfilAlvo);
}

/**
 * Quem pode redefinir a credencial (senha) de quem. Separado de
 * `podeAtribuirPerfil` de propósito: Suporte não atribui perfil a ninguém,
 * mas precisa resetar acesso de perfis operacionais — nunca o da Dona nem
 * de outra identidade de plataforma (senão "redefinir senha" vira tomada
 * de conta). Ninguém redefine a própria senha por esta via.
 */
const PERFIS_CUJA_CREDENCIAL_PODE_REDEFINIR: Record<Perfil, ReadonlyArray<Perfil>> = {
  noryos_admin: PERFIS,
  noryos_suporte: ["gerente", "supervisora", "atendente"],
  dona: ["gerente", "supervisora", "atendente"],
  gerente: [],
  supervisora: [],
  atendente: [],
};

export function podeRedefinirCredencial(atorPerfil: Perfil, perfilAlvo: Perfil): boolean {
  return PERFIS_CUJA_CREDENCIAL_PODE_REDEFINIR[atorPerfil].includes(perfilAlvo);
}

/** Permissões de identidade de plataforma — nunca atribuíveis a perfil de clínica, nem por Noryos Admin. */
export function isPermissaoDePlataforma(p: Permissao): boolean {
  return p.startsWith("platform.") || p.startsWith("suporte.");
}

export type ResultadoConcessao = { ok: true } | { ok: false; error: "perfil_nao_permitido" | "permissao_acima_do_escopo" | "permissao_de_plataforma_em_perfil_de_clinica" };

/**
 * Validação de "quem pode conceder o quê" pra `permissoes_customizadas`.
 * Três travas, todas no backend: (1) o ator precisa poder administrar o perfil
 * do alvo (mesma hierarquia de `podeAtribuirPerfil`: Dona nunca mexe em Dona
 * nem em plataforma); (2) só concede o que ele mesmo tem (ninguém dá mais
 * poder que o próprio); (3) permissão de plataforma só em perfil de
 * plataforma. `permissoes = null` (voltar ao default do perfil) só passa por (1).
 */
export function validarConcessaoPermissoes(
  atorPerfil: Perfil,
  atorPermissoes: ReadonlySet<Permissao>,
  alvoPerfil: Perfil,
  permissoes: readonly Permissao[] | null
): ResultadoConcessao {
  if (!podeAtribuirPerfil(atorPerfil, alvoPerfil)) return { ok: false, error: "perfil_nao_permitido" };
  if (permissoes === null) return { ok: true };
  if (!permissoes.every((p) => atorPermissoes.has(p))) return { ok: false, error: "permissao_acima_do_escopo" };
  if (!PERFIS_PLATAFORMA.has(alvoPerfil) && permissoes.some(isPermissaoDePlataforma)) {
    return { ok: false, error: "permissao_de_plataforma_em_perfil_de_clinica" };
  }
  return { ok: true };
}

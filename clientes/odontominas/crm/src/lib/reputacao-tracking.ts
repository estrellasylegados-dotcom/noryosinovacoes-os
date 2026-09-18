import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Fase 5 — token opaco de clique (mesma ideia de aleatoriedade de
 * src/lib/senha.ts, mas sem hash: não é segredo de autenticação, é um link
 * de rastreio de clique como qualquer link de e-mail/unsubscribe — guardar
 * em texto puro com índice único é o suficiente). 256 bits, sem estrutura
 * decodificável: não dá pra derivar paciente/clínica/pesquisa a partir dele.
 *
 * Web Crypto (`crypto.getRandomValues`), não `node:crypto` — este arquivo é
 * importado por fluxo-execucoes.ts, que `chat.ts` também importa, e `chat.ts`
 * é alcançado a partir de um Client Component (ChatAoVivo.tsx); um import
 * `node:` nesse caminho quebra o bundle do webpack pro cliente
 * (`UnhandledSchemeError`). Web Crypto é global em Node e no browser.
 */
const VALIDADE_TOKEN_DIAS = 90;

export function gerarTrackingToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function calcularExpiracaoToken(agora: Date = new Date()): string {
  return new Date(agora.getTime() + VALIDADE_TOKEN_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Base pública do painel — sem ela não dá pra montar link rastreável (sem
 * isso configurado, `criar_pesquisa` cai pro link direto do Google, nunca
 * quebra o envio). Nunca aceitar essa base vinda de request/header: é
 * sempre configuração do servidor, senão vira vetor de host header injection.
 */
function baseUrlApp(): string | null {
  const url = process.env.APP_URL;
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

export function montarUrlRastreavel(token: string): string | null {
  const base = baseUrlApp();
  if (!base) return null;
  return `${base}/api/r/review/${token}`;
}

export type PesquisaTokenLookup = {
  pesquisaId: string;
  clinicaId: string;
  status: string;
  clicadoEm: string | null;
  tokenExpiraEm: string | null;
  googleReviewUrl: string | null;
};

/**
 * Busca em 2 passos (sem embed/RPC — mesmo estilo do resto do projeto):
 * pesquisa pelo token, depois a URL oficial vigente da clínica dona dela.
 * O destino do redirect nunca é o que ficou congelado em `metadata` na
 * hora do envio — é sempre a config ATUAL, pra trocar o link no admin
 * valer pra tokens já mandados sem reenviar nada.
 */
export async function buscarPesquisaPorToken(token: string): Promise<PesquisaTokenLookup | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data: pesquisa } = await supabase
    .from("pesquisas")
    .select("id, clinica_id, status, clicado_em, tracking_token_expira_em")
    .eq("tracking_token", token)
    .eq("tipo", "avaliacao_google")
    .maybeSingle();
  if (!pesquisa) return null;

  const { data: config } = await supabase
    .from("reputacao_config")
    .select("google_review_url")
    .eq("clinica_id", pesquisa.clinica_id as string)
    .maybeSingle();

  return {
    pesquisaId: pesquisa.id as string,
    clinicaId: pesquisa.clinica_id as string,
    status: pesquisa.status as string,
    clicadoEm: (pesquisa.clicado_em as string | null) ?? null,
    tokenExpiraEm: (pesquisa.tracking_token_expira_em as string | null) ?? null,
    googleReviewUrl: (config?.google_review_url as string | null) ?? null,
  };
}

export function tokenExpirado(lookup: PesquisaTokenLookup, agora: Date = new Date()): boolean {
  if (!lookup.tokenExpiraEm) return false;
  return new Date(lookup.tokenExpiraEm).getTime() < agora.getTime();
}

/** 1º clique grava `clicado_em`/`status='clicada'`; cliques seguintes são no-op (nunca duplica registro). */
export async function registrarCliqueSeNovo(pesquisaId: string, jaClicado: boolean): Promise<void> {
  if (jaClicado) return;
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("pesquisas")
    .update({ status: "clicada", clicado_em: agora, updated_at: agora })
    .eq("id", pesquisaId)
    .is("clicado_em", null);
  if (error) {
    console.error("[reputacao-tracking] registrar_clique_failed", JSON.stringify({ pesquisaId, code: error.code ?? null }));
  }
}

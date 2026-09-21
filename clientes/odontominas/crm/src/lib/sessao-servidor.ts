import { cookies } from "next/headers";
import { lerTokenSessao, NOME_COOKIE_SESSAO } from "@/lib/sessao";
import { buscarAtendenteCompletoPorId } from "@/lib/atendentes";
import { resolverPermissoes, type Perfil, type Permissao } from "@/lib/permissoes";

export type SessaoAtual = {
  atendenteId: string;
  nome: string;
  usuario: string;
  email: string | null;
  perfil: Perfil;
  clinicaId: string | null;
  permissoes: ReadonlySet<Permissao>;
};

/**
 * Autoridade real da sessão (ver src/lib/sessao.ts) — sempre lê o banco;
 * perfil/status/permissões nunca vêm só do cookie, pra bloqueio e mudança
 * de permissão surtirem efeito imediato sem esperar o token expirar. Só
 * usar em Server Component / Route Handler — next/headers não roda em
 * Middleware (esse gate mais grosso fica em src/middleware.ts).
 */
export async function getSessaoAtual(): Promise<SessaoAtual | null> {
  const store = await cookies();
  const token = await lerTokenSessao(store.get(NOME_COOKIE_SESSAO)?.value);
  if (!token) return null;

  const atendente = await buscarAtendenteCompletoPorId(token.atendenteId);
  if (!atendente) return null;
  if (atendente.status !== "active") return null;
  if (atendente.sessaoVersao !== token.sessaoVersao) return null;

  return {
    atendenteId: atendente.id,
    nome: atendente.nome,
    usuario: atendente.usuario,
    email: atendente.email,
    perfil: atendente.perfil,
    clinicaId: atendente.clinicaId,
    permissoes: resolverPermissoes(atendente.perfil, atendente.permissoesCustomizadas),
  };
}

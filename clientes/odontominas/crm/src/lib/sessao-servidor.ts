import { cookies } from "next/headers";
import { lerSessao, NOME_COOKIE_SESSAO, type SessaoAtual } from "@/lib/sessao";

/** Só usar em Server Component / Route Handler — `next/headers` não roda em Middleware. */
export async function getSessaoAtual(): Promise<SessaoAtual | null> {
  const store = await cookies();
  return lerSessao(store.get(NOME_COOKIE_SESSAO)?.value);
}

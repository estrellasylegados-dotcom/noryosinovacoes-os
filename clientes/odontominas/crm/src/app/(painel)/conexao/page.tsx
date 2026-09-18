import { redirect } from "next/navigation";

/** Rota antiga (Conexão do WhatsApp): agora são Canais. Mantida só pra links/favoritos antigos não quebrarem. */
export default function ConexaoPage() {
  redirect("/configuracoes/canais");
}

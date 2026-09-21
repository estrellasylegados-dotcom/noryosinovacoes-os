/**
 * Nome exibível para pessoas. Alguns provedores preenchem esse campo com um
 * identificador numérico; ele não deve ocupar o lugar do nome na interface.
 */
export function normalizarNomePessoa(nome: string | null | undefined): string | null {
  const limpo = nome?.trim() ?? "";
  if (!limpo || /^\d{8,}$/.test(limpo)) return null;
  return limpo;
}

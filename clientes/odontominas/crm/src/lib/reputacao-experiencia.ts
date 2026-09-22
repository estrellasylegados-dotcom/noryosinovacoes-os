/** Classificação conservadora: ambiguidade nunca vira satisfação ou reclamação inventada. */
export type ClassificacaoExperiencia = "muito_boa" | "boa" | "poderia_melhorar" | "ambiguo";

function normalizar(valor: string): string {
  return valor.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const NEGATIVOS = ["poderia melhorar", "nao gostei", "demorou", "mal atendido", "nao resolveu", "tive problema", "insatisfeito", "ruim", "péssimo", "pessimo"];
const MUITO_BONS = ["muito boa", "muito bom", "gostei muito", "otimo", "excelente", "adorei"];
const BONS = ["boa", "bom", "gostei", "tudo certo", "fui bem atendido", "foi bom"];

export function classificarRespostaExperiencia(resposta: string): ClassificacaoExperiencia {
  const texto = normalizar(resposta);
  if (!texto) return "ambiguo";
  if (NEGATIVOS.some((termo) => texto.includes(normalizar(termo)))) return "poderia_melhorar";
  if (MUITO_BONS.some((termo) => texto.includes(normalizar(termo)))) return "muito_boa";
  if (BONS.some((termo) => texto.includes(normalizar(termo)))) return "boa";
  return "ambiguo";
}

export const ROTULO_CLASSIFICACAO_EXPERIENCIA: Record<ClassificacaoExperiencia, string> = {
  muito_boa: "Muito boa", boa: "Boa", poderia_melhorar: "Poderia melhorar", ambiguo: "Precisa de esclarecimento",
};

import type { IconName } from "@/components/ui/Icon";

export type Tratamento = {
  slug: string;
  nome: string;
  resumo: string;
  descricao: string;
  icon: IconName;
  destaque?: boolean;
  /** só tratamento confirmado aparece no site — ver getPublicTratamentos(). */
  confirmado: boolean;
  /** caminho reservado pra página própria futura (SEO local) — ainda não criada. */
  futuraUrl: string;
};

const tratamentos: Tratamento[] = [
  {
    slug: "implantes",
    nome: "Implantodontia",
    resumo: "Substituição de dentes perdidos, com avaliação individual do caso.",
    descricao:
      "O implante dentário é uma das opções para repor um ou mais dentes perdidos, devolvendo função de mastigação e naturalidade à arcada. O tipo de implante, o planejamento e o tempo de tratamento dependem da avaliação clínica de cada caso, feita antes de qualquer indicação.",
    icon: "tooth",
    destaque: true,
    confirmado: true,
    futuraUrl: "/implantes-dentarios-brazlandia",
  },
  {
    slug: "ortodontia",
    nome: "Ortodontia",
    resumo: "Alinhamento e correção da mordida, com acompanhamento contínuo.",
    descricao:
      "O tratamento ortodôntico corrige o alinhamento dos dentes e da mordida, com acompanhamento periódico ao longo do tratamento. A indicação do tipo de aparelho e o tempo estimado variam conforme a avaliação de cada paciente.",
    icon: "shield",
    confirmado: true,
    futuraUrl: "/ortodontia-brazlandia",
  },
  {
    slug: "protese",
    nome: "Prótese Dentária",
    resumo: "Reabilitação oral com próteses planejadas para cada caso.",
    descricao:
      "A prótese dentária repõe estrutura e função de dentes ausentes ou comprometidos, como parte de um plano de reabilitação oral individual, definido após avaliação clínica.",
    icon: "crown",
    confirmado: true,
    futuraUrl: "/protese-dentaria-brazlandia",
  },
  {
    slug: "harmonizacao",
    nome: "Harmonização Orofacial",
    resumo: "Procedimentos de harmonização conduzidos por profissional habilitada.",
    descricao:
      "A harmonização orofacial reúne procedimentos voltados ao equilíbrio estético da região oral e facial, sempre precedidos de avaliação individual e conduzidos por cirurgiã-dentista habilitada.",
    icon: "sparkle",
    confirmado: true,
    futuraUrl: "/harmonizacao-orofacial-brazlandia",
  },
  {
    // TODO_CLIENTE: confirmar se a clínica oferece Endodontia antes de publicar.
    slug: "endodontia",
    nome: "Endodontia",
    resumo: "",
    descricao: "",
    icon: "tooth",
    confirmado: false,
    futuraUrl: "/endodontia-brazlandia",
  },
  {
    // TODO_CLIENTE: confirmar se a clínica oferece Periodontia antes de publicar.
    slug: "periodontia",
    nome: "Periodontia",
    resumo: "",
    descricao: "",
    icon: "shield",
    confirmado: false,
    futuraUrl: "/periodontia-brazlandia",
  },
];

export function getPublicTratamentos(): Tratamento[] {
  return tratamentos.filter((t) => t.confirmado);
}

export function getDestaque(): Tratamento {
  const item = tratamentos.find((t) => t.destaque && t.confirmado);
  if (!item) throw new Error("Nenhum tratamento em destaque confirmado.");
  return item;
}

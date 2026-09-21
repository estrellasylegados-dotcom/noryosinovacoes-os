import type { ClinicaAtual } from "@/lib/clinica";
import faviconCrm from "@/app/favicon-crm.png";

type Branding = { logoSrc: string; faviconSrc: string };

const BRANDING_PADRAO: Branding = {
  logoSrc: "/logo-crm.png",
  faviconSrc: faviconCrm.src,
};

/** Ponto único de extensão para os assets de cada instância white-label. */
const BRANDING_POR_SLUG: Record<string, Branding> = {
  odontominas: BRANDING_PADRAO,
};

export function obterBranding(clinica: Pick<ClinicaAtual, "slug"> | null): Branding {
  return (clinica && BRANDING_POR_SLUG[clinica.slug]) ?? BRANDING_PADRAO;
}

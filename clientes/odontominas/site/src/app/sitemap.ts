import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";

// `output: "export"` exige rota estática explícita (não há servidor pra recalcular em runtime).
export const dynamic = "force-static";

const routes = ["", "/sobre", "/servicos", "/contato", "/politica-de-privacidade", "/termos-de-uso"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}

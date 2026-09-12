import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";

// `output: "export"` exige rota estática explícita (não há servidor pra recalcular em runtime).
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}

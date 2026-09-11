import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Deploy self-hospedado (Hostinger Web Apps / Node.js).
   *
   * `standalone` faz o `next build` gerar um servidor mínimo em
   * `.next/standalone/` contendo só os arquivos necessários pra rodar em
   * produção (inclui o subset de `node_modules` que o app usa). Reduz muito
   * o tamanho do deploy. `next start` continua funcionando localmente.
   */
  output: "standalone",

  /**
   * O site vive num subdiretório de um repositório maior (workspace MazyOS).
   * Sem isso, o Next pode inferir a raiz de tracing errada ao encontrar
   * `.git` / lockfiles acima na árvore. Fixa a raiz nesta pasta.
   */
  outputFileTracingRoot: __dirname,

  /**
   * Sem otimização de imagem em runtime. O deploy Hostinger Web Apps roda
   * `next start` num ambiente enxuto — o otimizador (`sharp`) é uma fonte
   * extra de falha e reprocessa os PNGs. Os ativos de marca (logo/ícone)
   * devem ser servidos exatamente como fornecidos, então servimos estáticos.
   */
  images: { unoptimized: true },

  /**
   * Cache-Control explícito por tipo de recurso.
   *
   * Motivo: o Next marca páginas pré-renderizadas com `s-maxage=31536000`
   * (1 ano). A CDN da Hostinger (`hcdn`) obedece isso ao pé da letra e
   * passou a servir o HTML antigo mesmo depois do deploy novo — a logo e o
   * favicon não apareciam porque o documento em cache ainda apontava pra
   * `/favicon.ico` (removido) e não tinha o `<img>` da logo.
   *
   * - **Documentos HTML** (rotas sem extensão, fora de `_next/`): revalidação
   *   quase imediata. `max-age=0` faz o browser checar via ETag (barato,
   *   volta 304); `s-maxage=30` limita a CDN a 30s de cache. Deploy novo
   *   aparece em segundos, sem purge manual.
   * - **Assets de marca** (`.png`/`.ico`/`.svg` na raiz de `public/`): 1 dia
   *   no browser + `stale-while-revalidate` de 7 dias. Sem risco de servir
   *   arte velha por um ano se um arquivo for trocado.
   * - `/_next/static/*` (bundles com hash no nome) continua com o
   *   `immutable` padrão do Next — não é tocado aqui.
   */
  async headers() {
    return [
      {
        source: "/((?!_next/|.*\\.).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=30, must-revalidate",
          },
        ],
      },
      {
        source: "/:file(.*\\.(?:png|ico|svg|jpg|jpeg|webp|avif))",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

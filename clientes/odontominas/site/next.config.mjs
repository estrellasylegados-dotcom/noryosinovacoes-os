/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Deploy estático (Cloudflare Pages) — requisito do projeto (ver
   * clientes/odontominas/contexto.md). `export` faz o `next build` gerar
   * HTML/CSS/JS puro em `out/`: não existe processo Node em runtime pra
   * servir o site (diferente do site institucional da Noryos, que roda
   * `standalone` na Hostinger — são dois alvos de deploy diferentes).
   */
  output: "export",

  /**
   * Sem otimização de imagem em runtime — obrigatório com `output: "export"`
   * (não existe servidor pra rodar o otimizador `sharp`). Os ativos ficam
   * servidos exatamente como estão em `public/`.
   */
  images: { unoptimized: true },
};

export default nextConfig;

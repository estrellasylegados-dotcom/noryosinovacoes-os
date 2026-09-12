import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { Analytics } from "@/components/Analytics";
import { AnalyticsBinder } from "@/components/AnalyticsBinder";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { siteConfig } from "@/lib/config";
import { dentistJsonLd, websiteJsonLd, jsonLdScript } from "@/lib/seo";

/**
 * Revisão de direção de arte 2026-09: uma família só (Manrope, variável,
 * Google Fonts) pra corpo de texto e títulos — sans-serif editorial
 * contemporânea, sem peso extra de uma segunda família (antes Inter+Manrope).
 * Geist Mono continua só pros detalhes editoriais (labels, numeração).
 */
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: "variable",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${geistMono.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <Analytics />
        <AnalyticsBinder />
        {/* Sem JS, o motion system não adiciona `.is-in` — garante conteúdo visível. */}
        <noscript>
          <style>{`[data-anim]{opacity:1!important;transform:none!important;clip-path:none!important}`}</style>
        </noscript>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(dentistJsonLd())} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(websiteJsonLd())} />
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--color-cyan)] focus:px-4 focus:py-2 focus:text-[var(--color-ink)]"
        >
          Pular para o conteúdo
        </a>
        <ScrollProgress />
        <Header />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <Footer />
        <FloatingWhatsapp />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { buscarClinicaAtual } from "@/lib/clinica";
import { obterBranding } from "@/lib/branding";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * `generateMetadata` (não `export const metadata` estático) — Fase 3,
 * branding dinâmico: o nome da clínica só é conhecido em runtime
 * (`buscarClinicaAtual`, cacheado em processo). Fallback genérico se a busca
 * falhar (Supabase fora do ar) — nunca quebra o render da página por causa
 * do título.
 */
export async function generateMetadata(): Promise<Metadata> {
  const clinica = await buscarClinicaAtual();
  const nome = clinica?.nome ?? "clínica";
  const branding = obterBranding(clinica);
  return {
    title: `CRM ${nome}`,
    description: `Captação e relacionamento — ${nome}`,
    icons: {
      icon: branding.faviconSrc,
      apple: branding.faviconSrc,
    },
  };
}

/**
 * Aplica a classe `dark` antes do 1º paint, direto do localStorage — sem
 * isso, a página nasce clara e "pisca" pro escuro um instante depois pra
 * quem escolheu o tema escuro (ver ThemeToggle.tsx, mesma chave
 * `crm-tema`). `suppressHydrationWarning` na `<html>` porque este script
 * roda fora do ciclo do React (o servidor não sabe a preferência da
 * pessoa).
 */
const SCRIPT_TEMA_INICIAL = `
(function () {
  try {
    var tema = localStorage.getItem("crm-tema");
    var escuro = tema === "dark" || (!tema && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", escuro);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Evita que extensões de inversão de cor sobrescrevam os tokens do
            CRM; o tema nativo controlado por crm-tema permanece a fonte de
            verdade para claro e escuro. */}
        <meta name="darkreader-lock" />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

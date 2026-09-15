import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM OdontoMinas",
  description: "Captação e relacionamento — OdontoMinas",
};

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

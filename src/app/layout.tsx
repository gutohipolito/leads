import type { Metadata } from "next";
import { Orbitron, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "JARVIS LEADS | Protocolo de Captação",
  description: "Sistema avançado de monitoramento e coleta de leads.",
  keywords: ["leads", "marketing", "dashboard", "jarvis", "hud"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${orbitron.variable} ${jetbrainsMono.variable}`}>
        {children}
      </body>
    </html>
  );
}

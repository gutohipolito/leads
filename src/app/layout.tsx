import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Asthros - Gerenciamento de Leads",
  description: "Monitoramento avançado de leads com interface moderna.",
  icons: {
    icon: "/asthros-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${plusJakarta.variable} ${outfit.variable}`}>
      <body style={{ fontFamily: 'var(--font-outfit), var(--font-plus-jakarta), sans-serif' }}>
        {children}
      </body>
    </html>
  );
}

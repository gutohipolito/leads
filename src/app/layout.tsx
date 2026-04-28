import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Asthros Leads | Dashboard de Captação",
  description: "Gerencie seus leads e webhooks de forma profissional e eficiente.",
  keywords: ["leads", "marketing", "dashboard", "webhook", "clientes"],
  authors: [{ name: "Asthros" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${outfit.variable}`}>
        {children}
      </body>
    </html>
  );
}

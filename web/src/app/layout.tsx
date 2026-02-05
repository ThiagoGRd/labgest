import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LabGest - Sistema de Gestão para Laboratório de Prótese",
  description: "Sistema completo de gestão para laboratórios de prótese dentária. Ordens de serviço, produção, estoque e relatórios inteligentes.",
  keywords: ["laboratório", "prótese dentária", "gestão", "dental lab", "odontologia"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

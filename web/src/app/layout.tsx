import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { RealtimeOrders } from "@/components/providers/realtime-orders";

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
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
          <RealtimeOrders />
        </ThemeProvider>
      </body>
    </html>
  );
}

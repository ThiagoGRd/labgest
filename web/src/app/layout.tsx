import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { RealtimeOrders } from "@/components/providers/realtime-orders";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
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
      <body className={`${outfit.variable} ${plusJakarta.variable} antialiased font-sans`}>
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

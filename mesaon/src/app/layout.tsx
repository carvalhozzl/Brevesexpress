import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { siteUrl } from "@/lib/env";

// Inter (SIL Open Font License) hospedada localmente: sem requisições a terceiros.
const inter = localFont({
  src: "./fonts/inter-latin-wght.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "MesaOn — Seu atendimento a um toque de distância",
    template: "%s · MesaOn",
  },
  description:
    "Transforme cada mesa em um ponto de atendimento inteligente. Clientes chamam o garçom pelo celular via QR Code ou NFC, e a equipe recebe em tempo real.",
  applicationName: "MesaOn",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "MesaOn",
    title: "MesaOn — Seu cliente chama. Sua equipe atende.",
    description: "Chamada de garçom pelo celular, sem aplicativo. QR Code, NFC e painel em tempo real para restaurantes.",
  },
};

export const viewport: Viewport = {
  themeColor: "#14213d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}

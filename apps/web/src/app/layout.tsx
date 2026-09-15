import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title: "CineCuts — Clássicos em domínio público, sem limites",
  description: "Assine para assistir filmes clássicos de domínio público sem anúncios, em qualquer dispositivo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Island Company — Todo negócio tem um próximo destino",
  description: "Estratégia, tráfego pago, branding, conteúdo e tecnologia para o seu negócio. Mapeie seu próximo passo com a jornada da Island Company.",
  // Preview isolado: mantém fora dos buscadores até a aprovação para produção (remova ao publicar)
  robots: { index: false, follow: false },
  applicationName: "Island Company",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090313",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="sr-only">
          Ir para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}

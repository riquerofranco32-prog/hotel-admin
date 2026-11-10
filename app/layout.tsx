import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Toaster } from "@/components/ui";

// Las mismas tipografías del panel de Se7en (copiadas en app/fonts, sin pedirle nada a Google).
const archivo = localFont({ src: "./fonts/archivo-latin.woff2", weight: "100 900", variable: "--font-archivo", display: "swap" });
const wide = localFont({ src: "./fonts/archivo-wdth-latin.woff2", weight: "100 900", variable: "--font-wide", display: "swap" });
const chivoMono = localFont({ src: "./fonts/chivo-mono-latin.woff2", weight: "100 900", variable: "--font-chivo-mono", display: "swap" });
const serif = localFont({ src: "./fonts/instrument-serif-latin-italic-400.woff2", weight: "400", style: "italic", variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Hotel PMS — Panel de administración",
  description: "Gestión hotelera: reservas, recepción, facturación, mantenimiento y más.",
};

// Aplica el tema guardado (o el del sistema) antes de pintar, así no hay parpadeo.
const THEME_SCRIPT = `try{var t=localStorage.getItem("hotel-theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark");var a=localStorage.getItem("hotel-accent");if(a&&/^[a-z]+$/.test(a))document.documentElement.dataset.accent=a}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${archivo.variable} ${wide.variable} ${chivoMono.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans">
        <AppProvider>
          {children}
          <Toaster />
        </AppProvider>
      </body>
    </html>
  );
}

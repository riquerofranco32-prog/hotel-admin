import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Toaster } from "@/components/ui";

export const metadata: Metadata = {
  title: "Hotel PMS — Panel de administración",
  description: "Gestión hotelera: reservas, recepción, facturación, mantenimiento y más.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans">
        <AppProvider>
          {children}
          <Toaster />
        </AppProvider>
      </body>
    </html>
  );
}

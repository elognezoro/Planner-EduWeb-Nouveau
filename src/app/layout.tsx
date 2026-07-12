import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { TraqueurVisite } from "@/components/traqueur-visite";
import { AssistantWidget } from "@/app/app/assistant-widget";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "EduWeb Planner — Plateforme nationale de gestion et de planification scolaire",
    template: "%s · EduWeb Planner",
  },
  description:
    "EduWeb Planner digitalise et centralise la gestion scolaire du système éducatif ivoirien : emplois du temps générés automatiquement, vie scolaire, inspection, statistiques et pilotage, du parent d'élève à l'administration nationale.",
  keywords: [
    "éducation",
    "Côte d'Ivoire",
    "emploi du temps",
    "gestion scolaire",
    "CAFOP",
    "APFC",
    "DRENA",
    "vie scolaire",
  ],
  authors: [{ name: "EduWeb Planner" }],
  openGraph: {
    title: "EduWeb Planner",
    description:
      "La plateforme nationale de gestion et de planification scolaire pour le système éducatif ivoirien.",
    type: "website",
    locale: "fr_CI",
  },
  // Icônes : gérées par les fichiers conventionnels src/app/favicon.ico, icon.png, apple-icon.png.
};

export const viewport: Viewport = {
  themeColor: "#154231",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <TraqueurVisite />
        {children}
        {/* Assistant IA disponible sur TOUTES les pages (accueil, public et espace connecté). */}
        <AssistantWidget />
      </body>
    </html>
  );
}

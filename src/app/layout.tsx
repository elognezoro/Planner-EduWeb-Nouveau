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
  // Installation sur l'écran d'accueil (iOS) : ouverture en plein écran, sans barre de
  // navigateur. Le manifeste (src/app/manifest.ts) fait de même sur Android.
  appleWebApp: {
    capable: true,
    title: "EduWeb",
    statusBarStyle: "default",
  },
  // Next 16 n'émet plus que « mobile-web-app-capable » ; les iPhone antérieurs à iOS 16.4
  // ne connaissent que la balise historique. On la fournit donc explicitement, sinon
  // l'application s'y rouvrirait dans Safari, barre d'adresse comprise.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#154231",
  // NOTE (chantier mobile) : « viewportFit: "cover" » — qui fait passer le contenu sous
  // l'encoche et la barre gestuelle — sera ajouté à l'étape suivante, EN MÊME TEMPS que
  // les marges de zone sûre des éléments fixes (en-tête, tiroir, assistant, modales).
  // L'ajouter seul ferait passer ces éléments sous l'encoche en mode paysage.
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

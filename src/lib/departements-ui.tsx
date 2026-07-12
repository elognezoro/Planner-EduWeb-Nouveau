import {
  Compass, Cpu, CalendarClock, ShieldCheck, GraduationCap, BookMarked, LifeBuoy,
  Presentation, Users2, BarChart3, Stamp, Network, School, Building2, HeartHandshake,
  Sparkles, Megaphone, Scale, type LucideIcon,
} from "lucide-react";

/** Icônes lucide proposées pour un département (clé = nom stocké en base). */
export const ICONES_DEPARTEMENT: Record<string, LucideIcon> = {
  Compass, Cpu, CalendarClock, ShieldCheck, GraduationCap, BookMarked, LifeBuoy,
  Presentation, Users2, BarChart3, Stamp, Network, School, Building2, HeartHandshake,
  Sparkles, Megaphone, Scale,
};

export const OPTIONS_ICONE = Object.keys(ICONES_DEPARTEMENT);

/** Résout un nom d'icône stocké en base ; repli sur Compass. */
export function resoudreIconeDepartement(nom?: string | null): LucideIcon {
  return (nom && ICONES_DEPARTEMENT[nom]) || Compass;
}

/** Catégories (onglets de la page d'accueil). */
export const CATEGORIES_DEPARTEMENT: { v: string; libelle: string }[] = [
  { v: "produit", libelle: "Produit & Ingénierie" },
  { v: "pedagogie", libelle: "Pédagogie" },
  { v: "support", libelle: "Support & Formation" },
  { v: "pilotage", libelle: "Pilotage" },
  { v: "general", libelle: "Général" },
];

export function libelleCategorie(v: string): string {
  return CATEGORIES_DEPARTEMENT.find((c) => c.v === v)?.libelle ?? "Général";
}

/** Représentation sérialisable d'un département (props client). */
export type DepartementVue = {
  id: string;
  nom: string;
  description: string | null;
  categorie: string;
  icone: string | null;
  couleur: string;
  ordre: number;
  actif: boolean;
};

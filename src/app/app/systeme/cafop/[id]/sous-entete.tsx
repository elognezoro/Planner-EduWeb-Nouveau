import Link from "next/link";
import { ArrowLeft, Settings, BookText, ClipboardCheck, FileBarChart } from "lucide-react";
import { appliquerTerme } from "@/lib/cafop-terme";

export type OngletDetail = "config" | "cahier" | "appel" | "notes";

const BASE = "/app/systeme/cafop";

/** Sous-en-tête d'un CAFOP : retour + identité + 4 onglets (tous fonctionnels). */
export function SousEnteteCafop({
  cafopId,
  nom,
  sousTitre,
  actif,
  terme = "CAFOP",
  masquerConfig = false,
}: {
  cafopId: string;
  nom: string;
  sousTitre: string;
  actif: OngletDetail;
  terme?: string;
  /** Masque l'onglet « Configurer » et le bouton Retour (ADC : accès aux 3 sous-pages seulement). */
  masquerConfig?: boolean;
}) {
  const onglets = ([
    { cle: "config", libelle: appliquerTerme("Configurer le CAFOP", terme), href: `${BASE}/${cafopId}`, Icone: Settings },
    { cle: "cahier", libelle: "Cahier de texte", href: `${BASE}/${cafopId}/cahier-texte`, Icone: BookText },
    { cle: "appel", libelle: "Registre d'appel", href: `${BASE}/${cafopId}/registre-appel`, Icone: ClipboardCheck },
    { cle: "notes", libelle: "Notes & bulletins", href: `${BASE}/${cafopId}/notes-bulletins`, Icone: FileBarChart },
  ] as { cle: OngletDetail; libelle: string; href: string; Icone: typeof Settings }[]).filter(
    (o) => o.cle !== "config" || !masquerConfig,
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-white px-5 py-3.5 shadow-soft">
      <div className="flex items-center gap-3">
        {!masquerConfig && (
          <Link href={`${BASE}/enseignements`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 px-3 text-sm font-semibold text-ink-700/70 hover:bg-cream-100">
            <ArrowLeft size={15} /> Retour
          </Link>
        )}
        <div>
          <h2 className="font-display text-lg font-bold text-forest-900">{nom}</h2>
          <p className="text-xs text-ink-700/55">{sousTitre}</p>
        </div>
      </div>
      <nav className="flex flex-wrap gap-1.5">
        {onglets.map((o) => (
          <Link
            key={o.cle}
            href={o.href}
            aria-current={o.cle === actif ? "page" : undefined}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${
              o.cle === actif ? "bg-gold-100 text-gold-800" : "border border-cream-300 text-ink-700/70 hover:bg-cream-100"
            }`}
          >
            <o.Icone size={15} /> {o.libelle}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Données communes chargées par chaque onglet (en-tête global + sous-en-tête). */
export function sousTitreCafop(c: { drena: string | null; pays: string }, nbPromos: number, nbEleves: number): string {
  return `${c.drena ? `DRENA ${c.drena} — ` : ""}${c.pays} · ${nbPromos} promotion(s) · ${nbEleves} élève(s)-maître(s)`;
}

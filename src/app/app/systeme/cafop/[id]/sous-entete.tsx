import Link from "next/link";
import { ArrowLeft, Settings, BookText, ClipboardCheck, FileBarChart, Briefcase } from "lucide-react";
import { appliquerTerme } from "@/lib/cafop-terme";
import { PublierTitreMobile } from "@/components/app/mobile/publier-titre";

export type OngletDetail = "config" | "cahier" | "appel" | "notes" | "stages";

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
    { cle: "config", libelle: appliquerTerme("Configurer le CAFOP", terme), court: "Configurer", href: `${BASE}/${cafopId}`, Icone: Settings },
    { cle: "cahier", libelle: "Cahier de texte", court: "Cahier", href: `${BASE}/${cafopId}/cahier-texte`, Icone: BookText },
    { cle: "appel", libelle: "Registre d'appel", court: "Appel", href: `${BASE}/${cafopId}/registre-appel`, Icone: ClipboardCheck },
    { cle: "notes", libelle: "Notes & bulletins", court: "Notes", href: `${BASE}/${cafopId}/notes-bulletins`, Icone: FileBarChart },
    { cle: "stages", libelle: "Stages pratiques", court: "Stages", href: `${BASE}/${cafopId}/stages`, Icone: Briefcase },
  ] as { cle: OngletDetail; libelle: string; court: string; href: string; Icone: typeof Settings }[]).filter(
    (o) => o.cle !== "config" || !masquerConfig,
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-white px-5 py-3.5 shadow-soft mobile:gap-2 mobile:px-3 mobile:py-3">
      {/* Téléphone : le nom du centre devient le titre de l'en-tête mobile. */}
      <PublierTitreMobile titre={nom} />
      <div className="flex items-center gap-3">
        {/* Téléphone : « Retour » masqué — l'en-tête mobile a déjà son bouton retour. */}
        {!masquerConfig && (
          <Link href={`${BASE}/enseignements`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 px-3 text-sm font-semibold text-ink-700/70 hover:bg-cream-100 mobile:hidden">
            <ArrowLeft size={15} /> Retour
          </Link>
        )}
        <div>
          <h2 className="titre-page-ecran-mobile font-display text-lg font-bold text-forest-900">{nom}</h2>
          <p className="text-xs text-ink-700/55">{sousTitre}</p>
        </div>
      </div>
      {/* Téléphone : onglets sur une ligne qui défile, libellés courts. */}
      <nav className="rangee-defilante-mobile flex flex-wrap gap-1.5 mobile:w-full">
        {onglets.map((o) => (
          <Link
            key={o.cle}
            href={o.href}
            aria-current={o.cle === actif ? "page" : undefined}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors mobile:h-11 mobile:px-4 ${
              o.cle === actif ? "bg-gold-100 text-gold-800" : "border border-cream-300 text-ink-700/70 hover:bg-cream-100"
            }`}
          >
            <o.Icone size={15} />{" "}
            <span>
              <span className="mobile:hidden">{o.libelle}</span>
              <span className="hidden mobile:inline">{o.court}</span>
            </span>
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

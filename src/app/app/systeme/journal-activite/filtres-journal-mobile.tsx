"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, SlidersHorizontal } from "lucide-react";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";

/**
 * FILTRES DU JOURNAL — TÉLÉPHONE uniquement (rendu dans un bloc « lg:hidden print:hidden »).
 *
 * Sur ordinateur, le formulaire GET de la page reste affiché en ligne, inchangé. Sur téléphone,
 * ses quatre champs + deux boutons occupaient ~6 rangées avant le moindre évènement : ils passent
 * dans une feuille montante dont le bouton principal ENVOIE le même formulaire GET (le
 * « Voir les résultats » générique de FiltresMobiles ne ferait que fermer la feuille). L'export
 * CSV reste accessible d'un appui, à côté du bouton « Filtres ».
 */
export function FiltresJournalMobile({
  action,
  source,
  entite,
  acteur,
  jours,
  entites,
  periodes,
  lienExport,
}: {
  action: string;
  source: string;
  entite: string;
  acteur: string;
  jours: string;
  entites: string[];
  periodes: { valeur: string; libelle: string }[];
  lienExport: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const actifs = [source, entite, acteur].filter(Boolean).length + (jours !== "7" ? 1 : 0);
  const champ =
    "h-12 w-full rounded-2xl border border-cream-300 bg-white px-3.5 text-base text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-haspopup="dialog"
          aria-expanded={ouvert}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-cream-300 bg-white px-5 font-semibold text-forest-800 shadow-soft active:bg-cream-100"
        >
          <SlidersHorizontal aria-hidden size={18} />
          Filtres
          {actifs > 0 && (
            <span className="rounded-full bg-forest-800 px-2 py-0.5 text-xs font-bold text-cream-50 tabular-nums">
              {actifs}
              <span className="sr-only"> actif{actifs > 1 ? "s" : ""}</span>
            </span>
          )}
        </button>
        <Link
          href={lienExport}
          aria-label="Exporter (CSV)"
          className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-cream-300 bg-white px-4 font-semibold text-forest-800 shadow-soft active:bg-cream-100"
        >
          <Download size={18} /> CSV
        </Link>
      </div>

      <FeuilleBas ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Filtrer le journal">
        <form method="get" action={action} className="space-y-3 px-2 pb-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-forest-900">Nature</span>
            <select name="source" defaultValue={source} className={champ}>
              <option value="">Toutes les natures</option>
              <option value="securite">Sécurité</option>
              <option value="metier">Métier</option>
              <option value="auto">Automatique (données)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-forest-900">Entité</span>
            <select name="entite" defaultValue={entite} className={champ}>
              <option value="">Toutes les entités</option>
              {entites.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-forest-900">Acteur (e-mail)</span>
            <input name="acteur" defaultValue={acteur} placeholder="rechercher…" className={champ} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-forest-900">Période</span>
            <select name="jours" defaultValue={jours} className={champ}>
              {periodes.map((p) => (
                <option key={p.valeur} value={p.valeur}>
                  {p.libelle}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="mt-2 min-h-12 w-full rounded-full bg-forest-800 font-semibold text-cream-50 active:bg-forest-700"
          >
            Voir les résultats
          </button>
        </form>
      </FeuilleBas>
    </>
  );
}

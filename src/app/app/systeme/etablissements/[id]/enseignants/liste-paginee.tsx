"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { SupprimerUtilisateur } from "./delete-buttons";

const PAR_PAGE = 5;

export interface EnseignantItem {
  id: string;
  nom: string;
  email: string;
}

/**
 * Liste paginée des enseignants de l'établissement : 5 par page pour ne pas allonger
 * la page de configuration après un import CSV, avec navigation et lien vers la
 * gestion complète des comptes.
 */
export function ListeEnseignantsPaginee({
  etablissementId,
  enseignants,
}: {
  etablissementId: string;
  enseignants: EnseignantItem[];
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(enseignants.length / PAR_PAGE));
  const pageSure = Math.min(page, pages);
  const visibles = enseignants.slice((pageSure - 1) * PAR_PAGE, pageSure * PAR_PAGE);

  if (enseignants.length === 0) {
    return <p className="text-sm text-ink-700/60">Aucun enseignant enregistré dans cet établissement.</p>;
  }

  return (
    <div>
      <ul className="divide-y divide-cream-100">
        {visibles.map((ens) => (
          <li key={ens.id} className="flex items-center justify-between py-2 text-sm mobile:gap-2">
            {/* Téléphone : l'e-mail passe SOUS le nom, en entier, avec retour à la ligne seulement
                si nécessaire (break-all le coupait au milieu des mots sur 2-3 lignes). */}
            <span className="min-w-0 mobile:flex-1">
              <span className="font-medium text-forest-900 mobile:block">{ens.nom}</span>
              <span className="ml-2 break-all text-xs text-ink-700/55 mobile:ml-0 mobile:block mobile:break-normal mobile:wrap-anywhere">{ens.email}</span>
            </span>
            <SupprimerUtilisateur utilisateurId={ens.id} etablissementId={etablissementId} />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cream-100 pt-3">
        <p className="text-xs text-ink-700/60">
          {(pageSure - 1) * PAR_PAGE + 1}–{Math.min(pageSure * PAR_PAGE, enseignants.length)} sur{" "}
          {enseignants.length} · page {pageSure}/{pages}
        </p>
        <div className="flex items-center gap-1.5 mobile:w-full">
          <Link
            href="/app/systeme/comptes?role=enseignant"
            className="mr-2 inline-flex h-8 items-center gap-1.5 rounded-full border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50 mobile:mr-auto mobile:h-11"
          >
            <Users size={13} /> Tout voir dans Comptes
          </Link>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageSure <= 1}
            aria-label="Page précédente"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cream-300 bg-white text-forest-800 hover:bg-forest-50 disabled:opacity-40 mobile:h-11 mobile:w-11"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={pageSure >= pages}
            aria-label="Page suivante"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cream-300 bg-white text-forest-800 hover:bg-forest-50 disabled:opacity-40 mobile:h-11 mobile:w-11"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

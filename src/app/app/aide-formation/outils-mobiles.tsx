"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";
import { useEcranMobile } from "@/lib/mobile/appareil";
import { cn } from "@/lib/utils";

/**
 * OUTILS MOBILES de l'espace « Aide et Formation » (et des pages du compte).
 *
 * Règle commune : sur ORDINATEUR et à l'IMPRESSION, chaque outil rend EXACTEMENT ce que la page
 * rendait avant (useEcranMobile vaut « faux » au rendu serveur, à l'hydratation, au-dessus du
 * seuil et à l'impression). Les variantes de téléphone ne s'activent qu'après hydratation, sur
 * un écran de moins de 64rem.
 */

/** Rend le contenu d'un formulaire paresseusement : le formulaire n'est construit que s'il est
 *  réellement affiché (la feuille ne monte ses enfants qu'ouverte ou pendant sa fermeture). */
function Rendu({ rendre }: { rendre: () => React.ReactNode }) {
  return <>{rendre()}</>;
}

/**
 * FORMULAIRE DÉPLIÉ → FEUILLE MONTANTE.
 *
 * Ordinateur : comportement historique — le déclencheur, puis le formulaire À SA PLACE une fois
 * ouvert. Téléphone : le formulaire, déplié dans une rangée étroite (à côté d'un titre, dans un
 * groupe d'actions), y devenait inutilisable ; il s'ouvre ici dans une feuille montante pleine
 * largeur et le déclencheur reste en place.
 */
export function FormulaireEnFeuille({
  ouvert,
  onFermer,
  titre,
  declencheur,
  rendre,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  declencheur: React.ReactNode;
  /** Construit le formulaire (appelé seulement quand il est affiché). */
  rendre: () => React.ReactNode;
}) {
  const mobile = useEcranMobile();
  // La feuille n'est montée qu'à la première ouverture (une page de gestion compte des dizaines
  // de déclencheurs : inutile d'armer autant d'écouteurs d'écran), puis gardée pour sa fermeture.
  const [dejaOuvert, setDejaOuvert] = useState(false);
  if (!mobile) return <>{ouvert ? rendre() : declencheur}</>;
  if (ouvert && !dejaOuvert) setDejaOuvert(true);
  return (
    <>
      {declencheur}
      {(ouvert || dejaOuvert) && (
        <FeuilleBas ouvert={ouvert} onFermer={onFermer} titre={titre} hauteurMax="92dvh">
          {/* Téléphone : la feuille porte déjà le cadre et le titre — le formulaire perd le sien. */}
          <div className="px-2 pb-2 [&>form]:border-0 [&>form]:bg-transparent [&>form]:p-1 [&>form]:shadow-none">
            <Rendu rendre={rendre} />
          </div>
        </FeuilleBas>
      )}
    </>
  );
}

type DemandeConfirmation = { message: string; faire: () => void; libelle: string; titre: string; danger: boolean };

/**
 * CONFIRMATION : window.confirm sur ordinateur (inchangé), feuille montante sur téléphone — la
 * boîte système affiche le domaine et casse l'expérience d'application installée.
 *
 * Usage : `const { confirmer, feuille } = useConfirmationMobile();` puis, dans le gestionnaire de
 * clic, `confirmer(message, () => …)` à la place de `if (window.confirm(message)) …`, et rendre
 * `{feuille}` à côté du bouton (portail vers <body> : aucun élément ajouté sur place).
 */
export function useConfirmationMobile() {
  const mobile = useEcranMobile();
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null);
  const [ouvert, setOuvert] = useState(false);

  function confirmer(
    message: string,
    faire: () => void,
    options?: { libelle?: string; titre?: string; danger?: boolean },
  ) {
    if (!mobile) {
      if (window.confirm(message)) faire();
      return;
    }
    setDemande({
      message,
      faire,
      libelle: options?.libelle ?? "Supprimer",
      titre: options?.titre ?? "Confirmation",
      danger: options?.danger ?? true,
    });
    setOuvert(true);
  }

  // Montée seulement après une première demande (jamais sur ordinateur, où demande reste vide).
  const feuille = demande && (
    <FeuilleBas ouvert={ouvert} onFermer={() => setOuvert(false)} titre={demande.titre} hauteurMax="60dvh">
      <div className="space-y-3 px-2 pb-2">
        <p className="text-base leading-relaxed text-ink-800">{demande.message}</p>
        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            demande.faire();
          }}
          className={`min-h-12 w-full rounded-full px-5 font-semibold ${
            demande.danger ? "bg-red-600 text-white active:bg-red-700" : "bg-forest-800 text-cream-50 active:bg-forest-700"
          }`}
        >
          {demande.libelle}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="min-h-12 w-full rounded-full border border-cream-300 bg-white px-5 font-semibold text-forest-800 active:bg-cream-100"
        >
          Annuler
        </button>
      </div>
    </FeuilleBas>
  );

  return { confirmer, feuille };
}

/**
 * BOUTON « PARTAGER » — téléphone uniquement (masqué sur ordinateur et à l'impression).
 * Ouvre la feuille de partage du système (WhatsApp, SMS, e-mail…) ; à défaut, copie le lien.
 */
export function BoutonPartagerMobile({ url, titre, className }: { url: string; titre?: string; className?: string }) {
  const [copie, setCopie] = useState(false);

  async function partager() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title: titre });
      } catch {
        /* partage annulé par l'utilisateur */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 1800);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  return (
    <button
      type="button"
      onClick={partager}
      className={cn(
        "hidden min-h-11 items-center justify-center gap-1.5 rounded-full border border-forest-300 bg-white px-4 text-sm font-semibold text-forest-800 active:bg-forest-50 mobile:inline-flex print:hidden",
        className,
      )}
    >
      {copie ? <Check size={16} /> : <Share2 size={16} />} {copie ? "Lien copié" : "Partager"}
    </button>
  );
}

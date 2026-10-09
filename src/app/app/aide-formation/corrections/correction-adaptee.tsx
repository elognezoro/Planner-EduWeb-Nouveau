"use client";

import { useState } from "react";
import { ChevronUp, ClipboardCheck, Eye } from "lucide-react";
import { useEcranMobile } from "@/lib/mobile/appareil";
import { CorrectionForm } from "./correction-form";

type Soumission = Parameters<typeof CorrectionForm>[0]["soumission"];

/**
 * Formulaire de correction adapté à l'écran.
 *
 * Ordinateur et impression : le formulaire complet (copie, note, éditeur riche) est déplié dans
 * la carte, exactement comme avant — il est rendu au serveur et l'enveloppe est un simple bloc.
 * Téléphone : chaque dépôt dépliait en permanence la copie et un éditeur complet (10 dépôts =
 * plus de 15 écrans). La carte reste repliée sur l'en-tête et un bouton déplie la correction sur
 * place. L'exemplaire « ordinateur » est masqué par CSS dès le premier affichage, puis démonté
 * après hydratation (un seul éditeur riche monté à la fois).
 * Pas de feuille montante ici : elle démonte son contenu à la fermeture, et la note ou
 * l'appréciation en cours de saisie serait perdue d'un simple glissement.
 */
export function CorrectionAdaptee({ soumission }: { soumission: Soumission }) {
  const mobile = useEcranMobile();
  const [ouvert, setOuvert] = useState(false);
  // Formulaire (et son éditeur riche) monté à la première ouverture, puis conservé masqué une
  // fois replié : la saisie survit au repli comme à une rotation de tablette. Volontairement
  // non conditionné par « mobile » — le bloc est lg:hidden print:hidden de toute façon.
  const [dejaOuvert, setDejaOuvert] = useState(false);
  if (ouvert && !dejaOuvert) setDejaOuvert(true);
  const corrige = soumission.statut === "corrige";
  return (
    <>
      {/* Placé AVANT le bloc ordinateur : dans la carte « space-y », ce dernier reste le dernier
          enfant et ne reçoit donc aucune marge supplémentaire. */}
      <div className="lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          className={
            corrige
              ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-forest-300 bg-white px-5 text-sm font-semibold text-forest-800 active:bg-forest-50"
              : "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 active:bg-forest-700"
          }
        >
          {ouvert ? <ChevronUp size={16} /> : corrige ? <Eye size={16} /> : <ClipboardCheck size={16} />}
          {ouvert ? "Replier la correction" : corrige ? "Voir ou modifier la correction" : "Corriger"}
        </button>
        {dejaOuvert && (
          <div className={ouvert ? "mt-3" : "hidden"}>
            <CorrectionForm soumission={soumission} />
          </div>
        )}
      </div>
      {!mobile && (
        <div className="mobile:hidden">
          <CorrectionForm soumission={soumission} />
        </div>
      )}
    </>
  );
}

import Image from "next/image";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";

/**
 * En-tête OFFICIEL de l'établissement pour la version imprimable des emplois du temps
 * (même structure que l'en-tête du bulletin : ministère à gauche, titre au centre,
 * pile officielle du pays à droite — État, armoiries, devise, année scolaire).
 * Invisible à l'écran, affiché uniquement à l'impression (PDF).
 */

export interface EtablissementEnTete {
  nom: string;
  pays: string | null;
  ministere: string | null;
  sloganBulletin: string | null;
  anneeScolaire: string | null;
  emblemeUrl: string | null;
}

export function EnTeteOfficielEdt({
  etab,
  sousTitre,
}: {
  etab: EtablissementEnTete;
  /** Contexte imprimé sous le titre (ex : « Classe 6ème 1 »). */
  sousTitre?: string;
}) {
  const pays = etab.pays ?? "";
  const infoPays = pays ? trouverPays(pays) : undefined;
  const ministere = etab.ministere || infoPays?.ministere || "";
  // Slogan officiel : la devise du pays prime, repli sur la valeur stockée (États sans devise
  // au référentiel). S'adapte donc automatiquement au pays de l'établissement.
  const slogan = infoPays?.devise || etab.sloganBulletin || "";
  // Armoiries nationales : l'emblème déposé par l'établissement prime ; à défaut, le blason
  // officiel du pays (par code ISO). `priority` force le chargement immédiat même si le bloc
  // est masqué à l'écran (hidden) — sans quoi l'image lazy n'existerait pas à l'impression.
  const armoiries = etab.emblemeUrl ?? (infoPays ? armoiriesUrl(infoPays.code) : null);

  return (
    <>
      {/* Impression PORTRAIT, ajustée à UNE SEULE page, même pour une journée de 12 séances :
          la grille des 5 jours occupe toute la largeur (plus de largeur minimale ni de
          défilement) ; police et marges internes compactées ; hauteurs FIXES des cellules
          (cases vides h-12/h-8) neutralisées — ce sont elles qui gonflaient chaque ligne et
          faisaient déborder sur une 2e page ; couleurs des cours et des pauses conservées. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  @page { size: A4 portrait; margin: 9mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

  /* La FEUILLE occupe toute la hauteur de la page A4 et répartit ses blocs du haut vers le bas :
     en-tête officiel, grille (qui grandit pour combler l'espace), volumes, demi-journées.
     Ciblée par sa classe (page établissement) OU par le fait qu'elle contient la grille
     (:has — pages vie scolaire, où la carte n'a pas de classe dédiée). */
  .edt-feuille,
  :has(> .edt-grille-wrap) {
    display: flex !important;
    flex-direction: column;
    height: 277mm;              /* A4 (297) − 2×9 mm de marge, avec 2 mm de sécurité anti-débordement */
    box-sizing: border-box;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: #fff !important;
  }
  .edt-feuille > *,
  :has(> .edt-grille-wrap) > * { flex: 0 0 auto; }

  /* La grille s'étire pour remplir l'espace restant ; les rangées se répartissent la hauteur. */
  .edt-grille-wrap { flex: 1 1 auto !important; min-height: 0; overflow: visible !important; }
  .edt-grille-wrap > .overflow-x-auto { height: 100% !important; overflow: visible !important; }
  .edt-grille-wrap table { width: 100% !important; height: 100%; min-width: 0 !important; table-layout: fixed; border-collapse: collapse; }

  thead th { padding: 4px 3px !important; font-size: 10.5px !important; }
  tbody td { padding: 3px 4px !important; vertical-align: top; }
  tbody td, tbody td * { font-size: 10px !important; line-height: 1.18 !important; }
  tbody td p:first-of-type { font-size: 10.5px !important; }
  thead th:first-child, tbody td:first-child { width: 9% !important; white-space: nowrap; }
  tr { break-inside: avoid; }

  /* Bandes de pause : compactes, elles ne s'étirent pas avec la répartition. */
  tr.edt-pause td { height: 7mm !important; }
  tr.edt-pause p { padding: 1mm 0 !important; }

  /* En-tête officiel. */
  .edt-entete-officiel img { height: 34px !important; width: auto !important; }
  .edt-entete-officiel hr { margin: 5px 0 7px !important; }
  .edt-entete-officiel .font-display { font-size: 15px !important; }

  /* Volumes horaires hebdomadaires. */
  .edt-volumes { margin-top: 7px !important; padding-top: 6px !important; }
  .edt-volumes h3 { font-size: 11px !important; }
  .edt-volumes li, .edt-volumes p, .edt-volumes span { font-size: 10px !important; line-height: 1.3 !important; }
}`,
        }}
      />
      <div className="edt-entete-officiel hidden print:block">
        <div className="grid grid-cols-3 items-start gap-2">
          <div className="text-[0.7rem] font-semibold uppercase leading-tight text-forest-900">
            <p>{ministere}</p>
            <p className="mt-2 font-bold">{etab.nom}</p>
          </div>
          <div className="text-center">
            <p className="font-display text-lg font-bold tracking-wide text-forest-900">
              EMPLOI DU TEMPS
            </p>
            {sousTitre && <p className="text-sm font-semibold text-ink-800">{sousTitre}</p>}
          </div>
          <div className="text-center text-[0.7rem] leading-tight text-ink-700/80">
            <p className="font-semibold text-forest-900">
              {pays ? (infoPays?.intitule ?? `RÉPUBLIQUE DE ${pays}`).toUpperCase() : ""}
            </p>
            {armoiries && (
              <Image
                src={armoiries}
                alt={`Armoiries — ${pays}`}
                width={72}
                height={48}
                unoptimized
                priority
                className="mx-auto mt-1 h-12 w-[4.5rem] object-contain"
              />
            )}
            {slogan && <p className="mt-1 italic">{slogan}</p>}
            {etab.anneeScolaire && <p>Année Scolaire {etab.anneeScolaire}</p>}
          </div>
        </div>
        <hr className="my-3 border-cream-300" />
      </div>
    </>
  );
}

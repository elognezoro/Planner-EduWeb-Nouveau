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
  @page { size: A4 portrait; margin: 6mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .overflow-x-auto { overflow: visible !important; }
  table { width: 100% !important; min-width: 0 !important; table-layout: fixed; }
  thead th { padding: 1px 2px !important; font-size: 8px !important; }
  tbody td { padding: 0 2px !important; height: auto !important; vertical-align: top; }
  tbody td, tbody td * { font-size: 8px !important; line-height: 1.08 !important; }
  tbody td > div, tbody td > span { padding: 1px 2px !important; margin: 0 !important; }
  /* Neutralise les hauteurs fixes des cases (vides ou pleines) qui gonflaient les lignes. */
  tbody td, tbody td div, tbody td span { height: auto !important; min-height: 0 !important; }
  thead th:first-child, tbody td:first-child { width: 6.5% !important; white-space: nowrap; }
  tr { break-inside: avoid; }
  /* En-tête officiel et volumes compactés pour préserver la page unique. */
  .edt-entete-officiel img { height: 32px !important; width: auto !important; margin-top: 2px !important; }
  .edt-entete-officiel hr { margin: 3px 0 !important; }
  .edt-entete-officiel .font-display { font-size: 13px !important; }
  .edt-volumes { margin-top: 6px !important; padding-top: 4px !important; }
  .edt-volumes h3 { font-size: 10px !important; }
  .edt-volumes li, .edt-volumes p, .edt-volumes span { font-size: 9px !important; line-height: 1.25 !important; }
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
            {etab.sloganBulletin && <p className="mt-1 italic">{etab.sloganBulletin}</p>}
            {etab.anneeScolaire && <p>Année Scolaire {etab.anneeScolaire}</p>}
          </div>
        </div>
        <hr className="my-3 border-cream-300" />
      </div>
    </>
  );
}

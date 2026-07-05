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
      {/* Impression PAYSAGE, ajustée à UNE SEULE page : la grille des 5 jours occupe
          toute la largeur (plus de largeur minimale ni de défilement), la police et les
          marges internes sont compactées, et les couleurs des cours/pauses sont conservées. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .overflow-x-auto { overflow: visible !important; }
  table { width: 100% !important; min-width: 0 !important; table-layout: fixed; }
  thead th { padding: 3px 2px !important; font-size: 9px !important; }
  tbody td { padding: 2px 3px !important; }
  tbody td, tbody td * { font-size: 8.5px !important; line-height: 1.15 !important; }
  tbody td > div { padding: 2px 4px !important; }
  thead th:first-child, tbody td:first-child { width: 8% !important; }
  tr { break-inside: avoid; }
}`,
        }}
      />
      <div className="hidden print:block">
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

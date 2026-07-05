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
      {/* Emploi du temps imprimé en PAYSAGE (grille large sur 5 jours). */}
      <style
        dangerouslySetInnerHTML={{
          __html: "@media print { @page { size: A4 landscape; margin: 10mm; } }",
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

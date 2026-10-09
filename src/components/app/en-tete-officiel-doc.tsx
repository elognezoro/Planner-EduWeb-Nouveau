import Image from "next/image";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";
import type { EtablissementEnTete } from "@/components/app/emplois-du-temps/en-tete-officiel-edt";

/**
 * En-tête OFFICIEL générique d'un document d'établissement (ministère à gauche, titre au centre,
 * pile officielle du pays à droite : État, armoiries, devise, année scolaire). Visible à l'écran
 * ET à l'impression — sert à toute fiche officielle (autorisation d'absence, etc.).
 */
export function EnTeteOfficielDoc({
  etab,
  titre,
  sousTitre,
}: {
  etab: EtablissementEnTete;
  titre: string;
  sousTitre?: string;
}) {
  const pays = etab.pays ?? "";
  const infoPays = pays ? trouverPays(pays) : undefined;
  const ministere = etab.ministere || infoPays?.ministere || "";
  const slogan = infoPays?.devise || etab.sloganBulletin || "";
  const armoiries = etab.emblemeUrl ?? (infoPays ? armoiriesUrl(infoPays.code) : null);

  return (
    <div className="doc-entete-officiel">
      {/* Téléphone (écran seulement — le papier garde ses 3 colonnes) : le titre passe en tête sur
          toute la largeur, ministère et République se partagent la ligne suivante. */}
      <div className="grid grid-cols-3 items-start gap-2 mobile:grid-cols-2 mobile:gap-x-3 mobile:gap-y-2">
        <div className="text-[0.7rem] font-semibold uppercase leading-tight text-forest-900 mobile:min-w-0 mobile:text-xs mobile:leading-snug mobile:wrap-break-word">
          <p>{ministere}</p>
          <p className="mt-2 font-bold">{etab.nom}</p>
        </div>
        <div className="text-center mobile:order-first mobile:col-span-2 mobile:mb-1">
          <p className="font-display text-lg font-bold uppercase tracking-wide text-forest-900 mobile:text-base mobile:leading-snug mobile:tracking-normal mobile:wrap-break-word">{titre}</p>
          {sousTitre && <p className="text-sm font-semibold text-ink-800">{sousTitre}</p>}
        </div>
        <div className="text-center text-[0.7rem] leading-tight text-ink-700/80 mobile:min-w-0 mobile:text-xs mobile:leading-snug mobile:wrap-break-word">
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
              className="mx-auto mt-1 h-12 w-[4.5rem] object-contain mobile:h-10 mobile:w-15"
            />
          )}
          {slogan && <p className="mt-1 italic">{slogan}</p>}
          {etab.anneeScolaire && <p>Année Scolaire {etab.anneeScolaire}</p>}
        </div>
      </div>
      <hr className="my-3 border-cream-300" />
    </div>
  );
}

import Image from "next/image";
import { trouverPays } from "@/lib/referentiels/pays";

/** Aperçu de l'en-tête du bulletin (présentationnel, utilisable côté serveur et client). */
export function ApercuBulletin({
  ministere,
  regime,
  pays,
  slogan,
  annee,
  emblemeUrl,
}: {
  ministere: string;
  regime: string;
  pays: string;
  slogan: string;
  annee: string;
  /** Armoiries déposées à la configuration (Chef & documents officiels). */
  emblemeUrl?: string | null;
}) {
  const infoPays = pays ? trouverPays(pays) : undefined;
  // L'intitulé du ministère suit automatiquement le pays tant qu'il n'est pas personnalisé.
  const ministereAffiche = ministere || infoPays?.ministere || "";

  return (
    <div className="rounded-xl border border-dashed border-cream-300 bg-cream-50 px-5 py-4">
      <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-wider text-ink-700/45">
        Aperçu en-tête du bulletin
      </p>
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-3">
        <p className="text-[0.7rem] font-semibold uppercase leading-tight text-forest-900">
          {ministereAffiche || "Ministère de tutelle…"}
        </p>
        <div className="text-center">
          <p className="font-display text-base font-bold tracking-wide text-forest-900">
            BULLETIN DE NOTES
          </p>
          <p className="text-xs text-ink-700/70">{regime}</p>
        </div>
        {/* Pile officielle centrée sur un même axe vertical : État, armoiries, devise, année. */}
        <div className="text-center text-[0.7rem] leading-tight text-ink-700/70">
          <p className="font-semibold text-forest-900">
            {pays ? (infoPays?.intitule ?? `RÉPUBLIQUE DE ${pays}`).toUpperCase() : ""}
          </p>
          {/* Armoiries du pays, entre l'intitulé de l'État et la devise (si déposées). */}
          {emblemeUrl && (
            <Image
              src={emblemeUrl}
              alt={`Armoiries — ${pays}`}
              width={72}
              height={48}
              unoptimized
              className="mx-auto mt-1 h-12 w-[4.5rem] object-contain"
            />
          )}
          {slogan && <p className="mt-1 italic">{slogan}</p>}
          {annee && <p>Année Scolaire {annee}</p>}
        </div>
      </div>
    </div>
  );
}

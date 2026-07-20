import Image from "next/image";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";

/**
 * Vignette en LECTURE des armoiries nationales — PAS un champ de saisie (à la différence du
 * CAFOP, qui autorise un dépôt personnalisé) : le PAYS CONSULTÉ dans la barre du haut détermine
 * automatiquement les armoiries (exigence client — repli sur le pays de la région de l'APFC si
 * aucun pays n'est consulté), à l'image de l'en-tête officiel des établissements
 * (`EnTeteOfficielDoc`, `src/lib/referentiels/pays.ts`). Résolution : `paysEffectifApfc()`.
 */
export function ArmoiriesApfc({ pays, parRegion }: { pays: string; parRegion: boolean }) {
  const code = trouverPays(pays)?.code;
  return (
    <div>
      <p className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-700/60">
        Armoiries du pays
        <span className="inline-flex items-center rounded-full bg-gold-100 px-2 py-0.5 text-[0.65rem] font-semibold normal-case tracking-normal text-gold-800 ring-1 ring-gold-300">
          Implémentées automatiquement selon le pays
        </span>
      </p>
      <div className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cream-300 bg-cream-50/40 p-3">
        {code ? (
          <>
            <Image src={armoiriesUrl(code)} alt={`Armoiries — ${pays}`} width={72} height={48} unoptimized className="h-14 w-auto object-contain" />
            <span className="text-xs font-medium text-ink-700/70">Armoiries de {pays}</span>
          </>
        ) : (
          <span className="px-3 text-center text-xs text-ink-700/50">Pays inconnu — armoiries indisponibles.</span>
        )}
      </div>
      {/* Le pays consulté dans la barre du haut PRIME (exigence client) ; `parRegion` = vrai
          uniquement quand aucun pays n'est consulté et que la région de l'APFC a servi de repli. */}
      <p className="mt-1.5 text-[0.65rem] leading-tight text-ink-700/55">
        {parRegion
          ? "Déterminées par la région de rattachement de l'APFC (aucun pays consulté dans la barre du haut)."
          : "Déterminées par le pays sélectionné dans la barre du haut — elles changent automatiquement avec lui."}
      </p>
    </div>
  );
}

import Image from "next/image";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";

/**
 * Vignette en LECTURE des armoiries nationales — PAS un champ de saisie (à la différence du
 * CAFOP, qui autorise un dépôt personnalisé) : le pays de l'APFC (celui de sa région, ou le
 * pays consulté à défaut — voir la page de détail) déterminent automatiquement les armoiries
 * affichées sur ses documents officiels, à l'image de l'en-tête officiel des établissements
 * (`EnTeteOfficielDoc`, `src/lib/referentiels/pays.ts`).
 */
export function ArmoiriesApfc({ pays }: { pays: string }) {
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
    </div>
  );
}

"use client";

/**
 * Sélecteur d'ÉTABLISSEMENT de la page Finances — réservé aux rôles à portée
 * supra-établissement dotés de droits Finance (admin système au premier chef, liste bornée
 * côté SERVEUR au pays consulté). La sélection recharge la page via le searchParam
 * `?etablissement=<id>` (état serveur, pas d'état client) ; le contrôle d'appartenance au
 * périmètre reste STRICTEMENT côté serveur (page + garde exigerPermissionFinance).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Search } from "lucide-react";
import { Card } from "@/components/app/ui";

export function SelecteurEtablissementFinances({
  etablissements,
  valeur,
}: {
  etablissements: { id: string; nom: string; ville?: string | null }[];
  valeur: string | null;
}) {
  const router = useRouter();
  const actuel = useMemo(
    () => etablissements.find((e) => e.id === valeur) ?? null,
    [etablissements, valeur],
  );
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState(false);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const base = q
      ? etablissements.filter(
          (e) => e.nom.toLowerCase().includes(q) || (e.ville ?? "").toLowerCase().includes(q),
        )
      : etablissements;
    return base.slice(0, 30);
  }, [etablissements, recherche]);

  function choisir(id: string) {
    setOuvert(false);
    setRecherche("");
    router.push(`/app/vie-scolaire/finances?etablissement=${encodeURIComponent(id)}`);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-forest-900">
          <Building2 size={16} className="text-forest-600" />
          {actuel ? (
            <>Finances de : <span className="rounded-full bg-forest-50 px-3 py-1">{actuel.nom}</span></>
          ) : (
            "Choisissez un établissement pour consulter ses finances."
          )}
        </p>
        <div className="relative min-w-[280px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            value={recherche}
            placeholder={actuel ? "Changer d'établissement…" : "Rechercher un établissement (nom, ville)…"}
            autoComplete="off"
            onFocus={() => setOuvert(true)}
            onChange={(e) => {
              setRecherche(e.target.value);
              setOuvert(true);
            }}
            onBlur={() => setTimeout(() => setOuvert(false), 150)}
            className="w-full rounded-2xl border border-cream-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
          {ouvert && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-cream-200 bg-white p-1 shadow-soft">
              {filtres.length === 0 ? (
                <p className="px-3 py-2 text-sm text-ink-700/55">Aucun établissement trouvé dans le pays consulté.</p>
              ) : (
                filtres.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => choisir(e.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-forest-50"
                  >
                    <span className="font-medium text-forest-900">{e.nom}</span>
                    {e.ville && <span className="text-xs text-ink-700/55">{e.ville}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

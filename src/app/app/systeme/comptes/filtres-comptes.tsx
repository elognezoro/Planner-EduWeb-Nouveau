"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { Card } from "@/components/app/ui";

export interface ValeursFiltres {
  q: string;
  role: string;
  statut: string;
  pays: string;
  etab: string;
  cohorte: string;
  /** Filtre d'approbation de rôle : "" | approuves | 7j | 30j | date | periode. */
  app: string;
  /** Date (mode « date ») ou début de période (mode « periode ») — ISO yyyy-mm-dd. */
  appDu: string;
  /** Fin de période (mode « periode ») — ISO yyyy-mm-dd. */
  appAu: string;
  taille: number;
}

export interface OptionsFiltres {
  roles: { v: string; l: string }[];
  pays: string[];
  etablissements: { id: string; nom: string }[];
  cohortes: string[];
}

function construireUrl(base: string, v: Partial<ValeursFiltres> & { page?: number }): string {
  const p = new URLSearchParams();
  if (v.q) p.set("q", v.q);
  if (v.role) p.set("role", v.role);
  if (v.statut) p.set("statut", v.statut);
  if (v.pays) p.set("pays", v.pays);
  if (v.etab) p.set("etab", v.etab);
  if (v.cohorte) p.set("cohorte", v.cohorte);
  if (v.app) p.set("app", v.app);
  // Dates d'approbation : utiles seulement pour les modes « date » et « periode ».
  if (v.app === "date" || v.app === "periode") {
    if (v.appDu) p.set("appDu", v.appDu);
    if (v.app === "periode" && v.appAu) p.set("appAu", v.appAu);
  }
  if (v.taille && v.taille !== 10) p.set("taille", String(v.taille));
  if (v.page && v.page > 1) p.set("page", String(v.page));
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

const classeSelect =
  "h-11 rounded-full border border-cream-300 bg-white px-4 pr-8 text-sm text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

/** Barre FILTRES : cinq listes auto-appliquées (rôles, statuts, pays, établissements, cohortes). */
export function FiltresComptes({
  base,
  valeurs,
  options,
}: {
  base: string;
  valeurs: ValeursFiltres;
  options: OptionsFiltres;
}) {
  const router = useRouter();
  const appliquer = (maj: Partial<ValeursFiltres>) =>
    router.push(construireUrl(base, { ...valeurs, ...maj, page: 1 }));
  const filtreActif = Boolean(
    valeurs.role || valeurs.statut || valeurs.pays || valeurs.etab || valeurs.cohorte || valeurs.q || valeurs.app,
  );

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-700/55">
          <SlidersHorizontal size={14} /> Filtres
        </span>
        <select value={valeurs.role} onChange={(e) => appliquer({ role: e.target.value })} className={classeSelect} aria-label="Filtrer par rôle">
          <option value="">Tous les rôles</option>
          {options.roles.map((r) => (
            <option key={r.v} value={r.v}>
              {r.l}
            </option>
          ))}
        </select>
        <select value={valeurs.statut} onChange={(e) => appliquer({ statut: e.target.value })} className={classeSelect} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="en_attente_verification">E-mail non confirmé</option>
          <option value="suspendu">Suspendu</option>
          <option value="archive">Archivé</option>
        </select>
        <select value={valeurs.pays} onChange={(e) => appliquer({ pays: e.target.value })} className={classeSelect} aria-label="Filtrer par pays">
          <option value="">Tous les pays</option>
          {options.pays.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={valeurs.etab} onChange={(e) => appliquer({ etab: e.target.value })} className={`${classeSelect} max-w-[16rem]`} aria-label="Filtrer par établissement">
          <option value="">Tous les établissements</option>
          {options.etablissements.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nom}
            </option>
          ))}
        </select>
        <select value={valeurs.cohorte} onChange={(e) => appliquer({ cohorte: e.target.value })} className={classeSelect} aria-label="Filtrer par cohorte">
          <option value="">Toutes les cohortes</option>
          {options.cohortes.map((c) => (
            <option key={c} value={c}>
              Cohorte {c}
            </option>
          ))}
        </select>
        {/* Approbations de rôle : récentes, à une date, sur une période (date d'approbation traiteLe). */}
        <select
          value={valeurs.app}
          onChange={(e) => appliquer({ app: e.target.value, appDu: "", appAu: "" })}
          className={classeSelect}
          aria-label="Filtrer par approbation de rôle"
        >
          <option value="">Toutes les approbations</option>
          <option value="approuves">Comptes approuvés (toutes dates)</option>
          <option value="7j">Approbations récentes (7 jours)</option>
          <option value="30j">Approbations récentes (30 jours)</option>
          <option value="date">Approbations à une date…</option>
          <option value="periode">Approbations sur une période…</option>
        </select>
        {(valeurs.app === "date" || valeurs.app === "periode") && (
          <span className="inline-flex items-center gap-2 rounded-full border border-cream-300 bg-white px-3 text-sm text-forest-900">
            <input
              type="date"
              value={valeurs.appDu}
              max={valeurs.app === "periode" ? valeurs.appAu || undefined : undefined}
              onChange={(e) => appliquer({ appDu: e.target.value })}
              aria-label={valeurs.app === "date" ? "Date d'approbation" : "Approbations à partir du"}
              className="h-11 min-w-0 bg-transparent outline-none"
            />
            {valeurs.app === "periode" && (
              <>
                <span className="shrink-0 text-ink-700/40">→</span>
                <input
                  type="date"
                  value={valeurs.appAu}
                  min={valeurs.appDu || undefined}
                  onChange={(e) => appliquer({ appAu: e.target.value })}
                  aria-label="Approbations jusqu'au"
                  className="h-11 min-w-0 bg-transparent outline-none"
                />
              </>
            )}
          </span>
        )}
        {filtreActif && (
          <button
            type="button"
            onClick={() => router.push(base)}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-cream-300 px-3 text-xs font-medium text-ink-700/60 hover:bg-red-50 hover:text-red-600"
          >
            <X size={13} /> Réinitialiser
          </button>
        )}
      </div>
    </Card>
  );
}

/**
 * Recherche d'utilisateur — champ dédié sous la barre de filtres. La liste se filtre
 * au fur et à mesure de la frappe (300 ms après la dernière lettre) ; Entrée force
 * l'application immédiate.
 */
export function RechercheComptes({ base, valeurs }: { base: string; valeurs: ValeursFiltres }) {
  const router = useRouter();
  const [q, setQ] = useState(valeurs.q);
  const [enCours, demarrer] = useTransition();
  // Dernière valeur poussée dans l'URL par CE champ : distingue nos propres mises à jour
  // d'un changement externe (bouton Réinitialiser, navigation), qu'on adopte alors.
  const dernierePoussee = useRef(valeurs.q);

  useEffect(() => {
    if (valeurs.q !== dernierePoussee.current) {
      dernierePoussee.current = valeurs.q;
      setQ(valeurs.q);
    }
  }, [valeurs.q]);

  const appliquer = (terme: string, immediat = false) => {
    dernierePoussee.current = terme;
    demarrer(() => {
      const url = construireUrl(base, { ...valeurs, q: terme, page: 1 });
      if (immediat) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    });
  };

  // Filtrage en continu : on applique la saisie 300 ms après la dernière frappe.
  useEffect(() => {
    const terme = q.trim();
    if (terme === valeurs.q) return;
    const t = setTimeout(() => appliquer(terme), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative w-full max-w-sm">
      {enCours ? (
        <Loader2 size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 animate-spin text-forest-600" />
      ) : (
        <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") appliquer(q.trim(), true);
        }}
        placeholder="Rechercher un utilisateur..."
        className="h-12 w-full rounded-full border border-cream-300 bg-white pl-10 pr-9 text-sm shadow-sm outline-none placeholder:text-ink-700/45 focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            appliquer("");
          }}
          aria-label="Effacer la recherche"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-700/45 hover:bg-cream-100 hover:text-ink-700/70"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Pagination : « Afficher N par page · X élément(s) » + navigation de pages. */
export function PaginationComptes({
  base,
  valeurs,
  page,
  pages,
  total,
}: {
  base: string;
  valeurs: ValeursFiltres;
  page: number;
  pages: number;
  total: number;
}) {
  const router = useRouter();
  const aller = (p: number) => router.push(construireUrl(base, { ...valeurs, page: Math.min(Math.max(1, p), pages) }));

  // Fenêtre de 6 numéros autour de la page courante.
  const debut = Math.max(1, Math.min(page - 2, pages - 5));
  const numeros = Array.from({ length: Math.min(6, pages) }, (_, i) => debut + i);

  const bouton =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-cream-300 bg-white px-2 text-sm text-forest-900 transition-colors hover:bg-forest-50 disabled:opacity-40 disabled:hover:bg-white";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
      <p className="flex items-center gap-2 text-sm text-ink-700/65">
        Afficher
        <select
          value={valeurs.taille}
          onChange={(e) => router.push(construireUrl(base, { ...valeurs, taille: Number(e.target.value), page: 1 }))}
          className="h-9 rounded-full border border-cream-300 bg-white px-3 pr-7 text-sm outline-none focus:border-forest-400"
          aria-label="Taille de page"
        >
          {[10, 25, 50, 100].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        par page · {total.toLocaleString("fr-FR")} élément(s)
      </p>

      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
          <button onClick={() => aller(1)} disabled={page === 1} className={bouton} aria-label="Première page">
            <ChevronsLeft size={15} />
          </button>
          <button onClick={() => aller(page - 1)} disabled={page === 1} className={bouton} aria-label="Page précédente">
            <ChevronLeft size={15} />
          </button>
          {numeros.map((n) => (
            <button
              key={n}
              onClick={() => aller(n)}
              aria-current={n === page ? "page" : undefined}
              className={
                n === page
                  ? "inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-forest-800 px-2 text-sm font-semibold text-cream-50"
                  : bouton
              }
            >
              {n}
            </button>
          ))}
          <button onClick={() => aller(page + 1)} disabled={page === pages} className={bouton} aria-label="Page suivante">
            <ChevronRight size={15} />
          </button>
          <button onClick={() => aller(pages)} disabled={page === pages} className={bouton} aria-label="Dernière page">
            <ChevronsRight size={15} />
          </button>
        </nav>
      )}
    </div>
  );
}

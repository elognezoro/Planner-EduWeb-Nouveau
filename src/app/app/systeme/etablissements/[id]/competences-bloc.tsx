"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, Loader2, Save, Search, Users } from "lucide-react";
import { enregistrerCompetencesLot } from "./enseignants/actions";

export interface EnseignantCompetences {
  id: string;
  nom: string; // nom affiché complet
  disciplines: string[]; // disciplineIds attribués
  niveaux: string[]; // niveauIds d'intervention
}

export interface DisciplineOption {
  id: string;
  nom: string;
  couleur: string | null;
}

/** Retire les accents et met en minuscules (recherche). */
function plat(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface EtatCycles {
  premier: boolean;
  second: boolean;
}

/**
 * Bloc « Compétences des enseignants » : recherche instantanée par mot-clé (nom ou
 * discipline), liste déroulante à choix multiples pour les disciplines, et cycles
 * d'intervention (« 1er cycle » / « 2nd cycle »). Les modifications s'appliquent
 * d'un coup avec « Enregistrer les compétences ».
 */
export function CompetencesBloc({
  etablissementId,
  enseignants,
  disciplines,
  niveauxPremierCycle,
  niveauxSecondCycle,
}: {
  etablissementId: string;
  enseignants: EnseignantCompetences[];
  disciplines: DisciplineOption[];
  /** Ids des niveaux du 1er cycle (collège) et du 2nd cycle (lycée). */
  niveauxPremierCycle: string[];
  niveauxSecondCycle: string[];
}) {
  const [q, setQ] = useState("");
  // Attributions locales, initialisées depuis le serveur — appliquées à l'enregistrement.
  const [attributions, setAttributions] = useState<Map<string, Set<string>>>(
    () => new Map(enseignants.map((e) => [e.id, new Set(e.disciplines)])),
  );
  const setPremier = useMemo(() => new Set(niveauxPremierCycle), [niveauxPremierCycle]);
  const setSecond = useMemo(() => new Set(niveauxSecondCycle), [niveauxSecondCycle]);
  const [cycles, setCycles] = useState<Map<string, EtatCycles>>(
    () =>
      new Map(
        enseignants.map((e) => [
          e.id,
          {
            premier: e.niveaux.some((n) => setPremier.has(n)),
            second: e.niveaux.some((n) => setSecond.has(n)),
          },
        ]),
      ),
  );
  const [modifies, setModifies] = useState<Set<string>>(new Set());
  const [ouvertPour, setOuvertPour] = useState<string | null>(null); // liste déroulante ouverte
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enregistrement, demarrer] = useTransition();
  const conteneurOuvert = useRef<HTMLDivElement | null>(null);

  // Fermeture de la liste déroulante au clic extérieur / Échap.
  useEffect(() => {
    if (!ouvertPour) return;
    const surClic = (ev: MouseEvent) => {
      if (conteneurOuvert.current && !conteneurOuvert.current.contains(ev.target as Node)) {
        setOuvertPour(null);
      }
    };
    const surTouche = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOuvertPour(null);
    };
    document.addEventListener("mousedown", surClic);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouvertPour]);

  const nomDiscipline = useMemo(() => new Map(disciplines.map((d) => [d.id, d.nom])), [disciplines]);

  // Recherche instantanée par mot-clé : nom de l'enseignant OU disciplines attribuées.
  const visibles = useMemo(() => {
    const termes = plat(q).split(/\s+/).filter(Boolean);
    if (termes.length === 0) return enseignants;
    return enseignants.filter((e) => {
      const attribuees = [...(attributions.get(e.id) ?? [])]
        .map((id) => nomDiscipline.get(id) ?? "")
        .join(" ");
      const cible = plat(`${e.nom} ${attribuees}`);
      return termes.every((t) => cible.includes(t));
    });
  }, [enseignants, q, attributions, nomDiscipline]);

  function marquer(enseignantId: string) {
    setModifies((prev) => new Set(prev).add(enseignantId));
    setRetour(null);
  }

  function basculerDiscipline(enseignantId: string, disciplineId: string) {
    const actuel = new Set(attributions.get(enseignantId) ?? []);
    if (actuel.has(disciplineId)) actuel.delete(disciplineId);
    else actuel.add(disciplineId);
    setAttributions((prev) => new Map(prev).set(enseignantId, actuel));
    marquer(enseignantId);
  }

  function basculerCycle(enseignantId: string, cycle: keyof EtatCycles) {
    const actuel = cycles.get(enseignantId) ?? { premier: false, second: false };
    setCycles((prev) => new Map(prev).set(enseignantId, { ...actuel, [cycle]: !actuel[cycle] }));
    marquer(enseignantId);
  }

  function enregistrer() {
    if (modifies.size === 0) return;
    demarrer(async () => {
      const fd = new FormData();
      fd.set("etablissementId", etablissementId);
      fd.set(
        "modifications",
        JSON.stringify(
          [...modifies].map((enseignantId) => {
            const c = cycles.get(enseignantId) ?? { premier: false, second: false };
            return {
              enseignantId,
              disciplineIds: [...(attributions.get(enseignantId) ?? [])],
              niveauIds: [
                ...(c.premier ? niveauxPremierCycle : []),
                ...(c.second ? niveauxSecondCycle : []),
              ],
            };
          }),
        ),
      );
      const res = await enregistrerCompetencesLot({ ok: false }, fd);
      setRetour({ ok: res.ok, texte: res.message ?? "Erreur technique." });
      if (res.ok) setModifies(new Set());
    });
  }

  const nbAvecDisciplines = enseignants.filter((e) => (attributions.get(e.id)?.size ?? 0) > 0).length;

  // Point des effectifs par spécialité : chaque discipline attribuée compte pour ses
  // spécialités élémentaires (un couple « X / Y » vaut deux spécialités). Monovalent =
  // une seule spécialité ; bivalent = deux (couple attribué ou deux disciplines simples).
  const bilan = useMemo(() => {
    const monovalents = new Map<string, number>();
    const bivalents = new Map<string, number>();
    let polyvalents = 0;
    let sansSpecialite = 0;
    for (const e of enseignants) {
      const elementaires = [...(attributions.get(e.id) ?? new Set<string>())]
        .flatMap((id) => (nomDiscipline.get(id) ?? "").split("/"))
        .map((s) => s.trim())
        .filter(Boolean);
      const uniques = [...new Set(elementaires)].sort((a, b) => a.localeCompare(b, "fr"));
      if (uniques.length === 0) sansSpecialite += 1;
      else if (uniques.length === 1) {
        monovalents.set(uniques[0], (monovalents.get(uniques[0]) ?? 0) + 1);
      } else if (uniques.length === 2) {
        const cle = uniques.join(" / ");
        bivalents.set(cle, (bivalents.get(cle) ?? 0) + 1);
      } else polyvalents += 1;
    }
    const trier = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
    const total = (m: Map<string, number>) => [...m.values()].reduce((acc, v) => acc + v, 0);
    return {
      monovalents: trier(monovalents),
      bivalents: trier(bivalents),
      totalMonovalents: total(monovalents),
      totalBivalents: total(bivalents),
      polyvalents,
      sansSpecialite,
    };
  }, [enseignants, attributions, nomDiscipline]);

  return (
    <div>
      {/* Bilan + lien vers la gestion détaillée niveau par niveau */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm text-ink-700/75">
          <span>
            <strong className="text-forest-900">{enseignants.length}</strong> enseignant(s)
          </span>
          <span>
            <strong className="text-forest-900">{nbAvecDisciplines}</strong> avec disciplines
          </span>
        </div>
        <Link
          href={`/app/systeme/etablissements/${etablissementId}/enseignants`}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50"
        >
          <Users size={15} /> Réglage fin niveau par niveau
        </Link>
      </div>

      {/* Recherche instantanée par mot-clé (nom ou discipline) */}
      <div className="relative mb-3 max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Recherche rapide (nom, discipline)…"
          className="h-11 w-full rounded-full border border-cream-300 bg-white pl-10 pr-4 text-sm outline-none placeholder:text-ink-700/45 focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </div>

      {retour && (
        <p className={`mb-3 text-sm font-medium ${retour.ok ? "text-forest-700" : "text-red-600"}`}>
          {retour.texte}
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-700/55">
          Aucun enseignant ne correspond à « {q} ».
        </p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-cream-100 overflow-y-auto pr-1">
          {visibles.map((e) => {
            const actives = attributions.get(e.id) ?? new Set<string>();
            const c = cycles.get(e.id) ?? { premier: false, second: false };
            const nomsActifs = [...actives].map((id) => nomDiscipline.get(id)).filter(Boolean);
            const ouvert = ouvertPour === e.id;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <span className="flex w-52 min-w-0 shrink-0 items-center gap-2">
                  <span className="truncate font-medium text-forest-900">{e.nom}</span>
                  {modifies.has(e.id) && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-gold-500"
                      title="Modifications non enregistrées"
                    />
                  )}
                </span>

                {/* Disciplines : liste déroulante à choix multiples */}
                <div ref={ouvert ? conteneurOuvert : undefined} className="relative w-72 min-w-0">
                  <button
                    type="button"
                    onClick={() => setOuvertPour(ouvert ? null : e.id)}
                    aria-haspopup="listbox"
                    aria-expanded={ouvert}
                    className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-cream-300 bg-white px-3 text-left text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  >
                    <span className={`truncate ${nomsActifs.length ? "text-ink-900" : "text-ink-700/50"}`}>
                      {nomsActifs.length ? nomsActifs.join(", ") : "Choisir les disciplines…"}
                    </span>
                    <ChevronDown size={15} className={`shrink-0 text-ink-700/45 transition-transform ${ouvert ? "rotate-180" : ""}`} />
                  </button>
                  {ouvert && (
                    <ul
                      role="listbox"
                      aria-multiselectable="true"
                      className="absolute left-0 right-0 z-30 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-cream-200 bg-white py-1 shadow-soft"
                    >
                      {disciplines.map((d) => {
                        const active = actives.has(d.id);
                        return (
                          <li key={d.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => basculerDiscipline(e.id, d.id)}
                              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-forest-50 ${
                                active ? "font-semibold text-forest-900" : "text-ink-800"
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  active ? "border-forest-600 bg-forest-600 text-white" : "border-cream-300 bg-white"
                                }`}
                              >
                                {active && <Check size={11} />}
                              </span>
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: d.couleur ?? "#999" }}
                              />
                              {d.nom}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Niveaux d'intervention : 1er / 2nd cycle */}
                <span className="flex shrink-0 gap-1.5">
                  {(
                    [
                      { cle: "premier" as const, libelle: "1er cycle" },
                      { cle: "second" as const, libelle: "2nd cycle" },
                    ]
                  ).map(({ cle, libelle }) => {
                    const actif = c[cle];
                    return (
                      <button
                        key={cle}
                        type="button"
                        onClick={() => basculerCycle(e.id, cle)}
                        aria-pressed={actif}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          actif
                            ? "border-transparent bg-forest-700 text-cream-50"
                            : "border-cream-300 bg-white text-ink-700/65 hover:border-forest-300 hover:text-forest-800"
                        }`}
                      >
                        {actif && <Check size={11} />}
                        {libelle}
                      </button>
                    );
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Enregistrement explicite du bloc : applique toutes les modifications d'un coup. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-cream-100 pt-4">
        <button
          type="button"
          onClick={enregistrer}
          disabled={enregistrement || modifies.size === 0}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
        >
          {enregistrement ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Enregistrer les compétences
        </button>
        {modifies.size > 0 && !enregistrement && (
          <span className="text-xs font-medium text-gold-700">
            {modifies.size} enseignant(s) modifié(s) — non enregistré(s)
          </span>
        )}
      </div>

      {/* Point des effectifs d'enseignants par spécialité : bilan des compétences de
          l'établissement avant la génération des emplois du temps. */}
      <div className="mt-5 border-t border-cream-100 pt-4">
        <h3 className="font-display text-base font-bold text-forest-900">
          Point des effectifs par spécialité
        </h3>
        <p className="mt-0.5 text-xs text-ink-700/55">
          Bilan des compétences de l&apos;établissement avant la génération des emplois du temps
          {modifies.size > 0 ? " — tient compte des modifications non enregistrées" : ""}.
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(
            [
              {
                titre: "Monovalents",
                sousTitre: "une seule spécialité",
                lignes: bilan.monovalents,
                total: bilan.totalMonovalents,
              },
              {
                titre: "Bivalents",
                sousTitre: "deux spécialités",
                lignes: bilan.bivalents,
                total: bilan.totalBivalents,
              },
            ] as const
          ).map(({ titre, sousTitre, lignes, total }) => (
            <div key={titre} className="rounded-2xl border border-cream-200 bg-cream-50/60 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-forest-900">
                  {titre} <span className="font-normal text-ink-700/55">({sousTitre})</span>
                </p>
                <span className="rounded-full bg-forest-800 px-2.5 py-0.5 text-xs font-bold text-cream-50">
                  {total}
                </span>
              </div>
              {lignes.length === 0 ? (
                <p className="mt-2 text-sm text-ink-700/50">Aucun enseignant.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {lignes.map(([specialite, effectif]) => (
                    <li
                      key={specialite}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 text-ink-800">{specialite}</span>
                      <span className="shrink-0 font-semibold text-forest-800">{effectif}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {(bilan.polyvalents > 0 || bilan.sansSpecialite > 0) && (
          <p className="mt-2.5 text-xs text-ink-700/60">
            {bilan.polyvalents > 0 && (
              <span>
                <strong className="text-forest-900">{bilan.polyvalents}</strong> enseignant(s) à
                trois spécialités ou plus.
              </span>
            )}{" "}
            {bilan.sansSpecialite > 0 && (
              <span>
                <strong className="text-forest-900">{bilan.sansSpecialite}</strong> enseignant(s)
                sans spécialité attribuée.
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

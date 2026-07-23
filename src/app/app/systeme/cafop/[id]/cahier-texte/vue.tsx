"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, BookText, Clock, Target, ListTree, X, Loader2, CalendarClock, Dumbbell, Link2, ChevronDown } from "lucide-react";
import { creerSeanceCafop, supprimerSeanceCafop, type EtatForm } from "@/lib/formation/actions";
import { grouperParCompetence, type ComposanteModule } from "@/lib/formation/structure-module";
import { FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };
const champCls = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const NIVEAUX = [1, 2, 3];

// Casse « live » : le titre en MAJUSCULES ; sous-titres et objectifs avec seulement la 1re lettre en majuscule.
const majLive = (s: string) => s.toUpperCase();
const phraseLive = (s: string) => (s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

export interface SousTitre { niveau: number; texte: string }
/** Composante d'un module (compétence FACULTATIVE au-dessus) — forme partagée structure-module.ts. */
export type Composante = ComposanteModule;
export interface ModuleAvecComposantes { id: string; nom: string; composantes: Composante[] }

export interface SeanceVue {
  id: string;
  dateLabel: string;
  moduleNom: string | null;
  groupe: string | null;
  discipline: string | null;
  composante: string | null;
  theme: string | null;
  /** Sélection multiple (habiletés) — Json tableau ; prioritaire sur composante/theme quand renseignée. */
  composantes?: unknown;
  themes?: unknown;
  heureLabel: string | null;
  titre: string;
  sousTitres: SousTitre[];
  objectifs: string[];
  contenu: string | null;
  prochaineSeanceLabel: string | null;
  exercices: string | null;
  exercicesUrl: string | null;
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-forest-900">{label}</span>
      {children}
    </label>
  );
}

/**
 * Liste déroulante à choix multiples : bouton (compteur « n sélectionnée(s) ») qui ouvre un
 * panneau de cases à cocher, fermeture au clic extérieur. Chaque valeur cochée émet un
 * <input type="hidden"> répété portant `name`, pour une soumission de formulaire classique.
 * Les options sont fournies par SECTIONS : un `titre` non nul (ex. la COMPÉTENCE des
 * composantes, pour les modules type TICE) est affiché en sous-titre au-dessus de ses options ;
 * une section unique au titre null reproduit la liste plate d'avant.
 */
function ListeDeroulanteMultiple({
  label,
  name,
  sections,
  valeurs,
  onChange,
  placeholderVide,
}: {
  label: string;
  name: string;
  sections: { titre: string | null; options: string[] }[];
  valeurs: string[];
  onChange: (v: string[]) => void;
  placeholderVide: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);
  const desactive = sections.every((s) => s.options.length === 0);

  useEffect(() => {
    if (!ouvert) return;
    function surClicExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [ouvert]);

  function basculer(v: string) {
    onChange(valeurs.includes(v) ? valeurs.filter((x) => x !== v) : [...valeurs, v]);
  }

  return (
    <Champ label={label}>
      <div ref={conteneurRef} className="relative">
        {valeurs.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
        <button
          type="button"
          disabled={desactive}
          onClick={() => setOuvert((o) => !o)}
          className={`${champCls} flex items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <span className={`truncate ${valeurs.length === 0 ? "text-ink-700/45" : "text-ink-700/85"}`}>
            {desactive ? placeholderVide : valeurs.length === 0 ? "—" : `${valeurs.length} sélectionnée${valeurs.length > 1 ? "s" : ""}`}
          </span>
          <ChevronDown size={15} className="shrink-0 text-ink-700/40" />
        </button>
        {ouvert && !desactive && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-cream-300 bg-white p-1.5 shadow-soft">
            {sections.map((s, si) => (
              <div key={s.titre ?? `section-${si}`}>
                {s.titre && (
                  <p className="px-2 pb-0.5 pt-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-gold-800">{s.titre}</p>
                )}
                {s.options.map((o) => (
                  <label key={o} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-cream-50 ${s.titre ? "ml-2" : ""}`}>
                    <input type="checkbox" checked={valeurs.includes(o)} onChange={() => basculer(o)} className="h-4 w-4 rounded border-cream-300 text-forest-700 focus:ring-forest-300" />
                    <span className="text-ink-700/85">{o}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </Champ>
  );
}

/**
 * Formulaire de saisie d'une séance. Remonté via `key` après un enregistrement réussi
 * (la clé change avec le nombre de séances) pour se vider automatiquement.
 */
function FormulaireSeance({
  cafopId,
  modules,
  groupes,
  disciplines,
  action,
  pending,
}: {
  cafopId: string;
  modules: ModuleAvecComposantes[];
  groupes: string[];
  disciplines: string[];
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const [discipline, setDiscipline] = useState("");
  // Cascade Module → Composantes → Thèmes (structure définie dans « Gestion des modules »).
  // Composantes et thèmes sont désormais des sélections MULTIPLES (habiletés visées).
  const [moduleId, setModuleId] = useState("");
  const [composantesSel, setComposantesSel] = useState<string[]>([]);
  const [themesSel, setThemesSel] = useState<string[]>([]);
  const [sousTitres, setSousTitres] = useState<SousTitre[]>([]);
  const [objectifs, setObjectifs] = useState<string[]>([]);

  const composantesDuModule = useMemo(
    () => modules.find((m) => m.id === moduleId)?.composantes ?? [],
    [modules, moduleId],
  );
  // Thèmes proposés : ceux des composantes cochées, ou tous les thèmes du module si aucune n'est cochée.
  const themesDisponibles = useMemo(() => {
    const base = composantesSel.length > 0 ? composantesDuModule.filter((c) => composantesSel.includes(c.nom)) : composantesDuModule;
    return [...new Set(base.flatMap((c) => c.themes))];
  }, [composantesDuModule, composantesSel]);

  function surChangementModule(id: string) {
    setModuleId(id);
    setComposantesSel([]);
    setThemesSel([]);
  }

  function surChangementComposantes(v: string[]) {
    setComposantesSel(v);
    // Ne conserve que les thèmes encore proposés compte tenu des composantes cochées.
    const base = v.length > 0 ? composantesDuModule.filter((c) => v.includes(c.nom)) : composantesDuModule;
    const disponibles = new Set(base.flatMap((c) => c.themes));
    setThemesSel((prev) => prev.filter((t) => disponibles.has(t)));
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="cafopId" value={cafopId} />
      <input type="hidden" name="sousTitres" value={JSON.stringify(sousTitres)} />
      <input type="hidden" name="objectifs" value={JSON.stringify(objectifs)} />

      {/* Discipline — champ indépendant, sur sa propre ligne avant le module */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Champ label="Discipline">
          <input name="discipline" value={discipline} onChange={(e) => setDiscipline(e.target.value)} list="cafop-disciplines" placeholder="Discipline" className={champCls} />
          <datalist id="cafop-disciplines">{disciplines.map((d) => <option key={d} value={d} />)}</datalist>
        </Champ>
      </div>

      {/* Cascade Module → Composantes → Thèmes (choix multiples) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Champ label="Module">
          <select name="moduleId" value={moduleId} onChange={(e) => surChangementModule(e.target.value)} className={champCls}>
            <option value="">—</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </Champ>
        <ListeDeroulanteMultiple
          label="Composantes (habiletés)"
          name="composantes"
          // Composantes regroupées sous leur COMPÉTENCE quand le module en a (ex. TICE) —
          // regroupement partagé `grouperParCompetence`, liste plate inchangée sinon.
          sections={grouperParCompetence(composantesDuModule).map((g) => ({ titre: g.competence, options: g.composantes.map((c) => c.nom) }))}
          valeurs={composantesSel}
          onChange={surChangementComposantes}
          placeholderVide={!moduleId ? "— (choisir un module)" : "— (aucune : à définir dans Gestion des modules)"}
        />
        <ListeDeroulanteMultiple
          label="Thèmes"
          name="themes"
          sections={[{ titre: null, options: themesDisponibles }]}
          valeurs={themesSel}
          onChange={setThemesSel}
          placeholderVide={!moduleId ? "— (choisir un module)" : "— (aucun thème)"}
        />
      </div>

      {/* Date, horaires, groupe */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Champ label="Date"><input name="date" type="date" required className={champCls} /></Champ>
        <Champ label="Heure de début"><input name="heureDebut" type="time" className={champCls} /></Champ>
        <Champ label="Heure de fin"><input name="heureFin" type="time" className={champCls} /></Champ>
        <Champ label="Groupe-classe">
          <select name="groupe" className={champCls}>
            <option value="">Tous</option>
            {groupes.map((g) => <option key={g} value={g}>{`Groupe ${g}`}</option>)}
          </select>
        </Champ>
      </div>

      <Champ label="Titre de la séance"><input name="titre" required onChange={(e) => { e.currentTarget.value = majLive(e.currentTarget.value); }} placeholder="Ex : LES DROITS DE L'ENFANT" className={champCls} /></Champ>

      {/* Sous-titres hiérarchisés (3 degrés) */}
      <div className="rounded-xl border border-cream-200 bg-cream-50/50 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-forest-900"><ListTree size={15} /> Sous-titres</span>
          <button type="button" onClick={() => setSousTitres((l) => [...l, { niveau: 1, texte: "" }])} className="inline-flex h-8 items-center gap-1 rounded-full border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50">
            <Plus size={13} /> Ajouter un sous-titre
          </button>
        </div>
        {sousTitres.length === 0 ? (
          <p className="text-xs text-ink-700/55">Structurez la séance en sous-titres sur trois degrés de hiérarchie (niveau 1 = principal, niveau 3 = détail).</p>
        ) : (
          <ul className="space-y-1.5">
            {sousTitres.map((st, i) => (
              <li key={i} className="flex items-center gap-2" style={{ marginLeft: `${(st.niveau - 1) * 1.25}rem` }}>
                <select value={st.niveau} onChange={(e) => setSousTitres((l) => l.map((x, j) => (j === i ? { ...x, niveau: Number(e.target.value) } : x)))} className="h-9 shrink-0 rounded-lg border border-cream-300 bg-white px-2 text-xs outline-none focus:border-forest-400">
                  {NIVEAUX.map((n) => <option key={n} value={n}>Niveau {n}</option>)}
                </select>
                <input value={st.texte} onChange={(e) => setSousTitres((l) => l.map((x, j) => (j === i ? { ...x, texte: phraseLive(e.target.value) } : x)))} placeholder={`Sous-titre de niveau ${st.niveau}`} className="h-9 flex-1 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400" />
                <button type="button" onClick={() => setSousTitres((l) => l.filter((_, j) => j !== i))} className="shrink-0 text-ink-700/40 hover:text-red-600" aria-label="Retirer le sous-titre"><X size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Objectifs */}
      <div className="rounded-xl border border-cream-200 bg-cream-50/50 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-forest-900"><Target size={15} /> Objectifs</span>
          <button type="button" onClick={() => setObjectifs((l) => [...l, ""])} className="inline-flex h-8 items-center gap-1 rounded-full border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50">
            <Plus size={13} /> Ajouter un objectif
          </button>
        </div>
        {objectifs.length === 0 ? (
          <p className="text-xs text-ink-700/55">Listez les objectifs pédagogiques visés par la séance.</p>
        ) : (
          <ul className="space-y-1.5">
            {objectifs.map((o, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-forest-700">{i + 1}.</span>
                <input value={o} onChange={(e) => setObjectifs((l) => l.map((x, j) => (j === i ? phraseLive(e.target.value) : x)))} placeholder="Objectif visé" className="h-9 flex-1 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400" />
                <button type="button" onClick={() => setObjectifs((l) => l.filter((_, j) => j !== i))} className="shrink-0 text-ink-700/40 hover:text-red-600" aria-label="Retirer l'objectif"><X size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Champ label="Résumé de la séance">
        <textarea name="contenu" rows={3} placeholder="Résumé du contenu enseigné, activités menées…" className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
      </Champ>

      {/* Exercices : résumé (500 c. max) + lien du CAFOP en ligne */}
      <div className="rounded-xl border border-cream-200 bg-cream-50/50 p-3">
        <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-forest-900"><Dumbbell size={15} /> Exercices</span>
        <textarea name="exercices" rows={2} maxLength={500} placeholder="Énoncé ou consignes des exercices (500 caractères maximum)…" className="w-full rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
        <label className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-cream-300 bg-cream-100 px-2.5 text-xs font-semibold text-forest-800"><Link2 size={13} /> CAFOP en ligne</span>
          <input name="exercicesUrl" type="url" placeholder="https://cfpl2.eduweb.ci" className="h-9 min-w-[14rem] flex-1 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400" />
        </label>
      </div>

      <div className="max-w-xs"><Champ label="Prochaine séance"><input name="prochaineSeance" type="date" className={champCls} /></Champ></div>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="inline-flex h-11 w-auto items-center justify-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 shadow-soft transition-all hover:-translate-y-0.5 hover:bg-forest-700 disabled:pointer-events-none disabled:opacity-70">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={15} />} Enregistrer la séance
        </button>
      </div>
    </form>
  );
}

export function CahierTexteCafop({
  cafopId,
  modules,
  groupes,
  seances,
  disciplines,
  lectureSeule = false,
}: {
  cafopId: string;
  modules: ModuleAvecComposantes[];
  groupes: string[];
  seances: SeanceVue[];
  disciplines: string[];
  /** Rôle en lecture seule (adc/delc) : masque la création et la suppression de séances. */
  lectureSeule?: boolean;
}) {
  const router = useRouter();
  const [pendingSuppr, startSuppr] = useTransition();
  const [pendingSave, startSave] = useTransition();
  const [etat, setEtat] = useState<EtatForm>(initial);
  // Clé de réinitialisation : n'augmente qu'après un enregistrement réussi (pas sur une suppression),
  // ce qui remonte le formulaire pour le vider — sans jamais effacer une saisie en cours après une suppression.
  const [resetKey, setResetKey] = useState(0);

  // Mise à jour pilotée par l'événement de soumission (pas par un effet) : compatible react-hooks/set-state-in-effect.
  function enregistrer(formData: FormData) {
    startSave(async () => {
      const r = await creerSeanceCafop(initial, formData);
      setEtat(r);
      if (r.ok) {
        setResetKey((k) => k + 1);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {!lectureSeule && (
        <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
          <h3 className="mb-1 font-display text-base font-bold text-forest-900">Nouvelle séance</h3>
          <p className="mb-3 text-sm text-ink-700/60">Renseignez le module, les composantes et les thèmes (choix multiples), puis structurez le contenu enseigné.</p>
          {etat.message && <div className="mb-3"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
          <FormulaireSeance key={resetKey} cafopId={cafopId} modules={modules} groupes={groupes} disciplines={disciplines} action={enregistrer} pending={pendingSave} />
        </section>
      )}

      <section className="rounded-2xl border border-cream-200 bg-white shadow-soft">
        <div className="border-b border-cream-100 px-5 py-4">
          <h3 className="font-display text-base font-bold text-forest-900">Séances enregistrées ({seances.length})</h3>
        </div>
        {seances.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-ink-700/55"><BookText size={16} /> Aucune séance. Ajoutez-en une ci-dessus.</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {seances.map((s) => {
              // Sélection multiple (Json tableau) prioritaire sur les champs simples historiques.
              const composantesMulti = (s.composantes as string[] | null) ?? null;
              const themesMulti = (s.themes as string[] | null) ?? null;
              return (
              <li key={s.id} className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-forest-900">
                    {s.titre}
                    {s.discipline && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">{s.discipline}</span>}
                    {s.moduleNom && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-800">{s.moduleNom}</span>}
                    {composantesMulti && composantesMulti.length > 0
                      ? composantesMulti.map((c) => <span key={c} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">{c}</span>)
                      : s.composante && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">{s.composante}</span>}
                    {themesMulti && themesMulti.length > 0
                      ? themesMulti.map((t) => <span key={t} className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-800">{t}</span>)
                      : s.theme && <span className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-800">{s.theme}</span>}
                    {s.groupe && <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800">Groupe {s.groupe}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-700/55">
                    <span>{s.dateLabel}</span>
                    {s.heureLabel && <span className="inline-flex items-center gap-1"><Clock size={11} /> {s.heureLabel}</span>}
                  </p>
                  {s.sousTitres.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {s.sousTitres.map((st, i) => (
                        <li key={i} className="text-sm text-forest-800" style={{ marginLeft: `${(st.niveau - 1) * 1.25}rem` }}>• {st.texte}</li>
                      ))}
                    </ul>
                  )}
                  {s.objectifs.length > 0 && (
                    <div className="mt-2">
                      <p className="flex items-center gap-1 text-xs font-semibold text-ink-700/60"><Target size={12} /> Objectifs</p>
                      <ol className="mt-0.5 list-decimal pl-5 text-sm text-ink-700/75">
                        {s.objectifs.map((o, i) => <li key={i}>{o}</li>)}
                      </ol>
                    </div>
                  )}
                  {s.contenu && <p className="mt-2 text-sm text-ink-700/75">{s.contenu}</p>}
                  {(s.exercices || s.exercicesUrl) && (
                    <div className="mt-2 rounded-lg border border-cream-200 bg-cream-50/60 px-3 py-2">
                      <p className="flex items-center gap-1 text-xs font-semibold text-forest-800"><Dumbbell size={12} /> Exercices</p>
                      {s.exercices && <p className="mt-0.5 text-sm text-ink-700/75">{s.exercices}</p>}
                      {s.exercicesUrl && (
                        <a href={s.exercicesUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-blue-700 hover:underline">
                          <Link2 size={12} className="shrink-0" /> {s.exercicesUrl}
                        </a>
                      )}
                    </div>
                  )}
                  {s.prochaineSeanceLabel && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-forest-700"><CalendarClock size={12} /> Prochaine séance : {s.prochaineSeanceLabel}</p>
                  )}
                </div>
                {!lectureSeule && (
                  <button type="button" disabled={pendingSuppr} onClick={() => startSuppr(async () => { const r = await supprimerSeanceCafop(s.id); if (r.ok) router.refresh(); })} title="Supprimer" className="shrink-0 text-ink-700/40 hover:text-red-600 disabled:opacity-50">
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

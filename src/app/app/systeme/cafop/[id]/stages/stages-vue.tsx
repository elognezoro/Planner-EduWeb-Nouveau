"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Users, MessageSquare, ClipboardList, ShieldCheck, Plus, Info, Search, Check, X, Loader2,
  Send, MapPin, Star, GraduationCap,
} from "lucide-react";
import {
  attribuerStagiaires,
  retirerAttribution,
  posterDialogueStage,
  enregistrerVisiteStagiaire,
  enregistrerEvaluationStage,
  deciderModificationCafop,
  type EtatForm,
} from "@/lib/formation/stages-actions";
import { FormAlert } from "@/components/ui/form";
import type { ComposanteModule } from "@/lib/formation/structure-module";

const initial: EtatForm = { ok: false };
const champCls = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export interface MaitreVue { id: string; nom: string }
/** Stage (module estStage) : composantes/thèmes = habiletés visées, avec compétence facultative. */
export interface StageModuleVue { id: string; nom: string; annee: number; composantes: ComposanteModule[] }
export interface ApprenantVue { id: string; nom: string; prenoms: string | null; matricule: string | null; annee: number | null; groupe: string | null }
export interface AttributionVue {
  id: string;
  maitreId: string;
  maitreNom: string;
  annee: number;
  moduleId: string | null;
  moduleNom: string | null;
  apprenant: ApprenantVue;
}
export interface DialogueVue { id: string; apprenantId: string; auteurNom: string | null; duMaitre: boolean; contenu: string; creeLeLabel: string }
export interface VisiteVue {
  id: string;
  apprenantId: string;
  professeur: string;
  dateLabel: string;
  ecole: string | null;
  objet: string | null;
  observations: string | null;
  recommandations: string | null;
  noteGlobale: number | null;
}
export interface CritereVue { critere: string; note: number; sur: number }
export interface EvaluationVue {
  id: string;
  apprenantId: string;
  moduleId: string;
  evaluateurType: "prof_cafop" | "maitre_application";
  evaluateurNom: string | null;
  criteres: CritereVue[];
  noteGlobale: number;
  sur: number;
  appreciation: string | null;
}
export interface DemandeVue {
  id: string;
  type: string;
  cibleLibelle: string | null;
  demandeurNom: string | null;
  motif: string;
  valeurAvant: unknown;
  valeurProposee: unknown;
  statut: string;
  decideParNom: string | null;
  decideLeLabel: string | null;
  motifDecision: string | null;
  creeLeLabel: string;
}
export interface RegulariteVue { apprenantId: string; presents: number; absents: number; retards: number; total: number; pct: number }
export interface EnseignantVue { id: string; nom: string }

const nomApprenant = (a: { nom: string; prenoms: string | null }) => [a.nom, a.prenoms].filter(Boolean).join(" ");
const libelleAnnee = (n: number) => (n === 1 ? "1re Année" : `${n}e Année`);

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-forest-900">{label}</span>
      {children}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
//  Composant racine — 3 onglets internes + bandeau explicatif
// ─────────────────────────────────────────────────────────────

type Onglet = "registre" | "suivi" | "autorisations";

export function StagesCafop({
  cafopId,
  peutEcrire,
  maitres,
  stages,
  attributions,
  apprenants,
  groupes,
  dialogues,
  visites,
  evaluations,
  demandes,
  regularite,
  enseignants,
}: {
  cafopId: string;
  /** Directeur (cafop_admin), ADC ou Super Admin CAFOP de son pays — exception d'écriture documentée. */
  peutEcrire: boolean;
  maitres: MaitreVue[];
  stages: StageModuleVue[];
  attributions: AttributionVue[];
  apprenants: ApprenantVue[];
  groupes: string[];
  dialogues: DialogueVue[];
  visites: VisiteVue[];
  evaluations: EvaluationVue[];
  demandes: DemandeVue[];
  regularite: RegulariteVue[];
  enseignants: EnseignantVue[];
}) {
  const router = useRouter();
  const [onglet, setOnglet] = useState<Onglet>("registre");
  const rafraichir = () => router.refresh();

  const nbEnAttente = demandes.filter((d) => d.statut === "en_attente").length;
  const onglets: { cle: Onglet; libelle: string; Icone: typeof Users; badge?: number }[] = [
    { cle: "registre", libelle: "Registre des maîtres d'application", Icone: Users },
    { cle: "suivi", libelle: "Suivi des stagiaires", Icone: ClipboardList },
    { cle: "autorisations", libelle: "Autorisations", Icone: ShieldCheck, badge: nbEnAttente || undefined },
  ];

  return (
    <div className="space-y-6">
      {/* Bandeau explicatif */}
      <div className="flex items-start gap-3 rounded-2xl border border-forest-200 bg-forest-50 px-5 py-4">
        <Info size={18} className="mt-0.5 shrink-0 text-forest-700" />
        <p className="text-sm text-forest-900">
          {peutEcrire ? (
            <>
              En tant que direction du centre, vous consultez l&apos;ensemble des productions de stage (présences, dialogue,
              visites, évaluations) et attribuez les stagiaires aux maîtres d&apos;application. Une évaluation ou une note déjà
              attribuée reste modifiable directement (motif obligatoire, tracé au journal d&apos;activité) ; une modification
              demandée par un maître d&apos;application doit, elle, être autorisée depuis l&apos;onglet « Autorisations ».
            </>
          ) : (
            <>
              Cette page réunit, en lecture seule, l&apos;ensemble des productions de stage du centre : attributions, dialogue,
              visites et évaluations. Toute modification d&apos;une note déjà attribuée par un professeur de CAFOP ou un maître
              d&apos;application requiert l&apos;autorisation motivée du Directeur ou de l&apos;ADC, tracée au journal d&apos;activité.
            </>
          )}
        </p>
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-cream-200 bg-white p-1.5 shadow-soft">
        {onglets.map((o) => (
          <button
            key={o.cle}
            type="button"
            onClick={() => setOnglet(o.cle)}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-colors ${
              onglet === o.cle ? "bg-forest-800 text-cream-50" : "text-ink-700/70 hover:bg-cream-100"
            }`}
          >
            <o.Icone size={15} /> {o.libelle}
            {!!o.badge && <span className="ml-1 rounded-full bg-gold-500 px-1.5 text-xs font-bold text-white">{o.badge}</span>}
          </button>
        ))}
      </div>

      {onglet === "registre" && (
        <RegistreMaitres
          cafopId={cafopId}
          peutEcrire={peutEcrire}
          maitres={maitres}
          stages={stages}
          attributions={attributions}
          apprenants={apprenants}
          groupes={groupes}
          onChange={rafraichir}
        />
      )}
      {onglet === "suivi" && (
        <SuiviStagiaires
          peutEcrire={peutEcrire}
          attributions={attributions}
          dialogues={dialogues}
          visites={visites}
          evaluations={evaluations}
          regularite={regularite}
          enseignants={enseignants}
          stages={stages}
          onChange={rafraichir}
        />
      )}
      {onglet === "autorisations" && <Autorisations demandes={demandes} peutEcrire={peutEcrire} onChange={rafraichir} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Onglet 1 — Registre des maîtres d'application
// ─────────────────────────────────────────────────────────────

function RegistreMaitres({
  cafopId,
  peutEcrire,
  maitres,
  stages,
  attributions,
  apprenants,
  groupes,
  onChange,
}: {
  cafopId: string;
  peutEcrire: boolean;
  maitres: MaitreVue[];
  stages: StageModuleVue[];
  attributions: AttributionVue[];
  apprenants: ApprenantVue[];
  groupes: string[];
  onChange: () => void;
}) {
  return (
    <div className="space-y-5">
      {[1, 2, 3].map((an) => (
        <SectionAnnee key={an} annee={an} attributions={attributions.filter((a) => a.annee === an)} peutEcrire={peutEcrire} onChange={onChange} />
      ))}
      {peutEcrire && (
        <FormulaireAttribution cafopId={cafopId} maitres={maitres} stages={stages} apprenants={apprenants} groupes={groupes} onChange={onChange} />
      )}
    </div>
  );
}

function SectionAnnee({
  annee,
  attributions,
  peutEcrire,
  onChange,
}: {
  annee: number;
  attributions: AttributionVue[];
  peutEcrire: boolean;
  onChange: () => void;
}) {
  const parMaitre = useMemo(() => {
    const m = new Map<string, AttributionVue[]>();
    for (const a of attributions) m.set(a.maitreId, [...(m.get(a.maitreId) ?? []), a]);
    return [...m.entries()];
  }, [attributions]);

  return (
    <section className="rounded-2xl border border-cream-200 bg-white shadow-soft">
      <div className="border-b border-cream-100 px-5 py-3.5">
        <h3 className="font-display text-base font-bold text-forest-900">
          {libelleAnnee(annee)} — {attributions.length} stagiaire(s) attribué(s)
        </h3>
      </div>
      {parMaitre.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-700/55">Aucune attribution pour cette année.</p>
      ) : (
        <div className="divide-y divide-cream-100">
          {parMaitre.map(([maitreId, liste]) => (
            <div key={maitreId} className="px-5 py-3.5">
              <p className="mb-2 text-sm font-semibold text-forest-900">{liste[0].maitreNom}</p>
              <div className="flex flex-wrap gap-2">
                {liste.map((a) => (
                  <BadgeStagiaire key={a.id} attribution={a} peutEcrire={peutEcrire} onChange={onChange} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BadgeStagiaire({ attribution, peutEcrire, onChange }: { attribution: AttributionVue; peutEcrire: boolean; onChange: () => void }) {
  const [confirmer, setConfirmer] = useState(false);
  const [pending, startTransition] = useTransition();

  function retirer() {
    startTransition(async () => {
      const r = await retirerAttribution(attribution.id);
      if (r.ok) {
        setConfirmer(false);
        onChange();
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 py-1 pl-3 pr-1.5 text-xs font-semibold text-forest-800">
      {nomApprenant(attribution.apprenant)}
      {attribution.apprenant.matricule && <span className="font-normal text-ink-700/50">· {attribution.apprenant.matricule}</span>}
      {attribution.apprenant.groupe && <span className="rounded-full bg-cream-200 px-1.5 py-0.5">Gr. {attribution.apprenant.groupe}</span>}
      {attribution.moduleNom && <span className="rounded-full bg-gold-100 px-1.5 py-0.5 text-gold-800">{attribution.moduleNom}</span>}
      {peutEcrire &&
        (confirmer ? (
          <span className="inline-flex items-center gap-1">
            <button type="button" onClick={retirer} disabled={pending} title="Confirmer le retrait" className="rounded-full bg-red-600 p-1 text-white hover:bg-red-700 disabled:opacity-60">
              {pending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            </button>
            <button type="button" onClick={() => setConfirmer(false)} title="Annuler" className="rounded-full bg-cream-300 p-1 text-ink-700 hover:bg-cream-400">
              <X size={11} />
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmer(true)} title="Retirer l'attribution" className="rounded-full p-1 text-ink-700/40 hover:bg-red-50 hover:text-red-600">
            <X size={11} />
          </button>
        ))}
    </span>
  );
}

function BoutonAttribuer({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 shadow-soft transition-all hover:-translate-y-0.5 hover:bg-forest-700 disabled:pointer-events-none disabled:opacity-50"
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={15} />} Attribuer
    </button>
  );
}

function FormulaireAttribution({
  cafopId,
  maitres,
  stages,
  apprenants,
  groupes,
  onChange,
}: {
  cafopId: string;
  maitres: MaitreVue[];
  stages: StageModuleVue[];
  apprenants: ApprenantVue[];
  groupes: string[];
  onChange: () => void;
}) {
  const [etat, action] = useActionState(attribuerStagiaires, initial);
  const [annee, setAnnee] = useState(1);
  const [maitreId, setMaitreId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [groupe, setGroupe] = useState("");
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const notifie = useRef(0);

  useEffect(() => {
    if (etat.ok && notifie.current !== 1) {
      notifie.current = 1;
      setSelection([]);
      onChange();
    }
    if (!etat.ok) notifie.current = 0;
  }, [etat.ok, onChange]);

  const stagesAnnee = useMemo(() => stages.filter((s) => s.annee === annee), [stages, annee]);
  const apprenantsAnnee = useMemo(() => apprenants.filter((a) => a.annee === annee), [apprenants, annee]);
  const apprenantsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return apprenantsAnnee.filter(
      (a) => (!groupe || a.groupe === groupe) && (!q || nomApprenant(a).toLowerCase().includes(q) || (a.matricule ?? "").toLowerCase().includes(q)),
    );
  }, [apprenantsAnnee, groupe, recherche]);

  function toggle(id: string) {
    setSelection((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  return (
    <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
      <h3 className="mb-1 font-display text-base font-bold text-forest-900">Attribuer des stagiaires</h3>
      <p className="mb-3 text-sm text-ink-700/60">
        Choisissez le maître d&apos;application, l&apos;année de formation puis les élèves-maîtres à lui attribuer.
      </p>
      {etat.message && (
        <div className="mb-3">
          <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
        </div>
      )}
      <form action={action} className="space-y-4">
        <input type="hidden" name="cafopId" value={cafopId} />
        <input type="hidden" name="annee" value={annee} />
        {selection.map((idSel) => (
          <input key={idSel} type="hidden" name="apprenantIds" value={idSel} />
        ))}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Champ label="Maître d'application">
            <select name="maitreId" value={maitreId} onChange={(e) => setMaitreId(e.target.value)} required className={champCls}>
              <option value="">Sélectionner…</option>
              {maitres.map((m) => (
                <option key={m.id} value={m.id}>{m.nom}</option>
              ))}
            </select>
          </Champ>
          <Champ label="Année de formation">
            <select
              value={annee}
              onChange={(e) => {
                setAnnee(Number(e.target.value));
                setModuleId("");
              }}
              className={champCls}
            >
              {[1, 2, 3].map((a) => (
                <option key={a} value={a}>{libelleAnnee(a)}</option>
              ))}
            </select>
          </Champ>
          <Champ label="Stage (optionnel)">
            <select name="moduleId" value={moduleId} onChange={(e) => setModuleId(e.target.value)} disabled={stagesAnnee.length === 0} className={champCls}>
              <option value="">{stagesAnnee.length === 0 ? "— (aucun stage défini pour cette année)" : "— (attribution générale)"}</option>
              {stagesAnnee.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </Champ>
          <Champ label="Groupe-classe">
            <select value={groupe} onChange={(e) => setGroupe(e.target.value)} className={champCls}>
              <option value="">Tous les groupes</option>
              {groupes.map((g) => (
                <option key={g} value={g}>{`Groupe ${g}`}</option>
              ))}
            </select>
          </Champ>
        </div>

        <div className="rounded-xl border border-cream-200 bg-cream-50/50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-forest-900">
              <GraduationCap size={15} /> Stagiaires — {libelleAnnee(annee)} ({selection.length} sélectionné{selection.length > 1 ? "s" : ""})
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-2.5">
              <Search size={13} className="text-ink-700/40" />
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un nom…" className="h-8 w-48 bg-transparent text-xs outline-none" />
            </div>
          </div>
          {apprenantsFiltres.length === 0 ? (
            <p className="text-xs text-ink-700/55">Aucun élève-maître ne correspond à ces critères.</p>
          ) : (
            <ul className="grid max-h-64 grid-cols-1 gap-1 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
              {apprenantsFiltres.map((a) => (
                <li key={a.id}>
                  <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                    <input type="checkbox" checked={selection.includes(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 rounded border-cream-300 text-forest-700 focus:ring-forest-300" />
                    <span className="truncate">{nomApprenant(a)}{a.groupe ? ` · Gr. ${a.groupe}` : ""}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <BoutonAttribuer disabled={!maitreId || selection.length === 0} />
        </div>
      </form>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Onglet 2 — Suivi des stagiaires
// ─────────────────────────────────────────────────────────────

interface StagiaireSuivi {
  apprenant: ApprenantVue;
  maitres: string[];
  annee: number;
  moduleIds: string[];
}

function SuiviStagiaires({
  peutEcrire,
  attributions,
  dialogues,
  visites,
  evaluations,
  regularite,
  enseignants,
  stages,
  onChange,
}: {
  peutEcrire: boolean;
  attributions: AttributionVue[];
  dialogues: DialogueVue[];
  visites: VisiteVue[];
  evaluations: EvaluationVue[];
  regularite: RegulariteVue[];
  enseignants: EnseignantVue[];
  stages: StageModuleVue[];
  onChange: () => void;
}) {
  const stagiaires = useMemo(() => {
    const m = new Map<string, StagiaireSuivi>();
    for (const a of attributions) {
      const e = m.get(a.apprenant.id) ?? { apprenant: a.apprenant, maitres: [], annee: a.annee, moduleIds: [] };
      if (!e.maitres.includes(a.maitreNom)) e.maitres.push(a.maitreNom);
      if (a.moduleId && !e.moduleIds.includes(a.moduleId)) e.moduleIds.push(a.moduleId);
      m.set(a.apprenant.id, e);
    }
    return [...m.values()].sort((x, y) => nomApprenant(x.apprenant).localeCompare(nomApprenant(y.apprenant), "fr"));
  }, [attributions]);

  const [recherche, setRecherche] = useState("");
  const [selId, setSelId] = useState(stagiaires[0]?.apprenant.id ?? "");
  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return q ? stagiaires.filter((s) => nomApprenant(s.apprenant).toLowerCase().includes(q)) : stagiaires;
  }, [stagiaires, recherche]);
  const sel = stagiaires.find((s) => s.apprenant.id === selId) ?? stagiaires[0] ?? null;

  if (stagiaires.length === 0) {
    return <p className="rounded-2xl border border-cream-200 bg-white px-5 py-8 text-center text-sm text-ink-700/55">Aucun stagiaire attribué pour le moment.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-2 rounded-2xl border border-cream-200 bg-white p-3 shadow-soft lg:max-h-[46rem] lg:overflow-auto">
        <div className="flex items-center gap-2 rounded-lg border border-cream-300 px-2.5">
          <Search size={13} className="text-ink-700/40" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…" className="h-9 w-full bg-transparent text-sm outline-none" />
        </div>
        <ul className="space-y-1">
          {filtres.map((s) => (
            <li key={s.apprenant.id}>
              <button
                type="button"
                onClick={() => setSelId(s.apprenant.id)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                  sel?.apprenant.id === s.apprenant.id ? "bg-forest-800 font-semibold text-cream-50" : "text-ink-700/80 hover:bg-cream-100"
                }`}
              >
                <span className="block truncate">{nomApprenant(s.apprenant)}</span>
                <span className={`block truncate text-xs ${sel?.apprenant.id === s.apprenant.id ? "text-cream-100/80" : "text-ink-700/50"}`}>
                  {libelleAnnee(s.annee)} · {s.maitres.join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {sel && (
        <FicheStagiaire
          key={sel.apprenant.id}
          stagiaire={sel}
          peutEcrire={peutEcrire}
          dialogues={dialogues.filter((d) => d.apprenantId === sel.apprenant.id)}
          visites={visites.filter((v) => v.apprenantId === sel.apprenant.id)}
          evaluations={evaluations.filter((e) => e.apprenantId === sel.apprenant.id)}
          regularite={regularite.find((r) => r.apprenantId === sel.apprenant.id) ?? null}
          enseignants={enseignants}
          stages={stages}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function CelluleKpi({ label, valeur, accent }: { label: string; valeur: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-cream-200 p-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${accent ? "text-forest-800" : "text-ink-900"}`}>{valeur}</p>
    </div>
  );
}

function Regularite({ r }: { r: RegulariteVue | null }) {
  if (!r || r.total === 0) return <p className="text-sm text-ink-700/55">Aucune présence enregistrée pour ce stagiaire.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <CelluleKpi label="Régularité" valeur={`${r.pct}%`} accent />
      <CelluleKpi label="Présences" valeur={String(r.presents)} />
      <CelluleKpi label="Absences" valeur={String(r.absents)} />
      <CelluleKpi label="Retards" valeur={String(r.retards)} />
    </div>
  );
}

function FicheStagiaire({
  stagiaire,
  peutEcrire,
  dialogues,
  visites,
  evaluations,
  regularite,
  enseignants,
  stages,
  onChange,
}: {
  stagiaire: StagiaireSuivi;
  peutEcrire: boolean;
  dialogues: DialogueVue[];
  visites: VisiteVue[];
  evaluations: EvaluationVue[];
  regularite: RegulariteVue | null;
  enseignants: EnseignantVue[];
  stages: StageModuleVue[];
  onChange: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-forest-900">{nomApprenant(stagiaire.apprenant)}</h3>
            <p className="text-xs text-ink-700/55">
              {libelleAnnee(stagiaire.annee)}
              {stagiaire.apprenant.groupe ? ` · Groupe ${stagiaire.apprenant.groupe}` : ""}
              {stagiaire.apprenant.matricule ? ` · ${stagiaire.apprenant.matricule}` : ""}
            </p>
          </div>
          <p className="text-xs text-ink-700/55">
            Maître(s) : <span className="font-semibold text-forest-800">{stagiaire.maitres.join(", ")}</span>
          </p>
        </div>
        <Regularite r={regularite} />
      </section>

      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h4 className="mb-3 flex items-center gap-1.5 font-display text-sm font-bold text-forest-900">
          <MessageSquare size={15} /> Fil de dialogue
        </h4>
        <FilDialogue apprenantId={stagiaire.apprenant.id} dialogues={dialogues} peutEcrire={peutEcrire} onChange={onChange} />
      </section>

      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h4 className="mb-3 flex items-center gap-1.5 font-display text-sm font-bold text-forest-900">
          <MapPin size={15} /> Visites de classe
        </h4>
        <VisitesStagiaire apprenantId={stagiaire.apprenant.id} visites={visites} peutEcrire={peutEcrire} enseignants={enseignants} onChange={onChange} />
      </section>

      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h4 className="mb-3 flex items-center gap-1.5 font-display text-sm font-bold text-forest-900">
          <Star size={15} /> Évaluations du stage
        </h4>
        <Evaluations
          apprenantId={stagiaire.apprenant.id}
          annee={stagiaire.annee}
          moduleIds={stagiaire.moduleIds}
          stages={stages}
          evaluations={evaluations}
          peutEcrire={peutEcrire}
          onChange={onChange}
        />
      </section>
    </div>
  );
}

function BoutonEnvoyer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-800 px-4 text-xs font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60">
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Envoyer
    </button>
  );
}

function FilDialogue({
  apprenantId,
  dialogues,
  peutEcrire,
  onChange,
}: {
  apprenantId: string;
  dialogues: DialogueVue[];
  peutEcrire: boolean;
  onChange: () => void;
}) {
  const [etat, action] = useActionState(posterDialogueStage, initial);
  const [contenu, setContenu] = useState("");
  const notifie = useRef(0);

  useEffect(() => {
    if (etat.ok && notifie.current !== 1) {
      notifie.current = 1;
      setContenu("");
      onChange();
    }
    if (!etat.ok) notifie.current = 0;
  }, [etat.ok, onChange]);

  const fil = useMemo(() => [...dialogues].reverse(), [dialogues]);

  return (
    <div className="space-y-3">
      <div className="max-h-72 space-y-2 overflow-auto rounded-xl border border-cream-200 bg-cream-50/40 p-3">
        {fil.length === 0 ? (
          <p className="text-sm text-ink-700/55">Aucun message pour ce stagiaire.</p>
        ) : (
          fil.map((m) => (
            <div key={m.id} className="rounded-lg bg-white p-2.5 shadow-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-forest-900">
                  {m.auteurNom ?? "—"}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${m.duMaitre ? "bg-blue-100 text-blue-800" : "bg-forest-100 text-forest-800"}`}>
                    {m.duMaitre ? "Maître" : "Direction"}
                  </span>
                </span>
                <span className="text-[11px] text-ink-700/45">{m.creeLeLabel}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink-800">{m.contenu}</p>
            </div>
          ))
        )}
      </div>
      {peutEcrire && (
        <form action={action} className="space-y-2">
          <input type="hidden" name="apprenantId" value={apprenantId} />
          {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
          <textarea
            name="contenu"
            required
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            rows={2}
            maxLength={4000}
            placeholder="Écrire au maître d'application…"
            className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
          <div className="flex justify-end">
            <BoutonEnvoyer />
          </div>
        </form>
      )}
    </div>
  );
}

function BoutonEnregistrerVisite() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60">
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Enregistrer la visite
    </button>
  );
}

function FormulaireVisite({
  apprenantId,
  action,
  enseignants,
  etat,
}: {
  apprenantId: string;
  action: (formData: FormData) => void;
  enseignants: EnseignantVue[];
  etat: EtatForm;
}) {
  return (
    <form action={action} className="space-y-3 rounded-xl border border-cream-200 bg-white p-3">
      <input type="hidden" name="apprenantId" value={apprenantId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Champ label="Professeur visiteur">
          <select name="professeur" required defaultValue="" className={champCls}>
            <option value="">Sélectionner…</option>
            {enseignants.map((e) => (
              <option key={e.id} value={e.nom}>{e.nom}</option>
            ))}
          </select>
        </Champ>
        <Champ label="Date"><input name="date" type="date" required className={champCls} /></Champ>
        <Champ label="École / lieu de stage"><input name="ecole" className={champCls} /></Champ>
        <Champ label="Appréciation chiffrée (/20)"><input name="noteGlobale" placeholder="Ex : 15" className={champCls} /></Champ>
      </div>
      <Champ label="Objet de la visite"><input name="objet" className={champCls} /></Champ>
      <Champ label="Observations">
        <textarea name="observations" rows={2} className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
      </Champ>
      <Champ label="Recommandations">
        <textarea name="recommandations" rows={2} className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
      </Champ>
      <div className="flex justify-end"><BoutonEnregistrerVisite /></div>
    </form>
  );
}

function VisitesStagiaire({
  apprenantId,
  visites,
  peutEcrire,
  enseignants,
  onChange,
}: {
  apprenantId: string;
  visites: VisiteVue[];
  peutEcrire: boolean;
  enseignants: EnseignantVue[];
  onChange: () => void;
}) {
  const [etat, action] = useActionState(enregistrerVisiteStagiaire, initial);
  const [resetKey, setResetKey] = useState(0);
  const notifie = useRef(0);

  useEffect(() => {
    if (etat.ok && notifie.current !== 1) {
      notifie.current = 1;
      setResetKey((k) => k + 1);
      onChange();
    }
    if (!etat.ok) notifie.current = 0;
  }, [etat.ok, onChange]);

  return (
    <div className="space-y-3">
      {visites.length === 0 ? (
        <p className="text-sm text-ink-700/55">Aucune visite enregistrée.</p>
      ) : (
        <ul className="space-y-2">
          {visites.map((v) => (
            <li key={v.id} className="rounded-xl border border-cream-200 bg-cream-50/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-forest-900">{v.professeur}</span>
                <span className="text-xs text-ink-700/50">{v.dateLabel}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-700/60">
                {v.ecole && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} /> {v.ecole}
                  </span>
                )}
                {v.objet && <span>{v.objet}</span>}
                {v.noteGlobale != null && <span className="rounded-full bg-gold-100 px-2 py-0.5 font-semibold text-gold-800">{v.noteGlobale}/20</span>}
              </div>
              {v.observations && <p className="mt-1.5 text-sm text-ink-800">{v.observations}</p>}
              {v.recommandations && <p className="mt-1 text-xs italic text-ink-700/60">Recommandations : {v.recommandations}</p>}
            </li>
          ))}
        </ul>
      )}
      {peutEcrire && <FormulaireVisite key={resetKey} apprenantId={apprenantId} action={action} enseignants={enseignants} etat={etat} />}
    </div>
  );
}

function BoutonEnregistrerGrille() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60">
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Enregistrer la grille
    </button>
  );
}

function GrilleEvaluation({
  apprenantId,
  moduleId,
  evaluateurType,
  existante,
  editable,
  onChange,
  titre,
}: {
  apprenantId: string;
  moduleId: string;
  evaluateurType: "prof_cafop" | "maitre_application";
  existante: EvaluationVue | undefined;
  editable: boolean;
  onChange: () => void;
  titre: string;
}) {
  const [etat, action] = useActionState(enregistrerEvaluationStage, initial);
  const [criteres, setCriteres] = useState<CritereVue[]>(existante && existante.criteres.length > 0 ? existante.criteres : [{ critere: "", note: 0, sur: 20 }]);
  const [appreciation, setAppreciation] = useState(existante?.appreciation ?? "");
  const [motif, setMotif] = useState("");
  const notifie = useRef(0);

  useEffect(() => {
    if (etat.ok && notifie.current !== 1) {
      notifie.current = 1;
      onChange();
    }
    if (!etat.ok) notifie.current = 0;
  }, [etat.ok, onChange]);

  if (!editable) {
    return (
      <div className="rounded-xl border border-cream-200 bg-cream-50/40 p-3">
        <p className="mb-2 text-sm font-semibold text-forest-900">{titre}</p>
        {!existante ? (
          <p className="text-xs text-ink-700/55">Aucune grille saisie.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {existante.criteres.map((c, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700/80">{c.critere}</span>
                  <span className="font-semibold text-forest-900">{c.note}/{c.sur}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-cream-200 pt-2">
              <span className="text-sm font-semibold text-forest-900">Note globale</span>
              <span className="text-base font-bold text-forest-800">{existante.noteGlobale}/{existante.sur}</span>
            </div>
            {existante.evaluateurNom && <p className="mt-1 text-xs text-ink-700/50">Évaluateur : {existante.evaluateurNom}</p>}
            {existante.appreciation && <p className="mt-1.5 text-sm italic text-ink-700/70">« {existante.appreciation} »</p>}
          </>
        )}
      </div>
    );
  }

  const totalSur = criteres.reduce((s, c) => s + (c.sur || 0), 0);
  const totalNote = criteres.reduce((s, c) => s + (c.note || 0), 0);
  const noteGlobale = totalSur > 0 ? Math.round((totalNote / totalSur) * 20 * 100) / 100 : 0;

  return (
    <div className="rounded-xl border border-cream-200 bg-white p-3">
      <p className="mb-2 text-sm font-semibold text-forest-900">{titre}</p>
      {etat.message && (
        <div className="mb-2">
          <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
        </div>
      )}
      <form action={action} className="space-y-3">
        <input type="hidden" name="apprenantId" value={apprenantId} />
        <input type="hidden" name="moduleId" value={moduleId} />
        <input type="hidden" name="evaluateurType" value={evaluateurType} />
        <input type="hidden" name="criteres" value={JSON.stringify(criteres.filter((c) => c.critere.trim()))} />
        <ul className="space-y-1.5">
          {criteres.map((c, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <input
                value={c.critere}
                onChange={(e) => setCriteres((l) => l.map((x, j) => (j === i ? { ...x, critere: e.target.value } : x)))}
                placeholder="Critère"
                className="h-9 flex-1 rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400"
              />
              <input
                type="number"
                value={c.note}
                onChange={(e) => setCriteres((l) => l.map((x, j) => (j === i ? { ...x, note: Number(e.target.value) } : x)))}
                className="h-9 w-16 rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400"
              />
              <span className="text-xs text-ink-700/50">/</span>
              <input
                type="number"
                value={c.sur}
                onChange={(e) => setCriteres((l) => l.map((x, j) => (j === i ? { ...x, sur: Number(e.target.value) } : x)))}
                className="h-9 w-14 rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400"
              />
              <button type="button" onClick={() => setCriteres((l) => l.filter((_, j) => j !== i))} className="text-ink-700/40 hover:text-red-600">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setCriteres((l) => [...l, { critere: "", note: 0, sur: 20 }])}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50"
        >
          <Plus size={12} /> Ajouter un critère
        </button>
        <div className="flex items-center justify-between rounded-lg bg-forest-50 px-3 py-2">
          <span className="text-sm font-semibold text-forest-900">Note globale (calculée)</span>
          <span className="text-base font-bold text-forest-800">{noteGlobale}/20</span>
        </div>
        <Champ label="Appréciation">
          <textarea
            name="appreciation"
            rows={2}
            value={appreciation}
            onChange={(e) => setAppreciation(e.target.value)}
            className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
        </Champ>
        {existante && (
          <Champ label="Motif de la modification (obligatoire — traçabilité)">
            <input name="motif" required value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : erreur de saisie sur le critère 2…" className={champCls} />
          </Champ>
        )}
        <div className="flex justify-end"><BoutonEnregistrerGrille /></div>
      </form>
    </div>
  );
}

function Evaluations({
  apprenantId,
  annee,
  moduleIds,
  stages,
  evaluations,
  peutEcrire,
  onChange,
}: {
  apprenantId: string;
  annee: number;
  moduleIds: string[];
  stages: StageModuleVue[];
  evaluations: EvaluationVue[];
  peutEcrire: boolean;
  onChange: () => void;
}) {
  const optionsModules = useMemo(() => {
    const direct = stages.filter((s) => moduleIds.includes(s.id));
    return direct.length > 0 ? direct : stages.filter((s) => s.annee === annee);
  }, [stages, moduleIds, annee]);
  const [moduleIdSel, setModuleIdSel] = useState<string | null>(null);
  const moduleId = moduleIdSel ?? optionsModules[0]?.id ?? "";

  if (optionsModules.length === 0) {
    return <p className="text-sm text-ink-700/55">Aucun stage défini pour cette année de formation — impossible d&apos;évaluer.</p>;
  }

  const evalProf = evaluations.find((e) => e.moduleId === moduleId && e.evaluateurType === "prof_cafop");
  const evalMaitre = evaluations.find((e) => e.moduleId === moduleId && e.evaluateurType === "maitre_application");

  return (
    <div className="space-y-3">
      {optionsModules.length > 1 && (
        <Champ label="Stage évalué">
          <select value={moduleId} onChange={(e) => setModuleIdSel(e.target.value)} className={champCls}>
            {optionsModules.map((s) => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>
        </Champ>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <GrilleEvaluation
          key={`prof-${moduleId}`}
          apprenantId={apprenantId}
          moduleId={moduleId}
          evaluateurType="prof_cafop"
          existante={evalProf}
          editable={peutEcrire}
          onChange={onChange}
          titre="Grille du professeur de CAFOP"
        />
        <GrilleEvaluation
          key={`maitre-${moduleId}`}
          apprenantId={apprenantId}
          moduleId={moduleId}
          evaluateurType="maitre_application"
          existante={evalMaitre}
          editable={false}
          onChange={onChange}
          titre="Grille du maître d'application"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Onglet 3 — Autorisations (demandes de modification)
// ─────────────────────────────────────────────────────────────

function resumeValeur(type: string, v: unknown): string {
  if (type === "evaluation_stage") {
    const x = v as { noteGlobale?: number } | null;
    return x?.noteGlobale != null ? `${x.noteGlobale}/20` : "—";
  }
  if (type === "note_cafop") {
    const x = v as { valeur?: number; bareme?: number } | null;
    return x?.valeur != null ? `${x.valeur}/${x.bareme ?? 20}` : "—";
  }
  return "—";
}

function BoutonsDecision() {
  const { pending } = useFormStatus();
  return (
    <div className="flex gap-2">
      <button
        type="submit"
        name="decision"
        value="autoriser"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Autoriser
      </button>
      <button
        type="submit"
        name="decision"
        value="refuser"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <X size={13} /> Refuser
      </button>
    </div>
  );
}

function DemandeLigne({ demande, peutEcrire, onChange }: { demande: DemandeVue; peutEcrire: boolean; onChange: () => void }) {
  const [etat, action] = useActionState(deciderModificationCafop, initial);
  const [motifOuvert, setMotifOuvert] = useState(false);
  const notifie = useRef(0);

  useEffect(() => {
    if (etat.ok && notifie.current !== 1) {
      notifie.current = 1;
      onChange();
    }
    if (!etat.ok) notifie.current = 0;
  }, [etat.ok, onChange]);

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-forest-900">{demande.cibleLibelle ?? "Cible inconnue"}</p>
          <p className="text-xs text-ink-700/55">Demandé par {demande.demandeurNom ?? "—"} le {demande.creeLeLabel}</p>
          <p className="mt-1 text-sm text-ink-700/75">Motif : {demande.motif}</p>
          <p className="mt-1 text-sm">
            <span className="text-ink-700/60">Valeur actuelle : </span>
            <span className="font-semibold text-ink-900">{resumeValeur(demande.type, demande.valeurAvant)}</span>
            <span className="mx-1.5 text-ink-700/40">→</span>
            <span className="text-ink-700/60">proposée : </span>
            <span className="font-semibold text-forest-800">{resumeValeur(demande.type, demande.valeurProposee)}</span>
          </p>
        </div>
        {peutEcrire && (
          <form action={action} className="shrink-0 space-y-2">
            <input type="hidden" name="id" value={demande.id} />
            {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
            {motifOuvert ? (
              <input name="motifDecision" placeholder="Motif de la décision (facultatif)…" className="h-9 w-56 rounded-lg border border-cream-300 bg-white px-2.5 text-xs outline-none focus:border-forest-400" />
            ) : (
              <button type="button" onClick={() => setMotifOuvert(true)} className="block text-xs font-medium text-forest-700 hover:underline">
                + Ajouter un motif de décision
              </button>
            )}
            <BoutonsDecision />
          </form>
        )}
      </div>
    </li>
  );
}

function Autorisations({ demandes, peutEcrire, onChange }: { demandes: DemandeVue[]; peutEcrire: boolean; onChange: () => void }) {
  const enAttente = demandes.filter((d) => d.statut === "en_attente");
  const traitees = demandes.filter((d) => d.statut !== "en_attente");

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-cream-200 bg-white shadow-soft">
        <div className="border-b border-cream-100 px-5 py-3.5">
          <h3 className="font-display text-base font-bold text-forest-900">Demandes en attente ({enAttente.length})</h3>
        </div>
        {enAttente.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-700/55">Aucune demande de modification en attente.</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {enAttente.map((d) => (
              <DemandeLigne key={d.id} demande={d} peutEcrire={peutEcrire} onChange={onChange} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-cream-200 bg-white shadow-soft">
        <div className="border-b border-cream-100 px-5 py-3.5">
          <h3 className="font-display text-base font-bold text-forest-900">Historique ({traitees.length})</h3>
        </div>
        {traitees.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-700/55">Aucune décision enregistrée.</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {traitees.map((d) => (
              <li key={d.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-forest-900">{d.cibleLibelle ?? "Cible inconnue"}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.statut === "autorisee" ? "bg-forest-100 text-forest-800" : "bg-red-100 text-red-700"}`}>
                    {d.statut === "autorisee" ? "Autorisée" : "Refusée"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-700/55">
                  Demandé par {d.demandeurNom ?? "—"} le {d.creeLeLabel} · Décidé par {d.decideParNom ?? "—"}
                  {d.decideLeLabel ? ` le ${d.decideLeLabel}` : ""}
                </p>
                <p className="mt-1 text-sm text-ink-700/75">Motif : {d.motif}</p>
                {d.motifDecision && <p className="mt-0.5 text-sm italic text-ink-700/60">Décision : {d.motifDecision}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

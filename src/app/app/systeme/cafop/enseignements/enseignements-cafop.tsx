"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { FileText, Users, BookOpen, Award, GraduationCap, ChevronRight, Plus, Trash2, SlidersHorizontal, Save, ListTree, X, Check } from "lucide-react";
import { creerModuleCafop, modifierModuleCafop, basculerModuleCafop, supprimerModuleCafop } from "@/lib/formation/actions";
import { grouperParCompetence, type ComposanteModule } from "@/lib/formation/structure-module";
import { FormAlert } from "@/components/ui/form";
import { appliquerTerme } from "@/lib/cafop-terme";
import { EnteteCafop, Modale } from "../entete-cafop";

export interface ModuleVue {
  id: string;
  nom: string;
  code: string | null;
  ordre: number;
  actif: boolean;
  coefficient: number;
  annee: number;
  semestre: number | null;
  /** Jalons de planning au format « yyyy-mm-dd » (ou null). */
  dateDebut: string | null;
  dateFin: string | null;
  datePretest: string | null;
  dateEvaluation: string | null;
  /** Structure pédagogique : composantes → thèmes, chaque composante pouvant porter une
   *  COMPÉTENCE facultative (cascade Module → [Compétence →] Composante → Thème). */
  composantes: ComposanteModule[];
  /** Vrai = STAGE PRATIQUE (enregistré comme un module) ; plusieurs stages possibles par année. */
  estStage: boolean;
}
export interface CentreLite {
  id: string;
  nom: string;
  drena: string | null;
  pays: string;
}

const BASE = "/app/systeme/cafop";

export function EnseignementsCafop({
  modules,
  centres,
  regions,
  semestres,
  terme = "CAFOP",
  lectureSeule = false,
}: {
  modules: ModuleVue[];
  centres: CentreLite[];
  regions: { id: string; nom: string }[];
  semestres: number;
  terme?: string;
  /** Rôle en lecture seule (delc) : masque la gestion des modules et la barre d'outils. */
  lectureSeule?: boolean;
}) {
  const [modulesOuvert, setModulesOuvert] = useState(false);
  const nbModulesActifs = modules.filter((m) => m.actif).length;
  const T = (s: string) => appliquerTerme(s, terme);

  const minis = [
    { valeur: centres.length, libelle: T("CAFOP enregistrés"), Icone: Users, ton: "bg-gold-100 text-gold-700" },
    { valeur: nbModulesActifs, libelle: "Modules actifs", Icone: BookOpen, ton: "bg-blue-100 text-blue-700" },
    { valeur: semestres, libelle: "Semestres", Icone: Award, ton: "bg-forest-100 text-forest-700" },
  ];

  return (
    <div className="space-y-6">
      <EnteteCafop ongletActif="enseignements" nbCentres={centres.length} regions={regions} terme={terme} lectureSeule={lectureSeule} />

      {/* ALLER À */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-cream-200 bg-white px-4 py-2.5 text-sm">
        <span className="font-semibold text-ink-700/45">ALLER À</span>
        {[
          { libelle: "Présentation", href: "#presentation" },
          { libelle: T("Sélection d'un CAFOP"), href: "#selection" },
        ].map((a) => (
          <a key={a.href} href={a.href} className="rounded-full border border-cream-300 px-3 py-0.5 font-medium text-forest-800 hover:bg-forest-50">
            {a.libelle}
          </a>
        ))}
      </div>

      {/* Présentation + indicateurs */}
      <section id="presentation" className="space-y-4 rounded-2xl border-2 border-gold-300 bg-gold-50/60 p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-500 text-white">
              <FileText size={20} />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-forest-900">Gestion de la formation</h2>
              <p className="mt-0.5 max-w-2xl text-sm text-ink-700/70">
                {T("Sélectionnez un CAFOP pour gérer la formation des élèves-maîtres et générer les bulletins de notes semestriels personnalisés.")}
              </p>
            </div>
          </div>
          {!lectureSeule && (
            <button
              type="button"
              onClick={() => setModulesOuvert(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-gold-500 px-5 text-sm font-bold text-white shadow-soft ring-1 ring-gold-600/20 transition-colors hover:bg-gold-600"
            >
              <SlidersHorizontal size={16} /> Gestion des modules
              <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold text-white">
                {modules.length}
              </span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {minis.map((m) => (
            <div key={m.libelle} className="flex items-center gap-3 rounded-xl border border-cream-200 bg-white p-4">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${m.ton}`}>
                <m.Icone size={18} />
              </span>
              <div>
                <p className="font-display text-2xl font-bold text-forest-900">{m.valeur.toLocaleString("fr-FR")}</p>
                <p className="text-xs text-ink-700/60">{m.libelle}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sélection d'un CAFOP */}
      <section id="selection" className="rounded-2xl border border-cream-200 bg-white shadow-soft">
        <div className="border-b border-cream-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-forest-900">{T("Sélectionner un CAFOP pour gérer les notes et bulletins")}</h2>
          <p className="text-sm text-ink-700/60">
            {T("Chaque élève-maître d'un CAFOP reçoit son propre bulletin individuel et nominatif, organisé par groupe-classe.")}
          </p>
        </div>
        <div className="divide-y divide-cream-100">
          {centres.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-700/55">{T("Aucun CAFOP enregistré.")}</p>
          ) : (
            centres.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-cream-50/40">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700">
                    <GraduationCap size={17} />
                  </span>
                  <div>
                    <p className="font-semibold text-forest-900">{c.nom}</p>
                    <p className="text-xs text-ink-700/55">{c.drena ? `DRENA ${c.drena} — ${c.pays}` : c.pays}</p>
                  </div>
                </div>
                <Link
                  href={`${BASE}/${c.id}`}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-gold-300 bg-white px-4 text-sm font-semibold text-gold-800 hover:bg-gold-50"
                >
                  {T("Configurer le CAFOP")} <ChevronRight size={15} />
                </Link>
              </div>
            ))
          )}
        </div>
      </section>

      <AnimatePresence>{modulesOuvert && <ModulesModal modules={modules} onFerme={() => setModulesOuvert(false)} />}</AnimatePresence>
    </div>
  );
}

type Agir = (fn: () => Promise<{ ok: boolean; message?: string }>) => void;

const ANNEES = [1, 2, 3] as const;
const libelleAnnee = (n: number) => (n === 1 ? "1re Année" : `${n}e Année`);
const champCls =
  "h-9 w-full rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const dateCls =
  "h-9 w-[8.25rem] rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

/** Coefficient borné côté client, identique à la validation serveur (1..99). */
const coefClient = (s: string) => {
  const v = Math.trunc(Number(s));
  return Number.isFinite(v) ? Math.min(Math.max(v, 1), 99) : 1;
};
/** Clé de rendu incluant les valeurs normalisées : force le re-montage d'une ligne
 * quand le serveur renvoie des valeurs différentes de la saisie (après enregistrement). */
const cleModule = (m: ModuleVue) =>
  [m.id, m.nom, m.code ?? "", m.coefficient, m.semestre ?? "", m.dateDebut ?? "", m.dateFin ?? "", m.datePretest ?? "", m.dateEvaluation ?? "", m.estStage].join(
    "|",
  );

function ModulesModal({ modules, onFerme }: { modules: ModuleVue[]; onFerme: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [annee, setAnnee] = useState(1);

  const agir: Agir = (fn) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.message ?? "Erreur.");
      else router.refresh();
    });
  };

  const liste = modules.filter((m) => m.annee === annee);

  return (
    <Modale titre="Modules de formation" onFerme={() => !pending && onFerme()} xl agrandissable>
      <div className="space-y-4">
        <p className="text-sm text-ink-700/70">
          Matières évaluées dans les bulletins des élèves-maîtres, organisées par niveau de formation. Désactivez un
          module pour l&apos;exclure des bulletins sans le supprimer.
        </p>

        {/* Sélecteur de niveau de formation */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-cream-200 bg-cream-50/50 p-1.5">
          {ANNEES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAnnee(a)}
              className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                a === annee ? "bg-gold-500 text-white shadow-soft" : "text-ink-700/70 hover:bg-cream-200"
              }`}
            >
              {libelleAnnee(a)}
            </button>
          ))}
          <span className="ml-auto pr-2 text-xs text-ink-700/55">
            {liste.length} module(s) · {libelleAnnee(annee)}
          </span>
        </div>

        {msg && <FormAlert ton="erreur">{msg}</FormAlert>}

        {/* Tableau des modules du niveau sélectionné */}
        <div className="overflow-x-auto rounded-xl border border-cream-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/60 text-left text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                <th className="min-w-[11rem] px-3 py-2.5">Module</th>
                <th className="px-2 py-2.5 text-center">Stage</th>
                <th className="px-2 py-2.5">Code</th>
                <th className="px-2 py-2.5">Coef.</th>
                <th className="px-2 py-2.5">Sem.</th>
                <th className="px-2 py-2.5">Début</th>
                <th className="px-2 py-2.5">Fin</th>
                <th className="px-2 py-2.5">Prétest</th>
                <th className="px-2 py-2.5">Évaluation</th>
                <th className="px-2 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {liste.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-sm text-ink-700/55">
                    Aucun module pour {libelleAnnee(annee)}. Ajoutez-en un ci-dessous.
                  </td>
                </tr>
              ) : (
                liste.map((m) => <LigneModule key={cleModule(m)} module={m} pending={pending} agir={agir} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Ajouter un module au niveau sélectionné */}
        <AjouterModule annee={annee} pending={pending} agir={agir} />
      </div>
    </Modale>
  );
}

function ChampLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-700/60">{label}</span>
      {children}
    </label>
  );
}

type Composante = ComposanteModule;

/** Groupe de COMPÉTENCE en cours d'édition, identifié par une clé STABLE (indépendante du nom) :
 * renommer une compétence — même vers un nom vide ou déjà porté par un autre groupe — ne
 * fusionne ni ne disperse donc jamais ses composantes pendant la frappe. */
interface GroupeEdition { cle: number; nom: string }
/** Composante en cours d'édition, rattachée à son groupe par sa clé (null = sans compétence). */
interface ComposanteEdition { nom: string; themes: string[]; groupeCle: number | null }
interface EtatEditeur { groupes: GroupeEdition[]; composantes: ComposanteEdition[]; prochaineCle: number }

/** État d'édition initial dérivé du tableau plat du module (via `grouperParCompetence`). */
function etatDepuisComposantes(composantes: Composante[]): EtatEditeur {
  const groupes: GroupeEdition[] = [];
  const liste: ComposanteEdition[] = [];
  let cle = 0;
  for (const g of grouperParCompetence(composantes)) {
    const groupeCle = g.competence === null ? null : ++cle;
    if (g.competence !== null && groupeCle !== null) groupes.push({ cle: groupeCle, nom: g.competence });
    for (const c of g.composantes) liste.push({ nom: c.nom, themes: c.themes, groupeCle });
  }
  return { groupes, composantes: liste, prochaineCle: cle + 1 };
}

/** Tableau plat renvoyé au serveur : composantes sans compétence d'abord, puis chaque groupe
 * dans l'ordre, chaque composante portant le nom de sa compétence (null si le nom est vide). */
function aplatir(etat: EtatEditeur): Composante[] {
  const nomGroupe = new Map(etat.groupes.map((g) => [g.cle, g.nom.trim() || null] as const));
  const ordre: (number | null)[] = [null, ...etat.groupes.map((g) => g.cle)];
  return ordre.flatMap((cle) =>
    etat.composantes
      .filter((c) => c.groupeCle === cle)
      .map((c) => ({ nom: c.nom, themes: c.themes, competence: cle === null ? null : nomGroupe.get(cle) ?? null })),
  );
}

/**
 * Éditeur partagé de la structure pédagogique d'un module : COMPOSANTES (bouton « Ajouter une
 * composante ») et, pour chaque composante, ses THÈMES (bouton « Ajouter un thème »). Certains
 * modules (ex. TICE) ajoutent un niveau FACULTATIF au-dessus : les COMPÉTENCES (bouton
 * « Ajouter une compétence ») — chaque compétence est un groupe visuel avec son nom et son
 * propre bouton « Ajouter une composante » ; le bouton racine continue de créer des composantes
 * SANS compétence. Utilisé dans la ligne d'un module existant ET dans « Nouveau module ».
 * L'état est INTERNE (initialisé une seule fois depuis `composantes` — remonter via `key` pour
 * réinitialiser) et chaque modification propage le tableau plat au parent via `onChange`.
 */
function EditeurComposantes({
  composantes,
  onChange,
  note,
  titre,
}: {
  composantes: Composante[];
  onChange: (c: Composante[]) => void;
  /** Message affiché quand la liste est vide (contextualise l'usage). */
  note?: string;
  /** Intitulé du bloc (par défaut « Composantes & thèmes ») — adapté pour un stage pratique. */
  titre?: string;
}) {
  const [etat, setEtat] = useState<EtatEditeur>(() => etatDepuisComposantes(composantes));
  const [themeSaisi, setThemeSaisi] = useState<Record<number, string>>({});
  // Clé du groupe dont la suppression attend CONFIRMATION (2 clics inline, pas de window.confirm).
  const [suppressionGroupe, setSuppressionGroupe] = useState<number | null>(null);

  /** Applique le nouvel état d'édition ET propage le tableau plat au parent (payload du module). */
  const appliquer = (n: EtatEditeur) => {
    setEtat(n);
    onChange(aplatir(n));
  };

  const ajouterComposante = (groupeCle: number | null) =>
    appliquer({ ...etat, composantes: [...etat.composantes, { nom: "", themes: [], groupeCle }] });
  const majComposanteNom = (ci: number, nom: string) =>
    appliquer({ ...etat, composantes: etat.composantes.map((c, i) => (i === ci ? { ...c, nom } : c)) });
  const retirerComposante = (ci: number) =>
    appliquer({ ...etat, composantes: etat.composantes.filter((_, i) => i !== ci) });
  const ajouterTheme = (ci: number) => {
    const t = (themeSaisi[ci] ?? "").trim();
    if (!t) return;
    appliquer({
      ...etat,
      composantes: etat.composantes.map((c, i) => (i === ci && !c.themes.includes(t) ? { ...c, themes: [...c.themes, t] } : c)),
    });
    setThemeSaisi((s) => ({ ...s, [ci]: "" }));
  };
  const retirerTheme = (ci: number, ti: number) =>
    appliquer({
      ...etat,
      composantes: etat.composantes.map((c, i) => (i === ci ? { ...c, themes: c.themes.filter((_, j) => j !== ti) } : c)),
    });

  const ajouterGroupe = () =>
    appliquer({ ...etat, groupes: [...etat.groupes, { cle: etat.prochaineCle, nom: "" }], prochaineCle: etat.prochaineCle + 1 });
  /** Renommer la compétence renomme (à l'émission) le champ `competence` de toutes ses composantes. */
  const renommerGroupe = (cle: number, nom: string) =>
    appliquer({ ...etat, groupes: etat.groupes.map((g) => (g.cle === cle ? { ...g, nom } : g)) });
  /** Suppression (confirmée) d'une compétence : retire le groupe ET ses composantes. */
  const supprimerGroupe = (cle: number) => {
    setSuppressionGroupe(null);
    appliquer({
      ...etat,
      groupes: etat.groupes.filter((g) => g.cle !== cle),
      composantes: etat.composantes.filter((c) => c.groupeCle !== cle),
    });
  };

  // Index GLOBAL de chaque composante (position dans etat.composantes, pour les manipulations)
  // + numérotation C1, C2… suivant l'ordre d'affichage (racine puis groupes).
  const composantesIndexees = etat.composantes.map((c, index) => ({ ...c, index }));
  const racine = composantesIndexees.filter((c) => c.groupeCle === null);
  const ordreAffichage = [...racine, ...etat.groupes.flatMap((g) => composantesIndexees.filter((c) => c.groupeCle === g.cle))];
  const numeroPar = new Map(ordreAffichage.map((c, i) => [c.index, i + 1]));
  const nbThemes = etat.composantes.reduce((s, c) => s + c.themes.length, 0);
  const nbGroupes = etat.groupes.length;

  const carteComposante = (c: ComposanteEdition & { index: number }) => (
    <div key={c.index} className="rounded-xl border border-cream-200 bg-white p-2.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-full bg-forest-100 px-2 py-0.5 text-[0.65rem] font-bold text-forest-800">C{numeroPar.get(c.index)}</span>
        <input
          value={c.nom}
          onChange={(e) => majComposanteNom(c.index, e.target.value)}
          placeholder="Nom de la composante"
          className="h-9 flex-1 rounded-lg border border-cream-300 bg-white px-2.5 text-sm font-medium outline-none focus:border-forest-400"
        />
        <button type="button" onClick={() => retirerComposante(c.index)} title="Retirer la composante" className="shrink-0 text-ink-700/40 hover:text-red-600">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
        {c.themes.map((t, ti) => (
          <span key={ti} className="inline-flex items-center gap-1 rounded-full bg-forest-100 px-2 py-0.5 text-xs font-medium text-forest-800">
            {t}
            <button type="button" onClick={() => retirerTheme(c.index, ti)} className="text-forest-700/60 hover:text-red-600" aria-label="Retirer le thème">
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={themeSaisi[c.index] ?? ""}
          onChange={(e) => setThemeSaisi((s) => ({ ...s, [c.index]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterTheme(c.index); } }}
          placeholder="Thème de la composante"
          className="h-7 w-44 rounded-full border border-cream-300 bg-white px-2.5 text-xs outline-none focus:border-forest-400"
        />
        <button
          type="button"
          onClick={() => ajouterTheme(c.index)}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-cream-300 px-2.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
        >
          <Plus size={12} /> Ajouter un thème
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-forest-900">
          <ListTree size={14} /> {titre ?? "Composantes & thèmes"}{" "}
          <span className="font-normal text-ink-700/55">
            ({nbGroupes > 0 ? `${nbGroupes} compétence(s), ` : ""}{etat.composantes.length} composante(s), {nbThemes} thème(s))
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={ajouterGroupe}
            title="Certains modules (ex. TICE) sont structurés en compétences regroupant des composantes"
            className="inline-flex h-8 items-center gap-1 rounded-full border border-gold-300 px-3 text-xs font-semibold text-gold-800 hover:bg-gold-50"
          >
            <Plus size={13} /> Ajouter une compétence
          </button>
          <button
            type="button"
            onClick={() => ajouterComposante(null)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-forest-200 px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50"
          >
            <Plus size={13} /> Ajouter une composante
          </button>
        </div>
      </div>
      {etat.composantes.length === 0 && nbGroupes === 0 ? (
        <p className="mt-2 text-xs text-ink-700/55">
          {note ?? "Aucune composante. Ajoutez-en : elles alimentent la cascade Module → Composante → Thème de la « Nouvelle séance ». Pour un module structuré en compétences (ex. TICE), commencez par « Ajouter une compétence »."}
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {racine.map(carteComposante)}
          {etat.groupes.map((g, gi) => {
            const duGroupe = composantesIndexees.filter((c) => c.groupeCle === g.cle);
            return (
              <div key={g.cle} className="rounded-xl border-2 border-gold-300 bg-gold-50/50 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded-full bg-gold-500 px-2 py-0.5 text-[0.65rem] font-bold text-white">Compétence {gi + 1}</span>
                  <input
                    value={g.nom}
                    onChange={(e) => renommerGroupe(g.cle, e.target.value)}
                    placeholder={`Compétence ${gi + 1} : S'approprier l'environnement numérique…`}
                    className="h-9 min-w-[12rem] flex-1 rounded-lg border border-gold-300 bg-white px-2.5 text-sm font-semibold outline-none focus:border-gold-500"
                  />
                  {suppressionGroupe === g.cle ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[0.65rem] font-semibold text-red-700">
                      Supprimer la compétence et ses {duGroupe.length} composante(s) ?
                      <button type="button" onClick={() => supprimerGroupe(g.cle)} title="Confirmer la suppression" className="rounded-full bg-red-600 p-1 text-white hover:bg-red-700">
                        <Check size={11} />
                      </button>
                      <button type="button" onClick={() => setSuppressionGroupe(null)} title="Annuler" className="rounded-full bg-cream-300 p-1 text-ink-700 hover:bg-cream-400">
                        <X size={11} />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => (duGroupe.length === 0 ? supprimerGroupe(g.cle) : setSuppressionGroupe(g.cle))}
                      title="Supprimer la compétence"
                      className="shrink-0 text-ink-700/40 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {duGroupe.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-700/55">
                    Aucune composante dans cette compétence — ajoutez-en ci-dessous (une compétence sans composante n&apos;est pas enregistrée).
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">{duGroupe.map(carteComposante)}</div>
                )}
                <button
                  type="button"
                  onClick={() => ajouterComposante(g.cle)}
                  className="mt-2 inline-flex h-8 items-center gap-1 rounded-full border border-gold-300 bg-white px-3 text-xs font-semibold text-gold-800 hover:bg-gold-50"
                >
                  <Plus size={13} /> Ajouter une composante
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LigneModule({ module: m, pending, agir }: { module: ModuleVue; pending: boolean; agir: Agir }) {
  const [f, setF] = useState({
    nom: m.nom,
    code: m.code ?? "",
    coefficient: String(m.coefficient),
    semestre: m.semestre ? String(m.semestre) : "",
    dateDebut: m.dateDebut ?? "",
    dateFin: m.dateFin ?? "",
    datePretest: m.datePretest ?? "",
    dateEvaluation: m.dateEvaluation ?? "",
    estStage: m.estStage,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  // ── Composantes → thèmes (éditeur repliable, composant partagé) ──
  const [ouvert, setOuvert] = useState(false);
  const [composantes, setComposantes] = useState<Composante[]>(m.composantes);
  const composantesRef = JSON.stringify(m.composantes);
  const composantesModifiees = JSON.stringify(composantes) !== composantesRef;

  const modifie =
    f.nom !== m.nom ||
    f.code !== (m.code ?? "") ||
    f.coefficient !== String(m.coefficient) ||
    f.semestre !== (m.semestre ? String(m.semestre) : "") ||
    f.dateDebut !== (m.dateDebut ?? "") ||
    f.dateFin !== (m.dateFin ?? "") ||
    f.datePretest !== (m.datePretest ?? "") ||
    f.dateEvaluation !== (m.dateEvaluation ?? "") ||
    f.estStage !== m.estStage ||
    composantesModifiees;

  const enregistrer = () =>
    agir(() =>
      modifierModuleCafop(m.id, {
        nom: f.nom,
        code: f.code,
        coefficient: coefClient(f.coefficient),
        annee: m.annee,
        semestre: f.semestre ? Number(f.semestre) : null,
        dateDebut: f.dateDebut || null,
        dateFin: f.dateFin || null,
        datePretest: f.datePretest || null,
        dateEvaluation: f.dateEvaluation || null,
        composantes,
        estStage: f.estStage,
      }),
    );

  return (
    <>
      <tr className={`border-b border-cream-100 align-middle ${ouvert || !m.actif ? "" : "last:border-0"} ${m.actif ? "" : "bg-cream-50/40"}`}>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <input value={f.nom} onChange={set("nom")} className={`${champCls} font-medium ${m.actif ? "" : "text-ink-700/45"}`} />
            {m.estStage && (
              <span className="shrink-0 rounded-full bg-gold-100 px-2 py-0.5 text-[0.65rem] font-bold text-gold-800">Stage</span>
            )}
          </div>
        </td>
        <td className="px-2 py-2 text-center">
          <input
            type="checkbox"
            checked={f.estStage}
            onChange={(e) => setF((s) => ({ ...s, estStage: e.target.checked }))}
            title="Stage pratique"
            className="h-4 w-4 rounded border-cream-300 text-gold-600 focus:ring-gold-400"
          />
        </td>
        <td className="px-2 py-2">
          <input value={f.code} onChange={set("code")} placeholder="—" className={`${champCls} w-24`} />
        </td>
        <td className="px-2 py-2">
          <input type="number" min={1} max={99} value={f.coefficient} onChange={set("coefficient")} className={`${champCls} w-16`} />
        </td>
        <td className="px-2 py-2">
          <select value={f.semestre} onChange={set("semestre")} className={`${champCls} w-16`}>
            <option value="">—</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </td>
        <td className="px-2 py-2"><input type="date" value={f.dateDebut} onChange={set("dateDebut")} className={dateCls} /></td>
        <td className="px-2 py-2"><input type="date" value={f.dateFin} onChange={set("dateFin")} className={dateCls} /></td>
        <td className="px-2 py-2"><input type="date" value={f.datePretest} onChange={set("datePretest")} className={dateCls} /></td>
        <td className="px-2 py-2"><input type="date" value={f.dateEvaluation} onChange={set("dateEvaluation")} className={dateCls} /></td>
        <td className="px-2 py-2">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setOuvert((v) => !v)}
              title="Composantes & thèmes du module"
              className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${ouvert ? "bg-forest-100 text-forest-800" : "border border-cream-300 text-ink-700/70 hover:bg-cream-100"}`}
            >
              <ListTree size={13} /> Composantes · {composantes.length}
            </button>
            <button
              type="button"
              disabled={pending || !modifie}
              onClick={enregistrer}
              title="Enregistrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-forest-600 text-white hover:bg-forest-700 disabled:bg-cream-200 disabled:text-ink-700/40"
            >
              <Save size={14} />
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => agir(() => basculerModuleCafop(m.id, !m.actif))}
              className={`inline-flex h-8 items-center rounded-full px-2.5 text-xs font-semibold disabled:opacity-50 ${
                m.actif ? "bg-forest-100 text-forest-800 hover:bg-forest-200" : "bg-cream-200 text-ink-700/70 hover:bg-cream-300"
              }`}
            >
              {m.actif ? "Actif" : "Inactif"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => agir(() => supprimerModuleCafop(m.id))}
              title="Supprimer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
      {ouvert && (
        <tr className="border-b border-cream-100 bg-cream-50/50">
          <td colSpan={10} className="px-4 py-3">
            <EditeurComposantes
              composantes={composantes}
              onChange={setComposantes}
              titre={f.estStage ? "Composantes & thèmes (habiletés du stage)" : undefined}
              note="Aucune composante. Ajoutez-en : elles alimentent la cascade Module → Composante → Thème de la « Nouvelle séance ». N'oubliez pas d'enregistrer le module (bouton disquette)."
            />
          </td>
        </tr>
      )}
    </>
  );
}

function AjouterModule({ annee, pending, agir }: { annee: number; pending: boolean; agir: Agir }) {
  const vide = { nom: "", code: "", coefficient: "1", semestre: "", dateDebut: "", dateFin: "", datePretest: "", dateEvaluation: "" };
  const [f, setF] = useState(vide);
  // Structure pédagogique exprimée DÈS la création : [compétences →] composantes → thèmes.
  const [composantes, setComposantes] = useState<Composante[]>([]);
  // L'éditeur porte son propre état interne : la clé le remonte (vide) après une création réussie.
  const [cleEditeur, setCleEditeur] = useState(0);
  const [estStage, setEstStage] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const ajouter = () =>
    agir(async () => {
      const r = await creerModuleCafop({
        nom: f.nom,
        code: f.code,
        coefficient: coefClient(f.coefficient),
        annee,
        semestre: f.semestre ? Number(f.semestre) : null,
        dateDebut: f.dateDebut || null,
        dateFin: f.dateFin || null,
        datePretest: f.datePretest || null,
        dateEvaluation: f.dateEvaluation || null,
        composantes,
        estStage,
      });
      if (r.ok) {
        setF(vide);
        setComposantes([]);
        setCleEditeur((k) => k + 1);
        setEstStage(false);
      }
      return r;
    });

  return (
    <div className="rounded-2xl border-2 border-gold-300 bg-gold-50/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-forest-900">
        <Plus size={16} className="text-gold-700" /> Nouveau module — {libelleAnnee(annee)}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <ChampLabel label="Module *">
            <input value={f.nom} onChange={set("nom")} placeholder="ex. Psychopédagogie" className={champCls} />
          </ChampLabel>
        </div>
        <ChampLabel label="Code"><input value={f.code} onChange={set("code")} placeholder="ex. PSY-101" className={champCls} /></ChampLabel>
        <ChampLabel label="Coefficient"><input type="number" min={1} max={99} value={f.coefficient} onChange={set("coefficient")} className={champCls} /></ChampLabel>
        <ChampLabel label="Semestre">
          <select value={f.semestre} onChange={set("semestre")} className={champCls}>
            <option value="">—</option>
            <option value="1">Semestre 1</option>
            <option value="2">Semestre 2</option>
          </select>
        </ChampLabel>
        <ChampLabel label="Début du module"><input type="date" value={f.dateDebut} onChange={set("dateDebut")} className={champCls} /></ChampLabel>
        <ChampLabel label="Fin du module"><input type="date" value={f.dateFin} onChange={set("dateFin")} className={champCls} /></ChampLabel>
        <ChampLabel label="Prétest"><input type="date" value={f.datePretest} onChange={set("datePretest")} className={champCls} /></ChampLabel>
        <ChampLabel label="Évaluation"><input type="date" value={f.dateEvaluation} onChange={set("dateEvaluation")} className={champCls} /></ChampLabel>
      </div>

      {/* Stage pratique : un stage est enregistré comme un module (composantes/thèmes = habiletés visées). */}
      <label className="mt-3 flex items-start gap-2.5 rounded-xl border border-cream-200 bg-white/70 p-3">
        <input
          type="checkbox"
          checked={estStage}
          onChange={(e) => setEstStage(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-cream-300 text-gold-600 focus:ring-gold-400"
        />
        <span>
          <span className="block text-sm font-semibold text-forest-900">Stage pratique</span>
          <span className="block text-xs text-ink-700/60">
            Un stage est enregistré comme un module ; ses composantes et thèmes décrivent les habiletés visées.
            Plusieurs stages possibles par année.
          </span>
        </span>
      </label>

      {/* Composantes du module (regroupables par compétence) et thèmes, exprimés dès la création. */}
      <div className="mt-3 rounded-xl border border-cream-200 bg-white/70 p-3">
        <EditeurComposantes
          key={cleEditeur}
          composantes={composantes}
          onChange={setComposantes}
          titre={estStage ? "Composantes & thèmes (habiletés du stage)" : undefined}
          note="Aucune composante pour l'instant. Cliquez sur « Ajouter une composante » pour structurer le module, puis « Ajouter un thème » pour les thèmes de chaque composante — ou « Ajouter une compétence » si le module (ex. TICE) regroupe ses composantes par compétence. Le tout sera enregistré avec le module."
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={pending || !f.nom.trim()}
          onClick={ajouter}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gold-500 px-5 text-sm font-semibold text-white hover:bg-gold-600 disabled:opacity-50"
        >
          <Plus size={15} /> Ajouter le module
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { FileText, Users, BookOpen, Award, GraduationCap, ChevronRight, Plus, Trash2, SlidersHorizontal, Save } from "lucide-react";
import { creerModuleCafop, modifierModuleCafop, basculerModuleCafop, supprimerModuleCafop } from "@/lib/formation/actions";
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
}: {
  modules: ModuleVue[];
  centres: CentreLite[];
  regions: { id: string; nom: string }[];
  semestres: number;
  terme?: string;
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
      <EnteteCafop ongletActif="enseignements" nbCentres={centres.length} regions={regions} terme={terme} />

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
  [m.id, m.nom, m.code ?? "", m.coefficient, m.semestre ?? "", m.dateDebut ?? "", m.dateFin ?? "", m.datePretest ?? "", m.dateEvaluation ?? ""].join("|");

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
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-ink-700/55">
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
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const modifie =
    f.nom !== m.nom ||
    f.code !== (m.code ?? "") ||
    f.coefficient !== String(m.coefficient) ||
    f.semestre !== (m.semestre ? String(m.semestre) : "") ||
    f.dateDebut !== (m.dateDebut ?? "") ||
    f.dateFin !== (m.dateFin ?? "") ||
    f.datePretest !== (m.datePretest ?? "") ||
    f.dateEvaluation !== (m.dateEvaluation ?? "");

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
      }),
    );

  return (
    <tr className={`border-b border-cream-100 align-middle last:border-0 ${m.actif ? "" : "bg-cream-50/40"}`}>
      <td className="px-3 py-2">
        <input value={f.nom} onChange={set("nom")} className={`${champCls} font-medium ${m.actif ? "" : "text-ink-700/45"}`} />
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
  );
}

function AjouterModule({ annee, pending, agir }: { annee: number; pending: boolean; agir: Agir }) {
  const vide = { nom: "", code: "", coefficient: "1", semestre: "", dateDebut: "", dateFin: "", datePretest: "", dateEvaluation: "" };
  const [f, setF] = useState(vide);
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
      });
      if (r.ok) setF(vide);
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

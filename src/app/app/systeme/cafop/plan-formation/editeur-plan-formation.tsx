"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Flag, Rows3 } from "lucide-react";
import { FormAlert } from "@/components/ui/form";
import { Modale } from "../entete-cafop";
import {
  enregistrerPlanMeta,
  ajouterSection,
  modifierSection,
  supprimerSection,
  deplacerSection,
  ajouterColonneSection,
  renommerColonneSection,
  retirerColonneSection,
  ajouterLigne,
  modifierLigne,
  supprimerLigne,
  deplacerLigne,
} from "@/lib/formation/plan-formation-actions";
import type { PlanVue, SectionVue, LigneVue } from "./vue-plan-formation";
import { libelleNiveau } from "./vue-plan-formation";

type Resultat = { ok: boolean; message?: string };
type Agir = (fn: () => Promise<Resultat>, apres?: () => void) => void;

const champ = "h-9 w-full rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const zone = "w-full rounded-lg border border-cream-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export function EditeurPlanFormation({ plan, onFerme }: { plan: PlanVue; onFerme: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const agir: Agir = (fn, apres) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.message ?? "Erreur.");
      else {
        apres?.();
        router.refresh();
      }
    });
  };

  return (
    <Modale titre="Espace de production — Plan de formation" onFerme={() => !pending && onFerme()} xl agrandissable>
      <div className="space-y-5">
        <p className="text-sm text-ink-700/70">
          Renseignez le document : présentation, tableaux de volumes (rubriques communes) et plan chronologique de chaque
          niveau. Chaque enregistrement est immédiat.
        </p>
        {msg && <FormAlert ton="erreur">{msg}</FormAlert>}

        <MetaForm plan={plan} pending={pending} agir={agir} />

        {plan.sections.map((s, i) => (
          <SectionEditeur
            key={`${s.id}:${s.niveau}:${s.titre}:${s.colonnes.join("|")}`}
            section={s}
            index={i}
            total={plan.sections.length}
            pending={pending}
            agir={agir}
          />
        ))}

        <AjouterSection planId={plan.id} pending={pending} agir={agir} />
      </div>
    </Modale>
  );
}

function Bloc({ titre, children, actions }: { titre: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold text-forest-900">{titre}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

function MetaForm({ plan, pending, agir }: { plan: PlanVue; pending: boolean; agir: Agir }) {
  const [f, setF] = useState({
    titre: plan.titre,
    anneeScolaire: plan.anneeScolaire,
    intro: plan.intro ?? "",
    signataire: plan.signataire ?? "",
    signataireFonction: plan.signataireFonction ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Bloc
      titre="En-tête du document"
      actions={
        <button
          type="button"
          disabled={pending}
          onClick={() => agir(() => enregistrerPlanMeta(plan.id, f))}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-600 px-4 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
        >
          <Save size={14} /> Enregistrer l&apos;en-tête
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-700/60">Titre</span>
          <input value={f.titre} onChange={set("titre")} className={champ} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-700/60">Année scolaire</span>
          <input value={f.anneeScolaire} onChange={set("anneeScolaire")} placeholder="2025-2026" className={champ} />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-700/60">Présentation (facultatif)</span>
          <textarea value={f.intro} onChange={set("intro")} rows={4} className={zone} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-700/60">Signataire</span>
          <input value={f.signataire} onChange={set("signataire")} placeholder="Ex : ZAMBLÉ Bi Zamblé Germain" className={champ} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-700/60">Fonction du signataire</span>
          <input value={f.signataireFonction} onChange={set("signataireFonction")} placeholder="Ex : Inspecteur…" className={champ} />
        </label>
      </div>
    </Bloc>
  );
}

const NIVEAU_OPTIONS = [
  { v: "", l: "Rubrique commune (volumes)" },
  { v: "1", l: "Plan — 1re Année" },
  { v: "2", l: "Plan — 2e Année" },
  { v: "3", l: "Plan — 3e Année" },
];

function SectionEditeur({
  section,
  index,
  total,
  pending,
  agir,
}: {
  section: SectionVue;
  index: number;
  total: number;
  pending: boolean;
  agir: Agir;
}) {
  const [titre, setTitre] = useState(section.titre);
  const [niveau, setNiveau] = useState(section.niveau == null ? "" : String(section.niveau));
  const [intro, setIntro] = useState(section.intro ?? "");
  const [note, setNote] = useState(section.note ?? "");

  // Les colonnes sont éditées par actions immédiates (ajout/renommage/retrait) : les cellules
  // des lignes restent toujours alignées, sans désynchronisation ni perte de données.
  const enregistrer = () =>
    agir(() =>
      modifierSection(section.id, {
        titre,
        niveau: niveau === "" ? null : Number(niveau),
        intro,
        note,
      }),
    );

  const badge = section.niveau == null ? "Commune" : libelleNiveau(section.niveau);

  return (
    <Bloc
      titre={`Section : ${section.titre}`}
      actions={
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-800">{badge}</span>
          <button type="button" disabled={pending || index === 0} onClick={() => agir(() => deplacerSection(section.id, -1))} title="Monter" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100 disabled:opacity-30">
            <ArrowUp size={15} />
          </button>
          <button type="button" disabled={pending || index === total - 1} onClick={() => agir(() => deplacerSection(section.id, 1))} title="Descendre" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100 disabled:opacity-30">
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => { if (window.confirm(`Supprimer la section « ${section.titre} » et toutes ses lignes ?`)) agir(() => supprimerSection(section.id)); }}
            title="Supprimer la section"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs font-medium text-ink-700/60">Type / niveau</span>
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className={champ}>
              {NIVEAU_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-ink-700/60">Titre de la section</span>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className={champ} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-ink-700/60">Introduction de la section (facultatif)</span>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} className={zone} />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-ink-700/60">Note / mention (facultatif — ex. module TIC)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={zone} />
          </label>
        </div>

        {/* Colonnes — modifications immédiates (les cellules des lignes suivent automatiquement) */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-700/50">Colonnes du tableau</p>
          <div className="flex flex-wrap items-center gap-2">
            {section.colonnes.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-cream-300 bg-cream-50/50 pl-2">
                <input
                  defaultValue={c}
                  disabled={pending}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c) agir(() => renommerColonneSection(section.id, i, v)); }}
                  className="h-8 w-36 bg-transparent text-sm outline-none"
                />
                <button type="button" disabled={pending || section.colonnes.length <= 1} onClick={() => { if (window.confirm(`Retirer la colonne « ${c} » et les cellules correspondantes de toutes les lignes ?`)) agir(() => retirerColonneSection(section.id, i)); }} className="px-1.5 text-ink-700/40 hover:text-red-600 disabled:opacity-30" title="Retirer la colonne">
                  <Trash2 size={13} />
                </button>
              </span>
            ))}
            <button type="button" disabled={pending || section.colonnes.length >= 12} onClick={() => agir(() => ajouterColonneSection(section.id))} className="inline-flex h-8 items-center gap-1 rounded-lg border border-dashed border-cream-400 px-2.5 text-xs font-semibold text-ink-700/70 hover:bg-cream-100 disabled:opacity-40">
              <Plus size={13} /> Colonne
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" disabled={pending} onClick={enregistrer} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-600 px-4 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60">
            <Save size={14} /> Enregistrer titre & options
          </button>
        </div>

        {/* Lignes */}
        <div className="rounded-xl border border-cream-200">
          <div className="border-b border-cream-100 bg-cream-50/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-700/55">
            Lignes ({section.lignes.length})
          </div>
          <div className="divide-y divide-cream-100">
            {section.lignes.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-ink-700/50">Aucune ligne. Ajoutez-en ci-dessous.</p>
            ) : (
              section.lignes.map((l, i) => (
                <LigneEditeur
                  key={`${l.id}:${l.type}:${l.ton ?? ""}:${(l.cellules || []).join("|")}:${l.texte ?? ""}`}
                  ligne={l}
                  colonnes={section.colonnes}
                  index={i}
                  total={section.lignes.length}
                  pending={pending}
                  agir={agir}
                />
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-cream-100 p-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => agir(() => ajouterLigne(section.id, { type: "donnee", cellules: section.colonnes.map(() => "") }))}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gold-500 px-4 text-sm font-semibold text-white hover:bg-gold-600 disabled:opacity-60"
            >
              <Rows3 size={14} /> Ajouter une ligne
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => agir(() => ajouterLigne(section.id, { type: "banniere", ton: "conges", texte: "" }))}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 text-sm font-semibold text-ink-700/75 hover:bg-cream-100 disabled:opacity-60"
            >
              <Flag size={14} /> Ajouter une bannière (congés / jalon)
            </button>
          </div>
        </div>
      </div>
    </Bloc>
  );
}

const TON_OPTIONS = [
  { v: "conges", l: "Congés (or)" },
  { v: "jalon", l: "Jalon (vert)" },
  { v: "note", l: "Note (neutre)" },
];

function LigneEditeur({
  ligne,
  colonnes,
  index,
  total,
  pending,
  agir,
}: {
  ligne: LigneVue;
  colonnes: string[];
  index: number;
  total: number;
  pending: boolean;
  agir: Agir;
}) {
  const banniere = ligne.type === "banniere";
  const [cellules, setCellules] = useState<string[]>(colonnes.map((_, i) => ligne.cellules[i] ?? ""));
  const [texte, setTexte] = useState(ligne.texte ?? "");
  const [ton, setTon] = useState(ligne.ton ?? "conges");
  const [type, setType] = useState(ligne.type === "total" ? "total" : "donnee");

  const enregistrer = () =>
    agir(() =>
      banniere
        ? modifierLigne(ligne.id, { type: "banniere", texte, ton })
        : modifierLigne(ligne.id, { type, cellules }),
    );

  return (
    <div className="flex items-start gap-2 px-3 py-3">
      <div className="min-w-0 flex-1">
        {banniere ? (
          <div className="flex flex-wrap items-start gap-2">
            <select value={ton} onChange={(e) => setTon(e.target.value)} className={`${champ} w-40`}>
              {TON_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={1} placeholder="Texte de la bannière (ex. Congés de Toussaint)" className={`${zone} min-w-[16rem] flex-1`} />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {colonnes.map((c, i) => (
                <label key={i} className="block">
                  <span className="mb-0.5 block text-[0.7rem] font-medium text-ink-700/55">{c || `Colonne ${i + 1}`}</span>
                  <textarea
                    value={cellules[i] ?? ""}
                    onChange={(e) => setCellules((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                    rows={1}
                    className={zone}
                  />
                </label>
              ))}
            </div>
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-700/60">
              <input type="checkbox" checked={type === "total"} onChange={(e) => setType(e.target.checked ? "total" : "donnee")} />
              Ligne de total (mise en avant)
            </label>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" disabled={pending} onClick={enregistrer} title="Enregistrer la ligne" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-forest-600 text-white hover:bg-forest-700 disabled:opacity-50">
          <Save size={13} />
        </button>
        <button type="button" disabled={pending || index === 0} onClick={() => agir(() => deplacerLigne(ligne.id, -1))} title="Monter" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100 disabled:opacity-30">
          <ArrowUp size={14} />
        </button>
        <button type="button" disabled={pending || index === total - 1} onClick={() => agir(() => deplacerLigne(ligne.id, 1))} title="Descendre" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100 disabled:opacity-30">
          <ArrowDown size={14} />
        </button>
        <button type="button" disabled={pending} onClick={() => { if (window.confirm("Supprimer cette ligne ?")) agir(() => supprimerLigne(ligne.id)); }} title="Supprimer" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function AjouterSection({ planId, pending, agir }: { planId: string; pending: boolean; agir: Agir }) {
  const [niveau, setNiveau] = useState("");
  const [titre, setTitre] = useState("");
  const ajouter = () =>
    agir(
      () =>
        ajouterSection(planId, {
          niveau: niveau === "" ? null : Number(niveau),
          titre: titre.trim() || "Nouvelle section",
          colonnes:
            niveau === "3"
              ? ["N°", "Activités d'encadrement", "Durée", "Période d'exécution"]
              : niveau === ""
                ? ["Intitulé", "Volume"]
                : ["N°", "Modules", "Durée", "Nombre de semaine", "Période d'exécution"],
        }),
      () => setTitre(""),
    );
  return (
    <div className="rounded-2xl border-2 border-dashed border-gold-300 bg-gold-50/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-forest-900">
        <Plus size={16} className="text-gold-700" /> Nouvelle section
      </div>
      <div className="grid gap-2 sm:grid-cols-[16rem_1fr_auto]">
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className={champ}>
          {NIVEAU_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre de la section" className={champ} />
        <button type="button" disabled={pending || !titre.trim()} onClick={ajouter} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gold-500 px-5 text-sm font-semibold text-white hover:bg-gold-600 disabled:opacity-50">
          <Plus size={15} /> Ajouter
        </button>
      </div>
    </div>
  );
}

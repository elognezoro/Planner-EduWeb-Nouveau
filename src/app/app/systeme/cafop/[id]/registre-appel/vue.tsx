"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Users, UserCheck, UserX, Clock, ThumbsUp, Eye, HeartPulse, MessageSquareWarning,
  Download, Loader2, Save, Search, Send, MessageCircle, Sparkles, History, X, Printer, ChevronDown,
} from "lucide-react";
import {
  enregistrerAppelCafop,
  justifierAbsenceCafop,
  enregistrerEvenementCafop,
  suggestionEvenementCafop,
  envoyerSmsCafop,
  exporterRegistreCafop,
} from "./actions";
import { type EtatForm } from "@/lib/formation/actions";
import { grouperParCompetence, type ComposanteModule } from "@/lib/formation/structure-module";
import { STATUTS_CAFOP, SEUIL_ALERTE_SMS, type StatutAppelCafop } from "./lib";

// ── Contrats de données (alignés sur la page serveur) ──
export interface EleveAppel {
  id: string;
  nom: string;
  prenoms: string | null;
  matricule: string | null;
  sexe: string | null;
  naissanceLabel: string | null;
  groupe: string | null;
  annee: number | null;
  promotionId: string;
  aTelephone: boolean;
  cumulA: number;
  cumulR: number;
  aNj: number;
  obs: number;
  enc: number;
  inf: number;
  conduite: number;
  alerte: boolean;
}
export interface PresenceVue {
  apprenantId: string;
  date: string; // YYYY-MM-DD
  statut: string;
  motif: string | null;
  justifie: boolean;
}
export interface CelluleHeatmap {
  jour: string;
  heure: string;
  taux: number | null;
}
/** Composante (habileté) d'un module CAFOP, avec ses thèmes et sa COMPÉTENCE facultative —
 * cascade Module → [Compétence →] Composante → Thème (forme partagée structure-module.ts). */
export type ComposanteModuleAppel = ComposanteModule;

/** Action par élève ouverte depuis la colonne ACTIONS. */
type TypeAction = "encouragement" | "observation" | "infirmerie" | "sms" | "justifier";

const initial: EtatForm = { ok: false };
const champ =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const labelCls = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60";
const chip = "rounded-full border border-cream-300 px-3 py-1.5 text-xs font-medium text-forest-800 hover:bg-forest-50";

const nomComplet = (e: EleveAppel) => [e.nom, e.prenoms].filter(Boolean).join(" ");

const couleurTaux = (pct: number) =>
  pct >= 95 ? "bg-forest-800 text-cream-50" :
  pct >= 90 ? "bg-forest-600 text-cream-50" :
  pct >= 80 ? "bg-forest-400 text-white" :
  pct >= 70 ? "bg-gold-300 text-forest-900" : "bg-red-300 text-red-950";

const STYLE_STATUT: Record<StatutAppelCafop, string> = {
  present: "bg-forest-700 text-cream-50 border-forest-700",
  absent: "bg-red-600 text-white border-red-600",
  retard: "bg-amber-500 text-white border-amber-500",
};

/**
 * Liste déroulante à choix MULTIPLES (panneau de cases à cocher) : bouton compact affichant le
 * nombre de valeurs cochées, panneau qui se ferme au clic extérieur. Utilisé pour les composantes
 * (habiletés) et thèmes du module choisi — chaque case cochée alimente un champ répété côté
 * enregistrement (`composantes` / `themes`, lus via `formData.getAll` côté serveur).
 * Options fournies par SECTIONS : un `titre` non nul (la COMPÉTENCE des composantes, pour les
 * modules type TICE) est affiché en sous-titre ; une section unique au titre null = liste plate.
 */
function SelecteurMultiple({
  label,
  sections,
  selection,
  onToggle,
}: {
  label: string;
  sections: { titre: string | null; options: string[] }[];
  selection: Set<string>;
  onToggle: (valeur: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className={labelCls}>{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${champ} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selection.size > 0 ? "text-forest-900" : "text-ink-700/50"}`}>
          {selection.size > 0 ? `${selection.size} sélectionné(s)` : "Toutes"}
        </span>
        <ChevronDown size={15} className="shrink-0 text-ink-700/40" />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1.5 w-full min-w-[14rem] overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft">
          <ul className="max-h-56 space-y-0.5 overflow-y-auto p-1.5">
            {sections.map((s, si) => (
              <li key={s.titre ?? `section-${si}`}>
                {s.titre && (
                  <p className="px-2.5 pb-0.5 pt-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-gold-800">{s.titre}</p>
                )}
                <ul className="space-y-0.5">
                  {s.options.map((o) => (
                    <li key={o}>
                      <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-forest-800 hover:bg-cream-100 ${s.titre ? "ml-2" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selection.has(o)}
                          onChange={() => onToggle(o)}
                          className="h-4 w-4 shrink-0 rounded border-cream-300 text-forest-700 focus:ring-forest-300"
                        />
                        <span className="truncate">{o}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {sections.every((s) => s.options.length === 0) && <p className="px-2.5 py-3 text-center text-xs text-ink-700/50">Aucune option.</p>}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RegistreAppelCafop({
  cafopId,
  cafopNom,
  promotions,
  modules,
  groupes,
  eleves,
  presences,
  heatmap,
  heures,
  disciplines,
  enseignants,
  defaultDate,
  lectureSeule = false,
}: {
  cafopId: string;
  cafopNom: string;
  promotions: { id: string; libelle: string }[];
  modules: { id: string; nom: string; annee: number; composantes?: ComposanteModuleAppel[] }[];
  groupes: string[];
  eleves: EleveAppel[];
  presences: PresenceVue[];
  heatmap: CelluleHeatmap[];
  heures: string[];
  disciplines: string[];
  enseignants: { id: string; nom: string }[];
  defaultDate: string;
  /** Rôle en lecture seule (adc/delc) : masque l'enregistrement de l'appel, les SMS et les actions élève. */
  lectureSeule?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  // ── Filtres (état client, pas d'URL) ──
  const [promoSel, setPromoSel] = useState(promotions[0]?.id ?? "");
  const [groupeSel, setGroupeSel] = useState("");
  const [anneeSel, setAnneeSel] = useState<number | "">("");
  const [disciplineSel, setDisciplineSel] = useState("");
  const [moduleSel, setModuleSel] = useState("");
  // Composantes (habiletés) et thèmes cochés pour le module choisi — réinitialisés quand le module change.
  const [composantesSel, setComposantesSel] = useState<Set<string>>(new Set());
  const [themesSel, setThemesSel] = useState<Set<string>>(new Set());
  const [enseignantSel, setEnseignantSel] = useState("");
  const [heureDebut, setHeureDebut] = useState<string>("07:30");
  const [heureFin, setHeureFin] = useState<string>("08:30");
  // Créneau de la séance = « début - fin » : c'est l'identité de la séance dans le registre (clé heureSeance).
  const heureCreneau = heureDebut ? (heureFin ? `${heureDebut} - ${heureFin}` : heureDebut) : "";
  const [date, setDate] = useState(defaultDate);
  const [recherche, setRecherche] = useState("");

  // ── Édition locale du statut / motif du jour (clé : `${apprenantId}|${date}`) ──
  const [statuts, setStatuts] = useState<Record<string, StatutAppelCafop>>({});
  const [motifs, setMotifs] = useState<Record<string, string>>({});

  const presenceDuJour = useMemo(() => {
    const m = new Map<string, PresenceVue>();
    for (const p of presences) if (p.date === date) m.set(p.apprenantId, p);
    return m;
  }, [presences, date]);

  const statutDe = (id: string): StatutAppelCafop => {
    const local = statuts[`${id}|${date}`];
    if (local) return local;
    const s = presenceDuJour.get(id)?.statut;
    return s === "absent" || s === "retard" ? s : "present";
  };
  const motifDe = (id: string): string => {
    const local = motifs[`${id}|${date}`];
    if (local !== undefined) return local;
    return presenceDuJour.get(id)?.motif ?? "";
  };

  const poserStatut = (id: string, s: StatutAppelCafop) => {
    setMessage(null);
    setStatuts((m) => ({ ...m, [`${id}|${date}`]: s }));
  };
  const poserMotif = (id: string, v: string) => setMotifs((m) => ({ ...m, [`${id}|${date}`]: v }));

  // Niveaux (années de formation) présents dans la promotion sélectionnée.
  const annees = useMemo(
    () => [...new Set(eleves.filter((e) => e.promotionId === promoSel).map((e) => e.annee).filter((a): a is number => a != null))].sort((a, b) => a - b),
    [eleves, promoSel],
  );
  // Modules filtrés par le niveau choisi (cascade Niveau → Module).
  const modulesNiveau = useMemo(() => (anneeSel === "" ? modules : modules.filter((m) => m.annee === anneeSel)), [modules, anneeSel]);
  // Composantes (habiletés) du module choisi, et thèmes disponibles (des composantes cochées, ou tous si aucune cochée).
  const composantesDuModule = useMemo(() => modules.find((m) => m.id === moduleSel)?.composantes ?? [], [modules, moduleSel]);
  const themesDisponibles = useMemo(() => {
    const source = composantesSel.size > 0 ? composantesDuModule.filter((c) => composantesSel.has(c.nom)) : composantesDuModule;
    return [...new Set(source.flatMap((c) => c.themes))];
  }, [composantesDuModule, composantesSel]);
  const basculerComposante = (nom: string) =>
    setComposantesSel((prev) => {
      const next = new Set(prev);
      if (next.has(nom)) next.delete(nom);
      else next.add(nom);
      // Purge des thèmes qui ne sont plus proposés avec la nouvelle sélection de composantes.
      const source = next.size > 0 ? composantesDuModule.filter((c) => next.has(c.nom)) : composantesDuModule;
      const dispo = new Set(source.flatMap((c) => c.themes));
      setThemesSel((prevT) => new Set([...prevT].filter((t) => dispo.has(t))));
      return next;
    });
  const basculerTheme = (nom: string) =>
    setThemesSel((prev) => {
      const next = new Set(prev);
      if (next.has(nom)) next.delete(nom);
      else next.add(nom);
      return next;
    });
  // ── Roster de la séance (promotion + groupe + niveau) : c'est le PÉRIMÈTRE de l'enregistrement ──
  const elevesSeance = useMemo(
    () => eleves.filter((e) => e.promotionId === promoSel && (!groupeSel || e.groupe === groupeSel) && (anneeSel === "" || e.annee === anneeSel)),
    [eleves, promoSel, groupeSel, anneeSel],
  );
  // ── Vue filtrée par la recherche : n'affecte QUE l'affichage, jamais l'enregistrement ──
  const elevesFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return elevesSeance;
    return elevesSeance.filter((e) => `${e.nom} ${e.prenoms ?? ""} ${e.matricule ?? ""}`.toLowerCase().includes(q));
  }, [elevesSeance, recherche]);

  const enAlerte = useMemo(() => elevesSeance.filter((e) => e.alerte), [elevesSeance]);

  // ── Sélection ──
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const basculer = (id: string) =>
    setSelection((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectionner = (ids: string[]) => setSelection(new Set(ids));

  const [action, setAction] = useState<{ type: TypeAction; eleve: EleveAppel } | null>(null);

  const toutMettre = (s: StatutAppelCafop) => {
    setMessage(null);
    setStatuts((m) => {
      const n = { ...m };
      for (const e of elevesSeance) n[`${e.id}|${date}`] = s;
      return n;
    });
  };

  // ── Bilan de l'appel (KPI) — sur le roster de la séance (indépendant de la recherche) ──
  const bilan = useMemo(() => {
    const nb = (s: StatutAppelCafop) => elevesSeance.filter((e) => statutDe(e.id) === s).length;
    return [
      { libelle: "Effectif total", valeur: elevesSeance.length, icone: <Users size={18} />, accent: "neutre" as const },
      { libelle: "Présents (P)", valeur: nb("present"), icone: <UserCheck size={18} />, accent: "vert" as const },
      { libelle: "Absents (A)", valeur: nb("absent"), icone: <UserX size={18} />, accent: "rouge" as const },
      { libelle: "Retards (R)", valeur: nb("retard"), icone: <Clock size={18} />, accent: "or" as const },
      { libelle: "Encouragements", valeur: elevesSeance.reduce((s, e) => s + e.enc, 0), icone: <ThumbsUp size={18} />, accent: "vert" as const },
      { libelle: "Observations", valeur: elevesSeance.reduce((s, e) => s + e.obs, 0), icone: <Eye size={18} />, accent: "or" as const },
      { libelle: "Infirmerie", valeur: elevesSeance.reduce((s, e) => s + e.inf, 0), icone: <HeartPulse size={18} />, accent: "neutre" as const },
      { libelle: "Alertes SMS", valeur: enAlerte.length, icone: <MessageSquareWarning size={18} />, accent: (enAlerte.length > 0 ? "rouge" : "neutre") as "rouge" | "neutre" },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevesSeance, statuts, presenceDuJour, enAlerte]);

  const accents: Record<string, string> = {
    vert: "text-forest-700",
    rouge: "text-red-600",
    or: "text-gold-700",
    neutre: "text-forest-900",
  };

  // ── Enregistrement de l'appel ──
  function enregistrer() {
    setMessage(null);
    start(async () => {
      const fd = new FormData();
      fd.set("cafopId", cafopId);
      fd.set("date", date);
      if (groupeSel) fd.set("groupe", groupeSel);
      if (heureCreneau) fd.set("heureSeance", heureCreneau);
      if (moduleSel) fd.set("moduleId", moduleSel);
      if (disciplineSel) fd.set("discipline", disciplineSel);
      if (enseignantSel) fd.set("enseignantId", enseignantSel);
      // Composantes/thèmes cochés (habiletés de la séance) — champs répétés lus via formData.getAll côté serveur.
      for (const c of composantesSel) fd.append("composantes", c);
      for (const t of themesSel) fd.append("themes", t);
      // Périmètre = roster de la séance (promotion + groupe), JAMAIS réduit par la recherche.
      for (const e of elevesSeance) {
        fd.set(`statut_${e.id}`, statutDe(e.id));
        fd.set(`motif_${e.id}`, motifDe(e.id));
      }
      const res = await enregistrerAppelCafop(initial, fd);
      setMessage({ ok: res.ok, texte: res.message ?? "" });
      if (res.ok) router.refresh();
    });
  }

  function envoyerSms(ids: string[]) {
    if (ids.length === 0) {
      setMessage({ ok: false, texte: "Sélectionnez au moins un élève-maître." });
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set("cafopId", cafopId);
      fd.set("apprenantIds", JSON.stringify(ids));
      const res = await envoyerSmsCafop(initial, fd);
      setMessage({ ok: res.ok, texte: res.message ?? "" });
      if (res.ok) router.refresh();
    });
  }

  function exporter() {
    start(async () => {
      const res = await exporterRegistreCafop({ cafopId, groupe: groupeSel || null });
      if (!res.ok || !res.csv) {
        setMessage({ ok: false, texte: res.message ?? "Export impossible." });
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.nom ?? "registre-appel-cafop.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  const heatmapVide = !heatmap || heatmap.every((c) => c.taux === null);

  return (
    <div className="space-y-6">
      {/* En-tête officiel imprimable */}
      <div className="hidden print:block">
        <div className="text-center">
          <p className="font-display text-base font-bold tracking-wide text-forest-900">{cafopNom}</p>
          <p className="mt-1 text-sm font-semibold text-forest-800">Registre d&apos;appel</p>
          <p className="mt-0.5 text-xs text-ink-700/70">
            Séance du {date}
            {heureCreneau ? ` · ${heureCreneau}` : ""}
            {groupeSel ? ` · Groupe ${groupeSel}` : ""}
          </p>
        </div>
      </div>

      {/* Barre d'actions : export / impression */}
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-5 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50"
        >
          <Printer size={15} /> Imprimer / PDF
        </button>
        <button
          onClick={exporter}
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-5 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-60"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Exporter
        </button>
      </div>

      {/* Navigation rapide */}
      <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-soft print:hidden">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-ink-700/50">Aller à</span>
          {[["#bilan", "Bilan de l'appel"], ["#liste", "Liste des élèves"], ["#heatmap", "Heatmap de présence"]].map(([href, l]) => (
            <a key={href} href={href} className="rounded-full border border-cream-300 px-3 py-1.5 font-medium text-forest-800 hover:bg-forest-50">
              {l}
            </a>
          ))}
        </div>
      </section>

      {/* Filtres */}
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft print:hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <label className={labelCls}>Promotion</label>
            <select value={promoSel} onChange={(e) => { setPromoSel(e.target.value); setGroupeSel(""); setAnneeSel(""); }} className={champ}>
              {promotions.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Niveau</label>
            <select value={anneeSel === "" ? "" : String(anneeSel)} onChange={(e) => { setAnneeSel(e.target.value === "" ? "" : Number(e.target.value)); setModuleSel(""); setComposantesSel(new Set()); setThemesSel(new Set()); }} className={champ}>
              <option value="">Tous</option>
              {annees.map((a) => <option key={a} value={a}>{a === 1 ? "1re Année" : `${a}e Année`}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Groupe-classe</label>
            <select value={groupeSel} onChange={(e) => setGroupeSel(e.target.value)} className={champ}>
              <option value="">Tous</option>
              {groupes.map((g) => <option key={g} value={g}>{`Groupe ${g}`}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Discipline</label>
            <select value={disciplineSel} onChange={(e) => setDisciplineSel(e.target.value)} className={champ}>
              <option value="">Toutes</option>
              {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Module</label>
            <select
              value={moduleSel}
              onChange={(e) => { setModuleSel(e.target.value); setComposantesSel(new Set()); setThemesSel(new Set()); }}
              className={champ}
            >
              <option value="">Toutes</option>
              {modulesNiveau.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          {moduleSel && composantesDuModule.length > 0 && (
            <>
              <div>
                <SelecteurMultiple
                  label="Composantes (habiletés)"
                  // Composantes regroupées sous leur COMPÉTENCE quand le module en a (ex. TICE).
                  sections={grouperParCompetence(composantesDuModule).map((g) => ({ titre: g.competence, options: g.composantes.map((c) => c.nom) }))}
                  selection={composantesSel}
                  onToggle={basculerComposante}
                />
              </div>
              <div>
                <SelecteurMultiple
                  label="Thèmes"
                  sections={[{ titre: null, options: themesDisponibles }]}
                  selection={themesSel}
                  onToggle={basculerTheme}
                />
              </div>
            </>
          )}
          <div>
            <label className={labelCls}>Enseignant</label>
            <select value={enseignantSel} onChange={(e) => setEnseignantSel(e.target.value)} className={champ}>
              <option value="">{enseignants.length === 0 ? "— (aucun compte enseignant)" : "Tous"}</option>
              {enseignants.map((ens) => <option key={ens.id} value={ens.id}>{ens.nom}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Heure de début de séance</label>
            <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className={champ} />
          </div>
          <div>
            <label className={labelCls}>Heure de fin de séance</label>
            <input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} className={champ} />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
          </div>
          <div>
            <label className={labelCls}>Rechercher</label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Nom, prénoms, matricule…"
                className={`${champ} pl-8`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bilan de l'appel */}
      <section id="bilan" className="scroll-mt-24 rounded-3xl border border-cream-200 bg-white p-6 shadow-soft">
        <h2 className="mb-4 font-display text-lg font-bold text-forest-900">Bilan de l&apos;appel</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {bilan.map((k) => (
            <div key={k.libelle} className="rounded-2xl border border-cream-200 bg-cream-50/50 p-3 text-center">
              <span className={`mx-auto flex h-8 w-8 items-center justify-center ${accents[k.accent]}`}>{k.icone}</span>
              <p className={`font-display text-xl font-bold ${accents[k.accent]}`}>{k.valeur}</p>
              <p className="mt-0.5 text-[0.65rem] leading-tight text-ink-700/60">{k.libelle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Liste des élèves-maîtres */}
      <section id="liste" className="scroll-mt-24 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-100 px-5 py-3.5">
          <h2 className="font-display text-lg font-bold text-forest-900">
            Liste des élèves-maîtres
            <span className="ml-2 text-xs font-normal text-ink-700/55">({elevesFiltres.length})</span>
          </h2>
          <div className="flex gap-2 print:hidden">
            <button onClick={() => toutMettre("present")} className={chip}>Tout P</button>
            <button onClick={() => toutMettre("absent")} className={chip}>Tout A</button>
          </div>
        </div>

        {/* Barre de sélection */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-100 bg-cream-50/50 px-5 py-2.5 print:hidden">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-700/65">
            <span className="font-semibold">{selection.size} sélectionné(s)</span>
            <span className="text-ink-700/40">· Sélection rapide :</span>
            <button onClick={() => selectionner(elevesFiltres.filter((e) => statutDe(e.id) === "absent").map((e) => e.id))} className={chip}>Absents</button>
            <button onClick={() => selectionner(elevesFiltres.filter((e) => statutDe(e.id) === "retard").map((e) => e.id))} className={chip}>Retards</button>
            <button onClick={() => selectionner(enAlerte.map((e) => e.id))} className={chip}>Alerte SMS (≥{SEUIL_ALERTE_SMS})</button>
          </div>
          <button
            onClick={() => envoyerSms([...selection])}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-700 px-4 text-xs font-semibold text-cream-50 hover:bg-forest-600 disabled:opacity-60"
          >
            <Send size={13} /> SMS aux élèves-maîtres
          </button>
        </div>

        {elevesFiltres.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-700/60">Aucun élève-maître ne correspond aux filtres.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-cream-200 bg-cream-50/60 text-left text-[0.65rem] uppercase tracking-wide text-ink-700/55">
                  <th className="w-10 px-4 py-3 print:hidden">
                    <input
                      type="checkbox"
                      checked={selection.size === elevesFiltres.length && elevesFiltres.length > 0}
                      onChange={(e) => selectionner(e.target.checked ? elevesFiltres.map((x) => x.id) : [])}
                      aria-label="Tout sélectionner"
                    />
                  </th>
                  <th className="px-2 py-3 font-semibold">N°</th>
                  <th className="px-3 py-3 font-semibold">Nom et prénom</th>
                  <th className="px-2 py-3 font-semibold">Sexe</th>
                  <th className="px-3 py-3 font-semibold">Statut</th>
                  <th className="px-3 py-3 font-semibold">Motif</th>
                  <th className="px-3 py-3 font-semibold">Cumul</th>
                  <th className="px-3 py-3 font-semibold print:hidden">Actions</th>
                  <th className="px-3 py-3 font-semibold">Conduite</th>
                </tr>
              </thead>
              <tbody>
                {elevesFiltres.map((e, idx) => {
                  const s = statutDe(e.id);
                  return (
                    <tr key={e.id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/40">
                      <td className="px-4 py-2.5 print:hidden">
                        <input
                          type="checkbox"
                          checked={selection.has(e.id)}
                          onChange={() => basculer(e.id)}
                          aria-label={`Sélectionner ${nomComplet(e)}`}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-xs text-ink-700/55">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-forest-900">{nomComplet(e)}</p>
                        <p className="text-[0.68rem] text-ink-700/50">
                          {e.matricule ?? "—"}
                          {e.naissanceLabel ? ` · né(e) le ${e.naissanceLabel}` : ""}
                        </p>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.65rem] font-bold ${e.sexe === "F" ? "bg-rose-100 text-rose-700" : e.sexe === "M" ? "bg-sky-100 text-sky-700" : "bg-cream-200 text-ink-700/50"}`}>
                          {e.sexe ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          {STATUTS_CAFOP.map((o) => (
                            <button
                              key={o.v}
                              type="button"
                              title={o.libelle}
                              onClick={() => poserStatut(e.id, o.v)}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[0.7rem] font-bold transition-colors ${
                                s === o.v ? STYLE_STATUT[o.v] : "border-cream-300 bg-white text-ink-700/50 hover:border-forest-300"
                              }`}
                            >
                              {o.court}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {s === "present" ? (
                          <span className="text-xs text-ink-700/35">—</span>
                        ) : (
                          <input
                            value={motifDe(e.id)}
                            onChange={(ev) => poserMotif(e.id, ev.target.value)}
                            placeholder="Motif…"
                            className="h-8 w-32 rounded-lg border border-cream-300 bg-white px-2 text-xs outline-none focus:border-forest-400"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          {e.cumulA > 0 && (
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${e.alerte ? "bg-red-100 text-red-700" : "bg-cream-200 text-forest-800"}`}>
                              {e.cumulA}A
                            </span>
                          )}
                          {e.cumulR > 0 && <span className="rounded-full bg-gold-100 px-2 py-0.5 font-semibold text-gold-800">{e.cumulR}R</span>}
                          {e.cumulA === 0 && e.cumulR === 0 && <span className="text-ink-700/35">0</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 print:hidden">
                        {!lectureSeule && (
                        <div className="flex items-center gap-1">
                          {(
                            [
                              { t: "encouragement" as const, Icone: ThumbsUp, titre: "Encouragement", classes: "border-forest-200 bg-forest-50 text-forest-600 hover:bg-forest-100 hover:text-forest-700" },
                              { t: "observation" as const, Icone: Eye, titre: "Observation", classes: "border-orange-200 bg-orange-50 text-orange-500 hover:bg-orange-100 hover:text-orange-600" },
                              { t: "infirmerie" as const, Icone: HeartPulse, titre: "Infirmerie", classes: "border-pink-200 bg-pink-50 text-pink-500 hover:bg-pink-100 hover:text-pink-600" },
                              { t: "sms" as const, Icone: MessageCircle, titre: "SMS à l'élève-maître", classes: "border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700" },
                            ]
                          ).map(({ t, Icone, titre, classes }) => (
                            <button
                              key={t}
                              type="button"
                              title={titre}
                              onClick={() => setAction({ type: t, eleve: e })}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${classes}`}
                            >
                              <Icone size={13} />
                            </button>
                          ))}
                          {e.aNj > 0 && (
                            <button
                              type="button"
                              title="Justifier les absences / retards"
                              onClick={() => setAction({ type: "justifier", eleve: e })}
                              className="ml-1 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[0.7rem] font-semibold text-white hover:bg-blue-500"
                            >
                              <History size={12} /> Justifier ({e.aNj})
                            </button>
                          )}
                        </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            e.conduite >= 16 ? "bg-forest-100 text-forest-800" : e.conduite >= 12 ? "bg-gold-100 text-gold-800" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {e.conduite.toLocaleString("fr-FR")}/20
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pied : seuil + SMS groupé + Enregistrer — masqué en lecture seule (adc/delc). */}
        {!lectureSeule && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-100 px-5 py-3.5 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gold-100 px-3 py-1.5 text-xs font-semibold text-gold-800">
              Seuil d&apos;alerte SMS : {SEUIL_ALERTE_SMS} absences
            </span>
            <button
              onClick={() => envoyerSms(enAlerte.map((e) => e.id))}
              disabled={pending || enAlerte.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
            >
              <Send size={13} /> SMS groupé ({enAlerte.length})
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {message && (
              <span className={`min-w-0 text-xs font-medium ${message.ok ? "text-forest-700" : "text-red-600"}`}>{message.texte}</span>
            )}
            <button
              onClick={enregistrer}
              disabled={pending || elevesFiltres.length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-7 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5 hover:bg-forest-700 disabled:opacity-60"
            >
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer l&apos;appel
            </button>
          </div>
        </div>
        )}
      </section>

      {/* Heatmap de présence */}
      <section id="heatmap" className="scroll-mt-24 rounded-3xl border border-cream-200 bg-white p-6 shadow-soft print:hidden">
        <h2 className="font-display text-lg font-bold text-forest-900">Heatmap de présence</h2>
        <p className="mb-4 mt-1 text-xs text-ink-700/60">Taux de présence par jour et créneau (toutes les séances horodatées du centre).</p>
        {heatmapVide ? (
          <p className="text-sm text-ink-700/55">
            Aucune séance horodatée pour l&apos;instant : enregistrez des appels avec une « heure de la séance » pour alimenter la heatmap.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="pr-2" />
                  {heures.map((h) => (
                    <th key={h} className="px-1 pb-1 text-center font-medium text-ink-700/60">{h.split(" - ")[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...new Set(heatmap.map((c) => c.jour))].map((jour) => (
                  <tr key={jour}>
                    <td className="pr-2 font-medium text-ink-700/70">{jour}</td>
                    {heures.map((h) => {
                      const cell = heatmap.find((c) => c.jour === jour && c.heure === h);
                      const taux = cell?.taux ?? null;
                      return (
                        <td key={h}>
                          <div className={`flex h-9 w-12 items-center justify-center rounded-lg font-semibold ${taux === null ? "bg-cream-100 text-ink-700/30" : couleurTaux(taux)}`}>
                            {taux === null ? "—" : `${taux}`}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modale d'action par élève-maître */}
      <AnimatePresence>
        {action && (
          <ModalAction
            action={action}
            cafopId={cafopId}
            cafopNom={cafopNom}
            date={date}
            heureSeance={heureCreneau}
            groupe={groupeSel || null}
            onClose={() => setAction(null)}
            onDone={(ok, texte) => {
              setMessage({ ok, texte });
              setAction(null);
              if (ok) router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Modale d'action (encouragement / observation / infirmerie / SMS / justifier)
// ─────────────────────────────────────────────────────────────
const THEMES: Record<
  Exclude<TypeAction, "justifier">,
  { titre: string; sousTitre: string; Icone: typeof ThumbsUp; pastille: string; bouton: string }
> = {
  encouragement: {
    titre: "Encouragement",
    sousTitre: "Pour assiduité et implication dans la formation",
    Icone: ThumbsUp,
    pastille: "bg-forest-50 text-forest-600",
    bouton: "bg-forest-700 hover:bg-forest-600",
  },
  observation: {
    titre: "Observation",
    sousTitre: "Pour comportement à recadrer",
    Icone: Eye,
    pastille: "bg-orange-50 text-orange-500",
    bouton: "bg-orange-500 hover:bg-orange-400",
  },
  infirmerie: {
    titre: "Infirmerie",
    sousTitre: "Passage à l'infirmerie",
    Icone: HeartPulse,
    pastille: "bg-pink-50 text-pink-500",
    bouton: "bg-pink-600 hover:bg-pink-500",
  },
  sms: {
    titre: "SMS à l'élève-maître",
    sousTitre: "Message envoyé sur le numéro de l'élève-maître",
    Icone: MessageCircle,
    pastille: "bg-sky-50 text-sky-600",
    bouton: "bg-forest-800 hover:bg-forest-700",
  },
};

function ModalAction({
  action,
  cafopId,
  cafopNom,
  date,
  heureSeance,
  groupe,
  onClose,
  onDone,
}: {
  action: { type: TypeAction; eleve: EleveAppel };
  cafopId: string;
  cafopNom: string;
  date: string;
  heureSeance: string | null;
  groupe: string | null;
  onClose: () => void;
  onDone: (ok: boolean, texte: string) => void;
}) {
  const { type, eleve } = action;
  const evenement = type === "encouragement" || type === "observation" || type === "infirmerie";
  const [description, setDescription] = useState("");
  const [accompagnateur, setAccompagnateur] = useState("");
  const [motifJustif, setMotifJustif] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Pré-remplissage de la suggestion à l'ouverture : effet avec garde d'annulation ; le setState
  // n'a lieu que dans le callback asynchrone → conforme à react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!evenement) return;
    let actif = true;
    suggestionEvenementCafop({ cafopId, apprenantId: eleve.id, type }).then((r) => {
      if (!actif) return;
      if (r.ok && r.texte) setDescription(r.texte);
      else if (!r.ok) setErreur(r.message ?? "Suggestion indisponible.");
    });
    return () => {
      actif = false;
    };
  }, [evenement, cafopId, eleve.id, type]);

  function regenerer() {
    if (!evenement) return;
    setChargement(true);
    suggestionEvenementCafop({ cafopId, apprenantId: eleve.id, type }).then((r) => {
      if (r.ok && r.texte) setDescription(r.texte);
      setChargement(false);
    });
  }

  function enregistrer() {
    setErreur(null);
    start(async () => {
      const fd = new FormData();
      if (type === "sms") {
        fd.set("cafopId", cafopId);
        fd.set("apprenantIds", JSON.stringify([eleve.id]));
        fd.set("message", description);
        const res = await envoyerSmsCafop({ ok: false }, fd);
        if (res.ok) onDone(true, res.message ?? "SMS envoyé.");
        else setErreur(res.message ?? "Échec de l'envoi.");
      } else if (type === "justifier") {
        fd.set("cafopId", cafopId);
        fd.set("apprenantId", eleve.id);
        if (motifJustif.trim()) fd.set("motif", motifJustif.trim());
        const res = await justifierAbsenceCafop({ ok: false }, fd);
        if (res.ok) onDone(true, res.message ?? "Justifié.");
        else setErreur(res.message ?? "Erreur technique.");
      } else {
        fd.set("cafopId", cafopId);
        fd.set("apprenantId", eleve.id);
        fd.set("type", type);
        fd.set("date", date);
        if (heureSeance) fd.set("heureSeance", heureSeance);
        if (groupe) fd.set("groupe", groupe);
        fd.set("description", description);
        if (accompagnateur) fd.set("accompagnateur", accompagnateur);
        const res = await enregistrerEvenementCafop({ ok: false }, fd);
        if (res.ok) onDone(true, res.message ?? "Enregistré.");
        else setErreur(res.message ?? "Erreur technique.");
      }
    });
  }

  const theme = evenement || type === "sms" ? THEMES[type as Exclude<TypeAction, "justifier">] : null;
  const nom = [eleve.nom, eleve.prenoms].filter(Boolean).join(" ");

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-forest-950/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="fixed left-1/2 top-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft"
      >
        <div className="flex items-start justify-between px-6 pt-5">
          <div className="flex items-center gap-3">
            {theme ? (
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${theme.pastille}`}>
                <theme.Icone size={20} />
              </span>
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <History size={20} />
              </span>
            )}
            <div>
              <h2 className="font-display text-xl font-bold text-forest-900">
                {theme ? theme.titre : "Justifier les absences"}
              </h2>
              <p className="text-xs text-ink-700/60">{theme ? theme.sousTitre : "Marque comme justifiés les absences et retards non justifiés"}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-6">
          {/* Fiche élève-maître */}
          <div className="rounded-2xl border border-cream-200 bg-cream-50/60 px-4 py-3">
            <p className="font-semibold text-forest-900">{nom}</p>
            <p className="text-xs text-ink-700/60">
              {cafopNom} · {date}
              {eleve.naissanceLabel ? ` · né(e) le ${eleve.naissanceLabel}` : ""}
            </p>
          </div>

          {erreur && <p className="text-sm font-medium text-red-600">{erreur}</p>}

          {type === "justifier" ? (
            <>
              <p className="text-sm text-ink-700/70">
                Cet élève-maître totalise <strong>{eleve.aNj}</strong> absence(s)/retard(s) non justifié(s).
                Confirmer la justification les marquera tous comme justifiés (ils ne compteront plus dans la conduite ni les alertes).
              </p>
              <div>
                <label className={labelCls}>Motif (optionnel)</label>
                <input
                  value={motifJustif}
                  onChange={(ev) => setMotifJustif(ev.target.value)}
                  placeholder="Ex : certificat médical, autorisation…"
                  className="h-11 w-full rounded-2xl border border-cream-300 bg-white px-3.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
                  Annuler
                </button>
                <button
                  onClick={enregistrer}
                  disabled={pending}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  {pending ? <Loader2 size={15} className="animate-spin" /> : <History size={15} />} Justifier
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60">
                    {type === "sms" ? "Message" : "Description"}
                  </label>
                  {evenement && (
                    <button
                      type="button"
                      onClick={regenerer}
                      disabled={chargement}
                      className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[0.7rem] font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-60"
                    >
                      {chargement ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Suggestion
                    </button>
                  )}
                </div>
                <textarea
                  value={description}
                  onChange={(ev) => setDescription(ev.target.value)}
                  rows={4}
                  placeholder={chargement ? "Génération de la suggestion…" : type === "sms" ? "Message personnalisé (laisser vide pour le message automatique)…" : "Description…"}
                  className="w-full rounded-2xl border border-cream-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                />
                {evenement && (
                  <p className="mt-1 text-[0.68rem] text-ink-700/50">
                    Suggestion générée selon le profil de l&apos;élève-maître — librement modifiable.
                  </p>
                )}
              </div>

              {type === "infirmerie" && (
                <div>
                  <label className={labelCls}>Accompagnateur (optionnel)</label>
                  <input
                    value={accompagnateur}
                    onChange={(ev) => setAccompagnateur(ev.target.value)}
                    placeholder="Nom de l'élève-maître accompagnateur…"
                    className="h-11 w-full rounded-2xl border border-cream-300 bg-white px-3.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
                  Annuler
                </button>
                <button
                  onClick={enregistrer}
                  disabled={pending || chargement || (type !== "sms" && !description.trim())}
                  className={`inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white disabled:opacity-60 ${theme?.bouton}`}
                >
                  {pending ? <Loader2 size={15} className="animate-spin" /> : theme ? <theme.Icone size={15} /> : null}
                  {type === "sms" ? "Envoyer" : "Enregistrer"}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}

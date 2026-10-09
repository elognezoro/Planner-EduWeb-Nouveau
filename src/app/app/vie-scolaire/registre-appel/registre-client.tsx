"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Download, Loader2, Save, Search, Send, BadgeCheck, ThumbsUp, Eye, HeartPulse,
  MessageCircle, Sparkles, History, X, SlidersHorizontal, Printer, MoreHorizontal, CheckSquare,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";
import { FiltresMobiles } from "@/components/app/mobile/filtres-mobiles";
import { useEcranMobile } from "@/lib/mobile/appareil";
import {
  enregistrerAppel,
  justifierAbsences,
  envoyerSmsParents,
  exporterRegistre,
  enregistrerEvenement,
  suggestionEvenement,
  historiqueAbsences,
  enregistrerBareme,
  type EtatForm,
  type LigneHistorique,
} from "./actions";
import { STATUTS_APPEL, type BaremeConduite, type StatutAppel } from "./lib";

export interface LigneEleve {
  eleveId: string;
  nom: string;
  sousTexte: string;
  sexe: string | null;
  dateNaissance: string | null;
  statut: StatutAppel;
  motif: string;
  cumulA: number;
  cumulR: number;
  aJustifier: number;
  conduite: number;
  alerte: boolean;
}

/** Action par élève ouverte depuis la colonne ACTIONS. */
type TypeAction = "encouragement" | "observation" | "infirmerie" | "sms" | "historique";

/** Formatage français d'un poids du barème (0.25 → « 0,25 »). */
function fr(n: number): string {
  return n.toLocaleString("fr-FR");
}

const initial: EtatForm = { ok: false };
// « mobile:text-base » : 16 px au moins dans un champ, sinon iOS zoome à la saisie.
const champ =
  "h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:text-base";

// ─────────────────────────────────────────────────────────────
//  Filtres de séance (navigation par URL, sans bouton Charger)
// ─────────────────────────────────────────────────────────────
export function FiltresRegistre({
  basePath,
  etabParam,
  classes,
  disciplines,
  heures,
  valeurs,
}: {
  basePath: string;
  etabParam: string | null;
  classes: { id: string; nom: string }[];
  disciplines: { id: string; nom: string }[];
  heures: string[];
  valeurs: { classe: string; discipline: string; heure: string; date: string; q: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState(valeurs.q);

  function naviguer(surcharges: Partial<typeof valeurs>) {
    const v = { ...valeurs, q, ...surcharges };
    const params = new URLSearchParams();
    if (etabParam) params.set("etab", etabParam);
    if (v.classe) params.set("classe", v.classe);
    if (v.discipline) params.set("discipline", v.discipline);
    if (v.heure) params.set("heure", v.heure);
    if (v.date) params.set("date", v.date);
    if (v.q.trim()) params.set("q", v.q.trim());
    router.push(`${basePath}?${params.toString()}`);
  }

  const label = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60 mobile:text-xs mobile:normal-case mobile:tracking-normal";
  // Contrôles secondaires : rendus à leur place dans la grille de l'ordinateur et, sur téléphone,
  // dans la feuille « Autres filtres » (mêmes valeurs, même navigation).
  const champDiscipline = (
    <>
      <label className={label}>Discipline (matière)</label>
      <select value={valeurs.discipline} onChange={(e) => naviguer({ discipline: e.target.value })} className={champ}>
        <option value="">— Toutes —</option>
        {disciplines.map((d) => (
          <option key={d.id} value={d.id}>{d.nom}</option>
        ))}
      </select>
    </>
  );
  const champHeure = (
    <>
      <label className={label}>Heure de la séance</label>
      <select value={valeurs.heure} onChange={(e) => naviguer({ heure: e.target.value })} className={champ}>
        {heures.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </>
  );
  const champRecherche = (
    <>
      <label className={label}>Rechercher</label>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => q !== valeurs.q && naviguer({})}
          onKeyDown={(e) => e.key === "Enter" && naviguer({})}
          placeholder="Nom ou prénom…"
          className={`${champ} pl-8`}
        />
      </div>
    </>
  );
  const filtresActifs = (valeurs.discipline ? 1 : 0) + (valeurs.heure && valeurs.heure !== heures[0] ? 1 : 0) + (valeurs.q.trim() ? 1 : 0);
  return (
    <Card className="mobile:p-4">
      {/* Téléphone : Classe et Date restent en tête, sur une ligne ; le reste passe dans la feuille. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mobile:grid-cols-2">
        <div>
          <label className={label}>Classe pédagogique</label>
          <select value={valeurs.classe} onChange={(e) => naviguer({ classe: e.target.value })} className={champ}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
        <div className="mobile:hidden">{champDiscipline}</div>
        <div className="mobile:hidden">{champHeure}</div>
        <div>
          <label className={label}>Date</label>
          <input type="date" value={valeurs.date} onChange={(e) => naviguer({ date: e.target.value })} className={champ} />
        </div>
        <div className="mobile:hidden">{champRecherche}</div>
      </div>
      <div className="mt-3 lg:hidden print:hidden">
        <FiltresMobiles actifs={filtresActifs} titre="Autres filtres">
          <div>{champDiscipline}</div>
          <div>{champHeure}</div>
          <div>{champRecherche}</div>
        </FiltresMobiles>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Export CSV du registre
// ─────────────────────────────────────────────────────────────
export function BoutonExporter({
  classeId,
  date,
  disciplineId,
  heureSeance,
}: {
  classeId: string;
  date: string;
  disciplineId: string | null;
  heureSeance: string | null;
}) {
  const [pending, start] = useTransition();

  function exporter() {
    start(async () => {
      const res = await exporterRegistre({ classeId, date, disciplineId, heureSeance });
      if (!res.ok || !res.csv) return;
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.nom ?? "registre-appel.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  return (
    <button
      onClick={exporter}
      disabled={pending}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-200 bg-white px-5 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-60"
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Exporter
    </button>
  );
}

/**
 * Version imprimable : les styles `print:` masquent le chrome applicatif ;
 * l'en-tête officiel (adapté au pays de l'établissement) devient l'en-tête du document.
 */
export function BoutonImprimer() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-200 bg-white px-5 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50"
    >
      <Printer size={15} /> Imprimer
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
//  Tableau interactif des élèves
// ─────────────────────────────────────────────────────────────
/** Actions par élève, dans la feuille du téléphone (mêmes actions que la colonne ACTIONS). */
const ACTIONS_ELEVE = [
  { t: "encouragement" as const, Icone: ThumbsUp, titre: "Encouragement", pastille: "bg-forest-50 text-forest-600" },
  { t: "observation" as const, Icone: Eye, titre: "Observation", pastille: "bg-orange-50 text-orange-500" },
  { t: "infirmerie" as const, Icone: HeartPulse, titre: "Infirmerie", pastille: "bg-pink-50 text-pink-500" },
  { t: "sms" as const, Icone: MessageCircle, titre: "SMS au parent", pastille: "bg-sky-50 text-sky-600" },
];

const STYLE_STATUT: Record<StatutAppel, { actif: string; libelle: string }> = {
  present: { actif: "bg-forest-700 text-cream-50 border-forest-700", libelle: "Présent" },
  absent: { actif: "bg-red-600 text-white border-red-600", libelle: "Absent" },
  retard: { actif: "bg-gold-500 text-white border-gold-500", libelle: "Retard" },
  excuse: { actif: "bg-sky-600 text-white border-sky-600", libelle: "Excusé" },
};

export function RegistreTable({
  classeId,
  classeNom,
  date,
  disciplineId,
  heureSeance,
  eleves,
  seuil,
  filtreActif,
  bareme,
  etablissementId,
  peutModifierBareme,
}: {
  classeId: string;
  classeNom: string;
  date: string;
  disciplineId: string | null;
  heureSeance: string | null;
  eleves: LigneEleve[];
  seuil: number;
  filtreActif: boolean;
  bareme: BaremeConduite;
  etablissementId: string | null;
  peutModifierBareme: boolean;
}) {
  const router = useRouter();
  const [statuts, setStatuts] = useState<Record<string, StatutAppel>>({});
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [action, setAction] = useState<{ type: TypeAction; eleve: LigneEleve } | null>(null);
  const [baremeOuvert, setBaremeOuvert] = useState(false);
  // Téléphone : feuille des actions d'UN élève (l'élève reste affiché pendant la fermeture) et
  // feuille des actions de la LISTE (sélection rapide, SMS).
  const [eleveMenu, setEleveMenu] = useState<LigneEleve | null>(null);
  const [menuEleveOuvert, setMenuEleveOuvert] = useState(false);
  const [menuListeOuvert, setMenuListeOuvert] = useState(false);
  const [pending, start] = useTransition();
  const touches = useRef<Set<string>>(new Set());

  // Synchronise l'état local depuis le serveur, sans écraser les lignes éditées non enregistrées.
  useEffect(() => {
    setStatuts((prev) => {
      const suivant = { ...prev };
      for (const e of eleves) if (!touches.current.has(e.eleveId)) suivant[e.eleveId] = e.statut;
      return suivant;
    });
    setMotifs((prev) => {
      const suivant = { ...prev };
      for (const e of eleves) if (!touches.current.has(e.eleveId)) suivant[e.eleveId] = e.motif;
      return suivant;
    });
  }, [eleves]);

  const statutDe = (id: string): StatutAppel => statuts[id] ?? "present";
  const enAlerte = eleves.filter((e) => e.alerte);
  // Résumé « 28 P · 3 A · 1 R » de la barre d'enregistrement collante (téléphone).
  const compte: Record<StatutAppel, number> = { present: 0, absent: 0, retard: 0, excuse: 0 };
  for (const e of eleves) compte[statutDe(e.eleveId)]++;

  function poserStatut(id: string, s: StatutAppel) {
    touches.current.add(id);
    setStatuts((p) => ({ ...p, [id]: s }));
  }
  function toutMettre(s: StatutAppel) {
    for (const e of eleves) touches.current.add(e.eleveId);
    setStatuts((p) => {
      const n = { ...p };
      for (const e of eleves) n[e.eleveId] = s;
      return n;
    });
  }
  function selectionner(ids: string[]) {
    setSelection(new Set(ids));
  }
  function basculer(id: string) {
    setSelection((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function enregistrer() {
    start(async () => {
      const fd = new FormData();
      fd.set("classeId", classeId);
      fd.set("date", date);
      if (disciplineId) fd.set("disciplineId", disciplineId);
      if (heureSeance) fd.set("heureSeance", heureSeance);
      for (const e of eleves) {
        fd.set(`statut_${e.eleveId}`, statutDe(e.eleveId));
        fd.set(`motif_${e.eleveId}`, motifs[e.eleveId] ?? "");
      }
      const res = await enregistrerAppel(initial, fd);
      setMessage({ ok: res.ok, texte: res.message ?? "" });
      if (res.ok) {
        touches.current.clear();
        router.refresh();
      }
    });
  }

  function justifier(eleveId: string) {
    start(async () => {
      const fd = new FormData();
      fd.set("classeId", classeId);
      fd.set("eleveId", eleveId);
      const res = await justifierAbsences(initial, fd);
      setMessage({ ok: res.ok, texte: res.message ?? "" });
      if (res.ok) router.refresh();
    });
  }

  function envoyerSms(ids: string[]) {
    if (ids.length === 0) {
      setMessage({ ok: false, texte: "Sélectionnez au moins un élève (ou utilisez « SMS groupé » pour les élèves en alerte)." });
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set("classeId", classeId);
      fd.set("eleveIds", JSON.stringify(ids));
      const res = await envoyerSmsParents(initial, fd);
      setMessage({ ok: res.ok, texte: res.message ?? "" });
      if (res.ok) router.refresh();
    });
  }

  const chip =
    "rounded-full border border-cream-300 px-3 py-1.5 text-xs font-medium text-forest-800 hover:bg-forest-50";

  if (eleves.length === 0) {
    return (
      <Card>
        <h2 className="mb-2 font-display text-lg font-bold text-forest-900">Liste des élèves — {classeNom}</h2>
        <p className="text-sm text-ink-700/65">
          {filtreActif
            ? "Aucun élève ne correspond à la recherche."
            : "Aucun élève inscrit dans cette classe. Inscrivez des élèves d'abord (Vie scolaire → Inscriptions)."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      {/* En-tête de la liste */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-100 px-5 py-3.5 mobile:flex-col mobile:items-stretch mobile:px-4">
        <h2 className="font-display text-lg font-bold text-forest-900">
          Liste des élèves — {classeNom}
          {filtreActif && <span className="ml-2 text-xs font-normal text-ink-700/55">(filtrés)</span>}
        </h2>
        {/* Téléphone : Tout P / Tout A au pouce, et « Plus » ouvre la sélection rapide et les SMS
            (la barre de sélection de l'ordinateur est masquée). */}
        <div className="flex gap-2 print:hidden mobile:grid mobile:grid-cols-3">
          <button onClick={() => toutMettre("present")} className={`${chip} mobile:h-11 mobile:text-sm`}>Tout P</button>
          <button onClick={() => toutMettre("absent")} className={`${chip} mobile:h-11 mobile:text-sm`}>Tout A</button>
          <button
            type="button"
            onClick={() => setMenuListeOuvert(true)}
            aria-haspopup="dialog"
            className={`${chip} hidden mobile:inline-flex mobile:h-11 mobile:items-center mobile:justify-center mobile:gap-1.5 mobile:text-sm`}
          >
            <MoreHorizontal size={16} aria-hidden /> Plus
            {selection.size > 0 && <span className="tabular-nums">({selection.size})</span>}
          </button>
        </div>
      </div>

      {/* Barre de sélection */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-100 bg-cream-50/50 px-5 py-2.5 print:hidden mobile:hidden">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-700/65">
          <span className="font-semibold">{selection.size} sélectionné(s)</span>
          <span className="text-ink-700/40">· Sélection rapide :</span>
          <button onClick={() => selectionner(eleves.filter((e) => statutDe(e.eleveId) === "absent").map((e) => e.eleveId))} className={chip}>Absents</button>
          <button onClick={() => selectionner(eleves.filter((e) => statutDe(e.eleveId) === "retard").map((e) => e.eleveId))} className={chip}>Retards</button>
          <button onClick={() => selectionner(enAlerte.map((e) => e.eleveId))} className={chip}>
            Alerte SMS ({enAlerte.length})
          </button>
        </div>
        <button
          onClick={() => envoyerSms([...selection])}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-700 px-4 text-xs font-semibold text-cream-50 hover:bg-forest-600 disabled:opacity-60"
        >
          <Send size={13} /> SMS aux parents
        </button>
      </div>

      {/* Tableau (remplacé à l'écran du téléphone par les cartes ci-dessous ; imprimé tel quel) */}
      <div className="overflow-x-auto masque-ecran-mobile">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-200 bg-cream-50/60 text-left text-[0.65rem] uppercase tracking-wide text-ink-700/55">
              <th className="w-10 px-4 py-3 print:hidden">
                <input
                  type="checkbox"
                  checked={selection.size === eleves.length && eleves.length > 0}
                  onChange={(e) => selectionner(e.target.checked ? eleves.map((x) => x.eleveId) : [])}
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
            {eleves.map((e, idx) => {
              const s = statutDe(e.eleveId);
              return (
                <tr key={e.eleveId} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/40">
                  <td className="px-4 py-2.5 print:hidden">
                    <input
                      type="checkbox"
                      checked={selection.has(e.eleveId)}
                      onChange={() => basculer(e.eleveId)}
                      aria-label={`Sélectionner ${e.nom}`}
                    />
                  </td>
                  <td className="px-2 py-2.5 text-xs text-ink-700/55">{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-forest-900">{e.nom}</p>
                    <p className="text-[0.68rem] text-ink-700/50">{e.sousTexte}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.65rem] font-bold ${e.sexe === "F" ? "bg-rose-100 text-rose-700" : e.sexe === "M" ? "bg-sky-100 text-sky-700" : "bg-cream-200 text-ink-700/50"}`}>
                      {e.sexe ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      {STATUTS_APPEL.map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          title={o.libelle}
                          onClick={() => poserStatut(e.eleveId, o.v)}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[0.7rem] font-bold transition-colors ${
                            s === o.v ? STYLE_STATUT[o.v].actif : "border-cream-300 bg-white text-ink-700/50 hover:border-forest-300"
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
                        value={motifs[e.eleveId] ?? ""}
                        onChange={(ev) => {
                          touches.current.add(e.eleveId);
                          setMotifs((p) => ({ ...p, [e.eleveId]: ev.target.value }));
                        }}
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
                    <div className="flex items-center gap-1">
                      {(
                        [
                          {
                            t: "encouragement" as const,
                            Icone: ThumbsUp,
                            titre: "Encouragement",
                            classes: "border-forest-200 bg-forest-50 text-forest-600 hover:bg-forest-100 hover:text-forest-700",
                          },
                          {
                            t: "observation" as const,
                            Icone: Eye,
                            titre: "Observation",
                            classes: "border-orange-200 bg-orange-50 text-orange-500 hover:bg-orange-100 hover:text-orange-600",
                          },
                          {
                            t: "infirmerie" as const,
                            Icone: HeartPulse,
                            titre: "Infirmerie",
                            classes: "border-pink-200 bg-pink-50 text-pink-500 hover:bg-pink-100 hover:text-pink-600",
                          },
                          {
                            t: "sms" as const,
                            Icone: MessageCircle,
                            titre: "SMS au parent",
                            classes: "border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700",
                          },
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
                      {e.aJustifier > 0 ? (
                        <button
                          type="button"
                          onClick={() => setAction({ type: "historique", eleve: e })}
                          className="ml-1 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[0.7rem] font-semibold text-white hover:bg-blue-500"
                        >
                          <History size={12} /> Justifier ({e.aJustifier})
                        </button>
                      ) : e.cumulA + e.cumulR > 0 ? (
                        <button
                          type="button"
                          title="Historique d'absences"
                          onClick={() => setAction({ type: "historique", eleve: e })}
                          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
                        >
                          <History size={13} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        e.conduite >= 18 ? "bg-forest-100 text-forest-800" : e.conduite >= 14 ? "bg-gold-100 text-gold-800" : "bg-red-100 text-red-700"
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

      {/* Téléphone : une carte par élève — nom lisible, statut au pouce avec libellés complets,
          motif pleine largeur, autres actions dans une feuille. Même état (statuts, motifs,
          sélection) que le tableau : aucune logique dupliquée. */}
      <div className="lg:hidden print:hidden">
        <ul className="divide-y divide-cream-100">
          {eleves.map((e, idx) => {
            const s = statutDe(e.eleveId);
            const choisi = selection.has(e.eleveId);
            return (
              <li key={e.eleveId} className={`px-4 py-3.5 ${choisi ? "bg-forest-50/60" : ""}`}>
                <div className="flex items-start gap-2.5">
                  <span className="w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-ink-700/60">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-forest-900 wrap-break-word">{e.nom}</p>
                    {e.sousTexte && <p className="text-xs text-ink-700/70 wrap-break-word">{e.sousTexte}</p>}
                    {choisi && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-forest-700">
                        <CheckSquare size={13} aria-hidden /> Sélectionné pour le SMS
                      </p>
                    )}
                  </div>
                  {/* Lettre visible masquée au lecteur d'écran, libellé complet en sr-only
                      (un aria-label sur un span sans rôle serait ignoré). */}
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${e.sexe === "F" ? "bg-rose-100 text-rose-700" : e.sexe === "M" ? "bg-sky-100 text-sky-700" : "bg-cream-200 text-ink-700/70"}`}
                  >
                    <span aria-hidden>{e.sexe ?? "—"}</span>
                    <span className="sr-only">{e.sexe === "F" ? "Fille" : e.sexe === "M" ? "Garçon" : "Sexe non renseigné"}</span>
                  </span>
                  <span
                    title="Note de conduite"
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                      e.conduite >= 18 ? "bg-forest-100 text-forest-800" : e.conduite >= 14 ? "bg-gold-100 text-gold-800" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {e.conduite.toLocaleString("fr-FR")}/20
                  </span>
                </div>
                <div role="group" aria-label={`Statut de ${e.nom}`} className="mt-2.5 grid grid-cols-4 gap-1.5">
                  {STATUTS_APPEL.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      aria-pressed={s === o.v}
                      onClick={() => poserStatut(e.eleveId, o.v)}
                      className={`h-12 min-w-0 rounded-xl border px-0.5 text-xs font-bold transition-colors ${
                        s === o.v ? STYLE_STATUT[o.v].actif : "border-cream-300 bg-white text-ink-700/75 active:bg-cream-100"
                      }`}
                    >
                      {o.libelle}
                    </button>
                  ))}
                </div>
                {s !== "present" && (
                  <input
                    value={motifs[e.eleveId] ?? ""}
                    onChange={(ev) => {
                      touches.current.add(e.eleveId);
                      setMotifs((p) => ({ ...p, [e.eleveId]: ev.target.value }));
                    }}
                    placeholder="Motif…"
                    aria-label={`Motif — ${e.nom}`}
                    enterKeyHint="done"
                    className="mt-2 h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-base outline-none focus:border-forest-400"
                  />
                )}
                {/* Pastilles et « Justifier » insécables ; ce qui ne tient pas passe à la ligne. */}
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                  <span className="text-ink-700/70">Cumul :</span>
                  {e.cumulA > 0 && (
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${e.alerte ? "bg-red-100 text-red-700" : "bg-cream-200 text-forest-800"}`}>
                      {e.cumulA} A
                    </span>
                  )}
                  {e.cumulR > 0 && <span className="whitespace-nowrap rounded-full bg-gold-100 px-2 py-0.5 font-semibold text-gold-800">{e.cumulR} R</span>}
                  {e.cumulA === 0 && e.cumulR === 0 && <span className="text-ink-700/70">aucun</span>}
                  {e.aJustifier > 0 && (
                    <button
                      type="button"
                      onClick={() => setAction({ type: "historique", eleve: e })}
                      className="ml-auto inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-600 px-3.5 text-xs font-semibold text-white active:bg-blue-500"
                    >
                      <History size={14} aria-hidden /> Justifier ({e.aJustifier})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEleveMenu(e);
                      setMenuEleveOuvert(true);
                    }}
                    aria-haspopup="dialog"
                    aria-label={`Autres actions pour ${e.nom}`}
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cream-300 bg-white text-forest-800 active:bg-cream-100 ${e.aJustifier > 0 ? "" : "ml-auto"}`}
                  >
                    <MoreHorizontal size={20} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Actions d'un élève (colonne ACTIONS de l'ordinateur) */}
        <FeuilleBas ouvert={menuEleveOuvert} onFermer={() => setMenuEleveOuvert(false)} titre={eleveMenu?.nom ?? "Élève"}>
          {eleveMenu && (
            <div className="space-y-1 px-2 pb-2">
              {ACTIONS_ELEVE.map(({ t, Icone, titre, pastille }) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setMenuEleveOuvert(false);
                    setAction({ type: t, eleve: eleveMenu });
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 text-left font-medium text-forest-900 active:bg-cream-100"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${pastille}`}>
                    <Icone size={18} aria-hidden />
                  </span>
                  {titre}
                </button>
              ))}
              {eleveMenu.cumulA + eleveMenu.cumulR > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuEleveOuvert(false);
                    setAction({ type: "historique", eleve: eleveMenu });
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 text-left font-medium text-forest-900 active:bg-cream-100"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <History size={18} aria-hidden />
                  </span>
                  {eleveMenu.aJustifier > 0 ? `Historique et justification (${eleveMenu.aJustifier})` : "Historique d'absences"}
                </button>
              )}
              <button
                type="button"
                onClick={() => basculer(eleveMenu.eleveId)}
                aria-pressed={selection.has(eleveMenu.eleveId)}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 text-left font-medium text-forest-900 active:bg-cream-100"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream-100 text-forest-800">
                  <CheckSquare size={18} aria-hidden />
                </span>
                {selection.has(eleveMenu.eleveId) ? "Retirer de la sélection SMS" : "Sélectionner pour le SMS aux parents"}
              </button>
            </div>
          )}
        </FeuilleBas>

        {/* Actions de la liste : sélection rapide et SMS (barre de sélection et pied de l'ordinateur) */}
        <FeuilleBas ouvert={menuListeOuvert} onFermer={() => setMenuListeOuvert(false)} titre="Sélection et SMS">
          <div className="space-y-4 px-2 pb-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-forest-900">
                {selection.size} élève{selection.size > 1 ? "s" : ""} sélectionné{selection.size > 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { libelle: "Absents", ids: () => eleves.filter((e) => statutDe(e.eleveId) === "absent").map((e) => e.eleveId) },
                  { libelle: "Retards", ids: () => eleves.filter((e) => statutDe(e.eleveId) === "retard").map((e) => e.eleveId) },
                  { libelle: `Alerte SMS (${enAlerte.length})`, ids: () => enAlerte.map((e) => e.eleveId) },
                  {
                    libelle: selection.size === eleves.length ? "Aucun" : "Tous",
                    ids: () => (selection.size === eleves.length ? [] : eleves.map((e) => e.eleveId)),
                  },
                ].map((r) => (
                  <button
                    key={r.libelle}
                    type="button"
                    onClick={() => selectionner(r.ids())}
                    className="min-h-11 rounded-full border border-cream-300 bg-white px-3 text-sm font-medium text-forest-800 active:bg-cream-100"
                  >
                    {r.libelle}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuListeOuvert(false);
                envoyerSms([...selection]);
              }}
              disabled={pending}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-forest-700 px-4 text-sm font-semibold text-cream-50 active:bg-forest-600 disabled:opacity-60"
            >
              <Send size={16} aria-hidden /> SMS aux parents ({selection.size})
            </button>
            <div className="rounded-2xl bg-gold-50 p-3 ring-1 ring-inset ring-gold-200">
              <p className="text-sm font-semibold text-gold-800">Seuil d&apos;alerte SMS : {seuil} absences</p>
              <button
                type="button"
                onClick={() => {
                  setMenuListeOuvert(false);
                  envoyerSms(enAlerte.map((e) => e.eleveId));
                }}
                disabled={pending || enAlerte.length === 0}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 active:bg-forest-50 disabled:opacity-50"
              >
                <Send size={15} aria-hidden /> SMS groupé ({enAlerte.length})
              </button>
            </div>
          </div>
        </FeuilleBas>
      </div>

      {/* Pied : seuil + SMS groupé + Enregistrer.
          Téléphone : barre COLLANTE au-dessus des onglets — « Enregistrer » et le message de
          résultat restent visibles pendant tout l'appel ; seuil et SMS groupé passent dans « Plus ».
          Collée AU-DESSUS de la bulle de l'assistant (fixe, onglets + 4.75rem), jamais dessous. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-100 px-5 py-3.5 print:hidden mobile:sticky mobile:bottom-[calc(var(--hauteur-barre-onglets)+5.25rem)] mobile:z-20 mobile:mx-2 mobile:mb-2 mobile:rounded-2xl mobile:border mobile:border-cream-200 mobile:bg-white/95 mobile:px-3 mobile:py-2.5 mobile:shadow-soft mobile:backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 mobile:hidden">
          <span className="rounded-full bg-gold-100 px-3 py-1.5 text-xs font-semibold text-gold-800">
            Seuil d&apos;alerte SMS : {seuil} absences
          </span>
          <button
            onClick={() => envoyerSms(enAlerte.map((e) => e.eleveId))}
            disabled={pending || enAlerte.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
          >
            <Send size={13} /> SMS groupé ({enAlerte.length})
          </button>
        </div>
        {/* Téléphone : message de résultat sur sa propre ligne, au-dessus du bouton. */}
        {message && (
          <p role="status" className={`hidden text-sm font-medium ${message.ok ? "text-forest-700" : "text-red-600"} mobile:block mobile:w-full`}>
            {message.texte}
          </p>
        )}
        {/* Téléphone : le bouton ne descend jamais sous la largeur de son contenu ; faute de
            place (320 px, excusés), il passe sous le bilan, en pleine largeur. */}
        <div className="flex flex-wrap items-center gap-3 mobile:w-full mobile:gap-3">
          {message && (
            <span className={`min-w-0 text-xs font-medium ${message.ok ? "text-forest-700" : "text-red-600"} mobile:hidden`}>{message.texte}</span>
          )}
          {/* Téléphone : bilan de la saisie en cours, à côté du bouton. */}
          <span className="hidden shrink-0 text-sm font-semibold tabular-nums text-forest-900 mobile:inline">
            {compte.present} P · {compte.absent} A · {compte.retard} R{compte.excuse > 0 ? ` · ${compte.excuse} E` : ""}
          </span>
          <button
            onClick={enregistrer}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-7 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5 hover:bg-forest-700 disabled:opacity-60 mobile:min-w-fit mobile:flex-1 mobile:justify-center mobile:px-4"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
          </button>
        </div>
      </div>

      {/* Légende conduite — barème de l'établissement */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cream-100 px-5 py-2.5 mobile:px-4">
        <p className="text-[0.68rem] text-ink-700/50 mobile:text-xs mobile:text-ink-700/70">
          Conduite /20 = 20 − {fr(bareme.absenceNj)} × absence nj − {fr(bareme.retardNj)} × retard nj −{" "}
          {fr(bareme.observation)} × observation + {fr(bareme.encouragement)} × encouragement (bornée 0..20 ; infirmerie
          neutre). Barème propre à l&apos;établissement.
        </p>
        {peutModifierBareme && etablissementId && (
          <button
            type="button"
            onClick={() => setBaremeOuvert(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1 text-[0.7rem] font-semibold text-forest-800 hover:bg-forest-50 print:hidden mobile:h-11 mobile:text-xs"
          >
            <SlidersHorizontal size={12} /> Ajuster le barème
          </button>
        )}
      </div>

      {/* Modales d'action par élève */}
      <AnimatePresence>
        {action && (
          <ModalAction
            action={action}
            classeId={classeId}
            classeNom={classeNom}
            date={date}
            heureSeance={heureSeance}
            onClose={() => setAction(null)}
            onDone={(ok, texte) => {
              setMessage({ ok, texte });
              setAction(null);
              if (ok) router.refresh();
            }}
          />
        )}
        {baremeOuvert && etablissementId && (
          <ModalBareme
            etablissementId={etablissementId}
            bareme={bareme}
            onClose={() => setBaremeOuvert(false)}
            onDone={(ok, texte) => {
              setMessage({ ok, texte });
              setBaremeOuvert(false);
              if (ok) router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Modale d'ajustement du barème de conduite (chef d'établissement / admin)
// ─────────────────────────────────────────────────────────────
function ModalBareme({
  etablissementId,
  bareme,
  onClose,
  onDone,
}: {
  etablissementId: string;
  bareme: BaremeConduite;
  onClose: () => void;
  onDone: (ok: boolean, texte: string) => void;
}) {
  const [valeurs, setValeurs] = useState({
    absenceNj: String(bareme.absenceNj),
    retardNj: String(bareme.retardNj),
    observation: String(bareme.observation),
    encouragement: String(bareme.encouragement),
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Pavé décimal réservé au téléphone : faux au rendu serveur, sur ordinateur et à l'impression.
  const ecranMobile = useEcranMobile();

  const CHAMPS: { cle: keyof typeof valeurs; libelle: string; aide: string }[] = [
    { cle: "absenceNj", libelle: "Absence non justifiée", aide: "points retirés par absence" },
    { cle: "retardNj", libelle: "Retard non justifié", aide: "points retirés par retard" },
    { cle: "observation", libelle: "Observation disciplinaire", aide: "points retirés par observation" },
    { cle: "encouragement", libelle: "Encouragement", aide: "points ajoutés par encouragement" },
  ];

  function enregistrer() {
    start(async () => {
      const fd = new FormData();
      fd.set("etablissementId", etablissementId);
      for (const [k, v] of Object.entries(valeurs)) fd.set(k, v);
      const res = await enregistrerBareme({ ok: false }, fd);
      if (res.ok) onDone(true, res.message ?? "Barème mis à jour.");
      else setErreur(res.message ?? "Erreur technique.");
    });
  }

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
        className="fixed left-1/2 top-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft mobile:inset-x-0 mobile:top-auto mobile:bottom-0 mobile:w-full mobile:translate-x-0 mobile:translate-y-0 mobile:rounded-b-none mobile:pb-[var(--marge-sure-bas)] mobile:max-h-[90dvh] mobile:overflow-y-auto"
      >
        <div className="flex items-start justify-between px-6 pt-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest-600">
              <SlidersHorizontal size={20} />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-forest-900">Barème de conduite</h2>
              <p className="text-xs text-ink-700/60">Propre à votre établissement — appliqué à toutes ses classes.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100 mobile:h-11 mobile:w-11"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {erreur && <p className="text-sm font-medium text-red-600">{erreur}</p>}
          <div className="grid gap-3 sm:grid-cols-2 mobile:grid-cols-2">
            {CHAMPS.map(({ cle, libelle, aide }) => (
              <div key={cle}>
                <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60 mobile:text-xs mobile:normal-case mobile:tracking-normal">
                  {libelle}
                </label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.05}
                  inputMode={ecranMobile ? "decimal" : undefined}
                  value={valeurs[cle]}
                  onChange={(ev) => setValeurs((p) => ({ ...p, [cle]: ev.target.value }))}
                  className="h-11 w-full rounded-2xl border border-cream-300 bg-white px-3.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:text-base"
                />
                <p className="mt-1 text-[0.65rem] text-ink-700/50 mobile:text-xs mobile:text-ink-700/70">{aide}</p>
              </div>
            ))}
          </div>
          <p className="text-[0.68rem] text-ink-700/50 mobile:text-xs mobile:text-ink-700/70">
            La note part de 20 et reste bornée entre 0 et 20. Les modifications s&apos;appliquent immédiatement au registre,
            au bilan et aux exports de toutes les classes de l&apos;établissement.
          </p>
          <div className="flex justify-end gap-2 mobile:sticky mobile:bottom-0 mobile:-mx-6 mobile:grid mobile:grid-cols-2 mobile:border-t mobile:border-cream-100 mobile:bg-white mobile:px-6 mobile:py-3">
            <button
              onClick={onClose}
              className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100"
            >
              Annuler
            </button>
            <button
              onClick={enregistrer}
              disabled={pending}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60 mobile:justify-center"
            >
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Modales d'action (encouragement / observation / infirmerie / SMS / historique)
// ─────────────────────────────────────────────────────────────
const THEMES: Record<
  Exclude<TypeAction, "historique">,
  { titre: string; sousTitre: string; Icone: typeof ThumbsUp; pastille: string; bouton: string }
> = {
  encouragement: {
    titre: "Encouragement",
    sousTitre: "Pour participation active en classe",
    Icone: ThumbsUp,
    pastille: "bg-forest-50 text-forest-600",
    bouton: "bg-forest-700 hover:bg-forest-600",
  },
  observation: {
    titre: "Observation",
    sousTitre: "Pour perturbation ou comportement inadapté",
    Icone: Eye,
    pastille: "bg-orange-50 text-orange-500",
    bouton: "bg-orange-500 hover:bg-orange-400",
  },
  infirmerie: {
    titre: "Infirmerie",
    sousTitre: "Admission à l'infirmerie",
    Icone: HeartPulse,
    pastille: "bg-pink-50 text-pink-500",
    bouton: "bg-pink-600 hover:bg-pink-500",
  },
  sms: {
    titre: "SMS au parent",
    sousTitre: "Message envoyé au(x) parent(s) de l'élève",
    Icone: MessageCircle,
    pastille: "bg-sky-50 text-sky-600",
    bouton: "bg-forest-800 hover:bg-forest-700",
  },
};

function ModalAction({
  action,
  classeId,
  classeNom,
  date,
  heureSeance,
  onClose,
  onDone,
}: {
  action: { type: TypeAction; eleve: LigneEleve };
  classeId: string;
  classeNom: string;
  date: string;
  heureSeance: string | null;
  onClose: () => void;
  onDone: (ok: boolean, texte: string) => void;
}) {
  const { type, eleve } = action;
  const [description, setDescription] = useState("");
  const [accompagnateur, setAccompagnateur] = useState("");
  const [chargement, setChargement] = useState(type !== "historique");
  const [erreur, setErreur] = useState<string | null>(null);
  const [historique, setHistorique] = useState<LigneHistorique[] | null>(null);
  const [pending, start] = useTransition();

  // Ouverture : suggestion IA (pré-remplissage) ou chargement de l'historique.
  useEffect(() => {
    let actif = true;
    if (type === "historique") {
      historiqueAbsences({ classeId, eleveId: eleve.eleveId }).then((r) => {
        if (actif) {
          if (r.ok) setHistorique(r.lignes ?? []);
          else setErreur(r.message ?? "Erreur de chargement.");
        }
      });
    } else {
      suggestionEvenement({ classeId, eleveId: eleve.eleveId, type }).then((r) => {
        if (!actif) return;
        if (r.ok && r.texte) setDescription(r.texte);
        else if (!r.ok) setErreur(r.message ?? "Suggestion indisponible.");
        setChargement(false);
      });
    }
    return () => {
      actif = false;
    };
  }, [type, eleve.eleveId, classeId]);

  function regenerer() {
    if (type === "historique") return;
    setChargement(true);
    suggestionEvenement({ classeId, eleveId: eleve.eleveId, type }).then((r) => {
      if (r.ok && r.texte) setDescription(r.texte);
      setChargement(false);
    });
  }

  function enregistrer() {
    start(async () => {
      const fd = new FormData();
      if (type === "sms") {
        fd.set("classeId", classeId);
        fd.set("eleveIds", JSON.stringify([eleve.eleveId]));
        fd.set("message", description);
        const res = await envoyerSmsParents({ ok: false }, fd);
        if (res.ok) onDone(true, res.message ?? "SMS envoyé.");
        else setErreur(res.message ?? "Échec de l'envoi.");
      } else if (type !== "historique") {
        fd.set("type", type);
        fd.set("classeId", classeId);
        fd.set("eleveId", eleve.eleveId);
        fd.set("date", date);
        if (heureSeance) fd.set("heureSeance", heureSeance);
        fd.set("description", description);
        if (accompagnateur) fd.set("accompagnateur", accompagnateur);
        const res = await enregistrerEvenement({ ok: false }, fd);
        if (res.ok) onDone(true, res.message ?? "Enregistré.");
        else setErreur(res.message ?? "Erreur technique.");
      }
    });
  }

  function toutJustifier() {
    start(async () => {
      const fd = new FormData();
      fd.set("classeId", classeId);
      fd.set("eleveId", eleve.eleveId);
      const res = await justifierAbsences({ ok: false }, fd);
      if (res.ok) onDone(true, res.message ?? "Justifié.");
      else setErreur(res.message ?? "Erreur technique.");
    });
  }

  const theme = type !== "historique" ? THEMES[type] : null;
  const nonJustifiees = historique?.filter((l) => !l.justifie).length ?? 0;

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
        className="fixed left-1/2 top-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft mobile:inset-x-0 mobile:top-auto mobile:bottom-0 mobile:w-full mobile:translate-x-0 mobile:translate-y-0 mobile:rounded-b-none mobile:pb-[var(--marge-sure-bas)]"
      >
        {/* En-tête */}
        <div className="flex items-start justify-between px-6 pt-5">
          <div className="flex items-center gap-3">
            {theme ? (
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${theme.pastille}`}>
                <theme.Icone size={20} />
              </span>
            ) : null}
            <div>
              <h2 className="font-display text-xl font-bold text-forest-900">
                {theme ? theme.titre : "Historique d'absences"}
              </h2>
              {theme && <p className="text-xs text-ink-700/60">{theme.sousTitre}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100 mobile:h-11 mobile:w-11"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-6 mobile:max-h-[80dvh] mobile:px-4">
          {/* Fiche élève */}
          <div className="rounded-2xl border border-cream-200 bg-cream-50/60 px-4 py-3">
            <p className="font-semibold text-forest-900">{eleve.nom}</p>
            <p className="text-xs text-ink-700/60">
              {classeNom} · {date}
              {eleve.dateNaissance ? ` · né(e) le ${eleve.dateNaissance}` : ""}
            </p>
          </div>

          {erreur && <p className="text-sm font-medium text-red-600">{erreur}</p>}

          {type === "historique" ? (
            <>
              {historique === null ? (
                <p className="flex items-center gap-2 text-sm text-ink-700/60">
                  <Loader2 size={14} className="animate-spin" /> Chargement de l&apos;historique…
                </p>
              ) : historique.length === 0 ? (
                <p className="text-sm text-ink-700/60">Aucune absence ni retard enregistré pour cet élève.</p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-cream-200 mobile:overflow-visible mobile:rounded-none mobile:border-0">
                    <table className="w-full border-collapse text-sm tableau-cartes-mobile">
                      <thead>
                        <tr className="border-b border-cream-200 bg-cream-50/60 text-left text-[0.65rem] uppercase tracking-wide text-ink-700/55">
                          <th className="px-3 py-2 font-semibold">Date</th>
                          <th className="px-3 py-2 font-semibold">Heure</th>
                          <th className="px-3 py-2 font-semibold">Discipline</th>
                          <th className="px-3 py-2 font-semibold">Type</th>
                          <th className="px-3 py-2 font-semibold">Motif</th>
                          <th className="px-3 py-2 font-semibold">Justifiée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historique.map((l, i) => (
                          <tr key={i} className="border-b border-cream-100 last:border-0">
                            <td className="whitespace-nowrap px-3 py-2 mobile:font-semibold mobile:text-forest-900">{l.date}</td>
                            <td data-label="Heure" className="whitespace-nowrap px-3 py-2 text-ink-700/70">{l.heure ?? "—"}</td>
                            <td data-label="Discipline" className="px-3 py-2 text-ink-700/70">{l.discipline ?? "—"}</td>
                            <td data-label="Type" className="px-3 py-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[0.68rem] font-semibold mobile:text-xs ${
                                  l.type === "absent" ? "bg-red-100 text-red-700" : "bg-gold-100 text-gold-800"
                                }`}
                              >
                                {l.type === "absent" ? "Absence" : "Retard"}
                              </span>
                            </td>
                            <td data-label="Motif" className="px-3 py-2 text-ink-700/70">{l.motif ?? "—"}</td>
                            <td data-label="Justifiée" className="px-3 py-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[0.68rem] font-semibold mobile:text-xs ${
                                  l.justifie ? "bg-forest-100 text-forest-800" : "bg-cream-200 text-ink-700/60"
                                }`}
                              >
                                {l.justifie ? "Oui" : "Non"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-ink-700/60">
                      Total : {historique.filter((l) => l.type === "absent").length} absence(s),{" "}
                      {historique.filter((l) => l.type === "retard").length} retard(s)
                    </p>
                    {nonJustifiees > 0 && (
                      <button
                        onClick={toutJustifier}
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 mobile:min-h-11 mobile:w-full mobile:justify-center mobile:text-sm"
                      >
                        {pending ? <Loader2 size={13} className="animate-spin" /> : <BadgeCheck size={13} />}
                        Tout justifier ({nonJustifiees})
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {/* Description pré-remplie (IA) */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60 mobile:text-xs mobile:normal-case mobile:tracking-normal">
                    {type === "sms" ? "Message" : "Description"}
                  </label>
                  <button
                    type="button"
                    onClick={regenerer}
                    disabled={chargement}
                    className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[0.7rem] font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-60 mobile:min-h-10 mobile:text-xs"
                  >
                    {chargement ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Suggestion EduWeb Planner
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(ev) => setDescription(ev.target.value)}
                  rows={4}
                  placeholder={chargement ? "Génération de la suggestion…" : "Description…"}
                  className="w-full rounded-2xl border border-cream-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:text-base"
                />
                <p className="mt-1 text-[0.68rem] text-ink-700/50 mobile:text-xs mobile:text-ink-700/70">
                  Suggestion générée selon le profil de l&apos;élève — librement modifiable.
                </p>
              </div>

              {type === "infirmerie" && (
                <div>
                  <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60 mobile:text-xs mobile:normal-case mobile:tracking-normal">
                    Accompagnateur (optionnel)
                  </label>
                  <input
                    value={accompagnateur}
                    onChange={(ev) => setAccompagnateur(ev.target.value)}
                    placeholder="Nom de l'élève accompagnateur…"
                    className="h-11 w-full rounded-2xl border border-cream-300 bg-white px-3.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:text-base"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1 mobile:sticky mobile:bottom-0 mobile:-mx-4 mobile:grid mobile:grid-cols-2 mobile:border-t mobile:border-cream-100 mobile:bg-white mobile:px-4 mobile:py-3">
                <button
                  onClick={onClose}
                  className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100 mobile:h-12"
                >
                  Annuler
                </button>
                <button
                  onClick={enregistrer}
                  disabled={pending || chargement || !description.trim()}
                  className={`inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white disabled:opacity-60 ${theme?.bouton} mobile:h-12 mobile:justify-center`}
                >
                  {pending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : theme ? (
                    <theme.Icone size={15} />
                  ) : null}
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

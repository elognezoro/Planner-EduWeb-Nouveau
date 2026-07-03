"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Save, Search, Send, BadgeCheck } from "lucide-react";
import { Card } from "@/components/app/ui";
import {
  enregistrerAppel,
  justifierAbsences,
  envoyerSmsParents,
  exporterRegistre,
  type EtatForm,
} from "./actions";
import { STATUTS_APPEL, type StatutAppel } from "./lib";

export interface LigneEleve {
  eleveId: string;
  nom: string;
  sousTexte: string;
  sexe: string | null;
  statut: StatutAppel;
  motif: string;
  cumulA: number;
  cumulR: number;
  aJustifier: number;
  conduite: number;
  alerte: boolean;
}

const initial: EtatForm = { ok: false };
const champ =
  "h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

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

  const label = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60";
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className={label}>Classe pédagogique</label>
          <select value={valeurs.classe} onChange={(e) => naviguer({ classe: e.target.value })} className={champ}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Discipline (matière)</label>
          <select value={valeurs.discipline} onChange={(e) => naviguer({ discipline: e.target.value })} className={champ}>
            <option value="">— Toutes —</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>{d.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Heure de la séance</label>
          <select value={valeurs.heure} onChange={(e) => naviguer({ heure: e.target.value })} className={champ}>
            {heures.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Date</label>
          <input type="date" value={valeurs.date} onChange={(e) => naviguer({ date: e.target.value })} className={champ} />
        </div>
        <div>
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
        </div>
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

// ─────────────────────────────────────────────────────────────
//  Tableau interactif des élèves
// ─────────────────────────────────────────────────────────────
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
}: {
  classeId: string;
  classeNom: string;
  date: string;
  disciplineId: string | null;
  heureSeance: string | null;
  eleves: LigneEleve[];
  seuil: number;
  filtreActif: boolean;
}) {
  const router = useRouter();
  const [statuts, setStatuts] = useState<Record<string, StatutAppel>>({});
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-100 px-5 py-3.5">
        <h2 className="font-display text-lg font-bold text-forest-900">
          Liste des élèves — {classeNom}
          {filtreActif && <span className="ml-2 text-xs font-normal text-ink-700/55">(filtrés)</span>}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => toutMettre("present")} className={chip}>Tout P</button>
          <button onClick={() => toutMettre("absent")} className={chip}>Tout A</button>
        </div>
      </div>

      {/* Barre de sélection */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-100 bg-cream-50/50 px-5 py-2.5">
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

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-200 bg-cream-50/60 text-left text-[0.65rem] uppercase tracking-wide text-ink-700/55">
              <th className="w-10 px-4 py-3">
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
              <th className="px-3 py-3 font-semibold">Actions</th>
              <th className="px-3 py-3 font-semibold">Conduite</th>
            </tr>
          </thead>
          <tbody>
            {eleves.map((e, idx) => {
              const s = statutDe(e.eleveId);
              return (
                <tr key={e.eleveId} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/40">
                  <td className="px-4 py-2.5">
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
                  <td className="px-3 py-2.5">
                    {e.aJustifier > 0 ? (
                      <button
                        onClick={() => justifier(e.eleveId)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[0.7rem] font-semibold text-sky-700 hover:bg-sky-200 disabled:opacity-60"
                      >
                        <BadgeCheck size={12} /> Justifier ({e.aJustifier})
                      </button>
                    ) : (
                      <span className="text-xs text-ink-700/35">—</span>
                    )}
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

      {/* Pied : seuil + SMS groupé + Enregistrer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-100 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gold-100 px-3 py-1.5 text-xs font-semibold text-gold-800">
            Seuil d'alerte SMS : {seuil} absences
          </span>
          <button
            onClick={() => envoyerSms(enAlerte.map((e) => e.eleveId))}
            disabled={pending || enAlerte.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
          >
            <Send size={13} /> SMS groupé ({enAlerte.length})
          </button>
        </div>
        <div className="flex items-center gap-3">
          {message && (
            <span className={`text-xs font-medium ${message.ok ? "text-forest-700" : "text-red-600"}`}>{message.texte}</span>
          )}
          <button
            onClick={enregistrer}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-7 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5 hover:bg-forest-700 disabled:opacity-60"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
          </button>
        </div>
      </div>

      {/* Légende conduite */}
      <p className="border-t border-cream-100 px-5 py-2.5 text-[0.68rem] text-ink-700/50">
        Conduite /20 = 20 − 0,5 × absence non justifiée − 0,25 × retard non justifié (cumul de la classe). « Justifier » régularise
        toutes les absences/retards non justifiés de l'élève.
      </p>
    </Card>
  );
}

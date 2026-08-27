"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Check, Copy, UserPlus, Link2, Power, Trash2, Loader2, X, ChevronDown, GraduationCap } from "lucide-react";
import { inscrireParticipants, genererLiensRole, majDateDuree, type ResultatInscriptions, type ResultatLiens } from "./actions";
import { basculerInvitationCours, supprimerInvitationCours } from "../../invitation-cours-actions";
import { CalendarClock, Clock } from "lucide-react";

export type Formation = { id: string; titre: string; estSeminaire: boolean; publie: boolean; dateFormation: string | null; dureeMinutes: number | null };
export type Lien = { id: string; coursId: string; coursTitre: string; token: string; actif: boolean; expiration: string | null; placesMax: number | null; roleCible: string | null; coursDate: string | null; coursDuree: number | null };

const STATUTS = [
  { v: "apprenant", libelle: "Élève / Apprenant" },
  { v: "formateur", libelle: "Formateur / Tuteur" },
];
const libStatut = (v: string) => (v === "formateur" ? "Formateur / Tuteur" : "Élève / Apprenant");
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const urlLien = (token: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/invitation/cours/${token}`;
// ISO → valeur d'un <input datetime-local> (AAAA-MM-JJTHH:MM, heure locale).
const versInput = (iso: string | null): string => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fmtDate = (iso: string | null): string | null => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : null);
const fmtDuree = (min: number | null): string | null => {
  if (min == null || min <= 0) return null;
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
};

function LigneLienRole({ lien }: { lien: Lien }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copie, setCopie] = useState(false);
  const url = urlLien(lien.token);
  const copier = async () => {
    try { await navigator.clipboard.writeText(url); setCopie(true); setTimeout(() => setCopie(false), 1600); } catch { /* presse-papiers indisponible */ }
  };
  const agir = (fn: () => Promise<unknown>, confirmer?: string) => {
    if (confirmer && !window.confirm(confirmer)) return;
    start(async () => { await fn(); router.refresh(); });
  };
  return (
    <div className={`rounded-xl border p-3 ${lien.actif ? "border-cream-200 bg-white" : "border-cream-200 bg-cream-50/60 opacity-70"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={`${champ} min-w-[220px] flex-1 font-mono text-xs`} />
        <button type="button" onClick={copier} className="inline-flex items-center gap-1.5 rounded-full bg-forest-600 px-3 py-2 text-xs font-semibold text-white hover:bg-forest-700">
          {copie ? <Check size={14} /> : <Copy size={14} />} {copie ? "Copié" : "Copier"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-700/60">
        {fmtDate(lien.coursDate) && <span className="inline-flex items-center gap-1 font-medium text-ink-800"><CalendarClock size={12} /> {fmtDate(lien.coursDate)}</span>}
        {fmtDuree(lien.coursDuree) && <span className="inline-flex items-center gap-1"><Clock size={12} /> {fmtDuree(lien.coursDuree)}</span>}
        <span className={`rounded-full px-2 py-0.5 font-semibold ${lien.roleCible === "formateur" ? "bg-gold-100 text-gold-800" : "bg-forest-100 text-forest-800"}`}>{lien.roleCible === "formateur" ? "Formateur / Tuteur" : "Apprenant"}</span>
        <span>{lien.actif ? "Actif" : "Désactivé"}</span>
        {lien.placesMax != null && <span>plafond : {lien.placesMax}</span>}
        {lien.expiration && <span>expire le {new Date(lien.expiration).toLocaleDateString("fr-FR")}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => agir(() => basculerInvitationCours(lien.id))} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-3 py-1 text-xs font-medium text-ink-800 hover:bg-cream-100 disabled:opacity-50"><Power size={12} /> {lien.actif ? "Désactiver" : "Réactiver"}</button>
        <button type="button" disabled={pending} onClick={() => agir(() => supprimerInvitationCours(lien.id), "Supprimer ce lien ?")} className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">{pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Supprimer</button>
      </div>
    </div>
  );
}

function BlocResultat({ r }: { r: ResultatInscriptions }) {
  return (
    <div className={`space-y-1 rounded-xl border px-4 py-3 text-sm ${r.ok ? "border-forest-200 bg-forest-50/60 text-forest-900" : "border-red-200 bg-red-50 text-red-700"}`}>
      <p className="font-semibold">{r.message}</p>
      {r.ambigus && r.ambigus.length > 0 && <p className="text-xs text-gold-800">⚠ Ambigus (plusieurs comptes, non inscrits) : {r.ambigus.join(", ")}</p>}
      {r.introuvables && r.introuvables.length > 0 && <p className="text-xs text-ink-700/70">Introuvables (aucun compte) : {r.introuvables.join(", ")}</p>}
    </div>
  );
}

function EditeurDateDuree({ formation }: { formation: Formation }) {
  const router = useRouter();
  const [date, setDate] = useState(versInput(formation.dateFormation));
  const [duree, setDuree] = useState(formation.dureeMinutes != null ? String(formation.dureeMinutes) : "");
  const [pending, start] = useTransition();
  const [ok, setOk] = useState(false);
  const enregistrer = () => {
    setOk(false);
    start(async () => { const r = await majDateDuree(formation.id, date, duree); if (r.ok) { setOk(true); setTimeout(() => setOk(false), 1800); router.refresh(); } });
  };
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 rounded-xl border border-cream-200 bg-white p-3">
      <div className="min-w-0">
        <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-forest-900">
          <span className="min-w-0 truncate">{formation.titre}</span>
          {!formation.publie && <span className="shrink-0 rounded-full bg-cream-200 px-2 py-0.5 text-[0.7rem] font-medium text-ink-700/70">brouillon</span>}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            <span className="mb-0.5 block font-medium text-ink-700/70">Date &amp; heure</span>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={`${champ} w-56`} />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block font-medium text-ink-700/70">Durée (min)</span>
            <input type="number" min={0} value={duree} onChange={(e) => setDuree(e.target.value)} placeholder="—" className={`${champ} w-28`} />
          </label>
        </div>
      </div>
      <button type="button" onClick={enregistrer} disabled={pending} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest-600 px-4 text-xs font-semibold text-white hover:bg-forest-700 disabled:opacity-50">
        {pending ? <Loader2 size={14} className="animate-spin" /> : ok ? <Check size={14} /> : null} {ok ? "Enregistré" : "Enregistrer"}
      </button>
    </div>
  );
}

export function FormulaireInscriptions({ formations, liens }: { formations: Formation[]; liens: Lien[] }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [statut, setStatut] = useState("apprenant");
  const [saisie, setSaisie] = useState("");
  const [filtre, setFiltre] = useState("");
  const [resIns, setResIns] = useState<ResultatInscriptions | null>(null);
  const [resLien, setResLien] = useState<ResultatLiens | null>(null);
  const [pendingIns, startIns] = useTransition();
  const [pendingLien, startLien] = useTransition();

  const filtrees = useMemo(() => formations.filter((f) => f.titre.toLowerCase().includes(filtre.trim().toLowerCase())), [formations, filtre]);
  const choisies = formations.filter((f) => selection.has(f.id));
  const toggle = (id: string) => setSelection((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const inscrire = () => { setResIns(null); startIns(async () => { const r = await inscrireParticipants([...selection], statut, saisie); setResIns(r); if (r.ok) router.refresh(); }); };
  const genererLiens = () => { setResLien(null); startLien(async () => { const r = await genererLiensRole([...selection], statut); setResLien(r); if (r.ok) router.refresh(); }); };

  // Liens affichés : ceux des formations sélectionnées (ou tous si aucune sélection).
  const liensAffiches = liens.filter((l) => selection.size === 0 || selection.has(l.coursId));

  return (
    <div className="space-y-6">
      {/* 1. Formations — liste déroulante à choix multiple */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-forest-900">1. Formations <span className="font-normal text-ink-700/50">(cours / séminaires — choix multiple)</span></label>
        <details className="group rounded-2xl border border-cream-300 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
            <span className={selection.size === 0 ? "text-ink-700/55" : "font-medium text-forest-900"}>
              {selection.size === 0 ? "Choisir une ou plusieurs formations…" : `${selection.size} formation(s) sélectionnée(s)`}
            </span>
            <ChevronDown size={16} className="text-ink-700/50 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-cream-200 p-2.5">
            <div className="relative mb-2">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
              <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Filtrer les formations…" className={`${champ} pl-9`} />
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
              {filtrees.length === 0 ? (
                <p className="px-2 py-3 text-sm text-ink-700/55">Aucune formation ne correspond.</p>
              ) : filtrees.map((f) => (
                <label key={f.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-forest-50">
                  <input type="checkbox" checked={selection.has(f.id)} onChange={() => toggle(f.id)} className="h-4 w-4 accent-forest-700" />
                  <span className="min-w-0 flex-1 text-sm text-ink-800">{f.titre}</span>
                  {f.estSeminaire && <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[0.7rem] font-semibold text-forest-800">Séminaire</span>}
                  {!f.publie && <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[0.7rem] font-medium text-ink-700/70">brouillon</span>}
                </label>
              ))}
            </div>
          </div>
        </details>
        {choisies.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {choisies.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-forest-50 py-1 pl-3 pr-1 text-xs font-medium text-forest-800">
                {f.titre}
                <button type="button" onClick={() => toggle(f.id)} aria-label={`Retirer ${f.titre}`} className="rounded-full p-0.5 text-forest-700/60 hover:bg-forest-100 hover:text-forest-900"><X size={13} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Date & durée ÉDITABLES des formations sélectionnées (affichées sur les liens) */}
      {choisies.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-forest-900">Date et durée <span className="font-normal text-ink-700/50">(par formation — éditable, affichée sur les liens)</span></label>
          <div className="space-y-2">
            {choisies.map((f) => <EditeurDateDuree key={f.id} formation={f} />)}
          </div>
        </div>
      )}

      {/* 2. Statut — liste déroulante */}
      <div className="max-w-sm">
        <label htmlFor="statut" className="mb-1.5 block text-sm font-semibold text-forest-900">2. Statut dans la formation</label>
        <select id="statut" value={statut} onChange={(e) => setStatut(e.target.value)} className={champ}>
          {STATUTS.map((s) => <option key={s.v} value={s.v}>{s.libelle}</option>)}
        </select>
      </div>

      {/* 3. Participants — e-mails ou noms */}
      <div>
        <label htmlFor="saisie" className="mb-1.5 block text-sm font-semibold text-forest-900">3. Participants concernés <span className="font-normal text-ink-700/50">(e-mails ou noms)</span></label>
        <textarea
          id="saisie"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          rows={4}
          placeholder="Un e-mail ou un nom par ligne (ou séparés par des virgules) — ex. : marie.kone@ecole.ci, Jean Bamba…"
          className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
        <p className="mt-1 text-xs text-ink-700/55">Les e-mails sont résolus exactement ; un nom ambigu (plusieurs comptes) est signalé et non inscrit.</p>
      </div>

      <div>
        <button
          type="button"
          onClick={inscrire}
          disabled={pendingIns || selection.size === 0 || !saisie.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-600 px-6 text-sm font-semibold text-white shadow-soft hover:bg-forest-700 disabled:opacity-50"
        >
          {pendingIns ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Inscrire les participants comme {libStatut(statut)}
        </button>
        {resIns && <div className="mt-3"><BlocResultat r={resIns} /></div>}
      </div>

      {/* Liens d'inscription directe (scoppés au statut) */}
      <section className="space-y-3 border-t border-cream-100 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900"><Link2 size={17} className="text-forest-600" /> Liens d&apos;inscription directe</h3>
          <button
            type="button"
            onClick={genererLiens}
            disabled={pendingLien || selection.size === 0}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
          >
            {pendingLien ? <Loader2 size={15} className="animate-spin" /> : <GraduationCap size={15} />} Générer un lien « {libStatut(statut)} » par formation
          </button>
        </div>
        <p className="text-xs text-ink-700/60">Un lien porte son statut : en l&apos;ouvrant (connecté), le participant rejoint la formation comme <strong>{libStatut(statut)}</strong>. Souple : quiconque peut l&apos;utiliser.</p>
        {resLien && (
          <div className={`rounded-xl border px-4 py-2.5 text-sm ${resLien.ok ? "border-forest-200 bg-forest-50/60 text-forest-900" : "border-red-200 bg-red-50 text-red-700"}`}>{resLien.message}</div>
        )}
        {liensAffiches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-cream-300 bg-cream-50/50 px-4 py-4 text-center text-sm text-ink-700/60">
            Aucun lien {selection.size > 0 ? "pour les formations sélectionnées" : ""} pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-3">
            {liensAffiches.map((l) => (
              <div key={l.id}>
                <p className="mb-1 text-xs font-semibold text-forest-800">{l.coursTitre}</p>
                <LigneLienRole lien={l} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

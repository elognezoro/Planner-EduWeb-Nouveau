"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, Send, Loader2, Save, MessageCircle, ClipboardCheck, History,
  Eye, ListChecks, Plus, X, Info, GraduationCap,
} from "lucide-react";
import {
  posterDialogueStage,
  enregistrerEvaluationStage,
  saisirPresencesStage,
  type EtatForm,
} from "@/lib/formation/stages-actions";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { grouperParCompetence, type ComposanteModule } from "@/lib/formation/structure-module";

// ── Contrats de données (alignés sur la page serveur) ──
export interface ModuleApplicableVue {
  id: string;
  nom: string;
  /** Structure du stage : [compétence facultative →] composantes → thèmes. */
  composantes: ComposanteModule[];
}
export interface CritereVue {
  critere: string;
  note: number;
  sur: number;
}
export interface GrilleVue {
  moduleId: string;
  criteres: CritereVue[];
  noteGlobale: number;
  sur: number;
  appreciation: string | null;
  evaluateurNom: string | null;
  majLeLabel: string;
}
export interface DemandeVue {
  id: string;
  libelle: string;
  motif: string;
  statut: "en_attente" | "autorisee" | "refusee";
  motifDecision: string | null;
  dateLabel: string;
  decideLeLabel: string | null;
}
export interface DialogueVue {
  id: string;
  auteurNom: string;
  duMaitre: boolean;
  contenu: string;
  dateLabel: string;
}
export interface VisiteVue {
  id: string;
  professeur: string;
  dateLabel: string;
  ecole: string | null;
  objet: string | null;
  observations: string | null;
  recommandations: string | null;
  noteGlobale: number | null;
}
export interface PresenceLigneVue {
  dateLabel: string;
  heureSeance: string;
  statut: string;
  motif: string | null;
}
export interface StagiaireVue {
  attributionId: string;
  apprenantId: string;
  nom: string;
  prenoms: string | null;
  matricule: string | null;
  annee: number;
  modulesApplicables: ModuleApplicableVue[];
  presences: PresenceLigneVue[];
  regularite: { pct: number; present: number; absent: number; retard: number; total: number };
  dialogues: DialogueVue[];
  visites: VisiteVue[];
  grillesMaitre: GrilleVue[];
  grillesProf: GrilleVue[];
  demandes: DemandeVue[];
}

const initial: EtatForm = { ok: false };
const champ =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const labelCls = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60";

const STATUTS: { v: "present" | "absent" | "retard"; libelle: string; court: string }[] = [
  { v: "present", libelle: "Présent", court: "P" },
  { v: "absent", libelle: "Absent", court: "A" },
  { v: "retard", libelle: "Retard", court: "R" },
];
const STYLE_STATUT: Record<string, string> = {
  present: "bg-forest-700 text-cream-50 border-forest-700",
  absent: "bg-red-600 text-white border-red-600",
  retard: "bg-amber-500 text-white border-amber-500",
};
const CRENEAUX = ["07h30 - 08h30", "08h30 - 09h30", "09h30 - 10h30", "10h30 - 11h30", "15h00 - 16h00", "16h00 - 17h00", "17h00 - 18h00"];

const couleurTaux = (pct: number) =>
  pct >= 95 ? "bg-forest-800 text-cream-50" :
  pct >= 90 ? "bg-forest-600 text-cream-50" :
  pct >= 80 ? "bg-forest-400 text-white" :
  pct >= 70 ? "bg-gold-300 text-forest-900" : "bg-red-300 text-red-950";

const badgeDemande: Record<DemandeVue["statut"], { ton: "attente" | "succes" | "refus"; libelle: string }> = {
  en_attente: { ton: "attente", libelle: "En attente" },
  autorisee: { ton: "succes", libelle: "Autorisée" },
  refusee: { ton: "refus", libelle: "Refusée" },
};

// ─────────────────────────────────────────────────────────────
//  Composant racine
// ─────────────────────────────────────────────────────────────
export function VueMaitreStages({
  cafopId,
  cafopNom,
  stagiaires,
  defaultDate,
}: {
  cafopId: string;
  cafopNom: string;
  terme: string;
  stagiaires: StagiaireVue[];
  defaultDate: string;
}) {
  const annees = useMemo(() => [...new Set(stagiaires.map((s) => s.annee))].sort((a, b) => a - b), [stagiaires]);
  const [anneeActive, setAnneeActive] = useState<number>(annees[0] ?? 1);
  const parAnnee = stagiaires.filter((s) => s.annee === anneeActive);

  return (
    <div className="space-y-6">
      <PageHeader
        titre={`Mes stagiaires — ${cafopNom}`}
        description="Vous ne voyez que les stagiaires qui vous sont attribués par le Directeur / l'ADC."
      />

      {stagiaires.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Aucun stagiaire ne vous est attribué pour le moment. Rapprochez-vous du Directeur du CAFOP ou de l&apos;ADC.
          </p>
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-700/50">Année de formation</span>
              {annees.map((a) => {
                const nb = stagiaires.filter((s) => s.annee === a).length;
                const actif = a === anneeActive;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAnneeActive(a)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      actif ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 bg-white text-forest-800 hover:bg-forest-50"
                    }`}
                  >
                    {a === 1 ? "1re" : `${a}e`} Année <span className="opacity-70">({nb})</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="space-y-4">
            {parAnnee.map((s) => (
              <CarteStagiaire key={s.attributionId} cafopId={cafopId} stagiaire={s} defaultDate={defaultDate} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Carte dépliable d'un stagiaire
// ─────────────────────────────────────────────────────────────
function CarteStagiaire({ cafopId, stagiaire, defaultDate }: { cafopId: string; stagiaire: StagiaireVue; defaultDate: string }) {
  const [ouvert, setOuvert] = useState(false);
  const nomComplet = [stagiaire.nom, stagiaire.prenoms].filter(Boolean).join(" ");
  const r = stagiaire.regularite;

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className="font-display text-base font-bold text-forest-900">{nomComplet}</p>
          <p className="text-xs text-ink-700/55">
            {stagiaire.matricule ?? "—"} · {stagiaire.annee === 1 ? "1re" : `${stagiaire.annee}e`} année
            {stagiaire.modulesApplicables.length === 1 && ` · ${stagiaire.modulesApplicables[0].nom}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {r.total > 0 ? (
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${couleurTaux(r.pct)}`}>{r.pct}% présence</span>
          ) : (
            <span className="rounded-full bg-cream-200 px-2.5 py-1 text-xs font-medium text-ink-700/50">Aucune présence saisie</span>
          )}
          <ChevronDown size={18} className={`shrink-0 text-ink-700/50 transition-transform ${ouvert ? "rotate-180" : ""}`} />
        </div>
      </button>

      {ouvert && (
        <div className="space-y-6 border-t border-cream-100 px-5 py-5">
          <FichePresence cafopId={cafopId} stagiaire={stagiaire} defaultDate={defaultDate} />
          <HistoriquePresences stagiaire={stagiaire} />
          <FilDialogue stagiaire={stagiaire} />
          <VisitesRecues visites={stagiaire.visites} />

          <section>
            <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-forest-900">
              <GraduationCap size={16} className="text-forest-700" /> Ma grille d&apos;évaluation
            </h3>
            {stagiaire.modulesApplicables.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucun stage configuré pour cette année de formation.</p>
            ) : (
              <div className="space-y-4">
                {stagiaire.modulesApplicables.map((m) => (
                  <GrilleEvaluation
                    key={m.id}
                    apprenantId={stagiaire.apprenantId}
                    module={m}
                    existante={stagiaire.grillesMaitre.find((g) => g.moduleId === m.id) ?? null}
                    grilleProf={stagiaire.grillesProf.find((g) => g.moduleId === m.id) ?? null}
                  />
                ))}
              </div>
            )}
          </section>

          <MesDemandes demandes={stagiaire.demandes} />
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Fiche de présence du jour
// ─────────────────────────────────────────────────────────────
function FichePresence({ cafopId, stagiaire, defaultDate }: { cafopId: string; stagiaire: StagiaireVue; defaultDate: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [heureSeance, setHeureSeance] = useState("");
  const [moduleId, setModuleId] = useState(stagiaire.modulesApplicables.length === 1 ? stagiaire.modulesApplicables[0].id : "");
  const [composantesSel, setComposantesSel] = useState<Set<string>>(new Set());
  const [themesSel, setThemesSel] = useState<Set<string>>(new Set());
  const [statut, setStatut] = useState<"present" | "absent" | "retard">("present");
  const [motif, setMotif] = useState("");

  const moduleCourant = stagiaire.modulesApplicables.find((m) => m.id === moduleId) ?? null;

  const changerModule = (id: string) => {
    setModuleId(id);
    setComposantesSel(new Set());
    setThemesSel(new Set());
  };
  const basculerComposante = (nom: string) =>
    setComposantesSel((prev) => {
      const n = new Set(prev);
      if (n.has(nom)) n.delete(nom);
      else n.add(nom);
      return n;
    });
  const basculerTheme = (nom: string) =>
    setThemesSel((prev) => {
      const n = new Set(prev);
      if (n.has(nom)) n.delete(nom);
      else n.add(nom);
      return n;
    });

  function enregistrer() {
    setMessage(null);
    start(async () => {
      const fd = new FormData();
      fd.set("cafopId", cafopId);
      fd.set("date", date);
      if (heureSeance.trim()) fd.set("heureSeance", heureSeance.trim());
      if (moduleId) fd.set("moduleId", moduleId);
      for (const c of composantesSel) fd.append("composantes", c);
      for (const t of themesSel) fd.append("themes", t);
      fd.set(
        "lignes",
        JSON.stringify([
          { apprenantId: stagiaire.apprenantId, statut, motif: statut !== "present" ? motif.trim() : undefined },
        ]),
      );
      const res = await saisirPresencesStage(initial, fd);
      setMessage({ ok: res.ok, texte: res.message ?? "" });
      if (res.ok) router.refresh();
    });
  }

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-forest-900">
        <ClipboardCheck size={16} className="text-forest-700" /> Fiche de présence
      </h3>
      <div className="space-y-3 rounded-2xl border border-cream-200 bg-cream-50/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
          </div>
          <div>
            <label className={labelCls}>Créneau</label>
            <input
              list="creneaux-cafop"
              value={heureSeance}
              onChange={(e) => setHeureSeance(e.target.value)}
              placeholder="Ex : 07h30 - 08h30"
              className={champ}
            />
            <datalist id="creneaux-cafop">
              {CRENEAUX.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className={labelCls}>Stage</label>
            {stagiaire.modulesApplicables.length <= 1 ? (
              <div className={`${champ} flex items-center bg-cream-100 text-ink-700/70`}>
                {moduleCourant?.nom ?? "— (aucun stage configuré) —"}
              </div>
            ) : (
              <select value={moduleId} onChange={(e) => changerModule(e.target.value)} className={champ}>
                <option value="">— Général —</option>
                {stagiaire.modulesApplicables.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            )}
          </div>
        </div>

        {moduleCourant && moduleCourant.composantes.length > 0 && (
          <div>
            <label className={labelCls}>Composantes / thèmes abordés</label>
            {/* Cases regroupées sous un sous-titre de COMPÉTENCE quand le module en a (ex. TICE) ;
                sans compétence, l'affichage reste strictement identique à avant. */}
            <div className="space-y-2 rounded-xl border border-cream-200 bg-white p-3">
              {grouperParCompetence(moduleCourant.composantes).map((g, gi) => (
                <div key={g.competence ?? `sans-competence-${gi}`} className={g.competence ? "rounded-lg border border-gold-200 bg-gold-50/40 p-2.5" : undefined}>
                  {g.competence && (
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gold-800">{g.competence}</p>
                  )}
                  <div className="space-y-2">
                    {g.composantes.map((c) => (
                      <div key={c.nom}>
                        <label className="flex items-center gap-2 text-sm font-medium text-forest-900">
                          <input type="checkbox" checked={composantesSel.has(c.nom)} onChange={() => basculerComposante(c.nom)} />
                          {c.nom}
                        </label>
                        {c.themes.length > 0 && (
                          <div className="ml-6 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            {c.themes.map((t) => (
                              <label key={t} className="flex items-center gap-1.5 text-xs text-ink-700/75">
                                <input type="checkbox" checked={themesSel.has(t)} onChange={() => basculerTheme(t)} />
                                {t}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>Statut</label>
            <div className="flex gap-1.5">
              {STATUTS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setStatut(o.v)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                    statut === o.v ? STYLE_STATUT[o.v] : "border-cream-300 bg-white text-ink-700/50 hover:border-forest-300"
                  }`}
                  title={o.libelle}
                >
                  {o.court}
                </button>
              ))}
            </div>
          </div>
          {statut !== "present" && (
            <div className="min-w-[12rem] flex-1">
              <label className={labelCls}>Motif</label>
              <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif…" className={champ} />
            </div>
          )}
          <button
            onClick={enregistrer}
            disabled={pending}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
          </button>
        </div>
        {message && (
          <p className={`text-xs font-medium ${message.ok ? "text-forest-700" : "text-red-600"}`}>{message.texte}</p>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Historique des présences + régularité
// ─────────────────────────────────────────────────────────────
function HistoriquePresences({ stagiaire }: { stagiaire: StagiaireVue }) {
  const r = stagiaire.regularite;
  const recentes = stagiaire.presences.slice(0, 12);
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-forest-900">
        <History size={16} className="text-forest-700" /> Historique &amp; régularité
      </h3>
      <div className="space-y-3 rounded-2xl border border-cream-200 p-4">
        {r.total > 0 ? (
          <>
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-200">
                <div className={`h-full rounded-full ${couleurTaux(r.pct)}`} style={{ width: `${r.pct}%` }} />
              </div>
              <span className="text-sm font-bold text-forest-900">{r.pct}%</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-forest-100 px-2.5 py-1 font-semibold text-forest-800">{r.present} présent(s)</span>
              <span className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">{r.absent} absence(s)</span>
              <span className="rounded-full bg-gold-100 px-2.5 py-1 font-semibold text-gold-800">{r.retard} retard(s)</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-700/60">Aucune présence enregistrée pour l&apos;instant.</p>
        )}

        {recentes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead>
                <tr className="text-ink-700/50">
                  <th className="py-1 pr-3 font-semibold">Date</th>
                  <th className="py-1 pr-3 font-semibold">Créneau</th>
                  <th className="py-1 pr-3 font-semibold">Statut</th>
                  <th className="py-1 font-semibold">Motif</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((p, i) => (
                  <tr key={i} className="border-t border-cream-100">
                    <td className="py-1.5 pr-3 text-ink-700/70">{p.dateLabel}</td>
                    <td className="py-1.5 pr-3 text-ink-700/70">{p.heureSeance}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${STYLE_STATUT[p.statut] ?? "bg-cream-200 text-ink-700"}`}>
                        {p.statut === "present" ? "P" : p.statut === "absent" ? "A" : "R"}
                      </span>
                    </td>
                    <td className="py-1.5 text-ink-700/60">{p.motif || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Fil de dialogue avec l'administration du CAFOP
// ─────────────────────────────────────────────────────────────
function FilDialogue({ stagiaire }: { stagiaire: StagiaireVue }) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function envoyer() {
    const t = texte.trim();
    if (!t) return;
    setErreur(null);
    start(async () => {
      const fd = new FormData();
      fd.set("apprenantId", stagiaire.apprenantId);
      fd.set("contenu", t);
      const res = await posterDialogueStage(initial, fd);
      if (res.ok) {
        setTexte("");
        router.refresh();
      } else {
        setErreur(res.message ?? "Envoi impossible.");
      }
    });
  }

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-forest-900">
        <MessageCircle size={16} className="text-forest-700" /> Dialogue avec le Directeur / l&apos;ADC
      </h3>
      <div className="space-y-3 rounded-2xl border border-cream-200 p-4">
        {stagiaire.dialogues.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucun message pour l&apos;instant.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {stagiaire.dialogues.map((d) => (
              <li key={d.id} className={d.duMaitre ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${d.duMaitre ? "rounded-tr-sm bg-forest-700 text-cream-50" : "rounded-tl-sm bg-cream-100 text-ink-800 ring-1 ring-cream-200"}`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{d.contenu}</p>
                  <p className={`mt-1 text-[0.6rem] ${d.duMaitre ? "text-cream-200/70" : "text-ink-700/45"}`}>
                    {d.auteurNom} · {d.dateLabel}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={2}
            placeholder="Votre message au Directeur / à l'ADC…"
            className="min-h-[42px] flex-1 resize-none rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
          <button
            onClick={envoyer}
            disabled={pending || !texte.trim()}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-forest-800 px-3.5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer
          </button>
        </div>
        {erreur && <p className="text-xs font-medium text-red-600">{erreur}</p>}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Visites reçues (lecture seule)
// ─────────────────────────────────────────────────────────────
function VisitesRecues({ visites }: { visites: VisiteVue[] }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-forest-900">
        <Eye size={16} className="text-forest-700" /> Visites reçues
      </h3>
      {visites.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucune visite de classe enregistrée pour ce stagiaire.</p>
      ) : (
        <ul className="space-y-2">
          {visites.map((v) => (
            <li key={v.id} className="rounded-2xl border border-cream-200 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-forest-900">
                  {v.professeur} <span className="font-normal text-ink-700/55">· {v.dateLabel}{v.ecole ? ` · ${v.ecole}` : ""}</span>
                </p>
                {v.noteGlobale !== null && (
                  <span className="rounded-full bg-forest-100 px-2.5 py-0.5 text-xs font-bold text-forest-800">{v.noteGlobale.toLocaleString("fr-FR")}/20</span>
                )}
              </div>
              {v.objet && <p className="mt-1 text-xs text-ink-700/70"><strong>Objet :</strong> {v.objet}</p>}
              {v.observations && <p className="mt-1 text-xs text-ink-700/70"><strong>Observations :</strong> {v.observations}</p>}
              {v.recommandations && <p className="mt-1 text-xs text-ink-700/70"><strong>Recommandations :</strong> {v.recommandations}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Grille d'évaluation (maître d'application)
// ─────────────────────────────────────────────────────────────
interface LigneCritere { critere: string; note: string; sur: string }

function GrilleEvaluation({
  apprenantId,
  module,
  existante,
  grilleProf,
}: {
  apprenantId: string;
  module: ModuleApplicableVue;
  existante: GrilleVue | null;
  grilleProf: GrilleVue | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [criteres, setCriteres] = useState<LigneCritere[]>(
    existante && existante.criteres.length > 0
      ? existante.criteres.map((c) => ({ critere: c.critere, note: String(c.note), sur: String(c.sur) }))
      : [{ critere: "", note: "", sur: "20" }],
  );
  const [appreciation, setAppreciation] = useState(existante?.appreciation ?? "");
  const [motif, setMotif] = useState("");
  const [confirmer, setConfirmer] = useState(false);

  useEffect(() => {
    if (!confirmer) return;
    const t = setTimeout(() => setConfirmer(false), 6000);
    return () => clearTimeout(t);
  }, [confirmer]);

  const noteGlobalePreview = useMemo(() => {
    const total = criteres.reduce((s, c) => s + (Number(c.note) || 0), 0);
    const totalSur = criteres.reduce((s, c) => s + (Number(c.sur) || 0), 0);
    return totalSur > 0 ? Math.round((total / totalSur) * 20 * 100) / 100 : 0;
  }, [criteres]);

  const majLigne = (i: number, champ_: keyof LigneCritere, v: string) => {
    setConfirmer(false);
    setCriteres((prev) => prev.map((c, idx) => (idx === i ? { ...c, [champ_]: v } : c)));
  };
  const ajouterLigne = () => setCriteres((prev) => [...prev, { critere: "", note: "", sur: "20" }]);
  const retirerLigne = (i: number) => setCriteres((prev) => prev.filter((_, idx) => idx !== i));

  function enregistrer() {
    setMessage(null);
    const valides = criteres.filter((c) => c.critere.trim());
    if (valides.length === 0) {
      setMessage({ ok: false, texte: "Ajoutez au moins un critère avec un intitulé." });
      return;
    }
    if (existante && !motif.trim()) {
      setMessage({ ok: false, texte: "Le motif de la modification est obligatoire." });
      return;
    }
    if (existante && !confirmer) {
      setConfirmer(true);
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set("apprenantId", apprenantId);
      fd.set("moduleId", module.id);
      fd.set("evaluateurType", "maitre_application");
      fd.set(
        "criteres",
        JSON.stringify(valides.map((c) => ({ critere: c.critere.trim(), note: Number(c.note) || 0, sur: Number(c.sur) || 20 }))),
      );
      if (appreciation.trim()) fd.set("appreciation", appreciation.trim());
      if (existante) fd.set("motif", motif.trim());
      const res = await enregistrerEvaluationStage(initial, fd);
      setMessage({ ok: res.ok, texte: res.message ?? "" });
      setConfirmer(false);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-cream-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-forest-900">{module.nom}</p>
        {existante && (
          <span className="text-xs text-ink-700/55">Dernière saisie le {existante.majLeLabel}</span>
        )}
      </div>

      {existante && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-gold-200 bg-gold-50 px-3 py-2 text-xs text-gold-900">
          <Info size={15} className="mt-0.5 shrink-0" />
          <span>Une grille existe déjà pour ce stage. Toute modification doit être <strong>motivée</strong> et sera soumise à l&apos;<strong>autorisation</strong> du Directeur du CAFOP ou de l&apos;ADC.</span>
        </div>
      )}

      {grilleProf && (
        <details className="mb-3 rounded-xl border border-cream-200 bg-cream-50/50 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-semibold text-forest-800">Grille du professeur de CAFOP (lecture) — {grilleProf.noteGlobale.toLocaleString("fr-FR")}/20</summary>
          <ul className="mt-2 space-y-1">
            {grilleProf.criteres.map((c, i) => (
              <li key={i} className="flex justify-between text-ink-700/70">
                <span>{c.critere}</span><span>{c.note}/{c.sur}</span>
              </li>
            ))}
          </ul>
          {grilleProf.appreciation && <p className="mt-2 text-ink-700/70">{grilleProf.appreciation}</p>}
        </details>
      )}

      <div className="space-y-2">
        {criteres.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={c.critere}
              onChange={(e) => majLigne(i, "critere", e.target.value)}
              placeholder="Intitulé du critère…"
              className={`${champ} flex-1`}
            />
            <input
              type="number" min={0} value={c.note} onChange={(e) => majLigne(i, "note", e.target.value)}
              placeholder="Note" className={`${champ} w-20`}
            />
            <span className="text-xs text-ink-700/50">/</span>
            <input
              type="number" min={1} value={c.sur} onChange={(e) => majLigne(i, "sur", e.target.value)}
              placeholder="Sur" className={`${champ} w-16`}
            />
            <button type="button" onClick={() => retirerLigne(i)} className="shrink-0 text-ink-700/40 hover:text-red-600" aria-label="Retirer le critère">
              <X size={16} />
            </button>
          </div>
        ))}
        <button type="button" onClick={ajouterLigne} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-medium text-forest-800 hover:bg-forest-50">
          <Plus size={13} /> Ajouter un critère
        </button>
      </div>

      <div className="mt-3">
        <label className={labelCls}>Appréciation</label>
        <textarea
          value={appreciation}
          onChange={(e) => setAppreciation(e.target.value)}
          rows={2}
          placeholder="Appréciation générale…"
          className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </div>

      {existante && (
        <div className="mt-3">
          <label className={labelCls}>Motif de la modification (obligatoire)</label>
          <input
            value={motif}
            onChange={(e) => { setMotif(e.target.value); setConfirmer(false); }}
            placeholder="Ex : erreur de saisie, réévaluation après entretien…"
            className={champ}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest-800">
          Note globale (aperçu) : {noteGlobalePreview.toLocaleString("fr-FR")}/20
        </span>
        <div className="flex items-center gap-3">
          {message && <span className={`text-xs font-medium ${message.ok ? "text-forest-700" : "text-red-600"}`}>{message.texte}</span>}
          <button
            onClick={enregistrer}
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {!existante ? "Enregistrer la grille" : confirmer ? "Confirmer l'envoi de la demande" : "Envoyer la demande de modification"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Mes demandes de modification
// ─────────────────────────────────────────────────────────────
function MesDemandes({ demandes }: { demandes: DemandeVue[] }) {
  if (demandes.length === 0) return null;
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-forest-900">
        <ListChecks size={16} className="text-forest-700" /> Mes demandes de modification
      </h3>
      <ul className="space-y-2">
        {demandes.map((d) => {
          const b = badgeDemande[d.statut];
          return (
            <li key={d.id} className="rounded-2xl border border-cream-200 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-forest-900">{d.libelle}</p>
                <Badge ton={b.ton}>{b.libelle}</Badge>
              </div>
              <p className="mt-1 text-xs text-ink-700/60"><strong>Motif :</strong> {d.motif} · {d.dateLabel}</p>
              {d.statut !== "en_attente" && d.motifDecision && (
                <p className="mt-1 text-xs text-ink-700/60"><strong>Décision :</strong> {d.motifDecision} {d.decideLeLabel ? `· ${d.decideLeLabel}` : ""}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

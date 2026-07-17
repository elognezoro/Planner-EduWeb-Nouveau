"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen, Check, ClipboardList, FlaskConical, Lightbulb, Loader2, Pencil, Plus,
  CalendarDays, Send, X,
} from "lucide-react";
import { Badge } from "@/components/app/ui";
import { enregistrerSeance, traiterDemandeAcces, type SousTitre } from "./actions";

// ─────────────────────────────────────────────────────────────
//  Types partagés avec la page serveur
// ─────────────────────────────────────────────────────────────
export interface Catalogues {
  enseignants: { id: string; nom: string }[];
  classes: { id: string; nom: string }[];
  disciplines: { id: string; nom: string }[];
  /** L'utilisateur courant est enseignant : le champ Enseignant est fixé à lui-même. */
  estEnseignant: boolean;
}

export interface SeanceLigne {
  id: string;
  titre: string;
  classeId: string;
  classeNom: string;
  disciplineId: string;
  disciplineNom: string;
  enseignantId: string | null;
  auteur: string;
  date: string; // AAAA-MM-JJ
  dateAffichee: string;
  statut: string; // brouillon | publie
  heureDebut: string | null;
  dureeMin: number | null;
  typeActivite: string | null;
  amorce: string;
  resume: string;
  sousTitres: SousTitre[];
  activitesApprentissage: string[];
  activitesEvaluation: string[];
  prochaineSeance: string; // AAAA-MM-JJ ou ""
  objectifsDefinis: boolean;
  devoirsAssignes: boolean;
  peutModifier: boolean;
}

export interface DemandeAccesLigne {
  id: string;
  demandeur: string; // « Parent — M. Traoré »
  seance: string; // « Théorème de Thalès (3ᵉ A) »
}

const TYPES_ACTIVITE = ["Cours", "Travaux dirigés", "Travaux pratiques", "Évaluation", "Remédiation", "Sortie pédagogique"];

const CHAMP_CLASSES =
  "h-11 w-full rounded-2xl border border-cream-300 bg-white px-3.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Liste éditable simple (activités d'apprentissage / d'évaluation). */
function ListeEditable({
  valeurs,
  poser,
  videTexte,
  placeholder,
}: {
  valeurs: string[];
  poser: (v: string[]) => void;
  videTexte: string;
  placeholder: string;
}) {
  return (
    <div className="mt-1.5 space-y-2">
      {valeurs.length === 0 && <p className="text-xs italic text-ink-700/50">{videTexte}</p>}
      {valeurs.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={v}
            onChange={(e) => poser(valeurs.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={placeholder}
            className={CHAMP_CLASSES}
          />
          <button
            type="button"
            onClick={() => poser(valeurs.filter((_, j) => j !== i))}
            aria-label="Retirer"
            className="shrink-0 rounded-full p-1.5 text-ink-700/50 hover:bg-cream-100"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Modale « Nouvelle séance » / édition
// ─────────────────────────────────────────────────────────────
function SeanceModal({
  catalogues,
  seance,
  onClose,
}: {
  catalogues: Catalogues;
  seance: SeanceLigne | null; // null = création
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [enseignantId, setEnseignantId] = useState(seance?.enseignantId ?? (catalogues.estEnseignant ? "moi" : ""));
  const [classeId, setClasseId] = useState(seance?.classeId ?? "");
  const [disciplineId, setDisciplineId] = useState(seance?.disciplineId ?? "");
  const [typeActivite, setTypeActivite] = useState(seance?.typeActivite ?? "");
  const [date, setDate] = useState(seance?.date ?? aujourdhui());
  const [heureDebut, setHeureDebut] = useState(seance?.heureDebut ?? "07:30");
  const [dureeMin, setDureeMin] = useState(String(seance?.dureeMin ?? 55));
  const [titre, setTitre] = useState(seance?.titre ?? "");
  const [amorce, setAmorce] = useState(seance?.amorce ?? "");
  const [sousTitres, setSousTitres] = useState<SousTitre[]>(seance?.sousTitres ?? []);
  const [resume, setResume] = useState(seance?.resume ?? "");
  const [apprentissage, setApprentissage] = useState<string[]>(seance?.activitesApprentissage ?? []);
  const [evaluation, setEvaluation] = useState<string[]>(seance?.activitesEvaluation ?? []);
  const [prochaine, setProchaine] = useState(seance?.prochaineSeance ?? "");

  function soumettre(statut: "brouillon" | "publie") {
    start(async () => {
      const fd = new FormData();
      if (seance) fd.set("seanceId", seance.id);
      fd.set("statut", statut);
      fd.set("classeId", classeId);
      fd.set("disciplineId", disciplineId);
      if (enseignantId && enseignantId !== "moi") fd.set("enseignantId", enseignantId);
      fd.set("date", date);
      fd.set("heureDebut", heureDebut);
      fd.set("dureeMin", dureeMin);
      fd.set("typeActivite", typeActivite);
      fd.set("titre", titre);
      fd.set("amorce", amorce);
      fd.set("sousTitres", JSON.stringify(sousTitres));
      fd.set("resume", resume);
      fd.set("activitesApprentissage", JSON.stringify(apprentissage.filter((a) => a.trim())));
      fd.set("activitesEvaluation", JSON.stringify(evaluation.filter((a) => a.trim())));
      if (prochaine) fd.set("prochaineSeance", prochaine);
      const res = await enregistrerSeance({ ok: false }, fd);
      if (res.ok) {
        onClose();
        router.refresh();
      } else setErreur(res.message ?? "Erreur technique.");
    });
  }

  const champ = CHAMP_CLASSES;
  const zone =
    "w-full rounded-2xl border border-cream-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
  const etiquette = "mb-1.5 block text-sm font-medium text-forest-900";
  const sousSection = "flex items-center justify-between";
  const boutonAjouter =
    "inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-600";

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
        className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-cream-200 bg-white p-6 shadow-soft"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-forest-900">
              {seance ? "Modifier la séance" : "Nouvelle séance"}
            </h2>
            <p className="mt-0.5 text-xs text-ink-700/60">Remplissez les informations de la séance.</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100">
            <X size={18} />
          </button>
        </div>

        {erreur && <p className="mt-3 text-sm font-medium text-red-600">{erreur}</p>}

        <div className="mt-4 space-y-4">
          {/* Enseignant · Classe */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={etiquette}>Enseignant</label>
              {catalogues.estEnseignant ? (
                <input value="Vous-même" disabled className={`${champ} opacity-70`} />
              ) : (
                <select value={enseignantId} onChange={(e) => setEnseignantId(e.target.value)} className={champ}>
                  <option value="">Sélectionner...</option>
                  {catalogues.enseignants.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className={etiquette}>Classe pédagogique</label>
              <select value={classeId} onChange={(e) => setClasseId(e.target.value)} className={champ}>
                <option value="">Sélectionner...</option>
                {catalogues.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Matière · Type d'activité */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={etiquette}>Matière (discipline)</label>
              <select value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)} className={champ}>
                <option value="">Sélectionner...</option>
                {catalogues.disciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={etiquette}>Type d&apos;activité</label>
              <select value={typeActivite} onChange={(e) => setTypeActivite(e.target.value)} className={champ}>
                <option value="">Sélectionner...</option>
                {TYPES_ACTIVITE.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date · Heure · Durée */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={etiquette}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
            </div>
            <div>
              <label className={etiquette}>Heure de début</label>
              <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className={champ} />
            </div>
            <div>
              <label className={etiquette}>Durée (min)</label>
              <input type="number" min={5} max={600} value={dureeMin} onChange={(e) => setDureeMin(e.target.value)} className={champ} />
            </div>
          </div>

          {/* Titre */}
          <div>
            <label className={`${etiquette} flex items-center gap-1.5`}>
              <BookOpen size={15} className="text-forest-700" /> Titre de la leçon / séance
            </label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. : Les nombres décimaux" className={champ} />
          </div>

          {/* Situation d'amorce */}
          <div>
            <label className={`${etiquette} flex items-center gap-1.5`}>
              <Lightbulb size={15} className="text-gold-600" /> Situation d&apos;amorce
            </label>
            <textarea
              value={amorce}
              onChange={(e) => setAmorce(e.target.value)}
              rows={3}
              placeholder="Décrivez la situation d'amorce : contexte, question de départ, problème posé aux élèves pour introduire la leçon..."
              className={zone}
            />
          </div>

          {/* Sous-titres hiérarchiques (4 niveaux) */}
          <div>
            <div className={sousSection}>
              <label className="text-sm font-medium text-forest-900">Sous-titres</label>
              <button type="button" onClick={() => setSousTitres([...sousTitres, { niveau: 1, texte: "" }])} className={boutonAjouter}>
                <Plus size={13} /> Ajouter
              </button>
            </div>
            <div className="mt-1.5 space-y-2">
              {sousTitres.length === 0 && <p className="text-xs italic text-ink-700/50">Aucun sous-titre ajouté.</p>}
              {sousTitres.map((s, i) => (
                <div key={i} className="flex items-center gap-2" style={{ paddingLeft: (s.niveau - 1) * 18 }}>
                  <select
                    value={s.niveau}
                    onChange={(e) =>
                      setSousTitres(sousTitres.map((x, j) => (j === i ? { ...x, niveau: Number(e.target.value) as SousTitre["niveau"] } : x)))
                    }
                    aria-label="Niveau hiérarchique"
                    className="h-11 shrink-0 rounded-2xl border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        Niv. {n}
                      </option>
                    ))}
                  </select>
                  <input
                    value={s.texte}
                    onChange={(e) => setSousTitres(sousTitres.map((x, j) => (j === i ? { ...x, texte: e.target.value } : x)))}
                    placeholder="Sous-titre / partie de la séance..."
                    className={champ}
                  />
                  <button
                    type="button"
                    onClick={() => setSousTitres(sousTitres.filter((_, j) => j !== i))}
                    aria-label="Retirer le sous-titre"
                    className="shrink-0 rounded-full p-1.5 text-ink-700/50 hover:bg-cream-100"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Résumé */}
          <div>
            <label className={`${etiquette} flex items-center gap-1.5`}>
              <ClipboardList size={15} className="text-orange-500" /> Résumé de la séance
            </label>
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              rows={3}
              placeholder="Résumez le contenu abordé durant cette séance..."
              className={zone}
            />
          </div>

          {/* Activités d'apprentissage */}
          <div>
            <div className={sousSection}>
              <label className="flex items-center gap-1.5 text-sm font-medium text-forest-900">
                <BookOpen size={15} className="text-forest-700" /> Activités d&apos;apprentissage
              </label>
              <button type="button" onClick={() => setApprentissage([...apprentissage, ""])} className={boutonAjouter}>
                <Plus size={13} /> Ajouter
              </button>
            </div>
            <ListeEditable valeurs={apprentissage} poser={setApprentissage} videTexte="Aucune activité d'apprentissage ajoutée." placeholder="Activité d'apprentissage..." />
          </div>

          {/* Activités d'évaluation */}
          <div>
            <div className={sousSection}>
              <label className="flex items-center gap-1.5 text-sm font-medium text-forest-900">
                <FlaskConical size={15} className="text-gold-600" /> Activités d&apos;évaluation
              </label>
              <button type="button" onClick={() => setEvaluation([...evaluation, ""])} className={boutonAjouter}>
                <Plus size={13} /> Ajouter
              </button>
            </div>
            <ListeEditable valeurs={evaluation} poser={setEvaluation} videTexte="Aucune évaluation planifiée." placeholder="Évaluation prévue..." />
          </div>

          {/* Prochaine séance */}
          <div>
            <label className={`${etiquette} flex items-center gap-1.5`}>
              <CalendarDays size={15} className="text-forest-700" /> Date de la prochaine séance
            </label>
            <input type="date" value={prochaine} onChange={(e) => setProchaine(e.target.value)} className={champ} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
            Annuler
          </button>
          <button
            onClick={() => soumettre("brouillon")}
            disabled={pending}
            className="h-11 rounded-full border border-cream-300 px-5 text-sm font-semibold text-forest-800 hover:bg-cream-100 disabled:opacity-60"
          >
            Brouillon
          </button>
          <button
            onClick={() => soumettre("publie")}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {seance ? "Enregistrer" : "Créer la séance"}
          </button>
          <button
            onClick={() => soumettre("publie")}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-600 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-500 disabled:opacity-60"
          >
            <Send size={14} /> Publier
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Bouton d'en-tête « + Nouvelle séance »
// ─────────────────────────────────────────────────────────────
export function BoutonNouvelleSeance({ catalogues }: { catalogues: Catalogues }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5 hover:bg-forest-700"
      >
        <Plus size={16} /> Nouvelle séance
      </button>
      <AnimatePresence>
        {ouvert && <SeanceModal catalogues={catalogues} seance={null} onClose={() => setOuvert(false)} />}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Liste des séances (badges, statut, crayon d'édition)
// ─────────────────────────────────────────────────────────────
export function ListeSeances({ seances, catalogues }: { seances: SeanceLigne[]; catalogues: Catalogues }) {
  const [enEdition, setEnEdition] = useState<SeanceLigne | null>(null);
  return (
    <div className="space-y-4">
      {seances.map((s) => (
        <div key={s.id} className="rounded-2xl border border-cream-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge ton="neutre">{s.disciplineNom}</Badge>
              <Badge ton="attente">{s.classeNom}</Badge>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge ton={s.statut === "publie" ? "succes" : "attente"}>
                {s.statut === "publie" ? (
                  <>
                    <Send size={11} className="mr-1 inline" /> Publié
                  </>
                ) : (
                  "Brouillon"
                )}
              </Badge>
              {s.peutModifier && (
                <button
                  onClick={() => setEnEdition(s)}
                  title="Modifier la séance"
                  className="rounded-full p-1.5 text-ink-700/55 hover:bg-cream-100"
                >
                  <Pencil size={15} />
                </button>
              )}
            </div>
          </div>
          <h3 className="mt-2 font-display text-lg font-bold text-forest-900">{s.titre}</h3>
          <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-700/70">
            {s.objectifsDefinis && (
              <span className="inline-flex items-center gap-1.5">
                <Lightbulb size={14} className="text-forest-600" /> Objectifs définis
              </span>
            )}
            {s.devoirsAssignes && (
              <span className="inline-flex items-center gap-1.5">
                <ClipboardList size={14} className="text-gold-700" /> Devoirs assignés
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-700/55">
            {s.auteur} · {s.dateAffichee}
          </p>
        </div>
      ))}
      <AnimatePresence>
        {enEdition && <SeanceModal catalogues={catalogues} seance={enEdition} onClose={() => setEnEdition(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Demandes d'accès — Accorder / Refuser
// ─────────────────────────────────────────────────────────────
export function LigneDemandeAcces({ demande }: { demande: DemandeAccesLigne }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function decider(decision: "accordee" | "refusee") {
    start(async () => {
      const fd = new FormData();
      fd.set("demandeId", demande.id);
      fd.set("decision", decision);
      const res = await traiterDemandeAcces({ ok: false }, fd);
      setMessage(res.message ?? null);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-4">
      <p className="font-semibold text-forest-900">{demande.demandeur}</p>
      <p className="mt-0.5 text-xs text-ink-700/60">{demande.seance}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => decider("accordee")}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-800 px-4 text-xs font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Accorder
        </button>
        <button
          onClick={() => decider("refusee")}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 px-4 text-xs font-semibold text-ink-700/70 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
        >
          Refuser
        </button>
      </div>
      {message && <p className="mt-2 text-xs font-medium text-red-600">{message}</p>}
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Loader2, ChevronLeft, ChevronRight, Pencil, Check } from "lucide-react";
import {
  GrilleNiveauEditor,
  type DisciplineLigne,
  type DisciplineListe,
  type EtatAuto,
} from "./grille/grille-editor";
import { ajouterNiveau, changerCycleNiveau, deplacerNiveau, renommerNiveau, supprimerNiveau } from "./config-actions";
import { estPrimaireOuPrescolaire } from "@/lib/referentiels/etablissement";

// Cycle d'un niveau (pilote le solveur : 1er / 2nd cycle, primaire, préscolaire).
const CYCLES = [
  { v: "prescolaire", l: "Préscolaire" },
  { v: "primaire", l: "Primaire" },
  { v: "college", l: "1er cycle (collège)" },
  { v: "lycee", l: "2nd cycle (lycée)" },
];

/** Cycle proposé pour un nouveau niveau, selon la catégorie pédagogique de l'établissement. */
function cycleParDefaut(categorie: string | undefined): string {
  if (categorie === "prescolaire") return "prescolaire";
  if (categorie === "primaire") return "primaire";
  return "college";
}

export function VolumesBlock({
  etablissementId,
  niveaux,
  toutesDisciplines,
  modePrimaire = false,
  categorie,
}: {
  etablissementId: string;
  /** `propre` : niveau créé par CET établissement — son cycle se corrige ici (jamais un national). */
  niveaux: { id: string; nom: string; cycle: string; propre?: boolean; lignes: DisciplineLigne[] }[];
  toutesDisciplines: DisciplineListe[];
  /** Établissement de catégorie préscolaire/primaire : ses niveaux du MÊME cycle ne se voient pas
   *  proposer les spécialités du secondaire (liste restreinte, création par saisie) ; ses niveaux
   *  du secondaire éventuels gardent la liste complète. Aucune liste n'est jamais désactivée. */
  modePrimaire?: boolean;
  /** Catégorie pédagogique de l'établissement : cycle proposé par défaut pour un nouveau niveau. */
  categorie?: string;
}) {
  const [actif, setActif] = useState(niveaux[0]?.id ?? "");
  // Niveaux déjà OUVERTS : leurs éditeurs restent montés (une saisie enregistrée automatiquement,
  // sans re-rendu serveur, reste affichée au retour sur l'onglet) ; les autres ne sont montés qu'à
  // leur première ouverture (coût de rendu et d'hydratation borné).
  const [visites, setVisites] = useState<Set<string>>(() => new Set(niveaux[0] ? [niveaux[0].id] : []));
  const [pending, start] = useTransition();
  const [nom, setNom] = useState("");
  // Au primaire/préscolaire, un nouveau niveau (CP1, PS…) est par défaut de CE cycle ; le défaut
  // suit la catégorie si elle change (choix en tête de page, réalignement sur le type).
  const [cycle, setCycle] = useState(cycleParDefaut(categorie));
  const [categoriePrec, setCategoriePrec] = useState(categorie);
  if (categoriePrec !== categorie) {
    setCategoriePrec(categorie);
    setCycle(cycleParDefaut(categorie));
  }
  const [message, setMessage] = useState<string | null>(null);
  // Renommage du niveau actif (nom d'affichage propre à l'établissement).
  const [renomme, setRenomme] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  // Disciplines ajoutées pendant la session à un niveau PRIMAIRE : aussitôt proposées aux autres
  // niveaux primaires (l'enregistrement automatique ne revalide pas la page).
  const [ajoutsSession, setAjoutsSession] = useState<Set<string>>(() => new Set());
  // État de l'enregistrement automatique de chaque niveau (indicateur d'échec sur les onglets).
  const [etatsAuto, setEtatsAuto] = useState<Record<string, EtatAuto>>({});

  const niveauActif = niveaux.find((n) => n.id === actif) ?? niveaux[0];
  // Repli (niveau actif supprimé, premier niveau ajouté…) : l'onglet réellement affiché devient
  // l'actif ET un niveau visité — sinon son éditeur serait démonté au premier changement d'onglet
  // (enregistrement automatique en attente annulé, valeurs périmées au retour).
  if (niveauActif && niveauActif.id !== actif) setActif(niveauActif.id);
  if (niveauActif && !visites.has(niveauActif.id)) setVisites((s) => new Set(s).add(niveauActif.id));

  const disciplinesListe = useMemo(
    () =>
      ajoutsSession.size === 0
        ? toutesDisciplines
        : toutesDisciplines.map((d) => (ajoutsSession.has(d.id) ? { ...d, utilisee: true } : d)),
    [toutesDisciplines, ajoutsSession],
  );
  const surDisciplineAjoutee = useCallback((id: string) => {
    setAjoutsSession((s) => (s.has(id) ? s : new Set(s).add(id)));
  }, []);
  const surEtatAuto = useCallback((niveauId: string, e: EtatAuto) => {
    setEtatsAuto((s) => (s[niveauId] === e ? s : { ...s, [niveauId]: e }));
  }, []);

  function ouvrir(id: string) {
    setActif(id);
    setVisites((s) => (s.has(id) ? s : new Set(s).add(id)));
  }

  function ouvrirRenommage() {
    setNouveauNom(niveauActif?.nom ?? "");
    setRenomme(true);
  }
  function renommer() {
    if (!niveauActif) return;
    setMessage(null);
    start(async () => {
      const r = await renommerNiveau(etablissementId, niveauActif.id, nouveauNom);
      if (r.ok) setRenomme(false);
      else if (r.message) setMessage(r.message);
    });
  }
  function changerCycle(niveauId: string, nouveau: string) {
    setMessage(null);
    start(async () => {
      const r = await changerCycleNiveau(etablissementId, niveauId, nouveau);
      if (!r.ok && r.message) setMessage(r.message);
    });
  }

  function ajouter() {
    if (!nom.trim()) return;
    setMessage(null);
    start(async () => {
      const r = await ajouterNiveau(etablissementId, nom, cycle);
      if (r.ok) setNom("");
      else if (r.message) setMessage(r.message);
    });
  }
  function deplacer(niveauId: string, direction: "gauche" | "droite") {
    setMessage(null);
    start(async () => {
      // On transmet l'ordre TEL QU'AFFICHÉ : le serveur réécrit la séquence complète, ce qui
      // évite les rangs en double pour les niveaux qui n'en avaient pas encore.
      const r = await deplacerNiveau(etablissementId, niveauId, direction, niveaux.map((n) => n.id));
      if (!r.ok && r.message) setMessage(r.message);
    });
  }
  function supprimer(niveauId: string, niveauNom: string) {
    if (!window.confirm(`Retirer le niveau « ${niveauNom} » de VOTRE établissement ? Ses classes et sa grille horaire ici seront supprimées. Le référentiel national et les autres établissements ne sont pas affectés.`)) return;
    setMessage(null);
    start(async () => {
      const r = await supprimerNiveau(niveauId, etablissementId);
      if (!r.ok && r.message) setMessage(r.message);
    });
  }

  return (
    <div>
      {message && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}

      {/* Onglets des niveaux (avec suppression par niveau) */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {niveaux.map((n, index) => {
          const estActif = !!niveauActif && n.id === niveauActif.id;
          const styleFleche = estActif
            ? "text-cream-50/70 hover:bg-white/20 hover:text-white"
            : "text-ink-700/40 hover:bg-forest-50 hover:text-forest-700";
          return (
            <span
              key={n.id}
              className={`inline-flex items-center rounded-full transition-colors ${
                estActif ? "bg-forest-800 text-cream-50" : "border border-cream-300 bg-white text-forest-800 hover:bg-forest-50"
              }`}
            >
              {/* Réordonnancement : flèches plutôt que glisser-déposer — plus sûr au doigt sur
                  téléphone, et utilisable au clavier (public à faible aisance numérique). */}
              <button
                type="button"
                onClick={() => deplacer(n.id, "gauche")}
                disabled={pending || index === 0}
                title={`Déplacer ${n.nom} vers la gauche`}
                aria-label={`Déplacer le niveau ${n.nom} vers la gauche`}
                className={`ml-1 flex h-5 w-4 items-center justify-center rounded disabled:opacity-25 ${styleFleche}`}
              >
                <ChevronLeft size={13} />
              </button>
              {/* Sélection du niveau : élément NON-form (span) pour rester cliquable même quand la
                  configuration est VERROUILLÉE — le <fieldset disabled> parent désactive les <button>
                  (réordonnancement/suppression/renommage/ajout restent donc bloqués) mais PAS les
                  <span>. Permet à tout utilisateur habilité de DÉFILER entre les niveaux en lecture
                  seule pour consulter les volumes horaires par niveau. */}
              <span
                role="button"
                tabIndex={0}
                onClick={() => ouvrir(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    ouvrir(n.id);
                  }
                }}
                title={`Voir la grille de ${n.nom}`}
                className="inline-flex cursor-pointer items-center gap-1 py-1.5 px-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
              >
                {n.nom}
                {/* Échec d'un enregistrement automatique survenu hors écran : signalé sur l'onglet. */}
                {etatsAuto[n.id] === "erreur" && (
                  <span
                    role="img"
                    aria-label="Échec de l'enregistrement automatique"
                    title="Échec de l'enregistrement automatique : ouvrez ce niveau et utilisez « Enregistrer la grille »."
                    className="inline-block h-2 w-2 rounded-full bg-red-500"
                  />
                )}
              </span>
              <button
                type="button"
                onClick={() => deplacer(n.id, "droite")}
                disabled={pending || index === niveaux.length - 1}
                title={`Déplacer ${n.nom} vers la droite`}
                aria-label={`Déplacer le niveau ${n.nom} vers la droite`}
                className={`mr-0.5 flex h-5 w-4 items-center justify-center rounded disabled:opacity-25 ${styleFleche}`}
              >
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => supprimer(n.id, n.nom)}
                disabled={pending}
                title={`Supprimer le niveau ${n.nom}`}
                aria-label={`Supprimer le niveau ${n.nom}`}
                className={`mr-1.5 flex h-5 w-5 items-center justify-center rounded-full disabled:opacity-50 ${
                  estActif ? "text-cream-50/70 hover:bg-white/20 hover:text-white" : "text-ink-700/40 hover:bg-red-50 hover:text-red-600"
                }`}
              >
                <Trash2 size={12} />
              </button>
            </span>
          );
        })}
      </div>

      {/* Renommer le niveau actif — libellé PROPRE à cet établissement (le nom national ne bouge pas)
          — et, pour un niveau créé par l'établissement, corriger son CYCLE. */}
      {niveauActif && (
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {renomme ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={nouveauNom}
                onChange={(e) => setNouveauNom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); renommer(); }
                  if (e.key === "Escape") setRenomme(false);
                }}
                autoFocus
                maxLength={60}
                placeholder="Nom affiché (ex : 6e)"
                className="h-9 w-52 rounded-lg border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
              <button
                type="button"
                onClick={renommer}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-800 px-4 text-xs font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setRenomme(false)}
                className="inline-flex h-9 items-center rounded-full border border-cream-300 px-3 text-xs font-medium text-ink-700/70 hover:bg-cream-100"
              >
                Annuler
              </button>
              <span className="text-[0.7rem] text-ink-700/45">Vider le champ rétablit le nom d&apos;origine.</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={ouvrirRenommage}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-700 hover:text-forest-900"
            >
              <Pencil size={13} /> Renommer « {niveauActif.nom} » pour cet établissement
            </button>
          )}
          {niveauActif.propre && !renomme && (
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-700/70">
              Cycle de « {niveauActif.nom} » :
              <select
                value={niveauActif.cycle}
                onChange={(e) => changerCycle(niveauActif.id, e.target.value)}
                disabled={pending}
                className="h-8 rounded-lg border border-cream-300 bg-white px-2 text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-50"
              >
                {CYCLES.map((c) => (
                  <option key={c.v} value={c.v}>{c.l}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {/* Ajouter un niveau — par saisie du nom + cycle */}
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-cream-100 pb-4">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ajouter();
            }
          }}
          placeholder="Nouveau niveau (ex : 6ème, CP1, BT1…)"
          className="h-9 w-56 rounded-lg border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
        <select
          value={cycle}
          onChange={(e) => setCycle(e.target.value)}
          aria-label="Cycle du nouveau niveau"
          className="h-9 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        >
          {CYCLES.map((c) => (
            <option key={c.v} value={c.v}>{c.l}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={ajouter}
          disabled={pending || !nom.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter le niveau
        </button>
      </div>

      {!niveauActif ? (
        <p className="text-sm text-ink-700/60">Aucun niveau. Ajoutez-en un ci-dessus pour définir sa grille horaire.</p>
      ) : (
        niveaux
          .filter((n) => n.id === niveauActif.id || visites.has(n.id))
          .map((n) => {
            const restreinte = modePrimaire && estPrimaireOuPrescolaire(n.cycle);
            return (
              <div key={n.id} hidden={n.id !== niveauActif.id} className="overflow-x-auto">
                <GrilleNiveauEditor
                  etablissementId={etablissementId}
                  niveauId={n.id}
                  niveauNom={n.nom}
                  disciplines={n.lignes}
                  toutesDisciplines={disciplinesListe}
                  listeRestreinte={restreinte}
                  onDisciplineAjoutee={restreinte ? surDisciplineAjoutee : undefined}
                  onEtatAuto={surEtatAuto}
                />
              </div>
            );
          })
      )}
    </div>
  );
}

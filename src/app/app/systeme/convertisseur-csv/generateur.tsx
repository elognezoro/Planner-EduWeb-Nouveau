"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, Download, FileSpreadsheet, X, Plus, Trash2, Loader2, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { normEnTete as norm, lireFichierListe, trouverColonne } from "@/lib/convertisseur/lire-liste";
import { nomEnMajuscules, prenomsEnTitre, separerNomPrenoms, identifiant, differencier, type RegleSeparation } from "@/lib/convertisseur/format-noms";
import { genererMotDePasse, LONGUEUR_MDP_GENERE } from "@/lib/convertisseur/generer-mot-de-passe";
import { motDePasseConforme, CRITERES_MOT_DE_PASSE } from "@/lib/validation/mot-de-passe";
import { Champ, SelectCol, champStyle } from "./champs";

// ───────────────────────────── Détection des colonnes sources ─────────────────────────────
const ALIAS = {
  nom: ["nom", "noms", "lastname", "surname", "famille"],
  prenoms: ["prenom", "prenoms", "firstname", "givenname"],
  combine: ["nom et prenoms", "nom prenoms", "noms et prenoms", "identite", "enseignant", "personnel", "nom complet"],
  email: ["email", "e-mail", "mail", "courriel", "adresse email", "adresse e-mail"],
  role: ["role", "fonction", "profil", "statut"],
  disciplines: ["discipline", "disciplines", "matiere", "matieres", "competence", "competences"],
  niveaux: ["niveau", "niveaux", "cycle", "cycles"],
};

/** Rôles attribuables par la console Enseignants d'un établissement (mêmes noms techniques). */
const ROLES_SORTIE = [
  { valeur: "enseignant", libelle: "Enseignant" },
  { valeur: "educateur", libelle: "Éducateur" },
  { valeur: "chef_etablissement", libelle: "Chef d'établissement" },
  { valeur: "adjoint_chef_etablissement", libelle: "Adjoint au chef d'établissement" },
  { valeur: "inspecteur_orientation", libelle: "Inspecteur d'orientation" },
  { valeur: "parent", libelle: "Parent" },
  { valeur: "eleve", libelle: "Élève" },
];

// L'apostrophe TYPOGRAPHIQUE (Word) doit retomber sur l'apostrophe droite des libellés,
// sinon « Chef d'établissement » saisi sous Word deviendrait « enseignant » à l'import.
const normRole = (s: string) => norm(s).replace(/[’‘]/g, "'");
const ROLE_PAR_CLE = new Map<string, string>();
for (const r of ROLES_SORTIE) {
  ROLE_PAR_CLE.set(normRole(r.valeur), r.valeur);
  ROLE_PAR_CLE.set(normRole(r.libelle), r.valeur);
}

/**
 * Normalise une composante de la colonne niveaux vers « 1er cycle » / « 2nd cycle » ; un nom de
 * niveau précis (ex. « 6e ») est transmis tel quel — l'import EduWeb l'accepte aussi.
 */
function normaliserCycle(brut: string): string {
  const n = norm(brut).replace(/\s+/g, " ");
  if (["1er cycle", "1e cycle", "premier cycle", "college", "1er cycle (college)"].includes(n)) return "1er cycle";
  if (["2nd cycle", "2e cycle", "2eme cycle", "second cycle", "lycee", "2nd cycle (lycee)"].includes(n)) return "2nd cycle";
  return brut.trim();
}

// Cellule SOURCE multi-valeurs : tout séparateur usuel ; valeur PAR DÉFAUT saisie ici : « | »
// uniquement (comme l'annonce le libellé du champ — un nom contenant une virgule y survit).
const SEP_SOURCE = /[|,;/\r\n]/;
const SEP_BARRE = /[|\r\n]/;
function enListeBarres(brut: string, separateurs: RegExp, transformer?: (v: string) => string): string {
  return brut
    .split(separateurs)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => (transformer ? transformer(v) : v))
    .join("|");
}

/**
 * L'import EduWeb découpe les lignes sur « ; » et les retours-ligne SANS interpréter les
 * guillemets : aucune cellule positionnelle ne doit donc en contenir (un « Alt+Entrée » Excel
 * ou un « ; » dans un nom décalerait toutes les colonnes).
 */
const nettoyerCellule = (v: string) => v.replace(/\s*[\r\n]+\s*/g, " ").replace(/;/g, " ").replace(/\s+/g, " ").trim();

const CLES_SORTIE = ["prenoms", "nom", "email", "motDePasse", "role", "disciplines", "niveaux"] as const;
type CleSortie = (typeof CLES_SORTIE)[number];
const LIBELLE_SORTIE: Record<CleSortie, string> = {
  prenoms: "prénoms",
  nom: "nom",
  email: "email",
  motDePasse: "mot de passe",
  role: "rôle",
  disciplines: "disciplines",
  niveaux: "niveaux",
};
/** En-têtes écrits dans le CSV (sans accents : lisibles partout, reconnus par l'import EduWeb). */
const ENTETE_SORTIE: Record<CleSortie, string> = {
  prenoms: "prenoms",
  nom: "nom",
  email: "email",
  motDePasse: "mot de passe",
  role: "role",
  disciplines: "disciplines",
  niveaux: "niveaux",
};

export function GenerateurComptes() {
  const [fichierNom, setFichierNom] = useState<string | null>(null);
  const [brutes, setBrutes] = useState<string[][]>([]);
  const [avecEntete, setAvecEntete] = useState(true);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmerReinit, setConfirmerReinit] = useState(false);
  const minuterieReinit = useRef<number | null>(null);
  // Minuterie de confirmation soldée au démontage (sinon fuite + setState orphelin).
  useEffect(() => () => {
    if (minuterieReinit.current) window.clearTimeout(minuterieReinit.current);
  }, []);

  // Correspondance des colonnes SOURCES
  const [modeNom, setModeNom] = useState<"separe" | "combine">("separe");
  const [colNom, setColNom] = useState(-1);
  const [colPrenoms, setColPrenoms] = useState(-1);
  const [colCombine, setColCombine] = useState(0);
  const [regleSep, setRegleSep] = useState<RegleSeparation>("majuscules");
  const [colEmail, setColEmail] = useState(-1);
  const [colRole, setColRole] = useState(-1);
  const [colDisciplines, setColDisciplines] = useState(-1);
  const [colNiveaux, setColNiveaux] = useState(-1);

  // Champs de SORTIE configurables
  const [inclure, setInclure] = useState<Record<CleSortie, boolean>>({
    prenoms: true,
    nom: true,
    email: true,
    motDePasse: true,
    role: true,
    disciplines: true,
    niveaux: true,
  });
  // « fin » par défaut : le fichier reste DIRECTEMENT importable (colonnes lues par position).
  const [posMdp, setPosMdp] = useState<"apres-email" | "fin">("fin");
  const [modeMdp, setModeMdp] = useState<"aleatoire" | "fixe">("aleatoire");
  const [mdpFixe, setMdpFixe] = useState("");
  const [nonceMdp, setNonceMdp] = useState(0);
  const [domaineEmail, setDomaineEmail] = useState("eduweb.ci");
  const [roleDefaut, setRoleDefaut] = useState("enseignant");
  const [disciplinesDefaut, setDisciplinesDefaut] = useState("");
  const [niveauxDefaut, setNiveauxDefaut] = useState("");
  const [colonnesPerso, setColonnesPerso] = useState<{ entete: string; valeur: string }[]>([]);

  // Colonnes et lignes DÉRIVÉES : décocher « 1re ligne = en-tête » restitue la première
  // personne (une 1re ligne de données contenant « Enseignant » peut être prise pour un en-tête).
  const colonnes = useMemo(() => {
    if (brutes.length === 0) return [];
    return avecEntete ? brutes[0] : brutes[0].map((_, i) => `Colonne ${String.fromCharCode(65 + i)}`);
  }, [brutes, avecEntete]);
  const lignes = useMemo(() => (avecEntete ? brutes.slice(1) : brutes), [brutes, avecEntete]);

  const nbColonnes = colonnes.length;
  const labelCol = useCallback(
    (i: number) => (i < 0 ? "— (aucune) —" : colonnes[i] || `Colonne ${String.fromCharCode(65 + i)}`),
    [colonnes],
  );

  const charger = useCallback(async (file: File) => {
    setErreur(null);
    setChargement(true);
    setConfirmerReinit(false); // une confirmation armée ne doit pas viser la nouvelle liste
    try {
      const table = (await lireFichierListe(file)).filter((r) => r.some((c) => c && c.trim().length > 0));
      if (table.length === 0) {
        setErreur("Fichier vide ou illisible. Formats acceptés : Excel (.xlsx/.xls), Word (.docx), CSV, texte.");
        return;
      }
      const larg = Math.max(...table.map((r) => r.length));
      const rows = table.map((r) => Array.from({ length: larg }, (_, i) => r[i] ?? ""));
      const premiere = rows[0];
      const tousAlias = Object.values(ALIAS).flat();
      const entete = premiere.some((c) => tousAlias.includes(norm(c)));
      const src = entete ? premiere : premiere.map((_, i) => `Colonne ${String.fromCharCode(65 + i)}`);
      setBrutes(rows);
      setAvecEntete(entete);
      setFichierNom(file.name);
      setNonceMdp((x) => x + 1); // nouveaux mots de passe pour la nouvelle liste

      const iNom = trouverColonne(src, ALIAS.nom);
      const iPre = trouverColonne(src, ALIAS.prenoms);
      const iComb = trouverColonne(src, ALIAS.combine);
      if (iNom >= 0 && iPre >= 0) {
        setModeNom("separe");
        setColNom(iNom);
        setColPrenoms(iPre);
      } else if (iComb >= 0 || larg === 1) {
        setModeNom("combine");
        setColCombine(Math.max(0, iComb));
        // Liste en UNE SEULE colonne : la 1re composante est le NOM, les suivantes les prénoms.
        if (larg === 1) setRegleSep("premier");
      } else {
        setModeNom(larg >= 2 ? "separe" : "combine");
        setColNom(iNom >= 0 ? iNom : 0);
        setColPrenoms(iPre >= 0 ? iPre : Math.min(1, larg - 1));
        setColCombine(0);
      }
      setColEmail(trouverColonne(src, ALIAS.email));
      setColRole(trouverColonne(src, ALIAS.role));
      setColDisciplines(trouverColonne(src, ALIAS.disciplines));
      setColNiveaux(trouverColonne(src, ALIAS.niveaux));
    } catch (e) {
      console.error(e);
      setErreur("Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un Excel, Word ou CSV valide.");
    } finally {
      setChargement(false);
    }
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setSurvol(false);
    const f = e.dataTransfer.files?.[0];
    if (f) charger(f);
  }

  const cell = (l: string[], i: number) => (i >= 0 && i < l.length ? (l[i] ?? "").trim() : "");

  // Mots de passe ALÉATOIRES : un par ligne source, STABLES tant que la liste ne change pas
  // (modifier un autre réglage ne les regénère pas — l'aperçu et le fichier téléchargé restent
  // identiques d'un rendu à l'autre).
  const motsDePasse = useMemo(
    () => lignes.map(() => genererMotDePasse()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nonceMdp force volontairement un nouveau tirage
    [lignes, nonceMdp],
  );

  const mdpFixeConforme = mdpFixe.length <= LONGUEUR_MDP_GENERE && motDePasseConforme(mdpFixe);
  // Exigence client : les mots de passe livrés RESPECTENT les critères — un mot de passe commun
  // non conforme (ou vide) bloque le téléchargement au lieu de livrer un fichier fautif.
  const mdpBloquant = inclure.motDePasse && modeMdp === "fixe" && !mdpFixeConforme;

  /** Ordre des colonnes de sortie : celles activées, mot de passe après l'e-mail ou en fin. */
  const ordreSortie = useMemo<CleSortie[]>(() => {
    const base = CLES_SORTIE.filter((c) => inclure[c] && (c !== "motDePasse" || posMdp === "apres-email"));
    if (inclure.motDePasse && posMdp === "fin") base.push("motDePasse");
    return base;
  }, [inclure, posMdp]);

  /** Le fichier respecte-t-il l'ordre positionnel de l'import Enseignants d'un établissement ? */
  const importDirect =
    inclure.prenoms &&
    inclure.nom &&
    inclure.email &&
    inclure.role &&
    inclure.disciplines &&
    inclure.niveaux &&
    (!inclure.motDePasse || posMdp === "fin");

  const domaine = domaineEmail.trim().replace(/^@/, "");
  const domaineValide = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domaine);

  const sortie = useMemo(() => {
    if (lignes.length === 0) return null;
    // Une colonne personnalisée sans en-tête n'émet RIEN (sinon l'en-tête et les données
    // se désaligneraient d'une colonne dans le fichier ET l'aperçu).
    const persoValides = colonnesPerso.filter((c) => c.entete.trim());
    const entete = [...ordreSortie.map((c) => ENTETE_SORTIE[c]), ...persoValides.map((c) => c.entete.trim())];
    const vus = new Map<string, number>();
    const emailsEmis = new Set<string>();
    const emailsDoublons = new Set<string>();
    const rolesInconnus = new Set<string>();
    let emailsGeneres = 0;
    const rows: string[][] = [];
    for (let idx = 0; idx < lignes.length; idx++) {
      const l = lignes[idx];
      let nom: string, prenoms: string;
      if (modeNom === "combine") {
        const s = separerNomPrenoms(cell(l, colCombine), regleSep);
        nom = s.nom;
        prenoms = s.prenoms;
      } else {
        nom = cell(l, colNom);
        prenoms = cell(l, colPrenoms);
      }
      if (!nom && !prenoms) continue;

      // E-mail : celui du fichier s'il existe, sinon « prenom.nom@domaine » — unique parmi
      // TOUS les e-mails émis (fournis compris) ; un doublon FOURNI est signalé, jamais réécrit.
      let email = nettoyerCellule(cell(l, colEmail)).toLowerCase();
      if (email) {
        if (emailsEmis.has(email)) emailsDoublons.add(email);
      } else {
        emailsGeneres++;
        const base = identifiant(prenoms, nom);
        let n = vus.get(base) ?? 0;
        do {
          n += 1;
          const unique = n > 1 ? differencier(base, n) : base;
          email = domaine ? `${unique}@${domaine}` : unique;
        } while (emailsEmis.has(email));
        vus.set(base, n);
      }
      emailsEmis.add(email);

      const roleBrut = nettoyerCellule(cell(l, colRole));
      let role = roleDefaut;
      if (roleBrut) {
        const reconnu = ROLE_PAR_CLE.get(normRole(roleBrut));
        if (reconnu) role = reconnu;
        else {
          // Transmis tel quel mais SIGNALÉ : l'import retomberait en silence sur « enseignant ».
          role = roleBrut;
          rolesInconnus.add(roleBrut);
        }
      }

      const cDisc = cell(l, colDisciplines);
      const cNiv = cell(l, colNiveaux);
      const valeurs: Record<CleSortie, string> = {
        prenoms: nettoyerCellule(prenomsEnTitre(prenoms)),
        nom: nettoyerCellule(nomEnMajuscules(nom)),
        email,
        motDePasse: modeMdp === "fixe" ? mdpFixe : motsDePasse[idx] ?? "",
        role,
        disciplines: cDisc ? enListeBarres(cDisc, SEP_SOURCE) : enListeBarres(disciplinesDefaut, SEP_BARRE),
        niveaux: cNiv ? enListeBarres(cNiv, SEP_SOURCE, normaliserCycle) : enListeBarres(niveauxDefaut, SEP_BARRE, normaliserCycle),
      };
      rows.push([...ordreSortie.map((c) => valeurs[c]), ...persoValides.map((c) => c.valeur)]);
    }
    return { entete, rows, rolesInconnus: [...rolesInconnus], emailsDoublons: [...emailsDoublons], emailsGeneres };
  }, [lignes, modeNom, colCombine, regleSep, colNom, colPrenoms, colEmail, colRole, colDisciplines, colNiveaux, ordreSortie, colonnesPerso, domaine, modeMdp, mdpFixe, motsDePasse, roleDefaut, disciplinesDefaut, niveauxDefaut]);

  const telechargeable = Boolean(sortie && sortie.rows.length > 0 && sortie.entete.length > 0 && !mdpBloquant);

  function telecharger() {
    if (!sortie || !telechargeable) return;
    // Point-virgule : ouverture directe EN COLONNES dans Excel (locale française) et délimiteur
    // accepté par l'import Enseignants d'un établissement.
    const DELIM = ";";
    const esc = (v: string) => (v.includes(DELIM) || /["\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [sortie.entete, ...sortie.rows].map((r) => r.map((c) => esc(c ?? "")).join(DELIM)).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "comptes-eduweb.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Vide la liste chargée (confirmation en 2 clics — pas de dialogue natif, bloqué en aperçu).
  function demanderReinit() {
    if (!confirmerReinit) {
      setConfirmerReinit(true);
      if (minuterieReinit.current) window.clearTimeout(minuterieReinit.current);
      minuterieReinit.current = window.setTimeout(() => setConfirmerReinit(false), 4000);
      return;
    }
    if (minuterieReinit.current) window.clearTimeout(minuterieReinit.current);
    setConfirmerReinit(false);
    setFichierNom(null);
    setBrutes([]);
    setErreur(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const criteres = CRITERES_MOT_DE_PASSE.map((c) => c.libelle).join(", ");
  const avertissements: string[] = [];
  if (sortie && sortie.rolesInconnus.length > 0) {
    avertissements.push(
      `Rôle(s) non reconnu(s), transmis tels quels (l'import les traiterait comme « Enseignant ») : ${sortie.rolesInconnus.slice(0, 5).join(", ")}${sortie.rolesInconnus.length > 5 ? "…" : ""}.`,
    );
  }
  if (sortie && sortie.emailsDoublons.length > 0) {
    avertissements.push(
      `E-mail(s) en DOUBLON dans le fichier source (à l'import, les lignes fusionneraient sur un même compte) : ${sortie.emailsDoublons.slice(0, 5).join(", ")}${sortie.emailsDoublons.length > 5 ? "…" : ""}.`,
    );
  }
  if (sortie && inclure.email && sortie.emailsGeneres > 0 && !domaineValide) {
    avertissements.push(
      `Domaine e-mail « ${domaine || "(vide)"} » invalide : ${sortie.emailsGeneres} adresse(s) générée(s) seraient rejetées à l'import. Renseignez un domaine (ex. eduweb.ci).`,
    );
  }

  return (
    <div className="space-y-6">
      {/* Zone de dépôt */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          survol ? "border-forest-400 bg-forest-50/60" : "border-cream-300 bg-cream-50/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.docx,.csv,.txt,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) charger(f);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Déposer un fichier (génération de comptes)"
        />
        {chargement ? (
          <Loader2 className="mb-2 animate-spin text-forest-600" size={28} />
        ) : (
          <UploadCloud className="mb-2 text-forest-500" size={30} />
        )}
        <p className="text-base font-semibold text-forest-900">
          Glissez un fichier ici, ou <span className="underline">parcourez</span>
        </p>
        <p className="mt-1 text-sm text-ink-700/60">Excel (.xlsx, .xls), Word (.docx), CSV ou texte</p>
        {fichierNom && (
          <span className="pointer-events-none mt-3 inline-flex items-center gap-2 rounded-full border border-forest-200 bg-white px-3 py-1 text-sm font-medium text-forest-800">
            <FileSpreadsheet size={13} /> {fichierNom} · {lignes.length} ligne(s)
          </span>
        )}
      </div>

      {erreur && (
        <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
          <AlertTriangle size={16} className="shrink-0" /> {erreur}
        </p>
      )}

      {brutes.length > 0 && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Correspondance des colonnes sources */}
            <section className="space-y-3 rounded-2xl border border-cream-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-forest-900">Colonnes du fichier</h3>
                <label className="flex items-center gap-1.5 text-sm text-ink-700/70">
                  <input type="checkbox" checked={avecEntete} onChange={(e) => setAvecEntete(e.target.checked)} />
                  1re ligne = en-tête
                </label>
              </div>

              <div className="flex flex-wrap gap-2 text-sm">
                {(["separe", "combine"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={modeNom === m}
                    onClick={() => setModeNom(m)}
                    className={`rounded-full border px-3 py-1.5 font-medium transition-colors ${
                      modeNom === m ? "border-transparent bg-forest-700 text-cream-50" : "border-cream-300 text-ink-700/70 hover:border-forest-300"
                    }`}
                  >
                    {m === "separe" ? "Nom et prénoms séparés" : "Nom + prénoms dans une colonne"}
                  </button>
                ))}
              </div>

              {modeNom === "separe" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Champ label="Colonne du NOM">
                    <SelectCol value={colNom} onChange={setColNom} nb={nbColonnes} label={labelCol} />
                  </Champ>
                  <Champ label="Colonne des Prénoms">
                    <SelectCol value={colPrenoms} onChange={setColPrenoms} nb={nbColonnes} label={labelCol} />
                  </Champ>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Champ label="Colonne « Nom + Prénoms »">
                    <SelectCol value={colCombine} onChange={setColCombine} nb={nbColonnes} label={labelCol} />
                  </Champ>
                  <Champ label="Le NOM correspond à…">
                    <select value={regleSep} onChange={(e) => setRegleSep(e.target.value as RegleSeparation)} className={champStyle}>
                      <option value="majuscules">…aux mots EN MAJUSCULES</option>
                      <option value="premier">…au premier mot</option>
                      <option value="dernier">…au dernier mot</option>
                    </select>
                  </Champ>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Champ label="Colonne e-mail (sinon : générée)">
                  <SelectCol value={colEmail} onChange={setColEmail} nb={nbColonnes} label={labelCol} optionnel />
                </Champ>
                <Champ label="Colonne rôle (sinon : rôle par défaut)">
                  <SelectCol value={colRole} onChange={setColRole} nb={nbColonnes} label={labelCol} optionnel />
                </Champ>
                <Champ label="Colonne disciplines (sinon : valeur par défaut)">
                  <SelectCol value={colDisciplines} onChange={setColDisciplines} nb={nbColonnes} label={labelCol} optionnel />
                </Champ>
                <Champ label="Colonne niveaux / cycle (sinon : valeur par défaut)">
                  <SelectCol value={colNiveaux} onChange={setColNiveaux} nb={nbColonnes} label={labelCol} optionnel />
                </Champ>
              </div>
            </section>

            {/* Champs de sortie configurables */}
            <section className="space-y-3 rounded-2xl border border-cream-200 bg-white p-4">
              <h3 className="text-base font-bold text-forest-900">Champs de sortie</h3>

              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {CLES_SORTIE.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 text-sm text-ink-700/80">
                    <input
                      type="checkbox"
                      checked={inclure[c]}
                      onChange={(e) => setInclure((prev) => ({ ...prev, [c]: e.target.checked }))}
                    />
                    {LIBELLE_SORTIE[c]}
                  </label>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {inclure.motDePasse && (
                  <>
                    <Champ label="Mot de passe">
                      <select value={modeMdp} onChange={(e) => setModeMdp(e.target.value as "aleatoire" | "fixe")} className={champStyle}>
                        <option value="aleatoire">Aléatoire par personne (recommandé)</option>
                        <option value="fixe">Identique pour tous</option>
                      </select>
                    </Champ>
                    <Champ label="Position de la colonne mot de passe">
                      <select value={posMdp} onChange={(e) => setPosMdp(e.target.value as "apres-email" | "fin")} className={champStyle}>
                        <option value="fin">En dernière colonne (import direct)</option>
                        <option value="apres-email">Après l&apos;e-mail</option>
                      </select>
                    </Champ>
                    {modeMdp === "fixe" && (
                      <Champ label={`Mot de passe commun (${LONGUEUR_MDP_GENERE} caractères max)`}>
                        <input
                          value={mdpFixe}
                          onChange={(e) => setMdpFixe(e.target.value)}
                          placeholder="ex : Ecole@26"
                          className={champStyle}
                        />
                      </Champ>
                    )}
                  </>
                )}
                {inclure.email && (
                  <Champ label="Domaine des e-mails générés">
                    <input value={domaineEmail} onChange={(e) => setDomaineEmail(e.target.value)} placeholder="eduweb.ci" className={champStyle} />
                  </Champ>
                )}
                {inclure.role && (
                  <Champ label="Rôle par défaut">
                    <select value={roleDefaut} onChange={(e) => setRoleDefaut(e.target.value)} className={champStyle}>
                      {ROLES_SORTIE.map((r) => (
                        <option key={r.valeur} value={r.valeur}>
                          {r.libelle}
                        </option>
                      ))}
                    </select>
                  </Champ>
                )}
                {inclure.disciplines && (
                  <Champ label="Disciplines par défaut (séparées par | )">
                    <input
                      value={disciplinesDefaut}
                      onChange={(e) => setDisciplinesDefaut(e.target.value)}
                      placeholder="ex : Mathématiques|Physique-Chimie"
                      className={champStyle}
                    />
                  </Champ>
                )}
                {inclure.niveaux && (
                  <Champ label="Niveaux par défaut">
                    <select value={niveauxDefaut} onChange={(e) => setNiveauxDefaut(e.target.value)} className={champStyle}>
                      <option value="">— (aucun) —</option>
                      <option value="1er cycle">1er cycle</option>
                      <option value="2nd cycle">2nd cycle (enseigne dans les deux cycles)</option>
                    </select>
                  </Champ>
                )}
              </div>

              {mdpBloquant && (
                <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <span>
                    {mdpFixe
                      ? "Ce mot de passe commun ne respecte pas les critères du formulaire de création de compte"
                      : "Saisissez le mot de passe commun — il doit respecter les critères du formulaire de création de compte"}
                    {" "}({criteres} — et {LONGUEUR_MDP_GENERE} caractères maximum ici). Le téléchargement est bloqué tant qu&apos;il n&apos;est pas conforme.
                  </span>
                </p>
              )}

              <div className="rounded-lg bg-cream-50/70 px-3 py-2 text-sm text-ink-700/70">
                <span className="font-medium text-forest-900">Disciplines multiples :</span>{" "}
                <code className="text-xs">discipline 1|discipline 2</code>.{" "}
                <span className="font-medium text-forest-900">Niveaux :</span>{" "}
                «&nbsp;1er cycle&nbsp;» ou «&nbsp;2nd cycle&nbsp;» (un enseignant du 2nd cycle peut
                enseigner dans les deux cycles).{" "}
                <span className="font-medium text-forest-900">Mots de passe :</span>{" "}
                conformes au formulaire de création de compte ({criteres}), {LONGUEUR_MDP_GENERE} caractères maximum.
              </div>

              {/* Colonnes personnalisées supplémentaires */}
              <div className="border-t border-cream-100 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-forest-900">Colonnes personnalisées</p>
                  <button
                    type="button"
                    onClick={() => setColonnesPerso((c) => [...c, { entete: "", valeur: "" }])}
                    className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-sm font-medium text-forest-700 hover:bg-forest-50"
                  >
                    <Plus size={13} /> Ajouter
                  </button>
                </div>
                {colonnesPerso.length === 0 && (
                  <p className="text-sm text-ink-700/50">Aucune. Ajoutez une colonne à valeur fixe (ex. «&nbsp;établissement&nbsp;»…).</p>
                )}
                <div className="space-y-2">
                  {colonnesPerso.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={c.entete}
                        onChange={(e) => setColonnesPerso((arr) => arr.map((x, j) => (j === i ? { ...x, entete: e.target.value } : x)))}
                        placeholder="En-tête (ex : établissement)"
                        aria-label={`En-tête de la colonne personnalisée ${i + 1}`}
                        className="h-9 flex-1 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400"
                      />
                      <input
                        value={c.valeur}
                        onChange={(e) => setColonnesPerso((arr) => arr.map((x, j) => (j === i ? { ...x, valeur: e.target.value } : x)))}
                        placeholder="Valeur"
                        aria-label={`Valeur de la colonne personnalisée ${i + 1}`}
                        className="h-9 flex-1 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400"
                      />
                      <button
                        type="button"
                        onClick={() => setColonnesPerso((arr) => arr.filter((_, j) => j !== i))}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-700/45 hover:bg-red-50 hover:text-red-600"
                        aria-label="Retirer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Avertissements sur le contenu (rôles inconnus, doublons, domaine invalide) */}
          {avertissements.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
              {avertissements.map((a, i) => (
                <p key={i} className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" /> <span>{a}</span>
                </p>
              ))}
            </div>
          )}

          {/* Compatibilité avec l'import direct de la console Enseignants */}
          {importDirect ? (
            <p className="flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50/60 px-3 py-2 text-sm text-forest-900">
              <CheckCircle2 size={16} className="shrink-0 text-forest-600" />
              Fichier directement importable dans la console «&nbsp;Enseignants&nbsp;» d&apos;un établissement
              (ordre prénoms&nbsp;; nom&nbsp;; email&nbsp;; rôle&nbsp;; disciplines&nbsp;; niveaux respecté
              {inclure.motDePasse ? " — la colonne mot de passe, en fin, y est appliquée aux comptes NOUVELLEMENT créés" : ""}).
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <span>
                Avec ces champs, le fichier ne suit plus l&apos;ordre attendu par l&apos;import
                «&nbsp;Enseignants&nbsp;» d&apos;un établissement (colonnes lues par position :
                prénoms&nbsp;; nom&nbsp;; email&nbsp;; rôle&nbsp;; disciplines&nbsp;; niveaux). Pour un import
                direct, activez ces six champs et placez le mot de passe «&nbsp;en dernière colonne&nbsp;».
              </span>
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={telecharger}
              disabled={!telechargeable}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-base font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
            >
              <Download size={16} /> Télécharger le CSV ({sortie?.rows.length ?? 0})
            </button>
            {inclure.motDePasse && modeMdp === "aleatoire" && (
              <button
                type="button"
                onClick={() => setNonceMdp((x) => x + 1)}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-200 bg-white px-5 text-base font-semibold text-forest-800 hover:bg-forest-50"
              >
                <RefreshCw size={15} /> Régénérer les mots de passe
              </button>
            )}
            <button
              type="button"
              onClick={demanderReinit}
              className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-5 text-base font-medium ${
                confirmerReinit
                  ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-cream-300 text-ink-700/70 hover:bg-cream-100"
              }`}
            >
              <X size={15} /> {confirmerReinit ? "Confirmer : tout effacer ?" : "Recommencer"}
            </button>
          </div>

          {/* Aperçu de la sortie */}
          {sortie && sortie.rows.length > 0 && sortie.entete.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-cream-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-cream-200 bg-cream-50 text-left text-ink-700/65">
                    {sortie.entete.map((h, i) => (
                      <th key={`${h}-${i}`} scope="col" className="whitespace-nowrap px-2.5 py-2 font-mono font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortie.rows.slice(0, 30).map((r, i) => (
                    <tr key={i} className="border-b border-cream-100 last:border-0">
                      {r.map((c, j) => (
                        <td key={j} className="whitespace-nowrap px-2.5 py-1.5 text-ink-700/80">{c || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortie.rows.length > 30 && (
                <p className="border-t border-cream-100 px-3 py-2 text-center text-sm text-ink-700/50">
                  … et {sortie.rows.length - 30} autre(s) ligne(s) dans le fichier téléchargé.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

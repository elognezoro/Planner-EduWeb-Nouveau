"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { UploadCloud, Download, FileSpreadsheet, FileText, X, Plus, Trash2, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import {
  nomEnMajuscules,
  prenomsEnTitre,
  separerNomPrenoms,
  nomUtilisateur,
  differencier,
  motDePasseParDefaut,
  motDePasseConformeMoodle,
  type RegleSeparation,
} from "@/lib/convertisseur/format-noms";
import { construireHtmlComptesPdf } from "@/lib/convertisseur/pdf-comptes";
import { anneeScolaireCourante } from "@/lib/annee-scolaire";

// ─────────────────────────────────────── Lecture des fichiers ───────────────────────────────────────
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function parseTexteCSV(texte: string): string[][] {
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lignes.length === 0) return [];
  const virg = (lignes[0].match(/,/g) ?? []).length;
  const pv = (lignes[0].match(/;/g) ?? []).length;
  const tab = (lignes[0].match(/\t/g) ?? []).length;
  const delim = tab >= virg && tab >= pv ? "\t" : pv > virg ? ";" : ",";
  return lignes.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));
}
function htmlEnLignes(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (table) {
    return [...table.querySelectorAll("tr")]
      .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => (c.textContent ?? "").trim()))
      .filter((r) => r.some((c) => c.length > 0));
  }
  return [...doc.querySelectorAll("p,li")]
    .map((p) => (p.textContent ?? "").trim())
    .filter(Boolean)
    .map((t) => [t]);
}
async function lireFichier(file: File): Promise<string[][]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return (XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" }) as unknown[][]).map((r) =>
      r.map((c) => String(c ?? "").trim()),
    );
  }
  if (ext === "docx") {
    const mod = await import("mammoth/mammoth.browser");
    const convertToHtml = mod.convertToHtml ?? mod.default.convertToHtml;
    const { value } = await convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return htmlEnLignes(value);
  }
  return parseTexteCSV(await file.text());
}

// ─────────────────────────────────────── Composant ───────────────────────────────────────
const ALIAS = {
  nom: ["nom", "noms", "lastname", "surname", "famille"],
  prenoms: ["prenom", "prenoms", "firstname", "givenname"],
  combine: ["nom et prenoms", "nom prenoms", "noms et prenoms", "identite", "eleve", "apprenant", "nom complet"],
  classe: ["classe", "class", "niveau", "groupe", "section"],
};
const trouver = (cols: string[], alias: string[]) => cols.findIndex((c) => alias.includes(norm(c)));

const champStyle =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-base outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export function Convertisseur() {
  const [fichierNom, setFichierNom] = useState<string | null>(null);
  const [colonnes, setColonnes] = useState<string[]>([]);
  const [lignes, setLignes] = useState<string[][]>([]);
  const [avecEntete, setAvecEntete] = useState(true);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pdfFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [confirmerReinit, setConfirmerReinit] = useState(false);

  // Correspondance des colonnes
  const [modeNom, setModeNom] = useState<"separe" | "combine">("separe");
  const [colNom, setColNom] = useState(-1);
  const [colPrenoms, setColPrenoms] = useState(-1);
  const [colCombine, setColCombine] = useState(0);
  const [regleSep, setRegleSep] = useState<RegleSeparation>("majuscules");
  const [colClasse, setColClasse] = useState(-1);

  // Personnalisation de la sortie Moodle
  const [ecole, setEcole] = useState("");
  // Année scolaire pré-remplie et auto-actualisée chaque année (basée sur la date).
  const [annee, setAnnee] = useState(() => anneeScolaireCourante());
  const [classeDefaut, setClasseDefaut] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [role, setRole] = useState("student");
  const [cours, setCours] = useState("");
  const [cohorte, setCohorte] = useState("");
  const [domaineEmail, setDomaineEmail] = useState("eduweb.ci");
  const [colonnesPerso, setColonnesPerso] = useState<{ entete: string; valeur: string }[]>([]);

  const nbColonnes = colonnes.length;
  const labelCol = useCallback(
    (i: number) => (i < 0 ? "— (aucune) —" : colonnes[i] || `Colonne ${String.fromCharCode(65 + i)}`),
    [colonnes],
  );

  const charger = useCallback(async (file: File) => {
    setErreur(null);
    setChargement(true);
    try {
      const table = (await lireFichier(file)).filter((r) => r.some((c) => c && c.trim().length > 0));
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
      setAvecEntete(entete);
      setColonnes(src);
      setLignes(entete ? rows.slice(1) : rows);
      setFichierNom(file.name);

      const iNom = trouver(src, ALIAS.nom);
      const iPre = trouver(src, ALIAS.prenoms);
      const iComb = trouver(src, ALIAS.combine);
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
      setColClasse(trouver(src, ALIAS.classe));
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

  const sortie = useMemo(() => {
    if (lignes.length === 0) return null;
    const enteteFixe = ["username", "password", "firstname", "lastname", "email", "course1", "role1", "cohort1"];
    const entete = [...enteteFixe, ...colonnesPerso.map((c) => c.entete.trim()).filter(Boolean)];
    const perso = colonnesPerso.map((c) => c.valeur);
    const domaine = domaineEmail.trim().replace(/^@/, "");
    const motPerso = motDePasse.trim(); // vide → mot de passe par défaut (username, 1re lettre en majuscule)
    const vus = new Map<string, number>();
    const rows: string[][] = [];
    let mdpNonConformes = 0; // mots de passe PAR DÉFAUT trop faibles pour la politique Moodle
    for (const l of lignes) {
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
      const lastname = nomEnMajuscules(nom);
      const firstname = prenomsEnTitre(prenoms);
      const classeRow = colClasse >= 0 ? cell(l, colClasse) : classeDefaut;
      const base = nomUtilisateur(prenoms, ecole, annee, classeRow, nom);
      const n = (vus.get(base) ?? 0) + 1;
      vus.set(base, n);
      const username = n > 1 ? differencier(base, n) : base;
      const email = domaine ? `${username}@${domaine}` : "";
      const password = motPerso || motDePasseParDefaut(username);
      if (!motPerso && !motDePasseConformeMoodle(password)) mdpNonConformes++;
      rows.push([username, password, firstname, lastname, email, cours, role, cohorte, ...perso]);
    }
    return { entete, rows, mdpNonConformes };
  }, [lignes, modeNom, colCombine, regleSep, colNom, colPrenoms, colClasse, ecole, annee, classeDefaut, domaineEmail, motDePasse, cours, role, cohorte, colonnesPerso]);

  function telecharger() {
    if (!sortie) return;
    // Délimiteur point-virgule : le fichier s'ouvre directement EN COLONNES dans Excel/LibreOffice
    // en locale française (séparateur de liste « ; »). Moodle accepte ce délimiteur à l'import.
    const DELIM = ";";
    const esc = (v: string) => (v.includes(DELIM) || /["\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [sortie.entete, ...sortie.rows].map((r) => r.map((c) => esc(c ?? "")).join(DELIM)).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-moodle.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Version PDF (via l'impression navigateur → « Enregistrer au format PDF ») ne contenant que
  // les colonnes username, password, firstname, lastname. On imprime le document dans une iframe
  // cachée, même origine : aucune fenêtre pop-up (donc jamais bloquée), et seul son contenu s'imprime.
  function genererPdf() {
    if (!sortie || sortie.rows.length === 0) return;
    // Retire une éventuelle iframe encore présente (double-clic) avant d'en créer une nouvelle.
    pdfFrameRef.current?.remove();

    const html = construireHtmlComptesPdf(sortie.rows, {
      ecole,
      classe: classeDefaut,
      annee,
      date: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
    });
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:0;height:0;border:0;";
    iframe.srcdoc = html;
    pdfFrameRef.current = iframe;

    let nettoye = false;
    const nettoyer = () => {
      if (nettoye) return;
      nettoye = true;
      window.removeEventListener("focus", nettoyer);
      window.clearTimeout(secours);
      if (pdfFrameRef.current === iframe) pdfFrameRef.current = null;
      iframe.remove();
    };
    // Filet de sécurité contre une fuite si onload/afterprint ne se déclenchent jamais (60 s).
    const secours = window.setTimeout(nettoyer, 60000);

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        nettoyer();
        return;
      }
      // Nettoyage piloté par le cycle d'impression, jamais par un délai fixe : Safari/Firefox ne
      // bloquent pas sur print(), retirer l'iframe trop tôt viderait l'aperçu (« PDF n'affiche pas »).
      win.onafterprint = nettoyer;
      window.addEventListener("focus", nettoyer, { once: true });
      win.focus();
      win.print();
    };

    document.body.appendChild(iframe);
  }

  // Vide la liste chargée et son mappage (garde la personnalisation). Appelé après confirmation.
  function reinit() {
    setFichierNom(null);
    setColonnes([]);
    setLignes([]);
    setErreur(null);
    if (inputRef.current) inputRef.current.value = "";
    setConfirmerReinit(false);
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
          aria-label="Déposer un fichier"
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

      {lignes.length > 0 && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Correspondance des colonnes */}
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

              <Champ label="Colonne classe (facultatif — sinon « Classe par défaut »)">
                <SelectCol value={colClasse} onChange={setColClasse} nb={nbColonnes} label={labelCol} optionnel />
              </Champ>
            </section>

            {/* Personnalisation de la sortie */}
            <section className="space-y-3 rounded-2xl border border-cream-200 bg-white p-4">
              <h3 className="text-base font-bold text-forest-900">Personnalisation de la sortie Moodle</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Champ label="Établissement (pour le nom d'utilisateur)">
                  <input value={ecole} onChange={(e) => setEcole(e.target.value)} placeholder="Notre Dame de la Paix de la Palmeraie" className={champStyle} />
                </Champ>
                <Champ label="Année scolaire">
                  <input value={annee} onChange={(e) => setAnnee(e.target.value)} placeholder={anneeScolaireCourante()} className={champStyle} />
                </Champ>
                <Champ label="Classe par défaut">
                  <input value={classeDefaut} onChange={(e) => setClasseDefaut(e.target.value)} placeholder="CM2A1" className={champStyle} />
                </Champ>
                <Champ label="Domaine e-mail">
                  <input value={domaineEmail} onChange={(e) => setDomaineEmail(e.target.value)} placeholder="eduweb.ci" className={champStyle} />
                </Champ>
                <Champ label="Mot de passe (password)">
                  <input value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} placeholder="par défaut : nom d'utilisateur, 1re lettre en majuscule, 10 car. max" className={champStyle} />
                </Champ>
                <Champ label="Rôle (role1)">
                  <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="student" className={champStyle} />
                </Champ>
                <Champ label="Cours (course1)">
                  <input value={cours} onChange={(e) => setCours(e.target.value)} placeholder="ex : 6EME-A" className={champStyle} />
                </Champ>
                <Champ label="Cohorte (cohort1)">
                  <input value={cohorte} onChange={(e) => setCohorte(e.target.value)} placeholder="ex : PROMO-2026" className={champStyle} />
                </Champ>
              </div>

              <div className="rounded-lg bg-cream-50/70 px-3 py-2 text-sm text-ink-700/70">
                <span className="font-medium text-forest-900">Nom d'utilisateur :</span> initiales du prénom
                {" · "}année{" · "}initiales de l'établissement{" - "}classe (ex.{" "}
                <code className="text-xs">amf.2627ndpp-cm2a1</code>). E-mail :{" "}
                <code className="text-xs">username@{domaineEmail.trim().replace(/^@/, "") || "eduweb.ci"}</code>.{" "}
                <span className="font-medium text-forest-900">Mot de passe</span> (si le champ est laissé
                vide) : le nom d'utilisateur avec la première lettre en majuscule, limité à 10 caractères
                (ex. <code className="text-xs">Amf.2627nd</code>).{" "}
                <span className="font-medium text-forest-900">CSV</span> : délimité par
                point-virgule&nbsp;(<code className="text-xs">;</code>) — il s'ouvre directement en colonnes
                dans Excel ; à l&apos;import Moodle, choisissez le délimiteur «&nbsp;;&nbsp;».
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
                  <p className="text-sm text-ink-700/50">Aucune. Ajoutez une colonne (ex. « group1 », « profile_field_xxx »…).</p>
                )}
                <div className="space-y-2">
                  {colonnesPerso.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={c.entete}
                        onChange={(e) => setColonnesPerso((arr) => arr.map((x, j) => (j === i ? { ...x, entete: e.target.value } : x)))}
                        placeholder="En-tête (ex : group1)"
                        className="h-9 flex-1 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400"
                      />
                      <input
                        value={c.valeur}
                        onChange={(e) => setColonnesPerso((arr) => arr.map((x, j) => (j === i ? { ...x, valeur: e.target.value } : x)))}
                        placeholder="Valeur"
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

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={telecharger}
              disabled={!sortie || sortie.rows.length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-base font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
            >
              <Download size={16} /> Télécharger le CSV Moodle ({sortie?.rows.length ?? 0})
            </button>
            <button
              type="button"
              onClick={genererPdf}
              disabled={!sortie || sortie.rows.length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-200 bg-white px-5 text-base font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
            >
              <FileText size={16} /> Version PDF (4 colonnes)
            </button>
            <button
              type="button"
              onClick={() => setConfirmerReinit(true)}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-cream-300 px-5 text-base font-medium text-ink-700/70 hover:bg-cream-100"
            >
              <X size={15} /> Recommencer
            </button>
          </div>

          {/* Avertissement : mots de passe par défaut non conformes à la politique Moodle */}
          {sortie && sortie.mdpNonConformes > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <p>
                <span className="font-semibold">{sortie.mdpNonConformes}</span> mot(s) de passe par défaut
                risque(nt) d&apos;être refusé(s) à l&apos;import Moodle (politique&nbsp;: 8&nbsp;caractères minimum,
                avec majuscule, minuscule, chiffre et caractère spécial). Renseignez l&apos;
                <strong>année scolaire</strong> et l&apos;<strong>établissement</strong> — pour enrichir le nom
                d&apos;utilisateur — ou saisissez un <strong>mot de passe</strong> dans la personnalisation.
              </p>
            </div>
          )}

          {/* Aperçu de la sortie */}
          {sortie && sortie.rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-cream-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-cream-200 bg-cream-50 text-left text-ink-700/65">
                    {sortie.entete.map((h) => (
                      <th key={h} className="whitespace-nowrap px-2.5 py-2 font-mono font-semibold">{h}</th>
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

      {/* Confirmation avant de vider la liste chargée */}
      <AnimatePresence>
        {confirmerReinit && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmerReinit(false)}
              className="fixed inset-0 z-50 bg-forest-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="titre-reinit-conv"
              className="fixed left-1/2 top-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft"
            >
              <div className="flex items-center justify-between border-b border-cream-100 px-5 py-3.5">
                <h2 id="titre-reinit-conv" className="font-display text-base font-bold text-forest-900">
                  Recommencer ?
                </h2>
                <button
                  type="button"
                  onClick={() => setConfirmerReinit(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5">
                <p className="text-sm leading-relaxed text-ink-700/80">
                  La <strong>liste chargée</strong> et son <strong>mappage de colonnes</strong> seront
                  effacés, et vous reviendrez à la zone de dépôt. Vos champs de{" "}
                  <strong>personnalisation</strong> (établissement, année, classe…) sont conservés.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmerReinit(false)}
                    className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={reinit}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    <RotateCcw size={16} /> Recommencer
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-700/70">{label}</span>
      {children}
    </label>
  );
}

function SelectCol({
  value,
  onChange,
  nb,
  label,
  optionnel,
}: {
  value: number;
  onChange: (v: number) => void;
  nb: number;
  label: (i: number) => string;
  optionnel?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={champStyle}>
      {optionnel && <option value={-1}>— (aucune) —</option>}
      {Array.from({ length: nb }, (_, i) => (
        <option key={i} value={i}>
          {label(i)}
        </option>
      ))}
    </select>
  );
}

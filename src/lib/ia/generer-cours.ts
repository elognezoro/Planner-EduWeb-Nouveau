import Anthropic from "@anthropic-ai/sdk";

/**
 * Structure un texte de cours (extrait d'un fichier déposé) en un cours LMS : titre,
 * description, leçons (Markdown) et un court quiz. Gated par ANTHROPIC_API_KEY : avec la clé,
 * Claude structure et génère le quiz ; sinon, repli déterministe (découpage par titres).
 * Module SERVEUR uniquement.
 */

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
const MAX_TEXTE = 60000;

export type NiveauCours = "debutant" | "intermediaire" | "avance";
export interface LeconGeneree { titre: string; contenu: string }
export interface QuestionGeneree {
  enonce: string;
  type: "choix_unique" | "choix_multiple" | "vrai_faux";
  explication?: string;
  choix: { texte: string; correct: boolean }[];
}
export interface CoursGenere {
  titre: string;
  description: string;
  niveau: NiveauCours;
  lecons: LeconGeneree[];
  quiz: QuestionGeneree[];
  source: "ia" | "repli";
}

const NIVEAUX: NiveauCours[] = ["debutant", "intermediaire", "avance"];
const nomSansExt = (f: string) => f.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();

function prompt(texte: string, nomFichier: string): string {
  return (
    "Tu es un ingénieur pédagogique. À partir du DOCUMENT ci-dessous (extrait du fichier « " + nomFichier + " »), " +
    "structure un cours e-learning en français.\n\n" +
    "Rends UNIQUEMENT un objet JSON valide (aucun texte autour, pas de balises de code) de la forme :\n" +
    '{"titre": string, "description": string (1-2 phrases), "niveau": "debutant"|"intermediaire"|"avance", ' +
    '"lecons": [{"titre": string, "contenu": string en Markdown avec ## / ### / **gras** / listes "-"}], ' +
    '"quiz": [{"enonce": string, "type": "choix_unique"|"choix_multiple"|"vrai_faux", "explication": string, "choix": [{"texte": string, "correct": boolean}]}]}\n\n' +
    "Règles : découpe le contenu en 3 à 8 leçons cohérentes ; développe/clarifie le contenu sans inventer de faits absents du document ; " +
    "produis 4 à 6 questions de quiz couvrant les points clés (au moins une choix_multiple) ; " +
    "n'invente aucune donnée chiffrée qui ne serait pas dans le document.\n\n" +
    "=== DOCUMENT ===\n" + texte
  );
}

function extraireJson(txt: string): unknown | null {
  const sansFences = txt.replace(/```json/gi, "").replace(/```/g, "").trim();
  const debut = sansFences.indexOf("{");
  const fin = sansFences.lastIndexOf("}");
  if (debut === -1 || fin === -1 || fin <= debut) return null;
  try { return JSON.parse(sansFences.slice(debut, fin + 1)); } catch { return null; }
}

function normaliser(o: Record<string, unknown>, nomFichier: string): Omit<CoursGenere, "source"> {
  const titre = (typeof o.titre === "string" && o.titre.trim()) || nomSansExt(nomFichier) || "Cours importé";
  const description = typeof o.description === "string" ? o.description.trim() : "";
  const niveau = NIVEAUX.includes(o.niveau as NiveauCours) ? (o.niveau as NiveauCours) : "intermediaire";
  const lecons = Array.isArray(o.lecons)
    ? o.lecons
        .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
        .map((l) => ({ titre: String(l.titre ?? "Leçon").slice(0, 200), contenu: String(l.contenu ?? "").trim() }))
        .filter((l) => l.contenu)
    : [];
  const quiz = Array.isArray(o.quiz)
    ? o.quiz
        .filter((q): q is Record<string, unknown> => !!q && typeof q === "object")
        .map((q) => ({
          enonce: String(q.enonce ?? "").trim(),
          type: (["choix_unique", "choix_multiple", "vrai_faux"].includes(q.type as string) ? q.type : "choix_unique") as QuestionGeneree["type"],
          explication: typeof q.explication === "string" ? q.explication : undefined,
          choix: Array.isArray(q.choix)
            ? q.choix.filter((c): c is Record<string, unknown> => !!c && typeof c === "object").map((c) => ({ texte: String(c.texte ?? "").trim(), correct: !!c.correct }))
            : [],
        }))
        .filter((q) => q.enonce && q.choix.length >= 2)
    : [];
  return { titre: titre.slice(0, 200), description: description.slice(0, 500), niveau, lecons, quiz };
}

/** Repli déterministe : découpe par titres Markdown, sinon par gros paragraphes. */
function repli(texte: string, nomFichier: string): CoursGenere {
  const lignes = texte.split(/\r?\n/);
  const lecons: LeconGeneree[] = [];
  let couranteTitre = "";
  let courant: string[] = [];
  const pousser = () => {
    const contenu = courant.join("\n").trim();
    if (contenu) lecons.push({ titre: couranteTitre || `Partie ${lecons.length + 1}`, contenu });
    courant = [];
  };
  for (const l of lignes) {
    const m = /^#{1,3}\s+(.*)$/.exec(l.trim());
    if (m) { pousser(); couranteTitre = m[1].trim(); }
    else courant.push(l);
  }
  pousser();

  // Aucun titre détecté : découpe le texte en blocs d'environ 2500 caractères.
  if (lecons.length <= 1 && texte.length > 3000) {
    lecons.length = 0;
    const paras = texte.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    let bloc: string[] = [];
    let taille = 0;
    for (const p of paras) {
      bloc.push(p); taille += p.length;
      if (taille > 2500) { lecons.push({ titre: `Partie ${lecons.length + 1}`, contenu: bloc.join("\n\n") }); bloc = []; taille = 0; }
    }
    if (bloc.length) lecons.push({ titre: `Partie ${lecons.length + 1}`, contenu: bloc.join("\n\n") });
  }
  if (lecons.length === 0) lecons.push({ titre: "Contenu du cours", contenu: texte.trim() || "(Document vide)" });

  const premiereLigne = texte.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  return {
    titre: nomSansExt(nomFichier) || "Cours importé",
    description: premiereLigne.replace(/^#+\s*/, "").slice(0, 300),
    niveau: "intermediaire",
    lecons,
    quiz: [],
    source: "repli",
  };
}

export async function structurerCoursDepuisTexte(texte: string, nomFichier: string): Promise<CoursGenere> {
  const brut = texte.trim().slice(0, MAX_TEXTE);
  if (!process.env.ANTHROPIC_API_KEY || brut.length < 40) return repli(brut, nomFichier);
  try {
    const client = new Anthropic();
    const reponse = await client.messages.create({
      model: MODELE,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt(brut, nomFichier) }],
    });
    const txt = reponse.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const parsed = extraireJson(txt);
    if (parsed && typeof parsed === "object") {
      const norm = normaliser(parsed as Record<string, unknown>, nomFichier);
      if (norm.lecons.length > 0) return { ...norm, source: "ia" };
    }
  } catch (e) {
    console.error("[ia] génération cours :", e);
  }
  return repli(brut, nomFichier);
}

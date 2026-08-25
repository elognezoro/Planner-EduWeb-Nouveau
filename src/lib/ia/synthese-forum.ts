import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Synthèse pédagogique par IA des contributions d'un forum de séminaire.
 * Gated par ANTHROPIC_API_KEY : sans clé (ou en cas d'erreur), renvoie un repli étiqueté.
 * Le contenu ne provient QUE des contributions fournies — aucune donnée sensible n'est exposée.
 */
const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export type MessageForum = { texte: string };

const SYSTEME =
  "Tu es l'assistant pédagogique d'un séminaire des écoles catholiques sur l'encyclique « Magnifica Humanitas » " +
  "(intelligence artificielle et dignité humaine). À partir des contributions d'un forum, produis une SYNTHÈSE " +
  "pédagogique en français, brève et structurée, destinée à aider le formateur : dégage les grandes idées, les " +
  "convergences et les divergences, puis un ou deux points de discernement en lien avec la dignité humaine, le bien " +
  "commun et un usage responsable de l'IA. Reste strictement fidèle aux contributions, sans rien inventer ni ajouter " +
  "d'information externe. 120 à 180 mots. Termine par la mention « (Aide pédagogique — à valider par le formateur.) »";

function repli(n: number): string {
  return (
    `${n} contribution(s) publiée(s). La synthèse automatique par IA n'est pas disponible pour le moment ` +
    `(clé d'IA absente ou service indisponible) ; le formateur peut dégager les grandes idées et les points de ` +
    `discernement (dignité humaine, bien commun, usage responsable de l'IA).`
  );
}

/** Repli (sans clé IA) pour la synthèse d'un fil de forum de COURS. */
function repliCours(n: number): string {
  return (
    `${n} message(s) publié(s). La synthèse automatique n'est pas disponible pour le moment (assistance ` +
    `EduWeb Planner absente ou indisponible) ; le formateur peut dégager les grandes idées, les convergences ` +
    `et les pistes de relance.`
  );
}

/**
 * Synthèse pédagogique par EduWeb Planner des échanges d'un fil de forum de COURS (générique,
 * indépendante du thème). Fidèle aux seuls messages fournis — rien d'inventé.
 */
export async function synthetiserForumCours(args: {
  coursTitre: string;
  sujetTitre: string;
  sujetDescription?: string | null;
  messages: MessageForum[];
}): Promise<{ synthese: string; source: "ia" | "repli" }> {
  const { coursTitre, sujetTitre, sujetDescription, messages } = args;
  if (!process.env.ANTHROPIC_API_KEY) return { synthese: repliCours(messages.length), source: "repli" };
  const systeme =
    "Tu rédiges au nom d'EduWeb Planner (plateforme de formation). À partir des messages d'un fil de forum d'une " +
    "formation, produis une SYNTHÈSE pédagogique en français, brève et structurée, destinée au formateur : dégage " +
    "les grandes idées, les convergences et les divergences, les questions en suspens, puis 1 à 2 pistes de relance " +
    "ou points d'attention. Reste STRICTEMENT fidèle aux contributions, sans rien inventer ni ajouter d'information " +
    "externe. 120 à 200 mots. Termine par « (Synthèse EduWeb Planner — à valider par le formateur.) »";
  const contributions = messages.map((m, i) => `${i + 1}. ${m.texte}`).join("\n");
  const prompt =
    `Formation : « ${coursTitre} »\nFil de discussion : « ${sujetTitre} »` +
    (sujetDescription ? `\nContexte du fil : ${sujetDescription}` : "") +
    `\n\nMessages publiés (${messages.length}) :\n${contributions}\n\nRédige la synthèse.`;
  try {
    const client = new Anthropic({ timeout: 12_000, maxRetries: 0 });
    const rep = await client.messages.create({
      model: MODELE,
      max_tokens: 700,
      system: systeme,
      messages: [{ role: "user", content: prompt }],
    });
    const texte = rep.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return { synthese: texte || repliCours(messages.length), source: "ia" };
  } catch (e) {
    console.error("[synthese-forum-cours] échec :", e);
    return { synthese: repliCours(messages.length), source: "repli" };
  }
}

export async function synthetiserForum(
  question: string,
  messages: MessageForum[],
): Promise<{ synthese: string; source: "ia" | "repli" }> {
  if (!process.env.ANTHROPIC_API_KEY) return { synthese: repli(messages.length), source: "repli" };

  const contributions = messages.map((m, i) => `${i + 1}. ${m.texte}`).join("\n");
  const prompt =
    `Question posée aux participants :\n« ${question || "(non précisée)"} »\n\n` +
    `Contributions publiées (${messages.length}) :\n${contributions}\n\nRédige la synthèse.`;

  try {
    const client = new Anthropic();
    const rep = await client.messages.create({
      model: MODELE,
      max_tokens: 600,
      system: SYSTEME,
      messages: [{ role: "user", content: prompt }],
    });
    const texte = rep.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return { synthese: texte || repli(messages.length), source: "ia" };
  } catch (e) {
    console.error("[synthese-forum] échec :", e);
    return { synthese: repli(messages.length), source: "repli" };
  }
}

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

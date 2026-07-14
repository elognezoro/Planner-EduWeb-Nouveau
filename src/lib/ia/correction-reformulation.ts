import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Correction pédagogique par IA de la reformulation d'un message brut par un participant
 * (atelier « Reformuler un message brut » du séminaire IA & communication).
 * Gated par ANTHROPIC_API_KEY : sans clé (ou en cas d'erreur), renvoie un repli étiqueté.
 * Le contenu ne provient QUE du message brut et de la production fournie — rien n'est inventé.
 */
const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

const SYSTEME =
  "Tu es l'assistant pédagogique d'un séminaire des écoles catholiques sur l'usage responsable de l'IA " +
  "dans la communication éducative et pastorale. Un participant a reformulé un message brut. Rends une " +
  "CORRECTION pédagogique BRÈVE en français, bienveillante et exigeante, destinée au formateur, en 3 points : " +
  "1) Points forts de la reformulation ; 2) Points à améliorer (clarté, ton institutionnel, respect, exactitude) ; " +
  "3) Une suggestion concrète de réécriture (1 à 2 phrases). Reste strictement fidèle au texte du participant, " +
  "sans inventer d'information. 90 à 140 mots. Termine par « (Correction IA — à valider par le formateur.) »";

function repli(): string {
  return (
    "La correction automatique par IA n'est pas disponible pour le moment (clé d'IA absente ou service " +
    "indisponible). Le formateur peut apprécier la reformulation selon trois critères : clarté du message, " +
    "ton institutionnel et respectueux, exactitude des informations. (Correction IA indisponible.)"
  );
}

export async function corrigerReformulation(
  messageBrut: string,
  texteEleve: string,
): Promise<{ correction: string; source: "ia" | "repli" }> {
  if (!process.env.ANTHROPIC_API_KEY) return { correction: repli(), source: "repli" };

  const prompt =
    `Message brut d'origine :\n« ${messageBrut || "(non précisé)"} »\n\n` +
    `Reformulation proposée par le participant :\n« ${texteEleve} »\n\nRédige la correction.`;

  try {
    const client = new Anthropic();
    const rep = await client.messages.create({
      model: MODELE,
      max_tokens: 500,
      system: SYSTEME,
      messages: [{ role: "user", content: prompt }],
    });
    const texte = rep.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return { correction: texte || repli(), source: "ia" };
  } catch (e) {
    console.error("[correction-reformulation] échec :", e);
    return { correction: repli(), source: "repli" };
  }
}

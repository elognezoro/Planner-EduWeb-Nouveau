import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Observation (appréciation) IA d'un devoir déposé — brouillon proposé au tuteur, TOUJOURS éditable.
 * Gated par ANTHROPIC_API_KEY (même modèle que le registre) : si la clé est présente, Claude rédige
 * l'appréciation à partir de la consigne et de la production ; sinon un repli local propose un canevas.
 */

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export interface EntreeObservation {
  consigne: string;
  texteApprenant: string;
  note?: number | null;
  noteSur: number;
}

function repliLocal(e: EntreeObservation): string {
  const mention = e.note != null
    ? `Note : ${e.note}/${e.noteSur}. `
    : "";
  return (
    `${mention}Travail rendu et pris en compte. ` +
    `Points positifs à consolider et axes d'amélioration à préciser lors de la prochaine production ` +
    `(structure, exactitude, application des notions du module). Poursuivez vos efforts.`
  );
}

export async function suggererObservationDevoir(e: EntreeObservation): Promise<{ texte: string; source: "ia" | "repli" }> {
  const repli = { texte: repliLocal(e), source: "repli" as const };
  if (!process.env.ANTHROPIC_API_KEY || !e.texteApprenant.trim()) return repli;

  try {
    const client = new Anthropic();
    const reponse = await client.messages.create({
      model: MODELE,
      max_tokens: 400,
      system:
        "Tu es tuteur-formateur dans un établissement catholique du système éducatif ivoirien (SEDEC). " +
        "Tu rédiges une APPRÉCIATION de correction en français : 2 à 4 phrases, bienveillantes et constructives, " +
        "qui soulignent les points forts, un ou deux axes d'amélioration concrets, et un encouragement final. " +
        "Réponds UNIQUEMENT avec le texte de l'appréciation, sans guillemets, sans préambule, sans emoji.",
      messages: [
        {
          role: "user",
          content:
            `Consigne du devoir :\n${e.consigne || "(non précisée)"}\n\n` +
            `Production déposée par l'apprenant :\n${e.texteApprenant}\n\n` +
            `${e.note != null ? `Note attribuée par le tuteur : ${e.note}/${e.noteSur}.\n` : ""}` +
            "Rédige l'appréciation de correction.",
        },
      ],
    });
    const texte = reponse.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
    return texte ? { texte, source: "ia" } : repli;
  } catch (err) {
    console.error("[ia/observation-devoir] repli (échec API) :", err);
    return repli;
  }
}

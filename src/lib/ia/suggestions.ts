import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Suggestions IA du registre d'appel — description pré-remplie des événements
 * (encouragement, observation, infirmerie) et des SMS aux parents.
 *
 * Gated par ANTHROPIC_API_KEY (même modèle que Resend / SMS) : si la clé est présente,
 * la suggestion est générée par Claude à partir du profil réel de l'élève ; sinon, un
 * repli local compose une suggestion à partir des mêmes données de profil.
 */

export type TypeSuggestion = "encouragement" | "observation" | "infirmerie" | "sms";

export interface ProfilEleve {
  nomComplet: string;
  sexe: string | null; // « F » / « M » / null
  classe: string;
  absencesNonJustifiees: number;
  retardsNonJustifies: number;
  encouragements: number;
  observations: number;
  conduite: number;
}

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

const CONSIGNES: Record<TypeSuggestion, string> = {
  encouragement:
    "Rédige un court motif d'ENCOURAGEMENT (félicitations) pour cet élève, ex : participation active, entraide, progrès.",
  observation:
    "Rédige une courte OBSERVATION disciplinaire factuelle et mesurée pour cet élève, ex : bavardages, manque de concentration, travail insuffisant.",
  infirmerie:
    "Rédige une courte note d'admission à l'INFIRMERIE pour cet élève (malaise ou blessure en cours, envoi à l'infirmerie pour prise en charge).",
  sms:
    "Rédige un court SMS factuel et courtois destiné au parent de cet élève au sujet de son assiduité (absences/retards non justifiés), l'invitant à les justifier auprès de l'établissement. Commence par « EduWeb Planner — ».",
};

function accord(profil: ProfilEleve, feminin: string, masculin: string): string {
  return profil.sexe === "F" ? feminin : masculin;
}

/** Repli local : suggestion composée depuis le profil (sans appel réseau). */
function suggestionProfil(type: TypeSuggestion, p: ProfilEleve): string {
  const ee = accord(p, "e", ""); // accord simple : envoyé(e), assidu(e)…
  switch (type) {
    case "encouragement":
      if (p.absencesNonJustifiees === 0 && p.retardsNonJustifies === 0) {
        return `Assiduité exemplaire et participation active en classe. Élève sérieux${ee} à encourager.`;
      }
      if (p.encouragements > 0) {
        return `Confirme ses efforts : comportement exemplaire et entraide envers ses camarades.`;
      }
      return `Nets progrès et participation active en classe. Efforts à souligner.`;
    case "observation":
      if (p.absencesNonJustifiees >= 3) {
        return `${p.absencesNonJustifiees} absences non justifiées à ce jour : un suivi rapproché est nécessaire.`;
      }
      if (p.observations > 0) {
        return `Bavardages répétés perturbant la séance, malgré des rappels à l'ordre précédents.`;
      }
      return `Manque de concentration et travail insuffisant pendant la séance.`;
    case "infirmerie":
      return `Malaise en cours. Envoyé${ee} à l'infirmerie pour prise en charge.`;
    case "sms":
      return (
        `EduWeb Planner — ${p.classe} : ${p.nomComplet} totalise ${p.absencesNonJustifiees} absence(s) ` +
        `non justifiée(s). Merci de les justifier auprès de l'établissement.`
      );
  }
}

/**
 * Suggestion de description pour un événement / SMS. Renvoie aussi la source réelle
 * (« ia » ou « profil ») pour l'afficher honnêtement dans l'interface.
 */
export async function suggererDescription(
  type: TypeSuggestion,
  profil: ProfilEleve,
): Promise<{ texte: string; source: "ia" | "profil" }> {
  const repli = { texte: suggestionProfil(type, profil), source: "profil" as const };
  if (!process.env.ANTHROPIC_API_KEY) return repli;

  try {
    const client = new Anthropic();
    const reponse = await client.messages.create({
      model: MODELE,
      max_tokens: 200,
      system:
        "Tu rédiges des annotations scolaires en français pour le registre d'appel d'un établissement " +
        "du système éducatif ivoirien. Réponds UNIQUEMENT avec le texte demandé : 1 à 2 phrases sobres " +
        "et professionnelles, sans guillemets, sans préambule, sans emoji. Accorde le genre selon le sexe indiqué.",
      messages: [
        {
          role: "user",
          content:
            `${CONSIGNES[type]}\n\nProfil de l'élève :\n` +
            `- Nom : ${profil.nomComplet} (sexe : ${profil.sexe ?? "inconnu"})\n` +
            `- Classe : ${profil.classe}\n` +
            `- Absences non justifiées (cumul) : ${profil.absencesNonJustifiees}\n` +
            `- Retards non justifiés (cumul) : ${profil.retardsNonJustifies}\n` +
            `- Encouragements reçus : ${profil.encouragements} · Observations reçues : ${profil.observations}\n` +
            `- Note de conduite actuelle : ${profil.conduite}/20`,
        },
      ],
    });
    const texte = reponse.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return texte ? { texte, source: "ia" } : repli;
  } catch (e) {
    console.error("[ia/suggestions] repli profil (échec API) :", e);
    return repli;
  }
}

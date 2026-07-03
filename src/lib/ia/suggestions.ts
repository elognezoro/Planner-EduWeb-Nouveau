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
    "Rédige un motif d'ENCOURAGEMENT (félicitations) détaillé pour cet élève : appuie-toi sur son assiduité et " +
    "ses antécédents (participation, entraide, progrès, régularité) pour personnaliser le texte.",
  observation:
    "Rédige une OBSERVATION disciplinaire factuelle, mesurée et détaillée pour cet élève : décris le comportement " +
    "(bavardages, manque de concentration, travail insuffisant…), mets-le en perspective avec ses antécédents " +
    "(absences, observations précédentes) et termine par l'attente ou la mesure de suivi.",
  infirmerie:
    "Rédige une note d'admission à l'INFIRMERIE détaillée pour cet élève : symptômes constatés (malaise, blessure…), " +
    "envoi à l'infirmerie pour prise en charge, et information des parents si nécessaire.",
  sms:
    "Rédige un SMS factuel, courtois et complet destiné au parent de cet élève : rappelle le cumul exact d'absences/retards " +
    "non justifiés, invite à les justifier auprès de l'établissement et mentionne que l'équipe reste disponible. " +
    "Commence par « EduWeb Planner — ». Maximum 300 caractères.",
};

function accord(profil: ProfilEleve, feminin: string, masculin: string): string {
  return profil.sexe === "F" ? feminin : masculin;
}

/** Repli local : suggestion détaillée composée depuis le profil (sans appel réseau). */
function suggestionProfil(type: TypeSuggestion, p: ProfilEleve): string {
  const ee = accord(p, "e", ""); // accord simple : envoyé(e), assidu(e)…
  const il = accord(p, "Elle", "Il");
  switch (type) {
    case "encouragement":
      if (p.absencesNonJustifiees === 0 && p.retardsNonJustifies === 0) {
        return (
          `Participation active et régulière en classe, avec une assiduité exemplaire (aucune absence non justifiée à ce jour). ` +
          `${il} fait preuve de sérieux et d'entraide envers ses camarades : des efforts constants à encourager.`
        );
      }
      if (p.encouragements > 0) {
        return (
          `Confirme les efforts déjà soulignés : comportement exemplaire, participation soutenue et entraide envers ses camarades. ` +
          `Une dynamique très positive qui mérite d'être valorisée et poursuivie.`
        );
      }
      return (
        `Nets progrès observés en classe : participation plus active, travail plus régulier et meilleure implication. ` +
        `Ces efforts méritent d'être soulignés pour encourager l'élève à maintenir cette trajectoire.`
      );
    case "observation":
      if (p.absencesNonJustifiees >= 3) {
        return (
          `Manque de concentration et travail insuffisant pendant la séance. ` +
          `${il} totalise par ailleurs ${p.absencesNonJustifiees} absences non justifiées et une note de conduite de ${p.conduite}/20 : ` +
          `un suivi rapproché avec la famille est nécessaire.`
        );
      }
      if (p.observations > 0) {
        return (
          `Bavardages répétés perturbant le bon déroulement de la séance, malgré des rappels à l'ordre précédents ` +
          `(${p.observations} observation(s) déjà consignée(s)). Un changement d'attitude est attendu sans délai.`
        );
      }
      return (
        `Manque de concentration et travail insuffisant pendant la séance. ` +
        `L'élève est invité${ee} à se remobiliser rapidement ; la situation sera réévaluée aux prochaines séances.`
      );
    case "infirmerie":
      return (
        `Malaise survenu en cours. Envoyé${ee} à l'infirmerie pour prise en charge et mise en observation. ` +
        `Les parents seront informés si l'état de santé le nécessite.`
      );
    case "sms":
      return (
        `EduWeb Planner — ${p.classe} : ${p.nomComplet} totalise ${p.absencesNonJustifiees} absence(s) et ` +
        `${p.retardsNonJustifies} retard(s) non justifié(s). Merci de les justifier auprès de l'établissement. ` +
        `L'équipe pédagogique reste à votre disposition.`
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
      max_tokens: 300,
      system:
        "Tu rédiges des annotations scolaires en français pour le registre d'appel d'un établissement " +
        "du système éducatif ivoirien. Réponds UNIQUEMENT avec le texte demandé : 2 à 3 phrases détaillées, " +
        "sobres et professionnelles, personnalisées à partir du profil fourni, sans guillemets, sans préambule, " +
        "sans emoji. Accorde le genre selon le sexe indiqué.",
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

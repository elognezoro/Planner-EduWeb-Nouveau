"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { peutGererEtablissement } from "@/lib/vie-scolaire/contexte";
import { journaliserFinance } from "@/lib/finances/commun/audit";
import { creancesAGenerer, fraisPourGeneration } from "@/lib/finances/scolarite/generation";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const schema = z.object({
  etablissementId: z.string().min(1),
  classeId: z.string().min(1, "Classe requise."),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
});

export async function inscrireEleve(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const { etablissementId, classeId, email } = parsed.data;
  if (!(await peutGererEtablissement(u, etablissementId))) {
    return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  }

  try {
    const classe = await prisma.classe.findUnique({
      where: { id: classeId },
      include: { niveau: { select: { nom: true, cycle: true } } },
    });
    if (!classe || classe.etablissementId !== etablissementId) {
      return { ok: false, message: "Classe hors de cet établissement." };
    }
    const eleve = await prisma.utilisateur.findUnique({ where: { email } });
    if (!eleve) {
      return {
        ok: false,
        message: "Aucun compte avec cet e-mail. L'élève doit d'abord créer un compte.",
      };
    }

    const annee = await prisma.anneeScolaire.findFirst({ where: { active: true } });
    const anneeScolaireId = annee?.id ?? null;

    // Un élève = une classe par année : on déplace si une inscription existe déjà.
    const existante = await prisma.inscription.findFirst({
      where: { eleveId: eleve.id, anneeScolaireId },
    });

    // 06-Scolarite : GÉNÉRATION AUTOMATIQUE des créances à l'inscription — idempotente
    // (jamais deux créances pour le même frais × exercice), calculée ici (lectures) puis
    // créée DANS la transaction de l'inscription avec son entrée d'audit. En cas de
    // changement de classe, les créances de l'ancienne classe restent : leur suspension
    // passe par l'action « Recalculer » du compte financier (choix documenté).
    const etab = await prisma.etablissement.findUnique({
      where: { id: etablissementId },
      select: { anneeScolaire: true },
    });
    const exercice = etab?.anneeScolaire ?? String(new Date().getFullYear());
    const [frais, creancesExistantes, payes] = await Promise.all([
      fraisPourGeneration(etablissementId),
      prisma.creanceEleve.findMany({
        where: { etablissementId, eleveId: eleve.id, exercice, annuleLe: null },
        select: { fraisId: true },
      }),
      prisma.paiementScolarite.groupBy({
        by: ["fraisId"],
        where: { etablissementId, eleveId: eleve.id, annule: false },
        _sum: { montant: true },
      }),
    ]);
    const lignes = creancesAGenerer({
      etablissementId,
      exercice,
      eleves: [{
        eleveId: eleve.id,
        niveauId: classe.niveauId,
        niveauNom: classe.niveau?.nom ?? null,
        cycle: classe.niveau?.cycle ?? null,
        classeNom: classe.nom,
      }],
      frais,
      clesExistantes: new Set(creancesExistantes.map((c) => `${eleve.id}:${c.fraisId}`)),
      payeParCle: new Map(
        payes.filter((p) => p.fraisId).map((p) => [`${eleve.id}:${p.fraisId}`, p._sum.montant ?? 0]),
      ),
    });

    await prisma.$transaction(async (tx) => {
      if (existante) {
        await tx.inscription.update({ where: { id: existante.id }, data: { classeId } });
      } else {
        await tx.inscription.create({ data: { eleveId: eleve.id, classeId, anneeScolaireId } });
      }
      if (lignes.length > 0) {
        await tx.creanceEleve.createMany({ data: lignes });
        await journaliserFinance(tx, {
          etablissementId, exerciceId: exercice, utilisateurId: u.id, action: "creance.generation",
          entite: "CreanceEleve", entiteId: eleve.id,
          nouvelleValeur: { source: "inscription", classe: classe.nom, nombreCreances: lignes.length },
        });
      }
    });
    revalidatePath("/app/vie-scolaire/inscriptions");
  } catch (e) {
    console.error("[inscription] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: "Élève inscrit." };
}

export async function desinscrire(formData: FormData) {
  const u = await getUtilisateurCourant();
  if (!u) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const insc = await prisma.inscription.findUnique({
    where: { id },
    include: { classe: true },
  });
  if (!insc) return;
  if (!(await peutGererEtablissement(u, insc.classe.etablissementId))) return;

  await prisma.inscription.delete({ where: { id } });
  revalidatePath("/app/vie-scolaire/inscriptions");
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import { creerNotification, creerNotifications } from "@/lib/notifications/creer";
import { envoyerEmail } from "@/lib/email/send";
import { gabaritDemandeAbsence, gabaritDecisionAbsence } from "@/lib/email/templates";
import {
  classesAffectees, cyclesDesClasses, joursCouverts, suppleantsPossibles,
  type ClasseAffectee, type Suppleant,
} from "@/lib/absences/edt";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

const jourUTC = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const estIsoJour = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(jourUTC(s).getTime());

function periodeLibelle(debut: Date, fin: Date): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const mêmeJour = debut.getTime() === fin.getTime();
  return mêmeJour ? `le ${fmt.format(debut)}` : `du ${fmt.format(debut)} au ${fmt.format(fin)}`;
}

const ROLES_DIRECTION = ["chef_etablissement", "adjoint_chef_etablissement"] as const;

/** Le demandeur peut-il déposer une demande (personnel rattaché à un établissement) ? */
async function demandeurCourant() {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return null;
  if (!u.portee.etablissementId) return null;
  return u;
}

// ─────────────── Analyse dynamique (aperçu au changement de dates) ───────────────

export interface AnalyseAbsence {
  ok: boolean;
  message?: string;
  estEnseignant: boolean;
  jours: number[];
  classes: ClasseAffectee[];
  nbSeances: number;
  suppleants: Suppleant[];
}

/**
 * Calcule, pour le DEMANDEUR courant et une plage de dates, les classes pédagogiques affectées
 * (croisement avec son EDT) et les suppléants possibles. Lecture seule — appelé par le formulaire.
 */
export async function analyserAbsence(dateDebut: string, dateFin: string): Promise<AnalyseAbsence> {
  const vide: AnalyseAbsence = { ok: false, estEnseignant: false, jours: [], classes: [], nbSeances: 0, suppleants: [] };
  const u = await getUtilisateurCourant();
  if (!u || !u.portee.etablissementId) return { ...vide, message: "Compte non rattaché à un établissement." };
  if (!estIsoJour(dateDebut) || !estIsoJour(dateFin)) return { ...vide, message: "Dates invalides." };
  const debut = jourUTC(dateDebut);
  const fin = jourUTC(dateFin);
  if (fin < debut) return { ...vide, message: "La date de fin précède la date de début." };

  const estEnseignant = u.roleReel === "enseignant";
  if (!estEnseignant) return { ...vide, ok: true, estEnseignant: false };

  const jours = joursCouverts(debut, fin);
  const classes = await classesAffectees(u.id, u.portee.etablissementId, jours);
  const nbSeances = classes.reduce((s, c) => s + c.nbSeances, 0);
  const disciplineIds = [...new Set(classes.map((c) => c.disciplineId))];
  const cycles = await cyclesDesClasses([...new Set(classes.map((c) => c.classeId))]);
  const suppleants = await suppleantsPossibles(u.portee.etablissementId, u.id, disciplineIds, cycles);
  return { ok: true, estEnseignant: true, jours, classes, nbSeances, suppleants };
}

// ─────────────────────────── Soumission de la demande ───────────────────────────

const schemaDemande = z.object({
  dateDebut: z.string().refine(estIsoJour, "Date de début invalide."),
  dateFin: z.string().refine(estIsoJour, "Date de fin invalide."),
  motif: z.string().trim().max(400).optional(),
  suppleantIds: z.string().optional(),
  datesRattrapage: z.string().optional(),
});

function parseListe(json: string | undefined, max: number): string[] {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? v.map(String).slice(0, max) : [];
  } catch {
    return [];
  }
}

export async function soumettreDemande(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const parsed = schemaDemande.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Données invalides." };

  const u = await demandeurCourant();
  if (!u) return { ok: false, message: "Action non autorisée (compte non rattaché ou mode aperçu)." };
  const essai = refusEssaiPour(u);
  if (essai) return { ok: false, message: essai };

  const etablissementId = u.portee.etablissementId!;
  const debut = jourUTC(parsed.data.dateDebut);
  const fin = jourUTC(parsed.data.dateFin);
  if (fin < debut) return { ok: false, message: "La date de fin précède la date de début." };
  const jours = joursCouverts(debut, fin);
  const ecartJours = Math.round((fin.getTime() - debut.getTime()) / 86_400_000);
  if (ecartJours > 90) return { ok: false, message: "La période demandée est trop longue (90 jours maximum)." };

  const estEnseignant = u.roleReel === "enseignant";

  // Recalcul SERVEUR (jamais de confiance au client) des classes affectées et des suppléants valides.
  let classes: ClasseAffectee[] = [];
  let suppleantsValides: Suppleant[] = [];
  if (estEnseignant) {
    classes = await classesAffectees(u.id, etablissementId, jours);
    const disciplineIds = [...new Set(classes.map((c) => c.disciplineId))];
    const cycles = await cyclesDesClasses([...new Set(classes.map((c) => c.classeId))]);
    suppleantsValides = await suppleantsPossibles(etablissementId, u.id, disciplineIds, cycles);
  }
  const nbSeances = classes.reduce((s, c) => s + c.nbSeances, 0);

  // Suppléants : on ne retient que ceux réellement proposables (intersection).
  const idsProposables = new Set(suppleantsValides.map((s) => s.id));
  const suppleantsChoisis = parseListe(parsed.data.suppleantIds, 20).filter((id) => idsProposables.has(id));
  const avecSuppleance = estEnseignant && suppleantsChoisis.length > 0;
  const suppleantsSnapshot = avecSuppleance
    ? suppleantsValides.filter((s) => suppleantsChoisis.includes(s.id)).map((s) => ({ id: s.id, nom: s.nom }))
    : [];

  // Dates de rattrapage : uniquement si enseignant, pas de suppléance et séances affectées.
  const datesRattrapage = !avecSuppleance && estEnseignant && nbSeances > 0
    ? [...new Set(parseListe(parsed.data.datesRattrapage, 30).filter(estIsoJour))].sort()
    : [];

  try {
    await prisma.demandeAbsence.create({
      data: {
        etablissementId,
        demandeurId: u.id,
        estEnseignant,
        dateDebut: debut,
        dateFin: fin,
        motif: parsed.data.motif || null,
        classesAffectees: classes as unknown as Prisma.InputJsonValue,
        nbSeancesAffectees: nbSeances,
        avecSuppleance,
        suppleants: suppleantsSnapshot as unknown as Prisma.InputJsonValue,
        datesRattrapage: datesRattrapage as unknown as Prisma.InputJsonValue,
        statut: "en_attente",
      },
    });

    // Notifier le supérieur hiérarchique (Chef d'établissement + ACE de l'établissement).
    const superieurs = await prisma.utilisateur.findMany({
      where: {
        etablissementId,
        id: { not: u.id },
        roleActif: { nomTechnique: { in: [...ROLES_DIRECTION] } },
      },
      select: { id: true, email: true, prenoms: true },
    });
    const periode = periodeLibelle(debut, fin);
    const lienRelatif = "/app/vie-scolaire/absences";
    if (superieurs.length > 0) {
      await creerNotifications(superieurs.map((s) => s.id), {
        type: "info",
        titre: "Demande d'autorisation d'absence",
        message: `${u.nomComplet} sollicite une autorisation d'absence ${periode}.`,
        lien: lienRelatif,
      });
      for (const s of superieurs) {
        try {
          const { subject, html } = gabaritDemandeAbsence({
            demandeurNom: u.nomComplet,
            periode,
            lien: `${baseUrl()}${lienRelatif}`,
            prenomDest: s.prenoms,
            motif: parsed.data.motif || null,
          });
          await envoyerEmail({ to: s.email, subject, html, lienDebug: `${baseUrl()}${lienRelatif}` });
        } catch (e) {
          console.error("[absence demande e-mail] échec :", e);
        }
      }
    }

    revalidatePath("/app/vie-scolaire/absences");
    revalidatePath("/app");
    return {
      ok: true,
      message: superieurs.length > 0
        ? "Demande envoyée à votre supérieur hiérarchique."
        : "Demande enregistrée. Aucun supérieur (Chef/ACE) n'est encore rattaché à l'établissement pour la traiter.",
    };
  } catch (e) {
    console.error("[absence demande] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

// ─────────────────────────── Décision (ACE / Chef) ───────────────────────────

const schemaDecision = z.object({
  demandeId: z.string().min(1),
  decision: z.enum(["approuver", "refuser"]),
  motifDecision: z.string().trim().max(400).optional(),
});

export async function deciderDemande(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const parsed = schemaDecision.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Données invalides." };

  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  const essai = refusEssaiPour(u);
  if (essai) return { ok: false, message: essai };

  const demande = await prisma.demandeAbsence.findUnique({
    where: { id: parsed.data.demandeId },
    select: {
      id: true, etablissementId: true, demandeurId: true, estEnseignant: true, statut: true,
      dateDebut: true, dateFin: true, motif: true, avecSuppleance: true, suppleants: true,
      demandeur: { select: { email: true, prenoms: true } },
    },
  });
  if (!demande) return { ok: false, message: "Demande introuvable." };

  // Cloisonnement : seul l'admin, ou le Chef/ACE de CET établissement (et jamais le demandeur
  // lui-même) peut décider.
  const estDirectionDuMême =
    (u.roleReel === "chef_etablissement" || u.roleReel === "adjoint_chef_etablissement") &&
    u.portee.etablissementId === demande.etablissementId;
  const autorise = (u.roleReel === "admin" || estDirectionDuMême) && u.id !== demande.demandeurId;
  if (!autorise) return { ok: false, message: "Vous n'êtes pas habilité à décider de cette demande." };
  if (demande.statut !== "en_attente") return { ok: false, message: "Cette demande a déjà été traitée." };

  const approuve = parsed.data.decision === "approuver";
  const periode = periodeLibelle(demande.dateDebut, demande.dateFin);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.demandeAbsence.update({
        where: { id: demande.id },
        data: {
          statut: approuve ? "approuvee" : "refusee",
          decisionParId: u.id,
          decisionLe: new Date(),
          motifDecision: parsed.data.motifDecision || null,
        },
      });

      // À l'approbation d'un ENSEIGNANT : générer les absences (une par jour ouvrable) qui
      // alimentent la heatmap et les statistiques. Tracées via demandeAbsenceId (idempotent :
      // la demande ne peut être approuvée qu'une fois).
      if (approuve && demande.estEnseignant) {
        const jours: { date: Date }[] = [];
        const cur = new Date(Date.UTC(demande.dateDebut.getUTCFullYear(), demande.dateDebut.getUTCMonth(), demande.dateDebut.getUTCDate()));
        const stop = new Date(Date.UTC(demande.dateFin.getUTCFullYear(), demande.dateFin.getUTCMonth(), demande.dateFin.getUTCDate()));
        let garde = 0;
        while (cur <= stop && garde < 400) {
          if (cur.getUTCDay() !== 0) jours.push({ date: new Date(cur) });
          cur.setUTCDate(cur.getUTCDate() + 1);
          garde++;
        }
        if (jours.length > 0) {
          await tx.absenceEnseignant.createMany({
            data: jours.map((j) => ({
              etablissementId: demande.etablissementId,
              enseignantId: demande.demandeurId,
              date: j.date,
              demiJournee: "journee",
              statut: "autorisee",
              motif: demande.motif,
              saisiParId: u.id,
              demandeAbsenceId: demande.id,
            })),
          });
        }
      }
    });

    // Notifier le demandeur (in-app + e-mail avec lien vers la fiche officielle si accordée).
    const lienRelatif = approuve
      ? `/app/vie-scolaire/absences/${demande.id}/fiche`
      : "/app/vie-scolaire/absences";
    await creerNotification({
      destinataireId: demande.demandeurId,
      type: approuve ? "succes" : "alerte",
      titre: approuve ? "Autorisation d'absence accordée" : "Demande d'absence refusée",
      message: approuve
        ? `Votre absence ${periode} a reçu un avis favorable. Fiche officielle disponible.`
        : `Votre demande d'absence ${periode} n'a pas reçu d'avis favorable.`,
      lien: lienRelatif,
    });
    try {
      const { subject, html } = gabaritDecisionAbsence({
        approuve,
        periode,
        lien: `${baseUrl()}${lienRelatif}`,
        prenom: demande.demandeur.prenoms,
        motifDecision: parsed.data.motifDecision || null,
      });
      await envoyerEmail({ to: demande.demandeur.email, subject, html, lienDebug: `${baseUrl()}${lienRelatif}` });
    } catch (e) {
      console.error("[absence decision e-mail] échec :", e);
    }

    // Informer les suppléants retenus (in-app) en cas d'avis favorable.
    if (approuve && demande.avecSuppleance && Array.isArray(demande.suppleants)) {
      const ids = (demande.suppleants as { id?: unknown }[]).map((s) => String(s?.id ?? "")).filter(Boolean);
      if (ids.length > 0) {
        await creerNotifications(ids, {
          type: "info",
          titre: "Suppléance à assurer",
          message: `Vous êtes désigné(e) pour assurer une suppléance ${periode}.`,
          lien: "/app/vie-scolaire/emplois-du-temps",
        });
      }
    }

    revalidatePath("/app/vie-scolaire/absences");
    revalidatePath("/app");
    return { ok: true, message: approuve ? "Demande approuvée. Le demandeur a été notifié." : "Demande refusée. Le demandeur a été notifié." };
  } catch (e) {
    console.error("[absence decision] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

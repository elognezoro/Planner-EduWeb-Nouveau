"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { TAILLE_MAX_DOCUMENT, TAILLE_MAX_DOCUMENT_LIBELLE } from "./limites";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

async function peutGerer(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return null;
  if (u.roleReel === "admin") return u;
  // Le gestionnaire de l'établissement (admin d'établissements ou chef) configure LE SIEN.
  if (
    (u.roleReel === "etablissements_admin" || u.roleReel === "chef_etablissement") &&
    u.portee.etablissementId === etablissementId
  ) {
    return u;
  }
  return null;
}

function s(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v || null;
}
function n(formData: FormData, key: string, def: number): number {
  const v = Number(formData.get(key));
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : def;
}

// ── Étapes 1 & 2 : sauvegarde des champs scalaires ──
export async function sauvegarderConfiguration(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  // Sauvegarde PARTIELLE : chaque bloc n'envoie que ses champs ; on ne met à jour que
  // les clés réellement présentes dans le formulaire (sinon on écraserait les autres par null).
  const champsTexte = [
    "code", "ville", "regionId", "pays", "sloganBulletin", "ministere", "anneeScolaire",
    "fonctionChef", "nomChef", "planRapport", "presentationRapport",
    "horaireDebutMatin", "horairePauseMatinDebut", "horairePauseMatinFin",
    "horairePauseMidiDebut", "horaireRepriseApresMidi", "horaireFinJournee",
  ] as const;
  const champsNombre: Record<string, number> = {
    effectifSouhaiteParClasse: 40,
    nbSallesDisponibles: 0,
    creneauxParJour: 8,
  };

  const data: Record<string, unknown> = {};
  if (formData.has("nom")) {
    const nom = s(formData, "nom");
    if (!nom) return { ok: false, message: "Le nom de l'établissement est requis." };
    data.nom = nom;
  }
  if (formData.has("type")) data.type = String(formData.get("type"));
  if (formData.has("statut")) data.statut = String(formData.get("statut"));
  for (const k of champsTexte) if (formData.has(k)) data[k] = s(formData, k);
  for (const k of Object.keys(champsNombre)) {
    if (formData.has(k)) data[k] = n(formData, k, champsNombre[k]);
  }
  // Régime de notation de l'établissement : trimestriel, semestriel ou séquentiel (6 ou 8).
  if (formData.has("regimeNotation")) {
    const regime = String(formData.get("regimeNotation"));
    if (!["trimestre", "semestre", "sequence"].includes(regime)) {
      return { ok: false, message: "Régime de notation invalide." };
    }
    data.regimeNotation = regime;
    data.nbSequences = regime === "sequence" ? (Number(formData.get("nbSequences")) === 8 ? 8 : 6) : null;
  }

  if (Object.keys(data).length === 0) return { ok: true };

  try {
    await prisma.etablissement.update({ where: { id }, data: data as never });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[config] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: "Enregistré." };
}

// ── Calcul des classes pédagogiques (effectif / effectif souhaité) ──
function lettreClasse(i: number): string {
  let s = "";
  let x = i + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export async function calculerClasses(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    const etab = await prisma.etablissement.findUnique({ where: { id } });
    if (!etab) return { ok: false, message: "Établissement introuvable." };
    const effectifSouhaite = Math.max(1, etab.effectifSouhaiteParClasse);
    const niveaux = await prisma.niveau.findMany({ orderBy: { ordre: "asc" } });
    const annee = await prisma.anneeScolaire.findFirst({ where: { active: true } });

    let totalClasses = 0;
    let modifie = false; // le jeu de classes a-t-il changé ? (invalide l'emploi du temps)
    for (const niveau of niveaux) {
      const effectif = n(formData, `effectif_${niveau.id}`, 0);
      const vacation = String(formData.get(`vacation_${niveau.id}`) ?? "simple");

      // Classes existantes de ce niveau (avec le nb d'inscrits, pour supprimer en priorité les vides).
      const existantes = await prisma.classe.findMany({
        where: { etablissementId: id, niveauId: niveau.id },
        select: { id: true, creeLe: true, _count: { select: { inscriptions: true } } },
      });

      if (effectif <= 0) {
        // Niveau vidé : on supprime sa config ET ses classes.
        if (existantes.length > 0) {
          await prisma.classe.deleteMany({ where: { etablissementId: id, niveauId: niveau.id } });
          modifie = true;
        }
        await prisma.niveauEtablissement.deleteMany({ where: { etablissementId: id, niveauId: niveau.id } });
        continue;
      }

      const nbClasses = Math.ceil(effectif / effectifSouhaite);
      totalClasses += nbClasses;
      const effectifParClasse = Math.round(effectif / nbClasses);

      await prisma.niveauEtablissement.upsert({
        where: { etablissementId_niveauId: { etablissementId: id, niveauId: niveau.id } },
        update: { effectif, vacation: vacation as never, nbClasses },
        create: { etablissementId: id, niveauId: niveau.id, effectif, vacation: vacation as never, nbClasses },
      });

      // Synchronise le nombre de classes EXACTEMENT à nbClasses (création OU suppression du surplus).
      if (nbClasses > existantes.length) {
        for (let k = existantes.length; k < nbClasses; k++) {
          await prisma.classe.create({
            data: {
              nom: `${niveau.nom} ${lettreClasse(k)}`,
              etablissementId: id,
              niveauId: niveau.id,
              effectif: effectifParClasse,
              regimeVacation: vacation as never,
              anneeScolaireId: annee?.id ?? null,
            },
          });
        }
        modifie = true;
      } else if (nbClasses < existantes.length) {
        // Supprime le surplus, en priorisant les classes sans élèves, puis les plus récentes.
        const aSupprimer = [...existantes]
          .sort((a, b) => a._count.inscriptions - b._count.inscriptions || b.creeLe.getTime() - a.creeLe.getTime())
          .slice(0, existantes.length - nbClasses)
          .map((c) => c.id);
        await prisma.classe.deleteMany({ where: { id: { in: aSupprimer } } });
        modifie = true;
      }

      // Aligne l'effectif des classes restantes sur le nouveau dimensionnement.
      await prisma.classe.updateMany({
        where: { etablissementId: id, niveauId: niveau.id },
        data: { effectif: effectifParClasse, regimeVacation: vacation as never },
      });
    }

    // Un changement du jeu de classes rend l'emploi du temps généré obsolète : on le purge.
    if (modifie) {
      await prisma.creneau.deleteMany({ where: { etablissementId: id } });
    }

    revalidatePath(`/app/systeme/etablissements/${id}`);
    revalidatePath(`/app/systeme/etablissements/${id}/emploi-du-temps`);
    const suffixe = modifie ? " L'emploi du temps a été réinitialisé (à régénérer)." : "";
    return { ok: true, message: `Classes calculées : ${totalClasses} division(s) au total.${suffixe}` };
  } catch (e) {
    console.error("[calcul-classes] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

/**
 * Ajoute une discipline — ou un COUPLE de disciplines (« Lettres-Anglais ») — à la liste
 * de l'établissement, depuis le bloc « Effectifs des enseignants ». Si elle existe déjà
 * dans le référentiel mais avait été retirée pour cet établissement, elle est réactivée ;
 * sinon elle est créée dans le référentiel (et rejoint la liste des compétences).
 */
export async function ajouterDisciplineReferentiel(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const nom = String(formData.get("nom") ?? "").trim();
  if (nom.length < 2 || nom.length > 80) {
    return { ok: false, message: "Nom de discipline requis (2 à 80 caractères)." };
  }
  try {
    const existe = await prisma.discipline.findFirst({
      where: { nom: { equals: nom, mode: "insensitive" } },
    });
    if (existe) {
      const etab = await prisma.etablissement.findUnique({ where: { id }, select: { disciplinesMasquees: true } });
      if (etab?.disciplinesMasquees.includes(existe.id)) {
        await prisma.etablissement.update({
          where: { id },
          data: { disciplinesMasquees: etab.disciplinesMasquees.filter((d) => d !== existe.id) },
        });
        revalidatePath(`/app/systeme/etablissements/${id}`);
        return { ok: true, message: `« ${existe.nom} » réactivée pour cet établissement.` };
      }
      return { ok: false, message: `« ${existe.nom} » figure déjà dans la liste.` };
    }
    await prisma.discipline.create({ data: { nom, couleur: "#2f7d5e" } });
    revalidatePath(`/app/systeme/etablissements/${id}`);
    revalidatePath("/app/systeme/configuration");
  } catch (e) {
    console.error("[discipline etab] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: `« ${nom} » ajoutée à la liste des compétences.` };
}

/**
 * Renomme une discipline depuis la console d'établissement (correction d'orthographe,
 * changement d'intitulé d'un couple…). Le nom est partagé par toute la plateforme :
 * toutes les références (grilles, affectations, notes, compétences…) suivent, puisque
 * l'identifiant ne change pas.
 */
export async function renommerDisciplineDepuisEtab(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const disciplineId = String(formData.get("disciplineId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const nom = String(formData.get("nom") ?? "").trim();
  if (!disciplineId) return { ok: false, message: "Discipline manquante." };
  if (nom.length < 2 || nom.length > 80) {
    return { ok: false, message: "Nom de discipline requis (2 à 80 caractères)." };
  }
  try {
    const discipline = await prisma.discipline.findUnique({ where: { id: disciplineId }, select: { nom: true } });
    if (!discipline) return { ok: false, message: "Discipline introuvable." };
    const doublon = await prisma.discipline.findFirst({
      where: { nom: { equals: nom, mode: "insensitive" }, id: { not: disciplineId } },
    });
    if (doublon) return { ok: false, message: `La discipline « ${doublon.nom} » existe déjà.` };
    await prisma.discipline.update({ where: { id: disciplineId }, data: { nom } });
    revalidatePath(`/app/systeme/etablissements/${id}`);
    revalidatePath("/app/systeme/configuration");
  } catch (e) {
    console.error("[discipline etab] renommage :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: `Discipline renommée en « ${nom} » (partout sur la plateforme).` };
}

/**
 * Retire une discipline de la liste de CET établissement (particularité locale) :
 * la ligne disparaît du tableau des effectifs et ses effectifs déclarés sont effacés.
 * Le référentiel national et les autres établissements ne sont pas touchés — la
 * discipline peut être réactivée à tout moment en la ré-ajoutant par son nom.
 */
export async function retirerDisciplineEtablissement(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const disciplineId = String(formData.get("disciplineId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  if (!disciplineId) return { ok: false, message: "Discipline manquante." };

  try {
    const [discipline, etab] = await Promise.all([
      prisma.discipline.findUnique({ where: { id: disciplineId }, select: { nom: true } }),
      prisma.etablissement.findUnique({ where: { id }, select: { disciplinesMasquees: true } }),
    ]);
    if (!discipline || !etab) return { ok: false, message: "Discipline ou établissement introuvable." };

    await prisma.$transaction([
      prisma.etablissement.update({
        where: { id },
        data: {
          disciplinesMasquees: etab.disciplinesMasquees.includes(disciplineId)
            ? etab.disciplinesMasquees
            : [...etab.disciplinesMasquees, disciplineId],
        },
      }),
      prisma.effectifEnseignant.deleteMany({ where: { etablissementId: id, disciplineId } }),
    ]);
    revalidatePath(`/app/systeme/etablissements/${id}`);
    return {
      ok: true,
      message: `« ${discipline.nom} » retirée de la liste de cet établissement (ré-ajoutez-la par son nom pour la réactiver).`,
    };
  } catch (e) {
    console.error("[discipline etab] retrait :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Effectifs des enseignants par cycle et discipline (intrant du solveur) ──
export async function enregistrerEffectifsEnseignants(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    const ops: Promise<unknown>[] = [];
    for (const [cle, val] of formData.entries()) {
      if (!cle.startsWith("eff_")) continue;
      const rest = cle.slice(4); // "<cycle>_<disciplineId>"
      const sep = rest.indexOf("_");
      if (sep < 0) continue;
      const cycle = rest.slice(0, sep);
      const disciplineId = rest.slice(sep + 1);
      if (cycle !== "college" && cycle !== "lycee") continue;
      const nombre = Math.max(0, Math.round(Number(val) || 0));
      ops.push(
        prisma.effectifEnseignant.upsert({
          where: { etablissementId_disciplineId_cycle: { etablissementId: id, disciplineId, cycle } },
          update: { nombre },
          create: { etablissementId: id, disciplineId, cycle, nombre },
        }),
      );
    }
    await Promise.all(ops);
    revalidatePath(`/app/systeme/etablissements/${id}`);
    return { ok: true, message: "Effectifs des enseignants enregistrés." };
  } catch (e) {
    console.error("[effectifs-enseignants] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

// ── Gestion manuelle des classes ──
export async function ajouterClasse(formData: FormData) {
  const id = String(formData.get("etablissementId") ?? "");
  const niveauId = String(formData.get("niveauId") ?? "");
  if (!id || !niveauId) return;
  const u = await peutGerer(id);
  if (!u) return;
  try {
    const etab = await prisma.etablissement.findUnique({ where: { id } });
    const annee = await prisma.anneeScolaire.findFirst({ where: { active: true } });
    const niveau = await prisma.niveau.findUnique({ where: { id: niveauId } });
    if (!niveau) return;
    const nb = await prisma.classe.count({ where: { etablissementId: id, niveauId } });
    const nomSaisi = s(formData, "nom");
    await prisma.classe.create({
      data: {
        nom: nomSaisi || `${niveau.nom} ${lettreClasse(nb)}`,
        etablissementId: id,
        niveauId,
        effectif: etab?.effectifSouhaiteParClasse ?? 40,
        anneeScolaireId: annee?.id ?? null,
      },
    });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[ajouter-classe] erreur :", e);
  }
}

export async function supprimerClasse(formData: FormData) {
  const id = String(formData.get("etablissementId") ?? "");
  const classeId = String(formData.get("classeId") ?? "");
  if (!id || !classeId) return;
  const u = await peutGerer(id);
  if (!u) return;
  try {
    const c = await prisma.classe.findUnique({ where: { id: classeId } });
    if (!c || c.etablissementId !== id) return;
    await prisma.classe.delete({ where: { id: classeId } });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[supprimer-classe] erreur :", e);
  }
}

// ── Gestion des niveaux (lignes du tableau « Effectif par niveau ») ──
export async function ajouterNiveau(
  etablissementId: string,
  nom: string,
  cycleBrut: string,
): Promise<{ ok: boolean; message?: string }> {
  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  const nomT = nom.trim();
  if (!nomT) return { ok: false, message: "Nom du niveau requis." };
  const cycle =
    cycleBrut === "college" || cycleBrut === "primaire" || cycleBrut === "prescolaire" ? cycleBrut : "lycee";
  try {
    const existe = await prisma.niveau.findUnique({ where: { nom: nomT } });
    if (existe) return { ok: false, message: "Ce niveau existe déjà." };
    const max = await prisma.niveau.aggregate({ _max: { ordre: true } });
    await prisma.niveau.create({ data: { nom: nomT, cycle: cycle as never, ordre: (max._max.ordre ?? 0) + 1 } });
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    return { ok: true };
  } catch (e) {
    console.error("[ajouter-niveau] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function supprimerNiveau(
  niveauId: string,
  etablissementId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!niveauId || !etablissementId) return { ok: false };
  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  try {
    // Les classes ont une contrainte RESTRICT : on les retire d'abord, puis le niveau
    // (qui cascade grille, niveauEtablissement et niveaux-enseignant).
    await prisma.classe.deleteMany({ where: { niveauId } });
    await prisma.niveau.delete({ where: { id: niveauId } });
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    return { ok: true };
  } catch (e) {
    console.error("[supprimer-niveau] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Champs personnalisés enseignants ──
export async function ajouterChamp(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  const etiquette = s(formData, "etiquette");
  if (!etiquette) return { ok: false, message: "Étiquette requise." };
  try {
    const count = await prisma.champEnseignant.count({ where: { etablissementId: id } });
    await prisma.champEnseignant.create({
      data: {
        etablissementId: id,
        etiquette,
        type: String(formData.get("type") ?? "text"),
        placeholder: s(formData, "placeholder"),
        requis: formData.get("requis") === "on",
        ordre: count,
      },
    });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[champ] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Champ ajouté." };
}

export async function supprimerChamp(formData: FormData) {
  const champId = String(formData.get("champId") ?? "");
  if (!champId) return;
  const champ = await prisma.champEnseignant.findUnique({ where: { id: champId } });
  if (!champ) return;
  const u = await peutGerer(champ.etablissementId);
  if (!u) return;
  await prisma.champEnseignant.delete({ where: { id: champId } });
  revalidatePath(`/app/systeme/etablissements/${champ.etablissementId}`);
}

// ── Documents officiels (Vercel Blob) ──
const CHAMPS_DOC: Record<string, "emblemeUrl" | "logoUrl" | "cachetUrl" | "signatureUrl"> = {
  embleme: "emblemeUrl",
  logo: "logoUrl",
  cachet: "cachetUrl",
  signature: "signatureUrl",
};


export async function televerserDocument(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const type = String(formData.get("type") ?? "");
  const champ = CHAMPS_DOC[type];
  if (!id || !champ) return { ok: false, message: "Paramètre invalide." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Aucun fichier sélectionné." };
  }
  if (!fichier.type.startsWith("image/")) {
    return { ok: false, message: "Le fichier doit être une image." };
  }
  if (fichier.size > TAILLE_MAX_DOCUMENT) {
    return {
      ok: false,
      message: `L'image dépasse ${TAILLE_MAX_DOCUMENT_LIBELLE} (${(fichier.size / 1024 / 1024).toFixed(1)} Mo) : réduisez-la avant de la téléverser.`,
    };
  }

  try {
    const ext = fichier.name.split(".").pop() ?? "png";
    const blob = await put(`etablissements/${id}/${type}-${Date.now()}.${ext}`, fichier, {
      access: "public",
      addRandomSuffix: true,
    });
    await prisma.etablissement.update({ where: { id }, data: { [champ]: blob.url } });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[blob] erreur :", e);
    return {
      ok: false,
      message:
        "Échec du téléversement. Le stockage Blob est-il bien configuré (BLOB_READ_WRITE_TOKEN) ?",
    };
  }
  return { ok: true, message: "Image téléversée." };
}

export async function supprimerDocument(formData: FormData) {
  const id = String(formData.get("etablissementId") ?? "");
  const type = String(formData.get("type") ?? "");
  const champ = CHAMPS_DOC[type];
  if (!id || !champ) return;
  const u = await peutGerer(id);
  if (!u) return;
  await prisma.etablissement.update({ where: { id }, data: { [champ]: null } });
  revalidatePath(`/app/systeme/etablissements/${id}`);
}

// ── Import de configuration (JSON) ──
const CHAMPS_IMPORT = [
  "nom", "type", "statut", "code", "ville", "pays", "sloganBulletin", "ministere",
  "anneeScolaire", "fonctionChef", "nomChef", "planRapport", "presentationRapport",
  "effectifSouhaiteParClasse", "nbSallesDisponibles", "creneauxParJour",
  "horaireDebutMatin", "horairePauseMatinDebut", "horairePauseMatinFin",
  "horairePauseMidiDebut", "horaireRepriseApresMidi", "horaireFinJournee",
];

export async function importerConfiguration(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Aucun fichier sélectionné." };
  }

  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(await fichier.text());
  } catch {
    return { ok: false, message: "Fichier JSON invalide." };
  }

  try {
    const e = (cfg.etablissement as Record<string, unknown>) ?? {};
    const data: Record<string, unknown> = {};
    for (const k of CHAMPS_IMPORT) if (k in e) data[k] = e[k];
    if (Object.keys(data).length > 0) {
      await prisma.etablissement.update({ where: { id }, data: data as never });
    }

    if (Array.isArray(cfg.champs)) {
      await prisma.champEnseignant.deleteMany({ where: { etablissementId: id } });
      const champs = cfg.champs as Array<Record<string, unknown>>;
      if (champs.length > 0) {
        await prisma.champEnseignant.createMany({
          data: champs.map((c, i) => ({
            etablissementId: id,
            etiquette: String(c.etiquette ?? ""),
            type: String(c.type ?? "text"),
            placeholder: (c.placeholder as string) ?? null,
            requis: Boolean(c.requis),
            ordre: Number(c.ordre ?? i),
          })),
        });
      }
    }

    if (Array.isArray(cfg.niveauxConfig)) {
      for (const nc of cfg.niveauxConfig as Array<Record<string, unknown>>) {
        const niveauId = String(nc.niveauId ?? "");
        if (!niveauId) continue;
        try {
          await prisma.niveauEtablissement.upsert({
            where: { etablissementId_niveauId: { etablissementId: id, niveauId } },
            update: { effectif: Number(nc.effectif ?? 0), vacation: (nc.vacation as never) ?? "simple", nbClasses: Number(nc.nbClasses ?? 0) },
            create: { etablissementId: id, niveauId, effectif: Number(nc.effectif ?? 0), vacation: (nc.vacation as never) ?? "simple", nbClasses: Number(nc.nbClasses ?? 0) },
          });
        } catch {
          /* niveau inconnu sur cette plateforme — ignoré */
        }
      }
    }

    if (Array.isArray(cfg.grilles)) {
      for (const g of cfg.grilles as Array<Record<string, unknown>>) {
        const niveauId = String(g.niveauId ?? "");
        const disciplineId = String(g.disciplineId ?? "");
        if (!niveauId || !disciplineId) continue;
        const seances = Array.isArray(g.seancesMinutes) ? (g.seancesMinutes as number[]) : [];
        try {
          await prisma.grilleHoraire.upsert({
            where: { niveauId_disciplineId_etablissementId: { niveauId, disciplineId, etablissementId: id } },
            update: { seancesMinutes: seances, coefficient: Number(g.coefficient ?? 1), heuresHebdo: Number(g.heuresHebdo ?? 0) },
            create: { niveauId, disciplineId, etablissementId: id, seancesMinutes: seances, coefficient: Number(g.coefficient ?? 1), heuresHebdo: Number(g.heuresHebdo ?? 0) },
          });
        } catch {
          /* discipline/niveau inconnu — ignoré */
        }
      }
    }

    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[import config] erreur :", e);
    return { ok: false, message: "Échec de l'import (format ou référentiels incompatibles)." };
  }
  return { ok: true, message: "Configuration importée." };
}

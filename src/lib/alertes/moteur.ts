import "server-only";
import { prisma } from "@/lib/prisma";
import { envoyerSMS } from "@/lib/sms/envoyer";
import { PARAMETRAGE_DEFAUT, fusionnerModele, type ParametrageAlertes } from "./modeles";

/**
 * Moteur d'alertes automatiques (page Alertes & SMS enrichie).
 * Lit le PARAMÉTRAGE de l'établissement (seuils, canaux, modèles), calcule des compteurs depuis
 * le REGISTRE D'APPEL (absences/retards non justifiés) et les NOTES (moyenne /20), puis envoie un
 * SMS aux parents des élèves qui franchissent un seuil. Réutilise les modèles de données existants
 * (Presence, Note, LienParentEleve, AlerteSMS) — aucune table parallèle.
 */

export type { ParametrageAlertes };

/** Charge le paramétrage d'un établissement, ou les valeurs par défaut s'il n'existe pas encore. */
export async function chargerParametrage(etablissementId: string): Promise<ParametrageAlertes> {
  const p = await prisma.parametrageAlertesSMS.findUnique({ where: { etablissementId } });
  if (!p) return PARAMETRAGE_DEFAUT;
  return {
    seuilAbsences: p.seuilAbsences,
    seuilRetards: p.seuilRetards,
    seuilNote: p.seuilNote,
    canalSms: p.canalSms,
    canalEmail: p.canalEmail,
    canalInApp: p.canalInApp,
    canalWhatsApp: p.canalWhatsApp,
    modeleAbsence: p.modeleAbsence,
    modeleRetard: p.modeleRetard,
    modeleNotes: p.modeleNotes,
    telEtablissement: p.telEtablissement,
  };
}

export interface ResultatPasse {
  elevesEvalues: number;
  elevesConcernes: number;
  smsEnvoyes: number;
  smsSimules: number;
  sansContact: number;
}

/**
 * Exécute une passe d'alertes pour un établissement : calcule les compteurs, sélectionne UNE alerte
 * prioritaire par élève (absences > retards > notes), et envoie le SMS aux parents. Dé-doublonné
 * par (téléphone, type) sur la journée pour ne pas ré-alerter deux fois le même jour.
 */
export async function executerPasseAlertes(etablissementId: string, acteurEmail: string): Promise<ResultatPasse> {
  const p = await chargerParametrage(etablissementId);
  const vide: ResultatPasse = { elevesEvalues: 0, elevesConcernes: 0, smsEnvoyes: 0, smsSimules: 0, sansContact: 0 };
  if (!p.canalSms) return vide; // seul le canal SMS est transmis aujourd'hui

  const etab = await prisma.etablissement.findUnique({ where: { id: etablissementId }, select: { nom: true, pays: true } });
  const classes = await prisma.classe.findMany({ where: { etablissementId }, select: { id: true, nom: true } });
  if (classes.length === 0) return vide;
  const nomClasse = new Map(classes.map((c) => [c.id, c.nom]));
  const classeIds = classes.map((c) => c.id);

  // Élèves inscrits (nom + classe).
  const inscriptions = await prisma.inscription.findMany({
    where: { classeId: { in: classeIds } },
    select: { eleveId: true, classeId: true, eleve: { select: { prenoms: true, nom: true, email: true } } },
  });
  const eleves = new Map(
    inscriptions.map((i) => [
      i.eleveId,
      { classeId: i.classeId, prenom: (i.eleve.prenoms || i.eleve.nom || i.eleve.email).split(" ")[0] },
    ]),
  );
  const eleveIds = [...eleves.keys()];
  if (eleveIds.length === 0) return vide;

  // Compteurs : absences / retards NON justifiés, moyenne /20 (notes sur 20).
  const [absG, retG, moyG] = await Promise.all([
    prisma.presence.groupBy({ by: ["eleveId"], where: { eleveId: { in: eleveIds }, justifie: false, statut: "absent", appel: { classeId: { in: classeIds } } }, _count: { _all: true } }),
    prisma.presence.groupBy({ by: ["eleveId"], where: { eleveId: { in: eleveIds }, justifie: false, statut: "retard", appel: { classeId: { in: classeIds } } }, _count: { _all: true } }),
    prisma.note.groupBy({ by: ["eleveId"], where: { eleveId: { in: eleveIds }, sur: 20, classe: { etablissementId } }, _avg: { valeur: true } }),
  ]);
  const absPar = new Map(absG.map((g) => [g.eleveId, g._count._all]));
  const retPar = new Map(retG.map((g) => [g.eleveId, g._count._all]));
  const moyPar = new Map(moyG.filter((g) => g._avg.valeur != null).map((g) => [g.eleveId, g._avg.valeur as number]));

  // Sélection d'UNE alerte prioritaire par élève.
  type Cible = { eleveId: string; type: "absence" | "retard" | "note"; nb: string | number; modele: string };
  const cibles: Cible[] = [];
  for (const eleveId of eleveIds) {
    const nbAbs = absPar.get(eleveId) ?? 0;
    const nbRet = retPar.get(eleveId) ?? 0;
    const moy = moyPar.get(eleveId);
    if (p.seuilAbsences > 0 && nbAbs >= p.seuilAbsences) {
      cibles.push({ eleveId, type: "absence", nb: nbAbs, modele: p.modeleAbsence });
    } else if (p.seuilRetards > 0 && nbRet >= p.seuilRetards) {
      cibles.push({ eleveId, type: "retard", nb: nbRet, modele: p.modeleRetard });
    } else if (p.seuilNote > 0 && moy != null && moy < p.seuilNote) {
      cibles.push({ eleveId, type: "note", nb: Math.round(moy * 10) / 10, modele: p.modeleNotes });
    }
  }
  if (cibles.length === 0) return { ...vide, elevesEvalues: eleveIds.length };

  // Contacts parents joignables.
  const liens = await prisma.lienParentEleve.findMany({
    where: { eleveId: { in: cibles.map((c) => c.eleveId) } },
    select: { eleveId: true, parent: { select: { telephone: true, prenoms: true, nom: true } } },
  });
  const parentsPar = new Map<string, { tel: string; nom: string }[]>();
  for (const l of liens) {
    const tel = l.parent.telephone?.trim();
    if (!tel) continue;
    const nom = [l.parent.prenoms, l.parent.nom].filter(Boolean).join(" ");
    parentsPar.set(l.eleveId, [...(parentsPar.get(l.eleveId) ?? []), { tel, nom }]);
  }

  // Dé-doublonnage : (téléphone, type) déjà alerté aujourd'hui ?
  const debutJour = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const dejaAujourdhui = await prisma.alerteSMS.findMany({
    where: { etablissementId, creeLe: { gte: debutJour } },
    select: { telephone: true, type: true },
  });
  const deja = new Set(dejaAujourdhui.map((a) => `${a.telephone}|${a.type}`));

  // Construction des envois (parent × cible), puis envoi en parallèle borné.
  const envois: { tel: string; contenu: string; type: "absence" | "retard" | "note" }[] = [];
  let sansContact = 0;
  let elevesConcernes = 0;
  for (const c of cibles) {
    const info = eleves.get(c.eleveId)!;
    const parents = parentsPar.get(c.eleveId) ?? [];
    if (parents.length === 0) { sansContact += 1; continue; }
    elevesConcernes += 1;
    for (const par of parents) {
      if (deja.has(`${par.tel}|${c.type}`)) continue;
      const contenu = fusionnerModele(c.modele, {
        prenom: info.prenom, nomParent: par.nom, classe: nomClasse.get(info.classeId) ?? "", nb: c.nb, telEtab: p.telEtablissement,
      });
      envois.push({ tel: par.tel, contenu, type: c.type });
      deja.add(`${par.tel}|${c.type}`); // évite les doublons intra-passe aussi
    }
  }

  let smsEnvoyes = 0;
  let smsSimules = 0;
  const CONCURRENCE = 8;
  for (let i = 0; i < envois.length; i += CONCURRENCE) {
    const lot = envois.slice(i, i + CONCURRENCE);
    const statuts = await Promise.all(
      lot.map(async (e) => {
        const statut = await envoyerSMS(e.tel, e.contenu);
        await prisma.alerteSMS.create({
          data: { etablissementId, etablissementNom: etab?.nom ?? null, pays: etab?.pays ?? null, telephone: e.tel, contenu: e.contenu, type: e.type, statut, envoyeParEmail: acteurEmail },
        });
        return statut;
      }),
    );
    for (const s of statuts) {
      if (s === "envoye") smsEnvoyes += 1;
      else if (s === "simule") smsSimules += 1;
    }
  }

  return { elevesEvalues: eleveIds.length, elevesConcernes, smsEnvoyes, smsSimules, sansContact };
}

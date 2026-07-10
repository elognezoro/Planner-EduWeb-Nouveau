import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { peutAdministrerCafop, estLectureSeuleCafop } from "@/lib/rbac/scope";
import { Card } from "@/components/app/ui";
import { anneeScolaireCourante } from "@/lib/annee-scolaire";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop, termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { EnteteCafop } from "../../entete-cafop";
import { SousEnteteCafop, sousTitreCafop } from "../sous-entete";
import { NotesBulletinsCafop, type EleveVue, type NoteVue, type ModuleNoteVue, type PromotionNoteVue } from "../vue-notes-bulletins";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTerme("CAFOP — Notes & bulletins", await termeCafopCourant()) };
}
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";

export default async function NotesBulletinsPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "cafop_admin", "adc", "delc"]);
  const { id } = await params;

  const cafop = await prisma.cafop.findUnique({ where: { id }, select: { id: true, nom: true, drena: true, pays: true } });
  if (!cafop) {
    redirect(BASE);
  }
  // Périmètre : admin (tous), cafop_admin & adc (leur centre), delc (les CAFOP de son pays).
  if (!peutAdministrerCafop(u.portee, id, cafop.pays)) redirect(BASE);
  const lectureSeule = estLectureSeuleCafop(u.roleActif);
  const masquerConfig = u.roleActif === "adc";

  const pays = await paysConsulte();
  const terme = await libelleCafop(pays);
  const [promotions, elevesRaw, modules, notes, regions, nbCentres] = await Promise.all([
    prisma.cohorte.findMany({ where: { cafopId: id, type: "cafop_promotion" }, orderBy: [{ anneeDebut: "desc" }, { creeLe: "desc" }], select: { id: true, libelle: true } }),
    prisma.apprenant.findMany({ where: { cohorte: { cafopId: id, type: "cafop_promotion" } }, orderBy: [{ nom: "asc" }, { prenoms: "asc" }], select: { id: true, nom: true, prenoms: true, matricule: true, groupe: true, annee: true, cohorteId: true } }),
    prisma.moduleCafop.findMany({ where: { actif: true }, orderBy: [{ annee: "asc" }, { ordre: "asc" }, { creeLe: "asc" }], select: { id: true, nom: true, coefficient: true, annee: true } }),
    prisma.noteCafop.findMany({ where: { apprenant: { cohorte: { cafopId: id } } }, select: { id: true, apprenantId: true, moduleId: true, type: true, valeur: true, bareme: true, coefficient: true, semestre: true } }),
    prisma.region.findMany({ where: { pays }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.cafop.count({ where: { pays } }),
  ]);

  const eleves: EleveVue[] = elevesRaw.map((e) => ({ id: e.id, nom: e.nom, prenoms: e.prenoms, matricule: e.matricule, groupe: e.groupe, annee: e.annee, promotionId: e.cohorteId }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EnteteCafop ongletActif="enseignements" nbCentres={nbCentres} regions={regions} terme={terme} lectureSeule={lectureSeule} />
      <SousEnteteCafop cafopId={cafop.id} nom={cafop.nom} sousTitre={sousTitreCafop(cafop, promotions.length, eleves.length)} actif="notes" terme={terme} masquerConfig={masquerConfig} />

      {modules.length === 0 ? (
        <Card><p className="text-sm text-ink-700/70">Aucun module de formation. Ajoutez-en via « Enseignements &amp; Évaluation → Gérer les modules ».</p></Card>
      ) : promotions.length === 0 ? (
        <Card><p className="text-sm text-ink-700/70">{`Aucune promotion. Créez-en une dans « ${appliquerTerme("Configurer le CAFOP", terme)} ».`}</p></Card>
      ) : (
        <NotesBulletinsCafop
          cafop={cafop}
          annee={anneeScolaireCourante()}
          modules={modules as ModuleNoteVue[]}
          promotions={promotions as PromotionNoteVue[]}
          eleves={eleves}
          notes={notes as NoteVue[]}
          terme={terme}
          lectureSeule={lectureSeule}
        />
      )}
    </div>
  );
}

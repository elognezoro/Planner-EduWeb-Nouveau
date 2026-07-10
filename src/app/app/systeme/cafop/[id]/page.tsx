import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { peutAdministrerCafop, estLectureSeuleCafop } from "@/lib/rbac/scope";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop, termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { PageHeader } from "@/components/app/ui";
import { EnteteCafop } from "../entete-cafop";
import { SousEnteteCafop, sousTitreCafop } from "./sous-entete";
import { ConfigurerCafop, type CafopConfig, type PromotionConfig, type EleveConfig, type EnseignantConfig } from "./configurer-cafop";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTerme("CAFOP — Configuration", await termeCafopCourant()) };
}
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";

export default async function CafopConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "superviseur_international", "super_admin_cafop", "representant_pays", "cafop_admin", "delc"]);
  const { id } = await params;

  const pays = await paysConsulte();
  const terme = await libelleCafop(pays);

  const cafop = await prisma.cafop.findUnique({
    where: { id },
    select: {
      id: true, nom: true, code: true, drena: true, localite: true, directeur: true, directeurTel: true, effectif: true, pays: true,
      emblemeUrl: true, logoUrl: true, cachetUrl: true, signatureUrl: true,
    },
  });
  if (!cafop) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre={appliquerTerme("CAFOP introuvable", terme)} />
        <Link href={BASE} className="text-sm font-semibold text-forest-700 hover:text-forest-900">← Retour à la liste</Link>
      </div>
    );
  }

  // Périmètre : admin/superviseur international (tous), cafop_admin (son centre), représentant-pays (son pays).
  if (!peutAdministrerCafop(u.portee, id, cafop.pays)) redirect(BASE);
  const lectureSeule = estLectureSeuleCafop(u.roleActif); // delc : console en lecture seule

  const [promosRaw, elevesRaw, regions, nbCentres, enseignantsRaw] = await Promise.all([
    prisma.cohorte.findMany({
      where: { cafopId: id, type: "cafop_promotion" },
      orderBy: [{ anneeDebut: "desc" }, { creeLe: "desc" }],
      select: { id: true, libelle: true, _count: { select: { apprenants: true } } },
    }),
    prisma.apprenant.findMany({
      where: { cohorte: { cafopId: id, type: "cafop_promotion" } },
      orderBy: [{ annee: "asc" }, { groupe: "asc" }, { nom: "asc" }],
      select: { id: true, nom: true, prenoms: true, matricule: true, groupe: true, annee: true, cohorteId: true },
    }),
    prisma.region.findMany({ where: { pays }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.cafop.count({ where: { pays } }),
    prisma.enseignantCafop.findMany({ where: { cafopId: id }, orderBy: [{ nom: "asc" }, { prenoms: "asc" }], select: { id: true, nom: true, prenoms: true, discipline: true } }),
  ]);

  const promotions: PromotionConfig[] = promosRaw.map((p) => ({ id: p.id, libelle: p.libelle, nbEleves: p._count.apprenants }));
  const eleves: EleveConfig[] = elevesRaw.map((e) => ({ id: e.id, nom: e.nom, prenoms: e.prenoms, matricule: e.matricule, groupe: e.groupe, annee: e.annee, promotionId: e.cohorteId }));
  const enseignants: EnseignantConfig[] = enseignantsRaw.map((e) => ({ id: e.id, nom: e.nom, prenoms: e.prenoms, discipline: e.discipline }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EnteteCafop ongletActif="enseignements" nbCentres={nbCentres} regions={regions} terme={terme} lectureSeule={lectureSeule} />
      <SousEnteteCafop cafopId={cafop.id} nom={cafop.nom} sousTitre={sousTitreCafop(cafop, promotions.length, eleves.length)} actif="config" terme={terme} />
      <ConfigurerCafop cafop={cafop as CafopConfig} promotions={promotions} eleves={eleves} enseignants={enseignants} paysArmoiries={pays} terme={terme} lectureSeule={lectureSeule} />
    </div>
  );
}

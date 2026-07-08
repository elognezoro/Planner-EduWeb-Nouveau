import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { Card } from "@/components/app/ui";
import { EnteteCafop } from "../../entete-cafop";
import { SousEnteteCafop, sousTitreCafop } from "../sous-entete";
import { RegistreAppelCafop, type EleveAppel, type PresenceVue } from "./vue";

export const metadata: Metadata = { title: "CAFOP — Registre d'appel" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";
const jour = (d: Date) => d.toISOString().slice(0, 10);

export default async function RegistreAppelPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "cafop_admin"]);
  const { id } = await params;
  if (u.roleReel === "cafop_admin" && u.portee.cafopId !== id) redirect(BASE);

  const cafop = await prisma.cafop.findUnique({ where: { id }, select: { id: true, nom: true, drena: true, pays: true } });
  if (!cafop) redirect(BASE);

  const pays = await paysConsulte();
  const terme = await libelleCafop(pays);
  const [promotions, elevesRaw, presencesRaw, regions, nbCentres] = await Promise.all([
    prisma.cohorte.findMany({ where: { cafopId: id, type: "cafop_promotion" }, orderBy: [{ anneeDebut: "desc" }, { creeLe: "desc" }], select: { id: true, libelle: true } }),
    prisma.apprenant.findMany({ where: { cohorte: { cafopId: id, type: "cafop_promotion" } }, orderBy: [{ nom: "asc" }, { prenoms: "asc" }], select: { id: true, nom: true, prenoms: true, groupe: true, cohorteId: true } }),
    prisma.presenceCafop.findMany({ where: { apprenant: { cohorte: { cafopId: id } } }, select: { apprenantId: true, date: true, statut: true } }),
    prisma.region.findMany({ where: { pays }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.cafop.count({ where: { pays } }),
  ]);

  const eleves: EleveAppel[] = elevesRaw.map((e) => ({ id: e.id, nom: e.nom, prenoms: e.prenoms, groupe: e.groupe, promotionId: e.cohorteId }));
  const presences: PresenceVue[] = presencesRaw.map((p) => ({ apprenantId: p.apprenantId, date: jour(p.date), statut: p.statut }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EnteteCafop ongletActif="enseignements" nbCentres={nbCentres} regions={regions} terme={terme} />
      <SousEnteteCafop cafopId={cafop.id} nom={cafop.nom} sousTitre={sousTitreCafop(cafop, promotions.length, eleves.length)} actif="appel" terme={terme} />
      {promotions.length === 0 ? (
        <Card><p className="text-sm text-ink-700/70">{`Aucune promotion. Créez-en une dans « ${appliquerTerme("Configurer le CAFOP", terme)} ».`}</p></Card>
      ) : (
        <RegistreAppelCafop promotions={promotions} eleves={eleves} presences={presences} defaultDate={jour(new Date())} />
      )}
    </div>
  );
}

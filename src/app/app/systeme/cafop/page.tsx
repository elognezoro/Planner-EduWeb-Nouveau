import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { estLectureSeuleCafop } from "@/lib/rbac/scope";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop, termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { PageHeader, Card } from "@/components/app/ui";
import { anneeScolaireCourante } from "@/lib/annee-scolaire";
import { GestionCafop, type CentreVue, type PromotionVue, type KpiCafop } from "./gestion-cafop";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTerme("CAFOP", await termeCafopCourant()) };
}
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";

export default async function CafopPage() {
  const u = await requireRole(["admin", "superviseur_international", "super_admin_cafop", "representant_pays", "cafop_admin", "delc", "adc"]);

  // Tout le contenu est circonscrit au pays consulté (par défaut, le pays de l'utilisateur).
  const pays = await paysConsulte();
  const terme = await libelleCafop(pays);
  const T = (s: string) => appliquerTerme(s, terme);

  // cafop_admin : redirigé vers le détail de son centre.
  if (u.roleReel === "cafop_admin") {
    if (u.portee.cafopId) redirect(`${BASE}/${u.portee.cafopId}`);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre={T("CAFOP")} description="Gestion des promotions d'élèves-maîtres." />
        <Card>
          <p className="text-sm text-ink-700/70">{T("Aucun CAFOP n'est rattaché à votre compte.")}</p>
        </Card>
      </div>
    );
  }

  // adc : LECTURE SEULE — pas de liste ni de gestion ; renvoyé au cahier de texte de SON centre.
  if (u.roleReel === "adc") {
    if (u.portee.cafopId) redirect(`${BASE}/${u.portee.cafopId}/cahier-texte`);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre={T("CAFOP")} description="Consultation en lecture seule." />
        <Card>
          <p className="text-sm text-ink-700/70">{T("Aucun CAFOP n'est rattaché à votre compte.")}</p>
        </Card>
      </div>
    );
  }

  let centres: CentreVue[] = [];
  let promotions: PromotionVue[] = [];
  let regions: { id: string; nom: string }[] = [];
  let erreur = false;
  try {
    const [liste, regs] = await Promise.all([
      prisma.cafop.findMany({
        where: { pays },
        orderBy: { nom: "asc" },
        select: {
          id: true,
          nom: true,
          code: true,
          pays: true,
          drena: true,
          localite: true,
          directeur: true,
          directeurTel: true,
          effectif: true,
          cohortes: {
            where: { type: "cafop_promotion" },
            orderBy: [{ anneeDebut: "desc" }, { creeLe: "desc" }],
            select: { id: true, libelle: true, nbCohortes: true, effectif: true, progression: true, statut: true },
          },
        },
      }),
      prisma.region.findMany({ where: { pays }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    ]);

    centres = liste.map((c) => ({
      id: c.id,
      nom: c.nom,
      code: c.code,
      pays: c.pays,
      drena: c.drena,
      localite: c.localite,
      directeur: c.directeur,
      directeurTel: c.directeurTel,
      effectif: c.effectif,
    }));
    promotions = liste.flatMap((c) =>
      c.cohortes.map((p) => ({
        id: p.id,
        libelle: p.libelle,
        centre: c.nom,
        nbCohortes: p.nbCohortes,
        effectif: p.effectif,
        progression: p.progression,
        statut: p.statut,
      })),
    );
    regions = regs;
  } catch (e) {
    console.error("[cafop] chargement :", e);
    erreur = true;
  }

  if (erreur) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre={T("Gestion des CAFOP")} />
        <Card>
          <p className="text-sm text-ink-700/70">{T("Impossible de charger les CAFOP.")}</p>
        </Card>
      </div>
    );
  }

  const kpi: KpiCafop = {
    centres: centres.length,
    promotions: promotions.length,
    cohortes: promotions.reduce((a, p) => a + p.nbCohortes, 0),
    elevesMaitres: centres.reduce((a, c) => a + c.effectif, 0),
  };

  return (
    <div className="mx-auto max-w-6xl">
      <GestionCafop
        annee={anneeScolaireCourante()}
        kpi={kpi}
        centres={centres}
        promotions={promotions}
        regions={regions}
        terme={terme}
        pays={pays}
        lectureSeule={estLectureSeuleCafop(u.roleActif)}
      />
    </div>
  );
}

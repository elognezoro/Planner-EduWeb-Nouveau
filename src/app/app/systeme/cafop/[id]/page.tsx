import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookText, ClipboardCheck, FileBarChart } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { anneeScolaireCourante } from "@/lib/annee-scolaire";
import { EnteteCafop } from "../entete-cafop";
import { NotesBulletinsCafop, type EleveVue, type NoteVue, type ModuleNoteVue, type PromotionNoteVue } from "./notes-bulletins";

export const metadata: Metadata = { title: "CAFOP — Notes & bulletins" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";

export default async function CafopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "cafop_admin"]);
  const { id } = await params;
  if (u.roleReel === "cafop_admin" && u.portee.cafopId !== id) redirect(BASE);

  const cafop = await prisma.cafop.findUnique({ where: { id }, select: { id: true, nom: true, drena: true, pays: true } });
  if (!cafop) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre="CAFOP introuvable" />
        <Link href={BASE} className="text-sm font-semibold text-forest-700 hover:text-forest-900">← Retour à la liste</Link>
      </div>
    );
  }

  const [promotions, elevesRaw, modules, notes, regions, nbCentres] = await Promise.all([
    prisma.cohorte.findMany({
      where: { cafopId: id, type: "cafop_promotion" },
      orderBy: [{ anneeDebut: "desc" }, { creeLe: "desc" }],
      select: { id: true, libelle: true },
    }),
    prisma.apprenant.findMany({
      where: { cohorte: { cafopId: id, type: "cafop_promotion" } },
      orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
      select: { id: true, nom: true, prenoms: true, matricule: true, groupe: true, cohorteId: true },
    }),
    prisma.moduleCafop.findMany({ where: { actif: true }, orderBy: [{ ordre: "asc" }, { creeLe: "asc" }], select: { id: true, nom: true, coefficient: true } }),
    prisma.noteCafop.findMany({
      where: { apprenant: { cohorte: { cafopId: id } } },
      select: { id: true, apprenantId: true, moduleId: true, type: true, valeur: true, bareme: true, coefficient: true, semestre: true },
    }),
    prisma.region.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.cafop.count(),
  ]);

  const eleves: EleveVue[] = elevesRaw.map((e) => ({
    id: e.id,
    nom: e.nom,
    prenoms: e.prenoms,
    matricule: e.matricule,
    groupe: e.groupe,
    promotionId: e.cohorteId,
  }));

  const sousOnglets = [
    { libelle: "Cahier de texte", Icone: BookText, dispo: false },
    { libelle: "Registre d'appel", Icone: ClipboardCheck, dispo: false },
    { libelle: "Notes et bulletins", Icone: FileBarChart, dispo: true },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EnteteCafop ongletActif="enseignements" nbCentres={nbCentres} regions={regions} />

      {/* Sous-en-tête du centre */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-white px-5 py-3.5 shadow-soft">
        <div className="flex items-center gap-3">
          <Link href={`${BASE}/enseignements`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 px-3 text-sm font-semibold text-ink-700/70 hover:bg-cream-100">
            <ArrowLeft size={15} /> Retour
          </Link>
          <div>
            <h2 className="font-display text-lg font-bold text-forest-900">{cafop.nom}</h2>
            <p className="text-xs text-ink-700/55">
              {(cafop.drena ? `DRENA ${cafop.drena} — ` : "") + cafop.pays} · {promotions.length} promotion(s) · {eleves.length} élève(s)-maître(s)
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {sousOnglets.map((o) =>
            o.dispo ? (
              <span key={o.libelle} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gold-100 px-3.5 text-sm font-semibold text-gold-800">
                <o.Icone size={15} /> {o.libelle}
              </span>
            ) : (
              <span key={o.libelle} title="Bientôt disponible" className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-full border border-cream-200 px-3.5 text-sm font-medium text-ink-700/35">
                <o.Icone size={15} /> {o.libelle}
              </span>
            ),
          )}
        </nav>
      </div>

      {modules.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">Aucun module de formation défini. Ajoutez-en depuis « Enseignements &amp; Évaluation → Gérer les modules ».</p>
        </Card>
      ) : promotions.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">Aucune promotion pour ce CAFOP.</p>
        </Card>
      ) : (
        <NotesBulletinsCafop
          cafop={cafop}
          annee={anneeScolaireCourante()}
          modules={modules as ModuleNoteVue[]}
          promotions={promotions as PromotionNoteVue[]}
          eleves={eleves}
          notes={notes as NoteVue[]}
        />
      )}
    </div>
  );
}

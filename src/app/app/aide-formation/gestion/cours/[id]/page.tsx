import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText, Video, FileDown, ExternalLink, ListChecks, FileCheck2, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLE_IDS, ROLES } from "@/lib/rbac/roles";
import { PageHeader, Card } from "@/components/app/ui";
import { FormCours, FormModule, BoutonsOrdreModule, SupprimerModuleBtn, type OptionsCommunes } from "../../formulaires";
import { FormTuteur, SupprimerTuteurBtn } from "./tuteurs-forms";
import { CouvertureCours } from "./couverture";

export const metadata: Metadata = { title: "Édition du cours — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const ICONE_TYPE = { texte: FileText, video: Video, fichier: FileDown, lien: ExternalLink, devoir: FileCheck2 } as const;
const nomTuteur = (u: { nom: string | null; prenoms: string | null; email: string }) => [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email;

export default async function EditionCoursPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;

  const [cours, categories] = await Promise.all([
    prisma.cours.findUnique({
      where: { id },
      select: { id: true, titre: true, description: true, categorieId: true, niveau: true, publicCible: true, dureeMinutes: true, statut: true, imageUrl: true,
        seuilCompletion: true, progressionSequentielle: true, estGuide: true, attestationSignataire: true, attestationFonction: true, attestationMention: true,
        modules: { orderBy: { ordre: "asc" }, select: { id: true, titre: true, type: true, contenu: true, fichierNom: true, dureeMinutes: true } },
        tuteurs: { orderBy: { creeLe: "asc" }, select: { id: true, utilisateur: { select: { email: true, nom: true, prenoms: true } } } } },
    }),
    prisma.categorieFormation.findMany({ orderBy: { ordre: "asc" }, select: { id: true, nom: true } }),
  ]);
  if (!cours) redirect(`${BASE}/gestion`);

  const opts: OptionsCommunes = { categories, roles: ROLE_IDS.map((rid) => ({ id: rid, libelle: ROLES[rid].libelle })) };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${BASE}/gestion`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Gestion du contenu</Link>
      <PageHeader titre={cours.titre} description={`Fiche du cours et leçons · ${cours.statut === "publie" ? "Publié" : "Brouillon"}`} />

      <section className="space-y-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-700/55">Fiche du cours</h2>
        <FormCours opts={opts} cours={cours} />
        <CouvertureCours coursId={cours.id} imageUrl={cours.imageUrl} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-700/55">Leçons ({cours.modules.length})</h2>
          <FormModule coursId={cours.id} />
        </div>
        {cours.modules.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Aucune leçon. Ajoutez-en une pour construire le cours.</p></Card>
        ) : (
          <div className="space-y-2">
            {cours.modules.map((m, i) => {
              const Icone = ICONE_TYPE[m.type as keyof typeof ICONE_TYPE] ?? FileText;
              return (
                <Card key={m.id} className="flex items-center gap-3 py-3">
                  <BoutonsOrdreModule id={m.id} />
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-forest-700"><Icone size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-forest-900"><span className="text-ink-700/40">{i + 1}.</span> {m.titre}</p>
                    <p className="text-xs text-ink-700/55">{m.type}{m.dureeMinutes ? ` · ${m.dureeMinutes} min` : ""}{m.fichierNom ? ` · ${m.fichierNom}` : ""}</p>
                  </div>
                  {m.type === "quiz" && (
                    <Link href={`${BASE}/gestion/cours/${cours.id}/quiz/${m.id}`} className="inline-flex items-center gap-1 rounded-full border border-forest-300 bg-white px-2.5 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-50"><ListChecks size={13} /> Questions</Link>
                  )}
                  {m.type === "devoir" && (
                    <Link href={`${BASE}/gestion/cours/${cours.id}/devoir/${m.id}`} className="inline-flex items-center gap-1 rounded-full border border-forest-300 bg-white px-2.5 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-50"><FileCheck2 size={13} /> Consigne</Link>
                  )}
                  <FormModule coursId={cours.id} module={m} />
                  <SupprimerModuleBtn id={m.id} />
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink-700/55"><Users size={16} /> Tuteurs correcteurs ({cours.tuteurs.length})</h2>
        <p className="text-xs text-ink-700/55">Les tuteurs désignés peuvent corriger les devoirs déposés sur ce cours (depuis « Corrections »).</p>
        <Card className="space-y-3">
          <FormTuteur coursId={cours.id} />
          {cours.tuteurs.length > 0 && (
            <ul className="divide-y divide-cream-100">
              {cours.tuteurs.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-forest-900">{nomTuteur(t.utilisateur)}</p>
                    <p className="truncate text-xs text-ink-700/55">{t.utilisateur.email}</p>
                  </div>
                  <SupprimerTuteurBtn id={t.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

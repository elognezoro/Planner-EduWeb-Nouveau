import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarCog, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";

export const metadata: Metadata = { title: "Générer l'emploi du temps" };
export const dynamic = "force-dynamic";

export default async function GenerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireRole(["admin", "etablissements_admin", "chef_etablissement"]);
  if (u.roleReel !== "admin" && u.portee.etablissementId !== id) {
    redirect("/app/systeme/etablissements");
  }

  const etab = await prisma.etablissement.findUnique({ where: { id } });
  if (!etab) redirect("/app/systeme/etablissements");

  const [nbClasses, nbSalles, nbGrille, nbAffectations] = await Promise.all([
    prisma.classe.count({ where: { etablissementId: id } }),
    prisma.salle.count({ where: { etablissementId: id } }),
    prisma.grilleHoraire.count({ where: { etablissementId: id } }),
    prisma.affectationEnseignant.count({ where: { classe: { etablissementId: id } } }),
  ]);

  const prerequis = [
    { libelle: "Classes pédagogiques créées", ok: nbClasses > 0, detail: `${nbClasses} classe(s)` },
    { libelle: "Salles déclarées (capacité & type)", ok: nbSalles > 0, detail: `${nbSalles} salle(s)` },
    { libelle: "Horaires journaliers renseignés", ok: Boolean(etab.horaireDebutMatin && etab.horaireFinJournee), detail: etab.horaireDebutMatin ? `${etab.horaireDebutMatin}–${etab.horaireFinJournee}` : "à définir" },
    { libelle: "Affectations enseignants", ok: nbAffectations > 0, detail: `${nbAffectations} affectation(s)` },
    { libelle: "Grille horaire (surcharge établissement)", ok: nbGrille > 0, detail: nbGrille > 0 ? `${nbGrille} entrée(s)` : "modèle national utilisé" },
  ];
  const pret = prerequis.filter((p) => p.libelle !== "Grille horaire (surcharge établissement)").every((p) => p.ok);

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <Link
        href={`/app/systeme/etablissements/${id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"
      >
        <ArrowLeft size={16} /> Configuration de l'établissement
      </Link>

      <PageHeader
        titre="Générer l'emploi du temps"
        description={`${etab.nom} — vérification des prérequis du solveur de contraintes.`}
      />

      <Card>
        <h2 className="mb-4 font-display text-lg font-bold text-forest-900">Prérequis</h2>
        <ul className="space-y-3">
          {prerequis.map((p) => (
            <li key={p.libelle} className="flex items-center gap-3 text-sm">
              {p.ok ? (
                <CheckCircle2 size={18} className="shrink-0 text-forest-600" />
              ) : (
                <AlertTriangle size={18} className="shrink-0 text-gold-600" />
              )}
              <span className="flex-1 text-forest-900">{p.libelle}</span>
              <span className="text-xs text-ink-700/60">{p.detail}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-gold-300/60 bg-gold-50">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-500/20 text-gold-700">
            <Clock size={20} />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-gold-900">
              Moteur de génération — Phase 4 (en cours d'intégration)
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-gold-900/80">
              Le solveur à backtracking avec heuristiques (contraintes dures jamais violées,
              affichage explicite des blocages, ajustement par glisser-déposer) constitue le
              prochain incrément. Cette configuration en est l'intrant complet.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          disabled
          className="inline-flex h-12 items-center gap-2 rounded-full bg-forest-800 px-8 text-sm font-semibold text-cream-50 opacity-60"
          title={pret ? "Disponible à la Phase 4" : "Complétez les prérequis"}
        >
          <CalendarCog size={18} /> Lancer la génération
        </button>
      </div>
    </div>
  );
}

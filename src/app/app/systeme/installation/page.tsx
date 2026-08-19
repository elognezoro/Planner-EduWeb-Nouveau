import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, Rocket, PlugZap } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";

export const metadata: Metadata = { title: "Assistant d'installation" };
export const dynamic = "force-dynamic";

interface Etape {
  titre: string;
  description: string;
  fait: boolean;
  lien?: string;
  lienLibelle?: string;
}

export default async function InstallationPage() {
  await requireRole(["admin"]);

  let etapes: Etape[] = [];
  let integrations: { titre: string; description: string; fait: boolean }[] = [];
  let erreur = false;

  try {
    const [config, anneesActives, regions, disciplines, niveaux, grilleNat, etablissements, classes, salles, creneaux] =
      await Promise.all([
        prisma.configuration.findUnique({ where: { id: "global" }, select: { anneeScolaireCourante: true } }),
        prisma.anneeScolaire.count({ where: { active: true } }),
        prisma.region.count(),
        // Référentiel NATIONAL seulement (les lignes propres aux écoles ne comptent pas ici).
        prisma.discipline.count({ where: { etablissementId: null } }),
        prisma.niveau.count({ where: { etablissementId: null } }),
        prisma.grilleHoraire.count({ where: { etablissementId: null } }),
        prisma.etablissement.count(),
        prisma.classe.count(),
        prisma.salle.count(),
        prisma.creneau.count(),
      ]);

    const anneeOk = Boolean(config?.anneeScolaireCourante) || anneesActives > 0;

    etapes = [
      {
        titre: "Année scolaire active",
        description: "Définir l'année scolaire courante et le régime de notation.",
        fait: anneeOk,
        lien: "/app/systeme/configuration",
        lienLibelle: "Configuration générale",
      },
      {
        titre: "Régions référencées",
        description: "Les découpages régionaux (DRENA) servent de périmètre.",
        fait: regions > 0,
        lien: "/app/systeme/configuration",
        lienLibelle: "Configuration générale",
      },
      {
        titre: "Disciplines & niveaux",
        description: "Référentiel national des matières et des niveaux scolaires.",
        fait: disciplines > 0 && niveaux > 0,
        lien: "/app/systeme/configuration",
        lienLibelle: "Configuration générale",
      },
      {
        titre: "Grille horaire nationale",
        description: "Volumes horaires par niveau et discipline (modèle par défaut).",
        fait: grilleNat > 0,
        lien: "/app/systeme/configuration",
        lienLibelle: "Configuration générale",
      },
      {
        titre: "Au moins un établissement",
        description: "Créer les établissements et leur configuration.",
        fait: etablissements > 0,
        lien: "/app/systeme/etablissements",
        lienLibelle: "Établissements",
      },
      {
        titre: "Classes créées",
        description: "Générer ou ajouter les classes pédagogiques.",
        fait: classes > 0,
        lien: "/app/systeme/etablissements",
        lienLibelle: "Établissements",
      },
      {
        titre: "Salles déclarées",
        description: "Déclarer les salles (capacité et type) pour la planification.",
        fait: salles > 0,
        lien: "/app/systeme/etablissements",
        lienLibelle: "Établissements",
      },
      {
        titre: "Premier emploi du temps généré",
        description: "Lancer le solveur pour produire un emploi du temps.",
        fait: creneaux > 0,
        lien: "/app/systeme/etablissements",
        lienLibelle: "Établissements",
      },
    ];

    integrations = [
      {
        titre: "E-mails transactionnels (Resend)",
        description: "Clé RESEND_API_KEY — confirmations et notifications par e-mail. En son absence, repli console (dev).",
        fait: Boolean(process.env.RESEND_API_KEY),
      },
      {
        titre: "Paiement (Stripe / Mobile Money)",
        description: "Clé STRIPE_SECRET_KEY — sinon l'Académie Premium fonctionne en mode démo.",
        fait: Boolean(process.env.STRIPE_SECRET_KEY),
      },
      {
        titre: "URL de l'application",
        description: "AUTH_URL / NEXT_PUBLIC_APP_URL — liens absolus dans les e-mails.",
        fait: Boolean(process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL),
      },
    ];
  } catch (e) {
    console.error("[installation] :", e);
    erreur = true;
  }

  const faits = etapes.filter((e) => e.fait).length;
  const total = etapes.length;
  const pct = total > 0 ? Math.round((faits / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titre="Assistant d'installation"
        description="Suivez la mise en route de la plateforme étape par étape."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">{"Impossible de calculer l'état d'installation."}</p>
        </Card>
      ) : (
        <>
          {/* Progression */}
          <Card className="border-forest-200 bg-gradient-to-br from-forest-800 to-forest-950 text-cream-50">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300">
                <Rocket size={22} />
              </span>
              <div className="flex-1">
                <p className="font-display text-lg font-bold">
                  {pct === 100 ? "Plateforme prête 🎉" : "Mise en route en cours"}
                </p>
                <p className="text-sm text-cream-200/80">
                  {faits} / {total} étapes terminées.
                </p>
              </div>
              <span className="font-display text-2xl font-bold text-gold-300">{pct}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream-50/15">
              <div className="h-full rounded-full bg-gold-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </Card>

          {/* Étapes */}
          <Card className="p-0">
            <ul className="divide-y divide-cream-100">
              {etapes.map((e) => (
                <li key={e.titre} className="flex items-start gap-3 px-5 py-4">
                  {e.fait ? (
                    <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-forest-600" />
                  ) : (
                    <Circle size={20} className="mt-0.5 shrink-0 text-ink-700/25" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${e.fait ? "text-forest-900" : "text-ink-900"}`}>{e.titre}</p>
                    <p className="text-xs text-ink-700/65">{e.description}</p>
                  </div>
                  {!e.fait && e.lien && (
                    <Link
                      href={e.lien}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
                    >
                      {e.lienLibelle} <ArrowRight size={13} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {/* Intégrations */}
          <Card>
            <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <PlugZap size={18} /> Intégrations externes
            </h2>
            <ul className="space-y-3">
              {integrations.map((i) => (
                <li key={i.titre} className="flex items-start gap-3">
                  {i.fait ? (
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-forest-600" />
                  ) : (
                    <Circle size={18} className="mt-0.5 shrink-0 text-gold-500" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-forest-900">
                      {i.titre}{" "}
                      <span className={`text-xs font-medium ${i.fait ? "text-forest-600" : "text-gold-700"}`}>
                        {i.fait ? "· configuré" : "· à brancher"}
                      </span>
                    </p>
                    <p className="text-xs text-ink-700/65">{i.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

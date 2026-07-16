import type { Metadata } from "next";
import Link from "next/link";
import { Stamp, MessageSquareText, Headset, Check, Crown, BadgePercent, Settings2 } from "lucide-react";
import { requireAccesComplet } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { etablissementsOperationnels } from "@/lib/etablissements/operationnels";
import { PageHeader, Card } from "@/components/app/ui";
import { formaterFcfa, SMS_FCFA_PAR_ELEVE } from "@/lib/premium/formules";
import { estHabiliteRabais } from "@/lib/premium/rabais";
import { OffrePremium, type CodeVue } from "./components";
import { GenererCodeForm, DemandesPromo, HabilitesRabaisForm, type DemandeVue, type CodeInstruction } from "./admin-promo";

export const metadata: Metadata = { title: "Académie Premium" };
export const dynamic = "force-dynamic";

const ROLES_SOUSCRIPTION = ["admin", "etablissements_admin", "chef_etablissement"];

const POURQUOI = [
  { Icone: Stamp, titre: "Bulletins officiels", detail: "Tampon + signature numérique" },
  { Icone: MessageSquareText, titre: "SMS automatiques", detail: "Alertes parents en temps réel" },
  { Icone: Headset, titre: "Support prioritaire", detail: "Assistance 7j/7" },
];
const INCLUS = [
  "Signature électronique sur les bulletins",
  "Tampon officiel sur les bulletins PDF",
  "Statistiques avancées multi-niveaux",
  "Support prioritaire 7j/7",
  "Mises à jour premium incluses",
];

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

export default async function AcademiePremiumPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const u = await requireAccesComplet();
  const sp = await searchParams;
  const estAdmin = u.roleReel === "admin" && !u.apercuActif;
  const peutSouscrire = !u.apercuActif && ROLES_SOUSCRIPTION.includes(u.roleReel);
  // Rubrique « Réductions disponibles » + instruction des demandes : admin OU habilité exprès.
  const peutInstruire = await estHabiliteRabais(u);

  let codes: CodeVue[] = [];
  let etablissements: { id: string; nom: string }[] = [];
  let contexteEtabNom: string | null = null;
  let demandes: DemandeVue[] = [];
  let codesInstruction: CodeInstruction[] = [];
  let habilites = "";
  let codeInitial: { code: string; pourcentage: number; libelle: string } | null = null;
  let erreur = false;

  try {
    // Les codes actifs ne sont exposés qu'aux instructeurs (admin/habilités) — jamais aux autres.
    if (peutInstruire) {
      const liste = await prisma.codePromo.findMany({
        where: { actif: true },
        orderBy: [{ partenaire: "desc" }, { pourcentage: "desc" }],
        take: 12,
      });
      codes = liste.map((c) => ({ code: c.code, libelle: c.libelle, pourcentage: c.pourcentage, partenaire: c.partenaire }));
      codesInstruction = liste.map((c) => ({ code: c.code, libelle: c.libelle, pourcentage: c.pourcentage }));
    }

    // Lien de paiement d'un rabais accordé : « ?code=… » pré-applique le code (validé en base).
    const codeUrl = (sp.code ?? "").trim().toUpperCase();
    if (codeUrl) {
      const cp = await prisma.codePromo.findFirst({ where: { code: codeUrl, actif: true } });
      if (cp) codeInitial = { code: cp.code, pourcentage: cp.pourcentage, libelle: cp.libelle };
    }

    if (u.roleReel === "admin") {
      etablissements = await etablissementsOperationnels();
    } else if ((u.roleReel === "chef_etablissement" || u.roleReel === "etablissements_admin") && u.portee.etablissementId) {
      const etab = await prisma.etablissement.findUnique({ where: { id: u.portee.etablissementId }, select: { nom: true } });
      contexteEtabNom = etab?.nom ?? null;
    }

    if (peutInstruire) {
      const dem = await prisma.demandeCodePromo.findMany({
        where: { statut: "en_attente" },
        orderBy: { creeLe: "desc" },
        take: 30,
        include: { demandeur: { select: { prenoms: true, nom: true, email: true } } },
      });
      demandes = dem.map((d) => ({
        id: d.id,
        demandeurNom: nomComplet(d.demandeur),
        etablissementNom: d.etablissementNom,
        motif: d.motif,
        tauxDemande: d.tauxDemande,
        date: new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(d.creeLe),
      }));
    }
    if (estAdmin) {
      const cfg = await prisma.configuration.findUnique({ where: { id: "global" }, select: { emailsHabilitesRabais: true } });
      habilites = cfg?.emailsHabilitesRabais ?? "";
    }
  } catch (e) {
    console.error("[premium] page :", e);
    erreur = true;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titre="Académie Premium"
        description="Souscrivez à l'offre Premium : bulletins officiels, alertes SMS, support prioritaire."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger l&apos;offre Premium.</p>
        </Card>
      ) : (
        <>
          {/* Pourquoi passer Premium */}
          <Card className="border-forest-200 bg-gradient-to-br from-forest-800 to-forest-950 text-cream-50">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Crown size={20} className="text-gold-300" /> Pourquoi passer Premium ?
            </h2>
            <p className="mt-1 text-sm text-cream-200/80">
              Bulletins officiels signés et tamponnés, notifications SMS automatiques, statistiques
              avancées et support prioritaire.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {POURQUOI.map((p) => (
                <div key={p.titre} className="rounded-xl bg-cream-50/10 p-3">
                  <p.Icone size={18} className="text-gold-300" />
                  <p className="mt-1.5 text-sm font-semibold">{p.titre}</p>
                  <p className="text-xs text-cream-200/70">{p.detail}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Inclus */}
          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Inclus dans toutes les formules</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {INCLUS.map((i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-ink-900">
                  <Check size={15} className="shrink-0 text-forest-600" /> {i}
                </li>
              ))}
            </ul>
          </Card>

          {/* Alertes SMS */}
          <Card className="border-gold-200 bg-gold-50/50">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <MessageSquareText size={18} className="text-gold-700" /> Alertes SMS automatiques aux parents
            </h2>
            <p className="mt-1 text-sm text-ink-700/75">
              Informer les parents en temps réel : absences, notes, convocations. Offre souscrite
              séparément, par élève et par année scolaire.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-forest-800">
                {formaterFcfa(SMS_FCFA_PAR_ELEVE)} / élève / an
              </span>
              <span className="rounded-full border border-cream-300 bg-white px-2.5 py-1 text-ink-700/70">Réduction multi-enfants</span>
              <span className="rounded-full border border-cream-300 bg-white px-2.5 py-1 text-ink-700/70">Souscription par les parents</span>
            </div>
          </Card>

          {/* Offre : formules + réductions (admin/habilités) ou demande de rabais + paiement */}
          <Card>
            <OffrePremium
              peutSouscrire={peutSouscrire}
              etablissements={etablissements}
              contexteEtabNom={contexteEtabNom}
              codes={codes}
              peutVoirReductions={peutInstruire}
              codeInitial={codeInitial}
            />
          </Card>

          {/* Instruction des demandes de rabais (admin système + utilisateurs habilités) */}
          {peutInstruire && (
            <Card>
              <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
                <BadgePercent size={18} /> Demandes de rabais en attente
              </h2>
              <DemandesPromo demandes={demandes} codes={codesInstruction} />
            </Card>
          )}

          {/* Administration des codes promo + habilitations (admin système) */}
          {estAdmin && (
            <Card>
              <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-forest-900">
                <Settings2 size={18} /> Administration des codes promo
              </h2>
              <GenererCodeForm />
              <div className="mt-5 border-t border-cream-100 pt-4">
                <HabilitesRabaisForm emails={habilites} />
              </div>
            </Card>
          )}

          {/* Partenaires */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-forest-200 bg-forest-50/40">
              <p className="text-sm font-semibold text-forest-900">Allocations IZEN</p>
              <p className="mt-1 text-xs text-ink-700/70">
                Les bénéficiaires des allocations de la Fondation IZEN profitent de réductions
                spéciales : 50 % (code IZEN50) ou 100 % (code IZEN100). Contactez le support pour
                vérifier votre éligibilité.
              </p>
            </Card>
            <Card className="border-gold-200 bg-gold-50/40">
              <p className="text-sm font-semibold text-forest-900">Taux préférentiel E-School EduWeb</p>
              <p className="mt-1 text-xs text-ink-700/70">
                Les établissements abonnés à E-School EduWeb bénéficient de 20 % de réduction sur
                toutes les formules. Utilisez le code E-SCHOOL2025.
              </p>
            </Card>
          </div>

          <div className="flex justify-center pt-2">
            <Link href="/app" className="text-sm font-semibold text-forest-700 hover:text-forest-900">
              ← Retour au tableau de bord
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

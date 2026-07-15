import Link from "next/link";
import { CalendarX2, ClipboardCheck, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/app/ui";
import { statsAbsences } from "@/lib/absences/stats";

const ROLES_DEMANDEUR = ["enseignant", "educateur", "inspecteur_orientation", "chef_etablissement", "adjoint_chef_etablissement"];

/**
 * Widget du TABLEAU DE BORD : synthèse des absences/rattrapages du demandeur + rappel des
 * demandes à valider pour le Chef/ACE. Rendu uniquement pour les rôles concernés (sinon null).
 */
export async function WidgetAbsences({
  userId,
  roleActif,
  etablissementId,
}: {
  userId: string;
  roleActif: string;
  etablissementId: string | null;
}) {
  if (!etablissementId || !ROLES_DEMANDEUR.includes(roleActif)) return null;
  const estDirection = roleActif === "chef_etablissement" || roleActif === "adjoint_chef_etablissement";

  const [stats, aValider] = await Promise.all([
    statsAbsences({ demandeurId: userId }).catch(() => null),
    estDirection
      ? prisma.demandeAbsence.count({ where: { statut: "en_attente", etablissementId, demandeurId: { not: userId } } }).catch(() => 0)
      : Promise.resolve(0),
  ]);
  if (!stats) return null;

  const chiffres = [
    { libelle: "Demandes", valeur: stats.total },
    { libelle: "Jours d'absence", valeur: stats.joursAbsence },
    { libelle: "Séances à rattraper", valeur: stats.seancesARattraper },
  ];

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <CalendarX2 size={18} className="text-forest-600" /> Mes autorisations d&apos;absence
        </h3>
        <Link href="/app/vie-scolaire/absences" className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-900">
          Ouvrir <ArrowUpRight size={13} />
        </Link>
      </div>
      {aValider > 0 && (
        <Link
          href="/app/vie-scolaire/absences"
          className="mb-3 flex items-center gap-2 rounded-xl border border-gold-300 bg-gold-50 px-3 py-2 text-sm font-medium text-gold-800 hover:bg-gold-100"
        >
          <ClipboardCheck size={15} /> {aValider} demande(s) à valider
        </Link>
      )}
      <div className="grid grid-cols-3 gap-2">
        {chiffres.map((c) => (
          <div key={c.libelle} className="rounded-xl border border-cream-200 bg-white p-2.5 text-center">
            <span className="block font-display text-lg font-bold text-forest-900">{c.valeur.toLocaleString("fr-FR")}</span>
            <span className="text-[0.68rem] leading-tight text-ink-700/60">{c.libelle}</span>
          </div>
        ))}
      </div>
      <Link
        href="/app/vie-scolaire/absences"
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-forest-700"
      >
        <CalendarX2 size={14} /> Demander une absence
      </Link>
    </Card>
  );
}

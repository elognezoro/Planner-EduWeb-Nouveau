import type { Metadata } from "next";
import { Target, TrendingUp, Award } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import { ChartBarVertical } from "../etablissement/charts";

export const metadata: Metadata = { title: "Efficacité pédagogique" };
export const dynamic = "force-dynamic";

const BASE = "/app/statistiques/efficacite-pedagogique";
const ROLES_CHOIX = ["admin", "inspecteur", "drena"];

export default async function EfficacitePage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const u = await requireRole(["admin", "chef_etablissement", "inspecteur", "drena"]);
  const sp = await searchParams;
  const peutChoisir = ROLES_CHOIX.includes(u.roleReel);

  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  let erreur = false;

  try {
    if (peutChoisir) {
      etablissements = await prisma.etablissement.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } });
      etabId = sp.etab && etablissements.some((e) => e.id === sp.etab) ? sp.etab : null;
    } else {
      etabId = u.portee.etablissementId;
    }
  } catch {
    erreur = true;
  }

  if (!erreur && !etabId) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader titre="Efficacité pédagogique" description="Choisissez un établissement." />
        {peutChoisir ? (
          <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={null} />
        ) : (
          <Card>
            <p className="text-sm text-ink-700/70">Aucun établissement rattaché à votre périmètre.</p>
          </Card>
        )}
      </div>
    );
  }

  let moyenneGenerale: number | null = null;
  let tauxReussite = 0;
  let nbEleves = 0;
  let parNiveau: { label: string; valeur: number; ordre: number }[] = [];

  if (!erreur && etabId) {
    try {
      const notes = await prisma.note.findMany({
        where: { classe: { etablissementId: etabId } },
        select: { eleveId: true, valeur: true, sur: true, classe: { select: { niveau: { select: { nom: true, ordre: true } } } } },
      });
      let sommeGlobale = 0;
      let nGlobale = 0;
      const parEleve = new Map<string, { somme: number; n: number; niveau: string; ordre: number }>();
      for (const note of notes) {
        if (!note.sur) continue;
        const v = (note.valeur / note.sur) * 20;
        sommeGlobale += v;
        nGlobale += 1;
        const e = parEleve.get(note.eleveId) ?? { somme: 0, n: 0, niveau: note.classe.niveau.nom, ordre: note.classe.niveau.ordre };
        e.somme += v;
        e.n += 1;
        parEleve.set(note.eleveId, e);
      }
      moyenneGenerale = nGlobale > 0 ? Math.round((sommeGlobale / nGlobale) * 10) / 10 : null;

      const parNiv = new Map<string, { ordre: number; total: number; reussite: number }>();
      let totalEleves = 0;
      let totalReussite = 0;
      for (const e of parEleve.values()) {
        const moy = e.somme / e.n;
        const o = parNiv.get(e.niveau) ?? { ordre: e.ordre, total: 0, reussite: 0 };
        o.total += 1;
        if (moy >= 10) o.reussite += 1;
        parNiv.set(e.niveau, o);
        totalEleves += 1;
        if (moy >= 10) totalReussite += 1;
      }
      nbEleves = totalEleves;
      tauxReussite = totalEleves > 0 ? Math.round((totalReussite / totalEleves) * 100) : 0;
      parNiveau = [...parNiv.entries()]
        .map(([label, v]) => ({ label, valeur: v.total > 0 ? Math.round((v.reussite / v.total) * 100) : 0, ordre: v.ordre }))
        .sort((a, b) => a.ordre - b.ordre);
    } catch {
      erreur = true;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Efficacité pédagogique"
        description="Taux de réussite (moyenne générale ≥ 10/20) et moyenne d'établissement."
      />

      {u.roleReel !== "chef_etablissement" && etabId && (
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={etabId} />
      )}

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les statistiques.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard libelle="Moyenne générale /20" valeur={moyenneGenerale ?? "—"} icone={<TrendingUp size={22} />} />
            <StatCard libelle="Taux de réussite" valeur={`${tauxReussite}%`} icone={<Target size={22} />} ton="gold" />
            <StatCard libelle="Élèves évalués" valeur={nbEleves} icone={<Award size={22} />} />
          </div>

          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-forest-900">Taux de réussite par niveau (%)</h2>
            <ChartBarVertical data={parNiveau.map(({ label, valeur }) => ({ label, valeur }))} nomSerie="Réussite %" couleur="#246a48" vide="Aucune note pour calculer l'efficacité." />
          </Card>
        </>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { FileSpreadsheet } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";
import { Convertisseur } from "./converter";

export const metadata: Metadata = { title: "Convertisseur CSV" };
export const dynamic = "force-dynamic";

export default async function ConvertisseurCsvPage() {
  await requireRole(["admin"]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Convertisseur CSV"
        description="Déposez une liste (Word ou Excel) et obtenez un fichier CSV au format d'import Moodle, avec les noms mis en forme et des colonnes personnalisables."
      />
      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-forest-900">
            <FileSpreadsheet size={20} /> Liste (Word / Excel) → CSV Moodle
          </h2>
        </div>
        <p className="mb-5 text-base leading-relaxed text-ink-700/70">
          Le fichier peut contenir les <strong>NOM et Prénoms dans une seule colonne</strong> ou dans
          <strong> deux colonnes séparées</strong>. En sortie : les <strong>NOM en MAJUSCULES</strong>, les
          <strong> Prénoms avec une majuscule initiale</strong> par composante, et les colonnes Moodle
          (<code className="text-sm">username, password, firstname, lastname, email, course1, role1, cohort1</code>)
          — que vous complétez et étendez ci-dessous. Renseignez notamment le
          <strong> nom de l&apos;établissement</strong>, la <strong>classe pédagogique</strong> et
          l&apos;<strong>année scolaire</strong>.
        </p>
        <Convertisseur />
      </Card>
    </div>
  );
}

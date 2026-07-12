import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Wand2, FileText, ListChecks, Settings2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";
import { UploaderCours } from "./uploader";

export const metadata: Metadata = { title: "Créer un cours depuis un fichier — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const aIA = !!process.env.ANTHROPIC_API_KEY;

export default async function ImportCoursPage() {
  await requireRole(["admin"]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`${BASE}/gestion`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Retour à la gestion</Link>
      <PageHeader
        titre="Créer un cours depuis un fichier"
        description="Déposez un document de cours : la plateforme le transforme automatiquement en cours interactif (leçons, quiz), en brouillon, que vous ajustez ensuite."
      />

      <Card className="space-y-4">
        <UploaderCours />
        <div className="grid gap-2 sm:grid-cols-3">
          <p className="inline-flex items-start gap-2 text-xs text-ink-700/65"><FileText size={15} className="mt-0.5 shrink-0 text-forest-600" /> Découpage automatique en leçons</p>
          <p className="inline-flex items-start gap-2 text-xs text-ink-700/65"><ListChecks size={15} className="mt-0.5 shrink-0 text-forest-600" /> Quiz de validation généré</p>
          <p className="inline-flex items-start gap-2 text-xs text-ink-700/65"><Settings2 size={15} className="mt-0.5 shrink-0 text-forest-600" /> Paramètres par défaut modifiables</p>
        </div>
      </Card>

      <Card className="bg-cream-50">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-forest-900"><Wand2 size={16} className="text-forest-600" /> Comment ça marche</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-700/75">
          <li>Le texte du fichier est extrait puis {aIA ? "structuré par l'IA" : "découpé par titres"} en leçons et en un court quiz.</li>
          <li>Un cours est créé <strong>en brouillon</strong> avec un jeu de paramètres par défaut (niveau, seuil de validation 100 %).</li>
          <li>Vous êtes redirigé vers l&apos;édition du cours pour ajuster titres, contenus, quiz, catégorie, public cible et publier.</li>
        </ol>
        {!aIA && <p className="mt-2 text-xs text-ink-700/55">Astuce : sans clé IA configurée, le découpage se fait par titres (« # », « ## ») — structurez votre document avec des titres pour de meilleures leçons.</p>}
      </Card>
    </div>
  );
}

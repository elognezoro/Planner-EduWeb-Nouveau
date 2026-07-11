import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";
import { ImportClient } from "./import-client";

export const metadata: Metadata = { title: "Import de contenus — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

export default async function ImportPage() {
  await requireRole(["admin"]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${BASE}/gestion`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Gestion du contenu</Link>
      <PageHeader titre="Import de contenus" description="Créez plusieurs cours et leçons d'un coup à partir d'un fichier CSV. Un aperçu vous montre ce qui sera importé avant validation." />
      <Card>
        <ImportClient />
      </Card>
    </div>
  );
}

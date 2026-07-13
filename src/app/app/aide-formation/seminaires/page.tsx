import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/app/ui";
import { SEMINAIRES_REF } from "@/lib/seminaires";
import { ConfigSeminaireClient, type ConfigSem } from "./config-client";

export const metadata: Metadata = { title: "Paramétrage des séminaires" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

export default async function SeminairesConfigPage() {
  await requireRole(["admin"]);

  const configs = await prisma.configSeminaire.findMany({ where: { slug: { in: SEMINAIRES_REF.map((s) => s.slug) } } });
  const parSlug = new Map(configs.map((c) => [c.slug, c]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Paramétrage des séminaires"
        description="Déposez l'image de couverture de chaque séminaire et configurez le certificat (logo, formateur, signataire, cachet, QR, modèle). Ces réglages alimentent les cartes des séminaires et le pré-remplissage des certificats."
        action={
          <Link href={`${BASE}/formations`} className="inline-flex items-center gap-2 rounded-full border border-cream-200 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:border-forest-300">
            <ArrowLeft className="h-4 w-4" /> Formations
          </Link>
        }
      />

      <div className="flex items-start gap-3 rounded-2xl border border-gold-200 bg-gold-50/50 p-4">
        <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-gold-700" />
        <p className="text-sm text-ink-700/80">L&apos;image de couverture s&apos;affiche en bannière sur la carte du séminaire dans « Formations ». Le paramétrage du certificat est repris automatiquement lors de la délivrance d&apos;un certificat sur la page du séminaire.</p>
      </div>

      <div className="space-y-5">
        {SEMINAIRES_REF.map((s) => (
          <ConfigSeminaireClient key={s.slug} slug={s.slug} titre={s.titre} url={s.url} config={(parSlug.get(s.slug) ?? null) as ConfigSem} />
        ))}
      </div>
    </div>
  );
}

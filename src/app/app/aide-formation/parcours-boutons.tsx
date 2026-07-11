"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Route, ArrowRight, LogOut } from "lucide-react";
import { basculerInscriptionParcours } from "@/app/app/aide-formation/parcours-actions";

const BASE = "/app/aide-formation";

export function BoutonInscriptionParcours({ parcoursId, slug, inscrit }: { parcoursId: string; slug: string; inscrit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const basculer = (naviguer: boolean) =>
    start(async () => {
      const r = await basculerInscriptionParcours(parcoursId);
      if (r.ok && naviguer) router.push(`${BASE}/parcours/${slug}`);
      else router.refresh();
    });

  if (inscrit) {
    return (
      <div className="flex items-center gap-2">
        <Link href={`${BASE}/parcours/${slug}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-600 px-4 text-sm font-semibold text-white shadow-soft hover:bg-forest-700">
          Continuer <ArrowRight size={15} />
        </Link>
        <button type="button" disabled={pending} onClick={() => basculer(false)} title="Se désinscrire"
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-cream-300 px-3 text-xs font-semibold text-ink-700/70 hover:bg-cream-100 disabled:opacity-40">
          <LogOut size={14} />
        </button>
      </div>
    );
  }
  return (
    <button type="button" disabled={pending} onClick={() => basculer(true)}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-forest-700 disabled:opacity-50">
      <Route size={15} /> {pending ? "…" : "S'inscrire au parcours"}
    </button>
  );
}

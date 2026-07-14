"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Crown } from "lucide-react";
import { CONTACT_WHATSAPP, LIEN_ACADEMIE_PREMIUM } from "@/lib/premium/essai";

function deux(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Bandeau rouge permanent affiché en haut de TOUTES les pages d'un utilisateur en période
 * d'essai : compte à rebours vivant jusqu'à `finLe`, contact officiel WhatsApp et CTA vers
 * l'Académie Prémium. Le rendu n'apparaît qu'après le montage client (pas de contenu horaire
 * côté serveur → aucune divergence d'hydratation). L'échéance réelle est appliquée côté serveur.
 */
export function BandeauEssai({ finLe }: { finLe: string | null }) {
  const finMs = finLe ? new Date(finLe).getTime() : 0;
  const [maintenant, setMaintenant] = useState<number | null>(null);

  useEffect(() => {
    if (!finMs) return;
    setMaintenant(Date.now());
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finMs]);

  if (!finMs || maintenant === null || finMs <= maintenant) return null;

  const ms = finMs - maintenant;
  const j = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 border-b border-red-700/40 bg-gradient-to-r from-red-600 to-red-500 px-4 py-2.5 text-sm text-white sm:flex-row sm:items-center sm:justify-between sm:px-6 print:hidden"
    >
      <p className="flex items-start gap-2">
        <AlertTriangle size={17} className="mt-0.5 shrink-0" />
        <span>
          <strong>Période d&apos;essai</strong> — temps restant{" "}
          <strong className="tabular-nums">
            {j} j {deux(h)}:{deux(m)}:{deux(s)}
          </strong>
          . À l&apos;échéance, l&apos;accès complet requiert un abonnement pour l&apos;année
          académique en cours.
          <span className="block opacity-90">Contact WhatsApp : {CONTACT_WHATSAPP}</span>
        </span>
      </p>
      <Link
        href={LIEN_ACADEMIE_PREMIUM}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
      >
        <Crown size={13} /> Passer à l&apos;Académie Prémium
      </Link>
    </div>
  );
}

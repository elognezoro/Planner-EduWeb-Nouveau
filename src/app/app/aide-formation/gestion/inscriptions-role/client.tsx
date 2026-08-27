"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserMinus, Loader2 } from "lucide-react";
import { inscrireRole, desinscrireRole } from "./actions";

export function BoutonEnroler({ coursId, utilisateurId, role }: { coursId: string; utilisateurId: string; role: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await inscrireRole(coursId, utilisateurId, role); router.refresh(); })}
      className="inline-flex items-center gap-1.5 rounded-full bg-forest-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-700 disabled:opacity-50"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Inscrire
    </button>
  );
}

export function BoutonDesinscrire({ coursId, utilisateurId }: { coursId: string; utilisateurId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Désinscrire ce participant du cours ?")) return;
        start(async () => { await desinscrireRole(coursId, utilisateurId); router.refresh(); });
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />} Désinscrire
    </button>
  );
}

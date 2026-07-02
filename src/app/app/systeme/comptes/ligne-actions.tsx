"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff, Eye, ScanEye, Pencil, Trash2, Loader2, Check, X } from "lucide-react";
import { changerStatut, supprimerCompte } from "./[id]/actions";
import { voirCommeUtilisateur } from "../apercu/actions";

/** Icône d'action compacte (lien ou bouton) avec info-bulle native. */
function iconeClasse(ton: "vert" | "bleu" | "rouge" | "neutre") {
  const tons: Record<string, string> = {
    vert: "text-forest-600 hover:bg-forest-50",
    bleu: "text-indigo-600 hover:bg-indigo-50",
    rouge: "text-red-600 hover:bg-red-50",
    neutre: "text-ink-700/60 hover:bg-cream-100",
  };
  return `inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${tons[ton]}`;
}

export function LigneActions({
  utilisateurId,
  statut,
  estAdmin,
  estSoi,
  peutIncarner,
}: {
  utilisateurId: string;
  statut: string;
  estAdmin: boolean;
  estSoi: boolean;
  peutIncarner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmeSuppr, setConfirmeSuppr] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const fiche = `/app/systeme/comptes/${utilisateurId}`;
  const actif = statut === "actif";
  const protege = estAdmin || estSoi;

  function basculerStatut() {
    if (protege || pending) return;
    setErreur(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("utilisateurId", utilisateurId);
      fd.set("statut", actif ? "suspendu" : "actif");
      const r = await changerStatut({ ok: false }, fd);
      if (!r.ok) setErreur(r.message ?? "Refusé.");
      else router.refresh();
    });
  }

  function supprimer() {
    if (protege || pending) return;
    setErreur(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("utilisateurId", utilisateurId);
      const r = await supprimerCompte({ ok: false }, fd);
      if (!r.ok) setErreur(r.message ?? "Refusé.");
      else router.refresh();
      setConfirmeSuppr(false);
    });
  }

  if (confirmeSuppr) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-xs font-medium text-red-700">Supprimer ?</span>
        <button type="button" onClick={supprimer} disabled={pending} title="Confirmer la suppression" className={iconeClasse("rouge")}>
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
        </button>
        <button type="button" onClick={() => setConfirmeSuppr(false)} title="Annuler" className={iconeClasse("neutre")}>
          <X size={15} />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      {erreur && <span className="mr-1 max-w-[10rem] truncate text-xs text-red-600" title={erreur}>{erreur}</span>}
      <button
        type="button"
        onClick={basculerStatut}
        disabled={protege || pending}
        title={protege ? "Compte protégé" : actif ? "Suspendre le compte" : "Activer le compte"}
        className={`${iconeClasse(actif ? "vert" : "rouge")} disabled:cursor-not-allowed disabled:opacity-35`}
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : actif ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}
      </button>
      <Link href={fiche} title="Voir la fiche" className={iconeClasse("neutre")}>
        <Eye size={15} />
      </Link>
      {peutIncarner && !protege ? (
        <form action={voirCommeUtilisateur} className="inline-flex">
          <input type="hidden" name="utilisateurId" value={utilisateurId} />
          <button type="submit" title="Voir le site comme cet utilisateur (lecture seule)" className={iconeClasse("bleu")}>
            <ScanEye size={15} />
          </button>
        </form>
      ) : (
        <span title="Indisponible" className={`${iconeClasse("bleu")} cursor-not-allowed opacity-35`}>
          <ScanEye size={15} />
        </span>
      )}
      <Link href={fiche} title="Modifier (rôle, affectation, coordonnées…)" className={iconeClasse("neutre")}>
        <Pencil size={15} />
      </Link>
      <button
        type="button"
        onClick={() => setConfirmeSuppr(true)}
        disabled={protege}
        title={protege ? "Compte protégé" : "Supprimer le compte"}
        className={`${iconeClasse("rouge")} disabled:cursor-not-allowed disabled:opacity-35`}
      >
        <Trash2 size={15} />
      </button>
    </span>
  );
}

"use client";

/**
 * Onglet « Droits & délégations » (97-RBAC + 04-Profils) : octroi et révocation de
 * DÉLÉGATIONS de permissions Finance — réservé aux détenteurs de
 * « finance.delegations.gerer » (direction / admins). Fin obligatoire, expiration
 * automatique évaluée côté serveur à chaque vérification, révocation à confirmation
 * 2 clics (jamais de window.confirm — aperçus statiques).
 */

import { useActionState, useMemo, useState, useTransition } from "react";
import { Ban, Check, KeyRound, Loader2, ShieldCheck, X } from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, SubmitButton } from "@/components/ui/form";
import { ComboboxRecherche } from "@/components/app/combobox-recherche";
import type { EtatForm } from "@/lib/finances/actions";
import { accorderDelegation, revoquerDelegation } from "@/lib/finances/actions-delegations";
import {
  PERMISSIONS_FINANCE, type DelegationVue, type PersonnelVue,
} from "@/lib/finances/commun/permissions";
import { useApresSucces } from "./scolarite-onglets";

const INITIAL: EtatForm = { ok: false };

const LIBELLE_STATUT: Record<DelegationVue["statut"], { texte: string; classe: string }> = {
  active: { texte: "Active", classe: "bg-forest-100 text-forest-800" },
  a_venir: { texte: "À venir", classe: "bg-gold-100 text-gold-800" },
  expiree: { texte: "Expirée", classe: "bg-cream-200 text-ink-700/60" },
  revoquee: { texte: "Révoquée", classe: "bg-red-100 text-red-700" },
};

const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso));

export function OngletDroits({
  etablissementId, delegations, personnel, peutEcrire,
}: {
  etablissementId: string;
  delegations: DelegationVue[];
  personnel: PersonnelVue[];
  peutEcrire: boolean;
}) {
  const libellesPermissions = useMemo(
    () => new Map(PERMISSIONS_FINANCE.map((p) => [p.code as string, p.libelle])),
    [],
  );

  return (
    <div className="space-y-5">
      {peutEcrire && (
        <Card>
          <FormulaireDelegation etablissementId={etablissementId} personnel={personnel} />
        </Card>
      )}

      <Card>
        <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <ShieldCheck size={18} className="text-forest-600" /> Délégations accordées
          <span className="text-xs font-normal text-ink-700/55">({delegations.length})</span>
        </h2>
        <p className="mb-3 text-xs text-ink-700/60">
          Une délégation ajoute TEMPORAIREMENT des permissions du registre au bénéficiaire, dans
          cet établissement uniquement. L&apos;expiration est automatique à la date de fin ; la
          révocation prend effet immédiatement. Chaque octroi et chaque révocation sont inscrits
          au journal d&apos;audit financier.
        </p>
        {delegations.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune délégation pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {delegations.map((d) => (
              <li key={d.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-forest-900">
                      {d.beneficiaireNom}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${LIBELLE_STATUT[d.statut].classe}`}>
                        {LIBELLE_STATUT[d.statut].texte}
                      </span>
                    </p>
                    <p className="text-xs text-ink-700/60">
                      Du {dateFr(d.debut)} au {dateFr(d.fin)} · accordée par {d.accordeParNom} · {d.motif}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {d.permissions.map((p) => (
                        <span key={p} className="rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-medium text-forest-800">
                          {libellesPermissions.get(p) ?? p}
                        </span>
                      ))}
                    </p>
                  </div>
                  {peutEcrire && (d.statut === "active" || d.statut === "a_venir") && (
                    <BoutonRevoquer id={d.id} version={d.version} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FormulaireDelegation({ etablissementId, personnel }: { etablissementId: string; personnel: PersonnelVue[] }) {
  const [etat, action] = useActionState(accorderDelegation, INITIAL);
  const [resetKey, setResetKey] = useState(0);
  useApresSucces(etat, () => setResetKey((k) => k + 1));

  const options = useMemo(
    () => personnel.map((p) => ({ value: p.id, label: `${p.nom} — ${p.role}` })),
    [personnel],
  );
  const aujourdHui = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <form key={resetKey} action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <KeyRound size={18} className="text-forest-600" /> Accorder une délégation
      </h2>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Label>Bénéficiaire (personnel de l&apos;établissement)</Label>
          <ComboboxRecherche
            name="beneficiaireId"
            options={options}
            placeholder="Choisir un membre du personnel…"
            rechercheLabel="Rechercher (nom, rôle)…"
          />
        </div>
        <div>
          <Label htmlFor="deleg-debut">Début</Label>
          <Input id="deleg-debut" name="debut" type="date" defaultValue={aujourdHui} />
        </div>
        <div>
          <Label htmlFor="deleg-fin">Fin (obligatoire)</Label>
          <Input id="deleg-fin" name="fin" type="date" required />
        </div>
        <div>
          <Label htmlFor="deleg-motif">Motif (obligatoire)</Label>
          <Input id="deleg-motif" name="motif" required maxLength={300} placeholder="Ex. : intérim du gestionnaire" />
        </div>
      </div>

      <div>
        <Label>Permissions déléguées (sous-ensemble du registre)</Label>
        <div className="mt-1 grid gap-1.5 rounded-2xl border border-cream-200 bg-cream-50/50 p-3 sm:grid-cols-2">
          {PERMISSIONS_FINANCE.map((p) => (
            <label key={p.code} className="flex cursor-pointer items-start gap-2 text-sm text-ink-800">
              <input type="checkbox" name="permissions" value={p.code} className="mt-1 accent-forest-700" />
              <span>
                {p.libelle}
                <span className="block font-mono text-[11px] text-ink-700/45">{p.code}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <SubmitButton className="w-auto px-6">
        <KeyRound size={15} /> Accorder la délégation
      </SubmitButton>
    </form>
  );
}

function BoutonRevoquer({ id, version }: { id: string; version: number }) {
  const [pending, startTransition] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function revoquer() {
    setErreur(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("version", String(version));
      const r = await revoquerDelegation(INITIAL, fd);
      setConfirmer(false);
      if (!r.ok) setErreur(r.message ?? "Refusé.");
    });
  }

  if (!confirmer) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button" onClick={() => setConfirmer(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          <Ban size={13} /> Révoquer
        </button>
        {erreur && <span className="text-xs text-red-600">{erreur}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs font-medium text-red-700">Révoquer cette délégation ?</span>
      <button
        type="button" onClick={revoquer} disabled={pending}
        className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Oui
      </button>
      <button
        type="button" onClick={() => setConfirmer(false)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-cream-300 text-ink-700/60 hover:bg-cream-100"
      >
        <X size={12} />
      </button>
    </span>
  );
}

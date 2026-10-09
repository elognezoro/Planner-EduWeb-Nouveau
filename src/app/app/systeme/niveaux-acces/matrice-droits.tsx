"use client";

import { useState, useTransition } from "react";
import { Check, Minus, RotateCcw, CheckCircle2, Loader2, Lock } from "lucide-react";
import { ROLES_ORDONNES, type RoleId } from "@/lib/rbac";
import { appliquerTerme } from "@/lib/cafop-terme";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { basculerPermission, reinitialiserPermissions } from "./actions";

export interface LigneDroit {
  id: string;
  libelle: string;
  verrouille: boolean;
  acces: Record<RoleId, boolean>;
  surcharges: Record<RoleId, boolean>;
}

export interface SectionDroits {
  id: string;
  libelle: string;
  items: LigneDroit[];
}

const LIBELLE_COURT: Record<RoleId, string> = {
  admin: "Administrateur",
  senec: "SENEC",
  sedec: "SEDEC",
  etablissements_admin: "Admin Étab.",
  cafop_admin: "Admin CAFOP",
  apfc_admin: "Admin APFC",
  drena: "DRENA",
  inspecteur: "Inspecteur",
  inspecteur_orientation: "Insp. Orient.",
  conseiller_pedagogique: "Conseiller",
  chef_antenne: "Chef d'antenne",
  chef_etablissement: "Chef d'étab.",
  adjoint_chef_etablissement: "ACE",
  enseignant: "Enseignant",
  educateur: "Éducateur",
  parent: "Parent",
  eleve: "Élève",
  superviseur_international: "Superv. Int'l",
  super_admin_cafop: "Super Adm. CAFOP",
  super_admin_etablissements: "Super Adm. Étab.",
  super_admin_apfc: "Super Adm. APFC",
  representant_pays: "Représ.-Pays",
  delc: "DELC",
  adc: "ADC",
  maitre_application: "Maître d'appl.",
  econome: "Économe",
  directeur_etudes: "Dir. Études",
  gestionnaire_financier: "Gest. Financier",
  comptable: "Comptable",
  caissier: "Caissier",
  magasinier: "Magasinier",
  auditeur: "Auditeur",
  commissaire_comptes: "Comm. Comptes",
};

function Cellule({
  accorde,
  verrouille,
  enCours,
  onClick,
}: {
  accorde: boolean;
  verrouille: boolean;
  enCours: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={verrouille || enCours}
      onClick={onClick}
      title={verrouille ? "Verrouillé" : accorde ? "Cliquer pour retirer" : "Cliquer pour accorder"}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-all ${
        accorde
          ? "bg-forest-600 text-white shadow-sm"
          : "bg-cream-200 text-ink-700/40"
      } ${verrouille ? "cursor-not-allowed opacity-70" : "hover:scale-110 hover:shadow"} ${enCours ? "animate-pulse" : ""}`}
    >
      {accorde ? <Check size={14} strokeWidth={3} /> : <Minus size={13} />}
    </button>
  );
}

export function MatriceDroits({
  sections,
  editable,
  terme = "CAFOP",
  termeApfc = "APFC",
}: {
  sections: SectionDroits[];
  editable: boolean;
  terme?: string;
  termeApfc?: string;
}) {
  const [grille, setGrille] = useState(sections);
  const T = (s: string) => appliquerTermeApfc(appliquerTerme(s, terme), termeApfc);
  const [modifs, setModifs] = useState(0);
  const [enCours, setEnCours] = useState<string | null>(null); // `${itemId}:${role}`
  const [message, setMessage] = useState<string | null>(null);
  const [confirmeReset, setConfirmeReset] = useState(false);
  const [pending, startTransition] = useTransition();
  // Téléphone : la matrice (34 rôles en colonnes, 1 080 px) devient une vue PAR RÔLE — on choisit
  // le rôle, puis chaque permission est une rangée « libellé + interrupteur ». Même état, même
  // bascule (basculer) ; l'ordinateur et l'impression gardent la table.
  const [roleMobile, setRoleMobile] = useState<RoleId>(
    () => (ROLES_ORDONNES.find((r) => r.id !== "admin")?.id ?? ROLES_ORDONNES[0].id) as RoleId,
  );

  function poserValeur(itemId: string, role: RoleId, valeur: boolean) {
    setGrille((g) =>
      g.map((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.id === itemId ? { ...i, acces: { ...i.acces, [role]: valeur } } : i,
        ),
      })),
    );
  }

  function basculer(item: LigneDroit, role: RoleId) {
    if (!editable || item.verrouille || role === "admin") return;
    const cle = `${item.id}:${role}`;
    const avant = item.acces[role];
    setEnCours(cle);
    setMessage(null);
    poserValeur(item.id, role, !avant); // optimiste
    startTransition(async () => {
      const r = await basculerPermission(item.id, role);
      if (!r.ok) {
        poserValeur(item.id, role, avant); // annulation
        setMessage(r.message ?? "Modification refusée.");
      } else {
        setModifs((n) => n + 1);
      }
      setEnCours(null);
    });
  }

  function reinitialiser() {
    setMessage(null);
    startTransition(async () => {
      const r = await reinitialiserPermissions();
      if (r.ok) {
        // Retour aux défauts : recharger pour relire la grille serveur.
        window.location.reload();
      } else {
        setMessage(r.message ?? "Réinitialisation refusée.");
      }
    });
    setConfirmeReset(false);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-forest-900">Matrice des droits</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-700/65">
            {editable
              ? "Cliquez sur une cellule pour activer ou désactiver une permission — la modification est enregistrée et appliquée immédiatement à tous les utilisateurs du rôle concerné."
              : "Matrice en lecture seule — seul l'administrateur système peut la modifier."}
          </p>
        </div>
        <div className="flex items-center gap-2 mobile:w-full mobile:flex-wrap">
          {modifs > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-forest-50 px-3 py-1.5 text-xs font-medium text-forest-800">
              <CheckCircle2 size={13} /> {modifs} modification{modifs > 1 ? "s" : ""} enregistrée{modifs > 1 ? "s" : ""}
            </span>
          )}
          {editable && !confirmeReset && (
            <button
              type="button"
              onClick={() => setConfirmeReset(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 text-xs font-semibold text-ink-700/75 hover:bg-cream-50 mobile:h-11 mobile:text-sm"
            >
              <RotateCcw size={13} /> Réinitialiser
            </button>
          )}
          {editable && confirmeReset && (
            <span className="flex items-center gap-2 mobile:w-full mobile:flex-col mobile:items-stretch">
              <button
                type="button"
                onClick={reinitialiser}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 mobile:h-auto mobile:min-h-11 mobile:justify-center mobile:py-2 mobile:text-sm"
              >
                {pending && <Loader2 size={12} className="animate-spin" />} Confirmer le retour aux défauts
              </button>
              <button
                type="button"
                onClick={() => setConfirmeReset(false)}
                className="inline-flex h-9 items-center rounded-full border border-cream-300 px-3 text-xs font-medium text-ink-700/70 hover:bg-cream-50 mobile:h-auto mobile:min-h-11 mobile:justify-center mobile:text-sm"
              >
                Annuler
              </button>
            </span>
          )}
        </div>
      </div>

      {message && (
        <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{message}</p>
      )}

      {/* Téléphone : vue par rôle (la table ci-dessous est masquée sous 64rem). */}
      <div className="lg:hidden print:hidden">
        <VueParRole
          grille={grille}
          role={roleMobile}
          onRole={setRoleMobile}
          editable={editable}
          enCours={enCours}
          onBasculer={basculer}
          T={T}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-cream-200 mobile:hidden">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-200 bg-cream-50/70 text-[0.65rem] uppercase tracking-wide text-ink-700/55">
              <th className="sticky left-0 z-10 bg-cream-50 px-4 py-3 text-left font-semibold">Permission</th>
              {ROLES_ORDONNES.map((r) => (
                <th key={r.id} className="px-2 py-3 text-center font-semibold" title={T(r.libelle)}>
                  {T(LIBELLE_COURT[r.id])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grille.map((section) => (
              <SectionLignes
                key={section.id}
                section={section}
                editable={editable}
                enCours={enCours}
                onBasculer={basculer}
                terme={terme}
                termeApfc={termeApfc}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-700/55">
        <Lock size={11} className="mr-1 inline" />
        Les droits de l&apos;Administrateur système ainsi que les modules vitaux (tableau de bord,
        identification, profil, notifications) sont verrouillés pour ne jamais bloquer un compte.
      </p>
    </div>
  );
}

/**
 * TÉLÉPHONE — droits d'UN rôle à la fois : liste du rôle (sélecteur natif), puis, section par
 * section, une rangée de 48 px par permission avec un interrupteur de 44 px. Les verrous
 * (modules vitaux, Administrateur système, lecture seule) sont les mêmes que dans la table.
 */
function VueParRole({
  grille,
  role,
  onRole,
  editable,
  enCours,
  onBasculer,
  T,
}: {
  grille: SectionDroits[];
  role: RoleId;
  onRole: (r: RoleId) => void;
  editable: boolean;
  enCours: string | null;
  onBasculer: (item: LigneDroit, role: RoleId) => void;
  T: (s: string) => string;
}) {
  const items = grille.flatMap((s) => s.items);
  const accordes = items.filter((i) => i.acces[role]).length;
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-forest-900">Rôle affiché</span>
        <select
          value={role}
          onChange={(e) => onRole(e.target.value as RoleId)}
          className="h-12 w-full rounded-2xl border border-cream-300 bg-white px-3.5 text-base text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        >
          {ROLES_ORDONNES.map((r) => (
            <option key={r.id} value={r.id}>
              {T(r.libelle)}
            </option>
          ))}
        </select>
        <span className="mt-1.5 block text-sm text-ink-700/70">
          {accordes} permission{accordes > 1 ? "s" : ""} accordée{accordes > 1 ? "s" : ""} sur {items.length}
          {role === "admin" ? " — droits de l'Administrateur système verrouillés." : ""}
        </span>
      </label>

      {grille.map((section) => (
        <section key={section.id} className="overflow-hidden rounded-2xl border border-cream-200 bg-white">
          <h3 className="border-b border-cream-100 bg-cream-50/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gold-700">
            {T(section.libelle)}
          </h3>
          <ul className="divide-y divide-cream-100">
            {section.items.map((item) => {
              const accorde = item.acces[role];
              const verrouille = !editable || item.verrouille || role === "admin";
              const occupe = enCours === `${item.id}:${role}`;
              return (
                <li key={item.id} className="flex min-h-12 items-center justify-between gap-3 py-0.5 pl-4 pr-1.5">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-forest-900">
                    {T(item.libelle)}
                    {item.verrouille && <Lock size={13} className="shrink-0 text-ink-700/40" aria-label="Verrouillé" />}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={accorde}
                    aria-label={`${T(item.libelle)} — ${accorde ? "accordé" : "non accordé"}`}
                    disabled={verrouille || occupe}
                    onClick={() => onBasculer(item, role)}
                    className={`flex h-11 w-14 shrink-0 items-center justify-center ${verrouille ? "cursor-not-allowed opacity-60" : ""} ${occupe ? "animate-pulse" : ""}`}
                  >
                    <span
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        accorde ? "bg-forest-600" : "bg-cream-300"
                      }`}
                    >
                      <span
                        className={`absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-all ${
                          accorde ? "left-6 text-forest-700" : "left-1 text-ink-700/40"
                        }`}
                      >
                        {accorde ? <Check size={12} strokeWidth={3} /> : <Minus size={11} />}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SectionLignes({
  section,
  editable,
  enCours,
  onBasculer,
  terme,
  termeApfc,
}: {
  section: SectionDroits;
  editable: boolean;
  enCours: string | null;
  onBasculer: (item: LigneDroit, role: RoleId) => void;
  terme: string;
  termeApfc: string;
}) {
  const T = (s: string) => appliquerTermeApfc(appliquerTerme(s, terme), termeApfc);
  return (
    <>
      <tr className="border-b border-cream-100 bg-cream-50/40">
        <td colSpan={ROLES_ORDONNES.length + 1} className="sticky left-0 px-4 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-gold-700">
          {T(section.libelle)}
        </td>
      </tr>
      {section.items.map((item) => (
        <tr key={item.id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/40">
          <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-forest-900">
            <span className="inline-flex items-center gap-1.5">
              {T(item.libelle)}
              {item.verrouille && <Lock size={11} className="text-ink-700/35" />}
            </span>
          </td>
          {ROLES_ORDONNES.map((r) => (
            <td key={r.id} className="px-2 py-2 text-center">
              <Cellule
                accorde={item.acces[r.id]}
                verrouille={!editable || item.verrouille || r.id === "admin"}
                enCours={enCours === `${item.id}:${r.id}`}
                onClick={() => onBasculer(item, r.id)}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

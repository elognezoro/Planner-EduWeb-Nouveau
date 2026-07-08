"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { UserPlus, Upload, X, Download } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { ROLES } from "@/lib/rbac";
import { appliquerTerme } from "@/lib/cafop-terme";
import { capitaliserPrenoms, majusculesNom } from "@/lib/texte";
import { creerCompte, importerComptes, exporterComptes, type EtatForm } from "./actions";

const initial: EtatForm = { ok: false };
const champ =
  "h-11 w-full rounded-2xl border border-cream-300 bg-white px-3.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

type RoleOption = { v: string; l: string };

function Modal({ titre, onClose, children }: { titre: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-forest-950/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft"
      >
        <div className="flex items-center justify-between border-b border-cream-100 px-5 py-3.5">
          <h2 className="font-display text-base font-bold text-forest-900">{titre}</h2>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </motion.div>
    </>
  );
}

function CreerForm({ onClose, rolesOptions }: { onClose: () => void; rolesOptions: RoleOption[] }) {
  const [etat, action] = useActionState(creerCompte, initial);
  const router = useRouter();
  useEffect(() => {
    if (etat.ok) router.refresh();
  }, [etat, router]);

  return (
    <form action={action} className="space-y-3">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Prénoms</label>
          <input
            name="prenoms"
            className={champ}
            placeholder="Ex : Adélaïde"
            onInput={(e) => {
              // Première lettre de chaque prénom en majuscule, le reste en minuscules.
              e.currentTarget.value = capitaliserPrenoms(e.currentTarget.value);
            }}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Nom</label>
          <input
            name="nom"
            className={champ}
            placeholder="Ex : N'GUESSAN"
            onInput={(e) => {
              // NOM automatiquement en MAJUSCULES.
              e.currentTarget.value = majusculesNom(e.currentTarget.value);
            }}
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-forest-900">E-mail</label>
        <input name="email" type="email" required className={champ} placeholder="prenom.nom@exemple.ci" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Rôle</label>
          <select name="role" defaultValue="eleve" className={champ}>
            {rolesOptions.map((r) => (
              <option key={r.v} value={r.v}>{r.l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Mot de passe</label>
          <input name="motDePasse" type="text" required minLength={8} className={champ} placeholder="8 caractères min." />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
          {etat.ok ? "Fermer" : "Annuler"}
        </button>
        <SubmitButton className="w-auto px-6">
          <UserPlus size={15} /> Créer le compte
        </SubmitButton>
      </div>
    </form>
  );
}

function ImportForm({ onClose }: { onClose: () => void }) {
  const [etat, action] = useActionState(importerComptes, initial);
  const router = useRouter();
  useEffect(() => {
    if (etat.ok) router.refresh();
  }, [etat, router]);

  function telechargerModele() {
    const contenu =
      "prenom;nom;email;telephone;role;statut;pays;code_etablissement;etablissement\n" +
      "Awa;Kone;awa.kone@exemple.ci;+2250700000000;enseignant;actif;Côte d'Ivoire;041600;Lycée Moderne de Cocody\n" +
      "Yao;Brou;yao.brou@exemple.ci;;parent;actif;;;\n";
    const blob = new Blob([contenu], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modele-import-comptes.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <form action={action} className="space-y-3">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="flex items-center justify-between rounded-2xl border border-cream-200 bg-cream-50/60 px-3.5 py-2.5">
        <p className="text-xs text-ink-700/70">Colonnes : <code>prenom; nom; email; telephone; role; statut; pays; code_etablissement; etablissement</code></p>
        <button type="button" onClick={telechargerModele} className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50">
          <Download size={13} /> Modèle CSV
        </button>
      </div>
      <p className="text-[0.7rem] leading-relaxed text-ink-700/55">
        <code>role</code> : identifiant technique (ex. <code>enseignant</code>) ou libellé.{" "}
        <code>statut</code> : <code>actif</code> (défaut), <code>en_attente_verification</code> ou{" "}
        <code>suspendu</code>. <code>code_etablissement</code> (recommandé) ou <code>etablissement</code> (nom exact,
        désambiguïsé par <code>pays</code>) rattachent le compte — réservé à l&apos;admin système. Chaque compte créé
        reçoit un e-mail avec le mot de passe temporaire ci-dessous, l&apos;invitant à le changer dans son profil.
      </p>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-forest-900">Fichier CSV</label>
        <input type="file" name="fichier" accept=".csv,text/csv" className="text-xs" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-forest-900">…ou coller le CSV</label>
        <textarea name="texte" rows={4} placeholder={"prenom;nom;email;telephone;role;statut;pays;code_etablissement;etablissement\nAwa;Kone;awa.kone@exemple.ci;;enseignant;actif;;041600;"} className="w-full rounded-2xl border border-cream-300 bg-white px-3 py-2.5 font-mono text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-forest-900">Mot de passe temporaire (tous les comptes)</label>
        <input name="motDePasse" type="text" required minLength={8} defaultValue="EduWeb-2026" className={champ} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
          {etat.ok ? "Fermer" : "Annuler"}
        </button>
        <SubmitButton className="w-auto px-6">
          <Upload size={15} /> Importer
        </SubmitButton>
      </div>
    </form>
  );
}

function ExportButton() {
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function exporter() {
    setBusy(true);
    setErreur(null);
    try {
      const res = await exporterComptes();
      if (!res.ok || !res.csv) {
        setErreur(res.message ?? "Échec de l'export.");
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.nom ?? "comptes-eduweb.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setErreur("Erreur technique lors de l'export.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start">
      <button
        onClick={exporter}
        disabled={busy}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-200 bg-white px-5 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-60"
      >
        <Download size={16} /> {busy ? "Export en cours…" : "Exporter CSV"}
      </button>
      {erreur && <span className="mt-1 text-xs text-red-600">{erreur}</span>}
    </div>
  );
}

export function ComptesActions({ terme = "CAFOP" }: { terme?: string }) {
  const [modal, setModal] = useState<null | "creer" | "import">(null);
  const fermer = () => setModal(null);
  const rolesOptions: RoleOption[] = Object.entries(ROLES)
    .map(([v, r]) => ({ v, l: appliquerTerme(r.libelle, terme) }))
    .sort((a, b) => a.l.localeCompare(b.l));
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setModal("creer")}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5 hover:bg-forest-700"
        >
          <UserPlus size={16} /> Créer un compte
        </button>
        <button
          onClick={() => setModal("import")}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-200 bg-white px-5 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50"
        >
          <Upload size={16} /> Importer CSV
        </button>
        <ExportButton />
      </div>
      <AnimatePresence>
        {modal === "creer" && (
          <Modal titre="Créer un compte" onClose={fermer}>
            <CreerForm onClose={fermer} rolesOptions={rolesOptions} />
          </Modal>
        )}
        {modal === "import" && (
          <Modal titre="Importer des comptes (CSV)" onClose={fermer}>
            <ImportForm onClose={fermer} />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

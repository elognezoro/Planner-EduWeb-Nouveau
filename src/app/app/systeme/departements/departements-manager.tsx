"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { Card, Badge } from "@/components/app/ui";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";
import {
  OPTIONS_ICONE, CATEGORIES_DEPARTEMENT, resoudreIconeDepartement, libelleCategorie,
  type DepartementVue,
} from "@/lib/departements-ui";
import { enregistrerDepartement, supprimerDepartement, basculerActifDepartement, type EtatDep } from "./actions";

const initial: EtatDep = { ok: false };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:h-11";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-700/55";

function FormDepartement({ departement, onFini }: { departement?: DepartementVue; onFini: () => void }) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerDepartement, initial);
  const vu = useRef<EtatDep>(initial);
  useEffect(() => {
    if (etat.ok && vu.current !== etat) { vu.current = etat; router.refresh(); onFini(); }
  }, [etat, router, onFini]);

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-forest-200 bg-forest-50/40 p-4">
      {departement && <input type="hidden" name="id" value={departement.id} />}
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Nom du département</label>
          <input name="nom" required defaultValue={departement?.nom ?? ""} maxLength={120} className={champ} placeholder="Ex. Ingénierie Plateforme" />
        </div>
        <div>
          <label className={label}>Catégorie (onglet)</label>
          <select name="categorie" defaultValue={departement?.categorie ?? "general"} className={champ}>
            {CATEGORIES_DEPARTEMENT.map((c) => <option key={c.v} value={c.v}>{c.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Icône</label>
          <select name="icone" defaultValue={departement?.icone ?? "Compass"} className={champ}>
            {OPTIONS_ICONE.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Accent</label>
          <select name="couleur" defaultValue={departement?.couleur ?? "forest"} className={champ}>
            <option value="forest">Vert forêt</option>
            <option value="gold">Or</option>
          </select>
        </div>
        <div>
          <label className={label}>Ordre d&apos;affichage</label>
          <input name="ordre" type="number" defaultValue={departement?.ordre ?? 0} className={champ} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Description</label>
          <textarea name="description" rows={2} maxLength={400} defaultValue={departement?.description ?? ""} className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" placeholder="En une phrase, le rôle de ce département." />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-800 mobile:min-h-11">
          <input type="checkbox" name="actif" defaultChecked={departement?.actif ?? true} className="h-4 w-4 rounded border-cream-300" />
          Affiché sur la page d&apos;accueil
        </label>
      </div>

      <div className="flex items-center gap-2">
        <SubmitButton className="w-auto px-5 mobile:flex-1">{departement ? "Enregistrer" : "Ajouter le département"}</SubmitButton>
        <button type="button" onClick={onFini} className="rounded-full px-4 py-2 text-sm font-medium text-ink-700/70 hover:bg-cream-100 mobile:min-h-11">Annuler</button>
      </div>
    </form>
  );
}

export function DepartementsManager({ departements }: { departements: DepartementVue[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"ajout" | { edit: string } | null>(null);
  const [pending, start] = useTransition();
  // Téléphone : la suppression se confirme dans une feuille montante (pas de confirm() natif,
  // bloqué dans l'aperçu de l'application). La feuille garde le département affiché pendant
  // sa fermeture animée, d'où deux états distincts.
  const [aSupprimer, setASupprimer] = useState<DepartementVue | null>(null);
  const [feuilleSuppr, setFeuilleSuppr] = useState(false);
  const supprimerConfirme = (d: DepartementVue) => {
    setFeuilleSuppr(false);
    start(async () => { await supprimerDepartement(d.id); router.refresh(); });
  };

  const basculer = (d: DepartementVue) => start(async () => { await basculerActifDepartement(d.id, !d.actif); router.refresh(); });
  const supprimer = (d: DepartementVue) => {
    if (!confirm(`Supprimer le département « ${d.nom} » ?`)) return;
    start(async () => { await supprimerDepartement(d.id); router.refresh(); });
  };

  return (
    <div className="space-y-4">
      {mode === "ajout" ? (
        <FormDepartement onFini={() => setMode(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setMode("ajout")}
          className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-4 py-2 text-sm font-semibold text-cream-50 shadow-soft hover:bg-forest-700 mobile:min-h-11 mobile:w-full mobile:justify-center"
        >
          <Plus size={16} /> Ajouter un département
        </button>
      )}

      {departements.length === 0 ? (
        <Card><p className="text-sm text-ink-700/60">Aucun département. Ajoutez-en un pour l&apos;afficher sur la page d&apos;accueil.</p></Card>
      ) : (
        <div className="space-y-2">
          {departements.map((d) => {
            const Icone = resoudreIconeDepartement(d.icone);
            const enEdition = typeof mode === "object" && mode?.edit === d.id;
            if (enEdition) return <FormDepartement key={d.id} departement={d} onFini={() => setMode(null)} />;
            return (
              // Téléphone : icône + texte sur la 1re rangée, « #ordre » et les actions (44 px) sur la 2e.
              <Card key={d.id} className={`flex items-center gap-3 py-3 mobile:flex-wrap mobile:p-4 ${d.actif ? "" : "opacity-60"}`}>
                <GripVertical size={15} className="shrink-0 text-ink-700/25 mobile:hidden" />
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${d.couleur === "gold" ? "bg-gradient-to-br from-gold-400 to-gold-600" : "bg-gradient-to-br from-forest-500 to-forest-700"}`}>
                  <Icone size={18} />
                </span>
                <div className="min-w-0 flex-1 mobile:basis-[calc(100%-3.5rem)]">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-forest-900">
                    {d.nom}
                    <Badge ton="neutre">{libelleCategorie(d.categorie)}</Badge>
                    {!d.actif && <Badge ton="attente">Masqué</Badge>}
                  </p>
                  {d.description && <p className="truncate text-xs text-ink-700/60 mobile:line-clamp-2 mobile:whitespace-normal">{d.description}</p>}
                </div>
                <span className="shrink-0 text-xs text-ink-700/40 mobile:mr-auto mobile:ml-[3.25rem]">#{d.ordre}</span>
                <button type="button" disabled={pending} onClick={() => basculer(d)} title={d.actif ? "Masquer" : "Afficher"} className="rounded-lg p-2 text-ink-700/60 hover:bg-cream-100 disabled:opacity-50 mobile:inline-flex mobile:h-11 mobile:w-11 mobile:items-center mobile:justify-center">
                  {d.actif ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button type="button" onClick={() => setMode({ edit: d.id })} title="Éditer" className="rounded-lg p-2 text-forest-700 hover:bg-forest-50 mobile:inline-flex mobile:h-11 mobile:w-11 mobile:items-center mobile:justify-center">
                  <Pencil size={16} />
                </button>
                <button type="button" disabled={pending} onClick={() => supprimer(d)} title="Supprimer" className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50 mobile:hidden">
                  <Trash2 size={16} />
                </button>
                {/* Téléphone : même action, confirmée dans une feuille montante. */}
                <div className="lg:hidden print:hidden">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { setASupprimer(d); setFeuilleSuppr(true); }}
                    aria-label={`Supprimer ${d.nom}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-red-600 active:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <FeuilleBas ouvert={feuilleSuppr} onFermer={() => setFeuilleSuppr(false)} titre="Supprimer le département">
        {aSupprimer && (
          <div className="space-y-4 px-2 pb-2">
            <p className="text-sm text-ink-800">
              Supprimer le département « <strong>{aSupprimer.nom}</strong> » ? Il disparaîtra de la page d&apos;accueil.
              Pour le retirer sans le perdre, masquez-le plutôt.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => supprimerConfirme(aSupprimer)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-red-600 font-semibold text-white active:bg-red-700 disabled:opacity-60"
            >
              <Trash2 size={17} /> Supprimer définitivement
            </button>
            <button
              type="button"
              onClick={() => setFeuilleSuppr(false)}
              className="flex min-h-12 w-full items-center justify-center rounded-full border border-cream-300 bg-white font-medium text-ink-700/80 active:bg-cream-100"
            >
              Annuler
            </button>
          </div>
        )}
      </FeuilleBas>
    </div>
  );
}

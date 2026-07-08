"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Plus, Trash2, Users } from "lucide-react";
import {
  modifierCafop,
  ajouterApprenant,
  supprimerApprenant,
  creerCohorte,
  type EtatForm,
} from "@/lib/formation/actions";
import { FormAlert, SubmitButton } from "@/components/ui/form";

const initial: EtatForm = { ok: false };
const champCls = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export interface CafopConfig {
  id: string;
  nom: string;
  code: string | null;
  drena: string | null;
  localite: string | null;
  directeur: string | null;
  directeurTel: string | null;
  effectif: number;
}
export interface PromotionConfig {
  id: string;
  libelle: string;
  nbEleves: number;
}
export interface EleveConfig {
  id: string;
  nom: string;
  prenoms: string | null;
  matricule: string | null;
  groupe: string | null;
  promotionId: string;
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-forest-900">{label}</span>
      {children}
    </label>
  );
}

export function ConfigurerCafop({ cafop, promotions, eleves }: { cafop: CafopConfig; promotions: PromotionConfig[]; eleves: EleveConfig[] }) {
  const router = useRouter();
  const [promoSel, setPromoSel] = useState(promotions[0]?.id ?? "");
  const [pending, start] = useTransition();

  const [etatEdit, actionEdit] = useActionState(modifierCafop, initial);
  const [etatEleve, actionEleve] = useActionState(ajouterApprenant, initial);
  const [etatPromo, actionPromo] = useActionState(creerCohorte, initial);
  const rafraichi = useRef({ edit: false, eleve: false, promo: false });
  useEffect(() => {
    for (const [k, ok] of [["edit", etatEdit.ok], ["eleve", etatEleve.ok], ["promo", etatPromo.ok]] as const) {
      if (ok && !rafraichi.current[k]) { rafraichi.current[k] = true; router.refresh(); }
      if (!ok) rafraichi.current[k] = false;
    }
  }, [etatEdit.ok, etatEleve.ok, etatPromo.ok, router]);

  const elevesPromo = eleves.filter((e) => e.promotionId === promoSel);

  return (
    <div className="space-y-6">
      {/* Fiche du centre */}
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h3 className="mb-4 font-display text-base font-bold text-forest-900">Fiche du centre {cafop.code ? <span className="text-sm font-normal text-ink-700/50">· {cafop.code}</span> : null}</h3>
        {etatEdit.message && <div className="mb-3"><FormAlert ton={etatEdit.ok ? "succes" : "erreur"}>{etatEdit.message}</FormAlert></div>}
        <form action={actionEdit} className="space-y-3">
          <input type="hidden" name="id" value={cafop.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ label="Nom du CAFOP *"><input name="nom" defaultValue={cafop.nom} required className={champCls} /></Champ>
            <Champ label="DRENA"><input name="drena" defaultValue={cafop.drena ?? ""} className={champCls} /></Champ>
            <Champ label="Localité"><input name="localite" defaultValue={cafop.localite ?? ""} className={champCls} /></Champ>
            <Champ label="Directeur"><input name="directeur" defaultValue={cafop.directeur ?? ""} className={champCls} /></Champ>
            <Champ label="Téléphone"><input name="directeurTel" defaultValue={cafop.directeurTel ?? ""} className={champCls} /></Champ>
            <Champ label="Effectif (élèves-maîtres)"><input name="effectif" type="number" min={0} defaultValue={cafop.effectif} className={champCls} /></Champ>
          </div>
          <div className="flex justify-end">
            <SubmitButton className="w-auto px-6"><Save size={15} /> Enregistrer</SubmitButton>
          </div>
        </form>
      </section>

      {/* Promotions */}
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h3 className="mb-1 font-display text-base font-bold text-forest-900">Promotions</h3>
        <p className="mb-3 text-sm text-ink-700/60">Cohortes d&apos;élèves-maîtres du centre.</p>
        {etatPromo.message && <div className="mb-3"><FormAlert ton={etatPromo.ok ? "succes" : "erreur"}>{etatPromo.message}</FormAlert></div>}
        <div className="mb-4 space-y-1.5">
          {promotions.length === 0 ? (
            <p className="text-sm text-ink-700/55">Aucune promotion.</p>
          ) : (
            promotions.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-cream-200 px-3 py-2 text-sm">
                <span className="font-medium text-forest-900">{p.libelle}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800"><Users size={11} /> {p.nbEleves}</span>
              </div>
            ))
          )}
        </div>
        <form action={actionPromo} className="flex flex-wrap items-end gap-2 border-t border-cream-100 pt-3">
          <input type="hidden" name="type" value="cafop_promotion" />
          <input type="hidden" name="cafopId" value={cafop.id} />
          <div className="min-w-[12rem] flex-1"><Champ label="Nouvelle promotion"><input name="libelle" required placeholder="Promotion 2026-2028" className={champCls} /></Champ></div>
          <div className="w-24"><Champ label="Début"><input name="anneeDebut" type="number" placeholder="2026" className={champCls} /></Champ></div>
          <div className="w-24"><Champ label="Fin"><input name="anneeFin" type="number" placeholder="2028" className={champCls} /></Champ></div>
          <SubmitButton className="w-auto px-5"><Plus size={15} /> Ajouter</SubmitButton>
        </form>
      </section>

      {/* Élèves-maîtres */}
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-forest-900">Élèves-maîtres</h3>
          <select value={promoSel} onChange={(e) => setPromoSel(e.target.value)} className="h-9 rounded-full border border-cream-300 bg-white px-3 text-sm">
            {promotions.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
          </select>
        </div>
        {etatEleve.message && <div className="mb-3"><FormAlert ton={etatEleve.ok ? "succes" : "erreur"}>{etatEleve.message}</FormAlert></div>}

        <div className="mb-4 max-h-72 overflow-auto rounded-xl border border-cream-100">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-cream-50">
              <tr className="border-b border-cream-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-700/55">
                <th className="px-3 py-2">Nom</th><th className="px-3 py-2">Prénoms</th><th className="px-3 py-2">Groupe</th><th className="px-3 py-2">Matricule</th><th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {elevesPromo.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-ink-700/55">Aucun élève-maître.</td></tr>
              ) : (
                elevesPromo.map((e) => (
                  <tr key={e.id} className="border-b border-cream-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-forest-900">{e.nom}</td>
                    <td className="px-3 py-2 text-ink-700/80">{e.prenoms ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-700/70">{e.groupe ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-700/55">{e.matricule ?? "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await supprimerApprenant(e.id); if (r.ok) router.refresh(); })} className="text-ink-700/40 hover:text-red-600 disabled:opacity-50" title="Retirer">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form action={actionEleve} className="flex flex-wrap items-end gap-2 border-t border-cream-100 pt-3">
          <input type="hidden" name="cohorteId" value={promoSel} />
          <div className="w-32"><Champ label="Nom"><input name="nom" required placeholder="KONÉ" className={champCls} /></Champ></div>
          <div className="w-40"><Champ label="Prénoms"><input name="prenoms" placeholder="Moussa Ibrahim" className={champCls} /></Champ></div>
          <div className="w-24"><Champ label="Groupe"><input name="groupe" placeholder="F2" className={champCls} /></Champ></div>
          <div className="w-32"><Champ label="Matricule"><input name="matricule" placeholder="(auto)" className={champCls} /></Champ></div>
          <SubmitButton className="w-auto px-5"><Plus size={15} /> Ajouter</SubmitButton>
        </form>
      </section>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, BookText } from "lucide-react";
import { creerSeanceCafop, supprimerSeanceCafop, type EtatForm } from "@/lib/formation/actions";
import { FormAlert, SubmitButton } from "@/components/ui/form";

const initial: EtatForm = { ok: false };
const champCls = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export interface SeanceVue {
  id: string;
  dateLabel: string;
  moduleNom: string | null;
  groupe: string | null;
  titre: string;
  contenu: string | null;
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-forest-900">{label}</span>
      {children}
    </label>
  );
}

export function CahierTexteCafop({
  cafopId,
  modules,
  groupes,
  seances,
}: {
  cafopId: string;
  modules: { id: string; nom: string }[];
  groupes: string[];
  seances: SeanceVue[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [etat, action] = useActionState(creerSeanceCafop, initial);
  const notifie = useRef(false);
  useEffect(() => {
    if (etat.ok && !notifie.current) { notifie.current = true; router.refresh(); }
    if (!etat.ok) notifie.current = false;
  }, [etat.ok, router]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h3 className="mb-1 font-display text-base font-bold text-forest-900">Nouvelle séance</h3>
        <p className="mb-3 text-sm text-ink-700/60">Enregistrez le contenu enseigné par module et groupe-classe.</p>
        {etat.message && <div className="mb-3"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
        <form action={action} className="space-y-3">
          <input type="hidden" name="cafopId" value={cafopId} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Champ label="Date"><input name="date" type="date" required className={champCls} /></Champ>
            <Champ label="Module">
              <select name="moduleId" className={champCls}>
                <option value="">—</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </Champ>
            <Champ label="Groupe-classe">
              <select name="groupe" className={champCls}>
                <option value="">Tous</option>
                {groupes.map((g) => <option key={g} value={g}>{`Groupe ${g}`}</option>)}
              </select>
            </Champ>
            <Champ label="Titre de la séance"><input name="titre" required placeholder="Ex : Les droits de l'enfant" className={champCls} /></Champ>
          </div>
          <Champ label="Contenu / objectifs">
            <textarea name="contenu" rows={2} placeholder="Résumé du contenu enseigné, objectifs, activités…" className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
          </Champ>
          <div className="flex justify-end">
            <SubmitButton className="w-auto px-6"><Plus size={15} /> Enregistrer la séance</SubmitButton>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-cream-200 bg-white shadow-soft">
        <div className="border-b border-cream-100 px-5 py-4">
          <h3 className="font-display text-base font-bold text-forest-900">Séances enregistrées ({seances.length})</h3>
        </div>
        {seances.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-ink-700/55"><BookText size={16} /> Aucune séance. Ajoutez-en une ci-dessus.</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {seances.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-forest-900">
                    {s.titre}
                    {s.moduleNom && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-800">{s.moduleNom}</span>}
                    {s.groupe && <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800">Groupe {s.groupe}</span>}
                  </p>
                  <p className="text-xs text-ink-700/55">{s.dateLabel}</p>
                  {s.contenu && <p className="mt-1 text-sm text-ink-700/75">{s.contenu}</p>}
                </div>
                <button type="button" disabled={pending} onClick={() => start(async () => { const r = await supprimerSeanceCafop(s.id); if (r.ok) router.refresh(); })} title="Supprimer" className="shrink-0 text-ink-700/40 hover:text-red-600 disabled:opacity-50">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

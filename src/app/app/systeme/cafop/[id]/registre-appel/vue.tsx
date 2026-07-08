"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, ClipboardCheck } from "lucide-react";
import { enregistrerPresencesCafop } from "@/lib/formation/actions";
import { FormAlert } from "@/components/ui/form";

export interface EleveAppel {
  id: string;
  nom: string;
  prenoms: string | null;
  groupe: string | null;
  promotionId: string;
}
export interface PresenceVue {
  apprenantId: string;
  date: string; // YYYY-MM-DD
  statut: string;
}

const STATUTS = [
  { cle: "present", court: "P", libelle: "Présent", on: "bg-forest-600 text-white", off: "text-forest-700 hover:bg-forest-50" },
  { cle: "absent", court: "A", libelle: "Absent", on: "bg-red-600 text-white", off: "text-red-600 hover:bg-red-50" },
  { cle: "retard", court: "R", libelle: "Retard", on: "bg-amber-500 text-white", off: "text-amber-600 hover:bg-amber-50" },
  { cle: "justifie", court: "J", libelle: "Justifié", on: "bg-blue-600 text-white", off: "text-blue-600 hover:bg-blue-50" },
];

export function RegistreAppelCafop({
  promotions,
  eleves,
  presences,
  defaultDate,
}: {
  promotions: { id: string; libelle: string }[];
  eleves: EleveAppel[];
  presences: PresenceVue[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const [promoSel, setPromoSel] = useState(promotions[0]?.id ?? "");
  const promoEleves = useMemo(() => eleves.filter((e) => e.promotionId === promoSel), [eleves, promoSel]);
  const groupes = useMemo(() => [...new Set(promoEleves.map((e) => e.groupe).filter(Boolean))] as string[], [promoEleves]);
  // null = « auto » (premier groupe) ; "" = « Tous les groupes » explicitement choisi.
  const [groupe, setGroupe] = useState<string | null>(null);
  const groupeEff = groupe === null ? groupes[0] ?? "" : groupe;
  const [date, setDate] = useState(defaultDate);

  const elevesFiltres = useMemo(
    () => promoEleves.filter((e) => (groupeEff ? e.groupe === groupeEff : true)),
    [promoEleves, groupeEff],
  );

  // Statut effectif = modification locale (par élève ET par date) sinon présence enregistrée sinon « présent ».
  // Dérivé au rendu → pas d'effet ni de setState en cascade ; les changements de date/groupe repartent proprement.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const statutDe = (id: string) =>
    overrides[`${id}|${date}`] ?? presences.find((p) => p.apprenantId === id && p.date === date)?.statut ?? "present";
  const definir = (id: string, statut: string) => {
    setMsg(null);
    setOverrides((m) => ({ ...m, [`${id}|${date}`]: statut }));
  };

  function enregistrer() {
    setMsg(null);
    const entrees = elevesFiltres.map((e) => ({ apprenantId: e.id, statut: statutDe(e.id) }));
    start(async () => {
      const r = await enregistrerPresencesCafop(promoSel, date, entrees);
      setMsg({ ok: r.ok, texte: r.message ?? "" });
      if (r.ok) router.refresh();
    });
  }

  const compteur = STATUTS.map((s) => ({ ...s, n: elevesFiltres.filter((e) => statutDe(e.id) === s.cle).length }));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-forest-900">Cohorte (promotion)</span>
            <select value={promoSel} onChange={(e) => { setPromoSel(e.target.value); setGroupe(null); }} className="h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm">
              {promotions.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-forest-900">Groupe-classe</span>
            <select value={groupeEff} onChange={(e) => setGroupe(e.target.value)} className="h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm">
              <option value="">Tous les groupes</option>
              {groupes.map((g) => <option key={g} value={g}>{`Groupe ${g}`}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-forest-900">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {compteur.map((c) => (
            <span key={c.cle} className="rounded-full bg-cream-100 px-2.5 py-1 font-semibold text-ink-700/70">{c.libelle} : {c.n}</span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-cream-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-cream-100 px-5 py-4">
          <h3 className="font-display text-base font-bold text-forest-900">
            Appel {groupeEff ? `— Groupe ${groupeEff}` : ""}
          </h3>
          <button type="button" disabled={pending || elevesFiltres.length === 0} onClick={enregistrer} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-700 px-4 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50">
            <Save size={15} /> Enregistrer l&apos;appel
          </button>
        </div>
        {msg && <div className="px-5 pt-3"><FormAlert ton={msg.ok ? "succes" : "erreur"}>{msg.texte}</FormAlert></div>}
        {elevesFiltres.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-ink-700/55"><ClipboardCheck size={16} /> Aucun élève-maître dans ce groupe.</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {elevesFiltres.map((e, i) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
                <span className="text-sm font-medium text-forest-900">{i + 1}. {[e.nom, e.prenoms].filter(Boolean).join(" ")}</span>
                <div className="flex gap-1">
                  {STATUTS.map((s) => {
                    const actif = statutDe(e.id) === s.cle;
                    return (
                      <button
                        key={s.cle}
                        type="button"
                        title={s.libelle}
                        onClick={() => definir(e.id, s.cle)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${actif ? s.on : `border border-cream-300 ${s.off}`}`}
                      >
                        {s.court}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { modifierApfc, type EtatForm } from "@/lib/formation/actions";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { ArmoiriesApfc } from "./armoiries-apfc";
import { DocumentsApfc } from "./documents-apfc";
import { PersonnelApfc, type PersonnelApfcVue } from "./personnel-apfc";

const initial: EtatForm = { ok: false };
const champCls =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
// Casse « live » (sans rognage, pour autoriser la saisie d'espaces).
const majLive = (s: string) => s.toUpperCase();
const titreLive = (s: string) => s.toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (_m, sep: string, c: string) => sep + c.toUpperCase());

/**
 * Fiche de configuration d'une APFC : renommage, rattachement à la région, chef d'antenne,
 * armoiries du pays (lecture), documents officiels (logo/cachet/signature) et annuaire du
 * personnel selon le profil disciplinaire. Miroir de la « Fiche du centre » CAFOP
 * (configurer-cafop.tsx), adapté aux champs propres à l'APFC. Masquée si `peutModifier` est
 * faux côté page (garde d'écriture réservée — admin système ou Super Admin APFC de son pays).
 */
export function FicheApfc({
  id,
  nom,
  regionId,
  regions,
  chefAntenneNom,
  chefAntennePrenoms,
  docs,
  pays,
  personnel,
  disciplinesRef,
  terme,
}: {
  id: string;
  nom: string;
  regionId: string | null;
  regions: { id: string; nom: string }[];
  chefAntenneNom: string | null;
  chefAntennePrenoms: string | null;
  docs: { logo: string | null; cachet: string | null; signature: string | null };
  /** Pays de l'APFC (celui de sa région, ou le pays consulté à défaut) — détermine les armoiries. */
  pays: string;
  personnel: PersonnelApfcVue[];
  disciplinesRef: string[];
  terme: string;
}) {
  const router = useRouter();
  const [etat, action] = useActionState(modifierApfc, initial);
  const rafraichi = useRef(false);
  const T = (s: string) => appliquerTermeApfc(s, terme);

  useEffect(() => {
    if (etat.ok && !rafraichi.current) {
      rafraichi.current = true;
      router.refresh();
    }
    if (!etat.ok) rafraichi.current = false;
  }, [etat.ok, router]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h3 className="mb-4 font-display text-base font-bold text-forest-900">{T("Fiche de l'APFC")}</h3>
        {etat.message && (
          <div className="mb-3">
            <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
          </div>
        )}
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-forest-900">{T("Nom de l'APFC")} *</span>
              <input name="nom" defaultValue={nom} required className={champCls} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-forest-900">Région</span>
              <select name="regionId" defaultValue={regionId ?? ""} className={champCls}>
                <option value="">—</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.nom}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-forest-900">NOM du Chef d&apos;Antenne</span>
              <input name="chefAntenneNom" defaultValue={chefAntenneNom ?? ""} onChange={(e) => { e.currentTarget.value = majLive(e.currentTarget.value); }} placeholder="KOUAMÉ" className={champCls} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-forest-900">Prénoms du Chef d&apos;Antenne</span>
              <input name="chefAntennePrenoms" defaultValue={chefAntennePrenoms ?? ""} onChange={(e) => { e.currentTarget.value = titreLive(e.currentTarget.value); }} placeholder="Jean Marc" className={champCls} />
            </label>
          </div>
          <div className="flex justify-end">
            <SubmitButton className="w-auto px-6"><Save size={15} /> Enregistrer</SubmitButton>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
        <h3 className="mb-1 font-display text-base font-bold text-forest-900">Documents officiels</h3>
        <p className="mb-4 text-sm text-ink-700/60">Glissez-déposez ou cliquez pour téléverser (logo, cachet, signature).</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <ArmoiriesApfc pays={pays} />
          <DocumentsApfc apfcId={id} docs={docs} terme={terme} />
        </div>
      </section>

      <PersonnelApfc apfcId={id} personnel={personnel} disciplinesRef={disciplinesRef} terme={terme} />
    </div>
  );
}

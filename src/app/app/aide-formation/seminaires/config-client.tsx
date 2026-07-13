"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { ImageUp, Loader2, ExternalLink, Save, Trash2 } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { enregistrerConfigSeminaire, televerserImageSeminaire, supprimerImageSeminaire, type EtatConfig } from "./actions";

const initial: EtatConfig = { ok: false };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-forest-600";

export type ConfigSem = {
  couvertureUrl: string | null; organisation: string | null; logoUrl: string | null; formateur: string | null;
  directeur: string | null; directeurFonction: string | null; signatureUrl: string | null; cachetUrl: string | null;
  qrImageUrl: string | null; dateSignature: string | null; certificatModele: string | null; lieu: string | null;
} | null;

/** Zone d'upload d'une image (couverture / logo / signature / cachet / QR). */
function ZoneImage({ slug, type, libelle, url, large }: { slug: string; type: string; libelle: string; url: string | null; large?: boolean }) {
  const [etat, action] = useActionState(televerserImageSeminaire, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const h = large ? "h-40" : "h-28";

  return (
    <div>
      <p className={label}>{libelle}</p>
      {url ? (
        <>
          <div className={`relative ${h} w-full overflow-hidden rounded-xl border border-cream-300 bg-white`}>
            <Image src={url} alt={libelle} fill unoptimized className="object-contain p-2" sizes="(min-width:1024px) 33vw, 100vw" />
          </div>
          <form action={supprimerImageSeminaire} className="mt-1.5">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="type" value={type} />
            <SupprBtn />
          </form>
        </>
      ) : (
        <form ref={formRef} action={action}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="type" value={type} />
          <input
            ref={inputRef} type="file" name="fichier" accept="image/*" className="hidden"
            onChange={(e) => { if (e.currentTarget.files?.[0]) formRef.current?.requestSubmit(); }}
          />
          <BoutonDepot h={h} onClick={() => inputRef.current?.click()} />
          {etat.message && !etat.ok && <p className="mt-1 text-xs text-red-600">{etat.message}</p>}
        </form>
      )}
    </div>
  );
}

function BoutonDepot({ h, onClick }: { h: string; onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button type="button" onClick={onClick} disabled={pending}
      className={`flex ${h} w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-cream-300 bg-white text-ink-700/50 transition hover:border-forest-300 hover:bg-forest-50/40 hover:text-forest-700 disabled:opacity-60`}>
      {pending ? <Loader2 className="h-5 w-5 animate-spin text-forest-600" /> : <ImageUp className="h-5 w-5" />}
      <span className="text-xs font-medium">{pending ? "Téléversement…" : "Cliquez pour déposer une image"}</span>
    </button>
  );
}

function SupprBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline disabled:opacity-60">
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Retirer
    </button>
  );
}

export function ConfigSeminaireClient({ slug, titre, url, config }: { slug: string; titre: string; url: string | null; config: ConfigSem }) {
  const [etat, action] = useActionState(enregistrerConfigSeminaire, initial);
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-base font-bold text-forest-900">{titre}</h2>
        {url && <Link href={url} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:underline">Ouvrir <ExternalLink className="h-3 w-3" /></Link>}
      </div>

      {/* Couverture (bannière de la carte) */}
      <div className="mb-5">
        <ZoneImage slug={slug} type="couverture" libelle="Image de couverture (bannière de la carte)" url={config?.couvertureUrl ?? null} large />
      </div>

      {/* Paramétrage du certificat — le formulaire texte et les dépôts d'images sont
          des formulaires FRÈRES (jamais imbriqués : chaque ZoneImage porte son propre <form>). */}
      <div className="space-y-4 rounded-xl border border-cream-200 bg-cream-50/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">Paramétrage du certificat</p>
        <form action={action} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Organisation</label><input name="organisation" defaultValue={config?.organisation ?? ""} placeholder="Ex. : SENEC — Éducation Catholique" className={champ} /></div>
            <div><label className={label}>Modèle de certificat</label>
              <select name="certificatModele" defaultValue={config?.certificatModele ?? ""} className={champ}>
                <option value="">— Par défaut —</option>
                <option value="standard">Standard EduWeb</option>
                <option value="eduweb-v2">Prestige — A4 paysage</option>
              </select>
            </div>
            <div><label className={label}>Nom du formateur</label><input name="formateur" defaultValue={config?.formateur ?? ""} className={champ} /></div>
            <div><label className={label}>Nom du signataire (directeur)</label><input name="directeur" defaultValue={config?.directeur ?? ""} className={champ} /></div>
            <div><label className={label}>Fonction du signataire</label><input name="directeurFonction" defaultValue={config?.directeurFonction ?? ""} className={champ} /></div>
            <div><label className={label}>Lieu de délivrance</label><input name="lieu" defaultValue={config?.lieu ?? ""} placeholder="Ex. : Abidjan" className={champ} /></div>
            <div><label className={label}>Date de signature (délivrance)</label><input type="date" name="dateSignature" defaultValue={config?.dateSignature ?? ""} className={champ} /></div>
          </div>
          <div className="flex justify-end">
            <SubmitButton className="w-auto px-5"><Save className="mr-1.5 inline h-4 w-4" /> Enregistrer le paramétrage</SubmitButton>
          </div>
        </form>
        <div>
          <p className={label}>Images du certificat</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ZoneImage slug={slug} type="logo" libelle="Logo du certificat" url={config?.logoUrl ?? null} />
            <ZoneImage slug={slug} type="signature" libelle="Signature du formateur" url={config?.signatureUrl ?? null} />
            <ZoneImage slug={slug} type="cachet" libelle="Cachet officiel" url={config?.cachetUrl ?? null} />
            <ZoneImage slug={slug} type="qr" libelle="QR de vérification" url={config?.qrImageUrl ?? null} />
          </div>
        </div>
      </div>
    </div>
  );
}

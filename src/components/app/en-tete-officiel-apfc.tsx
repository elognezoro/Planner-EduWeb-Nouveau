import Image from "next/image";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";
import { appliquerTermeApfc } from "@/lib/apfc-terme";

/**
 * En-tête et pied de page OFFICIELS des documents émis par une APFC (Antenne Pédagogique de
 * Formation Continue) — calqués sur `EnTeteOfficielDoc` (établissements), avec en plus le LOGO
 * propre de l'antenne et le bloc de signature du chef d'antenne (cachet + signature électronique).
 *
 * ⚠️ RÉSERVÉS aux documents rattachés à UNE antenne précise (portée « apfc_admin »,
 * « chef_antenne », « conseiller_pedagogique »…) : n'utiliser QUE lorsque l'APFC affichée est
 * connue. Pour un document AGRÉGÉ multi-antennes (ex. supervision nationale vue par un admin ou
 * un DRENA), NE PAS utiliser ces composants — réutiliser `EnTeteOfficielDoc` avec un intitulé
 * générique (réseau national) et SANS logo/cachet/signature d'une antenne particulière, pour ne
 * jamais laisser croire qu'un document agrégé porte les visuels d'une seule antenne.
 *
 * Le pays affiché (armoiries, ministère, devise) doit être résolu par l'appelant via
 * `paysEffectifApfc()` (région de l'APFC si elle en a une, sinon pays consulté) — voir
 * `src/lib/apfc-terme-serveur.ts` — pour rester cohérent avec la fiche de configuration APFC.
 */

export interface ApfcEnTeteInfo {
  /** Nom de l'antenne (le terme local — APFC/ADEN/… — y est appliqué si le texte le contient). */
  nom: string;
  /** Région de rattachement, pour affichage informatif sous le nom de l'antenne. */
  regionNom?: string | null;
  /** Pays EFFECTIF de l'APFC (résolu par l'appelant — voir `paysEffectifApfc`) — détermine
   * armoiries, ministère et devise. */
  pays: string | null;
  /** Logo propre de l'APFC (Vercel Blob) — affiché à droite, à côté de la pile officielle du pays. */
  logoUrl?: string | null;
}

export function EnTeteOfficielApfc({
  apfc,
  titre,
  sousTitre,
  terme,
}: {
  apfc: ApfcEnTeteInfo;
  titre: string;
  sousTitre?: string;
  /** Terme local des APFC (ex. « ADEN ») — invariant si non fourni. */
  terme?: string | null;
}) {
  const T = (s: string) => appliquerTermeApfc(s, terme);
  const pays = apfc.pays ?? "";
  const infoPays = pays ? trouverPays(pays) : undefined;
  const ministere = infoPays?.ministere || "";
  const slogan = infoPays?.devise || "";
  const armoiries = infoPays ? armoiriesUrl(infoPays.code) : null;

  return (
    <div className="apfc-entete-officiel">
      <div className="grid grid-cols-3 items-start gap-2">
        <div className="text-[0.7rem] font-semibold uppercase leading-tight text-forest-900">
          <p>{ministere}</p>
          <p className="mt-2 font-bold">{T(apfc.nom)}</p>
          {apfc.regionNom && <p className="mt-0.5 font-normal normal-case text-ink-700/70">{apfc.regionNom}</p>}
        </div>
        <div className="text-center">
          <p className="font-display text-lg font-bold uppercase tracking-wide text-forest-900">{titre}</p>
          {sousTitre && <p className="text-sm font-semibold text-ink-800">{sousTitre}</p>}
        </div>
        <div className="flex items-start justify-end gap-3">
          <div className="text-center text-[0.7rem] leading-tight text-ink-700/80">
            <p className="font-semibold text-forest-900">
              {pays ? (infoPays?.intitule ?? `RÉPUBLIQUE DE ${pays}`).toUpperCase() : ""}
            </p>
            {armoiries && (
              <Image
                src={armoiries}
                alt={`Armoiries — ${pays}`}
                width={72}
                height={48}
                unoptimized
                priority
                className="mx-auto mt-1 h-12 w-[4.5rem] object-contain"
              />
            )}
            {slogan && <p className="mt-1 italic">{slogan}</p>}
          </div>
          {apfc.logoUrl && (
            <Image
              src={apfc.logoUrl}
              alt={`Logo — ${T(apfc.nom)}`}
              width={56}
              height={56}
              unoptimized
              priority
              className="mt-0.5 h-12 w-12 object-contain"
            />
          )}
        </div>
      </div>
      <hr className="my-3 border-cream-300" />
    </div>
  );
}

const dateLongue = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);

export interface ApfcSignatureInfo {
  chefAntenneNom: string | null;
  chefAntennePrenoms: string | null;
  cachetUrl?: string | null;
  signatureUrl?: string | null;
}

/**
 * Bloc de signature officiel de fin de document : fonction, cachet + signature électronique
 * SUPERPOSÉS (le cachet en légère transparence, la signature au premier plan — comme sur un
 * document papier signé par-dessus le tampon), nom du chef d'antenne, date du jour en toutes
 * lettres. Réservé, comme `EnTeteOfficielApfc`, aux documents d'UNE antenne précise.
 */
export function PiedSignatureApfc({ apfc, terme }: { apfc: ApfcSignatureInfo; terme?: string | null }) {
  const T = (s: string) => appliquerTermeApfc(s, terme);
  const nomComplet = [apfc.chefAntennePrenoms, apfc.chefAntenneNom].filter(Boolean).join(" ").trim();

  return (
    <div className="mt-8 flex justify-end">
      <div className="w-full max-w-xs text-center text-sm">
        <p className="text-xs text-ink-700/60">Fait le {dateLongue(new Date())}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-forest-900">{T("Le Chef d'Antenne")}</p>
        {(apfc.cachetUrl || apfc.signatureUrl) && (
          <div className="relative mx-auto mt-2 flex h-24 w-full items-center justify-center">
            {apfc.cachetUrl && (
              <Image
                src={apfc.cachetUrl}
                alt="Cachet du chef d'antenne"
                width={110}
                height={110}
                unoptimized
                className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 object-contain opacity-60"
              />
            )}
            {apfc.signatureUrl && (
              <Image
                src={apfc.signatureUrl}
                alt="Signature du chef d'antenne"
                width={170}
                height={70}
                unoptimized
                className="relative z-10 h-16 w-auto object-contain"
              />
            )}
          </div>
        )}
        <p className="mt-1 font-display text-sm font-bold text-forest-900">{nomComplet || " "}</p>
      </div>
    </div>
  );
}

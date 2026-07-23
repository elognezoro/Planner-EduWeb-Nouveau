"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, Globe, Phone, UserRound, Save } from "lucide-react";
import { creerStructure, type EtatForm } from "@/lib/formation/actions";
import { FormAlert } from "@/components/ui/form";
import { SelectRecherche } from "@/components/app/select-recherche";
import { appliquerTermeApfc } from "@/lib/apfc-terme";

const inputCls =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

/** Champs texte libres du formulaire (hors cascade Pays → Région). */
type ChampsTexte = {
  nom: string;
  code: string;
  localite: string;
  adresse: string;
  telephone: string;
  email: string;
  responsable: string;
  responsableContact: string;
};
const CHAMPS_VIDES: ChampsTexte = {
  nom: "", code: "", localite: "", adresse: "", telephone: "", email: "", responsable: "", responsableContact: "",
};

/** Titre de section de la maquette : icône + libellé, précédé d'un séparateur fin. */
function TitreSection({ Icone, titre, premier = false }: { Icone: typeof Building2; titre: string; premier?: boolean }) {
  return (
    <h3
      className={`flex items-center gap-2 font-display text-sm font-bold text-forest-900 ${
        premier ? "" : "mt-5 border-t border-cream-100 pt-5"
      }`}
    >
      <Icone size={16} className="text-forest-600" /> {titre}
    </h3>
  );
}

/**
 * Formulaire « Nouvelle APFC » (maquette client) — 4 sections : Informations générales,
 * Localisation, Contact, Responsable d'antenne. La cascade Pays → Région / DRENA repose sur
 * des listes RECHERCHABLES (SelectRecherche) ; le lien reste `regionId` (jamais de texte libre) :
 * la région détermine le pays de l'antenne (socle du cloisonnement), le pays sert de filtre.
 * La création passe par la même action serveur gardée que l'ancien formulaire
 * (`creerStructure("apfc", …)` — RBAC inchangé, validation stricte rejouée côté serveur).
 */
export function FormulaireApfc({
  paysOptions,
  paysDefaut,
  paysVerrouille,
  regions,
  terme,
}: {
  /** Pays distincts du référentiel des régions (le pays consulté y figure toujours). */
  paysOptions: string[];
  /** Pays pré-sélectionné : le pays consulté dans la barre du haut. */
  paysDefaut: string;
  /** Rôle à périmètre « pays » (Super Admin APFC…) : le sélecteur de pays est figé sur le sien. */
  paysVerrouille: boolean;
  regions: { id: string; nom: string; pays: string }[];
  terme: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<EtatForm | null>(null);
  const [champs, setChamps] = useState<ChampsTexte>(CHAMPS_VIDES);
  const [pays, setPays] = useState(paysDefaut);
  const [regionId, setRegionId] = useState("");
  // Clef de remontage des SelectRecherche (composants non contrôlés) — bumpée par « Annuler ».
  const [cle, setCle] = useState(0);
  const T = (s: string) => appliquerTermeApfc(s, terme);

  const poser = (champ: keyof ChampsTexte) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setChamps((c) => ({ ...c, [champ]: e.target.value }));

  const regionsDuPays = useMemo(() => regions.filter((r) => r.pays === pays), [regions, pays]);

  const reinitialiser = () => {
    setChamps(CHAMPS_VIDES);
    setPays(paysDefaut);
    setRegionId("");
    setMsg(null);
    setCle((c) => c + 1);
  };

  // La région reste OBLIGATOIRE (elle détermine le pays de l'antenne — cloisonnement) ;
  // le pays de la cascade sert de filtre et est revérifié côté serveur.
  const soumettable = champs.nom.trim() !== "" && pays !== "" && regionId !== "";

  const creer = () =>
    start(async () => {
      const r = await creerStructure("apfc", champs.nom, {
        regionId,
        pays,
        code: champs.code,
        localite: champs.localite,
        adresse: champs.adresse,
        telephone: champs.telephone,
        email: champs.email,
        responsable: champs.responsable,
        responsableContact: champs.responsableContact,
      });
      setMsg(r);
      if (r.ok) {
        setChamps(CHAMPS_VIDES);
        setRegionId("");
        setCle((c) => c + 1);
      }
    });

  return (
    <div>
      {msg?.message && (
        <div className="mb-3">
          <FormAlert ton={msg.ok ? "succes" : "erreur"}>{msg.message}</FormAlert>
        </div>
      )}

      {/* 1. Informations générales */}
      <TitreSection Icone={Building2} titre="Informations générales" premier />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-sm font-medium text-forest-900">
            {T("Nom de l'APFC")} <span className="text-red-600">*</span>
          </span>
          <input value={champs.nom} onChange={poser("nom")} placeholder={T("Ex : APFC d'Abidjan 1")} className={inputCls} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-forest-900">{T("Code APFC")}</span>
          <input value={champs.code} onChange={poser("code")} placeholder={T("Ex : APFC-ABJ-001")} className={inputCls} />
        </label>
      </div>

      {/* 2. Localisation — cascade Pays → Région / DRENA (listes recherchables) */}
      <TitreSection Icone={Globe} titre="Localisation" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-forest-900">
            Pays <span className="text-red-600">*</span>
          </span>
          <SelectRecherche
            key={`pays-${cle}`}
            name="pays"
            options={paysOptions.map((p) => ({ id: p, nom: p }))}
            defaut={{ id: paysDefaut, nom: paysDefaut }}
            disabled={paysVerrouille}
            onSelect={(o) => {
              setPays(o?.id ?? "");
              setRegionId("");
            }}
          />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-forest-900">Région / DRENA</span>
          <SelectRecherche
            key={`region-${cle}-${pays}`}
            name="regionId"
            options={regionsDuPays}
            placeholder="Ex : DRENA Abidjan 1"
            effacable
            onSelect={(o) => setRegionId(o?.id ?? "")}
          />
        </div>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-forest-900">Localité</span>
          <input value={champs.localite} onChange={poser("localite")} placeholder="Ex : Cocody" className={inputCls} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-forest-900">Adresse</span>
          <input value={champs.adresse} onChange={poser("adresse")} placeholder="Ex : BP 221" className={inputCls} />
        </label>
      </div>
      <p className="mt-2 text-xs text-ink-700/55">
        {T("La région / DRENA détermine le pays de rattachement de l'APFC (choix requis pour créer l'antenne).")}
      </p>

      {/* 3. Contact */}
      <TitreSection Icone={Phone} titre="Contact" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-sm font-medium text-forest-900">Téléphone</span>
          <input value={champs.telephone} onChange={poser("telephone")} placeholder="Ex : 27 35 91 35 02" className={inputCls} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-forest-900">Email</span>
          <input
            type="email"
            value={champs.email}
            onChange={poser("email")}
            placeholder="Ex : apfc.abidjan@formation.ci"
            className={inputCls}
          />
        </label>
      </div>

      {/* 4. Responsable d'antenne */}
      <TitreSection Icone={UserRound} titre="Responsable d'antenne" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-sm font-medium text-forest-900">Nom du responsable</span>
          <input
            value={champs.responsable}
            onChange={poser("responsable")}
            placeholder="Ex : M. BAMBA Issouf"
            className={inputCls}
          />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-forest-900">Contact du responsable</span>
          <input
            value={champs.responsableContact}
            onChange={poser("responsableContact")}
            placeholder="Ex : 07 00 00 00 00"
            className={inputCls}
          />
        </label>
      </div>

      {/* Pied : Annuler / Créer l'APFC */}
      <div className="mt-5 flex justify-end gap-2 border-t border-cream-100 pt-4">
        <button
          type="button"
          disabled={pending}
          onClick={reinitialiser}
          className="inline-flex h-10 items-center rounded-full border border-cream-300 bg-white px-5 text-sm font-semibold text-ink-700/80 hover:bg-cream-100 disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={pending || !soumettable}
          onClick={creer}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
        >
          <Save size={15} /> {T("Créer l'APFC")}
        </button>
      </div>
    </div>
  );
}

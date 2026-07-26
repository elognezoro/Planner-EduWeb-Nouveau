"use client";

/**
 * Onglet IMMOBILISATIONS (15) : tableau de bord patrimonial, fiches d'actifs (passeport
 * dépliable : identité, plan d'amortissement DÉRIVÉ, dotations comptabilisées, maintenance,
 * timeline), création manuelle ou DEPUIS le stock (RM-1104), cycle de vie (mise en service
 * RM-1201, transitions, affectation, réévaluation), comptabilisation des dotations (RM-1202),
 * sortie d'actif (RM-1203, second acteur), FICHE D'ACTIF et ÉTAT DES AMORTISSEMENTS
 * imprimables A4. Confirmations 2 clics, jamais de dialogue natif.
 */

import { useActionState, useState } from "react";
import {
  Ban, Boxes, Building2, Calculator, Check, ChevronDown, ChevronRight,
  ClipboardList, Coins, HardHat, MapPin, Pencil, Plus, Printer, Repeat, Trash2, Wrench, X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import type { EtatForm } from "@/lib/finances/actions";
import {
  affecterImmobilisation, changerEtatImmobilisation, comptabiliserDotations,
  creerImmobilisationDepuisStock, enregistrerImmobilisation, enregistrerMaintenance,
  mettreEnServiceImmobilisation, reevaluerImmobilisation, retirerImmobilisation,
  retirerMaintenance, sortirImmobilisation,
} from "@/lib/finances/actions-immobilisations";
import {
  CATEGORIES_IMMO, ETATS_ACTIFS_IMMO, LIBELLE_CATEGORIE_IMMO, LIBELLE_ETAT_IMMO,
  MODES_ACQUISITION, TRANSITIONS_IMMO, TYPES_MAINTENANCE, TYPES_SORTIE_IMMO,
  type DonneesImmobilisationsVue, type ImmobilisationVue,
} from "@/lib/finances/immobilisations/types";
import type { PersonnelVue } from "@/lib/finances/commun/permissions";
import type { EnteteEtablissement } from "./finances-vue";
import { BoutonActionConfirmee } from "./scolarite-plus";
import { useApresSucces } from "./scolarite-onglets";
import { fcfa, type ArticleVue } from "./types";

const INITIAL: EtatForm = { ok: false };
const dateFr = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso)) : "—";
const auj = () => new Date().toISOString().slice(0, 10);

export interface DroitsImmoUi {
  gerer: boolean;
  amortir: boolean;
  sortir: boolean;
}

const BADGE_ETAT: Record<string, string> = {
  acquisition: "bg-cream-200 text-forest-800",
  installation: "bg-cream-200 text-forest-800",
  service: "bg-forest-50 text-forest-800",
  maintenance: "bg-amber-50 text-amber-700",
  hors_service: "bg-amber-50 text-amber-700",
  cession: "bg-gold-100 text-gold-800",
  reforme: "bg-red-50 text-red-600",
  detruite: "bg-red-50 text-red-600",
  perdue: "bg-red-50 text-red-600",
  archive: "bg-cream-200 text-ink-700/60",
};

export function OngletImmobilisations({
  etablissementId, donnees, fournisseurs, personnel, articlesImmobilisables, entete, droits,
}: {
  etablissementId: string;
  donnees: DonneesImmobilisationsVue;
  fournisseurs: { id: string; nom: string }[];
  personnel: PersonnelVue[];
  articlesImmobilisables: ArticleVue[];
  entete: EnteteEtablissement;
  droits: DroitsImmoUi;
}) {
  const [enEdition, setEnEdition] = useState<ImmobilisationVue | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [depuisStock, setDepuisStock] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [etatImprime, setEtatImprime] = useState(false);
  const [ficheImprimee, setFicheImprimee] = useState<ImmobilisationVue | null>(null);
  const tb = donnees.tableauBord;

  const stats = [
    { libelle: "Actifs", valeur: String(tb.nbActifs) },
    { libelle: "Valeur brute", valeur: fcfa(tb.valeurBrute) },
    { libelle: "Amortissements cumulés", valeur: fcfa(tb.amortissementsCumules) },
    { libelle: "Valeur nette comptable", valeur: fcfa(tb.valeurNette) },
    { libelle: "En maintenance / hors service", valeur: `${tb.enMaintenance} / ${tb.horsService}`, alerte: tb.horsService > 0 },
    { libelle: "Garanties expirant", valeur: String(tb.garantiesExpirant), alerte: tb.garantiesExpirant > 0 },
    { libelle: "Dotations dues", valeur: String(tb.dotationsDues), alerte: tb.dotationsDues > 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {stats.map((s) => (
          <div key={s.libelle} className="rounded-2xl border border-cream-200 bg-white p-3 shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-700/55">{s.libelle}</p>
            <p className={`mt-1 font-display text-sm font-bold ${s.alerte ? "text-amber-700" : "text-forest-900"}`}>{s.valeur}</p>
          </div>
        ))}
      </div>

      {tb.parCategorie.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <Boxes size={16} className="text-forest-600" /> Valorisation par catégorie
            </h3>
            <button type="button" onClick={() => setEtatImprime(true)} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
              <Printer size={11} /> État des amortissements
            </button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {tb.parCategorie.map((c) => (
              <li key={c.categorie} className="rounded-full bg-cream-100 px-3 py-1.5">
                <strong>{c.libelle}</strong> — {c.nombre} · brut {fcfa(c.valeurBrute)} · VNC {fcfa(c.vnc)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {droits.gerer && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <Building2 size={17} className="text-forest-600" />
              {enEdition ? `Modifier ${enEdition.code}` : "Nouvelle immobilisation"}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setEnEdition(null); setDepuisStock(false); setFormOuvert((v) => !v); }}
                className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
              >
                <Plus size={13} /> Fiche manuelle
              </button>
              {articlesImmobilisables.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setDepuisStock((v) => !v); setFormOuvert(false); setEnEdition(null); }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3.5 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
                >
                  <Repeat size={13} /> Depuis le stock (RM-1104)
                </button>
              )}
            </div>
          </div>
          {(formOuvert || enEdition) && (
            <FormImmobilisation
              key={enEdition?.id ?? "nouveau"}
              etablissementId={etablissementId}
              fournisseurs={fournisseurs}
              personnel={personnel}
              enEdition={enEdition}
              onFin={() => { setEnEdition(null); setFormOuvert(false); }}
            />
          )}
          {depuisStock && (
            <FormDepuisStock
              etablissementId={etablissementId}
              articles={articlesImmobilisables}
              onFin={() => setDepuisStock(false)}
            />
          )}
        </Card>
      )}

      <Card>
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <ClipboardList size={17} className="text-forest-600" /> Patrimoine ({donnees.immobilisations.length})
        </h3>
        {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
        {donnees.immobilisations.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Aucune immobilisation enregistrée.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {donnees.immobilisations.map((i) => (
              <FicheActif
                key={i.id}
                etablissementId={etablissementId}
                immo={i}
                personnel={personnel}
                droits={droits}
                onModifier={() => { setEnEdition(i); setFormOuvert(true); setDepuisStock(false); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }}
                onImprimer={() => setFicheImprimee(i)}
                onMessage={setMessage}
              />
            ))}
          </ul>
        )}
      </Card>

      {ficheImprimee && <FicheActifImprimable immo={ficheImprimee} entete={entete} onFermer={() => setFicheImprimee(null)} />}
      {etatImprime && <EtatAmortissementsImprimable donnees={donnees} entete={entete} onFermer={() => setEtatImprime(false)} />}
    </div>
  );
}

// ─── Formulaire fiche ───

function FormImmobilisation({
  etablissementId, fournisseurs, personnel, enEdition, onFin,
}: {
  etablissementId: string;
  fournisseurs: { id: string; nom: string }[];
  personnel: PersonnelVue[];
  enEdition: ImmobilisationVue | null;
  onFin: () => void;
}) {
  const [etat, action] = useActionState(enregistrerImmobilisation, INITIAL);
  const [categorie, setCategorie] = useState(enEdition?.categorie ?? "materiel_informatique");
  useApresSucces(etat, onFin);
  const cat = CATEGORIES_IMMO.find((c) => c.code === categorie);
  const enService = enEdition !== null && enEdition.statut !== "acquisition" && enEdition.statut !== "installation";

  return (
    <form action={action} className="mt-3 grid gap-3 rounded-xl border border-cream-200 bg-cream-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
      {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}
      <div className="sm:col-span-2">
        <Label htmlFor="im-designation">Désignation *</Label>
        <Input id="im-designation" name="designation" required maxLength={160} defaultValue={enEdition?.designation ?? ""} />
      </div>
      <div>
        <Label htmlFor="im-categorie">Catégorie</Label>
        <Select id="im-categorie" name="categorie" value={categorie} onChange={(e) => setCategorie(e.target.value)} disabled={enService}>
          {CATEGORIES_IMMO.map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="im-souscat">Sous-catégorie</Label>
        <Input id="im-souscat" name="sousCategorie" maxLength={80} defaultValue={enEdition?.sousCategorie ?? ""} />
      </div>
      <div>
        <Label htmlFor="im-cout">Coût d&apos;acquisition (FCFA) *</Label>
        <Input id="im-cout" name="coutAcquisition" type="number" min={1} required defaultValue={enEdition?.coutAcquisition ?? ""} disabled={enService} />
      </div>
      <div>
        <Label htmlFor="im-residuelle">Valeur résiduelle (FCFA)</Label>
        <Input id="im-residuelle" name="valeurResiduelle" type="number" min={0} defaultValue={enEdition?.valeurResiduelle ?? 0} disabled={enService} />
      </div>
      <div>
        <Label htmlFor="im-duree">Durée d&apos;utilisation (mois)</Label>
        <Input id="im-duree" name="dureeMois" type="number" min={1} max={1200} defaultValue={enEdition?.dureeMois ?? cat?.dureeMoisDefaut ?? 60} disabled={enService} placeholder={String(cat?.dureeMoisDefaut ?? 60)} />
        {cat && !cat.amortissable && <p className="mt-1 text-[11px] text-ink-700/50">Catégorie non amortissable.</p>}
      </div>
      <div>
        <Label htmlFor="im-mode">Mode d&apos;acquisition</Label>
        <Select id="im-mode" name="modeAcquisition" defaultValue={enEdition?.modeAcquisition ?? "achat"}>
          {MODES_ACQUISITION.map((m) => <option key={m.code} value={m.code}>{m.libelle}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="im-acq">Date d&apos;acquisition</Label>
        <Input id="im-acq" name="dateAcquisition" type="date" defaultValue={(enEdition?.dateAcquisition ?? new Date().toISOString()).slice(0, 10)} />
      </div>
      <div>
        <Label htmlFor="im-serie">N° de série</Label>
        <Input id="im-serie" name="numeroSerie" maxLength={80} defaultValue={enEdition?.numeroSerie ?? ""} />
      </div>
      <div>
        <Label htmlFor="im-fournisseur">Fournisseur</Label>
        <Select id="im-fournisseur" name="fournisseurId" defaultValue="">
          <option value="">—</option>
          {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="im-facture">Facture d&apos;origine</Label>
        <Input id="im-facture" name="factureReference" maxLength={120} defaultValue={enEdition?.factureReference ?? ""} />
      </div>
      <div>
        <Label htmlFor="im-resp">Responsable</Label>
        <Select id="im-resp" name="responsableId" defaultValue="">
          <option value="">—</option>
          {personnel.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </Select>
      </div>
      <div className="lg:col-span-2">
        <Label htmlFor="im-loc">Localisation</Label>
        <Input id="im-loc" name="localisation" maxLength={200} defaultValue={enEdition?.localisation ?? ""} placeholder="Site A › Bâtiment B › Salle 12" />
      </div>
      <div>
        <Label htmlFor="im-garantie">Garantie (fournisseur)</Label>
        <Input id="im-garantie" name="garantieFournisseur" maxLength={120} defaultValue={enEdition?.garantieFournisseur ?? ""} />
      </div>
      <div>
        <Label htmlFor="im-garecheance">Garantie — échéance</Label>
        <Input id="im-garecheance" name="garantieEcheance" type="date" defaultValue={enEdition?.garantieEcheance?.slice(0, 10) ?? ""} />
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <Label htmlFor="im-desc">Description</Label>
        <Input id="im-desc" name="description" maxLength={400} defaultValue={enEdition?.description ?? ""} />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
        <SubmitButton>{enEdition ? "Mettre à jour" : "Créer la fiche"}</SubmitButton>
        <button type="button" onClick={onFin} className="rounded-full border border-cream-300 px-4 py-2 text-xs font-semibold text-ink-700/70 hover:bg-cream-100">Abandonner</button>
        {enService && <span className="text-[11px] text-ink-700/50">Actif en service : coût, durée et catégorie sont figés.</span>}
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      </div>
    </form>
  );
}

function FormDepuisStock({
  etablissementId, articles, onFin,
}: {
  etablissementId: string;
  articles: ArticleVue[];
  onFin: () => void;
}) {
  const [etat, action] = useActionState(creerImmobilisationDepuisStock, INITIAL);
  const [articleId, setArticleId] = useState("");
  useApresSucces(etat, onFin);
  const article = articles.find((a) => a.id === articleId);
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-xl border border-forest-200 bg-cream-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <div className="sm:col-span-2">
        <Label htmlFor="ds-article">Article immobilisable (stock)</Label>
        <Select id="ds-article" name="articleId" required value={articleId} onChange={(e) => setArticleId(e.target.value)}>
          <option value="" disabled>Choisir…</option>
          {articles.map((a) => <option key={a.id} value={a.id}>{a.nom} (stock {a.stock})</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="ds-cat">Catégorie d&apos;actif</Label>
        <Select id="ds-cat" name="categorie" defaultValue="materiel_informatique">
          {CATEGORIES_IMMO.filter((c) => c.code !== "terrain").map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="ds-cout">Coût unitaire (FCFA)</Label>
        <Input id="ds-cout" name="coutAcquisition" type="number" min={1} defaultValue={article?.prixAchat ?? ""} placeholder="CUMP par défaut" />
      </div>
      <div>
        <Label htmlFor="ds-designation">Désignation</Label>
        <Input id="ds-designation" name="designation" maxLength={160} defaultValue={article?.nom ?? ""} />
      </div>
      <div>
        <Label htmlFor="ds-serie">N° de série</Label>
        <Input id="ds-serie" name="numeroSerie" maxLength={80} />
      </div>
      <div>
        <Label htmlFor="ds-duree">Durée (mois)</Label>
        <Input id="ds-duree" name="dureeMois" type="number" min={1} max={1200} placeholder="défaut catégorie" />
      </div>
      <div>
        <Label htmlFor="ds-date">Mise en service le</Label>
        <Input id="ds-date" name="dateMiseEnService" type="date" defaultValue={auj()} />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
        <SubmitButton>Sortir du stock &amp; mettre en service</SubmitButton>
        <button type="button" onClick={onFin} className="rounded-full border border-cream-300 px-4 py-2 text-xs font-semibold text-ink-700/70 hover:bg-cream-100">Fermer</button>
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      </div>
    </form>
  );
}

// ─── Fiche dépliable ───

type VoletFiche = "identite" | "amortissement" | "maintenance" | "passeport";

function FicheActif({
  etablissementId, immo: i, personnel, droits, onModifier, onImprimer, onMessage,
}: {
  etablissementId: string;
  immo: ImmobilisationVue;
  personnel: PersonnelVue[];
  droits: DroitsImmoUi;
  onModifier: () => void;
  onImprimer: () => void;
  onMessage: (m: string | null) => void;
}) {
  const [ouverte, setOuverte] = useState(false);
  const [volet, setVolet] = useState<VoletFiche>("identite");
  const [motif, setMotif] = useState("");
  const transitions = TRANSITIONS_IMMO[i.statut] ?? [];
  const enService = ETATS_ACTIFS_IMMO.includes(i.statut);
  const sorti = i.dateSortie !== null;

  return (
    <li className="rounded-2xl border border-cream-200 bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-forest-900">
            <button type="button" onClick={() => setOuverte((v) => !v)} className="rounded-full p-0.5 text-forest-700 hover:bg-forest-50" aria-label="Fiche">
              {ouverte ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <span className="font-mono text-xs">{i.code}</span> {i.designation}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_ETAT[i.statut] ?? BADGE_ETAT.acquisition}`}>
              {LIBELLE_ETAT_IMMO[i.statut] ?? i.statut}
            </span>
            {i.dotationDue && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Dotation due</span>}
            {i.garantieExpire && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Garantie expirant</span>}
          </p>
          <p className="mt-0.5 text-xs text-ink-700/60">
            {LIBELLE_CATEGORIE_IMMO[i.categorie] ?? i.categorie} · brut {fcfa(i.valeurBrute)} · VNC {fcfa(i.vncComptable)}
            {i.dateMiseEnService ? ` · en service le ${dateFr(i.dateMiseEnService)}` : " · pas encore en service"}
            {i.localisation ? ` · ${i.localisation}` : ""}{i.responsableNom ? ` · ${i.responsableNom}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={onImprimer} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
            <Printer size={11} /> Fiche
          </button>
          {droits.gerer && !sorti && (
            <button type="button" onClick={onModifier} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
              <Pencil size={11} /> Modifier
            </button>
          )}
          {droits.gerer && (i.statut === "acquisition" || i.statut === "installation") && (
            <MiseEnService etablissementId={etablissementId} immo={i} onMessage={onMessage} />
          )}
          {droits.amortir && i.dotationDue && (
            <BoutonActionConfirmee
              libelle="Comptabiliser dotations" icone={Calculator} ton="primaire" action={comptabiliserDotations}
              champs={{ etablissementId, id: i.id, annee: String(new Date().getUTCFullYear()) }}
              onSucces={(m) => onMessage(m ?? "Dotations comptabilisées.")}
            />
          )}
          {droits.gerer && (i.statut === "acquisition" || i.statut === "installation") && (
            <BoutonActionConfirmee
              libelle="Retirer" icone={Trash2} ton="danger" action={retirerImmobilisation}
              champs={{ etablissementId, id: i.id, version: String(i.version) }}
              onSucces={(m) => onMessage(m ?? "Fiche retirée.")}
            />
          )}
        </div>
      </div>

      {ouverte && (
        <div className="mt-3 space-y-3 rounded-xl bg-cream-50/70 p-3">
          <div className="flex flex-wrap gap-1.5">
            {([
              { cle: "identite", libelle: "Identité & cycle de vie", Icone: ClipboardList },
              { cle: "amortissement", libelle: `Amortissement (${i.dotations.length})`, Icone: Calculator },
              { cle: "maintenance", libelle: `Maintenance (${i.maintenances.length})`, Icone: Wrench },
              { cle: "passeport", libelle: `Passeport (${i.evenements.length})`, Icone: MapPin },
            ] as { cle: VoletFiche; libelle: string; Icone: typeof ClipboardList }[]).map((v) => (
              <button
                key={v.cle}
                type="button"
                onClick={() => setVolet(v.cle)}
                className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[11px] font-semibold ${
                  volet === v.cle ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 bg-white text-ink-700/70 hover:bg-cream-100"
                }`}
              >
                <v.Icone size={11} /> {v.libelle}
              </button>
            ))}
          </div>

          {volet === "identite" && (
            <div className="space-y-3 text-xs">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {[
                  ["N° de série", i.numeroSerie],
                  ["Mode d'acquisition", MODES_ACQUISITION.find((m) => m.code === i.modeAcquisition)?.libelle ?? i.modeAcquisition],
                  ["Fournisseur", i.fournisseurNom],
                  ["Facture d'origine", i.factureReference],
                  ["Coût d'acquisition", fcfa(i.coutAcquisition)],
                  ["Valeur résiduelle", fcfa(i.valeurResiduelle)],
                  ["Durée", `${i.dureeMois} mois`],
                  ["Compte immo / amort.", `${i.compteImmo}${i.compteAmort ? ` / ${i.compteAmort}` : ""}`],
                  ["Garantie", i.garantieFournisseur ? `${i.garantieFournisseur}${i.garantieEcheance ? ` (échéance ${dateFr(i.garantieEcheance)})` : ""}` : null],
                  ["Description", i.description],
                  i.origineArticleId ? ["Origine", "Article de stock (RM-1205)"] : null,
                  sorti ? ["Sortie", `${TYPES_SORTIE_IMMO.find((t) => t.code === i.typeSortie)?.libelle ?? i.typeSortie} le ${dateFr(i.dateSortie)} — ${i.motifSortie ?? ""}`] : null,
                ].filter((x): x is [string, string] => Array.isArray(x) && Boolean(x[1])).map(([l, v]) => (
                  <p key={l}><strong className="text-forest-900">{l} :</strong> {v}</p>
                ))}
              </div>
              {droits.gerer && !sorti && (
                <div className="flex flex-wrap items-center gap-2 border-t border-cream-200 pt-2">
                  {transitions.map((cible) => (
                    <BoutonActionConfirmee
                      key={cible}
                      libelle={`→ ${LIBELLE_ETAT_IMMO[cible]}`} icone={HardHat} action={changerEtatImmobilisation}
                      champs={{ etablissementId, id: i.id, version: String(i.version), cible, motif: "" }}
                      onSucces={(m) => onMessage(m ?? "État mis à jour.")}
                    />
                  ))}
                  {enService && droits.amortir && (
                    <Reevaluation etablissementId={etablissementId} immo={i} onMessage={onMessage} />
                  )}
                  {enService && droits.sortir && (
                    <SortieActif etablissementId={etablissementId} immo={i} onMessage={onMessage} />
                  )}
                  <Affectation etablissementId={etablissementId} immo={i} personnel={personnel} onMessage={onMessage} />
                </div>
              )}
            </div>
          )}

          {volet === "amortissement" && (
            <div className="space-y-2 text-xs">
              <p className="text-ink-700/70">
                Amortissement linéaire · comptabilisé {fcfa(i.amortiComptabilise)} · théorique à ce jour {fcfa(i.amortiTheorique)} · VNC comptable {fcfa(i.vncComptable)}.
              </p>
              {i.plan.length === 0 ? (
                <p className="text-ink-700/60">{i.amortissable ? "Actif pas encore en service : plan indisponible (RM-1201)." : "Actif non amortissable."}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px]">
                    <thead>
                      <tr className="border-b border-cream-200 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-700/50">
                        <th className="px-2 py-1">Exercice</th>
                        <th className="px-2 py-1 text-right">Dotation</th>
                        <th className="px-2 py-1 text-right">Cumul</th>
                        <th className="px-2 py-1 text-right">VNC</th>
                        <th className="px-2 py-1">Comptabilisé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {i.plan.map((l) => {
                        const faite = i.dotations.some((d) => d.periode === String(l.annee));
                        return (
                          <tr key={l.annee} className="border-b border-cream-100">
                            <td className="px-2 py-1">{l.annee}</td>
                            <td className="px-2 py-1 text-right">{fcfa(l.dotation)}</td>
                            <td className="px-2 py-1 text-right">{fcfa(l.cumul)}</td>
                            <td className="px-2 py-1 text-right">{fcfa(l.vnc)}</td>
                            <td className="px-2 py-1">{faite ? <span className="text-forest-800">✓ oui</span> : <span className="text-ink-700/40">non</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {volet === "maintenance" && (
            <VoletMaintenance etablissementId={etablissementId} immo={i} droits={droits} onMessage={onMessage} />
          )}

          {volet === "passeport" && (
            <ul className="space-y-1.5 text-xs">
              {i.evenements.map((e) => (
                <li key={e.id} className="flex items-start gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
                  <span className="text-ink-700/50 whitespace-nowrap">{dateFr(e.date)}</span>
                  <span>{e.description}{e.parNom ? ` — ${e.parNom}` : ""}</span>
                </li>
              ))}
              {i.evenements.length === 0 && <li className="text-ink-700/60">Aucun événement.</li>}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function MiseEnService({ etablissementId, immo, onMessage }: { etablissementId: string; immo: ImmobilisationVue; onMessage: (m: string | null) => void }) {
  const [date, setDate] = useState(auj());
  return (
    <span className="inline-flex items-center gap-1">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-36 text-xs" />
      <BoutonActionConfirmee
        libelle="Mettre en service" icone={Check} ton="primaire" action={mettreEnServiceImmobilisation}
        champs={{ etablissementId, id: immo.id, version: String(immo.version), dateMiseEnService: date }}
        onSucces={(m) => onMessage(m ?? "Actif en service.")}
      />
    </span>
  );
}

function Reevaluation({ etablissementId, immo, onMessage }: { etablissementId: string; immo: ImmobilisationVue; onMessage: (m: string | null) => void }) {
  const [valeur, setValeur] = useState("");
  const [justif, setJustif] = useState("");
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Input type="number" min={1} value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="Nouvelle valeur" className="h-8 w-32 text-xs" />
      <Input value={justif} onChange={(e) => setJustif(e.target.value)} maxLength={300} placeholder="Justification" className="h-8 w-40 text-xs" />
      <BoutonActionConfirmee
        libelle="Réévaluer" icone={Coins} action={reevaluerImmobilisation}
        champs={{ etablissementId, id: immo.id, version: String(immo.version), nouvelleValeur: valeur, justification: justif }}
        desactive={!valeur || justif.trim().length === 0}
        onSucces={(m) => { onMessage(m ?? "Réévaluation enregistrée."); setValeur(""); setJustif(""); }}
      />
    </span>
  );
}

function SortieActif({ etablissementId, immo, onMessage }: { etablissementId: string; immo: ImmobilisationVue; onMessage: (m: string | null) => void }) {
  const [type, setType] = useState("reforme");
  const [motif, setMotif] = useState("");
  const [piece, setPiece] = useState("");
  const [valeur, setValeur] = useState("");
  return (
    <span className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-red-200 bg-red-50/40 p-1">
      <Select value={type} onChange={(e) => setType(e.target.value)} className="h-8 w-28 text-xs">
        {TYPES_SORTIE_IMMO.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
      </Select>
      {type === "vente" && <Input type="number" min={0} value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="Produit cession" className="h-8 w-28 text-xs" />}
      <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif *" className="h-8 w-32 text-xs" />
      <Input value={piece} onChange={(e) => setPiece(e.target.value)} maxLength={120} placeholder="Pièce *" className="h-8 w-28 text-xs" />
      <BoutonActionConfirmee
        libelle="Sortir" icone={Ban} ton="danger" action={sortirImmobilisation}
        champs={{ etablissementId, id: immo.id, version: String(immo.version), typeSortie: type, motif, pieceJustificative: piece, valeurCession: valeur }}
        desactive={motif.trim().length === 0 || piece.trim().length === 0}
        onSucces={(m) => { onMessage(m ?? "Actif sorti."); setMotif(""); setPiece(""); setValeur(""); }}
      />
    </span>
  );
}

function Affectation({ etablissementId, immo, personnel, onMessage }: { etablissementId: string; immo: ImmobilisationVue; personnel: PersonnelVue[]; onMessage: (m: string | null) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState(affecterImmobilisation, INITIAL);
  useApresSucces(etat, () => { setOuvert(false); onMessage(etat.message ?? "Affectation mise à jour."); });
  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
        <MapPin size={11} /> Affecter / déplacer
      </button>
    );
  }
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-1">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input type="hidden" name="id" value={immo.id} />
      <input type="hidden" name="version" value={String(immo.version)} />
      <Input name="localisation" maxLength={200} defaultValue={immo.localisation ?? ""} placeholder="Localisation" className="h-8 w-44 text-xs" />
      <Select name="responsableId" defaultValue="" className="h-8 w-36 text-xs">
        <option value="">Responsable…</option>
        {personnel.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
      </Select>
      <SubmitButton>Appliquer</SubmitButton>
      <button type="button" onClick={() => setOuvert(false)} className="rounded-full border border-cream-300 px-2.5 py-1 text-[11px] text-ink-700/70 hover:bg-cream-100"><X size={12} /></button>
    </form>
  );
}

function VoletMaintenance({ etablissementId, immo, droits, onMessage }: { etablissementId: string; immo: ImmobilisationVue; droits: DroitsImmoUi; onMessage: (m: string | null) => void }) {
  const [etat, action] = useActionState(enregistrerMaintenance, INITIAL);
  const [ouvert, setOuvert] = useState(false);
  useApresSucces(etat, () => setOuvert(false));
  return (
    <div className="space-y-2 text-xs">
      {immo.maintenances.map((m) => (
        <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
          <span>
            <strong>{TYPES_MAINTENANCE.find((t) => t.code === m.type)?.libelle ?? m.type}</strong> — {m.description}
            {m.prestataire ? ` · ${m.prestataire}` : ""}
            {m.datePrevue ? ` · prévue ${dateFr(m.datePrevue)}` : ""}{m.dateRealisee ? ` · réalisée ${dateFr(m.dateRealisee)}` : ""}
            {m.coutReel !== null ? ` · ${fcfa(m.coutReel)}` : m.coutPrevu !== null ? ` · prévu ${fcfa(m.coutPrevu)}` : ""}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${m.statut === "realisee" ? "bg-forest-50 text-forest-800" : "bg-amber-50 text-amber-700"}`}>
              {m.statut === "realisee" ? "Réalisée" : "Planifiée"}
            </span>
          </span>
          {droits.gerer && (
            <BoutonActionConfirmee
              libelle="Retirer" icone={Trash2} ton="danger" action={retirerMaintenance}
              champs={{ etablissementId, id: m.id, version: String(m.version) }}
              onSucces={(msg) => onMessage(msg ?? "Maintenance retirée.")}
            />
          )}
        </div>
      ))}
      {immo.maintenances.length === 0 && <p className="text-ink-700/60">Aucune maintenance.</p>}
      {droits.gerer && (
        !ouvert ? (
          <button type="button" onClick={() => setOuvert(true)} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
            <Plus size={11} /> Planifier / enregistrer une maintenance
          </button>
        ) : (
          <form action={action} className="grid gap-2 rounded-lg border border-cream-200 bg-white p-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <input type="hidden" name="immobilisationId" value={immo.id} />
            <Select name="type" defaultValue="preventive" className="h-8 text-xs">
              {TYPES_MAINTENANCE.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
            </Select>
            <Input name="prestataire" maxLength={120} placeholder="Prestataire" className="h-8 text-xs" />
            <Input name="datePrevue" type="date" className="h-8 text-xs" />
            <Input name="dateRealisee" type="date" className="h-8 text-xs" />
            <Input name="coutPrevu" type="number" min={0} placeholder="Coût prévu" className="h-8 text-xs" />
            <Input name="coutReel" type="number" min={0} placeholder="Coût réel" className="h-8 text-xs" />
            <Input name="description" required maxLength={300} placeholder="Description *" className="h-8 text-xs sm:col-span-2" />
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
              <SubmitButton>Enregistrer</SubmitButton>
              <button type="button" onClick={() => setOuvert(false)} className="rounded-full border border-cream-300 px-3 py-1.5 text-[11px] text-ink-700/70 hover:bg-cream-100">Fermer</button>
              {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
            </div>
          </form>
        )
      )}
    </div>
  );
}

// ─── Documents imprimables A4 ───

function FicheActifImprimable({ immo: i, entete, onFermer }: { immo: ImmobilisationVue; entete: EnteteEtablissement; onFermer: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`@media print { body * { visibility: hidden; } #fiche-actif-impression, #fiche-actif-impression * { visibility: visible; } #fiche-actif-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; overflow: visible; } @page { size: A4 portrait; margin: 12mm; } }`}</style>
      <div id="fiche-actif-impression" className="mx-auto my-8 w-full max-w-2xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Fiche d&apos;actif</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100" aria-label="Fermer"><X size={16} /></button>
        </div>
        <EnTeteOfficielDoc etab={entete} titre="FICHE D'IMMOBILISATION" sousTitre={`${i.code} — ${i.designation}`} />
        <div className="mt-4 grid grid-cols-2 gap-1.5 text-sm">
          {[
            ["Catégorie", LIBELLE_CATEGORIE_IMMO[i.categorie] ?? i.categorie],
            ["N° de série", i.numeroSerie ?? "—"],
            ["Date d'acquisition", dateFr(i.dateAcquisition)],
            ["Mise en service", dateFr(i.dateMiseEnService)],
            ["Coût d'acquisition", fcfa(i.coutAcquisition)],
            ["Valeur brute", fcfa(i.valeurBrute)],
            ["Amortissement cumulé", fcfa(i.amortiComptabilise)],
            ["Valeur nette comptable", fcfa(i.vncComptable)],
            ["Durée", `${i.dureeMois} mois`],
            ["État", LIBELLE_ETAT_IMMO[i.statut] ?? i.statut],
            ["Localisation", i.localisation ?? "—"],
            ["Responsable", i.responsableNom ?? "—"],
          ].map(([l, v]) => (
            <p key={l}><strong>{l} :</strong> {v}</p>
          ))}
        </div>
        {i.plan.length > 0 && (
          <>
            <h3 className="mt-5 font-display text-sm font-bold text-forest-900">Plan d&apos;amortissement</h3>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-y-2 border-forest-800 text-left text-xs uppercase tracking-wide">
                  <th className="py-1.5 pr-2">Exercice</th>
                  <th className="py-1.5 pr-2 text-right">Dotation</th>
                  <th className="py-1.5 pr-2 text-right">Cumul</th>
                  <th className="py-1.5 text-right">VNC</th>
                </tr>
              </thead>
              <tbody>
                {i.plan.map((l) => (
                  <tr key={l.annee} className="border-b border-cream-200">
                    <td className="py-1 pr-2">{l.annee}</td>
                    <td className="py-1 pr-2 text-right">{fcfa(l.dotation)}</td>
                    <td className="py-1 pr-2 text-right">{fcfa(l.cumul)}</td>
                    <td className="py-1 text-right">{fcfa(l.vnc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="mt-6 flex justify-center gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-forest-700"><Printer size={16} /> Imprimer / PDF</button>
          <button type="button" onClick={onFermer} className="rounded-full border border-cream-300 px-5 py-2.5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">Fermer</button>
        </div>
      </div>
    </div>
  );
}

function EtatAmortissementsImprimable({ donnees, entete, onFermer }: { donnees: DonneesImmobilisationsVue; entete: EnteteEtablissement; onFermer: () => void }) {
  const actifs = donnees.immobilisations.filter((i) => !i.dateSortie && i.statut !== "archive");
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`@media print { body * { visibility: hidden; } #etat-amort-impression, #etat-amort-impression * { visibility: visible; } #etat-amort-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; overflow: visible; } @page { size: A4 landscape; margin: 12mm; } }`}</style>
      <div id="etat-amort-impression" className="mx-auto my-8 w-full max-w-4xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">État des amortissements</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100" aria-label="Fermer"><X size={16} /></button>
        </div>
        <EnTeteOfficielDoc etab={entete} titre="ÉTAT DES IMMOBILISATIONS ET AMORTISSEMENTS" sousTitre={`Arrêté au ${dateFr(new Date().toISOString())}`} />
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-y-2 border-forest-800 text-left uppercase tracking-wide">
              <th className="py-1.5 pr-2">Code</th>
              <th className="py-1.5 pr-2">Désignation</th>
              <th className="py-1.5 pr-2">Catégorie</th>
              <th className="py-1.5 pr-2 text-right">Valeur brute</th>
              <th className="py-1.5 pr-2 text-right">Amort. cumulé</th>
              <th className="py-1.5 text-right">VNC</th>
            </tr>
          </thead>
          <tbody>
            {actifs.map((i) => (
              <tr key={i.id} className="border-b border-cream-200">
                <td className="py-1 pr-2 font-mono">{i.code}</td>
                <td className="py-1 pr-2">{i.designation}</td>
                <td className="py-1 pr-2">{LIBELLE_CATEGORIE_IMMO[i.categorie] ?? i.categorie}</td>
                <td className="py-1 pr-2 text-right">{fcfa(i.valeurBrute)}</td>
                <td className="py-1 pr-2 text-right">{fcfa(i.amortiComptabilise)}</td>
                <td className="py-1 text-right">{fcfa(i.vncComptable)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-forest-800 font-bold">
              <td className="py-2" colSpan={3}>Totaux ({actifs.length} actifs)</td>
              <td className="py-2 text-right">{fcfa(donnees.tableauBord.valeurBrute)}</td>
              <td className="py-2 text-right">{fcfa(donnees.tableauBord.amortissementsCumules)}</td>
              <td className="py-2 text-right">{fcfa(donnees.tableauBord.valeurNette)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-6 flex justify-center gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-forest-700"><Printer size={16} /> Imprimer / PDF</button>
          <button type="button" onClick={onFermer} className="rounded-full border border-cream-300 px-5 py-2.5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">Fermer</button>
        </div>
      </div>
    </div>
  );
}

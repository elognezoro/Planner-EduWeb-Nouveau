"use client";

/**
 * Volet « Magasins & stocks » (14) de l'onglet Économat : situations et alertes (rupture,
 * seuils, surstock, valorisation CUMP), magasins hiérarchisés et TRANSFERTS (bon imprimable
 * A4), lots (péremption 90/60/30/7 j) et numéros de série uniques, réservations (disponible
 * RM-1100), sorties motivées (RM-1103), inventaires (théorique figé → comptage → validation
 * SECOND acteur → régularisations RM-1105 ; FICHE D'INVENTAIRE imprimable A4).
 * Le comptoir historique (ventes/entrées/ajustements) reste INTACT dans son volet.
 */

import { useActionState, useState } from "react";
import {
  Ban, Boxes, Check, ChevronDown, ChevronRight, ClipboardCheck,
  ClipboardList, Hourglass, Lock, PackageMinus, PackageSearch, Pencil, Plus, Printer,
  Repeat, Tag, Trash2, Warehouse, X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import type { EtatForm } from "@/lib/finances/actions";
import {
  annulerInventaire, changerStatutSerie, enregistrerLot, enregistrerMagasin, enregistrerSerie,
  libererReservation, ouvrirInventaire, reserverStock, retirerLot, retirerMagasin,
  saisirComptage, sortirStock, transfererStock, validerInventaire,
} from "@/lib/finances/actions-stocks";
import {
  MOTIFS_RESERVATION, STATUTS_SERIE, TYPES_INVENTAIRE, TYPES_MAGASIN, TYPES_SORTIE_STOCK,
  SEUIL_VALIDATION_SORTIE_STOCK,
  type DonneesStocksVue, type InventaireVue, type MagasinVue,
} from "@/lib/finances/stocks/types";
import type { EnteteEtablissement } from "./finances-vue";
import { BoutonActionConfirmee } from "./scolarite-plus";
import { useApresSucces } from "./scolarite-onglets";
import { fcfa, type ArticleVue } from "./types";

const INITIAL: EtatForm = { ok: false };
const dateFr = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso)) : "—";

export interface DroitsStocksUi {
  mouvementer: boolean;
  gerer: boolean;
  inventorier: boolean;
  valider: boolean;
}

interface BonTransfert {
  articleNom: string;
  sourceNom: string;
  cibleNom: string;
  quantite: number;
  motif: string;
  date: string;
}

type VoletStocks = "situations" | "magasins" | "lots" | "reservations" | "inventaires";

export function SectionStocks({
  etablissementId, donnees, articles, entete, droits,
}: {
  etablissementId: string;
  donnees: DonneesStocksVue;
  articles: ArticleVue[];
  entete: EnteteEtablissement;
  droits: DroitsStocksUi;
}) {
  const [volet, setVolet] = useState<VoletStocks>("situations");
  const [bonTransfert, setBonTransfert] = useState<BonTransfert | null>(null);
  const [inventaireImprime, setInventaireImprime] = useState<InventaireVue | null>(null);
  const tb = donnees.tableauBord;

  const stats = [
    { libelle: "Valeur totale (CUMP)", valeur: fcfa(tb.valeurTotale) },
    { libelle: "Ruptures", valeur: String(tb.nbRuptures), alerte: tb.nbRuptures > 0 },
    { libelle: "Sous le seuil min.", valeur: String(tb.nbSousSeuil), alerte: tb.nbSousSeuil > 0 },
    { libelle: "Surstock", valeur: String(tb.nbSurstock), alerte: tb.nbSurstock > 0 },
    { libelle: "Lots périmés / proches", valeur: `${tb.nbLotsPerimes} / ${tb.nbLotsProches}`, alerte: tb.nbLotsPerimes > 0 },
    { libelle: "Quantités réservées", valeur: String(tb.quantiteReservee) },
    { libelle: "Inventaires en cours", valeur: String(tb.inventairesEnCours), alerte: tb.inventairesEnCours > 0 },
  ];

  const volets: { cle: VoletStocks; libelle: string; Icone: typeof Boxes }[] = [
    { cle: "situations", libelle: "Situations & sorties", Icone: PackageSearch },
    { cle: "magasins", libelle: `Magasins & transferts (${donnees.magasins.length})`, Icone: Warehouse },
    { cle: "lots", libelle: `Lots & séries (${donnees.lots.length + donnees.series.length})`, Icone: Tag },
    { cle: "reservations", libelle: `Réservations (${donnees.reservations.filter((r) => r.statut === "active").length})`, Icone: Lock },
    { cle: "inventaires", libelle: `Inventaires (${donnees.inventaires.length})`, Icone: ClipboardCheck },
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

      <div className="flex flex-wrap gap-1.5">
        {volets.map((v) => (
          <button
            key={v.cle}
            type="button"
            onClick={() => setVolet(v.cle)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
              volet === v.cle ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 bg-white text-ink-700/70 hover:bg-cream-100"
            }`}
          >
            <v.Icone size={13} /> {v.libelle}
          </button>
        ))}
      </div>

      {volet === "situations" && (
        <VoletSituations etablissementId={etablissementId} donnees={donnees} droits={droits} />
      )}
      {volet === "magasins" && (
        <VoletMagasins
          etablissementId={etablissementId} donnees={donnees} articles={articles} droits={droits}
          onBonTransfert={setBonTransfert}
        />
      )}
      {volet === "lots" && (
        <VoletLotsSeries etablissementId={etablissementId} donnees={donnees} articles={articles} droits={droits} />
      )}
      {volet === "reservations" && (
        <VoletReservations etablissementId={etablissementId} donnees={donnees} articles={articles} droits={droits} />
      )}
      {volet === "inventaires" && (
        <VoletInventaires
          etablissementId={etablissementId} donnees={donnees} droits={droits}
          onImprimer={setInventaireImprime}
        />
      )}

      {bonTransfert && (
        <BonTransfertImprimable bon={bonTransfert} entete={entete} onFermer={() => setBonTransfert(null)} />
      )}
      {inventaireImprime && (
        <FicheInventaireImprimable inventaire={inventaireImprime} entete={entete} onFermer={() => setInventaireImprime(null)} />
      )}
    </div>
  );
}

// ─── Situations & sorties motivées ───

function VoletSituations({
  etablissementId, donnees, droits,
}: {
  etablissementId: string;
  donnees: DonneesStocksVue;
  droits: DroitsStocksUi;
}) {
  const [etat, action] = useActionState(sortirStock, INITIAL);
  const [sortieOuverte, setSortieOuverte] = useState(false);
  const magasinsOuverts = donnees.magasins.filter((m) => m.statut === "ouvert");
  return (
    <div className="space-y-4">
      {droits.mouvementer && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <PackageMinus size={17} className="text-forest-600" /> Sortie motivée (consommation, distribution, rebut)
            </h3>
            <button
              type="button"
              onClick={() => setSortieOuverte((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
            >
              <Plus size={13} /> Nouvelle sortie
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-700/60">
            Jamais de disponible négatif (RM-1100). Au-delà de {fcfa(SEUIL_VALIDATION_SORTIE_STOCK)} de
            valeur, la validation hiérarchique est exigée (RM-1103).
          </p>
          {sortieOuverte && (
            <form action={action} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <input type="hidden" name="etablissementId" value={etablissementId} />
              <Select name="articleId" required defaultValue="">
                <option value="" disabled>Article…</option>
                {donnees.situations.map((s) => (
                  <option key={s.articleId} value={s.articleId}>{s.nom} (disp. {s.disponible})</option>
                ))}
              </Select>
              <Select name="type" defaultValue="consommation">
                {TYPES_SORTIE_STOCK.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
              </Select>
              <Select name="magasinId" defaultValue="">
                <option value="">Magasin principal</option>
                {magasinsOuverts.map((m) => <option key={m.id} value={m.id}>{m.cheminComplet}</option>)}
              </Select>
              <Input name="quantite" type="number" min={1} step={1} required placeholder="Quantité" />
              <Input name="beneficiaire" maxLength={120} placeholder="Bénéficiaire (classe, service…)" />
              <Input name="motif" required maxLength={200} placeholder="Motif *" />
              <div className="sm:col-span-2 lg:col-span-6 flex items-center gap-2">
                <SubmitButton>Enregistrer la sortie</SubmitButton>
                {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
              </div>
            </form>
          )}
        </Card>
      )}

      <Card>
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <PackageSearch size={17} className="text-forest-600" /> Situation des articles ({donnees.situations.length})
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
                <th className="px-2 py-2">Article</th>
                <th className="px-2 py-2 text-right">Stock</th>
                <th className="px-2 py-2 text-right">Réservé</th>
                <th className="px-2 py-2 text-right">Disponible</th>
                <th className="px-2 py-2 text-right">Min / Max</th>
                <th className="px-2 py-2 text-right">CUMP</th>
                <th className="px-2 py-2 text-right">Valeur</th>
                <th className="px-2 py-2">Répartition</th>
              </tr>
            </thead>
            <tbody>
              {donnees.situations.map((s) => (
                <tr key={s.articleId} className="border-b border-cream-100">
                  <td className="px-2 py-1.5 text-xs">
                    <span className="font-semibold text-forest-900">{s.nom}</span>
                    <span className="text-ink-700/50"> · {s.unite}</span>
                    {s.rupture && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">RUPTURE</span>}
                    {s.sousSeuil && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">SOUS SEUIL — à réapprovisionner (onglet Achats)</span>}
                    {s.surstock && <span className="ml-1.5 rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold text-gold-800">SURSTOCK</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">{s.stock}</td>
                  <td className="px-2 py-1.5 text-right">{s.reserve || ""}</td>
                  <td className={`px-2 py-1.5 text-right font-semibold ${s.disponible <= 0 ? "text-red-600" : "text-forest-800"}`}>{s.disponible}</td>
                  <td className="px-2 py-1.5 text-right text-xs text-ink-700/60">{s.stockMin}{s.stockMax !== null ? ` / ${s.stockMax}` : ""}</td>
                  <td className="px-2 py-1.5 text-right">{s.cump !== null ? fcfa(s.cump) : "—"}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{fcfa(s.valeur)}</td>
                  <td className="px-2 py-1.5 text-[11px] text-ink-700/60">
                    {s.parMagasin.map((m) => `${m.magasinNom} : ${m.quantite}`).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-forest-200 font-bold">
                <td className="px-2 py-2" colSpan={6}>Valorisation totale (CUMP)</td>
                <td className="px-2 py-2 text-right">{fcfa(donnees.tableauBord.valeurTotale)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Magasins & transferts ───

function VoletMagasins({
  etablissementId, donnees, articles, droits, onBonTransfert,
}: {
  etablissementId: string;
  donnees: DonneesStocksVue;
  articles: ArticleVue[];
  droits: DroitsStocksUi;
  onBonTransfert: (b: BonTransfert) => void;
}) {
  const [enEdition, setEnEdition] = useState<MagasinVue | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [etatMagasin, actionMagasin] = useActionState(enregistrerMagasin, INITIAL);
  useApresSucces(etatMagasin, () => { setEnEdition(null); setFormOuvert(false); });
  const [etatTransfert, actionTransfert] = useActionState(transfererStock, INITIAL);
  const [transfert, setTransfert] = useState({ articleId: "", sourceId: "", cibleId: "", quantite: "", motif: "" });
  useApresSucces(etatTransfert, () => {
    const article = donnees.situations.find((s) => s.articleId === transfert.articleId);
    const source = donnees.magasins.find((m) => m.id === transfert.sourceId);
    const cible = donnees.magasins.find((m) => m.id === transfert.cibleId);
    if (article && source && cible) {
      onBonTransfert({
        articleNom: article.nom, sourceNom: source.cheminComplet, cibleNom: cible.cheminComplet,
        quantite: Math.trunc(Number(transfert.quantite)) || 0, motif: transfert.motif,
        date: new Date().toISOString(),
      });
    }
    setTransfert({ articleId: "", sourceId: "", cibleId: "", quantite: "", motif: "" });
  });
  const ouverts = donnees.magasins.filter((m) => m.statut === "ouvert");

  return (
    <div className="space-y-4">
      {droits.mouvementer && (
        <Card>
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <Repeat size={17} className="text-forest-600" /> Transfert entre magasins
          </h3>
          <p className="mt-1 text-xs text-ink-700/60">
            Paire de mouvements liés — le stock total de l&apos;article ne change pas ; le bon de
            transfert s&apos;imprime après l&apos;enregistrement.
          </p>
          <form action={actionTransfert} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <Select name="articleId" required value={transfert.articleId} onChange={(e) => setTransfert((t) => ({ ...t, articleId: e.target.value }))}>
              <option value="" disabled>Article…</option>
              {donnees.situations.map((s) => <option key={s.articleId} value={s.articleId}>{s.nom}</option>)}
            </Select>
            <Select name="sourceId" required value={transfert.sourceId} onChange={(e) => setTransfert((t) => ({ ...t, sourceId: e.target.value }))}>
              <option value="" disabled>Depuis…</option>
              {ouverts.map((m) => <option key={m.id} value={m.id}>{m.cheminComplet}</option>)}
            </Select>
            <Select name="cibleId" required value={transfert.cibleId} onChange={(e) => setTransfert((t) => ({ ...t, cibleId: e.target.value }))}>
              <option value="" disabled>Vers…</option>
              {ouverts.filter((m) => m.id !== transfert.sourceId).map((m) => <option key={m.id} value={m.id}>{m.cheminComplet}</option>)}
            </Select>
            <Input name="quantite" type="number" min={1} step={1} required placeholder="Quantité" value={transfert.quantite} onChange={(e) => setTransfert((t) => ({ ...t, quantite: e.target.value }))} />
            <Input name="motif" maxLength={200} placeholder="Motif" value={transfert.motif} onChange={(e) => setTransfert((t) => ({ ...t, motif: e.target.value }))} />
            <SubmitButton>Transférer</SubmitButton>
            {etatTransfert.message && (
              <div className="sm:col-span-2 lg:col-span-6"><FormAlert ton={etatTransfert.ok ? "succes" : "erreur"}>{etatTransfert.message}</FormAlert></div>
            )}
          </form>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <Warehouse size={17} className="text-forest-600" /> Magasins &amp; emplacements
          </h3>
          {droits.gerer && (
            <button
              type="button"
              onClick={() => { setEnEdition(null); setFormOuvert((v) => !v); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
            >
              <Plus size={13} /> Nouveau magasin / emplacement
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-700/60">
          Hiérarchie libre (magasin › zone › rayon › étagère › emplacement). Le magasin PRINCIPAL
          porte le stock historique de l&apos;économat.
        </p>
        {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}

        {droits.gerer && (formOuvert || enEdition) && (
          <form action={actionMagasin} key={enEdition?.id ?? "nouveau"} className="mt-3 grid gap-2 rounded-xl border border-cream-200 bg-cream-50/60 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="etablissementId" value={etablissementId} />
            {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
            {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}
            <Input name="nom" required maxLength={80} defaultValue={enEdition?.nom ?? ""} placeholder="Nom *" />
            <Select name="type" defaultValue={enEdition?.type ?? "central"}>
              {TYPES_MAGASIN.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
            </Select>
            <Select name="parentId" defaultValue={enEdition?.parentId ?? ""}>
              <option value="">— Racine (magasin) —</option>
              {donnees.magasins.filter((m) => m.id !== enEdition?.id).map((m) => (
                <option key={m.id} value={m.id}>{m.cheminComplet}</option>
              ))}
            </Select>
            <Select name="statut" defaultValue={enEdition?.statut ?? "ouvert"}>
              <option value="ouvert">Ouvert</option>
              <option value="ferme">Fermé</option>
            </Select>
            <div className="flex items-center gap-2">
              <SubmitButton>{enEdition ? "Mettre à jour" : "Créer"}</SubmitButton>
            </div>
            {etatMagasin.message && (
              <div className="sm:col-span-2 lg:col-span-5"><FormAlert ton={etatMagasin.ok ? "succes" : "erreur"}>{etatMagasin.message}</FormAlert></div>
            )}
          </form>
        )}

        <ul className="mt-3 space-y-1.5">
          {donnees.magasins.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cream-200 bg-white px-3 py-2 text-xs">
              <span style={{ paddingLeft: `${m.profondeur * 16}px` }}>
                <strong className="text-forest-900">{m.nom}</strong>
                <span className="text-ink-700/55"> · {TYPES_MAGASIN.find((t) => t.code === m.type)?.libelle ?? m.type}</span>
                {m.principal && <span className="ml-1.5 rounded-full bg-forest-50 px-1.5 py-0.5 text-[10px] font-bold text-forest-800">PRINCIPAL</span>}
                {m.statut === "ferme" && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">FERMÉ</span>}
                <span className="ml-2 text-ink-700/55">{m.nbArticles} article(s) · {m.quantiteTotale} unité(s)</span>
              </span>
              {droits.gerer && (
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setEnEdition(m); setFormOuvert(true); }}
                    className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50"
                  >
                    <Pencil size={11} /> Modifier
                  </button>
                  {!m.principal && (
                    <BoutonActionConfirmee
                      libelle="Retirer" icone={Trash2} ton="danger" action={retirerMagasin}
                      champs={{ etablissementId, id: m.id, version: String(m.version) }}
                      onSucces={(msg) => setMessage(msg ?? "Magasin retiré.")}
                    />
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ─── Lots & séries ───

function VoletLotsSeries({
  etablissementId, donnees, articles, droits,
}: {
  etablissementId: string;
  donnees: DonneesStocksVue;
  articles: ArticleVue[];
  droits: DroitsStocksUi;
}) {
  const [etatLot, actionLot] = useActionState(enregistrerLot, INITIAL);
  const [etatSerie, actionSerie] = useActionState(enregistrerSerie, INITIAL);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <Hourglass size={17} className="text-forest-600" /> Lots &amp; péremption
        </h3>
        {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
        <ul className="mt-2 space-y-1.5 text-xs">
          {donnees.lots.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
              <span>
                <strong>{l.numeroLot}</strong> — {l.articleNom} · {l.quantite} unité(s)
                {l.datePeremption ? ` · périme le ${dateFr(l.datePeremption)}` : ""}
                {l.perime && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">PÉRIMÉ</span>}
                {!l.perime && l.joursRestants !== null && l.joursRestants <= 90 && (
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${l.joursRestants <= 7 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                    J−{l.joursRestants}
                  </span>
                )}
              </span>
              {droits.mouvementer && (
                <BoutonActionConfirmee
                  libelle="Retirer" icone={Trash2} ton="danger" action={retirerLot}
                  champs={{ etablissementId, id: l.id, version: String(l.version) }}
                  onSucces={(m) => setMessage(m ?? "Lot retiré.")}
                />
              )}
            </li>
          ))}
          {donnees.lots.length === 0 && <li className="text-ink-700/60">Aucun lot suivi.</li>}
        </ul>
        {droits.mouvementer && (
          <form action={actionLot} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <Select name="articleId" required defaultValue="">
              <option value="" disabled>Article…</option>
              {articles.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </Select>
            <Input name="numeroLot" required maxLength={60} placeholder="N° de lot *" />
            <Input name="quantite" type="number" min={0} step={1} placeholder="Quantité" />
            <Input name="datePeremption" type="date" />
            <Input name="fournisseurRef" maxLength={120} placeholder="Fournisseur d'origine" />
            <SubmitButton>Enregistrer le lot</SubmitButton>
            {etatLot.message && <div className="sm:col-span-2"><FormAlert ton={etatLot.ok ? "succes" : "erreur"}>{etatLot.message}</FormAlert></div>}
          </form>
        )}
      </Card>

      <Card>
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <Tag size={17} className="text-forest-600" /> Numéros de série (équipements)
        </h3>
        <ul className="mt-2 space-y-1.5 text-xs">
          {donnees.series.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
              <span>
                <strong className="font-mono">{s.numeroSerie}</strong> — {s.articleNom}
                <span className="ml-1.5 rounded-full bg-cream-100 px-1.5 py-0.5 text-[10px] font-bold text-forest-800">
                  {STATUTS_SERIE.find((x) => x.code === s.statut)?.libelle ?? s.statut}
                </span>
              </span>
              {droits.mouvementer && <SelecteurStatutSerie etablissementId={etablissementId} serie={s} onMessage={setMessage} />}
            </li>
          ))}
          {donnees.series.length === 0 && <li className="text-ink-700/60">Aucun numéro de série suivi.</li>}
        </ul>
        {droits.mouvementer && (
          <form action={actionSerie} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <Select name="articleId" required defaultValue="">
              <option value="" disabled>Article…</option>
              {articles.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </Select>
            <Input name="numeroSerie" required maxLength={80} placeholder="N° de série * (unique)" />
            <Input name="observation" maxLength={160} placeholder="Observation" className="sm:col-span-2" />
            <SubmitButton>Enregistrer la série</SubmitButton>
            {etatSerie.message && <div className="sm:col-span-2"><FormAlert ton={etatSerie.ok ? "succes" : "erreur"}>{etatSerie.message}</FormAlert></div>}
          </form>
        )}
      </Card>
    </div>
  );
}

function SelecteurStatutSerie({
  etablissementId, serie, onMessage,
}: {
  etablissementId: string;
  serie: DonneesStocksVue["series"][number];
  onMessage: (m: string | null) => void;
}) {
  const [statut, setStatut] = useState(serie.statut);
  return (
    <span className="inline-flex items-center gap-1">
      <Select value={statut} onChange={(e) => setStatut(e.target.value)} className="h-7 w-32 text-xs">
        {STATUTS_SERIE.map((s) => <option key={s.code} value={s.code}>{s.libelle}</option>)}
      </Select>
      <BoutonActionConfirmee
        libelle="Appliquer" icone={Check} action={changerStatutSerie}
        champs={{ etablissementId, id: serie.id, version: String(serie.version), statut }}
        desactive={statut === serie.statut}
        onSucces={(m) => onMessage(m ?? "Statut appliqué.")}
      />
    </span>
  );
}

// ─── Réservations ───

function VoletReservations({
  etablissementId, donnees, articles, droits,
}: {
  etablissementId: string;
  donnees: DonneesStocksVue;
  articles: ArticleVue[];
  droits: DroitsStocksUi;
}) {
  const [etat, action] = useActionState(reserverStock, INITIAL);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Card>
      <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Lock size={17} className="text-forest-600" /> Réservations (laboratoire, examens, événements…)
      </h3>
      <p className="mt-1 text-xs text-ink-700/60">
        Une réservation réduit le DISPONIBLE sans toucher au stock physique (RM-1100) — les
        ventes et sorties ne peuvent pas entamer les quantités réservées.
      </p>
      {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
      {droits.mouvementer && (
        <form action={action} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <Select name="articleId" required defaultValue="">
            <option value="" disabled>Article…</option>
            {donnees.situations.map((s) => <option key={s.articleId} value={s.articleId}>{s.nom} (disp. {s.disponible})</option>)}
          </Select>
          <Input name="quantite" type="number" min={1} step={1} required placeholder="Quantité" />
          <Select name="motif" defaultValue="laboratoire">
            {MOTIFS_RESERVATION.map((m) => <option key={m.code} value={m.code}>{m.libelle}</option>)}
          </Select>
          <Input name="beneficiaire" maxLength={120} placeholder="Bénéficiaire (salle, événement…)" />
          <Input name="dateFin" type="date" />
          <SubmitButton>Réserver</SubmitButton>
          {etat.message && <div className="sm:col-span-2 lg:col-span-6"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
        </form>
      )}
      <ul className="mt-3 space-y-1.5 text-xs">
        {donnees.reservations.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
            <span>
              <strong>{r.articleNom}</strong> × {r.quantite} — {MOTIFS_RESERVATION.find((m) => m.code === r.motif)?.libelle ?? r.motif}
              {r.beneficiaire ? ` · ${r.beneficiaire}` : ""} · depuis le {dateFr(r.dateDebut)}
              {r.dateFin ? ` jusqu'au ${dateFr(r.dateFin)}` : ""}
              {r.demandeParNom ? ` · par ${r.demandeParNom}` : ""}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${r.statut === "active" ? "bg-forest-50 text-forest-800" : "bg-cream-200 text-ink-700/60"}`}>
                {r.statut === "active" ? "ACTIVE" : "Libérée"}
              </span>
            </span>
            {droits.mouvementer && r.statut === "active" && (
              <BoutonActionConfirmee
                libelle="Libérer" icone={Check} action={libererReservation}
                champs={{ etablissementId, id: r.id, version: String(r.version) }}
                onSucces={(m) => setMessage(m ?? "Réservation libérée.")}
              />
            )}
          </li>
        ))}
        {donnees.reservations.length === 0 && <li className="text-ink-700/60">Aucune réservation.</li>}
      </ul>
    </Card>
  );
}

// ─── Inventaires ───

function VoletInventaires({
  etablissementId, donnees, droits, onImprimer,
}: {
  etablissementId: string;
  donnees: DonneesStocksVue;
  droits: DroitsStocksUi;
  onImprimer: (i: InventaireVue) => void;
}) {
  const [etatOuverture, actionOuverture] = useActionState(ouvrirInventaire, INITIAL);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {droits.inventorier && (
        <Card>
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <ClipboardList size={17} className="text-forest-600" /> Ouvrir un inventaire
          </h3>
          <p className="mt-1 text-xs text-ink-700/60">
            Le stock théorique est FIGÉ à l&apos;ouverture ; la validation (par un AUTRE acteur que
            le compteur) passe les régularisations automatiquement (RM-1105).
          </p>
          <form action={actionOuverture} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <Select name="type" defaultValue="general">
              {TYPES_INVENTAIRE.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
            </Select>
            <Select name="magasinId" defaultValue="">
              <option value="">Tout l&apos;établissement (stock total)</option>
              {donnees.magasins.filter((m) => m.statut === "ouvert").map((m) => (
                <option key={m.id} value={m.id}>{m.cheminComplet}</option>
              ))}
            </Select>
            <Input name="notes" maxLength={300} placeholder="Notes" className="sm:col-span-2" />
            <SubmitButton>Ouvrir l&apos;inventaire</SubmitButton>
            {etatOuverture.message && (
              <div className="sm:col-span-2 lg:col-span-5"><FormAlert ton={etatOuverture.ok ? "succes" : "erreur"}>{etatOuverture.message}</FormAlert></div>
            )}
          </form>
        </Card>
      )}

      {message && <FormAlert ton="succes">{message}</FormAlert>}
      {donnees.inventaires.map((i) => (
        <CarteInventaire
          key={i.id}
          etablissementId={etablissementId}
          inventaire={i}
          droits={droits}
          onImprimer={() => onImprimer(i)}
          onMessage={setMessage}
        />
      ))}
      {donnees.inventaires.length === 0 && (
        <Card><p className="text-sm text-ink-700/60">Aucun inventaire.</p></Card>
      )}
    </div>
  );
}

function CarteInventaire({
  etablissementId, inventaire: i, droits, onImprimer, onMessage,
}: {
  etablissementId: string;
  inventaire: InventaireVue;
  droits: DroitsStocksUi;
  onImprimer: () => void;
  onMessage: (m: string | null) => void;
}) {
  const [ouvert, setOuvert] = useState(i.statut === "en_cours");
  const [motif, setMotif] = useState("");
  const [comptages, setComptages] = useState<Record<string, { physique: string; observation: string }>>({});
  const [etatComptage, actionComptage] = useActionState(saisirComptage, INITIAL);
  useApresSucces(etatComptage, () => setComptages({}));

  const lignesJson = JSON.stringify(
    i.lignes
      .map((l) => ({
        ligneId: l.id,
        stockPhysique: comptages[l.id]?.physique !== undefined && comptages[l.id].physique !== ""
          ? Math.trunc(Number(comptages[l.id].physique))
          : null,
        observation: comptages[l.id]?.observation || undefined,
      }))
      .filter((l) => l.stockPhysique !== null && Number.isFinite(l.stockPhysique)),
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-forest-900">
          <button type="button" onClick={() => setOuvert((v) => !v)} className="rounded-full p-0.5 text-forest-700 hover:bg-forest-50" aria-label="Détail">
            {ouvert ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {i.reference} · {TYPES_INVENTAIRE.find((t) => t.code === i.type)?.libelle ?? i.type}
          {i.magasinNom ? ` · ${i.magasinNom}` : " · tout l'établissement"}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${i.statut === "valide" ? "bg-forest-50 text-forest-800" : "bg-amber-50 text-amber-700"}`}>
            {i.statut === "valide" ? `Validé le ${dateFr(i.dateValidation)}` : "EN COURS"}
          </span>
          <span className="text-xs font-normal text-ink-700/60">
            {i.nbComptees}/{i.lignes.length} compté(s) · {i.nbEcarts} écart(s)
            {i.compteParNom ? ` · compté par ${i.compteParNom}` : ""}{i.valideParNom ? ` · validé par ${i.valideParNom}` : ""}
          </span>
        </p>
        <span className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={onImprimer} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
            <Printer size={11} /> Fiche d&apos;inventaire
          </button>
          {i.statut === "en_cours" && droits.valider && (
            <BoutonActionConfirmee
              libelle="Valider (régularisations)" icone={Check} ton="primaire" action={validerInventaire}
              champs={{ etablissementId, id: i.id, version: String(i.version) }}
              onSucces={(m) => onMessage(m ?? "Inventaire validé.")}
            />
          )}
          {i.statut === "en_cours" && droits.inventorier && (
            <span className="inline-flex items-center gap-1">
              <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif…" className="h-8 w-32 text-xs" />
              <BoutonActionConfirmee
                libelle="Annuler" icone={Ban} ton="danger" action={annulerInventaire}
                champs={{ etablissementId, id: i.id, version: String(i.version), motif }}
                desactive={motif.trim().length === 0}
                onSucces={(m) => { onMessage(m ?? "Inventaire annulé."); setMotif(""); }}
              />
            </span>
          )}
        </span>
      </div>

      {ouvert && (
        <div className="mt-3 overflow-x-auto">
          <form action={actionComptage}>
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <input type="hidden" name="inventaireId" value={i.id} />
            <input type="hidden" name="lignes" value={lignesJson} />
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-cream-200 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-700/50">
                  <th className="px-2 py-1.5">Article</th>
                  <th className="px-2 py-1.5 text-right">Théorique (figé)</th>
                  <th className="px-2 py-1.5 text-right">Physique</th>
                  <th className="px-2 py-1.5 text-right">Écart</th>
                  <th className="px-2 py-1.5">Observation</th>
                </tr>
              </thead>
              <tbody>
                {i.lignes.map((l) => (
                  <tr key={l.id} className="border-b border-cream-100">
                    <td className="px-2 py-1">{l.articleNom}</td>
                    <td className="px-2 py-1 text-right">{l.stockTheorique}</td>
                    <td className="px-2 py-1 text-right">
                      {i.statut === "en_cours" && droits.inventorier ? (
                        <Input
                          type="number" min={0} step={1}
                          value={comptages[l.id]?.physique ?? (l.stockPhysique !== null ? String(l.stockPhysique) : "")}
                          onChange={(e) => setComptages((c) => ({ ...c, [l.id]: { physique: e.target.value, observation: c[l.id]?.observation ?? "" } }))}
                          className="h-7 w-20 text-right text-xs"
                        />
                      ) : (
                        l.stockPhysique ?? "—"
                      )}
                    </td>
                    <td className={`px-2 py-1 text-right font-semibold ${l.ecart !== null && l.ecart !== 0 ? "text-red-600" : "text-forest-800"}`}>
                      {l.ecart !== null ? (l.ecart > 0 ? `+${l.ecart}` : l.ecart) : ""}
                    </td>
                    <td className="px-2 py-1">
                      {i.statut === "en_cours" && droits.inventorier ? (
                        <Input
                          value={comptages[l.id]?.observation ?? (l.observation ?? "")}
                          onChange={(e) => setComptages((c) => ({ ...c, [l.id]: { physique: c[l.id]?.physique ?? "", observation: e.target.value } }))}
                          maxLength={160} className="h-7 text-xs"
                        />
                      ) : (
                        l.observation ?? ""
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {i.statut === "en_cours" && droits.inventorier && (
              <div className="mt-2 flex items-center gap-2">
                <SubmitButton>Enregistrer le comptage</SubmitButton>
                {etatComptage.message && <FormAlert ton={etatComptage.ok ? "succes" : "erreur"}>{etatComptage.message}</FormAlert>}
              </div>
            )}
          </form>
        </div>
      )}
    </Card>
  );
}

// ─── Documents imprimables A4 ───

function BonTransfertImprimable({
  bon, entete, onFermer,
}: {
  bon: BonTransfert;
  entete: EnteteEtablissement;
  onFermer: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #bon-transfert-impression, #bon-transfert-impression * { visibility: visible; }
          #bon-transfert-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
      <div id="bon-transfert-impression" className="mx-auto my-8 w-full max-w-2xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Bon de transfert</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <EnTeteOfficielDoc etab={entete} titre="BON DE TRANSFERT DE STOCK" sousTitre={dateFr(bon.date)} />
        <div className="mt-4 space-y-1.5 text-sm">
          <p><strong>Article :</strong> {bon.articleNom} — quantité : {bon.quantite}</p>
          <p><strong>Depuis :</strong> {bon.sourceNom}</p>
          <p><strong>Vers :</strong> {bon.cibleNom}</p>
          {bon.motif && <p><strong>Motif :</strong> {bon.motif}</p>}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 text-center text-xs">
          <div>
            <p className="font-semibold">Magasin émetteur</p>
            <p className="mt-14 border-t border-ink-700/30 pt-1 text-ink-700/50">Signature</p>
          </div>
          <div>
            <p className="font-semibold">Magasin destinataire</p>
            <p className="mt-14 border-t border-ink-700/30 pt-1 text-ink-700/50">Signature</p>
          </div>
        </div>
        <div className="mt-6 flex justify-center gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-forest-700">
            <Printer size={16} /> Imprimer / PDF
          </button>
          <button type="button" onClick={onFermer} className="rounded-full border border-cream-300 px-5 py-2.5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function FicheInventaireImprimable({
  inventaire: i, entete, onFermer,
}: {
  inventaire: InventaireVue;
  entete: EnteteEtablissement;
  onFermer: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #fiche-inventaire-impression, #fiche-inventaire-impression * { visibility: visible; }
          #fiche-inventaire-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; overflow: visible; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
      <div id="fiche-inventaire-impression" className="mx-auto my-8 w-full max-w-2xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Fiche d&apos;inventaire</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <EnTeteOfficielDoc
          etab={entete}
          titre="FICHE D'INVENTAIRE PHYSIQUE"
          sousTitre={`${i.reference} — ${TYPES_INVENTAIRE.find((t) => t.code === i.type)?.libelle ?? i.type}${i.magasinNom ? ` · ${i.magasinNom}` : ""}`}
        />
        <p className="mt-3 text-sm">
          Ouvert le {dateFr(i.date)}{i.compteParNom ? ` · Compté par ${i.compteParNom}` : ""}
          {i.statut === "valide" ? ` · Validé le ${dateFr(i.dateValidation)}${i.valideParNom ? ` par ${i.valideParNom}` : ""}` : " · EN COURS"}
        </p>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-forest-800 text-left text-xs uppercase tracking-wide">
              <th className="py-1.5 pr-2">Article</th>
              <th className="py-1.5 pr-2 text-right">Théorique</th>
              <th className="py-1.5 pr-2 text-right">Physique</th>
              <th className="py-1.5 pr-2 text-right">Écart</th>
              <th className="py-1.5">Observation</th>
            </tr>
          </thead>
          <tbody>
            {i.lignes.map((l) => (
              <tr key={l.id} className="border-b border-cream-200">
                <td className="py-1 pr-2">{l.articleNom}</td>
                <td className="py-1 pr-2 text-right">{l.stockTheorique}</td>
                <td className="py-1 pr-2 text-right">{l.stockPhysique ?? ""}</td>
                <td className="py-1 pr-2 text-right font-semibold">{l.ecart !== null && l.ecart !== 0 ? (l.ecart > 0 ? `+${l.ecart}` : l.ecart) : ""}</td>
                <td className="py-1 text-xs">{l.observation ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-8 grid grid-cols-2 gap-4 text-center text-xs">
          <div>
            <p className="font-semibold">Le Compteur</p>
            <p className="mt-14 border-t border-ink-700/30 pt-1 text-ink-700/50">Signature</p>
          </div>
          <div>
            <p className="font-semibold">Le Valideur (second acteur)</p>
            <p className="mt-14 border-t border-ink-700/30 pt-1 text-ink-700/50">Signature</p>
          </div>
        </div>
        <div className="mt-6 flex justify-center gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-forest-700">
            <Printer size={16} /> Imprimer / PDF
          </button>
          <button type="button" onClick={onFermer} className="rounded-full border border-cream-300 px-5 py-2.5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

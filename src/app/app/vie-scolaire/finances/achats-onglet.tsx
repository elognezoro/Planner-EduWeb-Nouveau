"use client";

/**
 * Onglet ACHATS (12 — cycle Procure-to-Pay, WF-004) : tableau de bord et alertes, demandes
 * d'achat (workflow par seuils, devis de consultation), bons de commande (lignes dynamiques,
 * émission numérotée, BON IMPRIMABLE A4 au patron officiel), réceptions partielles/totales
 * (RM-902, entrée en stock économat), factures fournisseurs (RM-903/904), paiements
 * (total/partiel/échelonné), retours (bon BR imprimable), fournisseurs (minimum du 12),
 * budget & engagements (RM-905). Confirmations 2 clics, jamais de dialogue natif.
 */

import { useActionState, useState } from "react";
import {
  AlertTriangle, Ban, BookmarkCheck, Building2, Check, ChevronDown, ChevronRight,
  ClipboardCheck, ClipboardList, FileInput, FileText, HandCoins, PackageCheck, PackageX,
  Pencil, PiggyBank, Plus, Printer, Send, ShoppingCart, Trash2, Undo2, X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import { CATEGORIES_OHADA } from "@/lib/finances/categories";
import type { EtatForm } from "@/lib/finances/actions";
import {
  annulerBonCommande, annulerFactureFournisseur, annulerPaiementFournisseur, annulerReception,
  cloturerDemandeAchat, deciderDemandeAchat, emettreBonCommande, enregistrerBonCommande,
  enregistrerDemandeAchat, enregistrerDevisFournisseur, enregistrerFactureFournisseur,
  enregistrerReception, enregistrerRetourFournisseur,
  payerFactureFournisseur, retenirDevisFournisseur, retirerDemandeAchat,
  retirerDevisFournisseur, soumettreDemandeAchat, validerFactureFournisseur,
} from "@/lib/finances/actions-achats";
import {
  LIBELLE_STATUT_BC, LIBELLE_STATUT_DEMANDE, LIBELLE_STATUT_FACTURE_FRS,
  SEUIL_APPROBATION_DIRECTION_ACHAT, TYPES_ACHAT, URGENCES_ACHAT,
  type BonCommandeVue, type DemandeAchatVue, type EngagementCategorieVue,
  type FactureFournisseurVue, type FournisseurVue, type RetourVue, type TableauBordAchatsVue,
} from "@/lib/finances/achats/types";
import { ETATS_COMMANDABLES, type DonneesFournisseursVue } from "@/lib/finances/fournisseurs/types";
import { SectionFournisseursRiche } from "./fournisseurs-fiche";
import type { EnteteEtablissement } from "./finances-vue";
import { BoutonActionConfirmee } from "./scolarite-plus";
import { useApresSucces, nombreEnLettres } from "./scolarite-onglets";
import { fcfa, LIBELLE_MODE, type ArticleVue } from "./types";

const INITIAL: EtatForm = { ok: false };
const CATEGORIES_DEPENSE = CATEGORIES_OHADA.filter((c) => c.sens === "depense");
const MODES = ["especes", "mobile_money", "cheque", "virement", "carte"] as const;

const dateFr = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso)) : "—";

// ─────────────────────────────────────────────────────────────
//  Onglet
// ─────────────────────────────────────────────────────────────

type SectionAchats = "demandes" | "commandes" | "factures" | "retours" | "fournisseurs" | "budget";

export interface DroitsAchatsUi {
  /** Gestion du cycle (demandes, commandes, factures, paiements, fournisseurs). */
  gestion: boolean;
  /** Réception des commandes (le magasinier n'a que cela — 04 P-008). */
  reception: boolean;
}

export function OngletAchats({
  etablissementId, fournisseurs, demandes, bonsCommande, factures, retours, engagements,
  tableauBord, articles, entete, droits, donneesFournisseurs,
}: {
  etablissementId: string;
  fournisseurs: FournisseurVue[];
  demandes: DemandeAchatVue[];
  bonsCommande: BonCommandeVue[];
  factures: FactureFournisseurVue[];
  retours: RetourVue[];
  engagements: EngagementCategorieVue[];
  tableauBord: TableauBordAchatsVue;
  articles: ArticleVue[];
  entete: EnteteEtablissement;
  droits: DroitsAchatsUi;
  /** 13 : référentiel fournisseurs complet (fiches + tableau de bord) — nul si non chargé. */
  donneesFournisseurs: DonneesFournisseursVue | null;
}) {
  const [section, setSection] = useState<SectionAchats>("demandes");
  const [bcImprime, setBcImprime] = useState<BonCommandeVue | null>(null);
  const [retourImprime, setRetourImprime] = useState<RetourVue | null>(null);

  const sections: { cle: SectionAchats; libelle: string; Icone: typeof ClipboardList }[] = [
    { cle: "demandes", libelle: "Demandes d'achat", Icone: ClipboardList },
    { cle: "commandes", libelle: "Bons de commande", Icone: ShoppingCart },
    { cle: "factures", libelle: "Factures & paiements", Icone: FileText },
    { cle: "retours", libelle: "Retours", Icone: Undo2 },
    { cle: "fournisseurs", libelle: "Fournisseurs", Icone: Building2 },
    { cle: "budget", libelle: "Budget & engagements", Icone: PiggyBank },
  ];

  return (
    <div className="space-y-5">
      <StatsAchats tb={tableauBord} />

      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-cream-200 bg-white p-1.5 shadow-soft print:hidden">
        {sections.map((s) => (
          <button
            key={s.cle}
            type="button"
            onClick={() => setSection(s.cle)}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors ${
              section === s.cle ? "bg-forest-800 text-cream-50" : "text-ink-700/70 hover:bg-cream-100"
            }`}
          >
            <s.Icone size={15} /> {s.libelle}
          </button>
        ))}
      </div>

      {section === "demandes" && (
        <SectionDemandes
          etablissementId={etablissementId}
          demandes={demandes}
          fournisseurs={fournisseurs}
          peutGerer={droits.gestion}
        />
      )}
      {section === "commandes" && (
        <SectionCommandes
          etablissementId={etablissementId}
          bonsCommande={bonsCommande}
          demandes={demandes}
          fournisseurs={fournisseurs}
          articles={articles}
          peutGerer={droits.gestion}
          peutReceptionner={droits.reception}
          onImprimer={setBcImprime}
        />
      )}
      {section === "factures" && (
        <SectionFactures
          etablissementId={etablissementId}
          factures={factures}
          bonsCommande={bonsCommande}
          peutGerer={droits.gestion}
        />
      )}
      {section === "retours" && (
        <SectionRetours
          etablissementId={etablissementId}
          retours={retours}
          bonsCommande={bonsCommande}
          peutGerer={droits.gestion}
          onImprimer={setRetourImprime}
        />
      )}
      {section === "fournisseurs" &&
        (donneesFournisseurs ? (
          <SectionFournisseursRiche
            etablissementId={etablissementId}
            donnees={donneesFournisseurs}
            peutGerer={droits.gestion}
          />
        ) : (
          <Card>
            <p className="text-sm text-ink-700/60">Référentiel fournisseurs indisponible.</p>
          </Card>
        ))}
      {section === "budget" && <SectionBudget engagements={engagements} />}

      {bcImprime && <BonCommandeImprimable bc={bcImprime} entete={entete} onFermer={() => setBcImprime(null)} />}
      {retourImprime && (
        <BonRetourImprimable retour={retourImprime} entete={entete} onFermer={() => setRetourImprime(null)} />
      )}
    </div>
  );
}

function StatsAchats({ tb }: { tb: TableauBordAchatsVue }) {
  const stats = [
    { libelle: "Demandes à décider", valeur: String(tb.demandesEnValidation), alerte: tb.demandesEnValidation > 0 },
    { libelle: "Commandes en cours", valeur: String(tb.bonsEnCours) },
    { libelle: "Commandes en retard", valeur: String(tb.bonsEnRetard), alerte: tb.bonsEnRetard > 0 },
    { libelle: "Factures à valider / échues", valeur: `${tb.facturesAValider} / ${tb.facturesEchues}`, alerte: tb.facturesEchues > 0 },
    { libelle: "Achats de l'exercice (factures validées)", valeur: fcfa(tb.montantAchatsExercice) },
    { libelle: "Engagements en cours (RM-905)", valeur: fcfa(tb.totalEngage) },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((s) => (
        <div key={s.libelle} className="rounded-2xl border border-cream-200 bg-white p-3.5 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-700/55">{s.libelle}</p>
          <p className={`mt-1 font-display text-base font-bold ${s.alerte ? "text-amber-700" : "text-forest-900"}`}>
            {s.valeur}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Demandes d'achat + devis
// ─────────────────────────────────────────────────────────────

function SectionDemandes({
  etablissementId, demandes, fournisseurs, peutGerer,
}: {
  etablissementId: string;
  demandes: DemandeAchatVue[];
  fournisseurs: FournisseurVue[];
  peutGerer: boolean;
}) {
  const [enEdition, setEnEdition] = useState<DemandeAchatVue | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [etat, action] = useActionState(enregistrerDemandeAchat, INITIAL);
  useApresSucces(etat, () => { setEnEdition(null); setFormOuvert(false); });

  return (
    <div className="space-y-4">
      {peutGerer && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <ClipboardList size={17} className="text-forest-600" />
              {enEdition ? "Modifier la demande (brouillon)" : "Nouvelle demande d'achat"}
            </h3>
            <button
              type="button"
              onClick={() => { setEnEdition(null); setFormOuvert((v) => !v); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
            >
              <Plus size={13} /> Nouvelle demande
            </button>
          </div>
          {(formOuvert || enEdition) && (
            <form action={action} key={enEdition?.id ?? "nouvelle"} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="etablissementId" value={etablissementId} />
              {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
              {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}
              <div className="sm:col-span-2">
                <Label htmlFor="da-objet">Objet du besoin</Label>
                <Input id="da-objet" name="objet" defaultValue={enEdition?.objet ?? ""} required maxLength={160} placeholder="Ex : 40 tables-bancs pour la 6e" />
              </div>
              <div>
                <Label htmlFor="da-type">Type d&apos;achat</Label>
                <Select id="da-type" name="typeAchat" defaultValue={enEdition?.typeAchat ?? "biens"}>
                  {TYPES_ACHAT.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="da-urgence">Urgence</Label>
                <Select id="da-urgence" name="urgence" defaultValue={enEdition?.urgence ?? "normale"}>
                  {URGENCES_ACHAT.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Label htmlFor="da-justification">Justification (obligatoire)</Label>
                <Input id="da-justification" name="justification" defaultValue={enEdition?.justification ?? ""} required maxLength={400} placeholder="Pourquoi cette dépense est-elle nécessaire ?" />
              </div>
              <div>
                <Label htmlFor="da-categorie">Catégorie budgétaire (OHADA)</Label>
                <Select id="da-categorie" name="categorieBudget" defaultValue={enEdition?.categorieBudget ?? ""} required>
                  <option value="" disabled>Choisir…</option>
                  {CATEGORIES_DEPENSE.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="da-montant">Montant estimé (FCFA)</Label>
                <Input id="da-montant" name="montantEstime" type="number" min={1} step={1} defaultValue={enEdition?.montantEstime ?? ""} required />
                <p className="mt-1 text-[11px] text-ink-700/50">
                  Au-delà de {fcfa(SEUIL_APPROBATION_DIRECTION_ACHAT)} : approbation DIRECTION.
                </p>
              </div>
              <div>
                <Label htmlFor="da-service">Service demandeur</Label>
                <Input id="da-service" name="service" defaultValue={enEdition?.service ?? ""} maxLength={80} placeholder="Intendance, Vie scolaire…" />
              </div>
              <div>
                <Label htmlFor="da-centre">Centre de coût</Label>
                <Input id="da-centre" name="centreCout" defaultValue={enEdition?.centreCout ?? ""} maxLength={60} placeholder="Cantine, Internat…" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="da-piece">Référence des pièces jointes</Label>
                <Input id="da-piece" name="pieceJustificative" defaultValue={enEdition?.pieceJustificative ?? ""} maxLength={120} placeholder="Devis estimatif, note de service…" />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2">
                <SubmitButton>{enEdition ? "Mettre à jour" : "Enregistrer en brouillon"}</SubmitButton>
                {enEdition && (
                  <button type="button" onClick={() => setEnEdition(null)} className="rounded-full border border-cream-300 px-4 py-2 text-xs font-semibold text-ink-700/70 hover:bg-cream-100">
                    Abandonner
                  </button>
                )}
              </div>
              {etat.message && <div className="sm:col-span-2 lg:col-span-4"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
            </form>
          )}
        </Card>
      )}

      <Card>
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <BookmarkCheck size={17} className="text-forest-600" /> Demandes ({demandes.length})
        </h3>
        {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
        {demandes.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Aucune demande d&apos;achat. Le cycle commence ici (12 : aucun achat hors procédure).</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {demandes.map((d) => (
              <LigneDemande
                key={d.id}
                etablissementId={etablissementId}
                demande={d}
                fournisseurs={fournisseurs}
                peutGerer={peutGerer}
                onModifier={() => { setEnEdition(d); setFormOuvert(true); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }}
                onMessage={setMessage}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const BADGE_DEMANDE: Record<string, string> = {
  brouillon: "bg-cream-200 text-forest-800",
  soumise: "bg-amber-50 text-amber-700",
  approuvee: "bg-forest-50 text-forest-800",
  refusee: "bg-red-50 text-red-600",
  commandee: "bg-gold-100 text-gold-800",
  cloturee: "bg-cream-200 text-ink-700/60",
};

function LigneDemande({
  etablissementId, demande: d, fournisseurs, peutGerer, onModifier, onMessage,
}: {
  etablissementId: string;
  demande: DemandeAchatVue;
  fournisseurs: FournisseurVue[];
  peutGerer: boolean;
  onModifier: () => void;
  onMessage: (m: string | null) => void;
}) {
  const [detail, setDetail] = useState(false);
  const [motifRefus, setMotifRefus] = useState("");
  const [devisOuvert, setDevisOuvert] = useState(false);
  const [etatDevis, actionDevis] = useActionState(enregistrerDevisFournisseur, INITIAL);
  useApresSucces(etatDevis, () => setDevisOuvert(false));

  return (
    <li className="rounded-2xl border border-cream-200 bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-forest-900">
            <button type="button" onClick={() => setDetail((v) => !v)} className="rounded-full p-0.5 text-forest-700 hover:bg-forest-50" aria-label="Détail">
              {detail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {d.numero ?? "Brouillon"} · {d.objet}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_DEMANDE[d.statut] ?? BADGE_DEMANDE.brouillon}`}>
              {LIBELLE_STATUT_DEMANDE[d.statut] ?? d.statut}
            </span>
            {d.approbationDirectionRequise && d.statut === "soumise" && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">Approbation direction requise</span>
            )}
            {d.urgence !== "normale" && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {d.urgence === "critique" ? "CRITIQUE" : "Urgente"}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink-700/60">
            {fcfa(d.montantEstime)} · {d.categorieBudget} — {d.categorieLibelle} · demandé par {d.demandeurNom} le {dateFr(d.date)}
            {d.decideParNom ? ` · décidé par ${d.decideParNom}` : ""}
          </p>
        </div>
        {peutGerer && (
          <div className="flex flex-wrap items-center gap-1.5">
            {d.statut === "brouillon" && (
              <>
                <button type="button" onClick={onModifier} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
                  <Pencil size={11} /> Modifier
                </button>
                <BoutonActionConfirmee
                  libelle="Soumettre" icone={Send} ton="primaire" action={soumettreDemandeAchat}
                  champs={{ etablissementId, id: d.id, version: String(d.version) }}
                  onSucces={(m) => onMessage(m ?? "Demande soumise.")}
                />
              </>
            )}
            {d.statut === "soumise" && (
              <>
                <BoutonActionConfirmee
                  libelle="Approuver" icone={Check} ton="primaire" action={deciderDemandeAchat}
                  champs={{ etablissementId, id: d.id, version: String(d.version), decision: "approuver" }}
                  onSucces={(m) => onMessage(m ?? "Demande approuvée.")}
                />
                <span className="inline-flex items-center gap-1">
                  <Input value={motifRefus} onChange={(e) => setMotifRefus(e.target.value)} maxLength={300} placeholder="Motif du refus…" className="h-8 w-40 text-xs" />
                  <BoutonActionConfirmee
                    libelle="Refuser" icone={Ban} ton="danger" action={deciderDemandeAchat}
                    champs={{ etablissementId, id: d.id, version: String(d.version), decision: "refuser", motifRefus }}
                    desactive={motifRefus.trim().length === 0}
                    onSucces={(m) => { onMessage(m ?? "Demande refusée."); setMotifRefus(""); }}
                  />
                </span>
              </>
            )}
            {["brouillon", "soumise", "refusee"].includes(d.statut) && (
              <BoutonActionConfirmee
                libelle="Retirer" icone={Trash2} ton="danger" action={retirerDemandeAchat}
                champs={{ etablissementId, id: d.id, version: String(d.version) }}
                onSucces={(m) => onMessage(m ?? "Demande retirée.")}
              />
            )}
            {d.statut === "commandee" && (
              <BoutonActionConfirmee
                libelle="Clôturer" icone={Check} action={cloturerDemandeAchat}
                champs={{ etablissementId, id: d.id, version: String(d.version) }}
                onSucces={(m) => onMessage(m ?? "Demande clôturée.")}
              />
            )}
          </div>
        )}
      </div>

      {detail && (
        <div className="mt-3 space-y-3 rounded-xl bg-cream-50/70 p-3 text-xs">
          <p><strong>Justification :</strong> {d.justification}</p>
          <p className="text-ink-700/70">
            {[d.service && `Service : ${d.service}`, d.centreCout && `Centre de coût : ${d.centreCout}`,
              d.pieceJustificative && `Pièces : ${d.pieceJustificative}`, d.motifRefus && `Motif du refus : ${d.motifRefus}`]
              .filter(Boolean).join(" · ") || "—"}
          </p>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-forest-900">Consultation fournisseurs — {d.devis.length} devis (archivés)</p>
              {peutGerer && ["soumise", "approuvee"].includes(d.statut) && (
                <button type="button" onClick={() => setDevisOuvert((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
                  <Plus size={11} /> Ajouter un devis
                </button>
              )}
            </div>
            {devisOuvert && (
              <form action={actionDevis} className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <input type="hidden" name="etablissementId" value={etablissementId} />
                <input type="hidden" name="demandeId" value={d.id} />
                <Select name="fournisseurId" required defaultValue="">
                  <option value="" disabled>Fournisseur…</option>
                  {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.raisonSociale}</option>)}
                </Select>
                <Input name="montant" type="number" min={1} step={1} required placeholder="Montant (FCFA)" />
                <Input name="delaiJours" type="number" min={1} step={1} placeholder="Délai (jours)" />
                <Input name="pieceReference" maxLength={120} placeholder="Réf. du devis" />
                <SubmitButton>Enregistrer</SubmitButton>
                {etatDevis.message && <div className="sm:col-span-2 lg:col-span-5"><FormAlert ton={etatDevis.ok ? "succes" : "erreur"}>{etatDevis.message}</FormAlert></div>}
              </form>
            )}
            {d.devis.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {d.devis.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
                    <span>
                      <strong>{v.fournisseurNom}</strong> — {fcfa(v.montant)}
                      {v.delaiJours ? ` · ${v.delaiJours} j` : ""}{v.pieceReference ? ` · ${v.pieceReference}` : ""}
                      {v.retenu && <span className="ml-2 rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-bold text-forest-800">RETENU</span>}
                    </span>
                    {peutGerer && (
                      <span className="flex gap-1.5">
                        {!v.retenu && (
                          <BoutonActionConfirmee
                            libelle="Retenir" icone={Check} action={retenirDevisFournisseur}
                            champs={{ etablissementId, id: v.id }}
                            onSucces={(m) => onMessage(m ?? "Devis retenu.")}
                          />
                        )}
                        <BoutonActionConfirmee
                          libelle="Retirer" icone={Trash2} ton="danger" action={retirerDevisFournisseur}
                          champs={{ etablissementId, id: v.id, version: String(v.version) }}
                          onSucces={(m) => onMessage(m ?? "Devis retiré.")}
                        />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
//  Bons de commande + réceptions
// ─────────────────────────────────────────────────────────────

interface LigneBcForm {
  cle: number;
  articleId: string;
  designation: string;
  quantite: string;
  prixUnitaire: string;
}

function SectionCommandes({
  etablissementId, bonsCommande, demandes, fournisseurs, articles, peutGerer, peutReceptionner, onImprimer,
}: {
  etablissementId: string;
  bonsCommande: BonCommandeVue[];
  demandes: DemandeAchatVue[];
  fournisseurs: FournisseurVue[];
  articles: ArticleVue[];
  peutGerer: boolean;
  peutReceptionner: boolean;
  onImprimer: (bc: BonCommandeVue) => void;
}) {
  const [enEdition, setEnEdition] = useState<BonCommandeVue | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const demandesCommandables = demandes.filter((d) => ["approuvee", "commandee"].includes(d.statut));
  // 13 (RM-1002/1005) : seuls ACTIF et SOUS SURVEILLANCE sont proposés à la commande.
  const fournisseursActifs = fournisseurs.filter((f) => ETATS_COMMANDABLES.includes(f.statut));

  return (
    <div className="space-y-4">
      {peutGerer && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <ShoppingCart size={17} className="text-forest-600" />
              {enEdition ? `Modifier le bon (brouillon)` : "Nouveau bon de commande"}
            </h3>
            <button
              type="button"
              onClick={() => { setEnEdition(null); setFormOuvert((v) => !v); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
            >
              <Plus size={13} /> Nouveau bon
            </button>
          </div>
          {(formOuvert || enEdition) && (
            <FormBonCommande
              key={enEdition?.id ?? "nouveau"}
              etablissementId={etablissementId}
              demandes={demandesCommandables}
              fournisseurs={fournisseursActifs}
              articles={articles}
              enEdition={enEdition}
              onFin={() => { setEnEdition(null); setFormOuvert(false); }}
            />
          )}
        </Card>
      )}

      <Card>
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <ClipboardCheck size={17} className="text-forest-600" /> Bons de commande ({bonsCommande.length})
        </h3>
        {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
        {bonsCommande.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Aucun bon de commande — il naît d&apos;une demande APPROUVÉE (RM-900).</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {bonsCommande.map((bc) => (
              <LigneBonCommande
                key={bc.id}
                etablissementId={etablissementId}
                bc={bc}
                peutGerer={peutGerer}
                peutReceptionner={peutReceptionner}
                onModifier={() => { setEnEdition(bc); setFormOuvert(true); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }}
                onImprimer={() => onImprimer(bc)}
                onMessage={setMessage}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FormBonCommande({
  etablissementId, demandes, fournisseurs, articles, enEdition, onFin,
}: {
  etablissementId: string;
  demandes: DemandeAchatVue[];
  fournisseurs: FournisseurVue[];
  articles: ArticleVue[];
  enEdition: BonCommandeVue | null;
  onFin: () => void;
}) {
  const [prochaineCle, setProchaineCle] = useState(enEdition ? enEdition.lignes.length : 1);
  const [lignes, setLignes] = useState<LigneBcForm[]>(() =>
    enEdition
      ? enEdition.lignes.map((l, i) => ({
          cle: i, articleId: l.articleId ?? "", designation: l.designation,
          quantite: String(l.quantite), prixUnitaire: String(l.prixUnitaire),
        }))
      : [{ cle: 0, articleId: "", designation: "", quantite: "", prixUnitaire: "" }],
  );
  const [etat, action] = useActionState(enregistrerBonCommande, INITIAL);
  useApresSucces(etat, onFin);

  const total = lignes.reduce(
    (s, l) => s + (Math.trunc(Number(l.quantite)) || 0) * (Math.trunc(Number(l.prixUnitaire)) || 0),
    0,
  );
  const lignesJson = JSON.stringify(
    lignes
      .filter((l) => l.designation.trim() && (Math.trunc(Number(l.quantite)) || 0) > 0 && (Math.trunc(Number(l.prixUnitaire)) || 0) > 0)
      .map((l) => ({
        articleId: l.articleId || undefined,
        designation: l.designation.trim(),
        quantite: Math.trunc(Number(l.quantite)),
        prixUnitaire: Math.trunc(Number(l.prixUnitaire)),
      })),
  );

  function majLigne(cle: number, champ: keyof LigneBcForm, valeur: string) {
    setLignes((prev) =>
      prev.map((l) => {
        if (l.cle !== cle) return l;
        if (champ === "articleId" && valeur) {
          const article = articles.find((a) => a.id === valeur);
          if (article) {
            return {
              ...l, articleId: valeur, designation: article.nom,
              prixUnitaire: l.prixUnitaire || String(article.prixAchat ?? article.prixVente),
            };
          }
        }
        return { ...l, [champ]: valeur };
      }),
    );
  }

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input type="hidden" name="lignes" value={lignesJson} />
      {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
      {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor="bc-demande">Demande approuvée (RM-900)</Label>
          <Select id="bc-demande" name="demandeId" defaultValue={enEdition?.demandeId ?? ""} required>
            <option value="" disabled>Choisir…</option>
            {demandes.map((d) => (
              <option key={d.id} value={d.id}>{d.numero ?? "—"} · {d.objet} ({fcfa(d.montantEstime)})</option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="bc-fournisseur">Fournisseur ACTIF (RM-901)</Label>
          <Select id="bc-fournisseur" name="fournisseurId" defaultValue={enEdition?.fournisseurId ?? ""} required>
            <option value="" disabled>Choisir…</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.raisonSociale} ({f.code})</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="bc-conditions">Conditions de paiement</Label>
          <Input id="bc-conditions" name="conditionsPaiement" defaultValue={enEdition?.conditionsPaiement ?? ""} maxLength={160} placeholder="30 jours fin de mois…" />
        </div>
        <div>
          <Label htmlFor="bc-lieu">Lieu de livraison</Label>
          <Input id="bc-lieu" name="lieuLivraison" defaultValue={enEdition?.lieuLivraison ?? ""} maxLength={160} />
        </div>
        <div>
          <Label htmlFor="bc-delai">Livraison prévue le</Label>
          <Input id="bc-delai" name="dateLivraisonPrevue" type="date" defaultValue={enEdition?.dateLivraisonPrevue?.slice(0, 10) ?? ""} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-cream-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-cream-100 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
              <th className="px-3 py-2">Article économat (optionnel)</th>
              <th className="px-3 py-2">Désignation</th>
              <th className="px-3 py-2">Quantité</th>
              <th className="px-3 py-2">Prix unitaire</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.cle} className="border-t border-cream-200">
                <td className="px-3 py-1.5">
                  <Select value={l.articleId} onChange={(e) => majLigne(l.cle, "articleId", e.target.value)} className="min-w-40">
                    <option value="">— Libre (service…) —</option>
                    {articles.filter((a) => a.actif).map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                  </Select>
                </td>
                <td className="px-3 py-1.5">
                  <Input value={l.designation} maxLength={160} onChange={(e) => majLigne(l.cle, "designation", e.target.value)} />
                </td>
                <td className="px-3 py-1.5">
                  <Input type="number" min={1} step={1} value={l.quantite} className="w-24" onChange={(e) => majLigne(l.cle, "quantite", e.target.value)} />
                </td>
                <td className="px-3 py-1.5">
                  <Input type="number" min={1} step={1} value={l.prixUnitaire} className="w-32" onChange={(e) => majLigne(l.cle, "prixUnitaire", e.target.value)} />
                </td>
                <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">
                  {fcfa((Math.trunc(Number(l.quantite)) || 0) * (Math.trunc(Number(l.prixUnitaire)) || 0))}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => setLignes((prev) => prev.filter((x) => x.cle !== l.cle))}
                    disabled={lignes.length <= 1}
                    className="rounded-full p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-30"
                    aria-label="Retirer la ligne"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setLignes((prev) => [...prev, { cle: prochaineCle, articleId: "", designation: "", quantite: "", prixUnitaire: "" }]);
            setProchaineCle((n) => n + 1);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3.5 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
        >
          <Plus size={13} /> Ajouter une ligne
        </button>
        <span className="rounded-full bg-forest-50 px-3.5 py-1.5 text-xs font-bold text-forest-900">Total : {fcfa(total)}</span>
        <span className="flex gap-2">
          <SubmitButton>{enEdition ? "Mettre à jour le brouillon" : "Enregistrer en brouillon"}</SubmitButton>
          {enEdition && (
            <button type="button" onClick={onFin} className="rounded-full border border-cream-300 px-4 py-2 text-xs font-semibold text-ink-700/70 hover:bg-cream-100">
              Abandonner
            </button>
          )}
        </span>
      </div>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
    </form>
  );
}

const BADGE_BC: Record<string, string> = {
  brouillon: "bg-cream-200 text-forest-800",
  emise: "bg-forest-50 text-forest-800",
  annulee: "bg-red-50 text-red-600",
};

function LigneBonCommande({
  etablissementId, bc, peutGerer, peutReceptionner, onModifier, onImprimer, onMessage,
}: {
  etablissementId: string;
  bc: BonCommandeVue;
  peutGerer: boolean;
  peutReceptionner: boolean;
  onModifier: () => void;
  onImprimer: () => void;
  onMessage: (m: string | null) => void;
}) {
  const [detail, setDetail] = useState(false);
  const [motif, setMotif] = useState("");
  const [receptionOuverte, setReceptionOuverte] = useState(false);

  return (
    <li className="rounded-2xl border border-cream-200 bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-forest-900">
            <button type="button" onClick={() => setDetail((v) => !v)} className="rounded-full p-0.5 text-forest-700 hover:bg-forest-50" aria-label="Détail">
              {detail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {bc.numero ?? "Brouillon"} · {bc.fournisseurNom}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_BC[bc.statut] ?? BADGE_BC.brouillon}`}>
              {LIBELLE_STATUT_BC[bc.statut] ?? bc.statut}
            </span>
            {bc.statut === "emise" && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${bc.etatReception === "totale" ? "bg-forest-50 text-forest-800" : bc.etatReception === "partielle" ? "bg-amber-50 text-amber-700" : "bg-cream-200 text-ink-700/60"}`}>
                {bc.etatReception === "totale" ? "Reçue en totalité" : bc.etatReception === "partielle" ? "Réception partielle" : "Non réceptionnée"}
              </span>
            )}
            {bc.enRetard && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">EN RETARD</span>}
          </p>
          <p className="mt-0.5 text-xs text-ink-700/60">
            {fcfa(bc.totalCommande)} · demande {bc.demandeNumero ?? "—"} ({bc.demandeObjet}) · facturé {fcfa(bc.totalFacture)} · payé {fcfa(bc.totalPaye)}
            {bc.dateLivraisonPrevue ? ` · livraison prévue ${dateFr(bc.dateLivraisonPrevue)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {bc.statut === "emise" && (
            <button type="button" onClick={onImprimer} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
              <Printer size={11} /> Imprimer
            </button>
          )}
          {peutGerer && bc.statut === "brouillon" && (
            <>
              <button type="button" onClick={onModifier} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
                <Pencil size={11} /> Modifier
              </button>
              <BoutonActionConfirmee
                libelle="Émettre" icone={Send} ton="primaire" action={emettreBonCommande}
                champs={{ etablissementId, id: bc.id, version: String(bc.version) }}
                onSucces={(m) => onMessage(m ?? "Bon émis.")}
              />
            </>
          )}
          {peutReceptionner && bc.statut === "emise" && bc.etatReception !== "totale" && (
            <button
              type="button"
              onClick={() => { setReceptionOuverte((v) => !v); setDetail(true); }}
              className="inline-flex items-center gap-1 rounded-full bg-forest-800 px-2.5 py-1 text-[11px] font-semibold text-cream-50 hover:bg-forest-700"
            >
              <PackageCheck size={11} /> Réceptionner
            </button>
          )}
          {peutGerer && bc.statut !== "annulee" && (
            <span className="inline-flex items-center gap-1">
              <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif d'annulation…" className="h-8 w-36 text-xs" />
              <BoutonActionConfirmee
                libelle="Annuler" icone={Ban} ton="danger" action={annulerBonCommande}
                champs={{ etablissementId, id: bc.id, version: String(bc.version), motif }}
                desactive={motif.trim().length === 0}
                onSucces={(m) => { onMessage(m ?? "Bon annulé."); setMotif(""); }}
              />
            </span>
          )}
        </div>
      </div>

      {detail && (
        <div className="mt-3 space-y-3 rounded-xl bg-cream-50/70 p-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-ink-700/50">
                <th className="px-2 py-1">Désignation</th>
                <th className="px-2 py-1 text-right">Commandé</th>
                <th className="px-2 py-1 text-right">PU</th>
                <th className="px-2 py-1 text-right">Total</th>
                <th className="px-2 py-1 text-right">Reçu</th>
                <th className="px-2 py-1 text-right">Retourné</th>
              </tr>
            </thead>
            <tbody>
              {bc.lignes.map((l) => (
                <tr key={l.id} className="border-t border-cream-200/70">
                  <td className="px-2 py-1">{l.designation}{l.articleId ? " · stockable" : ""}</td>
                  <td className="px-2 py-1 text-right">{l.quantite}</td>
                  <td className="px-2 py-1 text-right">{fcfa(l.prixUnitaire)}</td>
                  <td className="px-2 py-1 text-right font-semibold">{fcfa(l.total)}</td>
                  <td className={`px-2 py-1 text-right ${l.quantiteRecue < l.quantite ? "text-amber-700" : "text-forest-800"}`}>{l.quantiteRecue}</td>
                  <td className="px-2 py-1 text-right">{l.quantiteRetournee || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {[bc.conditionsPaiement && `Conditions : ${bc.conditionsPaiement}`, bc.lieuLivraison && `Livraison : ${bc.lieuLivraison}`, bc.motifAnnulation && `Motif d'annulation : ${bc.motifAnnulation}`]
            .filter(Boolean).length > 0 && (
            <p className="text-xs text-ink-700/70">
              {[bc.conditionsPaiement && `Conditions : ${bc.conditionsPaiement}`, bc.lieuLivraison && `Livraison : ${bc.lieuLivraison}`, bc.motifAnnulation && `Motif d'annulation : ${bc.motifAnnulation}`].filter(Boolean).join(" · ")}
            </p>
          )}

          {receptionOuverte && peutReceptionner && bc.statut === "emise" && (
            <FormReception etablissementId={etablissementId} bc={bc} onFin={() => setReceptionOuverte(false)} />
          )}

          {bc.receptions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-forest-900">Réceptions ({bc.receptions.length})</p>
              <ul className="mt-1.5 space-y-1.5">
                {bc.receptions.map((r) => (
                  <LigneReceptionListe key={r.id} etablissementId={etablissementId} reception={r} peutReceptionner={peutReceptionner} onMessage={onMessage} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function FormReception({
  etablissementId, bc, onFin,
}: {
  etablissementId: string;
  bc: BonCommandeVue;
  onFin: () => void;
}) {
  const restantes = bc.lignes.filter((l) => l.quantiteRecue < l.quantite);
  const [quantites, setQuantites] = useState<Record<string, { recue: string; refusee: string; observation: string }>>(
    () => Object.fromEntries(restantes.map((l) => [l.id, { recue: "", refusee: "", observation: "" }])),
  );
  const [etat, action] = useActionState(enregistrerReception, INITIAL);
  useApresSucces(etat, onFin);

  const lignesJson = JSON.stringify(
    restantes
      .map((l) => ({
        ligneBonCommandeId: l.id,
        quantiteRecue: Math.trunc(Number(quantites[l.id]?.recue)) || 0,
        quantiteRefusee: Math.trunc(Number(quantites[l.id]?.refusee)) || 0,
        observation: quantites[l.id]?.observation || undefined,
      }))
      .filter((l) => l.quantiteRecue > 0 || l.quantiteRefusee > 0),
  );

  return (
    <form action={action} className="rounded-xl border border-forest-200 bg-white p-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input type="hidden" name="bonCommandeId" value={bc.id} />
      <input type="hidden" name="lignes" value={lignesJson} />
      <p className="text-xs font-semibold text-forest-900">
        Réception — le cumul reçu ne peut pas dépasser le commandé (RM-902) ; les articles stockables entrent en stock économat automatiquement.
      </p>
      <div className="mt-2 space-y-2">
        {restantes.map((l) => (
          <div key={l.id} className="grid gap-2 sm:grid-cols-4">
            <span className="self-center text-xs">{l.designation} <span className="text-ink-700/50">(reste {l.quantite - l.quantiteRecue})</span></span>
            <Input
              type="number" min={0} max={l.quantite - l.quantiteRecue} step={1} placeholder="Reçue"
              value={quantites[l.id]?.recue ?? ""} className="h-9 text-xs"
              onChange={(e) => setQuantites((q) => ({ ...q, [l.id]: { ...q[l.id], recue: e.target.value } }))}
            />
            <Input
              type="number" min={0} step={1} placeholder="Refusée (écart)"
              value={quantites[l.id]?.refusee ?? ""} className="h-9 text-xs"
              onChange={(e) => setQuantites((q) => ({ ...q, [l.id]: { ...q[l.id], refusee: e.target.value } }))}
            />
            <Input
              placeholder="Observation…" maxLength={160}
              value={quantites[l.id]?.observation ?? ""} className="h-9 text-xs"
              onChange={(e) => setQuantites((q) => ({ ...q, [l.id]: { ...q[l.id], observation: e.target.value } }))}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input name="observations" maxLength={300} placeholder="Observations générales (état, conformité des références…)" className="h-9 flex-1 text-xs" />
        <SubmitButton>Enregistrer la réception</SubmitButton>
        <button type="button" onClick={onFin} className="rounded-full border border-cream-300 px-3.5 py-2 text-xs font-semibold text-ink-700/70 hover:bg-cream-100">
          Fermer
        </button>
      </div>
      {etat.message && <div className="mt-2"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
    </form>
  );
}

function LigneReceptionListe({
  etablissementId, reception: r, peutReceptionner, onMessage,
}: {
  etablissementId: string;
  reception: BonCommandeVue["receptions"][number];
  peutReceptionner: boolean;
  onMessage: (m: string | null) => void;
}) {
  const [motif, setMotif] = useState("");
  return (
    <li className="rounded-lg border border-cream-200 bg-white px-2.5 py-1.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>{dateFr(r.date)}</strong> par {r.receptionnaireNom} —{" "}
          {r.lignes.map((l) => `${l.designation} : ${l.quantiteRecue}${l.quantiteRefusee > 0 ? ` (${l.quantiteRefusee} refusés)` : ""}`).join(" · ")}
          {r.observations ? ` · ${r.observations}` : ""}
        </span>
        {peutReceptionner && (
          <span className="inline-flex items-center gap-1">
            <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif…" className="h-7 w-32 text-xs" />
            <BoutonActionConfirmee
              libelle="Annuler" icone={PackageX} ton="danger" action={annulerReception}
              champs={{ etablissementId, id: r.id, version: String(r.version), motif }}
              desactive={motif.trim().length === 0}
              onSucces={(m) => { onMessage(m ?? "Réception annulée."); setMotif(""); }}
            />
          </span>
        )}
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
//  Factures fournisseurs + paiements
// ─────────────────────────────────────────────────────────────

function SectionFactures({
  etablissementId, factures, bonsCommande, peutGerer,
}: {
  etablissementId: string;
  factures: FactureFournisseurVue[];
  bonsCommande: BonCommandeVue[];
  peutGerer: boolean;
}) {
  const [formOuvert, setFormOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [etat, action] = useActionState(enregistrerFactureFournisseur, INITIAL);
  useApresSucces(etat, () => setFormOuvert(false));
  const bcEmis = bonsCommande.filter((b) => b.statut === "emise");

  return (
    <div className="space-y-4">
      {peutGerer && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <FileInput size={17} className="text-forest-600" /> Saisir une facture fournisseur
            </h3>
            <button
              type="button"
              onClick={() => setFormOuvert((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
            >
              <Plus size={13} /> Nouvelle facture
            </button>
          </div>
          {formOuvert && (
            <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input type="hidden" name="etablissementId" value={etablissementId} />
              <div className="sm:col-span-2">
                <Label htmlFor="ff-bc">Bon de commande émis</Label>
                <Select id="ff-bc" name="bonCommandeId" defaultValue="" required>
                  <option value="" disabled>Choisir…</option>
                  {bcEmis.map((b) => (
                    <option key={b.id} value={b.id}>{b.numero} · {b.fournisseurNom} ({fcfa(b.totalCommande)})</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="ff-numero">N° de facture du fournisseur</Label>
                <Input id="ff-numero" name="numeroFournisseur" required maxLength={60} />
              </div>
              <div>
                <Label htmlFor="ff-montant">Montant TTC (FCFA)</Label>
                <Input id="ff-montant" name="montant" type="number" min={1} step={1} required />
              </div>
              <div>
                <Label htmlFor="ff-taxes">Dont taxes (FCFA)</Label>
                <Input id="ff-taxes" name="taxes" type="number" min={0} step={1} defaultValue={0} />
              </div>
              <div>
                <Label htmlFor="ff-echeance">Échéance</Label>
                <Input id="ff-echeance" name="dateEcheance" type="date" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ff-piece">Pièce justificative (obligatoire)</Label>
                <Input id="ff-piece" name="pieceJustificative" required maxLength={120} placeholder="Facture originale, bordereau de livraison…" />
              </div>
              <div className="flex items-end">
                <SubmitButton>Saisir la facture</SubmitButton>
              </div>
              {etat.message && <div className="sm:col-span-2 lg:col-span-3"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
            </form>
          )}
        </Card>
      )}

      <Card>
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <FileText size={17} className="text-forest-600" /> Factures fournisseurs ({factures.length})
        </h3>
        {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
        {factures.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Aucune facture fournisseur.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {factures.map((f) => (
              <LigneFactureFrs key={f.id} etablissementId={etablissementId} facture={f} peutGerer={peutGerer} onMessage={setMessage} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function LigneFactureFrs({
  etablissementId, facture: f, peutGerer, onMessage,
}: {
  etablissementId: string;
  facture: FactureFournisseurVue;
  peutGerer: boolean;
  onMessage: (m: string | null) => void;
}) {
  const [detail, setDetail] = useState(false);
  const [motif, setMotif] = useState("");
  const [paiementOuvert, setPaiementOuvert] = useState(false);
  const [etatPaiement, actionPaiement] = useActionState(payerFactureFournisseur, INITIAL);
  useApresSucces(etatPaiement, () => setPaiementOuvert(false));
  const badge =
    f.statut === "validee" ? "bg-forest-50 text-forest-800" : f.statut === "annulee" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700";

  return (
    <li className="rounded-2xl border border-cream-200 bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-forest-900">
            <button type="button" onClick={() => setDetail((v) => !v)} className="rounded-full p-0.5 text-forest-700 hover:bg-forest-50" aria-label="Détail">
              {detail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {f.numeroFournisseur} · {f.fournisseurNom}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge}`}>
              {LIBELLE_STATUT_FACTURE_FRS[f.statut] ?? f.statut}
            </span>
            {f.statut === "validee" && f.reste === 0 && (
              <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-semibold text-forest-800">SOLDÉE</span>
            )}
            {f.enRetard && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">ÉCHUE</span>}
            {f.ecartCommande !== 0 && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Écart commande {f.ecartCommande > 0 ? "+" : ""}{fcfa(f.ecartCommande)}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink-700/60">
            {fcfa(f.montant)}{f.taxes > 0 ? ` (dont taxes ${fcfa(f.taxes)})` : ""} · BC {f.bonCommandeNumero ?? "—"} ·
            payé {fcfa(f.totalPaye)} · reste {fcfa(f.reste)}
            {f.dateEcheance ? ` · échéance ${dateFr(f.dateEcheance)}` : ""} · pièce : {f.pieceJustificative}
          </p>
        </div>
        {peutGerer && (
          <div className="flex flex-wrap items-center gap-1.5">
            {f.statut === "saisie" && (
              <BoutonActionConfirmee
                libelle="Valider (écritures RM-904)" icone={Check} ton="primaire" action={validerFactureFournisseur}
                champs={{ etablissementId, id: f.id, version: String(f.version) }}
                onSucces={(m) => onMessage(m ?? "Facture validée.")}
              />
            )}
            {f.statut === "validee" && f.reste > 0 && (
              <button
                type="button"
                onClick={() => setPaiementOuvert((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full bg-forest-800 px-2.5 py-1 text-[11px] font-semibold text-cream-50 hover:bg-forest-700"
              >
                <HandCoins size={11} /> Payer
              </button>
            )}
            {f.statut !== "annulee" && f.totalPaye === 0 && (
              <span className="inline-flex items-center gap-1">
                <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif…" className="h-8 w-32 text-xs" />
                <BoutonActionConfirmee
                  libelle="Annuler" icone={Ban} ton="danger" action={annulerFactureFournisseur}
                  champs={{ etablissementId, id: f.id, version: String(f.version), motif }}
                  desactive={motif.trim().length === 0}
                  onSucces={(m) => { onMessage(m ?? "Facture annulée."); setMotif(""); }}
                />
              </span>
            )}
          </div>
        )}
      </div>

      {paiementOuvert && peutGerer && (
        <form action={actionPaiement} className="mt-3 grid gap-2 rounded-xl border border-forest-200 bg-cream-50/70 p-3 sm:grid-cols-4">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <input type="hidden" name="factureId" value={f.id} />
          <div>
            <Label htmlFor={`pf-montant-${f.id}`}>Montant (reste {fcfa(f.reste)})</Label>
            <Input id={`pf-montant-${f.id}`} name="montant" type="number" min={1} max={f.reste} step={1} required defaultValue={f.reste} />
          </div>
          <div>
            <Label htmlFor={`pf-mode-${f.id}`}>Mode</Label>
            <Select id={`pf-mode-${f.id}`} name="mode" defaultValue="virement">
              {MODES.map((m) => <option key={m} value={m}>{LIBELLE_MODE[m]}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor={`pf-ref-${f.id}`}>Référence</Label>
            <Input id={`pf-ref-${f.id}`} name="reference" maxLength={80} placeholder="N° virement, chèque…" />
          </div>
          <div className="flex items-end">
            <SubmitButton>Enregistrer le paiement</SubmitButton>
          </div>
          {etatPaiement.message && <div className="sm:col-span-4"><FormAlert ton={etatPaiement.ok ? "succes" : "erreur"}>{etatPaiement.message}</FormAlert></div>}
        </form>
      )}

      {detail && f.paiements.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-xl bg-cream-50/70 p-3 text-xs">
          {f.paiements.map((p) => (
            <LignePaiementFrs key={p.id} etablissementId={etablissementId} paiement={p} peutGerer={peutGerer} onMessage={onMessage} />
          ))}
        </ul>
      )}
    </li>
  );
}

function LignePaiementFrs({
  etablissementId, paiement: p, peutGerer, onMessage,
}: {
  etablissementId: string;
  paiement: FactureFournisseurVue["paiements"][number];
  peutGerer: boolean;
  onMessage: (m: string | null) => void;
}) {
  const [motif, setMotif] = useState("");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span>
        <strong>{fcfa(p.montant)}</strong> — {LIBELLE_MODE[p.mode] ?? p.mode}
        {p.reference ? ` · ${p.reference}` : ""} · {dateFr(p.date)}{p.payeParNom ? ` · par ${p.payeParNom}` : ""}
      </span>
      {peutGerer && (
        <span className="inline-flex items-center gap-1">
          <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif…" className="h-7 w-32 text-xs" />
          <BoutonActionConfirmee
            libelle="Annuler" icone={Ban} ton="danger" action={annulerPaiementFournisseur}
            champs={{ etablissementId, id: p.id, version: String(p.version), motif }}
            desactive={motif.trim().length === 0}
            onSucces={(m) => { onMessage(m ?? "Paiement annulé."); setMotif(""); }}
          />
        </span>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
//  Retours fournisseurs
// ─────────────────────────────────────────────────────────────

function SectionRetours({
  etablissementId, retours, bonsCommande, peutGerer, onImprimer,
}: {
  etablissementId: string;
  retours: RetourVue[];
  bonsCommande: BonCommandeVue[];
  peutGerer: boolean;
  onImprimer: (r: RetourVue) => void;
}) {
  const [bcId, setBcId] = useState("");
  const [etat, action] = useActionState(enregistrerRetourFournisseur, INITIAL);
  const bcAvecReception = bonsCommande.filter(
    (b) => b.statut === "emise" && b.lignes.some((l) => l.quantiteRecue - l.quantiteRetournee > 0),
  );
  const bcChoisi = bcAvecReception.find((b) => b.id === bcId) ?? null;

  return (
    <div className="space-y-4">
      {peutGerer && (
        <Card>
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <Undo2 size={17} className="text-forest-600" /> Nouveau retour fournisseur
          </h3>
          <p className="mt-1 text-xs text-ink-700/60">
            Le retour génère un bon BR numéroté, régularise le stock (article stockable) et passe
            l&apos;écriture de régularisation si une facture validée existe (12).
          </p>
          <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <div className="sm:col-span-2">
              <Label htmlFor="rf-bc">Bon de commande (avec réceptions)</Label>
              <Select id="rf-bc" value={bcId} onChange={(e) => setBcId(e.target.value)}>
                <option value="">Choisir…</option>
                {bcAvecReception.map((b) => <option key={b.id} value={b.id}>{b.numero} · {b.fournisseurNom}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="rf-ligne">Ligne concernée</Label>
              <Select id="rf-ligne" name="ligneBonCommandeId" required defaultValue="" disabled={!bcChoisi}>
                <option value="" disabled>Choisir…</option>
                {bcChoisi?.lignes
                  .filter((l) => l.quantiteRecue - l.quantiteRetournee > 0)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.designation} (retournable : {l.quantiteRecue - l.quantiteRetournee})
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rf-quantite">Quantité</Label>
              <Input id="rf-quantite" name="quantite" type="number" min={1} step={1} required />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Label htmlFor="rf-motif">Motif du retour (obligatoire)</Label>
              <Input id="rf-motif" name="motif" required maxLength={300} placeholder="Non conforme, défectueux, référence erronée…" />
            </div>
            <div className="flex items-end">
              <SubmitButton>Enregistrer le retour</SubmitButton>
            </div>
            {etat.message && <div className="sm:col-span-2 lg:col-span-5"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
          </form>
        </Card>
      )}

      <Card>
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <PackageX size={17} className="text-forest-600" /> Retours enregistrés ({retours.length})
        </h3>
        {retours.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Aucun retour fournisseur.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {retours.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cream-200 bg-white px-3.5 py-2.5 text-sm">
                <span>
                  <strong className="text-forest-900">{r.numero}</strong> · BC {r.bonCommandeNumero ?? "—"} · {r.designation} × {r.quantite}
                  <span className="ml-2 text-xs text-ink-700/60">{r.motif} · {dateFr(r.date)}{r.retourneParNom ? ` · par ${r.retourneParNom}` : ""}</span>
                </span>
                <button type="button" onClick={() => onImprimer(r)} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
                  <Printer size={11} /> Bon de retour
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Budget & engagements (RM-905)
//  (la section Fournisseurs vit désormais dans ./fournisseurs-fiche.tsx — référentiel 13)
// ─────────────────────────────────────────────────────────────

function SectionBudget({ engagements }: { engagements: EngagementCategorieVue[] }) {
  return (
    <Card>
      <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <PiggyBank size={17} className="text-forest-600" /> Budget &amp; engagements par catégorie (RM-905)
      </h3>
      <p className="mt-1 text-xs text-ink-700/60">
        L&apos;engagement naît à l&apos;ÉMISSION du bon de commande ; le consommé = factures
        fournisseurs validées. Le contrôle bloque l&apos;approbation et l&apos;émission quand un
        budget est défini pour la catégorie (onglet Budget) et que le disponible est dépassé.
        Périmètre ACHATS — la consolidation avec toutes les dépenses viendra avec le module Budgets (16).
      </p>
      {engagements.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700/60">Aucun engagement ni budget de dépense pour l&apos;exercice.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
                <th className="px-2 py-2">Catégorie</th>
                <th className="px-2 py-2 text-right">Budget prévu</th>
                <th className="px-2 py-2 text-right">Consommé (factures)</th>
                <th className="px-2 py-2 text-right">Engagé (BC émis)</th>
                <th className="px-2 py-2 text-right">Disponible</th>
              </tr>
            </thead>
            <tbody>
              {engagements.map((e) => {
                const depasse = e.disponible !== null && e.disponible < 0;
                return (
                  <tr key={e.categorie} className="border-b border-cream-100">
                    <td className="px-2 py-1.5 text-xs"><span className="font-mono">{e.categorie}</span> — {e.libelle}</td>
                    <td className="px-2 py-1.5 text-right">{e.prevu !== null ? fcfa(e.prevu) : <span className="text-ink-700/40">non budgété</span>}</td>
                    <td className="px-2 py-1.5 text-right">{fcfa(e.consomme)}</td>
                    <td className="px-2 py-1.5 text-right">{fcfa(e.engage)}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold ${depasse ? "text-red-600" : "text-forest-800"}`}>
                      {e.disponible !== null ? (
                        <>{depasse && <AlertTriangle size={12} className="mr-1 inline" />}{fcfa(e.disponible)}</>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Documents imprimables A4 (patron officiel)
// ─────────────────────────────────────────────────────────────

function BonCommandeImprimable({
  bc, entete, onFermer,
}: {
  bc: BonCommandeVue;
  entete: EnteteEtablissement;
  onFermer: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #bon-commande-impression, #bon-commande-impression * { visibility: visible; }
          #bon-commande-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
      <div id="bon-commande-impression" className="mx-auto my-8 w-full max-w-2xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Bon de commande</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <EnTeteOfficielDoc
          etab={entete}
          titre="BON DE COMMANDE"
          sousTitre={`${bc.numero ?? ""} — ${bc.fournisseurNom}`}
        />

        <div className="mt-4 space-y-1 text-sm">
          <p><strong>Fournisseur :</strong> {bc.fournisseurNom}</p>
          <p><strong>Objet :</strong> {bc.demandeObjet} (demande {bc.demandeNumero ?? "—"})</p>
          <p>
            <strong>Émis le :</strong> {dateFr(bc.dateEmission)}{bc.emisParNom ? ` par ${bc.emisParNom}` : ""}
            {bc.dateLivraisonPrevue ? ` · Livraison attendue le ${dateFr(bc.dateLivraisonPrevue)}` : ""}
          </p>
          {bc.lieuLivraison && <p><strong>Lieu de livraison :</strong> {bc.lieuLivraison}</p>}
          {bc.conditionsPaiement && <p><strong>Conditions de paiement :</strong> {bc.conditionsPaiement}</p>}
        </div>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-forest-800 text-left text-xs uppercase tracking-wide">
              <th className="py-2 pr-2">Désignation</th>
              <th className="py-2 pr-2 text-right">Quantité</th>
              <th className="py-2 pr-2 text-right">Prix unitaire</th>
              <th className="py-2 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {bc.lignes.map((l) => (
              <tr key={l.id} className="border-b border-cream-200">
                <td className="py-1.5 pr-2">{l.designation}</td>
                <td className="py-1.5 pr-2 text-right">{l.quantite}</td>
                <td className="py-1.5 pr-2 text-right">{fcfa(l.prixUnitaire)}</td>
                <td className="py-1.5 text-right font-semibold">{fcfa(l.total)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-forest-800 font-bold">
              <td className="py-2" colSpan={3}>TOTAL</td>
              <td className="py-2 text-right">{fcfa(bc.totalCommande)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 text-xs italic">
          Arrêté le présent bon de commande à la somme de {nombreEnLettres(bc.totalCommande)} francs CFA.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <p className="font-semibold">Le Fournisseur</p>
            <p className="mt-14 border-t border-ink-700/30 pt-1 text-ink-700/50">Signature et cachet</p>
          </div>
          <div>
            <p className="font-semibold">L&apos;Économe / Gestionnaire</p>
            <p className="mt-14 border-t border-ink-700/30 pt-1 text-ink-700/50">Signature</p>
          </div>
          <div>
            <p className="font-semibold">Le Chef d&apos;établissement</p>
            <p className="mt-14 border-t border-ink-700/30 pt-1 text-ink-700/50">Signature et cachet</p>
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

function BonRetourImprimable({
  retour: r, entete, onFermer,
}: {
  retour: RetourVue;
  entete: EnteteEtablissement;
  onFermer: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #bon-retour-impression, #bon-retour-impression * { visibility: visible; }
          #bon-retour-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>
      <div id="bon-retour-impression" className="mx-auto my-8 w-full max-w-2xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Bon de retour</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <EnTeteOfficielDoc etab={entete} titre="BON DE RETOUR FOURNISSEUR" sousTitre={r.numero} />

        <div className="mt-4 space-y-1.5 text-sm">
          <p><strong>Bon de commande d&apos;origine :</strong> {r.bonCommandeNumero ?? "—"}</p>
          <p><strong>Article retourné :</strong> {r.designation} — quantité : {r.quantite}</p>
          <p><strong>Motif :</strong> {r.motif}</p>
          <p><strong>Date :</strong> {dateFr(r.date)}{r.retourneParNom ? ` · Établi par ${r.retourneParNom}` : ""}</p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 text-center text-xs">
          <div>
            <p className="font-semibold">Le Fournisseur (réception du retour)</p>
            <p className="mt-14 border-t border-ink-700/30 pt-1 text-ink-700/50">Signature et cachet</p>
          </div>
          <div>
            <p className="font-semibold">L&apos;Économe / Gestionnaire</p>
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

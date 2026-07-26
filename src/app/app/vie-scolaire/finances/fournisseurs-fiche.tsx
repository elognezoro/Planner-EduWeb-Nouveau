"use client";

/**
 * Référentiel FOURNISSEURS (13) — remplace la section minimale du 12 dans l'onglet Achats :
 * tableau de bord et alertes (RM-1003, contrats à échéance, litiges, plafonds), fiches
 * complètes dépliables (identité juridique, catégorisation, conditions commerciales,
 * contacts, comptes bancaires, documents versionnés, contrats, évaluations avec score
 * DÉRIVÉ RM-1004, litiges, historique achats/paiements du 12), workflow de QUALIFICATION
 * (prospect → approbation second acteur → actif) et transitions motivées.
 * Confirmations 2 clics, jamais de dialogue natif.
 */

import { useActionState, useState } from "react";
import {
  AlertTriangle, Ban, Building2, Check, ChevronDown, ChevronRight, ClipboardList, FileWarning,
  Landmark, Pencil, Phone, Plus, Scale, ShieldAlert, Star, Trash2, Users,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import type { EtatForm } from "@/lib/finances/actions";
import { enregistrerFournisseur, retirerFournisseur } from "@/lib/finances/actions-achats";
import {
  approuverFournisseur, changerEtatFournisseur, enregistrerCompteBancaireFournisseur,
  enregistrerContactFournisseur, enregistrerContratFournisseur, enregistrerDocumentFournisseur,
  evaluerFournisseur, ouvrirLitigeFournisseur, resoudreLitigeFournisseur,
  retirerCompteBancaireFournisseur, retirerContactFournisseur, retirerContratFournisseur,
  retirerDocumentFournisseur, retirerEvaluationFournisseur, retirerLitigeFournisseur,
} from "@/lib/finances/actions-fournisseurs";
import { TYPES_FOURNISSEUR } from "@/lib/finances/achats/types";
import {
  CRITERES_EVALUATION, GRAVITES_LITIGE, LIBELLE_ETAT_FOURNISSEUR, RENOUVELLEMENTS_CONTRAT,
  TRANSITIONS_FOURNISSEUR, TYPES_DOCUMENT_FOURNISSEUR, TYPES_LITIGE_FOURNISSEUR,
  type DonneesFournisseursVue, type FicheFournisseurVue,
} from "@/lib/finances/fournisseurs/types";
import { BoutonActionConfirmee } from "./scolarite-plus";
import { useApresSucces } from "./scolarite-onglets";
import { fcfa } from "./types";

const INITIAL: EtatForm = { ok: false };

const dateFr = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso)) : "—";

const libelleDocument = (code: string) =>
  TYPES_DOCUMENT_FOURNISSEUR.find((t) => t.code === code)?.libelle ?? code;
const libelleLitige = (code: string) =>
  TYPES_LITIGE_FOURNISSEUR.find((t) => t.code === code)?.libelle ?? code;

const BADGE_ETAT_FRS: Record<string, string> = {
  prospect: "bg-amber-50 text-amber-700",
  actif: "bg-forest-50 text-forest-800",
  surveillance: "bg-gold-100 text-gold-800",
  suspendu: "bg-red-50 text-red-600",
  archive: "bg-cream-200 text-ink-700/60",
  inactif: "bg-cream-200 text-ink-700/60",
};

// ─────────────────────────────────────────────────────────────
//  Section
// ─────────────────────────────────────────────────────────────

export function SectionFournisseursRiche({
  etablissementId, donnees, peutGerer,
}: {
  etablissementId: string;
  donnees: DonneesFournisseursVue;
  peutGerer: boolean;
}) {
  const [enEdition, setEnEdition] = useState<FicheFournisseurVue | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const tb = donnees.tableauBord;

  const stats = [
    { libelle: "Actifs", valeur: String(tb.actifs) },
    { libelle: "Prospects à qualifier", valeur: String(tb.prospects), alerte: tb.prospects > 0 },
    { libelle: "Sous surveillance / suspendus", valeur: `${tb.sousSurveillance} / ${tb.suspendus}` },
    { libelle: "Stratégiques", valeur: String(tb.strategiques) },
    { libelle: "Contrats à échéance", valeur: String(tb.contratsAEcheance), alerte: tb.contratsAEcheance > 0 },
    { libelle: "Documents expirés / expirant", valeur: String(tb.documentsExpirant), alerte: tb.documentsExpirant > 0 },
    { libelle: "Litiges ouverts", valeur: String(tb.litigesOuverts), alerte: tb.litigesOuverts > 0 },
    { libelle: "Score moyen (sur 5)", valeur: tb.scoreMoyen !== null ? String(tb.scoreMoyen) : "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.libelle} className="rounded-2xl border border-cream-200 bg-white p-3.5 shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-700/55">{s.libelle}</p>
            <p className={`mt-1 font-display text-base font-bold ${s.alerte ? "text-amber-700" : "text-forest-900"}`}>{s.valeur}</p>
          </div>
        ))}
      </div>

      {tb.top.length > 0 && (
        <Card>
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <Star size={16} className="text-forest-600" /> Principaux fournisseurs (factures validées)
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {tb.top.map((t, i) => (
              <li key={t.raisonSociale} className="rounded-full bg-cream-100 px-3 py-1.5">
                <strong>{i + 1}. {t.raisonSociale}</strong> — {fcfa(t.total)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <Building2 size={17} className="text-forest-600" /> Référentiel fournisseurs ({donnees.fiches.length})
          </h3>
          {peutGerer && (
            <button
              type="button"
              onClick={() => { setEnEdition(null); setFormOuvert((v) => !v); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
            >
              <Plus size={13} /> Nouveau fournisseur
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-700/60">
          Toute fiche naît PROSPECT et devient commandable après QUALIFICATION approuvée par un
          second acteur (jamais son créateur). Suspendu = plus de commandes (RM-1002) ; archivé =
          consultable, non sélectionnable (RM-1005).
        </p>
        {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}

        {peutGerer && (formOuvert || enEdition) && (
          <FormFournisseurRiche
            key={enEdition?.id ?? "nouveau"}
            etablissementId={etablissementId}
            enEdition={enEdition}
            onFin={() => { setEnEdition(null); setFormOuvert(false); }}
          />
        )}

        {donnees.fiches.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Aucun fournisseur enregistré.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {donnees.fiches.map((f) => (
              <FicheFournisseur
                key={f.id}
                etablissementId={etablissementId}
                fiche={f}
                peutGerer={peutGerer}
                onModifier={() => { setEnEdition(f); setFormOuvert(true); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }}
                onMessage={setMessage}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Formulaire principal (identité complète + conditions)
// ─────────────────────────────────────────────────────────────

function FormFournisseurRiche({
  etablissementId, enEdition, onFin,
}: {
  etablissementId: string;
  enEdition: FicheFournisseurVue | null;
  onFin: () => void;
}) {
  const [etat, action] = useActionState(enregistrerFournisseur, INITIAL);
  useApresSucces(etat, onFin);
  const champs: { name: string; libelle: string; valeur: string | null; type?: string; max?: number }[] = [
    { name: "raisonSociale", libelle: "Raison sociale *", valeur: enEdition?.raisonSociale ?? null, max: 120 },
    { name: "nomCommercial", libelle: "Nom commercial", valeur: enEdition?.nomCommercial ?? null, max: 120 },
    { name: "formeJuridique", libelle: "Forme juridique", valeur: enEdition?.formeJuridique ?? null, max: 60 },
    { name: "numeroRccm", libelle: "N° RCCM", valeur: enEdition?.numeroRccm ?? null, max: 40 },
    { name: "numeroFiscal", libelle: "N° compte contribuable", valeur: enEdition?.numeroFiscal ?? null, max: 40 },
    { name: "numeroCnps", libelle: "N° CNPS", valeur: enEdition?.numeroCnps ?? null, max: 40 },
    { name: "numeroTva", libelle: "N° TVA", valeur: enEdition?.numeroTva ?? null, max: 40 },
    { name: "telephone", libelle: "Téléphone", valeur: enEdition?.telephone ?? null, max: 30 },
    { name: "email", libelle: "E-mail", valeur: enEdition?.email ?? null, type: "email", max: 120 },
    { name: "siteWeb", libelle: "Site web", valeur: enEdition?.siteWeb ?? null, max: 120 },
    { name: "adresse", libelle: "Adresse", valeur: enEdition?.adresse ?? null, max: 160 },
    { name: "ville", libelle: "Ville", valeur: enEdition?.ville ?? null, max: 80 },
    { name: "region", libelle: "Région", valeur: enEdition?.region ?? null, max: 80 },
    { name: "contactNom", libelle: "Contact principal (fiche)", valeur: enEdition?.contactNom ?? null, max: 80 },
    { name: "secteurActivite", libelle: "Secteur d'activité", valeur: enEdition?.secteurActivite ?? null, max: 80 },
    { name: "categoriesProduits", libelle: "Catégories de produits/services", valeur: enEdition?.categoriesProduits ?? null, max: 200 },
  ];
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-xl border border-cream-200 bg-cream-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
      {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}
      {champs.map((c) => (
        <div key={c.name}>
          <Label htmlFor={`frs-${c.name}`}>{c.libelle}</Label>
          <Input
            id={`frs-${c.name}`} name={c.name} defaultValue={c.valeur ?? ""}
            type={c.type ?? "text"} maxLength={c.max} required={c.name === "raisonSociale"}
          />
        </div>
      ))}
      <div>
        <Label htmlFor="frs-type">Type</Label>
        <Select id="frs-type" name="type" defaultValue={enEdition?.type ?? "biens"}>
          {TYPES_FOURNISSEUR.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="frs-strategique">Niveau stratégique</Label>
        <Select id="frs-strategique" name="niveauStrategique" defaultValue={enEdition?.niveauStrategique ?? "standard"}>
          <option value="standard">Standard</option>
          <option value="strategique">Stratégique</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="frs-risque">Niveau de risque</Label>
        <Select id="frs-risque" name="niveauRisque" defaultValue={enEdition?.niveauRisque ?? "faible"}>
          <option value="faible">Faible</option>
          <option value="moyen">Moyen</option>
          <option value="eleve">Élevé</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="frs-delai">Délai de paiement (jours)</Label>
        <Input id="frs-delai" name="delaiPaiementJours" type="number" min={1} max={365} defaultValue={enEdition?.delaiPaiementJours ?? ""} />
      </div>
      <div>
        <Label htmlFor="frs-remise">Remise (%)</Label>
        <Input id="frs-remise" name="remisePourcent" type="number" min={1} max={100} defaultValue={enEdition?.remisePourcent ?? ""} />
      </div>
      <div>
        <Label htmlFor="frs-minimum">Minimum de commande (FCFA)</Label>
        <Input id="frs-minimum" name="minimumCommande" type="number" min={1} defaultValue={enEdition?.minimumCommande ?? ""} />
      </div>
      <div>
        <Label htmlFor="frs-plafond">Plafond de crédit (FCFA)</Label>
        <Input id="frs-plafond" name="plafondCredit" type="number" min={1} defaultValue={enEdition?.plafondCredit ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="frs-notes">Notes</Label>
        <Input id="frs-notes" name="notes" defaultValue={enEdition?.notes ?? ""} maxLength={300} />
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <SubmitButton>{enEdition ? "Mettre à jour la fiche" : "Créer (statut PROSPECT)"}</SubmitButton>
        <button type="button" onClick={onFin} className="rounded-full border border-cream-300 px-4 py-2 text-xs font-semibold text-ink-700/70 hover:bg-cream-100">
          Abandonner
        </button>
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
//  Fiche dépliable
// ─────────────────────────────────────────────────────────────

type VoletFiche = "identite" | "contacts" | "documents" | "contrats" | "evaluations" | "litiges";

function FicheFournisseur({
  etablissementId, fiche: f, peutGerer, onModifier, onMessage,
}: {
  etablissementId: string;
  fiche: FicheFournisseurVue;
  peutGerer: boolean;
  onModifier: () => void;
  onMessage: (m: string | null) => void;
}) {
  const [ouverte, setOuverte] = useState(false);
  const [volet, setVolet] = useState<VoletFiche>("identite");
  const [motif, setMotif] = useState("");
  const docsEnAlerte = f.documents.filter((d) => d.expire || d.expireBientot).length;
  const litigesOuverts = f.litiges.filter((l) => l.statut === "ouvert").length;
  const transitions = TRANSITIONS_FOURNISSEUR[f.statut] ?? [];

  const volets: { cle: VoletFiche; libelle: string; Icone: typeof Users }[] = [
    { cle: "identite", libelle: "Identité & achats", Icone: ClipboardList },
    { cle: "contacts", libelle: `Contacts & banques (${f.contacts.length + f.comptesBancaires.length})`, Icone: Phone },
    { cle: "documents", libelle: `Documents (${f.documents.length})`, Icone: FileWarning },
    { cle: "contrats", libelle: `Contrats (${f.contrats.length})`, Icone: Scale },
    { cle: "evaluations", libelle: `Évaluations (${f.evaluations.length})`, Icone: Star },
    { cle: "litiges", libelle: `Litiges (${f.litiges.length})`, Icone: ShieldAlert },
  ];

  return (
    <li className="rounded-2xl border border-cream-200 bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-forest-900">
            <button type="button" onClick={() => setOuverte((v) => !v)} className="rounded-full p-0.5 text-forest-700 hover:bg-forest-50" aria-label="Fiche">
              {ouverte ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <span className="font-mono text-xs">{f.code}</span> {f.raisonSociale}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_ETAT_FRS[f.statut] ?? BADGE_ETAT_FRS.inactif}`}>
              {LIBELLE_ETAT_FOURNISSEUR[f.statut] ?? f.statut}
            </span>
            {f.niveauStrategique === "strategique" && (
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-semibold text-gold-800">Stratégique</span>
            )}
            {f.niveauRisque === "eleve" && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">Risque élevé</span>
            )}
            {f.scoreGlobal !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-semibold text-forest-800">
                <Star size={10} /> {f.scoreGlobal}/5
              </span>
            )}
            {docsEnAlerte > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                <FileWarning size={10} /> {docsEnAlerte} doc.
              </span>
            )}
            {litigesOuverts > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                <ShieldAlert size={10} /> {litigesOuverts} litige(s)
              </span>
            )}
            {f.plafondDepasse && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                <AlertTriangle size={10} /> Plafond de crédit dépassé
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink-700/60">
            {[f.type, f.ville, f.telephone, f.email].filter(Boolean).join(" · ") || "—"}
            {f.approuveParNom ? ` · approuvé par ${f.approuveParNom} le ${dateFr(f.dateApprobation)}` : ""}
          </p>
        </div>
        {peutGerer && (
          <div className="flex flex-wrap items-center gap-1.5">
            {f.statut !== "archive" && (
              <button type="button" onClick={onModifier} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
                <Pencil size={11} /> Modifier
              </button>
            )}
            {f.statut === "prospect" && (
              <BoutonActionConfirmee
                libelle="Approuver (qualification)" icone={Check} ton="primaire" action={approuverFournisseur}
                champs={{ etablissementId, id: f.id, version: String(f.version) }}
                onSucces={(m) => onMessage(m ?? "Fournisseur approuvé.")}
              />
            )}
            {transitions.filter((t) => t !== "suspendu" && t !== "archive").map((cible) => (
              <BoutonActionConfirmee
                key={cible}
                libelle={cible === "actif" ? "Réactiver" : cible === "surveillance" ? "Surveiller" : "Requalifier"}
                icone={cible === "surveillance" ? ShieldAlert : Check}
                action={changerEtatFournisseur}
                champs={{ etablissementId, id: f.id, version: String(f.version), cible, motif: "" }}
                onSucces={(m) => onMessage(m ?? "État mis à jour.")}
              />
            ))}
            {(transitions.includes("suspendu") || transitions.includes("archive")) && (
              <span className="inline-flex items-center gap-1">
                <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif…" className="h-8 w-32 text-xs" />
                {transitions.includes("suspendu") && (
                  <BoutonActionConfirmee
                    libelle="Suspendre" icone={Ban} ton="danger" action={changerEtatFournisseur}
                    champs={{ etablissementId, id: f.id, version: String(f.version), cible: "suspendu", motif }}
                    desactive={motif.trim().length === 0}
                    onSucces={(m) => { onMessage(m ?? "Fournisseur suspendu."); setMotif(""); }}
                  />
                )}
                {transitions.includes("archive") && (
                  <BoutonActionConfirmee
                    libelle="Archiver" icone={Trash2} ton="danger" action={changerEtatFournisseur}
                    champs={{ etablissementId, id: f.id, version: String(f.version), cible: "archive", motif }}
                    desactive={motif.trim().length === 0}
                    onSucces={(m) => { onMessage(m ?? "Fournisseur archivé."); setMotif(""); }}
                  />
                )}
              </span>
            )}
            {f.historique.nbBonsCommande === 0 && (
              <BoutonActionConfirmee
                libelle="Retirer" icone={Trash2} ton="danger" action={retirerFournisseur}
                champs={{ etablissementId, id: f.id, version: String(f.version) }}
                onSucces={(m) => onMessage(m ?? "Fournisseur retiré.")}
              />
            )}
          </div>
        )}
      </div>

      {ouverte && (
        <div className="mt-3 space-y-3 rounded-xl bg-cream-50/70 p-3">
          <div className="flex flex-wrap gap-1.5">
            {volets.map((v) => (
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

          {volet === "identite" && <VoletIdentite fiche={f} />}
          {volet === "contacts" && (
            <VoletContacts etablissementId={etablissementId} fiche={f} peutGerer={peutGerer} onMessage={onMessage} />
          )}
          {volet === "documents" && (
            <VoletDocuments etablissementId={etablissementId} fiche={f} peutGerer={peutGerer} onMessage={onMessage} />
          )}
          {volet === "contrats" && (
            <VoletContrats etablissementId={etablissementId} fiche={f} peutGerer={peutGerer} onMessage={onMessage} />
          )}
          {volet === "evaluations" && (
            <VoletEvaluations etablissementId={etablissementId} fiche={f} peutGerer={peutGerer} onMessage={onMessage} />
          )}
          {volet === "litiges" && (
            <VoletLitiges etablissementId={etablissementId} fiche={f} peutGerer={peutGerer} onMessage={onMessage} />
          )}
        </div>
      )}
    </li>
  );
}

function VoletIdentite({ fiche: f }: { fiche: FicheFournisseurVue }) {
  const lignes: [string, string | null][] = [
    ["Forme juridique", f.formeJuridique],
    ["RCCM", f.numeroRccm],
    ["Compte contribuable", f.numeroFiscal],
    ["CNPS", f.numeroCnps],
    ["TVA", f.numeroTva],
    ["Adresse", [f.adresse, f.ville, f.region].filter(Boolean).join(", ") || null],
    ["Site web", f.siteWeb],
    ["Secteur", f.secteurActivite],
    ["Catégories", f.categoriesProduits],
    ["Conditions", [
      f.delaiPaiementJours !== null ? `paiement ${f.delaiPaiementJours} j` : null,
      f.remisePourcent !== null ? `remise ${f.remisePourcent} %` : null,
      f.minimumCommande !== null ? `min. commande ${fcfa(f.minimumCommande)}` : null,
      f.plafondCredit !== null ? `plafond crédit ${fcfa(f.plafondCredit)}` : null,
    ].filter(Boolean).join(" · ") || null],
    ["Notes", f.notes],
  ];
  const h = f.historique;
  return (
    <div className="space-y-3 text-xs">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {lignes.filter(([, v]) => v).map(([l, v]) => (
          <p key={l}><strong className="text-forest-900">{l} :</strong> {v}</p>
        ))}
      </div>
      <div>
        <p className="font-semibold text-forest-900">Historique achats &amp; paiements (12)</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {[
            `${h.nbBonsCommande} bon(s) émis — ${fcfa(h.totalCommande)}`,
            `Facturé (validé) : ${fcfa(h.totalFactureValidee)}`,
            `Payé : ${fcfa(h.totalPaye)}`,
            `Encours : ${fcfa(h.encours)}`,
            `${h.nbRetours} retour(s)`,
          ].map((t) => (
            <span key={t} className="rounded-full bg-white px-3 py-1.5 shadow-soft">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Contacts & comptes bancaires ───

function VoletContacts({
  etablissementId, fiche: f, peutGerer, onMessage,
}: {
  etablissementId: string;
  fiche: FicheFournisseurVue;
  peutGerer: boolean;
  onMessage: (m: string | null) => void;
}) {
  const [etatContact, actionContact] = useActionState(enregistrerContactFournisseur, INITIAL);
  const [etatCompte, actionCompte] = useActionState(enregistrerCompteBancaireFournisseur, INITIAL);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2 text-xs">
        <p className="inline-flex items-center gap-1.5 font-semibold text-forest-900"><Users size={13} /> Contacts</p>
        {f.contacts.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
            <span>
              <strong>{c.nom}</strong>{c.fonction ? ` (${c.fonction})` : ""} — {[c.telephone, c.email].filter(Boolean).join(" · ") || "—"}
              {c.principal && <span className="ml-1.5 rounded-full bg-forest-50 px-1.5 py-0.5 text-[10px] font-bold text-forest-800">PRINCIPAL</span>}
            </span>
            {peutGerer && (
              <BoutonActionConfirmee
                libelle="Retirer" icone={Trash2} ton="danger" action={retirerContactFournisseur}
                champs={{ etablissementId, id: c.id, version: String(c.version) }}
                onSucces={(m) => onMessage(m ?? "Contact retiré.")}
              />
            )}
          </div>
        ))}
        {peutGerer && (
          <form action={actionContact} className="grid gap-2 rounded-lg border border-cream-200 bg-white p-2.5 sm:grid-cols-2">
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <input type="hidden" name="fournisseurId" value={f.id} />
            <Input name="nom" required maxLength={80} placeholder="Nom *" className="h-8 text-xs" />
            <Input name="fonction" maxLength={80} placeholder="Fonction" className="h-8 text-xs" />
            <Input name="telephone" maxLength={30} placeholder="Téléphone" className="h-8 text-xs" />
            <Input name="email" type="email" maxLength={120} placeholder="E-mail" className="h-8 text-xs" />
            <Select name="principal" defaultValue="non" className="h-8 text-xs">
              <option value="non">Contact secondaire</option>
              <option value="oui">Contact PRINCIPAL</option>
            </Select>
            <SubmitButton>Ajouter le contact</SubmitButton>
            {etatContact.message && <div className="sm:col-span-2"><FormAlert ton={etatContact.ok ? "succes" : "erreur"}>{etatContact.message}</FormAlert></div>}
          </form>
        )}
      </div>

      <div className="space-y-2 text-xs">
        <p className="inline-flex items-center gap-1.5 font-semibold text-forest-900"><Landmark size={13} /> Coordonnées bancaires (paiements)</p>
        {f.comptesBancaires.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
            <span>
              <strong>{c.banque}</strong>{c.agence ? ` (${c.agence})` : ""} —{" "}
              {[c.numeroCompte, c.iban, c.mobileMoney ? `MM ${c.mobileMoney}` : null].filter(Boolean).join(" · ") || "—"}
              {c.principal && <span className="ml-1.5 rounded-full bg-forest-50 px-1.5 py-0.5 text-[10px] font-bold text-forest-800">PRINCIPAL</span>}
            </span>
            {peutGerer && (
              <BoutonActionConfirmee
                libelle="Retirer" icone={Trash2} ton="danger" action={retirerCompteBancaireFournisseur}
                champs={{ etablissementId, id: c.id, version: String(c.version) }}
                onSucces={(m) => onMessage(m ?? "Compte retiré.")}
              />
            )}
          </div>
        ))}
        {peutGerer && (
          <form action={actionCompte} className="grid gap-2 rounded-lg border border-cream-200 bg-white p-2.5 sm:grid-cols-2">
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <input type="hidden" name="fournisseurId" value={f.id} />
            <Input name="banque" required maxLength={80} placeholder="Banque *" className="h-8 text-xs" />
            <Input name="agence" maxLength={80} placeholder="Agence" className="h-8 text-xs" />
            <Input name="numeroCompte" maxLength={40} placeholder="N° de compte" className="h-8 text-xs" />
            <Input name="iban" maxLength={40} placeholder="IBAN" className="h-8 text-xs" />
            <Input name="swift" maxLength={20} placeholder="SWIFT/BIC" className="h-8 text-xs" />
            <Input name="mobileMoney" maxLength={30} placeholder="Mobile Money Business" className="h-8 text-xs" />
            <Select name="principal" defaultValue="non" className="h-8 text-xs">
              <option value="non">Compte secondaire</option>
              <option value="oui">Compte PRINCIPAL</option>
            </Select>
            <SubmitButton>Ajouter le compte</SubmitButton>
            {etatCompte.message && <div className="sm:col-span-2"><FormAlert ton={etatCompte.ok ? "succes" : "erreur"}>{etatCompte.message}</FormAlert></div>}
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Documents (RM-1003) ───

function VoletDocuments({
  etablissementId, fiche: f, peutGerer, onMessage,
}: {
  etablissementId: string;
  fiche: FicheFournisseurVue;
  peutGerer: boolean;
  onMessage: (m: string | null) => void;
}) {
  const [etat, action] = useActionState(enregistrerDocumentFournisseur, INITIAL);
  return (
    <div className="space-y-2 text-xs">
      {f.documents.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
          <span>
            <strong>{libelleDocument(d.type)}</strong> v{d.numeroVersion}
            {d.reference ? ` · ${d.reference}` : ""} · émis {dateFr(d.dateEmission)} · expire {dateFr(d.dateExpiration)}
            {d.expire && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">EXPIRÉ (RM-1003)</span>}
            {d.expireBientot && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">EXPIRE BIENTÔT</span>}
          </span>
          {peutGerer && (
            <BoutonActionConfirmee
              libelle="Retirer" icone={Trash2} ton="danger" action={retirerDocumentFournisseur}
              champs={{ etablissementId, id: d.id, version: String(d.version) }}
              onSucces={(m) => onMessage(m ?? "Document retiré.")}
            />
          )}
        </div>
      ))}
      {f.documents.length === 0 && <p className="text-ink-700/60">Aucun document (le fichier joint viendra avec le chantier documents — référence texte en V1).</p>}
      {peutGerer && (
        <form action={action} className="grid gap-2 rounded-lg border border-cream-200 bg-white p-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <input type="hidden" name="fournisseurId" value={f.id} />
          <Select name="type" defaultValue="rccm" className="h-8 text-xs">
            {TYPES_DOCUMENT_FOURNISSEUR.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
          </Select>
          <Input name="reference" maxLength={120} placeholder="Référence" className="h-8 text-xs" />
          <Input name="dateEmission" type="date" className="h-8 text-xs" />
          <Input name="dateExpiration" type="date" className="h-8 text-xs" />
          <SubmitButton>Ajouter</SubmitButton>
          {etat.message && <div className="sm:col-span-2 lg:col-span-5"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
        </form>
      )}
    </div>
  );
}

// ─── Contrats ───

const BADGE_CONTRAT: Record<string, { libelle: string; classe: string }> = {
  en_cours: { libelle: "En cours", classe: "bg-forest-50 text-forest-800" },
  echeance_proche: { libelle: "Échéance proche", classe: "bg-amber-50 text-amber-700" },
  expire: { libelle: "Expiré", classe: "bg-red-50 text-red-600" },
  a_venir: { libelle: "À venir", classe: "bg-cream-200 text-forest-800" },
};

function VoletContrats({
  etablissementId, fiche: f, peutGerer, onMessage,
}: {
  etablissementId: string;
  fiche: FicheFournisseurVue;
  peutGerer: boolean;
  onMessage: (m: string | null) => void;
}) {
  const [etat, action] = useActionState(enregistrerContratFournisseur, INITIAL);
  return (
    <div className="space-y-2 text-xs">
      {f.contrats.map((c) => {
        const badge = BADGE_CONTRAT[c.etat] ?? BADGE_CONTRAT.en_cours;
        return (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
            <span>
              <strong>{c.reference}</strong> — {c.objet} · du {dateFr(c.dateDebut)} au {dateFr(c.dateFin)}
              {c.montant !== null ? ` · ${fcfa(c.montant)}` : ""}
              {" "}· {RENOUVELLEMENTS_CONTRAT.find((r) => r.code === c.renouvellement)?.libelle}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badge.classe}`}>{badge.libelle}</span>
            </span>
            {peutGerer && (
              <BoutonActionConfirmee
                libelle="Retirer" icone={Trash2} ton="danger" action={retirerContratFournisseur}
                champs={{ etablissementId, id: c.id, version: String(c.version) }}
                onSucces={(m) => onMessage(m ?? "Contrat retiré.")}
              />
            )}
          </div>
        );
      })}
      {f.contrats.length === 0 && <p className="text-ink-700/60">Aucun contrat.</p>}
      {peutGerer && (
        <form action={action} className="grid gap-2 rounded-lg border border-cream-200 bg-white p-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <input type="hidden" name="fournisseurId" value={f.id} />
          <Input name="reference" required maxLength={60} placeholder="Référence *" className="h-8 text-xs" />
          <Input name="objet" required maxLength={200} placeholder="Objet *" className="h-8 text-xs" />
          <div>
            <Label htmlFor={`ct-debut-${f.id}`} className="text-[10px]">Début *</Label>
            <Input id={`ct-debut-${f.id}`} name="dateDebut" type="date" required className="h-8 text-xs" />
          </div>
          <div>
            <Label htmlFor={`ct-fin-${f.id}`} className="text-[10px]">Fin</Label>
            <Input id={`ct-fin-${f.id}`} name="dateFin" type="date" className="h-8 text-xs" />
          </div>
          <Input name="montant" type="number" min={1} placeholder="Montant (FCFA)" className="h-8 text-xs" />
          <Input name="conditionsPaiement" maxLength={160} placeholder="Conditions de paiement" className="h-8 text-xs" />
          <Input name="penalites" maxLength={200} placeholder="Pénalités" className="h-8 text-xs" />
          <Select name="renouvellement" defaultValue="aucun" className="h-8 text-xs">
            {RENOUVELLEMENTS_CONTRAT.map((r) => <option key={r.code} value={r.code}>{r.libelle}</option>)}
          </Select>
          <Input name="documentReference" maxLength={120} placeholder="Réf. du document signé" className="h-8 text-xs" />
          <SubmitButton>Enregistrer le contrat</SubmitButton>
          {etat.message && <div className="sm:col-span-2 lg:col-span-4"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
        </form>
      )}
    </div>
  );
}

// ─── Évaluations (RM-1004) ───

function VoletEvaluations({
  etablissementId, fiche: f, peutGerer, onMessage,
}: {
  etablissementId: string;
  fiche: FicheFournisseurVue;
  peutGerer: boolean;
  onMessage: (m: string | null) => void;
}) {
  const [etat, action] = useActionState(evaluerFournisseur, INITIAL);
  return (
    <div className="space-y-2 text-xs">
      {f.scoreGlobal !== null && (
        <p className="font-semibold text-forest-900">
          Score global : {f.scoreGlobal}/5 (moyenne des évaluations — RM-1004 ; pondération paramétrable à venir).
        </p>
      )}
      {f.evaluations.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
          <span>
            <strong>{e.periode}</strong> — global {e.scoreGlobal}/5 · qualité {e.scoreQualite} · délais {e.scoreDelais} ·
            prix {e.scorePrix} · service {e.scoreService} · conformité {e.scoreConformite}
            {e.commentaire ? ` · ${e.commentaire}` : ""}{e.evalueParNom ? ` · par ${e.evalueParNom}` : ""}
          </span>
          {peutGerer && (
            <BoutonActionConfirmee
              libelle="Retirer" icone={Trash2} ton="danger" action={retirerEvaluationFournisseur}
              champs={{ etablissementId, id: e.id, version: String(e.version) }}
              onSucces={(m) => onMessage(m ?? "Évaluation retirée.")}
            />
          )}
        </div>
      ))}
      {f.evaluations.length === 0 && <p className="text-ink-700/60">Aucune évaluation.</p>}
      {peutGerer && (
        <form action={action} className="grid gap-2 rounded-lg border border-cream-200 bg-white p-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <input type="hidden" name="fournisseurId" value={f.id} />
          <Input name="periode" required maxLength={40} placeholder="Période évaluée * (ex : 2025-2026 T1)" className="h-8 text-xs sm:col-span-2" />
          {CRITERES_EVALUATION.map((c) => (
            <div key={c.cle}>
              <Label htmlFor={`ev-${c.cle}-${f.id}`} className="text-[10px]">{c.libelle}</Label>
              <Select id={`ev-${c.cle}-${f.id}`} name={c.cle} defaultValue="3" className="h-8 text-xs">
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
          ))}
          <Input name="commentaire" maxLength={300} placeholder="Commentaire" className="h-8 text-xs sm:col-span-2" />
          <SubmitButton>Évaluer</SubmitButton>
          {etat.message && <div className="sm:col-span-2 lg:col-span-4"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
        </form>
      )}
    </div>
  );
}

// ─── Litiges ───

function VoletLitiges({
  etablissementId, fiche: f, peutGerer, onMessage,
}: {
  etablissementId: string;
  fiche: FicheFournisseurVue;
  peutGerer: boolean;
  onMessage: (m: string | null) => void;
}) {
  const [etat, action] = useActionState(ouvrirLitigeFournisseur, INITIAL);
  return (
    <div className="space-y-2 text-xs">
      {f.litiges.map((l) => (
        <LigneLitige key={l.id} etablissementId={etablissementId} litige={l} peutGerer={peutGerer} onMessage={onMessage} />
      ))}
      {f.litiges.length === 0 && <p className="text-ink-700/60">Aucun litige.</p>}
      {peutGerer && (
        <form action={action} className="grid gap-2 rounded-lg border border-cream-200 bg-white p-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <input type="hidden" name="fournisseurId" value={f.id} />
          <Select name="type" defaultValue="retard_livraison" className="h-8 text-xs">
            {TYPES_LITIGE_FOURNISSEUR.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
          </Select>
          <Select name="gravite" defaultValue="moyenne" className="h-8 text-xs">
            {GRAVITES_LITIGE.map((g) => <option key={g.code} value={g.code}>{g.libelle}</option>)}
          </Select>
          <Input name="responsable" maxLength={80} placeholder="Responsable du suivi" className="h-8 text-xs" />
          <Input name="description" required maxLength={400} placeholder="Description *" className="h-8 text-xs sm:col-span-2 lg:col-span-3" />
          <SubmitButton>Ouvrir le litige</SubmitButton>
          {etat.message && <div className="sm:col-span-2 lg:col-span-4"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
        </form>
      )}
    </div>
  );
}

function LigneLitige({
  etablissementId, litige: l, peutGerer, onMessage,
}: {
  etablissementId: string;
  litige: FicheFournisseurVue["litiges"][number];
  peutGerer: boolean;
  onMessage: (m: string | null) => void;
}) {
  const [solution, setSolution] = useState("");
  const [motif, setMotif] = useState("");
  return (
    <div className="rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>{libelleLitige(l.type)}</strong> ({GRAVITES_LITIGE.find((g) => g.code === l.gravite)?.libelle ?? l.gravite})
          — {l.description} · {dateFr(l.date)}
          <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${l.statut === "ouvert" ? "bg-red-50 text-red-600" : "bg-forest-50 text-forest-800"}`}>
            {l.statut === "ouvert" ? "OUVERT" : `RÉSOLU le ${dateFr(l.dateCloture)}`}
          </span>
          {l.solution ? ` · Solution : ${l.solution}` : ""}
        </span>
        {peutGerer && (
          <span className="flex flex-wrap items-center gap-1.5">
            {l.statut === "ouvert" && (
              <>
                <Input value={solution} onChange={(e) => setSolution(e.target.value)} maxLength={400} placeholder="Solution apportée…" className="h-7 w-44 text-xs" />
                <BoutonActionConfirmee
                  libelle="Résoudre" icone={Check} ton="primaire" action={resoudreLitigeFournisseur}
                  champs={{ etablissementId, id: l.id, version: String(l.version), solution }}
                  desactive={solution.trim().length === 0}
                  onSucces={(m) => { onMessage(m ?? "Litige résolu."); setSolution(""); }}
                />
              </>
            )}
            <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif retrait…" className="h-7 w-32 text-xs" />
            <BoutonActionConfirmee
              libelle="Retirer" icone={Trash2} ton="danger" action={retirerLitigeFournisseur}
              champs={{ etablissementId, id: l.id, version: String(l.version), motif }}
              desactive={motif.trim().length === 0}
              onSucces={(m) => { onMessage(m ?? "Litige retiré."); setMotif(""); }}
            />
          </span>
        )}
      </div>
    </div>
  );
}

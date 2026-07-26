"use client";

/**
 * Onglet DÉPENSES (17) : tableau de bord, demandes de dépense (workflow demande → validation
 * à seuils → approbation/engagement → décaissement caisse/banque → écriture de charge),
 * notes de frais (type mission), avances sur frais régularisées, dépenses récurrentes
 * (échéancier + génération), ORDRE DE DÉPENSE imprimable A4. Confirmations 2 clics, jamais de
 * dialogue natif.
 */

import { useActionState, useState } from "react";
import {
  Ban, Calendar, Check, ChevronDown, ChevronRight, ClipboardList, HandCoins, Pencil,
  Plus, Printer, Repeat, Send, Wallet, X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import { CATEGORIES_OHADA } from "@/lib/finances/categories";
import type { EtatForm } from "@/lib/finances/actions";
import {
  annulerAvance, cloturerDepense, deciderDepense, enregistrerAvance, enregistrerDepense,
  enregistrerRecurrente, genererEcheancesRecurrentes, payerDepense, regulariserAvance,
  retirerDepense, retirerRecurrente, soumettreDepense,
} from "@/lib/finances/actions-depenses";
import {
  LIBELLE_STATUT_DEPENSE, LIBELLE_TYPE_DEPENSE, MODES_DEPENSE, MOTIFS_AVANCE, PERIODICITES,
  SEUIL_APPROBATION_DIRECTION_DEPENSE, TYPES_DEPENSE, URGENCES_DEPENSE,
  type AvanceVue, type DepenseRecurrenteVue, type DepenseVue, type DonneesDepensesVue,
} from "@/lib/finances/depenses/types";
import type { EnteteEtablissement } from "./finances-vue";
import { BoutonActionConfirmee } from "./scolarite-plus";
import { useApresSucces, nombreEnLettres } from "./scolarite-onglets";
import { fcfa, LIBELLE_MODE } from "./types";

const INITIAL: EtatForm = { ok: false };
const CATEGORIES_DEPENSE = CATEGORIES_OHADA.filter((c) => c.sens === "depense");
const dateFr = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso)) : "—";
const auj = () => new Date().toISOString().slice(0, 10);

export interface DroitsDepensesUi {
  creer: boolean;
  valider: boolean;
  approuver: boolean;
  payer: boolean;
}

type SectionDepenses = "demandes" | "avances" | "recurrentes";

const BADGE_DEPENSE: Record<string, string> = {
  brouillon: "bg-cream-200 text-forest-800",
  soumise: "bg-amber-50 text-amber-700",
  approuvee: "bg-gold-100 text-gold-800",
  refusee: "bg-red-50 text-red-600",
  payee: "bg-forest-50 text-forest-800",
  cloturee: "bg-cream-200 text-ink-700/60",
  archivee: "bg-cream-200 text-ink-700/60",
};

export function OngletDepenses({
  etablissementId, donnees, centres, entete, droits,
}: {
  etablissementId: string;
  donnees: DonneesDepensesVue;
  centres: { id: string; libelle: string }[];
  entete: EnteteEtablissement;
  droits: DroitsDepensesUi;
}) {
  const [section, setSection] = useState<SectionDepenses>("demandes");
  const [ordreImprime, setOrdreImprime] = useState<DepenseVue | null>(null);
  const tb = donnees.tableauBord;

  const stats = [
    { libelle: "En attente de validation", valeur: String(tb.enAttente), alerte: tb.enAttente > 0 },
    { libelle: "Approuvées à payer", valeur: String(tb.approuveesNonPayees), alerte: tb.approuveesNonPayees > 0 },
    { libelle: "Payées ce mois", valeur: fcfa(tb.montantMois) },
    { libelle: "Payées (exercice)", valeur: fcfa(tb.montantExercice) },
    { libelle: "Avances en cours", valeur: String(tb.avancesEnCours), alerte: tb.avancesEnCours > 0 },
    { libelle: "Récurrences dues", valeur: String(tb.recurrentesDues), alerte: tb.recurrentesDues > 0 },
  ];

  const sections: { cle: SectionDepenses; libelle: string; Icone: typeof ClipboardList }[] = [
    { cle: "demandes", libelle: "Demandes de dépense", Icone: ClipboardList },
    { cle: "avances", libelle: `Avances (${donnees.avances.filter((a) => a.statut === "decaissee").length})`, Icone: HandCoins },
    { cle: "recurrentes", libelle: `Récurrentes (${donnees.recurrentes.filter((r) => r.actif).length})`, Icone: Repeat },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.libelle} className="rounded-2xl border border-cream-200 bg-white p-3 shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-700/55">{s.libelle}</p>
            <p className={`mt-1 font-display text-sm font-bold ${s.alerte ? "text-amber-700" : "text-forest-900"}`}>{s.valeur}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <button
            key={s.cle}
            type="button"
            onClick={() => setSection(s.cle)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
              section === s.cle ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 bg-white text-ink-700/70 hover:bg-cream-100"
            }`}
          >
            <s.Icone size={13} /> {s.libelle}
          </button>
        ))}
      </div>

      {section === "demandes" && (
        <SectionDemandes etablissementId={etablissementId} donnees={donnees} centres={centres} droits={droits} onImprimer={setOrdreImprime} />
      )}
      {section === "avances" && <SectionAvances etablissementId={etablissementId} donnees={donnees} droits={droits} />}
      {section === "recurrentes" && <SectionRecurrentes etablissementId={etablissementId} donnees={donnees} droits={droits} />}

      {ordreImprime && <OrdreDepenseImprimable depense={ordreImprime} entete={entete} onFermer={() => setOrdreImprime(null)} />}
    </div>
  );
}

// ─── Demandes ───

function SectionDemandes({
  etablissementId, donnees, centres, droits, onImprimer,
}: {
  etablissementId: string;
  donnees: DonneesDepensesVue;
  centres: { id: string; libelle: string }[];
  droits: DroitsDepensesUi;
  onImprimer: (d: DepenseVue) => void;
}) {
  const [enEdition, setEnEdition] = useState<DepenseVue | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [etat, action] = useActionState(enregistrerDepense, INITIAL);
  useApresSucces(etat, () => { setEnEdition(null); setFormOuvert(false); });

  return (
    <div className="space-y-4">
      {droits.creer && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <ClipboardList size={17} className="text-forest-600" />
              {enEdition ? `Modifier ${enEdition.numero ?? "le brouillon"}` : "Nouvelle demande de dépense"}
            </h3>
            <button type="button" onClick={() => { setEnEdition(null); setFormOuvert((v) => !v); }} className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700">
              <Plus size={13} /> Nouvelle dépense
            </button>
          </div>
          {(formOuvert || enEdition) && (
            <form action={action} key={enEdition?.id ?? "nouveau"} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="etablissementId" value={etablissementId} />
              {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
              {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}
              <div className="sm:col-span-2">
                <Label htmlFor="dp-objet">Objet *</Label>
                <Input id="dp-objet" name="objet" required maxLength={160} defaultValue={enEdition?.objet ?? ""} />
              </div>
              <div>
                <Label htmlFor="dp-type">Type</Label>
                <Select id="dp-type" name="type" defaultValue={enEdition?.type ?? "fonctionnement"}>
                  {TYPES_DEPENSE.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="dp-urgence">Urgence</Label>
                <Select id="dp-urgence" name="urgence" defaultValue={enEdition?.urgence ?? "normale"}>
                  {URGENCES_DEPENSE.map((x) => <option key={x.code} value={x.code}>{x.libelle}</option>)}
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor="dp-cat">Catégorie budgétaire (dépense OHADA)</Label>
                <Select id="dp-cat" name="categorie" required defaultValue={enEdition?.categorie ?? ""}>
                  <option value="" disabled>Choisir…</option>
                  {CATEGORIES_DEPENSE.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="dp-montant">Montant estimé (FCFA)</Label>
                <Input id="dp-montant" name="montantEstime" type="number" min={1} required defaultValue={enEdition?.montantEstime ?? ""} />
                <p className="mt-1 text-[11px] text-ink-700/50">Au-delà de {fcfa(SEUIL_APPROBATION_DIRECTION_DEPENSE)} : approbation direction.</p>
              </div>
              <div>
                <Label htmlFor="dp-centre">Centre de coût</Label>
                <Select id="dp-centre" name="centreCoutId" defaultValue="">
                  <option value="">—</option>
                  {centres.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="dp-service">Service</Label>
                <Input id="dp-service" name="service" maxLength={80} defaultValue={enEdition?.service ?? ""} />
              </div>
              <div>
                <Label htmlFor="dp-projet">Projet</Label>
                <Input id="dp-projet" name="projet" maxLength={80} defaultValue={enEdition?.projet ?? ""} />
              </div>
              <div>
                <Label htmlFor="dp-benef">Bénéficiaire (note de frais)</Label>
                <Input id="dp-benef" name="beneficiaire" maxLength={120} defaultValue={enEdition?.beneficiaire ?? ""} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="dp-piece">Pièce justificative</Label>
                <Input id="dp-piece" name="pieceJustificative" maxLength={120} defaultValue={enEdition?.pieceJustificative ?? ""} />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Label htmlFor="dp-desc">Description</Label>
                <Input id="dp-desc" name="description" maxLength={400} defaultValue={enEdition?.description ?? ""} />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
                <SubmitButton>{enEdition ? "Mettre à jour" : "Enregistrer (brouillon)"}</SubmitButton>
                <button type="button" onClick={() => { setEnEdition(null); setFormOuvert(false); }} className="rounded-full border border-cream-300 px-4 py-2 text-xs font-semibold text-ink-700/70 hover:bg-cream-100">Abandonner</button>
                {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
              </div>
            </form>
          )}
        </Card>
      )}

      <Card>
        <h3 className="font-display text-base font-bold text-forest-900">Dépenses ({donnees.depenses.length})</h3>
        {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
        {donnees.depenses.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Aucune dépense. Le cycle commence ici (aucune dépense hors contrôle).</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {donnees.depenses.map((d) => (
              <LigneDepense key={d.id} etablissementId={etablissementId} depense={d} droits={droits} onModifier={() => { setEnEdition(d); setFormOuvert(true); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }} onImprimer={() => onImprimer(d)} onMessage={setMessage} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function LigneDepense({
  etablissementId, depense: d, droits, onModifier, onImprimer, onMessage,
}: {
  etablissementId: string;
  depense: DepenseVue;
  droits: DroitsDepensesUi;
  onModifier: () => void;
  onImprimer: () => void;
  onMessage: (m: string | null) => void;
}) {
  const [detail, setDetail] = useState(false);
  const [motifRefus, setMotifRefus] = useState("");
  const [montantValide, setMontantValide] = useState(String(d.montantEstime));
  const [mode, setMode] = useState("virement");
  const [reference, setReference] = useState("");
  const peutDecider = d.approbationDirectionRequise ? droits.approuver : droits.valider;

  return (
    <li className="rounded-2xl border border-cream-200 bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-forest-900">
            <button type="button" onClick={() => setDetail((v) => !v)} className="rounded-full p-0.5 text-forest-700 hover:bg-forest-50" aria-label="Détail">
              {detail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {d.numero ?? "Brouillon"} · {d.objet}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_DEPENSE[d.statut] ?? BADGE_DEPENSE.brouillon}`}>
              {LIBELLE_STATUT_DEPENSE[d.statut] ?? d.statut}
            </span>
            {d.approbationDirectionRequise && d.statut === "soumise" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">Approbation direction</span>}
            {d.urgence !== "normale" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{d.urgence === "critique" ? "CRITIQUE" : "Urgente"}</span>}
          </p>
          <p className="mt-0.5 text-xs text-ink-700/60">
            {LIBELLE_TYPE_DEPENSE[d.type] ?? d.type} · {d.categorie} — {d.categorieLibelle} · {fcfa(d.montantValide ?? d.montantEstime)}
            {" · "}demandé par {d.demandeurNom}{d.decideParNom ? ` · décidé par ${d.decideParNom}` : ""}
            {d.datePaiement ? ` · payé le ${dateFr(d.datePaiement)} (${LIBELLE_MODE[d.mode ?? ""] ?? d.mode})` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(d.statut === "approuvee" || d.statut === "payee" || d.statut === "cloturee") && (
            <button type="button" onClick={onImprimer} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50"><Printer size={11} /> Ordre</button>
          )}
          {droits.creer && d.statut === "brouillon" && (
            <>
              <button type="button" onClick={onModifier} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50"><Pencil size={11} /> Modifier</button>
              <BoutonActionConfirmee libelle="Soumettre" icone={Send} ton="primaire" action={soumettreDepense} champs={{ etablissementId, id: d.id, version: String(d.version) }} onSucces={(m) => onMessage(m ?? "Soumise.")} />
            </>
          )}
          {peutDecider && d.statut === "soumise" && (
            <>
              <span className="inline-flex items-center gap-1">
                <Input value={montantValide} onChange={(e) => setMontantValide(e.target.value)} type="number" min={1} max={d.montantEstime} className="h-8 w-28 text-xs" title="Montant validé" />
                <BoutonActionConfirmee libelle="Approuver" icone={Check} ton="primaire" action={deciderDepense} champs={{ etablissementId, id: d.id, version: String(d.version), decision: "approuver", montantValide }} onSucces={(m) => onMessage(m ?? "Approuvée.")} />
              </span>
              <span className="inline-flex items-center gap-1">
                <Input value={motifRefus} onChange={(e) => setMotifRefus(e.target.value)} maxLength={300} placeholder="Motif refus…" className="h-8 w-32 text-xs" />
                <BoutonActionConfirmee libelle="Refuser" icone={Ban} ton="danger" action={deciderDepense} champs={{ etablissementId, id: d.id, version: String(d.version), decision: "refuser", motifRefus }} desactive={motifRefus.trim().length === 0} onSucces={(m) => { onMessage(m ?? "Refusée."); setMotifRefus(""); }} />
              </span>
            </>
          )}
          {droits.payer && d.statut === "approuvee" && (
            <span className="inline-flex flex-wrap items-center gap-1">
              <Select value={mode} onChange={(e) => setMode(e.target.value)} className="h-8 w-28 text-xs">
                {MODES_DEPENSE.map((m) => <option key={m} value={m}>{LIBELLE_MODE[m] ?? m}</option>)}
              </Select>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} placeholder="Réf." className="h-8 w-24 text-xs" />
              <BoutonActionConfirmee libelle="Décaisser" icone={Wallet} ton="primaire" action={payerDepense} champs={{ etablissementId, id: d.id, version: String(d.version), mode, reference }} onSucces={(m) => onMessage(m ?? "Décaissée.")} />
            </span>
          )}
          {droits.valider && d.statut === "payee" && (
            <BoutonActionConfirmee libelle="Clôturer" icone={Check} action={cloturerDepense} champs={{ etablissementId, id: d.id, version: String(d.version) }} onSucces={(m) => onMessage(m ?? "Clôturée.")} />
          )}
          {droits.creer && ["brouillon", "soumise", "refusee"].includes(d.statut) && (
            <BoutonActionConfirmee libelle="Retirer" icone={Ban} ton="danger" action={retirerDepense} champs={{ etablissementId, id: d.id, version: String(d.version) }} onSucces={(m) => onMessage(m ?? "Retirée.")} />
          )}
        </div>
      </div>
      {detail && (
        <div className="mt-3 grid gap-1.5 rounded-xl bg-cream-50/70 p-3 text-xs sm:grid-cols-2">
          {d.description && <p className="sm:col-span-2"><strong>Description :</strong> {d.description}</p>}
          {[
            d.centreCoutLibelle && `Centre : ${d.centreCoutLibelle}`,
            d.service && `Service : ${d.service}`,
            d.projet && `Projet : ${d.projet}`,
            d.beneficiaire && `Bénéficiaire : ${d.beneficiaire}`,
            d.pieceJustificative && `Pièce : ${d.pieceJustificative}`,
            d.motifRefus && `Motif du refus : ${d.motifRefus}`,
            `Estimé : ${fcfa(d.montantEstime)}`,
            d.montantValide !== null && `Validé : ${fcfa(d.montantValide)}`,
          ].filter(Boolean).map((t) => <p key={t as string}>{t}</p>)}
        </div>
      )}
    </li>
  );
}

// ─── Avances ───

function SectionAvances({ etablissementId, donnees, droits }: { etablissementId: string; donnees: DonneesDepensesVue; droits: DroitsDepensesUi }) {
  const [message, setMessage] = useState<string | null>(null);
  const [etat, action] = useActionState(enregistrerAvance, INITIAL);
  useApresSucces(etat, () => setMessage(etat.message ?? "Avance décaissée."));
  return (
    <div className="space-y-4">
      {droits.payer && (
        <Card>
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <HandCoins size={17} className="text-forest-600" /> Nouvelle avance sur frais
          </h3>
          <p className="mt-1 text-xs text-ink-700/60">L&apos;avance est décaissée immédiatement puis régularisée sur justificatifs (RM-1403).</p>
          <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <div>
              <Label htmlFor="av-benef">Bénéficiaire *</Label>
              <Input id="av-benef" name="beneficiaireNom" required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="av-motif">Motif</Label>
              <Select id="av-motif" name="motif" defaultValue="mission">
                {MOTIFS_AVANCE.map((m) => <option key={m.code} value={m.code}>{m.libelle}</option>)}
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="av-objet">Objet *</Label>
              <Input id="av-objet" name="objet" required maxLength={160} />
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="av-cat">Catégorie</Label>
              <Select id="av-cat" name="categorie" required defaultValue="">
                <option value="" disabled>Choisir…</option>
                {CATEGORIES_DEPENSE.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="av-montant">Montant (FCFA)</Label>
              <Input id="av-montant" name="montant" type="number" min={1} required />
            </div>
            <div>
              <Label htmlFor="av-mode">Mode</Label>
              <Select id="av-mode" name="mode" defaultValue="especes">
                {MODES_DEPENSE.map((m) => <option key={m} value={m}>{LIBELLE_MODE[m] ?? m}</option>)}
              </Select>
            </div>
            <div className="flex items-end">
              <SubmitButton>Décaisser l&apos;avance</SubmitButton>
            </div>
            {etat.message && <div className="sm:col-span-2 lg:col-span-4"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
          </form>
        </Card>
      )}
      <Card>
        <h3 className="font-display text-base font-bold text-forest-900">Avances ({donnees.avances.length})</h3>
        {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
        {donnees.avances.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Aucune avance.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {donnees.avances.map((a) => (
              <LigneAvance key={a.id} etablissementId={etablissementId} avance={a} droits={droits} onMessage={setMessage} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function LigneAvance({ etablissementId, avance: a, droits, onMessage }: { etablissementId: string; avance: AvanceVue; droits: DroitsDepensesUi; onMessage: (m: string | null) => void }) {
  const [justifie, setJustifie] = useState("");
  const [motif, setMotif] = useState("");
  return (
    <li className="rounded-xl border border-cream-200 bg-white px-3.5 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong className="text-forest-900">{a.numero}</strong> · {a.beneficiaireNom} — {a.objet} · {fcfa(a.montant)} · {a.categorie}
          <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${a.statut === "decaissee" ? "bg-amber-50 text-amber-700" : a.statut === "regularisee" ? "bg-forest-50 text-forest-800" : "bg-red-50 text-red-600"}`}>
            {a.statut === "decaissee" ? "À régulariser" : a.statut === "regularisee" ? "Régularisée" : "Annulée"}
          </span>
          {a.statut === "regularisee" && a.montantJustifie !== null && <span className="ml-1.5 text-xs text-ink-700/60">justifié {fcfa(a.montantJustifie)} · {a.soldeType}</span>}
        </span>
        {droits.valider && a.statut === "decaissee" && (
          <span className="inline-flex flex-wrap items-center gap-1">
            <Input value={justifie} onChange={(e) => setJustifie(e.target.value)} type="number" min={0} placeholder="Montant justifié" className="h-8 w-32 text-xs" />
            <BoutonActionConfirmee libelle="Régulariser" icone={Check} ton="primaire" action={regulariserAvance} champs={{ etablissementId, id: a.id, version: String(a.version), montantJustifie: justifie }} desactive={justifie === ""} onSucces={(m) => { onMessage(m ?? "Régularisée."); setJustifie(""); }} />
          </span>
        )}
        {droits.payer && a.statut === "decaissee" && (
          <span className="inline-flex items-center gap-1">
            <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif annul." className="h-8 w-28 text-xs" />
            <BoutonActionConfirmee libelle="Annuler" icone={Ban} ton="danger" action={annulerAvance} champs={{ etablissementId, id: a.id, version: String(a.version), motif }} desactive={motif.trim().length === 0} onSucces={(m) => { onMessage(m ?? "Annulée."); setMotif(""); }} />
          </span>
        )}
      </div>
    </li>
  );
}

// ─── Récurrentes ───

function SectionRecurrentes({ etablissementId, donnees, droits }: { etablissementId: string; donnees: DonneesDepensesVue; droits: DroitsDepensesUi }) {
  const [enEdition, setEnEdition] = useState<DepenseRecurrenteVue | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [etat, action] = useActionState(enregistrerRecurrente, INITIAL);
  useApresSucces(etat, () => { setEnEdition(null); setFormOuvert(false); });
  const dues = donnees.recurrentes.filter((r) => r.echeanceDue).length;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <Repeat size={17} className="text-forest-600" /> Dépenses récurrentes
        </h3>
        <div className="flex gap-2">
          {droits.creer && dues > 0 && (
            <BoutonActionConfirmee libelle={`Générer ${dues} échéance(s) due(s)`} icone={Calendar} ton="primaire" action={genererEcheancesRecurrentes} champs={{ etablissementId }} onSucces={(m) => setMessage(m ?? "Générées.")} />
          )}
          {droits.creer && (
            <button type="button" onClick={() => { setEnEdition(null); setFormOuvert((v) => !v); }} className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"><Plus size={13} /> Nouvelle</button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-700/60">La génération crée une dépense APPROUVÉE prête à payer et avance la prochaine échéance.</p>
      {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}

      {droits.creer && (formOuvert || enEdition) && (
        <form action={action} key={enEdition?.id ?? "nouveau"} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
          {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}
          <div className="lg:col-span-2">
            <Label htmlFor="re-libelle">Libellé *</Label>
            <Input id="re-libelle" name="libelle" required maxLength={120} defaultValue={enEdition?.libelle ?? ""} />
          </div>
          <div>
            <Label htmlFor="re-cat">Catégorie</Label>
            <Select id="re-cat" name="categorie" required defaultValue={enEdition?.categorie ?? ""}>
              <option value="" disabled>Choisir…</option>
              {CATEGORIES_DEPENSE.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="re-montant">Montant (FCFA)</Label>
            <Input id="re-montant" name="montant" type="number" min={1} required defaultValue={enEdition?.montant ?? ""} />
          </div>
          <div>
            <Label htmlFor="re-periode">Périodicité</Label>
            <Select id="re-periode" name="periodicite" defaultValue={enEdition?.periodicite ?? "mensuelle"}>
              {PERIODICITES.map((p) => <option key={p.code} value={p.code}>{p.libelle}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="re-echeance">Prochaine échéance</Label>
            <Input id="re-echeance" name="prochaineEcheance" type="date" defaultValue={enEdition?.prochaineEcheance?.slice(0, 10) ?? auj()} />
          </div>
          <div>
            <Label htmlFor="re-benef">Bénéficiaire</Label>
            <Input id="re-benef" name="beneficiaire" maxLength={120} defaultValue={enEdition?.beneficiaire ?? ""} />
          </div>
          <div>
            <Label htmlFor="re-actif">Actif</Label>
            <Select id="re-actif" name="actif" defaultValue={enEdition && !enEdition.actif ? "non" : "oui"}>
              <option value="oui">Oui</option>
              <option value="non">Non (suspendu)</option>
            </Select>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
            <SubmitButton>{enEdition ? "Mettre à jour" : "Planifier"}</SubmitButton>
            {enEdition && <button type="button" onClick={() => { setEnEdition(null); setFormOuvert(false); }} className="rounded-full border border-cream-300 px-4 py-2 text-xs font-semibold text-ink-700/70 hover:bg-cream-100">Abandonner</button>}
            {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
          </div>
        </form>
      )}

      {donnees.recurrentes.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700/60">Aucune dépense récurrente.</p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm">
          {donnees.recurrentes.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cream-200 bg-white px-3.5 py-2">
              <span>
                <strong className="text-forest-900">{r.libelle}</strong> · {fcfa(r.montant)} · {PERIODICITES.find((p) => p.code === r.periodicite)?.libelle}
                <span className="text-ink-700/55"> · prochaine {dateFr(r.prochaineEcheance)}</span>
                {r.echeanceDue && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">ÉCHÉANCE DUE</span>}
                {!r.actif && <span className="ml-1.5 rounded-full bg-cream-200 px-1.5 py-0.5 text-[10px] font-bold text-ink-700/60">suspendue</span>}
              </span>
              {droits.creer && (
                <span className="flex gap-1.5">
                  <button type="button" onClick={() => { setEnEdition(r); setFormOuvert(true); }} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50"><Pencil size={11} /> Modifier</button>
                  <BoutonActionConfirmee libelle="Retirer" icone={Ban} ton="danger" action={retirerRecurrente} champs={{ etablissementId, id: r.id, version: String(r.version) }} onSucces={(m) => setMessage(m ?? "Retirée.")} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Ordre de dépense imprimable A4 ───

function OrdreDepenseImprimable({ depense: d, entete, onFermer }: { depense: DepenseVue; entete: EnteteEtablissement; onFermer: () => void }) {
  const montant = d.montantValide ?? d.montantEstime;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`@media print { body * { visibility: hidden; } #ordre-depense-impression, #ordre-depense-impression * { visibility: visible; } #ordre-depense-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; } @page { size: A4 portrait; margin: 12mm; } }`}</style>
      <div id="ordre-depense-impression" className="mx-auto my-8 w-full max-w-2xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Ordre de dépense</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100" aria-label="Fermer"><X size={16} /></button>
        </div>
        <EnTeteOfficielDoc etab={entete} titre="ORDRE DE DÉPENSE" sousTitre={`${d.numero ?? ""} — ${LIBELLE_TYPE_DEPENSE[d.type] ?? d.type}`} />
        <div className="mt-4 space-y-1.5 text-sm">
          <p><strong>Objet :</strong> {d.objet}</p>
          {d.description && <p><strong>Description :</strong> {d.description}</p>}
          <p><strong>Imputation :</strong> {d.categorie} — {d.categorieLibelle}{d.centreCoutLibelle ? ` · ${d.centreCoutLibelle}` : ""}</p>
          {d.beneficiaire && <p><strong>Bénéficiaire :</strong> {d.beneficiaire}</p>}
          <p><strong>Montant :</strong> {fcfa(montant)}</p>
          <p><strong>Demandeur :</strong> {d.demandeurNom}{d.decideParNom ? ` · Approbateur : ${d.decideParNom}` : ""}</p>
          {d.datePaiement && <p><strong>Payé le :</strong> {dateFr(d.datePaiement)} par {d.payeParNom} ({LIBELLE_MODE[d.mode ?? ""] ?? d.mode}{d.reference ? ` · ${d.reference}` : ""})</p>}
        </div>
        <p className="mt-3 text-xs italic">Arrêté le présent ordre de dépense à la somme de {nombreEnLettres(montant)} francs CFA.</p>
        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-xs">
          <div><p className="font-semibold">Le Demandeur</p><p className="mt-12 border-t border-ink-700/30 pt-1 text-ink-700/50">Signature</p></div>
          <div><p className="font-semibold">Le Comptable / Caissier</p><p className="mt-12 border-t border-ink-700/30 pt-1 text-ink-700/50">Signature</p></div>
          <div><p className="font-semibold">L&apos;Ordonnateur</p><p className="mt-12 border-t border-ink-700/30 pt-1 text-ink-700/50">Signature et cachet</p></div>
        </div>
        <div className="mt-6 flex justify-center gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-forest-700"><Printer size={16} /> Imprimer / PDF</button>
          <button type="button" onClick={onFermer} className="rounded-full border border-cream-300 px-5 py-2.5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">Fermer</button>
        </div>
      </div>
    </div>
  );
}

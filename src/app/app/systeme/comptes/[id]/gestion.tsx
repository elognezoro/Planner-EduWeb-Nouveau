"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserCog, IdCard, ShieldCheck, KeyRound, Trash2, Copy, Check, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { Input, Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";
import { RechercheEtablissement } from "@/components/app/recherche-etablissement";
import { ROLES_ORDONNES, ROLES, type RoleId, type TypePortee } from "@/lib/rbac";
import {
  affecterRoleEtPerimetre, modifierCoordonnees, changerStatut, reinitialiserMotDePasse, supprimerCompte,
  type EtatForm,
} from "./actions";

const initial: EtatForm = { ok: false };

export interface Entite { id: string; nom: string }
export interface Listes { regions: Entite[]; cafops: Entite[]; apfcs: Entite[] }
export interface CompteVue {
  id: string;
  prenoms: string | null;
  nom: string | null;
  email: string;
  telephone: string | null;
  statut: string;
  roleTech: RoleId;
  etablissementId: string | null;
  regionId: string | null;
  cafopId: string | null;
  apfcId: string | null;
}

const libellePortee: Partial<Record<TypePortee, string>> = {
  etablissement: "Établissement",
  region: "Région",
  cafop: "CAFOP",
  apfc: "APFC",
};

function entitesPour(portee: TypePortee, listes: Listes): Entite[] {
  if (portee === "region") return listes.regions;
  if (portee === "cafop") return listes.cafops;
  if (portee === "apfc") return listes.apfcs;
  return [];
}

function scopeActuel(c: CompteVue, portee: TypePortee): string {
  if (portee === "etablissement") return c.etablissementId ?? "";
  if (portee === "region") return c.regionId ?? "";
  if (portee === "cafop") return c.cafopId ?? "";
  if (portee === "apfc") return c.apfcId ?? "";
  return "";
}

/** Titre de section réutilisable. */
function Section({ icone, titre, sousTitre, children }: { icone: React.ReactNode; titre: string; sousTitre?: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-forest-50 text-forest-600">{icone}</span>
        <div>
          <h2 className="font-display text-base font-bold text-forest-900">{titre}</h2>
          {sousTitre && <p className="text-xs text-ink-700/60">{sousTitre}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

// ── Rôle & affectation ──
function RoleAffectation({
  compte,
  listes,
  etabActuel,
  estSoi,
}: {
  compte: CompteVue;
  listes: Listes;
  etabActuel: Entite | null;
  estSoi: boolean;
}) {
  const [etat, action] = useActionState(affecterRoleEtPerimetre, initial);
  const [role, setRole] = useState<RoleId>(compte.roleTech);
  const portee = ROLES[role].portee;
  const entites = entitesPour(portee, listes);
  const besoinPerimetre = Boolean(libellePortee[portee]);
  const defautScope = role === compte.roleTech ? scopeActuel(compte, portee) : "";

  return (
    <Section icone={<UserCog size={18} />} titre="Rôle & affectation" sousTitre="Attribuez le rôle et rattachez l'utilisateur à sa structure (établissement, région, CAFOP, APFC).">
      {estSoi ? (
        <p className="text-sm text-ink-700/60">Vous ne pouvez pas modifier votre propre rôle depuis cette fiche.</p>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="utilisateurId" value={compte.id} />
          {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="role">Rôle</Label>
              <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as RoleId)}>
                {ROLES_ORDONNES.map((r) => (
                  <option key={r.id} value={r.id}>{r.libelle}</option>
                ))}
              </Select>
            </div>
            {besoinPerimetre && portee === "etablissement" && (
              <div>
                <Label>Affectation (Établissement)</Label>
                {/* Recherche dans le répertoire complet (41 000+) — un <select> est impraticable. */}
                <RechercheEtablissement
                  name="perimetreId"
                  requis
                  defaut={role === compte.roleTech ? etabActuel : null}
                />
              </div>
            )}
            {besoinPerimetre && portee !== "etablissement" && (
              <div>
                <Label htmlFor="perimetreId">Affectation ({libellePortee[portee]})</Label>
                <Select id="perimetreId" name="perimetreId" defaultValue={defautScope} required>
                  <option value="" disabled>Choisir…</option>
                  {entites.map((o) => (
                    <option key={o.id} value={o.id}>{o.nom}</option>
                  ))}
                </Select>
                {entites.length === 0 && (
                  <p className="mt-1 text-xs text-gold-700">Aucun(e) {libellePortee[portee]?.toLowerCase()} enregistré(e) — créez-en un(e) d&apos;abord.</p>
                )}
              </div>
            )}
          </div>
          {!besoinPerimetre && (
            <p className="text-xs text-ink-700/55">
              {portee === "global"
                ? "Ce rôle a une portée nationale (aucune structure de rattachement)."
                : "Ce rôle est personnel (parent / élève) — le périmètre découle de ses liens (enfants, inscription)."}
            </p>
          )}
          <SubmitButton className="w-auto px-6">Enregistrer le rôle &amp; l&apos;affectation</SubmitButton>
        </form>
      )}
    </Section>
  );
}

// ── Coordonnées ──
function Coordonnees({ compte }: { compte: CompteVue }) {
  const [etat, action] = useActionState(modifierCoordonnees, initial);
  return (
    <Section icone={<IdCard size={18} />} titre="Coordonnées" sousTitre="Identité et contact du compte.">
      <form action={action} className="space-y-3">
        <input type="hidden" name="utilisateurId" value={compte.id} />
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="prenoms">Prénoms</Label>
            <Input id="prenoms" name="prenoms" defaultValue={compte.prenoms ?? ""} />
          </div>
          <div>
            <Label htmlFor="nom">Nom</Label>
            <Input id="nom" name="nom" defaultValue={compte.nom ?? ""} />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" defaultValue={compte.email} required />
          </div>
          <div>
            <Label htmlFor="telephone">Téléphone</Label>
            <Input id="telephone" name="telephone" defaultValue={compte.telephone ?? ""} placeholder="+225…" />
          </div>
        </div>
        <SubmitButton className="w-auto px-6">Enregistrer les coordonnées</SubmitButton>
      </form>
    </Section>
  );
}

// ── Statut ──
function Statut({ compte, estSoi }: { compte: CompteVue; estSoi: boolean }) {
  const [etat, action] = useActionState(changerStatut, initial);
  const actif = compte.statut === "actif";
  return (
    <Section icone={<ShieldCheck size={18} />} titre="Statut du compte" sousTitre="Autoriser ou bloquer l'accès à la plateforme.">
      {etat.message && <div className="mb-3"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
      {estSoi ? (
        <p className="text-sm text-ink-700/60">Vous ne pouvez pas changer le statut de votre propre compte.</p>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="utilisateurId" value={compte.id} />
          <span className="text-sm text-ink-700/70">
            Statut actuel :{" "}
            <strong className={actif ? "text-forest-700" : "text-red-600"}>
              {actif ? "Actif" : compte.statut === "suspendu" ? "Suspendu" : "E-mail non confirmé"}
            </strong>
          </span>
          {!actif && (
            <button type="submit" name="statut" value="actif" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest-700 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-600">
              Activer le compte
            </button>
          )}
          {compte.statut !== "suspendu" && (
            <button type="submit" name="statut" value="suspendu" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-red-200 px-5 text-sm font-semibold text-red-600 hover:bg-red-50">
              Suspendre
            </button>
          )}
        </form>
      )}
    </Section>
  );
}

// ── Sécurité (réinitialisation) ──
function Securite({ compte, estSoi }: { compte: CompteVue; estSoi: boolean }) {
  const [etat, action] = useActionState(reinitialiserMotDePasse, initial);
  const [copie, setCopie] = useState(false);
  return (
    <Section icone={<KeyRound size={18} />} titre="Sécurité" sousTitre="Réinitialiser le mot de passe de l'utilisateur.">
      {estSoi ? (
        <p className="text-sm text-ink-700/60">Gérez votre propre mot de passe depuis « Mon Profil ».</p>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="utilisateurId" value={compte.id} />
          {etat.message && !etat.motDePasseTemp && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
          {etat.motDePasseTemp && (
            <div className="rounded-2xl border border-forest-200 bg-forest-50 p-3">
              <p className="text-xs font-medium text-forest-800">{etat.message}</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm text-forest-900">{etat.motDePasseTemp}</code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(etat.motDePasseTemp!); setCopie(true); }}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-forest-200 px-3 text-xs font-medium text-forest-700 hover:bg-white"
                >
                  {copie ? <Check size={13} /> : <Copy size={13} />} {copie ? "Copié" : "Copier"}
                </button>
              </div>
            </div>
          )}
          <SubmitButton className="w-auto px-6">Générer un mot de passe temporaire</SubmitButton>
        </form>
      )}
    </Section>
  );
}

// ── Zone dangereuse (suppression) ──
function Suppression({ compte, estSoi, estAdmin }: { compte: CompteVue; estSoi: boolean; estAdmin: boolean }) {
  const [etat, action] = useActionState(supprimerCompte, initial);
  const [confirme, setConfirme] = useState(false);
  const router = useRouter();
  useEffect(() => { if (etat.ok) router.push("/app/systeme/comptes"); }, [etat.ok, router]);

  const bloque = estSoi || estAdmin;
  return (
    <Card className="border-red-200">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600"><Trash2 size={18} /></span>
        <div>
          <h2 className="font-display text-base font-bold text-red-700">Supprimer le compte</h2>
          <p className="text-xs text-ink-700/60">Action définitive : le compte et ses données liées sont retirés.</p>
        </div>
      </div>
      {etat.message && !etat.ok && <div className="mb-3"><FormAlert ton="erreur">{etat.message}</FormAlert></div>}
      {bloque ? (
        <p className="text-sm text-ink-700/60">
          {estSoi ? "Vous ne pouvez pas supprimer votre propre compte." : "Un compte administrateur ne peut pas être supprimé ici."}
        </p>
      ) : !confirme ? (
        <button type="button" onClick={() => setConfirme(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-red-300 px-5 text-sm font-semibold text-red-600 hover:bg-red-50">
          <Trash2 size={15} /> Supprimer ce compte
        </button>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="utilisateurId" value={compte.id} />
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700">
            <AlertTriangle size={15} /> Confirmer la suppression définitive ?
          </span>
          <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700">
            Oui, supprimer
          </button>
          <button type="button" onClick={() => setConfirme(false)} className="inline-flex h-10 items-center rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-50">
            Annuler
          </button>
        </form>
      )}
    </Card>
  );
}

export function GestionCompte({
  compte,
  listes,
  etabActuel,
  estSoi,
}: {
  compte: CompteVue;
  listes: Listes;
  etabActuel: Entite | null;
  estSoi: boolean;
}) {
  const estAdmin = compte.roleTech === "admin";
  return (
    <div className="space-y-5">
      <RoleAffectation compte={compte} listes={listes} etabActuel={etabActuel} estSoi={estSoi} />
      <Coordonnees compte={compte} />
      <Statut compte={compte} estSoi={estSoi} />
      <Securite compte={compte} estSoi={estSoi} />
      <Suppression compte={compte} estSoi={estSoi} estAdmin={estAdmin} />
    </div>
  );
}

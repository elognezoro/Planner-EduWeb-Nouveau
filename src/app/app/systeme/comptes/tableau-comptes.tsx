"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, ArrowUpDown, Archive, Ban, BadgeCheck, Check, Copy, Eye, KeyRound, Loader2,
  MessageSquare, MoreHorizontal, Pencil, ScanEye, ShieldCheck, Trash2, X,
} from "lucide-react";
import { Badge } from "@/components/app/ui";
import { SelecteurPays } from "@/components/app/selecteur-pays";
import { ROLES, ROLES_ORDONNES, type RoleId } from "@/lib/rbac";
import { appliquerTerme } from "@/lib/cafop-terme";
import { drapeauUrl, trouverPays } from "@/lib/referentiels/pays";
import { voirCommeUtilisateur } from "@/app/app/systeme/apercu/actions";
import { changerRole } from "@/app/app/systeme/habilitations/actions";
import {
  affecterRoleEtPerimetre,
  modifierCoordonnees,
  changerStatut,
  reinitialiserMotDePasse,
  supprimerCompte,
} from "./[id]/actions";
import {
  contexteEtablissementsPaysAction,
  listerEtablissementsAction,
  rechercherEtablissementsPaysAction,
  listerCafopsPaysAction,
  listerApfcsPaysAction,
} from "./recherche-action";
import { SelecteurEtabCascade, type EtabCascade } from "./selecteur-etab-cascade";
import { ReglageEssai } from "@/components/app/reglage-essai";
import { SelectRecherche } from "@/components/app/select-recherche";
import { diocesesDuPays } from "@/lib/referentiels/dioceses";

export interface LigneCompte {
  id: string;
  prenoms: string;
  nom: string;
  nomAffiche: string;
  email: string;
  roleTech: string;
  roleLibelle: string;
  etablissement: string | null;
  region: string | null;
  pays: string | null;
  statut: string;
  creeLe: string; // ISO
  essaiFinLe: string | null; // fin de période d'essai (ISO) ou null — pré-remplit l'habilitation
  /** Demande de rôle EN ATTENTE (choix du demandeur) — synchronise Approbations ↔ Comptes :
   *  affichée sur la ligne/l'aperçu et PRÉ-REMPLIT la modale d'habilitation. */
  demandeRole: {
    roleTech: string;
    roleLibelle: string;
    structure: string | null;
    etab: { id: string; nom: string } | null;
    regionId: string | null;
    cafopId: string | null;
    apfcId: string | null;
  } | null;
  /** Affectation ACTUELLE du compte — pré-remplit la modale d'habilitation à défaut de
   *  demande en attente (ex : demande déjà approuvée → l'établissement choisi reste affiché). */
  affectation: {
    etab: { id: string; nom: string } | null;
    /** Rattachements SECONDAIRES à d'autres établissements (groupes scolaires) — même accès
     *  que l'établissement principal ; pré-remplissent la liste de la modale d'habilitation. */
    etabsSecondaires: { id: string; nom: string }[];
    regionId: string | null;
    cafopId: string | null;
    apfcId: string | null;
    diocese: string | null;
  };
}

type Colonne = "nomAffiche" | "roleLibelle" | "etablissement" | "pays" | "creeLe" | "statut";
type TypeModale = "habilitation" | "apercu" | "edition";

const LIBELLE_STATUT: Record<string, string> = {
  actif: "Actif",
  suspendu: "Suspendu",
  archive: "Archivé",
  en_attente_verification: "E-mail non confirmé",
};
const TON_STATUT: Record<string, "succes" | "refus" | "attente"> = {
  actif: "succes",
  suspendu: "refus",
  archive: "refus",
  en_attente_verification: "attente",
};

// Groupes de rôles de la modale d'habilitation.
const ROLES_ADMINS_SPECIALISES: RoleId[] = ["etablissements_admin", "cafop_admin", "apfc_admin"];

function dateUtc(iso: string): { jour: string; heure: string } {
  const d = new Date(iso);
  const deux = (n: number) => String(n).padStart(2, "0");
  return {
    jour: `${deux(d.getUTCDate())}/${deux(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    heure: `${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())} UTC`,
  };
}

function DrapeauPays({ pays }: { pays: string | null }) {
  const info = trouverPays(pays);
  if (!pays) return <span className="text-xs text-ink-700/40">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      {info && (
        <Image
          src={drapeauUrl(info.code)}
          alt=""
          width={22}
          height={16}
          unoptimized
          className="h-4 w-[22px] shrink-0 rounded-[3px] object-cover ring-1 ring-cream-300"
        />
      )}
      <span className="text-sm text-forest-900">{pays}</span>
    </span>
  );
}

function EnTete({
  colonne,
  tri,
  onTri,
  className = "",
  children,
}: {
  colonne: Colonne;
  tri: { colonne: Colonne; asc: boolean };
  onTri: (colonne: Colonne) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <th className={`px-3 py-3 font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => onTri(colonne)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-forest-800 ${tri.colonne === colonne ? "text-forest-800" : ""}`}
      >
        {children} <ArrowUpDown size={11} className="shrink-0 opacity-60" />
      </button>
    </th>
  );
}

export function TableauComptes({
  lignes,
  monId,
  peutIncarner,
  peutEssai = false,
  terme = "CAFOP",
}: {
  lignes: LigneCompte[];
  monId: string;
  peutIncarner: boolean;
  /** Admin système : peut fixer une période d'essai à l'affectation à un établissement. */
  peutEssai?: boolean;
  terme?: string;
}) {
  const router = useRouter();
  const [tri, setTri] = useState<{ colonne: Colonne; asc: boolean }>({ colonne: "creeLe", asc: false });
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [modale, setModale] = useState<{ type: TypeModale; ligne: LigneCompte } | null>(null);
  const [menuPlus, setMenuPlus] = useState<string | null>(null);
  const [confirmeSuppr, setConfirmeSuppr] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [pending, start] = useTransition();

  const triees = useMemo(() => {
    const copie = [...lignes];
    const { colonne, asc } = tri;
    copie.sort((a, b) => {
      const va = (a[colonne] ?? "").toString();
      const vb = (b[colonne] ?? "").toString();
      return asc ? va.localeCompare(vb, "fr") : vb.localeCompare(va, "fr");
    });
    return copie;
  }, [lignes, tri]);

  function basculerTri(colonne: Colonne) {
    setTri((t) => ({ colonne, asc: t.colonne === colonne ? !t.asc : true }));
  }

  function basculerSelection(id: string) {
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function terminer(ok: boolean, texte: string) {
    setMessage({ ok, texte });
    setModale(null);
    setMenuPlus(null);
    setConfirmeSuppr(null);
    if (ok) router.refresh();
  }

  function statutRapide(ligne: LigneCompte, statut: "actif" | "suspendu" | "archive") {
    start(async () => {
      const fd = new FormData();
      fd.set("utilisateurId", ligne.id);
      fd.set("statut", statut);
      const res = await changerStatut({ ok: false }, fd);
      terminer(res.ok, res.message ?? "");
    });
  }

  function supprimer(ligne: LigneCompte) {
    start(async () => {
      const fd = new FormData();
      fd.set("utilisateurId", ligne.id);
      const res = await supprimerCompte({ ok: false }, fd);
      terminer(res.ok, res.message ?? "");
    });
  }

  return (
    <>
      {message && (
        <div className={`border-b border-cream-100 px-5 py-2 text-xs font-medium ${message.ok ? "text-forest-700" : "text-red-600"}`}>
          {message.texte}
        </div>
      )}
      {selection.size > 0 && (
        <div className="border-b border-cream-100 bg-cream-50/60 px-5 py-2 text-xs text-ink-700/65">
          <span className="font-semibold">{selection.size} sélectionné(s)</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-200 bg-cream-50/60 text-left text-xs text-ink-700/55">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selection.size === lignes.length && lignes.length > 0}
                  onChange={(e) => setSelection(e.target.checked ? new Set(lignes.map((l) => l.id)) : new Set())}
                  aria-label="Tout sélectionner"
                />
              </th>
              <EnTete colonne="nomAffiche" tri={tri} onTri={basculerTri} className="pl-1">Utilisateur</EnTete>
              <EnTete colonne="roleLibelle" tri={tri} onTri={basculerTri}>Rôle</EnTete>
              <EnTete colonne="etablissement" tri={tri} onTri={basculerTri}>Établissement</EnTete>
              <EnTete colonne="pays" tri={tri} onTri={basculerTri}>Pays</EnTete>
              <EnTete colonne="creeLe" tri={tri} onTri={basculerTri}>Inscrit le (UTC)</EnTete>
              <EnTete colonne="statut" tri={tri} onTri={basculerTri}>Statut</EnTete>
              <th className="px-3 py-3 text-right font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {triees.map((c) => {
              const estSoi = c.id === monId;
              const estAdmin = c.roleTech === "admin";
              const { jour, heure } = dateUtc(c.creeLe);
              return (
                <tr key={c.id} className="border-b border-cream-100 transition-colors last:border-0 hover:bg-cream-50/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selection.has(c.id)}
                      onChange={() => basculerSelection(c.id)}
                      aria-label={`Sélectionner ${c.nomAffiche}`}
                    />
                  </td>
                  <td className="py-3 pl-1 pr-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-800 text-xs font-bold text-gold-300">
                        {(c.nomAffiche !== "—" ? c.nomAffiche : c.email).slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-forest-900">{c.nomAffiche}</p>
                        <p className="truncate text-xs text-ink-700/55">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge ton={estAdmin ? "refus" : "neutre"}>{c.roleLibelle}</Badge>
                    {c.demandeRole && (
                      <span
                        className="mt-1 block w-fit rounded-full bg-gold-100 px-2 py-0.5 text-[0.65rem] font-semibold text-gold-800"
                        title={`Demande en attente : ${c.demandeRole.roleLibelle}${c.demandeRole.etab ? ` — ${c.demandeRole.etab.nom}` : c.demandeRole.structure ? ` — ${c.demandeRole.structure}` : ""}`}
                      >
                        Demande : {c.demandeRole.roleLibelle}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[13rem] truncate px-3 py-3 text-sm text-forest-900">
                    {c.etablissement ?? <span className="text-xs text-ink-700/40">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <DrapeauPays pays={c.pays} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-700/60">
                    {jour} · {heure}
                  </td>
                  <td className="px-3 py-3">
                    <Badge ton={TON_STATUT[c.statut] ?? "attente"}>
                      {c.statut === "actif" && <BadgeCheck size={12} className="mr-1 inline" />}
                      {LIBELLE_STATUT[c.statut] ?? c.statut}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {confirmeSuppr === c.id ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
                          Supprimer définitivement ?
                          <button onClick={() => supprimer(c)} disabled={pending} title="Confirmer" className="rounded-full bg-red-600 p-1.5 text-white hover:bg-red-500 disabled:opacity-60">
                            {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </button>
                          <button onClick={() => setConfirmeSuppr(null)} title="Annuler" className="rounded-full border border-cream-300 p-1.5 text-ink-700/60 hover:bg-cream-100">
                            <X size={12} />
                          </button>
                        </span>
                      ) : (
                        <>
                          {/* Bouclier : habilitation (rôle, pays, rattachement) */}
                          {!estSoi && (
                            <button
                              onClick={() => setModale({ type: "habilitation", ligne: c })}
                              title="Habilitation (rôle, pays, rattachement)"
                              className="rounded-full p-1.5 text-forest-600 transition-colors hover:bg-forest-50"
                            >
                              <ShieldCheck size={16} />
                            </button>
                          )}
                          {/* Œil : aperçu du profil */}
                          <button
                            onClick={() => setModale({ type: "apercu", ligne: c })}
                            title="Aperçu du profil"
                            className="rounded-full p-1.5 text-ink-700/55 transition-colors hover:bg-cream-100"
                          >
                            <Eye size={16} />
                          </button>
                          {/* Bulle : envoyer un message direct (copie e-mail) */}
                          {!estSoi && (
                            <Link
                              href={`/app/vie-scolaire/communication?avec=${c.id}`}
                              title="Envoyer un message"
                              className="rounded-full p-1.5 text-forest-600 transition-colors hover:bg-forest-50"
                            >
                              <MessageSquare size={16} />
                            </Link>
                          )}
                          {/* Scan : se connecter en tant que l'utilisateur */}
                          {peutIncarner && !estAdmin && !estSoi && (
                            <form action={voirCommeUtilisateur} className="inline-flex">
                              <input type="hidden" name="utilisateurId" value={c.id} />
                              <button type="submit" title="Se connecter en tant que cet utilisateur" className="rounded-full p-1.5 text-indigo-600 transition-colors hover:bg-indigo-50">
                                <ScanEye size={16} />
                              </button>
                            </form>
                          )}
                          {/* Stylo : modifier l'utilisateur */}
                          <button
                            onClick={() => setModale({ type: "edition", ligne: c })}
                            title="Modifier l'utilisateur"
                            className="rounded-full p-1.5 text-ink-700/55 transition-colors hover:bg-cream-100"
                          >
                            <Pencil size={16} />
                          </button>
                          {/* Corbeille : suppression (confirmation) */}
                          {!estSoi && !estAdmin && (
                            <button
                              onClick={() => setConfirmeSuppr(c.id)}
                              title="Supprimer le compte"
                              className="rounded-full p-1.5 text-red-500 transition-colors hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          {/* ⋯ : suspendre / archiver / activer */}
                          {!estSoi && !estAdmin && (
                            <div className="relative">
                              <button
                                onClick={() => setMenuPlus((m) => (m === c.id ? null : c.id))}
                                title="Autres actions"
                                className="rounded-full p-1.5 text-ink-700/55 transition-colors hover:bg-cream-100"
                              >
                                <MoreHorizontal size={16} />
                              </button>
                              <AnimatePresence>
                                {menuPlus === c.id && (
                                  <>
                                    <div className="fixed inset-0 z-30" onClick={() => setMenuPlus(null)} aria-hidden />
                                    <motion.div
                                      initial={{ opacity: 0, y: -6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -6 }}
                                      transition={{ duration: 0.12 }}
                                      className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-2xl border border-cream-200 bg-white p-1.5 shadow-soft"
                                    >
                                      {c.statut !== "actif" && (
                                        <button onClick={() => statutRapide(c, "actif")} disabled={pending} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-forest-800 hover:bg-forest-50">
                                          <BadgeCheck size={14} /> Activer
                                        </button>
                                      )}
                                      {c.statut !== "suspendu" && (
                                        <button onClick={() => statutRapide(c, "suspendu")} disabled={pending} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-forest-800 hover:bg-cream-100">
                                          <Ban size={14} /> Suspendre
                                        </button>
                                      )}
                                      {c.statut !== "archive" && (
                                        <button onClick={() => statutRapide(c, "archive")} disabled={pending} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-forest-800 hover:bg-cream-100">
                                          <Archive size={14} /> Archiver
                                        </button>
                                      )}
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {modale?.type === "habilitation" && (
          <ModaleHabilitation ligne={modale.ligne} onClose={() => setModale(null)} onDone={terminer} terme={terme} peutEssai={peutEssai} />
        )}
        {modale?.type === "apercu" && (
          <ModaleApercu
            ligne={modale.ligne}
            onClose={() => setModale(null)}
            onModifier={() => setModale({ type: "edition", ligne: modale.ligne })}
          />
        )}
        {modale?.type === "edition" && (
          <ModaleEdition ligne={modale.ligne} estSoi={modale.ligne.id === monId} onClose={() => setModale(null)} onDone={terminer} terme={terme} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Coque de modale (voile + panneau centré)
// ─────────────────────────────────────────────────────────────
function CoqueModale({ children, onClose, largeur = "w-[min(34rem,calc(100vw-2rem))]" }: { children: React.ReactNode; onClose: () => void; largeur?: string }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-forest-950/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className={`fixed left-1/2 top-1/2 z-50 max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-cream-200 bg-white p-6 shadow-soft ${largeur}`}
      >
        {children}
      </motion.div>
    </>
  );
}

function TeteUtilisateur({ ligne, onClose }: { ligne: LigneCompte; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-800">
          {(ligne.nomAffiche !== "—" ? ligne.nomAffiche : ligne.email).slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-forest-900">{ligne.nomAffiche}</p>
          <p className="truncate text-xs text-ink-700/60">{ligne.email}</p>
        </div>
      </div>
      <button onClick={onClose} aria-label="Fermer" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100">
        <X size={18} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Modale HABILITATION (bouclier) : rôle, pays, rattachement
// ─────────────────────────────────────────────────────────────
function ModaleHabilitation({
  ligne,
  onClose,
  onDone,
  terme,
  peutEssai,
}: {
  ligne: LigneCompte;
  onClose: () => void;
  onDone: (ok: boolean, texte: string) => void;
  terme: string;
  peutEssai: boolean;
}) {
  // SYNCHRONISATION avec « Approbations » : les CHOIX DU DEMANDEUR (rôle demandé, structure
  // déclarée à l'inscription) pré-remplissent la modale ; à défaut de demande EN ATTENTE
  // (ex : demande déjà approuvée), c'est l'affectation ACTUELLE du compte qui pré-remplit —
  // l'admin reste libre de tout modifier.
  const demande = ligne.demandeRole;
  const aff = ligne.affectation;
  const roleDemande = demande && demande.roleTech in ROLES ? (demande.roleTech as RoleId) : null;
  const porteeDemande = roleDemande ? ROLES[roleDemande].portee : null;
  const roleInitial = roleDemande ?? ((ligne.roleTech in ROLES ? ligne.roleTech : "eleve") as RoleId);
  const [role, setRole] = useState<RoleId>(roleInitial);
  const [pays, setPays] = useState(ligne.pays ?? "Côte d'Ivoire");
  // Répertoire du pays : total + directions régionales (DRENA / DRENAET) avec effectifs.
  const [contexte, setContexte] = useState<{ total: number; regions: { id: string; nom: string; nb: number }[] } | null>(null);
  const [regionId, setRegionId] = useState(
    (porteeDemande === "region" ? demande?.regionId : null) ?? aff.regionId ?? "",
  );
  // Liste locale (direction choisie, ou pays sans découpage régional) ; null = recherche serveur.
  const [listeEtabs, setListeEtabs] = useState<EtabCascade[] | null>(null);
  const [chargeListe, setChargeListe] = useState(false);
  // Établissements de rattachement (MULTI-établissements — groupes scolaires) : le PREMIER de la
  // liste est le rattachement PRINCIPAL, les suivants sont les secondaires (même accès).
  // Pré-remplissage : établissement demandé (Approbations) ou affectation actuelle + secondaires.
  const [etabsSel, setEtabsSel] = useState<{ id: string; nom: string }[]>(() => {
    const principal = (porteeDemande === "etablissement" ? demande?.etab : null) ?? aff.etab ?? null;
    const liste = principal ? [principal] : [];
    for (const e of aff.etabsSecondaires) if (!liste.some((x) => x.id === e.id)) liste.push(e);
    return liste;
  });
  // Rattachement CAFOP / APFC (rôles à périmètre « cafop » / « apfc ») : liste du pays + sélection.
  const [structListe, setStructListe] = useState<{ id: string; nom: string }[]>([]);
  const [structSel, setStructSel] = useState(
    (porteeDemande === "cafop" ? demande?.cafopId : porteeDemande === "apfc" ? demande?.apfcId : null) ??
      aff.cafopId ?? aff.apfcId ?? "",
  );
  const [structCharge, setStructCharge] = useState(false);
  // Diocèse (rôle SEDEC) — liste selon le pays choisi ; pré-rempli avec le diocèse actuel.
  const [diocese, setDiocese] = useState(aff.diocese ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [essaiVals, setEssaiVals] = useState<{ mode: "essai" | "libre"; finDate: string }>({ mode: "libre", finDate: "" });
  const [pending, start] = useTransition();

  // Changement de pays : on repart de zéro (directions régionales + sélection). L'état précédent
  // est initialisé à la valeur courante de « pays » : au tout PREMIER rendu, rien n'est donc
  // écrasé (les pré-sélections issues de la demande sont conservées) ; l'effet ne garde que le
  // chargement asynchrone du contexte (total + directions régionales).
  const [paysPrecedent, setPaysPrecedent] = useState(pays);
  if (paysPrecedent !== pays) {
    setPaysPrecedent(pays);
    setContexte(null);
    setRegionId("");
    setEtabsSel([]); // les établissements sélectionnés n'appartiennent plus forcément au pays choisi
    setDiocese(""); // le diocèse dépend du pays
  }
  useEffect(() => {
    let actif = true;
    contexteEtablissementsPaysAction(pays).then((c) => {
      if (actif) setContexte(c);
    });
    return () => {
      actif = false;
    };
  }, [pays]);

  // Liste des établissements : ceux de la direction régionale choisie ; à défaut, la liste
  // complète si le pays n'a pas de découpage régional. Au-delà de 500 entrées, pas de liste
  // intégrale (troncature silencieuse) : on reste en recherche serveur, restreinte à la portée.
  const nbPortee = contexte
    ? regionId
      ? contexte.regions.find((r) => r.id === regionId)?.nb ?? 0
      : contexte.total
    : 0;
  const listeIntegralePossible = contexte ? (regionId !== "" || contexte.regions.length === 0) && nbPortee <= 500 : false;
  // Clé récapitulant la portée de recherche courante : dès qu'elle change, on repart de zéro
  // (recherche serveur en attendant un éventuel chargement local) ; l'effet ne garde que le fetch.
  const cleListeEtabs = `${contexte ? "1" : "0"}|${regionId}|${pays}|${nbPortee}`;
  const [cleListeEtabsPrecedente, setCleListeEtabsPrecedente] = useState(cleListeEtabs);
  if (cleListeEtabsPrecedente !== cleListeEtabs) {
    setCleListeEtabsPrecedente(cleListeEtabs);
    setListeEtabs(null);
    setChargeListe(listeIntegralePossible);
  }
  useEffect(() => {
    if (!listeIntegralePossible) return;
    let actif = true;
    listerEtablissementsAction(pays, regionId || undefined).then((l) => {
      if (actif) {
        setListeEtabs(l);
        setChargeListe(false);
      }
    });
    return () => {
      actif = false;
    };
  }, [listeIntegralePossible, pays, regionId]);

  const portee = ROLES[role].portee;

  // Liste des CAFOP / APFC du pays, pour les rôles à périmètre « cafop » / « apfc ». Chargement
  // et liste se synchronisent dès le premier rendu (état précédent initialisé à `null`, donc
  // toujours différent de la clé courante) ; la SÉLECTION, elle, n'est réinitialisée qu'à partir
  // du second rendu (état précédent initialisé à la clé courante) pour préserver la pré-sélection
  // issue de la demande (CAFOP/APFC déclaré). L'effet ne garde que le fetch asynchrone.
  const cleStruct = `${portee}|${pays}`;
  const [cleStructChargePrecedente, setCleStructChargePrecedente] = useState<string | null>(null);
  if (cleStructChargePrecedente !== cleStruct) {
    setCleStructChargePrecedente(cleStruct);
    if (portee !== "cafop" && portee !== "apfc") {
      setStructListe([]);
    } else {
      setStructCharge(true);
    }
  }
  const [cleStructSelPrecedente, setCleStructSelPrecedente] = useState(cleStruct);
  if (cleStructSelPrecedente !== cleStruct) {
    setCleStructSelPrecedente(cleStruct);
    setStructSel("");
  }
  useEffect(() => {
    if (portee !== "cafop" && portee !== "apfc") return;
    let actif = true;
    const charger = portee === "cafop" ? listerCafopsPaysAction(pays) : listerApfcsPaysAction(pays);
    charger.then((l) => {
      if (actif) {
        setStructListe(l);
        setStructCharge(false);
      }
    });
    return () => {
      actif = false;
    };
  }, [portee, pays]);

  const BoutonRole = ({ r }: { r: RoleId }) => (
    <button
      type="button"
      onClick={() => setRole(r)}
      className={`rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors ${
        role === r
          ? "border-forest-500 bg-forest-50 text-forest-900"
          : "border-cream-300 bg-white text-ink-700/75 hover:border-forest-300"
      }`}
    >
      {appliquerTerme(ROLES[r].libelle, terme)}
    </button>
  );

  function enregistrer() {
    start(async () => {
      const fd = new FormData();
      fd.set("utilisateurId", ligne.id);
      fd.set("role", role);
      // Les rôles GLOBAUX ne sont rattachés à aucun pays : on n'impose pas de pays.
      if (portee !== "global") fd.set("pays", pays);
      // Rôle SEDEC : diocèse de rattachement (dans le pays choisi).
      if (portee === "diocese" && diocese) fd.set("diocese", diocese);
      // Périmètre selon le type de rôle : établissement / région / CAFOP / APFC ; aucun pour les rôles nationaux/globaux.
      const perimetreId =
        portee === "etablissement" ? etabsSel[0]?.id
        : portee === "region" ? regionId || undefined
        : portee === "cafop" || portee === "apfc" ? structSel || undefined
        : undefined;
      if (perimetreId) fd.set("perimetreId", perimetreId);
      // Multi-établissements (groupes scolaires) : le premier est le PRINCIPAL (perimetreId),
      // les suivants sont envoyés comme rattachements SECONDAIRES (même accès).
      if (portee === "etablissement") {
        for (const e of etabsSel.slice(1)) fd.append("perimetresSecondaires", e.id);
      }
      // Accès (admin système + rôle établissement) : « Période d'essai » ou « Accès libre ».
      if (peutEssai && portee === "etablissement") {
        fd.set("essaiMode", essaiVals.mode);
        if (essaiVals.mode === "essai" && essaiVals.finDate) fd.set("essaiFinDate", essaiVals.finDate);
      }
      const res = await affecterRoleEtPerimetre({ ok: false }, fd);
      if (res.ok) onDone(true, res.message ?? "Habilitation mise à jour.");
      else setErreur(res.message ?? "Erreur technique.");
    });
  }

  // Rattachement OBLIGATOIRE selon la portée du rôle choisi : tant qu'il manque, on désactive
  // « Modifier » et on affiche une indication (évite un enregistrement qui échoue en silence).
  const perimetreManquant =
    portee === "etablissement" ? etabsSel.length === 0
    : portee === "region" ? !regionId
    : portee === "cafop" || portee === "apfc" ? !structSel
    : portee === "diocese" ? !diocese.trim()
    : portee === "pays" ? !pays.trim()
    : false;
  const hintPerimetre =
    portee === "etablissement" ? "Sélectionnez au moins un établissement de rattachement pour activer l'enregistrement."
    : portee === "region" ? "Choisissez la direction régionale de rattachement."
    : portee === "cafop" ? `Choisissez le ${appliquerTerme("CAFOP", terme)} de rattachement.`
    : portee === "apfc" ? "Choisissez l'APFC de rattachement."
    : portee === "diocese" ? "Choisissez le diocèse de rattachement."
    : "";

  return (
    <CoqueModale onClose={onClose} largeur="w-[min(36rem,calc(100vw-2rem))]">
      <TeteUtilisateur ligne={ligne} onClose={onClose} />
      <p className="mt-3 text-sm text-ink-700/70">
        Rôle actuel : <Badge ton="neutre">{ligne.roleLibelle}</Badge>
      </p>

      {/* Choix du demandeur (Approbations) : pré-remplis ci-dessous, modifiables par l'admin. */}
      {demande && (
        <div className="mt-3 rounded-xl border border-gold-300 bg-gold-50 px-3.5 py-2.5 text-xs leading-relaxed text-gold-800">
          <b>Demande en attente d&apos;approbation :</b> rôle « {demande.roleLibelle} »
          {demande.etab ? (
            <> · établissement déclaré : <b>{demande.etab.nom}</b></>
          ) : demande.structure ? (
            <> · structure déclarée : « {demande.structure} »</>
          ) : null}
          . Ces choix sont <b>pré-remplis</b> ci-dessous ; l&apos;enregistrement <b>soldera automatiquement la demande</b> dans « Approbations ».
        </div>
      )}

      {erreur && <p className="mt-3 text-sm font-medium text-red-600">{erreur}</p>}

      <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60">Nouveau rôle</p>
      <p className="mt-2 text-xs font-semibold text-gold-700">Rôles Administrateurs Spécialisés</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ROLES_ADMINS_SPECIALISES.map((r) => (
          <BoutonRole key={r} r={r} />
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-ink-700/60">Rôles Standards</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {ROLES_ORDONNES.filter((r) => !ROLES_ADMINS_SPECIALISES.includes(r.id)).map((r) => (
          <BoutonRole key={r.id} r={r.id} />
        ))}
      </div>

      {/* Pays : sans objet pour les rôles GLOBAUX (Admin Système, Superviseur International),
          qui couvrent tous les pays — on ne les rattache donc ni à un pays ni à une structure. */}
      {portee !== "global" && (
        <>
          <p className="mt-5 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60">Pays</p>
          <div className="mt-1.5">
            <SelecteurPays name="pays" valeur={pays} onSelect={(p) => setPays(p.nom)} />
          </div>
        </>
      )}

      {/* Rattachement — n'apparaît que selon le périmètre du rôle choisi. */}
      {(portee === "etablissement" || portee === "region") && contexte && contexte.regions.length > 0 && (
        <>
          <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60">
            Direction régionale{pays === "Côte d'Ivoire" ? " (DRENAET)" : ""}
          </p>
          <div className="mt-1.5">
            {/* Recherche rapide à la frappe ; sélection vide = toutes les directions régionales. */}
            <SelectRecherche
              key={`region|${pays}`}
              name="regionRecherche"
              grand
              effacable
              options={contexte.regions.map((r) => ({ id: r.id, nom: `${r.nom} (${r.nb.toLocaleString("fr-FR")})` }))}
              defaut={(() => {
                const r = contexte.regions.find((x) => x.id === regionId);
                return r ? { id: r.id, nom: `${r.nom} (${r.nb.toLocaleString("fr-FR")})` } : null;
              })()}
              placeholder={
                portee === "region"
                  ? "Rechercher / choisir une direction régionale…"
                  : "Toutes les directions régionales — tapez pour rechercher"
              }
              onSelect={(o) => setRegionId(o?.id ?? "")}
            />
          </div>
          {portee === "region" && (
            <p className="mt-1.5 text-xs text-ink-700/60">Le périmètre de ce rôle est la direction régionale choisie.</p>
          )}
        </>
      )}

      {portee === "etablissement" && (
        <>
          <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60">
            Rattacher à un ou plusieurs établissements <span className="text-gold-700">(obligatoire)</span>
          </p>
          <div className="mt-1.5">
            {/* Le sélecteur sert à AJOUTER à la liste : chaque choix s'ajoute (sans doublon) et
                le champ se vide (selection={null}) pour permettre l'ajout suivant. */}
            <SelecteurEtabCascade
              etabs={listeEtabs}
              chargement={chargeListe || contexte === null}
              rechercheServeur={(q) => rechercherEtablissementsPaysAction(pays, q, regionId || undefined)}
              indication={
                contexte
                  ? regionId
                    ? `${nbPortee.toLocaleString("fr-FR")} établissements dans cette direction régionale : tapez au moins 2 caractères pour rechercher.`
                    : `${contexte.total.toLocaleString("fr-FR")} établissements référencés pour ${pays} : tapez au moins 2 caractères pour rechercher, ou choisissez d'abord une direction régionale.`
                  : undefined
              }
              selection={null}
              onChange={(e) => {
                if (!e) return;
                setEtabsSel((l) => (l.some((x) => x.id === e.id) ? l : [...l, { id: e.id, nom: e.nom }]));
              }}
              pays={pays}
            />
            {/* Établissements choisis : badges retirables ; le PREMIER est le PRINCIPAL. */}
            {etabsSel.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {etabsSel.map((e, i) => (
                  <span
                    key={e.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-forest-50 py-1 pl-3 pr-1.5 text-xs font-medium text-forest-900"
                  >
                    {e.nom}
                    {i === 0 && (
                      <span className="rounded-full bg-forest-800 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-cream-50">
                        principal
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEtabsSel((l) => l.filter((x) => x.id !== e.id))}
                      aria-label={`Retirer ${e.nom}`}
                      className="rounded-full p-0.5 text-forest-700/60 hover:bg-forest-100 hover:text-forest-900"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-xs text-ink-700/60">
              Le premier établissement est le rattachement <span className="font-semibold">principal</span> ; les
              suivants (groupes scolaires) donnent le même accès.
            </p>
            <p className="mt-1 text-xs text-ink-700/60">
              Répertoire complet de <span className="font-semibold">{pays}</span>
              {contexte ? ` (${contexte.total.toLocaleString("fr-FR")} établissements)` : ""}, en cascade par
              direction régionale{pays === "Côte d'Ivoire" ? " (DRENAET)" : ""}. Le rattachement fixe le périmètre de ce rôle.
            </p>
          </div>
        </>
      )}

      {peutEssai && portee === "etablissement" && (
        <div className="mt-4">
          <ReglageEssai finLeInitial={ligne.essaiFinLe} onChange={setEssaiVals} />
        </div>
      )}

      {portee === "diocese" && (
        <>
          <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60">
            Diocèse de rattachement (SEDEC)
          </p>
          <div className="mt-1.5">
            {diocesesDuPays(pays).length > 0 ? (
              <SelectRecherche
                key={`diocese|${pays}`}
                name="dioceseRecherche"
                grand
                options={diocesesDuPays(pays).map((d) => ({ id: d, nom: d }))}
                defaut={diocese ? { id: diocese, nom: diocese } : null}
                placeholder="Rechercher / choisir un diocèse…"
                onSelect={(o) => setDiocese(o?.id ?? "")}
              />
            ) : (
              <input
                value={diocese}
                onChange={(e) => setDiocese(e.target.value)}
                placeholder="Nom du diocèse"
                className="h-11 w-full rounded-2xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
            )}
            <p className="mt-1.5 text-xs text-ink-700/60">
              Consultation (lecture seule) des établissements catholiques (réseau SEDEC) de ce diocèse, dans {pays}.
            </p>
          </div>
        </>
      )}

      {(portee === "cafop" || portee === "apfc") && (
        <>
          <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60">
            Rattacher à {portee === "cafop" ? `un ${appliquerTerme("CAFOP", terme)}` : "une APFC"}
          </p>
          <div className="mt-1.5">
            {structCharge ? (
              <p className="text-sm text-ink-700/55">Chargement de la liste…</p>
            ) : structListe.length === 0 ? (
              <p className="text-sm text-ink-700/60">
                Aucune structure de ce type pour <span className="font-semibold">{pays}</span>.
              </p>
            ) : (
              <SelectRecherche
                key={`struct|${portee}|${pays}`}
                name="structRecherche"
                grand
                options={structListe}
                defaut={structListe.find((s) => s.id === structSel) ?? null}
                placeholder={`Rechercher / choisir ${portee === "cafop" ? `un ${appliquerTerme("CAFOP", terme)}` : "une APFC"}…`}
                onSelect={(o) => setStructSel(o?.id ?? "")}
              />
            )}
            <p className="mt-1.5 text-xs text-ink-700/60">Le rattachement fixe le périmètre de ce rôle.</p>
          </div>
        </>
      )}

      {(portee === "pays" || portee === "global" || portee === "antenne" || portee === "personnel") && (
        <p className="mt-4 text-xs text-ink-700/60">
          {portee === "global"
            ? "Ce rôle a accès à tous les pays : aucun rattachement à une structure n'est requis."
            : portee === "pays"
              ? `Ce rôle couvre l'ensemble des établissements, ${appliquerTerme("CAFOP", terme)} et APFC de ${pays} : aucun rattachement à une structure précise n'est requis.`
              : "Ce rôle ne nécessite pas de rattachement à une structure."}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {perimetreManquant && hintPerimetre && (
          <span className="mr-auto inline-flex items-center gap-1.5 text-xs font-medium text-gold-700">
            <AlertTriangle size={13} className="shrink-0" /> {hintPerimetre}
          </span>
        )}
        <button onClick={onClose} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
          Annuler
        </button>
        <button
          onClick={enregistrer}
          disabled={pending || perimetreManquant}
          title={perimetreManquant ? hintPerimetre : undefined}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Modifier
        </button>
      </div>
    </CoqueModale>
  );
}

// ─────────────────────────────────────────────────────────────
//  Modale APERÇU DU PROFIL (œil)
// ─────────────────────────────────────────────────────────────
function ModaleApercu({ ligne, onClose, onModifier }: { ligne: LigneCompte; onClose: () => void; onModifier: () => void }) {
  const rangs: { libelle: string; valeur: React.ReactNode }[] = [
    { libelle: "Rôle", valeur: <Badge ton="neutre">{ligne.roleLibelle}</Badge> },
    // Choix du demandeur en attente (synchronisé avec « Approbations »).
    ...(ligne.demandeRole
      ? [{
          libelle: "Demande en attente",
          valeur: (
            <Badge ton="attente">
              {ligne.demandeRole.roleLibelle}
              {ligne.demandeRole.etab ? ` — ${ligne.demandeRole.etab.nom}` : ""}
            </Badge>
          ),
        }]
      : []),
    {
      libelle: "Statut",
      valeur: (
        <Badge ton={TON_STATUT[ligne.statut] ?? "attente"}>
          {ligne.statut === "actif" && <BadgeCheck size={12} className="mr-1 inline" />}
          {LIBELLE_STATUT[ligne.statut] ?? ligne.statut}
        </Badge>
      ),
    },
    { libelle: "Établissement", valeur: ligne.etablissement ?? "" },
    { libelle: "Région", valeur: ligne.region ?? "" },
    { libelle: "Pays", valeur: <DrapeauPays pays={ligne.pays} /> },
    {
      libelle: "Identifiant technique",
      valeur: <code className="rounded bg-cream-100 px-1.5 py-0.5 text-[0.7rem] text-ink-700/70">{ligne.id}</code>,
    },
  ];
  return (
    <CoqueModale onClose={onClose}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">Aperçu du profil</h2>
          <p className="mt-0.5 text-xs text-ink-700/60">Récapitulatif du compte utilisateur.</p>
        </div>
        <button onClick={onClose} aria-label="Fermer" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100">
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-800">
          {(ligne.nomAffiche !== "—" ? ligne.nomAffiche : ligne.email).slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-forest-900">{ligne.nomAffiche}</p>
          <p className="truncate text-xs text-ink-700/60">{ligne.email}</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-cream-200">
        {rangs.map((r) => (
          <div key={r.libelle} className="flex items-center justify-between gap-3 border-b border-cream-100 px-4 py-2.5 text-sm last:border-0">
            <span className="text-ink-700/60">{r.libelle}</span>
            <span className="text-right text-forest-900">{r.valeur}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
          Fermer
        </button>
        <button onClick={onModifier} className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700">
          <Pencil size={14} /> Modifier
        </button>
      </div>
    </CoqueModale>
  );
}

// ─────────────────────────────────────────────────────────────
//  Modale MODIFIER L'UTILISATEUR (stylo)
// ─────────────────────────────────────────────────────────────
function ModaleEdition({
  ligne,
  estSoi,
  onClose,
  onDone,
  terme,
}: {
  ligne: LigneCompte;
  estSoi: boolean;
  onClose: () => void;
  onDone: (ok: boolean, texte: string) => void;
  terme: string;
}) {
  const [prenoms, setPrenoms] = useState(ligne.prenoms);
  const [nom, setNom] = useState(ligne.nom);
  const [email, setEmail] = useState(ligne.email);
  const [role, setRole] = useState(ligne.roleTech);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Réinitialisation du mot de passe (admin) : saisi librement ou généré côté serveur.
  const [mdp, setMdp] = useState("");
  const [mdpRetour, setMdpRetour] = useState<{ ok: boolean; message: string; motDePasse?: string } | null>(null);
  const [mdpCopie, setMdpCopie] = useState(false);
  const [mdpPending, startMdp] = useTransition();

  function reinitialiser() {
    startMdp(async () => {
      const fd = new FormData();
      fd.set("utilisateurId", ligne.id);
      if (mdp.trim()) fd.set("motDePasse", mdp.trim());
      const res = await reinitialiserMotDePasse({ ok: false }, fd);
      setMdpCopie(false);
      setMdpRetour({ ok: res.ok, message: res.message ?? "Erreur technique.", motDePasse: res.motDePasseTemp });
      if (res.ok) setMdp("");
    });
  }

  function enregistrer() {
    start(async () => {
      const fd = new FormData();
      fd.set("utilisateurId", ligne.id);
      fd.set("prenoms", prenoms);
      fd.set("nom", nom);
      fd.set("email", email);
      const res = await modifierCoordonnees({ ok: false }, fd);
      if (!res.ok) {
        setErreur(res.message ?? "Erreur technique.");
        return;
      }
      // Changement de rôle éventuel (périmètre conservé — pour le périmètre, passer par le bouclier).
      if (role !== ligne.roleTech && !estSoi) {
        const fd2 = new FormData();
        fd2.set("utilisateurId", ligne.id);
        fd2.set("role", role);
        const res2 = await changerRole({ ok: false }, fd2);
        if (!res2.ok) {
          setErreur(res2.message ?? "Coordonnées enregistrées, mais le rôle n'a pas pu être modifié.");
          return;
        }
      }
      onDone(true, "Utilisateur mis à jour.");
    });
  }

  const champ =
    "h-11 w-full rounded-2xl border border-cream-300 bg-white px-3.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

  return (
    <CoqueModale onClose={onClose}>
      <div className="flex items-start justify-between">
        <h2 className="font-display text-xl font-bold text-forest-900">Modifier l&apos;utilisateur</h2>
        <button onClick={onClose} aria-label="Fermer" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100">
          <X size={18} />
        </button>
      </div>

      {erreur && <p className="mt-3 text-sm font-medium text-red-600">{erreur}</p>}

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Prénoms</label>
            <input value={prenoms} onChange={(e) => setPrenoms(e.target.value)} className={champ} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Nom</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className={champ} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Adresse e-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={champ} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Rôle</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={estSoi} className={`${champ} disabled:opacity-60`}>
            {ROLES_ORDONNES.map((r) => (
              <option key={r.id} value={r.id}>
                {appliquerTerme(r.libelle, terme)}
              </option>
            ))}
          </select>
          {estSoi && <p className="mt-1 text-xs text-ink-700/55">Vous ne pouvez pas modifier votre propre rôle.</p>}
        </div>
      </div>

      {/* Réinitialisation du mot de passe : l'admin le choisit, ou en fait générer un. */}
      {!estSoi && (
        <div className="mt-5 border-t border-cream-100 pt-4">
          <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/60">
            <KeyRound size={13} /> Mot de passe
          </p>
          <p className="mt-1 text-xs text-ink-700/60">
            Saisissez un nouveau mot de passe (8 caractères minimum) ou laissez vide pour en générer un.
            Il est envoyé par e-mail à l&apos;utilisateur, avec invitation à le changer.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={mdp}
              onChange={(e) => setMdp(e.target.value)}
              placeholder="Nouveau mot de passe (vide = généré)"
              autoComplete="off"
              className={`${champ} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={reinitialiser}
              disabled={mdpPending}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-cream-300 px-5 text-sm font-semibold text-forest-800 hover:bg-cream-100 disabled:opacity-60"
            >
              {mdpPending ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Réinitialiser
            </button>
          </div>
          {mdpRetour && (
            <div className={`mt-2 rounded-2xl border p-3 ${mdpRetour.ok ? "border-forest-200 bg-forest-50" : "border-red-200 bg-red-50"}`}>
              <p className={`text-xs font-medium ${mdpRetour.ok ? "text-forest-800" : "text-red-700"}`}>{mdpRetour.message}</p>
              {mdpRetour.motDePasse && (
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm text-forest-900">{mdpRetour.motDePasse}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(mdpRetour.motDePasse!);
                      setMdpCopie(true);
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-forest-200 px-3 text-xs font-medium text-forest-700 hover:bg-white"
                  >
                    {mdpCopie ? <Check size={13} /> : <Copy size={13} />} {mdpCopie ? "Copié" : "Copier"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
          Annuler
        </button>
        <button
          onClick={enregistrer}
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer
        </button>
      </div>
    </CoqueModale>
  );
}

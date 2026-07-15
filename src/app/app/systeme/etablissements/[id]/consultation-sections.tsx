import Link from "next/link";
import {
  ArrowLeft, BookOpenCheck, CalendarCheck2, Church, ClipboardList, DoorOpen, Download,
  GraduationCap, LayoutGrid, Mail, MapPin, Phone, School, UserRound, Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/app/ui";
import { LIBELLE_TYPE } from "@/lib/referentiels/etablissement";
import { agregatsEtablissement, statsParClasse } from "@/lib/reseau-catholique/agregats";

/**
 * Onglets de CONSULTATION (lecture seule) d'un établissement du réseau catholique,
 * pour les rôles SENEC / SEDEC. Aucun formulaire : uniquement du rendu serveur.
 * Le périmètre est déjà vérifié par le hub (fiche-consultation.tsx).
 */

export type EtabConsult = {
  id: string;
  nom: string;
  code: string | null;
  type: string;
  statut: string;
  ville: string | null;
  adresse: string | null;
  email: string | null;
  telephone: string | null;
  pays: string | null;
  diocese: string | null;
  reseauConfessionnel: string | null;
  anneeScolaire: string | null;
  ministere: string | null;
  fonctionChef: string | null;
  nomChef: string | null;
  prenomsChef: string | null;
  regimeVacation: string;
  regimeNotation: string | null;
  nbSequences: number | null;
  indexationClasses: string;
  effectifSouhaiteParClasse: number;
  nbSallesDisponibles: number;
  region: { nom: string } | null;
  _count: { classes: number; salles: number };
};

const dateCourte = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
const nomComplet = (u: { prenoms: string | null; nom: string | null; email?: string }) =>
  [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email || "—";

const LIBELLE_CYCLE: Record<string, string> = { prescolaire: "Préscolaire", primaire: "Primaire", college: "Collège", lycee: "Lycée" };
const LIBELLE_ROLE_PERSONNEL: Record<string, string> = {
  chef_etablissement: "Chef d'établissement",
  adjoint_chef_etablissement: "Adjoint au chef d'établissement",
  educateur: "Éducateur",
  enseignant: "Enseignant",
  etablissements_admin: "Administrateur d'établissements",
};

function Info({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-ink-700/50">{libelle}</span>
      <span className="min-w-0 text-right text-sm font-medium text-forest-900">{valeur ?? "—"}</span>
    </div>
  );
}

function TitreSection({ icone, titre, note }: { icone: React.ReactNode; titre: string; note?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        {icone} {titre}
      </h2>
      {note && <span className="text-xs text-ink-700/55">{note}</span>}
    </div>
  );
}

const lienBase = (e: EtabConsult) => `/app/systeme/etablissements/${e.id}`;

// ─────────────────────────── Aperçu ───────────────────────────

export async function OngletApercu({ e }: { e: EtabConsult }) {
  const a = await agregatsEtablissement(e.id);
  const chef = [e.prenomsChef, e.nomChef].filter(Boolean).join(" ").trim();
  const chiffres = [
    { icone: LayoutGrid, valeur: a.classes, libelle: "classe(s)" },
    { icone: DoorOpen, valeur: a.salles || e.nbSallesDisponibles, libelle: "salle(s)" },
    { icone: GraduationCap, valeur: a.enseignants, libelle: "enseignant(s)" },
    { icone: Users, valeur: a.eleves, libelle: "élève(s)" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{LIBELLE_TYPE[e.type] ?? e.type}</Badge>
        <Badge ton="succes">{e.statut === "confessionnel" ? "Confessionnel" : e.statut}</Badge>
        {e.reseauConfessionnel && <Badge ton="attente">Réseau {e.reseauConfessionnel}</Badge>}
        {e.diocese && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-3 py-1 text-xs font-semibold text-forest-800">
            <Church size={13} /> {e.diocese}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {chiffres.map((c) => (
          <Card key={c.libelle} className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-600">
              <c.icone size={19} />
            </span>
            <span>
              <span className="block font-display text-xl font-bold text-forest-900">{c.valeur.toLocaleString("fr-FR")}</span>
              <span className="text-xs text-ink-700/60">{c.libelle}</span>
            </span>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <TitreSection icone={<School size={17} className="text-forest-600" />} titre="Identité" />
          <div className="divide-y divide-cream-200">
            <Info libelle="Code" valeur={e.code} />
            <Info libelle="Pays" valeur={e.pays} />
            <Info libelle="Région (DRENAET)" valeur={e.region?.nom} />
            <Info libelle="Localité" valeur={e.ville ? (<span className="inline-flex items-center gap-1"><MapPin size={12} className="shrink-0 text-ink-700/40" /> {e.ville}</span>) : null} />
            <Info libelle="Adresse" valeur={e.adresse} />
            <Info libelle="Année scolaire" valeur={e.anneeScolaire} />
          </div>
        </Card>
        <Card>
          <TitreSection icone={<UserRound size={17} className="text-forest-600" />} titre="Contact & direction" />
          <div className="divide-y divide-cream-200">
            <Info libelle={e.fonctionChef || "Chef d'établissement"} valeur={chef || null} />
            <Info libelle="E-mail" valeur={e.email ? (<span className="inline-flex items-center gap-1 break-all"><Mail size={12} className="shrink-0 text-ink-700/40" /> {e.email}</span>) : null} />
            <Info libelle="Téléphone" valeur={e.telephone ? (<span className="inline-flex items-center gap-1"><Phone size={12} className="shrink-0 text-ink-700/40" /> {e.telephone}</span>) : null} />
            <Info libelle="Taux de présence" valeur={a.tauxPresence != null ? `${a.tauxPresence.toLocaleString("fr-FR")} %` : null} />
            <Info libelle="Moyenne générale" valeur={a.moyenneGenerale != null ? `${a.moyenneGenerale.toLocaleString("fr-FR")} / 20` : null} />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────── Configuration ────────────────────────

export async function OngletConfiguration({ e }: { e: EtabConsult }) {
  const [niveaux, salles, effectifsEns] = await Promise.all([
    prisma.niveauEtablissement.findMany({
      where: { etablissementId: e.id },
      include: { niveau: { select: { nom: true, ordre: true, cycle: true } } },
    }),
    prisma.salle.findMany({ where: { etablissementId: e.id }, orderBy: { nom: "asc" } }),
    prisma.effectifEnseignant.findMany({
      where: { etablissementId: e.id, nombre: { gt: 0 } },
      include: { discipline: { select: { nom: true } } },
      orderBy: [{ cycle: "asc" }],
    }),
  ]);
  niveaux.sort((a, b) => a.niveau.ordre - b.niveau.ordre);
  const regime =
    e.regimeNotation === "trimestre" ? "Trimestriel" :
    e.regimeNotation === "semestre" ? "Semestriel" :
    e.regimeNotation === "sequence" ? `Séquentiel (${e.nbSequences ?? 6} séquences)` : "Régime de la configuration générale";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <TitreSection icone={<School size={17} className="text-forest-600" />} titre="Paramétrage institutionnel" />
          <div className="divide-y divide-cream-200">
            <Info libelle="Ministère" valeur={e.ministere} />
            <Info libelle="Année scolaire" valeur={e.anneeScolaire} />
            <Info libelle="Régime de notation" valeur={regime} />
            <Info libelle="Régime de vacation" valeur={e.regimeVacation === "double" ? "Double vacation" : "Vacation simple"} />
            <Info libelle="Indexation des classes" valeur={e.indexationClasses === "@" ? "Lettres (6ème A…)" : "Chiffres (6ème 1…)"} />
            <Info libelle="Effectif souhaité / classe" valeur={e.effectifSouhaiteParClasse} />
            <Info libelle="Salles déclarées" valeur={e.nbSallesDisponibles} />
          </div>
        </Card>
        <Card>
          <TitreSection icone={<LayoutGrid size={17} className="text-forest-600" />} titre="Niveaux ouverts" note={`${niveaux.length} niveau(x)`} />
          {niveaux.length === 0 ? (
            <p className="text-sm text-ink-700/60">Aucun niveau configuré.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                    <th className="py-1.5 pr-2">Niveau</th><th className="py-1.5 pr-2">Cycle</th>
                    <th className="py-1.5 pr-2 text-right">Effectif</th><th className="py-1.5 pr-2 text-right">Classes</th><th className="py-1.5 text-right">Vacation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {niveaux.map((n) => (
                    <tr key={n.id}>
                      <td className="py-1.5 pr-2 font-medium text-forest-900">{n.niveau.nom}</td>
                      <td className="py-1.5 pr-2">{LIBELLE_CYCLE[n.niveau.cycle] ?? n.niveau.cycle}</td>
                      <td className="py-1.5 pr-2 text-right">{n.effectif.toLocaleString("fr-FR")}</td>
                      <td className="py-1.5 pr-2 text-right">{n.nbClasses}</td>
                      <td className="py-1.5 text-right">{n.vacation === "double" ? "Double" : "Simple"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <TitreSection icone={<DoorOpen size={17} className="text-forest-600" />} titre="Salles" note={`${salles.length} salle(s)`} />
          {salles.length === 0 ? (
            <p className="text-sm text-ink-700/60">Aucune salle enregistrée.</p>
          ) : (
            <ul className="divide-y divide-cream-100 text-sm">
              {salles.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="font-medium text-forest-900">{s.nom}</span>
                  <span className="text-xs text-ink-700/60">{s.type.replace(/_/g, " ")} · {s.capacite} places</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <TitreSection icone={<GraduationCap size={17} className="text-forest-600" />} titre="Effectifs enseignants déclarés" note="par discipline et cycle" />
          {effectifsEns.length === 0 ? (
            <p className="text-sm text-ink-700/60">Aucun effectif déclaré.</p>
          ) : (
            <ul className="divide-y divide-cream-100 text-sm">
              {effectifsEns.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="font-medium text-forest-900">{x.discipline.nom}</span>
                  <span className="text-xs text-ink-700/60">{LIBELLE_CYCLE[x.cycle] ?? x.cycle} · {x.nombre} enseignant(s)</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ────────────────────────── Élèves ────────────────────────────

export async function OngletEleves({ e, classeId }: { e: EtabConsult; classeId?: string }) {
  // Pastilles : compteurs seuls ; les fiches élèves ne sont chargées que pour
  // les classes réellement affichées (une seule quand le filtre est actif).
  const classes = await prisma.classe.findMany({
    where: { etablissementId: e.id },
    include: {
      niveau: { select: { nom: true, ordre: true } },
      _count: { select: { inscriptions: true } },
    },
  });
  classes.sort((a, b) => a.niveau.ordre - b.niveau.ordre || a.nom.localeCompare(b.nom, "fr"));
  const visibles = classeId ? classes.filter((c) => c.id === classeId) : classes;
  const totalEleves = classes.reduce((s, c) => s + c._count.inscriptions, 0);
  const inscriptions = await prisma.inscription.findMany({
    where: { classeId: { in: visibles.map((c) => c.id) } },
    include: { eleve: { select: { id: true, nom: true, prenoms: true, matricule: true, sexe: true } } },
  });
  const parClasse = new Map<string, typeof inscriptions>();
  for (const i of inscriptions) parClasse.set(i.classeId, [...(parClasse.get(i.classeId) ?? []), i]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Classes :</span>
          <Link href={`${lienBase(e)}?onglet=eleves`} className={`rounded-full px-3 py-1 text-xs font-medium ${!classeId ? "bg-forest-800 text-cream-50" : "border border-cream-300 text-forest-800 hover:bg-forest-50"}`}>
            Toutes ({totalEleves.toLocaleString("fr-FR")} élèves)
          </Link>
          {classes.map((c) => (
            <Link key={c.id} href={`${lienBase(e)}?onglet=eleves&classe=${c.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${classeId === c.id ? "bg-forest-800 text-cream-50" : "border border-cream-300 text-forest-800 hover:bg-forest-50"}`}>
              {c.nom} ({c._count.inscriptions})
            </Link>
          ))}
        </div>
      </Card>
      {visibles.length === 0 ? (
        <Card><p className="text-sm text-ink-700/60">Aucune classe pour cet établissement.</p></Card>
      ) : (
        visibles.map((c) => {
          const eleves = [...(parClasse.get(c.id) ?? [])].sort((a, b) => nomComplet(a.eleve).localeCompare(nomComplet(b.eleve), "fr"));
          return (
            <Card key={c.id}>
              <TitreSection icone={<Users size={17} className="text-forest-600" />} titre={`${c.nom} — ${c.niveau.nom}`} note={`${eleves.length} élève(s)`} />
              {eleves.length === 0 ? (
                <p className="text-sm text-ink-700/60">Aucun élève inscrit dans cette classe.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                        <th className="py-1.5 pr-2">#</th><th className="py-1.5 pr-2">Nom et prénoms</th>
                        <th className="py-1.5 pr-2">Matricule</th><th className="py-1.5">Sexe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-100">
                      {eleves.map((i, n) => (
                        <tr key={i.id}>
                          <td className="py-1.5 pr-2 text-ink-700/50">{n + 1}</td>
                          <td className="py-1.5 pr-2 font-medium text-forest-900">{nomComplet(i.eleve)}</td>
                          <td className="py-1.5 pr-2">{i.eleve.matricule ?? "—"}</td>
                          <td className="py-1.5">{i.eleve.sexe ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

// ───────────────────────── Personnel ──────────────────────────

export async function OngletPersonnel({ e, ficheId }: { e: EtabConsult; ficheId?: string }) {
  if (ficheId) return <FichePersonnel e={e} utilisateurId={ficheId} />;
  const [personnel, competences] = await Promise.all([
    prisma.utilisateur.findMany({
      where: { etablissementId: e.id, roleActif: { nomTechnique: { in: Object.keys(LIBELLE_ROLE_PERSONNEL) } } },
      select: { id: true, nom: true, prenoms: true, email: true, telephone: true, roleActif: { select: { nomTechnique: true } } },
    }),
    prisma.competenceEnseignant.findMany({
      where: { etablissementId: e.id },
      include: { discipline: { select: { nom: true } } },
    }),
  ]);
  const specialites = new Map<string, string[]>();
  for (const c of competences) {
    const l = specialites.get(c.enseignantId) ?? [];
    l.push(c.discipline.nom);
    specialites.set(c.enseignantId, l);
  }
  const parRole = new Map<string, typeof personnel>();
  for (const p of personnel) {
    const r = p.roleActif.nomTechnique;
    parRole.set(r, [...(parRole.get(r) ?? []), p]);
  }
  const ordre = Object.keys(LIBELLE_ROLE_PERSONNEL);

  return (
    <div className="space-y-4">
      {personnel.length === 0 && (
        <Card><p className="text-sm text-ink-700/60">Aucun membre du personnel n&apos;a de compte rattaché à cet établissement.</p></Card>
      )}
      {ordre.filter((r) => parRole.has(r)).map((r) => {
        const membres = [...(parRole.get(r) ?? [])].sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), "fr"));
        return (
          <Card key={r}>
            <TitreSection icone={<UserRound size={17} className="text-forest-600" />} titre={`${LIBELLE_ROLE_PERSONNEL[r]}${membres.length > 1 ? "s" : ""}`} note={`${membres.length}`} />
            <ul className="divide-y divide-cream-100">
              {membres.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`${lienBase(e)}?onglet=personnel&fiche=${m.id}`} className="font-medium text-forest-900 hover:underline">
                      {nomComplet(m)}
                    </Link>
                    <p className="break-all text-xs text-ink-700/55">{m.email}</p>
                  </div>
                  {r === "enseignant" && (
                    <div className="flex max-w-full flex-wrap gap-1">
                      {(specialites.get(m.id) ?? []).map((s) => (
                        <span key={s} className="rounded-full bg-cream-100 px-2 py-0.5 text-[0.68rem] font-medium text-forest-800">{s}</span>
                      ))}
                      {(specialites.get(m.id) ?? []).length === 0 && <span className="text-xs text-ink-700/45">Spécialités non renseignées</span>}
                    </div>
                  )}
                  <Link href={`${lienBase(e)}?onglet=personnel&fiche=${m.id}`} className="shrink-0 rounded-full border border-cream-300 px-3 py-1 text-xs font-medium text-forest-800 hover:bg-forest-50">
                    Voir la fiche
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

async function FichePersonnel({ e, utilisateurId }: { e: EtabConsult; utilisateurId: string }) {
  // Cloisonnement : uniquement un membre du PERSONNEL de CET établissement
  // (jamais un élève ou un parent, même en devinant son identifiant).
  const u = await prisma.utilisateur.findFirst({
    where: {
      id: utilisateurId,
      etablissementId: e.id,
      roleActif: { nomTechnique: { in: Object.keys(LIBELLE_ROLE_PERSONNEL) } },
    },
    select: {
      id: true, nom: true, prenoms: true, email: true, telephone: true, sexe: true,
      roleActif: { select: { nomTechnique: true, libelle: true } },
    },
  });
  if (!u) {
    return (
      <Card>
        <p className="text-sm text-ink-700/60">Fiche introuvable dans cet établissement.</p>
      </Card>
    );
  }
  const [competences, niveauxEns, affectations] = await Promise.all([
    prisma.competenceEnseignant.findMany({ where: { enseignantId: u.id, etablissementId: e.id }, include: { discipline: { select: { nom: true } } } }),
    prisma.niveauEnseignant.findMany({ where: { enseignantId: u.id, etablissementId: e.id }, include: { niveau: { select: { nom: true, ordre: true } } } }),
    prisma.affectationEnseignant.findMany({
      where: { enseignantId: u.id, classe: { etablissementId: e.id } },
      include: { classe: { select: { nom: true } }, discipline: { select: { nom: true } } },
    }),
  ]);
  niveauxEns.sort((a, b) => a.niveau.ordre - b.niveau.ordre);
  return (
    <div className="space-y-4">
      <Link href={`${lienBase(e)}?onglet=personnel`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={15} /> Retour au personnel
      </Link>
      <Card>
        <TitreSection icone={<UserRound size={17} className="text-forest-600" />} titre={nomComplet(u)} note={LIBELLE_ROLE_PERSONNEL[u.roleActif.nomTechnique] ?? u.roleActif.libelle} />
        <div className="divide-y divide-cream-200">
          <Info libelle="E-mail" valeur={<span className="break-all">{u.email}</span>} />
          <Info libelle="Téléphone" valeur={u.telephone} />
          {u.roleActif.nomTechnique === "enseignant" && (
            <>
              <Info libelle="Spécialités" valeur={competences.length ? competences.map((c) => c.discipline.nom).join(" · ") : null} />
              <Info libelle="Niveaux tenus" valeur={niveauxEns.length ? niveauxEns.map((n) => n.niveau.nom).join(" · ") : null} />
            </>
          )}
        </div>
      </Card>
      {u.roleActif.nomTechnique === "enseignant" && (
        <Card>
          <TitreSection icone={<LayoutGrid size={17} className="text-forest-600" />} titre="Affectations aux classes" note={`${affectations.length}`} />
          {affectations.length === 0 ? (
            <p className="text-sm text-ink-700/60">Aucune affectation enregistrée.</p>
          ) : (
            <ul className="divide-y divide-cream-100 text-sm">
              {affectations.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="font-medium text-forest-900">{a.classe.nom}</span>
                  <span className="text-xs text-ink-700/60">{a.discipline.nom}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

// ──────────────────────── Cahier de texte ─────────────────────

export async function OngletCahier({ e, classeId }: { e: EtabConsult; classeId?: string }) {
  const [classes, seances] = await Promise.all([
    prisma.classe.findMany({ where: { etablissementId: e.id }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.cahierTexte.findMany({
      where: { statut: "publie", classe: classeId ? { id: classeId, etablissementId: e.id } : { etablissementId: e.id } },
      include: {
        classe: { select: { nom: true } },
        discipline: { select: { nom: true } },
        enseignant: { select: { nom: true, prenoms: true, email: true } },
      },
      orderBy: { date: "desc" },
      take: 60,
    }),
  ]);
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Classes :</span>
          <Link href={`${lienBase(e)}?onglet=cahier-texte`} className={`rounded-full px-3 py-1 text-xs font-medium ${!classeId ? "bg-forest-800 text-cream-50" : "border border-cream-300 text-forest-800 hover:bg-forest-50"}`}>Toutes</Link>
          {classes.map((c) => (
            <Link key={c.id} href={`${lienBase(e)}?onglet=cahier-texte&classe=${c.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${classeId === c.id ? "bg-forest-800 text-cream-50" : "border border-cream-300 text-forest-800 hover:bg-forest-50"}`}>
              {c.nom}
            </Link>
          ))}
        </div>
      </Card>
      {seances.length === 0 ? (
        <Card><p className="text-sm text-ink-700/60">Aucune séance publiée au cahier de texte{classeId ? " pour cette classe" : ""}.</p></Card>
      ) : (
        seances.map((s) => (
          <Card key={s.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-forest-900">
                {s.titre || s.discipline.nom}
                <span className="ml-2 text-xs font-normal text-ink-700/55">{s.classe.nom} · {s.discipline.nom}{s.typeActivite ? ` · ${s.typeActivite}` : ""}</span>
              </p>
              <p className="text-xs text-ink-700/55">
                {dateCourte(s.date)}{s.heureDebut ? ` · ${s.heureDebut}` : ""}{s.dureeMin ? ` · ${s.dureeMin} min` : ""}
              </p>
            </div>
            {s.enseignant && <p className="mt-0.5 text-xs text-ink-700/55">Enseignant : {nomComplet(s.enseignant)}</p>}
            <p className="mt-2 whitespace-pre-line text-sm text-ink-700/85">{s.contenu}</p>
            {s.travailAFaire && (
              <p className="mt-2 rounded-xl bg-gold-50 px-3 py-2 text-sm text-gold-800">
                <span className="font-semibold">Travail à faire : </span>{s.travailAFaire}
              </p>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

// ─────────────────────── Registre d'appel ─────────────────────

export async function OngletRegistre({ e, classeId }: { e: EtabConsult; classeId?: string }) {
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - 60);
  // Tous les indicateurs sont agrégés CÔTÉ BASE sur la fenêtre complète de 60 jours
  // (jamais sur un échantillon) ; seul le tableau « Derniers appels » est borné (15).
  const whereAppel = {
    date: { gte: depuis },
    classe: classeId ? { id: classeId, etablissementId: e.id } : { etablissementId: e.id },
  };
  const [classes, nbAppels, pointages, derniers] = await Promise.all([
    prisma.classe.findMany({ where: { etablissementId: e.id }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.appel.count({ where: whereAppel }),
    prisma.presence.groupBy({
      by: ["statut", "justifie"],
      where: { appel: whereAppel },
      _count: { _all: true },
    }),
    prisma.appel.findMany({
      where: whereAppel,
      include: {
        classe: { select: { id: true, nom: true } },
        discipline: { select: { nom: true } },
        presences: { select: { statut: true } },
      },
      orderBy: { date: "desc" },
      take: 15,
    }),
  ]);

  const compte = (pred: (x: (typeof pointages)[number]) => boolean) =>
    pointages.filter(pred).reduce((s, x) => s + x._count._all, 0);
  const total = {
    pointages: compte(() => true),
    presents: compte((x) => x.statut === "present" || x.statut === "retard"),
    retards: compte((x) => x.statut === "retard"),
    absentsNJ: compte((x) => x.statut === "absent" && !x.justifie),
  };

  // Bilan par classe (vue « toutes classes ») : appels via groupBy, pointages via une
  // jointure SQL (Prisma ne sait pas grouper une relation) — exact sur les 60 jours.
  const parClasse = new Map<string, { nom: string; appels: number; pointages: number; presents: number; absentsNJ: number }>();
  if (!classeId) {
    const [appelsParClasse, pointagesParClasse] = await Promise.all([
      prisma.appel.groupBy({ by: ["classeId"], where: whereAppel, _count: { _all: true } }),
      prisma.$queryRaw<{ classeId: string; statut: string; justifie: boolean; nb: bigint }[]>`
        SELECT a."classeId", p."statut"::text AS "statut", p."justifie", COUNT(*)::bigint AS nb
        FROM "presences" p
        JOIN "appels" a ON a."id" = p."appelId"
        JOIN "classes" c ON c."id" = a."classeId"
        WHERE a."date" >= ${depuis} AND c."etablissementId" = ${e.id}
        GROUP BY 1, 2, 3`,
    ]);
    const nomsClasses = new Map(classes.map((c) => [c.id, c.nom]));
    for (const a of appelsParClasse) {
      parClasse.set(a.classeId, { nom: nomsClasses.get(a.classeId) ?? "?", appels: a._count._all, pointages: 0, presents: 0, absentsNJ: 0 });
    }
    for (const p of pointagesParClasse) {
      const c = parClasse.get(p.classeId);
      if (!c) continue;
      const nb = Number(p.nb);
      c.pointages += nb;
      if (p.statut === "present" || p.statut === "retard") c.presents += nb;
      if (p.statut === "absent" && !p.justifie) c.absentsNJ += nb;
    }
  }

  const taux = total.pointages ? Math.round((total.presents / total.pointages) * 1000) / 10 : null;
  const kpis = [
    { libelle: "Appels (60 j)", valeur: nbAppels.toLocaleString("fr-FR") },
    { libelle: "Taux de présence", valeur: taux != null ? `${taux.toLocaleString("fr-FR")} %` : "—" },
    { libelle: "Retards", valeur: total.retards.toLocaleString("fr-FR") },
    { libelle: "Absences non justifiées", valeur: total.absentsNJ.toLocaleString("fr-FR") },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.libelle} className="p-4">
            <p className="font-display text-xl font-bold text-forest-900">{k.valeur}</p>
            <p className="text-xs text-ink-700/60">{k.libelle}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Classes :</span>
          <Link href={`${lienBase(e)}?onglet=registre-appel`} className={`rounded-full px-3 py-1 text-xs font-medium ${!classeId ? "bg-forest-800 text-cream-50" : "border border-cream-300 text-forest-800 hover:bg-forest-50"}`}>Toutes</Link>
          {classes.map((c) => (
            <Link key={c.id} href={`${lienBase(e)}?onglet=registre-appel&classe=${c.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${classeId === c.id ? "bg-forest-800 text-cream-50" : "border border-cream-300 text-forest-800 hover:bg-forest-50"}`}>
              {c.nom}
            </Link>
          ))}
        </div>
      </Card>
      {!classeId && parClasse.size > 0 && (
        <Card>
          <TitreSection icone={<CalendarCheck2 size={17} className="text-forest-600" />} titre="Bilan par classe" note="60 derniers jours" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-1.5 pr-2">Classe</th><th className="py-1.5 pr-2 text-right">Appels</th>
                  <th className="py-1.5 pr-2 text-right">Présence</th><th className="py-1.5 text-right">Abs. non justifiées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {[...parClasse.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr")).map((c) => (
                  <tr key={c.nom}>
                    <td className="py-1.5 pr-2 font-medium text-forest-900">{c.nom}</td>
                    <td className="py-1.5 pr-2 text-right">{c.appels}</td>
                    <td className="py-1.5 pr-2 text-right">{c.pointages ? `${(Math.round((c.presents / c.pointages) * 1000) / 10).toLocaleString("fr-FR")} %` : "—"}</td>
                    <td className="py-1.5 text-right">{c.absentsNJ}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Card>
        <TitreSection icone={<ClipboardList size={17} className="text-forest-600" />} titre="Derniers appels" note={`${derniers.length} sur ${nbAppels.toLocaleString("fr-FR")}`} />
        {derniers.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucun appel sur les 60 derniers jours.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-1.5 pr-2">Date</th><th className="py-1.5 pr-2">Classe</th><th className="py-1.5 pr-2">Discipline</th>
                  <th className="py-1.5 pr-2">Créneau</th><th className="py-1.5 pr-2 text-right">Présents</th><th className="py-1.5 text-right">Absents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {derniers.map((a) => {
                  const presents = a.presences.filter((p) => p.statut === "present" || p.statut === "retard").length;
                  const absents = a.presences.filter((p) => p.statut === "absent").length;
                  return (
                    <tr key={a.id}>
                      <td className="py-1.5 pr-2">{dateCourte(a.date)}</td>
                      <td className="py-1.5 pr-2 font-medium text-forest-900">{a.classe.nom}</td>
                      <td className="py-1.5 pr-2">{a.discipline?.nom ?? "—"}</td>
                      <td className="py-1.5 pr-2">{a.heureSeance ?? "—"}</td>
                      <td className="py-1.5 pr-2 text-right text-forest-700">{presents}</td>
                      <td className="py-1.5 text-right text-red-600">{absents}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ──────────────────── Notes & bulletins ───────────────────────

const sur20 = (valeur: number, sur: number) => (sur > 0 ? (valeur / sur) * 20 : 0);
const fmt2 = (x: number) => (Math.round(x * 100) / 100).toLocaleString("fr-FR");

export async function OngletNotes({ e, classeId, eleveId }: { e: EtabConsult; classeId?: string; eleveId?: string }) {
  if (classeId && eleveId) return <BulletinEleve e={e} classeId={classeId} eleveId={eleveId} />;

  const classes = await prisma.classe.findMany({
    where: { etablissementId: e.id },
    include: { niveau: { select: { nom: true, ordre: true } } },
  });
  classes.sort((a, b) => a.niveau.ordre - b.niveau.ordre || a.nom.localeCompare(b.nom, "fr"));

  if (!classeId) {
    // Agrégat CÔTÉ BASE (groupBy classe × barème) : exact quel que soit le volume de notes.
    const groupes = await prisma.note.groupBy({
      by: ["classeId", "sur"],
      where: { classe: { etablissementId: e.id }, sur: { gt: 0 } },
      _sum: { valeur: true },
      _count: { _all: true },
    });
    const agg = new Map<string, { somme: number; nb: number }>();
    for (const g of groupes) {
      const a = agg.get(g.classeId) ?? { somme: 0, nb: 0 };
      a.somme += ((g._sum.valeur ?? 0) / g.sur) * 20;
      a.nb += g._count._all;
      agg.set(g.classeId, a);
    }
    return (
      <Card>
        <TitreSection icone={<BookOpenCheck size={17} className="text-forest-600" />} titre="Moyennes par classe" note="toutes périodes confondues" />
        {classes.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune classe.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-1.5 pr-2">Classe</th><th className="py-1.5 pr-2">Niveau</th>
                  <th className="py-1.5 pr-2 text-right">Notes saisies</th><th className="py-1.5 pr-2 text-right">Moyenne /20</th><th className="py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {classes.map((c) => {
                  const a = agg.get(c.id);
                  return (
                    <tr key={c.id}>
                      <td className="py-1.5 pr-2 font-medium text-forest-900">{c.nom}</td>
                      <td className="py-1.5 pr-2">{c.niveau.nom}</td>
                      <td className="py-1.5 pr-2 text-right">{a?.nb ?? 0}</td>
                      <td className="py-1.5 pr-2 text-right font-semibold text-forest-800">{a ? fmt2(a.somme / a.nb) : "—"}</td>
                      <td className="py-1.5 text-right">
                        <Link href={`${lienBase(e)}?onglet=notes&classe=${c.id}`} className="rounded-full border border-cream-300 px-3 py-1 text-xs font-medium text-forest-800 hover:bg-forest-50">Détail</Link>
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

  // Détail d'une classe : moyennes par discipline/période + élèves.
  const classe = classes.find((c) => c.id === classeId);
  if (!classe) return <Card><p className="text-sm text-ink-700/60">Classe introuvable.</p></Card>;
  const [notes, inscriptions] = await Promise.all([
    prisma.note.findMany({
      where: { classeId },
      include: { discipline: { select: { nom: true } } },
    }),
    prisma.inscription.findMany({
      where: { classeId },
      include: { eleve: { select: { id: true, nom: true, prenoms: true, matricule: true } } },
    }),
  ]);
  const parDiscipline = new Map<string, { somme: number; nb: number; periodes: Map<number, { somme: number; nb: number }> }>();
  const parEleve = new Map<string, { somme: number; nb: number }>();
  const periodes = new Set<number>();
  for (const n of notes) {
    periodes.add(n.periode);
    const d = parDiscipline.get(n.discipline.nom) ?? { somme: 0, nb: 0, periodes: new Map() };
    d.somme += sur20(n.valeur, n.sur); d.nb++;
    const p = d.periodes.get(n.periode) ?? { somme: 0, nb: 0 };
    p.somme += sur20(n.valeur, n.sur); p.nb++;
    d.periodes.set(n.periode, p);
    parDiscipline.set(n.discipline.nom, d);
    const el = parEleve.get(n.eleveId) ?? { somme: 0, nb: 0 };
    el.somme += sur20(n.valeur, n.sur); el.nb++;
    parEleve.set(n.eleveId, el);
  }
  const listePeriodes = [...periodes].sort((a, b) => a - b);
  const eleves = inscriptions
    .map((i) => ({ ...i.eleve, moy: parEleve.get(i.eleve.id) }))
    .sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), "fr"));

  return (
    <div className="space-y-4">
      <Link href={`${lienBase(e)}?onglet=notes`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={15} /> Toutes les classes
      </Link>
      <Card>
        <TitreSection icone={<BookOpenCheck size={17} className="text-forest-600" />} titre={`Moyennes — ${classe.nom}`} note={`${notes.length} note(s)`} />
        {parDiscipline.size === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune note saisie pour cette classe.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-1.5 pr-2">Discipline</th>
                  {listePeriodes.map((p) => <th key={p} className="py-1.5 pr-2 text-right">P{p}</th>)}
                  <th className="py-1.5 text-right">Moyenne</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {[...parDiscipline.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr")).map(([nom, d]) => (
                  <tr key={nom}>
                    <td className="py-1.5 pr-2 font-medium text-forest-900">{nom}</td>
                    {listePeriodes.map((p) => {
                      const x = d.periodes.get(p);
                      return <td key={p} className="py-1.5 pr-2 text-right">{x ? fmt2(x.somme / x.nb) : "—"}</td>;
                    })}
                    <td className="py-1.5 text-right font-semibold text-forest-800">{fmt2(d.somme / d.nb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <TitreSection icone={<Users size={17} className="text-forest-600" />} titre="Élèves de la classe" note="cliquer pour le bulletin" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                <th className="py-1.5 pr-2">#</th><th className="py-1.5 pr-2">Nom et prénoms</th>
                <th className="py-1.5 pr-2 text-right">Moyenne /20</th><th className="py-1.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {eleves.map((el, n) => (
                <tr key={el.id}>
                  <td className="py-1.5 pr-2 text-ink-700/50">{n + 1}</td>
                  <td className="py-1.5 pr-2 font-medium text-forest-900">{nomComplet(el)}</td>
                  <td className="py-1.5 pr-2 text-right font-semibold text-forest-800">{el.moy ? fmt2(el.moy.somme / el.moy.nb) : "—"}</td>
                  <td className="py-1.5 text-right">
                    <Link href={`${lienBase(e)}?onglet=notes&classe=${classeId}&eleve=${el.id}`} className="rounded-full border border-cream-300 px-3 py-1 text-xs font-medium text-forest-800 hover:bg-forest-50">Bulletin</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

async function BulletinEleve({ e, classeId, eleveId }: { e: EtabConsult; classeId: string; eleveId: string }) {
  // Cloisonnement : la classe doit appartenir à l'établissement consulté.
  const classe = await prisma.classe.findFirst({
    where: { id: classeId, etablissementId: e.id },
    include: { niveau: { select: { nom: true } } },
  });
  if (!classe) return <Card><p className="text-sm text-ink-700/60">Classe introuvable.</p></Card>;
  const [eleve, notes, grilles] = await Promise.all([
    prisma.utilisateur.findFirst({
      where: { id: eleveId, etablissementId: e.id },
      select: { id: true, nom: true, prenoms: true, matricule: true, sexe: true },
    }),
    prisma.note.findMany({
      where: { classeId, eleveId },
      include: { discipline: { select: { id: true, nom: true } } },
      orderBy: [{ periode: "asc" }, { creeLe: "asc" }],
    }),
    // Coefficients : grille de l'établissement, à défaut la grille nationale du pays
    // (même règle que le bulletin officiel : coef établissement > coef national > 1).
    prisma.grilleHoraire.findMany({
      where: {
        niveauId: classe.niveauId,
        OR: [{ etablissementId: e.id }, { etablissementId: null, pays: e.pays ?? "Côte d'Ivoire" }],
      },
      select: { disciplineId: true, coefficient: true, etablissementId: true },
    }),
  ]);
  if (!eleve) return <Card><p className="text-sm text-ink-700/60">Élève introuvable dans cet établissement.</p></Card>;

  const coefDe = (disciplineId: string) =>
    grilles.find((g) => g.disciplineId === disciplineId && g.etablissementId === e.id)?.coefficient ??
    grilles.find((g) => g.disciplineId === disciplineId && g.etablissementId === null)?.coefficient ?? 1;

  const parDiscipline = new Map<string, { notes: typeof notes; somme: number; nb: number; coef: number }>();
  for (const n of notes) {
    const d = parDiscipline.get(n.discipline.nom) ?? { notes: [], somme: 0, nb: 0, coef: coefDe(n.discipline.id) };
    d.notes.push(n); d.somme += sur20(n.valeur, n.sur); d.nb++;
    parDiscipline.set(n.discipline.nom, d);
  }
  // Moyenne générale PONDÉRÉE : Σ(moyenne de discipline × coef) / Σcoef.
  let sommePonderee = 0, sommeCoefs = 0;
  for (const d of parDiscipline.values()) {
    sommePonderee += (d.somme / d.nb) * d.coef;
    sommeCoefs += d.coef;
  }

  return (
    <div className="space-y-4">
      <Link href={`${lienBase(e)}?onglet=notes&classe=${classeId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={15} /> Retour à la classe {classe.nom}
      </Link>
      <Card>
        <TitreSection
          icone={<BookOpenCheck size={17} className="text-forest-600" />}
          titre={`Bulletin — ${nomComplet(eleve)}`}
          note={`${classe.nom} · ${classe.niveau.nom}${eleve.matricule ? ` · Matricule ${eleve.matricule}` : ""}`}
        />
        {notes.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune note saisie pour cet élève.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                    <th className="py-1.5 pr-2">Discipline</th><th className="py-1.5 pr-2">Évaluations (période · note)</th>
                    <th className="py-1.5 pr-2 text-right">Coef.</th><th className="py-1.5 text-right">Moyenne /20</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {[...parDiscipline.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr")).map(([nom, d]) => (
                    <tr key={nom}>
                      <td className="py-2 pr-2 align-top font-medium text-forest-900">{nom}</td>
                      <td className="py-2 pr-2">
                        <div className="flex flex-wrap gap-1.5">
                          {d.notes.map((n) => (
                            <span key={n.id} className="rounded-full bg-cream-100 px-2 py-0.5 text-[0.7rem] text-forest-800" title={n.libelle}>
                              P{n.periode} · {n.valeur.toLocaleString("fr-FR")}/{n.sur.toLocaleString("fr-FR")}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-right align-top text-ink-700/70">{d.coef.toLocaleString("fr-FR")}</td>
                      <td className="py-2 text-right align-top font-semibold text-forest-800">{fmt2(d.somme / d.nb)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-forest-200">
                    <td className="py-2 pr-2 font-semibold text-forest-900" colSpan={3}>Moyenne générale (pondérée par les coefficients)</td>
                    <td className="py-2 text-right font-display text-lg font-bold text-forest-900">{sommeCoefs > 0 ? fmt2(sommePonderee / sommeCoefs) : "—"} / 20</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ──────────────────────── Statistiques ────────────────────────

export async function OngletStats({ e }: { e: EtabConsult }) {
  const [a, niveaux, sexes] = await Promise.all([
    agregatsEtablissement(e.id),
    prisma.niveauEtablissement.findMany({
      where: { etablissementId: e.id },
      include: { niveau: { select: { nom: true, ordre: true } } },
    }),
    prisma.utilisateur.groupBy({
      by: ["sexe"],
      where: { etablissementId: e.id, roleActif: { nomTechnique: "eleve" } },
      _count: { _all: true },
    }),
  ]);
  niveaux.sort((x, y) => x.niveau.ordre - y.niveau.ordre);
  const maxEff = Math.max(1, ...niveaux.map((n) => n.effectif));
  const filles = sexes.find((s) => s.sexe === "F")?._count._all ?? 0;
  const garcons = sexes.find((s) => s.sexe === "M")?._count._all ?? 0;

  const kpis = [
    { libelle: "Élèves (comptes)", valeur: a.eleves.toLocaleString("fr-FR") },
    { libelle: "Filles / Garçons", valeur: `${filles.toLocaleString("fr-FR")} / ${garcons.toLocaleString("fr-FR")}` },
    { libelle: "Enseignants", valeur: a.enseignants.toLocaleString("fr-FR") },
    { libelle: "Classes", valeur: a.classes.toLocaleString("fr-FR") },
    { libelle: "Appels saisis", valeur: a.appels.toLocaleString("fr-FR") },
    { libelle: "Taux de présence", valeur: a.tauxPresence != null ? `${a.tauxPresence.toLocaleString("fr-FR")} %` : "—" },
    { libelle: "Notes saisies", valeur: a.nbNotes.toLocaleString("fr-FR") },
    { libelle: "Moyenne générale", valeur: a.moyenneGenerale != null ? `${a.moyenneGenerale.toLocaleString("fr-FR")} /20` : "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.libelle} className="p-4">
            <p className="font-display text-xl font-bold text-forest-900">{k.valeur}</p>
            <p className="text-xs text-ink-700/60">{k.libelle}</p>
          </Card>
        ))}
      </div>
      <Card>
        <TitreSection icone={<LayoutGrid size={17} className="text-forest-600" />} titre="Effectifs par niveau" note="effectifs configurés" />
        {niveaux.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucun niveau configuré.</p>
        ) : (
          <div className="space-y-2">
            {niveaux.map((n) => (
              <div key={n.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium text-forest-900">{n.niveau.nom}</span>
                <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-cream-100">
                  <div className="h-full rounded-full bg-forest-500" style={{ width: `${Math.round((n.effectif / maxEff) * 100)}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-sm text-ink-700/70">{n.effectif.toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="text-xs text-ink-700/50">
        Statistiques par classe : voir l&apos;onglet « Notes &amp; bulletins » (moyennes par classe) et « Registre d&apos;appel » (assiduité par classe).
      </p>
    </div>
  );
}

// ────────────────────────── Rapport ───────────────────────────

export async function OngletRapport({ e, peutTelechargerWord }: { e: EtabConsult; peutTelechargerWord: boolean }) {
  const [a, parClasse] = await Promise.all([agregatsEtablissement(e.id), statsParClasse(e.id)]);
  const lignes = [
    ["Établissement", e.nom],
    ["Code", e.code ?? "—"],
    ["Diocèse", e.diocese ?? "—"],
    ["Localité", [e.ville, e.region?.nom].filter(Boolean).join(" · ") || "—"],
    ["Élèves", a.eleves.toLocaleString("fr-FR")],
    ["Enseignants", a.enseignants.toLocaleString("fr-FR")],
    ["Classes / Salles", `${a.classes} / ${a.salles || e.nbSallesDisponibles}`],
    ["Taux de présence", a.tauxPresence != null ? `${a.tauxPresence.toLocaleString("fr-FR")} %` : "—"],
    ["Moyenne générale", a.moyenneGenerale != null ? `${a.moyenneGenerale.toLocaleString("fr-FR")} / 20` : "—"],
  ];
  return (
    <div className="space-y-4">
      <Card>
        <TitreSection icone={<ClipboardList size={17} className="text-forest-600" />} titre="Rapport d'établissement" note="généré depuis les données des classes" />
        <div className="divide-y divide-cream-200">
          {lignes.map(([l, v]) => <Info key={l} libelle={l} valeur={v} />)}
        </div>
      </Card>
      <Card>
        <TitreSection icone={<LayoutGrid size={17} className="text-forest-600" />} titre="Résultats par classe" note={`${parClasse.length} classe(s)`} />
        {parClasse.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune classe.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-1.5 pr-2">Classe</th><th className="py-1.5 pr-2">Niveau</th>
                  <th className="py-1.5 pr-2 text-right">Élèves</th><th className="py-1.5 pr-2 text-right">Présence</th>
                  <th className="py-1.5 pr-2 text-right">Abs. NJ</th><th className="py-1.5 pr-2 text-right">Moyenne /20</th>
                  <th className="py-1.5 text-right">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {parClasse.map((c) => (
                  <tr key={c.classeId}>
                    <td className="py-1.5 pr-2 font-medium text-forest-900">{c.nom}</td>
                    <td className="py-1.5 pr-2">{c.niveau}</td>
                    <td className="py-1.5 pr-2 text-right">{c.eleves}</td>
                    <td className="py-1.5 pr-2 text-right">{c.tauxPresence != null ? `${c.tauxPresence.toLocaleString("fr-FR")} %` : "—"}</td>
                    <td className="py-1.5 pr-2 text-right">{c.absentsNJ}</td>
                    <td className="py-1.5 pr-2 text-right font-semibold text-forest-800">{c.moyenne != null ? c.moyenne.toLocaleString("fr-FR") : "—"}</td>
                    <td className="py-1.5 text-right">{c.nbNotes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {peutTelechargerWord ? (
        <a
          href={`${lienBase(e)}/rapport-word`}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700"
        >
          <Download size={16} /> Télécharger le rapport (Word)
        </a>
      ) : (
        <p className="text-xs text-ink-700/55">
          Le téléchargement Word du rapport d&apos;établissement est réservé au SEDEC du diocèse (le SENEC télécharge les rapports de SEDEC
          depuis « Statistiques du réseau »).
        </p>
      )}
    </div>
  );
}

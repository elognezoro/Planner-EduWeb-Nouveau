import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, CalendarClock, Tags, Pencil, Users, Layers, LineChart, Upload } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLE_IDS, ROLES } from "@/lib/rbac/roles";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { FORMATS_SESSION } from "@/lib/lms";
import {
  FormCours, BoutonPublier, SupprimerCoursBtn,
  FormSession, SupprimerSessionBtn,
  FormCategorie, SupprimerCategorieBtn,
  type OptionsCommunes,
} from "./formulaires";

export const metadata: Metadata = { title: "Gestion du contenu — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const libelleFormat = (v: string) => FORMATS_SESSION.find((f) => f.v === v)?.libelle ?? v;
const dateHeure = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(d);
/** Valeur pour <input datetime-local> (AAAA-MM-JJTHH:MM, heure locale). */
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default async function GestionLmsPage() {
  await requireRole(["admin"]);

  const [categories, cours, sessions] = await Promise.all([
    prisma.categorieFormation.findMany({ orderBy: { ordre: "asc" }, select: { id: true, nom: true, _count: { select: { cours: true } } } }),
    prisma.cours.findMany({
      orderBy: [{ statut: "asc" }, { creeLe: "desc" }],
      select: { id: true, titre: true, description: true, statut: true, categorieId: true, niveau: true, publicCible: true, dureeMinutes: true, categorie: { select: { nom: true } }, _count: { select: { modules: true, inscriptions: true } } },
    }),
    prisma.sessionFormation.findMany({ orderBy: { dateDebut: "desc" }, select: { id: true, titre: true, description: true, coursId: true, format: true, animateur: true, dateDebut: true, dureeMinutes: true, lienVisio: true, lieu: true, placesMax: true, publicCible: true, pays: true, statut: true, _count: { select: { inscriptions: true } } } }),
  ]);

  const opts: OptionsCommunes = {
    categories: categories.map((c) => ({ id: c.id, nom: c.nom })),
    roles: ROLE_IDS.map((id) => ({ id, libelle: ROLES[id].libelle })),
    coursListe: cours.map((c) => ({ id: c.id, titre: c.titre })),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link href={`${BASE}/guides`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Retour à l&apos;espace apprenant</Link>
      <PageHeader
        titre="Gestion du contenu — Aide et Formation"
        description="Créer et publier des cours, des leçons et des sessions de formation."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`${BASE}/gestion/import`} className="inline-flex h-10 items-center gap-2 rounded-full border border-cream-300 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-cream-100"><Upload size={15} /> Importer</Link>
            <Link href={`${BASE}/suivi`} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-600 px-4 text-sm font-semibold text-white shadow-soft hover:bg-forest-700"><LineChart size={15} /> Suivi des apprenants</Link>
          </div>
        }
      />

      {/* Cours */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-forest-900"><BookOpen size={18} className="text-forest-600" /> Cours <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800">{cours.length}</span></h2>
          <FormCours opts={opts} />
        </div>
        {cours.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Aucun cours. Créez le premier avec « Nouveau cours ».</p></Card>
        ) : (
          <Card className="divide-y divide-cream-100 p-0">
            {cours.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-forest-900">{c.titre}</p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-700/60">
                    {c.categorie?.nom && <span>{c.categorie.nom}</span>}
                    <span className="inline-flex items-center gap-1"><Layers size={12} /> {c._count.modules} leçon(s)</span>
                    <span className="inline-flex items-center gap-1"><Users size={12} /> {c._count.inscriptions} inscrit(s)</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <BoutonPublier id={c.id} publie={c.statut === "publie"} />
                  <Link href={`${BASE}/gestion/cours/${c.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-cream-100"><Pencil size={13} /> Leçons & fiche</Link>
                  <SupprimerCoursBtn id={c.id} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Sessions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-forest-900"><CalendarClock size={18} className="text-forest-600" /> Sessions <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800">{sessions.length}</span></h2>
          <FormSession opts={opts} />
        </div>
        {sessions.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Aucune session programmée.</p></Card>
        ) : (
          <Card className="divide-y divide-cream-100 p-0">
            {sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-forest-900">{s.titre} <Badge ton={s.statut === "planifiee" ? "succes" : "neutre"}>{s.statut === "planifiee" ? "Planifiée" : s.statut}</Badge></p>
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-ink-700/60"><span>{libelleFormat(s.format)}</span><span>{dateHeure(s.dateDebut)}</span><span className="inline-flex items-center gap-1"><Users size={12} /> {s._count.inscriptions}{s.placesMax != null ? `/${s.placesMax}` : ""}</span></p>
                </div>
                <div className="flex items-center gap-1">
                  <FormSession opts={opts} session={{ ...s, dateDebut: iso(s.dateDebut) }} />
                  <SupprimerSessionBtn id={s.id} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Catégories */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-forest-900"><Tags size={18} className="text-forest-600" /> Catégories</h2>
          <FormCategorie />
        </div>
        {categories.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Aucune catégorie (facultatif — organise le catalogue).</p></Card>
        ) : (
          <Card className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-2 rounded-full border border-cream-300 bg-white py-1 pl-3 pr-1 text-sm">
                {c.nom} <span className="text-xs text-ink-700/50">({c._count.cours})</span>
                <SupprimerCategorieBtn id={c.id} />
              </span>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { estRoleValide, ROLES, type TypePortee } from "@/lib/rbac";
import { termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { termeApfcCourant } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { rapprocherEtablissement, type EtabRapproche } from "@/lib/etablissements/rapprochement";
import { PAYS_DEFAUT } from "@/lib/pays-consulte";
import { PAYS_ONU, trouverPays, drapeauUrl } from "@/lib/referentiels/pays";
import { diocesesDuPays } from "@/lib/referentiels/dioceses";
import { ApprobationsBoard, type ItemDemande } from "./approbations-board";

export const metadata: Metadata = { title: "Approbations" };
export const dynamic = "force-dynamic";

async function charger() {
  try {
    const [demandes, regions, cafops, apfcs] = await Promise.all([
      prisma.demandeRole.findMany({
        where: { statut: "en_attente" },
        orderBy: { creeLe: "asc" },
        include: {
          roleDemande: true,
          utilisateur: true,
          echanges: {
            orderBy: { creeLe: "asc" },
            include: { auteur: { select: { prenoms: true, nom: true, email: true } } },
          },
        },
      }),
      prisma.region.findMany({ orderBy: [{ pays: "asc" }, { nom: "asc" }] }),
      prisma.cafop.findMany({ orderBy: { nom: "asc" } }),
      prisma.apfc.findMany({ orderBy: { nom: "asc" } }),
    ]);
    const suggestions = new Map<string, EtabRapproche>();
    await Promise.all(
      demandes.map(async (d) => {
        const roleTech = d.roleDemande.nomTechnique;
        const portee = estRoleValide(roleTech) ? ROLES[roleTech].portee : "personnel";
        if (portee !== "etablissement" || !d.structureDeclaree) return;
        const s = await rapprocherEtablissement(d.structureDeclaree, d.utilisateur.pays ?? PAYS_DEFAUT);
        if (s) suggestions.set(d.id, s);
      }),
    );
    return { demandes, regions, cafops, apfcs, suggestions, ok: true as const };
  } catch (e) {
    console.error("[approbations] DB indisponible :", e);
    return { ok: false as const };
  }
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const dateLongue = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
const dateCourte = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(d);
const nomDe = (u: { prenoms: string | null; nom: string | null; email: string }) =>
  [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email;

const libellePortee: Partial<Record<TypePortee, string>> = {
  etablissement: "Établissement",
  region: "Région",
  cafop: "CAFOP",
  apfc: "APFC",
  pays: "Pays",
  diocese: "Diocèse",
};

export default async function ApprobationsPage({
  searchParams,
}: {
  searchParams: Promise<{ demande?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const data = await charger();
  const [terme, termeApfc] = await Promise.all([termeCafopCourant(), termeApfcCourant()]);
  const T = (s: string) => appliquerTermeApfc(appliquerTerme(s, terme), termeApfc);

  let items: ItemDemande[] = [];
  if (data.ok) {
    items = data.demandes.map((d) => {
      const portee: TypePortee = estRoleValide(d.roleDemande.nomTechnique)
        ? ROLES[d.roleDemande.nomTechnique].portee
        : "personnel";
      const options =
        portee === "region"
          ? data.regions.map((r) => ({ id: r.id, nom: r.nom }))
          : portee === "cafop"
            ? data.cafops.map((c) => ({ id: c.id, nom: c.nom }))
            : portee === "apfc"
              ? data.apfcs.map((a) => ({ id: a.id, nom: a.nom }))
              : portee === "pays"
                ? PAYS_ONU.map((p) => ({ id: p.nom, nom: p.nom }))
                : portee === "diocese"
                  ? diocesesDuPays(d.utilisateur.pays ?? PAYS_DEFAUT).map((n) => ({ id: n, nom: n }))
                  : [];
      // Périmètre pré-rempli : si le rôle est à portée « pays » et que le demandeur a déjà
      // choisi son pays à l'inscription, on pré-sélectionne l'option correspondante (modifiable).
      const paysDecl = d.utilisateur.pays;
      const defautPerimetre =
        portee === "pays" && paysDecl
          ? options.find((o) => o.nom === paysDecl) ?? options.find((o) => norm(o.nom) === norm(paysDecl)) ?? null
          : null;
      const infoPays = d.utilisateur.pays ? trouverPays(d.utilisateur.pays) : null;
      const dernier = d.echanges.length ? d.echanges[d.echanges.length - 1] : null;
      const dernierMessageDe: "demandeur" | "habilite" | "aucun" = dernier
        ? dernier.duDemandeur
          ? "demandeur"
          : "habilite"
        : "aucun";
      return {
        id: d.id,
        nomComplet: nomDe(d.utilisateur),
        email: d.utilisateur.email,
        paysNom: d.utilisateur.pays,
        paysDrapeau: infoPays ? drapeauUrl(infoPays.code) : null,
        roleLibelle: T(d.roleDemande.libelle),
        structureDeclaree: d.structureDeclaree,
        dateFr: dateLongue(d.creeLe),
        creeLeISO: d.creeLe.toISOString(),
        derniereActiviteISO: (dernier ? dernier.creeLe : d.creeLe).toISOString(),
        dernierMessageDe,
        libellePortee: libellePortee[portee] ? T(libellePortee[portee]!) : undefined,
        rechercheEtablissement: portee === "etablissement",
        options,
        suggestion: data.suggestions.get(d.id) ?? null,
        defautPerimetre,
        echanges: d.echanges.map((e) => ({
          id: e.id,
          contenu: e.contenu,
          duDemandeur: e.duDemandeur,
          auteur: nomDe(e.auteur),
          date: dateCourte(e.creeLe),
        })),
      };
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        titre="Approbations des demandes de rôle"
        description="Échangez avec les demandeurs (avec copie e-mail des deux côtés) pour cerner leur besoin réel, puis approuvez ou refusez en connaissance de cause. La sélection multiple permet un message groupé."
      />

      {!data.ok ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger les demandes. Vérifiez la connexion à la base de données (DATABASE_URL).
          </p>
        </Card>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-500">
            <Inbox size={26} />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold text-forest-900">Aucune demande en attente</h2>
          <p className="mt-1 text-sm text-ink-700/65">Les nouvelles demandes de rôle apparaîtront ici.</p>
        </Card>
      ) : (
        <ApprobationsBoard items={items} cibleId={sp.demande ?? null} />
      )}
    </div>
  );
}

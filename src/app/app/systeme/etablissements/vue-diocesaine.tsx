import Link from "next/link";
import { Church, School, MapPin, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { filtreEtablissements, type PorteeUtilisateur } from "@/lib/rbac";
import { Card } from "@/components/app/ui";
import { TYPES_ETABLISSEMENT } from "@/lib/referentiels/etablissement";

const LIB_TYPE = new Map<string, string>(TYPES_ETABLISSEMENT.map((t) => [t.v, t.l]));
const libelleType = (v: string) => LIB_TYPE.get(v) ?? v;

/**
 * Vue « enseignement catholique » (LECTURE SEULE) de la page Établissements :
 *  - SENEC (national), sans diocèse choisi → tuiles des DIOCÈSES de son pays (réseau SEDEC) ;
 *  - SENEC après clic sur un diocèse (ou SEDEC) → tuiles des ÉTABLISSEMENTS du diocèse.
 * Le périmètre (pays / diocèse + réseau catholique SEDEC) vient de `filtreEtablissements`.
 */
export async function VueDiocesaine({
  portee,
  role,
  diocese,
}: {
  portee: PorteeUtilisateur;
  role: "senec" | "sedec";
  diocese: string | null;
}) {
  const base = filtreEtablissements(portee);

  // SENEC, aucun diocèse choisi → tuiles des diocèses.
  if (role === "senec" && !diocese) {
    const groupes = await prisma.etablissement
      .groupBy({ by: ["diocese"], where: base, _count: { _all: true } })
      .catch(() => [] as { diocese: string | null; _count: { _all: number } }[]);
    const tuiles = groupes
      .filter((g) => g.diocese)
      .map((g) => ({ diocese: g.diocese as string, n: g._count._all }))
      .sort((a, b) => a.diocese.localeCompare(b.diocese, "fr"));
    const sansDiocese = groupes.find((g) => !g.diocese)?._count._all ?? 0;

    return (
      <div className="space-y-6">
        <Entete titre="Établissements catholiques" sousTitre="Réseau SEDEC — par diocèse (consultation)" />
        {tuiles.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-700/70">
              Aucun établissement catholique (réseau SEDEC) n&apos;est encore rattaché à un diocèse dans votre
              périmètre. Le diocèse se renseigne dans la configuration de chaque établissement.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tuiles.map((t) => (
              <Link
                key={t.diocese}
                href={`/app/systeme/etablissements?diocese=${encodeURIComponent(t.diocese)}`}
                className="group flex items-start gap-3 rounded-2xl border border-cream-300 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-forest-400 hover:shadow-soft"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                  <Church size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-base font-bold text-forest-900">{t.diocese}</span>
                  <span className="text-sm text-ink-700/60">
                    {t.n} établissement{t.n > 1 ? "s" : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
        {sansDiocese > 0 && (
          <p className="text-xs text-gold-700">
            {sansDiocese} établissement{sansDiocese > 1 ? "s" : ""} catholique{sansDiocese > 1 ? "s" : ""} sans diocèse
            renseigné (non affiché{sansDiocese > 1 ? "s" : ""} ci-dessus).
          </p>
        )}
      </div>
    );
  }

  // SENEC (diocèse choisi) ou SEDEC → tuiles des établissements du diocèse.
  const where = role === "senec" && diocese ? { ...base, diocese } : base;
  const etabs = await prisma.etablissement
    .findMany({
      where,
      orderBy: [{ nom: "asc" }],
      select: { id: true, nom: true, ville: true, code: true, type: true, diocese: true },
    })
    .catch(() => [] as { id: string; nom: string; ville: string | null; code: string | null; type: string; diocese: string | null }[]);

  const titreDiocese = role === "senec" ? diocese : etabs[0]?.diocese ?? "votre diocèse";

  return (
    <div className="space-y-6">
      <Entete titre={`Établissements — ${titreDiocese ?? ""}`} sousTitre="Réseau SEDEC (consultation)" />
      {role === "senec" && (
        <Link
          href="/app/systeme/etablissements"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"
        >
          <ArrowLeft size={15} /> Tous les diocèses
        </Link>
      )}
      {etabs.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">Aucun établissement catholique rattaché à ce diocèse pour le moment.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {etabs.map((e) => (
            <Link
              key={e.id}
              href={`/app/systeme/etablissements/${e.id}`}
              className="group flex items-start gap-3 rounded-2xl border border-cream-300 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-forest-400 hover:shadow-soft"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-forest-700">
                <School size={20} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-forest-900">{e.nom}</span>
                <span className="block text-xs text-ink-700/55">{libelleType(e.type)}</span>
                {(e.ville || e.code) && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-700/60">
                    <MapPin size={11} className="shrink-0" />
                    {[e.ville, e.code].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Entete({ titre, sousTitre }: { titre: string; sousTitre: string }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-forest-900">{titre}</h1>
      <p className="mt-1 text-sm text-ink-700/60">{sousTitre}</p>
    </div>
  );
}

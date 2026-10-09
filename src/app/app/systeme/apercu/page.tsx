import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Eye, Check } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";
import { ROLES, peutUtiliserApercu, rolesConsultablesEnApercu } from "@/lib/rbac";
import { termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { termeApfcCourant } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { activerApercu, quitterApercu } from "./actions";

export const metadata: Metadata = { title: "Aperçu de rôle" };
export const dynamic = "force-dynamic";

const libellePortee: Record<string, string> = {
  global: "National",
  etablissement: "Établissement",
  cafop: "CAFOP",
  apfc: "APFC",
  antenne: "Antenne",
  region: "Région / zone",
  personnel: "Personnel",
};

export default async function ApercuPage() {
  const u = await requireUtilisateur();
  // L'accès dépend du rôle RÉEL (un admin reste habilité même pendant un aperçu).
  if (!peutUtiliserApercu(u.roleReel)) redirect("/app");

  const roles = rolesConsultablesEnApercu(u.roleReel);
  const [terme, termeApfc] = await Promise.all([termeCafopCourant(), termeApfcCourant()]);
  const T = (s: string) => appliquerTermeApfc(appliquerTerme(s, terme), termeApfc);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        titre="Aperçu de rôle"
        description="Visualisez l'interface telle qu'elle apparaît pour un autre rôle, sans changer de compte. L'aperçu est en lecture seule et filtré par votre périmètre."
      />

      {u.apercuActif && (
        <Card className="mb-6 flex flex-col gap-3 border-gold-300/70 bg-gold-50 sm:flex-row sm:items-center sm:justify-between mobile:flex-col mobile:items-stretch mobile:p-4">
          <p className="flex items-center gap-2 text-sm text-gold-900">
            <Eye size={18} className="text-gold-600" />
            Aperçu actif en tant que <strong>{T(u.libelleRoleActif)}</strong>.
          </p>
          <form action={quitterApercu} className="mobile:w-full">
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-full bg-forest-800 px-4 text-xs font-semibold text-cream-50 hover:bg-forest-700 mobile:h-11 mobile:w-full mobile:justify-center mobile:text-sm"
            >
              Quitter l&apos;aperçu
            </button>
          </form>
        </Card>
      )}

      {/* Téléphone : liste compacte ci-dessous (≈ 34 cartes de 190 px faisaient ~6 500 px). */}
      <div className="grid gap-4 sm:grid-cols-2 mobile:hidden">
        {roles.map((id) => {
          const role = ROLES[id];
          const actif = u.apercuActif && u.roleActif === id;
          return (
            <Card key={id} className={actif ? "border-gold-400 ring-1 ring-gold-300" : ""}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-forest-900">{T(role.libelle)}</h3>
                <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-forest-700">
                  {T(libellePortee[role.portee])}
                </span>
              </div>
              <p className="mt-2 min-h-[2.5rem] text-sm leading-relaxed text-ink-700/75">
                {T(role.description)}
              </p>
              <form action={activerApercu} className="mt-4">
                <input type="hidden" name="role" value={id} />
                <button
                  type="submit"
                  disabled={actif}
                  className={
                    "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors disabled:opacity-70 " +
                    (actif
                      ? "bg-forest-100 text-forest-700"
                      : "border border-forest-200 text-forest-800 hover:bg-forest-50")
                  }
                >
                  {actif ? (
                    <>
                      <Check size={14} /> Aperçu en cours
                    </>
                  ) : (
                    <>
                      <Eye size={14} /> Prévisualiser
                    </>
                  )}
                </button>
              </form>
            </Card>
          );
        })}
      </div>

      {/* Téléphone : une rangée par rôle (libellé, portée, description complète) ; un appui
          envoie le même formulaire activerApercu que le bouton « Prévisualiser » des cartes. */}
      <Card className="overflow-hidden p-0 lg:hidden print:hidden">
        <ul className="divide-y divide-cream-100">
          {roles.map((id) => {
            const role = ROLES[id];
            const actif = u.apercuActif && u.roleActif === id;
            return (
              <li key={id}>
                <form action={activerApercu}>
                  <input type="hidden" name="role" value={id} />
                  <button
                    type="submit"
                    disabled={actif}
                    className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left active:bg-cream-50 ${actif ? "bg-gold-50" : ""}`}
                  >
                    {/* Nom accessible = texte visible (libellé, portée, description), préfixé de l'action. */}
                    {!actif && <span className="sr-only">Prévisualiser : </span>}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-forest-900">{T(role.libelle)}</span>
                        <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-medium text-forest-700">
                          {T(libellePortee[role.portee])}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-700/70">{T(role.description)}</span>
                    </span>
                    {actif ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-forest-700">
                        <Check size={14} /> En cours
                      </span>
                    ) : (
                      <Eye size={18} className="shrink-0 text-forest-600" aria-hidden />
                    )}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

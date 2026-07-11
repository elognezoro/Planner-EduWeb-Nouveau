import type { Metadata } from "next";
import { ClipboardCheck, Inbox, CheckCircle2 } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { CorrectionForm } from "./correction-form";

export const metadata: Metadata = { title: "Corrections — Aide et Formation" };
export const dynamic = "force-dynamic";

const nomApprenant = (u: { nom: string | null; prenoms: string | null; email: string }) =>
  [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email;

export default async function CorrectionsPage() {
  const u = await requireUtilisateur();
  const estAdmin = u.roleActif === "admin";

  const nbTuteur = estAdmin ? 1 : await prisma.tuteurCours.count({ where: { utilisateurId: u.id } });

  const soumissions = nbTuteur === 0 ? [] : await prisma.soumissionDevoir.findMany({
    where: estAdmin ? {} : { devoir: { module: { cours: { tuteurs: { some: { utilisateurId: u.id } } } } } },
    orderBy: [{ statut: "desc" }, { dateSoumission: "desc" }], // « soumis » avant « corrige »
    select: {
      id: true, texte: true, fichierUrl: true, fichierNom: true, note: true, appreciation: true, statut: true, dateSoumission: true,
      utilisateur: { select: { nom: true, prenoms: true, email: true } },
      devoir: { select: { noteSur: true, module: { select: { titre: true, cours: { select: { titre: true } } } } } },
    },
  });

  const aCorriger = soumissions.filter((s) => s.statut !== "corrige");
  const corriges = soumissions.filter((s) => s.statut === "corrige");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader titre="Corrections" description="Dépôts de devoirs à corriger sur les cours dont vous êtes tuteur." />

      {nbTuteur === 0 ? (
        <Card><p className="text-sm text-ink-700/70">Vous n&apos;êtes tuteur désigné d&apos;aucun cours pour l&apos;instant. Un administrateur peut vous ajouter comme tuteur depuis la fiche d&apos;un cours.</p></Card>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink-700/55"><Inbox size={16} /> À corriger ({aCorriger.length})</h2>
            {aCorriger.length === 0 ? (
              <Card><p className="text-sm text-ink-700/60">Aucun dépôt en attente. 🎉</p></Card>
            ) : (
              aCorriger.map((s) => (
                <Card key={s.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-forest-900">{nomApprenant(s.utilisateur)}</p>
                      <p className="truncate text-xs text-ink-700/55">{s.devoir.module.cours?.titre ?? ""} › {s.devoir.module.titre} · déposé le {new Date(s.dateSoumission).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <Badge ton="attente">À corriger</Badge>
                  </div>
                  <CorrectionForm soumission={{ id: s.id, texte: s.texte, fichierUrl: s.fichierUrl, fichierNom: s.fichierNom, note: s.note, appreciation: s.appreciation, statut: s.statut, noteSur: s.devoir.noteSur }} />
                </Card>
              ))
            )}
          </section>

          {corriges.length > 0 && (
            <section className="space-y-3">
              <h2 className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink-700/55"><ClipboardCheck size={16} /> Corrigés ({corriges.length})</h2>
              {corriges.map((s) => (
                <Card key={s.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-forest-900">{nomApprenant(s.utilisateur)}</p>
                      <p className="truncate text-xs text-ink-700/55">{s.devoir.module.cours?.titre ?? ""} › {s.devoir.module.titre}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-forest-800"><CheckCircle2 size={14} /> {s.note != null ? `${s.note}/${s.devoir.noteSur}` : "Corrigé"}</span>
                  </div>
                  <CorrectionForm soumission={{ id: s.id, texte: s.texte, fichierUrl: s.fichierUrl, fichierNom: s.fichierNom, note: s.note, appreciation: s.appreciation, statut: s.statut, noteSur: s.devoir.noteSur }} />
                </Card>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

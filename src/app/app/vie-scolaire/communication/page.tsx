import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, PenSquare } from "lucide-react";
import { requireAccesComplet } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { NouveauMessageForm, RepondreForm, MarquerLue } from "./components";

export const metadata: Metadata = { title: "Communication" };
export const dynamic = "force-dynamic";

const BASE = "/app/vie-scolaire/communication";

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}
function heure(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export default async function CommunicationPage({
  searchParams,
}: {
  searchParams: Promise<{ avec?: string }>;
}) {
  const u = await requireAccesComplet();
  const sp = await searchParams;
  const avec = sp.avec?.trim() || null;

  let conversations: { id: string; nom: string; dernier: string; date: Date; nonLus: number }[] = [];
  let thread: { id: string; deMoi: boolean; contenu: string; date: Date }[] = [];
  let avecNom = "";
  let erreur = false;

  try {
    const messages = await prisma.message.findMany({
      where: { OR: [{ expediteurId: u.id }, { destinataireId: u.id }] },
      orderBy: { creeLe: "desc" },
      take: 200,
      include: {
        expediteur: { select: { id: true, prenoms: true, nom: true, email: true } },
        destinataire: { select: { id: true, prenoms: true, nom: true, email: true } },
      },
    });

    const convs = new Map<string, { id: string; nom: string; dernier: string; date: Date; nonLus: number }>();
    for (const m of messages) {
      const autre = m.expediteurId === u.id ? m.destinataire : m.expediteur;
      const existant = convs.get(autre.id);
      if (!existant) {
        convs.set(autre.id, {
          id: autre.id,
          nom: nomComplet(autre),
          dernier: m.contenu,
          date: m.creeLe,
          nonLus: m.destinataireId === u.id && !m.lu ? 1 : 0,
        });
      } else if (m.destinataireId === u.id && !m.lu) {
        existant.nonLus += 1;
      }
    }
    conversations = [...convs.values()];

    if (avec) {
      const autre = await prisma.utilisateur.findUnique({
        where: { id: avec },
        select: { prenoms: true, nom: true, email: true },
      });
      avecNom = autre ? nomComplet(autre) : "Conversation";
      thread = messages
        .filter((m) => m.expediteurId === avec || m.destinataireId === avec)
        .reverse()
        .map((m) => ({ id: m.id, deMoi: m.expediteurId === u.id, contenu: m.contenu, date: m.creeLe }));
    }
  } catch (e) {
    console.error("[communication] :", e);
    erreur = true;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader titre="Communication" description="Vos échanges avec les autres membres de la plateforme." />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger la messagerie.</p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          {/* Conversations + nouveau message */}
          <div className="space-y-4">
            <Card>
              <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-forest-900">
                <PenSquare size={16} /> Nouveau message
              </h2>
              <NouveauMessageForm />
            </Card>

            <Card className="p-0">
              <h2 className="border-b border-cream-100 px-4 py-3 font-display text-sm font-bold text-forest-900">
                Conversations
              </h2>
              {conversations.length === 0 ? (
                <p className="px-4 py-6 text-sm text-ink-700/55">Aucune conversation.</p>
              ) : (
                <ul className="divide-y divide-cream-100">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`${BASE}?avec=${c.id}`}
                        className={`block px-4 py-3 transition-colors hover:bg-cream-50 ${avec === c.id ? "bg-forest-50/50" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-forest-900">{c.nom}</span>
                          {c.nonLus > 0 && (
                            <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[0.6rem] font-bold text-white">
                              {c.nonLus}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-700/60">{c.dernier}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Fil de conversation */}
          <Card className="flex min-h-[24rem] flex-col">
            {!avec ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-ink-700/45">
                <MessageSquare size={28} />
                <p className="mt-2 text-sm">Sélectionnez une conversation ou écrivez un nouveau message.</p>
              </div>
            ) : (
              <>
                <MarquerLue avec={avec} />
                <h2 className="mb-4 font-display text-base font-bold text-forest-900">{avecNom}</h2>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {thread.length === 0 ? (
                    <p className="text-sm text-ink-700/55">Aucun message. Démarrez la conversation ci-dessous.</p>
                  ) : (
                    thread.map((m) => (
                      <div key={m.id} className={`flex ${m.deMoi ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                            m.deMoi ? "bg-forest-800 text-cream-50" : "bg-cream-100 text-ink-900"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.contenu}</p>
                          <p className={`mt-1 text-[0.6rem] ${m.deMoi ? "text-cream-200/70" : "text-ink-700/45"}`}>
                            {heure(m.date)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 border-t border-cream-100 pt-3">
                  <RepondreForm destinataireId={avec} />
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

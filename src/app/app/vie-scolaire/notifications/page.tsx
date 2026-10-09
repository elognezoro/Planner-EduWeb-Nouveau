import type { Metadata } from "next";
import { requireUtilisateur } from "@/lib/auth/session";
import { chargerNotifications } from "@/lib/notifications/actions";
import { PageHeader, Card } from "@/components/app/ui";
import { ListeNotifications } from "./liste";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireUtilisateur();
  const { notifications } = await chargerNotifications(50);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titre="Notifications"
        description="Toutes vos notifications récentes, classées de la plus récente à la plus ancienne."
      />
      <Card className="mobile:p-3">
        <ListeNotifications initiales={notifications} />
      </Card>
    </div>
  );
}

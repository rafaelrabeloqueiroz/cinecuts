import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { userHasActiveSubscription } from "@/lib/subscription";
import SubscribePanel from "./subscribe-panel";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const userId = (session.user as { id: string }).id;
    if (await userHasActiveSubscription(userId)) redirect("/catalogo");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6 py-12">
      <h1 className="text-3xl font-bold">Assine o CineCuts</h1>
      <SubscribePanel demoMode={isDemoMode} authenticated={Boolean(session?.user)} email={session?.user?.email ?? null} />
    </main>
  );
}

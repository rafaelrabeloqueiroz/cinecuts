import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { prisma } from "@cinecuts/db";

/** Ativa uma assinatura fictícia de 30 dias, sem passar pelo Stripe. */
export async function POST() {
  if (!isDemoMode) {
    return NextResponse.json({ error: "Disponível apenas em modo demo" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const stripeSubscriptionId = `demo_${userId}`;

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId },
    create: {
      userId,
      stripeSubscriptionId,
      stripePriceId: "demo_price",
      status: "ACTIVE",
      currentPeriodEnd,
    },
    update: { status: "ACTIVE", currentPeriodEnd },
  });

  return NextResponse.json({ ok: true });
}
